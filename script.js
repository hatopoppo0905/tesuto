import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

// ====================
// 設定値（カスタマイズ用）
// ====================
const MOUSE_SENSITIVITY = 0.002; 
const TOUCH_SENSITIVITY = 0.004;
const MAX_MOUSE_DELTA = 100;

const MOVE_SPEED = 5.0;          
const DASH_SPEED = 8.5;          
const ENEMY_SPEED = 7.5;         
const ENEMY_COUNT = 3;           
const LOCKER_COUNT = 5;          
const ITEM_COUNT = 2; // 消滅アイテム(★)の出現数
const DECOY_ITEM_COUNT = 2; // デコイアイテム(🔔)の出現数

const PLAYER_RADIUS = 0.6;       

// スタミナ設定
const MAX_STAMINA = 100;
let stamina = MAX_STAMINA;
const STAMINA_DRAIN = 35;        
const STAMINA_RECOVER = 20;      

// 廊下サイズ設定
const MAZE_WIDTH = 25;
const MAZE_HEIGHT = 25;
const TILE = 3.0;        
const WALL_HEIGHT = 3.0;

// タイマー＆ストック管理
let enemyVanishTimer = 0;
let decoyStock = 0;
let activeDecoy = null;

// 操作モード（"PC" または "TOUCH"）
let inputMode = "PC";

// ====================
// ゲーム状態管理
// ====================
const STATES = { MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAMEOVER: "GAMEOVER", CLEAR: "CLEAR" };
let gameState = STATES.MENU;

const mainMenu = document.getElementById("main-menu");
const pauseMenu = document.getElementById("pause-menu");
const gameOverScreen = document.getElementById("game-over-screen");
const clearScreen = document.getElementById("clear-screen");
const gameMessage = document.getElementById("game-message");
const touchUI = document.getElementById("touch-ui");

let hasKey = false;
let messageTimer = null;

function showMessage(text, duration = 2000) {
    if (!gameMessage) return;
    gameMessage.innerText = text;
    gameMessage.classList.remove("hidden");
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        gameMessage.classList.add("hidden");
    }, duration);
}

// ====================
// UI作成（インタラクト/デコイ/スタミナ）
// ====================
// 1. ロッカー等のインタラクトボタン
const interactBtn = document.createElement("button");
interactBtn.style.position = "absolute";
interactBtn.style.bottom = "20%";
interactBtn.style.left = "50%";
interactBtn.style.transform = "translateX(-50%)";
interactBtn.style.padding = "12px 24px";
interactBtn.style.fontSize = "18px";
interactBtn.style.fontWeight = "bold";
interactBtn.style.color = "#ffffff";
interactBtn.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
interactBtn.style.border = "2px solid #ffffff";
interactBtn.style.borderRadius = "12px";
interactBtn.style.zIndex = "25";
interactBtn.classList.add("hidden", "action-touch-btn");
document.body.appendChild(interactBtn);

function setInteractText(text) {
    if (!text) {
        interactBtn.classList.add("hidden");
    } else {
        interactBtn.innerText = text;
        interactBtn.classList.remove("hidden");
    }
}

interactBtn.addEventListener("click", () => {
    triggerInteractAction();
});

// 2. 画面左上のベル（デコイ）ボタン
const decoyBtn = document.createElement("button");
decoyBtn.style.position = "absolute";
decoyBtn.style.top = "35px";
decoyBtn.style.left = "10px";
decoyBtn.style.padding = "8px 16px";
decoyBtn.style.fontSize = "15px";
decoyBtn.style.fontWeight = "bold";
decoyBtn.style.color = "#000";
decoyBtn.style.backgroundColor = "#ffff00";
decoyBtn.style.border = "2px solid #ffffff";
decoyBtn.style.borderRadius = "8px";
decoyBtn.style.zIndex = "25";
decoyBtn.classList.add("action-touch-btn");
document.body.appendChild(decoyBtn);

function updateDecoyUI() {
    decoyBtn.innerText = `🔔 デコイ: ${decoyStock}個`;
}

decoyBtn.addEventListener("click", () => {
    triggerDecoyAction();
});

// 3. スタミナゲージ
const staminaContainer = document.createElement("div");
staminaContainer.style.position = "absolute";
staminaContainer.style.top = "10px";
staminaContainer.style.left = "10px";
staminaContainer.style.width = "200px";
staminaContainer.style.height = "16px";
staminaContainer.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
staminaContainer.style.border = "2px solid #ffffff";
staminaContainer.style.borderRadius = "8px";
staminaContainer.style.overflow = "hidden";
staminaContainer.style.zIndex = "10";

const staminaBar = document.createElement("div");
staminaBar.style.width = "100%";
staminaBar.style.height = "100%";
staminaBar.style.backgroundColor = "#00ff88";
staminaBar.style.transition = "width 0.05s linear";
staminaContainer.appendChild(staminaBar);
document.body.appendChild(staminaContainer);

// ====================
// シーン・カメラ・レンダラー
// ====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333338);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener("click", () => {
    if (inputMode === "PC" && gameState === STATES.PLAYING && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
});

// ====================
// ミニマップUI
// ====================
const minimapCanvas = document.createElement("canvas");
minimapCanvas.width = 120;
minimapCanvas.height = 120;
minimapCanvas.style.position = "absolute";
minimapCanvas.style.top = "10px";
minimapCanvas.style.right = "10px";
minimapCanvas.style.width = "120px";
minimapCanvas.style.height = "120px";
minimapCanvas.style.border = "2px solid #ffffff";
minimapCanvas.style.borderRadius = "8px";
minimapCanvas.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
minimapCanvas.style.zIndex = "10";
minimapCanvas.style.pointerEvents = "none";
document.body.appendChild(minimapCanvas);

const minimapCtx = minimapCanvas.getContext("2d");

// ライティング
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// 床 & 屋根
const floorMat = new THREE.MeshLambertMaterial({ color: 0x55555d });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_WIDTH * TILE * 2, MAZE_HEIGHT * TILE * 2), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const ceilingMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_WIDTH * TILE * 2, MAZE_HEIGHT * TILE * 2), ceilingMat);
ceiling.position.y = WALL_HEIGHT;
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);

// 迷路データ
let maze = [];
let walls = [];
let wallMeshes = [];
let openTiles = [];
let lockers = [];
let lightMeshes = [];
let vanishItems = [];
let decoyPickups = [];

let startPos = new THREE.Vector3();
let goalPos = new THREE.Vector3();
let keyPos = new THREE.Vector3();

const keyGroup = new THREE.Group();
const keyMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.08, 8, 16),
    new THREE.MeshLambertMaterial({ color: 0xffd700 })
);
keyGroup.add(keyMesh);
scene.add(keyGroup);

const goalMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, WALL_HEIGHT, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5 })
);
scene.add(goalMesh);

function generateMazeData(w, h) {
    const grid = Array.from({ length: h }, () => Array(w).fill("#"));

    function carve(x, z, lastDir = null) {
        let dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        if (lastDir && Math.random() < 0.6) {
            dirs = dirs.sort((a, b) => (a[0] === lastDir[0] && a[1] === lastDir[1]) ? -1 : 1);
        } else {
            dirs.sort(() => Math.random() - 0.5);
        }

        for (const [dx, dz] of dirs) {
            const nx = x + dx, nz = z + dz;
            if (nx > 0 && nx < w - 1 && nz > 0 && nz < h - 1 && grid[nz][nx] === "#") {
                grid[z + dz / 2][x + dx / 2] = " ";
                grid[nz][nx] = " ";
                carve(nx, nz, [dx, dz]);
            }
        }
    }
    grid[1][1] = " ";
    carve(1, 1);
    return grid;
}

function buildMaze() {
    wallMeshes.forEach(mesh => scene.remove(mesh));
    lockers.forEach(l => scene.remove(l.mesh));
    lightMeshes.forEach(mesh => scene.remove(mesh));
    vanishItems.forEach(item => scene.remove(item.mesh));
    decoyPickups.forEach(item => scene.remove(item.mesh));
    if (activeDecoy) { scene.remove(activeDecoy.mesh); activeDecoy = null; }

    wallMeshes = []; walls = []; openTiles = []; lockers = []; lightMeshes = [];
    vanishItems = []; decoyPickups = [];
    enemyVanishTimer = 0; decoyStock = 0;
    updateDecoyUI();

    maze = generateMazeData(MAZE_WIDTH, MAZE_HEIGHT);

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z][x] === " ") {
                openTiles.push({ x, z, pos: new THREE.Vector3(x * TILE, 1.5, z * TILE) });
            }
        }
    }

    const shuffled = [...openTiles].sort(() => Math.random() - 0.5);
    startPos.copy(shuffled[0].pos);
    goalPos.copy(shuffled[1].pos);
    keyPos.copy(shuffled[2].pos);

    keyGroup.position.set(keyPos.x, 1.2, keyPos.z);
    goalMesh.position.set(goalPos.x, WALL_HEIGHT / 2, goalPos.z);

    const wallGeo = new THREE.BoxGeometry(TILE, WALL_HEIGHT, TILE);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
    const lightGeo = new THREE.BoxGeometry(0.3, 0.08, 1.5);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z][x] === "#") {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x * TILE, WALL_HEIGHT / 2, z * TILE);
                scene.add(wall); walls.push(wall); wallMeshes.push(wall);
            } else if ((x + z) % 3 === 0) {
                const light = new THREE.Mesh(lightGeo, lightMat);
                light.position.set(x * TILE, WALL_HEIGHT - 0.04, z * TILE);
                scene.add(light); lightMeshes.push(light);
            }
        }
    }

    // 消滅アイテム (★)
    const itemGeo = new THREE.OctahedronGeometry(0.4);
    const itemMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true });
    for (let i = 0; i < ITEM_COUNT; i++) {
        const itemTile = shuffled[i + 12] || openTiles[3];
        const itemMesh = new THREE.Mesh(itemGeo, itemMat);
        itemMesh.position.set(itemTile.pos.x, 1.2, itemTile.pos.z);
        scene.add(itemMesh);
        vanishItems.push({ mesh: itemMesh, pos: itemTile.pos.clone(), active: true });
    }

    // デコイアイテム (🔔)
    const decoyGeo = new THREE.ConeGeometry(0.3, 0.6, 8);
    const decoyMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    for (let i = 0; i < DECOY_ITEM_COUNT; i++) {
        const tile = shuffled[i + 15] || openTiles[4];
        const mesh = new THREE.Mesh(decoyGeo, decoyMat);
        mesh.position.set(tile.pos.x, 1.2, tile.pos.z);
        scene.add(mesh);
        decoyPickups.push({ mesh: mesh, pos: tile.pos.clone(), active: true });
    }

    // ロッカー設置
    const lockerGeo = new THREE.BoxGeometry(0.8, 2.4, 0.5);
    const lockerMat = new THREE.MeshLambertMaterial({ color: 0x2266aa });
    const wallAdjacentTiles = shuffled.slice(6).filter(tile => {
        const { x, z } = tile;
        return (maze[z-1] && maze[z-1][x] === "#") || (maze[z+1] && maze[z+1][x] === "#") ||
               (maze[z][x-1] === "#") || (maze[z][x+1] === "#");
    });

    for (let i = 0; i < LOCKER_COUNT; i++) {
        const tile = wallAdjacentTiles[i] || shuffled[i + 6] || openTiles[0];
        const lockerMesh = new THREE.Mesh(lockerGeo, lockerMat);
        let offsetX = 0, offsetZ = 0, rotationY = 0;
        const offsetDist = TILE * 0.38;

        if (maze[tile.z - 1] && maze[tile.z - 1][tile.x] === "#") { offsetZ = -offsetDist; rotationY = 0; }
        else if (maze[tile.z + 1] && maze[tile.z + 1][tile.x] === "#") { offsetZ = offsetDist; rotationY = Math.PI; }
        else if (maze[tile.z][tile.x - 1] === "#") { offsetX = -offsetDist; rotationY = -Math.PI / 2; }
        else if (maze[tile.z][tile.x + 1] === "#") { offsetX = offsetDist; rotationY = Math.PI / 2; }

        const lockerPos = new THREE.Vector3(tile.pos.x + offsetX, 1.2, tile.pos.z + offsetZ);
        lockerMesh.position.copy(lockerPos);
        lockerMesh.rotation.y = rotationY;
        scene.add(lockerMesh);
        lockers.push({ mesh: lockerMesh, pos: lockerPos, standPos: tile.pos.clone() });
    }
}

function hitWall(x, z, radius = PLAYER_RADIUS) {
    const wallHalfSize = TILE / 2;
    for (const wall of walls) {
        if (x > wall.position.x - wallHalfSize - radius && x < wall.position.x + wallHalfSize + radius &&
            z > wall.position.z - wallHalfSize - radius && z < wall.position.z + wallHalfSize + radius) return true;
    }
    return false;
}

function worldToGrid(worldPos) {
    return {
        x: Math.max(0, Math.min(MAZE_WIDTH - 1, Math.round(worldPos.x / TILE))),
        z: Math.max(0, Math.min(MAZE_HEIGHT - 1, Math.round(worldPos.z / TILE)))
    };
}

// A* 経路探索
function findPath(startGrid, targetGrid) {
    const openSet = []; const closedSet = new Set();
    openSet.push({ x: startGrid.x, z: startGrid.z, g: 0, h: 0, f: 0, parent: null });

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();

        if (current.x === targetGrid.x && current.z === targetGrid.z) {
            const path = []; let temp = current;
            while (temp) { path.push(new THREE.Vector3(temp.x * TILE, 1.5, temp.z * TILE)); temp = temp.parent; }
            return path.reverse();
        }

        closedSet.add(`${current.x},${current.z}`);
        const neighbors = [
            { x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 }
        ];

        for (const n of neighbors) {
            if (n.x < 0 || n.x >= MAZE_WIDTH || n.z < 0 || n.z >= MAZE_HEIGHT) continue;
            if (maze[n.z][n.x] === "#" || closedSet.has(`${n.x},${n.z}`)) continue;

            const gCost = current.g + 1;
            let node = openSet.find(item => item.x === n.x && item.z === n.z);
            if (!node) {
                const hCost = Math.abs(n.x - targetGrid.x) + Math.abs(n.z - targetGrid.z);
                openSet.push({ x: n.x, z: n.z, g: gCost, h: hCost, f: gCost + hCost, parent: current });
            } else if (gCost < node.g) {
                node.g = gCost; node.f = node.g + node.h; node.parent = current;
            }
        }
    }
    return [];
}

function setEnemyPath(enemy, newPath) {
    enemy.path = newPath;
    if (enemy.path.length > 1) {
        const firstPoint = enemy.path[0];
        const distToFirst = Math.hypot(firstPoint.x - enemy.mesh.position.x, firstPoint.z - enemy.mesh.position.z);
        enemy.pathIndex = distToFirst < 0.8 ? 1 : 0;
    } else {
        enemy.pathIndex = 0;
    }
    enemy.repathTimer = 0;
}

// ====================
// 操作ロジック（キーボード ＆ タッチ）
// ====================
const player = { velocityY: 0, onGround: true };
const keys = {};
let yaw = 0, pitch = 0;
let isHiding = false;
let currentLocker = null;

// スマホ入力用変数
let touchMoveDir = { x: 0, z: 0 };
let isTouchDashing = false;
let touchLookId = null;
let touchLookStart = { x: 0, y: 0 };

function triggerInteractAction() {
    if (isHiding) {
        isHiding = false;
        if (currentLocker) camera.position.set(currentLocker.standPos.x, 1.5, currentLocker.standPos.z);
        currentLocker = null;
        showMessage("ロッカーから出た");
    } else {
        for (const locker of lockers) {
            if (camera.position.distanceTo(locker.pos) < 2.2) {
                isHiding = true; currentLocker = locker;
                camera.position.set(locker.pos.x, 1.5, locker.pos.z);
                showMessage("ロッカーに隠れた");
                break;
            }
        }
    }
}

function triggerDecoyAction() {
    if (decoyStock > 0 && !activeDecoy) {
        decoyStock--;
        updateDecoyUI();

        const decoyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8);
        const decoyMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(decoyGeo, decoyMat);
        mesh.position.set(camera.position.x, 0.2, camera.position.z);
        scene.add(mesh);

        activeDecoy = { pos: mesh.position.clone(), timer: 6.0, mesh: mesh };
        showMessage("🔔 デコイを設置！敵を引き寄せている！", 2500);
    } else if (decoyStock === 0) {
        showMessage("デコイを持っていません！", 1500);
    }
}

// PC用キー操作
window.addEventListener("keydown", (e) => { 
    const k = e.key.toLowerCase();
    keys[k] = true; 

    if ((e.key === "Escape" || k === "p") && (gameState === STATES.PLAYING || gameState === STATES.PAUSED)) {
        if (gameState === STATES.PLAYING) pauseGame();
        else if (gameState === STATES.PAUSED) resumeGame();
        return;
    }

    if (gameState !== STATES.PLAYING) return;
    if (k === "e") triggerInteractAction();
    if (k === "f") triggerDecoyAction();
});

window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// PC用マウス移動
document.addEventListener("mousemove", (e) => {
    if (inputMode === "PC" && gameState === STATES.PLAYING && document.pointerLockElement === renderer.domElement) {
        if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
        yaw -= e.movementX * MOUSE_SENSITIVITY;
        pitch -= e.movementY * MOUSE_SENSITIVITY;
        const maxPitch = Math.PI / 2 - 0.1;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
        camera.rotation.set(0, 0, 0); camera.rotation.order = "YXZ";
        camera.rotation.y = yaw; camera.rotation.x = pitch;
    }
});

// ポインターロック解除時の自動ポーズ処理
document.addEventListener("pointerlockchange", () => {
    if (inputMode === "PC" && document.pointerLockElement !== renderer.domElement && gameState === STATES.PLAYING) {
        pauseGame();
    }
});

// スマホ用タッチ操作
window.addEventListener("touchstart", (e) => {
    if (inputMode !== "TOUCH" || gameState !== STATES.PLAYING) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth / 2 && touchLookId === null) {
            touchLookId = touch.identifier;
            touchLookStart = { x: touch.clientX, y: touch.clientY };
        }
    }
});

window.addEventListener("touchmove", (e) => {
    if (inputMode !== "TOUCH" || gameState !== STATES.PLAYING) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchLookId) {
            const dx = touch.clientX - touchLookStart.x;
            const dy = touch.clientY - touchLookStart.y;
            
            yaw -= dx * TOUCH_SENSITIVITY;
            pitch -= dy * TOUCH_SENSITIVITY;
            const maxPitch = Math.PI / 2 - 0.1;
            pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
            
            camera.rotation.set(0, 0, 0); camera.rotation.order = "YXZ";
            camera.rotation.y = yaw; camera.rotation.x = pitch;

            touchLookStart = { x: touch.clientX, y: touch.clientY };
        }
    }
});

const resetTouchLook = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchLookId) touchLookId = null;
    }
};
window.addEventListener("touchend", resetTouchLook);
window.addEventListener("touchcancel", resetTouchLook);

// スマホ用バーチャルジョイスティック
const joystickContainer = document.getElementById("joystick-container");
const joystickKnob = document.getElementById("joystick-knob");
let joystickTouchId = null;

if (joystickContainer) {
    joystickContainer.addEventListener("touchstart", (e) => {
        if (joystickTouchId === null && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            updateJoystick(touch);
        }
    });

    joystickContainer.addEventListener("touchmove", (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                updateJoystick(e.changedTouches[i]);
            }
        }
    });

    const stopJoystick = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joystickTouchId) {
                joystickTouchId = null;
                touchMoveDir = { x: 0, z: 0 };
                joystickKnob.style.transform = `translate(0px, 0px)`;
            }
        }
    };
    joystickContainer.addEventListener("touchend", stopJoystick);
    joystickContainer.addEventListener("touchcancel", stopJoystick);
}

function updateJoystick(touch) {
    const rect = joystickContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2;

    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMoveDir = { x: dx / maxRadius, z: dy / maxRadius };
}

// スマホ用ダッシュボタン（トグル切り替え式）
const touchDashBtn = document.getElementById("touch-dash-btn");
if (touchDashBtn) {
    touchDashBtn.style.top = "auto";
    touchDashBtn.style.bottom = "20%";
    touchDashBtn.style.right = "20px";

    const toggleDash = (e) => {
        e.preventDefault();
        isTouchDashing = !isTouchDashing;
        if (isTouchDashing) {
            touchDashBtn.classList.add("active");
        } else {
            touchDashBtn.classList.remove("active");
        }
    };

    touchDashBtn.addEventListener("touchstart", toggleDash);
}

// ====================
// 敵 AI
// ====================
const enemies = [];
const loader = new GLTFLoader();

function createEnemyObj() {
    const group = new THREE.Group();
    loader.load("./enemy.glb", (gltf) => {
        const model = gltf.scene; model.scale.set(3.0, 3.0, 3.0); group.add(model);
    }, undefined, () => {
        const geometry = new THREE.BoxGeometry(1.2, 2.8, 1.2);
        const material = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
        group.add(new THREE.Mesh(geometry, material));
    });
    scene.add(group);
    return group;
}

for (let i = 0; i < ENEMY_COUNT; i++) {
    enemies.push({ mesh: createEnemyObj(), path: [], pathIndex: 0, repathTimer: 0 });
}

function assignNewRandomPath(enemy) {
    if (openTiles.length === 0) return;
    const currentGrid = worldToGrid(enemy.mesh.position);
    const farTiles = openTiles.filter(t => Math.hypot(t.x - currentGrid.x, t.z - currentGrid.z) > 6);
    const targetTile = farTiles.length > 0 ? farTiles[Math.floor(Math.random() * farTiles.length)] : openTiles[0];

    const path = findPath(currentGrid, { x: targetTile.x, z: targetTile.z });
    setEnemyPath(enemy, path);
}

function initEnemies() {
    const shuffled = [...openTiles].sort(() => Math.random() - 0.5);
    enemies.forEach((e, idx) => {
        const spawnTile = shuffled[idx + 3] || openTiles[0];
        e.mesh.position.copy(spawnTile.pos); e.mesh.position.y = 1.4; e.mesh.visible = true;
        assignNewRandomPath(e);
    });
}

const raycaster = new THREE.Raycaster();
function canSeePlayer(enemyMesh) {
    if (isHiding) return false;
    const origin = enemyMesh.position.clone(); origin.y = 1.5;
    const target = camera.position.clone();
    const direction = target.sub(origin).normalize();
    const distToPlayer = enemyMesh.position.distanceTo(camera.position);

    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObjects(walls);
    return !(intersects.length > 0 && intersects[0].distance < distToPlayer);
}

// ====================
// ゲーム状態遷移関数
// ====================
function resetGame() {
    buildMaze();
    stamina = MAX_STAMINA; isHiding = false; currentLocker = null;
    isTouchDashing = false;
    if (touchDashBtn) touchDashBtn.classList.remove("active");

    camera.position.copy(startPos); camera.position.y = 1.5;
    player.velocityY = 0; player.onGround = true; yaw = 0; pitch = 0;
    camera.rotation.set(0, 0, 0);
    hasKey = false; keyGroup.visible = true;
    initEnemies();
}

function startGame() {
    resetGame(); 
    gameState = STATES.PLAYING;
    if (mainMenu) mainMenu.classList.add("hidden");
    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (clearScreen) clearScreen.classList.add("hidden");

    if (inputMode === "PC") {
        if (touchUI) touchUI.classList.add("hidden");
        renderer.domElement.requestPointerLock();
    } else {
        if (touchUI) touchUI.classList.remove("hidden");
    }
}

function pauseGame() { 
    if (gameState !== STATES.PLAYING) return;
    gameState = STATES.PAUSED; 
    if (pauseMenu) pauseMenu.classList.remove("hidden"); 
    if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
    gameState = STATES.PLAYING;
    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (inputMode === "PC") renderer.domElement.requestPointerLock();
}

function showMainMenu() {
    gameState = STATES.MENU;
    if (document.pointerLockElement) document.exitPointerLock();
    if (mainMenu) mainMenu.classList.remove("hidden");
    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (clearScreen) clearScreen.classList.add("hidden");
    if (touchUI) touchUI.classList.add("hidden");
}

function triggerGameOver() { 
    gameState = STATES.GAMEOVER; 
    if (document.pointerLockElement) document.exitPointerLock(); 
    if (gameOverScreen) gameOverScreen.classList.remove("hidden"); 
}

function triggerClear() { 
    gameState = STATES.CLEAR; 
    if (document.pointerLockElement) document.exitPointerLock(); 
    if (clearScreen) clearScreen.classList.remove("hidden"); 
}

// メインメニューのモード選択＝即ゲームスタート
window.addEventListener("DOMContentLoaded", () => {
    const bindBtn = (id, func) => { const btn = document.getElementById(id); if (btn) btn.addEventListener("click", func); };
    bindBtn("resume-btn", resumeGame); 
    bindBtn("restart-btn", startGame);
    bindBtn("menu-btn", showMainMenu); 
    bindBtn("retry-btn", startGame); 
    bindBtn("gameover-menu-btn", showMainMenu);
    bindBtn("clear-retry-btn", startGame); 
    bindBtn("clear-menu-btn", showMainMenu);

    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.style.display = "none";

    const modePcBtn = document.getElementById("mode-pc-btn");
    const modeTouchBtn = document.getElementById("mode-touch-btn");

    if (modePcBtn) {
        modePcBtn.addEventListener("click", () => {
            inputMode = "PC";
            startGame();
        });
    }

    if (modeTouchBtn) {
        modeTouchBtn.addEventListener("click", () => {
            inputMode = "TOUCH";
            startGame();
        });
    }
});

// ====================
// フレーム更新処理
// ====================
function updateEnemies(delta) {
    if (gameState !== STATES.PLAYING) return;

    if (activeDecoy) {
        activeDecoy.timer -= delta;
        if (activeDecoy.timer <= 0) {
            scene.remove(activeDecoy.mesh);
            activeDecoy = null;
            showMessage("デコイの効果が切れた！", 1500);
        }
    }

    if (enemyVanishTimer > 0) {
        enemyVanishTimer -= delta;
        enemies.forEach(e => e.mesh.visible = false);
        if (enemyVanishTimer <= 0) {
            enemyVanishTimer = 0; enemies.forEach(e => e.mesh.visible = true); showMessage("敵が再出現した！", 1500);
        } else {
            showMessage(`敵消滅中！ (残り ${enemyVanishTimer.toFixed(1)}秒)`, 100);
            return;
        }
    }

    for (const e of enemies) {
        const distToPlayer = Math.hypot(camera.position.x - e.mesh.position.x, camera.position.z - e.mesh.position.z);
        if (!isHiding && distToPlayer < 1.3) { triggerGameOver(); return; }

        let speed = ENEMY_SPEED * 0.55;
        let targetX = null, targetZ = null;

        if (activeDecoy) {
            speed = ENEMY_SPEED;
            e.repathTimer += delta;
            if (e.repathTimer > 0.3) {
                const p = findPath(worldToGrid(e.mesh.position), worldToGrid(activeDecoy.pos));
                setEnemyPath(e, p);
            }
        } 
        else if (canSeePlayer(e.mesh)) {
            // 視界に入っている時は直接プレイヤーを直線追尾（ぐるぐる回転を防止）
            speed = ENEMY_SPEED;
            targetX = camera.position.x;
            targetZ = camera.position.z;
            e.path = []; // パスをクリアして直接移動モードにする
        } else {
            // 見えない時は巡回・経路探索
            if (!e.path || e.pathIndex >= e.path.length) assignNewRandomPath(e);
        }

        // 移動処理
        if (targetX !== null && targetZ !== null) {
            const dirX = targetX - e.mesh.position.x;
            const dirZ = targetZ - e.mesh.position.z;
            const dist = Math.hypot(dirX, dirZ);

            if (dist > 0.1) {
                e.mesh.position.x += (dirX / dist) * speed * delta;
                e.mesh.position.z += (dirZ / dist) * speed * delta;
                
                const targetAngle = Math.atan2(dirX, dirZ);
                let diff = targetAngle - e.mesh.rotation.y;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                e.mesh.rotation.y += diff * Math.min(1.0, delta * 12);
            }
        } 
        else if (e.path && e.pathIndex < e.path.length) {
            const waypoint = e.path[e.pathIndex];
            const dirX = waypoint.x - e.mesh.position.x;
            const dirZ = waypoint.z - e.mesh.position.z;
            const dist = Math.hypot(dirX, dirZ);

            if (dist < 0.6) { 
                e.pathIndex++; 
            } else {
                e.mesh.position.x += (dirX / dist) * speed * delta;
                e.mesh.position.z += (dirZ / dist) * speed * delta;
                
                const targetAngle = Math.atan2(dirX, dirZ);
                let diff = targetAngle - e.mesh.rotation.y;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                e.mesh.rotation.y += diff * Math.min(1.0, delta * 12);
            }
        }
    }
}

function updatePlayer(delta) {
    if (gameState !== STATES.PLAYING) return;

    if (isHiding) {
        setInteractText("ロッカーから出る");
        if (currentLocker) camera.position.set(currentLocker.pos.x, 1.5, currentLocker.pos.z);
        return;
    }

    let nearLocker = lockers.find(l => camera.position.distanceTo(l.pos) < 2.2);
    setInteractText(nearLocker ? "ロッカーに隠れる" : null);

    const isMovingPC = keys["w"] || keys["s"] || keys["a"] || keys["d"];
    const isMovingTouch = Math.hypot(touchMoveDir.x, touchMoveDir.z) > 0.1;
    const isMoving = isMovingPC || isMovingTouch;

    let isDashing = (keys["shift"] || isTouchDashing) && isMoving && stamina > 0;

    if (isDashing) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
        if (stamina === 0) {
            isDashing = false;
            isTouchDashing = false;
            if (touchDashBtn) touchDashBtn.classList.remove("active");
        }
    } else {
        stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER * delta);
    }

    staminaBar.style.width = `${(stamina / MAX_STAMINA) * 100}%`;
    staminaBar.style.backgroundColor = stamina < 20 ? "#ff3333" : "#00ff88";

    let speed = isDashing ? DASH_SPEED : MOVE_SPEED;
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const moveStep = speed * delta;
    let dx = 0, dz = 0;

    if (inputMode === "PC") {
        if (keys["w"]) { dx += forwardX * moveStep; dz += forwardZ * moveStep; }
        if (keys["s"]) { dx -= forwardX * moveStep; dz -= forwardZ * moveStep; }
        if (keys["a"]) { dx -= rightX * moveStep; dz -= rightZ * moveStep; }
        if (keys["d"]) { dx += rightX * moveStep; dz += rightZ * moveStep; }
    } else {
        const moveForward = -touchMoveDir.z;
        const moveRight = touchMoveDir.x;
        dx += (forwardX * moveForward + rightX * moveRight) * moveStep;
        dz += (forwardZ * moveForward + rightZ * moveRight) * moveStep;
    }

    if (!hitWall(camera.position.x + dx, camera.position.z, PLAYER_RADIUS)) camera.position.x += dx;
    if (!hitWall(camera.position.x, camera.position.z + dz, PLAYER_RADIUS)) camera.position.z += dz;
    camera.position.y = 1.5;

    for (const item of vanishItems) {
        if (item.active && camera.position.distanceTo(item.pos) < 1.2) {
            item.active = false; item.mesh.visible = false;
            enemyVanishTimer = 5.0; showMessage("閃光弾を取得！敵が5秒間消滅！", 2000);
        }
    }

    for (const item of decoyPickups) {
        if (item.active && camera.position.distanceTo(item.pos) < 1.2) {
            item.active = false; item.mesh.visible = false;
            decoyStock++; updateDecoyUI();
            showMessage("🔔 デコイを取得！(ボタンで設置)", 2000);
        }
    }

    if (!hasKey && Math.hypot(camera.position.x - keyPos.x, camera.position.z - keyPos.z) < 1.2) {
        hasKey = true; keyGroup.visible = false; showMessage("鍵を手に入れた！ゴールに向かえ！");
    }

    if (Math.hypot(camera.position.x - goalPos.x, camera.position.z - goalPos.z) < 1.5) {
        if (hasKey) triggerClear(); else showMessage("鍵がないと脱出できない！");
    }
}

// ミニマップ描画
function drawMinimap() {
    const mapW = minimapCanvas.width, mapH = minimapCanvas.height;
    const scaleX = mapW / (MAZE_WIDTH * TILE), scaleZ = mapH / (MAZE_HEIGHT * TILE);

    minimapCtx.clearRect(0, 0, mapW, mapH);
    minimapCtx.textAlign = "center"; minimapCtx.textBaseline = "middle"; minimapCtx.font = "11px sans-serif";

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z] && maze[z][x] === "#") {
                minimapCtx.fillStyle = "#555555";
                minimapCtx.fillRect(x * TILE * scaleX, z * TILE * scaleZ, TILE * scaleX, TILE * scaleZ);
            }
        }
    }

    for (const item of vanishItems) {
        if (item.active) { minimapCtx.fillStyle = "#00d2ff"; minimapCtx.fillText("★", item.pos.x * scaleX, item.pos.z * scaleZ); }
    }

    for (const item of decoyPickups) {
        if (item.active) { minimapCtx.fillStyle = "#ffff00"; minimapCtx.fillText("🔔", item.pos.x * scaleX, item.pos.z * scaleZ); }
    }

    if (activeDecoy) {
        minimapCtx.fillStyle = "#ffaa00";
        minimapCtx.beginPath();
        minimapCtx.arc(activeDecoy.pos.x * scaleX, activeDecoy.pos.z * scaleZ, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    for (const l of lockers) {
        minimapCtx.fillStyle = "#0088ff";
        minimapCtx.fillRect(l.pos.x * scaleX - 3, l.pos.z * scaleZ - 3, 5, 5);
    }

    minimapCtx.fillStyle = "#00ff88";
    minimapCtx.fillRect(goalPos.x * scaleX - 3, goalPos.z * scaleZ - 3, 7, 7);

    if (!hasKey) { minimapCtx.fillText("🔑", keyPos.x * scaleX, keyPos.z * scaleZ); }

    if (enemyVanishTimer <= 0) {
        minimapCtx.fillStyle = "#ff0000";
        for (const e of enemies) {
            minimapCtx.beginPath(); minimapCtx.arc(e.mesh.position.x * scaleX, e.mesh.position.z * scaleZ, 3.5, 0, Math.PI * 2); minimapCtx.fill();
        }
    }

    const px = camera.position.x * scaleX, pz = camera.position.z * scaleZ;
    minimapCtx.fillStyle = isHiding ? "#88ff88" : "#00ff00";
    minimapCtx.beginPath(); minimapCtx.arc(px, pz, 3.5, 0, Math.PI * 2); minimapCtx.fill();

    minimapCtx.strokeStyle = isHiding ? "#88ff88" : "#00ff00";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath(); minimapCtx.moveTo(px, pz);
    minimapCtx.lineTo(px - Math.sin(yaw) * 7, pz - Math.cos(yaw) * 7); minimapCtx.stroke();
    minimapCtx.lineWidth = 1;
}

// メインループ
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (!hasKey) {
        keyGroup.rotation.y += delta * 2;
        keyGroup.position.y = keyPos.y + Math.sin(clock.getElapsedTime() * 3) * 0.1;
    }

    vanishItems.forEach(item => { if (item.active) item.mesh.rotation.y += delta * 2; });
    decoyPickups.forEach(item => { if (item.active) item.mesh.rotation.y += delta * 2; });

    updatePlayer(delta);
    updateEnemies(delta);
    drawMinimap();

    renderer.render(scene, camera);
}

buildMaze();
animate();
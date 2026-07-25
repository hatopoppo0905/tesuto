import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

// ====================
// 設定値（カスタマイズ用）
// ====================
const MOUSE_SENSITIVITY = 0.0015; 
const MAX_MOUSE_DELTA = 30;       
const MOVE_SPEED = 6.0;          
const DASH_SPEED = 9.5;          
const ENEMY_SPEED = 9.5;         
const ENEMY_COUNT = 3;           
const LOCKER_COUNT = 4;          // 配置するロッカーの数

const JUMP_FORCE = 8.0;          
const GRAVITY = 25.0;            
const PLAYER_RADIUS = 0.8;       

// スタミナ設定
const MAX_STAMINA = 100;
let stamina = MAX_STAMINA;
const STAMINA_DRAIN = 35;        
const STAMINA_RECOVER = 20;      

// 迷路サイズ
const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 21;
const TILE = 4;

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

// 隠れるUI表示用メッセージ
const interactUI = document.createElement("div");
interactUI.style.position = "absolute";
interactUI.style.bottom = "20%";
interactUI.style.left = "50%";
interactUI.style.transform = "translateX(-50%)";
interactUI.style.color = "#ffffff";
interactUI.style.fontSize = "20px";
interactUI.style.fontWeight = "bold";
interactUI.style.textShadow = "2px 2px 4px #000000";
interactUI.style.zIndex = "10";
interactUI.classList.add("hidden");
document.body.appendChild(interactUI);

function setInteractText(text) {
    if (!text) {
        interactUI.classList.add("hidden");
    } else {
        interactUI.innerText = text;
        interactUI.classList.remove("hidden");
    }
}

// ====================
// UI作成（スタミナゲージ）
// ====================
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
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ====================
// ミニマップUI
// ====================
const minimapCanvas = document.createElement("canvas");
minimapCanvas.width = 150;
minimapCanvas.height = 150;
minimapCanvas.style.position = "absolute";
minimapCanvas.style.top = "10px";
minimapCanvas.style.right = "10px";
minimapCanvas.style.border = "2px solid #ffffff";
minimapCanvas.style.borderRadius = "8px";
minimapCanvas.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
minimapCanvas.style.zIndex = "10";
document.body.appendChild(minimapCanvas);

const minimapCtx = minimapCanvas.getContext("2d");

// ====================
// ライト & 床
// ====================
scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(20, 30, 20);
scene.add(sun);

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x303030 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ====================
// 迷路 & ロッカーの自動生成
// ====================
let maze = [];
let walls = [];
let wallMeshes = [];
let openTiles = [];
let lockers = [];

let startPos = new THREE.Vector3();
let goalPos = new THREE.Vector3();
let keyPos = new THREE.Vector3();

const keyGroup = new THREE.Group();
const keyMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.15, 16, 32),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2, emissive: 0xaa8800 })
);
keyGroup.add(keyMesh);
scene.add(keyGroup);

const goalMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 4, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.4 })
);
scene.add(goalMesh);

function generateMazeData(w, h) {
    const grid = Array.from({ length: h }, () => Array(w).fill("#"));

    function carve(x, z) {
        const dirs = [
            [0, -2], [0, 2], [-2, 0], [2, 0]
        ].sort(() => Math.random() - 0.5);

        for (const [dx, dz] of dirs) {
            const nx = x + dx;
            const nz = z + dz;

            if (nx > 0 && nx < w - 1 && nz > 0 && nz < h - 1 && grid[nz][nx] === "#") {
                grid[z + dz / 2][x + dx / 2] = " ";
                grid[nz][nx] = " ";
                carve(nx, nz);
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
    wallMeshes = [];
    walls = [];
    openTiles = [];
    lockers = [];

    maze = generateMazeData(MAZE_WIDTH, MAZE_HEIGHT);

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z][x] === " ") {
                openTiles.push({ x, z, pos: new THREE.Vector3(x * TILE, 2.0, z * TILE) });
            }
        }
    }

    const shuffled = [...openTiles].sort(() => Math.random() - 0.5);
    startPos.copy(shuffled[0].pos);
    goalPos.copy(shuffled[1].pos);
    keyPos.copy(shuffled[2].pos);

    keyGroup.position.set(keyPos.x, 1.5, keyPos.z);
    goalMesh.position.set(goalPos.x, 2.0, goalPos.z);

    const wallGeo = new THREE.BoxGeometry(TILE, 4, TILE);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z][x] === "#") {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x * TILE, 2, z * TILE);
                scene.add(wall);
                walls.push(wall);
                wallMeshes.push(wall);
            }
        }
    }

    // ★ロッカー（壁際に寄せて配置）
    const lockerGeo = new THREE.BoxGeometry(1.6, 3.8, 1.2);
    const lockerMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, metalness: 0.5, roughness: 0.5 });

    // 壁に隣接しているマスを優先抽出
    const wallAdjacentTiles = shuffled.slice(6).filter(tile => {
        const { x, z } = tile;
        return (maze[z-1] && maze[z-1][x] === "#") ||
               (maze[z+1] && maze[z+1][x] === "#") ||
               (maze[z][x-1] === "#") ||
               (maze[z][x+1] === "#");
    });

    for (let i = 0; i < LOCKER_COUNT; i++) {
        const tile = wallAdjacentTiles[i] || shuffled[i + 6] || openTiles[0];
        const lockerMesh = new THREE.Mesh(lockerGeo, lockerMat);
        
        let offsetX = 0;
        let offsetZ = 0;
        let rotationY = 0;
        const offsetDist = 1.2; // 壁に寄せる距離

        // どの方向に壁があるかチェックして壁側に寄せる
        if (maze[tile.z - 1] && maze[tile.z - 1][tile.x] === "#") {
            offsetZ = -offsetDist; // 奥の壁
            rotationY = 0;
        } else if (maze[tile.z + 1] && maze[tile.z + 1][tile.x] === "#") {
            offsetZ = offsetDist;  // 手前の壁
            rotationY = Math.PI;
        } else if (maze[tile.z][tile.x - 1] === "#") {
            offsetX = -offsetDist; // 左の壁
            rotationY = -Math.PI / 2;
        } else if (maze[tile.z][tile.x + 1] === "#") {
            offsetX = offsetDist;  // 右の壁
            rotationY = Math.PI / 2;
        }

        const lockerPos = new THREE.Vector3(tile.pos.x + offsetX, 1.9, tile.pos.z + offsetZ);
        lockerMesh.position.copy(lockerPos);
        lockerMesh.rotation.y = rotationY;

        scene.add(lockerMesh);

        lockers.push({
            mesh: lockerMesh,
            pos: lockerPos,
            standPos: tile.pos.clone() // ロッカーから出た時に立つ位置
        });
    }
}

function hitWall(x, z, radius = PLAYER_RADIUS) {
    const wallHalfSize = TILE / 2;
    for (const wall of walls) {
        const minX = wall.position.x - wallHalfSize - radius;
        const maxX = wall.position.x + wallHalfSize + radius;
        const minZ = wall.position.z - wallHalfSize - radius;
        const maxZ = wall.position.z + wallHalfSize + radius;

        if (x > minX && x < maxX && z > minZ && z < maxZ) return true;
    }
    return false;
}

function worldToGrid(worldPos) {
    const gx = Math.round(worldPos.x / TILE);
    const gz = Math.round(worldPos.z / TILE);
    return {
        x: Math.max(0, Math.min(MAZE_WIDTH - 1, gx)),
        z: Math.max(0, Math.min(MAZE_HEIGHT - 1, gz))
    };
}

// ====================
// A* (経路探索) アルゴリズム
// ====================
function findPath(startGrid, targetGrid) {
    const openSet = [];
    const closedSet = new Set();
    const startNode = { x: startGrid.x, z: startGrid.z, g: 0, h: 0, f: 0, parent: null };

    openSet.push(startNode);

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();

        if (current.x === targetGrid.x && current.z === targetGrid.z) {
            const path = [];
            let temp = current;
            while (temp) {
                path.push(new THREE.Vector3(temp.x * TILE, 2.0, temp.z * TILE));
                temp = temp.parent;
            }
            return path.reverse();
        }

        closedSet.add(`${current.x},${current.z}`);

        const neighbors = [
            { x: current.x + 1, z: current.z },
            { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 },
            { x: current.x, z: current.z - 1 }
        ];

        for (const neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= MAZE_WIDTH || neighbor.z < 0 || neighbor.z >= MAZE_HEIGHT) continue;
            if (maze[neighbor.z][neighbor.x] === "#") continue;
            if (closedSet.has(`${neighbor.x},${neighbor.z}`)) continue;

            const gCost = current.g + 1;
            let neighborNode = openSet.find(n => n.x === neighbor.x && n.z === neighbor.z);

            if (!neighborNode) {
                const hCost = Math.abs(neighbor.x - targetGrid.x) + Math.abs(neighbor.z - targetGrid.z);
                neighborNode = {
                    x: neighbor.x,
                    z: neighbor.z,
                    g: gCost,
                    h: hCost,
                    f: gCost + hCost,
                    parent: current
                };
                openSet.push(neighborNode);
            } else if (gCost < neighborNode.g) {
                neighborNode.g = gCost;
                neighborNode.f = neighborNode.g + neighborNode.h;
                neighborNode.parent = current;
            }
        }
    }
    return [];
}

// ====================
// プレイヤー & 入力設定
// ====================
const player = { velocityY: 0, onGround: true };
const keys = {};
let yaw = 0, pitch = 0;
let isHiding = false;
let currentLocker = null;

window.addEventListener("keydown", (e) => { 
    const k = e.key.toLowerCase();
    keys[k] = true; 

    if (k === "e" && gameState === STATES.PLAYING) {
        if (isHiding) {
            isHiding = false;
            if (currentLocker) {
                camera.position.set(currentLocker.standPos.x, 2.0, currentLocker.standPos.z);
            }
            currentLocker = null;
            showMessage("ロッカーから出た");
        } else {
            for (const locker of lockers) {
                const dist = camera.position.distanceTo(locker.pos);
                if (dist < 2.5) {
                    isHiding = true;
                    currentLocker = locker;
                    camera.position.set(locker.pos.x, 2.0, locker.pos.z);
                    showMessage("ロッカーに隠れた");
                    break;
                }
            }
        }
    }
});

window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

document.addEventListener("mousemove", (e) => {
    if (gameState === STATES.PLAYING && document.pointerLockElement === renderer.domElement) {
        const clampedX = Math.max(-MAX_MOUSE_DELTA, Math.min(MAX_MOUSE_DELTA, e.movementX));
        const clampedY = Math.max(-MAX_MOUSE_DELTA, Math.min(MAX_MOUSE_DELTA, e.movementY));

        yaw -= clampedX * MOUSE_SENSITIVITY;
        pitch -= clampedY * MOUSE_SENSITIVITY;

        if (isHiding) {
            pitch = Math.max(-0.5, Math.min(0.5, pitch));
        } else {
            pitch = Math.max(-1.4, Math.min(1.4, pitch));
        }

        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
    }
});

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== renderer.domElement && gameState === STATES.PLAYING) {
        pauseGame();
    }
});

// ====================
// 敵（A*ナビゲーションAI）
// ====================
const enemies = [];
const loader = new GLTFLoader();

function createEnemyObj() {
    const group = new THREE.Group();
    loader.load(
        "./enemy.glb",
        (gltf) => {
            const model = gltf.scene;
            model.scale.set(5, 5, 5);
            group.add(model);
        },
        undefined,
        () => {
            const geometry = new THREE.BoxGeometry(3, 5, 3);
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
        }
    );
    scene.add(group);
    return group;
}

for (let i = 0; i < ENEMY_COUNT; i++) {
    enemies.push({
        mesh: createEnemyObj(),
        path: [],
        pathIndex: 0,
        repathTimer: 0
    });
}

function assignNewRandomPath(enemy) {
    if (openTiles.length === 0) return;
    const currentGrid = worldToGrid(enemy.mesh.position);
    
    const farTiles = openTiles.filter(t => Math.hypot(t.x - currentGrid.x, t.z - currentGrid.z) > 6);
    const targetTile = farTiles.length > 0 
        ? farTiles[Math.floor(Math.random() * farTiles.length)]
        : openTiles[Math.floor(Math.random() * openTiles.length)];

    enemy.path = findPath(currentGrid, { x: targetTile.x, z: targetTile.z });
    enemy.pathIndex = 0;
    enemy.repathTimer = 0;
}

function initEnemies() {
    const shuffled = [...openTiles].sort(() => Math.random() - 0.5);
    enemies.forEach((e, idx) => {
        const spawnTile = shuffled[idx + 3] || openTiles[0];
        e.mesh.position.copy(spawnTile.pos);
        e.mesh.position.y = 2.0;
        assignNewRandomPath(e);
    });
}

const raycaster = new THREE.Raycaster();

function canSeePlayer(enemyMesh) {
    if (isHiding) return false;

    const origin = enemyMesh.position.clone();
    origin.y = 2.0;

    const target = camera.position.clone();
    const direction = target.sub(origin).normalize();
    const distToPlayer = enemyMesh.position.distanceTo(camera.position);

    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObjects(walls);

    if (intersects.length > 0 && intersects[0].distance < distToPlayer) {
        return false;
    }
    return true;
}

// ====================
// ゲーム状態関数
// ====================
function resetGame() {
    buildMaze();
    stamina = MAX_STAMINA;
    isHiding = false;
    currentLocker = null;

    camera.position.copy(startPos);
    player.velocityY = 0;
    player.onGround = true;
    yaw = 0;
    pitch = 0;
    camera.rotation.set(0, 0, 0);

    hasKey = false;
    keyGroup.visible = true;

    initEnemies();
}

function startGame() {
    resetGame();
    gameState = STATES.PLAYING;
    if (mainMenu) mainMenu.classList.add("hidden");
    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (clearScreen) clearScreen.classList.add("hidden");
    
    setTimeout(() => {
        renderer.domElement.requestPointerLock();
    }, 100);
}

function pauseGame() {
    gameState = STATES.PAUSED;
    if (pauseMenu) pauseMenu.classList.remove("hidden");
}

function resumeGame() {
    gameState = STATES.PLAYING;
    if (pauseMenu) pauseMenu.classList.add("hidden");
    renderer.domElement.requestPointerLock();
}

function showMainMenu() {
    gameState = STATES.MENU;
    if (document.pointerLockElement) document.exitPointerLock();
    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (clearScreen) clearScreen.classList.add("hidden");
    if (mainMenu) mainMenu.classList.remove("hidden");
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

// ボタン設定
window.addEventListener("DOMContentLoaded", () => {
    const bindBtn = (id, func) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", func);
    };

    bindBtn("start-btn", startGame);
    bindBtn("resume-btn", resumeGame);
    bindBtn("restart-btn", startGame);
    bindBtn("menu-btn", showMainMenu);
    bindBtn("retry-btn", startGame);
    bindBtn("gameover-menu-btn", showMainMenu);
    bindBtn("clear-retry-btn", startGame);
    bindBtn("clear-menu-btn", showMainMenu);
});

// ====================
// 敵 & プレイヤー更新
// ====================
function updateEnemies(delta) {
    if (gameState !== STATES.PLAYING) return;

    for (const e of enemies) {
        const distToPlayer = Math.hypot(camera.position.x - e.mesh.position.x, camera.position.z - e.mesh.position.z);

        if (!isHiding && distToPlayer < 1.8) {
            triggerGameOver();
            return;
        }

        let speed = ENEMY_SPEED * 0.55;

        if (canSeePlayer(e.mesh)) {
            speed = ENEMY_SPEED;
            e.repathTimer += delta;
            if (e.repathTimer > 0.3) {
                const currentGrid = worldToGrid(e.mesh.position);
                const playerGrid = worldToGrid(camera.position);
                e.path = findPath(currentGrid, playerGrid);
                e.pathIndex = 0;
                e.repathTimer = 0;
            }
        } else {
            if (!e.path || e.pathIndex >= e.path.length) {
                assignNewRandomPath(e);
            }
        }

        if (e.path && e.pathIndex < e.path.length) {
            const waypoint = e.path[e.pathIndex];
            const dirX = waypoint.x - e.mesh.position.x;
            const dirZ = waypoint.z - e.mesh.position.z;
            const distToWaypoint = Math.hypot(dirX, dirZ);

            if (distToWaypoint < 0.6) {
                e.pathIndex++;
            } else {
                const normX = dirX / distToWaypoint;
                const normZ = dirZ / distToWaypoint;

                e.mesh.position.x += normX * speed * delta;
                e.mesh.position.z += normZ * speed * delta;
                e.mesh.rotation.y = Math.atan2(dirX, dirZ);
            }
        }
    }
}

function updatePlayer(delta) {
    if (gameState !== STATES.PLAYING) return;

    let nearLocker = null;
    if (isHiding) {
        setInteractText("[E] 出る");
    } else {
        for (const locker of lockers) {
            if (camera.position.distanceTo(locker.pos) < 2.5) {
                nearLocker = locker;
                break;
            }
        }
        if (nearLocker) {
            setInteractText("[E] 隠れる");
        } else {
            setInteractText(null);
        }
    }

    if (isHiding) {
        if (currentLocker) {
            camera.position.set(currentLocker.pos.x, 2.0, currentLocker.pos.z);
        }
        return;
    }

    const isMoving = keys["w"] || keys["s"] || keys["a"] || keys["d"];
    let isDashing = keys["shift"] && isMoving && stamina > 0;

    if (isDashing) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
        if (stamina === 0) isDashing = false;
    } else {
        stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER * delta);
    }

    staminaBar.style.width = `${(stamina / MAX_STAMINA) * 100}%`;
    staminaBar.style.backgroundColor = stamina < 20 ? "#ff3333" : "#00ff88";

    let speed = isDashing ? DASH_SPEED : MOVE_SPEED;
    
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const moveStep = speed * delta;
    let dx = 0, dz = 0;

    if (keys["w"]) { dx += forwardX * moveStep; dz += forwardZ * moveStep; }
    if (keys["s"]) { dx -= forwardX * moveStep; dz -= forwardZ * moveStep; }
    if (keys["a"]) { dx -= rightX * moveStep; dz -= rightZ * moveStep; }
    if (keys["d"]) { dx += rightX * moveStep; dz += rightZ * moveStep; }

    const targetX = camera.position.x + dx;
    if (!hitWall(targetX, camera.position.z, PLAYER_RADIUS)) camera.position.x = targetX;

    const targetZ = camera.position.z + dz;
    if (!hitWall(camera.position.x, targetZ, PLAYER_RADIUS)) camera.position.z = targetZ;

    if (keys[" "] && player.onGround) {
        player.velocityY = JUMP_FORCE;
        player.onGround = false;
    }

    player.velocityY -= GRAVITY * delta;
    camera.position.y += player.velocityY * delta;

    if (camera.position.y < 2) {
        camera.position.y = 2;
        player.velocityY = 0;
        player.onGround = true;
    }

    if (!hasKey) {
        const distToKey = Math.hypot(camera.position.x - keyPos.x, camera.position.z - keyPos.z);
        if (distToKey < 1.5) {
            hasKey = true;
            keyGroup.visible = false;
            showMessage("鍵を手に入れた！ゴールに向かえ！");
        }
    }

    const distToGoal = Math.hypot(camera.position.x - goalPos.x, camera.position.z - goalPos.z);
    if (distToGoal < 1.8) {
        if (hasKey) {
            triggerClear();
        } else {
            showMessage("鍵がないと脱出できない！");
        }
    }
}

// ====================
// ミニマップ描画
// ====================
function drawMinimap() {
    const mapW = minimapCanvas.width;
    const mapH = minimapCanvas.height;
    const scaleX = mapW / (MAZE_WIDTH * TILE);
    const scaleZ = mapH / (MAZE_HEIGHT * TILE);

    minimapCtx.clearRect(0, 0, mapW, mapH);

    // 壁（グレー）
    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z] && maze[z][x] === "#") {
                minimapCtx.fillStyle = "#555555";
                minimapCtx.fillRect(x * TILE * scaleX, z * TILE * scaleZ, TILE * scaleX, TILE * scaleZ);
            }
        }
    }

    // ロッカー（青色のアイコン表示）
    for (const locker of lockers) {
        const lx = locker.pos.x * scaleX;
        const lz = locker.pos.z * scaleZ;
        
        minimapCtx.fillStyle = "#0088ff";
        minimapCtx.fillRect(lx - 3, lz - 3, 6, 6);
        minimapCtx.strokeStyle = "#ffffff";
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(lx - 3, lz - 3, 6, 6);
    }

    // ゴール（緑色）
    minimapCtx.fillStyle = "#00ff88";
    minimapCtx.fillRect(goalPos.x * scaleX - 3, goalPos.z * scaleZ - 3, 6, 6);

    // 鍵（シアンの丸）
    if (!hasKey) {
        minimapCtx.fillStyle = "#00ffff";
        minimapCtx.beginPath();
        minimapCtx.arc(keyPos.x * scaleX, keyPos.z * scaleZ, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // 敵（赤色の丸）
    minimapCtx.fillStyle = "#ff0000";
    for (const e of enemies) {
        minimapCtx.beginPath();
        minimapCtx.arc(e.mesh.position.x * scaleX, e.mesh.position.z * scaleZ, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // プレイヤー（緑色の丸）
    const px = camera.position.x * scaleX;
    const pz = camera.position.z * scaleZ;

    minimapCtx.fillStyle = isHiding ? "#88ff88" : "#00ff00";
    minimapCtx.beginPath();
    minimapCtx.arc(px, pz, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = isHiding ? "#88ff88" : "#00ff00";
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, pz);
    minimapCtx.lineTo(px - Math.sin(yaw) * 12, pz - Math.cos(yaw) * 12);
    minimapCtx.stroke();
}

// ====================
// メインループ
// ====================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    if (!hasKey) {
        keyGroup.rotation.y += delta * 2;
        keyGroup.position.y = keyPos.y + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    }

    updatePlayer(delta);
    updateEnemies(delta);
    drawMinimap();

    renderer.render(scene, camera);
}

buildMaze();
animate();
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

// ====================
// 設定値
// ====================
const MOUSE_SENSITIVITY = 0.0025; 
const TOUCH_SENSITIVITY = 0.005;

const MOVE_SPEED = 5.0;          
const DASH_SPEED = 8.5;          
const ENEMY_SPEED = 5.5;         
const ENEMY_COUNT = 3;           
const LOCKER_COUNT = 5;          
const PUZZLE_COUNT = 5;          
const REQUIRED_SOLVE_COUNT = 5; // ★ クリアに必要な謎解き数を5に変更
const TICKET_COUNT = 3;         

const PLAYER_RADIUS = 0.6;       
const ENEMY_DETECTION_RANGE = 9.0; 

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

// 管理変数
let decoyStock = 0;
let hintTickets = 0; 
let activeDecoy = null;

// 謎解き管理
let puzzles = [];
let solvedPuzzleCount = 0;
let currentPuzzleTarget = null; 

// ★ 20パターンの問題プール
const ALL_PUZZLE_QUESTIONS = [
    {
        question: "【謎解き】\n「赤」「青」「黄」の3つのボタンがある。\n『青の隣は赤ではない。赤色は一番右。』\n一番左の色は？",
        options: ["赤", "青", "黄"],
        answer: 1, 
        hint: "提示条件：[ ? , ? , 赤 ]。青と赤が隣り合わない位置を考えよう。"
    },
    {
        question: "【謎解き】\n『1, 2, 4, 7, 11, ?』\n? に入る数字はどれ？",
        options: ["15", "16", "18"],
        answer: 1, 
        hint: "増えている数字に注目！ (+1, +2, +3, +4, +5...)"
    },
    {
        question: "【謎解き】\n『暗号：3 1 2 4』\nあ＝1, い＝2, う＝3, え＝4 とするとき、解ける言葉は？",
        options: ["あいうえ", "うあいえ", "えいあう"],
        answer: 1, 
        hint: "数字をそのまま平仮名に置き換えて読んでみよう。"
    },
    {
        question: "【謎解き】\n『たぬき』から『ぬ』をとると何になる？",
        options: ["たき", "たぬ", "ぬき"],
        answer: 0, 
        hint: "「た・ぬ・き」の文字から「ぬ」を取り除いてみよう。"
    },
    {
        question: "【謎解き】\n『南を向いている人が右を向いた。今向いている方角は？』",
        options: ["東", "西", "北"],
        answer: 1, 
        hint: "南を基準にして、時計回りに90度回るとどっち？"
    },
    {
        question: "【謎解き】\n『1年の中で31日がない月はいくつある？』",
        options: ["1個", "5個", "7個"],
        answer: 1, 
        hint: "31日まである月は 1,3,5,7,8,10,12月（7つ）です。"
    },
    {
        question: "【謎解き】\n『2, 4, 8, 16, 32, ?』\n? に入る数字はどれ？",
        options: ["48", "64", "128"],
        answer: 1, 
        hint: "前の数字を毎回2倍していこう。"
    },
    {
        question: "【謎解き】\n『パンはパンでも食べられないパンは？』",
        options: ["食パン", "フライパン", "メロンパン"],
        answer: 1, 
        hint: "料理の時に使う道具の名前だよ。"
    },
    {
        question: "【謎解き】\n『上を向いても下を向き、右を向いても左を向くものは？』",
        options: ["影", "鏡の中の自分", "時計の針"],
        answer: 1, 
        hint: "自分と向き合ったとき、左右はどう映るかな？"
    },
    {
        question: "【謎解き】\n『1kmの鉄と、1kmの綿。重いのはどっち？』",
        options: ["鉄", "綿", "同じ"],
        answer: 2, 
        hint: "重さではなく「長さ」の単位(km)で比べられているよ。"
    },
    {
        question: "【謎解き】\n『ある部屋にろうそくが10本点いている。風で2本消えた。最終的に残ったろうそくは何本？』",
        options: ["0本", "2本", "8本"],
        answer: 1, 
        hint: "消えなかった8本は燃え尽きてなくなってしまいます。"
    },
    {
        question: "【謎解き】\n『「お父さん」の父親の息子は誰？（※自分は一人っ子とする）』",
        options: ["おじさん", "お父さん", "自分"],
        answer: 1, 
        hint: "お父さんの父親＝おじいちゃん。おじいちゃんの息子で一人っ子なら？"
    },
    {
        question: "【謎解き】\n『10人の中で「2人」が抜けた。残りは何人？』",
        options: ["8人", "10人", "12人"],
        answer: 0, 
        hint: "シンプルに引き算をしてみよう。10 - 2 = ?"
    },
    {
        question: "【謎解き】\n『「春・夏・秋・冬」のうち、文字数が一番長いのはどれ？』",
        options: ["春", "夏", "全て同じ"],
        answer: 2, 
        hint: "平仮名で書くと「はる」「なつ」「あき」「ふゆ」。"
    },
    {
        question: "【謎解き】\n『「0, 1, 1, 2, 3, 5, 8, ?」』\n? に入る数字はどれ？",
        options: ["11", "12", "13"],
        answer: 2, 
        hint: "前の2つの数字を足すと次の数字になるよ。(5 + 8 = ?)"
    },
    {
        question: "【謎解き】\n『時計の針が「12時15分」を指している時、長針と短針のなす角度は？』",
        options: ["90度", "82.5度", "7.5度"],
        answer: 1, 
        hint: "短針も15分間で少しだけ(7.5度)1時の方向へ進んでいるよ。"
    },
    {
        question: "【謎解き】\n『カエルが井戸の底(10m)から毎日昼に3m登り、夜に2m滑り落ちる。脱出できるのは何日目？』",
        options: ["8日目", "10日目", "7日目"],
        answer: 0, 
        hint: "1日あたり実質1m進むが、8日目の昼に3m登った時点で10mに届く！"
    },
    {
        question: "【謎解き】\n『「あ・い・う・え・お」の中で、一番重い文字はどれ？』",
        options: ["あ", "い", "お"],
        answer: 1, 
        hint: "「い（胃）」は体の一部で重量がある…？（なぞなぞ）"
    },
    {
        question: "【謎解き】\n『リンゴが5個あります。そこから3個取りました。手元に何個ある？』",
        options: ["2個", "3個", "5個"],
        answer: 1, 
        hint: "「自分が取った数」がそのまま手元に残る数だよ。"
    },
    {
        question: "【謎解き】\n『「12, 1, 1, 1, 2, 1, 3, ?」次にくる数字は？』",
        options: ["1", "2", "4"],
        answer: 0, 
        hint: "時計の文字盤の数字を順番に読んだときの「画数」だよ。"
    }
];

let inputMode = "PC";

const STATES = { MENU: "MENU", PLAYING: "PLAYING", PAUSED: "PAUSED", GAMEOVER: "GAMEOVER", CLEAR: "CLEAR", PUZZLE: "PUZZLE" };
let gameState = STATES.MENU;

const mainMenu = document.getElementById("main-menu");
let pauseMenu = document.getElementById("pause-menu");
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

// ポーズ画面
if (!pauseMenu) {
    pauseMenu = document.createElement("div");
    pauseMenu.id = "pause-menu";
    pauseMenu.style.position = "absolute";
    pauseMenu.style.top = "0";
    pauseMenu.style.left = "0";
    pauseMenu.style.width = "100%";
    pauseMenu.style.height = "100%";
    pauseMenu.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
    pauseMenu.style.display = "flex";
    pauseMenu.style.flexDirection = "column";
    pauseMenu.style.justifyContent = "center";
    pauseMenu.style.alignItems = "center";
    pauseMenu.style.zIndex = "1000";
    pauseMenu.classList.add("hidden");

    const pauseTitle = document.createElement("h2");
    pauseTitle.innerText = "PAUSE";
    pauseTitle.style.color = "#ffffff";
    pauseTitle.style.fontSize = "36px";
    pauseTitle.style.marginBottom = "20px";

    const resumeBtn = document.createElement("button");
    resumeBtn.innerText = "ゲームを再開";
    resumeBtn.style.padding = "12px 24px";
    resumeBtn.style.fontSize = "18px";
    resumeBtn.style.cursor = "pointer";
    resumeBtn.addEventListener("click", () => resumeGame());

    pauseMenu.appendChild(pauseTitle);
    pauseMenu.appendChild(resumeBtn);
    document.body.appendChild(pauseMenu);
}

function pauseGame() {
    if (gameState === STATES.PLAYING) {
        gameState = STATES.PAUSED;
        pauseMenu.classList.remove("hidden");
        if (document.pointerLockElement) document.exitPointerLock();
    }
}

function resumeGame() {
    if (gameState === STATES.PAUSED) {
        gameState = STATES.PLAYING;
        pauseMenu.classList.add("hidden");
        if (inputMode === "PC") renderer.domElement.requestPointerLock();
    }
}

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === null && gameState === STATES.PLAYING) {
        pauseGame();
    }
});

// 追撃赤枠エフェクト
const chaseOverlay = document.createElement("div");
chaseOverlay.style.position = "absolute";
chaseOverlay.style.top = "0";
chaseOverlay.style.left = "0";
chaseOverlay.style.width = "100%";
chaseOverlay.style.height = "100%";
chaseOverlay.style.pointerEvents = "none";
chaseOverlay.style.boxShadow = "inset 0 0 50px rgba(255, 0, 0, 0.6)";
chaseOverlay.style.zIndex = "15";
chaseOverlay.style.display = "none";
document.body.appendChild(chaseOverlay);

function setChaseEffect(isChasing) {
    chaseOverlay.style.display = isChasing ? "block" : "none";
}

// UI関連
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
    if (!text) interactBtn.classList.add("hidden");
    else { interactBtn.innerText = text; interactBtn.classList.remove("hidden"); }
}
interactBtn.addEventListener("click", () => triggerInteractAction());

const statusContainer = document.createElement("div");
statusContainer.style.position = "absolute";
statusContainer.style.top = "35px";
statusContainer.style.left = "10px";
statusContainer.style.display = "flex";
statusContainer.style.gap = "8px";
statusContainer.style.zIndex = "25";

const decoyBtn = document.createElement("button");
decoyBtn.style.padding = "8px 12px";
decoyBtn.style.fontSize = "14px";
decoyBtn.style.fontWeight = "bold";
decoyBtn.style.color = "#000";
decoyBtn.style.backgroundColor = "#ffff00";
decoyBtn.style.border = "2px solid #ffffff";
decoyBtn.style.borderRadius = "8px";

const ticketDisplay = document.createElement("div");
ticketDisplay.style.padding = "8px 12px";
ticketDisplay.style.fontSize = "14px";
ticketDisplay.style.fontWeight = "bold";
ticketDisplay.style.color = "#fff";
ticketDisplay.style.backgroundColor = "rgba(150, 100, 200, 0.8)";
ticketDisplay.style.border = "2px solid #ffffff";
ticketDisplay.style.borderRadius = "8px";

statusContainer.appendChild(decoyBtn);
statusContainer.appendChild(ticketDisplay);
document.body.appendChild(statusContainer);

function updateStatusUI() {
    decoyBtn.innerText = `🔔 デコイ: ${decoyStock}個`;
    ticketDisplay.innerText = `📜 チケット: ${hintTickets}枚`;
}
decoyBtn.addEventListener("click", () => triggerDecoyAction());

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
staminaContainer.appendChild(staminaBar);
document.body.appendChild(staminaContainer);

// 謎解きモーダル
const puzzleModal = document.createElement("div");
puzzleModal.style.position = "absolute";
puzzleModal.style.top = "50%";
puzzleModal.style.left = "50%";
puzzleModal.style.transform = "translate(-50%, -50%)";
puzzleModal.style.width = "85%";
puzzleModal.style.maxWidth = "420px";
puzzleModal.style.padding = "20px";
puzzleModal.style.backgroundColor = "rgba(10, 15, 30, 0.95)";
puzzleModal.style.border = "2px solid #00d2ff";
puzzleModal.style.borderRadius = "16px";
puzzleModal.style.color = "#ffffff";
puzzleModal.style.textAlign = "center";
puzzleModal.style.zIndex = "100";
puzzleModal.classList.add("hidden");

const puzzleQuestionText = document.createElement("p");
puzzleQuestionText.style.fontSize = "15px";
puzzleQuestionText.style.lineHeight = "1.5";
puzzleQuestionText.style.whiteSpace = "pre-wrap";
puzzleQuestionText.style.marginBottom = "15px";
puzzleModal.appendChild(puzzleQuestionText);

const puzzleHintText = document.createElement("p");
puzzleHintText.style.fontSize = "13px";
puzzleHintText.style.color = "#ffdd55";
puzzleHintText.style.marginBottom = "15px";
puzzleHintText.style.display = "none";
puzzleModal.appendChild(puzzleHintText);

const puzzleOptionsContainer = document.createElement("div");
puzzleOptionsContainer.style.display = "flex";
puzzleOptionsContainer.style.flexDirection = "column";
puzzleOptionsContainer.style.gap = "10px";
puzzleModal.appendChild(puzzleOptionsContainer);

const puzzleModalFooter = document.createElement("div");
puzzleModalFooter.style.marginTop = "15px";
puzzleModalFooter.style.display = "flex";
puzzleModalFooter.style.justifyContent = "space-between";

const hintUseBtn = document.createElement("button");
hintUseBtn.innerText = "📜 ヒントを使う";
hintUseBtn.style.padding = "8px 12px";
hintUseBtn.style.backgroundColor = "#8a2be2";
hintUseBtn.style.color = "#fff";
hintUseBtn.style.border = "none";
hintUseBtn.style.borderRadius = "8px";
hintUseBtn.style.cursor = "pointer";
hintUseBtn.addEventListener("click", useHintTicket);

const puzzleCloseBtn = document.createElement("button");
puzzleCloseBtn.innerText = "閉じる";
puzzleCloseBtn.style.padding = "8px 16px";
puzzleCloseBtn.style.backgroundColor = "#444";
puzzleCloseBtn.style.color = "#fff";
puzzleCloseBtn.style.border = "none";
puzzleCloseBtn.style.borderRadius = "8px";
puzzleCloseBtn.style.cursor = "pointer";
puzzleCloseBtn.addEventListener("click", closePuzzleModal);

puzzleModalFooter.appendChild(hintUseBtn);
puzzleModalFooter.appendChild(puzzleCloseBtn);
puzzleModal.appendChild(puzzleModalFooter);
document.body.appendChild(puzzleModal);

function openPuzzleModal(puzzleTarget) {
    currentPuzzleTarget = puzzleTarget;
    const qData = puzzleTarget.questionData;

    puzzleQuestionText.innerText = qData.question;
    puzzleHintText.style.display = "none";
    puzzleOptionsContainer.innerHTML = "";

    qData.options.forEach((optText, index) => {
        const btn = document.createElement("button");
        btn.innerText = optText;
        btn.style.padding = "10px";
        btn.style.fontSize = "15px";
        btn.style.fontWeight = "bold";
        btn.style.backgroundColor = "#005588";
        btn.style.color = "#ffffff";
        btn.style.border = "1px solid #00d2ff";
        btn.style.borderRadius = "8px";
        btn.style.cursor = "pointer";

        btn.addEventListener("click", () => checkPuzzleAnswer(index, qData.answer));
        puzzleOptionsContainer.appendChild(btn);
    });

    puzzleModal.classList.remove("hidden");
    gameState = STATES.PUZZLE;
    if (document.pointerLockElement) document.exitPointerLock();
}

function useHintTicket() {
    if (!currentPuzzleTarget) return;
    if (hintTickets <= 0) {
        showMessage("ヒントチケットを持っていません！", 1500);
        return;
    }

    hintTickets--;
    updateStatusUI();

    const qData = currentPuzzleTarget.questionData;
    puzzleHintText.innerText = `💡 ヒント: ${qData.hint}`;
    puzzleHintText.style.display = "block";
}

function closePuzzleModal() {
    puzzleModal.classList.add("hidden");
    currentPuzzleTarget = null;
    gameState = STATES.PLAYING;
    if (inputMode === "PC") renderer.domElement.requestPointerLock();
}

function checkPuzzleAnswer(selectedIndex, correctIndex) {
    if (selectedIndex === correctIndex) {
        if (currentPuzzleTarget) {
            currentPuzzleTarget.solved = true;
            currentPuzzleTarget.mesh.visible = false;
            solvedPuzzleCount++;

            closePuzzleModal();

            if (solvedPuzzleCount >= REQUIRED_SOLVE_COUNT && !hasKey) {
                hasKey = true;
                showMessage(`【目標達成】${REQUIRED_SOLVE_COUNT}つの謎を解き、鍵を入手した！脱出扉へ向かえ！`, 3500);
            } else {
                showMessage(`謎を解いた！ (${solvedPuzzleCount}/${REQUIRED_SOLVE_COUNT})`, 2000);
            }
        }
    } else {
        showMessage("不正解… もう一度考えよう！", 1500);
    }
}

// 3D 空間設定
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); 

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

// ミニマップ
const minimapCanvas = document.createElement("canvas");
minimapCanvas.width = 150;
minimapCanvas.height = 150;
minimapCanvas.style.position = "absolute";
minimapCanvas.style.top = "10px";
minimapCanvas.style.right = "10px";
minimapCanvas.style.width = "150px";
minimapCanvas.style.height = "150px";
minimapCanvas.style.border = "3px solid #00d2ff";
minimapCanvas.style.borderRadius = "10px";
minimapCanvas.style.backgroundColor = "rgba(10, 15, 25, 0.9)";
minimapCanvas.style.zIndex = "10";
minimapCanvas.style.pointerEvents = "none";
document.body.appendChild(minimapCanvas);

const minimapCtx = minimapCanvas.getContext("2d");

// ライティング
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// 床（落ち着いたグレー）
const floorMat = new THREE.MeshBasicMaterial({ color: 0x666666 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_WIDTH * TILE * 2, MAZE_HEIGHT * TILE * 2), floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 床グリッド
const gridHelper = new THREE.GridHelper(MAZE_WIDTH * TILE * 2, MAZE_WIDTH * 2, 0x333333, 0x444444);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// 天井
const ceilingMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(MAZE_WIDTH * TILE * 2, MAZE_HEIGHT * TILE * 2), ceilingMat);
ceiling.position.y = WALL_HEIGHT;
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);

// 迷路データ
let maze = [];
let walls = [];
let wallMeshes = [];
let lightMeshes = [];
let openTiles = [];
let lockers = [];
let ticketItems = [];

let startPos = new THREE.Vector3();
let goalPos = new THREE.Vector3();

// 脱出扉
const doorGeo = new THREE.BoxGeometry(TILE * 0.85, WALL_HEIGHT * 0.9, 0.15);
const doorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
const goalDoor = new THREE.Group();
const doorMain = new THREE.Mesh(doorGeo, doorMat);
goalDoor.add(doorMain);
scene.add(goalDoor);

function generateMazeData(w, h) {
    const grid = Array.from({ length: h }, () => Array(w).fill("#"));

    function carve(x, z) {
        let dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
        for (const [dx, dz] of dirs) {
            const nx = x + dx, nz = z + dz;
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
    lightMeshes.forEach(mesh => scene.remove(mesh));
    lockers.forEach(l => scene.remove(l.mesh));
    puzzles.forEach(p => scene.remove(p.mesh));
    ticketItems.forEach(item => scene.remove(item.mesh));
    if (activeDecoy) { scene.remove(activeDecoy.mesh); activeDecoy = null; }

    wallMeshes = []; walls = []; lightMeshes = []; openTiles = []; lockers = []; puzzles = []; ticketItems = [];
    decoyStock = 0; hintTickets = 0; solvedPuzzleCount = 0; hasKey = false;
    updateStatusUI();

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

    // ★ 20個の謎問題からランダムに5個を選出
    const randomSelectedQuestions = [...ALL_PUZZLE_QUESTIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, PUZZLE_COUNT);

    // 謎解き端末配置 (5つ)
    const puzzleGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6);
    for (let i = 0; i < PUZZLE_COUNT; i++) {
        const tile = shuffled[i + 1];
        const puzzleMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
        const pMesh = new THREE.Mesh(puzzleGeo, puzzleMat);
        pMesh.position.set(tile.pos.x, 0.6, tile.pos.z);
        scene.add(pMesh);

        puzzles.push({
            id: i,
            mesh: pMesh,
            pos: tile.pos.clone(),
            solved: false,
            questionData: randomSelectedQuestions[i]
        });
    }

    // チケット配置
    const ticketGeo = new THREE.PlaneGeometry(0.4, 0.5);
    const ticketMat = new THREE.MeshBasicMaterial({ color: 0xddaafe, side: THREE.DoubleSide });
    for (let i = 0; i < TICKET_COUNT; i++) {
        const tile = shuffled[i + PUZZLE_COUNT + 1];
        const tMesh = new THREE.Mesh(ticketGeo, ticketMat);
        tMesh.position.set(tile.pos.x, 1.0, tile.pos.z);
        tMesh.rotation.x = Math.PI / 4;
        scene.add(tMesh);
        ticketItems.push({ mesh: tMesh, pos: tile.pos.clone(), active: true });
    }

    // ★ 壁の構築（ウォームグレー #a89f91）
    const wallGeo = new THREE.BoxGeometry(TILE, WALL_HEIGHT, TILE);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0xa89f91 });

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z][x] === "#") {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x * TILE, WALL_HEIGHT / 2, z * TILE);

                const edges = new THREE.EdgesGeometry(wallGeo);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x736c61 }));
                wall.add(line);

                scene.add(wall); walls.push(wall); wallMeshes.push(wall);
            }
        }
    }

    // ★ 脱出扉を壁にピッタリ貼り付ける設定
    const edgeTiles = openTiles.filter(t => t.x === 1 || t.x === MAZE_WIDTH - 2 || t.z === 1 || t.z === MAZE_HEIGHT - 2);
    if (edgeTiles.length > 0) {
        const doorTile = edgeTiles[Math.floor(Math.random() * edgeTiles.length)];
        const { x, z } = doorTile;

        let offsetX = 0, offsetZ = 0, rotY = 0;
        const shiftDist = TILE * 0.42; // 壁の表面にピッタリ沿わせる距離

        if (maze[z - 1] && maze[z - 1][x] === "#") { offsetZ = -shiftDist; rotY = 0; }
        else if (maze[z + 1] && maze[z + 1][x] === "#") { offsetZ = shiftDist; rotY = Math.PI; }
        else if (maze[z][x - 1] === "#") { offsetX = -shiftDist; rotY = -Math.PI / 2; }
        else if (maze[z][x + 1] === "#") { offsetX = shiftDist; rotY = Math.PI / 2; }

        goalDoor.position.set(doorTile.pos.x + offsetX, WALL_HEIGHT / 2, doorTile.pos.z + offsetZ);
        goalDoor.rotation.y = rotY;
        goalPos.copy(doorTile.pos);
    }

    // 天井照明
    const lightFixtureGeo = new THREE.BoxGeometry(1.2, 0.1, 0.3);
    const lightFixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    openTiles.forEach((tile, index) => {
        if (index % 3 === 0) {
            const fixture = new THREE.Mesh(lightFixtureGeo, lightFixtureMat);
            fixture.position.set(tile.pos.x, WALL_HEIGHT - 0.05, tile.pos.z);
            scene.add(fixture);
            lightMeshes.push(fixture);
        }
    });

    // ロッカー配置
    const lockerGeo = new THREE.BoxGeometry(0.8, 2.4, 0.5);
    const lockerMat = new THREE.MeshBasicMaterial({ color: 0x2266aa });

    let lockerCountPlaced = 0;
    for (const tile of shuffled.slice(PUZZLE_COUNT + TICKET_COUNT + 2)) {
        if (lockerCountPlaced >= LOCKER_COUNT) break;

        const { x, z } = tile;
        let offsetX = 0, offsetZ = 0, rotY = 0;
        const shiftDist = TILE * 0.38;

        if (maze[z - 1] && maze[z - 1][x] === "#") { offsetZ = -shiftDist; rotY = 0; }
        else if (maze[z + 1] && maze[z + 1][x] === "#") { offsetZ = shiftDist; rotY = Math.PI; }
        else if (maze[z][x - 1] === "#") { offsetX = -shiftDist; rotY = -Math.PI / 2; }
        else if (maze[z][x + 1] === "#") { offsetX = shiftDist; rotY = Math.PI / 2; }
        else continue;

        const lockerMesh = new THREE.Mesh(lockerGeo, lockerMat);
        const lPos = new THREE.Vector3(tile.pos.x + offsetX, 1.2, tile.pos.z + offsetZ);
        lockerMesh.position.copy(lPos);
        lockerMesh.rotation.y = rotY;

        scene.add(lockerMesh);
        lockers.push({ mesh: lockerMesh, pos: lPos, standPos: tile.pos.clone() });
        lockerCountPlaced++;
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
    enemy.pathIndex = (enemy.path.length > 1) ? 1 : 0;
}

// 操作関連
const keys = {};
let yaw = 0, pitch = 0;
let isHiding = false;
let currentLocker = null;

function triggerInteractAction() {
    if (isHiding) {
        isHiding = false;
        if (currentLocker) camera.position.set(currentLocker.standPos.x, 1.5, currentLocker.standPos.z);
        currentLocker = null;
        showMessage("ロッカーから出た");
        return;
    }

    const nearPuzzle = puzzles.find(p => !p.solved && camera.position.distanceTo(p.pos) < 2.0);
    if (nearPuzzle) {
        openPuzzleModal(nearPuzzle);
        return;
    }

    for (const locker of lockers) {
        if (camera.position.distanceTo(locker.pos) < 2.2) {
            isHiding = true; currentLocker = locker;
            camera.position.set(locker.pos.x, 1.5, locker.pos.z);
            showMessage("ロッカーに隠れた");
            break;
        }
    }
}

function triggerDecoyAction() {
    if (decoyStock > 0 && !activeDecoy) {
        decoyStock--;
        updateStatusUI();

        const decoyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8);
        const decoyMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const mesh = new THREE.Mesh(decoyGeo, decoyMat);
        mesh.position.set(camera.position.x, 0.2, camera.position.z);
        scene.add(mesh);

        activeDecoy = { pos: mesh.position.clone(), timer: 6.0, mesh: mesh };
        showMessage("🔔 デコイ設置！敵を引き寄せています！", 2500);
    }
}

window.addEventListener("keydown", (e) => { 
    const k = e.key.toLowerCase();
    keys[k] = true; 

    if (k === "p") {
        if (gameState === STATES.PLAYING) pauseGame();
        else if (gameState === STATES.PAUSED) resumeGame();
        return;
    }

    if (gameState !== STATES.PLAYING) return;
    if (k === "e") triggerInteractAction();
    if (k === "f") triggerDecoyAction();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// マウス移動処理
document.addEventListener("mousemove", (e) => {
    if (inputMode === "PC" && gameState === STATES.PLAYING && document.pointerLockElement === renderer.domElement) {
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;

        yaw -= e.movementX * MOUSE_SENSITIVITY;
        pitch -= e.movementY * MOUSE_SENSITIVITY;

        const maxPitch = Math.PI / 2 - 0.15;
        pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

        camera.rotation.set(pitch, yaw, 0, "YXZ");
    }
});

// 敵 enemy.glb 読み込み処理
const enemies = [];
const gltfLoader = new GLTFLoader();
let enemyTemplate = null;

gltfLoader.load(
    "./enemy.glb",
    (gltf) => {
        enemyTemplate = gltf.scene;
        enemyTemplate.scale.set(6, 6, 6);
        initEnemies();
    },
    undefined,
    (error) => {
        console.warn("enemy.glb の読み込みに失敗したため、代替オブジェクトを使用します。", error);
        initEnemies();
    }
);

function createEnemyMesh() {
    if (enemyTemplate) {
        return enemyTemplate.clone(true);
    } else {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.8, 0.8, 2.0, 12),
            new THREE.MeshBasicMaterial({ color: 0xcc0000 })
        );
        body.position.y = 1.0;
        group.add(body);
        
        group.scale.set(6, 6, 6);
        return group;
    }
}

function assignNewRandomPath(enemy) {
    if (openTiles.length === 0) return;
    const currentGrid = worldToGrid(enemy.mesh.position);
    const targetTile = openTiles[Math.floor(Math.random() * openTiles.length)];
    const path = findPath(currentGrid, { x: targetTile.x, z: targetTile.z });
    setEnemyPath(enemy, path);
}

function initEnemies() {
    if (openTiles.length === 0) return;

    enemies.forEach(e => {
        if (e.mesh) scene.remove(e.mesh);
    });
    enemies.length = 0;

    const shuffled = [...openTiles].sort(() => Math.random() - 0.5);

    for (let i = 0; i < ENEMY_COUNT; i++) {
        const mesh = createEnemyMesh();
        const spawnTile = shuffled[i + 8] || openTiles[0];
        
        mesh.position.set(spawnTile.pos.x, 0, spawnTile.pos.z);
        scene.add(mesh);

        const enemyObj = { mesh: mesh, path: [], pathIndex: 0 };
        enemies.push(enemyObj);
        assignNewRandomPath(enemyObj);
    }
}

const raycaster = new THREE.Raycaster();
function canSeePlayer(enemyMesh) {
    if (isHiding) return false;
    const distToPlayer = enemyMesh.position.distanceTo(camera.position);

    if (distToPlayer > ENEMY_DETECTION_RANGE) return false;

    const origin = enemyMesh.position.clone(); origin.y = 1.5;
    const target = camera.position.clone();
    const direction = target.sub(origin).normalize();

    raycaster.set(origin, direction);
    const intersects = raycaster.intersectObjects(walls);
    return !(intersects.length > 0 && intersects[0].distance < distToPlayer);
}

function resetGame() {
    buildMaze();
    stamina = MAX_STAMINA; isHiding = false; currentLocker = null;
    camera.position.copy(startPos); camera.position.y = 1.5;
    yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0);
    initEnemies();
    setChaseEffect(false);
}

function startGame(mode) {
    inputMode = mode || "PC";
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

function showMainMenu() {
    gameState = STATES.MENU;
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock();

    if (pauseMenu) pauseMenu.classList.add("hidden");
    if (gameOverScreen) gameOverScreen.classList.add("hidden");
    if (clearScreen) clearScreen.classList.add("hidden");
    if (mainMenu) mainMenu.classList.remove("hidden");
}

function triggerGameOver() { 
    gameState = STATES.GAMEOVER; 
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock(); 
    if (gameOverScreen) gameOverScreen.classList.remove("hidden"); 
}

function triggerClear() { 
    gameState = STATES.CLEAR; 
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock(); 
    if (clearScreen) clearScreen.classList.remove("hidden"); 
}

window.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.style.display = "none";

    const modePcBtn = document.getElementById("mode-pc-btn");
    const modeTouchBtn = document.getElementById("mode-touch-btn");

    if (modePcBtn) modePcBtn.addEventListener("click", () => startGame("PC"));
    if (modeTouchBtn) modeTouchBtn.addEventListener("click", () => startGame("TOUCH"));

    const retryButtons = document.querySelectorAll("#retry-btn, #clear-retry-btn, #restart-btn, .retry-button, .restart-button");
    retryButtons.forEach(btn => {
        btn.addEventListener("click", () => startGame(inputMode));
    });

    const menuButtons = document.querySelectorAll("#menu-btn, #clear-menu-btn, #game-over-menu-btn, .menu-button");
    menuButtons.forEach(btn => {
        btn.addEventListener("click", () => showMainMenu());
    });

    const resumeButtons = document.querySelectorAll("#resume-btn, .resume-button");
    resumeButtons.forEach(btn => {
        btn.addEventListener("click", () => resumeGame());
    });
});

function updateEnemies(delta) {
    if (gameState !== STATES.PLAYING) return;

    let isAnyEnemyChasing = false;

    for (const e of enemies) {
        if (!e.mesh) continue;

        const distToPlayer = Math.hypot(camera.position.x - e.mesh.position.x, camera.position.z - e.mesh.position.z);
        if (!isHiding && distToPlayer < 1.3) { triggerGameOver(); return; }

        let speed = ENEMY_SPEED * 0.55;
        let targetX = null, targetZ = null;

        if (canSeePlayer(e.mesh)) {
            speed = ENEMY_SPEED;
            targetX = camera.position.x;
            targetZ = camera.position.z;
            isAnyEnemyChasing = true;
        } else if (!e.path || e.pathIndex >= e.path.length) {
            assignNewRandomPath(e);
        }

        if (targetX !== null && targetZ !== null) {
            const dirX = targetX - e.mesh.position.x;
            const dirZ = targetZ - e.mesh.position.z;
            const dist = Math.hypot(dirX, dirZ);

            if (dist > 0.1) {
                e.mesh.position.x += (dirX / dist) * speed * delta;
                e.mesh.position.z += (dirZ / dist) * speed * delta;
                e.mesh.rotation.y = Math.atan2(dirX, dirZ);
            }
        } else if (e.path && e.pathIndex < e.path.length) {
            const waypoint = e.path[e.pathIndex];
            const dirX = waypoint.x - e.mesh.position.x;
            const dirZ = waypoint.z - e.mesh.position.z;
            const dist = Math.hypot(dirX, dirZ);

            if (dist < 0.6) { 
                e.pathIndex++; 
            } else {
                e.mesh.position.x += (dirX / dist) * speed * delta;
                e.mesh.position.z += (dirZ / dist) * speed * delta;
                e.mesh.rotation.y = Math.atan2(dirX, dirZ);
            }
        }
    }

    setChaseEffect(isAnyEnemyChasing);
}

function updatePlayer(delta) {
    if (gameState !== STATES.PLAYING) return;

    if (isHiding) {
        setInteractText("ロッカーから出る");
        return;
    }

    const nearPuzzle = puzzles.find(p => !p.solved && camera.position.distanceTo(p.pos) < 2.0);
    const nearLocker = lockers.find(l => camera.position.distanceTo(l.pos) < 2.2);

    if (nearPuzzle) {
        setInteractText("🧩 謎を解く");
    } else if (nearLocker) {
        setInteractText("ロッカーに隠れる");
    } else {
        setInteractText(null);
    }

    const isMoving = keys["w"] || keys["s"] || keys["a"] || keys["d"];
    let isDashing = keys["shift"] && isMoving && stamina > 0;

    if (isDashing) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
    } else {
        stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER * delta);
    }

    staminaBar.style.width = `${(stamina / MAX_STAMINA) * 100}%`;

    let speed = isDashing ? DASH_SPEED : MOVE_SPEED;
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const moveStep = speed * delta;
    let dx = 0, dz = 0;

    if (keys["w"]) { dx += forwardX * moveStep; dz += forwardZ * moveStep; }
    if (keys["s"]) { dx -= forwardX * moveStep; dz -= forwardZ * moveStep; }
    if (keys["a"]) { dx -= rightX * moveStep; dz -= rightZ * moveStep; }
    if (keys["d"]) { dx += rightX * moveStep; dz += rightZ * moveStep; }

    if (!hitWall(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
    if (!hitWall(camera.position.x, camera.position.z + dz)) camera.position.z += dz;

    for (const t of ticketItems) {
        if (t.active && camera.position.distanceTo(t.pos) < 1.2) {
            t.active = false; t.mesh.visible = false;
            hintTickets++; updateStatusUI();
            showMessage("📜 ヒントチケットを入手した！", 2000);
        }
    }

    if (Math.hypot(camera.position.x - goalPos.x, camera.position.z - goalPos.z) < 1.8) {
        if (hasKey) {
            triggerClear();
        } else {
            showMessage(`鍵がかかっている！謎を ${REQUIRED_SOLVE_COUNT} つ解け！ (${solvedPuzzleCount}/${REQUIRED_SOLVE_COUNT})`);
        }
    }
}

// ミニマップ描画
function drawMinimap() {
    const mapW = minimapCanvas.width, mapH = minimapCanvas.height;
    const scaleX = mapW / (MAZE_WIDTH * TILE), scaleZ = mapH / (MAZE_HEIGHT * TILE);

    minimapCtx.clearRect(0, 0, mapW, mapH);

    // 壁
    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z] && maze[z][x] === "#") {
                minimapCtx.fillStyle = "#a89f91";
                minimapCtx.fillRect(x * TILE * scaleX, z * TILE * scaleZ, TILE * scaleX, TILE * scaleZ);
            }
        }
    }

    // 脱出扉
    minimapCtx.fillStyle = "#00ff88";
    minimapCtx.fillRect(goalPos.x * scaleX - 4, goalPos.z * scaleZ - 4, 8, 8);

    // ロッカー
    lockers.forEach(l => {
        minimapCtx.fillStyle = "#2288ff";
        minimapCtx.fillRect(l.pos.x * scaleX - 3, l.pos.z * scaleZ - 3, 6, 6);
    });

    // 謎端末
    puzzles.forEach(p => {
        if (!p.solved) {
            minimapCtx.fillStyle = "#00ffff";
            minimapCtx.beginPath();
            const cx = p.pos.x * scaleX, cz = p.pos.z * scaleZ;
            minimapCtx.moveTo(cx, cz - 4);
            minimapCtx.lineTo(cx + 4, cz);
            minimapCtx.lineTo(cx, cz + 4);
            minimapCtx.lineTo(cx - 4, cz);
            minimapCtx.closePath();
            minimapCtx.fill();
        }
    });

    // チケット
    ticketItems.forEach(t => {
        if (t.active) {
            minimapCtx.fillStyle = "#dd88ff";
            minimapCtx.fillRect(t.pos.x * scaleX - 2, t.pos.z * scaleZ - 2, 4, 4);
        }
    });

    // 敵
    enemies.forEach(e => {
        if (e.mesh) {
            const ex = e.mesh.position.x * scaleX, ez = e.mesh.position.z * scaleZ;
            minimapCtx.fillStyle = "#ff0033";
            minimapCtx.strokeStyle = "#ffffff";
            minimapCtx.lineWidth = 1;
            minimapCtx.beginPath();
            minimapCtx.arc(ex, ez, 4, 0, Math.PI * 2);
            minimapCtx.fill();
            minimapCtx.stroke();
        }
    });

    // プレイヤーと「向いている方向」の視界扇形
    const px = camera.position.x * scaleX, pz = camera.position.z * scaleZ;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);
    const fovAngle = Math.PI / 3;
    const baseAngle = Math.atan2(dirZ, dirX);

    minimapCtx.fillStyle = "rgba(255, 255, 100, 0.4)";
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, pz);
    minimapCtx.arc(px, pz, 16, baseAngle - fovAngle / 2, baseAngle + fovAngle / 2);
    minimapCtx.closePath();
    minimapCtx.fill();

    minimapCtx.fillStyle = "#00ff00";
    minimapCtx.strokeStyle = "#000000";
    minimapCtx.lineWidth = 1.5;
    minimapCtx.beginPath();
    minimapCtx.arc(px, pz, 4.5, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.stroke();
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    puzzles.forEach(p => { if (!p.solved) p.mesh.rotation.y += delta * 1.5; });
    ticketItems.forEach(t => { if (t.active) t.mesh.rotation.y += delta * 2; });

    updatePlayer(delta);
    updateEnemies(delta);
    drawMinimap();

    renderer.render(scene, camera);
}

buildMaze();
animate();
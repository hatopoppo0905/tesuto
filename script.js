import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

// ====================
// ピンチズーム＆ダブルタップ拡大の防止処理
// ====================
document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault(); // 2本指以上の操作（ピンチイン/アウト）を無効化
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault(); // ダブルタップによる拡大を無効化
    }
    lastTouchEnd = now;
}, false);

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
const REQUIRED_SOLVE_COUNT = 5; 
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
let decoyStock = 3;      
let killStock = 0;       
let hintTickets = 0; 
let activeDecoy = null;
let killItems = [];      

// スマホタッチ操作用変数
let touchMoveId = null;
let touchLookId = null;
let moveStartX = 0, moveStartY = 0;
let touchMoveX = 0, touchMoveY = 0;
let lastLookX = 0, lastLookY = 0;
let isTouchDashActive = false; // トグル式ダッシュフラグ

// 謎解き管理
let puzzles = [];
let solvedPuzzleCount = 0;
let currentPuzzleTarget = null; 

// 20パターンの問題プール
const ALL_PUZZLE_QUESTIONS = [
    { question: "【謎解き】\n「赤」「青」「黄」の3つのボタンがある。\n『青の隣は赤ではない。赤色は一番右。』\n一番左の色は？", options: ["赤", "青", "黄"], answer: 1, hint: "提示条件：[ ? , ? , 赤 ]。青と赤が隣り合わない位置を考えよう。" },
    { question: "【謎解き】\n『1, 2, 4, 7, 11, ?』\n? に入る数字はどれ？", options: ["15", "16", "18"], answer: 1, hint: "増えている数字に注目！ (+1, +2, +3, +4, +5...)" },
    { question: "【謎解き】\n『暗号：3 1 2 4』\nあ＝1, い＝2, う＝3, え＝4 とするとき、解ける言葉は？", options: ["あいうえ", "うあいえ", "えいあう"], answer: 1, hint: "数字をそのまま平仮名に置き換えて読んでみよう。" },
    { question: "【謎解き】\n『たぬき』から『ぬ』をとると何になる？", options: ["たき", "たぬ", "ぬき"], answer: 0, hint: "「た・ぬ・き」の文字から「ぬ」を取り除いてみよう。" },
    { question: "【謎解き】\n『南を向いている人が右を向いた。今向いている方角は？』", options: ["東", "西", "北"], answer: 1, hint: "南を基準にして、時計回りに90度回るとどっち？" },
    { question: "【謎解き】\n『1年の中で31日がない月はいくつある？』", options: ["1個", "5個", "7個"], answer: 1, hint: "31日まである月は 1,3,5,7,8,10,12月（7つ）です。" },
    { question: "【謎解き】\n『2, 4, 8, 16, 32, ?』\n? に入る数字はどれ？", options: ["48", "64", "128"], answer: 1, hint: "前の数字を毎回2倍していこう。" },
    { question: "【謎解き】\n『パンはパンんでも食べられないパンは？』", options: ["食パン", "フライパン", "メロンパン"], answer: 1, hint: "料理の時に使う道具の名前だよ。" },
    { question: "【謎解き】\n『上を向いても下を向き、右を向いても左を向くものは？』", options: ["影", "鏡の中の自分", "時計の針"], answer: 1, hint: "自分と向き合ったとき、左右はどう映るかな？" },
    { question: "【謎解き】\n『1kmの鉄と、1kmの綿。重いのはどっち？』", options: ["鉄", "綿", "同じ"], answer: 2, hint: "重さではなく「長さ」の単位(km)で比べられているよ。" },
    { question: "【謎解き】\n『ある部屋にろうそくが10本点いている。風で2本消えた。最終的に残ったろうそくは何本？』", options: ["0本", "2本", "8本"], answer: 1, hint: "消えなかった8本は燃え尽きてなくなってしまいます。" },
    { question: "【謎解き】\n『「お父さん」の父親の息子は誰？（※自分は一人っ子とする）』", options: ["おじさん", "お父さん", "自分"], answer: 1, hint: "お父さんの父親＝おじいちゃん。おじいちゃんの息子で一人っ子なら？" },
    { question: "【謎解き】\n『10人の中で「2人」が抜けた。残りは何人？』", options: ["8人", "10人", "12人"], answer: 0, hint: "シンプルに引き算をしてみよう。10 - 2 = ?" },
    { question: "【謎解き】\n『「春・夏・秋・冬」のうち、文字数が一番長いのはどれ？』", options: ["春", "夏", "全て同じ"], answer: 2, hint: "平仮名で書くと「はる」「なつ」「あき」「ふゆ」。" },
    { question: "【謎解き】\n『「0, 1, 1, 2, 3, 5, 8, ?」』\n? に入る数字はどれ？", options: ["11", "12", "13"], answer: 2, hint: "前の2つの数字を足すと次の数字になるよ。(5 + 8 = ?)" },
    { question: "【謎解き】\n『時計の針が「12時15分」を指している時、長針と短針のなす角度は？』", options: ["90度", "82.5度", "7.5度"], answer: 1, hint: "短針も15分間で少しだけ(7.5度)1時の方向へ進んでいるよ。" },
    { question: "【謎解き】\n『カエルが井戸の底(10m)から毎日昼に3m登り、夜に2m滑り落ちる。脱出できるのは何日目？』", options: ["8日目", "10日目", "7日目"], answer: 0, hint: "1日あたり実質1m進むが、8日目の昼に3m登った時点で10mに届く！" },
    { question: "【謎解き】\n『「あ・い・う・え・お」の中で、一番重い文字はどれ？』", options: ["あ", "い", "お"], answer: 1, hint: "「い（胃）」は体の一部で重量がある…？（なぞなぞ）" },
    { question: "【謎解き】\n『リンゴが5個あります。そこから3個取りました。手元に何個ある？』", options: ["2個", "3個", "5個"], answer: 1, hint: "「自分が取った数」がそのまま手元に残る数だよ。" },
    { question: "【謎解き】\n『「12, 1, 1, 1, 2, 1, 3, ?」次にくる数字は？』", options: ["1", "2", "4"], answer: 0, hint: "時計の文字盤の数字を順番に読んだときの「画数」だよ。" }
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

// タッチUIコンテナの設定調整
if (touchUI) {
    touchUI.style.position = "absolute";
    touchUI.style.top = "0";
    touchUI.style.left = "0";
    touchUI.style.width = "100%";
    touchUI.style.height = "100%";
    touchUI.style.pointerEvents = "none";
    touchUI.style.zIndex = "20";
    touchUI.innerHTML = "";
}

// 動的ジョイスティックUI生成
const joystickBase = document.createElement("div");
joystickBase.style.position = "absolute";
joystickBase.style.width = "100px";
joystickBase.style.height = "100px";
joystickBase.style.borderRadius = "50%";
joystickBase.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
joystickBase.style.border = "2px solid rgba(255, 255, 255, 0.6)";
joystickBase.style.pointerEvents = "none";
joystickBase.style.display = "none";
joystickBase.style.zIndex = "30";

const joystickStick = document.createElement("div");
joystickStick.style.position = "absolute";
joystickStick.style.width = "40px";
joystickStick.style.height = "40px";
joystickStick.style.borderRadius = "50%";
joystickStick.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
joystickStick.style.top = "30px";
joystickStick.style.left = "30px";
joystickStick.style.pointerEvents = "none";

joystickBase.appendChild(joystickStick);
document.body.appendChild(joystickBase);

// トグル式ダッシュボタン（サイズ最適化・文字切れ防止＆優先タップ判定）
const touchDashBtn = document.createElement("button");
touchDashBtn.style.position = "absolute";
touchDashBtn.style.bottom = "20px";
touchDashBtn.style.right = "20px";
touchDashBtn.style.width = "22vw";
touchDashBtn.style.height = "22vw";
touchDashBtn.style.maxWidth = "85px";
touchDashBtn.style.maxHeight = "85px";
touchDashBtn.style.minWidth = "65px";
touchDashBtn.style.minHeight = "65px";
touchDashBtn.style.borderRadius = "50%";
touchDashBtn.style.border = "3px solid #ffffff";
touchDashBtn.style.fontWeight = "bold";
touchDashBtn.style.fontSize = "11px";
touchDashBtn.style.lineHeight = "1.2";
touchDashBtn.style.padding = "2px";
touchDashBtn.style.textAlign = "center";
touchDashBtn.style.zIndex = "50";
touchDashBtn.style.pointerEvents = "auto";
touchDashBtn.style.userSelect = "none";
touchDashBtn.style.webkitUserSelect = "none";
touchDashBtn.style.touchAction = "manipulation";

function updateDashButtonUI() {
    if (isTouchDashActive) {
        touchDashBtn.innerHTML = "🏃<br>ダッシュ<br><b>ON</b>";
        touchDashBtn.style.backgroundColor = "rgba(255, 200, 0, 0.95)";
        touchDashBtn.style.color = "#000000";
    } else {
        touchDashBtn.innerHTML = "🏃<br>ダッシュ<br><b>OFF</b>";
        touchDashBtn.style.backgroundColor = "rgba(60, 60, 60, 0.85)";
        touchDashBtn.style.color = "#ffffff";
    }
}
updateDashButtonUI();

function toggleTouchDash(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    isTouchDashActive = !isTouchDashActive;
    updateDashButtonUI();
}

touchDashBtn.addEventListener("touchstart", (e) => {
    toggleTouchDash(e);
}, { passive: false });

touchDashBtn.addEventListener("click", (e) => {
    if (e.pointerType === "mouse") {
        toggleTouchDash(e);
    }
});

if (touchUI) touchUI.appendChild(touchDashBtn);

// ポーズ（一時停止）ボタン
const pauseTriggerBtn = document.createElement("button");
pauseTriggerBtn.innerText = "⏸️ 一時停止";
pauseTriggerBtn.style.position = "absolute";
pauseTriggerBtn.style.top = "10px";
pauseTriggerBtn.style.left = "220px";
pauseTriggerBtn.style.padding = "6px 12px";
pauseTriggerBtn.style.fontSize = "13px";
pauseTriggerBtn.style.fontWeight = "bold";
pauseTriggerBtn.style.color = "#fff";
pauseTriggerBtn.style.backgroundColor = "rgba(50, 50, 50, 0.8)";
pauseTriggerBtn.style.border = "1px solid #ffffff";
pauseTriggerBtn.style.borderRadius = "6px";
pauseTriggerBtn.style.cursor = "pointer";
pauseTriggerBtn.style.zIndex = "40";
pauseTriggerBtn.addEventListener("click", () => pauseGame());
document.body.appendChild(pauseTriggerBtn);

let hasKey = false;
let messageTimer = null;

function hideElement(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.style.display = "none";
}

function showElement(el, displayStyle = "flex") {
    if (!el) return;
    el.classList.remove("hidden");
    el.style.display = displayStyle;
}

function showMessage(text, duration = 2000) {
    if (!gameMessage) return;
    gameMessage.innerText = text;
    showElement(gameMessage, "block");
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        hideElement(gameMessage);
    }, duration);
}

// ポーズ画面の設定
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
    hideElement(pauseMenu);

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
        showElement(pauseMenu, "flex");
        if (document.pointerLockElement) document.exitPointerLock();
    }
}

function resumeGame() {
    if (gameState === STATES.PAUSED) {
        gameState = STATES.PLAYING;
        hideElement(pauseMenu);
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
hideElement(interactBtn);
document.body.appendChild(interactBtn);

function setInteractText(text) {
    if (!text) hideElement(interactBtn);
    else { interactBtn.innerText = text; showElement(interactBtn, "block"); }
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
decoyBtn.style.cursor = "pointer";

const killBtn = document.createElement("button");
killBtn.style.padding = "8px 12px";
killBtn.style.fontSize = "14px";
killBtn.style.fontWeight = "bold";
killBtn.style.color = "#fff";
killBtn.style.backgroundColor = "#aa0000";
killBtn.style.border = "2px solid #ffffff";
killBtn.style.borderRadius = "8px";
killBtn.style.cursor = "pointer";

const ticketDisplay = document.createElement("div");
ticketDisplay.style.padding = "8px 12px";
ticketDisplay.style.fontSize = "14px";
ticketDisplay.style.fontWeight = "bold";
ticketDisplay.style.color = "#fff";
ticketDisplay.style.backgroundColor = "rgba(150, 100, 200, 0.8)";
ticketDisplay.style.border = "2px solid #ffffff";
ticketDisplay.style.borderRadius = "8px";

statusContainer.appendChild(decoyBtn);
statusContainer.appendChild(killBtn);
statusContainer.appendChild(ticketDisplay);
document.body.appendChild(statusContainer);

function updateStatusUI() {
    decoyBtn.innerText = `🔔 デコイ: ${decoyStock}個`;
    killBtn.innerText = `💥 敵消去: ${killStock}個`;
    ticketDisplay.innerText = `📜 チケット: ${hintTickets}枚`;
}
decoyBtn.addEventListener("click", () => triggerDecoyAction());
killBtn.addEventListener("click", () => triggerKillAction());

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
hideElement(puzzleModal);

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

    showElement(puzzleModal, "block");
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
    hideElement(puzzleModal);
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

// 床
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
    killItems.forEach(k => scene.remove(k.mesh));
    if (activeDecoy) { scene.remove(activeDecoy.mesh); activeDecoy = null; }

    wallMeshes = []; walls = []; lightMeshes = []; openTiles = []; lockers = []; puzzles = []; ticketItems = []; killItems = [];
    decoyStock = 3; killStock = 0; hintTickets = 0; solvedPuzzleCount = 0; hasKey = false;
    isTouchDashActive = false;
    updateDashButtonUI();
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

    // 謎選出
    const randomSelectedQuestions = [...ALL_PUZZLE_QUESTIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, PUZZLE_COUNT);

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

    // 敵消去アイテム配置
    const killGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const killMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const killTile = shuffled[PUZZLE_COUNT + TICKET_COUNT + 1];
    const killMesh = new THREE.Mesh(killGeo, killMat);
    killMesh.position.set(killTile.pos.x, 1.0, killTile.pos.z);
    scene.add(killMesh);
    killItems.push({ mesh: killMesh, pos: killTile.pos.clone(), active: true });

    // 壁構築
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

    // 脱出扉配置
    const outerCandidates = [];
    openTiles.forEach(t => {
        if (t.z === 1 && maze[0][t.x] === "#") outerCandidates.push({ tile: t, dir: "NORTH" });
        else if (t.z === MAZE_HEIGHT - 2 && maze[MAZE_HEIGHT - 1][t.x] === "#") outerCandidates.push({ tile: t, dir: "SOUTH" });
        else if (t.x === 1 && maze[t.z][0] === "#") outerCandidates.push({ tile: t, dir: "WEST" });
        else if (t.x === MAZE_WIDTH - 2 && maze[t.z][MAZE_WIDTH - 1] === "#") outerCandidates.push({ tile: t, dir: "EAST" });
    });

    if (outerCandidates.length > 0) {
        const choice = outerCandidates[Math.floor(Math.random() * outerCandidates.length)];
        const { tile, dir } = choice;
        const shiftDist = TILE * 0.42;
        let offsetX = 0, offsetZ = 0, rotY = 0;

        if (dir === "NORTH") { offsetZ = -shiftDist; rotY = 0; }
        else if (dir === "SOUTH") { offsetZ = shiftDist; rotY = Math.PI; }
        else if (dir === "WEST") { offsetX = -shiftDist; rotY = -Math.PI / 2; }
        else if (dir === "EAST") { offsetX = shiftDist; rotY = Math.PI / 2; }

        goalDoor.position.set(tile.pos.x + offsetX, WALL_HEIGHT / 2, tile.pos.z + offsetZ);
        goalDoor.rotation.y = rotY;
        goalPos.copy(tile.pos);
    }

    // 照明配置
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
    for (const tile of shuffled.slice(PUZZLE_COUNT + TICKET_COUNT + 3)) {
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
        showMessage("🔔 デコイ設置！敵の視界判定を無効化中！", 2500);
    }
}

function triggerKillAction() {
    if (killStock <= 0) {
        showMessage("敵消去アイテムを持っていません！", 1500);
        return;
    }

    if (enemies.length === 0) {
        showMessage("消去できる敵がいません！", 1500);
        return;
    }

    killStock--;
    updateStatusUI();

    let nearestIdx = -1;
    let minDist = Infinity;
    enemies.forEach((e, index) => {
        const d = camera.position.distanceTo(e.mesh.position);
        if (d < minDist) {
            minDist = d;
            nearestIdx = index;
        }
    });

    if (nearestIdx !== -1) {
        const removed = enemies.splice(nearestIdx, 1)[0];
        scene.remove(removed.mesh);
        showMessage("💥 近くの敵を1体消去した！", 2000);
    }
}

// PC用キーボード入力
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
    if (k === "g") triggerKillAction();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

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

// スマホ用タッチ操作イベント
window.addEventListener("touchstart", (e) => {
    if (inputMode !== "TOUCH" || gameState !== STATES.PLAYING) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        // 左半面: ジョイスティック移動
        if (touch.clientX < window.innerWidth / 2 && touchMoveId === null) {
            touchMoveId = touch.identifier;
            moveStartX = touch.clientX;
            moveStartY = touch.clientY;
            touchMoveX = 0;
            touchMoveY = 0;

            joystickBase.style.left = `${moveStartX - 50}px`;
            joystickBase.style.top = `${moveStartY - 50}px`;
            joystickStick.style.transform = `translate(0px, 0px)`;
            joystickBase.style.display = "block";
        }
        // 右半面: 視点操作 (ダッシュボタン領域を除外)
        else if (touch.clientX >= window.innerWidth / 2 && touchLookId === null) {
            const btnAreaSize = 100;
            if (touch.clientX > window.innerWidth - btnAreaSize && touch.clientY > window.innerHeight - btnAreaSize) {
                continue; // ボタン押下エリアの視点移動除外
            }
            touchLookId = touch.identifier;
            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
        }
    }
}, { passive: false });

window.addEventListener("touchmove", (e) => {
    if (inputMode !== "TOUCH" || gameState !== STATES.PLAYING) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === touchMoveId) {
            const dx = touch.clientX - moveStartX;
            const dy = touch.clientY - moveStartY;
            const dist = Math.hypot(dx, dy);
            const maxRadius = 40;

            const clampedDist = Math.min(dist, maxRadius);
            const angle = Math.atan2(dy, dx);

            const stickX = Math.cos(angle) * clampedDist;
            const stickY = Math.sin(angle) * clampedDist;
            joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;

            if (dist > 0) {
                touchMoveX = stickX / maxRadius;
                touchMoveY = stickY / maxRadius;
            }
        }

        if (touch.identifier === touchLookId) {
            const dx = touch.clientX - lastLookX;
            const dy = touch.clientY - lastLookY;

            yaw -= dx * TOUCH_SENSITIVITY;
            pitch -= dy * TOUCH_SENSITIVITY;

            const maxPitch = Math.PI / 2 - 0.15;
            pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
            camera.rotation.set(pitch, yaw, 0, "YXZ");

            lastLookX = touch.clientX;
            lastLookY = touch.clientY;
        }
    }
}, { passive: false });

window.addEventListener("touchend", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchMoveId) {
            touchMoveId = null;
            touchMoveX = 0;
            touchMoveY = 0;
            joystickBase.style.display = "none";
        }
        if (touch.identifier === touchLookId) {
            touchLookId = null;
        }
    }
});

// 敵 enemy.glb 読み込み
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
    if (activeDecoy) return false; 

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

    hideElement(mainMenu);
    hideElement(pauseMenu);
    hideElement(gameOverScreen);
    hideElement(clearScreen);

    if (inputMode === "PC") {
        if (touchUI) hideElement(touchUI);
        renderer.domElement.requestPointerLock();
    } else {
        if (touchUI) showElement(touchUI, "block");
    }
}

function showMainMenu() {
    gameState = STATES.MENU;
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock();

    hideElement(pauseMenu);
    hideElement(gameOverScreen);
    hideElement(clearScreen);
    showElement(mainMenu, "flex");
}

function triggerGameOver() { 
    gameState = STATES.GAMEOVER; 
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock(); 
    showElement(gameOverScreen, "flex"); 
}

function triggerClear() { 
    gameState = STATES.CLEAR; 
    setChaseEffect(false);
    if (document.pointerLockElement) document.exitPointerLock(); 
    showElement(clearScreen, "flex"); 
}

function setupUIEvents() {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) hideElement(startBtn);

    const modePcBtn = document.getElementById("mode-pc-btn");
    const modeTouchBtn = document.getElementById("mode-touch-btn");

    if (modePcBtn) modePcBtn.onclick = () => startGame("PC");
    if (modeTouchBtn) modeTouchBtn.onclick = () => startGame("TOUCH");

    const retryButtons = document.querySelectorAll("#retry-btn, #clear-retry-btn, #restart-btn, .retry-button, .restart-button");
    retryButtons.forEach(btn => {
        btn.onclick = () => startGame(inputMode);
    });

    const menuButtons = document.querySelectorAll("#menu-btn, #clear-menu-btn, #game-over-menu-btn, .menu-button");
    menuButtons.forEach(btn => {
        btn.onclick = () => showMainMenu();
    });

    const resumeButtons = document.querySelectorAll("#resume-btn, .resume-button");
    resumeButtons.forEach(btn => {
        btn.onclick = () => resumeGame();
    });
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", setupUIEvents);
} else {
    setupUIEvents();
}

function updateEnemies(delta) {
    if (gameState !== STATES.PLAYING) return;

    if (activeDecoy) {
        activeDecoy.timer -= delta;
        if (activeDecoy.timer <= 0) {
            scene.remove(activeDecoy.mesh);
            activeDecoy = null;
            showMessage("デコイの効果が切れた！");
        }
    }

    let isAnyEnemyChasing = false;

    for (const e of enemies) {
        if (!e.mesh) continue;

        const distToPlayer = Math.hypot(camera.position.x - e.mesh.position.x, camera.position.z - e.mesh.position.z);
        if (!isHiding && distToPlayer < 1.3) { triggerGameOver(); return; }

        let speed = ENEMY_SPEED * 0.55;
        let targetX = null, targetZ = null;

        if (activeDecoy) {
            speed = ENEMY_SPEED;
            targetX = activeDecoy.pos.x;
            targetZ = activeDecoy.pos.z;
        } else if (canSeePlayer(e.mesh)) {
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

    const isKeyMoving = keys["w"] || keys["s"] || keys["a"] || keys["d"];
    const isTouchMoving = (touchMoveX !== 0 || touchMoveY !== 0);
    const isMoving = isKeyMoving || isTouchMoving;

    // ダッシュ判定（TOUCHモードはトグル、PCモードはShiftキー保持）
    let isDashing = false;
    if (inputMode === "TOUCH") {
        if (isTouchDashActive && isMoving && stamina > 0) {
            isDashing = true;
        }
    } else {
        if (keys["shift"] && isMoving && stamina > 0) {
            isDashing = true;
        }
    }

    // スタミナの消費・回復処理
    if (isDashing) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN * delta);
        if (stamina <= 0 && inputMode === "TOUCH") {
            isTouchDashActive = false;
            updateDashButtonUI();
            showMessage("スタミナ切れ！", 1000);
        }
    } else {
        stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER * delta);
    }

    staminaBar.style.width = `${(stamina / MAX_STAMINA) * 100}%`;

    let speed = isDashing ? DASH_SPEED : MOVE_SPEED;
    const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const moveStep = speed * delta;
    let dx = 0, dz = 0;

    let kbX = 0, kbZ = 0;
    if (keys["w"]) kbZ -= 1;
    if (keys["s"]) kbZ += 1;
    if (keys["a"]) kbX -= 1;
    if (keys["d"]) kbX += 1;

    const kbLen = Math.hypot(kbX, kbZ);
    if (kbLen > 0) {
        kbX /= kbLen;
        kbZ /= kbLen;
    }

    let moveDirX = kbX;
    let moveDirZ = kbZ;

    if (inputMode === "TOUCH" && isTouchMoving) {
        moveDirX = touchMoveX;
        moveDirZ = touchMoveY;

        const touchLen = Math.hypot(moveDirX, moveDirZ);
        if (touchLen > 0) {
            const normalizedFactor = Math.min(1.0, touchLen);
            moveDirX = (moveDirX / touchLen) * normalizedFactor;
            moveDirZ = (moveDirZ / touchLen) * normalizedFactor;
        }
    }

    dx = (forwardX * (-moveDirZ) + rightX * moveDirX) * moveStep;
    dz = (forwardZ * (-moveDirZ) + rightZ * moveDirX) * moveStep;

    if (!hitWall(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
    if (!hitWall(camera.position.x, camera.position.z + dz)) camera.position.z += dz;

    for (const t of ticketItems) {
        if (t.active && camera.position.distanceTo(t.pos) < 1.2) {
            t.active = false; t.mesh.visible = false;
            hintTickets++; updateStatusUI();
            showMessage("📜 ヒントチケットを入手した！", 2000);
        }
    }

    for (const k of killItems) {
        if (k.active && camera.position.distanceTo(k.pos) < 1.2) {
            k.active = false; k.mesh.visible = false;
            killStock++; updateStatusUI();
            showMessage("💥 敵消去アイテムを入手した！", 2000);
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

    for (let z = 0; z < MAZE_HEIGHT; z++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[z] && maze[z][x] === "#") {
                minimapCtx.fillStyle = "#a89f91";
                minimapCtx.fillRect(x * TILE * scaleX, z * TILE * scaleZ, TILE * scaleX, TILE * scaleZ);
            }
        }
    }

    minimapCtx.fillStyle = "#00ff88";
    minimapCtx.fillRect(goalPos.x * scaleX - 4, goalPos.z * scaleZ - 4, 8, 8);

    lockers.forEach(l => {
        minimapCtx.fillStyle = "#2288ff";
        minimapCtx.fillRect(l.pos.x * scaleX - 3, l.pos.z * scaleZ - 3, 6, 6);
    });

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

    ticketItems.forEach(t => {
        if (t.active) {
            minimapCtx.fillStyle = "#dd88ff";
            minimapCtx.fillRect(t.pos.x * scaleX - 2, t.pos.z * scaleZ - 2, 4, 4);
        }
    });

    killItems.forEach(k => {
        if (k.active) {
            minimapCtx.fillStyle = "#ff0055";
            minimapCtx.fillRect(k.pos.x * scaleX - 2.5, k.pos.z * scaleZ - 2.5, 5, 5);
        }
    });

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
    killItems.forEach(k => { if (k.active) k.mesh.rotation.y += delta * 2; });

    updatePlayer(delta);
    updateEnemies(delta);
    drawMinimap();

    renderer.render(scene, camera);
}

buildMaze();
animate();
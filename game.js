/* =====================================================
   MAZE RUNNER — game.js
   Bridges the Emscripten WebAssembly module (maze.js)
   to the HTML/CSS UI and Canvas renderer.
   ===================================================== */

"use strict";

/* ══ Wait for Emscripten module to be ready ══════════════ */
Module.onRuntimeInitialized = function () {
  console.log("✅ WebAssembly module ready!");
  bindWasmFunctions();
  initUI();
};

/* ══ WASM function bindings ══════════════════════════════ */
let wasmStartGame, wasmMove, wasmCheckWin,
    wasmGetMoves, wasmGetElapsed, wasmGetRows,
    wasmGetCols,  wasmGetCell,   wasmIsWon;

function bindWasmFunctions() {
  wasmStartGame  = Module.cwrap("js_startGame",   null,   ["number"]);
  wasmMove       = Module.cwrap("js_movePlayer",  "number", ["number"]);
  wasmCheckWin   = Module.cwrap("js_checkWin",    "number", []);
  wasmGetMoves   = Module.cwrap("js_getMoves",    "number", []);
  wasmGetElapsed = Module.cwrap("js_getElapsed",  "number", []);
  wasmGetRows    = Module.cwrap("js_getRows",     "number", []);
  wasmGetCols    = Module.cwrap("js_getCols",     "number", []);
  wasmGetCell    = Module.cwrap("js_getMazeCell", "number", ["number","number"]);
  wasmIsWon      = Module.cwrap("js_isGameWon",   "number", []);
}

/* ══ DOM refs ════════════════════════════════════════════ */
const setupPanel   = document.getElementById("setupPanel");
const gamePanel    = document.getElementById("gamePanel");
const startBtn     = document.getElementById("startBtn");
const restartBtn   = document.getElementById("restartBtn");
const diffBtns     = document.querySelectorAll(".diff-btn");
const moveCount    = document.getElementById("moveCount");
const timerEl      = document.getElementById("timer");
const diffLabel    = document.getElementById("diffLabel");
const canvas       = document.getElementById("mazeCanvas");
const ctx          = canvas.getContext("2d");
const winOverlay   = document.getElementById("winOverlay");
const winMoves     = document.getElementById("winMoves");
const winTime      = document.getElementById("winTime");
const winLevel     = document.getElementById("winLevel");
const winRestart   = document.getElementById("winRestartBtn");
const winMenu      = document.getElementById("winMenuBtn");
const legend       = document.getElementById("legend");

/* ══ State ═══════════════════════════════════════════════ */
let selectedDiff   = 0;       // 0=Easy 1=Medium 2=Hard
let timerInterval  = null;
let isRunning      = false;

const LEVEL_NAMES  = ["EASY", "MEDIUM", "HARD"];
const CELL_COLORS  = {
  "#": { bg: "#1a1f26", stroke: "#2d333b" },   // wall
  " ": { bg: "#0d1117", stroke: null      },   // path
  "P": { bg: "#00ff88", stroke: null, glow: "rgba(0,255,136,.6)" }, // player
  "E": { bg: "#ff6b35", stroke: null, glow: "rgba(255,107,53,.6)"  }, // exit
};

/* ══ UI Init ═════════════════════════════════════════════ */
function initUI() {
  diffBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      diffBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedDiff = parseInt(btn.dataset.level);
    });
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", restartGame);
  winRestart.addEventListener("click", restartGame);
  winMenu.addEventListener("click",    goToMenu);

  document.addEventListener("keydown", handleKey);

  document.getElementById("btnUp").addEventListener("click",    () => move(0));
  document.getElementById("btnDown").addEventListener("click",  () => move(1));
  document.getElementById("btnLeft").addEventListener("click",  () => move(2));
  document.getElementById("btnRight").addEventListener("click", () => move(3));
}

/* ══ Game lifecycle ══════════════════════════════════════ */

function startGame() {
  wasmStartGame(selectedDiff);
  isRunning = true;

  setupPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  winOverlay.classList.add("hidden");
  legend.style.display = "flex";

  diffLabel.textContent = LEVEL_NAMES[selectedDiff];
  moveCount.textContent = "0";
  timerEl.textContent   = "0.0s";

  sizeCanvas();
  drawMaze();
  startTimer();
}

function restartGame() {
  stopTimer();
  winOverlay.classList.add("hidden");
  startGame();
}

function goToMenu() {
  stopTimer();
  isRunning = false;
  winOverlay.classList.add("hidden");
  gamePanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  legend.style.display = "none";
}

/* ══ Canvas sizing ════════════════════════════════════════ */

function sizeCanvas() {
  const rows = wasmGetRows();
  const cols = wasmGetCols();
  const max  = Math.min(window.innerWidth - 48, 600);
  const cell = Math.floor(max / Math.max(rows, cols));
  canvas.width  = cols * cell;
  canvas.height = rows * cell;
  canvas.dataset.cell = cell;
}

/* ══ Renderer ═════════════════════════════════════════════ */

function drawMaze() {
  const rows = wasmGetRows();
  const cols = wasmGetCols();
  const cell = parseInt(canvas.dataset.cell) || 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const code    = wasmGetCell(r, c);   // ASCII int
      const ch      = String.fromCharCode(code);
      const style   = CELL_COLORS[ch] || CELL_COLORS[" "];
      const x       = c * cell;
      const y       = r * cell;

      /* Cell background */
      ctx.fillStyle = style.bg;
      ctx.fillRect(x, y, cell, cell);

      /* Wall stroke */
      if (style.stroke) {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
      }

      /* Glow for player / exit */
      if (style.glow) {
        const r2 = cell / 2;
        const grd = ctx.createRadialGradient(
          x + r2, y + r2, 0,
          x + r2, y + r2, r2
        );
        grd.addColorStop(0, style.glow);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(x, y, cell, cell);

        /* Icon letter */
        ctx.fillStyle = ch === "P" ? "#000" : "#fff";
        ctx.font      = `bold ${Math.max(cell - 6, 8)}px 'Share Tech Mono', monospace`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ch, x + r2, y + r2);
      }
    }
  }
}

/* ══ Movement ════════════════════════════════════════════ */

function move(direction) {
  if (!isRunning) return;
  const moved = wasmMove(direction);
  if (moved) {
    moveCount.textContent = wasmGetMoves();
    drawMaze();
    if (wasmIsWon()) {
      onWin();
    }
  }
}

function handleKey(e) {
  const map = {
    ArrowUp: 0, KeyW: 0,
    ArrowDown: 1, KeyS: 1,
    ArrowLeft: 2, KeyA: 2,
    ArrowRight: 3, KeyD: 3,
  };
  if (map[e.code] !== undefined) {
    e.preventDefault();
    move(map[e.code]);
  }
}

/* ══ Timer ════════════════════════════════════════════════ */

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (!isRunning) return;
    const elapsed = wasmGetElapsed();
    timerEl.textContent = elapsed.toFixed(1) + "s";
  }, 100);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/* ══ Win screen ══════════════════════════════════════════ */

function onWin() {
  isRunning = false;
  stopTimer();
  const elapsed = wasmGetElapsed();
  winMoves.textContent = wasmGetMoves();
  winTime.textContent  = elapsed.toFixed(1) + "s";
  winLevel.textContent = LEVEL_NAMES[selectedDiff];
  timerEl.textContent  = elapsed.toFixed(1) + "s";
  winOverlay.classList.remove("hidden");
}

/* ══ Resize handler ══════════════════════════════════════ */
window.addEventListener("resize", () => {
  if (!gamePanel.classList.contains("hidden")) {
    sizeCanvas();
    drawMaze();
  }
});

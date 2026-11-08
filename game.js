"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#64b5f6", // J - pale blue
  "#ffb74d", // L - orange
  "#f06292", // Tuerca - pink
];

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // Tuerca (hueca en el centro)
];

// Paleta con más contraste para el fondo claro
const COLORS_LIGHT = [
  null,
  "#00acc1", // I
  "#f9a825", // O
  "#8e24aa", // T
  "#43a047", // S
  "#e53935", // Z
  "#1e88e5", // J
  "#fb8c00", // L
  "#d81b60", // Tuerca
];

const THEME_KEY = "tetris-theme";

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayScore = document.getElementById("overlay-score");
const restartBtn = document.getElementById("restart-btn");
const themeToggle = document.getElementById("theme-toggle");
const recordForm = document.getElementById("record-form");
const recordMsg = document.getElementById("record-msg");
const nameInput = document.getElementById("name-input");
const recordsSection = document.getElementById("records");
const recordsList = document.getElementById("records-list");
const recordsExtra = document.getElementById("records-extra");
const resetRecordsBtn = document.getElementById("reset-records-btn");

const RECORDS_KEY = "tetris-records";
const MAX_RECORDS = 5;

let theme = "dark",
  gridColor = "#22222e";
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo = 0,
  gameBestCombo = 0,
  atStart = true,
  pendingRecord = false;
let records = loadRecords();

// ---- Records (localStorage) ----
function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  const rec = emptyRecords();
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (data && Array.isArray(data.top)) {
      rec.top = data.top
        .filter((e) => e && Number.isFinite(e.score))
        .map((e) => ({ name: String(e.name || "Anónimo").slice(0, 12), score: e.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS);
      rec.bestCombo = Number(data.bestCombo) || 0;
      rec.maxLines = Number(data.maxLines) || 0;
    }
  } catch (e) {
    /* almacenamiento no disponible o datos corruptos */
  }
  return rec;
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    /* ignorar */
  }
}

// posición (0-based) que ocuparía la puntuación en el top, o -1 si no entra
function recordRank(s) {
  if (s <= 0) return -1;
  const idx = records.top.findIndex((e) => s > e.score);
  if (idx !== -1) return idx;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

// highlightIdx: fila a resaltar; preview: fila provisional (aún sin nombre)
function renderRecords(highlightIdx = -1, preview = null) {
  const rows = records.top.map((e) => ({ ...e }));
  if (preview) rows.splice(preview.idx, 0, { name: "Tú…", score: preview.score });
  recordsList.replaceChildren();
  for (let i = 0; i < MAX_RECORDS; i++) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const right = document.createElement("span");
    const row = rows[i];
    if (row) {
      left.textContent = `${i + 1}. ${row.name}`;
      right.textContent = row.score.toLocaleString();
    } else {
      li.className = "empty";
      left.textContent = `${i + 1}. ---`;
    }
    if (i === highlightIdx) li.classList.add("highlight");
    li.append(left, right);
    recordsList.append(li);
  }
  recordsExtra.textContent = `Mejor combo: ${records.bestCombo} · Máx. líneas: ${records.maxLines}`;
}

function updateStatRecords() {
  let changed = false;
  if (gameBestCombo > records.bestCombo) {
    records.bestCombo = gameBestCombo;
    changed = true;
  }
  if (lines > records.maxLines) {
    records.maxLines = lines;
    changed = true;
  }
  if (changed) saveRecords();
}

function submitRecord() {
  if (!pendingRecord) return;
  pendingRecord = false;
  const idx = recordRank(score);
  const name = nameInput.value.trim().slice(0, 12) || "Anónimo";
  records.top.splice(idx, 0, { name, score });
  records.top = records.top.slice(0, MAX_RECORDS);
  saveRecords();
  recordForm.classList.add("hidden");
  renderRecords(idx);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length,
    cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    gameBestCombo = Math.max(gameBestCombo, combo);
  } else {
    combo = 0;
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return;
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (theme === "light" ? COLORS_LIGHT : COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = "GAME OVER";
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  updateStatRecords();
  const rank = recordRank(score);
  recordsSection.classList.remove("hidden");
  resetRecordsBtn.classList.remove("hidden");
  restartBtn.textContent = "Reiniciar";
  if (rank !== -1) {
    pendingRecord = true;
    recordMsg.textContent = rank === 0 ? "¡Nuevo récord! Escribe tu nombre" : `¡Top ${rank + 1}! Escribe tu nombre`;
    recordForm.classList.remove("hidden");
    nameInput.value = "";
    renderRecords(rank, { idx: rank, score });
    overlay.classList.remove("hidden");
    nameInput.focus();
  } else {
    renderRecords();
    overlay.classList.remove("hidden");
  }
}

function showStartScreen() {
  atStart = true;
  paused = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = "TETRIS";
  overlayScore.textContent = "";
  recordForm.classList.add("hidden");
  recordsSection.classList.remove("hidden");
  resetRecordsBtn.classList.remove("hidden");
  restartBtn.textContent = "Jugar";
  renderRecords();
  overlay.classList.remove("hidden");
}

function togglePause() {
  if (gameOver || atStart) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add("hidden");
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = "PAUSA";
    overlayScore.textContent = "";
    recordForm.classList.add("hidden");
    recordsSection.classList.add("hidden");
    resetRecordsBtn.classList.add("hidden");
    restartBtn.textContent = "Reiniciar";
    overlay.classList.remove("hidden");
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function applyTheme(name) {
  theme = name === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "light" ? "☾ Oscuro" : "☀ Claro";
  gridColor = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* almacenamiento no disponible */
  }
  // repinta de inmediato: en pausa o game over el bucle no está activo
  if (current) {
    draw();
    drawNext();
  }
}

function init() {
  submitRecord(); // guarda un récord pendiente si se reinicia sin pulsar "Guardar"
  atStart = false;
  combo = 0;
  gameBestCombo = 0;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case "ArrowLeft":
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case "ArrowRight":
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate();
      break;
    case "Space":
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener("click", () => {
  init();
  restartBtn.blur(); // evita que Space reactive el botón
});

recordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitRecord();
  restartBtn.focus();
});

resetRecordsBtn.addEventListener("click", () => {
  if (!confirm("¿Borrar todos los records?")) return;
  records = emptyRecords();
  saveRecords();
  if (pendingRecord) {
    // la puntuación actual vuelve a ser candidata al top
    const rank = recordRank(score);
    if (rank === -1) {
      pendingRecord = false;
      recordForm.classList.add("hidden");
      renderRecords();
    } else {
      renderRecords(rank, { idx: rank, score });
    }
  } else {
    renderRecords();
  }
  resetRecordsBtn.blur();
});

themeToggle.addEventListener("click", () => {
  applyTheme(theme === "dark" ? "light" : "dark");
  themeToggle.blur(); // evita que Space reactive el botón
});

let savedTheme = null;
try {
  savedTheme = localStorage.getItem(THEME_KEY);
} catch (e) {
  /* ignorar */
}
applyTheme(savedTheme || "dark");

init();
showStartScreen();

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

const RECORDS_KEY = "tetris-records";
const BESTS_KEY = "tetris-bests";
const MAX_RECORDS = 5;
const MAX_NAME_LEN = 12;
const DEFAULT_NAME = "Anónimo";

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
const pauseMenu = document.getElementById("pause-menu");
const resumeBtn = document.getElementById("resume-btn");
const pauseRestartBtn = document.getElementById("pause-restart-btn");
const controlsBtn = document.getElementById("controls-btn");
const pauseControls = document.getElementById("pause-controls");
const levelRow = document.getElementById("level-row");
const levelDownBtn = document.getElementById("level-down");
const levelUpBtn = document.getElementById("level-up");
const startLevelEl = document.getElementById("start-level-value");

const START_LEVEL_KEY = "tetris-start-level";
const MAX_START_LEVEL = 10;
// Elementos navegables del menú de pausa (orden visual)
const menuItems = [resumeBtn, pauseRestartBtn, controlsBtn, levelRow];
let menuIndex = 0;
let startLevel = 1;
let baseLevel = 1; // nivel inicial de la partida en curso (fijado en init)
const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start-btn");
const startRecords = document.getElementById("start-records");
const startBests = document.getElementById("start-bests");
const startResetBtn = document.getElementById("start-reset-btn");
const gameoverExtra = document.getElementById("gameover-extra");
const nameEntry = document.getElementById("name-entry");
const nameInput = document.getElementById("name-input");
const nameSaveBtn = document.getElementById("name-save-btn");
const overRecords = document.getElementById("over-records");
const overBests = document.getElementById("over-bests");
const overResetBtn = document.getElementById("over-reset-btn");

let theme = "dark",
  gridColor = "#22222e";
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// Records: combo = piezas consecutivas que limpian líneas
let combo = 0,
  maxComboThisGame = 0,
  started = false,
  pendingRecord = null, // récord de la partida actual aún sin nombre guardado
  savedIdx = -1; // posición resaltada tras guardar

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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(baseLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
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
  if (clearLines()) {
    combo++;
    maxComboThisGame = Math.max(maxComboThisGame, combo);
  } else {
    combo = 0;
  }
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
  if (!board || !current) return;
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
  overlay.classList.remove("hidden");
  showGameOverRecords();
}

// ---- Records (localStorage) ----
function loadRecords() {
  try {
    const list = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.name === "string" && Number.isFinite(r.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch (e) {
    return [];
  }
}

function saveRecords(list) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
  } catch (e) {
    /* almacenamiento no disponible */
  }
}

function loadBests() {
  try {
    const b = JSON.parse(localStorage.getItem(BESTS_KEY));
    return {
      maxCombo: Number.isFinite(b && b.maxCombo) ? b.maxCombo : 0,
      maxLines: Number.isFinite(b && b.maxLines) ? b.maxLines : 0,
    };
  } catch (e) {
    return { maxCombo: 0, maxLines: 0 };
  }
}

function saveBests(b) {
  try {
    localStorage.setItem(BESTS_KEY, JSON.stringify(b));
  } catch (e) {
    /* almacenamiento no disponible */
  }
}

// posición que ocuparía una puntuación (empates van después), o -1 si no entra
function rankFor(list, s) {
  if (s <= 0) return -1;
  let i = list.findIndex((r) => r.score < s);
  if (i === -1) i = list.length;
  return i < MAX_RECORDS ? i : -1;
}

function renderRecords(tbody, list, hlIdx) {
  tbody.textContent = "";
  if (!list.length) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 4;
    td.className = "records-empty";
    td.textContent = "Sin records todavía";
    return;
  }
  list.forEach((r, i) => {
    const tr = tbody.insertRow();
    if (i === hlIdx) tr.className = "highlight";
    tr.insertCell().textContent = i + 1;
    tr.insertCell().textContent = r.name;
    tr.insertCell().textContent = r.score.toLocaleString();
    tr.insertCell().textContent = Number.isFinite(r.lines) ? r.lines : "-";
  });
}

function renderBests(el, b) {
  el.textContent = `Mejor combo: ${b.maxCombo} · Líneas máx.: ${b.maxLines}`;
}

function refreshRecordViews() {
  const list = loadRecords();
  const bests = loadBests();
  renderRecords(startRecords, list, -1);
  renderBests(startBests, bests);
  let shown = list;
  let hl = savedIdx;
  if (pendingRecord && rankFor(list, pendingRecord.score) >= 0) {
    hl = rankFor(list, pendingRecord.score);
    shown = list.slice();
    shown.splice(hl, 0, { ...pendingRecord, name: nameInput.value.trim() || "..." });
    shown = shown.slice(0, MAX_RECORDS);
  }
  renderRecords(overRecords, shown, hl);
  renderBests(overBests, bests);
}

function showGameOverRecords() {
  // actualiza los mejores de combo y líneas aunque no entre en el top
  const bests = loadBests();
  bests.maxLines = Math.max(bests.maxLines, lines);
  bests.maxCombo = Math.max(bests.maxCombo, maxComboThisGame);
  saveBests(bests);

  const list = loadRecords();
  savedIdx = -1;
  pendingRecord =
    rankFor(list, score) >= 0
      ? { name: "", score, lines, level, combo: maxComboThisGame, date: Date.now() }
      : null;
  nameInput.value = "";
  nameEntry.classList.toggle("hidden", !pendingRecord);
  gameoverExtra.classList.remove("hidden");
  refreshRecordViews();
  if (pendingRecord) nameInput.focus();
}

function commitRecord() {
  if (!pendingRecord) return;
  const rec = { ...pendingRecord, name: nameInput.value.trim().slice(0, MAX_NAME_LEN) || DEFAULT_NAME };
  const list = loadRecords();
  savedIdx = rankFor(list, rec.score);
  // si otra pestaña lo dejó fuera del top, no se guarda
  if (savedIdx >= 0) {
    list.splice(savedIdx, 0, rec);
    saveRecords(list.slice(0, MAX_RECORDS));
  }
  pendingRecord = null;
  nameEntry.classList.add("hidden");
  nameInput.blur();
  refreshRecordViews();
}

function resetRecords() {
  if (!confirm("¿Borrar todos los records, el mejor combo y las líneas máximas?")) return;
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(BESTS_KEY);
  } catch (e) {
    /* ignorar */
  }
  savedIdx = -1;
  refreshRecordViews();
}

function showStartScreen() {
  refreshRecordViews();
  startScreen.classList.remove("hidden");
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add("hidden");
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    setControlsOpen(false);
    setMenuIndex(0);
    pauseMenu.classList.remove("hidden");
  }
}

// ---- Menú de pausa ----
function setMenuIndex(i) {
  menuIndex = (i + menuItems.length) % menuItems.length;
  menuItems.forEach((el, idx) => el.classList.toggle("selected", idx === menuIndex));
}

function setControlsOpen(open) {
  pauseControls.classList.toggle("hidden", !open);
  controlsBtn.setAttribute("aria-expanded", String(open));
}

function setStartLevel(n) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, n));
  startLevelEl.textContent = startLevel;
  try {
    localStorage.setItem(START_LEVEL_KEY, String(startLevel));
  } catch (e) {
    /* almacenamiento no disponible */
  }
}

function activateMenuItem(el) {
  if (el === resumeBtn) togglePause();
  else if (el === pauseRestartBtn) init();
  else if (el === controlsBtn) setControlsOpen(pauseControls.classList.contains("hidden"));
}

function handlePauseKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "NumpadEnter", "Space", "Tab"].includes(e.code)) return;
  e.preventDefault();
  if (e.repeat) return; // evita que un auto-repeat de la partida se cuele en el menú
  switch (e.code) {
    case "ArrowUp":
      setMenuIndex(menuIndex - 1);
      break;
    case "ArrowDown":
      setMenuIndex(menuIndex + 1);
      break;
    case "ArrowLeft":
    case "ArrowRight":
      if (menuItems[menuIndex] === levelRow) setStartLevel(startLevel + (e.code === "ArrowRight" ? 1 : -1));
      break;
    case "Enter":
    case "NumpadEnter":
      if (!e.repeat) activateMenuItem(menuItems[menuIndex]);
      break;
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
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  pauseMenu.classList.add("hidden");
  dropAccum = 0;
  combo = 0;
  maxComboThisGame = 0;
  pendingRecord = null;
  savedIdx = -1;
  gameoverExtra.classList.add("hidden");
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (!started) return;
  if (e.code === "KeyP" || e.code === "Escape") {
    // el keydown que cierra el menú se consume aquí y no llega al juego
    if (!e.repeat) togglePause();
    return;
  }
  if (paused) {
    handlePauseKey(e);
    return;
  }
  if (gameOver) return;
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
  commitRecord(); // no pierde el récord si se reinicia sin guardar
  init();
  restartBtn.blur();
});

startBtn.addEventListener("click", () => {
  started = true;
  startScreen.classList.add("hidden");
  startBtn.blur();
  init();
});

nameSaveBtn.addEventListener("click", () => {
  commitRecord();
  nameSaveBtn.blur();
});
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing) commitRecord();
});
nameInput.addEventListener("input", () => {
  if (pendingRecord) refreshRecordViews();
});

for (const btn of [startResetBtn, overResetBtn]) {
  btn.addEventListener("click", () => {
    resetRecords();
    btn.blur();
  });
}

themeToggle.addEventListener("click", () => {
  applyTheme(theme === "dark" ? "light" : "dark");
  themeToggle.blur(); // evita que Space reactive el botón
});

menuItems.forEach((el, idx) => {
  el.addEventListener("mouseenter", () => setMenuIndex(idx));
});
[resumeBtn, pauseRestartBtn, controlsBtn].forEach((btn) =>
  btn.addEventListener("click", () => {
    activateMenuItem(btn);
    btn.blur(); // evita que Space reactive el botón
  })
);
levelDownBtn.addEventListener("click", () => {
  setStartLevel(startLevel - 1);
  levelDownBtn.blur();
});
levelUpBtn.addEventListener("click", () => {
  setStartLevel(startLevel + 1);
  levelUpBtn.blur();
});
restartBtn.addEventListener("click", () => restartBtn.blur());

try {
  const savedLevel = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  if (savedLevel) startLevel = Math.min(MAX_START_LEVEL, Math.max(1, savedLevel));
} catch (e) {
  /* ignorar */
}
startLevelEl.textContent = startLevel;

let savedTheme = null;
try {
  savedTheme = localStorage.getItem(THEME_KEY);
} catch (e) {
  /* ignorar */
}
applyTheme(savedTheme || "dark");

// el juego no arranca hasta pulsar "Jugar"
showStartScreen();

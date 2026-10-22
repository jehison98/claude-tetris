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
const SKIN_KEY = "tetris-skin";

// Colores según tema claro/oscuro de la UI
function themeColors(skinDef) {
  return theme === "light" && skinDef.colorsLight ? skinDef.colorsLight : skinDef.colors;
}

// Trazo de rectángulo redondeado (sin depender de context.roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  // Bloques cuadrados, colores planos (estilo original)
  retro: {
    label: "Retro",
    colors: COLORS,
    colorsLight: COLORS_LIGHT,
    boardBg: null, // null = fondo del canvas por CSS
    grid: null, // null = variable CSS --grid
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = themeColors(this)[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // brillo superior
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  // Fondo negro y resplandor
  neon: {
    label: "Neón",
    colors: [null, "#00f0ff", "#fff700", "#d500f9", "#39ff14", "#ff1744", "#2979ff", "#ff9100", "#ff4081"],
    boardBg: "#000000",
    grid: "#1a1a26",
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 3;
      const py = y * size + 3;
      const s = size - 6;
      context.save();
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px, py, s, s);
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.35;
      context.fillRect(px, py, s, s);
      context.restore(); // restaura shadow y alpha
    },
  },
  // Colores suaves y esquinas redondeadas
  pastel: {
    label: "Pastel",
    colors: [null, "#a8e6ef", "#fff2b3", "#d9b8f0", "#b9ecc3", "#f7b8b8", "#b3d4fc", "#ffd3a6", "#f9b8d0"],
    colorsLight: [null, "#7fd0dc", "#f5d96b", "#bd93e0", "#8fd9a0", "#ef9a9a", "#86b8f0", "#f5b87a", "#f08cb2"],
    boardBg: null,
    grid: null,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const px = x * size + 2;
      const py = y * size + 2;
      const s = size - 4;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = themeColors(this)[colorIndex];
      roundedRectPath(context, px, py, s, s, 7);
      context.fill();
      // reflejo suave
      context.fillStyle = "rgba(255,255,255,0.35)";
      roundedRectPath(context, px + 4, py + 3, s - 8, 5, 2.5);
      context.fill();
      context.restore();
    },
  },
  // Textura de píxeles 3x3 con borde biselado
  pixel: {
    label: "Pixel art",
    colors: COLORS,
    colorsLight: COLORS_LIGHT,
    boardBg: null,
    grid: null,
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const px = x * size + 1;
      const py = y * size + 1;
      const s = size - 2;
      const cell = s / 3;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = themeColors(this)[colorIndex];
      context.fillRect(px, py, s, s);
      // cuadrícula 3x3 alternando píxeles claros y oscuros
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if ((r + c) % 2 === 0) continue;
          context.fillStyle = r === 1 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)";
          context.fillRect(px + c * cell, py + r * cell, cell, cell);
        }
      }
      // bisel: claro arriba/izquierda, oscuro abajo/derecha
      context.fillStyle = "rgba(255,255,255,0.55)";
      context.fillRect(px, py, s, 3);
      context.fillRect(px, py, 3, s);
      context.fillStyle = "rgba(0,0,0,0.45)";
      context.fillRect(px, py + s - 3, s, 3);
      context.fillRect(px + s - 3, py, 3, s);
      context.restore();
    },
  },
};

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
const skinSelect = document.getElementById("skin-select");

let skin = "retro";
let theme = "dark",
  gridColor = "#22222e";
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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

// Delegado: cada skin define cómo se dibuja un bloque
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[skin].drawBlock(context, x, y, colorIndex, size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || gridColor;
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
  if (SKINS[skin].boardBg) {
    ctx.fillStyle = SKINS[skin].boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  if (SKINS[skin].boardBg) {
    nextCtx.fillStyle = SKINS[skin].boardBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = "PAUSA";
    overlayScore.textContent = "";
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

function applySkin(name) {
  skin = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : "retro";
  document.documentElement.dataset.skin = skin;
  skinSelect.value = skin;
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch (e) {
    /* almacenamiento no disponible */
  }
  if (current) {
    draw();
    drawNext();
  }
}

function init() {
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

restartBtn.addEventListener("click", init);

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

for (const key of Object.keys(SKINS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = SKINS[key].label;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener("change", () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas/Space cambien la opción
});
// Si el select conserva el foco (abrir y cerrar sin cambiar), las teclas de juego no deben manejarlo
skinSelect.addEventListener("keydown", (e) => {
  if (e.code.startsWith("Arrow") || e.code === "Space") {
    e.preventDefault();
    skinSelect.blur();
  }
});
let savedSkin = null;
try {
  savedSkin = localStorage.getItem(SKIN_KEY);
} catch (e) {
  /* ignorar */
}
applySkin(savedSkin);

init();

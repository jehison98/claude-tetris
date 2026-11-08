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

const NEON_COLORS = [
  null,
  "#00f0ff", "#fff200", "#c400ff", "#39ff14", "#ff1744", "#2979ff", "#ff9100", "#ff2d95",
];

const PASTEL_COLORS = [
  null,
  "#a8e6ef", "#fff0a8", "#d9b8f0", "#b5ead7", "#ffb3ba", "#b5d0ff", "#ffd8a8", "#ffc1dd",
];
const PASTEL_COLORS_LIGHT = [
  null,
  "#7fd3e0", "#f7dd7a", "#c39be6", "#8fdcbc", "#ff94a0", "#8fb4f5", "#f9bd78", "#f79bc6",
];

// Cada skin: paleta por tema + función que dibuja un bloque en (px, py) con lado `s`
const SKINS = {
  retro: {
    label: "Retro",
    colors: (t) => (t === "light" ? COLORS_LIGHT : COLORS),
    draw(context, px, py, s, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s - 2, s - 2);
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    label: "Neon",
    colors: () => NEON_COLORS,
    draw(context, px, py, s, color) {
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, s - 6, s - 6);
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 3, py + 3, s - 6, s - 6);
      context.shadowBlur = 0;
    },
  },
  pastel: {
    label: "Pastel",
    colors: (t) => (t === "light" ? PASTEL_COLORS_LIGHT : PASTEL_COLORS),
    draw(context, px, py, s, color) {
      context.fillStyle = color;
      context.beginPath();
      context.roundRect(px + 1.5, py + 1.5, s - 3, s - 3, s * 0.3);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.35)";
      context.beginPath();
      context.roundRect(px + s * 0.2, py + s * 0.16, s * 0.4, s * 0.14, s * 0.07);
      context.fill();
    },
  },
  pixel: {
    label: "Pixel art",
    colors: (t) => (t === "light" ? COLORS_LIGHT : COLORS),
    draw(context, px, py, s, color) {
      const n = 6;
      const u = s / n;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let shade = null;
          if (i === 0 || j === 0) shade = "rgba(255,255,255,0.35)";
          else if (i === n - 1 || j === n - 1) shade = "rgba(0,0,0,0.4)";
          else if ((i + j) % 2 === 0) shade = "rgba(0,0,0,0.12)";
          if (!shade) continue;
          context.fillStyle = shade;
          context.fillRect(px + j * u, py + i * u, u, u);
        }
      }
    },
  },
};

const THEME_KEY = "tetris-theme";
const SKIN_KEY = "tetris-skin";

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

let skinName = "retro";
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[skinName];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors(theme)[colorIndex]);
  context.restore();
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
  skinName = SKINS[name] ? name : "retro";
  document.documentElement.dataset.skin = skinName;
  skinSelect.value = skinName;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
  try {
    localStorage.setItem(SKIN_KEY, skinName);
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

for (const [key, skin] of Object.entries(SKINS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = skin.label;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener("change", () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas/Space cambien la selección
});

let savedSkin = null;
try {
  savedSkin = localStorage.getItem(SKIN_KEY);
} catch (e) {
  /* ignorar */
}
applySkin(savedSkin || "retro");

init();

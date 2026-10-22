# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no `package.json`, no build, no tests, no linter. README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, loaded as a classic script with `'use strict'`; DOM elements are fetched by id at the top, so ids in `index.html` and `game.js` must stay in sync).

Key points in `game.js` that span multiple functions:

- **State is module-level globals** (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) declared in one `let` line and reset in `init()`. Restart button calls `init()` again.
- **Board** is a `ROWS×COLS` matrix of `0` or a piece-type index 1–8 (8 = hollow 3×3 "Tuerca" ring); the same index selects the entry in `COLORS` and `PIECES`, and is baked into the shape cells (e.g. T is filled with `3`).
- **Piece lifecycle**: `spawn()` promotes `next` to `current`, rolls a new `next` (pure `Math.random`, no 7-bag), triggers `endGame()` if the spawn position collides, and redraws the preview. `lockPiece()` = `merge()` → `clearLines()` → `spawn()`; reached from gravity in `loop`, `softDrop`, and `hardDrop`.
- **Game loop**: `requestAnimationFrame` `loop` accumulates `dropAccum` against `dropInterval` (`max(100, 1000 - (level-1)*90)`, recomputed in `clearLines`). Pause/game over use `cancelAnimationFrame(animId)`; resuming resets `lastTime` and calls `loop` directly. `init()` also cancels any prior frame to avoid double loops.
- **Rotation**: `rotateCW` + simple horizontal kicks `[0,-1,1,-2,2]` in `tryRotate` (not SRS; no floor kicks).
- **Rendering**: `draw()` repaints grid, board, ghost (alpha 0.2 via `ghostY()`), and current piece each frame; `drawNext()` only runs on spawn.
- **Records**: `init()` is no longer called on load; `showStartScreen()` shows `#start-screen` and the "Jugar" button sets `started = true` and calls `init()`. The global keydown ignores everything until `started` and while an `<input>` has focus. `endGame()` → `showGameOverRecords()` updates `tetris-bests` (`maxCombo`, `maxLines`) and, if `score > 0` enters the top 5 (`tetris-records`), sets `pendingRecord` and shows the name input; `commitRecord()` saves it (restart without saving stores it as "Anónimo"). `combo` counts consecutive locks that clear lines (tracked in `lockPiece`, `clearLines` returns the cleared count). Names are rendered with `textContent` only.
- If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`).

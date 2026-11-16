// Menu geometry shared by the renderer (which draws the buttons) and the main
// loop (which answers clicks on them): the title menu, the level-select grid
// and the How to Play panel. One source of rects, so a click never misses a
// button the player can see.

import { FIELD, LEVELS } from './config.js';

export const TITLE_OPTIONS = [
  { id: 'start', label: 'START RUN', hint: 'From First Light to the Core' },
  { id: 'endless', label: 'ENDLESS DRIFT', hint: 'Walls without end · own best' },
  { id: 'levels', label: 'LEVEL SELECT', hint: 'Replay any unlocked wall' },
  { id: 'howto', label: 'HOW TO PLAY', hint: 'Controls, powerups and wraiths' },
];

const MENU = { width: 520, height: 50, gap: 12, top: 344 };

/** The clickable rect of a title-menu option, by index. */
export function titleOptionRect(index) {
  return {
    x: (FIELD.width - MENU.width) / 2,
    y: MENU.top + index * (MENU.height + MENU.gap),
    w: MENU.width,
    h: MENU.height,
  };
}

const GRID = { cols: 4, cardW: 236, cardH: 168, gapX: 24, gapY: 24, top: 190 };

/** The clickable rect of a level card in the select grid, by level (1-based). */
export function levelCardRect(level) {
  const index = level - 1;
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const gridWidth = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
  return {
    x: (FIELD.width - gridWidth) / 2 + col * (GRID.cardW + GRID.gapX),
    y: GRID.top + row * (GRID.cardH + GRID.gapY),
    w: GRID.cardW,
    h: GRID.cardH,
  };
}

export const LEVELS_BACK_RECT = { x: (FIELD.width - 320) / 2, y: 588, w: 320, h: 52 };
export const HELP_BACK_RECT = { x: (FIELD.width - 320) / 2, y: 612, w: 320, h: 52 };

/** Which rect of a list holds a point, or -1. */
export function hitTestRects(rects, x, y) {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

/** How many level cards the grid shows. */
export function levelCount() {
  return LEVELS;
}

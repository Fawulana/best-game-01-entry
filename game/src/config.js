// LUMENBREAK — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. A neon breakout game: a paddle shatters crystal bricks, catches
// falling powerups, and clears six hand-built levels to win.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const LIVES = 3;
export const MAX_LIVES = 5;
export const LEVEL_COUNT = 6;

export const PADDLE = {
  width: 128,
  wideWidth: 196,
  height: 16,
  y: 678,
  speed: 780,
  laserSeconds: 10,
  wideSeconds: 12,
};

export const BALL = {
  radius: 8,
  speed: 540,
  speedPerLevel: 18,
  maxSpeed: 760,
  /** The widest launch/bounce angle off the paddle, in radians from straight up. */
  maxAngle: 1.05,
  slowSeconds: 8,
  slowFactor: 0.68,
};

/** The brick grid: 14 columns of 76x26 bricks, 8 px apart horizontally, 10 vertically. */
export const BRICK = {
  cols: 14,
  width: 76,
  height: 26,
  gapX: 8,
  gapY: 10,
  top: 104,
  left: 56,
};

/** A falling powerup: its size, fall speed and the chance a plain brick drops one. */
export const POWERUP = { size: 26, fallSpeed: 150, dropChance: 0.12 };

/** Score: each brick is worth 50 times the combo multiplier; the multiplier climbs one
 *  tier every COMBO.perTier breaks and caps at COMBO.maxMultiplier. */
export const SCORE = { brick: 50, perTier: 5, maxMultiplier: 5 };

/** How many balls, powerups, bolts, particles and floating texts can exist at once;
 *  every pool is allocated once, at boot, and reused. */
export const POOL = { balls: 4, powerups: 8, bolts: 8, particles: 240, floaters: 16 };

export const PALETTE = {
  backdrop: '#070a18',
  skyTop: '#131a3a',
  skyBottom: '#070a18',
  star: '#cdd6ff',
  text: '#eef2ff',
  muted: '#9aa3c0',
  gold: '#ffc53d',
  paddle: '#e8f6ff',
  paddleGlow: '#37c8e0',
  ball: '#ffffff',
  ballGlow: '#4fd8ff',
  brick1: '#37e0c8',
  brick2: '#ff5da2',
  brick3: '#ffc53d',
  steel: '#8a93a6',
  explosive: '#ff7a1a',
  bonus: '#b78cff',
  panel: '#12172e',
  panelEdge: '#2c3a6e',
  danger: '#ff5d5d',
  heal: '#5dff8f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenbreak.best';

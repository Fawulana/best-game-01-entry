// LUMENBREAK tuning: every number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. A neon breakout: shatter crystal walls, chain ember bricks, catch
// falling powerups, and clear all six walls to win.

export const FIELD = { width: 1280, height: 720, top: 92 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 116,
  height: 16,
  y: 668,
  speed: 760,
  wideWidth: 188,
  wideSeconds: 12,
  laserSeconds: 10,
};

export const BALL = {
  radius: 7,
  baseSpeed: 430,
  maxSpeed: 820,
  speedPerLevel: 26,
  speedPerBrick: 1.6,
  slowFactor: 0.62,
  slowSeconds: 8,
};

export const BRICK = {
  cols: 12,
  rows: 8,
  width: 88,
  height: 26,
  gapX: 8,
  gapY: 8,
  top: 104,
  /** Points for breaking one brick, before the combo multiplier. */
  points: 50,
  hardPoints: 100,
  emberPoints: 80,
  /** A hit that only cracks a hard brick still scores a little. */
  crackPoints: 25,
  /** Chance a broken brick drops a powerup. */
  dropChance: 0.24,
};

export const LIVES = 3;
export const MAX_LIVES = 5;
export const LEVELS = 6;

/** Combo: consecutive bricks broken since the ball last touched the paddle. */
export const COMBO = { maxMultiplier: 5 };

export const POWERUP = {
  size: 30,
  fallSpeed: 185,
  kinds: ['W', 'M', 'L', 'S', '+'],
};

export const LASER = { width: 5, height: 16, speed: 900, cooldown: 0.22 };

/** How many balls, bricks, powerups, bolts and particles can exist at once. */
export const POOL = { balls: 8, powerups: 12, bolts: 24, particles: 320 };

export const PALETTE = {
  backdrop: '#070312',
  skyTop: '#150a33',
  skyBottom: '#070312',
  ground: '#1c0f38',
  text: '#f2efff',
  muted: '#9d94c4',
  gold: '#ffd75e',
  paddle: '#39e6ff',
  paddleCore: '#e8fbff',
  ball: '#ffffff',
  ballTrail: '#39e6ff',
  steel: '#8f9bb3',
  steelEdge: '#d7deea',
  ember: '#ff7a2f',
  emberCore: '#ffc46b',
  // Crystal tiers, dimmest to brightest.
  tier: ['#7c5cff', '#b45cff', '#ff5ce1', '#ff5c7a', '#ffb35c'],
  tierEdge: ['#a78bff', '#d18cff', '#ff8ce8', '#ff8ca0', '#ffd28c'],
  power: { W: '#39e6ff', M: '#ff5ce1', L: '#ffd75e', S: '#7dff9e', '+': '#ff5c7a' },
  banner: '#ffd75e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenbreak.best';

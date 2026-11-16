// LUMENBREAK tuning: every number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. A neon breakout with teeth: shatter crystal walls, chain ember
// bricks, dodge void shards, hunt three kinds of crystal wraith, catch eight falling
// powerups, and break two wardens to win. Eight themed walls, saved progress, stars.

export const FIELD = { width: 1280, height: 720, top: 92 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 116,
  height: 16,
  y: 668,
  speed: 780,
  wideWidth: 188,
  wideSeconds: 12,
  laserSeconds: 10,
  narrowWidth: 76,
  narrowSeconds: 6,
};

export const BALL = {
  radius: 7,
  baseSpeed: 430,
  maxSpeed: 840,
  speedPerLevel: 24,
  speedPerBrick: 1.5,
  slowFactor: 0.62,
  slowSeconds: 8,
  fireballSeconds: 9,
  catchSeconds: 10,
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
export const LEVELS = 8;

/** Combo: consecutive bricks broken since the ball last touched the paddle. */
export const COMBO = { maxMultiplier: 8, feverAt: 5 };

export const POWERUP = {
  size: 30,
  fallSpeed: 185,
  kinds: ['W', 'M', 'L', 'S', 'F', 'C', 'N', '+'],
};

export const LASER = { width: 5, height: 16, speed: 900, cooldown: 0.22 };

/** Crystal wraiths: drifters patrol, weavers dive in sine waves, spitters shoot shards. */
export const ENEMY = {
  size: 34,
  drifterSpeed: 120,
  weaverSpeed: 55,
  weaverSway: 90,
  spitterFireSeconds: 2.4,
  drifterPoints: 150,
  weaverPoints: 200,
  spitterPoints: 300,
  dropChance: 0.35,
};

/** Falling void shards: a shard that hits the paddle shrinks it and breaks the combo. */
export const SHARD = { width: 12, height: 22, fallSpeed: 240 };

/** The two wardens: the Ember Warden guards level 4, the Core Warden level 8. */
export const BOSS = {
  ember: { name: 'WARDEN OF EMBERS', hp: 14, width: 220, height: 54, speed: 150, points: 2000, coreRadius: 20 },
  core: { name: 'THE CORE WARDEN', hp: 22, width: 260, height: 60, speed: 185, points: 3000, coreRadius: 24 },
  y: 132,
  fireSeconds: 2.0,
  spawnSeconds: 8,
};

/** How many balls, powerups, bolts, particles, enemies, shards and popups can exist at once. */
export const POOL = { balls: 8, powerups: 12, bolts: 24, particles: 420, enemies: 10, shards: 18, texts: 24 };

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
  fireball: '#ff9a3d',
  steel: '#8f9bb3',
  steelEdge: '#d7deea',
  ember: '#ff7a2f',
  emberCore: '#ffc46b',
  // Crystal tiers, dimmest to brightest.
  tier: ['#7c5cff', '#b45cff', '#ff5ce1', '#ff5c7a', '#ffb35c'],
  tierEdge: ['#a78bff', '#d18cff', '#ff8ce8', '#ff8ca0', '#ffd28c'],
  power: { W: '#39e6ff', M: '#ff5ce1', L: '#ffd75e', S: '#7dff9e', F: '#ff9a3d', C: '#8ce8ff', N: '#7dffd4', '+': '#ff5c7a' },
  banner: '#ffd75e',
  enemy: { drifter: '#5ce1ff', weaver: '#c792ff', spitter: '#ff6b9e' },
  shard: '#ff4d6d',
  boss: '#ff5c3d',
  bossCore: '#ffe08a',
  shield: '#7dffd4',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenbreak.best';

/** Where progress (unlocked levels, stars, wins) is kept between visits. */
export const SAVE_KEY = 'lumenbreak.progress.v2';

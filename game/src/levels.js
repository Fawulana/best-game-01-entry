// The eight walls, hand-designed. Each wall is 8 rows of 12 characters:
//   '.' empty          '1'..'5' crystal, dimmest to brightest
//   'H' hard crystal (takes two hits)   'S' steel (never breaks)
//   'E' ember (breaks, and chain-damages its neighbours)
// Every wall has a name the banner shows when it opens, a theme (see themes.js),
// the wraiths that haunt it, and — for levels 4 and 8 — the warden that rises
// once its wall is shattered.
//
// Endless Drift walls are generated, not hand-designed: generateEndlessWall
// builds one from the world's seeded random, so the same seed always drifts
// through the same walls, and the pattern, tiers and wraiths grow with the
// drift number.

import { ENDLESS } from './config.js';

export const WALLS = [
  {
    name: 'FIRST LIGHT',
    theme: 0,
    boss: null,
    enemies: { drifter: 0, weaver: 0, spitter: 0, splitter: 0, guardian: 0 },
    rows: [
      '............',
      '.1111111111.',
      '.1222222221.',
      '.1233333321.',
      '.1234444321.',
      '.1233333321.',
      '.1222222221.',
      '.1111111111.',
    ],
  },
  {
    name: 'TWIN SPIRES',
    theme: 1,
    boss: null,
    enemies: { drifter: 2, weaver: 0, spitter: 0, splitter: 0, guardian: 0 },
    rows: [
      '..11....11..',
      '..122..221..',
      '..12233221..',
      '..12233221..',
      '...1222221..',
      '....122221..',
      '.....1221...',
      '......11....',
    ],
  },
  {
    name: 'EMBER HEART',
    theme: 2,
    boss: null,
    enemies: { drifter: 2, weaver: 1, spitter: 0, splitter: 0, guardian: 0 },
    rows: [
      '............',
      '.1111EE1111.',
      '.1222EE2221.',
      '.1232HH2321.',
      '.1232HH2321.',
      '.1222EE2221.',
      '.1111EE1111.',
      '............',
    ],
  },
  {
    name: 'STEEL GATE',
    theme: 3,
    boss: 'ember',
    enemies: { drifter: 2, weaver: 0, spitter: 1, splitter: 1, guardian: 0 },
    rows: [
      'SSSSSSSSSSSS',
      'S1111111111S',
      'S1222222221S',
      'S1233333321S',
      'S123E44E321S',
      'S1234444321S',
      'S1222222221S',
      'S1111111111S',
    ],
  },
  {
    name: 'THE MAZE',
    theme: 4,
    boss: null,
    enemies: { drifter: 2, weaver: 2, spitter: 0, splitter: 1, guardian: 0 },
    rows: [
      '.1..2..3..4.',
      '.1H.2..3..4.',
      '.11.22.33.44',
      '............',
      '.44.33.22.11',
      '.4..3..2..1H',
      '.4..3..2..1.',
      '.E..E..E..E.',
    ],
  },
  {
    name: 'CRYSTAL CHOIR',
    theme: 5,
    boss: null,
    enemies: { drifter: 2, weaver: 1, spitter: 1, splitter: 1, guardian: 1 },
    rows: [
      '............',
      '.1.2.33.2.1.',
      '.12.3EE3.21.',
      '.1233HH3321.',
      '.1233HH3321.',
      '.12.3EE3.21.',
      '.1.2.33.2.1.',
      '............',
    ],
  },
  {
    name: 'VOID LATTICE',
    theme: 6,
    boss: null,
    enemies: { drifter: 3, weaver: 2, spitter: 1, splitter: 1, guardian: 1 },
    rows: [
      'S.2.2.2.2.2S',
      '.2.2.2.2.2.2',
      '2.2.2E2.2.2.',
      '.2.2.2.2.2.2',
      '2.2.2.2.2.2.',
      '.2.2E2.2.2.2',
      '2.2.2.2.2.2.',
      'S.3.3.3.3.3S',
    ],
  },
  {
    name: 'THE CORE',
    theme: 7,
    boss: 'core',
    enemies: { drifter: 2, weaver: 2, spitter: 2, splitter: 1, guardian: 1 },
    rows: [
      'SSSSSSSSSSSS',
      'S5555EE5555S',
      'S54HHHHHH45S',
      'S5432222345S',
      'S5432EE2345S',
      'S5432222345S',
      'S54HHHHHH45S',
      'S5555EE5555S',
    ],
  },
];

/** Brick kinds, by the character that draws them. */
export const KIND_CRYSTAL = 'crystal';
export const KIND_HARD = 'hard';
export const KIND_STEEL = 'steel';
export const KIND_EMBER = 'ember';

export function kindOf(ch) {
  if (ch === 'H') return KIND_HARD;
  if (ch === 'S') return KIND_STEEL;
  if (ch === 'E') return KIND_EMBER;
  return KIND_CRYSTAL;
}

/** Hit points of a fresh brick of this kind. */
export function hitsOf(kind) {
  return kind === KIND_HARD ? 2 : 1;
}

/** Whether clearing the wall needs this brick gone (steel never counts). */
export function isBreakable(kind) {
  return kind !== KIND_STEEL;
}

/** The five drift patterns, each a way to lay bricks across the 8x12 grid. */
const DRIFT_PATTERNS = ['rings', 'columns', 'checker', 'fortress', 'waves'];
const DRIFT_NAMES = {
  rings: 'DRIFT RINGS',
  columns: 'DRIFT COLUMNS',
  checker: 'DRIFT CHECKER',
  fortress: 'DRIFT FORTRESS',
  waves: 'DRIFT WAVES',
};

/**
 * Build one Endless Drift wall. `number` is the drift count (1-based): higher
 * drifts use brighter tiers, more steel and embers, and harder wraiths. The
 * layout comes from `random` alone, so a seed replays the same drift.
 */
export function generateEndlessWall(number, random) {
  const pattern = DRIFT_PATTERNS[Math.floor(random() * DRIFT_PATTERNS.length)];
  const topTier = Math.min(5, 1 + Math.floor(number / 3));
  const tier = () => String(1 + Math.floor(random() * topTier));
  const rows = [];
  for (let row = 0; row < 8; row += 1) {
    let line = '';
    for (let col = 0; col < 12; col += 1) {
      let ch = '.';
      if (pattern === 'rings') {
        const ring = Math.min(row, 7 - row, col, 11 - col);
        if (ring === 0) ch = number >= ENDLESS.steelFromWall && random() < 0.4 ? 'S' : tier();
        else if (ring === 1) ch = random() < 0.7 ? tier() : '.';
        else if (ring === 2) ch = random() < 0.5 ? tier() : '.';
        else ch = '.';
      } else if (pattern === 'columns') {
        if (col % 2 === 0) ch = row === 0 && number >= ENDLESS.steelFromWall && random() < 0.3 ? 'S' : tier();
        else ch = random() < 0.35 ? tier() : '.';
      } else if (pattern === 'checker') {
        if ((row + col) % 2 === 0) ch = tier();
        else ch = random() < 0.2 ? 'H' : '.';
      } else if (pattern === 'fortress') {
        if (row === 0 || col === 0 || col === 11) ch = number >= ENDLESS.steelFromWall ? 'S' : tier();
        else if (row >= 2 && row <= 5 && col >= 3 && col <= 8) ch = random() < 0.75 ? tier() : '.';
        else ch = random() < 0.4 ? tier() : '.';
      } else {
        // waves: sine bands of crystal across the grid.
        const wave = Math.sin((col + row * 2) / 2.2) > 0.1;
        if (wave) ch = tier();
        else ch = random() < 0.15 ? 'H' : '.';
      }
      // Ember seeds: a few bricks that chain to their neighbours.
      if (ch >= '1' && ch <= '5' && random() < 0.07 + number * 0.004) ch = 'E';
      // Hard bricks toughen the higher drifts.
      if (ch >= '1' && ch <= '5' && random() < 0.05 + number * 0.006) ch = 'H';
      line += ch;
    }
    rows.push(line);
  }
  // Never strand the player: at least thirty breakable bricks, always. The
  // fill walks the middle rows first, so the added bricks sit where the ball
  // can reach them early in the drift.
  let breakable = 0;
  for (const line of rows) for (const ch of line) if (ch !== '.' && ch !== 'S') breakable += 1;
  if (breakable < 30) {
    for (let row = 1; row < 7 && breakable < 30; row += 1) {
      for (let col = 1; col < 11 && breakable < 30; col += 1) {
        if (rows[row][col] === '.') {
          rows[row] = rows[row].slice(0, col) + tier() + rows[row].slice(col + 1);
          breakable += 1;
        }
      }
    }
  }
  const wraiths = Math.min(ENDLESS.maxWraiths, ENDLESS.wraithBase + Math.floor(number / 2));
  const enemies = { drifter: 0, weaver: 0, spitter: 0, splitter: 0, guardian: 0 };
  for (let i = 0; i < wraiths; i += 1) {
    const roll = random();
    if (number >= ENDLESS.guardianFromWall && roll < 0.14) enemies.guardian += 1;
    else if (number >= ENDLESS.splitterFromWall && roll < 0.32) enemies.splitter += 1;
    else if (roll < 0.55) enemies.drifter += 1;
    else if (roll < 0.78) enemies.weaver += 1;
    else enemies.spitter += 1;
  }
  return {
    name: `${DRIFT_NAMES[pattern]} ${number}`,
    theme: (number - 1) % 8,
    boss: null,
    enemies,
    rows,
  };
}

// The eight walls, hand-designed. Each wall is 8 rows of 12 characters:
//   '.' empty          '1'..'5' crystal, dimmest to brightest
//   'H' hard crystal (takes two hits)   'S' steel (never breaks)
//   'E' ember (breaks, and chain-damages its neighbours)
// Every wall has a name the banner shows when it opens, a theme (see themes.js),
// the wraiths that haunt it, and — for levels 4 and 8 — the warden that rises
// once its wall is shattered.

export const WALLS = [
  {
    name: 'FIRST LIGHT',
    theme: 0,
    boss: null,
    enemies: { drifter: 0, weaver: 0, spitter: 0 },
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
    enemies: { drifter: 2, weaver: 0, spitter: 0 },
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
    enemies: { drifter: 2, weaver: 1, spitter: 0 },
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
    enemies: { drifter: 2, weaver: 0, spitter: 1 },
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
    enemies: { drifter: 2, weaver: 2, spitter: 0 },
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
    enemies: { drifter: 2, weaver: 1, spitter: 1 },
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
    enemies: { drifter: 3, weaver: 2, spitter: 1 },
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
    enemies: { drifter: 2, weaver: 2, spitter: 2 },
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

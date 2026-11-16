// The eight falling powerups: what each letter means, its colour, and how the
// world picks one. The catalogue is the single source the HUD legend, the How to
// Play screen and the drop logic all read, so a new powerup is one entry here
// plus its effect in the world.

export const POWERUP_CATALOG = {
  W: { label: 'WIDE', color: '#39e6ff', blurb: 'Wider paddle for 12s' },
  M: { label: 'MULTI', color: '#ff5ce1', blurb: 'Splits every flying ball' },
  L: { label: 'LASER', color: '#ffd75e', blurb: 'Fire bolts for 10s' },
  S: { label: 'SLOW', color: '#7dff9e', blurb: 'Slows the ball for 8s' },
  F: { label: 'FIREBALL', color: '#ff9a3d', blurb: 'Ball smashes through bricks' },
  C: { label: 'CATCH', color: '#8ce8ff', blurb: 'Balls stick to the paddle' },
  N: { label: 'SHIELD', color: '#7dffd4', blurb: 'One free save at the bottom' },
  '+': { label: 'LIFE', color: '#ff5c7a', blurb: 'An extra life (max 5)' },
};

/** Weighted drop table: common effects repeat, the extra life is rare. */
const DROP_WEIGHTS = ['W', 'M', 'L', 'S', 'F', 'C', 'N', 'W', 'M', 'L', 'S', 'F', '+'];

/** Pick a powerup kind from the weighted table with the world's seeded random. */
export function pickPowerupKind(random) {
  return DROP_WEIGHTS[Math.floor(random() * DROP_WEIGHTS.length)];
}

/** The one-line legend the How to Play screen and the pause panel show. */
export function powerupLegend() {
  return Object.entries(POWERUP_CATALOG)
    .map(([kind, entry]) => `${kind} ${entry.label}`)
    .join('  ·  ');
}

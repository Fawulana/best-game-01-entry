// Saved progress: best score, unlocked levels, stars per level, wins and total
// bricks shattered, kept in localStorage under SAVE_KEY. Everything here is
// defensive — storage can be off, and a corrupt value must never break a run.
// The older best-only key is migrated once, so returning players keep their best.

import { BEST_KEY, LEVELS, SAVE_KEY } from './config.js';

export function emptyProgress() {
  return { best: 0, unlocked: 1, stars: {}, wins: 0, shattered: 0, runs: 0 };
}

export function loadProgress() {
  const progress = emptyProgress();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (typeof saved.best === 'number') progress.best = Math.max(0, Math.floor(saved.best));
      if (typeof saved.unlocked === 'number') {
        progress.unlocked = Math.max(1, Math.min(LEVELS, Math.floor(saved.unlocked)));
      }
      if (saved.stars !== null && typeof saved.stars === 'object') {
        for (const [level, stars] of Object.entries(saved.stars)) {
          const n = Number(level);
          if (Number.isInteger(n) && n >= 1 && n <= LEVELS) {
            progress.stars[n] = Math.max(0, Math.min(3, Math.floor(stars)));
          }
        }
      }
      if (typeof saved.wins === 'number') progress.wins = Math.max(0, Math.floor(saved.wins));
      if (typeof saved.shattered === 'number') progress.shattered = Math.max(0, Math.floor(saved.shattered));
      if (typeof saved.runs === 'number') progress.runs = Math.max(0, Math.floor(saved.runs));
      return progress;
    }
    // First run with the new save: carry the old best score over.
    const oldBest = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10);
    if (Number.isFinite(oldBest) && oldBest > 0) progress.best = oldBest;
  } catch {
    // Storage off or corrupt: play on with a fresh, in-memory record.
  }
  return progress;
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // Private windows: the record lasts this visit only.
  }
}

/** Stars for a cleared level: 3 with no life lost, 2 with one, 1 otherwise. */
export function starsForLevel(livesLostOnLevel) {
  if (livesLostOnLevel <= 0) return 3;
  if (livesLostOnLevel === 1) return 2;
  return 1;
}

/**
 * Record a cleared level: keep the best star count, unlock the next wall, and
 * add the run's shattered bricks to the lifetime total. Returns the stars won.
 */
export function recordLevelClear(progress, level, livesLostOnLevel, shatteredThisLevel) {
  const stars = starsForLevel(livesLostOnLevel);
  progress.stars[level] = Math.max(progress.stars[level] ?? 0, stars);
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS, level + 1));
  progress.shattered += shatteredThisLevel;
  saveProgress(progress);
  return stars;
}

/** Record a finished run: a new best, and a win if the Core Warden fell. */
export function recordRunEnd(progress, score, won) {
  if (score > progress.best) progress.best = score;
  progress.runs += 1;
  if (won) progress.wins += 1;
  saveProgress(progress);
}

/** Total stars earned across all walls, out of 3 per wall. */
export function totalStars(progress) {
  let total = 0;
  for (let level = 1; level <= LEVELS; level += 1) total += progress.stars[level] ?? 0;
  return total;
}

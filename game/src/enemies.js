// Crystal wraiths: the six enemy kinds, their movement and their hit points.
// The world owns the enemy pool; this module decides what spawns for a wall and
// how each kind moves. Enemies never touch the score or the paddle directly —
// they return what happened and the world applies it.
//
//   drifter  — patrols sideways under the wall, 1 hit.
//   weaver   — dives in a sine wave toward the paddle line, 1 hit.
//   spitter  — hovers and fires a void shard every few seconds, 2 hits.
//   splitter — patrols slowly, 1 hit, and bursts into two fast mites.
//   guardian — descends behind a shield to its hold line, then patrols, 3 hits.
//   mite     — a fast shard of a splitter, small and quick, 1 hit.
import { ENEMY, FIELD } from './config.js';

export const ENEMY_DRIFTER = 'drifter';
export const ENEMY_WEAVER = 'weaver';
export const ENEMY_SPITTER = 'spitter';
export const ENEMY_SPLITTER = 'splitter';
export const ENEMY_GUARDIAN = 'guardian';
export const ENEMY_MITE = 'mite';

export const ENEMY_INFO = {
  drifter: { hp: 1, points: ENEMY.drifterPoints, color: '#5ce1ff', size: ENEMY.size, blurb: 'Drifter — patrols, 1 hit' },
  weaver: { hp: 1, points: ENEMY.weaverPoints, color: '#c792ff', size: ENEMY.size, blurb: 'Weaver — dives at the paddle' },
  spitter: { hp: 2, points: ENEMY.spitterPoints, color: '#ff6b9e', size: ENEMY.size, blurb: 'Spitter — shoots shards, 2 hits' },
  splitter: { hp: 1, points: ENEMY.splitterPoints, color: '#e8ff5c', size: 38, blurb: 'Splitter — bursts into 2 mites' },
  guardian: { hp: 3, points: ENEMY.guardianPoints, color: '#8ce8ff', size: 40, blurb: 'Guardian — shielded, 3 hits' },
  mite: { hp: 1, points: ENEMY.mitePoints, color: '#c8ff5c', size: ENEMY.miteSize, blurb: 'Mite — fast, 1 hit' },
};

/** Every wraith kind, in spawn order. */
export const ENEMY_KINDS = [
  ENEMY_DRIFTER, ENEMY_WEAVER, ENEMY_SPITTER, ENEMY_SPLITTER, ENEMY_GUARDIAN, ENEMY_MITE,
];

/** Place one wraith of a kind into a pool slot, at a position. */
function placeEnemy(enemy, kind, x, y, random) {
  enemy.active = true;
  enemy.kind = kind;
  enemy.hp = ENEMY_INFO[kind].hp;
  enemy.maxHp = ENEMY_INFO[kind].hp;
  enemy.w = ENEMY_INFO[kind].size;
  enemy.h = ENEMY_INFO[kind].size;
  enemy.x = x;
  enemy.y = y;
  enemy.vx = (random() < 0.5 ? -1 : 1)
    * (kind === ENEMY_MITE ? ENEMY.miteSpeed : kind === ENEMY_SPLITTER ? ENEMY.splitterSpeed : ENEMY.drifterSpeed);
  enemy.vy = 0;
  enemy.phase = random() * Math.PI * 2;
  enemy.fireTimer = ENEMY.spitterFireSeconds * (0.6 + random() * 0.8);
  enemy.flash = 0;
  return enemy;
}

/** Spawn the wall's wraiths into the pool, spread across the field's upper half. */
export function spawnEnemiesForLevel(enemies, counts, random) {
  const kinds = [];
  for (const kind of ENEMY_KINDS) {
    for (let i = 0; i < (counts[kind] ?? 0); i += 1) kinds.push(kind);
  }
  let slot = 0;
  for (const enemy of enemies) {
    if (slot >= kinds.length) break;
    if (enemy.active) continue;
    const kind = kinds[slot];
    slot += 1;
    placeEnemy(
      enemy, kind,
      120 + ((slot * 197) % (FIELD.width - 240)),
      340 + (slot % 3) * 46 + random() * 20,
      random,
    );
  }
}

/** Spawn one wraith of a kind at a position (splitters and wardens call this). */
export function spawnEnemy(enemies, kind, x, y, random) {
  for (const enemy of enemies) {
    if (enemy.active) continue;
    return placeEnemy(
      enemy, kind,
      Math.max(20, Math.min(FIELD.width - ENEMY_INFO[kind].size - 20, x)),
      y,
      random,
    );
  }
  return null;
}

/**
 * Move every active wraith one step. Returns true when a weaver reached the
 * paddle line (it bursts there — the world breaks the combo and shakes).
 * Spitters report through `onFire(enemy)` when a shard should launch.
 */
export function updateEnemies(enemies, dt, time, onFire) {
  let weaverLanded = false;
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.phase += dt;
    if (enemy.kind === ENEMY_DRIFTER || enemy.kind === ENEMY_SPLITTER) {
      const speed = enemy.kind === ENEMY_SPLITTER ? ENEMY.splitterSpeed : ENEMY.drifterSpeed;
      enemy.x += enemy.vx * dt;
      if (enemy.x < 16) {
        enemy.x = 16;
        enemy.vx = Math.abs(speed);
      } else if (enemy.x + enemy.w > FIELD.width - 16) {
        enemy.x = FIELD.width - 16 - enemy.w;
        enemy.vx = -Math.abs(speed);
      }
      enemy.y += Math.sin(enemy.phase * 2) * 8 * dt;
    } else if (enemy.kind === ENEMY_WEAVER) {
      enemy.y += ENEMY.weaverSpeed * dt;
      enemy.x += Math.sin(enemy.phase * 2.4) * ENEMY.weaverSway * dt;
      enemy.x = Math.max(16, Math.min(FIELD.width - 16 - enemy.w, enemy.x));
      if (enemy.y > 640) {
        enemy.active = false;
        weaverLanded = true;
      }
    } else if (enemy.kind === ENEMY_GUARDIAN) {
      // Descend to the hold line, then patrol it like a slow drifter.
      if (enemy.y < ENEMY.guardianHoldY) {
        enemy.y += ENEMY.guardianDescent * dt;
        enemy.x += Math.sin(enemy.phase * 1.2) * 30 * dt;
      } else {
        // Patrol at half speed: a guardian is heavy, even for a wraith.
        enemy.x += enemy.vx * 0.5 * dt;
        if (enemy.x < 16) {
          enemy.x = 16;
          enemy.vx = Math.abs(enemy.vx);
        } else if (enemy.x + enemy.w > FIELD.width - 16) {
          enemy.x = FIELD.width - 16 - enemy.w;
          enemy.vx = -Math.abs(enemy.vx);
        }
      }
      enemy.x = Math.max(16, Math.min(FIELD.width - 16 - enemy.w, enemy.x));
    } else if (enemy.kind === ENEMY_MITE) {
      enemy.x += enemy.vx * dt;
      if (enemy.x < 16) {
        enemy.x = 16;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x + enemy.w > FIELD.width - 16) {
        enemy.x = FIELD.width - 16 - enemy.w;
        enemy.vx = -Math.abs(enemy.vx);
      }
      enemy.y += Math.sin(enemy.phase * 3) * 14 * dt;
    } else {
      // Spitter: slow drift, then a shard.
      enemy.x += Math.sin(enemy.phase * 0.9) * 46 * dt;
      enemy.x = Math.max(16, Math.min(FIELD.width - 16 - enemy.w, enemy.x));
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = ENEMY.spitterFireSeconds;
        onFire(enemy);
      }
    }
    void time;
  }
  return weaverLanded;
}

/** Damage one wraith. Returns true when it shattered. */
export function damageEnemy(enemy) {
  enemy.hp -= 1;
  enemy.flash = 0.12;
  if (enemy.hp <= 0) {
    enemy.active = false;
    return true;
  }
  return false;
}

/** How many wraiths are still haunting the field. */
export function enemiesLeft(enemies) {
  let n = 0;
  for (const enemy of enemies) if (enemy.active) n += 1;
  return n;
}

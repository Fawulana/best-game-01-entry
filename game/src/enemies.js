// Crystal wraiths: the three enemy kinds, their movement and their hit points.
// The world owns the enemy pool; this module decides what spawns for a wall and
// how each kind moves. Enemies never touch the score or the paddle directly —
// they return what happened and the world applies it.
//
//   drifter — patrols sideways under the wall, 1 hit, drops nothing special.
//   weaver  — dives in a sine wave toward the paddle line, 1 hit.
//   spitter — hovers and fires a void shard every few seconds, 2 hits.
import { ENEMY, FIELD } from './config.js';

export const ENEMY_DRIFTER = 'drifter';
export const ENEMY_WEAVER = 'weaver';
export const ENEMY_SPITTER = 'spitter';

export const ENEMY_INFO = {
  drifter: { hp: 1, points: ENEMY.drifterPoints, color: '#5ce1ff', blurb: 'Drifter — patrols, 1 hit' },
  weaver: { hp: 1, points: ENEMY.weaverPoints, color: '#c792ff', blurb: 'Weaver — dives at the paddle' },
  spitter: { hp: 2, points: ENEMY.spitterPoints, color: '#ff6b9e', blurb: 'Spitter — shoots shards, 2 hits' },
};

/** Spawn the wall's wraiths into the pool, spread across the field's upper half. */
export function spawnEnemiesForLevel(enemies, counts, random) {
  const kinds = [];
  for (const kind of [ENEMY_DRIFTER, ENEMY_WEAVER, ENEMY_SPITTER]) {
    for (let i = 0; i < (counts[kind] ?? 0); i += 1) kinds.push(kind);
  }
  let slot = 0;
  for (const enemy of enemies) {
    if (slot >= kinds.length) break;
    if (enemy.active) continue;
    const kind = kinds[slot];
    slot += 1;
    enemy.active = true;
    enemy.kind = kind;
    enemy.hp = ENEMY_INFO[kind].hp;
    enemy.maxHp = ENEMY_INFO[kind].hp;
    enemy.w = ENEMY.size;
    enemy.h = ENEMY.size;
    enemy.x = 120 + ((slot * 197) % (FIELD.width - 240));
    enemy.y = 340 + (slot % 3) * 46 + random() * 20;
    enemy.vx = (slot % 2 === 0 ? 1 : -1) * ENEMY.drifterSpeed;
    enemy.vy = 0;
    enemy.phase = random() * Math.PI * 2;
    enemy.fireTimer = ENEMY.spitterFireSeconds * (0.6 + random() * 0.8);
    enemy.flash = 0;
  }
}

/** Spawn one wraith of a kind at a position (the wardens call this for minions). */
export function spawnEnemy(enemies, kind, x, y, random) {
  for (const enemy of enemies) {
    if (enemy.active) continue;
    enemy.active = true;
    enemy.kind = kind;
    enemy.hp = ENEMY_INFO[kind].hp;
    enemy.maxHp = ENEMY_INFO[kind].hp;
    enemy.w = ENEMY.size;
    enemy.h = ENEMY.size;
    enemy.x = Math.max(20, Math.min(FIELD.width - ENEMY.size - 20, x));
    enemy.y = y;
    enemy.vx = (random() < 0.5 ? -1 : 1) * ENEMY.drifterSpeed;
    enemy.vy = 0;
    enemy.phase = random() * Math.PI * 2;
    enemy.fireTimer = ENEMY.spitterFireSeconds;
    enemy.flash = 0;
    return enemy;
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
    if (enemy.kind === ENEMY_DRIFTER) {
      enemy.x += enemy.vx * dt;
      if (enemy.x < 16) {
        enemy.x = 16;
        enemy.vx = Math.abs(enemy.vx);
      } else if (enemy.x + enemy.w > FIELD.width - 16) {
        enemy.x = FIELD.width - 16 - enemy.w;
        enemy.vx = -Math.abs(enemy.vx);
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

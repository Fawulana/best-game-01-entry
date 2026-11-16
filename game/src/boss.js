// The wardens: two boss encounters that rise once a wall is shattered (level 4's
// Ember Warden, level 8's Core Warden). A warden patrols the top of the field,
// fires shard volleys, and — in its later phases — calls wraith minions. Hitting
// its glowing core scores a critical hit for double damage. Phases: full speed
// at 2/3 health, faster with minions at 1/3.
//
// The world owns the single boss object; this module creates it, moves it and
// decides its attacks. Attacks report through callbacks so the world stays the
// only module that spawns shards and wraiths.
import { BOSS, FIELD } from './config.js';

export const BOSS_EMBER = 'ember';
export const BOSS_CORE = 'core';

/** The boss object the world keeps: inactive until a warden rises. */
export function createBossState() {
  return {
    active: false, key: null, name: '', hp: 0, maxHp: 1,
    x: 0, y: BOSS.y, w: 0, h: 0, vx: 0,
    phase: 1, fireTimer: BOSS.fireSeconds, spawnTimer: BOSS.spawnSeconds,
    flash: 0, coreFlash: 0, introTimer: 0,
  };
}

/** Wake a warden: centred at the top, full health, phase 1. */
export function summonBoss(boss, key) {
  const def = BOSS[key];
  boss.active = true;
  boss.key = key;
  boss.name = def.name;
  boss.hp = def.hp;
  boss.maxHp = def.hp;
  boss.w = def.width;
  boss.h = def.height;
  boss.x = (FIELD.width - def.width) / 2;
  boss.y = BOSS.y;
  boss.vx = def.speed;
  boss.phase = 1;
  boss.fireTimer = BOSS.fireSeconds;
  boss.spawnTimer = BOSS.spawnSeconds;
  boss.flash = 0;
  boss.coreFlash = 0;
  boss.introTimer = 1.6;
}

/** The warden's glowing core: the circle a critical hit must strike. */
export function bossCore(boss) {
  const def = BOSS[boss.key];
  return { x: boss.x + boss.w / 2, y: boss.y + boss.h / 2, r: def.coreRadius };
}

/** Phase from remaining health: 1 above 2/3, 2 above 1/3, 3 below it. */
export function bossPhaseOf(boss) {
  const fraction = boss.hp / boss.maxHp;
  if (fraction > 2 / 3) return 1;
  if (fraction > 1 / 3) return 2;
  return 3;
}

/**
 * Move the warden one step and fire its attacks. `onVolley(count)` launches a
 * shard volley, `onMinion()` asks for a wraith. Returns true when the warden
 * just entered a new phase (the world answers with a banner and a roar).
 */
export function updateBoss(boss, dt, onVolley, onMinion) {
  if (!boss.active) return false;
  if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt);
  if (boss.coreFlash > 0) boss.coreFlash = Math.max(0, boss.coreFlash - dt);
  if (boss.introTimer > 0) {
    boss.introTimer -= dt;
    return false;
  }
  const def = BOSS[boss.key];
  const speed = def.speed * (1 + (boss.phase - 1) * 0.35);
  boss.x += boss.vx * (speed / def.speed) * dt;
  if (boss.x < 24) {
    boss.x = 24;
    boss.vx = Math.abs(boss.vx);
  } else if (boss.x + boss.w > FIELD.width - 24) {
    boss.x = FIELD.width - 24 - boss.w;
    boss.vx = -Math.abs(boss.vx);
  }
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = Math.max(1.1, BOSS.fireSeconds - (boss.phase - 1) * 0.35);
    onVolley(boss.phase >= 3 ? 3 : boss.phase === 2 ? 2 : 1);
  }
  if (boss.phase >= 2) {
    boss.spawnTimer -= dt;
    if (boss.spawnTimer <= 0) {
      boss.spawnTimer = BOSS.spawnSeconds;
      onMinion();
    }
  }
  const nextPhase = bossPhaseOf(boss);
  if (nextPhase !== boss.phase) {
    boss.phase = nextPhase;
    return true;
  }
  return false;
}

/**
 * Damage the warden. A hit inside the core circle is critical (2 damage).
 * Returns 'core' | 'hit' | 'dead' so the world can score and celebrate.
 */
export function damageBoss(boss, hitX, hitY) {
  const core = bossCore(boss);
  const dx = hitX - core.x;
  const dy = hitY - core.y;
  const critical = dx * dx + dy * dy < core.r * core.r;
  boss.hp -= critical ? 2 : 1;
  boss.flash = 0.12;
  if (critical) boss.coreFlash = 0.2;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.active = false;
    return 'dead';
  }
  return critical ? 'core' : 'hit';
}

/** Points for defeating a warden, before the combo multiplier. */
export function bossPoints(key) {
  return BOSS[key].points;
}

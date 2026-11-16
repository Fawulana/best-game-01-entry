// LUMENBREAK's rules and state, with no drawing and no browser in it: the paddle, the
// balls, the crystal walls, wraiths, wardens, falling shards and powerups, laser bolts
// and particles, collisions, score, combo, lives and levels. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (and play sounds)
// without the world knowing about screens. Nothing here allocates after createWorld
// returns, and nothing here reads the clock: the same seed and inputs always give the
// same game.
import {
  BALL, BOSS, BRICK, COMBO, ENEMY, FIELD, LASER, LEVELS, LIVES, MAX_LIVES, PADDLE, POOL, POWERUP, SHARD,
} from './config.js';
import { WALLS, hitsOf, isBreakable, kindOf } from './levels.js';
import { randomPick } from './random.js';
import { pickPowerupKind } from './powerups.js';
import {
  ENEMY_INFO, damageEnemy, enemiesLeft, spawnEnemiesForLevel, spawnEnemy, updateEnemies,
} from './enemies.js';
import { bossPoints, createBossState, damageBoss, summonBoss, updateBoss } from './boss.js';
import {
  addFlash, addShake, createEffects, spawnFloatingText, spawnRing, updateEffects,
} from './effects.js';

export const EVENT_BRICK = 1;
export const EVENT_CRACK = 2;
export const EVENT_POWERUP = 4;
export const EVENT_LOST = 8;
export const EVENT_OVER = 16;
export const EVENT_CLEAR = 32;
export const EVENT_WIN = 64;
export const EVENT_LIFE = 128;
export const EVENT_PADDLE = 256;
export const EVENT_LASER = 512;
export const EVENT_TINK = 1024;
export const EVENT_ENEMY = 2048;
export const EVENT_BOSS_HIT = 4096;
export const EVENT_BOSS_CRIT = 8192;
export const EVENT_BOSS_DOWN = 16384;
export const EVENT_BOSS_RISE = 32768;
export const EVENT_SHARD = 65536;
export const EVENT_SHARD_HIT = 131072;
export const EVENT_SHIELD = 262144;
export const EVENT_FEVER = 524288;
export const EVENT_PHASE = 1048576;
export const EVENT_WEAVER = 2097152;

function circleRect(ball, rect) {
  const cx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return { hit: dx * dx + dy * dy < ball.r * ball.r, nx: dx, ny: dy, dist2: dx * dx + dy * dy };
}

function reflectOff(ball, hit) {
  let nx = hit.nx;
  let ny = hit.ny;
  const len = Math.hypot(nx, ny);
  if (len < 0.001) {
    nx = 0;
    ny = -1;
  } else {
    nx /= len;
    ny /= len;
  }
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
  }
  ball.x += nx * (ball.r + 0.5);
  ball.y += ny * (ball.r + 0.5);
}

export function createWorld(random) {
  const paddle = {
    x: 0, width: PADDLE.width, wideTimer: 0, laserTimer: 0, laserCooldown: 0, narrowTimer: 0,
  };
  const balls = [];
  for (let i = 0; i < POOL.balls; i += 1) {
    const trail = [];
    for (let t = 0; t < 8; t += 1) trail.push({ x: 0, y: 0 });
    balls.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: BALL.radius, stuck: false, trail, trailHead: 0 });
  }
  const bricks = [];
  const powerups = [];
  for (let i = 0; i < POOL.powerups; i += 1) powerups.push({ active: false, kind: 'W', x: 0, y: 0 });
  const bolts = [];
  for (let i = 0; i < POOL.bolts; i += 1) bolts.push({ active: false, x: 0, y: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2 });
  }
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({
      active: false, kind: 'drifter', hp: 1, maxHp: 1, x: 0, y: 0, w: ENEMY.size, h: ENEMY.size,
      vx: 0, vy: 0, phase: 0, fireTimer: 0, flash: 0,
    });
  }
  const shards = [];
  for (let i = 0; i < POOL.shards; i += 1) {
    shards.push({ active: false, x: 0, y: 0, vx: 0, vy: SHARD.fallSpeed });
  }
  const boss = createBossState();
  const effects = createEffects();
  const state = {
    paddle, balls, bricks, powerups, bolts, particles, enemies, shards, boss, effects,
    score: 0, lives: LIVES, level: 1, combo: 0, multiplier: 1,
    slowTimer: 0, fireballTimer: 0, catchTimer: 0, shield: false,
    broken: 0, caught: 0, fired: 0, totalBroken: 0,
    banner: '', bannerTimer: 0, levelName: '',
    bossPhase: false, bossSlain: false, bossHitCooldown: 0,
    levelLost: 0, levelShattered: 0, levelTime: 0, time: 0,
    feverAnnounced: false, runStartLevel: 1, justClearedLevel: 0, lastBonus: 0, lastStars: 0,
    lastLevelLost: 0, lastShattered: 0,
    stats: { enemies: 0, bosses: 0, crits: 0, shieldsSaved: 0, maxCombo: 0, shardsTaken: 0 },
  };

  function freeBall() {
    for (const ball of balls) if (!ball.active) return ball;
    return null;
  }
  function freePowerup() {
    for (const p of powerups) if (!p.active) return p;
    return null;
  }
  function freeBolt() {
    for (const b of bolts) if (!b.active) return b;
    return null;
  }
  function freeShard() {
    for (const s of shards) if (!s.active) return s;
    return null;
  }
  function spawnParticle(x, y, color) {
    for (const p of particles) {
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 260;
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.life = 0.4 + random() * 0.5;
      p.maxLife = p.life;
      p.color = color;
      p.size = 2 + random() * 3;
      return;
    }
  }
  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) spawnParticle(x, y, color);
  }

  function ballSpeed() {
    const base = BALL.baseSpeed + BALL.speedPerLevel * (state.level - 1) + BALL.speedPerBrick * state.broken;
    const slowed = state.slowTimer > 0 ? base * BALL.slowFactor : base;
    return Math.min(BALL.maxSpeed, slowed);
  }

  /** Raise the combo after a shatter; crossing the fever line fires EVENT_FEVER once. */
  function raiseCombo(x, y) {
    state.combo += 1;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
    state.multiplier = Math.min(state.combo, COMBO.maxMultiplier);
    if (state.multiplier >= COMBO.feverAt && !state.feverAnnounced) {
      state.feverAnnounced = true;
      spawnFloatingText(effects, x, y - 18, `FEVER x${state.multiplier}!`, '#ffd75e', 26);
      addFlash(effects, '#ffd75e', 0.18);
      return EVENT_FEVER;
    }
    return 0;
  }

  function resetCombo() {
    state.combo = 0;
    state.multiplier = 1;
    state.feverAnnounced = false;
  }

  function loadLevel(number) {
    const wall = WALLS[number - 1];
    state.level = number;
    state.levelName = wall.name;
    state.broken = 0;
    state.levelLost = 0;
    state.levelShattered = 0;
    state.levelTime = 0;
    state.bossPhase = false;
    state.bossSlain = false;
    state.bossHitCooldown = 0;
    boss.active = false;
    bricks.length = 0;
    const gridWidth = BRICK.cols * BRICK.width + (BRICK.cols - 1) * BRICK.gapX;
    const left = (FIELD.width - gridWidth) / 2;
    for (let row = 0; row < BRICK.rows; row += 1) {
      for (let col = 0; col < BRICK.cols; col += 1) {
        const ch = wall.rows[row][col];
        if (ch === '.' || ch === undefined) continue;
        const kind = kindOf(ch);
        bricks.push({
          active: true, kind, col, row,
          tier: ch >= '1' && ch <= '5' ? Number(ch) : 1,
          hits: hitsOf(kind), maxHits: hitsOf(kind),
          x: left + col * (BRICK.width + BRICK.gapX),
          y: BRICK.top + row * (BRICK.height + BRICK.gapY),
          w: BRICK.width, h: BRICK.height, flash: 0,
        });
      }
    }
    for (const p of powerups) p.active = false;
    for (const b of bolts) b.active = false;
    for (const e of enemies) e.active = false;
    for (const s of shards) s.active = false;
    spawnEnemiesForLevel(enemies, wall.enemies, random);
    state.banner = wall.name;
    state.bannerTimer = 2.2;
  }

  function serveBall() {
    const ball = freeBall();
    if (ball === null) return;
    ball.active = true;
    ball.stuck = true;
    ball.r = BALL.radius;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = PADDLE.y - ball.r - 1;
    ball.vx = 0;
    ball.vy = 0;
    for (const point of ball.trail) {
      point.x = ball.x;
      point.y = ball.y;
    }
    ball.trailHead = 0;
  }

  function resetAt(level) {
    paddle.x = (FIELD.width - PADDLE.width) / 2;
    paddle.width = PADDLE.width;
    paddle.wideTimer = 0;
    paddle.laserTimer = 0;
    paddle.laserCooldown = 0;
    paddle.narrowTimer = 0;
    for (const ball of balls) ball.active = false;
    for (const p of particles) p.active = false;
    for (const popup of effects.texts) popup.active = false;
    for (const ring of effects.rings) ring.active = false;
    effects.shake = 0;
    effects.flash = 0;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.multiplier = 1;
    state.slowTimer = 0;
    state.fireballTimer = 0;
    state.catchTimer = 0;
    state.shield = false;
    state.caught = 0;
    state.fired = 0;
    state.totalBroken = 0;
    state.time = 0;
    state.runStartLevel = level;
    state.justClearedLevel = 0;
    state.lastBonus = 0;
    state.stats.enemies = 0;
    state.stats.bosses = 0;
    state.stats.crits = 0;
    state.stats.shieldsSaved = 0;
    state.stats.maxCombo = 0;
    state.stats.shardsTaken = 0;
    loadLevel(level);
    serveBall();
  }

  function reset() {
    resetAt(1);
  }

  function breakableLeft() {
    let n = 0;
    for (const b of bricks) if (b.active && isBreakable(b.kind)) n += 1;
    return n;
  }

  function dropPowerup(x, y, chance) {
    if (random() > chance) return;
    const p = freePowerup();
    if (p === null) return;
    p.active = true;
    p.kind = pickPowerupKind(random);
    p.x = x;
    p.y = y;
  }

  function spawnShard(x, y, vx) {
    const shard = freeShard();
    if (shard === null) return;
    shard.active = true;
    shard.x = x;
    shard.y = y;
    shard.vx = vx;
    shard.vy = SHARD.fallSpeed;
  }

  /** Damage one brick by 1. Returns the events it caused. Ember breaks chain to neighbours. */
  function damageBrick(brick, events, chain) {
    if (!brick.active) return events;
    brick.hits -= 1;
    brick.flash = 0.12;
    if (brick.hits > 0) {
      state.score += BRICK.crackPoints * state.multiplier;
      return events | EVENT_CRACK;
    }
    brick.active = false;
    state.broken += 1;
    state.totalBroken += 1;
    state.levelShattered += 1;
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    events |= raiseCombo(cx, cy);
    const points = brick.kind === 'hard' ? BRICK.hardPoints : brick.kind === 'ember' ? BRICK.emberPoints : BRICK.points;
    const scored = points * state.multiplier;
    state.score += scored;
    spawnFloatingText(effects, cx, cy, `+${scored}`, '#f2efff', 19);
    burst(cx, cy, brick.kind === 'ember' ? '#ff7a2f' : '#b45cff', brick.kind === 'ember' ? 26 : 16);
    if (brick.kind === 'ember') addShake(effects, 4);
    dropPowerup(cx, cy, BRICK.dropChance);
    events |= EVENT_BRICK;
    if (brick.kind === 'ember') {
      for (const other of bricks) {
        if (!other.active || other === brick) continue;
        if (Math.abs(other.col - brick.col) <= 1 && Math.abs(other.row - brick.row) <= 1) chain.push(other);
      }
    }
    return events;
  }

  /** Damage one wraith; on death it scores, bursts and may drop a powerup. */
  function hitEnemy(enemy, hitX, hitY, events) {
    const shattered = damageEnemy(enemy);
    burst(hitX, hitY, ENEMY_INFO[enemy.kind].color, shattered ? 22 : 6);
    if (!shattered) return events | EVENT_TINK;
    state.stats.enemies += 1;
    events |= raiseCombo(hitX, hitY);
    const scored = ENEMY_INFO[enemy.kind].points * state.multiplier;
    state.score += scored;
    spawnFloatingText(effects, hitX, hitY, `+${scored}`, ENEMY_INFO[enemy.kind].color, 21);
    spawnRing(effects, hitX, hitY, ENEMY_INFO[enemy.kind].color, 70);
    dropPowerup(hitX, hitY, ENEMY.dropChance);
    return events | EVENT_ENEMY;
  }

  /** Damage the warden (rate-limited so a fireball cannot shred it in one pass). */
  function hitBoss(hitX, hitY, events) {
    if (state.bossHitCooldown > 0 || !boss.active) return events;
    state.bossHitCooldown = 0.12;
    const result = damageBoss(boss, hitX, hitY);
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    if (result === 'dead') {
      state.stats.bosses += 1;
      state.bossSlain = true;
      const scored = bossPoints(boss.key);
      state.score += scored;
      spawnFloatingText(effects, cx, cy, `+${scored} WARDEN DOWN!`, '#ffd75e', 30);
      burst(cx, cy, '#ff5c3d', 60);
      burst(cx, cy, '#ffd75e', 30);
      spawnRing(effects, cx, cy, '#ffd75e', 260);
      addShake(effects, 14);
      addFlash(effects, '#ffd75e', 0.3);
      return events | EVENT_BOSS_DOWN;
    }
    if (result === 'core') {
      state.stats.crits += 1;
      const scored = 100 * state.multiplier;
      state.score += scored;
      spawnFloatingText(effects, hitX, hitY, `CRIT +${scored}`, '#ffe08a', 24);
      addShake(effects, 6);
      return events | EVENT_BOSS_CRIT;
    }
    const scored = 50 * state.multiplier;
    state.score += scored;
    spawnFloatingText(effects, hitX, hitY, `+${scored}`, '#ff8c6b', 19);
    burst(hitX, hitY, '#ff5c3d', 8);
    addShake(effects, 3);
    return events | EVENT_BOSS_HIT;
  }

  function applyPowerup(kind) {
    state.caught += 1;
    if (kind === 'W') {
      paddle.wideTimer = PADDLE.wideSeconds;
      paddle.narrowTimer = 0;
    } else if (kind === 'M') {
      const flying = balls.filter((b) => b.active && !b.stuck);
      for (const source of flying) {
        for (const angle of [-0.45, 0.45]) {
          const ball = freeBall();
          if (ball === null) break;
          const speed = Math.hypot(source.vx, source.vy);
          const base = Math.atan2(source.vy, source.vx) + angle;
          ball.active = true;
          ball.stuck = false;
          ball.r = BALL.radius;
          ball.x = source.x;
          ball.y = source.y;
          ball.vx = Math.cos(base) * speed;
          ball.vy = Math.sin(base) * speed;
          for (const point of ball.trail) {
            point.x = ball.x;
            point.y = ball.y;
          }
        }
        if (balls.filter((b) => b.active).length >= POOL.balls) break;
      }
    } else if (kind === 'L') {
      paddle.laserTimer = PADDLE.laserSeconds;
    } else if (kind === 'S') {
      state.slowTimer = BALL.slowSeconds;
    } else if (kind === 'F') {
      state.fireballTimer = BALL.fireballSeconds;
    } else if (kind === 'C') {
      state.catchTimer = BALL.catchSeconds;
    } else if (kind === 'N') {
      state.shield = true;
    } else if (kind === '+') {
      if (state.lives < MAX_LIVES) {
        state.lives += 1;
        return EVENT_LIFE;
      }
      state.score += 500;
    }
    return EVENT_POWERUP;
  }

  function launchBall(ball) {
    if (!ball.stuck) return;
    ball.stuck = false;
    const speed = ballSpeed();
    const angle = -Math.PI / 2 + (random() - 0.5) * 0.5;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function fireLasers() {
    if (paddle.laserTimer <= 0 || paddle.laserCooldown > 0) return 0;
    paddle.laserCooldown = LASER.cooldown;
    state.fired += 2;
    for (const dx of [-paddle.width / 2 + 12, paddle.width / 2 - 12]) {
      const bolt = freeBolt();
      if (bolt === null) continue;
      bolt.active = true;
      bolt.x = paddle.x + paddle.width / 2 + dx;
      bolt.y = PADDLE.y - LASER.height;
    }
    return EVENT_LASER;
  }

  /** The wall is gone and this wall has a warden: it rises, the fight begins. */
  function beginBossPhase(events) {
    const wall = WALLS[state.level - 1];
    state.bossPhase = true;
    for (const enemy of enemies) {
      if (enemy.active) {
        burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, ENEMY_INFO[enemy.kind].color, 10);
        enemy.active = false;
      }
    }
    for (const p of powerups) p.active = false;
    for (const bolt of bolts) bolt.active = false;
    summonBoss(boss, wall.boss);
    state.banner = boss.name;
    state.bannerTimer = 2.4;
    addShake(effects, 8);
    addFlash(effects, '#ff5c3d', 0.3);
    return events | EVENT_BOSS_RISE;
  }

  /** A level is fully cleared: bonus, banner data, and the next wall or the win. */
  function completeLevel(events) {
    const cleared = state.level;
    const bonus = 150 * cleared + 50 * state.lives + (state.levelLost === 0 ? 250 : 0);
    state.score += bonus;
    state.lastBonus = bonus;
    state.justClearedLevel = cleared;
    state.lastStars = state.levelLost <= 0 ? 3 : state.levelLost === 1 ? 2 : 1;
    state.lastLevelLost = state.levelLost;
    state.lastShattered = state.levelShattered;
    spawnFloatingText(effects, FIELD.width / 2, 300, `CLEAR BONUS +${bonus}`, '#ffd75e', 30);
    for (const b of balls) b.active = false;
    for (const p of powerups) p.active = false;
    for (const bolt of bolts) bolt.active = false;
    for (const s of shards) s.active = false;
    state.bossPhase = false;
    state.bossSlain = false;
    boss.active = false;
    if (cleared >= LEVELS) {
      return events | EVENT_CLEAR | EVENT_WIN;
    }
    events |= EVENT_CLEAR;
    loadLevel(cleared + 1);
    serveBall();
    return events;
  }

  /**
   * One fixed step. `control` is { direction (-1, 0, 1), mouseX (number or null),
   * launch (bool), fire (bool) }. With `attract` set (the title screen's demo) the
   * ball bounces off the bottom, bricks never break and nothing scores.
   */
  function step(dt, control, attract) {
    let events = 0;
    state.time += dt;
    if (!attract) state.levelTime += dt;
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (paddle.wideTimer > 0) paddle.wideTimer -= dt;
    if (paddle.narrowTimer > 0) paddle.narrowTimer -= dt;
    if (paddle.laserTimer > 0) paddle.laserTimer -= dt;
    if (paddle.laserCooldown > 0) paddle.laserCooldown -= dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;
    if (state.fireballTimer > 0) state.fireballTimer -= dt;
    if (state.catchTimer > 0) state.catchTimer -= dt;
    if (state.bossHitCooldown > 0) state.bossHitCooldown -= dt;
    // Paddle width follows the strongest active effect, centred on the paddle.
    const targetWidth = paddle.wideTimer > 0 ? PADDLE.wideWidth
      : paddle.narrowTimer > 0 ? PADDLE.narrowWidth : PADDLE.width;
    if (targetWidth !== paddle.width) {
      const centre = paddle.x + paddle.width / 2;
      paddle.width = targetWidth;
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, centre - paddle.width / 2));
    }

    // Paddle: the mouse steers it when it moved, else the keys.
    if (control.mouseX !== null && !attract) {
      const target = Math.max(0, Math.min(FIELD.width - paddle.width, control.mouseX - paddle.width / 2));
      const delta = target - paddle.x;
      const maxMove = PADDLE.speed * 1.6 * dt;
      paddle.x += Math.max(-maxMove, Math.min(maxMove, delta));
    } else if (attract) {
      const flying = balls.find((b) => b.active && !b.stuck);
      if (flying !== undefined) {
        const target = Math.max(0, Math.min(FIELD.width - paddle.width, flying.x - paddle.width / 2));
        const delta = target - paddle.x;
        paddle.x += Math.max(-PADDLE.speed * dt, Math.min(PADDLE.speed * dt, delta));
      }
    } else {
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, paddle.x + control.direction * PADDLE.speed * dt));
    }

    if (control.fire) events |= fireLasers();
    for (const ball of balls) {
      if (!ball.active) continue;
      if (ball.stuck) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = PADDLE.y - ball.r - 1;
        if (control.launch) launchBall(ball);
      }
    }

    // Laser bolts: straight up, one hit of damage each — to bricks, wraiths or a warden.
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.y -= LASER.speed * dt;
      if (bolt.y < FIELD.top - 40) {
        bolt.active = false;
        continue;
      }
      let spent = false;
      for (const brick of bricks) {
        if (!brick.active) continue;
        if (bolt.x > brick.x && bolt.x < brick.x + brick.w && bolt.y > brick.y && bolt.y < brick.y + brick.h) {
          bolt.active = false;
          spent = true;
          if (brick.kind === 'steel') {
            brick.flash = 0.12;
            events |= EVENT_TINK;
          } else if (!attract) {
            const chain = [];
            events |= damageBrick(brick, 0, chain);
            while (chain.length > 0) events |= damageBrick(chain.pop(), 0, chain);
          }
          break;
        }
      }
      if (spent || attract) continue;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        if (bolt.x > enemy.x && bolt.x < enemy.x + enemy.w && bolt.y > enemy.y && bolt.y < enemy.y + enemy.h) {
          bolt.active = false;
          spent = true;
          events |= hitEnemy(enemy, bolt.x, bolt.y, 0);
          break;
        }
      }
      if (spent) continue;
      if (boss.active && bolt.x > boss.x && bolt.x < boss.x + boss.w && bolt.y > boss.y && bolt.y < boss.y + boss.h) {
        bolt.active = false;
        events |= hitBoss(bolt.x, bolt.y, 0);
      }
    }

    // Balls.
    const fireball = state.fireballTimer > 0;
    for (const ball of balls) {
      if (!ball.active || ball.stuck) continue;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const point = ball.trail[ball.trailHead];
      point.x = ball.x;
      point.y = ball.y;
      ball.trailHead = (ball.trailHead + 1) % ball.trail.length;
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.r > FIELD.width) {
        ball.x = FIELD.width - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }
      // Paddle bounce: the angle follows where the ball lands on the paddle.
      // With CATCH active the ball sticks instead, ready to re-aim and launch.
      if (ball.vy > 0 && ball.y + ball.r >= PADDLE.y && ball.y + ball.r <= PADDLE.y + PADDLE.height + 8
        && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.width + ball.r) {
        if (!attract && state.catchTimer > 0) {
          ball.stuck = true;
          ball.vx = 0;
          ball.vy = 0;
          ball.y = PADDLE.y - ball.r - 1;
        } else {
          const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
          const speed = ballSpeed();
          const angle = -Math.PI / 2 + offset * 1.05;
          ball.vx = Math.cos(angle) * speed;
          ball.vy = Math.sin(angle) * speed;
          ball.y = PADDLE.y - ball.r - 0.5;
        }
        if (!attract) resetCombo();
        events |= EVENT_PADDLE;
      }
      // Bricks: reflect off the closest point's normal, then damage. A fireball
      // smashes straight through breakable bricks instead of bouncing.
      for (const brick of bricks) {
        if (!brick.active) continue;
        const hit = circleRect(ball, brick);
        if (!hit.hit) continue;
        if (attract) {
          reflectOff(ball, hit);
          brick.flash = 0.12;
          events |= EVENT_TINK;
          break;
        }
        if (brick.kind === 'steel') {
          reflectOff(ball, hit);
          brick.flash = 0.12;
          burst(ball.x, ball.y, '#d7deea', 4);
          events |= EVENT_TINK;
          break;
        }
        if (fireball) {
          const chain = [];
          events |= damageBrick(brick, 0, chain);
          while (chain.length > 0) events |= damageBrick(chain.pop(), 0, chain);
          continue;
        }
        reflectOff(ball, hit);
        const chain = [];
        events |= damageBrick(brick, 0, chain);
        while (chain.length > 0) events |= damageBrick(chain.pop(), 0, chain);
        break;
      }
      // Wraiths: the ball bounces off them (or smashes through as a fireball).
      if (!attract) {
        for (const enemy of enemies) {
          if (!enemy.active) continue;
          const hit = circleRect(ball, enemy);
          if (!hit.hit) continue;
          if (!fireball) reflectOff(ball, hit);
          events |= hitEnemy(enemy, ball.x, ball.y, 0);
          if (!fireball) break;
        }
      }
      // The warden: a big crystal body with a critical core.
      if (!attract && boss.active) {
        const hit = circleRect(ball, boss);
        if (hit.hit) {
          if (!fireball) reflectOff(ball, hit);
          events |= hitBoss(ball.x, ball.y, 0);
        }
      }
      // Lost below the field: the shield saves one ball, once.
      if (ball.y - ball.r > FIELD.height) {
        if (attract) {
          ball.active = false;
          serveBall();
          const served = balls.find((b) => b.active && b.stuck);
          if (served !== undefined) launchBall(served);
        } else if (state.shield) {
          state.shield = false;
          state.stats.shieldsSaved += 1;
          ball.y = PADDLE.y - ball.r - 1;
          ball.vy = -Math.abs(ball.vy);
          burst(ball.x, FIELD.height - 30, '#7dffd4', 20);
          spawnRing(effects, ball.x, FIELD.height - 30, '#7dffd4', 120);
          spawnFloatingText(effects, ball.x, FIELD.height - 70, 'SHIELD SAVE!', '#7dffd4', 24);
          addShake(effects, 5);
          events |= EVENT_SHIELD;
        } else {
          ball.active = false;
        }
      }
    }

    // Wraiths move; spitters fire; a weaver that reaches the paddle line bursts.
    if (!attract) {
      const weaverLanded = updateEnemies(enemies, dt, state.time, (enemy) => {
        spawnShard(enemy.x + enemy.w / 2, enemy.y + enemy.h, 0);
        events |= EVENT_SHARD;
      });
      if (weaverLanded) {
        resetCombo();
        addShake(effects, 6);
        addFlash(effects, '#c792ff', 0.2);
        spawnFloatingText(effects, FIELD.width / 2, 560, 'WRAITH ESCAPED — COMBO LOST', '#c792ff', 22);
        events |= EVENT_WEAVER;
      }
    }

    // The warden patrols, fires volleys and calls minions; a new phase roars.
    if (!attract && boss.active) {
      const phaseChanged = updateBoss(boss, dt, (count) => {
        const cx = boss.x + boss.w / 2;
        const spreads = count === 1 ? [0] : count === 2 ? [-50, 50] : [-80, 0, 80];
        for (const vx of spreads) spawnShard(cx + vx * 0.4, boss.y + boss.h, vx);
        events |= EVENT_SHARD;
      }, () => {
        const kind = boss.key === 'core' && random() < 0.5 ? 'weaver' : 'drifter';
        spawnEnemy(enemies, kind, boss.x + boss.w / 2, boss.y + boss.h + 10, random);
      });
      if (phaseChanged) {
        state.banner = `${boss.name} — PHASE ${boss.phase}`;
        state.bannerTimer = 1.8;
        addShake(effects, 10);
        addFlash(effects, '#ff5c3d', 0.25);
        events |= EVENT_PHASE;
      }
    }

    // Falling void shards: dodge them, or the paddle shrinks and the combo breaks.
    for (const shard of shards) {
      if (!shard.active) continue;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (shard.y > FIELD.height + 20 || shard.x < -20 || shard.x > FIELD.width + 20) {
        shard.active = false;
        continue;
      }
      if (!attract && shard.y + SHARD.height / 2 >= PADDLE.y && shard.y - SHARD.height / 2 <= PADDLE.y + PADDLE.height
        && shard.x + SHARD.width / 2 >= paddle.x && shard.x - SHARD.width / 2 <= paddle.x + paddle.width) {
        shard.active = false;
        state.stats.shardsTaken += 1;
        paddle.narrowTimer = PADDLE.narrowSeconds;
        paddle.wideTimer = 0;
        resetCombo();
        burst(shard.x, PADDLE.y, '#ff4d6d', 14);
        addShake(effects, 7);
        addFlash(effects, '#ff4d6d', 0.2);
        spawnFloatingText(effects, shard.x, PADDLE.y - 30, 'SHARD HIT!', '#ff4d6d', 22);
        events |= EVENT_SHARD_HIT;
      }
    }

    // Falling powerups.
    for (const p of powerups) {
      if (!p.active) continue;
      p.y += POWERUP.fallSpeed * dt;
      if (p.y > FIELD.height) {
        p.active = false;
        continue;
      }
      const half = POWERUP.size / 2;
      if (p.y + half >= PADDLE.y && p.y - half <= PADDLE.y + PADDLE.height
        && p.x + half >= paddle.x && p.x - half <= paddle.x + paddle.width) {
        p.active = false;
        burst(p.x, p.y, '#ffd75e', 10);
        events |= applyPowerup(p.kind);
      }
    }

    // Particles and juice.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
    }
    updateEffects(effects, dt);
    for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);

    if (attract) return events;

    // A ball lost: a life goes only when no ball is left in play.
    if (!balls.some((b) => b.active)) {
      state.lives -= 1;
      state.levelLost += 1;
      resetCombo();
      addShake(effects, 9);
      addFlash(effects, '#ff5c7a', 0.25);
      events |= EVENT_LOST;
      if (state.lives <= 0) {
        events |= EVENT_OVER;
        return events;
      }
      paddle.width = PADDLE.width;
      paddle.wideTimer = 0;
      paddle.laserTimer = 0;
      paddle.narrowTimer = 0;
      state.slowTimer = 0;
      state.fireballTimer = 0;
      state.catchTimer = 0;
      serveBall();
    }

    // The warden fell: the level is complete.
    if (state.bossPhase && state.bossSlain) {
      return completeLevel(events);
    }

    // Wall cleared: a warden rises, the next wall opens, or the game is won.
    if (!state.bossPhase && breakableLeft() === 0) {
      const wall = WALLS[state.level - 1];
      if (wall.boss !== null) {
        return beginBossPhase(events);
      }
      return completeLevel(events);
    }
    return events;
  }

  reset();
  return {
    state, reset, resetAt, step, loadLevel, serveBall, breakableLeft,
    enemiesLeft: () => enemiesLeft(enemies),
  };
}

// LUMENBREAK's rules and state, with no drawing and no browser in it: the paddle, the
// balls, the crystal walls, falling powerups, laser bolts and particles, collisions,
// score, combo, lives and levels. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (and play sounds) without the world
// knowing about screens. Nothing here allocates after createWorld returns, and nothing
// here reads the clock: the same seed and inputs always give the same game.
import {
  BALL, BRICK, COMBO, FIELD, LASER, LEVELS, LIVES, MAX_LIVES, PADDLE, POOL, POWERUP,
} from './config.js';
import { WALLS, hitsOf, isBreakable, kindOf } from './levels.js';
import { randomPick } from './random.js';

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

const POWERUP_WEIGHTS = ['W', 'M', 'L', 'S', 'W', 'M', 'L', 'S', '+'];

function circleRect(ball, rect) {
  const cx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return { hit: dx * dx + dy * dy < ball.r * ball.r, nx: dx, ny: dy, dist2: dx * dx + dy * dy };
}

export function createWorld(random) {
  const paddle = { x: 0, width: PADDLE.width, wideTimer: 0, laserTimer: 0, laserCooldown: 0 };
  const balls = [];
  for (let i = 0; i < POOL.balls; i += 1) {
    balls.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: BALL.radius, stuck: false });
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
  const state = {
    paddle, balls, bricks, powerups, bolts, particles,
    score: 0, lives: LIVES, level: 1, combo: 0, multiplier: 1,
    slowTimer: 0, broken: 0, caught: 0, fired: 0,
    banner: '', bannerTimer: 0, levelName: '',
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

  function loadLevel(number) {
    const wall = WALLS[number - 1];
    state.level = number;
    state.levelName = wall.name;
    state.broken = 0;
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
  }

  function reset() {
    paddle.x = (FIELD.width - PADDLE.width) / 2;
    paddle.width = PADDLE.width;
    paddle.wideTimer = 0;
    paddle.laserTimer = 0;
    paddle.laserCooldown = 0;
    for (const ball of balls) ball.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.multiplier = 1;
    state.slowTimer = 0;
    state.caught = 0;
    state.fired = 0;
    loadLevel(1);
    serveBall();
  }

  function breakableLeft() {
    let n = 0;
    for (const b of bricks) if (b.active && isBreakable(b.kind)) n += 1;
    return n;
  }

  function dropPowerup(x, y) {
    if (random() > BRICK.dropChance) return;
    const p = freePowerup();
    if (p === null) return;
    p.active = true;
    p.kind = randomPick(random, POWERUP_WEIGHTS);
    p.x = x;
    p.y = y;
  }

  /** Damage one brick by 1. Returns true when it broke. Ember breaks chain to neighbours. */
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
    state.combo += 1;
    state.multiplier = Math.min(state.combo, COMBO.maxMultiplier);
    const points = brick.kind === 'hard' ? BRICK.hardPoints : brick.kind === 'ember' ? BRICK.emberPoints : BRICK.points;
    state.score += points * state.multiplier;
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    burst(cx, cy, brick.kind === 'ember' ? '#ff7a2f' : '#b45cff', brick.kind === 'ember' ? 26 : 16);
    dropPowerup(cx, cy);
    events |= EVENT_BRICK;
    if (brick.kind === 'ember') {
      for (const other of bricks) {
        if (!other.active || other === brick) continue;
        if (Math.abs(other.col - brick.col) <= 1 && Math.abs(other.row - brick.row) <= 1) chain.push(other);
      }
    }
    return events;
  }

  function applyPowerup(kind) {
    state.caught += 1;
    if (kind === 'W') {
      paddle.wideTimer = PADDLE.wideSeconds;
      paddle.width = PADDLE.wideWidth;
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
        }
        if (balls.filter((b) => b.active).length >= POOL.balls) break;
      }
    } else if (kind === 'L') {
      paddle.laserTimer = PADDLE.laserSeconds;
    } else if (kind === 'S') {
      state.slowTimer = BALL.slowSeconds;
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

  /**
   * One fixed step. `control` is { direction (-1, 0, 1), mouseX (number or null),
   * launch (bool), fire (bool) }. With `attract` set (the title screen's demo) the
   * ball bounces off the bottom, bricks never break and nothing scores.
   */
  function step(dt, control, attract) {
    let events = 0;
    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (paddle.wideTimer > 0) {
      paddle.wideTimer -= dt;
      if (paddle.wideTimer <= 0) paddle.width = PADDLE.width;
    }
    if (paddle.laserTimer > 0) paddle.laserTimer -= dt;
    if (paddle.laserCooldown > 0) paddle.laserCooldown -= dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;

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

    // Laser bolts: straight up, one brick of damage each.
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.y -= LASER.speed * dt;
      if (bolt.y < FIELD.top - 40) {
        bolt.active = false;
        continue;
      }
      for (const brick of bricks) {
        if (!brick.active) continue;
        if (bolt.x > brick.x && bolt.x < brick.x + brick.w && bolt.y > brick.y && bolt.y < brick.y + brick.h) {
          bolt.active = false;
          if (brick.kind === 'steel') {
            brick.flash = 0.12;
            events |= EVENT_TINK;
          } else {
            const chain = [];
            events |= damageBrick(brick, 0, chain);
            while (chain.length > 0) events |= damageBrick(chain.pop(), 0, chain);
          }
          break;
        }
      }
    }

    // Balls.
    for (const ball of balls) {
      if (!ball.active || ball.stuck) continue;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
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
      if (ball.vy > 0 && ball.y + ball.r >= PADDLE.y && ball.y + ball.r <= PADDLE.y + PADDLE.height + 8
        && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.width + ball.r) {
        const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2)));
        const speed = ballSpeed();
        const angle = -Math.PI / 2 + offset * 1.05;
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = PADDLE.y - ball.r - 0.5;
        state.combo = 0;
        state.multiplier = 1;
        events |= EVENT_PADDLE;
      }
      // Bricks: reflect off the closest point's normal, then damage.
      for (const brick of bricks) {
        if (!brick.active) continue;
        const hit = circleRect(ball, brick);
        if (!hit.hit) continue;
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
        if (attract) {
          brick.flash = 0.12;
          events |= EVENT_TINK;
        } else if (brick.kind === 'steel') {
          brick.flash = 0.12;
          burst(ball.x, ball.y, '#d7deea', 4);
          events |= EVENT_TINK;
        } else {
          const chain = [];
          events |= damageBrick(brick, 0, chain);
          while (chain.length > 0) events |= damageBrick(chain.pop(), 0, chain);
        }
        break;
      }
      // Lost below the field.
      if (ball.y - ball.r > FIELD.height) {
        ball.active = false;
        if (attract) {
          serveBall();
          const served = balls.find((b) => b.active && b.stuck);
          if (served !== undefined) launchBall(served);
        }
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

    // Particles.
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
    for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);

    if (attract) return events;

    // A ball lost: a life goes only when no ball is left in play.
    if (!balls.some((b) => b.active)) {
      state.lives -= 1;
      state.combo = 0;
      state.multiplier = 1;
      events |= EVENT_LOST;
      if (state.lives <= 0) {
        events |= EVENT_OVER;
        return events;
      }
      paddle.width = PADDLE.width;
      paddle.wideTimer = 0;
      paddle.laserTimer = 0;
      state.slowTimer = 0;
      serveBall();
    }

    // Wall cleared: next wall, or the win.
    if (breakableLeft() === 0) {
      for (const b of balls) b.active = false;
      for (const p of powerups) p.active = false;
      for (const bolt of bolts) bolt.active = false;
      if (state.level >= LEVELS) {
        events |= EVENT_WIN;
      } else {
        events |= EVENT_CLEAR;
        loadLevel(state.level + 1);
        serveBall();
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, loadLevel, serveBall, breakableLeft };
}

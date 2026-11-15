// The game's rules and state, with no drawing and no browser in it: the paddle, the balls,
// the crystal bricks, the falling powerups, the particles and the score. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react (sounds, screens)
// without the world knowing about screens or sound. Nothing here allocates after createWorld
// returns, and every random choice comes from the seeded generator, so the same seed and the
// same inputs always play the same game.

import { BALL, BRICK, FIELD, LEVEL_COUNT, LIVES, MAX_LIVES, PADDLE, POOL, POWERUP, SCORE } from './config.js';
import { LEVELS } from './levels.js';

export const KIND_CRYSTAL = 'crystal';
export const KIND_STEEL = 'steel';
export const KIND_EMBER = 'ember';
export const KIND_BONUS = 'bonus';

export const POWER_KINDS = ['W', 'M', 'L', 'S', '+'];

export const EVENT_BRICK = 1;
export const EVENT_PADDLE = 2;
export const EVENT_WALL = 4;
export const EVENT_LOST = 8;
export const EVENT_OVER = 16;
export const EVENT_CLEAR = 32;
export const EVENT_WIN = 64;
export const EVENT_POWER = 128;
export const EVENT_LIFE = 256;
export const EVENT_LAUNCH = 512;
export const EVENT_EMBER = 1024;
export const EVENT_LASER = 2048;

const POWERUP_COLORS = { W: '#37e0c8', M: '#ff5da2', L: '#ffc53d', S: '#4fd8ff', '+': '#5dff8f' };
const BRICK_COLORS = { 1: '#37e0c8', 2: '#ff5da2', 3: '#ffc53d' };

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWorld(random) {
  const paddle = { x: 0, width: PADDLE.width, wideTimer: 0, laserTimer: 0 };
  const balls = [];
  for (let index = 0; index < POOL.balls; index += 1) {
    balls.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const powerups = [];
  for (let index = 0; index < POOL.powerups; index += 1) {
    powerups.push({ active: false, x: 0, y: 0, kind: 'W' });
  }
  const bolts = [];
  for (let index = 0; index < POOL.bolts; index += 1) {
    bolts.push({ active: false, x: 0, y: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const floaters = [];
  for (let index = 0; index < POOL.floaters; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  }
  const bricks = [];
  const state = {
    paddle,
    balls,
    bricks,
    powerups,
    bolts,
    particles,
    floaters,
    score: 0,
    combo: 0,
    lives: LIVES,
    levelIndex: 0,
    mode: 'serve',
    time: 0,
    shake: 0,
    slowTimer: 0,
  };

  function ballSpeed() {
    const base = Math.min(BALL.maxSpeed, BALL.speed + BALL.speedPerLevel * state.levelIndex);
    return state.slowTimer > 0 ? base * BALL.slowFactor : base;
  }

  function multiplier() {
    return Math.min(SCORE.maxMultiplier, 1 + Math.floor(state.combo / SCORE.perTier));
  }

  function freeBall() {
    for (let index = 0; index < balls.length; index += 1) if (!balls[index].active) return balls[index];
    return null;
  }

  function freePowerup() {
    for (let index = 0; index < powerups.length; index += 1) if (!powerups[index].active) return powerups[index];
    return null;
  }

  function freeBolt() {
    for (let index = 0; index < bolts.length; index += 1) if (!bolts[index].active) return bolts[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function freeFloater() {
    for (let index = 0; index < floaters.length; index += 1) if (!floaters[index].active) return floaters[index];
    return null;
  }

  function spawnBurst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const particle = freeParticle();
      if (particle === null) return;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.35 + random() * 0.65);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power;
      particle.maxLife = 0.35 + random() * 0.45;
      particle.life = particle.maxLife;
      particle.size = 2 + random() * 3;
      particle.color = color;
    }
  }

  function spawnFloater(x, y, text) {
    const floater = freeFloater();
    if (floater === null) return;
    floater.active = true;
    floater.x = x;
    floater.y = y;
    floater.text = text;
    floater.life = 0.9;
  }

  function brickColor(brick) {
    if (brick.kind === KIND_STEEL) return '#8a93a6';
    if (brick.kind === KIND_EMBER) return '#ff7a1a';
    if (brick.kind === KIND_BONUS) return '#b78cff';
    return BRICK_COLORS[brick.hp] ?? '#37e0c8';
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    bricks.length = 0;
    for (let row = 0; row < level.rows.length; row += 1) {
      const line = level.rows[row];
      for (let col = 0; col < BRICK.cols; col += 1) {
        const cell = line[col] ?? '.';
        if (cell === '.') continue;
        const kind = cell === 'X' ? KIND_STEEL : cell === 'E' ? KIND_EMBER : cell === 'B' ? KIND_BONUS : KIND_CRYSTAL;
        const hp = cell === 'X' ? 0 : cell === 'E' || cell === 'B' ? 1 : Number(cell);
        bricks.push({
          x: BRICK.left + col * (BRICK.width + BRICK.gapX),
          y: BRICK.top + row * (BRICK.height + BRICK.gapY),
          width: BRICK.width,
          height: BRICK.height,
          hp,
          maxHp: hp,
          kind,
          alive: true,
          flash: 0,
          row,
          col,
        });
      }
    }
    for (const ball of balls) ball.active = false;
    for (const powerup of powerups) powerup.active = false;
    for (const bolt of bolts) bolt.active = false;
    paddle.x = (FIELD.width - paddle.width) / 2;
    paddle.wideTimer = 0;
    paddle.laserTimer = 0;
    state.slowTimer = 0;
    state.levelIndex = index;
    state.mode = 'serve';
    serveBall();
  }

  function serveBall() {
    const ball = freeBall();
    if (ball === null) return;
    ball.active = true;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = PADDLE.y - BALL.radius - 1;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launch() {
    if (state.mode !== 'serve') return 0;
    const ball = balls.find((candidate) => candidate.active);
    if (ball === undefined) return 0;
    const speed = ballSpeed();
    const angle = (random() * 2 - 1) * 0.35;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    state.mode = 'play';
    return EVENT_LAUNCH;
  }

  function reset() {
    state.score = 0;
    state.combo = 0;
    state.lives = LIVES;
    state.time = 0;
    state.shake = 0;
    paddle.width = PADDLE.width;
    for (const particle of particles) particle.active = false;
    for (const floater of floaters) floater.active = false;
    loadLevel(0);
  }

  function bricksLeft() {
    let count = 0;
    for (let index = 0; index < bricks.length; index += 1) {
      if (bricks[index].alive && bricks[index].kind !== KIND_STEEL) count += 1;
    }
    return count;
  }

  function maybeDropPowerup(x, y, guaranteed) {
    if (!guaranteed && random() >= POWERUP.dropChance) return;
    const powerup = freePowerup();
    if (powerup === null) return;
    powerup.active = true;
    powerup.x = x;
    powerup.y = y;
    powerup.kind = POWER_KINDS[Math.floor(random() * POWER_KINDS.length)];
  }

  function damageBrick(brick, amount) {
    if (!brick.alive || brick.kind === KIND_STEEL) return 0;
    brick.hp -= amount;
    brick.flash = 0.12;
    if (brick.hp > 0) return EVENT_BRICK;
    brick.alive = false;
    state.combo += 1;
    const points = SCORE.brick * multiplier();
    state.score += points;
    spawnFloater(brick.x + brick.width / 2, brick.y, `+${points}`);
    spawnBurst(brick.x + brick.width / 2, brick.y + brick.height / 2, brickColor(brick), 14, 260);
    state.shake = Math.min(state.shake + 1.5, 6);
    let events = EVENT_BRICK;
    if (brick.kind === KIND_EMBER) {
      events |= EVENT_EMBER;
      for (let index = 0; index < bricks.length; index += 1) {
        const other = bricks[index];
        if (other === brick || !other.alive) continue;
        if (Math.abs(other.row - brick.row) <= 1 && Math.abs(other.col - brick.col) <= 1) {
          events |= damageBrick(other, 1);
        }
      }
    }
    maybeDropPowerup(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.kind === KIND_BONUS);
    if (bricksLeft() === 0) {
      events |= EVENT_CLEAR;
      if (state.levelIndex === LEVEL_COUNT - 1) events |= EVENT_WIN;
    }
    return events;
  }

  function applyPowerup(kind) {
    if (kind === 'W') {
      paddle.wideTimer = PADDLE.wideSeconds;
      paddle.width = PADDLE.wideWidth;
    } else if (kind === 'M') {
      const live = balls.filter((ball) => ball.active);
      for (const ball of live) {
        const copy = freeBall();
        if (copy === null) break;
        copy.active = true;
        copy.x = ball.x;
        copy.y = ball.y;
        copy.vx = -ball.vx || ballSpeed() * 0.4;
        copy.vy = ball.vy;
      }
    } else if (kind === 'L') {
      paddle.laserTimer = PADDLE.laserSeconds;
    } else if (kind === 'S') {
      state.slowTimer = BALL.slowSeconds;
    } else if (kind === '+') {
      if (state.lives < MAX_LIVES) state.lives += 1;
      return EVENT_POWER | EVENT_LIFE;
    }
    return EVENT_POWER;
  }

  function fireLaser() {
    if (paddle.laserTimer <= 0 || state.mode !== 'play') return 0;
    let fired = false;
    for (const side of [-1, 1]) {
      const bolt = freeBolt();
      if (bolt === null) continue;
      bolt.active = true;
      bolt.x = paddle.x + paddle.width / 2 + side * (paddle.width / 2 - 10);
      bolt.y = PADDLE.y - 6;
      fired = true;
    }
    return fired ? EVENT_LASER : 0;
  }

  function stepFx(dt) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 300 * dt;
    }
    for (let index = 0; index < floaters.length; index += 1) {
      const floater = floaters[index];
      if (!floater.active) continue;
      floater.life -= dt;
      if (floater.life <= 0) floater.active = false;
      else floater.y -= 42 * dt;
    }
    for (let index = 0; index < bricks.length; index += 1) {
      if (bricks[index].flash > 0) bricks[index].flash = Math.max(0, bricks[index].flash - dt);
    }
  }

  /**
   * One fixed step. `input` is { direction, pointerX, fire }; `harmless` is the title
   * screen's demo: the ball bounces but nothing breaks and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    stepFx(dt);
    if (paddle.wideTimer > 0) {
      paddle.wideTimer -= dt;
      if (paddle.wideTimer <= 0) paddle.width = PADDLE.width;
    }
    if (paddle.laserTimer > 0) paddle.laserTimer -= dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;

    // The paddle: the mouse steers it straight to its x; the keys drive it at full speed.
    if (harmless) {
      const ball = balls.find((candidate) => candidate.active);
      const target = ball === undefined ? FIELD.width / 2 : ball.x;
      const wanted = Math.max(0, Math.min(FIELD.width - paddle.width, target - paddle.width / 2));
      const delta = wanted - paddle.x;
      paddle.x += Math.max(-PADDLE.speed * dt, Math.min(PADDLE.speed * dt, delta));
    } else if (input.pointerX !== null && input.pointerX !== undefined) {
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, input.pointerX - paddle.width / 2));
    } else {
      paddle.x = Math.max(0, Math.min(FIELD.width - paddle.width, paddle.x + input.direction * PADDLE.speed * dt));
    }
    if (input.fire) events |= fireLaser();
    const centre = paddle.x + paddle.width / 2;

    if (state.mode === 'serve') {
      const ball = balls.find((candidate) => candidate.active);
      if (ball !== undefined) {
        ball.x = paddle.x + paddle.width / 2;
        ball.y = PADDLE.y - BALL.radius - 1;
      }
      return events;
    }

    for (let index = 0; index < balls.length; index += 1) {
      const ball = balls[index];
      if (!ball.active) continue;
      const prevX = ball.x;
      const prevY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - BALL.radius < 0) {
        ball.x = BALL.radius;
        ball.vx = Math.abs(ball.vx);
        events |= EVENT_WALL;
      } else if (ball.x + BALL.radius > FIELD.width) {
        ball.x = FIELD.width - BALL.radius;
        ball.vx = -Math.abs(ball.vx);
        events |= EVENT_WALL;
      }
      if (ball.y - BALL.radius < 0) {
        ball.y = BALL.radius;
        ball.vy = Math.abs(ball.vy);
        events |= EVENT_WALL;
      }

      // The paddle: bounce up, steeper the further from its centre the ball lands.
      if (ball.vy > 0 && ball.y + BALL.radius >= PADDLE.y && ball.y - BALL.radius <= PADDLE.y + PADDLE.height
        && ball.x >= paddle.x - BALL.radius && ball.x <= paddle.x + paddle.width + BALL.radius) {
        const offset = Math.max(-1, Math.min(1, (ball.x - centre) / (paddle.width / 2)));
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = offset * BALL.maxAngle;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = PADDLE.y - BALL.radius - 0.5;
        spawnBurst(ball.x, PADDLE.y, '#e8f6ff', 4, 120);
        events |= EVENT_PADDLE;
      }

      // The bricks: a circle against a box, reflected on the side it came from.
      for (let brickIndex = 0; brickIndex < bricks.length; brickIndex += 1) {
        const brick = bricks[brickIndex];
        if (!brick.alive) continue;
        const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        const dx = ball.x - nearestX;
        const dy = ball.y - nearestY;
        if (dx * dx + dy * dy >= BALL.radius * BALL.radius) continue;
        const fromTop = prevY + BALL.radius <= brick.y;
        const fromBottom = prevY - BALL.radius >= brick.y + brick.height;
        if (fromTop || fromBottom) {
          ball.vy = fromTop ? -Math.abs(ball.vy) : Math.abs(ball.vy);
          ball.y = fromTop ? brick.y - BALL.radius - 0.5 : brick.y + brick.height + BALL.radius + 0.5;
        } else {
          const fromLeft = prevX + BALL.radius <= brick.x;
          ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
          ball.x = fromLeft ? brick.x - BALL.radius - 0.5 : brick.x + brick.width + BALL.radius + 0.5;
        }
        if (harmless) {
          events |= EVENT_BRICK;
        } else if (brick.kind === KIND_STEEL) {
          spawnBurst(ball.x, ball.y, '#8a93a6', 4, 140);
          events |= EVENT_BRICK;
        } else {
          events |= damageBrick(brick, 1);
        }
        break;
      }

      if (ball.y - BALL.radius > FIELD.height) {
        ball.active = false;
        spawnBurst(ball.x, FIELD.height - 8, '#ff5d5d', 16, 220);
      }
    }

    // The laser bolts: straight up, one hit each.
    for (let index = 0; index < bolts.length; index += 1) {
      const bolt = bolts[index];
      if (!bolt.active) continue;
      bolt.y -= 900 * dt;
      if (bolt.y < 0) {
        bolt.active = false;
        continue;
      }
      for (let brickIndex = 0; brickIndex < bricks.length; brickIndex += 1) {
        const brick = bricks[brickIndex];
        if (!brick.alive) continue;
        if (bolt.x < brick.x || bolt.x > brick.x + brick.width || bolt.y < brick.y || bolt.y > brick.y + brick.height) continue;
        bolt.active = false;
        if (brick.kind !== KIND_STEEL && !harmless) events |= damageBrick(brick, 1);
        else spawnBurst(bolt.x, bolt.y, '#ffc53d', 5, 160);
        break;
      }
    }

    // The powerups: they fall, and the paddle catches them.
    for (let index = 0; index < powerups.length; index += 1) {
      const powerup = powerups[index];
      if (!powerup.active) continue;
      powerup.y += POWERUP.fallSpeed * dt;
      if (powerup.y > FIELD.height) {
        powerup.active = false;
        continue;
      }
      const box = { x: powerup.x - POWERUP.size / 2, y: powerup.y - POWERUP.size / 2, width: POWERUP.size, height: POWERUP.size };
      const paddleBox = { x: paddle.x, y: PADDLE.y, width: paddle.width, height: PADDLE.height };
      if (!harmless && overlaps(box, paddleBox)) {
        powerup.active = false;
        spawnBurst(powerup.x, powerup.y, POWERUP_COLORS[powerup.kind], 10, 180);
        events |= applyPowerup(powerup.kind);
      }
    }

    // A ball lost: when none is left, a life goes and the next ball serves. In the title
    // demo nothing is lost: the ball just serves again and keeps playing behind the panel.
    if (harmless && !balls.some((ball) => ball.active)) {
      state.mode = 'serve';
      serveBall();
      launch();
    }
    if (!harmless && state.mode === 'play' && !balls.some((ball) => ball.active)) {
      state.lives -= 1;
      state.combo = 0;
      state.shake = 12;
      if (state.lives <= 0) {
        events |= EVENT_LOST | EVENT_OVER;
      } else {
        events |= EVENT_LOST;
        state.mode = 'serve';
        serveBall();
      }
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, launch, fireLaser, step, stepFx, multiplier, bricksLeft };
}

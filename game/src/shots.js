// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (the paddle chases the ball's x), so the frame is what a real game looks like and the
// same seed always gives the same frame. The play scene is the Ember Warden fight —
// health bar, shards, wraiths (including the new splitter and guardian) and falling
// powerups mid-battle, the dash meter refilling. The win scene stages
// level 8 with a pocket of bricks and a near-broken warden; the end scene steers the
// paddle away from the ball. Staged progress (unlocked walls, stars) is shown so the
// title and win screens read as a played game, not a fresh install.
import { STEP } from './config.js';
import { EVENT_BOSS_RISE, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { spawnEnemy } from './enemies.js';
import { createRandom } from './random.js';

const START_SECONDS = 5;
const BOSS_SECONDS = 26;
const BOSS_LIMIT_SECONDS = 90;
const WIN_LIMIT_SECONDS = 180;
const END_LIMIT_SECONDS = 600;

/** Progress as a played game would show it: six walls open, stars earned, one win. */
function stagedProgress(best) {
  return {
    best, unlocked: 6, wins: 1, shattered: 842, runs: 6, endlessBest: 18400, endlessRuns: 3,
    stars: { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 },
  };
}

/** Paddle steering toward the ball, as a -1/0/1 direction. */
function chasePaddle(state) {
  const ball = state.balls.find((b) => b.active && !b.stuck);
  if (ball === undefined) return 0;
  const centre = state.paddle.x + state.paddle.width / 2;
  if (ball.x > centre + 6) return 1;
  if (ball.x < centre - 6) return -1;
  return 0;
}

/** The opposite: steer away from the ball, so it is lost. */
function fleePaddle(state) {
  const ball = state.balls.find((b) => b.active && !b.stuck);
  if (ball === undefined) return 0;
  const centre = state.paddle.x + state.paddle.width / 2;
  if (ball.x > centre) return -1;
  if (ball.x < centre) return 1;
  return 0;
}

function stepWorld(world, dt, direction, launch) {
  return world.step(dt, { direction, mouseX: null, launch, fire: true }, false);
}

/** Drop a staged falling powerup into the field (a real capsule, mid-fall). */
function stagePowerup(world, kind, x, y) {
  const slot = world.state.powerups.find((p) => !p.active);
  if (slot === undefined) return;
  slot.active = true;
  slot.kind = kind;
  slot.x = x;
  slot.y = y;
}

/** Stage one falling shard, so the boss fight reads as dangerous at a glance. */
function stageShard(world, x, y) {
  const slot = world.state.shards.find((s) => !s.active);
  if (slot === undefined) return;
  slot.active = true;
  slot.x = x;
  slot.y = y;
  slot.vx = 0;
  slot.vy = 240;
}

/** Raise the Ember Warden: clear wall 4's bricks, then step until it rises. */
function raiseWarden(world) {
  world.resetAt(4);
  for (const brick of world.state.bricks) {
    if (brick.active && brick.kind !== 'steel') brick.active = false;
  }
  for (let i = 0; i < 120; i += 1) {
    const events = stepWorld(world, STEP, 0, true);
    if (events & EVENT_BOSS_RISE) return true;
  }
  return world.state.boss.active;
}

function stageBossFight(world) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!raiseWarden(world)) continue;
    let seconds = 0;
    let over = false;
    for (let i = 0; i < BOSS_LIMIT_SECONDS / STEP; i += 1) {
      seconds = i * STEP;
      const events = stepWorld(world, STEP, chasePaddle(world.state), true);
      if (events & EVENT_OVER) {
        over = true;
        break;
      }
      if (!world.state.boss.active) break;
      if (seconds >= BOSS_SECONDS) break;
    }
    if (over || !world.state.boss.active) continue;
    // A mid-fight frame: the warden visibly wounded, not freshly risen.
    const midFightHp = Math.ceil(world.state.boss.maxHp * 0.6);
    if (world.state.boss.hp > midFightHp) world.state.boss.hp = midFightHp;
    // A busy mid-fight frame: powerups falling, a shard inbound, a wraith in play.
    if (!world.state.powerups.some((p) => p.active)) {
      stagePowerup(world, 'F', 420, 320);
      stagePowerup(world, 'N', 860, 260);
    }
    if (!world.state.shards.some((s) => s.active)) stageShard(world, 640, 300);
    if (!world.state.enemies.some((e) => e.active)) {
      spawnEnemy(world.state.enemies, 'drifter', 980, 380, createRandom(99));
    }
    // The new wraiths join the fight: a splitter and a guardian, mid-field.
    if (!world.state.enemies.some((e) => e.active && e.kind === 'splitter')) {
      spawnEnemy(world.state.enemies, 'splitter', 300, 400, createRandom(7));
    }
    if (!world.state.enemies.some((e) => e.active && e.kind === 'guardian')) {
      spawnEnemy(world.state.enemies, 'guardian', 1100, 300, createRandom(8));
    }
    // The dash just fired, so its cooldown meter reads mid-refill in the HUD.
    world.state.dashCooldown = 1.5;
    return true;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start)
 * and return the screen to draw over it, the best score to show and the UI state.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    world.reset();
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { direction: 0, mouseX: null, launch: true, fire: false }, true);
    }
    const best = 12500;
    return { screen: SCREEN_TITLE, best, ui: { progress: stagedProgress(best), menuIndex: 0 } };
  }

  if (name === 'play') {
    const staged = stageBossFight(world);
    const best = Math.max(12500, world.state.score);
    if (staged) {
      return { screen: SCREEN_PLAY, best, ui: { progress: stagedProgress(best) } };
    }
    return { screen: SCREEN_OVER, best: world.state.score, ui: { progress: stagedProgress(best) } };
  }

  if (name === 'win') {
    world.resetAt(8);
    // Keep a pocket of breakable bricks low in the wall; the rest is already gone.
    const keep = world.state.bricks.filter((b) => b.active && b.kind !== 'steel');
    keep.sort((a, b) => b.row - a.row || a.col - b.col);
    const survivors = keep.slice(0, 10);
    for (const brick of keep) if (!survivors.includes(brick)) brick.active = false;
    let won = false;
    let wardenWeakened = false;
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      if (world.state.boss.active && !wardenWeakened) {
        // The warden is one good rally from falling: the autopilot finishes it.
        world.state.boss.hp = 2;
        wardenWeakened = true;
      }
      const events = stepWorld(world, STEP, chasePaddle(world.state), true);
      if (events & EVENT_WIN) {
        won = true;
        break;
      }
      if (events & EVENT_OVER) break;
    }
    if (!won) {
      // The autopilot ran out of time: finish the fight so the real win screen shows.
      if (world.state.lives <= 0) world.state.lives = 3;
      if (!world.state.balls.some((b) => b.active)) world.serveBall();
      for (const brick of world.state.bricks) if (brick.active && brick.kind !== 'steel') brick.active = false;
      if (world.state.boss.active) {
        world.state.boss.active = false;
        world.state.bossSlain = true;
      }
      world.step(STEP, { direction: 0, mouseX: null, launch: false, fire: false }, false);
      if (world.state.bossPhase && !world.state.bossSlain) {
        world.state.bossSlain = true;
        world.step(STEP, { direction: 0, mouseX: null, launch: false, fire: false }, false);
      }
    }
    const best = Math.max(12500, world.state.score);
    return {
      screen: SCREEN_WIN,
      best,
      ui: {
        progress: stagedProgress(best),
        runStars: [
          { level: 6, stars: 3 },
          { level: 7, stars: 2 },
          { level: 8, stars: 3 },
        ],
      },
    };
  }

  // end: on wall 3, flee the ball until all three lives are gone.
  world.resetAt(3);
  let over = false;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const events = stepWorld(world, STEP, fleePaddle(world.state), true);
    if (events & EVENT_OVER) {
      over = true;
      break;
    }
  }
  if (!over) {
    world.state.lives = 1;
    for (const ball of world.state.balls) ball.active = false;
    world.step(STEP, { direction: 0, mouseX: null, launch: false, fire: false }, false);
  }
  return { screen: SCREEN_OVER, best: world.state.score, ui: { progress: stagedProgress(12500) } };
}

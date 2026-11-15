// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (the paddle chases the ball's x), so the frame is what a short game really looks
// like and the same seed always gives the same frame. The win scene stages level 6
// with only a few bricks left, and the end scene steers the paddle away from the ball.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const PLAY_LIMIT_SECONDS = 60;
const WIN_LIMIT_SECONDS = 120;
const END_LIMIT_SECONDS = 600;

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
  return world.step(dt, { direction, mouseX: null, launch, fire: false }, false);
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    world.reset();
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { direction: 0, mouseX: null, launch: true, fire: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      let over = false;
      let seconds = 0;
      for (let i = 0; i < PLAY_LIMIT_SECONDS / STEP; i += 1) {
        seconds = i * STEP;
        const events = stepWorld(world, STEP, chasePaddle(world.state), true);
        if (events & EVENT_OVER) {
          over = true;
          break;
        }
        if (seconds >= PLAY_SECONDS && world.state.score > 0) break;
      }
      if (!over) return { screen: SCREEN_PLAY, best: world.state.score };
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }

  if (name === 'win') {
    world.reset();
    world.loadLevel(6);
    // Keep a pocket of breakable bricks low in the wall; the rest is already gone.
    // Sixteen is the sweet spot a quick simulation found: the ball reaches them
    // often enough to win in well under the time limit.
    const keep = world.state.bricks.filter((b) => b.active && b.kind !== 'steel');
    keep.sort((a, b) => b.row - a.row || a.col - b.col);
    const survivors = keep.slice(0, 16);
    for (const brick of keep) if (!survivors.includes(brick)) brick.active = false;
    let won = false;
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      const events = stepWorld(world, STEP, chasePaddle(world.state), true);
      if (events & EVENT_WIN) {
        won = true;
        break;
      }
      if (events & EVENT_OVER) break;
    }
    if (!won) {
      // The autopilot ran out of time: clear the last bricks so the real win screen shows.
      if (world.state.lives <= 0) world.state.lives = 3;
      if (!world.state.balls.some((b) => b.active)) world.serveBall();
      for (const brick of world.state.bricks) if (brick.active && brick.kind !== 'steel') brick.active = false;
      world.step(STEP, { direction: 0, mouseX: null, launch: false, fire: false }, false);
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }

  // end: flee the ball until all three lives are gone.
  world.reset();
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
  return { screen: SCREEN_OVER, best: world.state.score };
}

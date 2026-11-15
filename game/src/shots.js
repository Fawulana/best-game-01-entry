// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (predict where the ball will reach the paddle, go there, launch when serving, fire the
// laser when it has one), so the frame is what a short game really looks like and the same
// seed always gives the same frame. The win scene plays all six levels through; it returns
// null when a level takes too long to clear, and the caller falls back to another scene.

import { BALL, FIELD, PADDLE, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN, KIND_STEEL } from './world.js';
import { SCREEN_CLEAR, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const LEVEL_CAP_SECONDS = 600;
const END_LIMIT_SECONDS = 600;
const DEAD_ZONE = 6;

/** Where the ball will be when it reaches the paddle's height, folding off the walls. */
function predictedX(state) {
  let ball = null;
  for (let index = 0; index < state.balls.length; index += 1) {
    const candidate = state.balls[index];
    if (candidate.active && (ball === null || candidate.y > ball.y)) ball = candidate;
  }
  if (ball === null) return FIELD.width / 2;
  if (ball.vy <= 0) return ball.x;
  const time = (PADDLE.y - ball.y) / ball.vy;
  let x = ball.x + ball.vx * time;
  const min = BALL.radius;
  const max = FIELD.width - BALL.radius;
  let guard = 0;
  while ((x < min || x > max) && guard < 8) {
    if (x < min) x = min + (min - x);
    else if (x > max) x = max - (x - max);
    guard += 1;
  }
  return Math.max(min, Math.min(max, x));
}

/** The lowest breakable brick still standing: the one the autopilot aims at. */
function lowestBrick(state) {
  let best = null;
  for (let index = 0; index < state.bricks.length; index += 1) {
    const brick = state.bricks[index];
    if (!brick.alive || brick.kind === KIND_STEEL) continue;
    if (best === null || brick.y > best.y) best = brick;
  }
  return best;
}

/** The steering for one step: move toward the predicted landing spot, launch when serving. */
export function autopilot(state) {
  const centre = state.paddle.x + state.paddle.width / 2;
  const fire = state.paddle.laserTimer > 0;
  const launch = state.mode === 'serve';
  let ball = null;
  for (let index = 0; index < state.balls.length; index += 1) {
    const candidate = state.balls[index];
    if (candidate.active && (ball === null || candidate.y > ball.y)) ball = candidate;
  }
  if (ball === null) return { direction: 0, pointerX: null, fire, launch };
  // A ball falling toward the paddle is steered by where it lands on it: aim the rebound
  // at the lowest brick still standing, so the endgame does not drag on.
  if (ball.vy > 0) {
    const target = lowestBrick(state);
    if (target !== null) {
      const landX = predictedX(state);
      const aim = Math.atan2(target.x + target.width / 2 - landX, PADDLE.y - target.y);
      const clamped = Math.max(-BALL.maxAngle, Math.min(BALL.maxAngle, aim));
      const wantCentre = landX - (clamped / BALL.maxAngle) * (state.paddle.width / 2);
      const direction = wantCentre > centre + DEAD_ZONE ? 1 : wantCentre < centre - DEAD_ZONE ? -1 : 0;
      return { direction, pointerX: null, fire, launch };
    }
  }
  const target = predictedX(state);
  const direction = target > centre + DEAD_ZONE ? 1 : target < centre - DEAD_ZONE ? -1 : 0;
  return { direction, pointerX: null, fire, launch };
}

/** The steering for the end scene: launch, then never move, so the ball is dropped. */
function idlePilot(state) {
  return { direction: 0, pointerX: null, fire: false, launch: state.mode === 'serve' };
}

function runSteps(world, seconds, pilot, harmless) {
  let events = 0;
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const input = pilot(world.state);
    if (input.launch) world.launch();
    events = world.step(STEP, input, harmless);
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
    if ((events & EVENT_CLEAR) && !(events & EVENT_WIN)) return events;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show. Returns null for the win
 * scene when the autopilot cannot clear a level inside its cap.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    world.launch();
    runSteps(world, START_SECONDS, autopilot, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    runSteps(world, END_LIMIT_SECONDS, idlePilot, false);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'play') {
    world.loadLevel(1);
    runSteps(world, PLAY_SECONDS, autopilot, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // win: play every level through with the autopilot, in order.
  for (let level = 0; level < 6; level += 1) {
    world.loadLevel(level);
    let cleared = false;
    for (let chunk = 0; chunk < LEVEL_CAP_SECONDS / 10; chunk += 1) {
      const events = runSteps(world, 10, autopilot, false);
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
      if (events & EVENT_CLEAR) {
        cleared = true;
        break;
      }
      if (events & EVENT_OVER) return null;
    }
    if (!cleared) return null;
  }
  return { screen: SCREEN_WIN, best: world.state.score };
}

export { SCREEN_CLEAR };

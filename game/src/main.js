// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, level clear, game over and win.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|win|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BRICK,
  EVENT_CLEAR,
  EVENT_EMBER,
  EVENT_LASER,
  EVENT_LAUNCH,
  EVENT_LIFE,
  EVENT_LOST,
  EVENT_OVER,
  EVENT_PADDLE,
  EVENT_POWER,
  EVENT_WALL,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_FIRE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long the level-clear banner shows before the next wall loads, in seconds. */
const CLEAR_SECONDS = 1.8;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The win scene can fail when the autopilot stalls on a wall: fall back to a play scene.
  const staged = scene ?? stageShot('play', world);
  const screen = scene === null ? SCREEN_PLAY : staged.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, staged.best, world.multiplier());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let clearTimer = 0;
  let last = performance.now();

  // The browser only allows sound after a gesture: unlock it on the first of either.
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  canvas.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes and each lost ball.
  function announce(message) {
    status.textContent = message;
  }

  // A small handle for play-testing: the live screen, score, lives, level and bricks left.
  function expose() {
    const ball = world.state.balls.find((candidate) => candidate.active);
    window.__game = {
      screen,
      score: world.state.score,
      lives: world.state.lives,
      level: world.state.levelIndex + 1,
      bricksLeft: world.bricksLeft(),
      balls: world.state.balls.filter((candidate) => candidate.active).length,
      ball: ball === undefined ? null : { x: Math.round(ball.x), y: Math.round(ball.y) },
      paddleX: Math.round(world.state.paddle.x),
    };
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Clear all six walls to win.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`You win! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.over();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function react(events) {
    if (events & EVENT_PADDLE) audio.paddle();
    if (events & EVENT_WALL) audio.wall();
    if (events & EVENT_BRICK) audio.brick(0);
    if (events & EVENT_EMBER) audio.ember();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_POWER) audio.power();
    if (events & EVENT_LAUNCH) audio.launch();
    if (events & EVENT_LOST) {
      audio.lose();
      announce(world.state.lives === 1 ? 'Ball lost. 1 life left.' : `Ball lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_LIFE) announce('Extra life!');
    if (events & EVENT_WIN) {
      endGame(true);
      return;
    }
    if (events & EVENT_OVER) {
      endGame(false);
      return;
    }
    if (events & EVENT_CLEAR) {
      audio.clear();
      screen = SCREEN_CLEAR;
      clearTimer = CLEAR_SECONDS;
      announce(`Level ${world.state.levelIndex + 1} cleared!`);
    }
  }

  function stepGame(inputState) {
    if (screen === SCREEN_TITLE) {
      const demo = autopilot(world.state);
      if (demo.launch) world.launch();
      world.step(STEP, demo, true);
      return;
    }
    if (screen === SCREEN_CLEAR) {
      world.stepFx(STEP);
      clearTimer -= STEP;
      if (clearTimer <= 0) {
        world.loadLevel(world.state.levelIndex + 1);
        screen = SCREEN_PLAY;
        announce(`Level ${world.state.levelIndex + 1}.`);
      }
      return;
    }
    // Space or a click while the ball is served launches it.
    if (inputState.launch && world.state.mode === 'serve') react(world.launch());
    const events = world.step(STEP, inputState, false);
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const fire = (actions & ACTION_FIRE) !== 0;
    const launch = (actions & ACTION_CONFIRM) !== 0;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      // The same press that starts the game launches the ball: startGame zeroes the
      // frame's accumulator, so the launch flag would never reach a step otherwise.
      react(world.launch());
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CLEAR) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CLEAR)) {
        // A single press fires and launches once: only the first fixed step gets the flags.
        stepGame({ direction: input.direction(), pointerX: input.pointerX(), fire: firstStep && fire, launch: firstStep && launch });
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.multiplier());
    expose();
  }

  // Leaving the tab pauses a running game rather than letting the ball fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The title's backdrop is a demo game: launch its ball once so it plays behind the panel.
  world.launch();
  announce('Lumenbreak. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

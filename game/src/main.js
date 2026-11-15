// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the random pattern. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__game reports the live state for play-testing.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BRICK, EVENT_CLEAR, EVENT_CRACK, EVENT_LASER, EVENT_LIFE, EVENT_LOST,
  EVENT_OVER, EVENT_PADDLE, EVENT_POWERUP, EVENT_TINK, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_FIRE, ACTION_LAUNCH, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

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
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000);
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
  let last = performance.now();
  // Launch and fire presses wait here until a simulation step consumes them: a
  // press that lands in a frame with no step to run must not be lost.
  let pendingLaunchFire = 0;

  // The live state, for scripted play-tests: screen, score, lives, level and balls.
  window.__game = {
    get screen() { return screen; },
    get score() { return world.state.score; },
    get best() { return best; },
    get lives() { return world.state.lives; },
    get level() { return world.state.level; },
    get combo() { return world.state.combo; },
    get multiplier() { return world.state.multiplier; },
    get bricksLeft() { return world.breakableLeft(); },
    get balls() { return world.state.balls.filter((b) => b.active).length; },
    get powerupsCaught() { return world.state.caught; },
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each lost ball.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Lumenbreak. 3 lives. Clear the wall.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`You win. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.over();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function playSounds(events) {
    if (events & EVENT_BRICK) audio.brick(world.state.multiplier);
    if (events & EVENT_CRACK) audio.crack();
    if (events & EVENT_TINK) audio.tink();
    if (events & EVENT_PADDLE) audio.paddle(world.state.multiplier);
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_LIFE) audio.life();
    if (events & EVENT_LASER) audio.laser();
    if (events & EVENT_LOST) {
      audio.lost();
      announce(world.state.lives === 1 ? 'Ball lost. 1 life left.' : `Ball lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_CLEAR) audio.clear();
  }

  // Actions are taken once per frame and handed to the steps, so a press between
  // two frames is never lost and never counted twice.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        pendingLaunchFire = 0;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & (ACTION_LAUNCH | ACTION_FIRE)
      && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    }
  }

  function step(control) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { direction: 0, mouseX: null, launch: true, fire: false }, true);
      return;
    }
    const events = world.step(STEP, control, false);
    playSounds(events);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    pendingLaunchFire |= actions & (ACTION_LAUNCH | ACTION_FIRE);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      const control = {
        direction: input.direction(),
        mouseX: input.mouseTarget(),
        // A launch or fire press applies to the first step of this frame only.
        launch: Boolean(pendingLaunchFire & ACTION_LAUNCH),
        fire: Boolean(pendingLaunchFire & ACTION_FIRE),
      };
      let stepped = false;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(control);
        control.launch = false;
        control.fire = false;
        stepped = true;
        accumulator -= STEP;
      }
      if (stepped) pendingLaunchFire = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting the ball fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumenbreak. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, level select, how to play, play,
// paused, game over and win. Progress (best, unlocked walls, stars) is saved on every
// level clear and run end.
//
// ?seed=N fixes the random pattern. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__game reports the live state for play-testing.
import { LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS_CRIT, EVENT_BOSS_DOWN, EVENT_BOSS_HIT, EVENT_BOSS_RISE, EVENT_BRICK,
  EVENT_CLEAR, EVENT_CRACK, EVENT_ENEMY, EVENT_FEVER, EVENT_LASER, EVENT_LIFE,
  EVENT_LOST, EVENT_OVER, EVENT_PADDLE, EVENT_PHASE, EVENT_POWERUP, EVENT_SHARD,
  EVENT_SHARD_HIT, EVENT_SHIELD, EVENT_TINK, EVENT_WEAVER, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_BACK, ACTION_DOWN, ACTION_FIRE, ACTION_LAUNCH, ACTION_MUTE, ACTION_PAUSE,
  ACTION_QUIT, ACTION_UP, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import {
  SCREEN_HELP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SELECT, SCREEN_TITLE,
  SCREEN_WIN, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { loadProgress, recordLevelClear, recordRunEnd } from './progress.js';
import {
  HELP_BACK_RECT, LEVELS_BACK_RECT, TITLE_OPTIONS, hitTestRects, levelCardRect,
  titleOptionRect,
} from './menus.js';

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
const music = createMusic();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now() / 1000, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let progress = loadProgress();
  let menuIndex = 0;
  let selectIndex = Math.min(progress.unlocked, LEVELS);
  let runStars = [];
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  // Launch and fire presses wait here until a simulation step consumes them: a
  // press that lands in a frame with no step to run must not be lost.
  let pendingLaunchFire = 0;

  // The live state, for scripted play-tests: screen, score, lives, level and balls.
  window.__game = {
    get screen() { return screen; },
    get score() { return world.state.score; },
    get best() { return progress.best; },
    get lives() { return world.state.lives; },
    get level() { return world.state.level; },
    get combo() { return world.state.combo; },
    get multiplier() { return world.state.multiplier; },
    get bricksLeft() { return world.breakableLeft(); },
    get balls() { return world.state.balls.filter((b) => b.active).length; },
    get powerupsCaught() { return world.state.caught; },
    get bossActive() { return world.state.boss.active; },
    get bossHp() { return world.state.boss.hp; },
    get bossPhase() { return world.state.bossPhase; },
    get enemies() { return world.enemiesLeft(); },
    get shield() { return world.state.shield; },
    get fireball() { return world.state.fireballTimer > 0; },
    get unlocked() { return progress.unlocked; },
    get menuIndex() { return menuIndex; },
    get selectIndex() { return selectIndex; },
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes and each lost ball.
  function announce(message) {
    status.textContent = message;
  }

  function startGameAt(level) {
    audio.unlock();
    music.unlock();
    music.setMode('play');
    world.resetAt(level);
    runStars = [];
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing Lumenbreak, wall ${level}. 3 lives. Clear the wall.`);
  }

  function goToTitle() {
    world.reset();
    music.setMode('title');
    screen = SCREEN_TITLE;
    announce('Lumenbreak. Press Space or click to start.');
  }

  function endGame(won) {
    recordRunEnd(progress, world.state.score, won);
    progress = loadProgress();
    music.setMode('title');
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (won) {
      audio.win();
      announce(`You win. Score ${world.state.score}. Best ${progress.best}.`);
    } else {
      audio.over();
      announce(`Game over. Score ${world.state.score}. Best ${progress.best}.`);
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
    if (events & EVENT_ENEMY) audio.enemy();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_SHARD_HIT) audio.shardHit();
    if (events & EVENT_SHIELD) audio.shield();
    if (events & EVENT_BOSS_HIT) audio.bossHit();
    if (events & EVENT_BOSS_CRIT) audio.bossCrit();
    if (events & EVENT_BOSS_DOWN) audio.bossDown();
    if (events & (EVENT_BOSS_RISE | EVENT_PHASE)) audio.bossRoar();
    if (events & EVENT_FEVER) audio.fever();
    if (events & EVENT_WEAVER) audio.shardHit();
    if (events & EVENT_LOST) {
      audio.lost();
      announce(world.state.lives === 1 ? 'Ball lost. 1 life left.' : `Ball lost. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_CLEAR) audio.clear();
  }

  function recordClear() {
    const cleared = world.state.justClearedLevel;
    if (cleared < 1) return;
    const stars = recordLevelClear(progress, cleared, world.state.lastLevelLost, world.state.lastShattered);
    progress = loadProgress();
    runStars = runStars.filter((entry) => entry.level !== cleared);
    runStars.push({ level: cleared, stars });
    announce(`Wall ${cleared} cleared. ${stars} stars. Bonus ${world.state.lastBonus}.`);
  }

  function activateTitleOption(index) {
    const option = TITLE_OPTIONS[index].id;
    audio.menuSelect();
    if (option === 'start') startGameAt(1);
    else if (option === 'levels') {
      selectIndex = Math.min(progress.unlocked, LEVELS);
      screen = SCREEN_SELECT;
      announce('Level select. Choose a wall.');
    } else if (option === 'howto') {
      screen = SCREEN_HELP;
      announce('How to play.');
    }
  }

  // Actions are taken once per frame and handed to the steps, so a press between
  // two frames is never lost and never counted twice.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      music.setMuted(muted);
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        pendingLaunchFire = 0;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_QUIT) {
        goToTitle();
      }
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_UP) {
        menuIndex = (menuIndex + TITLE_OPTIONS.length - 1) % TITLE_OPTIONS.length;
        audio.menuMove();
      } else if (actions & ACTION_DOWN) {
        menuIndex = (menuIndex + 1) % TITLE_OPTIONS.length;
        audio.menuMove();
      } else if (actions & (ACTION_LAUNCH | ACTION_FIRE)) {
        activateTitleOption(menuIndex);
      }
      return;
    }
    if (screen === SCREEN_SELECT) {
      if (actions & ACTION_BACK) {
        screen = SCREEN_TITLE;
        announce('Lumenbreak.');
        return;
      }
      // Arrow keys move around the 4-column grid; A/D and W/S count too, via the
      // held-key direction the loop reads as left/right below.
      if (actions & ACTION_UP) {
        selectIndex = Math.max(1, selectIndex - 4);
        audio.menuMove();
      } else if (actions & ACTION_DOWN) {
        selectIndex = Math.min(LEVELS, selectIndex + 4);
        audio.menuMove();
      } else if (actions & (ACTION_LAUNCH | ACTION_FIRE)) {
        if (selectIndex <= progress.unlocked) {
          audio.menuSelect();
          startGameAt(selectIndex);
        } else {
          audio.tink();
          announce('That wall is locked. Clear the wall before it.');
        }
      }
      return;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_BACK | ACTION_LAUNCH | ACTION_FIRE)) {
        screen = SCREEN_TITLE;
        announce('Lumenbreak.');
      }
      return;
    }
    // Game over and win: restart, or step back to the title.
    if (actions & ACTION_BACK) {
      goToTitle();
    } else if (actions & (ACTION_LAUNCH | ACTION_FIRE)) {
      startGameAt(1);
    }
  }

  // Select-screen left/right: the held keys give a direction, applied once per
  // frame only when the direction key was freshly pressed — tracked here by the
  // change of direction between frames.
  let lastDirection = 0;
  function handleSelectDirection() {
    if (screen !== SCREEN_SELECT) {
      lastDirection = 0;
      return;
    }
    const direction = input.direction();
    if (direction !== 0 && direction !== lastDirection) {
      selectIndex = Math.max(1, Math.min(LEVELS, selectIndex + direction));
      audio.menuMove();
    }
    lastDirection = direction;
  }

  function handleClick(point) {
    if (point === null) return;
    if (screen === SCREEN_TITLE) {
      const rects = TITLE_OPTIONS.map((_, i) => titleOptionRect(i));
      const hit = hitTestRects(rects, point.x, point.y);
      // A click on an option takes it; any other click takes the selected one,
      // so the old "click anywhere to start" still works.
      activateTitleOption(hit >= 0 ? hit : menuIndex);
      return;
    }
    if (screen === SCREEN_SELECT) {
      if (point.x >= LEVELS_BACK_RECT.x && point.x <= LEVELS_BACK_RECT.x + LEVELS_BACK_RECT.w
        && point.y >= LEVELS_BACK_RECT.y && point.y <= LEVELS_BACK_RECT.y + LEVELS_BACK_RECT.h) {
        screen = SCREEN_TITLE;
        return;
      }
      const rects = [];
      for (let level = 1; level <= LEVELS; level += 1) rects.push(levelCardRect(level));
      const hit = hitTestRects(rects, point.x, point.y);
      if (hit >= 0) {
        selectIndex = hit + 1;
        if (selectIndex <= progress.unlocked) {
          audio.menuSelect();
          startGameAt(selectIndex);
        } else {
          audio.tink();
        }
      }
      return;
    }
    if (screen === SCREEN_HELP) {
      if (point.x >= HELP_BACK_RECT.x && point.x <= HELP_BACK_RECT.x + HELP_BACK_RECT.w
        && point.y >= HELP_BACK_RECT.y && point.y <= HELP_BACK_RECT.y + HELP_BACK_RECT.h) {
        screen = SCREEN_TITLE;
      }
      return;
    }
    // On the end screens a click restarts (the launch action already fired);
    // during play a click is a launch/fire, handled by the step.
  }

  function step(control) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { direction: 0, mouseX: null, launch: true, fire: false }, true);
      return;
    }
    const events = world.step(STEP, control, false);
    playSounds(events);
    if (events & EVENT_CLEAR) recordClear();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const click = input.takeClick();
    // A click on a menu screen is answered by position, not by the launch flag
    // the click also raised — so menu clicks never double-fire.
    if (click !== null && (screen === SCREEN_TITLE || screen === SCREEN_SELECT || screen === SCREEN_HELP)) {
      handleClick(click);
    } else {
      handleActions(actions);
      if (click !== null) handleClick(click);
    }
    handleSelectDirection();
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
      // The score turns tense while a warden is up.
      if (screen === SCREEN_PLAY) music.setMode(world.state.boss.active ? 'boss' : 'play');
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, progress.best, now / 1000, {
      progress, menuIndex, selectIndex, muted, runStars,
    });
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

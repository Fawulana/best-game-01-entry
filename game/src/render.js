// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. A neon look: a deep indigo sky with twinkling stars, glowing crystal bricks, a
// bright paddle and ball with trails, additive particles. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.

import { BALL, BRICK, FIELD, FONT, LIVES, MAX_LIVES, PALETTE, PADDLE, POWERUP } from './config.js';
import { LEVELS } from './levels.js';
import { KIND_BONUS, KIND_EMBER, KIND_STEEL } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 900, top: 150, line: 34, bottom: 76 };
const POWERUP_LABELS = { W: 'W', M: 'M', L: 'L', S: 'S', '+': '+' };
const POWERUP_COLORS = { W: '#37e0c8', M: '#ff5da2', L: '#ffc53d', S: '#4fd8ff', '+': '#5dff8f' };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function brickFill(brick) {
  if (brick.kind === KIND_STEEL) return PALETTE.steel;
  if (brick.kind === KIND_EMBER) return PALETTE.explosive;
  if (brick.kind === KIND_BONUS) return PALETTE.bonus;
  if (brick.hp === 1) return '#37e0c8';
  if (brick.hp === 2) return '#ff5da2';
  return '#ffc53d';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const levelLabel = cachedLabel('LEVEL ');
  const finalLabel = cachedLabel('SCORE ');
  const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);

  // The starfield: fixed positions from a fixed seed, so the sky never changes between runs.
  const starRandom = createRandom(20261116);
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: starRandom() * FIELD.width, y: starRandom() * 420, r: 0.6 + starRandom() * 1.6, phase: starRandom() * Math.PI * 2 });
  }
  // The ball's trail: the last few positions, kept in a ring.
  const trail = [];
  for (let index = 0; index < 10; index += 1) trail.push({ x: -100, y: -100 });
  let trailAt = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function drawBackground(time) {
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let index = 0; index < stars.length; index += 1) {
      const star = stars[index];
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.7 + star.phase));
      context.globalAlpha = alpha;
      context.fillStyle = PALETTE.star;
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    // A soft horizon glow behind the bricks.
    const glow = context.createRadialGradient(FIELD.width / 2, 190, 40, FIELD.width / 2, 190, 520);
    glow.addColorStop(0, 'rgba(79, 216, 255, 0.10)');
    glow.addColorStop(1, 'rgba(79, 216, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, 480);
  }

  function drawBricks(state) {
    for (let index = 0; index < state.bricks.length; index += 1) {
      const brick = state.bricks[index];
      if (!brick.alive) continue;
      const color = brickFill(brick);
      context.shadowColor = color;
      context.shadowBlur = brick.flash > 0 ? 22 : 10;
      context.fillStyle = brick.flash > 0 ? '#ffffff' : color;
      roundRect(brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 6);
      context.fill();
      context.shadowBlur = 0;
      // A bright top edge, and pips showing how many hits a crystal still takes.
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(brick.x + 6, brick.y + 3, brick.width - 12, 3);
      if (brick.kind !== KIND_STEEL && brick.maxHp > 1 && brick.hp > 1) {
        context.fillStyle = 'rgba(7,10,24,0.55)';
        for (let pip = 0; pip < brick.hp; pip += 1) {
          context.beginPath();
          context.arc(brick.x + brick.width / 2 + (pip - (brick.hp - 1) / 2) * 12, brick.y + brick.height / 2 + 1, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
      if (brick.kind === KIND_EMBER) {
        text('~', brick.x + brick.width / 2, brick.y + brick.height / 2 + 8, 18, 'rgba(7,10,24,0.8)', 'center', 'bold ');
      }
      if (brick.kind === KIND_BONUS) {
        text('?', brick.x + brick.width / 2, brick.y + brick.height / 2 + 8, 18, 'rgba(7,10,24,0.8)', 'center', 'bold ');
      }
    }
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const glow = paddle.laserTimer > 0 ? '#ffc53d' : PALETTE.paddleGlow;
    context.shadowColor = glow;
    context.shadowBlur = 18;
    const gradient = context.createLinearGradient(paddle.x, PADDLE.y, paddle.x + paddle.width, PADDLE.y);
    gradient.addColorStop(0, glow);
    gradient.addColorStop(0.5, PALETTE.paddle);
    gradient.addColorStop(1, glow);
    context.fillStyle = gradient;
    roundRect(paddle.x, PADDLE.y, paddle.width, PADDLE.height, 8);
    context.fill();
    context.shadowBlur = 0;
    if (paddle.laserTimer > 0) {
      context.fillStyle = '#ffc53d';
      context.fillRect(paddle.x + 6, PADDLE.y - 10, 6, 12);
      context.fillRect(paddle.x + paddle.width - 12, PADDLE.y - 10, 6, 12);
    }
    if (paddle.wideTimer > 0) {
      context.fillStyle = '#37e0c8';
      context.fillRect(paddle.x + paddle.width / 2 - 14, PADDLE.y + 5, 28, 5);
    }
  }

  function drawBalls(state) {
    for (let index = 0; index < state.balls.length; index += 1) {
      const ball = state.balls[index];
      if (!ball.active) continue;
      trail[trailAt] = { x: ball.x, y: ball.y };
      trailAt = (trailAt + 1) % trail.length;
      for (let step = 0; step < trail.length; step += 1) {
        const point = trail[(trailAt + step) % trail.length];
        const alpha = (step / trail.length) * 0.25;
        context.globalAlpha = alpha;
        context.fillStyle = PALETTE.ballGlow;
        context.beginPath();
        context.arc(point.x, point.y, BALL.radius * (0.4 + 0.6 * (step / trail.length)), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.shadowColor = PALETTE.ballGlow;
      context.shadowBlur = 16;
      context.fillStyle = PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }
  }

  function drawBolts(state) {
    context.fillStyle = '#ffe9a8';
    context.shadowColor = '#ffc53d';
    context.shadowBlur = 12;
    for (let index = 0; index < state.bolts.length; index += 1) {
      const bolt = state.bolts[index];
      if (!bolt.active) continue;
      roundRect(bolt.x - 3, bolt.y - 14, 6, 18, 3);
      context.fill();
    }
    context.shadowBlur = 0;
  }

  function drawPowerups(state) {
    for (let index = 0; index < state.powerups.length; index += 1) {
      const powerup = state.powerups[index];
      if (!powerup.active) continue;
      const color = POWERUP_COLORS[powerup.kind];
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = '#12172e';
      roundRect(powerup.x - POWERUP.size / 2, powerup.y - POWERUP.size / 2, POWERUP.size, POWERUP.size, 7);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
      text(POWERUP_LABELS[powerup.kind], powerup.x, powerup.y + 7, 17, color, 'center', 'bold ');
    }
  }

  function drawParticles(state) {
    context.globalCompositeOperation = 'lighter';
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function drawFloaters(state) {
    context.textBaseline = 'alphabetic';
    for (let index = 0; index < state.floaters.length; index += 1) {
      const floater = state.floaters[index];
      if (!floater.active) continue;
      context.globalAlpha = Math.min(1, floater.life * 2);
      text(floater.text, floater.x, floater.y, 18, PALETTE.gold, 'center', 'bold ');
    }
    context.globalAlpha = 1;
  }

  function drawHeart(x, y, size, filled) {
    context.fillStyle = filled ? '#ff5d7a' : 'rgba(154,163,192,0.25)';
    context.beginPath();
    context.moveTo(x, y + size * 0.35);
    context.bezierCurveTo(x - size * 0.55, y - size * 0.25, x - size * 0.15, y - size * 0.6, x, y - size * 0.15);
    context.bezierCurveTo(x + size * 0.15, y - size * 0.6, x + size * 0.55, y - size * 0.25, x, y + size * 0.35);
    context.fill();
  }

  function drawHud(state, best, mult) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 28, 22, 26, PALETTE.text, 'left', 'bold ');
    text(bestLabel(best), 28, 54, 16, PALETTE.muted, 'left');
    const level = LEVELS[state.levelIndex];
    text(`${levelLabel(state.levelIndex + 1)} — ${level.name.toUpperCase()}`, FIELD.width / 2, 22, 22, PALETTE.text, 'center', 'bold ');
    const left = bricksLeftText(state);
    text(left, FIELD.width / 2, 54, 16, PALETTE.muted, 'center');
    for (let life = 0; life < MAX_LIVES; life += 1) {
      drawHeart(FIELD.width - 40 - life * 30, 46, 22, life < state.lives);
    }
    if (mult > 1) {
      text(`COMBO x${mult}`, FIELD.width - 28, 66, 20, PALETTE.gold, 'right', 'bold ');
    }
    if (state.paddle.laserTimer > 0) text('LASER', FIELD.width - 28, 92, 16, '#ffc53d', 'right', 'bold ');
    else if (state.paddle.wideTimer > 0) text('WIDE', FIELD.width - 28, 92, 16, '#37e0c8', 'right', 'bold ');
    else if (state.slowTimer > 0) text('SLOW', FIELD.width - 28, 92, 16, '#4fd8ff', 'right', 'bold ');
  }

  function bricksLeftText(state) {
    let left = 0;
    for (let index = 0; index < state.bricks.length; index += 1) {
      if (state.bricks[index].alive && state.bricks[index].kind !== KIND_STEEL) left += 1;
    }
    return `${left} crystals left`;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7,10,24,0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.shadowColor = PALETTE.panelEdge;
    context.shadowBlur = 30;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, PANEL.width, height, 16);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.textBaseline = 'alphabetic';
    context.shadowColor = '#4fd8ff';
    context.shadowBlur = 24;
    text(title, FIELD.width / 2, y + 82, 52, PALETTE.text, 'center', 'bold ');
    context.shadowBlur = 0;
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center', 'bold ');
  }

  const TITLE_LINES = [
    'Shatter every crystal. Clear all six walls to win.',
    'Move with the mouse or ← → / A D. Space launches the ball.',
    'Powerups: W wide · M multi-ball · L laser · S slow · + life.',
    '',
  ];
  const PAUSED_LINES = ['The crystals will wait for you.'];
  const CLEAR_LINES = [''];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', 'All six walls shattered. The sky is yours.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, mult) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.textBaseline = 'alphabetic';
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.sin(state.time * 91) * state.shake) : 0;
    const shakeY = state.shake > 0 ? (Math.cos(state.time * 113) * state.shake) : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state.time);
    drawBricks(state);
    drawPowerups(state);
    drawBolts(state);
    drawPaddle(state);
    drawBalls(state);
    drawParticles(state);
    drawFloaters(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = best > 0 ? bestLabel(best) : 'No best score yet — set one.';
      drawPanel('LUMENBREAK', TITLE_LINES, 'Press Space or click to play');
      return;
    }
    drawHud(state, best, mult);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_CLEAR) {
      const level = LEVELS[state.levelIndex];
      CLEAR_LINES[0] = `Level ${state.levelIndex + 1} — ${level.name} cleared!`;
      drawPanel('Wall shattered!', CLEAR_LINES, 'Get ready for the next wall…');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('Game over', OVER_LINES, 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      drawPanel('You win!', WIN_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

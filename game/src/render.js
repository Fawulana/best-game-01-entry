// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Neon crystal bricks with glow, a glowing paddle and ball, falling
// powerup capsules, particles, and a HUD with score, best, level, lives, combo and the
// active effects. Text that holds a number is rebuilt only when the number changes, so
// a frame allocates nothing.
import { BALL, BRICK, FIELD, FONT, LASER, PALETTE, PADDLE, POWERUP } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 64 };
const STAR_COUNT = 110;

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const levelLabel = cachedLabel('LEVEL ');
  const comboLabel = cachedLabel('COMBO x');
  const finalLabel = cachedLabel('SCORE ');
  const bricksLabel = cachedLabel('BRICKS SHATTERED ');
  const caughtLabel = cachedLabel('POWERUPS CAUGHT ');

  // The starfield is seeded once, so every run paints the same sky.
  const stars = [];
  const starRandom = createRandom(20261115);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * FIELD.height,
      r: 0.6 + starRandom() * 1.6,
      twinkle: starRandom() * Math.PI * 2,
    });
  }

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
  function text(value, x, y, size, color, align, weight = '600') {
    if (!fonts.has(size + weight)) fonts.set(size + weight, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(size + weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.4 + star.twinkle));
      context.globalAlpha = alpha;
      context.fillStyle = '#cdd6ff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.height - 18, FIELD.width, 18);
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      const flash = brick.flash > 0;
      if (brick.kind === 'steel') {
        context.fillStyle = flash ? '#ffffff' : PALETTE.steel;
        roundRect(context, brick.x, brick.y, brick.w, brick.h, 4);
        context.fill();
        context.fillStyle = PALETTE.steelEdge;
        context.fillRect(brick.x + 6, brick.y + 4, brick.w - 12, 3);
        context.fillStyle = '#5d6a84';
        context.fillRect(brick.x + 8, brick.y + brick.h - 8, 4, 4);
        context.fillRect(brick.x + brick.w - 12, brick.y + brick.h - 8, 4, 4);
        continue;
      }
      const color = brick.kind === 'ember' ? PALETTE.ember : PALETTE.tier[brick.tier - 1];
      const edge = brick.kind === 'ember' ? PALETTE.emberCore : PALETTE.tierEdge[brick.tier - 1];
      context.save();
      context.shadowColor = color;
      context.shadowBlur = flash ? 26 : 12;
      context.fillStyle = flash ? '#ffffff' : color;
      roundRect(context, brick.x, brick.y, brick.w, brick.h, 5);
      context.fill();
      context.restore();
      context.fillStyle = edge;
      context.fillRect(brick.x + 5, brick.y + 4, brick.w - 10, 3);
      if (brick.kind === 'hard') {
        context.strokeStyle = flash ? '#ffffff' : '#2a1245';
        context.lineWidth = brick.hits === 1 ? 2 : 3;
        context.beginPath();
        context.moveTo(brick.x + brick.w * 0.3, brick.y + 4);
        context.lineTo(brick.x + brick.w * 0.45, brick.y + brick.h / 2);
        context.lineTo(brick.x + brick.w * 0.35, brick.y + brick.h - 4);
        context.moveTo(brick.x + brick.w * 0.65, brick.y + 4);
        context.lineTo(brick.x + brick.w * 0.55, brick.y + brick.h / 2);
        context.lineTo(brick.x + brick.w * 0.7, brick.y + brick.h - 4);
        context.stroke();
      }
      if (brick.kind === 'ember') {
        context.fillStyle = PALETTE.emberCore;
        context.beginPath();
        context.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 6, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPaddle(state, time) {
    const paddle = state.paddle;
    const blink = paddle.wideTimer > 0 && paddle.wideTimer < 3 ? Math.floor(time * 6) % 2 === 0 : true;
    if (!blink) return;
    context.save();
    context.shadowColor = PALETTE.paddle;
    context.shadowBlur = 18;
    context.fillStyle = PALETTE.paddle;
    roundRect(context, paddle.x, PADDLE.y, paddle.width, PADDLE.height, 8);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.paddleCore;
    roundRect(context, paddle.x + 8, PADDLE.y + 4, paddle.width - 16, 5, 3);
    context.fill();
    if (paddle.laserTimer > 0) {
      context.fillStyle = PALETTE.gold;
      context.fillRect(paddle.x + 6, PADDLE.y - 10, 8, 10);
      context.fillRect(paddle.x + paddle.width - 14, PADDLE.y - 10, 8, 10);
    }
  }

  function drawBalls(state) {
    for (const ball of state.balls) {
      if (!ball.active) continue;
      context.save();
      context.shadowColor = PALETTE.ballTrail;
      context.shadowBlur = 16;
      context.fillStyle = PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = '#bff4ff';
      context.beginPath();
      context.arc(ball.x - 2, ball.y - 2, ball.r * 0.35, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPowerups(state) {
    context.textBaseline = 'alphabetic';
    for (const p of state.powerups) {
      if (!p.active) continue;
      const color = PALETTE.power[p.kind];
      const half = POWERUP.size / 2;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillStyle = '#14082e';
      roundRect(context, p.x - half, p.y - half, POWERUP.size, POWERUP.size, 8);
      context.fill();
      context.restore();
      context.strokeStyle = color;
      context.lineWidth = 2;
      roundRect(context, p.x - half, p.y - half, POWERUP.size, POWERUP.size, 8);
      context.stroke();
      text(p.kind === '+' ? '+' : p.kind, p.x, p.y + 7, 20, color, 'center', '800');
    }
  }

  function drawBolts(state) {
    context.fillStyle = PALETTE.gold;
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      context.save();
      context.shadowColor = PALETTE.gold;
      context.shadowBlur = 10;
      context.fillRect(bolt.x - LASER.width / 2, bolt.y, LASER.width, LASER.height);
      context.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 26, PALETTE.text, 'left');
    text(bestLabel(best), 300, 18, 26, PALETTE.muted, 'left');
    text(levelLabel(`${state.level} / 6`), FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    // Lives as glowing pips, top right.
    const pips = 5;
    const size = 16;
    const gap = 7;
    const first = FIELD.width - 24 - pips * (size + gap) + gap;
    text('LIVES', first - 14, 18, 26, PALETTE.muted, 'right');
    for (let i = 0; i < pips; i += 1) {
      context.fillStyle = i < state.lives ? '#ff5c7a' : '#2a2144';
      context.save();
      if (i < state.lives) {
        context.shadowColor = '#ff5c7a';
        context.shadowBlur = 8;
      }
      context.beginPath();
      context.arc(first + i * (size + gap) + size / 2, 30, size / 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Combo meter under the score.
    if (state.multiplier > 1) {
      text(comboLabel(state.multiplier), 24, 52, 22, PALETTE.gold, 'left', '800');
      context.fillStyle = '#2a2144';
      context.fillRect(24, 80, 120, 6);
      context.fillStyle = PALETTE.gold;
      context.fillRect(24, 80, (120 * state.multiplier) / 5, 6);
    }
    // Active effects, top right under the lives.
    const effects = [];
    if (state.paddle.wideTimer > 0) effects.push(`WIDE ${Math.ceil(state.paddle.wideTimer)}s`);
    if (state.paddle.laserTimer > 0) effects.push(`LASER ${Math.ceil(state.paddle.laserTimer)}s`);
    if (state.slowTimer > 0) effects.push(`SLOW ${Math.ceil(state.slowTimer)}s`);
    for (let i = 0; i < effects.length; i += 1) {
      text(effects[i], FIELD.width - 24, 52 + i * 24, 18, PALETTE.gold, 'right');
    }
    // How to play, small, bottom left during play.
    text('Arrows / A D or mouse — Space launch / fire — P pause — M mute', 24, FIELD.height - 26, 15, PALETTE.muted, 'left', '400');
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || state.banner === '') return;
    context.textBaseline = 'alphabetic';
    const alpha = Math.min(1, state.bannerTimer);
    context.save();
    context.globalAlpha = alpha;
    text(`LEVEL ${state.level}`, FIELD.width / 2, 330, 30, PALETTE.muted, 'center');
    text(state.banner, FIELD.width / 2, 380, 54, PALETTE.banner, 'center', '800');
    context.restore();
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 4, 28, 0.88)';
    roundRect(context, x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = accent;
    context.lineWidth = 2;
    roundRect(context, x, y, PANEL.width, height, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, accent, 'center', '800');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center', '400');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 23, PALETTE.gold, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawBackground(time);
    drawBricks(state);
    drawParticles(state);
    drawPowerups(state);
    drawBolts(state);
    drawPaddle(state, time);
    drawBalls(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Shatter every crystal wall. Chain the embers.',
        'Catch falling powerups: W wide · M multi-ball · L laser',
        'S slow · + extra life. Steel never breaks.',
        'Move with ← → or A D, or the mouse. Space launches the ball.',
        best > 0 ? bestLabel(best) : '',
      ];
      drawPanel('LUMENBREAK', lines, 'Press Space or click to start', PALETTE.paddle);
      return;
    }
    drawHud(state, best);
    drawBanner(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The crystals will wait for you.'], 'Press P to resume', PALETTE.paddle);
    } else if (screen === SCREEN_OVER) {
      const lines = [
        finalLabel(state.score),
        bestLabel(best),
        `Reached level ${state.level} of 6`,
        bricksLabel(state.broken),
        caughtLabel(state.caught),
      ];
      drawPanel('GAME OVER', lines, 'Press Space or click to play again', '#ff5c7a');
    } else if (screen === SCREEN_WIN) {
      const lines = [
        'All six walls shattered. The light is yours.',
        finalLabel(state.score),
        bestLabel(best),
        bricksLabel(state.broken),
        caughtLabel(state.caught),
      ];
      drawPanel('YOU WIN', lines, 'Press Space or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

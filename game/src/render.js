// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Eight level themes with their own background motifs, neon crystal
// bricks, wraiths, wardens with health bars, falling shards and powerups, ball trails,
// floating score popups, screen shake and flashes, and full title / level-select /
// help / pause / win / game-over screens. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.
import {
  BALL, BRICK, COMBO, DASH, FIELD, FONT, LASER, LEVELS, PALETTE, PADDLE, POWERUP, SHARD,
} from './config.js';
import { createRandom } from './random.js';
import { themeOf } from './themes.js';
import { ENEMY_INFO } from './enemies.js';
import { bossCore } from './boss.js';
import { shakeOffset } from './effects.js';
import {
  HELP_BACK_RECT, LEVELS_BACK_RECT, TITLE_OPTIONS, levelCardRect, titleOptionRect,
} from './menus.js';
import { POWERUP_CATALOG } from './powerups.js';
import { totalStars } from './progress.js';
import { WALLS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_SELECT = 'select';
export const SCREEN_HELP = 'help';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 680, top: 150, line: 32, bottom: 64 };
const STAR_COUNT = 110;

function cachedLabel(prefix) {
  let value = null;
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

function starShape(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
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
  const wraithLabel = cachedLabel('WRAITHS BROKEN ');
  const bossLabel = cachedLabel('WARDENS FELLED ');
  const maxComboLabel = cachedLabel('BEST COMBO x');

  // The starfield and ember motes are seeded once, so every run paints the same sky.
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
  const motes = [];
  for (let i = 0; i < 40; i += 1) {
    motes.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height, speed: 12 + starRandom() * 26 });
  }
  const vines = [];
  for (let i = 0; i < 9; i += 1) {
    vines.push({ x: 40 + starRandom() * (FIELD.width - 80), bend: 30 + starRandom() * 60, phase: starRandom() * 6 });
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

  function drawBackground(state, time) {
    const theme = themeOf(state.level);
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(1, theme.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.4 + star.twinkle));
      context.globalAlpha = alpha;
      context.fillStyle = '#cdd6ff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    // The theme motif, behind the bricks.
    if (theme.motif === 'aurora') {
      for (let band = 0; band < 3; band += 1) {
        context.globalAlpha = 0.12;
        context.fillStyle = band === 1 ? '#7dff9e' : '#39e6ff';
        context.beginPath();
        context.moveTo(0, 120 + band * 60);
        for (let x = 0; x <= FIELD.width; x += 40) {
          context.lineTo(x, 120 + band * 60 + Math.sin(x / 180 + time * 0.7 + band * 2) * 26);
        }
        context.lineTo(FIELD.width, 220 + band * 60);
        context.lineTo(0, 220 + band * 60);
        context.closePath();
        context.fill();
      }
      context.globalAlpha = 1;
    } else if (theme.motif === 'embers') {
      for (const mote of motes) {
        const y = FIELD.height - ((mote.y + time * mote.speed) % FIELD.height);
        context.globalAlpha = 0.5;
        context.fillStyle = '#ff7a2f';
        context.fillRect(mote.x, y, 3, 3);
      }
      context.globalAlpha = 1;
    } else if (theme.motif === 'grid') {
      context.strokeStyle = 'rgba(143, 155, 179, 0.14)';
      context.lineWidth = 1;
      for (let x = 0; x <= FIELD.width; x += 64) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, FIELD.height);
        context.stroke();
      }
      for (let y = 0; y <= FIELD.height; y += 64) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(FIELD.width, y);
        context.stroke();
      }
    } else if (theme.motif === 'vines') {
      context.strokeStyle = 'rgba(125, 255, 158, 0.16)';
      context.lineWidth = 3;
      for (const vine of vines) {
        context.beginPath();
        context.moveTo(vine.x, FIELD.height);
        context.bezierCurveTo(
          vine.x - vine.bend, FIELD.height * 0.66, vine.x + vine.bend, FIELD.height * 0.33,
          vine.x + Math.sin(time * 0.5 + vine.phase) * 20, 60,
        );
        context.stroke();
      }
    } else if (theme.motif === 'rings') {
      context.strokeStyle = 'rgba(255, 92, 225, 0.12)';
      context.lineWidth = 2;
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.arc(FIELD.width / 2, 300, ring * 90 + Math.sin(time + ring) * 8, 0, Math.PI * 2);
        context.stroke();
      }
    } else if (theme.motif === 'void') {
      context.strokeStyle = 'rgba(92, 124, 255, 0.16)';
      context.lineWidth = 2;
      for (let ring = 1; ring <= 3; ring += 1) {
        context.beginPath();
        context.ellipse(FIELD.width / 2, 330, ring * 150, ring * 70, 0, 0, Math.PI * 2);
        context.stroke();
      }
    } else if (theme.motif === 'core') {
      const pulse = 0.16 + 0.08 * Math.sin(time * 2.2);
      const glow = context.createRadialGradient(FIELD.width / 2, 240, 20, FIELD.width / 2, 240, 420);
      glow.addColorStop(0, `rgba(255, 92, 61, ${pulse + 0.12})`);
      glow.addColorStop(1, 'rgba(255, 92, 61, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    context.fillStyle = theme.ground;
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

  function drawEnemies(state, time) {
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const info = ENEMY_INFO[enemy.kind];
      const cx = enemy.x + enemy.w / 2;
      const cy = enemy.y + enemy.h / 2;
      const hw = enemy.w / 2;
      const hh = enemy.h / 2;
      const flash = enemy.flash > 0;
      const bob = Math.sin(time * 3 + enemy.phase) * 2;
      context.save();
      context.shadowColor = info.color;
      context.shadowBlur = flash ? 26 : 14;
      context.fillStyle = flash ? '#ffffff' : info.color;
      if (enemy.kind === 'drifter' || enemy.kind === 'mite') {
        context.beginPath();
        context.moveTo(cx, cy - hh + bob);
        context.lineTo(cx + hw, cy + bob);
        context.lineTo(cx, cy + hh + bob);
        context.lineTo(cx - hw, cy + bob);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'weaver') {
        context.beginPath();
        context.moveTo(cx, cy - hh + bob);
        context.lineTo(cx + hw, cy + hh * 0.7 + bob);
        context.lineTo(cx - hw, cy + hh * 0.7 + bob);
        context.closePath();
        context.fill();
      } else if (enemy.kind === 'splitter') {
        // Two lobes, joined at the middle — the shape that bursts in two.
        for (const side of [-0.45, 0.45]) {
          context.beginPath();
          context.moveTo(cx + side * hw, cy - hh * 0.8 + bob);
          context.lineTo(cx + side * hw + hw * 0.55, cy + bob);
          context.lineTo(cx + side * hw, cy + hh * 0.8 + bob);
          context.lineTo(cx + side * hw - hw * 0.55, cy + bob);
          context.closePath();
          context.fill();
        }
      } else if (enemy.kind === 'guardian') {
        // A heavy hexagon behind a shield ring: the ring fades as hits land.
        context.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (i * Math.PI) / 3 + time * 0.4;
          const px = cx + Math.cos(angle) * hw;
          const py = cy + Math.sin(angle) * hh + bob;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        context.strokeStyle = enemy.hp >= 3 ? '#8ce8ff' : enemy.hp === 2 ? '#5c7cff' : '#3a2a55';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(cx, cy + bob, hw + 7, 0, Math.PI * 2);
        context.stroke();
      } else {
        context.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (i * Math.PI) / 3 + time * 0.6;
          const px = cx + Math.cos(angle) * hw;
          const py = cy + Math.sin(angle) * hh + bob;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
      }
      context.restore();
      // Dark eye, and one pip per hit point above the first.
      context.fillStyle = '#14082e';
      context.beginPath();
      context.arc(cx, cy + bob, Math.max(3, hw * 0.28), 0, Math.PI * 2);
      context.fill();
      if (enemy.maxHp > 1) {
        for (let p = 0; p < enemy.maxHp; p += 1) {
          const pw = 9;
          const px = cx - ((enemy.maxHp * (pw + 2)) / 2) + p * (pw + 2);
          context.fillStyle = enemy.hp > p ? info.color : '#3a2a55';
          context.fillRect(px, cy - hh - 10 + bob, pw, 4);
        }
      }
    }
  }

  function drawBoss(state, time) {
    const boss = state.boss;
    if (!boss.active) return;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    const flash = boss.flash > 0;
    const hover = Math.sin(time * 2) * 3;
    const intro = boss.introTimer > 0 ? 1 - boss.introTimer / 1.6 : 1;
    context.save();
    context.globalAlpha = Math.max(0, intro);
    context.shadowColor = PALETTE.boss;
    context.shadowBlur = flash ? 34 : 22;
    context.fillStyle = flash ? '#ffffff' : '#7a1e2e';
    roundRect(context, boss.x, boss.y + hover, boss.w, boss.h, 14);
    context.fill();
    context.restore();
    context.save();
    context.globalAlpha = Math.max(0, intro);
    // Crystal facets and crown spikes.
    context.fillStyle = flash ? '#ffd9d0' : '#b03040';
    context.beginPath();
    context.moveTo(boss.x + 18, boss.y + hover + boss.h);
    context.lineTo(boss.x + boss.w * 0.32, boss.y + hover + 10);
    context.lineTo(boss.x + boss.w * 0.5, boss.y + hover + boss.h - 8);
    context.lineTo(boss.x + boss.w * 0.68, boss.y + hover + 10);
    context.lineTo(boss.x + boss.w - 18, boss.y + hover + boss.h);
    context.closePath();
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      const sx = boss.x + boss.w * (0.14 + i * 0.18);
      context.beginPath();
      context.moveTo(sx - 9, boss.y + hover + 6);
      context.lineTo(sx, boss.y + hover - 16 - (i === 2 ? 8 : 0));
      context.lineTo(sx + 9, boss.y + hover + 6);
      context.closePath();
      context.fill();
    }
    // The glowing core: the critical spot. It pulses, and flares on a crit.
    const core = bossCore(boss);
    const pulse = core.r * (1 + 0.12 * Math.sin(time * 4) + (boss.coreFlash > 0 ? 0.35 : 0));
    context.shadowColor = PALETTE.bossCore;
    context.shadowBlur = boss.coreFlash > 0 ? 34 : 20;
    context.fillStyle = PALETTE.bossCore;
    context.beginPath();
    context.arc(core.x, core.y + hover, pulse, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#fff8e0';
    context.beginPath();
    context.arc(core.x, core.y + hover, pulse * 0.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawShards(state, time) {
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const cx = shard.x;
      const cy = shard.y;
      const wobble = Math.sin(time * 8 + cx) * 0.12;
      context.save();
      context.translate(cx, cy);
      context.rotate(wobble);
      context.shadowColor = PALETTE.shard;
      context.shadowBlur = 12;
      context.fillStyle = PALETTE.shard;
      context.beginPath();
      context.moveTo(0, -SHARD.height / 2);
      context.lineTo(SHARD.width / 2, 0);
      context.lineTo(0, SHARD.height / 2);
      context.lineTo(-SHARD.width / 2, 0);
      context.closePath();
      context.fill();
      context.restore();
      context.fillStyle = '#ffd0d8';
      context.fillRect(cx - 1, cy - 6, 2, 8);
    }
  }

  function drawPaddle(state, time) {
    const paddle = state.paddle;
    const blink = (paddle.wideTimer > 0 && paddle.wideTimer < 3)
      || (paddle.narrowTimer > 0 && paddle.narrowTimer < 2)
      ? Math.floor(time * 6) % 2 === 0 : true;
    if (!blink) return;
    // A dashing paddle burns brighter, with a wider glow.
    const dashing = state.dashTimer > 0;
    const color = dashing ? '#7df3ff' : paddle.narrowTimer > 0 ? '#ff8ca0' : PALETTE.paddle;
    context.save();
    context.shadowColor = color;
    context.shadowBlur = dashing ? 30 : 18;
    context.fillStyle = color;
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
    if (state.catchTimer > 0) {
      context.strokeStyle = '#8ce8ff';
      context.lineWidth = 2;
      context.setLineDash([6, 5]);
      roundRect(context, paddle.x - 5, PADDLE.y - 5, paddle.width + 10, PADDLE.height + 10, 10);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawShield(state) {
    if (!state.shield) return;
    context.save();
    context.shadowColor = PALETTE.shield;
    context.shadowBlur = 10;
    context.strokeStyle = PALETTE.shield;
    context.lineWidth = 3;
    context.setLineDash([18, 10]);
    context.beginPath();
    context.moveTo(8, FIELD.height - 6);
    context.lineTo(FIELD.width - 8, FIELD.height - 6);
    context.stroke();
    context.restore();
    context.setLineDash([]);
  }

  function drawBalls(state) {
    const fireball = state.fireballTimer > 0;
    for (const ball of state.balls) {
      if (!ball.active) continue;
      // Trail: oldest first, fading.
      for (let i = 0; i < ball.trail.length; i += 1) {
        const point = ball.trail[(ball.trailHead + i) % ball.trail.length];
        const alpha = (i / ball.trail.length) * 0.35;
        context.globalAlpha = alpha;
        context.fillStyle = fireball ? PALETTE.fireball : PALETTE.ballTrail;
        context.beginPath();
        context.arc(point.x, point.y, ball.r * (0.4 + 0.5 * (i / ball.trail.length)), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.save();
      context.shadowColor = fireball ? PALETTE.fireball : PALETTE.ballTrail;
      context.shadowBlur = fireball ? 26 : 16;
      context.fillStyle = fireball ? '#ffd0a0' : PALETTE.ball;
      context.beginPath();
      context.arc(ball.x, ball.y, ball.r + (fireball ? 2 : 0), 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = fireball ? '#fff0d8' : '#bff4ff';
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

  function drawEffects(state) {
    for (const ring of state.effects.rings) {
      if (!ring.active) continue;
      context.globalAlpha = Math.max(0, ring.life / ring.maxLife);
      context.strokeStyle = ring.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
    for (const popup of state.effects.texts) {
      if (!popup.active) continue;
      context.globalAlpha = Math.min(1, (popup.life / popup.maxLife) * 1.6);
      text(popup.text, popup.x, popup.y, popup.size, popup.color, 'center', '800');
    }
    context.globalAlpha = 1;
  }

  function drawBossBar(state) {
    const boss = state.boss;
    if (!boss.active) return;
    // Sits under the level heading, clear of the wall: name, bar, phase pips.
    const width = 520;
    const x = (FIELD.width - width) / 2;
    const y = 66;
    context.textBaseline = 'alphabetic';
    text(boss.name, FIELD.width / 2, y - 6, 19, '#ff8c6b', 'center', '800');
    context.fillStyle = '#2a0f18';
    roundRect(context, x, y, width, 14, 7);
    context.fill();
    const fraction = boss.hp / boss.maxHp;
    context.save();
    context.shadowColor = PALETTE.boss;
    context.shadowBlur = 10;
    context.fillStyle = PALETTE.boss;
    if (fraction > 0) {
      roundRect(context, x, y, Math.max(14, width * fraction), 14, 7);
      context.fill();
    }
    context.restore();
    // Phase pips at the 1/3 and 2/3 marks.
    context.fillStyle = '#14082e';
    context.fillRect(x + width / 3 - 1, y, 2, 14);
    context.fillRect(x + (2 * width) / 3 - 1, y, 2, 14);
    text(`PHASE ${boss.phase}`, x + width + 14, y + 13, 16, PALETTE.muted, 'left');
  }

  function drawHud(state, best, ui, screen) {
    const inGame = screen === SCREEN_PLAY || screen === SCREEN_PAUSED;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 14, 26, PALETTE.text, 'left');
    text(bestLabel(best), 300, 14, 26, PALETTE.muted, 'left');
    // Endless Drift counts drifts, not walls: the heading says so.
    text(levelLabel(state.mode === 'endless' ? `DRIFT ${state.level}` : `${state.level} / ${LEVELS}`), FIELD.width / 2, 14, 26, PALETTE.text, 'center');
    // The wall's name yields its slot to the warden's bar while a warden is up.
    if (!state.boss.active) {
      text(state.levelName, FIELD.width / 2, 42, 15, themeOf(state.level).accent, 'center', '400');
    }
    // Lives as glowing pips, top right.
    const pips = 5;
    const size = 16;
    const gap = 7;
    const first = FIELD.width - 24 - pips * (size + gap) + gap;
    text('LIVES', first - 14, 14, 26, PALETTE.muted, 'right');
    for (let i = 0; i < pips; i += 1) {
      context.fillStyle = i < state.lives ? '#ff5c7a' : '#2a2144';
      context.save();
      if (i < state.lives) {
        context.shadowColor = '#ff5c7a';
        context.shadowBlur = 8;
      }
      context.beginPath();
      context.arc(first + i * (size + gap) + size / 2, 26, size / 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Combo meter under the score; at fever heat it shouts.
    if (state.multiplier > 1) {
      const fever = state.multiplier >= COMBO.feverAt;
      text(fever ? `FEVER x${state.multiplier}` : comboLabel(state.multiplier), 24, 48, 22, fever ? '#ff9a3d' : PALETTE.gold, 'left', '800');
      context.fillStyle = '#2a2144';
      context.fillRect(24, 76, 120, 6);
      context.fillStyle = fever ? '#ff9a3d' : PALETTE.gold;
      context.fillRect(24, 76, (120 * state.multiplier) / COMBO.maxMultiplier, 6);
    }
    // Dash meter, low on the left where the field is empty — never over the wall.
    const dashReady = state.dashCooldown <= 0;
    const dashFraction = dashReady ? 1 : 1 - state.dashCooldown / DASH.cooldown;
    text(dashReady ? 'DASH READY' : `DASH ${Math.ceil(state.dashCooldown)}s`, 24, 616, 17, dashReady ? '#7df3ff' : PALETTE.muted, 'left', '800');
    context.fillStyle = '#2a2144';
    context.fillRect(24, 626, 120, 6);
    context.fillStyle = '#7df3ff';
    context.fillRect(24, 626, 120 * dashFraction, 6);
    // Wraiths remaining, bottom right above the hint line — clear of the wall.
    const wraiths = state.enemies.filter((e) => e.active).length;
    if (wraiths > 0 && inGame) {
      text(`WRAITHS ${wraiths}`, FIELD.width - 24, FIELD.height - 50, 18, '#c792ff', 'right');
    }
    // Active effects, top right under the lives.
    const effects = [];
    if (state.paddle.wideTimer > 0) effects.push(`WIDE ${Math.ceil(state.paddle.wideTimer)}s`);
    if (state.paddle.laserTimer > 0) effects.push(`LASER ${Math.ceil(state.paddle.laserTimer)}s`);
    if (state.slowTimer > 0) effects.push(`SLOW ${Math.ceil(state.slowTimer)}s`);
    if (state.fireballTimer > 0) effects.push(`FIREBALL ${Math.ceil(state.fireballTimer)}s`);
    if (state.catchTimer > 0) effects.push(`CATCH ${Math.ceil(state.catchTimer)}s`);
    if (state.shield) effects.push('SHIELD READY');
    if (state.paddle.narrowTimer > 0) effects.push(`SHRUNK ${Math.ceil(state.paddle.narrowTimer)}s`);
    for (let i = 0; i < effects.length; i += 1) {
      text(effects[i], FIELD.width - 24, 48 + i * 22, 17, PALETTE.gold, 'right');
    }
    if (inGame) drawBossBar(state);
    // A stuck ball waits for a launch (play screen only — never over a panel).
    if (screen === SCREEN_PLAY && state.balls.some((b) => b.active && b.stuck)) {
      text('SPACE / CLICK TO LAUNCH', FIELD.width / 2, 600, 20, PALETTE.gold, 'center', '800');
    }
    // How to play, small, bottom left during play.
    text('Arrows / A D or mouse — Space launch / fire — Shift dash — P pause — M mute', 24, FIELD.height - 26, 15, PALETTE.muted, 'left', '400');
    if (ui.muted) text('MUTED', FIELD.width - 24, FIELD.height - 26, 15, PALETTE.muted, 'right', '400');
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || state.banner === '') return;
    context.textBaseline = 'alphabetic';
    const alpha = Math.min(1, state.bannerTimer);
    context.save();
    context.globalAlpha = alpha;
    if (!state.bossPhase) text(`LEVEL ${state.level}`, FIELD.width / 2, 330, 30, PALETTE.muted, 'center');
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

  function drawTitle(state, best, ui, time) {
    context.fillStyle = 'rgba(7, 3, 18, 0.52)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    // Logo with a glow pulse.
    context.save();
    context.shadowColor = PALETTE.paddle;
    context.shadowBlur = 24 + 8 * Math.sin(time * 2);
    text('LUMENBREAK', FIELD.width / 2, 128, 84, PALETTE.text, 'center', '800');
    context.restore();
    text('SHATTER THE CRYSTAL WALLS · BREAK THE WARDENS · TAKE BACK THE LIGHT', FIELD.width / 2, 166, 19, PALETTE.gold, 'center', '600');
    text('8 walls · 5 wraith kinds · 2 wardens · 8 powerups · endless drift · dash', FIELD.width / 2, 196, 17, PALETTE.muted, 'center', '400');
    // Menu buttons.
    for (let i = 0; i < TITLE_OPTIONS.length; i += 1) {
      const rect = titleOptionRect(i);
      const selected = ui.menuIndex === i;
      context.fillStyle = selected ? 'rgba(57, 230, 255, 0.18)' : 'rgba(10, 4, 28, 0.72)';
      roundRect(context, rect.x, rect.y, rect.w, rect.h, 10);
      context.fill();
      context.strokeStyle = selected ? PALETTE.paddle : '#3a2a55';
      context.lineWidth = selected ? 3 : 2;
      roundRect(context, rect.x, rect.y, rect.w, rect.h, 10);
      context.stroke();
      text(TITLE_OPTIONS[i].label, rect.x + 28, rect.y + 35, 24, selected ? PALETTE.text : PALETTE.muted, 'left', '800');
      text(TITLE_OPTIONS[i].hint, rect.x + rect.w - 28, rect.y + 35, 16, PALETTE.muted, 'right', '400');
      if (selected) text('▶', rect.x - 22, rect.y + 35, 22, PALETTE.paddle, 'right', '800');
    }
    // Progress strip: best, stars, wins, and the eight wall nodes.
    const progress = ui.progress;
    const stars = progress ? totalStars(progress) : 0;
    const wins = progress ? progress.wins : 0;
    text(best > 0 ? bestLabel(best) : 'NO BEST YET', FIELD.width / 2, 608, 20, PALETTE.muted, 'center');
    const driftBest = progress && progress.endlessBest > 0 ? `   ·   DRIFT BEST ${progress.endlessBest}` : '';
    text(`STARS ${stars}/${LEVELS * 3}   ·   WINS ${wins}${driftBest}`, FIELD.width / 2, 634, 18, PALETTE.gold, 'center');
    const nodeGap = 44;
    const firstX = FIELD.width / 2 - ((LEVELS - 1) * nodeGap) / 2;
    for (let level = 1; level <= LEVELS; level += 1) {
      const unlocked = progress ? level <= progress.unlocked : level === 1;
      const earned = progress ? progress.stars[level] ?? 0 : 0;
      const x = firstX + (level - 1) * nodeGap;
      const y = 664;
      context.fillStyle = unlocked ? themeOf(level).accent : '#2a2144';
      context.beginPath();
      context.arc(x, y, 13, 0, Math.PI * 2);
      context.fill();
      text(unlocked ? String(level) : '🔒', x, y + 5, 15, unlocked ? '#14082e' : PALETTE.muted, 'center', '800');
      if (earned > 0) text('★'.repeat(earned), x, y + 24, 10, PALETTE.gold, 'center', '800');
    }
    text('↑ ↓ choose · Enter select · click works too', FIELD.width / 2, 706, 14, PALETTE.muted, 'center', '400');
  }

  function drawSelect(state, ui) {
    context.fillStyle = 'rgba(7, 3, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text('CHOOSE A WALL', FIELD.width / 2, 96, 52, PALETTE.text, 'center', '800');
    text('Clear a wall to unlock the next. Lose no life for 3 stars.', FIELD.width / 2, 130, 18, PALETTE.muted, 'center', '400');
    text(`BEST ${ui.progress ? ui.progress.best : 0}   ·   STARS ${ui.progress ? totalStars(ui.progress) : 0}/${LEVELS * 3}`, FIELD.width / 2, 158, 18, PALETTE.gold, 'center');
    for (let level = 1; level <= LEVELS; level += 1) {
      const rect = levelCardRect(level);
      const wall = WALLS[level - 1];
      const theme = themeOf(level);
      const unlocked = ui.progress ? level <= ui.progress.unlocked : level === 1;
      const selected = ui.selectIndex === level;
      const earned = ui.progress ? ui.progress.stars[level] ?? 0 : 0;
      context.fillStyle = unlocked ? 'rgba(20, 8, 46, 0.92)' : 'rgba(10, 4, 28, 0.85)';
      roundRect(context, rect.x, rect.y, rect.w, rect.h, 12);
      context.fill();
      context.strokeStyle = selected ? PALETTE.gold : unlocked ? theme.accent : '#2a2144';
      context.lineWidth = selected ? 3 : 2;
      roundRect(context, rect.x, rect.y, rect.w, rect.h, 12);
      context.stroke();
      text(`WALL ${level}`, rect.x + rect.w / 2, rect.y + 34, 16, PALETTE.muted, 'center', '600');
      text(wall.name, rect.x + rect.w / 2, rect.y + 64, 21, unlocked ? PALETTE.text : PALETTE.muted, 'center', '800');
      text(theme.blurb, rect.x + rect.w / 2, rect.y + 90, 13, PALETTE.muted, 'center', '400');
      if (!unlocked) {
        text('🔒 LOCKED', rect.x + rect.w / 2, rect.y + 128, 18, PALETTE.muted, 'center', '600');
      } else {
        for (let s = 0; s < 3; s += 1) {
          const sx = rect.x + rect.w / 2 + (s - 1) * 30;
          starShape(context, sx, rect.y + 122, 11);
          context.fillStyle = s < earned ? PALETTE.gold : '#2a2144';
          context.fill();
        }
        if (wall.boss !== null) {
          text('⚔ WARDEN', rect.x + rect.w / 2, rect.y + 152, 15, '#ff8c6b', 'center', '800');
        } else {
          const wraiths = wall.enemies.drifter + wall.enemies.weaver + wall.enemies.spitter;
          text(wraiths > 0 ? `${wraiths} WRAITH${wraiths > 1 ? 'S' : ''}` : 'NO WRAITHS', rect.x + rect.w / 2, rect.y + 152, 15, '#c792ff', 'center', '600');
        }
      }
    }
    const back = LEVELS_BACK_RECT;
    context.fillStyle = 'rgba(10, 4, 28, 0.85)';
    roundRect(context, back.x, back.y, back.w, back.h, 10);
    context.fill();
    context.strokeStyle = PALETTE.paddle;
    context.lineWidth = 2;
    roundRect(context, back.x, back.y, back.w, back.h, 10);
    context.stroke();
    text('← BACK TO TITLE  (Esc)', back.x + back.w / 2, back.y + 33, 19, PALETTE.text, 'center', '600');
    text('Arrows move · Enter / click plays the wall', FIELD.width / 2, 668, 15, PALETTE.muted, 'center', '400');
  }

  function drawHelp() {
    context.fillStyle = 'rgba(7, 3, 18, 0.78)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text('HOW TO PLAY', FIELD.width / 2, 84, 48, PALETTE.text, 'center', '800');
    text('Shatter every breakable brick. Steel never breaks. Ember bricks chain to their neighbours.', FIELD.width / 2, 116, 18, PALETTE.muted, 'center', '400');
    const colX = [110, 480, 850];
    text('CONTROLS', colX[0], 168, 22, PALETTE.paddle, 'left', '800');
    const controls = [
      '← → / A D — move paddle',
      'Mouse — steer paddle',
      'Space / click — launch, fire',
      'Shift — dash (3s cooldown)',
      'P / Esc — pause',
      'M — mute · Q — quit (pause)',
      '↑ ↓ — menus · Enter — select',
    ];
    controls.forEach((line, i) => text(line, colX[0], 198 + i * 28, 17, PALETTE.text, 'left', '400'));
    text('POWERUPS', colX[1], 168, 22, PALETTE.gold, 'left', '800');
    Object.entries(POWERUP_CATALOG).forEach(([kind, entry], i) => {
      text(kind, colX[1], 198 + i * 28, 18, entry.color, 'left', '800');
      text(entry.blurb, colX[1] + 30, 198 + i * 28, 16, PALETTE.text, 'left', '400');
    });
    text('WRAITHS & WARDENS', colX[2], 168, 22, '#ff8c6b', 'left', '800');
    const foes = [
      'Drifter — patrols, 1 hit',
      'Weaver — dives, don\'t let it land',
      'Spitter — shoots shards, 2 hits',
      'Splitter — bursts into 2 mites',
      'Guardian — shielded, 3 hits',
      'Mite — fast shard of a splitter',
      'Shards shrink the paddle',
      'Wardens guard walls 4 and 8',
      'Hit a warden\'s core for CRITS',
      'Combo ×5+ is FEVER — big points',
      'Endless Drift: walls never end',
    ];
    foes.forEach((line, i) => text(line, colX[2], 198 + i * 28, 16, PALETTE.text, 'left', '400'));
    text('SCORING — bricks × combo multiplier, wraiths, warden bonuses, clear bonus, 3 stars for a flawless wall.', FIELD.width / 2, 560, 17, PALETTE.muted, 'center', '400');
    const back = HELP_BACK_RECT;
    context.fillStyle = 'rgba(10, 4, 28, 0.9)';
    roundRect(context, back.x, back.y, back.w, back.h, 10);
    context.fill();
    context.strokeStyle = PALETTE.paddle;
    context.lineWidth = 2;
    roundRect(context, back.x, back.y, back.w, back.h, 10);
    context.stroke();
    text('← BACK TO TITLE  (Esc)', back.x + back.w / 2, back.y + 33, 19, PALETTE.text, 'center', '600');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time, ui = {}) {
    const fullUi = {
      progress: ui.progress ?? null,
      menuIndex: ui.menuIndex ?? 0,
      selectIndex: ui.selectIndex ?? 1,
      muted: ui.muted ?? false,
      runStars: ui.runStars ?? [],
    };
    const shake = shakeOffset(state.effects, time);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shake.x * view.scale, view.y + shake.y * view.scale);
    drawBackground(state, time);
    if (screen === SCREEN_SELECT) {
      drawSelect(state, fullUi);
      return;
    }
    if (screen === SCREEN_HELP) {
      drawHelp();
      return;
    }
    drawBricks(state);
    drawBoss(state, time);
    drawEnemies(state, time);
    drawShards(state, time);
    drawParticles(state);
    drawPowerups(state);
    drawBolts(state);
    drawShield(state);
    drawPaddle(state, time);
    drawBalls(state);
    // Popups and rings belong to live play; end panels stay clean without them.
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawEffects(state);
    // Full-field flash on big moments.
    if (state.effects.flash > 0) {
      context.globalAlpha = Math.min(0.28, state.effects.flash);
      context.fillStyle = state.effects.flashColor;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, fullUi, time);
      return;
    }
    drawHud(state, best, fullUi, screen);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawBanner(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', [
        'The crystals will wait for you.',
        'Powerups: W wide · M multi · L laser · S slow',
        'F fireball · C catch · N shield · + extra life',
        'Shift dashes the paddle (3s cooldown).',
        'Dodge the red shards. Hit the warden\'s core for crits.',
        'Endless Drift never ends — chase your best.',
      ], 'P resume · Q quit to title', PALETTE.paddle);
    } else if (screen === SCREEN_OVER) {
      const lines = [
        finalLabel(state.score),
        bestLabel(best),
        state.mode === 'endless'
          ? `Endless Drift — reached drift ${state.level}`
          : `Reached level ${state.level} of ${LEVELS} — ${state.levelName}`,
        bricksLabel(state.totalBroken),
        wraithLabel(state.stats.enemies),
        bossLabel(state.stats.bosses),
        maxComboLabel(state.stats.maxCombo),
        caughtLabel(state.caught),
      ];
      drawPanel('GAME OVER', lines, 'Space / click: play again · Esc: title', '#ff5c7a');
    } else if (screen === SCREEN_WIN) {
      const lines = [
        'All eight walls shattered. Both wardens broken. The light is yours.',
        finalLabel(state.score),
        bestLabel(best),
        `Stars earned: ${fullUi.runStars.map((s) => `W${s.level}★${s.stars}`).join('  ') || '—'}`,
        bricksLabel(state.totalBroken),
        wraithLabel(state.stats.enemies),
        maxComboLabel(state.stats.maxCombo),
        caughtLabel(state.caught),
      ];
      drawPanel('YOU WIN', lines, 'Space / click: play again · Esc: title', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

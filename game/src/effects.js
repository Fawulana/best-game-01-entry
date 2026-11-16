// Juice with no gameplay in it: floating score popups, screen shake, shockwave
// rings and the flash that washes the field on a big moment. The world owns the
// pools; this module spawns and advances them, the renderer draws them. Nothing
// here reads the clock — updateEffects takes the same fixed step as the world.

import { POOL } from './config.js';

/** The effect pools the world keeps beside its particles. */
export function createEffects() {
  const texts = [];
  for (let i = 0; i < POOL.texts; i += 1) {
    texts.push({ active: false, x: 0, y: 0, text: '', color: '#fff', life: 0, maxLife: 1, size: 22 });
  }
  const rings = [];
  for (let i = 0; i < 8; i += 1) {
    rings.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 120, life: 0, maxLife: 1, color: '#fff' });
  }
  return { texts, rings, shake: 0, flash: 0, flashColor: '#ffffff', slowmo: 0 };
}

/** A score popup that rises and fades where something shattered. */
export function spawnFloatingText(effects, x, y, text, color, size = 22) {
  for (const popup of effects.texts) {
    if (popup.active) continue;
    popup.active = true;
    popup.x = x;
    popup.y = y;
    popup.text = text;
    popup.color = color;
    popup.size = size;
    popup.life = 0.9;
    popup.maxLife = 0.9;
    return;
  }
}

/** An expanding ring, for warden hits and level clears. */
export function spawnRing(effects, x, y, color, maxRadius = 140) {
  for (const ring of effects.rings) {
    if (ring.active) continue;
    ring.active = true;
    ring.x = x;
    ring.y = y;
    ring.radius = 8;
    ring.maxRadius = maxRadius;
    ring.color = color;
    ring.life = 0.45;
    ring.maxLife = 0.45;
    return;
  }
}

/** Add screen shake; the strongest recent shake wins, and it decays every step. */
export function addShake(effects, amount) {
  effects.shake = Math.min(18, Math.max(effects.shake, amount));
}

/** A full-field colour flash that fades over `seconds`. */
export function addFlash(effects, color, seconds = 0.25) {
  effects.flash = Math.max(effects.flash, seconds);
  effects.flashColor = color;
}

/** Advance popups, rings, shake and flash by one fixed step. */
export function updateEffects(effects, dt) {
  for (const popup of effects.texts) {
    if (!popup.active) continue;
    popup.life -= dt;
    popup.y -= 46 * dt;
    if (popup.life <= 0) popup.active = false;
  }
  for (const ring of effects.rings) {
    if (!ring.active) continue;
    ring.life -= dt;
    ring.radius += ((ring.maxRadius - 8) / ring.maxLife) * dt;
    if (ring.life <= 0) ring.active = false;
  }
  if (effects.shake > 0) effects.shake = Math.max(0, effects.shake - 42 * dt);
  if (effects.flash > 0) effects.flash = Math.max(0, effects.flash - dt);
  if (effects.slowmo > 0) effects.slowmo = Math.max(0, effects.slowmo - dt);
}

/** The current shake offset, from the shake amount and a time value. */
export function shakeOffset(effects, time) {
  if (effects.shake <= 0) return { x: 0, y: 0 };
  const amount = effects.shake;
  return {
    x: Math.sin(time * 91.7) * amount * 0.6,
    y: Math.cos(time * 83.3) * amount * 0.6,
  };
}

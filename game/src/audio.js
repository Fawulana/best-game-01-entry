// Synthesized sound, no audio files: every effect is an oscillator (or two) through a
// gain envelope, built on first use so the AudioContext starts on a player gesture.
// Nothing here runs before the player presses a key or clicks.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (Ctor === undefined) return null;
      context = new Ctor();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, endFreq, seconds, type, volume, delay = 0) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + seconds);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** A short bright blip, pitched by the combo multiplier. */
  function paddle(multiplier = 1) {
    tone(220 + multiplier * 40, 180 + multiplier * 30, 0.07, 'square', 0.05);
  }

  function brick(multiplier = 1) {
    tone(520 + multiplier * 60, 140, 0.12, 'triangle', 0.12);
    tone(1040 + multiplier * 90, 320, 0.08, 'sine', 0.06);
  }

  function crack() {
    tone(300, 160, 0.06, 'square', 0.05);
  }

  function tink() {
    tone(1400, 1100, 0.05, 'sine', 0.04);
  }

  function powerup() {
    tone(523, 523, 0.09, 'sine', 0.1);
    tone(659, 659, 0.09, 'sine', 0.1, 0.07);
    tone(784, 784, 0.14, 'sine', 0.1, 0.14);
  }

  function life() {
    tone(392, 392, 0.1, 'sine', 0.1);
    tone(523, 523, 0.1, 'sine', 0.1, 0.09);
    tone(659, 659, 0.1, 'sine', 0.1, 0.18);
    tone(880, 880, 0.22, 'sine', 0.12, 0.27);
  }

  function laser() {
    tone(880, 220, 0.09, 'sawtooth', 0.05);
  }

  function lost() {
    tone(320, 70, 0.5, 'sawtooth', 0.12);
  }

  function clear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => tone(freq, freq, 0.16, 'triangle', 0.1, i * 0.09));
  }

  function win() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => tone(freq, freq, 0.22, 'triangle', 0.11, i * 0.11));
  }

  function over() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => tone(freq, freq * 0.9, 0.28, 'sawtooth', 0.08, i * 0.16));
  }

  /** A wraith shattering: a downward shimmer. */
  function enemy() {
    tone(980, 240, 0.16, 'triangle', 0.11);
    tone(1470, 360, 0.12, 'sine', 0.07, 0.03);
  }

  /** A shard being spat: a short hiss downward. */
  function shard() {
    tone(720, 180, 0.1, 'sawtooth', 0.04);
  }

  /** A shard striking the paddle: a dull, punishing thud. */
  function shardHit() {
    tone(160, 60, 0.22, 'sawtooth', 0.14);
    tone(90, 45, 0.25, 'square', 0.1, 0.02);
  }

  /** The shield catching a lost ball: a bright rescue chime. */
  function shield() {
    tone(784, 784, 0.1, 'sine', 0.11);
    tone(1175, 1175, 0.18, 'sine', 0.11, 0.08);
  }

  /** A warden taking a hit: a deep crystal clang. */
  function bossHit() {
    tone(196, 120, 0.14, 'square', 0.1);
    tone(1180, 900, 0.08, 'sine', 0.05);
  }

  /** A critical hit on the warden's core: a rising shriek. */
  function bossCrit() {
    tone(660, 1980, 0.18, 'sawtooth', 0.09);
    tone(1320, 2640, 0.14, 'sine', 0.07, 0.04);
  }

  /** A warden rising: a low roar that climbs. */
  function bossRoar() {
    tone(82, 220, 0.7, 'sawtooth', 0.13);
    tone(55, 110, 0.7, 'square', 0.09, 0.05);
  }

  /** A warden falling: a long, bright collapse. */
  function bossDown() {
    const notes = [1047, 880, 784, 659, 523, 784, 1047];
    notes.forEach((freq, i) => tone(freq, freq, 0.2, 'triangle', 0.11, i * 0.09));
  }

  /** Menu cursor moving: the quietest blip in the game. */
  function menuMove() {
    tone(660, 660, 0.05, 'sine', 0.05);
  }

  /** Menu selection confirmed: two rising notes. */
  function menuSelect() {
    tone(587, 587, 0.08, 'sine', 0.09);
    tone(880, 880, 0.12, 'sine', 0.09, 0.07);
  }

  /** Fever reached: the combo is at its hottest. */
  function fever() {
    tone(523, 523, 0.07, 'square', 0.07);
    tone(784, 784, 0.07, 'square', 0.07, 0.06);
    tone(1047, 1047, 0.16, 'square', 0.08, 0.12);
  }

  return {
    unlock() {
      ensure();
    },
    paddle, brick, crack, tink, powerup, life, laser, lost, clear, win, over,
    enemy, shard, shardHit, shield, bossHit, bossCrit, bossRoar, bossDown,
    menuMove, menuSelect, fever,
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}

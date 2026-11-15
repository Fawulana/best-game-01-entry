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

  return {
    unlock() {
      ensure();
    },
    paddle, brick, crack, tink, powerup, life, laser, lost, clear, win, over,
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}

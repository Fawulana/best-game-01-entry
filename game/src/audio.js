// All sound, synthesized with WebAudio: no audio files, nothing fetched. Every effect is
// a short oscillator blip with a gain envelope, so the game stays silent until the player
// first presses a key or clicks (the browser's autoplay rule) and never throws when audio
// is unavailable. In screenshot mode no gesture ever happens, so this file stays quiet.

export function createAudio() {
  let context = null;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') void context.resume();
      return context;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  /** One blip: `type` is the oscillator shape, `slideTo` an optional end frequency. */
  function tone(freq, dur, type, vol, slideTo) {
    const ctx = ensure();
    if (ctx === null) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // A sound failing must never break the game.
    }
  }

  /** Two notes in quick succession, the second a little higher. */
  function chirp(first, second, dur, type, vol) {
    tone(first, dur, type, vol);
    const ctx = context;
    if (ctx === null) return;
    window.setTimeout(() => tone(second, dur, type, vol), Math.round(dur * 500));
  }

  return {
    /** Call on the first key or click, so the context is allowed to start. */
    unlock() {
      ensure();
    },
    paddle() {
      tone(220, 0.07, 'square', 0.08, 330);
    },
    wall() {
      tone(160, 0.05, 'square', 0.05);
    },
    brick(hitsLeft) {
      tone(hitsLeft > 0 ? 520 : 660, 0.09, 'triangle', 0.14, hitsLeft > 0 ? 420 : 990);
    },
    ember() {
      tone(180, 0.22, 'sawtooth', 0.12, 60);
    },
    power() {
      chirp(660, 990, 0.09, 'sine', 0.14);
    },
    launch() {
      tone(330, 0.1, 'sine', 0.1, 660);
    },
    laser() {
      tone(880, 0.08, 'square', 0.07, 220);
    },
    lose() {
      tone(320, 0.35, 'sawtooth', 0.12, 70);
    },
    clear() {
      chirp(523, 784, 0.12, 'triangle', 0.14);
      window.setTimeout(() => tone(1046, 0.18, 'triangle', 0.12), 130);
    },
    win() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, index) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.13), index * 130);
      });
    },
    over() {
      const notes = [392, 311, 233];
      notes.forEach((freq, index) => {
        window.setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.1), index * 170);
      });
    },
  };
}

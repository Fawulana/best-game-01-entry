// A generative WebAudio score: no audio files, just a lookahead sequencer playing
// a bass line and an arpeggio from a minor pentatonic scale. Four moods — title
// (slow and spacious), play (driving), boss (faster, tenser) and endless (quick
// and restless) — crossfaded by changing the pattern, never by stopping. Everything is guarded: no AudioContext
// means no music and no error, and the sequencer stops when the tab hides.

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const BASE = 110; // A2

const PATTERNS = {
  title: { bpm: 76, bass: [0, null, 7, null, 5, null, 3, null], arp: [12, 15, 19, 15, 17, 19, 22, 19] },
  play: { bpm: 112, bass: [0, 0, 7, 0, 5, 5, 3, 7], arp: [12, 19, 15, 22, 17, 15, 19, 24] },
  boss: { bpm: 140, bass: [0, 0, 0, 7, 0, 0, 5, 3], arp: [12, 12, 19, 15, 22, 19, 17, 24] },
  // Endless Drift: quicker than play, with a restless rising arpeggio.
  endless: { bpm: 126, bass: [0, 0, 7, 5, 0, 7, 5, 3], arp: [12, 17, 19, 22, 19, 22, 24, 22] },
};

function freqOf(semi) {
  return BASE * 2 ** (semi / 12);
}

export function createMusic() {
  let context = null;
  let master = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let mode = 'title';
  let muted = false;
  let started = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (Ctor === undefined) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return null;
    }
    return context;
  }

  function note(freq, when, seconds, type, volume) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + seconds + 0.02);
  }

  function schedule() {
    if (context === null || muted) return;
    const pattern = PATTERNS[mode];
    const stepSeconds = 60 / pattern.bpm / 2;
    while (nextTime < context.currentTime + 0.15) {
      const index = step % 8;
      const bass = pattern.bass[index];
      if (bass !== null && bass !== undefined) {
        note(freqOf(bass) / 2, nextTime, stepSeconds * 1.8, 'triangle', 0.16);
      }
      const arpSemi = SCALE[(pattern.arp[index] + step) % SCALE.length];
      note(freqOf(arpSemi) * 2, nextTime, stepSeconds * 0.9, 'sine', 0.05);
      if (index === 0 || index === 4) {
        note(freqOf(0) * 4, nextTime, 0.08, 'sine', 0.03);
      }
      nextTime += stepSeconds;
      step += 1;
    }
  }

  return {
    /** Start the sequencer (call from a player gesture so audio is allowed). */
    unlock() {
      const ctx = ensure();
      if (ctx === null || started) return;
      if (ctx.state === 'suspended') void ctx.resume();
      started = true;
      nextTime = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 30);
    },
    /** Switch mood: 'title' | 'play' | 'boss' | 'endless'. */
    setMode(next) {
      if (PATTERNS[next] !== undefined) mode = next;
    },
    setMuted(next) {
      muted = next;
      if (master !== null && context !== null) {
        master.gain.setTargetAtTime(next ? 0 : 0.5, context.currentTime, 0.05);
      }
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      started = false;
    },
  };
}

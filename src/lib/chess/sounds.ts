// Tiny Web Audio synth for chess sounds. No assets, no network.
let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) {
    const Ctor: typeof AudioContext =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
};

function tone({
  freq,
  duration,
  type = "sine",
  gain = 0.18,
  attack = 0.005,
  release = 0.08,
  freqEnd,
}: ToneOpts) {
  try {
    const c = ac();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.linearRampToValueAtTime(0.0001, t0 + duration + release);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + release + 0.02);
  } catch {
    /* ignore */
  }
}

function noise(duration: number, gain = 0.15) {
  try {
    const c = ac();
    const t0 = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    src.connect(filter).connect(g).connect(c.destination);
    src.start(t0);
  } catch {
    /* ignore */
  }
}

let muted = false;
export function setMuted(v: boolean) {
  muted = v;
}
export function isMuted() {
  return muted;
}

export const sfx = {
  move() {
    if (muted) return;
    tone({ freq: 520, freqEnd: 380, duration: 0.06, type: "triangle", gain: 0.18 });
  },
  capture() {
    if (muted) return;
    noise(0.12, 0.18);
    tone({ freq: 220, freqEnd: 110, duration: 0.1, type: "square", gain: 0.14 });
  },
  check() {
    if (muted) return;
    tone({ freq: 880, duration: 0.09, type: "sawtooth", gain: 0.15 });
    setTimeout(() => tone({ freq: 1320, duration: 0.12, type: "sawtooth", gain: 0.15 }), 90);
  },
  castle() {
    if (muted) return;
    tone({ freq: 440, duration: 0.06, type: "triangle" });
    setTimeout(() => tone({ freq: 660, duration: 0.08, type: "triangle" }), 60);
  },
  gameOverWin() {
    if (muted) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, duration: 0.18, type: "triangle", gain: 0.2 }), i * 120),
    );
  },
  gameOverLose() {
    if (muted) return;
    [392, 349, 294, 220].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, duration: 0.22, type: "sine", gain: 0.18 }), i * 140),
    );
  },
  draw() {
    if (muted) return;
    tone({ freq: 440, duration: 0.2, type: "sine", gain: 0.15 });
    setTimeout(() => tone({ freq: 440, duration: 0.2, type: "sine", gain: 0.15 }), 200);
  },
  start() {
    if (muted) return;
    tone({ freq: 660, duration: 0.08, type: "triangle" });
    setTimeout(() => tone({ freq: 880, duration: 0.1, type: "triangle" }), 70);
  },
};

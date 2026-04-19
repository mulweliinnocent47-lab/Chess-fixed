// sounds.ts — Chess sound system
//
// Uses the uploaded Lichess-style MP3 files from /sounds/:
//   move-self.mp3   capture.mp3   castle.mp3   promote.mp3
//   move-check.mp3  premove.mp3   illegal.mp3  tenseconds.mp3
//
// Win / lose / correct / wrong / draw / start use Web Audio synthesis
// because no MP3s were provided for those — they still sound great.

// ── Audio context ─────────────────────────────────────────────────────────────

// Single shared AudioContext — never create more than one per page.
// Web Audio has a hard browser limit of ~6 contexts; creating one per
// component mount crashes audio on rapid page changes.
let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();

    // Auto-resume on any user interaction (iOS/Chrome autoplay policy)
    const resume = () => {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    document.addEventListener("pointerdown", resume, { once: false, passive: true });
    document.addEventListener("keydown",     resume, { once: false, passive: true });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// ── MP3 buffer cache ──────────────────────────────────────────────────────────

type SoundFile =
  | "move-self"
  | "capture"
  | "castle"
  | "promote"
  | "move-check"
  | "premove"
  | "illegal"
  | "tenseconds";

const bufferCache = new Map<SoundFile, AudioBuffer | null>();
// null  = tried and failed; absent = not tried yet

async function loadBuffer(name: SoundFile): Promise<AudioBuffer | null> {
  if (bufferCache.has(name)) return bufferCache.get(name)!;
  try {
    const resp = await fetch(`/sounds/${name}.mp3`, { cache: "force-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arr = await resp.arrayBuffer();
    const buf = await ac().decodeAudioData(arr);
    bufferCache.set(name, buf);
    return buf;
  } catch {
    bufferCache.set(name, null);
    return null;
  }
}

function playBuffer(buf: AudioBuffer, volume = 1) {
  try {
    const c = ac();
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = Math.max(0, Math.min(2, volume));
    src.connect(gain).connect(c.destination);
    src.start(c.currentTime);
  } catch { /* ignore */ }
}

// Preload all MP3s during idle time so first-move playback is instant.
function preloadAll() {
  const names: SoundFile[] = [
    "move-self", "capture", "castle", "promote",
    "move-check", "premove", "illegal", "tenseconds",
  ];
  const schedule = () => names.forEach(loadBuffer);
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(schedule, { timeout: 4000 });
  } else {
    setTimeout(schedule, 1500);
  }
}

// Play an MP3 by name. If not cached yet, loads it (showing no gap because
// the synth fallback fires immediately on the first call).
async function playMp3(name: SoundFile, volume = 1, fallback?: () => void) {
  if (muted) return;
  const cached = bufferCache.get(name);
  if (cached) {
    playBuffer(cached, volume);
    return;
  }
  if (cached === null) {
    // File unavailable — use synth
    fallback?.();
    return;
  }
  // First play: fire synth immediately, load MP3 for next time
  fallback?.();
  loadBuffer(name);
}

// ── Web Audio synthesis (win / lose / correct / wrong / draw / start) ─────────

function note(freq: number, durationMs: number, gain = 0.18, delayMs = 0, type: OscillatorType = "triangle") {
  try {
    const c = ac();
    const t0 = c.currentTime + delayMs / 1000;
    const dur = durationMs / 1000;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.setValueAtTime(gain, t0 + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

function noiseClick(centerFreq: number, durationMs: number, gain = 0.30) {
  try {
    const c = ac();
    const dur = durationMs / 1000;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-8 * i / data.length);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = centerFreq;
    bp.Q.value = 2;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(c.destination);
    src.start(c.currentTime);
    src.stop(c.currentTime + dur + 0.01);
  } catch { /* ignore */ }
}

const synth = {
  move()    { noiseClick(700, 18, 0.28); },
  capture() { noiseClick(380, 28, 0.42); noiseClick(900, 10, 0.20); },
  castle()  { noiseClick(650, 16, 0.26); setTimeout(() => noiseClick(650, 14, 0.20), 70); },
  check()   { noiseClick(700, 18, 0.28); note(660, 80, 0.18, 5); },
  promote() { note(880, 140, 0.20, 0); note(1109, 180, 0.20, 120); },
  illegal() { note(330, 90, 0.18, 0, "sawtooth"); note(280, 110, 0.15, 80, "sawtooth"); },
  premove() { noiseClick(900, 10, 0.18); },
  tenseconds() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => note(880, 80, 0.14), i * 300);
    }
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => note(f, 220, 0.20, i * 130));
  },
  lose() {
    [523, 440, 349, 330].forEach((f, i) => note(f, 240, 0.18, i * 150));
  },
  correct() { note(880, 130, 0.20, 0); note(1109, 160, 0.20, 110); },
  wrong()   { note(330, 110, 0.20, 0); note(262, 150, 0.18, 90); },
  draw()    { note(440, 180, 0.15, 0); note(440, 180, 0.15, 210); },
  start()   { note(660, 90, 0.16, 0); note(880, 110, 0.16, 85); },
};

// ── Mute control ──────────────────────────────────────────────────────────────

let muted = false;
export function setMuted(v: boolean) { muted = v; }
export function isMuted() { return muted; }

// ── Low-time warning state (prevents tenseconds spam) ─────────────────────────

let tensecPlayed = false;
export function resetTensecWarning() { tensecPlayed = false; }

// ── Public sfx API ────────────────────────────────────────────────────────────

export const sfx = {
  /** Normal piece move (own piece). */
  move() {
    void playMp3("move-self", 1.0, synth.move);
  },

  /** Piece captures another. */
  capture() {
    void playMp3("capture", 1.0, synth.capture);
  },

  /** Castling — two pieces move. */
  castle() {
    void playMp3("castle", 1.0, synth.castle);
  },

  /** Move that gives check. */
  check() {
    void playMp3("move-check", 1.0, synth.check);
  },

  /** Pawn promotion. */
  promote() {
    void playMp3("promote", 1.0, synth.promote);
  },

  /** Premove queued. */
  premove() {
    void playMp3("premove", 0.9, synth.premove);
  },

  /** Illegal move attempted. */
  illegal() {
    void playMp3("illegal", 1.0, synth.illegal);
  },

  /** Low-time warning — plays once per game when clock hits 10s. */
  tenseconds() {
    if (tensecPlayed) return;
    tensecPlayed = true;
    void playMp3("tenseconds", 0.85, synth.tenseconds);
  },

  /** Game won. */
  gameOverWin() {
    if (muted) return;
    synth.win();
  },

  /** Game lost. */
  gameOverLose() {
    if (muted) return;
    synth.lose();
  },

  /** Puzzle/rush correct move. */
  correct() {
    if (muted) return;
    synth.correct();
  },

  /** Puzzle/rush wrong move. */
  wrong() {
    if (muted) return;
    synth.wrong();
  },

  /** Draw / stalemate. */
  draw() {
    if (muted) return;
    synth.draw();
  },

  /** New game start. */
  start() {
    if (muted) return;
    synth.start();
  },
};

// Kick off background preload
if (typeof window !== "undefined") preloadAll();

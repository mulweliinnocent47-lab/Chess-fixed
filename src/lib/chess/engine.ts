// engine.ts — Stockfish wrapper with 60fps game loop
//
// Architecture:
//   mainWorker  — serial queue: bot bestMove, review, CPL, draw offer
//   liveWorker  — dedicated live eval bar (interruptible, 60fps loop)
//
// Game-loop pattern for live eval:
//   Stockfish emits 50–200 "info" lines per search.
//   We store the LATEST cp value in a module-level variable (pendingCp).
//   A single requestAnimationFrame loop reads it once per frame and pushes
//   it to the one registered callback. UI updates at 60fps max, regardless
//   of how many messages Stockfish sends.
//
// Critical lines (bestmove / readyok / uciok) bypass the frame budget and
// dispatch immediately so promise resolution has zero extra latency.

type Listener = (line: string) => void;

// ── Frame-rate-locked worker factory ─────────────────────────────────────────
// Non-critical "info" lines are coalesced: we keep only the latest, flush once
// per animation frame. Critical lines flush immediately.

function makeWorker(onLine: Listener): Worker {
  const w = new Worker("/stockfish/stockfish.js");
  let pendingLines: string[] = [];
  let rafId = 0;

  const flush = () => {
    rafId = 0;
    const lines = pendingLines;
    pendingLines = [];
    for (const l of lines) onLine(l);
  };

  w.onmessage = (e: MessageEvent) => {
    const line = typeof e.data === "string" ? e.data : String(e.data);
    const critical =
      line.startsWith("bestmove") ||
      line.startsWith("readyok") ||
      line.startsWith("uciok");

    if (critical) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (pendingLines.length) { const b = pendingLines; pendingLines = []; for (const l of b) onLine(l); }
      onLine(line);
    } else {
      pendingLines.push(line);
      if (!rafId) rafId = requestAnimationFrame(flush);
    }
  };
  return w;
}

// ── Main worker (serialised) ──────────────────────────────────────────────────

let mainWorker: Worker | null = null;
let mainReady = false;
let mainReadyPromise: Promise<void> | null = null;
const mainListeners = new Set<Listener>();
let evalQueue: Promise<unknown> = Promise.resolve();

function getMainWorker(): Worker {
  if (!mainWorker) mainWorker = makeWorker((l) => mainListeners.forEach((fn) => fn(l)));
  return mainWorker;
}
function mainSend(cmd: string) { getMainWorker().postMessage(cmd); }

export async function ensureReady(): Promise<void> {
  if (mainReady) return;
  if (mainReadyPromise) return mainReadyPromise;
  mainReadyPromise = new Promise<void>((resolve) => {
    const onLine = (line: string) => {
      if (line.startsWith("uciok")) { mainSend("isready"); }
      else if (line.startsWith("readyok")) {
        mainListeners.delete(onLine);
        mainReady = true;
        mainSend("setoption name Hash value 32");
        mainSend("setoption name Threads value 1");
        resolve();
      }
    };
    mainListeners.add(onLine);
    mainSend("uci");
  });
  return mainReadyPromise;
}

// Warm up both workers immediately so first move has zero latency.
// Called from main.tsx at app startup.
export function warmupEngine() {
  ensureReady().catch(() => {});
  ensureLiveReady().catch(() => {});
}

export type LevelConfig = { skill: number; depth: number; movetime: number };
export const LEVELS: LevelConfig[] = [
  { skill: 0,  depth: 1,  movetime: 30  },
  { skill: 3,  depth: 2,  movetime: 50  },
  { skill: 6,  depth: 3,  movetime: 80  },
  { skill: 9,  depth: 5,  movetime: 130 },
  { skill: 12, depth: 7,  movetime: 200 },
  { skill: 15, depth: 9,  movetime: 320 },
  { skill: 18, depth: 12, movetime: 500 },
  { skill: 20, depth: 15, movetime: 800 },
];

export async function setLevel(levelIdx: number): Promise<void> {
  await ensureReady();
  const cfg = LEVELS[levelIdx] ?? LEVELS[3];
  mainSend(`setoption name Skill Level value ${cfg.skill}`);
}

export function stopEngine() { if (mainWorker) mainSend("stop"); }
export const stop = stopEngine;

export type EvalResult = { bestMove: string | null; cp: number };

export async function bestMove(
  fen: string,
  opts: { depth?: number; movetime?: number },
): Promise<string | null> {
  await ensureReady();
  return new Promise<string | null>((resolve) => {
    const onLine = (line: string) => {
      if (line.startsWith("bestmove")) {
        mainListeners.delete(onLine);
        const mv = line.split(/\s+/)[1];
        resolve(mv && mv !== "(none)" ? mv : null);
      }
    };
    mainListeners.add(onLine);
    mainSend("ucinewgame");
    mainSend(`position fen ${fen}`);
    if (opts.movetime) mainSend(`go movetime ${opts.movetime}`);
    else mainSend(`go depth ${opts.depth ?? 12}`);
  });
}

async function _evaluate(
  fen: string,
  opts: { movetime?: number; depth?: number; freshGame?: boolean },
): Promise<EvalResult> {
  await ensureReady();
  const stm = fen.split(/\s+/)[1] === "w" ? 1 : -1;
  return new Promise<EvalResult>((resolve) => {
    let lastCp = 0; let lastMate: number | null = null;
    const onLine = (line: string) => {
      if (line.startsWith("info") && line.includes(" depth ")) {
        const cpM = line.match(/score cp (-?\d+)/);
        const mateM = line.match(/score mate (-?\d+)/);
        if (mateM) lastMate = parseInt(mateM[1], 10);
        else if (cpM) { lastCp = parseInt(cpM[1], 10); lastMate = null; }
      } else if (line.startsWith("bestmove")) {
        mainListeners.delete(onLine);
        const mv = line.split(/\s+/)[1];
        const cp = lastMate !== null
          ? (100000 - Math.abs(lastMate)) * Math.sign(lastMate) * stm
          : lastCp * stm;
        resolve({ bestMove: mv && mv !== "(none)" ? mv : null, cp });
      }
    };
    mainListeners.add(onLine);
    if (opts.freshGame) mainSend("ucinewgame");
    mainSend(`position fen ${fen}`);
    if (opts.movetime) mainSend(`go movetime ${opts.movetime}`);
    else if (opts.depth) mainSend(`go depth ${opts.depth}`);
    else mainSend("go movetime 80");
  });
}

export async function evaluate(
  fen: string,
  opts: { movetime?: number; depth?: number; freshGame?: boolean } = {},
): Promise<EvalResult> {
  const result = (evalQueue = evalQueue.catch(() => {}).then(() => _evaluate(fen, opts)));
  return result as Promise<EvalResult>;
}

// ── Live worker + 60fps game loop ─────────────────────────────────────────────
//
// The eval bar callback is registered once. The rAF game loop runs continuously
// while there is a pending eval value and fires the callback at 60fps max.
// Stockfish can emit 200 msgs/search — we reduce that to ≤60 UI updates/sec.

let liveWorker: Worker | null = null;
let liveReady = false;
let liveReadyPromise: Promise<void> | null = null;
const liveListeners = new Set<Listener>();
let liveResolve: ((r: EvalResult) => void) | null = null;

// Game loop state
let pendingCp: number | null = null;
let pendingMate: number | null = null;
let liveSideToMove = 1; // +1 white, -1 black
let evalCallback: ((cp: number) => void) | null = null;
let loopRunning = false;

function startGameLoop() {
  if (loopRunning) return;
  loopRunning = true;
  function loop() {
    if (pendingCp !== null || pendingMate !== null) {
      let cp: number;
      if (pendingMate !== null) {
        cp = (100000 - Math.abs(pendingMate)) * Math.sign(pendingMate) * liveSideToMove;
      } else {
        cp = (pendingCp ?? 0) * liveSideToMove;
      }
      evalCallback?.(cp);
      pendingCp = null;
      pendingMate = null;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/** Register the eval bar update callback. Call once at app startup. */
export function setLiveEvalCallback(cb: (cp: number) => void) {
  evalCallback = cb;
}

function getLiveWorker(): Worker {
  if (!liveWorker) liveWorker = makeWorker((l) => liveListeners.forEach((fn) => fn(l)));
  return liveWorker;
}
function liveSend(cmd: string) { getLiveWorker().postMessage(cmd); }

async function ensureLiveReady(): Promise<void> {
  if (liveReady) return;
  if (liveReadyPromise) return liveReadyPromise;
  liveReadyPromise = new Promise<void>((resolve) => {
    const onLine = (line: string) => {
      if (line.startsWith("uciok")) liveSend("isready");
      else if (line.startsWith("readyok")) {
        liveListeners.delete(onLine);
        liveReady = true;
        liveSend("setoption name Hash value 16");
        liveSend("setoption name Threads value 1");
        startGameLoop();
        resolve();
      }
    };
    liveListeners.add(onLine);
    liveSend("uci");
  });
  return liveReadyPromise;
}

export function stopLiveEngine() {
  if (liveWorker) liveSend("stop");
  if (liveResolve) { liveResolve({ bestMove: null, cp: 0 }); liveResolve = null; }
  liveListeners.clear();
  pendingCp = null;
  pendingMate = null;
}

/** Evaluate for the live eval bar.
 *  cp values are written to pendingCp each Stockfish message.
 *  The game loop reads pendingCp once per frame and calls evalCallback.
 *  This guarantees ≤60 UI updates/second regardless of Stockfish speed.
 */
export async function liveEvaluate(fen: string, movetime = 90): Promise<EvalResult | null> {
  await ensureLiveReady();

  // Cancel previous search immediately
  liveSend("stop");
  if (liveResolve) { liveResolve({ bestMove: null, cp: 0 }); liveResolve = null; }
  liveListeners.clear();
  pendingCp = null;
  pendingMate = null;

  liveSideToMove = fen.split(/\s+/)[1] === "w" ? 1 : -1;

  return new Promise<EvalResult | null>((resolve) => {
    liveResolve = resolve as (r: EvalResult) => void;
    const onLine = (line: string) => {
      if (line.startsWith("info") && line.includes(" depth ")) {
        const cpM = line.match(/score cp (-?\d+)/);
        const mateM = line.match(/score mate (-?\d+)/);
        // Write to pending — the game loop picks it up at 60fps
        if (mateM) { pendingMate = parseInt(mateM[1], 10); pendingCp = null; }
        else if (cpM) { pendingCp = parseInt(cpM[1], 10); pendingMate = null; }
      } else if (line.startsWith("bestmove")) {
        liveListeners.delete(onLine);
        liveResolve = null;
        const mv = line.split(/\s+/)[1];
        const cp = pendingMate !== null
          ? (100000 - Math.abs(pendingMate)) * Math.sign(pendingMate) * liveSideToMove
          : (pendingCp ?? 0) * liveSideToMove;
        // Flush final value immediately on bestmove
        evalCallback?.(cp);
        pendingCp = null; pendingMate = null;
        resolve({ bestMove: mv && mv !== "(none)" ? mv : null, cp });
      }
    };
    liveListeners.add(onLine);
    liveSend(`position fen ${fen}`);
    liveSend(`go movetime ${Math.min(movetime, 90)}`);
  });
}

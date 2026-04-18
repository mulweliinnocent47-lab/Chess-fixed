// Stockfish wrapper. The provided stockfish.js exposes a STOCKFISH() factory
// when used as a normal script, OR auto-wires postMessage when loaded as a
// Web Worker. We use the Worker mode for non-blocking analysis.

let worker: Worker | null = null;
let ready = false;
let readyPromise: Promise<void> | null = null;
const listeners = new Set<(line: string) => void>();

// Serial evaluation queue — ensures only one Stockfish search runs at a time.
// This prevents listeners from bleeding across concurrent evaluate() calls.
let evalQueue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/stockfish/stockfish.js");
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      listeners.forEach((l) => l(line));
    };
  }
  return worker;
}

function send(cmd: string) {
  getWorker().postMessage(cmd);
}

export async function ensureReady(): Promise<void> {
  if (ready) return;
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve) => {
    const onLine = (line: string) => {
      if (line.startsWith("uciok")) {
        send("isready");
      } else if (line.startsWith("readyok")) {
        listeners.delete(onLine);
        ready = true;
        resolve();
      }
    };
    listeners.add(onLine);
    send("uci");
  });
  return readyPromise;
}

export type LevelConfig = { skill: number; depth: number; movetime: number };

// 8 levels mapped across Stockfish skill 0..20 with scaled think time/depth.
export const LEVELS: LevelConfig[] = [
  { skill: 0, depth: 1, movetime: 30 },
  { skill: 3, depth: 2, movetime: 50 },
  { skill: 6, depth: 3, movetime: 80 },
  { skill: 9, depth: 5, movetime: 130 },
  { skill: 12, depth: 7, movetime: 200 },
  { skill: 15, depth: 9, movetime: 320 },
  { skill: 18, depth: 12, movetime: 500 },
  { skill: 20, depth: 15, movetime: 800 },
];

export async function setLevel(levelIdx: number): Promise<void> {
  await ensureReady();
  const cfg = LEVELS[levelIdx] ?? LEVELS[3];
  send(`setoption name Skill Level value ${cfg.skill}`);
}

// Run an analysis on a position, returning the best move in UCI (e.g. "e2e4").
export async function bestMove(
  fen: string,
  opts: { depth?: number; movetime?: number },
): Promise<string | null> {
  await ensureReady();
  return new Promise<string | null>((resolve) => {
    const onLine = (line: string) => {
      if (line.startsWith("bestmove")) {
        listeners.delete(onLine);
        const parts = line.split(/\s+/);
        const mv = parts[1];
        resolve(mv && mv !== "(none)" ? mv : null);
      }
    };
    listeners.add(onLine);
    send("ucinewgame");
    send(`position fen ${fen}`);
    if (opts.movetime) {
      send(`go movetime ${opts.movetime}`);
    } else {
      send(`go depth ${opts.depth ?? 12}`);
    }
  });
}

export function stop() {
  if (worker) send("stop");
}

export type EvalResult = {
  bestMove: string | null;
  // Centipawn score from White's perspective. Mate is encoded as +/-(100000 - distance).
  cp: number;
};

// Internal single-evaluation implementation (no queuing).
// freshGame=true sends "ucinewgame" to clear the hash table.
// During game review, only the very first call should set freshGame=true so
// that subsequent positions can reuse cached lines — exactly like Lichess does.
async function _evaluate(
  fen: string,
  opts: { depth?: number; movetime?: number; freshGame?: boolean },
): Promise<EvalResult> {
  await ensureReady();
  const sideToMove = fen.split(/\s+/)[1] === "w" ? 1 : -1;
  return new Promise<EvalResult>((resolve) => {
    let lastCp = 0;
    let lastMate: number | null = null;
    const onLine = (line: string) => {
      if (line.startsWith("info")) {
        // Only trust lines that contain "depth" to avoid seldepth-only noise
        if (!line.includes(" depth ")) return;
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          lastMate = parseInt(mateMatch[1], 10);
        } else if (cpMatch) {
          lastCp = parseInt(cpMatch[1], 10);
          lastMate = null;
        }
      } else if (line.startsWith("bestmove")) {
        listeners.delete(onLine);
        const parts = line.split(/\s+/);
        const mv = parts[1];
        let cp: number;
        if (lastMate !== null) {
          // Encode mate as +/-(100000 - |dist|) from White's perspective
          cp = (100000 - Math.abs(lastMate)) * Math.sign(lastMate) * sideToMove;
        } else {
          // Stockfish reports score from side-to-move's POV; convert to White's POV
          cp = lastCp * sideToMove;
        }
        resolve({ bestMove: mv && mv !== "(none)" ? mv : null, cp });
      }
    };
    listeners.add(onLine);
    // Only flush the hash table when starting a brand-new game/review session.
    // Skipping ucinewgame between positions lets Stockfish reuse transpositions
    // from earlier in the game, producing faster and more accurate evaluations.
    if (opts.freshGame) send("ucinewgame");
    send(`position fen ${fen}`);
    if (opts.movetime) send(`go movetime ${opts.movetime}`);
    else send(`go depth ${opts.depth ?? 16}`);
  });
}

// Public evaluate — serialised through evalQueue so calls never overlap.
// Pass freshGame:true only for the first position of a new review/game session.
export async function evaluate(
  fen: string,
  opts: { depth?: number; movetime?: number; freshGame?: boolean } = {},
): Promise<EvalResult> {
  const result = (evalQueue = evalQueue
    .catch(() => {})
    .then(() => _evaluate(fen, opts)));
  return result as Promise<EvalResult>;
}

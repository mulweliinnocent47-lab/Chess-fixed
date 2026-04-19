// Puzzle library — Lichess format (/public/puzzles.json, ~5000 puzzles).
//
// Lichess puzzle move format:
//   moves[0]   = opponent's "setup" move (played automatically before player takes over)
//   moves[1]   = player's first move  (solution step 0)
//   moves[2]   = opponent's first reply
//   moves[3]   = player's second move (solution step 1)
//   moves[4]   = opponent's second reply
//   … and so on (alternating opponent reply / player move after the setup)
//
// Deduplication:
//   Practice mode: seen puzzle IDs are stored in localStorage so the player
//   never sees the same puzzle twice across sessions. Resets automatically
//   when all puzzles in the pool have been shown.
//
//   Puzzle Rush: the caller owns an in-memory Set<string> that it passes to
//   getUnseenPuzzle(). It resets the set at the start of each new run.

export type Puzzle = {
  id: string;
  fen: string;
  /** All UCI moves in the line; moves[0] is the opponent's setup move. */
  moves: string[];
  /**
   * Player's solution moves in UCI: moves[1], moves[3], moves[5] …
   * i.e. every move at an odd index.
   */
  solution: string[];
  theme: string;
  rating: number;
};

type Compact = { i: string; f: string; m: string; r: number; t: string };

// ── Data loading ──────────────────────────────────────────────────────────────

let CACHE: Compact[] | null = null;
let LOADING: Promise<Compact[]> | null = null;

// Stream-parse the JSON in one fetch but yield to the main thread after
// parsing so the UI doesn't freeze on low-end phones.
// We also keep only a compact index in memory and expand puzzles on demand.
async function loadAll(): Promise<Compact[]> {
  if (CACHE) return CACHE;
  if (LOADING) return LOADING;
  LOADING = fetch("/puzzles.json")
    .then((r) => {
      if (!r.ok) throw new Error("puzzles.json failed");
      return r.json() as Promise<Compact[]>;
    })
    .then((data) => {
      // Yield to main thread once after parsing so we don't block first render
      return new Promise<Compact[]>((resolve) => {
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(() => { CACHE = data; LOADING = null; resolve(data); });
        } else {
          setTimeout(() => { CACHE = data; LOADING = null; resolve(data); }, 0);
        }
      });
    })
    .catch((e) => {
      LOADING = null;
      throw e;
    });
  return LOADING;
}

function expand(c: Compact): Puzzle {
  const moves = c.m.split(" ");
  // Player moves are at odd indices: 1, 3, 5 …
  const solution: string[] = [];
  for (let i = 1; i < moves.length; i += 2) solution.push(moves[i]);
  return { id: c.i, fen: c.f, moves, solution, theme: c.t, rating: c.r };
}

function filterByRating(pool: Compact[], opts?: { minRating?: number; maxRating?: number }): Compact[] {
  if (!opts) return pool;
  return pool.filter(
    (p) =>
      (opts.minRating == null || p.r >= opts.minRating) &&
      (opts.maxRating == null || p.r <= opts.maxRating),
  );
}

// ── Seen-puzzle tracking ──────────────────────────────────────────────────────

const PRACTICE_SEEN_KEY = "chess-puzzle-seen-v1";

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function loadSeenSet(key: string): Set<string> {
  const raw = lsGet(key);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}

function saveSeenSet(key: string, seen: Set<string>) {
  lsSet(key, JSON.stringify([...seen]));
}

/**
 * Pick a random puzzle that hasn't been shown in practice mode.
 * Seen IDs are persisted in localStorage.
 * When every puzzle in the filtered pool has been seen, the seen list resets
 * automatically so the player can cycle through again.
 */
export async function getNextPracticePuzzle(opts?: {
  minRating?: number;
  maxRating?: number;
}): Promise<Puzzle> {
  const all = await loadAll();
  const pool = filterByRating(all, opts);
  const src = pool.length ? pool : all;

  const seen = loadSeenSet(PRACTICE_SEEN_KEY);
  let unseen = src.filter((p) => !seen.has(p.i));

  // Exhausted the pool — reset and start fresh.
  if (!unseen.length) {
    seen.clear();
    saveSeenSet(PRACTICE_SEEN_KEY, seen);
    unseen = src;
  }

  const chosen = unseen[Math.floor(Math.random() * unseen.length)];
  seen.add(chosen.i);
  saveSeenSet(PRACTICE_SEEN_KEY, seen);
  return expand(chosen);
}

/**
 * Pick a random unseen puzzle given a caller-owned seen Set (for Puzzle Rush).
 * The caller controls when the set is cleared (e.g. at the start of each run).
 * When the in-memory set has covered the whole pool, the set is cleared
 * automatically so the run can continue.
 */
export async function getUnseenPuzzle(
  seenIds: Set<string>,
  opts?: { minRating?: number; maxRating?: number },
): Promise<Puzzle> {
  const all = await loadAll();
  const pool = filterByRating(all, opts);
  const src = pool.length ? pool : all;

  let unseen = src.filter((p) => !seenIds.has(p.i));

  // Exhausted the in-memory pool — reset for this run.
  if (!unseen.length) {
    seenIds.clear();
    unseen = src;
  }

  const chosen = unseen[Math.floor(Math.random() * unseen.length)];
  seenIds.add(chosen.i);
  return expand(chosen);
}

// ── Daily puzzle ──────────────────────────────────────────────────────────────

const DAILY_KEY = "chess-puzzle-daily-v2";

export type DailyState = {
  dateKey: string;
  puzzleId: string;
  solved: boolean;
  attempts: number;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function getDailyPuzzle(): Promise<{ puzzle: Puzzle; state: DailyState }> {
  const all = await loadAll();
  const dateKey = todayKey();

  let state: DailyState | null = null;
  const raw = lsGet(DAILY_KEY);
  if (raw) {
    try { state = JSON.parse(raw); } catch { /* ignore */ }
  }

  let chosen: Compact;
  if (state && state.dateKey === dateKey) {
    chosen = all.find((p) => p.i === state!.puzzleId) ?? all[hashStr(dateKey) % all.length];
  } else {
    chosen = all[hashStr(dateKey) % all.length];
    state = { dateKey, puzzleId: chosen.i, solved: false, attempts: 0 };
    lsSet(DAILY_KEY, JSON.stringify(state));
  }
  return { puzzle: expand(chosen), state };
}

export function saveDailyState(state: DailyState) {
  lsSet(DAILY_KEY, JSON.stringify(state));
}

// ── Legacy helpers (kept for any callers that still use them) ─────────────────

/** @deprecated Use getNextPracticePuzzle() instead — it deduplicates. */
export async function getRandomPuzzle(opts?: { minRating?: number; maxRating?: number }): Promise<Puzzle> {
  return getNextPracticePuzzle(opts);
}

// Move classification using win-percentage loss — the same approach used by
// Lichess and Chess.com. Raw centipawn loss is a poor proxy near equal
// positions (small cp differences matter a lot) and in won positions
// (large cp losses barely change the win probability). Win% loss is a much
// more faithful representation of how much a move hurt you.

export type Classification =
  | "brilliant"
  | "best"
  | "excellent"
  | "great"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

// ── Lichess / Chess.com thresholds (win-percentage loss in pp) ──────────────
//   Brilliant  : played == engine best + sacrifice + hard position
//   Best       : played == engine best (or ≤ 0.5 pp loss, covers rounding)
//   Excellent  : 0–2 pp loss
//   Great      : 2–5 pp loss
//   Good       : 5–10 pp loss
//   Inaccuracy : 10–20 pp loss
//   Mistake    : 20–35 pp loss
//   Blunder    : > 35 pp loss
export function classifyMoveByWpLoss(wpLoss: number): Classification {
  if (wpLoss <= 0.5) return "best";
  if (wpLoss <= 2) return "excellent";
  if (wpLoss <= 5) return "great";
  if (wpLoss <= 10) return "good";
  if (wpLoss <= 20) return "inaccuracy";
  if (wpLoss <= 35) return "mistake";
  return "blunder";
}

// Legacy raw-CP helper kept in case any callers still use it.
export function classifyMove(bestEval: number, playedEval: number): Classification {
  const loss = Math.max(0, bestEval - playedEval);
  if (loss <= 10) return "best";
  if (loss <= 30) return "excellent";
  if (loss <= 60) return "great";
  if (loss <= 120) return "good";
  if (loss <= 220) return "inaccuracy";
  if (loss <= 400) return "mistake";
  return "blunder";
}

export function isBrilliantMove(args: {
  bestEval: number;       // mover's best possible eval (in their POV, cp)
  playedEval: number;     // eval of played move (mover's POV, cp)
  wpLoss: number;         // win-% loss (pp) — must be near 0 for brilliant
  materialBefore: number; // mover's material before the move
  materialAfter: number;  // mover's material after the move
  goodMovesCount: number; // rough number of moves within 5% of best
}): boolean {
  const { bestEval, playedEval, wpLoss, materialBefore, materialAfter, goodMovesCount } = args;
  const loss = Math.abs(bestEval - playedEval);
  const isTopMove = wpLoss < 1 && loss < 20;           // essentially the best move
  const isSacrifice = materialAfter < materialBefore - 0.5; // gave up material
  const notDominating = Math.abs(bestEval) < 350;       // position not already decided
  const isHardToFind = goodMovesCount <= 2;              // few good alternatives exist
  return isTopMove && isSacrifice && notDominating && isHardToFind;
}

// Count piece material for a given side (in pawns).
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function sideMaterial(fen: string, side: "w" | "b"): number {
  const board = fen.split(" ")[0];
  let total = 0;
  for (const ch of board) {
    if (ch === "/" || /\d/.test(ch)) continue;
    const isWhite = ch === ch.toUpperCase();
    const p = ch.toLowerCase();
    if ((side === "w") === isWhite) {
      total += PIECE_VALUE[p] ?? 0;
    }
  }
  return total;
}

export const CLASS_COLORS: Record<Classification, string> = {
  brilliant: "oklch(0.7 0.22 310)",
  best:      "oklch(0.72 0.18 150)",
  excellent: "oklch(0.78 0.15 170)",
  great:     "oklch(0.75 0.12 200)",
  good:      "oklch(0.7 0.1 230)",
  inaccuracy:"oklch(0.78 0.15 90)",
  mistake:   "oklch(0.7 0.18 50)",
  blunder:   "oklch(0.62 0.23 25)",
};

export const CLASS_LABEL: Record<Classification, string> = {
  brilliant: "Brilliant",
  best:      "Best",
  excellent: "Excellent",
  great:     "Great",
  good:      "Good",
  inaccuracy:"Inaccuracy",
  mistake:   "Mistake",
  blunder:   "Blunder",
};

// Short glyph for overlay on board
export const CLASS_GLYPH: Record<Classification, string> = {
  brilliant: "!!",
  best:      "★",
  excellent: "!",
  great:     "✓",
  good:      "✓",
  inaccuracy:"?!",
  mistake:   "?",
  blunder:   "??",
};

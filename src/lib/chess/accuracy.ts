// ── Accuracy helpers (Lichess-compatible formulas) ──────────────────────────

// Convert a centipawn evaluation (from White POV) into a winning percentage for White.
// Sigmoid used by Lichess: 50 + 50 * tanh(0.00368208 * cp)
export function winPctFromCp(cp: number): number {
  const wp = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  return Math.max(0, Math.min(100, wp));
}

// Accuracy of a single move given the win-percentage the mover lost.
// This is the Lichess per-move accuracy formula:
//   acc = 103.1668 * exp(-0.04354 * wpLoss) - 3.1669
// wpLoss is expressed in percentage points (0–100 scale).
// Returns a value in [0, 100].
export function moveAccuracyFromWpLoss(wpLoss: number): number {
  if (!isFinite(wpLoss) || wpLoss <= 0) return 100;
  const a = 103.1668 * Math.exp(-0.04354 * wpLoss) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

// Overall game accuracy from an array of per-move win-percentage losses.
// Each loss is in percentage points (0–100).  Returns 0–100 rounded to 1 dp.
export function gameAccuracyFromWpLosses(wpLosses: number[]): number {
  if (!wpLosses.length) return 0;
  const avg =
    wpLosses.map(moveAccuracyFromWpLoss).reduce((a, b) => a + b, 0) /
    wpLosses.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

// Legacy helper kept for any callers that pass avgCpl directly.
// Lichess formula: 103.1668 * exp(-0.04354 * avgCpl) - 3.1669
export function accuracyFromCpl(avgCpl: number): number {
  if (!isFinite(avgCpl) || avgCpl < 0) return 100;
  const a = 103.1668 * Math.exp(-0.04354 * avgCpl) - 3.1669;
  return Math.max(0, Math.min(100, Math.round(a)));
}

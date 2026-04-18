// Vertical evaluation bar (shown beside the board).
// Uses a sigmoid win-% mapping — the same formula Lichess and Chess.com use —
// so the bar reflects *probability of winning*, not a linear centipawn scale.
// This makes the bar feel accurate: +1 pawn ≈ 60 %, +3 pawns ≈ 80 %, etc.

type Props = {
  // Centipawn score from White's perspective. Mate encoded as ±(100000 − dist).
  cp: number | null;
  orientation: "white" | "black";
  loading?: boolean;
};

function formatCp(cp: number): string {
  if (Math.abs(cp) >= 90000) {
    const dist = 100000 - Math.abs(cp);
    return `M${dist}`;
  }
  const v = cp / 100;
  if (Math.abs(v) < 0.05) return "0.0";
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

// Sigmoid mapping cp → white win% (0–100).
// Identical to Lichess / HorizontalEvalBar — no more linear ±10-pawn clamping.
function whiteShareFromCp(cp: number): number {
  if (Math.abs(cp) >= 90000) return cp > 0 ? 100 : 0;
  // 50 + 50 * tanh(0.00368208 * cp)
  const wp = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  // Clamp to [2, 98] so a small sliver of the opposing colour is always visible.
  return Math.max(2, Math.min(98, wp));
}

export function EvalBar({ cp, orientation, loading }: Props) {
  const score = cp ?? 0;
  const whiteShare = whiteShareFromCp(score);

  // bottomShare = the percentage of bar height filled by the *bottom* colour.
  // When orientation=white, white is at the bottom → bottomShare = whiteShare.
  // When orientation=black, black is at the bottom → bottomShare = 100 - whiteShare.
  const bottomShare = orientation === "white" ? whiteShare : 100 - whiteShare;
  const topShare = 100 - bottomShare;

  const label = cp == null ? "" : formatCp(cp);
  // Label sits on the winning side.  White winning → label on white's half.
  // "white winning" means cp > 0.  If orientation=white the white half is at
  // the bottom, so label goes bottom; if orientation=black it goes top.
  const labelOnTop = cp != null && (orientation === "white" ? cp < 0 : cp > 0);

  return (
    <div
      className="relative w-4 md:w-5 h-full rounded-md overflow-hidden border border-border bg-[oklch(0.18_0.02_250)]"
      style={{ boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.04)" }}
      aria-label="Evaluation bar"
    >
      {/* Top half — the side at the top of the board */}
      <div
        className="absolute inset-x-0 top-0 transition-[height] duration-300 ease-out"
        style={{
          height: `${topShare}%`,
          background:
            orientation === "white"
              ? "oklch(0.22 0.02 250)" // black's colour at top when white is at bottom
              : "oklch(0.96 0.005 240)", // white's colour at top when black is at bottom
        }}
      />
      {/* Bottom half */}
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-300 ease-out"
        style={{
          height: `${bottomShare}%`,
          background:
            orientation === "white"
              ? "oklch(0.96 0.005 240)" // white at bottom
              : "oklch(0.22 0.02 250)", // black at bottom
        }}
      />
      {/* Midline */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-primary/40" />
      {/* Score label */}
      {label && (
        <div
          className={
            "absolute inset-x-0 text-[9px] md:text-[10px] font-bold text-center tabular-nums " +
            (labelOnTop ? "top-0.5" : "bottom-0.5")
          }
          style={{
            color: labelOnTop
              ? orientation === "white"
                ? "oklch(0.95 0 0)"
                : "oklch(0.2 0 0)"
              : orientation === "white"
                ? "oklch(0.2 0 0)"
                : "oklch(0.95 0 0)",
          }}
        >
          {label}
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

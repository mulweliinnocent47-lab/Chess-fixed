type Props = {
  // Centipawn from White POV. Mate encoded as ±(100000 - dist).
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

// Convert a centipawn score into a 0..100 white percentage using the
// same sigmoid used for accuracy (Lichess-style). Smoother than linear clamp.
function whiteShareFromCp(cp: number): number {
  if (Math.abs(cp) >= 90000) return cp > 0 ? 100 : 0;
  const wp = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  return Math.max(2, Math.min(98, wp));
}

export function HorizontalEvalBar({ cp, orientation, loading }: Props) {
  const score = cp ?? 0;
  const whiteShare = whiteShareFromCp(score);
  // From player's perspective: their side is on the "left/bottom".
  // For a horizontal bar above the board: left represents the side at the
  // top of the board (opponent). Right represents the side at the bottom (player).
  const leftShare = orientation === "white" ? 100 - whiteShare : whiteShare;
  const rightShare = 100 - leftShare;

  const label = cp == null ? "0.0" : formatCp(cp);
  // Put the label on the side that is currently winning so it's always visible
  const labelOnRight = cp != null && rightShare > leftShare;

  return (
    <div
      className="relative w-full h-3 rounded-full overflow-hidden border border-border bg-[oklch(0.18_0.02_250)]"
      aria-label="Evaluation bar"
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
        style={{
          width: `${leftShare}%`,
          background:
            orientation === "white"
              ? "oklch(0.22 0.02 250)"
              : "oklch(0.96 0.005 240)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 transition-[width] duration-300 ease-out"
        style={{
          width: `${rightShare}%`,
          background:
            orientation === "white"
              ? "oklch(0.96 0.005 240)"
              : "oklch(0.22 0.02 250)",
        }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-primary/50" />
      <div
        className={`absolute top-1/2 -translate-y-1/2 text-[9px] font-bold tabular-nums px-1.5 ${
          labelOnRight ? "right-1" : "left-1"
        }`}
        style={{
          color: labelOnRight
            ? orientation === "white"
              ? "oklch(0.2 0 0)"
              : "oklch(0.95 0 0)"
            : orientation === "white"
              ? "oklch(0.95 0 0)"
              : "oklch(0.2 0 0)",
        }}
      >
        {label}
      </div>
      {loading && (
        <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

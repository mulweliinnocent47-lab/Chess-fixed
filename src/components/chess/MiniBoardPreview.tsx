import { Chess } from "chess.js";
import { useMemo } from "react";

const PIECE_GLYPH: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

type Props = {
  fen?: string;
  /** show only last N ranks (from white perspective) for a tight crop */
  cropRanks?: number;
  className?: string;
};

/**
 * Small static board preview used on Home cards. Renders only the visible
 * ranks for a clean cropped look like in the mockup.
 */
export function MiniBoardPreview({ fen, cropRanks = 5, className }: Props) {
  const board = useMemo(() => {
    try {
      const c = new Chess(fen);
      return c.board(); // 8 rows from rank 8 -> rank 1
    } catch {
      return new Chess().board();
    }
  }, [fen]);

  // Take the top `cropRanks` rows so the kings/action area shows.
  const rows = board.slice(0, cropRanks);

  return (
    <div
      className={`relative rounded-lg overflow-hidden ${className ?? ""}`}
      style={{
        boxShadow: "0 4px 18px -6px oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.05)",
      }}
    >
      <div className="grid grid-cols-8" style={{ aspectRatio: `8 / ${cropRanks}` }}>
        {rows.map((row, ri) =>
          row.map((sq, fi) => {
            const isLight = (ri + fi) % 2 === 0;
            const glyph = sq ? PIECE_GLYPH[sq.color === "w" ? sq.type.toUpperCase() : sq.type] : "";
            const isWhite = sq?.color === "w";
            return (
              <div
                key={`${ri}-${fi}`}
                className="flex items-center justify-center"
                style={{
                  background: isLight
                    ? "oklch(0.78 0.04 230 / 0.85)"
                    : "oklch(0.45 0.07 240 / 0.9)",
                  fontSize: "min(2.4vw, 14px)",
                  lineHeight: 1,
                  color: isWhite ? "oklch(0.98 0 0)" : "oklch(0.12 0.02 260)",
                  textShadow: isWhite
                    ? "0 1px 1px oklch(0 0 0 / 0.5)"
                    : "0 1px 0 oklch(1 0 0 / 0.15)",
                }}
              >
                {glyph}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

import type { Chess } from "chess.js";
import { memo,
 useMemo } from "react";

type Props = {
  chess: Chess;
  // Whose captures to show (the pieces THIS side has taken from the opponent)
  side: "white" | "black";
  size?: "sm" | "md";
};

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER = ["q", "r", "b", "n", "p"];
const START: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

export const CapturedPieces = memo(function CapturedPieces({ chess, side, size = "sm" }: Props) {
  const { captured, diff } = useMemo(() => {
    const board = chess.board();
    const counts: Record<"w" | "b", Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };
    board.forEach((row) =>
      row.forEach((sq) => {
        if (sq) counts[sq.color][sq.type]++;
      }),
    );
    // Pieces this side captured = missing from opponent's color
    const oppColor: "w" | "b" = side === "white" ? "b" : "w";
    const captured: { type: string; count: number }[] = [];
    let myMaterial = 0;
    let oppMaterial = 0;
    ORDER.forEach((t) => {
      const missing = START[t] - counts[oppColor][t];
      if (missing > 0) captured.push({ type: t, count: missing });
    });
    // Material score from this side's perspective
    Object.keys(VALUE).forEach((t) => {
      const myColor: "w" | "b" = side === "white" ? "w" : "b";
      myMaterial += counts[myColor][t] * VALUE[t];
      oppMaterial += counts[oppColor][t] * VALUE[t];
    });
    return { captured, diff: myMaterial - oppMaterial };
  }, [chess, side]);

  const px = size === "md" ? 22 : 18;
  const oppColor: "w" | "b" = side === "white" ? "b" : "w";

  return (
    <div className="flex items-center gap-1 flex-wrap min-h-[22px]">
      {captured.map(({ type, count }) => (
        <div key={type} className="flex items-center -space-x-2">
          {Array.from({ length: count }).map((_, i) => (
            <img
              key={i}
              src={`/pieces/${oppColor}${type}.svg`}
              alt={type}
              width={px}
              height={px}
              style={{ width: px, height: px }}
              className="drop-shadow-sm"
            />
          ))}
        </div>
      ))}
      {diff > 0 && (
        <span className="ml-1 text-xs font-semibold text-foreground/80 tabular-nums">
          +{diff}
        </span>
      )}
    </div>
  );
}
);

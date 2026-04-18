import { useEffect, useMemo, useRef, useState } from "react";
import type { Chess, Square } from "chess.js";

type MoveGlyph = {
  square: Square;
  glyph: string;
  color: string;
};

type Props = {
  chess: Chess;
  orientation: "white" | "black";
  selected: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  hint: { from: Square; to: Square } | null;
  bestMoveHint?: { from: Square; to: Square } | null;
  premove?: { from: Square; to: Square } | null;
  moveGlyph?: MoveGlyph | null;
  interactive: boolean;
  thinking?: boolean;
  onSquareClick: (sq: Square) => void;
  onDragMove: (from: Square, to: Square) => void;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

function pieceUrl(color: "w" | "b", type: string) {
  return `/pieces/${color}${type}.svg`;
}

export function Board({
  chess,
  orientation,
  selected,
  legalTargets,
  lastMove,
  hint,
  bestMoveHint,
  premove,
  moveGlyph,
  interactive,
  thinking,
  onSquareClick,
  onDragMove,
}: Props) {
  const board = chess.board();
  const inCheckColor = chess.inCheck() ? chess.turn() : null;
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);

  // Animate the moving piece by translating from `from` -> `to`
  const [animFrom, setAnimFrom] = useState<Square | null>(null);
  const lastMoveRef = useRef<{ from: Square; to: Square } | null>(null);
  useEffect(() => {
    if (!lastMove) {
      lastMoveRef.current = null;
      return;
    }
    const prev = lastMoveRef.current;
    if (!prev || prev.from !== lastMove.from || prev.to !== lastMove.to) {
      lastMoveRef.current = lastMove;
      setAnimFrom(lastMove.from);
      const t = setTimeout(() => setAnimFrom(null), 230);
      return () => clearTimeout(t);
    }
  }, [lastMove]);

  const squares = useMemo(() => {
    const files = orientation === "white" ? FILES : [...FILES].reverse();
    const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();
    const out: { sq: Square; rIdx: number; fIdx: number; file: string; rank: string }[] = [];
    ranks.forEach((rank, rIdx) => {
      files.forEach((file, fIdx) => {
        out.push({ sq: `${file}${rank}` as Square, rIdx, fIdx, file, rank });
      });
    });
    return out;
  }, [orientation]);

  // Compute pixel offset (in % of one square = 12.5% of board) for slide animation
  const getSlideTransform = (sq: Square): string | undefined => {
    if (animFrom !== sq || !lastMove) return undefined;
    const fromFile = FILES.indexOf(lastMove.from[0] as (typeof FILES)[number]);
    const toFile = FILES.indexOf(lastMove.to[0] as (typeof FILES)[number]);
    const fromRank = 8 - parseInt(lastMove.from[1], 10);
    const toRank = 8 - parseInt(lastMove.to[1], 10);
    let dx = toFile - fromFile;
    let dy = toRank - fromRank;
    if (orientation === "black") {
      dx = -dx;
      dy = -dy;
    }
    // Start offset (we'll then transition to translate(0,0))
    return `translate(${-dx * 100}%, ${-dy * 100}%)`;
  };

  return (
    <div
      className="relative w-full aspect-square rounded-xl overflow-hidden select-none"
      style={{ boxShadow: "var(--shadow-board)" }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {squares.map(({ sq, rIdx, fIdx, file, rank }) => {
          const isLight = (rIdx + fIdx) % 2 === 0;
          const fileIdx = FILES.indexOf(file as (typeof FILES)[number]);
          const rankIdx = 8 - parseInt(rank, 10);
          const piece = board[rankIdx][fileIdx];
          const isSelected = selected === sq;
          const isTarget = legalTargets.includes(sq);
          const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
          const isHintSq = hint && (hint.from === sq || hint.to === sq);
          const isBestSq = bestMoveHint && (bestMoveHint.from === sq || bestMoveHint.to === sq);
          const isPremoveSq = premove && (premove.from === sq || premove.to === sq);
          const isCheck = piece && piece.type === "k" && piece.color === inCheckColor;
          const isDragOver = dragOver === sq;

          const slideTransform = piece && animFrom === sq ? getSlideTransform(sq) : undefined;

          return (
            <div
              key={sq}
              onClick={() => onSquareClick(sq)}
              onDragOver={(e) => {
                if (!interactive) return;
                e.preventDefault();
                if (dragOver !== sq) setDragOver(sq);
              }}
              onDragLeave={() => {
                if (dragOver === sq) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const from = e.dataTransfer.getData("text/plain") as Square;
                if (from && from !== sq) onDragMove(from, sq);
                setDragFrom(null);
              }}
              className="relative flex items-center justify-center cursor-pointer"
              style={{
                backgroundColor: isLight
                  ? "var(--board-light)"
                  : "var(--board-dark)",
              }}
            >
              {isLast && (
                <div className="absolute inset-0" style={{ backgroundColor: "var(--board-last)" }} />
              )}
              {isSelected && (
                <div className="absolute inset-0" style={{ backgroundColor: "var(--board-highlight)" }} />
              )}
              {isHintSq && (
                <div
                  className="absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 4px var(--board-hint)" }}
                />
              )}
              {isBestSq && (
                <div
                  className="absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 4px var(--board-best)" }}
                />
              )}
              {isPremoveSq && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: "var(--board-premove)" }}
                />
              )}
              {isDragOver && (
                <div
                  className="absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 3px var(--primary)" }}
                />
              )}
              {isCheck && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle, var(--board-check) 0%, transparent 70%)",
                  }}
                />
              )}
              {fIdx === 0 && (
                <span
                  className="absolute top-0.5 left-1 text-[9px] font-bold pointer-events-none"
                  style={{ color: isLight ? "var(--board-dark)" : "var(--board-light)", opacity: 0.7 }}
                >
                  {rank}
                </span>
              )}
              {rIdx === 7 && (
                <span
                  className="absolute bottom-0.5 right-1 text-[9px] font-bold pointer-events-none"
                  style={{ color: isLight ? "var(--board-dark)" : "var(--board-light)", opacity: 0.7 }}
                >
                  {file}
                </span>
              )}
              {piece && (
                <img
                  src={pieceUrl(piece.color, piece.type)}
                  alt={`${piece.color}${piece.type}`}
                  draggable={interactive}
                  onDragStart={(e) => {
                    if (!interactive) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData("text/plain", sq);
                    e.dataTransfer.effectAllowed = "move";
                    setDragFrom(sq);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  className="relative w-[88%] h-[88%] drop-shadow-md piece-slide z-10"
                  style={{
                    opacity: dragFrom === sq ? 0.4 : 1,
                    cursor: interactive ? "grab" : "default",
                    transform: slideTransform ?? "translate(0,0)",
                    transition: slideTransform ? "none" : "transform 220ms cubic-bezier(0.22,0.61,0.36,1)",
                  }}
                  ref={(el) => {
                    // Force reflow then clear transform to animate to (0,0)
                    if (el && slideTransform) {
                      requestAnimationFrame(() => {
                        el.style.transition = "transform 220ms cubic-bezier(0.22,0.61,0.36,1)";
                        el.style.transform = "translate(0,0)";
                      });
                    }
                  }}
                />
              )}
              {isTarget && !piece && (
                <div className="absolute w-[28%] h-[28%] rounded-full bg-black/30 pointer-events-none" />
              )}
              {isTarget && piece && (
                <div className="absolute inset-1 rounded-full ring-4 ring-black/30 pointer-events-none" />
              )}
              {moveGlyph && moveGlyph.square === sq && (
                <div
                  className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black text-white pointer-events-none z-20"
                  style={{
                    background: moveGlyph.color,
                    boxShadow: "0 2px 6px oklch(0 0 0 / 0.4), 0 0 0 2px oklch(0.16 0.02 250)",
                  }}
                >
                  {moveGlyph.glyph}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {thinking && (
        <div className="absolute inset-0 pointer-events-none flex items-start justify-center">
          <div className="mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary text-primary-foreground shadow-lg flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Thinking…
          </div>
        </div>
      )}
    </div>
  );
}

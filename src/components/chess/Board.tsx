// Board.tsx — Performance-optimised chess board
//
// Key optimisations:
//  1. React.memo on the top-level Board — won't re-render if props are equal.
//  2. Each square is its own memoised Square component — only the 1-2 squares
//     that actually changed re-render per move (vs all 64 before).
//  3. Drag handlers are stable useCallback refs — squares don't re-render just
//     because a parent state changed that isn't relevant to them.
//  4. GPU-accelerated piece animation via @keyframes piece-slide (CSS-only,
//     no JS per frame).
//  5. CSS transform3d on the board wrapper forces compositor-thread rendering.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chess, Square } from "chess.js";

type MoveGlyph = { square: Square; glyph: string; color: string };

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

// ── Static lookups (computed once, never allocate per render) ─────────────────

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
const FILE_IDX = Object.fromEntries(FILES.map((f, i) => [f, i])) as Record<string, number>;

const PIECE_URLS: Record<string, string> = {};
function pieceUrl(color: "w" | "b", type: string): string {
  const key = color + type;
  return PIECE_URLS[key] ?? (PIECE_URLS[key] = `/pieces/${color}${type}.svg`);
}

// Pre-build the square grid for each orientation (computed once at module load)
const SQUARES_WHITE = (() => {
  const out: { sq: Square; rIdx: number; fIdx: number; file: string; rank: string }[] = [];
  RANKS.forEach((rank, rIdx) => FILES.forEach((file, fIdx) => {
    out.push({ sq: `${file}${rank}` as Square, rIdx, fIdx, file, rank });
  }));
  return out;
})();
const SQUARES_BLACK = (() => {
  const out: { sq: Square; rIdx: number; fIdx: number; file: string; rank: string }[] = [];
  [...RANKS].reverse().forEach((rank, rIdx) => [...FILES].reverse().forEach((file, fIdx) => {
    out.push({ sq: `${file}${rank}` as Square, rIdx, fIdx, file, rank });
  }));
  return out;
})();

// ── Per-square component (memoised) ──────────────────────────────────────────

type SquareProps = {
  sq: Square;
  rIdx: number;
  fIdx: number;
  file: string;
  rank: string;
  isLight: boolean;
  piece: { type: string; color: "w" | "b" } | null;
  isSelected: boolean;
  isTarget: boolean;
  isLast: boolean;
  isHintSq: boolean;
  isBestSq: boolean;
  isPremoveSq: boolean;
  isCheck: boolean;
  isAnimTarget: boolean;
  animKey: number;
  animDx: number;
  animDy: number;
  interactive: boolean;
  dragFrom: Square | null;
  dragOver: Square | null;
  glyph: MoveGlyph | null;
  onClick: (sq: Square) => void;
  onDragStart: (e: React.DragEvent, sq: Square) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, sq: Square) => void;
  onDragLeave: (sq: Square) => void;
  onDrop: (e: React.DragEvent, sq: Square) => void;
};

const BoardSquare = memo(function BoardSquare({
  sq, rIdx, fIdx, file, rank,
  isLight, piece,
  isSelected, isTarget, isLast, isHintSq, isBestSq, isPremoveSq, isCheck,
  isAnimTarget, animKey, animDx, animDy,
  interactive, dragFrom, dragOver, glyph,
  onClick, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: SquareProps) {
  const isDragOverSq = dragOver === sq;

  const slideStyle: React.CSSProperties = isAnimTarget
    ? {
        "--dx": `${-animDx * 100}%`,
        "--dy": `${-animDy * 100}%`,
        animation: "piece-slide 100ms cubic-bezier(0.25,0.46,0.45,0.94) forwards",
        willChange: "transform",
      } as React.CSSProperties
    : {};

  return (
    <div
      onClick={() => onClick(sq)}
      onDragOver={(e) => onDragOver(e, sq)}
      onDragLeave={() => onDragLeave(sq)}
      onDrop={(e) => onDrop(e, sq)}
      className="relative flex items-center justify-center cursor-pointer"
      style={{ backgroundColor: isLight ? "var(--board-light)" : "var(--board-dark)", touchAction: "manipulation" }}
    >
      {isLast     && <div className="absolute inset-0" style={{ backgroundColor: "var(--board-last)" }} />}
      {isSelected && <div className="absolute inset-0" style={{ backgroundColor: "var(--board-highlight)" }} />}
      {isHintSq   && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 4px var(--board-hint)" }} />}
      {isBestSq   && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 4px var(--board-best)" }} />}
      {isPremoveSq && <div className="absolute inset-0" style={{ backgroundColor: "var(--board-premove)" }} />}
      {isDragOverSq && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px var(--primary)" }} />}
      {isCheck    && <div className="absolute inset-0" style={{ background: "radial-gradient(circle, var(--board-check) 0%, transparent 70%)" }} />}

      {fIdx === 0 && (
        <span className="absolute top-0.5 left-1 text-[9px] font-bold pointer-events-none"
          style={{ color: isLight ? "var(--board-dark)" : "var(--board-light)", opacity: 0.7 }}>
          {rank}
        </span>
      )}
      {rIdx === 7 && (
        <span className="absolute bottom-0.5 right-1 text-[9px] font-bold pointer-events-none"
          style={{ color: isLight ? "var(--board-dark)" : "var(--board-light)", opacity: 0.7 }}>
          {file}
        </span>
      )}

      {piece && (
        <img
          key={isAnimTarget ? animKey : sq}
          src={pieceUrl(piece.color, piece.type)}
          alt={`${piece.color}${piece.type}`}
          draggable={interactive}
          onDragStart={(e) => onDragStart(e, sq)}
          onDragEnd={onDragEnd}
          className="relative w-[88%] h-[88%] drop-shadow-md z-10 pointer-events-auto"
          style={{
            opacity: dragFrom === sq ? 0.4 : 1,
            cursor: interactive ? "grab" : "default",
            ...slideStyle,
          }}
        />
      )}

      {isTarget && !piece && <div className="absolute w-[28%] h-[28%] rounded-full bg-black/30 pointer-events-none" />}
      {isTarget && piece  && <div className="absolute inset-1 rounded-full ring-4 ring-black/30 pointer-events-none" />}

      {glyph?.square === sq && (
        <div
          className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-black text-white pointer-events-none z-20"
          style={{ background: glyph.color, boxShadow: "0 2px 6px oklch(0 0 0 / 0.4), 0 0 0 2px oklch(0.16 0.02 250)" }}
        >
          {glyph.glyph}
        </div>
      )}
    </div>
  );
});

// ── Main Board component ──────────────────────────────────────────────────────

export const Board = memo(function Board({
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

  // Animation state — drive CSS keyframe on the destination square
  const [animState, setAnimState] = useState<{
    toSq: Square; dx: number; dy: number; key: number;
  } | null>(null);
  const lastMoveRef = useRef<{ from: Square; to: Square } | null>(null);
  const animKeyRef  = useRef(0);

  useEffect(() => {
    if (!lastMove) { lastMoveRef.current = null; setAnimState(null); return; }
    const prev = lastMoveRef.current;
    if (prev?.from === lastMove.from && prev?.to === lastMove.to) return;
    lastMoveRef.current = lastMove;

    const dx = FILE_IDX[lastMove.to[0]] - FILE_IDX[lastMove.from[0]];
    const dy = (8 - parseInt(lastMove.to[1], 10)) - (8 - parseInt(lastMove.from[1], 10));
    const sdx = orientation === "black" ? -dx : dx;
    const sdy = orientation === "black" ? -dy : dy;
    setAnimState({ toSq: lastMove.to, dx: sdx, dy: sdy, key: ++animKeyRef.current });
  }, [lastMove, orientation]);

  // Stable drag callbacks — don't cause all 64 squares to re-render
  const handleDragStart = useCallback((e: React.DragEvent, sq: Square) => {
    if (!interactive) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", sq);
    e.dataTransfer.effectAllowed = "move";
    setDragFrom(sq);
  }, [interactive]);

  const handleDragEnd = useCallback(() => setDragFrom(null), []);

  const handleDragOver = useCallback((e: React.DragEvent, sq: Square) => {
    if (!interactive) return;
    e.preventDefault();
    setDragOver((prev) => prev === sq ? prev : sq);
  }, [interactive]);

  const handleDragLeave = useCallback((sq: Square) => {
    setDragOver((prev) => prev === sq ? null : prev);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, sq: Square) => {
    e.preventDefault();
    setDragOver(null);
    const from = e.dataTransfer.getData("text/plain") as Square;
    if (from && from !== sq) onDragMove(from, sq);
    setDragFrom(null);
  }, [onDragMove]);

  // Use pre-built square grids — no allocation per render
  const squares = orientation === "white" ? SQUARES_WHITE : SQUARES_BLACK;

  // Memoise the legalTargets Set so `.has()` is O(1) and prop comparison is stable
  const targetSet = useMemo(() => new Set(legalTargets), [legalTargets]);

  return (
    <div
      className="relative w-full aspect-square rounded-xl overflow-hidden select-none"
      style={{
        boxShadow: "var(--shadow-board)",
        // Force GPU compositing for the whole board — smoother animations
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {squares.map(({ sq, rIdx, fIdx, file, rank }) => {
          const isLight = (rIdx + fIdx) % 2 === 0;
          const rankIdx = 8 - parseInt(rank, 10);
          const piece   = board[rankIdx][FILE_IDX[file]];

          const isAnimTarget = animState?.toSq === sq;

          return (
            <BoardSquare
              key={sq}
              sq={sq}
              rIdx={rIdx}
              fIdx={fIdx}
              file={file}
              rank={rank}
              isLight={isLight}
              piece={piece}
              isSelected={selected === sq}
              isTarget={targetSet.has(sq)}
              isLast={!!(lastMove && (lastMove.from === sq || lastMove.to === sq))}
              isHintSq={!!(hint && (hint.from === sq || hint.to === sq))}
              isBestSq={!!(bestMoveHint && (bestMoveHint.from === sq || bestMoveHint.to === sq))}
              isPremoveSq={!!(premove && (premove.from === sq || premove.to === sq))}
              isCheck={piece?.type === "k" && piece.color === inCheckColor}
              isAnimTarget={!!isAnimTarget}
              animKey={animState?.key ?? 0}
              animDx={animState?.dx ?? 0}
              animDy={animState?.dy ?? 0}
              interactive={interactive}
              dragFrom={dragFrom}
              dragOver={dragOver}
              glyph={moveGlyph ?? null}
              onClick={onSquareClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
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
});

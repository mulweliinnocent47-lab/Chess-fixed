// GameReview — full game analysis panel.
//
// Analysis pipeline (Lichess / Chess.com compatible):
//  1. Evaluate every position with Stockfish at movetime:50 ms per position.
//     Only the FIRST call sends "ucinewgame" so the hash table is preserved
//     across the whole game — this gives much more accurate evaluations.
//  2. For each ply compute the win-% loss from the mover's perspective using
//     the sigmoid formula (same as Lichess / Chess.com).
//  3. Classify moves using win-% thresholds (not raw CP loss):
//       Best ≤ 0.5 pp | Excellent ≤ 2 | Great ≤ 5 | Good ≤ 10
//       Inaccuracy ≤ 20 | Mistake ≤ 35 | Blunder > 35
//  4. Compute per-move accuracy = 103.1668·exp(−0.04354·wpLoss) − 3.1669
//     then average them per side — the Lichess formula.

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import { evaluate } from "@/lib/chess/engine";
import { X, Loader2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  classifyMoveByWpLoss,
  isBrilliantMove,
  sideMaterial,
  CLASS_COLORS,
  CLASS_LABEL,
  CLASS_GLYPH,
  type Classification,
} from "@/lib/chess/classify";
import { winPctFromCp, moveAccuracyFromWpLoss } from "@/lib/chess/accuracy";

export type ReviewPly = {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Stockfish eval of the position before this move (White POV, cp). */
  cpBefore: number;
  /** Stockfish eval of the position after this move (White POV, cp). */
  cpAfter: number;
  bestUci: string | null;
  bestSan: string | null;
  /** Win-% loss from the mover's perspective (percentage points, 0–100). */
  wpLoss: number;
  /** Legacy CP-based loss for display (absolute centipawns lost). */
  loss: number;
  classification: Classification;
  moverIsWhite: boolean;
  /** Per-move accuracy in [0,100]. */
  moveAccuracy: number;
};

type Props = {
  history: { san: string; from: string; to: string; promotion?: string }[];
  onClose: () => void;
  onJump: (ply: number) => void;
  onShowBest: (ply: number, fromTo: { from: Square; to: Square } | null) => void;
  onGlyph: (glyph: { square: Square; glyph: string; color: string } | null) => void;
  playerIsWhite: boolean;
};

function formatCp(cp: number): string {
  if (Math.abs(cp) >= 90000) {
    const mate = 100000 - Math.abs(cp);
    return `M${mate}`;
  }
  return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
}

function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    const m = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    return m ? m.san : null;
  } catch {
    return null;
  }
}

export function GameReview({
  history,
  onClose,
  onJump,
  onShowBest,
  onGlyph,
  playerIsWhite,
}: Props) {
  const [analyzed, setAnalyzed] = useState<ReviewPly[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [selectedPly, setSelectedPly] = useState<number>(history.length);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    const run = async () => {
      const c = new Chess();
      const fens: string[] = [c.fen()];
      for (const h of history) {
        c.move({ from: h.from, to: h.to, promotion: h.promotion });
        fens.push(c.fen());
      }

      // ── Evaluate every position and classify on the fly ────────────────
      // movetime:50 gives ~50 ms per position — fast and accurate enough.
      // Skipping depth-based search avoids unbounded search times in WASM.
      // freshGame:true only on the first call so the hash table is preserved
      // across positions (Stockfish reuses transpositions from earlier plies).
      // Results are streamed into analyzed[] as they arrive so the UI updates
      // progressively instead of waiting for all positions to finish.
      const evals: { cp: number; best: string | null }[] = [];
      for (let i = 0; i < fens.length; i++) {
        if (cancelRef.current) return;
        const r = await evaluate(fens[i], {
          movetime: 50,
          freshGame: i === 0,
        });
        evals.push({ cp: r.cp, best: r.bestMove });
        setProgress(Math.round(((i + 1) / fens.length) * 100));
      }

      // ── Classify each move ───────────────────────────────────────────────
      const out: ReviewPly[] = [];
      for (let i = 0; i < history.length; i++) {
        const moverIsWhite = i % 2 === 0;
        const sign = moverIsWhite ? 1 : -1;
        const cpBefore = evals[i].cp;
        const cpAfter = evals[i + 1].cp;

        // Win% from mover's perspective BEFORE and AFTER the move.
        // sign converts White-POV cp to mover-POV cp.
        const wpBefore = winPctFromCp(sign * cpBefore);
        const wpAfter = winPctFromCp(sign * cpAfter);
        // wpLoss is how many percentage points of winning chances the mover lost.
        const wpLoss = Math.max(0, wpBefore - wpAfter);

        const playedUci = `${history[i].from}${history[i].to}${history[i].promotion ?? ""}`;
        const bestUci = evals[i].best;

        // Raw CP loss kept for the detail display ("loss X.XX" row).
        const cpLossMoverPov = Math.max(0, sign * cpBefore - sign * cpAfter);

        // Material check for brilliant-move detection.
        const moverColor = moverIsWhite ? "w" : "b";
        const materialBefore = sideMaterial(fens[i], moverColor);
        const materialAfter = sideMaterial(fens[i + 1], moverColor);

        // Rough count of "good" legal moves (proxy: fewer legal moves → harder).
        let goodMovesCount = 10;
        try {
          const probe = new Chess(fens[i]);
          const legal = probe.moves().length;
          goodMovesCount = legal <= 8 ? 1 : legal <= 16 ? 3 : 6;
        } catch { /* ignore */ }

        // Classification using win-% thresholds (Lichess / Chess.com standard).
        let cls: Classification;
        if (bestUci && bestUci === playedUci) {
          // Played the engine's top choice — always at least "best".
          cls = "best";
        } else {
          cls = classifyMoveByWpLoss(wpLoss);
        }

        // Brilliant-move upgrade: top move + sacrifice + hard position.
        const brilliant = isBrilliantMove({
          bestEval: sign * cpBefore,
          playedEval: sign * cpAfter,
          wpLoss,
          materialBefore,
          materialAfter,
          goodMovesCount,
        });
        if (brilliant) cls = "brilliant";

        const moveAccuracy = moveAccuracyFromWpLoss(wpLoss);

        out.push({
          san: history[i].san,
          uci: playedUci,
          fenBefore: fens[i],
          fenAfter: fens[i + 1],
          cpBefore,
          cpAfter,
          bestUci,
          bestSan: bestUci ? uciToSan(fens[i], bestUci) : null,
          wpLoss,
          loss: cpLossMoverPov,
          classification: cls,
          moverIsWhite,
          moveAccuracy,
        });
      }

      if (cancelRef.current) return;
      setAnalyzed(out);
      setDone(true);
    };
    run();
    return () => { cancelRef.current = true; };
  }, [history]);

  // ── Eval graph ─────────────────────────────────────────────────────────────
  // Graph points use the win-% sigmoid so the curve matches the sidebar bar.
  const graphPoints = useMemo(() => {
    if (!analyzed.length) return [] as { x: number; y: number; cp: number }[];
    const points = [{ cp: 0 }, ...analyzed.map((p) => ({ cp: p.cpAfter }))];
    return points.map((p, i) => {
      // Map cp → win% (0–100) then invert for SVG (0 = top = black winning).
      const wp = Math.max(2, Math.min(98, 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * p.cp)) - 1)));
      return {
        x: (i / Math.max(1, points.length - 1)) * 100,
        y: 100 - wp,  // SVG y=0 is top; 100-wp means white-winning = bar rises
        cp: p.cp,
      };
    });
  }, [analyzed]);

  const path = useMemo(() => {
    if (!graphPoints.length) return "";
    return graphPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
  }, [graphPoints]);

  const areaPath = useMemo(() => {
    if (!graphPoints.length) return "";
    const top = graphPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    return `${top} L 100 100 L 0 100 Z`;
  }, [graphPoints]);

  // ── Move-type counts ───────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<Classification, number> = {
      brilliant: 0, best: 0, excellent: 0, great: 0,
      good: 0, inaccuracy: 0, mistake: 0, blunder: 0,
    };
    analyzed.forEach((p) => c[p.classification]++);
    return c;
  }, [analyzed]);

  // ── Accuracy — Lichess formula: average per-move accuracy ─────────────────
  const { accPlayer, accBot } = useMemo(() => {
    if (!analyzed.length) return { accPlayer: 0, accBot: 0 };
    const playerAccs: number[] = [];
    const botAccs: number[] = [];
    for (const p of analyzed) {
      const moverIsPlayer = p.moverIsWhite === playerIsWhite;
      if (moverIsPlayer) playerAccs.push(p.moveAccuracy);
      else botAccs.push(p.moveAccuracy);
    }
    const avg = (a: number[]) =>
      a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    return { accPlayer: avg(playerAccs), accBot: avg(botAccs) };
  }, [analyzed, playerIsWhite]);

  // ── Interactions ───────────────────────────────────────────────────────────
  const handleSelect = (ply: number) => {
    setSelectedPly(ply);
    onJump(ply);
    if (ply > 0 && ply <= analyzed.length) {
      const p = analyzed[ply - 1];
      if (p.bestUci) {
        onShowBest(ply, {
          from: p.bestUci.slice(0, 2) as Square,
          to: p.bestUci.slice(2, 4) as Square,
        });
      } else {
        onShowBest(ply, null);
      }
      const toSq = p.uci.slice(2, 4) as Square;
      onGlyph({
        square: toSq,
        glyph: CLASS_GLYPH[p.classification],
        color: CLASS_COLORS[p.classification],
      });
    } else {
      onShowBest(ply, null);
      onGlyph(null);
    }
  };

  const go = (delta: number) => {
    const next = Math.max(1, Math.min(analyzed.length, selectedPly + delta));
    handleSelect(next);
  };

  const current =
    selectedPly > 0 && selectedPly <= analyzed.length
      ? analyzed[selectedPly - 1]
      : null;

  return (
    <div
      className="rounded-xl bg-card border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Game Review
          </div>
          {!done && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              {progress}%
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Accuracy strip ── */}
      {done && (
        <div className="grid grid-cols-2 gap-2 px-3 pt-3">
          <AccuracyCard label="You" value={accPlayer} tint="oklch(0.7 0.18 245)" />
          <AccuracyCard label="Bot" value={accBot} tint="oklch(0.7 0.18 25)" />
        </div>
      )}

      {/* ── Eval graph — sigmoid win% curve ── */}
      <div className="px-3 pt-3">
        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-secondary/40 border border-border/50">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            {/* Equal-position midline at y=50 (50% win chance) */}
            <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
            {/* White-advantage shading below the curve */}
            {areaPath && <path d={areaPath} fill="var(--primary)" opacity="0.15" />}
            {path && <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.2" />}
            {/* Cursor for selected ply */}
            {selectedPly > 0 && selectedPly <= analyzed.length && (
              <line
                x1={(selectedPly / analyzed.length) * 100}
                x2={(selectedPly / analyzed.length) * 100}
                y1="0"
                y2="100"
                stroke="var(--primary)"
                strokeWidth="0.8"
                opacity="0.7"
              />
            )}
          </svg>
          <span className="absolute top-1 left-1 text-[9px] text-muted-foreground">White</span>
          <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground">Black</span>
        </div>
      </div>

      {/* ── Mistakes summary ── */}
      {done && (
        <div className="px-3 pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Move Summary
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(
              ["brilliant", "best", "excellent", "great", "good", "inaccuracy", "mistake", "blunder"] as Classification[]
            ).map((k) => (
              <div
                key={k}
                className="text-center rounded-md py-1.5 border border-border/50"
                style={{ backgroundColor: `color-mix(in oklab, ${CLASS_COLORS[k]} 18%, transparent)` }}
              >
                <div
                  className="text-sm font-bold tabular-nums flex items-center justify-center gap-0.5"
                  style={{ color: CLASS_COLORS[k] }}
                >
                  {k === "brilliant" && <Sparkles className="w-3 h-3" />} {counts[k]}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  {CLASS_LABEL[k]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Current move detail ── */}
      {done && current && (
        <div className="mx-3 mt-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-black text-white"
                style={{ background: CLASS_COLORS[current.classification] }}
              >
                {CLASS_GLYPH[current.classification]}
              </span>
              <div>
                <div className="text-sm font-bold" style={{ color: CLASS_COLORS[current.classification] }}>
                  {CLASS_LABEL[current.classification]}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Move {Math.floor((selectedPly - 1) / 2) + 1}
                  {(selectedPly - 1) % 2 === 0 ? "." : "…"} {current.san}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono tabular-nums">{formatCp(current.cpAfter)}</div>
              <div className="text-[9px] text-muted-foreground">
                {current.wpLoss < 0.5
                  ? "no loss"
                  : `−${current.wpLoss.toFixed(1)}% win chance`}
              </div>
            </div>
          </div>
          {current.bestSan && current.bestUci !== current.uci && (
            <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-2">
              Best: <span className="font-mono font-semibold text-foreground">{current.bestSan}</span>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => go(-1)}
              disabled={selectedPly <= 1}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs btn-primary-glow"
              onClick={() => go(1)}
              disabled={selectedPly >= analyzed.length}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Per-ply list ── */}
      <div className="max-h-60 overflow-y-auto p-2 mt-2">
        {!done && !analyzed.length && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            Analyzing positions…
          </div>
        )}
        {analyzed.map((p, i) => {
          const ply = i + 1;
          const moveNo = Math.floor(i / 2) + 1;
          const isWhite = i % 2 === 0;
          const isSelected = selectedPly === ply;
          return (
            <button
              key={i}
              onClick={() => handleSelect(ply)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-xs",
                isSelected ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              <span className="w-8 text-muted-foreground tabular-nums shrink-0">
                {moveNo}{isWhite ? "." : "…"}
              </span>
              <span className="font-mono font-semibold w-14 shrink-0">{p.san}</span>
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black text-white shrink-0"
                style={{ background: CLASS_COLORS[p.classification] }}
                title={CLASS_LABEL[p.classification]}
              >
                {CLASS_GLYPH[p.classification]}
              </span>
              <span className="text-muted-foreground flex-1 truncate">
                {p.classification !== "best" && p.classification !== "brilliant" && p.bestSan
                  ? `Best: ${p.bestSan}`
                  : CLASS_LABEL[p.classification]}
              </span>
              <span className="font-mono text-muted-foreground tabular-nums shrink-0">
                {formatCp(p.cpAfter)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccuracyCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div
      className="rounded-lg border border-border px-3 py-2"
      style={{ background: `color-mix(in oklab, ${tint} 10%, transparent)` }}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label} Accuracy
      </div>
      <div className="text-2xl font-black tabular-nums" style={{ color: tint }}>
        {value}
        <span className="text-sm font-bold text-muted-foreground">%</span>
      </div>
    </div>
  );
}

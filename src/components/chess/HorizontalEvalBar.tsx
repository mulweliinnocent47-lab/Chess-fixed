// HorizontalEvalBar — Direct-DOM eval bar, zero React re-renders on updates.
//
// The bar registers itself with the engine's game loop via setLiveEvalCallback.
// When a new cp value arrives (up to 60x/sec), we write directly to DOM refs
// with element.style.width/textContent — bypassing React's reconciler entirely.
// This makes the eval bar completely free in terms of React render cost.

import { memo, useEffect, useRef } from "react";
import { setLiveEvalCallback } from "@/lib/chess/engine";

type Props = {
  orientation: "white" | "black";
  loading?: boolean;
  // cp prop kept for SSR / initial render and review mode
  cp?: number | null;
};

function formatCp(cp: number): string {
  if (Math.abs(cp) >= 90000) return `M${100000 - Math.abs(cp)}`;
  const v = cp / 100;
  if (Math.abs(v) < 0.05) return "0.0";
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

function whiteShareFromCp(cp: number): number {
  if (Math.abs(cp) >= 90000) return cp > 0 ? 100 : 0;
  const wp = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  return Math.max(2, Math.min(98, wp));
}

export const HorizontalEvalBar = memo(function HorizontalEvalBar({ orientation, loading, cp }: Props) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // Write directly to DOM — no state, no re-render
  function applyDom(rawCp: number) {
    const ws = whiteShareFromCp(rawCp);
    const leftShare  = orientation === "white" ? 100 - ws : ws;
    const rightShare = 100 - leftShare;
    if (leftRef.current)  leftRef.current.style.width  = `${leftShare}%`;
    if (rightRef.current) rightRef.current.style.width = `${rightShare}%`;
    if (labelRef.current) {
      labelRef.current.textContent = formatCp(rawCp);
      const labelOnRight = rightShare > leftShare;
      labelRef.current.className = [
        "absolute top-1/2 -translate-y-1/2 text-[9px] font-bold tabular-nums px-1.5",
        labelOnRight ? "right-1" : "left-1",
      ].join(" ");
      labelRef.current.style.color = labelOnRight
        ? orientation === "white" ? "oklch(0.2 0 0)" : "oklch(0.95 0 0)"
        : orientation === "white" ? "oklch(0.95 0 0)" : "oklch(0.2 0 0)";
    }
  }

  // Register as the live eval callback — receives updates at 60fps from game loop
  useEffect(() => {
    setLiveEvalCallback(applyDom);
    return () => setLiveEvalCallback(() => {}); // deregister on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // Apply cp prop changes (review mode navigation, initial render)
  useEffect(() => {
    if (cp != null) applyDom(cp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp]);

  // Initial state
  const initWs = whiteShareFromCp(cp ?? 0);
  const initLeft  = orientation === "white" ? 100 - initWs : initWs;
  const initRight = 100 - initLeft;

  return (
    <div
      className="relative w-full h-3 rounded-full overflow-hidden border border-border bg-[oklch(0.18_0.02_250)]"
      aria-label="Evaluation bar"
    >
      <div
        ref={leftRef}
        className="absolute inset-y-0 left-0"
        style={{
          width: `${initLeft}%`,
          background: orientation === "white" ? "oklch(0.22 0.02 250)" : "oklch(0.96 0.005 240)",
          transition: "width 80ms linear",
          willChange: "width",
        }}
      />
      <div
        ref={rightRef}
        className="absolute inset-y-0 right-0"
        style={{
          width: `${initRight}%`,
          background: orientation === "white" ? "oklch(0.96 0.005 240)" : "oklch(0.22 0.02 250)",
          transition: "width 80ms linear",
          willChange: "width",
        }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-primary/50" />
      <div
        ref={labelRef}
        className={`absolute top-1/2 -translate-y-1/2 text-[9px] font-bold tabular-nums px-1.5 ${initRight > initLeft ? "right-1" : "left-1"}`}
        style={{ color: initRight > initLeft ? (orientation === "white" ? "oklch(0.2 0 0)" : "oklch(0.95 0 0)") : (orientation === "white" ? "oklch(0.95 0 0)" : "oklch(0.2 0 0)") }}
      >
        {formatCp(cp ?? 0)}
      </div>
      {loading && <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />}
    </div>
  );
});

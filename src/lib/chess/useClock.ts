import { useCallback, useEffect, useRef, useState } from "react";

export type TimeControl = {
  /** Initial time per side in seconds */
  initial: number;
  /** Increment in seconds added after each completed move */
  increment: number;
};

export type ClockState = {
  whiteMs: number;
  blackMs: number;
  /** Whose clock is running. null = paused */
  running: "w" | "b" | null;
};

/**
 * Chess clock with increment. Calls onFlag(side) when a side runs out of time.
 * Tick is internal; consumer provides authoritative running side via setRunning.
 */
export function useClock(tc: TimeControl, onFlag?: (side: "w" | "b") => void) {
  const [whiteMs, setWhiteMs] = useState(tc.initial * 1000);
  const [blackMs, setBlackMs] = useState(tc.initial * 1000);
  const [running, setRunning] = useState<"w" | "b" | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const flaggedRef = useRef(false);

  // Reset on time control change
  useEffect(() => {
    setWhiteMs(tc.initial * 1000);
    setBlackMs(tc.initial * 1000);
    setRunning(null);
    flaggedRef.current = false;
  }, [tc.initial, tc.increment]);

  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (running === "w") {
        setWhiteMs((ms) => {
          const next = ms - delta;
          if (next <= 0 && !flaggedRef.current) {
            flaggedRef.current = true;
            onFlag?.("w");
            return 0;
          }
          return next;
        });
      } else {
        setBlackMs((ms) => {
          const next = ms - delta;
          if (next <= 0 && !flaggedRef.current) {
            flaggedRef.current = true;
            onFlag?.("b");
            return 0;
          }
          return next;
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, onFlag]);

  /** Add increment to the side that just moved */
  const addIncrement = useCallback(
    (side: "w" | "b") => {
      const inc = tc.increment * 1000;
      if (inc <= 0) return;
      if (side === "w") setWhiteMs((ms) => ms + inc);
      else setBlackMs((ms) => ms + inc);
    },
    [tc.increment],
  );

  const reset = useCallback(() => {
    setWhiteMs(tc.initial * 1000);
    setBlackMs(tc.initial * 1000);
    setRunning(null);
    flaggedRef.current = false;
  }, [tc.initial]);

  return {
    whiteMs,
    blackMs,
    running,
    setRunning,
    addIncrement,
    reset,
  };
}

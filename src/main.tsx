import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Startup preloads (fire before first render) ───────────────────────────────

// 1. Warm up both Stockfish workers so the first bot move has zero init latency.
import { warmupEngine } from "./lib/chess/engine";
warmupEngine();

// 2. Preload all 12 piece SVGs into the browser image cache.
//    Browsers fetch <img src> lazily — without preload, the first render of
//    each new piece type causes a network stall visible as a flicker.
const PIECE_COLORS = ["w", "b"] as const;
const PIECE_TYPES  = ["p", "n", "b", "r", "q", "k"] as const;
PIECE_COLORS.forEach((color) =>
  PIECE_TYPES.forEach((type) => {
    const img = new Image();
    img.src = `/pieces/${color}${type}.svg`;
  }),
);

// 3. Preload sounds (already done inside sounds.ts via requestIdleCallback,
//    but we nudge the AudioContext creation here on first user gesture.)
//    Nothing to do — sounds.ts handles it.

// ── Mount ─────────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")!).render(<App />);

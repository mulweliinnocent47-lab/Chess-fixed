import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import {
  ArrowLeft,
  Flame,
  Lightbulb,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Shuffle,
} from "lucide-react";
import { Board } from "@/components/chess/Board";
import { PageTransition } from "@/components/PageTransition";
import {
  getDailyPuzzle,
  getNextPracticePuzzle,
  saveDailyState,
  type Puzzle,
  type DailyState,
} from "@/lib/chess/puzzles";
import { sfx } from "@/lib/chess/sounds";
import { addGems, gemsForPuzzle } from "@/lib/chess/gems";
import { markDailySolved } from "@/lib/chess/streaks";

type Loaded = {
  puzzle: Puzzle;
  attempts: number;
  solved: boolean;
  isDaily: boolean;
};

// Apply a UCI move to a Chess instance, handling optional promotion.
function applyUci(c: Chess, uci: string) {
  c.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  });
}

function PuzzlesPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [chess, setChess] = useState<Chess | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [selected, setSelected] = useState<Square | null>(null);
  // step = which player move we're waiting for (index into puzzle.solution)
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "correct" | "wrong" | "solved">("idle");
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);
  const orientationRef = useRef<"white" | "black">("white");

  // ── Helpers ────────────────────────────────────────────────────────────────

  function initBoard(puzzle: Puzzle): Chess {
    const c = new Chess(puzzle.fen);
    // Play the opponent's setup move so the player faces the challenge position.
    if (puzzle.moves.length > 0) applyUci(c, puzzle.moves[0]);
    return c;
  }

  // ── Initial load: today's daily puzzle ────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    getDailyPuzzle()
      .then(({ puzzle, state }) => {
        if (!mounted) return;
        const c = initBoard(puzzle);
        orientationRef.current = c.turn() === "w" ? "white" : "black";
        setChess(c);
        setLoaded({ puzzle, attempts: state.attempts, solved: state.solved, isDaily: true });
        setStatus(state.solved ? "solved" : "idle");
        setStep(0);
      })
      .catch(() => {
        // Fall back to a random practice puzzle if daily fails.
        getNextPracticePuzzle().then((puzzle) => {
          if (!mounted) return;
          const c = initBoard(puzzle);
          orientationRef.current = c.turn() === "w" ? "white" : "black";
          setChess(c);
          setLoaded({ puzzle, attempts: 0, solved: false, isDaily: false });
        });
      });
    return () => { mounted = false; };
  }, []);

  const playerColor = orientationRef.current;

  const lastMove = useMemo(() => {
    if (!chess) return null;
    const v = chess.history({ verbose: true });
    if (!v.length) return null;
    const m = v[v.length - 1];
    return { from: m.from as Square, to: m.to as Square };
  }, [chess]);

  const legalTargets: Square[] =
    chess && selected
      ? chess.moves({ square: selected, verbose: true }).map((m) => m.to as Square)
      : [];

  // ── Reset current puzzle ───────────────────────────────────────────────────

  const reset = () => {
    if (!loaded) return;
    const c = initBoard(loaded.puzzle);
    setChess(c);
    setSelected(null);
    setStep(0);
    setStatus("idle");
    setHint(null);
  };

  // ── Load a new random practice puzzle ─────────────────────────────────────

  const loadNewRandom = async () => {
    const puzzle = await getNextPracticePuzzle({ minRating: 600, maxRating: 1800 });
    const c = initBoard(puzzle);
    orientationRef.current = c.turn() === "w" ? "white" : "black";
    setChess(c);
    setLoaded({ puzzle, attempts: 0, solved: false, isDaily: false });
    setSelected(null);
    setStep(0);
    setStatus("idle");
    setHint(null);
  };

  // ── Move handling ──────────────────────────────────────────────────────────

  const tryMove = (from: Square, to: Square) => {
    if (!chess || !loaded || status === "solved") return;

    const moves = chess.moves({ square: from, verbose: true });
    const m = moves.find((x) => x.to === to);
    if (!m) return;

    const uci = `${from}${to}${m.promotion ?? ""}`;
    const expected = loaded.puzzle.solution[step];

    // Treat both "e7e8q" and "e7e8" as matching "e7e8q" (auto-queen default).
    const ok =
      uci === expected ||
      (expected.length === 5 && uci === expected.slice(0, 4));

    if (!ok) {
      sfx.wrong();
      setStatus("wrong");
      setLoaded({ ...loaded, attempts: loaded.attempts + 1 });
      // Reset to puzzle start after a brief flash.
      setTimeout(() => reset(), 500);
      return;
    }

    // ── Correct move ──────────────────────────────────────────────────────

    chess.move({ from, to, promotion: m.promotion ?? (expected[4] as "q" | "r" | "b" | "n" | undefined) });
    sfx.move();
    setSelected(null);
    setHint(null);
    refresh();

    const nextStep = step + 1;

    if (nextStep >= loaded.puzzle.solution.length) {
      // ── Puzzle solved ───────────────────────────────────────────────────
      setStep(nextStep);
      setStatus("solved");
      sfx.gameOverWin();
      addGems(gemsForPuzzle());

      if (loaded.isDaily) {
        const newState: DailyState = {
          dateKey: new Date().toISOString().slice(0, 10),
          puzzleId: loaded.puzzle.id,
          solved: true,
          attempts: loaded.attempts + 1,
        };
        saveDailyState(newState);
        markDailySolved();
      }
      return;
    }

    // ── Play opponent's reply, then wait for player's next move ───────────
    // Lichess move layout after setup (moves[0]):
    //   moves[1] = player step 0    moves[2] = opp reply after step 0
    //   moves[3] = player step 1    moves[4] = opp reply after step 1
    //
    // After the player plays solution[step] (which is moves[1 + step*2]),
    // the opponent's reply is at moves[2 + step*2] = moves[nextStep * 2].
    const replyIdx = nextStep * 2; // ← fixed (was "1 + nextStep*2" before)

    setStatus("correct");

    if (replyIdx < loaded.puzzle.moves.length) {
      const reply = loaded.puzzle.moves[replyIdx];
      setTimeout(() => {
        try {
          applyUci(chess, reply);
          sfx.move();
        } catch {
          /* board state changed (reset/new puzzle) — ignore */
        }
        setStep(nextStep);
        setStatus("idle");
        refresh();
      }, 150);
    } else {
      // No opponent reply (shouldn't happen in valid puzzles, but be safe).
      setStep(nextStep);
      setTimeout(() => setStatus("idle"), 600);
    }
  };

  const onSquareClick = (sq: Square) => {
    if (!chess || status === "solved") return;
    if (selected) {
      const moves = chess.moves({ square: selected, verbose: true });
      if (moves.find((m) => m.to === sq)) {
        tryMove(selected, sq);
        return;
      }
      const piece = chess.get(sq);
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        return;
      }
      setSelected(null);
      return;
    }
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) setSelected(sq);
  };

  const showHint = () => {
    if (!loaded) return;
    const uci = loaded.puzzle.solution[step];
    if (!uci) return;
    setHint({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-3 py-4 flex flex-col items-center">
        <header className="w-full max-w-md flex items-center gap-2 mb-3">
          <Link
            to="/"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight leading-none">
              {loaded?.isDaily ? "Daily Puzzle" : "Puzzle"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {loaded
                ? `${loaded.puzzle.theme} · Rating ${loaded.puzzle.rating}`
                : "Loading…"}
            </p>
          </div>
          <Link
            to="/puzzle-rush"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-[11px] font-bold text-primary-foreground"
            style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
          >
            <Flame className="w-3.5 h-3.5" /> Rush
          </Link>
        </header>

        {!loaded || !chess ? (
          <div className="w-full max-w-md aspect-square rounded-xl bg-card border border-border animate-pulse" />
        ) : (
          <div className="w-full max-w-md space-y-3">
            {/* Status bar */}
            <div
              className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <span>
                {status === "solved" ? (
                  <span className="inline-flex items-center gap-1.5 text-[oklch(0.78_0.18_150)]">
                    <CheckCircle2 className="w-4 h-4" /> Puzzle solved!
                  </span>
                ) : status === "wrong" ? (
                  <span className="inline-flex items-center gap-1.5 text-[oklch(0.75_0.22_25)]">
                    <XCircle className="w-4 h-4" /> Not quite — resetting…
                  </span>
                ) : status === "correct" ? (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    Good move!
                  </span>
                ) : (
                  <span>{playerColor === "white" ? "White" : "Black"} to play</span>
                )}
              </span>
              <span className="text-muted-foreground text-[11px]">
                Attempts: {loaded.attempts}
              </span>
            </div>

            <Board
              chess={chess}
              orientation={playerColor}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              hint={hint}
              interactive={status !== "solved"}
              onSquareClick={onSquareClick}
              onDragMove={tryMove}
            />

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={showHint}
                disabled={status === "solved"}
                className="btn-soft h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Lightbulb className="w-4 h-4" /> Hint
              </button>
              <button
                onClick={reset}
                className="btn-soft h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={loadNewRandom}
                className="btn-soft h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Shuffle className="w-4 h-4" /> Next
              </button>
            </div>
          </div>
        )}
      </main>
    </PageTransition>
  );
}

export default PuzzlesPage;

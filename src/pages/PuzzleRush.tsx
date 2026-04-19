import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Play,
  RotateCcw,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import { Board } from "@/components/chess/Board";
import { PageTransition } from "@/components/PageTransition";
import { getUnseenPuzzle, type Puzzle } from "@/lib/chess/puzzles";
import { sfx } from "@/lib/chess/sounds";
import { addGems } from "@/lib/chess/gems";
import { cn } from "@/lib/utils";

type Phase = "idle" | "playing" | "ended";

const RUSH_DURATION = 180; // 3 minutes
const BEST_KEY = "chess-puzzle-rush-best-v1";

function loadBest(): { score: number; streak: number } {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { score: 0, streak: 0 };
}

function saveBest(b: { score: number; streak: number }) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

// Apply a UCI move to a Chess instance, handling optional promotion.
function applyUci(c: Chess, uci: string) {
  c.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  });
}

function PuzzleRushPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [timeLeft, setTimeLeft] = useState(RUSH_DURATION);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [best, setBest] = useState(() => loadBest());

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [chess, setChess] = useState<Chess | null>(null);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [selected, setSelected] = useState<Square | null>(null);
  const [step, setStep] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | "solved" | null>(null);
  const orientationRef = useRef<"white" | "black">("white");
  const phaseRef = useRef<Phase>("idle");

  // In-memory seen set — reset at the start of each new run so we never
  // repeat a puzzle within a single Rush session.
  const rushSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const playerColor = orientationRef.current;

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id);
          setPhase("ended");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── Save personal best when run ends ──────────────────────────────────────

  useEffect(() => {
    if (phase !== "ended") return;
    const next = {
      score: Math.max(best.score, score),
      streak: Math.max(best.streak, bestStreak),
    };
    if (next.score !== best.score || next.streak !== best.streak) {
      setBest(next);
      saveBest(next);
    }
  }, [phase, score, bestStreak, best]);

  // ── Load next puzzle (never repeating within a run) ───────────────────────

  const loadNextPuzzle = useCallback(async () => {
    const p = await getUnseenPuzzle(rushSeenRef.current, {
      minRating: 600,
      maxRating: 1600,
    });
    const c = new Chess(p.fen);
    if (p.moves.length > 0) {
      try {
        applyUci(c, p.moves[0]);
      } catch {
        // Malformed puzzle — skip and try another.
        return loadNextPuzzle();
      }
    }
    orientationRef.current = c.turn() === "w" ? "white" : "black";
    setChess(c);
    setPuzzle(p);
    setSelected(null);
    setStep(0);
  }, []);

  // ── Start / restart ───────────────────────────────────────────────────────

  const start = async () => {
    // Clear in-memory seen set so the new run gets fresh puzzles.
    rushSeenRef.current = new Set();
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setTimeLeft(RUSH_DURATION);
    setFlash(null);
    await loadNextPuzzle();
    setPhase("playing");
  };

  // ── Board derived state ───────────────────────────────────────────────────

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

  // ── Move outcome handlers ─────────────────────────────────────────────────

  const handleWrong = () => {
    sfx.wrong();
    setFlash("wrong");
    setStreak(0);
    setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      setFlash(null);
      loadNextPuzzle();
    }, 400);
  };

  const handleSolved = () => {
    sfx.correct();
    setFlash("solved");
    addGems(1);
    setScore((s) => s + 1);
    setStreak((s) => {
      const ns = s + 1;
      setBestStreak((b) => Math.max(b, ns));
      // Bonus gem every 5 in a row
      if (ns > 0 && ns % 5 === 0) addGems(2);
      return ns;
    });
    setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      setFlash(null);
      loadNextPuzzle();
    }, 350);
  };

  // ── Move handling ─────────────────────────────────────────────────────────

  const tryMove = (from: Square, to: Square) => {
    if (!chess || !puzzle || phase !== "playing" || flash) return;

    const moves = chess.moves({ square: from, verbose: true });
    const m = moves.find((x) => x.to === to);
    if (!m) return;

    const uci = `${from}${to}${m.promotion ?? ""}`;
    const expected = puzzle.solution[step];

    // Auto-queen promotion: treat "e7e8" as matching "e7e8q"
    const ok =
      uci === expected ||
      (expected.length === 5 && uci === expected.slice(0, 4));

    if (!ok) { handleWrong(); return; }

    try {
      chess.move({
        from,
        to,
        promotion: m.promotion ?? (expected[4] as "q" | "r" | "b" | "n" | undefined),
      });
    } catch {
      handleWrong();
      return;
    }

    sfx.move();
    const nextStep = step + 1;

    if (nextStep >= puzzle.solution.length) {
      // All player moves done — puzzle solved.
      setStep(nextStep);
      setSelected(null);
      refresh();
      handleSolved();
      return;
    }

    // Opponent replies at:
    //   moves[2 + step*2]  =  moves[nextStep * 2]
    // (fixes the old bug: was "1 + nextStep*2" which indexed the player's next move)
    const replyIdx = nextStep * 2;

    setStep(nextStep);
    setSelected(null);
    refresh();

    if (replyIdx < puzzle.moves.length) {
      const reply = puzzle.moves[replyIdx];
      window.setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        try {
          applyUci(chess, reply);
          sfx.move();
          refresh();
        } catch { /* state changed between tick — safe to ignore */ }
      }, 150);
    }
  };

  const onSquareClick = (sq: Square) => {
    if (!chess || phase !== "playing" || flash) return;
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

  // ── Render ────────────────────────────────────────────────────────────────

  const mm = String(Math.floor(timeLeft / 60)).padStart(1, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const lowTime = timeLeft <= 30;

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-3 py-4 flex flex-col items-center">
        <header className="w-full max-w-md flex items-center gap-2 mb-3">
          <Link
            to="/puzzles"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight leading-none">Puzzle Rush</h1>
            <p className="text-[10px] text-muted-foreground">Solve as many as you can in 3:00</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground leading-none">Best</p>
            <p className="text-sm font-bold leading-tight">{best.score}</p>
          </div>
        </header>

        {/* Stats bar */}
        <div className="w-full max-w-md grid grid-cols-3 gap-2 mb-3">
          <div
            className={cn(
              "rounded-xl px-3 py-2 flex items-center gap-2",
              lowTime && phase === "playing" ? "text-[oklch(0.75_0.22_25)]" : "",
            )}
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <Timer className="w-4 h-4 shrink-0" />
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Time</p>
              <p className="text-sm font-bold tabular-nums">{mm}:{ss}</p>
            </div>
          </div>
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Solved</p>
              <p className="text-sm font-bold tabular-nums">{score}</p>
            </div>
          </div>
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <Flame className="w-4 h-4 shrink-0 text-[oklch(0.78_0.18_55)]" />
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Streak</p>
              <p className="text-sm font-bold tabular-nums">{streak}</p>
            </div>
          </div>
        </div>

        {/* Idle splash */}
        {phase === "idle" && (
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              <Flame className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">3-Minute Puzzle Rush</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Solve as many puzzles as you can. Each correct solution scores a point and grows
                your streak. A miss resets the streak and serves the next puzzle.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Best:{" "}
                <b className="text-foreground">{best.score}</b>
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Top streak:{" "}
                <b className="text-foreground">{best.streak}</b>
              </span>
            </div>
            <button
              onClick={start}
              className="h-11 px-6 rounded-xl text-sm font-bold inline-flex items-center gap-2 text-primary-foreground"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              <Play className="w-4 h-4" /> Start Rush
            </button>
          </div>
        )}

        {/* Active board */}
        {phase !== "idle" && puzzle && chess && (
          <div className="w-full max-w-md space-y-3">
            <div
              className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <span>
                {flash === "solved" ? (
                  <span className="inline-flex items-center gap-1.5 text-[oklch(0.78_0.18_150)]">
                    <CheckCircle2 className="w-4 h-4" /> Solved! Next…
                  </span>
                ) : flash === "wrong" ? (
                  <span className="inline-flex items-center gap-1.5 text-[oklch(0.75_0.22_25)]">
                    <XCircle className="w-4 h-4" /> Missed — next puzzle…
                  </span>
                ) : (
                  <span>{playerColor === "white" ? "White" : "Black"} to play</span>
                )}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {puzzle.theme} · {puzzle.rating}
              </span>
            </div>

            <Board
              chess={chess}
              orientation={playerColor}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              hint={null}
              interactive={phase === "playing" && !flash}
              onSquareClick={onSquareClick}
              onDragMove={tryMove}
            />
          </div>
        )}

        {/* End screen */}
        {phase === "ended" && (
          <div
            className="w-full max-w-md mt-4 rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-base font-extrabold tracking-tight">Time's up!</h2>
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="rounded-xl bg-secondary/40 py-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Score</p>
                <p className="text-2xl font-extrabold tabular-nums">{score}</p>
                {score > 0 && score >= best.score && (
                  <p className="text-[10px] text-[oklch(0.78_0.18_150)] font-semibold">New best!</p>
                )}
              </div>
              <div className="rounded-xl bg-secondary/40 py-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Top streak</p>
                <p className="text-2xl font-extrabold tabular-nums">{bestStreak}</p>
                {bestStreak > 0 && bestStreak >= best.streak && (
                  <p className="text-[10px] text-[oklch(0.78_0.18_150)] font-semibold">New best!</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full pt-1">
              <button
                onClick={start}
                className="flex-1 h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 text-primary-foreground"
                style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
              >
                <RotateCcw className="w-4 h-4" /> Play Again
              </button>
              <Link
                to="/puzzles"
                className="btn-soft flex-1 h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center"
              >
                Back
              </Link>
            </div>
          </div>
        )}
      </main>
    </PageTransition>
  );
}

export default PuzzleRushPage;

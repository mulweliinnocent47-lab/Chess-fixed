import { Link } from "react-router-dom";
import { Flame, Puzzle as PuzzleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { MiniBoardPreview } from "@/components/chess/MiniBoardPreview";
import { getDailyPuzzle } from "@/lib/chess/puzzles";
import puzzleBg from "@/assets/home/puzzle-bg.jpg";

export function DailyPuzzleCard({ streak }: { streak: number }) {
  const [fen, setFen] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    getDailyPuzzle()
      .then(({ puzzle }) => {
        if (mounted) setFen(puzzle.fen);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-4 border border-border"
      style={{
        background: "var(--gradient-card-amber)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url(${puzzleBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          mixBlendMode: "screen",
        }}
      />
      <div className="relative flex items-stretch gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <PuzzleIcon className="w-4 h-4" style={{ color: "oklch(0.85 0.08 230)" }} />
            <h2 className="text-lg font-extrabold tracking-tight">Daily Puzzle</h2>
          </div>
          <div className="text-sm text-muted-foreground mb-3 inline-flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" style={{ color: "var(--streak)" }} />
            Streak{" "}
            <span className="font-extrabold" style={{ color: "var(--streak)" }}>
              {streak}
            </span>
          </div>

          <Link
            to="/puzzles"
            className="mt-auto h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center"
            style={{
              background: "var(--gradient-amber)",
              color: "oklch(0.18 0.04 60)",
              boxShadow:
                "var(--shadow-glow-amber), inset 0 1px 0 oklch(1 0 0 / 0.3)",
            }}
          >
            Solve Now
          </Link>
        </div>

        <div className="w-[44%] shrink-0">
          <Link to="/puzzles" aria-label="Open daily puzzle">
            <MiniBoardPreview fen={fen} cropRanks={5} />
          </Link>
        </div>
      </div>
    </section>
  );
}

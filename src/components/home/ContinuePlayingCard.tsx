import { User, Clock } from "lucide-react";
import { MiniBoardPreview } from "@/components/chess/MiniBoardPreview";
import type { GameHistoryEntry } from "@/lib/chess/history";

type Props = {
  last: GameHistoryEntry | null;
  hasActiveGame: boolean;
  onResume: () => void;
  onStart: () => void;
};

export function ContinuePlayingCard({ last, hasActiveGame, onResume, onStart }: Props) {
  const opponent = last?.botName ?? "Leo";
  const rating = last?.botRating ?? 800;
  const minutes = Math.max(1, Math.round((last?.timeControl?.initial ?? 480) / 60));
  const showResume = hasActiveGame;

  return (
    <section
      className="relative overflow-hidden rounded-2xl p-4 border"
      style={{
        background: "var(--gradient-card)",
        borderColor: "oklch(0.7 0.18 245 / 0.35)",
        boxShadow:
          "var(--shadow-card), inset 0 1px 0 oklch(1 0 0 / 0.04), 0 0 0 1px oklch(0.7 0.18 245 / 0.08)",
      }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.78 0.16 245 / 0.85), transparent)",
        }}
      />

      <div className="flex items-stretch gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "oklch(1 0 0 / 0.08)" }}
            >
              <User className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-lg font-extrabold tracking-tight">
              {showResume ? "Continue Playing" : "Start Playing"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {showResume ? (
              <>
                vs {opponent} <span className="opacity-80">({rating})</span>
              </>
            ) : (
              <>Pick a bot and color, then play.</>
            )}
          </p>

          <button
            onClick={showResume ? onResume : onStart}
            className="mt-auto h-11 rounded-xl text-sm font-bold text-primary-foreground inline-flex items-center justify-center"
            style={{
              background: "var(--gradient-accent)",
              boxShadow:
                "0 8px 22px -8px oklch(0.65 0.18 245 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.2)",
            }}
          >
            {showResume ? "Resume Game" : "Start Playing"}
          </button>
        </div>

        <div className="relative w-[44%] shrink-0">
          <span
            className="absolute -top-1 right-0 z-10 inline-flex items-center gap-1 px-2 h-6 rounded-md text-[10px] font-semibold border border-border"
            style={{ background: "oklch(0.2 0.02 255 / 0.85)" }}
          >
            <Clock className="w-3 h-3" /> {minutes} min
          </span>
          <button
            type="button"
            onClick={showResume ? onResume : onStart}
            aria-label={showResume ? "Resume game" : "Start playing"}
            className="block w-full"
          >
            <MiniBoardPreview cropRanks={5} />
          </button>
        </div>
      </div>
    </section>
  );
}

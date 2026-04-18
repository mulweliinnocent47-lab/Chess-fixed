import { Trophy, Target, Hash, TrendingUp, ArrowRight } from "lucide-react";
import robot from "@/assets/home/robot-hero.jpg";

type Props = {
  ratingFrom: number;
  ratingTo: number;
  accuracy: number;
  gamesPlayed: number;
};

export function ProgressCard({ ratingFrom, ratingTo, accuracy, gamesPlayed }: Props) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl p-4 border border-border"
      style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Robot art */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none"
        style={{
          backgroundImage: `url(${robot})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          maskImage:
            "linear-gradient(90deg, transparent 0%, oklch(0 0 0 / 0.5) 35%, oklch(0 0 0) 70%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, oklch(0 0 0 / 0.5) 35%, oklch(0 0 0) 70%)",
        }}
      />

      <div className="relative">
        <h2 className="text-lg font-extrabold tracking-tight mb-3">Your Progress</h2>

        <div className="space-y-2 max-w-[60%]">
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold">{ratingFrom}</span>
            <ArrowRight className="w-3.5 h-3.5" style={{ color: "oklch(0.78 0.18 150)" }} />
            <span className="font-bold">{ratingTo}</span>
            <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.78 0.18 150)" }} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="w-4 h-4" />
            Accuracy: <span className="font-bold text-foreground">{accuracy}%</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="w-4 h-4" />
            Games Played: <span className="font-bold text-foreground">{gamesPlayed}</span>
          </div>
        </div>

        {/* progress bar */}
        <div className="mt-4 max-w-[60%]">
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: "oklch(1 0 0 / 0.06)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(8, ((ratingTo - ratingFrom + 5) / 30) * 100))}%`,
                background: "var(--gradient-accent)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import * as Icons from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { ACHIEVEMENTS, getUnlocked, type Achievement } from "@/lib/chess/achievements";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<Achievement["tier"], { bg: string; ring: string; label: string }> = {
  bronze: { bg: "bg-amber-700/20",   ring: "ring-amber-700/40",   label: "Bronze" },
  silver: { bg: "bg-zinc-300/15",    ring: "ring-zinc-300/40",    label: "Silver" },
  gold:   { bg: "bg-yellow-400/20",  ring: "ring-yellow-400/50",  label: "Gold"   },
  legend: { bg: "bg-fuchsia-500/20", ring: "ring-fuchsia-500/50", label: "Legend" },
};

function AchievementsPage() {
  const unlocked = getUnlocked();
  const total = ACHIEVEMENTS.length;
  const got = Object.keys(unlocked).length;

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 pb-10">
        <div className="mx-auto w-full max-w-md flex flex-col gap-5">
          <header className="flex items-center gap-3">
            <Link
              to="/"
              className="w-10 h-10 rounded-xl bg-secondary/60 hover:bg-secondary inline-flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Profile</p>
              <h1 className="text-lg font-bold tracking-tight">Achievements</h1>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {got}/{total} unlocked
            </span>
          </header>

          <div
            className="rounded-2xl p-3"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(got / total) * 100}%`,
                  background: "var(--gradient-accent)",
                }}
              />
            </div>
          </div>

          <section className="grid grid-cols-1 gap-2.5">
            {ACHIEVEMENTS.map((a) => {
              const isOn = a.id in unlocked;
              const tier = TIER_STYLES[a.tier];
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[a.icon] ?? Icons.Trophy;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-2xl p-3 flex items-center gap-3 border border-border bg-card transition-all",
                    !isOn && "opacity-60",
                  )}
                  style={isOn ? { boxShadow: "var(--shadow-card)" } : undefined}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ring-1",
                      tier.bg,
                      tier.ring,
                    )}
                  >
                    {isOn ? (
                      <Icon className="w-6 h-6 text-foreground" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold truncate">{a.title}</h3>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {tier.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {a.description}
                    </p>
                    {isOn && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Unlocked {new Date(unlocked[a.id]).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </main>
    </PageTransition>
  );
}

export default AchievementsPage;

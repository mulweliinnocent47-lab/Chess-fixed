import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Gem, Lock, Sparkles } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import {
  BOARD_THEMES,
  loadActive,
  loadOwned,
  saveOwned,
  setActive,
} from "@/lib/chess/boardThemes";
import { loadGems, spendGems } from "@/lib/chess/gems";
import { cn } from "@/lib/utils";

function StorePage() {
  const [gems, setGems] = useState<number>(() => loadGems());
  const [owned, setOwned] = useState<string[]>(() => loadOwned());
  const [active, setActiveId] = useState<string>(() => loadActive());
  const [pulse, setPulse] = useState<string | null>(null);

  useEffect(() => {
    const onGems = () => setGems(loadGems());
    window.addEventListener("gems-changed", onGems);
    return () => window.removeEventListener("gems-changed", onGems);
  }, []);

  const buy = (id: string, price: number) => {
    if (owned.includes(id)) return;
    if (!spendGems(price)) {
      setPulse(id);
      setTimeout(() => setPulse(null), 600);
      return;
    }
    const next = [...owned, id];
    setOwned(next);
    saveOwned(next);
    setGems(loadGems());
    // Auto-equip newly bought theme
    setActive(id);
    setActiveId(id);
  };

  const equip = (id: string) => {
    setActive(id);
    setActiveId(id);
  };

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 pb-10">
        <div className="mx-auto w-full max-w-md flex flex-col gap-4">
          <header className="flex items-center gap-2">
            <Link
              to="/"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight leading-none">Store</h1>
              <p className="text-[11px] text-muted-foreground">Board themes</p>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <Gem className="w-4 h-4" style={{ color: "var(--gem)" }} />
              <span className="text-sm font-bold tabular-nums">{gems}</span>
            </div>
          </header>

          <section
            className="rounded-2xl p-4 border border-border"
            style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: "var(--amber)" }} />
              <h2 className="text-sm font-bold tracking-tight">Board Themes</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {BOARD_THEMES.map((t) => {
                const isOwned = owned.includes(t.id);
                const isActive = active === t.id;
                const cantAfford = !isOwned && gems < t.price;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-xl border overflow-hidden flex flex-col",
                      isActive ? "border-primary" : "border-border",
                      pulse === t.id && "animate-pulse",
                    )}
                    style={isActive ? { boxShadow: "var(--shadow-glow)" } : undefined}
                  >
                    {/* Mini board preview */}
                    <div className="aspect-square w-full grid grid-cols-4 grid-rows-4">
                      {Array.from({ length: 16 }).map((_, i) => {
                        const r = Math.floor(i / 4);
                        const c = i % 4;
                        const light = (r + c) % 2 === 0;
                        return (
                          <div
                            key={i}
                            style={{ background: light ? t.light : t.dark }}
                          />
                        );
                      })}
                    </div>
                    <div className="p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{t.name}</span>
                        {isOwned ? (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold">
                            <Gem
                              className="w-3 h-3"
                              style={{ color: "var(--gem)" }}
                            />
                            {t.price}
                          </span>
                        )}
                      </div>
                      {isOwned ? (
                        <button
                          onClick={() => equip(t.id)}
                          disabled={isActive}
                          className={cn(
                            "h-8 rounded-lg text-[11px] font-bold transition-colors",
                            isActive
                              ? "bg-primary/15 text-primary cursor-default"
                              : "btn-soft",
                          )}
                        >
                          {isActive ? "Equipped" : "Equip"}
                        </button>
                      ) : (
                        <button
                          onClick={() => buy(t.id, t.price)}
                          disabled={cantAfford}
                          className={cn(
                            "h-8 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 text-primary-foreground",
                            cantAfford && "opacity-50",
                          )}
                          style={{
                            background: "var(--gradient-accent)",
                            boxShadow: "var(--shadow-glow)",
                          }}
                        >
                          {cantAfford ? (
                            <>
                              <Lock className="w-3 h-3" /> Need {t.price - gems}
                            </>
                          ) : (
                            <>Buy</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground text-center">
            Win matches to earn gems · 3-11 per win, more for stronger opponents.
          </p>
        </div>
      </main>
    </PageTransition>
  );
}

export default StorePage;

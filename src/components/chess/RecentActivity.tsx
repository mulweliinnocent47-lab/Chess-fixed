import { useEffect, useState } from "react";
import { History, Trophy, X, Minus } from "lucide-react";
import { loadHistory, type GameHistoryEntry } from "@/lib/chess/history";

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function RecentActivity() {
  const [items, setItems] = useState<GameHistoryEntry[]>([]);

  useEffect(() => {
    setItems(loadHistory().slice(0, 3));
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold tracking-[0.18em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
          <History className="w-3 h-3" /> Recent Activity
        </h2>
        <span className="text-[10px] text-muted-foreground">Last {items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((g) => {
          const Icon = g.outcome === "win" ? Trophy : g.outcome === "loss" ? X : Minus;
          const tone =
            g.outcome === "win"
              ? "bg-[oklch(0.68_0.18_150_/_0.18)] text-[oklch(0.78_0.18_150)]"
              : g.outcome === "loss"
                ? "bg-[oklch(0.65_0.22_25_/_0.18)] text-[oklch(0.75_0.22_25)]"
                : "bg-secondary text-muted-foreground";
          return (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2 bg-secondary/30 border border-border"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  vs {g.botName} <span className="text-muted-foreground font-normal">· {g.botRating}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {g.outcome.toUpperCase()} · {g.reason} · {g.moves} moves
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {timeAgo(g.date)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

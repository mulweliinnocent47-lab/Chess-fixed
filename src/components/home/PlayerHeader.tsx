import { Link } from "react-router-dom";
import { Trophy, Flame, Gem } from "lucide-react";
import defaultAvatar from "@/assets/home/player-avatar.jpg";

type Props = {
  name: string;
  rating: number;
  streak: number;
  gems: number;
  avatar?: string | null;
};

export function PlayerHeader({ name, rating, streak, gems, avatar }: Props) {
  const avatarSrc = avatar || defaultAvatar;
  return (
    <header className="flex items-center justify-between gap-3">
      <Link to="/profile" className="flex items-center gap-3 min-w-0 group">
        <div className="relative shrink-0">
          <div
            className="w-14 h-14 rounded-full overflow-hidden ring-2 transition-transform group-active:scale-95"
            style={{ boxShadow: "var(--shadow-glow-blue)" }}
          >
            <img
              src={avatarSrc}
              alt={`${name} avatar`}
              className="w-full h-full object-cover"
              width={56}
              height={56}
            />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold"
            style={{ background: "var(--gradient-amber)", color: "oklch(0.18 0.02 250)" }}
          >
            ♟
          </span>
        </div>
        <div className="leading-tight min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight truncate">{name}</h1>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              <span className="font-semibold text-foreground">{rating}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" style={{ color: "var(--streak)" }} />
              Streak{" "}
              <span className="font-extrabold" style={{ color: "var(--streak)" }}>
                {streak}
              </span>
            </span>
          </div>
        </div>
      </Link>

      <Link
        to="/store"
        className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border transition-transform active:scale-95"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        aria-label="Open store"
      >
        <Gem className="w-4 h-4" style={{ color: "var(--gem)" }} />
        <span className="text-sm font-bold tabular-nums">{gems}</span>
      </Link>
    </header>
  );
}

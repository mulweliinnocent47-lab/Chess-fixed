import { BOTS } from "@/lib/chess/bots";
import { cn } from "@/lib/utils";

type Props = {
  level: number;
  onChange: (i: number) => void;
};

export function BotPicker({ level, onChange }: Props) {
  return (
    <div className="rounded-xl bg-card border border-border p-3" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Choose your opponent
          </div>
          <div className="text-sm font-semibold">
            {BOTS[level].name} · {BOTS[level].title}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Rating</div>
          <div className="text-lg font-bold text-primary">{BOTS[level].rating}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {BOTS.map((b, i) => {
          const active = i === level;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              className={cn(
                "group relative flex flex-col items-center rounded-lg p-1.5 transition-all border",
                active
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-secondary/50",
              )}
              style={active ? { boxShadow: "var(--shadow-glow)" } : undefined}
            >
              <div
                className={cn(
                  "relative w-full aspect-square rounded-md overflow-hidden ring-1",
                  active ? "ring-primary" : "ring-border",
                )}
              >
                <img
                  src={b.avatar}
                  alt={b.name}
                  loading="lazy"
                  width={128}
                  height={128}
                  className={cn(
                    "w-full h-full object-cover transition-transform",
                    active ? "scale-105" : "group-hover:scale-105",
                    !active && "grayscale-[30%]",
                  )}
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                  <div className="text-[9px] font-bold text-white text-center">
                    {b.rating}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-[10px] font-medium truncate w-full text-center">
                {b.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

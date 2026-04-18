import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BOTS } from "@/lib/chess/bots";
import { cn } from "@/lib/utils";
import type { Color } from "@/lib/chess/gameContext";

type Props = {
  open: boolean;
  initialBotIdx: number;
  initialColor: Color;
  onCancel: () => void;
  onConfirm: (botIdx: number, color: Color) => void;
};

export function PreGameDialog({ open, initialBotIdx, initialColor, onCancel, onConfirm }: Props) {
  const [botIdx, setBotIdx] = useState(initialBotIdx);
  const [color, setColor] = useState<Color | "random">(initialColor);

  const confirm = () => {
    const finalColor: Color =
      color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color;
    onConfirm(botIdx, finalColor);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Set Up Game</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Color */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Play as
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["white", "random", "black"] as const).map((c) => {
                const active = color === c;
                const label = c === "white" ? "♔ White" : c === "black" ? "♚ Black" : "🎲 Random";
                return (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-11 rounded-xl text-xs font-semibold border transition-all",
                      active
                        ? "border-transparent text-primary-foreground"
                        : "border-border bg-secondary/40 hover:bg-secondary",
                    )}
                    style={
                      active
                        ? { background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Opponent
              </div>
              <div className="text-[11px] font-semibold text-primary">
                {BOTS[botIdx].name} · {BOTS[botIdx].rating}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto pr-1">
              {BOTS.map((b, i) => {
                const active = i === botIdx;
                return (
                  <button
                    key={i}
                    onClick={() => setBotIdx(i)}
                    className={cn(
                      "rounded-lg p-1.5 border transition-all flex flex-col items-center",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:border-border hover:bg-secondary/50",
                    )}
                    style={active ? { boxShadow: "var(--shadow-glow)" } : undefined}
                  >
                    <div
                      className={cn(
                        "w-full aspect-square rounded-md overflow-hidden ring-1",
                        active ? "ring-primary" : "ring-border",
                      )}
                    >
                      <img
                        src={b.avatar}
                        alt={b.name}
                        loading="lazy"
                        className={cn("w-full h-full object-cover", !active && "grayscale-[30%]")}
                      />
                    </div>
                    <div className="mt-1 text-[9px] font-bold truncate w-full text-center">
                      {b.rating}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="btn-soft flex-1 h-11 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              className="btn-primary-glow flex-1 h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center"
            >
              Start Game
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

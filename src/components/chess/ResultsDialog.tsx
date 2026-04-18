import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Frown, Handshake, RefreshCw, Home, Users, Eye } from "lucide-react";
import type { BotProfile } from "@/lib/chess/bots";

export type GameOutcome = "win" | "loss" | "draw";
export type GameReason =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "insufficient"
  | "threefold"
  | "fifty"
  | "draw-agreed";

export type ResultsData = {
  outcome: GameOutcome;
  reason: GameReason;
  moves: number;
  accuracyPlayer: number;
  accuracyBot: number;
  botMessage: string;
  bot: BotProfile;
};

const REASON_LABEL: Record<GameReason, string> = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time forfeit",
  stalemate: "Stalemate",
  insufficient: "Insufficient material",
  threefold: "Threefold repetition",
  fifty: "Fifty-move rule",
  "draw-agreed": "Draw agreed",
};

export function ResultsDialog({
  open,
  data,
  onClose,
  onRematch,
  onNewOpponent,
  onReview,
  hideReview,
}: {
  open: boolean;
  data: ResultsData | null;
  onClose: () => void;
  onRematch: () => void;
  onNewOpponent?: () => void;
  onReview?: () => void;
  hideReview?: boolean;
}) {
  if (!data) return null;
  const { outcome, reason, moves, accuracyPlayer, accuracyBot, botMessage, bot } = data;

  const Icon = outcome === "win" ? Trophy : outcome === "loss" ? Frown : Handshake;
  const title = outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : "Draw";
  const accent =
    outcome === "win"
      ? "text-[oklch(0.78_0.18_140)]"
      : outcome === "loss"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className={`text-3xl font-bold tracking-tight ${accent}`}>{title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{REASON_LABEL[reason]}</p>
          </div>

          <div className="w-full grid grid-cols-3 gap-2">
            <Stat label="Moves" value={String(moves)} />
            <Stat label="You" value={`${accuracyPlayer}%`} sub="accuracy" />
            <Stat label={bot.name} value={`${accuracyBot}%`} sub="accuracy" />
          </div>

          <div className="w-full rounded-xl bg-secondary/50 border border-border px-3 py-2.5 text-left">
            <div className="flex items-center gap-2">
              <img src={bot.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              <div className="min-w-0">
                <div className="text-xs font-medium">{bot.name}</div>
                <div className="text-xs text-muted-foreground italic truncate">"{botMessage}"</div>
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col gap-2 pt-1">
            <Button onClick={onRematch} className="btn-primary-glow w-full h-10 rounded-xl text-sm font-semibold">
              <RefreshCw className="w-4 h-4 mr-1.5" /> Rematch
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {!hideReview && onReview && (
                <Button
                  onClick={onReview}
                  variant="secondary"
                  className="rounded-xl h-9 text-xs"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Review
                </Button>
              )}
              {onNewOpponent && (
                <Button
                  onClick={onNewOpponent}
                  variant="secondary"
                  className="rounded-xl h-9 text-xs"
                >
                  <Users className="w-3.5 h-3.5 mr-1" /> New opponent
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="secondary"
                className={`rounded-xl h-9 text-xs ${hideReview && !onNewOpponent ? "col-span-2" : ""}`}
              >
                <Home className="w-3.5 h-3.5 mr-1" /> Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border px-2 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-base font-bold leading-tight">{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(ms: number) {
  if (ms <= 0) return "0:00";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChessClock({
  ms,
  active,
  low,
  label,
}: {
  ms: number;
  active: boolean;
  low?: boolean;
  label?: string;
}) {
  const flag = ms <= 0;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-sm tabular-nums transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_var(--primary)]"
          : "border-border bg-card text-muted-foreground",
        flag && "border-destructive bg-destructive/20 text-destructive-foreground",
        low && !flag && "text-[oklch(0.78_0.18_60)]",
      )}
      aria-label={label}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span className="font-semibold">{formatTime(ms)}</span>
    </div>
  );
}

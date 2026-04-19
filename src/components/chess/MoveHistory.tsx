import { memo,
 useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  sanHistory: string[];
  currentPly: number; // 0 = start; n = after n plies
  onJump: (ply: number) => void;
  pgn: string;
};

export const MoveHistory = memo(function MoveHistory({ sanHistory, currentPly, onJump, pgn }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [sanHistory.length]);

  const rows: { num: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < sanHistory.length; i += 2) {
    rows.push({ num: i / 2 + 1, white: sanHistory[i], black: sanHistory[i + 1] });
  }

  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      toast.success("PGN copied to clipboard");
    } catch {
      toast.error("Could not copy PGN");
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Moves
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyPgn} disabled={!sanHistory.length}>
          <Copy className="w-3 h-3 mr-1" /> PGN
        </Button>
      </div>
      <div ref={scrollRef} className="max-h-40 md:max-h-64 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No moves yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => {
                const wPly = (r.num - 1) * 2 + 1;
                const bPly = wPly + 1;
                return (
                  <tr key={r.num} className="border-b border-border/40 last:border-0">
                    <td className="w-10 px-2 py-1 text-xs text-muted-foreground tabular-nums">
                      {r.num}.
                    </td>
                    <td className="py-0.5">
                      {r.white && (
                        <button
                          onClick={() => onJump(wPly)}
                          className={cn(
                            "px-2 py-0.5 rounded font-mono text-xs transition-colors",
                            currentPly === wPly
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary",
                          )}
                        >
                          {r.white}
                        </button>
                      )}
                    </td>
                    <td className="py-0.5">
                      {r.black && (
                        <button
                          onClick={() => onJump(bPly)}
                          className={cn(
                            "px-2 py-0.5 rounded font-mono text-xs transition-colors",
                            currentPly === bPly
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary",
                          )}
                        >
                          {r.black}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
);

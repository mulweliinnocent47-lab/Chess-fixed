import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Piece = "q" | "r" | "b" | "n";

type Props = {
  open: boolean;
  color: "w" | "b";
  onChoose: (piece: Piece) => void;
  onCancel: () => void;
};

const PIECES: { type: Piece; label: string }[] = [
  { type: "q", label: "Queen" },
  { type: "r", label: "Rook" },
  { type: "b", label: "Bishop" },
  { type: "n", label: "Knight" },
];

export function PromotionDialog({ open, color, onChoose, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Promote pawn</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {PIECES.map((p) => (
            <button
              key={p.type}
              onClick={() => onChoose(p.type)}
              className="flex flex-col items-center gap-1 rounded-xl p-3 border border-border bg-secondary/40 hover:bg-secondary hover:border-primary transition-all hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <img
                src={`/pieces/${color}${p.type}.svg`}
                alt={p.label}
                width={56}
                height={56}
                className="w-14 h-14 drop-shadow-md"
              />
              <span className="text-xs font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

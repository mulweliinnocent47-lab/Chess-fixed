import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BotPicker } from "@/components/chess/BotPicker";
import { PageTransition } from "@/components/PageTransition";
import { useGameState } from "@/lib/chess/gameContext";

function BotsPage() {
  const { botIdx, setBotIdx } = useGameState();
  const navigate = useNavigate();

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-3 py-4 flex flex-col items-center">
        <header className="w-full max-w-md flex items-center gap-2 mb-4">
          <Link
            to="/"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Choose Opponent</h1>
        </header>

        <div className="w-full max-w-md space-y-3">
          <BotPicker level={botIdx} onChange={setBotIdx} />
          <button
            onClick={() => navigate("/play")}
            className="btn-primary-glow w-full h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center"
          >
            Start Game
          </button>
        </div>
      </main>
    </PageTransition>
  );
}

export default BotsPage;

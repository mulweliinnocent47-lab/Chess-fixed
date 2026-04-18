import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Trophy, Play } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { PreGameDialog } from "@/components/chess/PreGameDialog";
import { useGameState, type Color } from "@/lib/chess/gameContext";
import { loadHistory } from "@/lib/chess/history";
import { loadProfile } from "@/lib/chess/profile";
import { loadGems } from "@/lib/chess/gems";
import { loadDailyStreak, loadRushBest } from "@/lib/chess/streaks";
import { applyActiveTheme } from "@/lib/chess/boardThemes";
import { PlayerHeader } from "@/components/home/PlayerHeader";
import { ContinuePlayingCard } from "@/components/home/ContinuePlayingCard";
import { DailyPuzzleCard } from "@/components/home/DailyPuzzleCard";
import { ProgressCard } from "@/components/home/ProgressCard";

function HomePage() {
  const navigate = useNavigate();
  const { botIdx, setBotIdx, playerColor, setPlayerColor, pgn } = useGameState();

  const [profile, setProfile] = useState(() => loadProfile());
  const [gems, setGems] = useState<number>(() => loadGems());
  const [dailyStreak, setDailyStreak] = useState<number>(() => loadDailyStreak());
  const [rushBest, setRushBest] = useState(() => loadRushBest());
  const [setupOpen, setSetupOpen] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());

  // Apply selected board theme on mount
  useEffect(() => {
    applyActiveTheme();
  }, []);

  useEffect(() => {
    const refresh = () => {
      setProfile(loadProfile());
      setGems(loadGems());
      setDailyStreak(loadDailyStreak());
      setRushBest(loadRushBest());
      setHistory(loadHistory());
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("profile-changed", refresh);
    window.addEventListener("gems-changed", refresh);
    window.addEventListener("streak-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("profile-changed", refresh);
      window.removeEventListener("gems-changed", refresh);
      window.removeEventListener("streak-changed", refresh);
    };
  }, []);

  const wins = history.filter((h) => h.outcome === "win").length;

  // Win-streak from history (latest contiguous wins)
  let winStreak = 0;
  for (const g of history) {
    if (g.outcome === "win") winStreak++;
    else break;
  }

  const startGame = (b: number, c: Color) => {
    setBotIdx(b);
    setPlayerColor(c);
    setSetupOpen(false);
    navigate("/play");
  };

  const handleResume = () => navigate("/play");
  const handleStart = () => setSetupOpen(true);

  // Player has an active game if we have saved PGN
  const hasActiveGame = !!pgn;

  // Display streak: prefer rush score (more meaningful), fallback to daily streak or win streak
  const displayStreak = Math.max(winStreak, dailyStreak, rushBest.streak);

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 pb-10">
        <div className="mx-auto w-full max-w-md flex flex-col gap-4">
          <PlayerHeader
            name={profile.name}
            rating={profile.rating}
            streak={displayStreak}
            gems={gems}
            avatar={profile.avatar}
          />

          <ContinuePlayingCard
            last={history[0] ?? null}
            hasActiveGame={hasActiveGame}
            onResume={handleResume}
            onStart={handleStart}
          />

          <DailyPuzzleCard streak={dailyStreak} />

          <ProgressCard
            ratingFrom={profile.rating}
            ratingTo={profile.rating + Math.min(20, wins)}
            accuracy={79}
            gamesPlayed={history.length}
          />

          {/* Footer actions */}
          <section
            className="rounded-2xl p-4 border border-border"
            style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4" style={{ color: "var(--amber)" }} />
              <h3 className="text-sm font-bold tracking-tight">More to explore</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/tournaments"
                className="h-11 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border border-border"
                style={{ background: "oklch(1 0 0 / 0.04)" }}
              >
                <Trophy className="w-4 h-4" /> Tournaments
              </Link>
              <Link
                to="/puzzle-rush"
                className="h-11 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border border-border"
                style={{ background: "oklch(1 0 0 / 0.04)" }}
              >
                <Play className="w-4 h-4" /> Challenges
              </Link>
            </div>
          </section>
        </div>

        <PreGameDialog
          open={setupOpen}
          initialBotIdx={botIdx}
          initialColor={playerColor}
          onCancel={() => setSetupOpen(false)}
          onConfirm={startGame}
        />
      </main>
    </PageTransition>
  );
}

export default HomePage;

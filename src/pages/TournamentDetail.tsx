import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trophy, Play, RotateCcw, Crown, Lock } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import {
  applyResult,
  clearTournament,
  createTournament,
  getDef,
  getStandings,
  isTournamentUnlocked,
  loadAllTournaments,
  PLAYER_ID,
  participantName,
  previousTournament,
  saveTournament,
  simulateBotGame,
  type TournamentKind,
  type TournamentState,
} from "@/lib/chess/tournaments";
import { BOTS } from "@/lib/chess/bots";
import { useGameState } from "@/lib/chess/gameContext";

function TournamentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const def = getDef(id as TournamentKind);
  const { setTournament, setBotIdx, setPlayerColor, setPgn } = useGameState();

  const [state, setState] = useState<TournamentState | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const all = loadAllTournaments();
    if (!isTournamentUnlocked(id as TournamentKind, all)) {
      setLocked(true);
      return;
    }
    const existing = all[id as TournamentKind];
    setState(existing ?? createTournament(def));
  }, [id, def]);

  const standings = useMemo(() => (state ? getStandings(state) : []), [state]);

  if (!def) {
    return (
      <PageTransition>
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center">
            <p>Tournament not found.</p>
            <Link to="/tournaments" className="btn-soft inline-flex items-center px-3 py-2 rounded-lg mt-3">
              Back
            </Link>
          </div>
        </main>
      </PageTransition>
    );
  }

  if (locked) {
    const prevId = previousTournament(id as TournamentKind);
    const prevName = prevId ? getDef(prevId).name : null;
    return (
      <PageTransition>
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center rounded-2xl bg-card border border-border p-6"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-secondary">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-bold">{def.name} is locked</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {prevName ? <>Win <span className="font-semibold text-foreground">{prevName}</span> first to unlock this tournament.</> : "Complete the previous tournament first."}
            </p>
            <Link to="/tournaments" className="btn-primary-glow inline-flex items-center justify-center px-4 py-2 rounded-lg mt-4 text-sm font-semibold">
              Back to tournaments
            </Link>
          </div>
        </main>
      </PageTransition>
    );
  }

  if (!state) return null;

  const startNext = () => {
    if (state.finished) return;
    let s = state;
    // Auto-simulate any bot-vs-bot games scheduled before the player's next game
    while (
      s.currentIdx < s.schedule.length &&
      s.schedule[s.currentIdx].white !== PLAYER_ID &&
      s.schedule[s.currentIdx].black !== PLAYER_ID
    ) {
      const g = s.schedule[s.currentIdx];
      const r = simulateBotGame(g.white, g.black);
      s = applyResult(s, s.currentIdx, r);
    }
    saveTournament(s);
    setState(s);
    if (s.finished) return;

    const game = s.schedule[s.currentIdx];
    const playerIsWhite = game.white === PLAYER_ID;
    const opponentIdx = playerIsWhite ? game.black : game.white;
    const totalRounds = Math.max(...s.schedule.map((g) => g.round));

    setBotIdx(opponentIdx);
    setPlayerColor(playerIsWhite ? "white" : "black");
    setPgn(null);
    setTournament({
      id: def.id,
      scheduleIdx: s.currentIdx,
      playerColor: playerIsWhite ? "white" : "black",
      opponentIdx,
      timeControl: def.timeControl,
      roundLabel: `Round ${game.round} of ${totalRounds}`,
    });
    navigate("/play");
  };

  const reset = () => {
    clearTournament(def.id);
    setState(createTournament(def));
  };

  const nextGame = state.schedule[state.currentIdx];
  const winner = state.finished ? standings[0] : null;

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 flex flex-col items-center">
        <div className="w-full max-w-md md:max-w-2xl">
          <header className="flex items-center gap-2 mb-4">
            <Link
              to="/tournaments"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight leading-none truncate">
                {def.emoji} {def.name}
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ⏱ {Math.floor(def.timeControl.initial / 60)}+{def.timeControl.increment} ·{" "}
                {def.format === "best-of" ? `Best of ${def.bestOf}` : def.doubleRound ? "Double round-robin" : "Round-robin"}
              </p>
            </div>
            <button
              onClick={reset}
              className="btn-soft h-9 px-3 rounded-lg text-xs inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </header>

          {winner && (
            <div
              className="mb-4 rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "var(--gradient-accent)" }}
              >
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Champion</div>
                <div className="text-xl font-bold">{winner.name}</div>
                <div className="text-xs text-muted-foreground">
                  {winner.points} {winner.points === 1 ? "point" : "points"}
                </div>
              </div>
            </div>
          )}

          {!state.finished && nextGame && (
            <div
              className="mb-4 rounded-2xl bg-card border border-border p-4"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Up next · Round {nextGame.round}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Side id={nextGame.white} color="white" />
                <span className="text-xs text-muted-foreground">vs</span>
                <Side id={nextGame.black} color="black" />
              </div>
              <button
                onClick={startNext}
                className="btn-primary-glow w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 mt-3"
              >
                <Play className="w-4 h-4" />
                {nextGame.white === PLAYER_ID || nextGame.black === PLAYER_ID
                  ? "Play this round"
                  : "Continue (sim)"}
              </button>
            </div>
          )}

          <section
            className="rounded-2xl bg-card border border-border overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="px-4 py-2.5 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Standings
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-3 py-2 w-8">#</th>
                  <th className="text-left font-medium px-2 py-2">Player</th>
                  <th className="text-right font-medium px-2 py-2">Rating</th>
                  <th className="text-right font-medium px-2 py-2">Played</th>
                  <th className="text-right font-medium px-3 py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border/50 last:border-0 ${
                      row.id === PLAYER_ID ? "bg-primary/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2 font-medium truncate">
                      {row.id === PLAYER_ID ? "★ You" : row.name}
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                      {row.rating}
                    </td>
                    <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                      {row.played}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            className="mt-4 rounded-2xl bg-card border border-border overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="px-4 py-2.5 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Schedule
            </div>
            <ul className="divide-y divide-border/50 max-h-72 overflow-auto">
              {state.schedule.map((g, i) => {
                const isPlayer = g.white === PLAYER_ID || g.black === PLAYER_ID;
                const upcoming = g.result === null;
                const current = i === state.currentIdx;
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 text-xs ${
                      current ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground w-10 tabular-nums">
                      R{g.round}
                    </span>
                    <span className={`flex-1 truncate ${isPlayer ? "font-medium" : ""}`}>
                      {participantName(g.white)} <span className="text-muted-foreground">vs</span>{" "}
                      {participantName(g.black)}
                    </span>
                    {upcoming ? (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    ) : (
                      <span className="font-mono tabular-nums">{g.result}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </PageTransition>
  );
}

function Side({ id, color }: { id: number; color: "white" | "black" }) {
  const isPlayer = id === PLAYER_ID;
  const bot = isPlayer ? null : BOTS[id];
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <div className="w-9 h-9 rounded-full bg-secondary border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {bot ? (
          <img src={bot.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-base">★</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{isPlayer ? "You" : bot!.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {color === "white" ? "♔ White" : "♚ Black"}
          {bot && ` · ${bot.rating}`}
        </div>
      </div>
    </div>
  );
}

export default TournamentDetailPage;

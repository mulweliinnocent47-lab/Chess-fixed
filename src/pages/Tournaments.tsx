import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Trophy, Play, RotateCcw, Sparkles, Lock } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import {
  TOURNAMENTS,
  loadAllTournaments,
  isTournamentUnlocked,
  previousTournament,
  getDef,
  type TournamentKind,
  type TournamentState,
} from "@/lib/chess/tournaments";
import { BOTS } from "@/lib/chess/bots";

function TournamentsPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Partial<Record<TournamentKind, TournamentState>>>({});

  useEffect(() => {
    setSaved(loadAllTournaments());
  }, []);

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 flex flex-col items-center">
        <div className="w-full max-w-md md:max-w-2xl">
          <header className="flex items-center gap-2 mb-5">
            <Link
              to="/"
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
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Tournaments</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">Compete for the title</p>
            </div>
          </header>

          <div className="flex flex-col gap-3">
            {TOURNAMENTS.map((t) => {
              const state = saved[t.id];
              const inProgress = state && !state.finished;
              const totalGames = state?.schedule.length ?? 0;
              const playedGames = state?.schedule.filter((g) => g.result !== null).length ?? 0;
              const unlocked = isTournamentUnlocked(t.id, saved);
              const prevId = previousTournament(t.id);
              const prevName = prevId ? getDef(prevId).name : null;
              return (
                <article
                  key={t.id}
                  className={`relative rounded-2xl bg-card border border-border p-4 transition-opacity ${
                    unlocked ? "" : "opacity-60"
                  }`}
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl leading-none relative">
                      {unlocked ? (
                        t.emoji
                      ) : (
                        <span className="grayscale">{t.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold leading-tight">{t.name}</h2>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                          {t.subtitle}
                        </span>
                        {!unlocked && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border bg-secondary rounded-full px-1.5 py-0.5 inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span>⏱ {Math.floor(t.timeControl.initial / 60)}+{t.timeControl.increment}</span>
                        <span>
                          {t.format === "best-of"
                            ? `Best of ${t.bestOf}`
                            : t.doubleRound
                              ? "Double round-robin"
                              : "Round-robin"}
                        </span>
                        <span>
                          {t.format === "best-of"
                            ? `vs ${BOTS[t.botIndices[0]].name}`
                            : `${t.botIndices.length + 1} players`}
                        </span>
                      </div>

                      {!unlocked && prevName && (
                        <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                          <Lock className="w-3 h-3" /> Win <span className="font-semibold text-foreground">{prevName}</span> to unlock
                        </div>
                      )}

                      {unlocked && inProgress && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${(playedGames / totalGames) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {playedGames}/{totalGames}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            if (!unlocked) return;
                            navigate(`/tournament/${t.id}`);
                          }}
                          disabled={!unlocked}
                          className="btn-primary-glow flex-1 h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {!unlocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Locked
                            </>
                          ) : inProgress ? (
                            <>
                              <Play className="w-3.5 h-3.5" /> Continue
                            </>
                          ) : state?.finished ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5" /> View results
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" /> Enter
                            </>
                          )}
                        </button>
                        {unlocked && state && (
                          <button
                            onClick={() => {
                              const all = loadAllTournaments();
                              delete all[t.id];
                              localStorage.setItem(
                                "chess-tournaments-v1",
                                JSON.stringify(all),
                              );
                              setSaved({ ...all });
                            }}
                            className="btn-soft h-9 px-3 rounded-lg text-xs inline-flex items-center justify-center gap-1.5"
                            aria-label="Reset tournament"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </PageTransition>
  );
}

export default TournamentsPage;

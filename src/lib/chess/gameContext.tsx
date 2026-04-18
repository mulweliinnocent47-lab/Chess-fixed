import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { TimeControl } from "@/lib/chess/useClock";

export type Color = "white" | "black";

export type TournamentLink = {
  id: string;
  scheduleIdx: number;
  /** color the player plays in this game */
  playerColor: Color;
  /** opponent bot index */
  opponentIdx: number;
  /** time control for this game */
  timeControl: TimeControl;
  /** display label e.g. "Round 3 of 7" */
  roundLabel: string;
};

type GameState = {
  botIdx: number;
  playerColor: Color;
  pgn: string | null; // saved PGN of in-progress game
  /** active tournament game (transient — not persisted across sessions) */
  tournament: TournamentLink | null;
  /** chosen casual time control from the home screen */
  timeControl: TimeControl;
};

type GameContextValue = GameState & {
  setBotIdx: (i: number) => void;
  setPlayerColor: (c: Color) => void;
  setPgn: (pgn: string | null) => void;
  setTournament: (t: TournamentLink | null) => void;
  setTimeControl: (tc: TimeControl) => void;
};

const STORAGE_KEY = "chess-app-state-v1";

const GameContext = createContext<GameContextValue | null>(null);

const DEFAULT_TC: TimeControl = { initial: 600, increment: 5 };

function readInitial(): GameState {
  if (typeof window === "undefined") {
    return { botIdx: 2, playerColor: "white", pgn: null, tournament: null, timeControl: DEFAULT_TC };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameState>;
      const tc = parsed.timeControl;
      const validTc =
        tc && typeof tc.initial === "number" && typeof tc.increment === "number"
          ? { initial: tc.initial, increment: tc.increment }
          : DEFAULT_TC;
      return {
        botIdx: typeof parsed.botIdx === "number" ? parsed.botIdx : 2,
        playerColor: parsed.playerColor === "black" ? "black" : "white",
        pgn: typeof parsed.pgn === "string" ? parsed.pgn : null,
        tournament: null,
        timeControl: validTc,
      };
    }
  } catch {
    /* ignore */
  }
  return { botIdx: 2, playerColor: "white", pgn: null, tournament: null, timeControl: DEFAULT_TC };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(() => readInitial());

  useEffect(() => {
    try {
      // Don't persist tournament link
      const { tournament: _t, ...persist } = state;
      void _t;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch {
      /* ignore */
    }
  }, [state]);

  const value: GameContextValue = {
    ...state,
    setBotIdx: (i) => setState((s) => ({ ...s, botIdx: i })),
    setPlayerColor: (c) => setState((s) => ({ ...s, playerColor: c })),
    setPgn: (pgn) => setState((s) => ({ ...s, pgn })),
    setTournament: (t) => setState((s) => ({ ...s, tournament: t })),
    setTimeControl: (tc) => setState((s) => ({ ...s, timeControl: tc })),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameState() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameState must be used within GameProvider");
  return ctx;
}

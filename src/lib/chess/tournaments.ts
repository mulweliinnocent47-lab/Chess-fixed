import { BOTS } from "./bots";

export type TournamentKind = "local" | "elite" | "candidates" | "championship";

export type TournamentDef = {
  id: TournamentKind;
  name: string;
  subtitle: string;
  description: string;
  emoji: string;
  /** indices into BOTS array */
  botIndices: number[];
  /** in seconds + increment */
  timeControl: { initial: number; increment: number };
  format: "round-robin" | "double-round-robin" | "best-of";
  /** for best-of: number of games */
  bestOf?: number;
  /** if true, double round-robin (play each opponent twice) */
  doubleRound?: boolean;
};

// Pick bots by approximate rating buckets
const idxByName = (n: string) => BOTS.findIndex((b) => b.name === n);

export const TOURNAMENTS: TournamentDef[] = [
  {
    id: "local",
    name: "Local Club Tournament",
    subtitle: "Easy entry",
    description: "Round-robin against 7 club-level bots. Win = 1, Draw = ½, Loss = 0.",
    emoji: "🥉",
    botIndices: [
      idxByName("Mia"),
      idxByName("Theo"),
      idxByName("Leo"),
      idxByName("Zara"),
      idxByName("Nora"),
      idxByName("Marco"),
      idxByName("Elena"),
    ],
    timeControl: { initial: 600, increment: 5 },
    format: "round-robin",
  },
  {
    id: "elite",
    name: "Elite Tournament",
    subtitle: "Tata Steel style",
    description: "Round-robin with stronger opposition. Full standings table.",
    emoji: "🥈",
    botIndices: [
      idxByName("Zara"),
      idxByName("Nora"),
      idxByName("Marco"),
      idxByName("Elena"),
      idxByName("Hiro"),
      idxByName("Viktor"),
      idxByName("Sofia"),
    ],
    timeControl: { initial: 600, increment: 5 },
    format: "round-robin",
  },
  {
    id: "candidates",
    name: "Candidates Tournament",
    subtitle: "Two phases",
    description: "Double round-robin. Face every challenger twice — winner earns the title shot.",
    emoji: "🥇",
    botIndices: [
      idxByName("Marco"),
      idxByName("Elena"),
      idxByName("Hiro"),
      idxByName("Viktor"),
      idxByName("Sofia"),
      idxByName("Nyx"),
      idxByName("Kasparov"),
    ],
    timeControl: { initial: 600, increment: 5 },
    format: "double-round-robin",
    doubleRound: true,
  },
  {
    id: "championship",
    name: "World Championship",
    subtitle: "Final boss",
    description: "Best of 8 against Kasparov (2850). 15-minute games. Win the match.",
    emoji: "👑",
    botIndices: [idxByName("Kasparov")],
    timeControl: { initial: 900, increment: 0 },
    format: "best-of",
    bestOf: 8,
  },
];

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

export type TournamentGame = {
  round: number;
  white: number; // bot index OR -1 = player
  black: number;
  result: GameResult | null;
};

export type TournamentState = {
  id: TournamentKind;
  startedAt: number;
  schedule: TournamentGame[];
  currentIdx: number; // index into schedule
  /** points map by participant id (-1 = player, otherwise bot index) */
  points: Record<string, number>;
  /** completed games count per participant */
  played: Record<string, number>;
  finished: boolean;
};

export const PLAYER_ID = -1;

/** Build round-robin schedule using circle method. -1 represents the player. */
function buildRoundRobin(participants: number[], double = false): TournamentGame[] {
  const list = [...participants];
  if (list.length % 2 === 1) list.push(-2); // bye marker
  const n = list.length;
  const rounds = n - 1;
  const games: TournamentGame[] = [];
  const arr = [...list];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === -2 || b === -2) continue;
      // Alternate colors
      const white = (r + i) % 2 === 0 ? a : b;
      const black = white === a ? b : a;
      games.push({ round: r + 1, white, black, result: null });
    }
    // rotate (keep first fixed)
    arr.splice(1, 0, arr.pop()!);
  }
  if (double) {
    const second = games.map((g) => ({
      round: g.round + rounds,
      white: g.black,
      black: g.white,
      result: null,
    }));
    return [...games, ...second];
  }
  return games;
}

export function createTournament(def: TournamentDef): TournamentState {
  let schedule: TournamentGame[];
  const participants = [PLAYER_ID, ...def.botIndices];

  if (def.format === "best-of") {
    const opponent = def.botIndices[0];
    const n = def.bestOf ?? 6;
    schedule = Array.from({ length: n }, (_, i) => ({
      round: i + 1,
      white: i % 2 === 0 ? PLAYER_ID : opponent,
      black: i % 2 === 0 ? opponent : PLAYER_ID,
      result: null,
    }));
  } else {
    schedule = buildRoundRobin(participants, !!def.doubleRound);
  }

  // Sort so player games come first within each round (so the user always plays first)
  const grouped: Record<number, TournamentGame[]> = {};
  for (const g of schedule) {
    grouped[g.round] = grouped[g.round] || [];
    grouped[g.round].push(g);
  }
  const ordered: TournamentGame[] = [];
  Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((r) => {
      const games = grouped[r];
      const playerGames = games.filter((g) => g.white === PLAYER_ID || g.black === PLAYER_ID);
      const otherGames = games.filter((g) => g.white !== PLAYER_ID && g.black !== PLAYER_ID);
      ordered.push(...playerGames, ...otherGames);
    });

  const points: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (const p of participants) {
    points[String(p)] = 0;
    played[String(p)] = 0;
  }

  return {
    id: def.id,
    startedAt: Date.now(),
    schedule: ordered,
    currentIdx: 0,
    points,
    played,
    finished: false,
  };
}

export function applyResult(state: TournamentState, idx: number, result: GameResult): TournamentState {
  const next: TournamentState = {
    ...state,
    schedule: state.schedule.map((g, i) => (i === idx ? { ...g, result } : g)),
    points: { ...state.points },
    played: { ...state.played },
  };
  const g = next.schedule[idx];
  const w = String(g.white);
  const b = String(g.black);
  next.played[w] = (next.played[w] ?? 0) + 1;
  next.played[b] = (next.played[b] ?? 0) + 1;
  if (result === "1-0") next.points[w] = (next.points[w] ?? 0) + 1;
  else if (result === "0-1") next.points[b] = (next.points[b] ?? 0) + 1;
  else {
    next.points[w] = (next.points[w] ?? 0) + 0.5;
    next.points[b] = (next.points[b] ?? 0) + 0.5;
  }
  // Advance pointer to next unplayed game
  let nextIdx = next.currentIdx;
  while (nextIdx < next.schedule.length && next.schedule[nextIdx].result !== null) nextIdx++;
  next.currentIdx = nextIdx;
  if (nextIdx >= next.schedule.length) next.finished = true;
  return next;
}

/** Simulated result for bot vs bot games — weighted by rating diff. */
export function simulateBotGame(whiteIdx: number, blackIdx: number): GameResult {
  const wRating = BOTS[whiteIdx].rating + 25; // small white edge
  const bRating = BOTS[blackIdx].rating;
  const expected = 1 / (1 + Math.pow(10, (bRating - wRating) / 400));
  const r = Math.random();
  // Add a draw zone proportional to closeness
  const drawZone = 0.18 - Math.min(0.12, Math.abs(expected - 0.5) * 0.3);
  if (r < expected - drawZone / 2) return "1-0";
  if (r > expected + drawZone / 2) return "0-1";
  return "1/2-1/2";
}

export function participantName(id: number): string {
  if (id === PLAYER_ID) return "You";
  return BOTS[id]?.name ?? "Bot";
}

export function participantRating(id: number): number {
  if (id === PLAYER_ID) return 1500;
  return BOTS[id]?.rating ?? 0;
}

export function getStandings(state: TournamentState) {
  const ids = Object.keys(state.points).map(Number);
  return ids
    .map((id) => ({
      id,
      name: participantName(id),
      rating: participantRating(id),
      points: state.points[String(id)] ?? 0,
      played: state.played[String(id)] ?? 0,
    }))
    .sort((a, b) => b.points - a.points || b.rating - a.rating);
}

// ---------- Persistence ----------

const STORAGE_KEY = "chess-tournaments-v1";

export function loadAllTournaments(): Partial<Record<TournamentKind, TournamentState>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveTournament(state: TournamentState) {
  if (typeof window === "undefined") return;
  const all = loadAllTournaments();
  all[state.id] = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function clearTournament(id: TournamentKind) {
  if (typeof window === "undefined") return;
  const all = loadAllTournaments();
  delete all[id];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getDef(id: TournamentKind): TournamentDef {
  return TOURNAMENTS.find((t) => t.id === id)!;
}

// ---------- Progression unlocks ----------
// Each tournament unlocks the next one only if the player WON the previous.
// Player wins a round-robin / double-round-robin if they finish 1st in standings.
// Player wins a best-of match if they have strictly more points than the opponent.
const UNLOCK_ORDER: TournamentKind[] = ["local", "elite", "candidates", "championship"];

export function playerWonTournament(state: TournamentState | undefined): boolean {
  if (!state || !state.finished) return false;
  const standings = getStandings(state);
  if (standings.length === 0) return false;
  const top = standings[0];
  // Sole leader and it's the player
  const playerEntry = standings.find((s) => s.id === PLAYER_ID);
  if (!playerEntry) return false;
  return top.id === PLAYER_ID && top.points > (standings[1]?.points ?? -1);
}

export function isTournamentUnlocked(
  id: TournamentKind,
  saved: Partial<Record<TournamentKind, TournamentState>>,
): boolean {
  const idx = UNLOCK_ORDER.indexOf(id);
  if (idx <= 0) return true; // first one always unlocked
  const prevId = UNLOCK_ORDER[idx - 1];
  return playerWonTournament(saved[prevId]);
}

export function previousTournament(id: TournamentKind): TournamentKind | null {
  const idx = UNLOCK_ORDER.indexOf(id);
  if (idx <= 0) return null;
  return UNLOCK_ORDER[idx - 1];
}

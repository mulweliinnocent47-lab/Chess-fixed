export type GameHistoryEntry = {
  id: string;
  date: number; // ms epoch
  outcome: "win" | "loss" | "draw";
  reason: string;
  moves: number;
  botName: string;
  botRating: number;
  playerColor: "white" | "black";
  timeControl: { initial: number; increment: number };
};

const KEY = "chess-app-history-v1";
const MAX = 50;

export function loadHistory(): GameHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry: Omit<GameHistoryEntry, "id" | "date">) {
  if (typeof window === "undefined") return;
  const list = loadHistory();
  const next: GameHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: Date.now(),
  };
  const merged = [next, ...list].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

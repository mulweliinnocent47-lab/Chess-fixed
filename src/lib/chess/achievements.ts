import { loadHistory, type GameHistoryEntry } from "./history";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide name
  tier: "bronze" | "silver" | "gold" | "legend";
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood",     title: "First Blood",       description: "Win your first game",                    icon: "Swords",     tier: "bronze" },
  { id: "five-wins",       title: "Getting Started",   description: "Win 5 games",                            icon: "Trophy",     tier: "bronze" },
  { id: "twenty-wins",     title: "On a Roll",         description: "Win 20 games",                           icon: "Medal",      tier: "silver" },
  { id: "fifty-wins",      title: "Veteran",           description: "Win 50 games",                           icon: "Crown",      tier: "gold" },
  { id: "streak-3",        title: "Hat Trick",         description: "Win 3 games in a row",                   icon: "Flame",      tier: "bronze" },
  { id: "streak-5",        title: "Unstoppable",       description: "Win 5 games in a row",                   icon: "Flame",      tier: "silver" },
  { id: "streak-10",       title: "Dominator",         description: "Win 10 games in a row",                  icon: "Flame",      tier: "gold" },
  { id: "quick-mate",      title: "Quick Mate",        description: "Win in under 15 moves",                  icon: "Zap",        tier: "silver" },
  { id: "perfect-game",    title: "Brilliant Mind",    description: "Win a game with 95%+ accuracy",          icon: "Sparkles",   tier: "gold" },
  { id: "giant-slayer",    title: "Giant Slayer",      description: "Beat a bot rated 2000+",                 icon: "Shield",     tier: "gold" },
  { id: "world-champ",     title: "World Champion",    description: "Beat the 2850 World Champion bot",       icon: "Award",      tier: "legend" },
  { id: "comeback",        title: "Comeback Kid",      description: "Win after losing material early",        icon: "TrendingUp", tier: "silver" },
  { id: "iron-king",       title: "Iron King",         description: "Win without losing a single piece",      icon: "ShieldCheck",tier: "gold" },
  { id: "blitz-master",    title: "Blitz Master",      description: "Win 10 blitz/bullet games",              icon: "Timer",      tier: "silver" },
  { id: "explorer",        title: "Explorer",          description: "Play against 5 different bots",          icon: "Compass",    tier: "bronze" },
  { id: "marathoner",      title: "Marathoner",        description: "Play 100 games total",                   icon: "Activity",   tier: "gold" },
];

const KEY = "chess-app-achievements-v1";

type Store = { unlocked: Record<string, number> }; // id -> unlocked timestamp

function read(): Store {
  if (typeof window === "undefined") return { unlocked: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { unlocked: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { unlocked: parsed.unlocked ?? {} } : { unlocked: {} };
  } catch {
    return { unlocked: {} };
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getUnlocked(): Record<string, number> {
  return read().unlocked;
}

export function isUnlocked(id: string): boolean {
  return id in read().unlocked;
}

/**
 * Evaluate which achievements should be unlocked given the latest game.
 * Returns the *newly* unlocked achievements (so the caller can toast them).
 */
export type EvalCtx = {
  outcome: "win" | "loss" | "draw";
  moves: number;
  accuracyPlayer: number;
  botRating: number;
  botName: string;
  timeControl: { initial: number; increment: number };
  /** optional richer signals */
  lostPieces?: number;
  earlyMaterialDeficit?: boolean;
};

export function evaluateAfterGame(ctx: EvalCtx): Achievement[] {
  const store = read();
  const history: GameHistoryEntry[] = loadHistory();
  const unlocked = { ...store.unlocked };
  const newly: Achievement[] = [];

  const has = (id: string) => id in unlocked;
  const unlock = (id: string) => {
    if (has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    unlocked[id] = Date.now();
    newly.push(a);
  };

  const wins = history.filter((h) => h.outcome === "win").length;
  const total = history.length;

  // Win-count tiers
  if (ctx.outcome === "win") {
    if (wins >= 1)  unlock("first-blood");
    if (wins >= 5)  unlock("five-wins");
    if (wins >= 20) unlock("twenty-wins");
    if (wins >= 50) unlock("fifty-wins");
  }
  if (total >= 100) unlock("marathoner");

  // Streaks (history is newest-first; the latest game is already in history)
  if (ctx.outcome === "win") {
    let streak = 0;
    for (const g of history) {
      if (g.outcome === "win") streak++;
      else break;
    }
    if (streak >= 3)  unlock("streak-3");
    if (streak >= 5)  unlock("streak-5");
    if (streak >= 10) unlock("streak-10");
  }

  // Single-game achievements (only on win)
  if (ctx.outcome === "win") {
    if (ctx.moves > 0 && ctx.moves < 15) unlock("quick-mate");
    if (ctx.accuracyPlayer >= 95) unlock("perfect-game");
    if (ctx.botRating >= 2000) unlock("giant-slayer");
    if (ctx.botRating >= 2850) unlock("world-champ");
    if (ctx.earlyMaterialDeficit) unlock("comeback");
    if (ctx.lostPieces === 0) unlock("iron-king");
  }

  // Variety
  const distinctBots = new Set(history.map((h) => h.botName));
  if (distinctBots.size >= 5) unlock("explorer");

  // Blitz/bullet wins
  if (ctx.outcome === "win") {
    const fastWins = history.filter(
      (h) => h.outcome === "win" && h.timeControl.initial <= 300,
    ).length;
    if (fastWins >= 10) unlock("blitz-master");
  }

  if (newly.length) write({ unlocked });
  return newly;
}

export function progressSummary() {
  const u = getUnlocked();
  return { unlocked: Object.keys(u).length, total: ACHIEVEMENTS.length };
}

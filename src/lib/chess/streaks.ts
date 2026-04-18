// Tracks daily-puzzle solving streak (consecutive days).
const DAILY_KEY = "chess-daily-puzzle-streak-v1";

type DailyStreak = { streak: number; lastDate: string };

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadDailyStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw) as DailyStreak;
    // Reset if more than 1 day since last solve
    if (s.lastDate !== todayKey() && s.lastDate !== yesterdayKey()) return 0;
    return s.streak ?? 0;
  } catch {
    return 0;
  }
}

/** Mark today's puzzle solved; bump streak if not already counted today. */
export function markDailySolved(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    const today = todayKey();
    if (raw) {
      const s = JSON.parse(raw) as DailyStreak;
      if (s.lastDate === today) return s.streak; // already counted
      const continuation = s.lastDate === yesterdayKey();
      const next: DailyStreak = {
        streak: continuation ? (s.streak ?? 0) + 1 : 1,
        lastDate: today,
      };
      localStorage.setItem(DAILY_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("streak-changed"));
      return next.streak;
    }
    const next: DailyStreak = { streak: 1, lastDate: today };
    localStorage.setItem(DAILY_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("streak-changed"));
    return 1;
  } catch {
    return 0;
  }
}

/** Read the all-time best Puzzle Rush score, used as a "rush streak" indicator. */
export function loadRushBest(): { score: number; streak: number } {
  if (typeof window === "undefined") return { score: 0, streak: 0 };
  try {
    const raw = localStorage.getItem("chess-puzzle-rush-best-v1");
    if (!raw) return { score: 0, streak: 0 };
    const v = JSON.parse(raw);
    return { score: Number(v.score ?? 0), streak: Number(v.streak ?? 0) };
  } catch {
    return { score: 0, streak: 0 };
  }
}

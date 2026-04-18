const KEY = "chess-app-gems-v1";

export function loadGems(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Math.max(0, Number(JSON.parse(raw))) : 0;
  } catch {
    return 0;
  }
}

export function saveGems(n: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(Math.max(0, Math.floor(n))));
    window.dispatchEvent(new CustomEvent("gems-changed"));
  } catch {
    /* ignore */
  }
}

export function addGems(delta: number): number {
  const next = loadGems() + Math.floor(delta);
  saveGems(next);
  return next;
}

export function spendGems(cost: number): boolean {
  const cur = loadGems();
  if (cur < cost) return false;
  saveGems(cur - cost);
  return true;
}

/** 3-11 gems for a win, scaled by opponent rating. */
export function gemsForWin(botRating: number): number {
  const base = 3;
  const bonus = Math.min(8, Math.max(0, Math.round((botRating - 400) / 150)));
  return base + bonus;
}

/** small gems for solving puzzles */
export function gemsForPuzzle(): number {
  return 1;
}

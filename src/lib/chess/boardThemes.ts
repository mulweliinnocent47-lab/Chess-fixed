export type BoardTheme = {
  id: string;
  name: string;
  /** gem cost; 0 means free/default */
  price: number;
  light: string;
  dark: string;
  /** preview swatch gradient */
  preview: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "classic",
    name: "Classic",
    price: 0,
    light: "oklch(0.86 0.04 230)",
    dark: "oklch(0.55 0.08 240)",
    preview: "linear-gradient(135deg, oklch(0.86 0.04 230), oklch(0.55 0.08 240))",
  },
  {
    id: "emerald",
    name: "Emerald",
    price: 120,
    light: "oklch(0.92 0.04 130)",
    dark: "oklch(0.45 0.12 150)",
    preview: "linear-gradient(135deg, oklch(0.92 0.04 130), oklch(0.45 0.12 150))",
  },
  {
    id: "sunset",
    name: "Sunset",
    price: 220,
    light: "oklch(0.93 0.05 80)",
    dark: "oklch(0.55 0.16 35)",
    preview: "linear-gradient(135deg, oklch(0.93 0.05 80), oklch(0.55 0.16 35))",
  },
  {
    id: "rose",
    name: "Rose Quartz",
    price: 320,
    light: "oklch(0.93 0.04 20)",
    dark: "oklch(0.5 0.14 0)",
    preview: "linear-gradient(135deg, oklch(0.93 0.04 20), oklch(0.5 0.14 0))",
  },
  {
    id: "midnight",
    name: "Midnight",
    price: 450,
    light: "oklch(0.55 0.06 260)",
    dark: "oklch(0.22 0.06 270)",
    preview: "linear-gradient(135deg, oklch(0.55 0.06 260), oklch(0.22 0.06 270))",
  },
  {
    id: "neon",
    name: "Neon",
    price: 600,
    light: "oklch(0.85 0.16 180)",
    dark: "oklch(0.35 0.18 305)",
    preview: "linear-gradient(135deg, oklch(0.85 0.16 180), oklch(0.35 0.18 305))",
  },
];

const OWNED_KEY = "chess-board-themes-owned-v1";
const ACTIVE_KEY = "chess-board-theme-active-v1";

export function loadOwned(): string[] {
  if (typeof window === "undefined") return ["classic"];
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes("classic")) list.unshift("classic");
    return list;
  } catch {
    return ["classic"];
  }
}

export function saveOwned(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("themes-changed"));
  } catch {
    /* ignore */
  }
}

export function loadActive(): string {
  if (typeof window === "undefined") return "classic";
  try {
    return localStorage.getItem(ACTIVE_KEY) || "classic";
  } catch {
    return "classic";
  }
}

export function setActive(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
    applyActiveTheme();
    window.dispatchEvent(new CustomEvent("themes-changed"));
  } catch {
    /* ignore */
  }
}

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}

/** Apply the active theme's CSS variables on :root */
export function applyActiveTheme() {
  if (typeof document === "undefined") return;
  const t = getTheme(loadActive());
  const root = document.documentElement;
  root.style.setProperty("--board-light", t.light);
  root.style.setProperty("--board-dark", t.dark);
}

export type Profile = {
  name: string;
  rating: number;
  avatar: string | null; // data URL or preset key
};

const KEY = "chess-app-profile-v1";
const DEFAULT: Profile = { name: "Mulweli", rating: 820, avatar: null };

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw);
    return {
      name: typeof p.name === "string" && p.name.trim() ? p.name : DEFAULT.name,
      rating: typeof p.rating === "number" ? p.rating : DEFAULT.rating,
      avatar: typeof p.avatar === "string" ? p.avatar : null,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("profile-changed"));
  } catch {
    /* ignore */
  }
}

export function bumpRating(delta: number) {
  const p = loadProfile();
  saveProfile({ ...p, rating: Math.max(100, p.rating + delta) });
}

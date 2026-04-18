// Build the lookup key used by eco.json from a chess.js FEN.
// eco.json key format: <board><stm><castling><ep><halfmove><fullmove>  (no spaces)
// where ep is "-" when none, then "-" then halfmove+fullmove concatenated.
// Example: "rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1RbKQkq-11" for 1.Nh3
export function ecoKeyFromFen(fen: string): string {
  const [board, stm, castling, ep, half, full] = fen.split(" ");
  // The samples show a single "-" between ep and half+full when ep is "-".
  // When ep != "-", we still concatenate as: board+stm+castling+ep+half+full
  // (no extra dash). Most opening positions have ep="-", which yields
  // "...castling-halfmovefullmove".
  return `${board}${stm}${castling}${ep}${half}${full}`;
}

export type EcoEntry = {
  eco?: string;
  moves?: string;
  name?: string;
};

let ecoMap: Record<string, string[]> | null = null;
let ecoPromise: Promise<Record<string, string[]>> | null = null;

export async function loadEco(): Promise<Record<string, string[]>> {
  if (ecoMap) return ecoMap;
  if (!ecoPromise) {
    ecoPromise = fetch("/eco/eco.json")
      .then((r) => r.json())
      .then((d) => {
        ecoMap = d;
        return d;
      });
  }
  return ecoPromise;
}

// Entries are stored as Python-repr strings. Pull a few fields out via regex.
function parseEntry(raw: string): EcoEntry {
  const grab = (k: string) => {
    const m = raw.match(new RegExp(`'${k}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    return m ? m[1].replace(/\\'/g, "'") : undefined;
  };
  return {
    eco: grab("eco"),
    name: grab("name"),
    moves: grab("moves"),
  };
}

export function lookupEco(
  map: Record<string, string[]>,
  fen: string,
): EcoEntry | null {
  const entries = map[ecoKeyFromFen(fen)];
  if (!entries || entries.length === 0) return null;
  return parseEntry(entries[0]);
}

// Look up the next move from the opening book given current FEN and a list
// of legal moves with their resulting FENs. Returns the SAN/UCI of a move
// that leads to a known opening position, or null if none found.
export function bookMove(
  map: Record<string, string[]>,
  candidates: { uci: string; resultFen: string }[],
): string | null {
  // Prefer moves that land on a known position.
  const known = candidates.filter((c) => map[ecoKeyFromFen(c.resultFen)]);
  if (known.length === 0) return null;
  // Pick a random known continuation for variety.
  return known[Math.floor(Math.random() * known.length)].uci;
}

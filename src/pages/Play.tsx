import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Board } from "@/components/chess/Board";
// (BotPicker removed — opponent is locked at game start)
import { BotCard } from "@/components/chess/BotCard";
import { MoveHistory } from "@/components/chess/MoveHistory";
import { CapturedPieces } from "@/components/chess/CapturedPieces";
import { GameReview } from "@/components/chess/GameReview";
import { HorizontalEvalBar } from "@/components/chess/HorizontalEvalBar";
import { PromotionDialog } from "@/components/chess/PromotionDialog";
import { ChessClock } from "@/components/chess/ChessClock";
import { ResultsDialog, type ResultsData, type GameOutcome, type GameReason } from "@/components/chess/ResultsDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lightbulb, Undo2, RefreshCw, Volume2, VolumeX, Sparkles, BarChart3, Flag, Trophy, Handshake } from "lucide-react";
import {
  bestMove,
  ensureReady,
  evaluate,
  LEVELS,
  setLevel,
  stop,
} from "@/lib/chess/engine";
import { bookMove, loadEco, lookupEco } from "@/lib/chess/eco";
import { BOTS, pick } from "@/lib/chess/bots";
import { sfx, setMuted, isMuted } from "@/lib/chess/sounds";
import { PageTransition } from "@/components/PageTransition";
import { useGameState, type Color } from "@/lib/chess/gameContext";
import { useClock, type TimeControl } from "@/lib/chess/useClock";
import { accuracyFromCpl, winPctFromCp } from "@/lib/chess/accuracy";
import {
  applyResult,
  getDef,
  loadAllTournaments,
  saveTournament,
  type GameResult,
} from "@/lib/chess/tournaments";

import { pushHistory } from "@/lib/chess/history";
import { evaluateAfterGame } from "@/lib/chess/achievements";
import { showAchievementToasts } from "@/components/chess/AchievementToast";
import { addGems, gemsForWin } from "@/lib/chess/gems";
import { bumpRating } from "@/lib/chess/profile";
import { applyActiveTheme } from "@/lib/chess/boardThemes";

const FALLBACK_TC: TimeControl = { initial: 600, increment: 5 };

function uciToMove(uci: string) {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  };
}

function buildPgn(history: { san: string }[], result: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const tags = [
    '[Event "Casual Game"]',
    '[Site "Chess App"]',
    `[Date "${date}"]`,
    '[White "Player"]',
    '[Black "Bot"]',
    `[Result "${result}"]`,
  ].join("\n");
  let body = "";
  history.forEach((m, i) => {
    if (i % 2 === 0) body += `${i / 2 + 1}. `;
    body += `${m.san} `;
  });
  return `${tags}\n\n${body.trim()} ${result}`;
}

function PlayPage() {
  const navigate = useNavigate();
  const {
    botIdx,
    setBotIdx,
    playerColor,
    setPlayerColor,
    pgn: savedPgn,
    setPgn: persistPgn,
    tournament,
    setTournament,
    timeControl: chosenTc,
  } = useGameState();

  const tc: TimeControl = tournament?.timeControl ?? chosenTc ?? FALLBACK_TC;

  // Authoritative game with full move history — restored from saved PGN if present
  const [fullGame, setFullGame] = useState(() => {
    const c = new Chess();
    if (typeof window !== "undefined" && savedPgn) {
      try {
        c.loadPgn(savedPgn);
      } catch {
        /* ignore corrupted PGN */
      }
    }
    return c;
  });
  const [viewPly, setViewPly] = useState<number>(-1);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [selected, setSelected] = useState<Square | null>(null);
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);
  const [reviewBest, setReviewBest] = useState<{ from: Square; to: Square } | null>(null);
  const [reviewGlyph, setReviewGlyph] = useState<{ square: Square; glyph: string; color: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [muted, setMutedState] = useState<boolean>(isMuted());
  const [botMessage, setBotMessage] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [liveCp, setLiveCp] = useState<number | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [premove, setPremove] = useState<{ from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" } | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [forcedReason, setForcedReason] = useState<GameReason | null>(null);
  const [resigned, setResigned] = useState<"player" | "bot" | null>(null);
  const [drawOfferState, setDrawOfferState] = useState<"idle" | "pending" | "declined">("idle");
  const ecoMapRef = useRef<Record<string, string[]> | null>(null);
  const evalSeq = useRef(0);

  // Per-move centipawn loss tracking for accuracy
  const cplRef = useRef<{ player: number[]; bot: number[]; lastEvalCp: number | null }>({
    player: [],
    bot: [],
    lastEvalCp: null,
  });
  // Track whether the player was down ≥3 points of material at any time in the first ~20 plies
  const earlyDeficitRef = useRef<boolean>(false);
  const firstMoveSpokenRef = useRef<boolean>(false);

  const bot = BOTS[botIdx];
  const level = bot.levelIdx;

  const sanHistory = fullGame.history();
  const totalPlies = sanHistory.length;
  const livePly = viewPly < 0 ? totalPlies : viewPly;

  const displayChess = useMemo(() => {
    if (viewPly < 0 || viewPly === totalPlies) return fullGame;
    const c = new Chess();
    const verbose = fullGame.history({ verbose: true });
    for (let i = 0; i < viewPly; i++) {
      c.move({ from: verbose[i].from, to: verbose[i].to, promotion: verbose[i].promotion });
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPly, totalPlies, fullGame]);

  const isLiveView = viewPly < 0 || viewPly === totalPlies;

  // ---------- Clock ----------
  const handleFlag = useCallback((side: "w" | "b") => {
    setForcedReason("timeout");
    setResigned(side === (playerColor === "white" ? "w" : "b") ? "player" : "bot");
    refresh();
  }, [playerColor]);

  const clock = useClock(tc, handleFlag);

  // Reset clock when starting a new game / tournament linkage / TC change
  useEffect(() => {
    clock.reset();
    // Start clock for whoever moves first if a game is partially in progress
    if (totalPlies > 0 && !fullGame.isGameOver()) {
      clock.setRunning(fullGame.turn());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc.initial, tc.increment]);

  // ---------- Engine ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      await ensureReady();
      await setLevel(level);
      if (mounted) setEngineReady(true);
    })();
    loadEco().then((m) => {
      ecoMapRef.current = m;
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (engineReady) setLevel(level);
  }, [level, engineReady]);

  // Apply active board theme
  useEffect(() => {
    applyActiveTheme();
  }, []);

  // Greet on bot change — message stays until the player makes a move
  useEffect(() => {
    setBotMessage(pick(bot.intro));
  }, [bot]);

  // Opening name
  useEffect(() => {
    const map = ecoMapRef.current;
    if (!map) return;
    const entry = lookupEco(map, fullGame.fen());
    if (entry?.name) setOpeningName(entry.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGame, totalPlies]);

  const lastMove = useMemo(() => {
    const verbose = displayChess.history({ verbose: true });
    if (!verbose.length) return null;
    const m = verbose[verbose.length - 1];
    return { from: m.from as Square, to: m.to as Square };
  }, [displayChess]);

  const legalTargets = useMemo<Square[]>(() => {
    if (!selected || !isLiveView) return [];
    return fullGame
      .moves({ square: selected, verbose: true })
      .map((m) => m.to as Square);
  }, [selected, fullGame, isLiveView]);

  const isPlayerTurn = useCallback(
    () =>
      (fullGame.turn() === "w" && playerColor === "white") ||
      (fullGame.turn() === "b" && playerColor === "black"),
    [fullGame, playerColor],
  );

  const playMoveSounds = (m: ReturnType<Chess["move"]>) => {
    if (!m) return;
    if (m.flags.includes("k") || m.flags.includes("q")) sfx.castle();
    else if (m.flags.includes("c") || m.flags.includes("e")) sfx.capture();
    else sfx.move();
    if (fullGame.inCheck()) sfx.check();
    if (fullGame.isGameOver()) {
      if (fullGame.isDraw() || fullGame.isStalemate()) sfx.draw();
      else {
        const winnerIsPlayer = fullGame.turn() !== (playerColor === "white" ? "w" : "b");
        winnerIsPlayer ? sfx.gameOverWin() : sfx.gameOverLose();
      }
    }
  };

  // Show a bot line. Bubble persists until the player makes a move (cleared in performMove).
  const showBotLine = (lines: string[]) => {
    if (!lines || !lines.length) return;
    setBotMessage(pick(lines));
  };

  // Material counter (player POV) — used for "Comeback" achievement & blunder detection
  const materialDiff = useCallback(() => {
    const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const playerCode = playerColor === "white" ? "w" : "b";
    let diff = 0;
    for (const row of fullGame.board()) {
      for (const sq of row) {
        if (!sq) continue;
        const v = VALUES[sq.type] ?? 0;
        diff += sq.color === playerCode ? v : -v;
      }
    }
    return diff;
  }, [fullGame, playerColor]);

  // Track centipawn loss after each move
  const recordCpl = useCallback(async (moverIsPlayer: boolean) => {
    // Track early material deficit for "Comeback Kid"
    if (totalPlies <= 20 && materialDiff() <= -3) {
      earlyDeficitRef.current = true;
    }
    try {
      const fen = fullGame.fen();
      const r = await evaluate(fen, { movetime: 150, depth: 10 });
      const prev = cplRef.current.lastEvalCp;
      const moverPovAfter = -r.cp;
      if (prev !== null) {
        const before = winPctFromCp(prev);
        const after = winPctFromCp(moverPovAfter);
        const loss = Math.max(0, before - after);
        const cplEquiv = loss * 4;
        if (moverIsPlayer) cplRef.current.player.push(cplEquiv);
        else cplRef.current.bot.push(cplEquiv);

        // Big blunder banter (>20% win-rate swing)
        if (loss > 20 && !fullGame.isGameOver()) {
          if (moverIsPlayer && bot.onPlayerBlunder?.length) {
            showBotLine(bot.onPlayerBlunder);
          } else if (!moverIsPlayer && bot.onSelfBlunder?.length) {
            showBotLine(bot.onSelfBlunder);
          }
        }
      }
      cplRef.current.lastEvalCp = moverPovAfter;
    } catch {
      /* ignore */
    }
  }, [fullGame, totalPlies, materialDiff, bot]);

  const triggerEngineMove = useCallback(async () => {
    if (fullGame.isGameOver()) return;
    setHint(null);
    try {
      const map = ecoMapRef.current;
      let chosenUci: string | null = null;
      if (map) {
        const candidates = fullGame.moves({ verbose: true }).map((m) => {
          const probe = new Chess(fullGame.fen());
          probe.move({ from: m.from, to: m.to, promotion: m.promotion });
          return {
            uci: `${m.from}${m.to}${m.promotion ?? ""}`,
            resultFen: probe.fen(),
          };
        });
        chosenUci = bookMove(map, candidates);
      }
      if (!chosenUci) {
        const cfg = LEVELS[level];
        chosenUci = await bestMove(fullGame.fen(), {
          movetime: cfg.movetime,
          depth: cfg.depth,
        });
      }
      if (chosenUci) {
        const movedSide = fullGame.turn();
        const m = fullGame.move(uciToMove(chosenUci));
        playMoveSounds(m);
        clock.addIncrement(movedSide);
        if (!fullGame.isGameOver()) {
          clock.setRunning(fullGame.turn());
        } else {
          clock.setRunning(null);
        }
        if (m && (m.flags.includes("c") || m.flags.includes("e"))) {
          showBotLine(bot.onCapture);
        } else if (fullGame.inCheck()) {
          showBotLine(bot.onCheck);
        } else if (fullGame.isGameOver() && !fullGame.isDraw()) {
          showBotLine(bot.onWin);
        }
        recordCpl(false);
        refresh();

        // Try to execute queued premove now that it's player's turn
        if (premove && !fullGame.isGameOver()) {
          const candidate = fullGame
            .moves({ square: premove.from, verbose: true })
            .find((mv) => mv.to === premove.to);
          const queued = premove;
          setPremove(null);
          if (candidate) {
            // Defer slightly so the bot's move animation registers first
            setTimeout(() => {
              performMove(queued.from, queued.to, (queued.promotion ?? candidate.promotion) as "q" | "r" | "b" | "n" | undefined);
            }, 60);
          }
        }
      }
    } finally {
      setThinking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGame, level, bot, playerColor, clock]);

  // After player move -> bot moves
  useEffect(() => {
    if (!engineReady) return;
    if (!isLiveView) return;
    if (!isPlayerTurn() && !fullGame.isGameOver() && !thinking) {
      setThinking(true);
      const t = setTimeout(triggerEngineMove, 80);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, totalPlies, playerColor, isLiveView]);

  // Live engine evaluation for the eval bar
  useEffect(() => {
    if (!engineReady) return;
    if (reviewing) return;
    const seq = ++evalSeq.current;
    const fen = displayChess.fen();
    evaluate(fen, { movetime: 200, depth: 12 }).then((r) => {
      if (seq !== evalSeq.current) return;
      setLiveCp(r.cp);
    });
  }, [engineReady, displayChess, reviewing]);

  // Persist PGN whenever the game changes
  useEffect(() => {
    if (totalPlies === 0) {
      persistPgn(null);
    } else {
      persistPgn(fullGame.pgn());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPlies, fullGame]);

  // Detect game over and show results
  useEffect(() => {
    const over = fullGame.isGameOver() || forcedReason !== null;
    if (!over || results) return;

    let outcome: GameOutcome;
    let reason: GameReason;

    if (forcedReason === "timeout") {
      reason = "timeout";
      outcome = resigned === "player" ? "loss" : "win";
    } else if (forcedReason === "resignation") {
      reason = "resignation";
      outcome = resigned === "player" ? "loss" : "win";
    } else if (forcedReason === "draw-agreed") {
      reason = "draw-agreed";
      outcome = "draw";
    } else if (fullGame.isCheckmate()) {
      reason = "checkmate";
      const winnerIsWhite = fullGame.turn() === "b";
      outcome = winnerIsWhite === (playerColor === "white") ? "win" : "loss";
    } else if (fullGame.isStalemate()) {
      reason = "stalemate";
      outcome = "draw";
    } else if (fullGame.isInsufficientMaterial()) {
      reason = "insufficient";
      outcome = "draw";
    } else if (fullGame.isThreefoldRepetition()) {
      reason = "threefold";
      outcome = "draw";
    } else if (fullGame.isDraw()) {
      reason = "fifty";
      outcome = "draw";
    } else {
      return;
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const accPlayer = accuracyFromCpl(avg(cplRef.current.player));
    const accBot = accuracyFromCpl(avg(cplRef.current.bot));

    const lines = outcome === "win" ? bot.onLose : outcome === "loss" ? bot.onWin : bot.intro;

    setResults({
      outcome,
      reason,
      moves: Math.ceil(totalPlies / 2),
      accuracyPlayer: accPlayer || (totalPlies < 4 ? 50 : 70),
      accuracyBot: accBot || (totalPlies < 4 ? 50 : 70),
      botMessage: pick(lines),
      bot,
    });

    // Save to local history (skip very short games < 2 moves)
    if (totalPlies >= 2) {
      pushHistory({
        outcome,
        reason,
        moves: Math.ceil(totalPlies / 2),
        botName: bot.name,
        botRating: bot.rating,
        playerColor,
        timeControl: { initial: tc.initial, increment: tc.increment },
      });

      // Achievements — count player pieces remaining for "Iron King"
      const board = fullGame.board();
      const playerCode = playerColor === "white" ? "w" : "b";
      let playerPieces = 0;
      for (const row of board) for (const sq of row) if (sq && sq.color === playerCode) playerPieces++;
      const lostPieces = 16 - playerPieces;

      const newly = evaluateAfterGame({
        outcome,
        moves: Math.ceil(totalPlies / 2),
        accuracyPlayer: accPlayer || 70,
        botRating: bot.rating,
        botName: bot.name,
        timeControl: { initial: tc.initial, increment: tc.increment },
        lostPieces,
        earlyMaterialDeficit: earlyDeficitRef.current,
      });
      if (newly.length) showAchievementToasts(newly);

      // Reward gems + rating for a win
      if (outcome === "win") {
        addGems(gemsForWin(bot.rating));
        bumpRating(Math.max(2, Math.round((bot.rating - 400) / 200)));
      } else if (outcome === "loss") {
        bumpRating(-1);
      }
    }

    clock.setRunning(null);

    // Update tournament if linked
    if (tournament) {
      const all = loadAllTournaments();
      const tState = all[tournament.id as keyof typeof all];
      if (tState && tState.schedule[tournament.scheduleIdx]?.result === null) {
        const playerIsWhite = tournament.playerColor === "white";
        let result: GameResult;
        if (outcome === "draw") result = "1/2-1/2";
        else if (outcome === "win") result = playerIsWhite ? "1-0" : "0-1";
        else result = playerIsWhite ? "0-1" : "1-0";
        const updated = applyResult(tState, tournament.scheduleIdx, result);
        // Auto-simulate any subsequent bot-vs-bot games until next player game or end
        let s = updated;
        while (
          s.currentIdx < s.schedule.length &&
          s.schedule[s.currentIdx].white !== -1 &&
          s.schedule[s.currentIdx].black !== -1
        ) {
          const g = s.schedule[s.currentIdx];
          const sim: GameResult =
            Math.random() < 0.5 ? "1-0" : Math.random() < 0.5 ? "0-1" : "1/2-1/2";
          s = applyResult(s, s.currentIdx, sim);
        }
        saveTournament(s);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPlies, forcedReason]);

  const performMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    // Player just acted — clear any lingering bot speech bubble
    setBotMessage(null);
    const movedSide = fullGame.turn();
    const m = fullGame.move({ from, to, promotion: promotion ?? "q" });
    if (m) {
      playMoveSounds(m);
      clock.addIncrement(movedSide);
      if (!fullGame.isGameOver()) {
        clock.setRunning(fullGame.turn());
      } else {
        clock.setRunning(null);
      }
      recordCpl(true);
      if (!firstMoveSpokenRef.current && bot.onFirstMove?.length) {
        firstMoveSpokenRef.current = true;
        showBotLine(bot.onFirstMove);
      }
      if (fullGame.isGameOver() && !fullGame.isDraw()) {
        showBotLine(bot.onLose);
      }
    }
    setSelected(null);
    setHint(null);
    refresh();
  };

  const playerColorCode: "w" | "b" = playerColor === "white" ? "w" : "b";

  const tryPlayerMove = (from: Square, to: Square) => {
    if (!isLiveView) {
      setViewPly(-1);
      return;
    }
    if (fullGame.isGameOver()) return;

    // Premove: not our turn — queue the intended move if origin is our piece
    if (!isPlayerTurn() || thinking) {
      const piece = fullGame.get(from);
      if (!piece || piece.color !== playerColorCode) return;
      if (from === to) return;
      setPremove({ from, to });
      setSelected(null);
      return;
    }

    const moves = fullGame.moves({ square: from, verbose: true });
    const target = moves.find((m) => m.to === to);
    if (!target) return;
    const piece = fullGame.get(from);
    const isPromo =
      piece?.type === "p" &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
    if (isPromo) {
      setPendingPromo({ from, to });
      return;
    }
    performMove(from, to, target.promotion as "q" | "r" | "b" | "n" | undefined);
  };

  const onSquareClick = (sq: Square) => {
    if (!isLiveView) {
      setViewPly(-1);
      return;
    }
    if (fullGame.isGameOver()) return;
    setHint(null);

    // Premove flow when not our turn
    if (!isPlayerTurn() || thinking) {
      // Clicking anywhere first cancels any existing premove
      if (premove) setPremove(null);
      if (selected) {
        const sPiece = fullGame.get(selected);
        if (sPiece && sPiece.color === playerColorCode && selected !== sq) {
          setPremove({ from: selected, to: sq });
          setSelected(null);
          return;
        }
        setSelected(null);
        return;
      }
      const piece = fullGame.get(sq);
      if (piece && piece.color === playerColorCode) {
        setSelected(sq);
      }
      return;
    }

    if (selected) {
      const moves = fullGame.moves({ square: selected, verbose: true });
      if (moves.find((m) => m.to === sq)) {
        tryPlayerMove(selected, sq);
        return;
      }
      const piece = fullGame.get(sq);
      if (piece && piece.color === fullGame.turn()) {
        setSelected(sq);
        return;
      }
      setSelected(null);
      return;
    }
    const piece = fullGame.get(sq);
    if (piece && piece.color === fullGame.turn()) {
      setSelected(sq);
    }
  };

  const onHint = async () => {
    if (!isPlayerTurn() || fullGame.isGameOver() || !isLiveView) return;
    const uci = await bestMove(fullGame.fen(), { movetime: 600, depth: 14 });
    if (uci) {
      setHint({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
    }
  };

  const onUndo = () => {
    if (tournament) return; // disable undo in tournament play
    if (thinking) stop();
    if (!totalPlies) return;
    setViewPly(-1);
    const last = fullGame.history({ verbose: true }).slice(-1)[0];
    if (!last) return;
    if (last.color !== (playerColor === "white" ? "w" : "b")) {
      fullGame.undo();
    }
    fullGame.undo();
    setSelected(null);
    setHint(null);
    setPremove(null);
    setThinking(false);
    refresh();
  };

  const onResign = () => {
    if (fullGame.isGameOver() || forcedReason) return;
    setForcedReason("resignation");
    setResigned("player");
    clock.setRunning(null);
    sfx.gameOverLose();
    refresh();
  };

  const onDrawOffer = async () => {
    if (fullGame.isGameOver() || forcedReason) return;
    if (drawOfferState !== "idle") return;
    if (totalPlies < 10) {
      // Bot won't accept very early
      setDrawOfferState("declined");
      showBotLine(["Too early — let's keep playing.", "Not yet, the game is just starting.", "I'll decline for now."]);
      setTimeout(() => setDrawOfferState("idle"), 4000);
      return;
    }
    setDrawOfferState("pending");
    try {
      // Evaluate current position from bot's POV
      const r = await evaluate(fullGame.fen(), { movetime: 400, depth: 14 });
      // r.cp is from side-to-move POV. Convert to bot POV.
      const botSide = playerColor === "white" ? "b" : "w";
      const sideToMove = fullGame.turn();
      const botPovCp = sideToMove === botSide ? r.cp : -r.cp;
      // Bot accepts if bot is not winning by much (i.e. position is close or bot is worse)
      // Threshold: accept if botPovCp <= 60 centipawns advantage
      const accept = botPovCp <= 60;
      if (accept) {
        showBotLine(["Draw accepted — well played.", "Agreed. A fair result.", "Sure, draw it is."]);
        setForcedReason("draw-agreed");
        clock.setRunning(null);
        sfx.draw();
        refresh();
      } else {
        setDrawOfferState("declined");
        showBotLine(bot.onWin.length ? bot.onWin : ["I'll play on.", "Not yet — I like my position.", "Declined."]);
        setTimeout(() => setDrawOfferState("idle"), 5000);
      }
    } catch {
      setDrawOfferState("idle");
    }
  };

  const onNewGame = (color?: Color) => {
    stop();
    const fresh = new Chess();
    setFullGame(fresh);
    setSelected(null);
    setHint(null);
    setPremove(null);
    setOpeningName(null);
    setThinking(false);
    setViewPly(-1);
    setLiveCp(0);
    setForcedReason(null);
    setResigned(null);
    setResults(null);
    setDrawOfferState("idle");
    cplRef.current = { player: [], bot: [], lastEvalCp: null };
    earlyDeficitRef.current = false;
    firstMoveSpokenRef.current = false;
    if (color) setPlayerColor(color);
    persistPgn(null);
    clock.reset();
    sfx.start();
    setBotMessage(pick(bot.intro));
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const status = (() => {
    if (forcedReason === "timeout") return `${resigned === "player" ? "You" : bot.name} ran out of time`;
    if (forcedReason === "resignation") return `${resigned === "player" ? "You" : bot.name} resigned`;
    if (forcedReason === "draw-agreed") return "Draw agreed";
    if (fullGame.isCheckmate()) return `Checkmate — ${fullGame.turn() === "w" ? "Black" : "White"} wins`;
    if (fullGame.isStalemate()) return "Stalemate";
    if (fullGame.isDraw()) return "Draw";
    if (fullGame.inCheck()) return "Check!";
    if (drawOfferState === "pending") return `${bot.name} considers your draw offer…`;
    if (drawOfferState === "declined") return `${bot.name} declined the draw`;
    if (thinking) return `${bot.name} is thinking…`;
    return isPlayerTurn() ? "Your move" : `${bot.name}'s turn`;
  })();

  const result = fullGame.isCheckmate()
    ? fullGame.turn() === "w"
      ? "0-1"
      : "1-0"
    : fullGame.isDraw() || fullGame.isStalemate()
      ? "1/2-1/2"
      : "*";
  const pgn = buildPgn(fullGame.history({ verbose: true }), result);

  const gameOver = fullGame.isGameOver() || forcedReason !== null;
  void gameOver; // (thinking shown in BotCard bubble, not on board)

  // Clock placement: top = opponent, bottom = player
  const playerSide = playerColor === "white" ? "w" : "b";
  const oppMs = playerColor === "white" ? clock.blackMs : clock.whiteMs;
  const playerMs = playerColor === "white" ? clock.whiteMs : clock.blackMs;
  const oppActive = clock.running !== null && clock.running !== playerSide && !gameOver;
  const playerActive = clock.running === playerSide && !gameOver;

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-2 sm:px-3 py-3 md:py-5 flex flex-col items-center">
        <header className="w-full max-w-md md:max-w-5xl flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              to={tournament ? `/tournament/${tournament.id}` : "/"}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              {tournament ? <Trophy className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none">
                {tournament ? getDef(tournament.id as never).name.replace(" Tournament", "") : "Chess"}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {tournament ? tournament.roundLabel : `Stockfish · ${BOTS.length} bots`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleMute} aria-label="Toggle sound" className="h-8 w-8">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </header>

        <div className="w-full max-w-md md:max-w-5xl grid md:grid-cols-[1fr_300px] gap-3 items-start">
          <div className="space-y-2.5">
            {/* Opponent row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <BotCard
                  bot={bot}
                  message={botMessage}
                  thinking={thinking && !isPlayerTurn()}
                  isTurn={!isPlayerTurn() && !gameOver}
                />
              </div>
              <ChessClock ms={oppMs} active={oppActive} low={oppMs < 30000} label={`${bot.name} clock`} />
              <div
                className="hidden sm:flex shrink-0 rounded-lg bg-card border border-border px-2 py-1.5 max-w-[150px]"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <CapturedPieces chess={fullGame} side={playerColor === "white" ? "black" : "white"} />
              </div>
            </div>

            {/* Eval bar (horizontal) + Board */}
            <div className="space-y-1.5">
              <HorizontalEvalBar cp={liveCp} orientation={playerColor} loading={thinking} />
              <Board
                chess={displayChess}
                orientation={playerColor}
                selected={selected}
                legalTargets={legalTargets}
                lastMove={lastMove}
                hint={hint}
                bestMoveHint={reviewing ? reviewBest : null}
                premove={premove}
                moveGlyph={reviewing ? reviewGlyph : null}
                interactive={isLiveView && !gameOver && !reviewing}
                thinking={false}
                onSquareClick={onSquareClick}
                onDragMove={tryPlayerMove}
              />
            </div>

            {/* Player row */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 min-w-0 flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{status}</div>
                  {openingName && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      📖 {openingName}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground ml-2 shrink-0">
                  {Math.floor(totalPlies / 2) + 1}
                </div>
              </div>
              <ChessClock ms={playerMs} active={playerActive} low={playerMs < 30000} label="Your clock" />
              <div
                className="hidden sm:flex shrink-0 rounded-lg bg-card border border-border px-2 py-1.5 max-w-[150px]"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <CapturedPieces chess={fullGame} side={playerColor} />
              </div>
            </div>

            {/* Mobile material row */}
            <div
              className="sm:hidden flex items-center justify-between rounded-lg bg-card border border-border px-3 py-1.5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <CapturedPieces chess={fullGame} side={playerColor === "white" ? "black" : "white"} />
              <div className="w-px h-4 bg-border mx-2" />
              <CapturedPieces chess={fullGame} side={playerColor} />
            </div>

            {/* Action buttons */}
            {tournament ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={onHint}
                  disabled={gameOver || !isPlayerTurn() || !isLiveView}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-3.5 h-3.5" /> Hint
                </button>
                <button
                  onClick={onDrawOffer}
                  disabled={gameOver || totalPlies < 2 || drawOfferState !== "idle"}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  {drawOfferState === "pending" ? "Offered…" : drawOfferState === "declined" ? "Declined" : "Offer Draw"}
                </button>
                <button
                  onClick={onResign}
                  disabled={gameOver || totalPlies === 0}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Flag className="w-3.5 h-3.5" /> Resign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={onHint}
                  disabled={gameOver || !isPlayerTurn() || !isLiveView}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-3.5 h-3.5" /> Hint
                </button>
                <button
                  onClick={onUndo}
                  disabled={totalPlies === 0}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </button>
                <button
                  onClick={onResign}
                  disabled={gameOver || totalPlies === 0}
                  className="btn-soft h-9 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Flag className="w-3.5 h-3.5" /> Resign
                </button>
                <button
                  onClick={() => onNewGame()}
                  className="btn-primary-glow h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> New
                </button>
              </div>
            )}

            {gameOver && !reviewing && (
              <button
                onClick={() => setReviewing(true)}
                className="btn-primary-glow w-full h-9 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Review Game
              </button>
            )}

            {/* Color switcher removed — opponent and color are locked at game start */}
          </div>

          {/* Right column */}
          <aside className="space-y-2.5">
            {reviewing ? (
              <GameReview
                history={fullGame.history({ verbose: true }).map((m) => ({
                  san: m.san,
                  from: m.from,
                  to: m.to,
                  promotion: m.promotion,
                }))}
                playerIsWhite={playerColor === "white"}
                onClose={() => {
                  setReviewing(false);
                  setReviewBest(null);
                  setReviewGlyph(null);
                  setViewPly(-1);
                }}
                onJump={(ply) => setViewPly(ply === totalPlies ? -1 : ply)}
                onShowBest={(_ply, ft) => setReviewBest(ft)}
                onGlyph={(g) => setReviewGlyph(g)}
              />
            ) : (
              <MoveHistory
                sanHistory={sanHistory}
                currentPly={livePly}
                onJump={(ply) => setViewPly(ply === totalPlies ? -1 : ply)}
                pgn={pgn}
              />
            )}
          </aside>
        </div>

        <PromotionDialog
          open={!!pendingPromo}
          color={playerColor === "white" ? "w" : "b"}
          onChoose={(piece) => {
            if (pendingPromo) {
              performMove(pendingPromo.from, pendingPromo.to, piece);
              setPendingPromo(null);
            }
          }}
          onCancel={() => setPendingPromo(null)}
        />

        <ResultsDialog
          open={!!results}
          data={results}
          onClose={() => setResults(null)}
          hideReview={false}
          onReview={() => {
            setResults(null);
            setReviewing(true);
          }}
          onRematch={() => {
            if (tournament) {
              // In tournament mode, rematch returns to tournament page to play next round
              setTournament(null);
              navigate(`/tournament/${tournament.id}`);
            } else {
              onNewGame();
            }
          }}
          onNewOpponent={
            tournament
              ? undefined
              : () => {
                  setResults(null);
                  navigate("/bots");
                }
          }
        />
      </main>
    </PageTransition>
  );
}

export default PlayPage;

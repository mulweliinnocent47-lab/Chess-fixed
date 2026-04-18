import bot1 from "@/assets/bots/bot1.jpg";
import bot2 from "@/assets/bots/bot2.jpg";
import bot3 from "@/assets/bots/bot3.jpg";
import bot4 from "@/assets/bots/bot4.jpg";
import bot5 from "@/assets/bots/bot5.jpg";
import bot6 from "@/assets/bots/bot6.jpg";
import bot7 from "@/assets/bots/bot7.jpg";
import bot8 from "@/assets/bots/bot8.jpg";
import bot9 from "@/assets/bots/bot9.jpg";
import bot10 from "@/assets/bots/bot10.jpg";
import bot11 from "@/assets/bots/bot11.jpg";
import bot12 from "@/assets/bots/bot12.jpg";

export type BotProfile = {
  name: string;
  title: string;
  rating: number;
  // Index into LEVELS (0..7) controlling Stockfish strength
  levelIdx: number;
  avatar: string;
  intro: string[];
  onWin: string[];
  onLose: string[];
  onCheck: string[];
  onCapture: string[];
  /** said when the player blunders (drops material badly) */
  onPlayerBlunder?: string[];
  /** said when bot itself blunders */
  onSelfBlunder?: string[];
  /** said after the player's first move */
  onFirstMove?: string[];
  /** mid-game banter on long thinks */
  taunts?: string[];
};

export const BOTS: BotProfile[] = [
  {
    name: "Mia",
    title: "Beginner",
    rating: 400,
    levelIdx: 0,
    avatar: bot1,
    intro: ["Hi! Let's have fun ✨", "Be gentle, I'm new!"],
    onWin: ["Yay! I won!", "Beginner's luck!"],
    onLose: ["Good game!", "I'll do better next time."],
    onCheck: ["Oh no, check!", "Watch out!"],
    onCapture: ["Got one!", "Oops, sorry!"],
    onPlayerBlunder: ["Wait… really?", "Did you mean to do that? 😅"],
    onSelfBlunder: ["Noooo my piece!", "I didn't see that 🙈"],
    onFirstMove: ["Nice opening!", "Ooh, here we go!"],
    taunts: ["Take your time!", "I'm just having fun ✨"],
  },
  {
    name: "Theo",
    title: "Rookie",
    rating: 600,
    levelIdx: 0,
    avatar: bot9,
    intro: ["First game of the day!", "Let's see what happens."],
    onWin: ["No way, I won!", "Lucky me 😄"],
    onLose: ["GG, that was tough.", "Teach me your ways!"],
    onCheck: ["Eek, check!", "Careful king!"],
    onCapture: ["Mine now.", "Snack time."],
    onPlayerBlunder: ["Free piece for me!", "Are you sure about that?"],
    onSelfBlunder: ["Whoops…", "That hurt."],
    onFirstMove: ["Classic start!", "Let's dance."],
    taunts: ["Don't overthink it.", "I won't bite."],
  },
  {
    name: "Leo",
    title: "Casual",
    rating: 800,
    levelIdx: 1,
    avatar: bot2,
    intro: ["Let's play a casual game.", "Ready when you are."],
    onWin: ["Nice game!", "That was fun."],
    onLose: ["Well played.", "You got me."],
    onCheck: ["Check!", "Heads up."],
    onCapture: ["Snagged it.", "Trade?"],
    onPlayerBlunder: ["Thanks for that!", "I'll take the gift."],
    onSelfBlunder: ["Ugh, sloppy.", "Should have looked twice."],
    onFirstMove: ["Solid choice.", "Here we go."],
    taunts: ["Coffee break?", "Still thinking?"],
  },
  {
    name: "Zara",
    title: "Club Player",
    rating: 1200,
    levelIdx: 2,
    avatar: bot3,
    intro: ["Let's see what you've got.", "I've been studying openings."],
    onWin: ["Good effort!", "GG!"],
    onLose: ["Sharp play!", "Respect."],
    onCheck: ["Check!", "Look at your king."],
    onCapture: ["Material!", "I'll take that."],
    onPlayerBlunder: ["Theory says no.", "That's a known mistake."],
    onSelfBlunder: ["Inaccurate. My bad.", "I can recover."],
    onFirstMove: ["A book move!", "Fine, let's see your prep."],
    taunts: ["Tempo matters.", "Develop your pieces!"],
  },
  {
    name: "Nora",
    title: "Streamer",
    rating: 1450,
    levelIdx: 3,
    avatar: bot10,
    intro: ["Hey chat 👋 let's roll.", "Big game energy."],
    onWin: ["Clipped it!", "GG WP."],
    onLose: ["Whoa, nice one!", "That was content."],
    onCheck: ["Check incoming!", "Donos for the king?"],
    onCapture: ["Free piece!", "Tasty."],
    onPlayerBlunder: ["Chat, did you SEE that?!", "POG blunder."],
    onSelfBlunder: ["Clip that out please.", "Don't put that in the highlights."],
    onFirstMove: ["e4! Best by test.", "Hype hype hype."],
    taunts: ["Chat is asking why.", "Don't time out!"],
  },
  {
    name: "Marco",
    title: "Expert",
    rating: 1600,
    levelIdx: 3,
    avatar: bot4,
    intro: ["Bring your best.", "Tactics are my game."],
    onWin: ["Calculated.", "Predictable."],
    onLose: ["Impressive.", "I miscalculated."],
    onCheck: ["Check.", "Defend carefully."],
    onCapture: ["A clean capture.", "Mine."],
    onPlayerBlunder: ["A clear oversight.", "Tactics win games."],
    onSelfBlunder: ["A rare lapse.", "Note to self."],
    onFirstMove: ["Standard.", "Let's begin properly."],
    taunts: ["Calculate variations.", "Look for forks."],
  },
  {
    name: "Elena",
    title: "Master",
    rating: 2000,
    levelIdx: 4,
    avatar: bot5,
    intro: ["Shall we begin?", "I expect a challenge."],
    onWin: ["As expected.", "A fine game."],
    onLose: ["You played beautifully.", "Touché."],
    onCheck: ["Check.", "Mind your king."],
    onCapture: ["Excellent.", "A necessary trade."],
    onPlayerBlunder: ["Disappointing.", "You can do better."],
    onSelfBlunder: ["A regrettable move.", "I shall recover."],
    onFirstMove: ["A respectable opening.", "We begin."],
    taunts: ["Position over material.", "Patience wins."],
  },
  {
    name: "Hiro",
    title: "Sensei",
    rating: 2150,
    levelIdx: 5,
    avatar: bot11,
    intro: ["Calm mind, sharp moves.", "Begin when ready."],
    onWin: ["The path was clear.", "Patience prevails."],
    onLose: ["Beautifully played.", "I bow to your skill."],
    onCheck: ["Check. Breathe.", "The king must move."],
    onCapture: ["The river flows.", "Balance shifts."],
    onPlayerBlunder: ["Even the wise stumble.", "Consider before moving."],
    onSelfBlunder: ["The mind wandered.", "I must refocus."],
    onFirstMove: ["The journey begins.", "First step, taken."],
    taunts: ["Breathe. Then move.", "Listen to the position."],
  },
  {
    name: "Viktor",
    title: "Int. Master",
    rating: 2300,
    levelIdx: 5,
    avatar: bot6,
    intro: ["Concentrate.", "No mistakes allowed."],
    onWin: ["Inevitable.", "You fought well."],
    onLose: ["Remarkable.", "I underestimated you."],
    onCheck: ["Check.", "The king is exposed."],
    onCapture: ["Material advantage.", "Yours becomes mine."],
    onPlayerBlunder: ["Unacceptable move.", "A losing error."],
    onSelfBlunder: ["Inexcusable.", "I will not repeat it."],
    onFirstMove: ["Standard theory.", "Show your preparation."],
    taunts: ["Time is a resource.", "Calculate deeper."],
  },
  {
    name: "Sofia",
    title: "Grandmaster",
    rating: 2600,
    levelIdx: 6,
    avatar: bot7,
    intro: ["A pleasure to play.", "Show me your skill."],
    onWin: ["A worthy game.", "Endgame technique matters."],
    onLose: ["Brilliant!", "I yield to mastery."],
    onCheck: ["Check.", "Precision required."],
    onCapture: ["A fine piece.", "Position over material."],
    onPlayerBlunder: ["A tactical lapse.", "Watch your pieces."],
    onSelfBlunder: ["A small error.", "Concentration broken."],
    onFirstMove: ["A principled choice.", "Let theory guide us."],
    taunts: ["Activity is everything.", "Coordinate your pieces."],
  },
  {
    name: "Nyx",
    title: "Neural AI",
    rating: 2750,
    levelIdx: 7,
    avatar: bot12,
    intro: ["Initializing.", "Probability of your win: low."],
    onWin: ["Outcome confirmed.", "Calculation complete."],
    onLose: ["Anomaly detected.", "Recalibrating."],
    onCheck: ["Check. Threat: imminent.", "King vector compromised."],
    onCapture: ["Asset acquired.", "Material delta updated."],
    onPlayerBlunder: ["Error logged.", "Suboptimal move detected."],
    onSelfBlunder: ["Cycle wasted.", "Updating heuristics."],
    onFirstMove: ["Opening accepted.", "Tree expanded."],
    taunts: ["Search depth increasing.", "Win probability: 87%."],
  },
  {
    name: "Kasparov",
    title: "World Champion",
    rating: 2850,
    levelIdx: 7,
    avatar: bot8,
    intro: ["Prepare yourself.", "Perfection is the standard."],
    onWin: ["Crushing.", "Domination."],
    onLose: ["Astonishing!", "A historic game."],
    onCheck: ["Check.", "The end is near."],
    onCapture: ["Decisive.", "The plan unfolds."],
    onPlayerBlunder: ["Tragic.", "Such a move ends games."],
    onSelfBlunder: ["A blemish.", "Even champions slip."],
    onFirstMove: ["So it begins.", "Show me your preparation."],
    taunts: ["Initiative is everything.", "Attack the king."],
  },
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

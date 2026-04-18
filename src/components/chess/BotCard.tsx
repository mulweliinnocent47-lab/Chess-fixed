import { type BotProfile } from "@/lib/chess/bots";

type Props = {
  bot: BotProfile;
  message: string | null;
  thinking: boolean;
  isTurn: boolean;
};

export function BotCard({ bot, message, thinking, isTurn }: Props) {
  // While the bot is thinking we always show the typing indicator (3 dots).
  // Otherwise, show the latest message — and it persists until cleared by Play.tsx
  // (which happens when the player makes a move).
  const showTyping = thinking;
  const showMessage = !showTyping && !!message;

  return (
    <div
      className="relative flex items-center gap-3 rounded-xl bg-card border border-border p-3 h-[72px]"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative shrink-0">
        <img
          src={bot.avatar}
          alt={bot.name}
          loading="lazy"
          width={56}
          height={56}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
        />
        {isTurn && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-card animate-pulse"
            style={{ backgroundColor: "oklch(0.75 0.18 150)" }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-baseline gap-2">
          <div className="font-semibold truncate text-sm">{bot.name}</div>
          <div className="text-[10px] text-muted-foreground shrink-0">{bot.title}</div>
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">Rating {bot.rating}</div>
      </div>

      {/* Floating speech bubble — does NOT affect card height */}
      {(showTyping || showMessage) && (
        <div
          key={showTyping ? "__typing" : message}
          className="bubble-in absolute left-14 -top-1 -translate-y-full z-10 max-w-[calc(100%-72px)] animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <div
            className={`relative text-[11px] px-2.5 py-1.5 rounded-2xl shadow-lg border ${
              showTyping
                ? "bg-secondary text-secondary-foreground border-border"
                : "bg-primary text-primary-foreground border-transparent"
            }`}
          >
            {showTyping ? (
              <span className="inline-flex items-center gap-1 py-0.5">
                <Dot delay="0ms" />
                <Dot delay="160ms" />
                <Dot delay="320ms" />
              </span>
            ) : (
              <span className="block max-w-[200px] whitespace-normal leading-snug">{message}</span>
            )}
            {/* Bubble tail pointing down toward the avatar */}
            <span
              aria-hidden
              className={`absolute -bottom-1 left-3 w-2.5 h-2.5 rotate-45 border-r border-b ${
                showTyping
                  ? "bg-secondary border-border"
                  : "bg-primary border-transparent"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/70"
      style={{
        animation: "bot-typing-bounce 1s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}

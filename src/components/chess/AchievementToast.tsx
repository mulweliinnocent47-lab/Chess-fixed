import { toast } from "sonner";
import * as Icons from "lucide-react";
import type { Achievement } from "@/lib/chess/achievements";

export function showAchievementToasts(unlocked: Achievement[]) {
  unlocked.forEach((a, i) => {
    const Icon =
      (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[a.icon] ??
      Icons.Trophy;
    setTimeout(() => {
      toast.success(`Achievement unlocked: ${a.title}`, {
        description: a.description,
        icon: <Icon className="w-4 h-4" />,
        duration: 4500,
      });
    }, i * 600);
  });
}

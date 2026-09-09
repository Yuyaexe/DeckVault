"use client";

import { cn } from "@/lib/utils";
import { resolveRarityStyle } from "@/lib/rarity/resolve-rarity";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RarityBadgeProps {
  rarity: string | null | undefined;
  gameSlug?: string;
  size?: "sm" | "md";
  className?: string;
}

export function RarityBadge({
  rarity,
  gameSlug,
  size = "sm",
  className,
}: RarityBadgeProps) {
  const style = resolveRarityStyle(rarity, gameSlug);

  const badge = (
    <span
      style={{
        backgroundColor: style.backgroundColor,
        color: style.color,
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] font-bold uppercase leading-none tracking-tight shadow-sm ring-1 ring-black/10",
        size === "sm" ? "min-w-[1.85rem] px-1 py-[3px] text-[9px]" : "min-w-[2.25rem] px-1.5 py-1 text-[10px]",
        className
      )}
    >
      {style.code}
    </span>
  );

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={6}
        avoidCollisions={false}
        className="max-w-xs text-xs"
      >
        {style.label}
      </TooltipContent>
    </Tooltip>
  );
}

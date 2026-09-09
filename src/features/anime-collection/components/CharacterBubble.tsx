"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getCharacterInitials } from "@/features/anime-collection/types";
import { AnimeImage } from "@/features/anime-collection/components/AnimeImage";
import {
  isWideCharacterPortrait,
  resolveCharacterPortraitUrl,
} from "@/features/anime-collection/utils/resolve-character-portrait";

export interface CharacterBubbleProps {
  name: string;
  imageUrl?: string | null;
  seriesSlug?: string;
  seriesName?: string;
  accentColor?: string | null;
  onClick: () => void;
  index?: number;
  variant?: "grid" | "wheel";
  selected?: boolean;
  showName?: boolean;
}

export function CharacterBubble({
  name,
  imageUrl,
  seriesSlug,
  seriesName,
  accentColor,
  onClick,
  index = 0,
  variant = "grid",
  selected = false,
  showName = true,
}: CharacterBubbleProps) {
  const displayImageUrl = resolveCharacterPortraitUrl(
    seriesSlug,
    seriesName,
    name,
    imageUrl
  );
  const wide = isWideCharacterPortrait(displayImageUrl);
  const initials = getCharacterInitials(name);
  const reduceMotion = useReducedMotion();
  const isWheel = variant === "wheel";
  const sizeClass = wide
    ? isWheel
      ? "h-[64px] w-[120px]"
      : "h-[80px] w-[144px]"
    : isWheel
      ? "h-[72px] w-[72px]"
      : "h-[88px] w-[88px]";
  const shapeClass = wide ? "rounded-2xl" : "rounded-full";
  const initialsClass = isWheel ? "text-base" : "text-lg";

  return (
    <motion.button
      type="button"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: selected && isWheel ? 1.08 : 1 }}
      transition={{ duration: 0.2, delay: reduceMotion ? 0 : index * 0.03 }}
      whileHover={reduceMotion ? undefined : { scale: selected && isWheel ? 1.1 : 1.04, y: isWheel ? 0 : -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-2 p-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        shapeClass
      )}
      aria-label={`Open ${name}`}
      aria-current={selected ? "true" : undefined}
    >
      <div
        className={cn(
          "relative overflow-hidden border-2 transition-[border-color,box-shadow] duration-200",
          shapeClass,
          sizeClass,
          selected && isWheel
            ? "border-primary shadow-[0_0_16px_hsla(221,83%,53%,0.45)]"
            : "border-border/80 group-hover:border-primary group-hover:shadow-[0_0_16px_hsla(221,83%,53%,0.25)]"
        )}
        style={
          !displayImageUrl && accentColor
            ? { background: `linear-gradient(135deg, ${accentColor}, hsl(0 0% 16%))` }
            : undefined
        }
      >
        {displayImageUrl ? (
          <AnimeImage
            src={displayImageUrl}
            alt={name}
            fill
            className="object-cover object-center"
            onErrorFallback={
              <span
                className={cn(
                  "flex h-full w-full items-center justify-center font-semibold text-white/90",
                  initialsClass
                )}
              >
                {initials}
              </span>
            }
          />
        ) : (
          <span
            className={cn(
              "flex h-full w-full items-center justify-center font-semibold text-white/90",
              initialsClass
            )}
          >
            {initials}
          </span>
        )}
      </div>
      {showName && (
        <span
          className={cn(
            "text-center text-xs leading-tight text-muted-foreground group-hover:text-foreground",
            wide ? "max-w-[144px]" : "max-w-[96px]"
          )}
        >
          {name}
        </span>
      )}
      {selected && isWheel && (
        <span
          className="h-0.5 w-6 rounded-full bg-primary"
          aria-hidden
        />
      )}
    </motion.button>
  );
}

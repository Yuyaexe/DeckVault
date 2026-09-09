"use client";

import { motion } from "framer-motion";
import { Camera, Plus } from "lucide-react";
import { AnimeImage } from "@/features/anime-collection/components/AnimeImage";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import { getCharacterInitials } from "@/features/anime-collection/types";

export interface AnimeSeriesCardProps {
  name: string;
  coverImageUrl?: string | null;
  coverColor?: string | null;
  characterCount: number;
  onSelect: () => void;
  onEditCover?: () => void;
  index?: number;
}

export function AnimeSeriesCard({
  name,
  coverImageUrl,
  coverColor,
  characterCount,
  onSelect,
  onEditCover,
  index = 0,
}: AnimeSeriesCardProps) {
  const initials = getCharacterInitials(name.split(" ").slice(-1)[0] ?? name);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="group relative aspect-square w-full"
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "relative h-full w-full overflow-hidden rounded-xl border text-left",
          "border-border/70 bg-card transition-[border-color,box-shadow] duration-200",
          "hover:border-primary/40 hover:shadow-[0_0_20px_hsla(221,83%,53%,0.12)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label={`Open ${name}`}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 bottom-12 flex items-center justify-center p-3",
            coverImageUrl && "bg-muted/20"
          )}
          style={
            !coverImageUrl && coverColor
              ? { background: `linear-gradient(135deg, ${coverColor}, hsl(0 0% 14%))` }
              : undefined
          }
        >
          {coverImageUrl ? (
            <AnimeImage
              src={coverImageUrl}
              alt={name}
              className="max-h-full max-w-full object-contain"
              onErrorFallback={
                <span className="text-3xl font-bold text-white/90">{initials}</span>
              }
            />
          ) : (
            <span className="text-3xl font-bold text-white/90">{initials}</span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-3 pt-8">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {characterCount === 1 ? "1 character" : `${characterCount} characters`}
          </p>
        </div>
      </button>
      {onEditCover && (
        <button
          type="button"
          aria-label={`Change cover for ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEditCover();
          }}
          className="absolute right-2 top-2 z-10 rounded-md bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

export function AddAnimeSeriesCard({
  onClick,
  index = 0,
  label,
}: {
  onClick: () => void;
  index?: number;
  label?: string;
}) {
  const t = useT();
  const displayLabel = label ?? t("anime.addSeries");
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-label={displayLabel}
      className={cn(
        "flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed",
        "border-border/80 bg-card/30 text-muted-foreground",
        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
        <Plus className="h-8 w-8" />
      </div>
      <span className="text-sm font-medium">{displayLabel}</span>
    </motion.button>
  );
}

export function AddCharacterBubble({
  onClick,
  index = 0,
}: {
  onClick: () => void;
  index?: number;
}) {
  const t = useT();

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-1 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      aria-label={t("anime.addCharacter")}
    >
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-card/40 text-2xl">
        <Plus className="h-8 w-8" />
      </div>
      <span className="max-w-[96px] text-center text-xs">{t("anime.addCharacter")}</span>
    </motion.button>
  );
}

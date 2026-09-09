"use client";

import { motion } from "framer-motion";
import { Layers, MoreVertical, Star } from "lucide-react";
import { CardImage } from "@/components/shared/CardImage";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface CollectionGridCardProps {
  name: string;
  coverImageUrl?: string | null;
  cardCount: number;
  isFavorite?: boolean;
  isActive?: boolean;
  isShared?: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  onOpenMenu?: () => void;
  index?: number;
  draggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

export function CollectionGridCard({
  name,
  coverImageUrl,
  cardCount,
  isFavorite = false,
  isActive = false,
  isShared = false,
  onSelect,
  onToggleFavorite,
  onOpenMenu,
  index = 0,
  draggable = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: CollectionGridCardProps) {
  const t = useT();

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(draggable && "cursor-grab active:cursor-grabbing")}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: index * 0.04 }}
        whileHover={{ scale: draggable ? 1 : 1.03, y: draggable ? 0 : -2 }}
        className={cn(
          "group relative aspect-square w-full overflow-hidden rounded-xl border text-left",
          "bg-gradient-to-br from-card via-card to-secondary/40",
          "transition-[border-color,box-shadow] duration-200",
          isDragOver && "border-primary ring-2 ring-primary/40",
          isActive
            ? "border-primary/60 shadow-[0_0_24px_hsla(221,83%,53%,0.25)]"
            : "border-border/70 hover:border-primary/40 hover:shadow-[0_0_20px_hsla(221,83%,53%,0.12)]"
        )}
      >
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open ${name}`}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 pb-14">
        {coverImageUrl ? (
          <div className="relative h-full w-full max-w-[72%] overflow-hidden rounded-lg shadow-lg ring-1 ring-white/10">
            <CardImage
              src={coverImageUrl}
              alt={name}
              fill
              sizes="160px"
              className="object-contain p-1"
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-violet-500/10 to-primary/5 ring-1 ring-primary/20 transition-all duration-200 group-hover:from-primary/30 group-hover:ring-primary/40">
            <Layers className="h-9 w-9 text-primary/80" />
          </div>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-violet-600/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      {onOpenMenu && (
        <button
          type="button"
          aria-label={t("collections.optionsFor", { name })}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
          className={cn(
            "absolute left-2 top-2 z-10 rounded-md p-1.5 transition-all duration-150",
            "text-muted-foreground/60 hover:bg-background/60 hover:text-foreground",
            "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={
            isFavorite ? t("collections.favoriteRemove") : t("collections.favoriteAdd")
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "absolute right-2 top-2 z-10 rounded-md p-1.5 transition-all duration-150",
            "hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isFavorite ? "text-amber-400" : "text-muted-foreground/50 hover:text-amber-400/80"
          )}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-background/95 via-background/80 to-transparent px-3 pb-3 pt-10">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
          {isShared && (
            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {t("share.sharedBadge")}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cardCount === 1
            ? t("collections.cardCountOne")
            : t("collections.cardCount", { count: cardCount })}
        </p>
      </div>
      </motion.div>
    </div>
  );
}

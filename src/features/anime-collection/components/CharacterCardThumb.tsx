"use client";

import type { MouseEvent } from "react";
import { CardImage } from "@/components/shared/CardImage";
import { resolveCollectionThumbUrl } from "@/lib/cards/preview-image";
import { useYugiohPasscodeForDisplay } from "@/hooks/useYugiohPasscodeForDisplay";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import type { AnimeCharacterCard } from "@/lib/demo/types";

export function CharacterCardThumb({
  item,
  className,
  selected = false,
  onClick,
}: {
  item: AnimeCharacterCard;
  className?: string;
  selected?: boolean;
  onClick?: (event: MouseEvent) => void;
}) {
  const t = useT();
  const ygoPasscode = useYugiohPasscodeForDisplay(item.card, item.id);
  const thumbSrc = resolveCollectionThumbUrl(item.card, ygoPasscode);

  const image = (
    <CardImage src={thumbSrc} alt={item.card.name} fill sizes="140px" className="object-contain p-1" />
  );

  const classes = cn(
    "relative aspect-[59/86] overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border/30 transition-all",
    onClick && "cursor-pointer hover:ring-primary/40 hover:shadow-md",
    selected && "ring-2 ring-inset ring-primary/80",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classes}
        aria-label={t("anime.openCard", { name: item.card.name })}
      >
        {image}
        {selected && (
          <span className="pointer-events-none absolute inset-0 bg-primary/15" aria-hidden />
        )}
      </button>
    );
  }

  return <div className={classes}>{image}</div>;
}

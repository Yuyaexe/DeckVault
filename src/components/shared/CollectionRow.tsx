"use client";

import { memo, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CardImage } from "@/components/shared/CardImage";
import { CardHoverPreview } from "@/components/shared/CardHoverPreview";
import { TruncatedTooltip } from "@/components/shared/TruncatedTooltip";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { getCardHoverPreviewUrl } from "@/lib/cards/preview-image";
import { useCollectionCardImage } from "@/hooks/useCollectionCardImage";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import type { DemoOwnedCard } from "@/lib/demo/types";

interface CollectionRowProps {
  item: DemoOwnedCard;
  selected: boolean;
  focused: boolean;
  onClick: (
    item: DemoOwnedCard,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  ) => void;
  onNameClick?: (item: DemoOwnedCard) => void;
  onMiddleClick: (item: DemoOwnedCard) => void;
  onCheckboxChange: (id: string, shiftKey: boolean) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const CollectionRow = memo(function CollectionRow({
  item,
  selected,
  focused,
  onClick,
  onNameClick,
  onMiddleClick,
  onCheckboxChange,
  onQuantityChange,
  onRemove,
  className,
  style,
}: CollectionRowProps) {
  const t = useT();
  const { thumbSrc, fallbackSrc, loading, ygoPasscode } = useCollectionCardImage(item);
  const hoverSrc = getCardHoverPreviewUrl(item.card, ygoPasscode);

  const shiftKeyRef = useRef(false);

  return (
    <div
      role="row"
      tabIndex={0}
      style={style}
      className={cn(
        "group flex cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-2 transition-colors duration-100 hover:bg-muted/40",
        selected && "border-l-2 border-l-primary bg-primary/[0.07]",
        !selected && "border-l-2 border-l-transparent",
        focused && "ring-1 ring-inset ring-primary/25",
        className
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-row-action]")) return;
        onClick(item, {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        });
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onMiddleClick(item);
        }
      }}
    >
      <div
        data-row-action
        className="flex shrink-0 items-center justify-center rounded-md p-1 transition-colors hover:bg-muted/60"
        onPointerDown={(e) => {
          shiftKeyRef.current = e.shiftKey;
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onCheckboxChange(item.id, shiftKeyRef.current)}
          aria-label={t("collection.selectCard", { name: item.card.name })}
        />
      </div>

      <CardHoverPreview
        className="shrink-0"
        src={thumbSrc}
        previewSrc={hoverSrc}
        alt={item.card.name}
      >
        <div className="relative h-11 w-[1.875rem] shrink-0 overflow-hidden rounded-md bg-muted/40 ring-1 ring-border/30 transition-shadow group-hover:ring-primary/40">
          <CardImage
            src={thumbSrc}
            fallbackSrc={fallbackSrc}
            loading={loading}
            alt={item.card.name}
            fill
            sizes="44px"
            className="object-contain p-px"
          />
        </div>
      </CardHoverPreview>

      <div className="min-w-0 flex-[2]">
        <button
          type="button"
          data-row-action
          className="block w-full min-w-0 text-left transition-colors hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onNameClick?.(item);
          }}
        >
          <TruncatedTooltip
            text={item.card.name}
            className="text-sm font-medium underline-offset-2 hover:underline"
          />
        </button>
        <TruncatedTooltip
          text={item.card.gameName}
          className="text-xs text-muted-foreground"
        />
      </div>

      <div className="hidden w-12 text-sm text-muted-foreground xl:block">
        {item.card.collectorNumber ?? "—"}
      </div>

      <div data-row-action className="flex w-[104px] shrink-0 justify-center">
        <QuantityStepper
          value={item.quantity}
          onChange={(quantity) => {
            if (quantity !== item.quantity) {
              onQuantityChange(item.id, quantity);
            }
          }}
        />
      </div>

      <div className="hidden w-12 text-center text-xs md:block">
        <Badge variant="outline" className="font-normal">
          {item.condition}
        </Badge>
      </div>

      <div className="hidden w-10 text-center text-xs text-muted-foreground sm:block">
        {item.language}
      </div>

      {item.isFoil && (
        <Badge className="hidden border-0 bg-amber-500/15 text-[10px] text-amber-400 md:inline-flex">
          {t("collection.foil")}
        </Badge>
      )}
    </div>
  );
});

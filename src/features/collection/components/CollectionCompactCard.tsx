"use client";

import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CardImage } from "@/components/shared/CardImage";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { useCollectionCardImage } from "@/hooks/useCollectionCardImage";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { dragHandleProps, useDragReorder } from "@/hooks/useDragReorder";
import type { DemoOwnedCard } from "@/lib/demo/types";

interface CollectionCompactCardProps {
  item: DemoOwnedCard;
  selected: boolean;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onSelect: () => void;
  onOpen: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export const CollectionCompactCard = memo(function CollectionCompactCard({
  item,
  selected,
  dragHandlers,
  onSelect,
  onOpen,
  onQuantityChange,
  onRemove,
}: CollectionCompactCardProps) {
  const t = useT();
  const { thumbSrc, fallbackSrc, loading } = useCollectionCardImage(item);
  const dragOver = dragHandlers.isDragOver(item.id);

  return (
    <div
      {...dragHandleProps(dragHandlers, item.id)}
      className={cn(
        "flex gap-3 rounded-xl border border-border/60 bg-card/40 p-3 transition-colors cursor-grab active:cursor-grabbing",
        selected && "border-primary/50 bg-primary/[0.06]",
        dragOver && "border-primary ring-2 ring-primary/30"
      )}
    >
      <div className="flex shrink-0 items-start pt-1">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          aria-label={t("collection.selectCard", { name: item.card.name })}
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="relative h-[4.5rem] w-[3.2rem] shrink-0 overflow-hidden rounded-md bg-muted/40 ring-1 ring-border/30"
      >
        <CardImage
          src={thumbSrc}
          fallbackSrc={fallbackSrc}
          loading={loading}
          alt={item.card.name}
          fill
          sizes="52px"
          className="object-contain p-px"
        />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.card.name}</p>
        </button>

        <QuantityStepper
          value={item.quantity}
          onChange={(quantity) => {
            if (quantity < 1) {
              onRemove();
              return;
            }
            onQuantityChange(quantity);
          }}
        />
      </div>
    </div>
  );
});

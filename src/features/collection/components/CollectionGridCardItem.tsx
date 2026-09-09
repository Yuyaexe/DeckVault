"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { CardImage } from "@/components/shared/CardImage";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { useCollectionCardImage } from "@/hooks/useCollectionCardImage";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { dragHandleProps, useDragReorder } from "@/hooks/useDragReorder";
import type { DemoOwnedCard } from "@/lib/demo/types";

interface CollectionGridCardItemProps {
  item: DemoOwnedCard;
  selected: boolean;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onSelect: () => void;
  onOpen: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CollectionGridCardItem({
  item,
  selected,
  dragHandlers,
  onSelect,
  onOpen,
  onQuantityChange,
  onRemove,
}: CollectionGridCardItemProps) {
  const t = useT();
  const { thumbSrc, fallbackSrc, loading } = useCollectionCardImage(item);
  const dragOver = dragHandlers.isDragOver(item.id);

  return (
    <div
      {...dragHandleProps(dragHandlers, item.id)}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/60 bg-card/40 p-2 transition-all hover:border-primary/40 hover:shadow-md cursor-grab active:cursor-grabbing",
        selected && "border-primary/50 ring-1 ring-primary/30",
        dragOver && "border-primary ring-2 ring-primary/30"
      )}
    >
      <div className="absolute left-2 top-2 z-10">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          className="bg-background/80 backdrop-blur-sm"
          aria-label={t("collection.selectCard", { name: item.card.name })}
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="relative mx-auto aspect-[59/86] w-full max-w-[140px] overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border/30 transition-transform group-hover:scale-[1.02]"
      >
        <CardImage
          src={thumbSrc}
          fallbackSrc={fallbackSrc}
          loading={loading}
          alt={item.card.name}
          fill
          sizes="140px"
          className="object-contain p-1"
        />
      </button>

      <div className="mt-2 space-y-1.5 px-1">
        <button type="button" onClick={onOpen} className="w-full text-center">
          <p className="line-clamp-2 text-xs font-semibold leading-tight">{item.card.name}</p>
        </button>
        <div className="flex justify-center pt-0.5">
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
    </div>
  );
}

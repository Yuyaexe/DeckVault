"use client";

import { memo, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterCardThumb } from "@/features/anime-collection/components/CharacterCardThumb";
import { useAnimeCharacterUIStore } from "@/features/anime-collection/stores/anime-character-ui.store";
import { useGridColumns } from "@/hooks/useGridColumns";
import { dragHandleProps, useDragReorder } from "@/hooks/useDragReorder";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import type { AnimeCharacterCard } from "@/lib/demo/types";

/** Image (~204px) + name + qty controls + padding */
const CARD_ROW_HEIGHT = 300;

function CharacterGridCard({
  item,
  selected,
  allIds,
  rowIndex,
  onRemove,
  onQuantityChange,
  onOpenCard,
  onSelect,
  dragHandlers,
}: {
  item: AnimeCharacterCard;
  selected: boolean;
  allIds: string[];
  rowIndex: number;
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onOpenCard: (item: AnimeCharacterCard) => void;
  onSelect: (id: string, event: MouseEvent, rowIndex: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
}) {
  const t = useT();
  const dragOver = dragHandlers.isDragOver(item.id);

  const handleCardClick = (event: MouseEvent) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onSelect(item.id, event, rowIndex);
      return;
    }
    onOpenCard(item);
  };

  return (
    <div
      {...dragHandleProps(dragHandlers, item.id)}
      aria-selected={selected}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card/40 p-2 transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
        selected
          ? "border-primary ring-2 ring-primary/40 shadow-md shadow-primary/20"
          : "border-border/60 hover:border-primary/40",
        dragOver && !selected && "border-primary ring-2 ring-primary/30"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={t("collection.selectCard", { name: item.card.name })}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(item.id, event, rowIndex);
        }}
        className={cn(
          "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          selected
            ? "border-primary bg-primary text-primary-foreground opacity-100"
            : "border-white/40 bg-black/45 text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        <Check className="h-3 w-3 stroke-[3]" />
      </button>

      <button
        type="button"
        aria-label={t("anime.removeCard", { name: item.card.name })}
        onClick={() => onRemove(item.id)}
        className="absolute right-2 top-2 z-10 rounded-md bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <CharacterCardThumb
        item={item}
        selected={selected}
        className="mx-auto w-full max-w-[140px]"
        onClick={handleCardClick}
      />

      <div className="mt-2 space-y-1.5 px-1">
        <button
          type="button"
          onClick={handleCardClick}
          className="w-full text-center hover:text-primary"
        >
          <p className="line-clamp-2 text-xs font-semibold leading-tight">{item.card.name}</p>
          {item.quantity > 1 && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">×{item.quantity}</p>
          )}
        </button>
        <div className="flex items-center justify-center gap-1 pt-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label={t("qty.decrease")}
            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[2ch] text-center text-sm font-medium tabular-nums">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label={t("qty.increase")}
            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const MemoGridCard = memo(CharacterGridCard);

interface CharacterVirtualGridProps {
  cards: AnimeCharacterCard[];
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onOpenCard: (item: AnimeCharacterCard) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
}

/** Virtualized character card grid — only mounts visible rows. */
export function CharacterVirtualGrid({
  cards,
  onRemove,
  onQuantityChange,
  onOpenCard,
  dragHandlers,
}: CharacterVirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns();
  const rowCount = Math.ceil(cards.length / columns);
  const allIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const selectedIds = useAnimeCharacterUIStore((s) => s.selectedIds);
  const selectRow = useAnimeCharacterUIStore((s) => s.selectRow);
  const toggleSelect = useAnimeCharacterUIStore((s) => s.toggleSelect);

  const handleSelect = useCallback(
    (id: string, event: MouseEvent, rowIndex: number) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        selectRow(
          id,
          {
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          },
          allIds,
          rowIndex
        );
        return;
      }
      toggleSelect(id, false, allIds, rowIndex);
    },
    [allIds, selectRow, toggleSelect]
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ROW_HEIGHT,
    overscan: 2,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [cards.length, columns, virtualizer]);

  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="max-h-[min(70dvh,720px)] overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {rows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = cards.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full gap-3"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((item, colIndex) => {
                const rowIndex = startIndex + colIndex;
                return (
                  <MemoGridCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    allIds={allIds}
                    rowIndex={rowIndex}
                    onRemove={onRemove}
                    onQuantityChange={onQuantityChange}
                    onOpenCard={onOpenCard}
                    onSelect={handleSelect}
                    dragHandlers={dragHandlers}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

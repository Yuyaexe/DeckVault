"use client";

import { useEffect, useMemo, useState, useCallback, memo, type MouseEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardImage } from "@/components/shared/CardImage";
import {
  BinderEmptySlot,
  BinderLayoutToggle,
  BINDER_GRID_LAYOUTS,
} from "@/components/shared/binder/BinderChrome";
import { useCollectionCardImage } from "@/hooks/useCollectionCardImage";
import { cn } from "@/lib/utils";
import { useDragReorder, emptySlotDragProps, binderCardDragProps, pageNavDropProps } from "@/hooks/useDragReorder";
import {
  binderSpreadCount,
  binderSpreadSlots,
  firstAvailableSlotInSpread,
} from "@/lib/collections/binder-layout";
import {
  useCollectionUIStore,
} from "@/features/collection/stores/collection-ui.store";
import { useCollectionView } from "@/features/collection/context/collection-view-context";
import { useT } from "@/lib/i18n/context";
import type { DemoOwnedCard } from "@/lib/demo/types";

/** Matches the comfortable binder density at ~90% browser zoom. */
const BINDER_DISPLAY_ZOOM = 0.9;

function resolvePageCards(
  slotIds: (string | null)[],
  cardById: Map<string, DemoOwnedCard>
): (DemoOwnedCard | null)[] {
  return slotIds.map((id) => (id ? (cardById.get(id) ?? null) : null));
}

interface BinderSlotProps {
  card: DemoOwnedCard | null;
  selected: boolean;
  onOpen: () => void;
  onSelect: (event: MouseEvent) => void;
  onQuantityChange: (quantity: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  slotKey: string;
  globalIndex: number;
  moveToSlot: (draggedId: string, targetIndex: number) => void;
}

const BinderSlot = memo(function BinderSlot({
  card,
  selected,
  onOpen,
  onSelect,
  onQuantityChange,
  dragHandlers,
  slotKey,
  globalIndex,
  moveToSlot,
}: BinderSlotProps) {
  if (!card) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-col rounded-md transition-colors",
          dragHandlers.isDragOver(slotKey) && "ring-2 ring-primary/40"
        )}
        aria-hidden
        {...emptySlotDragProps(dragHandlers, slotKey, (draggedId) =>
          moveToSlot(draggedId, globalIndex)
        )}
      >
        <BinderEmptySlot />
      </div>
    );
  }

  return (
    <BinderSlotFilled
      card={card}
      selected={selected}
      onOpen={onOpen}
      onSelect={onSelect}
      onQuantityChange={onQuantityChange}
      dragHandlers={dragHandlers}
      globalIndex={globalIndex}
      moveToSlot={moveToSlot}
    />
  );
});

const BinderSlotFilled = memo(function BinderSlotFilled({
  card,
  selected,
  onOpen,
  onSelect,
  onQuantityChange,
  dragHandlers,
  globalIndex,
  moveToSlot,
}: {
  card: DemoOwnedCard;
  selected: boolean;
  onOpen: () => void;
  onSelect: (event: MouseEvent) => void;
  onQuantityChange: (quantity: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  globalIndex: number;
  moveToSlot: (draggedId: string, targetIndex: number) => void;
}) {
  const t = useT();
  const { thumbSrc, fallbackSrc, loading } = useCollectionCardImage(card);
  const dragOver = dragHandlers.isDragOver(card.id);

  const handleCardClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onSelect(event);
      return;
    }
    onOpen();
  };

  return (
    <div
      {...binderCardDragProps(dragHandlers, card.id, globalIndex, moveToSlot)}
      aria-selected={selected}
      className={cn(
        "group relative flex min-h-0 flex-col gap-0.5 rounded-lg transition-all duration-150 cursor-grab active:cursor-grabbing",
        selected
          ? "z-[1] -translate-y-0.5 shadow-lg shadow-primary/25 ring-2 ring-primary"
          : "ring-0",
        dragOver && !selected && "ring-2 ring-primary/40"
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={handleCardClick}
          title={card.card.name}
          className={cn(
            "relative aspect-[59/86] w-full shrink-0 overflow-hidden rounded-md bg-stone-900/10 shadow-sm",
            "transition-all hover:-translate-y-0.5 hover:shadow-md",
            "dark:bg-stone-950/40",
            selected
              ? "ring-2 ring-inset ring-primary/80"
              : "ring-1 ring-stone-900/10 hover:ring-primary/40 dark:ring-stone-100/10"
          )}
        >
          <CardImage
            src={thumbSrc}
            fallbackSrc={fallbackSrc}
            loading={loading}
            alt={card.card.name}
            fill
            sizes="(max-width: 768px) 20vw, 100px"
            className={cn(
              "object-contain p-0.5 transition-transform duration-150 group-hover:scale-[1.02]",
              selected && "scale-[1.02]"
            )}
          />

          {selected && (
            <span className="pointer-events-none absolute inset-0 bg-primary/15" aria-hidden />
          )}
        </button>

        <button
          type="button"
          aria-pressed={selected}
          aria-label={t("collection.selectCard", { name: card.card.name })}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(event);
          }}
          className={cn(
            "absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            selected
              ? "border-primary bg-primary text-primary-foreground opacity-100"
              : "border-white/40 bg-black/45 text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </button>

        <div
          className="absolute right-1 top-1 z-10 flex items-center overflow-hidden rounded-md bg-black/75 text-white shadow-sm ring-1 ring-white/15"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={t("qty.decrease")}
            onClick={() => onQuantityChange(card.quantity - 1)}
            className="flex h-5 w-5 items-center justify-center text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="min-w-[1.35rem] px-0.5 text-center text-[10px] font-bold tabular-nums">
            {card.quantity}
          </span>
          <button
            type="button"
            aria-label={t("qty.increase")}
            onClick={() => onQuantityChange(card.quantity + 1)}
            className="flex h-5 w-5 items-center justify-center text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCardClick}
        className={cn(
          "w-full shrink-0 truncate rounded-md px-1 py-0.5 text-left text-[8px] font-medium leading-tight ring-1 transition-colors",
          selected
            ? "bg-primary text-primary-foreground ring-primary/60"
            : "bg-zinc-900/90 text-white/80 ring-white/5 hover:bg-zinc-800/95 group-hover:ring-primary/20 dark:bg-zinc-950/90"
        )}
      >
        {card.card.name}
      </button>
    </div>
  );
});

interface BinderPageProps {
  cards: (DemoOwnedCard | null)[];
  side: "left" | "right";
  cols: number;
  rows: number;
  pageOffset: number;
  spreadIndex: number;
  spreadSize: number;
  selectedIds: Set<string>;
  allIds: string[];
  onOpen: (id: string) => void;
  onSelect: (id: string, event: MouseEvent, rowIndex: number) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  moveToSlot: (draggedId: string, targetIndex: number) => void;
}

function BinderPage({
  cards,
  side,
  cols,
  rows,
  pageOffset,
  spreadIndex,
  spreadSize,
  selectedIds,
  allIds,
  onOpen,
  onSelect,
  onQuantityChange,
  dragHandlers,
  moveToSlot,
}: BinderPageProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col p-1.5 sm:p-2",
        "bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/90",
        "dark:from-stone-800 dark:via-stone-900 dark:to-stone-950",
        side === "left"
          ? "rounded-t-xl md:rounded-l-2xl md:rounded-tr-none"
          : "rounded-b-xl md:rounded-r-2xl md:rounded-bl-none"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-1.5 w-5 opacity-30 sm:inset-y-2",
          side === "left"
            ? "right-0 bg-gradient-to-l from-stone-900/15 to-transparent"
            : "left-0 bg-gradient-to-r from-stone-900/15 to-transparent"
        )}
      />
      <div
        className="grid min-h-0 flex-1 gap-1 sm:gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
        }}
      >
        {cards.map((card, index) => {
          const globalIndex = spreadIndex * spreadSize + pageOffset + index;
          const slotKey = card?.id ?? `${side}-slot-${globalIndex}`;
          const rowIndex = card ? allIds.indexOf(card.id) : -1;
          return (
            <BinderSlot
              key={slotKey}
              card={card}
              selected={card ? selectedIds.has(card.id) : false}
              onOpen={() => card && onOpen(card.id)}
              onSelect={(event) => {
                if (!card || rowIndex < 0) return;
                onSelect(card.id, event, rowIndex);
              }}
              onQuantityChange={(quantity) => {
                if (!card) return;
                onQuantityChange(card.id, quantity);
              }}
              dragHandlers={dragHandlers}
              slotKey={slotKey}
              globalIndex={globalIndex}
              moveToSlot={moveToSlot}
            />
          );
        })}
      </div>
    </div>
  );
}

interface BinderSpreadNavProps {
  spreadIndex: number;
  totalSpreads: number;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onPrevious: () => void;
  onNext: () => void;
  onDropToSpread: (draggedId: string, targetSpread: number) => void;
}

function BinderSpreadNav({
  spreadIndex,
  totalSpreads,
  dragHandlers,
  onPrevious,
  onNext,
  onDropToSpread,
}: BinderSpreadNavProps) {
  const t = useT();
  const dragging = dragHandlers.draggedId != null;
  const prevDropDisabled = spreadIndex <= 0;
  const canDropNext = spreadIndex < totalSpreads - 1 || dragging;
  const overPrev = dragHandlers.isDragOver("binder-nav-prev");
  const overNext = dragHandlers.isDragOver("binder-nav-next");
  const showNavHint = dragging && (overPrev || overNext);

  return (
    <div className="flex shrink-0 items-center justify-center gap-4 border-t border-border/60 bg-card/40 px-4 py-3 backdrop-blur-sm">
      <div
        className={cn(
          "rounded-lg transition-colors",
          overPrev && "bg-primary/10 ring-2 ring-primary/50"
        )}
        {...pageNavDropProps(
          dragHandlers,
          "binder-nav-prev",
          (draggedId) => onDropToSpread(draggedId, spreadIndex - 1),
          prevDropDisabled
        )}
      >
        <Button
          variant="outline"
          size="sm"
          disabled={prevDropDisabled}
          onClick={onPrevious}
          aria-label={t("binder.previous")}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t("binder.previous")}</span>
        </Button>
      </div>

      <span className="min-w-[7rem] text-center text-sm tabular-nums text-muted-foreground">
        {showNavHint ? (
          <span className="text-xs text-primary">{t("binder.dropToChangePage")}</span>
        ) : (
          t("binder.pageOf", { current: spreadIndex + 1, total: totalSpreads })
        )}
      </span>

      <div
        className={cn(
          "rounded-lg transition-colors",
          overNext && "bg-primary/10 ring-2 ring-primary/50"
        )}
        {...pageNavDropProps(
          dragHandlers,
          "binder-nav-next",
          (draggedId) => onDropToSpread(draggedId, spreadIndex + 1),
          !canDropNext
        )}
      >
        <Button
          variant="outline"
          size="sm"
          disabled={spreadIndex >= totalSpreads - 1}
          onClick={onNext}
          aria-label={t("binder.next")}
        >
          <span className="hidden sm:inline">{t("binder.next")}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CollectionBinderView() {
  const t = useT();
  const data = useCollectionView();
  const selectedIds = useCollectionUIStore((s) => s.selectedIds);
  const selectRow = useCollectionUIStore((s) => s.selectRow);
  const toggleSelect = useCollectionUIStore((s) => s.toggleSelect);
  const openCardInspect = useCollectionUIStore((s) => s.openCardInspect);
  const binderGridLayout = useCollectionUIStore((s) => s.binderGridLayout);
  const setBinderGridLayout = useCollectionUIStore((s) => s.setBinderGridLayout);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const dragHandlers = useDragReorder(data.reorderCard);

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
          data.allIds,
          rowIndex
        );
        return;
      }
      toggleSelect(id, false, data.allIds, rowIndex);
    },
    [data.allIds, selectRow, toggleSelect]
  );

  const { cols, rows, label, maxWidth } = BINDER_GRID_LAYOUTS[binderGridLayout];
  const pageSize = cols * rows;
  const spreadSize = pageSize * 2;

  const cardById = useMemo(
    () => new Map(data.filtered.map((card) => [card.id, card])),
    [data.filtered]
  );

  const totalSpreads = useMemo(
    () => binderSpreadCount(data.binderLayout, spreadSize),
    [data.binderLayout, spreadSize]
  );

  const pageResetKey = useMemo(
    () =>
      `${binderGridLayout}:${data.filtered
        .map((card) => card.id)
        .sort()
        .join(",")}`,
    [binderGridLayout, data.filtered]
  );

  useEffect(() => {
    setSpreadIndex(0);
  }, [pageResetKey]);

  useEffect(() => {
    if (spreadIndex >= totalSpreads) {
      setSpreadIndex(Math.max(0, totalSpreads - 1));
    }
  }, [spreadIndex, totalSpreads]);

  const currentSpreadSlots = useMemo(
    () => binderSpreadSlots(data.binderLayout, spreadIndex, spreadSize),
    [data.binderLayout, spreadIndex, spreadSize]
  );

  const leftPage = useMemo(
    () => resolvePageCards(currentSpreadSlots.slice(0, pageSize), cardById),
    [currentSpreadSlots, pageSize, cardById]
  );

  const rightPage = useMemo(
    () => resolvePageCards(currentSpreadSlots.slice(pageSize, spreadSize), cardById),
    [currentSpreadSlots, spreadSize, pageSize, cardById]
  );

  const cardsOnSpread = currentSpreadSlots.filter(Boolean).length;

  const { binderLayout, moveCardToBinderSlot } = data;

  const handleDropToSpread = useCallback(
    (draggedId: string, targetSpread: number) => {
      if (targetSpread < 0) return;
      const targetIndex = firstAvailableSlotInSpread(
        binderLayout,
        targetSpread,
        spreadSize
      );
      moveCardToBinderSlot(draggedId, targetIndex);
      setSpreadIndex(targetSpread);
    },
    [binderLayout, moveCardToBinderSlot, spreadSize]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-zinc-950 via-zinc-900/95 to-background">
      <div className="flex flex-1 flex-col items-center overflow-auto px-2 py-2 sm:px-4 sm:py-4">
        <div
          className={cn("w-full", maxWidth)}
          style={{ zoom: BINDER_DISPLAY_ZOOM }}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground sm:mb-3 sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground/80">
                {t("binder.label", { layout: label })}
              </span>
              <BinderLayoutToggle
                layout={binderGridLayout}
                onChange={setBinderGridLayout}
                ariaLabel={t("collection.binderGridLayout")}
              />
            </div>
            <span className="tabular-nums">
              {t("binder.cardsOnPageTotal", {
                onPage: cardsOnSpread,
                total: data.filtered.length,
              })}
            </span>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/20 md:flex-row md:rounded-2xl">
            <BinderPage
              cards={leftPage}
              side="left"
              cols={cols}
              rows={rows}
              pageOffset={0}
              spreadIndex={spreadIndex}
              spreadSize={spreadSize}
              selectedIds={selectedIds}
              allIds={data.allIds}
              onOpen={(id) => openCardInspect(id, "details")}
              onSelect={handleSelect}
              onQuantityChange={data.handleQuantityChange}
              dragHandlers={dragHandlers}
              moveToSlot={data.moveCardToBinderSlot}
            />

            <div
              className="relative h-2 w-full shrink-0 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 md:h-auto md:w-3 md:bg-gradient-to-b lg:w-4"
              aria-hidden
            >
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-amber-950/80 md:inset-y-0 md:left-1/2 md:h-full md:w-px md:translate-x-[-50%] md:translate-y-0" />
            </div>

            <BinderPage
              cards={rightPage}
              side="right"
              cols={cols}
              rows={rows}
              pageOffset={pageSize}
              spreadIndex={spreadIndex}
              spreadSize={spreadSize}
              selectedIds={selectedIds}
              allIds={data.allIds}
              onOpen={(id) => openCardInspect(id, "details")}
              onSelect={handleSelect}
              onQuantityChange={data.handleQuantityChange}
              dragHandlers={dragHandlers}
              moveToSlot={data.moveCardToBinderSlot}
            />
          </div>
        </div>
      </div>

      <BinderSpreadNav
        spreadIndex={spreadIndex}
        totalSpreads={totalSpreads}
        dragHandlers={dragHandlers}
        onPrevious={() => setSpreadIndex((i) => Math.max(0, i - 1))}
        onNext={() => setSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1))}
        onDropToSpread={handleDropToSpread}
      />
    </div>
  );
}

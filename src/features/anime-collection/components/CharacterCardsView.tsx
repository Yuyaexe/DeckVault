"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Minus,
  Plus,
} from "lucide-react";
import {
  BinderEmptySlot,
  BinderLayoutToggle,
  BinderPagePanel,
  BinderSpine,
  BinderSpreadFrame,
  BINDER_GRID_LAYOUTS,
  type BinderGridLayoutId,
} from "@/components/shared/binder/BinderChrome";
import { Button } from "@/components/ui/button";
import { CharacterCardThumb } from "@/features/anime-collection/components/CharacterCardThumb";
import { CharacterVirtualGrid } from "@/features/anime-collection/components/CharacterVirtualGrid";
import { useAnimeCharacterUIStore } from "@/features/anime-collection/stores/anime-character-ui.store";
import {
  binderSpreadCount,
  binderSpreadSlots,
  firstAvailableSlotInSpread,
  mergeBinderLayout,
} from "@/lib/collections/binder-layout";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";
import {
  useDragReorder,
  emptySlotDragProps,
  binderCardDragProps,
  pageNavDropProps,
} from "@/hooks/useDragReorder";
import type { AnimeCharacterCard } from "@/lib/demo/types";

export type CharacterCardsViewMode = "grid" | "binder";
type BinderLayout = BinderGridLayoutId;

const VIEW_STORAGE_KEY = "deckvault-anime-character-cards-view";
const BINDER_LAYOUT_KEY = "deckvault-anime-character-binder-layout";

function usePersistedViewMode(): [CharacterCardsViewMode, (mode: CharacterCardsViewMode) => void] {
  const [mode, setMode] = useState<CharacterCardsViewMode>("grid");

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "binder") setMode(stored);
  }, []);

  const update = (next: CharacterCardsViewMode) => {
    setMode(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  return [mode, update];
}

function usePersistedBinderLayout(): [BinderLayout, (layout: BinderLayout) => void] {
  const [layout, setLayout] = useState<BinderLayout>("4x3");

  useEffect(() => {
    const stored = localStorage.getItem(BINDER_LAYOUT_KEY);
    if (stored === "4x3" || stored === "3x3") setLayout(stored);
  }, []);

  const update = (next: BinderLayout) => {
    setLayout(next);
    localStorage.setItem(BINDER_LAYOUT_KEY, next);
  };

  return [layout, update];
}

export interface CharacterCardsViewProps {
  cards: AnimeCharacterCard[];
  binderSlotLayout: (string | null)[];
  onRemove: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onOpenCard: (item: AnimeCharacterCard) => void;
  onReorder: (draggedId: string, targetId: string | null) => void;
  onMoveToBinderSlot: (cardIds: string[], targetIndex: number) => void;
  onMoveToBinderSpread: (cardIds: string[], targetSpreadIndex: number, spreadSize: number) => void;
  /** Controlled spread index for bulk "move to spread" from the page. */
  spreadIndex?: number;
  onSpreadIndexChange?: (index: number) => void;
  totalSpreadsRef?: { current: number };
}

function resolveBatchIds(
  draggedId: string,
  selectedIds: Set<string>,
  allIds: string[]
): string[] {
  if (selectedIds.has(draggedId) && selectedIds.size > 1) {
    return allIds.filter((id) => selectedIds.has(id));
  }
  return [draggedId];
}

function CharacterBinderSlot({
  item,
  selected,
  allIds,
  onOpenCard,
  onSelect,
  onQuantityChange,
  dragHandlers,
  slotKey,
  globalIndex,
  onMoveToSlot,
  onDragBatchStart,
}: {
  item: AnimeCharacterCard | null;
  selected: boolean;
  allIds: string[];
  onOpenCard: (item: AnimeCharacterCard) => void;
  onSelect: (id: string, event: MouseEvent, rowIndex: number) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  slotKey: string;
  globalIndex: number;
  onMoveToSlot: (draggedId: string, targetIndex: number) => void;
  onDragBatchStart: (cardId: string) => void;
}) {
  const t = useT();

  if (!item) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 rounded-md transition-colors",
          dragHandlers.isDragOver(slotKey) && "ring-2 ring-primary/40"
        )}
        aria-hidden
        {...emptySlotDragProps(dragHandlers, slotKey, (draggedId) =>
          onMoveToSlot(draggedId, globalIndex)
        )}
      >
        <BinderEmptySlot />
      </div>
    );
  }

  const dragOver = dragHandlers.isDragOver(item.id);
  const rowIndex = allIds.indexOf(item.id);

  const handleCardClick = (event: MouseEvent) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onSelect(item.id, event, rowIndex);
      return;
    }
    onOpenCard(item);
  };

  const dragProps = binderCardDragProps(
    dragHandlers,
    item.id,
    globalIndex,
    onMoveToSlot
  );

  return (
    <div
      {...dragProps}
      onDragStart={(e) => {
        onDragBatchStart(item.id);
        dragProps.onDragStart(e);
      }}
      aria-selected={selected}
      className={cn(
        "group relative flex flex-col gap-1 rounded-lg transition-all duration-150 cursor-grab active:cursor-grabbing",
        selected
          ? "z-[1] -translate-y-0.5 shadow-lg shadow-primary/25 ring-2 ring-primary"
          : "ring-0",
        dragOver && !selected && "ring-2 ring-primary/40"
      )}
    >
      <div className="relative">
        <CharacterCardThumb
          item={item}
          selected={selected}
          className="w-full rounded-md ring-stone-900/10 dark:ring-stone-100/10"
          onClick={handleCardClick}
        />
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
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={t("qty.decrease")}
            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
            className="flex h-5 w-5 items-center justify-center text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="min-w-[1.35rem] px-0.5 text-center text-[10px] font-bold tabular-nums">
            {item.quantity}
          </span>
          <button
            type="button"
            aria-label={t("qty.increase")}
            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
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
          "w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-medium ring-1 transition-colors",
          selected
            ? "bg-primary text-primary-foreground ring-primary/60"
            : "bg-zinc-900/90 text-white/75 ring-white/5 hover:bg-zinc-800/95 hover:text-white group-hover:ring-primary/20 dark:bg-zinc-950/90"
        )}
      >
        {item.card.name}
      </button>
    </div>
  );
}

function CharacterBinderSpreadNav({
  spreadIndex,
  totalSpreads,
  dragHandlers,
  onPrevious,
  onNext,
  onDropToSpread,
}: {
  spreadIndex: number;
  totalSpreads: number;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onPrevious: () => void;
  onNext: () => void;
  onDropToSpread: (draggedId: string, targetSpread: number) => void;
}) {
  const t = useT();
  const dragging = dragHandlers.draggedId != null;
  const prevDropDisabled = spreadIndex <= 0;
  const canDropNext = spreadIndex < totalSpreads - 1 || dragging;
  const overPrev = dragHandlers.isDragOver("binder-nav-prev");
  const overNext = dragHandlers.isDragOver("binder-nav-next");
  const showNavHint = dragging && (overPrev || overNext);

  return (
    <div className="mt-3 flex items-center justify-center gap-4">
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
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={spreadIndex === 0}
          onClick={onPrevious}
          aria-label={t("anime.previousSpread")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <span className="min-w-[7rem] text-center text-xs tabular-nums text-muted-foreground">
        {showNavHint ? (
          <span className="text-primary">{t("binder.dropToChangePage")}</span>
        ) : (
          t("anime.spreadOf", { current: spreadIndex + 1, total: totalSpreads })
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
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={spreadIndex >= totalSpreads - 1 && !dragging}
          onClick={onNext}
          aria-label={t("anime.nextSpread")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CharacterBinderView({
  cards,
  binderSlotLayout,
  layout,
  onLayoutChange,
  onOpenCard,
  onQuantityChange,
  dragHandlers,
  onMoveToBinderSlot,
  onMoveToBinderSpread,
  spreadIndex: controlledSpread,
  onSpreadIndexChange,
}: {
  cards: AnimeCharacterCard[];
  binderSlotLayout: (string | null)[];
  layout: BinderLayout;
  onLayoutChange: (layout: BinderLayout) => void;
  onOpenCard: (item: AnimeCharacterCard) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  dragHandlers: ReturnType<typeof useDragReorder>;
  onMoveToBinderSlot: (cardIds: string[], targetIndex: number) => void;
  onMoveToBinderSpread: (cardIds: string[], targetSpreadIndex: number, spreadSize: number) => void;
  spreadIndex?: number;
  onSpreadIndexChange?: (index: number) => void;
}) {
  const t = useT();
  const [localSpread, setLocalSpread] = useState(0);
  const spreadIndex = controlledSpread ?? localSpread;
  const setSpreadIndex = onSpreadIndexChange ?? setLocalSpread;

  const selectedIds = useAnimeCharacterUIStore((s) => s.selectedIds);
  const selectRow = useAnimeCharacterUIStore((s) => s.selectRow);
  const toggleSelect = useAnimeCharacterUIStore((s) => s.toggleSelect);
  const setDraggedCardIds = useAnimeCharacterUIStore((s) => s.setDraggedCardIds);

  const { cols, rows, label, maxWidth } = BINDER_GRID_LAYOUTS[layout];
  const pageSize = cols * rows;
  const spreadSize = pageSize * 2;
  const allIds = useMemo(() => cards.map((c) => c.id), [cards]);

  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const slotLayout = useMemo(() => {
    const ids = cards.map((card) => card.id);
    return mergeBinderLayout(binderSlotLayout.length ? binderSlotLayout : ids, ids);
  }, [binderSlotLayout, cards]);

  const totalSpreads = useMemo(
    () => binderSpreadCount(slotLayout, spreadSize),
    [slotLayout, spreadSize]
  );

  useEffect(() => {
    if (controlledSpread == null) setLocalSpread(0);
  }, [layout, controlledSpread]);

  useEffect(() => {
    if (spreadIndex >= totalSpreads) {
      setSpreadIndex(Math.max(0, totalSpreads - 1));
    }
  }, [spreadIndex, totalSpreads, setSpreadIndex]);

  const currentSlots = useMemo(
    () => binderSpreadSlots(slotLayout, spreadIndex, spreadSize),
    [slotLayout, spreadIndex, spreadSize]
  );

  const leftPage = useMemo(
    () =>
      currentSlots
        .slice(0, pageSize)
        .map((id) => (id ? (cardById.get(id) ?? null) : null)),
    [currentSlots, pageSize, cardById]
  );

  const rightPage = useMemo(
    () =>
      currentSlots
        .slice(pageSize, spreadSize)
        .map((id) => (id ? (cardById.get(id) ?? null) : null)),
    [currentSlots, pageSize, spreadSize, cardById]
  );

  const cardsOnSpread = useMemo(
    () => currentSlots.filter((id): id is string => !!id && cardById.has(id)).length,
    [currentSlots, cardById]
  );

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

  const handleDragBatchStart = useCallback(
    (cardId: string) => {
      setDraggedCardIds(resolveBatchIds(cardId, selectedIds, allIds));
    },
    [allIds, selectedIds, setDraggedCardIds]
  );

  const handleMoveToSlot = useCallback(
    (draggedId: string, targetIndex: number) => {
      const ids = resolveBatchIds(draggedId, selectedIds, allIds);
      onMoveToBinderSlot(ids, targetIndex);
      setDraggedCardIds([]);
    },
    [allIds, onMoveToBinderSlot, selectedIds, setDraggedCardIds]
  );

  const handleDropToSpread = useCallback(
    (draggedId: string, targetSpread: number) => {
      if (targetSpread < 0) return;
      const ids = resolveBatchIds(draggedId, selectedIds, allIds);
      // Allow dropping onto a new last spread when dragging past the end
      const maxSpread = Math.max(
        totalSpreads - 1,
        firstAvailableSlotInSpread(slotLayout, targetSpread, spreadSize) >= 0
          ? targetSpread
          : totalSpreads - 1
      );
      const clamped = Math.min(targetSpread, maxSpread + 1);
      onMoveToBinderSpread(ids, clamped, spreadSize);
      setSpreadIndex(clamped);
      setDraggedCardIds([]);
    },
    [
      allIds,
      onMoveToBinderSpread,
      selectedIds,
      setDraggedCardIds,
      setSpreadIndex,
      slotLayout,
      spreadSize,
      totalSpreads,
    ]
  );

  const renderPage = (
    pageCards: (AnimeCharacterCard | null)[],
    side: "left" | "right",
    pageOffset: number
  ) => (
    <BinderPagePanel side={side} cols={cols} rows={rows}>
      {pageCards.map((item, index) => {
        const globalIndex = spreadIndex * spreadSize + pageOffset + index;
        const slotKey = `${side}-slot-${globalIndex}`;
        return (
          <CharacterBinderSlot
            key={slotKey}
            item={item}
            selected={item ? selectedIds.has(item.id) : false}
            allIds={allIds}
            onOpenCard={onOpenCard}
            onSelect={handleSelect}
            onQuantityChange={onQuantityChange}
            dragHandlers={dragHandlers}
            slotKey={slotKey}
            globalIndex={globalIndex}
            onMoveToSlot={handleMoveToSlot}
            onDragBatchStart={handleDragBatchStart}
          />
        );
      })}
    </BinderPagePanel>
  );

  return (
    <BinderSpreadFrame maxWidth={maxWidth}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground sm:mb-3 sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground/80">Binder · {label}</span>
          <BinderLayoutToggle
            layout={layout}
            onChange={onLayoutChange}
            ariaLabel={t("collection.binderGridLayout")}
          />
        </div>
        <span className="tabular-nums">
          {cardsOnSpread} / {cards.length}
        </span>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/20 md:flex-row md:rounded-2xl">
        {renderPage(leftPage, "left", 0)}
        <BinderSpine />
        {renderPage(rightPage, "right", pageSize)}
      </div>

      {(totalSpreads > 1 || dragHandlers.draggedId != null) && (
        <CharacterBinderSpreadNav
          spreadIndex={spreadIndex}
          totalSpreads={Math.max(totalSpreads, 1)}
          dragHandlers={dragHandlers}
          onPrevious={() => setSpreadIndex(Math.max(0, spreadIndex - 1))}
          onNext={() => setSpreadIndex(Math.min(totalSpreads - 1, spreadIndex + 1))}
          onDropToSpread={handleDropToSpread}
        />
      )}
    </BinderSpreadFrame>
  );
}

function ViewModeSwitcher({
  mode,
  onChange,
}: {
  mode: CharacterCardsViewMode;
  onChange: (mode: CharacterCardsViewMode) => void;
}) {
  const t = useT();
  const modes: { id: CharacterCardsViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { id: "grid", label: t("anime.viewGrid"), icon: LayoutGrid },
    { id: "binder", label: t("anime.viewBinder"), icon: BookOpen },
  ];

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5"
      role="group"
      aria-label={t("anime.cardViewMode")}
    >
      {modes.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 px-2.5 text-xs", mode === id && "bg-background shadow-sm")}
          onClick={() => onChange(id)}
          aria-pressed={mode === id}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
}

export function CharacterCardsView({
  cards,
  binderSlotLayout,
  onRemove,
  onQuantityChange,
  onOpenCard,
  onReorder,
  onMoveToBinderSlot,
  onMoveToBinderSpread,
  spreadIndex,
  onSpreadIndexChange,
}: CharacterCardsViewProps) {
  const t = useT();
  const [viewMode, setViewMode] = usePersistedViewMode();
  const [binderLayout, setBinderLayout] = usePersistedBinderLayout();
  const dragHandlers = useDragReorder(onReorder);
  const setDraggedCardIds = useAnimeCharacterUIStore((s) => s.setDraggedCardIds);

  useEffect(() => {
    if (!dragHandlers.draggedId) {
      setDraggedCardIds([]);
    }
  }, [dragHandlers.draggedId, setDraggedCardIds]);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("anime.dragToReorder")}</p>
        <ViewModeSwitcher mode={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === "grid" ? (
        <CharacterVirtualGrid
          cards={cards}
          onRemove={onRemove}
          onQuantityChange={onQuantityChange}
          onOpenCard={onOpenCard}
          dragHandlers={dragHandlers}
        />
      ) : (
        <CharacterBinderView
          cards={cards}
          binderSlotLayout={binderSlotLayout}
          layout={binderLayout}
          onLayoutChange={setBinderLayout}
          onOpenCard={onOpenCard}
          onQuantityChange={onQuantityChange}
          dragHandlers={dragHandlers}
          onMoveToBinderSlot={onMoveToBinderSlot}
          onMoveToBinderSpread={onMoveToBinderSpread}
          spreadIndex={spreadIndex}
          onSpreadIndexChange={onSpreadIndexChange}
        />
      )}
    </>
  );
}

/** Expose spread size helper for bulk actions (4x3 → 24, 3x3 → 18). */
export function getAnimeBinderSpreadSize(layout: BinderLayout = "4x3"): number {
  const { cols, rows } = BINDER_GRID_LAYOUTS[layout];
  return cols * rows * 2;
}

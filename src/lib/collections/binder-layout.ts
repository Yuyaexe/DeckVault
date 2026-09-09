/** Shared 4×3 / 3×3 binder grid presets (TCG collection + anime character binders). */
export type BinderGridLayoutId = "4x3" | "3x3";

export const BINDER_GRID_LAYOUTS: Record<
  BinderGridLayoutId,
  { cols: number; rows: number; label: string; maxWidth: string }
> = {
  "4x3": { cols: 4, rows: 3, label: "4×3", maxWidth: "max-w-7xl" },
  "3x3": { cols: 3, rows: 3, label: "3×3", maxWidth: "max-w-5xl" },
};

/** Move a card into a binder slot (null = empty). Swaps when the target is occupied. */
export function moveCardToBinderSlot(
  layout: (string | null)[],
  draggedId: string,
  targetIndex: number
): (string | null)[] {
  const next = [...layout];
  const fromIndex = next.indexOf(draggedId);
  const displaced = next[targetIndex] ?? null;

  while (next.length <= targetIndex) {
    next.push(null);
  }

  if (fromIndex !== -1) {
    next[fromIndex] = null;
  }

  next[targetIndex] = draggedId;

  if (fromIndex !== -1 && displaced && displaced !== draggedId) {
    next[fromIndex] = displaced;
  }

  return trimBinderLayout(next);
}

/** Drop removed ids, append new ids into the first empty slots (or end). */
export function mergeBinderLayout(
  saved: (string | null)[],
  currentCardIds: string[]
): (string | null)[] {
  const currentSet = new Set(currentCardIds);
  const next = saved.map((id) => (id && currentSet.has(id) ? id : null));

  const placed = new Set(next.filter((id): id is string => id != null));
  for (const id of currentCardIds) {
    if (placed.has(id)) continue;
    const emptyIndex = next.indexOf(null);
    if (emptyIndex !== -1) {
      next[emptyIndex] = id;
    } else {
      next.push(id);
    }
    placed.add(id);
  }

  return trimBinderLayout(next);
}

export function compactBinderLayout(layout: (string | null)[]): string[] {
  return layout.filter((id): id is string => id != null);
}

function trimBinderLayout(layout: (string | null)[]): (string | null)[] {
  let lastIndex = -1;
  for (let i = 0; i < layout.length; i++) {
    if (layout[i] != null) lastIndex = i;
  }
  if (lastIndex === -1) return [];
  return layout.slice(0, lastIndex + 1);
}

export function initialBinderLayout(cardIds: string[]): (string | null)[] {
  return [...cardIds];
}

export function binderSpreadCount(layout: (string | null)[], spreadSize: number): number {
  if (layout.length === 0) return 1;
  return Math.max(1, Math.ceil(layout.length / spreadSize));
}

/** Resolve global slot indices into a spread-sized array of card ids (or null). */
export function binderSpreadSlots(
  layout: (string | null)[],
  spreadIndex: number,
  spreadSize: number
): (string | null)[] {
  const start = spreadIndex * spreadSize;
  return Array.from({ length: spreadSize }, (_, i) => layout[start + i] ?? null);
}

/** First empty slot in a spread, or the spread's first slot if full. */
export function firstAvailableSlotInSpread(
  layout: (string | null)[],
  spreadIndex: number,
  spreadSize: number
): number {
  const start = spreadIndex * spreadSize;
  for (let i = 0; i < spreadSize; i++) {
    const idx = start + i;
    if (idx >= layout.length || layout[idx] == null) return idx;
  }
  return start;
}

/** How many empty pockets a spread has. */
export function countEmptySlotsInSpread(
  layout: (string | null)[],
  spreadIndex: number,
  spreadSize: number
): number {
  return binderSpreadSlots(layout, spreadIndex, spreadSize).filter((id) => id == null).length;
}

/** True when the spread has no empty pockets. */
export function isBinderSpreadFull(
  layout: (string | null)[],
  spreadIndex: number,
  spreadSize: number
): boolean {
  return countEmptySlotsInSpread(layout, spreadIndex, spreadSize) === 0;
}

/** Remove card ids from layout (preserve other null pockets). */
export function removeIdsFromBinderLayout(
  layout: (string | null)[],
  cardIds: string[]
): (string | null)[] {
  const removeSet = new Set(cardIds);
  const next = layout.map((id) => (id && removeSet.has(id) ? null : id));
  return trimBinderLayout(next);
}

/**
 * Place cards into consecutive empty slots starting at `startIndex`.
 * Extends the layout when needed. Existing occupied slots are skipped.
 */
export function placeCardsAtBinderIndex(
  layout: (string | null)[],
  cardIds: string[],
  startIndex: number
): (string | null)[] {
  if (cardIds.length === 0) return layout;
  const next = [...layout];
  let cursor = Math.max(0, startIndex);

  for (const id of cardIds) {
    while (cursor < next.length && next[cursor] != null) {
      cursor++;
    }
    while (next.length <= cursor) {
      next.push(null);
    }
    next[cursor] = id;
    cursor++;
  }

  return trimBinderLayout(next);
}

/** Move multiple cards into a spread, packing into empty slots from the first available. */
export function moveCardsToBinderSpread(
  layout: (string | null)[],
  cardIds: string[],
  targetSpreadIndex: number,
  spreadSize: number
): (string | null)[] {
  if (cardIds.length === 0 || targetSpreadIndex < 0) return layout;
  const without = removeIdsFromBinderLayout(layout, cardIds);
  const start = firstAvailableSlotInSpread(without, targetSpreadIndex, spreadSize);
  return placeCardsAtBinderIndex(without, cardIds, start);
}

/** Move multiple cards starting at a target slot index (stable order). */
export function moveCardsToBinderSlotBatch(
  layout: (string | null)[],
  cardIds: string[],
  targetIndex: number
): (string | null)[] {
  if (cardIds.length === 0) return layout;
  if (cardIds.length === 1) {
    return moveCardToBinderSlot(layout, cardIds[0]!, targetIndex);
  }
  const without = removeIdsFromBinderLayout(layout, cardIds);
  return placeCardsAtBinderIndex(without, cardIds, targetIndex);
}

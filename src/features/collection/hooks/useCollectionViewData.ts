"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { applyCollectionFilters, sortOwnedCards } from "@/features/collection/utils/filters";
import { openCardTraderManaSearch } from "@/features/market/hooks/useCardTraderPrices";
import { useAppData } from "@/hooks/useAppData";
import { useDataUiStore } from "@/lib/data/ui-store";
import { mergeIdOrder } from "@/lib/collections/card-order";
import {
  initialBinderLayout,
  mergeBinderLayout,
} from "@/lib/collections/binder-layout";
import type { DemoOwnedCard } from "@/lib/demo/types";

const EMPTY_ORDER: string[] = [];
const EMPTY_LAYOUT: (string | null)[] = [];

export interface CollectionViewData {
  filtered: DemoOwnedCard[];
  allIds: string[];
  collectionCards: DemoOwnedCard[];
  isLoading: boolean;
  isError: boolean;
  handleQuantityChange: (id: string, quantity: number) => void;
  handleRemove: (id: string) => void;
  openCardTraderLink: (item: DemoOwnedCard) => void;
  activeCollectionId: string | null;
  reorderCard: (draggedId: string, targetId: string | null) => void;
  reorderCardToIndex: (draggedId: string, targetIndex: number) => void;
  binderLayout: (string | null)[];
  moveCardToBinderSlot: (draggedId: string, targetIndex: number) => void;
}

export function useCollectionViewData(): CollectionViewData {
  const {
    ownedCards,
    activeCollectionId,
    updateOwnedCard,
    isLoading,
    isError,
  } = useAppData();

  const filters = useCollectionUIStore((s) => s.filters);
  const sortField = useCollectionUIStore((s) => s.sortField);
  const sortDir = useCollectionUIStore((s) => s.sortDir);
  const focusedRowIndex = useCollectionUIStore((s) => s.focusedRowIndex);
  const setFocusedRowIndex = useCollectionUIStore((s) => s.setFocusedRowIndex);
  const requestDeleteCard = useCollectionUIStore((s) => s.requestDeleteCard);

  const savedOrder = useDataUiStore(
    (s) => (activeCollectionId ? s.cardOrderByCollection[activeCollectionId] : undefined) ?? EMPTY_ORDER
  );
  const savedLayout = useDataUiStore(
    (s) =>
      (activeCollectionId ? s.binderLayoutByCollection[activeCollectionId] : undefined) ??
      EMPTY_LAYOUT
  );
  const reorderCardInStore = useDataUiStore((s) => s.reorderCard);
  const reorderCardToIndexInStore = useDataUiStore((s) => s.reorderCardToIndex);
  const moveCardToBinderSlotInStore = useDataUiStore((s) => s.moveCardToBinderSlot);

  const collectionCards = useMemo(
    () => ownedCards.filter((oc) => oc.collectionId === activeCollectionId),
    [ownedCards, activeCollectionId]
  );

  const filtered = useMemo(() => {
    const f = applyCollectionFilters(collectionCards, filters);
    const sorted = sortOwnedCards(f, sortField, sortDir);

    if (!activeCollectionId || savedOrder.length === 0) return sorted;

    const merged = mergeIdOrder(
      savedOrder,
      sorted.map((item) => item.id)
    );
    const byId = new Map(sorted.map((item) => [item.id, item]));
    return merged
      .map((id) => byId.get(id))
      .filter((item): item is DemoOwnedCard => item != null);
  }, [collectionCards, filters, sortField, sortDir, savedOrder, activeCollectionId]);

  const allIds = useMemo(() => filtered.map((oc) => oc.id), [filtered]);

  const binderLayout = useMemo(() => {
    if (!activeCollectionId) return EMPTY_LAYOUT;
    const ids = filtered.map((item) => item.id);
    if (savedLayout.length) return mergeBinderLayout(savedLayout, ids);
    if (savedOrder.length) return mergeBinderLayout(savedOrder, ids);
    return initialBinderLayout(ids);
  }, [activeCollectionId, filtered, savedLayout, savedOrder]);

  useEffect(() => {
    if (focusedRowIndex >= filtered.length) {
      setFocusedRowIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, focusedRowIndex, setFocusedRowIndex]);

  const handleQuantityChange = useCallback(
    (id: string, quantity: number) => {
      if (quantity < 1) {
        requestDeleteCard(id);
        return;
      }
      void updateOwnedCard(id, { quantity });
    },
    [updateOwnedCard, requestDeleteCard]
  );

  const handleRemove = useCallback(
    (id: string) => {
      requestDeleteCard(id);
    },
    [requestDeleteCard]
  );

  const reorderCard = useCallback(
    (draggedId: string, targetId: string | null) => {
      if (!activeCollectionId) return;
      reorderCardInStore(activeCollectionId, draggedId, targetId);
    },
    [activeCollectionId, reorderCardInStore]
  );

  const reorderCardToIndex = useCallback(
    (draggedId: string, targetIndex: number) => {
      if (!activeCollectionId) return;
      reorderCardToIndexInStore(activeCollectionId, draggedId, targetIndex);
    },
    [activeCollectionId, reorderCardToIndexInStore]
  );

  const moveCardToBinderSlot = useCallback(
    (draggedId: string, targetIndex: number) => {
      if (!activeCollectionId) return;
      moveCardToBinderSlotInStore(activeCollectionId, draggedId, targetIndex);
    },
    [activeCollectionId, moveCardToBinderSlotInStore]
  );

  const openCardTraderLink = useCallback((item: DemoOwnedCard) => {
    void openCardTraderManaSearch(item);
  }, []);

  return useMemo(
    () => ({
      filtered,
      allIds,
      collectionCards,
      isLoading,
      isError,
      handleQuantityChange,
      handleRemove,
      openCardTraderLink,
      activeCollectionId,
      reorderCard,
      reorderCardToIndex,
      binderLayout,
      moveCardToBinderSlot,
    }),
    [
      filtered,
      allIds,
      collectionCards,
      isLoading,
      isError,
      handleQuantityChange,
      handleRemove,
      openCardTraderLink,
      activeCollectionId,
      reorderCard,
      reorderCardToIndex,
      binderLayout,
      moveCardToBinderSlot,
    ]
  );
}

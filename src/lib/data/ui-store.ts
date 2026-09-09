import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reorderIds, reorderIdsToIndex } from "@/lib/collections/card-order";
import { compactBinderLayout, moveCardToBinderSlot } from "@/lib/collections/binder-layout";

interface DataUiStore {
  activeCollectionId: string | null;
  collectionOrder: string[];
  cardOrderByCollection: Record<string, string[]>;
  binderLayoutByCollection: Record<string, (string | null)[]>;
  setActiveCollectionId: (id: string) => void;
  setCollectionOrder: (order: string[]) => void;
  setCardOrder: (collectionId: string, order: string[]) => void;
  setBinderLayout: (collectionId: string, layout: (string | null)[]) => void;
  reorderCard: (collectionId: string, draggedId: string, targetId: string | null) => void;
  reorderCardToIndex: (collectionId: string, draggedId: string, targetIndex: number) => void;
  moveCardToBinderSlot: (
    collectionId: string,
    draggedId: string,
    targetIndex: number
  ) => void;
}

export const useDataUiStore = create<DataUiStore>()(
  persist(
    (set, get) => ({
      activeCollectionId: null,
      collectionOrder: [],
      cardOrderByCollection: {},
      binderLayoutByCollection: {},
      setActiveCollectionId: (id) => set({ activeCollectionId: id }),
      setCollectionOrder: (order) => set({ collectionOrder: order }),
      setCardOrder: (collectionId, order) =>
        set((s) => ({
          cardOrderByCollection: { ...s.cardOrderByCollection, [collectionId]: order },
        })),
      setBinderLayout: (collectionId, layout) =>
        set((s) => ({
          binderLayoutByCollection: {
            ...s.binderLayoutByCollection,
            [collectionId]: layout,
          },
          cardOrderByCollection: {
            ...s.cardOrderByCollection,
            [collectionId]: compactBinderLayout(layout),
          },
        })),
      reorderCard: (collectionId, draggedId, targetId) => {
        const current = get().cardOrderByCollection[collectionId] ?? [];
        const next = reorderIds(current, draggedId, targetId);
        set((s) => ({
          cardOrderByCollection: {
            ...s.cardOrderByCollection,
            [collectionId]: next,
          },
          // Keep sparse binder pockets intact; binder drag uses moveCardToBinderSlot.
        }));
      },
      reorderCardToIndex: (collectionId, draggedId, targetIndex) => {
        const current = get().cardOrderByCollection[collectionId] ?? [];
        const next = reorderIdsToIndex(current, draggedId, targetIndex);
        set((s) => ({
          cardOrderByCollection: {
            ...s.cardOrderByCollection,
            [collectionId]: next,
          },
        }));
      },
      moveCardToBinderSlot: (collectionId, draggedId, targetIndex) => {
        const layout =
          get().binderLayoutByCollection[collectionId] ??
          get().cardOrderByCollection[collectionId] ??
          [];
        const next = moveCardToBinderSlot(layout, draggedId, targetIndex);
        set((s) => ({
          binderLayoutByCollection: {
            ...s.binderLayoutByCollection,
            [collectionId]: next,
          },
          cardOrderByCollection: {
            ...s.cardOrderByCollection,
            [collectionId]: compactBinderLayout(next),
          },
        }));
      },
    }),
    { name: "deckvault-ui" }
  )
);

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { reorderIds, reorderIdsToIndex } from "@/lib/collections/card-order";
import { compactBinderLayout, moveCardToBinderSlot } from "@/lib/collections/binder-layout";
import { indexedDbStateStorage } from "@/lib/storage/indexeddb-storage";

interface DataUiStore {
  activeCollectionId: string | null;
  collectionOrder: string[];
  cardOrderByCollection: Record<string, string[]>;
  binderLayoutByCollection: Record<string, (string | null)[]>;
  purchasedOverlayEnabled: boolean;
  purchasedOverlayColor: string;
  purchasedOverlayOpacity: number;
  theme: "dark" | "light";
  setActiveCollectionId: (id: string) => void;
  setPurchasedOverlayEnabled: (enabled: boolean) => void;
  setPurchasedOverlayColor: (color: string) => void;
  setPurchasedOverlayOpacity: (opacity: number) => void;
  setTheme: (theme: "dark" | "light") => void;
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
      purchasedOverlayEnabled: true,
      purchasedOverlayColor: "#22c55e",
      purchasedOverlayOpacity: 0.32,
      theme: "dark",
      setActiveCollectionId: (id) => set({ activeCollectionId: id }),
      setPurchasedOverlayEnabled: (enabled) => set({ purchasedOverlayEnabled: enabled }),
      setPurchasedOverlayColor: (color) => set({ purchasedOverlayColor: color }),
      setPurchasedOverlayOpacity: (opacity) =>
        set({ purchasedOverlayOpacity: Math.min(0.7, Math.max(0.1, opacity)) }),
      setTheme: (theme) => set({ theme }),
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
    { name: "deckvault-ui", storage: createJSONStorage(() => indexedDbStateStorage) }
  )
);

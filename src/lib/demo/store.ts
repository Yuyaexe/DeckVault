import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { indexedDbStateStorage } from "@/lib/storage/indexeddb-storage";
import { createInitialDemoState, DEFAULT_COLLECTION_ID } from "./types";
import type { DemoStore } from "./store-types";
import { createActivityActions } from "./activity-actions";
import { createCollectionActions } from "./collection-actions";
import { createAnimeActions } from "./anime-actions";
import { migrateDemoState } from "./migrations";

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...createInitialDemoState(),
      activeCollectionId: DEFAULT_COLLECTION_ID,
      setActiveCollection: (id) => set({ activeCollectionId: id }),
      ...createActivityActions(set, get),
      ...createCollectionActions(set, get),
      ...createAnimeActions(set, get),
    }),
    {
      name: "deckvault-demo",
      version: 14,
      storage: createJSONStorage(() => indexedDbStateStorage),
      migrate: migrateDemoState,
    }
  )
);

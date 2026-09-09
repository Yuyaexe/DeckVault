"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useCollectionViewData,
  type CollectionViewData,
} from "@/features/collection/hooks/useCollectionViewData";

const CollectionViewContext = createContext<CollectionViewData | null>(null);

export function CollectionViewProvider({ children }: { children: ReactNode }) {
  const data = useCollectionViewData();
  return (
    <CollectionViewContext.Provider value={data}>{children}</CollectionViewContext.Provider>
  );
}

export function useCollectionView(): CollectionViewData {
  const ctx = useContext(CollectionViewContext);
  if (!ctx) {
    throw new Error("useCollectionView must be used within CollectionViewProvider");
  }
  return ctx;
}

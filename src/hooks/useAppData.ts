"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useDemoStore } from "@/lib/demo/store";
import { useDataUiStore } from "@/lib/data/ui-store";
import { DEFAULT_COLLECTION_ID } from "@/lib/demo/types";
import type { DemoCollection, DemoProfile } from "@/lib/demo/types";
import { useOwnedCardsMutations } from "@/hooks/useOwnedCardsMutations";

export function useAppData() {
  const ownedCards = useDemoStore((s) => s.ownedCards);
  const collections = useDemoStore((s) => s.collections);
  const profile = useDemoStore((s) => s.profile);
  const tags = useDemoStore((s) => s.tags);
  const demoActiveCollectionId = useDemoStore((s) => s.activeCollectionId);

  const activeCollectionId = useDataUiStore((s) => s.activeCollectionId);
  const setActiveCollectionId = useDataUiStore((s) => s.setActiveCollectionId);

  const resolvedActiveId = useMemo(() => {
    if (activeCollectionId && collections.some((c) => c.id === activeCollectionId)) {
      return activeCollectionId;
    }
    const defaultCol = collections.find((c) => c.isDefault) ?? collections[0];
    return defaultCol?.id ?? DEFAULT_COLLECTION_ID;
  }, [activeCollectionId, collections]);

  useEffect(() => {
    if (!activeCollectionId && demoActiveCollectionId) {
      setActiveCollectionId(demoActiveCollectionId);
    }
  }, [activeCollectionId, demoActiveCollectionId, setActiveCollectionId]);

  const {
    addCardMutation,
    updateCardMutation,
    batchRepairCardsMutation,
    deleteCardsMutation,
    importMutation,
    importDeckMutation,
    normalizeQtyMutation,
  } = useOwnedCardsMutations({ resolvedActiveId });

  const setActiveCollection = useCallback(
    (id: string) => {
      setActiveCollectionId(id);
      useDemoStore.getState().setActiveCollection(id);
    },
    [setActiveCollectionId]
  );

  const updateProfile = useCallback(async (updates: Partial<DemoProfile>) => {
    useDemoStore.getState().updateProfile(updates);
  }, []);

  const addCollection = useCallback(async (name: string): Promise<DemoCollection> => {
    const created = useDemoStore.getState().addCollection(name);
    useDemoStore.getState().setActiveCollection(created.id);
    setActiveCollectionId(created.id);
    return created;
  }, [setActiveCollectionId]);

  const toggleCollectionFavorite = useCallback(async (id: string) => {
    useDemoStore.getState().toggleCollectionFavorite(id);
  }, []);

  const renameCollection = useCallback(async (id: string, name: string) => {
    useDemoStore.getState().renameCollection(id, name);
  }, []);

  const deleteCollection = useCallback(async (id: string) => {
    useDemoStore.getState().deleteCollection(id);
    setActiveCollectionId(useDemoStore.getState().activeCollectionId);
  }, [setActiveCollectionId]);

  return {
    mode: "demo" as const,
    isSupabaseMode: false,
    isLoading: false,
    isError: false,
    profile,
    collections,
    ownedCards,
    tags,
    activeCollectionId: resolvedActiveId,
    setActiveCollection,
    updateProfile,
    addCollection,
    toggleCollectionFavorite,
    renameCollection,
    deleteCollection,
    addCardFromSearch: (
      result: Parameters<typeof addCardMutation.mutateAsync>[0]["result"],
      gameId: string,
      gameSlug: string,
      gameName: string
    ) => addCardMutation.mutateAsync({ result, gameId, gameSlug, gameName }),
    updateOwnedCard: (
      id: string,
      updates: Parameters<typeof updateCardMutation.mutateAsync>[0]["updates"],
      options?: { silent?: boolean }
    ) =>
      updateCardMutation.mutateAsync({
        id,
        updates,
        silent: options?.silent ?? false,
      }),
    batchRepairOwnedCards: (
      repairs: Parameters<typeof batchRepairCardsMutation.mutateAsync>[0]
    ) => batchRepairCardsMutation.mutateAsync(repairs),
    deleteOwnedCards: (ids: string[]) => deleteCardsMutation.mutateAsync(ids),
    importRows: (
      rows: Parameters<typeof importMutation.mutateAsync>[0]["rows"],
      mergeDuplicates: boolean
    ) => importMutation.mutateAsync({ rows, mergeDuplicates }),
    importDeckFromSearch: (
      items: Parameters<typeof importDeckMutation.mutateAsync>[0]["items"],
      mergeDuplicates: boolean
    ) => importDeckMutation.mutateAsync({ items, mergeDuplicates }),
    halveOwnedCardQuantities: () =>
      normalizeQtyMutation.mutateAsync({ mode: "halve-quantities" }),
    setOwnedCardQuantitiesToOne: () =>
      normalizeQtyMutation.mutateAsync({ mode: "set-quantities-to-one" }),
  };
}

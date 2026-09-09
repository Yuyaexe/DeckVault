"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDemoStore } from "@/lib/demo/store";
import { useDataUiStore } from "@/lib/data/ui-store";
import { DEFAULT_COLLECTION_ID } from "@/lib/demo/types";
import type { DemoProfile, DemoCollection } from "@/lib/demo/types";
import { fetchAppState, type AppState } from "@/hooks/app-data/types";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useOwnedCardsMutations } from "@/hooks/useOwnedCardsMutations";

export function useAppData() {
  const queryClient = useQueryClient();
  const { mode, isSupabaseMode, configLoading } = useAppConfig();
  const demoOwnedCards = useDemoStore((s) => s.ownedCards);
  const demoCollections = useDemoStore((s) => s.collections);
  const demoProfile = useDemoStore((s) => s.profile);
  const demoTags = useDemoStore((s) => s.tags);
  const demoActiveCollectionId = useDemoStore((s) => s.activeCollectionId);

  const activeCollectionId = useDataUiStore((s) => s.activeCollectionId);
  const setActiveCollectionId = useDataUiStore((s) => s.setActiveCollectionId);

  const {
    data: serverState,
    isLoading: stateLoading,
    isFetching: stateFetching,
    isError: stateError,
  } = useQuery({
    queryKey: ["app-state"],
    queryFn: fetchAppState,
    enabled: isSupabaseMode,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidate = useCallback(() => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    invalidateTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["app-state"] });
    }, 400);
  }, [queryClient]);

  useEffect(
    () => () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    },
    []
  );

  const refreshAppState = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ["app-state"] });
  }, [queryClient]);

  const profile = isSupabaseMode ? (serverState?.profile ?? demoProfile) : demoProfile;

  // Keep local demo profile (anime Activity "Who") aligned with cloud Settings name.
  useEffect(() => {
    if (!isSupabaseMode || !serverState?.profile) return;
    const cloud = serverState.profile;
    const local = useDemoStore.getState().profile;
    if (
      cloud.displayName !== local.displayName ||
      cloud.currency !== local.currency ||
      cloud.theme !== local.theme ||
      cloud.defaultGameId !== local.defaultGameId
    ) {
      useDemoStore.getState().updateProfile({
        displayName: cloud.displayName,
        currency: cloud.currency,
        theme: cloud.theme,
        defaultGameId: cloud.defaultGameId,
      });
    }
  }, [isSupabaseMode, serverState?.profile]);

  const collections = useMemo(
    () => (isSupabaseMode ? (serverState?.collections ?? []) : demoCollections),
    [isSupabaseMode, serverState?.collections, demoCollections]
  );
  const ownedCards = useMemo(
    () => (isSupabaseMode ? (serverState?.ownedCards ?? []) : demoOwnedCards),
    [isSupabaseMode, serverState?.ownedCards, demoOwnedCards]
  );
  const tags = useMemo(
    () => (isSupabaseMode ? (serverState?.tags ?? []) : demoTags),
    [isSupabaseMode, serverState?.tags, demoTags]
  );

  const resolvedActiveId = useMemo(() => {
    if (activeCollectionId && collections.some((c) => c.id === activeCollectionId)) {
      return activeCollectionId;
    }
    const defaultCol = collections.find((c) => c.isDefault) ?? collections[0];
    if (defaultCol?.id) return defaultCol.id;
    return isSupabaseMode ? null : DEFAULT_COLLECTION_ID;
  }, [activeCollectionId, collections, isSupabaseMode]);

  const {
    addCardMutation,
    updateCardMutation,
    batchRepairCardsMutation,
    deleteCardsMutation,
    importMutation,
    importDeckMutation,
    normalizeQtyMutation,
  } = useOwnedCardsMutations({
    isSupabaseMode,
    resolvedActiveId,
    invalidate,
    refreshAppState,
  });

  useEffect(() => {
    if (!isSupabaseMode) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app/collections/invites/accept", {
          method: "POST",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { accepted?: number };
        if ((json.accepted ?? 0) > 0) {
          await queryClient.invalidateQueries({ queryKey: ["app-state"] });
        }
      } catch {
        // ignore — invites accept is best-effort on boot
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseMode, queryClient]);

  useEffect(() => {
    if (!isSupabaseMode && !activeCollectionId && demoActiveCollectionId) {
      setActiveCollectionId(demoActiveCollectionId);
    }
  }, [isSupabaseMode, activeCollectionId, demoActiveCollectionId, setActiveCollectionId]);

  useEffect(() => {
    if (
      isSupabaseMode &&
      serverState &&
      !stateFetching &&
      activeCollectionId &&
      !collections.some((c) => c.id === activeCollectionId)
    ) {
      const fallback = collections.find((c) => c.isDefault) ?? collections[0];
      if (fallback?.id) setActiveCollectionId(fallback.id);
    }
  }, [
    isSupabaseMode,
    serverState,
    stateFetching,
    activeCollectionId,
    collections,
    setActiveCollectionId,
  ]);

  const setActiveCollection = useCallback(
    (id: string) => {
      setActiveCollectionId(id);
      if (!isSupabaseMode) useDemoStore.getState().setActiveCollection(id);
    },
    [setActiveCollectionId, isSupabaseMode]
  );

  const profileMutation = useMutation({
    mutationFn: async (updates: Partial<DemoProfile>) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().updateProfile(updates);
        return;
      }
      const res = await fetch("/api/app/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      useDemoStore.getState().updateProfile(updates);
    },
    onSuccess: invalidate,
  });

  const addCollectionMutation = useMutation({
    mutationFn: async (name: string): Promise<DemoCollection> => {
      if (!isSupabaseMode) {
        return useDemoStore.getState().addCollection(name);
      }
      const res = await fetch("/api/app/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create collection");
      return json as DemoCollection;
    },
    onSuccess: (created) => {
      if (isSupabaseMode) {
        queryClient.setQueryData<AppState>(["app-state"], (prev) => {
          if (!prev) return prev;
          if (prev.collections.some((c) => c.id === created.id)) return prev;
          return { ...prev, collections: [...prev.collections, created] };
        });
      } else {
        useDemoStore.getState().setActiveCollection(created.id);
      }
      setActiveCollectionId(created.id);
      void queryClient.invalidateQueries({ queryKey: ["app-state"] });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().toggleCollectionFavorite(id);
        return;
      }
      const res = await fetch("/api/app/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to update collection");
    },
    onSuccess: invalidate,
  });

  const renameCollectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().renameCollection(id, name);
        return;
      }
      const res = await fetch("/api/app/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to rename collection");
    },
    onSuccess: invalidate,
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().deleteCollection(id);
        setActiveCollectionId(useDemoStore.getState().activeCollectionId);
        return;
      }
      const res = await fetch("/api/app/collections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete collection");
    },
    onSuccess: invalidate,
  });

  return {
    mode,
    isSupabaseMode,
    isLoading: configLoading || (isSupabaseMode && stateLoading),
    isError: isSupabaseMode && stateError,
    profile,
    collections,
    ownedCards,
    tags,
    activeCollectionId: resolvedActiveId,
    setActiveCollection,
    updateProfile: (updates: Partial<DemoProfile>) =>
      profileMutation.mutateAsync(updates),
    addCollection: (name: string) => addCollectionMutation.mutateAsync(name),
    toggleCollectionFavorite: (id: string) =>
      toggleFavoriteMutation.mutateAsync(id),
    renameCollection: (id: string, name: string) =>
      renameCollectionMutation.mutateAsync({ id, name }),
    deleteCollection: (id: string) => deleteCollectionMutation.mutateAsync(id),
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
    ) => {
      const silent = options?.silent ?? false;
      if (silent) {
        void updateCardMutation.mutateAsync({ id, updates, silent: true });
        return Promise.resolve();
      }
      return updateCardMutation.mutateAsync({ id, updates, silent: false });
    },
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

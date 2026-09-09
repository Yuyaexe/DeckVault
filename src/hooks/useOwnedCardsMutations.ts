"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDemoStore } from "@/lib/demo/store";
import { NO_ACTIVE_COLLECTION, requireCollectionId } from "@/lib/data/collection-requirements";
import type { AppState } from "@/hooks/app-data/types";
import type { DemoOwnedCard } from "@/lib/demo/types";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import type { CardCondition, CardLanguage } from "@/types/tcg";

interface UseOwnedCardsMutationsOptions {
  isSupabaseMode: boolean;
  resolvedActiveId: string | null;
  invalidate: () => void;
  refreshAppState: () => Promise<void>;
}

export function useOwnedCardsMutations({
  isSupabaseMode,
  resolvedActiveId,
  invalidate,
  refreshAppState,
}: UseOwnedCardsMutationsOptions) {
  const queryClient = useQueryClient();

  const assertCollectionForCloud = () => {
    if (!isSupabaseMode) return;
    requireCollectionId(resolvedActiveId);
  };

  const addCardMutation = useMutation({
    mutationFn: async (args: {
      result: CardSearchResult;
      gameId: string;
      gameSlug: string;
      gameName: string;
    }) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().addCardFromSearch(
          args.result,
          args.gameId,
          args.gameSlug,
          args.gameName,
          resolvedActiveId ?? undefined
        );
        return null;
      }
      assertCollectionForCloud();
      const res = await fetch("/api/app/owned-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-from-search",
          collectionId: resolvedActiveId,
          ...args,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to add card");
      }
      const json = (await res.json()) as { ownedCard?: DemoOwnedCard };
      return json.ownedCard ?? null;
    },
    onSuccess: (ownedCard) => {
      if (!isSupabaseMode || !ownedCard) {
        invalidate();
        return;
      }
      queryClient.setQueryData<AppState>(["app-state"], (prev) => {
        if (!prev) return prev;
        const idx = prev.ownedCards.findIndex((oc) => oc.id === ownedCard.id);
        if (idx >= 0) {
          const next = [...prev.ownedCards];
          next[idx] = ownedCard;
          return { ...prev, ownedCards: next };
        }
        return { ...prev, ownedCards: [...prev.ownedCards, ownedCard] };
      });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
      silent,
    }: {
      id: string;
      updates: Partial<Omit<DemoOwnedCard, "card">> & { card?: Partial<DemoOwnedCard["card"]> };
      silent?: boolean;
    }) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().updateOwnedCard(id, updates);
        return;
      }
      try {
        const res = await fetch("/api/app/owned-cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, updates }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Failed to update card");
        }
      } catch (error) {
        if (silent) {
          console.warn("[updateOwnedCard] silent update failed", id, error);
          return;
        }
        throw error;
      }
    },
    onMutate: async ({ id, updates, silent }) => {
      if (!isSupabaseMode) return { previous: undefined, silent };
      await queryClient.cancelQueries({ queryKey: ["app-state"] });
      const previous = queryClient.getQueryData<AppState>(["app-state"]);
      if (previous) {
        queryClient.setQueryData<AppState>(["app-state"], {
          ...previous,
          ownedCards: previous.ownedCards.map((oc) => {
            if (oc.id !== id) return oc;
            const { card: cardUpdates, ...ownedUpdates } = updates;
            const next: DemoOwnedCard = { ...oc, ...ownedUpdates };
            if (cardUpdates) {
              next.card = { ...oc.card, ...cardUpdates };
            }
            return next;
          }),
        });
      }
      return { previous, silent };
    },
    onError: (_err, variables, context) => {
      if (variables.silent) return;
      if (context?.previous) {
        queryClient.setQueryData(["app-state"], context.previous);
      }
    },
  });

  const batchRepairCardsMutation = useMutation({
    mutationFn: async (
      repairs: Array<{ id: string; card: Partial<DemoOwnedCard["card"]> }>
    ) => {
      if (repairs.length === 0) return;
      if (!isSupabaseMode) {
        const repairById = new Map(repairs.map((entry) => [entry.id, entry.card]));
        useDemoStore.setState((state) => ({
          ownedCards: state.ownedCards.map((oc) => {
            const cardUpdates = repairById.get(oc.id);
            if (!cardUpdates) return oc;
            return { ...oc, card: { ...oc.card, ...cardUpdates } };
          }),
        }));
        return;
      }
      await Promise.allSettled(
        repairs.map(async ({ id, card }) => {
          const res = await fetch("/api/app/owned-cards", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, updates: { card } }),
          });
          if (!res.ok) {
            console.warn("[batchRepairOwnedCards] repair failed", id);
          }
        })
      );
    },
    onMutate: async (repairs) => {
      if (!isSupabaseMode || repairs.length === 0) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: ["app-state"] });
      const previous = queryClient.getQueryData<AppState>(["app-state"]);
      if (previous) {
        const repairById = new Map(repairs.map((entry) => [entry.id, entry.card]));
        queryClient.setQueryData<AppState>(["app-state"], {
          ...previous,
          ownedCards: previous.ownedCards.map((oc) => {
            const cardUpdates = repairById.get(oc.id);
            if (!cardUpdates) return oc;
            return { ...oc, card: { ...oc.card, ...cardUpdates } };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["app-state"], context.previous);
      }
    },
  });

  const deleteCardsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!isSupabaseMode) {
        useDemoStore.getState().deleteOwnedCards(ids);
        return;
      }
      const res = await fetch("/api/app/owned-cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete cards");
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["app-state"] });
      const previous = queryClient.getQueryData<AppState>(["app-state"]);
      if (previous) {
        queryClient.setQueryData<AppState>(["app-state"], {
          ...previous,
          ownedCards: previous.ownedCards.filter((oc) => !ids.includes(oc.id)),
        });
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["app-state"], context.previous);
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({
      rows,
      mergeDuplicates,
    }: {
      rows: Parameters<ReturnType<typeof useDemoStore.getState>["importRows"]>[0];
      mergeDuplicates: boolean;
    }) => {
      if (!isSupabaseMode) {
        return useDemoStore.getState().importRows(rows, mergeDuplicates);
      }
      assertCollectionForCloud();
      const res = await fetch("/api/app/owned-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          collectionId: resolvedActiveId,
          rows,
          mergeDuplicates,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to import");
      }
      const json = await res.json();
      return json.imported as number;
    },
    onSuccess: () => {
      void refreshAppState();
    },
  });

  const importDeckMutation = useMutation({
    mutationFn: async ({
      items,
      mergeDuplicates,
    }: {
      items: Parameters<ReturnType<typeof useDemoStore.getState>["importFromSearchResults"]>[0];
      mergeDuplicates: boolean;
    }) => {
      if (!isSupabaseMode) {
        return useDemoStore.getState().importFromSearchResults(items, mergeDuplicates);
      }
      assertCollectionForCloud();
      const res = await fetch("/api/app/owned-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-deck",
          collectionId: resolvedActiveId,
          items,
          mergeDuplicates,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to import deck");
      }
      const json = await res.json();
      return json.imported as number;
    },
    onSuccess: () => {
      void refreshAppState();
    },
  });

  const normalizeQtyMutation = useMutation({
    mutationFn: async ({
      mode,
    }: {
      mode: "halve-quantities" | "set-quantities-to-one";
    }) => {
      if (!resolvedActiveId) {
        throw new Error(NO_ACTIVE_COLLECTION);
      }
      if (!isSupabaseMode) {
        return mode === "halve-quantities"
          ? useDemoStore.getState().halveOwnedCardQuantities(resolvedActiveId)
          : useDemoStore.getState().setOwnedCardQuantitiesToOne(resolvedActiveId);
      }
      const res = await fetch("/api/app/owned-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          collectionId: resolvedActiveId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update quantities");
      }
      const json = (await res.json()) as { changed: number };
      return json.changed;
    },
    onSuccess: () => {
      void refreshAppState();
    },
  });

  return {
    addCardMutation,
    updateCardMutation,
    batchRepairCardsMutation,
    deleteCardsMutation,
    importMutation,
    importDeckMutation,
    normalizeQtyMutation,
    noActiveCollectionMessage: NO_ACTIVE_COLLECTION,
  };
}

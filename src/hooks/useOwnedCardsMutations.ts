"use client";

import { useMutation } from "@tanstack/react-query";
import { useDemoStore } from "@/lib/demo/store";
import { NO_ACTIVE_COLLECTION } from "@/lib/data/collection-requirements";
import type { DemoOwnedCard } from "@/lib/demo/types";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

interface UseOwnedCardsMutationsOptions {
  resolvedActiveId: string | null;
}

export function useOwnedCardsMutations({
  resolvedActiveId,
}: UseOwnedCardsMutationsOptions) {
  const addCardMutation = useMutation({
    mutationFn: async (args: {
      result: CardSearchResult;
      gameId: string;
      gameSlug: string;
      gameName: string;
    }) => {
      useDemoStore.getState().addCardFromSearch(
        args.result,
        args.gameId,
        args.gameSlug,
        args.gameName,
        resolvedActiveId ?? undefined
      );
      return null;
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<DemoOwnedCard, "card">> & {
        card?: Partial<DemoOwnedCard["card"]>;
      };
      silent?: boolean;
    }) => {
      useDemoStore.getState().updateOwnedCard(id, updates);
    },
  });

  const batchRepairCardsMutation = useMutation({
    mutationFn: async (
      repairs: Array<{ id: string; card: Partial<DemoOwnedCard["card"]> }>
    ) => {
      if (repairs.length === 0) return;
      const repairById = new Map(repairs.map((entry) => [entry.id, entry.card]));
      useDemoStore.setState((state) => ({
        ownedCards: state.ownedCards.map((oc) => {
          const cardUpdates = repairById.get(oc.id);
          if (!cardUpdates) return oc;
          return { ...oc, card: { ...oc.card, ...cardUpdates } };
        }),
      }));
    },
  });

  const deleteCardsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      useDemoStore.getState().deleteOwnedCards(ids);
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({
      rows,
      mergeDuplicates,
    }: {
      rows: Parameters<ReturnType<typeof useDemoStore.getState>["importRows"]>[0];
      mergeDuplicates: boolean;
    }) => useDemoStore.getState().importRows(rows, mergeDuplicates),
  });

  const importDeckMutation = useMutation({
    mutationFn: async ({
      items,
      mergeDuplicates,
    }: {
      items: Parameters<
        ReturnType<typeof useDemoStore.getState>["importFromSearchResults"]
      >[0];
      mergeDuplicates: boolean;
    }) => useDemoStore.getState().importFromSearchResults(items, mergeDuplicates),
  });

  const normalizeQtyMutation = useMutation({
    mutationFn: async ({
      mode,
    }: {
      mode: "halve-quantities" | "set-quantities-to-one";
    }) => {
      if (!resolvedActiveId) throw new Error(NO_ACTIVE_COLLECTION);
      return mode === "halve-quantities"
        ? useDemoStore.getState().halveOwnedCardQuantities(resolvedActiveId)
        : useDemoStore.getState().setOwnedCardQuantitiesToOne(resolvedActiveId);
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

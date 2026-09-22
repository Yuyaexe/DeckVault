"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataUiStore } from "@/lib/data/ui-store";
import { fetchPurchasedCards } from "@/lib/purchases/fetch";
import {
  buildPurchasedCardIndex,
  EMPTY_PURCHASED_INDEX,
  isCardPurchased,
} from "@/lib/purchases/match";
import type { PurchaseMatchInput } from "@/lib/purchases/types";

export const PURCHASED_CARDS_QUERY_KEY = ["cardtrader-purchases"] as const;

export function usePurchasedCardIndex() {
  const enabled = useDataUiStore((s) => s.purchasedOverlayEnabled);
  const { data } = useQuery({
    queryKey: PURCHASED_CARDS_QUERY_KEY,
    queryFn: fetchPurchasedCards,
    staleTime: 5 * 60_000,
    enabled,
  });

  return useMemo(
    () => (data?.cards ? buildPurchasedCardIndex(data.cards) : EMPTY_PURCHASED_INDEX),
    [data?.cards]
  );
}

export function usePurchasedCardMatch(card: PurchaseMatchInput | null | undefined): boolean {
  const enabled = useDataUiStore((s) => s.purchasedOverlayEnabled);
  const index = usePurchasedCardIndex();
  return useMemo(() => {
    if (!enabled || !card) return false;
    return isCardPurchased(card, index);
  }, [enabled, card, index]);
}

export function usePurchasedOverlayPrefetch() {
  const enabled = useDataUiStore((s) => s.purchasedOverlayEnabled);
  useQuery({
    queryKey: PURCHASED_CARDS_QUERY_KEY,
    queryFn: fetchPurchasedCards,
    staleTime: 5 * 60_000,
    enabled,
  });
}

"use client";

import { useCallback } from "react";
import type { DemoOwnedCard } from "@/lib/demo/types";
import { useAppData } from "@/hooks/useAppData";
import { useYugiohImageRepairBatch } from "@/hooks/useYugiohImageRepairBatch";

/** Batch-repairs wrong Yu-Gi-Oh images once passcodes are resolved for the collection. */
export function useCollectionYugiohImageRepair(
  cards: DemoOwnedCard[],
  passcodes: Map<string, string | null> | undefined,
  isReady: boolean
): void {
  const { batchRepairOwnedCards } = useAppData();

  const applyRepairs = useCallback(
    (repairs: Array<{ id: string; updates: Partial<DemoOwnedCard["card"]> }>) => {
      void batchRepairOwnedCards(
        repairs.map((repair) => ({ id: repair.id, card: repair.updates }))
      );
    },
    [batchRepairOwnedCards]
  );

  useYugiohImageRepairBatch(cards, passcodes, isReady, applyRepairs);
}

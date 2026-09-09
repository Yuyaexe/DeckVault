"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useYugiohPasscodeContext } from "@/features/collection/context/yugioh-passcode-context";
import { useYugiohImageRepairBatch } from "@/hooks/useYugiohImageRepairBatch";
import { useYugiohTypeBackfill } from "@/hooks/useYugiohTypeBackfill";
import { useDemoStore } from "@/lib/demo/store";
import type { AnimeCharacterCard } from "@/lib/demo/types";

export function useAnimeYugiohPasscodeSync(
  cards: AnimeCharacterCard[],
  onUpdate: (
    id: string,
    updates: Partial<Omit<AnimeCharacterCard, "card">> & {
      card?: Partial<AnimeCharacterCard["card"]>;
    }
  ) => void
): void {
  const ctx = useYugiohPasscodeContext();
  const patchAnimeCharacterCardTypes = useDemoStore((s) => s.patchAnimeCharacterCardTypes);

  const items = useMemo(
    () => cards.map((entry) => ({ id: entry.id, card: entry.card })),
    [cards]
  );

  const applyImageRepairs = useCallback(
    (repairs: Array<{ id: string; updates: Partial<AnimeCharacterCard["card"]> }>) => {
      for (const repair of repairs) {
        onUpdate(repair.id, { card: repair.updates });
      }
    },
    [onUpdate]
  );

  const applyTypeRepairs = useCallback(
    (repairs: Array<{ id: string; updates: { type: string } }>) => {
      patchAnimeCharacterCardTypes(
        repairs.map((repair) => ({ id: repair.id, type: repair.updates.type }))
      );
    },
    [patchAnimeCharacterCardTypes]
  );

  useYugiohImageRepairBatch(items, ctx?.map, ctx?.isReady ?? false, applyImageRepairs);
  useYugiohTypeBackfill(items, ctx?.map, ctx?.isReady ?? false, applyTypeRepairs);
}

export function AnimeYugiohPasscodeSync({
  cards,
  onUpdate,
  children,
}: {
  cards: AnimeCharacterCard[];
  onUpdate: (
    id: string,
    updates: Partial<Omit<AnimeCharacterCard, "card">> & {
      card?: Partial<AnimeCharacterCard["card"]>;
    }
  ) => void;
  children: ReactNode;
}) {
  useAnimeYugiohPasscodeSync(cards, onUpdate);
  return <>{children}</>;
}

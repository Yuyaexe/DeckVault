"use client";

import { useEffect, useRef } from "react";
import { buildYgoImageUrl, isYgoCroppedImageUrl, pickYgoImageSizeForRarity } from "@/lib/yugioh/urls";
import { passcodeFromYgoImageUrl } from "@/lib/yugioh/lookup";
import { isCardTraderHostedImage, isCardTraderPlaceholderImage } from "@/lib/cardtrader/images";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import type { DemoCard } from "@/lib/demo/types";

/** Survives collection page unmount — avoids re-repairing the same card every visit. */
const repairedKeysGlobal = new Set<string>();

type RepairCardFields = Pick<
  DemoCard,
  "gameSlug" | "externalId" | "imageUrl" | "rarity" | "cardTraderBlueprintId"
>;

export type YugiohImageRepair = { id: string; updates: Partial<RepairCardFields> };

function needsRepair(card: RepairCardFields, passcode: string): boolean {
  if (card.gameSlug !== "yugioh") return false;
  if (isCardTraderPlaceholderImage(card.imageUrl)) return true;
  if (isCardTraderHostedImage(card.imageUrl)) return true;
  if (isYgoCroppedImageUrl(card.imageUrl)) return true;
  if (!card.imageUrl) return true;

  const imagePasscode = passcodeFromYgoImageUrl(card.imageUrl);
  if (imagePasscode && imagePasscode !== passcode) return true;

  if (isYugiohPasscodeId(card.externalId, card.imageUrl) && card.externalId !== passcode) {
    return true;
  }

  return false;
}

export function useYugiohImageRepairBatch(
  items: Array<{ id: string; card: RepairCardFields }>,
  passcodes: Map<string, string | null> | undefined,
  isReady: boolean,
  applyRepairs: (repairs: YugiohImageRepair[]) => void
): void {
  const applyRepairsRef = useRef(applyRepairs);
  applyRepairsRef.current = applyRepairs;

  useEffect(() => {
    if (!isReady || !passcodes?.size) return;

    const repairs: YugiohImageRepair[] = [];

    for (const item of items) {
      if (item.card.gameSlug !== "yugioh") continue;

      const passcode = passcodes.get(item.id);
      if (!passcode) continue;

      const repairKey = `${item.id}:${passcode}`;
      if (repairedKeysGlobal.has(repairKey)) continue;
      if (!needsRepair(item.card, passcode)) {
        repairedKeysGlobal.add(repairKey);
        continue;
      }

      const imageUrl = buildYgoImageUrl(passcode, pickYgoImageSizeForRarity(item.card.rarity));
      if (!imageUrl) continue;

      repairedKeysGlobal.add(repairKey);

      const cardUpdates: Partial<RepairCardFields> = { imageUrl };
      if (item.card.externalId !== passcode) {
        cardUpdates.externalId = passcode;
      }

      repairs.push({ id: item.id, updates: cardUpdates });
    }

    if (repairs.length === 0) return;
    applyRepairsRef.current(repairs);
  }, [items, passcodes, isReady]);
}

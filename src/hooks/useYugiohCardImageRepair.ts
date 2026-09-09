"use client";

import { useEffect, useRef } from "react";
import { buildYgoImageUrl, isYgoCroppedImageUrl, pickYgoImageSizeForRarity } from "@/lib/yugioh/urls";
import { isCardTraderHostedImage, isCardTraderPlaceholderImage } from "@/lib/cardtrader/images";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import type { DemoCard } from "@/lib/demo/types";
import { useAppData } from "@/hooks/useAppData";

type RepairCardFields = Pick<
  DemoCard,
  "gameSlug" | "externalId" | "imageUrl" | "rarity" | "cardTraderBlueprintId"
>;

function imageNeedsYugiohRepair(
  card: RepairCardFields,
  passcode: string
): boolean {
  if (card.gameSlug !== "yugioh") return false;
  if (isCardTraderPlaceholderImage(card.imageUrl)) return true;
  if (isCardTraderHostedImage(card.imageUrl)) return true;
  if (isYgoCroppedImageUrl(card.imageUrl)) return true;
  if (!card.imageUrl) return true;
  if (card.imageUrl.includes("ygoprodeck.com")) {
    return !card.imageUrl.includes(`/${passcode}`);
  }
  return false;
}

/** YGOPRODeck art fallback only when CardTrader art is unavailable. */
export function useYugiohCardImageRepair(
  ownedCardId: string | undefined,
  card: RepairCardFields,
  passcode: string | null
): void {
  const { updateOwnedCard } = useAppData();
  const repairedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ownedCardId || !passcode || card.gameSlug !== "yugioh") return;
    if (repairedRef.current === `${ownedCardId}:${passcode}`) return;
    if (!imageNeedsYugiohRepair(card, passcode)) return;

    const imageUrl = buildYgoImageUrl(passcode, pickYgoImageSizeForRarity(card.rarity));
    if (!imageUrl) return;

    repairedRef.current = `${ownedCardId}:${passcode}`;
    const cardUpdates: Partial<RepairCardFields> = { imageUrl };
    if (
      card.externalId !== passcode &&
      isYugiohPasscodeId(card.externalId, card.imageUrl)
    ) {
      cardUpdates.externalId = passcode;
    }
    updateOwnedCard(ownedCardId, { card: cardUpdates }, { silent: true });
  }, [ownedCardId, card, passcode, updateOwnedCard]);
}

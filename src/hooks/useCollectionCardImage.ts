"use client";

import {
  getYugiohPasscodeFallbackUrl,
  resolveCollectionThumbUrl,
} from "@/lib/cards/preview-image";
import { useYugiohPasscodeFromContext } from "@/hooks/useYugiohPasscodeForDisplay";
import type { DemoOwnedCard } from "@/lib/demo/types";

export function useCollectionCardImage(item: DemoOwnedCard) {
  const ygoPasscode = useYugiohPasscodeFromContext(item.id, item.card);
  const thumbSrc = resolveCollectionThumbUrl(item.card, ygoPasscode);
  const fallbackSrc =
    item.card.gameSlug === "yugioh" ? getYugiohPasscodeFallbackUrl(item.card, ygoPasscode) : null;
  const loading =
    item.card.gameSlug === "yugioh" && ygoPasscode === undefined && !thumbSrc && !fallbackSrc;

  return { thumbSrc, fallbackSrc, loading, ygoPasscode };
}

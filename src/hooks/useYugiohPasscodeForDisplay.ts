"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchYugiohPasscodeForCard,
  passcodeFromYgoImageUrl,
} from "@/lib/yugioh/lookup";
import {
  resolvePasscodeFromContext,
  useYugiohPasscodeContext,
} from "@/features/collection/context/yugioh-passcode-context";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import { readCachedPasscode, writeCachedPasscode } from "@/lib/cache/passcode";
import type { DemoCard } from "@/lib/demo/types";

type CardPasscodeFields = Pick<
  DemoCard,
  "name" | "gameSlug" | "externalId" | "imageUrl" | "setCode" | "collectorNumber"
>;

/** Context-only passcode lookup — no per-card API calls (use inside YugiohPasscodeProvider). */
export function useYugiohPasscodeFromContext(
  ownedCardId: string | undefined,
  card?: CardPasscodeFields
): string | null | undefined {
  const batchContext = useYugiohPasscodeContext();
  return resolvePasscodeFromContext(ownedCardId, batchContext, card);
}

/**
 * Returns Konami passcode for Yu-Gi-Oh art.
 * - `undefined` while resolving
 * - `string` when resolved
 * - `null` when resolution failed
 */
export function useYugiohPasscodeForDisplay(
  card: CardPasscodeFields,
  ownedCardId?: string
): string | null | undefined {
  const batchContext = useYugiohPasscodeContext();
  const fromBatch = resolvePasscodeFromContext(ownedCardId, batchContext);
  const useIndividualLookup = fromBatch === undefined && batchContext === null;

  const { data: resolvedPasscode, isFetched } = useQuery({
    queryKey: ["ygo-passcode", card.name, card.setCode, card.collectorNumber],
    queryFn: async () => {
      const cached = await readCachedPasscode({
        name: card.name,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
      });
      if (cached !== undefined) return cached;

      const result = await fetchYugiohPasscodeForCard({
        name: card.name,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
      });
      void writeCachedPasscode(
        {
          name: card.name,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber,
        },
        result
      );
      return result;
    },
    enabled:
      useIndividualLookup && card.gameSlug === "yugioh" && Boolean(card.name.trim()),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  if (fromBatch !== undefined) return fromBatch;

  if (card.gameSlug !== "yugioh") return null;
  if (!isFetched) return undefined;

  if (resolvedPasscode && isYugiohPasscodeId(resolvedPasscode, null)) {
    return resolvedPasscode;
  }

  const storedPasscode =
    (isYugiohPasscodeId(card.externalId, card.imageUrl) ? card.externalId : null) ??
    passcodeFromYgoImageUrl(card.imageUrl);

  return storedPasscode && isYugiohPasscodeId(storedPasscode, null) ? storedPasscode : null;
}

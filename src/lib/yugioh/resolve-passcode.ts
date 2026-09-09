import { yugiohAdapter } from "@/features/catalog/services/card-api/yugioh.adapter";
import {
  yugiohCardNamesMatch,
  yugiohSetNumberRef,
} from "@/lib/yugioh/lookup";
import { yugiohPasscodeCacheKey } from "@/lib/yugioh/passcode-key";

export type { YugiohPasscodeKeyInput as YugiohPasscodeInput } from "@/lib/yugioh/passcode-key";
export { yugiohPasscodeCacheKey };

const passcodeCache = new Map<string, string | null>();

import type { YugiohPasscodeKeyInput } from "@/lib/yugioh/passcode-key";

async function resolveYugiohPasscodeUncached(
  card: YugiohPasscodeKeyInput
): Promise<string | null> {
  const setRef = yugiohSetNumberRef(card.setCode, card.collectorNumber);
  if (setRef) {
    const bySet = await yugiohAdapter.getBySetNumber(setRef);
    if (bySet?.externalId) {
      if (!card.name.trim() || yugiohCardNamesMatch(bySet.name, card.name)) {
        return bySet.externalId;
      }
    }
  }

  const trimmed = card.name.trim();
  if (!trimmed) return null;

  const results = await yugiohAdapter.searchByNameOnly(trimmed);
  const match = results.find((result) => yugiohCardNamesMatch(result.name, trimmed));
  return match?.externalId ?? null;
}

/** Server-side Yu-Gi-Oh passcode resolution (set number first, then exact name). */
export async function resolveYugiohPasscodeForCard(
  card: YugiohPasscodeKeyInput
): Promise<string | null> {
  const key = yugiohPasscodeCacheKey(card);
  if (passcodeCache.has(key)) {
    return passcodeCache.get(key) ?? null;
  }

  const result = await resolveYugiohPasscodeUncached(card);
  passcodeCache.set(key, result);
  return result;
}

export async function resolveYugiohPasscodesConcurrent(
  cards: YugiohPasscodeKeyInput[],
  concurrency = 8
): Promise<Map<string, string | null>> {
  const resolved = new Map<string, string | null>();
  let index = 0;

  async function worker() {
    while (index < cards.length) {
      const current = cards[index++];
      const key = yugiohPasscodeCacheKey(current);
      resolved.set(key, await resolveYugiohPasscodeForCard(current));
    }
  }

  const workers = Math.min(concurrency, Math.max(cards.length, 1));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return resolved;
}

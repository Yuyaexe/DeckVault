export interface YugiohPasscodeKeyInput {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
}

/** Stable cache key for Yu-Gi-Oh passcode lookups (name + set ref). */
export function yugiohPasscodeCacheKey(card: YugiohPasscodeKeyInput): string {
  return [
    card.name.trim().toLowerCase(),
    (card.collectorNumber ?? card.setCode ?? "").trim().toUpperCase(),
  ].join("|");
}

/** Main / Extra deck binder categories for Yu-Gi-Oh cards. */

export const YUGIOH_DECK_CATEGORIES = ["monster", "spell", "trap", "extra"] as const;

export type YugiohDeckCategory = (typeof YUGIOH_DECK_CATEGORIES)[number];

export type YugiohDeckCategoryOrUnknown = YugiohDeckCategory | "unknown";

/** Classify a YGOPRODeck `type` string into binder filter buckets. */
export function classifyYugiohDeckCategory(
  type: string | null | undefined
): YugiohDeckCategoryOrUnknown {
  if (!type?.trim()) return "unknown";
  const t = type.toLowerCase().trim();

  // Prefer exact card-type phrases — never treat race "Spellcaster" as a Spell.
  if (t.includes("spell card") || t === "spell") return "spell";
  if (t.includes("trap card") || t === "trap") return "trap";

  if (
    t.includes("fusion") ||
    t.includes("synchro") ||
    t.includes("xyz") ||
    t.includes("link")
  ) {
    return "extra";
  }
  if (t.includes("monster")) return "monster";
  return "unknown";
}

export function deckCategorySortRank(category: YugiohDeckCategoryOrUnknown): number {
  switch (category) {
    case "monster":
      return 0;
    case "spell":
      return 1;
    case "trap":
      return 2;
    case "extra":
      return 3;
    default:
      return 4;
  }
}

export function yugiohTypeFromSearchMetadata(
  metadata?: Record<string, unknown> | null
): string | null {
  const value = metadata?.type;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function cardMatchesDeckCategoryFilter(
  type: string | null | undefined,
  selected: ReadonlySet<YugiohDeckCategory> | YugiohDeckCategory[],
  options?: { includeUnknown?: boolean }
): boolean {
  const active = selected instanceof Set ? selected : new Set(selected);
  if (active.size === 0) return true;
  const category = classifyYugiohDeckCategory(type);
  if (category === "unknown") return options?.includeUnknown ?? false;
  return active.has(category);
}

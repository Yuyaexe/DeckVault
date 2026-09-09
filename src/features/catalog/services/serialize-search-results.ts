import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

const NESTED_PRINT_KEYS = ["digimonPrints", "cardtraderPrints"] as const;

/** Strip nested print arrays from metadata to avoid circular JSON (primary is prints[0]). */
export function stripNestedPrintMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!metadata) return {};
  const next = { ...metadata };
  for (const key of NESTED_PRINT_KEYS) {
    delete next[key];
  }
  return next;
}

export function cloneSearchResultForJson(result: CardSearchResult): CardSearchResult {
  const metadata = { ...stripNestedPrintMetadata(result.metadata) };

  for (const key of NESTED_PRINT_KEYS) {
    const nested = result.metadata?.[key] as CardSearchResult[] | undefined;
    if (nested?.length) {
      metadata[key] = nested.map((print) => ({
        ...print,
        metadata: stripNestedPrintMetadata(print.metadata),
      }));
    }
  }

  return { ...result, metadata };
}

export function serializeSearchResultsForResponse(
  results: CardSearchResult[]
): CardSearchResult[] {
  return results.map(cloneSearchResultForJson);
}

export const CATALOG_SOURCE_LABELS: Record<string, string> = {
  yugioh: "YGOPRODeck",
  pokemon: "Pokemon TCG API",
  digimon: "digimoncard.io",
};

export function catalogSourceLabel(gameSlug: string): string {
  return CATALOG_SOURCE_LABELS[gameSlug] ?? `${gameSlug} catalog`;
}

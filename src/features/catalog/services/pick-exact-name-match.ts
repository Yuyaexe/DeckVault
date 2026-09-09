import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

export function pickExactNameMatch(
  results: CardSearchResult[],
  name: string
): CardSearchResult | null {
  const lower = name.toLowerCase();
  return (
    results.find((result) => result.name.toLowerCase() === lower) ??
    results.find((result) => result.name.toLowerCase().includes(lower)) ??
    results[0] ??
    null
  );
}

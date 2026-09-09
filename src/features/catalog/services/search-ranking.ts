import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "'")
    // "B. E. S." / "Blue - Eyes" → match card names like "B.E.S." / "Blue-Eyes"
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function isSetCodeQuery(query: string): boolean {
  return /^[A-Z0-9]+-EN\d+/i.test(query.trim());
}

/** Every query word must appear in the card name (ignores description/flavor text). */
export function cardNameMatchesQuery(name: string, query: string): boolean {
  const normalizedName = normalizeSearchText(name);
  const terms = searchTerms(query);
  if (terms.length === 0) return true;
  return terms.every((term) => normalizedName.includes(term));
}

function relevanceScore(name: string, query: string): number {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  return 3;
}

/** One grid tile per unique card (passcode for YGO, externalId otherwise). */
export function dedupeSearchResults(
  results: CardSearchResult[],
  gameSlug: string
): CardSearchResult[] {
  const seen = new Set<string>();
  const deduped: CardSearchResult[] = [];

  for (const result of results) {
    const passcode =
      gameSlug === "yugioh" && /^\d{7,10}$/.test(result.externalId)
        ? result.externalId
        : null;
    const key = passcode ?? `${gameSlug}:${normalizeSearchText(result.name)}:${result.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

/** Drop off-name matches, then sort by relevance and A–Z. */
export function rankSearchResults(
  query: string,
  results: CardSearchResult[]
): CardSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed || results.length === 0) return results;

  const bySetCode = isSetCodeQuery(trimmed);
  const filtered = bySetCode
    ? results
    : results.filter((result) => cardNameMatchesQuery(result.name, trimmed));

  const scoreByResult = new Map<CardSearchResult, number>();
  for (const result of filtered) {
    scoreByResult.set(result, relevanceScore(result.name, trimmed));
  }

  return [...filtered].sort((a, b) => {
    if (!bySetCode) {
      const scoreDiff =
        (scoreByResult.get(a) ?? 3) - (scoreByResult.get(b) ?? 3);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

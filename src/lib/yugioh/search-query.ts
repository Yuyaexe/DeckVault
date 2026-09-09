/**
 * YGOProDeck `fname` / `archetype` reject spaced initials like "B. E. S." (HTTP 400).
 * Collapse spaces around `.` / `-` so "B. E. S." → "B.E.S." and "Blue - Eyes" → "Blue-Eyes".
 */
export function normalizeYugiohSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Original query plus collapsed variant (deduped). */
export function buildYugiohSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const out = new Set<string>();
  out.add(trimmed);
  const collapsed = normalizeYugiohSearchQuery(trimmed);
  if (collapsed) out.add(collapsed);
  return [...out];
}

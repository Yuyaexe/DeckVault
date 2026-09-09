import type { DeckEntry, ProxyCardVariant } from "@/lib/proxy-print/types";
import { deckEntryResolveKey } from "@/lib/proxy-print/parse-deck";
import { isUserUploadedCustomImage } from "@/lib/proxy-print/preview-image";

const USER_AGENT = "DeckVault/1.0 (proxy-print)";
const CARDLIST_SEARCH = "https://www.dbs-cardgame.com/fw/en/cardlist/";
const IMAGE_BASE = "https://www.dbs-cardgame.com/fw/images/cards/card/en";

/** Fusion World / Starter / Theme set codes: FB01-015, FS01-12, SB02-003 */
export const DRAGONBALL_CARD_ID =
  /\b((?:FB|FS|SB|FP)\d{2}-\d{2,3})(?:_([Pp]\d+|f))?\b/i;

interface BandaiCardHit {
  cardId: string;
  name: string;
  file: string;
}

function absoluteImageUrl(file: string): string {
  const clean = file.replace(/^\.\.\/\.\.\/images\/cards\/card\/en\//i, "").replace(/^.*\//, "");
  return `${IMAGE_BASE}/${clean}`;
}

function parseHits(html: string): BandaiCardHit[] {
  const hits: BandaiCardHit[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/data-src="([^"]+)"[^>]*alt="([^"]+)"/gi)) {
    const file = match[1];
    const alt = match[2].trim();
    const idMatch = alt.match(DRAGONBALL_CARD_ID) ?? file.match(DRAGONBALL_CARD_ID);
    if (!idMatch) continue;

    const cardId = idMatch[1].toUpperCase();
    const name = alt.replace(DRAGONBALL_CARD_ID, "").trim() || cardId;
    const key = `${cardId}|${file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ cardId, name, file });
  }

  return hits;
}

async function searchBandaiCardlist(query: string): Promise<BandaiCardHit[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${CARDLIST_SEARCH}?search=true&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return parseHits(await res.text());
}

function hitToVariant(hit: BandaiCardHit, index: number): ProxyCardVariant {
  const file = hit.file.replace(/^\.\.\/\.\.\/images\/cards\/card\/en\//i, "");
  const parallel = file.match(/_(p\d+)\.webp$/i)?.[1]?.toLowerCase() ?? null;
  const isLeader = /_f(?:_p\d+)?\.webp$/i.test(file);
  const labelParts = [hit.name];
  if (isLeader) labelParts.push("Leader");
  if (parallel) labelParts.push(parallel.toUpperCase());

  return {
    key: `${hit.cardId}-${file}-${index}`,
    label: labelParts.join(" · "),
    rarity: null,
    setName: hit.cardId.split("-")[0] ?? null,
    setCode: hit.cardId,
    imageUrl: absoluteImageUrl(file),
  };
}

function variantMatchesHint(variant: ProxyCardVariant, hint: string): boolean {
  const h = hint.toLowerCase();
  const label = variant.label.toLowerCase();
  const url = variant.imageUrl.toLowerCase();

  if (h === "aa" || h === "fa" || h === "alt" || h === "p1") {
    return url.includes("_p1") || label.includes("p1");
  }
  if (h === "p2") return url.includes("_p2") || label.includes("p2");
  if (h === "p3") return url.includes("_p3") || label.includes("p3");
  if (/^p\d+$/i.test(h)) return url.includes(`_${h}`) || label.includes(h);
  return label.includes(h) || url.includes(h);
}

export function pickDragonballVariant(
  variants: ProxyCardVariant[],
  entry: DeckEntry
): ProxyCardVariant | null {
  if (!variants.length) return null;
  if (entry.artHint) {
    const match = variants.find((v) => variantMatchesHint(v, entry.artHint!));
    if (match) return match;
    const idx = parseInt(entry.artHint, 10);
    if (!Number.isNaN(idx) && idx > 0 && idx <= variants.length) {
      return variants[idx - 1];
    }
  }
  // Prefer base print (no _pN) when no hint.
  return (
    variants.find((v) => !/_p\d+\.webp$/i.test(v.imageUrl)) ?? variants[0]
  );
}

async function resolveDragonballKey(key: string): Promise<{
  name: string;
  variants: ProxyCardVariant[];
} | null> {
  const idMatch = key.match(DRAGONBALL_CARD_ID);
  const lookup = idMatch ? idMatch[1].toUpperCase() : key.trim();
  if (!lookup) return null;

  const hits = await searchBandaiCardlist(lookup);
  if (!hits.length) return null;

  const filtered = idMatch
    ? hits.filter((h) => h.cardId === lookup)
    : hits.filter((h) => h.name.toLowerCase() === lookup.toLowerCase()).length
      ? hits.filter((h) => h.name.toLowerCase() === lookup.toLowerCase())
      : hits.filter((h) => h.name.toLowerCase().includes(lookup.toLowerCase()));

  const chosen = filtered.length ? filtered : hits;
  const variants = chosen.map((hit, index) => hitToVariant(hit, index));
  if (!variants.length) return null;

  return {
    name: chosen[0]?.name ?? lookup,
    variants,
  };
}

export async function resolveDragonballEntriesBulk(
  entries: DeckEntry[]
): Promise<Map<string, { name: string; variants: ProxyCardVariant[] }>> {
  const result = new Map<string, { name: string; variants: ProxyCardVariant[] }>();

  for (const entry of entries) {
    if (isUserUploadedCustomImage(entry.customImageUrl)) {
      result.set(deckEntryResolveKey(entry), {
        name: entry.name,
        variants: [
          {
            key: "custom",
            label: entry.name,
            rarity: null,
            setName: null,
            setCode: null,
            imageUrl: entry.customImageUrl!,
          },
        ],
      });
      continue;
    }

    const rk = deckEntryResolveKey(entry);
    if (result.has(rk)) continue;

    const resolved = await resolveDragonballKey(entry.key);
    if (resolved) {
      result.set(rk, resolved);
      continue;
    }

    // Direct CDN guess when search misses (leaders often need `_f`).
    const idMatch = entry.key.match(DRAGONBALL_CARD_ID);
    if (idMatch) {
      const cardId = idMatch[1].toUpperCase();
      const candidates = [`${cardId}.webp`, `${cardId}_f.webp`, `${cardId}_p1.webp`, `${cardId}_f_p1.webp`];
      const variants: ProxyCardVariant[] = [];
      for (const file of candidates) {
        const imageUrl = absoluteImageUrl(file);
        try {
          const head = await fetch(imageUrl, {
            method: "HEAD",
            headers: { "User-Agent": USER_AGENT },
            next: { revalidate: 86400 },
          });
          if (!head.ok) continue;
        } catch {
          continue;
        }
        variants.push({
          key: `cdn-${file}`,
          label: entry.name,
          rarity: null,
          setName: cardId.split("-")[0] ?? null,
          setCode: cardId,
          imageUrl,
        });
      }
      if (variants.length) {
        result.set(rk, { name: entry.name, variants });
      }
    }
  }

  return result;
}

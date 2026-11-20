import { mapPool } from "@/lib/proxy-print/map-pool";
import { deckEntryResolveKey } from "@/lib/proxy-print/parse-deck";
import { isUserUploadedCustomImage } from "@/lib/proxy-print/preview-image";
import {
  getRiftboundPrinting,
  mapRiftboundCard,
  searchRiftboundPrintings,
  type RiftboundApiCard,
} from "@/features/catalog/services/card-api/riftbound.adapter";
import type { DeckEntry, ProxyCardVariant } from "@/lib/proxy-print/types";

const PRINTING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function variantFromCard(card: RiftboundApiCard): ProxyCardVariant | null {
  const mapped = mapRiftboundCard(card);
  const imageUrl = card.images?.large ?? card.images?.normal ?? card.images?.small;
  if (!imageUrl) return null;

  return {
    key: `riftbound:${card.id}`,
    label: [card.name, card.set_name, card.collector_number ? `#${card.collector_number}` : null]
      .filter(Boolean)
      .join(" — "),
    rarity: mapped.rarity,
    setName: mapped.setName,
    setCode: mapped.setCode,
    imageUrl,
  };
}

async function cardsForEntry(entry: DeckEntry): Promise<RiftboundApiCard[]> {
  const rawKey = entry.key.trim();
  const byPrintingId = PRINTING_ID.test(rawKey) ? await getRiftboundPrinting(rawKey) : null;
  const query = byPrintingId?.oracle_name ?? byPrintingId?.name ?? entry.name ?? rawKey;
  const matches = await searchRiftboundPrintings(query, 200);

  if (byPrintingId) {
    const sameCardPrints = matches.filter((card) => card.oracle_id === byPrintingId.oracle_id);
    return sameCardPrints.some((card) => card.id === byPrintingId.id)
      ? sameCardPrints
      : [byPrintingId, ...sameCardPrints];
  }

  const normalizedQuery = normalize(rawKey);
  const exact = matches.filter((card) =>
    [card.name, card.oracle_name, card.riftbound_id, `${card.set}-${card.collector_number}`]
      .some((candidate) => candidate && normalize(candidate) === normalizedQuery)
  );
  if (exact.length) return exact;

  const normalizedName = normalize(entry.name || rawKey);
  const nameMatches = matches.filter((card) =>
    [card.name, card.oracle_name].some((candidate) => candidate && normalize(candidate) === normalizedName)
  );
  if (nameMatches.length) return nameMatches;

  const first = matches[0];
  return first ? matches.filter((card) => card.oracle_id === first.oracle_id) : [];
}

export async function resolveRiftboundEntriesBulk(
  entries: DeckEntry[]
): Promise<Map<string, { name: string; variants: ProxyCardVariant[] }>> {
  const resolved = new Map<string, { name: string; variants: ProxyCardVariant[] }>();
  const toResolve = entries.filter((entry) => !isUserUploadedCustomImage(entry.customImageUrl));

  for (const entry of entries) {
    if (!isUserUploadedCustomImage(entry.customImageUrl)) continue;
    resolved.set(deckEntryResolveKey(entry), {
      name: entry.name,
      variants: [{
        key: "custom",
        label: entry.name,
        rarity: null,
        setName: null,
        setCode: null,
        imageUrl: entry.customImageUrl!,
      }],
    });
  }

  await mapPool(toResolve, 4, async (entry) => {
    try {
      const cards = await cardsForEntry(entry);
      const variants = cards
        .map(variantFromCard)
        .filter((variant): variant is ProxyCardVariant => Boolean(variant));
      resolved.set(deckEntryResolveKey(entry), {
        name: cards[0]?.oracle_name ?? cards[0]?.name ?? entry.name,
        variants,
      });
    } catch {
      resolved.set(deckEntryResolveKey(entry), { name: entry.name, variants: [] });
    }
  });

  return resolved;
}


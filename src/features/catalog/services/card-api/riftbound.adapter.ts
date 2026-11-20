import type { CardApiAdapter, CardDetail, CardSearchResult, CatalogSearchOptions } from "./types";

const API = "https://api.rifthunt.com";
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "DeckVault/0.2 (personal Riftbound catalog)",
};

export interface RiftboundApiCard {
  id: string;
  oracle_id: string;
  name: string;
  oracle_name?: string;
  type?: string;
  domains?: string[];
  energy?: number | null;
  power?: number | null;
  might?: number | null;
  keywords?: string[];
  rules_text?: string | null;
  set?: string | null;
  set_name?: string | null;
  collector_number?: string | null;
  rarity?: string | null;
  variant?: string | null;
  riftbound_id?: string | null;
  images?: { small?: string | null; normal?: string | null; large?: string | null };
}

interface RiftboundListResponse {
  data?: RiftboundApiCard[];
}

export function mapRiftboundCard(card: RiftboundApiCard): CardSearchResult {
  const name = card.name || card.oracle_name || "Unknown card";
  const setCode = card.set?.toUpperCase() ?? null;
  const imageUrl = card.images?.large ?? card.images?.normal ?? card.images?.small ?? null;

  return {
    externalId: card.id,
    name,
    setCode,
    setName: card.set_name ?? null,
    collectorNumber: card.collector_number ?? null,
    rarity: card.rarity ?? null,
    edition: card.variant ?? null,
    imageUrl,
    price: null,
    metadata: {
      oracleId: card.oracle_id,
      oracleName: card.oracle_name ?? name,
      riftboundId: card.riftbound_id ?? null,
      type: card.type ?? null,
      domains: card.domains ?? [],
      energy: card.energy ?? null,
      power: card.power ?? null,
      might: card.might ?? null,
      keywords: card.keywords ?? [],
      rulesText: card.rules_text ?? null,
      variantLabel: card.variant ?? null,
    },
  };
}

export async function getRiftboundPrinting(id: string): Promise<RiftboundApiCard | null> {
  const response = await fetch(`${API}/cards/${encodeURIComponent(id)}`, {
    headers: HEADERS,
    next: { revalidate: 60 * 60 * 24 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Riftbound catalog returned HTTP ${response.status}`);
  const payload = (await response.json()) as RiftboundApiCard;
  return payload?.id ? payload : null;
}

export async function searchRiftboundPrintings(
  query: string,
  limit = 100
): Promise<RiftboundApiCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    unique: "prints",
    limit: String(Math.max(1, Math.min(limit, 200))),
  });
  const response = await fetch(`${API}/cards/search?${params}`, {
    headers: HEADERS,
    next: { revalidate: 60 * 60 },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Riftbound catalog returned HTTP ${response.status}`);
  const payload = (await response.json()) as RiftboundListResponse;
  return Array.isArray(payload.data) ? payload.data.filter((card) => Boolean(card.id)) : [];
}

function groupPrintings(cards: RiftboundApiCard[]): CardSearchResult[] {
  const groups = new Map<string, CardSearchResult[]>();
  for (const card of cards) {
    const mapped = mapRiftboundCard(card);
    const key = card.oracle_id || card.id;
    const group = groups.get(key) ?? [];
    group.push(mapped);
    groups.set(key, group);
  }

  return [...groups.values()].map((prints) => ({
    ...prints[0],
    metadata: {
      ...prints[0].metadata,
      riftboundPrints: prints,
    },
  }));
}

export const riftboundAdapter: CardApiAdapter = {
  gameSlug: "riftbound",

  async search(query: string, _options?: CatalogSearchOptions): Promise<CardSearchResult[]> {
    return groupPrintings(await searchRiftboundPrintings(query));
  },

  async getById(externalId: string): Promise<CardDetail | null> {
    const card = await getRiftboundPrinting(externalId);
    return card ? { ...mapRiftboundCard(card), gameSlug: "riftbound" } : null;
  },
};

import type { CardApiAdapter, CardDetail, CardSearchResult, CatalogSearchOptions } from "./types";

const API = "https://api.pokemontcg.io/v2";

function buildSearchQuery(query: string): string {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";
  if (terms.length === 1) return `name:${terms[0]}*`;
  return terms.map((term) => `name:${term}*`).join(" ");
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const key = process.env.POKEMON_TCG_API_KEY;
  if (key) headers["X-Api-Key"] = key;
  return headers;
}

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity: string;
  set: { id: string; name: string };
  images: { small: string; large: string };
  tcgplayer?: { prices?: { normal?: { market?: number }; holofoil?: { market?: number } } };
  cardmarket?: { prices?: { averageSellPrice?: number } };
}

function mapPokemonCard(card: PokemonCard): CardSearchResult {
  const tcgPrice =
    card.tcgplayer?.prices?.holofoil?.market ??
    card.tcgplayer?.prices?.normal?.market ??
    card.cardmarket?.prices?.averageSellPrice ??
    null;

  return {
    externalId: card.id,
    name: card.name,
    setCode: card.set.id,
    setName: card.set.name,
    collectorNumber: card.number,
    rarity: card.rarity,
    edition: null,
    imageUrl: card.images?.small ?? card.images?.large ?? null,
    price: tcgPrice,
    metadata: { tcgplayer: card.tcgplayer, cardmarket: card.cardmarket },
  };
}

export const pokemonAdapter: CardApiAdapter = {
  gameSlug: "pokemon",

  async search(query: string, _options?: CatalogSearchOptions): Promise<CardSearchResult[]> {
    if (!query.trim()) return [];
    const res = await fetch(
      `${API}/cards?q=${encodeURIComponent(buildSearchQuery(query))}&pageSize=20`,
      { headers: getHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data as PokemonCard[]) ?? []).map(mapPokemonCard);
  },

  async getById(externalId: string): Promise<CardDetail | null> {
    const res = await fetch(`${API}/cards/${externalId}`, { headers: getHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const card = data.data as PokemonCard | undefined;
    if (!card) return null;
    return { ...mapPokemonCard(card), gameSlug: "pokemon" };
  },
};

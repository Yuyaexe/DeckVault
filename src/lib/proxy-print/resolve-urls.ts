import type { DeckEntry, ProxyGame } from "@/lib/proxy-print/types";
import { uniqueKeysPreserveOrder } from "@/lib/proxy-print/parse-deck";

const USER_AGENT = "DeckVault/1.0 (proxy-print; local deck export)";
const YGO_CARDINFO = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const DIGIMON_SEARCH = "https://digimoncard.io/api-public/search";
const DIGIMON_IMG_HD = (id: string) =>
  `https://images.digimoncard.io/images/cards/${id.toUpperCase()}.jpg`;
const DIGIMON_IMG_OFFICIAL = (id: string) =>
  `https://world.digimoncard.com/images/cardlist/card/${id.toUpperCase()}.png`;
const ONEPIECE_CDN = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece";
const POKEMON_TCG = "https://api.pokemontcg.io/v2/cards";
const LIMITLESS_POKEMON = "https://limitlesstcg.com/cards";

const BATCH_SIZE = 80;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init?.headers },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function firstWorkingUrl(candidates: string[]): Promise<string | null> {
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
      });
      if (res.ok) return url;
    } catch {
      /* try next */
    }
  }
  return candidates[0] ?? null;
}

interface YgoCardImage {
  image_url?: string;
  id?: number;
}

interface YgoCard {
  id: number;
  name: string;
  card_images?: YgoCardImage[];
}

async function fetchYgoBatch(ids: number[]): Promise<YgoCard[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ id: ids.join(",") });
  const payload = await fetchJson<{ data?: YgoCard[]; error?: string }>(
    `${YGO_CARDINFO}?${params}`
  );
  if (!payload.data) throw new Error(payload.error ?? "YGO API error");
  return payload.data;
}

async function resolveYugioh(entries: DeckEntry[]): Promise<Record<string, string>> {
  const ids = [...new Set(entries.map((e) => e.key).filter((k) => /^\d+$/.test(k)))].map((k) =>
    parseInt(k, 10)
  );
  const cardsById = new Map<number, YgoCard>();

  async function consume(chunk: number[]): Promise<void> {
    if (!chunk.length) return;
    try {
      const cards = await fetchYgoBatch(chunk);
      const returned = new Set(cards.map((c) => c.id));
      for (const c of cards) cardsById.set(c.id, c);
      const missing = chunk.filter((id) => !returned.has(id));
      if (missing.length && missing.length === chunk.length && chunk.length > 1) {
        const mid = Math.floor(chunk.length / 2);
        await consume(chunk.slice(0, mid));
        await consume(chunk.slice(mid));
      }
    } catch {
      if (chunk.length === 1) return;
      const mid = Math.floor(chunk.length / 2);
      await consume(chunk.slice(0, mid));
      await consume(chunk.slice(mid));
    }
  }

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    await consume(ids.slice(i, i + BATCH_SIZE));
  }

  const keyToUrl: Record<string, string> = {};
  for (const key of uniqueKeysPreserveOrder(entries)) {
    if (!/^\d+$/.test(key)) continue;
    const card = cardsById.get(parseInt(key, 10));
    const url = card?.card_images?.[0]?.image_url;
    if (url) keyToUrl[key] = url;
  }
  return keyToUrl;
}

function onepieceSetFolder(cardId: string): string {
  const cid = cardId.toUpperCase();
  if (cid.startsWith("P-")) return "P";
  const m = cid.match(/^([A-Z]+\d+)-/);
  return m ? m[1] : cid.split("-")[0];
}

function onepieceCdnUrl(cardId: string, variant: number): string {
  const cid = cardId.toUpperCase();
  const folder = onepieceSetFolder(cid);
  if (variant <= 0) return `${ONEPIECE_CDN}/${folder}/${cid}_EN.webp`;
  return `${ONEPIECE_CDN}/${folder}/${cid}_p${variant}_EN.webp`;
}

async function resolveOnepiece(entries: DeckEntry[]): Promise<Record<string, string>> {
  const keyToUrl: Record<string, string> = {};
  for (const key of uniqueKeysPreserveOrder(entries)) {
    keyToUrl[key] = onepieceCdnUrl(key, 0);
  }
  return keyToUrl;
}

const DIGIMON_CARD_ID = /^[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*$/i;

async function searchDigimonRows(params: URLSearchParams): Promise<Record<string, unknown>[]> {
  const rows = await fetchJson<Record<string, unknown>[]>(`${DIGIMON_SEARCH}?${params}`);
  return Array.isArray(rows) ? rows : [];
}

function pickDigimonRowByName(rows: Record<string, unknown>[], name: string): Record<string, unknown> | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return (
    rows.find((row) => String(row.name ?? "").toLowerCase() === normalized) ??
    rows.find((row) => String(row.name ?? "").toLowerCase().includes(normalized)) ??
    rows[0] ??
    null
  );
}

async function digimonImageForId(cardId: string): Promise<string | null> {
  const lookupId = cardId.toUpperCase();
  return firstWorkingUrl([DIGIMON_IMG_OFFICIAL(lookupId), DIGIMON_IMG_HD(lookupId)]);
}

async function resolveDigimonCardKey(key: string): Promise<string | null> {
  const lookupId = key.trim();
  if (!lookupId) return null;

  if (DIGIMON_CARD_ID.test(lookupId)) {
    try {
      const params = new URLSearchParams({
        card: lookupId.toUpperCase(),
        series: "Digimon Card Game",
      });
      const rows = await searchDigimonRows(params);
      if (rows.length) {
        const apiId = String(rows[0].id ?? lookupId).toUpperCase();
        const url = await digimonImageForId(apiId);
        if (url) return url;
      }
    } catch {
      /* fallback below */
    }
    return digimonImageForId(lookupId);
  }

  const nameQuery = lookupId.replace(/:+\s*$/, "").trim();
  try {
    const params = new URLSearchParams({
      n: nameQuery,
      desc: nameQuery,
      limit: "24",
      series: "Digimon Card Game",
      sort: "name",
      sortdirection: "asc",
    });
    const rows = await searchDigimonRows(params);
    const match = pickDigimonRowByName(rows, nameQuery);
    if (match?.id) {
      const url = await digimonImageForId(String(match.id));
      if (url) return url;
    }
  } catch {
    /* no match */
  }

  return null;
}

async function resolveDigimon(entries: DeckEntry[]): Promise<Record<string, string>> {
  const keyToUrl: Record<string, string> = {};
  for (const key of uniqueKeysPreserveOrder(entries)) {
    const url = await resolveDigimonCardKey(key);
    if (url) keyToUrl[key] = url;
  }
  return keyToUrl;
}

function pokemonQueries(key: string): string[] {
  const parts = key.split(/\s+/);
  const queries: string[] = [];
  if (parts.length >= 3 && /^\d+$/.test(parts.at(-1)!)) {
    const number = parts.at(-1)!;
    const setCode = parts.at(-2)!;
    const name = parts.slice(0, -2).join(" ");
    queries.push(`name:"${name}" set.ptcgoCode:${setCode} number:${number}`);
    queries.push(`name:"${name}" number:${number}`);
  }
  queries.push(`name:"${key}"*`);
  if (parts[0]) queries.push(`name:"${parts[0]}"*`);
  return [...new Set(queries)];
}

async function limitlessPokemonSearch(query: string): Promise<string[]> {
  try {
    const url = `${LIMITLESS_POKEMON}?q=${encodeURIComponent(query)}&display=grid`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = html.match(
      /https:\/\/limitlesstcg\.nyc3(?:\.cdn)?\.digitaloceanspaces\.com\/[^\s"'<>]+/gi
    );
    return matches ? [...new Set(matches)].slice(0, 12) : [];
  } catch {
    return [];
  }
}

async function resolvePokemon(entries: DeckEntry[]): Promise<Record<string, string>> {
  const keyToUrl: Record<string, string> = {};
  for (const key of uniqueKeysPreserveOrder(entries)) {

    const limitless = await limitlessPokemonSearch(key);
    if (limitless[0]) {
      keyToUrl[key] = limitless[0];
      continue;
    }

    for (const q of pokemonQueries(key)) {
      try {
        const params = new URLSearchParams({
          q,
          pageSize: "8",
          orderBy: "-set.releaseDate",
        });
        const payload = await fetchJson<{ data?: { images?: { large?: string; small?: string } }[] }>(
          `${POKEMON_TCG}?${params}`
        );
        const card = payload.data?.[0];
        const img = card?.images?.large ?? card?.images?.small;
        if (img) {
          keyToUrl[key] = img;
          break;
        }
      } catch {
        /* try next query */
      }
    }
  }
  return keyToUrl;
}

async function resolveDragonball(entries: DeckEntry[]): Promise<Record<string, string>> {
  const { resolveDragonballEntriesBulk, pickDragonballVariant } = await import(
    "@/lib/proxy-print/dragonball-resolve"
  );
  const { deckEntryResolveKey } = await import("@/lib/proxy-print/parse-deck");
  const resolved = await resolveDragonballEntriesBulk(entries);
  const keyToUrl: Record<string, string> = {};
  for (const entry of entries) {
    const data = resolved.get(deckEntryResolveKey(entry));
    if (!data) continue;
    const variant = pickDragonballVariant(data.variants, entry);
    if (variant?.imageUrl) keyToUrl[entry.key] = variant.imageUrl;
  }
  return keyToUrl;
}

export async function resolveProxyImageUrls(
  game: ProxyGame,
  entries: DeckEntry[]
): Promise<Record<string, string>> {
  if (game === "yugioh") return resolveYugioh(entries);
  if (game === "onepiece") return resolveOnepiece(entries);
  if (game === "digimon") return resolveDigimon(entries);
  if (game === "pokemon") return resolvePokemon(entries);
  if (game === "dragonball") return resolveDragonball(entries);
  return {};
}

export async function resolveProxyDeck(
  game: ProxyGame,
  zones: Record<string, DeckEntry[]>
): Promise<{ keyToUrl: Record<string, string>; missing: string[]; totalUnique: number }> {
  const entries = Object.values(zones).flat();
  const unique = uniqueKeysPreserveOrder(entries);
  const keyToUrl = await resolveProxyImageUrls(game, entries);
  const missing = unique.filter((k) => !keyToUrl[k]);
  return { keyToUrl, missing, totalUnique: unique.length };
}

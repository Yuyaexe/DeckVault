import type { DeckEntry, ProxyCardVariant } from "@/lib/proxy-print/types";
import { deckEntryResolveKey } from "@/lib/proxy-print/parse-deck";
import { isUserUploadedCustomImage } from "@/lib/proxy-print/preview-image";

const USER_AGENT = "DeckVault/1.0 (proxy-print)";
const DIGIMON_SEARCH = "https://digimoncard.io/api-public/search";
const DIGIMON_IMG_HD = (id: string) =>
  `https://images.digimoncard.io/images/cards/${id.toUpperCase()}.jpg`;
const DIGIMON_IMG_OFFICIAL = (id: string) =>
  `https://world.digimoncard.com/images/cardlist/card/${id.toUpperCase()}.png`;
const TCGPLAYER_IMG = (id: number, size = 874) =>
  `https://product-images.tcgplayer.com/fit-in/${size}x${size}/${id}.jpg`;

const DIGIMON_CARD_ID = /^[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*$/i;

interface DigimonApiRow {
  name?: string;
  id?: string;
  rarity?: string;
  set_name?: string[];
  tcgplayer_id?: number | null;
  tcgplayer_name?: string | null;
}

async function fetchDigimonRows(params: URLSearchParams): Promise<DigimonApiRow[]> {
  const res = await fetch(`${DIGIMON_SEARCH}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as DigimonApiRow[];
  return Array.isArray(rows) ? rows : [];
}

function digimonRowImageUrl(row: DigimonApiRow): string {
  // Prefer digimoncard.io HD art for the base printing; TCGPlayer for unique variants.
  const id = String(row.id ?? "").toUpperCase();
  const tcgName = row.tcgplayer_name?.toLowerCase() ?? "";
  const isVariantArt =
    tcgName.includes("alternate") ||
    tcgName.includes("textured") ||
    tcgName.includes("box topper") ||
    tcgName.includes("premium") ||
    tcgName.includes("sp)");

  if (row.tcgplayer_id && isVariantArt) {
    return TCGPLAYER_IMG(row.tcgplayer_id);
  }
  if (id) return DIGIMON_IMG_HD(id);
  if (row.tcgplayer_id) return TCGPLAYER_IMG(row.tcgplayer_id);
  return DIGIMON_IMG_OFFICIAL(id);
}

function buildDigimonVariant(row: DigimonApiRow, index: number): ProxyCardVariant {
  const cardId = String(row.id ?? "").toUpperCase();
  const tcgName = row.tcgplayer_name?.trim() ?? row.name ?? cardId;
  const setName = Array.isArray(row.set_name) ? row.set_name[0] ?? null : null;
  const key = row.tcgplayer_id ? `tcg-${row.tcgplayer_id}` : `row-${index}`;

  return {
    key,
    label: tcgName,
    rarity: row.rarity ?? null,
    setName,
    setCode: cardId,
    imageUrl: digimonRowImageUrl(row),
  };
}

function variantMatchesHint(variant: ProxyCardVariant, hint: string): boolean {
  const h = hint.toLowerCase();
  const label = variant.label.toLowerCase();

  if (h === "aa" || h === "fa" || h === "alt") {
    return label.includes("alternate art");
  }
  if (h === "textured" || h === "tex") {
    return label.includes("textured");
  }
  if (h === "sp") {
    return /\bsp\b/i.test(label) || label.includes("(sp)");
  }
  if (h === "foil") {
    return label.includes("foil");
  }
  if (/^\d+$/.test(h)) {
    return variant.key === `tcg-${h}`;
  }
  return label.includes(h);
}

export function pickDigimonVariant(
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
  return variants[0];
}

async function fetchDigimonRowsForKey(key: string): Promise<DigimonApiRow[]> {
  const lookupId = key.trim().toUpperCase();
  if (DIGIMON_CARD_ID.test(lookupId)) {
    const params = new URLSearchParams({
      card: lookupId,
      series: "Digimon Card Game",
    });
    return fetchDigimonRows(params);
  }

  const nameQuery = lookupId.replace(/:+\s*$/, "").trim();
  const params = new URLSearchParams({
    n: nameQuery,
    desc: nameQuery,
    limit: "24",
    series: "Digimon Card Game",
    sort: "name",
    sortdirection: "asc",
  });
  const rows = await fetchDigimonRows(params);
  const normalized = nameQuery.toLowerCase();
  const exact = rows.filter((r) => String(r.name ?? "").toLowerCase() === normalized);
  if (exact.length) return exact;
  const partial = rows.filter((r) => String(r.name ?? "").toLowerCase().includes(normalized));
  if (partial.length) return partial;
  return rows.slice(0, 1);
}

export async function resolveDigimonEntriesBulk(
  entries: DeckEntry[]
): Promise<Map<string, { name: string; variants: ProxyCardVariant[] }>> {
  const result = new Map<string, { name: string; variants: ProxyCardVariant[] }>();
  const cardIds = new Map<string, DigimonApiRow[]>();

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

    const lookupKey = DIGIMON_CARD_ID.test(entry.key) ? entry.key.toUpperCase() : entry.key;
    if (!cardIds.has(lookupKey)) {
      cardIds.set(lookupKey, await fetchDigimonRowsForKey(entry.key));
    }
    const rows = cardIds.get(lookupKey) ?? [];
    const variants = rows.map((row, index) => buildDigimonVariant(row, index));

    if (!variants.length && DIGIMON_CARD_ID.test(entry.key)) {
      variants.push({
        key: "default",
        label: entry.name,
        rarity: null,
        setName: null,
        setCode: entry.key.toUpperCase(),
        imageUrl: DIGIMON_IMG_HD(entry.key),
      });
    }

    result.set(rk, {
      name: rows[0]?.name ?? entry.name,
      variants,
    });
  }

  return result;
}

import { buildYgoImageUrl } from "@/lib/yugioh/urls";
import { mapPool } from "@/lib/proxy-print/map-pool";
import { pickDigimonVariant, resolveDigimonEntriesBulk } from "@/lib/proxy-print/digimon-resolve";
import {
  pickDragonballVariant,
  resolveDragonballEntriesBulk,
} from "@/lib/proxy-print/dragonball-resolve";
import { deckEntryResolveKey, uniqueEntriesPreserveOrder } from "@/lib/proxy-print/parse-deck";
import { isUserUploadedCustomImage } from "@/lib/proxy-print/preview-image";
import { resolveProxyImageUrls } from "@/lib/proxy-print/resolve-urls";
import type {
  DeckEntry,
  ProxyCardVariant,
  ProxyGame,
  ProxyPrintSlot,
} from "@/lib/proxy-print/types";

const USER_AGENT = "DeckVault/1.0 (proxy-print)";
const YGO_CARDINFO = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const YGO_BATCH_SIZE = 80;
const NAME_CONCURRENCY = 8;

interface YgoSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
}

interface YgoCardImage {
  id?: number;
  image_url?: string;
}

interface YgoCard {
  id: number;
  name: string;
  card_sets?: YgoSet[];
  card_images?: YgoCardImage[];
}

async function fetchYgoCards(params: Record<string, string>): Promise<YgoCard[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${YGO_CARDINFO}?${qs}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { data?: YgoCard[] };
  return payload.data ?? [];
}

async function fetchYgoBatch(ids: number[]): Promise<YgoCard[]> {
  if (!ids.length) return [];
  const out: YgoCard[] = [];
  for (let i = 0; i < ids.length; i += YGO_BATCH_SIZE) {
    const chunk = ids.slice(i, i + YGO_BATCH_SIZE);
    const cards = await fetchYgoCards({ id: chunk.join(",") });
    out.push(...cards);
  }
  return out;
}

function buildYgoVariants(card: YgoCard): ProxyCardVariant[] {
  const variants: ProxyCardVariant[] = [];
  const seenArtUrls = new Set<string>();

  const defaultUrl =
    buildYgoImageUrl(String(card.id), "full") ?? card.card_images?.[0]?.image_url ?? "";
  const firstSet = card.card_sets?.[0];

  if (defaultUrl) {
    variants.push({
      key: "default",
      label: card.name,
      rarity: firstSet?.set_rarity ?? null,
      setName: firstSet?.set_name ?? null,
      setCode: firstSet?.set_code ?? null,
      imageUrl: defaultUrl,
    });
    seenArtUrls.add(defaultUrl);
  }

  for (const [index, img] of (card.card_images ?? []).entries()) {
    const imgId = String(img.id ?? card.id);
    const imageUrl = img.image_url ?? buildYgoImageUrl(imgId, "full") ?? defaultUrl;
    if (!imageUrl || seenArtUrls.has(imageUrl)) continue;
    seenArtUrls.add(imageUrl);
    variants.push({
      key: `art-${imgId}`,
      label: index === 0 ? `${card.name} — default art` : `${card.name} — alt art ${index}`,
      rarity: null,
      setName: null,
      setCode: null,
      imageUrl,
    });
  }

  return variants;
}

async function resolveYgoByName(entry: DeckEntry): Promise<YgoCard | null> {
  const exactName = entry.name.trim();
  let cards = await fetchYgoCards({ name: exactName });
  if (!cards.length) cards = await fetchYgoCards({ fname: exactName });
  if (!cards.length) return null;

  const normalized = exactName.toLowerCase();
  return (
    cards.find((c) => c.name.toLowerCase() === normalized) ??
    cards.find((c) => c.name.toLowerCase().includes(normalized)) ??
    cards[0]
  );
}

async function resolveYgoEntriesBulk(
  entries: DeckEntry[]
): Promise<Map<string, { name: string; variants: ProxyCardVariant[] }>> {
  const result = new Map<string, { name: string; variants: ProxyCardVariant[] }>();
  // Remote `| https://…` suffixes are preferred print picks, not true uploads — still fetch variants.
  const catalogEntries = entries.filter((e) => !isUserUploadedCustomImage(e.customImageUrl));
  const passcodeEntries = catalogEntries.filter((e) => /^\d+$/.test(e.key));
  const nameEntries = catalogEntries.filter((e) => !/^\d+$/.test(e.key));
  const uploadedCustomEntries = entries.filter((e) => isUserUploadedCustomImage(e.customImageUrl));

  for (const entry of uploadedCustomEntries) {
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
  }

  const ids = [...new Set(passcodeEntries.map((e) => parseInt(e.key, 10)))];
  const cards = await fetchYgoBatch(ids);
  const byId = new Map(cards.map((c) => [c.id, c]));

  for (const entry of passcodeEntries) {
    const id = parseInt(entry.key, 10);
    const card = byId.get(id);
    if (card) {
      result.set(deckEntryResolveKey(entry), { name: card.name, variants: buildYgoVariants(card) });
    } else {
      const url = buildYgoImageUrl(entry.key, "full");
      result.set(
        deckEntryResolveKey(entry),
        url
          ? {
              name: entry.key,
              variants: [
                {
                  key: "default",
                  label: entry.key,
                  rarity: null,
                  setName: null,
                  setCode: null,
                  imageUrl: url,
                },
              ],
            }
          : { name: entry.key, variants: [] }
      );
    }
  }

  await mapPool(nameEntries, NAME_CONCURRENCY, async (entry) => {
    const card = await resolveYgoByName(entry);
    if (card) {
      result.set(deckEntryResolveKey(entry), { name: card.name, variants: buildYgoVariants(card) });
    } else {
      result.set(deckEntryResolveKey(entry), { name: entry.name, variants: [] });
    }
  });

  return result;
}

function pickYgoVariant(variants: ProxyCardVariant[], entry: DeckEntry): ProxyCardVariant | null {
  if (!variants.length) return null;
  if (entry.artHint) {
    const hint = entry.artHint.toLowerCase();
    if (hint === "fa" || hint === "aa" || hint === "alt") {
      const alt = variants.find((v) => v.key.startsWith("art-"));
      if (alt) return alt;
    }
    if (/^\d+$/.test(hint)) {
      const art = variants.find((v) => v.key === `art-${hint}`);
      if (art) return art;
    }
  }
  return variants[0];
}

function pickVariantForGame(
  game: ProxyGame,
  variants: ProxyCardVariant[],
  entry: DeckEntry
): ProxyCardVariant | null {
  if (entry.customImageUrl) {
    if (isUserUploadedCustomImage(entry.customImageUrl)) {
      return (
        variants.find((v) => v.key === "custom") ?? {
          key: "custom",
          label: entry.name,
          rarity: null,
          setName: null,
          setCode: null,
          imageUrl: entry.customImageUrl,
        }
      );
    }
    const preferred = variants.find((v) => v.imageUrl === entry.customImageUrl);
    if (preferred) return preferred;
  }
  if (game === "digimon") return pickDigimonVariant(variants, entry);
  if (game === "dragonball") return pickDragonballVariant(variants, entry);
  if (game === "yugioh") return pickYgoVariant(variants, entry);
  return variants[0] ?? null;
}

function variantToSlotFields(variant: ProxyCardVariant) {
  const setLine = [variant.setName, variant.setCode].filter(Boolean).join(" · ") || null;
  return {
    imageUrl: variant.imageUrl,
    selectedVariantKey: variant.key,
    rarity: variant.rarity,
    setLine,
  };
}

async function resolveSimpleGameEntriesBulk(
  game: ProxyGame,
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
    }
  }

  const toResolve = entries.filter((e) => !isUserUploadedCustomImage(e.customImageUrl));
  const keyToUrl = await resolveProxyImageUrls(game, toResolve);

  for (const entry of toResolve) {
    const url = keyToUrl[entry.key];
    result.set(
      deckEntryResolveKey(entry),
      url
        ? {
            name: entry.name,
            variants: [
              {
                key: "default",
                label: entry.name,
                rarity: null,
                setName: null,
                setCode: null,
                imageUrl: url,
              },
            ],
          }
        : { name: entry.name, variants: [] }
    );
  }

  return result;
}

async function resolveEntriesByGame(
  game: ProxyGame,
  entries: DeckEntry[]
): Promise<Map<string, { name: string; variants: ProxyCardVariant[] }>> {
  if (game === "yugioh") return resolveYgoEntriesBulk(entries);
  if (game === "digimon") return resolveDigimonEntriesBulk(entries);
  if (game === "dragonball") return resolveDragonballEntriesBulk(entries);
  return resolveSimpleGameEntriesBulk(game, entries);
}

export interface ProxyResolvePayload {
  slots: ProxyPrintSlot[];
  missing: string[];
  mixed: boolean;
}

export async function buildProxyPrintSlots(
  defaultGame: ProxyGame,
  entries: DeckEntry[],
  slotRefs: { slotId: string; entryKey: string; resolveKey: string; entry: DeckEntry }[]
): Promise<ProxyResolvePayload> {
  const uniqueEntries = uniqueEntriesPreserveOrder(entries);
  const gamesUsed = new Set(uniqueEntries.map((e) => e.game ?? defaultGame));
  const mixed = gamesUsed.size > 1;

  const variantCache = new Map<string, { name: string; variants: ProxyCardVariant[] }>();

  const byGame = new Map<ProxyGame, DeckEntry[]>();
  for (const entry of uniqueEntries) {
    const g = entry.game ?? defaultGame;
    const list = byGame.get(g) ?? [];
    list.push(entry);
    byGame.set(g, list);
  }

  for (const [game, gameEntries] of byGame) {
    const resolved = await resolveEntriesByGame(game, gameEntries);
    for (const [rk, data] of resolved) variantCache.set(rk, data);
  }

  const missing: string[] = [];
  const slots: ProxyPrintSlot[] = [];

  for (const ref of slotRefs) {
    const game = ref.entry.game ?? defaultGame;
    const resolved = variantCache.get(ref.resolveKey);
    const variants = resolved?.variants ?? [];
    const defaultVariant = pickVariantForGame(game, variants, ref.entry);
    const name = resolved?.name ?? ref.entry.name;

    if (!defaultVariant) missing.push(name);

    const fields = defaultVariant ? variantToSlotFields(defaultVariant) : null;

    slots.push({
      slotId: ref.slotId,
      entryKey: ref.entryKey,
      resolveKey: ref.resolveKey,
      sourceQuery: ref.entry.query,
      game,
      name,
      variantLabel: defaultVariant?.label ?? null,
      setLine: fields?.setLine ?? null,
      rarity: fields?.rarity ?? null,
      imageUrl: fields?.imageUrl ?? null,
      customImageUrl: ref.entry.customImageUrl ?? null,
      variants,
      selectedVariantKey: fields?.selectedVariantKey ?? null,
    });
  }

  return { slots, missing: [...new Set(missing)], mixed };
}

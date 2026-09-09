import {
  buildCardTraderManaSearchUrl,
  cardTraderBlueprintMatchesCard,
  collectCardTraderBlueprintGroupIds,
  resolveCardTraderProductUrl,
  resolveStoredBlueprintId,
  type CardTraderBlueprintPayload,
} from "./catalog";

export interface ResolveCardTraderUrlInput {
  name: string;
  gameSlug?: string | null;
  externalId?: string | null;
  cardTraderBlueprintId?: string | null;
  setName?: string | null;
  setCode?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
}

const blueprintGroupCache = new Map<
  number,
  { name: string; ids: number[]; expiresAt: number }
>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchCardTraderBlueprintGroup(
  blueprintId: number
): Promise<{ name: string; ids: number[] } | null> {
  const cached = blueprintGroupCache.get(blueprintId);
  if (cached && cached.expiresAt > Date.now()) {
    return { name: cached.name, ids: cached.ids };
  }

  const response = await fetch(`https://www.cardtrader.com/en/cards/${blueprintId}.json`, {
    headers: { "User-Agent": "DeckVault/1.0 (cardtrader-url)" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { blueprint?: CardTraderBlueprintPayload };
  const blueprint = data.blueprint;
  if (!blueprint?.id) return null;

  const resolved = {
    name: blueprint.name,
    ids: collectCardTraderBlueprintGroupIds(blueprint),
  };
  blueprintGroupCache.set(blueprintId, {
    ...resolved,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return resolved;
}

function resolveBlueprintId(input: ResolveCardTraderUrlInput): number | null {
  let blueprintId = resolveStoredBlueprintId(
    input.externalId,
    input.imageUrl,
    input.cardTraderBlueprintId,
    input.gameSlug
  );
  if (
    blueprintId != null &&
    !cardTraderBlueprintMatchesCard(blueprintId, {
      rarity: input.rarity,
      gameSlug: input.gameSlug,
      imageUrl: input.imageUrl,
      setCode: input.setCode,
    })
  ) {
    blueprintId = null;
  }
  return blueprintId;
}

/** Resolves a CardTrader manasearch URL with every printing of the card. */
export async function resolveCardTraderManaSearchUrl(
  input: ResolveCardTraderUrlInput
): Promise<string> {
  const blueprintId = resolveBlueprintId(input);
  if (blueprintId == null) {
    return resolveCardTraderProductUrl(input);
  }

  const group = await fetchCardTraderBlueprintGroup(blueprintId);
  if (!group) {
    return resolveCardTraderProductUrl(input);
  }

  return buildCardTraderManaSearchUrl(group.name || input.name, group.ids);
}

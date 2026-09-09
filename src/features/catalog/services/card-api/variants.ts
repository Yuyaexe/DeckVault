import { resolveRarityStyle } from "@/lib/rarity/resolve-rarity";
import {
  parseCardTraderBlueprintId,
  resolveStoredBlueprintId,
} from "@/lib/cardtrader";
import {
  buildYgoImageUrl,
  buildYgoProDeckUrl,
  pickYgoImageSizeForRarity,
} from "@/lib/yugioh/urls";
import type { CardSearchResult } from "./types";

export interface CardPrintVariant {
  key: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber?: string | null;
  rarity: string | null;
  variantLabel?: string | null;
  tcgPlayerId?: string | null;
  cardTraderRarityHint?: string | null;
  price: number | null;
  externalId: string | null;
  imageUrl: string | null;
  ygoProDeckUrl: string;
}

type YgoSet = {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code: string;
  set_price: string;
};

function ygoSetsFromResult(result: CardSearchResult): YgoSet[] {
  return (result.metadata?.sets as YgoSet[] | undefined) ?? [];
}

function findPrintForSet(
  relatedPrints: CardSearchResult[],
  setCode: string,
  setRarity: string
): CardSearchResult | undefined {
  return relatedPrints.find((print) => {
    const sets = ygoSetsFromResult(print);
    return sets.some((s) => s.set_code === setCode && s.set_rarity === setRarity);
  });
}

function digimonPrintsFromResult(result: CardSearchResult): CardSearchResult[] {
  const prints = result.metadata?.digimonPrints as CardSearchResult[] | undefined;
  if (prints?.length) return prints;
  return [result];
}

function digimonPrintToVariant(print: CardSearchResult): CardPrintVariant {
  const tcgPlayerId =
    print.metadata?.tcgplayer_id != null ? String(print.metadata.tcgplayer_id) : null;

  return {
    key: `${print.collectorNumber ?? print.externalId}-${tcgPlayerId ?? "base"}`,
    setCode: print.setCode,
    setName: print.setName,
    collectorNumber: print.collectorNumber,
    rarity: print.rarity,
    variantLabel: (print.metadata?.variantLabel as string | null | undefined) ?? print.edition,
    tcgPlayerId,
    cardTraderRarityHint: print.metadata?.cardTraderRarityHint as string | null | undefined,
    price: print.price,
    externalId: print.externalId,
    imageUrl: print.imageUrl,
    ygoProDeckUrl: "#",
  };
}

export function getSearchResultVariants(
  result: CardSearchResult,
  gameSlug: string,
  relatedPrints: CardSearchResult[] = []
): CardPrintVariant[] {
  if (gameSlug === "digimon") {
    const prints = digimonPrintsFromResult(result);
    if (prints.length > 1) {
      return prints.map(digimonPrintToVariant);
    }
  }

  if (gameSlug === "yugioh") {
    const sets = ygoSetsFromResult(result);
    const allPrints = [result, ...relatedPrints.filter((p) => p.externalId !== result.externalId)];

    if (sets.length) {
      return sets.map((s) => {
        const matchedPrint =
          findPrintForSet(allPrints, s.set_code, s.set_rarity) ?? result;
        const externalId = matchedPrint.externalId ?? result.externalId;
        const imageSize = pickYgoImageSizeForRarity(s.set_rarity);

        return {
          key: `${s.set_code}-${s.set_rarity}`,
          setCode: s.set_code,
          setName: s.set_name,
          rarity: s.set_rarity,
          cardTraderRarityHint: s.set_rarity,
          price: s.set_price ? parseFloat(s.set_price) : null,
          externalId,
          imageUrl:
            buildYgoImageUrl(externalId, imageSize) ??
            matchedPrint.imageUrl ??
            result.imageUrl,
          ygoProDeckUrl: buildYgoProDeckUrl(result.name, externalId),
        };
      });
    }
  }

  if (gameSlug === "digimon") {
    return [digimonPrintToVariant(result)];
  }

  return [
    {
      key: "default",
      setCode: result.setCode,
      setName: result.setName,
      rarity: result.rarity,
      price: result.price,
      externalId: result.externalId,
      imageUrl: result.imageUrl,
      ygoProDeckUrl:
        gameSlug === "yugioh"
          ? buildYgoProDeckUrl(result.name, result.externalId)
          : "#",
    },
  ];
}

function rarityCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
  gameSlug?: string
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const slug = gameSlug === "yugioh" || gameSlug === "digimon" ? gameSlug : undefined;
  return resolveRarityStyle(a, slug).code === resolveRarityStyle(b, slug).code;
}

function setCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const left = a.trim().toUpperCase();
  const right = b.trim().toUpperCase();
  return left === right || right.startsWith(`${left}-`) || left.startsWith(`${right}-`);
}

export function variantMatchesOwnedCard(
  variant: CardPrintVariant,
  owned: {
    rarity?: string | null;
    setCode?: string | null;
    setName?: string | null;
    collectorNumber?: string | null;
  },
  gameSlug?: string
): boolean {
  if (!rarityCodesMatch(variant.rarity, owned.rarity, gameSlug)) return false;

  const ownedCode = owned.setCode ?? owned.collectorNumber;
  if (ownedCode && variant.setCode && setCodesMatch(ownedCode, variant.setCode)) {
    return true;
  }
  if (owned.setName && variant.setName && owned.setName === variant.setName) {
    return true;
  }
  return !ownedCode && !owned.setName;
}

export function findVariantForSelection(
  variants: CardPrintVariant[],
  rarity: string,
  setCode?: string | null,
  setName?: string | null,
  collectorNumber?: string | null,
  gameSlug?: string
): CardPrintVariant | undefined {
  if (variants.length === 0) return undefined;

  const ownedCode = setCode ?? collectorNumber;

  if (ownedCode) {
    const byCode = variants.find(
      (v) =>
        rarityCodesMatch(v.rarity, rarity, gameSlug) &&
        (setCodesMatch(ownedCode, v.collectorNumber ?? v.setCode) ||
          setCodesMatch(ownedCode, v.setCode))
    );
    if (byCode) return byCode;
  }

  if (setName) {
    const bySet = variants.find(
      (v) => rarityCodesMatch(v.rarity, rarity, gameSlug) && v.setName === setName
    );
    if (bySet) return bySet;
  }

  const byRarity = variants.filter((v) => rarityCodesMatch(v.rarity, rarity, gameSlug));
  if (byRarity.length === 1) return byRarity[0];

  if (collectorNumber && byRarity.length > 1) {
    const byCollector = byRarity.find((v) =>
      setCodesMatch(collectorNumber, v.collectorNumber ?? v.setCode)
    );
    if (byCollector) return byCollector;
  }

  if (setName && byRarity.length > 1) {
    const partial = byRarity.find((v) => {
      if (!v.setName) return false;
      const prefix = v.setName.split(":")[0]?.trim() ?? v.setName;
      return setName.includes(prefix);
    });
    if (partial) return partial;
  }

  return undefined;
}

export function applyVariant(
  result: CardSearchResult,
  variant: CardPrintVariant
): CardSearchResult {
  return {
    ...result,
    externalId: variant.externalId ?? result.externalId,
    setCode: variant.setCode,
    setName: variant.setName,
    rarity: variant.rarity,
    edition: variant.variantLabel ?? result.edition,
    price: variant.price,
    imageUrl: variant.imageUrl ?? result.imageUrl,
    collectorNumber: variant.collectorNumber ?? variant.setCode ?? result.collectorNumber,
    metadata: {
      ...result.metadata,
      tcgplayer_id: variant.tcgPlayerId ?? result.metadata?.tcgplayer_id,
      variantLabel: variant.variantLabel ?? result.metadata?.variantLabel,
      cardTraderRarityHint:
        variant.cardTraderRarityHint ?? result.metadata?.cardTraderRarityHint,
    },
  };
}

/** Resolve CardTrader blueprint per print — for marketplace links only. */
export function buildVariantPriceBlueprintFields(
  variant: CardPrintVariant,
  gameSlug: string
): { blueprintId: number | null; cardTraderBlueprintId: string | null } {
  const fromExternal = parseCardTraderBlueprintId(variant.externalId);
  if (fromExternal != null) {
    return {
      blueprintId: fromExternal,
      cardTraderBlueprintId: String(fromExternal),
    };
  }

  return {
    blueprintId: resolveStoredBlueprintId(
      variant.externalId,
      variant.imageUrl,
      null,
      gameSlug
    ),
    cardTraderBlueprintId: null,
  };
}

/** Merge YGOPRODeck set entries from search hits sharing the same card name. */
export function mergeYugiohSearchResults(
  primary: CardSearchResult,
  siblings: CardSearchResult[]
): CardSearchResult {
  if (siblings.length === 0) return primary;

  const seen = new Set<string>();
  const sets: YgoSet[] = [];

  for (const card of [primary, ...siblings]) {
    for (const set of ygoSetsFromResult(card)) {
      const key = `${set.set_code}|${set.set_rarity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sets.push(set);
    }
  }

  if (sets.length === 0) return primary;

  return {
    ...primary,
    metadata: {
      ...primary.metadata,
      sets,
    },
  };
}

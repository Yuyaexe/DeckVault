import type { DemoOwnedCard } from "@/lib/demo/types";
import {
  buildLigaYugiohSearchUrl,
  buildMyPCardsSearchUrl,
  buildYgoProDeckUrl,
} from "@/lib/yugioh/urls";
import { resolveCardTraderProductUrl } from "@/lib/cardtrader/catalog";

export interface MarketplaceListing {
  source: string;
  name: string;
  price: number | null;
  currency: string;
  url: string;
  primary?: boolean;
}

export interface MarketplaceOptions {
  cardTraderUrl?: string | null;
  ygoProDeckUrl?: string | null;
}

function tcgPlayerSearchUrl(card: DemoOwnedCard["card"]): string {
  const setPart = card.setName ? ` ${card.setName}` : "";
  const searchQuery = encodeURIComponent(`${card.name}${setPart}`.trim());
  const paths: Record<string, string> = {
    yugioh: "yugioh",
    pokemon: "pokemon",
    digimon: "digimon-card-game",
  };
  const segment = paths[card.gameSlug] ?? "all";
  return `https://www.tcgplayer.com/search/${segment}/product?q=${searchQuery}`;
}

export function buildMarketplaceListings(
  card: DemoOwnedCard["card"],
  options?: MarketplaceOptions
): MarketplaceListing[] {
  const listings: MarketplaceListing[] = [];

  const cardTraderUrl =
    options?.cardTraderUrl ??
    resolveCardTraderProductUrl({
      name: card.name,
      gameSlug: card.gameSlug,
      externalId: card.externalId,
      cardTraderBlueprintId: card.cardTraderBlueprintId,
      setName: card.setName,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
    });

  const setPart = card.setName ? ` ${card.setName}` : "";
  const searchQuery = encodeURIComponent(`${card.name}${setPart}`.trim());

  switch (card.gameSlug) {
    case "yugioh":
      listings.push(
        {
          source: "TCGPlayer",
          name: "TCGPlayer",
          price: null,
          currency: "USD",
          url: tcgPlayerSearchUrl(card),
          primary: true,
        },
        {
          source: "LigaYugioh",
          name: "Liga Yu-Gi-Oh!",
          price: null,
          currency: "BRL",
          url: buildLigaYugiohSearchUrl(card.name),
        },
        {
          source: "MyPCards",
          name: "MyP Cards",
          price: null,
          currency: "BRL",
          url: buildMyPCardsSearchUrl(card.name, {
            collectorNumber: card.collectorNumber,
            setCode: card.setCode,
          }),
        },
        {
          source: "CardTrader",
          name: "CardTrader",
          price: null,
          currency: "USD",
          url: cardTraderUrl,
        }
      );
      break;

    case "pokemon":
      listings.push(
        {
          source: "CardTrader",
          name: "CardTrader",
          price: null,
          currency: "USD",
          url: cardTraderUrl,
          primary: true,
        },
        {
          source: "TCGPlayer",
          name: "TCGPlayer",
          price: null,
          currency: "USD",
          url: tcgPlayerSearchUrl(card),
        },
        {
          source: "Cardmarket",
          name: "Cardmarket",
          price: null,
          currency: "EUR",
          url: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${searchQuery}`,
        }
      );
      break;

    case "digimon":
      listings.push(
        {
          source: "CardTrader",
          name: "CardTrader",
          price: null,
          currency: "USD",
          url: cardTraderUrl,
          primary: true,
        },
        {
          source: "TCGPlayer",
          name: "TCGPlayer",
          price: null,
          currency: "USD",
          url: tcgPlayerSearchUrl(card),
        },
        {
          source: "Cardmarket",
          name: "Cardmarket",
          price: null,
          currency: "EUR",
          url: `https://www.cardmarket.com/en/Digimon/Products/Search?searchString=${searchQuery}`,
        }
      );
      break;

    default:
      listings.push(
        {
          source: "CardTrader",
          name: "CardTrader",
          price: null,
          currency: "USD",
          url: cardTraderUrl,
          primary: true,
        },
        {
          source: "TCGPlayer",
          name: "TCGPlayer",
          price: null,
          currency: "USD",
          url: tcgPlayerSearchUrl(card),
        }
      );
  }

  return listings;
}

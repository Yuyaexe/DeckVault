import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCollectionDecklistContent, getAvailableExportFormats } from "../src/features/import/services/decklist-export";
import { parseYdke } from "../src/features/import/services/ydke-codec";
import type { DemoOwnedCard } from "../src/lib/demo/types";

function owned(externalId: string, type: string, imageUrl: string | null = null): DemoOwnedCard {
  return {
    id: externalId, quantity: 1,
    card: {
      id: externalId, gameId: "yugioh", gameSlug: "yugioh", gameName: "Yu-Gi-Oh!",
      externalId, name: `Card ${externalId}`, type, imageUrl,
      setCode: null, setName: null, collectorNumber: null, rarity: null, marketPrice: null,
    },
  } as DemoOwnedCard;
}

test("CardTrader blueprint numbers are not exported as passcodes", () => {
  const cards = [owned("12345", "Effect Monster", "https://product-images.cardtrader.com/blueprints/12345-card.jpg")];
  assert.deepEqual(getAvailableExportFormats(cards, "yugioh"), ["decklist", "csv"]);
  assert.throws(() => buildCollectionDecklistContent(cards, "ydk", "yugioh"));
});

test("Fusion, Synchro, Xyz and Link cards enter the extra deck", () => {
  const cards = [
    owned("46986414", "Effect Monster"),
    owned("89631139", "Fusion Monster"),
    owned("44508094", "Synchro Monster"),
    owned("84013237", "Xyz Monster"),
    owned("86066372", "Link Monster"),
  ];
  const ydk = buildCollectionDecklistContent(cards, "ydk", "yugioh");
  assert.match(ydk, /#main\n46986414\n#extra\n89631139\n44508094\n84013237\n86066372\n#side/);
  const ydke = parseYdke(buildCollectionDecklistContent(cards, "ydke", "yugioh"));
  assert.deepEqual(ydke, {
    main: [46986414], extra: [89631139, 44508094, 84013237, 86066372], side: [],
  });
});

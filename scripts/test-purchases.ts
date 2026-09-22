import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPurchasedCardIndex, isCardPurchased } from "../src/lib/purchases/match";
import type { PurchasedCard } from "../src/lib/purchases/types";
import { hasCompletePurchaseCoverage } from "../src/lib/purchases/types";
import { createPurchaseLoader } from "../src/lib/purchases/cardtrader";
import { fetchPurchasedCards } from "../src/lib/purchases/fetch";
import { groupPurchases, searchPurchaseGroups } from "../src/lib/purchases/presentation";
import { canAccessCardTraderPurchases } from "../src/lib/purchases/access";

test("desktop mode can load purchases without a Supabase user", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousDesktop = process.env.DECKVAULT_DESKTOP;
  const previousNodeEnv = process.env.NODE_ENV;
  mutableEnv.DECKVAULT_DESKTOP = "1";
  mutableEnv.NODE_ENV = "production";
  try {
    assert.equal(canAccessCardTraderPurchases(null), true);
  } finally {
    if (previousDesktop === undefined) delete mutableEnv.DECKVAULT_DESKTOP;
    else mutableEnv.DECKVAULT_DESKTOP = previousDesktop;
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
  }
});

function purchase(overrides: Partial<PurchasedCard> = {}): PurchasedCard {
  return {
    id: "purchase-1", name: "Test card", expansion: "Set A", quantity: 1,
    priceCents: null, currency: null, status: "paid", seller: null,
    orderCode: null, blueprintId: 12345, gameId: 1, imageUrl: null,
    source: "order", ...overrides,
  };
}

for (const status of ["canceled", "cancelled", "lost", "missing", "request_for_cancel", "unknown"]) {
  test(`does not cover cards from ${status} purchases`, () => {
    const index = buildPurchasedCardIndex([purchase({ status })]);
    assert.equal(isCardPurchased({ name: "Test card" }, index), false);
    assert.equal(index.blueprintIds.has(12345), false);
  });
}

test("zero or invalid quantities do not cover cards", () => {
  for (const quantity of [0, -1, NaN, Infinity]) {
    assert.equal(buildPurchasedCardIndex([purchase({ quantity })]).names.size, 0);
  }
});

test("active and fulfilled purchases still cover cards", () => {
  for (const status of ["paid", "sent", "arrived", "done", "hub_pending", "presale"]) {
    assert.equal(isCardPurchased({ name: "Test card" }, buildPurchasedCardIndex([purchase({ status })])), true);
  }
});

test("a known different printing does not match by name alone", () => {
  const index = buildPurchasedCardIndex([purchase()]);
  assert.equal(isCardPurchased({ name: "Test card", setName: "Set B", cardTraderBlueprintId: "54321" }, index), false);
  assert.equal(isCardPurchased({ name: "Test card", setName: "Set A", cardTraderBlueprintId: "12345" }, index), true);
  assert.equal(isCardPurchased({ name: "Test card", setName: "Set B" }, index), false);
});

const order = (id: number, state = "paid") => ({
  id, state, order_items: [{ id, name: `Card ${id}`, blueprint_id: id, quantity: 1 }],
});

test("loads more than 100 orders and shares concurrent requests and fresh cache", async () => {
  const pages: number[] = [];
  let zeroCalls = 0;
  const load = createPurchaseLoader(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("ct0_box_items")) { zeroCalls++; return Response.json([]); }
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    return Response.json(page === 1 ? Array.from({ length: 100 }, (_, i) => order(i + 1)) : [order(101)]);
  });
  const [first, second] = await Promise.all([load("token"), load("token")]);
  assert.equal(first.cards.length, 101);
  assert.equal(first.cards[100].name, "Card 101");
  assert.equal(hasCompletePurchaseCoverage(first), true);
  assert.deepEqual(first, second);
  await load("token");
  assert.deepEqual(pages, [1, 2]);
  assert.equal(zeroCalls, 1);
});

test("requests the empty final page when order count is an exact multiple of 100", async () => {
  const pages: number[] = [];
  const load = createPurchaseLoader(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("ct0_box_items")) return Response.json([]);
    const page = Number(url.searchParams.get("page")); pages.push(page);
    return Response.json(page === 1 ? Array.from({ length: 100 }, (_, i) => order(i)) : []);
  });
  assert.equal((await load("token")).cards.length, 100);
  assert.deepEqual(pages, [1, 2]);
});

test("keeps canceled and missing history but only pending/ok CT Zero units cover cards", async () => {
  const load = createPurchaseLoader(async (input) => Response.json(String(input).includes("ct0_box_items") ? [
    { id: 1, name: "Missing", quantity: { missing: 2 } },
    { id: 2, name: "Mixed", quantity: { missing: 2, pending: 1, ok: 1 } },
    { id: 3, name: "Canceled CT", quantity: { ok: 1 }, cancelled_at: "2026-09-01" },
    { id: 4, name: "No units" },
  ] : [order(5, "canceled")]));
  const result = await load("token");
  assert.equal(result.cards.length, 5);
  const index = buildPurchasedCardIndex(result.cards);
  for (const name of ["Missing", "Canceled CT", "No units", "Card 5"]) {
    assert.equal(isCardPurchased({ name }, index), false);
  }
  assert.equal(isCardPurchased({ name: "Mixed" }, index), true);
  assert.equal(result.cards.find(c => c.name === "Mixed")?.quantity, 4);
  assert.equal(result.cards.find(c => c.name === "Mixed")?.validQuantity, 2);
  assert.equal(result.cardTraderZeroSummary.missing, 4);
});

test("a failed later page never becomes a complete order history", async () => {
  const load = createPurchaseLoader(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("ct0_box_items")) return Response.json([{ id: 7, name: "CT card", quantity: { ok: 1 } }]);
    return url.searchParams.get("page") === "1"
      ? Response.json(Array.from({ length: 100 }, (_, i) => order(i)))
      : new Response(null, { status: 429 });
  });
  const result = await load("token");
  assert.equal(hasCompletePurchaseCoverage(result), false);
  assert.equal(result.sources.orders.status, "unavailable");
  assert.equal(result.sources.cardTraderZero.status, "fresh");
  assert.deepEqual(result.cards.map(c => c.name), ["CT card"]);
});

for (const failingSource of ["orders", "ct0_box_items"]) {
  test(`retains last successful data when ${failingSource} fails, then recovers`, async () => {
    let time = 1;
    let failing = false;
    const load = createPurchaseLoader(async (input) => {
      const url = String(input);
      if (failing && url.includes(failingSource)) return new Response(null, { status: 503 });
      return Response.json(url.includes("ct0_box_items")
        ? [{ id: 1, name: "CT card", quantity: { pending: 1 } }] : [order(2)]);
    }, () => time);
    const first = await load("token");
    time = 60_002; failing = true;
    const stale = await load("token");
    assert.deepEqual(stale.cards, first.cards);
    assert.equal(hasCompletePurchaseCoverage(stale), false);
    const status = failingSource === "orders" ? stale.sources.orders : stale.sources.cardTraderZero;
    assert.equal(status.status, "stale");
    assert.equal(status.lastSuccessAt, new Date(1).toISOString());
    failing = false;
    assert.equal(hasCompletePurchaseCoverage(await load("token")), true);
  });
}

test("both failed sources and malformed responses block filtered export", async () => {
  const load = createPurchaseLoader(async (input) => String(input).includes("ct0_box_items")
    ? Response.json({ error: "not an array" }) : new Response(null, { status: 429 }));
  const result = await load("token");
  assert.equal(hasCompletePurchaseCoverage(result), false);
  assert.equal(hasCompletePurchaseCoverage(undefined), false);
  assert.deepEqual(result.cards, []);
  assert.equal(result.sources.orders.status, "unavailable");
  assert.equal(result.sources.cardTraderZero.status, "unavailable");
});

test("a different credential never receives another account's cached history", async () => {
  let failing = false;
  const load = createPurchaseLoader(async (input) => failing ? new Response(null, { status: 401 })
    : Response.json(String(input).includes("ct0_box_items") ? [] : [order(1)]));
  await load("first-token");
  failing = true;
  const result = await load("second-token");
  assert.deepEqual(result.cards, []);
  assert.equal(result.sources.orders.status, "unavailable");
});

test("repeated full pages cannot loop forever or claim complete coverage", async () => {
  let calls = 0;
  const load = createPurchaseLoader(async (input) => {
    if (String(input).includes("ct0_box_items")) return Response.json([]);
    calls++;
    return Response.json(Array.from({ length: 100 }, (_, i) => order(i)));
  });
  assert.equal(hasCompletePurchaseCoverage(await load("token")), false);
  assert.equal(calls, 2);
});

test("client preserves partial-source metadata so export cannot treat it as complete", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({
    cards: [purchase()], complete: true,
    sources: {
      orders: { status: "fresh", lastSuccessAt: null },
      cardTraderZero: { status: "stale", lastSuccessAt: "2026-09-21T00:00:00Z" },
    },
  }));
  const data = await fetchPurchasedCards();
  assert.equal(data.cards.length, 1);
  assert.equal(data.sources.cardTraderZero.status, "stale");
  assert.equal(hasCompletePurchaseCoverage(data), false);
});

test("legacy response without completeness metadata cannot enable filtered export", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ cards: [purchase()] }));
  assert.equal(hasCompletePurchaseCoverage(await fetchPurchasedCards()), false);
});

test("CT Zero display splits mixed quantities without double counting or mutating coverage", () => {
  const card = purchase({ source: "cardtrader-zero", status: "pending", quantity: 6,
    validQuantity: 5, zeroQuantities: { arrived: 2, pending: 3, missing: 1 } });
  const groups = groupPurchases([card]);
  assert.deepEqual(groups.map(group => [group.status, group.quantity]), [["arrived", 2], ["pending", 3], ["missing", 1]]);
  assert.equal(card.quantity, 6);
  assert.equal(card.validQuantity, 5);
});

test("order groups count orders separately from copies and never group by seller", () => {
  const groups = groupPurchases([
    purchase({ id: "a", orderId: 1, orderCode: "ONE", quantity: 3, seller: "seller A" }),
    purchase({ id: "b", orderId: 1, orderCode: "ONE", quantity: 2, seller: "seller B" }),
    purchase({ id: "c", orderId: 2, orderCode: "TWO", quantity: 1 }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.quantity), [5, 1]);
  assert.deepEqual(searchPurchaseGroups(groups, "two").map(group => group.quantity), [1]);
  assert.deepEqual(searchPurchaseGroups(groups, "seller A"), []);
  assert.equal(searchPurchaseGroups(groups, "Set A").length, 2);
});

test("canceled CT Zero rows stay separate from ready and pending groups", () => {
  const groups = groupPurchases([purchase({ source: "cardtrader-zero", status: "cancelled",
    quantity: 2, validQuantity: 0, zeroQuantities: { arrived: 2, pending: 0, missing: 0 } })]);
  assert.deepEqual(groups.map(group => [group.status, group.quantity]), [["canceled", 2]]);
});

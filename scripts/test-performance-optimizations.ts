import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncKeyedDeduper } from "../src/lib/cache/async-dedupe";
import {
  buildPurchasedCardIndex,
  getPurchasedCardIndex,
} from "../src/lib/purchases/match";
import type { PurchasedCard } from "../src/lib/purchases/types";

function purchase(id: string): PurchasedCard {
  return {
    id,
    name: `Card ${id}`,
    expansion: null,
    quantity: 1,
    validQuantity: 1,
    priceCents: null,
    currency: null,
    status: "paid",
    seller: null,
    orderCode: null,
    blueprintId: Number(id),
    gameId: 1,
    imageUrl: null,
    source: "order",
  };
}

test("purchase index is shared for the same immutable cards array", () => {
  const cards = [purchase("1"), purchase("2")];
  const first = getPurchasedCardIndex(cards);
  const second = getPurchasedCardIndex(cards);
  assert.equal(first, second);
  assert.deepEqual(first, buildPurchasedCardIndex(cards));

  const copied = [...cards];
  assert.notEqual(getPurchasedCardIndex(copied), first);
});

test("async keyed deduper shares one in-flight task per key", async () => {
  const dedupe = createAsyncKeyedDeduper<string, string>();
  let calls = 0;
  const task = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return "ok";
  };

  const results = await Promise.all(
    Array.from({ length: 20 }, () => dedupe("same", task))
  );

  assert.equal(calls, 1);
  assert.deepEqual(new Set(results), new Set(["ok"]));
});

test("async keyed deduper clears failed tasks so retries work", async () => {
  const dedupe = createAsyncKeyedDeduper<string, string>();
  let calls = 0;

  await assert.rejects(
    dedupe("retry", async () => {
      calls++;
      throw new Error("temporary");
    })
  );

  const result = await dedupe("retry", async () => {
    calls++;
    return "recovered";
  });

  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});

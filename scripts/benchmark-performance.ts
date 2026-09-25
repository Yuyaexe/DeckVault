import { performance } from "node:perf_hooks";
import {
  buildPurchasedCardIndex,
  getPurchasedCardIndex,
} from "../src/lib/purchases/match";
import type { PurchasedCard } from "../src/lib/purchases/types";
import { createAsyncKeyedDeduper } from "../src/lib/cache/async-dedupe";
import {
  IMAGE_PRUNE_WRITE_INTERVAL,
  IMAGE_TOUCH_BATCH_SIZE,
} from "../src/lib/cache/constants";

function ms(value: number) {
  return Number(value.toFixed(2));
}

function makePurchases(count: number): PurchasedCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Card Name ${i % 1800}`,
    expansion: `SET-${i % 120}`,
    quantity: 1 + (i % 3),
    validQuantity: 1 + (i % 3),
    priceCents: 100 + i,
    currency: "EUR",
    status: i % 7 === 0 ? "done" : "paid",
    seller: null,
    orderCode: null,
    blueprintId: 100000 + i,
    gameId: 1,
    imageUrl: null,
    source: "order",
  }));
}

function benchmarkPurchaseIndex() {
  const purchases = makePurchases(5000);
  const overlayCount = 300;

  const oldStart = performance.now();
  for (let i = 0; i < overlayCount; i++) {
    buildPurchasedCardIndex(purchases);
  }
  const oldMs = performance.now() - oldStart;

  const newStart = performance.now();
  for (let i = 0; i < overlayCount; i++) {
    getPurchasedCardIndex(purchases);
  }
  const newMs = performance.now() - newStart;

  return {
    purchases: purchases.length,
    overlays: overlayCount,
    beforeMs: ms(oldMs),
    afterMs: ms(newMs),
    speedup: Number((oldMs / Math.max(newMs, 0.0001)).toFixed(1)),
  };
}

function imageMaintenance(writeCount = 500) {
  function run(pruneEvery: number) {
    const entries = new Map<string, number>();
    for (let i = 0; i < 400; i++) entries.set(`seed-${i}`, i);
    let scannedEntries = 0;
    let pruneRuns = 0;
    let writesSincePrune = 0;
    const started = performance.now();

    for (let i = 0; i < writeCount; i++) {
      entries.set(`new-${i}`, 10_000 + i);
      writesSincePrune++;
      const firstSessionPrune = pruneEvery > 1 && i === 0;
      if (!firstSessionPrune && writesSincePrune < pruneEvery) continue;
      writesSincePrune = 0;
      pruneRuns++;
      const rows = [...entries.entries()];
      scannedEntries += rows.length;
      if (rows.length > 400) {
        rows.sort((a, b) => a[1] - b[1]);
        for (let j = 0; j < rows.length - 400; j++) {
          entries.delete(rows[j][0]);
        }
      }
    }

    return {
      pruneRuns,
      scannedEntries,
      totalMs: ms(performance.now() - started),
    };
  }

  const before = run(1);
  const after = run(IMAGE_PRUNE_WRITE_INTERVAL);

  return {
    writes: writeCount,
    before,
    after,
    scanReduction: Number(
      (before.scannedEntries / Math.max(after.scannedEntries, 1)).toFixed(1)
    ),
    cacheHitWriteTransactions: {
      before: writeCount,
      after: Math.ceil(writeCount / IMAGE_TOUCH_BATCH_SIZE),
    },
  };
}
async function benchmarkPasscodeInflight() {
  const run = async (deduped: boolean) => {
    let resolverCalls = 0;
    const dedupe = createAsyncKeyedDeduper<string, string>();
    const resolver = async () => {
      resolverCalls++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "46986414";
    };

    const started = performance.now();
    await Promise.all(
      Array.from({ length: 50 }, () =>
        deduped ? dedupe("same-card", resolver) : resolver()
      )
    );

    return {
      resolverCalls,
      totalMs: ms(performance.now() - started),
    };
  };

  return {
    concurrentRequests: 50,
    before: await run(false),
    after: await run(true),
  };
}
async function main() {
  console.log(
    JSON.stringify(
      {
        purchaseIndex: benchmarkPurchaseIndex(),
        imageMaintenance: imageMaintenance(),
        passcodeInflight: await benchmarkPasscodeInflight(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

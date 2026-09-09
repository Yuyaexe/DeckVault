/**
 * Invoked by verify-backup-import.mjs via tsx — uses the same parseBackupJson as the app.
 */
import { readFileSync } from "node:fs";
import { parseBackupJson } from "../src/features/import/services/backup-import";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx verify-backup-import-runner.ts <backup.json>");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const backup = parseBackupJson(raw);

const collectionIds = new Set(backup.collections.map((c) => c.id));

console.log(
  JSON.stringify({
    version: backup.version,
    currency: backup.profile.currency,
    collections: backup.collections.map((c) => ({
      name: c.name,
      isDefault: c.isDefault,
    })),
    cardCount: backup.ownedCards.length,
    totalQuantity: backup.ownedCards.reduce((sum, oc) => sum + oc.quantity, 0),
    payloadBytes: JSON.stringify({ backup }).length,
    invalidCollectionRefs: backup.ownedCards.filter(
      (oc) => !collectionIds.has(oc.collectionId)
    ).length,
    missingExternalId: backup.ownedCards.filter(
      (oc) => !oc.card.externalId && !oc.card.cardTraderBlueprintId
    ).length,
    missingName: backup.ownedCards.filter((oc) => !oc.card.name?.trim()).length,
    missingImage: backup.ownedCards.filter((oc) => !oc.card.imageUrl).length,
  })
);

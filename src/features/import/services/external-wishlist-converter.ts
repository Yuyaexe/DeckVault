import {
  BACKUP_VERSION,
  defaultAnimeBackupFields,
  type DeckVaultBackup,
} from "@/features/import/services/backup-export";
import {
  createInitialDemoState,
  DEMO_GAMES,
  type DemoCollection,
  type DemoOwnedCard,
} from "@/lib/demo/types";
import type { Currency } from "@/types/tcg";

/** Full backup from the CT Yu-Gi-Oh app (Tools/CT) — yugioh-backup-*.json */
export interface ExternalWishlistBackup {
  backupVersion: number;
  exportedAt?: string;
  collection: {
    activeTabId?: string;
    tabs: ExternalWishlistTab[];
  };
  ui?: Record<string, unknown>;
}

/** Single-tab export from CT app — yugioh-collection-*.json (exportVersion 1 or 2) */
export interface CtYugiohTabExport {
  exportVersion: 1 | 2;
  tabName?: string;
  exportedAt?: string;
  items: unknown[];
}

interface ExternalWishlistTab {
  id: string;
  name: string;
  items: ExternalWishlistItem[];
}

type ExternalWishlistItem = ExternalWishlistFolder | ExternalWishlistCardEntry;

interface ExternalWishlistFolder {
  type: "folder";
  id: string;
  label: string;
  description?: string;
  imageDataUrl?: string;
  items: ExternalWishlistItem[];
}

interface ExternalWishlistCardEntry {
  card: {
    id: number;
    name: string;
    card_images?: Array<{ image_url?: string }>;
    expansion?: { id?: number | null; name?: string };
  };
  pricing?: {
    priceLabel?: string;
    detailUrl?: string;
    cheapestPriceCents?: number | null;
    cheapestPriceCurrency?: string;
  };
  owned?: boolean;
  quantity?: number;
}

const YGO = DEMO_GAMES[0];

const RARITY_SLUGS: Array<[string, string]> = [
  ["quarter-century-secret-rare", "Quarter Century Secret Rare"],
  ["gold-secret-rare", "Gold Secret Rare"],
  ["starlight-rare", "Starlight Rare"],
  ["collectors-rare", "Collector's Rare"],
  ["ultimate-rare", "Ultimate Rare"],
  ["secret-rare", "Secret Rare"],
  ["ultra-rare", "Ultra Rare"],
  ["super-rare", "Super Rare"],
  ["starfoil-rare", "Starfoil Rare"],
  ["shatterfoil-rare", "Shatterfoil Rare"],
  ["ghost-rare", "Ghost Rare"],
  ["common", "Common"],
  ["rare", "Rare"],
];

/** CT app full backup: backupVersion 1 + collection.tabs */
export function isExternalWishlistBackup(raw: unknown): raw is ExternalWishlistBackup {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (obj.backupVersion !== 1) return false;
  const collection = obj.collection;
  if (!collection || typeof collection !== "object") return false;
  return Array.isArray((collection as { tabs?: unknown }).tabs);
}

/** CT app tab export: exportVersion 1|2 + items[] */
export function isCtYugiohTabExport(raw: unknown): raw is CtYugiohTabExport {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  const ver = obj.exportVersion;
  if (ver !== 1 && ver !== 2) return false;
  return Array.isArray(obj.items);
}

export function isCtYugiohAppJson(raw: unknown): boolean {
  return isExternalWishlistBackup(raw) || isCtYugiohTabExport(raw);
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rarityFromDetailUrl(url: string | undefined): string | null {
  if (!url) return null;
  const slug = url.split("/").pop()?.toLowerCase() ?? "";
  for (const [needle, label] of RARITY_SLUGS) {
    if (slug.includes(needle)) return label;
  }
  return null;
}

function detectCurrency(tabs: ExternalWishlistTab[]): Currency {
  for (const tab of tabs) {
    for (const entry of walkItems(tab.items)) {
      if (entry.pricing?.cheapestPriceCurrency === "BRL") return "BRL";
    }
  }
  return "USD";
}

function marketPriceFromPricing(
  pricing: ExternalWishlistCardEntry["pricing"] | undefined
): number | null {
  const cents = pricing?.cheapestPriceCents;
  if (cents != null && Number.isFinite(cents)) return cents / 100;
  const label = pricing?.priceLabel;
  if (!label) return null;
  const normalized = label.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function flatExportRowToEntry(row: Record<string, unknown>): ExternalWishlistCardEntry | null {
  const name = String(row.name ?? "").trim();
  const id = Number(row.blueprintId);
  if (!name || !Number.isFinite(id) || id <= 0) return null;
  const priceLabel = row.priceLabel != null ? String(row.priceLabel) : undefined;
  return {
    card: { id, name, card_images: [] },
    pricing: {
      priceLabel,
      detailUrl: row.detailUrl != null ? String(row.detailUrl) : undefined,
      cheapestPriceCurrency: priceLabel?.includes("R$") ? "BRL" : undefined,
    },
    owned: row.owned === true,
    quantity: typeof row.quantity === "number" ? row.quantity : undefined,
  };
}

function* walkItems(items: unknown[]): Generator<ExternalWishlistCardEntry> {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "folder" && Array.isArray(row.items)) {
      yield* walkItems(row.items);
      continue;
    }
    if (row.type === "card" && row.name) {
      const entry = flatExportRowToEntry(row);
      if (entry) yield entry;
      continue;
    }
    if ("card" in row && (row as unknown as ExternalWishlistCardEntry).card?.name) {
      yield row as unknown as ExternalWishlistCardEntry;
    }
  }
}

function cardMergeKey(card: DemoOwnedCard["card"]): string {
  return card.cardTraderBlueprintId ?? card.externalId ?? card.name;
}

function cardEntryToOwned(
  entry: ExternalWishlistCardEntry,
  collectionId: string
): DemoOwnedCard {
  const blueprintId = entry.card.id > 0 ? String(entry.card.id) : null;
  const imageUrl = entry.card.card_images?.[0]?.image_url ?? null;
  const marketPrice = marketPriceFromPricing(entry.pricing);
  const cardId = newId();

  return {
    id: newId(),
    collectionId,
    cardId,
    card: {
      id: cardId,
      gameId: YGO.id,
      gameSlug: YGO.slug,
      gameName: YGO.name,
      externalId: blueprintId,
      name: entry.card.name,
      setCode: null,
      setName: entry.card.expansion?.name ?? null,
      collectorNumber: null,
      rarity: rarityFromDetailUrl(entry.pricing?.detailUrl),
      imageUrl,
      marketPrice,
      cardTraderBlueprintId: blueprintId,
    },
    quantity: Math.max(1, entry.quantity ?? 1),
    condition: "NM",
    language: "EN",
    isFoil: false,
    purchasePrice: null,
    notes: entry.owned === false ? "Lista de desejos" : null,
    tagIds: [],
  };
}

function mergeOwnedInto(
  target: Map<string, DemoOwnedCard>,
  owned: DemoOwnedCard
): void {
  const key = `${owned.collectionId}:${cardMergeKey(owned.card)}`;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, owned);
    return;
  }
  existing.quantity += owned.quantity;
}

/** Merge folder-split DeckVault collections back into one per tab (opa, CARDTRADER, …). */
export function mergeDeckVaultCollectionsByTab(
  backup: DeckVaultBackup
): DeckVaultBackup {
  if (backup.collections.length <= 1) return backup;

  const tabToOldIds = new Map<string, string[]>();

  for (const col of backup.collections) {
    const sep = col.name.indexOf(" · ");
    const tabName = sep >= 0 ? col.name.slice(0, sep).trim() : col.name.trim();
    const list = tabToOldIds.get(tabName) ?? [];
    list.push(col.id);
    tabToOldIds.set(tabName, list);
  }

  if (tabToOldIds.size === backup.collections.length) {
    return backup;
  }

  const oldToNew = new Map<string, string>();
  const collections: DemoCollection[] = [];
  let isFirst = true;

  for (const [tabName] of tabToOldIds) {
    const collectionId = newId();
    collections.push({
      id: collectionId,
      name: tabName,
      isDefault: isFirst,
      isFavorite: isFirst,
      coverImageUrl: null,
    });
    for (const oldId of tabToOldIds.get(tabName) ?? []) {
      oldToNew.set(oldId, collectionId);
    }
    isFirst = false;
  }

  const merged = new Map<string, DemoOwnedCard>();
  for (const oc of backup.ownedCards) {
    const collectionId = oldToNew.get(oc.collectionId);
    if (!collectionId) continue;
    mergeOwnedInto(merged, { ...oc, collectionId });
  }

  return {
    ...backup,
    collections,
    ownedCards: [...merged.values()],
  };
}

/** CT tab export (exportVersion 1/2) → one DeckVault collection. */
export function convertCtTabExportToDeckVault(source: CtYugiohTabExport): DeckVaultBackup {
  const tabName = String(source.tabName || "CT Import").trim() || "CT Import";
  return convertExternalWishlistToDeckVault({
    backupVersion: 1,
    exportedAt: source.exportedAt,
    collection: {
      tabs: [{ id: "ct-import", name: tabName, items: source.items as ExternalWishlistItem[] }],
    },
  });
}

/** CT full backup — one DeckVault collection per tab, folders merged. */
export function convertExternalWishlistToDeckVault(
  source: ExternalWishlistBackup
): DeckVaultBackup {
  const tabs = source.collection.tabs ?? [];
  const collections: DemoCollection[] = [];
  const mergedCards = new Map<string, DemoOwnedCard>();
  let makeDefault = true;

  for (const tab of tabs) {
    const collectionId = newId();
    const tabName = tab.name.trim() || "Coleção";
    collections.push({
      id: collectionId,
      name: tabName,
      isDefault: makeDefault,
      isFavorite: makeDefault,
      coverImageUrl: null,
    });
    makeDefault = false;

    for (const entry of walkItems(tab.items)) {
      mergeOwnedInto(mergedCards, cardEntryToOwned(entry, collectionId));
    }
  }

  if (collections.length === 0) {
    const initial = createInitialDemoState();
    return {
      version: BACKUP_VERSION,
      exportedAt: source.exportedAt ?? new Date().toISOString(),
      profile: {
        ...initial.profile,
        currency: detectCurrency(tabs),
      },
      collections: initial.collections,
      ownedCards: [],
      tags: [],
      ...defaultAnimeBackupFields(),
    };
  }

  const initial = createInitialDemoState();

  return {
    version: BACKUP_VERSION,
    exportedAt: source.exportedAt ?? new Date().toISOString(),
    profile: {
      ...initial.profile,
      currency: detectCurrency(tabs),
    },
    collections,
    ownedCards: [...mergedCards.values()],
    tags: [],
    ...defaultAnimeBackupFields(),
  };
}

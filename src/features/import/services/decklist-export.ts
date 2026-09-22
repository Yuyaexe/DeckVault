import type { DemoOwnedCard } from "@/lib/demo/types";
import { exportCollectionCsv } from "@/features/import/services/export-csv";
import { encodeYdke } from "@/features/import/services/ydke-codec";
import { resolveYugiohPasscode } from "@/lib/yugioh/passcode";

export type DeckExportFormat = "decklist" | "ydke" | "ydk" | "csv";

function aggregateCards(cards: DemoOwnedCard[]) {
  const map = new Map<string, { card: DemoOwnedCard["card"]; quantity: number }>();

  for (const owned of cards) {
    const key = owned.card.externalId ?? `${owned.card.name}|${owned.card.collectorNumber ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += owned.quantity;
      continue;
    }
    map.set(key, { card: owned.card, quantity: owned.quantity });
  }

  return Array.from(map.values());
}

function downloadText(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDigimonDecklist(items: ReturnType<typeof aggregateCards>): string {
  const lines = ["// DeckList", ""];
  for (const { card, quantity } of items) {
    const code = card.collectorNumber ?? card.setCode ?? card.externalId ?? "UNKNOWN";
    lines.push(`${quantity} ${card.name}   ${code}`);
  }
  return lines.join("\n");
}

function formatYdk(items: ReturnType<typeof aggregateCards>): string | null {
  const main: string[] = [];
  const extra: string[] = [];
  const side: string[] = [];

  for (const { card, quantity } of items) {
    const passcode = exportPasscode(card);
    if (!passcode) return null;
    const section = isExtraDeckCard(card) ? extra : main;
    for (let i = 0; i < quantity; i++) {
      section.push(passcode.padStart(8, "0"));
    }
  }

  return ["#created by DeckVault", "#main", ...main, "#extra", ...extra, "#side", ...side].join(
    "\n"
  );
}

function formatYdke(items: ReturnType<typeof aggregateCards>): string | null {
  const main: number[] = [];
  const extra: number[] = [];
  for (const { card, quantity } of items) {
    const code = exportPasscode(card);
    if (!code) return null;
    const passcode = parseInt(code, 10);
    const section = isExtraDeckCard(card) ? extra : main;
    for (let i = 0; i < quantity; i++) {
      section.push(passcode);
    }
  }

  return encodeYdke({ main, extra, side: [] });
}

function exportPasscode(card: DemoOwnedCard["card"]): string | null {
  if (card.gameSlug !== "yugioh") return null;
  if (card.cardTraderBlueprintId && card.cardTraderBlueprintId === card.externalId) return null;
  return resolveYugiohPasscode(card.externalId, card.imageUrl, null);
}

function isExtraDeckCard(card: DemoOwnedCard["card"]): boolean {
  return /\b(Fusion|Synchro|Xyz|Link)\b/i.test(card.type ?? "");
}

function formatYugiohTextDecklist(items: ReturnType<typeof aggregateCards>): string {
  const lines = ["// DeckList", ""];
  for (const { card, quantity } of items) {
    lines.push(`${quantity} ${card.name}`);
  }
  return lines.join("\n");
}

function buildDecklistContent(
  items: ReturnType<typeof aggregateCards>,
  format: DeckExportFormat,
  slug: string
): string | null {
  if (format === "ydke") return formatYdke(items);
  if (format === "ydk") return formatYdk(items);
  if (format === "csv") return null;
  return slug === "digimon" ? formatDigimonDecklist(items) : formatYugiohTextDecklist(items);
}

/** Build export text without downloading — for copy or preview. */
export function buildCollectionDecklistContent(
  cards: DemoOwnedCard[],
  format: DeckExportFormat,
  gameSlug?: string
): string {
  const slug = gameSlug ?? cards[0]?.card.gameSlug ?? "yugioh";
  const items = aggregateCards(cards);
  const content = buildDecklistContent(items, format, slug);
  if (content == null) {
    if (format === "ydke") {
      throw new Error("YDKE export requires Yu-Gi-Oh passcodes (external IDs) on all cards.");
    }
    if (format === "ydk") {
      throw new Error("YDK export requires Yu-Gi-Oh passcodes (external IDs) on all cards.");
    }
    throw new Error("CSV export is download-only.");
  }
  return content;
}

export function exportCollectionDecklist(
  cards: DemoOwnedCard[],
  collectionName: string,
  format: DeckExportFormat,
  gameSlug?: string
) {
  const slug = gameSlug ?? cards[0]?.card.gameSlug ?? "yugioh";
  const safeName = collectionName.replace(/\s+/g, "_");

  if (format === "csv") {
    exportCollectionCsv(cards, collectionName);
    return;
  }

  const content = buildCollectionDecklistContent(cards, format, slug);
  const filename =
    format === "ydke"
      ? `${safeName}.ydke.txt`
      : format === "ydk"
        ? `${safeName}.ydk`
        : `${safeName}_decklist.txt`;
  downloadText(content, filename);
}

export function getAvailableExportFormats(
  cards: DemoOwnedCard[],
  gameSlug?: string
): DeckExportFormat[] {
  const slug = gameSlug ?? cards[0]?.card.gameSlug;
  const formats: DeckExportFormat[] = ["decklist", "csv"];

  if (slug === "yugioh") {
    const items = aggregateCards(cards);
    const allPasscodes = items.every(
      ({ card }) => exportPasscode(card) != null
    );
    if (allPasscodes && items.length > 0) {
      formats.splice(1, 0, "ydke", "ydk");
    }
  }

  return formats;
}

export const EXPORT_FORMAT_LABELS: Record<DeckExportFormat, string> = {
  decklist: "Deck List (.txt)",
  ydke: "YDKE",
  ydk: "YDK",
  csv: "CSV",
};

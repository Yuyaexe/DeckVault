import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

export type DecklistFormat =
  | "ydke"
  | "ydk"
  | "yugioh-text"
  | "digimon-text"
  | "unknown";

export type DecklistGameSlug = "yugioh" | "digimon" | "unknown";

export interface ParsedDeckEntry {
  quantity: number;
  name: string;
  setCode: string | null;
  passcode: number | null;
  section: "main" | "extra" | "side" | null;
}

export interface ParsedDecklist {
  format: DecklistFormat;
  gameSlug: DecklistGameSlug;
  entries: ParsedDeckEntry[];
}

export interface ResolvedDeckEntry {
  entry: ParsedDeckEntry;
  result: CardSearchResult | null;
  error?: string;
}

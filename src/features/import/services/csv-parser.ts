export type CsvPreset = "generic" | "cardtrader" | "tcgplayer";

export interface CsvColumnMapping {
  name: string;
  set: string;
  quantity: string;
  condition: string;
  language: string;
  game: string;
  foil: string;
  price: string;
}

export const CSV_PRESETS: Record<CsvPreset, Partial<CsvColumnMapping>> = {
  generic: {},
  cardtrader: {
    name: "Name",
    set: "Expansion",
    quantity: "Quantity",
    condition: "Condition",
    language: "Language",
    game: "Game",
    foil: "Foil",
    price: "Price",
  },
  tcgplayer: {
    name: "Product Name",
    set: "Set Name",
    quantity: "Quantity",
    condition: "Condition",
    language: "Language",
    game: "Game",
    foil: "Printing",
    price: "Purchase Price",
  },
};

export interface ParsedCsvRow {
  name: string;
  set?: string;
  quantity: number;
  condition: string;
  language: string;
  game: string;
  isFoil: boolean;
  purchasePrice?: number;
}

export function detectPreset(headers: string[]): CsvPreset {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("expansion") || h.includes("cardtrader")) return "cardtrader";
  if (h.includes("product name") || h.includes("tcgplayer")) return "tcgplayer";
  return "generic";
}

export function autoMapColumns(headers: string[]): CsvColumnMapping {
  const preset = detectPreset(headers);
  const presetMap = CSV_PRESETS[preset];
  const lower = Object.fromEntries(headers.map((h) => [h.toLowerCase(), h]));

  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      if (lower[c.toLowerCase()]) return lower[c.toLowerCase()];
    }
    return "";
  };

  return {
    name: presetMap.name || find("name", "product name", "card name") || headers[0] || "",
    set: presetMap.set || find("set", "expansion", "set name", "edition") || "",
    quantity: presetMap.quantity || find("quantity", "qty", "count") || "",
    condition: presetMap.condition || find("condition", "card condition") || "",
    language: presetMap.language || find("language", "lang") || "",
    game: presetMap.game || find("game", "tcg") || "",
    foil: presetMap.foil || find("foil", "printing", "finish") || "",
    price: presetMap.price || find("price", "purchase price", "cost") || "",
  };
}

export function parseCsvRows(
  data: Record<string, string>[],
  mapping: CsvColumnMapping
): ParsedCsvRow[] {
  return data
    .filter((row) => row[mapping.name]?.trim())
    .map((row) => ({
      name: row[mapping.name].trim(),
      set: mapping.set ? row[mapping.set]?.trim() : undefined,
      quantity: Math.max(1, parseInt(row[mapping.quantity] || "1") || 1),
      condition: (mapping.condition ? row[mapping.condition] : "NM")?.trim() || "NM",
      language: (mapping.language ? row[mapping.language] : "EN")?.trim() || "EN",
      game: (mapping.game ? row[mapping.game] : "yugioh")?.trim().toLowerCase() || "yugioh",
      isFoil: mapping.foil
        ? ["yes", "true", "foil", "holo", "holographic"].includes(
            (row[mapping.foil] || "").toLowerCase()
          )
        : false,
      purchasePrice: mapping.price ? parseFloat(row[mapping.price]) || undefined : undefined,
    }));
}

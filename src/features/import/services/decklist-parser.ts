import { parseYdke } from "@/features/import/services/ydke-codec";
import type {
  DecklistFormat,
  DecklistGameSlug,
  ParsedDeckEntry,
  ParsedDecklist,
} from "@/features/import/types";

const YGO_SECTIONS = new Set([
  "monster",
  "monsters",
  "spell",
  "spells",
  "trap",
  "traps",
  "extra",
  "extra deck",
  "side",
  "side deck",
  "main",
  "main deck",
]);

/** Digimon card id token: BT24-070, P-232, BT20-090_P1, BT20-077-Errata */
const DIGIMON_DECK_CARD_ID = /[A-Za-z][A-Za-z0-9]*-\d+(?:[-_][A-Za-z0-9]+)*/;

export const DIGIMON_CARD_ID_PATTERN = new RegExp(
  `^${DIGIMON_DECK_CARD_ID.source}$`,
  "i"
);

const DIGIMON_ID_TAIL = new RegExp(
  `(?:\\(|\\[)?\\s*(${DIGIMON_DECK_CARD_ID.source})\\s*(?:\\)|\\])?\\s*$`,
  "i"
);

function normalizeDigimonDeckLine(line: string): string {
  return line
    .trim()
    .replace(/\uFEFF/g, "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\uff08/g, "(")
    .replace(/\uff09/g, ")")
    .replace(/\u00a0/g, " ");
}

/** Parse one DigimonCard.io line — supports `4 Name BT24-011`, `2 Name (BT24-011)`, `[BT24-011]`, tabs. */
export function parseDigimonDeckLine(line: string): ParsedDeckEntry | null {
  let trimmed = normalizeDigimonDeckLine(line);
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    const uncommented = trimmed.replace(/^\/\/\s*/, "").trim();
    if (/^\d/.test(uncommented)) trimmed = uncommented;
    else return null;
  }

  if (/^(main|egg|side|tamer|option|digimon|digi-?egg)s?(\s+deck)?$/i.test(trimmed)) {
    return null;
  }

  const qtyMatch = trimmed.match(/^(\d+)\s*[x×]?\s+/i);
  if (!qtyMatch) return null;

  const quantity = parseInt(qtyMatch[1], 10);
  if (!Number.isFinite(quantity) || quantity < 1) return null;

  const rest = trimmed.slice(qtyMatch[0].length);
  const idMatch = rest.match(DIGIMON_ID_TAIL);
  if (!idMatch || idMatch.index == null) return null;

  const setCode = idMatch[1].trim().toUpperCase();
  let name = rest.slice(0, idMatch.index).trim();
  name = name.replace(/\s*[-–—]\s*$/, "").trim();
  if (!name) return null;

  return {
    quantity,
    name,
    setCode,
    passcode: null,
    section: null,
  };
}

export function isDigimonCardId(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && DIGIMON_CARD_ID_PATTERN.test(value.trim()));
}

/** DigimonCard.io, DigimonCard.io Deck List, legacy // DeckList headers */
const DIGIMONCARD_IO_HEADER =
  /^\/\/\s*(?:DigimonCard\.io|Digimon Card\.io|DeckList)/i;

const QUANTITY_NAME_LINE = /^(\d+)[x×]?\s+(.+?)\s*$/;

const ONEPIECE_LINE =
  /^(\d+)[x×]?\s+(.+?)(?:\s*\(([A-Za-z0-9]+-\d+[A-Za-z0-9_]*)\))?\s*$/;

const PASSCODE_LINE = /^\d{5,10}$/;

function sectionFromHeader(line: string): ParsedDeckEntry["section"] | null {
  const normalized = line.trim().toLowerCase();
  if (normalized.startsWith("extra")) return "extra";
  if (normalized.startsWith("side")) return "side";
  return "main";
}

function isSectionHeader(line: string): boolean {
  return YGO_SECTIONS.has(line.trim().toLowerCase());
}

/** Non-empty lines that should parse as card rows (excludes comments / section headers). */
export function countDecklistCandidateLines(content: string): number {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.startsWith("//")) return false;
      if (isSectionHeader(line)) return false;
      if (/^#created/i.test(line)) return false;
      if (/^#(main|extra|side)|^!(main|extra|side)/i.test(line)) return false;
      if (/^(main|egg|side|tamer|option|digimon|digi-?egg)s?(\s+deck)?$/i.test(line)) {
        return false;
      }
      return true;
    }).length;
}

function pushPasscodes(
  entries: ParsedDeckEntry[],
  passcodes: number[],
  section: ParsedDeckEntry["section"]
) {
  for (const passcode of passcodes) {
    if (!passcode) continue;
    entries.push({
      quantity: 1,
      name: String(passcode),
      setCode: null,
      passcode,
      section,
    });
  }
}

function parseYdk(content: string): ParsedDeckEntry[] {
  const entries: ParsedDeckEntry[] = [];
  let section: ParsedDeckEntry["section"] = "main";

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#created")) continue;

    if (line.startsWith("#main") || line.startsWith("!main")) {
      section = "main";
      continue;
    }
    if (line.startsWith("#extra") || line.startsWith("!extra")) {
      section = "extra";
      continue;
    }
    if (line.startsWith("#side") || line.startsWith("!side")) {
      section = "side";
      continue;
    }

    const passcode = parseInt(line.replace(/^0+/, "") || line, 10);
    if (!Number.isFinite(passcode) || !PASSCODE_LINE.test(line)) continue;

    entries.push({
      quantity: 1,
      name: line,
      setCode: null,
      passcode,
      section,
    });
  }

  return entries;
}

export function isDigimonDeckLine(line: string): boolean {
  return parseDigimonDeckLine(line) != null;
}

function parseDigimonText(content: string): ParsedDeckEntry[] {
  const entries: ParsedDeckEntry[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parseDigimonDeckLine(rawLine);
    if (parsed) entries.push(parsed);
  }

  return entries;
}

function countDigimonDeckSignals(lines: string[]): number {
  return lines.filter((line) => isDigimonDeckLine(line)).length;
}

function parseYugiohText(content: string): ParsedDeckEntry[] {
  const entries: ParsedDeckEntry[] = [];
  let section: ParsedDeckEntry["section"] = "main";

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;

    if (isSectionHeader(line)) {
      section = sectionFromHeader(line);
      continue;
    }

    const match = line.match(QUANTITY_NAME_LINE);
    if (!match) continue;

    entries.push({
      quantity: parseInt(match[1], 10),
      name: match[2].trim(),
      setCode: null,
      passcode: null,
      section,
    });
  }

  return entries;
}

function parseOnePieceText(content: string): ParsedDeckEntry[] {
  const entries: ParsedDeckEntry[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) continue;

    const parsed = parseDigimonDeckLine(rawLine);
    if (parsed) {
      entries.push(parsed);
      continue;
    }

    const match = line.match(ONEPIECE_LINE);
    if (!match) continue;

    entries.push({
      quantity: parseInt(match[1], 10),
      name: match[2].trim(),
      setCode: match[3]?.trim() ?? null,
      passcode: null,
      section: null,
    });
  }

  return entries;
}

function parseYdkeContent(content: string): ParsedDeckEntry[] {
  const deck = parseYdke(content.trim());
  if (!deck) return [];

  const entries: ParsedDeckEntry[] = [];
  pushPasscodes(entries, deck.main, "main");
  pushPasscodes(entries, deck.extra, "extra");
  pushPasscodes(entries, deck.side, "side");
  return entries;
}

function detectGameSlug(content: string, format: DecklistFormat): DecklistGameSlug {
  if (format === "ydke" || format === "ydk" || format === "yugioh-text") {
    return "yugioh";
  }

  const lower = content.toLowerCase();
  if (format === "digimon-text" || lower.includes("digimon")) {
    return "digimon";
  }

  return "unknown";
}

/** Prefer parsed game; fall back to card-id lines (BT24-011, P-189, EX11-008). */
export function inferDecklistGame(
  entries: ParsedDeckEntry[],
  parsed: ParsedDecklist
): DecklistGameSlug {
  if (parsed.gameSlug !== "unknown") return parsed.gameSlug;
  if (parsed.format === "digimon-text") return "digimon";

  const digimonLines = entries.filter((entry) => isDigimonCardId(entry.setCode)).length;
  if (digimonLines >= 2 || (digimonLines > 0 && digimonLines === entries.length)) {
    return "digimon";
  }

  return "unknown";
}

export function detectDecklistFormat(content: string): DecklistFormat {
  const trimmed = content.trim();
  if (!trimmed) return "unknown";
  if (/^ydke:\/\//i.test(trimmed)) return "ydke";
  if (/#main|!main/i.test(trimmed)) return "ydk";

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => DIGIMONCARD_IO_HEADER.test(line))) return "digimon-text";
  if (lines[0]?.startsWith("// DeckList")) return "digimon-text";

  const ygoSectionCount = lines.filter((line) => isSectionHeader(line)).length;
  if (ygoSectionCount >= 1) {
    return "yugioh-text";
  }

  const digimonSignals = countDigimonDeckSignals(lines);
  const digimonMatches = lines.filter((line) => isDigimonDeckLine(line)).length;
  if (digimonSignals >= 2 || digimonMatches >= 2) return "digimon-text";

  const qtyLines = lines.filter((line) => QUANTITY_NAME_LINE.test(line)).length;
  if (qtyLines >= 2) {
    return digimonSignals > 0 ? "digimon-text" : "yugioh-text";
  }

  return "unknown";
}

export function parseDecklist(
  content: string,
  preferredGame?: DecklistGameSlug
): ParsedDecklist {
  const detectedFormat = detectDecklistFormat(content);
  const format =
    preferredGame === "yugioh" && detectedFormat !== "ydke" && detectedFormat !== "ydk"
      ? "yugioh-text"
      : preferredGame === "digimon" && detectedFormat !== "ydke" && detectedFormat !== "ydk"
        ? "digimon-text"
        : detectedFormat;
  let entries: ParsedDeckEntry[] = [];

  switch (format) {
    case "ydke":
      entries = parseYdkeContent(content);
      break;
    case "ydk":
      entries = parseYdk(content);
      break;
    case "digimon-text":
      entries = parseDigimonText(content);
      break;
    case "yugioh-text": {
      const digimonEntries = parseDigimonText(content);
      entries =
        digimonEntries.length >= 2 ? digimonEntries : parseYugiohText(content);
      break;
    }
    default:
      entries = parseDigimonText(content);
      if (entries.length === 0) {
        entries = parseOnePieceText(content);
      }
      if (entries.length === 0) {
        entries = parseYugiohText(content);
      }
      break;
  }

  const gameSlug =
    preferredGame && preferredGame !== "unknown"
      ? preferredGame
      : detectGameSlug(content, format);

  return { format, gameSlug, entries };
}

export function aggregateDeckEntries(entries: ParsedDeckEntry[]): ParsedDeckEntry[] {
  const map = new Map<string, ParsedDeckEntry>();

  for (const entry of entries) {
    const key = [
      entry.passcode ?? "",
      entry.name.toLowerCase(),
      entry.setCode?.toLowerCase() ?? "",
      entry.section ?? "",
    ].join("|");

    const existing = map.get(key);
    if (existing) {
      existing.quantity += entry.quantity;
      continue;
    }
    map.set(key, { ...entry });
  }

  return Array.from(map.values());
}

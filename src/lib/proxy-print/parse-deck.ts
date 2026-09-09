import type { DeckEntry, ProxyGame } from "@/lib/proxy-print/types";
import { INLINE_IMAGE_URL, isInlineImageUrl } from "@/lib/proxy-print/preview-image";
import { PROXY_GAMES } from "@/lib/proxy-print/types";

const ONEPIECE_ID = /\b((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})\b/i;
const DIGIMON_CODE =
  /^(?:P-\d{3}|LM-\d{3}|[A-Z]{1,3}\d{1,2}-\d{2,3})(?:_P(\d+))?$/i;
const DIGIMON_ID_TAIL =
  /\b((?:P-\d{3}|LM-\d{3}|[A-Z]{1,3}\d{1,2}-\d{2,3})(?:_P\d+)?)\s*$/i;
const GAME_SECTION = /^#(yugioh|pokemon|digimon|onepiece|dragonball|dbs)\b/i;
const GAME_BRACKET = /^\[(yugioh|pokemon|digimon|onepiece|dragonball|dbs)\]\s*/i;
const GAME_PREFIX = /^(yugioh|pokemon|digimon|onepiece|dragonball|dbs):\s*/i;
const ART_HINT_TOKENS = new Set([
  "fa",
  "aa",
  "sp",
  "foil",
  "textured",
  "tex",
  "alt",
  "p1",
  "p2",
  "p3",
]);
const DIGIMON_SET_ID = /\b(?:BT|EX|LM|P|ST)\d{1,2}-\d{2,3}(?:_P\d+)?\b/i;
const YGO_PASSCODE = /^\d{8}$/;
const ONEPIECE_ID_INLINE = /\b(?:OP|ST|EB|PRB)\d{2}-\d{3}\b/i;
const DRAGONBALL_ID = /\b((?:FB|FS|SB|FP)\d{2}-\d{2,3})\b/i;

function normalizeGameAlias(raw: string): ProxyGame | null {
  const g = raw.toLowerCase();
  if (g === "dbs") return "dragonball";
  if (PROXY_GAMES.includes(g as ProxyGame)) return g as ProxyGame;
  return null;
}

function sniffLineGame(body: string, fallback: ProxyGame): ProxyGame {
  const trimmed = body.trim();
  if (YGO_PASSCODE.test(trimmed)) return "yugioh";
  if (ONEPIECE_ID_INLINE.test(trimmed)) return "onepiece";
  if (DRAGONBALL_ID.test(trimmed)) return "dragonball";
  if (DIGIMON_SET_ID.test(trimmed)) return "digimon";
  const tokens = trimmed.split(/\s+/);
  const last = tokens.at(-1)?.toUpperCase() ?? "";
  if (DRAGONBALL_ID.test(last)) return "dragonball";
  if (DIGIMON_CODE.test(last.replace(/[^A-Z0-9-]/g, ""))) return "digimon";
  return fallback;
}

function parseQtyBody(line: string): { qty: number; body: string } | null {
  const s = line.trim().replace(/\t/g, " ");
  if (!s) return null;
  const m1 = s.match(/^(\d+)\s*[xX×]\s*(.+)$/);
  if (m1) return { qty: parseInt(m1[1], 10), body: m1[2].trim() };
  const m2 = s.match(/^(\d+)\s+(.+)$/);
  if (m2) return { qty: parseInt(m2[1], 10), body: m2[2].trim() };
  return { qty: 1, body: s };
}

function extractCustomImage(body: string): { body: string; customImageUrl: string | null } {
  const pipe = body.match(new RegExp(`\\s*\\|\\s*(${INLINE_IMAGE_URL.source})\\s*$`, "i"));
  if (pipe) {
    return { body: body.slice(0, pipe.index).trim(), customImageUrl: pipe[1] };
  }
  const atUrl = body.match(new RegExp(`\\s+@\\s*(${INLINE_IMAGE_URL.source})\\s*$`, "i"));
  if (atUrl) {
    return { body: body.slice(0, atUrl.index).trim(), customImageUrl: atUrl[1] };
  }
  if (isInlineImageUrl(body.trim())) {
    return { body: "Custom image", customImageUrl: body.trim() };
  }
  return { body, customImageUrl: null };
}

function extractArtHint(body: string): { body: string; artHint: string | null } {
  let s = body.trim();
  const atEnd = s.match(/(?:@|v)(\d+)\s*$/i);
  if (atEnd) {
    return { body: s.slice(0, atEnd.index).trim(), artHint: atEnd[1] };
  }
  const tokens = s.split(/\s+/);
  const last = tokens.at(-1)?.toLowerCase() ?? "";
  if (ART_HINT_TOKENS.has(last)) {
    return { body: tokens.slice(0, -1).join(" "), artHint: last };
  }
  return { body: s, artHint: null };
}

function entryKeyForGame(game: ProxyGame, body: string): { key: string; artHint: string | null } {
  if (game === "onepiece") {
    const m = body.match(ONEPIECE_ID);
    if (m) return { key: m[1].toUpperCase().replace(/\s/g, ""), artHint: null };
  }
  if (game === "dragonball") {
    const m = body.match(DRAGONBALL_ID);
    if (m) return { key: m[1].toUpperCase(), artHint: null };
  }
  if (game === "digimon") {
    const tokens = body.split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const raw = tokens[i].trim().toUpperCase();
      const m = raw.match(DIGIMON_CODE);
      if (m) {
        if (m[1]) return { key: raw.replace(/_P\d+$/i, ""), artHint: m[1] };
        return { key: raw, artHint: null };
      }
    }
    const tail = body.match(DIGIMON_ID_TAIL);
    if (tail) return { key: tail[1].toUpperCase(), artHint: null };
  }
  return { key: body.trim(), artHint: null };
}

function parseLineGame(
  line: string,
  currentGame: ProxyGame
): { line: string; game: ProxyGame; isGameHeader: boolean } {
  const section = line.match(GAME_SECTION);
  if (section) {
    const g = normalizeGameAlias(section[1]);
    if (g) return { line: "", game: g, isGameHeader: true };
  }

  const bracket = line.match(GAME_BRACKET);
  if (bracket) {
    const g = normalizeGameAlias(bracket[1]);
    if (g) {
      return { line: line.slice(bracket[0].length).trim(), game: g, isGameHeader: false };
    }
  }

  const prefix = line.match(GAME_PREFIX);
  if (prefix) {
    const g = normalizeGameAlias(prefix[1]);
    if (g) {
      return { line: line.slice(prefix[0].length).trim(), game: g, isGameHeader: false };
    }
  }

  return { line, game: currentGame, isGameHeader: false };
}

export function hasMixedGameSections(text: string): boolean {
  const games = new Set<ProxyGame>();
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = raw.trim().match(GAME_SECTION);
    if (m) {
      const g = normalizeGameAlias(m[1]);
      if (g) games.add(g);
    }
  }
  return games.size > 1;
}

export function parseYdkText(text: string): Record<string, DeckEntry[]> {
  const zones: Record<string, DeckEntry[]> = { main: [], extra: [], side: [] };
  let section: string | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "#main") {
      section = "main";
      continue;
    }
    if (line === "#extra") {
      section = "extra";
      continue;
    }
    if (line === "!side" || line === "#side") {
      section = "side";
      continue;
    }
    if (line.startsWith("#") || line.startsWith("!")) continue;
    if (/^\d{1,8}$/.test(line) && section) {
      const key = String(parseInt(line, 10));
      zones[section].push({
        key,
        name: key,
        quantity: 1,
        query: line,
        game: "yugioh",
      });
    }
  }
  return zones;
}

export function parseTextDeckContent(text: string, defaultGame: ProxyGame): Record<string, DeckEntry[]> {
  const zones: Record<string, DeckEntry[]> = {};
  let section = "deck";
  let currentGame = defaultGame;

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim().replace(/\t/g, " ");
    if (!line || line.startsWith("//")) continue;
    if (/^.+:\s*\d+\s*$/.test(line) && !/^\d/.test(line)) continue;

    if (line.startsWith("#")) {
      const gameHeader = line.match(GAME_SECTION);
      if (gameHeader) {
        currentGame = normalizeGameAlias(gameHeader[1]) ?? currentGame;
        zones[section] ??= [];
        continue;
      }
      const tag = line.slice(1).trim().toLowerCase();
      if (["main", "extra", "side", "egg", "deck"].includes(tag)) section = tag;
      else section = tag || "deck";
      zones[section] ??= [];
      continue;
    }

    const { line: cardLine, game: parsedGame, isGameHeader } = parseLineGame(line, currentGame);
    if (isGameHeader) {
      currentGame = parsedGame;
      continue;
    }
    if (!cardLine) continue;

    const parsed = parseQtyBody(cardLine);
    if (!parsed || parsed.qty <= 0 || !parsed.body) continue;

    const { body: afterUrl, customImageUrl } = extractCustomImage(parsed.body);
    const { body, artHint: hintFromBody } = extractArtHint(afterUrl);
    const entryGame = sniffLineGame(body, parsedGame);
    const { key, artHint: codeArt } = entryKeyForGame(entryGame, body);
    const artHint = hintFromBody ?? codeArt;

    zones[section] ??= [];
    zones[section].push({
      key,
      name:
        customImageUrl && body === "Custom image"
          ? "Custom image"
          : entryGame === "yugioh" && /^\d+$/.test(key)
            ? key
            : body.trim(),
      quantity: parsed.qty,
      query: line,
      game: entryGame,
      artHint,
      customImageUrl,
    });
  }

  return Object.keys(zones).length ? zones : { deck: [] };
}

export function loadZonesFromText(text: string, defaultGame: ProxyGame): Record<string, DeckEntry[]> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return { deck: [] };

  if (defaultGame === "yugioh" || /#main\b/.test(normalized)) {
    const ydk = parseYdkText(normalized);
    if (Object.values(ydk).some((z) => z.length > 0)) return ydk;
  }
  return parseTextDeckContent(normalized, defaultGame);
}

export function flattenZones(zones: Record<string, DeckEntry[]>): DeckEntry[] {
  return Object.values(zones).flat();
}

export function uniqueEntriesPreserveOrder(entries: DeckEntry[]): DeckEntry[] {
  const seen = new Set<string>();
  const out: DeckEntry[] = [];
  for (const e of entries) {
    const rk = deckEntryResolveKey(e);
    if (!seen.has(rk)) {
      seen.add(rk);
      out.push(e);
    }
  }
  return out;
}

function deckEntryResolveKey(entry: DeckEntry): string {
  return [entry.game ?? "", entry.key, entry.artHint ?? "", entry.customImageUrl ?? ""].join("|");
}

export { deckEntryResolveKey };

export function uniqueKeysPreserveOrder(entries: DeckEntry[]): string[] {
  return uniqueEntriesPreserveOrder(entries).map((e) => e.key);
}

export function expandEntries(entries: DeckEntry[]): string[] {
  const ordered: string[] = [];
  for (const e of entries) {
    for (let i = 0; i < e.quantity; i++) ordered.push(e.key);
  }
  return ordered;
}

export function orderedSlotsFromZones(
  zones: Record<string, DeckEntry[]>
): { slotId: string; entryKey: string; resolveKey: string; entry: DeckEntry }[] {
  const preferred = ["main", "extra", "side", "deck", "egg"];
  const slots: { slotId: string; entryKey: string; resolveKey: string; entry: DeckEntry }[] = [];
  let index = 0;

  const pushZone = (entries: DeckEntry[]) => {
    for (const entry of entries) {
      for (let q = 0; q < entry.quantity; q++) {
        slots.push({
          slotId: `slot-${index++}`,
          entryKey: entry.key,
          resolveKey: deckEntryResolveKey(entry),
          entry,
        });
      }
    }
  };

  for (const name of preferred) {
    if (zones[name]) pushZone(zones[name]);
  }
  for (const name of Object.keys(zones).sort()) {
    if (!preferred.includes(name)) pushZone(zones[name]);
  }
  return slots;
}

export function orderedKeysFromZones(zones: Record<string, DeckEntry[]>): string[] {
  const preferred = ["main", "extra", "side", "deck", "egg"];
  const keys: string[] = [];
  for (const name of preferred) {
    if (zones[name]) keys.push(...expandEntries(zones[name]));
  }
  for (const name of Object.keys(zones).sort()) {
    if (!preferred.includes(name)) keys.push(...expandEntries(zones[name]));
  }
  return keys;
}

function normalizeDeckLineBody(line: string): string {
  return line
    .trim()
    .replace(new RegExp(`\\s*\\|\\s*${INLINE_IMAGE_URL.source}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+@\\s*${INLINE_IMAGE_URL.source}\\s*$`, "i"), "")
    .trim();
}

/** Replace or append a variant image URL on a matching deck list line. */
export function deckLineWithVariantImage(
  deckText: string,
  sourceQuery: string,
  imageUrl: string
): string {
  const targetBody = normalizeDeckLineBody(sourceQuery);
  if (!targetBody || !imageUrl) return deckText;

  const lines = deckText.replace(/\r\n/g, "\n").split("\n");
  let replaced = false;

  const next = lines.map((line) => {
    if (normalizeDeckLineBody(line) !== targetBody) return line;
    replaced = true;
    return `${normalizeDeckLineBody(line)} | ${imageUrl}`;
  });

  return replaced ? next.join("\n") : deckText;
}

/** Remove an inline `| image` / `@ image` suffix from a matching deck list line. */
export function deckLineClearVariantImage(deckText: string, sourceQuery: string): string {
  const targetBody = normalizeDeckLineBody(sourceQuery);
  if (!targetBody) return deckText;

  const lines = deckText.replace(/\r\n/g, "\n").split("\n");
  let replaced = false;

  const next = lines.map((line) => {
    if (normalizeDeckLineBody(line) !== targetBody) return line;
    const cleared = normalizeDeckLineBody(line);
    if (cleared === line.trim()) return line;
    replaced = true;
    return cleared;
  });

  return replaced ? next.join("\n") : deckText;
}

/** resolveKey with catalog/custom image suffix stripped (4th field empty). */
export function resolveKeyWithoutCustomImage(resolveKey: string): string {
  const parts = resolveKey.split("|");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", ""].join("|");
}

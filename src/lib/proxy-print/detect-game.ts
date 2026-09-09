import type { ProxyGame } from "@/lib/proxy-print/types";

const YGO_PASSCODE_LINE = /^\d{8}$/;
const YGO_SECTION = /^(?:#main|#extra|!side|#side)\b/i;
const PTCGL_SECTION =
  /^(?:Pok[eé]mon|Pokemon|Trainer|Treinador|Energy|Energia)\s*:\s*\d+\s*$/i;
const PTCGL_CARD_LINE = /^\d+\s+.+\s+[A-Z0-9]{2,6}\s+\d+\s*$/i;
const ONEPIECE_QTY_LINE = /^\d+\s*[xX×]\s*(?:OP|ST|EB|PRB)\d{2}-\d{3}\s*$/i;
const ONEPIECE_SET_ID = /((?:OP|ST|EB|PRB)\d{2}-\d{3})/i;
const DIGIMON_SET_ID = /\b(?:BT|EX|LM)\d{1,2}-\d{2,3}(?:_P\d+)?\b/i;
const DIGIMON_CODE_TOKEN =
  /^(?:P-\d{3}|LM-\d{3}|[A-Z]{1,3}\d{1,2}-\d{2,3})(?:_P(\d+))?$/i;
const DRAGONBALL_SET_ID = /\b(?:FB|FS|SB|FP)\d{2}-\d{2,3}\b/i;

function normalizePaste(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (PTCGL_SECTION.test(t)) return true;
  if (/^.+:\s*\d+\s*$/.test(t)) {
    const label = t.split(":", 1)[0].trim().toLowerCase();
    if (/(pok|mon|trainer|treinador|energy|energia)/.test(label)) return true;
    if (label.split(/\s+/).length <= 2) return true;
  }
  return false;
}

export function detectGameFromText(text: string): ProxyGame | null {
  const normalized = normalizePaste(text);
  if (!normalized.trim()) return null;

  if (YGO_SECTION.test(normalized) || /(^|\n)#main\b/.test(normalized)) {
    return "yugioh";
  }
  if (PTCGL_SECTION.test(normalized)) return "pokemon";

  const scores: Record<ProxyGame, number> = {
    yugioh: 0,
    pokemon: 0,
    digimon: 0,
    onepiece: 0,
    dragonball: 0,
  };
  let cardLines = 0;
  let genericNameLines = 0;

  for (const raw of normalized.split("\n")) {
    const line = raw.trim().replace(/\t/g, " ");
    if (!line || isHeaderLine(line)) continue;
    cardLines += 1;

    if (YGO_PASSCODE_LINE.test(line)) {
      scores.yugioh += 3;
      continue;
    }
    if (PTCGL_CARD_LINE.test(line)) {
      scores.pokemon += 4;
      continue;
    }
    if (ONEPIECE_QTY_LINE.test(line)) {
      scores.onepiece += 5;
      continue;
    }
    if (ONEPIECE_SET_ID.test(line)) {
      scores.onepiece += 4;
      continue;
    }
    if (DRAGONBALL_SET_ID.test(line)) {
      scores.dragonball += 5;
      continue;
    }
    if (DIGIMON_SET_ID.test(line)) {
      scores.digimon += 4;
      continue;
    }

    const tokens = line.split(/\s+/);
    const last = tokens.at(-1)?.toUpperCase() ?? "";
    if (DRAGONBALL_SET_ID.test(last)) {
      scores.dragonball += 4;
      continue;
    }
    if (DIGIMON_CODE_TOKEN.test(last) && !ONEPIECE_SET_ID.test(last) && !DRAGONBALL_SET_ID.test(last)) {
      scores.digimon += 3;
      continue;
    }
    if (/\bP-\d{3}\b/i.test(line)) {
      scores.digimon += 1;
      scores.onepiece += 1;
      continue;
    }
    if (
      /^\d+\s+[A-Za-z]/.test(line) &&
      !DIGIMON_SET_ID.test(line) &&
      !ONEPIECE_SET_ID.test(line) &&
      !DRAGONBALL_SET_ID.test(line)
    ) {
      genericNameLines += 1;
      continue;
    }
  }

  if (
    genericNameLines >= 3 &&
    scores.digimon === 0 &&
    scores.onepiece === 0 &&
    scores.dragonball === 0
  ) {
    scores.yugioh += genericNameLines;
  }

  if (cardLines === 0) return null;

  const ygoIds = normalized
    .split("\n")
    .filter((l) => YGO_PASSCODE_LINE.test(l.trim())).length;
  if (ygoIds >= 3 && ygoIds >= cardLines * 0.5) return "yugioh";

  const best = (Object.keys(scores) as ProxyGame[]).reduce((a, b) =>
    scores[a] >= scores[b] ? a : b
  );
  if (scores[best] >= 2) return best;
  if (
    scores.pokemon >= cardLines &&
    scores.digimon === 0 &&
    scores.onepiece === 0 &&
    scores.dragonball === 0
  ) {
    return "pokemon";
  }
  return null;
}

export function detectGameFromFilename(name: string): ProxyGame | null {
  if (name.toLowerCase().endsWith(".ydk")) return "yugioh";
  return null;
}

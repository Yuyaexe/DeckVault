export interface RarityStyle {
  code: string;
  label: string;
  backgroundColor: string;
  color: string;
}

/** Cardmarket-style Yu-Gi-Oh! rarity colors (inline styles — always render correctly) */
const CODE_COLORS: Record<string, { backgroundColor: string; color: string }> = {
  SCR: { backgroundColor: "#7c3aed", color: "#ffffff" },
  UR: { backgroundColor: "#eab308", color: "#422006" },
  SR: { backgroundColor: "#f97316", color: "#ffffff" },
  R: { backgroundColor: "#737373", color: "#ffffff" },
  C: { backgroundColor: "#d4d4d4", color: "#404040" },
  QSCR: { backgroundColor: "#0ea5e9", color: "#ffffff" },
  PMSCR: { backgroundColor: "#9333ea", color: "#ffffff" },
  PLSCR: { backgroundColor: "#c4b5fd", color: "#2e1065" },
  GHR: { backgroundColor: "#0a0a0a", color: "#ffffff" },
  SLR: { backgroundColor: "#0a0a0a", color: "#ffffff" },
  PHRU: { backgroundColor: "#0a0a0a", color: "#ffffff" },
  PHRS: { backgroundColor: "#0a0a0a", color: "#ffffff" },
  GSCR: { backgroundColor: "#92400e", color: "#fef3c7" },
  GHGR: { backgroundColor: "#78350f", color: "#fde68a" },
  GR: { backgroundColor: "#a16207", color: "#ffffff" },
  PGR: { backgroundColor: "#a16207", color: "#ffffff" },
  PLR: { backgroundColor: "#94a3b8", color: "#ffffff" },
  CR: { backgroundColor: "#14b8a6", color: "#ffffff" },
  PCR: { backgroundColor: "#22d3ee", color: "#083344" },
  UMR: { backgroundColor: "#06b6d4", color: "#ffffff" },
  PMUR: { backgroundColor: "#0891b2", color: "#ffffff" },
  PUR: { backgroundColor: "#eab308", color: "#422006" },
  PSR: { backgroundColor: "#f97316", color: "#ffffff" },
  PC: { backgroundColor: "#e5e5e5", color: "#525252" },
  DTSCR: { backgroundColor: "#6d28d9", color: "#ffffff" },
  DTUR: { backgroundColor: "#ca8a04", color: "#422006" },
  DTSR: { backgroundColor: "#ea580c", color: "#ffffff" },
  DTR: { backgroundColor: "#737373", color: "#ffffff" },
  "10K": { backgroundColor: "#b91c1c", color: "#ffffff" },
  EXSCR: { backgroundColor: "#dc2626", color: "#ffffff" },
  GMR: { backgroundColor: "#991b1b", color: "#ffffff" },
  SFR: { backgroundColor: "#881337", color: "#fce7f3" },
  MSR: { backgroundColor: "#57534e", color: "#ffffff" },
  SHR: { backgroundColor: "#78716c", color: "#ffffff" },
  DSUR: { backgroundColor: "#eab308", color: "#422006" },
  UC: { backgroundColor: "#84cc16", color: "#ffffff" },
  SEC: { backgroundColor: "#ca8a04", color: "#422006" },
  P: { backgroundColor: "#6366f1", color: "#ffffff" },
  SP: { backgroundColor: "#64748b", color: "#ffffff" },
};

function withCode(code: string, label: string): RarityStyle {
  const palette = CODE_COLORS[code] ?? { backgroundColor: "#525252", color: "#ffffff" };
  return { code, label, ...palette };
}

function resolveYugiohRarity(rarity: string): RarityStyle {
  const n = rarity.toLowerCase();
  const label = rarity;

  if (n.includes("quarter century secret")) return withCode("QSCR", label);
  if (n.includes("prismatic secret")) return withCode("PMSCR", label);
  if (n.includes("platinum secret")) return withCode("PLSCR", label);
  if (n.includes("ghost") || n.includes("ghr")) return withCode("GHR", label);
  if (n.includes("starlight")) return withCode("SLR", label);
  if (n.includes("pharaoh")) return withCode("PHRU", label);
  if (n.includes("gold secret")) return withCode("GSCR", label);
  if (n.includes("ghost gold")) return withCode("GHGR", label);
  if (n.includes("gold rare") || (n.includes("gold") && n.includes("rare"))) return withCode("GR", label);
  if (n.includes("platinum")) return withCode("PLR", label);
  if (n.includes("prismatic collector")) return withCode("PCR", label);
  if (n.includes("collector")) return withCode("CR", label);
  if (n.includes("ultimate")) return withCode("UMR", label);
  if (n.includes("premium") && n.includes("ultra")) return withCode("PMUR", label);
  if (n.includes("parallel") && n.includes("ultra")) return withCode("PUR", label);
  if (n.includes("parallel") && n.includes("super")) return withCode("PSR", label);
  if (n.includes("parallel") && n.includes("common")) return withCode("PC", label);
  if (n.includes("duel terminal") || n.startsWith("dt")) {
    if (n.includes("secret")) return withCode("DTSCR", label);
    if (n.includes("ultra")) return withCode("DTUR", label);
    if (n.includes("super")) return withCode("DTSR", label);
    return withCode("DTR", label);
  }
  if (n.includes("10000") || n.includes("10k")) return withCode("10K", label);
  if (n.includes("extr") && n.includes("secret")) return withCode("EXSCR", label);
  if (n.includes("gimmick")) return withCode("GMR", label);
  if (n.includes("shatterfoil")) return withCode("SFR", label);
  if (n.includes("mosaic")) return withCode("MSR", label);
  if (n.includes("short print")) return withCode("SHR", label);
  if (n.includes("secret")) return withCode("SCR", label);
  if (n.includes("ultra")) return withCode("UR", label);
  if (n.includes("super")) return withCode("SR", label);
  if (n.includes("rare")) return withCode("R", label);
  if (n.includes("common")) return withCode("C", label);

  const code = rarity
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
  return withCode(code || "?", label);
}

const DIGIMON_KNOWN_CODES = new Set(["C", "U", "UC", "R", "SR", "SEC", "P", "SP", "PR"]);

function resolveDigimonRarity(rarity: string): RarityStyle {
  const upper = rarity.trim().toUpperCase();
  if (DIGIMON_KNOWN_CODES.has(upper)) {
    return withCode(upper, rarity);
  }

  const n = rarity.toLowerCase();
  const label = rarity;

  if (n.includes("secret")) return withCode("SEC", label);
  if (n.includes("super")) return withCode("SR", label);
  if (n.includes("uncommon")) return withCode("UC", label);
  if (n.includes("rare")) return withCode("R", label);
  if (n.includes("common")) return withCode("C", label);
  if (n.includes("promo")) return withCode("P", label);

  return withCode(abbreviate(rarity, 4), label);
}

function isDigimonRarityName(rarity: string): boolean {
  const upper = rarity.trim().toUpperCase();
  if (DIGIMON_KNOWN_CODES.has(upper)) return true;
  const n = rarity.toLowerCase();
  return (
    n.includes("rare") ||
    n.includes("common") ||
    n.includes("uncommon") ||
    n.includes("promo") ||
    n.includes("secret") ||
    n.includes("super")
  );
}

function resolveGenericRarity(rarity: string): RarityStyle {
  const n = rarity.toLowerCase();
  const label = rarity;

  if (n.includes("secret") || n.includes("hyper") || n.includes("illustration")) {
    return withCode(abbreviate(rarity, 4), label);
  }
  if (n.includes("ultra") || n.includes("holo")) {
    return withCode("UR", label);
  }
  if (n.includes("super")) {
    return withCode("SR", label);
  }
  if (n.includes("rare") || n.includes("uncommon")) {
    return withCode("R", label);
  }
  if (n.includes("common") || n.includes("promo")) {
    return withCode("C", label);
  }

  return withCode(abbreviate(rarity, 4), label);
}

function abbreviate(text: string, maxLen: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join("")
      .slice(0, maxLen)
      .toUpperCase();
  }
  return text.slice(0, maxLen).toUpperCase();
}

function isYugiohRarityName(rarity: string): boolean {
  const n = rarity.toLowerCase();
  return (
    n.includes("rare") ||
    n.includes("common") ||
    n.includes("secret") ||
    n.includes("ultra") ||
    n.includes("super") ||
    n.includes("collector") ||
    n.includes("prismatic") ||
    n.includes("quarter century")
  );
}

const YGO_CARD_TYPE_HINT =
  /\b(monster|spell|trap|skill|token|equip|continuous|quick-play|counter|field|ritual|fusion|synchro|xyz|xys|link|pendulum|flip|tuner|union|gemini|spirit|toon)\b/i;

export const NIL_RARITY_STYLE: RarityStyle = {
  code: "NIL",
  label: "No rarity",
  backgroundColor: "#64748b",
  color: "#f8fafc",
};

export function isKnownRarity(
  rarity: string | null | undefined,
  gameSlug?: string
): boolean {
  if (!rarity?.trim()) return false;
  const trimmed = rarity.trim();
  if (/^\d+$/.test(trimmed)) return false;

  if (gameSlug === "yugioh") {
    if (isYugiohRarityName(trimmed)) return true;
    if (YGO_CARD_TYPE_HINT.test(trimmed)) return false;
    if (trimmed.length <= 6 && /^[A-Z0-9]+$/i.test(trimmed)) return true;
    return false;
  }

  if (gameSlug === "digimon") {
    if (isDigimonRarityName(trimmed)) return true;
    if (trimmed.length <= 6 && /^[A-Za-z0-9]+$/.test(trimmed)) return true;
    return false;
  }

  const n = trimmed.toLowerCase();
  if (
    n.includes("rare") ||
    n.includes("common") ||
    n.includes("uncommon") ||
    n.includes("promo") ||
    n.includes("holo") ||
    n.includes("secret") ||
    n.includes("ultra")
  ) {
    return true;
  }
  if (trimmed.length <= 6 && /^[A-Za-z0-9]+$/.test(trimmed)) return true;
  return false;
}

export function resolveRarityStyle(
  rarity: string | null | undefined,
  gameSlug?: string
): RarityStyle {
  if (!isKnownRarity(rarity, gameSlug)) return NIL_RARITY_STYLE;
  const trimmed = rarity!.trim();

  if (gameSlug === "yugioh" || isYugiohRarityName(trimmed)) {
    return resolveYugiohRarity(trimmed);
  }

  if (gameSlug === "digimon" || isDigimonRarityName(trimmed)) {
    return resolveDigimonRarity(trimmed);
  }

  return resolveGenericRarity(trimmed);
}

/** Resolve colors directly from badge code (e.g. stored abbreviations) */
export function resolveRarityStyleByCode(code: string, label?: string): RarityStyle {
  return withCode(code.toUpperCase(), label ?? code);
}

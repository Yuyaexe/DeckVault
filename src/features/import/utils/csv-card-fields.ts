import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  CONDITION_LABELS,
  type CardCondition,
  type CardLanguage,
} from "@/types/tcg";

const CONDITION_ALIASES: Record<string, CardCondition> = {
  nm: "NM",
  "near mint": "NM",
  "near-mint": "NM",
  lp: "LP",
  "lightly played": "LP",
  "light play": "LP",
  "light played": "LP",
  mp: "MP",
  "moderately played": "MP",
  "moderate play": "MP",
  hp: "HP",
  "heavily played": "HP",
  "heavy play": "HP",
  dmg: "DMG",
  damaged: "DMG",
  damage: "DMG",
};

const LANGUAGE_ALIASES: Record<string, CardLanguage> = {
  en: "EN",
  english: "EN",
  jp: "JP",
  ja: "JP",
  japanese: "JP",
  pt: "PT",
  "pt-br": "PT",
  portuguese: "PT",
  "português": "PT",
  "portugues": "PT",
  de: "DE",
  german: "DE",
  deutsch: "DE",
  fr: "FR",
  french: "FR",
  français: "FR",
  es: "ES",
  spanish: "ES",
  español: "ES",
  it: "IT",
  italian: "IT",
  ko: "KO",
  korean: "KO",
  zh: "ZH",
  chinese: "ZH",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map CSV/export labels (e.g. "Near Mint", "English") to DeckVault codes. */
export function normalizeCardCondition(raw: string | undefined | null): CardCondition {
  if (!raw?.trim()) return "NM";
  const trimmed = raw.trim();
  if (CARD_CONDITIONS.includes(trimmed as CardCondition)) {
    return trimmed as CardCondition;
  }
  const key = normalizeKey(trimmed);
  if (CONDITION_ALIASES[key]) return CONDITION_ALIASES[key];
  const fromLabel = (Object.entries(CONDITION_LABELS) as [CardCondition, string][]).find(
    ([, label]) => normalizeKey(label) === key
  );
  return fromLabel?.[0] ?? "NM";
}

/** Map CSV/export language labels to DeckVault codes. */
export function normalizeCardLanguage(raw: string | undefined | null): CardLanguage {
  if (!raw?.trim()) return "EN";
  const trimmed = raw.trim();
  if (CARD_LANGUAGES.includes(trimmed as CardLanguage)) {
    return trimmed as CardLanguage;
  }
  const key = normalizeKey(trimmed);
  return LANGUAGE_ALIASES[key] ?? "EN";
}

import type { AppLocale } from "@/lib/i18n/types";
import type {
  YugiohCardTypeKey,
  YugiohSearchCategory,
  YugiohSearchField,
} from "@/lib/yugioh/advanced-search.constants";
import {
  YGO_ATTRIBUTES,
  YGO_CARD_TYPE_KEYS,
  YGO_CARD_TYPE_LABELS,
  YGO_CATEGORY_TABS,
  YGO_LINK_MARKERS,
  YGO_LINK_VALUES,
  YGO_LEVELS,
  YGO_MONSTER_RACES,
  YGO_SEARCH_FIELD_OPTIONS,
  YGO_SPELL_TRAP_RACES,
} from "@/lib/yugioh/advanced-search.constants";

const ATTRIBUTE_EN: Record<string, string> = {
  DARK: "Dark",
  LIGHT: "Light",
  EARTH: "Earth",
  WATER: "Water",
  FIRE: "Fire",
  WIND: "Wind",
  DIVINE: "Divine",
};

const SPELL_TRAP_EN: Record<string, string> = {
  Equip: "Equip",
  Field: "Field",
  "Quick-Play": "Quick-Play",
  Ritual: "Ritual",
  Continuous: "Continuous",
  Counter: "Counter",
  Normal: "Normal",
};

const MONSTER_RACE_EN: Record<string, string> = {
  Spellcaster: "Spellcaster",
  Dragon: "Dragon",
  Zombie: "Zombie",
  Warrior: "Warrior",
  Beast: "Beast",
  "Beast-Warrior": "Beast-Warrior",
  "Winged Beast": "Winged Beast",
  Fiend: "Fiend",
  Fairy: "Fairy",
  Insect: "Insect",
  Dinosaur: "Dinosaur",
  Reptile: "Reptile",
  Fish: "Fish",
  "Sea Serpent": "Sea Serpent",
  Aqua: "Aqua",
  Pyro: "Pyro",
  Thunder: "Thunder",
  Rock: "Rock",
  Plant: "Plant",
  Machine: "Machine",
  Psychic: "Psychic",
  Wyrm: "Wyrm",
  Cyberse: "Cyberse",
  Illusion: "Illusion",
  "Divine-Beast": "Divine-Beast",
};

const CARD_TYPE_EN: Record<YugiohCardTypeKey, string> = {
  normal: "Normal",
  effect: "Effect",
  ritual: "Ritual",
  fusion: "Fusion",
  synchro: "Synchro",
  xyz: "Xyz",
  toon: "Toon",
  spirit: "Spirit",
  union: "Union",
  gemini: "Gemini",
  tuner: "Tuner",
  flip: "Flip",
  pendulum: "Pendulum",
  link: "Link",
};

const CATEGORY_EN: Record<YugiohSearchCategory, string> = {
  all: "All",
  monster: "Monsters",
  spell: "Spells",
  trap: "Traps",
};

const SEARCH_FIELD_EN: Record<YugiohSearchField, string> = {
  name: "Card name",
  exact: "Exact name",
  archetype: "Archetype",
};

function labelFor<T extends { value: string; label: string }>(
  items: T[],
  locale: AppLocale,
  enMap: Record<string, string>
) {
  if (locale === "pt-BR") return items;
  return items.map((item) => ({
    ...item,
    label: enMap[item.value] ?? item.label,
  }));
}

export function getLocalizedYgoSearchFieldOptions(locale: AppLocale) {
  return YGO_SEARCH_FIELD_OPTIONS.map((o) => ({
    ...o,
    label: locale === "pt-BR" ? o.label : SEARCH_FIELD_EN[o.value],
  }));
}

export function getLocalizedYgoCategoryTabs(locale: AppLocale) {
  return YGO_CATEGORY_TABS.map((o) => ({
    ...o,
    label: locale === "pt-BR" ? o.label : CATEGORY_EN[o.value],
  }));
}

export function getLocalizedYgoAttributes(locale: AppLocale) {
  return labelFor(YGO_ATTRIBUTES, locale, ATTRIBUTE_EN);
}

export function getLocalizedYgoSpellTrapRaces(locale: AppLocale) {
  return labelFor(YGO_SPELL_TRAP_RACES, locale, SPELL_TRAP_EN);
}

export function getLocalizedYgoMonsterRaces(locale: AppLocale) {
  return labelFor(YGO_MONSTER_RACES, locale, MONSTER_RACE_EN);
}

export function getLocalizedYgoCardTypeLabel(locale: AppLocale, key: YugiohCardTypeKey) {
  return locale === "pt-BR" ? YGO_CARD_TYPE_LABELS[key] : CARD_TYPE_EN[key];
}

export function getLocalizedYgoCardTypeKeys(locale: AppLocale) {
  return YGO_CARD_TYPE_KEYS.map((key) => ({
    key,
    label: getLocalizedYgoCardTypeLabel(locale, key),
  }));
}

export const YGO_LEVELS_LIST = YGO_LEVELS;
export const YGO_LINK_VALUES_LIST = YGO_LINK_VALUES;
export const YGO_LINK_MARKERS_LIST = YGO_LINK_MARKERS;

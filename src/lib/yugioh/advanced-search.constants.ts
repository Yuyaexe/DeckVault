/** Filter option labels (PT) and YGOPRODeck API values */

export type YugiohSearchCategory = "all" | "monster" | "spell" | "trap";
export type YugiohSearchField = "name" | "exact" | "archetype";
export type YugiohFilterLogic = "and" | "or";

export const YGO_SEARCH_FIELD_OPTIONS: { value: YugiohSearchField; label: string }[] = [
  { value: "name", label: "Nome do card" },
  { value: "exact", label: "Nome exato" },
  { value: "archetype", label: "Arquetipo" },
];

export const YGO_CATEGORY_TABS: { value: YugiohSearchCategory; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "monster", label: "Monstros" },
  { value: "spell", label: "Magias" },
  { value: "trap", label: "Armadilhas" },
];

export const YGO_ATTRIBUTES: { value: string; label: string }[] = [
  { value: "DARK", label: "Trevas" },
  { value: "LIGHT", label: "Luz" },
  { value: "EARTH", label: "Terra" },
  { value: "WATER", label: "Água" },
  { value: "FIRE", label: "Fogo" },
  { value: "WIND", label: "Vento" },
  { value: "DIVINE", label: "Divino" },
];

export const YGO_SPELL_TRAP_RACES: { value: string; label: string }[] = [
  { value: "Equip", label: "Equipamento" },
  { value: "Field", label: "Campo" },
  { value: "Quick-Play", label: "Rápida" },
  { value: "Ritual", label: "Ritual" },
  { value: "Continuous", label: "Contínua" },
  { value: "Counter", label: "Marcador" },
  { value: "Normal", label: "Normal" },
];

export const YGO_MONSTER_RACES: { value: string; label: string }[] = [
  { value: "Spellcaster", label: "Mago" },
  { value: "Dragon", label: "Dragão" },
  { value: "Zombie", label: "Zumbi" },
  { value: "Warrior", label: "Guerreiro" },
  { value: "Beast", label: "Besta" },
  { value: "Beast-Warrior", label: "Besta-Guerreira" },
  { value: "Winged Beast", label: "Besta Alada" },
  { value: "Fiend", label: "Demônio" },
  { value: "Fairy", label: "Fada" },
  { value: "Insect", label: "Inseto" },
  { value: "Dinosaur", label: "Dinossauro" },
  { value: "Reptile", label: "Réptil" },
  { value: "Fish", label: "Peixe" },
  { value: "Sea Serpent", label: "Serpente Marinha" },
  { value: "Aqua", label: "Aqua" },
  { value: "Pyro", label: "Piro" },
  { value: "Thunder", label: "Trovão" },
  { value: "Rock", label: "Rocha" },
  { value: "Plant", label: "Planta" },
  { value: "Machine", label: "Máquina" },
  { value: "Psychic", label: "Psíquico" },
  { value: "Wyrm", label: "Wyrm" },
  { value: "Cyberse", label: "Ciberso" },
  { value: "Illusion", label: "Ilusão" },
  { value: "Divine-Beast", label: "Besta Divina" },
];

export const YGO_CARD_TYPE_KEYS = [
  "normal",
  "effect",
  "ritual",
  "fusion",
  "synchro",
  "xyz",
  "toon",
  "spirit",
  "union",
  "gemini",
  "tuner",
  "flip",
  "pendulum",
  "link",
] as const;

export type YugiohCardTypeKey = (typeof YGO_CARD_TYPE_KEYS)[number];

export const YGO_CARD_TYPE_LABELS: Record<YugiohCardTypeKey, string> = {
  normal: "Normal",
  effect: "Efeito",
  ritual: "Ritual",
  fusion: "Fusão",
  synchro: "Sincro",
  xyz: "Xyz",
  toon: "Toon",
  spirit: "Espírito",
  union: "União",
  gemini: "Gêmeos",
  tuner: "Regulador",
  flip: "Virar",
  pendulum: "Pêndulo",
  link: "Link",
};

export const YGO_LEVELS = Array.from({ length: 14 }, (_, i) => i);
export const YGO_LINK_VALUES = [1, 2, 3, 4, 5, 6] as const;

export const YGO_LINK_MARKERS: { value: string; label: string; grid?: string }[] = [
  { value: "Top-Left", label: "↖", grid: "1 / 1" },
  { value: "Top", label: "↑", grid: "1 / 2" },
  { value: "Top-Right", label: "↗", grid: "1 / 3" },
  { value: "Left", label: "←", grid: "2 / 1" },
  { value: "Right", label: "→", grid: "2 / 3" },
  { value: "Bottom-Left", label: "↙", grid: "3 / 1" },
  { value: "Bottom", label: "↓", grid: "3 / 2" },
  { value: "Bottom-Right", label: "↘", grid: "3 / 3" },
];

export function matchesYgoCardTypeKey(type: string, key: YugiohCardTypeKey): boolean {
  const t = type.toLowerCase();
  switch (key) {
    case "normal":
      return t.includes("normal") && !t.includes("effect") && t.includes("monster");
    case "effect":
      return t.includes("effect");
    case "ritual":
      return t.includes("ritual");
    case "fusion":
      return t.includes("fusion");
    case "synchro":
      return t.includes("synchro");
    case "xyz":
      return t.includes("xyz");
    case "toon":
      return t.includes("toon");
    case "spirit":
      return t.includes("spirit");
    case "union":
      return t.includes("union");
    case "gemini":
      return t.includes("gemini");
    case "tuner":
      return t.includes("tuner");
    case "flip":
      return t.includes("flip");
    case "pendulum":
      return t.includes("pendulum");
    case "link":
      return t.includes("link");
    default:
      return false;
  }
}

export function matchesYgoCategory(type: string, category: YugiohSearchCategory): boolean {
  if (category === "all") return true;
  const t = type.toLowerCase();
  if (category === "monster") return t.includes("monster");
  if (category === "spell") return t.includes("spell card");
  if (category === "trap") return t.includes("trap card");
  return true;
}

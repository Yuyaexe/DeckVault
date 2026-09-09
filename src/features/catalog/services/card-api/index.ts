import type { CardApiAdapter } from "./types";
import { yugiohAdapter } from "./yugioh.adapter";
import { pokemonAdapter } from "./pokemon.adapter";
import { digimonAdapter } from "./digimon.adapter";

const adapters: Record<string, CardApiAdapter> = {
  yugioh: yugiohAdapter,
  pokemon: pokemonAdapter,
  digimon: digimonAdapter,
};

const SUPPORTED_GAMES = ["yugioh", "pokemon", "digimon"] as const;

export function getCardAdapter(gameSlug: string): CardApiAdapter | null {
  return adapters[gameSlug] ?? null;
}

export function isApiSupported(gameSlug: string): boolean {
  return SUPPORTED_GAMES.includes(gameSlug as (typeof SUPPORTED_GAMES)[number]);
}

export function isQuickAddSupported(gameSlug: string): boolean {
  return isApiSupported(gameSlug);
}

import { DEMO_GAMES } from "@/lib/demo/types";
import { isQuickAddSupported } from "@/features/catalog/services/card-api";

/** Games available in Quick Add (free APIs + CardTrader catalog). */
export const QUICK_ADD_GAMES = DEMO_GAMES.filter((g) => isQuickAddSupported(g.slug));

export type QuickAddGameSlug = (typeof QUICK_ADD_GAMES)[number]["slug"];

export function getQuickAddGame(slug: string) {
  return QUICK_ADD_GAMES.find((g) => g.slug === slug) ?? QUICK_ADD_GAMES[0];
}

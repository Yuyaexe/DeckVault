import type { DemoState } from "./types";
import { repairDemoCard } from "./repair-card";
import { stripSeededAnime } from "./store-helpers";

export function migrateDemoState(persisted: unknown, version: number): DemoState {

        let state = persisted as DemoState;
        if (version < 2 && state.ownedCards) {
          state = {
            ...state,
            ownedCards: state.ownedCards.map((oc) => ({
              ...oc,
              card: repairDemoCard(oc.card),
            })),
          };
        }
        if (version < 3) {
          state = {
            ...state,
            animeSeries: state.animeSeries ?? [],
            animeCharacters: state.animeCharacters ?? [],
          };
        }
        if (version < 4) {
          state = {
            ...state,
            animeCharacterCards: state.animeCharacterCards ?? [],
          };
        }
        if (version < 5) {
          state = {
            ...state,
            animeCharacterCards: (state.animeCharacterCards ?? []).map((entry) => ({
              ...entry,
              condition: entry.condition ?? "NM",
              language: entry.language ?? "EN",
              isFoil: entry.isFoil ?? false,
            })),
          };
        }
        if (version < 6) {
          const byCharacter = new Map<string, number>();
          state = {
            ...state,
            animeCharacterCards: (state.animeCharacterCards ?? []).map((entry) => {
              const order = byCharacter.get(entry.characterId) ?? 0;
              byCharacter.set(entry.characterId, order + 1);
              return { ...entry, sortOrder: entry.sortOrder ?? order };
            }),
          };
        }
        if (version < 9) {
          state = stripSeededAnime(state);
        }
        if (version < 10) {
          state = {
            ...state,
            animeBinderLayoutByCharacter: state.animeBinderLayoutByCharacter ?? {},
          };
        }
        if (version < 11) {
          state = {
            ...state,
            activityEvents: state.activityEvents ?? [],
          };
        }
        if (version < 12) {
          state = {
            ...state,
            animeCardTombstones: state.animeCardTombstones ?? [],
          };
        }
        if (version < 13) {
          state = {
            ...state,
            animeCharacterTombstones: state.animeCharacterTombstones ?? [],
          };
        }
        if (version < 14) {
          state = {
            ...state,
            animeSeriesTombstones: state.animeSeriesTombstones ?? [],
          };
        }
        return state;

}

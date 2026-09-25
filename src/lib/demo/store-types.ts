import type { StoreApi } from "zustand";
import type { AnimeCharacter, AnimeSeries } from "@/features/anime-collection/types";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import type { DeckVaultBackup } from "@/features/import/services/backup-export";
import type { CardCondition, CardLanguage } from "@/types/tcg";
import type {
  AnimeCharacterCard,
  DemoCard,
  DemoCollection,
  DemoOwnedCard,
  DemoState,
} from "./types";

export interface DemoStore extends DemoState {
  activeCollectionId: string;
  setActiveCollection: (id: string) => void;
  pruneActivityHistory: () => number;
  undoActivityEvent: (eventId: string) => { ok: true } | { error: string; status: number };
  addCardFromSearch: (
    result: CardSearchResult,
    gameId: string,
    gameSlug: string,
    gameName: string,
    collectionId?: string
  ) => void;
  updateOwnedCard: (
    id: string,
    updates: Partial<Omit<DemoOwnedCard, "card">> & { card?: Partial<DemoCard> }
  ) => void;
  deleteOwnedCards: (ids: string[]) => void;
  importRows: (
    rows: Array<{
      name: string;
      set?: string;
      quantity: number;
      condition: CardCondition;
      language: CardLanguage;
      gameId: string;
      gameSlug: string;
      gameName: string;
      isFoil?: boolean;
      purchasePrice?: number;
    }>,
    mergeDuplicates: boolean
  ) => number;
  importFromSearchResults: (
    items: Array<{
      result: CardSearchResult;
      quantity: number;
      gameId: string;
      gameSlug: string;
      gameName: string;
    }>,
    mergeDuplicates: boolean
  ) => number;
  /** Undo accidental qty doubling (qty → floor(qty/2), min 1). */
  halveOwnedCardQuantities: (collectionId: string) => number;
  setOwnedCardQuantitiesToOne: (collectionId: string) => number;
  updateProfile: (updates: Partial<DemoState["profile"]>) => void;
  /** Record Activity rows for peer anime share diffs (add/remove). */
  recordAnimeShareRemoteDiff: (
    beforeCards: AnimeCharacterCard[],
    afterCards: AnimeCharacterCard[],
    actor: { displayName: string; userId?: string | null },
    characterNames?: Array<{ id: string; name: string }>
  ) => { added: number; removed: number };
  addCollection: (name: string) => DemoCollection;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  toggleCollectionFavorite: (id: string) => void;
  restoreFromBackup: (backup: DeckVaultBackup) => void;
  /** Anime Collection is persisted locally in IndexedDB. */
  restoreAnimeCollectionFromBackup: (
    backup: Pick<
      DeckVaultBackup,
      "animeSeries" | "animeCharacters" | "animeCharacterCards"
    >
  ) => void;
  addAnimeSeries: (input: {
    name: string;
    coverImageUrl?: string | null;
    coverColor?: string | null;
  }) => AnimeSeries;
  renameAnimeSeries: (id: string, name: string) => void;
  updateAnimeSeriesCover: (id: string, coverImageUrl: string | null) => void;
  deleteAnimeSeries: (id: string) => void;
  addAnimeCharacter: (input: {
    seriesId: string;
    name: string;
    imageUrl?: string | null;
    accentColor?: string | null;
  }) => AnimeCharacter;
  addAnimeCharactersBatch: (input: {
    seriesId: string;
    names: string[];
  }) => AnimeCharacter[];
  renameAnimeCharacter: (id: string, name: string) => void;
  updateAnimeCharacterImage: (id: string, imageUrl: string | null) => void;
  deleteAnimeCharacter: (id: string) => void;
  addAnimeCharacterCardFromSearch: (
    characterId: string,
    result: CardSearchResult,
    gameId: string,
    gameSlug: string,
    gameName: string,
    quantity?: number
  ) => void;
  removeAnimeCharacterCard: (id: string) => void;
  updateAnimeCharacterCardQuantity: (id: string, quantity: number) => void;
  setAnimeCharacterCardsQuantityToOne: (characterId: string) => number;
  sortAnimeCharacterCards: (
    characterId: string,
    field: "name" | "quantity" | "set" | "rarity" | "deck",
    dir: "asc" | "desc"
  ) => void;
  updateAnimeCharacterCardSetName: (id: string, setName: string | null) => void;
  updateAnimeCharacterCard: (
    id: string,
    updates: Partial<Omit<AnimeCharacterCard, "card">> & { card?: Partial<DemoCard> }
  ) => void;
  patchAnimeCharacterCardTypes: (updates: Array<{ id: string; type: string }>) => void;
  reorderAnimeCharacterCard: (
    characterId: string,
    draggedId: string,
    targetId: string | null
  ) => void;
  reorderAnimeCharacterCardToIndex: (
    characterId: string,
    draggedId: string,
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardToBinderSlot: (
    characterId: string,
    draggedId: string,
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardsToBinderSlot: (
    characterId: string,
    cardIds: string[],
    targetIndex: number
  ) => void;
  moveAnimeCharacterCardsToBinderSpread: (
    characterId: string,
    cardIds: string[],
    targetSpreadIndex: number,
    spreadSize: number
  ) => void;
  transferAnimeCharacterCards: (
    fromCharacterId: string,
    toCharacterId: string,
    cardIds: string[]
  ) => { moved: number; merged: number };
}

export type StoreSet = StoreApi<DemoStore>["setState"];
export type StoreGet = StoreApi<DemoStore>["getState"];

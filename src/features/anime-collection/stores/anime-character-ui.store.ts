import { create } from "zustand";
import {
  selectListRow,
  toggleListSelection,
} from "@/lib/collections/list-selection";

interface AnimeCharacterUIState {
  selectedIds: Set<string>;
  lastSelectedIndex: number;
  /** Card ids being dragged (batch when selection includes the dragged card). */
  draggedCardIds: string[];

  toggleSelect: (
    id: string,
    shiftKey?: boolean,
    allIds?: string[],
    rowIndex?: number
  ) => void;
  selectRow: (
    id: string,
    modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
    allIds?: string[],
    rowIndex?: number
  ) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setDraggedCardIds: (ids: string[]) => void;
}

export const useAnimeCharacterUIStore = create<AnimeCharacterUIState>((set, get) => ({
  selectedIds: new Set(),
  lastSelectedIndex: 0,
  draggedCardIds: [],

  toggleSelect: (id, shiftKey, allIds, rowIndex) => {
    const { selectedIds, lastSelectedIndex } = get();
    const next = toggleListSelection(
      selectedIds,
      lastSelectedIndex,
      id,
      shiftKey,
      allIds,
      rowIndex
    );
    set(next);
  },

  selectRow: (id, modifiers, allIds, rowIndex) => {
    const { selectedIds, lastSelectedIndex } = get();
    const next = selectListRow(
      selectedIds,
      lastSelectedIndex,
      id,
      modifiers,
      allIds,
      rowIndex
    );
    set(next);
  },

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set(), lastSelectedIndex: 0 }),
  setDraggedCardIds: (ids) => set({ draggedCardIds: ids }),
}));

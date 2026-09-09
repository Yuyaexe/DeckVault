/** Pure helpers for list multi-select (Ctrl/Shift range). */

export function toggleListSelection(
  selectedIds: Set<string>,
  lastSelectedIndex: number,
  id: string,
  shiftKey: boolean | undefined,
  allIds: string[] | undefined,
  rowIndex: number | undefined
): { selectedIds: Set<string>; lastSelectedIndex: number } {
  const next = new Set(selectedIds);
  const idx = rowIndex ?? allIds?.indexOf(id) ?? lastSelectedIndex;

  if (shiftKey && allIds) {
    const start = Math.min(lastSelectedIndex, idx);
    const end = Math.max(lastSelectedIndex, idx);
    for (let i = start; i <= end; i++) {
      const rowId = allIds[i];
      if (rowId) next.add(rowId);
    }
  } else if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return { selectedIds: next, lastSelectedIndex: idx };
}

export function selectListRow(
  selectedIds: Set<string>,
  lastSelectedIndex: number,
  id: string,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } | undefined,
  allIds: string[] | undefined,
  rowIndex: number | undefined
): { selectedIds: Set<string>; lastSelectedIndex: number } {
  const { shiftKey = false, ctrlKey = false, metaKey = false } = modifiers ?? {};
  const idx = rowIndex ?? allIds?.indexOf(id) ?? lastSelectedIndex;
  const multiKey = ctrlKey || metaKey;

  if (shiftKey && allIds) {
    const next = new Set(selectedIds);
    const start = Math.min(lastSelectedIndex, idx);
    const end = Math.max(lastSelectedIndex, idx);
    for (let i = start; i <= end; i++) {
      const rowId = allIds[i];
      if (rowId) next.add(rowId);
    }
    return { selectedIds: next, lastSelectedIndex: idx };
  }

  if (multiKey) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedIds: next, lastSelectedIndex: idx };
  }

  if (selectedIds.has(id)) {
    const next = new Set(selectedIds);
    next.delete(id);
    return { selectedIds: next, lastSelectedIndex: idx };
  }

  return { selectedIds: new Set([id]), lastSelectedIndex: idx };
}

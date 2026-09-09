/** Reorder an id list by moving draggedId before targetId (or to end if target is null). */
export function reorderIds(
  order: string[],
  draggedId: string,
  targetId: string | null
): string[] {
  const filtered = order.filter((id) => id !== draggedId);
  if (!targetId) return [...filtered, draggedId];
  const targetIndex = filtered.indexOf(targetId);
  if (targetIndex === -1) return [...filtered, draggedId];
  const next = [...filtered];
  next.splice(targetIndex, 0, draggedId);
  return next;
}

/** Move draggedId to a specific index in the list. */
export function reorderIdsToIndex(
  order: string[],
  draggedId: string,
  targetIndex: number
): string[] {
  const filtered = order.filter((id) => id !== draggedId);
  const index = Math.max(0, Math.min(targetIndex, filtered.length));
  const next = [...filtered];
  next.splice(index, 0, draggedId);
  return next;
}

/** Merge persisted order with current ids (append new, drop removed). */
export function mergeIdOrder(saved: string[], currentIds: string[]): string[] {
  const currentSet = new Set(currentIds);
  const ordered = saved.filter((id) => currentSet.has(id));
  for (const id of currentIds) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

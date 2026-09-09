import type { DemoCollection } from "@/lib/demo/types";

export function sortCollectionsByOrder(
  collections: DemoCollection[],
  customOrder: string[]
): DemoCollection[] {
  const orderMap = new Map(customOrder.map((id, index) => [id, index]));

  return [...collections].sort((a, b) => {
    const aOrder = orderMap.get(a.id);
    const bOrder = orderMap.get(b.id);

    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;

    const aFav = a.isFavorite ?? false;
    const bFav = b.isFavorite ?? false;
    if (aFav !== bFav) return aFav ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function reorderCollectionIds(
  order: string[],
  draggedId: string,
  targetId: string
): string[] {
  const filtered = order.filter((id) => id !== draggedId);
  const targetIndex = filtered.indexOf(targetId);
  if (targetIndex === -1) return [...filtered, draggedId];
  const next = [...filtered];
  next.splice(targetIndex, 0, draggedId);
  return next;
}

export function mergeCollectionOrder(
  collections: DemoCollection[],
  savedOrder: string[]
): string[] {
  const ids = collections.map((c) => c.id);
  const merged = savedOrder.filter((id) => ids.includes(id));
  for (const id of ids) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

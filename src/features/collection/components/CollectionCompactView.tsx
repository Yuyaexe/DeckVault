"use client";

import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CollectionCompactCard } from "@/features/collection/components/CollectionCompactCard";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useDragReorder } from "@/hooks/useDragReorder";
import { useCollectionView } from "@/features/collection/context/collection-view-context";

const COMPACT_ROW_HEIGHT = 108;

export function CollectionCompactView() {
  const data = useCollectionView();
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedIds = useCollectionUIStore((s) => s.selectedIds);
  const toggleSelect = useCollectionUIStore((s) => s.toggleSelect);
  const openCardInspect = useCollectionUIStore((s) => s.openCardInspect);
  const dragHandlers = useDragReorder(data.reorderCard);

  const virtualizer = useVirtualizer({
    count: data.filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COMPACT_ROW_HEIGHT,
    overscan: 6,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [data.filtered.length, virtualizer]);

  const { handleQuantityChange, handleRemove } = data;

  const onQuantityChange = useCallback(
    (id: string, quantity: number) => handleQuantityChange(id, quantity),
    [handleQuantityChange]
  );

  const onRemove = useCallback(
    (id: string) => handleRemove(id),
    [handleRemove]
  );

  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative w-full p-3 md:p-4"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {rows.map((virtualRow) => {
          const item = data.filtered[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 w-full px-3 md:px-4"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <CollectionCompactCard
                item={item}
                selected={selectedIds.has(item.id)}
                dragHandlers={dragHandlers}
                onSelect={() =>
                  toggleSelect(item.id, false, data.allIds, virtualRow.index)
                }
                onOpen={() => openCardInspect(item.id, "details")}
                onQuantityChange={(qty) => onQuantityChange(item.id, qty)}
                onRemove={() => onRemove(item.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

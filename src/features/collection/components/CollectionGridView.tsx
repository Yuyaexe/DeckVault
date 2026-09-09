"use client";

import { memo, useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CollectionGridCardItem } from "@/features/collection/components/CollectionGridCardItem";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useDragReorder } from "@/hooks/useDragReorder";
import { useGridColumns } from "@/hooks/useGridColumns";
import { useCollectionView } from "@/features/collection/context/collection-view-context";

/** Image (~204px @ 140w) + metadata + quantity stepper + padding */
const CARD_ROW_HEIGHT = 342;

export function CollectionGridView() {
  const data = useCollectionView();
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedIds = useCollectionUIStore((s) => s.selectedIds);
  const toggleSelect = useCollectionUIStore((s) => s.toggleSelect);
  const openCardInspect = useCollectionUIStore((s) => s.openCardInspect);
  const dragHandlers = useDragReorder(data.reorderCard);
  const columns = useGridColumns();
  const rowCount = Math.ceil(data.filtered.length / columns);

  const { handleQuantityChange, handleRemove } = data;

  const onQuantityChange = useCallback(
    (id: string, quantity: number) => handleQuantityChange(id, quantity),
    [handleQuantityChange]
  );

  const onRemove = useCallback(
    (id: string) => handleRemove(id),
    [handleRemove]
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_ROW_HEIGHT,
    overscan: 2,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [data.filtered.length, columns, virtualizer]);

  const rows = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative w-full p-3 md:p-4"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {rows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = data.filtered.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full gap-3 px-3 md:px-4"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((item, colIndex) => {
                const index = startIndex + colIndex;
                return (
                  <MemoGridCardItem
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    dragHandlers={dragHandlers}
                    onSelect={() => toggleSelect(item.id, false, data.allIds, index)}
                    onOpen={() => openCardInspect(item.id, "details")}
                    onQuantityChange={(qty) => onQuantityChange(item.id, qty)}
                    onRemove={() => onRemove(item.id)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MemoGridCardItem = memo(CollectionGridCardItem);

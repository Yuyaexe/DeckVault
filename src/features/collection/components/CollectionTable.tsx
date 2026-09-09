"use client";

import { useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/context";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { CollectionRow } from "@/components/shared/CollectionRow";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useDragReorder, dragHandleProps } from "@/hooks/useDragReorder";
import { useCollectionView } from "@/features/collection/context/collection-view-context";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;

export function CollectionTable() {
  const t = useT();
  const data = useCollectionView();
  const parentRef = useRef<HTMLDivElement>(null);

  const selectedIds = useCollectionUIStore((s) => s.selectedIds);
  const toggleSelect = useCollectionUIStore((s) => s.toggleSelect);
  const selectRow = useCollectionUIStore((s) => s.selectRow);
  const selectAll = useCollectionUIStore((s) => s.selectAll);
  const openCardInspect = useCollectionUIStore((s) => s.openCardInspect);
  const focusedRowIndex = useCollectionUIStore((s) => s.focusedRowIndex);
  const setFocusedRowIndex = useCollectionUIStore((s) => s.setFocusedRowIndex);

  const { filtered, allIds, openCardTraderLink, handleQuantityChange, handleRemove, reorderCard } =
    data;

  const dragHandlers = useDragReorder(reorderCard);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [filtered.length, virtualizer]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedRowIndex(Math.min(focusedRowIndex + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedRowIndex(Math.max(focusedRowIndex - 1, 0));
      }
      if (e.key === "Enter" && filtered[focusedRowIndex]) {
        openCardInspect(filtered[focusedRowIndex].id, "details");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, focusedRowIndex, openCardInspect, setFocusedRowIndex]);

  const headerChecked =
    selectedIds.size === filtered.length && filtered.length > 0
      ? true
      : selectedIds.size > 0
        ? "indeterminate"
        : false;

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 hidden items-center gap-3 border-b border-border bg-card px-4 py-2.5 text-xs font-medium text-muted-foreground shadow-sm md:flex">
        <div className="flex shrink-0 items-center p-1">
          <Checkbox
            checked={
              headerChecked === "indeterminate"
                ? "indeterminate"
                : headerChecked
            }
            onCheckedChange={(c) =>
              c ? selectAll(allIds) : useCollectionUIStore.getState().clearSelection()
            }
            aria-label={t("collection.table.selectAll")}
          />
        </div>
        <span className="w-7 shrink-0" aria-hidden />
        <span className="flex-[2]">{t("collection.table.name")}</span>
        <span className="hidden w-12 xl:block">{t("collection.table.number")}</span>
        <span className="w-[104px] shrink-0 text-center">{t("collection.table.qty")}</span>
        <span className="hidden w-12 text-center md:block">{t("collection.table.condition")}</span>
        <span className="hidden w-10 text-center sm:block">{t("collection.table.language")}</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = filtered[virtualRow.index];
            return (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <div
                    {...dragHandleProps(dragHandlers, item.id)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      dragHandlers.isDragOver(item.id) && "ring-2 ring-inset ring-primary/40"
                    )}
                  >
                    <CollectionRow
                      item={item}
                      selected={selectedIds.has(item.id)}
                      focused={focusedRowIndex === virtualRow.index}
                      onClick={(row, modifiers) =>
                        selectRow(row.id, modifiers, allIds, virtualRow.index)
                      }
                      onNameClick={(row) => openCardInspect(row.id, "details")}
                      onMiddleClick={(row) => openCardTraderLink(row)}
                      onCheckboxChange={(id, shift) =>
                        toggleSelect(id, shift, allIds, virtualRow.index)
                      }
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                    />
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => openCardInspect(item.id, "details")}>
                    {t("collection.table.viewCard")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openCardInspect(item.id, "marketplace")}>
                    {t("collection.table.marketplace")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openCardTraderLink(item)}>
                    {t("collection.table.openMarketTab")}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive"
                    onClick={() => handleRemove(item.id)}
                  >
                    {t("common.delete")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
}

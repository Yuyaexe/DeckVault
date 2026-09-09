"use client";

import { LayoutGrid, LayoutList, Rows3, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCollectionUIStore,
  type CollectionViewMode,
} from "@/features/collection/stores/collection-ui.store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

const MODES: { id: CollectionViewMode; labelKey: MessageKey; icon: typeof LayoutList }[] = [
  { id: "table", labelKey: "collection.viewList", icon: LayoutList },
  { id: "grid", labelKey: "collection.viewGrid", icon: LayoutGrid },
  { id: "compact", labelKey: "collection.viewCards", icon: Rows3 },
  { id: "binder", labelKey: "collection.viewBinder", icon: BookOpen },
];

export function CollectionViewSwitcher({ className }: { className?: string }) {
  const t = useT();
  const viewMode = useCollectionUIStore((s) => s.viewMode);
  const setViewMode = useCollectionUIStore((s) => s.setViewMode);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const visibleModes = isMobile ? MODES.filter((m) => m.id !== "binder") : MODES;

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-0.5",
        className
      )}
      role="group"
      aria-label={t("collection.viewMode")}
    >
      {visibleModes.map(({ id, labelKey, icon: Icon }) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs",
            viewMode === id && "bg-background shadow-sm"
          )}
          onClick={() => setViewMode(id)}
          aria-pressed={viewMode === id}
          title={t(labelKey)}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </Button>
      ))}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoading } from "@/components/shared/PageLoading";
import { useCollectionView } from "@/features/collection/context/collection-view-context";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useT } from "@/lib/i18n/context";

const CollectionTable = dynamic(
  () =>
    import("@/features/collection/components/CollectionTable").then(
      (m) => m.CollectionTable
    ),
  { ssr: false }
);

const CollectionGridView = dynamic(
  () =>
    import("@/features/collection/components/CollectionGridView").then(
      (m) => m.CollectionGridView
    ),
  { ssr: false }
);

const CollectionCompactView = dynamic(
  () =>
    import("@/features/collection/components/CollectionCompactView").then(
      (m) => m.CollectionCompactView
    ),
  { ssr: false }
);

const CollectionBinderView = dynamic(
  () =>
    import("@/features/collection/components/CollectionBinderView").then(
      (m) => m.CollectionBinderView
    ),
  { ssr: false }
);

export function CollectionContent() {
  const t = useT();
  const queryClient = useQueryClient();
  const data = useCollectionView();
  const viewMode = useCollectionUIStore((s) => s.viewMode);
  const filters = useCollectionUIStore((s) => s.filters);
  const setQuickAddOpen = useCollectionUIStore((s) => s.setQuickAddOpen);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const effectiveView =
    isMobile && (viewMode === "table" || viewMode === "binder") ? "compact" : viewMode;

  if (data.isLoading) {
    return <PageLoading label={t("collection.loadingCards")} className="h-full" />;
  }

  if (data.isError) {
    return (
      <EmptyState
        icon={Layers}
        title={t("collection.errorTitle")}
        description={t("collection.errorDescription")}
        actionLabel={t("common.retry")}
        onAction={() => void queryClient.invalidateQueries({ queryKey: ["app-state"] })}
      />
    );
  }

  if (data.filtered.length === 0) {
    const hasActiveFilters =
      data.collectionCards.length > 0 &&
      (filters.search ||
        filters.gameId ||
        filters.setCode ||
        filters.rarity ||
        filters.language ||
        filters.condition ||
        filters.isFoil !== null ||
        filters.minQuantity !== null);

    if (hasActiveFilters) {
      return (
        <EmptyState
          icon={Layers}
          title={t("collection.emptyFiltersTitle")}
          description={t("collection.emptyFiltersDescription")}
          actionLabel={t("collection.resetFilters")}
          onAction={() => useCollectionUIStore.getState().resetFilters()}
        />
      );
    }

    return (
      <EmptyState
        icon={Layers}
        title={t("collection.emptyTitle")}
        description={t("collection.emptyDescription")}
        actionLabel={t("collection.quickAdd")}
        onAction={() => setQuickAddOpen(true)}
      />
    );
  }

  switch (effectiveView) {
    case "grid":
      return <CollectionGridView />;
    case "compact":
      return <CollectionCompactView />;
    case "binder":
      return <CollectionBinderView />;
    default:
      return <CollectionTable />;
  }
}

"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { CollectionTopBar } from "@/features/collection/components/CollectionTopBar";
import { CollectionFilters } from "@/features/collection/components/CollectionFilters";
import { CollectionContent } from "@/features/collection/components/CollectionContent";
import { BulkActionsBar } from "@/features/collection/components/BulkActionsBar";
import { CollectionViewProvider } from "@/features/collection/context/collection-view-context";
import {
  YugiohPasscodeProvider,
  YugiohPasscodeSync,
} from "@/features/collection/context/yugioh-passcode-context";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useAppData } from "@/hooks/useAppData";
import { PageLoading } from "@/components/shared/PageLoading";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

const QuickAddModal = dynamic(
  () =>
    import("@/features/collection/components/QuickAddModal").then((m) => m.QuickAddModal),
  { ssr: false }
);

const CardInspectDialog = dynamic(
  () => import("@/components/shared/CardInspectDialog").then((m) => m.CardInspectDialog),
  { ssr: false }
);

function CollectionPageBody() {
  const t = useT();
  const inspectCardId = useCollectionUIStore((s) => s.detailCardId);
  const inspectTab = useCollectionUIStore((s) => s.inspectTab);
  const closeCardInspect = useCollectionUIStore((s) => s.closeCardInspect);
  const pendingDeleteCardId = useCollectionUIStore((s) => s.pendingDeleteCardId);
  const clearPendingDeleteCard = useCollectionUIStore((s) => s.clearPendingDeleteCard);
  const quickAddOpen = useCollectionUIStore((s) => s.quickAddOpen);
  const setQuickAddOpen = useCollectionUIStore((s) => s.setQuickAddOpen);

  const { profile, ownedCards, deleteOwnedCards } = useAppData();

  const inspectCard = inspectCardId
    ? (ownedCards.find((oc) => oc.id === inspectCardId) ?? null)
    : null;

  const pendingDeleteCard = pendingDeleteCardId
    ? (ownedCards.find((oc) => oc.id === pendingDeleteCardId) ?? null)
    : null;

  const confirmDeleteCard = async () => {
    if (!pendingDeleteCardId) return;
    await deleteOwnedCards([pendingDeleteCardId]);
    toast.success(t("collection.cardRemoved"));
    if (inspectCardId === pendingDeleteCardId) closeCardInspect();
    clearPendingDeleteCard();
  };

  return (
    <div className="flex h-full flex-col">
      <CollectionTopBar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card/30 lg:block">
          <CollectionFilters />
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden">
          <CollectionContent />
        </div>
      </div>
      <BulkActionsBar />
      {quickAddOpen && (
        <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      )}
      {inspectCardId && inspectCard && (
        <CardInspectDialog
          card={inspectCard}
          open
          tab={inspectTab}
          onOpenChange={(open) => !open && closeCardInspect()}
          currency={profile.currency}
        />
      )}
      <Modal
        open={pendingDeleteCardId != null && pendingDeleteCard != null}
        onOpenChange={(open) => {
          if (!open) clearPendingDeleteCard();
        }}
        title={t("collection.deleteCardTitle")}
        description={t("collection.deleteCardDescription", {
          name: pendingDeleteCard?.card.name ?? "",
        })}
        footer={
          <>
            <Button variant="outline" onClick={clearPendingDeleteCard}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteCard()}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <span className="sr-only">{t("collection.deleteCardTitle")}</span>
      </Modal>
    </div>
  );
}

export default function CollectionPage() {
  const t = useT();
  const { ownedCards, activeCollectionId, isLoading } = useAppData();

  const collectionCards = useMemo(
    () => ownedCards.filter((oc) => oc.collectionId === activeCollectionId),
    [ownedCards, activeCollectionId]
  );

  if (isLoading || !activeCollectionId) {
    return <PageLoading label={t("collection.loading")} />;
  }

  return (
    <YugiohPasscodeProvider cards={collectionCards}>
      <YugiohPasscodeSync cards={collectionCards}>
        <CollectionViewProvider>
          <CollectionPageBody />
        </CollectionViewProvider>
      </YugiohPasscodeSync>
    </YugiohPasscodeProvider>
  );
}

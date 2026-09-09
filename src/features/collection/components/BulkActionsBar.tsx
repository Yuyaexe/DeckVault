"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/Modal";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

export function BulkActionsBar() {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selectedIds = useCollectionUIStore((s) => s.selectedIds);
  const clearSelection = useCollectionUIStore((s) => s.clearSelection);
  const { ownedCards, deleteOwnedCards } = useAppData();

  const totalCards = ownedCards.reduce((sum, oc) => {
    if (!selectedIds.has(oc.id)) return sum;
    return sum + oc.quantity;
  }, 0);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const count = selectedIds.size;
      await deleteOwnedCards([...selectedIds]);
      toast.success(t("collection.bulkDeleted", { count }));
      clearSelection();
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collection.bulkDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCards={totalCards}
        onClear={clearSelection}
      >
        <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" />
          {t("common.delete")}
        </Button>
      </BulkActionBar>

      <Modal
        open={confirmOpen}
        onOpenChange={(open) => !deleting && setConfirmOpen(open)}
        title={t("collection.bulkDeleteTitle")}
        description={t("collection.bulkDeleteDescription", {
          entries: selectedIds.size,
          cards: totalCards,
        })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? t("collection.bulkDeleting") : t("common.delete")}
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { BookOpen, Trash2, Users } from "lucide-react";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { MoveCardsToCharacterModal } from "@/features/anime-collection/components/MoveCardsToCharacterModal";
import { useAnimeCharacterUIStore } from "@/features/anime-collection/stores/anime-character-ui.store";
import type { AnimeCharacter } from "@/features/anime-collection/types";
import {
  countEmptySlotsInSpread,
  mergeBinderLayout,
  removeIdsFromBinderLayout,
} from "@/lib/collections/binder-layout";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AnimeCharacterBulkActionsBarProps {
  characterId: string;
  characterName: string;
  seriesSlug: string;
  seriesName: string;
  seriesCharacters: AnimeCharacter[];
  totalSpreads: number;
  spreadSize: number;
  /** Current sparse binder layout (card ids + null pockets). */
  binderSlotLayout: (string | null)[];
  /** Ordered card ids for this character (sortOrder). */
  cardIds: string[];
  cardQuantitiesById: Map<string, number>;
  onMoveToSpread: (cardIds: string[], spreadIndex: number) => void;
  onTransferToCharacter: (
    cardIds: string[],
    targetCharacterId: string
  ) => { moved: number; merged: number };
  onDelete: (cardIds: string[]) => void;
}

export function AnimeCharacterBulkActionsBar({
  characterId,
  characterName,
  seriesSlug,
  seriesName,
  seriesCharacters,
  totalSpreads,
  spreadSize,
  binderSlotLayout,
  cardIds,
  cardQuantitiesById,
  onMoveToSpread,
  onTransferToCharacter,
  onDelete,
}: AnimeCharacterBulkActionsBarProps) {
  const t = useT();
  const selectedIds = useAnimeCharacterUIStore((s) => s.selectedIds);
  const clearSelection = useAnimeCharacterUIStore((s) => s.clearSelection);

  const [spreadOpen, setSpreadOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const totalCards = useMemo(() => {
    let sum = 0;
    for (const id of selectedList) {
      sum += cardQuantitiesById.get(id) ?? 1;
    }
    return sum;
  }, [cardQuantitiesById, selectedList]);

  /** Free slots per spread after selected cards leave their current pockets. */
  const freeSlotsBySpread = useMemo(() => {
    const layout = mergeBinderLayout(
      binderSlotLayout.length ? binderSlotLayout : cardIds,
      cardIds
    );
    const withoutSelected = removeIdsFromBinderLayout(layout, selectedList);
    return Array.from({ length: Math.max(1, totalSpreads) }, (_, i) =>
      countEmptySlotsInSpread(withoutSelected, i, spreadSize)
    );
  }, [binderSlotLayout, cardIds, selectedList, spreadSize, totalSpreads]);

  const handleMoveToSpread = (spreadIndex: number) => {
    const free = freeSlotsBySpread[spreadIndex] ?? 0;
    if (free < selectedList.length) return;

    onMoveToSpread(selectedList, spreadIndex);
    toast.success(
      t("anime.cardsMoved", {
        count: selectedList.length,
        name: t("anime.spreadOption", { n: spreadIndex + 1 }),
      })
    );
    clearSelection();
    setSpreadOpen(false);
  };

  const handleTransfer = (targetId: string) => {
    const target = seriesCharacters.find((c) => c.id === targetId);
    const result = onTransferToCharacter(selectedList, targetId);
    if (result.moved > 0 && result.merged > 0) {
      toast.success(
        t("anime.cardsMovedMerged", {
          moved: result.moved,
          merged: result.merged,
          name: target?.name ?? characterName,
        })
      );
    } else if (result.merged > 0) {
      toast.success(t("anime.cardsMerged", { count: result.merged }));
    } else {
      toast.success(
        t("anime.cardsMoved", {
          count: result.moved,
          name: target?.name ?? "",
        })
      );
    }
    clearSelection();
  };

  const handleDelete = () => {
    const count = selectedList.length;
    onDelete(selectedList);
    toast.success(t("anime.bulkDeleted", { count }));
    clearSelection();
    setDeleteOpen(false);
  };

  return (
    <>
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCards={totalCards}
        onClear={clearSelection}
      >
        <Button
          size="sm"
          variant="outline"
          disabled={totalSpreads < 1}
          onClick={() => setSpreadOpen(true)}
        >
          <BookOpen className="mr-1.5 h-3.5 w-3.5" />
          {t("anime.bulkMoveToSpread")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={seriesCharacters.length <= 1}
          onClick={() => setCharacterOpen(true)}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          {t("anime.bulkMoveToCharacter")}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </Button>
      </BulkActionBar>

      <Modal
        open={spreadOpen}
        onOpenChange={setSpreadOpen}
        title={t("anime.moveToSpreadTitle")}
        description={t("anime.moveToSpreadDescription")}
        footer={
          <Button variant="outline" onClick={() => setSpreadOpen(false)}>
            {t("common.cancel")}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
          {Array.from({ length: Math.max(1, totalSpreads) }, (_, i) => {
            const free = freeSlotsBySpread[i] ?? 0;
            const canFit = free >= selectedList.length;
            return (
              <Button
                key={i}
                type="button"
                variant="outline"
                disabled={!canFit}
                title={
                  canFit
                    ? undefined
                    : t("anime.spreadFull", { free, needed: selectedList.length })
                }
                className={cn(!canFit && "opacity-50")}
                onClick={() => handleMoveToSpread(i)}
              >
                {t("anime.spreadOption", { n: i + 1 })}
                {!canFit && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t("anime.spreadFullBadge")})
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </Modal>

      <MoveCardsToCharacterModal
        open={characterOpen}
        onOpenChange={setCharacterOpen}
        characters={seriesCharacters}
        seriesSlug={seriesSlug}
        seriesName={seriesName}
        excludeCharacterId={characterId}
        selectedCount={selectedIds.size}
        onConfirm={handleTransfer}
      />

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("anime.bulkDeleteTitle")}
        description={t("anime.bulkDeleteDescription", { count: selectedIds.size })}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <span className="sr-only">{t("anime.bulkDeleteTitle")}</span>
      </Modal>
    </>
  );
}

"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CollectionGridCard } from "@/components/shared/CollectionGridCard";
import { CreateCollectionCard } from "@/components/shared/CreateCollectionCard";
import { Modal } from "@/components/shared/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppData } from "@/hooks/useAppData";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDataUiStore } from "@/lib/data/ui-store";
import {
  mergeCollectionOrder,
  reorderCollectionIds,
  sortCollectionsByOrder,
} from "@/lib/collections/order";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/context";
import type { DemoCollection, DemoOwnedCard } from "@/lib/demo/types";
import { ShareCollectionModal } from "@/features/collection/components/ShareCollectionModal";
import { ShareHubModal } from "@/features/collection/components/ShareHubModal";

function getCollectionCover(
  collection: DemoCollection,
  ownedCards: DemoOwnedCard[]
): string | null {
  if (collection.coverImageUrl) return collection.coverImageUrl;
  const first = ownedCards.find(
    (oc) => oc.collectionId === collection.id && oc.card.imageUrl
  );
  return first?.card.imageUrl ?? null;
}

export function CollectionManager() {
  const t = useT();
  const router = useRouter();
  const {
    collections,
    ownedCards,
    activeCollectionId,
    setActiveCollection,
    addCollection,
    renameCollection,
    deleteCollection,
    toggleCollectionFavorite,
  } = useAppData();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameTarget, setRenameTarget] = useState<DemoCollection | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DemoCollection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<DemoCollection | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DemoCollection | null>(null);
  const [shareHubOpen, setShareHubOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const collectionOrder = useDataUiStore((s) => s.collectionOrder);
  const setCollectionOrder = useDataUiStore((s) => s.setCollectionOrder);
  const isTouchDevice = useMediaQuery("(hover: none) and (pointer: coarse)");

  useEffect(() => {
    const merged = mergeCollectionOrder(
      collections,
      useDataUiStore.getState().collectionOrder
    );
    const current = useDataUiStore.getState().collectionOrder;
    if (merged.length !== current.length || merged.some((id, i) => id !== current[i])) {
      setCollectionOrder(merged);
    }
  }, [collections, setCollectionOrder]);

  const sortedCollections = useMemo(
    () => sortCollectionsByOrder(collections, collectionOrder),
    [collections, collectionOrder]
  );

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const oc of ownedCards) {
      counts.set(oc.collectionId, (counts.get(oc.collectionId) ?? 0) + oc.quantity);
    }
    return counts;
  }, [ownedCards]);

  const handleSelect = (id: string) => {
    setActiveCollection(id);
    router.push("/collection");
  };

  const openRename = (collection: DemoCollection) => {
    setRenameTarget(collection);
    setRenameName(collection.name);
    setRenameOpen(true);
    setMenuOpen(false);
  };

  const openDelete = (collection: DemoCollection) => {
    setDeleteTarget(collection);
    setDeleteOpen(true);
    setMenuOpen(false);
  };

  const openMenu = (collection: DemoCollection) => {
    setMenuTarget(collection);
    setMenuOpen(true);
  };

  const openShare = (collection: DemoCollection) => {
    setShareTarget(collection);
    setShareHubOpen(true);
    setMenuOpen(false);
  };

  const openManageMembers = (collection: DemoCollection) => {
    setShareTarget(collection);
    setShareOpen(true);
    setMenuOpen(false);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const created = await addCollection(trimmed);
      setActiveCollection(created.id);
      setNewName("");
      setCreateOpen(false);
      toast.success(t("collections.created", { name: trimmed }));
      router.push("/collection");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collections.createFailed"));
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed) return;
    try {
      await renameCollection(renameTarget.id, trimmed);
      setRenameOpen(false);
      setRenameTarget(null);
      toast.success(t("collections.renamed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collections.renameFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCollection(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success(t("collections.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("collections.deleteFailed"));
    }
  };

  const renderCollectionCard = (collection: DemoCollection, index: number) => (
    <CollectionGridCard
      name={collection.name}
      coverImageUrl={getCollectionCover(collection, ownedCards)}
      cardCount={cardCounts.get(collection.id) ?? 0}
      isFavorite={collection.isFavorite ?? false}
      isActive={collection.id === activeCollectionId}
      isShared={collection.isShared === true}
      index={index}
      draggable
      isDragOver={dragOverId === collection.id && draggedId !== collection.id}
      onDragStart={() => setDraggedId(collection.id)}
      onDragOver={() => {
        if (draggedId && draggedId !== collection.id) {
          setDragOverId(collection.id);
        }
      }}
      onDragLeave={() => setDragOverId(null)}
      onDrop={() => {
        if (draggedId && draggedId !== collection.id) {
          setCollectionOrder(
            reorderCollectionIds(collectionOrder, draggedId, collection.id)
          );
        }
        setDraggedId(null);
        setDragOverId(null);
      }}
      onDragEnd={() => {
        setDraggedId(null);
        setDragOverId(null);
      }}
      onSelect={() => handleSelect(collection.id)}
      onToggleFavorite={() => toggleCollectionFavorite(collection.id)}
      onOpenMenu={() => openMenu(collection)}
    />
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("collections.dragHint")}
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {sortedCollections.map((collection, index) =>
          isTouchDevice ? (
            <div key={collection.id}>{renderCollectionCard(collection, index)}</div>
          ) : (
            <ContextMenu key={collection.id}>
              <ContextMenuTrigger asChild>
                <div>{renderCollectionCard(collection, index)}</div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleSelect(collection.id)}>
                  {t("common.open")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openShare(collection)}>
                  {t("share.menuShare")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openManageMembers(collection)}>
                  {t("share.members")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openRename(collection)}>
                  {t("common.rename")}
                </ContextMenuItem>
                {!collection.isDefault && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => openDelete(collection)}
                    >
                      {t("common.delete")}
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          )
        )}
        <CreateCollectionCard
          index={sortedCollections.length}
          onClick={() => setCreateOpen(true)}
        />
      </div>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("collections.createTitle")}
        description={t("collections.createDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              {t("common.create")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 py-2">
          <Label htmlFor="collection-name">{t("collections.collectionName")}</Label>
          <Input
            id="collection-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("collections.namePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={menuTarget?.name ?? t("collections.defaultName")}
        description={t("collections.manage")}
        footer={
          <>
            <Button variant="outline" onClick={() => setMenuOpen(false)}>
              {t("common.close")}
            </Button>
            {menuTarget && (
              <>
                <Button variant="outline" onClick={() => openShare(menuTarget)}>
                  {t("share.menuShare")}
                </Button>
                <Button variant="outline" onClick={() => openManageMembers(menuTarget)}>
                  {t("share.members")}
                </Button>
                <Button variant="outline" onClick={() => openRename(menuTarget)}>
                  {t("common.rename")}
                </Button>
                {!menuTarget.isDefault && (
                  <Button variant="destructive" onClick={() => openDelete(menuTarget)}>
                    {t("common.delete")}
                  </Button>
                )}
              </>
            )}
          </>
        }
      >
        {menuTarget && (
          <p className="py-2 text-sm text-muted-foreground">
            {t("collections.cardsIn", { count: cardCounts.get(menuTarget.id) ?? 0 })}
            {menuTarget.isDefault && t("collections.defaultNoDelete")}
          </p>
        )}
      </Modal>

      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={t("collections.renameTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 py-2">
          <Label htmlFor="rename-collection">{t("common.name")}</Label>
          <Input
            id="rename-collection"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("collections.deleteTitle")}
        description={
          deleteTarget
            ? t("collections.deleteDescription", {
                count: cardCounts.get(deleteTarget.id) ?? 0,
                name: deleteTarget.name,
              })
            : undefined
        }
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
        <div />
      </Modal>

      <ShareCollectionModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        collection={shareTarget}
      />

      <ShareHubModal
        open={shareHubOpen}
        onOpenChange={setShareHubOpen}
        preselectedCollectionId={shareTarget?.id}
      />
    </>
  );
}

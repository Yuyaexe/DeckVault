"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Modal } from "@/components/shared/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AnimeCollectionBreadcrumb } from "@/features/anime-collection/components/AnimeCollectionBreadcrumb";
import { CharacterBubbleGrid } from "@/features/anime-collection/components/CharacterBubbleGrid";
import { EditCharacterModal } from "@/features/anime-collection/components/EditCharacterModal";
import { useAnimeCollection } from "@/features/anime-collection/hooks/useAnimeCollection";
import { useAnimeShareSyncStore } from "@/features/anime-collection/stores/anime-share-sync.store";
import { parseCharacterList } from "@/features/anime-collection/utils/parse-character-list";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { AnimeCharacter } from "@/features/anime-collection/types";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AddCharacterMode = "single" | "list";

export interface AnimeCharacterGridPageProps {
  seriesSlug: string;
}

export function AnimeCharacterGridPage({ seriesSlug }: AnimeCharacterGridPageProps) {
  const t = useT();
  const router = useRouter();
  const isTouchDevice = useMediaQuery("(hover: none) and (pointer: coarse)");
  const triggerPriorityPush = useAnimeShareSyncStore((s) => s.triggerPriorityPush);
  const isShared = useAnimeShareSyncStore((s) => s.isShared);
  const {
    getSeriesBySlug,
    getCharactersForSeries,
    addAnimeCharacter,
    addAnimeCharactersBatch,
    renameAnimeCharacter,
    updateAnimeCharacterImage,
    deleteAnimeCharacter,
  } = useAnimeCollection();

  const series = getSeriesBySlug(seriesSlug);
  const characters = series ? getCharactersForSeries(series.id) : [];

  const [createOpen, setCreateOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddCharacterMode>("single");
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [listText, setListText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnimeCharacter | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnimeCharacter | null>(null);

  const existingNames = useMemo(
    () => characters.map((character) => character.name),
    [characters]
  );

  const parsedList = useMemo(
    () => parseCharacterList(listText, existingNames),
    [listText, existingNames]
  );

  const resetCreateForm = () => {
    setAddMode("single");
    setNewName("");
    setNewImageUrl("");
    setListText("");
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) resetCreateForm();
  };

  if (!series) {
    return (
      <EmptyState
        icon={Users}
        title={t("anime.seriesNotFoundTitle")}
        description={t("anime.seriesNotFoundDescription")}
        actionLabel={t("anime.title")}
        onAction={() => router.push("/anime-collection")}
        className="mt-12"
      />
    );
  }

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addAnimeCharacter({
      seriesId: series.id,
      name: trimmed,
      imageUrl: newImageUrl.trim() || null,
    });
    resetCreateForm();
    setCreateOpen(false);
    toast.success(t("anime.characterAdded", { name: trimmed }));
  };

  const handleCreateList = () => {
    const { names, skipped } = parseCharacterList(listText, existingNames);
    if (names.length === 0) {
      toast.info(
        skipped > 0
          ? t("anime.charactersAllSkipped", { skipped })
          : t("anime.addListHint")
      );
      return;
    }

    addAnimeCharactersBatch({ seriesId: series.id, names });
    resetCreateForm();
    setCreateOpen(false);

    if (skipped > 0) {
      toast.success(
        t("anime.charactersAddedWithSkipped", { count: names.length, skipped })
      );
    } else {
      toast.success(t("anime.charactersAdded", { count: names.length }));
    }
  };

  const openEdit = (character: AnimeCharacter) => {
    setEditTarget(character);
    setEditOpen(true);
  };

  const handleEditSave = (input: { name: string; imageUrl: string | null }) => {
    if (!editTarget) return;
    if (input.name !== editTarget.name) {
      renameAnimeCharacter(editTarget.id, input.name);
    }
    if (input.imageUrl !== editTarget.imageUrl) {
      updateAnimeCharacterImage(editTarget.id, input.imageUrl);
    }
    setEditTarget(null);
  };

  const openDelete = (character: AnimeCharacter) => {
    setDeleteTarget(character);
    setDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteAnimeCharacter(deleteTarget.id);
    setDeleteOpen(false);
    setDeleteTarget(null);
    toast.success(t("anime.characterDeleted"));
    if (isShared) triggerPriorityPush();
  };

  return (
    <>
      <AnimeCollectionBreadcrumb
        items={[
          { label: t("anime.title"), href: "/anime-collection" },
          { label: series.name },
        ]}
      />

      <PageHeader
        title={series.name}
        description={
          characters.length === 1
            ? "1 character"
            : `${characters.length} characters`
        }
      />

      <div className="mt-8">
        {characters.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("anime.noCharactersTitle")}
            description={t("anime.noCharactersDescription")}
            actionLabel={t("anime.addCharacter")}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <CharacterBubbleGrid
            characters={characters}
            seriesSlug={seriesSlug}
            seriesName={series.name}
            isTouchDevice={isTouchDevice}
            onSelect={(character) =>
              router.push(`/anime-collection/${seriesSlug}/${character.id}`)
            }
            onEdit={openEdit}
            onDelete={openDelete}
            onAdd={() => setCreateOpen(true)}
          />
        )}
      </div>

      <Modal
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        title={t("anime.addCharacterTitle")}
        description={t("anime.addCharacterDescription", { series: series.name })}
        footer={
          <>
            <Button variant="outline" onClick={() => handleCreateOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            {addMode === "single" ? (
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                {t("anime.addCharacter")}
              </Button>
            ) : (
              <Button
                onClick={handleCreateList}
                disabled={parsedList.names.length === 0}
              >
                {parsedList.names.length > 0
                  ? t("anime.addCharactersCount", { count: parsedList.names.length })
                  : t("anime.addCharacter")}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={addMode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("single")}
            >
              {t("anime.addModeSingle")}
            </Button>
            <Button
              type="button"
              variant={addMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setAddMode("list")}
            >
              {t("anime.addModeList")}
            </Button>
          </div>

          {addMode === "single" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="char-name">{t("common.name")}</Label>
                <Input
                  id="char-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("anime.characterNamePlaceholder")}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-photo">{t("anime.photoUrl")}</Label>
                <Input
                  id="char-photo"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder={t("common.urlPlaceholder")}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="char-list">{t("anime.addModeList")}</Label>
              <textarea
                id="char-list"
                value={listText}
                onChange={(e) => setListText(e.target.value)}
                placeholder={t("anime.addListPlaceholder")}
                rows={8}
                autoFocus
                className={cn(
                  "flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              />
              <p className="text-xs text-muted-foreground">{t("anime.addListHint")}</p>
            </div>
          )}
        </div>
      </Modal>

      <EditCharacterModal
        open={editOpen}
        onOpenChange={setEditOpen}
        characterName={editTarget?.name ?? ""}
        currentImageUrl={editTarget?.imageUrl ?? null}
        seriesSlug={seriesSlug}
        seriesName={series.name}
        accentColor={editTarget?.accentColor ?? null}
        onSave={handleEditSave}
      />

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("anime.deleteCharacterTitle")}
        description={t("anime.deleteCharacterConfirmBody", {
          name: deleteTarget?.name ?? "",
        })}
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
        <span className="sr-only">{t("anime.confirmDeleteCharacter")}</span>
      </Modal>
    </>
  );
}

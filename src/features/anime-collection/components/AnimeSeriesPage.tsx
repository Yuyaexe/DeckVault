"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
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
import {
  AnimeSeriesCard,
  AddAnimeSeriesCard,
} from "@/features/anime-collection/components/AnimeSeriesCard";
import { EditSeriesModal } from "@/features/anime-collection/components/EditSeriesModal";
import { ShareHubModal } from "@/features/collection/components/ShareHubModal";
import { useAnimeCollection } from "@/features/anime-collection/hooks/useAnimeCollection";
import { useAnimeShareSyncStore } from "@/features/anime-collection/stores/anime-share-sync.store";
import { resolveSeriesCoverUrl } from "@/features/anime-collection/utils/resolve-series-cover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAppConfig } from "@/hooks/useAppConfig";
import type { AnimeSeries } from "@/features/anime-collection/types";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

export function AnimeSeriesPage() {
  const t = useT();
  const router = useRouter();
  const { isSupabaseMode } = useAppConfig();
  const isTouchDevice = useMediaQuery("(hover: none) and (pointer: coarse)");
  const {
    animeSeries,
    characterCountBySeries,
    addAnimeSeries,
    renameAnimeSeries,
    updateAnimeSeriesCover,
    deleteAnimeSeries,
  } = useAnimeCollection();

  const syncStatus = useAnimeShareSyncStore((s) => s.status);
  const syncError = useAnimeShareSyncStore((s) => s.error);
  const isOwner = useAnimeShareSyncStore((s) => s.isOwner);
  const isShared = useAnimeShareSyncStore((s) => s.isShared);
  const syncProgress = useAnimeShareSyncStore((s) => s.progress);
  const triggerSync = useAnimeShareSyncStore((s) => s.triggerSync);
  const triggerPriorityPush = useAnimeShareSyncStore((s) => s.triggerPriorityPush);
  const awaitingManualSync = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AnimeSeries | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnimeSeries | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!awaitingManualSync.current) return;
    if (syncProgress === 100) {
      awaitingManualSync.current = false;
      toast.success(t("anime.syncComplete"));
    } else if (syncStatus === "idle" && isShared === false) {
      awaitingManualSync.current = false;
      toast.message(t("anime.syncNotShared"));
    } else if (syncStatus === "error") {
      awaitingManualSync.current = false;
    }
  }, [syncProgress, syncStatus, isShared, t]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addAnimeSeries({
      name: trimmed,
      coverImageUrl: newCoverUrl.trim() || null,
    });
    setNewName("");
    setNewCoverUrl("");
    setCreateOpen(false);
    toast.success(t("anime.seriesAdded", { name: trimmed }));
  };

  const openEdit = (series: AnimeSeries) => {
    setEditTarget(series);
    setEditOpen(true);
  };

  const handleEditSave = (input: { name: string; coverImageUrl: string | null }) => {
    if (!editTarget) return;
    if (input.name !== editTarget.name) {
      renameAnimeSeries(editTarget.id, input.name);
    }
    if (input.coverImageUrl !== editTarget.coverImageUrl) {
      updateAnimeSeriesCover(editTarget.id, input.coverImageUrl);
    }
    setEditTarget(null);
  };

  const openDelete = (series: AnimeSeries) => {
    setDeleteTarget(series);
    setDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteAnimeSeries(deleteTarget.id);
    setDeleteOpen(false);
    setDeleteTarget(null);
    toast.success(t("anime.seriesDeleted"));
    if (isShared) triggerPriorityPush();
  };

  const handlePullShared = () => {
    awaitingManualSync.current = true;
    triggerSync();
    toast.message(t("anime.syncing"));
  };

  const renderSeriesCard = (series: AnimeSeries, index: number) => (
    <AnimeSeriesCard
      name={series.name}
      coverImageUrl={resolveSeriesCoverUrl(series.slug, series.name, series.coverImageUrl)}
      coverColor={series.coverColor}
      characterCount={characterCountBySeries.get(series.id) ?? 0}
      index={index}
      onSelect={() => router.push(`/anime-collection/${series.slug}`)}
      onEditCover={() => openEdit(series)}
    />
  );

  const syncBadge =
    isSupabaseMode && isShared === true && syncStatus === "shared" ? (
      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
        {t("anime.syncShared")}
      </span>
    ) : isSupabaseMode && isShared === true && syncStatus === "owner" ? (
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {t("anime.syncOwner")}
      </span>
    ) : isSupabaseMode && isShared === true && syncStatus === "syncing" ? (
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {t("anime.syncing")}
      </span>
    ) : null;

  const showSyncBar = isSupabaseMode && isShared === true && syncProgress != null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <PageHeader
            title={t("anime.title")}
            description={t("anime.description")}
          />
          {syncBadge}
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {isSupabaseMode && isShared === true && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-9"
              onClick={handlePullShared}
              disabled={syncStatus === "syncing"}
              title={t("anime.syncRefresh")}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">{t("anime.syncRefresh")}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-4 w-4" />
            <span className="max-w-[9rem] truncate sm:max-w-none">{t("share.menuShare")}</span>
          </Button>
        </div>
      </div>

      {showSyncBar && (
        <div
          className="mt-3 space-y-1.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={syncProgress ?? 0}
          aria-label={t("anime.syncing")}
        >
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {syncProgress >= 100
                ? t("anime.syncComplete")
                : t("anime.syncProgress", { percent: String(syncProgress ?? 0) })}
            </span>
            <span className="tabular-nums">{syncProgress ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, syncProgress ?? 0))}%` }}
            />
          </div>
        </div>
      )}

      {isSupabaseMode && isShared && syncStatus === "error" && syncError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="font-medium">{t("anime.syncError")}</p>
          <p className="mt-1 break-words text-destructive/90">{syncError}</p>
          {syncError.toLowerCase().includes("migration") && (
            <p className="mt-1 text-xs">{t("anime.syncMigrationHint")}</p>
          )}
        </div>
      )}

      {animeSeries.length === 0 ? (
        <div className="mt-12 space-y-4">
          <EmptyState
            icon={Sparkles}
            title={t("anime.noSeriesTitle")}
            description={
              isSupabaseMode && isOwner === false
                ? t("anime.syncEmptyShared")
                : t("anime.noSeriesDescription")
            }
            actionLabel={
              isSupabaseMode && isShared === true
                ? t("anime.syncRefresh")
                : t("anime.addSeries")
            }
            onAction={
              isSupabaseMode && isShared === true
                ? handlePullShared
                : () => setCreateOpen(true)
            }
          />
          {isSupabaseMode && isShared === true && isOwner !== false && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                {t("anime.addSeries")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {animeSeries.map((series, index) =>
            isTouchDevice ? (
              <div key={series.id} className="group relative">
                {renderSeriesCard(series, index)}
              </div>
            ) : (
              <ContextMenu key={series.id}>
                <ContextMenuTrigger asChild>
                  <div className="group relative">{renderSeriesCard(series, index)}</div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => router.push(`/anime-collection/${series.slug}`)}>
                    {t("common.open")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => openEdit(series)}>
                    {t("anime.editSeries")}
                  </ContextMenuItem>
                  {!series.isSeeded && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => openDelete(series)}
                      >
                        {t("common.delete")}
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            )
          )}
          <AddAnimeSeriesCard
            index={animeSeries.length}
            onClick={() => setCreateOpen(true)}
          />
        </div>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("anime.addSeriesTitle")}
        description={t("anime.addSeriesDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              {t("anime.addSeries")}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="series-name">{t("anime.seriesName")}</Label>
            <Input
              id="series-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("anime.seriesNamePlaceholder")}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="series-cover">{t("anime.coverUrl")}</Label>
            <Input
              id="series-cover"
              value={newCoverUrl}
              onChange={(e) => setNewCoverUrl(e.target.value)}
              placeholder={t("common.urlPlaceholder")}
            />
          </div>
        </div>
      </Modal>

      <EditSeriesModal
        open={editOpen}
        onOpenChange={setEditOpen}
        seriesName={editTarget?.name ?? ""}
        seriesSlug={editTarget?.slug ?? ""}
        currentCoverUrl={editTarget?.coverImageUrl ?? null}
        coverColor={editTarget?.coverColor ?? null}
        onSave={handleEditSave}
      />

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("anime.deleteSeriesTitle")}
        description={
          deleteTarget?.isSeeded
            ? t("anime.deleteSeriesBuiltin")
            : t("anime.deleteSeriesConfirmBody", { name: deleteTarget?.name ?? "" })
        }
        footer={
          deleteTarget?.isSeeded ? (
            <Button onClick={() => setDeleteOpen(false)}>{t("common.close")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t("common.delete")}
              </Button>
            </>
          )
        }
      >
        <span className="sr-only">{t("anime.confirmDeleteSeries")}</span>
      </Modal>

      <ShareHubModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        preselectAnime
      />
    </>
  );
}

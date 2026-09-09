"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAppData } from "@/hooks/useAppData";
import { useDemoStore } from "@/lib/demo/store";
import { useAnimeShareSyncStore } from "@/features/anime-collection/stores/anime-share-sync.store";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareHubModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this TCG collection id when opening. */
  preselectedCollectionId?: string | null;
  /** Pre-check Anime when opening from anime page. */
  preselectAnime?: boolean;
}

export function ShareHubModal({
  open,
  onOpenChange,
  preselectedCollectionId,
  preselectAnime = false,
}: ShareHubModalProps) {
  const t = useT();
  const { isSupabaseMode } = useAppConfig();
  const { collections, activeCollectionId } = useAppData();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeAnime, setIncludeAnime] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("editor");
    const initial = new Set<string>();
    const prefer = preselectedCollectionId ?? activeCollectionId;
    if (prefer) initial.add(prefer);
    setSelectedIds(initial);
    setIncludeAnime(preselectAnime);
  }, [open, preselectedCollectionId, preselectAnime, activeCollectionId]);

  const allSelected = useMemo(
    () =>
      collections.length > 0 &&
      collections.every((c) => selectedIds.has(c.id)) &&
      includeAnime,
    [collections, selectedIds, includeAnime]
  );

  const toggleCollection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(collections.map((c) => c.id)));
    setIncludeAnime(true);
  }, [collections]);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
    setIncludeAnime(false);
  }, []);

  const handleInvite = async () => {
    if (!email.trim()) return;
    if (!isSupabaseMode) {
      toast.error(t("share.cloudOnly"));
      return;
    }
    if (selectedIds.size === 0 && !includeAnime) {
      toast.error(t("share.selectSomething"));
      return;
    }

    setSubmitting(true);
    const errors: string[] = [];
    let okCount = 0;

    try {
      for (const collectionId of selectedIds) {
        const res = await fetch("/api/app/collections/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collectionId,
            email: email.trim(),
            role,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(json.error ?? collectionId);
        } else {
          okCount++;
        }
      }

      if (includeAnime) {
        const anime = useDemoStore.getState();
        const res = await fetch("/api/app/anime/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "invite",
            email: email.trim(),
            role,
            state: {
              animeSeries: anime.animeSeries ?? [],
              animeCharacters: anime.animeCharacters ?? [],
              animeCharacterCards: anime.animeCharacterCards ?? [],
              animeBinderLayoutByCharacter: anime.animeBinderLayoutByCharacter ?? {},
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(json.error ?? "anime");
        } else {
          okCount++;
          // Kick sync now that the workspace is shared.
          useAnimeShareSyncStore.getState().triggerSync();
        }
      }

      if (okCount > 0) {
        toast.success(t("share.inviteSentCount", { count: okCount }));
        setEmail("");
      }
      if (errors.length > 0) {
        toast.error(errors[0]!);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("share.inviteFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("share.hubTitle")}
      description={t("share.hubDescription")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button
            onClick={() => void handleInvite()}
            disabled={
              !email.trim() ||
              submitting ||
              (selectedIds.size === 0 && !includeAnime)
            }
          >
            {t("share.invite")}
          </Button>
        </>
      }
    >
      {!isSupabaseMode ? (
        <p className="py-2 text-sm text-muted-foreground">{t("share.cloudOnly")}</p>
      ) : (
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="share-hub-email">{t("share.emailLabel")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="share-hub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("share.emailPlaceholder")}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && void handleInvite()}
              />
              <ResponsiveSelect
                value={role}
                onValueChange={(v) => setRole(v as "editor" | "viewer")}
                options={[
                  { value: "editor", label: t("share.roleEditor") },
                  { value: "viewer", label: t("share.roleViewer") },
                ]}
                triggerClassName="w-full sm:w-[140px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("share.hubHint")}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("share.whatToShare")}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={selectAll}
                  disabled={allSelected}
                >
                  {t("share.selectAll")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearAll}
                  disabled={selectedIds.size === 0 && !includeAnime}
                >
                  {t("share.clearAll")}
                </Button>
              </div>
            </div>

            {/* Anime pinned — always visible, not buried in the scroll list */}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2.5 text-sm hover:bg-muted/50",
                includeAnime && "border-primary/40 bg-primary/10"
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeAnime}
                onChange={(e) => setIncludeAnime(e.target.checked)}
              />
              <span className="font-medium">{t("share.animeCollection")}</span>
            </label>

            <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
              {collections.map((c) => {
                const checked = selectedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50",
                        checked && "bg-primary/10"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleCollection(c.id)}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, HardDrive, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useDemoStore } from "@/lib/demo/store";
import {
  buildBackupPayload,
  downloadBackup,
} from "@/features/import/services/backup-export";
import { useT } from "@/lib/i18n/context";
import { readStoredString, writeStoredString } from "@/lib/storage/indexeddb-storage";

const DISMISS_KEY = "deckvault-local-banner-dismissed";

export function LocalModeBanner() {
  const t = useT();
  const { isSupabaseMode, configLoading } = useAppConfig();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void readStoredString(DISMISS_KEY).then((value) => {
      if (!cancelled) setDismissed(value === "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [backingUp, setBackingUp] = useState(false);

  if (configLoading || isSupabaseMode || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    void writeStoredString(DISMISS_KEY, "1");
  };

  const handleDownload = () => {
    setBackingUp(true);
    try {
      const demo = useDemoStore.getState();
      const backup = buildBackupPayload({
        profile: demo.profile,
        collections: demo.collections,
        ownedCards: demo.ownedCards,
        tags: demo.tags,
        animeSeries: demo.animeSeries,
        animeCharacters: demo.animeCharacters,
        animeCharacterCards: demo.animeCharacterCards,
      });
      downloadBackup(backup);
      toast.success(
        t("settings.backupSaved", {
          cards: backup.ownedCards.length,
          collections: backup.collections.length,
          anime: backup.animeCharacterCards.length,
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.backupFailed"));
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100 sm:gap-3 sm:px-4"
    >
      <HardDrive className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <p className="min-w-0 flex-1 text-xs sm:text-sm">{t("banner.localMode")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          disabled={backingUp}
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          {backingUp ? t("settings.downloading") : t("banner.downloadBackup")}
        </Button>
        <Button size="sm" variant="ghost" className="h-8" asChild>
          <Link href="/settings">{t("banner.openSettings")}</Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={dismiss}
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

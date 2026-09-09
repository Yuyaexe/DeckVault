"use client";



import { useState, useEffect, useRef } from "react";

import { useTheme } from "next-themes";

import { useQueryClient } from "@tanstack/react-query";

import { HardDriveDownload, HardDriveUpload, Loader2, LogOut } from "lucide-react";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

import { PageHeader } from "@/components/shared/PageHeader";

import { LoadingOverlay } from "@/components/shared/LoadingOverlay";

import { Modal } from "@/components/shared/Modal";

import { Label } from "@/components/ui/label";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";

import { ResponsiveSelect } from "@/components/ui/responsive-select";

import { useAppData } from "@/hooks/useAppData";

import type { DemoProfile } from "@/lib/demo/types";

import {

  buildBackupPayload,

  downloadBackup,

  fetchBackupFromServer,

} from "@/features/import/services/backup-export";

import {

  defaultCollectionAfterRestore,

  readBackupFile,

  restoreBackupOnServer,

} from "@/features/import/services/backup-import";

import { useDemoStore } from "@/lib/demo/store";

import { useDataUiStore } from "@/lib/data/ui-store";

import { useLocaleStore } from "@/lib/i18n/store";

import { LOCALE_OPTIONS, type AppLocale } from "@/lib/i18n/types";

import { useT } from "@/lib/i18n/context";

import { toast } from "sonner";



export default function SettingsPage() {

  const t = useT();

  const {

    profile,

    collections,

    ownedCards,

    tags,

    updateProfile,

    isSupabaseMode,

  } = useAppData();

  const queryClient = useQueryClient();
  const { signOut, loading: signingOut } = useSignOut();

  const restoreInputRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme } = useTheme();

  const locale = useLocaleStore((s) => s.locale);

  const setLocale = useLocaleStore((s) => s.setLocale);

  const [backingUp, setBackingUp] = useState(false);

  const [restoring, setRestoring] = useState(false);

  const [saving, setSaving] = useState(false);

  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const [draft, setDraft] = useState<DemoProfile>(profile);

  const [draftLocale, setDraftLocale] = useState<AppLocale>(locale);



  const hasProfileChanges =

    draft.displayName !== profile.displayName || draftLocale !== locale;



  useEffect(() => {

    setDraft(profile);

  }, [profile]);



  useEffect(() => {

    setDraftLocale(locale);

  }, [locale]);



  const handleSave = async () => {

    setSaving(true);

    setBusyLabel(t("settings.busySaving"));

    try {

      await updateProfile(draft);

      setLocale(draftLocale);

      toast.success(t("settings.saved"));

    } catch (err) {

      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));

    } finally {

      setSaving(false);

      setBusyLabel(null);

    }

  };



  const handleBackup = async () => {

    setBackingUp(true);

    setBusyLabel(isSupabaseMode ? t("settings.downloading") : t("settings.busyWait"));

    try {

      const anime = useDemoStore.getState();

      const animeFields = {

        animeSeries: anime.animeSeries,

        animeCharacters: anime.animeCharacters,

        animeCharacterCards: anime.animeCharacterCards,

      };



      const backup = isSupabaseMode

        ? {

            ...(await fetchBackupFromServer()),

            ...animeFields,

          }

        : buildBackupPayload({

            profile,

            collections,

            ownedCards,

            tags,

            ...animeFields,

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

      setBusyLabel(null);

    }

  };



  const handleRestoreFile = async (file: File) => {

    setRestoring(true);

    setBusyLabel(t("settings.busyWait"));

    try {

      const parsed = await readBackupFile(file);

      if (parsed.scope === "anime") {
        useDemoStore.getState().restoreAnimeCollectionFromBackup(parsed.backup);
        toast.success(
          t("settings.restoreAnimeSuccess", {
            series: parsed.backup.animeSeries.length,
            characters: parsed.backup.animeCharacters.length,
            cards: parsed.backup.animeCharacterCards.length,
          })
        );
        return;
      }

      const backup = parsed.backup;

      const activeId = defaultCollectionAfterRestore(backup);

      if (activeId) {

        useDataUiStore.getState().setActiveCollectionId(activeId);

      }

      if (isSupabaseMode) {

        setBusyLabel(t("settings.restoring"));

        const result = await restoreBackupOnServer(backup);

        useDemoStore.getState().restoreAnimeCollectionFromBackup(backup);

        await queryClient.invalidateQueries({ queryKey: ["app-state"] });

        toast.success(

          t("settings.restoreSuccessCloud", {

            cards: result.importedCards,

            collections: result.collections,

            anime: backup.animeCharacterCards.length,

          })

        );

      } else {

        useDemoStore.getState().restoreFromBackup(backup);

        toast.success(

          t("settings.restoreSuccessLocal", {

            cards: backup.ownedCards.length,

            collections: backup.collections.length,

            anime: backup.animeCharacterCards.length,

          })

        );

      }

    } catch (err) {

      toast.error(err instanceof Error ? err.message : t("settings.restoreFailed"));

    } finally {

      setRestoring(false);

      setBusyLabel(null);

      if (restoreInputRef.current) restoreInputRef.current.value = "";

    }

  };



  const isBusy = backingUp || restoring || saving;



  return (

    <>

      <LoadingOverlay

        active={isBusy}

        fullscreen

        title={busyLabel ?? t("settings.busyWait")}

        description={restoring ? t("settings.busyRestoreWarning") : undefined}

      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-8 sm:py-8">

        <PageHeader title={t("settings.title")} description={t("settings.description")} />



        <div className="mx-auto mt-6 max-w-lg space-y-8 sm:mt-8">

          <section className="space-y-4">

            <h2 className="text-base font-semibold sm:text-lg">{t("settings.profile")}</h2>

            <div className="space-y-2">

              <Label>{t("settings.displayName")}</Label>

              <Input

                value={draft.displayName}

                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}

              />

            </div>

          </section>



          <section className="space-y-4">

            <h2 className="text-base font-semibold sm:text-lg">{t("settings.preferences")}</h2>



            <div className="space-y-2">

              <Label>{t("settings.language")}</Label>

              <ResponsiveSelect

                value={draftLocale}

                onValueChange={(v) => setDraftLocale(v as AppLocale)}

                options={LOCALE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}

              />

            </div>



            <div className="space-y-2">

              <Label>{t("settings.theme")}</Label>

              <ResponsiveSelect

                value={theme ?? "dark"}

                onValueChange={setTheme}

                options={[

                  { value: "dark", label: t("settings.themeDark") },

                  { value: "light", label: t("settings.themeLight") },

                ]}

              />

            </div>

          </section>



          <Button

            className="w-full sm:w-auto"

            onClick={() => void handleSave()}

            disabled={isBusy || !hasProfileChanges}

          >

            {saving ? (

              <>

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                {t("settings.saving")}

              </>

            ) : (

              t("settings.save")

            )}

          </Button>



          {isSupabaseMode && (

            <p className="text-sm text-muted-foreground">{t("settings.cloudSync")}</p>

          )}

          {!isSupabaseMode && (

            <p className="text-sm text-muted-foreground">{t("settings.offlineMode")}</p>

          )}

          {isSupabaseMode && (
            <section className="space-y-3 border-t border-border pt-6 sm:pt-8">
              <h2 className="text-base font-semibold sm:text-lg">{t("auth.logout.account")}</h2>
              <p className="text-sm text-muted-foreground">{t("auth.logout.hint")}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => void signOut()}
                disabled={signingOut || isBusy}
              >
                {signingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </>
                )}
              </Button>
            </section>
          )}

          <section className="space-y-4 border-t border-border pt-6 sm:pt-8">

            <h2 className="text-base font-semibold sm:text-lg">{t("settings.backup")}</h2>

            <p className="text-sm text-muted-foreground">{t("settings.backupHint")}</p>

            <div className="flex flex-col gap-2 sm:flex-row">

              <Button

                variant="outline"

                className="w-full sm:w-auto"

                onClick={handleBackup}

                disabled={isBusy}

              >

                {backingUp ? (

                  <>

                    <Loader2 className="h-4 w-4 animate-spin" />

                    {t("settings.downloading")}

                  </>

                ) : (

                  <>

                    <HardDriveDownload className="h-4 w-4" />

                    {t("settings.downloadBackup")}

                  </>

                )}

              </Button>

              <input

                ref={restoreInputRef}

                type="file"

                accept="application/json,.json"

                className="hidden"

                onChange={(e) => {

                  const file = e.target.files?.[0];

                  if (file) {

                    setPendingRestoreFile(file);

                    setRestoreConfirmOpen(true);

                  }

                }}

              />

              <Button

                variant="outline"

                className="w-full sm:w-auto"

                onClick={() => restoreInputRef.current?.click()}

                disabled={isBusy}

              >

                {restoring ? (

                  <>

                    <Loader2 className="h-4 w-4 animate-spin" />

                    {t("settings.restoring")}

                  </>

                ) : (

                  <>

                    <HardDriveUpload className="h-4 w-4" />

                    {t("settings.restoreBackup")}

                  </>

                )}

              </Button>

            </div>

          </section>

        </div>

      </div>



      <Modal

        open={restoreConfirmOpen}

        onOpenChange={(open) => {

          if (!open) {

            setRestoreConfirmOpen(false);

            setPendingRestoreFile(null);

            if (restoreInputRef.current) restoreInputRef.current.value = "";

          }

        }}

        title={t("settings.restoreTitle")}

        description={t(
          isSupabaseMode
            ? "settings.restoreDescriptionCloud"
            : "settings.restoreDescriptionLocal"
        )}

        footer={

          <>

            <Button

              variant="outline"

              onClick={() => {

                setRestoreConfirmOpen(false);

                setPendingRestoreFile(null);

                if (restoreInputRef.current) restoreInputRef.current.value = "";

              }}

            >

              {t("common.cancel")}

            </Button>

            <Button

              variant="destructive"

              onClick={() => {

                const file = pendingRestoreFile;

                setRestoreConfirmOpen(false);

                setPendingRestoreFile(null);

                if (file) void handleRestoreFile(file);

              }}

            >

              {t("settings.restore")}

            </Button>

          </>

        }

      >

        <div />

      </Modal>

    </>

  );

}


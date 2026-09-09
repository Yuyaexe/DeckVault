"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, ClipboardPaste, Printer, Trash2, Eye, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import {
  ProxyBinderPreview,
  type SlotUpdate,
} from "@/features/proxy-print/components/ProxyBinderPreview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { detectGameFromText } from "@/lib/proxy-print/detect-game";
import { buildProxyPdf, previewLayoutText } from "@/lib/proxy-print/build-pdf";
import {
  deckLineClearVariantImage,
  deckLineWithVariantImage,
  hasMixedGameSections,
  resolveKeyWithoutCustomImage,
} from "@/lib/proxy-print/parse-deck";
import {
  compactProxyDeckCustomImages,
  hydrateProxySlotImageUrls,
  preloadProxyDeckCustomImages,
  toInlineDeckImageRef,
} from "@/lib/proxy-print/custom-images";
import { isUserUploadedCustomImage } from "@/lib/proxy-print/preview-image";
import {
  DEFAULT_CARD_SIZE_FOR_GAME,
  DEFAULT_PDF_DPI,
  GAME_LABELS,
  type CardSizePreset,
  type ProxyGame,
  type ProxyPrintSlot,
} from "@/lib/proxy-print/types";
import { useLocale, useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type InputMode = "paste" | "file";

const AUTO_PREVIEW_MS = 700;

export function ProxyPrintPanel() {
  const t = useT();
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRequestRef = useRef(0);
  const deckTextRef = useRef("");
  const defaultGameRef = useRef<ProxyGame>("yugioh");
  const tRef = useRef(t);
  const variantOverridesRef = useRef(new Map<string, SlotUpdate>());

  const applyVariantOverrides = useCallback((incoming: ProxyPrintSlot[]): ProxyPrintSlot[] => {
    const overrides = variantOverridesRef.current;
    if (!overrides.size) return incoming;
    return incoming.map((slot) => {
      const override = overrides.get(slot.resolveKey);
      if (!override) return slot;
      return {
        ...slot,
        imageUrl: override.imageUrl,
        selectedVariantKey: override.selectedVariantKey,
        rarity: override.rarity,
        setLine: override.setLine,
        variantLabel: override.variantLabel ?? slot.variantLabel,
      };
    });
  }, []);

  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [deckText, setDeckText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<CardSizePreset>("yugioh");
  const [cardsGlued, setCardsGlued] = useState(true);
  const [autoPreview, setAutoPreview] = useState(true);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMax, setProgressMax] = useState(100);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [slots, setSlots] = useState<ProxyPrintSlot[]>([]);
  const [spreadIndex, setSpreadIndex] = useState(0);

  const hasPreview = slots.length > 0;
  const isMixedDeck = useMemo(() => hasMixedGameSections(deckText), [deckText]);

  const defaultGame = useMemo((): ProxyGame => {
    const text = deckText.trim();
    if (!text) return "yugioh";
    return detectGameFromText(text) ?? "yugioh";
  }, [deckText]);

  deckTextRef.current = deckText;
  defaultGameRef.current = defaultGame;
  tRef.current = t;

  const preview = useMemo(
    () => previewLayoutText(cardSize, cardsGlued, locale === "pt-BR" ? "pt-BR" : "en"),
    [cardSize, cardsGlued, locale]
  );

  const refreshDetection = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setStatus(t("proxyPrint.hint"));
        return;
      }
      if (hasMixedGameSections(text)) {
        setStatus(t("proxyPrint.gameMixed"));
        return;
      }
      const detected = detectGameFromText(text);
      if (detected) {
        setCardSize(DEFAULT_CARD_SIZE_FOR_GAME[detected]);
      }
      setStatus(
        detected
          ? t("proxyPrint.gameDetected", { game: GAME_LABELS[detected] })
          : t("proxyPrint.gameManual")
      );
    },
    [t]
  );

  const handleSlotUpdate = useCallback(
    (slotId: string, update: SlotUpdate, sourceQuery: string | null) => {
      setSlots((prev) => {
        const target = prev.find((s) => s.slotId === slotId);
        if (!target) return prev;

        const overrides = variantOverridesRef.current;
        overrides.set(target.resolveKey, update);
        // Catalog picks clear `| image` from the deck line — keep override under the base key too.
        const baseKey = resolveKeyWithoutCustomImage(target.resolveKey);
        if (baseKey !== target.resolveKey) {
          overrides.set(baseKey, update);
        }

        return prev.map((slot) =>
          slot.resolveKey === target.resolveKey
            ? {
                ...slot,
                imageUrl: update.imageUrl,
                selectedVariantKey: update.selectedVariantKey,
                rarity: update.rarity,
                setLine: update.setLine,
                variantLabel: update.variantLabel ?? slot.variantLabel,
              }
            : slot
        );
      });

      if (!sourceQuery || !update.imageUrl) return;

      // Only persist true uploads in the deck list. Writing catalog print URLs
      // collapses the slot to a single "custom" variant on the next resolve.
      if (update.selectedVariantKey === "custom" || isUserUploadedCustomImage(update.imageUrl)) {
        void toInlineDeckImageRef(update.imageUrl)
          .then((inlineRef) => {
            setDeckText((text) => deckLineWithVariantImage(text, sourceQuery, inlineRef));
          })
          .catch(() => {
            toast.error(t("proxyPrint.customImageSaveFailed"));
          });
        return;
      }

      setDeckText((text) => deckLineClearVariantImage(text, sourceQuery));
    },
    [t]
  );

  const fetchResolvedSlots = useCallback(
    async (signal?: AbortSignal): Promise<ProxyPrintSlot[]> => {
      const text = deckTextRef.current.trim();
      if (!text) throw new Error(tRef.current("proxyPrint.needList"));

      await preloadProxyDeckCustomImages(text);

      const res = await fetch("/api/proxy-print/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Keep `@img:` short refs — hydrate blobs client-side after resolve.
          deckText: text,
          game: defaultGameRef.current,
        }),
        signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tRef.current("proxyPrint.failed"));
      if (data.mixed) {
        setStatus(tRef.current("proxyPrint.gameMixed"));
      } else if (data.game) {
        setCardSize(DEFAULT_CARD_SIZE_FOR_GAME[data.game as ProxyGame]);
      }
      const withOverrides = applyVariantOverrides(data.slots as ProxyPrintSlot[]);
      return hydrateProxySlotImageUrls(withOverrides);
    },
    [applyVariantOverrides]
  );

  const commitPreviewSlots = useCallback((resolved: ProxyPrintSlot[], requestId: number) => {
    if (requestId !== previewRequestRef.current) return false;
    setSlots(resolved);
    setSpreadIndex(0);
    return true;
  }, []);

  const resolveSlotsFromApi = useCallback(
    async (options?: { silent?: boolean }): Promise<ProxyPrintSlot[]> => {
      const resolved = await fetchResolvedSlots(abortRef.current?.signal);
      setSlots(resolved);
      setSpreadIndex(0);
      if (!options?.silent) {
        const missing = resolved.filter((s) => !s.imageUrl).length;
        if (missing) toast.warning(t("proxyPrint.partialResolve", { count: missing }));
      }
      return resolved;
    },
    [fetchResolvedSlots, t]
  );

  const handlePasteChange = (value: string) => {
    variantOverridesRef.current.clear();
    setDeckText(value);
    setFileName(null);
    setInputMode("paste");
    if (!autoPreview) setSlots([]);
    refreshDetection(value);
    void compactProxyDeckCustomImages(value)
      .then(setDeckText)
      .catch(() => toast.error(t("proxyPrint.customImageSaveFailed")));
  };

  const handlePasteClipboard = async () => {
    try {
      const data = await navigator.clipboard.readText();
      handlePasteChange(data);
    } catch {
      toast.info(t("proxyPrint.clipboardEmpty"));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    let text = await file.text();
    try {
      text = await compactProxyDeckCustomImages(text);
    } catch {
      toast.error(t("proxyPrint.customImageSaveFailed"));
    }
    setDeckText(text);
    setFileName(file.name);
    setInputMode("file");
    if (!autoPreview) setSlots([]);
    variantOverridesRef.current.clear();
    if (file.name.toLowerCase().endsWith(".ydk")) {
      setCardSize("yugioh");
    }
    refreshDetection(text);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePreview = async () => {
    abortRef.current = new AbortController();
    setBusy(true);
    setProgress(0);
    setStatus(t("proxyPrint.resolving"));

    try {
      const resolved = await resolveSlotsFromApi();
      setStatus(t("proxyPrint.previewReady", { count: resolved.length }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus(t("proxyPrint.cancelled"));
        return;
      }
      toast.error(err instanceof Error ? err.message : t("proxyPrint.failed"));
      setStatus(t("proxyPrint.error"));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (!deckText.includes("data:image/")) return;
    let cancelled = false;
    void compactProxyDeckCustomImages(deckText)
      .then((compact) => {
        if (!cancelled) setDeckText(compact);
      })
      .catch(() => toast.error(t("proxyPrint.customImageSaveFailed")));
    return () => {
      cancelled = true;
    };
  }, [deckText, t]);

  useEffect(() => {
    if (!deckText.includes("@img:")) return;
    void preloadProxyDeckCustomImages(deckText);
  }, [deckText]);

  useEffect(() => {
    if (!autoPreview) return;
    const text = deckText.trim();
    if (!text) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const requestId = ++previewRequestRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setStatus(tRef.current("proxyPrint.resolving"));

      void fetchResolvedSlots(controller.signal)
        .then((resolved) => {
          if (cancelled || requestId !== previewRequestRef.current) return;
          commitPreviewSlots(resolved, requestId);
          setStatus(tRef.current("proxyPrint.previewReady", { count: resolved.length }));
        })
        .catch((err) => {
          if (cancelled || requestId !== previewRequestRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          toast.error(err instanceof Error ? err.message : tRef.current("proxyPrint.failed"));
          setStatus(tRef.current("proxyPrint.error"));
        })
        .finally(() => {
          if (requestId === previewRequestRef.current) {
            setBusy(false);
            abortRef.current = null;
          }
        });
    }, AUTO_PREVIEW_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoPreview, deckText, defaultGame, fetchResolvedSlots, commitPreviewSlots]);

  const handleGenerate = async () => {
    abortRef.current = new AbortController();
    setPdfBusy(true);
    setBusy(true);
    setProgress(0);

    try {
      let currentSlots = slots;
      if (!currentSlots.length) {
        setStatus(t("proxyPrint.resolving"));
        currentSlots = await resolveSlotsFromApi({ silent: true });
      }

      const imageUrls = (
        await hydrateProxySlotImageUrls(
          currentSlots.map((s) => ({ imageUrl: s.imageUrl }))
        )
      )
        .map((s) => s.imageUrl)
        .filter(Boolean) as string[];
      if (!imageUrls.length) {
        toast.warning(t("proxyPrint.needPreview"));
        return;
      }

      setProgressMax(imageUrls.length);
      setStatus(t("proxyPrint.buildingPdf"));

      const blob = await buildProxyPdf({
        imageUrls,
        cardSize,
        dpi: DEFAULT_PDF_DPI,
        cardsGlued,
        signal: abortRef.current.signal,
        onProgress: ({ current, total }) => {
          setProgress(current);
          setProgressMax(total);
        },
      });

      const stem = fileName?.replace(/\.[^.]+$/, "") ?? "proxies";
      const suffix = cardsGlued ? "_glued" : "_spaced";
      const filename = `${stem}${suffix}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(t("proxyPrint.done"));
      setStatus(t("proxyPrint.ready", { name: filename }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus(t("proxyPrint.cancelled"));
        return;
      }
      toast.error(err instanceof Error ? err.message : t("proxyPrint.failed"));
      setStatus(t("proxyPrint.error"));
    } finally {
      setBusy(false);
      setPdfBusy(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => abortRef.current?.abort();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <LoadingOverlay
        active={pdfBusy}
        fullscreen
        title={status || t("proxyPrint.generating")}
        description={
          progressMax > 0 ? `${Math.min(progress, progressMax)} / ${progressMax}` : undefined
        }
      />

      <div className="shrink-0 overflow-auto px-4 py-6 sm:px-8 sm:pb-4">
        <PageHeader title={t("proxyPrint.title")} description={t("proxyPrint.description")} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-4 pb-6 lg:flex-row lg:overflow-hidden lg:px-8 lg:pb-8">
        <div className="w-full shrink-0 space-y-5 lg:w-[min(100%,22rem)] lg:overflow-y-auto lg:pr-2 xl:w-96">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={inputMode === "paste" ? "default" : "outline"}
              size="sm"
              onClick={() => setInputMode("paste")}
            >
              {t("proxyPrint.modePaste")}
            </Button>
            <Button
              type="button"
              variant={inputMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setInputMode("file");
                fileRef.current?.click();
              }}
            >
              <FileUp className="mr-1.5 h-4 w-4" />
              {t("proxyPrint.modeFile")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".ydk,.txt"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>

          {inputMode === "paste" ? (
            <div className="space-y-2">
              <Label htmlFor="proxy-deck">{t("proxyPrint.pasteLabel")}</Label>
              <textarea
                id="proxy-deck"
                value={deckText}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={t("proxyPrint.pastePlaceholderNames")}
                rows={7}
                className={cn(
                  "flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePasteClipboard()}
                >
                  <ClipboardPaste className="mr-1.5 h-4 w-4" />
                  {t("proxyPrint.pasteClipboard")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeckText("");
                    variantOverridesRef.current.clear();
                    setSlots([]);
                    setStatus(t("proxyPrint.hint"));
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t("common.clear")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
              {fileName ? (
                <p>
                  <span className="text-muted-foreground">{t("proxyPrint.fileSelected")}: </span>
                  <span className="font-medium">{fileName}</span>
                </p>
              ) : (
                <p className="text-muted-foreground">{t("proxyPrint.pickFile")}</p>
              )}
            </div>
          )}

          {isMixedDeck ? (
            <p className="text-xs text-muted-foreground">{t("proxyPrint.mixedDeckHint")}</p>
          ) : null}

          <div className="space-y-2">
            <Label>{t("proxyPrint.cardSize")}</Label>
            <div className="flex flex-col gap-2">
              {(["yugioh", "bandai"] as CardSizePreset[]).map((preset) => (
                <label
                  key={preset}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    cardSize === preset ? "border-primary bg-primary/5" : "border-border/60"
                  )}
                >
                  <input
                    type="radio"
                    name="card-size"
                    className="sr-only"
                    checked={cardSize === preset}
                    onChange={() => setCardSize(preset)}
                  />
                  {preset === "yugioh" ? t("proxyPrint.sizeYgo") : t("proxyPrint.sizeBandai")}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("proxyPrint.spacing")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={cardsGlued ? "default" : "outline"}
                size="sm"
                onClick={() => setCardsGlued(true)}
              >
                {t("proxyPrint.spacingGlued")}
              </Button>
              <Button
                type="button"
                variant={!cardsGlued ? "default" : "outline"}
                size="sm"
                onClick={() => setCardsGlued(false)}
              >
                {t("proxyPrint.spacingSeparated")}
              </Button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoPreview}
              onChange={(e) => setAutoPreview(e.target.checked)}
              className="rounded border-input"
            />
            {t("proxyPrint.autoPreview")}
          </label>

          <p className="text-xs text-muted-foreground">{preview}</p>
          <p className="text-xs text-muted-foreground">{t("proxyPrint.syntaxHint")}</p>
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handlePreview()}
            >
              <Eye className="mr-2 h-4 w-4" />
              {t("proxyPrint.preview")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleGenerate()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("proxyPrint.generate")}
            </Button>
            {busy ? (
              <Button type="button" variant="ghost" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">{t("proxyPrint.printHint")}</p>
        </div>

        <div className="relative flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-zinc-950 via-zinc-900/95 to-background p-2 sm:p-3 lg:min-h-0">
          {busy && !pdfBusy && !hasPreview ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>{status || t("proxyPrint.resolving")}</p>
            </div>
          ) : hasPreview ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {busy && !pdfBusy ? (
                <div className="mb-2 flex shrink-0 items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>{status || t("proxyPrint.resolving")}</span>
                </div>
              ) : null}
              <ProxyBinderPreview
                slots={slots}
                spreadIndex={spreadIndex}
                onSpreadChange={setSpreadIndex}
                onSlotUpdate={handleSlotUpdate}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>{t("proxyPrint.previewEmpty")}</p>
              <p className="text-xs">{t("proxyPrint.previewEmptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

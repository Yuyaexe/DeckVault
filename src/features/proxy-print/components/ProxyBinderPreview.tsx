"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { isInlineImageUrl, previewImageSrc, resolvePreviewImageSrc } from "@/lib/proxy-print/preview-image";
import {
  CARDS_PER_PAGE,
  SLOTS_PER_SPREAD,
  type ProxyCardVariant,
  type ProxyPrintSlot,
} from "@/lib/proxy-print/types";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type SlotUpdate = {
  imageUrl: string;
  selectedVariantKey: string | null;
  rarity: string | null;
  setLine: string | null;
  variantLabel?: string | null;
};

interface ProxyBinderPreviewProps {
  slots: ProxyPrintSlot[];
  spreadIndex: number;
  onSpreadChange: (index: number) => void;
  onSlotUpdate?: (slotId: string, update: SlotUpdate, sourceQuery: string | null) => void;
}

function variantFields(variant: ProxyCardVariant): SlotUpdate {
  return {
    imageUrl: variant.imageUrl,
    selectedVariantKey: variant.key,
    rarity: variant.rarity,
    setLine: [variant.setName, variant.setCode].filter(Boolean).join(" · ") || null,
    variantLabel: variant.label,
  };
}

function cycleVariant(slot: ProxyPrintSlot): SlotUpdate | null {
  if (slot.variants.length <= 1) return null;
  const idx = Math.max(
    0,
    slot.variants.findIndex((v) => v.key === slot.selectedVariantKey)
  );
  const next = slot.variants[(idx + 1) % slot.variants.length];
  return variantFields(next);
}

const BinderThumb = memo(function BinderThumb({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() =>
    src ? previewImageSrc(src) : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedSrc(src ? previewImageSrc(src) : null);

    void resolvePreviewImageSrc(src).then((next) => {
      if (!cancelled) setResolvedSrc(next);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolvedSrc || failed) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/40 px-1 text-center text-[10px] text-muted-foreground">
        {alt}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-contain p-0.5"
      onError={() => setFailed(true)}
    />
  );
});

const BinderSlot = memo(function BinderSlot({
  slot,
  onEdit,
  onCycle,
}: {
  slot: ProxyPrintSlot;
  onEdit: () => void;
  onCycle: () => void;
}) {
  const t = useT();
  const hasVariants = slot.variants.length > 1;

  return (
    <div className="group flex min-h-0 flex-col gap-0.5">
      <div
        className={cn(
          "relative min-h-0 w-full flex-1 overflow-hidden rounded-md bg-stone-900/10 shadow-sm ring-1 ring-stone-900/10",
          "dark:bg-stone-950/40 dark:ring-stone-100/10"
        )}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={onCycle}
          aria-label={hasVariants ? t("proxyPrint.cycleVariant") : slot.name}
          title={slot.setLine ?? slot.name}
        />
        <BinderThumb src={slot.imageUrl} alt={slot.name} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-0.5 p-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {hasVariants ? (
            <span className="rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/90">
              <Layers className="inline h-2.5 w-2.5" />
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-5 w-5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={t("proxyPrint.customImage")}
          >
            <ImagePlus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "flex w-full shrink-0 flex-col gap-0 rounded-md bg-zinc-900/90 px-1 py-0.5 text-left ring-1 ring-white/5",
          "dark:bg-zinc-950/90"
        )}
      >
        <div className="flex items-center gap-1">
          {slot.rarity ? (
            <RarityBadge rarity={slot.rarity} gameSlug={slot.game} size="sm" />
          ) : (
            <span className="h-3 w-4" />
          )}
          <p className="min-w-0 flex-1 truncate text-[8px] font-medium leading-tight text-white/80">
            {slot.name}
          </p>
        </div>
      </div>
    </div>
  );
});

function BinderPage({
  pageSlots,
  side,
  onSlotEdit,
  onSlotCycle,
}: {
  pageSlots: (ProxyPrintSlot | null)[];
  side: "left" | "right";
  onSlotEdit: (slot: ProxyPrintSlot) => void;
  onSlotCycle: (slot: ProxyPrintSlot) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col p-1.5 sm:p-2",
        "bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/90",
        "dark:from-stone-800 dark:via-stone-900 dark:to-stone-950",
        side === "left"
          ? "rounded-t-xl md:rounded-l-2xl md:rounded-tr-none"
          : "rounded-b-xl md:rounded-r-2xl md:rounded-bl-none"
      )}
    >
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-1 sm:gap-1.5">
        {pageSlots.map((slot, index) => {
          if (!slot) {
            return (
              <div
                key={`empty-${side}-${index}`}
                className="flex min-h-0 flex-col gap-0.5 rounded-md border border-dashed border-stone-400/25 bg-stone-500/5 dark:border-stone-600/30 dark:bg-stone-950/20"
              />
            );
          }
          return (
            <BinderSlot
              key={slot.slotId}
              slot={slot}
              onEdit={() => onSlotEdit(slot)}
              onCycle={() => onSlotCycle(slot)}
            />
          );
        })}
      </div>
    </div>
  );
}

export const ProxyBinderPreview = memo(function ProxyBinderPreview({
  slots,
  spreadIndex,
  onSpreadChange,
  onSlotUpdate,
}: ProxyBinderPreviewProps) {
  const t = useT();
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [draftVariantKey, setDraftVariantKey] = useState<string | null>(null);

  const editSlot = slots.find((s) => s.slotId === editSlotId) ?? null;

  const emitSlotUpdate = useCallback(
    (slot: ProxyPrintSlot, update: SlotUpdate) => {
      onSlotUpdate?.(slot.slotId, update, slot.sourceQuery);
    },
    [onSlotUpdate]
  );

  useEffect(() => {
    if (!editSlot) return;
    setDraftVariantKey(editSlot.selectedVariantKey);
    setUrlDraft(editSlot.imageUrl?.startsWith("blob:") ? "" : (editSlot.imageUrl ?? ""));
  }, [editSlot, editSlotId]);

  const activeVariantLabel =
    editSlot?.variants.find((v) => v.key === draftVariantKey)?.label ??
    editSlot?.variantLabel ??
    editSlot?.name;

  const totalSpreads = Math.max(1, Math.ceil(slots.length / SLOTS_PER_SPREAD));
  const spreadStart = spreadIndex * SLOTS_PER_SPREAD;
  const spreadSlots = slots.slice(spreadStart, spreadStart + SLOTS_PER_SPREAD);

  const leftPage: (ProxyPrintSlot | null)[] = Array.from({ length: CARDS_PER_PAGE }, (_, i) =>
    spreadSlots[i] ?? null
  );
  const rightPage: (ProxyPrintSlot | null)[] = Array.from({ length: CARDS_PER_PAGE }, (_, i) =>
    spreadSlots[i + CARDS_PER_PAGE] ?? null
  );

  const onSpread = spreadSlots.filter(Boolean).length;

  const openEdit = useCallback((slot: ProxyPrintSlot) => {
    setEditSlotId(slot.slotId);
    setDraftVariantKey(slot.selectedVariantKey);
    setUrlDraft(slot.imageUrl?.startsWith("blob:") ? "" : (slot.imageUrl ?? ""));
  }, []);

  const closeEdit = useCallback(() => {
    setEditSlotId(null);
    setDraftVariantKey(null);
    setUrlDraft("");
  }, []);

  const handleSave = useCallback(() => {
    if (!editSlot || !onSlotUpdate) return;

    const url = urlDraft.trim();
    const matchedVariant = draftVariantKey
      ? editSlot.variants.find((v) => v.key === draftVariantKey)
      : null;

    if (matchedVariant && matchedVariant.imageUrl === url) {
      emitSlotUpdate(editSlot, variantFields(matchedVariant));
    } else if (isInlineImageUrl(url)) {
      emitSlotUpdate(editSlot, {
        imageUrl: url,
        selectedVariantKey: "custom",
        rarity: editSlot.rarity,
        setLine: editSlot.setLine,
      });
    }

    closeEdit();
  }, [closeEdit, draftVariantKey, editSlot, emitSlotUpdate, onSlotUpdate, urlDraft]);

  const applyCustomImage = useCallback(
    (imageUrl: string) => {
      if (!editSlot || !onSlotUpdate) return;
      emitSlotUpdate(editSlot, {
        imageUrl,
        selectedVariantKey: "custom",
        rarity: editSlot.rarity,
        setLine: editSlot.setLine,
      });
      closeEdit();
    },
    [closeEdit, editSlot, emitSlotUpdate, onSlotUpdate]
  );

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          applyCustomImage(reader.result);
        }
      };
      reader.onerror = () => {
        applyCustomImage(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    },
    [applyCustomImage]
  );

  const handleSlotCycle = useCallback(
    (slot: ProxyPrintSlot) => {
      if (!onSlotUpdate) return;
      const next = cycleVariant(slot);
      if (next) emitSlotUpdate(slot, next);
    },
    [emitSlotUpdate, onSlotUpdate]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{t("proxyPrint.binderPreview")}</span>
        <span className="tabular-nums">
          {t("proxyPrint.spreadCount", { onSpread, total: slots.length })}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="flex h-full min-h-[360px] w-full flex-col rounded-xl shadow-2xl ring-1 ring-black/20 md:min-h-0 md:flex-row md:rounded-2xl">
          <BinderPage
            pageSlots={leftPage}
            side="left"
            onSlotEdit={openEdit}
            onSlotCycle={handleSlotCycle}
          />
          <div
            className="relative h-2 w-full shrink-0 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 md:h-auto md:w-3 md:bg-gradient-to-b lg:w-4"
            aria-hidden
          />
          <BinderPage
            pageSlots={rightPage}
            side="right"
            onSlotEdit={openEdit}
            onSlotCycle={handleSlotCycle}
          />
        </div>
      </div>

      {totalSpreads > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={spreadIndex === 0}
            onClick={() => onSpreadChange(spreadIndex - 1)}
            aria-label={t("binder.previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("binder.pageOf", { current: spreadIndex + 1, total: totalSpreads })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={spreadIndex >= totalSpreads - 1}
            onClick={() => onSpreadChange(spreadIndex + 1)}
            aria-label={t("binder.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={Boolean(editSlot)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("proxyPrint.customImageTitle")}</DialogTitle>
            <DialogDescription>{activeVariantLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editSlot && editSlot.variants.length > 1 ? (
              <div className="space-y-2">
                <Label>{t("proxyPrint.pickVariant")}</Label>
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                  {editSlot.variants.map((variant) => (
                    <Button
                      key={variant.key}
                      type="button"
                      variant={draftVariantKey === variant.key ? "default" : "outline"}
                      size="sm"
                      className="h-auto justify-start whitespace-normal py-2 text-left text-xs"
                      onClick={() => {
                        setDraftVariantKey(variant.key);
                        setUrlDraft(variant.imageUrl);
                        if (editSlot) emitSlotUpdate(editSlot, variantFields(variant));
                      }}
                    >
                      {variant.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="proxy-custom-url">{t("proxyPrint.customImageUrl")}</Label>
              <Input
                id="proxy-custom-url"
                value={urlDraft}
                onChange={(e) => {
                  setUrlDraft(e.target.value);
                  setDraftVariantKey(null);
                }}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-custom-file">{t("proxyPrint.customImageFile")}</Label>
              <Input
                id="proxy-custom-file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEdit}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!isInlineImageUrl(urlDraft.trim())}
              onClick={handleSave}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

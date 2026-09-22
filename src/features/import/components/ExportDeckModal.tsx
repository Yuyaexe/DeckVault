"use client";

import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PURCHASED_CARDS_QUERY_KEY } from "@/hooks/usePurchasedCardMatch";
import { fetchPurchasedCards } from "@/lib/purchases/fetch";
import { hasCompletePurchaseCoverage } from "@/lib/purchases/types";
import { buildPurchasedCardIndex, isCardPurchased } from "@/lib/purchases/match";
import { Copy, Download } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import {
  EXPORT_FORMAT_LABELS,
  buildCollectionDecklistContent,
  exportCollectionDecklist,
  getAvailableExportFormats,
  type DeckExportFormat,
} from "@/features/import/services/decklist-export";
import type { DemoOwnedCard } from "@/lib/demo/types";
import { useT } from "@/lib/i18n/context";
import { toast } from "sonner";

interface ExportDeckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: DemoOwnedCard[];
  collectionName: string;
  title?: string;
  description?: string;
}

export function ExportDeckModal({
  open,
  onOpenChange,
  cards,
  collectionName,
  title,
  description,
}: ExportDeckModalProps) {
  const t = useT();
  const unpurchasedOnlyId = useId();
  const [unpurchasedOnly, setUnpurchasedOnly] = useState(false);
  const purchases = useQuery({
    queryKey: PURCHASED_CARDS_QUERY_KEY,
    queryFn: fetchPurchasedCards,
    staleTime: 5 * 60_000,
    enabled: open && unpurchasedOnly,
  });
  const exportCards = useMemo(() => {
    if (!unpurchasedOnly) return cards;
    const index = buildPurchasedCardIndex(purchases.data?.cards ?? []);
    return cards.filter((entry) => !isCardPurchased(entry.card, index));
  }, [cards, unpurchasedOnly, purchases.data]);
  const totalQuantity = cards.reduce((total, entry) => total + entry.quantity, 0);
  const exportQuantity = exportCards.reduce((total, entry) => total + entry.quantity, 0);
  const purchasesIncomplete = !hasCompletePurchaseCoverage(purchases.data);
  const purchasesUnavailable = unpurchasedOnly &&
    (purchases.isFetching || purchases.isPending || purchases.isError || purchasesIncomplete);
  const canExport = exportCards.length > 0 && !purchasesUnavailable;
  const gameSlug = exportCards[0]?.card.gameSlug;
  const formats = useMemo(
    () => getAvailableExportFormats(exportCards, gameSlug),
    [exportCards, gameSlug]
  );
  const [selectedFormat, setFormat] = useState<DeckExportFormat>("decklist");
  const format = formats.includes(selectedFormat) ? selectedFormat : "decklist";

  const handleExport = () => {
    if (!canExport) return;
    try {
      exportCollectionDecklist(exportCards, unpurchasedOnly ? `${collectionName}_unpurchased` : collectionName, format, gameSlug);
      toast.success(t("export.success"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("export.failed"));
    }
  };

  const handleCopy = async () => {
    if (!canExport) return;
    if (format === "csv") {
      toast.error(t("export.copyCsvHint"));
      return;
    }
    try {
      const content = buildCollectionDecklistContent(exportCards, format, gameSlug);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error(t("export.copyFailed"));
      }
      toast.success(t("export.copied"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("export.copyFailed"));
    }
  };

  const previewContent = useMemo(() => {
    if (!open || format === "csv" || !canExport) return null;
    try {
      return buildCollectionDecklistContent(exportCards, format, gameSlug);
    } catch {
      return null;
    }
  }, [open, format, exportCards, gameSlug, canExport]);

  const formatHint = useMemo(() => {
    if (format === "decklist") {
      return gameSlug === "digimon"
        ? t("export.hintDecklistDigimon")
        : t("export.hintDecklistDefault");
    }
    if (format === "ydke") return t("export.hintYdke");
    if (format === "ydk") return t("export.hintYdk");
    if (format === "csv") return t("export.hintCsv");
    return "";
  }, [format, gameSlug, t]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t("export.title")}
      description={description ?? t("export.description")}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {format !== "csv" && (
            <Button
              variant="outline"
              onClick={() => void handleCopy()}
              disabled={!canExport || !previewContent}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t("export.copy")}
            </Button>
          )}
          <Button onClick={handleExport} disabled={!canExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("export.download")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={unpurchasedOnlyId}
              checked={unpurchasedOnly}
              onCheckedChange={(checked) => setUnpurchasedOnly(checked === true)}
            />
            <Label htmlFor={unpurchasedOnlyId} className="cursor-pointer">
              {t("export.unpurchasedOnly")}
            </Label>
          </div>
          <div className="text-sm text-muted-foreground" role="status">
              {unpurchasedOnly && (purchases.isPending || purchases.isFetching) ? t("purchases.loading") : unpurchasedOnly && (purchases.isError || purchasesIncomplete) ? (
                <>
                  {t(purchases.isError ? "export.purchasesFailed" : "export.purchasesIncomplete")}
                  <Button type="button" variant="ghost" size="sm" onClick={() => void purchases.refetch()} disabled={purchases.isFetching}>
                    {t("export.retryPurchases")}
                  </Button>
                </>
              ) : (
                <>
                  <p>{t("export.cardCount", { count: exportQuantity, total: totalQuantity })}</p>
                  {unpurchasedOnly && exportCards.length === 0 && (
                    <p className="mt-1 text-xs">{t("export.noUnpurchased")}</p>
                  )}
                </>
              )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("export.format")}</Label>
          <ResponsiveSelect
            preferNative
            value={format}
            onValueChange={(v) => setFormat(v as DeckExportFormat)}
            options={formats.map((value) => ({
              value,
              label: EXPORT_FORMAT_LABELS[value],
            }))}
          />
        </div>

        <p className="text-xs text-muted-foreground">{formatHint}</p>

        {previewContent && (
          <pre className="max-w-full max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
            {previewContent}
          </pre>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
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
  const gameSlug = cards[0]?.card.gameSlug;
  const formats = useMemo(
    () => getAvailableExportFormats(cards, gameSlug),
    [cards, gameSlug]
  );
  const [format, setFormat] = useState<DeckExportFormat>("decklist");

  const handleExport = () => {
    try {
      exportCollectionDecklist(cards, collectionName, format, gameSlug);
      toast.success(t("export.success"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("export.failed"));
    }
  };

  const handleCopy = async () => {
    if (format === "csv") {
      toast.error(t("export.copyCsvHint"));
      return;
    }
    try {
      const content = buildCollectionDecklistContent(cards, format, gameSlug);
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
    if (!open || format === "csv" || cards.length === 0) return null;
    try {
      return buildCollectionDecklistContent(cards, format, gameSlug);
    } catch {
      return null;
    }
  }, [open, format, cards, gameSlug]);

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
              disabled={cards.length === 0 || !previewContent}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t("export.copy")}
            </Button>
          )}
          <Button onClick={handleExport} disabled={cards.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            {t("export.download")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
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

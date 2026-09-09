"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardImage } from "@/components/shared/CardImage";
import { RarityBadge } from "@/components/shared/RarityBadge";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import type { CardPrintVariant } from "@/features/catalog/services/card-api/variants";
import type { QuickAddGameSlug } from "@/features/collection/utils/quick-add-games";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

interface QuickAddVariantPickerProps {
  pendingCard: CardSearchResult;
  gameSlug: QuickAddGameSlug;
  previewImage: string | null | undefined;
  previewVariant: CardPrintVariant | null;
  previewKey: string | null;
  rarityFilter: string;
  rarityOptions: string[];
  filteredVariants: CardPrintVariant[];
  onBack: () => void;
  onRarityFilterChange: (value: string) => void;
  onPreviewKeyChange: (key: string) => void;
  onVariantPick: (variant: CardPrintVariant) => void;
}

/** Print / rarity picker shown after selecting a card in Quick Add. */
export function QuickAddVariantPicker({
  pendingCard,
  gameSlug,
  previewImage,
  previewVariant,
  previewKey,
  rarityFilter,
  rarityOptions,
  filteredVariants,
  onBack,
  onRarityFilterChange,
  onPreviewKeyChange,
  onVariantPick,
}: QuickAddVariantPickerProps) {
  const t = useT();

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        {t("quickAdd.backToSearch")}
      </Button>

      <div className="flex flex-col gap-5 md:flex-row md:gap-6">
        <div className="flex shrink-0 flex-col items-center md:w-[168px]">
          <CardImage
            src={previewImage}
            alt={pendingCard.name}
            width={152}
            height={222}
            className="rounded-lg object-contain shadow-lg ring-1 ring-border/40"
          />
          <p className="mt-3 text-center text-sm font-semibold leading-tight">
            {pendingCard.name}
          </p>
          {previewVariant && (
            <div className="mt-2">
              <RarityBadge rarity={previewVariant.rarity} gameSlug={gameSlug} size="md" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {rarityOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onRarityFilterChange("all")}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  rarityFilter === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {t("quickAdd.allRarities")}
              </button>
              {rarityOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRarityFilterChange(r)}
                  className={cn(
                    "rounded-md border p-0.5 transition-colors",
                    rarityFilter === r
                      ? "border-primary ring-1 ring-primary/40"
                      : "border-transparent hover:border-border/60"
                  )}
                  title={r}
                >
                  <RarityBadge rarity={r} gameSlug={gameSlug} size="md" />
                </button>
              ))}
            </div>
          )}

          <ScrollArea className="h-[340px] pr-2">
            <div className="space-y-1">
              {filteredVariants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  onMouseEnter={() => onPreviewKeyChange(variant.key)}
                  onFocus={() => onPreviewKeyChange(variant.key)}
                  onClick={() => onVariantPick(variant)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50",
                    previewKey === variant.key
                      ? "border-primary/50 bg-muted/30"
                      : "border-border/60"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <RarityBadge rarity={variant.rarity} gameSlug={gameSlug} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {variant.setName ?? t("quickAdd.unknownSet")}
                        {variant.variantLabel ? ` · ${variant.variantLabel}` : ""}
                      </p>
                      {(variant.collectorNumber ?? variant.setCode) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {variant.collectorNumber ?? variant.setCode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </button>
              ))}
              {filteredVariants.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("quickAdd.noPrintsForRarity")}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

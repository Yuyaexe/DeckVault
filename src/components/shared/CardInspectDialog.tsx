"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { MOBILE_DIALOG_SHEET } from "@/lib/ui/mobile-dialog";
import { CardImage } from "@/components/shared/CardImage";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import { buildMarketplaceListings } from "@/features/market/services/marketplace";
import { isApiSupported } from "@/features/catalog/services/card-api";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import { CARD_CONDITIONS, CARD_LANGUAGES, CONDITION_LABELS } from "@/types/tcg";
import type { Currency } from "@/types/tcg";
import type { DemoOwnedCard } from "@/lib/demo/types";
import { useAppData } from "@/hooks/useAppData";
import { cn } from "@/lib/utils";
import { resolveCardDisplayImage } from "@/lib/cards/preview-image";
import { useYugiohPasscodeForDisplay } from "@/hooks/useYugiohPasscodeForDisplay";
import { useYugiohCardImageRepair } from "@/hooks/useYugiohCardImageRepair";
import { buildYgoImageUrl } from "@/lib/yugioh/urls";
import { resolveCardTraderProductUrl } from "@/lib/cardtrader";
import { fetchCardTraderManaSearchUrl } from "@/features/market/hooks/useCardTraderPrices";
import { fetchYugiohOwnedCardDetail } from "@/lib/yugioh/lookup";
import { useT, useLocale } from "@/lib/i18n/context";

export type CardInspectTab = "details" | "marketplace";

export type OwnedCardUpdates = Partial<Omit<DemoOwnedCard, "card">> & {
  card?: Partial<DemoOwnedCard["card"]>;
};

interface CardInspectDialogProps {
  card: DemoOwnedCard | null;
  open: boolean;
  tab?: CardInspectTab;
  onOpenChange: (open: boolean) => void;
  currency: Currency;
  onUpdate?: (id: string, updates: OwnedCardUpdates) => void;
  onDelete?: (ids: string[]) => void;
}

interface CardDetailResponse {
  result: CardSearchResult | null;
  relatedPrints: CardSearchResult[];
}

async function fetchCardDetail(
  externalId: string,
  gameSlug: string
): Promise<CardDetailResponse> {
  const res = await fetch(
    `/api/cards/detail?id=${encodeURIComponent(externalId)}&game=${encodeURIComponent(gameSlug)}`
  );
  if (!res.ok) return { result: null, relatedPrints: [] };
  return res.json();
}

async function fetchCardDetailForOwned(
  card: DemoOwnedCard["card"]
): Promise<CardDetailResponse> {
  if (card.gameSlug === "yugioh") {
    const resolved = await fetchYugiohOwnedCardDetail({
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      externalId: card.externalId,
    });
    if (resolved.result) {
      return { result: resolved.result, relatedPrints: resolved.relatedPrints ?? [] };
    }
  }

  if (card.externalId && isApiSupported(card.gameSlug)) {
    return fetchCardDetail(card.externalId, card.gameSlug);
  }

  return { result: null, relatedPrints: [] };
}

export function CardInspectDialog({
  card,
  open,
  tab = "details",
  onOpenChange,
  currency: _currency,
  onUpdate,
  onDelete,
}: CardInspectDialogProps) {
  const t = useT();
  const locale = useLocale();
  const { updateOwnedCard: defaultUpdate, deleteOwnedCards: defaultDelete } = useAppData();
  const updateOwnedCard = onUpdate ?? defaultUpdate;
  const deleteOwnedCards = onDelete ?? defaultDelete;
  const marketplaceRef = useRef<HTMLDivElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const confirmDelete = () => {
    if (!card) return;
    void deleteOwnedCards([card.id]);
    setDeleteConfirmOpen(false);
    onOpenChange(false);
  };

  const { data: cardDetailData } = useQuery({
    queryKey: ["card-detail", card?.id, card?.card.name, card?.card.externalId, card?.card.gameSlug],
    queryFn: () => fetchCardDetailForOwned(card!.card),
    enabled: open && !!card && isApiSupported(card.card.gameSlug),
    staleTime: 10 * 60 * 1000,
  });

  const cardDetail = cardDetailData?.result ?? null;

  const cardTraderFallbackUrl = useMemo(() => {
    if (!card) return null;
    return resolveCardTraderProductUrl({
      name: card.card.name,
      gameSlug: card.card.gameSlug,
      externalId: card.card.externalId,
      cardTraderBlueprintId: card.card.cardTraderBlueprintId,
      setName: card.card.setName,
      setCode: card.card.setCode,
      rarity: card.card.rarity,
      imageUrl: card.card.imageUrl,
    });
  }, [card]);

  const { data: cardTraderProductUrl } = useQuery({
    queryKey: [
      "cardtrader-url",
      card?.id,
      card?.card.cardTraderBlueprintId,
      card?.card.externalId,
      card?.card.imageUrl,
      card?.card.name,
    ],
    queryFn: () => fetchCardTraderManaSearchUrl(card!),
    enabled: open && !!card,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const ygoPasscode = useYugiohPasscodeForDisplay(
    card?.card ?? {
      name: "",
      gameSlug: "yugioh",
      externalId: null,
      imageUrl: null,
      setCode: null,
      collectorNumber: null,
    },
    card?.id
  );

  useYugiohCardImageRepair(
    card?.id,
    card?.card ?? { gameSlug: "yugioh", externalId: null, imageUrl: null, rarity: null },
    ygoPasscode ?? null
  );

  useEffect(() => {
    if (open && tab === "marketplace") {
      marketplaceRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [open, tab]);

  if (!card) return null;

  let displayImage: string | null = null;
  if (card.card.gameSlug === "yugioh") {
    if (ygoPasscode === undefined) {
      displayImage = null;
    } else if (ygoPasscode) {
      displayImage =
        buildYgoImageUrl(ygoPasscode, "full") ??
        resolveCardDisplayImage(card.card, {
          detailImage: cardDetail?.imageUrl,
          detailPasscode: ygoPasscode,
        });
    } else {
      displayImage = resolveCardDisplayImage(card.card, {
        detailImage: cardDetail?.imageUrl,
        detailPasscode: null,
      });
    }
  } else {
    displayImage = resolveCardDisplayImage(card.card, {
      detailImage: cardDetail?.imageUrl,
      detailPasscode: ygoPasscode ?? null,
    });
  }

  const listings = buildMarketplaceListings(card.card, {
    cardTraderUrl: cardTraderProductUrl ?? cardTraderFallbackUrl,
  });

  const ygoImageLoading = card.card.gameSlug === "yugioh" && ygoPasscode === undefined;
  const ygoImageFallback =
    ygoPasscode != null ? buildYgoImageUrl(ygoPasscode, "full") : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        lang={locale === "pt-BR" ? "pt-BR" : "en"}
        className={cn(
          "gap-0 overflow-x-hidden p-0",
          MOBILE_DIALOG_SHEET,
          "max-sm:pt-12 max-sm:[&>button]:top-3 max-sm:[&>button]:right-3",
          "sm:fixed sm:inset-auto sm:left-[50%] sm:top-[50%] sm:grid sm:max-h-[min(90dvh,100%)] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:overflow-y-auto sm:rounded-xl md:max-w-4xl"
        )}
      >
        <DialogTitle className="sr-only">{card.card.name}</DialogTitle>

        <div className="flex min-w-0 max-w-full flex-col md:max-h-[85dvh] md:flex-row md:overflow-hidden">
          <section className="w-full min-w-0 max-w-full shrink-0 border-b border-border/60 bg-muted/20 md:w-[220px] md:border-b-0 md:border-r">
            <div className="flex flex-col items-center gap-3 px-4 py-4 md:items-stretch md:p-6">
              <div className="relative h-[168px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-muted/40 shadow-lg ring-1 ring-border/40 md:h-[224px] md:w-[160px]">
                {ygoImageLoading ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <CardImage
                    src={displayImage}
                    alt={card.card.name}
                    fill
                    sizes="(max-width: 768px) 120px, 160px"
                    fallbackSrc={ygoImageFallback}
                    useLocalCache
                    className="object-contain p-0.5"
                  />
                )}
              </div>
              <div className="w-full min-w-0 text-center md:text-left">
                <h2 className="text-base font-semibold leading-snug break-words md:text-lg">
                  {card.card.name}
                </h2>
                <dl className="mt-3 grid w-full grid-cols-1 gap-2 text-sm">
                  <div className="rounded-md bg-background/70 px-3 py-2 text-left">
                    <dt className="text-xs text-muted-foreground">{t("inspect.number")}</dt>
                    <dd className="mt-0.5 font-medium leading-snug break-all">
                      {card.card.collectorNumber ?? card.card.setCode ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:overflow-y-auto md:p-6">
            <div ref={marketplaceRef} className="min-w-0 w-full max-w-full space-y-3">
              <h3 className="text-sm font-semibold">{t("inspect.market")}</h3>
              <div className="space-y-2">
                {listings.map((listing) => (
                  <a
                    key={listing.source}
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full max-w-full flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4 md:py-3"
                  >
                    <span className="text-sm font-medium leading-snug break-words">
                      {listing.name}
                      {listing.primary && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                          {t("common.primary")}
                        </span>
                      )}
                    </span>
                    <div className="flex w-full items-center justify-between gap-2 md:w-auto md:shrink-0 md:justify-end">
                      <span className="text-xs text-muted-foreground">{t("inspect.open")}</span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="min-w-0 w-full max-w-full space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-2">
                <Label>{t("inspect.quantity")}</Label>
                <QuantityStepper
                  value={card.quantity}
                  onChange={(quantity) => {
                    if (quantity < 1) {
                      setDeleteConfirmOpen(true);
                      return;
                    }
                    updateOwnedCard(card.id, { quantity });
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("inspect.condition")}</Label>
                  <ResponsiveSelect
                    preferNative
                    value={card.condition}
                    onValueChange={(v) =>
                      updateOwnedCard(card.id, { condition: v as typeof card.condition })
                    }
                    options={CARD_CONDITIONS.map((c) => ({
                      value: c,
                      label: CONDITION_LABELS[c],
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">{t("inspect.language")}</Label>
                  <ResponsiveSelect
                    preferNative
                    value={card.language}
                    onValueChange={(v) =>
                      updateOwnedCard(card.id, { language: v as typeof card.language })
                    }
                    options={CARD_LANGUAGES.map((l) => ({ value: l, label: l }))}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>

    <Modal
      open={deleteConfirmOpen}
      onOpenChange={setDeleteConfirmOpen}
      title={t("inspect.deleteTitle")}
      description={t("inspect.deleteDescription", { name: card.card.name })}
      footer={
        <>
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            {t("common.delete")}
          </Button>
        </>
      }
    >
      <span className="sr-only">{t("inspect.deleteTitle")}</span>
    </Modal>
    </>
  );
}

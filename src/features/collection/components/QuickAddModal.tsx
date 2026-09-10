"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { SearchBar } from "@/components/shared/SearchBar";
import { CardImage } from "@/components/shared/CardImage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { MOBILE_DIALOG_FULL } from "@/lib/ui/mobile-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAppData } from "@/hooks/useAppData";
import { NO_ACTIVE_COLLECTION } from "@/lib/data/collection-requirements";
import { isQuickAddSupported } from "@/features/catalog/services/card-api";
import { QUICK_ADD_GAMES, getQuickAddGame, type QuickAddGameSlug } from "@/features/collection/utils/quick-add-games";
import { fetchYugiohCardByName } from "@/lib/yugioh/lookup";
import { resolveYugiohPasscode } from "@/lib/yugioh/passcode";
import { buildYgoImageUrl, pickYgoImageSizeForRarity } from "@/lib/yugioh/urls";
import {
  applyVariant,
  getSearchResultVariants,
  mergeYugiohSearchResults,
  type CardPrintVariant,
} from "@/features/catalog/services/card-api/variants";
import { digimonNamesMatch } from "@/features/catalog/services/card-api/digimon.utils";
import type { CardSearchResult, CatalogSearchLocale } from "@/features/catalog/services/card-api/types";
import {
  readSearchLocale,
  SEARCH_LOCALE_OPTIONS,
  writeSearchLocale,
} from "@/features/catalog/utils/search-locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/context";
import { QuickAddVariantPicker } from "@/features/collection/components/QuickAddVariantPicker";
import {
  EMPTY_YGO_ADVANCED_FILTERS,
  hasActiveYgoAdvancedFilters,
  type YugiohAdvancedSearchFilters,
} from "@/lib/yugioh/advanced-search";

function searchResultKey(result: CardSearchResult): string {
  return `${result.externalId}-${result.name}`;
}

const YugiohAdvancedSearchPanel = dynamic(
  () =>
    import("@/features/catalog/components/YugiohAdvancedSearchPanel").then(
      (m) => m.YugiohAdvancedSearchPanel
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (
    result: CardSearchResult,
    game: { id: string; slug: string; name: string }
  ) => void | Promise<void>;
  title?: string;
  defaultGameSlug?: QuickAddGameSlug;
  closeOnAdd?: boolean;
}

const SEARCH_DEBOUNCE_MS = 120;

const GAME_SELECT_OPTIONS = QUICK_ADD_GAMES.map((g) => ({
  value: g.slug,
  label: g.name,
}));

export function QuickAddModal({
  open,
  onOpenChange,
  onAdd,
  title,
  defaultGameSlug,
  closeOnAdd = true,
}: QuickAddModalProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pendingCard, setPendingCard] = useState<CardSearchResult | null>(null);
  const [rarityFilter, setRarityFilter] = useState("all");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
  const [selectedGameSlug, setSelectedGameSlug] = useState<QuickAddGameSlug>(
    defaultGameSlug ?? QUICK_ADD_GAMES[0]?.slug ?? "yugioh"
  );
  const [selectedPokemonSet, setSelectedPokemonSet] = useState("all");
  const [searchLocale, setSearchLocale] = useState<CatalogSearchLocale>("en");
  const [searchErrorDetail, setSearchErrorDetail] = useState<string | null>(null);
  const [ygoSearchMode, setYgoSearchMode] = useState<"simple" | "advanced">("simple");
  const [ygoAdvancedFilters, setYgoAdvancedFilters] =
    useState<YugiohAdvancedSearchFilters>(EMPTY_YGO_ADVANCED_FILTERS);
  const [advancedSearchNonce, setAdvancedSearchNonce] = useState(0);
  const [mobileAdvancedTab, setMobileAdvancedTab] = useState<"filters" | "results">("filters");
  const [adding, setAdding] = useState(false);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { addCardFromSearch, profile } = useAppData();
  const game = getQuickAddGame(selectedGameSlug);

  const { data: pokemonSets = [], isLoading: pokemonSetsLoading } = useQuery<
    Array<{ id: string; name: string; series: string | null; printedTotal: number | null }>
  >({
    queryKey: ["pokemon-sets"],
    queryFn: async () => {
      const response = await fetch("/api/cards/pokemon/sets");
      if (!response.ok) throw new Error("Failed to load Pokemon collections");
      const json = (await response.json()) as { sets?: Array<{ id: string; name: string; series: string | null; printedTotal: number | null }> };
      return json.sets ?? [];
    },
    enabled: open && game.slug === "pokemon",
    staleTime: 60 * 60 * 1000,
  });

  const pokemonSetOptions = useMemo(
    () => [
      { value: "all", label: t("quickAdd.allCollections") },
      ...pokemonSets.map((set) => ({
        value: set.id,
        label: `${set.name}${set.printedTotal ? ` (${set.printedTotal})` : ""}`,
      })),
    ],
    [pokemonSets, t]
  );

  useEffect(() => {
    if (open) {
      setSearchLocale(readSearchLocale(profile.currency));
    }
  }, [open, profile.currency]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setPendingCard(null);
      setRarityFilter("all");
      setPreviewKey(null);
      setLastSelectedKey(null);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (open && defaultGameSlug) {
      setSelectedGameSlug(defaultGameSlug);
    }
  }, [open, defaultGameSlug]);

  useEffect(() => {
    setPendingCard(null);
    setQuery("");
    setDebouncedQuery("");
    setRarityFilter("all");
    setPreviewKey(null);
    setLastSelectedKey(null);
    setYgoSearchMode("simple");
    setSelectedPokemonSet("all");
    setYgoAdvancedFilters(EMPTY_YGO_ADVANCED_FILTERS);
    setAdvancedSearchNonce(0);
    setMobileAdvancedTab("filters");
  }, [selectedGameSlug]);

  /** Restore scroll to the last selected card when returning from the print picker. */
  useLayoutEffect(() => {
    if (pendingCard || !lastSelectedKey || !open) return;
    const root = searchPanelRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-quick-add-card="${CSS.escape(lastSelectedKey)}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pendingCard, lastSelectedKey, open]);

  const triggerAdvancedSearch = useCallback(() => {
    if (!hasActiveYgoAdvancedFilters(ygoAdvancedFilters)) return;
    setAdvancedSearchNonce((n) => n + 1);
    if (isMobile) setMobileAdvancedTab("results");
  }, [ygoAdvancedFilters, isMobile]);

  const {
    data: advancedData,
    isLoading: advancedLoading,
    isError: advancedError,
    isFetching: advancedFetching,
    error: advancedQueryError,
  } = useQuery<CardSearchResult[]>({
    queryKey: [
      "ygo-advanced-search",
      ygoAdvancedFilters,
      profile.currency,
      searchLocale,
      advancedSearchNonce,
    ],
    queryFn: async ({ signal }) => {
      setSearchErrorDetail(null);
      const res = await fetch("/api/cards/yugioh/advanced-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ygoAdvancedFilters,
          locale: searchLocale,
        }),
        signal,
      });
      const json = (await res.json()) as {
        results?: CardSearchResult[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const raw = json.message ?? json.error ?? "";
        const detail = /timed out|timeout/i.test(raw)
          ? t("quickAdd.searchTimedOut")
          : raw || t("quickAdd.advancedSearchFailed");
        setSearchErrorDetail(detail);
        throw new Error(detail);
      }
      return json.results ?? [];
    },
    enabled:
      game.slug === "yugioh" &&
      ygoSearchMode === "advanced" &&
      advancedSearchNonce > 0 &&
      hasActiveYgoAdvancedFilters(ygoAdvancedFilters),
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: (previousData: CardSearchResult[] | undefined) => previousData,
  });

  const { data, isLoading, isError, isFetching, error } = useQuery<CardSearchResult[]>({
    queryKey: ["card-search", debouncedQuery, game.slug, profile.currency, searchLocale, selectedPokemonSet],
    queryFn: async ({ signal }) => {
      setSearchErrorDetail(null);
      const localeParam =
        game.slug === "yugioh" && searchLocale === "pt" ? "&locale=pt" : "";
      const res = await fetch(
        `/api/cards/search?q=${encodeURIComponent(debouncedQuery)}&game=${game.slug}&currency=${profile.currency}&quick=1${localeParam}${game.slug === "pokemon" && selectedPokemonSet !== "all" ? `&set=${encodeURIComponent(selectedPokemonSet)}` : ""}`,
        { signal }
      );
      const json = (await res.json()) as {
        results?: CardSearchResult[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const raw = json.message ?? json.error ?? "";
        const detail = /timed out|timeout/i.test(raw)
          ? t("quickAdd.searchTimedOut")
          : raw || t("quickAdd.searchFailed");
        setSearchErrorDetail(detail);
        throw new Error(detail);
      }
      return json.results ?? [];
    },
    enabled:
      ygoSearchMode === "simple" &&
      (debouncedQuery.length >= 2 || (game.slug === "pokemon" && selectedPokemonSet !== "all")) &&
      isQuickAddSupported(game.slug),
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: (previousData: CardSearchResult[] | undefined) => previousData,
  });

  const isAdvancedMode = game.slug === "yugioh" && ygoSearchMode === "advanced";
  const searchResults = useMemo(
    () => (isAdvancedMode ? (advancedData ?? []) : (data ?? [])),
    [isAdvancedMode, advancedData, data]
  );
  const searchLoading = isAdvancedMode ? advancedLoading : isLoading;
  const searchFetching = isAdvancedMode ? advancedFetching : isFetching;
  const searchIsError = isAdvancedMode ? advancedError : isError;
  const searchQueryError = isAdvancedMode ? advancedQueryError : error;
  const hasSearchQuery = isAdvancedMode
    ? advancedSearchNonce > 0 && hasActiveYgoAdvancedFilters(ygoAdvancedFilters)
    : debouncedQuery.length >= 2 || (game.slug === "pokemon" && selectedPokemonSet !== "all");

  const showInitialLoader =
    searchLoading && hasSearchQuery && searchResults.length === 0;
  const showRefetchIndicator = searchFetching && !showInitialLoader && hasSearchQuery;

  const { data: ygoEnrich } = useQuery({
    queryKey: ["ygo-enrich", pendingCard?.name],
    queryFn: () => fetchYugiohCardByName(pendingCard!.name),
    enabled: open && !!pendingCard && game.slug === "yugioh",
    staleTime: 10 * 60 * 1000,
  });

  const variants = useMemo(() => {
    if (!pendingCard) return [];
    const siblings =
      searchResults.filter(
        (r) =>
          r.externalId !== pendingCard.externalId &&
          r.name === pendingCard.name
      ) ?? [];
    const merged =
      game.slug === "yugioh" && siblings.length > 0
        ? mergeYugiohSearchResults(pendingCard, siblings)
        : pendingCard;
    const related =
      game.slug === "yugioh" ? siblings : ygoEnrich ? [ygoEnrich] : [];
    return getSearchResultVariants(merged, game.slug, related);
  }, [pendingCard, game.slug, ygoEnrich, searchResults]);

  const filteredVariants = useMemo(
    () =>
      rarityFilter === "all"
        ? variants
        : variants.filter((v) => v.rarity === rarityFilter),
    [variants, rarityFilter]
  );

  useEffect(() => {
    if (!pendingCard) {
      setPreviewKey(null);
      return;
    }
    const first = filteredVariants[0] ?? variants[0];
    setPreviewKey(first?.key ?? null);
  }, [pendingCard, filteredVariants, variants]);

  const rarityOptions = useMemo(
    () => [...new Set(variants.map((v) => v.rarity).filter(Boolean))] as string[],
    [variants]
  );

  const previewVariant = useMemo(() => {
    if (!variants.length) return null;
    return variants.find((v) => v.key === previewKey) ?? filteredVariants[0] ?? variants[0];
  }, [variants, filteredVariants, previewKey]);

  const previewImage = useMemo(() => {
    if (!pendingCard || !previewVariant) return pendingCard?.imageUrl ?? null;
    return previewVariant.imageUrl ?? pendingCard.imageUrl;
  }, [pendingCard, previewVariant]);

  const handleAdd = async (result: CardSearchResult) => {
    if (adding) return;
    setAdding(true);
    try {
    let toAdd = result;
    if (game.slug === "yugioh") {
      const passcode = resolveYugiohPasscode(result.externalId, result.imageUrl);
      if (passcode) {
        toAdd = {
          ...result,
          externalId: passcode,
          imageUrl:
            buildYgoImageUrl(passcode, pickYgoImageSizeForRarity(result.rarity)) ??
            result.imageUrl,
        };
        if (searchLocale === "pt") {
          try {
            const detailRes = await fetch(
              `/api/cards/detail?game=yugioh&id=${encodeURIComponent(passcode)}`
            );
            if (detailRes.ok) {
              const detailJson = (await detailRes.json()) as {
                result?: { name?: string };
              };
              if (detailJson.result?.name) {
                toAdd = { ...toAdd, name: detailJson.result.name };
              }
            }
          } catch {
            // keep Portuguese name if English lookup fails
          }
        }
      } else {
        const ygo = await fetchYugiohCardByName(result.name);
        if (ygo?.externalId) {
          toAdd = {
            ...result,
            externalId: ygo.externalId,
            imageUrl:
              buildYgoImageUrl(ygo.externalId, pickYgoImageSizeForRarity(result.rarity)) ??
              result.imageUrl,
          };
        }
      }
    }
    if (onAdd) {
      await onAdd(toAdd, game);
    } else {
      await addCardFromSearch(toAdd, game.id, game.slug, game.name);
    }
    toast.success(t("quickAdd.added", { name: toAdd.name }));
    if (closeOnAdd) {
      onOpenChange(false);
      setQuery("");
    }
    setPendingCard(null);
    setRarityFilter("all");
    setPreviewKey(null);
    } catch (err) {
      if (err instanceof Error && err.message === NO_ACTIVE_COLLECTION) {
        toast.error(t("collection.noActiveCollection"));
      } else {
        toast.error(err instanceof Error ? err.message : t("quickAdd.addFailed"));
      }
    } finally {
      setAdding(false);
    }
  };

  const handleCardClick = (result: CardSearchResult) => {
    setLastSelectedKey(searchResultKey(result));

    const siblings =
      searchResults.filter(
        (r) =>
          r.externalId !== result.externalId &&
          (r.name === result.name ||
            (game.slug === "digimon" && digimonNamesMatch(r.name, result.name)))
      ) ?? [];

    let cardForVariants = result;
    let relatedPrints: CardSearchResult[] = [];

    if (game.slug === "digimon" && siblings.length > 0) {
      cardForVariants = {
        ...result,
        metadata: { ...result.metadata, digimonPrints: [result, ...siblings] },
      };
    } else if (game.slug === "yugioh" && siblings.length > 0) {
      cardForVariants = mergeYugiohSearchResults(result, siblings);
      relatedPrints = siblings;
    }

    const prints = getSearchResultVariants(cardForVariants, game.slug, relatedPrints);
    if (prints.length <= 1) {
      void handleAdd(applyVariant(cardForVariants, prints[0]));
      return;
    }
    setPendingCard(cardForVariants);
    setRarityFilter("all");
  };

  const handleVariantPick = (variant: CardPrintVariant) => {
    if (!pendingCard) return;
    const result = applyVariant(pendingCard, variant);
    void handleAdd({
      ...result,
      imageUrl: result.imageUrl,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        pendingCard
          ? t("quickAdd.choosePrint")
          : isAdvancedMode
            ? t("quickAdd.advancedTitle")
            : (title ?? t("quickAdd.title"))
      }
      description={
        pendingCard
          ? t("quickAdd.choosePrintDescription", { name: pendingCard.name })
          : isAdvancedMode
            ? t("quickAdd.advancedDescription", { game: game.name })
            : t("quickAdd.searchDescription", { game: game.name })
      }
      className={cn(
        pendingCard
          ? "sm:max-w-4xl max-sm:max-h-[96dvh] max-sm:overflow-y-auto"
          : isAdvancedMode
            ? cn(
                "flex h-[min(92vh,900px)] max-h-[92dvh] min-h-0 flex-col gap-0 overflow-hidden sm:max-w-6xl",
                MOBILE_DIALOG_FULL
              )
            : "sm:max-w-3xl max-sm:max-h-[96dvh] max-sm:overflow-y-auto"
      )}
    >
      <div
        className={cn(
          "flex flex-col",
          !pendingCard && isAdvancedMode ? "min-h-0 flex-1 gap-4" : "space-y-4"
        )}
      >
        {pendingCard && (
          <QuickAddVariantPicker
            pendingCard={pendingCard}
            gameSlug={game.slug}
            previewImage={previewImage}
            previewVariant={previewVariant}
            previewKey={previewKey}
            rarityFilter={rarityFilter}
            rarityOptions={rarityOptions}
            filteredVariants={filteredVariants}
            onBack={() => {
              setPendingCard(null);
              setRarityFilter("all");
              setPreviewKey(null);
            }}
            onRarityFilterChange={setRarityFilter}
            onPreviewKeyChange={setPreviewKey}
            onVariantPick={handleVariantPick}
          />
        )}

        <div
          ref={searchPanelRef}
          className={cn(
            pendingCard && "hidden",
            isAdvancedMode ? "flex min-h-0 flex-1 flex-col gap-4" : "contents"
          )}
          aria-hidden={pendingCard ? true : undefined}
        >
        {isAdvancedMode ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <ResponsiveSelect
                preferNative
                value={selectedGameSlug}
                onValueChange={(slug) => {
                  const next = QUICK_ADD_GAMES.find((g) => g.slug === slug);
                  if (next) {
                    setSelectedGameSlug(next.slug);
                    if (next.slug !== "pokemon") setSelectedPokemonSet("all");
                  }
                }}
                options={GAME_SELECT_OPTIONS}
                triggerClassName="h-10 w-full sm:w-[200px]"
              />

              <ResponsiveSelect
                preferNative
                value={searchLocale}
                onValueChange={(value) => {
                  const locale = value as CatalogSearchLocale;
                  setSearchLocale(locale);
                  writeSearchLocale(locale);
                }}
                options={SEARCH_LOCALE_OPTIONS}
                triggerClassName="h-10 w-full sm:w-[88px]"
              />

              <div className="col-span-2 flex rounded-lg border border-border/50 bg-muted/20 p-0.5 sm:col-span-1">
                {(["simple", "advanced"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setYgoSearchMode(mode)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:py-1.5",
                      ygoSearchMode === mode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode === "simple" ? t("quickAdd.simpleMode") : t("quickAdd.advancedMode")}
                  </button>
                ))}
              </div>
            </div>

            {isMobile && (
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/50 bg-muted/20 p-1">
                <button
                  type="button"
                  onClick={() => setMobileAdvancedTab("filters")}
                  className={cn(
                    "rounded-lg py-2.5 text-xs font-medium transition-all",
                    mobileAdvancedTab === "filters"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {t("quickAdd.filtersTab")}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAdvancedTab("results")}
                  className={cn(
                    "relative rounded-lg py-2.5 text-xs font-medium transition-all",
                    mobileAdvancedTab === "results"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {t("quickAdd.resultsTab")}
                  {searchResults.length > 0 && (
                    <span className="ml-1.5 inline-flex min-w-[1.25rem] rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                      {searchResults.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(300px,340px)_1fr] lg:gap-5">
              {(!isMobile || mobileAdvancedTab === "filters") && (
                <div
                  className={cn(
                    "flex min-h-0 flex-col overflow-hidden",
                    isMobile ? "overflow-y-auto" : "flex-1"
                  )}
                >
                  <YugiohAdvancedSearchPanel
                    filters={ygoAdvancedFilters}
                    onChange={setYgoAdvancedFilters}
                    onSearch={triggerAdvancedSearch}
                    isSearching={advancedFetching}
                    locale={searchLocale}
                    layout="sidebar"
                    preferNativeSelects
                    className="min-h-0"
                  />
                </div>
              )}

              {(!isMobile || mobileAdvancedTab === "results") && (
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-muted/10">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t("quickAdd.results")}</p>
                    <p className="text-xs text-muted-foreground">
                      {hasSearchQuery && searchResults.length > 0
                        ? t("quickAdd.cardCount", { count: searchResults.length })
                        : advancedSearchNonce === 0
                          ? t("quickAdd.waitingSearch")
                          : t("quickAdd.noResults")}
                    </p>
                  </div>
                  {showRefetchIndicator && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("quickAdd.updating")}
                    </div>
                  )}
                </div>

                <ScrollArea
                  className={cn(
                    "flex-1",
                    isMobile ? "h-[min(52dvh,420px)]" : "min-h-[240px] lg:min-h-0 lg:h-[min(52vh,520px)]"
                  )}
                >
                  <div className="p-4">
                    {showInitialLoader && (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        {t("quickAdd.searchingCards")}
                      </div>
                    )}

                    {advancedSearchNonce === 0 && !showInitialLoader && !searchFetching && (
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <SlidersHorizontal className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("quickAdd.configureFilters")}
                        </p>
                        <p className="max-w-[220px] text-xs text-muted-foreground/80">
                          {t("quickAdd.configureFiltersHint")}
                        </p>
                      </div>
                    )}

                    {hasSearchQuery && searchResults.length > 0 && (
                      <div
                        className={cn(
                          "grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
                          showRefetchIndicator && "opacity-80"
                        )}
                      >
                        {searchResults.map((result) => {
                          const key = searchResultKey(result);
                          const isLastSelected = lastSelectedKey === key;
                          return (
                          <button
                            key={key}
                            type="button"
                            data-quick-add-card={key}
                            onClick={() => handleCardClick(result)}
                            className={cn(
                              "group flex flex-col rounded-lg p-1 text-left transition-all hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isLastSelected && "bg-primary/10 ring-2 ring-primary shadow-md shadow-primary/20"
                            )}
                            title={result.name}
                          >
                            <div
                              className={cn(
                                "relative aspect-[59/86] w-full overflow-hidden rounded-lg bg-muted/80 shadow-sm ring-1 transition-all group-hover:ring-primary/40",
                                isLastSelected ? "ring-2 ring-primary" : "ring-border/40"
                              )}
                            >
                              <CardImage
                                src={result.imageUrl}
                                alt={result.name}
                                fill
                                sizes="120px"
                                className="object-contain"
                                fallbackSrc={
                                  /^\d{7,10}$/.test(result.externalId)
                                    ? `https://images.ygoprodeck.com/images/cards/${result.externalId}.jpg`
                                    : null
                                }
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100">
                                <Plus className="h-5 w-5 text-white drop-shadow-md" />
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-center text-[10px] font-medium leading-tight">
                              {result.name}
                            </p>
                          </button>
                          );
                        })}
                      </div>
                    )}

                    {searchIsError && (
                      <p className="py-16 text-center text-sm text-destructive">
                        {searchQueryError instanceof Error
                          ? searchQueryError.message
                          : searchErrorDetail ?? t("quickAdd.searchFailed")}
                      </p>
                    )}

                    {hasSearchQuery &&
                      !showInitialLoader &&
                      !searchFetching &&
                      !searchIsError &&
                      searchResults.length === 0 && (
                        <p className="py-16 text-center text-sm text-muted-foreground">
                          {t("quickAdd.noCardsWithFilters")}
                        </p>
                      )}
                  </div>
                </ScrollArea>
              </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ResponsiveSelect
                preferNative
                value={selectedGameSlug}
                onValueChange={(slug) => {
                  const next = QUICK_ADD_GAMES.find((g) => g.slug === slug);
                  if (next) setSelectedGameSlug(next.slug);
                }}
                options={GAME_SELECT_OPTIONS}
                triggerClassName="h-10 w-full sm:w-[220px]"
              />
              {game.slug === "pokemon" && (
                <ResponsiveSelect
                  preferNative
                  value={selectedPokemonSet}
                  onValueChange={setSelectedPokemonSet}
                  options={pokemonSetOptions}
                  placeholder={pokemonSetsLoading ? t("quickAdd.loadingCollections") : undefined}
                  triggerClassName="h-10 w-full sm:w-[240px]"
                />
              )}
              {game.slug === "yugioh" && (
                <>
                  <ResponsiveSelect
                    preferNative
                    value={searchLocale}
                    onValueChange={(value) => {
                      const locale = value as CatalogSearchLocale;
                      setSearchLocale(locale);
                      writeSearchLocale(locale);
                    }}
                    options={SEARCH_LOCALE_OPTIONS}
                    triggerClassName="h-10 w-full sm:w-[100px]"
                  />
                  <div className="flex rounded-lg border border-border/50 bg-muted/20 p-0.5">
                    {(["simple", "advanced"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setYgoSearchMode(mode)}
                        className={cn(
                          "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:py-1.5",
                          ygoSearchMode === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mode === "simple" ? t("quickAdd.simpleMode") : t("quickAdd.advancedMode")}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder={
                  game.slug === "yugioh" && searchLocale === "pt"
                    ? t("quickAdd.searchPlaceholderPt", { game: game.name })
                    : t("quickAdd.searchPlaceholder", { game: game.name })
                }
                enableShortcut={false}
                className="flex-1"
              />
            </div>

            {!isQuickAddSupported(game.slug) && (
              <p className="text-sm text-muted-foreground">
                {t("quickAdd.unsupportedGame", { game: game.name })}
              </p>
            )}

            <ScrollArea className="h-[360px] pr-3">
              {showRefetchIndicator && (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("quickAdd.updating")}
                </div>
              )}

              {showInitialLoader && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("quickAdd.searchingGame", { game: game.name })}
                </div>
              )}

              {hasSearchQuery && searchResults.length > 0 && (
                <div
                  className={cn(
                    "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
                    showRefetchIndicator && "opacity-80"
                  )}
                >
                  {searchResults.map((result) => {
                    const key = searchResultKey(result);
                    const isLastSelected = lastSelectedKey === key;
                    return (
                    <button
                      key={key}
                      type="button"
                      data-quick-add-card={key}
                      onClick={() => handleCardClick(result)}
                      className={cn(
                        "group flex flex-col rounded-lg p-1.5 text-left transition-all duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isLastSelected && "bg-primary/10 ring-2 ring-primary shadow-md shadow-primary/20"
                      )}
                      title={result.name}
                    >
                      <div
                        className={cn(
                          "relative aspect-[59/86] w-full overflow-hidden rounded-md bg-muted shadow-sm ring-1 transition-transform duration-150 group-hover:scale-[1.03] group-hover:ring-primary/40",
                          isLastSelected ? "ring-2 ring-primary scale-[1.02]" : "ring-border/50"
                        )}
                      >
                        <CardImage
                          src={result.imageUrl}
                          alt={result.name}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 120px"
                          className="object-contain"
                          fallbackSrc={
                            game.slug === "yugioh" && /^\d{7,10}$/.test(result.externalId)
                              ? `https://images.ygoprodeck.com/images/cards/${result.externalId}.jpg`
                              : null
                          }
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
                          <Plus className="h-6 w-6 text-white drop-shadow-md" />
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight text-foreground">
                        {result.name}
                      </p>
                    </button>
                    );
                  })}
                </div>
              )}

              {searchIsError && (
                <p className="py-12 text-center text-sm text-destructive">
                  {searchQueryError instanceof Error
                    ? searchQueryError.message
                    : searchErrorDetail ?? t("quickAdd.searchFailed")}
                </p>
              )}

              {hasSearchQuery &&
                !showInitialLoader &&
                !searchFetching &&
                !searchIsError &&
                searchResults.length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">{t("quickAdd.noCardsFound")}</p>
                )}
            </ScrollArea>
          </>
        )}
        </div>
      </div>
    </Modal>
  );
}

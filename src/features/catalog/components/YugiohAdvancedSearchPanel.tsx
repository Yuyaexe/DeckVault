"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import {
  countActiveYgoAdvancedFilters,
  EMPTY_YGO_ADVANCED_FILTERS,
  type YugiohAdvancedSearchFilters,
} from "@/lib/yugioh/advanced-search";
import {
  YGO_CATEGORY_TABS,
  YGO_LINK_MARKERS,
  type YugiohCardTypeKey,
  type YugiohFilterLogic,
  type YugiohSearchCategory,
} from "@/lib/yugioh/advanced-search.constants";
import {
  getLocalizedYgoAttributes,
  getLocalizedYgoCardTypeKeys,
  getLocalizedYgoCategoryTabs,
  getLocalizedYgoMonsterRaces,
  getLocalizedYgoSearchFieldOptions,
  getLocalizedYgoSpellTrapRaces,
  YGO_LEVELS_LIST,
  YGO_LINK_MARKERS_LIST,
  YGO_LINK_VALUES_LIST,
} from "@/lib/yugioh/advanced-search-labels";

interface YugiohAdvancedSearchPanelProps {
  filters: YugiohAdvancedSearchFilters;
  onChange: (filters: YugiohAdvancedSearchFilters) => void;
  onSearch: () => void;
  isSearching?: boolean;
  locale?: "en" | "pt";
  layout?: "stacked" | "sidebar";
  className?: string;
  /** Native selects inside Dialog/Sheet — avoids Radix crash on mobile. */
  preferNativeSelects?: boolean;
}

const YGO_SORT_OPTION_KEYS = [
  { value: "name", key: "ygoSearch.sortName" as const },
  { value: "atk", key: "ygoSearch.sortAtk" as const },
  { value: "def", key: "ygoSearch.sortDef" as const },
  { value: "level", key: "ygoSearch.sortLevel" as const },
  { value: "new", key: "ygoSearch.sortNew" as const },
];

interface CardSetOption {
  setName: string;
  setCode: string;
  tcgDate: string | null;
}

const ATTRIBUTE_STYLES: Record<string, { active: string; idle: string }> = {
  DARK: {
    active: "border-violet-500/60 bg-violet-500/20 text-violet-100",
    idle: "hover:border-violet-500/30 hover:bg-violet-500/10",
  },
  LIGHT: {
    active: "border-amber-400/60 bg-amber-400/20 text-amber-100",
    idle: "hover:border-amber-400/30 hover:bg-amber-400/10",
  },
  EARTH: {
    active: "border-orange-700/60 bg-orange-700/25 text-orange-100",
    idle: "hover:border-orange-700/30 hover:bg-orange-700/10",
  },
  WATER: {
    active: "border-sky-500/60 bg-sky-500/20 text-sky-100",
    idle: "hover:border-sky-500/30 hover:bg-sky-500/10",
  },
  FIRE: {
    active: "border-red-500/60 bg-red-500/20 text-red-100",
    idle: "hover:border-red-500/30 hover:bg-red-500/10",
  },
  WIND: {
    active: "border-emerald-500/60 bg-emerald-500/20 text-emerald-100",
    idle: "hover:border-emerald-500/30 hover:bg-emerald-500/10",
  },
  DIVINE: {
    active: "border-yellow-300/60 bg-yellow-300/15 text-yellow-100",
    idle: "hover:border-yellow-300/30 hover:bg-yellow-300/10",
  },
};

function FilterSection({
  title,
  clearAriaLabel,
  defaultOpen = true,
  activeCount = 0,
  onClear,
  children,
}: {
  title: string;
  clearAriaLabel?: string;
  defaultOpen?: boolean;
  activeCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border/50 bg-card/40 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
          <span className="truncate text-sm font-medium">{title}</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {activeCount}
            </span>
          )}
        </button>
        {onClear && (
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={clearAriaLabel ?? `Clear ${title}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-3 border-t border-border/40 bg-muted/10 px-3 py-3">{children}</div>
      )}
    </section>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
        active
          ? "border-primary/50 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20"
          : "border-border/50 bg-background/60 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
        className
      )}
    >
      {label}
    </button>
  );
}

function AttributeChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  const styles = ATTRIBUTE_STYLES[value];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
        active
          ? styles?.active ?? "border-primary/50 bg-primary/15 text-primary"
          : cn("border-border/50 bg-background/40 text-muted-foreground", styles?.idle)
      )}
    >
      {label}
    </button>
  );
}

function NumberChip({
  value,
  active,
  onClick,
}: {
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/50 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {value}
    </button>
  );
}

function LogicToggle({
  value,
  onChange,
  orLabel,
  andLabel,
}: {
  value: YugiohFilterLogic;
  onChange: (value: YugiohFilterLogic) => void;
  orLabel: string;
  andLabel: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-0.5 text-[11px]">
      {(["or", "and"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "rounded-md px-2.5 py-1 font-semibold uppercase tracking-wide transition-colors",
            value === mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode === "or" ? orLabel : andLabel}
        </button>
      ))}
    </div>
  );
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function StatRange({
  label,
  min,
  max,
  minPlaceholder,
  maxPlaceholder,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: number | null;
  max: number | null;
  minPlaceholder: string;
  maxPlaceholder: string;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder={minPlaceholder}
          value={min ?? ""}
          onChange={(e) => onMinChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 bg-background/80 text-xs"
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder={maxPlaceholder}
          value={max ?? ""}
          onChange={(e) => onMaxChange(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 bg-background/80 text-xs"
        />
      </div>
    </div>
  );
}

const LINK_GRID: ((typeof YGO_LINK_MARKERS_LIST)[number] | null)[] = [
  YGO_LINK_MARKERS_LIST[0],
  YGO_LINK_MARKERS_LIST[1],
  YGO_LINK_MARKERS_LIST[2],
  YGO_LINK_MARKERS_LIST[3],
  null,
  YGO_LINK_MARKERS_LIST[4],
  YGO_LINK_MARKERS_LIST[5],
  YGO_LINK_MARKERS_LIST[6],
  YGO_LINK_MARKERS_LIST[7],
];

export function YugiohAdvancedSearchPanel({
  filters,
  onChange,
  onSearch,
  isSearching = false,
  layout = "stacked",
  className,
  preferNativeSelects = true,
}: YugiohAdvancedSearchPanelProps) {
  const t = useT();
  const locale = useLocale();
  const [editionFilter, setEditionFilter] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const useNativeSelect = preferNativeSelects || isMobile;

  const searchFieldOptions = useMemo(
    () => getLocalizedYgoSearchFieldOptions(locale),
    [locale]
  );
  const categoryTabs = useMemo(() => getLocalizedYgoCategoryTabs(locale), [locale]);
  const ygoAttributes = useMemo(() => getLocalizedYgoAttributes(locale), [locale]);
  const spellTrapRaces = useMemo(() => getLocalizedYgoSpellTrapRaces(locale), [locale]);
  const monsterRaces = useMemo(() => getLocalizedYgoMonsterRaces(locale), [locale]);
  const cardTypeKeys = useMemo(() => getLocalizedYgoCardTypeKeys(locale), [locale]);
  const sortOptions = useMemo(
    () => YGO_SORT_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.key) })),
    [t]
  );
  const sectionClear = (title: string) => t("ygoSearch.clearSection", { title });

  const { data: cardSets = [] } = useQuery<CardSetOption[]>({
    queryKey: ["ygo-cardsets"],
    queryFn: async () => {
      const res = await fetch("/api/cards/yugioh/cardsets");
      const json = (await res.json()) as { sets?: CardSetOption[] };
      return json.sets ?? [];
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const filteredSets = useMemo(() => {
    const q = editionFilter.trim().toLowerCase();
    if (!q) return cardSets;
    return cardSets.filter(
      (set) =>
        set.setName.toLowerCase().includes(q) ||
        set.setCode.toLowerCase().includes(q)
    );
  }, [cardSets, editionFilter]);

  const activeCount = countActiveYgoAdvancedFilters(filters);

  const patch = (partial: Partial<YugiohAdvancedSearchFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleCardType = (key: YugiohCardTypeKey, field: "cardTypes" | "excludeTypes") => {
    patch({ [field]: toggleInList(filters[field], key) });
  };

  const showMonsterFilters = filters.category === "all" || filters.category === "monster";
  const showSpellTrapIcons =
    filters.category === "all" || filters.category === "spell" || filters.category === "trap";

  const filtersScrollClass =
    layout === "sidebar"
      ? isMobile
        ? "overflow-visible"
        : "min-h-0 flex-1 pr-2"
      : "h-[min(42vh,380px)] pr-2";

  const FiltersScrollWrapper = isMobile && layout === "sidebar" ? "div" : ScrollArea;

  return (
    <div
      className={cn(
        "flex flex-col",
        layout === "sidebar" && "h-full min-h-0",
        className
      )}
    >
      {/* Search hero */}
      <div className="mb-3 rounded-xl border border-border/50 bg-gradient-to-br from-muted/40 via-card/30 to-muted/20 p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("ygoSearch.hero")}
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.keyword}
            onChange={(e) => patch({ keyword: e.target.value })}
            placeholder={t("ygoSearch.keywordPlaceholder")}
            className="h-10 border-border/60 bg-background/80 pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("ygoSearch.mode")}</Label>
            <ResponsiveSelect
              preferNative={useNativeSelect}
              value={filters.searchField}
              onValueChange={(value) =>
                patch({ searchField: value as YugiohAdvancedSearchFilters["searchField"] })
              }
              options={searchFieldOptions}
              triggerClassName="h-10 bg-background/80 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("ygoSearch.sort")}</Label>
            <ResponsiveSelect
              preferNative={useNativeSelect}
              value={filters.sort}
              onValueChange={(value) =>
                patch({ sort: value as YugiohAdvancedSearchFilters["sort"] })
              }
              options={sortOptions}
              triggerClassName="h-10 bg-background/80 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Category segmented control */}
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-border/50 bg-muted/20 p-1">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => patch({ category: tab.value as YugiohSearchCategory })}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-medium transition-all",
              filters.category === tab.value
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FiltersScrollWrapper className={filtersScrollClass}>
        <div className="space-y-2.5 pb-2">
          {showMonsterFilters && (
            <FilterSection
              title={t("ygoSearch.attribute")}
              clearAriaLabel={sectionClear(t("ygoSearch.attribute"))}
              activeCount={filters.attributes.length}
              onClear={filters.attributes.length ? () => patch({ attributes: [] }) : undefined}
            >
              <div className="flex flex-wrap gap-1.5">
                {ygoAttributes.map((attr) => (
                  <AttributeChip
                    key={attr.value}
                    label={attr.label}
                    value={attr.value}
                    active={filters.attributes.includes(attr.value)}
                    onClick={() =>
                      patch({ attributes: toggleInList(filters.attributes, attr.value) })
                    }
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {showSpellTrapIcons && (
            <FilterSection
              title={t("ygoSearch.spellTrapIcon")}
              clearAriaLabel={sectionClear(t("ygoSearch.spellTrapIcon"))}
              defaultOpen={filters.category !== "all"}
              activeCount={filters.spellTrapRaces.length}
              onClear={
                filters.spellTrapRaces.length ? () => patch({ spellTrapRaces: [] }) : undefined
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {spellTrapRaces.map((race) => (
                  <ToggleChip
                    key={race.value}
                    label={race.label}
                    active={filters.spellTrapRaces.includes(race.value)}
                    onClick={() =>
                      patch({
                        spellTrapRaces: toggleInList(filters.spellTrapRaces, race.value),
                      })
                    }
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {showMonsterFilters && (
            <FilterSection
              title={t("ygoSearch.monsterType")}
              clearAriaLabel={sectionClear(t("ygoSearch.monsterType"))}
              defaultOpen={false}
              activeCount={filters.monsterRaces.length}
              onClear={filters.monsterRaces.length ? () => patch({ monsterRaces: [] }) : undefined}
            >
              <div className="flex flex-wrap gap-1.5">
                {monsterRaces.map((race) => (
                  <ToggleChip
                    key={race.value}
                    label={race.label}
                    active={filters.monsterRaces.includes(race.value)}
                    onClick={() =>
                      patch({ monsterRaces: toggleInList(filters.monsterRaces, race.value) })
                    }
                  />
                ))}
              </div>
            </FilterSection>
          )}

          <FilterSection
            title={t("ygoSearch.cardType")}
            clearAriaLabel={sectionClear(t("ygoSearch.cardType"))}
            defaultOpen={false}
            activeCount={filters.cardTypes.length}
            onClear={filters.cardTypes.length ? () => patch({ cardTypes: [] }) : undefined}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t("ygoSearch.combineTypes")}</span>
              <LogicToggle
                value={filters.cardTypesLogic}
                onChange={(cardTypesLogic) => patch({ cardTypesLogic })}
                orLabel={t("ygoSearch.logicOr")}
                andLabel={t("ygoSearch.logicAnd")}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cardTypeKeys.map(({ key, label }) => (
                <ToggleChip
                  key={key}
                  label={label}
                  active={filters.cardTypes.includes(key)}
                  onClick={() => toggleCardType(key, "cardTypes")}
                />
              ))}
            </div>
          </FilterSection>

          <FilterSection
            title={t("ygoSearch.excludeTypes")}
            clearAriaLabel={sectionClear(t("ygoSearch.excludeTypes"))}
            defaultOpen={false}
            activeCount={filters.excludeTypes.length}
            onClear={filters.excludeTypes.length ? () => patch({ excludeTypes: [] }) : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              {cardTypeKeys.map(({ key, label }) => (
                <ToggleChip
                  key={key}
                  label={label}
                  active={filters.excludeTypes.includes(key)}
                  onClick={() => toggleCardType(key, "excludeTypes")}
                />
              ))}
            </div>
          </FilterSection>

          {showMonsterFilters && (
            <>
              <FilterSection
                title={t("ygoSearch.levelClass")}
                clearAriaLabel={sectionClear(t("ygoSearch.levelClass"))}
                defaultOpen={false}
                activeCount={filters.levels.length}
                onClear={filters.levels.length ? () => patch({ levels: [] }) : undefined}
              >
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
                  {YGO_LEVELS_LIST.map((level) => (
                    <NumberChip
                      key={level}
                      value={level}
                      active={filters.levels.includes(level)}
                      onClick={() => patch({ levels: toggleInList(filters.levels, level) })}
                    />
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title={t("ygoSearch.pendulumScale")}
                clearAriaLabel={sectionClear(t("ygoSearch.pendulumScale"))}
                defaultOpen={false}
                activeCount={filters.scales.length}
                onClear={filters.scales.length ? () => patch({ scales: [] }) : undefined}
              >
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
                  {YGO_LEVELS_LIST.map((scale) => (
                    <NumberChip
                      key={scale}
                      value={scale}
                      active={filters.scales.includes(scale)}
                      onClick={() => patch({ scales: toggleInList(filters.scales, scale) })}
                    />
                  ))}
                </div>
              </FilterSection>

              <FilterSection
                title={t("ygoSearch.link")}
                clearAriaLabel={sectionClear(t("ygoSearch.link"))}
                defaultOpen={false}
                activeCount={filters.linkValues.length + filters.linkMarkers.length}
                onClear={
                  filters.linkValues.length || filters.linkMarkers.length
                    ? () => patch({ linkValues: [], linkMarkers: [] })
                    : undefined
                }
              >
                <Label className="text-xs text-muted-foreground">{t("ygoSearch.classification")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {YGO_LINK_VALUES_LIST.map((link) => (
                    <NumberChip
                      key={link}
                      value={link}
                      active={filters.linkValues.includes(link)}
                      onClick={() =>
                        patch({ linkValues: toggleInList(filters.linkValues, link) })
                      }
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">{t("ygoSearch.arrows")}</Label>
                  <LogicToggle
                    value={filters.linkMarkersLogic}
                    onChange={(linkMarkersLogic) => patch({ linkMarkersLogic })}
                    orLabel={t("ygoSearch.logicOr")}
                    andLabel={t("ygoSearch.logicAnd")}
                  />
                </div>
                <div className="mt-2 inline-grid grid-cols-3 gap-1.5 rounded-xl border border-border/40 bg-muted/20 p-2">
                  {LINK_GRID.map((marker, index) =>
                    marker ? (
                      <button
                        key={marker.value}
                        type="button"
                        title={marker.value}
                        onClick={() =>
                          patch({
                            linkMarkers: toggleInList(filters.linkMarkers, marker.value),
                          })
                        }
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all",
                          filters.linkMarkers.includes(marker.value)
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border/50 bg-background/60 text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {marker.label}
                      </button>
                    ) : (
                      <div key={`empty-${index}`} className="h-9 w-9" aria-hidden />
                    )
                  )}
                </div>
              </FilterSection>

              <FilterSection
                title={t("ygoSearch.atkDef")}
                clearAriaLabel={sectionClear(t("ygoSearch.atkDef"))}
                defaultOpen={false}
                activeCount={
                  (filters.atkMin != null || filters.atkMax != null ? 1 : 0) +
                  (filters.defMin != null || filters.defMax != null ? 1 : 0)
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatRange
                    label="ATK"
                    min={filters.atkMin}
                    max={filters.atkMax}
                    minPlaceholder={t("ygoSearch.min")}
                    maxPlaceholder={t("ygoSearch.max")}
                    onMinChange={(atkMin) => patch({ atkMin })}
                    onMaxChange={(atkMax) => patch({ atkMax })}
                  />
                  <StatRange
                    label="DEF"
                    min={filters.defMin}
                    max={filters.defMax}
                    minPlaceholder={t("ygoSearch.min")}
                    maxPlaceholder={t("ygoSearch.max")}
                    onMinChange={(defMin) => patch({ defMin })}
                    onMaxChange={(defMax) => patch({ defMax })}
                  />
                </div>
              </FilterSection>
            </>
          )}

          <FilterSection title={t("ygoSearch.releaseDate")} defaultOpen={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("ygoSearch.start")}</Label>
                <Input
                  type="date"
                  value={filters.startDate ?? ""}
                  onChange={(e) => patch({ startDate: e.target.value || null })}
                  className="h-9 bg-background/80 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("ygoSearch.end")}</Label>
                <Input
                  type="date"
                  value={filters.endDate ?? ""}
                  onChange={(e) => patch({ endDate: e.target.value || null })}
                  className="h-9 bg-background/80 text-xs"
                />
              </div>
            </div>
          </FilterSection>

          <FilterSection
            title={t("ygoSearch.edition")}
            clearAriaLabel={sectionClear(t("ygoSearch.edition"))}
            defaultOpen={false}
            activeCount={filters.cardSets.length}
            onClear={filters.cardSets.length ? () => patch({ cardSets: [] }) : undefined}
          >
            <Input
              value={editionFilter}
              onChange={(e) => setEditionFilter(e.target.value)}
              placeholder={t("ygoSearch.filterEditions")}
              className="mb-2 h-9 bg-background/80 text-xs"
            />
            <ScrollArea className="h-40 rounded-lg border border-border/40 bg-background/40 pr-2">
              <div className="space-y-0.5 p-1">
                {filteredSets.slice(0, 200).map((set) => {
                  const checked = filters.cardSets.includes(set.setName);
                  return (
                    <label
                      key={`${set.setCode}-${set.setName}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors",
                        checked ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          patch({
                            cardSets: toggleInList(filters.cardSets, set.setName),
                          })
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0 text-xs leading-snug">
                        {set.setName}
                        <span className="text-muted-foreground"> ({set.setCode})</span>
                      </span>
                    </label>
                  );
                })}
                {filteredSets.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {t("ygoSearch.noEditionFound")}
                  </p>
                )}
              </div>
            </ScrollArea>
          </FilterSection>
        </div>
      </FiltersScrollWrapper>

      {/* Sticky footer */}
      <div className="mt-3 flex shrink-0 flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {activeCount > 0 ? (
            t(activeCount === 1 ? "ygoSearch.activeFilters" : "ygoSearch.activeFiltersPlural", {
              count: activeCount,
            })
          ) : (
            t("ygoSearch.selectFiltersHint")
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 flex-1 sm:h-9 sm:flex-none"
            onClick={() => onChange({ ...EMPTY_YGO_ADVANCED_FILTERS })}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("common.clear")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 min-w-[100px] flex-1 shadow-sm sm:h-9 sm:flex-none"
            onClick={onSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              t("ygoSearch.searching")
            ) : (
              <>
                <Search className="mr-1.5 h-3.5 w-3.5" />
                {t("ygoSearch.search")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

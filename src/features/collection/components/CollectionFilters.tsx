"use client";

import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollectionUIStore } from "@/features/collection/stores/collection-ui.store";
import { DEMO_GAMES } from "@/lib/demo/types";
import { CARD_CONDITIONS, CARD_LANGUAGES } from "@/types/tcg";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useT } from "@/lib/i18n/context";

interface CollectionFiltersProps {
  /** Sheet on mobile — native selects avoid Radix crashes. */
  inSheet?: boolean;
}

function FilterSelect({
  preferNative,
  value,
  onValueChange,
  options,
}: {
  preferNative: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <ResponsiveSelect
      preferNative={preferNative}
      value={value}
      onValueChange={onValueChange}
      options={options}
      triggerClassName={preferNative ? "min-h-10" : "h-8"}
    />
  );
}

export function CollectionFilters({ inSheet = false }: CollectionFiltersProps) {
  const t = useT();
  const filters = useCollectionUIStore((s) => s.filters);
  const setFilters = useCollectionUIStore((s) => s.setFilters);
  const resetFilters = useCollectionUIStore((s) => s.resetFilters);
  const sortField = useCollectionUIStore((s) => s.sortField);
  const sortDir = useCollectionUIStore((s) => s.sortDir);
  const setSort = useCollectionUIStore((s) => s.setSort);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const preferNative = inSheet || isMobile;

  return (
    <ScrollArea className={inSheet ? "min-h-0 flex-1" : "h-full"}>
      <div className="space-y-5 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("collection.filters")}</h3>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
            {t("collection.reset")}
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("collection.sortBy")}</Label>
          <FilterSelect
            preferNative={preferNative}
            value={`${sortField}:${sortDir}`}
            onValueChange={(v) => {
              const [field, dir] = v.split(":") as [string, "asc" | "desc"];
              setSort(field, dir);
            }}
            options={[
              { value: "name:asc", label: t("collection.sortNameAsc") },
              { value: "name:desc", label: t("collection.sortNameDesc") },
              { value: "quantity:desc", label: t("collection.sortQtyDesc") },
              { value: "quantity:asc", label: t("collection.sortQtyAsc") },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("collection.game")}</Label>
          <FilterSelect
            preferNative={preferNative}
            value={filters.gameId ?? "all"}
            onValueChange={(v) => setFilters({ gameId: v === "all" ? null : v })}
            options={[
              { value: "all", label: t("collection.allGames") },
              ...DEMO_GAMES.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("collection.language")}</Label>
          <FilterSelect
            preferNative={preferNative}
            value={filters.language ?? "all"}
            onValueChange={(v) =>
              setFilters({ language: v === "all" ? null : (v as typeof filters.language) })
            }
            options={[
              { value: "all", label: t("collection.allLanguages") },
              ...CARD_LANGUAGES.map((l) => ({ value: l, label: l })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("collection.condition")}</Label>
          <FilterSelect
            preferNative={preferNative}
            value={filters.condition ?? "all"}
            onValueChange={(v) =>
              setFilters({ condition: v === "all" ? null : (v as typeof filters.condition) })
            }
            options={[
              { value: "all", label: t("collection.allConditions") },
              ...CARD_CONDITIONS.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

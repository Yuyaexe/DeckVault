import { NextRequest, NextResponse } from "next/server";
import { yugiohAdapter } from "@/features/catalog/services/card-api/yugioh.adapter";
import { dedupeSearchResults } from "@/features/catalog/services/search-ranking";
import { serializeSearchResultsForResponse } from "@/features/catalog/services/serialize-search-results";
import {
  EMPTY_YGO_ADVANCED_FILTERS,
  hasActiveYgoAdvancedFilters,
  type YugiohAdvancedSearchFilters,
} from "@/lib/yugioh/advanced-search";
import { buildYgoImageUrl } from "@/lib/yugioh/urls";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import { enforceCatalogRateLimit } from "@/lib/api/enforce-rate-limit";

function parseFilters(body: Record<string, unknown>): YugiohAdvancedSearchFilters {
  const base = { ...EMPTY_YGO_ADVANCED_FILTERS };
  const readStringArray = (key: string) =>
    Array.isArray(body[key]) ? (body[key] as string[]) : base[key as keyof YugiohAdvancedSearchFilters];
  const readNumberArray = (key: string) =>
    Array.isArray(body[key])
      ? (body[key] as unknown[]).map(Number).filter((n) => !Number.isNaN(n))
      : base[key as keyof YugiohAdvancedSearchFilters];

  return {
    keyword: typeof body.keyword === "string" ? body.keyword : base.keyword,
    searchField:
      body.searchField === "exact" || body.searchField === "archetype" || body.searchField === "name"
        ? body.searchField
        : base.searchField,
    category:
      body.category === "monster" || body.category === "spell" || body.category === "trap"
        ? body.category
        : body.category === "all"
          ? "all"
          : base.category,
    attributes: readStringArray("attributes") as string[],
    spellTrapRaces: readStringArray("spellTrapRaces") as string[],
    monsterRaces: readStringArray("monsterRaces") as string[],
    cardTypes: readStringArray("cardTypes") as YugiohAdvancedSearchFilters["cardTypes"],
    cardTypesLogic: body.cardTypesLogic === "and" ? "and" : "or",
    excludeTypes: readStringArray("excludeTypes") as YugiohAdvancedSearchFilters["excludeTypes"],
    levels: readNumberArray("levels") as number[],
    scales: readNumberArray("scales") as number[],
    linkValues: readNumberArray("linkValues") as number[],
    linkMarkers: readStringArray("linkMarkers") as string[],
    linkMarkersLogic: body.linkMarkersLogic === "and" ? "and" : "or",
    atkMin: typeof body.atkMin === "number" ? body.atkMin : body.atkMin === null ? null : base.atkMin,
    atkMax: typeof body.atkMax === "number" ? body.atkMax : body.atkMax === null ? null : base.atkMax,
    defMin: typeof body.defMin === "number" ? body.defMin : body.defMin === null ? null : base.defMin,
    defMax: typeof body.defMax === "number" ? body.defMax : body.defMax === null ? null : base.defMax,
    startDate: typeof body.startDate === "string" ? body.startDate : base.startDate,
    endDate: typeof body.endDate === "string" ? body.endDate : base.endDate,
    cardSets: readStringArray("cardSets") as string[],
    sort:
      body.sort === "atk" || body.sort === "def" || body.sort === "level" || body.sort === "new"
        ? body.sort
        : "name",
  };
}

export async function POST(request: NextRequest) {
  const limited = enforceCatalogRateLimit(request, "ygo-advanced-search");
  if (limited) return limited;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const locale = body.locale === "pt" ? ("pt" as const) : ("en" as const);
    const filters = parseFilters(body);

    if (!hasActiveYgoAdvancedFilters(filters)) {
      return NextResponse.json(
        { results: [], message: "Select at least one filter or enter a keyword." },
        { status: 400 }
      );
    }

    let results = await yugiohAdapter.advancedSearch(filters, { locale });
    results = dedupeSearchResults(results, "yugioh");

    results = results.map((result) => {
      if (!isYugiohPasscodeId(result.externalId, result.imageUrl)) return result;
      const ygoUrl = buildYgoImageUrl(result.externalId, "small");
      return ygoUrl ? { ...result, imageUrl: ygoUrl } : result;
    });

    return NextResponse.json(
      { results: serializeSearchResultsForResponse(results) },
      { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("POST /api/cards/yugioh/advanced-search", error);
    return NextResponse.json(
      { error: "Advanced search failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

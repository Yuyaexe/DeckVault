import { NextRequest, NextResponse } from "next/server";
import { getCardAdapter, isApiSupported } from "@/features/catalog/services/card-api";
import { serializeSearchResultsForResponse } from "@/features/catalog/services/serialize-search-results";
import { rankSearchResults, dedupeSearchResults } from "@/features/catalog/services/search-ranking";
import { buildYgoImageUrl } from "@/lib/yugioh/urls";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";
import { enforceCatalogRateLimit } from "@/lib/api/enforce-rate-limit";

const SEARCH_RESULT_LIMIT = 24;

export async function GET(request: NextRequest) {
  const limited = enforceCatalogRateLimit(request, "cards-search");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.replace(/:+\s*$/, "").trim() || rawQuery.trim();
  const game = searchParams.get("game") ?? "yugioh";
  const localeParam = searchParams.get("locale");
  const locale = localeParam === "pt" ? ("pt" as const) : ("en" as const);
  const quickSearch = searchParams.get("quick") === "1";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  if (!isApiSupported(game)) {
    return NextResponse.json({
      results: [],
      message: `Search not available for ${game}. Use CSV import.`,
    });
  }

  try {
    const adapter = getCardAdapter(game);
    if (!adapter) {
      return NextResponse.json({ error: "Unknown game" }, { status: 400 });
    }

    let results: CardSearchResult[] = await adapter.search(
      query,
      game === "yugioh" ? { locale } : undefined
    );

    results = dedupeSearchResults(rankSearchResults(query, results), game).slice(
      0,
      SEARCH_RESULT_LIMIT
    );

    if (game === "yugioh") {
      results = results.map((result) => {
        if (!isYugiohPasscodeId(result.externalId, result.imageUrl)) return result;
        const ygoUrl = buildYgoImageUrl(result.externalId, "small");
        return ygoUrl ? { ...result, imageUrl: ygoUrl } : result;
      });
    }

    return NextResponse.json(
      { results: serializeSearchResultsForResponse(results) },
      {
        headers: quickSearch
          ? { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" }
          : undefined,
      }
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("GET /api/cards/search", error);
    return NextResponse.json({ error: "Search failed", message: detail }, { status: 500 });
  }
}

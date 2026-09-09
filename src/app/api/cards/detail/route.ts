import { NextRequest, NextResponse } from "next/server";
import { getCardAdapter, isApiSupported } from "@/features/catalog/services/card-api";
import { cloneSearchResultForJson } from "@/features/catalog/services/serialize-search-results";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

function yugiohRelatedPrintsFromSets(result: CardSearchResult): CardSearchResult[] {
  type YgoSetEntry = {
    set_name: string;
    set_code: string;
    set_rarity: string;
  };
  const sets = (result.metadata?.sets as YgoSetEntry[] | undefined) ?? [];
  if (sets.length <= 1) return [];

  return sets.slice(1).map((setEntry) => ({
    ...result,
    setCode: setEntry.set_code,
    setName: setEntry.set_name,
    collectorNumber: setEntry.set_code,
    rarity: setEntry.set_rarity,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const game = searchParams.get("game") ?? "yugioh";

  if (!id.trim()) {
    return NextResponse.json({ error: "Card id required" }, { status: 400 });
  }

  if (!isApiSupported(game)) {
    return NextResponse.json({ result: null, relatedPrints: [] });
  }

  const adapter = getCardAdapter(game);
  if (!adapter) {
    return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  }

  try {
    const result = await adapter.getById(id);
    if (!result) {
      return NextResponse.json({ result: null, relatedPrints: [] });
    }

    let relatedPrints: CardSearchResult[] = [];
    if (game === "yugioh" && result.name) {
      relatedPrints = yugiohRelatedPrintsFromSets(result);
      if (relatedPrints.length === 0) {
        const prints = await adapter.search(result.name);
        relatedPrints = prints.filter((p) => p.externalId !== result.externalId);
      }
    }

    return NextResponse.json(
      {
        result: cloneSearchResultForJson(result),
        relatedPrints: relatedPrints.map(cloneSearchResultForJson),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=600, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to load card" }, { status: 500 });
  }
}

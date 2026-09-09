import { NextRequest, NextResponse } from "next/server";
import { yugiohAdapter } from "@/features/catalog/services/card-api/yugioh.adapter";
import { cloneSearchResultForJson } from "@/features/catalog/services/serialize-search-results";
import { yugiohCardNamesMatch, yugiohSetNumberRef } from "@/lib/yugioh/lookup";
import { resolveYugiohPasscodeForCard } from "@/lib/yugioh/resolve-passcode";
import { isYugiohPasscodeId } from "@/lib/yugioh/passcode";
import type { CardSearchResult } from "@/features/catalog/services/card-api/types";

async function relatedYugiohPrints(result: CardSearchResult): Promise<CardSearchResult[]> {
  if (!result.name.trim()) return [];
  const prints = await yugiohAdapter.searchByNameOnly(result.name);
  return prints.filter((p) => p.externalId !== result.externalId);
}

async function resolveOwnedYugiohCard(body: {
  name?: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  externalId?: string | null;
}): Promise<{ result: CardSearchResult | null; relatedPrints: CardSearchResult[]; passcode: string | null }> {
  const name = body.name?.trim() ?? "";
  const setRef = yugiohSetNumberRef(body.setCode, body.collectorNumber);

  if (setRef) {
    const bySet = await yugiohAdapter.getBySetNumber(setRef);
    if (bySet && (!name || yugiohCardNamesMatch(bySet.name, name))) {
      const relatedPrints = await relatedYugiohPrints(bySet);
      return { result: bySet, relatedPrints, passcode: bySet.externalId };
    }
  }

  const storedId = body.externalId?.trim() ?? "";
  if (storedId && isYugiohPasscodeId(storedId, null)) {
    const byId = await yugiohAdapter.getById(storedId);
    if (byId && (!name || yugiohCardNamesMatch(byId.name, name))) {
      const relatedPrints = await relatedYugiohPrints(byId);
      return { result: byId, relatedPrints, passcode: storedId };
    }
  }

  if (name) {
    const passcode = await resolveYugiohPasscodeForCard({
      name,
      setCode: body.setCode,
      collectorNumber: body.collectorNumber,
    });
    if (passcode) {
      const detail = await yugiohAdapter.getById(passcode);
      if (detail && yugiohCardNamesMatch(detail.name, name)) {
        const relatedPrints = await relatedYugiohPrints(detail);
        return { result: detail, relatedPrints, passcode };
      }
    }

    const results = await yugiohAdapter.searchByNameOnly(name);
    const match = results.find((r) => yugiohCardNamesMatch(r.name, name)) ?? null;
    if (match) {
      const relatedPrints = await relatedYugiohPrints(match);
      return { result: match, relatedPrints, passcode: match.externalId };
    }
  }

  return { result: null, relatedPrints: [], passcode: null };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() ?? "";
  const set = searchParams.get("set")?.trim().toUpperCase() ?? "";

  try {
    const resolved = await resolveOwnedYugiohCard({
      name,
      setCode: set || null,
      collectorNumber: set || null,
    });

    return NextResponse.json({
      result: resolved.result ? cloneSearchResultForJson(resolved.result) : null,
      passcode: resolved.passcode,
    });
  } catch (error) {
    console.error("GET /api/cards/yugioh/resolve", error);
    return NextResponse.json({ error: "Failed to resolve card" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      setCode?: string | null;
      collectorNumber?: string | null;
      externalId?: string | null;
    };

    const resolved = await resolveOwnedYugiohCard(body);

    return NextResponse.json(
      {
        result: resolved.result ? cloneSearchResultForJson(resolved.result) : null,
        relatedPrints: resolved.relatedPrints.map(cloneSearchResultForJson),
        passcode: resolved.passcode,
      },
      { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("POST /api/cards/yugioh/resolve", error);
    return NextResponse.json({ error: "Failed to resolve card" }, { status: 500 });
  }
}

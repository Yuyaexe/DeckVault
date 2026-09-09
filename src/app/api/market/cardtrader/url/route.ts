import { NextRequest, NextResponse } from "next/server";
import { resolveCardTraderManaSearchUrl } from "@/lib/cardtrader/resolve-url";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const name = params.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing card name" }, { status: 400 });
  }

  try {
    const url = await resolveCardTraderManaSearchUrl({
      name,
      gameSlug: params.get("gameSlug"),
      externalId: params.get("externalId"),
      cardTraderBlueprintId: params.get("cardTraderBlueprintId"),
      setName: params.get("setName"),
      setCode: params.get("setCode"),
      rarity: params.get("rarity"),
      imageUrl: params.get("imageUrl"),
    });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Failed to resolve CardTrader URL" }, { status: 502 });
  }
}

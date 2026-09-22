import { NextRequest, NextResponse } from "next/server";
import { getDataContext } from "@/lib/data/server/data-context";
import { getCatalogImage } from "@/lib/purchases/catalog-image";
import { canAccessCardTraderPurchases } from "@/lib/purchases/access";

export async function GET(request: NextRequest) {
  const context = await getDataContext();
  if (!canAccessCardTraderPurchases(context.userId)) {
    return NextResponse.json({ error: "CardTrader purchases are unavailable for this account" }, { status: 403 });
  }
  if (!process.env.CARDTRADER_API_TOKEN) {
    return NextResponse.json({ error: "CardTrader is not configured" }, { status: 503 });
  }
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  const gameId = Number(request.nextUrl.searchParams.get("gameId"));
  if (!name || name.length > 200 || ![4, 8].includes(gameId)) {
    return NextResponse.json({ error: "Invalid card" }, { status: 400 });
  }
  const imageUrl = await getCatalogImage(name, gameId);
  return NextResponse.json({ imageUrl }, { headers: { "Cache-Control": "private, max-age=60" } });
}

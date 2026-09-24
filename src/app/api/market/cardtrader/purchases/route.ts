import { NextResponse } from "next/server";
import { createPurchaseLoader } from "@/lib/purchases/cardtrader";
import { canAccessCardTraderPurchases } from "@/lib/purchases/access";

const loadPurchases = createPurchaseLoader();

export async function GET() {
  if (!canAccessCardTraderPurchases()) {
    return NextResponse.json({ error: "CardTrader purchases are unavailable in this server mode" }, { status: 403 });
  }

  const token = process.env.CARDTRADER_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "CardTrader is not configured. Add CARDTRADER_API_TOKEN to the server environment." },
      { status: 503 }
    );
  }

  try {
    const purchases = await loadPurchases(token);
    return NextResponse.json(purchases, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/market/cardtrader/purchases", error);
    return NextResponse.json({ error: "Could not load CardTrader purchases" }, { status: 502 });
  }
}


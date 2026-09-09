import { NextResponse } from "next/server";

const API = "https://db.ygoprodeck.com/api/v7/cardsets.php";
const HEADERS = { Accept: "application/json", "User-Agent": "DeckVault/0.2" };

export interface YgoCardSetOption {
  setName: string;
  setCode: string;
  tcgDate: string | null;
}

export async function GET() {
  try {
    const res = await fetch(API, {
      headers: HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ sets: [] }, { status: 502 });
    }

    const json = (await res.json()) as {
      data?: { set_name: string; set_code: string; tcg_date?: string }[];
    };

    const sets: YgoCardSetOption[] = (json.data ?? [])
      .map((entry) => ({
        setName: entry.set_name,
        setCode: entry.set_code,
        tcgDate: entry.tcg_date ?? null,
      }))
      .sort((a, b) => a.setName.localeCompare(b.setName, "pt-BR"));

    return NextResponse.json(
      { sets },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } }
    );
  } catch (error) {
    console.error("GET /api/cards/yugioh/cardsets", error);
    return NextResponse.json({ sets: [] }, { status: 500 });
  }
}

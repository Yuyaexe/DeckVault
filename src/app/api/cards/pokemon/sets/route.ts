import { NextResponse } from "next/server";

const API = "https://api.pokemontcg.io/v2";

export async function GET() {
  const headers: HeadersInit = { Accept: "application/json" };
  const key = process.env.POKEMON_TCG_API_KEY;
  if (key) headers["X-Api-Key"] = key;

  try {
    const response = await fetch(`${API}/sets?pageSize=250&orderBy=-releaseDate`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return NextResponse.json({ sets: [] }, { status: response.status });
    }
    const data = (await response.json()) as {
      data?: Array<{ id: string; name: string; series?: string; printedTotal?: number }>;
    };
    return NextResponse.json({
      sets: (data.data ?? []).map((set) => ({
        id: set.id,
        name: set.name,
        series: set.series ?? null,
        printedTotal: set.printedTotal ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ sets: [] }, { status: 502 });
  }
}
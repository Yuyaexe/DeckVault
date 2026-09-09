import { NextRequest, NextResponse } from "next/server";
import { resolveDeckEntries } from "@/features/import/services/decklist-resolver";
import type { DecklistGameSlug, ParsedDeckEntry } from "@/features/import/types";
import {
  RESOLVE_DECK_MAX_ENTRIES,
  resolveDeckBodySchema,
} from "@/lib/api/request-limits";
import { enforceCatalogRateLimit } from "@/lib/api/enforce-rate-limit";

export async function POST(request: NextRequest) {
  const limited = enforceCatalogRateLimit(request, "resolve-deck");
  if (limited) return limited;

  try {
    const raw = await request.json();
    const parsed = resolveDeckBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
          maxEntries: RESOLVE_DECK_MAX_ENTRIES,
        },
        { status: 400 }
      );
    }

    const gameSlug = (parsed.data.gameSlug ?? "unknown") as DecklistGameSlug;
    const entries = parsed.data.entries as ParsedDeckEntry[];

    if (entries.length === 0) {
      return NextResponse.json({ resolved: [] });
    }

    if (entries.length > RESOLVE_DECK_MAX_ENTRIES) {
      return NextResponse.json(
        {
          error: `Too many entries (max ${RESOLVE_DECK_MAX_ENTRIES})`,
          maxEntries: RESOLVE_DECK_MAX_ENTRIES,
        },
        { status: 400 }
      );
    }

    const resolved = await resolveDeckEntries(entries, gameSlug);
    return NextResponse.json({ resolved });
  } catch (error) {
    console.error("POST /api/cards/resolve-deck", error);
    return NextResponse.json({ error: "Failed to resolve decklist" }, { status: 500 });
  }
}

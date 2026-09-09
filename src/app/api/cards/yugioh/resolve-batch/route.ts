import { NextRequest, NextResponse } from "next/server";
import {
  resolveYugiohPasscodesConcurrent,
  yugiohPasscodeCacheKey,
  type YugiohPasscodeInput,
} from "@/lib/yugioh/resolve-passcode";
import {
  RESOLVE_BATCH_MAX_CARDS,
  resolveBatchBodySchema,
} from "@/lib/api/request-limits";
import { enforceCatalogRateLimit } from "@/lib/api/enforce-rate-limit";

interface BatchCard extends YugiohPasscodeInput {
  id: string;
}

export async function POST(request: NextRequest) {
  const limited = enforceCatalogRateLimit(request, "resolve-batch");
  if (limited) return limited;

  try {
    const raw = await request.json();
    const parsed = resolveBatchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten(),
          maxCards: RESOLVE_BATCH_MAX_CARDS,
        },
        { status: 400 }
      );
    }

    const cards = parsed.data.cards as BatchCard[];
    if (cards.length === 0) {
      return NextResponse.json({ passcodes: {} as Record<string, string | null> });
    }

    const uniqueByKey = new Map<string, BatchCard>();
    for (const card of cards) {
      if (!card.id || !card.name?.trim()) continue;
      uniqueByKey.set(yugiohPasscodeCacheKey(card), card);
    }

    const resolvedByKey = await resolveYugiohPasscodesConcurrent(
      [...uniqueByKey.values()],
      8
    );

    const passcodes: Record<string, string | null> = {};
    for (const card of cards) {
      if (!card.id || !card.name?.trim()) {
        passcodes[card.id] = null;
        continue;
      }
      passcodes[card.id] = resolvedByKey.get(yugiohPasscodeCacheKey(card)) ?? null;
    }

    return NextResponse.json(
      { passcodes },
      { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("POST /api/cards/yugioh/resolve-batch", error);
    return NextResponse.json({ error: "Failed to resolve passcodes" }, { status: 500 });
  }
}

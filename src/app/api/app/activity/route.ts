import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import { listActivityEvents } from "@/lib/data/server/activity-service";
import type { ActivityAction } from "@/lib/activity/types";
import { ALL_ACTIVITY_SCOPE_ID } from "@/lib/activity/types";

export async function GET(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Use local store in demo mode" }, { status: 503 });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const collectionId = sp.get("collectionId");
    if (!collectionId) {
      return NextResponse.json({ error: "collectionId required" }, { status: 400 });
    }
    requireUserId(ctx);
    const supabase = requireSupabase(ctx);

    let events;
    if (collectionId === ALL_ACTIVITY_SCOPE_ID || collectionId === "all") {
      const { data: cols, error: colErr } = await supabase
        .from("collections")
        .select("id");
      if (colErr) throw colErr;
      const ids = (cols ?? []).map((c) => c.id as string);
      if (ids.length === 0) {
        return NextResponse.json({ events: [] });
      }
      events = await listActivityEvents(supabase, {
        collectionIds: ids,
        actorUserId: sp.get("actor") ?? undefined,
        action: (sp.get("action") as ActivityAction | null) ?? undefined,
        q: sp.get("q") ?? undefined,
        limit: Number(sp.get("limit") ?? 100),
        offset: Number(sp.get("offset") ?? 0),
      });
    } else {
      events = await listActivityEvents(supabase, {
        collectionId,
        actorUserId: sp.get("actor") ?? undefined,
        action: (sp.get("action") as ActivityAction | null) ?? undefined,
        q: sp.get("q") ?? undefined,
        limit: Number(sp.get("limit") ?? 100),
        offset: Number(sp.get("offset") ?? 0),
      });
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/app/activity", error);
    const message = error instanceof Error ? error.message : "Failed to load activity";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

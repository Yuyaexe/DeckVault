import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import {
  ActivityUndoConflictError,
  ActivityUndoNotAllowedError,
  undoActivityEvent,
} from "@/lib/data/server/activity-undo";

export async function POST(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    await undoActivityEvent(supabase, userId, body.eventId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/app/activity/undo", error);
    if (error instanceof ActivityUndoConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ActivityUndoNotAllowedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to undo";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

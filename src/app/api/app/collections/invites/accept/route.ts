import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import { acceptPendingInvites } from "@/lib/data/server/collaboration-service";

export async function POST(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const result = await acceptPendingInvites(supabase, userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/app/collections/invites/accept", error);
    const message = error instanceof Error ? error.message : "Failed to accept invites";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

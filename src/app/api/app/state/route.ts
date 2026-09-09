import { NextResponse } from "next/server";
import { getDataContext, requireSupabase, requireUserId } from "@/lib/data/server/data-context";
import { getSupabaseAppState } from "@/lib/data/server/supabase-service";

export async function GET() {
  const ctx = await getDataContext();

  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const supabase = requireSupabase(ctx);
    const state = await getSupabaseAppState(supabase, requireUserId(ctx));
    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/app/state", error);
    const message = error instanceof Error ? error.message : "Failed to load app state";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

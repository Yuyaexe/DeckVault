import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import { updateSupabaseProfile } from "@/lib/data/server/supabase-service";
import type { DemoProfile } from "@/lib/demo/types";

export async function PATCH(request: NextRequest) {
  const ctx = await getDataContext();
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Partial<DemoProfile>;
    const supabase = requireSupabase(ctx);
    await updateSupabaseProfile(supabase, requireUserId(ctx), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/app/profile", error);
    const message = error instanceof Error ? error.message : "Failed to update profile";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

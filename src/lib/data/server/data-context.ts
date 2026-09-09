import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

export type DataMode = "supabase" | "demo";

export interface DataContext {
  mode: DataMode;
  userId: string | null;
  supabase: SupabaseClient | null;
  applySessionCookies?: (response: NextResponse) => NextResponse;
}

export async function getDataContext(request?: NextRequest): Promise<DataContext> {
  if (isSupabaseConfigured()) {
    const routeClient = request ? createRouteHandlerClient(request) : null;
    const supabase = routeClient?.supabase ?? (await createSupabaseServer());

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return {
        mode: "supabase",
        userId: user.id,
        supabase,
        applySessionCookies: routeClient?.applySessionCookies,
      };
    }
  }

  return { mode: "demo", userId: null, supabase: null };
}

export function requireUserId(ctx: DataContext): string {
  if (!ctx.userId) throw new Error("Authentication required");
  return ctx.userId;
}

export function requireSupabase(ctx: DataContext): SupabaseClient {
  if (ctx.mode !== "supabase" || !ctx.supabase) {
    throw new Error("Authentication required");
  }
  return ctx.supabase;
}

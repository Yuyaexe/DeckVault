import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Service-role client for shared catalog writes; falls back only in local dev without admin key. */
export function getCatalogWriteClient(fallback: SupabaseClient): SupabaseClient {
  return getSupabaseAdmin() ?? fallback;
}

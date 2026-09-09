import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityAction,
  ActivityEvent,
  OwnedCardSnapshot,
} from "@/lib/activity/types";

type ActivityRow = {
  id: string;
  collection_id: string;
  actor_user_id: string;
  actor_display_name: string;
  action: string;
  owned_card_id: string | null;
  card_name: string | null;
  before_state: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
  after_state: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  undone_at: string | null;
  undone_by: string | null;
};

export function mapActivityRow(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    collectionId: row.collection_id,
    actorUserId: row.actor_user_id,
    actorDisplayName: row.actor_display_name,
    action: row.action as ActivityAction,
    ownedCardId: row.owned_card_id,
    cardName: row.card_name,
    beforeState: row.before_state,
    afterState: row.after_state,
    meta: row.meta ?? {},
    createdAt: row.created_at,
    undoneAt: row.undone_at,
    undoneBy: row.undone_by,
  };
}

export async function resolveActorDisplayName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const name = data?.display_name?.trim();
  return name && name.length > 0 ? name : "Collector";
}

export async function appendActivityEvent(
  supabase: SupabaseClient,
  input: {
    collectionId: string;
    actorUserId: string;
    actorDisplayName?: string;
    action: ActivityAction;
    ownedCardId?: string | null;
    cardName?: string | null;
    beforeState?: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
    afterState?: OwnedCardSnapshot | OwnedCardSnapshot[] | null;
    meta?: Record<string, unknown>;
  }
): Promise<ActivityEvent | null> {
  const actorDisplayName =
    input.actorDisplayName ??
    (await resolveActorDisplayName(supabase, input.actorUserId));

  const { data, error } = await supabase
    .from("collection_activity")
    .insert({
      collection_id: input.collectionId,
      actor_user_id: input.actorUserId,
      actor_display_name: actorDisplayName,
      action: input.action,
      owned_card_id: input.ownedCardId ?? null,
      card_name: input.cardName ?? null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      meta: input.meta ?? {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("appendActivityEvent", error);
    return null;
  }
  return mapActivityRow(data as ActivityRow);
}

export async function listActivityEvents(
  supabase: SupabaseClient,
  opts: {
    collectionId?: string;
    collectionIds?: string[];
    actorUserId?: string;
    action?: ActivityAction;
    q?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ActivityEvent[]> {
  let query = supabase
    .from("collection_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);

  if (opts.collectionIds && opts.collectionIds.length > 0) {
    query = query.in("collection_id", opts.collectionIds);
  } else if (opts.collectionId) {
    query = query.eq("collection_id", opts.collectionId);
  }

  if (opts.actorUserId) {
    query = query.eq("actor_user_id", opts.actorUserId);
  }
  if (opts.action) {
    query = query.eq("action", opts.action);
  }
  if (opts.q?.trim()) {
    query = query.ilike("card_name", `%${opts.q.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ActivityRow[]).map(mapActivityRow);
}

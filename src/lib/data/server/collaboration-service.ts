import type { SupabaseClient } from "@supabase/supabase-js";
import { appendActivityEvent, resolveActorDisplayName } from "@/lib/data/server/activity-service";
import type { CollectionMemberRole } from "@/lib/activity/types";

export interface CollectionMemberDto {
  id: string;
  collectionId: string;
  userId: string;
  role: CollectionMemberRole;
  displayName: string;
  email: string | null;
  createdAt: string;
  isOwner: boolean;
}

export interface CollectionInviteDto {
  id: string;
  collectionId: string;
  email: string;
  role: "editor" | "viewer";
  invitedBy: string;
  createdAt: string;
}

async function assertOwnsCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string
) {
  const { data, error } = await supabase
    .from("collections")
    .select("id, user_id, name")
    .eq("id", collectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Collection not found");
  if (data.user_id !== userId) throw new Error("Only the collection owner can manage sharing");
  return data as { id: string; user_id: string; name: string };
}

export async function listCollectionMembers(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string
): Promise<{ members: CollectionMemberDto[]; invites: CollectionInviteDto[]; ownerUserId: string }> {
  const { data: collection, error: colErr } = await supabase
    .from("collections")
    .select("id, user_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (colErr) throw colErr;
  if (!collection) throw new Error("Collection not found");

  const { data: memberRows, error: memErr } = await supabase
    .from("collection_members")
    .select("id, collection_id, user_id, role, created_at")
    .eq("collection_id", collectionId)
    .order("created_at");
  if (memErr) throw memErr;

  const userIds = [
    collection.user_id as string,
    ...(memberRows ?? []).map((m) => m.user_id as string),
  ];
  const uniqueIds = [...new Set(userIds)];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", uniqueIds);

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, (p.display_name as string) || "Collector"])
  );

  const members: CollectionMemberDto[] = [
    {
      id: `owner:${collection.user_id}`,
      collectionId,
      userId: collection.user_id,
      role: "owner",
      displayName: nameById.get(collection.user_id) ?? "Collector",
      email: null,
      createdAt: new Date(0).toISOString(),
      isOwner: true,
    },
    ...(memberRows ?? [])
      .filter((m) => m.user_id !== collection.user_id)
      .map((m) => ({
        id: m.id as string,
        collectionId: m.collection_id as string,
        userId: m.user_id as string,
        role: m.role as CollectionMemberRole,
        displayName: nameById.get(m.user_id) ?? "Collector",
        email: null,
        createdAt: m.created_at as string,
        isOwner: false,
      })),
  ];

  let invites: CollectionInviteDto[] = [];
  if (collection.user_id === userId) {
    const { data: inviteRows, error: invErr } = await supabase
      .from("collection_invites")
      .select("id, collection_id, email, role, invited_by, created_at")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false });
    if (invErr) throw invErr;
    invites = (inviteRows ?? []).map((i) => ({
      id: i.id as string,
      collectionId: i.collection_id as string,
      email: i.email as string,
      role: i.role as "editor" | "viewer",
      invitedBy: i.invited_by as string,
      createdAt: i.created_at as string,
    }));
  }

  return { members, invites, ownerUserId: collection.user_id };
}

export async function inviteToCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  email: string,
  role: "editor" | "viewer"
) {
  const collection = await assertOwnsCollection(supabase, userId, collectionId);
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Valid email required");

  const { data: invite, error } = await supabase
    .from("collection_invites")
    .upsert(
      {
        collection_id: collectionId,
        email: normalized,
        role,
        invited_by: userId,
      },
      { onConflict: "collection_id,email" }
    )
    .select("id, collection_id, email, role, invited_by, created_at")
    .single();
  if (error) throw error;

  const actorName = await resolveActorDisplayName(supabase, userId);
  await appendActivityEvent(supabase, {
    collectionId,
    actorUserId: userId,
    actorDisplayName: actorName,
    action: "invite_sent",
    meta: { email: normalized, role, collectionName: collection.name },
  });

  return {
    id: invite.id as string,
    collectionId: invite.collection_id as string,
    email: invite.email as string,
    role: invite.role as "editor" | "viewer",
    invitedBy: invite.invited_by as string,
    createdAt: invite.created_at as string,
  } satisfies CollectionInviteDto;
}

export async function removeCollectionMember(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  memberUserId: string
) {
  await assertOwnsCollection(supabase, userId, collectionId);
  if (memberUserId === userId) throw new Error("Cannot remove the owner");

  const { error } = await supabase
    .from("collection_members")
    .delete()
    .eq("collection_id", collectionId)
    .eq("user_id", memberUserId);
  if (error) throw error;

  const actorName = await resolveActorDisplayName(supabase, userId);
  await appendActivityEvent(supabase, {
    collectionId,
    actorUserId: userId,
    actorDisplayName: actorName,
    action: "member_removed",
    meta: { memberUserId },
  });
}

export async function cancelCollectionInvite(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  inviteId: string
) {
  await assertOwnsCollection(supabase, userId, collectionId);
  const { error } = await supabase
    .from("collection_invites")
    .delete()
    .eq("id", inviteId)
    .eq("collection_id", collectionId);
  if (error) throw error;
}

export async function acceptPendingInvites(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("accept_collection_invites");
  if (error) throw error;

  const accepted = typeof data === "number" ? data : 0;
  if (accepted > 0) {
    const actorName = await resolveActorDisplayName(supabase, userId);
    // Log a single summary join event is enough for MVP; per-collection detail is optional.
    // We don't know which collections without another query — skip detailed logs here.
    void actorName;
  }
  return { accepted };
}

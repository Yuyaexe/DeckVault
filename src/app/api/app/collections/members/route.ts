import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import {
  cancelCollectionInvite,
  inviteToCollection,
  listCollectionMembers,
  removeCollectionMember,
} from "@/lib/data/server/collaboration-service";

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Operation failed";
  if (message === "Authentication required") return { status: 401, message };
  if (message.includes("Only the collection owner")) return { status: 403, message };
  if (message.includes("not found")) return { status: 404, message };
  if (message.includes("email")) return { status: 400, message };
  return { status: 500, message };
}

export async function GET(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Sharing requires cloud mode" }, { status: 503 });
  }

  try {
    const collectionId = request.nextUrl.searchParams.get("collectionId");
    if (!collectionId) {
      return NextResponse.json({ error: "collectionId required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const result = await listCollectionMembers(supabase, userId, collectionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/app/collections/members", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Sharing requires cloud mode" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      collectionId: string;
      email: string;
      role?: "editor" | "viewer";
    };
    if (!body.collectionId || !body.email?.trim()) {
      return NextResponse.json({ error: "collectionId and email required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const invite = await inviteToCollection(
      supabase,
      userId,
      body.collectionId,
      body.email,
      body.role === "viewer" ? "viewer" : "editor"
    );
    return NextResponse.json({ invite });
  } catch (error) {
    console.error("POST /api/app/collections/members", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Sharing requires cloud mode" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      collectionId: string;
      memberUserId?: string;
      inviteId?: string;
    };
    if (!body.collectionId) {
      return NextResponse.json({ error: "collectionId required" }, { status: 400 });
    }
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);

    if (body.inviteId) {
      await cancelCollectionInvite(supabase, userId, body.collectionId, body.inviteId);
      return NextResponse.json({ ok: true });
    }
    if (body.memberUserId) {
      await removeCollectionMember(supabase, userId, body.collectionId, body.memberUserId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "memberUserId or inviteId required" }, { status: 400 });
  } catch (error) {
    console.error("DELETE /api/app/collections/members", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

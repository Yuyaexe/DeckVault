import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import {
  createSupabaseCollection,
  deleteSupabaseCollection,
  renameSupabaseCollection,
  toggleSupabaseCollectionFavorite,
} from "@/lib/data/server/supabase-service";

export async function POST(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const { name } = (await request.json()) as { name: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = requireSupabase(ctx);
    const collection = await createSupabaseCollection(
      supabase,
      requireUserId(ctx),
      name.trim()
    );

    const response = NextResponse.json(collection);
    return ctx.applySessionCookies?.(response) ?? response;
  } catch (error) {
    console.error("POST /api/app/collections", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "Failed to create collection";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { id: string; name?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Collection id required" }, { status: 400 });
    }

    const supabase = requireSupabase(ctx);

    if (body.name !== undefined) {
      const collection = await renameSupabaseCollection(
        supabase,
        body.id,
        body.name
      );
      const response = NextResponse.json(collection);
      return ctx.applySessionCookies?.(response) ?? response;
    }

    await toggleSupabaseCollectionFavorite(supabase, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/app/collections", error);
    const message = error instanceof Error ? error.message : "Failed to update collection";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) {
      return NextResponse.json({ error: "Collection id required" }, { status: 400 });
    }

    const supabase = requireSupabase(ctx);
    await deleteSupabaseCollection(supabase, requireUserId(ctx), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/app/collections", error);
    const message = error instanceof Error ? error.message : "Failed to delete collection";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

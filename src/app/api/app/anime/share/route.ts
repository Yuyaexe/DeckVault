import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import {
  acceptAnimeInvites,
  cancelAnimeInvite,
  getAnimeSnapshot,
  getAnimeSnapshotMeta,
  inviteToAnimeWorkspace,
  isAnimeWorkspaceShared,
  listAnimeShare,
  putAnimeSnapshot,
  removeAnimeMember,
  resolveAnimeWorkspace,
  resolveAnimeWorkspaceAfterAccept,
  type AnimeWorkspaceSnapshotState,
} from "@/lib/data/server/anime-share-service";
import {
  errorMessage,
  isAnimeShareTableMissingError,
} from "@/lib/data/server/error-message";

/** Large anime snapshots (thousands of cards) need a longer serverless budget. */
export const maxDuration = 60;

function apiError(error: unknown) {
  const message = errorMessage(error);
  if (message === "Authentication required") return { status: 401, message };
  if (message.includes("Only the")) return { status: 403, message };
  if (message.includes("Valid email") || message.includes("email required")) {
    return { status: 400, message };
  }
  if (
    isAnimeShareTableMissingError(message) ||
    message.includes("Anime share tables missing")
  ) {
    return {
      status: 503,
      message:
        "Anime share tables missing. Run migration 0013_anime_workspace_share.sql (and 0014) in Supabase.",
    };
  }
  return { status: 500, message };
}

async function currentUserEmail(
  supabase: ReturnType<typeof requireSupabase>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.trim().toLowerCase() ?? null;
}

export async function GET(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Sharing requires cloud mode" }, { status: 503 });
  }

  try {
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const view = request.nextUrl.searchParams.get("view") ?? "share";
    const email = await currentUserEmail(supabase);

    if (view === "snapshot") {
      const info = await resolveAnimeWorkspaceAfterAccept(supabase, userId, email);
      const isShared = await isAnimeWorkspaceShared(supabase, info);
      const snap = await getAnimeSnapshot(supabase, info.workspaceId);
      return NextResponse.json({
        ...info,
        ...snap,
        isShared,
        email,
        currentUserId: userId,
      });
    }

    if (view === "meta") {
      const info = await resolveAnimeWorkspaceAfterAccept(supabase, userId, email);
      const isShared = await isAnimeWorkspaceShared(supabase, info);
      const meta = isShared
        ? await getAnimeSnapshotMeta(supabase, info.workspaceId)
        : { updatedAt: null };
      return NextResponse.json({
        ...info,
        ...meta,
        isShared,
        email,
        currentUserId: userId,
      });
    }

    const share = await listAnimeShare(supabase, userId);
    return NextResponse.json(share);
  } catch (error) {
    console.error("GET /api/app/anime/share", error);
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
      action?: string;
      email?: string;
      role?: "editor" | "viewer";
      state?: AnimeWorkspaceSnapshotState;
      basedOnUpdatedAt?: string | null;
    };
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const email = await currentUserEmail(supabase);

    if (body.action === "accept") {
      const result = await acceptAnimeInvites(supabase, { userId, email });
      return NextResponse.json(result);
    }

    if (body.action === "invite") {
      if (!body.email?.trim()) {
        return NextResponse.json({ error: "email required" }, { status: 400 });
      }
      const invite = await inviteToAnimeWorkspace(
        supabase,
        userId,
        body.email,
        body.role === "viewer" ? "viewer" : "editor",
        body.state
      );
      return NextResponse.json({ invite });
    }

    if (body.action === "push") {
      if (!body.state) {
        return NextResponse.json({ error: "state required" }, { status: 400 });
      }
      // Resolve only (accept happens on pull) — avoid extra RPC on large uploads.
      const info = await resolveAnimeWorkspace(supabase, userId);
      const isShared = await isAnimeWorkspaceShared(supabase, info);
      if (!isShared) {
        return NextResponse.json(
          {
            error: "Anime sync only runs when the workspace is shared",
            isShared: false,
          },
          { status: 409 }
        );
      }
      if (info.role === "viewer") {
        return NextResponse.json({ error: "Viewer cannot edit anime" }, { status: 403 });
      }
      // Never let a shared member overwrite owner data with an empty local snapshot.
      if (info.isOwner === false) {
        const hasData =
          (body.state.animeSeries?.length ?? 0) > 0 ||
          (body.state.animeCharacters?.length ?? 0) > 0 ||
          (body.state.animeCharacterCards?.length ?? 0) > 0;
        if (!hasData) {
          return NextResponse.json(
            { error: "Refusing to push empty anime state over shared workspace" },
            { status: 400 }
          );
        }
      }

      const basedOn = body.basedOnUpdatedAt ?? null;
      const meta = await getAnimeSnapshotMeta(supabase, info.workspaceId);
      if (
        basedOn != null &&
        meta.updatedAt != null &&
        basedOn !== meta.updatedAt
      ) {
        // Only load the full blob when the client must merge.
        const current = await getAnimeSnapshot(supabase, info.workspaceId);
        return NextResponse.json(
          {
            error: "Anime snapshot conflict",
            conflict: true,
            state: current.state,
            updatedAt: current.updatedAt,
            updatedByUserId: current.updatedByUserId,
            updatedByDisplayName: current.updatedByDisplayName,
            workspaceId: info.workspaceId,
            isShared: true,
            currentUserId: userId,
          },
          { status: 409 }
        );
      }

      const saved = await putAnimeSnapshot(
        supabase,
        userId,
        info.workspaceId,
        body.state
      );
      return NextResponse.json({
        ok: true,
        workspaceId: info.workspaceId,
        updatedAt: saved.updatedAt,
        isShared: true,
      });
    }

    if (body.action === "meta") {
      const info = await resolveAnimeWorkspaceAfterAccept(supabase, userId, email);
      const isShared = await isAnimeWorkspaceShared(supabase, info);
      const meta = isShared
        ? await getAnimeSnapshotMeta(supabase, info.workspaceId)
        : { updatedAt: null };
      return NextResponse.json({
        ...info,
        ...meta,
        isShared,
        email,
        currentUserId: userId,
      });
    }

    if (body.action === "pull") {
      const info = await resolveAnimeWorkspaceAfterAccept(supabase, userId, email);
      const isShared = await isAnimeWorkspaceShared(supabase, info);
      if (!isShared) {
        return NextResponse.json({
          ...info,
          isShared: false,
          state: null,
          updatedAt: null,
          email,
          currentUserId: userId,
        });
      }
      const snap = await getAnimeSnapshot(supabase, info.workspaceId);
      return NextResponse.json({
        ...info,
        ...snap,
        isShared: true,
        email,
        currentUserId: userId,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/app/anime/share", error);
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
      memberUserId?: string;
      inviteId?: string;
    };
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);

    if (body.inviteId) {
      await cancelAnimeInvite(supabase, userId, body.inviteId);
      return NextResponse.json({ ok: true });
    }
    if (body.memberUserId) {
      await removeAnimeMember(supabase, userId, body.memberUserId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "memberUserId or inviteId required" }, { status: 400 });
  } catch (error) {
    console.error("DELETE /api/app/anime/share", error);
    const { status, message } = apiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

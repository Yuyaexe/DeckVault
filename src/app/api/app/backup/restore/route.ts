import { NextRequest, NextResponse } from "next/server";
import {
  getDataContext,
  requireSupabase,
  requireUserId,
} from "@/lib/data/server/data-context";
import { parseBackupJson } from "@/features/import/services/backup-import";
import { restoreSupabaseBackup } from "@/lib/data/server/restore-supabase-backup";
import {
  RESTORE_STAGES,
  RestoreStepError,
  formatRestoreCause,
} from "@/features/import/services/restore-debug";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ctx = await getDataContext(request);
  if (ctx.mode === "demo") {
    return NextResponse.json({ error: "Not in server mode" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const backup = parseBackupJson(body.backup);
    const supabase = requireSupabase(ctx);
    const userId = requireUserId(ctx);
    const result = await restoreSupabaseBackup(supabase, userId, backup);
    const response = NextResponse.json(result);
    return ctx.applySessionCookies?.(response) ?? response;
  } catch (error) {
    console.error("POST /api/app/backup/restore", error);

    if (error instanceof RestoreStepError) {
      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          stageLabel: RESTORE_STAGES[error.stage],
          detail: error.detail,
        },
        { status: 500 }
      );
    }

    const message = formatRestoreCause(error);
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { getDataContext } from "@/lib/data/server/data-context";

export async function GET() {
  const ctx = await getDataContext();
  return NextResponse.json({ mode: ctx.mode });
}

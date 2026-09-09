import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip auth refresh on hot image/search proxies — they fire once per visible card.
    "/((?!_next/static|_next/image|favicon.ico|api/cards/search|api/proxy-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

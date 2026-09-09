import { NextResponse } from "next/server";
import {
  CATALOG_RATE,
  checkRateLimit,
  clientIpFromRequest,
} from "@/lib/api/rate-limit";

/** Returns a 429 response if the IP exceeded the catalog rate limit for `route`. */
export function enforceCatalogRateLimit(
  request: Request,
  route: string
): NextResponse | null {
  const ip = clientIpFromRequest(request);
  const result = checkRateLimit({
    key: `${route}:${ip}`,
    limit: CATALOG_RATE.limit,
    windowMs: CATALOG_RATE.windowMs,
  });
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Limit": String(CATALOG_RATE.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

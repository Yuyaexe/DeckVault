import { NextRequest, NextResponse } from "next/server";
import { isTrustedImageUrl } from "@/lib/cache/trusted-image-hosts";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw || !isTrustedImageUrl(raw)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(raw, {
      headers: { "User-Agent": "DeckVault/1.0 (proxy-image-proxy)" },
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream failed" }, { status: upstream.status });
    }
    const bytes = await upstream.arrayBuffer();
    const contentType = sniffImageContentType(bytes, upstream.headers.get("content-type"));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("GET /api/proxy-image", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}

function sniffImageContentType(bytes: ArrayBuffer, fallback: string | null): string {
  const u8 = new Uint8Array(bytes);
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    u8.length >= 6 &&
    u8[0] === 0x47 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return "image/webp";
  }
  if (fallback && fallback.startsWith("image/")) return fallback;
  return "image/jpeg";
}

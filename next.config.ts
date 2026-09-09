import type { NextConfig } from "next";
import path from "path";
import { TRUSTED_IMAGE_REMOTE_HOSTNAMES } from "@/lib/cache/trusted-image-hosts";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      ...TRUSTED_IMAGE_REMOTE_HOSTNAMES.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.cardtrader.com" },
    ],
  },
};

export default nextConfig;

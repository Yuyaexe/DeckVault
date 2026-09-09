"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCachedCardImage } from "@/hooks/useCachedCardImage";
import { isTrustedImageUrl } from "@/lib/cache/trusted-image-hosts";
import { cn } from "@/lib/utils";

interface CardImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  sizes?: string;
  /** Used when the primary URL fails to load (e.g. CardTrader placeholder). */
  fallbackSrc?: string | null;
  /** Show pulse skeleton while passcode/image is resolving. */
  loading?: boolean;
  /**
   * Read thumbnails from IndexedDB / proxy when available.
   * Default off for list thumbs (avoids IDB+proxy storm); enable for inspect/offline.
   */
  useLocalCache?: boolean;
}

function canOptimizeRemote(src: string): boolean {
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (src.startsWith("/")) return true;
  return isTrustedImageUrl(src);
}

export function CardImage({
  src,
  alt,
  width,
  height,
  className,
  fill,
  sizes,
  fallbackSrc,
  loading = false,
  useLocalCache = false,
}: CardImageProps) {
  const [error, setError] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const cachedSrc = useCachedCardImage(useLocalCache ? activeSrc : null);
  const displaySrc = cachedSrc ?? activeSrc;

  useEffect(() => {
    setError(false);
    setActiveSrc(src);
  }, [src]);

  useEffect(() => {
    if (
      error &&
      fallbackSrc &&
      fallbackSrc !== activeSrc &&
      fallbackSrc !== src
    ) {
      setError(false);
      setActiveSrc(fallbackSrc);
    }
  }, [error, fallbackSrc, activeSrc, src]);

  if (loading && !displaySrc) {
    return (
      <div
        className={cn("animate-pulse bg-muted/70", className)}
        style={!fill ? { width, height } : undefined}
        aria-hidden
      />
    );
  }

  if (!displaySrc || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-[10px] text-muted-foreground",
          className
        )}
        style={!fill ? { width, height } : undefined}
      >
        N/A
      </div>
    );
  }

  if (displaySrc.startsWith("data:") || displaySrc.startsWith("blob:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={displaySrc}
        alt={alt}
        className={cn(fill && "absolute inset-0 h-full w-full", "object-contain", className)}
        onError={() => setError(true)}
      />
    );
  }

  const optimize = canOptimizeRemote(displaySrc);

  return (
    <Image
      src={displaySrc}
      alt={alt}
      width={fill ? undefined : width ?? 120}
      height={fill ? undefined : height ?? 168}
      fill={fill}
      sizes={sizes ?? "(max-width: 768px) 25vw, 120px"}
      unoptimized={!optimize}
      className={cn("object-contain", className)}
      onError={() => setError(true)}
    />
  );
}

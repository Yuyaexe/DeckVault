"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { resolveAnimeImageSrc } from "@/features/anime-collection/utils/anime-image";

export interface AnimeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  onErrorFallback?: ReactNode;
}

export function AnimeImage({
  src,
  alt,
  className,
  fill = false,
  onErrorFallback,
}: AnimeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveAnimeImageSrc(src);

  if (!resolved || failed) {
    return <>{onErrorFallback ?? null}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={cn(fill && "absolute inset-0 h-full w-full", className)}
      onError={() => setFailed(true)}
    />
  );
}

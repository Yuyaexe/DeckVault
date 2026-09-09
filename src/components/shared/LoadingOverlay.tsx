"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  active: boolean;
  title: string;
  description?: string;
  /** Cover the full viewport — use for long operations like backup restore. */
  fullscreen?: boolean;
  className?: string;
}

export function LoadingOverlay({
  active,
  title,
  description,
  fullscreen = false,
  className,
}: LoadingOverlayProps) {
  if (!active) return null;

  return (
    <div
      className={cn(
        "z-50 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm",
        fullscreen ? "fixed inset-0" : "absolute inset-0 rounded-[inherit]",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <div className="max-w-xs px-4 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

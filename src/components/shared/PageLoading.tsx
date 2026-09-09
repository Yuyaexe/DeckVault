"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

interface PageLoadingProps {
  label?: string;
  className?: string;
}

export function PageLoading({ label, className }: PageLoadingProps) {
  const t = useT();
  const displayLabel = label ?? t("common.loading");

  return (
    <div
      className={cn(
        "flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm">{displayLabel}</p>
    </div>
  );
}

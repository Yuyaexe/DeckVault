"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  BINDER_GRID_LAYOUTS,
  type BinderGridLayoutId,
} from "@/lib/collections/binder-layout";
import { cn } from "@/lib/utils";

export { BINDER_GRID_LAYOUTS, type BinderGridLayoutId };

/** Empty dashed slot used by TCG and anime binders. */
export function BinderEmptySlot({
  className,
  footerClassName,
}: {
  className?: string;
  footerClassName?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "aspect-[59/86] rounded-md border border-dashed border-stone-400/25 bg-stone-500/5 dark:border-stone-600/30 dark:bg-stone-950/20",
          className
        )}
      />
      <div
        className={cn(
          "h-9 rounded-md border border-dashed border-stone-400/20 bg-stone-500/5 dark:border-stone-600/25 dark:bg-stone-950/15",
          footerClassName
        )}
      />
    </>
  );
}

export function BinderLayoutToggle({
  layout,
  onChange,
  ariaLabel,
}: {
  layout: BinderGridLayoutId;
  onChange: (layout: BinderGridLayoutId) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {(Object.keys(BINDER_GRID_LAYOUTS) as BinderGridLayoutId[]).map((id) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2.5 text-xs tabular-nums",
            layout === id && "bg-background shadow-sm"
          )}
          onClick={() => onChange(id)}
          aria-pressed={layout === id}
        >
          {BINDER_GRID_LAYOUTS[id].label}
        </Button>
      ))}
    </div>
  );
}

export function BinderPagePanel({
  side,
  cols,
  rows,
  children,
}: {
  side: "left" | "right";
  cols: number;
  rows: number;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 flex-col p-2 sm:p-4",
        "bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/90 dark:from-stone-800 dark:via-stone-900 dark:to-stone-950",
        side === "left"
          ? "rounded-t-xl md:rounded-l-2xl md:rounded-tr-none"
          : "rounded-b-xl md:rounded-r-2xl md:rounded-bl-none"
      )}
    >
      <div
        className="grid flex-1 gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function BinderSpine() {
  return (
    <div
      className="relative h-2 w-full shrink-0 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 md:h-auto md:w-3 md:bg-gradient-to-b lg:w-4"
      aria-hidden
    />
  );
}

export function BinderSpreadFrame({
  maxWidth,
  children,
}: {
  maxWidth: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-b from-zinc-950 via-zinc-900/95 to-background">
      <div className="flex flex-col items-center px-2 py-3 sm:px-4 sm:py-5">
        <div className={cn("w-full", maxWidth)}>{children}</div>
      </div>
    </div>
  );
}

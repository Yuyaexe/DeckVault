"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TruncatedTooltipProps {
  text: string | null | undefined;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

function useIsTruncated(text: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [check, text]);

  return { ref, truncated };
}

export function TruncatedTooltip({
  text,
  className,
  side = "top",
}: TruncatedTooltipProps) {
  const value = text?.trim();

  if (!value || value === "—") {
    return <span className={cn("truncate", className)}>—</span>;
  }

  return (
    <TruncatedTooltipInner
      value={value}
      className={className}
      side={side}
    />
  );
}

function TruncatedTooltipInner({
  value,
  className,
  side,
}: {
  value: string;
  className?: string;
  side: "top" | "right" | "bottom" | "left";
}) {
  const { ref, truncated } = useIsTruncated(value);

  return (
    <Tooltip open={truncated ? undefined : false} delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn("block min-w-0 truncate", className)}
          title={truncated ? value : undefined}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {value}
        </span>
      </TooltipTrigger>
      {truncated && (
        <TooltipContent side={side} className="max-w-sm text-sm">
          {value}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

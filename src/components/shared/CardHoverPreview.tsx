"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardImage } from "@/components/shared/CardImage";
import { cn } from "@/lib/utils";

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 280;
const GAP = 12;
const VIEWPORT_MARGIN = 12;
const SHOW_DELAY_MS = 180;

interface CardHoverPreviewProps {
  src: string | null | undefined;
  previewSrc?: string | null;
  alt: string;
  children: React.ReactNode;
  className?: string;
}

function computePosition(anchor: DOMRect): { top: number; left: number } {
  // Align with the row top so the preview does not cover rows above/below.
  let top = anchor.top;
  let left = anchor.right + GAP;

  if (left + PREVIEW_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = anchor.left - PREVIEW_WIDTH - GAP;
  }

  if (left < VIEWPORT_MARGIN) {
    left = window.innerWidth - PREVIEW_WIDTH - VIEWPORT_MARGIN;
  }

  if (top + PREVIEW_HEIGHT > window.innerHeight - VIEWPORT_MARGIN) {
    top = window.innerHeight - PREVIEW_HEIGHT - VIEWPORT_MARGIN;
  }
  top = Math.max(VIEWPORT_MARGIN, top);

  return { top, left };
}

export function CardHoverPreview({
  src,
  previewSrc,
  alt,
  children,
  className,
}: CardHoverPreviewProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const imageSrc = previewSrc ?? src;

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    setPosition(computePosition(anchor.getBoundingClientRect()));
  }, []);

  const hide = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setVisible(false);
  }, []);

  const show = useCallback(() => {
    if (!imageSrc) return;
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      updatePosition();
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, [imageSrc, updatePosition]);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible, updatePosition]);

  useEffect(() => () => hide(), [hide]);

  return (
    <>
      <div
        ref={anchorRef}
        className={cn("inline-flex", className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>

      {visible &&
        imageSrc &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top: position.top, left: position.left, width: PREVIEW_WIDTH }}
            role="presentation"
          >
            <div className="overflow-hidden rounded-xl bg-zinc-950/95 shadow-2xl ring-1 ring-border/60 backdrop-blur-sm">
              <CardImage
                src={imageSrc}
                alt={alt}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                useLocalCache
                className="object-contain bg-zinc-950"
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

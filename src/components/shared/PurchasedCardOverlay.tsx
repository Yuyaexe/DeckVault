"use client";

import { useDataUiStore } from "@/lib/data/ui-store";
import { usePurchasedCardMatch } from "@/hooks/usePurchasedCardMatch";
import { useT } from "@/lib/i18n/context";
import type { PurchaseMatchInput } from "@/lib/purchases/types";

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(34, 197, 94, ${alpha})`;
  }
  const n = Number.parseInt(normalized, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function PurchasedCardOverlay({ card }: { card: PurchaseMatchInput }) {
  const t = useT();
  const color = useDataUiStore((s) => s.purchasedOverlayColor);
  const opacity = useDataUiStore((s) => s.purchasedOverlayOpacity);
  const purchased = usePurchasedCardMatch(card);

  if (!purchased) return null;

  return (
    <span
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
      aria-label={t("purchases.overlayLabel")}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundColor: hexToRgba(color, opacity) }}
        aria-hidden
      />
      <span
        className="absolute inset-x-0 bottom-0 h-1.5"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    </span>
  );
}

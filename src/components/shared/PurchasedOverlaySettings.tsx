"use client";

import { Label } from "@/components/ui/label";
import { useDataUiStore } from "@/lib/data/ui-store";
import { useT } from "@/lib/i18n/context";

const PRESET_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#a855f7", "#ef4444", "#f8fafc"];

export function PurchasedOverlaySettings() {
  const t = useT();
  const enabled = useDataUiStore((s) => s.purchasedOverlayEnabled);
  const color = useDataUiStore((s) => s.purchasedOverlayColor);
  const opacity = useDataUiStore((s) => s.purchasedOverlayOpacity);
  const setEnabled = useDataUiStore((s) => s.setPurchasedOverlayEnabled);
  const setColor = useDataUiStore((s) => s.setPurchasedOverlayColor);
  const setOpacity = useDataUiStore((s) => s.setPurchasedOverlayOpacity);

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("settings.purchasedOverlay")}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{t("settings.purchasedOverlayHint")}</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t("settings.purchasedOverlayEnable")}
      </label>

      {enabled && (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="space-y-2">
            <Label htmlFor="purchased-overlay-color">{t("settings.purchasedOverlayColor")}</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className="h-7 w-7 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    backgroundColor: preset,
                    boxShadow:
                      color.toLowerCase() === preset
                        ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary))"
                        : "0 0 0 1px hsl(var(--border))",
                  }}
                  aria-label={preset}
                  aria-pressed={color.toLowerCase() === preset}
                />
              ))}
              <input
                id="purchased-overlay-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchased-overlay-opacity">
              {t("settings.purchasedOverlayOpacity")} ({Math.round(opacity * 100)}%)
            </Label>
            <input
              id="purchased-overlay-opacity"
              type="range"
              min={0.1}
              max={0.7}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="relative h-16 w-12 overflow-hidden rounded-md bg-muted ring-1 ring-border">
            <span className="absolute inset-0 bg-zinc-500/40" aria-hidden />
            <span
              className="absolute inset-0"
              style={{
                backgroundColor: `${color}${Math.round(opacity * 255)
                  .toString(16)
                  .padStart(2, "0")}`,
              }}
              aria-hidden
            />
            <span
              className="absolute inset-x-0 bottom-0 h-1.5"
              style={{ backgroundColor: color }}
              aria-hidden
            />
          </div>
        </div>
      )}
    </div>
  );
}

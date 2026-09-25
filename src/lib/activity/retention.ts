import type { DemoActivityEvent } from "@/lib/demo/types";

export const ACTIVITY_RETENTION_DAYS = 7;
export const ACTIVITY_RETENTION_MS =
  ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function pruneExpiredActivityEvents(
  events: DemoActivityEvent[],
  nowMs = Date.now()
): DemoActivityEvent[] {
  const cutoff = nowMs - ACTIVITY_RETENTION_MS;

  return events.filter((event) => {
    const createdAtMs = Date.parse(event.createdAt);
    if (!Number.isFinite(createdAtMs)) return true;
    return createdAtMs >= cutoff;
  });
}

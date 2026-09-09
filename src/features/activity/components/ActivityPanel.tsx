"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoading } from "@/components/shared/PageLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { useAppData } from "@/hooks/useAppData";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useDemoStore } from "@/lib/demo/store";
import {
  ALL_ACTIVITY_SCOPE_ID,
  ANIME_ACTIVITY_COLLECTION_ID,
  isUndoableEvent,
  type ActivityAction,
  type ActivityEvent,
  type OwnedCardSnapshot,
} from "@/lib/activity/types";
import type { DemoActivityEvent } from "@/lib/demo/types";
import { useT, useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";
import { History } from "lucide-react";
import { toast } from "sonner";

function toActivityEvent(row: DemoActivityEvent | ActivityEvent): ActivityEvent {
  return {
    id: row.id,
    collectionId: row.collectionId,
    actorUserId: row.actorUserId,
    actorDisplayName: row.actorDisplayName,
    action: row.action as ActivityAction,
    ownedCardId: row.ownedCardId,
    cardName: row.cardName,
    beforeState: row.beforeState as ActivityEvent["beforeState"],
    afterState: row.afterState as ActivityEvent["afterState"],
    meta: row.meta ?? {},
    createdAt: row.createdAt,
    undoneAt: row.undoneAt,
    undoneBy: row.undoneBy,
  };
}

function formatRelative(iso: string, locale: string): string {
  const date = new Date(iso);
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

function describeAction(
  event: ActivityEvent,
  t: (key: MessageKey, params?: Record<string, string | number>) => string
): string {
  switch (event.action) {
    case "import":
      return t("activity.action.import", {
        count: Number(event.meta.imported ?? 0),
      });
    case "card_updated": {
      const before = event.beforeState as OwnedCardSnapshot | null;
      const after = event.afterState as OwnedCardSnapshot | null;
      if (before && after && before.quantity !== after.quantity) {
        return `${t("activity.action.card_updated")} · ${t("activity.qtyChange", {
          from: before.quantity,
          to: after.quantity,
        })}`;
      }
      return t("activity.action.card_updated");
    }
    case "card_added":
      return t("activity.action.card_added");
    case "card_deleted":
      return t("activity.action.card_deleted");
    case "cards_bulk_deleted":
      return t("activity.action.cards_bulk_deleted");
    case "invite_sent":
      return t("activity.action.invite_sent");
    case "member_joined":
      return t("activity.action.member_joined");
    case "member_removed":
      return t("activity.action.member_removed");
    case "undo":
      return t("activity.action.undo");
    default:
      return event.action;
  }
}

const ACTION_FILTERS: Array<ActivityAction | "all"> = [
  "all",
  "card_added",
  "card_updated",
  "card_deleted",
  "cards_bulk_deleted",
  "import",
  "invite_sent",
  "member_removed",
  "undo",
];

function matchesScope(
  event: ActivityEvent,
  scope: string,
  tcgIds: Set<string>
): boolean {
  if (scope === ALL_ACTIVITY_SCOPE_ID) {
    return (
      event.collectionId === ANIME_ACTIVITY_COLLECTION_ID ||
      tcgIds.has(event.collectionId)
    );
  }
  if (scope === ANIME_ACTIVITY_COLLECTION_ID) {
    return event.collectionId === ANIME_ACTIVITY_COLLECTION_ID;
  }
  return event.collectionId === scope;
}

export function ActivityPanel() {
  const t = useT();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { isSupabaseMode } = useAppConfig();
  const { collections, activeCollectionId, isLoading } = useAppData();
  const demoEvents = useDemoStore((s) => s.activityEvents);

  const initialScope =
    searchParams.get("scope") === "all"
      ? ALL_ACTIVITY_SCOPE_ID
      : searchParams.get("scope") === "anime"
        ? ANIME_ACTIVITY_COLLECTION_ID
        : activeCollectionId ?? collections[0]?.id ?? ALL_ACTIVITY_SCOPE_ID;

  const [scope, setScope] = useState(initialScope);
  const [actorFilter, setActorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<ActivityAction | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const sp = searchParams.get("scope");
    if (sp === "all") setScope(ALL_ACTIVITY_SCOPE_ID);
    else if (sp === "anime") setScope(ANIME_ACTIVITY_COLLECTION_ID);
  }, [searchParams]);

  const tcgIds = useMemo(
    () => new Set(collections.map((c) => c.id)),
    [collections]
  );

  const collectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collections) map.set(c.id, c.name);
    map.set(ANIME_ACTIVITY_COLLECTION_ID, t("activity.scopeAnime"));
    return map;
  }, [collections, t]);

  const cloudScope =
    scope === ANIME_ACTIVITY_COLLECTION_ID
      ? null
      : scope === ALL_ACTIVITY_SCOPE_ID
        ? ALL_ACTIVITY_SCOPE_ID
        : scope;

  const cloudQuery = useQuery({
    queryKey: ["activity", cloudScope, actorFilter, actionFilter, query],
    enabled: isSupabaseMode && Boolean(cloudScope),
    queryFn: async () => {
      const params = new URLSearchParams({ collectionId: cloudScope! });
      if (actorFilter !== "all") params.set("actor", actorFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/app/activity?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load activity");
      return (json.events as ActivityEvent[]).map(toActivityEvent);
    },
  });

  const events = useMemo(() => {
    const localAll = (demoEvents ?? []).map(toActivityEvent);
    const localFiltered = localAll.filter((e) => matchesScope(e, scope, tcgIds));

    let list: ActivityEvent[];
    if (!isSupabaseMode) {
      list = localFiltered;
    } else if (scope === ANIME_ACTIVITY_COLLECTION_ID) {
      list = localFiltered;
    } else if (scope === ALL_ACTIVITY_SCOPE_ID) {
      const cloud = cloudQuery.data ?? [];
      const animeLocal = localAll.filter(
        (e) => e.collectionId === ANIME_ACTIVITY_COLLECTION_ID
      );
      const byId = new Map<string, ActivityEvent>();
      for (const e of [...cloud, ...animeLocal]) byId.set(e.id, e);
      list = [...byId.values()];
    } else {
      list = cloudQuery.data ?? [];
    }

    if (actorFilter !== "all") {
      list = list.filter((e) => e.actorUserId === actorFilter);
    }
    if (actionFilter !== "all") {
      list = list.filter((e) => e.action === actionFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((e) => (e.cardName ?? "").toLowerCase().includes(q));
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [
    isSupabaseMode,
    cloudQuery.data,
    demoEvents,
    scope,
    tcgIds,
    actorFilter,
    actionFilter,
    query,
  ]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      map.set(e.actorUserId, e.actorDisplayName);
    }
    return [...map.entries()];
  }, [events]);

  const scopeOptions = useMemo(
    () => [
      { value: ALL_ACTIVITY_SCOPE_ID, label: t("activity.scopeAll") },
      { value: ANIME_ACTIVITY_COLLECTION_ID, label: t("activity.scopeAnime") },
      ...collections.map((c) => ({ value: c.id, label: c.name })),
    ],
    [collections, t]
  );

  const showCollectionColumn = scope === ALL_ACTIVITY_SCOPE_ID;

  const undoMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!isSupabaseMode) {
        const result = useDemoStore.getState().undoActivityEvent(eventId);
        if ("error" in result) {
          const err = new Error(result.error) as Error & { status?: number };
          err.status = result.status;
          throw err;
        }
        return;
      }
      const res = await fetch("/api/app/activity/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json.error ?? "Undo failed") as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
    },
    onSuccess: async () => {
      toast.success(t("activity.undoSuccess"));
      if (isSupabaseMode) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["activity"] }),
          queryClient.invalidateQueries({ queryKey: ["app-state"] }),
        ]);
      }
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) {
        toast.error(t("activity.undoConflict"));
        return;
      }
      if (err.status === 400) {
        toast.error(t("activity.undoNotAllowed"));
        return;
      }
      toast.error(err.message || t("activity.undoFailed"));
    },
  });

  if (isLoading) return <PageLoading />;

  const gridCols = showCollectionColumn
    ? "sm:grid-cols-[110px_1fr_1fr_1.1fr_1.2fr_90px]"
    : "sm:grid-cols-[120px_1fr_1.2fr_1.4fr_100px]";

  return (
    <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
      <PageHeader title={t("activity.title")} description={t("activity.description")} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px] flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{t("activity.filterCollection")}</p>
          <ResponsiveSelect
            value={scopeOptions.some((o) => o.value === scope) ? scope : ALL_ACTIVITY_SCOPE_ID}
            onValueChange={setScope}
            options={scopeOptions}
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{t("activity.filterActor")}</p>
          <ResponsiveSelect
            value={actorFilter}
            onValueChange={setActorFilter}
            options={[
              { value: "all", label: t("activity.filterAll") },
              ...actors.map(([id, name]) => ({ value: id, label: name })),
            ]}
          />
        </div>
        <div className="min-w-[160px] flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{t("activity.filterAction")}</p>
          <ResponsiveSelect
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as ActivityAction | "all")}
            options={ACTION_FILTERS.map((a) => ({
              value: a,
              label:
                a === "all"
                  ? t("activity.filterAll")
                  : a === "import"
                    ? t("activity.action.import", { count: "…" })
                    : t(`activity.action.${a}` as MessageKey),
            }))}
          />
        </div>
        <div className="min-w-[180px] flex-[1.5] space-y-1">
          <p className="text-xs text-muted-foreground">{t("activity.card")}</p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("activity.searchCard")}
          />
        </div>
      </div>

      {isSupabaseMode && cloudQuery.isLoading && cloudScope ? (
        <div className="mt-10">
          <PageLoading />
        </div>
      ) : events.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={History}
            title={t("activity.empty")}
            description={t("activity.description")}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border/70">
          <div
            className={`hidden gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid ${gridCols}`}
          >
            <span>{t("activity.when")}</span>
            <span>{t("activity.who")}</span>
            {showCollectionColumn && <span>{t("activity.filterCollection")}</span>}
            <span>{t("activity.action")}</span>
            <span>{t("activity.card")}</span>
            <span />
          </div>
          <ul className="divide-y divide-border/50">
            {events.map((event) => {
              const undoable = isUndoableEvent(event);
              const sourceLabel =
                collectionNameById.get(event.collectionId) ??
                (event.meta.characterName
                  ? String(event.meta.characterName)
                  : event.collectionId);
              return (
                <li
                  key={event.id}
                  className={`grid gap-2 px-4 py-3 text-sm sm:items-center sm:gap-3 ${gridCols}`}
                >
                  <div>
                    <p
                      className="text-muted-foreground"
                      title={new Date(event.createdAt).toLocaleString()}
                    >
                      {formatRelative(event.createdAt, locale === "pt-BR" ? "pt-BR" : "en")}
                    </p>
                    {event.undoneAt && (
                      <p className="text-[11px] text-amber-500/90">{t("activity.undone")}</p>
                    )}
                  </div>
                  <p className="font-medium">{event.actorDisplayName}</p>
                  {showCollectionColumn && (
                    <p className="truncate text-muted-foreground">{sourceLabel}</p>
                  )}
                  <p>{describeAction(event, t)}</p>
                  <p className="truncate text-muted-foreground">
                    {event.cardName ?? "—"}
                    {event.meta.characterName
                      ? ` · ${String(event.meta.characterName)}`
                      : ""}
                  </p>
                  <div className="sm:justify-self-end">
                    {undoable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={undoMutation.isPending}
                        onClick={() => undoMutation.mutate(event.id)}
                      >
                        {t("activity.undo")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { Check, ChevronRight, ExternalLink, Loader2, Package, RefreshCw, ShoppingBag, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageLoading } from "@/components/shared/PageLoading";
import { SearchBar } from "@/components/shared/SearchBar";
import { CardImage } from "@/components/shared/CardImage";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { fetchPurchasedCards } from "@/lib/purchases/fetch";
import { hasCompletePurchaseCoverage, type PurchasedCard } from "@/lib/purchases/types";
import { groupPurchases, searchPurchaseGroups, type PurchaseGroup } from "@/lib/purchases/presentation";
import { PURCHASED_CARDS_QUERY_KEY } from "@/hooks/usePurchasedCardMatch";
import { cn } from "@/lib/utils";

const STATUSES = ["presale", "paid", "sent", "arrived", "done", "lost", "canceled"] as const;
function statusKey(status: string) {
  const known = [...STATUSES, "all", "pending", "missing", "ok", "closed", "hub_pending", "request_for_cancel", "unknown"] as const;
  const value = known.find(value => value === status) ?? "unknown";
  return `purchases.status.${value}` as const;
}
const ZERO_SECTIONS = [
  { status: "arrived", icon: Check, color: "bg-emerald-700 text-white", border: "border-l-emerald-500", title: "purchases.readyToShip", hint: "purchases.readyHint" },
  { status: "pending", icon: Truck, color: "bg-sky-700 text-white", border: "border-l-sky-500", title: "purchases.pending", hint: "purchases.pendingHint" },
  { status: "missing", icon: X, color: "bg-amber-500 text-amber-950", border: "border-l-amber-500", title: "purchases.missing", hint: "purchases.missingHint" },
] as const;

function money(cents: number, currency: string): string {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

function totalPrice(cards: PurchasedCard[]): string {
  if (cards.some(card => card.priceCents == null || !card.currency)) return "—";
  const totals = new Map<string, number>();
  for (const card of cards) {
    const currency = card.currency!;
    totals.set(currency, (totals.get(currency) ?? 0) + card.priceCents! * card.quantity);
  }
  return [...totals].map(([currency, cents]) => money(cents, currency)).join(" + ") || "—";
}

function PurchaseImage({ card }: { card: PurchasedCard }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setVisible(true));
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "150px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const image = useQuery({
    queryKey: ["purchased-card-image", card.gameId, card.name],
    queryFn: async () => {
      const params = new URLSearchParams({ name: card.name, gameId: String(card.gameId) });
      const response = await fetch(`/api/market/cardtrader/purchases/image?${params}`);
      if (!response.ok) throw new Error("Could not load purchase image");
      return (await response.json()) as { imageUrl: string | null };
    },
    enabled: visible && !card.imageUrl && (card.gameId === 4 || card.gameId === 8),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  return <div ref={container} className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-muted">
    <CardImage src={card.imageUrl ?? image.data?.imageUrl ?? null} alt={card.name} fill sizes="36px" className="object-contain" />
  </div>;
}

function PurchaseRows({ cards, border }: { cards: PurchasedCard[]; border?: string }) {
  const t = useT();
  return (
    <div role="table" aria-label={t("purchases.card")}>
      <div role="row" className="grid grid-cols-[minmax(0,1fr)_40px_88px] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_64px_112px] sm:px-4">
        <span role="columnheader">{t("purchases.card")}</span><span role="columnheader" className="text-center">{t("purchases.quantity")}</span><span role="columnheader" className="text-right">{t("purchases.unitPrice")}</span>
      </div>
      {cards.map(card => (
        <div key={card.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_40px_88px] items-center gap-2 border-b border-l-4 border-border/60 py-1.5 pl-2 pr-3 last:border-b-0 hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_64px_112px] sm:pr-4", border ?? "border-l-transparent")}>
          <div role="cell" className="flex min-w-0 items-center gap-3">
            <PurchaseImage card={card} />
            <div className="min-w-0">
              {card.blueprintId ? (
                <a href={`https://www.cardtrader.com/en/cards/${card.blueprintId}`} target="_blank" rel="noreferrer" title={t("purchases.openCard")} className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="truncate">{card.name}</span><ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              ) : <p className="truncate text-sm font-medium">{card.name}</p>}
              <p className="truncate text-[11px] text-muted-foreground" title={card.expansion ?? undefined}>{card.expansion ?? "—"}</p>
            </div>
          </div>
          <span role="cell" className="text-center text-xs font-medium tabular-nums">×{card.quantity}</span>
          <span role="cell" className="text-right text-xs tabular-nums">{card.priceCents != null && card.currency ? money(card.priceCents, card.currency) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function ZeroSection({ group }: { group: PurchaseGroup }) {
  const t = useT();
  const config = ZERO_SECTIONS.find(section => section.status === group.status);
  const Icon = config?.icon ?? Package;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-3", config?.color ?? "bg-muted")}>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-5 w-5" />{t(config?.title ?? statusKey(group.status))} <span className="font-normal">· {t("purchases.cardCount", { count: group.quantity })}</span></h2>
        <span className="text-sm font-semibold tabular-nums">{totalPrice(group.cards)}</span>
      </div>
      <PurchaseRows cards={group.cards} border={config?.border} />
    </section>
  );
}

export default function PurchasesPage() {
  const t = useT();
  const [selectedStatus, setSelectedStatus] = useState("cardtrader-zero");
  const [zeroFilter, setZeroFilter] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data, error, isLoading, isFetching, refetch } = useQuery({ queryKey: PURCHASED_CARDS_QUERY_KEY, queryFn: fetchPurchasedCards, staleTime: 60_000 });
  const groups = useMemo(() => groupPurchases(data?.cards ?? []), [data?.cards]);
  const searched = useMemo(() => searchPurchaseGroups(groups, search), [groups, search]);
  const zeroGroups = searched.filter(group => group.source === "cardtrader-zero" && (!zeroFilter || group.status === zeroFilter))
    .sort((a, b) => {
      const rank = (status: string) => {
        const index = ZERO_SECTIONS.findIndex(section => section.status === status);
        return index < 0 ? ZERO_SECTIONS.length : index;
      };
      return rank(a.status) - rank(b.status);
    });
  const orders = searched.filter(group => group.source === "order" && (selectedStatus === "all" || group.status === selectedStatus));
  const activeOrder = orders.find(group => group.id === selectedOrder) ?? orders[0];
  const showZero = selectedStatus === "cardtrader-zero" || selectedStatus === "all";
  const allOrders = groups.filter(group => group.source === "order");
  const allZero = groups.filter(group => group.source === "cardtrader-zero");
  const totalCards = (data?.cards ?? []).reduce((total, card) => total + card.quantity, 0);
  const hasResults = (showZero && zeroGroups.length > 0) || orders.length > 0;
  if (isLoading) return <PageLoading label={t("purchases.loading")} />;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
        <PageHeader title={t("purchases.title")} description={t("purchases.description")}>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t("purchases.refresh")}</Button>
        </PageHeader>
        <p className="text-xs text-muted-foreground">{t("purchases.cardCount", { count: totalCards })} <span className="px-1.5">·</span> {t("purchases.orderCount", { count: allOrders.length })}</p>
        {isFetching && <p className="text-sm text-muted-foreground" role="status">{t("purchases.loading")}</p>}
        {data && (!hasCompletePurchaseCoverage(data) || error) && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm" role="alert">
            <p>{t("purchases.incomplete")}</p>
            {Object.entries(data.sources).filter(([, source]) => source.status !== "fresh").map(([key, source]) => (
              <p key={key} className="text-xs">{key === "orders" ? "CardTrader Orders" : "CT Zero"}: {t(source.status === "stale" ? "purchases.sourceStale" : "purchases.sourceUnavailable")}{source.lastSuccessAt && ` (${new Date(source.lastSuccessAt).toLocaleString()})`}</p>
            ))}
          </div>
        )}

        <div className="space-y-3 border-y border-border py-4 2xl:flex 2xl:items-center 2xl:gap-6 2xl:space-y-0">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1" aria-label={t("purchases.statusFilter")}>
            {["cardtrader-zero", ...STATUSES, "all"].map(status => {
              const count = status === "cardtrader-zero" ? allZero.reduce((sum, group) => sum + group.quantity, 0) : status === "all" ? allOrders.length : allOrders.filter(group => group.status === status).length;
              const active = selectedStatus === status;
              return (
                <button type="button" key={status} aria-pressed={active} onClick={() => { setSelectedStatus(status); setSelectedOrder(null); setZeroFilter(null); }} className="group flex min-w-[76px] flex-1 flex-col items-center gap-2 rounded-md px-1 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("whitespace-nowrap", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{status === "cardtrader-zero" ? "CT Zero" : t(statusKey(status))}</span>
                  <span className={cn("flex h-8 w-full items-center justify-center rounded-full border-2 font-semibold tabular-nums transition-colors", active ? "border-amber-400 bg-slate-900 text-white" : "border-transparent bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-foreground")}>
                    {status === "cardtrader-zero" && <span className="mr-1.5 h-3 w-3 rounded-full border-[3px] border-amber-400 border-r-transparent" aria-hidden />}{count}
                  </span>
                  <span className="sr-only">{t(status === "cardtrader-zero" ? "purchases.cardCount" : "purchases.orderCount", { count })}</span>
                </button>
              );
            })}
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder={t("purchases.search")} className="2xl:w-72 2xl:shrink-0" />
        </div>

        {showZero && <div className="grid gap-3 sm:grid-cols-3">{ZERO_SECTIONS.map(section => {
          const group = allZero.find(group => group.status === section.status);
          const Icon = section.icon;
          return (
            <button type="button" key={section.status} aria-pressed={zeroFilter === section.status} onClick={() => setZeroFilter(current => current === section.status ? null : section.status)}
              className={cn("rounded-xl p-5 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", section.color, zeroFilter === section.status && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}>
              <div className="flex items-center gap-3"><Icon className="h-7 w-7 shrink-0" /><span className="text-3xl font-bold tabular-nums">{group?.quantity.toLocaleString() ?? 0}</span></div>
              <p className="mt-3 text-sm font-semibold">{t(section.title)}</p><p className="mt-1 text-xs leading-relaxed opacity-90">{t(section.hint)}</p>
              <p className="mt-4 border-t border-current/20 pt-3 text-sm font-semibold tabular-nums">{t("purchases.itemsValue")}: {totalPrice(group?.cards ?? [])}</p>
            </button>
          );
        })}</div>}

        {error && !data ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{t("purchases.error")}</div> : !hasResults ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center">
            <ShoppingBag className="mb-3 h-7 w-7 text-muted-foreground" /><p className="text-sm font-medium">{t("purchases.empty")}</p><p className="mt-1 text-xs text-muted-foreground">{t("purchases.filterHint")}</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setSearch(""); setSelectedStatus("all"); setZeroFilter(null); }}>{t("purchases.clearFilters")}</Button>
          </div>
        ) : <div className="space-y-5">
          {showZero && zeroGroups.map(group => <ZeroSection key={group.id} group={group} />)}
          {activeOrder && <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="space-y-2" aria-label={t("purchases.orders")}>
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("purchases.orderCount", { count: orders.length })}</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[600px] lg:flex-col lg:overflow-y-auto">{orders.map(group => (
                <button type="button" key={group.id} aria-pressed={group.id === activeOrder.id} onClick={() => setSelectedOrder(group.id)} className={cn("min-w-[220px] rounded-lg border bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0", group.id === activeOrder.id ? "border-sky-500 ring-1 ring-sky-500" : "border-border hover:border-muted-foreground/50")}>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold"><span className="truncate">{t("purchases.order", { code: group.orderLabel ?? "—" })}</span><ChevronRight className="h-4 w-4 shrink-0" /></span>
                  <span className="mt-2 block text-[11px] text-muted-foreground">{t(statusKey(group.status))} · {t("purchases.cardCount", { count: group.quantity })}</span><span className="mt-1 block text-sm font-semibold tabular-nums">{totalPrice(group.cards)}</span>
                </button>
              ))}</div>
            </aside>
            <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
                <div><h2 className="text-sm font-semibold">{t("purchases.order", { code: activeOrder.orderLabel ?? "—" })}</h2><p className="mt-1 text-xs text-slate-300">{t("purchases.cardCount", { count: activeOrder.quantity })} · {t(statusKey(activeOrder.status))}</p></div><span className="text-sm font-semibold tabular-nums">{totalPrice(activeOrder.cards)}</span>
              </div>
              <PurchaseRows cards={activeOrder.cards} />
            </section>
          </div>}
        </div>}
      </div>
    </div>
  );
}

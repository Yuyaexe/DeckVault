import type { PurchasedCardsResponse, PurchaseSourceStatus } from "./types";

interface OrderItem {
  id?: number;
  blueprint_id?: number;
  name?: string;
  expansion?: string;
  quantity?: number;
  buyer_price?: { cents?: number; currency?: string };
  game_id?: number;
}

interface Order {
  id?: number;
  code?: string;
  state?: string;
  seller?: { username?: string };
  order_items?: OrderItem[];
}

interface ZeroItem extends Omit<OrderItem, "quantity"> {
  quantity?: { pending?: number; ok?: number; missing?: number };
  cancelled_at?: string | null;
  seller?: { username?: string };
}

interface CachedSource<T> { data: T[]; fetchedAt: number }
interface AccountCache {
  token: string;
  orders?: CachedSource<Order>;
  zero?: CachedSource<ZeroItem>;
  inflight?: Promise<PurchasedCardsResponse>;
}

const CACHE_MS = 60_000;
const PAGE_SIZE = 100;
const units = (value: number | undefined) =>
  Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value!) : 0;

/** Server-only loader. Keep cache scoped to the credential; never cache partial pages as complete. */
export function createPurchaseLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  let account: AccountCache | undefined;

  async function get<T>(path: string, token: string): Promise<T[]> {
    const response = await fetcher(`https://api.cardtrader.com/api/v2${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`CardTrader returned ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid CardTrader response");
    return data as T[];
  }

  async function allOrders(token: string): Promise<Order[]> {
    const orders: Order[] = [];
    const seen = new Set<number>();
    for (let page = 1; ; page++) {
      const batch = await get<Order>(`/orders?order_as=buyer&limit=${PAGE_SIZE}&page=${page}&sort=id.asc`, token);
      let added = 0;
      for (const order of batch) {
        if (order.id != null && seen.has(order.id)) continue;
        if (order.id != null) seen.add(order.id);
        orders.push(order);
        added++;
      }
      if (batch.length < PAGE_SIZE) return orders;
      if (added === 0) throw new Error("CardTrader pagination did not advance");
    }
  }

  async function source<T>(cached: CachedSource<T> | undefined, fetchData: () => Promise<T[]>) {
    if (cached && now() - cached.fetchedAt < CACHE_MS) {
      return { cache: cached, status: "fresh" as const };
    }
    try {
      return { cache: { data: await fetchData(), fetchedAt: now() }, status: "fresh" as const };
    } catch {
      return { cache: cached, status: cached ? "stale" as const : "unavailable" as const };
    }
  }

  async function refresh(entry: AccountCache): Promise<PurchasedCardsResponse> {
    const [orders, zero] = await Promise.all([
      source(entry.orders, () => allOrders(entry.token)),
      source(entry.zero, () => get<ZeroItem>("/ct0_box_items", entry.token)),
    ]);
    entry.orders = orders.cache;
    entry.zero = zero.cache;
    const status = <T>(result: { cache?: CachedSource<T>; status: PurchaseSourceStatus["status"] }): PurchaseSourceStatus => ({
      status: result.status,
      lastSuccessAt: result.cache ? new Date(result.cache.fetchedAt).toISOString() : null,
    });
    const purchased = (orders.cache?.data ?? []).flatMap((order) =>
      (order.order_items ?? []).map((item) => ({
        id: `order-${order.id ?? order.code}-${item.id ?? item.blueprint_id}`,
        name: item.name ?? "Unknown card", expansion: item.expansion ?? null,
        quantity: units(item.quantity),
        priceCents: item.buyer_price?.cents ?? null, currency: item.buyer_price?.currency ?? null,
        status: order.state ?? "unknown", seller: order.seller?.username ?? null,
        orderCode: order.code ?? null, orderId: order.id ?? null, blueprintId: item.blueprint_id ?? null,
        gameId: item.game_id ?? null, imageUrl: null,
        source: "order" as const,
      }))
    );
    const zeroItems = (zero.cache?.data ?? []).map((item, index) => {
      const pending = units(item.quantity?.pending);
      const arrived = units(item.quantity?.ok);
      const missing = units(item.quantity?.missing);
      return {
        id: `ct0-${item.id ?? index}`, name: item.name ?? "Unknown card",
        expansion: item.expansion ?? null, quantity: pending + arrived + missing,
        validQuantity: item.cancelled_at ? 0 : pending + arrived,
        zeroQuantities: { arrived, pending, missing },
        priceCents: item.buyer_price?.cents ?? null, currency: item.buyer_price?.currency ?? null,
        status: item.cancelled_at ? "canceled" : pending > 0 ? "pending" : arrived > 0 ? "arrived" : "missing",
        seller: item.seller?.username ?? null, orderCode: null,
        blueprintId: item.blueprint_id ?? null, gameId: item.game_id ?? null,
        imageUrl: null, source: "cardtrader-zero" as const,
      };
    });
    return {
      cards: [...purchased, ...zeroItems],
      complete: orders.status === "fresh" && zero.status === "fresh",
      sources: { orders: status(orders), cardTraderZero: status(zero) },
      cardTraderZeroSummary: (zero.cache?.data ?? []).reduce((summary, item) => ({
        arrived: summary.arrived + units(item.quantity?.ok),
        pending: summary.pending + units(item.quantity?.pending),
        missing: summary.missing + units(item.quantity?.missing),
      }), { arrived: 0, pending: 0, missing: 0 }),
    };
  }

  return (token: string): Promise<PurchasedCardsResponse> => {
    if (!account || account.token !== token) account = { token };
    const entry = account;
    if (!entry.inflight) {
      entry.inflight = refresh(entry).finally(() => { entry.inflight = undefined; });
    }
    return entry.inflight;
  };
}

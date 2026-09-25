/** Passcode entries older than this are refetched from the API. */
export const PASSCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default React Query stale window for catalog/search data. */
export const QUERY_STALE_MS = 5 * 60 * 1000;

/** Default React Query garbage-collection window. */
export const QUERY_GC_MS = 30 * 60 * 1000;

/** Scan/prune the image cache after this many writes instead of every write. */
export const IMAGE_PRUNE_WRITE_INTERVAL = 32;

/** Flush image last-used timestamps in batches instead of one write per cache hit. */
export const IMAGE_TOUCH_BATCH_SIZE = 50;
export const IMAGE_TOUCH_FLUSH_MS = 30 * 1000;

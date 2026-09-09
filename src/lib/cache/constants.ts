/** Passcode entries older than this are refetched from the API. */
export const PASSCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default React Query stale window for catalog/search data. */
export const QUERY_STALE_MS = 5 * 60 * 1000;

/** Default React Query garbage-collection window. */
export const QUERY_GC_MS = 30 * 60 * 1000;

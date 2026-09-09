import { PASSCODE_CACHE_TTL_MS } from "@/lib/cache/constants";

const DB_NAME = "deckvault-cache";
const DB_VERSION = 2;
const PASSCODE_STORE = "passcodes";
const IMAGE_STORE = "images";
const PROXY_CUSTOM_STORE = "proxy-custom-images";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error("Failed to open cache DB"));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PASSCODE_STORE)) {
          db.createObjectStore(PASSCODE_STORE);
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE);
        }
        if (!db.objectStoreNames.contains(PROXY_CUSTOM_STORE)) {
          db.createObjectStore(PROXY_CUSTOM_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
  return dbPromise;
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export interface PasscodeCacheEntry {
  passcode: string | null;
  updatedAt: number;
}

export interface ImageCacheEntry {
  blob: Blob;
  updatedAt: number;
}

export async function readPasscodeEntries(
  keys: string[],
  maxAgeMs = PASSCODE_CACHE_TTL_MS
): Promise<Map<string, PasscodeCacheEntry>> {
  if (!keys.length || typeof indexedDB === "undefined") return new Map();
  const now = Date.now();
  try {
    const db = await openDb();
    const tx = db.transaction(PASSCODE_STORE, "readonly");
    const store = tx.objectStore(PASSCODE_STORE);
    const out = new Map<string, PasscodeCacheEntry>();
    await Promise.all(
      keys.map(async (key) => {
        const entry = await idbRequest(store.get(key));
        if (!entry) return;
        const typed = entry as PasscodeCacheEntry;
        if (now - typed.updatedAt > maxAgeMs) return;
        out.set(key, typed);
      })
    );
    await idbTxDone(tx);
    return out;
  } catch {
    return new Map();
  }
}

export async function writePasscodeEntries(
  entries: Array<{ key: string; passcode: string | null }>
): Promise<void> {
  if (!entries.length || typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const tx = db.transaction(PASSCODE_STORE, "readwrite");
    const store = tx.objectStore(PASSCODE_STORE);
    const now = Date.now();
    for (const { key, passcode } of entries) {
      store.put({ passcode, updatedAt: now } satisfies PasscodeCacheEntry, key);
    }
    await idbTxDone(tx);
  } catch {
    // Cache is best-effort
  }
}

const MAX_IMAGE_ENTRIES = 400;

export async function readImageBlob(url: string): Promise<Blob | null> {
  if (!url || typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    const entry = (await idbRequest(store.get(url))) as ImageCacheEntry | undefined;
    if (!entry?.blob) {
      await idbTxDone(tx);
      return null;
    }
    store.put({ blob: entry.blob, updatedAt: Date.now() }, url);
    await idbTxDone(tx);
    return entry.blob;
  } catch {
    return null;
  }
}

export async function writeImageBlob(url: string, blob: Blob): Promise<void> {
  if (!url || typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    store.put({ blob, updatedAt: Date.now() } satisfies ImageCacheEntry, url);
    await idbTxDone(tx);
    await pruneImageStore();
  } catch {
    // Cache is best-effort
  }
}

async function pruneImageStore(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    const keys = await idbRequest(store.getAllKeys());
    if (keys.length <= MAX_IMAGE_ENTRIES) {
      await idbTxDone(tx);
      return;
    }
    const entries: Array<{ key: IDBValidKey; updatedAt: number }> = [];
    await Promise.all(
      keys.map(async (key) => {
        const entry = (await idbRequest(store.get(key))) as ImageCacheEntry | undefined;
        if (entry) entries.push({ key, updatedAt: entry.updatedAt });
      })
    );
    entries.sort((a, b) => a.updatedAt - b.updatedAt);
    const removeCount = entries.length - MAX_IMAGE_ENTRIES;
    for (let i = 0; i < removeCount; i++) {
      store.delete(entries[i].key);
    }
    await idbTxDone(tx);
  } catch {
    // ignore
  }
}

export interface ProxyCustomImageEntry {
  blob: Blob;
  updatedAt: number;
}

export async function readProxyCustomImageBlob(id: string): Promise<Blob | null> {
  if (!id || typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const tx = db.transaction(PROXY_CUSTOM_STORE, "readonly");
    const store = tx.objectStore(PROXY_CUSTOM_STORE);
    const entry = (await idbRequest(store.get(id))) as ProxyCustomImageEntry | undefined;
    await idbTxDone(tx);
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

export async function writeProxyCustomImageBlob(id: string, blob: Blob): Promise<void> {
  if (!id || typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction(PROXY_CUSTOM_STORE, "readwrite");
  const store = tx.objectStore(PROXY_CUSTOM_STORE);
  store.put({ blob, updatedAt: Date.now() } satisfies ProxyCustomImageEntry, id);
  await idbTxDone(tx);
}

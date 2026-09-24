import type { StateStorage } from "zustand/middleware";

const DB_NAME = "deckvault-local";
const DB_VERSION = 1;
const STORE_NAME = "key-value";

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("Failed to open DeckVault local database"));
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
    });
  }

  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function readIndexedDbValue(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const value = await requestResult(tx.objectStore(STORE_NAME).get(key));
    await transactionDone(tx);
    return typeof value === "string" ? value : null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function writeIndexedDbValue(key: string, value: string): Promise<boolean> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    await transactionDone(tx);
    memoryFallback.delete(key);
    return true;
  } catch {
    memoryFallback.set(key, value);
    return false;
  }
}

async function removeIndexedDbValue(key: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await transactionDone(tx);
  } catch {
    // Keep the runtime usable even when persistent storage is unavailable.
  } finally {
    memoryFallback.delete(key);
  }
}

function readLegacyLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeLegacyLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Legacy cleanup is best-effort.
  }
}

async function readWithLegacyMigration(key: string): Promise<string | null> {
  const stored = await readIndexedDbValue(key);
  if (stored != null) return stored;

  const legacy = readLegacyLocalStorage(key);
  if (legacy == null) return null;

  const persisted = await writeIndexedDbValue(key, legacy);
  if (persisted) removeLegacyLocalStorage(key);
  return legacy;
}

/**
 * Async Zustand storage backed by IndexedDB.
 * On first read it imports the old localStorage value with the same key,
 * writes it to IndexedDB, then removes the legacy localStorage entry.
 */
export const indexedDbStateStorage: StateStorage = {
  getItem: readWithLegacyMigration,
  setItem: async (key, value) => {
    await writeIndexedDbValue(key, value);
  },
  removeItem: async (key) => {
    await removeIndexedDbValue(key);
    removeLegacyLocalStorage(key);
  },
};

export async function readStoredString(key: string): Promise<string | null> {
  return readWithLegacyMigration(key);
}

export async function writeStoredString(key: string, value: string): Promise<void> {
  const persisted = await writeIndexedDbValue(key, value);
  if (persisted) removeLegacyLocalStorage(key);
}

export async function removeStoredString(key: string): Promise<void> {
  await removeIndexedDbValue(key);
  removeLegacyLocalStorage(key);
}

/** Used only to import storage owned by a third-party library from older builds. */
export function takeLegacyLocalStorageValue(key: string): string | null {
  const value = readLegacyLocalStorage(key);
  if (value != null) removeLegacyLocalStorage(key);
  return value;
}

const { app, BrowserWindow } = require("electron");
const http = require("http");

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<!doctype html><title>DeckVault IDB benchmark</title>");
});

server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  await app.whenReady();

  const win = new BrowserWindow({ show: false });
  await win.loadURL(`http://127.0.0.1:${port}`);

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const DB = "deckvault-cache-benchmark";
      const STORE = "images";
      const LIMIT = 400;
      const PRUNE_EVERY = 32;
      const TOUCH_BATCH = 50;

      const openDb = () => new Promise((resolve, reject) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const req = (r) => new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const done = (tx) => new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const db = await openDb();
      const blob = new Blob([new Uint8Array(2048)]);
      const putOne = async (key, updatedAt) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ blob, updatedAt }, key);
        await done(tx);
      };
      const reset = async () => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        store.clear();
        for (let i = 0; i < LIMIT; i++) {
          store.put({ blob, updatedAt: i }, "seed-" + i);
        }
        await done(tx);
      };
      const prune = async () => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const keys = await req(store.getAllKeys());
        if (keys.length > LIMIT) {
          const rows = await Promise.all(keys.map(async (key) => {
            const entry = await req(store.get(key));
            return [key, entry.updatedAt];
          }));
          rows.sort((a, b) => a[1] - b[1]);
          for (let i = 0; i < rows.length - LIMIT; i++) {
            store.delete(rows[i][0]);
          }
        }
        await done(tx);
      };

      await reset();
      let started = performance.now();
      for (let i = 0; i < 120; i++) {
        await putOne("old-" + i, 10_000 + i);
        await prune();
      }
      const oldWritesMs = performance.now() - started;

      await reset();
      started = performance.now();
      for (let i = 0; i < 120; i++) {
        await putOne("new-" + i, 20_000 + i);
        if (i === 0 || i % PRUNE_EVERY === 0) await prune();
      }
      const newWritesMs = performance.now() - started;

      const keysTx = db.transaction(STORE, "readonly");
      const hitKeys = (await req(keysTx.objectStore(STORE).getAllKeys())).slice(0, 240);
      await done(keysTx);

      const oldHit = async (key) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const entry = await req(store.get(key));
        if (entry?.blob) store.put({ blob: entry.blob, updatedAt: Date.now() }, key);
        await done(tx);
      };

      started = performance.now();
      await Promise.all(hitKeys.map((key) => oldHit(key)));
      const oldHitsMs = performance.now() - started;

      const newRead = async (key) => {
        const tx = db.transaction(STORE, "readonly");
        const entry = await req(tx.objectStore(STORE).get(key));
        await done(tx);
        return entry;
      };
      const flushTouches = async (batch) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const now = Date.now();
        const rows = await Promise.all(batch.map(async (key) => [key, await req(store.get(key))]));
        for (const [key, entry] of rows) {
          if (entry?.blob) store.put({ blob: entry.blob, updatedAt: now }, key);
        }
        await done(tx);
      };

      started = performance.now();
      await Promise.all(hitKeys.map((key) => newRead(key)));
      for (let i = 0; i < hitKeys.length; i += TOUCH_BATCH) {
        await flushTouches(hitKeys.slice(i, i + TOUCH_BATCH));
      }
      const newHitsMs = performance.now() - started;

      db.close();
      await new Promise((resolve) => {
        const r = indexedDB.deleteDatabase(DB);
        r.onsuccess = r.onerror = r.onblocked = resolve;
      });

      return {
        writes: { beforeMs: oldWritesMs, afterMs: newWritesMs },
        cacheHits: { beforeMs: oldHitsMs, afterMs: newHitsMs },
      };
    })()
  `);

  console.log(JSON.stringify(result, null, 2));
  await win.close();
  server.close(() => app.quit());
});

"use client";

import { useEffect, useRef, useState } from "react";
import { readImageBlob, writeImageBlob } from "@/lib/cache/idb";
import { cacheFetchUrl } from "@/lib/cache/image-fetch";

const inflight = new Map<string, Promise<Blob | null>>();

async function fetchAndCache(remoteUrl: string): Promise<Blob | null> {
  const existing = inflight.get(remoteUrl);
  if (existing) return existing;

  const promise = (async () => {
    const cached = await readImageBlob(remoteUrl);
    if (cached) return cached;

    try {
      const fetchUrl = cacheFetchUrl(remoteUrl);
      const res = await fetch(fetchUrl, { credentials: "same-origin" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size > 0) void writeImageBlob(remoteUrl, blob);
      return blob;
    } catch {
      return null;
    } finally {
      inflight.delete(remoteUrl);
    }
  })();

  inflight.set(remoteUrl, promise);
  return promise;
}

/** Local IndexedDB blob URL for card art when available. */
export function useCachedCardImage(remoteUrl: string | null | undefined): string | null {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLocalUrl(null);

    if (!remoteUrl || remoteUrl.startsWith("data:") || remoteUrl.startsWith("blob:")) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const blob = await fetchAndCache(remoteUrl);
      if (cancelled || !blob) return;
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      setLocalUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [remoteUrl]);

  return localUrl;
}

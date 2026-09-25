export function createAsyncKeyedDeduper<K, V>() {
  const inFlight = new Map<K, Promise<V>>();

  return (key: K, task: () => Promise<V>): Promise<V> => {
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = task().finally(() => {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
      }
    });

    inFlight.set(key, promise);
    return promise;
  };
}

/** True when the app is opened on a local machine (dev / preview). */
export function isBrowserLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

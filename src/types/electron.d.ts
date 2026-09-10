export {};

declare global {
  interface Window {
    deckvaultDesktop?: {
      checkForUpdates: () => Promise<{
        status: "development" | "current" | "downloading" | "unavailable";
        version?: string;
      }>;
    };
  }
}
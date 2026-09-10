export {};

export type DesktopUpdateStatus =
  | { status: "checking" | "current" | "unavailable" | "downloaded" }
  | { status: "downloading"; version?: string; percent: number; bytesPerSecond?: number; transferred?: number; total?: number }
  | { status: "error"; message: string };

declare global {
  interface Window {
    deckvaultDesktop?: {
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{
        status: "development" | "current" | "downloading" | "unavailable";
        version?: string;
      }>;
      onUpdateStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
    };
  }
}
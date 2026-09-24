export {};

export interface LocalUpdateStatus {
  state: "idle" | "building" | "waiting" | "backup" | "installing" | "complete" | "error";
  message: string;
  source?: string;
  log?: string;
  backup?: string;
}

export type DesktopUpdateStatus =
  | { status: "checking" | "current" | "unavailable" | "downloaded" }
  | { status: "downloading"; version?: string; percent: number; bytesPerSecond?: number; transferred?: number; total?: number }
  | { status: "error"; message: string };

declare global {
  interface Window {
    deckvaultDesktop?: {
      getAppVersion: () => Promise<string>;
      getLocalUpdate: () => Promise<LocalUpdateStatus>;
      chooseLocalUpdateSource: () => Promise<string | null>;
      startLocalUpdate: () => Promise<void>;
      openLocalUpdateLog: () => Promise<string | undefined>;
      onLocalUpdateStatus: (listener: (status: LocalUpdateStatus) => void) => () => void;
      getCardTraderConfig: () => Promise<{ configured: boolean }>;
      saveCardTraderToken: (token: string) => Promise<{ configured: true }>;
      removeCardTraderToken: () => Promise<{ configured: false }>;
      checkForUpdates: () => Promise<{
        status: "development" | "current" | "downloading" | "unavailable";
        version?: string;
      }>;
      onUpdateStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
    };
  }
}

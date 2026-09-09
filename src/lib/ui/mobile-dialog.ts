/** Bottom-sheet positioning for Dialog on viewports < sm (avoids translate-x -50% bugs). */
export const MOBILE_DIALOG_SHEET =
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-xl max-sm:overflow-x-hidden max-sm:overflow-y-auto max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:box-border max-sm:block";

/** Nearly full-screen dialog anchored from top (Quick Add advanced). */
export const MOBILE_DIALOG_FULL =
  "max-sm:inset-x-0 max-sm:top-[max(2dvh,env(safe-area-inset-top))] max-sm:bottom-auto max-sm:max-h-[96dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-xl max-sm:overflow-x-hidden max-sm:box-border";

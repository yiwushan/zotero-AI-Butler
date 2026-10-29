import { getPref, setPref } from "../utils/prefs";

export const CHAT_ENABLED = false;
export const AGENT_ENABLED = false;
export const MAX_AUTO_CONTINUATION_ROUNDS = 1;

export function normalizeAutoContinuationRounds(raw: unknown): number {
  const parsed = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 0), MAX_AUTO_CONTINUATION_ROUNDS)
    : MAX_AUTO_CONTINUATION_ROUNDS;
}

/** Apply conservative defaults once when switching to the reading-only build. */
export function applyReadingEditionDefaults(): void {
  if (getPref("readingEditionDefaultsVersion" as any) === 1) return;
  const defaults = {
    autoScan: false,
    autoImageSummaryOnComplete: false,
    multiModelSummaryEnabled: false,
    multiRoundIndependentParallelEnabled: false,
    saveChatHistory: false,
    autoContinuationRounds: "1",
    sidebarActiveTab: "deepRead",
  };
  for (const [key, value] of Object.entries(defaults)) {
    setPref(key as any, value);
  }
  setPref("readingEditionDefaultsVersion" as any, 1);
}

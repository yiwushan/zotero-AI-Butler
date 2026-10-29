import { getPref, setPref } from "../utils/prefs";
import { config } from "../../package.json";
import { getString } from "../utils/locale";

export const CHAT_ENABLED = false;
export const AGENT_ENABLED = false;
export const MAX_AUTO_CONTINUATION_ROUNDS = 1;

/** Zotero requires update_url; disable replacement through its per-addon setting. */
export async function disableReadingEditionAutoUpdates(): Promise<void> {
  const { AddonManager } =
    typeof ChromeUtils.importESModule === "function"
      ? ChromeUtils.importESModule(
          "resource://gre/modules/AddonManager.sys.mjs",
        )
      : ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
  const installed = await AddonManager.getAddonByID(config.addonID);
  if (!installed)
    throw new Error(getString("reading-edition-addon-unavailable"));
  installed.applyBackgroundUpdates = AddonManager.AUTOUPDATE_DISABLE;
}

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

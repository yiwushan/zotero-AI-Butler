import type { LLMOptions } from "../types";
import { resolveVolcanoThinkingType } from "./reasoning";

export function buildVolcanoGenerationOptions(
  options: LLMOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (
    typeof options.maxTokens === "number" &&
    Number.isFinite(options.maxTokens) &&
    options.maxTokens > 0
  ) {
    result.max_output_tokens = Math.floor(options.maxTokens);
  }

  const thinkingType = resolveVolcanoThinkingType(options.reasoningEffort);
  if (thinkingType) result.thinking = { type: thinkingType };

  return result;
}

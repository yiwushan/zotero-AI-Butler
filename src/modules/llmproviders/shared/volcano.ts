import type { LLMOptions } from "../types";
import {
  resolveVolcanoReasoningEffort,
  resolveVolcanoThinkingType,
} from "./reasoning";

export function buildVolcanoGenerationOptions(
  options: LLMOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (
    typeof options.temperature === "number" &&
    Number.isFinite(options.temperature) &&
    options.temperature >= 0 &&
    options.temperature <= 2
  ) {
    result.temperature = options.temperature;
  }

  if (
    typeof options.topP === "number" &&
    Number.isFinite(options.topP) &&
    options.topP >= 0 &&
    options.topP <= 1
  ) {
    result.top_p = options.topP;
  }

  if (
    typeof options.maxTokens === "number" &&
    Number.isFinite(options.maxTokens) &&
    options.maxTokens > 0
  ) {
    result.max_output_tokens = Math.floor(options.maxTokens);
  }

  const thinkingType = resolveVolcanoThinkingType(options.reasoningEffort);
  if (thinkingType) result.thinking = { type: thinkingType };
  const reasoningEffort = resolveVolcanoReasoningEffort(
    options.reasoningEffort,
  );
  if (reasoningEffort) result.reasoning = { effort: reasoningEffort };

  return result;
}

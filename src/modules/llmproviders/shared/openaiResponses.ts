import { AgentProtocolError } from "./agentErrors";
import type { LLMAgentTurn, LLMToolCall } from "../agentTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function collectContentPartText(part: unknown): string[] {
  if (!isRecord(part)) return [];

  const directText = readString(part.text);
  if (directText) return [directText];

  const nestedText = isRecord(part.output_text)
    ? readString(part.output_text.text)
    : null;
  return nestedText ? [nestedText] : [];
}

function collectContentText(content: unknown): string[] {
  if (!Array.isArray(content)) return [];

  const parts: string[] = [];
  for (const part of content) {
    parts.push(...collectContentPartText(part));
  }
  return parts;
}

/**
 * 从 OpenAI Responses API 的原始 JSON 中提取最终文本。
 *
 * 官方 HTTP 响应的正文通常位于 output[].content[].text；
 * SDK 可能额外提供 output_text 便利字段，因此这里先读便利字段，
 * 再回退遍历标准 output 结构。
 */
export function parseOpenAIResponsesText(data: unknown): string {
  if (!isRecord(data)) return "";

  const outputText = readString(data.output_text);
  if (outputText && outputText.length > 0) return outputText;

  const output = data.output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    parts.push(...collectContentText(item.content));
  }
  return parts.join("");
}

export function parseOpenAIResponsesDelta(event: unknown): string {
  if (!isRecord(event)) return "";
  return event.type === "response.output_text.delta" &&
    typeof event.delta === "string"
    ? event.delta
    : "";
}

function parseOpenAIResponsesEventSnapshot(event: unknown): string {
  if (!isRecord(event)) return "";

  if (event.type === "response.completed") {
    const responseText = parseOpenAIResponsesText(event.response);
    if (responseText) return responseText;
  }

  if (event.type === "response.output_item.done") {
    const item = event.item;
    if (isRecord(item)) {
      const itemText = collectContentText(item.content).join("");
      if (itemText) return itemText;
    }
  }

  if (event.type === "response.content_part.done") {
    const partText = collectContentPartText(event.part).join("");
    if (partText) return partText;
  }

  if (event.type === "response.output_text.done") {
    const text = readString(event.text);
    if (text) return text;
  }

  return parseOpenAIResponsesText(event);
}

function parseJsonPayload(payload: string): unknown | null {
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function collectSsePayloads(raw: string): string[] {
  const payloads: string[] = [];
  const blocks = raw.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, ""));
    if (dataLines.length > 0) payloads.push(dataLines.join("\n").trim());
  }

  if (payloads.length > 0) return payloads;

  return raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, "").trim());
}

/**
 * 从一整段 Responses API SSE 文本中提取最终文本。
 *
 * 正常流式路径应优先消费 response.output_text.delta；这个函数用于兜底：
 * 如果宿主环境没有逐段触发 progress，或模型只在完成事件里带完整文本，
 * 就从完整 SSE 响应中还原输出。
 */
export function parseOpenAIResponsesSseText(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "";

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const json = parseJsonPayload(trimmed);
    return (
      parseOpenAIResponsesText(json) || parseOpenAIResponsesEventSnapshot(json)
    );
  }

  const deltaParts: string[] = [];
  const snapshots: string[] = [];
  for (const payload of collectSsePayloads(raw)) {
    const event = parseJsonPayload(payload);
    if (!event) continue;

    const delta = parseOpenAIResponsesDelta(event);
    if (delta) deltaParts.push(delta);

    const snapshot = parseOpenAIResponsesEventSnapshot(event);
    if (snapshot) snapshots.push(snapshot);
  }

  if (deltaParts.length > 0) return deltaParts.join("");
  return snapshots[snapshots.length - 1] || "";
}

/** Parse only complete native tool calls; partial JSON must never reach tools. */
export function parseOpenAIResponsesAgentTurn(data: unknown): LLMAgentTurn {
  if (!isRecord(data) || data.error || data.status !== "completed") {
    throw new AgentProtocolError("responses-incomplete");
  }
  if (!Array.isArray(data.output)) {
    throw new AgentProtocolError("responses-missing-output");
  }
  const toolCalls: LLMToolCall[] = [];
  const reasoning: Record<string, unknown>[] = [];
  const summaries: string[] = [];
  for (const item of data.output) {
    if (!isRecord(item)) throw new AgentProtocolError("responses-invalid-item");
    if (item.status && item.status !== "completed") {
      throw new AgentProtocolError("responses-unfinished-item");
    }
    if (item.type === "function_call") {
      if (
        typeof item.call_id !== "string" ||
        typeof item.name !== "string" ||
        typeof item.arguments !== "string"
      ) {
        throw new AgentProtocolError("responses-malformed-call");
      }
      toolCalls.push({
        id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      });
    } else if (item.type === "reasoning") {
      if (item.encrypted_content) reasoning.push(item);
      if (Array.isArray(item.summary)) {
        for (const part of item.summary) {
          if (
            isRecord(part) &&
            part.type === "summary_text" &&
            typeof part.text === "string"
          )
            summaries.push(part.text);
        }
      }
    }
  }
  const usage = isRecord(data.usage) ? data.usage : {};
  const number = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  return {
    text: parseOpenAIResponsesText(data),
    toolCalls,
    reasoningContent: summaries.join("\n\n") || undefined,
    finishReason: "completed",
    usage: {
      inputTokens: number(usage.input_tokens),
      outputTokens: number(usage.output_tokens),
      totalTokens: number(usage.total_tokens),
    },
    ...(reasoning.length
      ? { providerState: { providerId: "openai", parts: reasoning } }
      : {}),
  };
}

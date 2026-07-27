import { expect } from "chai";
import { config } from "../package.json";
import {
  LLMEndpointManager,
  type LLMEndpoint,
} from "../src/modules/llmEndpointManager";
import LLMService from "../src/modules/llmService";

const prefKeys = [
  "llmEndpoints",
  "llmRoutingStrategy",
  "llmRoundRobinCursor",
  "multiModelSummaryEnabled",
  "multiModelSummaryEndpointIds",
  "maxApiSwitchCount",
  "reasoningEffort",
  "pdfProcessMode",
  "enableTemperature",
  "enableMaxTokens",
  "enableTopP",
  "temperature",
  "topP",
  "maxTokens",
  "stream",
  "provider",
  "openaiApiUrl",
  "openaiApiKey",
  "openaiApiModel",
  "openaiCompatApiUrl",
  "openaiCompatApiKey",
  "openaiCompatModel",
  "geminiApiUrl",
  "geminiApiKey",
  "geminiModel",
  "anthropicApiUrl",
  "anthropicApiKey",
  "anthropicModel",
  "openRouterApiUrl",
  "openRouterApiKey",
  "openRouterModel",
  "volcanoArkApiUrl",
  "volcanoArkApiKey",
  "volcanoArkModel",
  "ollamaApiUrl",
  "ollamaApiKey",
  "ollamaModel",
];

function prefName(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function makeEndpoint(id: string, enabled = true): LLMEndpoint {
  return {
    id,
    name: id.toUpperCase(),
    providerType: "openai",
    apiUrl: "https://api.openai.com/v1/responses",
    apiKey: `sk-${id}`,
    model: "gpt-5",
    enabled,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("LLMEndpointManager", function () {
  const originals = new Map<string, unknown>();

  beforeEach(function () {
    originals.clear();
    for (const key of prefKeys) {
      const fullKey = prefName(key);
      originals.set(key, Zotero.Prefs.get(fullKey, true));
      Zotero.Prefs.clear(fullKey, true);
    }
  });

  afterEach(function () {
    for (const key of prefKeys) {
      const fullKey = prefName(key);
      const value = originals.get(key);
      if (value === undefined) Zotero.Prefs.clear(fullKey, true);
      else Zotero.Prefs.set(fullKey, value as any, true);
    }
  });

  it("migrates an empty endpoint list from legacy provider prefs", function () {
    Zotero.Prefs.set(prefName("llmEndpoints"), "[]", true);
    Zotero.Prefs.set(prefName("provider"), "openai-compat", true);
    Zotero.Prefs.set(
      prefName("openaiCompatApiUrl"),
      "https://example.test/v1/chat/completions",
      true,
    );
    Zotero.Prefs.set(prefName("openaiCompatApiKey"), "sk-legacy", true);
    Zotero.Prefs.set(prefName("openaiCompatModel"), "legacy-model", true);

    const endpoints = LLMEndpointManager.getEndpoints();

    expect(endpoints).to.have.length(1);
    expect(endpoints[0]).to.include({
      id: "endpoint-legacy-primary",
      providerType: "openai-compat",
      apiUrl: "https://example.test/v1/chat/completions",
      apiKey: "sk-legacy",
      model: "legacy-model",
      reasoningEffort: "default",
      enabled: true,
    });
  });

  it("defaults official OpenAI endpoints to medium reasoning effort", function () {
    Zotero.Prefs.set(prefName("llmEndpoints"), "[]", true);
    Zotero.Prefs.set(prefName("provider"), "openai", true);

    const endpoints = LLMEndpointManager.getEndpoints();

    expect(endpoints[0]).to.include({
      providerType: "openai",
      reasoningEffort: "medium",
    });
  });

  it("uses Seed 2.1 Pro for new Volcano Ark endpoints", function () {
    const defaults = LLMEndpointManager.providerDefaults("volcanoark");

    expect(defaults).to.include({
      apiUrl: "https://ark.cn-beijing.volces.com/api/v3/responses",
      model: "doubao-seed-2-1-pro-260628",
      reasoningEffort: "default",
    });
  });

  it("uses the recommended academic tuning for new Volcano endpoints", function () {
    const endpoint = LLMEndpointManager.createEndpoint("volcanoark");

    expect(endpoint).to.include({
      doubaoTuningPreset: "academic",
      reasoningEffort: "low",
      temperature: 0.2,
      stream: false,
    });
    expect(endpoint.maxOutputTokens).to.equal(undefined);
  });

  it("migrates an existing academic preset to stable transport", function () {
    const endpoint = LLMEndpointManager.createEndpoint("volcanoark");
    delete endpoint.stream;

    LLMEndpointManager.saveEndpoints([endpoint]);

    expect(LLMEndpointManager.getEndpoints()[0].stream).to.equal(false);
  });

  it("applies Doubao tuning presets without imposing an output cap", function () {
    const endpoint = LLMEndpointManager.createEndpoint("volcanoark");
    endpoint.topP = 0.9;

    LLMEndpointManager.applyDoubaoTuningPreset(endpoint, "deep-reasoning");
    expect(endpoint).to.include({
      reasoningEffort: "high",
      temperature: 0.2,
    });
    expect(endpoint.maxOutputTokens).to.equal(undefined);
    expect(endpoint.topP).to.equal(undefined);
    expect(endpoint.stream).to.equal(false);

    LLMEndpointManager.applyDoubaoTuningPreset(endpoint, "model-default");
    expect(endpoint.reasoningEffort).to.equal("default");
    expect(endpoint.temperature).to.equal(undefined);
    expect(endpoint.stream).to.equal(undefined);
  });

  it("passes endpoint-specific Doubao tuning into request options", function () {
    Zotero.Prefs.set(prefName("enableTemperature"), false, true);
    Zotero.Prefs.set(prefName("enableMaxTokens"), false, true);
    Zotero.Prefs.set(prefName("enableTopP"), true, true);
    Zotero.Prefs.set(prefName("topP"), "0.7", true);
    const endpoint = LLMEndpointManager.createEndpoint("volcanoark");

    const academic = LLMService.buildOptions(endpoint);
    expect(academic.temperature).to.equal(0.2);
    expect(academic.topP).to.equal(undefined);
    expect(academic.maxTokens).to.equal(undefined);
    expect(academic.stream).to.equal(false);

    LLMEndpointManager.applyDoubaoTuningPreset(endpoint, "model-default");
    Zotero.Prefs.set(prefName("enableTopP"), false, true);
    const modelDefault = LLMService.buildOptions(endpoint);
    expect(modelDefault.temperature).to.equal(undefined);
    expect(modelDefault.topP).to.equal(undefined);
    expect(modelDefault.maxTokens).to.equal(undefined);

    endpoint.temperature = undefined;
    endpoint.topP = 0.9;
    Zotero.Prefs.set(prefName("enableTemperature"), true, true);
    Zotero.Prefs.set(prefName("temperature"), "0.7", true);
    const topPOnly = LLMService.buildOptions(endpoint);
    expect(topPOnly.topP).to.equal(0.9);
    expect(topPOnly.temperature).to.equal(undefined);
  });

  it("syncs the migrated legacy endpoint from current provider prefs", function () {
    LLMEndpointManager.saveEndpoints([
      {
        ...makeEndpoint("endpoint-legacy-primary"),
        apiKey: "",
        model: "",
      },
    ]);
    Zotero.Prefs.set(prefName("provider"), "google", true);
    Zotero.Prefs.set(
      prefName("geminiApiUrl"),
      "https://generativelanguage.googleapis.com",
      true,
    );
    Zotero.Prefs.set(prefName("geminiApiKey"), "gemini-key", true);
    Zotero.Prefs.set(prefName("geminiModel"), "gemini-test-model", true);

    const synced = LLMEndpointManager.syncLegacyPrimaryEndpointFromPrefs();
    const endpoints = LLMEndpointManager.getEndpoints();

    expect(synced).not.to.equal(null);
    expect(synced!).to.include({
      id: "endpoint-legacy-primary",
      providerType: "google",
      apiKey: "gemini-key",
      model: "gemini-test-model",
      enabled: true,
    });
    expect(endpoints).to.have.length(1);
    expect(LLMEndpointManager.isEndpointUsable(endpoints[0])).to.equal(true);
  });

  it("does not overwrite manually created endpoints during legacy sync", function () {
    LLMEndpointManager.saveEndpoints([makeEndpoint("manual")]);
    Zotero.Prefs.set(prefName("provider"), "google", true);
    Zotero.Prefs.set(prefName("geminiApiKey"), "gemini-key", true);
    Zotero.Prefs.set(prefName("geminiModel"), "gemini-test-model", true);

    const synced = LLMEndpointManager.syncLegacyPrimaryEndpointFromPrefs();
    const endpoints = LLMEndpointManager.getEndpoints();

    expect(synced).to.equal(null);
    expect(endpoints).to.have.length(1);
    expect(endpoints[0]).to.include({
      id: "manual",
      providerType: "openai",
      apiKey: "sk-manual",
      model: "gpt-5",
    });
  });

  it("normalizes stored reasoning effort values", function () {
    LLMEndpointManager.saveEndpoints([
      { ...makeEndpoint("a"), reasoningEffort: "high" },
      {
        ...makeEndpoint("b"),
        providerType: "openai-compat",
        reasoningEffort: "invalid" as any,
      },
    ]);

    const endpoints = LLMEndpointManager.getEndpoints();

    expect(endpoints[0].reasoningEffort).to.equal("high");
    expect(endpoints[1].reasoningEffort).to.equal("default");
  });

  it("normalizes endpoint PDF modes and resolves global fallback", function () {
    Zotero.Prefs.set(prefName("pdfProcessMode"), "markdown", true);
    LLMEndpointManager.saveEndpoints([
      { ...makeEndpoint("a"), pdfProcessMode: "text" },
      { ...makeEndpoint("b"), pdfProcessMode: "invalid" as any },
    ]);

    const endpoints = LLMEndpointManager.getEndpoints();

    expect(endpoints[0].pdfProcessMode).to.equal("text");
    expect(endpoints[1].pdfProcessMode).to.equal("global");
    expect(
      LLMEndpointManager.getEffectivePdfProcessMode(endpoints[0]),
    ).to.equal("text");
    expect(
      LLMEndpointManager.getEffectivePdfProcessMode(endpoints[1]),
    ).to.equal("markdown");
  });

  it("returns priority route order and skips disabled endpoints", function () {
    LLMEndpointManager.saveEndpoints([
      makeEndpoint("a"),
      makeEndpoint("b", false),
      makeEndpoint("c"),
    ]);
    LLMEndpointManager.setRoutingStrategy("priority");
    Zotero.Prefs.set(prefName("maxApiSwitchCount"), "5", true);

    const route = LLMEndpointManager.prepareRoute();

    expect(route.strategy).to.equal("priority");
    expect(route.maxAttempts).to.equal(5);
    expect(route.endpoints.map((endpoint) => endpoint.id)).to.deep.equal([
      "a",
      "c",
    ]);
  });

  it("advances round-robin cursor after each attempted endpoint", function () {
    LLMEndpointManager.saveEndpoints([
      makeEndpoint("a"),
      makeEndpoint("b"),
      makeEndpoint("c"),
      makeEndpoint("d"),
    ]);
    LLMEndpointManager.setRoutingStrategy("roundRobin");
    Zotero.Prefs.set(prefName("llmRoundRobinCursor"), "b", true);

    const route = LLMEndpointManager.prepareRoute();
    expect(route.endpoints.map((endpoint) => endpoint.id)).to.deep.equal([
      "b",
      "c",
      "d",
      "a",
    ]);

    LLMEndpointManager.markEndpointAttempted("b");
    expect(Zotero.Prefs.get(prefName("llmRoundRobinCursor"), true)).to.equal(
      "c",
    );
    LLMEndpointManager.markEndpointAttempted("c");
    expect(Zotero.Prefs.get(prefName("llmRoundRobinCursor"), true)).to.equal(
      "d",
    );
  });

  it("throws clearly when no enabled endpoint exists", function () {
    LLMEndpointManager.saveEndpoints([makeEndpoint("a", false)]);

    expect(() => LLMEndpointManager.prepareRoute()).to.throw(
      "未配置可用的 LLM Endpoint",
    );
  });

  it("allows Ollama endpoints without API keys", function () {
    const endpoint: LLMEndpoint = {
      ...makeEndpoint("ollama"),
      providerType: "ollama",
      apiUrl: "http://localhost:11434",
      apiKey: "",
      model: "llama3.2",
    };

    expect(LLMEndpointManager.validateEndpoint(endpoint)).to.deep.equal([]);
    LLMEndpointManager.saveEndpoints([endpoint]);

    const route = LLMEndpointManager.prepareRoute();
    expect(route.endpoints[0]).to.include({
      providerType: "ollama",
      apiKey: "",
      model: "llama3.2",
    });
  });

  it("returns selected enabled endpoints for multi-model summaries", function () {
    LLMEndpointManager.saveEndpoints([
      makeEndpoint("a"),
      makeEndpoint("b", false),
      makeEndpoint("c"),
    ]);
    LLMEndpointManager.setMultiModelSummaryEnabled(true);
    LLMEndpointManager.setMultiModelSummaryEndpointIds([
      "c",
      "missing",
      "b",
      "c",
      "a",
    ]);

    expect(LLMEndpointManager.isMultiModelSummaryEnabled()).to.equal(true);
    expect(LLMEndpointManager.getMultiModelSummaryEndpointIds()).to.deep.equal([
      "c",
      "missing",
      "b",
      "a",
    ]);
    expect(
      LLMEndpointManager.getMultiModelSummaryEndpoints().map(
        (endpoint) => endpoint.id,
      ),
    ).to.deep.equal(["c", "a"]);
  });
});

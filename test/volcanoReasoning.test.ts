import { expect } from "chai";
import {
  resolveVolcanoReasoningEffort,
  resolveVolcanoThinkingType,
} from "../src/modules/llmproviders/shared/reasoning";
import { buildVolcanoGenerationOptions } from "../src/modules/llmproviders/shared/volcano";

describe("Volcano Ark reasoning options", function () {
  it("leaves the model default untouched", function () {
    expect(resolveVolcanoThinkingType(undefined)).to.equal(undefined);
    expect(resolveVolcanoThinkingType("default")).to.equal(undefined);
  });

  it("maps unified effort values to Volcano thinking modes", function () {
    expect(resolveVolcanoThinkingType("none")).to.equal("disabled");
    expect(resolveVolcanoThinkingType("minimal")).to.equal("disabled");
    expect(resolveVolcanoThinkingType("low")).to.equal("enabled");
    expect(resolveVolcanoThinkingType("medium")).to.equal("enabled");
    expect(resolveVolcanoThinkingType("high")).to.equal("enabled");
    expect(resolveVolcanoThinkingType("xhigh")).to.equal("enabled");
  });

  it("maps unified effort values to the native reasoning effort", function () {
    expect(resolveVolcanoReasoningEffort("none")).to.equal("minimal");
    expect(resolveVolcanoReasoningEffort("low")).to.equal("low");
    expect(resolveVolcanoReasoningEffort("medium")).to.equal("medium");
    expect(resolveVolcanoReasoningEffort("high")).to.equal("high");
    expect(resolveVolcanoReasoningEffort("xhigh")).to.equal("high");
  });

  it("only sends an output limit when the user configured one", function () {
    expect(buildVolcanoGenerationOptions({})).to.deep.equal({});
    expect(buildVolcanoGenerationOptions({ maxTokens: 8192.9 })).to.deep.equal({
      max_output_tokens: 8192,
    });
  });

  it("sends sampling parameters only when explicitly configured", function () {
    expect(buildVolcanoGenerationOptions({})).to.not.have.keys(
      "temperature",
      "top_p",
    );
    expect(
      buildVolcanoGenerationOptions({ temperature: 0.2, topP: 0.9 }),
    ).to.deep.equal({ temperature: 0.2, top_p: 0.9 });
  });

  it("builds the native thinking payload", function () {
    expect(
      buildVolcanoGenerationOptions({ reasoningEffort: "low" }),
    ).to.deep.equal({
      thinking: { type: "enabled" },
      reasoning: { effort: "low" },
    });
    expect(
      buildVolcanoGenerationOptions({ reasoningEffort: "none" }),
    ).to.deep.equal({
      thinking: { type: "disabled" },
      reasoning: { effort: "minimal" },
    });
  });
});

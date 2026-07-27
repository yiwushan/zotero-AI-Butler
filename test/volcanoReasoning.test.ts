import { expect } from "chai";
import { resolveVolcanoThinkingType } from "../src/modules/llmproviders/shared/reasoning";
import { buildVolcanoGenerationOptions } from "../src/modules/llmproviders/shared/volcano";

describe("Volcano Ark reasoning options", function () {
  it("leaves the model default untouched", function () {
    expect(resolveVolcanoThinkingType(undefined)).to.equal(undefined);
    expect(resolveVolcanoThinkingType("default")).to.equal(undefined);
  });

  it("maps unified effort values to Volcano thinking modes", function () {
    expect(resolveVolcanoThinkingType("none")).to.equal("disabled");
    expect(resolveVolcanoThinkingType("minimal")).to.equal("disabled");
    expect(resolveVolcanoThinkingType("low")).to.equal("auto");
    expect(resolveVolcanoThinkingType("medium")).to.equal("enabled");
    expect(resolveVolcanoThinkingType("high")).to.equal("enabled");
    expect(resolveVolcanoThinkingType("xhigh")).to.equal("enabled");
  });

  it("only sends an output limit when the user configured one", function () {
    expect(buildVolcanoGenerationOptions({})).to.deep.equal({});
    expect(buildVolcanoGenerationOptions({ maxTokens: 8192.9 })).to.deep.equal({
      max_output_tokens: 8192,
    });
  });

  it("builds the native thinking payload", function () {
    expect(
      buildVolcanoGenerationOptions({ reasoningEffort: "low" }),
    ).to.deep.equal({ thinking: { type: "auto" } });
  });
});

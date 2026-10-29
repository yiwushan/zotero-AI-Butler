import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { URL } from "node:url";
import vm from "node:vm";
import { transformSync } from "esbuild";

function load(file, imports, exports = "", globals = {}) {
  const source = readFileSync(
    new URL(`../src/${file}`, import.meta.url),
    "utf8",
  );
  const module = { exports: {} };
  vm.runInNewContext(
    transformSync(`${source}\n${exports}`, {
      loader: "ts",
      format: "cjs",
      supported: { "dynamic-import": false },
    }).code,
    {
      module,
      exports: module.exports,
      require: (name) => imports[name] || {},
      ...globals,
    },
  );
  return module.exports;
}

test("sidebar never offers or constructs chat even when every module was enabled", () => {
  const sidebar = load(
    "modules/ItemPaneSection.ts",
    {
      "./edition": { CHAT_ENABLED: false },
      "./uiCustomization": { isSidebarModuleEnabled: () => true },
    },
    "export { getAvailableSidebarTabs, renderChatArea };",
  );
  const tabs = Array.from(sidebar.getAvailableSidebarTabs(), ({ id }) => id);
  assert.ok(!tabs.includes("chat"));
  assert.ok(tabs.includes("deepRead"));
  assert.ok(tabs.includes("summary"));
  // No DOM or item is needed: the guard must run before initialization.
  sidebar.renderChatArea(null, null, null, true);
});

test("reader toolbar and chat-open handlers exit before host access", async () => {
  const hooks = load(
    "hooks.ts",
    {
      "./modules/edition": { CHAT_ENABLED: false },
    },
    "export { registerReaderToolbarButton, handleOpenAIChat };",
  );
  hooks.registerReaderToolbarButton();
  await hooks.handleOpenAIChat(42);
});

test("summary view does not initialize follow-up history or load a chat paper", async () => {
  const { SummaryView } = load("modules/views/SummaryView.ts", {
    "../edition": { CHAT_ENABLED: false },
    "./BaseView": { BaseView: class {} },
  });
  const view = new SummaryView();
  view.setCurrentPaperContext(42, "paper", false, "summary");
  await view.loadItemForChat(42);
  await view.handleChatSend();
  assert.equal(view.currentItemId, null);
  assert.equal(view.chatContainer, null);
  assert.equal(view.currentPdfContent, "");
});

for (const scenario of ["reading-only", "missing-source", "empty-source"]) {
  test(`saved notes display independently of PDF extraction (${scenario})`, async () => {
    let extractions = 0;
    const cards = [];
    const messages = [];
    const { SummaryView } = load(
      "modules/views/SummaryView.ts",
      {
        "../edition": { CHAT_ENABLED: scenario !== "reading-only" },
        "./BaseView": { BaseView: class {} },
        "../../utils/locale": { getString: (key) => key },
        "../aiNoteService": {
          AiNoteService: {
            findNoteRecord: async () => ({
              note: { id: 123 },
              rawHtml: "<p>Existing saved summary</p>",
            }),
          },
        },
        "../contentExtractor": {
          ContentExtractor: {
            extractAnalyzableContentFromItem: async () => {
              extractions++;
              if (scenario === "empty-source") return { content: "" };
              throw new Error("Original PDF is unavailable");
            },
          },
        },
        "../llmService": {
          __esModule: true,
          default: { getEffectivePdfProcessMode: () => "parsed-markdown" },
        },
      },
      "",
      {
        Zotero: {
          Items: { getAsync: async () => ({ getField: () => "Paper" }) },
        },
        ztoolkit: { log() {} },
      },
    );
    const view = new SummaryView();
    view.clear = () => {};
    view.showLoadingState = () => {};
    view.hideLoading = () => {};
    view.startItem = () => {};
    view.finishItem = () => {};
    view.appendSummaryCard = (text) => cards.push(text);
    view.appendContent = (text) => messages.push(text);
    view.clearPaperContext = () => {};
    await view.showSavedNoteForItem(42);
    assert.deepEqual(cards, ["Existing saved summary"]);
    assert.deepEqual(messages, []);
    assert.equal(extractions, scenario === "reading-only" ? 0 : 1);
    assert.equal(view.currentItemId, null);
    assert.equal(view.chatContainer, null);
  });
}

test("main window has no Agent import, tab or service initialization", () => {
  const main = readFileSync(
    new URL("../src/modules/views/MainWindow.ts", import.meta.url),
    "utf8",
  );
  const hooks = readFileSync(
    new URL("../src/hooks.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(main, /AgentView|AgentService|id:\s*"agent"/);
  assert.doesNotMatch(hooks, /AgentService/);
});

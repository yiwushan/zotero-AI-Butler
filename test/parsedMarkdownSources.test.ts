import { expect } from "chai";
import JSZip from "jszip";
import { ParsedMarkdownExtractor } from "../src/modules/parsedMarkdownExtractor";
import { ContentExtractor } from "../src/modules/contentExtractor";

describe("Parsed Markdown reading sources", function () {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originals = new Map<string, unknown>();
  let items: Map<number, Zotero.Item>;
  let contents: Map<string, string | Uint8Array>;
  let parent: Zotero.Item;

  beforeEach(function () {
    for (const key of ["Zotero", "IOUtils", "PathUtils"])
      originals.set(key, globals[key]);
    items = new Map();
    contents = new Map();
    parent = {
      id: 1,
      getAttachments: () => [...items.keys()].filter((id) => id !== 1),
    } as unknown as Zotero.Item;
    items.set(1, parent);
    globals.Zotero = {
      locale: "en-US",
      Prefs: { get: () => undefined },
      DataDirectory: { dir: "/zotero" },
      Items: { getAsync: async (id: number) => items.get(id) || false },
      File: { getContentsAsync: async (path: string) => contents.get(path) },
      Sync: {
        Runner: {
          downloadFile: () => {
            throw new Error("No downloads expected");
          },
        },
      },
    };
    globals.IOUtils = {
      exists: async (path: string) => contents.has(path),
      read: async (path: string) => contents.get(path),
    };
    globals.PathUtils = { join: (...parts: string[]) => parts.join("/") };
  });

  afterEach(function () {
    for (const [key, value] of originals) {
      if (value === undefined) delete globals[key];
      else globals[key] = value;
    }
  });
  function attachment(
    id: number,
    title: string,
    type: string,
    key = "",
  ): Zotero.Item {
    const item = {
      id,
      key,
      parentItemID: 1,
      attachmentContentType: type,
      getField: () => title,
      getFilename: () => title,
      getTags: () => [],
      dateAdded: "2026-01-01",
      isAttachment: () => true,
      getFilePathAsync: async () => `/files/${id}/${title}`,
    } as unknown as Zotero.Item;
    items.set(id, item);
    return item;
  }

  it("uses an existing .md as text even when Base64 was preferred", async function () {
    const md = attachment(2, "paper.md", "text/markdown");
    contents.set(
      (await md.getFilePathAsync()) as string,
      "# Existing paper\n\nParsed table",
    );
    const result = await ContentExtractor.extractAnalyzableContentFromItem(
      parent,
      true,
      "markdown",
    );
    expect(result).to.include({
      content: "# Existing paper\n\nParsed table",
      isBase64: false,
      attachment: md,
    });
  });

  it("reads llm-for-zotero's local full.md without the PDF file", async function () {
    attachment(2, "paper.pdf", "application/pdf", "PDFKEY01");
    contents.set(
      "/zotero/llm-for-zotero-mineru/2/full.md",
      "# Cached parsed paper",
    );
    expect(await ParsedMarkdownExtractor.hasAvailableSource(parent)).to.equal(
      true,
    );
    expect(await ParsedMarkdownExtractor.extractFromItem(parent)).to.include({
      markdown: "# Cached parsed paper",
      source: "llm-for-zotero-local-cache",
    });
  });

  it("reads a synced MinerU ZIP and checks its source PDF key", async function () {
    attachment(2, "paper.pdf", "application/pdf", "PDFKEY01");
    const archive = attachment(
      3,
      "[LLM for Zotero] MinerU cache.zip",
      "application/zip",
    );
    const zip = new JSZip();
    zip.file("full.md", "# Synced parsed paper");
    zip.file(
      "_llm_sync.json",
      JSON.stringify({
        kind: "llm-for-zotero/mineru-cache",
        sourceAttachmentKey: "PDFKEY01",
      }),
    );
    contents.set(
      (await archive.getFilePathAsync()) as string,
      await zip.generateAsync({ type: "uint8array" }),
    );
    expect(await ParsedMarkdownExtractor.extractFromItem(parent)).to.include({
      markdown: "# Synced parsed paper",
      source: "llm-for-zotero-zip",
    });
    (items.get(2) as any).key = "OTHERPDF";
    let failure: unknown;
    try {
      await ParsedMarkdownExtractor.extractFromItem(parent);
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).to.contain("parsed-markdown-error-not-found");
  });
});

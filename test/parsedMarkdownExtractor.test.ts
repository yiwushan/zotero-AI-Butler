import { expect } from "chai";
import JSZip from "jszip";
import {
  mineruArchiveMatchesSource,
  parseMineruArchive,
} from "../src/modules/parsedMarkdownExtractor";

async function makeZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("parsed Markdown archive support", function () {
  it("reads llm-for-zotero sync metadata and prefers full.md", async function () {
    const bytes = await makeZip({
      "notes/other.md": "wrong markdown",
      "full.md": "# Parsed paper\n\n| A | B |\n|---|---|",
      "_llm_sync.json": JSON.stringify({
        kind: "llm-for-zotero/mineru-cache",
        version: 1,
        sourceAttachmentKey: "PDFKEY01",
      }),
    });

    const result = await parseMineruArchive(bytes);

    expect(result).to.include({
      markdownPath: "full.md",
      sourceAttachmentKey: "PDFKEY01",
      isLlmForZoteroPackage: true,
    });
    expect(result?.markdown).to.contain("# Parsed paper");
    expect(result?.markdown).not.to.contain("wrong markdown");
  });

  it("supports raw MinerU ZIPs with a nested full.md", async function () {
    const bytes = await makeZip({
      "result/full.md": "## Raw MinerU result",
      "result/images/figure.png": "not-a-real-image",
    });

    const result = await parseMineruArchive(bytes);

    expect(result).to.deep.include({
      markdown: "## Raw MinerU result",
      markdownPath: "result/full.md",
      isLlmForZoteroPackage: false,
    });
  });

  it("rejects a package associated with another PDF attachment", async function () {
    const bytes = await makeZip({
      "full.md": "# Paper A",
      "_llm_sync.json": JSON.stringify({
        kind: "llm-for-zotero/mineru-cache",
        version: 1,
        sourceAttachmentKey: "PDF_A",
      }),
    });
    const archive = await parseMineruArchive(bytes);

    expect(archive).not.to.equal(null);
    expect(mineruArchiveMatchesSource(archive!, "PDF_A")).to.equal(true);
    expect(mineruArchiveMatchesSource(archive!, "PDF_B")).to.equal(false);
  });

  it("rejects malformed llm-for-zotero package metadata", async function () {
    const bytes = await makeZip({
      "full.md": "# Should not be used",
      "_llm_sync.json": JSON.stringify({
        kind: "different/package",
        sourceAttachmentKey: "PDFKEY01",
      }),
    });

    expect(await parseMineruArchive(bytes)).to.equal(null);
  });

  it("returns null when the archive has no Markdown", async function () {
    const bytes = await makeZip({ "content_list.json": "[]" });
    expect(await parseMineruArchive(bytes)).to.equal(null);
  });
});

import JSZip from "jszip";
import { getString } from "../utils/locale";
import { MineruMarkdownSaver } from "./mineruMarkdownSaver";

const LLM_FOR_ZOTERO_PACKAGE_KIND = "llm-for-zotero/mineru-cache";
const LLM_FOR_ZOTERO_PACKAGE_PREFIX = "[LLM for Zotero] MinerU cache";
const LLM_FOR_ZOTERO_METADATA_FILE = "_llm_sync.json";

export type ParsedMarkdownSource =
  | "llm-for-zotero-local-cache"
  | "llm-for-zotero-zip"
  | "ai-butler-markdown"
  | "markdown-attachment"
  | "generic-mineru-zip";

export type ParsedMarkdownResult = {
  markdown: string;
  source: ParsedMarkdownSource;
  sourceLabel: string;
  attachment?: Zotero.Item;
};

export type ParsedMineruArchive = {
  markdown: string;
  markdownPath: string;
  sourceAttachmentKey?: string;
  isLlmForZoteroPackage: boolean;
};

export function mineruArchiveMatchesSource(
  archive: ParsedMineruArchive,
  sourceAttachmentKey: string,
): boolean {
  const expected = sourceAttachmentKey.trim();
  const actual = String(archive.sourceAttachmentKey || "").trim();
  return !expected || !actual || expected === actual;
}

type MineruSyncMetadata = {
  kind?: unknown;
  sourceAttachmentKey?: unknown;
  attachmentKey?: unknown;
};

function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function isIgnoredArchivePath(path: string): boolean {
  const parts = normalizeArchivePath(path).split("/");
  return parts.includes("__MACOSX") || parts.includes(".DS_Store");
}

function getItemKey(item?: Zotero.Item | null): string {
  return String((item as any)?.key || "").trim();
}

function getAttachmentTitle(item: Zotero.Item): string {
  return String(item.getField?.("title") || "").trim();
}

function getAttachmentFilename(item: Zotero.Item): string {
  try {
    return String((item as any).getFilename?.() || "").trim();
  } catch {
    return "";
  }
}

function getAttachmentSearchText(item: Zotero.Item): string {
  return `${getAttachmentTitle(item)} ${getAttachmentFilename(item)}`.trim();
}

function isMarkdownAttachment(item: Zotero.Item): boolean {
  const contentType = String(
    (item as any).attachmentContentType ||
      (item as any).attachmentMIMEType ||
      "",
  ).toLowerCase();
  return (
    contentType === "text/markdown" ||
    /\.md(?:\s|$)/i.test(getAttachmentSearchText(item))
  );
}

function isZipAttachment(item: Zotero.Item): boolean {
  const contentType = String(
    (item as any).attachmentContentType ||
      (item as any).attachmentMIMEType ||
      "",
  ).toLowerCase();
  return (
    contentType === "application/zip" ||
    /\.zip(?:\s|$)/i.test(getAttachmentSearchText(item))
  );
}

async function getAvailableAttachmentPath(
  attachment: Zotero.Item,
): Promise<string | null> {
  const currentPath = await attachment.getFilePathAsync();
  if (currentPath && (await IOUtils.exists(currentPath))) return currentPath;

  if (!(attachment as any).isStoredFileAttachment?.()) return null;
  const downloadFile = (Zotero as any).Sync?.Runner?.downloadFile;
  if (typeof downloadFile !== "function") return null;

  try {
    await downloadFile.call((Zotero as any).Sync.Runner, attachment);
    const downloadedPath = await attachment.getFilePathAsync();
    return downloadedPath && (await IOUtils.exists(downloadedPath))
      ? downloadedPath
      : null;
  } catch (error) {
    ztoolkit.log(
      "[ParsedMarkdownExtractor] Failed to download stored attachment:",
      error,
    );
    return null;
  }
}

async function readAttachmentBytes(
  attachment: Zotero.Item,
): Promise<Uint8Array | null> {
  try {
    const filePath = await getAvailableAttachmentPath(attachment);
    if (!filePath) return null;
    return await IOUtils.read(filePath);
  } catch (error) {
    ztoolkit.log("[ParsedMarkdownExtractor] Failed to read attachment:", error);
    return null;
  }
}

async function readMarkdownAttachment(
  attachment: Zotero.Item,
): Promise<string | null> {
  try {
    const filePath = await getAvailableAttachmentPath(attachment);
    if (!filePath) return null;
    const content = await Zotero.File.getContentsAsync(filePath, "utf-8");
    return typeof content === "string" && content.trim() ? content : null;
  } catch (error) {
    ztoolkit.log(
      "[ParsedMarkdownExtractor] Failed to read Markdown attachment:",
      error,
    );
    return null;
  }
}

export async function parseMineruArchive(
  bytes: Uint8Array,
): Promise<ParsedMineruArchive | null> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const files = Object.values(zip.files).filter(
      (entry) => !entry.dir && !isIgnoredArchivePath(entry.name),
    );
    const fullMarkdown = files.find((entry) =>
      /(^|\/)full\.md$/i.test(normalizeArchivePath(entry.name)),
    );
    const markdownEntry =
      fullMarkdown ||
      files.find((entry) =>
        normalizeArchivePath(entry.name).toLowerCase().endsWith(".md"),
      );
    if (!markdownEntry) return null;

    const markdown = await markdownEntry.async("string");
    if (!markdown.trim()) return null;

    let metadata: MineruSyncMetadata | null = null;
    const metadataEntry = files.find(
      (entry) =>
        normalizeArchivePath(entry.name) === LLM_FOR_ZOTERO_METADATA_FILE,
    );
    if (metadataEntry) {
      try {
        metadata = JSON.parse(await metadataEntry.async("string"));
      } catch {
        return null;
      }
    }

    const isLlmForZoteroPackage =
      metadata?.kind === LLM_FOR_ZOTERO_PACKAGE_KIND;
    const sourceAttachmentKey = String(
      metadata?.sourceAttachmentKey || metadata?.attachmentKey || "",
    ).trim();
    if (metadataEntry && (!isLlmForZoteroPackage || !sourceAttachmentKey)) {
      return null;
    }

    return {
      markdown,
      markdownPath: normalizeArchivePath(markdownEntry.name),
      sourceAttachmentKey: sourceAttachmentKey || undefined,
      isLlmForZoteroPackage,
    };
  } catch {
    return null;
  }
}

export class ParsedMarkdownExtractor {
  public static async extractFromItem(
    item: Zotero.Item,
    sourceAttachment?: Zotero.Item,
  ): Promise<ParsedMarkdownResult> {
    const parentItem = await this.resolveParentItem(item);
    const source = sourceAttachment || (await this.findOldestPdf(parentItem));

    if (source) {
      const local = await this.readLlmForZoteroLocalCache(source);
      if (local) return local;
    }

    const attachments = await this.getChildAttachments(parentItem);
    const sourceKey = getItemKey(source);
    const zipFallbacks: Array<{
      attachment: Zotero.Item;
      archive: ParsedMineruArchive;
    }> = [];

    for (const attachment of attachments) {
      if (!isZipAttachment(attachment)) continue;
      const searchText = getAttachmentSearchText(attachment);
      const bytes = await readAttachmentBytes(attachment);
      if (!bytes) continue;
      const archive = await parseMineruArchive(bytes);
      if (!archive) continue;

      if (!mineruArchiveMatchesSource(archive, sourceKey)) {
        continue;
      }
      if (
        archive.sourceAttachmentKey &&
        archive.sourceAttachmentKey === sourceKey
      ) {
        return {
          markdown: archive.markdown,
          source: "llm-for-zotero-zip",
          sourceLabel: getAttachmentTitle(attachment) || archive.markdownPath,
          attachment,
        };
      }
      if (
        !archive.isLlmForZoteroPackage &&
        !searchText.startsWith(LLM_FOR_ZOTERO_PACKAGE_PREFIX) &&
        !/(mineru|markdown)/i.test(searchText)
      ) {
        continue;
      }
      zipFallbacks.push({ attachment, archive });
    }

    const aiButlerMarkdown =
      await MineruMarkdownSaver.readCachedMarkdown(parentItem);
    if (aiButlerMarkdown) {
      return {
        markdown: aiButlerMarkdown,
        source: "ai-butler-markdown",
        sourceLabel: getString("parsed-markdown-source-ai-butler"),
      };
    }

    for (const attachment of attachments) {
      if (!isMarkdownAttachment(attachment)) continue;
      const markdown = await readMarkdownAttachment(attachment);
      if (!markdown) continue;
      return {
        markdown,
        source: "markdown-attachment",
        sourceLabel:
          getAttachmentTitle(attachment) || getAttachmentFilename(attachment),
        attachment,
      };
    }

    if (zipFallbacks.length === 1) {
      const { attachment, archive } = zipFallbacks[0];
      return {
        markdown: archive.markdown,
        source: archive.isLlmForZoteroPackage
          ? "llm-for-zotero-zip"
          : "generic-mineru-zip",
        sourceLabel: getAttachmentTitle(attachment) || archive.markdownPath,
        attachment,
      };
    }

    throw new Error(getString("parsed-markdown-error-not-found"));
  }

  private static async resolveParentItem(
    item: Zotero.Item,
  ): Promise<Zotero.Item> {
    const parentId = Number(
      (item as any).parentItemID || (item as any).parentID || 0,
    );
    if (!parentId) return item;
    return (await Zotero.Items.getAsync(parentId)) || item;
  }

  private static async getChildAttachments(
    item: Zotero.Item,
  ): Promise<Zotero.Item[]> {
    const result: Zotero.Item[] = [];
    for (const id of item.getAttachments?.() || []) {
      const attachment = await Zotero.Items.getAsync(id);
      if (attachment?.isAttachment?.()) result.push(attachment);
    }
    return result.sort((a, b) =>
      String(b.dateModified || b.dateAdded || "").localeCompare(
        String(a.dateModified || a.dateAdded || ""),
      ),
    );
  }

  private static async findOldestPdf(
    item: Zotero.Item,
  ): Promise<Zotero.Item | undefined> {
    const attachments = await this.getChildAttachments(item);
    return attachments
      .filter((attachment) => {
        const contentType = String(
          (attachment as any).attachmentContentType || "",
        ).toLowerCase();
        return contentType === "application/pdf";
      })
      .sort((a, b) =>
        String(a.dateAdded || "").localeCompare(String(b.dateAdded || "")),
      )[0];
  }

  private static async readLlmForZoteroLocalCache(
    sourceAttachment: Zotero.Item,
  ): Promise<ParsedMarkdownResult | null> {
    try {
      const dataDir = String((Zotero as any).DataDirectory?.dir || "").trim();
      if (!dataDir || !sourceAttachment.id) return null;
      const filePath = PathUtils.join(
        dataDir,
        "llm-for-zotero-mineru",
        String(sourceAttachment.id),
        "full.md",
      );
      if (!(await IOUtils.exists(filePath))) return null;
      const markdown = await Zotero.File.getContentsAsync(filePath, "utf-8");
      if (typeof markdown !== "string" || !markdown.trim()) return null;
      return {
        markdown,
        source: "llm-for-zotero-local-cache",
        sourceLabel: getString("parsed-markdown-source-llm-local"),
      };
    } catch (error) {
      ztoolkit.log(
        "[ParsedMarkdownExtractor] Failed to read llm-for-zotero cache:",
        error,
      );
      return null;
    }
  }
}

# Doubao Reading Edition

Based on upstream Zotero AI Butler 5.1.1. Custom version: `5.1.1-doubao-lite.1`.

## Scope

- Agent has no tab, initialization, or permitted LLMService entry point.
- User chat is disabled: item context menu, reader toolbar, sidebar quick chat,
  follow-up composer, and chat-history settings.
- Internal provider chat remains available for multi-round deep reading and
  truncated-output continuation. Disabling user chat does not turn deep reading
  into a single model call.
- Keep upstream completion validation, partial drafts, request diagnostics,
  transient retry backoff, custom MinerU servers, EPUB, and note exports.
- Keep custom Doubao Seed 2.1 presets, native Ark reasoning parameters, reading
  prompts, and existing parsed Markdown/ZIP sources.
- No official automatic update feed is included, so an official release cannot
  silently replace the customized edition. Future upgrades require a new build.

## Cost Defaults

The first startup of this edition turns off automatic library scanning,
automatic image summaries, simultaneous multi-model summaries, and independent
parallel deep-reading requests. API keys, endpoint definitions, notes, and
attachments are not removed. These defaults run once; later explicit user
choices are preserved.

Truncated output may trigger at most one extra model call. Set automatic
continuation to `0` to disable it. A still-incomplete answer remains a partial
draft, not a completed note. Manual deep reading, image generation, and other
explicitly requested tasks can still make multiple paid calls.

## Doubao And Parsed Content

Use the Volcano Ark provider and its `/api/v3/responses` endpoint. Keep the
model ID actually available in your Ark account. Academic tuning uses medium
reasoning, streaming, and a 32768 output-token limit; fast tuning disables
thinking and uses a smaller limit. Limits are ceilings, not token-usage targets.
High-reasoning deep reading is available but is not the cheapest option.

Choose the existing parsed Markdown PDF-processing mode either globally or
on the Doubao endpoint. Sources include:

- `llm-for-zotero-mineru/<PDF attachment ID>/full.md` in Zotero's data directory.
- `[LLM for Zotero] MinerU cache` ZIP attachments with `_llm_sync.json` metadata.
  The source attachment key is checked before using the parsed text.
- AI Butler's previously saved MinerU Markdown attachment or configured
  external Markdown cache.
- Plain `.md` attachments and named MinerU/Markdown result ZIPs.

This mode sends Markdown as text, not the PDF. It does not invoke MinerU again.
Image links in Markdown do not upload the actual images to the model. Source
filtering only probes local candidate files; ZIP validation happens at reading
time and does not inflate archives during library scans.

## Verification

Run `npm run test:reading-edition`, `npm run test:llm-completion`,
`npm run test:task-queue`, `npm run test:mineru`, and `npm run build`.
Tests use mock credentials and local fixtures, not paid model requests.
Zotero host integration must be checked separately on an existing installation.

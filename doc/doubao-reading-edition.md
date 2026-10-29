# Doubao Reading Edition

Based on upstream Zotero AI Butler 5.1.1. Custom version: `5.1.1-doubao-lite.3`.

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
- Keep the mandatory HTTPS update URL, but disable automatic updates for this
  add-on through AddonManager on startup. This does not change any other add-on's
  update policy. Do not manually update to the upstream edition when you want to
  retain the customized features.

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

### Installation Fix In Lite.2

Lite.1 incorrectly omitted `applications.zotero.update_url`. Zotero 10.0.6
requires that field even when automatic updates are not wanted. Its installer
reports the generic incompatibility error when the field is missing.

The authoritative checks are in Zotero's
[10.0.6 platform build script](https://github.com/zotero/zotero/blob/536244c2771f590abab9c09a3c27e615e0b318ff/app/scripts/fetch_xulrunner#L243).
Gecko also requires a secure update URL for usability; a local `data:` URL is
not a suitable replacement. Lite.2 restores the HTTPS field and uses the
per-add-on update setting instead. Postbuild now checks the actual XPI archive
and the required Zotero installation fields, not only the runtime bundle.

### Note Preview Fix In Lite.3

The upstream tabbed sidebar sized its body from its distance to the bottom of
the viewport. When Zotero initially rendered the section below the viewport,
this became zero; scrolling to the section did not recalculate its height.
Lite.3 reserves space for offscreen sections and recalculates on host scrolling,
without reacting to scrolling inside the note itself. Hidden legacy iframes
still use their own viewport, not the main window's height.

Opening a saved summary from the task queue now displays the note before any
PDF extraction. In the reading edition it does not extract the source document
or initialize chat at all. These changes do not regenerate or delete notes,
enable Agent/chat, or reset sidebar visibility preferences.

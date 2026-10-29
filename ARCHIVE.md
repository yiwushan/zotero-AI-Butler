# Doubao Fork Archive

Archive date: 2026-10-29.

Repository: <https://github.com/yiwushan/zotero-AI-Butler>.

## Maintenance Status

The maintainer has ended development of this custom fork because the free
model access previously relied on no longer meets their needs. This is a
maintenance decision, not a verified statement about every Volcano Ark model,
pricing plan, or free allowance. The upstream project is independent:
<https://github.com/steven-jianhao-li/zotero-AI-Butler>.

This fork is preserved as a read-only historical snapshot. No future API,
pricing, Zotero compatibility, or security updates are promised. Existing
Zotero notes and attachments remain local and are not removed by archiving
this repository. No Zotero library, personal configuration, API credentials,
or debug logs are part of this archive.

## Final Snapshot

- Final custom version: `5.1.1-doubao-lite.3`, based on upstream 5.1.1.
- Final tag: `v5.1.1-doubao-lite.3`.
- Final source: `main` and `codex/upstream-5.1.1-doubao-lite`.
- Older custom source: `codex/upstream-4.0.3-doubao-mineru-md`.
- Installer: `zotero-ai-butler-5.1.1-doubao-lite.3.xpi`, attached to the final
  [GitHub release](https://github.com/yiwushan/zotero-AI-Butler/releases/tag/v5.1.1-doubao-lite.3).
- SHA-256: `bbbe771caa50217844095a7308534b273ebd6c8b38048830f74fb0bb4a07e6de`.

The final edition retains custom Doubao Seed 2.1 / Volcano Ark requests and
presets, academic prompts, existing parsed Markdown and MinerU ZIP input,
Zotero installation metadata fixes, and the saved-note preview fixes.
Agent and user-facing chat remain disabled. Internal model conversations for
deep reading remain available. Generating new content requires a valid API
account and may incur charges; this archive does not provide a free service.

The known-bad `lite.1` installer is not included in the final release.
Older upstream release tags are preserved as history and do not identify the
final custom build. See [reading edition notes](doc/doubao-reading-edition.md)
for the retained behavior and conservative cost defaults.

## Verification At Freeze

- Regression tests cover sidebar sizing, scroll listener cleanup, and saved
  summaries independent of PDF extraction.
- Reading-edition, LLM-completion, task-queue, and MinerU fixture tests pass.
- Build, TypeScript, formatting, lint, XPI integrity, and required Zotero
  installation metadata checks pass.
- Desktop and narrow-sidebar browser simulations display existing notes,
  allow switching summary/deep-reading tabs, and handle resizing.
- The final package has not been verified in the user's Windows Zotero 10.0.6
  host. Mock tests and browser simulations are not host integration tests.
- Verification used local fixtures and no paid model requests.

## Reproduction

```sh
npm ci
npm run test:reading-edition -- --reporter dot
npm run test:llm-completion -- --reporter dot
npm run test:task-queue -- --reporter dot
npm run test:mineru
npm run test:sidebar
npm run lint:check
npm run build
```

The generated installer is `.scaffold/build/zotero-ai-butler.xpi`. Package
metadata and ZIP integrity are checked by the postbuild scripts. Dependencies
and host APIs may change after this snapshot; future reproducibility is not
guaranteed.

The upstream AGPL-3.0-or-later license and copyright notices remain intact.

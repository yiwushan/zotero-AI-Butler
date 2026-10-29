import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const directory = path.resolve(".scaffold/reading-edition-tests");
await mkdir(directory, { recursive: true });
const outfile = path.join(directory, "reading.cjs");
await build({
  stdin: {
    contents: [
      "readingEdition",
      "volcanoReasoning",
      "parsedMarkdownExtractor",
      "parsedMarkdownSources",
      "llmEndpointManager",
    ]
      .map((name) => `import './test/${name}.test.ts';`)
      .join("\n"),
    resolveDir: process.cwd(),
    loader: "ts",
  },
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  define: { __env__: '"test"' },
  logLevel: "silent",
  banner: {
    js: `const fixturePrefs = new Map();
globalThis.Zotero = { locale: "en-US", Prefs: { get: k => fixturePrefs.get(k), set: (k,v) => fixturePrefs.set(k,v), clear: k => fixturePrefs.delete(k) } };
globalThis.addon = { data: {} };
globalThis.ztoolkit = { log() {} };`,
  },
});
const result = spawnSync(
  process.execPath,
  [
    "node_modules/mocha/bin/mocha.js",
    outfile,
    "--timeout",
    "15000",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
if (process.exitCode === 0) {
  const ui = spawnSync(
    process.execPath,
    ["--test", "test/readingEditionUi.test.mjs"],
    { stdio: "inherit" },
  );
  process.exitCode = ui.status ?? 1;
}

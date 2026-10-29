import assert from "node:assert/strict";
import { test } from "node:test";
import { validateZoteroManifest } from "../scripts/check-package.mjs";

function manifest() {
  return {
    manifest_version: 2,
    version: "5.1.1-doubao-lite.2",
    applications: {
      zotero: {
        id: "zotero-ai-butler@github.com",
        update_url: "https://example.org/update.json",
        strict_min_version: "7.0.0",
        strict_max_version: "10.*",
      },
    },
  };
}

test("accepts a custom version and Zotero 7-10 installation metadata", () => {
  assert.doesNotThrow(() => validateZoteroManifest(manifest()));
});

for (const key of ["id", "update_url", "strict_max_version"]) {
  for (const value of [undefined, "", " "]) {
    test(`rejects missing Zotero ${key} (${String(value)})`, () => {
      const candidate = manifest();
      candidate.applications.zotero[key] = value;
      assert.throws(
        () => validateZoteroManifest(candidate),
        new RegExp(`${key} not provided`),
      );
    });
  }
}

test("rejects insecure update feeds instead of disabling Gecko security", () => {
  const candidate = manifest();
  candidate.applications.zotero.update_url = "data:application/json,{}";
  assert.throws(() => validateZoteroManifest(candidate), /HTTPS/);
});

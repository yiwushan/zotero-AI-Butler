import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import AdmZip from "adm-zip";
import pkg from "../package.json" with { type: "json" };

export function validateZoteroManifest(manifest) {
  assert.equal(manifest.manifest_version, 2, "Unsupported manifest format");
  assert.equal(typeof manifest.version, "string", "Missing add-on version");
  assert.ok(manifest.version.trim(), "Missing add-on version");
  const application = manifest.applications?.zotero;
  // Zotero 10.0.6 app/scripts/fetch_xulrunner, not just the Firefox schema.
  for (const key of ["id", "update_url", "strict_max_version"]) {
    assert.equal(
      typeof application?.[key],
      "string",
      `applications.zotero.${key} not provided`,
    );
    assert.ok(
      application[key].trim(),
      `applications.zotero.${key} not provided`,
    );
  }
  assert.equal(
    new URL(application.update_url).protocol,
    "https:",
    "Update checks must use HTTPS",
  );
  assert.doesNotMatch(
    JSON.stringify(manifest),
    /__[A-Za-z]+__/,
    "Unexpanded manifest placeholder",
  );
}

export function validateXpi(filename) {
  const zip = new AdmZip(filename);
  assert.ok(zip.test(), "XPI archive integrity check failed");
  for (const file of [
    "manifest.json",
    "bootstrap.js",
    "prefs.js",
    "content/scripts/aiButler.js",
  ]) {
    assert.ok(zip.getEntry(file), `Missing XPI entry: ${file}`);
  }
  const manifest = JSON.parse(zip.readAsText("manifest.json"));
  validateZoteroManifest(manifest);
  assert.equal(
    manifest.version,
    pkg.version,
    "XPI version differs from package.json",
  );
  assert.equal(manifest.applications.zotero.id, pkg.config.addonID);
  return manifest;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const manifest = validateXpi(
    process.argv[2] || ".scaffold/build/zotero-ai-butler.xpi",
  );
  console.log(
    `[package] XPI integrity and required Zotero installation metadata passed (${manifest.version}).`,
  );
}

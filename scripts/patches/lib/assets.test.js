#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  patchAssetFiles,
  findRequiredWebviewAsset,
} = require("./assets.js");

test("patchAssetFiles falls back to content scan when filename pattern misses", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create assets with unexpected names (simulating renamed chunks)
    fs.writeFileSync(path.join(assetsDir, "chunk-xyz123.js"), "MARKER_A content here", "utf8");
    fs.writeFileSync(path.join(assetsDir, "bundle-abc456.js"), "unrelated content", "utf8");
    fs.writeFileSync(path.join(assetsDir, "other-def789.js"), "MARKER_A again", "utf8");

    const patchFn = (source) => {
      if (!source.includes("MARKER_A")) {
        return source;
      }
      return source.replace("MARKER_A", "PATCHED");
    };

    const result = patchAssetFiles(
      tempRoot,
      /^expected-pattern-.*\.js$/,
      patchFn,
      "WARN: expected pattern not found",
    );

    // Should match 2 files via content scan
    assert.deepEqual(result, { matched: 2, changed: 2 });
    assert.equal(
      fs.readFileSync(path.join(assetsDir, "chunk-xyz123.js"), "utf8"),
      "PATCHED content here",
    );
    assert.equal(
      fs.readFileSync(path.join(assetsDir, "other-def789.js"), "utf8"),
      "PATCHED again",
    );
    assert.equal(
      fs.readFileSync(path.join(assetsDir, "bundle-abc456.js"), "utf8"),
      "unrelated content",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("patchAssetFiles skips content scan when filename pattern matches", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(path.join(assetsDir, "expected-pattern-1.js"), "content A", "utf8");
    fs.writeFileSync(path.join(assetsDir, "expected-pattern-2.js"), "content B", "utf8");

    const patchFn = (source) => source.toUpperCase();

    const result = patchAssetFiles(
      tempRoot,
      /^expected-pattern-.*\.js$/,
      patchFn,
      "WARN: pattern not found",
    );

    // Should match via filename pattern, not content scan
    assert.deepEqual(result, { matched: 2, changed: 2 });
    assert.equal(
      fs.readFileSync(path.join(assetsDir, "expected-pattern-1.js"), "utf8"),
      "CONTENT A",
    );
    assert.equal(
      fs.readFileSync(path.join(assetsDir, "expected-pattern-2.js"), "utf8"),
      "CONTENT B",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("patchAssetFiles logs warning when content scan finds nothing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);

  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(path.join(assetsDir, "chunk-1.js"), "no match here", "utf8");
    fs.writeFileSync(path.join(assetsDir, "chunk-2.js"), "no match either", "utf8");

    const patchFn = (source) => {
      // Never matches anything
      if (source.includes("NEVER_FOUND")) {
        return source.replace("NEVER_FOUND", "PATCHED");
      }
      return source;
    };

    const result = patchAssetFiles(
      tempRoot,
      /^missing-pattern-.*\.js$/,
      patchFn,
      "WARN: test pattern not found",
    );

    assert.deepEqual(result, { matched: 0, changed: 0 });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0], "WARN: test pattern not found");
  } finally {
    console.warn = originalWarn;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("findRequiredWebviewAsset falls back to content scan when filename pattern misses", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create assets with unexpected names
    fs.writeFileSync(path.join(assetsDir, "renamed-chunk-abc.js"), "some content UNIQUE_MARKER more", "utf8");
    fs.writeFileSync(path.join(assetsDir, "other-chunk.js"), "unrelated", "utf8");

    const found = findRequiredWebviewAsset(
      assetsDir,
      /^old-pattern-.*\.js$/,
      "UNIQUE_MARKER",
      "test asset",
    );

    assert.equal(found, "renamed-chunk-abc.js");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("findRequiredWebviewAsset prefers filename pattern match over content scan", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(path.join(assetsDir, "expected-1.js"), "content with MARKER", "utf8");
    fs.writeFileSync(path.join(assetsDir, "expected-2.js"), "content with MARKER", "utf8");
    fs.writeFileSync(path.join(assetsDir, "other.js"), "content with MARKER", "utf8");

    const found = findRequiredWebviewAsset(
      assetsDir,
      /^expected-.*\.js$/,
      "MARKER",
      "test asset",
    );

    // Should pick the first filename match, not scan all
    assert.equal(found, "expected-1.js");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("findRequiredWebviewAsset throws when content scan finds nothing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "assets-test-"));
  try {
    const assetsDir = path.join(tempRoot, "webview", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(path.join(assetsDir, "chunk-1.js"), "no marker here", "utf8");
    fs.writeFileSync(path.join(assetsDir, "chunk-2.js"), "no marker either", "utf8");

    assert.throws(
      () => {
        findRequiredWebviewAsset(
          assetsDir,
          /^missing-pattern-.*\.js$/,
          "MISSING_MARKER",
          "test asset",
        );
      },
      (err) => err.message.includes("Could not find test asset"),
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

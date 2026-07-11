"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findExportedAlias } = require("./minified-js.js");

// Content cache for content-scan fallback. Entries are validated against mtime
// and size before being served: patches write assets with plain fs.writeFileSync
// between scans, and a stale cached read would make a later content-scan patch
// "restore" the pre-patch bytes, silently reverting an earlier patch's edits to
// the same chunk.
const webviewAssetContentCache = new Map();

function readWebviewAssetCached(filePath) {
  const stat = fs.statSync(filePath);
  const versionKey = `${stat.mtimeMs}:${stat.size}`;
  const entry = webviewAssetContentCache.get(filePath);
  if (entry !== undefined && entry.versionKey === versionKey) {
    return entry.content;
  }
  const content = fs.readFileSync(filePath, "utf8");
  webviewAssetContentCache.set(filePath, { versionKey, content });
  return content;
}

function readDirectoryNames(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir);
}

function findMainBundle(extractedDir) {
  const buildDir = path.join(extractedDir, ".vite", "build");
  const mainBundle = readDirectoryNames(buildDir).find((name) =>
    /^main(?:-[^.]+)?\.js$/.test(name),
  );

  return mainBundle == null ? null : { buildDir, mainBundle };
}

function findIconAsset(extractedDir) {
  const assetsDir = path.join(extractedDir, "webview", "assets");
  return readDirectoryNames(assetsDir).find((name) => /^app-.*\.png$/.test(name)) ?? null;
}

function regexpTest(filenamePattern, name) {
  filenamePattern.lastIndex = 0;
  return filenamePattern.test(name);
}

function patchAssetFiles(extractedDir, filenamePattern, patchFn, missingWarnMessage) {
  const webviewAssetsDir = path.join(extractedDir, "webview", "assets");
  if (!fs.existsSync(webviewAssetsDir)) {
    console.warn(
      `WARN: Could not find webview assets directory in ${webviewAssetsDir} — skipping asset patch`,
    );
    return { matched: 0, changed: 0 };
  }

  let candidates = fs
    .readdirSync(webviewAssetsDir)
    .filter((name) => regexpTest(filenamePattern, name))
    .sort();
  let contentScan = false;

  if (candidates.length === 0) {
    contentScan = true;
    candidates = fs
      .readdirSync(webviewAssetsDir)
      .filter((name) => name.endsWith(".js"))
      .sort();
  }

  // Buffer writes until every candidate has been patched so a throw partway
  // through leaves no half-patched mix of assets on disk. During a content
  // scan the patch function runs over unrelated bundles, so its per-file
  // "could not find" warnings are meaningless — silence them and let the
  // single missing warning below speak when nothing matched at all.
  const originalWarn = console.warn;
  if (contentScan) {
    console.warn = () => {};
  }
  const pendingWrites = [];
  try {
    for (const candidate of candidates) {
      const filePath = path.join(webviewAssetsDir, candidate);
      const currentSource = contentScan
        ? readWebviewAssetCached(filePath)
        : fs.readFileSync(filePath, "utf8");
      const patchedSource = patchFn(currentSource);
      if (patchedSource !== currentSource) {
        pendingWrites.push({ filePath, patchedSource });
      }
    }
  } finally {
    console.warn = originalWarn;
  }
  for (const { filePath, patchedSource } of pendingWrites) {
    fs.writeFileSync(filePath, patchedSource, "utf8");
    webviewAssetContentCache.delete(filePath);
  }

  if (contentScan && pendingWrites.length === 0) {
    console.warn(missingWarnMessage);
    return { matched: 0, changed: 0 };
  }
  if (contentScan) {
    console.log(
      `Asset filename pattern missed; content scan patched ${pendingWrites.length} asset(s)`,
    );
    return { matched: pendingWrites.length, changed: pendingWrites.length };
  }

  return { matched: candidates.length, changed: pendingWrites.length };
}

function readWebviewAsset(webviewAssetsDir, assetName) {
  return fs.readFileSync(path.join(webviewAssetsDir, assetName), "utf8");
}

function findRequiredWebviewAsset(webviewAssetsDir, filenamePattern, marker, description) {
  if (!fs.existsSync(webviewAssetsDir)) {
    throw new Error(`Missing webview assets directory ${webviewAssetsDir}`);
  }

  const candidates = fs
    .readdirSync(webviewAssetsDir)
    .filter((name) => regexpTest(filenamePattern, name))
    .sort();
  let matches = marker == null
    ? candidates
    : candidates.filter((name) => readWebviewAsset(webviewAssetsDir, name).includes(marker));

  if (matches.length === 0 && marker != null) {
    // Chunk names drift across upstream releases; fall back to locating the
    // bundle by its content marker across every JS asset.
    matches = fs
      .readdirSync(webviewAssetsDir)
      .filter((name) => name.endsWith(".js"))
      .sort()
      .filter((name) =>
        readWebviewAssetCached(path.join(webviewAssetsDir, name)).includes(marker),
      );
  }

  if (matches.length === 0) {
    throw new Error(`Could not find ${description} in ${webviewAssetsDir}`);
  }

  return matches[0];
}

function findCodexRequestExportName(source) {
  let match = source.match(
    /async function\s+([A-Za-z_$][\w$]*)\(\.\.\.[^)]+\)\{let\[[^\]]+\]=[^;]+,\{params:[^}]+source:[^}]+\}=[^;]+;return\s+[A-Za-z_$][\w$]*\([^)]*\)\}/,
  );
  if (match != null) {
    return findExportedAlias(source, match[1]);
  }

  match = source.match(
    /function\s+([A-Za-z_$][\w$]*)\(\.\.\.[^)]+\)\{let\[[^\]]+\]=[^;]+,\{params:[^}]+select:[^}]+signal:[^}]+source:[^}]+\}=[^;]+;return\s+([A-Za-z_$][\w$]*)\([^)]*\)\}/,
  );
  if (match != null) {
    const [, wrapperName, rawRequestName] = match;
    const rawRequestPattern = new RegExp(
      `async function\\s+${rawRequestName}\\([^)]*\\)\\{[\\s\\S]{0,600}?vscode://codex/`,
    );
    if (rawRequestPattern.test(source)) {
      return findExportedAlias(source, wrapperName);
    }
  }

  return null;
}

function findCodexRequestWebviewAsset(webviewAssetsDir) {
  if (!fs.existsSync(webviewAssetsDir)) {
    throw new Error(`Missing webview assets directory ${webviewAssetsDir}`);
  }

  const settingStorageCandidates = fs
    .readdirSync(webviewAssetsDir)
    .filter((name) => regexpTest(/^setting-storage-.*\.js$/, name))
    .sort();
  const allRequestCandidates = fs
    .readdirSync(webviewAssetsDir)
    .filter((name) => regexpTest(/\.js$/, name))
    .sort()
    .filter((name) => !settingStorageCandidates.includes(name));
  const modernCandidates = [...settingStorageCandidates, ...allRequestCandidates];
  const matches = [];
  for (const candidate of modernCandidates) {
    const source = readWebviewAsset(webviewAssetsDir, candidate);
    if (!source.includes("vscode://codex/")) {
      continue;
    }
    const exportName = findCodexRequestExportName(source);
    if (exportName != null) {
      matches.push({ assetName: candidate, exportName });
    }
  }

  if (matches.length > 1) {
    throw new Error(
      `Found multiple Codex request API assets (${matches.map(({ assetName }) => assetName).join(", ")})`,
    );
  }

  if (matches.length === 1) {
    return matches[0];
  }

  throw new Error(`Could not find Codex request API asset in ${webviewAssetsDir}`);
}

function findImportedAsset(webviewAssetsDir, importerAsset, description) {
  const importedAsset = readWebviewAsset(webviewAssetsDir, importerAsset).match(/from"\.\/([^"]+)"/)?.[1];
  if (!importedAsset || !fs.existsSync(path.join(webviewAssetsDir, importedAsset))) {
    throw new Error(`Could not find ${description} imported by ${importerAsset}`);
  }
  return importedAsset;
}

module.exports = {
  findCodexRequestWebviewAsset,
  findIconAsset,
  findImportedAsset,
  findMainBundle,
  findRequiredWebviewAsset,
  patchAssetFiles,
  readDirectoryNames,
  readWebviewAsset,
};

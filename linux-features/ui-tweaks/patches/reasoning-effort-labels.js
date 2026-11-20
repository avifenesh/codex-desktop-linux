"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ZH_CN_LOCALE_MODULE = "../locales/zh-CN.json";
const ENGLISH_REASONING_LABELS = Object.freeze({
  "composer.mode.local.reasoning.none.label": "None",
  "composer.mode.local.reasoning.minimal.label": "Minimal",
  "composer.mode.local.reasoning.medium.label": "Medium",
  "composer.mode.local.reasoning.high.label": "High",
  "composer.mode.local.reasoning.xhigh.label": "XHigh",
  "composer.mode.local.reasoning.max.label": "Max",
  "composer.mode.local.reasoning.ultra.label": "Ultra",
});
const IDENT = "[A-Za-z_$][\\w$]*";

function warn(message) {
  console.warn(`WARN: ${message} - skipping ui-tweaks reasoning label patch`);
}

function reasoningLabelConfig(context) {
  const defaults = context?.feature?.manifest?.tweaks?.reasoning?.keepEffortLabelsEnglish;
  const settings = context?.feature?.settings?.tweaks?.reasoning?.keepEffortLabelsEnglish;
  return {
    ...(defaults != null && typeof defaults === "object" && !Array.isArray(defaults) ? defaults : {}),
    ...(settings != null && typeof settings === "object" && !Array.isArray(settings) ? settings : {}),
  };
}

function enabled(context) {
  return reasoningLabelConfig(context).enabled !== false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The rspack webview loads each locale through one lazy map entry such as
// "../locales/zh-CN.json":function(){return i.e(216360).then(i.t.bind(i,"wrpI",19))}.
// The locale file name is the only stable identity of the Simplified Chinese
// catalog; its chunk and module ids are captured from that entry, never assumed.
function zhCnLoaderPattern() {
  return new RegExp(
    `"${escapeRegExp(ZH_CN_LOCALE_MODULE)}":function\\(\\)\\{return (?<require>${IDENT})\\.e\\((?<chunk>\\d+)\\)` +
      `\\.then\\(\\k<require>\\.t\\.bind\\(\\k<require>,"(?<module>[^"\\\\]+)",\\d+\\)\\)\\}`,
    "g",
  );
}

// 26.1117 loads the catalog module itself, without the JSON interop flag:
// "../locales/zh-CN.json":function(){return i.e(547807).then(i.bind(i,"F4or"))}.
function zhCnModuleLoaderPattern() {
  return new RegExp(
    `"${escapeRegExp(ZH_CN_LOCALE_MODULE)}":function\\(\\)\\{return (?<require>${IDENT})\\.e\\((?<chunk>\\d+)\\)` +
      `\\.then\\(\\k<require>\\.bind\\(\\k<require>,"(?<module>[^"\\\\]+)"\\)\\)\\}`,
    "g",
  );
}

// That module fetches two gzip JSON arrays, the shared message keys and the
// zh-CN values in the same order, and zips them:
// F4or(e,a,o){...DecompressionStream("gzip")...let[e,c]=await Promise.all([t("assets/locales/keys.<k>.json.codex-gzip"),
// t("assets/locales/zh-CN.keys.<k>.<v>.json.codex-gzip")]);a.default=Object.fromEntries(e.map((e,a)=>[e,c[a]]))...}
function gzipCatalogModulePattern(moduleId) {
  return new RegExp(`[{,]${escapeRegExp(moduleId)}\\(${IDENT},${IDENT},${IDENT}\\)\\{`, "g");
}

function gzipCatalogFilesPattern() {
  return new RegExp(
    `let\\[(?<keysVar>${IDENT}),(?<valuesVar>${IDENT})\\]=await Promise\\.all\\(\\[(?<fetch>${IDENT})` +
      `\\("assets/locales/(?<keys>keys\\.(?<keysHash>[0-9a-f]+)\\.json\\.codex-gzip)"\\),` +
      `\\k<fetch>\\("assets/locales/(?<values>zh-CN\\.keys\\.(?<valuesKeysHash>[0-9a-f]+)\\.[0-9a-f]+\\.json\\.codex-gzip)"\\)\\]\\);` +
      `${IDENT}\\.default=Object\\.fromEntries\\(\\k<keysVar>\\.map\\(\\((?<key>${IDENT}),(?<index>${IDENT})\\)=>` +
      `\\[\\k<key>,\\k<valuesVar>\\[\\k<index>\\]\\]\\)\\)`,
    "g",
  );
}

function readGzipJsonArray(filePath) {
  const value = JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8"));
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Locale catalog ${path.basename(filePath)} is not an array of strings`);
  }
  return value;
}

function findGzipCatalog(assetsDir, assetName, source, moduleId) {
  const modules = [...source.matchAll(gzipCatalogModulePattern(moduleId))];
  const files = [...source.matchAll(gzipCatalogFilesPattern())];
  if (modules.length !== 1 || files.length !== 1 || !source.includes('DecompressionStream("gzip")')) {
    throw new Error(`Expected one Simplified Chinese locale catalog in ${assetName}, found ${Math.min(modules.length, files.length)}`);
  }
  const { keys: keysFile, keysHash, values: valuesFile, valuesKeysHash } = files[0].groups;
  if (keysHash !== valuesKeysHash) {
    throw new Error(`Simplified Chinese locale values ${valuesFile} do not belong to ${keysFile}`);
  }
  const keysAssetName = `locales/${keysFile}`;
  const valuesAssetName = `locales/${valuesFile}`;
  const keys = readGzipJsonArray(path.join(assetsDir, keysAssetName));
  const values = readGzipJsonArray(path.join(assetsDir, valuesAssetName));
  if (keys.length !== values.length || new Set(keys).size !== keys.length) {
    throw new Error(`Simplified Chinese locale catalog ${valuesAssetName} does not pair one value with each unique key`);
  }
  const messages = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  return { assetName: valuesAssetName, source: JSON.stringify(messages), catalog: { keysAssetName, keys } };
}

// The catalog module is `<id>(e){e.exports=JSON.parse('{...}')}`: messages are
// JSON members inside a single-quoted JavaScript string literal.
function localeCatalogPattern(moduleId) {
  return new RegExp(
    `[{,]${escapeRegExp(moduleId)}\\((?<module>${IDENT})\\)\\{\\k<module>\\.exports=JSON\\.parse\\('`,
    "g",
  );
}

function labelPattern(key) {
  return new RegExp(`"${escapeRegExp(key)}":"[^"\\\\']*"`, "g");
}

function applyEnglishReasoningLabels(source, context = {}) {
  try {
    if (typeof source !== "string") {
      warn("Asset source is not a string");
      return source;
    }
    if (!enabled(context)) {
      return source;
    }

    const missingKeys = [];
    const replacements = [];
    for (const [key, label] of Object.entries(ENGLISH_REASONING_LABELS)) {
      const matches = [...source.matchAll(labelPattern(key))];
      if (matches.length !== 1) {
        missingKeys.push(key);
        continue;
      }
      const replacement = `"${key}":"${label}"`;
      if (matches[0][0] !== replacement) {
        replacements.push([labelPattern(key), replacement]);
      }
    }

    if (missingKeys.length > 0) {
      if (context.warnOnMissingMarkers === true) {
        warn(`Could not find exactly one ${missingKeys.join(", ")}`);
      }
      return source;
    }
    let patched = source;
    for (const [pattern, replacement] of replacements) {
      patched = patched.replace(pattern, replacement);
    }
    return patched;
  } catch (error) {
    warn(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    return source;
  }
}

// Relative to webview/assets: entry chunks plus lazily loaded async chunks.
function listWebviewScriptAssets(extractedDir) {
  const assetsDir = path.join(extractedDir, "webview", "assets");
  return ["", "async"].flatMap((directory) => {
    const dir = path.join(assetsDir, directory);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => (directory === "" ? entry.name : `${directory}/${entry.name}`));
  }).sort();
}

function findZhCnLocaleAsset(extractedDir) {
  const assetsDir = path.join(extractedDir, "webview", "assets");
  const assetNames = listWebviewScriptAssets(extractedDir);
  const loaders = [];
  for (const assetName of assetNames) {
    const source = fs.readFileSync(path.join(assetsDir, assetName), "utf8");
    if (source.includes(`"${ZH_CN_LOCALE_MODULE}":`)) {
      loaders.push(...source.matchAll(zhCnLoaderPattern()), ...source.matchAll(zhCnModuleLoaderPattern()));
    }
  }
  if (loaders.length !== 1) {
    throw new Error(`Expected one Simplified Chinese locale loader, found ${loaders.length}`);
  }
  const { chunk, module: moduleId } = loaders[0].groups;
  const gzipCatalog = !loaders[0][0].includes(".t.bind(");
  const chunkPattern = new RegExp(`^async/${chunk}\\.[0-9a-f]+\\.js$`);
  const chunkAssets = assetNames.filter((assetName) => chunkPattern.test(assetName));
  if (chunkAssets.length !== 1) {
    throw new Error(`Expected one Simplified Chinese locale chunk ${chunk}, found ${chunkAssets.length}`);
  }
  const assetName = chunkAssets[0];
  const source = fs.readFileSync(path.join(assetsDir, assetName), "utf8");
  if (!source.startsWith(`export const __rspack_esm_id=${chunk};`) &&
      !source.startsWith(`export const __rspack_esm_ids=[${chunk}];`)) {
    throw new Error(`Simplified Chinese locale chunk ${assetName} does not declare rspack chunk ${chunk}`);
  }
  if (gzipCatalog) return findGzipCatalog(assetsDir, assetName, source, moduleId);
  const catalogs = [...source.matchAll(localeCatalogPattern(moduleId))];
  if (catalogs.length !== 1) {
    throw new Error(`Expected one Simplified Chinese locale catalog in ${assetName}, found ${catalogs.length}`);
  }
  return { assetName, source };
}

function applyEnglishReasoningLabelsToApp(extractedDir, context = {}) {
  if (!enabled(context)) return { matched: 0, changed: 0 };
  let locale;
  try {
    locale = findZhCnLocaleAsset(extractedDir);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(reason);
    return { matched: 0, changed: 0, reason };
  }
  const patched = applyEnglishReasoningLabels(locale.source, { ...context, warnOnMissingMarkers: true });
  const changed = patched !== locale.source;
  if (changed && locale.catalog) {
    const messages = JSON.parse(patched);
    const values = locale.catalog.keys.map((key) => messages[key]);
    fs.writeFileSync(path.join(extractedDir, "webview", "assets", locale.assetName), zlib.gzipSync(JSON.stringify(values)));
  } else if (changed) {
    fs.writeFileSync(path.join(extractedDir, "webview", "assets", locale.assetName), patched);
  }
  return { matched: 1, changed: Number(changed), targets: [path.join("webview", "assets", locale.assetName)] };
}

const descriptors = [
  {
    id: "reasoning-effort-labels-english",
    phase: "extracted-app:post-webview",
    order: 20_797,
    ciPolicy: "optional",
    enabled,
    apply: applyEnglishReasoningLabelsToApp,
  },
];

module.exports = {
  ENGLISH_REASONING_LABELS,
  ZH_CN_LOCALE_MODULE,
  applyEnglishReasoningLabels,
  applyEnglishReasoningLabelsToApp,
  descriptors,
  findZhCnLocaleAsset,
};

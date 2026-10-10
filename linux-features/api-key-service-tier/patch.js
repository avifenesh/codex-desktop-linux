"use strict";

const JS_IDENT = "[A-Za-z_$][\\w$]*";
const PATCH_MARKER = "codexLinuxApiKeyFastTier";
const MODEL_MARKER = "codexLinuxApiKeyServiceTierModel";
const ACCESS_PREFIX = String.raw`(?<isChat>${JS_IDENT})=(?<host>${JS_IDENT})\?\.authMethod===\x60chatgpt\x60\|\|\k<host>\?\.authMethod===\x60personalAccessToken\x60,(?<auth>${JS_IDENT})=\k<host>\?\.authMethod\?\?null(?<middle>[\s\S]{0,700}?)`;
const ACCESS_MEMO = String.raw`(?<cache>${JS_IDENT})\[3\]!==(?<data>${JS_IDENT})\|\|\k<cache>\[4\]!==(?<loading>${JS_IDENT})\|\|\k<cache>\[5\]!==`;
const ACCESS_SUFFIX = String.raw`,\k<cache>\[3\]=\k<data>,\k<cache>\[4\]=\k<loading>,\k<cache>\[5\]=`;
const CURRENT_SERVICE_TIER_GATE = new RegExp(
  ACCESS_PREFIX + ACCESS_MEMO + String.raw`\k<isChat>\?\((?<value>${JS_IDENT})=\k<isChat>&&!\k<loading>&&\k<data>!=null\?(?<policy>${JS_IDENT})\(\k<data>\):null` +
    ACCESS_SUFFIX + String.raw`\k<isChat>,\k<cache>\[6\]=\k<value>\)(?=[\s\S]{0,250}serviceTierAccess:)`, "g",
);
const PATCHED_SERVICE_TIER_GATE = new RegExp(
  ACCESS_PREFIX + ACCESS_MEMO + String.raw`\k<auth>\?\((?<value>${JS_IDENT})=!\k<loading>\?\(\k<isChat>&&\k<data>!=null\?(?<policy>${JS_IDENT})\(\k<data>\):\k<auth>===\x60apikey\x60\?\{fast:!0,ultrafast:!1\}:null\):null` +
    ACCESS_SUFFIX + String.raw`\k<auth>,\k<cache>\[6\]=\k<value>\)(?=[\s\S]{0,250}serviceTierAccess:)`, "g",
);
const PATCHED_MODEL_MARKER = new RegExp(`${MODEL_MARKER}:${JS_IDENT}===\\\`apikey\\\``);
const PATCHED_SERVICE_TIER_RESOLVER = new RegExp(
  `function ${JS_IDENT}\\((${JS_IDENT}),(${JS_IDENT})\\)\\{return \\2==null\\?null:` +
    `\\2===\\\`fast\\\`\\?${JS_IDENT}\\(\\1\\)\\?\\?${PATCH_MARKER}\\(\\1\\):` +
    `\\1\\?\\.serviceTiers\\?\\.find\\((${JS_IDENT})=>\\3\\.id===\\2\\)\\?\\?null\\}`,
);
const MODEL_LIST_MAPPING_SHAPE = new RegExp(
  `function ${JS_IDENT}\\(\\{additionalAvailableModels:${JS_IDENT},(?:apiKeyDaybreakSupported:${JS_IDENT}=!1,)?authMethod:${JS_IDENT},availableModels:${JS_IDENT},` +
    `defaultModel:${JS_IDENT},enabledReasoningEfforts:${JS_IDENT},` +
    `hasConfiguredModelCatalog:${JS_IDENT},` +
    `includeUltraReasoningEffort:${JS_IDENT},isCustomModelProvider:${JS_IDENT}=!1,` +
    `models:${JS_IDENT},useHiddenModels:${JS_IDENT}\\}\\)` +
    `\\{[\\s\\S]{0,3000}?supportedReasoningEfforts[\\s\\S]{0,1200}?hasModelSupportingUltraReasoningEffort`,
);

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

function applyApiKeyServiceTierGatePatch(source) {
  const current = [...source.matchAll(CURRENT_SERVICE_TIER_GATE)];
  const patched = [...source.matchAll(PATCHED_SERVICE_TIER_GATE)];
  if (current.length === 0 && patched.length === 1) return source;
  if (current.length !== 1 || patched.length !== 0) {
    if (source.includes("serviceTierAccess:")) warn("Could not find unique service tier access gate", "API key service tier gate patch");
    return source;
  }
  const match = current[0];
  const { isChat, host, auth, middle, cache, data, loading, value, policy } = match.groups;
  // Auth method replaces the derived boolean as the memo key. API-key and
  // other non-ChatGPT hosts otherwise share false and reuse stale access.
  const replacement = `${isChat}=${host}?.authMethod===\`chatgpt\`||${host}?.authMethod===\`personalAccessToken\`,${auth}=${host}?.authMethod??null${middle}` +
    `${cache}[3]!==${data}||${cache}[4]!==${loading}||${cache}[5]!==${auth}?(${value}=!${loading}?(${isChat}&&${data}!=null?${policy}(${data}):${auth}===\`apikey\`?{fast:!0,ultrafast:!1}:null):null,` +
    `${cache}[3]=${data},${cache}[4]=${loading},${cache}[5]=${auth},${cache}[6]=${value})`;
  return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
}

function hasApiKeyServiceTierGateShape(source) {
  return [...source.matchAll(CURRENT_SERVICE_TIER_GATE)].length > 0;
}

function applyApiKeyModelMarkerPatch(source) {
  if (PATCHED_MODEL_MARKER.test(source)) {
    return source;
  }

  const modelListPattern = new RegExp(
    `(function ${JS_IDENT}\\(\\{additionalAvailableModels:${JS_IDENT},(?:apiKeyDaybreakSupported:${JS_IDENT}=!1,)?authMethod:(${JS_IDENT}),availableModels:${JS_IDENT},` +
      `defaultModel:${JS_IDENT},enabledReasoningEfforts:${JS_IDENT},` +
      `hasConfiguredModelCatalog:${JS_IDENT},` +
      `includeUltraReasoningEffort:${JS_IDENT},isCustomModelProvider:${JS_IDENT}=!1,` +
      `models:${JS_IDENT},useHiddenModels:${JS_IDENT}\\}\\)` +
      `\\{[\\s\\S]{0,1800}?[,;]${JS_IDENT}=\\{\\.\\.\\.${JS_IDENT},supportedReasoningEfforts:${JS_IDENT})(\\})`,
    "g",
  );

  const patched = source.replace(
    modelListPattern,
    (_match, prefix, authMethodVar, suffix) => `${prefix},${MODEL_MARKER}:${authMethodVar}===\`apikey\`${suffix}`,
  );

  if (patched !== source) {
    return patched;
  }

  if (hasApiKeyModelListMappingShape(source)) {
    warn("Could not find model list mapping", "API key model service tier marker patch");
  }
  return source;
}

function hasApiKeyModelListMappingShape(source) {
  return MODEL_LIST_MAPPING_SHAPE.test(source);
}

function matchesApiKeyServiceTierGateContract(source) {
  return [...source.matchAll(PATCHED_SERVICE_TIER_GATE)].length > 0 || hasApiKeyServiceTierGateShape(source);
}

function matchesApiKeyServiceTierModelContract(source) {
  return PATCHED_MODEL_MARKER.test(source) || hasApiKeyModelListMappingShape(source);
}

function currentServiceTierResolverPattern(flags = "") {
  return new RegExp(
    `function (${JS_IDENT})\\((${JS_IDENT}),(${JS_IDENT})\\)\\{return \\3==null\\?null:` +
      `\\3===\\\`fast\\\`\\?(${JS_IDENT})\\(\\2\\):` +
      `\\2\\?\\.serviceTiers\\?\\.find\\((${JS_IDENT})=>\\5\\.id===\\3\\)\\?\\?null\\}`,
    flags,
  );
}

function fallbackFastTierHelper() {
  return `function ${PATCH_MARKER}(e){return e==null||e?.serviceTiers?.length||e?.${MODEL_MARKER}!==!0?null:{id:\`fast\`,name:\`Fast\`,description:\`1.5x speed, increased usage\`}}`;
}

function serviceTierResolverState(source) {
  const current = [...source.matchAll(currentServiceTierResolverPattern("g"))];
  const patched = [...source.matchAll(new RegExp(PATCHED_SERVICE_TIER_RESOLVER.source, "g"))];
  const helper = fallbackFastTierHelper();
  const helperCount = source.split(helper).length - 1;

  if (current.length === 1 && patched.length === 0 && helperCount === 0 &&
      !source.includes(PATCH_MARKER)) {
    return { kind: "current", match: current[0] };
  }
  if (current.length === 0 && patched.length === 1 && helperCount === 1) {
    return { kind: "patched", match: patched[0] };
  }
  return { kind: "invalid" };
}

function matchesApiKeyServiceTierResolverContract(source) {
  const state = serviceTierResolverState(source);
  return state.kind === "current" || state.kind === "patched";
}

function applyApiKeyServiceTierResolverPatch(source) {
  const state = serviceTierResolverState(source);
  if (state.kind === "patched") {
    return source;
  }
  if (state.kind !== "current") {
    return source;
  }
  const [, _resolverVar, modelVar, tierVar, findFastVar] = state.match;
  const replacement = state.match[0].replace(
    `${tierVar}===\`fast\`?${findFastVar}(${modelVar})`,
    `${tierVar}===\`fast\`?${findFastVar}(${modelVar})??${PATCH_MARKER}(${modelVar})`,
  );
  const patchedResolver = source.slice(0, state.match.index) + replacement +
    source.slice(state.match.index + state.match[0].length);
  const patched = fallbackFastTierHelper() + patchedResolver;

  return serviceTierResolverState(patched).kind === "patched" ? patched : source;
}

function fallbackOptionCallbackPattern() {
  const concise =
    `\\(\\{(?=[^{}]{0,800}description:)(?=[^{}]{0,800}iconKind:)` +
    `(?=[^{}]{0,800}label:)(?=[^{}]{0,800}tier:\\2,value:\\2\\.id)[^{}]{1,800}\\}\\)`;
  const block =
    `\\{[^{}]{0,800}?return\\{(?=[^{}]{0,800}description:)(?=[^{}]{0,800}iconKind:)` +
    `(?=[^{}]{0,800}label:)(?=[^{}]{0,800}tier:\\2,value:\\2\\.id)[^{}]{1,800}\\}\\}`;
  return `(${JS_IDENT})=>(?:${concise}|${block})`;
}

function currentSharedFallbackOptionsPattern(flags = "") {
  return new RegExp(
    `function ${JS_IDENT}\\((${JS_IDENT}),(${JS_IDENT})\\)\\{return\\[[^\\]]{0,800}?` +
      `\\.\\.\\.\\(\\2\\?\\?\\[\\]\\)\\.map\\((${JS_IDENT})=>` +
      fallbackOptionCallbackPattern().replace(`(${JS_IDENT})=>`, "") + `\\)\\]\\}`,
    flags,
  );
}

function patchedSharedFallbackOptionsPattern(flags = "") {
  return new RegExp(
    `function ${JS_IDENT}\\((${JS_IDENT}),(${JS_IDENT})\\)\\{return\\[[^\\]]{0,800}?` +
      `\\.\\.\\.\\(\\(\\2\\?\\.length\\?\\2:\\[${PATCH_MARKER}\\(\\1\\)\\]\\)\\.filter\\(Boolean\\)\\)\\.map\\(` +
      fallbackOptionCallbackPattern() + `\\)\\]\\}`,
    flags,
  );
}

function fallbackOptionMatches(source, pattern) {
  return [...source.matchAll(pattern)];
}

function fallbackFastTierState(source) {
  const current = fallbackOptionMatches(source, currentSharedFallbackOptionsPattern("g"))
    .map((match) => ({ match, modelVar: match[1], tiersVar: match[2] }));
  const patched = fallbackOptionMatches(source, patchedSharedFallbackOptionsPattern("g"))
    .map((match) => ({ match }));
  const helper = fallbackFastTierHelper();
  const helperCount = source.split(helper).length - 1;

  if (current.length === 1 && patched.length === 0 && helperCount <= 1 &&
      (!source.includes(`function ${PATCH_MARKER}(`) || helperCount === 1)) {
    return { kind: "current", ...current[0], helperCount };
  }
  if (current.length === 0 && patched.length === 1 && helperCount === 1) {
    return { kind: "patched", ...patched[0], helperCount };
  }
  return null;
}

function matchesFallbackFastTierContract(source) {
  return fallbackFastTierState(source) != null;
}

function hasCompleteFallbackFastTierPatch(source) {
  return fallbackFastTierState(source)?.kind === "patched";
}

function applyFallbackFastTierPatch(source) {
  const state = fallbackFastTierState(source);
  if (state?.kind === "patched") {
    return source;
  }
  if (state?.kind !== "current") {
    if (source.includes("serviceTiers")) {
      warn("Could not find service tier option helpers", "API key fallback fast tier patch");
    }
    return source;
  }
  const modelVar = state.modelVar;
  const replacement = state.match[0].replace(
    `...(${state.tiersVar}??[])`,
    `...((${state.tiersVar}?.length?${state.tiersVar}:[${PATCH_MARKER}(${modelVar})]).filter(Boolean))`,
  );
  let patched = source.slice(0, state.match.index) + replacement +
    source.slice(state.match.index + state.match[0].length);
  if (state.helperCount === 0) patched = fallbackFastTierHelper() + patched;

  if (hasCompleteFallbackFastTierPatch(patched)) {
    return patched;
  }

  if (patched !== source || source.includes(PATCH_MARKER)) {
    warn("Could not apply all current service tier option helpers", "API key fallback fast tier patch");
    return source;
  }

  if (source.includes("serviceTiers")) {
    warn("Could not find service tier option helpers", "API key fallback fast tier patch");
  }
  return source;
}

function applyApiKeyServiceTierPatch(source) {
  return applyFallbackFastTierPatch(
    applyApiKeyServiceTierResolverPatch(
      applyApiKeyModelMarkerPatch(applyApiKeyServiceTierGatePatch(source)),
    ),
  );
}

function applyCurrentGatePatch(source) {
  const current = [...source.matchAll(CURRENT_SERVICE_TIER_GATE)];
  const patched = [...source.matchAll(PATCHED_SERVICE_TIER_GATE)];
  if (current.length === 1 && patched.length === 0) return applyApiKeyServiceTierGatePatch(source);
  if (current.length === 0 && patched.length === 1) return source;
  warn("Could not identify current service tier auth gate", "API key service tier gate patch");
  return source;
}

function applyCurrentModelPatch(source) {
  const modelAlreadyPatched = PATCHED_MODEL_MARKER.test(source);
  const modelCandidate = modelAlreadyPatched ? source : applyApiKeyModelMarkerPatch(source);
  const modelReady = modelAlreadyPatched || modelCandidate !== source;

  if (!modelReady && !hasApiKeyModelListMappingShape(source)) {
    warn("Could not identify current model list mapping", "API key model service tier marker patch");
  }
  return modelCandidate;
}

function applyCurrentResolverPatch(source) {
  const resolverState = serviceTierResolverState(source);
  const resolverCandidate = resolverState.kind === "patched"
    ? source
    : applyApiKeyServiceTierResolverPatch(source);
  const resolverReady = resolverState.kind === "patched" || resolverCandidate !== source;

  if (!resolverReady) {
    warn("Could not identify current service tier resolver", "API key service tier resolver patch");
  }
  return resolverCandidate;
}

function applyCurrentFallbackFastTierPatch(source) {
  if (
    !source.includes(PATCH_MARKER) &&
    !source.includes("serviceTiers")
  ) {
    warn("Could not identify current service tier option helpers", "API key fallback fast tier patch");
  }
  return applyFallbackFastTierPatch(source);
}

const descriptors = [
  {
    id: "api-key-service-tier-gate",
    phase: "webview-asset",
    order: 20600,
    ciPolicy: "optional",
    pattern: /^app-initial-[^.]+\.js$/,
    assetMatch: matchesApiKeyServiceTierGateContract,
    missingDescription: "current API key service tier gate bundle",
    skipDescription: "API key service tier gate patch",
    apply: applyCurrentGatePatch,
  },
  {
    id: "api-key-service-tier-model",
    phase: "webview-asset",
    order: 20605,
    ciPolicy: "optional",
    pattern: /^app-initial-[^.]+\.js$/,
    assetMatch: matchesApiKeyServiceTierModelContract,
    missingDescription: "current API key service tier model bundle",
    skipDescription: "API key model service tier marker patch",
    apply: applyCurrentModelPatch,
  },
  {
    id: "api-key-service-tier-resolver",
    phase: "webview-asset",
    order: 20608,
    ciPolicy: "optional",
    pattern: /^app-shared-[^.]+\.js$/,
    assetMatch: matchesApiKeyServiceTierResolverContract,
    missingDescription: "current API key service tier resolver bundle",
    skipDescription: "API key service tier resolver patch",
    apply: applyCurrentResolverPatch,
  },
  {
    id: "api-key-service-tier-fallback",
    phase: "webview-asset",
    order: 20610,
    ciPolicy: "optional",
    pattern: /^app-shared-[^.]+\.js$/,
    assetMatch: matchesFallbackFastTierContract,
    missingDescription: "current API key service tier fallback bundle",
    skipDescription: "API key fallback fast tier patch",
    apply: applyCurrentFallbackFastTierPatch,
  },
];

module.exports = {
  applyApiKeyModelMarkerPatch,
  applyApiKeyServiceTierGatePatch,
  applyApiKeyServiceTierResolverPatch,
  applyFallbackFastTierPatch,
  applyApiKeyServiceTierPatch,
  applyCurrentGatePatch,
  applyCurrentModelPatch,
  applyCurrentResolverPatch,
  applyCurrentFallbackFastTierPatch,
  hasApiKeyServiceTierGateShape,
  hasApiKeyModelListMappingShape,
  matchesApiKeyServiceTierGateContract,
  matchesApiKeyServiceTierModelContract,
  matchesApiKeyServiceTierResolverContract,
  matchesFallbackFastTierContract,
  descriptors,
};

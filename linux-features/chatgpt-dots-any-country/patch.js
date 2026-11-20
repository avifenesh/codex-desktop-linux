"use strict";

const IDENT = "[A-Za-z_$][\\w$]*";
const CONTRACTS = Object.freeze({
  landingRoute: [{
    pattern: new RegExp(`${IDENT}\\?\\.tbo_config\\?\\.tbo_available==null`, "gu"),
    replacement: "!1",
    expected: 1,
  }],
  appShared: [{
    pattern: new RegExp(
      `${IDENT}\\.query\\.getData\\(${IDENT}(?:\\.${IDENT})?,(?<account>${IDENT})\\)\\?\\.accounts\\[\\k<account>\\]` +
        `\\?\\.account\\.tbo_config\\?\\.tbo_available!==!0`,
      "gu",
    ),
    replacement: "!1",
    expected: 1,
  }, {
    pattern: new RegExp(
      `${IDENT}\\?\\.accounts\\[(?<account>${IDENT})\\]\\?\\.account\\.tbo_config` +
        `\\?\\.tbo_available===!0`,
      "gu",
    ),
    replacement: "!0",
    expected: 2,
  }],
  // Newer signed packages bind the capability once from the account entry and
  // gate the access-policy result separately; the snapshot check is unchanged.
  appSharedCurrent: [{
    pattern: new RegExp(
      `${IDENT}\\.query\\.getData\\(${IDENT}(?:\\.${IDENT})?,(?<account>${IDENT})\\)\\?\\.accounts\\[\\k<account>\\]` +
        `\\?\\.account\\.tbo_config\\?\\.tbo_available!==!0`,
      "gu",
    ),
    replacement: "!1",
    expected: 1,
  }, {
    pattern: new RegExp(
      `(?<=(?<entry>${IDENT})=${IDENT}\\.data\\?\\.accounts\\[${IDENT}\\],${IDENT}=)\\k<entry>` +
        `\\?\\.account\\.tbo_config\\?\\.tbo_available(?=,)`,
      "gu",
    ),
    replacement: "!0",
    expected: 1,
  }, {
    pattern: new RegExp(
      `(?<=\\?"success"===${IDENT}&&)${IDENT}\\.account\\.tbo_config\\?\\.tbo_available===!0(?=:null\\})`,
      "gu",
    ),
    replacement: "!0",
    expected: 1,
  }],
  personalization: [{
    pattern: new RegExp(
      `${IDENT}\\?\\.accounts\\[${IDENT}\\]\\?\\.account\\.tbo_config\\?\\.tbo_available!==!0`,
      "gu",
    ),
    replacement: "!1",
    expected: 2,
  }],
  // Newer signed packages keep one page check and move the second one into the
  // user rules atom below.
  personalizationCurrent: [{
    pattern: new RegExp(
      `${IDENT}\\?\\.accounts\\[${IDENT}\\]\\?\\.account\\.tbo_config\\?\\.tbo_available!==!0(?=\\)return ${IDENT};)`,
      "gu",
    ),
    replacement: "!1",
    expected: 1,
  }],
  // User rules atom; rspack copies its module into more than one chunk.
  userRules: [{
    pattern: new RegExp(
      `(?<head>let\\{data:(?<data>${IDENT})\\}=${IDENT}\\(${IDENT}\\.${IDENT},(?<account>${IDENT})\\);return )` +
        `\\k<data>\\?\\.accounts\\[\\k<account>\\]\\?\\.account\\.tbo_config\\?\\.tbo_available===!0` +
        `(?<tail>&&null!=${IDENT}\\(${IDENT}\\.${IDENT}\\)\\?\\{accountId:\\k<account>,userId:${IDENT}\\}:null\\})`,
      "gu",
    ),
    replacement: "$<head>!0$<tail>",
    expected: 1,
  }],
});
const SHAPES = Object.freeze({
  appShared: [CONTRACTS.appShared, CONTRACTS.appSharedCurrent],
  personalization: [CONTRACTS.personalization, CONTRACTS.personalizationCurrent],
});

function contractState(source, replacements) {
  const matches = replacements.map((contract) => [
    ...source.matchAll(new RegExp(contract.pattern.source, contract.pattern.flags)),
  ]);
  if (matches.every((found) => found.length === 0)) return "patched";
  return matches.every((found, index) => found.length === replacements[index].expected)
    ? "pristine"
    : "invalid";
}

// Returns the one pristine shape, "patched" when no shape has any match left,
// or null when the chunk does not prove exactly one shape.
function shapeState(source, shapes) {
  const states = shapes.map((replacements) => contractState(source, replacements));
  const pristine = shapes.filter((_shape, index) => states[index] === "pristine");
  if (pristine.length === 1) return pristine[0];
  return pristine.length === 0 && states.every((state) => state === "patched") ? "patched" : null;
}

function applyContract(source, shapes, description) {
  const state = shapeState(source, Array.isArray(shapes[0]) ? shapes : [shapes]);
  if (state === "patched") return source;
  if (state == null) {
    console.warn(`WARN: Could not prove the current ChatGPT Dots ${description} contract — skipping Dots patch`);
    return source;
  }
  return state.reduce(
    (patched, contract) => patched.replace(contract.pattern, contract.replacement),
    source,
  );
}

function applyDotsLandingRoutePatch(source) {
  return applyContract(source, CONTRACTS.landingRoute, "landing route");
}

function applyDotsAppSharedPatch(source) {
  return applyContract(source, SHAPES.appShared, "capability");
}

function applyDotsPersonalizationPatch(source) {
  return applyContract(source, SHAPES.personalization, "personalization");
}

function applyDotsUserRulesPatch(source) {
  return applyContract(source, CONTRACTS.userRules, "user rules");
}

function matchesContract(source, contracts) {
  return contractState(source, contracts) === "pristine";
}

function matchesShape(source, shapes) {
  return Array.isArray(shapeState(source, shapes));
}

const descriptors = [
  {
    id: "dots-landing-route",
    phase: "webview-asset",
    order: 20_900,
    ciPolicy: "optional",
    assetNeedles: ["tbo_available==null"],
    assetMatch: (source) => matchesContract(source, CONTRACTS.landingRoute),
    missingDescription: "ChatGPT Dots landing route bundle",
    skipDescription: "ChatGPT Dots landing route patch",
    apply: applyDotsLandingRoutePatch,
  },
  {
    id: "dots-app-shared-capability",
    phase: "webview-asset",
    order: 20_901,
    ciPolicy: "optional",
    assetNeedles: ["tbo_available===!0", "tbo_available!==!0", ".query.getData("],
    assetMatch: (source) => matchesShape(source, SHAPES.appShared),
    missingDescription: "ChatGPT Dots capability bundle",
    skipDescription: "ChatGPT Dots capability patch",
    apply: applyDotsAppSharedPatch,
  },
  {
    id: "dots-personalization-capability",
    phase: "webview-asset",
    order: 20_902,
    ciPolicy: "optional",
    assetNeedles: ["tbo_available!==!0"],
    assetMatch: (source) => matchesShape(source, SHAPES.personalization),
    missingDescription: "ChatGPT Dots personalization bundle",
    skipDescription: "ChatGPT Dots personalization patch",
    apply: applyDotsPersonalizationPatch,
  },
  {
    id: "dots-user-rules-capability",
    phase: "webview-asset",
    order: 20_903,
    ciPolicy: "optional",
    // No assetMatch: every chunk that carries a copy of the atom is patched.
    assetNeedles: ["tbo_available===!0&&null!=", "?{accountId:"],
    missingWarning: "WARN: Could not find ChatGPT Dots user rules bundle — skipping ChatGPT Dots user rules patch",
    apply: applyDotsUserRulesPatch,
  },
];

module.exports = {
  CONTRACTS,
  applyDotsAppSharedPatch,
  applyDotsLandingRoutePatch,
  applyDotsPersonalizationPatch,
  applyDotsUserRulesPatch,
  descriptors,
};

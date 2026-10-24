"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findMatchingBrace, escapeRegExp } = require("../../scripts/patches/lib/minified-js.js");
const { STORAGE_KEY } = require("./runtime.js");
const translations = require("./translations.json");

const ID = "[A-Za-z_$][\\w$]*";
const UI = "codexLinuxReasoningVisibilitySetting";
const MESSAGE_IDS = ["label", "description", "saveError"].map((suffix) => `settings.general.reasoningVisibility.${suffix}`);
const unique = (source, pattern) => {
  const matches = [...source.matchAll(pattern)];
  return matches.length === 1 ? matches[0] : null;
};

// Reuse the native General row, switch, locale hook and React factory. All
// aliases are captured from the current menu-bar setting, never chunk hashes.
function settingsContract(source) {
  const owner = unique(source, new RegExp(`function (${ID})\\((${ID})\\)\\{.{0,300}?\\{platform:(${ID})\\}=(${ID})\\(\\),(${ID})=(${ID})\\((${ID})\\.macMenuBarEnabled\\);if\\(\\3!==\`macOS\`\\)return null;`, "g"));
  if (!owner) return null;
  const end = findMatchingBrace(source, source.indexOf("{", owner.index));
  const body = source.slice(owner.index, end + 1);
  const row = unique(body, new RegExp(`\\(0,(${ID})\\.jsx\\)\\((${ID}),\\{label:${ID},description:${ID},control:${ID}\\}`, "g"));
  const toggle = unique(body, new RegExp(`\\(0,${ID}\\.jsx\\)\\((${ID}),\\{checked:${ID},onChange:${ID},ariaLabel:${ID}\\}`, "g"));
  const reactUse = source.match(new RegExp(`\\(0,(${ID})\\.useState\\)\\(`));
  const react = reactUse && source.match(new RegExp(`${escapeRegExp(reactUse[1])}=(${ID})\\(\\)`));
  const render = unique(source, new RegExp(`\\(0,(${ID})\\.jsx\\)\\(${escapeRegExp(owner[1])},\\{appName:${ID}\\}\\)`, "g"));
  const intlUse = unique(body, new RegExp(`(${ID})\\.formatMessage\\(\\{id:\`settings\\.general\\.macMenuBar\\.ariaLabel\``, "g"));
  const intl = intlUse && unique(body, new RegExp(`\\b${escapeRegExp(intlUse[1])}=(${ID})\\(\\)`, "g"));
  if (!row || !toggle || !react || !render || !intl || row[1] !== render[1]) return null;
  return { row: row[2], toggle: toggle[1], reactFactory: react[1], platformHook: owner[4], jsx: row[1], intlHook: intl[1], render };
}

function settingComponent({ row, toggle, reactFactory, platformHook, jsx, intlHook }) {
  const key = JSON.stringify(STORAGE_KEY);
  const message = (index) => `intl.formatMessage({id:${JSON.stringify(MESSAGE_IDS[index])},defaultMessage:${JSON.stringify(translations.en[index])}})`;
  return `function ${UI}(){let React=${reactFactory}(),{platform}=${platformHook}(),[enabled,setEnabled]=React.useState(()=>{try{return localStorage.getItem(${key})===\`1\`}catch{return!1}}),[error,setError]=React.useState(null),intl=${intlHook}(),label=${message(0)},description=${message(1)};React.useEffect(()=>{let update=e=>{if(e.key===${key}||e.key===null){try{setEnabled(localStorage.getItem(${key})===\`1\`)}catch{}}};window.addEventListener(\`storage\`,update);return()=>window.removeEventListener(\`storage\`,update)},[]);if(platform!==\`linux\`)return null;let change=value=>{try{localStorage.setItem(${key},value===!0?\`1\`:\`0\`);setEnabled(value===!0);setError(null)}catch{setError(${message(2)})}};return(0,${jsx}.jsx)(${row},{label,description:error??description,control:(0,${jsx}.jsx)(${toggle},{checked:enabled,onChange:change,ariaLabel:label})})}`;
}

function catalogPatches(assetsDir) {
  const patches = [];
  let catalogCount = 0;
  for (const name of fs.readdirSync(assetsDir).sort()) {
    const locale = name.match(/^([a-z]{2}(?:-(?:[A-Za-z]{2,4}|\d{3}))?)-[\w-]+\.js$/)?.[1];
    if (!locale) continue;
    const target = path.join(assetsDir, name);
    const source = fs.readFileSync(target, "utf8");
    if (!source.includes('"settings.general.macMenuBar.label"')) continue;
    catalogCount += 1;
    const messages = translations[locale];
    if (!Array.isArray(messages) || messages.length !== MESSAGE_IDS.length ||
        messages.some((text) => typeof text !== "string" || !text.trim())) {
      throw Error(`reasoning-visibility: missing translations for ${locale}`);
    }
    const exports = unique(source, /export\{([^}]+)\}/g);
    const alias = exports && unique(exports[1], new RegExp(`(?:^|,)(${ID}) as default(?=,|$)`, "g"))?.[1];
    const dictionary = alias && unique(source, new RegExp(`\\b${escapeRegExp(alias)}=\\{`, "g"));
    const open = dictionary && dictionary.index + dictionary[0].length - 1;
    const end = open != null ? findMatchingBrace(source, open) : -1;
    if (end == null || end < 0 || !source.slice(open, end + 1).includes('"settings.general.macMenuBar.label"')) {
      throw Error(`reasoning-visibility: ${locale} translation catalog missing or ambiguous`);
    }
    const entries = MESSAGE_IDS.map((id, index) => `${JSON.stringify(id)}:${JSON.stringify(messages[index])}`);
    if (MESSAGE_IDS.some((id) => source.includes(JSON.stringify(id)))) {
      const body = source.slice(open + 1, end);
      if (entries.some((entry) => !body.includes(entry)) ||
          MESSAGE_IDS.some((id) => source.split(JSON.stringify(id)).length !== 2)) {
        throw Error(`reasoning-visibility: incomplete or inconsistent ${locale} translations`);
      }
      continue;
    }
    const body = source.slice(open + 1, end).trimEnd();
    const separator = body.length === 0 || body.endsWith(",") ? "" : ",";
    patches.push({ target, source: source.slice(0, end) + separator + entries.join(",") + source.slice(end) });
  }
  if (catalogCount === 0) throw Error("reasoning-visibility: no supported translation catalogs found");
  return patches;
}

function applySettingsPatch(extractedDir) {
  const assetsDir = path.join(extractedDir, "webview/assets");
  const candidates = fs.readdirSync(assetsDir).filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, source: fs.readFileSync(path.join(assetsDir, name), "utf8") }))
    .filter(({ source }) => source.includes("settings.general.macMenuBar.description") && source.includes(".macMenuBarEnabled"));
  if (candidates.length !== 1) throw Error("reasoning-visibility: General settings asset missing or ambiguous");
  const [{ name, source }] = candidates;
  const contract = settingsContract(source);
  if (!contract) throw Error("reasoning-visibility: native General setting contract missing or ambiguous");
  const component = settingComponent(contract);
  const render = `(0,${contract.jsx}.jsx)(${UI},{})`;
  let patched = source;
  if (source.includes(`function ${UI}(`)) {
    if (source.split(component).length !== 2 || source.split(render).length !== 2) {
      throw Error("reasoning-visibility: incomplete or inconsistent General setting patch");
    }
  } else {
    if (source.includes(UI)) throw Error("reasoning-visibility: partial General setting patch");
    patched = source.replace(contract.render[0], `${render},${contract.render[0]}`) + "\n" + component + "\n";
  }
  // Complete preflight before any settings/catalog writes, including locale drift.
  const catalogs = catalogPatches(assetsDir);
  if (patched !== source) fs.writeFileSync(path.join(assetsDir, name), patched);
  for (const catalog of catalogs) fs.writeFileSync(catalog.target, catalog.source);
  return { changed: patched !== source || catalogs.length > 0 };
}

module.exports = {
  MESSAGE_IDS, translations, settingsContract, settingComponent, catalogPatches, applySettingsPatch,
  settingsDescriptor: {
    id: "general-setting", phase: "extracted-app:post-webview", order: 20_980,
    ciPolicy: "optional", apply: applySettingsPatch,
  },
};

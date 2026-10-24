"use strict";

const { findMatchingBrace } = require("./minified-js.js");

const ID = "[A-Za-z_$][\\w$]*";
const ENTRY = /"set-remote-wsl-connections-enabled":async\(\{enabled:(?<enabled>[\w$]+),origin:(?<origin>[\w$]+)\}\)=>this\.windowManager\.getPrimaryWindows\(\)\.some\((?<window>[\w$]+)=>\k<window>\.webContents===\k<origin>\)\?this\.remoteConnectionsHandler\.setRemoteWslConnectionsEnabled\(\k<enabled>\):\{remoteWslConnections:this\.remoteConnectionsHandler\.catalog\.read\(\)\.wsl\?\?\[\]\}/g;
const DISPATCH = new RegExp(
  `handleVSCodeRequest\\((?<origin>${ID}),(?<route>${ID}),(?<body>${ID}),(?<trace>${ID}),(?<signal>${ID})\\)\\{try\\{` +
  `let (?<key>${ID})=\\k<route>,(?<handler>${ID})=this\\.handlers\\[\\k<key>\\];` +
  "if\\(typeof \\k<handler>!=`function`\\)throw Error\\(`\\$\\{\\k<route>\\} not implemented in the current Electron process\\. Restart ChatGPT to load the latest Electron handlers\\.`\\);" +
  `let (?<call>${ID})=\\(\\)=>\\k<handler>\\(\\{\\.\\.\\.\\k<body>,origin:\\k<origin>,signal:\\k<signal>\\}\\);` +
  `return \\k<trace>==null\\?\\k<call>\\(\\):${ID}\\.ct\\(\\{source:\\k<trace>,requestKind:\\k<route>\\},\\k<call>\\)\\}catch\\((?<error>${ID})\\)\\{` +
  `throw \\k<error> instanceof ${ID}\\?Error\\(\`\\$\\{\\k<route>\\} not implemented in Electron\\.\`\\):\\k<error>\\}\\}`,
  "g",
);

function isDirectMember(source, scopeOpen, target, boundary) {
  let quote = null, escaped = false, parentheses = 0, brackets = 0;
  for (let index = scopeOpen + 1; index < target; index += 1) {
    const char = source[index];
    if (quote != null) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") parentheses += 1;
    else if (char === ")") parentheses -= 1;
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets -= 1;
    else if (char === "{") {
      const end = findMatchingBrace(source, index);
      // Nested methods, classes, and objects do not expose members on the
      // original receiver or registry, even if all expected text is present.
      if (end < 0 || end >= target) return false;
      index = end;
    }
  }
  const previous = source.slice(scopeOpen, target).trimEnd().slice(-1);
  return quote == null && parentheses === 0 && brackets === 0 && boundary.test(previous);
}

function ipcRegistry(source) {
  const dispatchers = [...source.matchAll(DISPATCH)];
  const entries = [...source.matchAll(ENTRY)];
  if (dispatchers.length !== 1 || entries.length !== 1) return null;
  const entry = entries[0], dispatch = dispatchers[0];
  // Both anchors must belong to the same class, not to a lookalike object or
  // another request owner. The original dispatcher remains byte-identical.
  const owners = [...source.matchAll(/(?:var |,)([\w$]+)=class\{/g)]
    .filter((match) => match.index < entry.index).reverse();
  const owner = owners.find((match) => {
    const end = findMatchingBrace(source, source.indexOf("{", match.index));
    return end >= dispatch.index + dispatch[0].length - 1;
  });
  if (!owner) return null;
  const start = source.lastIndexOf("handlers={", entry.index);
  const classOpen = source.indexOf("{", owner.index);
  if (start < classOpen || /[\w$#.]/.test(source[start - 1] ?? "")
      || !isDirectMember(source, classOpen, start, /[;{}]/)
      || !isDirectMember(source, classOpen, dispatch.index, /[;{}]/)) return null;
  const open = start + "handlers=".length;
  const end = findMatchingBrace(source, open);
  if (end < entry.index + entry[0].length - 1 || end >= dispatch.index
      || !isDirectMember(source, open, entry.index, /[,{]/)) return null;
  return { open, end, body: source.slice(open + 1, end), entry: entry[0] };
}

function hasIpcBridge(source, payload) {
  const registry = ipcRegistry(source);
  return registry != null && source.split(payload).length === 2 && registry.body.split(payload).length === 2
    && isDirectMember(source, registry.open, source.indexOf(payload), /[,{]/);
}

function insertIpcBridge(source, payload) {
  const registry = ipcRegistry(source);
  if (!registry || source.includes(payload)) throw Error("Current Electron IPC handler registry is missing, ambiguous, or partially patched");
  return source.slice(0, registry.open + 1) + payload + "," + source.slice(registry.open + 1);
}

module.exports = { ipcRegistry, hasIpcBridge, insertIpcBridge };

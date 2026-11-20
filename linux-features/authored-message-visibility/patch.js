"use strict";

const { escapeRegExp, findMatchingBrace } = require("../../scripts/patches/lib/minified-js.js");

// Complete activity classifier from the current signed rspack/SWC package.
// The bundler inlines the classifier into the partition loop as a function
// expression, so the contract is bound by its destructured options and guard
// and then checked as one complete function body. Every local alias is
// captured; the upstream tool exceptions must stay intact.
const identifier = String.raw`[A-Za-z_$][\w$]*`;
const call = String.raw`(?:\(0,${identifier}\.${identifier}\)|${identifier})`;
const classifierHead = new RegExp(
  String.raw`function(?: ${identifier})?\(\{unit:(?<unit>${identifier}),hasFollowingFinalAnswer:(?<following>${identifier}),` +
    String.raw`keepMcpAppEntriesPersistent:(?<keep>${identifier}),mcpServerStatuses:(?<statuses>${identifier}),` +
    String.raw`renderMcpApps:(?<render>${identifier})\}\)\{` +
    String.raw`if\("standalone"!==\k<unit>\.kind\)return!1;let (?<item>${identifier})=\k<unit>\.item\.item;return`,
  "g",
);
// Newer signed packages inline the classifier into the partition function
// itself and move the tool exceptions into one upstream predicate that takes
// the partition options object. The head binds that options object, so the
// tool predicate stays upstream-owned and is checked as one call.
const partitionHead = new RegExp(
  String.raw`function(?: ${identifier})?\((?<units>${identifier}),\{hasFollowingFinalAnswer:(?<following>${identifier})=!1,` +
    String.raw`isTurnInProgress:${identifier}=!1,keepMcpAppEntriesPersistent:(?<keep>${identifier})=!1,` +
    String.raw`mcpServerStatuses:(?<statuses>${identifier}),renderMcpApps:(?<render>${identifier})=!1\}=\{\}\)\{` +
    String.raw`let (?:${identifier}=\[\],){4}${identifier}=null,(?<options>${identifier})=\{keepMcpAppEntriesPersistent:\k<keep>,` +
    String.raw`mcpServerStatuses:\k<statuses>,renderMcpApps:\k<render>,isPersistentDynamicTool:${identifier}\.${identifier}\},`,
  "g",
);
const recovery = "Disable authored-message-visibility and rebuild, or update its patch for the current official package.";

function classifierShape(source, match) {
  const open = match.index + match[0].indexOf("){if(") + 1;
  const end = findMatchingBrace(source, open);
  if (end < 0) return null;
  const body = source.slice(match.index, end + 1);
  const { item, following, keep, render, statuses } = match.groups;
  const i = escapeRegExp(item);
  // Upstream-owned exceptions that must survive unchanged in both states.
  const tools = [
    `"user-input-response"===${item}.type?!${item}.completed:`,
    `"dynamic-tool-call"===${item}.type&&`,
    `${keep}&&${render}&&"mcp-tool-call"===${item}.type&&`,
    `mcpServerStatuses:${statuses}}))`,
  ];
  const assistant = new RegExp(
    String.raw`"assistant-message"===${i}\.type\?(?<patched>!0\|\|)?${call}\(${i}\):!!\(`,
    "g",
  );
  if (!tools.every((part) => body.split(part).length === 2) ||
      !new RegExp(String.raw`"mcp-tool-call"===${i}\.type&&${call}\(${i}\)`).test(body)) {
    return null;
  }
  const assistants = [...body.matchAll(assistant)];
  const user = `||"user-message"===${item}.type&&("pending"===${item}.steeringStatus||!0===${item}.followsInterruptedFinalAnswer||` +
    `"accepted"===${item}.steeringStatus&&null==${item}.questionReplies&&null==${item}.codexDelegation&&!${item}.isToolOutput&&!${item}.isHistoricalSteering||` +
    `!0===${item}.wasInHistoryPreview||"not-sent"===${item}.deliveryStatus||!0===${item}.hookFeedback||!${following})}`;
  const currentUser = user.slice(0, -1) + ")}";
  const userPatched = `||"user-message"===${item}.type${currentUser}`;
  const original = assistants.length === 1 && assistants[0].groups.patched == null && body.endsWith(currentUser);
  const patched = assistants.length === 1 && assistants[0].groups.patched != null && body.endsWith(userPatched);
  if (!original && !patched) return null;
  return { start: match.index, body, item, original, assistant: assistants[0], user: currentUser, userPatched };
}

function userCondition(item, last) {
  return `"user-message"===${item}.type&&("pending"===${item}.steeringStatus||!0===${item}.followsInterruptedFinalAnswer||` +
    `"accepted"===${item}.steeringStatus&&null==${item}.questionReplies&&null==${item}.codexDelegation&&!${item}.isToolOutput&&!${item}.isHistoricalSteering||` +
    `!0===${item}.wasInHistoryPreview||"not-sent"===${item}.deliveryStatus||!0===${item}.hookFeedback||!${last})`;
}

function partitionShape(source, match) {
  const open = match.index + match[0].indexOf("={}){") + 4;
  const end = findMatchingBrace(source, open);
  if (end < 0) return null;
  const body = source.slice(match.index, end + 1);
  const options = escapeRegExp(match.groups.options);
  const classify = new RegExp(
    String.raw`"standalone"===(?<unit>${identifier})\.kind&&\(${call}\(\k<unit>\.item\.item,${options}\)\|\|` +
      String.raw`\((?<item>${identifier})=\k<unit>\.item\.item,(?<last>${identifier})=${identifier}<${identifier},`,
    "g",
  );
  const classifiers = [...body.matchAll(classify)];
  if (classifiers.length !== 1) return null;
  const { unit, item, last } = classifiers[0].groups;
  const i = escapeRegExp(item);
  const assistant = new RegExp(
    String.raw`"assistant-message"===${i}\.type\?(?<patched>!0\|\|)?${call}\(${i}\):`,
    "g",
  );
  const assistants = [...body.matchAll(assistant)];
  const user = userCondition(item, last);
  const userPatched = `"user-message"===${item}.type||${user}`;
  const routed = new RegExp(
    String.raw`${escapeRegExp(user)}\)\)\?(?<keep>${identifier})\.push\(${escapeRegExp(unit)}\):(?<fold>${identifier})\.push\(${escapeRegExp(unit)}\)\}` +
      String.raw`return\{collapsibleUnits:\k<fold>,expandedUnits:${identifier},persistentUnits:\k<keep>,`,
  );
  if (assistants.length !== 1 || body.split(user).length !== 2 || !routed.test(body)) return null;
  const at = assistants[0].index + assistants[0][0].length;
  const original = assistants[0].groups.patched == null && body.startsWith(user, at);
  const patched = assistants[0].groups.patched != null && body.startsWith(userPatched, at);
  if (!original && !patched) return null;
  return { start: match.index, body, item, original, assistant: assistants[0], user, userPatched, userAt: at };
}

function applyAuthoredMessageVisibilityPatch(source) {
  const shapes = [
    ...[...source.matchAll(classifierHead)].map((match) => classifierShape(source, match)),
    ...[...source.matchAll(partitionHead)].map((match) => partitionShape(source, match)),
  ];
  const current = shapes.filter((shape) => shape?.original);
  const patched = shapes.filter((shape) => shape != null && !shape.original);
  if (shapes.length === 1 && patched.length === 1) return source;
  if (shapes.length !== 1 || current.length !== 1) {
    console.warn(`WARN: authored-message-visibility: expected one complete activity classifier, found ${current.length} original and ${patched.length} patched of ${shapes.length}. ${recovery}`);
    return source;
  }
  const [{ start, body, assistant, user, userPatched, userAt = body.length - user.length }] = current;
  const insertAt = assistant.index + assistant[0].indexOf("?") + 1;
  const patchedBody = body.slice(0, insertAt) + "!0||" + body.slice(insertAt, userAt) +
    userPatched + body.slice(userAt + user.length);
  return source.slice(0, start) + patchedBody + source.slice(start + body.length);
}

module.exports = {
  applyAuthoredMessageVisibilityPatch,
  descriptors: [{
    id: "persistent-messages",
    phase: "webview-asset",
    order: 20_740,
    ciPolicy: "optional",
    // Content-addressed: every chunk that carries the activity partition
    // module is patched, because rspack can duplicate a module across chunks.
    assetNeedles: ["collapsibleUnits:", "persistentUnits:", "keepMcpAppEntriesPersistent:"],
    missingWarning: `WARN: authored-message-visibility: activity partition bundle missing. ${recovery}`,
    apply: applyAuthoredMessageVisibilityPatch,
  }],
};

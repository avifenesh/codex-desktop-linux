"use strict";

const {
  webviewAssetPatch,
} = require("../../../../descriptor.js");
const {
  applyLinuxCompletedItemRecoveryPatch,
} = require("../../../../impl/webview/index.js");

module.exports = [
  webviewAssetPatch({
    id: "linux-completed-item-recovery",
    phase: "webview-asset",
    order: 1043,
    ciPolicy: "optional",
    pattern: /^app-initial~app-main~(?:pull-request-code-review~onboarding-page~hotkey-window-thread-page~cha~[^.]+|onboarding-page~hotkey-window-thread-page~quick-chat-window-page~chatg~[^.]+)\.js$/,
    missingDescription: "app-server conversation manager bundle",
    skipDescription: "Linux completed item recovery patch",
    apply: applyLinuxCompletedItemRecoveryPatch,
  }),
];

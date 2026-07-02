"use strict";

const { applyLinuxExternalOpenEnvPatch } = require("../../../../main-process.js");

module.exports = {
  id: "linux-external-open-env",
  phase: "main-bundle",
  order: 900,
  ciPolicy: "optional",
  apply: applyLinuxExternalOpenEnvPatch,
};

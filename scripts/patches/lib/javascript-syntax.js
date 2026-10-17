"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PatchIntegrityError } = require("../integrity-error.js");

// Parse the final main-process modules without loading Electron, imports, or
// application code. --check respects .mjs/.cjs and the bundle's package type.
function validateMainProcessSyntax(extractedDir) {
  const buildDir = path.join(extractedDir, ".vite", "build");
  if (!fs.existsSync(buildDir)) return;
  for (const entry of fs.readdirSync(buildDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.(?:js|cjs|mjs)$/.test(entry.name)) continue;
    const target = path.join(buildDir, entry.name);
    const result = spawnSync(process.execPath, ["--check", target], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    if (result.error || result.status !== 0) {
      // Minified source lines can be megabytes long; retain the diagnostic,
      // not the complete line or caret, in build/update logs.
      const diagnostic = result.stderr?.split("\n").find((line) => line.startsWith("SyntaxError:"));
      throw new PatchIntegrityError(
        `JavaScript syntax validation failed for .vite/build/${entry.name}: ` +
        (diagnostic ?? result.error?.message ?? `parser exited ${result.status} (${result.signal ?? "no signal"})`),
      );
    }
  }
}

module.exports = { validateMainProcessSyntax };

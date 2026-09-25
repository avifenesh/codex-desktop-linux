#!/usr/bin/env bash
set -Eeuo pipefail

: "${INSTALL_DIR:?INSTALL_DIR is required}"

plugin_dir="$INSTALL_DIR/resources/plugins/openai-bundled/plugins/record-and-replay"
marketplace="$INSTALL_DIR/resources/plugins/openai-bundled/.agents/plugins/marketplace.json"

rm -rf "$plugin_dir"

[ -f "$marketplace" ] || exit 0

node - "$marketplace" <<'NODE'
const fs = require("node:fs");

const marketplacePath = process.argv[2];
let marketplace = { plugins: [] };
try {
  marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
} catch (_error) {
  process.exit(0);
}
if (!Array.isArray(marketplace.plugins)) {
  process.exit(0);
}
marketplace.plugins = marketplace.plugins.filter((plugin) => plugin?.name !== "record-and-replay");
fs.writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);
NODE

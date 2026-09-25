const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../..");
const workflowsDir = path.join(repoRoot, ".github/workflows");

const approvedNode24Actions = new Set([
  "actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
  "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
  "actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131",
  "actions/github-script@d746ffe35508b1917358783b479e04febd2b8f71",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
]);

function pinnedExternalActions(workflow, workflowName) {
  const actions = [];

  for (const [index, line] of workflow.split("\n").entries()) {
    const usesKey = /(?:^|[{,])[ \t]*(?:-[ \t]*)?(?:"uses"|'uses'|uses)[ \t]*:/g;
    const explicitUsesKey = /^[ \t]*\?[ \t]*(?:"uses"|'uses'|uses)[ \t]*$/;
    if (!usesKey.test(line) && !explicitUsesKey.test(line)) continue;

    const canonical = line.match(
      /^[ \t]*(?:-[ \t]*)?uses:[ \t]+([^\s#]+)(?:[ \t]+#.*)?$/,
    );
    assert.ok(
      canonical,
      `${workflowName}:${index + 1} must use canonical "uses: owner/action@commit" syntax`,
    );

    const action = canonical[1];
    if (action.startsWith("./") || action.startsWith("docker://")) continue;

    const separator = action.lastIndexOf("@");
    const ref = separator === -1 ? "" : action.slice(separator + 1);
    assert.match(
      ref,
      /^[0-9a-f]{40}$/,
      `${workflowName}:${index + 1}: ${action} must use a full commit SHA`,
    );
    actions.push(action);
  }

  return actions;
}

test("pinning validation rejects tags, branches, and noncanonical YAML keys", () => {
  const validSha = "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
  assert.deepEqual(
    pinnedExternalActions(`      - uses: actions/checkout@${validSha}`, "fixture.yml"),
    [`actions/checkout@${validSha}`],
  );

  for (const invalid of [
    "      - uses: actions/checkout@v7",
    "      - uses: actions/checkout@main",
    "      - uses : actions/checkout@v7",
    "      - \"uses\": actions/checkout@v7",
    "      - {'uses': actions/checkout@v7}",
    "      ? uses\n      : actions/checkout@v7",
  ]) {
    assert.throws(
      () => pinnedExternalActions(invalid, "fixture.yml"),
      /full commit SHA|canonical/,
    );
  }
});

test("workflows pin external actions and use approved Node 24 first-party actions", () => {
  const workflowNames = fs
    .readdirSync(workflowsDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
  const unapproved = [];
  let actionCount = 0;

  for (const workflowName of workflowNames) {
    const workflow = fs.readFileSync(
      path.join(workflowsDir, workflowName),
      "utf8",
    );
    assert.doesNotMatch(
      workflow,
      /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/,
      `${workflowName} must not force an action onto a runtime it does not declare`,
    );

    for (const action of pinnedExternalActions(workflow, workflowName)) {
      if (action.startsWith("actions/")) {
        actionCount += 1;
        if (!approvedNode24Actions.has(action)) {
          unapproved.push(`${workflowName}: ${action}`);
        }
      }
    }
  }

  assert.ok(actionCount > 0, "expected to find first-party JavaScript actions");
  assert.deepEqual(unapproved, []);
});

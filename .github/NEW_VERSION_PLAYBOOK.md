# New Upstream Version Agent Playbook

This playbook guides an agent through addressing a newly detected upstream Codex Desktop version.

## Overview

When the scheduled upstream-build workflow detects a new upstream DMG version (via `CFBundleShortVersionString`), an issue is automatically opened with:

- The new version number
- DMG SHA-256 and HTTP metadata
- A link to the workflow run and artifacts
- This playbook

Your goal is to verify the new version builds cleanly on Linux, identify any patch failures, fix them following repo conventions, validate the fixes, and open PRs for each fix.

## Phase 1: Download and Inspect

1. **Download the DMG** from the URL provided in the issue (typically `https://persistent.oaistatic.com/codex-app-prod/Codex.dmg`)

2. **Run the DMG intelligence report** to understand what changed:
   ```bash
   node scripts/dev/upstream-dmg-intel.js --dmg Codex.dmg
   ```
   
   This will extract the app, analyze platform gates, inventory protected surfaces, and run patch preflight checks. Review the output carefully for:
   - New platform gates that may indicate missing Linux parity
   - Changes to protected surfaces (Computer Use, Read Aloud, Chrome plugin, MCP servers)
   - Patch preflight warnings or failures

3. **Review the patch report artifact** from the workflow run linked in the issue. Check for:
   - `failed-required` patches (these block the build)
   - `skipped-optional` patches (these may degrade functionality)

## Phase 2: Build and Validate

1. **Run a clean build** against the new DMG:
   ```bash
   CODEX_PATCH_REPORT_JSON="$PWD/patch-report.json" ./install.sh ./Codex.dmg
   ```

2. **Examine the patch report**:
   ```bash
   cat patch-report.json | jq '.patches[] | select(.status != "applied")'
   ```

3. **Run the validation script** to check required patches:
   ```bash
   node scripts/ci/validate-patch-report.js patch-report.json --profile upstream-build
   ```

4. **If validation passes**, the version is compatible. Update the issue with confirmation and close it. No further work needed.

5. **If validation fails**, continue to Phase 3.

## Phase 3: Fix Patch Matchers

For each failed or skipped patch, you need to update its matcher to handle the new upstream code shape.

### Understanding Patch Descriptors

Core patches live in `scripts/patches/core/`. Each patch descriptor exports:

- `id`: unique identifier
- `targetFilter`: when this patch applies (usually `() => true` for all-linux)
- `replacement`: the code transformation

Patches use needle-and-replacement patterns. When upstream changes, needles may no longer match.

### Fixing Strategy

Read `scripts/patches/core/README.md` for the full contract. Follow these conventions:

1. **Keep old shapes working**: Don't remove old needle patterns. Add new branches for new shapes.

2. **Make it idempotent**: Patches should succeed if the desired state is already present.

3. **Graceful degradation**: Use `warn()` for non-critical failures, not hard errors.

4. **Test your changes**:
   ```bash
   node --test scripts/patch-linux-window-ui.test.js
   ```

5. **Verify against the new DMG**:
   ```bash
   CODEX_PATCH_REPORT_JSON="$PWD/patch-report-fixed.json" ./install.sh ./Codex.dmg
   node scripts/ci/validate-patch-report.js patch-report-fixed.json --profile upstream-build
   ```

### Example Fix Pattern

If a patch that adds Linux Computer Use registration now fails because the upstream registration code changed shape:

```javascript
// OLD needle (keep this!)
const oldShape = `
  setupPlatformFeatures() {
    this.registerFeature('computer-use', platformSpecific);
  }
`;

// NEW needle for the new upstream shape
const newShape = `
  setupPlatformFeatures() {
    const features = getPlatformFeatures();
    this.registerAll(features);
  }
`;

// Try old shape first, then new shape
if (content.includes(oldShape)) {
  return content.replace(oldShape, /* fixed version */);
} else if (content.includes(newShape)) {
  return content.replace(newShape, /* fixed version for new shape */);
} else {
  warn('Neither old nor new shape found - upstream may have changed significantly');
  return content; // graceful no-op
}
```

## Phase 4: Test Suite

After fixing patches, run the full test suite:

```bash
# Patch tests
node --test scripts/patch-linux-window-ui.test.js

# Smoke tests
bash tests/scripts_smoke.sh

# Build validation
./scripts/build-deb.sh
dpkg-deb -I dist/codex-desktop_*.deb

# If Rust changes were needed:
cargo test -p codex-update-manager
cargo test -p codex-computer-use-linux
```

## Phase 5: Create PRs

For each distinct fix (e.g., one patch descriptor, one build script, one feature):

1. **Create a focused branch** from `main`:
   ```bash
   git checkout -b fix/upstream-version-X.Y.Z-patch-name
   ```

2. **Commit with a clear message**:
   ```bash
   git commit -m "patch: handle new upstream shape in <patch-name>
   
   Upstream version X.Y.Z changed <what changed>. Updated the matcher
   to recognize both old and new shapes, preserving idempotence.
   
   Fixes #<issue-number>"
   ```

3. **Push to your fork**:
   ```bash
   git push origin fix/upstream-version-X.Y.Z-patch-name
   ```

4. **Open a PR** with:
   - **Title**: `patch: handle new upstream shape in <patch-name>`
   - **Body**: Explain what changed upstream, how you fixed it, and link the validation results
   - **Reference**: Link back to the version tracking issue

5. **Repeat** for each independent fix

## Phase 6: Update the Tracking Issue

Once all PRs are open:

1. **Comment on the tracking issue** with:
   - A summary of what changed
   - Links to all PRs
   - Validation results (paste the patch report summary)

2. **Apply label** `upstream-version` if not already present

3. **Keep the issue open** until all PRs are merged and the version is confirmed working

## Reference Documentation

- `AGENTS.md` - Repository structure and source of truth
- `scripts/patches/core/README.md` - Patch descriptor contract
- `docs/architecture.md` - High-level architecture
- `docs/build-and-packaging.md` - Build pipeline details
- `CONTRIBUTING.md` - Contributor guidelines

## Common Pitfalls

- **Don't remove old needles**: Preserve backward compatibility for users on older DMGs
- **Don't bypass the patch framework**: Always fix descriptors, not generated app code
- **Don't guess at needle shapes**: Read the actual upstream code in the extracted app
- **Don't batch unrelated fixes**: Each logical fix should be its own PR
- **Don't force-push**: If CI fails, add fixup commits and let maintainers squash

## Need Help?

If you encounter:

- **Systematic failures** across many patches: The upstream architecture may have changed significantly. Flag this in the issue and request maintainer review.
- **Protected surface changes** (Computer Use, Read Aloud, Chrome): These require careful review. Open a PR marked as draft and request review before marking ready.
- **Build system changes**: If `install.sh`, native module rebuilds, or Electron version detection fails, this is a deeper issue. Document the failure mode in the issue.

## Exit Criteria

The issue can be closed when:

1. All required patches apply cleanly
2. `node scripts/ci/validate-patch-report.js` passes with `--profile upstream-build`
3. A clean build completes successfully
4. Test suite passes
5. All fix PRs are merged (or no fixes were needed)

Update the issue with "✅ Version X.Y.Z validated and merged" before closing.

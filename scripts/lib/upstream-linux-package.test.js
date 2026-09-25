"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  extractClearSignedPayload,
  mapMachineArch,
  parseReleaseSha256,
  selectChatgptPackage,
  verifyIndexedFile,
  verifyInRelease,
} = require("./upstream-linux-package.js");

function run(command, args, options = {}) {
  return childProcess.execFileSync(command, args, { encoding: "utf8", ...options });
}

function createSigningFixture(root, identity) {
  const home = path.join(root, identity.replace(/\W/g, "-"));
  fs.mkdirSync(home, { mode: 0o700 });
  run("gpg", [
    "--homedir", home,
    "--batch", "--pinentry-mode", "loopback", "--passphrase", "",
    "--quick-generate-key", identity, "rsa2048", "sign", "0",
  ]);
  const listing = run("gpg", ["--homedir", home, "--batch", "--with-colons", "--list-keys"]);
  const fingerprint = listing.split(/\r?\n/).find((line) => line.startsWith("fpr:"))?.split(":")[9];
  assert.match(fingerprint, /^[0-9A-F]{40}$/);
  const keyPath = path.join(root, `${identity.replace(/\W/g, "-")}.gpg`);
  childProcess.execFileSync("gpg", ["--homedir", home, "--batch", "--output", keyPath, "--export", fingerprint]);
  return { fingerprint, home, keyPath };
}

test("architecture mapping supports only official architectures", () => {
  assert.equal(mapMachineArch("x86_64"), "amd64");
  assert.equal(mapMachineArch("aarch64"), "arm64");
  assert.throws(() => mapMachineArch("armv7l"), /Unsupported architecture/);
});

test("signed Release SHA256 and Packages metadata are parsed strictly", () => {
  const payload = [
    "Codename: stable",
    "SHA256:",
    ` ${"a".repeat(64)} 123 main/binary-amd64/Packages`,
    "SHA512:",
    ` ${"b".repeat(128)} 123 main/binary-amd64/Packages`,
  ].join("\n");
  assert.deepEqual(parseReleaseSha256(payload).get("main/binary-amd64/Packages"), {
    sha256: "a".repeat(64), size: 123,
  });

  const packages = [
    "Package: chatgpt",
    "Version: 26.803.81509",
    "Architecture: amd64",
    "Filename: pool/main/c/chatgpt/chatgpt_26.803.81509_amd64.deb",
    "Size: 42",
    `SHA256: ${"c".repeat(64)}`,
    "Depends: libgtk-3-0, libnss3",
  ].join("\n");
  assert.equal(selectChatgptPackage(packages, "amd64").version, "26.803.81509");
  assert.throws(() => selectChatgptPackage(packages, "arm64"), /found 0/);
  assert.throws(() => selectChatgptPackage(packages.replace("Package: chatgpt", "Package: other"), "amd64"), /found 0/);
  assert.throws(() => selectChatgptPackage(packages.replace("pool/main", "../escape"), "amd64"), /Unsafe/);
});

test("indexed file verification rejects size and SHA256 mismatches", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-index-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = path.join(root, "Packages");
  fs.writeFileSync(filePath, "trusted bytes");
  assert.throws(() => verifyIndexedFile(filePath, { size: 1, sha256: "0".repeat(64) }, "Packages"), /size mismatch/);
  assert.throws(() => verifyIndexedFile(filePath, { size: 13, sha256: "0".repeat(64) }, "Packages"), /SHA256 mismatch/);
});

test("InRelease verification accepts the signing key and rejects tampering or a wrong key", { timeout: 30000 }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-inrelease-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const signer = createSigningFixture(root, "Codex Fixture Signer");
  const wrong = createSigningFixture(root, "Wrong Fixture Signer");
  const releasePath = path.join(root, "Release");
  const inReleasePath = path.join(root, "InRelease");
  fs.writeFileSync(releasePath, `Codename: stable\nSHA256:\n ${"d".repeat(64)} 1 main/binary-amd64/Packages\n`);
  childProcess.execFileSync("gpg", [
    "--homedir", signer.home,
    "--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase", "",
    "--output", inReleasePath, "--clearsign", releasePath,
  ]);

  const payload = verifyInRelease(inReleasePath, signer.keyPath, signer.fingerprint);
  assert.equal(parseReleaseSha256(payload).size, 1);
  assert.throws(() => verifyInRelease(inReleasePath, wrong.keyPath, signer.fingerprint), /expected fingerprint/);
  assert.throws(() => verifyInRelease(inReleasePath, wrong.keyPath, wrong.fingerprint), /signature verification failed/);

  const tamperedPath = path.join(root, "tampered-InRelease");
  fs.writeFileSync(tamperedPath, fs.readFileSync(inReleasePath, "utf8").replace("Codename: stable", "Codename: testing"));
  assert.throws(() => verifyInRelease(tamperedPath, signer.keyPath, signer.fingerprint), /signature verification failed/);
  assert.match(extractClearSignedPayload(fs.readFileSync(inReleasePath, "utf8")), /Codename: stable/);
});

"use strict";
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const { signal, session } = require("./fixtures/kwin-session.cjs");

function world(pid = 4242) {
  let active, bounds = { x: 300, y: 200, width: 1200, height: 900 };
  const mini = { pid, caption: "Codex Pet Overlay", resourceClass: "codex-desktop", wantsInput: true,
    internalId: "{60115083-b547-4bfe-b29f-3736ebcd996b}", frameGeometryChanged: signal(),
    get frameGeometry() { return bounds; }, set frameGeometry(value) { bounds = value; this.frameGeometryChanged.emit(); } };
  const workspace = { windowAdded: signal(), windowRemoved: signal(), windowActivated: signal(), cursorPosChanged: signal(),
    cursorPos: { x: 350, y: 250 }, windowList: () => [mini], raiseWindow() {},
    get activeWindow() { return active; }, set activeWindow(value) { active = value; this.windowActivated.emit(value); } };
  return { workspace, mini };
}
const size = { width: 1200, height: 900 };
const areas = [{ display: { x: 0, y: 0, width: 1920, height: 1200 }, x: -500, maxX: 900, y: -500, maxY: 500 }];

test("serialized script keeps syntax supported by KWin's QJSEngine", () => {
  assert.doesNotMatch(require("./kwin-script.cjs").toString(), /catch\s*\{|\.\.\./);
});

test("persistent session preserves the grab point across successive drags and stops before ACK", () => {
  const { workspace, mini } = world(), k = session(workspace);
  assert.equal(k.acknowledgements[0].type, "ready");
  assert.equal(k.send("prepare", size).ok, true);
  for (let n = 0; n < 6; n += 1) {
    const pointer = { x: workspace.cursorPos.x - mini.frameGeometry.x, y: workspace.cursorPos.y - mini.frameGeometry.y };
    assert.equal(k.send("drag", { id: mini.internalId, pointer, areas }).ok, true);
    workspace.cursorPos = { x: 600 + n * 30, y: 400 + n * 20 };
    workspace.cursorPosChanged.emit();
    assert.equal(mini.frameGeometry.x + pointer.x, workspace.cursorPos.x);
    assert.equal(mini.frameGeometry.y + pointer.y, workspace.cursorPos.y);
    const reply = k.send("endDrag");
    assert.equal(reply.ok, true);
    const final = JSON.stringify(mini.frameGeometry);
    workspace.cursorPos = { x: 1000, y: 1000 }; workspace.cursorPosChanged.emit();
    assert.equal(JSON.stringify(mini.frameGeometry), final);
    assert.equal(reply.value.id, mini.internalId);
    workspace.cursorPos = { x: mini.frameGeometry.x + 50, y: mini.frameGeometry.y + 50 };
  }
});

test("edge limits use actual compositor geometry and preserve the point on release", () => {
  const { workspace, mini } = world(), k = session(workspace);
  k.send("prepare", size);
  k.send("drag", { id: mini.internalId, pointer: { x: 50, y: 50 }, areas });
  workspace.cursorPos = { x: 3000, y: 3000 }; workspace.cursorPosChanged.emit();
  assert.equal(mini.frameGeometry.x, 900); assert.equal(mini.frameGeometry.y, 500);
  const before = JSON.stringify(mini.frameGeometry);
  k.send("endDrag"); assert.equal(JSON.stringify(mini.frameGeometry), before);
});

for (const mode of ["click", "drag", "out-and-back", "delayed-start", "clamped"]) {
  test(`compositor release distinguishes ${mode} from a mascot click`, () => {
    const { workspace, mini } = world(), k = session(workspace);
    k.send("prepare", size);
    const origin = { x: 350, y: 250 };
    workspace.cursorPos = mode === "delayed-start" ? { x: 390, y: 250 } : origin;
    k.send("drag", { id: mini.internalId, pointer: { x: 50, y: 50 }, areas });
    if (["drag", "out-and-back", "clamped"].includes(mode)) {
      workspace.cursorPos = { x: mode === "clamped" ? 4000 : 450, y: 250 };
      workspace.cursorPosChanged.emit();
    }
    if (mode === "out-and-back") { workspace.cursorPos = origin; workspace.cursorPosChanged.emit(); }
    assert.equal(k.send("endDrag").value.moved, mode !== "click");
    assert.equal(k.send("endDrag").value.moved, null, "a duplicate release cannot turn a drag into a click");
  });
}

test("proximity covers transparent gaps, follows window movement and keeps hysteresis", () => {
  const { workspace, mini } = world(), k = session(workspace);
  k.send("prepare", size);
  k.send("proximity", { rects: [{ left: 100, top: 100, width: 60, height: 40 }], enter: 10, exit: 20 });
  workspace.cursorPos = { x: 395, y: 310 }; workspace.cursorPosChanged.emit();
  assert.equal(k.events.at(-1).near, true);
  workspace.cursorPos.x = 381; workspace.cursorPosChanged.emit(); assert.equal(k.events.at(-1).near, true);
  workspace.cursorPos.x = 379; workspace.cursorPosChanged.emit(); assert.equal(k.events.at(-1).near, false);
  mini.frameGeometry = { ...mini.frameGeometry, x: 280 }; assert.equal(k.events.at(-1).near, true);
  k.send("stop"); assert.equal(k.events.at(-1).near, false);
});

test("Stop releases focus policy before acknowledging and older epochs cannot re-arm it", () => {
  const { workspace, mini } = world(), other = { wantsInput: true }, k = session(workspace);
  workspace.activeWindow = other;
  k.send("prepare", size);
  workspace.activeWindow = mini; assert.equal(workspace.activeWindow, other);
  assert.equal(k.send("pointer", { ...size, enabled: false }).ok, true);
  workspace.activeWindow = mini; assert.equal(workspace.activeWindow, mini);
  k.send("stop", {}, { epoch: 2 });
  assert.equal(k.send("pointer", size, { epoch: 1 }).ok, false);
  workspace.activeWindow = mini; assert.equal(workspace.activeWindow, mini);
});

test("expired commands and liveness expiry stop all motion and detach handlers", () => {
  const { workspace, mini } = world(), k = session(workspace);
  assert.equal(k.send("prepare", size, { deadline: k.clock.now - 1 }).ok, false);
  k.send("prepare", size); k.send("drag", { id: mini.internalId, pointer: { x: 50, y: 50 }, areas });
  k.timers[0].timeout.emit();
  const before = JSON.stringify(mini.frameGeometry);
  workspace.cursorPos.x += 100; workspace.cursorPosChanged.emit(); assert.equal(JSON.stringify(mini.frameGeometry), before);
  for (const name of ["windowAdded", "windowRemoved", "windowActivated", "cursorPosChanged"]) assert.equal(workspace[name].handlers.size, 0);
  assert.equal(mini.frameGeometryChanged.handlers.size, 0);
});

for (const mismatch of ["pid", "app", "title", "size", "ambiguous", "deleted"]) test(`session leaves ${mismatch} windows untouched`, () => {
  const { workspace, mini } = world(), k = session(workspace), before = JSON.stringify(mini.frameGeometry);
  if (mismatch === "pid") mini.pid += 1;
  if (mismatch === "app") mini.resourceClass = "other";
  if (mismatch === "title") mini.caption = "ChatGPT";
  if (mismatch === "size") mini.frameGeometry = { ...mini.frameGeometry, width: 300 };
  if (mismatch === "ambiguous") workspace.windowList = () => [mini, { ...mini }];
  if (mismatch === "deleted") mini.deleted = true;
  k.send("prepare", { ...size, bounds: { x: 5, y: 5, ...size } });
  assert.equal(k.send("keyboard").ok, false);
  if (mismatch !== "size") assert.equal(JSON.stringify(mini.frameGeometry), before);
});

function transport(t, { delayStart = false, omitAck = false, missingQdbus = false, spawnThrows = false, mkdirThrows = false } = {}) {
  const { workspace, mini } = world(process.pid), calls = [], errors = [], timers = [];
  const lifecycle = Object.assign(new EventEmitter(), { pid: process.pid, env: {} }), directories = [];
  let file, receiver, queued, start, startupTimeout;
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill() { this.emit("exit", 0); } });
  child.stdin.on("finish", () => child.emit("exit", 0));
  child.stdin.on("data", data => { const text = String(data).trim(); if (receiver) { const callback = receiver; receiver = null; callback(text); } else queued = text; });
  const childProcess = {
    spawn: () => { if (spawnThrows) throw Error("spawn failed"); setImmediate(() => child.stdout.write(JSON.stringify({ type: "listening", address: ":1.20", owner: ":1.10" }) + "\n")); return child; },
    execFile(command, args, _options, callback) {
      calls.push(args);
      if (missingQdbus) { callback(Object.assign(Error("missing qdbus"), { code: "ENOENT" })); return; }
      if (args[2].endsWith(".loadScript")) { file = args[3]; callback(null, "5\n"); return; }
      assert.equal(args[2], "org.kde.kwin.Scripting.start");
      start = () => {
        vm.runInNewContext(fs.readFileSync(file, "utf8"), { workspace, QTimer: class {
          timeout = signal(); constructor() { timers.push(this); } start() {} stop() {}
        }, callDBus(_address, _path, _iface, method, _token, ack, callback) {
          if (method === "Event") { child.stdout.write(ack + "\n"); callback(); return; }
          if (!omitAck) child.stdout.write(ack + "\n");
          receiver = callback;
          if (queued) { const value = queued; queued = null; const next = receiver; receiver = null; next(value); }
        } });
      };
      callback(null, "");
      if (!delayStart) setImmediate(start);
    },
  };
  const scope = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("./kwin-bridge.cjs"), "utf8"), {
    module: scope, process: lifecycle, Buffer, clearTimeout,
    setTimeout: (fn, delay) => { if (delay === 3000) { startupTimeout = fn; return { unref() {} }; } return setTimeout(fn, delay); },
    require: name => name === "node:child_process" ? childProcess : name === "node:fs" ? { ...fs,
      mkdtempSync(prefix) { if (mkdirThrows) throw Error("mkdir failed"); const directory = fs.mkdtempSync(prefix); directories.push(directory); return directory; },
    } : require(name),
  });
  let bridge;
  try { bridge = new scope.exports.KWinBridge({ resourcesPath: "/fixture/resources", onError: e => errors.push(e) }); }
  catch (error) { return { error, lifecycle, directories }; }
  t.after(async () => { await bridge.close().catch(() => {}); child.emit("exit", 0); });
  return { bridge, workspace, mini, calls, errors, child, lifecycle, directories, timers,
    startupTimeout: () => startupTimeout(), start: () => start() };
}

for (const reason of ["qdbus", "startup"]) test(`failed ${reason} startup releases helper, directory and exit listener`, async t => {
  const k = transport(t, { missingQdbus: reason === "qdbus", delayStart: reason === "startup" });
  if (reason === "startup") k.startupTimeout();
  await assert.rejects(k.bridge.ready);
  await k.bridge.stopped;
  assert.equal(k.bridge.closed, true);
  assert.equal(fs.existsSync(k.directories[0]), false);
  assert.equal(k.lifecycle.listenerCount("exit"), 0);
});

for (const reason of ["spawn", "mkdir"]) test(`synchronous ${reason} failure releases partial constructor resources`, t => {
  const k = transport(t, { spawnThrows: reason === "spawn", mkdirThrows: reason === "mkdir" });
  assert.match(k.error.message, /failed/);
  assert.equal(k.lifecycle.listenerCount("exit"), 0);
  for (const directory of k.directories) assert.equal(fs.existsSync(directory), false);
});

test("normal parent exit removes its temporary script directory synchronously", async t => {
  const k = transport(t); await k.bridge.ready;
  assert.equal(fs.existsSync(k.directories[0]), true);
  k.lifecycle.emit("exit");
  assert.equal(fs.existsSync(k.directories[0]), false);
  assert.equal(k.lifecycle.listenerCount("exit"), 0);
});

test("a colliding allocated ID never gets addressed; bootstrap waits for its own script's READY", async t => {
  const k = transport(t, { delayStart: true });
  let ready = false;
  void k.bridge.ready.then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false, "start reply is not an execution barrier");
  k.start(); await k.bridge.ready;
  await k.bridge.request("prepare", size);
  for (let n = 0; n < 10; n += 1) { await k.bridge.request("pointer", size); await k.bridge.request("endDrag"); }
  assert.deepEqual(k.calls.map(args => args[2]), ["org.kde.kwin.Scripting.loadScript", "org.kde.kwin.Scripting.start"]);
  assert.equal(k.calls.some(args => /Script5/.test(args[1])), false);
});

test("invalidated queued commands do not follow a Stop into the next epoch", async t => {
  const k = transport(t); await k.bridge.ready;
  let valid = true;
  const stale = k.bridge.request("prepare", size, () => valid);
  valid = false;
  const stop = k.bridge.invalidate();
  await assert.rejects(stale, { code: "CANCELLED" });
  await stop;
  assert.equal(k.bridge.queued, 0);
});

test("missing command ACK closes the session and late output cannot reopen it", async t => {
  const k = transport(t); await k.bridge.ready;
  // The helper stream stalls after readiness, modeling a lost script callback.
  k.child.stdin.removeAllListeners("data");
  const pending = k.bridge.request("stop", {}, () => true, 30);
  const keepAlive = setTimeout(() => {}, 100);
  await assert.rejects(pending, /acknowledgement timed out/);
  clearTimeout(keepAlive);
  assert.equal(k.bridge.closed, true);
  await assert.rejects(k.bridge.request("prepare", size), /closed/);
});

for (const operation of ["endDrag", "stop"]) test(`queue overflow tears down the session rather than dropping ${operation}`, async t => {
  const k = transport(t); await k.bridge.ready;
  await k.bridge.request("prepare", size);
  await k.bridge.request("drag", { id: k.mini.internalId, pointer: { x: 50, y: 50 }, areas });
  k.child.stdin.removeAllListeners("data");
  const pending = Array.from({ length: 16 }, () => k.bridge.request("proximity", { rects: [], enter: 0, exit: 0 }));
  const settled = Promise.allSettled(pending);
  await assert.rejects(k.bridge.request(operation), /queue is full/);
  assert.equal(k.bridge.closed, true);
  assert.ok((await settled).every(result => result.status === "rejected"));
  await k.bridge.stopped;
  assert.equal(k.bridge.queued, 0);
  k.timers[0].timeout.emit();
  const before = JSON.stringify(k.mini.frameGeometry);
  k.workspace.cursorPos.x += 100; k.workspace.cursorPosChanged.emit();
  assert.equal(JSON.stringify(k.mini.frameGeometry), before);
});

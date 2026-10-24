"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const script = require("./kwin-script.cjs");

function cancelled() { return Object.assign(new Error("Stale Mini command"), { code: "CANCELLED" }); }

class KWinBridge {
  constructor({ resourcesPath = process.resourcesPath, onNear = () => {}, onError = () => {} } = {}) {
    this.epoch = 1;
    this.sequence = 0;
    this.queued = 0;
    this.tail = Promise.resolve();
    this.onNear = onNear;
    this.onError = onError;
    this.stopped = new Promise(resolve => { this.resolveStopped = resolve; });
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    void this.ready.catch(() => {});
    this.onExit = () => { this.child?.stdin.end(); this.cleanup(); };
    process.once("exit", this.onExit);
    try {
      const token = randomBytes(32).toString("hex");
      const name = `codex_pet_bridge_${process.pid}_${token.slice(0, 16)}`;
      this.directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "codex-pet-bridge-"));
      const file = path.join(this.directory, "session.js");
      this.startTimer = setTimeout(() => this.fail(new Error("Mini KWin bridge startup timed out")), 3000);
      this.startTimer.unref?.();
      this.child = spawn(path.join(resourcesPath, "native", "codex-pet-kwin"), [name, token], { stdio: ["pipe", "pipe", "pipe"] });
      let buffer = "", diagnostic = "", listening = false;
      this.child.stderr.on("data", chunk => { diagnostic = (diagnostic + chunk).slice(-4096); });
      this.child.stdin.on("error", error => this.fail(error));
      this.child.on("error", error => { this.fail(error); this.resolveStopped(); this.cleanup(); });
      this.child.once("exit", () => {
        if (!this.closed) this.fail(new Error(`Mini KWin helper exited: ${diagnostic}`));
        this.resolveStopped();
        this.cleanup();
      });
      this.child.stdout.on("data", chunk => {
        if (this.closed) return;
        buffer += chunk;
        if (buffer.length > 65536) { this.fail(new Error("Oversized Mini helper output")); return; }
        let index;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
          try {
            const message = JSON.parse(line);
            if (message.type === "listening") {
              if (listening || !/^:\d+\.\d+$/.test(message.address) || !/^:\d+\.\d+$/.test(message.owner)) throw Error("Invalid Mini bus identity");
              listening = true;
              const data = { address: message.address, token, path: "/org/chatgpt/Community/Pet", iface: "org.chatgpt.Community.Pet1",
                pid: process.pid, appId: process.env.CODEX_LINUX_APP_ID || "codex-desktop" };
              fs.writeFileSync(file, `(${script})(${JSON.stringify(data)});`, { flag: "wx", mode: 0o600 });
              void this.bootstrap(message.owner, file, name).catch(error => this.fail(error));
            } else if (message.type === "ready") {
              if (!listening || this.armed) throw Error("Unexpected Mini ready acknowledgement");
              this.armed = true; clearTimeout(this.startTimer); this.resolveReady();
            } else if (message.type === "ack" && message.seq !== 0) {
              const pending = this.pending;
              if (pending && message.seq === pending.seq && message.epoch === pending.epoch) {
                this.pending = null;
                clearTimeout(pending.timer);
                if (message.ok === true) pending.resolve(message.value);
                else pending.reject(new Error(`KWin rejected Mini command: ${message.error}`));
              }
            } else if (message.type === "event" && message.epoch === this.epoch && typeof message.near === "boolean") {
              this.onNear(message.near);
            }
          } catch (error) { this.fail(error); }
        }
      });
    } catch (error) {
      this.fail(error);
      this.resolveStopped();
      this.cleanup();
      throw error;
    }
  }

  async bootstrap(owner, file, name) {
    const call = args => new Promise((resolve, reject) => {
      const run = command => execFile(command, [owner, "/Scripting", ...args], { timeout: 1500 }, (error, output) => {
        if (error?.code === "ENOENT" && command === "qdbus6") run("qdbus");
        else if (error) reject(error); else resolve(String(output).trim());
      });
      run("qdbus6");
    });
    const id = await call(["org.kde.kwin.Scripting.loadScript", file, name]);
    if (!/^\d+$/.test(id) || this.closed) throw Error("Mini KWin script could not be loaded");
    // KWin can reuse a live script ID; start the loaded object and await its own ACK.
    // shortcut: start also starts foreign pending scripts; replace when KWin offers a name-scoped run API.
    await call(["org.kde.kwin.Scripting.start"]);
  }

  request(op, data = {}, valid = () => true, timeout = 1500) {
    const epoch = this.epoch;
    if (this.closed) return Promise.reject(new Error("Mini KWin bridge is closed"));
    if (this.queued >= 16) {
      const error = new Error("Mini KWin command queue is full");
      this.fail(error);
      return Promise.reject(error);
    }
    this.queued += 1;
    const task = this.tail.catch(() => {}).then(async () => {
      await this.ready;
      if (this.closed || epoch !== this.epoch || !valid()) throw cancelled();
      const seq = ++this.sequence;
      const command = { seq, epoch, deadline: Date.now() + timeout, op, data };
      const line = JSON.stringify(command) + "\n";
      if (Buffer.byteLength(line) > 65536) throw Error("Oversized Mini KWin command");
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => this.fail(new Error(`Mini KWin ${op} acknowledgement timed out`)), timeout);
        timer.unref?.();
        this.pending = { seq, epoch, resolve, reject, timer };
        this.child.stdin.write(line, error => { if (error) this.fail(error); });
      });
      if (epoch !== this.epoch || !valid()) throw cancelled();
      return result;
    });
    this.tail = task.finally(() => { this.queued -= 1; });
    void this.tail.catch(() => {});
    return task;
  }

  invalidate() { this.epoch += 1; return this.request("stop"); }

  fail(error) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.startTimer);
    this.rejectReady(error);
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
    this.child?.stdin.end();
    this.killTimer = setTimeout(() => this.child?.kill("SIGKILL"), 2500);
    this.killTimer.unref?.();
    this.onError(error);
  }

  async close() {
    try { if (!this.closed) await this.invalidate(); }
    finally { this.fail(new Error("Mini KWin bridge closed")); }
  }

  cleanup() {
    clearTimeout(this.killTimer);
    process.removeListener("exit", this.onExit);
    if (this.directory) { fs.rmSync(this.directory, { recursive: true, force: true }); this.directory = null; }
  }
}

module.exports = { KWinBridge };

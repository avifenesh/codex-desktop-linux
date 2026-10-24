"use strict";

const vm = require("node:vm");
const script = require("../kwin-script.cjs");

function signal() {
  const handlers = new Set();
  return { connect: fn => handlers.add(fn), disconnect: fn => handlers.delete(fn), handlers,
    emit: value => { for (const fn of [...handlers]) fn(value); } };
}

function session(workspace, clock = { now: Date.now() }) {
  const events = [], acknowledgements = [];
  let receive, sequence = 0;
  const timers = [];
  vm.runInNewContext(`(${script})(${JSON.stringify({ address: ":1.20", path: "/test", iface: "Test", token: "test", pid: 4242, appId: "codex-desktop" })})`, {
    workspace, Date: { now: () => clock.now }, QTimer: class {
      timeout = signal();
      constructor() { timers.push(this); }
      start(delay) { this.delay = delay; }
      stop() { this.stopped = true; }
    },
    callDBus(_address, _path, _iface, method, _token, data, callback) {
      if (method === "NextCommand") { acknowledgements.push(JSON.parse(data)); receive = callback; }
      else { events.push(JSON.parse(data)); callback(); }
    },
  });
  return { events, acknowledgements, timers, clock,
    send(op, data = {}, overrides = {}) {
      const command = { op, data, epoch: 1, seq: ++sequence, deadline: clock.now + 1500, ...overrides };
      receive(JSON.stringify(command));
      return acknowledgements.at(-1);
    },
  };
}

function bridgeForSession(kwin, { calls = [], beforeCommand = async () => {} } = {}) {
  return class SessionBridge {
    epoch = 1;
    tail = Promise.resolve();
    constructor(options) { this.options = options; }
    fail(error) { this.closed = true; this.options.onError(error); }
    request(op, data, valid = () => true) {
      const epoch = this.epoch;
      const pending = this.tail.catch(() => {}).then(async () => {
        await beforeCommand(op, data);
        if (this.closed) throw Error("Mini KWin bridge is closed");
        if (epoch !== this.epoch || !valid()) throw Object.assign(Error("cancelled"), { code: "CANCELLED" });
        calls.push(op);
        const ack = kwin.send(op, JSON.parse(JSON.stringify(data ?? {})), { epoch });
        if (!ack.ok) throw Error(ack.error);
        for (const event of kwin.events.splice(0)) if (event.epoch === epoch) this.options.onNear(event.near);
        return ack.value;
      });
      this.tail = pending;
      return pending;
    }
    invalidate() { this.epoch += 1; return this.request("stop"); }
  };
}

module.exports = { signal, session, bridgeForSession };

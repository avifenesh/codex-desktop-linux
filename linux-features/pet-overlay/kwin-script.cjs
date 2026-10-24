"use strict";

// Serialized into KWin's JavaScript engine; Electron and Node APIs stay in the bridge.
module.exports = function petKWinSession(session) {
  let epoch = 0, sequence = 0, match = null, mini = null, last = workspace.activeWindow;
  let pointerOnly = false, placement = null, drag = null, proximity = null, near = false, dead = false;
  let eventPending = false, reported = null;
  const lease = new QTimer();
  lease.singleShot = true;
  const finite = value => typeof value === "number" && isFinite(value);
  const rectangle = r => r && [r.x, r.y, r.width, r.height].every(finite) && r.width > 0 && r.height > 0;
  const own = w => w && !w.deleted && w.pid === session.pid &&
    String(w.resourceClass) === session.appId && w.caption === "Codex Pet Overlay";
  const matches = w => own(w) && match && Math.round(w.frameGeometry.width) === match.width &&
    Math.round(w.frameGeometry.height) === match.height;
  const frame = () => {
    if (!own(mini)) return null;
    const g = mini.frameGeometry;
    return { id: String(mini.internalId), bounds: { x: Math.round(g.x), y: Math.round(g.y),
      width: Math.round(g.width), height: Math.round(g.height) } };
  };
  function sendNear() {
    if (dead || eventPending || reported === near) return;
    eventPending = true;
    reported = near;
    callDBus(session.address, session.path, session.iface, "Event", session.token,
      JSON.stringify({ type: "event", epoch, near }), function () { eventPending = false; sendNear(); });
  }
  function updateNear() {
    let next = false;
    if (own(mini) && proximity) {
      const p = workspace.cursorPos, g = mini.frameGeometry;
      const distance = near ? proximity.exit : proximity.enter;
      next = proximity.rects.some(r => {
        const dx = Math.max(g.x + r.left - p.x, 0, p.x - g.x - r.left - r.width);
        const dy = Math.max(g.y + r.top - p.y, 0, p.y - g.y - r.top - r.height);
        return dx * dx + dy * dy <= distance * distance;
      });
    }
    near = next;
    sendNear();
  }
  function moved() { updateNear(); }
  function setMini(window) {
    if (mini === window) return;
    if (mini) { try { mini.frameGeometryChanged.disconnect(moved); } catch (error) {} }
    mini = window;
    if (mini) mini.frameGeometryChanged.connect(moved);
  }
  function reset() {
    pointerOnly = false; placement = null; drag = null; proximity = null; match = null;
    setMini(null);
    updateNear();
  }
  function activated(window) {
    // Activation may precede windowAdded; never remember Mini as its own predecessor.
    if (window !== mini) { if (window && !own(window)) last = window; return; }
    if (pointerOnly && last && !last.deleted && !last.minimized && last.wantsInput && last !== mini)
      workspace.activeWindow = last;
  }
  function added(window) {
    if (mini || !matches(window)) return;
    const candidates = workspace.windowList().filter(matches);
    if (candidates.length !== 1) return;
    setMini(window);
    if (last === mini) last = null;
    if (placement) { mini.frameGeometry = placement; placement = null; }
    if (pointerOnly && workspace.activeWindow === mini) activated(mini);
    updateNear();
  }
  function removed(window) {
    if (window === mini) { setMini(null); drag = null; updateNear(); }
    if (window === last) last = null;
  }
  function cursor() {
    if (drag && own(mini)) {
      if (Date.now() > drag.expires) drag = null;
      else {
        const p = workspace.cursorPos, g = mini.frameGeometry;
        if (Math.abs(p.x - drag.start.x) >= 4 || Math.abs(p.y - drag.start.y) >= 4) drag.moved = true;
        let x = Math.round(p.x - drag.pointer.x), y = Math.round(p.y - drag.pointer.y);
        const areas = drag.areas.slice().sort((a, b) => {
          const distance = r => { const q = r.display, dx = Math.max(q.x - p.x, 0, p.x - q.x - q.width),
            dy = Math.max(q.y - p.y, 0, p.y - q.y - q.height); return dx * dx + dy * dy; };
          return distance(a) - distance(b);
        });
        const area = areas[0];
        x = Math.max(area.x, Math.min(area.maxX, x));
        y = Math.max(area.y, Math.min(area.maxY, y));
        mini.frameGeometry = { x, y, width: g.width, height: g.height };
      }
    }
    updateNear();
  }
  function apply(command) {
    if (!Number.isSafeInteger(command.seq) || command.seq <= sequence || !Number.isSafeInteger(command.epoch) ||
        command.epoch < epoch || !finite(command.deadline) || Date.now() > command.deadline) throw Error("stale command");
    sequence = command.seq;
    if (command.epoch !== epoch) { reset(); epoch = command.epoch; reported = null; }
    const data = command.data;
    if (command.op === "stop") { reset(); return null; }
    if (command.op === "prepare" || command.op === "hints" || command.op === "pointer") {
      if (![data.width, data.height].every(v => Number.isSafeInteger(v) && v > 0 && v <= 32768)) throw Error("invalid canvas");
      match = { width: data.width, height: data.height };
      if (command.op === "prepare" || command.op === "pointer") pointerOnly = data.enabled !== false;
      if (data.bounds != null && !rectangle(data.bounds)) throw Error("invalid placement");
      if (!drag && data.bounds) placement = data.bounds;
      if (!own(mini)) { setMini(null); workspace.windowList().forEach(added); }
      if (mini) {
        if (!drag && placement) { mini.frameGeometry = placement; placement = null; }
        if (data.hints) {
          mini.keepAbove = !!data.hints.alwaysOnTop;
          mini.onAllDesktops = !!data.hints.allWorkspaces;
          mini.skipTaskbar = !!data.hints.skipTaskbar;
          mini.skipPager = !!data.hints.skipTaskbar;
          mini.noBorder = true;
          if (data.hints.alwaysOnTop) workspace.raiseWindow(mini);
        }
        if (pointerOnly && workspace.activeWindow === mini) activated(mini);
      }
    } else if (command.op === "keyboard") {
      pointerOnly = false;
      drag = null;
      if (!own(mini) || mini.minimized || !mini.wantsInput) throw Error("Mini is not ready for input");
      workspace.activeWindow = mini;
    } else if (command.op === "drag") {
      if (!own(mini) || String(mini.internalId) !== data.id || !data.pointer ||
          ![data.pointer.x, data.pointer.y].every(finite) || !Array.isArray(data.areas) ||
          !data.areas.length || data.areas.length > 64 || data.areas.some(r => !rectangle(r.display) ||
            ![r.x, r.y, r.maxX, r.maxY].every(finite) || r.x > r.maxX || r.y > r.maxY)) throw Error("invalid drag");
      drag = { pointer: data.pointer, areas: data.areas,
        start: { x: mini.frameGeometry.x + data.pointer.x, y: mini.frameGeometry.y + data.pointer.y },
        moved: false, expires: Date.now() + 30000 };
      cursor();
      workspace.raiseWindow(mini);
    } else if (command.op === "endDrag") {
      const moved = drag ? drag.moved : null;
      drag = null;
      updateNear();
      const result = frame();
      if (result) result.moved = moved;
      return result;
    } else if (command.op === "proximity") {
      if (!Array.isArray(data.rects) || data.rects.length > 256 || data.rects.some(r =>
        ![r.left, r.top, r.width, r.height].every(finite) || r.width < 0 || r.height < 0) ||
        ![data.enter, data.exit].every(v => finite(v) && v >= 0 && v <= 2048)) throw Error("invalid proximity");
      proximity = data;
    } else throw Error("unsupported operation");
    updateNear();
    return frame();
  }
  function stop() {
    if (dead) return;
    reset(); dead = true; lease.stop();
    workspace.windowAdded.disconnect(added);
    workspace.windowRemoved.disconnect(removed);
    workspace.windowActivated.disconnect(activated);
    workspace.cursorPosChanged.disconnect(cursor);
  }
  function next(ack) {
    if (dead) return;
    lease.start(2000);
    callDBus(session.address, session.path, session.iface, "NextCommand", session.token, JSON.stringify(ack), function (text) {
      if (dead) return;
      let command;
      try { command = JSON.parse(text); } catch (error) { stop(); return; }
      let reply = { type: "ack", seq: 0, ok: true };
      if (command.op) {
        reply.seq = command.seq;
        reply.epoch = command.epoch;
        try { reply.value = apply(command); } catch (error) { reply.ok = false; reply.error = String(error); }
      }
      next(reply);
    });
  }
  lease.timeout.connect(stop);
  workspace.windowAdded.connect(added);
  workspace.windowRemoved.connect(removed);
  workspace.windowActivated.connect(activated);
  workspace.cursorPosChanged.connect(cursor);
  next({ type: "ready" });
};

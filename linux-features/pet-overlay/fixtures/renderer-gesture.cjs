"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { applyPetOverlayGestureRendererPatch } = require("../patch.js");
const fixture = fs.readFileSync(require.resolve("./native-renderer-gesture.js"), "utf8");

module.exports = function rendererGesture({ native = true, complete = async () => true, dispatch = () => {} } = {}) {
  const messages = [], calls = [], warnings = [], clicks = [];
  class Element { closest() { return null; } }
  class HTMLElement extends Element {
    setPointerCapture() {}
    hasPointerCapture() { return false; }
  }
  let serial = 0;
  const context = {
    Ii: { current: null }, Element, HTMLElement, Je: false, De: false, fe: false, We: null,
    Er() {}, qi() {}, A: () => clicks.push(true), U: {}, I: {},
    crypto: { randomUUID: () => `aaaaaaaa-aaaa-aaaa-aaaa-${String(++serial).padStart(12, "0")}` },
    console: { warn: (...args) => warnings.push(args) },
    Ct: { dispatchMessage(type, payload) { messages.push({ type, payload }); dispatch(type, payload); } },
    w: { avatarOverlay: { codexPetOverlayCompleteDrag: (...args) => { calls.push(args); return complete(...args); } } },
  };
  const patched = applyPetOverlayGestureRendererPatch(fixture);
  assert.equal(applyPetOverlayGestureRendererPatch(patched), patched);
  vm.runInNewContext(patched, context);
  context.receiveLayout({ layout: { codexPetOverlayNativeDrag: native } });
  const element = new HTMLElement();
  const event = { button: 0, pointerId: 1, target: element, currentTarget: element, preventDefault() {},
    clientX: 74, clientY: 74, screenX: 100, screenY: 100, timeStamp: 0, altKey: false };
  return { context, event, messages, calls, warnings, clicks,
    down: () => context.ga(event), up: released => context.ma({ ...event, timeStamp: 500 }, released ?? true) };
};

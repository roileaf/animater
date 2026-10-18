// A minimal DOM for driving scripts/ui/tour-engine.mjs under node:test: document.body, the cursor and
// caption elements, window listeners and PointerEvent. The caption's buttons are parsed from its
// innerHTML (only [data-tour="…"] buttons), so a test can read `disabled` and call `click()`.
export function installFakeDOM() {
  const keys = ["document", "window", "innerWidth", "innerHeight", "PointerEvent"];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const listeners = [], windowEvents = [];
  const body = { children: [], append(...els) { this.children.push(...els); } };
  const button = (attrs) => ({
    disabled: /\bdisabled\b/.test(attrs), onclick: null,
    removeAttribute(name) { if (name === "disabled") this.disabled = false; },
    click() { if (!this.disabled) this.onclick?.(); },
  });
  const element = () => {
    let html = "", buttons = new Map();
    const classes = new Set();
    const el = {
      className: "", style: {},
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
      get innerHTML() { return html; },
      set innerHTML(value) {
        html = value;
        buttons = new Map([...value.matchAll(/<button([^>]*)>/g)].flatMap(([, attrs]) => {
          const m = /data-tour="(\w+)"/.exec(attrs);
          return m ? [[m[1], button(attrs)]] : [];
        }));
      },
      querySelector(selector) { const m = /^\[data-tour="(\w+)"\]$/.exec(selector); return m ? buttons.get(m[1]) ?? null : null; },
      contains(target) { return target === el || [...buttons.values()].includes(target); },
      remove() { body.children = body.children.filter((c) => c !== el); },
    };
    return el;
  };
  globalThis.document = { createElement: element, body };
  globalThis.window = {
    addEventListener: (type, fn, options) => listeners.push({ type, fn, options }),
    removeEventListener: (type, fn) => { const i = listeners.findIndex((l) => l.type === type && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    dispatchEvent: (event) => { windowEvents.push(event.type); return true; },
  };
  globalThis.innerWidth = 1200;
  globalThis.innerHeight = 800;
  globalThis.PointerEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  // A real event always has these; a test can pass its own to watch them.
  const fire = (type, event) => {
    for (const m of ["preventDefault", "stopPropagation", "stopImmediatePropagation"]) event[m] ??= () => {};
    for (const l of listeners.filter((x) => x.type === type)) l.fn(event);
  };
  const find = (cls) => body.children.find((c) => c.className === cls) ?? null;
  return {
    body, listeners, windowEvents, fire,
    caption: () => find("an-tour-caption"),
    cursor: () => find("an-tour-cursor"),
    restore() { for (const k of keys) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; } },
  };
}

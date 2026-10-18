// "Show me" tours: a caption and a virtual mouse that demonstrates each step once on the real
// interface, at the user's pace. Next moves on once the step has been shown, Back returns to the
// step before (restoring the snapshot taken before it) and Replay shows this step again. Stop, Esc
// or a real click outside the caption ends the tour; `cleanup` then puts the editor back.
// Editors add their own primitives through `surface(hand)`: Flash its stage and time slider, the
// studio its timeline, path grid and settings dialog (flash-tour.mjs, finisher-tour.mjs).
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
export class Interrupted extends Error {}

export async function runTour({ root, steps, snapshot, restore, cleanup = () => {}, surface = () => ({}), lead = 700 }) {
  const cursor = document.createElement("div"), caption = document.createElement("div");
  cursor.className = "an-tour-cursor";
  cursor.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11-6.5 1.2 3.8 6.8-2.6 1.4-3.8-6.9L5 20z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  caption.className = "an-tour-caption";
  document.body.append(cursor, caption);

  let run = 0, ended = false, finish;
  const done = new Promise((r) => { finish = r; });
  const end = () => { if (ended) return; ended = true; run++; finish(); };
  const onPointer = (e) => { if (e.isTrusted && !caption.contains(e.target)) end(); };
  // Foundry's KeyboardManager listens on window in the bubble phase, and its "dismiss" binding
  // closes the window. This capture listener on window runs before it, so Esc only ends the tour.
  const onKey = (e) => { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); end(); };
  window.addEventListener("pointerdown", onPointer, { capture: true });
  window.addEventListener("keydown", onKey, { capture: true });

  // ---- the virtual hand (each demonstration has a run number; Back/Next/Replay/Stop interrupt it)
  let pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const place = (p, ms) => { cursor.style.transition = `transform ${ms}ms cubic-bezier(.4,.1,.2,1)`; cursor.style.transform = `translate(${p.x}px, ${p.y}px)`; pos = p; };
  place(pos, 0);
  const make = (id) => {
    let extra = {};
    const check = () => { if (id !== run) throw new Interrupted(); };
    const setDown = (on) => { if (on) cursor.classList.add("is-down"); else cursor.classList.remove("is-down"); };
    const pause = async (ms) => { await wait(ms); check(); };
    const moveTo = async (p, ms = 1100) => { check(); place(p, ms); await pause(ms + 120); };
    const press = async () => { setDown(true); await pause(220); setDown(false); };
    const click = async (selector) => {
      const el = root.querySelector(selector); if (!el) throw new Interrupted();
      el.scrollIntoView({ block: "nearest" }); await pause(150);
      await moveTo(center(el)); await press(); el.click(); await pause(500);
    };
    // `receiver` gets the moves and the release: window (Flash), or the dragged element itself
    // when the editor listens on it (the studio's keyframe dots). `cancel` is the event an
    // interrupted drag ends with: "pointercancel" tells the editor to commit nothing, because the
    // editor has already been put back by then.
    const drag = async (target, to, ms = 1600, { receiver = window, cancel = "pointerup" } = {}) => {
      if (!target) throw new Interrupted();
      const from = center(target);
      await moveTo(from);
      setDown(true);
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: from.x, clientY: from.y, button: 0, pointerId: 1 }));
      const steps = 30;
      let finished = false;
      try {
        for (let i = 1; i <= steps; i++) {
          check();
          const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
          place(p, ms / steps); await wait(ms / steps);
          receiver.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: p.x, clientY: p.y, button: 0, pointerId: 1 }));
        }
        finished = true;
      } finally {
        receiver.dispatchEvent(new PointerEvent(finished ? "pointerup" : cancel, { bubbles: true, clientX: pos.x, clientY: pos.y, button: 0, pointerId: 1 }));
        setDown(false);
      }
      await pause(500);
    };
    // An element that is not on screen yet: the surface's finder may reveal it (a tab, a dialog).
    const find = async (selector) => {
      let el = root.querySelector(selector);
      if (!el && extra.find) el = await extra.find(selector);
      if (!el) throw new Interrupted();
      return el;
    };
    const reach = async (selector) => {
      const el = await find(selector);
      el.scrollIntoView({ block: "nearest" }); await pause(150); await moveTo(center(el)); await press(); return el;
    };
    const choose = async (selector, value) => {
      const el = await reach(selector);
      el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); await pause(600);
    };
    const tick = async (selector) => { const el = await reach(selector); el.click(); await pause(600); };
    const type = async (selector, words) => {
      const el = await reach(selector);
      el.value = "";
      for (const ch of words) { el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true })); await pause(150); }
      el.dispatchEvent(new Event("change", { bubbles: true })); await pause(450);
    };
    // Drag a number field's label sideways, the way a hand scrubs a value.
    const scrubLabel = async (selector, dx) => {
      const input = await find(selector), label = input?.closest("label"); if (!label) throw new Interrupted();
      label.scrollIntoView({ block: "nearest" }); await pause(150);
      const r = label.getBoundingClientRect(), from = { x: r.left + 12, y: r.top + 6 };
      await moveTo(from); setDown(true);
      label.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: from.x, clientY: from.y, button: 0, pointerId: 1 }));
      try {
        for (let i = 1; i <= 24; i++) { check(); const p = { x: from.x + (dx * i) / 24, y: from.y }; place(p, 45); await wait(45); window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: p.x, clientY: p.y, button: 0, pointerId: 1 })); }
      } finally { window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: pos.x, clientY: pos.y, button: 0, pointerId: 1 })); setDown(false); }
      await pause(500);
    };
    const hand = { check, place, setDown, pause, moveTo, press, click, drag, find, choose, tick, type, scrubLabel };
    extra = surface(hand) ?? {};
    return { ...hand, ...extra, find };
  };

  const snapshots = [];
  let index = 0;
  const go = async (i, { replay = false } = {}) => {
    const id = ++run;
    index = i;
    if (replay || snapshots[i]) restore(snapshots[i]); else snapshots[i] = snapshot();
    caption.innerHTML = `<span class="an-tour-step">Step ${i + 1} of ${steps.length}</span><span class="an-tour-text">${steps[i].say}</span><span class="an-tour-nav"><button type="button" data-tour="back" ${i === 0 ? "disabled" : ""}>‹ Back</button><button type="button" data-tour="replay" title="Show this step again">↺</button><button type="button" data-tour="next" class="is-primary" disabled title="Available once this step has been shown">${i === steps.length - 1 ? "Finish" : "Next ›"}</button><button type="button" data-tour="stop" title="Stop the guide">✕</button></span>`;
    caption.querySelector('[data-tour="back"]').onclick = () => void go(index - 1, { replay: true });
    caption.querySelector('[data-tour="replay"]').onclick = () => void go(index, { replay: true });
    caption.querySelector('[data-tour="next"]').onclick = () => { if (index === steps.length - 1) return end(); void go(index + 1); };
    caption.querySelector('[data-tour="stop"]').onclick = end;
    // Next waits until the step has been shown, so a step is never left half done.
    try { await wait(lead); if (id === run) await steps[i].show(make(id)); } catch (error) { if (!(error instanceof Interrupted)) end(); }
    if (id === run) { const next = caption.querySelector('[data-tour="next"]'); if (next) { next.disabled = false; next.removeAttribute("title"); } }
  };
  void go(0);
  await done;

  window.removeEventListener("pointerdown", onPointer, { capture: true });
  window.removeEventListener("keydown", onKey, { capture: true });
  cursor.remove(); caption.remove();
  await cleanup();
}

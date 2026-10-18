// Drives a finisher tour step without a browser: each hand method checks that its selectors match
// exactly one element in the studio HTML as it stands right now (studioHTML for the draft), then
// performs the step through the workspace's real handlers (onClick, onChange), as the click or the
// change event would. `hand.used` records every selector, so a test can compare it with the step's
// declared `targets`.
import { studioHTML } from "../../scripts/ui/studio.mjs";
import { normalizeKeyframes, moveKeyframePoint } from "../../scripts/engines/motion/keyframe-path.mjs";
import { SEL, kfDot } from "../../scripts/ui/finisher-tour.mjs";

// Every element in `html` matching a compound selector: tag, .class, [attr] and [attr="value"].
// Combinators are not supported (tour selectors are compound on purpose).
export function findInHTML(html, selector) {
  const m = /^([a-z][a-z0-9-]*)?((?:\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(selector.trim());
  if (!m || !selector.trim()) throw Error(`Unsupported selector (compound only): ${selector}`);
  // Classes come from outside the [attr="…"] parts, so the dot in finisher.on is not a class.
  const tag = m[1]?.toLowerCase(), classes = [...m[2].replace(/\[[\w-]+(?:="[^"]*")?\]/g, "").matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  const wants = [...m[2].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map((x) => [x[1].toLowerCase(), x[2]]);
  const found = [];
  for (const t of html.matchAll(/<([a-z][a-z0-9-]*)((?:\s+[^\s=>"'/]+(?:="[^"]*")?)*)\s*\/?>/gi)) {
    const name = t[1].toLowerCase();
    const attrs = Object.fromEntries([...t[2].matchAll(/([^\s=>"'/]+)(?:="([^"]*)")?/g)].map((a) => [a[1].toLowerCase(), a[2] ?? ""]));
    if (tag && name !== tag) continue;
    const cls = (attrs.class ?? "").split(/\s+/);
    if (!classes.every((c) => cls.includes(c))) continue;
    if (!wants.every(([k, v]) => k in attrs && (v === undefined || attrs[k] === v))) continue;
    const end = t.index + t[0].length;
    found.push({ tag: name, attrs, inner: name === "select" ? html.slice(end, html.indexOf("</select>", end)) : "" });
  }
  return found;
}

export const dataset = (attrs) => Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith("data-"))
  .map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v]));

export function headlessHand(w) {
  const used = [];
  const one = (selector) => {
    used.push(selector);
    const found = findInHTML(studioHTML(w, w.recipe()), selector);
    if (found.length !== 1) throw Error(`${selector} matched ${found.length} elements in the studio`);
    return found[0];
  };
  const live = (selector) => { const el = one(selector); if ("disabled" in el.attrs) throw Error(`${selector} is disabled`); return el; };
  const click = async (selector) => {
    const el = live(selector);
    await w.onClick({ target: { closest: () => ({ dataset: dataset(el.attrs), disabled: false }) }, preventDefault() {} });
  };
  const choose = async (selector, value) => {
    const el = live(selector);
    if (el.tag === "select" && !el.inner.includes(`value="${value}"`)) throw Error(`${selector} has no option "${value}"`);
    const type = el.attrs.type ?? (el.tag === "select" ? "select-one" : el.tag);
    w.onChange({ target: { dataset: dataset(el.attrs), type, value: String(value), checked: Boolean(value), hasAttribute: (n) => n in el.attrs, closest: () => null, matches: () => false } });
  };
  return {
    used, click, choose, type: choose,
    pause: async () => {}, moveTo: async () => {}, press: async () => {},
    openSettings: async () => { if (!w.studioSettings) await click(SEL.settingsOpen); },
    closeSettings: async () => { if (w.studioSettings) await click(SEL.settingsClose); },
    pointAt: async (selector) => { one(selector); },
    scrubTo: async (ms) => { one(SEL.ruler); one(SEL.timeline); w.studioTime = ms; },
    // What studioPointer's drag of a keyframe dot ends with: the point moved, that keyframe selected.
    dragKeyframe: async (i, x, y) => {
      one(SEL.canvas); one(kfDot(i));
      const kfs = normalizeKeyframes(w.recipe().stages[w.stageIndex].keyframes);
      w.edit().stages[w.stageIndex].keyframes = moveKeyframePoint(kfs, i, x, y, false);
      w.keyframeIndex = i; w.keyframeFocus = true;
    },
  };
}

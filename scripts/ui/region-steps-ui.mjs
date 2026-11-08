// The steps list the GM edits in its own window (engines/motion/region-steps.mjs), and the helpers the region panel shares.
// It saves to the region's flags, which reach every screen.

import { FLOORS } from '../engines/motion/movement-feel.mjs';
import { STEP_EDGE, STEP_SCALE, stepScale, STEP_STRENGTH, STEP_EFFECTS, STEP_LOOK_NAMES, TEXTURE_STYLES, textureFloor, textureStyleOf, STEP_SECONDS, defaultSteps, setStepStrength, stepEdge, stepStrength, stepIndexOf, stepListOf, stepMenu } from '../engines/motion/region-steps.mjs';

// (Nothing to capitalise gives nothing.)
export const titled = (text) => { const s = String(text ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); };
const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const button = (text, className, click) => { const b = element('button', className, text); b.type = 'button'; b.addEventListener('click', click); return b; };
// The regions at one spot as tabs (pure): the one to open first (`first`, a doc) leading, each named for itself, its floor
// added where two would read alike (its place in the list, when it has no floor either). `list` [{ doc, floor }].
export const stepTabs = (list = [], first = null) => {
  const ordered = [...list.filter((r) => r.doc === first), ...list.filter((r) => r.doc !== first)];
  const nameOf = (r) => r.doc.name || (r.floor ? `${titled(r.floor)} region` : 'Region'), count = new Map();
  for (const r of ordered) count.set(nameOf(r), (count.get(nameOf(r)) ?? 0) + 1);
  return ordered.map((r, i) => ({ doc: r.doc, floor: r.floor, name: count.get(nameOf(r)) > 1 ? `${nameOf(r)} (${r.floor ? titled(r.floor) : i + 1})` : nameOf(r) }));
};
// A tick box with its words beside it.
const tick = (label, checked, change) => {
  const row = element('label', 'an-step-check'), box = element('input'); box.type = 'checkbox'; box.checked = checked;
  box.addEventListener('change', () => change(box.checked));
  row.append(box, element('span', '', label));
  return row;
};
// A slider saved when let go, so a drag does not redraw the region at every step.
const slider_ = (label, range, value, words, change, step = 0.1) => {
  const row = element('label', 'an-step-slider'), name = element('span', '', label), slider = element('input'), shown = element('span', 'an-step-value');
  slider.type = 'range'; slider.min = String(range.min); slider.max = String(range.max); slider.step = String(step); slider.value = String(value);
  const say = () => { shown.textContent = words(Number(slider.value)); };
  say();
  slider.addEventListener('input', say);
  slider.addEventListener('change', () => change(Number(slider.value)));
  row.append(name, slider, shown);
  return row;
};
const edgeSlider = (value, change) => slider_('Edge softness', STEP_EDGE, value, (v) => v.toFixed(1), change);
// Soft or hard: hard is the region's own line. How soft it was is kept for when it comes back on.
const edgeControls = (own, act) => { const soft = own.stepEdgeOff !== true, row = [tick('Soft edge', soft, (on) => act({ stepEdgeOff: !on }))]; if (soft) row.push(edgeSlider(stepEdge(own), (value) => act({ stepEdge: value }))); return row; };
// How much of the look this step puts down.
const strengthSlider = (value, change) => slider_('Look strength', STEP_STRENGTH, value, (v) => `${Math.round(v * 100)}%`, change);
// How big its pattern is: smaller for more of it, more panes of glass, more stones.
const scaleSlider = (value, change) => slider_('Pattern size', STEP_SCALE, value, (v) => `${Math.round(v * 100)}%`, change, 0.05);
// A floor's texture styles, for the floor the region is on now.
const styleChoice = (own, floor, save, make) => {
  const now = textureFloor(own, floor), row = element('label', 'an-step-slider', 'Texture style ');
  row.append(make(TEXTURE_STYLES[now] ?? [], textureStyleOf(own, now), 'Texture style', (value) => save({ textureStyles: { ...(own.textureStyles ?? {}), [now]: value } })));
  return row;
};
// A drop-down of [value, label, group?] options. (The region panel builds its drop-downs with it too.)
export const choice = (options, value, label, change) => {
  const select = element('select'); select.setAttribute('aria-label', label);
  const groups = new Map();
  for (const [v, l, group] of options) {
    const o = element('option', '', l); o.value = v; o.selected = v === value;
    if (!group) { select.append(o); continue; }
    if (!groups.has(group)) { const g = element('optgroup'); g.label = group; groups.set(group, g); select.append(g); }
    groups.get(group).append(o);
  }
  select.addEventListener('change', () => change(select.value));
  return select;
};

/** The list of a region's steps: returns its element. Saves as it goes. */
export function stepsEditor({ doc, floor, flagsOf, save, season = () => false }) {
  const box = element('div', 'an-step-editor');
  const listNow = () => stepListOf(flagsOf(doc) ?? {}, floor).map((s) => ({ ...s }));
  const keep = (steps, more = {}) => Promise.resolve(save(doc, { steps, stepsFloor: floor, stepsEdited: true, ...more })).then(draw, draw);
  const floors = FLOORS.map((f) => [f, titled(f)]);
  function draw() {
    const own = flagsOf(doc) ?? {}, list = listNow(), current = stepIndexOf(own, floor), rows = element('div', 'an-step-rows');
    list.forEach((step, i) => {
      const row = element('div', `an-step-row${i === current ? ' an-step-current' : ''}`);
      const set = (key, value) => { list[i] = { ...list[i], [key]: value }; keep(list); };
      const name = element('input'); name.type = 'text'; name.value = step.name; name.setAttribute('aria-label', `Step ${i + 1} name`);
      name.addEventListener('change', () => set('name', name.value.trim() || `Step ${i + 1}`));
      row.append(element('span', 'an-step-num', String(i + 1)), name,
        choice(STEP_LOOK_NAMES, step.look, `Step ${i + 1} look`, (v) => set('look', v)),
        choice(floors, step.walks, `Step ${i + 1} walks as`, (v) => set('walks', v)),
        choice(STEP_EFFECTS, step.effect ?? '', `Step ${i + 1} effect`, (v) => set('effect', v)));
      const remove = button('×', 'an-step-remove', () => { list.splice(i, 1); keep(list, { step: Math.max(0, current >= list.length ? list.length - 1 : i < current ? current - 1 : current) }); });
      remove.disabled = list.length < 2; remove.setAttribute('aria-label', `Remove step ${step.name}`);
      row.append(remove); rows.append(row);
    });
    const add = button('Add a step', '', () => { list.push({ name: `Step ${list.length + 1}`, look: 'none', walks: floor, effect: '' }); keep(list); });
    const reset = button(`Back to the ${floor} list`, '', () => keep(defaultSteps(floor), { step: 0, stepHidden: false, stepsEdited: false }));
    const how = element('label', 'an-step-how', 'How it changes ');
    how.append(choice([['spread', own.flowTo ? 'Spreads from upstream' : 'Spreads from where you click'], ['fade', 'Fades everywhere']], own.stepHow === 'fade' ? 'fade' : 'spread', 'How it changes', (v) => save(doc, { stepHow: v })));
    const takes = element('label', 'an-step-how', 'Takes ');
    const seconds = Number(own.stepSeconds);
    takes.append(choice([['0', 'At once'], ['3', '3 seconds'], ['6', '6 seconds'], ['12', '12 seconds']], String(Number.isFinite(seconds) ? seconds : STEP_SECONDS), 'How long it takes', (v) => save(doc, { stepSeconds: Number(v) })));
    const painted = element('label', 'an-step-how', 'Floor texture ');
    painted.append(choice([['', 'As the scene says'], ['on', 'Paint it'], ['off', 'Don\'t paint it']], own.texture === 'on' || own.texture === 'off' ? own.texture : '', 'Floor texture', (v) => save(doc, { texture: v })));
    const foot = element('div', 'an-step-foot'); foot.append(add, reset, how, takes, painted, styleChoice(own, floor, (flags) => Promise.resolve(save(doc, flags)).then(draw, draw), choice), scaleSlider(stepScale(own), (value) => Promise.resolve(save(doc, { stepScale: value })).then(draw, draw)), ...edgeControls(own, (flags) => Promise.resolve(save(doc, flags)).then(draw, draw)));
    if (list[current]?.look && list[current].look !== 'none') foot.append(strengthSlider(stepStrength(list[current]), (value) => Promise.resolve(save(doc, setStepStrength(own, floor, value))).then(draw, draw)));
    if (stepMenu(own, floor).grassy) foot.append(tick('Affected by season', season(own), (on) => Promise.resolve(save(doc, { season: on ? 'on' : 'off' })).then(draw, draw)));
    const heads = element('div', 'an-step-row an-step-heads');
    heads.append(element('span'), element('span', '', 'Name'), element('span', '', 'Look on the floor'), element('span', '', 'Walks as'), element('span', '', 'Effect it switches on'), element('span'));
    const intro = element('p', 'an-step-intro', 'Right-click this region on the map to move through these steps. Every change here is saved at once.');
    box.replaceChildren(intro, heads, rows, foot);
  }
  draw();
  return box;
}

// One window per region, opened from the right-click menu or Region configuration.
const windows = new Map();
export function openStepsWindow(ApplicationV2, { id, doc, floor, flagsOf, save, season }) {
  const had = windows.get(doc.id);
  if (had?.rendered) { had.bringToFront(); return had; }
  class StepsWindow extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-steps-${doc.id}`, classes: ['animater-steps-window'],
      window: { title: `Steps: ${doc.name || floor}`, icon: 'fa-solid fa-layer-group', resizable: true },
      position: { width: 760, height: 'auto' },
    };
    async _renderHTML() { return stepsEditor({ doc, floor, flagsOf, save, season }); }
    _replaceHTML(html, content) { content.replaceChildren(html); }
    _onClose(options) { super._onClose?.(options); windows.delete(doc.id); }
  }
  const app = new StepsWindow();
  windows.set(doc.id, app);
  app.render(true);
  return app;
}
// Another way of moving the step (the map's menu, another GM) shows in an open window.
export function refreshStepsWindow(id) { const app = windows.get(id); if (app?.rendered) app.render(); }

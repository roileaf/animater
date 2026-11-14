import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../../scripts/ui/region-panel-sections.mjs';
import { panelSections } from '../../scripts/ui/region-panel-model.mjs';
import { iceSettingsOf } from '../../scripts/engines/regions/thin-ice.mjs';

// Thin ice in the region panel: the GM turns it on for one water region, says what it holds, and puts it back whole.
// The controls are built and clicked here; nothing reads the panel's source text.

const fakeDom = () => {
  const make = (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', children: [], attrs: {}, listeners: {}, style: {}, value: '', type: '', selected: false,
    append(...k) { for (const c of k) if (typeof c === 'object') this.children.push(c); }, setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); } });
  globalThis.document = { createElement: make };
};
const walk = function* (n) { yield n; for (const c of n.children ?? []) yield* walk(c); };
const all = (parts, pred) => parts.flatMap((p) => [...walk(p)]).filter(pred);
const labelled = (parts, label) => all(parts, (n) => n.attrs?.['aria-label'] === label)[0];
const named = (parts, text) => all(parts, (n) => n.tagName === 'BUTTON' && n.textContent === text)[0];
const click = (node) => node.listeners.click?.[0]?.();
const pick = (select, value) => { select.value = value; select.listeners.change?.[0]?.(); };

// The water section as the panel builds it.
const water = ({ own = {}, refreezeIce = () => {} } = {}) => {
  fakeDom();
  const acts = [], doc = { id: 'reg1' };
  const c = { doc, own, floor: 'water', kind: 'water', act: (f) => acts.push(f), toFloor: () => {}, more: () => [], texture: () => false, season: () => false, fireSpreads: () => false, refreezeIce };
  return { parts: SECTIONS.water(c), acts, doc };
};
const ground = (own = {}) => {
  fakeDom();
  const c = { doc: { id: 'reg1' }, own, floor: 'grass', kind: 'ground', act: () => {}, toFloor: () => {}, more: () => [], texture: () => false, season: () => false, fireSpreads: () => false, refreezeIce: () => {} };
  return SECTIONS.ground(c);
};

test('Thin ice is offered on a water region and is off until the GM turns it on', () => {
  const { parts, acts } = water();
  const toggle = labelled(parts, 'Thin ice');
  assert.ok(toggle, 'the water section offers it');
  assert.equal(toggle.attrs['aria-checked'], 'false', 'off by default: a map-specific feature the GM opts into');
  click(toggle);
  assert.deepEqual(acts.pop(), { iceThin: true });
  assert.equal(labelled(water({ own: { iceThin: true } }).parts, 'Thin ice').attrs['aria-checked'], 'true');
});

test('Holds up to and Refreeze appear only once thin ice is on', () => {
  const off = water().parts;
  assert.equal(labelled(off, 'Holds up to'), undefined);
  assert.equal(named(off, 'Refreeze'), undefined);
  const on = water({ own: { iceThin: true } }).parts;
  assert.ok(labelled(on, 'Holds up to'));
  assert.ok(named(on, 'Refreeze'));
});

test('Holds up to offers Small, Medium and Large, Medium chosen, and saves the size picked', () => {
  const { parts, acts } = water({ own: { iceThin: true } });
  const menu = labelled(parts, 'Holds up to');
  assert.deepEqual(menu.children.map((o) => [o.value, o.textContent]), [['sm', 'Small'], ['med', 'Medium'], ['lg', 'Large']]);
  assert.deepEqual(menu.children.filter((o) => o.selected).map((o) => o.value), ['med'], 'Medium until the GM says otherwise');
  pick(menu, 'lg');
  assert.deepEqual(acts.pop(), { iceHolds: 'lg' });
});

test('a size the panel does not offer is still shown as chosen, never silently collapsed', () => {
  const menu = labelled(water({ own: { iceThin: true, iceHolds: 'huge' } }).parts, 'Holds up to');
  assert.deepEqual(menu.children.filter((o) => o.selected).map((o) => o.value), ['huge']);
  assert.equal(iceSettingsOf({ flags: { animater: { iceHolds: 'huge' } } }).holds, 'huge', 'and the reader keeps reading it');
});

test('Refreeze asks the panel to put this region\'s ice back', () => {
  const asked = [];
  const { parts, doc } = water({ own: { iceThin: true }, refreezeIce: (d) => asked.push(d) });
  click(named(parts, 'Refreeze'));
  assert.deepEqual(asked, [doc]);
});

test('thin ice is offered only where the region is water', () => {
  assert.equal(labelled(ground(), 'Thin ice'), undefined, 'not on open ground');
  assert.equal(labelled(ground({ iceThin: true }), 'Thin ice'), undefined);
  const has = (kind) => panelSections(kind, {}, undefined).some((s) => s.id === 'water');
  assert.equal(has('water'), true);
  for (const kind of ['ground', 'indoors', 'cave', 'lava', 'deck', 'none']) assert.equal(has(kind), false, `${kind} has no water section`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS } from '../../scripts/ui/region-panel-sections.mjs';
import { panelSections, summaryOf, kindFlags } from '../../scripts/ui/region-panel-model.mjs';
import { iceSettingsOf, holdsUp, SIZES } from '../../scripts/engines/regions/thin-ice.mjs';
import { activeStep } from '../../scripts/engines/motion/region-steps.mjs';

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

test('Holds up to offers every size the system knows, in its own order, Medium chosen, and saves the size picked', () => {
  const { parts, acts } = water({ own: { iceThin: true } });
  const menu = labelled(parts, 'Holds up to');
  assert.deepEqual(menu.children.map((o) => [o.value, o.textContent]),
    [['tiny', 'Tiny'], ['sm', 'Small'], ['med', 'Medium'], ['lg', 'Large'], ['huge', 'Huge'], ['grg', 'Gargantuan']],
    'the menu answers to the size on an actor sheet, not to a guess at which sizes a table meets');
  assert.deepEqual(menu.children.filter((o) => o.selected).map((o) => o.value), ['med'], 'Medium until the GM says otherwise');
  pick(menu, 'lg');
  assert.deepEqual(acts.pop(), { iceHolds: 'lg' });
});

test('every size the menu offers can be chosen and is read back', () => {
  for (const size of ['tiny', 'sm', 'med', 'lg', 'huge', 'grg']) {
    const { parts, acts } = water({ own: { iceThin: true } });
    pick(labelled(parts, 'Holds up to'), size);
    assert.deepEqual(acts.pop(), { iceHolds: size });
    assert.equal(iceSettingsOf({ flags: { animater: { iceHolds: size } } }).holds, size);
  }
});

test('ice that holds the biggest thing there is holds everyone, rather than breaking under nobody by accident', () => {
  const menu = labelled(water({ own: { iceThin: true, iceHolds: 'grg' } }).parts, 'Holds up to');
  assert.deepEqual(menu.children.filter((o) => o.selected).map((o) => o.value), ['grg']);
  assert.equal(holdsUp('grg', 'grg'), 0, 'nothing is over the limit');
  assert.equal(holdsUp('tiny', 'grg'), 2, 'and the other end still gives way at once');
});

test('the menu and the reader cannot fall out of step: every size offered is one the reader keeps', () => {
  const offered = labelled(water({ own: { iceThin: true } }).parts, 'Holds up to').children.map((o) => o.value);
  for (const size of offered) assert.equal(iceSettingsOf({ flags: { animater: { iceHolds: size } } }).holds, size, size + ' is offered but not read back');
  assert.deepEqual(offered, SIZES, 'and the menu is the size list itself, not a copy of it that can drift');
});

test('a size nobody knows falls back to Medium rather than leaving the menu blank', () => {
  const menu = labelled(water({ own: { iceThin: true, iceHolds: 'colossal' } }).parts, 'Holds up to');
  assert.deepEqual(menu.children.filter((o) => o.selected).map((o) => o.value), ['med']);
  assert.equal(iceSettingsOf({ flags: { animater: { iceHolds: 'colossal' } } }).holds, 'med', 'the reader says the same');
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

// The Steps section as the panel builds it for the same region.
const steps = (own = {}) => {
  fakeDom();
  const acts = [];
  const c = { doc: { id: 'reg1' }, own, floor: 'water', kind: 'water', at: null, act: (f) => acts.push(f), toFloor: () => {}, more: () => [], texture: () => false, season: () => false, fireSpreads: () => false, close: () => {}, edit: () => {} };
  return { parts: SECTIONS.steps(c), acts };
};
const text = (parts) => all(parts, (n) => typeof n.textContent === 'string').map((n) => n.textContent).join(' | ');

test('with thin ice on, the Steps section offers nothing to pick or hide: thin ice is the step', () => {
  // Every reader goes by the frozen step while thin ice is on, so a step chip or "Hide this step" here would be a
  // control the region throws away.
  const { parts, acts } = steps({ floor: 'water', iceThin: true });
  assert.equal(labelled(parts, 'Hide this step'), undefined, 'no dead toggle');
  assert.equal(named(parts, 'Clear'), undefined, 'and no step to pick');
  assert.equal(named(parts, 'Frozen over'), undefined);
  assert.equal(named(parts, 'Edit steps…'), undefined);
  assert.match(text(parts), /Thin ice sets this region's step/, 'it says why instead');
  assert.deepEqual(acts, [], 'and nothing was saved by building it');
  assert.equal(summaryOf('steps', { floor: 'water', iceThin: true, steps: [{ name: 'Clear', look: 'none', walks: 'water' }], step: 0 }, 'water'), 'Frozen over · thin ice',
    'the heading names the step the region is really on');
});

test('without thin ice the Steps section is untouched', () => {
  const { parts } = steps({ floor: 'water', steps: [{ name: 'Clear', look: 'none', walks: 'water' }, { name: 'Murky', look: 'murky', walks: 'water' }], stepsFloor: 'water', step: 1 });
  assert.ok(named(parts, 'Clear'), 'the water list is there to pick from');
  assert.ok(named(parts, 'Edit steps…'));
  assert.ok(labelled(parts, 'Hide this step'), 'and a step showing can be hidden');
});

// The hover explanation on the row a control sits in (tip(), which puts it on the row, not the switch).
const hintOf = (parts, label) => {
  const control = labelled(parts, label);
  for (const part of parts) for (const node of walk(part)) if (node.attrs?.['data-tooltip'] && [...walk(node)].includes(control)) return node.attrs['data-tooltip'];
  return '';
};

test('the Thin ice tooltip says fire melts it, and that the melt waits on Breakable props', () => {
  const said = hintOf(water().parts, 'Thin ice');
  assert.match(said, /fire area melts/i, 'a GM reads what fire does to it');
  assert.match(said, /Breakable props/, 'and that the melt waits on that scene setting');
  assert.match(said, /steps are not used/, 'and that it takes the region over from its own steps');
});

test('taking a region out of the water takes its thin ice with it', () => {
  // The switch lives among the water controls alone. Left on, the region would go on walking as ice, drawing cracks and
  // holes of dark water on grass, with nothing on screen to turn it off again.
  for (const kind of ['ground', 'indoors', 'cave', 'lava', 'deck']) {
    assert.equal(kindFlags(kind, { floor: 'water', iceThin: true }).iceThin, false, `${kind} leaves the water`);
  }
  assert.equal(kindFlags('water', { floor: 'grass', iceThin: true }).iceThin, undefined, 'coming back to water leaves it as it was');
  assert.equal(kindFlags('ground', { floor: 'water' }).iceThin, undefined, 'a region that never had it is not written to');
  assert.ok('-=iceThin' in kindFlags('none', { floor: 'water', iceThin: true }), 'and None takes every Animater flag off, this one with them');
});

test('a region given another floor stops being thin ice, flag or no flag', () => {
  // Defence behind the save above, for a flag set by hand or left by an older world: the behaviour goes with the water.
  assert.equal(iceSettingsOf({ flags: { animater: { iceThin: true, floor: 'water' } } }).thin, true);
  assert.equal(iceSettingsOf({ flags: { animater: { iceThin: true, floor: 'grass' } } }).thin, false);
  assert.equal(activeStep({ iceThin: true, floor: 'water' })?.look, 'frozen', 'water: the frozen step takes the region over');
  assert.equal(activeStep({ iceThin: true, floor: 'grass' }), null, 'grass: its own steps again, and no step saved means none');
  const grassy = { iceThin: true, floor: 'grass', steps: [{ name: 'Fresh', look: 'none', walks: 'grass' }, { name: 'Burnt', look: 'burnt', walks: 'dirt' }], stepsFloor: 'grass', step: 1 };
  assert.equal(activeStep(grassy)?.name, 'Burnt', 'and a list it does have is its own again');
  assert.match(summaryOf('steps', grassy, 'grass'), /^Burnt/, 'the heading names that step, not a frozen one');
});

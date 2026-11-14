import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTIONS } from '../../scripts/ui/region-panel-sections.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fakeDom = () => {
  const make = (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', children: [], attrs: {}, listeners: {}, style: {}, value: '', type: '',
    append(...k) { for (const c of k) if (typeof c === 'object') this.children.push(c); }, setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); } });
  globalThis.document = { createElement: make };
};
const walk = function* (n) { yield n; for (const c of n.children ?? []) yield* walk(c); };
const all = (parts, pred) => parts.flatMap((p) => [...walk(p)]).filter(pred);
const burnsToggle = (parts) => all(parts, (n) => n.attrs?.['aria-label'] === 'Burns')[0];

// The ground section as the panel builds it, with the scene's Fire spreads on or off.
const ground = ({ own = {}, floor = 'grass', fire = true } = {}) => {
  fakeDom();
  const acts = [];
  const c = { own, floor, kind: 'ground', act: (f) => acts.push(f), toFloor: () => {}, more: () => [], texture: () => false, season: () => false, fireSpreads: () => fire };
  return { parts: SECTIONS.ground(c), acts };
};

test('Burns is only offered when the scene has Fire spreads on', () => {
  assert.ok(burnsToggle(ground({ fire: true }).parts));
  assert.equal(burnsToggle(ground({ fire: false }).parts), undefined);
});

test('Burns is on for grass and field floors and off otherwise, until the region says', () => {
  const on = (opts) => burnsToggle(ground(opts).parts).attrs['aria-checked'];
  assert.equal(on({ floor: 'grass' }), 'true');
  assert.equal(on({ floor: 'field' }), 'true');
  assert.equal(on({ floor: 'stone' }), 'false');
  assert.equal(on({ floor: 'grass', own: { burns: false } }), 'false');
  assert.equal(on({ floor: 'stone', own: { burns: true } }), 'true');
});

test('ticking Burns saves flags.animater.burns, and the hint is in the panel\'s voice', () => {
  const { parts, acts } = ground({ floor: 'grass' });
  const box = burnsToggle(parts);
  box.listeners.click?.[0]?.({ target: box, preventDefault() {} });
  assert.deepEqual(acts.pop(), { burns: false });
  assert.match(read('scripts/ui/region-panel-sections.mjs'), /'Burns', [^\n]*'Fire runs through the grass here, square by square\.'/);
});

test('the panel passes the scene\'s Fire spreads on to its sections', () => {
  assert.match(read('scripts/ui/region-panel.mjs'), /fireSpreads = \(\) => false/);
  assert.match(read('scripts/ui/region-panel.mjs'), /const c = \{[^\n]*\bfireSpreads\b/);
});

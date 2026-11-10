import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorPropRows } from '../../scripts/ui/decor-prop-options.mjs';
import { SECTIONS } from '../../scripts/ui/region-panel-sections.mjs';
import { CONTENT_LABELS, MATERIAL_LABELS } from '../../scripts/ui/prop-config.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fakeDom = () => {
  const make = (tag) => ({ tagName: tag.toUpperCase(), className: '', textContent: '', children: [], attrs: {}, listeners: {}, style: {}, value: '', type: '',
    append(...k) { for (const c of k) if (typeof c === 'object') this.children.push(c); }, setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); } });
  globalThis.document = { createElement: make };
};
const walk = function* (n) { yield n; for (const c of n.children ?? []) yield* walk(c); };
const all = (parts, pred) => parts.flatMap((p) => [...walk(p)]).filter(pred);
const control = (parts, label) => all(parts, (n) => n.attrs?.['aria-label'] === label)[0];

test('the region popup: the six options under Decorations can break, only while it is on, each Automatic (by kind)', () => {
  fakeDom();
  const acts = [], doc = { parent: { flags: { animater: { breakableProps: true } } } };
  const c = (decor) => ({ own: { decor: { on: true, kinds: {}, ...decor } }, act: (f) => acts.push(f), doc, repairDecor: () => {} });
  assert.equal(control(SECTIONS.decor(c({})), 'Material'), undefined, 'off: none shown');
  const parts = SECTIONS.decor(c({ canBreak: true }));
  for (const label of ['Material', 'Breaks as', 'Contents', 'Light prop', 'Tips over']) {
    const sel = control(parts, label); assert.ok(sel, label);
    assert.equal(sel.children[0].textContent, 'Automatic (by kind)', label); assert.equal(sel.children[0].selected, true, label);
  }
  assert.equal(control(parts, 'Burst (squares)'), undefined, 'Burst only for Black powder');
  // The narrow column takes the short name; the long one leads its hint.
  assert.match(all(parts, (n) => n.attrs?.['data-tooltip']?.startsWith('Tips over instead of breaking: '))[0].attrs['data-tooltip'], /Knocked over whole/);
  // Under the switch, before Repair decorations.
  const order = all(parts, (n) => n.attrs?.['aria-label'] === 'Decorations can break' || n.attrs?.['aria-label'] === 'Material' || n.textContent === 'Repair decorations');
  assert.deepEqual(order.map((n) => n.attrs['aria-label'] ?? n.textContent), ['Decorations can break', 'Material', 'Repair decorations']);
  const contents = control(parts, 'Contents'); contents.value = 'wine'; contents.listeners.change[0]();
  assert.deepEqual(acts.pop(), { decor: { prop: { contents: 'wine' } } });
  contents.value = ''; contents.listeners.change[0]();
  assert.deepEqual(acts.pop(), { decor: { prop: { contents: '' } } }, 'back to Automatic');
  const powder = SECTIONS.decor(c({ canBreak: true, prop: { contents: 'powder', burst: 3 } }));
  const burst = control(powder, 'Burst (squares)'); assert.equal(burst.type, 'number'); assert.equal(burst.value, '3');
  burst.value = '9'; burst.listeners.change[0](); assert.deepEqual(acts.pop(), { decor: { prop: { burst: 4 } } });
  assert.equal(control(powder, 'Contents').children.find((o) => o.selected).textContent, 'Black powder');
});

test('the brush bar: only the options that apply to the picked kind, Automatic naming its default, the tile\'s own labels', () => {
  const keys = (kind) => decorPropRows(kind).map((r) => r.key);
  assert.deepEqual(keys('barrel'), ['material', 'style', 'contents', 'light']);
  assert.deepEqual(keys('brazier'), ['material', 'style', 'light', 'tips']);
  assert.deepEqual(keys('bush'), ['material', 'style', 'light']);
  assert.deepEqual(keys('rock'), [], 'never breaks: nothing offered');
  const barrel = Object.fromEntries(decorPropRows('barrel').map((r) => [r.key, r]));
  assert.equal(barrel.contents.options[0][1], 'Automatic (water)');
  assert.equal(barrel.material.options[0][1], 'Automatic (wood)');
  assert.equal(barrel.style.options[0][1], 'Automatic (shatter)');
  assert.equal(barrel.light.options[0][1], 'Automatic (no)');
  assert.deepEqual(barrel.contents.options.slice(1).map(([, l]) => l), Object.values(CONTENT_LABELS));
  assert.deepEqual(barrel.material.options.slice(1).map(([, l]) => l), Object.values(MATERIAL_LABELS));
  assert.equal(Object.fromEntries(decorPropRows('lampPost').map((r) => [r.key, r])).light.options[0][1], 'Automatic (yes)');
  assert.equal(decorPropRows('throne')[0].options[0][1], 'Automatic (as painted)');
  assert.deepEqual(decorPropRows('barrel', { contents: 'powder' }).map((r) => r.key), ['material', 'style', 'contents', 'burst', 'light']);
});

test('the brush bar remembers each kind\'s choices and the brush saves them on every entry it lays', async () => {
  const { brushPropFor, setBrushProp } = await import('../../scripts/ui/decor-brush-bar.mjs');
  assert.deepEqual(brushPropFor('barrel'), {});
  setBrushProp('barrel', 'contents', 'powder'); setBrushProp('barrel', 'burst', 3); setBrushProp('barrel', 'tips', 'yes');
  assert.deepEqual(brushPropFor('barrel'), { contents: 'powder', burst: 3 }, 'tips is not offered for a barrel');
  assert.deepEqual(brushPropFor('crate'), {}, 'per kind');
  setBrushProp('barrel', 'contents', '');
  assert.deepEqual(brushPropFor('barrel'), {}, 'Automatic again; Burst goes with the powder');
  const bar = read('scripts/ui/decor-brush-bar.mjs');
  assert.match(bar, /prop: brushPropFor\(kinds\[0\]\)/);
  assert.match(bar, /for \(const r of decorPropRows\(kind, remembered\.props\[kind\] \?\? \{\}\)\)/);
  const main = read('scripts/main.mjs');
  assert.match(main, /const withProp = \(d\) => \{ const prop = brushChoices\(\)\.prop;/);
  assert.match(main, /const d = withProp\(\{ \.\.\.g, x: Math\.round\(p\.x \+ g\.x\)/);
  assert.match(main, /const d = withProp\(stampDecor\(\{ x: p\.x, y: p\.y/);
});

test('the GM wires decorations into the tile paths: lights out, lamp oil fire, a powder blast from the decoration, Repair relights', () => {
  const main = read('scripts/main.mjs'), apply = main.slice(main.indexOf('async function applyDecorBreak'), main.indexOf('async function receiveDecorBreak'));
  assert.match(apply, /lights: sceneLights\(scene\), \.\.\.place, \.\.\.blastPlace\(cause, scene\)/);
  assert.ok(apply.indexOf('runBlastAt(') > apply.indexOf('await queueDecorWrite('), 'written broken before its blast, so a chain ends');
  assert.match(apply, /if \(check\.lightUpdates\?\.length\) await scene\.updateEmbeddedDocuments\("AmbientLight", check\.lightUpdates\)/);
  assert.match(apply, /if \(view && check\.fire\) await lightDecorFire\(scene, view, entry\.note\);/);
  assert.match(apply, /sourceId: view\.id \}\)/);
  assert.match(main, /const decor = decorIdParts\(cause\.sourceId\);/);
  assert.match(main, /decorSourceView\(region, cause\.sourceId, propGrid\(scene\), decorIndex\)/);
  assert.match(main, /async function runBlastAt\(scene, \{ centre, burst, levels, sourceId \}\)/);
  assert.match(main, /await relightDecor\(scene, \[regionDoc\]\);/);
  assert.match(main, /await relightDecor\(scene, \(scene\.regions\?\.contents \?\? \[\]\)\.filter/);
  assert.doesNotMatch(main, /[^\r]\n/, 'main.mjs keeps CRLF');
});

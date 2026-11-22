import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudLooks, hudSections, hudFilter, pushRecent, hudPaletteHTML, mountTokenshadeHud, lookKey, RECENT, MINE } from '../../scripts/ui/tokenshade-hud.mjs';

// Roi: "lets add tokenshade quick set on the token hud as a button".
const presets = [
  { name: 'Glow', library: 'tokenshade' }, { name: 'Attitude: Angry', library: 'tokenshade' }, { name: 'Marker: Ally', library: 'tokenshade' },
  { name: 'Fade in', library: 'tokenshade' }, { name: 'Breathing', library: 'tokenshade' }, { name: 'My aura', library: 'tokenshade-custom' },
  { name: 'Haunted ground', library: 'tokenshade-region' },
];
const params = { 'Fade in': [{ animated: { a: { animType: 'once' } } }], Breathing: [{ animated: { a: { animType: 'driven' } } }] };
const looks = hudLooks(presets, (_, name) => params[name] ?? []);

test('the picker offers lasting token looks only: no transitions, none that follow the game, no region looks', () => {
  assert.deepEqual(looks.map((l) => l.name), ['Glow', 'Attitude: Angry', 'Marker: Ally', 'My aura']);
  assert.equal(looks.find((l) => l.name === 'My aura').group, MINE);
});

test('sections: Recent once something was used, the studio\'s sections, then Mine; a search goes through all', () => {
  assert.deepEqual(hudSections(looks, []), ['Attitudes', 'Markers', 'Looks', MINE]);
  const recent = pushRecent(pushRecent([], 'tokenshade|Glow'), 'tokenshade-custom|My aura');
  assert.deepEqual(recent, ['tokenshade-custom|My aura', 'tokenshade|Glow']);
  assert.equal(hudSections(looks, recent)[0], RECENT);
  assert.deepEqual(hudFilter(looks, { section: RECENT, recent }).map((l) => l.name), ['My aura', 'Glow']);
  assert.deepEqual(hudFilter(looks, { section: 'Looks', query: 'ang' }).map((l) => l.name), ['Attitude: Angry']);
  assert.equal(pushRecent(Array.from({ length: 9 }, (_, i) => `k${i}`), 'new').length, 8);
});

test('the picker shows the looks on the token with a remove, and each look applies by its key', () => {
  const html = hudPaletteHTML({ looks, applied: [{ id: 'x1', name: 'Glow' }], section: 'Attitudes' });
  assert.match(html, /data-ts-remove="x1"[^>]*>Glow/);
  assert.match(html, new RegExp(`data-ts-apply="${lookKey(looks[1]).replace('|', '\\|')}"[^>]*>Angry<`));
  assert.match(html, /Search 4 looks/);
});

test('main adds it to the Token HUD for the GM or the token\'s owner, applying through the token\'s flags', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /Hooks\.on\("renderTokenHUD", \(hud, html\) => \{ mountShadeHud\(hud, html, "token"\); \}\);/);
  assert.match(main, /if \(!doc \|\| !root \|\| !\(game\.user\.isGM \|\| doc\.isOwner\)\) return;/);
  assert.match(main, /apply: async \(look\) => \{ try \{ await doc\.setFlag\(ID, APPLIED_FLAG, withApplied\(/);
  const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');
  assert.match(css, /:is\(#token-hud,#tile-hud,#drawing-hud\) \.an-tshud-palette\{/);
  assert.doesNotMatch(css, /#token-hud \.an-tshud/, 'every picker rule covers the three HUDs');
});

// Roi: the same looks on drawings and tiles, with the button in the Tile HUD and the Drawing HUD.
test('a tile is offered what a token is; a drawing all but the body forms, which need a body to grow from', () => {
  const more = [...presets, { name: 'Dragon Wings', library: 'tokenshade' }];
  const layers = { ...params, 'Dragon Wings': [{ filterType: 'wings' }] };
  const of = (host) => hudLooks(more, (_, name) => layers[name] ?? [], host).map((l) => l.name);
  assert.deepEqual(of('tile'), of('token'));
  assert.ok(of('tile').includes('Dragon Wings'));
  assert.deepEqual(of('drawing'), of('token').filter((n) => n !== 'Dragon Wings'));
  assert.deepEqual(of('nonsense'), of('token'));
});

test('the picker names what it is on', () => {
  const applied = [{ id: 'x1', name: 'Glow' }];
  assert.match(hudPaletteHTML({ looks, applied }), /On this token</);
  assert.match(hudPaletteHTML({ looks, applied, host: 'tile' }), /On this tile</);
  assert.match(hudPaletteHTML({ looks, applied, host: 'drawing' }), /On this drawing</);
});

// A Drawing HUD does not redraw itself when its drawing changes, so the picker reads the looks again and redraws.
test('the picker shows a look as soon as it is applied, with no help from the HUD', async () => {
  const el = (tag) => {
    const node = { tag, children: [], dataset: {}, listeners: {}, className: '', _html: '',
      classList: { add() {}, remove() {}, contains: () => false },
      append(child) { node.children.push(child); child.parent = node; }, remove() { node.parent.children = node.parent.children.filter((c) => c !== node); },
      addEventListener(type, fn) { node.listeners[type] = fn; },
      querySelector(sel) { return sel === '.col.left' ? node.col ?? null : node.children.find((c) => `.${c.className.split(' ').at(-1)}` === sel) ?? null; },
      set innerHTML(v) { node._html = v; }, get innerHTML() { return node._html; } };
    return node;
  };
  const doc = { createElement: el, activeElement: null }, root = el('div'), col = el('div');
  root.col = col;
  const on = [];
  const hud = mountTokenshadeHud(root, { tokenId: 'd1', host: 'drawing', looks, get applied() { return on; },
    apply: async (look) => { on.push({ id: 'n1', name: look.name }); }, remove: async () => { on.length = 0; }, preview: () => () => {}, recent: () => [], remember() {} }, doc);
  hud.button.listeners.click({ preventDefault() {}, stopPropagation() {} });
  const palette = col.children.at(-1);
  assert.doesNotMatch(palette.innerHTML, /On this drawing/);
  const click = (data) => palette.listeners.click({ preventDefault() {}, stopPropagation() {}, target: { closest: () => ({ dataset: data }) } });
  click({ tsApply: lookKey(looks[0]) });
  await new Promise((r) => setTimeout(r, 0));
  assert.match(palette.innerHTML, /On this drawing<\/div>.*data-ts-remove="n1"/s);
  click({ tsRemove: 'n1' });
  await new Promise((r) => setTimeout(r, 0));
  assert.doesNotMatch(palette.innerHTML, /data-ts-remove/);
  hud.close();
});

test('main puts the button on the Tile HUD and the Drawing HUD, and keeps their looks in step with their flags', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /Hooks\.on\("renderTileHUD", \(hud, html\) => \{ mountShadeHud\(hud, html, "tile"\); \}\);/);
  assert.match(main, /Hooks\.on\("renderDrawingHUD", \(hud, html\) => \{ mountShadeHud\(hud, html, "drawing"\); \}\);/);
  assert.match(main, /for \(const doc of appliedDocs\(canvas\?\.scene\)\) void appliedLooks\.sync\(doc\);/);
  assert.match(main, /for \(const name of APPLIED_ON\) \{/);
  assert.match(main, /Hooks\.on\(`delete\$\{name\}`, \(doc\) => \{ void appliedLooks\.drop\(doc\.id\); \}\);/);
});

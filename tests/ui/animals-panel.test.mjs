import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIMAL_GROUPS, BIRD_HEIGHT, MOST_PLACED, animalPreset, animalsPanelHtml, birdBodyOf, birdHeightOf, placedChanges, placedList, withPlaced, withoutPlaced } from '../../scripts/ui/animals-panel.mjs';
import { shadowFall } from '../../scripts/engines/motion/movement-feel.mjs';
import { createSoftShadows, highShadowLook, shadowSoftness } from '../../scripts/engines/motion/soft-shadow.mjs';

const rabbit = (id, x = 1, y = 2) => ({ id, kind: 'rabbit', x, y });

test('it offers every creature the scene already has a setting for', () => {
  const kinds = ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k)).sort();
  assert.deepEqual(kinds, ['bats', 'crawlers', 'deer', 'fish', 'foxes', 'frogs', 'insects', 'moths', 'owls', 'rabbits', 'rats', 'waterBirds', 'wildBirds', 'wolves', 'squirrels', 'snakes',
    'crows', 'hawks', 'herons', 'gulls', 'pigeons', 'hens', 'cats', 'dogs', 'cows', 'goats', 'sheep', 'pigs', 'horses'].sort());
});

test('crows, a hawk, herons and gulls can be chosen on their own; the town and farm come only when asked for', () => {
  const out = animalPreset('many');
  for (const k of ['crows', 'hawks', 'herons', 'gulls']) assert.equal(out[k], 'many', k);
  assert.match(animalsPanelHtml({ flags: {}, water: true, live: { hawks: 1 } }), /data-key="hawks" data-value="0"[\s\S]*?<output class="is-auto">1<\/output>/, 'a hawk flying shows as 1, not 0');
  assert.match(animalsPanelHtml({ flags: {}, water: true, live: {} }), /data-key="hawks" data-value="1"[\s\S]*?<output class="is-auto">0<\/output>/, 'none flying shows 0');
  assert.match(animalsPanelHtml({ flags: { hawks: '3' }, water: true }), /<output class="">3<\/output>/, 'a number set shows as set');
  for (const k of ['pigeons', 'hens', 'cats', 'dogs', 'cows', 'goats', 'sheep', 'pigs', 'horses']) assert.equal(k in out, false, `${k} only when asked for`);
  const html = animalsPanelHtml({ flags: {}, water: true });
  for (const label of ['Hawks', 'Crows', 'Herons', 'Gulls', 'Ducks', 'Pigeons', 'Cows']) assert.ok(html.includes(`>${label}<`), label);
});

test('a preset sets the outdoors and leaves dark places alone', () => {
  const out = animalPreset('many');
  assert.equal(out.rabbits, 'many');
  assert.equal(out.frogs, 'many');
  assert.equal('rats' in out, false);
  assert.equal('wolves' in out, false, 'wolves only when asked for');
  assert.equal(animalPreset('').deer, '', 'usual is the empty value the scene settings use');
});

test('placed animals are tidied, capped, and taken away last first', () => {
  assert.deepEqual(placedList(null), []);
  assert.deepEqual(placedList([rabbit('a'), { id: 'b', kind: 'dragon', x: 1, y: 1 }, { id: 'c', kind: 'fox', x: 'no', y: 1 }, { kind: 'fox', x: 1, y: 1 }]), [rabbit('a')]);
  let list = [];
  for (let i = 0; i < MOST_PLACED + 3; i++) list = withPlaced(list, rabbit(`r${i}`));
  assert.equal(list.length, MOST_PLACED);
  assert.equal(list[0].id, 'r3', 'the oldest go');
  const mixed = [rabbit('a'), { id: 'f', kind: 'fox', x: 0, y: 0 }, rabbit('b')];
  assert.deepEqual(withoutPlaced(mixed, 'rabbit').map((p) => p.id), ['a', 'f']);
  assert.deepEqual(withoutPlaced(mixed, 'rabbit', { all: true }).map((p) => p.id), ['f']);
  assert.deepEqual(withoutPlaced(mixed, 'deer').map((p) => p.id), ['a', 'f', 'b']);
});

test('each screen adds what it lacks and drops what has gone', () => {
  const { add, remove } = placedChanges(new Set(['a', 'old']), [rabbit('a'), rabbit('b')]);
  assert.deepEqual(add.map((p) => p.id), ['b']);
  assert.deepEqual(remove, ['old']);
});

test('bird height is per map, usual until set, and only where birds fly', () => {
  assert.equal(birdHeightOf(undefined), 1);
  assert.equal(birdHeightOf(''), 1);
  assert.equal(birdHeightOf(200), 2);
  assert.equal(birdHeightOf(9999), BIRD_HEIGHT.max / 100);
  assert.equal(birdHeightOf(1), BIRD_HEIGHT.min / 100);
  assert.ok(/data-size-key="birdHeight" min="25" max="300" step="5" value="100"/.test(animalsPanelHtml({ flags: {} })));
  assert.ok(/data-size-key="birdHeight"[^>]*value="150"/.test(animalsPanelHtml({ flags: { birdHeight: 150 } })));
  assert.ok(!animalsPanelHtml({ flags: {}, underground: true }).includes('birdHeight'));
});

test('a higher bird looks bigger, seen from above, and its shadow keeps its size', () => {
  assert.equal(birdBodyOf(undefined), 1, 'as it was until set');
  assert.equal(birdBodyOf(100), 1);
  assert.ok(Math.abs(birdBodyOf(300) - 1.3) < 1e-9);
  assert.ok(birdBodyOf(25) < 1 && birdBodyOf(25) > 0.85);
  const read = (name) => readFileSync(new URL(`../../scripts/engines/motion/${name}.mjs`, import.meta.url), 'utf8');
  assert.equal((read('wildlife').match(/\* birdBody,/g) ?? []).length, 4, 'songbird, hawk, crow, a lone bird between perches');
  assert.equal((read('pond-life').match(/\* birdBody,/g) ?? []).length, 3, 'duck, heron, gull');
  assert.equal((read('field-life').match(/\* birdBody,/g) ?? []).length, 1, 'owl');
  assert.ok(!/shadowOf\([^;]*birdBody/.test(read('pond-life')), 'the body only: shadows go by their own look');
});

test('a higher bird\'s shadow is wider, softer and fainter, and each flying bird has one', () => {
  const usual = highShadowLook(4, 1), high = highShadowLook(4, 3), low = highShadowLook(4, 0.25);
  assert.equal(usual.grow, 1); assert.equal(usual.fade, 1);
  assert.ok(Math.abs(high.grow - 1.3) < 1e-9, 'as much as the bird');
  assert.ok(high.fade < 0.65 && high.fade > 0.5);
  assert.ok(low.grow < 1); assert.equal(low.fade, 1);
  assert.equal(shadowSoftness(0.8), 0); assert.equal(shadowSoftness(2.5), 0, 'crisp while low'); assert.equal(shadowSoftness(4), 1); assert.equal(shadowSoftness(12), 2);
  assert.ok(highShadowLook(2, 3).level > highShadowLook(2, 1).level, 'one sent high softens too');
  const read = (name) => readFileSync(new URL(`../../scripts/engines/motion/${name}.mjs`, import.meta.url), 'utf8');
  assert.equal((read('wildlife').match(/liftShadow\(/g) ?? []).length, 4);
  assert.equal((read('pond-life').match(/liftShadow\(/g) ?? []).length, 3);
  assert.equal((read('field-life').match(/liftShadow\(/g) ?? []).length, 1);
  assert.ok(/sprite\(highShadow\(\), t2\[0\], true\)/.test(read('field-life')), "the bats' own layer stays as it was");
  assert.match(read('wildlife'), /0\.72 \* k \* birdSize \* \(0\.85/, "the hawk's shadow its old size");
  assert.match(read('wildlife'), /0\.46 \* k \* birdSize \* c\.size\)/, "and the crow's");
});

test('soft copies are drawn once, keep their size, and stay crisp where a canvas cannot blur', () => {
  let drawn = 0;
  const context = () => ({ filter: 'none', drawImage() { drawn++; } });
  class BaseTexture { constructor(source) { this.source = source; } }
  class Texture { constructor(base) { this.base = base; } destroy() { this.gone = true; } }
  const picture = { baseTexture: { resource: { source: {} } }, frame: { x: 0, y: 0, width: 64, height: 64 } };
  const soft = createSoftShadows({ PIXI: { Texture, BaseTexture }, document: { createElement: () => ({ getContext: context }) } });
  assert.equal(soft.of(picture, 0).texture, picture, 'crisp: the picture itself');
  const one = soft.of(picture, 1), again = soft.of(picture, 1);
  assert.equal(one.texture, again.texture); assert.equal(drawn, 1, 'once');
  assert.ok(one.scale > 1, 'made up for being inset');
  assert.notEqual(soft.of(picture, 2).texture, one.texture);
  assert.equal(soft.size, 2);
  soft.clear(); assert.equal(one.texture.gone, true); assert.equal(soft.size, 0);
  const plain = createSoftShadows({ PIXI: { Texture, BaseTexture }, document: { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) } });
  assert.deepEqual(plain.of(picture, 2), { texture: picture, scale: 1 });
});

test('every flying bird goes by it; bats, butterflies and what walks do not', () => {
  const read = (name) => readFileSync(new URL(`../../scripts/engines/motion/${name}.mjs`, import.meta.url), 'utf8');
  assert.equal((read('wildlife').match(/bird: true/g) ?? []).length, 4, 'songbird, hawk, crow, a lone bird between perches');
  assert.equal((read('pond-life').match(/bird: true/g) ?? []).length, 3, 'duck, heron, gull');
  assert.equal((read('field-life').match(/bird: true/g) ?? []).length, 1, 'owl');
  assert.match(readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8'), /const lift = bird \? flying \* birdHeightOf\(animalFlagsNow\(\)\.birdHeight\) : flying;/);
});

test('a higher bird\'s shadow really lands further off, at any slider setting still showing', () => {
  const sun = { angle: 45, height: 45, strength: 1 }, far = (lift) => { const f = shadowFall({ width: 60, lift, grid: 100, sun }); return { d: Math.hypot(f.dx, f.dy), alpha: f.alpha }; };
  const low = far(4 * 0.25), usual = far(4), high = far(4 * 3);
  assert.ok(low.d < usual.d, `${low.d} < ${usual.d}`);
  assert.ok(usual.d < high.d, `${usual.d} < ${high.d}`);
  assert.ok(high.alpha > 0, 'not gone altogether');
});

test('only what can live on this scene is offered', () => {
  const has = (html, title) => html.includes(`<h3>${title}</h3>`);
  const open = animalsPanelHtml({ flags: {} });
  assert.ok(has(open, 'Open ground') && has(open, 'Water') && !has(open, 'Dark places') && open.includes('Outdoor life on this scene') && has(open, 'Place by hand'));
  const dry = animalsPanelHtml({ flags: {}, water: false });
  assert.ok(has(dry, 'Open ground') && !has(dry, 'Water') && !has(dry, 'Dark places'));
  const below = animalsPanelHtml({ flags: {}, underground: true });
  assert.ok(has(below, 'Dark places') && below.includes('data-key="crawlers"'));
  assert.ok(!has(below, 'Open ground') && !has(below, 'Water') && !below.includes('Outdoor life on this scene') && !has(below, 'Place by hand'), 'nothing wild lives underground');
  assert.ok(below.includes('data-size-key="animalScale"'), 'the whole map still scales');
});

test('the panel shows the scene settings as they are', () => {
  const html = animalsPanelHtml({ flags: { outdoorLife: 'on', rabbits: 'many', deerSize: 'huge', placedAnimals: [rabbit('a')] }, count: 12 });
  assert.match(animalsPanelHtml({ flags: { rabbits: '7' } }), /data-key="rabbits" data-value="6"[\s\S]*?<output class="">7<\/output>/, 'a number set shows as it is');
  assert.match(animalsPanelHtml({ flags: {}, live: { foxes: 2 } }), /data-key="foxes" data-value="1"[\s\S]*?<output class="is-auto">2<\/output>/, 'unset shows how many the scene has now');
  assert.ok(/data-size-key="deerSize"[^>]*value="180"/.test(html), 'a name saved before the sliders keeps its size');
  assert.ok(/data-size-key="foxesSize"[^>]*value="100"/.test(html), 'unset is the usual size');
  assert.ok(/data-size-key="animalScale"[^>]*value="100"/.test(html), 'and so is the whole map');
  assert.ok(/data-size-key="frogsSize" min="10" max="300" step="5"/.test(animalsPanelHtml({ flags: {} })));
  assert.ok(/data-size-key="wolvesSize"[^>]*value="35"/.test(animalsPanelHtml({ flags: { wolvesSize: 35 } })));
  assert.ok(html.includes('class="is-active" data-action="setLife" data-value="on"'));
  assert.ok(html.includes('12 about on your screen'));
  assert.match(html, /data-key="wolves" data-value="1"[^>]*>[\s\S]*?<\/button><output class="">0<\/output>|<output class="">0<\/output>[\s\S]*?data-key="wolves" data-value="1"/, 'no wolves until chosen');
  assert.ok(/data-kind="rabbit" data-tooltip="Take away the last one" aria-label/.test(html), 'one to take away');
  assert.ok(/data-kind="fox" data-tooltip="Take away the last one" disabled/.test(html), 'none to take away');
  assert.ok(animalsPanelHtml({ flags: {} }).includes('class="is-active" data-action="setLife" data-value=""'), 'off until chosen');
  assert.ok(animalsPanelHtml({ flags: {}, note: '<x>' }).includes('&lt;x&gt;'));
  assert.ok(animalsPanelHtml({ aiming: 'fox' }).includes('class="is-active" data-action="placeAnimal" data-kind="fox"'));
});

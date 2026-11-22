import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapBuilderHtml, seedOf, randomSeed, createMapBuilder } from '../../scripts/shell/map-builder.mjs';
import { BUILT_ROOF } from '../../scripts/engines/mapbuild/map-plan.mjs';

// Roi: "window in foundry, no external ai usage". The window is a form and three buttons; what it writes to a scene
// is marked as built, so building again or clearing never takes a GM's own work with it.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('the button is with the map painting brush, for the GM who is making maps', () => {
  const at = main.indexOf('name: "animaterBuildMap"');
  assert.ok(at > main.indexOf('name: "animaterDecorate"') && at < main.indexOf('name: "animaterCaveIn"'));
  const tool = main.slice(at, main.indexOf('name: "animaterCaveIn"'));
  assert.match(tool, /visible: toolShown\("toolDecorate"\) && mapMakingOn\(\)/);
  assert.match(tool, /mapBuilder\.open\(\)/);
});

test('the form offers every layout, how wooded, and a seed left empty for a new map each time', () => {
  const html = mapBuilderHtml();
  for (const id of ['village', 'inn', 'camp', 'farm']) assert.ok(html.includes(`value="${id}"`), id);
  for (const id of ['none', 'few', 'usual', 'thick']) assert.ok(html.includes(`value="${id}"`), id);
  assert.match(html, /name="seed"[^>]*value=""/);
  assert.match(html, /nothing is sent anywhere/);
  assert.ok(!html.includes('replaces what was built'), 'nothing to replace on a scene never built on');
});

test('it says what building again does, and what of the scene is the GM\'s own', () => {
  const html = mapBuilderHtml({ last: { preset: 'camp', seed: 4711, trees: 'thick' }, own: { walls: 1, regions: 3, picture: true }, built: true });
  assert.match(html, /value="camp" selected/); assert.match(html, /value="thick" selected/); assert.match(html, /last: 4711/);
  assert.match(html, /Building again replaces what was built here before\. What you made yourself stays\./);
  assert.match(html, /already has a map picture, 1 wall, 3 regions of its own/);
  assert.ok(!mapBuilderHtml({ last: { seed: '"><script>' } }).includes('<script>'));
});

test('a seed is a whole number or it is none', () => {
  assert.equal(seedOf(' 4711 '), 4711); assert.equal(seedOf(''), null); assert.equal(seedOf('abc'), null); assert.equal(seedOf('0'), null); assert.equal(seedOf('1.5'), null); assert.equal(seedOf('12345678901'), null);
  assert.equal(randomSeed(() => 0), 1); assert.equal(randomSeed(() => 0.999999999), 999999);
});

// A scene stood in for: only what the builder is seen to ask of it.
const fakeScene = () => {
  const made = { Region: [], Wall: [], AmbientLight: [] }, gone = { Region: [], Wall: [], AmbientLight: [] };
  let n = 0;
  const holder = (type) => ({ get contents() { return made[type]; }, get size() { return made[type].length; } });
  const scene = { id: 's1', flags: { animater: { roofs: [{ id: 'mine' }] } }, regions: holder('Region'), walls: holder('Wall'), lights: holder('AmbientLight'),
    async createEmbeddedDocuments(type, list) { for (const d of list) made[type].push({ ...d, id: `${type}${n++}` }); return list; },
    async deleteEmbeddedDocuments(type, ids) { gone[type].push(...ids); made[type] = made[type].filter((d) => !ids.includes(d.id)); },
    async update(change) { for (const [k, v] of Object.entries(change)) scene.flags.animater[k.replace('flags.animater.', '')] = v; } };
  return { scene, made, gone };
};

test('building writes a marked map, and building again or clearing takes only that away', async () => {
  const { scene, made, gone } = fakeScene();
  made.Wall.push({ id: 'ownWall', flags: {} }); made.Region.push({ id: 'ownRegion', flags: { animater: { floor: 'stone' } } });
  const was = { game: globalThis.game, canvas: globalThis.canvas };
  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = { ready: true, scene, dimensions: { sceneRect: { x: 0, y: 0, width: 3000, height: 2000 } }, grid: { size: 100 }, level: { id: 'L1' } };
  try {
    const builder = createMapBuilder({ notify: () => {} });
    const first = await builder.build({ preset: 'village', seed: 11, trees: 'usual' });
    assert.equal(first.seed, 11); assert.ok(first.buildings >= 2 && first.walls > 8);
    assert.ok(made.Region.filter((r) => r.id !== 'ownRegion').every((r) => r.flags.animater.built === true && r.levels[0] === 'L1'));
    assert.equal(made.Region.find((r) => r.id !== 'ownRegion').name, 'Ground', 'the ground is made first, so it lies under the rest');
    assert.equal(scene.flags.animater.roofs[0].id, 'mine'); assert.ok(scene.flags.animater.roofs.length > 1);
    assert.deepEqual(scene.flags.animater.builtMap, { preset: 'village', seed: 11, trees: 'usual' });
    const walls = made.Wall.length;
    await builder.build({ preset: 'village', seed: 11, trees: 'usual' });
    assert.equal(made.Wall.length, walls, 'the same seed builds the same map, in place of the first');
    assert.ok(!gone.Wall.includes('ownWall') && !gone.Region.includes('ownRegion'));
    const cleared = await builder.clear();
    assert.ok(cleared.walls > 8 && cleared.roofs >= 2);
    assert.deepEqual(made.Wall.map((w) => w.id), ['ownWall']); assert.deepEqual(made.Region.map((r) => r.id), ['ownRegion']);
    assert.deepEqual(scene.flags.animater.roofs, [{ id: 'mine' }]);
    assert.ok(!scene.flags.animater.roofs.some((r) => r.id.startsWith(BUILT_ROOF)));
    globalThis.game = { user: { isGM: false } };
    assert.equal(await builder.build({ preset: 'camp', seed: 2 }), null, 'a player builds nothing');
  } finally { globalThis.game = was.game; globalThis.canvas = was.canvas; }
});

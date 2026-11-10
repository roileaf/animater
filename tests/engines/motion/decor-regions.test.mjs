import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
import test from 'node:test';
import assert from 'node:assert/strict';
import { DECOR_MOST, canopyKindOf, decorPlacements, decorRole, decorSettings, freshDecor, inAreas } from '../../../scripts/engines/motion/decor-regions.mjs';
import { DECOR_IDS, DECOR_KINDS, scatterDecor, stampDecor, waterOutline } from '../../../scripts/engines/motion/decor-paint.mjs';

const square = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s];

test('a region with decorations off, or none at all, has no settings', () => {
  assert.equal(decorSettings(null), null);
  assert.equal(decorSettings({ on: false, kinds: { rock: {} } }), null);
});

test('settings are cleaned: unknown kinds dropped, numbers kept in range, bad hand placements left out', () => {
  const s = decorSettings({ on: true, where: 'nowhere', density: 9, scale: -1, seed: 'x', kinds: { rock: { size: 99, amount: -3 }, dragon: { size: 1 } }, brushed: [{ kind: 'rock', x: 5, y: 5, size: 0.4 }, { kind: 'nope', x: 1, y: 1, size: 1 }, { kind: 'rock', x: NaN, y: 0, size: 1 }], erased: [[1, 2, 3], [1, 2]] });
  assert.equal(s.where, 'surface');
  assert.equal(s.density, 2); assert.equal(s.scale, 0.3); assert.equal(s.seed, 1);
  assert.deepEqual(Object.keys(s.kinds), ['rock']); assert.deepEqual(s.kinds.rock, { size: 3, amount: 0 });
  assert.equal(s.brushed.length, 1); assert.deepEqual(s.erased, [[1, 2, 3]]);
});

test('every screen places the same decorations: seeded by the region, not random', () => {
  const settings = decorSettings(freshDecor('surface', 7)), areas = [square(0, 0, 1000)];
  const a = decorPlacements({ settings, areas, grid: 100, id: 'regionA' }), b = decorPlacements({ settings, areas, grid: 100, id: 'regionA' });
  assert.ok(a.length > 10);
  assert.deepEqual(a, b);
  assert.notDeepEqual(decorPlacements({ settings, areas, grid: 100, id: 'regionB' }), a, 'another region scatters its own way');
  assert.notDeepEqual(decorPlacements({ settings: { ...settings, seed: 8 }, areas, grid: 100, id: 'regionA' }), a, 'a reshuffle moves them');
});

test('they stay inside the region, out of its holes and out of what was rubbed out', () => {
  const area = square(0, 0, 1000); area.holes = [square(400, 400, 200)];
  const settings = { ...decorSettings(freshDecor('surface', 3)), erased: [[150, 150, 120]] };
  const list = decorPlacements({ settings, areas: [area], grid: 100, id: 'r' });
  for (const d of list) {
    assert.ok(inAreas(d.x, d.y, [area]), `${d.kind} at ${d.x},${d.y} inside`);
    assert.ok((d.x - 150) ** 2 + (d.y - 150) ** 2 >= 120 * 120, 'not where it was rubbed out');
  }
});

test('hand-placed ones are kept, and the scatter makes room for them', () => {
  const byHand = { kind: 'boulder', x: 500, y: 500, size: 2, turn: 0, seed: 1, flip: false };
  const settings = { ...decorSettings(freshDecor('surface', 3)), brushed: [byHand] }, list = decorPlacements({ settings, areas: [square(0, 0, 1000)], grid: 100, id: 'r' });
  assert.ok(list.includes(byHand) || list.some((d) => d.x === 500 && d.y === 500 && d.kind === 'boulder'));
  for (const d of list) if (d !== byHand && !DECOR_KINDS[d.kind].flat) assert.ok(Math.hypot(d.x - 500, d.y - 500) > (2 + d.size) * 100 * 0.42 - 1e-6, `${d.kind} keeps clear`);
});

test('flat ones lie first, then by height; never more than the most a region holds', () => {
  const settings = { ...decorSettings(freshDecor('surface', 3)), density: 2 }, list = decorPlacements({ settings, areas: [square(0, 0, 6000)], grid: 100, id: 'r' });
  assert.ok(list.length <= DECOR_MOST);
  let seenStanding = false;
  for (const d of list) { if (!DECOR_KINDS[d.kind].flat) seenStanding = true; else assert.ok(!seenStanding, 'no flat one after a standing one'); }
});

test('a place only grows its own kinds: no oak underground, no stalagmite outdoors', () => {
  const both = { oak: { size: 1, amount: 1 }, stalagmite: { size: 1, amount: 1 }, rock: { size: 1, amount: 1 } };
  const out = decorPlacements({ settings: { ...decorSettings({ on: true, where: 'surface', kinds: both }) }, areas: [square(0, 0, 2000)], grid: 100, id: 'r' });
  const down = decorPlacements({ settings: { ...decorSettings({ on: true, where: 'cave', kinds: both }) }, areas: [square(0, 0, 2000)], grid: 100, id: 'r' });
  assert.ok(!out.some((d) => d.kind === 'stalagmite') && out.some((d) => d.kind === 'oak'));
  assert.ok(!down.some((d) => d.kind === 'oak') && down.some((d) => d.kind === 'stalagmite'));
});

test('each kind is shown by the right engine', () => {
  assert.equal(decorRole({ kind: 'oak' }), 'tree');
  assert.equal(decorRole({ kind: 'moss' }), 'flat');
  assert.equal(decorRole({ kind: 'boulder' }), 'standing');
  assert.equal(decorRole({ kind: 'glowShrooms' }, 'cave'), 'cavern');
  assert.equal(decorRole({ kind: 'crystals' }, 'surface'), 'standing', 'crystals above ground stay painted');
  assert.equal(decorRole({ kind: 'nothing' }), null);
});

test('tree decorations join the canopy as its own kinds, bare in winter but for the evergreens', () => {
  assert.deepEqual(canopyKindOf('oak', 'summer'), { kind: 'broadleaf', leaves: 1 });
  assert.equal(canopyKindOf('oak', 'winter').kind, 'bare');
  assert.equal(canopyKindOf('spruce', 'winter').kind, 'spruce');
  assert.equal(canopyKindOf('blossom', 'spring').kind, 'blossom');
  assert.equal(canopyKindOf('rock'), null);
  for (const id of DECOR_IDS) if (DECOR_KINDS[id].tree) assert.ok(canopyKindOf(id), `${id} has a canopy kind`);
});

test('the water outline follows the decoration: moved, turned and flipped with it', () => {
  const d = { kind: 'puddle', x: 500, y: 300, size: 1.1, turn: 0, seed: 9, flip: false }, base = waterOutline(d, 100);
  assert.ok(base.length > 40);
  const xs = base.filter((_, i) => i % 2 === 0), ys = base.filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs(xs.reduce((a, b) => a + b) / xs.length - 500) < 20 && Math.abs(ys.reduce((a, b) => a + b) / ys.length - 300) < 20, 'centred on it');
  const turned = waterOutline({ ...d, turn: Math.PI / 2 }, 100);
  assert.ok(Math.abs(turned[0] - 500 - -(base[1] - 300)) < 1e-6 && Math.abs(turned[1] - 300 - (base[0] - 500)) < 1e-6, 'a quarter turn');
  assert.equal(waterOutline({ ...d, kind: 'rock' }, 100), null);
});

test('scatter and brush: deterministic, and a brush dab keeps off what stands there', () => {
  const args = { bounds: { x: 0, y: 0, w: 800, h: 800 }, inside: () => true, grid: 100, kinds: ['rock', 'bush'], density: 1, seed: 4 };
  assert.deepEqual(scatterDecor(args), scatterDecor(args));
  const existing = [{ kind: 'boulder', x: 100, y: 100, size: 3 }];
  for (let s = 1; s < 30; s++) { const d = stampDecor({ x: 100, y: 100, radius: 60, grid: 100, kinds: ['rock'], seed: s, existing }); if (d) assert.fail('no room under a boulder'); }
  assert.ok(stampDecor({ x: 100, y: 100, radius: 60, grid: 100, kinds: ['moss'], seed: 2, existing }), 'a flat kind lies under it');
});

test('trunks that block: a small ring of walls round each tree trunk and stump, as wide as it is drawn; nothing else walled', async () => {
  const { trunkWalls, decorSettings } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  const { trunkRadius } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  assert.equal(trunkRadius('rock', 1), null); assert.equal(trunkRadius('stump', 0.8), 0.2); assert.ok(trunkRadius('oak', 2.6) > 0.3);
  const walls = trunkWalls([{ kind: 'oak', x: 500, y: 500, size: 2.6, seed: 3 }, { kind: 'crate', x: 0, y: 0, size: 1 }, { kind: 'stump', x: 900, y: 900, size: 0.9, seed: 1 }], 100);
  assert.equal(walls.length, 16);
  for (const { c } of walls.slice(0, 8)) for (const [x, y] of [[c[0], c[1]], [c[2], c[3]]]) assert.ok(Math.abs(Math.hypot(x - 500, y - 500) - 39) < 2);
  // The ring closes on itself.
  assert.deepEqual(walls[7].c.slice(2), walls[0].c.slice(0, 2));
  assert.equal(decorSettings({ on: true, blocks: true }).blocks, true); assert.equal(decorSettings({ on: true }).blocks, false);
});

test('the lead GM keeps trunk walls in step, walls marked as the region\'s, blocking movement, sight and light (not sound)', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  // The GM who changed the region builds them; on a scene shown afresh, the lead GM checks them.
  assert.match(main, /if \(!canvas\?\.ready \|\| !game\.user\?\.isGM \|\| !\(mine \|\| leadGM\(\)\)\) return;/);
  assert.match(main, /trunkWallsSoon\(userId === game\.user\?\.id\)/);
  assert.match(main, /move: CONST\.WALL_MOVEMENT_TYPES\.NORMAL, sight: 20, light: 20, sound: 0, levels: w\.levels, flags: \{ \[ID\]: \{ trunkOf: id \} \}/);
  assert.match(main, /const of = wall\.flags\?\.\[ID\]\?\.trunkOf; if \(!of\) continue;/);
  assert.match(read('scripts/ui/region-panel-sections.mjs'), /toggle\('Trunks block movement, sight and light', decor\.blocks === true/);
});

test('dragging a region carries its hand-placed decorations and rubbed-out spots with it; reshaping it does not', async () => {
  const { carryDecor, shapesBox } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  const decor = { brushed: [{ kind: 'oak', x: 4551, y: 2481, size: 3 }], erased: [[10, 20, 30]] };
  const at = (x, y, r = 150) => [{ type: 'ellipse', x, y, radiusX: r, radiusY: r, hole: false }];
  const moved = carryDecor(decor, at(4500, 2500), at(3900, 2800));
  assert.deepEqual([moved.brushed[0].x, moved.brushed[0].y, moved.erased[0]], [3951, 2781, [-590, 320, 30]]);
  assert.equal(carryDecor(decor, at(4500, 2500), at(4500, 2500, 200)), null);
  assert.equal(carryDecor({ brushed: [] }, at(0, 0), at(5, 5)), null);
  assert.deepEqual(shapesBox([{ type: 'polygon', points: [0, 0, 10, 0, 10, 20] }]), { x: 0, y: 0, w: 10, h: 20 });
  assert.match(read('scripts/main.mjs'), /Hooks\.on\("preUpdateRegion", \(doc, change\) => \{ if \(!change\?\.shapes\) return;/);
});

test('what was painted by hand answers the panel: unticking its kind hides it, the region\'s Size and the kind\'s size scale it', async () => {
  const { decorSettings, decorPlacements } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  const area = [[0, 0, 1000, 0, 1000, 1000, 0, 1000]], oak = { kind: 'oak', x: 500, y: 500, size: 2, seed: 1 }, rock = { kind: 'rock', x: 100, y: 100, size: 0.4, seed: 2 };
  const at = (raw) => decorPlacements({ settings: decorSettings({ on: true, density: 0, brushed: [oak, rock], ...raw }), areas: area, grid: 100, id: 'r' });
  assert.deepEqual(at({ kinds: { oak: {}, rock: {} } }).map((d) => d.size).sort(), [0.4, 2]);
  assert.deepEqual(at({ kinds: { oak: { off: true }, rock: {} } }).map((d) => d.kind), ['rock']);
  assert.equal(at({ kinds: { oak: {} }, scale: 1.5 }).find((d) => d.kind === 'oak').size, 3);
  assert.equal(at({ kinds: { oak: { size: 0.5 } } }).find((d) => d.kind === 'oak').size, 1);
  // A kind painted that the region never listed still shows (the toolbar brush paints any kind into it).
  assert.ok(at({ kinds: {} }).some((d) => d.kind === 'oak'));
});

test('a fruit or blossom tree drops petals only in spring; other seasons its shade is a broadleaf\'s', async () => {
  const { canopyKindOf } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  assert.equal(canopyKindOf('blossom', 'spring').kind, 'blossom'); assert.equal(canopyKindOf('fruitTree', 'summer').kind, 'broadleaf');
  assert.equal(canopyKindOf('blossom', 'autumn').kind, 'broadleaf'); assert.equal(canopyKindOf('blossom', 'winter').kind, 'bare');
});

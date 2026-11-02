import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementFeelLayer } from '../../../scripts/engines/motion/movement-feel-render.mjs';
import { PARTICLE_KINDS, FLOORS, puffsFor, particleState } from '../../../scripts/engines/motion/movement-feel.mjs';
import { GAITS } from '../../../scripts/engines/motion/creature-gait.mjs';

const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
class Graphics {
  constructor() { this.calls = []; this.position = point(); this.scale = point(); this.alpha = 1; this.destroyed = false; this.parent = null; }
  beginFill(...a) { this.calls.push(['fill', ...a]); }
  drawCircle(...a) { this.calls.push(['circle', ...a]); }
  drawEllipse(...a) { this.calls.push(['ellipse', ...a]); }
  lineStyle(...a) { this.calls.push(['line', ...a]); }
  drawPolygon(...a) { this.calls.push(['polygon', ...a]); }
  moveTo(...a) { this.calls.push(['move', ...a]); }
  lineTo(...a) { this.calls.push(['lineTo', ...a]); }
  endFill() {}
  destroy() { this.destroyed = true; this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
}
const container = () => ({ children: [], addChild(c) { this.children.push(c); c.parent = this; } });

test('particles are drawn once, then moved, scaled to their radius and faded', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const g = layer.addParticle({ kind: 'puff', x: 10, y: 20, radius: 25, color: 0x8a6f4d });
  assert.equal(root.children.length, 1);
  assert.equal(g.alpha, 0);
  assert.equal(g.eventMode, 'none');
  assert.ok(g.calls.some((c) => c[0] === 'fill' && c[1] === 0x8a6f4d));
  layer.updateParticle(g, { x: 15, y: 25, scale: 2, alpha: 0.3 });
  assert.deepEqual([g.position.x, g.position.y, g.alpha], [15, 25, 0.3]);
  assert.equal(g.scale.x, 1); // 25px radius × 2 scale = 100px across, the drawn size.
  const ring = layer.addParticle({ kind: 'ring', x: 0, y: 0, radius: 10, color: 0xffffff });
  assert.ok(ring.calls.some((c) => c[0] === 'line'));
  layer.removeParticle(g);
  assert.ok(g.destroyed);
  layer.clear();
  assert.ok(ring.destroyed);
  assert.equal(root.children.length, 0);
});

test('a shadow is a soft black ellipse stretched to its geometry', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const s = layer.addShadow();
  assert.ok(s.calls.filter((c) => c[0] === 'ellipse').length >= 3);
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4 });
  assert.deepEqual([s.position.x, s.position.y, s.scale.x, s.scale.y, s.alpha], [5, 6, 1, 0.5, 0.4]);
  layer.removeShadow(s);
  assert.ok(s.destroyed);
  // A destroyed graphic is never touched again.
  assert.doesNotThrow(() => layer.updateShadow(s, { x: 0, y: 0, rx: 1, ry: 1, alpha: 1 }));
});

test('every particle kind draws in its colour, and turns with its rotation', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  for (const kind of PARTICLE_KINDS) {
    const spec = { kind, x: 1, y: 2, radius: 10, color: 0x123456, rotation: 0.5,
      points: kind === 'crack' ? [[-1, 0, 0, 0.2, 1, 0], [0, 0.2, 0.5, 0.7]] : undefined };
    const g = layer.addParticle(spec);
    assert.ok(g.calls.some((c) => (c[0] === 'fill' && c[1] === 0x123456) || (c[0] === 'line' && c[2] === 0x123456)), kind);
    assert.equal(g.rotation, 0.5, kind);
    layer.updateParticle(g, { x: 3, y: 4, scale: 1, alpha: 0.5, rotation: 1.25 });
    assert.equal(g.rotation, 1.25, kind);
  }
  const crack = layer.addParticle({ kind: 'crack', x: 0, y: 0, radius: 10, color: 0xffffff, points: [[-1, 0, 0, 0.2, 1, 0]] });
  assert.equal(crack.calls.filter((c) => c[0] === 'move').length, 1);
  assert.equal(crack.calls.filter((c) => c[0] === 'lineTo').length, 2);
  // Old states with no rotation leave it unturned.
  layer.updateParticle(crack, { x: 0, y: 0, scale: 1, alpha: 1 });
  assert.equal(crack.rotation, 0);
});

test('every gait draws its own track shape in its colour', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const shapes = new Map();
  for (const gait of GAITS.filter((g) => g !== 'none' && g !== 'unknown')) {
    const specs = puffsFor('mud', { x: 0, y: 0, heading: 0.3, index: 1 }, { seed: 'r', grid: 100, gait }).filter((p) => p.kind === 'print' || p.kind === 'groove');
    assert.ok(specs.length >= 1, gait);
    const main = specs.find((p) => p.gait === gait) ?? specs[0];
    const g = layer.addParticle(main);
    assert.ok(g.calls.some((c) => (c[0] === 'fill' && c[1] === main.color) || (c[0] === 'line' && c[2] === main.color)), gait);
    assert.equal(g.rotation, 0.3, gait);
    shapes.set(gait, JSON.stringify(g.calls.map((c) => c.map((v) => (typeof v === 'number' ? Math.round(v) : v)))));
    for (const spec of specs) {
      const t = layer.addParticle(spec);
      layer.updateParticle(t, particleState(spec, spec.life / 2));
      assert.ok(Number.isFinite(t.scale.x) && t.scale.x > 0, `${gait} ${spec.kind}`);
    }
  }
  // No two gaits share a shape.
  assert.equal(new Set(shapes.values()).size, shapes.size);
  // A snake's groove is a stroked wave; an ooze's smear is filled.
  assert.ok(JSON.parse(shapes.get('slither')).some((c) => c[0] === 'lineTo'));
  assert.ok(!JSON.parse(shapes.get('ooze')).some((c) => c[0] === 'lineTo'));
  layer.clear();
});

test('grass reads on grass: blades and tufts outlined in their dark edge, trampled grass in both its greens', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const specs = puffsFor('grass', { x: 0, y: 0, heading: 0.4, index: 2 }, { seed: 'r', grid: 100 });
  for (const kind of ['blade', 'tuft']) {
    const spec = specs.find((p) => p.kind === kind);
    const g = layer.addParticle(spec);
    assert.ok(g.calls.some((c) => c[0] === 'line' && c[2] === spec.edge && c[1] > 0), `${kind} outline`);
    assert.ok(g.calls.some((c) => c[0] === 'fill' && c[1] === spec.color), `${kind} fill`);
  }
  const trample = specs.find((p) => p.kind === 'trample');
  const t = layer.addParticle(trample);
  assert.equal(t.rotation, 0.4);
  const fills = t.calls.filter((c) => c[0] === 'fill');
  assert.ok(fills.some((c) => c[1] === trample.color) && fills.some((c) => c[1] === trample.light));
  assert.ok(t.calls.filter((c) => c[0] === 'polygon').length >= trample.blades.length, 'one flattened blade per streak');
  // A trample spec without seeded streaks (an old one) still draws.
  const bare = layer.addParticle({ kind: 'trample', x: 0, y: 0, radius: 10, color: 0x123456 });
  assert.ok(bare.calls.some((c) => c[0] === 'fill' && c[1] === 0x123456));
  layer.clear();
});

test("every floor's strides render end to end", () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  for (const floor of FLOORS) for (let index = 0; index < 12; index++) {
    for (const spec of puffsFor(floor, { x: 0, y: 0, heading: 0.3, index }, { seed: 'r', grid: 100 })) {
      const g = layer.addParticle(spec);
      for (const age of [0, spec.delay + spec.life / 3, spec.delay + spec.life]) {
        layer.updateParticle(g, particleState(spec, age));
        assert.ok(Number.isFinite(g.scale.x) && Number.isFinite(g.alpha) && Number.isFinite(g.rotation), `${floor} ${spec.kind}`);
      }
    }
  }
  layer.clear();
  assert.equal(root.children.length, 0);
});

test('a shadow stops at walls: masked by the floor its light reaches, unmasked on open ground', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const s = layer.addShadow();
  const clip = [0, 0, 200, 0, 200, 200, 0, 200];
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, clip });
  assert.ok(s.mask, 'masked');
  assert.ok(s.mask.calls.some((c) => c[0] === 'polygon' && c[1] === clip));
  assert.equal(s.mask.parent, root, 'laid in the world, as the shadow is');
  const mask = s.mask;
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, clip });
  assert.equal(s.mask, mask, 'the same floor: not drawn again');
  assert.equal(mask.calls.filter((c) => c[0] === 'polygon').length, 1);
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4 });
  assert.equal(s.mask, null, 'open ground');
  layer.removeShadow(s);
  assert.ok(mask.destroyed);
});

test('a clipped shadow with no silhouette yet leaves no white floor shape drawn', () => {
  const root = container();
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const s = layer.addShadow();
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, clip: [0, 0, 200, 0, 200, 200, 0, 200] });
  const drawn = root.children.filter((c) => c !== s && c.calls?.some((k) => k[0] === 'polygon'));
  assert.ok(drawn.length >= 1);
  for (const m of drawn) assert.equal(m.renderable, false, 'a mask shape is never drawn itself');
});

test('the sun shadows lie under the sunlit floor: kept off floor a wall already shades', () => {
  const root = container();
  class Container { constructor() { this.children = []; this.position = point(); this.scale = point(); } addChild(c) { this.children.push(c); c.parent = this; return c; } destroy() { this.destroyed = true; } }
  class Sprite extends Container { constructor(t) { super(); this.texture = t; } }
  let sunlit = { texture: { id: 1 }, x: 10, y: 20, scale: 4 };
  const layer = createMovementFeelLayer({ PIXI: { Graphics, Container, Sprite }, root: () => root, sunlit: () => sunlit });
  const sun = layer.addShadow(), lamp = layer.addShadow();
  layer.updateShadow(sun, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, sun: true });
  layer.updateShadow(lamp, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4 });
  assert.notEqual(sun.parent, root, 'in the sunlit floor keeping');
  assert.equal(lamp.parent, root, 'a lamp lights a floor walls shade from the sun');
  const holder = sun.parent;
  assert.ok(holder.mask && holder.mask.texture === sunlit.texture);
  assert.deepEqual([holder.mask.position.x, holder.mask.position.y, holder.mask.scale.x], [10, 20, 4]);
  // The walls change: the new picture; none at all: no mask, the sun shadows as they are.
  sunlit = { texture: { id: 2 }, x: 10, y: 20, scale: 4 };
  layer.refreshSunlit();
  assert.equal(holder.mask.texture.id, 2);
  sunlit = null;
  layer.refreshSunlit();
  assert.equal(holder.mask, null);
  layer.updateShadow(sun, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, sun: true });
  assert.equal(sun.parent, holder, 'kept together, unmasked');
});

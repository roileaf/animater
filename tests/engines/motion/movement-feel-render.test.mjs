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
  quadraticCurveTo(...a) { this.calls.push(['curve', ...a]); }
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
  // 'hull' marks no floor at all, like 'none': a boat leaves its wake on the water (swimWake), not a track underfoot.
  for (const gait of GAITS.filter((g) => g !== 'none' && g !== 'unknown' && g !== 'hull')) {
    const specs = puffsFor('mud', { x: 0, y: 0, heading: 0.3, index: 1 }, { seed: 'r', grid: 100, gait }).filter((p) => p.kind === 'print' || p.kind === 'groove' || p.kind === 'rut');
    assert.ok(specs.length >= 1, gait);
    const main = specs.find((p) => p.gait === gait) ?? specs.find((p) => p.kind === 'rut') ?? specs[0];
    const g = layer.addParticle(main);
    // A rut strokes with round ends, so it passes its line its settings as an object rather than as arguments.
    assert.ok(g.calls.some((c) => (c[0] === 'fill' && c[1] === main.color) || (c[0] === 'line' && (c[2] === main.color || c[1]?.color === main.color))), gait);
    assert.equal(g.rotation, main.rotation, gait);
    assert.ok(Math.abs(main.rotation - 0.3) < 0.8, gait);
    shapes.set(gait, JSON.stringify(g.calls.map((c) => c.map((v) => (typeof v === 'number' ? Math.round(v) : v)))));
    for (const spec of specs) {
      const t = layer.addParticle(spec);
      layer.updateParticle(t, particleState(spec, spec.life / 2));
      assert.ok(Number.isFinite(t.scale.x) && t.scale.x > 0, `${gait} ${spec.kind}`);
    }
  }
  // No two gaits share a shape — except the pulled things, which all press the same channel and differ in how far
  // apart and how broad it is rather than in its shape.
  const PULLED = ['wheels', 'barrow', 'runners'];
  const own = [...shapes].filter(([gait]) => !PULLED.includes(gait)).map(([, shape]) => shape);
  assert.equal(new Set(own).size, own.length);
  assert.ok(PULLED.every((gait) => shapes.has(gait)));
  assert.ok(!own.includes(shapes.get('wheels')), 'and a rut is nothing a foot leaves');
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

// Roi, looking at a wagon: "something about the shadow doesnt make sense". The painted wagon is slid along its token
// until its bed sits on the token's middle and the team leads out ahead, and it is drawn at the size the wagon really
// is — but its shadow was laid on the token's middle and shrunk to fit the token, so it fell where the wagon was not
// and at the wrong size. Art that says `own` keeps its size, and `ox`/`oy` carry the slide to the shadow.
test('a worn picture casts its shadow where the picture is, at the size the picture is', () => {
  const root = container();
  class Container2 { constructor() { this.children = []; this.position = point(); this.scale = point(); } addChild(...c) { this.children.push(...c); c.forEach((k) => { k.parent = this; }); return c[0]; } destroy() { this.destroyed = true; } }
  class Sprite extends Container2 { constructor(t) { super(); this.texture = t; this.anchor = point(); } }
  const shape = { sharp: { texture: { id: 's' } }, soft: { texture: { id: 'f' } }, width: 100, height: 100, fill: { w: 1, h: 1 } };
  const silhouettes = { get: () => shape, known: () => true };
  const layer = createMovementFeelLayer({ PIXI: { Graphics, Container: Container2, Sprite }, root: () => root, silhouettes });
  const lay = (art) => {
    const before = new Set(root.children);
    const s = layer.addShadow();
    layer.updateShadow(s, { x: 1000, y: 1000, rx: 50, ry: 25, alpha: 0.4, width: 100, art });
    return root.children.find((c) => c !== s && !before.has(c) && c.children?.length === 1);
  };
  const worn = lay({ texture: { id: 'wagon' }, width: 600, height: 600, rotation: 0, own: true, ox: 40, oy: -25 });
  assert.deepEqual([worn.position.x, worn.position.y], [1040, 975], 'slid with the picture it is the shadow of');
  const plain = lay({ texture: { id: 'person' }, width: 600, height: 600, rotation: 0 });
  assert.deepEqual([plain.position.x, plain.position.y], [1000, 1000], 'ordinary art is where its token is');
  // The wagon keeps its own size; art that does not say so is still held to its token.
  const scaleOf = (node) => Math.abs(node.children[0].children[0].scale.x);
  assert.ok(scaleOf(worn) > scaleOf(plain), 'the wagon is not shrunk to the size of its token');
});

// Roi: "horse missing shadow". A wagon's team is a second picture on the same token, and the shadow machinery knew
// only about the token's own art, so the horse stood in the sun casting nothing.
// Roi, on a horse standing a step from a torchbearer: "the shadow of the horse looks nothing like a horse". It was its
// shape, drawn out five times its length by a flame almost as tall as it — which is the right geometry and an
// unreadable picture. A shadow on the ground is drawn out no further than this.
test('a shadow on the ground is never drawn out so far that its shape is lost', async () => {
  const laid = [];
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const fakeLayer = { addShadow: () => ({}), removeShadow: () => {}, addRim: () => ({}), updateRim: () => {}, removeRim: () => {},
    addParticle: () => null, updateParticle: () => {}, removeParticle: () => {}, clear: () => {},
    updateShadow: (h, geom) => { laid.push(geom); return true; } };
  const token = { id: 'horse', x: 1000, y: 1000, width: 200, elevation: 0, base: 0, visible: true, shadow: true, gait: 'hooves',
    art: () => ({ texture: { id: 'horse' }, width: 275, height: 275, rotation: 0, own: true }), shadowWidth: 275, shadowCore: 170, shadowBody: 1.2,
    // A torch a step away and barely taller than the horse: the longest shadow the geometry can make.
    light: () => ({ light: { strength: 1, angle: 20, elevation: 0 }, darkness: 1, lights: [{ strength: 1, angle: 20, elevation: 0, key: 'torch', x: 1100, y: 1000 }] }) };
  const feel = createMovementFeel({ layer: fakeLayer, tokens: () => [token], grid: () => 100, distance: () => 5, now: () => 0,
    floorAt: () => 'dirt', groundShadows: () => true, shadowShapes: () => true, lightShadows: () => true, enabled: () => true,
    density: () => 1, sun: () => ({ angle: 45, height: 8, strength: 0.2 }) });
  for (const name of ['tick', 'step', 'update', 'frame']) if (typeof feel[name] === 'function') { feel[name](0); break; }
  const stretched = laid.filter((g) => Number.isFinite(g?.stretch));
  assert.ok(stretched.length >= 1, 'something was laid on the ground');
  assert.ok(stretched.every((g) => g.stretch < 2), `drawn out ${Math.max(...stretched.map((g) => g.stretch))}`);
  assert.ok(stretched.every((g) => g.stretch >= 1), 'and never squashed');
  // The further it is drawn out the softer and fainter it goes, as a real shadow's edge spreads away from what casts it.
  const far = stretched.filter((g) => g.stretch > 1.2);
  assert.ok(far.every((g) => (g.lift ?? 0) > 1), 'a long shadow is drawn soft');
  // And it stays joined to what casts it: the near end of the shadow is still under the thing, however far the light
  // would throw it. Its middle is half its own drawn-out length away, no further.
  for (const g of stretched) {
    if (!(g.stretch > 1)) continue;
    // Measured by what is drawn in the picture (`core`) where there is one: a wagon's picture is half shafts and air,
    // and anchoring the picture left the wagon inside it floating clear of its own wheels (Roi, circling the gap:
    // "shouldnt this part be here? like from where the torch location is?").
    const core = Number(g.core) || Number(g.width) || 0;
    const half = (core / 2) * g.stretch;
    const moved = Math.hypot((g.fall?.x ?? g.x) - 1000, (g.fall?.y ?? g.y) - 1000);
    assert.ok(moved <= half - core / 2 + 1e-6, `its middle moved ${Math.round(moved)} with a half-length of ${Math.round(half)}`);
    assert.ok(moved > 0, 'but it does lie away from the light');
  }
  // A picture far bigger than the thing in it stays joined to the thing, not to the picture's edge.
  const wide = laid.find((g) => Number(g.core) > 0 && g.stretch > 1);
  if (wide) assert.ok(Math.hypot((wide.fall?.x ?? 0) - 1000, (wide.fall?.y ?? 0) - 1000) < ((Number(wide.width) || 0) / 2) * (wide.stretch - 1) + 1e-6, 'and not as far as the picture would have put it');
});

test('a token carrying a second body has a shadow laid for that one too', async () => {
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const laid = [];
  const fakeLayer = {
    addShadow: () => ({}), removeShadow: () => {}, addRim: () => ({}), updateRim: () => {}, removeRim: () => {},
    addParticle: () => null, updateParticle: () => {}, removeParticle: () => {}, clear: () => {},
    updateShadow: (h, geom) => { laid.push(geom); return true; },
  };
  const horse = { texture: { id: 'horse' }, width: 200, height: 200, rotation: 0, own: true };
  const token = { id: 'wagon', x: 1000, y: 1000, width: 200, elevation: 0, base: 0, visible: true, shadow: true,
    gait: 'wheels', art: () => ({ texture: { id: 'wagon' }, width: 300, height: 300, rotation: 0, own: true }),
    shadowWidth: 300, shadowBody: 1, shadowFlat: true,
    // The horse stands two and a half squares in front, with the torch below it: from there the light lies another
    // way than it does from the wagon, and its shadow has to follow its own light (Roi: "still wrong direction
    // compared to where the light is").
    shadowAlso: () => ({ art: horse, width: 200, dx: 0, dy: -260, flat: true,
      light: () => ({ light: { strength: 1, angle: 270 }, darkness: 1, lights: [{ strength: 1, angle: 270, key: 'torch' }] }) }),
    light: () => ({ light: { strength: 1, angle: 45 }, darkness: 1, lights: [{ strength: 1, angle: 45, key: 'torch' }] }) };
  const feel = createMovementFeel({ layer: fakeLayer, tokens: () => [token], grid: () => 100, distance: () => 5,
    now: () => 0, floorAt: () => 'dirt', groundShadows: () => true, shadowShapes: () => true, lightShadows: () => false,
    enabled: () => true, density: () => 1, sun: () => ({ angle: 45, height: 30, strength: 1 }) });
  for (const name of ['tick', 'step', 'update', 'frame']) if (typeof feel[name] === 'function') { feel[name](0); break; }
  const of = (g) => { const a = typeof g?.art === 'function' ? g.art() : g?.art; return a?.texture?.id ?? null; };
  const theirs = laid.filter((g) => of(g) === 'horse');
  assert.ok(theirs.length >= 1, 'the horse casts one of its own');
  assert.ok(theirs.every((g) => (g.fall?.y ?? g.y) < 1000), 'from where the horse stands, not where the wagon does');
  const ours = laid.filter((g) => of(g) === 'wagon');
  assert.ok(ours.length >= 1, 'and the wagon still casts its own');
  // Each is thrown by the light where it stands: the two lie different ways, because the torch is in a different
  // direction from each of them.
  const away = (g) => Math.round(((Number(g.along) || 0) * 180) / Math.PI);
  assert.notEqual(away(theirs[0]), away(ours[0]), 'the horse\'s shadow does not copy the wagon\'s');
  // Nothing on the floor is laid over any more: a shadow keeps the way its subject points, whatever it is. Laid over,
  // a wagon's shafts ended up on the wrong side of its bed and the horse in them lay across the road while facing up
  // it, and seen from straight above that reads as the thing having fallen over.
  assert.ok(laid.every((g) => g.laid !== true), 'a shadow on the floor keeps its heading');
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

// Roi, of a token on a bridge whose shadow lay on the ground under it: "shouldnt shadows be affected from elevation?"
test('a shadow on a bridge deck goes in a box of its own at the deck\'s height, beside the floor\'s', () => {
  class Container { constructor() { this.children = []; this.parent = null; } addChild(c) { this.children.push(c); c.parent = this; } }
  const map = new Container(), root = new Container(); root.sortLayer = 650; map.addChild(root);
  const layer = createMovementFeelLayer({ PIXI: { Graphics, Container }, root: () => root });
  const s = layer.addShadow(); layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4, deck: 5.01 });
  assert.notEqual(s.parent, root); assert.equal(s.parent.elevation, 5.01); assert.equal(s.parent.sortLayer, 650); assert.equal(s.parent.parent, map);
  layer.updateShadow(s, { x: 5, y: 6, rx: 50, ry: 25, alpha: 0.4 }); assert.equal(s.parent, root, 'back on the floor off the bridge');
});

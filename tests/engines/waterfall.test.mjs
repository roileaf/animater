import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallAxis, fallPhase, rainbowAt, mistBox, FLOW_WAYS, createWaterfalls, WATERFALL_SHADERS } from '../../scripts/engines/motion/waterfall.mjs';

const box = [100, 100, 300, 100, 300, 500, 100, 500];
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-6, `${m} ${a} is not ${b}`);

test('a fall going south: head along the top, foot along the bottom', () => {
  const axis = fallAxis(box, 's');
  near(axis.length, 400); near(axis.width, 200);
  near(axis.head.mid.x, 200); near(axis.head.mid.y, 100);
  near(axis.foot.mid.x, 200); near(axis.foot.mid.y, 500);
  near(Math.min(axis.head.a.x, axis.head.b.x), 100); near(Math.max(axis.head.a.x, axis.head.b.x), 300);
  near(axis.head.a.y, 100); near(axis.foot.b.y, 500);
  assert.deepEqual(axis.way, { x: 0, y: 1 });
});

test('every way, north up', () => {
  assert.deepEqual(Object.keys(FLOW_WAYS).sort(), ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
  const north = fallAxis(box, 'n'); near(north.head.mid.y, 500); near(north.foot.mid.y, 100);
  const east = fallAxis(box, 'e'); near(east.head.mid.x, 100); near(east.foot.mid.x, 300); near(east.length, 200); near(east.width, 400);
  const west = fallAxis(box, 'w'); near(west.head.mid.x, 300); near(west.foot.mid.x, 100);
  const se = fallAxis(box, 'se');
  assert.ok(se.foot.mid.x + se.foot.mid.y > se.head.mid.x + se.head.mid.y, 'toward the lower right');
  near(se.length, 600 * Math.SQRT1_2);
  for (const flow of Object.keys(FLOW_WAYS)) {
    const a = fallAxis(box, flow), dot = a.way.x * a.across.x + a.way.y * a.across.y;
    near(dot, 0, flow); near(Math.hypot(a.way.x, a.way.y), 1, flow);
    const gone = (a.foot.mid.x - a.head.mid.x) * a.way.x + (a.foot.mid.y - a.head.mid.y) * a.way.y;
    near(gone, a.length, flow);
  }
  assert.equal(fallAxis(box, 'NE').way.x, fallAxis(box, 'ne').way.x, 'capitals do no harm');
  assert.deepEqual(fallAxis(box, 'sideways').way, FLOW_WAYS.s.reduce((o, v, i) => ({ ...o, [i ? 'y' : 'x']: v }), {}), 'not a way: down the map');
});

test('a fall narrowing to a point still has a lip, and no shape has no fall', () => {
  // A triangle coming to a point at the head: the slice near it, not nothing.
  const axis = fallAxis([200, 100, 300, 500, 100, 500], 's');
  assert.ok(Math.hypot(axis.head.b.x - axis.head.a.x, axis.head.b.y - axis.head.a.y) > 0);
  near(Math.hypot(axis.foot.b.x - axis.foot.a.x, axis.foot.b.y - axis.foot.a.y) > 150 ? 1 : 0, 1, 'wide at the foot');
  assert.equal(fallAxis([], 's'), null); assert.equal(fallAxis(null, 's'), null); assert.equal(fallAxis([1, 1, 2, 2], 's'), null);
  assert.equal(fallAxis([0, 0, 100, 0, 200, 0], 's'), null, 'a line');
});

test('a drop speeds up as it falls', () => {
  assert.equal(fallPhase(0), 0); assert.equal(fallPhase(1), 1); assert.equal(fallPhase(2), 1);
  // Equal stretches of the fall take less and less of the time.
  assert.ok(fallPhase(0.5) - fallPhase(0) > fallPhase(1) - fallPhase(0.5));
});

test('a rainbow shows away from the sun, and only when it is well up', () => {
  const foot = { x: 200, y: 500 };
  assert.equal(rainbowAt(foot, null), null, 'no sun');
  assert.equal(rainbowAt(null, { angle: 0, height: 60, strength: 1 }), null);
  assert.equal(rainbowAt(foot, { angle: 0, height: 5, strength: 1 }), null, 'sun low');
  assert.equal(rainbowAt(foot, { angle: 0, height: 60, strength: 0.1 }), null, 'behind cloud');
  assert.equal(rainbowAt(foot, { angle: 0, height: 60, strength: 1, moon: true }), null, 'not by the moon');
  // The sun to the east (angle 0): the bow to the west.
  const bow = rainbowAt(foot, { angle: 0, height: 60, strength: 1 }, { grid: 100 });
  assert.ok(bow.x < foot.x); near(bow.y, foot.y);
  assert.ok(bow.strength > 0.9);
  const south = rainbowAt(foot, { angle: 90, height: 60, strength: 1 }, { grid: 100 });
  assert.ok(south.y < foot.y, 'the sun to the south: the bow to the north');
  assert.ok(rainbowAt(foot, { angle: 0, height: 20, strength: 1 }).strength < bow.strength, 'fainter as it gets low');
  const axis = fallAxis(box, 's'), onLine = rainbowAt(axis.foot, { angle: 0, height: 60, strength: 1 }, { grid: 100 });
  assert.ok(onLine.x < axis.foot.mid.x, 'a foot line will do');
});

test('the mist box takes in the foot and goes past it', () => {
  const axis = fallAxis(box, 's'), m = mistBox(axis, 100), { x, y } = axis.foot.mid;
  assert.ok(m.x < x && m.x + m.w > x && m.y < y && m.y + m.h > y);
  assert.ok(m.y + m.h > y + 300, 'past the foot');
});

function fakePIXI() {
  class Thing {
    constructor() { this.children = []; this.visible = true; }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((o) => o !== c); }
    destroy() { this.destroyed = true; }
  }
  class Mesh extends Thing { constructor(geometry, shader) { super(); this.geometry = geometry; this.shader = shader; } }
  class Geometry { addAttribute(name, buffer) { this.points = buffer.data; return this; } addIndex(i) { this.index = i; return this; } }
  class Buffer { constructor(data) { this.data = data; } }
  return { Container: Thing, Mesh, Geometry, Buffer, Shader: { from: (v, f, uniforms) => ({ uniforms, frag: f }) }, utils: {} };
}

test('the layer: one body and one mist for each fall, paused out of view, still when frozen', () => {
  const PIXI = fakePIXI(), floor = new PIXI.Container(), above = new PIXI.Container();
  const falls = createWaterfalls({ PIXI, floor: () => floor, above: () => above });
  assert.equal(falls.busy, false);
  falls.tick(0.1, {});
  falls.build({ falls: [{ area: box, flowTo: 's', swift: true }, { area: [1, 1], flowTo: 's' }], grid: 100 });
  assert.equal(falls.busy, true);
  assert.equal(floor.children.length, 1, 'no shape: no fall'); assert.equal(above.children.length, 1);
  const body = floor.children[0], mist = above.children[0];
  assert.deepEqual([...body.geometry.index], [0, 1, 2, 0, 2, 3], 'clipped to the region itself');
  assert.equal(body.shader.uniforms.uSwift, 1);

  falls.look({ sun: { angle: 0, height: 60, strength: 1 }, light: 1, wind: 0.5, windAngle: 0 });
  assert.ok(mist.shader.uniforms.uBow[3] > 0.5);
  assert.ok(mist.shader.uniforms.uBow[0] < 200, 'away from the sun');
  assert.ok(mist.shader.uniforms.uLean[0] > 0, 'leaning with the wind');
  falls.look({ sun: null });
  assert.equal(mist.shader.uniforms.uBow[3], 0);

  const view = { x: 0, y: 0, w: 2000, h: 2000 };
  const t0 = body.shader.uniforms.uTime;
  falls.tick(0.05, { view });
  assert.ok(body.shader.uniforms.uTime > t0);
  assert.ok(mist.shader.uniforms.uDrift[0] > 0, 'the mist going off with the wind');
  const t1 = body.shader.uniforms.uTime, far = { x: 9000, y: 9000, w: 100, h: 100 };
  falls.tick(0.05, { view: far });
  assert.equal(body.visible, false); assert.equal(mist.visible, false);
  assert.equal(body.shader.uniforms.uTime, t1, 'nothing goes on unseen');

  falls.look({ frozen: true, sun: { angle: 0, height: 60, strength: 1 } });
  falls.tick(0.05, { view });
  assert.equal(body.visible, true); assert.equal(mist.visible, false, 'no mist off ice');
  assert.equal(body.shader.uniforms.uFrozen, 1);
  assert.equal(body.shader.uniforms.uTime, t1, 'hung still');
  assert.equal(mist.shader.uniforms.uBow[3], 0, 'no bow either');

  falls.clear();
  assert.equal(falls.busy, false); assert.ok(body.destroyed); assert.ok(mist.destroyed);
  assert.equal(floor.children.length, 0);
});

test('the shaders are written for WebGL1', () => {
  for (const source of [WATERFALL_SHADERS.vert, WATERFALL_SHADERS.body, WATERFALL_SHADERS.mist]) {
    assert.ok(source.includes('precision highp float'));
    assert.ok(!/#version|\btexture\s*\(|\bout vec4\b/.test(source));
    assert.equal(source.split('{').length, source.split('}').length);
  }
});

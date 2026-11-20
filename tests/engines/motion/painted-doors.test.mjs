import test from 'node:test';
import assert from 'node:assert/strict';
import { doorPainted, wallDoors } from '../../../scripts/engines/motion/wall-looks.mjs';
import { DOOR_KINDS, DOOR_CHOICES, DOOR_IDS, DOOR_SWING, doorFor, doorHangs, doorwaySpan, paintDoorLeaf } from '../../../scripts/engines/motion/door-paint.mjs';
import { createPaintedDoors, SWING_TIME } from '../../../scripts/engines/motion/painted-doors.mjs';

// Roi: "we should also add matching doors". A doorway is the gap the stone leaves; this is what hangs in it.

const door = (id, x1, y1, x2, y2, extra = {}) => ({ id, c: [x1, y1, x2, y2], door: 1, ds: 0, ...extra, animater: { material: 'dressed', ...(extra.animater ?? {}) } });

// ---------------------------------------------------------------------------------------------------- which doors

test('only a doorway drawn here is painted', () => {
  assert.equal(doorPainted(door('a', 0, 0, 100, 0)), true);
  assert.equal(doorPainted({ id: 'b', c: [0, 0, 100, 0], door: 1 }), false, "a map's own door is left alone");
  assert.equal(doorPainted({ id: 'c', c: [0, 0, 100, 0], animater: { material: 'dressed' } }), false, 'a wall is not a door');
  assert.equal(doorPainted({ id: 'd', c: [0, 0, 0, 0], door: 1, animater: { material: 'dressed' } }), false, 'nor is a doorway with no width');
});

test('a door hangs at one end and reaches to the other', () => {
  const [d] = wallDoors([door('a', 100, 200, 200, 200)]);
  assert.deepEqual(d.hinge, [100, 200]);
  assert.deepEqual(d.far, [200, 200]);
  assert.equal(d.length, 100);
  assert.equal(d.along, 0, 'it lies along its opening');
  assert.equal(d.way, 1);
});

// Roi: "some walls doesnt look good with doors..." — a door drawn to its own idea of a door's thickness stood proud
// of a thin wall on both faces. It takes the wall's, measured the way a leaf is measured: right across it.
test('a door is as thick as the wall it hangs in', () => {
  const [plain] = wallDoors([door('a', 100, 200, 200, 200)]);
  assert.equal(plain.thick, null, 'a wall that never said keeps the door its own usual thickness');
  const [thin] = wallDoors([door('b', 100, 200, 200, 200, { animater: { material: 'dressed', thick: 0.1 } })]);
  assert.equal(thin.thick, 0.1, "the wall's own half-thickness travels with the door");
  const leaf = paintDoorLeaf('planked', 100, { grid: 100, thick: thin.thick * 2 }, (w, h) => ({ width: w, height: h, getContext: () => null }));
  assert.equal(leaf, null, 'with no canvas to draw on, nothing is painted');
});

test('hinging the far end turns it round, and swings it the other way', () => {
  const [d] = wallDoors([door('a', 100, 200, 200, 200, { animater: { material: 'dressed', hinge: 'far' } })]);
  assert.deepEqual(d.hinge, [200, 200]);
  assert.equal(Math.abs(d.along), Math.PI, 'it lies back along its opening');
  assert.equal(d.way, -1, 'and opens into the other room');
});

test('which end it hangs on and which way it opens are two different things', () => {
  const inward = wallDoors([door('a', 100, 200, 200, 200)])[0];
  const outward = wallDoors([door('a', 100, 200, 200, 200, { animater: { material: 'dressed', swing: 'out' } })])[0];
  assert.deepEqual(outward.hinge, inward.hinge, 'the same end');
  assert.equal(outward.way, -inward.way, 'and the other side of the wall');
  assert.notEqual(outward.key, inward.key, 'so it is painted again when it changes');
  // Hinged at the far end AND opening outward: both flip, so it swings the same way as a near-hinged inward one.
  const both = wallDoors([door('a', 100, 200, 200, 200, { animater: { material: 'dressed', hinge: 'far', swing: 'out' } })])[0];
  assert.equal(both.way, inward.way);
  assert.notDeepEqual(both.hinge, inward.hinge, 'from the other end of the opening');
});

test('a locked door is a shut one', () => {
  assert.equal(wallDoors([door('a', 0, 0, 100, 0, { ds: 0 })])[0].open, false);
  assert.equal(wallDoors([door('a', 0, 0, 100, 0, { ds: 1 })])[0].open, true);
  assert.equal(wallDoors([door('a', 0, 0, 100, 0, { ds: 2 })])[0].open, false, 'locked is shut, not open');
});

test('moving a doorway, or changing its leaf, changes what it is', () => {
  const was = wallDoors([door('a', 0, 0, 100, 0)])[0];
  assert.notEqual(wallDoors([door('a', 0, 0, 140, 0)])[0].key, was.key, 'a wider opening');
  assert.notEqual(wallDoors([door('a', 0, 0, 100, 0, { animater: { material: 'dressed', door: 'iron' } })])[0].key, was.key, 'a different leaf');
  assert.equal(wallDoors([door('a', 0, 0, 100, 0, { ds: 1 })])[0].key, was.key, 'but opening it is not a different door');
});

// ---------------------------------------------------------------------------------------------------- the leaf

test('a wall gets the door it would have', () => {
  assert.equal(doorFor('timber'), 'planks');
  assert.equal(doorFor('dressed'), 'banded');
  assert.equal(doorFor('hewn'), 'slab');
  assert.ok(DOOR_KINDS[doorFor('iron-filings-and-nonsense')], 'and anything else still gets a real door');
  for (const choice of DOOR_CHOICES) assert.ok(DOOR_KINDS[choice.id], `${choice.id} is offered and exists`);
  assert.deepEqual(DOOR_IDS.slice().sort(), DOOR_CHOICES.map((c) => c.id).sort());
});

test('a hide hangs; everything else swings', () => {
  assert.equal(doorHangs('hide'), true);
  assert.equal(doorHangs('banded'), false);
  assert.ok(DOOR_SWING > 1 && DOOR_SWING < Math.PI / 2, 'wide open, but never flat against the wall');
});

// ---------------------------------------------------------------------------------------------------- the opening

test('a doorway is cut where it was asked for, inside the wall it is cut from', () => {
  const cut = doorwaySpan(1000, 500, 200);
  assert.deepEqual([cut.from, cut.to], [400, 600]);
  assert.ok(cut.before && cut.after, 'wall left on both sides');
  const near = doorwaySpan(1000, 0, 200);
  assert.deepEqual([near.from, near.to], [0, 200], 'a click at the very end slides it inside');
  const far = doorwaySpan(1000, 1000, 200);
  assert.deepEqual([far.from, far.to], [800, 1000]);
});

test('a doorway never leaves a hole where a stub would be too short to be a wall', () => {
  // The bug Roi found: a stub shorter than a fifth of a square was dropped, so the room had a gap in it.
  const cut = doorwaySpan(1000, 101, 200);
  assert.equal(cut.from, 0, 'slid flush to the end instead of leaving a 1px stub');
  assert.equal(cut.to, 200);
  assert.equal(cut.before, false, 'and no stub is made');
  assert.ok(cut.after, 'the far side still reaches the corner');
  const other = doorwaySpan(1000, 899, 200);
  assert.equal(other.to, 1000);
  assert.equal(other.after, false);
  assert.ok(other.before);
});

test('every cut accounts for the whole wall: opening plus stubs, with nothing lost', () => {
  for (const at of [0, 1, 50, 99, 100, 101, 500, 899, 900, 901, 999, 1000]) {
    const cut = doorwaySpan(1000, at, 200);
    assert.ok(cut.from >= 0 && cut.to <= 1000, `${at}: inside the wall`);
    assert.ok(Math.abs(cut.to - cut.from - 200) < 1e-9, `${at}: the opening is the width asked for`);
    // Whatever is not the opening is a stub, or is nothing at all — never a gap left behind.
    if (!cut.before) assert.ok(cut.from <= 2, `${at}: no stub means the opening reaches the end`);
    if (!cut.after) assert.ok(1000 - cut.to <= 2, `${at}: and the same at the far end`);
  }
});

test('a doorway wider than its wall becomes the whole wall', () => {
  const cut = doorwaySpan(150, 75, 400);
  assert.deepEqual([cut.from, cut.to], [0, 150]);
  assert.equal(cut.before, false);
  assert.equal(cut.after, false);
});

const quietContext = () => ({
  canvas: null, save() {}, restore() {}, scale() {}, translate() {}, rotate() {}, clip() {}, fill() {}, stroke() {}, beginPath() {},
  moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, ellipse() {}, fillRect() {},
  set fillStyle(v) {}, get fillStyle() { return ''; }, set strokeStyle(v) {}, get strokeStyle() { return ''; },
  set lineWidth(v) {}, get lineWidth() { return 1; }, set lineCap(v) {}, get lineCap() { return ''; },
  set lineJoin(v) {}, get lineJoin() { return ''; }, set filter(v) {}, get filter() { return 'none'; },
  set globalAlpha(v) {}, get globalAlpha() { return 1; },
});
const quietCanvas = (w, h) => ({ width: w, height: h, getContext: () => quietContext() });

test('every leaf paints, with its hinge at the end it turns about', () => {
  for (const id of DOOR_IDS) {
    const leaf = paintDoorLeaf(id, 100, { grid: 100 }, quietCanvas);
    assert.ok(leaf, `${id} painted`);
    // `box` is what it covers on the map; the canvas holds more pixels than that, so it keeps its edges when the
    // table zooms in. The hinge is measured in map units, so it belongs against the box and not against texels.
    assert.ok(leaf.box.w > 100, 'with room round it for its shadow');
    assert.ok(leaf.canvas.width > leaf.box.w, 'and more picture than it covers, so it holds up close to');
    assert.ok(leaf.hinge[0] < leaf.box.w * 0.5, 'its hinge at the near end');
    assert.ok(Math.abs(leaf.hinge[1] - leaf.box.h / 2) < 1, 'halfway across its thickness');
  }
});

// ---------------------------------------------------------------------------------------------------- the layer

class Sprite {
  constructor(texture) { this.texture = texture; this.alpha = 1; this.rotation = 0; this.anchor = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y ?? x; } }; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Texture: { from: (canvas) => ({ canvas, destroy() { this.destroyed = true; } }) } };
const newRoot = () => ({
  children: [],
  addChild(c) { c.parent = this; this.children.push(c); return c; },
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; },
});
const newLayer = () => { const root = newRoot(); return { root, layer: createPaintedDoors({ PIXI, root: () => root, grid: () => 100, make: quietCanvas }) }; };
const DOORS = (open = false) => wallDoors([door('a', 100, 200, 200, 200, { ds: open ? 1 : 0 })]);

test('a leaf is hung at its hinge, lying along its opening', () => {
  const { layer, root } = newLayer();
  layer.populate({ doors: DOORS() });
  layer.settle();
  assert.equal(root.children.length, 1);
  const leaf = root.children[0];
  assert.equal(leaf.position.x, 100, 'pinned at the hinge, not the middle');
  assert.equal(leaf.position.y, 200);
  assert.equal(leaf.rotation, 0, 'and shut, it lies along the opening');
});

test('a door swings rather than snapping open', () => {
  const { layer, root } = newLayer();
  layer.populate({ doors: DOORS() });
  layer.settle();
  const leaf = root.children[0];
  layer.populate({ doors: DOORS(true) });
  assert.equal(root.children.length, 1, 'the same leaf, not a new one');
  layer.step(SWING_TIME / 3);
  const part = leaf.rotation;
  assert.ok(part > 0 && part < DOOR_SWING, `part way: ${part.toFixed(2)}`);
  layer.step(SWING_TIME);
  assert.ok(Math.abs(leaf.rotation - DOOR_SWING) < 1e-9, 'and arrives wide open');
  assert.equal(layer.state.swinging, 0);
});

test('shutting it brings it back the way it came', () => {
  const { layer, root } = newLayer();
  layer.populate({ doors: DOORS(true) });
  layer.settle();
  const leaf = root.children[0];
  assert.ok(Math.abs(leaf.rotation - DOOR_SWING) < 1e-9, 'it was already open when the scene was drawn');
  layer.populate({ doors: DOORS(false) });
  layer.step(SWING_TIME);
  assert.ok(Math.abs(leaf.rotation) < 1e-9);
});

test('a hide is drawn aside instead of swinging', () => {
  const { layer, root } = newLayer();
  const hide = wallDoors([door('a', 100, 200, 200, 200, { animater: { material: 'natural', door: 'hide' } })]);
  layer.populate({ doors: hide });
  layer.settle();
  const leaf = root.children[0];
  layer.populate({ doors: wallDoors([door('a', 100, 200, 200, 200, { ds: 1, animater: { material: 'natural', door: 'hide' } })]) });
  layer.step(SWING_TIME);
  assert.equal(leaf.rotation, 0, 'it never swings');
  assert.ok(leaf.alpha < 0.5, 'it is drawn aside instead');
});

test('a doorway that is gone takes its leaf with it', () => {
  const { layer, root } = newLayer();
  layer.populate({ doors: DOORS() });
  layer.settle();
  layer.populate({ doors: [] });
  assert.equal(root.children.length, 0);
  assert.deepEqual(layer.state, { hung: 0, waiting: 0, swinging: 0, keys: [] });
});

test('with no canvas to hang on, nothing is lost', () => {
  const layer = createPaintedDoors({ PIXI, root: () => null, grid: () => 100, make: quietCanvas });
  layer.populate({ doors: DOORS() });
  assert.equal(layer.step(0, 2), 1, 'it waits');
  assert.equal(layer.state.hung, 0);
});

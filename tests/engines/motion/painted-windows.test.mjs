import test from 'node:test';
import assert from 'node:assert/strict';
import { windowPainted, wallWindows } from '../../../scripts/engines/motion/wall-looks.mjs';
import { WINDOW_ART, WINDOW_IDS, WINDOW_CHOICES, OPEN_WINDOWS, windowFor, paintWindowPane } from '../../../scripts/engines/motion/window-paint.mjs';
import { WINDOW_MOTION, WINDOW_SWING, paintWindowFrame, paintWindowLeaf } from '../../../scripts/engines/motion/window-paint.mjs';
import { createPaintedWindows, OPEN_TIME } from '../../../scripts/engines/motion/painted-windows.mjs';
import { CLOSING_WINDOWS, closesWindow } from '../../../scripts/engines/motion/window-state.mjs';

// Animater already knew about windows that open and close; this gives those a face, and adds the four openings that
// never close at all — an arrow slit has no state to be in.

const win = (id, x1, y1, x2, y2, extra = {}) => ({ id, c: [x1, y1, x2, y2], ...extra, animater: { material: 'dressed', window: 'glassWindow', ...(extra.animater ?? {}) } });

// ---------------------------------------------------------------------------------------------------- the vocabulary

test('every kind that opens is one Animater already had', () => {
  for (const { id, opens } of WINDOW_CHOICES) {
    if (opens) assert.ok(closesWindow(id), `${id} is one of the kinds that close`);
    else assert.equal(closesWindow(id), false, `${id} never closes, so it has no state`);
  }
  // And every kind that already closed has a face now: none was left without one.
  for (const id of Object.keys(CLOSING_WINDOWS)) assert.ok(WINDOW_ART[id], `${id} is painted`);
});

test('the four that never close are openings, not windows with a state', () => {
  assert.deepEqual(OPEN_WINDOWS.slice().sort(), ['arrowWindow', 'barredWindow', 'brokenWindow', 'sillWindow']);
  for (const id of OPEN_WINDOWS) assert.equal(WINDOW_ART[id].opens, false);
});

test('a wall gets the window it would have', () => {
  assert.equal(windowFor('timber'), 'woodWindow');
  assert.equal(windowFor('hewn'), 'barredWindow');
  assert.ok(WINDOW_ART[windowFor('something-else-entirely')], 'and anything else still gets a real window');
});

// ---------------------------------------------------------------------------------------------------- which walls

test('only a window drawn here is painted', () => {
  assert.equal(windowPainted(win('a', 0, 0, 100, 0)), true);
  assert.equal(windowPainted({ id: 'b', c: [0, 0, 100, 0], animater: { window: 'glassWindow' } }), false, 'no material: not ours');
  assert.equal(windowPainted({ id: 'c', c: [0, 0, 100, 0], animater: { material: 'dressed' } }), false, 'a wall is not a window');
  assert.equal(windowPainted(win('d', 0, 0, 100, 0, { door: 1 })), false, 'a door is not a window');
});

test('a window lies along its opening, middle first', () => {
  const [w] = wallWindows([win('a', 100, 200, 300, 200)]);
  assert.deepEqual(w.middle, [200, 200]);
  assert.equal(w.length, 200);
  assert.equal(w.along, 0);
  assert.equal(w.open, false);
  assert.equal(w.kind, 'glassWindow');
});

test('opening it, or its slats, is the same window in another state', () => {
  const shut = wallWindows([win('a', 0, 0, 100, 0)])[0];
  const open = wallWindows([win('a', 0, 0, 100, 0, { animater: { material: 'dressed', window: 'glassWindow', windowOpen: true } })])[0];
  assert.equal(open.key, shut.key, 'the same window');
  assert.equal(open.open, true);
  const slats = wallWindows([win('a', 0, 0, 100, 0, { animater: { material: 'dressed', window: 'shutterWindow', windowSlats: true } })])[0];
  assert.equal(slats.slats, true);
  assert.notEqual(slats.key, shut.key, 'but a different kind is a different window');
});

test('a window opens inside or outside, and is painted again when it changes', () => {
  const inward = wallWindows([win('a', 0, 0, 100, 0, { animater: { material: 'dressed', window: 'shutterWindow' } })])[0];
  const outward = wallWindows([win('a', 0, 0, 100, 0, { animater: { material: 'dressed', window: 'shutterWindow', swing: 'out' } })])[0];
  assert.equal(inward.way, 1);
  assert.equal(outward.way, -1);
  assert.notEqual(outward.key, inward.key);
});

// ---------------------------------------------------------------------------------------------------- the pane

const quietContext = () => ({
  canvas: null, save() {}, restore() {}, scale() {}, translate() {}, rotate() {}, clip() {}, fill() {}, stroke() {}, beginPath() {},
  moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, ellipse() {}, fillRect() {},
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  set fillStyle(v) {}, get fillStyle() { return ''; }, set strokeStyle(v) {}, get strokeStyle() { return ''; },
  set lineWidth(v) {}, get lineWidth() { return 1; }, set lineCap(v) {}, get lineCap() { return ''; },
  set lineJoin(v) {}, get lineJoin() { return ''; }, set filter(v) {}, get filter() { return 'none'; },
  set globalAlpha(v) {}, get globalAlpha() { return 1; },
});
const quietCanvas = (w, h) => ({ width: w, height: h, getContext: () => quietContext() });

test('every window paints, shut and open', () => {
  for (const id of WINDOW_IDS) {
    for (const open of [0, 1]) {
      const pane = paintWindowPane(id, 100, { grid: 100, open, slats: true }, quietCanvas);
      assert.ok(pane, `${id} painted ${open ? 'open' : 'shut'}`);
      assert.ok(pane.box.w > 100, 'with room round it');
      assert.ok(Math.abs(pane.middle[0] - pane.box.w / 2) < 1, 'and its middle in the middle');
    }
  }
});

// ---------------------------------------------------------------------------------------------------- the layer

class Sprite {
  constructor(texture) { this.texture = texture; this.alpha = 1; this.rotation = 0; this.anchor = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y ?? x; } }; this.scale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y ?? x; } }; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Texture: { from: (canvas) => ({ canvas, destroy() { this.destroyed = true; } }) } };
const newRoot = () => ({
  children: [],
  addChild(c) { c.parent = this; this.children.push(c); return c; },
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; },
});
const newLayer = () => { const root = newRoot(); return { root, layer: createPaintedWindows({ PIXI, root: () => root, grid: () => 100, make: quietCanvas }) }; };
const ONE = (extra = {}) => wallWindows([win('a', 100, 200, 300, 200, { animater: { material: 'dressed', window: 'glassWindow', ...extra } })]);

test('a window is an opening with leaves hanging in it', () => {
  const { layer, root } = newLayer();
  layer.populate({ windows: ONE() });
  layer.settle();
  assert.equal(root.children.length, 3, 'the opening, and two leaves');
  const [frame, left, right] = root.children;
  assert.equal(frame.position.x, 200, 'the opening is laid in the middle of the gap');
  assert.equal(frame.rotation, 0);
  assert.equal(left.position.x, 100, 'a leaf at each end of it');
  assert.equal(right.position.x, 300);
  assert.equal(left.rotation, 0);
  assert.ok(Math.abs(right.rotation - Math.PI) < 1e-9, 'the far one hangs back along the opening');
});

test('a window that has not changed keeps its pictures', () => {
  const { layer, root } = newLayer();
  layer.populate({ windows: ONE() }); layer.settle();
  const was = root.children.slice();
  assert.equal(layer.populate({ windows: ONE() }), 0, 'nothing to paint again');
  assert.deepEqual(root.children, was);
});

test('opening a window moves its leaves; nothing is painted again', () => {
  // Roi: "opned window all look the same.. we need to do it like doors with actaul moving parts". It used to swap
  // the whole picture for a bare frame, which is why every opened window was alike.
  const { layer, root } = newLayer();
  layer.populate({ windows: ONE() }); layer.settle();
  const was = root.children.slice();
  assert.equal(layer.populate({ windows: ONE({ windowOpen: true }) }), 0, 'no repainting to open it');
  const [, left] = root.children;
  layer.step(OPEN_TIME / 3);
  assert.ok(Math.abs(left.rotation) > 0 && Math.abs(left.rotation) < WINDOW_SWING, 'part way open');
  layer.step(OPEN_TIME);
  assert.ok(Math.abs(Math.abs(left.rotation) - WINDOW_SWING) < 1e-9, 'and it arrives');
  assert.deepEqual(root.children, was, 'the same pictures throughout');
  assert.equal(layer.state.moving, 0);
});

test('each kind opens the way that kind opens', () => {
  for (const id of WINDOW_IDS) {
    const { parts, motion } = WINDOW_MOTION[id];
    if (!WINDOW_ART[id].opens) { assert.equal(parts, 0, `${id} has no leaves`); assert.equal(motion, 'none'); continue; }
    assert.equal(parts, 2, `${id} is a pair`);
    assert.equal(motion, id === 'curtainWindow' ? 'slide' : 'swing', `${id} moves its own way`);
  }
});

test('curtains are drawn aside, not swung', () => {
  const { layer, root } = newLayer();
  const curtains = (extra = {}) => wallWindows([win('a', 100, 200, 300, 200, { animater: { material: 'dressed', window: 'curtainWindow', ...extra } })]);
  layer.populate({ windows: curtains() }); layer.settle();
  const left = root.children[1], wasAt = left.position.x;
  layer.populate({ windows: curtains({ windowOpen: true }) });
  layer.step(OPEN_TIME);
  assert.equal(left.rotation, 0, 'it never turns');
  assert.notEqual(left.position.x, wasAt, 'it gathers toward its own end');
  assert.ok(left.scale.x < 1, 'and bunches as it goes');
});

test('an opening has no leaves at all', () => {
  const { layer, root } = newLayer();
  layer.populate({ windows: wallWindows([win('a', 100, 200, 300, 200, { animater: { material: 'hewn', window: 'arrowWindow' } })]) });
  layer.settle();
  assert.equal(root.children.length, 1, 'the opening alone');
  assert.equal(layer.state.leaves, 0);
});

test('a window that is gone takes its opening and its leaves with it', () => {
  const { layer, root } = newLayer();
  layer.populate({ windows: ONE() }); layer.settle();
  layer.populate({ windows: [] });
  assert.equal(root.children.length, 0);
  assert.deepEqual(layer.state, { set: 0, waiting: 0, moving: 0, leaves: 0, keys: [] });
});

test('with no canvas to set it in, nothing is lost', () => {
  const layer = createPaintedWindows({ PIXI, root: () => null, grid: () => 100, make: quietCanvas });
  layer.populate({ windows: ONE() });
  assert.equal(layer.step(0, 2), 1, 'it waits');
  assert.equal(layer.state.set, 0);
});

test('a frame is the opening, and a leaf hangs at one end of its picture', () => {
  const frame = paintWindowFrame('glassWindow', 100, { grid: 100 }, quietCanvas);
  assert.ok(frame && Math.abs(frame.middle[0] - frame.box.w / 2) < 1, 'the opening is drawn about its middle');
  assert.ok(frame.canvas.width > frame.box.w, 'and painted bigger than it is laid, so its lines stay clean');
  const leaf = paintWindowLeaf('glassWindow', 50, { grid: 100 }, quietCanvas);
  assert.ok(leaf && leaf.hinge[0] < leaf.box.w * 0.5, 'a leaf turns about its near end');
  assert.equal(paintWindowLeaf('arrowWindow', 50, { grid: 100 }, quietCanvas), null, 'an opening has no leaf to paint');
});

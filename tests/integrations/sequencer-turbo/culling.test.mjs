import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- Minimal PIXI: a Rectangle with PIXI 7's pad() and intersects() for axis-aligned transforms ----
class Rectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    Object.assign(this, { x, y, width, height });
  }
  get right() { return this.x + this.width; }
  get bottom() { return this.y + this.height; }
  pad(px = 0, py = px) {
    this.x -= px; this.y -= py; this.width += px * 2; this.height += py * 2;
    return this;
  }
  intersects(other, transform) {
    let { x: l, y: t, right: r, bottom: b } = other;
    if (transform) {
      [l, r] = [l, r].map((x) => transform.a * x + transform.tx).sort((p, q) => p - q);
      [t, b] = [t, b].map((y) => transform.d * y + transform.ty).sort((p, q) => p - q);
    }
    return Math.min(this.right, r) > Math.max(this.x, l) && Math.min(this.bottom, b) > Math.max(this.y, t);
  }
}
globalThis.PIXI = { Rectangle };

const { patchEffectRender } = await import('../../../scripts/integrations/sequencer-turbo/culling.mjs');

// Sequencer's CanvasEffect: render() inherited from a PIXI container, its own _registerTickers.
let rendered = 0, voided = 0;
class Container {
  render() { rendered++; }
}
class CanvasEffect extends Container {
  _registerTickers() {}
  _renderAsVoid() { voided++; }
  constructor({ bounds, filters, sprite = {}, data = {} } = {}) {
    super();
    Object.assign(this, { visible: true, renderable: true, worldAlpha: 1, data, filters, sprite });
    this.box = bounds;
  }
  getBounds(skipUpdate, rect) {
    Object.assign(rect, this.box);
    return rect;
  }
}

const state = { enabled: true, culling: true, frame: 7, stats: { culled: 0 } };
const renderer = (transform = null) => ({
  renderTexture: { sourceFrame: new Rectangle(0, 0, 1000, 800) },
  projection: { transform },
});
const glow = (padding = 0) => [{ padding }];
const far = { x: 5000, y: 5000, width: 100, height: 100 };
const near = { x: 100, y: 100, width: 100, height: 100 };
patchEffectRender(new CanvasEffect(), state);

function draw(effect, r = renderer()) {
  rendered = 0; voided = 0;
  effect.render(r);
  effect._renderAsVoid(r);
  return { rendered, voided };
}

test('a filtered effect off-screen is skipped, its void pass too; on-screen it renders', () => {
  const culled = state.stats.culled;
  assert.deepEqual(draw(new CanvasEffect({ bounds: far, filters: glow() })), { rendered: 0, voided: 0 });
  assert.equal(state.stats.culled, culled + 1);
  assert.deepEqual(draw(new CanvasEffect({ bounds: near, filters: glow() })), { rendered: 1, voided: 1 });
  // A mask or a filter on the sprite counts as heavy too.
  assert.equal(draw(new CanvasEffect({ bounds: far, sprite: { _mask: {} } })).rendered, 0);
  assert.equal(draw(new CanvasEffect({ bounds: far, sprite: { filters: glow() } })).rendered, 0);
});

test('bounds are padded by the margin and by the filters\' padding', () => {
  // 30 px right of the frame: inside the 64 px margin.
  assert.equal(draw(new CanvasEffect({ bounds: { x: 1030, y: 100, width: 10, height: 10 }, filters: glow() })).rendered, 1);
  // 100 px right: past the margin, then reached by a 50 px glow.
  const box = { x: 1100, y: 100, width: 10, height: 10 };
  assert.equal(draw(new CanvasEffect({ bounds: box, filters: glow() })).rendered, 0);
  assert.equal(draw(new CanvasEffect({ bounds: box, filters: glow(50) })).rendered, 1);
  assert.equal(draw(new CanvasEffect({ bounds: box, filters: glow(), sprite: { filters: glow(50) } })).rendered, 1);
});

test('the projection transform maps bounds into the render frame', () => {
  const shift = { a: 1, b: 0, c: 0, d: 1, tx: -4900, ty: -4900 };
  assert.equal(draw(new CanvasEffect({ bounds: far, filters: glow() }), renderer(shift)).rendered, 1);
  assert.equal(draw(new CanvasEffect({ bounds: near, filters: glow() }), renderer(shift)).rendered, 0);
});

test('plain, screen-space, hidden and unmeasurable effects are never culled', () => {
  assert.equal(draw(new CanvasEffect({ bounds: far })).rendered, 1);
  assert.equal(draw(new CanvasEffect({ bounds: far, filters: glow(), data: { screenSpace: true } })).rendered, 1);
  assert.equal(draw(new CanvasEffect({ bounds: far, filters: glow(), data: { screenSpaceAboveUI: true } })).rendered, 1);
  const invisible = new CanvasEffect({ bounds: far, filters: glow() });
  invisible.visible = false;
  assert.equal(draw(invisible).rendered, 1);
  assert.equal(draw(new CanvasEffect({ bounds: { x: NaN, y: 0, width: 10, height: 10 }, filters: glow() })).rendered, 1);
  const noFrame = { renderTexture: null, projection: {} };
  assert.equal(draw(new CanvasEffect({ bounds: far, filters: glow() }), noFrame).rendered, 1);
});

test('switching culling or the speed-ups off renders everything', () => {
  state.culling = false;
  assert.equal(draw(new CanvasEffect({ bounds: far, filters: glow() })).rendered, 1);
  state.culling = true;
  state.enabled = false;
  assert.deepEqual(draw(new CanvasEffect({ bounds: far, filters: glow() })), { rendered: 1, voided: 1 });
  state.enabled = true;
});

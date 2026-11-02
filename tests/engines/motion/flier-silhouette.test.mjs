import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageOf, silhouetteScale, silhouettePose, createSilhouettes, MAX_SPREAD, SOLID_COVERAGE } from '../../../scripts/engines/motion/flier-silhouette.mjs';
import { createMovementFeelLayer } from '../../../scripts/engines/motion/movement-feel-render.mjs';
import { shadowGeometry, castShadowGeometry } from '../../../scripts/engines/motion/movement-feel.mjs';

const rgba = (alphas) => Uint8ClampedArray.from(alphas.flatMap((a) => [0, 0, 0, a]));

test('art that fills its frame has no outline; cut-out art does', () => {
  assert.equal(coverageOf(rgba([255, 255, 255, 255])), 1);
  assert.equal(coverageOf(rgba([255, 0, 0, 0])), 0.25);
  assert.ok(coverageOf(rgba(Array(100).fill(255))) > SOLID_COVERAGE);
  // A round top-down token (about 79% of its square) still casts its shape.
  assert.ok(Math.PI / 4 < SOLID_COVERAGE);
});

test('the silhouette keeps the art’s drawn size, up to a little past its token', () => {
  assert.equal(silhouetteScale({ artWidth: 100, artHeight: 100, width: 100 }), 1);
  assert.equal(silhouetteScale({ artWidth: 260, artHeight: 130, width: 100 }), MAX_SPREAD * 100 / 260);
  assert.equal(silhouetteScale({ artWidth: 0, artHeight: 0, width: 100 }), 1);
});

test('laid flat on the floor, shrinking and softening with height; nearly whole when cast on creatures', () => {
  const low = silhouettePose(shadowGeometry({ x: 0, y: 0, width: 100, lift: 5 })), high = silhouettePose(shadowGeometry({ x: 0, y: 0, width: 100, lift: 50 }));
  assert.ok(low.flat < 0.8 && low.size > high.size && high.soft > low.soft);
  assert.ok(low.size <= 1 && high.soft <= 1);
  const cast = silhouettePose(castShadowGeometry({ x: 0, y: 0, width: 100, lift: 20 }), { cast: true });
  assert.ok(cast.flat > 0.8 && cast.size === 1);
});

test('silhouettes are made once per art; solid or unreadable art gets none', () => {
  let probes = 0;
  const canvas = (alpha) => () => ({ width: 0, height: 0, getContext: () => ({
    drawImage() {}, fillRect() {}, getImageData: () => { probes++; return { data: rgba(Array(32 * 32).fill(0).map((_, i) => (i % 4 ? 0 : alpha))) }; },
  }) });
  const PIXI = { Texture: { from: (c) => ({ canvas: c, destroy() {} }) } };
  const art = (uid) => ({ valid: true, baseTexture: { uid, resource: { source: {} } }, frame: { x: 0, y: 0, width: 400, height: 200 } });
  const cut = createSilhouettes({ PIXI, doc: { createElement: canvas(255) } });
  const shape = cut.get(art(1));
  assert.ok(shape?.sharp?.texture && shape.soft?.texture);
  assert.equal(shape.width, 128);
  assert.equal(shape.height, 64);
  assert.equal(cut.get(art(1)), shape);
  assert.equal(probes, 1, 'drawn once');
  const solid = createSilhouettes({ PIXI, doc: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: rgba(Array(1024).fill(255)) }) }) }) } });
  assert.equal(solid.get(art(2)), null);
  const tainted = createSilhouettes({ PIXI, doc: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => { throw new Error('tainted'); } }) }) } });
  assert.equal(tainted.get(art(3)), null);
  assert.equal(cut.get({ valid: false, baseTexture: { uid: 4 }, frame: {} }), null, 'not loaded yet');
});

test('a big creature’s silhouette is made bigger, so its shadow is as crisp as a small one’s', async () => {
  const { silhouetteSize } = await import('../../../scripts/engines/motion/flier-silhouette.mjs');
  assert.equal(silhouetteSize(100), 128);
  assert.equal(silhouetteSize(250), 256);
  assert.equal(silhouetteSize(780), 512, 'never past 512');
  assert.equal(silhouetteSize(undefined), 128);
  const blurs = [];
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ set filter(v) { const m = /blur\(([\d.]+)px\)/.exec(v); if (m) blurs.push(Number(m[1])); }, get filter() { return 'none'; },
    drawImage() {}, fillRect() {}, getImageData: () => ({ data: rgba(Array(32 * 32).fill(0).map((_, i) => (i % 4 ? 0 : 255))) }) }) }) };
  const cut = createSilhouettes({ PIXI: { Texture: { from: () => ({ destroy() {} }) } }, doc, gap: 0 });
  const art = { valid: true, baseTexture: { uid: 9, resource: { source: {} } }, frame: { x: 0, y: 0, width: 1000, height: 1000 } };
  const small = cut.get(art, 128), big = cut.get(art, 512);
  assert.equal(small.width, 128);
  assert.equal(big.width, 512, 'its own, larger');
  assert.equal(cut.get(art, 512), big, 'kept');
  assert.deepEqual(blurs.slice(0, 2), blurs.slice(2, 4), 'the same blur in pixels at any size');
});

test('a flier with cut-out art casts its silhouette; without one the round shadow stays', () => {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Node { constructor() { this.children = []; this.position = point(); this.scale = point(); this.anchor = point(); this.alpha = 1; this.visible = true; this.destroyed = false; }
    addChild(...c) { for (const n of c) { this.children.push(n); n.parent = this; } } destroy() { this.destroyed = true; } }
  class Graphics extends Node { beginFill() {} drawEllipse() {} endFill() {} }
  const root = new Node(), shape = { sharp: { texture: 'S' }, soft: { texture: 'F' }, width: 128, height: 64 };
  const layer = createMovementFeelLayer({ PIXI: { Graphics, Container: Node, Sprite: Node }, root: () => root,
    silhouettes: { get: (t) => (t === 'dragon' ? shape : null), clear() {} } });
  const g = layer.addShadow(), geom = shadowGeometry({ x: 500, y: 500, width: 100, lift: 10 });
  layer.updateShadow(g, { ...geom, art: () => ({ texture: 'dragon', width: 200, height: 100, flipX: true, rotation: 0 }) });
  assert.equal(g.alpha, 0, 'the ellipse hides');
  const sil = root.children.find((c) => c !== g);
  assert.ok(sil?.visible && sil.scale.y < 0.8);
  // Cast down and to the right, past the token's own art.
  assert.deepEqual([sil.position.x, sil.position.y], [geom.fall.x, geom.fall.y]);
  assert.ok(geom.fall.x > 500 && geom.fall.y > 500 + 50);
  const sprite = sil.children[0].children[0];
  assert.equal(sprite.texture, 'S');
  assert.ok(sprite.scale.x < 0, 'mirrored with the art');
  // 200 wide on a 100 token: held to 130, then shrunk with height as the round shadow is.
  assert.ok(Math.abs(Math.abs(sprite.scale.x) * 128 - 130 * silhouettePose(geom).size) < 1e-9);
  layer.updateShadow(g, { ...geom, art: () => ({ texture: 'portrait', width: 100, height: 100 }) });
  assert.equal(g.alpha, geom.alpha, 'solid art: the round shadow');
  assert.equal(sil.visible, false);
  layer.removeShadow(g);
  assert.ok(sil.destroyed && g.destroyed);
});

test('animated art (a video token) casts a shadow that moves with it: its own frames, tinted black and blurred', () => {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Node { constructor() { this.children = []; this.position = point(); this.scale = point(); this.anchor = point(); this.alpha = 1; this.visible = true; this.destroyed = false; this.tint = 0xffffff; this.filters = null; }
    addChild(...c) { for (const n of c) { this.children.push(n); n.parent = this; } } destroy() { this.destroyed = true; } }
  class Graphics extends Node { beginFill() {} drawEllipse() {} endFill() {} }
  class BlurFilter { constructor() { this.blur = 0; } }
  const root = new Node(), shape = { sharp: { texture: 'S' }, soft: { texture: 'F' }, width: 128, height: 128, fill: { w: 1, h: 1 } };
  const video = { baseTexture: { resource: { source: { tagName: 'VIDEO' } } }, frame: { width: 512, height: 512 } };
  const still = { baseTexture: { resource: { source: { tagName: 'IMG' } } }, frame: { width: 512, height: 512 } };
  const layer = createMovementFeelLayer({ PIXI: { Graphics, Container: Node, Sprite: Node, BlurFilter }, root: () => root,
    silhouettes: { get: () => shape, clear() {} } });
  const g = layer.addShadow(), geom = shadowGeometry({ x: 500, y: 500, width: 100, lift: 10 });
  layer.updateShadow(g, { ...geom, art: () => ({ texture: video, width: 100, height: 100, rotation: 0 }) });
  const inner = root.children.find((c) => c !== g).children[0], [sharp, soft] = inner.children;
  assert.equal(sharp.texture, video, 'the playing video itself, so every frame shows');
  assert.equal(sharp.tint, 0x000000, 'black');
  assert.equal(soft.visible, false);
  assert.ok(inner.filters?.[0] instanceof BlurFilter && inner.filters[0].blur > 0, 'softened as the made ones are');
  assert.ok(Math.abs(Math.abs(sharp.scale.x) * 512 - 100 * silhouettePose(geom).size) < 1e-9, 'drawn at the art’s size');
  layer.updateShadow(g, { ...geom, art: () => ({ texture: still, width: 100, height: 100, rotation: 0 }) });
  assert.equal(sharp.texture, 'S', 'a still image: the made silhouette again');
  assert.equal(sharp.tint, 0xffffff);
  assert.equal(soft.visible, true);
  assert.equal(inner.filters, null);
});

test('silhouettes are made one a frame, so many new creatures at once never stall', () => {
  let t = 0;
  const doc = { createElement: () => ({ getContext: () => ({ drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }) }) }) };
  const sil = createSilhouettes({ PIXI: { Texture: { from: () => ({ destroy() {} }) } }, doc, now: () => t });
  const art = (uid) => ({ valid: true, baseTexture: { uid, resource: { source: {} } }, frame: { x: 0, y: 0, width: 64, height: 64 } });
  assert.ok(sil.get(art(1)));
  assert.equal(sil.get(art(2)), null, 'the next waits a frame');
  t = 20;
  assert.ok(sil.get(art(2)));
  assert.ok(sil.get(art(1)), 'made ones are always there');
});

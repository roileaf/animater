import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, createReactionHost, markCircle, overlaps, reactionFor, reactionSeed } from '../../../scripts/engines/marks/reactions.mjs';
import { createMarkLayer } from '../../../scripts/engines/marks/mark-paint.mjs';
import { reactionVisual } from '../../../scripts/engines/marks/reaction-fx.mjs';

const tag = (mark, extra = {}) => ({ mark, shape: 'spot', at: { x: 500, y: 500 }, radius: 50, seed: 7, delayMs: 0, lasting: false, level: 'L1', sceneId: 's1', ...extra });
const effect = (t) => ({ data: { moduleName: 'animater', sceneId: 's1', animaterMark: t } });

test('the reaction table', () => {
  assert.deepEqual(reactionFor('scorch', 'rime'), { kind: 'steam', removes: true, durationMs: 1200 });
  assert.deepEqual(reactionFor('rime', 'scorch'), { kind: 'smoke', removes: true, durationMs: 1000 });
  assert.deepEqual(reactionFor('scorch', 'stain'), { kind: 'flare', removes: false, durationMs: 600 });
  assert.deepEqual(reactionFor('streaks', 'residue'), { kind: 'arcs', removes: false, durationMs: 500 });
  assert.deepEqual(reactionFor('residue', 'rime'), { kind: 'bubbles', removes: false, durationMs: 900 });
  assert.equal(reactionFor('stain', 'scorch'), null, 'only the listed direction reacts');
  assert.equal(reactionFor('residue', 'streaks'), null);
  assert.equal(reactionFor('scorch', 'scorch'), null);
  assert.equal(reactionFor(undefined, 'rime'), null);
  assert.ok(Object.isFrozen(REACTIONS));
});

test('a mark as a circle: spot, area centre and radius', () => {
  assert.deepEqual(markCircle(tag('rime'), 100), { x: 500, y: 500, r: 50 });
  assert.deepEqual(markCircle(tag('rime', { radius: undefined }), 100), { x: 500, y: 500, r: 50 }, 'a spot defaults to half a square');
  assert.deepEqual(markCircle(tag('rime', { shape: 'circle', radius: 200 }), 100), { x: 500, y: 500, r: 200 });
  assert.deepEqual(markCircle(tag('rime', { shape: 'line', endpoint: { x: 900, y: 500 } }), 100), { x: 700, y: 500, r: 200 });
  assert.deepEqual(markCircle(tag('rime', { shape: 'cone', endpoint: { x: 500, y: 800 }, angle: 90, length: 300 }), 100), { x: 500, y: 650, r: 150 });
});

test('circles overlap when the centres are closer than 0.8 of the summed radii', () => {
  assert.equal(overlaps({ x: 0, y: 0, r: 50 }, { x: 79, y: 0, r: 50 }), true);
  assert.equal(overlaps({ x: 0, y: 0, r: 50 }, { x: 80, y: 0, r: 50 }), false);
  assert.equal(overlaps({ x: 0, y: 0, r: 50 }, { x: 0, y: 0, r: 50 }), true);
});

test('the seed is shared by both marks and the same on every client', () => {
  assert.equal(reactionSeed(tag('scorch', { seed: 3 }), tag('rime', { seed: 9 })), reactionSeed(tag('scorch', { seed: 3 }), tag('rime', { seed: 9 })));
  assert.notEqual(reactionSeed(tag('scorch', { seed: 3 }), tag('rime', { seed: 9 })), reactionSeed(tag('scorch', { seed: 9 }), tag('rime', { seed: 3 })));
});

// A host over a fake floor: `marks` are records, `near` finds overlaps like the layer does.
function host({ enabled = () => true, max, tokensOn = () => [] } = {}) {
  const out = { t: 0, marks: [], removed: [], spawned: [] };
  const h = createReactionHost({
    near: (p, r) => out.marks.filter((m) => overlaps(markCircle(m.tag, 100), { ...p, r })),
    remove: (m) => out.removed.push(m),
    spawn: (reaction) => {
      const handle = { reaction, destroyed: false, until: out.t + reaction.durationMs, update: (t) => t < handle.until, destroy: () => { handle.destroyed = true; } };
      out.spawned.push(handle);
      return handle;
    },
    enabled, now: () => out.t, gridSize: () => 100, tokensOn, ...(max ? { max } : {}),
  });
  return { h, out };
}

test('fire landing on rime puffs steam and takes the rime away', () => {
  const { h, out } = host();
  const rime = { tag: tag('rime', { seed: 2 }) };
  const fire = { tag: tag('scorch', { at: { x: 540, y: 500 }, seed: 5 }) };
  out.marks.push(rime, fire);
  h.onLand(fire);
  assert.equal(out.spawned.length, 1);
  const { reaction } = out.spawned[0];
  assert.equal(reaction.kind, 'steam');
  assert.deepEqual(reaction.at, { x: 500, y: 500 }, 'it rises from the existing mark');
  assert.equal(reaction.radius, 50);
  assert.equal(reaction.seed, reactionSeed(fire.tag, rime.tag));
  assert.deepEqual(out.removed, [rime]);
});

test('no reaction with itself, a far mark, another level, or a pair that does not react', () => {
  const { h, out } = host();
  const fire = { tag: tag('scorch') };
  out.marks.push(
    fire,
    { tag: tag('rime', { at: { x: 2000, y: 2000 } }) },
    { tag: tag('rime', { level: 'L2' }) },
    { tag: tag('cracks') },
  );
  h.onLand(fire);
  assert.equal(out.spawned.length, 0);
  assert.equal(out.removed.length, 0);
});

test('a flare and bubbles leave the old mark in place', () => {
  const { h, out } = host();
  out.marks.push({ tag: tag('stain') });
  h.onLand({ tag: tag('scorch') });
  out.marks.length = 0;
  out.marks.push({ tag: tag('rime') });
  h.onLand({ tag: tag('residue') });
  assert.deepEqual(out.spawned.map((s) => s.reaction.kind), ['flare', 'bubbles']);
  assert.equal(out.removed.length, 0);
});

test('arcs jump to the visible tokens standing on the acid', () => {
  const asked = [];
  const { h, out } = host({ tokensOn: (p, r) => { asked.push([p, r]); return [{ x: 520, y: 510 }]; } });
  out.marks.push({ tag: tag('residue', { radius: 80 }) });
  h.onLand({ tag: tag('streaks') });
  assert.deepEqual(asked, [[{ x: 500, y: 500 }, 80]]);
  assert.deepEqual(out.spawned[0].reaction.targets, [{ x: 520, y: 510 }]);
});

test('switched off, nothing reacts', () => {
  const { h, out } = host({ enabled: () => false });
  out.marks.push({ tag: tag('rime') });
  h.onLand({ tag: tag('scorch') });
  assert.equal(out.spawned.length, 0);
  assert.equal(out.removed.length, 0);
  const throws = host({ enabled: () => { throw new Error('no settings'); } });
  throws.out.marks.push({ tag: tag('rime') });
  throws.h.onLand({ tag: tag('scorch') });
  assert.equal(throws.out.spawned.length, 0);
});

test('at most six reactions at once; the mark still goes so every screen matches', () => {
  const { h, out } = host();
  for (let i = 0; i < 8; i++) out.marks.push({ tag: tag('rime', { seed: i }) });
  h.onLand({ tag: tag('scorch') });
  assert.equal(out.spawned.length, 6);
  assert.equal(h.count(), 6);
  assert.equal(out.removed.length, 8);
});

test('finished reactions are destroyed; clear destroys the rest', () => {
  const { h, out } = host();
  out.marks.push({ tag: tag('stain') }, { tag: tag('rime') });
  h.onLand({ tag: tag('scorch') });
  const [flare, steam] = out.spawned;
  out.t = 700; h.tick();
  assert.equal(flare.destroyed, true);
  assert.equal(steam.destroyed, false);
  assert.equal(h.count(), 1);
  h.clear();
  assert.equal(steam.destroyed, true);
  assert.equal(h.count(), 0);
});

test('a reaction that throws is dropped without stopping the frame', () => {
  const { h, out } = host();
  out.marks.push({ tag: tag('rime') });
  h.onLand({ tag: tag('scorch') });
  out.spawned[0].update = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => h.tick());
  assert.equal(out.spawned[0].destroyed, true);
  assert.equal(h.count(), 0);
});

// The real layer: landing calls onLand, near finds painted marks, remove fades them quickly.
function layer({ onLand } = {}) {
  const out = { t: 0, sprites: [], landed: [] };
  const l = createMarkLayer({
    makeSprite: (t) => { const s = { tag: t, alpha: 1, visible: true, rims: [] }; out.sprites.push(s); return s; },
    addToScene: () => {},
    removeFromScene: (s) => { s.removed = true; },
    viewedLevel: () => 'L1', sceneId: () => 's1', gridSize: () => 100, now: () => out.t,
    onLand: onLand ?? ((record) => out.landed.push(record)),
  });
  const at = (t) => { out.t = t; l.tick(); };
  return { l, out, at };
}

test('the layer reports a mark when it lands, not when it is planned', () => {
  const { l, out, at } = layer();
  l.onEffect(effect(tag('scorch', { delayMs: 400 })));
  at(0);
  assert.equal(out.landed.length, 0);
  at(400);
  assert.equal(out.landed.length, 1);
  assert.equal(out.landed[0].tag.mark, 'scorch');
  at(500);
  assert.equal(out.landed.length, 1, 'once');
});

test('near finds the painted marks a circle overlaps; remove fades one out in 300 ms', () => {
  const { l, out, at } = layer();
  l.onEffect(effect(tag('rime')));
  l.onEffect(effect(tag('rime', { at: { x: 3000, y: 3000 } })));
  l.onEffect(effect(tag('rime', { delayMs: 5000 })));
  at(0); at(400);
  const found = l.near({ x: 520, y: 500 }, 50);
  assert.equal(found.length, 1, 'not the far one, nor the one still to land');
  l.remove(found[0]);
  assert.deepEqual(l.near({ x: 520, y: 500 }, 50), [], 'a fading mark no longer reacts');
  at(550);
  assert.ok(Math.abs(out.sprites[0].alpha - 0.5) < 1e-9);
  at(700);
  assert.equal(out.sprites[0].removed, true);
  assert.equal(l.count(), 2);
});

test('removing a record the layer does not hold does nothing', () => {
  const { l, at } = layer();
  l.onEffect(effect(tag('rime')));
  at(0);
  assert.doesNotThrow(() => { l.remove({ tag: tag('rime') }); l.remove(null); });
  assert.equal(l.near({ x: 500, y: 500 }, 50).length, 1);
});

test('a throwing onLand keeps the mark', () => {
  const { l, out, at } = layer({ onLand: () => { throw new Error('boom'); } });
  l.onEffect(effect(tag('rime')));
  assert.doesNotThrow(() => at(0));
  assert.equal(out.sprites[0].removed, undefined);
  assert.equal(l.count(), 1);
});

test('end to end: fire on rime removes the rime from the floor', () => {
  let reactions;
  const { l, out, at } = layer({ onLand: (r) => reactions.onLand(r) });
  const spawned = [];
  reactions = createReactionHost({
    near: (p, r) => l.near(p, r), remove: (m) => l.remove(m),
    spawn: (r) => { spawned.push(r); return { update: () => true, destroy() {} }; },
    enabled: () => true, now: () => out.t, gridSize: () => 100,
  });
  l.onEffect(effect(tag('rime')));
  at(0);
  l.onEffect(effect(tag('scorch', { at: { x: 530, y: 500 }, delayMs: 200 })));
  at(100);
  assert.equal(spawned.length, 0, 'not before the fire lands');
  at(200);
  assert.deepEqual(spawned.map((r) => r.kind), ['steam']);
  at(600);
  assert.equal(out.sprites[0].removed, true, 'the rime faded away');
  assert.equal(out.sprites[1].removed, undefined, 'the scorch stays');
});

// A fake PIXI recording draw calls.
function fakePIXI() {
  class Graphics {
    constructor() { this.calls = 0; this.destroyed = false; this.alpha = 1; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; }
    clear() { this.calls = 0; return this; }
    beginFill() { this.calls++; return this; }
    endFill() { return this; }
    drawCircle() { this.calls++; return this; }
    drawEllipse() { this.calls++; return this; }
    lineStyle() { return this; }
    moveTo() { return this; }
    lineTo() { this.calls++; return this; }
    destroy() { this.destroyed = true; }
  }
  return { Graphics, BLEND_MODES: { ADD: 1 } };
}

test('every reaction draws, ends after its time and destroys its graphics', () => {
  const PIXI = fakePIXI();
  for (const kind of ['steam', 'smoke', 'flare', 'arcs', 'bubbles']) {
    const durationMs = { steam: 1200, smoke: 1000, flare: 600, arcs: 500, bubbles: 900 }[kind];
    const fx = reactionVisual(PIXI, { kind, at: { x: 100, y: 100 }, radius: 50, seed: 3, durationMs, targets: [{ x: 150, y: 120 }] }, 0);
    assert.equal(fx.display.eventMode, 'none');
    assert.equal(fx.update(durationMs / 2), true, `${kind} runs`);
    assert.ok(fx.display.calls > 0, `${kind} draws something`);
    assert.equal(fx.update(durationMs), false, `${kind} ends`);
    fx.destroy();
    assert.equal(fx.display.destroyed, true);
  }
});

test('the same seed draws the same reaction', () => {
  const PIXI = fakePIXI();
  const draw = () => {
    const fx = reactionVisual(PIXI, { kind: 'steam', at: { x: 0, y: 0 }, radius: 50, seed: 11, durationMs: 1200 }, 0);
    const xs = [];
    const g = fx.display;
    g.drawCircle = (x, y, r) => { xs.push([x, y, r]); return g; };
    fx.update(400);
    return xs;
  };
  assert.deepEqual(draw(), draw());
});

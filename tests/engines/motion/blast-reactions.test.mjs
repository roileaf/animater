import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLAST_REACTIONS, caughtBy, createBlastReactions, pushedTo, reactionLife, reactionOf, reactionSecondsOf, reactionTint } from '../../../scripts/engines/motion/blast-reactions.mjs';
import { bodyPose, BODY_PRIORITY } from '../../../scripts/engines/motion/condition-body.mjs';

test('each kind its reaction: fire burns, cold frosts, lightning shocks, force and sound shove, void and mind tremble', () => {
  assert.equal(reactionOf('fire'), 'burn'); assert.equal(reactionOf('cold'), 'frost'); assert.equal(reactionOf('electricity'), 'shock');
  assert.equal(reactionOf('force'), 'shove'); assert.equal(reactionOf('sonic'), 'shove'); assert.equal(reactionOf('void'), 'tremble'); assert.equal(reactionOf('psychic'), 'tremble');
  assert.equal(reactionOf('acid'), null); assert.equal(Object.keys(BLAST_REACTIONS).length, 7);
});

test('who is caught: inside the ring, or reaching into it; each with the way away from the blast', () => {
  const tokens = [{ id: 'in', x: 100, y: 0, w: 100 }, { id: 'edge', x: 220, y: 0, w: 100 }, { id: 'out', x: 400, y: 0, w: 100 }, { id: 'mid', x: 0, y: 0, w: 100 }];
  const caught = caughtBy({ x: 0, y: 0, radius: 200 }, tokens);
  assert.deepEqual(caught.map((c) => c.id), ['in', 'edge', 'mid']);
  assert.deepEqual(caught[0].away, { x: 1, y: 0 });
  assert.ok(Math.hypot(caught[2].away.x, caught[2].away.y) === 1, 'one at the very middle still has a way');
});

test('it lasts as long as set, fading at the end; really pushed, half a square away, never through a wall', () => {
  assert.equal(reactionLife(1, 5), 1); assert.ok(reactionLife(4.5, 5) < 0.5 && reactionLife(4.5, 5) > 0); assert.equal(reactionLife(5, 5), 0);
  assert.equal(reactionSecondsOf(99), 12); assert.equal(reactionSecondsOf(undefined), 5);
  assert.deepEqual(pushedTo({ x: 100, y: 0, away: { x: 1, y: 0 } }, 100), { x: 150, y: 0 });
  assert.equal(pushedTo({ x: 100, y: 0, away: { x: 1, y: 0 } }, 100, () => true), null);
  assert.ok(reactionTint('frost', 1).amount > reactionTint('burn', 1).amount);
});

test('arcs branch and stay near their ends; the shaders have no reversed edges', async () => {
  const { arcSegments, BLAST_REACTION_SHADERS, BLAST_REACTION_FILTERS } = await import('../../../scripts/engines/motion/blast-reactions.mjs');
  let s = 1; const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const segs = arcSegments(0, 0, 100, 0, { rough: 30, random });
  assert.ok(segs.length > 32, 'more than a straight chain: it branches');
  assert.ok(segs.every((seg) => seg.every((v, i) => (i % 2 ? Math.abs(v) < 120 : v > -80 && v < 200))));
  for (const src of [...BLAST_REACTION_SHADERS.map(([, f]) => f), ...BLAST_REACTION_FILTERS]) assert.ok(!/smoothstep\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,/.exec(src) || (() => { for (const m of src.matchAll(/smoothstep\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,/g)) if (Number(m[1]) > Number(m[2])) return false; return true; })(), 'never edge0 past edge1');
});

test('a shove throws the body out and back; it outranks a creature\'s other poses while it lasts', () => {
  const dir = { x: 1, y: 0 }, early = bodyPose('shove', 0.25, 1, { dir }), late = bodyPose('shove', 1.4, 1, { dir });
  assert.ok(early.x > 0.4 && Math.abs(early.y) < 1e-9, 'out along the way'); assert.equal(late.x, 0, 'back where it stood');
  assert.ok(BODY_PRIORITY.indexOf('shove') < BODY_PRIORITY.indexOf('prone'));
});

test('the layer draws on the caught, tints them while it lasts, and gives their colour back', () => {
  class Thing { constructor() { this.position = { set() {} }; this.scale = { set() {} }; } destroy() { this.destroyed = true; } }
  class Graphics extends Thing { clear() {} beginFill() {} endFill() {} drawCircle() {} lineStyle() {} moveTo() {} lineTo() {} }
  class Geometry { addAttribute() { return this; } addIndex() { return this; } }
  class Mesh extends Thing { constructor(g, shader) { super(); this.shader = shader; } }
  class Filter { constructor(v, f, uniforms) { this.uniforms = uniforms; } }
  const Shader = { from: (v, f, uniforms) => ({ uniforms }) };
  const mesh = { tint: 0xffffff, position: { x: 0, y: 0 }, width: 100, height: 100, destroyed: false, filters: null }, kids = [];
  const PIXI = { Graphics, Geometry, Mesh, Filter, Shader, BlurFilter: Filter, BLEND_MODES: { ADD: 1 } };
  const layer = createBlastReactions({ PIXI, root: () => ({ addChild: (g) => kids.push(g) }), meshOf: () => mesh });
  layer.play('frost', [{ id: 'a', x: 0, y: 0 }], { seconds: 2 });
  assert.equal(layer.count, 1);
  layer.tick(0.5); assert.notEqual(mesh.tint, 0xffffff, 'rimed');
  layer.tick(2); assert.equal(layer.count, 0); assert.equal(mesh.tint, 0xffffff, 'its own colour back');
  layer.play('shove', [{ id: 'a', x: 0, y: 0 }]); assert.equal(layer.count, 0, 'the shove moves the body, not drawn here');
  layer.play('tremble', [{ id: 'a', x: 0, y: 0 }], { seconds: 2 }); assert.equal(mesh.filters.length, 1, 'its art warps');
  layer.tick(3); assert.equal(mesh.filters, null, 'the warp comes off again');
  layer.play('burn', [{ id: 'a', x: 0, y: 0 }], { seconds: 2 }); layer.tick(0.5); assert.equal(mesh.tint, 0xffffff, 'fire lights it by its flames, never darkens it');
  layer.play('shock', [{ id: 'a', x: 0, y: 0 }], { seconds: 2 }); layer.tick(0.1); layer.clear(); assert.equal(layer.count, 0);
});

test('main wires it: every screen reacts, the GM alone really pushes, and three settings say how', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /blastReactions\.play\(reaction, caught, \{ seconds, seed \}\)/);
  assert.match(main, /if \(reaction === 'shove' && !push\)/);
  assert.match(main, /hotSetting\("blastPush"\) === true && game\.user\.isGM/);
  for (const k of ['blastReactions', 'blastReactionSeconds', 'blastPush']) assert.match(main, new RegExp(`registerSetting\\("${k}"`));
});

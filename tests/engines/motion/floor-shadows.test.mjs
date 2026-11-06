import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { castsShadow, dockStyleOf, overShadowOf, showsPosts } from '../../../scripts/engines/motion/region-steps.mjs';
import { SHADOW_FRAG, STRIP_FRAG, DECK_FRAG, PIECE, PIECE_FRAG, dockPieces, floorBody, longEdges, postSpots, shadowStretch } from '../../../scripts/engines/motion/floor-shadows.mjs';
import { WATER_SHADERS } from '../../../scripts/engines/motion/water-engine.mjs';

test('a region casts a shadow when it says so, or by default when it stands over water', () => {
  assert.equal(castsShadow({}), false);
  assert.equal(castsShadow(undefined), false);
  assert.equal(castsShadow({ castShadow: true }), true);
  assert.equal(castsShadow({ overWater: true }), true);
  assert.equal(castsShadow({ overWater: true, castShadow: false }), false, 'its own say comes first');
});

test('the shadows on the ground and on the water share their patterns', () => {
  for (const frag of [SHADOW_FRAG, WATER_SHADERS.full, WATER_SHADERS.simple]) assert.match(frag, /float overPattern\(vec2 at, float kind, float across\)/);
  assert.match(SHADOW_FRAG, /uToSun \* uLift/, 'away from the sun');
  assert.match(SHADOW_FRAG, /sunReach\(vWorld\)/, 'none where walls or trees already keep the light off');
});

test('a shadow is wired so it never falls on itself or doubles on water', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes('blockers: [areas, ...high, ...moving.map((m) => m.areas)]'));
  assert.ok(main.includes('floorShadows.tick(') && main.includes('floorShadows.clear()'));
});

test('each floor has its own posts, if any', () => {
  assert.equal(floorBody('wood').post.square, false, 'round posts');
  assert.equal(floorBody('stone').post.square, true, 'square pillars');
  assert.equal(floorBody('glass').post, undefined, 'glass stands on nothing of its own');
  assert.deepEqual(floorBody('anything else'), {});
});

test('posts stand along long edges, outside the region, where they may', () => {
  const area = [100, 0, 300, 0, 300, 1000, 100, 1000], inside = (x, y) => x > 100 && x < 300 && y > 0 && y < 1000;
  const all = postSpots([area], { grid: 100, gap: 2, size: 0.1, inside });
  assert.ok(all.length >= 8, 'along both long sides');
  for (const p of all) assert.equal(inside(p.x, p.y), false, 'outside it');
  assert.ok(all.every((p) => p.x < 100 || p.x > 300), 'not across its short ends');
  assert.ok(all.some((p) => p.x < 100) && all.some((p) => p.x > 300), 'on both sides');
  const left = all.filter((p) => p.x < 100).map((p) => Math.round(p.y)).sort((m, n) => m - n), right = all.filter((p) => p.x > 300).map((p) => Math.round(p.y)).sort((m, n) => m - n);
  assert.deepEqual(left, right, 'across from one another');
  assert.equal(postSpots([area], { grid: 100, gap: 2, inside, where: (x) => x > 200 }).every((p) => p.x > 200), true, 'only where one may stand');
  assert.ok(postSpots([[0, 0, 5000, 0, 5000, 5000, 0, 5000]], { grid: 100, gap: 0.2, inside: () => false }).length <= 160, 'not without end');
});

test('a plain floor is the floor and its shadow: no sides, nothing against it', () => {
  assert.ok(!SHADOW_FRAG.includes('against'), 'no dark band on the ground');
  const source = readFileSync(new URL('../../../scripts/engines/motion/floor-shadows.mjs', import.meta.url), 'utf8'), main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('EDGE_FRAG'), 'no side, lip or rim');
  assert.ok(main.includes('contact: false, cut:'), 'no dark band on the water');
  for (const frag of [SHADOW_FRAG, STRIP_FRAG, DECK_FRAG, PIECE_FRAG]) { assert.ok(!frag.includes('\u0060')); assert.ok(!/\b(packed|input|output|sample|filter|half|fixed|common|active|cast|long|short|flat)\b(?!\s*\()/.test(frag.replace(/\/\/.*$/gm, '')), 'no word GLSL keeps for itself'); }
});

const pier = [100, 0, 220, 0, 220, 1000, 100, 1000], inPier = (x, y) => x > 100 && x < 220 && y > 0 && y < 1000;
const built = (style, floor = 'wood', extra = {}) => { const edges = longEdges([pier], { grid: 100, inside: inPier }), body = floorBody(floor), size = style === 'old' ? body.post.size : body.post.slim, posts = postSpots([pier], { grid: 100, gap: body.post.gap, size, inside: inPier }); return { edges, posts, ...dockPieces({ style, floor, grid: 100, posts, edges, ...extra }) }; };
const kinds = (list) => new Set(list.map((p) => p.kind));

test('a floor is plain until built, and shows its posts until told not to', () => {
  assert.equal(dockStyleOf({}), '');
  assert.equal(dockStyleOf({ dockStyle: 'old' }), 'old');
  assert.equal(dockStyleOf({ dockStyle: 'nonsense' }), '');
  assert.equal(showsPosts({}), true);
  assert.equal(showsPosts({ overPosts: false }), false);
  assert.deepEqual(dockPieces({ style: '', floor: 'wood' }), { strips: [], pieces: [] });
  assert.deepEqual(dockPieces({ style: 'old', floor: 'glass' }), { strips: [], pieces: [] }, 'glass has no posts to stand on');
  assert.equal(overShadowOf({}, 'wood').kind, 'planks');
  assert.equal(overShadowOf({ dockStyle: 'old' }, 'wood').kind, 'solid', 'a clean copy of it');
  assert.equal(overShadowOf({ dockStyle: 'old', overShadows: { wood: 'slats' } }, 'wood').kind, 'slats', 'unless chosen');
});

test('long edges know the way out of the region', () => {
  const edges = longEdges([pier], { grid: 100, inside: inPier });
  assert.equal(edges.length, 2, 'not its short ends');
  for (const e of edges) assert.equal(inPier((e.ax + e.bx) / 2 + e.nx * 5, (e.ay + e.by) / 2 + e.ny * 5), false);
});

test('old boards have thick posts and beam ends and no rails', () => {
  const { posts, pieces, strips } = built('old'), have = kinds(pieces);
  assert.ok(posts.length >= 8);
  assert.ok(have.has(PIECE.round) && have.has(PIECE.beam) && have.has(PIECE.board) && have.has(PIECE.bolt));
  assert.ok(!have.has(PIECE.rail) && !have.has(PIECE.upright));
  assert.equal(strips.filter((s) => s.lifts[1] === 1 && s.lifts[0] === 0).length, posts.length, 'a shadow from each post to the deck\'s');
  assert.ok(pieces.findLastIndex((p) => p.kind === PIECE.board) < pieces.findIndex((p) => p.kind === PIECE.round), 'posts over its edge boards');
});

test('a railed pier has slim posts, rails and their shadow on deck and below', () => {
  const { pieces, strips, posts } = built('railed'), have = kinds(pieces), radius = pieces.find((p) => p.kind === PIECE.round).half[0];
  assert.ok(have.has(PIECE.rail) && have.has(PIECE.upright));
  assert.ok(radius < built('old').pieces.find((p) => p.kind === PIECE.round).half[0]);
  assert.ok(strips.some((s) => s.clip === 1 && s.lifts[2] === 1), 'on its deck');
  assert.ok(strips.some((s) => s.clip === 0 && s.lifts[0] === 1 && s.lifts[2] === 1), 'beyond its shadow');
  assert.ok(posts.length > 0);
});

test('without posts there are no beam ends or post shadows, and the rest stays', () => {
  const edges = longEdges([pier], { grid: 100, inside: inPier }), bare = dockPieces({ style: 'railed', floor: 'wood', grid: 100, posts: [], edges }), have = kinds(bare.pieces);
  assert.ok(!have.has(PIECE.round) && !have.has(PIECE.beam));
  assert.ok(have.has(PIECE.rail) && have.has(PIECE.board));
});

test('each floor builds in its own way', () => {
  assert.ok(built('old', 'stone').pieces.some((p) => p.kind === PIECE.square), 'square pillars');
  assert.ok(!built('old', 'stone').pieces.some((p) => p.kind === PIECE.beam || p.kind === PIECE.bolt), 'no beams or bolts in stone');
  assert.ok(built('railed', 'metal').pieces.some((p) => p.kind === PIECE.square));
  assert.ok(!built('old', 'wood', { painted: false }).pieces.some((p) => p.kind === PIECE.board || p.kind === PIECE.bolt), 'not painted: nothing on its top');
});

test('what lies on water meets the shadow the water draws', () => {
  const water = readFileSync(new URL('../../../scripts/engines/motion/water-engine.mjs', import.meta.url), 'utf8');
  assert.ok(water.includes('(1.0 + 1.6 * clamp((0.62 - uSunColor.b) / 0.45, 0.0, 1.0))'), 'the water reads it from the colour of the sun');
  assert.equal(shadowStretch({ onWater: true, blue: 1 }), 1);
  assert.ok(Math.abs(shadowStretch({ onWater: true, blue: 0.17 }) - 2.6) < 1e-9);
  assert.equal(shadowStretch({ low: 0.5 }), 1.8);
  assert.ok(STRIP_FRAG.includes('uAway * uReach'), 'lost in the deck\'s own shadow');
});

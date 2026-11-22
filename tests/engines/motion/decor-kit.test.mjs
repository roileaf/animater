// The catalog's kits (decor-kit.mjs): pieces painted from a palette asked for at painting time, not from colours
// written into them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WOODS, METALS, CLOTHS, WOOD_IDS, METAL_IDS, CLOTH_IDS, STATES, KIT_PIECES, KIT_IDS, RICH_IDS, varied, paletteOf, paintKitPiece } from '../../../scripts/engines/motion/decor-kit.mjs';
import { seeded } from '../../../scripts/engines/motion/decor-paint.mjs';

const HEX = /^#[0-9a-f]{6}$/;
// A canvas that paints nothing and remembers every colour handed to it.
const recorder = () => {
  const seen = new Set();
  const ctx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern' ? () => ({ addColorStop() {} }) : p === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}),
    set: (t, p, v) => { if ((p === 'fillStyle' || p === 'strokeStyle') && typeof v === 'string') seen.add(v); t[p] = v; return true; },
  });
  return { seen, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (n >> 16 & 255) * 0.3 + (n >> 8 & 255) * 0.59 + (n & 255) * 0.11; };

test('the palettes: seven woods, five metals, eight dyes, each a name and a colour', () => {
  assert.deepEqual([WOOD_IDS.length, METAL_IDS.length, CLOTH_IDS.length], [7, 5, 8]);
  for (const set of [WOODS, METALS, CLOTHS]) for (const [id, m] of Object.entries(set)) { assert.match(m.base, HEX, id); assert.ok(m.label, id); }
  assert.deepEqual(STATES, ['standing', 'fallen', 'broken']);
});

test('a colour varied stays near itself, the same for the same seed, and not at all when none is asked', () => {
  assert.equal(varied('#8a6a42', seeded(3), 0), '#8a6a42');
  assert.equal(varied('#8a6a42', seeded(3)), varied('#8a6a42', seeded(3)));
  const many = new Set(Array.from({ length: 30 }, (_, i) => varied('#8a6a42', seeded(i + 1))));
  assert.ok(many.size > 20, 'thirty seeds, more than twenty oaks');
  for (const c of many) { assert.match(c, HEX); assert.ok(Math.abs(lum(c) - lum('#8a6a42')) < 30, c); }
  // Grey has no hue to move.
  assert.match(varied('#808080', seeded(1)), HEX);
});

test('a palette is the look asked for: its wood, metal and cloth, darker and greyer with wear', () => {
  const flat = () => 0.5, fresh = paletteOf({ wood: 'pine', metal: 'brass', cloth: 'blue', vary: 0 }, flat);
  assert.deepEqual([fresh.wood, fresh.metal, fresh.cloth], [WOODS.pine.base, METALS.brass.base, CLOTHS.blue.base]);
  const old = paletteOf({ wood: 'pine', metal: 'brass', cloth: 'blue', vary: 0, wear: 1 }, flat);
  // (A dark dye fades toward grey, so only the wood is sure to darken.)
  assert.ok(lum(old.wood) < lum(fresh.wood)); assert.notEqual(old.cloth, fresh.cloth); assert.notEqual(old.metal, fresh.metal);
  for (const k of ['wood', 'metal', 'cloth']) assert.match(old[k], HEX);
  // What is not asked for, or not known, is oak, iron and red.
  const plain = paletteOf({ wood: 'nope', vary: 0 }, flat);
  assert.deepEqual([plain.wood, plain.metal, plain.cloth], [WOODS.oak.base, METALS.iron.base, CLOTHS.red.base]);
});

test('every piece paints in every state it has, in the colours asked for', () => {
  assert.ok(KIT_IDS.length >= 13);
  for (const id of KIT_IDS) {
    const k = KIT_PIECES[id];
    assert.ok(k.label && k.set && k.size > 0, id);
    assert.equal(k.states[0], 'standing', id);
    for (const s of k.states) assert.ok(STATES.includes(s), `${id} ${s}`);
    for (const state of k.states) {
      const { seen, make } = recorder(), r = paintKitPiece(id, 11, 120, { wood: 'walnut', metal: 'copper', cloth: 'green', state, vary: 0 }, make);
      assert.ok(r.outlines.length > 0 && r.outlines.every((o) => o.length >= 3 && o.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))), `${id} ${state}`);
      // Inside its picture, with room for its shadow.
      const half = r.canvas.width / 2; for (const o of r.outlines) for (const [x, y] of o) assert.ok(Math.abs(x) <= half && Math.abs(y) <= half, `${id} ${state} within its picture`);
      assert.ok(seen.size > 3, `${id} ${state} painted`);
    }
    // A state it has not got is painted standing.
    assert.ok(paintKitPiece(id, 1, 80, { state: 'nonsense' }, recorder().make));
  }
  assert.equal(paintKitPiece('nope', 1, 80, {}, recorder().make), null);
});

test('one piece, one palette, many seeds: no two quite the same colour; and the same seed, the same piece', () => {
  const woods = new Set();
  for (let seed = 1; seed <= 20; seed++) woods.add(paintKitPiece('crate', seed, 80, { wood: 'oak' }, recorder().make).palette.wood);
  assert.ok(woods.size >= 15);
  const a = paintKitPiece('chair', 5, 80, { wood: 'ash', cloth: 'purple' }, recorder().make), b = paintKitPiece('chair', 5, 80, { wood: 'ash', cloth: 'purple' }, recorder().make);
  assert.deepEqual(a.palette, b.palette); assert.deepEqual(a.outlines, b.outlines);
  // Knocked over, it is still the same wood.
  assert.equal(paintKitPiece('chair', 5, 80, { wood: 'ash', state: 'fallen' }, recorder().make).palette.wood, paintKitPiece('chair', 5, 80, { wood: 'ash' }, recorder().make).palette.wood);
});

test('the richer finish (a trial): the same piece, palette and outline size, painted another way', () => {
  assert.deepEqual([...RICH_IDS].sort(), [...KIT_IDS].sort());
  for (const id of RICH_IDS) {
    const { seen, make } = recorder(), r = paintKitPiece(id, 4, 160, { wood: 'oak', finish: 'rich' }, make), plain = paintKitPiece(id, 4, 160, { wood: 'oak' }, recorder().make);
    // The same wood, painted warmer (the richer finish's own colour); and the same again for the same seed.
    // (A piece with no first-finish painting is the richer one either way.)
    assert.ok(Math.abs(lum(r.palette.wood) - lum(plain.palette.wood)) < 16, id);
    assert.deepEqual(paintKitPiece(id, 4, 160, { wood: 'oak', finish: 'rich' }, recorder().make).palette, r.palette, id);
    assert.ok(r.outlines.length > 0 && seen.size > 3, id);
    // No black ink line round it: its outline is thin and in its own colour darkened (Roi chose this over a bold one).
    assert.equal(seen.has('rgba(22,14,6,0.95)'), false, id); assert.equal(seen.has('rgba(18,12,8,0.96)'), false, id);
  }
  // A state it has no richer painting of is painted as before.
  assert.ok(paintKitPiece('barrel', 4, 160, { finish: 'rich', state: 'fallen' }, recorder().make));
});

test('more detail is asked for, not forced: the same piece under it, with more painted on', () => {
  for (const id of RICH_IDS) {
    const a = recorder(), b = recorder(), plain = paintKitPiece(id, 9, 160, { wood: 'oak', finish: 'rich' }, a.make), more = paintKitPiece(id, 9, 160, { wood: 'oak', finish: 'rich', detail: true }, b.make);
    // The same piece: its outline and colours are untouched, and the detail throws its own dice.
    assert.deepEqual(more.outlines, plain.outlines, id); assert.deepEqual(more.palette, plain.palette, id);
    assert.ok(b.seen.size >= a.seen.size, `${id} has no less painted on it`);
  }
});

test('warmer colour, painted form, a crisper line: tried one by one, all kept, each still its own switch', () => {
  const off = { warm: false, form: false, line: false }, base = paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich', ...off }, recorder().make);
  // All three are on unless turned off.
  assert.deepEqual(paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich' }, recorder().make).palette, paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich', warm: true }, recorder().make).palette);
  // Warmer changes the colours and nothing else; form and line leave the colours alone.
  assert.notEqual(paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich', ...off, warm: true }, recorder().make).palette.wood, base.palette.wood);
  for (const more of [{ form: true }, { line: true }, { fine: true }]) assert.deepEqual(paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich', ...off, ...more }, recorder().make).palette, base.palette);
  // None of them moves the piece: the same outline, so the same shadow.
  for (const more of [{ warm: true }, { form: true }, { line: true }, { fine: true }, { warm: true, form: true, line: true, fine: true }]) assert.deepEqual(paintKitPiece('longTable', 9, 200, { wood: 'oak', finish: 'rich', ...more }, recorder().make).outlines, base.outlines);
});

test('the kit holds no wood, metal or cloth colour of its own: those come from the palettes', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/decor-kit.mjs', import.meta.url), 'utf8'), pieces = src.slice(src.indexOf('const KIT = {'), src.indexOf('the richer finish (a trial)'));
  const own = new Set(pieces.match(/#[0-9a-f]{6}/g) ?? []);
  // Only the dark of a hole or an inside, water in a bucket, and the hemp and withy a dye is mixed into.
  assert.deepEqual([...own].sort(), ['#120c06', '#17100a', '#1a120a', '#1c140c', '#22303a', '#b79c6a', '#c9a868']);
});

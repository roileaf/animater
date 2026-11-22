// The kit under the world's conditions (decor-kit.mjs): season, rain, snow, frost, night, cave — and the flags the
// light, glow, wind and water engines read off a kind. Roi: "make sure ... it supports season, weather, light and
// shadow engines."
import test from 'node:test';
import assert from 'node:assert/strict';
import { KIT_PIECES, KIT_IDS, paintKitPiece } from '../../../scripts/engines/motion/decor-kit.mjs';
import { DECOR_KINDS, DECOR_IDS } from '../../../scripts/engines/motion/decor-paint.mjs';

// A canvas that paints nothing and remembers every colour handed to it (and which composite it was laid with).
const recorder = () => {
  const seen = new Set(), atop = new Set(), filters = new Set();
  const ctx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern' ? () => ({ addColorStop() {} }) : () => {}),
    set: (t, p, v) => { if ((p === 'fillStyle' || p === 'strokeStyle') && typeof v === 'string') { seen.add(v); if (t.globalCompositeOperation === 'source-atop') atop.add(v); } if (p === 'filter') filters.add(v); t[p] = v; return true; },
  });
  return { seen, atop, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};
const paint = (id, look = {}) => { const r = recorder(); return { ...r, piece: paintKitPiece(id, 7, 160, { finish: 'rich', detail: true, ...look }, r.make) }; };
const added = (a, b) => [...b].filter((c) => !a.has(c));

test('the season turns what grows: the same plant, its greens gone to autumn or to winter straw', () => {
  for (const id of ['bush', 'fern', 'grass', 'reeds', 'cattails', 'lilyPads', 'moss', 'planter', 'fairyRing']) {
    const summer = paint(id), autumn = paint(id, { season: 'autumn' }), winter = paint(id, { season: 'winter' });
    assert.ok(added(summer.seen, autumn.seen).length > 0, `${id} in autumn`);
    assert.ok(added(summer.seen, winter.seen).length > 0, `${id} in winter`);
    // The same plant: its outline does not move with the season.
    assert.deepEqual(autumn.piece.outlines, summer.piece.outlines, id); assert.deepEqual(winter.piece.outlines, summer.piece.outlines, id);
  }
  // What is made of boards does not turn.
  assert.deepEqual([...paint('crate', { season: 'autumn' }).seen].sort(), [...paint('crate').seen].sort());
});

test('flowers do not bloom in winter, and the plant under them is the same plant', () => {
  const summer = paint('flowers'), winter = paint('flowers', { season: 'winter' });
  assert.ok(summer.seen.has('#e6c04a') && !winter.seen.has('#e6c04a'), 'no flower hearts in winter');
  assert.deepEqual(winter.piece.outlines, summer.piece.outlines);
});

test('rain darkens everything but water; snow lies on whatever is there, more the more it has snowed', () => {
  const dry = paint('longTable'), wet = paint('longTable', { wet: 1 });
  assert.ok([...wet.atop].some((c) => c.startsWith('rgba(10,14,18,')) && dry.atop.size === 0);
  assert.equal([...paint('puddle', { wet: 1 }).atop].some((c) => c.startsWith('rgba(10,14,18,')), false, 'water is not wetted');
  const light = paint('longTable', { snow: 0.3 }), deep = paint('longTable', { snow: 1 });
  assert.ok([...light.atop].some((c) => c.startsWith('rgba(242,247,251,')) && [...deep.atop].some((c) => c.startsWith('rgba(242,247,251,')));
  assert.notDeepEqual([...light.atop].sort(), [...deep.atop].sort());
  // Laid on the piece, not round it: only ever over what is already painted.
  assert.ok(deep.atop.size > 0);
});

test('still water freezes; a cave makes stone darker; night shows what gives light', () => {
  for (const id of ['puddle', 'cavePool', 'bucket', 'trough', 'well']) assert.ok(added(paint(id).seen, paint(id, { frozen: true }).seen).includes('rgba(206,226,236,0.82)'), `${id} frozen`);
  assert.equal(paint('crate', { frozen: true }).seen.has('rgba(206,226,236,0.82)'), false);
  for (const id of ['boulder', 'rubble', 'well', 'hearth', 'stalagmite']) assert.ok(added(paint(id).seen, paint(id, { cave: true }).seen).length > 0, `${id} in a cave`);
  assert.ok(paint('lampPost', { night: true }).seen.has('#f6de9a') && !paint('lampPost').seen.has('#f6de9a'));
  assert.ok(paint('glowShrooms', { night: true }).seen.has('rgba(110,230,200,0.44)'));
});

test('a kit piece carries the flags the engines read off the decoration it stands in for', () => {
  for (const id of KIT_IDS) {
    const old = DECOR_KINDS[id]; if (!old) continue;
    const k = KIT_PIECES[id];
    assert.deepEqual(k.light, old.light, `${id} light`); assert.deepEqual(k.glow, old.glow, `${id} glow`);
    assert.equal(k.cloth, old.cloth, `${id} cloth`); assert.equal(k.water, old.water, `${id} water`);
    assert.equal(k.flat, old.flat, `${id} lies flat or stands as the old one does`);
    // The same footprint and the same height, so its shadow is as long and it takes up the same ground.
    assert.equal(k.size, old.size, `${id} size`); assert.equal(k.height, old.height, `${id} height`);
  }
  assert.deepEqual(KIT_IDS.filter((id) => KIT_PIECES[id].light).sort(), ['brazier', 'candles', 'hearth', 'lampPost']);
  assert.deepEqual(KIT_IDS.filter((id) => KIT_PIECES[id].glow).sort(), ['crystals', 'glowShrooms', 'lavaCrack']);
});

test('cloth the wind moves comes with its mask, and every piece with an outline for its shadow', () => {
  for (const id of ['tent', 'marketStall', 'washingLine', 'papers']) assert.ok(paint(id).piece.cloth, `${id} has a cloth mask`);
  assert.equal(paint('crate').piece.cloth, null);
  for (const id of KIT_IDS) { const r = paint(id).piece; assert.ok(r.shadow && r.outlines.length > 0, `${id} casts`); assert.ok(r.height >= 0); }
});

test('what is still to be painted in the house look: the trees, and nothing else', () => {
  const left = DECOR_IDS.filter((id) => !KIT_PIECES[id]);
  assert.ok(left.every((id) => DECOR_KINDS[id].tree), `not trees: ${left.filter((id) => !DECOR_KINDS[id].tree)}`);
});

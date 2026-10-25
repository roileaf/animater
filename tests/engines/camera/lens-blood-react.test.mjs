import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensSplats, splatState, lensSplashFor, admitSplash, BLOOD_REACTIONS } from '../../../scripts/engines/camera/lens-blood.mjs';
import { splatData, paint, paintReply } from '../../../scripts/engines/camera/lens-blood-paint.mjs';
import { drawSplat } from '../../../scripts/engines/camera/lens-blood-draw.mjs';

const VIEW = { width: 1600, height: 900 };
const SEEDS = Array.from({ length: 12 }, (_, i) => `react-${i}`);
const splats = (wound, extra = {}) => SEEDS.flatMap((seed) => lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 0.9, wound, ...extra }));
const withDrips = (list) => list.filter((s) => s.drips.length);

// A 2D context (and canvases of them) counting what is drawn.
function recorder(canvas = null) {
  const calls = {};
  const ctx = new Proxy({ canvas }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => { calls[key] = (calls[key] ?? 0) + 1; return { addColorStop() {} }; };
      if (key === 'getTransform') return () => ({ a: 1, b: 0 });
      return () => { calls[key] = (calls[key] ?? 0) + 1; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}
function canvases() {
  const made = [];
  const make = (width, height) => { const canvas = { width, height }; const r = recorder(canvas); canvas.getContext = () => r.ctx; made.push(r); return canvas; };
  return { make, made };
}

test('every damage type with a reaction gives its splats one; physical blades and points and no type give none', () => {
  for (const type of BLOOD_REACTIONS) for (const s of splats(type)) assert.equal(s.react?.type, type, type);
  for (const type of ['slashing', 'piercing', null]) for (const s of splats(type)) assert.equal(s.react, undefined, String(type));
});

test('the reaction is seeded: same seed, same reaction; and the shapes stay those the type always had', () => {
  for (const type of BLOOD_REACTIONS) assert.deepEqual(lensSplats('same', { amount: 'heavy', ...VIEW, strength: 1, crit: true, wound: type }), lensSplats('same', { amount: 'heavy', ...VIEW, strength: 1, crit: true, wound: type }));
  const strip = (list) => list.map(({ react, drips, ...s }) => { void react; void drips; return s; });
  // Its own random stream: the geometry is the same as without it (fire's mix is drawn the same either way).
  const a = lensSplats('geo', { amount: 'heavy', ...VIEW, strength: 1, wound: 'fire' });
  const b = lensSplats('geo', { amount: 'heavy', ...VIEW, strength: 1, wound: 'fire', still: true });
  assert.deepEqual(strip(a), strip(b));
});

test('fire cooks the blood: bubbles fizz at its edges in the first second, steam rises, it dries fast and its drips stop short', () => {
  const list = splats('fire');
  assert.ok(list.some((s) => s.react.bubbles.length >= 6));
  for (const s of list) for (const b of s.react.bubbles) assert.ok(b.t0 + b.ms <= 1300, 'fizzing only at first');
  assert.ok(list.some((s) => s.react.wisps.length), 'a wisp of steam');
  assert.ok(list.some((s) => s.react.cracks.length >= 4), 'crackled');
  const s = list.find((x) => x.shape === 'blob' || x.shape === 'crown');
  assert.ok(splatState(s, s.lifeMs * 0.4).dry > 0.95, 'cooked dark well before plain blood dries');
  const plain = lensSplats(SEEDS[0], { amount: 'heavy', ...VIEW, strength: 0.9, wound: 'slashing' })[0];
  assert.ok(splatState(plain, plain.lifeMs * 0.4).dry < 0.3);
  for (const d of withDrips(list).flatMap((x) => x.drips)) assert.ok(d.stop > 0 && d.stop <= 0.4);
  const dripper = withDrips(list)[0], end = splatState(dripper, dripper.lifeMs * 0.69).drips;
  dripper.drips.forEach((d, i) => assert.ok(end[i] <= d.length * 0.4 + 1e-9, 'stopped short'));
});

test('electricity fries it: no drips, sparks off its edges as it lands and between neighbours, its shine flickers', () => {
  const list = splats('electricity');
  assert.ok(list.every((s) => s.drips.length === 0));
  assert.ok(list.some((s) => s.react.sparks.length));
  assert.ok(list.some((s) => s.react.arcs?.length), 'sparks jump between splats');
  for (const s of list) for (const a of s.react.arcs ?? []) assert.ok(a.t0 < 500 && a.pts.length >= 8);
  const s = list.find((x) => x.react.flickerMs);
  const shine = Array.from({ length: 10 }, (_, i) => splatState(s, (s.delayMs ?? 0) + 40 + i * 30).highlight);
  assert.ok(new Set(shine.map((v) => v.toFixed(2))).size > 2, 'flickers');
  assert.equal(splatState(s, s.lifeMs * 0.5).highlight, 1 - splatState(s, s.lifeMs * 0.5).dry * 0.9, 'then steady');
});

test('cold freezes its drips dead, then they run on as it thaws near the end; its frost comes in and goes', () => {
  const s = withDrips(splats('cold'))[0], d = s.drips[0];
  assert.ok(d.freezeMs > d.delayMs && d.thawMs > d.freezeMs);
  const at = (ms) => splatState(s, ms).drips[0];
  const frozen = at(d.freezeMs + 10);
  assert.ok(frozen > 0);
  assert.equal(at(d.thawMs - 10), frozen, 'frozen dead');
  assert.ok(at(Math.min(s.lifeMs - 1, d.thawMs + 400)) > frozen, 'thawed: runs on');
  assert.ok(splatState(s, s.react.freezeMs + 50).aura > 0.9, 'frosted');
  assert.ok(splatState(s, s.lifeMs * 0.95).aura < splatState(s, s.lifeMs * 0.5).aura, 'thawing');
});

test('acid eats holes that grow; poison creeps and shimmers; void shrinks and curls; spirit rises and fades sooner', () => {
  const acid = splats('acid').find((s) => s.react.holes?.length);
  assert.ok(acid);
  for (const h of acid.react.holes) assert.ok(h.t0 < 1200 && h.ms > 1000 && h.r > 0 && h.lobes.length === 3);
  assert.ok(splats('acid').some((s) => s.react.bubbles?.length));
  const poison = splats('poison')[0];
  assert.ok(splatState(poison, poison.lifeMs * 0.85).scale > splatState(poison, 200).scale, 'creeps');
  assert.ok(splatState(poison, 900).aura > 0);
  const v = splats('void').find((s) => s.shape === 'blob');
  assert.ok(v.react.veins.length >= 3);
  const late = splatState(v, v.lifeMs * 0.9);
  assert.ok(late.scale < 0.95 && Math.abs(late.spin) > 0.05);
  const sp = splats('spirit')[0], spl = splatState(sp, sp.lifeMs * 0.6);
  assert.ok(spl.oy < 0 && spl.alpha < 1, 'drifts up, fading');
});

test('sonic wobbles, force and blunt blows slam past their size and settle, mental ghosts, vitality glows, bleed keeps running', () => {
  const so = splats('sonic')[0], w = [30, 60, 90].map((t) => splatState(so, (so.delayMs ?? 0) + t));
  assert.ok(w.some((st) => Math.abs(st.sx - 1) > 0.02) && Math.abs(splatState(so, (so.delayMs ?? 0) + 1500).sx - 1) < 0.01);
  const f = splats('force')[0];
  assert.ok(splatState(f, (f.delayMs ?? 0) + 45).scale > 1.08, 'pushed out');
  assert.ok(Math.abs(splatState(f, (f.delayMs ?? 0) + 600).scale - 1) < 0.01, 'settled');
  const m = splats('mental')[0];
  assert.ok(splatState(m, (m.delayMs ?? 0) + 100).ghost?.alpha > 0);
  assert.equal(splatState(m, (m.delayMs ?? 0) + 1500).ghost, null);
  const vit = splats('vitality')[0];
  assert.ok(splatState(vit, (vit.delayMs ?? 0) + 300).aura > 0.9 && splatState(vit, (vit.delayMs ?? 0) + 2000).aura === 0);
  const bleed = splats('bleed'), slash = splats('slashing');
  const total = (list) => list.reduce((t, s) => t + s.drips.reduce((a, d) => a + d.length, 0), 0);
  assert.ok(total(bleed) > total(slash) * 1.5, 'more and longer drips');
  assert.ok(bleed.some((s) => s.drips.some((d) => d.delayMs > s.lifeMs * 0.25)), 'some start late');
});

test('a crit reacts harder, Subtle softer; Low quality keeps only the static parts', () => {
  const sum = (list, f) => list.reduce((t, s) => t + f(s), 0);
  const bubbles = (opts) => sum(SEEDS.flatMap((seed) => lensSplats(seed, { ...VIEW, strength: 0.9, wound: 'fire', ...opts })), (s) => s.react.bubbles?.length ?? 0) / SEEDS.length;
  assert.ok(bubbles({ crit: true }) > bubbles({}) && bubbles({}) > 0);
  const subtle = lensSplats('s', { amount: 'subtle', ...VIEW, strength: 1, wound: 'sonic' })[0], heavy = lensSplats('s', { ...VIEW, strength: 1, wound: 'sonic' })[0];
  assert.ok(subtle.react.wobble.amp < heavy.react.wobble.amp);
  for (const type of BLOOD_REACTIONS) {
    for (const s of lensSplats('low', { amount: 'subtle', ...VIEW, strength: 1, wound: type, still: true })) {
      const r = s.react;
      assert.equal(r.still, true);
      for (const k of ['bubbles', 'wisps', 'sparks', 'arcs', 'sparkles', 'holes', 'wobble', 'slam', 'ghost', 'glow', 'creep', 'shrink', 'rise', 'jitter', 'flickerMs']) assert.equal(r[k], undefined, `${type} ${k}`);
      const st = splatState(s, 120);
      assert.deepEqual([st.sx, st.sy, st.spin, st.ox, st.oy, st.ghost], [1, 1, 0, 0, 0, null], type);
      for (const d of s.drips) assert.equal(d.freezeMs, undefined);
    }
  }
  // The splash says so at Low quality, and admitSplash passes it on.
  const hit = { role: 'attacker', before: { value: 40, max: 40 }, after: { value: 10, max: 40 }, screen: { x: 100, y: 100 }, view: VIEW, damageType: 'fire' };
  const low = lensSplashFor({ ...hit, quality: 'low' });
  assert.equal(low.still, true);
  assert.equal(lensSplashFor(hit).still, undefined);
  const { state } = admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, low, { now: 0, seed: 'l', width: 1600, height: 900 });
  assert.ok(state.splats.every((s) => s.react.still));
});

test('the paint worker gets what the reaction paints, and paints the same as here, its light (aura) sent back too', () => {
  for (const type of ['fire', 'electricity', 'cold', 'void', 'vitality', 'poison', 'spirit', 'force']) {
    const [s] = lensSplats(`w-${type}`, { amount: 'heavy', ...VIEW, strength: 1, crit: true, wound: type });
    const data = splatData(s);
    assert.deepEqual(structuredClone(data), data);
    assert.equal(data.react.type, type);
    for (const k of ['cracks', 'veins', 'needles', 'frost', 'glow', 'sheen', 'crisp', 'ethereal']) assert.deepEqual(data.react[k], s.react[k], `${type} ${k}`);
    assert.equal(data.react.bubbles, undefined, 'live marks stay here');
    for (const dried of [false, true]) {
      const a = canvases(), b = canvases();
      paint(s, 1, a.make, dried);
      const { reply, transfer } = paintReply({ id: 1, splat: structuredClone(data), dev: 1, dried }, b.make, (c) => ({ of: c }));
      assert.deepEqual(b.made.map((m) => m.calls), a.made.map((m) => m.calls), `${type} ${dried ? 'dried' : 'wet'}: same strokes`);
      const lit = !dried && ['cold', 'vitality', 'poison'].includes(type);
      assert.equal(!!reply.aura, lit, `${type} aura`);
      assert.equal(transfer.length, [reply.image, reply.glint, reply.aura].filter(Boolean).length);
    }
  }
});

test('per frame a reaction only draws: no sprite painted after the first, a few small marks, acid holes redone only a step at a time', () => {
  for (const type of BLOOD_REACTIONS) {
    for (const s of lensSplats(`f-${type}`, { amount: 'heavy', ...VIEW, strength: 1, crit: true, wound: type }).slice(0, 4)) {
      const { make, made } = canvases();
      drawSplat(recorder().ctx, s, splatState(s, 100), { canvas: make, shine: recorder().ctx });
      drawSplat(recorder().ctx, s, splatState(s, s.lifeMs * 0.6), { canvas: make, shine: recorder().ctx });
      const painted = made.length;
      for (let t = 120; t < s.lifeMs; t += 160) {
        const a = recorder(), g = recorder();
        drawSplat(a.ctx, s, splatState(s, t), { canvas: make, shine: g.ctx });
        const ops = (c) => (c.fill ?? 0) + (c.stroke ?? 0) + (c.drawImage ?? 0);
        assert.ok(ops(a.calls) + ops(g.calls) <= 60, `${type} ${s.shape} at ${t}: ${ops(a.calls) + ops(g.calls)} draws`);
      }
      // Acid's holed copy is one more canvas, made once; anything else paints nothing new after the first frames.
      assert.ok(made.length <= painted + (s.react.holes?.length ? 1 : 0), `${type}: ${made.length - painted} canvases made later`);
    }
  }
  // Holes: the copy is redone only when a hole grows a step (12 steps each, plus the drying's 24).
  const s = lensSplats('holes', { amount: 'heavy', ...VIEW, strength: 1, crit: true, wound: 'acid' }).find((x) => x.react.holes?.length);
  const { make, made } = canvases();
  for (let t = 0; t < s.lifeMs; t += 16) drawSplat(recorder().ctx, s, splatState(s, t), { canvas: make, shine: recorder().ctx });
  const copy = made.find((m) => m.calls.clearRect && !m.calls.fill && m.calls.drawImage > 1 && m.calls.createRadialGradient);
  assert.ok(copy, 'a holed copy');
  assert.ok(copy.calls.clearRect <= s.react.holes.length * 12 + 24 + 1, `redone ${copy.calls.clearRect} times`);
});

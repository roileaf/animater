import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS_BLOOD, lensAmount, lensSplashFor, hitStrength, dealtStrength, lensSplats, LENS_SHAPES, splatState, tunnelState, admitSplash, liveSplats, lingerLevel, cssColor, lensWho, lensRoleWanted, nearestNear, lensReach, LENS_REACH } from '../../../scripts/engines/camera/lens-blood.mjs';

const VIEW = { width: 1600, height: 900 };
const SEEDS = Array.from({ length: 24 }, (_, i) => `seed-${i}`);
const hp = (value, max = 40) => ({ value, max, down: value <= 0, marked: false });
// A blow seen on a player's screen: the player's own creature hit (victim) or hitting (attacker).
const blow = (extra = {}) => ({
  isGM: false, worldOn: true, localOn: true, quality: 'full', amount: 'heavy', gore: 'full',
  role: 'attacker', before: hp(30), after: hp(20), crit: false,
  bleeds: true, visible: true, hidden: false,
  screen: { x: 200, y: 450 }, attackerScreen: null, view: VIEW, ...extra,
});

test('a GM screen never shows lens blood', () => {
  assert.equal(lensSplashFor(blow({ isGM: true })), null);
  assert.equal(lensSplashFor(blow({ isGM: true, role: 'victim' })), null);
});

test('a bystander gets nothing: only the victim\'s and the attacker\'s players see it', () => {
  assert.equal(lensSplashFor(blow({ role: null })), null);
  assert.equal(lensSplashFor(blow({ role: 'bystander' })), null);
});

test('the player\'s creature hits an enemy: the enemy\'s blood lands on the side the enemy is', () => {
  const splash = lensSplashFor(blow());
  assert.equal(splash.kind, 'dealt');
  assert.deepEqual(splash.fromScreen, { x: 200, y: 450 });
  assert.equal(splash.edge, 'left');
  assert.equal(splash.tunnel, 0);
  // Relative to the attacker when it is known: an enemy above the attacker splashes the top.
  const above = lensSplashFor(blow({ screen: { x: 820, y: 300 }, attackerScreen: { x: 800, y: 700 } }));
  assert.equal(above.edge, 'top');
});

test('enemy blood scales with the damage dealt: a scratch is flecks, a big crit or a kill is heavy', () => {
  const scratch = dealtStrength({ lost: 3, max: 40 }), solid = dealtStrength({ lost: 12, max: 40 });
  const crit = dealtStrength({ lost: 22, max: 40, crit: true }), kill = dealtStrength({ lost: 8, max: 8, down: true });
  assert.ok(scratch < 0.25, `scratch ${scratch}`);
  assert.ok(solid > scratch && solid < crit);
  assert.equal(crit, 1);
  assert.ok(kill >= 0.9);
  assert.ok(dealtStrength({ lost: 3, max: 300 }) < scratch, 'a scratch on a big creature is less');
  assert.ok(dealtStrength({ lost: 12, max: 40, crit: true }) > solid, 'crits heavier');
  const flecks = lensSplats('s', { amount: 'heavy', ...VIEW, strength: scratch });
  const heavy = lensSplats('s', { amount: 'heavy', ...VIEW, strength: 1 });
  assert.ok(flecks.length <= 2 && heavy.length >= 3);
  assert.ok(Math.max(...flecks.map((s) => s.r)) < Math.max(...heavy.map((s) => s.r)) / 2);
});

test('the player\'s own creature is hit: tunnel vision and the bloodiest splash, scaled by the hit', () => {
  const small = lensSplashFor(blow({ role: 'victim', before: hp(30), after: hp(27) }));
  const big = lensSplashFor(blow({ role: 'victim', before: hp(30), after: hp(10), crit: true, attackerScreen: { x: 1500, y: 400 }, screen: { x: 800, y: 450 } }));
  assert.equal(small.kind, 'self');
  assert.ok(small.tunnel > 0 && big.tunnel > small.tunnel && big.tunnel <= 1);
  assert.ok(big.strength > small.strength);
  assert.equal(big.edge, 'right');
  assert.deepEqual(big.fromScreen, { x: 1500, y: 400 });
  assert.equal(small.edge, null, 'attacker unknown: a seeded edge');
  assert.ok(hitStrength({ lost: 10, max: 40 }) > dealtStrength({ lost: 10, max: 40 }), 'own blood is bloodier');
  // Many more splats for the victim at the same strength.
  const self = lensSplats('q', { amount: 'heavy', ...VIEW, strength: 1, kind: 'self' }), dealt = lensSplats('q', { amount: 'heavy', ...VIEW, strength: 1 });
  assert.ok(self.length > dealt.length);
});

test('a bloodless victim still gets tunnel vision but no blood; a bloodless enemy gives nothing', () => {
  const victim = lensSplashFor(blow({ role: 'victim', bleeds: false }));
  assert.equal(victim.kind, 'self');
  assert.equal(victim.strength, 0);
  assert.ok(victim.tunnel > 0);
  assert.equal(lensSplashFor(blow({ bleeds: false })), null);
});

test('never for an enemy this screen does not perceive, nor a GM-hidden token', () => {
  assert.equal(lensSplashFor(blow({ visible: false })), null);
  assert.equal(lensSplashFor(blow({ hidden: true })), null);
});

test('healing, no change or a creature already down give nothing', () => {
  assert.equal(lensSplashFor(blow({ before: hp(20), after: hp(25) })), null);
  assert.equal(lensSplashFor(blow({ before: hp(0), after: hp(-3) })), null);
  assert.equal(lensSplashFor(blow({ before: null })), null);
});

test('settings: world, local, quality off and gore off stop it; subtle gore and Low quality force Subtle', () => {
  assert.equal(lensSplashFor(blow({ worldOn: false })), null);
  assert.equal(lensSplashFor(blow({ localOn: false })), null);
  assert.equal(lensSplashFor(blow({ quality: 'off' })), null);
  assert.equal(lensSplashFor(blow({ gore: 'off' })), null);
  assert.equal(lensSplashFor(blow({ gore: 'subtle' })).amount, 'subtle');
  assert.equal(lensSplashFor(blow({ quality: 'low' })).amount, 'subtle');
  assert.equal(lensAmount({ amount: 'heavy', gore: 'full', quality: 'balanced' }), 'heavy');
  assert.equal(lensAmount({ amount: 'bogus', gore: 'full', quality: 'full' }), 'heavy');
  // Subtle tones the tunnel down too.
  const heavy = lensSplashFor(blow({ role: 'victim', after: hp(10) })), subtle = lensSplashFor(blow({ role: 'victim', after: hp(10), amount: 'subtle' }));
  assert.ok(subtle.tunnel < heavy.tunnel);
});

test('heavy at full strength: nine to fourteen bigger splats with drips that linger about four and a half seconds', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const splats = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1 });
    assert.ok(splats.length >= 9 && splats.length <= 14, `${seed}: ${splats.length}`);
    for (const s of splats) assert.ok(s.lifeMs >= 4000 && s.lifeMs <= 5000, `${s.lifeMs}`);
    assert.ok(splats.some((s) => s.drips.length > 0));
  }
});

test('subtle: one to three small splats near the edges, about three seconds', () => {
  const short = Math.min(VIEW.width, VIEW.height);
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const splats = lensSplats(seed, { amount: 'subtle', ...VIEW, strength: 1, kind: 'self' });
    assert.ok(splats.length >= 1 && splats.length <= 3);
    for (const s of splats) {
      assert.ok(s.lifeMs >= 2500 && s.lifeMs <= 3500);
      assert.ok(s.r <= short * 0.06);
      const edgeGap = Math.min(s.x, VIEW.width - s.x, s.y, VIEW.height - s.y);
      assert.ok(edgeGap <= short * 0.2, `${seed}: ${edgeGap}`);
    }
  }
});

test('variety: a heavy crit mixes at least three kinds of splat, each with its own geometry', () => {
  const seen = new Set();
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      const splats = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind, origin: { x: 100, y: 450 }, edge: 'left' });
      const shapes = new Set(splats.map((s) => s.shape));
      assert.ok(shapes.size >= 3, `${seed}/${kind}: ${[...shapes]}`);
      for (const s of splats) {
        assert.ok(LENS_SHAPES.includes(s.shape));
        seen.add(s.shape);
        if (s.shape === 'blob' || s.shape === 'crown') assert.ok(s.body.length >= 12);
        if (s.shape === 'crown') assert.ok(s.fingers.length >= 8 && s.droplets.length >= 8, 'fingers and flung drops');
        if (s.shape === 'streak') assert.ok(s.path.length >= 10 && Math.max(...s.path.map((p) => p[0])) >= 3, 'a long tail');
        if (s.shape === 'spray') assert.ok(s.droplets.length >= 12 && s.droplets.every((d) => d.dx > 0), 'a fan thrown one way');
        if (s.shape === 'mist') assert.ok(s.droplets.length >= 20 && s.droplets.every((d) => d.r <= 0.08));
        if (s.shape === 'smear') assert.ok(s.path.length >= 10 && s.streaks.length >= 3);
        assert.ok(s.tone > 0.7 && s.tone < 1.1, 'its own shade');
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...LENS_SHAPES].sort(), 'every kind turns up');
});

test('subtle stays restrained: small blobs, small streaks and light mist only', () => {
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      const splats = lensSplats(seed, { amount: 'subtle', ...VIEW, strength: 1, crit: true, kind });
      assert.ok(splats.length <= 3);
      assert.equal(splats[0].shape, 'blob');
      for (const s of splats) assert.ok(['blob', 'streak', 'mist'].includes(s.shape), s.shape);
      assert.ok(splats.reduce((t, s) => t + s.droplets.length, 0) <= 60);
    }
  }
});

test('caps: splat counts, droplets per splash and per splat stay bounded, all on screen', () => {
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      const splats = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind });
      assert.ok(splats.length <= (kind === 'self' ? 16 : 14));
      assert.ok(splats.reduce((t, s) => t + s.droplets.length, 0) <= LENS_BLOOD.maxDroplets);
      for (const s of splats) {
        assert.ok(s.droplets.length <= 90 && s.drips.length <= 3);
        assert.ok(s.x >= 0 && s.x <= VIEW.width && s.y >= 0 && s.y <= VIEW.height);
      }
    }
  }
});

test('a crit reaches the lens: lensSplashFor carries it and admitSplash passes it on', () => {
  assert.equal(lensSplashFor(blow({ crit: true })).crit, true);
  assert.equal(lensSplashFor(blow()).crit, false);
  const splash = { kind: 'dealt', strength: 1, tunnel: 0, crit: true, fromScreen: { x: 100, y: 450 }, edge: 'left', amount: 'heavy' };
  const { state } = admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, splash, { now: 0, seed: 'k', ...VIEW });
  const direct = lensSplats('k', { amount: 'heavy', ...VIEW, strength: 1, crit: true, origin: { x: 100, y: 450 }, edge: 'left' });
  assert.deepEqual(state.splats.map(({ bornAt, ...s }) => s), direct);
});

test('the same seed draws the same splats; another seed draws others', () => {
  const geo = (seed) => lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, origin: { x: 200, y: 450 }, edge: 'left' });
  assert.deepEqual(geo('seed-1'), geo('seed-1'));
  assert.notDeepEqual(geo('x'), geo('y'));
  const self = (seed) => lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind: 'self', edge: 'right' });
  assert.deepEqual(self('seed-2'), self('seed-2'));
});

test('each splat: an irregular body, satellite droplets, a wet highlight and its colour', () => {
  const [s] = lensSplats('c', { amount: 'heavy', ...VIEW, strength: 1, color: 0x336699 });
  assert.ok(s.body.length >= 12);
  const radii = s.body.map((p) => p.r);
  assert.ok(Math.max(...radii) - Math.min(...radii) > 0.05, 'irregular outline');
  assert.ok(s.droplets.length >= 1);
  assert.ok(s.highlight.r > 0 && s.highlight.r < 1);
  assert.equal(s.color, 0x336699);
  assert.equal(cssColor(0x336699, 0.5), 'rgba(51,102,153,0.5)');
});

test('timeline: splashes in, drips run down, dries (loses its shine) and fades out', () => {
  const all = lensSplats('t', { amount: 'heavy', ...VIEW, strength: 1 });
  const s = all.find((x) => x.drips.length);
  const start = splatState(s, 0), early = splatState(s, 150), mid = splatState(s, s.lifeMs * 0.5), late = splatState(s, s.lifeMs * 0.9), end = splatState(s, s.lifeMs);
  assert.ok(start.scale < 1 && early.scale === 1);
  assert.equal(early.alpha, 1);
  assert.ok(mid.drips[0] > early.drips[0], 'drips run');
  assert.ok(late.drips[0] >= mid.drips[0]);
  assert.ok(early.dry === 0 && late.dry > mid.dry && late.dry <= 1);
  assert.ok(late.highlight < early.highlight);
  assert.ok(late.alpha < 1 && late.alpha > 0);
  assert.equal(end.done, true);
  assert.equal(end.alpha, 0);
});

test('tunnel vision closes in fast and eases back out over two to four seconds', () => {
  const pulse = { bornAt: 0, level: 1, lifeMs: LENS_BLOOD.tunnelMs(1) };
  assert.ok(pulse.lifeMs >= 2000 && pulse.lifeMs <= 4000);
  assert.ok(LENS_BLOOD.tunnelMs(0.2) < pulse.lifeMs);
  const peak = tunnelState(pulse, 200), later = tunnelState(pulse, pulse.lifeMs * 0.7);
  assert.ok(peak.level > 0.8 && later.level < peak.level && later.level > 0);
  assert.equal(tunnelState(pulse, pulse.lifeMs).done, true);
});

test('a creature under a quarter of its HP keeps a faint tunnel; healthy or down keeps none', () => {
  assert.ok(lingerLevel(hp(8), 'heavy') > 0);
  assert.ok(lingerLevel(hp(8), 'subtle') < lingerLevel(hp(8), 'heavy'));
  assert.equal(lingerLevel(hp(20), 'heavy'), 0);
  assert.equal(lingerLevel(hp(0), 'heavy'), 0);
  assert.equal(lingerLevel(null, 'heavy'), 0);
});

test('cooldown: one splash per 600 ms, at most eight splats alive, oldest go first', () => {
  const splash = { kind: 'dealt', strength: 1, tunnel: 0, fromScreen: { x: 100, y: 100 }, edge: 'left', amount: 'heavy' };
  let state = { lastAt: -Infinity, splats: [], pulses: [] };
  let r = admitSplash(state, splash, { now: 1000, seed: 's1', ...VIEW, color: 0x7a0d0d });
  assert.ok(r.added > 0);
  state = r.state;
  r = admitSplash(state, splash, { now: 1000 + LENS_BLOOD.cooldownMs - 1, seed: 's2', ...VIEW });
  assert.equal(r.added, 0);
  assert.equal(r.state, state);
  for (let i = 0; i < 6; i++) state = admitSplash(state, splash, { now: 2000 + i * 700, seed: `s${i + 3}`, ...VIEW }).state;
  assert.ok(state.splats.length <= LENS_BLOOD.maxAlive);
  assert.equal(state.splats.at(-1).bornAt, 2000 + 5 * 700);
  assert.equal(liveSplats(state, 1e9).splats.length, 0);
});

test('cooldown by creature: several hurt at once each splash, the same one twice does not', () => {
  const splash = { kind: 'dealt', strength: 1, tunnel: 0, fromScreen: { x: 100, y: 100 }, edge: 'left', amount: 'heavy' };
  let state = { lastAt: -Infinity, splats: [], pulses: [] };
  let r = admitSplash(state, splash, { now: 1000, seed: 'a', ...VIEW, source: 'goblin-a' });
  assert.ok(r.added > 0);
  r = admitSplash(state = r.state, splash, { now: 1010, seed: 'b', ...VIEW, source: 'goblin-b' });
  assert.ok(r.added > 0, 'another creature in the same blast');
  r = admitSplash(state = r.state, splash, { now: 1020, seed: 'c', ...VIEW, source: 'goblin-a' });
  assert.equal(r.added, 0, 'the same creature inside its cooldown');
  r = admitSplash(state, splash, { now: 1000 + LENS_BLOOD.cooldownMs + 50, seed: 'd', ...VIEW, source: 'goblin-c' });
  assert.deepEqual(Object.keys(r.state.lastBy), ['goblin-c'], 'past ones let go');
});

test('a hit on the player\'s creature pulses the tunnel even inside the cooldown', () => {
  const hit = { kind: 'self', strength: 0.8, tunnel: 0.7, fromScreen: null, edge: null, amount: 'heavy' };
  let { state } = admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, hit, { now: 0, seed: 'p', ...VIEW });
  assert.equal(state.pulses.length, 1);
  const again = admitSplash(state, hit, { now: 100, seed: 'p2', ...VIEW });
  assert.equal(again.added, 0);
  assert.equal(again.state.pulses.length, 2);
  assert.equal(liveSplats(again.state, 10000).pulses.length, 0);
  // No blood (a bloodless victim): only the tunnel.
  const dry = admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, { ...hit, strength: 0 }, { now: 0, seed: 'd', ...VIEW });
  assert.equal(dry.added, 0);
  assert.equal(dry.state.pulses.length, 1);
});

// Twice a closed outline's signed area (positive: wound like canvas arcs).
const area = (pts) => pts.reduce((t, p, i) => { const n = pts[(i + 1) % pts.length]; return t + p[0] * n[1] - n[0] * p[1]; }, 0);
// The px extent (largest side of the bounding box) of a splat's solid parts: body, fingers and path.
function solidExtent(s) {
  const pts = [...(s.body ?? []).map((p) => [Math.cos(p.a) * p.r, Math.sin(p.a) * p.r]), ...(s.path ?? []), ...(s.fingers ?? []).flat()];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * s.r;
}

test('scale: the biggest splat of a heavy crit (crown fingers included) stays within about 80% of the short side', () => {
  const short = Math.min(VIEW.width, VIEW.height);
  let biggest = 0;
  const mains = [];
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      const splats = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind, edge: 'left' });
      for (const s of splats) if (s.shape !== 'spray' && s.shape !== 'mist' && s.shape !== 'smear') biggest = Math.max(biggest, solidExtent(s));
      mains.push(solidExtent(splats[0]));
    }
  }
  assert.ok(biggest <= short * 0.8, `biggest ${biggest}`);
  const median = mains.sort((a, b) => a - b)[Math.floor(mains.length / 2)];
  assert.ok(median <= short * 0.65 && median >= short * 0.15, `median main ${median}`);
});

test('organic geometry: uneven fingers, outlines wound one way, droplets of many sizes stretched as they flew', () => {
  let crowns = 0;
  const sprayed = [];
  for (const seed of SEEDS) {
    for (const s of lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind: 'self', edge: 'right' })) {
      for (const f of s.fingers ?? []) assert.ok(area(f) > 0, 'finger wound like the body');
      if (s.path) assert.ok(area(s.path) > 0, 'path wound like the body');
      for (const d of s.droplets) assert.ok(d.e === undefined || d.e >= 1);
      if (s.shape !== 'crown') continue;
      crowns++;
      // No regular star: finger angles unevenly spaced, lengths uneven.
      const tips = s.fingers.map((f) => Math.max(...f.map((p) => Math.hypot(p[0], p[1]))));
      assert.ok(Math.max(...tips) / Math.min(...tips) > 1.3, 'uneven finger lengths');
      const angles = s.fingers.map((f) => { const m = f[Math.floor(f.length / 2)]; return Math.atan2(m[1], m[0]); }).sort((a, b) => a - b);
      const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + Math.PI * 2 - angles.at(-1)));
      const mean = gaps.reduce((t, g) => t + g, 0) / gaps.length, sd = Math.sqrt(gaps.reduce((t, g) => t + (g - mean) ** 2, 0) / gaps.length);
      assert.ok(sd / mean > 0.3, 'irregular spacing');
      // Many tiny drops, a few bigger ones.
      const px = s.droplets.map((d) => d.r * s.r).sort((a, b) => a - b);
      assert.ok(px[Math.floor(px.length / 2)] < px.at(-1) * 0.6 && px[0] <= 3, 'a spread of sizes, down to specks');
      assert.ok(s.droplets.some((d) => d.e > 1.3), 'some stretched');
    }
    for (const s of lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true })) {
      if (s.shape === 'spray' && s.droplets.length >= 12) sprayed.push(s.droplets.map((d) => Math.hypot(d.dx, d.dy)));
    }
  }
  assert.ok(crowns >= 4, `crowns seen ${crowns}`);
  // Spray: densest near its source, thinning out (half its drops in the nearest third of its reach).
  // Each spray on its own: more of its drops in the nearer half of its reach than the farther.
  assert.ok(sprayed.length >= 4, `sprays seen ${sprayed.length}`);
  const dense = sprayed.filter((d) => { const far = Math.max(...d); return d.filter((x) => x < far / 2).length > d.length * 0.5; }).length;
  assert.ok(dense >= sprayed.length * 0.75, `power-law falloff ${dense}/${sprayed.length}`);
});

test('damage share keeps growing the blood up to about two thirds of max HP: a 60% hit is far bloodier than a 30% one', () => {
  const area = (splats) => splats.reduce((t, x) => t + (x.shape === 'mist' ? 0 : x.r * x.r), 0);
  for (const kind of ['self', 'dealt']) {
    const strength = (share) => (kind === 'self' ? hitStrength : dealtStrength)({ lost: share * 40, max: 40 });
    assert.ok(strength(0.3) < 0.7 && strength(0.6) >= 0.9, `${kind}: 30% ${strength(0.3)}, 60% ${strength(0.6)}`);
    let a30 = 0, a60 = 0;
    for (const seed of SEEDS) {
      a30 += area(lensSplats(seed, { amount: 'heavy', ...VIEW, kind, strength: strength(0.3) }));
      a60 += area(lensSplats(seed, { amount: 'heavy', ...VIEW, kind, strength: strength(0.6) }));
    }
    assert.ok(a60 > a30 * 2, `${kind}: area 60% ${a60} vs 30% ${a30}`);
  }
});

test('a critical hit always shows: even a 5% crit is a solid splash, on an enemy or on your own creature', () => {
  assert.ok(dealtStrength({ lost: 2, max: 40, crit: true }) >= 0.5);
  assert.ok(hitStrength({ lost: 2, max: 40, crit: true }) >= 0.55);
  assert.ok(dealtStrength({ lost: 2, max: 40 }) < 0.2, 'a normal 5% hit stays light');
});

test('centre first: a heavy splash lands around the middle of the view, leaning a little toward the blow', () => {
  const mid = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let near = 0, total = 0, leanLeft = 0;
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      const splats = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 0.8, kind, edge: 'left', origin: { x: 50, y: 450 } });
      const m = splats[0];
      assert.ok(Math.abs(m.x - mid.x) < VIEW.width * 0.25 && Math.abs(m.y - mid.y) < VIEW.height * 0.25, `${seed}/${kind}: main at ${m.x},${m.y}`);
      if (m.x < mid.x) leanLeft++;
      for (const x of splats) { total++; if (Math.abs(x.x - mid.x) < VIEW.width * 0.35 && Math.abs(x.y - mid.y) < VIEW.height * 0.35) near++; }
    }
  }
  assert.ok(near / total > 0.55, `most of it near the middle: ${near}/${total}`);
  assert.ok(leanLeft > SEEDS.length, 'leans toward the blow');
});

test('harder hits spread wider from the middle; thrown splats point away from the impact', () => {
  const spread = (strength) => {
    let d = 0, n = 0;
    for (const seed of SEEDS) {
      const [m, ...rest] = lensSplats(seed, { amount: 'heavy', ...VIEW, strength, edge: 'left' });
      for (const x of rest) { d += Math.hypot(x.x - m.x, x.y - m.y); n++; }
    }
    return d / Math.max(1, n);
  };
  assert.ok(spread(1) > spread(0.4), 'wider for harder hits');
  let out = 0, all = 0;
  for (const seed of SEEDS) {
    const [m, ...rest] = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, edge: 'left' });
    for (const x of rest) {
      if (x.shape !== 'streak' && x.shape !== 'spray') continue;
      if (Math.hypot(x.x - m.x, x.y - m.y) < 20) continue;
      all++;
      const away = Math.atan2(x.y - m.y, x.x - m.x), diff = Math.abs(Math.atan2(Math.sin(x.rotation - away), Math.cos(x.rotation - away)));
      if (diff < 0.5) out++;
    }
  }
  assert.ok(all > 10 && out / all > 0.85, `thrown outward: ${out}/${all}`);
});

test('Subtle stays small and near the edges', () => {
  for (const seed of SEEDS) {
    for (const s of lensSplats(seed, { amount: 'subtle', ...VIEW, strength: 1, edge: 'left' })) {
      const edgeDist = Math.min(s.x, VIEW.width - s.x, s.y, VIEW.height - s.y);
      assert.ok(edgeDist <= Math.min(VIEW.width, VIEW.height) * 0.15, `${seed}: ${s.x},${s.y}`);
    }
  }
});

test('fingers stay short and uneven: crowns reach at most about 0.85 r past their body, blob stubs 0.4 r, crown fingers mostly bent', () => {
  let crowns = 0, blobs = 0;
  for (const seed of SEEDS) {
    for (const kind of ['dealt', 'self']) {
      for (const s of lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind, edge: 'left' })) {
        if (!s.fingers?.length || (s.shape !== 'crown' && s.shape !== 'blob')) continue;
        const cap = s.shape === 'crown' ? 0.85 : 0.4;
        if (s.shape === 'crown') { crowns++; assert.ok(s.fingers.length <= 14, `${s.fingers.length} crown fingers`); } else blobs++;
        const bodyMax = Math.max(...s.body.map((p) => p.r));
        let bent = 0;
        for (const f of s.fingers) {
          const reach = Math.max(...f.map((p) => Math.hypot(p[0], p[1])));
          assert.ok(reach <= bodyMax + cap + 0.05, `${s.shape}: finger reaches ${reach} (body ${bodyMax})`);
          // Its centre line (the middle of each upper/lower pair) strays off the straight line from root to tip.
          const m = f.length / 2, mid = Array.from({ length: m }, (_, i) => [(f[i][0] + f[f.length - 1 - i][0]) / 2, (f[i][1] + f[f.length - 1 - i][1]) / 2]);
          const [a, b] = [mid[0], mid.at(-1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const off = Math.max(...mid.map((p) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len));
          if (off > len * 0.03) bent++;
        }
        if (s.shape === 'crown') assert.ok(bent >= s.fingers.length * 0.5, `crown: ${bent}/${s.fingers.length} fingers bend or waver`);
      }
    }
  }
  assert.ok(crowns >= 4 && blobs >= 4, `crowns ${crowns}, blobs ${blobs}`);
});

test('heavy blood clears about a quarter sooner than it used to; Subtle keeps its three seconds', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const crit = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true });
    assert.ok(Math.max(...crit.map((s) => s.lifeMs)) <= 5000, 'a heavy crit is gone within five seconds (was over six)');
    const subtle = lensSplats(seed, { amount: 'subtle', ...VIEW, strength: 1 });
    for (const s of subtle) assert.ok(s.lifeMs >= 2700 && s.lifeMs <= 3300);
  }
});

test('damage type shapes the wound: blades scratch, points spray, blunt blows burst; energy bleeds less and shifts the colour', async () => {
  const { woundOf, DAMAGE_WOUNDS } = await import('../../../scripts/engines/camera/lens-blood.mjs');
  assert.equal(woundOf({ type: 'slashing' }), 'slashing');
  assert.equal(woundOf({ type: 'untyped', types: ['untyped', 'fire'] }), 'fire', 'the first type with a look');
  assert.equal(woundOf({}), null);
  for (const t of ['slashing', 'piercing', 'bludgeoning', 'bleed', 'force', 'sonic', 'electricity', 'fire', 'cold', 'acid', 'poison', 'void', 'vitality', 'mental', 'spirit']) assert.ok(DAMAGE_WOUNDS[t], t);
  const shapes = (wound) => {
    const n = {};
    for (const seed of SEEDS) for (const s of lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 0.9, wound })) n[s.shape] = (n[s.shape] ?? 0) + 1;
    return n;
  };
  const slash = shapes('slashing'), pierce = shapes('piercing'), crush = shapes('bludgeoning');
  assert.ok((slash.streak ?? 0) > (crush.streak ?? 0) * 3, 'blades scratch');
  assert.ok((pierce.spray ?? 0) > (slash.spray ?? 0), 'points spray');
  assert.ok(!crush.streak, 'blunt blows leave no scratches');
  assert.ok((crush.crown ?? 0) > (slash.crown ?? 0), 'blunt blows burst');
  // Energy: less blood and a shifted colour on the splats.
  const before = { value: 40, max: 40 }, after = { value: 16, max: 40 };
  const base = { role: 'attacker', before, after, screen: { x: 100, y: 100 }, view: VIEW };
  const physical = lensSplashFor({ ...base, damageType: 'slashing' }), fire = lensSplashFor({ ...base, damageType: 'fire' });
  assert.equal(physical.wound, 'slashing');
  assert.ok(fire.strength < physical.strength * 0.7, 'fire spills less');
  const { state } = admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, fire, { now: 0, seed: 'f', width: 1600, height: 900, color: 0x7a0d0d });
  assert.ok(state.splats.every((s) => s.color !== 0x7a0d0d), 'burned blood is darker');
});

test('Damage lens duration stretches how long the blood stays (and the tunnel, up to twice), clamped to 0.5–6', () => {
  const splash = { kind: 'self', strength: 0.9, tunnel: 0.8, amount: 'heavy', crit: false };
  const at = (duration) => admitSplash({ lastAt: -Infinity, splats: [], pulses: [] }, splash, { now: 0, seed: 'd', width: 1600, height: 900, duration }).state;
  const base = at(1), long = at(3), short = at(0.5), huge = at(99);
  assert.equal(long.splats[0].lifeMs, Math.round(base.splats[0].lifeMs * 3));
  assert.equal(short.splats[0].lifeMs, Math.round(base.splats[0].lifeMs * 0.5));
  assert.equal(huge.splats[0].lifeMs, Math.round(base.splats[0].lifeMs * 6), 'clamped');
  assert.equal(long.pulses[0].lifeMs, Math.round(base.pulses[0].lifeMs * 2), 'the tunnel at most twice as long');
  assert.equal(at(undefined).splats[0].lifeMs, base.splats[0].lifeMs, 'default 1');
});

test('Damage lens shows: hits taken, dealt or both, this screen over the GM', () => {
  assert.equal(lensWho('both', ''), 'both');
  assert.equal(lensWho('hurt', ''), 'hurt', "the GM's choice when this screen has none");
  assert.equal(lensWho('hurt', 'dealt'), 'dealt', "this screen's own over the GM's");
  assert.equal(lensWho('nonsense', 'other'), 'both', 'unknown counts as both');
  assert.ok(lensRoleWanted('victim', 'both') && lensRoleWanted('attacker', 'both'));
  assert.ok(lensRoleWanted('victim', 'hurt') && !lensRoleWanted('attacker', 'hurt'));
  assert.ok(!lensRoleWanted('victim', 'dealt') && lensRoleWanted('attacker', 'dealt'));
  assert.ok(!lensRoleWanted(null, 'both'), 'a blow the player has no part in');
});

test('nearestNear: the player creature next to the hurt one (adjacent, or a square between with reach), the closest; far off none', () => {
  const sq = (x, y, size = 1) => ({ x: x * 100, y: y * 100, w: size * 100, h: size * 100 });
  const hurt = sq(5, 5);
  const adjacent = { id: 'adjacent', rect: sq(6, 6) }, reach = { id: 'reach', rect: sq(3, 5) }, far = { id: 'far', rect: sq(9, 5) };
  assert.equal(nearestNear(hurt, [far, reach, adjacent])?.id, 'adjacent', 'adjacent by default, diagonals too');
  assert.equal(nearestNear(hurt, [far, reach]), null, 'a square between is not adjacent');
  assert.equal(nearestNear(hurt, [far, reach, adjacent], { squares: 1 })?.id, 'adjacent', 'closest first');
  assert.equal(nearestNear(hurt, [far, reach], { squares: 1 })?.id, 'reach', 'reach: one square between still splashes');
  assert.equal(nearestNear(hurt, [far], { squares: 1 }), null, 'a ranged shooter far off sees none');
  assert.equal(nearestNear(hurt, [far], { squares: 3 })?.id, 'far');
  assert.equal(nearestNear(sq(5, 5, 3), [{ id: 'big', rect: sq(8, 6) }])?.id, 'big', 'measured edge to edge');
  assert.equal(nearestNear(sq(5, 5, 3), [{ id: 'big', rect: sq(9, 6) }]), null);
  assert.equal(nearestNear(hurt, [{ id: 'broken', rect: { x: NaN } }]), null);
  assert.equal(nearestNear(null, [adjacent]), null);
});

test('Enemy blood reaches: adjacent by default, reach one square further, or the attacker as before', () => {
  assert.equal(lensReach(undefined), 'adjacent');
  assert.equal(lensReach('nonsense'), 'adjacent');
  assert.equal(lensReach('toString'), 'adjacent');
  assert.equal(lensReach('reach'), 'reach');
  assert.equal(lensReach('attacker'), 'attacker');
  assert.deepEqual({ ...LENS_REACH }, { adjacent: 0, reach: 1 });
});

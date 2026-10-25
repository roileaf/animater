import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WOUNDED, WAKE, DEATH, NO_WOUND, hpLeft, lifeOf, isDown, woundedWanted, woundedEdge, woundedPulse, downLook, woundedView, muffleFor,
  heartbeatDown, nextBeatMs, heartbeatDeath, transitionSteps, woundGradient, woundBoard, mixWound, stainCap, stainsPerHit, stainSplat,
  stainsAfterHit, settleStains, stainAlpha, stainMoving, downPreviews,
} from '../../../scripts/engines/camera/lens-wounds.mjs';

const hp = (value, max = 40) => ({ value, max, down: value <= 0, marked: false });
const up = (left) => ({ phase: 'up', weak: 0, left });
const gate = { isGM: false, worldOn: true, localOn: true, on: true };

test('HP left reads counting-down and marked tracks', () => {
  assert.equal(hpLeft(hp(10)), 0.25);
  assert.ok(Math.abs(hpLeft({ value: 4, max: 6, marked: true }) - 1 / 3) < 1e-9, 'two of six boxes unmarked');
  assert.equal(hpLeft(null), null);
  assert.equal(hpLeft({ value: 3, max: 0 }), null);
});

test('red edges: none above half HP, creeping in below it, deeper as HP falls; fainter out of combat; Subtle halved', () => {
  assert.equal(woundedEdge(0.8), 0);
  assert.equal(woundedEdge(0.5), 0);
  const e45 = woundedEdge(0.45), e25 = woundedEdge(0.25), e10 = woundedEdge(0.1), e0 = woundedEdge(0);
  assert.ok(e45 > 0 && e45 < 0.2, 'soft at first');
  assert.ok(e45 < e25 && e25 < e10 && e10 < e0);
  assert.equal(e0, 1);
  assert.ok(Math.abs(woundedEdge(0.25, { inCombat: false }) - e25 * WOUNDED.calm) < 0.002, 'much fainter out of combat');
  assert.ok(Math.abs(woundedEdge(0.25, { amount: 'subtle' }) - e25 / 2) < 0.002);
});

test('the edges beat with the heartbeat only at a quarter HP or under, in combat', () => {
  assert.equal(woundedPulse(0.3), 0);
  assert.ok(woundedPulse(0.25) > 0);
  assert.ok(woundedPulse(0.05) > woundedPulse(0.2));
  assert.equal(woundedPulse(0.1, { inCombat: false }), 0);
  assert.equal(woundedPulse(0), 0, 'down: no lingering beat');
});

test('the system decides up, down, dying, stable and dead', () => {
  const pf = (facts) => lifeOf({ systemId: 'pf2e', ...facts });
  assert.equal(pf({ hp: hp(20) }).phase, 'up');
  assert.equal(pf({ hp: hp(0), statuses: ['unconscious'] }).phase, 'down');
  assert.equal(pf({ hp: hp(0), dying: { value: 1, max: 4 } }).phase, 'dying');
  assert.ok(pf({ hp: hp(0), dying: { value: 3, max: 4 } }).weak > pf({ hp: hp(0), dying: { value: 1, max: 4 } }).weak, 'weaker as dying rises');
  assert.equal(pf({ hp: hp(0), dying: { value: 4, max: 4 } }).phase, 'dead', 'dying max is death');
  assert.equal(pf({ hp: hp(0), dying: { value: 3, max: 3 } }).phase, 'dead', 'a lowered max (doomed) too');
  assert.equal(pf({ hp: hp(0), statuses: ['dead'] }).phase, 'dead');
  assert.equal(lifeOf({ systemId: 'sf2e', hp: hp(0), dying: { value: 2, max: 4 } }).phase, 'dying');
  const dnd = (death, statuses = []) => lifeOf({ systemId: 'dnd5e', hp: hp(0), death, statuses });
  assert.equal(dnd({ success: 0, failure: 0 }).phase, 'dying');
  assert.ok(dnd({ success: 0, failure: 2 }).weak > dnd({ success: 0, failure: 1 }).weak, 'weaker with each failure');
  assert.ok(dnd({ success: 2, failure: 1 }).weak < dnd({ success: 0, failure: 1 }).weak, 'steadier with successes');
  assert.equal(dnd({ success: 3, failure: 0 }).phase, 'stable');
  assert.equal(dnd({ success: 0, failure: 0 }, ['stable']).phase, 'stable');
  assert.equal(dnd({ success: 0, failure: 3 }).phase, 'dead');
  assert.equal(lifeOf({ systemId: 'dnd5e', hp: hp(12) }).phase, 'up');
  const dh = (statuses, value = 6) => lifeOf({ systemId: 'daggerheart', hp: { value, max: 6, down: value >= 6, marked: true }, statuses });
  assert.equal(dh([], 3).phase, 'up');
  assert.equal(dh([]).phase, 'dying', 'the last Hit Point marked');
  assert.equal(dh(['deathMove']).phase, 'dying');
  assert.equal(dh(['unconscious']).phase, 'down');
  assert.equal(dh(['dead']).phase, 'dead');
  assert.ok(Math.abs(dh([], 4).left - 1 / 3) < 1e-9);
  assert.ok(isDown({ phase: 'stable' }) && !isDown({ phase: 'up' }));
});

test('only players with the world lens, the local lens and the wounded switch on, quality not Off', () => {
  assert.equal(woundedWanted(gate), true);
  for (const off of [{ isGM: true }, { worldOn: false }, { localOn: false }, { on: false }, { quality: 'off' }]) assert.equal(woundedWanted({ ...gate, ...off }), false, JSON.stringify(off));
});

test('the wounded view by HP: edges and stains from half, pulse and muffle at a quarter in combat; Low keeps only the edges', () => {
  const at = (left, extra = {}, look = { amount: 'heavy', quality: 'full' }) => woundedView({ life: up(left), inCombat: true, shown: true, ...gate, ...extra }, look);
  assert.deepEqual(at(0.8), { look: { ...NO_WOUND }, pulse: 0, muffle: null, stains: false });
  const half = at(0.4);
  assert.ok(half.look.edge > 0 && half.stains && !half.pulse && !half.muffle);
  const low = at(0.1);
  assert.ok(low.pulse > 0 && low.muffle && low.stains);
  assert.equal(at(0.1, { inCombat: false }).muffle, null, 'out of combat: no muffle');
  const lowQ = at(0.1, {}, { amount: 'subtle', quality: 'low' });
  assert.ok(lowQ.look.edge > 0, 'Low: the vignette');
  assert.equal(lowQ.muffle, null, 'Low: no muffle');
  assert.equal(lowQ.stains, false, 'Low: no stains');
  assert.deepEqual(at(0.1, {}, { amount: 'heavy', quality: 'off' }).look, NO_WOUND, 'Off: none');
  assert.deepEqual(at(0.1, {}, { amount: null, quality: 'full' }).look, NO_WOUND, 'gore off: none');
  assert.deepEqual(at(0.1, { on: false }).look, NO_WOUND);
  assert.deepEqual(at(0.1, { shown: false }).look, NO_WOUND, 'a hidden token');
  // Dead: nothing lasting (the death plays as a transition).
  assert.deepEqual(woundedView({ life: { phase: 'dead', weak: 1, left: 0 }, inCombat: true, shown: true, ...gate }, { amount: 'heavy', quality: 'full' }).look, NO_WOUND);
});

test('down: a near-black window, the board dimmed, blurred and greyed; deeper as the creature weakens; Subtle halved, Low no board filter', () => {
  const weak = downLook({ phase: 'dying', weak: 0.25 }), weaker = downLook({ phase: 'dying', weak: 0.75 });
  assert.ok(weak.dark >= 0.85 && weaker.dark > weak.dark);
  assert.ok(weaker.window < weak.window, 'the window closes');
  assert.ok(weak.blur > 0 && weak.saturate < 0.6 && weak.brightness < 0.8);
  assert.ok(weaker.blur > weak.blur && weaker.brightness < weak.brightness);
  assert.ok(downLook({ phase: 'stable', weak: 0.2 }).dark < downLook({ phase: 'dying', weak: 0.2 }).dark, 'stable is a little lighter');
  const subtle = downLook({ phase: 'dying', weak: 0.5 }, { amount: 'subtle' }), heavy = downLook({ phase: 'dying', weak: 0.5 });
  assert.ok(Math.abs(subtle.dark - heavy.dark / 2) < 0.002 && subtle.blur < heavy.blur && subtle.saturate > heavy.saturate);
  const low = downLook({ phase: 'dying', weak: 0.5 }, { quality: 'low' });
  assert.ok(low.dark > 0.8 && low.blur === 0 && low.saturate === 1 && low.brightness === 1, 'Low: vignette only');
  assert.deepEqual(downLook({ phase: 'up', left: 0.1 }), NO_WOUND);
  assert.deepEqual(downLook({ phase: 'dying', weak: 0.5 }, { quality: 'off' }), NO_WOUND);
});

test('muffle: gentle under a quarter in combat, deeper lower, nearly silent down; Subtle half as deep', () => {
  assert.equal(muffleFor(up(0.3)), null);
  const q = muffleFor(up(0.25)), deep = muffleFor(up(0.05));
  assert.ok(q.cutoff >= 8000 && q.gain >= 0.9, 'just at a quarter: barely');
  assert.ok(deep.cutoff < 2500 && deep.gain < 0.8);
  assert.equal(muffleFor(up(0.1), { inCombat: false }), null);
  const down = muffleFor({ phase: 'dying', weak: 0.5, left: 0 });
  assert.ok(down.cutoff < 600 && down.gain <= 0.3, 'near silence');
  assert.ok(muffleFor({ phase: 'dying', weak: 1 }).cutoff < muffleFor({ phase: 'dying', weak: 0 }).cutoff);
  const dead = muffleFor({ phase: 'dead' });
  assert.ok(dead.cutoff <= down.cutoff && dead.gain <= down.gain);
  const subtle = muffleFor(up(0.05), { amount: 'subtle' });
  assert.ok(subtle.cutoff > deep.cutoff && subtle.gain > deep.gain);
  assert.equal(subtle.gain, Math.round((1 - (1 - deep.gain) / 2) * 1000) / 1000);
});

test('the dying heartbeat: slow, faint and uneven, weaker with the dying value; steady when stable; none dead or heartless', () => {
  const d1 = heartbeatDown(lifeOf({ systemId: 'pf2e', hp: hp(0), dying: { value: 1, max: 4 } }));
  const d3 = heartbeatDown(lifeOf({ systemId: 'pf2e', hp: hp(0), dying: { value: 3, max: 4 } }));
  assert.ok(d1.intervalMs >= 1500 && d3.intervalMs > d1.intervalMs, 'slower');
  assert.ok(d3.gain < d1.gain && d3.gain < 0.15, 'fainter');
  assert.ok(d3.jitter > d1.jitter, 'more uneven');
  const f1 = heartbeatDown(lifeOf({ systemId: 'dnd5e', hp: hp(0), death: { failure: 1, success: 0 } }));
  const f2 = heartbeatDown(lifeOf({ systemId: 'dnd5e', hp: hp(0), death: { failure: 2, success: 0 } }));
  const s2 = heartbeatDown(lifeOf({ systemId: 'dnd5e', hp: hp(0), death: { failure: 1, success: 2 } }));
  assert.ok(f2.gain < f1.gain && s2.gain > f1.gain && s2.jitter < f1.jitter, 'D&D: failures weaken it, successes steady it');
  const stable = heartbeatDown({ phase: 'stable', weak: 0.2 });
  assert.ok(stable.jitter < 0.05);
  assert.ok(heartbeatDown(lifeOf({ systemId: 'daggerheart', hp: { value: 6, max: 6, down: true, marked: true }, statuses: [] })));
  assert.equal(heartbeatDown({ phase: 'dead', weak: 1 }), null);
  assert.equal(heartbeatDown({ phase: 'dying', weak: 0.5 }, { heart: false }), null, 'no heart');
  assert.equal(heartbeatDown({ phase: 'dying', weak: 0.5 }, { on: false }), null);
  assert.equal(heartbeatDown(up(0.1)), null, 'up: the lingering beat instead');
  assert.ok(heartbeatDown({ phase: 'dying', weak: 0.5 }, { amount: 'subtle' }).gain < heartbeatDown({ phase: 'dying', weak: 0.5 }).gain);
});

test('beats come unevenly, now and then dropping one when very weak', () => {
  const plan = { intervalMs: 2000, jitter: 0.35 };
  const seq = [0, 0.5, 0.99, 0.01];
  let i = 0;
  const random = () => seq[i++ % seq.length];
  const gaps = Array.from({ length: 8 }, () => nextBeatMs(plan, random));
  assert.ok(new Set(gaps).size > 1, 'not a metronome');
  assert.ok(gaps.some((g) => g > 2000 * 1.5), 'a dropped beat');
  for (const g of gaps) assert.ok(g >= 2000 * 0.6 && g <= 2000 * 1.35 * 1.8);
  assert.equal(nextBeatMs({ intervalMs: 1350, jitter: 0 }), 1350);
});

test('death: the heartbeat fades out in a few fainter beats; the dark holds about two seconds then clears; no flatline', () => {
  const beats = heartbeatDeath({ gain: 0.1 });
  assert.ok(beats.length >= 2 && beats.length <= 3);
  for (let k = 1; k < beats.length; k++) { assert.ok(beats[k].gain < beats[k - 1].gain); assert.ok(beats[k].at > beats[k - 1].at); }
  assert.deepEqual(heartbeatDeath({ gain: 0.1 }, { heart: false }), []);
  const steps = transitionSteps('dying', 'dead');
  assert.equal(steps.length, 2);
  assert.ok(steps[0].look.dark >= 0.95 && steps[0].muffle === 'hold');
  assert.equal(steps[1].at - steps[0].ms, DEATH.holdMs, 'held about two seconds');
  assert.deepEqual(steps[1].look, NO_WOUND, 'then clears');
  assert.equal(steps[1].muffle, 'release');
  assert.ok(steps[0].look.blur > 0);
  assert.equal(transitionSteps('dying', 'dead', { quality: 'low' })[0].look.blur, 0, 'Low: no board filter');
});

test('waking: the dark lifts fast behind a bright flash and the muffle lets go', () => {
  const to = { ...NO_WOUND, edge: 0.6 };
  for (const from of ['down', 'dying', 'stable']) {
    const [step] = transitionSteps(from, 'up', { look: to });
    assert.equal(step.at, 0);
    assert.deepEqual(step.look, to);
    assert.equal(step.ms, WAKE.liftMs);
    assert.ok(step.ms < 1000, 'fast');
    assert.deepEqual(step.flash, { peak: WAKE.flashPeak, ms: WAKE.flashMs });
    assert.equal(step.muffle, 'release');
  }
  assert.equal(transitionSteps('up', 'up'), null);
  assert.equal(transitionSteps(null, 'dead'), null, 'not on loading a dead creature');
  assert.equal(transitionSteps('dead', 'up'), null);
  assert.equal(transitionSteps('dying', 'up', { quality: 'off' }), null);
  assert.equal(transitionSteps('up', 'dying'), null, 'falling: eased like any change');
});

test('the wound layer: red edges, a black window, both, or nothing; the board look only when it is not neutral', () => {
  assert.equal(woundGradient(NO_WOUND), '');
  const red = woundGradient({ edge: 0.5 });
  assert.match(red, /^radial-gradient\(ellipse at center, transparent \d+%, rgba\(120,6,8,/);
  const dark = woundGradient({ dark: 0.9, window: 0.3 });
  assert.match(dark, /rgba\(0,0,0,0\.9\) 100%\)$/);
  assert.equal(woundGradient({ edge: 0.5, dark: 0.9, window: 0.3 }).split('radial-gradient').length - 1, 2);
  assert.equal(woundBoard(NO_WOUND), null);
  assert.deepEqual(woundBoard({ blur: 1.5, saturate: 0.4, brightness: 0.6 }), { blur: 1.5, saturate: 0.4, brightness: 0.6 });
  const mid = mixWound(NO_WOUND, { ...NO_WOUND, dark: 1, window: 0 }, 0.5);
  assert.equal(mid.dark, 0.5);
  assert.equal(mid.window, 0.5);
});

test('stains: one per hit while hurt, two at a quarter or under; the cap grows as HP falls; Subtle fewer', () => {
  assert.equal(stainsPerHit(0.8), 0);
  assert.equal(stainsPerHit(0.4), 1);
  assert.equal(stainsPerHit(0.2), 2);
  assert.equal(stainsPerHit(0.2, { amount: 'subtle' }), 1);
  assert.equal(stainCap(0.6), 0);
  assert.ok(stainCap(0.45) < stainCap(0.25) && stainCap(0.25) < stainCap(0));
  assert.ok(stainCap(0, { amount: 'subtle' }) <= Math.ceil(stainCap(0) / 2));
});

test('a stain is a small dried splat just inside the lens edge, in the given blood colour, without drips', () => {
  const view = { width: 1600, height: 900 };
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const s = stainSplat(`s:${edge}`, { ...view, edge, color: 0x336699 });
    assert.equal(s.edge, edge);
    assert.equal(s.color, 0x336699);
    assert.deepEqual(s.drips, []);
    assert.equal(s.react, undefined);
    assert.ok(s.r >= 900 * 0.01 && s.r <= 900 * 0.03, 'small');
    const inset = { left: s.x, right: view.width - s.x, top: s.y, bottom: view.height - s.y }[edge];
    assert.ok(inset >= 0 && inset < 0.08 * (edge === 'left' || edge === 'right' ? view.width : view.height), `${edge} edge`);
  }
  assert.deepEqual(stainSplat('same', view), stainSplat('same', view), 'seeded');
});

test('stains stay while HP stays low, fade gradually once healed past their threshold, and go', () => {
  const view = { width: 1600, height: 900 };
  let list = stainsAfterHit([], { left: 0.4, seed: 'a', now: 0, ...view });
  assert.equal(list.length, 1);
  assert.equal(list[0].keepBelow, WOUNDED.from);
  list = stainsAfterHit(list, { left: 0.2, seed: 'b', now: 100, ...view });
  assert.equal(list.length, 3);
  assert.equal(list[2].keepBelow, WOUNDED.low);
  // HP stays low: nothing fades, however long.
  assert.equal(settleStains(list, { left: 0.2, now: 60000 }), list);
  assert.equal(stainAlpha(list[0], 60000), WOUNDED.stainAlpha);
  assert.equal(stainMoving(list[0], 60000), false, 'still: no frames');
  // Healed to 35%: the quarter-HP ones fade one after another; the half-HP one stays.
  const healed = settleStains(list, { left: 0.35, now: 70000 });
  assert.equal(healed[0].fadeAt, null);
  assert.ok(healed[1].fadeAt === 70000 && healed[2].fadeAt === 70000 + WOUNDED.stainStaggerMs, 'gradually');
  assert.ok(stainAlpha(healed[1], 70000 + WOUNDED.stainFadeMs / 2) < WOUNDED.stainAlpha);
  assert.ok(stainMoving(healed[1], 70500));
  const later = settleStains(healed, { left: 0.35, now: 70000 + WOUNDED.stainFadeMs + WOUNDED.stainStaggerMs + 1 });
  assert.equal(later.length, 1, 'faded ones are gone');
  // Healed above half: the rest go too.
  const all = settleStains(later, { left: 0.9, now: 80000 });
  assert.ok(all[0].fadeAt === 80000);
  // Shows in as the hit dries.
  assert.ok(stainAlpha(list[0], 100) < stainAlpha(list[0], WOUNDED.stainInMs));
});

test('more hits than the cap: the oldest fade first', () => {
  const view = { width: 1600, height: 900 };
  let list = [];
  for (let i = 0; i < 6; i++) list = stainsAfterHit(list, { left: 0.4, seed: `h${i}`, now: i * 1000, ...view });
  const kept = list.filter((s) => s.fadeAt == null);
  assert.equal(kept.length, stainCap(0.4));
  assert.ok(list[0].fadeAt != null && list.at(-1).fadeAt == null);
  assert.equal(stainsAfterHit(list, { left: 0.8, seed: 'x', now: 9000, ...view }), list, 'a hit while healthy leaves none');
});

test('the showcase down states carry each system\'s own names', () => {
  const labels = (sys) => downPreviews(sys).map((s) => s.label);
  assert.deepEqual(labels('pf2e').slice(0, 3), ['Dying 1', 'Dying 2', 'Dying 3']);
  assert.ok(labels('sf2e').includes('Dying 2'));
  assert.ok(labels('dnd5e').includes('1 failure') && labels('dnd5e').includes('2 failures'));
  assert.ok(labels('daggerheart').includes('Death move'));
  for (const sys of ['pf2e', 'dnd5e', 'daggerheart', 'other']) {
    const list = downPreviews(sys);
    assert.ok(list.some((s) => s.id === 'dead'), `${sys}: dead`);
    for (const s of list) {
      const life = lifeOf(s.facts);
      assert.ok(isDown(life), `${sys} ${s.id} is down`);
      if (s.id === 'dead') assert.equal(life.phase, 'dead');
      if (s.id === 'stable') assert.equal(life.phase, 'stable');
    }
  }
  const pf = Object.fromEntries(downPreviews('pf2e').map((s) => [s.id, lifeOf(s.facts)]));
  assert.ok(pf.dying3.weak > pf.dying2.weak && pf.dying2.weak > pf.dying1.weak);
  const dnd = Object.fromEntries(downPreviews('dnd5e').map((s) => [s.id, lifeOf(s.facts)]));
  assert.ok(dnd.dying3.weak > dnd.dying1.weak);
});

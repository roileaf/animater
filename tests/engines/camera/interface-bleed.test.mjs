import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLEED_LOOKS, BLEED_KEYS, BLEED_DEFAULTS, BLEED_FROM, BLEED_HEART_AT, BLEED_ALIVE_MOST, BLEED_SPLATS_MOST,
  BLEED_KEPT_CLEAR, BLEED_MS, bleedFrame, bleedLooks, bleedShudder, bleedSplats, bleedWanted, hurtLevel,
} from '../../../scripts/engines/camera/interface-bleed.mjs';
import { LENS_BLOOD } from '../../../scripts/engines/camera/lens-blood.mjs';

test('every look is named, explained, and says whether it starts on', () => {
  for (const key of BLEED_KEYS) {
    const look = BLEED_LOOKS[key];
    assert.ok(look.name && look.hint, `${key} is explained to whoever has to choose`);
    assert.equal(typeof look.on, 'boolean', `${key} says plainly`);
  }
  // The two loud ones wait to be asked for; the quiet ones do not.
  assert.equal(BLEED_DEFAULTS.shudder, false, 'the shudder is the first thing anyone turns off');
  assert.equal(BLEED_DEFAULTS.tunnel, false, 'the canvas already tunnels');
  assert.equal(BLEED_DEFAULTS.edge, true);
  assert.equal(BLEED_DEFAULTS.glass, true);
  assert.equal(BLEED_DEFAULTS.drain, true);
});

test('a healthy character bleeds nowhere', () => {
  for (const hp of [100, 80, 60, 50]) assert.equal(hurtLevel({ hp, max: 100 }), 0, `${hp}%`);
  assert.equal(hurtLevel({ hp: 100, max: 100 }), 0);
  const frame = bleedFrame({ hurt: 0, looks: BLEED_DEFAULTS });
  assert.deepEqual(frame, { edge: 0, tunnel: 0, drain: 0, beatMs: 0 });
});

test('it climbs from bloodied, and being down is all the way whatever the numbers say', () => {
  assert.ok(hurtLevel({ hp: 49, max: 100 }) > 0, 'just under half is where it starts');
  assert.ok(hurtLevel({ hp: 25, max: 100 }) > hurtLevel({ hp: 40, max: 100 }));
  assert.equal(hurtLevel({ hp: 0, max: 100 }), 1);
  assert.equal(hurtLevel({ hp: 60, max: 100, unconscious: true }), 1, 'dying is dying');
  // A character at 0 of 60 is in the same trouble as one at 0 of 200.
  assert.equal(hurtLevel({ hp: 0, max: 60 }), hurtLevel({ hp: 0, max: 200 }));
  assert.equal(hurtLevel({ hp: 50, max: 100 }), 0, `nothing at ${BLEED_FROM * 100}%`);
});

test('a missing or nonsense health is no wound, not a crash', () => {
  for (const args of [{}, { hp: null, max: 100 }, { hp: 10, max: 0 }, { hp: NaN, max: NaN }, { hp: 'x', max: 'y' }, { hp: 10, max: -5 }]) {
    assert.equal(hurtLevel(args), 0, JSON.stringify(args));
  }
  assert.equal(hurtLevel(), 0);
});

test('health over the maximum is still health, not a wound', () => {
  assert.equal(hurtLevel({ hp: 140, max: 100 }), 0, 'temporary hit points do not make anyone bleed');
});

test('the heart starts at the same quarter the canvas already beats at', () => {
  const quarter = hurtLevel({ hp: 25, max: 100 });
  assert.equal(quarter, BLEED_HEART_AT);
  assert.equal(LENS_BLOOD.lowHp, 0.25, 'and that quarter is the canvas’s own number');
  assert.ok(bleedFrame({ hurt: quarter, looks: BLEED_DEFAULTS }).beatMs > 0);
  assert.equal(bleedFrame({ hurt: quarter - 0.01, looks: BLEED_DEFAULTS }).beatMs, 0, 'and not before');
  // It quickens as it gets worse.
  assert.ok(bleedFrame({ hurt: 1, looks: BLEED_DEFAULTS }).beatMs < bleedFrame({ hurt: 0.6, looks: BLEED_DEFAULTS }).beatMs);
});

test('a look that is off draws nothing, however hurt anybody is', () => {
  const none = bleedFrame({ hurt: 1, strength: 1.5, looks: bleedLooks({ edge: false, glass: false, drain: false, beat: false, tunnel: false, shudder: false }) });
  assert.deepEqual(none, { edge: 0, tunnel: 0, drain: 0, beatMs: 0 });
  assert.equal(bleedFrame({ hurt: 1, looks: bleedLooks({ edge: false }) }).edge, 0);
  assert.ok(bleedFrame({ hurt: 1, looks: bleedLooks({ edge: false }) }).drain > 0, 'the others carry on');
});

test('strength scales what is drawn and never pushes it past itself', () => {
  const soft = bleedFrame({ hurt: 1, strength: 0.3, looks: BLEED_DEFAULTS });
  const hard = bleedFrame({ hurt: 1, strength: 1.5, looks: BLEED_DEFAULTS });
  assert.ok(soft.edge < hard.edge);
  for (const frame of [soft, hard, bleedFrame({ hurt: 1, strength: 99, looks: BLEED_DEFAULTS })]) {
    for (const key of ['edge', 'tunnel', 'drain']) assert.ok(frame[key] >= 0 && frame[key] <= 1, `${key} stays within itself`);
  }
  // The colour never goes all the way out, at any strength.
  assert.ok(bleedFrame({ hurt: 1, strength: 1.5, looks: BLEED_DEFAULTS }).drain < 1);
});

test('blood is thrown from the side the blow came from', () => {
  const left = bleedSplats({ from: 'left', seed: 0.3 });
  const right = bleedSplats({ from: 'right', seed: 0.3 });
  const mean = (list) => list.reduce((t, s) => t + s.x, 0) / list.length;
  assert.ok(mean(left) < 0.5, 'a blow from the left lands left');
  assert.ok(mean(right) > 0.5, 'and one from the right lands right');
  for (const s of [...left, ...right]) {
    assert.ok(s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1, 'and all of it lands on the window');
  }
});

test('the same blow draws the same blood on every screen', () => {
  const a = bleedSplats({ from: 'left', seed: 0.77, heavy: true });
  const b = bleedSplats({ from: 'left', seed: 0.77, heavy: true });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, bleedSplats({ from: 'left', seed: 0.21, heavy: true }), 'and a different blow does not');
});

test('a character going down bleeds more, and for longer, than one taking a hit', () => {
  const hit = bleedSplats({ seed: 0.5 }), down = bleedSplats({ seed: 0.5, heavy: true });
  assert.ok(down.length > hit.length);
  assert.equal(hit[0].ms, BLEED_MS.hit);
  assert.equal(down[0].ms, BLEED_MS.heavy);
  assert.ok(BLEED_MS.heavy > BLEED_MS.hit);
});

test('no splash is ever more than a window can take', () => {
  for (const strength of [1, 1.5, 99]) {
    const many = bleedSplats({ seed: 0.1, heavy: true, strength });
    assert.ok(many.length <= BLEED_SPLATS_MOST, `${strength}: ${many.length}`);
    assert.ok(many.length <= BLEED_ALIVE_MOST);
  }
  assert.equal(bleedSplats({ strength: 0 }).length, 0, 'and none at all at no strength');
});

test('every splat carries its own run and its own spray', () => {
  for (const s of bleedSplats({ seed: 0.44, heavy: true })) {
    assert.ok(s.w > 0 && s.h > 0);
    assert.equal(s.round.length, 4, 'four corners, so it is not a disc');
    assert.ok(s.drip.h > 0 && s.drip.w > 0, 'blood runs');
    assert.ok(s.spots.length >= 1, 'and throws spray');
    assert.ok(s.opacity > 0 && s.opacity <= 1);
  }
});

test('where the shell asks for readability, blood lands smaller and thinner', () => {
  // The chat log: the right fifth of the window.
  const chat = [{ x: 0.79, y: 0, w: 0.21, h: 1 }];
  const splats = bleedSplats({ from: 'right', seed: 0.9, heavy: true, keepClear: chat });
  const over = splats.filter((s) => s.kept), off = splats.filter((s) => !s.kept);
  assert.ok(over.length > 0, 'some of it does land there — it is not a wall');
  for (const s of over) {
    assert.ok(s.opacity <= 0.52, 'but thinner');
    if (off.length) assert.ok(s.w <= Math.max(...off.map((o) => o.w)), 'and no bigger than the biggest elsewhere');
  }
  assert.equal(BLEED_KEPT_CLEAR < 0.5, true, 'kept-clear blood is well under half strength');
  // With nothing to keep clear, nothing is marked.
  assert.ok(bleedSplats({ seed: 0.9, heavy: true }).every((s) => !s.kept));
});

test('a kept-clear area given as rubbish is ignored rather than throwing', () => {
  for (const clear of [null, 'chat', [null], [{}], [{ x: 'a', y: 'b', w: 'c', h: 'd' }]]) {
    assert.ok(Array.isArray(bleedSplats({ seed: 0.2, keepClear: clear })));
  }
});

test('the shudder dies away rather than stopping, and ends at nothing', () => {
  const end = bleedShudder(1);
  assert.equal(end.x, 0); assert.equal(end.y, 0); assert.equal(end.rot, 0); assert.equal(end.left, 0);
  for (const [key, v] of Object.entries(end)) assert.ok(!Object.is(v, -0), `${key} is 0, never -0`);
  assert.ok(bleedShudder(0.1).left > bleedShudder(0.6).left, 'it is weaker as it goes');
  assert.ok(Math.abs(bleedShudder(0.1, 1.5).x) > Math.abs(bleedShudder(0.1, 0.4).x), 'and stronger when set stronger');
  assert.deepEqual(bleedShudder(4), bleedShudder(1), 'past the end is the end');
});

test('settings nobody has saved yet fall back to the defaults', () => {
  assert.deepEqual(bleedLooks(), { ...BLEED_DEFAULTS });
  assert.deepEqual(bleedLooks({}), { ...BLEED_DEFAULTS });
  assert.equal(bleedLooks({ shudder: true }).shudder, true, 'what was saved is kept');
  assert.equal(bleedLooks({ shudder: true }).edge, true, 'and the rest keep their defaults');
  assert.equal(bleedLooks({ edge: 'yes' }).edge, BLEED_DEFAULTS.edge, 'a value that is not a yes or no is not an answer');
  assert.equal(Object.hasOwn(bleedLooks({ madeUp: true }), 'madeUp'), false, 'a look nobody has heard of is dropped');
});

test('with everything off the shell builds nothing at all', () => {
  assert.equal(bleedWanted(bleedLooks({ edge: false, glass: false, drain: false, beat: false, tunnel: false, shudder: false })), false);
  assert.equal(bleedWanted(BLEED_DEFAULTS), true);
  assert.equal(bleedWanted(null), false);
});

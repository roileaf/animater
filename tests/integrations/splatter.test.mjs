import test from 'node:test';
import assert from 'node:assert/strict';
import { bleedOf, splatScale, splatterOn, splatterReady, tokenSize, CRIT_BLEED, KILL_BLEED } from '../../scripts/integrations/splatter.mjs';

const hp = (value, max = 20) => ({ value, max, down: value <= 0, marked: false });

test('bleedOf: cuts bleed most, burns little, the mind not at all; aliases and unknown types', () => {
  assert.ok(bleedOf('slashing') > bleedOf('bludgeoning'));
  assert.ok(bleedOf('bludgeoning') > bleedOf('fire'));
  assert.equal(bleedOf('psychic'), 0);
  assert.equal(bleedOf('Lightning'), bleedOf('electricity'));
  assert.equal(bleedOf(undefined), 1);
  assert.equal(bleedOf('untyped'), 1);
});

test("splatScale: Splatter's own measure times the bleed", () => {
  assert.equal(splatScale({ before: hp(20), after: hp(10), type: 'untyped' }), 0.5 + 0.7);
  assert.equal(splatScale({ before: hp(20), after: hp(10), type: 'untyped', size: 2 }), 2 * 1.2);
  assert.ok(Math.abs(splatScale({ before: hp(20), after: hp(10), type: 'fire' }) - 1.2 * 0.3) < 1e-9);
});

test('splatScale: crits and killing blows bleed more', () => {
  const plain = splatScale({ before: hp(20), after: hp(10), type: 'piercing' });
  assert.ok(Math.abs(splatScale({ before: hp(20), after: hp(10), type: 'piercing', crit: true }) - plain * CRIT_BLEED) < 1e-9);
  const kill = splatScale({ before: hp(10), after: hp(0), type: 'piercing' });
  assert.ok(Math.abs(kill - 1.2 * 1.1 * KILL_BLEED) < 1e-9);
});

test('splatScale: no blood for psychic, healing to none lost, unreadable tracks, or above the threshold', () => {
  assert.equal(splatScale({ before: hp(20), after: hp(10), type: 'psychic' }), 0);
  assert.equal(splatScale({ before: hp(10), after: hp(10), type: 'slashing' }), 0);
  assert.equal(splatScale({ before: null, after: hp(10), type: 'slashing' }), 0);
  assert.equal(splatScale({ before: hp(20), after: { value: 5, max: NaN, down: false }, type: 'slashing' }), 0);
  assert.equal(splatScale({ before: hp(20), after: hp(15), type: 'slashing', threshold: 50 }), 0);
  assert.ok(splatScale({ before: hp(20), after: hp(8), type: 'slashing', threshold: 50 }) > 0);
});

test('splatScale: a marked track (Daggerheart) counts marks taken and what is left unmarked', () => {
  const mark = (value) => ({ value, max: 6, down: value >= 6, marked: true });
  assert.ok(Math.abs(splatScale({ before: mark(2), after: mark(3), type: 'slashing' }) - (1 / 6 + 0.7) * 1.3) < 1e-9);
  assert.equal(splatScale({ before: mark(0), after: mark(1), type: 'slashing', threshold: 50 }), 0);
});

test("splatterOn: Splatter's blood switch and its combat-only switch", () => {
  const get = (values) => (key, fallback) => values[key] ?? fallback;
  assert.equal(splatterOn(get({}), null), true);
  assert.equal(splatterOn(get({ enableBloodsplatter: false }), null), false);
  assert.equal(splatterOn(get({ onlyInCombat: true }), null), false);
  assert.equal(splatterOn(get({ onlyInCombat: true }), { started: true }), true);
});

test('splatterReady: the module is on and answers splat', () => {
  const game = (active) => ({ modules: new Map([['splatter', { active }]]) });
  assert.equal(splatterReady(game(true), { Splatter: { splat: () => {} } }), true);
  assert.equal(splatterReady(game(false), { Splatter: { splat: () => {} } }), false);
  assert.equal(splatterReady(game(true), {}), false);
});

test("tokenSize: Splatter's size from texture scale and the larger side", () => {
  assert.equal(tokenSize({ width: 2, height: 1, texture: { scaleX: -1, scaleY: 1 } }), 2);
  assert.equal(tokenSize({ width: 1, height: 1, texture: { scaleX: 1.5, scaleY: 0.5 } }), 1);
  assert.equal(tokenSize(undefined), 1);
});

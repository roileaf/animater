import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPEL_WINDOW_MS, twoeCounteract, dnd5eDispelSpell, createDnd5eDispels, createDispelWindow, effectTokenIds,
  lastingAnimaterEffect, createFlickerHost, flickerFactor, dispelMessage, receiveDispel, idsOfTokens, spotHolds,
} from '../../../scripts/engines/playback/dispel.mjs';

const counteract = (context = {}, extra = {}) => ({
  id: 'm1', whisper: [], author: { id: 'u1', isGM: false },
  flags: { pf2e: { context: { type: 'check', domains: ['all', 'check', 'counteract-check'], options: [], outcome: 'success', ...context } } },
  ...extra,
});

test('a PF2e counteract check: its degree, and the token it targeted', () => {
  assert.deepEqual(twoeCounteract(counteract({ target: { token: 'Scene.s1.Token.t9', actor: 'Actor.a' } })), { outcome: 'success', tokenIds: ['t9'] });
  assert.equal(twoeCounteract(counteract({ outcome: 'criticalSuccess' })).outcome, 'success');
  assert.equal(twoeCounteract(counteract({ outcome: 'failure' })).outcome, 'failure');
  assert.equal(twoeCounteract(counteract({ outcome: 'criticalFailure' })).outcome, 'failure');
});

test('a counteract check is known by its domain, its options or its type', () => {
  assert.ok(twoeCounteract(counteract({ domains: ['check'], options: ['check:statistic:counteract'] })));
  assert.ok(twoeCounteract(counteract({ domains: [], options: ['counteract'] })));
  assert.ok(twoeCounteract(counteract({ type: 'counteract-check', domains: [] })));
  assert.equal(twoeCounteract(counteract({ domains: ['check', 'athletics-check'] })), null);
  assert.equal(twoeCounteract(counteract({ type: 'saving-throw' })), null);
  assert.equal(twoeCounteract({ flags: {} }), null);
});

test('SF2e reads its own flags', () => {
  const message = { whisper: [], flags: { sf2e: counteract().flags.pf2e } };
  assert.equal(twoeCounteract(message, 'sf2e').outcome, 'success');
  assert.equal(twoeCounteract(message, 'pf2e'), null);
});

test('a counteract without a DC, or with a hidden result, is unknown: it shatters what ends but never flickers', () => {
  assert.equal(twoeCounteract(counteract({ outcome: undefined })).outcome, 'unknown');
  assert.equal(twoeCounteract(counteract({}, { blind: true })).outcome, 'unknown');
  assert.equal(twoeCounteract(counteract({}, { whisper: ['gm'], author: { isGM: false } })).outcome, 'unknown');
});

test('the roller\'s own targets stand in when the check names none', () => {
  assert.deepEqual(twoeCounteract(counteract(), 'pf2e', { targets: ['a', 'b'] }).tokenIds, ['a', 'b']);
  assert.deepEqual(twoeCounteract(counteract({ target: { token: 'Scene.s.Token.z' } }), 'pf2e', { targets: ['a'] }).tokenIds, ['z']);
});

test('D&D 5e: Dispel Magic and Counterspell, by identifier or by name', () => {
  assert.equal(dnd5eDispelSpell({ item: { system: { identifier: 'dispel-magic' } } }), 'dispel-magic');
  assert.equal(dnd5eDispelSpell({ item: { name: 'Counterspell', system: {} } }), 'counterspell');
  assert.equal(dnd5eDispelSpell({ item: { name: 'Fireball', system: { identifier: 'fireball' } } }), null);
  assert.equal(dnd5eDispelSpell(null), null);
});

test('D&D 5e: the cast succeeds; a later check by the caster against a DC can renew it or turn it to a failure', () => {
  let t = 0;
  const dispels = createDnd5eDispels({ now: () => t });
  assert.deepEqual(dispels.cast('a1', ['t1']), { outcome: 'success', tokenIds: ['t1'] });
  t = 5000;
  assert.deepEqual(dispels.check('a1', [{ total: 18, options: { target: 15 } }]), { outcome: 'success', tokenIds: ['t1'] });
  assert.deepEqual(dispels.check('a1', [{ total: 9, options: { target: 15 } }]), { outcome: 'failure', tokenIds: ['t1'] });
  // No DC, another actor, or long after: not the dispel's check.
  assert.equal(dispels.check('a1', [{ total: 9, options: {} }]), null);
  assert.equal(dispels.check('a2', [{ total: 9, options: { target: 15 } }]), null);
  t = 5000 + 61000;
  assert.equal(dispels.check('a1', [{ total: 9, options: { target: 15 } }]), null);
});

test('the broadcast message and its receiver', () => {
  const message = dispelMessage({ outcome: 'failure', tokenIds: ['t1'] }, { sender: 'c1', userId: 'u1', sceneId: 's1', at: 5 });
  assert.deepEqual(message, { type: 'dispel', sender: 'c1', userId: 'u1', sceneId: 's1', outcome: 'failure', tokenIds: ['t1'], at: 5 });
  const got = [];
  const handle = (d) => got.push(d);
  receiveDispel(message, 'u1', { sceneId: 's1', handle });
  receiveDispel(message, 'u2', { sceneId: 's1', handle });            // someone else's name
  receiveDispel(message, 'u1', { sceneId: 's2', handle });            // another scene
  receiveDispel({ ...message, outcome: 'win' }, 'u1', { sceneId: 's1', handle });
  receiveDispel({ ...message, type: 'kill-cam' }, 'u1', { sceneId: 's1', handle });
  assert.deepEqual(got, [{ outcome: 'failure', tokenIds: ['t1'] }]);
});

test('token ids on an effect: its source, target and attachment uuids', () => {
  assert.deepEqual(effectTokenIds({ source: 'Scene.s.Token.t1', target: 'Scene.s.Token.t2' }), ['t1', 't2']);
  assert.deepEqual(effectTokenIds({ source: 'Scene.s.Region.r1' }), []);
  assert.deepEqual(effectTokenIds({ attachTo: { active: true }, source: { uuid: 'Scene.s.Token.t3' } }), ['t3']);
  assert.deepEqual(effectTokenIds(null), []);
});

test('only Animater\'s lasting effects take part', () => {
  assert.equal(lastingAnimaterEffect({ data: { moduleName: 'animater', persist: true } }), true);
  assert.equal(lastingAnimaterEffect({ data: { moduleName: 'animater', persist: false } }), false);
  assert.equal(lastingAnimaterEffect({ data: { moduleName: 'other', persist: true } }), false);
  assert.equal(lastingAnimaterEffect({ data: { moduleName: 'animater', persist: true, animaterPreview: true } }), false);
});

test('a success opens a 4 second window: a lasting effect ending inside it shatters, once per effect', () => {
  let t = 1000;
  const window = createDispelWindow({ now: () => t });
  assert.equal(DISPEL_WINDOW_MS, 4000);
  window.add({ outcome: 'success', tokenIds: ['t1'] });
  // An area (no token) and an aura on the targeted token shatter; one on another token does not.
  assert.equal(window.shatters({ source: 'Scene.s.Region.r1' }), true);
  assert.equal(window.shatters({ source: 'Scene.s.Token.t1' }), true);
  assert.equal(window.shatters({ source: 'Scene.s.Token.t2' }), false);
  assert.equal(window.isOpen(), true);
  t = 1000 + 4001;
  assert.equal(window.shatters({ source: 'Scene.s.Region.r1' }), false);
  assert.equal(window.isOpen(), false);
});

test('a success with no targets shatters any lasting effect that ends; a failure opens no shatter window', () => {
  let t = 0;
  const window = createDispelWindow({ now: () => t });
  window.add({ outcome: 'failure', tokenIds: [] });
  assert.equal(window.shatters({ source: 'Scene.s.Token.t2' }), false);
  window.add({ outcome: 'unknown', tokenIds: [] });
  assert.equal(window.shatters({ source: 'Scene.s.Token.t2' }), true);
  window.clear();
  assert.equal(window.shatters({ source: 'Scene.s.Token.t2' }), false);
});

test('spotHolds: an area that covers a point', () => {
  assert.equal(spotHolds({ x: 0, y: 0, radius: 100 }, { x: 60, y: 60 }), true);
  assert.equal(spotHolds({ x: 0, y: 0, radius: 50 }, { x: 60, y: 60 }), false);
  assert.equal(spotHolds(null, { x: 0, y: 0 }), false);
  assert.deepEqual(idsOfTokens([{ id: 'a' }, { document: { id: 'b' } }, null]), ['a', 'b']);
});

test('the flicker dips and returns to exactly where it started', () => {
  assert.equal(flickerFactor(0), 1);
  assert.equal(flickerFactor(1), 1);
  assert.equal(flickerFactor(2), 1);
  const dips = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(flickerFactor);
  assert.ok(dips.some((f) => f < 0.6));
  assert.ok(dips.every((f) => f > 0 && f <= 1));
});

test('the flicker host restores each effect\'s alpha exactly, even when flickered twice', () => {
  let t = 0;
  const host = createFlickerHost({ now: () => t, durationMs: 600 });
  const effect = { alpha: 0.83, destroyed: false };
  host.start(effect);
  t = 150; host.tick();
  assert.notEqual(effect.alpha, 0.83);
  host.start(effect);              // again mid-flicker: the first alpha is kept
  t = 300; host.tick();
  t = 1000; host.tick();
  assert.equal(effect.alpha, 0.83);
  assert.equal(host.count(), 0);
  host.start(effect);
  t = 1100; host.tick();
  host.clear();
  assert.equal(effect.alpha, 0.83);
});

test('the flicker host drops an effect that is destroyed and never throws', () => {
  let t = 0;
  const host = createFlickerHost({ now: () => t });
  const gone = { alpha: 1, destroyed: false };
  host.start(gone);
  gone.destroyed = true;
  t = 100; host.tick();
  assert.equal(host.count(), 0);
  const bad = { get alpha() { throw new Error('gone'); }, set alpha(v) { throw new Error('gone'); } };
  host.start(bad);
  assert.doesNotThrow(() => host.tick());
});

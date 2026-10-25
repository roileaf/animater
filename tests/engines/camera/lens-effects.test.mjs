import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensEffectTypes, lensEffectHit, lensEffectsFor, envelope, boardAt, mergeBoard, boardStyle, LENS_EFFECT_TYPES, LENS_EFFECT_ENERGY } from '../../../scripts/engines/camera/lens-effects.mjs';
import { damageFromMessage, damageFromParts } from '../../../scripts/engines/playback/damage-moments.mjs';
import { rollMessage, weapon, card, dualityRoll, damageRoll } from '../../fixtures/daggerheart-messages.mjs';

const VIEW = { width: 1600, height: 900 };
const plan = (type, o = {}) => lensEffectsFor({ types: [type], strength: 0.5, view: VIEW, impact: { x: 300, y: 400 }, seed: 's', ...o })[0];
const shapesOf = (p) => p.layers.reduce((n, l) => n + (l.shapes?.length ?? 0) + (l.vignette ? 1 : 0), 0);
const liveOf = (p) => p.live.reduce((n, g) => n + (g.items?.length ?? 1), 0);
const peakAlpha = (p) => Math.max(0, ...p.layers.map((l) => l.vignette?.alpha ?? 0), ...p.layers.flatMap((l) => (l.shapes ?? []).map((s) => s.alpha ?? 0)));

test('a damage record calls for its energy types, largest first and two at most, physical ones only for blood', () => {
  assert.deepEqual(lensEffectTypes({ type: 'fire', types: ['fire', 'slashing', 'cold', 'acid'] }), ['fire', 'cold']);
  assert.deepEqual(lensEffectTypes({ type: 'slashing', types: ['slashing', 'piercing'] }), []);
  assert.deepEqual(lensEffectTypes({ type: 'piercing', types: ['piercing', 'bleed'] }), ['bleed'], 'bleed darkens the view');
  assert.deepEqual(lensEffectTypes({ type: 'bludgeoning' }), [], 'a plain blow');
  assert.deepEqual(lensEffectTypes({ type: 'bludgeoning', crit: true }), ['bludgeoning'], 'a crushing crit cracks the lens');
  assert.deepEqual(lensEffectTypes({ type: 'slashing', types: ['slashing', 'fire', 'electricity', 'bleed'] }), ['fire', 'electricity', 'bleed']);
  // Every system's names reach the looks.
  for (const [name, look] of [['lightning', 'electricity'], ['thunder', 'sonic'], ['necrotic', 'void'], ['radiant', 'vitality'], ['psychic', 'mental'], ['negative', 'void'], ['positive', 'vitality']]) assert.deepEqual(lensEffectTypes({ type: name }), [look], name);
  assert.deepEqual(lensEffectTypes(), []);
});

test("Daggerheart's magic shimmers (its generic arcana force left out), a domain's own energy kept; physical is blood only", () => {
  assert.deepEqual(lensEffectTypes({ type: 'force', dhType: 'magical' }), ['arcane']);
  assert.deepEqual(lensEffectTypes({ type: 'void', dhType: 'magical' }), ['arcane', 'void']);
  assert.deepEqual(lensEffectTypes({ type: 'slashing', dhType: 'physical' }), []);
  assert.deepEqual(lensEffectTypes({ type: 'arcane' }), ['arcane'], 'the showcase picks it by name');
});

test('every system\'s damage records reach the lens effects', () => {
  // PF2e / SF2e: damage instances, the largest first.
  class DamageRoll { constructor(instances) { this.instances = instances; } }
  const pf = damageFromMessage({ rolls: [new DamageRoll([{ type: 'slashing', total: 4 }, { type: 'cold', total: 3 }, { type: 'fire', total: 9 }])], flags: { pf2e: { context: { type: 'damage-roll' } } } }, 'pf2e');
  assert.deepEqual(pf.types, ['fire', 'slashing', 'cold'], 'types sorted by their share');
  assert.deepEqual(lensEffectTypes(pf), ['fire', 'cold']);
  const sf = damageFromMessage({ rolls: [new DamageRoll([{ type: 'electricity', total: 6 }])], flags: { sf2e: { context: { type: 'damage-roll' } } } }, 'sf2e');
  assert.deepEqual(lensEffectTypes(sf), ['electricity']);
  for (const t of ['acid', 'cold', 'electricity', 'fire', 'force', 'mental', 'poison', 'sonic', 'spirit', 'vitality', 'void']) {
    const d = damageFromMessage({ rolls: [new DamageRoll([{ type: t, total: 5 }])], flags: { pf2e: { context: { type: 'damage-roll' } } } }, 'pf2e');
    assert.deepEqual(lensEffectTypes(d), [t], `PF2e ${t}`);
  }
  // D&D 5e: one roll per type in the message, and the parts it applies.
  const dnd = damageFromMessage({ rolls: [{ options: { type: 'piercing' }, total: 5 }, { options: { type: 'lightning' }, total: 11 }], flags: { dnd5e: { roll: { type: 'damage' } } } }, 'dnd5e');
  assert.deepEqual(lensEffectTypes(dnd), ['electricity']);
  for (const [t, look] of [['acid', 'acid'], ['cold', 'cold'], ['fire', 'fire'], ['force', 'force'], ['lightning', 'electricity'], ['necrotic', 'void'], ['poison', 'poison'], ['psychic', 'mental'], ['radiant', 'vitality'], ['thunder', 'sonic']]) {
    assert.deepEqual(lensEffectTypes(damageFromMessage({ rolls: [{ options: { type: t }, total: 5 }], flags: { dnd5e: { roll: { type: 'damage' } } } }, 'dnd5e')), [look], `D&D ${t}`);
  }
  const parts = damageFromParts([{ type: 'slashing', value: 3 }, { type: 'necrotic', value: 8 }, { type: 'radiant', value: 2 }], 'orc');
  assert.deepEqual(parts.types, ['void', 'slashing', 'vitality']);
  assert.deepEqual(lensEffectTypes(parts), ['void', 'vitality']);
  // Daggerheart: physical by weapon, magical shimmers (with its domain's energy).
  const sword = damageFromMessage(rollMessage({ item: weapon('Longsword'), damage: damageRoll() }), 'daggerheart');
  assert.deepEqual(lensEffectTypes(sword), []);
  const arcana = damageFromMessage(rollMessage({ item: card('Blink Out', 'arcana'), roll: dualityRoll({ type: 'spellcast' }), damage: damageRoll({ types: ['magical'] }) }), 'daggerheart');
  assert.equal(arcana.dhType, 'magical');
  assert.deepEqual(lensEffectTypes(arcana), ['arcane']);
  const midnight = damageFromMessage(rollMessage({ item: card('Shadowbind', 'midnight'), roll: dualityRoll({ type: 'spellcast' }), damage: damageRoll({ types: ['magical'] }) }), 'daggerheart');
  assert.deepEqual(lensEffectTypes(midnight), ['arcane', 'void']);
  for (const t of lensEffectTypes(midnight)) assert.ok(LENS_EFFECT_TYPES.includes(t));
});

const HIT = { role: 'victim', before: { value: 40, max: 40 }, after: { value: 16, max: 40 }, types: ['fire'] };
test('the effects follow the lens blood rule: players only, perceived, their switches, gore and quality', () => {
  const hit = lensEffectHit(HIT);
  assert.equal(hit.kind, 'self');
  assert.deepEqual(hit.types, ['fire']);
  assert.ok(hit.strength > 0.9, '60% of max HP is about full');
  assert.equal(lensEffectHit({ ...HIT, isGM: true }), null);
  assert.equal(lensEffectHit({ ...HIT, worldOn: false }), null);
  assert.equal(lensEffectHit({ ...HIT, localOn: false }), null);
  assert.equal(lensEffectHit({ ...HIT, role: null }), null);
  assert.equal(lensEffectHit({ ...HIT, visible: false }), null);
  assert.equal(lensEffectHit({ ...HIT, hidden: true }), null);
  assert.equal(lensEffectHit({ ...HIT, gore: 'off' }), null);
  assert.equal(lensEffectHit({ ...HIT, quality: 'off' }), null);
  assert.equal(lensEffectHit({ ...HIT, types: [] }), null, 'plain physical');
  assert.equal(lensEffectHit({ ...HIT, after: { value: 40, max: 40 } }), null, 'no damage');
  assert.equal(lensEffectHit({ ...HIT, gore: 'subtle' }).amount, 'subtle');
  assert.equal(lensEffectHit({ ...HIT, quality: 'low' }).amount, 'subtle');
  const dealt = lensEffectHit({ ...HIT, role: 'attacker', bleeds: false, screen: { x: 900, y: 300 } });
  assert.equal(dealt.kind, 'dealt', 'a bloodless creature still burns on the lens');
  assert.deepEqual(dealt.impact, { x: 900, y: 300 });
  const tiny = lensEffectHit({ ...HIT, after: { value: 39, max: 40 }, crit: true });
  assert.ok(tiny.strength >= 0.5, 'a crit for 1 damage is still clear');
  assert.ok(lensEffectHit({ ...HIT, after: { value: 37, max: 40 } }).strength < 0.4, 'a scratch is light');
});

test('every type plans its own shapes, deterministic by seed', () => {
  for (const type of LENS_EFFECT_TYPES) {
    const p = plan(type);
    assert.equal(p.type, type);
    assert.ok(shapesOf(p) + liveOf(p) > 0, `${type} draws something`);
    assert.ok(p.lifeMs > 600 && p.lifeMs < 4000, `${type} is short: ${p.lifeMs}`);
    assert.deepEqual(plan(type), p, `${type} is deterministic`);
    if (!['poison', 'mental', 'bleed', 'vitality'].includes(type)) assert.notDeepEqual(plan(type, { seed: 'other' }), p, `${type} varies by seed`);
  }
  // What each one is made of.
  const kinds = (p) => p.live.map((g) => g.kind);
  assert.deepEqual(kinds(plan('fire')), ['embers']);
  assert.ok(plan('fire').layers.some((l) => l.canvas === 'mark' && l.shapes?.length && l.reveal?.mode === 'edges'), 'soot creeps in from the edges');
  assert.ok(plan('cold').layers.some((l) => l.canvas === 'glint' && l.shapes?.some((s) => s.p === 'segs')), 'frost needles');
  assert.deepEqual(kinds(plan('cold')), ['drips'], 'it thaws');
  assert.deepEqual(kinds(plan('electricity')), ['flash', 'arcs']);
  assert.ok(plan('electricity').live[1].items.every((a) => a.life >= 300 && a.life <= 900));
  assert.deepEqual(kinds(plan('acid')), ['bubbles']);
  assert.ok(plan('poison').board?.length && plan('poison').layers.every((l) => l.pulse), 'poison pulses and sways');
  assert.deepEqual(kinds(plan('sonic')), ['rings']);
  assert.ok(plan('sonic').board.some((k) => k.blur > 0));
  assert.ok(plan('sonic', { crit: true }).layers.some((l) => l.reveal?.mode === 'radial'), 'a sonic crit cracks the lens');
  assert.ok(plan('force').layers.some((l) => l.reveal?.mode === 'radial' && l.shapes.length > 20), 'force cracks');
  assert.ok(plan('void').board.some((k) => k.saturate < 0.7), 'void drains colour');
  assert.ok(plan('vitality').layers.every((l) => l.canvas === 'glint'), 'vitality is light only');
  assert.ok(plan('mental').board.some((k) => k.split > 3), 'double vision');
  assert.deepEqual(kinds(plan('spirit')), ['wisps']);
  assert.deepEqual(kinds(plan('arcane')), ['sparkles']);
  assert.ok(plan('bludgeoning').layers.some((l) => l.reveal?.mode === 'radial'));
  assert.ok(plan('bludgeoning').layers[0].shapes.length < plan('force', { strength: 1 }).layers[0].shapes.length, 'a smaller crack than force');
});

test('stronger hits draw more, crits stronger and longer, Subtle lighter', () => {
  for (const type of LENS_EFFECT_ENERGY) {
    const light = plan(type, { strength: 0.2 }), full = plan(type, { strength: 1 }), crit = plan(type, { strength: 0.2, crit: true });
    assert.ok(full.strength > light.strength, type);
    assert.ok(shapesOf(full) + liveOf(full) >= shapesOf(light) + liveOf(light), `${type} draws more for more damage`);
    assert.ok(peakAlpha(full) >= peakAlpha(light), `${type} is bolder for more damage`);
    assert.ok(crit.strength >= 0.75, `${type}: a small crit is still clear`);
    assert.ok(crit.lifeMs > light.lifeMs * 1.3, `${type}: a crit lasts longer`);
    assert.ok(crit.time.hold >= light.time.hold * 1.45, `${type}: a crit holds about 1.5x`);
    assert.ok(full.time.hold <= 1000, `${type}: held about a second at most`);
    assert.ok(plan(type, { strength: 1, crit: true }).time.hold <= 1500, `${type}: a crit holds 1.5 s at most`);
    const subtle = plan(type, { strength: 1, amount: 'subtle' });
    assert.ok(subtle.strength < full.strength * 0.6, `${type} Subtle is toned down`);
    assert.ok(shapesOf(subtle) + liveOf(subtle) <= shapesOf(full) + liveOf(full), `${type} Subtle draws no more`);
  }
  // A blow dealt is a little lighter than one taken; the second energy type of a hit lighter than the first.
  assert.ok(plan('fire', { kind: 'dealt' }).strength < plan('fire').strength);
  const [fire, cold] = lensEffectsFor({ types: ['fire', 'cold'], strength: 0.6, view: VIEW, seed: 's' });
  assert.ok(cold.strength < fire.strength);
});

test('Low quality keeps only the marks: no particles, flicker or board filters; Off none', () => {
  for (const type of LENS_EFFECT_TYPES) {
    const low = plan(type, { quality: 'low' });
    assert.equal(low.board, null, `${type}: no board filter at Low`);
    assert.equal(low.lite, true);
    for (const g of low.live) {
      assert.ok(['arcs', 'wisps', 'sparkles'].includes(g.kind), `${type}: no ${g.kind} at Low`);
      if (g.kind === 'arcs') assert.ok(g.items.every((a) => !a.flicker && a.variants.length === 1));
      if (g.kind === 'wisps') assert.ok(g.items.every((w) => w.dx === 0 && w.dy === 0));
      if (g.kind === 'sparkles') assert.equal(g.still, true);
    }
    assert.ok(plan(type, { quality: 'balanced' }).lite === false);
  }
  assert.ok(plan('poison', { quality: 'balanced' }).board, 'Balanced sways the board');
  assert.deepEqual(lensEffectsFor({ types: ['fire'], quality: 'off', view: VIEW }), []);
  assert.deepEqual(lensEffectsFor({ types: [], view: VIEW }), []);
});

test('timelines and the board look ease in and back out to nothing', () => {
  const t = { delay: 100, in: 100, hold: 200, out: 100 };
  assert.equal(envelope(50, t), 0);
  assert.equal(envelope(250, t), 1);
  assert.ok(envelope(450, t) > 0 && envelope(450, t) < 1);
  assert.equal(envelope(600, t), 0);
  const v = plan('void');
  const mid = boardAt(v, v.time.in + v.time.hold / 2);
  assert.ok(mid.saturate < 0.8 && mid.brightness < 1);
  assert.deepEqual(boardAt(v, v.lifeMs + 100), {});
  assert.deepEqual(boardStyle(mergeBoard([boardAt(v, v.board.at(-1).t)])), { filter: '', transform: '', split: 0 });
  const look = boardStyle(mergeBoard([{ saturate: 0.5, blur: 1 }, { saturate: 0.8, dx: 2, blur: 0.4 }, { split: 6 }]));
  assert.match(look.filter, /url\(#animater-lens-split\)/);
  assert.match(look.filter, /blur\(1px\)/);
  assert.match(look.filter, /saturate\(0\.4\)/);
  assert.match(look.transform, /translate\(2px, 0px\)/);
  assert.equal(look.split, 6);
  assert.deepEqual(boardStyle({}), { filter: '', transform: '', split: 0 });
});

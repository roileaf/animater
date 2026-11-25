import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWindSpell, windSpellGusts, WIND_SPELL_MS } from '../../../scripts/engines/motion/wind-spell.mjs';
import { createGusts, gustShare } from '../../../scripts/engines/motion/gusts.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

// Roi, 2026-11-25, of the elements meeting the world: wind spells first. And of putting torches out with them:
// "theres no such mechanic, so visual only".
test('a wind spell is known by its air trait, or by its name in any system; nothing else is', () => {
  assert.equal(isWindSpell({ name: 'Howling Blizzard', traits: ['air', 'cold'] }), true, 'PF2e: the air trait');
  for (const name of ['Gust of Wind', 'Gust', 'Wind Wall', 'Whirlwind', 'Warding Wind', 'Control Winds', 'Cyclone', 'Tornado', 'Gale Blast', 'Tempest Surge', 'Windstorm']) assert.equal(isWindSpell({ name }), true, name);
  for (const name of ['Fireball', 'Window of Opportunity', 'Rewind', 'Lightning Bolt', 'Cone of Cold', 'Windowed Vision', 'Disgust', '']) assert.equal(isWindSpell({ name }), false, name);
  assert.equal(isWindSpell({ name: 'Fireball', traits: ['fire'] }), false);
  assert.equal(isWindSpell({}), false);
  assert.equal(isWindSpell(), false);
});

const felt = (gusts, x, y) => gusts.reduce((sum, g) => ({ x: sum.x + Math.cos(g.heading) * gustShare(g, x, y) * g.strength, y: sum.y + Math.sin(g.heading) * gustShare(g, x, y) * g.strength }), { x: 0, y: 0 });

test('a line blows from its start down its length: felt all along it, the way it points, and not beside it', () => {
  const gusts = windSpellGusts({ type: 'line', x: 1000, y: 1000, length: 1200, width: 200, rotation: 0 }, { grid: 100 });
  assert.equal(gusts.length, 1);
  for (const along of [200, 600, 1000]) { const w = felt(gusts, 1000 + along, 1000); assert.ok(w.x > 0.35 && Math.abs(w.y) < 0.05, `${along}: ${w.x}`); }
  assert.ok(felt(gusts, 1600, 1700).x < 0.05, 'seven squares to the side, nothing');
  assert.ok(felt(gusts, 600, 1000).x < 0.2, 'behind the caster, little');
  assert.ok(felt(gusts, 2700, 1000).x < 0.05, 'well past its end, nothing');
  assert.equal(gusts[0].ms, WIND_SPELL_MS);
  // Turned: a line pointing down the map blows down the map.
  const down = windSpellGusts({ type: 'line', x: 1000, y: 1000, length: 1200, width: 200, rotation: 90 }, { grid: 100 });
  const w = felt(down, 1000, 1600); assert.ok(w.y > 0.35 && Math.abs(w.x) < 0.05);
});

test('a cone blows out from its point, widening', () => {
  const gusts = windSpellGusts({ type: 'cone', x: 0, y: 0, radius: 1500, angle: 90, rotation: 0 }, { grid: 100 });
  assert.equal(gusts.length, 1);
  assert.ok(felt(gusts, 900, 0).x > 0.35);
  assert.ok(felt(gusts, 900, 500).x > 0.1, 'out to the side of it, still some');
  assert.ok(felt(gusts, 900, 500).x > felt(windSpellGusts({ type: 'line', x: 0, y: 0, length: 1500, width: 100, rotation: 0 }, { grid: 100 }), 900, 500).x, 'wider than a line');
});

test('a burst blows outward all round from its middle', () => {
  const gusts = windSpellGusts({ type: 'circle', x: 2000, y: 2000, radius: 600 }, { grid: 100 });
  assert.ok(gusts.length >= 6);
  for (const [dx, dy] of [[400, 0], [-400, 0], [0, 400], [0, -400], [280, 280]]) {
    const w = felt(gusts, 2000 + dx, 2000 + dy), out = (w.x * dx + w.y * dy) / Math.hypot(dx, dy);
    assert.ok(out > 0.25, `${dx},${dy}: blows outward (${out})`);
  }
  assert.ok(Math.hypot(felt(gusts, 2000, 2000).x, felt(gusts, 2000, 2000).y) < 0.2, 'still at the very middle: it blows every way at once');
  assert.ok(Math.hypot(felt(gusts, 3600, 2000).x, felt(gusts, 3600, 2000).y) < 0.05, 'ten squares past its edge, nothing');
  assert.ok(windSpellGusts({ type: 'emanation', x: 0, y: 0, radius: 300 }, { grid: 100 }).length >= 6, 'an emanation the same');
});

test('a shape with no way to blow (a square, a drawn area) blows outward from its middle; a shape that cannot be read, not at all', () => {
  const box = windSpellGusts({ type: 'rectangle', x: 1000, y: 1000, width: 600, height: 400 }, { grid: 100 });
  assert.ok(box.length >= 6);
  const w = felt(box, 1500, 1200); assert.ok(w.x > 0.2, 'outward from its middle at 1300, 1200');
  assert.ok(windSpellGusts({ type: 'polygon', points: [0, 0, 600, 0, 600, 600, 0, 600] }, { grid: 100 }).length >= 6);
  assert.deepEqual(windSpellGusts(null, { grid: 100 }), []);
  assert.deepEqual(windSpellGusts({ type: 'line', x: 'a', y: 0, length: 5 }, { grid: 100 }), []);
  assert.deepEqual(windSpellGusts({ type: 'circle', x: 0, y: 0, radius: 0 }, { grid: 100 }), []);
});

test('a wind spell blows indoors too: a gust told to come inside reaches under a ceiling, the others do not', () => {
  let t = 0; const gusts = createGusts({ now: () => t });
  gusts.add({ x: 1000, y: 500, heading: 0, strength: 1, width: 300, length: 600 });
  t += 1000;
  assert.ok(gusts.at(900, 500).x > 0.8);
  assert.deepEqual(gusts.at(900, 500, { sheltered: true }), { x: 0, y: 0 }, 'a dragon\'s wake does not come in under a roof');
  gusts.add({ x: 1000, y: 500, heading: Math.PI / 2, strength: 1, width: 300, length: 600, inside: true });
  t += 1000;
  const in_ = gusts.at(1000, 400, { sheltered: true });
  assert.ok(in_.y > 0.8 && Math.abs(in_.x) < 1e-9, 'a wind spell cast in the room does');
  for (const g of windSpellGusts({ type: 'line', x: 0, y: 0, length: 600, width: 100, rotation: 0 }, { grid: 100 })) assert.equal(g.inside, true);
});

test('wired: every screen blows it for itself as the spell\'s area appears on the scene it is looking at', () => {
  assert.match(main, /for \(const hook of \["createMeasuredTemplate", "createRegion"\]\) Hooks\.on\(hook, \(doc\) => propSafe\("wind spell", \(\) => blowWindSpell\(doc\)\)\);/);
  assert.match(main, /function blowWindSpell\(doc\) \{[\s\S]{0,200}?if \(!canvas\?\.ready \|\| doc\?\.parent\?\.id !== canvas\.scene\?\.id \|\| !gustsOn\(\) \|\| !windSpellsOn\(\)\) return;/);
  assert.match(main, /isWindSpell\(\{ name: item\?\.name, traits: Array\.from\(item\?\.system\?\.traits\?\.value \?\? \[\]\) \}\)/);
  assert.match(main, /for \(const gust of windSpellGusts\(shape, \{ grid: canvas\.grid\.size \}\)\) gusts\.add\(gust\);/);
  // Not behind Breakable props: it changes nothing and saves nothing.
  const blow = main.slice(main.indexOf('function blowWindSpell(doc) {'), main.indexOf('for (const hook of ["createMeasuredTemplate", "createRegion"]) Hooks.on(hook, (doc) => propSafe("wind spell"'));
  assert.ok(!/propsOn\(|updateEmbeddedDocuments|game\.socket\.emit|setFlag/.test(blow), 'nothing written, nothing sent, no scene switch');
  assert.match(registration('windSpells'), /name: "Wind spells blow"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  assert.ok(SETTINGS_TABS.flatMap((t) => t.rows).some((r) => r.world === 'localGusts' && r.extras?.includes('windSpells')));
});

test('wired: under a ceiling, flames and cloth feel only the gusts that came inside', () => {
  assert.match(main, /const air = !gusts\.busy \? \{ wind: skyWindNow, angle: skyWindAngle \} : shelter \? windAt\(\{ wind: 0, angle: 0 \}, gusts\.at\(x, y, \{ sheltered: true \}\)\) : windHere\(x, y\);\s*return flameWind\(\{ wind: air\.wind, angle: air\.angle, t: now \/ 1000, key, shelter: shelter && !\(air\.gust > 0\) \? 1 : 0 \}\);/);
  assert.match(main, /const air = decorRoofed\.get\(d\) \? windAt\(\{ wind: 0, angle: 0 \}, gusts\.at\(d\.x, d\.y, \{ sheltered: true \}\)\) : windHere\(d\.x, d\.y\);/);
});

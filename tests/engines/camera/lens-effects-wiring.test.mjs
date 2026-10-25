import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settingsModel, SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';
import { DamageShowcaseUI, DAMAGE_TYPES } from '../../../scripts/ui/damage-showcase-ui.mjs';
import { lensEffectTypes } from '../../../scripts/engines/camera/lens-effects.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

test('the effects have a world switch and an on-my-screen switch, registered beside lens blood', () => {
  const world = registration('lensEffects'), local = registration('lensEffectsLocal');
  assert.match(world, /name: "Damage type effects"/);
  assert.match(local, /name: "Damage type effects on my screen"/);
  // The feature's visible name is the damage lens; its setting keys stay as they were.
  assert.match(registration('lensBlood'), /name: "Damage lens"/);
  assert.match(registration('lensBloodLocal'), /name: "Damage lens on my screen"/);
  assert.match(registration('lensBloodAmount'), /name: "Damage lens amount"/);
  assert.match(world, /scope: "world", config: true, type: Boolean, default: true/);
  assert.match(world, /lensBlood\.clearEffects\(\)/);
  assert.match(local, /scope: "client", config: true, type: Boolean/);
  assert.match(local, /lensBlood\.clearEffects\(\)/);
  assert.ok(main.indexOf('registerSetting("lensEffects"') > main.indexOf('registerSetting("lensBloodLocal"'));
  assert.ok(main.indexOf('registerSetting("lensEffects"') < main.indexOf('registerSetting("lensBloodAmount"'));
});

test('the settings window lists them in Combat drama right under lens blood: world for the GM, local for everyone', () => {
  const drama = SETTINGS_TABS.find((t) => t.id === 'drama');
  const i = drama.rows.findIndex((r) => r.world === 'lensBlood');
  assert.deepEqual(drama.rows[i + 1], { world: 'lensEffects', local: 'lensEffectsLocal' });
  const reg = (key, scope) => [`animater.${key}`, { key, namespace: 'animater', scope, type: Boolean, name: key, hint: `${key} hint` }];
  const registry = new Map([reg('quality', 'client'), reg('lensEffects', 'world'), reg('lensEffectsLocal', 'client')]);
  const rows = (isGM) => Object.fromEntries(settingsModel({ registry, get: () => true, menus: new Map(), systemId: 'pf2e', modules: [], isGM }).tabs.flatMap((t) => t.rows.map((r) => [r.id, r])));
  assert.equal(rows(true).lensEffects.world.key, 'lensEffects');
  assert.equal(rows(true).lensEffects.local.key, 'lensEffectsLocal');
  const player = rows(false).lensEffects;
  assert.ok(player && !player.world && player.local.key === 'lensEffectsLocal');
});

test('main plays the effects with the blood: the hit\'s types into the lens decision, previews by the picked type', () => {
  assert.match(main, /import \{ lensEffectHit, lensEffectTypes \} from "\.\/engines\/camera\/lens-effects\.mjs"/);
  // lensShow: the same args, the effects' own switches (the showcase past the world one), drawn on the overlay.
  assert.match(main, /const fx = lensEffectHit\(\{ \.\.\.args, worldOn: args\.preview === true \|\| effectsWorldOn\(\), localOn: effectsLocalOn\(\), types: args\.effectTypes \?\? \[\] \}\);\s*if \(fx\) lensBlood\.effects\(fx, \{ seed, duration \}\);/);
  // The live hit: its damage record's types (crit included), with blood off but effects on still deciding.
  assert.match(main, /effectTypes: lensEffectTypes\(\{ \.\.\.\(damage \?\? by \?\? \{\}\), crit \}\)/);
  assert.match(main, /\(!lensWorldOn\(\) && !effectsWorldOn\(\)\)\) return;/);
  assert.match(main, /worldOn: lensWorldOn\(\), localOn: lensLocalOn\(\)/);
  // Previews: by the showcase's damage type and crit.
  assert.match(main, /preview: true,[\s\S]{0,120}effectTypes: lensEffectTypes\(\{ type: extra\?\.damageType \?\? null, crit: hit\.crit === true \}\)/);
  assert.match(main, /effects: effectsLocalOn\(\), effectsWorld: effectsWorldOn\(\)/);
  // Torn down with the lens (stopLensBlood clears the overlay, which puts the board back).
  assert.match(main, /Hooks\.on\("canvasTearDown", stopLensBlood\)/);
});

test('the showcase offers every effect type (Daggerheart\'s arcane too) and says whether this screen shows them', () => {
  const picked = DAMAGE_TYPES.map(([v]) => v).filter(Boolean);
  assert.ok(picked.includes('arcane'));
  for (const t of picked) assert.ok(Array.isArray(lensEffectTypes({ type: t })));
  for (const t of ['fire', 'cold', 'electricity', 'acid', 'poison', 'sonic', 'force', 'void', 'vitality', 'mental', 'spirit', 'arcane']) assert.deepEqual(lensEffectTypes({ type: t }), [t], t);
  const ui = new DamageShowcaseUI({ host: { damageShowcase: () => ({ tokens: [], presets: {}, settings: { effects: false, effectsWorld: true } }) } });
  assert.match(ui.html(), /damage lens on · damage type effects off/);
  ui.w.host.damageShowcase = () => ({ tokens: [], presets: {}, settings: { effectsWorld: false } });
  assert.match(ui.html(), /damage type effects on \(off for players\)/);
});

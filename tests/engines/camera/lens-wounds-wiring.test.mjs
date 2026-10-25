import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settingsModel, SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

test('the wounded view has its own client switch, on by default, right after the heartbeat', () => {
  const reg = registration('lensWounded');
  assert.match(reg, /name: "Wounded view on my screen"/);
  assert.match(reg, /scope: "client", config: true, type: Boolean, default: true/);
  // Off: its state, the muffle and the overlay's wound layers all go at once; on again: refreshed.
  assert.match(reg, /if \(on === false\) \{ woundReset\?\.\(\); worldMuffle\.restore\(\); lensBlood\.clearWounds\(\); \} else woundRefresh\?\.\(\);/);
  assert.ok(main.indexOf('registerSetting("lensWounded"') > main.indexOf('registerSetting("lensHeartbeat"'));
  // The lens's own switches put the muffle back too.
  assert.match(registration('lensBloodLocal'), /worldMuffle\.restore\(\)/);
});

test('the settings window shows it with the damage lens rows, under the Damage lens world switch', () => {
  const drama = SETTINGS_TABS.find((t) => t.id === 'drama');
  const row = drama.rows.find((r) => r.world === 'lensBlood');
  assert.deepEqual(row.extras, ['lensBloodAmount', 'lensTunnel', 'lensHeartbeat', 'lensWounded']);
  const reg = (key, scope) => [`animater.${key}`, { key, namespace: 'animater', scope, type: Boolean, name: key, hint: `${key} hint` }];
  const registry = new Map([reg('quality', 'client'), reg('lensBlood', 'world'), reg('lensBloodLocal', 'client'), reg('lensWounded', 'client')]);
  const rows = (isGM) => Object.fromEntries(settingsModel({ registry, get: () => true, menus: new Map(), systemId: 'pf2e', modules: [], isGM }).tabs.flatMap((t) => t.rows.map((r) => [r.id, r])));
  assert.ok(rows(false).lensBlood.extras.some((e) => e.key === 'lensWounded'), 'players see it');
  assert.ok(rows(true).lensBlood.extras.some((e) => e.key === 'lensWounded'));
});

test('the board and the world\'s audio are always put back: with the lens, on canvas tear-down, and from the showcase', () => {
  // stopLensBlood: the wound state reset, the muffle restored, the overlay cleared (its clear restores the board).
  assert.match(main, /const stopLensBlood = \(\) => \{\s*try \{ woundReset\?\.\(\); \} catch \{ \/\* nothing kept \*\/ \}\s*worldMuffle\.restore\(\);\s*lensBlood\.clear\(\);/);
  assert.match(main, /Hooks\.on\("canvasTearDown", stopLensBlood\)/);
  assert.match(main, /registerSetting\("lensBlood", \{[\s\S]*?onChange: \(on\) => \{ if \(on === false\) stopLensBlood\(\); \}/);
  // Only music and ambience are muffled (the heartbeat plays on the interface context).
  assert.match(main, /createWorldMuffle\(\{ contexts: \(\) => \[game\.audio\?\.music, game\.audio\?\.environment\] \}\)/);
  // The showcase's Stop ends the wound preview with the rest.
  assert.match(main, /stop: \(\) => \{\s*if \(!lingerPreview && !woundPreview && !lensBlood\.alive && !worldMuffle\.wired\) return;\s*lingerPreview = null;\s*woundPreview = null;\s*stopLensBlood\(\);/);
});

test('the player\'s own creature drives it: HP and conditions refresh it, a hit leaves stains, down states beat on the lingering loop', () => {
  assert.match(main, /const woundNow = \(\) => \{[\s\S]*?if \(game\.user\.isGM \|\| !canvas\?\.ready\) return null;[\s\S]*?const token = lensMine\(\)/);
  // The system's facts: statuses (PF2e conditions too), dying value and max, death saves.
  assert.match(main, /for \(const c of actor\?\.itemTypes\?\.condition \?\? \[\]\) if \(c\?\.slug\) statuses\.add\(c\.slug\);/);
  assert.match(main, /dying: \{ value: Number\(attr\.dying\?\.value \?\? dyingItem\?\.value \?\? 0\) \|\| 0, max: Number\(attr\.dying\?\.max\) \|\| 4 \}/);
  assert.match(main, /death: \{ success: Number\(attr\.death\?\.success\) \|\| 0, failure: Number\(attr\.death\?\.failure\) \|\| 0 \}/);
  for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'createItem', 'updateItem', 'deleteItem']) assert.ok(main.includes(`"${hook}"`), hook);
  assert.match(main, /for \(const hook of \["combatStart", "updateCombat", "deleteCombat", "controlToken", "canvasReady"\]\) Hooks\.on\(hook, lensRefresh\);/);
  assert.match(main, /if \(role === "victim" && splash && lensMine\(\)\?\.actor === actor\) woundHit\(splash\);/);
  // The red edges beat with the lingering heartbeat; the down beat is uneven; death lets the heartbeat go.
  assert.match(main, /if \(!down && woundPulse > 0\) lensBlood\.pulse\(woundPulse\);/);
  assert.match(main, /lingerTimer = setTimeout\(lingerTick, down \? nextBeatMs\(down\) : plan\.intervalMs\);/);
  assert.match(main, /beat\(heartbeatDeath\(lastBeat\)\);/);
  // Heartless creatures never beat.
  assert.match(main, /heartbeatDown\(now\.life, \{ heart: now\.heart,/);
});

test('the showcase host previews the wounded view, the down states and waking, with the system\'s labels', () => {
  for (const fn of ['previewLensWounded: (o) => lensPreview?.wounded(o)', 'previewLensDown: (o) => lensPreview?.down(o)', 'previewLensWake: (o) => lensPreview?.wake(o)']) assert.ok(main.includes(fn), fn);
  assert.match(main, /downStates: downPreviews\(game\.system\.id\)\.map\(\(\{ id, label \}\) => \(\{ id, label \}\)\)/);
  assert.match(main, /wounded: woundOn\(\) \}/);
  assert.match(main, /busy: \(\) => Boolean\(lingerPreview\) \|\| Boolean\(woundPreview\) \|\| Date\.now\(\) < woundUntil/);
});

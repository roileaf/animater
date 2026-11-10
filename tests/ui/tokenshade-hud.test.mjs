import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudLooks, hudSections, hudFilter, pushRecent, hudPaletteHTML, lookKey, RECENT, MINE } from '../../scripts/ui/tokenshade-hud.mjs';

// Roi: "lets add tokenshade quick set on the token hud as a button".
const presets = [
  { name: 'Glow', library: 'tokenshade' }, { name: 'Attitude: Angry', library: 'tokenshade' }, { name: 'Marker: Ally', library: 'tokenshade' },
  { name: 'Fade in', library: 'tokenshade' }, { name: 'Breathing', library: 'tokenshade' }, { name: 'My aura', library: 'tokenshade-custom' },
  { name: 'Haunted ground', library: 'tokenshade-region' },
];
const params = { 'Fade in': [{ animated: { a: { animType: 'once' } } }], Breathing: [{ animated: { a: { animType: 'driven' } } }] };
const looks = hudLooks(presets, (_, name) => params[name] ?? []);

test('the picker offers lasting token looks only: no transitions, none that follow the game, no region looks', () => {
  assert.deepEqual(looks.map((l) => l.name), ['Glow', 'Attitude: Angry', 'Marker: Ally', 'My aura']);
  assert.equal(looks.find((l) => l.name === 'My aura').group, MINE);
});

test('sections: Recent once something was used, the studio\'s sections, then Mine; a search goes through all', () => {
  assert.deepEqual(hudSections(looks, []), ['Attitudes', 'Markers', 'Looks', MINE]);
  const recent = pushRecent(pushRecent([], 'tokenshade|Glow'), 'tokenshade-custom|My aura');
  assert.deepEqual(recent, ['tokenshade-custom|My aura', 'tokenshade|Glow']);
  assert.equal(hudSections(looks, recent)[0], RECENT);
  assert.deepEqual(hudFilter(looks, { section: RECENT, recent }).map((l) => l.name), ['My aura', 'Glow']);
  assert.deepEqual(hudFilter(looks, { section: 'Looks', query: 'ang' }).map((l) => l.name), ['Attitude: Angry']);
  assert.equal(pushRecent(Array.from({ length: 9 }, (_, i) => `k${i}`), 'new').length, 8);
});

test('the picker shows the looks on the token with a remove, and each look applies by its key', () => {
  const html = hudPaletteHTML({ looks, applied: [{ id: 'x1', name: 'Glow' }], section: 'Attitudes' });
  assert.match(html, /data-ts-remove="x1"[^>]*>Glow/);
  assert.match(html, new RegExp(`data-ts-apply="${lookKey(looks[1]).replace('|', '\\|')}"[^>]*>Angry<`));
  assert.match(html, /Search 4 looks/);
});

test('main adds it to the Token HUD for the GM or the token\'s owner, applying through the token\'s flags', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /Hooks\.on\("renderTokenHUD", \(hud, html\) => \{/);
  assert.match(main, /if \(!doc \|\| !root \|\| !\(game\.user\.isGM \|\| doc\.isOwner\)\) return;/);
  assert.match(main, /apply: async \(look\) => \{ try \{ await doc\.setFlag\(ID, APPLIED_FLAG, withApplied\(/);
  const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');
  assert.match(css, /#token-hud \.an-tshud-palette\{/);
});

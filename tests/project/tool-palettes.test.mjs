import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The Animater controls carried sixteen buttons. Six of them were single actions a GM reaches for now and then —
// the blood on the floor, and tidying a scene up after a fight — so they are two buttons and a question instead.
// Each action keeps its own "show this button" setting, which now says whether it is offered inside the palette.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const group = main.slice(main.indexOf('controls.animater = {'), main.indexOf('// The read happens on the click'));
const palettes = main.slice(main.indexOf('const PALETTES = Object.freeze({'), main.indexOf('const paletteShown ='));

test('the six single buttons are gone from the bar, and their two stand in their place', () => {
  for (const gone of ['animaterClearBlood', 'animaterSplatBlood', 'animaterBakeBlood', 'animaterClearRubble', 'animaterRepairProps', 'animaterClearGroundMarks'])
    assert.ok(!group.includes(`name: "${gone}"`), `${gone} is in a palette now`);
  assert.match(group, /add\(\{ name: PALETTES\.tidy\.name/);
  assert.match(group, /add\(\{ name: PALETTES\.blood\.name/);
  // What is left is still a button each: these are aimed or toggled, not picked from a list.
  for (const kept of ['animaterDecorate', 'animaterCaveIn', 'animaterEnergyBlast', 'animaterBreachWall', 'animaterMoments', 'animaterAnimals', 'animaterWeather', 'animaterClouds'])
    assert.ok(group.includes(`name: "${kept}"`), kept);
});

test('each action keeps its own switch, and an empty palette is not offered', () => {
  for (const key of ['toolSplatBlood', 'toolClearBlood', 'toolBakeBlood', 'toolClearRubble', 'toolClearGroundMarks', 'toolRepairProps'])
    assert.ok(palettes.includes(`key: "${key}"`), key);
  assert.match(main, /const paletteShown = \(palette\) => palette\.actions\.some\(\(action\) => toolShown\(action\.key\)\)/);
  const open = main.slice(main.indexOf('const openPalette ='), main.indexOf('Hooks.on("getSceneControlButtons", (controls) => {\r\n  try {\r\n    if (!game.user?.isGM) return;\r\n    if (!controls'));
  assert.match(open, /const offered = palette\.actions\.filter\(\(action\) => toolShown\(action\.key\)\)/, 'a hidden action is not offered inside either');
  assert.match(open, /if \(!offered\.length\) return;/);
  assert.match(open, /rejectClose: false/, 'closing the question does nothing at all');
  assert.match(open, /if \(paletteOpen\) return;/, 'and one question at a time');
});

test('the settings say where the buttons went', () => {
  for (const [key, where] of [['toolSplatBlood', 'Blood'], ['toolClearBlood', 'Blood'], ['toolBakeBlood', 'Blood'], ['toolClearRubble', 'Tidy up'], ['toolClearGroundMarks', 'Tidy up'], ['toolRepairProps', 'Tidy up']]) {
    const at = main.indexOf(`['${key}',`);
    assert.ok(at > 0, key);
    assert.ok(main.slice(at, at + 400).includes(`under ${where}`), `${key} says it is under ${where}`);
  }
});

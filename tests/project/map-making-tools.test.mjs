import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_TABS, WINDOW_SETTING_KEYS } from '../../scripts/ui/settings-window.mjs';

// The map painting brush is for building a map, not for playing on one, and it is most of what a GM means by "the
// setup is a nightmare". A world that has never built a map with it does not get its button; a world that has keeps
// everything it had. Nothing painted is touched either way — only the button. The experimental floor regions button
// is not under this switch: see its own test below.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('the map painting brush is the only tool the switch hides', () => {
  const group = main.slice(main.indexOf('controls.animater = {'), main.indexOf('// The read happens on the click'));
  assert.ok([...group.matchAll(/add\(\{ name: (?:"animater[A-Za-z]+"|PALETTES\.[a-z]+\.name)/g)].length > 10, 'the controls group still carries its tools');
  const painting = group.slice(group.indexOf('name: "animaterDecorate"'), group.indexOf('name: "animaterCaveIn"'));
  assert.match(painting, /visible: toolShown\("toolDecorate"\) && mapMakingOn\(\)/);
  // The floor regions button is not one of them any more: its own experimental switch is off by default, so ticking
  // it is an ask for that button by name, and this switch — which the module turns off by itself — must not veto it.
  const regions = group.slice(group.indexOf('name: "animaterFloorRegions"'), group.indexOf('name: "animaterClouds"'));
  assert.match(regions, /visible: toolShown\("toolDetectWater"\) && game\.settings\.get\(ID, "experimentalWaterRegions"\) === true/);
  assert.ok(!regions.includes('mapMakingOn()'), 'the experimental tick is the ask, not the map making switch');
  // Playing tools are not map making: a GM who turns the switch off still has their table buttons.
  for (const tool of ['animaterCaveIn', 'animaterEnergyBlast', 'animaterMoments', 'animaterWeather', 'animaterAnimals', 'animaterClouds']) {
    const at = group.indexOf(`name: "${tool}"`);
    assert.ok(at > 0, tool);
    assert.ok(!group.slice(at, at + 400).includes('mapMakingOn()'), `${tool} is played with, not built with`);
  }
});

test('a world that has built a map keeps the tools; the rest are told once where they went', () => {
  const seen = main.slice(main.indexOf('const mapMakingSeen ='), main.indexOf('Hooks.once("ready", async () => {\r\n  if (!game.user?.isGM'));
  // Painted by the brush (decor) or made by the floor regions window (floor): either counts as having built a map.
  assert.match(seen, /own\?\.decor \|\| own\?\.floor/);
  const decide = main.slice(main.indexOf('if (game.settings.get(ID, "mapMakingAsked") === true) return;'), main.indexOf('} catch (error) { console.warn("Animater | map making tools"'));
  assert.match(decide, /await game\.settings\.set\(ID, "mapMakingAsked", true\);/, 'decided once, then never again');
  assert.match(decide, /if \(built\) return;/, 'a world that has built a map is left alone');
  assert.match(decide, /if \(scenes\) ui\.notifications\?\.info/, 'a world with scenes hears about it; a new one has nothing to miss');
  assert.match(main, /registerSetting\("mapMaking", \{ name: "Map making tools"/);
  assert.match(main, /registerSetting\("mapMakingAsked", \{[^}]*scope: "world", config: false/);
});

test('the switch is in the window, so it is not lost in Configure Settings', () => {
  assert.ok(WINDOW_SETTING_KEYS.includes('mapMaking'));
  const tab = SETTINGS_TABS.find((t) => t.rows.some((r) => r.world === 'mapMaking'));
  assert.equal(tab.id, 'interface', 'beside the other switches for what shows in the controls');
  assert.ok(!WINDOW_SETTING_KEYS.includes('mapMakingAsked'), 'the decision is not a setting anyone sets');
});

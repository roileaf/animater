import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_TABS } from '../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

// Read in a running Foundry 14.370 with PF2e: a hidden token has no light source (`_isLightSource` opens
// `if (hidden) return false`), no vision unless pf2e.metagame_partyVision is on (it is off by default), and is shown
// to nobody but the GM (`isVisible` has no owner exemption). The carrier system promised all three in its own
// tooltips while taking them away. Nothing may promise them again.
test('nothing tells the GM that a hidden passenger keeps its light or its vision', () => {
  assert.ok(!/ride hidden and still see out/.test(main), 'the HUD tooltips said exactly this');
  assert.ok(!/their torches still light the road/.test(main));
  assert.match(main, /they ride in plain sight, keeping their light and their vision/);
  // And the GM who asks for hiding is told what it costs, next to the tick that does it.
  assert.match(main, /Animater: stow passengers out of sight/);
  assert.match(main, /puts out a hidden token's light/);
});

// Roi runs two GM clients. Every carrier write used to run on both of them: two plans for the same passengers, each
// built from its own idea of the list, and two of every notification. The rest of the module has guarded this all
// along with the active GM; the carriers were the one part that did not.
test('only one GM client moves, loads, unloads or seats anybody', () => {
  const block = main.slice(main.indexOf('const aboardOf ='), main.indexOf('const carryFromControls'));
  assert.ok(!/options\?\.animater\?\.carrying \|\| !game\.user\.isGM/.test(block), 'a plain isGM gate is both of them at once');
  assert.ok((block.match(/!leadGM\(\)/g) ?? []).length >= 3, 'the ride, the delete and the drop each wait for the lead GM');
});

// Roi: "dont board the carrier by walking on it lol". Crossing a deck, or being dropped on one, is not a request to
// ride: getting aboard is asked for, through the HUD button or the scene tool.
test('walking onto a carrier boards nobody', () => {
  assert.ok(!/climbAboard/.test(main), 'the hook that put a token aboard where it landed is gone');
  assert.ok(!/carrierAt\(/.test(main), 'and nothing asks which carrier a token is standing on');
  const hook = main.slice(main.lastIndexOf('Hooks.on("updateToken", (doc, change, options)'));
  const body = hook.slice(0, hook.indexOf('\n});'));
  assert.match(body, /if \(!carrier\) return;/, 'a token that is not already aboard one is left alone');
  assert.match(body, /pulledOff\(mid, carrier, grid\) \? dropOff\(carrier, doc\) : reseat\(carrier, doc, to\)/);
  assert.match(main, /Walking onto a carrier boards nobody/, 'and the setting says so');
});

test('a passenger remembers its carrier, so one whose carrier is gone can be found again', () => {
  assert.match(main, /const orphanRiders = async/);
  assert.match(main, /flags\.\$\{ID\}\.\$\{CARRIER_RIDING\}/);
  assert.match(main, /Hooks\.on\("canvasReady", \(\) => \{ try \{ void orphanRiders/);
});

// "I jump off the wagon" is the player's line, not a thing they ask the GM to click.
test('a player can get their own token out, through the active GM', () => {
  assert.match(main, /CARRIER_OFF_MESSAGE/);
  assert.match(main, /async function receiveCarrierOff\(data, senderId\)/);
  assert.match(main, /receiveCarrierOff\(data, senderId\)/);
  // The sender is the id Foundry's server attaches, and they must own the token they are getting out of.
  assert.match(main, /if \(!user \|\| user\.isGM \|\| !doc \|\| doc\.documentName !== "Token"/);
  assert.match(main, /doc\.testUserPermission\(user, "OWNER"\)/);
});

test('a fight that starts with people stowed out of sight says so', () => {
  assert.match(main, /Hooks\.on\("combatStart"/);
  assert.match(main, /nothing can see or target them/);
});

test('the whole thing has an off switch, and the window owns it', () => {
  assert.match(main, /registerSetting\("carriers", \{ name: "Carriers"/);
  const rows = SETTINGS_TABS.flatMap((t) => t.rows);
  assert.ok(rows.some((r) => r.world === 'carriers'), 'listed in the module window, not in Configure Settings');
  assert.match(main, /const carriersOn = \(\)/);
});

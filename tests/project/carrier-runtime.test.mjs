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

// Roi: "horse(mount) sfx doesnt match galloping horse". The hooves are held under the mount like a wagon's rims, and
// the footstep that used to clop over them goes quiet while they play.
test('a ridden horse sounds like the pace it is going, and only once', () => {
  assert.match(main, /const pace = mountPace\(state\.run \?\? 0\)/, 'the pace comes off the journey so far');
  assert.match(main, /const hooves = hoofFile\(kind, pace, doc\.id\);/);
  assert.match(main, /const hoof = hoofShape\(\{ speed: state\.speed \?\? 0, pace, seed: doc\.id, kind \}\);/);
  // Its own held voice beside the rims, so a wagon is heard as both at once (Roi: "wagon should combine wagon and
  // horse sfx"), and it is let go with the carrier like the other two.
  assert.match(main, /holdCarrierVoice\(carrierHoofVoices, doc\.id, hooves,/);
  assert.match(main, /holdCarrierVoice\(carrierVoices, doc\.id, roll,/, 'the rims keep their own');
  assert.match(main, /for \(const \[id, voice\] of carrierHoofVoices\) if \(!live\.has\(id\)\) \{ stopVoice\(voice, 300\); carrierHoofVoices\.delete\(id\); \}/);
  // The journey is measured as it is drawn, and forgotten once the horse has properly stopped.
  assert.match(main, /if \(rolling\) state\.run = \(state\.run \?\? 0\) \+ went \/ grid;/);
  assert.match(main, /else if \(state\.speed < 0\.15\) state\.run = 0;/);
  // A held voice can be asked for a different recording: the walk goes out as the gallop comes in.
  const hold = main.slice(main.indexOf('const holdCarrierVoice ='), main.indexOf('const carrierEars ='));
  assert.match(hold, /if \(voice\.sound && file && voice\.file !== file\)/, 'the pace change swaps the recording');
  assert.match(hold, /stopVoice\(voice, 250\)/);
  // And the size-paced footstep is silenced under it, rather than skipped: its tread still shakes the ground.
  assert.match(main, /token\.carrier === "mount" && carriersOn\(\) && bothSettingsOn\("carrierSounds"\)\) level = 0;/);
  assert.match(main, /carrier: kindOf\(d\) \?\? null,/, 'the view says which carrier a token is');
});

// Roi: "make the number of passengers limit as a setting on the token (disabled default)".
test('how many ride is a number on the token, off until the GM sets it, and kept once they do', () => {
  // On the token's own sheet, beside the kind, starting at 0 — which is off.
  assert.match(main, /<label>Animater: passenger limit<\/label>/);
  assert.match(main, /<input type="number" min="0" step="1" name="flags\.\$\{ID\}\.\$\{CARRIER_SEATS\}" value="\$\{seats \|\| 0\}">/);
  assert.match(main, /0 is off, which is how it starts/, 'and the sheet says so');
  // Loading fills the seats and leaves the rest standing, rather than telling the GM off afterwards.
  const load = main.slice(main.indexOf('const loadCarrier = async (doc)'), main.indexOf('// `where` lets a carrier'));
  assert.match(load, /const riding = Number\.isFinite\(room\) \? list\.slice\(0, aboard\.length \+ room\) : list;/);
  assert.match(load, /seatsLeft\(doc\.flags\?\.\[ID\]\?\.\[CARRIER_SEATS\], aboard\.length\)/);
  assert.match(load, /is full — it is set to carry \$\{seats\}/, 'a full carrier says so instead of silently taking nobody');
  assert.match(load, /\$\{behind\} stayed behind/, 'and anyone left standing is named');
  assert.match(load, /await doc\.setFlag\(ID, ABOARD, riding\);/, 'only those who got on are aboard');
  assert.ok(!/ridePlan\(list,/.test(load), 'nobody rides who was left behind');
  // With no limit set, the kind's own figure is still only a remark, which is what it always was.
  assert.match(load, /const kind = kindOf\(doc\) \|\| "party", over = seats \? 0 : overCapacity\(kind, riding\.length\);/);
});

// A boat is a hull, not an incorporeal thing: it leaves a wake on the water and nothing on land.
test('a boat leaves a wake behind it', () => {
  assert.match(main, /const CARRIER_GAITS = \{ wagon: "wheels", cart: "barrow", sled: "runners", mount: "hooves", boat: "hull" \};/);
  const feel = readFileSync(new URL('../../scripts/engines/motion/movement-feel.mjs', import.meta.url), 'utf8');
  assert.match(feel, /if \(token\.gait === 'hull'\) \{/, 'the stride lays a wake instead of marking the floor');
  // Roi: "why boat use this and not the ripple like ducks do? it should use the ripple engine on water we have".
  // It does: the hull drives the water's own rings, and the drawn wake is only the fallback where that is not running.
  assert.match(feel, /if \(token\.visible && floor === 'water' && !swimRipples\?\.\(token\)\) lay\(swimWake\(at, opts\), time, floor, 'swim'\);/);
  assert.match(feel, /the way a duck paddling does/);
  assert.match(feel, /const SILENT_GAITS = new Set\(\['none', 'wheels', 'barrow', 'runners', 'hull'\]\);/, 'and it has no footfall');
});

// Roi, of the sled's pack on the table: "i think the wolves scale is weird, they are also low quality (blurry) also
// shouldnt there be a rope holding them to the sled?"
test('the pack is drawn at its own length, on a rope', () => {
  // Sized by what the set says the animal is, not by a draught horse's ten feet.
  assert.match(main, /\(\(animal\.feet \/ feet\) \* grid\) \/ along/);
  assert.ok(!/\(\(10 \/ feet\) \* grid\) \/ along/.test(main.slice(main.indexOf('const paintCarrierTeam'), main.indexOf('const tickCarrierLooks'))),
    'nothing in the team is still drawn at a horse\'s length');
  // The traces: one line from the sled's nose to each animal, its own child so it can be let go with the rest.
  assert.match(main, /const paintCarrierRope = \(rig, step, grid, art, ahead, beside, team\)/);
  assert.match(main, /const roped = team\.filter\(\(a\) => a\.rope\);/);
  assert.match(main, /rope\.quadraticCurveTo\(mid\.x, mid\.y, end\.x, end\.y\);/, 'and it sags rather than ruling a line');
  // Roi: "it doesnt touch the sled lol", then "traces to corners". Each one is made fast to the deck's own corner,
  // the side the animal runs on, and the painted bridle that used to stand in for them is gone from the art.
  assert.match(main, /const hitch = CARRIER_SETS\[step\.set\]\?\.hitch/);
  assert.match(main, /const corner = place\(hitch\.ahead, Math\.sign\(animal\.across \?\? 0\) \* hitch\.across\);/);
  assert.match(main, /rope\.moveTo\(corner\.x, corner\.y\);/);
  const paint = readFileSync(new URL('../../scripts/engines/motion/carrier-paint.mjs', import.meta.url), 'utf8');
  const sled = paint.slice(paint.indexOf('  sled(g, s, rng, o) {'), paint.indexOf('};', paint.indexOf('  sled(g, s, rng, o) {')));
  assert.ok(!/const rope =/.test(sled), 'the sled no longer paints a bridle of its own for the traces to double');
  assert.match(main, /dropCarrierRig\(token\?\.id \?\? token\?\.document\?\.id\);/, 'the rope goes with the picture, and the picture with its holder');
});

// Roi, of a sled standing in a pitch-dark cave as bright as at noon: "why carriers arent affected by
// light\\darkness\\sun\\moon?" The rig hung on the token, and Foundry draws the token layer in its interface group,
// over the lighting. It stands on the map now, under the creatures, where the lighting reaches it.
test('the rig stands on the map, where the light falls on it', () => {
  assert.match(main, /const carrierRootOf = floorLayer\("carriers"\);/);
  assert.match(main, /rig\.position\.set\(Number\(token\.position\?\.x \?\? token\.x\) \|\| 0, Number\(token\.position\?\.y \?\? token\.y\) \|\| 0\);/,
    'the holder stands where the token is drawn, so everything in it keeps the token\'s own coordinates');
  assert.ok(!/token\.addChildAt\(/.test(main), 'nothing of the rig hangs on the token any more');
  // Under the creatures (tokens sort at 700 in Foundry's primary group), over the decorations.
  const sorts = readFileSync(new URL('../../scripts/engines/motion/floor-slot.mjs', import.meta.url), 'utf8');
  assert.match(sorts, /carriers: 690,/);
  // It goes when its token goes, and when the scene does.
  assert.match(main, /Hooks\.on\("destroyToken", \(token\) => \{ lookStates\.delete\(token\?\.document\?\.id\); dropCarrierRig\(/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ dropAllCarrierRigs\(\); \}\);/);
  // What works from the worn picture (its shadow, its reflection) looks in the holder, not among the token's children.
  assert.match(main, /const wornLook = \(t\) => \{ const worn = carrierRigOf\(t, false\)\?\.children/);
  assert.match(main, /const pull = carrierRigOf\(t, false\)\?\.children\?\.find\(\(c\) => c\?\.\[CARRY_TEAM\]\);/);
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

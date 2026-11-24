import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { burstCall, burstAfter, burstOver, BURST_WEATHERS, BURST_LONGEST_MS, BURST_SHORTEST_MS } from '../../../scripts/engines/motion/weather-burst.mjs';
import { weatherScene, FALL_KINDS } from '../../../scripts/engines/motion/sky-weather.mjs';

test('a burst is asked for by weather, strength and time; all three are kept in bounds', () => {
  assert.deepEqual(burstCall({ weather: 'snow', strength: 0.4, ms: 30000 }), { weather: 'snow', strength: 0.4, ms: 30000 });
  assert.deepEqual(burstCall({ weather: 'Snow' }), { weather: 'snow', strength: 0.5, ms: 30000 }, 'half strength for half a minute when not said');
  assert.equal(burstCall({ weather: 'snow', ms: 9e9 }).ms, BURST_LONGEST_MS, 'no longer than a minute');
  assert.equal(burstCall({ weather: 'snow', ms: 1 }).ms, BURST_SHORTEST_MS);
  assert.equal(burstCall({ weather: 'snow', strength: 7 }).strength, 1);
  assert.equal(burstCall({ weather: 'snow', strength: 0 }), null, 'nothing of it is nothing');
  assert.equal(burstCall({ weather: 'no-such-weather' }), null);
  assert.equal(burstCall({}), null);
  assert.equal(burstCall(), null);
  // Only what has something to fall, or a fog: a clear sky or a heat wave is no burst.
  assert.equal(burstCall({ weather: 'clear' }), null);
  assert.equal(burstCall({ weather: 'heat-wave' }), null);
  for (const id of ['snow', 'rain', 'hail', 'ashfall', 'fog', 'thunderstorm', 'sakura-bloom']) assert.ok(BURST_WEATHERS.includes(id), id);
});

test('the same weather asked for again carries on for longer, never twice as hard; another takes its place', () => {
  const first = burstAfter(null, burstCall({ weather: 'snow', strength: 0.4, ms: 30000 }), 1000);
  assert.deepEqual(first, { weather: 'snow', strength: 0.4, until: 31000 });
  const again = burstAfter(first, burstCall({ weather: 'snow', strength: 0.3, ms: 30000 }), 11000);
  assert.deepEqual(again, { weather: 'snow', strength: 0.4, until: 41000 }, 'longer, and no weaker');
  const short = burstAfter(again, burstCall({ weather: 'snow', strength: 0.9, ms: 2000 }), 12000);
  assert.deepEqual(short, { weather: 'snow', strength: 0.9, until: 41000 }, 'a short one does not cut it off');
  assert.deepEqual(burstAfter(again, burstCall({ weather: 'rain', ms: 5000 }), 12000), { weather: 'rain', strength: 0.5, until: 17000 });
  // One already over is not carried on from.
  assert.deepEqual(burstAfter(first, burstCall({ weather: 'snow', strength: 0.2, ms: 5000 }), 99000), { weather: 'snow', strength: 0.2, until: 104000 });
  assert.equal(burstAfter(first, null, 2000), first);
});

test('it is laid over the weather the map already draws, which is left as it was', () => {
  const snow = { weather: 'snow', strength: 0.4 }, own = weatherScene({ id: 'snow' }).falls[0];
  // On a clear day, or with no weather drawn at all: its own fall, as much of it as asked.
  for (const scene of [null, weatherScene({ id: 'clear' })]) {
    const out = burstOver(scene, snow);
    assert.equal(out.falls.length, 1);
    assert.equal(out.falls[0].kind, FALL_KINDS.snow);
    assert.ok(Math.abs(out.falls[0].amount - own.amount * 0.4) < 1e-9);
  }
  // In the rain: the rain goes on, and the snow falls with it.
  const rain = weatherScene({ id: 'rain' }), wet = burstOver(rain, snow);
  assert.deepEqual(wet.falls.map((f) => f.kind), [FALL_KINDS.rain, FALL_KINDS.snow]);
  assert.equal(wet.falls[0].amount, rain.falls[0].amount);
  assert.equal(rain.falls.length, 1, 'the scene\'s own weather is not touched');
  // Where two things already fall, the scene's first stays and the burst takes the second's place.
  const sleet = burstOver(weatherScene({ id: 'hail' }), snow);
  assert.deepEqual(sleet.falls.map((f) => f.kind), [FALL_KINDS.hail, FALL_KINDS.snow]);
  // Already snowing: no less than it was, and never the two added together.
  const blizzard = weatherScene({ id: 'blizzard' }), more = burstOver(blizzard, { weather: 'snow', strength: 1 });
  assert.equal(more.falls[0].amount, Math.max(blizzard.falls[0].amount, own.amount));
  assert.equal(burstOver(blizzard, snow).falls[0].amount, blizzard.falls[0].amount);
  // Its storm, its light and its clouds are the scene's still.
  assert.equal(burstOver(rain, { weather: 'thunderstorm', strength: 1 }).storm, rain.storm);
  // A fog thickens the scene's, never thins it.
  const fog = burstOver(null, { weather: 'fog', strength: 0.5 });
  assert.ok(Math.abs(fog.fog[3] - weatherScene({ id: 'fog' }).fog[3] * 0.5) < 1e-9);
  const thick = weatherScene({ id: 'rolling-fog' });
  assert.deepEqual(burstOver(thick, { weather: 'fog', strength: 0.2 }).fog, thick.fog);
  assert.equal(burstOver(rain, null), rain);
});

test('one call shows it to everyone on the scene, each by their own settings; nothing is stored', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /weatherBurst: \(asked = \{\}\) => weatherBurstHere\(asked\),/);
  const here = main.slice(main.indexOf('const WEATHER_BURST_MESSAGE = '), main.indexOf('const lookSky = () => {'));
  assert.ok(here.length > 0);
  assert.doesNotMatch(here, /setFlag|\.update\(|settings\.set/, 'nothing stored');
  // Told to the other clients, with the scene it is for; `here: true` keeps it to this screen.
  assert.match(here, /if \(asked\?\.here !== true\) \{ try \{ game\.socket\.emit\(`module\.\$\{ID\}`, \{ type: WEATHER_BURST_MESSAGE, sender: clientId, sceneId: canvas\.scene\?\.id \?\? null, call \}\);/);
  assert.match(main, /if \(data\?\.type === WEATHER_BURST_MESSAGE\) \{ if \(data\.sender !== clientId\) weatherBurstHeard\(data, senderId\); return; \}/);
  // What is heard is for this scene, from someone who may bring one, and cleaned again here: nothing longer or
  // stronger than a burst can be sent. Shown, it is told to nobody again.
  const heard = here.slice(here.indexOf('const weatherBurstHeard = '), here.indexOf('const weatherBurstShow = '));
  assert.match(heard, /data\.sceneId !== canvas\.scene\?\.id\) return;/);
  assert.match(heard, /if \(!burstAllowedFrom\(game\.users\.get\(senderId\)\)\) return;/);
  assert.match(heard, /const call = burstCall\(data\.call\);/);
  assert.doesNotMatch(heard, /emit/);
  // A player's client may ask, unless the GM has turned that off; a GM's always may.
  assert.match(here, /const burstAllowedFrom = \(user\) => \{ if \(user\?\.isGM\) return true; try \{ return game\.settings\.get\(ID, "weatherBurstPlayers"\) !== false; \}/);
  assert.match(here, /if \(!call \|\| !canvas\?\.ready \|\| !burstAllowedFrom\(game\.user\)\) return null;/);
  assert.match(main, /registerSetting\("weatherBurstPlayers", \{[\s\S]{0,700}scope: "world", config: true, type: Boolean, default: true,/);
  // Not where the viewer has the map's weather off, nor at a quality that leaves it out, nor underground: told all the
  // same, since the others may show it.
  assert.match(here, /const weatherBurstShow = \(call\) => \{\r?\n  if \(!weatherMapOn\(\)\) return null;/);
  assert.ok(here.indexOf('game.socket.emit') < here.indexOf('return weatherBurstShow(call);'));
  // Drawn over the scene's own, and eased in and out.
  assert.match(main, /if \(weatherBurstNow && !weatherPreview\) drawn = burstOver\(drawn, weatherBurstNow\);/);
  assert.match(main, /performance\.now\(\) < weatherBurstFadeUntil \? BURST_FADE_S/);
  // Gone with the scene.
  assert.match(main, /for \(const hook of \["canvasReady", "canvasTearDown"\]\) Hooks\.on\(hook, \(\) => \{ weatherBurstEnd\(false\); \}\);/);
});

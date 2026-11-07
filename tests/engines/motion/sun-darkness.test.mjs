import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sunElevation, darknessBySun, moonLift, MOON_LIFT, TWILIGHT_PACE, NIGHT_DEPTH } from '../../../scripts/engines/motion/sun.mjs';

// 19 Sarenith in the test world: sunrise 04:17, sunset 19:43.
const clock = (h) => ({ day: h / 24, sunrise: 4.288 / 24, sunset: 19.712 / 24, hours: 24 });
const dark = (h) => darknessBySun(sunElevation(clock(h)));

test('the sun climbs by day and sinks at twilight\'s pace by night, never deeper than its floor', () => {
  assert.ok(sunElevation(clock(12)) > 55, 'high at noon');
  assert.ok(Math.abs(sunElevation(clock(19.712)) ) < 0.5, 'on the horizon at sunset');
  assert.ok(Math.abs(sunElevation(clock(20.712)) + TWILIGHT_PACE) < 0.01, 'an hour after sunset, one hour\'s pace under');
  assert.equal(sunElevation({ day: 0, sunrise: 0.33, sunset: 0.66, hours: 24 }), -NIGHT_DEPTH, 'a long night bottoms out');
});

test('darkness follows twilight: a little at sunset, half at civil dusk, full by an hour and a half, light again at dawn', () => {
  assert.equal(dark(13), 0, 'day');
  assert.ok(dark(19.712) > 0.05 && dark(19.712) < 0.2, 'a little dark as the sun sets');
  assert.ok(dark(20.2) > 0.35 && dark(20.4) < 0.75, 'about half by the end of civil dusk');
  assert.ok(dark(21.1) > 0.97, 'fully dark about an hour and a half after sunset');
  assert.equal(dark(0), 1, 'midnight');
  assert.ok(dark(3) > 0.97 && dark(4.288) < 0.2 && dark(5) < 0.01, 'dark till dawn\'s glow, light soon after sunrise');
  for (let h = 19.7; h < 21.2; h += 0.1) assert.ok(dark(h + 0.1) >= dark(h) - 1e-9, 'never lightens through dusk');
});

test('a bright moon high in a clear sky keeps the night from full dark; none by day, at new moon or overcast', () => {
  const night = { ...clock(0), moon: 1, sky: 1 };
  const full = moonLift(night);
  assert.ok(full > MOON_LIFT * 0.9 && full <= MOON_LIFT, 'full moon near its height at midnight');
  assert.ok(Math.abs(darknessBySun(sunElevation(night), full) - (1 - full)) < 1e-9);
  assert.equal(moonLift({ ...clock(12), moon: 1 }), 0, 'by day');
  assert.equal(moonLift({ ...night, moon: 0 }), 0, 'new moon');
  assert.equal(moonLift({ ...night, sky: 0 }), 0, 'overcast');
  assert.ok(moonLift({ ...clock(20), moon: 1, sky: 1 }) < full / 2, 'low just after sunset');
  assert.equal(darknessBySun(sunElevation(clock(13)), full), 0, 'the moon never darkens the day');
});

test('main wires it: off by default, the lead GM alone writes the active scene, Calendaria\'s own turned off', () => {
  const main = fs.readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("darknessBySun", \{[^}]*default: false/);
  assert.match(main, /leadGM\(\) \|\| !sunDarknessOn\(\)/);
  assert.match(main, /game\.settings\.set\("calendaria", "darknessSync", false\)/);
  assert.match(main, /darknessLock === true/);
  assert.match(main, /undergroundOf\(scene\.flags/);
  assert.match(main, /Hooks\.once\("calendaria\.ready"/, 'waits for Calendaria\'s own clock');
  assert.match(main, /!clockSettled\(\) \|\| scene\.environment/, 'never writes on the other calendar\'s hours');
});

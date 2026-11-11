import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sunElevation, darknessBySun, moonLift, MOON_LIFT, solarGeometry } from '../../../scripts/engines/motion/sun.mjs';

// 19 Sarenith in the test world: sunrise 04:17, sunset 19:43 (15.4 hours of day: midsummer at about 45°).
const clock = (h) => ({ day: h / 24, sunrise: 4.288 / 24, sunset: 19.712 / 24, hours: 24 });
const dark = (h) => darknessBySun(sunElevation(clock(h)));
// When the sun first sinks to `depth` degrees under after sunset, in minutes after it (a minute at a time).
const minutesTo = (depth, c = clock) => { const set = c(0).sunset * 1440; for (let m = 0; m < 600; m++) if (sunElevation({ ...c(0), day: (set + m) / 1440 }) <= -depth) return m; return null; };

// Roi: "it needs to be realistic, research". The sun now moves as it does in the sky (spherical astronomy): the calendar's
// sunrise and sunset fix the day's length, a mid-latitude world (45°) its season, so a long summer dusk lingers and a long
// summer night barely gets fully dark, as at real midsummer (timeanddate.com; Space.com, "Summer's twilight zones").
test('the sun moves as in the sky: highest at noon, on the horizon at sunrise and sunset, lowest at midnight', () => {
  const g = solarGeometry(clock(0));
  assert.ok(Math.abs(g.latitude - 45) < 1e-9 && g.declination > 21.5 && g.declination <= 23.44, 'about midsummer at 45°');
  assert.ok(Math.abs(sunElevation(clock(12)) - (90 - 45 + g.declination)) < 0.01, 'noon at 90 − latitude + declination');
  // (A calendar's sunset is the sun's top edge going, lifted by refraction: its centre 0.833° under.)
  assert.ok(Math.abs(sunElevation(clock(19.712)) + 0.833) < 0.05 && Math.abs(sunElevation(clock(4.288)) + 0.833) < 0.05, 'sunset and sunrise as calendars give them');
  assert.ok(Math.abs(sunElevation(clock(0)) + (90 - 45 - g.declination)) < 0.01 && sunElevation(clock(0)) < -18, 'midnight past 18° under: fully dark only around it');
  // Montreal (45.5°N) on 21 June: civil dusk 39 min, nautical ends 87 and astronomical 153 min after sunset.
  // A day longer than 45° ever gets: a higher latitude at midsummer, whose night never gets past nautical twilight.
  const north = { day: 0, sunrise: 3 / 24, sunset: 21 / 24 };
  assert.ok(solarGeometry(north).latitude > 55 && sunElevation(north) > -12, 'white night');
});

test('twilight lasts as long as it really does: longer on a summer evening than at the equinox', () => {
  const civil = minutesTo(6), nautical = minutesTo(12), astro = minutesTo(18);
  assert.ok(civil >= 32 && civil <= 42, `civil dusk ${civil} min`);
  assert.ok(nautical >= 70 && nautical <= 95, `nautical dusk ends ${nautical} min after sunset`);
  assert.ok(astro >= 115 && astro <= 160, `astronomical dusk ends ${astro} min after sunset`);
  const equinox = (h) => ({ day: h / 24, sunrise: 6 / 24, sunset: 18 / 24, hours: 24 });
  const civilEq = minutesTo(6, equinox);
  assert.ok(civilEq >= 26 && civilEq < civil, `equinox civil dusk ${civilEq} min, shorter`);
});

test('darkness follows the light outdoors, as the eye sees it: a little at sunset, about half at civil dusk, full at astronomical dusk', () => {
  // About 400 lux at sunset, 3 at the end of civil twilight, 0.03 at the end of nautical, starlight past astronomical.
  assert.equal(darknessBySun(10), 0, 'day');
  assert.ok(darknessBySun(0) > 0.07 && darknessBySun(0) < 0.16, 'sunset');
  assert.ok(darknessBySun(-6) > 0.4 && darknessBySun(-6) < 0.52, 'end of civil twilight');
  assert.ok(darknessBySun(-12) > 0.7 && darknessBySun(-12) < 0.82, 'end of nautical twilight');
  assert.equal(darknessBySun(-18), 1, 'end of astronomical twilight');
  for (let e = 6; e > -20; e -= 0.5) assert.ok(darknessBySun(e - 0.5) >= darknessBySun(e) - 1e-9, 'darker as it sinks');
  assert.equal(dark(13), 0, 'day');
  assert.equal(dark(0), 1, 'midnight');
  assert.ok(dark(5) < 0.01, 'light soon after sunrise');
  for (let h = 19.7; h < 22.5; h += 0.1) assert.ok(dark(h + 0.1) >= dark(h) - 1e-9, 'never lightens through dusk');
});

test('only a full moon high in a clear sky keeps the night from full dark; none by day, at other phases or overcast', () => {
  assert.equal(moonLift({ ...clock(0), moon: 0.5, sky: 1 }), 0, 'a half moon leaves it fully dark');
  assert.equal(moonLift({ ...clock(0), moon: 0.9, sky: 1 }), 0, 'gibbous too');
  assert.ok(moonLift({ ...clock(0), moon: 0.98, sky: 1 }) > 0, 'a day from full still counts');
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

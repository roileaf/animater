import test from 'node:test';
import assert from 'node:assert/strict';
import { sunFromClock, sunElevation, solarGeometry, COMPASS } from '../../../scripts/engines/motion/sun.mjs';

// Roi: "it needs to be realistic, research", then yes to the daytime sun too. By day the sun follows the same sky as dusk
// does (sun.mjs solarGeometry): high in summer, low in winter, rising north of east in summer and south of it in winter.
const summer = (h) => ({ day: h / 24, sunrise: 4.288 / 24, sunset: 19.712 / 24 });
const winter = (h) => ({ day: h / 24, sunrise: 7.7 / 24, sunset: 16.3 / 24 });

test('by day the sun stands as high as in the sky: high at a summer noon, low at a winter one', () => {
  const s = sunFromClock(summer(12)), w = sunFromClock(winter(12)), gs = solarGeometry(summer(0)), gw = solarGeometry(winter(0));
  assert.ok(Math.abs(s.height - (90 - gs.latitude + gs.declination)) < 0.01, `summer noon ${s.height.toFixed(1)}°`);
  assert.ok(s.height > 65, 'high in summer');
  assert.ok(Math.abs(w.height - (90 - gw.latitude + gw.declination)) < 0.01 && w.height < 25, `winter noon ${w.height.toFixed(1)}°`);
  // The same sun as dusk's: its height is the sky's altitude, where it is up.
  for (const h of [6, 9, 15, 18]) assert.ok(Math.abs(sunFromClock(summer(h)).height - sunElevation(summer(h))) < 1e-9);
});

test('it rises north of east and sets north of west in summer, south of them in winter, and is due south at noon', () => {
  const near = (c) => ({ ...c, day: c.sunrise + 0.004 }), late = (c) => ({ ...c, day: c.sunset - 0.004 });
  // Screen degrees (north up): east 0, south 90, west 180; north of east is negative.
  assert.ok(sunFromClock(near(summer(0))).angle < COMPASS.e - 20, 'summer: rises in the north-east');
  assert.ok(sunFromClock(late(summer(0))).angle > COMPASS.w + 20, 'and sets in the north-west');
  assert.ok(sunFromClock(near(winter(0))).angle > COMPASS.e + 20, 'winter: rises in the south-east');
  assert.ok(sunFromClock(late(winter(0))).angle < COMPASS.w - 20, 'and sets in the south-west');
  assert.ok(Math.abs(sunFromClock(summer(12)).angle - COMPASS.s) < 1e-6 && Math.abs(sunFromClock(winter(12)).angle - COMPASS.s) < 1e-6, 'due south at noon');
  // The morning and the afternoon mirror each other about noon.
  const am = sunFromClock(summer(9)), pm = sunFromClock(summer(15));
  assert.ok(Math.abs(am.height - pm.height) < 1e-9 && Math.abs((am.angle - COMPASS.s) + (pm.angle - COMPASS.s)) < 1e-9);
});

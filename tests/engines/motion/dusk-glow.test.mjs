import test from 'node:test';
import assert from 'node:assert/strict';
import { sunGlow, sunColorByHeight, sunFromClock } from '../../../scripts/engines/motion/sun.mjs';

// Roi: "theres a bug happening between the dusk and night time... the scene is red for dusk and then white ... between
// 19:42 and 19:52". Sunset was 19:42.8: the open ground took the setting sun's deep red at full strength, and the moment it
// set the afterglow began pale lilac at 0.7, a jump to near white. The afterglow now starts where the sun's colour ends.
const SUNRISE = 4.287 / 24, SUNSET = 19.713 / 24;
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
// The open ground's tint as main.mjs outdoorGlow picks it: the sun's own colour while it is up, else the afterglow.
function tint(minutes) {
  const clock = { day: minutes / 1440, sunrise: SUNRISE, sunset: SUNSET, moon: 0, sky: 1 };
  const sun = sunFromClock(clock), glow = sunGlow(clock);
  const own = sun ? { color: sunColorByHeight(sun.height), amount: (() => { const t = Math.min(1, Math.max(0, (40 - sun.height) / 34)); return t * t * (3 - 2 * t); })() } : null;
  return !own || (glow && glow.amount > own.amount) ? glow : own.amount > 0.005 ? own : glow;
}

test('the afterglow starts at the setting sun\'s red, at its strength: no jump at sunset', () => {
  const before = tint(19 * 60 + 42), after = tint(19 * 60 + 44);
  assert.ok(dist(before.color, after.color) < 0.08, `colour jumps ${dist(before.color, after.color).toFixed(2)}`);
  assert.ok(Math.abs(before.amount - after.amount) < 0.08, `strength jumps ${before.amount} → ${after.amount}`);
});

test('dusk cools smoothly from red through rose to the night\'s blue, a little at a time, and fades out', () => {
  let last = tint(19 * 60 + 30);
  for (let m = 19 * 60 + 32; m <= 21 * 60; m += 2) {
    const now = tint(m);
    if (!now) { assert.ok(!last || last.amount < 0.05, `drops out at ${m} from ${last?.amount}`); last = null; continue; }
    if (last) {
      assert.ok(dist(last.color, now.color) < 0.08, `colour step at ${Math.floor(m / 60)}:${m % 60}`);
      assert.ok(Math.abs(last.amount - now.amount) < 0.08, `strength step at ${Math.floor(m / 60)}:${m % 60}`);
    }
    last = now;
  }
  const late = tint(19 * 60 + 43 + 35);
  assert.ok(late && late.color[2] > late.color[0] - 0.05, 'well after sunset it has turned to the cool side');
});

test('dawn is the same the other way: no jump as the sun rises', () => {
  const rise = Math.round(SUNRISE * 1440);
  const before = tint(rise - 1), after = tint(rise + 1);
  assert.ok(dist(before.color, after.color) < 0.08 && Math.abs(before.amount - after.amount) < 0.08);
});

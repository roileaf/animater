import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sunColorByHeight } from '../../../scripts/engines/motion/sun.mjs';

const warmth = ([r, g, b]) => r - b;

test('sunlight warms gradually as the sun goes down, white high up, orange-red at sunset', () => {
  const noon = sunColorByHeight(70), afternoon = sunColorByHeight(35), golden = sunColorByHeight(18), sunset = sunColorByHeight(3), under = sunColorByHeight(-6);
  assert.ok(noon[2] > 0.9, 'near white at noon');
  assert.ok(warmth(noon) < warmth(afternoon) && warmth(afternoon) < warmth(golden) && warmth(golden) < warmth(sunset), 'warmer all the way down');
  assert.ok(sunset[1] < 0.5 && sunset[2] < 0.3, 'deep orange-red at sunset');
  assert.ok(under[0] < 0.9, 'a fading crimson as it slips under');
  assert.ok(warmth(sunColorByHeight(30)) > warmth(noon) + 0.15, 'a winter noon, never high, stays yellow');
});

test('the open ground takes the sun\'s colour by its height, a fixed sun too', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /mode !== "none" && !undergroundScene\(\)/);
  assert.match(main, /const glow = on \? outdoorGlow\(sunNow, mode === "time" \? sunGlow\(clockNow\(\)\) : null\) : null/);
  assert.match(main, /color: sunColorByHeight\(h\), amount: t \* t \* \(3 - 2 \* t\) \* sky/);
});

test('a GM can keep Calendaria\'s own ambience: Animater then leaves it alone and steps aside', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("timeOfDayColor", \{ name: "Color the scene as the time of day"/);
  assert.match(main, /hotSetting\("timeOfDayColor"\) === false/);
  assert.equal((main.match(/\|\| calendariaChosen\(\)\) return;/g) ?? []).length, 2, 'neither of Calendaria\'s settings is switched off');
  assert.match(main, /if \(calendariaChosen\(\)\) return on\("colorShiftSync"\);/);
  assert.match(main, /setting\?\.key === "calendaria\.ambienceSync"/, 'turned back on mid-session, caught at once');
});

test('every warm light goes by it, windows too, with no tint of their own on top', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const own = sunColorByHeight\(sun\?\.height \?\? 45\)/);
  assert.match(main, /const rgb = sunColorOf\(sunNow\), strength/);
});

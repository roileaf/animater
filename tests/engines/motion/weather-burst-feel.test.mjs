import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { burstFeel } from '../../../scripts/engines/motion/weather-burst.mjs';
import { weatherLevels } from '../../../scripts/engines/motion/weather-sound.mjs';

test('a burst is felt as its rain, its storm and its name; snow and ash are silent', () => {
  assert.deepEqual(burstFeel(null), { rain: 0, storm: 0, words: '' });
  assert.deepEqual(burstFeel({ weather: 'snow', strength: 1 }), { rain: 0, storm: 0, words: 'snow' });
  assert.equal(burstFeel({ weather: 'ashfall', strength: 1 }).rain, 0);
  const rain = burstFeel({ weather: 'rain', strength: 0.5 });
  assert.ok(Math.abs(rain.rain - 0.35) < 1e-9 && rain.storm === 0);
  const storm = burstFeel({ weather: 'thunderstorm', strength: 1 });
  assert.equal(storm.rain, 1);
  assert.equal(storm.storm, 0.75);
  assert.ok(Math.abs(burstFeel({ weather: 'thunderstorm', strength: 0.4 }).storm - 0.3) < 1e-9, 'a faint one flashes less');
  // Hail's rain with it is counted; the hail itself is known by its name.
  const hail = burstFeel({ weather: 'hail', strength: 1 });
  assert.ok(Math.abs(hail.rain - 0.3) < 1e-9 && hail.words === 'hail');
});

test('so the weather\'s own loops play it: rain for rain, hail for hail, nothing for snow', () => {
  const heard = (burst) => { const f = burstFeel(burst); return weatherLevels({ rain: f.rain, storm: f.storm, words: ` ${f.words}` }); };
  const loud = (levels) => Object.entries(levels).filter(([, v]) => v > 0.004).map(([k]) => k).sort();
  assert.deepEqual(loud(heard({ weather: 'snow', strength: 1 })), []);
  assert.deepEqual(loud(heard({ weather: 'rain', strength: 1 })), ['rainHeavy', 'rainLight']);
  assert.deepEqual(loud(heard({ weather: 'drizzle', strength: 1 })), ['rainLight']);
  assert.deepEqual(loud(heard({ weather: 'hail', strength: 1 })), ['hail', 'rainLight']);
  assert.deepEqual(loud(heard({ weather: 'thunderstorm', strength: 1 })), ['rainHeavy'], 'a storm\'s rain is all heavy');
  assert.deepEqual(loud(heard({ weather: 'blizzard', strength: 1 })), ['blizzard']);
});

test('the map hears it, rings its water and flashes with it; none of its bolts land', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const stormHere = \(\) => Math\.max\(skyStorm, weatherBurstNow && lightningOn\(\) \? burstFelt\(\)\.storm : 0\);/, 'only where this viewer has lightning on');
  assert.match(main, /rain: Math\.max\(skyFalling\.rain, burst\.rain\), wind: skyWindNow, storm: stormHere\(\), words: `\$\{skyWords\} \$\{burst\.words\}`/);
  assert.match(main, /rain: rainRingsOn\(\) \? Math\.max\(falling\.rain, burstFelt\(\)\.rain\) : 0,/);
  assert.match(main, /const level = lightning\.tick\(performance\.now\(\), canvas\.scene \? storm : 0\);/);
  assert.match(main, /thunderReaches\(\{ squares, span, storm: stormHere\(\) \}\)/);
  assert.match(main, /strikePlace\(Math\.random, rect, grid, !\(skyStorm > 0\) && !boltNext \? 0 : /);
  // What the rest of the map goes by is the scene's own weather still: the ground, the wildlife, the sea.
  assert.match(main, /skyFalling = falling;/);
  assert.doesNotMatch(main, /skyStorm = [^;]*burst/i);
});

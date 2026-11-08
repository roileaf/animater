import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIMATES, forecastAt, forecastDays, forecastWeather, BLOCK_HOURS } from '../../../scripts/engines/motion/weather-forecast.mjs';
import { WEATHERS } from '../../../scripts/engines/motion/sky-weather.mjs';
import { cleanTune } from '../../../scripts/engines/motion/weather-tune.mjs';
import { weatherPanelHtml } from '../../../scripts/ui/weather-panel.mjs';

// Discord (BurningBagel): Simple Calendar Reborn has no weather; Animater makes it from the date.
test('the same date gives the same weather on every screen, with no saving', () => {
  for (let day = 0; day < 50; day++) for (const hour of [0, 9, 17]) assert.equal(forecastAt({ day, hour, climate: 'temperate', season: 'summer', seed: 7 }), forecastAt({ day, hour, climate: 'temperate', season: 'summer', seed: 7 }));
  const a = forecastDays({ from: 0, days: 60, climate: 'temperate', season: 'summer', seed: 1 }).flat(), b = forecastDays({ from: 0, days: 60, climate: 'temperate', season: 'summer', seed: 2 }).flat();
  assert.notDeepEqual(a, b, 'another world rolls its own');
});

test('every weather it gives is one Animater draws, and each climate keeps to its own', () => {
  for (const climate of Object.keys(CLIMATES)) for (const season of ['spring', 'summer', 'autumn', 'winter', null]) for (const id of forecastDays({ from: 0, days: 120, climate, season, seed: 3 }).flat()) assert.ok(WEATHERS.includes(id), `${climate} ${season}: ${id}`);
  const desert = new Set(forecastDays({ from: 0, days: 200, climate: 'dry', season: 'summer', seed: 4 }).flat());
  assert.ok(!desert.has('snow') && !desert.has('blizzard'), 'no snow in a desert summer');
  const winter = forecastDays({ from: 0, days: 200, climate: 'cold', season: 'winter', seed: 4 }).flat();
  assert.ok(winter.filter((w) => w === 'snow' || w === 'blizzard').length > winter.length * 0.2, 'a cold winter snows a good deal');
});

test('a weather for the sky: its id and a temperature fit for it', () => {
  const w = forecastWeather({ day: 2, hour: 12, climate: 'cold', season: 'winter', seed: 1 });
  assert.ok(WEATHERS.includes(w.id)); assert.equal(typeof w.temperature, 'number');
  for (let day = 0; day < 80; day++) { const s = forecastWeather({ day, hour: 12, climate: 'temperate', season: 'winter', seed: 9 }); if (s.id === 'snow' || s.id === 'blizzard') assert.ok(s.temperature <= -2, 'cold enough to lie'); }
  const desert = forecastWeather({ day: 1, hour: 14, climate: 'dry', season: 'summer', seed: 1 }); assert.ok(desert.temperature >= 30);
});

test('the Weather panel offers the climate while the calendar has no weather, and names where it came from', () => {
  const html = weatherPanelHtml({ state: { tune: cleanTune() }, active: { calendar: { name: 'Rain', detail: "Made from Simple Calendar Reborn's date", source: 'Animater' }, dateWeather: { climate: 'temperate', from: 'Simple Calendar Reborn' } } });
  assert.match(html, /data-climate/); assert.match(html, /<option value="temperate" selected>/); assert.match(html, /<option value="off"/);
  assert.match(html, /Made from Simple Calendar Reborn&#39;s date/); assert.match(html, /data-source="Animater"/);
  assert.doesNotMatch(weatherPanelHtml({ state: { tune: cleanTune() } }), /data-climate/, 'with Calendaria (or none asked) no such row');
});

test('under the climate, the coming week: each day by night, morning, afternoon and evening, now marked', () => {
  const week = { days: Array.from({ length: 7 }, (_, d) => ({ name: d ? `Day ${d}` : '9 Sarenith', parts: ['Clear', 'Cloudy', 'Rain', 'Fog'] })), now: 2 };
  const html = weatherPanelHtml({ state: { tune: cleanTune() }, active: { dateWeather: { climate: 'temperate', from: 'Simple Calendar Reborn', week } } });
  assert.match(html, /class="animater-wx-week"/);
  for (const part of ['Night', 'Morning', 'Afternoon', 'Evening']) assert.match(html, new RegExp(`<th[^>]*>${part}</th>`));
  assert.equal((html.match(/<tr data-day/g) ?? []).length, 7);
  assert.match(html, /<td class="is-now"[^>]*>Rain<\/td>/, 'today, the afternoon');
  assert.equal((html.match(/is-now/g) ?? []).length, 1);
  assert.doesNotMatch(weatherPanelHtml({ state: { tune: cleanTune() }, active: { dateWeather: { climate: 'off', from: 'Simple Calendar Reborn', week: null } } }), /animater-wx-week/, 'off: no week');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /week: dateWeek\(\)/);
});

test('main asks Calendaria first, else the date; a world setting picks the climate', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("dateWeather"/);
  assert.equal((main.match(/globalThis\.CALENDARIA\?\.api\?\.getCurrentWeather\?\.\(\) \?\? null/g) ?? []).length, 0, 'every weather read goes through calendarWeather');
  assert.match(main, /const calendarWeather = /);
});

test('it changes some through a day but holds for a while, never flicking every block', () => {
  const blocks = forecastDays({ from: 0, days: 120, climate: 'temperate', season: 'spring', seed: 5 }).flat();
  let changes = 0; for (let i = 1; i < blocks.length; i++) if (blocks[i] !== blocks[i - 1]) changes++;
  assert.ok(changes > blocks.length * 0.1 && changes < blocks.length * 0.6, `${changes} changes in ${blocks.length}`);
  assert.equal(24 % BLOCK_HOURS, 0);
  assert.equal(forecastAt({ day: 3, hour: 1, climate: 'temperate', season: 'spring', seed: 5 }), blocks[3 * (24 / BLOCK_HOURS)], 'by the block the hour falls in');
});

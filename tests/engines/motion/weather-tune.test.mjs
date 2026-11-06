import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTune, effectIn, tuneAdds, tuneFalling, tunedRainbow, tuneTouched, tuneWeather, tuneWords } from '../../../scripts/engines/motion/weather-tune.mjs';
import { weatherScene } from '../../../scripts/engines/motion/sky-weather.mjs';
import { effectToggled, familyOf, sliderText, weatherPanelHtml } from '../../../scripts/ui/weather-panel.mjs';

test('a saved tune is made safe, with every key so a save replaces the last', () => {
  const none = cleanTune();
  assert.equal(tuneTouched(none), false);
  assert.ok(Object.values(none).every((v) => v === null));
  assert.ok('amount' in none && 'color' in none && 'cover' in none);
  const t = cleanTune({ amount: 9, size: -1, fog: 'x', color: 'red', fogColor: '#AABBCC', wind: 0.5, other: 1 });
  assert.equal(t.amount, 2);
  assert.equal(t.size, 0.4);
  assert.equal(t.fog, null);
  assert.equal(t.color, null);
  assert.equal(t.fogColor, '#AABBCC');
  assert.equal(t.wind, 0.5);
  assert.equal('other' in t, false);
  assert.equal(cleanTune({ amount: 1 }).amount, null, "a multiple of 1 is the weather's own");
  assert.equal(cleanTune({ fog: 0 }).fog, 0, 'none at all is a choice, not the same as untouched');
});

test('left alone, the weather is exactly what it was', () => {
  const rain = weatherScene({ id: 'rain' });
  assert.equal(tuneWeather(rain, cleanTune()), rain);
  assert.equal(tuneWeather(null, cleanTune({ amount: 2 })), null);
});

test('each control overrides its own part of the weather', () => {
  const storm = weatherScene({ id: 'thunderstorm' }), before = JSON.stringify(storm);
  const t = tuneWeather(storm, cleanTune({ amount: 0.5, size: 2, speed: 3, color: '#ff0000', lightning: 0 }));
  assert.equal(t.falls[0].amount, 0.5);
  assert.equal(t.falls[0].size, 2.4);
  assert.deepEqual(t.falls[0].color, [1, 0, 0]);
  assert.equal(t.curtains, 0.25);
  assert.equal(t.speed, 3);
  assert.equal(t.storm, 0);
  assert.equal(JSON.stringify(storm), before, 'the weather given stays as it was');
  assert.equal(tuneWeather(storm, cleanTune({ amount: 2 })).falls[0].amount, 1.5, 'capped');
  assert.equal(tuneWeather(storm, cleanTune({ size: 2 })).storm, storm.storm, 'what was not touched follows the weather');
});

test('fog can be added to any weather, thinned, or coloured', () => {
  const clear = weatherScene({ id: 'clear' });
  assert.equal(tuneAdds(cleanTune({ fog: 0.5 })), true);
  assert.equal(tuneAdds(cleanTune({ fog: 0 })), false);
  const added = tuneWeather(clear, cleanTune({ fog: 0.5 }));
  assert.equal(added.fog[3], 0.5);
  assert.ok(added.fog[0] < 1, 'a fog colour, not bare white');
  const roll = weatherScene({ id: 'rolling-fog' });
  assert.deepEqual(tuneWeather(roll, cleanTune({ fog: 0.2 })).fog, [...roll.fog.slice(0, 3), 0.2]);
  assert.deepEqual(tuneWeather(roll, cleanTune({ fogColor: '#000000' })).fog, [0, 0, 0, roll.fog[3]]);
});

test('amount reaches what follows the rain; colour does not', () => {
  const falling = { rain: 0.7, snow: 0.2, temperature: 3 };
  assert.deepEqual(tuneFalling(falling, cleanTune({ amount: 0 })), { rain: 0, snow: 0, temperature: 3 });
  assert.equal(tuneFalling(falling, cleanTune({ amount: 2 })).rain, 1);
  assert.equal(tuneFalling(falling, cleanTune({ color: '#ff0000' })), falling);
});

test('the panel shows what is set and escapes what a GM names', () => {
  assert.equal(sliderText('amount', null), '100%');
  assert.equal(sliderText('wind', null), 'Auto');
  assert.equal(sliderText('wind', 0.25), '25%');
  const html = weatherPanelHtml({ state: { weather: 'animater.rain', tune: { amount: 1.5 }, way: 'top', windFrom: 'n' }, weathers: [['', 'None'], ['animater.rain', 'Rain']], looks: ['<b>"x"</b>'], base: weatherScene({ id: 'rain' }) });
  assert.ok(html.includes('class="is-active" data-action="setWeather" data-weather="animater.rain"'), 'the weather chosen shows');
  assert.equal(html.includes('<select'), false, 'no dropdowns');
  assert.ok(/class="is-active" data-action="setWay" data-way="top"/.test(html), 'the way chosen shows');
  assert.ok(html.includes('data-action="applyLook"'), 'presets are buttons');
  assert.ok(/class="is-active" data-action="setFrom" data-from="n"/.test(html), 'the wind chosen shows');
  assert.ok(html.includes('class="is-active" data-action="setFamily" data-family="rain"'), 'its family open');
  assert.ok(html.includes('class="animater-wx-row is-set" data-row="amount"'), 'what was changed stands out');
  assert.ok(html.includes('class="animater-wx-row" data-row="size"'), 'what was not does not');
  const clearHtml = weatherPanelHtml({ state: {}, weathers: [], base: weatherScene({ id: 'clear' }) });
  assert.ok(clearHtml.includes('Auto: nothing'), 'says what falls by itself');
  assert.ok(clearHtml.includes('data-slot="fall" data-kind="snow"'), 'snow can be chosen on a clear day');
  assert.ok(clearHtml.includes('class="animater-wx-row is-off" data-row="amount"'), 'amount waits until something falls');
  assert.ok(!weatherPanelHtml({ state: { tune: { fall: 'snow' } }, weathers: [], base: weatherScene({ id: 'clear' }) }).includes('is-off" data-row="amount"'), 'and works once it does');
  assert.ok(clearHtml.includes('data-action="toggleEffect" data-key="aurora"'), 'every effect can be added');
  assert.ok(!clearHtml.includes('data-row="aurora"'), 'without a row until it is');
  assert.ok(weatherPanelHtml({ state: { tune: { aurora: 0.5 } }, weathers: [], base: weatherScene({ id: 'clear' }) }).includes('data-row="auroraColor"'), 'added, with its colour');
  assert.ok(weatherPanelHtml({ state: {}, weathers: [], base: weatherScene({ id: 'tornado' }) }).includes('data-row="tornado"'), "the weather's own effects show");
  assert.ok(weatherPanelHtml({ state: {}, weathers: [] }).includes('data-action="resetAll" disabled'), 'nothing to reset yet');
  assert.ok(html.includes('value="1.5"'));
  assert.equal(html.includes('<b>'), false);
  const other = weatherPanelHtml({ state: { weather: 'someone-elses', tune: null }, weathers: [['', 'None']] });
  assert.ok(other.includes('class="is-active" data-action="setWeather" data-weather="someone-elses"'), "another module's weather stays selected");
});

test('anything can be built on any weather: what falls', () => {
  const clear = weatherScene({ id: 'clear' }), rain = weatherScene({ id: 'rain' });
  const snow = tuneWeather(clear, cleanTune({ fall: 'snow', amount: 2 }));
  assert.equal(snow.falls.length, 1);
  assert.equal(snow.falls[0].kind, 2);
  assert.equal(snow.falls[0].amount, 1.4);
  assert.deepEqual(snow.falls[0].color, [1, 1, 1]);
  assert.equal(tuneAdds(cleanTune({ fall: 'snow' })), true);
  assert.equal(tuneAdds(cleanTune({ fall: 'none' })), false);
  assert.equal(tuneWeather(rain, cleanTune({ fall: 'none' })).falls.length, 0, 'or nothing, in the rain');
  const both = tuneWeather(clear, cleanTune({ fall: 'rain', fall2: 'ember', amount2: 0.8, color: '#ff0000', color2: '#00ff00' }));
  assert.deepEqual(both.falls.map((f) => f.kind), [1, 9]);
  assert.equal(both.falls[1].amount, 0.8);
  assert.deepEqual(both.falls[0].color, [1, 0, 0]);
  assert.deepEqual(both.falls[1].color, [0, 1, 0]);
  assert.equal(cleanTune({ fall: 'frogs' }).fall, null);
});

test('anything can be built on any weather: every effect', () => {
  const clear = weatherScene({ id: 'clear' });
  const built = tuneWeather(clear, cleanTune({ mist: 0.5, heat: 1, frost: 0.2, meteors: 0.3, noise: 0.4, aurora: 0.6, auroraColor: '#0000ff', tornado: 0.7 }));
  assert.equal(built.mist, 0.5);
  assert.equal(built.heat, 1);
  assert.equal(built.frost, 0.2);
  assert.equal(built.meteors, 0.3);
  assert.equal(built.noise, 0.4);
  assert.deepEqual(built.aurora, [0, 0, 1, 0.6]);
  assert.deepEqual(built.swirl, [1, 0.7]);
  assert.equal(tuneAdds(cleanTune({ noise: 0.1 })), true);
  assert.deepEqual(tuneWeather(clear, cleanTune({ dustDevil: 0.4 })).swirl, [2, 0.4]);
  const twister = weatherScene({ id: 'tornado' });
  assert.equal(effectIn(twister, 'tornado'), 1);
  assert.deepEqual(tuneWeather(twister, cleanTune({ tornado: 0 })).swirl, [0, 0], 'taken away too');
  assert.equal(effectIn(weatherScene({ id: 'luminous-sky' }), 'aurora'), 0.6);
  assert.equal(tuneWeather(weatherScene({ id: 'mist' }), cleanTune({ size: 2 })).mist, 1, 'what was not touched stays');
});

test('what is built follows through to the ground and the sounds', () => {
  const dry = { rain: 0, snow: 0, temperature: 21, air: 21 };
  const snowing = tuneFalling(dry, cleanTune({ fall: 'snow' }));
  assert.equal(snowing.snow, 0.7);
  assert.equal(snowing.rain, 0);
  assert.equal(snowing.temperature, null, 'it lies, whatever the calendar says');
  assert.equal(snowing.air, -5);
  assert.equal(tuneFalling({ rain: 0.7, snow: 0 }, cleanTune({ fall: 'hail' })).rain, 0, 'chosen in place of the rain');
  assert.equal(tuneFalling(dry, cleanTune({ fall2: 'rain', amount2: 0.4 })).rain, 0.4);
  assert.equal(tuneFalling({ rain: 0.7, snow: 0 }, cleanTune({ fall: 'none' })).rain, 0);
  assert.equal(tuneWords(cleanTune({ fall: 'hail' })), ' hail');
  assert.equal(tuneWords(cleanTune({ fall: 'snow' }), 0.3), '');
  assert.equal(tuneWords(cleanTune({ fall: 'snow' }), 0.8), ' blizzard');
});

test('a GM\'s own lightning at full is a real storm; a weather\'s own stays as tuned', async () => {
  const { boltDue } = await import('../../../scripts/engines/motion/lightning-bolt.mjs');
  assert.equal(boltDue(6000, 1, () => 0.8, true), true);
  assert.equal(boltDue(5000, 1, () => 0, true), false);
  assert.equal(boltDue(6000, 1, () => 0.8), false, 'not a weather\'s own');
  assert.equal(boltDue(6000, 0, () => 0, true), false);
});

test('temperature works in any weather: a cold, sunny day', () => {
  assert.equal(cleanTune({ temperature: -99 }).temperature, -30);
  assert.equal(cleanTune({ temperature: 0 }).temperature, 0, 'freezing is a value, not nothing');
  assert.equal(sliderText('temperature', -8), '-8°C');
  assert.equal(sliderText('temperature', null), 'Auto');
  const clearDay = { rain: 0, snow: 0, temperature: 21, air: 21 };
  assert.deepEqual(tuneFalling(clearDay, cleanTune({ temperature: -8 })), { rain: 0, snow: 0, temperature: -8, air: -8 });
  const falling = { rain: 0, snow: 0.7 };
  assert.equal(tuneFalling(falling, cleanTune({ temperature: -8 })).temperature, undefined, 'only what carries a temperature');
  assert.equal(tuneFalling(clearDay, cleanTune({ fall: 'snow', temperature: 5 })).temperature, 5, 'said outright, it wins over falling snow');
  assert.equal(tuneWeather(weatherScene({ id: 'clear' }), cleanTune({ temperature: -8 })).falls.length, 0, 'and draws nothing itself');
});
test('the sky shader stays within the textures a card takes for sure', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../../scripts/engines/motion/sky-light.mjs', import.meta.url), 'utf8');
  const frag = source.slice(0, source.indexOf('float hash(vec2 p)'));
  const samplers = [...frag.matchAll(/uniform sampler2D ([^;]+);/g)].flatMap((m) => m[1].split(','));
  assert.ok(samplers.length <= 16, `${samplers.length} textures`);
});

test('the panel opens at the weather\'s family, and its effect buttons turn on and off', () => {
  assert.equal(familyOf(''), 'calendar');
  assert.equal(familyOf('animater.blizzard'), 'snow');
  assert.equal(familyOf('animater.blood-rain'), 'strange');
  const clear = weatherScene({ id: 'clear' }), twister = weatherScene({ id: 'tornado' });
  assert.equal(effectToggled(cleanTune(), 'aurora', clear), 0.5, 'off: on at half');
  assert.equal(effectToggled(cleanTune({ aurora: 0.8 }), 'aurora', clear), null, 'on: off again');
  assert.equal(effectToggled(cleanTune(), 'tornado', twister), 0, "the weather's own: off");
  assert.equal(effectToggled(cleanTune({ tornado: 0 }), 'tornado', twister), null, 'and back to its own');
  const second = weatherPanelHtml({ state: {}, weathers: [], base: clear, second: true });
  assert.ok(second.includes('data-slot="fall2" data-kind="snow"'));
  assert.equal(weatherPanelHtml({ state: {}, weathers: [], base: clear }).includes('data-slot="fall2"'), false, 'hidden until asked for');
  assert.ok(weatherPanelHtml({ state: { tune: { fall2: 'ash' } }, weathers: [], base: clear }).includes('data-row="amount2"'));
});

test('a rainbow can be asked for in any weather, and turned off', () => {
  assert.equal(tunedRainbow(cleanTune()), null, 'left to the weather');
  assert.equal(tunedRainbow(cleanTune({ rainbow: 0 })), 0, 'or none at all');
  assert.equal(tunedRainbow(cleanTune({ rainbow: 0.6 })), 1, 'as bright as one after the rain');
  assert.ok(tunedRainbow(cleanTune({ rainbow: 1 })) > 1, 'brighter at the top');
  assert.equal(effectToggled(cleanTune(), 'rainbow', weatherScene({ id: 'clear' })), 0.6, 'the button starts it at that');
  assert.ok(weatherPanelHtml({ state: {}, weathers: [], base: weatherScene({ id: 'clear' }) }).includes('data-action="toggleEffect" data-key="rainbow"'));
});

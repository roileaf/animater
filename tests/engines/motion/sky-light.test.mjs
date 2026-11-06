import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weatherOf, cloudCover, heatOf, surfacesOf, flashLevel, nextStrikeMs } from '../../../scripts/engines/motion/sky-light.mjs';

test('weatherOf reads Calendaria’s wind, heat and storm, else the scene’s weather', () => {
  const calm = weatherOf({ calendaria: { id: 'clear', temperature: 24, wind: { speed: 0, direction: 22.5 } } });
  assert.equal(calm.wind, 0);
  assert.equal(calm.temperature, 24);
  assert.equal(calm.storm, false);
  // A north wind (from 0°) blows south: down the map.
  const north = weatherOf({ calendaria: { id: 'windy', wind: { speed: 3, direction: 0 } } });
  assert.ok(Math.abs(Math.cos(north.windAngle)) < 1e-9 && Math.sin(north.windAngle) > 0.99);
  assert.equal(north.wind, 0.6, 'a force of 3 out of 5');
  assert.equal(weatherOf({ calendaria: { id: 'gale', wind: { speed: 90 } } }).wind, 1, 'km/h, capped');
  assert.equal(weatherOf({ calendaria: { id: 'thunderstorm', wind: { speed: 4 } } }).storm, true);
  assert.equal(weatherOf({ calendaria: { id: 'sandstorm', wind: { speed: 4 } } }).storm, false, 'no lightning in a sandstorm');
  assert.equal(weatherOf({ scene: 'rainStorm' }).storm, true);
  assert.equal(weatherOf({ fx: { a: { type: 'lightning' } } }).storm, true, 'FXMaster’s lightning');
  assert.equal(weatherOf({}).temperature, null);
});

test('cloudCover goes with the sky; heatOf needs a high clear sun over hot ground', () => {
  assert.equal(cloudCover(1), 0);
  assert.ok(Math.abs(cloudCover(0.3) - 0.7) < 1e-9);
  assert.equal(cloudCover(undefined), 0);
  const noon = { angle: -90, height: 70, strength: 1 };
  assert.equal(heatOf({ sun: noon, temperature: 40 }), 1);
  assert.equal(heatOf({ sun: noon, temperature: 20 }), 0, 'a cool day');
  assert.ok(heatOf({ sun: noon, hotGround: true }) > 0.5, 'sand, the weather unknown');
  assert.equal(heatOf({ sun: noon }), 0, 'neither hot weather nor hot ground');
  assert.equal(heatOf({ sun: { ...noon, height: 25 }, temperature: 40 }), 0, 'morning');
  assert.equal(heatOf({ sun: noon, sky: 0.4, temperature: 40 }), 0, 'clouded over');
  assert.equal(heatOf({ sun: { ...noon, moon: true }, temperature: 40 }), 0);
});

test('surfacesOf gathers water, snow and ice, and sand from the regions and the scene’s floor', () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  const s = surfacesOf({ sceneFloor: 'snow', regions: [{ floor: 'water', polygons: [square] }, { floor: 'ice', polygons: [square] }, { floor: 'sand', polygons: [square, [1, 2]] }, { floor: 'grass', polygons: [square] }] });
  assert.equal(s.water.length, 1);
  assert.equal(s.frozen.length, 1);
  assert.equal(s.hot.length, 1, 'a broken polygon is left out');
  assert.equal(s.whole, 'frozen');
  assert.equal(surfacesOf({ sceneFloor: 'sand' }).whole, 'hot');
  assert.equal(surfacesOf({ sceneFloor: 'water' }).whole, null);
});

test('a lightning flash strikes hard, flickers once and fades within a few tenths of a second', () => {
  assert.equal(flashLevel(-1), 0);
  assert.equal(flashLevel(60), 1);
  assert.ok(flashLevel(140) < 0.3 && flashLevel(190) > 0.8, 'a dip, then the second flicker');
  assert.ok(flashLevel(400) > 0 && flashLevel(400) < 0.3);
  assert.equal(flashLevel(700), 0);
  assert.equal(nextStrikeMs(0, 1), 3000, 'the worst storm: from 3 s');
  assert.equal(nextStrikeMs(1, 1), 10000, 'to 10 s');
  assert.equal(nextStrikeMs(0, 0), 15000, 'a mild one: from 15 s');
  assert.equal(nextStrikeMs(1, 0), 35000, 'to 35 s');
});

test('the scene’s own wind sets how hard it blows and where from, over the weather’s', () => {
  const calendaria = { id: 'windy', wind: { speed: 4, direction: 90 } };
  assert.equal(weatherOf({ calendaria, own: { wind: 'calm' } }).wind, 0);
  assert.equal(weatherOf({ calendaria, own: { wind: 'gale' } }).wind, 1);
  assert.ok(Math.abs(weatherOf({ calendaria, own: { wind: 'sheltered' } }).wind - 0.4) < 1e-9, 'half of a force 4');
  assert.equal(weatherOf({ calendaria, own: { wind: '' } }).wind, 0.8, 'from the weather');
  assert.equal(weatherOf({ own: { wind: 'breeze' } }).wind, 0.3, 'no calendar: still the scene’s');
  // A weather's least wind (a blizzard's gale) only when nobody said.
  assert.equal(weatherOf({ own: { wind: 'calm' } }).windStated, true);
  assert.equal(weatherOf({ calendaria: { id: 'blizzard', wind: { speed: 0 } } }).windStated, true);
  assert.equal(weatherOf({ calendaria: { id: 'blizzard' } }).windStated, false);
  // An east wind (Calendaria’s 90) blows west, left on the map; the scene’s own "from the south" blows north, up it.
  const east = weatherOf({ calendaria }).windAngle, south = weatherOf({ calendaria, own: { windFrom: 's' } }).windAngle;
  assert.ok(Math.cos(east) < -0.99, 'from the east: blows west');
  assert.ok(Math.sin(south) < -0.99, 'from the south: blows north');
  // Nothing given: a north-west wind, blowing to the south-east.
  const plain = weatherOf({}).windAngle;
  assert.ok(Math.cos(plain) > 0.7 && Math.sin(plain) > 0.7);
});

test('snow lies on the roofs as on the ground; a tree holds less, and less in a wind', async () => {
  const { tileSnowOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(tileSnowOf(0.6, { kind: 'roof' }), 0.6);
  assert.ok(tileSnowOf(0.6, { kind: 'tree' }) < 0.6, 'a tree less');
  assert.ok(tileSnowOf(0.6, { kind: 'tree', wind: 1 }) < tileSnowOf(0.6, { kind: 'tree', wind: 0 }), 'shed in a wind');
  assert.equal(tileSnowOf(0, { kind: 'roof' }), 0);
  assert.equal(tileSnowOf(3, { kind: 'roof' }), 1, 'never past whole');
});

test('the tiles\' snow: one mesh a roof or tree, drawn only while snow lies, faded with its tile', async () => {
  const { createTileSnow } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const added = [];
  class Geometry { addAttribute(name, data) { this[name] = data; return this; } addIndex() { return this; } }
  class Mesh { constructor(geometry, shader) { this.geometry = geometry; this.shader = shader; this.visible = true; } destroy() { this.destroyed = true; } }
  const PIXI = { Geometry, Mesh, Shader: { from: (v, f, uniforms) => ({ uniforms }) } };
  const layer = createTileSnow({ PIXI, root: () => ({ addChild: (m) => added.push(m) }) });
  const texture = { valid: true };
  layer.build({ tiles: [{ kind: 'roof', texture, x: 100, y: 100, width: 200, height: 100, anchorX: 0.5, anchorY: 0.5, rotation: 0, shown: 1 }, { kind: 'tree', texture, x: 400, y: 100, width: 100, height: 100 }], grid: 100 });
  assert.equal(added.length, 2);
  assert.deepEqual(added[0].geometry.aVertexPosition, [0, 50, 200, 50, 200, 150, 0, 150], 'over the tile, from its anchor');
  assert.ok(!layer.showing, 'no snow: nothing drawn');
  layer.look({ snow: 0.7, wind: 0.2 });
  assert.ok(layer.showing);
  assert.equal(added[0].shader.uniforms.uAmount, 0.7);
  assert.ok(added[1].shader.uniforms.uAmount < 0.7 && added[1].shader.uniforms.uTree === 1);
  layer.shown([0, 1]);
  assert.equal(added[0].shader.uniforms.uShown, 0, 'a roof faded for a creature inside: its snow too');
  layer.clear();
  assert.ok(added.every((m) => m.destroyed) && !layer.built);
});

test('a storm\'s severity: Calendaria\'s rain and wind, else FXMaster\'s lightning frequency, else middling; it sets how bright and how often', async () => {
  const { weatherOf, stormSeverity, strikeStrength, doubleStrike } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const fierce = weatherOf({ calendaria: { id: 'thunderstorm', precipitation: { type: 'rain', intensity: 1 }, wind: { speed: 5 } } });
  const mild = weatherOf({ calendaria: { id: 'thunderstorm', precipitation: { type: 'rain', intensity: 0.2 }, wind: { speed: 1 } } });
  assert.ok(fierce.storm && fierce.severity > 0.9);
  assert.ok(mild.severity < 0.45 && mild.severity > 0.15);
  assert.equal(weatherOf({ calendaria: { id: 'clear' } }).severity, 0, 'no storm');
  assert.equal(weatherOf({ scene: 'rainStorm' }).severity, 0.55, 'the scene\'s storm alone: middling');
  const fx = weatherOf({ fxFilters: { f0: { type: 'lightning', options: { frequency: 1500 } } } });
  assert.ok(fx.storm && fx.severity === 1, 'FXMaster flashing every 1.5 s: the worst');
  assert.ok(stormSeverity({ fxLightning: { options: { frequency: 20000 } } }) === 0.15, 'slow: the mildest');
  assert.ok(strikeStrength(1, 1) > strikeStrength(1, 0.2), 'brighter in a fierce storm');
  assert.ok(strikeStrength(0, 1) < strikeStrength(1, 1), 'a distant strike dimmer');
  assert.ok(doubleStrike(1) > doubleStrike(0.2));
});

test('a water region freezes unless it never does', async () => {
  const { surfacesOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const pond = [0, 0, 100, 0, 100, 100, 0, 100], spring = [200, 0, 300, 0, 300, 100, 200, 100];
  const s = surfacesOf({ regions: [{ floor: 'water', polygons: [pond] }, { floor: 'water', polygons: [spring], freezes: false }] });
  assert.equal(s.water.length, 2);
  assert.deepEqual(s.freezes, [pond], 'the hot spring stays open');
});

test('a river flows the way its region says, gently or swiftly; still water has no flow', async () => {
  const { surfacesOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const river = [0, 0, 100, 0, 100, 400, 0, 400], pond = [200, 0, 300, 0, 300, 100, 200, 100];
  const s = surfacesOf({ regions: [{ floor: 'water', polygons: [river], flow: Math.PI / 2, current: 1 }, { floor: 'water', polygons: [pond] }] });
  assert.equal(s.flows.length, 1, 'only the river');
  assert.equal(s.flows[0].angle, Math.PI / 2);
  assert.equal(s.flows[0].speed, 1);
  assert.equal(s.water.length, 2);
});

test('a rainbow comes out when the rain stops under a clearing sky, and fades as the ground dries', async () => {
  const { rainbowOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const sun = { angle: -150, height: 40, strength: 1 };
  assert.ok(rainbowOf({ wet: 1, sun }) > 0.9, 'the rain just stopped');
  assert.equal(rainbowOf({ wet: 1, raining: true, sun }), 0, 'still raining');
  assert.equal(rainbowOf({ wet: 0.85, sun }), 0, 'dried out');
  assert.ok(rainbowOf({ wet: 0.94, sun }) > 0 && rainbowOf({ wet: 0.94, sun }) < rainbowOf({ wet: 1, sun }), 'fading as it dries');
  assert.equal(rainbowOf({ wet: 1, sun: { ...sun, moon: true } }), 0, 'by moonlight: none');
  assert.equal(rainbowOf({ wet: 1, sun, clouds: 0.9 }), 0, 'overcast');
});

test('light snow lies in patches, and the tracks know where; deep snow lies everywhere', async () => {
  const { snowPatchAt } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const spots = [];
  for (let x = 0; x < 4000; x += 97) for (let y = 0; y < 3000; y += 89) spots.push({ x, y });
  const share = (snow) => spots.filter((p) => snowPatchAt(p, snow, 100) >= 0.5).length / spots.length;
  assert.ok(share(0.3) > 0.01 && share(0.3) < 0.6, 'light snow: some patches, much bare ground');
  assert.ok(share(1) > 0.97, 'deep snow: everywhere');
  assert.equal(share(0), 0, 'none: nowhere');
});

test('with Calendaria lifting the night by the moon, the ground moonlight is half, not twice the brightening', async () => {
  const { moonGlow, calendariaMoonLifts } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(moonGlow(1), 1);
  assert.equal(moonGlow(1, { calendariaLifts: true }), 0.5);
  assert.equal(calendariaMoonLifts({ active: true, sync: true, moonSync: true }), true, 'world settings on');
  assert.equal(calendariaMoonLifts({ active: true, sync: true, moonSync: true, sceneMoonSync: 'disabled' }), false, 'scene turned it off');
  assert.equal(calendariaMoonLifts({ active: true, sync: false, moonSync: true }), false, 'its darkness does not follow the clock');
  assert.equal(calendariaMoonLifts({ active: false, sync: true, moonSync: true }), false, 'no Calendaria');
});

test('the weather lights the outdoors its own way: a storm darkest, rain grey-blue, an overcast sky flat, clear none', async () => {
  const { weatherLight } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(weatherLight({ clouds: 0.2 })[3], 0, 'clear: none');
  const grey = weatherLight({ clouds: 1 }), rain = weatherLight({ rain: 0.7, clouds: 1 }), storm = weatherLight({ storm: true, severity: 1, rain: 1, clouds: 1 });
  assert.ok(grey[3] > 0 && rain[3] > grey[3] && storm[3] > rain[3], 'deeper as it worsens');
  assert.ok(storm[1] > storm[0], 'a storm green-grey');
  assert.ok(weatherLight({ kind: 'sandstorm' })[0] > weatherLight({ kind: 'sandstorm' })[2], 'a sandstorm amber');
  assert.ok(weatherLight({ rain: 1, day: 0 })[3] < weatherLight({ rain: 1, day: 1 })[3], 'by night less');
});

test('cloud shadows follow the FXMaster clouds: their direction and speed, and give way to their own shadows', async () => {
  const { fxClouds } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(fxClouds({}), null);
  assert.equal(fxClouds({ a: { type: 'rain', options: {} } }), null);
  const c = fxClouds({ p: { type: 'clouds', options: { direction: 90, speed: 0.29, dropShadow: true } } });
  assert.ok(Math.abs(c.angle - Math.PI / 2) < 1e-9 && c.speed === 0.29 && c.shadows === true);
  assert.equal(fxClouds({ p: { type: 'clouds', options: { direction: 0 } } }).shadows, false);
});

test('a river runs at the pace its region chose, gentle when unset', async () => {
  const { riverCurrent } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(riverCurrent(undefined), 0.4);
  assert.equal(riverCurrent(''), 0.4);
  assert.equal(riverCurrent('swift'), 1);
  assert.ok(riverCurrent('slower') < riverCurrent('slow') && riverCurrent('slow') < riverCurrent(''));
  assert.ok(riverCurrent('slower') * 255 >= 1, 'still a current once baked to 8 bits');
});

test('the season colours a grass region only when it takes the season; fireflies take either for a meadow', () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  const plain = surfacesOf({ regions: [{ floor: 'grass', polygons: [square] }] });
  assert.deepEqual(plain.grass, [square]);
  assert.deepEqual(plain.tinted, [], 'a region that only names its floor leaves the map alone');
  assert.deepEqual(surfacesOf({ regions: [{ floor: 'grass', seasonal: true, polygons: [square] }] }).tinted, [square]);
  assert.equal(surfacesOf({ sceneFloor: 'grass' }).grassAll, true, 'a grassy scene is coloured whole, as ever');
});

test('snow or ice Animater paints has its own glints, so the map\'s sparkle leaves it alone', async () => {
  const { surfacesOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const square = [0, 0, 100, 0, 100, 100, 0, 100];
  assert.equal(surfacesOf({ regions: [{ floor: 'snow', polygons: [square] }] }).frozen.length, 1);
  assert.equal(surfacesOf({ regions: [{ floor: 'ice', polygons: [square], painted: true }] }).frozen.length, 0);
});

test('the cloud deck: broken skies have sun between clouds, closed ones go dim and heavy, rain darkest', async () => {
  const { cloudLook } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const partly = cloudLook(0.3), overcast = cloudLook(0.9), drizzle = cloudLook(0.8, true), rain = cloudLook(0.9, true);
  assert.ok(Math.abs(partly[0] - 0.42) < 1e-9 && partly[1] === 0 && partly[3] === 1, 'sun between its clouds');
  assert.ok(overcast[1] > cloudLook(0.65)[1], 'heavier');
  assert.ok(rain[3] < drizzle[3], 'rain dimmer than drizzle (the rain\'s own wash does the rest)');
  assert.ok(rain[0] > overcast[0], 'and most of the sky');
  assert.deepEqual(cloudLook(0.2, true), cloudLook(0.2), 'a sunshower is not a rain deck');
  for (const c of [0, 0.15, 0.5, 0.77, 1]) for (const wet of [false, true]) assert.ok(cloudLook(c, wet).every(Number.isFinite), String(c));
  assert.ok(Math.abs(cloudLook(undefined)[0] - 0.1) < 1e-9);
});

test('only a real change to the scene builds the sky again; weather and darkness are only looked at', async () => {
  const { skyNeedsBuilding } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(skyNeedsBuilding({ weather: 'animater.rain', _id: 'a', _stats: {} }), false);
  assert.equal(skyNeedsBuilding({ environment: { darknessLevel: 0.2 } }), false);
  assert.equal(skyNeedsBuilding({ flags: { animater: { ground: { at: 1 } } } }), false);
  assert.equal(skyNeedsBuilding({ environment: { globalLight: {} } }), true);
  assert.equal(skyNeedsBuilding({ flags: { animater: { floorTextures: 'on' } } }), true);
  assert.equal(skyNeedsBuilding({ flags: { fxmaster: {} } }), true);
  assert.equal(skyNeedsBuilding({ background: {} }), true);
  assert.equal(skyNeedsBuilding({}), false);
});

test('a sandstorm on the scene is no thunderstorm', () => {
  assert.equal(weatherOf({ scene: 'animater.sandstorm' }).storm, false);
  assert.equal(weatherOf({ scene: 'animater.thunderstorm' }).storm, true);
});

test('a scene can keep what falls coming down the map', () => {
  const source = readFileSync(new URL('../../../scripts/engines/motion/sky-light.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('vec2 fallWay(vec2 way)'));
  assert.equal(source.split('fallWay(vec2(').length - 1, 4, 'rain, snow, ash and the small falls all ask it');
});

test('a scene says which way what falls goes, else the setting does', async () => {
  const { fallWayHere, skyNeedsBuilding } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.equal(fallWayHere('', true), 1);
  assert.equal(fallWayHere(undefined, true), 1);
  assert.equal(fallWayHere('', false), 0);
  assert.equal(fallWayHere('off', true), 0);
  assert.equal(fallWayHere('on', false), 1);
  assert.equal(fallWayHere('top', false), 2);
  assert.equal(fallWayHere(true, false), 1, 'the earlier tick still counts');
  assert.equal(skyNeedsBuilding({ flags: { animater: { weatherTune: {}, fallsDown: 'top' } } }), false, 'tuning the weather builds nothing again');
  assert.equal(skyNeedsBuilding({ flags: { animater: { floor: 'x' } } }), true);
});

test('lying snow catches the nearest lights that give any', async () => {
  const { nearestLights } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const lamps = [{ x: 900, y: 0, radius: 100 }, { x: 100, y: 0, radius: 50 }, { x: 0, y: 10, radius: 0 }, { x: 500, y: 0, radius: 600 }, { x: 300, y: 0, radius: 50 }, { x: 700, y: 0, radius: 50 }];
  assert.deepEqual(nearestLights(lamps, { x: 0, y: 0 }, 2).map((l) => l.x), [500, 100], 'by how near its light reaches');
  assert.equal(nearestLights(lamps, { x: 0, y: 0 }, 9).some((l) => l.radius === 0), false);
  assert.equal(nearestLights([], { x: 0, y: 0 }).length, 0);
});

test('ice as a region\'s own floor is known apart, so snow only dusts it', async () => {
  const { surfacesOf } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const square = [0, 0, 10, 0, 10, 10];
  const out = surfacesOf({ regions: [{ floor: 'ice', polygons: [square] }, { floor: 'snow', polygons: [square] }, { floor: 'water', polygons: [square] }] });
  assert.equal(out.icy.length, 1);
  assert.equal(out.water.length, 1);
  assert.equal(surfacesOf({ regions: [{ floor: 'ice', painted: true, polygons: [square] }] }).icy.length, 1, 'painted or not');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VARIANTS, crownOpen, pictureOf, shadowReach, turnOf } from '../../../scripts/engines/motion/decorations.mjs';

test('decorations share a few pictures a kind: a look by seed, a size step, and the weather that changes its paint', () => {
  const a = pictureOf({ kind: 'rock', seed: 3, size: 0.4 }), b = pictureOf({ kind: 'rock', seed: 3 + VARIANTS, size: 0.41 });
  assert.equal(a.key, b.key, 'same look and size step');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 4, size: 0.4 }).key, a.key, 'another look');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 3, size: 0.8 }).key, a.key, 'another size step');
  assert.notEqual(pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'autumn' }).key, pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'summer' }).key, 'its season');
});

test('a crown opens over a creature under it and stays shut for one beside it', () => {
  const tree = { x: 500, y: 500, size: 2.6 };
  assert.equal(crownOpen(tree, [{ x: 500, y: 500, width: 100 }], 100), 1);
  assert.equal(crownOpen(tree, [{ x: 900, y: 500, width: 100 }], 100), 0);
  const edge = crownOpen(tree, [{ x: 640, y: 500, width: 100 }], 100);
  assert.ok(edge > 0 && edge <= 1);
});

test('a shadow reaches as far as the thing is tall and the sun is low', () => {
  assert.equal(shadowReach(0, 2, 100), 0);
  assert.ok(shadowReach(2, 2, 100) > shadowReach(1, 2, 100));
  assert.ok(shadowReach(1, 2.5, 100) > shadowReach(1, 0.4, 100));
});

test('a light throws a decoration\'s shadow away from it: longer the nearer the light and the taller the thing, fading with distance', async () => {
  const { lampShadow } = await import('../../../scripts/engines/motion/decorations.mjs');
  const boulder = { x: 500, y: 500 }, torch = (x, y, extra = {}) => ({ x, y, radius: 600, strength: 1, ...extra });
  const s = lampShadow(boulder, 1.2, torch(300, 500));
  assert.ok(s && Math.abs(s.angle) < 1e-9, 'away from the light (east)');
  assert.ok(lampShadow(boulder, 1.2, torch(500, 300)).angle > 1.5, 'a light to the north throws it south');
  assert.ok(lampShadow({ x: 500, y: 500 }, 0.3, torch(300, 500)).reach < s.reach, 'a low thing throws a short shadow');
  assert.ok(lampShadow(boulder, 1.2, torch(480, 500)).reach >= 1.2 * 100 * 0.9 - 1e-9, 'a light right beside a tall rock still throws a long shadow');
  assert.ok(lampShadow(boulder, 1.2, torch(100, 500)).alpha < s.alpha, 'fainter further away');
  assert.ok(lampShadow(boulder, 3, torch(400, 500)).reach <= 600 - 100 + 1e-9, 'never past the light\'s reach');
  assert.equal(lampShadow(boulder, 1.2, torch(-200, 500)), null, 'out of its reach');
  assert.equal(lampShadow(boulder, 1.2, torch(300, 500, { strength: 0 })), null, 'a light lost in daylight');
  assert.equal(lampShadow(boulder, 0, torch(300, 500)), null, 'flat things none');
});

test('lights are wired to the decorations a few times a second, weighed against the sky', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /decorations\.lamps\(shadowsOffHere\(\) \? \[\] : floorLightSources\(\)\)/);
});

test('solid things only turn a little; crowns and plants any way', () => {
  assert.equal(turnOf({ kind: 'oak', turn: 2 }), 2);
  assert.ok(Math.abs(turnOf({ kind: 'crate', turn: 2 })) < 1);
});

test('only the cloth stirs in the wind: a masked ripple over the fabric, the frame and wares left still; none in a calm', async () => {
  const { clothMotion, CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  const { DECOR_KINDS } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  assert.ok(DECOR_KINDS.marketStall.cloth && DECOR_KINDS.tent.cloth && !DECOR_KINDS.crate.cloth);
  const d = { seed: 42 };
  assert.equal(clothMotion(d, { strength: 0 }, 3).push, 0);
  const most = (strength) => Math.max(...Array.from({ length: 200 }, (_, i) => clothMotion(d, { strength, angle: 0.5 }, i * 0.05).push));
  assert.ok(most(0.3) > 0 && most(0.3) < most(1) && most(1) <= 1);
  // In the picture's own frame: a stall turned with the wind feels it straight along.
  const m = clothMotion(d, { strength: 0.5, angle: 1 }, 1, 1); assert.ok(Math.abs(m.dir[0] - 1) < 1e-9 && Math.abs(m.dir[1]) < 1e-9);
  // The shader moves only what the mask calls cloth (smoothstep on the mask), never the whole picture.
  assert.match(CLOTH_SHADER_SOURCES[0][1], /float m = mix\(smoothstep\(0\.5, 1\.0, texture2D\(uCloth, vUv\)\.a\),/);
  assert.match(CLOTH_SHADER_SOURCES[0][1], /\* wave \* uPush\) \* m \* uAmp\)/);
});

test('wet decorations go darker while the ground is soaked, leafy crowns and water seeing to their own', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/decor-paint.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(o\.wet > 0 && !k\.water && !k\.tree && kind !== 'bush'\)/);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /decorations\.wind\(\{ strength: undergroundScene\(\) \? 0 : skyWindNow, angle: skyWindAngle \}\)/);
});

test('decorations follow the ground as snow builds or melts, rain soaks in or dries, or the season turns, not only when the clock jumps', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const decorWeatherNow = \(\) => \{ try \{ const g = groundOf\(\)\.now; return `\$\{snowCoverOn\(\) \? Math\.round\(\(g\.snow \?\? 0\) \* 20\) : 0\}/);
  assert.match(main, /decorWeatherAt \+= seconds; if \(decorWeatherAt >= 1\) \{ decorWeatherAt = 0; const key = decorWeatherNow\(\); if \(key !== decorWeatherKey\) \{ decorWeatherKey = key; try \{ syncDecorations\(\);/);
});

test('plants and tree crowns sway in the wind from their middle out (the trunk and root stay put); nothing sways underground', async () => {
  const { PLANTS, CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  for (const id of ['bush', 'fern', 'grass', 'reeds', 'flowers', 'agave']) assert.ok(PLANTS.has(id));
  assert.ok(!PLANTS.has('crate') && !PLANTS.has('rock'));
  assert.match(CLOTH_SHADER_SOURCES[0][1], /smoothstep\(0\.06, 0\.48, length\(vUv - 0\.5\)\), uRadial\)/);
  const src = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(src, /where !== 'cave' && PIXI\.Mesh \? clothMesh\(pic, d, scale, 'crown'\)/);
  assert.match(src, /PLANTS\.has\(d\.kind\) && where !== 'cave' && PIXI\.Mesh/);
});

test('a stronger wind sways things further, hardly faster', async () => {
  const { CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  assert.match(CLOTH_SHADER_SOURCES[0][1], /time \* \(1\.4 \+ 0\.5 \* uPush\)/);
  assert.match(CLOTH_SHADER_SOURCES[0][1], /\* wave \* uPush\) \* m \* uAmp\)/);
});

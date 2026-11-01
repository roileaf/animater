import test from 'node:test';
import assert from 'node:assert/strict';
import { lightAround, litKey, litPreset, PLAIN_LIGHT } from '../../../scripts/engines/playback/surrounding-light.mjs';
import { presetFilters } from '../../../scripts/engines/tokenshade/engine.mjs';

const at = { x: 0, y: 0 };

test('a creature near a light takes its colour, lit from the side facing it; nothing far off or in daylight', () => {
  const torch = { x: 100, y: 0, radius: 400, color: 0xff6020, alpha: 0.5 };
  const lit = lightAround(at, [torch], 1);
  assert.equal(lit.color, 0xff6020);
  assert.ok(lit.strength > 0.5);
  assert.equal(Math.round(lit.angle), 0, 'the light is to the east');
  assert.equal(lightAround(at, [{ ...torch, x: 500 }], 1), null, 'out of reach');
  assert.equal(lightAround(at, [torch], 0), null, 'full daylight');
  assert.equal(lightAround(at, [{ ...torch, color: null }], 1).color, PLAIN_LIGHT, 'a plain light is warm');
  const between = lightAround(at, [torch, { ...torch, x: -100 }], 1);
  assert.equal(between.angle, null, 'lights on both sides: no lit side');
  const north = lightAround(at, [{ ...torch, x: 0, y: -150, color: 0x3060ff }, { ...torch, x: 0, y: -150, color: 0xff0000 }], 1);
  assert.equal(Math.round(north.angle), -90);
});

test('small changes keep the look; the look tints and rims and builds as Tokenshade filters', () => {
  const a = lightAround(at, [{ x: 100, y: 0, radius: 400, color: 0xff6020, alpha: 0.5 }], 1);
  const b = lightAround({ x: 3, y: 2 }, [{ x: 100, y: 0, radius: 400, color: 0xff6421, alpha: 0.5 }], 1);
  assert.equal(litKey(a), litKey(b));
  assert.equal(litKey(null), null);
  const preset = litPreset(a);
  assert.deepEqual(preset.params.map((p) => p.filterType), ['adjustment', 'bevel']);
  assert.ok(preset.params[0].red > 1 && preset.params[0].blue < 1, 'warm tint');
  assert.equal(preset.params[1].rotation, 180, 'the bevel points from the light toward the creature, lighting the side facing it');
  assert.equal(litPreset({ ...a, angle: null }).params.length, 1);
  const PIXI = { Filter: class { constructor(v, f, u) { this.uniforms = u; this.enabled = true; } destroy() {} }, Texture: { EMPTY: {} } };
  assert.equal(presetFilters(PIXI, preset, { tokenSize: { width: 100, height: 100 } }).length, 2);
});

test('the light reaching a point says how high and how far it is, weighted by strength', () => {
  const one = lightAround({ x: 0, y: 0 }, [{ x: 100, y: 0, radius: 400, alpha: 0.5, elevation: 30 }], 1);
  assert.equal(one.elevation, 30);
  assert.equal(one.distance, 100);
  const two = lightAround({ x: 0, y: 0 }, [{ x: 100, y: 0, radius: 400, alpha: 0.5, elevation: 30 }, { x: -300, y: 0, radius: 400, alpha: 0.5 }], 1);
  assert.ok(two.elevation > 15 && two.elevation < 30, 'nearer counts more');
});

test('brightness: full inside a light bright radius, fading across its dim light', () => {
  const at = (x) => lightAround({ x: 0, y: 0 }, [{ x, y: 0, radius: 400, bright: 200, alpha: 0.5 }], 1)?.brightness;
  assert.equal(at(100), 1);
  assert.ok(at(250) < 0.5 && at(250) > at(300));
});

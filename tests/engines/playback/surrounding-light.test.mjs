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

test('a light of faint colour (PF2e Light spell, colour intensity 0.05) still lights the creature fully: it shines, it barely tints', () => {
  const spell = { x: 30, y: -30, radius: 850, bright: 450, color: 0xe7f3f1, alpha: 0.05, elevation: 2.5 };
  const lit = lightAround(at, [spell], 1);
  assert.ok(lit.shine > 0.9, 'as bright as any light there');
  assert.ok(lit.strength < 0.2, 'its colour barely shows');
  assert.equal(litKey({ ...lit, strength: 0.05 }), null, 'too faint a colour to re-light the creature');
  assert.equal(Math.round(lit.angle), -45);
  assert.equal(lightAround(at, [{ ...spell, x: 900 }], 1), null, 'out of reach');
});

test('how bright a light shines: full in its bright radius, fading across its dim light as its attenuation says, scaled by its luminosity', () => {
  const lamp = { x: 100, y: 0, radius: 400, bright: 200, color: 0xffffff, alpha: 0.5 };
  const shine = (l, x = 100) => lightAround(at, [{ ...lamp, ...l, x }], 1)?.shine ?? 0;
  assert.equal(shine({}), 1, 'in its bright light');
  assert.ok(shine({}, 300) < 0.5 && shine({}, 300) > 0, 'in its dim light, less');
  assert.ok(shine({ attenuation: 0 }, 300) > shine({ attenuation: 1 }, 300), 'a harder edge holds its light further out');
  assert.equal(shine({ bright: 0 }), 0.5 * (1 - 100 / 400) ** 1.5, 'a dim light alone');
  // Luminosity 0.5 is Foundry's plain light: brighter above it, dimmer below, none when it darkens (below 0).
  assert.ok(shine({ luminosity: 0 }, 300) < shine({ luminosity: 0.5 }, 300) && shine({ luminosity: 0.5 }, 300) < shine({ luminosity: 1 }, 300));
  assert.ok(shine({ luminosity: 0 }) > 0, 'luminosity 0 still lights');
  assert.equal(lightAround(at, [{ ...lamp, luminosity: -0.5 }], 1), null, 'a darkening light lights nothing');
  // Its colour intensity tints, never dims.
  const faint = lightAround(at, [{ ...lamp, alpha: 0.05 }], 1);
  assert.equal(faint.shine, 1);
  assert.ok(faint.strength < 0.2);
});

test('a light flickers as Foundry animates it: a torch by its flame, a pulse by its wave, the rest steady', async () => {
  const { lightFlicker } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  // Torch and flame: Foundry's brightnessPulse, 0.55 to 1 (more at a torch's higher intensity), its middle steady.
  assert.ok(lightFlicker('torch', {}, { brightnessPulse: 0.55 }) < 0.8);
  assert.ok(lightFlicker('flame', {}, { brightnessPulse: 1 }) > 1.2);
  assert.ok(Math.abs(lightFlicker('torch', {}, { brightnessPulse: 0.775 }) - 1) < 1e-9);
  assert.ok(lightFlicker('torch', {}, { brightnessPulse: 9 }) <= 1.4, 'never past bounds');
  // Pulse: full at its crest, down by its intensity at its trough.
  assert.equal(lightFlicker('pulse', { intensity: 10, time: 0 }, {}), 1);
  assert.equal(lightFlicker('pulse', { intensity: 10, time: Math.PI / 2.5 }, {}), 0.5);
  assert.ok(lightFlicker('pulse', { intensity: 2, time: Math.PI / 2.5 }, {}) > 0.85, 'a gentle pulse, barely');
  // Steady lights, and ones whose animation only moves their colour.
  for (const type of [null, 'fog', 'starlight', 'chroma']) assert.equal(lightFlicker(type, {}, {}), null);
});

test('a flame dances: it sways on the light’s own animation clock, more the fiercer it burns; a pulse only swells', async () => {
  const { lightDance } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  const at = (time, intensity = 5, type = 'torch') => lightDance(type, { time, intensity }, { brightnessPulse: 0.775 });
  const sways = Array.from({ length: 200 }, (_, i) => at(i * 0.05).sway);
  assert.ok(Math.max(...sways) > 0.5 && Math.min(...sways) < -0.5 && sways.every((s) => Math.abs(s) <= 1), 'side to side');
  assert.ok(Math.abs(at(1.3).sway - at(1.31).sway) < 0.1, 'smoothly');
  assert.ok(Math.abs(at(1.3, 2).sway) < Math.abs(at(1.3, 10).sway) || at(1.3, 10).sway === 0);
  assert.equal(at(1.3).brightness, 1);
  assert.deepEqual(lightDance('pulse', { time: 0, intensity: 10 }, {}), { brightness: 1, sway: 0 });
  assert.equal(lightDance('fog', {}, {}), null);
});

test('brightness: full inside a light bright radius, fading across its dim light', () => {
  const at = (x) => lightAround({ x: 0, y: 0 }, [{ x, y: 0, radius: 400, bright: 200, alpha: 0.5 }], 1)?.brightness;
  assert.equal(at(100), 1);
  assert.ok(at(250) < 0.5 && at(250) > at(300));
});

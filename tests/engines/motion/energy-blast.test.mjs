import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BLAST_TYPES, blastType, blastRadius, blastShake, blastSounds, blastFiles, stepSquares, aimSquares, AIM_MOST, AIM_LEAST, blastRipple } from '../../../scripts/engines/motion/energy-blast.mjs';

test('ten kinds of blast, each its own', () => {
  assert.equal(BLAST_TYPES.length, 10);
  assert.equal(new Set(BLAST_TYPES.map((t) => t.id)).size, 10);
  assert.equal(new Set(BLAST_TYPES.map((t) => t.shader)).size, 10);
  assert.equal(blastType('nonsense'), BLAST_TYPES[0]);
  assert.equal(blastType('sonic').name, 'Sonic');
});

test('a big blast reaches twice as far', () => {
  assert.equal(blastRadius(false, 100), 200);
  assert.equal(blastRadius(true, 100), 400);
});

test('it shakes the view by how hard it hits; a big one longer; a psychic one not at all', () => {
  assert.deepEqual(blastShake('psychic'), []);
  assert.ok(blastShake('fire', true).length > blastShake('fire', false).length);
  assert.ok(blastShake('force')[0].scale > blastShake('poison')[0].scale);
  for (const t of BLAST_TYPES) for (const w of blastShake(t.id, true)) assert.ok(w.scale <= 2, t.id);
});

test('every sound it plays is a file Animater ships', () => {
  for (const t of BLAST_TYPES) for (const f of blastFiles(t.id)) assert.ok(existsSync(f.replace('modules/animater/', '')), f);
  assert.ok(blastSounds('fire').some((s) => s.file) && blastSounds('fire').some((s) => s.thud));
  assert.equal(blastSounds('psychic').some((s) => s.thud), false, 'the mind makes no thud');
  assert.ok(blastSounds('force', { big: true }).filter((s) => s.thud).length === 2, 'a big one lands twice');
});

test('a blast\'s moving air is cut to the blast, never a whole long recording', () => {
  for (const t of BLAST_TYPES) for (const big of [false, true]) for (const s of blastSounds(t.id, { big })) if (s.wind) assert.ok(s.holds + s.fades <= 2500, `${t.id} ${s.holds + s.fades}`);
});

test('the wheel sizes it in half squares, within reason; Shift doubles it while held', () => {
  assert.equal(stepSquares(2, 1), 2.5);
  assert.equal(stepSquares(2, -1), 1.5);
  assert.equal(stepSquares(AIM_LEAST, -1), AIM_LEAST);
  assert.equal(stepSquares(AIM_MOST, 1), AIM_MOST);
  assert.equal(aimSquares(3, true), 6);
  assert.equal(aimSquares(3, false), 3);
  assert.equal(aimSquares(8, true), AIM_MOST, 'never past the most');
});

test('a blast\'s ring bends the whole map past its reach, harder for force; a cloud has none', () => {
  const fire = blastRipple({ x: 1, y: 2, radius: 200, kind: 'fire', grid: 100 });
  assert.equal(fire.kind, 'shock');
  assert.ok(fire.radius > 200, 'past its reach');
  assert.ok(fire.lengthMs > 0 && fire.band > 0);
  assert.deepEqual(fire.at, { x: 1, y: 2 });
  assert.ok(blastRipple({ radius: 200, kind: 'force', grid: 100 }).strength > fire.strength);
  assert.equal(blastRipple({ radius: 200, kind: 'poison', grid: 100 }), null);
  assert.equal(blastRipple({ radius: 200, kind: 'fire', grid: 100, level: 'L1' }).level, 'L1');
});

test('its shader is drawn once ahead of the first blast, once only, and a failure there breaks nothing', async () => {
  const { createEnergyBlasts } = await import('../../../scripts/engines/motion/energy-blast.mjs');
  class Thing { addAttribute() { return this; } addIndex() { return this; } destroy() {} }
  const PIXI = { Geometry: Thing, Mesh: class { constructor(g, s) { this.shader = s; } destroy() {} }, Shader: { from: (v, f, u) => ({ uniforms: u }) }, RenderTexture: { create: () => new Thing() }, Texture: { WHITE: {} } };
  let drawn = 0;
  const blasts = createEnergyBlasts({ PIXI, floor: () => null, above: () => null, glow: () => null, map: () => null, render: () => { drawn++; } });
  blasts.warm(); blasts.warm();
  assert.equal(drawn, 1);
  const failing = createEnergyBlasts({ PIXI, floor: () => null, above: () => null, glow: () => null, map: () => null, render: () => { throw new Error('no context'); } });
  assert.doesNotThrow(() => failing.warm());
});

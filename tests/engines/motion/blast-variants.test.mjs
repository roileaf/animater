import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanVariant, cleanVariants, variantLook, variantReaction, variantShake, variantSound, variantEditorHtml, VARIANT_REACTIONS } from '../../../scripts/engines/motion/blast-variants.mjs';
import { blastShake } from '../../../scripts/engines/motion/energy-blast.mjs';

// Discord (y_deda_povis): their own Energy Blasts. Roi: on creatures any Tokenshade preset; sound from a file or Animater's own.
test('a blast of your own is a kind it is built on, with its own name and colours; anything broken is made safe', () => {
  const v = cleanVariant({ id: 'x1', name: 'Hellfire', base: 'fire', a: '#1a0006', b: '#ff2a2a', squares: 4, reaction: 'preset', preset: 'Burning', presetLibrary: 'tokenshade', sound: 'file', file: 'modules/animater/assets/sounds/x.ogg', shake: 'heavy', melts: true });
  assert.equal(v.name, 'Hellfire'); assert.equal(v.base, 'fire'); assert.equal(v.squares, 4);
  const bad = cleanVariant({ name: '', base: 'nosuch', a: 'red', squares: 99, reaction: 'explode', sound: 'file', file: 'javascript:alert(1)', shake: 'lots' });
  assert.equal(bad.base, 'fire'); assert.equal(bad.a, null); assert.equal(bad.squares, 10); assert.equal(bad.reaction, 'auto'); assert.equal(bad.file, ''); assert.equal(bad.shake, 'auto');
  assert.ok(bad.name.length > 0); assert.match(bad.id, /^[a-z0-9-]+$/);
  assert.equal(cleanVariants([v, v, { id: 'x2', name: 'B' }]).length, 2, 'one each, by id');
});

test('its look: its base kind\'s movement, recoloured all over in its colours', () => {
  const look = variantLook(cleanVariant({ base: 'cold', a: '#ff0000', b: '#00ff00' }));
  assert.equal(look.kind, 'cold'); assert.deepEqual(look.a, [1, 0, 0]); assert.deepEqual(look.b, [0, 1, 0]); assert.equal(look.recolor, 1);
  const plain = variantLook(cleanVariant({ base: 'acid' }));
  assert.equal(plain.recolor, 0, 'colours left alone: the kind as it is');
});

test('on creatures: as its base, none, one of the reactions, or any Tokenshade preset', () => {
  assert.deepEqual(variantReaction(cleanVariant({ base: 'fire', reaction: 'auto' })), { reaction: 'burn', preset: null });
  assert.deepEqual(variantReaction(cleanVariant({ base: 'fire', reaction: 'none' })), { reaction: null, preset: null });
  assert.deepEqual(variantReaction(cleanVariant({ base: 'fire', reaction: 'shove' })), { reaction: 'shove', preset: null });
  assert.deepEqual(variantReaction(cleanVariant({ base: 'fire', reaction: 'preset', preset: 'Spectral', presetLibrary: 'tokenshade' })), { reaction: null, preset: { name: 'Spectral', library: 'tokenshade' } });
  assert.ok(VARIANT_REACTIONS.preset);
});

test('its sound: as any kind, none, or a file; its shake as its base, none, light or heavy', () => {
  assert.deepEqual(variantSound(cleanVariant({ base: 'fire', sound: 'auto' })), { kind: 'fire', file: null });
  assert.deepEqual(variantSound(cleanVariant({ base: 'fire', sound: 'kind:void' })), { kind: 'void', file: null });
  assert.deepEqual(variantSound(cleanVariant({ base: 'fire', sound: 'none' })), { kind: null, file: null });
  assert.deepEqual(variantSound(cleanVariant({ base: 'fire', sound: 'file', file: 'sounds/boom.ogg' })), { kind: null, file: 'sounds/boom.ogg' });
  assert.deepEqual(variantShake(cleanVariant({ base: 'force', shake: 'auto' }), true), blastShake('force', true));
  assert.deepEqual(variantShake(cleanVariant({ base: 'force', shake: 'none' }), true), []);
  assert.ok(variantShake(cleanVariant({ shake: 'heavy' }), false)[0].scale > variantShake(cleanVariant({ shake: 'light' }), false)[0].scale);
});

test('the editor has every field, presets from Tokenshade listed, a file picker for the sound', () => {
  const html = variantEditorHtml(cleanVariant({ name: 'Hellfire', reaction: 'preset', preset: 'Burning', presetLibrary: 'tokenshade' }), { presets: [{ name: 'Burning', library: 'tokenshade' }, { name: 'Glow', library: 'tmfx-main' }] });
  for (const field of ['name', 'base', 'a', 'b', 'squares', 'reaction', 'preset', 'sound', 'file', 'shake', 'melts']) assert.match(html, new RegExp(`name="${field}"`), field);
  assert.match(html, /<option value="tokenshade\|Burning" selected>/); assert.match(html, /data-action="pickFile"/);
  assert.match(html, /data-swatch style="--a:#[0-9a-f]{6};--b:#[0-9a-f]{6}"/, 'a preview of its colours at the top');
  assert.match(variantEditorHtml(cleanVariant({}), { presets: [] }), /Tokenshade is not on/);
});

test('main: the picker lists your blasts, the editor saves them for the world, and the blast carries its own look to every screen', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("blastVariants"/);
  assert.match(main, /const blast = \{ x: Math\.round\(p\.x\), y: Math\.round\(p\.y\), radius, kind, seed: [^}]*variant/);
  assert.match(main, /variantReaction\(variant\)/);
  const blast = readFileSync(new URL('../../../scripts/engines/motion/energy-blast.mjs', import.meta.url), 'utf8');
  assert.match(blast, /uniform float uRecolor;/);
});

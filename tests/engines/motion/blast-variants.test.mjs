import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blastAnimFamilies, cleanVariant, cleanVariants, variantLook, variantReaction, variantShake, variantSound, variantEditorHtml, VARIANT_REACTIONS } from '../../../scripts/engines/motion/blast-variants.mjs';
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
  for (const field of ['name', 'base', 'look', 'anim', 'squares', 'reaction', 'preset', 'sound', 'file', 'shake', 'melts']) assert.match(html, new RegExp(`name="${field}"`), field);
  assert.match(html, /<option value="tokenshade\|Burning" selected>/); assert.match(html, /data-action="pickFile"/);
  assert.match(html, /data-anim-preview/, 'a preview of its animation at the top');
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

// Roi: not two colours — let the GM pick an animation for their blast, in Animater's own asset browser.
test('a blast of your own looks as Animater draws its kind, or plays a JB2A animation of the GM\'s choosing', () => {
  assert.equal(cleanVariant({}).look, 'own');
  const v = cleanVariant({ look: 'jb2a', anim: 'jb2a.explosion.01.orange' });
  assert.equal(v.look, 'jb2a'); assert.equal(v.anim, 'jb2a.explosion.01.orange');
  assert.equal(cleanVariant({ look: 'jb2a', anim: 'javascript:alert(1)' }).anim, '', 'only a key or a file');
  assert.equal(cleanVariant({ look: 'jb2a', anim: 'modules/x/boom.webm' }).anim, 'modules/x/boom.webm', 'any visual file the browser offers');
  assert.equal(cleanVariant({ look: 'jb2a', anim: 'sounds/boom.ogg' }).anim, '', 'never a sound');
  assert.equal(cleanVariant({ look: 'other' }).look, 'own');
  assert.equal(cleanVariant({ look: 'own', anim: 'jb2a.explosion.01.orange' }).anim, '', 'no animation kept for its own look');
});

test('the JB2A explosions and impacts installed, each effect with its colours', () => {
  const catalog = [
    { key: 'jb2a.explosion.01.orange', type: 'animation', color: 'orange', file: 'a/Explosion_01_Orange.webm' },
    { key: 'jb2a.explosion.01.blue', type: 'animation', color: 'blue', file: 'a/Explosion_01_Blue.webm' },
    { key: 'jb2a.explosion.03.regular.red', type: 'animation', color: 'red', file: 'a/Explosion_03.webm' },
    { key: 'jb2a.impact.001.white', type: 'animation', color: 'white', file: 'b/Impact.webm' },
    { key: 'jb2a.magic_missile.purple', type: 'animation', color: 'purple', file: 'c.webm' },
    { key: 'jb2a.explosion.01.orange.thumb', type: 'image', color: 'orange', file: 'x.webp' },
  ];
  const fams = blastAnimFamilies(catalog);
  assert.deepEqual(fams.map((f) => f.label), ['Explosion 01', 'Explosion 03', 'Impact 001']);
  assert.deepEqual(fams[0].variants.map((v) => v.key), ['jb2a.explosion.01.blue', 'jb2a.explosion.01.orange']);
  assert.equal(fams[0].variants[1].file, 'a/Explosion_01_Orange.webm');
  assert.equal(fams[1].variants[0].label, 'Regular red', 'the rest of its key, read');
  assert.deepEqual(blastAnimFamilies([]), []);
});

test('the editor: Animater\'s own or an animation chosen in the asset browser, no colour pickers', () => {
  const animOf = (ref) => (ref === 'jb2a.explosion.01.orange' ? { label: 'Explosion 01 Orange', file: 'a.webm' } : null);
  const html = variantEditorHtml(cleanVariant({ look: 'jb2a', anim: 'jb2a.explosion.01.orange' }), { presets: [], animOf });
  assert.match(html, /name="look"/); assert.match(html, /<input type="hidden" name="anim" value="jb2a.explosion.01.orange">/);
  assert.match(html, /data-action="chooseAnim"/, 'a button that opens the asset browser'); assert.match(html, /Explosion 01 Orange/);
  assert.match(html, /data-anim-preview[^>]*src="a.webm"/); assert.doesNotMatch(html, /<select name="anim"/, 'no list in the form');
  assert.doesNotMatch(html, /type="color"/, 'no colour pickers');
  assert.match(variantEditorHtml(cleanVariant({ look: 'jb2a' }), { presets: [] }), /None chosen yet/);
});

test('main opens Animater\'s asset browser from the editor, and the choice comes back to the form', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /data-action="chooseAnim"/); assert.match(main, /chooseAnimation\(\{ label/);
  assert.match(main, /app\.workspace\.chooseMedia\(/);
  const ws = readFileSync(new URL('../../../scripts/ui/workspace.mjs', import.meta.url), 'utf8');
  assert.match(ws, /chooseMedia\(options\) \{/);
});

test('main plays the chosen animation where the blast goes off, on each screen, with its kind\'s floor mark under it', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /variant\?\.look === "jb2a"/);
  assert.match(main, /\.play\(\{ local: true \}\)/);
  assert.match(main, /floorOnly: !!anim/);
  const blast = readFileSync(new URL('../../../scripts/engines/motion/energy-blast.mjs', import.meta.url), 'utf8');
  assert.match(blast, /floorOnly/);
});

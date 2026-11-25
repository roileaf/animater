import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flyoverPanelHtml, flyoverAsk, flyoverNote, flyoverShows, flyoverPlaceHint, flyoverAimHint, shapeGlyph, FLYOVER_SIZES, SHAPE_NAMES, voiceForShape } from '../../scripts/ui/flyover-panel.mjs';
import { momentsPanelHtml } from '../../scripts/ui/moments-panel.mjs';
import { FLYOVER_SHAPES, flyoverCall } from '../../scripts/engines/motion/flyover.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');

const html = flyoverPanelHtml({ creatures: [{ uuid: 'Actor.a', name: 'Adult Red <Dragon>' }], voices: [['dragon', 'Dragon'], ['bird', 'Bird']] });

test('the dialog: whose shadow, how it passes, what is heard, and two ways to fly it', () => {
  for (const part of ['data-fo-thumb', 'data-fo-source="actor"', 'data-fo-source="shape"', 'data-fo-creature', 'data-fo-note', 'data-fo-faces="down"', 'data-fo-faces="right"', 'data-fo-spread',
    'data-fo-size="large"', 'data-fo-size="gargantuan"', 'data-fo-height="low"', 'data-fo-height="high"', 'data-fo-pass="straight"', 'data-fo-pass="circle"', 'data-fo-pass="land"', 'data-fo-place',
    'data-fo-wings', 'data-fo-cry', 'data-fo-voice', 'data-fo-try', 'data-fo-send', 'data-fo-close']) assert.ok(html.includes(part), part);
  for (const shape of FLYOVER_SHAPES) { assert.ok(html.includes(`data-fo-shape="${shape}"`), shape); assert.ok(html.includes(`>${SHAPE_NAMES[shape]}<`)); }
  assert.ok(html.includes('Adult Red &lt;Dragon&gt;'), 'a name is never trusted as HTML');
  assert.ok(html.includes('<option value="own"') && html.includes('<option value="dragon">Dragon</option>'));
  assert.match(html, /Put its token where it lands/);
  assert.match(html, /Try it here[\s\S]*Send to everyone/);
});

test('each shape\'s tile is that shape, drawn from the same outlines the shadow uses', () => {
  for (const shape of FLYOVER_SHAPES) { const svg = shapeGlyph(shape); assert.match(svg, /^<svg viewBox="[-\d. ]+"[^>]*>(<polygon points="[-\d., ]+"\/>)+<\/svg>$/); }
  assert.notEqual(shapeGlyph('bird'), shapeGlyph('bat'));
});

const state = { source: 'actor', picked: null, faces: 'down', spread: true, size: 'gargantuan', height: 'low', pass: 'land', place: true, wings: true, cry: true, voice: 'own' };
const dragon = { uuid: 'Actor.a', squares: 3, artScale: 1.5, art: 'tokens/dragon.webm', shape: 'dragon' };
const portrait = { uuid: 'Actor.b', squares: 4, artScale: 1, art: null, shape: 'bat' };
const aim = { x: 500, y: 600, angle: 1 };

test('what is asked for: a creature with art of its own casts it at its own size and lands as its token', () => {
  const ask = flyoverAsk(state, dragon, aim);
  assert.deepEqual(ask, { x: 500, y: 600, angle: 1, squares: 3, artScale: 1.5, art: 'tokens/dragon.webm', shape: 'dragon', faces: 'down', spread: true, height: 'low', pass: 'land', wings: true, voice: 'Actor.a', actor: 'Actor.a', turn: true });
  assert.ok(flyoverCall(ask), 'and the engine takes it');
});

test('a creature with no outline casts the shape that suits it, or the one picked, and still lands as its token', () => {
  const suited = flyoverAsk(state, portrait, aim);
  assert.deepEqual({ art: suited.art, shape: suited.shape, squares: suited.squares, actor: suited.actor }, { art: null, shape: 'bat', squares: 4, actor: 'Actor.b' });
  const picked = flyoverAsk({ ...state, picked: 'bird' }, dragon, aim);
  assert.deepEqual({ art: picked.art, shape: picked.shape, actor: picked.actor, artScale: picked.artScale }, { art: null, shape: 'bird', actor: 'Actor.a', artScale: 1 }, 'a picked shape is drawn instead of its art');
});

test('a shape alone goes by the chosen size, has no token to put down and no voice of its own', () => {
  const ask = flyoverAsk({ ...state, source: 'shape', picked: 'insect' }, dragon, aim);
  assert.deepEqual({ squares: ask.squares, art: ask.art, shape: ask.shape, actor: ask.actor, voice: ask.voice }, { squares: FLYOVER_SIZES.gargantuan, art: null, shape: 'insect', actor: null, voice: null });
  assert.equal(flyoverAsk({ ...state, source: 'shape', picked: null, voice: 'bird' }, null, aim).voice, 'group:bird');
  assert.equal(flyoverAsk({ ...state, source: 'shape', picked: null }, null, aim).shape, 'dragon');
});

test('no token unless it comes down with the tick on; no cry with that off', () => {
  assert.equal(flyoverAsk({ ...state, pass: 'straight' }, dragon, aim).actor, null);
  assert.equal(flyoverAsk({ ...state, place: false }, dragon, aim).actor, null);
  assert.equal(flyoverAsk({ ...state, cry: false }, dragon, aim).voice, null);
  assert.equal(flyoverAsk({ ...state, voice: 'dragon' }, dragon, aim).voice, 'group:dragon');
});

test('a try puts its token down too: only the shadow and the sounds are kept to this screen', () => {
  assert.match(flyoverPlaceHint(state, dragon), /Put down and shown as it lands, on a try as well/);
  assert.match(html, /data-fo-try title="Only you see and hear it\. If it lands, its token is still put down for everyone"/);
  assert.match(main, /return flyoverShow\(call, \{ place: asked\?\.place !== false \}\);/);
  assert.ok(!/place: asked\?\.here !== true/.test(main), 'a try is not what leaves the token alone');
  assert.match(flyoverPlaceHint({ ...state, place: false }, dragon), /nothing is put down/);
});

test('only the rows that mean something are shown', () => {
  const own = flyoverShows(state, dragon);
  assert.deepEqual(own, { creature: true, faces: true, spread: true, size: false, place: true, placeHint: true, voice: true });
  assert.deepEqual(flyoverShows({ ...state, source: 'shape', picked: 'wingless', pass: 'straight', cry: false }, null), { creature: false, faces: false, spread: false, size: true, place: false, placeHint: false, voice: false });
  assert.equal(flyoverShows({ ...state, source: 'shape', picked: 'bird' }, null).placeHint, true, 'coming down with no creature: it says why no token');
  assert.equal(flyoverShows(state, portrait).faces, false, 'a drawn shape has no art to face');
});

test('the note says whose shape it will be, and why', () => {
  assert.match(flyoverNote(state, dragon), /Its own art/);
  assert.match(flyoverNote(state, portrait), /no outline of its own[\s\S]*Bat wings/);
  assert.match(flyoverNote({ ...state, picked: 'bird' }, dragon), /Drawn[\s\S]*Bird/);
  assert.match(flyoverNote(state, null), /Pick a creature|drag/i);
  assert.equal(voiceForShape('bat', ['dragon', 'bat']), 'bat');
  assert.equal(voiceForShape('insect', ['dragon']), 'dragon', 'falls back to one that is there');
});

// On Roi's world every token is in a dynamic ring, and the Blue Dragon's subject is the whole dragon cut out: refused
// for being ringed, it cast the drawn dragon instead of its own shape (2026-11-25).
test('a ringed token casts its own cut-out subject, at the subject\'s own scale, facing as illustrations do', () => {
  const read = main.slice(main.indexOf('const readFlyoverCreature'), main.indexOf('const aimFlyover'));
  assert.match(read, /ringed = proto\?\.ring\?\.enabled === true, src = \(ringed \? proto\?\.ring\?\.subject\?\.texture : null\) \|\| proto\?\.texture\?\.src \|\| null;/);
  assert.ok(!/ring\?\.enabled !== true \? await load/.test(read), 'being ringed no longer rules its art out');
  assert.match(read, /if \(element && wide && tall && artShare\(element, wide, tall\) < 0\.7\) art = src;/, 'what rules it out is having no outline');
  assert.match(read, /Number\(ringed \? proto\?\.ring\?\.subject\?\.scale \?\? proto\?\.texture\?\.scaleX : proto\?\.texture\?\.scaleX\)/);
  assert.match(read, /faces: ringed \? "right" : "down"/);
  assert.match(main, /if \(creature\?\.art\) \{ state\.faces = creature\.faces;/);
});

// Roi's Blue Dragon is an illustration drawn from the side. Turned to its heading as a top-down token is, it landed
// standing on its nose (2026-11-25). Its shadow may head the way it flies; the token itself stays as it was drawn.
test('an illustrated token is not turned when it lands; a top-down one is', () => {
  assert.equal(flyoverAsk(state, dragon, aim).turn, true, 'drawn from above: it faces the way it flew');
  assert.equal(flyoverAsk(state, { ...dragon, turns: false }, aim).turn, false, 'an illustration stays upright');
  assert.equal(flyoverAsk(state, portrait, aim).turn, false, 'and so does one that casts a drawn shape');
  assert.equal(flyoverCall({ x: 1, y: 2 }).turn, true);
  assert.equal(flyoverCall({ x: 1, y: 2, turn: false }).turn, false);
  assert.match(main, /turns: !ringed/);
  assert.match(main, /const turn = call\.art && call\.turn && proto\?\.lockRotation !== true \? \{ rotation: tokenRotation\(call\) \} : \{\};/);
});

// Roi, 2026-11-25: "can the landing be at the end of the arrow rather than the start?"
test('a landing is aimed by its arrow\'s tip: where it is let go is where it comes down', () => {
  assert.match(main, /\{ atTip: state\.pass === "land" \}\);/);
  assert.match(main, /const tip = atTip \? \(dragged \? to : p\) : /, 'dragged, the tip is where the pointer is; a click alone, where it was pressed');
  assert.match(main, /spot = atTip \? tip : p;/, 'the others still cross where it was pressed');
  assert.match(main, /const \{ angle, spot \} = arrow\(from, at\(e\)\); from = null; flyoverAngle = angle; done\(\); fire\(\{ x: spot\.x, y: spot\.y, angle \}\);/);
  assert.match(flyoverAimHint({ pass: 'land' }), /drag to where it lands\. The arrow's tip is the landing/);
  assert.match(flyoverAimHint({ pass: 'straight' }), /click the map where it crosses and drag the way it flies/);
  assert.match(main, /q\("\[data-fo-hint\]"\)\.textContent = flyoverAimHint\(state\);/);
});

test('opened from the Moments dashboard, GM only, and aimed on the map by a click and a drag', () => {
  assert.match(momentsPanelHtml({}), /data-an-flyover[^>]*>Something flies over/);
  assert.match(main, /if \(event\.target\?\.closest\?\.\("\[data-an-flyover\]"\)\) \{ openFlyoverPanel\(\); return; \}/);
  assert.match(main, /function openFlyoverPanel\(\) \{[\s\S]{0,300}?if \(!game\.user\?\.isGM \|\| !globalThis\.document\?\.createElement\) return;/);
  assert.match(main, /box\.className = "animater animater-moments-panel animater-flyover-panel";/);
  assert.match(main, /const aimFlyover = \(fire, \{ atTip = false \} = \{\}\) => \{[\s\S]{0,2500}?Math\.atan2\(/);
  assert.match(main, /flyoverHere\(\{ \.\.\.flyoverAsk\(state, creature, aim\), here \}\)/);
  assert.match(css, /\.animater-flyover-panel \{/);
});

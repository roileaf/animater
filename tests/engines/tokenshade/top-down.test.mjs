import test from 'node:test';
import assert from 'node:assert/strict';
import { forArt, artPace, paceOf } from '../../../scripts/engines/tokenshade/top-down.mjs';
import { builtinPreset } from '../../../scripts/engines/tokenshade/presets.mjs';
import { TokenFxEngine } from '../../../scripts/engines/tokenshade/engine.mjs';

const types = (preset) => preset.params.map((p) => p.filterType);

// On top-down art nothing is painted on the ground under the creature, nothing runs head to feet, glyphs circle
// over the middle of the body and no drop shadow is added (Animater casts the real one).
test('a condition look takes its top-down form on cut-out art', () => {
  const doom = builtinPreset('Doom');
  assert.ok(types(doom).includes('base'), 'a sigil disc under a portrait');
  assert.ok(!types(forArt(doom, true)).includes('base'), 'none under a top-down creature');
  assert.ok(types(forArt(doom, true)).includes('veins'), 'the rest stays');

  const blinded = forArt(builtinPreset('Blinded'), true);
  assert.equal(blinded.params.find((p) => p.filterType === 'colorGradient').type, 1, 'a veil over the body, not a band at the top');
  assert.equal(forArt(builtinPreset('Dazed'), true).params.find((p) => p.filterType === 'orbit').flat, true, 'stars on a circle seen from above');
  assert.ok(!forArt(builtinPreset('Weary'), true).params.some((p) => p.filterType === 'shadow'), 'no second shadow');

  const prone = forArt(builtinPreset('Prone'), true);
  assert.ok(!prone.params.some((p) => p.filterType === 'transform'), 'not squashed from the bottom (condition-body.mjs lays it flat)');
  assert.ok(!prone.params.some((p) => p.filterType === 'flatten'), 'its art stays itself, not a posterised drawing');
  assert.ok(prone.params.some((p) => p.filterType === 'adjustment' && p.brightness < 1), 'a little dimmer, lying low');
  assert.ok(prone.params.some((p) => p.filterType === 'smoke' && p.ground), 'dust settling round it');
});

test('portrait and ring tokens, and looks whose disc or shadow is the point, are unchanged', () => {
  const doom = builtinPreset('Doom');
  assert.equal(forArt(doom, false), doom);
  for (const name of ['Marker: Ally', 'Grounded Shadow', 'Rune Circle']) {
    const p = builtinPreset(name);
    assert.equal(forArt(p, true), p, name);
  }
});

test('the art is held still, slowed or quickened by its looks; the slowest wins', () => {
  assert.equal(paceOf('Paralyzed'), 0);
  assert.equal(paceOf('Petrified'), 0);
  assert.equal(paceOf('Dying 3'), 0);
  assert.equal(paceOf('Sluggish'), 0.5);
  assert.equal(paceOf('Quickened'), 1.5);
  assert.equal(paceOf('Blinded'), null);
  assert.equal(artPace(['Quickened', 'Sluggish']), 0.5);
  assert.equal(artPace(['Quickened', 'Paralyzed']), 0);
  assert.equal(artPace(['Blinded']), null);
});

test('the engine pauses a token video under a rigid look and lets it play again after', () => {
  const video = { paused: false, playbackRate: 1, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
  const token = { w: 100, h: 100, mesh: { texture: { baseTexture: { resource: { source: video } } }, filters: null } };
  const engine = new TokenFxEngine({ PIXI: null, ticker: () => null, cutOut: () => true });
  // No PIXI here, so no filters: drive the pacing directly with entries as apply makes them.
  const held = { token, name: 'Paralyzed', filters: [] }, slow = { token, name: 'Sluggish', filters: [] };
  engine.entries.add(held); engine.entries.add(slow);
  engine.pace(token);
  assert.equal(video.paused, true, 'held still');
  engine.entries.delete(held); engine.pace(token);
  assert.equal(video.paused, false, 'moves again');
  assert.equal(video.playbackRate, 0.5, 'slowed');
  engine.entries.delete(slow); engine.pace(token);
  assert.equal(video.playbackRate, 1, 'as it was');
});

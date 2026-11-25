// "Something flies over": the GM's dialog (engines/motion/flyover.mjs is what it calls). Whose shadow, how it passes,
// what is heard; then a click on the map and a drag for its direction. Worked out as a clickable mock with Roi first
// (tools/fx-gallery/flyover-dialog-mock.html).
//
// Pure: this builds strings and works out what is asked for. No Foundry, no document, no listeners: main.mjs hangs
// those on it. It wears the Moments dashboard's own look (its classes), so it needs few rules of its own.

import { shapePolygons, FLYOVER_SHAPES } from '../engines/motion/flyover.mjs';

// The sizes a shape with no creature can be flown at, in squares across.
export const FLYOVER_SIZES = Object.freeze({ large: 2, huge: 3, gargantuan: 4 });
export const SHAPE_NAMES = Object.freeze({ dragon: 'Dragon', bird: 'Bird', bat: 'Bat wings', insect: 'Insect', wingless: 'Wingless' });
// The voice families a shape's cry is looked for in, best first (engines/sound/creature-voice.mjs VOICE_FAMILIES).
const SHAPE_VOICES = { dragon: ['dragon'], bird: ['bird', 'raptor', 'beast'], bat: ['bat', 'fiend', 'demon'], insect: ['insect', 'vermin'], wingless: ['serpent', 'worm', 'dragon'] };

const safe = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const segment = (name, options) => `<div class="an-seg" data-fo-seg="${name}">${options.map(([value, label], i) => `<button type="button" data-fo-${name}="${safe(value)}"${i ? '' : ' class="on"'}>${safe(label)}</button>`).join('')}</div>`;

/** A shape as a small picture, heading up the tile: the very outlines its shadow is drawn from. */
export function shapeGlyph(shape) {
  const polygons = shapePolygons(shape, 1, 0).map((p) => { const pts = []; for (let i = 0; i < p.length; i += 2) pts.push(`${p[i + 1].toFixed(2)},${(-p[i]).toFixed(2)}`); return `<polygon points="${pts.join(' ')}"/>`; });
  return `<svg viewBox="-1.5 -1.6 3 3.2" aria-hidden="true">${polygons.join('')}</svg>`;
}

/** The voice family that suits a shape, among those there are (`have`: their ids). */
export const voiceForShape = (shape, have = []) => (SHAPE_VOICES[shape] ?? []).find((v) => have.includes(v)) ?? (have.includes('dragon') ? 'dragon' : have[0] ?? '');

/** The dialog, as HTML. `creatures` [{ uuid, name }]: those it can be the shadow of; `voices` [[id, label]]: the voice families. */
export function flyoverPanelHtml({ creatures = [], voices = [] } = {}) {
  return `<header><span>Something flies over</span><button type="button" data-fo-close title="Close">×</button></header>
  <section class="an-group"><h2>Whose shadow</h2>
    <div class="fo-who"><canvas data-fo-thumb width="192" height="192" title="The shadow it will cast"></canvas>
      <div class="fo-side">${segment('source', [['actor', 'A creature'], ['shape', 'A shape']])}
        <select data-fo-creature title="Tokens you have selected and creatures on this scene. Drag any actor onto this window to add it.">${flyoverCreatureOptions(creatures)}</select>
        <p class="fo-note" data-fo-note></p></div></div>
    <div class="an-tiles fo-shapes">${FLYOVER_SHAPES.map((s) => `<button type="button" class="an-tile" data-fo-shape="${s}" title="Cast this shape">${shapeGlyph(s)}<span>${SHAPE_NAMES[s]}</span></button>`).join('')}</div>
    <div class="an-field" data-fo-faces-row><span>Faces</span>${segment('faces', [['down', 'Down'], ['up', 'Up'], ['left', 'Left'], ['right', 'Right']])}</div>
    <label class="an-check" data-fo-spread-row><input type="checkbox" data-fo-spread checked> Wings spread and beating</label>
  </section>
  <section class="an-group"><h2>How it passes</h2>
    <div class="an-field" data-fo-size-row><span>Size</span>${segment('size', [['large', 'Large'], ['huge', 'Huge'], ['gargantuan', 'Gargantuan']])}</div>
    <div class="an-field"><span>Height</span>${segment('height', [['low', 'Low'], ['high', 'High']])}</div>
    <div class="an-field"><span>Pass</span>${segment('pass', [['straight', 'Across'], ['circle', 'Circles'], ['land', 'Lands']])}</div>
    <label class="an-check" data-fo-place-row hidden><input type="checkbox" data-fo-place checked> Put its token where it lands</label>
    <p class="fo-hint" data-fo-place-hint hidden></p>
  </section>
  <section class="an-group"><h2>Heard</h2>
    <label class="an-check"><input type="checkbox" data-fo-wings checked> Wing beats, and their thud for Huge and up</label>
    <label class="an-check"><input type="checkbox" data-fo-cry checked> Its cry as it passes</label>
    <div class="an-field" data-fo-voice-row><span>Voice</span><select data-fo-voice><option value="own" selected>Its own voice</option>${voices.map(([id, label]) => `<option value="${safe(id)}">${safe(label)}</option>`).join('')}</select></div>
  </section>
  <p class="fo-hint" data-fo-hint>Choose Try or Send, then click the map where it crosses and drag the way it flies.</p>
  <div class="an-feet"><button type="button" data-fo-try title="Only you see and hear it. If it lands, its token is still put down for everyone">Try it here</button><button type="button" class="fo-go" data-fo-send title="Every screen on this scene sees and hears it">Send to everyone</button></div>`;
}
export const flyoverCreatureOptions = (creatures = []) => (creatures.length
  ? creatures.map((c) => `<option value="${safe(c.uuid)}">${safe(c.name)}</option>`).join('')
  : '<option value="">Drag an actor here…</option>');

// Whether its own art is what is cast: a creature is picked, that art has an outline, and no shape was picked over it.
const castsArt = (state, creature) => state.source === 'actor' && !!creature?.art && !state.picked;
const shapeCast = (state, creature) => state.picked ?? (state.source === 'actor' ? creature?.shape : null) ?? 'dragon';

/**
 * What the dialog asks the engine for (pure; the API's flyover call). `state`: its controls ({ source, picked, faces,
 * spread, size, height, pass, place, wings, cry, voice }); `creature`: the one picked, as main.mjs read it
 * ({ uuid, squares, artScale, art (null when it has no outline of its own), shape that suits it }), or null;
 * `aim` { x, y, angle }.
 */
export function flyoverAsk(state, creature, aim) {
  const mine = state.source === 'actor' && creature ? creature : null, art = castsArt(state, creature);
  return {
    x: aim.x, y: aim.y, angle: aim.angle,
    squares: mine ? mine.squares : FLYOVER_SIZES[state.size] ?? FLYOVER_SIZES.huge, artScale: art ? creature.artScale : 1,
    art: art ? creature.art : null, shape: shapeCast(state, creature), faces: state.faces, spread: state.spread,
    height: state.height, pass: state.pass, wings: state.wings,
    voice: !state.cry ? null : state.voice === 'own' ? mine?.uuid ?? null : `group:${state.voice}`,
    actor: mine && state.pass === 'land' && state.place ? mine.uuid : null,
    // Only a token drawn from above is turned to face the way it flew: an illustration stays upright, as it was drawn.
    turn: art && creature.turns !== false,
  };
}

/** Which rows are shown (pure): only those that mean something for what is chosen. Nothing is greyed and left. */
export function flyoverShows(state, creature) {
  const mine = state.source === 'actor' && !!creature, lands = state.pass === 'land', art = castsArt(state, creature);
  return { creature: state.source === 'actor', faces: art, spread: art || shapeCast(state, creature) !== 'wingless', size: !mine, place: lands && mine, placeHint: lands, voice: state.cry === true };
}

/** What the note under the picture says (HTML): whose shape it will be, and why. */
export function flyoverNote(state, creature) {
  const name = `<b>${SHAPE_NAMES[shapeCast(state, creature)]}</b>`;
  if (state.source === 'shape') return `Drawn: ${name}.`;
  if (!creature) return 'Pick a creature, or drag an actor onto this window.';
  if (state.picked) return `Drawn: ${name}, in place of its own art.`;
  if (creature.art) return "Its own art: the shadow is this creature's own shape.";
  return `Its token has no outline of its own (a portrait, or a framed one), so it casts the shape that suits it: ${name}. Pick another below if that is wrong.`;
}

/** What is said under the landing tick (plain text). */
export const flyoverPlaceHint = (state, creature) => (state.source !== 'actor' || !creature ? 'A shape has no token: pick a creature to have one put down.'
  : state.place ? 'Put down and shown as it lands, on a try as well. A token of it already on this scene is brought here instead of a second one.' : 'It lands and nothing is put down.');

/** How to point it at the map (plain text): a landing is aimed by where it comes down, the others by where they cross. */
export const flyoverAimHint = (state) => (state.pass === 'land'
  ? 'Choose Try or Send, then press on the map where it comes from and drag to where it lands. The arrow\'s tip is the landing; a click alone lands it there.'
  : 'Choose Try or Send, then click the map where it crosses and drag the way it flies.');

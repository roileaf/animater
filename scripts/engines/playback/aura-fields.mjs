// Tokenshade auras (the "Aura style" setting): an aura's reach drawn by a shader (tokenshade/aura-field.mjs) on the
// ground under the tokens, in place of its looping footage. One mesh per aura, following its creature every frame;
// the aura's small accent around the creature stays footage. auraLook picks the motif and colour from the aura's
// design, so no aura needs one chosen by hand.
import { AURA_VERTEX, AURA_FRAGMENT, AURA_FIELD_DEFAULTS, auraUniforms } from '../tokenshade/aura-field.mjs';
import { WAVE_FRAGMENT, WAVE_FIELD_DEFAULTS, waveUniforms } from '../tokenshade/wave-field.mjs';
import { SWARM_FRAGMENT, SWARM_FIELD_DEFAULTS, swarmUniforms } from '../tokenshade/swarm-field.mjs';

export const AURA_STYLES = Object.freeze({ jb2a: 'JB2A animations', tokenshade: 'Tokenshade (drawn by Animater)' });

// What the aura is, read as a motif: its name first, then its reviewed design description, then its layers' labels,
// then its footage (colour words dropped: a dark_purple glyph is not a shadow). The first rule that matches wins.
const MOTIF_RULES = [
  ['dashes', /\b(silence)\b/],
  ['notes', /\b(song|songs|anthem|music|musical|notes|dirge|canticle|hymn|triple time|performer)\b/],
  ['flame', /\b(fire|flames?|ember|embers|lava|burn|burning|heat|incendiary|blazing|searing|kindle|lantern|sunlight)\b/],
  ['frost', /\b(cold|ice|icy|frost|snow|chill|freezing|crystal)\b/],
  ['storm', /\b(lightning|electric|electricity|storm|thunder|arcing)\b/],
  ['skulls', /\b(necromancy|necromantic|undead|undying|death|deathly|skulls?|bones?|grave|souls?|corpse|void)\b/],
  ['drops', /\b(blood|bleed|bleeding|poison|poisonous|toxic|venom|sap|stink|acid|ooze)\b/],
  ['hearts', /\b(life|heal|healing|vitality|hearts?|courage|courageous|restful|endurance|health)\b/],
  ['eyes', /\b(awareness|overwatch|watch|watchful|hunter|hunting|sight|eyes?|perception|strategist|cunning|vigilance|lure)\b/],
  ['blades', /\b(blades?|swords?|weapons?|war|battle|onslaught|wrath|wrathful|furious|combat|strike|legion|knave)\b/],
  ['wind', /\b(wind|whirl|whirling|air|gust|gusts|tempest|flock)\b/],
  ['shadow', /\b(necromancy|necromantic|shadow|shadows|despair|dread|horror|horrors|fume|fuming|smoke|miasma|curse|grief|doom|ominous|spectral|soul|ghosts?|undying)\b/],
  ['vines', /\b(nature|natural|wood|wooden|leaves|leaf|vines?|plant|thorns?|growth|growing|orchard|wild|wilds|primal|primeval|dew|living)\b/],
  ['radiance', /\b(bless|blessing|holy|celestial|divine|radiant|radiance|halo|light|benediction|righteous|righteousness|faith|faithful|sun|dawn|glorious|angelic|nimbus)\b/],
  ['ripples', /\b(water|watery|ripples?|waves?|sea|bubbles?|tide)\b/],
  ['hexes', /\b(abjuration|shields?|metal|steel|wards?|armor|aegis|protect|protective|protection|protector|guard|guardians?|defender|rampart|sphere)\b/],
  ['runes', /\b(runes?|glyphs?|arcane|occult|formulae?|enchantment|divination|signs?|symbol|symbols|tradition)\b/],
  ['sparks', /\b(glints?|stars?|sparks?|motes?|sparkles?|banner|standard|inspiration|inspiring|marshal|commander)\b/],
];
const COLOUR_WORDS = /\b(dark )?(black|blue|bluepurple|blueteal|green|greenyellow|grey|orange|orangeyellow|pink|purple|purplered|red|white|yellow|bluepink|pinkpurple|pinkyellow|orangepurple|greenpurple)\b/g;
const TINT = /^#[0-9a-f]{6}$/i;
export function auraLook(recipe) {
  const stages = recipe?.stages ?? [];
  const words = (v) => String(v ?? '').toLowerCase().replace(/^(?:aura|effect|spell effect|stance):\s*/, '');
  const sources = [words(recipe?.name), words(recipe?.description), stages.map((s) => words(s.label)).join(' '),
    stages.flatMap((s) => s.assets ?? []).join(' ').toLowerCase().replace(/[._]/g, ' ').replace(COLOUR_WORDS, ' ')];
  let motif = 'dashes';
  for (const text of sources) { const hit = MOTIF_RULES.find(([, re]) => re.test(text)); if (hit) { motif = hit[0]; break; } }
  // Its colour: the reach ring's (the design's own hue), else the first tinted layer's, else the recipe's.
  const reach = stages.find((s) => s.auraRadius && /zoning\./.test((s.assets ?? []).join(' ')));
  const hex = [reach?.tint, ...stages.map((s) => (s.tintEnabled ? s.tint : null)), recipe?.color].find((c) => TINT.test(c ?? ''));
  const inward = stages.some((s) => (s.assets ?? []).some((a) => /\.inward\./.test(a)));
  return { motif, color: hex ? parseInt(hex.slice(1), 16) : AURA_FIELD_DEFAULTS.color, inward };
}

// A template stage set to the Tokenshade area look: what every client needs to draw its area as a ground field. A
// round one (a burst or emanation) is an aura field; a cone or line is waves rolling out along it from its origin
// (tokenshade/wave-field.mjs: a sonic breath). Areas drawn on a tile keep their footage (null).
// The swarm motif (tokenshade/swarm-field.mjs) draws a swarm instead: round a creature for an impact or aura stage
// (`grid` px sizes it to the creature), over a round area, or pouring along a cone or line.
export function groundTag(stage, context, recipe, { grid = 100 } = {}) {
  const area = context?.area;
  if (stage?.areaLook !== 'tokenshade' || stage.areaTile) return null;
  if (stage.areaMotif === 'swarm') return swarmTag(stage, area, grid);
  if (stage.kind !== 'template') return null;
  if (['line', 'cone'].includes(area?.type)) return waveTag(stage, area);
  if (!area?.diameter) return null;
  const auto = auraLook({ name: recipe?.name, description: recipe?.description, stages: [stage] });
  const color = stage.tintEnabled && TINT.test(stage.tint ?? '') ? parseInt(stage.tint.slice(1), 16) : auto.color;
  return { motif: stage.areaMotif && stage.areaMotif !== 'auto' ? stage.areaMotif : auto.motif, color, inward: auto.inward, radius: (area.diameter / 2) * (Number(stage.scale) || 1) };
}

// A cone or line's waves: from its origin toward its far end, as wide as the cone's angle or the line.
function waveTag(stage, area) {
  if (!area.center || !area.endpoint) return null;
  const dx = area.endpoint.x - area.center.x, dy = area.endpoint.y - area.center.y, length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  const color = stage.tintEnabled && TINT.test(stage.tint ?? '') ? parseInt(stage.tint.slice(1), 16) : WAVE_FIELD_DEFAULTS.color;
  const tag = { wave: area.type, origin: { x: area.center.x, y: area.center.y }, rotation: Math.atan2(dy, dx), length, color, radius: length };
  if (area.type === 'cone') tag.halfAngle = ((Number(area.angle) > 0 ? Number(area.angle) : 90) * Math.PI) / 360;
  else tag.halfWidth = (Number(area.width) > 0 ? Number(area.width) : length / 20) / 2;
  return tag;
}

// A swarm's field: round the creature it lands on (following it), over a round area, or along a cone or line.
function swarmTag(stage, area, grid) {
  const color = stage.tintEnabled && TINT.test(stage.tint ?? '') ? parseInt(stage.tint.slice(1), 16) : SWARM_FIELD_DEFAULTS.color;
  if (['impact', 'aura'].includes(stage.kind)) {
    const radius = grid * 0.8 * Math.min(2, Math.max(0.5, Number(stage.scale) || 1));
    return { swarm: 'circle', follow: true, radius, color };
  }
  if (stage.kind !== 'template') return null;
  if (['line', 'cone'].includes(area?.type)) { const w = waveTag(stage, area); return w && { ...w, wave: undefined, swarm: area.type, color }; }
  return area?.diameter ? { swarm: 'circle', follow: false, radius: (area.diameter / 2) * (Number(stage.scale) || 1), color } : null;
}

// Is the creature drawn on this screen? An aura never gives away one this viewer cannot see: hidden by the GM, out of
// sight, undetected (PF2e Visioner hides its art), or faded out. The same test the token filters use (engine.mjs).
export const drawn = (t) => t.visible !== false && t.renderable !== false && t.mesh?.visible !== false && t.mesh?.renderable !== false && (t.mesh?.worldAlpha ?? 1) > 0.01;

// The fields on this canvas. Host: PIXI, addToScene(mesh) / removeFromScene(mesh), ticker (add/remove), zoom(),
// gridSize(), gridDistance(), now() in ms. add(key, { token, feet, look, soft, fadeMs }) draws one; remove(key) ends it.
export function createAuraFields(host) {
  const fields = new Map();
  let geometry = null, ticking = false;
  const quad = () => geometry ??= new host.PIXI.Geometry().addAttribute('aVertexPosition', [-1, -1, 1, -1, 1, 1, -1, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
  const radiusOf = (f) => {
    if (f.radius > 0) return f.radius;
    const t = f.token, w = Number(t?.w ?? t?.document?.width * host.gridSize()) || host.gridSize();
    return w / 2 + f.feet * host.gridSize() / (host.gridDistance() > 0 ? host.gridDistance() : 5);
  };
  const update = () => {
    const now = host.now(), zoom = host.zoom();
    for (const [key, f] of fields) {
      const t = f.token;
      if (!t || t.destroyed) { remove(key); continue; }
      const c = t.center ?? { x: (t.x ?? 0) + (t.w ?? 0) / 2, y: (t.y ?? 0) + (t.h ?? 0) / 2 };
      const radius = radiusOf(f);
      if (t.ended) { remove(key); continue; }
      const u = f.mesh.shader.uniforms;
      if (f.swarm) {
        // Round its creature (following it) or over its round area; along its cone or line from where it was placed.
        const round = f.swarm.swarm === 'circle', at = round ? c : f.swarm.origin;
        f.mesh.position.set(at.x, at.y);
        f.mesh.rotation = round ? 0 : f.swarm.rotation;
        if (round && f.swarm.follow) f.mesh.visible = drawn(t);
        const length = round ? f.swarm.radius : f.swarm.length;
        Object.assign(u, swarmUniforms({ color: f.swarm.color }, { shape: f.swarm.swarm, length, halfAngle: f.swarm.halfAngle, halfWidth: f.swarm.halfWidth, time: (now - f.born) / 1000, grid: host.gridSize() }));
        u.uExtent = length * 1.05;
      } else if (f.wave) {
        // Waves stay where their area was placed, turned along it.
        f.mesh.position.set(f.wave.origin.x, f.wave.origin.y);
        f.mesh.rotation = f.wave.rotation;
        Object.assign(u, waveUniforms({ color: f.wave.color }, { ...f.wave, time: (now - f.born) / 1000 }));
        u.uExtent = f.wave.length * 1.05;
      } else {
        f.mesh.position.set(c.x, c.y);
        f.mesh.visible = drawn(t);
        Object.assign(u, auraUniforms(f.look, { radius, inner: (Number(t.w) || host.gridSize()) / 2, zoom, time: (now - f.born) / 1000, grid: host.gridSize() }));
        u.uExtent = radius * 1.08;
      }
      // Fades in, and out when it is played once; Subtle draws it fainter.
      const age = now - f.born, fadeIn = Math.min(1, age / 400), fadeOut = f.until ? Math.max(0, Math.min(1, (f.until - now) / 800)) : 1;
      u.uAlpha = fadeIn * fadeOut * (f.soft ? 0.55 : 1);
      if (f.until && now >= f.until) remove(key);
    }
    if (!fields.size && ticking) { host.ticker.remove(update); ticking = false; }
  };
  const remove = (key) => {
    const f = fields.get(key);
    if (!f) return false;
    fields.delete(key);
    host.removeFromScene(f.mesh);
    return true;
  };
  return {
    // `radius` (canvas px) sets the reach outright: a spell's area, not a creature's aura. `wave` (groundTag's cone or
    // line: wave, origin, rotation, length, halfAngle or halfWidth, color) draws waves along it instead.
    add(key, { token, feet, look, soft = false, fadeMs = 0, radius = 0, wave = null, swarm = null }) {
      remove(key);
      if (!token || !(feet > 0 || radius > 0)) return null;
      const shader = swarm
        ? host.PIXI.Shader.from(AURA_VERTEX, SWARM_FRAGMENT, { ...swarmUniforms({ color: swarm.color }, { shape: swarm.swarm }), uExtent: 1 })
        : wave
        ? host.PIXI.Shader.from(AURA_VERTEX, WAVE_FRAGMENT, { ...waveUniforms({ color: wave.color }, wave), uExtent: 1 })
        : host.PIXI.Shader.from(AURA_VERTEX, AURA_FRAGMENT, { ...auraUniforms(look), uExtent: 1 });
      const mesh = new host.PIXI.Mesh(quad(), shader);
      mesh.eventMode = 'none';
      const born = host.now();
      fields.set(key, { token, feet, look, soft, mesh, born, until: fadeMs > 0 ? born + fadeMs : 0, radius, wave, swarm });
      host.addToScene(mesh);
      if (!ticking) { host.ticker.add(update); ticking = true; }
      update();
      return mesh;
    },
    remove,
    has: (key) => fields.has(key),
    clear() { for (const key of [...fields.keys()]) remove(key); },
    get size() { return fields.size; },
  };
}

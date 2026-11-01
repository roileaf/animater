// Tokenshade auras (the "Aura style" setting): an aura's reach drawn by a shader (tokenshade/aura-field.mjs) on the
// ground under the tokens, in place of its looping footage. One mesh per aura, following its creature every frame;
// the aura's small accent around the creature stays footage. auraLook picks the motif and colour from the aura's
// design, so no aura needs one chosen by hand.
import { AURA_VERTEX, AURA_FRAGMENT, AURA_FIELD_DEFAULTS, auraUniforms } from '../tokenshade/aura-field.mjs';

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

// The fields on this canvas. Host: PIXI, addToScene(mesh) / removeFromScene(mesh), ticker (add/remove), zoom(),
// gridSize(), gridDistance(), now() in ms. add(key, { token, feet, look, soft, fadeMs }) draws one; remove(key) ends it.
export function createAuraFields(host) {
  const fields = new Map();
  let geometry = null, ticking = false;
  const quad = () => geometry ??= new host.PIXI.Geometry().addAttribute('aVertexPosition', [-1, -1, 1, -1, 1, 1, -1, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
  const radiusOf = (f) => {
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
      f.mesh.position.set(c.x, c.y);
      f.mesh.visible = t.visible !== false && t.renderable !== false;
      const u = f.mesh.shader.uniforms;
      Object.assign(u, auraUniforms(f.look, { radius, inner: (Number(t.w) || host.gridSize()) / 2, zoom, time: (now - f.born) / 1000, grid: host.gridSize() }));
      u.uExtent = radius * 1.08;
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
    add(key, { token, feet, look, soft = false, fadeMs = 0 }) {
      remove(key);
      if (!token || !(feet > 0)) return null;
      const shader = host.PIXI.Shader.from(AURA_VERTEX, AURA_FRAGMENT, { ...auraUniforms(look), uExtent: 1 });
      const mesh = new host.PIXI.Mesh(quad(), shader);
      mesh.eventMode = 'none';
      const born = host.now();
      fields.set(key, { token, feet, look, soft, mesh, born, until: fadeMs > 0 ? born + fadeMs : 0 });
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

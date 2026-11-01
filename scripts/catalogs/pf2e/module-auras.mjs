// Auras other modules ship for PF2e: PF2e Workbench and patreon-v3 put an "Aura: Courageous Anthem" (and others)
// on the performer that hands the spell's own effect to everyone in range. PF2e has no such item, so the effect
// catalog (built from PF2e's compendiums) had no entry for them. These entries give each its own field, so it can be
// found, customised and left out like any built-in aura. Listed only while their module is active (moduleActive).
// Each layer names a Patreon asset, then a JB2A free one: the first installed plays, tinted to the aura's colour.
// Like every aura design (tools/pf2e-aura-designs.mjs): its own look is a small accent on the creature and its reach a
// thin Zoning ring at the radius, drifting outward, or inward for a field closing in.
const RING = ['jb2a.zoning.outward.circle.loop.bluegreen.01.03', 'jb2a.zoning.outward.circle.loop.bluegreen.01.01'];
const DARK_RING = ['jb2a.zoning.inward.circle.loop.bluegreen.01.03', 'jb2a.zoning.inward.circle.loop.bluegreen.01.01'];
const NOTES = ['jb2a.markers.music.greenorange', 'jb2a.markers.music_note.blue.01'];
const layer = (label, assets, tint, extra = {}) => ({ label, assets, tintEnabled: true, colorize: true, tint, opacity: 0.85, below: true, playbackRate: 0.8, ...extra });
const accent = (label, assets, tint, extra = {}) => layer(label, assets, tint, { accent: true, scale: 1.5, opacity: 0.75, ...extra });
const reach = (ring, tint) => layer('Aura reach', ring, tint, { opacity: 0.6, playbackRate: 0.6 });
const song = (tint, rationale, ring = RING) => ({ rationale, layers: [accent('Notes in the air', NOTES, tint, { below: false }), reach(ring, tint)] });
const sign = (tint, rationale, assets, ring = DARK_RING) => ({ rationale, layers: [accent('Sign', assets, tint, { opacity: 0.7 }), reach(ring, tint)] });

const DESIGNS = {
  'courageous-anthem': { theme: 'music', color: '#ffb85c', ...song('#ffb85c', 'Courageous Anthem: warm gold notes around the performer, a thin ring marking the song’s reach.') },
  'rallying-anthem': { theme: 'music', color: '#9fd8a8', ...song('#9fd8a8', 'Rallying Anthem: calm green notes around the performer, a thin ring marking the song’s reach.') },
  'song-of-strength': { theme: 'music', color: '#ff9a5c', ...song('#ff9a5c', 'Song of Strength: hot orange notes around the performer, a thin ring marking the song’s reach.') },
  'triple-time': { theme: 'music', color: '#8fe2f4', ...song('#8fe2f4', 'Triple Time: quick bright-blue notes around the performer, a thin ring marking the song’s reach.') },
  'dirge-of-doom': { theme: 'music', color: '#8a6fb8', ...song('#8a6fb8', 'Dirge of Doom: slow notes of a funeral song, a dark ring drawing inward at its reach.', DARK_RING) },
  bane: { theme: 'curse', color: '#e07a84', ...sign('#e07a84', 'Bane: an enchantment sign under the caster, a ring closing in on foes at its reach.', ['jb2a.magic_signs.circle.02.enchantment.loop.dark_pink', 'jb2a.magic_signs.circle.02.enchantment.loop.dark_pink']) },
  malediction: { theme: 'curse', color: '#b07ad8', ...sign('#b07ad8', 'Malediction: a violet enchantment sign under the caster, a ring closing in on foes at its reach.', ['jb2a.magic_signs.circle.02.enchantment.loop.dark_purple', 'jb2a.magic_signs.circle.02.enchantment.loop.dark_pink']) },
  'lantern-intensify-vulnerability': { theme: 'light', color: '#ffc04d', ...sign('#ffc04d', 'Lantern Intensify Vulnerability: a divination sign under the bearer, lantern light ringing its reach.', ['jb2a.magic_signs.circle.02.divination.loop.yellow', 'jb2a.magic_signs.circle.02.divination.loop.blue'], RING) },
  'desert-wind': { theme: 'air', color: '#d9b77a', rationale: 'Desert Wind: a small whirl of sand-coloured wind around the kineticist, a ring at its reach.', layers: [accent('Desert whirl', ['jb2a.template_circle.whirl.loop.orange', 'jb2a.template_circle.whirl.loop.blue'], '#d9b77a', { opacity: 0.6 }), reach(RING, '#d9b77a')] },
};
// Same aura as one PF2e already has a design for: that design, so both look alike.
const SAME_AS = { 'aura-of-despair': 'Effect: Aura of Despair', 'protectors-sphere': "Aura: Protector's Sphere" };

const MODULES = { 'xdy-pf2e-workbench': 'PF2e Workbench', 'patreon-v3': 'patreon-v3' };
// [module, pack, document id, name, image, aura slug, radius in feet (a formula's typical value)]
const SOURCES = [
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'KIPV1TiPCzlhuAzo', 'Aura: Courageous Anthem', 'systems/pf2e/icons/spells/inspire-courage.webp', 'aura-effect-inspire-courage', 60],
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'tcnjhVxyRchqjt71', 'Aura: Rallying Anthem', 'systems/pf2e/icons/spells/inspire-defense.webp', 'aura-effect-inspire-defense', 60],
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'wOcAf3pf04cTM4Uk', 'Aura: Dirge of Doom', 'systems/pf2e/icons/spells/dirge-of-doom.webp', 'aura-dirge-of-doom', 30],
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'YcyN7BDbL0Nt3CFN', 'Aura: Bane', 'systems/pf2e/icons/spells/bane.webp', 'aura-effect-bane', 10],
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'Hx9mK2pLqRw3vN7Y', 'Aura: Malediction', 'icons/magic/light/explosion-glow-spiral-yellow.webp', 'aura-effect-malediction', 10],
  ['xdy-pf2e-workbench', 'xdy-pf2e-workbench-items', 'Er0G0bz5QyJuHm0a', 'Aura: Aura of Despair', 'systems/pf2e/icons/spells/destructive-aura.webp', 'aura-aura-of-despair', 15],
  ['patreon-v3', 'effects', 'RR8MSbHqxJdQxh2e', 'Aura: Courageous Anthem', 'icons/magic/control/buff-strength-muscle-damage.webp', 'aura-inspire-courage', 60],
  ['patreon-v3', 'effects', 'g2LBvDHPRZBabiU2', 'Aura: Rallying Anthem', 'icons/magic/defensive/shield-barrier-blue.webp', 'aura-inspire-defense', 60],
  ['patreon-v3', 'effects', '7kyjK9Pm7wKSZtdQ', 'Aura: Song of Strength', 'icons/magic/control/buff-strength-muscle-damage-orange.webp', 'aura-song-of-strength', 60],
  ['patreon-v3', 'effects', '8VMC9QwRBGlDcDwQ', 'Aura: Triple Time', 'icons/magic/time/clock-spinning-gold-pink.webp', 'aura-triple-time', 60],
  ['patreon-v3', 'effects', 'FcUe8TT7bhqlURIf', 'Aura: Bane', 'icons/magic/symbols/runes-star-pentagon-magenta.webp', 'aura-bane', 10],
  ['patreon-v3', 'effects', 'KOrdcUsjJYLZsFHq', 'Aura: Malediction', 'icons/magic/symbols/runes-star-pentagon-magenta.webp', 'aura-malediction', 10],
  ['patreon-v3', 'effects', 'FJAGbFPO8SZHx0TQ', "Aura: Protector's Sphere", 'icons/magic/defensive/barrier-shield-dome-pink.webp', 'aura-protectors-sphere', 15],
  ['patreon-v3', 'effects', 'hA2y0arJg3ztQnF6', 'Aura: Lantern Intensify Vulnerability', 'icons/sundries/lights/lantern-iron-yellow.webp', 'aura-lantern-intensify-vulnerability', 60],
  ['patreon-v3', 'effects', 'vTFrTVltx4wsEpQw', 'Aura: Desert Wind', 'icons/magic/air/air-burst-spiral-yellow.webp', 'aura-desert-wind', 10],
];
const designKey = (name) => name.replace(/^Aura: /, '').toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The entries, given PF2e's own effects (for the auras that share a PF2e design). Both modules ship some of the
// same auras (Courageous Anthem, Bane…): one entry covers every module's copy, so leaving it out or customising it
// applies whichever module put the aura on the token.
export function moduleAuraEntries(effects = []) {
  const byName = new Map();
  for (const source of SOURCES) byName.set(source[3], [...(byName.get(source[3]) ?? []), source]);
  return [...byName.values()].flatMap((copies) => {
    const [[module, pack, documentId, name, img, , radius]] = copies;
    const key = designKey(name), twin = SAME_AS[key] ? effects.find((e) => e.name === SAME_AS[key]) : null;
    const own = DESIGNS[key];
    if (!own && !twin?.auraDesign) return [];
    const design = own ?? { theme: twin.theme, color: twin.color, rationale: twin.auraDesign.rationale, layers: twin.auraDesign.layers };
    const layers = design.layers.map((l, i) => ({ stageId: `field-${i + 1}`, ...l }));
    const uuidOf = ([m, p, id]) => `Compendium.${m}.${p}.Item.${id}`, modules = [...new Set(copies.map(([m]) => m))], from = modules.map((m) => MODULES[m]).join(', ');
    return [{
      id: `${module}-${documentId}`, documentId, pack, sourcePack: pack, uuid: uuidOf(copies[0]), aliases: copies.slice(1).map(uuidOf),
      slug: copies[0][5], name, img, kind: 'effect', group: 'Module auras', modules,
      theme: design.theme, color: design.color, quality: 'themed', evidence: `Aura effect from ${from}`, rationale: design.rationale,
      assets: (layers.find((l) => l.accent) ?? layers[0]).assets, scale: 1.2, opacity: 0.85, below: true, private: false, presentationRole: 'marker', offsetX: 0, offsetY: 0,
      auras: copies.map(([, , , , , slug]) => ({ slug, radius })), auraDesign: { id: name, rationale: design.rationale, layers },
    }];
  });
}
// Shown in the catalog only while the module that makes them is active (outside Foundry: always).
export const moduleActive = (entry) => !entry?.modules?.length || !globalThis.game?.modules || entry.modules.some((m) => globalThis.game.modules.get(m)?.active === true);

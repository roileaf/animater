// Bespoke compositions (pf2e-states-c): PF2e spell-effect review. Keys: 'pf2e:spell-effects-<docId>'.
// See scripts/bespoke/helpers.mjs and scripts/bespoke.mjs.
// Document-linked effects: every layer is a persistent aura on the bearer, sized
// about 0.9-1.5x the token. Only entries whose generated art misrepresented the
// spell are redesigned here; numeric bonuses with a fitting marker keep it.
import { aura, tint, spin, design } from './helpers.mjs';

const P = (label, assets, o = {}) => aura(label, assets, { persist: true, duration: 6000, fadeIn: 500, fadeOut: 500, bindAlpha: true, bindRotation: false, ...o });
const many = (ids, d) => Object.fromEntries(ids.map(id => [`pf2e:spell-effects-${id}`, d]));
const key = id => `pf2e:spell-effects-${id}`;

// ---- reusable layer sets -------------------------------------------------------------
// Steadied against fear/emotion: warm golden runes and a calm glow, never a fear sigil.
const courageWard = () => [
  P('Steadying runes', ['markers.runes02.yellow.01', 'markers.runes02.orange.01'], { scale: 1.2, opacity: 0.7, ...tint('#ffd98a') }),
  P('Calm glow', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.1, opacity: 0.35, ...tint('#ffe7a8') }),
];
// Consecrated ground: a golden abjuration circle under the bearer with holy motes.
const consecrated = () => [
  P('Consecrated circle', ['magic_signs.circle.02.abjuration.loop.yellow', 'magic_signs.circle.02.abjuration.loop.blue'], { scale: 1.35, opacity: 0.6, below: true, ...tint('#ffd36b') }),
  P('Holy motes', ['twinkling_stars.points04.orange', 'twinkling_stars.points04.white'], { scale: 1.3, opacity: 0.7 }),
];
// Courage music: warm notes circling the listener with a soft heroic glow.
const anthem = () => [
  P('Anthem notes', ['markers.music.greenorange'], { scale: 1.25, opacity: 0.85, ...tint('#ffb85c') }),
  P('Heroic glow', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.1, opacity: 0.3, ...tint('#ffc878') }),
];
// A curse-ring hindrance for effects that inflict a weakness or penalty.
const hindrance = hex => () => [P('Hindrance ring', ['condition.curse.01.012.purple', 'condition.curse.01.012.red'], { scale: 1.4, opacity: 0.85, below: true, ...tint(hex) })];
// A slowing drag: quiet static border instead of the haste ring.
const slowBorder = (hex = '#a5b0df') => P('Hampered stride', ['token_border.circle.static.blue.005'], { scale: 1.4, opacity: 0.8, below: true, ...tint(hex) });

export default {
  // ---------------- illusion ----------------
  [key('0PO5mFRhh9HxGAtv')]: design('Mirror Image: three illusory images swirl about the caster\'s space. A violet swirl and a faint refraction shimmer orbit the token; the `images` token filter draws the duplicates.', () => [
    P('Swirling images', ['particles.swirl.purple.01.01', 'particles.swirl.greenyellow.01.01'], { scale: 1.35, opacity: 0.6, ...tint('#c9a6f0'), ...spin(9000) }),
    P('Illusory shimmer', ['condition.boon.02.001.refraction'], { scale: 1.15, opacity: 0.45 }),
  ]),

  // ---------------- wards against fear, death, poison ----------------
  ...many(['Me470HI6inX3Bovh', 'eotqxEWIgaK7nMpD', 'HDT5oiQXXnRdDIKR'], design('A bonus to saves against fear and emotion steadies the bearer: golden runes and a calm glow, not a fear sigil.', courageWard)),
  [key('GFR5RwR8qW2jIJKP')]: design('Halt Death guards the bearer against death: a golden ward and soft light, not a skull of doom.', () => [
    P('Ward against death', ['shield.01.loop.yellow', 'shield.01.loop.blue'], { scale: 1.15, opacity: 0.5, ...tint('#ffe08a') }),
    P('Lifelight', ['markers.light_orb.loop.white', 'markers.light_orb.loop.blue'], { scale: 1.0, opacity: 0.35, ...tint('#fff2c4') }),
  ]),
  [key('Wlg9dAFQBuuv9oVa')]: design('Anointed Ground: blessed ground grants a bonus against the chosen creatures, shown as a consecrated golden circle with holy motes.', consecrated),
  [key('yb9q5nVA1N0FfO6D')]: design('Hallowed Ground leaves undead in its area weak to vitality: the consecrated circle holds them, rather than a skull marker.', consecrated),
  [key('nIryhRgeiacQw1Em')]: design('Soothing Blossoms helps the bearer shrug off poison and disease, shown as orbiting blossoms rather than a poison sigil.', () => [
    P('Soothing blossoms', ['aura_themed.01.orbit.loop.nature.01.pink', 'aura_themed.01.orbit.loop.nature.01.green'], { scale: 1.35, opacity: 0.8, ...spin(12000) }),
  ]),
  [key('3Gv18zyrm1BQLPI5')]: design('Filter Air protects against inhaled poisons and diseases: a clean air bubble around the bearer, not a poison sigil.', () => [
    P('Filtered air', ['markers.bubble.loop.blue'], { scale: 1.1, opacity: 0.7, ...tint('#dff3ff') }),
  ]),
  [key('oNAqqcxPjzPCJJmW')]: design('Trade Death for Life grants fast healing: a restorative heart with a dusky edge, not a skull.', () => [
    P('Borrowed life', ['markers.heart.dark_red.02', 'markers.heart.pink.02'],{ scale: 1.6, opacity: 0.95, below: true, ...tint('#8be6c4') }),
    P('Vital glow', ['markers.light_orb.loop.green', 'markers.light_orb.loop.blue'], { scale: 1.1, opacity: 0.3, ...tint('#9fe0b8') }),
  ]),
  [key('LiQDQYAYYE6Qg4yI')]: design('Divine Keystone (Critical Failure) empowers undead in the area with fast healing and holy resistance: a dark necromantic sign and fumes, not a stone ring.', () => [
    P('Unholy sign', ['magic_signs.circle.02.necromancy.loop.dark_purple', 'magic_signs.circle.02.necromancy.loop.dark_green'], { scale: 1.35, opacity: 0.6, below: true }),
    P('Grave fumes', ['fumes.04.loop.purple', 'fumes.04.loop.grey'], { scale: 1.3, opacity: 0.5, ...tint('#7a5a96') }),
  ]),
  [key('yCDQ8lW7e01maOXc')]: design('Divine Dragon\'s Watch grants the Dragon\'s Protection reaction: a gold draconic ward, not swirling autumn leaves.', () => [
    P('Dragon\'s ward', ['shield.01.loop.yellow', 'shield.01.loop.blue'], { scale: 1.15, opacity: 0.55, ...tint('#f2c25a') }),
    P('Watchful scales', ['twinkling_stars.points05.orange'], { scale: 1.3, opacity: 0.6 }),
  ]),

  // ---------------- benefit vs hindrance ----------------
  [key('uiXWJVwWuMS3KvkV')]: design('Embodiment of Battle is chiefly a martial boon (attack and damage bonus, Reactive Strike): a red battle orbit, not a penalty curse ring.', () => [
    P('Battle spirit', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.4, opacity: 0.8, ...tint('#d8603e'), ...spin(8000) }),
  ]),
  [key('slI9P4jUp3ERPCqX')]: design('Impeccable Flow grants a status bonus to Perception, saves and skills: a calm boon ring, not a curse ring.', () => [
    P('Flowing focus', ['condition.boon.01.021.green'], { scale: 1.45, opacity: 0.8, below: true, ...tint('#9fd6e8') }),
    P('Flow', ['particles.swirl.white.01.01', 'particles.swirl.greenyellow.01.01'], { scale: 1.2, opacity: 0.45, ...tint('#d6ecff') }),
  ]),
  [key('y4y0nusC97R7ZDL5')]: design('Elemental Betrayal gives the target a weakness to the chosen element: a hindrance ring with a shifting elemental shimmer, not a boon.', () => [
    ...hindrance('#c79ae8')(),
    P('Shifting element', ['condition.boon.02.001.refraction'], { scale: 1.1, opacity: 0.4 }),
  ]),
  [key('r4XX7yzeEOPK7l2a')]: design('Seal Fate gives a weakness to the chosen damage type: a doom rune and hindrance ring, not a boon.', () => [
    ...hindrance('#b67ad8')(),
    P('Sealed fate', ['markers.runes03.dark_black.01', 'markers.runes03.dark_orange.01'], { scale: 1.6, opacity: 0.9, below: true, ...tint('#a37bd6') }),
  ]),

  // ---------------- movement ----------------
  [key('CdAyAiMGESvgNQtz')]: design('Unfettered Movement ignores Speed penalties: free-flowing wind and a brisk ring, not chains.', () => [
    P('Unhindered stride', ['wind_lines.01.01.white', 'wind_lines.01.02.white'], { scale: 1.45, opacity: 0.55 }),
    P('Freedom', ['token_border.circle.spinning.blue.007'], { scale: 1.35, opacity: 0.5 }),
  ]),
  [key('OwvrQKuMLEktNWzA')]: design('Animate Rope binds the legs (Speed penalty): coiled rope, not the haste ring of a Speed bonus.', () => [
    P('Coiled rope', ['markers.chain.standard.loop.02.grey', 'markers.chain.standard.loop.02.red'], { scale: 1.3, opacity: 0.85, ...tint('#b08a5a') }),
  ]),
  [key('fcalovjrB3bzpiDH')]: design('Swampcall mires the target (Speed penalty, off-guard): clinging mud under a slowed border, not the haste ring.', () => [
    P('Sucking mud', ['grease.dark_brown.loop'], { scale: 1.2, opacity: 0.8, below: true }),
    slowBorder('#8f7a5a'),
  ]),
  [key('NY4oUb2RNgkY0AfL')]: design('Tempest Touch leaves freezing storm water that slows the target: an icy orbit on a slowed border, not the haste ring.', () => [
    P('Clinging storm', ['aura_themed.01.orbit.loop.cold.01.blue'], { scale: 1.25, opacity: 0.6 }),
    slowBorder('#9cc6e8'),
  ]),
  [key('0bfqYkNaWsdTmtrc')]: design('Juvenile Companion shrinks the creature and halves its Speeds: a quiet slowed border, not the haste ring.', () => [slowBorder()]),

  // ---------------- element / material ----------------
  [key('4ktNx3cVz5GkcGJa')]: design('Untwisting Iron Augmentation makes unarmed attacks cold iron and silver with the earth trait: an iron orbit, not frost.', () => [
    P('Iron fists', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.35, opacity: 0.8, ...tint('#b7bdc8'), ...spin(9000) }),
  ]),
  [key('ojC0jckNHOEIFFtB')]: design('Precious Gleam gives the next attack cold iron, silver or steel properties: a metallic glint, not frost.', () => [
    P('Metal sheen', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.3, opacity: 0.7, ...tint('#d8dde6') }),
    P('Gleam', ['twinkling_stars.points05.white'], { scale: 1.2, opacity: 0.8 }),
  ]),
  [key('deG1dtfuQph03Kkg')]: design('Shillelagh turns a wooden weapon into a primal +1 striking weapon: a living-wood orbit, not a skull.', () => [
    P('Living wood', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 1.3, opacity: 0.8, ...spin(10000) }),
  ]),
  [key('4wZaiZJtAA0iyWR5')]: design('Sun\'s Fury wreathes the weapon in sunfire (fire and spirit damage, torchlight): a golden flame glow, not a red battle orbit.', () => [
    P('Sunfire', ['flames.04.loop.orange'], { scale: 1.0, opacity: 0.6, ...tint('#ffc24a') }),
    P('Torchlight', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.3, opacity: 0.3, ...tint('#ffd27a') }),
  ]),
  [key('06zdFoxzuTpPPGyJ')]: design('Rejuvenating Flames leaves a restorative warmth (+1 Fortitude): drifting embers and a warm glow, without setting the bearer on fire.', () => [
    P('Warm embers', ['particles.swirl.orange.01.01', 'particles.swirl.greenyellow.01.01'], { scale: 1.25, opacity: 0.6, ...tint('#ffb060') }),
    P('Restoring warmth', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.1, opacity: 0.3, ...tint('#ffcf8a') }),
  ]),
  [key('6BjslHgY01cNbKp5')]: design('Armor of Bones encases the caster in bone plates: an ivory ward, not a multicolored energy field.', () => [
    P('Bone plates', ['shield.01.loop.white', 'shield.01.loop.blue'], { scale: 1.15, opacity: 0.6, ...tint('#e8dcc0') }),
  ]),
  ...many(['UoZv5TXHJNU3QBzy', 'YdRhso3b64wgdB4D'], design('Calcification hardens flesh toward stone (slowed, weak to bludgeoning): a stony crust on a slowed border.', () => [
    P('Stony crust', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.3, opacity: 0.75, ...tint('#bea57f') }),
    slowBorder('#a89a86'),
  ])),

  // ---------------- music ----------------
  ...many(['beReeFroAx24hj83', 'kZ39XWJA3RBDTnqG', 'VFereWC1agrwgzPL'], design('Courageous Anthem (and its Inspire Heroics enhancement) is an inspiring song: warm notes and a heroic glow, not a metal battle orbit.', anthem)),
  [key('1W1LZ3qrZLXr2Mn7')]: design('Musical Shift sets a key signature over the battle: circling notes, not a blood drop.', () => [
    P('Key signature', ['markers.music.greenorange'], { scale: 1.2, opacity: 0.8, ...tint('#c7acff') }),
  ]),
};

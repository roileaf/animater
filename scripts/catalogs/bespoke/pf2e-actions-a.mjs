// Bespoke compositions (pf2e-actions-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// ── Shared builders for this slice ─────────────────────────────────────────
const ab = (profile, extra = {}) => ({ sound: profile, soundNamespace: 'ability', ...extra });
const sp = (profile, extra = {}) => ({ sound: profile, ...extra });
const SILENT = { sound: null };
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'];
const HEAVY = ['melee_generic.bludgeoning.two_handed', 'melee_attack.03.maul'];
const CLAW = ['claws.200px.red', 'claws.200px.red'];
const FIST = ['unarmed_strike.physical.01.orange', 'unarmed_strike.physical.01.blue'];
const above = { offsetY: -0.5, offsetUnits: 'token' };

/** One melee Strike: lunge (or heavy slam), weapon contact, optional accent, target reaction. */
const strike = ({ hit = SLASH, accent, pre, heavy = false, label = 'Strike', scale = 1 } = {}) => [
  ...(pre ? [cast(pre[0], pre[1], { stageId: 'pre', scale: 0.8, duration: 1100, fadeIn: 150, fadeOut: 300, ...(pre[2] ?? {}) })] : []),
  motion(heavy ? 'slam' : 'lunge', 'source', { stageId: 'swing', ...(pre ? { after: 'pre', anchor: 'start', offset: 550 } : { delay: 0 }), duration: 900, intensity: heavy ? 0.7 : 0.6 }),
  impact(label, hit, { stageId: 'hit', after: 'swing', anchor: 'start', offset: 300, duration: 1300, scale }),
  ...(accent ? [impact(accent[0], accent[1], { after: 'hit', anchor: 'start', offset: 250, duration: 1300, scale: 0.8, fadeIn: 100, fadeOut: 400, ...(accent[2] ?? {}) })] : []),
  motion(heavy ? 'press' : 'recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.5 }),
];
/** Ranged Strike: brief aim, flight, contact at arrival, optional accent. */
const shot = (flight, contact, { aim = ['glint.yellow.few'], accent, repeats, flight: ms = 1500 } = {}) => [
  cast('Aim', aim, { stageId: 'aim', scale: 0.5, duration: 800, opacity: 0.8 }),
  travel('Shot', flight, { stageId: 'fly', after: 'aim', anchor: 'start', offset: 450, duration: ms, ...(repeats ? { repeats, repeatInterval: 400 } : {}) }),
  impact('Contact', contact, { stageId: 'land', after: 'fly', anchor: 'arrival', duration: 1100, scale: 0.7, ...(repeats ? { repeats, repeatInterval: 400 } : {}) }),
  ...(accent ? [impact(accent[0], accent[1], { after: 'land', anchor: 'start', offset: 200, duration: 1300, scale: 0.75, fadeIn: 100, fadeOut: 400, ...(accent[2] ?? {}) })] : []),
  motion('recoil', 'source', { after: 'fly', anchor: 'start', duration: 500, intensity: 0.35 }),
  motion('recoil', 'targets', { after: 'fly', anchor: 'arrival', duration: 600, intensity: 0.4 }),
];
/** Fortune / fate twist: a glint and a short spray of stars on the source. */
const fortune = ({ glint = ['glint.yellow.many'], stars = ['twinkling_stars.points07.orange'], extra = [] } = {}) => [
  cast('Fate shifts', glint, { stageId: 'luck', scale: 0.7, duration: 1100, fadeIn: 150, fadeOut: 350 }),
  aura('Fortune sparkles', stars, { after: 'luck', anchor: 'start', offset: 350, duration: 1700, scale: 0.9, opacity: 0.9, fadeIn: 250, fadeOut: 500 }),
  ...extra,
];
/** Defensive reaction: a ward snaps up, holds briefly, the body braces. */
const ward = (label, intro, hold, o = {}) => [
  cast(label, intro, { stageId: 'wd', scale: 1, duration: 1200, ...(o.introO ?? {}) }),
  aura(o.holdLabel ?? 'Ward holds', hold, { after: 'wd', anchor: 'start', offset: 600, duration: 1500, scale: 1.1, opacity: 0.85, fadeIn: 200, fadeOut: 500, ...(o.holdO ?? {}) }),
  motion('brace', 'source', { delay: 100, duration: 1000, intensity: 0.5 }),
];
/** Self buff: a gathering cue and a held glow, with an optional body gesture. */
const buff = (castLabel, castA, auraLabel, auraA, { gesture = 'pulse', castO = {}, auraO = {}, extra = [] } = {}) => [
  cast(castLabel, castA, { stageId: 'bf', scale: 0.85, duration: 1200, fadeIn: 150, fadeOut: 300, ...castO }),
  aura(auraLabel, auraA, { after: 'bf', anchor: 'start', offset: 500, duration: 2200, scale: 1.05, opacity: 0.85, fadeIn: 300, fadeOut: 600, ...auraO }),
  ...(gesture ? [motion(gesture, 'source', { after: 'bf', anchor: 'start', offset: 150, duration: 1000, intensity: 0.4 })] : []),
  ...extra,
];
/** Quiet utility: one small, short cue on the source. */
const quiet = (label, assets, o = {}) => [cast(label, assets, { scale: 0.55, duration: 1200, opacity: 0.85, fadeIn: 200, fadeOut: 400, ...o })];
/** Mark a creature: optional source cue, a mark on the target. */
const mark = (label, assets, { src, o = {}, gesture } = {}) => [
  ...(src ? [cast(src[0], src[1], { stageId: 'mk-src', scale: 0.6, duration: 1000, fadeIn: 150, fadeOut: 300, ...(src[2] ?? {}) })] : []),
  impact(label, assets, { stageId: 'mk', ...(src ? { after: 'mk-src', anchor: 'start', offset: 450 } : {}), duration: 2000, scale: 0.75, fadeIn: 250, fadeOut: 500, ...o }),
  ...(gesture ? [motion(gesture[0], gesture[1] ?? 'targets', { after: 'mk', anchor: 'start', offset: 200, duration: 1000, intensity: gesture[2] ?? 0.5 })] : []),
];
/** Intimidation: a shout from the source, a fear mark and a cower on the target. */
const fear = ({ shout = ['soundwave.01.red', 'soundwave.01.blue'], shoutO = {}, sign = ['markers.fear.dark_red', 'markers.fear.dark_purple'], extra = [] } = {}) => [
  cast('Shout', shout, { stageId: 'shout', scale: 0.85, duration: 1100, fadeOut: 300, ...shoutO }),
  motion('pulse', 'source', { delay: 0, duration: 700, intensity: 0.5 }),
  impact('Shaken', sign, { stageId: 'fear', after: 'shout', anchor: 'start', offset: 450, duration: 1700, scale: 0.55, ...above, fadeIn: 200, fadeOut: 450 }),
  motion('cower', 'targets', { after: 'shout', anchor: 'start', offset: 500, duration: 1100, intensity: 0.6 }),
  ...extra,
];
/** Commander tactic: the banner is raised, a signal rings out, squadmates (targets) answer. */
const signal = ({ answer = ['ui.chevrons3.yellow'], answerLabel = 'Squadmates answer', answerO = {}, extra = [] } = {}) => [
  cast('Banner raised', ['ward.star.yellow'], { stageId: 'sig', scale: 0.5, offsetY: -0.65, offsetUnits: 'token', duration: 1500, fadeIn: 150, fadeOut: 400 }),
  cast('Signal', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'sig-wave', after: 'sig', anchor: 'start', offset: 300, duration: 1100, scale: 0.9, opacity: 0.85 }),
  motion('pulse', 'source', { after: 'sig', anchor: 'start', duration: 800, intensity: 0.4 }),
  impact(answerLabel, answer, { stageId: 'sig-ans', after: 'sig', anchor: 'start', offset: 700, duration: 1400, scale: 0.5, ...above, fadeIn: 150, fadeOut: 400, ...answerO }),
  ...extra,
];
/** Venom applied to fangs or a weapon: a poison sign and a drip at the source. */
const venom = label => [
  cast(label, ['markers.poison.dark_green', 'markers.poison.dark_green'], { stageId: 'vn', scale: 0.5, duration: 1500, fadeIn: 200, fadeOut: 400, offsetY: -0.35, offsetUnits: 'token' }),
  cast('Drip', ['liquid.splash.green', 'liquid.splash.blue'], { after: 'vn', anchor: 'start', offset: 500, duration: 1000, scale: 0.35, opacity: 0.8, ...tint('#7fc25a') }),
];
/** Weapon called into the hand: a small teleport flash at the source. */
const callWeapon = (color = 'blue') => [
  cast('Weapon arrives', [`teleport.01.${color}`, 'teleport.01.blue'], { stageId: 'cw', scale: 0.45, duration: 1200, fadeIn: 100, fadeOut: 300 }),
  cast('Grip', ['glint.yellow.few'], { after: 'cw', anchor: 'start', offset: 600, scale: 0.4, duration: 800 }),
];
/** Runelord spirits swirling around the source. */
const runelordSpirits = (label, spirits, freeTint) => [
  cast('Mythic power', ['magic_signs.circle.02.conjuration.intro.dark_yellow', 'magic_signs.circle.02.conjuration.intro.yellow'], { stageId: 'rl', scale: 0.8, duration: 1300, below: true }),
  aura(label, [spirits, 'spirit_guardians.blueyellow.ring'], { after: 'rl', anchor: 'start', offset: 500, duration: 3200, scale: 1.3, opacity: 0.85, fadeIn: 400, fadeOut: 700, ...(freeTint ? tint(freeTint) : {}) }),
  motion('pulse', 'source', { after: 'rl', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
];
/** Dragon breath: a held gather, then the breath fills the native cone/line in the chosen damage color. */
const breath = (o = {}) => ({
  recipe: { elementChoice: true },
  stages: [
    cast('Deep breath', ['energy_strands.in.yellow', 'energy_strands.in.green'], { stageId: 'br-in', scale: 0.7, duration: 1000, elementTint: true }),
    motion('pulse', 'source', { after: 'br-in', anchor: 'start', duration: 900, intensity: 0.4 }),
    area('Breath', ['breath_weapons02.burst.cone.fire.orange', 'breath_weapons02.burst.cone.fire.orange'], { stageId: 'br', after: 'br-in', anchor: 'start', offset: 750, duration: 2400, elementTint: true,
      elementAssets: {
        fire: ['jb2a.breath_weapons02.burst.cone.fire.orange', 'jb2a.breath_weapons.fire.cone.orange.01'],
        cold: ['jb2a.breath_weapons02.burst.cone.ice', 'jb2a.breath_weapons.cold.cone.blue'],
        poison: ['jb2a.breath_weapons.poison.cone.green'],
        acid: ['jb2a.breath_weapons.acid.line.green'],
        electricity: ['jb2a.breath_weapons.lightning.line.blue'],
        spirit: ['jb2a.breath_weapons02.burst.cone.holy.yellow', 'jb2a.breath_weapons.fire.cone.orange.01'],
        void: ['jb2a.breath_weapons02.burst.cone.arcana.dark_black', 'jb2a.breath_weapons.poison.cone.green'],
        force: ['jb2a.breath_weapons02.burst.cone.arcana.purple', 'jb2a.breath_weapons.fire.cone.orange.01'],
      }, ...o }),
    motion('recoil', 'targets', { after: 'br', anchor: 'start', offset: 700, duration: 700, intensity: 0.4 }),
  ],
});

export default {
  // ── 1–60 ───────────────────────────────────────────────────────────────
  'pf2e:c40APnn4a7bWhtcZ': design('A Challenge for Heroes: you declare a foe your heroic test; a golden challenge rings out and a radiant star settles over the chosen enemy (no Strike is made).', () => [
    ...mark('Heroic test', ['ward.star.yellow'], { src: ['Declaration', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], tint('#f2c94c')], o: above }),
    motion('pulse', 'source', { delay: 0, duration: 800, intensity: 0.4 }),
  ], ab('battleCry')),

  'pf2e:kAwE9YqU6GH1cD7W': design('A Moment Unending: time seems to stretch as you take in every movement; a divination sigil and steady gaze prime your next Strike.', () =>
    buff('Time stretches', ['magic_signs.rune.divination.complete.yellow', 'magic_signs.rune.divination.complete.blue'], 'Every movement seen', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { gesture: 'brace', castO: { scale: 0.6 }, auraO: { scale: 0.5, ...above, duration: 1800 } }), sp('time')),

  'pf2e:hB8AWOWSyHCupV8T': design('Absorb Magic: you breathe in a fraction of nearby magic, which spirals into your nexus and leaves you overflowing.', () =>
    buff('Magic drawn in', ['energy_strands.in.purple', 'energy_strands.in.green'], 'Overflowing', ['on_token_buff.001.001.bluepurple'], { castO: { scale: 0.9 } })),

  'pf2e:VAcxOCFQLb3Bap7K': design('Accept Echo: the spirit settles into you — a pale-green glow and the silhouette of the echo around your body.', () => [
    cast('Echo enters', ['spirit_guardians.green.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'echo', scale: 0.9, duration: 1600, fadeIn: 200, fadeOut: 500, ...tint('#a8e6b0') }),
    sprite('Spirit silhouette', { after: 'echo', anchor: 'start', offset: 400, duration: 1600, opacity: 0.45, scale: 1.12, ...tint('#a8e6b0') }),
    aura('Pale-green glow', ['on_token_buff.001.001.greenyellow'], { after: 'echo', anchor: 'start', offset: 700, duration: 2200, scale: 1.05, opacity: 0.8, fadeIn: 300, fadeOut: 600 }),
  ], ab('spirit')),

  'pf2e:FzZAYGib08aEq5P2': design('Accidental Shot: a lucky ranged Strike — a plain arrow flies true and a spark of fortune flashes at the hit.', () =>
    shot(['arrow.physical.white', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange'], { accent: ['Lucky hit', ['twinkling_stars.points05.orange']] }), ab('bow')),

  'pf2e:NRjBkjYx10MAXp3T': design('Acrid Barrage: your aura flares and acid splashes over every enemy in it (Reflex save; the splash is the damage cue).', () => [
    cast('Aura flares', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'ac', scale: 0.9, duration: 1200 }),
    impact('Acid splash', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'ac-hit', after: 'ac', anchor: 'start', offset: 500, duration: 1400, scale: 0.8, targetStagger: 150, ...tint('#8fd14f') }),
    impact('Fumes', ['fumes.04.complete.grey'], { after: 'ac-hit', anchor: 'start', offset: 400, duration: 1500, scale: 0.6, opacity: 0.6, ...tint('#8fd14f') }),
    motion('shake', 'targets', { after: 'ac-hit', anchor: 'start', duration: 700, intensity: 0.4 }),
  ], sp('acid')),

  'pf2e:2KV87ponbWXgGIhZ': design('Act Together: you and your eidolon act as one; a shared-link strand joins you and both glow in tandem.', () => [
    travel('Shared link', ['energy_strands.range.standard.blue', 'energy_strands.range.standard.purple'], { stageId: 'link', duration: 1500, opacity: 0.85 }),
    aura('Summoner glow', ['on_token_buff.001.001.blue'], { after: 'link', anchor: 'start', offset: 200, duration: 1600, scale: 1, opacity: 0.7, fadeOut: 500 }),
    impact('Eidolon glow', ['on_token_buff.001.001.blue'], { after: 'link', anchor: 'arrival', duration: 1600, scale: 1, opacity: 0.7, fadeOut: 500 }),
    motion('pulse', 'source', { delay: 100, duration: 800, intensity: 0.4 }),
  ], SILENT),

  'pf2e:PpfkUdNMckFE22WI': design('Activate Resonant Reflection: you envision your reflection and it shimmers into being beside you like a mirror image.', () => [
    cast('Envision', ['shimmer.01.blue'], { stageId: 'rr', scale: 1, duration: 1400, fadeIn: 200, fadeOut: 400 }),
    sprite('Reflection', { after: 'rr', anchor: 'start', offset: 300, duration: 1700, opacity: 0.5, offsetX: 0.45, offsetUnits: 'token', mirrorX: true }),
  ], SILENT),

  'pf2e:PWNi3h0F9EsttE2p': design('Administer Ambient Magic: your ostilli pulses a calm lavender and the curative balm heals you.', () => [
    cast('Lavender pulse', ['healing_generic.burst.purplepink', 'healing_generic.200px.purple'], { stageId: 'am', scale: 0.8, duration: 1500 }),
    aura('Balm settles', ['healing_generic.loop.purplepink', 'healing_generic.200px.purple'], { after: 'am', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, opacity: 0.75, fadeIn: 300, fadeOut: 500 }),
  ], sp('healing')),

  'pf2e:MHLuKy4nQO2Z4Am1': design('Administer First Aid: mundane medicine — you kneel to the patient and a steady heartbeat returns (no magic, no music).', () => [
    motion('press', 'source', { delay: 0, duration: 900, intensity: 0.25 }),
    impact('Heartbeat steadies', ['ui.heartbeat.01.green'], { delay: 400, duration: 1800, scale: 0.55, ...above, fadeIn: 200, fadeOut: 400 }),
  ], SILENT),

  'pf2e:zB1g4oa3UKARhCSY': design('Adopt Persona: your tattoo casts an illusory disguise — a purple illusion sigil, a puff of glamour and your form flickering into a new guise.', () => [
    cast('Illusion sigil', ['magic_signs.rune.illusion.complete.purple'], { stageId: 'ap', scale: 0.6, duration: 1300 }),
    cast('Glamour puff', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'ap', anchor: 'start', offset: 500, duration: 1100, scale: 0.9 }),
    motion('flicker', 'source', { after: 'ap', anchor: 'start', offset: 600, duration: 900, intensity: 0.5 }),
  ], sp('transform')),

  'pf2e:OHzBFzMQp7MLlk5W': design('Aegis of Envy: the green-tinged spirits of eight runelords of envy swirl about you, ready to absorb harm.', () => runelordSpirits('Spirits of envy', 'spirit_guardians.green.spirits', '#7cc47c'), ab('spirit')),

  'pf2e:9Nmz5114UB87n7Aj': design('Affix a Fulu: you reach out and press a paper talisman onto the target; its glyph flares once.', () => [
    motion('lunge', 'source', { delay: 0, duration: 800, intensity: 0.3 }),
    impact('Fulu glyph', ['icon.runes.yellow', 'icon.runes.orange'], { delay: 350, duration: 1500, scale: 0.45, fadeIn: 150, fadeOut: 400 }),
  ], SILENT),

  'pf2e:HCl3pzVefiv9ZKQW': design('Aid: you help an ally at the critical moment; a supportive chevron rises over them.', () =>
    mark('Helping hand', ['ui.chevrons3.yellow'], { o: { ...above, scale: 0.45, duration: 1400 } }), SILENT),

  'pf2e:Z0HyZyvCe3Y1Chaa': design('Alley-Oop: a banner signal tells squadmates to toss and catch a consumable; the receiving squadmates are cued.', () => signal(), SILENT),

  'pf2e:ZJ8KJp5mZYgzPJYN': design("Amassed Assault: your united companion pummels every enemy in its space with a flurry of blows (Reflex save; the flurry is the damage cue).", () => [
    impact('Flurry', ['flurry_of_blows.physical.orange', 'flurry_of_blows.physical.blue'], { stageId: 'aa', duration: 1500, scale: 0.9, targetStagger: 150 }),
    motion('shake', 'targets', { after: 'aa', anchor: 'start', offset: 250, duration: 900, intensity: 0.5 }),
  ], ab('unarmed')),

  'pf2e:Or6RLXeoZkN8CLdi': design("Amulet's Abeyance: you thrust your amulet forward and a golden rampart closes around the protected creature.", () => [
    cast('Amulet presented', ['ward.rune.yellow'], { stageId: 'amu', scale: 0.5, duration: 1100, offsetY: -0.3, offsetUnits: 'token' }),
    motion('brace', 'source', { delay: 0, duration: 900, intensity: 0.5 }),
    impact('Harm turned away', ['markers.shield_rampart.complete.03.yellow', 'markers.shield_rampart.complete.01.orange'], { after: 'amu', anchor: 'start', offset: 450, duration: 1700, scale: 0.9 }),
  ], sp('shield')),

  'pf2e:8aIe57gXJ94mPpW4': design('Anadi Venom: you envenom your fangs for your next bite — a poison sign and a green drip (no Strike yet).', () => venom('Fangs envenomed'), sp('poison')),

  'pf2e:xpsD4DsYHKXCB4ac': design('Anchor: your roots dig into the ground beneath you; you sink slightly and hold fast.', () => [
    cast('Roots spread', ['vine.complete.nature.group.01.green'], { stageId: 'root', scale: 0.8, duration: 1800, below: true }),
    motion('sink', 'source', { after: 'root', anchor: 'start', offset: 200, duration: 1100, intensity: 0.3 }),
  ], sp('vines')),

  'pf2e:HbejhIywqIufrmVM': design('Arcane Cascade: you cycle arcane force through body and weapon — violet force strands flow around you as you take the stance.', () =>
    buff('Arcane breath', ['cast_generic.03.bluepurple', 'cast_generic.03.blue'], 'Cascading force', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { auraO: { duration: 2600 } }), sp('force')),

  'pf2e:8b63qGzqSUENQgOT': design('Armor Up!: you snap your fingers and your armor reassembles on your body in a bright plated shimmer.', () => [
    cast('Snap', ['glint.yellow.few'], { stageId: 'snap', scale: 0.4, duration: 700, offsetX: 0.35, offsetUnits: 'token' }),
    aura('Armor returns', ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'], { after: 'snap', anchor: 'start', offset: 300, duration: 1600, scale: 1, fadeOut: 400 }),
    motion('brace', 'source', { after: 'snap', anchor: 'start', offset: 400, duration: 800, intensity: 0.3 }),
  ], ab('shieldRaise')),

  'pf2e:qm7xptMSozAinnPS': design('Arrest a Fall: you spread your wings or air-sense and slow your descent — feathers swirl as you hover to a gentle stop.', () => [
    cast('Air caught', ['swirling_feathers.outburst.01.textured'], { stageId: 'af', scale: 0.9, duration: 1500 }),
    motion('levitate', 'source', { after: 'af', anchor: 'start', duration: 1600, intensity: 0.5 }),
  ], sp('wind')),

  'pf2e:cCCOjU9ihfrn0spp': design('Arrow Splits Arrow: you repeat your motion exactly and the second arrow lands on the very spot of the first.', () => [
    ...shot(['arrow.physical.white', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange']),
    impact('Same spot', ['glint.yellow.few'], { after: 'land', anchor: 'start', offset: 150, duration: 900, scale: 0.4 }),
  ], ab('longbow')),

  'pf2e:9sXQf1SyppS5B6O1': design('Automaton Aim: you lock still and your optics calibrate the range for the next shot.', () => [
    cast('Range calibration', ['markers_scifi.001.complete.001.blueteal'], { stageId: 'cal', scale: 0.6, duration: 1500, opacity: 0.85 }),
    motion('brace', 'source', { delay: 0, duration: 1000, intensity: 0.3 }),
  ], SILENT),

  'pf2e:UWdRX1VelipCzrCg': design('Avert Gaze: you turn your eyes away from a dangerous gaze; a faint gaze motif fades as you shy away.', () => [
    cast('Gaze averted', ['eyes.01.dark_purple.single', 'eyes.01.dark_green.single'], { scale: 0.45, ...above, duration: 1100, opacity: 0.6, fadeIn: 100, fadeOut: 700 }),
    motion('cower', 'source', { delay: 150, duration: 900, intensity: 0.3 }),
  ], SILENT),

  'pf2e:ePfdZYZRmycMpSWU': design('Avoid Dire Fate: your harrow omen turns the failure aside — a white star-glint as fate is rewritten.', () =>
    fortune({ glint: ['glint.blue.many', 'glint.yellow.many'], stars: ['twinkling_stars.points07.white'] }), SILENT),

  'pf2e:M76ycLAqHoAgbcej': design('Balance: you inch across a narrow or uneven surface with careful footsteps.', () => [
    cast('Careful steps', ['footprints.shoe.grey'], { scale: 0.6, duration: 2000, opacity: 0.7, below: true }),
    motion('rush', 'source', { delay: 100, duration: 2200, distance: 1.5, motionRange: 'distance', intensity: 0.3 }),
    motion('shake', 'source', { delay: 700, duration: 900, intensity: 0.15 }),
  ], SILENT),

  'pf2e:b3h3QqvwS5fnaiu1': design('Banshee Cry: a screeching firework bursts near the spellcaster to disrupt it (Will save).', () => [
    projectile('Firework', ['throwable.launch.missile.01.blue'], { stageId: 'bc-fly', duration: 1000, scale: 0.5 }),
    impact('Screeching burst', ['firework.02.orangeyellow', 'firework.02.orangeyellow.01'], { stageId: 'bc-boom', after: 'bc-fly', anchor: 'arrival', duration: 1500, scale: 0.8 }),
    impact('Screech', ['soundwave.02.red', 'soundwave.02.blue'], { after: 'bc-boom', anchor: 'start', offset: 150, duration: 1100, scale: 0.7 }),
    motion('shake', 'targets', { after: 'bc-boom', anchor: 'start', duration: 700, intensity: 0.5 }),
  ], sp('scream')),

  'pf2e:oAWNluJaMlaGysXA': design('Barbed Quills: you snap quills off into your attacker; the barbs bite and draw blood.', () => [
    projectile('Quills', ['dart.01.throw.physical.white', 'arrow.physical.white.01'], { stageId: 'q', duration: 700, scale: 0.6, repeats: 3, repeatInterval: 120 }),
    impact('Barbs bite', ['impact.005.white', 'impact.005.orange'], { stageId: 'q-hit', after: 'q', anchor: 'arrival', duration: 900, scale: 0.5 }),
    impact('Bleeding', ['markers.drop.red'], { after: 'q-hit', anchor: 'start', offset: 250, duration: 1300, scale: 0.4, ...above, fadeOut: 400 }),
    motion('recoil', 'targets', { after: 'q', anchor: 'arrival', duration: 600, intensity: 0.5 }),
  ], ab('naturalPierce')),

  'pf2e:nTBrvt2b9wngyr0i': design('Base Kinesis: you conjure or nudge a small piece of your chosen element; a little elemental swirl in that element\'s color.', () => ({
    recipe: { elementChoice: true },
    stages: [
      cast('Element gathers', ['particles.swirl.greenyellow.01', 'particles.swirl.greenyellow.01'], { stageId: 'bk', scale: 0.6, duration: 1500, elementTint: true }),
      cast('Small manifestation', ['impact.012.blue', 'impact.012.blue'], { after: 'bk', anchor: 'start', offset: 600, duration: 1000, scale: 0.35, offsetX: 0.5, offsetUnits: 'token', elementTint: true }),
    ],
  }), SILENT),

  'pf2e:dCuvfq3r2K9wXY9g': design('Basic Finisher: a graceful, deadly Strike — a flourish, a clean slash and a bright precision flash.', () =>
    strike({ pre: ['Flourish', ['glint.yellow.few'], { scale: 0.5 }], accent: ['Precise finish', ['impact.014.001.white', 'impact.014.001.orangeyellow'], { scale: 0.6 }] }), ab('rapier')),

  'pf2e:ukt9Dr4qmj9pUQII': design("Bear Allies' Burdens: you stride powerfully across the field, scooping up allies as you go.", () => [
    cast('Dust kicked up', ['smoke.puff.side.grey'], { scale: 0.6, duration: 1000, opacity: 0.7, mirrorX: true }),
    motion('rush', 'source', { delay: 100, duration: 2200, distance: 3, motionRange: 'distance', intensity: 0.4 }),
  ], SILENT),

  'pf2e:cx0juTYewwBmrYWv': design("Beast's Charge: your eidolon charges in a straight line and slams into the foe with a claw Strike.", () => [
    motion('rush', 'source', { stageId: 'chg', duration: 1500, distance: 6, motionRange: 'target', motionEndpoint: 'near', intensity: 0.5 }),
    impact('Charging claw', CLAW, { stageId: 'hit', after: 'chg', anchor: 'end', offset: -400, duration: 1200, scale: 1 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.6 }),
  ], ab('claw')),

  'pf2e:3cuTA58ObXhuFX2r': design('Bend Time: time bends around you and you become quickened — a teal shimmer and a racing afterimage.', () => [
    cast('Time bends', ['magic_signs.rune.divination.complete.blue'], { stageId: 'bt', scale: 0.6, duration: 1300 }),
    aura('Quickened', ['on_token_buff.001.001.blueteal'], { after: 'bt', anchor: 'start', offset: 400, duration: 1800, scale: 1, opacity: 0.8, fadeOut: 500 }),
    sprite('Racing afterimage', { after: 'bt', anchor: 'start', offset: 600, duration: 900, opacity: 0.4, offsetX: -0.3, offsetUnits: 'token' }),
  ], sp('time')),

  'pf2e:CCMemaB1RoVa0aOu': design('Bestial Clarity: your bestial instincts flare — feral eyes flash and the enchantment\'s hold is shaken off.', () => [
    cast('Feral eyes', ['eyes.01.orangeyellow.single', 'eyes.01.dark_green.single'], { stageId: 'bcl', scale: 0.5, ...above, duration: 1200, fadeIn: 100, fadeOut: 400 }),
    motion('shake', 'source', { after: 'bcl', anchor: 'start', offset: 200, duration: 700, intensity: 0.4 }),
  ], ab('growl')),

  'pf2e:9X80J5RN21Uoaeiw': design('Binding Vow: you speak a formal vow and spectral chains of supernatural power wrap around you, binding you to it.', () => [
    cast('Vow spoken', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'bv', scale: 0.6, duration: 1000 }),
    aura('Vow binds', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'bv', anchor: 'start', offset: 450, duration: 2200, scale: 0.9, fadeOut: 500 }),
  ], sp('chainBinding')),

  'pf2e:k6ML9SPMxaGJyjqO': design('Bite and Sting: your swarm bites and stings every creature in its space (Reflex save).', () => [
    impact('Swarm bites', ['bite.200px.yellow', 'bite.200px.red'], { stageId: 'bs', duration: 1100, scale: 0.6, repeats: 2, repeatInterval: 350, targetStagger: 150 }),
    impact('Stings', ['impact.005.yellow', 'impact.005.orange'], { after: 'bs', anchor: 'start', offset: 300, duration: 900, scale: 0.4 }),
    motion('shake', 'targets', { after: 'bs', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], sp('swarm')),

  'pf2e:XotRIv6tKRtuAGAF': design('Blazing Conflagration: you shed phoenix form in a fiery corona that erupts across the 10-foot burst; feathers of flame scatter.', () => [
    cast('Phoenix sheds', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'bz', scale: 1, duration: 1300 }),
    area('Fiery corona', ['explosion.01.orange', 'explosion.01.orange'], { stageId: 'bz-burst', after: 'bz', anchor: 'start', offset: 500, duration: 1800 }),
    aura('Embers settle', ['flames.04.complete.orange'], { after: 'bz-burst', anchor: 'start', offset: 500, duration: 1600, scale: 0.8, opacity: 0.7, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'bz-burst', anchor: 'start', offset: 200, duration: 700, intensity: 0.5 }),
  ], sp('fireball')),

  'pf2e:scCEnY6IhU59uekX': design('Bless Ally: your nimbus extends celestial grace — a warm blessing blooms on the ally.', () => [
    cast('Nimbus brightens', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'ba', scale: 0.8, duration: 1300, ...tint('#ffe58a') }),
    impact('Celestial grace', ['bless.200px.intro.yellow'], { after: 'ba', anchor: 'start', offset: 500, duration: 1600, scale: 0.9 }),
  ], sp('bless')),

  'pf2e:Y6ee2ZvIE2fzzvAY': design('Blinding of the Needle: a superficial cut above the eye — a precise slash and a bloody spatter that can blind.', () =>
    strike({ accent: ['Blood in the eyes', ['liquid.splash02.red', 'liquid.splash02.red'], { scale: 0.45, ...above }] })),

  'pf2e:a47Npi5XHXo47y49': design('Blizzard Evasion: you discorporate into a whirling blizzard, flickering out of solid form.', () => [
    cast('Discorporate', ['impact.frost.white', 'impact.frost.white.01'], { stageId: 'blz', scale: 0.9, duration: 1000 }),
    aura('Whirling blizzard', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 'blz', anchor: 'start', offset: 300, duration: 2600, scale: 1.2, opacity: 0.9, fadeIn: 300, fadeOut: 600 }),
    motion('flicker', 'source', { after: 'blz', anchor: 'start', offset: 300, duration: 1000, intensity: 0.6 }),
  ], sp('cold')),

  'pf2e:zt5fgBBOQpr84CGE': design('Bloody Guillotine: the banner signals the squad to converge on one foe, marked by a blood-red death sign.', () =>
    signal({ answer: ['markers.skull.dark_red', 'markers.skull.dark_orange'], answerLabel: 'Doomed foe', answerO: { scale: 0.55 } }), ab('battleCry')),

  'pf2e:bG91dbtbgOnw7Ofx': design('Board: you hop aboard (or off) the vehicle through its hatch or door.', () => [
    motion('leap', 'source', { delay: 0, duration: 1200, distance: 1, motionRange: 'distance', jumpHeight: 0.4, intensity: 0.5 }),
    cast('Footing', ['smoke.puff.side.grey'], { delay: 900, scale: 0.4, duration: 800, opacity: 0.6 }),
  ], SILENT),

  'pf2e:vZltxwRNvF5khf9a': design('Boarding Assault: you swing in on a rope and land a Strike as you arrive.', () => [
    motion('leap', 'source', { stageId: 'swing-in', duration: 1500, distance: 6, motionRange: 'target', motionEndpoint: 'near', jumpHeight: 0.7, intensity: 0.5 }),
    impact('Arriving Strike', SLASH, { stageId: 'hit', after: 'swing-in', anchor: 'end', offset: -400, duration: 1300 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.5 }),
  ], SILENT),

  'pf2e:OpiIzr7h1EKY8wKh': design('Bounce Away: the bludgeoning blow barely dents you and you bounce off it, springing away.', () => [
    cast('Blow absorbed', ['impact.005.white', 'impact.005.orange'], { stageId: 'ba-hit', scale: 0.6, duration: 800 }),
    motion('leap', 'source', { after: 'ba-hit', anchor: 'start', offset: 250, duration: 1500, distance: 2, motionRange: 'distance', motionHeading: 'away', jumpHeight: 0.5, intensity: 0.5 }),
  ], SILENT),

  'pf2e:5VbPhxZYfagIqE1z': design("Brandish the Gorgon's Gaze: you raise the mirrored aegis, now dull as stone, and the gorgon's eyes on it glint.", () => [
    cast('Aegis raised', ['shield.01.intro.yellow', 'shield.01.intro.blue'], { stageId: 'gg', scale: 1, duration: 1300, ...tint('#9a9a8a') }),
    cast("Gorgon's eyes", ['eyes.01.dark_green.single'], { after: 'gg', anchor: 'start', offset: 500, duration: 1300, scale: 0.4, fadeIn: 150, fadeOut: 400 }),
    motion('brace', 'source', { delay: 100, duration: 1000, intensity: 0.5 }),
  ], ab('shieldRaise')),

  'pf2e:ZL5o9c4jV5fRwTGR': design('Break Free: your bonds snap, you dash in a straight line and Strike.', () => [
    cast('Bonds snap', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { stageId: 'snap', scale: 0.8, duration: 900, fadeOut: 300 }),
    motion('rush', 'source', { stageId: 'dash', after: 'snap', anchor: 'start', offset: 500, duration: 1400, distance: 6, motionRange: 'target', motionEndpoint: 'near', intensity: 0.5 }),
    impact('Strike', SLASH, { stageId: 'hit', after: 'dash', anchor: 'end', offset: -400, duration: 1300 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.5 }),
  ], SILENT),

  'pf2e:Y9XUwC8ihxZCfndG': design("Break the Sun's Legs: you slash across the brightest light and a gash devours it, drowning the huge burst in darkness.", () => [
    cast('Gash in the light', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { stageId: 'gash', scale: 0.9, duration: 900, offsetY: -0.6, offsetUnits: 'token', ...tint('#2a2238') }),
    area('Light devoured', ['darkness.black'], { stageId: 'dark', after: 'gash', anchor: 'start', offset: 400, duration: 3000, opacity: 0.85, fadeIn: 600, fadeOut: 900 }),
    aura('Stolen light in your eyes', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { after: 'dark', anchor: 'start', offset: 600, duration: 1600, scale: 0.4, ...above, fadeIn: 200, fadeOut: 500 }),
  ], sp('shadow')),

  'pf2e:NYR2IdfUiHevdt1V': design('Break Them Down: a melee Strike followed point-blank by a ranged Strike from the combination weapon.', () => [
    ...strike(),
    travel('Point-blank shot', ['bullet.01.orange'], { stageId: 'btd-fly', after: 'hit', anchor: 'start', offset: 650, duration: 700 }),
    impact('Round contact', ['impact.005.orange'], { after: 'btd-fly', anchor: 'arrival', duration: 900, scale: 0.6 }),
  ], ab('mixed')),

  'pf2e:3sNSr6NEVkUZ0dIr': design('Buckle-Cut Blitz: the banner signals two squadmates to dash past enemies, slicing straps as they go.', () =>
    signal({ answer: ['melee_generic.slash.01.orange'], answerLabel: 'Straps slashed', answerO: { scale: 0.5, offsetY: 0 } }), SILENT),

  'pf2e:SMF1hTWPHtmlS8Cd': design('Bullet Dancer Stance: you settle into a gun-kata stance; powder-glow and motion lines wrap you.', () =>
    buff('Stance', ['wind_lines.01.01.white'], 'Gun-kata focus', ['on_token_buff.001.001.orangeyellow'], { castO: { scale: 0.8 } })),

  'pf2e:TXqTIwNGULs3j6CH': design('Bullying Press: an intimidating melee Strike; on a hit, fear grips your duel opponent.', () =>
    [...strike({ accent: ['Frightened', ['markers.fear.dark_red', 'markers.fear.dark_purple'], { scale: 0.5, ...above, offset: 400 }] }),
      motion('cower', 'targets', { after: 'hit', anchor: 'start', offset: 600, duration: 900, intensity: 0.5 })]),

  'pf2e:ZhVJ7EUTJngrIO2Z': design('Burn out of Time: impossible energy blazes in a sphere above you, compresses into your weapon, then erupts as spirit and void on the Strike.', () =>
    strike({ pre: ['Sphere above', ['sphere_of_annihilation.200px.purple'], { scale: 0.6, offsetY: -0.8, offsetUnits: 'token', duration: 1300 }], accent: ['Spirit and void', ['impact.011.dark_purple', 'impact.011.blue'], { scale: 0.9 }] }), sp('void')),

  'pf2e:H6v1VgowHaKHnVlG': design('Burrow: you dig down into loose earth; dirt erupts and you sink from view.', () => [
    cast('Dirt erupts', ['burrow.out.01.brown', 'ground_cracks.01.orange'], { stageId: 'dig', scale: 0.8, duration: 1600, below: true }),
    motion('sink', 'source', { after: 'dig', anchor: 'start', offset: 200, duration: 1300, intensity: 0.5 }),
  ], sp('earth')),

  'pf2e:Fha8jFmfkOPxAsrZ': design('Calculate Threats: your mind maps incoming attack vectors; a calculating sigil flickers as you set your guard.', () => [
    cast('Vectors calculated', ['magic_signs.rune.divination.complete.purple', 'magic_signs.rune.divination.complete.blue'], { stageId: 'ct', scale: 0.5, ...above, duration: 1300 }),
    aura('Guard', ['shield.01.complete.01.purple', 'shield.01.complete.01.blue'], { after: 'ct', anchor: 'start', offset: 400, duration: 1300, scale: 0.9, opacity: 0.6 }),
    motion('brace', 'source', { after: 'ct', anchor: 'start', offset: 300, duration: 900, intensity: 0.3 }),
  ], sp('psychic')),

  'pf2e:ESMIHOOahLQoqxW1': design('Call Gun: you hold out your hand and your chosen firearm appears in it with a small flash.', () => callWeapon('yellow'), SILENT),

  'pf2e:8w6esW689NNbbq3i': design("Call on Ancient Blood: your ancestors' resistance surges through your blood — a deep red ward rises and ebbs.", () =>
    ward('Ancestral surge', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue'], ['shield.01.complete.01.red', 'shield.01.complete.01.blue'], { holdLabel: 'Resistance ebbs', holdO: { opacity: 0.6 } })),

  'pf2e:k5TASjIxghvGCy7g': design('Call to Axis: the perfect order of Axis steadies your recollection — a golden divination sigil and a spark of fortune.', () =>
    fortune({ glint: ['magic_signs.rune.divination.complete.yellow', 'magic_signs.rune.divination.complete.blue'], stars: ['twinkling_stars.points06.orange'] }), SILENT),

  // ── 61–130 ─────────────────────────────────────────────────────────────
  'pf2e:Ghx29M00zTSXDxnU': design('Call to Hand: your autonomous spear teleports into your grip — a small arcane flash at your hand (you do not move).', () => callWeapon('blue'), sp('teleport')),

  'pf2e:mk6rzaAzsBBRGJnh': design('Call Upon the Brightness: you call on the augury and a small bright light favors your check.', () =>
    fortune({ glint: ['markers.light.complete.yellow', 'markers.light.complete.blue'], stars: ['twinkling_stars.points04.orange'] }), SILENT),

  'pf2e:a8d5iIf1up9W0gVg': design('Call Warshard Weapon: your warshard weapon teleports into your hand with a small flash.', () => callWeapon('white'), sp('teleport')),

  'pf2e:jTfJzj1yfmPLsxmj': design('Captivating Charm: you overwhelm a creature\'s senses; an enchantment sigil and hearts hold it Fascinated (Will save).', () => [
    cast('Charm', ['glint.purple.many', 'glint.yellow.many'], { stageId: 'cc', scale: 0.6, duration: 1000 }),
    impact('Enchanted', ['magic_signs.rune.enchantment.complete.pink'], { stageId: 'cc-t', after: 'cc', anchor: 'start', offset: 400, duration: 1500, scale: 0.6 }),
    impact('Fascinated', ['markers.heart.pink'], { after: 'cc-t', anchor: 'start', offset: 400, duration: 1600, scale: 0.45, ...above, fadeOut: 400 }),
  ], SILENT),

  'pf2e:2424g94rpoiN1IPh': design('Catharsis: your emotion boils over into fervor — a surge of fiery strands around you.', () =>
    buff('Emotion surges', ['energy_strands.complete.orange', 'energy_strands.complete.blue.01'], 'Emotional fervor', ['on_token_buff.001.001.purplered'], { gesture: 'shake' })),

  'pf2e:34E7k2YRcsOU5uyl': design('Change Shape: you shift forms — a puff of transformation and your outline wavers.', () => [
    cast('Shape shifts', ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], { stageId: 'cs', scale: 1, duration: 1200 }),
    motion('shake', 'source', { after: 'cs', anchor: 'start', offset: 100, duration: 900, intensity: 0.4 }),
  ], sp('transform')),

  'pf2e:s4s40hJr5uRLOqix': design('Change Tradition Focus: a quick mental shift to a different magical tradition — a small sigil turns over.', () =>
    quiet('Tradition shifts', ['cast_shape.circle.single01.purple', 'cast_shape.circle.single01.blue']), SILENT),

  'pf2e:Ce9vzE3XWn0u5NcL': design("Channel Draconic Essence: you call down your benefactor's essence and a spectral dragon presence coils around you.", () => [
    cast('Essence called', ['magic_signs.circle.02.conjuration.intro.dark_purple', 'magic_signs.circle.02.conjuration.intro.yellow'], { stageId: 'de', scale: 0.8, duration: 1300, below: true }),
    aura('Spectral dragon', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'de', anchor: 'start', offset: 500, duration: 2600, scale: 1.2, opacity: 0.8, fadeIn: 400, fadeOut: 600 }),
  ], sp('summon')),

  'pf2e:g8QrV39TmZfkbXgE': design('Channel Elements: your kinetic gate opens and elements begin flowing around you as your kinetic aura activates.', () =>
    buff('Gate opens', ['cast_generic.03.white', 'cast_generic.03.blue'], 'Kinetic aura', ['energy_strands.overlay.blueorange', 'energy_strands.overlay.blue'], { auraO: { scale: 1.3, duration: 2600 } })),

  'pf2e:YjrM5G8Up0wv6x0u': design('Chaotic Destiny: chaos intervenes on a failed save — a burst of tumbling stars as you reroll.', () =>
    fortune({ glint: ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], stars: ['twinkling_stars.points09.orange'] }), SILENT),

  'pf2e:uOlyklPCUWLtCaYI': design('Chassis Deflection: a critical blow glances off your metal chassis in a spray of sparks.', () => [
    cast('Sparks off the chassis', ['impact.005.orange'], { stageId: 'cd', scale: 0.6, duration: 800 }),
    aura('Metal plating', ['aura_themed.01.outward.complete.metal.01.grey'], { after: 'cd', anchor: 'start', offset: 150, duration: 1500, scale: 0.9, opacity: 0.8 }),
    motion('brace', 'source', { delay: 0, duration: 800, intensity: 0.5 }),
  ], ab('metal')),

  'pf2e:zs4ZMcH9oFSCgkBx': design('Claw Stance: you extend your claws and focus on single prey — claws flex and a feral red glow settles.', () =>
    buff('Claws extend', CLAW, 'Feral focus', ['on_token_buff.001.001.purplered'], { castO: { scale: 0.6 } })),

  'pf2e:tw1KDRPdBAkg5DlS': design('Clear a Path: you shove a foe back with the butt of your long gun, then reload.', () => [
    motion('lunge', 'source', { stageId: 'push', duration: 800, intensity: 0.6 }),
    impact('Butt-stroke', ['impact.005.white', 'impact.005.orange'], { stageId: 'hit', after: 'push', anchor: 'start', offset: 300, duration: 900, scale: 0.6 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 1000, distance: 1, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ], ab('club')),

  'pf2e:pprgrYQ1QnIDGZiy': design('Climb: you haul yourself 5 feet up the incline.', () => [
    motion('rush', 'source', { delay: 0, duration: 1600, distance: 0.6, motionRange: 'distance', motionHeading: 'up', intensity: 0.3 }),
    cast('Grit and dust', ['smoke.puff.side.grey'], { delay: 600, scale: 0.35, duration: 800, opacity: 0.5 }),
  ], SILENT),

  'pf2e:25WDi1cVUrW92sUj': design('Clue In: you share a key insight with a creature; a small chevron of help rises above them.', () =>
    mark('Insight shared', ['ui.chevrons3.yellow'], { src: ['Clue', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { scale: 0.4, ...above }], o: { ...above, scale: 0.4, duration: 1400 } }), SILENT),

  'pf2e:mbOa48mQCqj86lVw': design('Coiling Serpents: the ikon arrow strikes and becomes ethereal snakes that coil around the target (Reflex save).', () =>
    shot(['arrow.physical.green', 'arrow.poison.green.01'], ['impact.005.green', 'impact.005.orange'], { accent: ['Ethereal coils', ['markers.chain.spectral_standard.complete.02.green', 'markers.chain.spectral_standard.complete.02.blue'], { scale: 0.8, duration: 1800 }] }), ab('bow')),

  'pf2e:LWrR6UiGm3eCAALJ': design('Collect Spirit Remnant: you brandish your spirit dwelling and coax the lingering remnant inside.', () => [
    aura('Lingering remnant', ['spirit_guardians.blue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'sr', scale: 1, duration: 2200, opacity: 0.7, fadeIn: 300, fadeOut: 600 }),
    cast('Drawn inside', ['energy_strands.in.blue', 'energy_strands.in.green'], { after: 'sr', anchor: 'start', offset: 1000, duration: 1300, scale: 0.6 }),
  ], sp('spirit')),

  'pf2e:WJmc30zb7GmKaETx': design('Command a Construct: you issue programmed instructions; a target-lock blinks on the construct.', () =>
    mark('Instruction received', ['markers_scifi.002.complete.001.blue'], { src: ['Command', ['soundwave.01.blue'], { scale: 0.5 }], o: { scale: 0.7, duration: 1500 } }), SILENT),

  'pf2e:Gja1hFvwLUVkcQC9': design('Command a Thrall: a necrotic thread of will carries your order to a thrall, whose skull-sign stirs.', () => [
    travel('Thread of will', ['energy_strands.range.standard.dark_green', 'energy_strands.range.standard.purple'], { stageId: 'th', duration: 1200, opacity: 0.85 }),
    impact('Thrall stirs', ['markers.skull.dark_green', 'markers.skull.purple'], { after: 'th', anchor: 'arrival', duration: 1500, scale: 0.45, ...above, fadeOut: 400 }),
  ], SILENT),

  'pf2e:q9nbyIF0PEBqMtYe': design('Command an Animal: you call out an order and the animal perks up to follow it.', () =>
    mark('Order heeded', ['ui.chevrons3.green', 'ui.chevrons3.yellow'], { src: ['Call', ['soundwave.01.green', 'soundwave.01.blue'], { scale: 0.5 }], o: { ...above, scale: 0.45, duration: 1300 } }), SILENT),

  'pf2e:qVNVSmsgpKFGk9hV': design('Conceal an Object: you slip a small item out of sight — a barely visible wisp.', () =>
    quiet('Slipped away', ['smoke.puff.side.grey'], { scale: 0.35, opacity: 0.5 }), SILENT),

  'pf2e:BKnN9la3WNrRgZ6n': design("Conduct Energy: your last spell's energy flows into your weapon, crackling in that energy's color.", () => ({
    recipe: { elementChoice: true },
    stages: buff('Energy conducted', ['energy_strands.in.yellow', 'energy_strands.in.green'], 'Charged weapon', ['static_electricity.01.blue'], { castO: { elementTint: true }, auraO: { elementTint: true, scale: 0.8, duration: 1800 } }),
  }), SILENT),

  'pf2e:K878asDgf1EF0B9S': design('Confident Finisher: an incredibly graceful Strike that pierces defenses — even a glancing blow lands precision.', () =>
    strike({ pre: ['Flourish', ['glint.yellow.few'], { scale: 0.5 }], accent: ['Piercing finish', ['impact.014.001.white', 'impact.014.001.orangeyellow'], { scale: 0.6 }] }), ab('rapier')),

  'pf2e:KC6o1cvbr45xnMei': design('Conjure Bullet: a round blinks into being between your fingers and you load it.', () =>
    quiet('Round conjured', ['particle_burst.01.star.bluepurple'], { scale: 0.4, offsetX: 0.35, offsetUnits: 'token' }), SILENT),

  'pf2e:1If9lLVoZdO8woVg': design('Consume Flesh: you lean in and devour a chunk of the corpse.', () => [
    motion('lunge', 'source', { delay: 0, duration: 900, intensity: 0.35 }),
    cast('Gore', ['liquid.splash02.red'], { delay: 400, scale: 0.35, duration: 900, offsetX: 0.4, offsetUnits: 'token', opacity: 0.8 }),
  ], SILENT),

  'pf2e:HW8FAK8Gp9GBrFUo': design('Consume Thrall: you destroy a thrall in a puff of grave smoke and draw its energy back as focus.', () => [
    impact('Thrall unmade', ['toll_the_dead.green.skull_smoke'], { stageId: 'ct', duration: 1500, scale: 0.7 }),
    cast('Focus regained', ['energy_strands.in.green', 'energy_strands.in.green'], { after: 'ct', anchor: 'start', offset: 700, duration: 1300, scale: 0.6 }),
  ], sp('drain')),

  'pf2e:6uHxON55vtaperC2': design('Convocation of Greed: the golden spirits of eight runelords of greed appear and bolster your armaments.', () => runelordSpirits('Spirits of greed', 'spirit_guardians.orange.spirits', '#f2c94c'), ab('spirit')),

  'pf2e:Kp325Qf0qpF6RCDE': design('Coordinating Maneuvers: the banner signals a squadmate to Step into position for a Reposition.', () => signal(), SILENT),

  'pf2e:yT2A0CxSA5nJ8e7n': design('Corpse Crenellation: the banner signals two squadmates to build grisly earthworks.', () => signal(), SILENT),

  'pf2e:mech0dhb4eKbCAu0': design('Coughing Dragon: a crackling dragon-shaped firework display booms overhead and smothers matching effects nearby.', () => [
    cast('Firework display', ['firework.01.orangeyellow', 'firework.01.orangeyellow.01'], { stageId: 'cd', scale: 1, offsetY: -0.8, offsetUnits: 'token', duration: 1600 }),
    cast('Second burst', ['firework.02.greenred', 'firework.02.orangeyellow.01'], { after: 'cd', anchor: 'start', offset: 500, scale: 0.8, offsetX: 0.6, offsetY: -0.6, offsetUnits: 'token', duration: 1500 }),
    cast('Boom', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { after: 'cd', anchor: 'start', offset: 300, scale: 1.2, duration: 1200, opacity: 0.7 }),
  ], sp('explosion')),

  'pf2e:gBhWEy3ToxQeCLQm': design('Covered Reload: you duck low behind cover and reload.', () => [
    motion('cower', 'source', { delay: 0, duration: 1200, intensity: 0.35 }),
    cast('Ducked low', ['smoke.puff.side.grey'], { delay: 200, scale: 0.35, duration: 900, opacity: 0.5 }),
  ], SILENT),

  'pf2e:Cu7P7NB3XH67mi1N': design('Crash Against Me: your skin hardens to near-unbreakable metal-grey; you brace for the blow.', () =>
    ward('Skin hardens', ['aura_themed.01.inward.complete.metal.01.grey'], ['aura_themed.01.orbit.complete.metal.01.grey'], { holdLabel: 'Unbreakable', holdO: { opacity: 0.6 } }), ab('metal')),

  'pf2e:Tj055UcNm6UEgtCg': design('Crawl: you drag yourself 5 feet along the ground while prone.', () => [
    motion('rush', 'source', { delay: 0, duration: 1800, distance: 0.7, motionRange: 'distance', intensity: 0.25 }),
    cast('Dust', ['smoke.puff.side.grey'], { delay: 300, scale: 0.3, duration: 900, opacity: 0.5, below: true }),
  ], SILENT),

  'pf2e:GkmbTGfg8KcgynOA': design('Create a Diversion: a gesture, trick or distracting words — a showy flash pulls the targets\' attention away.', () => [
    cast('Distraction', ['smoke.puff.ring.01.white'], { stageId: 'cd', scale: 0.6, duration: 1000 }),
    motion('dodge', 'source', { delay: 100, duration: 900, distance: 0.4, intensity: 0.4 }),
    impact('Attention drawn off', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'cd', anchor: 'start', offset: 400, duration: 1500, scale: 0.45, ...above, fadeOut: 400 }),
  ], SILENT),

  'pf2e:NT1rtY5DFJGsR5QR': design('Create Familiar Fulu: your familiar dissolves into magical energy that re-forms between your fingers as a fulu.', () => [
    impact('Familiar dissolves', ['smoke.puff.centered.blue', 'smoke.puff.centered.grey'], { stageId: 'ff', duration: 1100, scale: 0.7 }),
    travel('Energy flows', ['energy_strands.range.standard.blue', 'energy_strands.range.standard.purple'], { after: 'ff', anchor: 'start', offset: 300, duration: 1000, opacity: 0.8 }),
    cast('Fulu forms', ['icon.runes.yellow', 'icon.runes.orange'], { after: 'ff', anchor: 'start', offset: 900, scale: 0.4, duration: 1300, offsetX: 0.35, offsetUnits: 'token' }),
  ], SILENT),

  'pf2e:2XQowhfM4SfAhJaf': design('Crescent Spray: up to three quick bolts from the crescent cross.', () =>
    shot(['bolt.physical.white', 'bolt.physical.orange'], ['impact.005.white', 'impact.005.orange'], { repeats: 3, flight: 1000 }), ab('crossbow')),

  'pf2e:k50ynPhpPSPZ4Akg': design('Cry Havoc!: a resounding battle cry and banner clangor send the whole squad charging at the chosen enemy.', () =>
    signal({ answer: ['markers.fear.dark_red', 'markers.fear.dark_purple'], answerLabel: 'Chosen enemy', answerO: { scale: 0.55 },
      extra: [cast('Clangor', ['soundwave.01.red', 'soundwave.01.blue'], { delay: 200, scale: 1.3, duration: 1300, opacity: 0.8 })] }), ab('battleCry')),

  'pf2e:Oh6H1fuXC6jK4Hcp': design('Cycle Elemental Stance: you Step and flow into a different elemental stance.', () => [
    motion('rush', 'source', { stageId: 'st', duration: 1300, distance: 1, motionRange: 'distance', intensity: 0.4 }),
    aura('New stance', ['energy_strands.overlay.blueorange', 'energy_strands.overlay.blue'], { after: 'st', anchor: 'end', offset: -300, duration: 1800, scale: 1, opacity: 0.8, fadeIn: 200, fadeOut: 500 }),
  ], SILENT),

  'pf2e:1ejGup6ouh9t9S96': design('Dancing Dodge: you twist away from the Strike in a dance step.', () => [
    motion('dodge', 'source', { delay: 0, duration: 1000, distance: 0.5, intensity: 0.6 }),
    sprite('Afterimage', { delay: 100, duration: 700, opacity: 0.35 }),
  ], SILENT),

  'pf2e:5LW1k5DUkzbbYuYL': design('Daydream Trance: you sink into a half-sleeping trance; dreamy symbols drift above you.', () => [
    aura('Trance', ['sleep.symbol.pink'], { scale: 0.6, ...above, duration: 2400, opacity: 0.85, fadeIn: 400, fadeOut: 600 }),
    motion('drift', 'source', { delay: 200, duration: 1800, intensity: 0.3 }),
  ], SILENT),

  'pf2e:0LwQufKtXfRda0BR': design('Dazzle Seeker: you flash your bright scales into the seeker\'s eyes.', () => [
    cast('Scales flash', ['glint.yellow.many'], { stageId: 'ds', scale: 0.8, duration: 900 }),
    impact('Dazzled', ['impact.007.white', 'impact.007.yellow'], { after: 'ds', anchor: 'start', offset: 300, duration: 900, scale: 0.5 }),
  ], SILENT),

  'pf2e:6iGoVnEJuBHJqgpi': design('Death Drone: the cicadas in your swarm drone a fear-inducing hum; creatures in the swarm cower (Will save).', () =>
    fear({ shout: ['soundwave.02.green', 'soundwave.02.blue'], shoutO: { scale: 1.2, repeats: 2, repeatInterval: 400 }, sign: ['markers.horror.dark_teal', 'markers.horror.purple'] }), sp('swarm')),

  'pf2e:bp0Up04x3dzGK5bB': design('Debilitating Strike: your hit leaves the off-guard foe debilitated — a cracked-guard sign and a stagger.', () =>
    mark('Debilitated', ['markers.shield_cracked.dark_red', 'markers.shield_cracked.purple'], { o: { ...above, scale: 0.5, duration: 1500 }, gesture: ['stagger', 'targets', 0.5] }), SILENT),

  'pf2e:1LDOfV8jEka09eXr': design('Deceptive Sidestep: you draw the foe in and pull away at the last moment, leaving only an afterimage.', () => [
    sprite('Left-behind image', { delay: 0, duration: 900, opacity: 0.45 }),
    motion('dodge', 'source', { delay: 0, duration: 1000, distance: 0.6, intensity: 0.6 }),
  ], SILENT),

  'pf2e:Qj36ramjkoKE8kzJ': design('Decompose: void energy seeps from you and everything nearby withers and rots.', () => [
    cast('Void seeps', ['arms_of_hadar.dark_purple'], { stageId: 'dc', scale: 0.7, duration: 1800, below: true }),
    aura('Decay', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'dc', anchor: 'start', offset: 500, duration: 1600, scale: 1.2, opacity: 0.7, ...tint('#5b4a6e') }),
  ], sp('void')),

  'pf2e:5V49l0K460CcvBOO': design('Defend Life: a crimson life-link carries the damage from your ward to you.', () => [
    travel('Life link', ['energy_strands.range.standard.dark_red', 'energy_strands.range.standard.purple'], { stageId: 'dl', duration: 1300, opacity: 0.85 }),
    impact('Ward spared', ['shield.01.complete.01.red', 'shield.01.complete.01.blue'], { after: 'dl', anchor: 'arrival', duration: 1300, scale: 0.8, opacity: 0.7 }),
    motion('stagger', 'source', { after: 'dl', anchor: 'start', offset: 500, duration: 800, intensity: 0.4 }),
  ], SILENT),

  'pf2e:UJi0VYnhVSdnl9II': design('Defensive Retreat: the banner signals all squadmates to step carefully back.', () => signal(), SILENT),

  'pf2e:2u915NdUyQan6uKF': design('Demoralize: a sudden fearsome shout shakes the target, who cowers (Intimidation vs Will).', () => fear(), ab('battleCry')),

  'pf2e:q1dvlKJI2Kfegc4Y': design('Demoralizing Charge: the banner sends two squadmates charging; the enemy they reach is shaken.', () =>
    signal({ answer: ['markers.fear.dark_red', 'markers.fear.dark_purple'], answerLabel: 'Enemy shaken', answerO: { scale: 0.55 },
      extra: [motion('cower', 'targets', { after: 'sig-ans', anchor: 'start', offset: 200, duration: 1000, intensity: 0.5 })] }), ab('battleCry')),

  'pf2e:JmCuw6Rhwfwo90ed': design('Designate Ally: you choose an ally to guard; a protective shield sign appears over them.', () =>
    mark('Designated', ['markers.shield.blue', 'markers.shield.green'], { o: { ...above, scale: 0.5, duration: 1600 } }), SILENT),

  'pf2e:r5Uth6yvCoE4tr9z': design('Destructive Vengeance: bloodshed begets bloodshed — you take more harm and dark spirit vengeance strikes the attacker.', () => [
    cast('Blood price', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue'], { stageId: 'dv', scale: 0.9, duration: 1100 }),
    impact('Vengeance', ['divine_smite.target.dark_red', 'divine_smite.target.blueyellow'], { after: 'dv', anchor: 'start', offset: 400, duration: 1500, scale: 0.9 }),
    motion('stagger', 'source', { delay: 0, duration: 800, intensity: 0.4 }),
    motion('recoil', 'targets', { after: 'dv', anchor: 'start', offset: 700, duration: 700, intensity: 0.5 }),
  ], sp('divineWrath')),

  'pf2e:m0f2B7G9eaaTmhFL': design('Devise a Stratagem: you study the foe and see its weak point — an analytic sigil settles on it (no Strike yet).', () =>
    mark('Weakness assessed', ['magic_signs.rune.divination.complete.blue'], { src: ['Study', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { scale: 0.4, ...above }], o: { scale: 0.55, duration: 1500 } }), SILENT),

  'pf2e:3sgY9afTTBhZXE8V': design('Devour Ambient Magic: your ostilli radiates cyan and its filters drink in the spell aimed at you.', () =>
    buff('Spell drawn in', ['energy_strands.in.blue', 'energy_strands.in.green'], 'Cyan radiance', ['on_token_buff.001.001.blueteal']), sp('dispel')),

  'pf2e:H72AAzknXiojqXdY': design('Direct Follower: you give your follower an order; they acknowledge it.', () =>
    mark('Order acknowledged', ['ui.chevrons3.yellow'], { src: ['Order', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { scale: 0.5 }], o: { ...above, scale: 0.45, duration: 1300 } }), SILENT),

  'pf2e:cYdz2grcOcRt4jk6': design('Disable a Device: patient fiddling with tools — a small spark of progress, nothing flashy.', () => [
    motion('press', 'source', { delay: 0, duration: 1000, intensity: 0.2 }),
    cast('Tinkering', ['glint.yellow.few'], { delay: 300, scale: 0.35, duration: 900, offsetX: 0.4, offsetUnits: 'token' }),
  ], SILENT),

  'pf2e:Dt6B1slsBy8ipJu9': design('Disarm: you knock at the item in the target\'s grip; a sharp contact and the hand jerks.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 800, intensity: 0.5 }),
    impact('Knocked loose', ['impact.005.white', 'impact.005.orange'], { stageId: 'hit', after: 'sw', anchor: 'start', offset: 300, duration: 900, scale: 0.5, offsetX: 0.3, offsetUnits: 'token' }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 600, intensity: 0.4 }),
  ], ab('unarmed')),

  'pf2e:jl1euufxNpAhVt26': design('Disarming Interception: your parrying fist intercepts the attack and you try to wrench the weapon away.', () => [
    motion('brace', 'source', { stageId: 'parry', duration: 700, intensity: 0.4 }),
    impact('Intercept', FIST, { stageId: 'hit', after: 'parry', anchor: 'start', offset: 300, duration: 1000, scale: 0.7 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 600, intensity: 0.4 }),
  ], ab('unarmed')),

  'pf2e:1wcMkrJ8isCWc1x6': design('Disengage: you steer your ship to break away — wind fills the sails.', () =>
    quiet('Breaking away', ['wind_lines.01.01.white'], { scale: 0.9, opacity: 0.7, duration: 1500 }), SILENT),

  'pf2e:AjLSHZSWQ90exdLo': design('Dismiss: you end an effect; a faint ring of magic disperses.', () =>
    quiet('Effect dismissed', ['smoke.puff.ring.01.white'], { scale: 0.5, opacity: 0.6 }), SILENT),

  'pf2e:Fe487XZBdqEI2InL': design('Dispelling Bullet: a disruptive round strikes and magic on the target unravels (counteract on hit).', () =>
    shot(['bullet.01.blue', 'bullet.03.blue'], ['impact.005.white', 'impact.005.orange'], { accent: ['Magic unravels', ['impact.011.blue', 'impact.011.blue'], { scale: 0.7 }] }), ab('firearm')),

  'pf2e:s2RrhZx1f1X4YnYV': design('Divert Lightning: you become a lightning rod — the electricity arcs to you instead of your ally.', () => [
    cast('Lightning rod', ['lightning_strike.blue'], { stageId: 'dlt', scale: 0.6, duration: 1000 }),
    aura('Crackling', ['static_electricity.02.blue'], { after: 'dlt', anchor: 'start', offset: 300, duration: 1500, scale: 0.9, opacity: 0.85, fadeOut: 400 }),
    motion('shake', 'source', { after: 'dlt', anchor: 'start', offset: 100, duration: 800, intensity: 0.5 }),
  ], sp('electric')),

  'pf2e:ip3twMLbinlNAl64': design('Double Spellstrike: two spells charge your weapon together and both discharge in one Strike.', () =>
    [...strike({ pre: ['Two spells charge', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { scale: 0.9, duration: 1200 }], accent: ['First spell', ['impact.011.dark_purple', 'impact.011.blue'], { scale: 0.8 }] }),
      impact('Second spell', ['impact.012.blue', 'impact.012.blue'], { after: 'hit', anchor: 'start', offset: 550, duration: 1200, scale: 0.8 })], sp('force')),

  'pf2e:c5jVVnNYlP5HB6Ob': design('Double Team: the banner signals a squadmate to shove or reposition a foe into a vicious setup.', () => signal(), SILENT),

  'pf2e:uMFB3uw8WTWL0LZD': design('Draconic Frenzy: your eidolon bites once and rakes twice with its claws.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    impact('Bite', ['bite.200px.red'], { stageId: 'b1', after: 'sw', anchor: 'start', offset: 300, duration: 1000, scale: 0.8 }),
    impact('Claw', CLAW, { stageId: 'c1', after: 'b1', anchor: 'start', offset: 500, duration: 1000, scale: 0.8 }),
    impact('Claw', CLAW, { after: 'c1', anchor: 'start', offset: 450, duration: 1000, scale: 0.8, mirrorX: true }),
    motion('recoil', 'targets', { after: 'b1', anchor: 'start', duration: 1500, intensity: 0.5 }),
  ], ab('claw')),

  'pf2e:hSTE1wvCsYYvCsHC': design('Draconic Salvation: the spectral dragon in your space turns the critical failure aside.', () =>
    fortune({ glint: ['spirit_guardians.dark_purple.no_ring', 'spirit_guardians.blueyellow.ring'], stars: ['twinkling_stars.points07.orange'] }), SILENT),

  'pf2e:oanRfXGLnBm6mMVg': design('Dragon Breath (pact): you exhale your benefactor\'s breath across the cone or line in its damage color (basic save).', () => breath(), sp('dragonRoar')),
  'pf2e:yMt7EeLqxzM3WLgn': design('Dragon Breath (dragon form): you exhale your dragon\'s breath across its area in the matching damage color (basic save).', () => breath(), sp('dragonRoar')),
  'pf2e:Vr3w3t028ZKDg0mO': design('Dragon Breath (eidolon): your eidolon exhales destructive energy across its area in the matching damage color (basic Reflex).', () => breath(), sp('dragonRoar')),

  'pf2e:Zt9bo3FYLQihmpAz': design("Dragon's Protection: the spectral dragon intercepts the killing blow, shielding its charge with a draconic ward.", () => [
    impact('Dragon intercepts', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'dp', duration: 1100, scale: 0.9 }),
    impact('Kept at 1 HP', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { after: 'dp', anchor: 'start', offset: 300, duration: 1500, scale: 0.9 }),
  ], sp('shield')),

  // ── 131–190 ────────────────────────────────────────────────────────────
  'pf2e:v82XtjAVN4ffgVVR': design('Drain Bonded Item: the stored power of your bonded item flows back into you.', () =>
    quiet('Bonded power drawn', ['energy_strands.in.purple', 'energy_strands.in.green'], { scale: 0.7 }), SILENT),

  'pf2e:JPHWzD2soqjffeSU': design('Drain Life: your eidolon strikes and siphons the target\'s life force through void energy.', () =>
    [...strike({ hit: CLAW, accent: ['Life siphoned', ['impact.011.dark_purple', 'impact.011.blue'], { scale: 0.8 }] }),
      cast('Fed back', ['energy_strands.in.purple', 'energy_strands.in.green'], { after: 'hit', anchor: 'start', offset: 700, duration: 1200, scale: 0.6 })], sp('drain')),

  'pf2e:JxuXTJIKRwmYn08D': design('Drain Realm: you siphon power from your manifested realm into yourself.', () =>
    buff('Realm siphoned', ['energy_strands.in.blue', 'energy_strands.in.green'], 'Bolstered', ['on_token_buff.001.001.bluepurple'])),

  'pf2e:GKIKJNInDev72qai': design('Drape Ambient Magic: your ostilli wraps you in a bubble of refracting light and you vanish from sight.', () => [
    aura('Refracting bubble', ['condition.boon.02.001.refraction'], { stageId: 'rf', scale: 1.1, duration: 1800, fadeIn: 300, fadeOut: 600 }),
    motion('flicker', 'source', { after: 'rf', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ], SILENT),

  'pf2e:rJTg9cKnBF0jsGbr': design('Draw From the Pages: you cast directly from your open spellbook; a conjuration circle unfolds as the page releases its spell.', () =>
    quiet('Spell from the page', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { scale: 0.8, duration: 1600, below: true }), SILENT),

  'pf2e:YMhmebfXAoOFXeSB': design("Drifter's Wake: you drift across the field striking each enemy in turn as you pass.", () => [
    motion('rush', 'source', { stageId: 'drift', duration: 2600, distance: 4, motionRange: 'distance', intensity: 0.4 }),
    impact('Passing Strikes', SLASH, { after: 'drift', anchor: 'start', offset: 600, duration: 1100, targetStagger: 500 }),
    motion('recoil', 'targets', { after: 'drift', anchor: 'start', offset: 800, duration: 600, intensity: 0.4 }),
  ], SILENT),

  'pf2e:49F65W6VwuXhmv8K': design('Drink Blood: you sink your fangs into a helpless creature and drink.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 1000, intensity: 0.4 }),
    impact('Fangs', ['bite.200px.red'], { stageId: 'hit', after: 'sw', anchor: 'start', offset: 300, duration: 1000, scale: 0.7 }),
    impact('Blood drawn', ['markers.drop.red'], { after: 'hit', anchor: 'start', offset: 400, duration: 1400, scale: 0.4, ...above, fadeOut: 400 }),
  ], ab('naturalPierce')),

  'pf2e:vZwa0PZLQvm3X5ME': design('Drink of my Foes: your blade glows as it drinks the foe\'s vitality and heals you.', () => [
    cast('Blade drinks', ['energy_strands.in.red', 'energy_strands.in.green'], { stageId: 'df', scale: 0.7, duration: 1200 }),
    aura('Vitality restored', ['healing_generic.burst.yellowwhite', 'healing_generic.200px.yellow'], { after: 'df', anchor: 'start', offset: 600, duration: 1500, scale: 0.8 }),
  ], sp('healing')),

  'pf2e:uS3qDAgOkZ7b8ERL': design('Drive: you pilot the vehicle forward.', () => [
    motion('rush', 'source', { delay: 0, duration: 2200, distance: 3, motionRange: 'distance', intensity: 0.35 }),
    cast('Wake', ['wind_lines.01.01.white'], { delay: 200, scale: 0.8, duration: 1400, opacity: 0.6 }),
  ], SILENT),

  'pf2e:HYNhdaPtF1QmQbR3': design('Drop Prone: you throw yourself flat to the ground.', () => [
    motion('press', 'source', { delay: 0, duration: 900, intensity: 0.6 }),
    cast('Dust', ['smoke.puff.ring.01.white'], { delay: 350, scale: 0.5, duration: 900, opacity: 0.5, below: true }),
  ], SILENT),

  'pf2e:xGqOIheAOV12RGU4': design("Dueling Counter: you spend a spell to counter your opponent's casting — their magic unravels.", () => [
    cast('Counterspell', ['magic_signs.rune.abjuration.complete.blue'], { stageId: 'dc', scale: 0.5, duration: 1100 }),
    impact('Magic unravels', ['impact.011.blue', 'impact.011.blue'], { after: 'dc', anchor: 'start', offset: 450, duration: 1200, scale: 0.8 }),
  ], sp('dispel')),

  'pf2e:KyKXp599tK9BgodC': design('Dutiful Retaliation: your eidolon flashes with ectoplasmic energy that lashes the attacker.', () => [
    cast('Ectoplasm flares', ['energy_strands.complete.dark_green', 'energy_strands.complete.blue.01'], { stageId: 'dr', scale: 0.8, duration: 1000 }),
    impact('Lash', ['impact.012.green', 'impact.012.blue'], { after: 'dr', anchor: 'start', offset: 400, duration: 1000, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'dr', anchor: 'start', offset: 500, duration: 600, intensity: 0.5 }),
  ], SILENT),

  'pf2e:DS9sDOWkXrz2xmHi': design('Eldritch Shot: a spell rides your arrow — a magical arrow streaks out and its spell bursts on contact.', () =>
    shot(['arrow.lightning.purple', 'arrow.physical.blue'], ['impact.011.purple', 'impact.011.blue'], { aim: ['cast_generic.03.bluepurple', 'cast_generic.03.blue'], accent: ['Spell released', ['impact.012.purple', 'impact.012.blue'], { scale: 0.7 }] }), ab('bow')),

  'pf2e:6lbr0Jnv0zMB5uGb': design('Elemental Blast: you gather matter from your kinetic aura and hurl it — the bolt and impact match the chosen element.', () => ({
    recipe: { elementChoice: true },
    stages: [
      cast('Matter gathers', ['particles.swirl.greenyellow.01', 'particles.swirl.greenyellow.01'], { stageId: 'eb-in', scale: 0.6, duration: 900, elementTint: true }),
      motion('throw', 'source', { after: 'eb-in', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
      // Each element's projectile flies its own clip and the blast lands when it arrives (contacts measured on
      // the 30 ft JB2A clips: wood's leaves arrive at 1.3 s). Sequencer picks the clip by distance (wood runs
      // 3.5 s at 5 ft to 5.5 s at 90 ft), so the flight lasts as long as the longest and plays once: a shorter
      // clip ends instead of looping back to its start after the hit.
      travel('Elemental blast', ['ranged.02.projectile.01.yellow', 'ranged.02.projectile.01.yellow'], { stageId: 'eb', after: 'eb-in', anchor: 'start', offset: 550, duration: 2200, contact: 450, oneShot: true, elementTint: true,
        elementTiming: {
          fire: { duration: 1800, contact: 550 }, cold: { duration: 3250, contact: 950 }, electricity: { duration: 3200, contact: 1050 },
          air: { duration: 1000, contact: 450 }, earth: { duration: 3300, contact: 1400 }, metal: { duration: 2350, contact: 600 },
          water: { duration: 2500, contact: 550 }, wood: { duration: 5550, contact: 1300 },
        },
        elementAssets: {
          fire: ['jb2a.fire_bolt.orange'], cold: ['jb2a.spell_projectile.ice_shard.blue'], electricity: ['jb2a.bolt.lightning.blue', 'jb2a.witch_bolt.blue'],
          air: ['jb2a.gust_of_wind.veryfast'], earth: ['jb2a.boulder.toss.02.01.stone.brown'], metal: ['jb2a.bolt.physical.white02', 'jb2a.bolt.physical.orange'],
          water: ['jb2a.ranged.03.projectile.01.bluegreen'], wood: ['jb2a.swirling_leaves.ranged.greenorange'],
        } }),
      impact('Blast lands', ['impact.005.white', 'impact.005.orange'], { after: 'eb', anchor: 'arrival', duration: 1100, scale: 0.8, elementTint: true,
        elementAssets: {
          fire: ['jb2a.impact.fire.01.orange'], cold: ['jb2a.impact.frost.white', 'jb2a.impact.frost.white.01'], electricity: ['jb2a.static_electricity.01.blue'],
          air: ['jb2a.smoke.puff.ring.01.white'], earth: ['jb2a.impact.ground_crack.01.orange', 'jb2a.impact.ground_crack.orange.01'], metal: ['jb2a.impact.005.white', 'jb2a.impact.005.orange'],
          water: ['jb2a.impact.water.02.blue'], wood: ['jb2a.swirling_leaves.outburst.01.greenorange', 'jb2a.swirling_leaves.outburst.01.pink'],
        } }),
      motion('recoil', 'targets', { after: 'eb', anchor: 'arrival', duration: 600, intensity: 0.5 }),
    ],
  }), SILENT),

  'pf2e:Cb9XbKqHBHPAbQKk': design('Elemental Burst: your eidolon rips off a chunk of its elemental body and hurls it into a group of foes, where it bursts.', () => [
    projectile('Elemental chunk', ['boulder.toss.02.01.stone.brown'], { stageId: 'ch', duration: 1100, scale: 0.6 }),
    area('Burst', ['explosion.04.orange', 'explosion.01.orange'], { after: 'ch', anchor: 'arrival', duration: 1500 }),
    motion('shake', 'source', { delay: 0, duration: 600, intensity: 0.3 }),
    motion('recoil', 'targets', { after: 'ch', anchor: 'arrival', offset: 200, duration: 700, intensity: 0.5 }),
  ], sp('explosion')),

  'pf2e:H8EXYfvFOSuq6vo8': design('Elemental Maelstrom: your eidolon becomes a swirling vortex and rampages through its foes, striking each.', () => [
    aura('Vortex form', ['whirlwind.bluegrey', 'whirlwind.bluegrey'], { stageId: 'vx', scale: 1.1, duration: 3000, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    motion('rush', 'source', { after: 'vx', anchor: 'start', offset: 300, duration: 2400, distance: 4, motionRange: 'distance', intensity: 0.4 }),
    impact('Rampage', ['impact.005.white', 'impact.005.orange'], { after: 'vx', anchor: 'start', offset: 800, duration: 1000, scale: 0.7, targetStagger: 400 }),
    motion('recoil', 'targets', { after: 'vx', anchor: 'start', offset: 900, duration: 600, intensity: 0.5 }),
  ], sp('wind')),

  'pf2e:V4HToYPQlkw8AW50': design('Embrace of Destiny: a golden thread of fate drags the enemy to your side (Will save).', () => [
    travel('Thread of destiny', ['energy_strands.range.standard.orange', 'energy_strands.range.standard.purple'], { stageId: 'ed', duration: 1400, ...tint('#f2c94c') }),
    motion('rush', 'targets', { after: 'ed', anchor: 'arrival', duration: 1300, distance: 2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.5 }),
  ], SILENT),

  'pf2e:OJ9cIvPukPT0rppR': design("Empower Breath: your eidolon draws in the might of archdragons, building toward a spectacular breath.", () =>
    quiet('Archdragon might', ['energy_strands.in.yellow', 'energy_strands.in.green'], { scale: 0.8, duration: 1400 }), SILENT),

  'pf2e:e2ePMDa7ixbLRryj': design('Encouraging Words: a quick pep talk lifts an ally\'s spirits.', () =>
    mark('Encouraged', ['bardic_inspiration.greenorange'], { src: ['Pep talk', ['soundwave.01.green', 'soundwave.01.blue'], { scale: 0.5 }], o: { scale: 0.7, duration: 1600 } }), SILENT),

  'pf2e:lI4JCQcqvrZE2U5n': design('End It!: your proclamation breaks the outnumbered enemies, who cower and flee (Will save).', () =>
    fear({ shout: ['soundwave.02.red', 'soundwave.02.blue'], shoutO: { scale: 1.4 }, extra: [cast('Banner raised', ['ward.star.yellow'], { delay: 0, scale: 0.5, offsetY: -0.65, offsetUnits: 'token', duration: 1500 })] }), ab('battleCry')),

  'pf2e:7qjfYsLNTr17Aftf': design('Energy Emanation: energy bursts outward from your body into every adjacent creature, in your energy\'s color.', () => ({
    recipe: { elementChoice: true },
    stages: [
      cast('Energy bursts', ['impact.012.blue', 'impact.012.blue'], { stageId: 'ee', scale: 1.4, duration: 1200, elementTint: true }),
      impact('Adjacent creatures hit', ['impact.005.white', 'impact.005.orange'], { after: 'ee', anchor: 'start', offset: 300, duration: 900, scale: 0.6, elementTint: true }),
      motion('recoil', 'targets', { after: 'ee', anchor: 'start', offset: 350, duration: 600, intensity: 0.5 }),
    ],
  }), SILENT),

  'pf2e:TSDbyYRQwhIyY2Oq': design('Energy Shot: as combat begins you charge your firearm with crackling magical energy (no shot yet).', () =>
    quiet('Weapon charged', ['static_electricity.01.blue'], { scale: 0.6, duration: 1500, offsetX: 0.3, offsetUnits: 'token', elementTint: true }), SILENT),

  'pf2e:qYdreGwopQ1ODgC6': design("Engineer's Efficiency: you aim your light mortar and send a shell arcing at the target.", () => [
    cast('Aim', ['hunters_mark.pulse.01.green'], { stageId: 'aim', scale: 0.4, duration: 800 }),
    projectile('Mortar shell', ['throwable.launch.cannon_ball.01.black'], { stageId: 'shell', after: 'aim', anchor: 'start', offset: 500, duration: 1300, scale: 0.6 }),
    impact('Shell bursts', ['explosion.shrapnel.bomb.01.black'], { after: 'shell', anchor: 'arrival', duration: 1300, scale: 0.7 }),
    motion('recoil', 'source', { after: 'shell', anchor: 'start', duration: 500, intensity: 0.3 }),
  ], sp('explosion')),

  'pf2e:PaQL7cyry64nx9CG': design('Enlightenment in Adversity: celestial insight follows a hard failure — a soft golden spark.', () =>
    fortune({ glint: ['markers.light.complete.yellow', 'markers.light.complete.blue'] }), SILENT),

  'pf2e:djULKW76BbSoN3zb': design('Enter Spirit Trance: you sink into a self-imposed trance and spirit wisps steady your body.', () => [
    aura('Spirit wisps', ['spirit_guardians.blue.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'tr', scale: 1, duration: 2400, opacity: 0.75, fadeIn: 400, fadeOut: 600 }),
    motion('levitate', 'source', { after: 'tr', anchor: 'start', offset: 300, duration: 1800, intensity: 0.3 }),
  ], sp('spirit')),

  'pf2e:5bCZGpp9yFHXDz1j': design("Entity's Resurgence: as you fall, the entity seizes control — eyes open in a dark aura and your body jerks upright.", () => [
    aura('Entity takes control', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { stageId: 'er', scale: 1.1, duration: 2000, fadeIn: 200, fadeOut: 500 }),
    cast('Eyes', ['eyes.01.dark_purple.many', 'eyes.01.dark_green.many'], { after: 'er', anchor: 'start', offset: 300, duration: 1500, scale: 0.6 }),
    motion('shake', 'source', { after: 'er', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ], sp('whispers')),

  'pf2e:BrCbXsCUIFYfu26E': design('Entreat Pact: occult pact energy coils around you to help fulfill your promise.', () =>
    fortune({ glint: ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], stars: ['twinkling_stars.points06.white'] }), SILENT),

  'pf2e:s4V7JWSMF9JPJAeX': design('Envenom: you coat your weapon or ammunition with vishkanyan venom.', () => venom('Venom applied'), sp('poison')),

  'pf2e:wfUIsKBxCBfXi1TF': design('Erupting Spurs: the bone spurs inside the bleeding creature erupt outward (basic Fortitude).', () => [
    impact('Bone spurs erupt', ['ice_spikes.radial.burst.white'], { stageId: 'es', duration: 1300, scale: 0.6, ...tint('#e8dcc0') }),
    impact('Blood', ['liquid.splash02.red'], { after: 'es', anchor: 'start', offset: 250, duration: 1000, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'es', anchor: 'start', duration: 800, intensity: 0.6 }),
  ], sp('pierce')),

  'pf2e:SkZAQRkLLkmBQNB9': design('Escape: you strain against your bonds and twist free.', () => [
    motion('shake', 'source', { stageId: 'strain', duration: 900, intensity: 0.5 }),
    cast('Bonds give', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'strain', anchor: 'start', offset: 200, scale: 0.7, duration: 1000, fadeOut: 300 }),
    motion('dodge', 'source', { after: 'strain', anchor: 'end', duration: 900, distance: 0.5, intensity: 0.5 }),
  ], SILENT),

  'pf2e:GkcfzMAJVX159ua7': design("Executioner's Volley: the banner signals a firing squad; a volley of shots converges on the doomed target.", () =>
    signal({ answer: ['markers.skull.dark_red', 'markers.skull.dark_orange'], answerLabel: 'Doomed target', answerO: { scale: 0.5 },
      extra: [impact('Volley lands', ['impact.005.white', 'impact.005.orange'], { after: 'sig-ans', anchor: 'start', offset: 300, duration: 900, scale: 0.6, repeats: 3, repeatInterval: 250 })] }), ab('ranged')),

  'pf2e:IV8sgoLO6ShD3DCJ': design('Expel Maelstrom: you hurl your curse maelstrom into an unlucky creature, where it swirls around them.', () => [
    travel('Maelstrom expelled', ['energy_strands.range.multiple.dark_purple', 'energy_strands.range.multiple.purple.01'], { stageId: 'em', duration: 1200 }),
    impact('Cursed', ['whirlwind.purple', 'whirlwind.bluegrey'], { after: 'em', anchor: 'arrival', duration: 1800, scale: 0.7, opacity: 0.8 }),
    impact('Curse mark', ['condition.curse.01.001.purple', 'condition.curse.01.001.red'], { after: 'em', anchor: 'arrival', offset: 300, duration: 1600, scale: 0.6 }),
  ], SILENT),

  'pf2e:naKVqd8POxcnGclz': design('Explode: you push your innovation past safety limits and it detonates around you.', () => [
    motion('shake', 'source', { stageId: 'build', duration: 700, intensity: 0.4 }),
    cast('Innovation detonates', ['explosion.01.orange'], { stageId: 'boom', after: 'build', anchor: 'start', offset: 500, scale: 1.4, duration: 1500 }),
    impact('Shrapnel and fire', ['impact.fire.01.orange'], { after: 'boom', anchor: 'start', offset: 200, duration: 1100, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 250, duration: 700, intensity: 0.6 }),
  ], sp('explosion')),

  'pf2e:fodJ3zuwQsYnBbtk': design('Exploit Vulnerability: you draw an esoteric object, divine the foe\'s weakness, and a rune of exploitation flares on it.', () =>
    mark('Weakness exposed', ['markers.runes.orange', 'markers.runes.orange'], { src: ['Esoterica', ['magic_signs.rune.divination.complete.orange', 'magic_signs.rune.divination.complete.blue'], { scale: 0.45 }], o: { scale: 0.55, ...above, duration: 1800 } }), SILENT),

  'pf2e:low5ORd87QeA9Oug': design('Extract Element: you pull elemental matter out of the creature, which streams away and weakens it.', () => ({
    recipe: { elementChoice: true },
    stages: [
      impact('Matter torn out', ['particles.inward.greenyellow.01.01', 'particles.inward.greenyellow.01.01'], { stageId: 'xe', duration: 1300, scale: 0.8, elementTint: true }),
      motion('stagger', 'targets', { after: 'xe', anchor: 'start', offset: 200, duration: 800, intensity: 0.5 }),
      cast('Absorbed', ['energy_strands.in.yellow', 'energy_strands.in.green'], { after: 'xe', anchor: 'start', offset: 700, duration: 1100, scale: 0.6, elementTint: true }),
    ],
  }), SILENT),

  'pf2e:AJeLwbQBt1YH3S6v': design('Fade Into Daydreams: figments haze your outline and you become indistinct.', () => [
    aura('Figment haze', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'fd', scale: 1, duration: 1400, opacity: 0.6, ...tint('#d9a6e0') }),
    motion('flicker', 'source', { after: 'fd', anchor: 'start', offset: 300, duration: 1000, intensity: 0.4 }),
  ], SILENT),

  'pf2e:gU93T2UqxLsX9gyF': design('Fated Not to Die: a harrow draw turns death aside — a faint golden glimmer over your fallen body.', () =>
    fortune({ glint: ['markers.light.complete.yellow', 'markers.light.complete.blue'], stars: ['twinkling_stars.points07.white'] }), SILENT),

  'pf2e:QNAVeNKtHA0EUw4X': design('Feint: a misleading flourish — you fake one way, an afterimage lingers, and the foe is left off-guard.', () => [
    sprite('Fake-out', { delay: 0, duration: 700, opacity: 0.4 }),
    motion('dodge', 'source', { stageId: 'fk', duration: 900, distance: 0.4, intensity: 0.5 }),
    motion('lunge', 'source', { after: 'fk', anchor: 'end', duration: 700, intensity: 0.3 }),
    impact('Off-guard', ['markers.shield_cracked.purple'], { after: 'fk', anchor: 'start', offset: 500, duration: 1400, scale: 0.45, ...above, fadeOut: 400 }),
  ], SILENT),

  'pf2e:K3hd3w20M707t6Iq': design('Feral Swing: you lash out with both arms and spirit claws rake everything in the 15-foot cone (Reflex save).', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    area('Raking cone', ['breath_weapons02.burst.cone.holy.yellow', 'template_cone_PF2e.001.001.purplered'], { stageId: 'cone', after: 'sw', anchor: 'start', offset: 250, duration: 1300, opacity: 0.7 }),
    impact('Spirit claws', ['claws.200px.bright_yellow', 'claws.200px.red'], { after: 'sw', anchor: 'start', offset: 400, duration: 1000, scale: 0.8, targetStagger: 150 }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 300, duration: 600, intensity: 0.5 }),
  ], sp('claws')),

  'pf2e:FomdyTNeKcV1dQMx': design('Fey Jump: you slip through the First World for an instant and vanish in a green misty step.', () => [
    cast('Through the First World', ['misty_step.01.green', 'misty_step.01.blue'], { stageId: 'fj', scale: 1, duration: 1300 }),
    motion('flicker', 'source', { after: 'fj', anchor: 'start', offset: 200, duration: 900, intensity: 0.7 }),
  ], sp('teleport')),

  'pf2e:TMBXArwICQRJdwT6': design("Fey's Fortune: fey luck flutters around you as you roll twice.", () =>
    fortune({ glint: ['fairies.outward_burst.01.bluepurple'], stars: ['twinkling_stars.points06.white'] }), SILENT),

  'pf2e:tNrBIYct9l1lrW1I': design('Field of Roots: your eidolon\'s roots burst from the ground around every foe in reach.', () => [
    motion('sink', 'source', { delay: 0, duration: 1000, intensity: 0.3 }),
    impact('Roots erupt', ['vine.complete.nature.group.01.green'], { stageId: 'fr', delay: 400, duration: 2000, scale: 0.8, below: true, targetStagger: 150 }),
    motion('shake', 'targets', { after: 'fr', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], sp('vines')),

  'pf2e:hi56uHG1aAb84Zzu': design('Fight with Fear: you turn the creature\'s mental attack back on it as dread (Will save).', () =>
    fear({ shout: ['soundwave.01.purple', 'soundwave.01.blue'], sign: ['markers.fear.dark_purple'] }), sp('fear')),

  'pf2e:jbmXxq56swDYw8hy': design('Final Spite: with your last strength you lash out in one spiteful Strike before collapsing.', () =>
    [...strike({ accent: ['Spite', ['impact.005.dark_red', 'impact.005.orange'], { scale: 0.6 }] }),
      motion('sink', 'source', { after: 'hit', anchor: 'start', offset: 700, duration: 1000, intensity: 0.4 })]),

  'pf2e:EHa0owz6mccnmSBf': design('Final Surge: the mutagen burns out in one last double Stride.', () => [
    motion('rush', 'source', { delay: 0, duration: 2200, distance: 4, motionRange: 'distance', intensity: 0.5 }),
    sprite('Blur', { delay: 200, duration: 800, opacity: 0.35 }),
  ], SILENT),

  'pf2e:4IxCKbGaEM9nUhld': design('Finish The Job: after the missed shot you follow through with a melee Strike.', () => strike()),

  'pf2e:UEkGL7uAGYDPFNfK': design('Fire in the Hole: the rigged bombs explode as a creature enters the hazard\'s space.', () => [
    impact('Bombs explode', ['explosion.shrapnel.bomb.01.black'], { stageId: 'fh', duration: 1300, scale: 0.9 }),
    impact('Fireball', ['explosion.01.orange'], { after: 'fh', anchor: 'start', offset: 150, duration: 1400, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'fh', anchor: 'start', offset: 200, duration: 700, intensity: 0.6 }),
  ], sp('explosion')),

  'pf2e:ITWUi1r8Z7EtChkB': design('Flash of Grandeur: imperious divine light flashes from you and surrounds the foe that hurt your ally.', () => [
    cast('Divine flash', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'fg', scale: 0.9, duration: 1300 }),
    impact('Light surrounds the foe', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'fg', anchor: 'start', offset: 500, duration: 1600, scale: 0.9, ...tint('#ffe58a') }),
  ], sp('holy')),

  'pf2e:ObFY26oKlreyVIUm': design('Fleeting Arc through Heaven and Earth: your weapon sweeps a blazing rainbow arc across the cone.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    area('Blazing arc', ['breath_weapons02.burst.cone.holy.yellow', 'template_cone_PF2e.001.001.purplered'], { stageId: 'arc', after: 'sw', anchor: 'start', offset: 250, duration: 1800 }),
    impact('Rainbow light', ['dancing_light.purplegreen'], { after: 'arc', anchor: 'start', offset: 400, duration: 1300, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'arc', anchor: 'start', offset: 400, duration: 700, intensity: 0.5 }),
  ], sp('holy')),

  'pf2e:04VQuQih77pxX06q': design('Fling Magic: your wand implement flings a bolt of raw magical energy at the target (Reflex save).', () => [
    cast('Wand flick', ['cast_generic.03.bluepurple', 'cast_generic.03.blue'], { stageId: 'fm', scale: 0.6, duration: 800 }),
    travel('Flung magic', ['ranged.03.projectile.01.pinkpurple', 'ranged.03.projectile.01.bluegreen'], { stageId: 'fm-fly', after: 'fm', anchor: 'start', offset: 400, duration: 1200 }),
    impact('Magic bursts', ['impact.012.purple', 'impact.012.blue'], { after: 'fm-fly', anchor: 'arrival', duration: 1100, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'fm-fly', anchor: 'arrival', duration: 600, intensity: 0.4 }),
  ], sp('force')),

  'pf2e:TsvrmoOYLOm3cG8t': design('Flowing Engulf: your eidolon flows through creatures in its path, engulfing them.', () => [
    motion('rush', 'source', { stageId: 'flow', duration: 2400, distance: 4, motionRange: 'distance', intensity: 0.4 }),
    impact('Engulfed', ['liquid.blob.green', 'liquid.blob.blue'], { after: 'flow', anchor: 'start', offset: 700, duration: 1600, scale: 0.8, opacity: 0.85, targetStagger: 300 }),
    motion('shake', 'targets', { after: 'flow', anchor: 'start', offset: 800, duration: 800, intensity: 0.4 }),
  ], sp('water')),

  'pf2e:6xWX8Ey5ShAyj1HO': design('Flowing Spirit Strike: two Strikes with the gleaming blade, each trailing spirit light.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    impact('First Strike', ['melee_attack.01.trail.01.blueyellow', 'melee_attack.01.trail.01.blueyellow'], { stageId: 'h1', after: 'sw', anchor: 'start', offset: 250, duration: 1100 }),
    impact('Second Strike', ['melee_attack.01.trail.02.blueyellow', 'melee_attack.01.trail.01.blueyellow'], { stageId: 'h2', after: 'h1', anchor: 'start', offset: 650, duration: 1100, mirrorX: true }),
    impact('Spirit gleam', ['sacred_flame.target.white', 'sacred_flame.target.yellow'], { after: 'h2', anchor: 'start', offset: 300, duration: 1100, scale: 0.6, opacity: 0.8 }),
    motion('recoil', 'targets', { after: 'h1', anchor: 'start', duration: 1300, intensity: 0.4 }),
  ], ab('katana')),

  'pf2e:nbfNETdpee8CVM17': design('Flurry of Blows: two rapid unarmed Strikes in a blur of fists.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    impact('Flurry', ['flurry_of_blows.physical.orange', 'flurry_of_blows.physical.blue'], { stageId: 'fl', after: 'sw', anchor: 'start', offset: 200, duration: 1400 }),
    impact('Second blow', FIST, { after: 'fl', anchor: 'start', offset: 700, duration: 900, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'fl', anchor: 'start', offset: 200, duration: 1100, intensity: 0.5 }),
  ], ab('unarmed')),

  'pf2e:cS9nfDRGD83bNU1p': design('Fly: you take to the air and glide with your fly Speed.', () => [
    cast('Takeoff', ['swirling_feathers.outburst.01.textured'], { stageId: 'fly', scale: 0.8, duration: 1300 }),
    motion('levitate', 'source', { after: 'fly', anchor: 'start', offset: 200, duration: 1800, intensity: 0.6 }),
  ], sp('wind')),

  // ── 191–247 ────────────────────────────────────────────────────────────
  'pf2e:dypCcXb9mwVbg6xD': design('Flyby Attack: you swoop past on the wing and Strike along the way.', () => [
    motion('leap', 'source', { stageId: 'swoop', duration: 1600, distance: 6, motionRange: 'target', motionEndpoint: 'past', jumpHeight: 0.6, intensity: 0.5 }),
    impact('Passing Strike', SLASH, { stageId: 'hit', after: 'swoop', anchor: 'start', offset: 600, duration: 1200 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 600, intensity: 0.5 }),
  ], SILENT),

  'pf2e:DRHtgPhncTSs7Sdd': design('For My House!: you proclaim your house and raise its heraldry.', () => [
    cast('Heraldry raised', ['markers.shield_rampart.complete.01.orange'], { stageId: 'h', scale: 0.6, offsetY: -0.55, offsetUnits: 'token', duration: 1500 }),
    cast('Proclamation', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { after: 'h', anchor: 'start', offset: 250, scale: 0.8, duration: 1100 }),
    motion('pulse', 'source', { delay: 0, duration: 800, intensity: 0.4 }),
  ], ab('battleCry')),

  'pf2e:2U7V8K0zSFGyZHrP': design('For Talmandor! For Freedom!: you raise your banner high and unshakable conviction settles on your squad.', () =>
    signal({ answer: ['bless.200px.intro.yellow'], answerLabel: 'Conviction', answerO: { scale: 0.7, offsetY: 0 } }), ab('battleCry')),

  'pf2e:SjmKHgI7a5Z9JzBx': design('Force Open: you put your shoulder into the door or lid and heave it open.', () => [
    motion('slam', 'source', { stageId: 'heave', duration: 900, intensity: 0.6 }),
    cast('Wood splinters', ['impact.005.white', 'impact.005.orange'], { after: 'heave', anchor: 'start', offset: 350, scale: 0.5, duration: 800, offsetX: 0.5, offsetUnits: 'token' }),
  ], SILENT),

  'pf2e:r0qPSxLoa1xRSWYL': design('Forced Pact: occult chains bind both you and the target to the same restriction (Will save).', () => [
    cast('Pact forged', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { stageId: 'fp', scale: 0.7, duration: 1500 }),
    impact('Pact binds', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'fp', anchor: 'start', offset: 400, duration: 1700, scale: 0.8 }),
  ], sp('chainBinding')),

  'pf2e:VOEWhPQfN3lvHivK': design('Foresight: the warding foresight lets its subject see the danger coming — a divination sigil flashes over them.', () =>
    mark('Danger foreseen', ['magic_signs.rune.divination.complete.blue'], { o: { scale: 0.5, ...above, duration: 1400 } }), SILENT),

  'pf2e:SRdiCXHSLxqu3C67': design('Fortify Focus: with a touch you pour focus into your companion, who brightens.', () => [
    travel('Focus shared', ['energy_strands.range.standard.blue', 'energy_strands.range.standard.purple'], { stageId: 'ff', duration: 1300, opacity: 0.85 }),
    impact('Focus restored', ['on_token_buff.001.001.blue'], { after: 'ff', anchor: 'arrival', duration: 1500, scale: 1, opacity: 0.8 }),
  ], SILENT),

  'pf2e:Ei4T4aQx0a5EdBhm': design("Fracture Mountains: one crushing Strike with the Titan's Breaker, heavy enough to crack the ground.", () =>
    strike({ hit: HEAVY, heavy: true, accent: ['Ground fractures', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { scale: 0.9, below: true }] }), ab('hammer')),

  'pf2e:N9b6ZB71ssE1gGYJ': design('Fuel Impossible Spell: you pour more of yourself into the impossible spell — a surge of bright strands.', () =>
    buff('Self poured in', ['energy_strands.in.purple', 'energy_strands.in.green'], 'Impossible power', ['energy_strands.overlay.pinkyellow', 'energy_strands.overlay.blue']), SILENT),

  'pf2e:06frwOOuo4HJtivl': design('Furious Strike: your eidolon makes one ferocious, heavy claw Strike.', () =>
    strike({ hit: CLAW, heavy: true, scale: 1.2, accent: ['Ferocity', ['impact.005.dark_red', 'impact.005.orange'], { scale: 0.6 }] }), ab('claw')),

  'pf2e:URxnrN8ji84AoVup': design('Gather to Me!: the banner signals every squadmate to rally to you.', () =>
    signal({ answer: ['ui.chevrons3.green', 'ui.chevrons3.yellow'], extra: [aura('Rally point', ['markers.circle_of_stars.yellowblue', 'markers.circle_of_stars.blue'], { delay: 600, scale: 1, duration: 1800, below: true, fadeOut: 500 })] }), ab('battleCry')),

  'pf2e:O1iircZOOCo42r9Y': design('Ghost Shot: a shot from hiding — the muzzle smoke hides you as the round finds its mark.', () =>
    [...shot(['bullet.01.orange'], ['impact.005.orange'], { aim: ['smoke.puff.side.grey'] }),
      cast('Concealing smoke', ['smoke.puff.side.grey'], { after: 'fly', anchor: 'start', duration: 1200, scale: 0.6, opacity: 0.6 })], ab('firearm')),

  'pf2e:tzuYnmYCvA3zrj6w': design('Giant-Felling Comet: you shoot the Starshot and it detonates in a 5-foot burst of starlight (Reflex save).', () => [
    travel('Starshot', ['guiding_bolt.01.blueyellow'], { stageId: 'ss', duration: 1300 }),
    area('Comet detonation', ['explosion.03.blueyellow'], { after: 'ss', anchor: 'arrival', duration: 1600 }),
    motion('recoil', 'source', { after: 'ss', anchor: 'start', duration: 500, intensity: 0.3 }),
    motion('recoil', 'targets', { after: 'ss', anchor: 'arrival', offset: 200, duration: 700, intensity: 0.5 }),
  ], sp('explosion')),

  'pf2e:tuZnRWHixLArvaIf': design('Glimpse of Redemption: divine light shields the harmed ally while the enemy hesitates under visions of redemption.', () => [
    cast('Champion\'s light', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'gr', scale: 0.8, duration: 1200 }),
    impact('Divine shield', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { stageId: 'gr-sh', after: 'gr', anchor: 'start', offset: 450, duration: 1700, scale: 0.9, ...tint('#ffe58a') }),
    impact('Redeeming light', ['bless.200px.intro.yellow'], { after: 'gr-sh', anchor: 'start', offset: 300, duration: 1500, scale: 0.8, opacity: 0.8 }),
    motion('brace', 'source', { delay: 0, duration: 900, intensity: 0.4 }),
  ], sp('holy')),

  'pf2e:Yfl6q6Pi42FttDRE': design('Glimpse Vulnerability: you glimpse a hidden vulnerability and mark it on the creature.', () =>
    mark('Vulnerability', ['hunters_mark.pulse.01.purple', 'hunters_mark.pulse.01.green'], { src: ['Glimpse', ['eyes.01.purple.single', 'eyes.01.dark_green.single'], { scale: 0.4, ...above }], o: { scale: 0.6 } }), SILENT),

  'pf2e:JjSNVfQO7qc4bgz1': design('Gluttonous Feast: spirits of the runelords of gluttony appear among the living and feast on their vitality.', () => [
    cast('Gluttony summoned', ['magic_signs.circle.02.conjuration.intro.dark_red', 'magic_signs.circle.02.conjuration.intro.yellow'], { stageId: 'gf', scale: 0.8, duration: 1300, below: true }),
    impact('Spirits feast', ['spirit_guardians.dark_red.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'gf-t', after: 'gf', anchor: 'start', offset: 500, duration: 2200, scale: 0.7, opacity: 0.85, ...tint('#b8483a') }),
    cast('Vitality devoured', ['energy_strands.in.red', 'energy_strands.in.green'], { after: 'gf-t', anchor: 'start', offset: 900, duration: 1200, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'gf-t', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], sp('drain')),

  'pf2e:izvfZ561JTdeyh6i': design('Goblin Jubilee: riotous fire-and-sonic chaos fills the 20-foot burst — fireworks and explosions everywhere (Fortitude save).', () => [
    area('Chaotic burst', ['explosion.01.orange'], { stageId: 'gj', duration: 1600 }),
    area('Fireworks', ['firework.02.greenred', 'firework.02.orangeyellow.01'], { after: 'gj', anchor: 'start', offset: 300, duration: 1600, opacity: 0.9 }),
    impact('Sonic blast', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { after: 'gj', anchor: 'start', offset: 500, duration: 1000, scale: 0.6 }),
    motion('shake', 'targets', { after: 'gj', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ], sp('explosion')),

  'pf2e:3yoajuKjwHZ9ApUY': design('Grab an Edge: as you fall you catch a handhold and jerk to a stop.', () => [
    motion('sink', 'source', { stageId: 'fall', duration: 700, intensity: 0.4 }),
    motion('shake', 'source', { after: 'fall', anchor: 'end', duration: 500, intensity: 0.3 }),
    cast('Grit', ['smoke.puff.side.grey'], { delay: 600, scale: 0.3, duration: 800, opacity: 0.5 }),
  ], SILENT),

  'pf2e:PMbdMWc2QroouFGD': design('Grapple: you lunge in and seize the creature with your free hand (Athletics vs Fortitude).', () => [
    motion('lunge', 'source', { stageId: 'grab', duration: 900, intensity: 0.6 }),
    impact('Seize', ['melee_generic.creature_attack.fist.001.yellow', 'melee_generic.creature_attack.fist.001.red'], { stageId: 'hit', after: 'grab', anchor: 'start', offset: 300, duration: 1000, scale: 0.7 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 900, intensity: 0.4 }),
  ], ab('unarmed')),

  'pf2e:rI2MSXR1MQzgQUO7': design('Grim Swagger: you flash your holstered gun and promise a grim fate; those who believe you cower (Will save).', () =>
    fear({ shout: ['soundwave.01.orangeyellow', 'soundwave.01.blue'], sign: ['markers.skull.dark_orange', 'markers.skull.dark_orange'] }), SILENT),

  'pf2e:VE8P7wCsKo5eSwAz': design('Guerrilla Assault: you reload your sling and loose a stone from cover.', () =>
    shot(['slingshot', 'bullet.02.orange'], ['impact.005.white', 'impact.005.orange']), ab('sling')),

  'pf2e:EuoCFSHTzi0VOfuf': design('Harrow the Fiend: a harrow reading against fiends sharpens your attacks — a crimson glint of fortune.', () =>
    fortune({ glint: ['glint.yellow.many'], stars: ['twinkling_stars.points07.orange'], extra: [aura('Against fiends', ['on_token_buff.001.001.purplered'], { delay: 600, scale: 0.9, duration: 1600, opacity: 0.7, fadeOut: 500 })] }), SILENT),

  'pf2e:GrzbczH9S3SHPiIQ': design('Harvest Blood: you consume the blood on your weapon, drawing it into yourself.', () => [
    cast('Blood drawn', ['energy_strands.in.red', 'energy_strands.in.green'], { stageId: 'hb', scale: 0.7, duration: 1200 }),
    cast('Droplets', ['markers.drop.red'], { after: 'hb', anchor: 'start', offset: 300, scale: 0.4, duration: 1200, offsetX: 0.3, offsetUnits: 'token' }),
  ], SILENT),

  'pf2e:h4Tzdhqfryp5m2fO': design('Harvest Heartsliver: inside the beast, you hack free a piece of its heart.', () => [
    motion('lunge', 'source', { stageId: 'cut', duration: 900, intensity: 0.5 }),
    cast('Heartsliver', ['markers.heart.dark_red', 'markers.heart.pink'], { after: 'cut', anchor: 'start', offset: 400, scale: 0.5, duration: 1500, offsetX: 0.4, offsetUnits: 'token' }),
  ], SILENT),

  'pf2e:4oHjLO6qMfxIchRB': design('Haunting Visage: your condensed eidolon twists into a terrifying shape and onlookers recoil in horror.', () => [
    cast('Shape twists', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'hv', scale: 1, duration: 1100 }),
    motion('shake', 'source', { after: 'hv', anchor: 'start', duration: 800, intensity: 0.5 }),
    impact('Horror', ['markers.horror.purple'], { after: 'hv', anchor: 'start', offset: 500, duration: 1600, scale: 0.5, ...above, fadeOut: 400 }),
    motion('cower', 'targets', { after: 'hv', anchor: 'start', offset: 600, duration: 1000, intensity: 0.5 }),
  ], ab('wail')),

  'pf2e:JtEzSceixS0WA8wn': design('Heaven Rains an Ending: your arrow multiplies into a cloud of weapons that rains over every enemy in the cone.', () => [
    motion('recoil', 'source', { delay: 0, duration: 600, intensity: 0.4 }),
    area('Raining weapons', ['volley_of_projectiles_ConePF2e.arrow.001.001.white', 'volley_of_projectiles_ConePF2e'], { stageId: 'rain', delay: 300, duration: 2200 }),
    motion('recoil', 'targets', { after: 'rain', anchor: 'start', offset: 900, duration: 700, intensity: 0.4 }),
  ], ab('longbow')),

  'pf2e:CJnA1wEg2kA5BXfe': design('Heavy is the Crown: the weight of authority crashes down on enemies in the 15-foot burst, pressing them low (Will save).', () => [
    cast('Authority', ['ward.star.yellow'], { stageId: 'cr', scale: 0.5, offsetY: -0.65, offsetUnits: 'token', duration: 1300 }),
    area('Crushing weight', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'cr', anchor: 'start', offset: 500, duration: 1800, opacity: 0.85, ...tint('#e9d48a') }),
    motion('press', 'targets', { after: 'cr', anchor: 'start', offset: 600, duration: 1100, intensity: 0.6 }),
  ], sp('gravity')),

  'pf2e:ASt94swgHlproIcd': design('Hellbreaker Strike: one heavy holy Strike that blazes with spirit light on a hit.', () =>
    strike({ heavy: true, hit: SLASH, accent: ['Holy blaze', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { scale: 0.9 }] }), sp('holy')),

  'pf2e:XMcnh4cSI32tljXa': design('Hide: you huddle into cover and fade from view — no dash, just a low crouch and a dimming shadow.', () => [
    motion('sink', 'source', { stageId: 'hide', duration: 1000, intensity: 0.3 }),
    cast('Fading into cover', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { after: 'hide', anchor: 'start', offset: 200, scale: 0.6, duration: 1200, opacity: 0.55 }),
    motion('flicker', 'source', { after: 'hide', anchor: 'start', offset: 600, duration: 900, intensity: 0.3 }),
  ], { ...SILENT, fx: false }),

  'pf2e:2HJ4yuEFY1Cast4h': design('High Jump: a short run-up and a vertical leap.', () => [
    motion('leap', 'source', { delay: 0, duration: 1800, distance: 1, motionRange: 'distance', jumpHeight: 1.3, intensity: 0.6 }),
    cast('Push-off', ['smoke.puff.ring.01.white'], { delay: 500, scale: 0.4, duration: 800, opacity: 0.5, below: true }),
  ], SILENT),

  'pf2e:a1FVA0l58GOEq6xP': design('Host of Wrath: the blood-red spirits of four runelords of wrath swirl around you.', () => runelordSpirits('Spirits of wrath', 'spirit_guardians.dark_red.spirits', '#c0392b'), ab('spirit')),

  'pf2e:JYi4MnsdFu618hPm': design("Hunt Prey: you study your quarry and a hunter's mark locks onto it.", () =>
    mark("Hunter's mark", ['hunters_mark.loop.01.green', 'hunters_mark.loop.01.green'], { src: ['Focus', ['eyes.01.dark_green.single'], { scale: 0.4, ...above }], o: { scale: 0.7, duration: 2400 } }), SILENT),

  'pf2e:I6gG9rqTTLkzrhKF': design('Hunt Runelord: you swear vengeance on one school of Thassilonian magic; its rune burns before you.', () =>
    buff('School designated', ['magic_signs.rune.evocation.complete.red'], 'Vengeance', ['on_token_buff.001.001.purplered'], { castO: { scale: 0.6, ...above } })),

  'pf2e:Yrc21SgKRWOMNo7C': design("Hunt the Razer's Pawn: you mark a known agent of the Razer as your quarry.", () =>
    mark('Quarry marked', ['hunters_mark.loop.01.red', 'hunters_mark.loop.01.green'], { src: ['Focus', ['eyes.01.dark_red.single', 'eyes.01.dark_green.single'], { scale: 0.4, ...above }], o: { scale: 0.7, duration: 2400 } }), SILENT),

  'pf2e:wKPtG0pzARZLGHZT': design('I Defy You!: you throw off the mental assault through sheer defiance and reroll.', () => [
    cast('Defiance', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'idy', scale: 0.6, duration: 900 }),
    aura('Mind steeled', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { after: 'idy', anchor: 'start', offset: 300, duration: 1300, scale: 0.9, opacity: 0.6 }),
    motion('brace', 'source', { delay: 0, duration: 900, intensity: 0.5 }),
  ], SILENT),

  'pf2e:dnaPJfA0CDLNrWcW': design("Implement's Interruption: your weapon implement lashes out at the foe the moment it acts, runes flaring on the blow.", () =>
    strike({ accent: ['Implement runes', ['markers.runes.orange', 'markers.runes.orange'], { scale: 0.45 }] })),

  'pf2e:Xc5MLIbT5OPhnFIJ': design('Indomitable Act: you lean into your fear and burn it as courage.', () => [
    cast('Fear embraced', ['markers.fear.orange', 'markers.fear.dark_purple'], { stageId: 'ia', scale: 0.45, ...above, duration: 1100, fadeOut: 500 }),
    aura('Courage', ['on_token_buff.001.001.orangeyellow'], { after: 'ia', anchor: 'start', offset: 600, duration: 1500, scale: 0.9, opacity: 0.8, fadeOut: 500 }),
    motion('brace', 'source', { after: 'ia', anchor: 'start', offset: 500, duration: 900, intensity: 0.4 }),
  ], SILENT),

  'pf2e:9KkkDjNz5HMtutwA': design('Inevitable Return: the fallen corpse rises as one of your thralls amid grave smoke.', () => [
    impact('Thrall rises', ['toll_the_dead.green.skull_smoke'], { stageId: 'ir', duration: 1600, scale: 0.8 }),
    impact('Necrotic mist', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'ir', anchor: 'start', offset: 300, duration: 1200, scale: 0.8, opacity: 0.7 }),
  ], sp('summon')),

  'pf2e:PACnDVj2YLLSpr8Y': design("Infiltrator's Draw: you snap out a hand crossbow and fire in one motion.", () =>
    shot(['bolt.physical.white', 'bolt.physical.orange'], ['impact.005.white', 'impact.005.orange'], { flight: 1100 }), ab('crossbow')),

  'pf2e:lgpJoFrkzfkjAzeV': design('Inscribe Shadow Pamor: you plunge your fist into your shadow and draw it out wrapped in rippling darkness.', () =>
    buff('Into the shadow', ['darkness.black'], 'Shadow pamor', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { gesture: 'press', castO: { scale: 0.5, below: true }, auraO: { scale: 0.7, offsetX: 0.3, offsetUnits: 'token' } }), sp('shadow')),

  'pf2e:ZXvJGxMJc0HRpcQh': design('Inspired Stratagem: your reviewed plan pays off and the ally rolls twice.', () =>
    mark('Stratagem', ['ui.chevrons3.yellow'], { src: ['Plan', ['glint.yellow.few'], { scale: 0.4 }], o: { ...above, scale: 0.45, duration: 1300 } }), SILENT),

  'pf2e:ut0jFv67YpvHBzD9': design('Insta-Ballista: the squad assembles an impromptu ballista and a huge bolt slams into the target.', () =>
    signal({ answer: ['impact.005.white', 'impact.005.orange'], answerLabel: 'Ballista impact', answerO: { scale: 0.9, offsetY: 0, offset: 1100 },
      extra: [travel('Ballista bolt', ['bolt.physical.white', 'bolt.physical.orange'], { delay: 900, duration: 1100, scale: 1.6 })] }), ab('crossbow')),

  'pf2e:8UJaVPsT5FA8XH87': design('Instant Recovery: mythic vitality surges and your wounds close.', () => [
    cast('Mythic surge', ['healing_generic.burst.yellowwhite', 'healing_generic.200px.yellow'], { stageId: 'irc', scale: 1, duration: 1500 }),
    aura('Restored', ['healing_generic.loop.yellowwhite', 'healing_generic.200px.yellow'], { after: 'irc', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, opacity: 0.75, fadeOut: 500 }),
  ], sp('healing')),

  'pf2e:HAmGozJwLAal5v82': design('Intensify Vulnerability: you focus on the exploited vulnerability and its rune flares brighter.', () =>
    mark('Vulnerability intensified', ['markers.runes.red', 'markers.runes.orange'], { src: ['Focus', ['magic_signs.rune.divination.complete.red', 'magic_signs.rune.divination.complete.blue'], { scale: 0.4 }], o: { scale: 0.6, ...above, duration: 1700 } }), SILENT),

  'pf2e:vhO1f7oTD2s3Ncg9': design('Intercept Attack: you fling yourself in front of the ally to take the blow.', () => [
    motion('rush', 'source', { stageId: 'in', duration: 900, distance: 1, motionRange: 'target', motionEndpoint: 'near', intensity: 0.5 }),
    cast('Blow intercepted', ['impact.005.white', 'impact.005.orange'], { after: 'in', anchor: 'start', offset: 500, scale: 0.6, duration: 800 }),
    motion('brace', 'source', { after: 'in', anchor: 'start', offset: 500, duration: 800, intensity: 0.6 }),
  ], ab('shield')),

  'pf2e:0MZ5tFUYKGMq21NV': design('Intercession Spell: you lend your hierophant divine power — a blessing settles on them.', () => [
    travel('Divine favor', ['energy_strands.range.standard.orange', 'energy_strands.range.standard.purple'], { stageId: 'is', duration: 1200, ...tint('#ffe58a') }),
    impact('Blessed casting', ['bless.200px.intro.yellow'], { after: 'is', anchor: 'arrival', duration: 1500, scale: 0.8 }),
  ], sp('bless')),

  'pf2e:Uq2qy9aGNQ5JcPI1': design('Into the Fray: as initiative is rolled your hands snap to your holsters.', () =>
    quiet('Quick draw', ['glint.yellow.few'], { scale: 0.4, duration: 700, offsetX: 0.35, offsetUnits: 'token' }), SILENT),

  'pf2e:travkW5KLTnIUt9Y': design('Inured to Death: you shrug off part of the death or void damage behind a deathly ward.', () =>
    ward('Death warded', ['ward.skull.dark_purple', 'ward.rune.yellow'], ['shield.01.complete.01.purple', 'shield.01.complete.01.blue'], { introO: { scale: 0.6 }, holdO: { opacity: 0.55 } })),

  'pf2e:Ul4I0ER6pj3U5eAk': design("Invigorating Fear: another creature's terror invigorates you — dread flows into you as vigor.", () => [
    cast('Terror tasted', ['markers.fear.dark_purple'], { stageId: 'if', scale: 0.4, ...above, duration: 1000, fadeOut: 400 }),
    cast('Vigor', ['energy_strands.in.purple', 'energy_strands.in.green'], { after: 'if', anchor: 'start', offset: 400, scale: 0.7, duration: 1200 }),
  ], SILENT),

  'pf2e:Aq2mXT2hLlstFL5C': design('Invoke Celestial Privilege: you rise above the divine effect in a halo of celestial light.', () =>
    ward('Celestial privilege', ['markers.light.complete.yellow', 'markers.light.complete.blue'], ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { introO: { scale: 0.8 }, holdO: { opacity: 0.55 } }), sp('holy')),

  'pf2e:gP5oTU1Mh6GkuseX': design('Invoke Rune: you speak the true names of your runes and each blazes with power on its bearer before fading.', () => [
    cast('Names uttered', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'inv', scale: 0.5, duration: 900 }),
    impact('Rune blazes', ['markers.runes.orange', 'markers.runes.orange'], { stageId: 'inv-r', after: 'inv', anchor: 'start', offset: 350, duration: 1300, scale: 0.55, ...above }),
    impact('Rune discharge', ['impact.005.orange'], { after: 'inv-r', anchor: 'start', offset: 600, duration: 900, scale: 0.6 }),
  ], SILENT),

  'pf2e:M8RCbthRhB4bxO9t': design('Iron Command: you command the impertinent foe to kneel and its knees buckle (Will save).', () => [
    cast('Command', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'ic', scale: 0.8, duration: 1000 }),
    impact('Kneel', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'ic', anchor: 'start', offset: 400, duration: 1500, scale: 0.7 }),
    motion('press', 'targets', { after: 'ic', anchor: 'start', offset: 500, duration: 1100, intensity: 0.6 }),
  ], SILENT),

  'pf2e:hFRHPBj6wjAayNtW': design('Jinx: a curse of clumsiness flies to the target and clings (Will save).', () => [
    travel('Jinx', ['energy_strands.range.standard.dark_purple', 'energy_strands.range.standard.purple'], { stageId: 'jx', duration: 1200 }),
    impact('Cursed', ['condition.curse.01.001.purple', 'condition.curse.01.001.red'], { after: 'jx', anchor: 'arrival', duration: 1700, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'jx', anchor: 'arrival', offset: 200, duration: 800, intensity: 0.4 }),
  ], SILENT),

  'pf2e:wt6jdjjje16Nx34f': design('Jumping Jenny: you foul a flying creature\'s flight — a noose of rope drags at it.', () => [
    impact('Noose', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { stageId: 'jj', duration: 1600, scale: 0.7, ...tint('#a68a5a') }),
    motion('press', 'targets', { after: 'jj', anchor: 'start', offset: 300, duration: 1000, intensity: 0.4 }),
  ], SILENT),

  'pf2e:aVGNaNgG6cYNRp5A': design('Lantern Strobe: your lantern flashes erratically and opponents in the cone are dazed by the strobe (Fortitude save).', () => [
    cast('Strobe', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'ls', scale: 0.7, duration: 500, repeats: 3, repeatInterval: 250, ...tint('#fff3b0') }),
    impact('Flash', ['impact.007.white', 'impact.007.yellow'], { after: 'ls', anchor: 'start', offset: 300, duration: 800, scale: 0.6, repeats: 2, repeatInterval: 300 }),
    impact('Disoriented', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'ls', anchor: 'start', offset: 900, duration: 1500, scale: 0.45, ...above, fadeOut: 400 }),
  ], sp('light')),

  'pf2e:yUjuLbBMflVum8Yn': design('Launch Fireworks: you light a firework from your toolkit and it bursts in a bright display at the chosen point.', () => [
    projectile('Rocket', ['throwable.launch.missile.01.blue'], { stageId: 'lf', duration: 1100, scale: 0.4 }),
    impact('Firework burst', ['firework.01.orangeyellow', 'firework.01.orangeyellow.01'], { after: 'lf', anchor: 'arrival', duration: 1600, scale: 0.9 }),
    motion('throw', 'source', { delay: 0, duration: 700, intensity: 0.4 }),
  ], sp('explosion')),
};

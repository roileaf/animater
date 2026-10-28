// Bespoke compositions (pf2e-actions-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// PF2e Actions L–Z: basic, skill, class, ancestry and commander actions. Actions have no
// measured template at play time, so emanations are drawn as source auras and per-target cues.
// Target-side stages are optional (many actions are used with nothing targeted).
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const P = id => `pf2e:${id}`;
const out = {};
const put = (id, d) => { out[P(id)] = d; };
const ab = (sound, extra = {}) => ({ sound, soundNamespace: 'ability', ...extra });
const sp = (sound, extra = {}) => ({ sound, ...extra });
const quiet = (extra = {}) => ({ sound: null, ...extra });

// Placement helpers.
const T = { optionalTargets: true };
const ALL = { targetSelection: 'all', optionalTargets: true };
const FIRST = { targetSelection: 'first', optionalTargets: true };
const above = (y = -0.55) => ({ offsetY: y, offsetUnits: 'token' });
const side = (x = 0.45) => ({ offsetX: x, offsetUnits: 'token' });

// Shared art (Patreon key first, Free fallback last).
const DUST = ['smoke.puff.side.grey'];
const RING = ['smoke.puff.ring.01.white'];
const SPEED = ['wind_lines.01.01.white'];
const SPEED2 = ['wind_lines.01.02.white'];
const GLINT = ['glint.yellow.few'];
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'];
const SLASH2 = ['melee_generic.slash.02.002.orange', 'melee_generic.slash.02.002.blue'];
const HEAVY = ['melee_generic.slashing.two_handed', 'melee_generic.slash.01.orange'];
const PIERCE = ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'];
const BLUNT = ['melee_generic.bludgeoning.one_handed', 'melee_generic.creature_attack.fist.002.blue'];
const FIST = ['unarmed_strike.physical.01.blue'];
const SHOVE = ['impact.009.orange'];
const CLAWS = ['claws.200px.red'];
const TRAIL = c => [`melee_attack.01.trail.01.${c}`, 'melee_attack.01.trail.01.pinkpurple'];
const FEAR = c => [`icon.fear.${c}`, 'icon.fear.dark_purple'];
const WAVE = c => [`soundwave.02.${c}`, 'soundwave.02.blue'];
const D20 = ['icosahedron.roll.blue'];
const SHIELD = c => [`shield.01.complete.01.${c}`, 'shield.01.complete.01.blue'];
const RAMPART = ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'];
const EYE = c => [`eyes.01.${c}.single`, 'eyes.01.dark_green.single'];
const EYES = c => [`eyes.01.${c}.many`, 'eyes.01.dark_green.many'];
const RUNE = ['magic_signs.rune.divination.complete.blue'];
const MARK = c => [`hunters_mark.pulse.01.${c}`, 'hunters_mark.pulse.01.green'];
const CHEVRON = c => [`ui.chevrons3.${c}`, 'ui.chevrons3.yellow'];
const DIZZY = c => [`dizzy_stars.200px.${c}`, 'dizzy_stars.200px.blueorange'];
const BUFF = c => [`on_token_buff.001.001.${c}`, 'on_token_buff.001.001.white'];
const STRANDS_IN = c => [`energy_strands.in.${c}.01`, 'energy_strands.in.green.01'];
const TETHER = c => [`energy_strands.range.standard.${c}.01`, 'energy_strands.range.standard.purple.01'];
const HEAL = c => [`healing_generic.200px.${c}`, 'healing_generic.200px.green'];
const HEARTBEAT = c => [`ui.heartbeat.01.${c}`, 'ui.heartbeat.01.green'];
const CHAIN = c => [`markers.chain.standard.complete.02.${c}`, 'markers.chain.standard.complete.02.red'];
const BULLET = ['bullet.01.orange'];
const MUZZLE = ['muzzle_flash.single.01.yellow'];
const BLOOD = ['markers.drop.red.01'];
const FUMES = ['fumes.toxic.green', 'fumes.04.complete.grey'];
const POISON = ['markers.poison.dark_green.01'];
const WATER = ['water_splash.circle.01.blue'];
const BUBBLES = ['bubble.002.001.complete.blue'];
const FEATHERS = ['swirling_feathers.outburst.01.textured'];
const SMOKE = ['smoke.puff.centered.grey'];
const DARK_SMOKE = ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'];
const LEAVES = ['swirling_leaves.outburst.01.pink'];
const SPARKS = c => [`static_electricity.01.${c}`, 'static_electricity.01.blue'];

// ---------------------------------------------------------------- reusable building blocks
const dust = (o = {}) => aura('Dust kicks up', DUST, { scale: 0.6, duration: 900, opacity: 0.7, faceTarget: true, mirrorX: true, ...tint('#bba98d'), ...o });
const path = (kind, distance, o = {}) => motion(kind, 'source', { stageId: 'mv', duration: 1400, intensity: 0.35, distance, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', ...o });
const toTarget = (kind, distance, o = {}) => motion(kind, 'source', { stageId: 'mv', duration: 1400, intensity: 0.4, distance, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', ...o });

// Quiet manipulate/utility: a small gesture and a glint at the hands.
const handwork = (why, { art = GLINT, artTint, label = 'Deft hands', gesture = 'press', extra = [] } = {}, snd = quiet()) => design(why, () => [
  motion(gesture, 'source', { stageId: 'hands', duration: 800, intensity: 0.2 }),
  aura(label, art, { after: 'hands', anchor: 'start', offset: 250, duration: 900, scale: 0.4, opacity: 0.85, ...side(0.35), ...(artTint ? tint(artTint) : {}) }),
  ...extra,
], snd);

// Fortune/reroll: a d20 tumbles above the head and settles with a glint.
const reroll = (why, { glint = GLINT, glintTint, extra = [] } = {}, snd = quiet()) => design(why, () => [
  cast('Fate rolls again', D20, { stageId: 'roll', scale: 0.4, duration: 1400, ...above(-0.65), fadeIn: 150, fadeOut: 300 }),
  aura('The new result glints', glint, { after: 'roll', anchor: 'end', offset: -350, duration: 900, scale: 0.55, ...above(-0.65), ...(glintTint ? tint(glintTint) : {}) }),
  ...extra,
], snd);

// Recall/insight: a faint rune above the head while the creature thinks.
const recall = (why, { rune = RUNE, runeTint, extra = [] } = {}, snd = ab('recallKnowledge')) => design(why, () => [
  motion('press', 'source', { stageId: 'think', duration: 900, intensity: 0.15 }),
  aura('A remembered rune', rune, { after: 'think', anchor: 'start', offset: 150, duration: 1700, scale: 0.35, opacity: 0.8, fadeIn: 250, fadeOut: 500, ...above(-0.65), ...(runeTint ? tint(runeTint) : {}) }),
  ...extra,
], snd);

// Perception aimed at one creature: the eye opens over the observed target.
const observe = (why, { c = 'dark_yellow', eyeTint = '#e8c860', extra = [] } = {}, snd = quiet()) => design(why, () => [
  motion('press', 'source', { stageId: 'look', duration: 800, intensity: 0.15 }),
  aura('Watchful eye', EYE(c), { stageId: 'eye', after: 'look', anchor: 'start', offset: 100, duration: 1300, scale: 0.4, opacity: 0.85, ...above(-0.6), ...tint(eyeTint) }),
  aura('Studied closely', EYE(c), { subject: 'targets', after: 'eye', anchor: 'start', offset: 400, duration: 1500, scale: 0.4, opacity: 0.75, fadeIn: 200, fadeOut: 400, ...above(-0.6), ...tint(eyeTint), ...ALL }),
  ...extra,
], snd);

// Intimidation: menace from the source, fear over the targets, a cower.
const shout = (why, { cue = WAVE('red'), cueTint, color = 'dark_red', src = 'brace', many = false, extra = [] } = {}, snd = ab('battleCry')) => design(why, () => [
  motion(src, 'source', { stageId: 'sh-src', duration: 650, intensity: 0.5 }),
  cast('Menace', cue, { stageId: 'sh-cue', after: 'sh-src', anchor: 'start', offset: 250, scale: 0.9, duration: 1200, faceTarget: true, ...(cueTint ? tint(cueTint) : {}) }),
  impact('Fear takes hold', FEAR(color), { stageId: 'sh-fear', after: 'sh-cue', anchor: 'start', offset: 450, duration: 1500, scale: 0.55, fadeIn: 150, fadeOut: 400, ...(many ? ALL : FIRST) }),
  motion('cower', 'targets', { after: 'sh-fear', anchor: 'start', offset: 100, duration: 900, intensity: 0.45, ...(many ? ALL : FIRST) }),
  ...extra,
], snd);

// Commander tactic: a signal from the banner-bearer, the squad answers.
const command = (why, { onTargets = [], chevron = 'yellow', noChevron = false, extra = [] } = {}, snd = sp('battleCry')) => design(why, () => [
  motion('pulse', 'source', { stageId: 'sig', duration: 700, intensity: 0.4 }),
  cast('Signal rings out', WAVE('orangeyellow'), { stageId: 'cue', scale: 0.75, duration: 1100, opacity: 0.85 }),
  ...(noChevron ? [] : [aura('Squad answers', CHEVRON(chevron), { subject: 'targets', stageId: 'ans', after: 'cue', anchor: 'start', offset: 350, duration: 1100, scale: 0.35, ...above(-0.6), ...ALL })]),
  ...onTargets,
  ...extra,
], snd);

// Guard: brace and a protective marker/shield.
const guard = (why, { art = RAMPART, artTint, scale = 0.55, overhead = true, extra = [] } = {}, snd = sp('shield'), more = {}) => design(why, () => [
  motion('brace', 'source', { stageId: 'set', duration: 700, intensity: 0.55 }),
  aura('Guard set', art, { stageId: 'ward', after: 'set', anchor: 'start', offset: 150, duration: 1600, scale, fadeOut: 400, ...(overhead ? above(-0.5) : {}), ...(artTint ? tint(artTint) : {}) }),
  ...extra,
], { ...snd, ...more });

// Melee strike: lunge, contact, optional accent, target reaction on hit.
const strike = (why, { hit = SLASH, hitTint, scale = 0.9, srcI = 0.7, tgt = 'recoil', accent, accentTint, pre = [], post = [] } = {}, snd = ab('sword')) => design(why, () => [
  ...pre,
  motion('lunge', 'source', { stageId: 'swing', duration: 650, intensity: srcI, ...(pre.length ? { after: pre[0].stageId ?? undefined, anchor: 'end' } : {}) }),
  impact('Contact', hit, { stageId: 'hit', after: 'swing', anchor: 'start', offset: 250, duration: 1000, scale, ...FIRST, ...(hitTint ? tint(hitTint) : {}) }),
  ...(accent ? [aura('Accent', accent, { subject: 'targets', after: 'hit', anchor: 'start', offset: 150, duration: 1100, scale: 0.75, requiresHit: true, ...FIRST, ...(accentTint ? tint(accentTint) : {}) })] : []),
  ...(tgt ? [motion(tgt, 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 700, intensity: 0.6, requiresHit: true, ...FIRST })] : []),
  ...post,
], snd);

// Firearm shot: flash at the muzzle, the round flies, contact.
const shot = (why, { flight = BULLET, flightTint, contact = ['impact.005.white', 'impact.005.orange'], contactTint, flightMs = 900, pre = [], post = [] } = {}, snd = ab('firearm')) => design(why, () => [
  ...pre,
  motion('recoil', 'source', { stageId: 'kick', ...(pre.length ? { after: pre[0].stageId, anchor: 'end' } : { delay: 300 }), duration: 500, intensity: 0.35 }),
  cast('Muzzle flash', MUZZLE, { after: 'kick', anchor: 'start', scale: 0.5, duration: 600, faceTarget: true, ...side(0.4) }),
  travel('Shot', flight, { stageId: 'fly', after: 'kick', anchor: 'start', duration: flightMs, ...FIRST, ...(flightTint ? tint(flightTint) : {}) }),
  impact('Round strikes', contact, { stageId: 'hit', after: 'fly', anchor: 'end', duration: 1000, scale: 0.7, ...FIRST, ...(contactTint ? tint(contactTint) : {}) }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600, intensity: 0.5, requiresHit: true, ...FIRST }),
  ...post,
], snd);

// Movement.
const stride = (why, { distance = 2, lines = true, extra = [] } = {}, snd = quiet()) => design(why, () => [
  path('rush', distance, { duration: 1500 }),
  dust({ after: 'mv', anchor: 'start' }),
  ...(lines ? [aura('Speed lines', SPEED, { after: 'mv', anchor: 'start', scale: 0.8, duration: 1000, opacity: 0.5, faceTarget: true })] : []),
  ...extra,
], snd);
const leap = (why, { distance = 2, height, extra = [] } = {}, snd = quiet()) => design(why, () => [
  motion('press', 'source', { stageId: 'crouch', duration: 450, intensity: 0.35 }),
  path('leap', distance, { after: 'crouch', anchor: 'end', duration: 1400, intensity: 0.4, ...(height ? { jumpHeight: height } : {}) }),
  dust({ stageId: 'off', after: 'crouch', anchor: 'end', scale: 0.5 }),
  aura('Landing thud', RING, { after: 'mv', anchor: 'arrival', duration: 800, scale: 0.55, opacity: 0.5, below: true, ...tint('#cbbfa8') }),
  ...extra,
], snd);
const flight = (why, { feathers = FEATHERS, featherTint, extra = [] } = {}, snd = sp('wind')) => design(why, () => [
  cast('Wings beat', feathers, { stageId: 'wings', scale: 0.9, duration: 1300, opacity: 0.9, ...(featherTint ? tint(featherTint) : {}) }),
  aura('Downdraft', SPEED2, { after: 'wings', anchor: 'start', offset: 200, scale: 0.9, duration: 1100, opacity: 0.55 }),
  aura('Shadow below', ['drop_shadow.dark_black'], { after: 'wings', anchor: 'start', offset: 300, duration: 1700, scale: 0.85, opacity: 0.45, below: true, offsetY: 0.25, offsetUnits: 'token' }),
  motion('levitate', 'source', { after: 'wings', anchor: 'start', offset: 300, duration: 1700, intensity: 0.7 }),
  ...extra,
], snd);
// Fade into concealment: sink, a soft cloud, a fading afterimage.
const fade = (why, { cloud = SMOKE, cloudTint = '#5a5a66', gesture = 'sink', extra = [] } = {}, snd = quiet()) => design(why, () => [
  motion(gesture, 'source', { stageId: 'fade', duration: 1300, intensity: 0.45 }),
  aura('Concealing cloud', cloud, { after: 'fade', anchor: 'start', offset: 150, duration: 1300, scale: 0.8, opacity: 0.55, ...tint(cloudTint) }),
  ...extra,
], snd);

// Healing on a target (or self when nothing is targeted).
const mend = (why, { art = HEAL('yellow'), artTint, self = false, extra = [] } = {}, snd = sp('healing')) => design(why, () => [
  ...(self
    ? [motion('press', 'source', { stageId: 'gather', duration: 600, intensity: 0.2 }), aura('Wounds knit', art, { after: 'gather', anchor: 'start', offset: 200, duration: 1700, scale: 0.8, ...(artTint ? tint(artTint) : {}) }), motion('pulse', 'source', { after: 'gather', anchor: 'end', duration: 700, intensity: 0.3 })]
    : [motion('pulse', 'source', { stageId: 'gather', duration: 600, intensity: 0.3 }), impact('Restoration', art, { after: 'gather', anchor: 'start', offset: 250, duration: 1700, scale: 0.8, ...ALL, ...(artTint ? tint(artTint) : {}) })]),
  ...extra,
], snd);

// Inner surge on the user (stances, transformations, empowerments).
const surge = (why, { art, artTint, scale = 1, gesture = 'pulse', gestureI = 0.45, accent, accentTint, accentScale = 0.6, accentAbove = true, extra = [] } = {}, snd = quiet(), more = {}) => design(why, () => [
  motion(gesture, 'source', { stageId: 'sg', duration: 800, intensity: gestureI }),
  aura('Surge', art, { stageId: 'sg-art', after: 'sg', anchor: 'start', offset: 100, duration: 1600, scale, fadeOut: 400, ...(artTint ? tint(artTint) : {}) }),
  ...(accent ? [aura('Accent', accent, { after: 'sg-art', anchor: 'start', offset: 400, duration: 1300, scale: accentScale, fadeIn: 150, fadeOut: 400, ...(accentAbove ? above(-0.6) : {}), ...(accentTint ? tint(accentTint) : {}) })] : []),
  ...extra,
], { ...snd, ...more });

// ---------------------------------------------------------------- L
put('x1qSEkzHAviQ5jry', design('Lay Down Arms: the arm detaches harmlessly with a small shrug and drops beside the body in a puff of dust.', () => [
  motion('shake', 'source', { stageId: 'pull', duration: 600, intensity: 0.25 }),
  aura('Severed arm drops', DUST, { after: 'pull', anchor: 'end', offset: -150, duration: 900, scale: 0.4, opacity: 0.6, below: true, ...side(0.6), ...tint('#bba98d') }),
], quiet()));
put('d5I6018Mci2SWokk', leap('Leap: a short crouch and a jump across a gap of 5–10 feet, landing with a thud.', { distance: 2 }));
put('egXlMyYLBthoQSgh', strike('Liar\'s Hidden Blade: the thrown shadow weapon fades into smoke while a second blade drawn from the shadow sheath strikes from the blind spot.', {
  hit: ['melee_attack.01.trail.04.dark_purple', 'melee_attack.01.trail.01.pinkpurple'], hitTint: '#6a4a8c', srcI: 0.8, tgt: 'stagger',
  pre: [aura('Shadow weapon fades', DARK_SMOKE, { stageId: 'fade', duration: 900, scale: 0.55, opacity: 0.7, subject: 'targets', ...FIRST, ...tint('#3a2d4f') })],
}, ab('dagger')));
put('VqGjR43bBd36k0XI', design('Liberate Self: divine fortune — the bonds strain and burst apart as the user wrenches free.', () => [
  aura('Bonds hold', CHAIN('yellow'), { stageId: 'bind', duration: 1100, scale: 0.7, opacity: 0.85, ...tint('#d9c27a') }),
  motion('shake', 'source', { after: 'bind', anchor: 'start', offset: 150, duration: 800, intensity: 0.5 }),
  aura('Divine spark frees them', ['impact.012.yellow', 'impact.012.blue'], { after: 'bind', anchor: 'end', offset: -200, duration: 900, scale: 0.7, ...tint('#f2dc8a') }),
  motion('pulse', 'source', { after: 'bind', anchor: 'end', duration: 600, intensity: 0.4 }),
], sp('holy')));
put('IX1VlVCL5sFTptEE', design('Liberating Step: the champion\'s aura flares around the endangered ally, shielding them and letting them slip free with a Step.', () => [
  motion('brace', 'source', { stageId: 'call', duration: 600, intensity: 0.5 }),
  cast('Champion\'s light', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'glow', scale: 0.6, duration: 1200 }),
  aura('Ally shielded', SHIELD('yellow'), { subject: 'targets', stageId: 'ward', after: 'glow', anchor: 'start', offset: 400, duration: 1500, scale: 0.7, ...ALL, ...tint('#f2dc8a') }),
  motion('dodge', 'targets', { after: 'ward', anchor: 'start', offset: 300, duration: 900, intensity: 0.5, distance: 0.4, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', ...ALL }),
], sp('holy')));
put('Iuq8CeNqv3a0oWfQ', design('Life Block: a red ward catches the blow on the protected creature while the caster pays for it with their own heartbeat.', () => [
  aura('Life given', HEARTBEAT('red'), { stageId: 'cost', duration: 1300, scale: 0.5, ...above(-0.6), ...tint('#d84a4a') }),
  motion('press', 'source', { after: 'cost', anchor: 'start', duration: 700, intensity: 0.3 }),
  aura('Damage blocked', SHIELD('red'), { subject: 'targets', after: 'cost', anchor: 'start', offset: 300, duration: 1400, scale: 0.7, ...ALL, ...tint('#e06a5a') }),
], sp('shield')));
put('9MJcQEMVVrmMyGyq', guard('Living Fortification: at initiative the gunslinger snaps a firearm or crossbow up into a parrying guard like a walking tower.', {
  extra: [aura('Steel catches the light', GLINT, { after: 'ward', anchor: 'start', offset: 300, duration: 700, scale: 0.45, ...side(0.4) })],
}, quiet(), { fx: false }));
put('JUvAvruz7yRQXfz2', leap('Long Jump: a running start and a long, high arc of up to the check result in feet.', { distance: 3.5, height: 1 }));
put('RxIPBjodIRm7Pd6W', reroll('Lucky Break: a harrow card is drawn and the skill check rerolled, a card flicking past as the die turns.', {
  extra: [aura('Harrow card', ['ranged.card.01.projectile.01.yellow', 'ranged.card.01.projectile.01.blue'], { after: 'roll', anchor: 'start', duration: 900, scale: 0.5, opacity: 0.9, ...side(0.3) })],
}));

// ---------------------------------------------------------------- M
put('k3Dbgb8iS73atDqB', shout('Makes Me Stronger: the hero flexes and roars through the pain, and the creature that hurt them flinches in fear.', { src: 'pulse', cue: WAVE('orangeyellow') }));
put('Qf1ylAbdVi1rkc8M', design('Maneuver in Flight: a banking barrel roll on the wing, gusts streaming past.', () => [
  aura('Gusts', SPEED2, { stageId: 'gust', duration: 1400, scale: 0.9, opacity: 0.55, faceTarget: true }),
  path('roll', 1.2, { duration: 1500, intensity: 0.5 }),
  aura('Shadow below', ['drop_shadow.dark_black'], { after: 'mv', anchor: 'start', duration: 1500, scale: 0.8, opacity: 0.4, below: true, offsetY: 0.25, offsetUnits: 'token' }),
], sp('wind')));
put('n5vwBnLSlIXL9ptp', design('Manifest Eidolon: a summoning circle opens beside the summoner and the eidolon steps through its tethering light.', () => [
  motion('press', 'source', { stageId: 'focus', duration: 800, intensity: 0.25 }),
  aura('Summoning circle', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'circle', duration: 2200, scale: 0.9, below: true, ...side(1) }),
  aura('Eidolon steps through', ['portals.horizontal.ring.yellow', 'portals.horizontal.ring.bright_yellow'], { after: 'circle', anchor: 'start', offset: 600, duration: 1500, scale: 0.8, ...side(1) }),
  aura('Tether of light', ['energy_strands.complete.orange.01', 'energy_strands.complete.blue.01'], { after: 'circle', anchor: 'start', offset: 900, duration: 1300, scale: 0.6, opacity: 0.7, ...tint('#f2dc8a') }),
], sp('summon')));
put('IfWF56KiSFQbNmHj', design('Manifest Realm: the summoner\'s divine realm bleeds into a 20-foot burst, the ground corrupted in a slow wash of otherworldly haze.', () => [
  motion('press', 'source', { stageId: 'call', duration: 800, intensity: 0.3 }),
  aura('Realm spreads', ['ambient_fog.001.complete.large.purplered', 'ambient_fog.001.complete.large.white'], { stageId: 'realm', after: 'call', anchor: 'start', offset: 200, duration: 3200, scale: 3, opacity: 0.6, below: true, fadeIn: 500, fadeOut: 700, ...tint('#7a4a8c') }),
  aura('Ground corrupts', ['ground_cracks.01.purple', 'ground_cracks.01.orange'], { after: 'realm', anchor: 'start', offset: 400, duration: 2200, scale: 2.2, opacity: 0.55, below: true, ...tint('#7a4a8c') }),
], sp('spirit')));
put('KMKuJ0onVS72t9Fv', design('Manifest Soulforged Armament: soul-bound energy streams inward and solidifies into the bonded weapon, shield or armor.', () => [
  cast('Soul energy gathers', STRANDS_IN('yellow'), { stageId: 'in', scale: 0.8, duration: 1100, ...tint('#f2dc8a') }),
  aura('Armament takes form', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'in', anchor: 'end', offset: -250, duration: 1200, scale: 0.8, ...tint('#f2dc8a') }),
  motion('pulse', 'source', { after: 'in', anchor: 'end', duration: 600, intensity: 0.4 }),
], sp('summon')));
put('AZt0m0EHRmtDCd5s', stride('Marathon Dash: the exemplar sprints off leaving a slipstream of wind that carries nearby allies along.', {
  distance: 3, extra: [aura('Slipstream lifts allies', SPEED, { subject: 'targets', after: 'mv', anchor: 'start', offset: 300, duration: 1000, scale: 0.7, opacity: 0.5, ...ALL })],
}, sp('wind')));
put('orjJjLdm4XNAcFi8', design('Mark for Death: a long, patient stare designates the mark, and a blood-red sigil settles over the chosen creature.', () => [
  motion('press', 'source', { stageId: 'stare', duration: 1000, intensity: 0.2 }),
  aura('Cold focus', EYE('dark_red'), { after: 'stare', anchor: 'start', duration: 1200, scale: 0.4, ...above(-0.6), ...tint('#b03030') }),
  impact('Marked for death', MARK('purple'), { after: 'stare', anchor: 'start', offset: 700, duration: 1800, scale: 0.7, ...FIRST, ...tint('#a02828') }),
], quiet()));
put('jD8RW5PdLI6snlsO', design('Mark the Center: a breath of enchanted red ash blows out in a cone and clings to the vitals of each enemy it touches.', () => [
  motion('brace', 'source', { stageId: 'inhale', duration: 500, intensity: 0.3 }),
  cast('Red ash exhaled', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'ash', after: 'inhale', anchor: 'end', scale: 1.2, duration: 1300, faceTarget: true, opacity: 0.85, ...tint('#c0392b') }),
  impact('Ash clings to vitals', ['markers.drop.red.01'], { after: 'ash', anchor: 'start', offset: 600, duration: 1500, scale: 0.45, ...ALL }),
], sp('wind')));
put('Rlp7ND33yYfxiEWi', design('Master Strike: the hit lands on an off-guard foe at a vital point, and the target seizes up, paralyzed or worse.', () => [
  motion('lunge', 'source', { stageId: 'swing', duration: 550, intensity: 0.5 }),
  impact('Vital point', ['sneak_attack.dark_red', 'sneak_attack.dark_green'], { stageId: 'hit', after: 'swing', anchor: 'start', offset: 200, duration: 1100, scale: 0.8, ...FIRST }),
  aura('Paralysis grips', ['icon.stun.purple'], { subject: 'targets', after: 'hit', anchor: 'start', offset: 500, duration: 1300, scale: 0.5, fadeOut: 400, ...FIRST }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, intensity: 0.4, ...FIRST }),
], ab('dagger')));
put('74iat04PtfG8gn2Q', surge('Mighty Rage: the rage boils over so fast that a second rage action follows in the same breath, a red flare of fury.', {
  art: ['impact.012.dark_red', 'impact.012.blue'], artTint: '#c0392b', scale: 0.9, gesture: 'shake', gestureI: 0.5,
}, ab('battleCry')));
put('CPTolKAF55p7D7Sn', design('Mirror-Trickery: an illusory duplicate appears at the last instant beside the user and the strike is lured into it.', () => [
  sprite('Illusory duplicate', { stageId: 'dupe', duration: 1300, opacity: 0.5, ...side(0.55) }),
  motion('dodge', 'source', { after: 'dupe', anchor: 'start', duration: 900, intensity: 0.5, distance: 0.3, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Duplicate shatters', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'dupe', anchor: 'end', offset: -400, duration: 900, scale: 0.6, ...side(0.55) }),
], sp('transform')));
put('Mh4Vdg6gu8g8RAjh', design('Mirror\'s Reflection: the mirror implement flashes and an illusory self appears in another space nearby, mimicking every move.', () => [
  cast('Mirror flash', ['shimmer.01.blue'], { stageId: 'flash', scale: 0.6, duration: 900 }),
  sprite('Reflected self', { after: 'flash', anchor: 'start', offset: 300, duration: 2400, opacity: 0.55, offsetX: 1.4, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
  aura('Reflection shimmers', ['shimmer.01.blue'], { after: 'flash', anchor: 'start', offset: 300, duration: 1100, scale: 0.8, offsetX: 1.4, offsetUnits: 'token' }),
], sp('transform')));
put('EKEZGfOBKTNWTFDe', command('Mirrored Wall: the squad tilts polished shields and a flash of reflected light lances into the chosen enemy\'s eyes.', {
  noChevron: true,
  onTargets: [
    travel('Reflected glare', ['energy_beam.normal.yellow.01', 'energy_beam.normal.blue.01'], { stageId: 'glare', after: 'cue', anchor: 'start', offset: 400, duration: 1000, opacity: 0.8, ...FIRST, ...tint('#fff2c0') }),
    impact('Blinding flash', ['impact.005.white', 'impact.yellow'], { after: 'glare', anchor: 'end', offset: -200, duration: 900, scale: 0.7, ...FIRST }),
    motion('shake', 'targets', { after: 'glare', anchor: 'end', duration: 700, intensity: 0.4, ...FIRST }),
  ],
}, sp('light')));
put('I9k9qe4gOT8UVK4e', fade('Mist Blending: the undine draws the surrounding mist tight around them, blurring their outline further.', { cloud: ['fog_cloud.01.white'], cloudTint: '#cfe3ef', gesture: 'flicker' }));
put('yWTdfPklh8jL94GZ', design('Mobbing Assault: the raised horde surges over every enemy around it, clubbing and hacking in a cloud of grave dust.', () => [
  motion('pulse', 'source', { stageId: 'cmd', duration: 600, intensity: 0.3 }),
  impact('Horde blows', ['melee_generic.creature_attack.fist.002.blue'], { stageId: 'mob', after: 'cmd', anchor: 'start', offset: 300, duration: 1100, scale: 0.8, ...ALL, targetStagger: 150, ...tint('#cfc6b0') }),
  impact('Grave dust', DUST, { after: 'mob', anchor: 'start', offset: 200, duration: 1000, scale: 0.6, opacity: 0.7, ...ALL, ...tint('#7d7360') }),
  motion('stagger', 'targets', { after: 'mob', anchor: 'start', offset: 150, duration: 700, intensity: 0.5, ...ALL }),
], sp('bludgeon')));
put('PM5jvValFkbFH3TV', design('Mount: a short hop up onto the willing, larger creature beside the rider.', () => [
  motion('press', 'source', { stageId: 'crouch', duration: 400, intensity: 0.3 }),
  toTarget('leap', 1, { after: 'crouch', anchor: 'end', duration: 1100, intensity: 0.3 }),
], quiet()));
put('bAXkEXAlnBx78S7t', command('Mountaineering Training: the commander calls the climbing drill; the squad gains a climb Speed, arrows pointing the way up.', { chevron: 'green' }));
put('00LNVSCbwJ8pszwE', surge('Mutagenic Flashback: a mutagen surges back through the alchemist\'s veins in a green shudder.', {
  art: ['energy_strands.complete.dark_green.01', 'energy_strands.complete.blue.01'], artTint: '#7fbf5a', scale: 0.8, gesture: 'shake', gestureI: 0.4,
}, sp('transform')));
put('T8ZnkumXGAbqsOqt', design('My Legend Must Be Told: on the brink of death the hero\'s heartbeat stubbornly returns, though doom lingers a moment longer.', () => [
  aura('Stubborn heartbeat', HEARTBEAT('red'), { stageId: 'beat', duration: 1800, scale: 0.55, ...above(-0.6), ...tint('#d84a4a') }),
  aura('Doom draws closer', ['icon.skull.purple'], { after: 'beat', anchor: 'start', offset: 900, duration: 1200, scale: 0.35, opacity: 0.55, fadeIn: 300, fadeOut: 400, ...above(-0.6) }),
  motion('pulse', 'source', { after: 'beat', anchor: 'start', offset: 300, duration: 800, intensity: 0.3 }),
], quiet()));
put('wdLdqMu0S90Kc7gj', design('Mythic Echo: after a failure, golden mythic power streams back into the user, restoring a Mythic Point.', () => [
  cast('Mythic power returns', STRANDS_IN('yellow'), { stageId: 'in', scale: 0.8, duration: 1100, ...tint('#f2dc8a') }),
  aura('Spark rekindled', ['particle_burst.01.star.yellow', 'particle_burst.01.star.bluepurple'], { after: 'in', anchor: 'end', offset: -250, duration: 1000, scale: 0.5, ...above(-0.5), ...tint('#f2dc8a') }),
], quiet()));

// ---------------------------------------------------------------- N–O
put('fsR3X4c3p19W8RB2', reroll('Name Drop: a well-placed name salvages a failed social check; the check is rerolled.'));
put('zuTNF3UEr0ZNleqR', command('Naval Training: the commander calls the swimming drill and each squadmate is buoyed by a ripple of water.', {
  onTargets: [aura('Buoyed', BUBBLES, { subject: 'targets', after: 'cue', anchor: 'start', offset: 500, duration: 1300, scale: 0.6, opacity: 0.75, ...ALL })],
}));
put('JdpUaQeNwoVr2VHL', mend('No Scar but This: vitality wells up and the exemplar\'s wounds knit shut without a scratch.', { art: HEAL('yellow'), self: true }));
put('BKMxC0ZvdYfdhx7C', design('Objection: the devil\'s eye crackles with infernal glee as a loophole is found, and the save is rolled twice.', () => [
  aura('Devil\'s eye', EYE('dark_red'), { stageId: 'eye', duration: 1300, scale: 0.4, ...above(-0.6), ...tint('#c0392b') }),
  aura('Infernal crackle', SPARKS('dark_red'), { after: 'eye', anchor: 'start', offset: 200, duration: 1000, scale: 0.5, opacity: 0.85, ...above(-0.6), ...tint('#d0402a') }),
  cast('Rolled twice', D20, { after: 'eye', anchor: 'start', offset: 600, scale: 0.35, duration: 1200, ...side(0.55) }),
], quiet()));
put('7wQe43fSCG9DSWdj', design('Offer Story: a traveller\'s tale is shared and Isthralei\'s blessing settles on the teller and the listener.', () => [
  cast('A story told', WAVE('orangeyellow'), { stageId: 'tale', scale: 0.55, duration: 1000, opacity: 0.6, faceTarget: true }),
  aura('Blessing of Isthralei', ['bless.200px.intro.yellow'], { stageId: 'bless', after: 'tale', anchor: 'start', offset: 300, duration: 1600, scale: 0.7 }),
  aura('Listener blessed', ['bless.200px.intro.yellow'], { subject: 'targets', after: 'bless', anchor: 'start', offset: 300, duration: 1600, scale: 0.7, ...ALL }),
], sp('bless')));
put('2r4BY90F9PLFai3c', design('Once Bitten: the attacker\'s fist meets clothing suffused with poison, and a green puff exposes it to the toxin.', () => [
  impact('Poison puff', FUMES, { stageId: 'puff', duration: 1300, scale: 0.6, ...FIRST, ...tint('#7fbf5a') }),
  impact('Exposed', POISON, { after: 'puff', anchor: 'start', offset: 400, duration: 1300, scale: 0.45, ...FIRST }),
  motion('recoil', 'targets', { after: 'puff', anchor: 'start', offset: 100, duration: 700, intensity: 0.4, ...FIRST }),
], sp('poison')));
put('IEBBHnI7wWRt44KG', design('One Moment till Glory: a rallying cry lifts every ally in the aura with golden light, shaking off a failing condition.', () => [
  motion('brace', 'source', { stageId: 'rally', duration: 600, intensity: 0.5 }),
  aura('Rallying radiance', ['bless.400px.intro.yellow'], { stageId: 'glow', after: 'rally', anchor: 'start', offset: 200, duration: 1800, scale: 1.4, opacity: 0.85 }),
  aura('Allies uplifted', ['particle_burst.01.star.yellow', 'particle_burst.01.star.bluepurple'], { subject: 'targets', after: 'glow', anchor: 'start', offset: 400, duration: 1100, scale: 0.5, ...ALL, ...tint('#f2dc8a') }),
  motion('pulse', 'targets', { after: 'glow', anchor: 'start', offset: 450, duration: 600, intensity: 0.3, ...ALL }),
], sp('battleCry')));
put('Tlrde2xh7AhesXNB', design('One Shot, One Kill: from hiding, the gunslinger draws and settles into a deadly aim on the first target.', () => [
  motion('press', 'source', { stageId: 'aim', duration: 1000, intensity: 0.3 }),
  aura('Weapon drawn', GLINT, { after: 'aim', anchor: 'start', offset: 200, duration: 700, scale: 0.45, ...side(0.4) }),
  aura('Sights settle', MARK('green'), { subject: 'targets', after: 'aim', anchor: 'start', offset: 500, duration: 1400, scale: 0.55, ...FIRST, ...tint('#d8c06a') }),
], quiet()));
put('8r9ePG6BnrnO6YE1', design('Only You and I: a strand of fate binds the exemplar to the chosen foe, sealing them into a duel.', () => [
  motion('brace', 'source', { stageId: 'call', duration: 600, intensity: 0.4 }),
  travel('Fated bond', TETHER('orange'), { stageId: 'bond', after: 'call', anchor: 'start', offset: 200, duration: 1600, opacity: 0.8, ...FIRST, ...tint('#f2c86a') }),
  impact('Bound to the duel', MARK('purple'), { after: 'bond', anchor: 'start', offset: 600, duration: 1500, scale: 0.55, ...FIRST, ...tint('#f2c86a') }),
], quiet()));
put('EfjoIuDmtUn4yiow', strike('Opportune Riposte: the fumbled attack is turned aside and the swashbuckler snaps back with a counter-thrust.', {
  hit: PIERCE, srcI: 0.9, pre: [motion('brace', 'source', { stageId: 'parry', duration: 450, intensity: 0.5 }), aura('Parry spark', ['impact.007.yellow'], { delay: 150, duration: 500, scale: 0.4 })],
}, ab('rapier')));
put('bUgSKcdHyEKbtXhl', design('Opportunistic Accusation: a cutting remark lands on the faltering demon as a lash of mental pain.', () => [
  cast('Cutting remark', WAVE('purple'), { stageId: 'jab', scale: 0.6, duration: 900, faceTarget: true }),
  impact('Words sting', ['impact.012.purple', 'impact.012.blue'], { stageId: 'sting', after: 'jab', anchor: 'start', offset: 450, duration: 1000, scale: 0.6, ...FIRST, ...tint('#9b6ad0') }),
  motion('shake', 'targets', { after: 'sting', anchor: 'start', duration: 700, intensity: 0.4, ...FIRST }),
], sp('psychic')));
put('QGeA2sPtDdryTpWw', shout('Overawe Crowd: a mythic display of menace stuns the swarm or troop and drives it where the user wills.', {
  extra: [impact('Stunned', DIZZY('yellow'), { after: 'sh-fear', anchor: 'start', offset: 600, duration: 1300, scale: 0.6, ...FIRST })],
}));
put('3D9kGfwg4LUZBR9A', design('Overdrive: the inventor cranks the body-worn gizmos — sparks spit, steam vents and the machinery whirs into overdrive.', () => [
  motion('shake', 'source', { stageId: 'crank', duration: 800, intensity: 0.35 }),
  aura('Gadget sparks', SPARKS('orange'), { stageId: 'spark', after: 'crank', anchor: 'start', offset: 150, duration: 1300, scale: 0.8, ...tint('#ffb347') }),
  aura('Vented steam', ['fumes.steam.white'], { after: 'spark', anchor: 'start', offset: 400, duration: 1200, scale: 0.5, opacity: 0.6, ...side(-0.4) }),
  motion('pulse', 'source', { after: 'spark', anchor: 'start', offset: 600, duration: 600, intensity: 0.35 }),
], sp('electric', { fx: false })));
put('dEN2xLWOMXWhjGAF', strike('Overflowing Blade: the magic of the internal nexus coats the weapon in force and discharges on the hit.', {
  hit: TRAIL('blueyellow'), accent: ['impact.011.blue'], accentTint: '#9fb8ff',
  pre: [cast('Force coats the weapon', STRANDS_IN('blue'), { stageId: 'coat', scale: 0.6, duration: 700 })],
}));
put('ZJcc7KGOEsYvN6SE', design('Overload Vision: a searing flash bursts in front of the would-be attacker\'s eyes, dazzling or blinding it.', () => [
  motion('pulse', 'source', { stageId: 'flare', duration: 500, intensity: 0.3 }),
  impact('Searing flash', ['impact.005.white', 'impact.yellow'], { stageId: 'flash', after: 'flare', anchor: 'start', offset: 150, duration: 900, scale: 0.8, ...FIRST }),
  impact('Dazzled', DIZZY('white'), { after: 'flash', anchor: 'start', offset: 400, duration: 1300, scale: 0.5, ...FIRST }),
  motion('recoil', 'targets', { after: 'flash', anchor: 'start', duration: 600, intensity: 0.4, ...FIRST }),
], sp('light')));
put('zUWj4zmBNWOTzeFJ', design('Overwhelming Combination: a weapon strike and a fist follow one another into the same target.', () => [
  motion('lunge', 'source', { stageId: 'm1', duration: 550, intensity: 0.7 }),
  impact('Weapon strike', SLASH, { stageId: 'h1', after: 'm1', anchor: 'start', offset: 200, duration: 900, ...FIRST }),
  motion('lunge', 'source', { stageId: 'm2', after: 'm1', anchor: 'end', offset: 50, duration: 550, intensity: 0.8 }),
  impact('Fist follows', FIST, { stageId: 'h2', after: 'm2', anchor: 'start', offset: 200, duration: 900, mirrorX: true, ...FIRST }),
  motion('recoil', 'targets', { after: 'h2', anchor: 'start', offset: 100, duration: 700, intensity: 0.6, requiresHit: true, ...FIRST }),
], ab('unarmed')));

// ---------------------------------------------------------------- P
put('oAGawsNqr6FfMrSG', surge('Pacifying Infusion: the kineticist gentles the gathering elemental power, a soft pale glow readying a nonlethal impulse.', {
  art: STRANDS_IN('blue'), artTint: '#cfe3ef', scale: 0.7, gesture: 'press', gestureI: 0.2,
}));
put('ijZ0DDFpMkWqaShd', handwork('Palm an Object: a quick, unobtrusive scoop of the hand; a tiny glint and the object is gone.'));
put('ms9UJc2HQ4pknGa7', fade('Part the Veil: the user phases into the interstices of reality, flickering and blurring into concealment.', {
  cloud: ['shimmer.01.purple', 'shimmer.01.blue'], cloudTint: '#9b8ab8', gesture: 'flicker',
}));
put('BfC5pWAns8PNewW3', command('Passage of Lines: the commander signals and squadmates swap places with adjacent allies in a crisp rotation.', {
  onTargets: [motion('dodge', 'targets', { after: 'cue', anchor: 'start', offset: 500, duration: 900, intensity: 0.5, distance: 0.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', ...ALL })],
}));
put('ZC4SuXmL79N9VVIW', design('Patron\'s Claim: a grasping limb of the patron stretches from the familiar\'s maw, tears at the creature\'s spirit and drains it.', () => [
  cast('Familiar\'s maw opens', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'maw', scale: 0.6, duration: 900, ...tint('#4a2d5f') }),
  travel('Patron\'s grasping limb', TETHER('dark_purple'), { stageId: 'limb', after: 'maw', anchor: 'start', offset: 300, duration: 1500, ...FIRST }),
  impact('Spirit torn', ['impact.004.dark_purple', 'impact.004.blue'], { stageId: 'rip', after: 'limb', anchor: 'start', offset: 700, duration: 1000, scale: 0.8, ...FIRST, ...tint('#6a4a8c') }),
  motion('stagger', 'targets', { after: 'rip', anchor: 'start', duration: 750, intensity: 0.6, ...FIRST }),
], sp('spirit')));
put('VBwNo2Wbfd4n4Y3g', design('Patron\'s Presence: a palpable, oppressive weight spreads 15 feet from the familiar, fogging the minds of enemies within.', () => [
  motion('press', 'source', { stageId: 'weight', duration: 900, intensity: 0.3 }),
  aura('Patron\'s presence', ['spirit_guardians.dark_purple.no_ring', 'spirit_guardians.blueyellow.ring'], { stageId: 'pres', after: 'weight', anchor: 'start', offset: 150, duration: 2600, scale: 2.4, opacity: 0.65, fadeIn: 400, fadeOut: 600, ...tint('#5a3a7a') }),
  impact('Minds clouded', DIZZY('purple'), { after: 'pres', anchor: 'start', offset: 700, duration: 1400, scale: 0.5, ...ALL }),
], sp('whispers')));
put('EEDElIyin4z60PXx', design('Perform: a brief song, dance or joke — notes rise and the performer sways with the act.', () => [
  motion('drift', 'source', { stageId: 'sway', duration: 1600, intensity: 0.4 }),
  aura('Performance', ['markers.music.greenorange'], { after: 'sway', anchor: 'start', duration: 1900, scale: 0.6, ...above(-0.55) }),
  aura('Notes drift', ['music_notations.beamed_quavers.orange', 'music_notations.beamed_quavers.blue'], { after: 'sway', anchor: 'start', offset: 500, duration: 1300, scale: 0.35, ...side(0.5) }),
], sp('song')));
put('2EE4aF4SZpYf0R6H', handwork('Pick a Lock: careful work with thieves\' tools — a stoop, a probing glint, a click.', { label: 'Picks at the tumblers' }, sp('unlock')));
put('zLFfwNmmPTND6OMO', command('Pincer Attack: on the signal, squadmates Step into a closing pincer around the foe.', {
  onTargets: [motion('dodge', 'targets', { after: 'cue', anchor: 'start', offset: 500, duration: 900, intensity: 0.5, distance: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', ...ALL })],
}));
put('NVLqYqkkQaCdnWWk', command('Piranha Assault: the commander singles out a creature and the squad is told to tear past its resistances with a thousand small bites.', {
  noChevron: true,
  onTargets: [impact('Designated prey', MARK('purple'), { after: 'cue', anchor: 'start', offset: 500, duration: 1500, scale: 0.6, ...FIRST, ...tint('#d04a3a') })],
}));
put('bCDMuu3tE4d6KHrJ', shot('Pistolero\'s Retort: the foe\'s fumble is punished with a quick one-handed shot.', { flightMs: 800 }, ab('pistol')));
put('ri6ZVR7nhFOvZfVa', design('Pitch-Perfect Projection: a perfectly pitched note rings outward, carrying the next auditory effect 30 feet further.', () => [
  motion('pulse', 'source', { stageId: 'note', duration: 700, intensity: 0.3 }),
  aura('Voice rings outward', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { after: 'note', anchor: 'start', offset: 100, duration: 1500, scale: 1.4, opacity: 0.7 }),
  aura('Perfect pitch', ['music_notations.treble_clef.orange', 'music_notations.treble_clef.blue'], { after: 'note', anchor: 'start', duration: 1300, scale: 0.35, ...above(-0.6) }),
], sp('song')));
put('seNsB8Xe6zl9NZWz', design('Plaintive Plea: an earnest, heartfelt appeal softens the listener before the next diplomatic roll.', () => [
  motion('press', 'source', { stageId: 'plead', duration: 900, intensity: 0.25 }),
  aura('Heartfelt appeal', ['icon.heart.pink'], { after: 'plead', anchor: 'start', offset: 200, duration: 1400, scale: 0.35, opacity: 0.85, fadeOut: 400, ...above(-0.6) }),
], quiet()));
put('cfQb0mBbyrjhyGf5', strike('Plant Thirty Barbs: the ikon strikes and a fragment snaps off inside the foe, barbs bristling from the wound.', {
  hit: PIERCE, tgt: 'stagger', accent: ['ice_spikes.radial.burst.white'], accentTint: '#b8b8b0',
}, ab('spear')));
put('XiiR6WwfTcwIUvHG', design('Plummeting Roll: the user tucks and rolls out of the fall, landing on their feet and moving on.', () => [
  aura('Impact dust', RING, { stageId: 'land', duration: 800, scale: 0.6, opacity: 0.6, below: true, ...tint('#cbbfa8') }),
  path('roll', 1.5, { after: 'land', anchor: 'start', offset: 150, duration: 1300, intensity: 0.5 }),
  dust({ after: 'mv', anchor: 'start', scale: 0.5 }),
], quiet()));
put('sn2hIy1iIJX9Vpgj', design('Point Out: a pointing gesture and a called-out distance reveal where the unseen creature lurks.', () => [
  motion('lunge', 'source', { stageId: 'point', duration: 600, intensity: 0.2 }),
  impact('There!', CHEVRON('yellow'), { after: 'point', anchor: 'start', offset: 300, duration: 1300, scale: 0.4, ...above(-0.6), ...FIRST }),
], quiet()));
put('xccOiNL2W1EtfUYl', design('Pointed Question: a needling question is asked and the investigator reads the creature\'s body language.', () => [
  cast('The question', WAVE('orangeyellow'), { stageId: 'ask', scale: 0.5, duration: 900, opacity: 0.6, faceTarget: true }),
  aura('Body language read', EYE('dark_yellow'), { subject: 'targets', after: 'ask', anchor: 'start', offset: 450, duration: 1400, scale: 0.4, opacity: 0.85, ...above(-0.6), ...FIRST, ...tint('#e8c860') }),
  motion('shake', 'targets', { after: 'ask', anchor: 'start', offset: 500, duration: 600, intensity: 0.15, ...FIRST }),
], quiet()));
put('6YIG6eVGTplWubGb', command('Pop, Drop, and Lock: three squadmates converge on one foe — a strike, a trip and a grapple in quick succession.', {
  noChevron: true,
  onTargets: [
    impact('Strike', SLASH, { stageId: 'p1', after: 'cue', anchor: 'start', offset: 450, duration: 800, scale: 0.8, ...FIRST }),
    impact('Trip', DUST, { stageId: 'p2', after: 'p1', anchor: 'start', offset: 400, duration: 800, scale: 0.6, ...FIRST, ...tint('#bba98d') }),
    impact('Lock', CHAIN('grey'), { after: 'p2', anchor: 'start', offset: 400, duration: 1000, scale: 0.6, ...FIRST, ...tint('#c8c0b0') }),
    motion('press', 'targets', { after: 'p2', anchor: 'start', duration: 800, intensity: 0.5, ...FIRST }),
  ],
}));
put('wnZhAUiYcs2mv8sZ', design('Primal Howl: the animal companion screeches a cone of primal sound that batters and frightens everything before it.', () => [
  motion('brace', 'source', { stageId: 'draw', duration: 500, intensity: 0.5 }),
  cast('Howl', WAVE('green'), { stageId: 'howl', after: 'draw', anchor: 'end', scale: 1.4, duration: 1400, faceTarget: true, ...tint('#8fd08a') }),
  impact('Sonic battering', ['impact.sound.01.pinkteal', 'soundwave.01.blue'], { stageId: 'hit', after: 'howl', anchor: 'start', offset: 500, duration: 1000, scale: 0.6, ...ALL }),
  impact('Fear', FEAR('dark_purple'), { after: 'hit', anchor: 'start', offset: 300, duration: 1200, scale: 0.45, ...ALL }),
  motion('cower', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.45, ...ALL }),
], ab('howl')));
put('kbUymGTjbesOKsV6', shout('Primal Roar: the eidolon unleashes a terrifying roar that demoralizes every enemy that hears it.', { cue: WAVE('red'), many: true }, ab('growl')));
put('vdnuczo4ktS7ow7N', reroll('Prophecy\'s Pawn: the prophecy is twisted to reroll the failure — an omen eye watches, for fate will balance the scale.', {
  extra: [aura('Fate takes note', EYE('dark_purple'), { after: 'roll', anchor: 'start', offset: 500, duration: 1200, scale: 0.35, opacity: 0.6, ...side(0.55), ...above(-0.4) })],
}));
put('5yBBgZ7OCWWJsnLo', command('Protective Screen: a squadmate is waved over to screen the war mage, a shield sign flashing over the screened ally.', {
  onTargets: [aura('Screened', ['icon.shield.blue', 'icon.shield.green'], { subject: 'targets', after: 'ans', anchor: 'start', offset: 400, duration: 1300, scale: 0.4, ...above(-0.6), ...ALL })],
}));
put('pFgkxLJsAcImb0Eg', strike('Puncture Flesh: the piercing weapon hooks the foe and holds it in a bleeding grapple.', {
  hit: PIERCE, tgt: 'stagger',
  post: [
    aura('Hooked and held', CHAIN('grey'), { subject: 'targets', after: 'hit', anchor: 'start', offset: 400, duration: 1200, scale: 0.6, requiresHit: true, ...FIRST, ...tint('#c8c0b0') }),
    aura('Bleeding', BLOOD, { subject: 'targets', after: 'hit', anchor: 'start', offset: 700, duration: 1200, scale: 0.4, requiresHit: true, ...FIRST }),
  ],
}, ab('spear')));

// ---------------------------------------------------------------- Q–R
const brew = (why, c, hex) => handwork(why, {
  art: [`bubble.002.001.complete.${c}`, 'bubble.002.001.complete.blue'], artTint: hex, label: 'Reagents bubble',
  extra: [aura('Vial ready', GLINT, { after: 'hands', anchor: 'end', offset: 100, duration: 700, scale: 0.4, ...side(0.35) })],
});
put('yzNJgwzV9XqEhKc6', brew('Quick Alchemy: a versatile vial is shaken and transformed into an infused consumable in a burst of bubbling reagents.', 'greenyellow', '#a8d86a'));
put('QHFMeJGzFWj2QczA', brew('Quick Tincture: a short-lived elixir is brewed in the hand, reagents bubbling for a moment.', 'orangeyellow', '#e8b860'));
const rage = (why) => design(why, () => [
  motion('brace', 'source', { stageId: 'gather', duration: 600, intensity: 0.7 }),
  aura('Red battle aura', BUFF('purplered'), { stageId: 'aura', after: 'gather', anchor: 'start', offset: 200, duration: 2400, scale: 1.1, fadeOut: 600, ...tint('#d0302a') }),
  aura('Fury flares', ['impact.012.dark_red', 'impact.012.blue'], { after: 'gather', anchor: 'end', duration: 1000, scale: 0.9, ...tint('#c0392b') }),
  motion('shake', 'source', { after: 'gather', anchor: 'end', duration: 600, intensity: 0.6 }),
  motion('pulse', 'source', { after: 'gather', anchor: 'end', offset: 450, duration: 800, intensity: 0.7 }),
  aura('Ground shudders', ['ground_cracks.01.dark_red', 'ground_cracks.01.orange'], { after: 'gather', anchor: 'end', duration: 1600, scale: 0.7, below: true, opacity: 0.6 }),
], ab('battleCry'));
put('Ah5g9pDwWF9b9VW9', rage('Rage: the barbarian taps into inner fury — a red battle aura flares, the body swells with a fury pulse and the ground shudders.'));
put('a9PzINjFTO5GvAJN', rage('Quick-Tempered: the fury is instantaneous — the barbarian Rages the moment initiative is rolled, red aura flaring.'));
put('MrTULCUsE9naPxXg', flight('Race the Skies: the exemplar rises to take their place among the heavens, stars glinting in the updraft.', {
  feathers: ['particles.outward.white.01.01', 'particles.outward.greenyellow.01.01'], featherTint: '#e8f0ff',
  extra: [aura('Starlit glints', ['twinkling_stars.points04.white'], { after: 'wings', anchor: 'start', offset: 500, duration: 1300, scale: 0.6 })],
}));
put('RADNqsvAt4gP9FOX', design('Raconteur\'s Reload: a rapid patter of words draws the enemy\'s eye while the hands chamber another round.', () => [
  cast('Distracting words', WAVE('orangeyellow'), { stageId: 'talk', scale: 0.6, duration: 1000, opacity: 0.7, faceTarget: true }),
  aura('Round chambered', GLINT, { after: 'talk', anchor: 'start', offset: 400, duration: 700, scale: 0.4, ...side(0.4) }),
  motion('shake', 'targets', { after: 'talk', anchor: 'start', offset: 500, duration: 600, intensity: 0.2, ...FIRST }),
], quiet()));
put('xjGwis0uaC2305pm', guard('Raise a Shield: the shield comes up and the bearer braces behind it, a steel glint on the rim.', {
  artTint: '#d9dde3', extra: [aura('Rim glints', GLINT, { after: 'ward', anchor: 'start', offset: 300, duration: 700, scale: 0.45, ...above(-0.5) })],
}, ab('shieldRaise'), { fx: false }));
put('MLOkyKi1Y3N6y56Q', design('Raise Neck: the nagaji rears its head up into a striking posture, reach extended.', () => [
  motion('levitate', 'source', { duration: 1100, intensity: 0.35 }),
], quiet()));
put('0VwLAKI7QP6mib88', design('Raise Slabs: thick stone slabs burst up around the user and topple onto every adjacent creature.', () => [
  motion('slam', 'source', { stageId: 'stomp', duration: 800, intensity: 0.5 }),
  aura('Slabs rise', ['impact.ground_crack.03.orange'], { stageId: 'rise', after: 'stomp', anchor: 'start', offset: 550, duration: 1500, scale: 1.6, below: true }),
  impact('Stone topples', ['falling_rocks.top.1x1.grey'], { stageId: 'fall', after: 'rise', anchor: 'start', offset: 300, duration: 1200, scale: 0.8, ...ALL }),
  motion('stagger', 'targets', { after: 'fall', anchor: 'start', offset: 300, duration: 750, intensity: 0.6, ...ALL }),
], sp('earth')));
put('ND1G3s4lXNUAXc1q', design('Raise the Horde: a necromantic circle splits the ground and the skeletal or zombie horde claws its way up.', () => [
  motion('press', 'source', { stageId: 'call', duration: 800, intensity: 0.3 }),
  aura('Necromantic circle', ['magic_signs.circle.02.necromancy.complete.dark_green'], { stageId: 'circle', duration: 2200, scale: 1.2, below: true, ...side(1.3) }),
  aura('The horde rises', ['smoke.plumes.01.dark_green', 'smoke.plumes.01.grey'], { after: 'circle', anchor: 'start', offset: 600, duration: 1600, scale: 0.9, opacity: 0.8, ...side(1.3), ...tint('#5a6a4a') }),
], sp('summon')));
put('IBEbFlMmDbGsrN4G', design('Raise the Walls: the mirrored aegis summons ethereal tortoise-formation shields around the user and one ally.', () => [
  motion('brace', 'source', { stageId: 'raise', duration: 700, intensity: 0.5 }),
  aura('Ethereal shields', SHIELD('blue'), { stageId: 'own', after: 'raise', anchor: 'start', offset: 150, duration: 1700, scale: 0.8, ...tint('#cfe3ff') }),
  aura('Ally\'s shields', SHIELD('blue'), { subject: 'targets', after: 'own', anchor: 'start', offset: 300, duration: 1700, scale: 0.8, ...ALL, ...tint('#cfe3ff') }),
], sp('shield')));
put('FkfWKq9jhhPzKAbb', strike('Rampaging Ferocity: reeling from a death blow, the orc lashes out savagely with one more strike.', {
  hit: HEAVY, srcI: 1, tgt: 'stagger', accent: ['impact.012.dark_red', 'impact.012.blue'], accentTint: '#c0392b',
  pre: [motion('stagger', 'source', { stageId: 'reel', duration: 500, intensity: 0.5 })],
}, ab('axe')));
put('CLX9WEYXdntl2wrt', reroll('Reactive Falsehood: the exposed lie is spun again with the crowd\'s help and the Deception check rerolled.'));
put('KAVf7AmRnbCAHrkT', strike('Reactive Strike: the defender lashes out at a foe that leaves an opening.', { srcI: 0.8 }));
put('iuFPNbfhVXvbCPRO', command('Ready, Aim, Fire!: on the commander\'s signal a volley of shots from the squad converges on the chosen enemy.', {
  noChevron: true,
  onTargets: [
    travel('Volley', ['arrow.physical.white.01'], { stageId: 'vol', after: 'cue', anchor: 'start', offset: 400, duration: 900, repeats: 3, repeatInterval: 220, ...FIRST }),
    impact('Shots land', ['impact.005.white', 'impact.005.orange'], { after: 'vol', anchor: 'end', duration: 900, scale: 0.6, ...FIRST }),
    motion('recoil', 'targets', { after: 'vol', anchor: 'end', duration: 700, intensity: 0.5, ...FIRST }),
  ],
}, ab('bow')));
put('OqKYkzbc7NEWmJWB', design('Rearrange Bones: the skeleton rattles and clicks its bones into the form of another humanoid skeleton.', () => [
  motion('shake', 'source', { stageId: 'rattle', duration: 1000, intensity: 0.4 }),
  aura('Bone dust', SMOKE, { after: 'rattle', anchor: 'start', offset: 200, duration: 1000, scale: 0.6, opacity: 0.5, ...tint('#e6dcc4') }),
  motion('pulse', 'source', { after: 'rattle', anchor: 'end', duration: 600, intensity: 0.25 }),
], sp('transform')));
put('DYn1igFjCGJEiP22', design('Recall Ammunition: the missed shot blinks back through teleportation and is reloaded into the weapon.', () => [
  aura('Shot returns', ['teleport.01.blue'], { stageId: 'blink', duration: 1000, scale: 0.4, ...side(0.4) }),
  aura('Reloaded', GLINT, { after: 'blink', anchor: 'end', offset: -300, duration: 700, scale: 0.4, ...side(0.4) }),
], sp('teleport')));
put('1OagaWtBpVXExToo', recall('Recall Knowledge: a moment of thought — a faint rune of remembered lore glimmers above the head.'));
put('kRxWINkrHUPSHHYq', recall('Recall the Teachings: the psychic searches their mind for a cryptic lesson, which glows into clarity, ready to Aid allies.', {
  rune: ['magic_signs.rune.divination.complete.blue'], runeTint: '#c8a8f0',
  extra: [aura('Lesson shared outward', ['extras.tmfx.outpulse.circle.01.normal'], { after: 'think', anchor: 'end', duration: 1200, scale: 1.4, opacity: 0.4, ...tint('#c8a8f0') })],
}));
put('lH3mlvs1rCyXw6iY', recall('Recall Under Pressure: memory flashes to an old book read long ago; a harrow card flicks as the answer arrives.', {
  extra: [aura('Harrow card', ['ranged.card.01.projectile.01.yellow', 'ranged.card.01.projectile.01.blue'], { after: 'think', anchor: 'start', offset: 900, duration: 800, scale: 0.45, ...side(0.4) })],
}));
put('5p2AMqM9bOVnhwPT', design('Recenter: the psychic draws inward and settles on a new emotional center for the duel.', () => [
  motion('press', 'source', { stageId: 'in', duration: 1000, intensity: 0.25 }),
  aura('Mind recenters', ['extras.tmfx.inpulse.circle.01.normal'], { after: 'in', anchor: 'start', duration: 1300, scale: 1, opacity: 0.5, ...tint('#c8a8f0') }),
], quiet()));
put('rqT4LMH7qbfyScBi', reroll('Reclaim Destiny: the chains of fortune and misfortune snap and the check is rolled clean.', {
  extra: [aura('Fate\'s chains snap', CHAIN('purple'), { after: 'roll', anchor: 'start', duration: 1000, scale: 0.6, opacity: 0.7, ...tint('#b8a0e0') })],
}));
put('cd34tQpOVbaGuv5p', design('Redistribute: the eidolon\'s component bodies scatter and reform around the critical blow, softening it.', () => [
  motion('flicker', 'source', { stageId: 'scatter', duration: 900, intensity: 0.5 }),
  aura('Bodies scatter and reform', SMOKE, { after: 'scatter', anchor: 'start', duration: 1100, scale: 0.8, opacity: 0.5, ...tint('#8a8070') }),
  motion('dodge', 'source', { after: 'scatter', anchor: 'start', offset: 100, duration: 800, intensity: 0.4, distance: 0.2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
], quiet()));
put('I08t3hnpMZSRX5Ug', design('Rejoin in Flight: both weapon ikons are thrown wide to either side of the foe and converge on it, then return to hand.', () => [
  motion('throw', 'source', { stageId: 'toss', duration: 700, intensity: 0.7 }),
  projectile('First ikon', ['dagger.throw.01.white'], { stageId: 't1', after: 'toss', anchor: 'start', offset: 250, duration: 900, offsetY: -0.4, offsetUnits: 'token', ...FIRST }),
  projectile('Second ikon', ['dagger.throw.01.white'], { stageId: 't2', after: 't1', anchor: 'start', offset: 120, duration: 900, offsetY: 0.4, offsetUnits: 'token', ...FIRST }),
  impact('Flanking blows converge', SLASH2, { stageId: 'hit', after: 't2', anchor: 'end', duration: 900, scale: 0.8, ...FIRST }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 700, intensity: 0.6, requiresHit: true, ...FIRST }),
], ab('thrown')));
put('9d9pexfcsyS9yFVT', command('Relentless Assault: an encouraging command sends the troop into a few more attacks, worsening the target\'s save.', {
  noChevron: true,
  onTargets: [impact('Extra attacks', ['flurry_of_blows.physical.orange', 'flurry_of_blows.physical.blue'], { after: 'cue', anchor: 'start', offset: 450, duration: 1200, scale: 0.7, ...FIRST }), motion('shake', 'targets', { after: 'cue', anchor: 'start', offset: 600, duration: 700, intensity: 0.4, ...FIRST })],
}));
put('NjS64g60oV74XZjq', command('Reload!: a drill call and every squadmate snaps a fresh round into place.', {
  onTargets: [aura('Reloaded', GLINT, { subject: 'targets', after: 'cue', anchor: 'start', offset: 600, duration: 700, scale: 0.4, ...side(0.35), ...ALL })],
}));
put('tmbf6xouEnRXCnKR', design('Reloading Cascade: arcane energy spirals into a cascade stance while the hands reload the firearm.', () => [
  aura('Arcane cascade', ['energy_strands.complete.blue.01'], { stageId: 'cas', duration: 1500, scale: 0.8, opacity: 0.8 }),
  motion('press', 'source', { after: 'cas', anchor: 'start', duration: 700, intensity: 0.2 }),
  aura('Round chambered', GLINT, { after: 'cas', anchor: 'start', offset: 600, duration: 700, scale: 0.4, ...side(0.4) }),
], quiet()));
put('jSC5AYEfliOPpO3H', strike('Reloading Strike: a melee strike and a reload in one fluid motion.', {
  post: [aura('Reloaded', GLINT, { after: 'hit', anchor: 'start', offset: 450, duration: 700, scale: 0.4, ...side(0.4) })],
}));
put('AHCMtFUZXpw98PqS', design('Remove Head: the ghost lifts its head off its shoulders in a pale, spectral shimmer.', () => [
  aura('Spectral shimmer', ['smoke.puff.centered.blue', 'smoke.puff.centered.grey'], { stageId: 'sh', duration: 1100, scale: 0.4, opacity: 0.55, ...above(-0.4), ...tint('#bcd4e6') }),
  motion('flicker', 'source', { after: 'sh', anchor: 'start', duration: 900, intensity: 0.3 }),
], quiet()));
put('SN3sVsU7rD2eBfkf', guard('Repel Ambient Magic: the ostilli glows green, drawing in loose magic and hardening its host against the next spell.', {
  art: SHIELD('green'), scale: 0.8, overhead: false,
  extra: [cast('Ostilli draws magic in', STRANDS_IN('green'), { delay: 0, scale: 0.6, duration: 900 })],
}));
put('lOE4yjUnETTdaf2T', strike('Reposition: the user muscles the creature around, pushing it to a new square within reach.', {
  hit: SHOVE, scale: 0.7, srcI: 0.6, tgt: null,
  post: [motion('dodge', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 900, intensity: 0.5, distance: 0.6, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', requiresHit: true, ...FIRST })],
}, ab('unarmed')));
put('DCb62iCBrJXy0Ik6', design('Request: a polite, persuasive word; the friendly creature gives a small nod.', () => [
  cast('Polite request', WAVE('orangeyellow'), { stageId: 'ask', scale: 0.5, duration: 900, opacity: 0.55, faceTarget: true }),
  motion('pulse', 'targets', { after: 'ask', anchor: 'start', offset: 500, duration: 600, intensity: 0.15, ...FIRST }),
], quiet()));
put('On5CQjX4euWqToly', guard('Resist Elf Magic: ancestral resistance flares as a pale green ward against the magical effect.', {
  art: SHIELD('green'), artTint: '#a8e0a0', scale: 0.75, overhead: false,
}));
put('XeZwXzR1KBlJF770', guard('Resist Magic: the user\'s innate magic hardens into a brief ward before the save.', { art: SHIELD('blue'), scale: 0.75, overhead: false }));
put('XkrN7gxdRXTYYBkX', design('Restore the Mind: reassuring psychic strength flows to an ally, steadying their mind and closing wounds.', () => [
  motion('pulse', 'source', { stageId: 'send', duration: 600, intensity: 0.3 }),
  travel('Reassurance flows', TETHER('purple'), { stageId: 'flow', after: 'send', anchor: 'start', offset: 150, duration: 1200, opacity: 0.75, ...FIRST, ...tint('#e0a8e0') }),
  impact('Mind restored', HEAL('purple'), { after: 'flow', anchor: 'start', offset: 600, duration: 1600, scale: 0.75, ...FIRST }),
], sp('healing')));
put('0jJQglG57R6ss04M', design('Restore the Moment: time loops back and the preserved turn replays — afterimages trail the user as the actions repeat.', () => [
  aura('Time loops', ['shimmer.01.blue'], { stageId: 'loop', duration: 1200, scale: 0.9 }),
  sprite('Echo of the preserved moment', { after: 'loop', anchor: 'start', offset: 200, duration: 1300, opacity: 0.35, copies: 2, copySpread: 0.4 }),
  path('rush', 1.5, { after: 'loop', anchor: 'start', offset: 400, duration: 1400, intensity: 0.3 }),
], sp('time')));
put('EAP98XaChJEbgKcK', design('Retributive Strike: the champion\'s aura flares to protect the ally and a holy-lit strike answers the enemy who hurt them.', () => [
  cast('Holy light flares', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'flare', scale: 0.7, duration: 1100 }),
  motion('lunge', 'source', { stageId: 'swing', after: 'flare', anchor: 'start', offset: 400, duration: 650, intensity: 0.8 }),
  impact('Holy-lit strike', TRAIL('blueyellow'), { stageId: 'hit', after: 'swing', anchor: 'start', offset: 250, duration: 1000, ...FIRST, ...tint('#f5e6a8') }),
  aura('Radiance bursts', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { subject: 'targets', after: 'hit', anchor: 'start', offset: 150, duration: 1200, scale: 0.7, requiresHit: true, ...FIRST }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.6, requiresHit: true, ...FIRST }),
], ab('enchanted-sword-brilliant')));
put('SNjmjFw30KQxIP4A', reroll('Rewrite Fate: mythic power flashes outward as the chains of fate are cast aside and the check rerolled.', {
  glint: ['impact.012.yellow', 'impact.012.blue'], glintTint: '#f2dc8a',
  extra: [aura('Chains of fate cast aside', CHAIN('yellow'), { after: 'roll', anchor: 'start', duration: 1000, scale: 0.7, opacity: 0.8, ...tint('#e0c870') })],
}));
put('ublVm5gmCIm3eRdQ', design('Ring Bell: the bell implement sings out a sudden crash of sound that rattles the foe as it acts.', () => [
  cast('Bell rings', ['toll_the_dead.purple.bell', 'toll_the_dead.green.bell'], { stageId: 'bell', scale: 0.5, duration: 1200, ...side(0.45), ...tint('#e8d29a') }),
  travel('Ringing peal', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'peal', after: 'bell', anchor: 'start', offset: 300, duration: 900, opacity: 0.75, ...FIRST }),
  impact('Discordant crash', ['impact.sound.01.pinkteal', 'soundwave.01.blue'], { after: 'peal', anchor: 'end', offset: -150, duration: 900, scale: 0.6, ...FIRST }),
  motion('shake', 'targets', { after: 'peal', anchor: 'end', duration: 700, intensity: 0.45, ...FIRST }),
], sp('metalResonance')));
put('mBqZ2IahMT9Jvo7k', design('Ringing Challenge: the ikon clangs against weapon or ground and a spirit-sonic shock wave rolls out over every creature nearby.', () => [
  motion('slam', 'source', { stageId: 'clang', duration: 800, intensity: 0.5 }),
  aura('Shock wave', ['thunderwave.center.orange', 'thunderwave.center.blue'], { stageId: 'wave', after: 'clang', anchor: 'start', offset: 550, duration: 1300, scale: 1.6, ...tint('#f0e0b0') }),
  impact('Spirit-sonic impact', ['impact.sound.01.pinkteal', 'soundwave.01.blue'], { after: 'wave', anchor: 'start', offset: 300, duration: 900, scale: 0.6, ...ALL }),
  motion('recoil', 'targets', { after: 'wave', anchor: 'start', offset: 300, duration: 700, intensity: 0.5, ...ALL }),
], sp('sonic')));
put('ILwYke30PIAr2CVX', design('Roaring Charge: the commander and squad surge forward with a mighty roar, terrifying the enemies they close on.', () => [
  cast('Mighty roar', WAVE('red'), { stageId: 'roar', scale: 1, duration: 1100, faceTarget: true }),
  toTarget('rush', 3, { after: 'roar', anchor: 'start', offset: 200, duration: 1500 }),
  dust({ after: 'mv', anchor: 'start' }),
  impact('Fear', FEAR('dark_red'), { stageId: 'fear', after: 'mv', anchor: 'arrival', duration: 1300, scale: 0.5, ...ALL }),
  motion('cower', 'targets', { after: 'fear', anchor: 'start', offset: 100, duration: 800, intensity: 0.45, ...ALL }),
], ab('battleCry')));
put('YdS8gzytU5gvK5QY', design('Rouse the World: flora, fauna and elements stir and whisper, leaves swirling as the waking world answers the call.', () => [
  motion('press', 'source', { stageId: 'call', duration: 800, intensity: 0.25 }),
  aura('Leaves stir', ['swirling_leaves.complete.01.green'], { after: 'call', anchor: 'start', offset: 200, duration: 1800, scale: 1.4, opacity: 0.85 }),
  aura('Growth answers', ['plant_growth.03.round.2x2.complete.greenyellow'], { after: 'call', anchor: 'start', offset: 400, duration: 2000, scale: 1.2, opacity: 0.6, below: true }),
  impact('The world whispers', ['swirling_leaves.complete.02.green'], { after: 'call', anchor: 'start', offset: 700, duration: 1500, scale: 0.8, ...ALL }),
], sp('growth')));
put('lID4rJHAVZB6tavf', design('Run Over: the vehicle barrels straight ahead, ramming the creature in its path with a crushing collision.', () => [
  toTarget('rush', 4, { duration: 1500, intensity: 0.5 }),
  dust({ after: 'mv', anchor: 'start', scale: 0.8 }),
  impact('Collision', ['impact.009.orange'], { stageId: 'hit', after: 'mv', anchor: 'arrival', duration: 1000, scale: 1, ...ALL }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 750, intensity: 0.7, ...ALL }),
], sp('bludgeon')));
put('rPefHA2zqmUvGXQ7', design('Runelord\'s Response: the spell that struck the runelord is twisted in a flare of runes and hurled back as raw force.', () => [
  aura('Runes twist the spell', ['magic_signs.rune.evocation.complete.red'], { stageId: 'rune', duration: 1100, scale: 0.5, ...above(-0.55), ...tint('#c0a0ff') }),
  travel('Force hurled back', ['eldritch_blast.purple'], { stageId: 'bolt', after: 'rune', anchor: 'start', offset: 500, duration: 900, ...FIRST }),
  impact('Force impact', ['impact.011.purple', 'impact.011.blue'], { after: 'bolt', anchor: 'end', duration: 900, scale: 0.7, ...FIRST }),
  motion('recoil', 'targets', { after: 'bolt', anchor: 'end', duration: 650, intensity: 0.5, ...FIRST }),
], sp('force')));

// ---------------------------------------------------------------- S
put('b6CanpXyUKJgxEwq', design('Salt Wound: salt and brine spray from the undine\'s blood into the attacker\'s wound, burning it.', () => [
  impact('Brine sprays', ['liquid.splash_side.blue'], { stageId: 'brine', duration: 1000, scale: 0.6, ...FIRST, ...tint('#cfe8ee') }),
  impact('Salt burns', ['fumes.04.complete.grey'], { after: 'brine', anchor: 'start', offset: 400, duration: 1200, scale: 0.5, opacity: 0.7, ...FIRST, ...tint('#e8eef0') }),
  motion('recoil', 'targets', { after: 'brine', anchor: 'start', offset: 150, duration: 700, intensity: 0.45, ...FIRST }),
], sp('acid')));
put('ZI7TLmmUu7fYLrP0', command('Sanguine Revitalization: the squad closes in and cuts at the designated foe until it bleeds freely.', {
  noChevron: true,
  onTargets: [
    impact('Squad strikes', SLASH, { stageId: 'cuts', after: 'cue', anchor: 'start', offset: 450, duration: 900, scale: 0.8, repeats: 2, repeatInterval: 350, ...FIRST }),
    impact('Arterial spray', ['liquid.splash_side02.red'], { after: 'cuts', anchor: 'end', duration: 900, scale: 0.6, requiresHit: true, ...FIRST }),
    motion('recoil', 'targets', { after: 'cuts', anchor: 'start', offset: 150, duration: 700, intensity: 0.5, ...FIRST }),
  ],
}, sp('slash')));
put('85f4wG1ALCXBMwaC', command('Scrappy Defiance: words of encouragement stiffen the troop\'s resolve, bolstering it with temporary vigor.', {
  onTargets: [aura('Bolstered', ['markers.shield.green.01'], { subject: 'targets', after: 'ans', anchor: 'start', offset: 300, duration: 1300, scale: 0.4, ...above(-0.6), ...ALL })],
}));
put('BlAOM2X92SI6HMtJ', design('Seek: the user scans the area — watchful eyes open and a faint sweep searches for hidden creatures and objects.', () => [
  motion('press', 'source', { stageId: 'scan', duration: 1000, intensity: 0.15 }),
  aura('Searching eyes', EYES('dark_yellow'), { after: 'scan', anchor: 'start', duration: 1600, scale: 0.6, opacity: 0.85, ...above(-0.5), ...tint('#e8c860') }),
  aura('Scanning sweep', ['extras.tmfx.radar.circle.pulse.01.normal'], { after: 'scan', anchor: 'start', offset: 300, duration: 1600, scale: 2.2, opacity: 0.35 }),
], quiet()));
put('h3NqgU6MEEF7mgzH', command('Seek and Destroy: the squad searches out hidden foes and pounces on any it uncovers.', {
  noChevron: true,
  onTargets: [
    aura('Uncovered', EYE('dark_yellow'), { subject: 'targets', stageId: 'found', after: 'cue', anchor: 'start', offset: 400, duration: 1100, scale: 0.4, ...above(-0.6), ...FIRST, ...tint('#e8c860') }),
    impact('Squad strikes', SLASH, { after: 'found', anchor: 'end', offset: -200, duration: 900, scale: 0.8, ...FIRST }),
  ],
}));
put('nSTMF6kYIt6rXhJx', surge('Seething Frenzy: the eidolon\'s fury boils over into a reckless red frenzy.', {
  art: BUFF('purplered'), artTint: '#d0302a', scale: 1.05, gesture: 'shake', gestureI: 0.6,
  accent: ['impact.012.dark_red', 'impact.012.blue'], accentTint: '#c0392b', accentScale: 0.8, accentAbove: false,
}, ab('growl')));
put('enQieRrITuEQZxx2', guard('Selfish Shield: self-interest hardens into a golden barrier against the triggering blow.', {
  art: SHIELD('yellow'), artTint: '#e8c860', scale: 0.8, overhead: false,
}));
put('1xRFPTFtWtGJ9ELw', observe('Sense Motive: the user studies the creature\'s body language for signs of deceit.'));
put('uWTQxEOj2pl45Kns', observe('Sense Weakness: the duelist picks the precise moment to strike, spotting the opponent\'s opening.', {
  c: 'dark_red', eyeTint: '#d04a3a',
  extra: [impact('Opening', MARK('purple'), { after: 'eye', anchor: 'start', offset: 600, duration: 1100, scale: 0.5, ...FIRST, ...tint('#d04a3a') })],
}));
put('vvYsE7OiSSCXhPdr', design('Set Explosives: the bombs are fixed to the object and a fuse light starts blinking.', () => [
  motion('press', 'source', { stageId: 'rig', duration: 900, intensity: 0.3 }),
  impact('Bomb rigged', ['ui.indicator.red.01.01', 'ui.indicator.yellow.01.01'], { after: 'rig', anchor: 'start', offset: 400, duration: 1500, scale: 0.4, ...FIRST, ...tint('#e04a3a') }),
], quiet()));
put('vFaNE7s7vFs9BxJW', reroll('Set Free: the attempt to break the hold is rolled twice, the binding chains straining.', {
  extra: [aura('Bonds strain', CHAIN('grey'), { after: 'roll', anchor: 'start', duration: 1000, scale: 0.6, opacity: 0.7, ...tint('#c8c0b0') })],
}));
put('VCUz5EnBUJF07j1a', design('Sever Conduit: the summoner snaps the tether and the eidolon winks out before the killing damage lands.', () => [
  motion('shake', 'source', { stageId: 'snap', duration: 600, intensity: 0.3 }),
  aura('Conduit snaps', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'snap', anchor: 'start', duration: 900, scale: 0.7, ...tint('#f2dc8a') }),
  motion('flicker', 'targets', { after: 'snap', anchor: 'start', offset: 200, duration: 900, intensity: 0.8, ...FIRST }),
], sp('dispel')));
put('XFdTDDAPO7U0r4Et', design('Sever Four Dragonfly Wings: the ikon slashes from one foe to the next, up to four cuts in a single flowing sequence.', () => [
  motion('spin', 'source', { stageId: 'flow', duration: 1300, intensity: 1 }),
  impact('Chain of cuts', SLASH2, { stageId: 'cuts', after: 'flow', anchor: 'start', offset: 200, duration: 800, scale: 0.85, targetLimit: 4, targetStagger: 260, ...ALL }),
  motion('recoil', 'targets', { after: 'cuts', anchor: 'start', offset: 120, duration: 650, intensity: 0.5, requiresHit: true, targetLimit: 4, targetStagger: 260, ...ALL }),
], ab('sword')));
put('VQ5OxaDKE0lCj8Mr', design('Shadow Step: the familiar melts into shadow and steps out of darkness up to 30 feet away.', () => [
  aura('Melts into shadow', ['misty_step.01.dark_black', 'misty_step.01.blue'], { stageId: 'blink', duration: 1200, scale: 0.7, ...tint('#2d2838') }),
  motion('flicker', 'source', { after: 'blink', anchor: 'start', duration: 1000, intensity: 0.8 }),
], sp('shadow')));
put('EZcykqDJzQyZmJ7E', command('Shadows in the Moonlight: the commander\'s quiet hand signals cloak the squad in shadow and silence.', {
  noChevron: true,
  onTargets: [
    aura('Squad slips into shadow', DARK_SMOKE, { subject: 'targets', stageId: 'hide', after: 'cue', anchor: 'start', offset: 400, duration: 1200, scale: 0.7, opacity: 0.5, ...ALL, ...tint('#3a3a4a') }),
    motion('sink', 'targets', { after: 'hide', anchor: 'start', duration: 1100, intensity: 0.3, ...ALL }),
  ],
}, quiet()));
put('wGTHH6v25CDavO6g', reroll('Shake It Off: the user shudders the condition away and rerolls the save.', {
  extra: [motion('shake', 'source', { after: 'roll', anchor: 'start', duration: 700, intensity: 0.45 })],
}));
put('bwXH0zItp8p8sSjn', surge('Share Death\'s Promises: a Mythic Point is spent and a dark crimson resolve, bound to doom, empowers every blow.', {
  art: ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue.01'], artTint: '#8a2a2a', scale: 0.8,
}));
put('MY6z2b4GPhAD2Eoa', design('Share Life: a red lifeline links the user to the wounded ally, taking half the damage onto themselves.', () => [
  travel('Lifeline', TETHER('dark_red'), { stageId: 'link', duration: 1500, opacity: 0.8, ...FIRST, ...tint('#d84a4a') }),
  aura('Pain shared', HEARTBEAT('red'), { after: 'link', anchor: 'start', offset: 500, duration: 1300, scale: 0.45, ...above(-0.6), ...tint('#d84a4a') }),
  motion('stagger', 'source', { after: 'link', anchor: 'start', offset: 600, duration: 700, intensity: 0.4 }),
], sp('drain')));
put('3ZzoI9MTtJFd1Kjl', design('Share Senses: the summoner\'s eyes go blank as their senses are projected into the eidolon.', () => [
  aura('Senses leave the body', EYE('purple'), { stageId: 'out', duration: 1100, scale: 0.4, opacity: 0.7, ...above(-0.6) }),
  travel('Senses projected', TETHER('purple'), { stageId: 'link', after: 'out', anchor: 'start', offset: 400, duration: 1300, opacity: 0.6, ...FIRST }),
  aura('Eidolon perceives', EYE('purple'), { subject: 'targets', after: 'link', anchor: 'start', offset: 600, duration: 1300, scale: 0.4, ...above(-0.6), ...FIRST }),
], quiet()));
put('Xj3LvT3I78cVwzer', design('Shatter Glass: shards of the glassy skin burst off and slash into the adjacent attacker.', () => [
  motion('shake', 'source', { stageId: 'crack', duration: 500, intensity: 0.4 }),
  impact('Glass shards', ['side_impact.ice_shard.blue'], { stageId: 'shards', after: 'crack', anchor: 'start', offset: 150, duration: 1000, scale: 0.8, ...FIRST, ...tint('#e0f4f8') }),
  motion('recoil', 'targets', { after: 'shards', anchor: 'start', offset: 150, duration: 650, intensity: 0.5, ...FIRST }),
], sp('slash')));
put('uruoG0PuuA0CqEG7', design('Shed Spirit: the familiar\'s spirit leaves its shell, flies at an enemy and drains it, then swoops to mend an ally.', () => [
  aura('Spirit leaves the shell', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'rise', duration: 900, scale: 0.4, opacity: 0.8, ...tint('#cfe3ff') }),
  projectile('Spirit flies', ['ranged.03.projectile.01.bluegreen'], { stageId: 'fly', after: 'rise', anchor: 'start', offset: 300, duration: 900, ...FIRST, ...tint('#cfe3ff') }),
  impact('Spirit strikes', ['impact.004.blue'], { stageId: 'hit', after: 'fly', anchor: 'end', duration: 900, scale: 0.7, ...FIRST, ...tint('#cfe3ff') }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 650, intensity: 0.5, ...FIRST }),
  impact('Ally mended', HEAL('blue'), { after: 'hit', anchor: 'start', offset: 600, duration: 1400, scale: 0.6, targetSelection: 'secondary', optionalTargets: true }),
], sp('spirit')));
put('rU3CE5niG8vHc5x4', design('Shed the Mortal Skin: the old skin sloughs away to reveal a glowing divine form that sheds bright light around the user.', () => [
  motion('shake', 'source', { stageId: 'shed', duration: 700, intensity: 0.3 }),
  aura('Skin sloughs away', SMOKE, { after: 'shed', anchor: 'start', duration: 900, scale: 0.7, opacity: 0.5, ...tint('#c8b890') }),
  aura('Divine radiance', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'glow', after: 'shed', anchor: 'end', offset: -200, duration: 2400, scale: 1.4, opacity: 0.85, ...tint('#f5e6a8') }),
  motion('pulse', 'source', { after: 'glow', anchor: 'start', duration: 800, intensity: 0.35 }),
], sp('light')));
put('yOk8s1pftOe5I9Sg', guard('Shielding Wave: a magical barrier of twisting currents wraps the user against acid and fire.', {
  art: ['shield_themed.above.ice.01.blue', 'shield_themed.above.ice.01.blue'], artTint: '#7ac0e8', scale: 0.85, overhead: false,
  extra: [aura('Currents swirl', WATER, { after: 'ward', anchor: 'start', duration: 1100, scale: 0.7, opacity: 0.7, below: true })],
}, sp('water')));
put('LAo3ERyiaHx3E8qg', command('Shields Up!: on the signal every squadmate raises a shield.', {
  noChevron: true,
  onTargets: [
    aura('Shields raised', RAMPART, { subject: 'targets', after: 'cue', anchor: 'start', offset: 400, duration: 1400, scale: 0.5, ...above(-0.5), ...ALL, ...tint('#d9dde3') }),
    motion('brace', 'targets', { after: 'cue', anchor: 'start', offset: 400, duration: 700, intensity: 0.4, ...ALL }),
  ],
}, ab('shieldRaise')));
put('9cGJBXSJW6EpgibP', surge('Shift Immanence: the divine spark flows into an ikon, which kindles with soft radiant light.', {
  art: STRANDS_IN('yellow'), artTint: '#f2dc8a', scale: 0.7, gesture: 'press', gestureI: 0.2,
  accent: GLINT, accentScale: 0.5, accentAbove: false,
}));
put('iGEKY2XsPFbdiV3j', design('Shift Spell: the conduit is pressed to the spell\'s weave and its runes rotate into a new shape.', () => [
  motion('press', 'source', { stageId: 'touch', duration: 900, intensity: 0.25 }),
  impact('Spell weave shifts', ['extras.tmfx.runes.circle.simple.transmutation'], { after: 'touch', anchor: 'start', offset: 200, duration: 1600, scale: 0.8, opacity: 0.7, ...FIRST, ...spin(4000) }),
], sp('dispel')));
put('7blmbDrQFNfdT731', strike('Shove: a hard two-handed push sends the creature staggering back.', {
  hit: SHOVE, scale: 0.75, srcI: 0.9, tgt: null,
  post: [
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 80, duration: 900, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', requiresHit: true, ...FIRST }),
    aura('Scuffed dust', DUST, { subject: 'targets', after: 'hit', anchor: 'start', offset: 150, duration: 800, scale: 0.5, opacity: 0.6, ...FIRST, ...tint('#bba98d') }),
  ],
}, ab('unarmed')));
put('x73LKNcaRwurr0fR', surge('Sickening Assault: the dispersed eidolon\'s bodies roil with a sickly green menace before the swarm attack.', {
  art: ['fumes.04.complete.green', 'fumes.04.complete.grey'], artTint: '#8fbf5a', scale: 0.8, gesture: 'shake', gestureI: 0.3,
}));
put('A4L90h7FIgO5EyBx', design('Siegebreaker: the gunslinger charges, smashes the weapon into the target and fires, then digs in defensively.', () => [
  toTarget('rush', 3, { duration: 1300 }),
  dust({ after: 'mv', anchor: 'start' }),
  impact('Weapon smash', BLUNT, { stageId: 'smash', after: 'mv', anchor: 'arrival', duration: 900, ...FIRST }),
  cast('Point-blank shot', MUZZLE, { after: 'smash', anchor: 'start', offset: 250, scale: 0.6, duration: 600, faceTarget: true, ...side(0.4) }),
  motion('stagger', 'targets', { after: 'smash', anchor: 'start', offset: 100, duration: 750, intensity: 0.6, requiresHit: true, ...FIRST }),
  motion('brace', 'source', { after: 'smash', anchor: 'end', duration: 700, intensity: 0.5 }),
], ab('firearm')));
put('b7yAKSmZ7famsENr', observe('Size Up: the user reads the chosen creature\'s motives and marks it as their focus.'));
put('exuTl8tvVlewxVGJ', design('Skirt the Underworld: the exemplar slips through the world of the dead, vanishing into grave-shadow and flying past blinded foes.', () => [
  aura('Underworld shadow', DARK_SMOKE, { stageId: 'veil', duration: 1300, scale: 0.8, opacity: 0.7, ...tint('#2d2838') }),
  motion('flicker', 'source', { after: 'veil', anchor: 'start', duration: 900, intensity: 0.8 }),
  path('rush', 2, { after: 'veil', anchor: 'start', offset: 500, duration: 1400, intensity: 0.3 }),
  impact('Blinded', DIZZY('black'), { after: 'mv', anchor: 'start', offset: 600, duration: 1200, scale: 0.5, ...ALL }),
], sp('shadow')));
put('JpcegMRqdizrkG0m', recall('Slayer\'s Identification: the undead is recognized at a glance as lore of the grave surfaces.', {
  rune: ['magic_signs.rune.necromancy.complete.green'],
  extra: [impact('Undead identified', ['icon.skull.purple'], { after: 'think', anchor: 'start', offset: 500, duration: 1300, scale: 0.4, opacity: 0.8, ...above(-0.6), ...FIRST })],
}));
put('OULAoPQYFoiRhjXP', command('Slip and Sizzle: one squadmate trips the foe and a waiting caster blasts it as it falls.', {
  noChevron: true,
  onTargets: [
    impact('Tripped', DUST, { stageId: 'trip', after: 'cue', anchor: 'start', offset: 400, duration: 800, scale: 0.6, ...FIRST, ...tint('#bba98d') }),
    motion('press', 'targets', { after: 'trip', anchor: 'start', duration: 800, intensity: 0.5, ...FIRST }),
    impact('Spell sizzles', ['impact.011.orange', 'impact.011.blue'], { after: 'trip', anchor: 'start', offset: 600, duration: 1000, scale: 0.7, ...FIRST }),
  ],
}, sp('explosion')));
put('pTHMZLqWDJ3lkan9', fade('Smoke Blending: the sylph draws the drifting smoke close, blurring into it.', { cloud: SMOKE, cloudTint: '#8a8a8a', gesture: 'flicker' }));
put('VMozDqMMuK5kpoX4', design('Sneak: the user drops low and slinks along, fading into shadow rather than dashing.', () => [
  motion('sink', 'source', { stageId: 'low', duration: 1600, intensity: 0.4 }),
  motion('drift', 'source', { after: 'low', anchor: 'start', offset: 200, duration: 1500, intensity: 0.3 }),
  aura('Shadow cloaks the movement', SMOKE, { after: 'low', anchor: 'start', offset: 250, duration: 1300, scale: 0.7, opacity: 0.45, ...tint('#4a4a58') }),
], quiet()));
put('mVscmsZWWcVACdU5', flight('Soaring Flight: the tengu\'s magical wings unfurl and beat, lifting it into the air.', { feathers: FEATHERS }));
put('DpboPjBwZLbEWOHe', design('Solitary Invocation: the runesmith speaks a rune\'s name; it blazes on its bearer and fades, its task complete.', () => [
  motion('pulse', 'source', { stageId: 'utter', duration: 600, intensity: 0.3 }),
  impact('Rune blazes', ['icon.runes.orange'], { stageId: 'rune', after: 'utter', anchor: 'start', offset: 250, duration: 1200, scale: 0.5, fadeOut: 500, ...FIRST }),
  impact('Invocation flare', ['impact.012.orange', 'impact.012.blue'], { after: 'rune', anchor: 'start', offset: 400, duration: 900, scale: 0.6, ...FIRST }),
], quiet()));
put('ZEsBPUmxNJ0nod2Z', mend('Sorshen\'s Devotion: arcane devotion closes the wounds of the creature that rewrote its fate.', { art: HEAL('purple'), artTint: '#f0a8d8' }));
put('tHHpBREXDaafK3TF', design('Spasm of the Berserker: the body warps and swells into a powerful one-eyed form in a frenzied surge.', () => [
  motion('shake', 'source', { stageId: 'warp', duration: 800, intensity: 0.6 }),
  motion('pulse', 'source', { after: 'warp', anchor: 'end', duration: 1000, intensity: 1 }),
  aura('Frenzy', BUFF('purplered'), { after: 'warp', anchor: 'start', offset: 200, duration: 1800, scale: 1.2, fadeOut: 500, ...tint('#d0302a') }),
  aura('One great eye', EYE('dark_red'), { after: 'warp', anchor: 'end', duration: 1300, scale: 0.5, ...above(-0.6), ...tint('#d04a3a') }),
], ab('growl')));
put('3MiV0maH8imtnVwS', shot('Spell-Woven Shot: a spell is woven into the round, which streaks out carrying the magic to the target.', {
  flight: ['bullet.Snipe.purple', 'bullet.Snipe.blue'],
  pre: [cast('Spell woven into the round', STRANDS_IN('purple'), { stageId: 'weave', scale: 0.7, duration: 900 })],
  post: [impact('Spell discharges', ['impact.011.purple', 'impact.011.blue'], { after: 'hit', anchor: 'start', offset: 150, duration: 1000, scale: 0.7, ...FIRST })],
}));
put('VNuOwXIHafSLHvsZ', shot('Spellsling: the beast gun swallows the spell and spits it out with the round in a single magic-laden shot.', {
  flight: ['bullet.Snipe.green', 'bullet.Snipe.blue'],
  pre: [cast('Beast gun drinks the spell', STRANDS_IN('green'), { stageId: 'weave', scale: 0.7, duration: 900 })],
  post: [impact('Spell discharges', ['impact.011.green', 'impact.011.blue'], { after: 'hit', anchor: 'start', offset: 150, duration: 1000, scale: 0.7, ...FIRST })],
}));
put('QDW9H8XLIjuW2fE4', design('Spellstrike: spell energy coils around the magus\'s weapon and discharges into the target with the Strike.', () => [
  cast('Spell coils around the weapon', STRANDS_IN('purple'), { stageId: 'ch', scale: 0.8, duration: 900 }),
  motion('lunge', 'source', { stageId: 'swing', after: 'ch', anchor: 'end', offset: -200, duration: 650, intensity: 0.8 }),
  impact('Spell-charged strike', TRAIL('pinkpurple'), { stageId: 'hit', after: 'swing', anchor: 'start', offset: 250, duration: 1000, ...FIRST }),
  aura('Spell discharges', ['impact.011.purple', 'impact.011.blue'], { subject: 'targets', after: 'hit', anchor: 'start', offset: 200, duration: 1000, scale: 0.75, ...FIRST }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.6, ...FIRST }),
], ab('sword')));
put('hPZQ5vA9QHEPtjFW', design('Spin Tale: crude illusions dance in the storyteller\'s space while the chosen hero glows and the villain is named.', () => [
  aura('Illusory tale', ['shimmer.01.orange', 'shimmer.01.blue'], { stageId: 'tale', duration: 1800, scale: 0.9, opacity: 0.8 }),
  aura('Story figures', ['butterflies.few.orange'], { after: 'tale', anchor: 'start', offset: 200, duration: 1600, scale: 0.5, ...above(-0.5) }),
  aura('The hero', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { subject: 'targets', after: 'tale', anchor: 'start', offset: 600, duration: 1500, scale: 0.6, ...FIRST, ...tint('#f5e6a8') }),
], quiet()));
put('6OZfIjiPjWTIe7Pr', design('Spinning Crush: the gunslinger whirls, smashing the weapon into everyone adjacent and firing to drive the spin, hurling them back.', () => [
  motion('spin', 'source', { stageId: 'spin', duration: 1000, intensity: 1 }),
  aura('Crushing arc', ['melee_generic.whirlwind.01.orange'], { stageId: 'arc', after: 'spin', anchor: 'start', offset: 100, duration: 1000, scale: 1.2 }),
  impact('Crushed', BLUNT, { after: 'arc', anchor: 'start', offset: 250, duration: 800, scale: 0.7, ...ALL }),
  cast('Shot drives the spin', MUZZLE, { after: 'spin', anchor: 'start', offset: 400, scale: 0.5, duration: 500, ...side(0.45) }),
  motion('rush', 'targets', { after: 'arc', anchor: 'start', offset: 350, duration: 900, intensity: 0.5, distance: 1.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', ...ALL }),
], ab('club')));
put('am7GMqh4t7m7bbaW', surge('Spirit Sanctification: a spirit wisp is purified and rises away, leaving a protective blessing.', {
  art: ['spirit_guardians.blueyellow.particles', 'spirit_guardians.blueyellow.ring'], scale: 0.7, gesture: 'press', gestureI: 0.2,
  accent: ['markers.light_orb.complete.white', 'markers.light_orb.complete.blue'],
}, sp('spirit')));
put('SPtzUNatWJvTK61y', guard('Spirit\'s Mercy: a purified spirit interposes itself as a pale ward against the vitality, void or haunting damage.', {
  art: ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], artTint: '#d8e8ff', scale: 0.8, overhead: false,
}, sp('spirit')));
put('GmqHs4NEhAjqyAze', reroll('Spiritual Aid: a guiding spirit nudges fate and the failed save is rerolled.', {
  extra: [aura('Guiding spirit', ['spirit_guardians.blueyellow.particles', 'spirit_guardians.blueyellow.ring'], { after: 'roll', anchor: 'start', duration: 1200, scale: 0.5, opacity: 0.6 })],
}));
put('f8vqWQktvmtSRpUb', design('Spiritual Scar: the scar flares to absorb the fiend\'s spirit damage, and the backlash slows the fiend.', () => [
  motion('brace', 'source', { stageId: 'set', duration: 600, intensity: 0.5 }),
  aura('Scar wards', SHIELD('yellow'), { stageId: 'ward', after: 'set', anchor: 'start', offset: 150, duration: 1400, scale: 0.75, ...tint('#f2dc8a') }),
  impact('Backlash', ['impact.012.yellow', 'impact.012.blue'], { after: 'ward', anchor: 'start', offset: 600, duration: 1000, scale: 0.6, ...FIRST, ...tint('#f2dc8a') }),
  motion('press', 'targets', { after: 'ward', anchor: 'start', offset: 700, duration: 900, intensity: 0.4, ...FIRST }),
], sp('holy')));
put('dwA0wfUaRf4aT0eB', design('Spit Ambient Magic: the ostilli flashes red and spits a dart of magic at the target.', () => [
  cast('Ostilli flashes red', ['impact.012.red', 'impact.012.blue'], { stageId: 'flash', scale: 0.4, duration: 600, ...tint('#e04a3a') }),
  travel('Magic dart', ['ranged.01.projectile.01.dark_orange'], { stageId: 'dart', after: 'flash', anchor: 'start', offset: 250, duration: 800, ...FIRST, ...tint('#e04a3a') }),
  impact('Dart pierces', ['impact.005.red', 'impact.005.orange'], { after: 'dart', anchor: 'end', duration: 800, scale: 0.6, ...FIRST }),
  motion('recoil', 'targets', { after: 'dart', anchor: 'end', duration: 600, intensity: 0.4, ...FIRST }),
], sp('pierce')));
put('Ssp7CCGMJhcAfeYw', design('Spread Realm: the manifested realm pulses outward, corrupting 10 more feet of ground.', () => [
  motion('press', 'source', { stageId: 'push', duration: 700, intensity: 0.3 }),
  aura('Realm expands', ['extras.tmfx.outpulse.circle.01.normal'], { after: 'push', anchor: 'start', offset: 200, duration: 1600, scale: 3, opacity: 0.6, below: true, ...tint('#7a4a8c') }),
], quiet()));
put('DFRLID6lIRw7CzOT', handwork('Spring the Trap: at initiative the combination weapon is drawn and snapped into the chosen mode.', { gesture: 'brace' }));
put('OdIUybJ3ddfL7wzj', design('Stand: the creature pushes itself up off the ground.', () => [
  motion('press', 'source', { stageId: 'push', duration: 500, intensity: 0.3 }),
  motion('levitate', 'source', { after: 'push', anchor: 'end', duration: 700, intensity: 0.2 }),
  aura('Dust brushed off', DUST, { after: 'push', anchor: 'end', duration: 700, scale: 0.4, opacity: 0.5, below: true, ...tint('#bba98d') }),
], quiet()));
put('M4ALaFXoQDJGxSsI', design('Starlit Transformation: swirling starlight wraps the user and their gear reshapes into the sentinel outfit.', () => [
  aura('Starlight swirls', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { stageId: 'swirl', duration: 1600, scale: 0.9 }),
  aura('Stars glint', ['twinkling_stars.points06.white'], { after: 'swirl', anchor: 'start', offset: 300, duration: 1400, scale: 0.7 }),
  motion('spin', 'source', { after: 'swirl', anchor: 'start', offset: 200, duration: 1000, intensity: 1 }),
], sp('transform')));
put('RDXXE7wMrSPCLv5k', design('Steal: a light brush past the mark and a small object vanishes with a glint.', () => [
  motion('lunge', 'source', { stageId: 'reach', duration: 550, intensity: 0.2 }),
  impact('Pilfered', GLINT, { after: 'reach', anchor: 'start', offset: 250, duration: 700, scale: 0.4, ...FIRST }),
], quiet()));
put('D2PNfIw7U6Ks0VY4', design('Steel Your Resolve: a deep breath and a steadying heartbeat restore stamina.', () => [
  motion('press', 'source', { stageId: 'breath', duration: 800, intensity: 0.35 }),
  aura('Steadying heartbeat', HEARTBEAT('green'), { after: 'breath', anchor: 'start', offset: 200, duration: 1600, scale: 0.5, ...above(-0.6) }),
  motion('pulse', 'source', { after: 'breath', anchor: 'end', duration: 600, intensity: 0.3 }),
], quiet()));
put('GPd3hmyUSbcSBj39', design('Stellar Misfortune: a dooming star glints over the creature, and its check is rolled twice for the worse.', () => [
  motion('press', 'source', { stageId: 'call', duration: 600, intensity: 0.2 }),
  impact('Dooming star', ['markers.circle_of_stars.orangepurple', 'markers.circle_of_stars.blue'], { stageId: 'star', after: 'call', anchor: 'start', offset: 250, duration: 1600, scale: 0.6, ...above(-0.5), ...FIRST, ...tint('#c05050') }),
  impact('Ill fortune', D20, { after: 'star', anchor: 'start', offset: 400, duration: 1200, scale: 0.35, ...side(0.5), ...FIRST, ...tint('#c05050') }),
], quiet()));
put('UHpkTuCtyaPqiCAB', design('Step: a careful 5-foot step that draws no reactions.', () => [
  path('rush', 1, { duration: 1000, intensity: 0.2 }),
  aura('Light scuff', DUST, { after: 'mv', anchor: 'start', duration: 700, scale: 0.4, opacity: 0.5, ...tint('#bba98d') }),
], quiet()));
put('PTEiTXsObvtke43x', design('Stitching Strike: the familiar unravels into magical threads that wrap and slice the enemy, binding it in place.', () => [
  aura('Familiar unravels', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 'unravel', duration: 900, scale: 0.6 }),
  travel('Threads lash out', TETHER('purple'), { stageId: 'thread', after: 'unravel', anchor: 'start', offset: 300, duration: 1100, ...FIRST }),
  impact('Threads slice', SLASH2, { after: 'thread', anchor: 'start', offset: 500, duration: 900, scale: 0.7, ...FIRST, ...tint('#c0a0e8') }),
  impact('Stitched in place', ['energy_strands.overlay.purple.01', 'energy_strands.overlay.blue.01'], { after: 'thread', anchor: 'start', offset: 700, duration: 1500, scale: 0.7, ...FIRST }),
], sp('slash')));
put('k5S2a2a6o2GS5l01', surge('Stonestrike Stance: power is drawn from the living rock and the fists are encased in stone.', {
  art: ['cast_generic.earth.01.browngreen'], scale: 0.8, gesture: 'brace', gestureI: 0.6,
  accent: ['impact.ground_crack.01.orange'], accentScale: 0.6, accentAbove: false,
}, sp('earth')));
put('9gDMkIfDifh61yLz', design('Stop: the pilot hauls the vehicle to a halt in a skid of dust.', () => [
  motion('brace', 'source', { stageId: 'brake', duration: 700, intensity: 0.6 }),
  dust({ after: 'brake', anchor: 'start', scale: 0.8 }),
], quiet()));
put('Bcxarzksqt9ezrs6', stride('Stride: the creature moves up to its Speed.'));
put('VPl4pifKcq7ecK87', design('Stridulating Song: wings vibrate into a grinding, disruptive drone aimed at one creature, upsetting its balance.', () => [
  motion('shake', 'source', { stageId: 'buzz', duration: 1000, intensity: 0.2 }),
  travel('Grinding drone', ['soundwave.01.green', 'soundwave.01.blue'], { stageId: 'drone', after: 'buzz', anchor: 'start', offset: 200, duration: 1100, opacity: 0.75, ...FIRST }),
  impact('Equilibrium upset', DIZZY('green'), { after: 'drone', anchor: 'end', offset: -200, duration: 1300, scale: 0.5, ...FIRST }),
  motion('shake', 'targets', { after: 'drone', anchor: 'end', duration: 800, intensity: 0.3, ...FIRST }),
], sp('sonic')));
put('73W3mBLXRPfeVl3G', command('Strike Hard!: the commander points and a squadmate lashes out at once.', {
  chevron: 'red',
}));
put('oaJeGdGPmHiNT5mP', design('Strike, Breathe, Rend: in the moment of contact a rending pulse of spirit energy runs down the Noble Branch into the target.', () => [
  motion('brace', 'source', { stageId: 'breathe', duration: 500, intensity: 0.4 }),
  impact('Rending pulse', ['impact.012.blue'], { stageId: 'pulse', after: 'breathe', anchor: 'end', duration: 1000, scale: 0.8, ...FIRST, ...tint('#d8f0ff') }),
  impact('Spirit torn', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { after: 'pulse', anchor: 'start', offset: 200, duration: 1100, scale: 0.6, opacity: 0.8, ...FIRST }),
  motion('stagger', 'targets', { after: 'pulse', anchor: 'start', duration: 700, intensity: 0.5, ...FIRST }),
], ab('spirit')));
put('7HRhXh46dJVb241Y', command('Stupefying Raid: squadmates dash around the enemies in a dizzying flurry of maneuvers.', {
  noChevron: true,
  onTargets: [impact('Befuddled', DIZZY('yellow'), { after: 'cue', anchor: 'start', offset: 500, duration: 1400, scale: 0.5, ...ALL })],
}));
put('S2WNjzwdnwziZSee', design('Summon Sloth: a runelord of sloth\'s spirit is drawn from an arcane circle into a nearby space.', () => [
  motion('press', 'source', { stageId: 'call', duration: 800, intensity: 0.3 }),
  aura('Arcane circle', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'circle', duration: 2000, scale: 1, below: true, ...side(1.3) }),
  aura('Runelord spirit', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'circle', anchor: 'start', offset: 600, duration: 1500, scale: 0.7, ...side(1.3), ...tint('#b8c8ff') }),
], sp('summon')));
put('iwB73FV58uphEdtt', strike('Surprising Anatomy: the eidolon\'s form twists horribly and lashes back at the attacker.', {
  hit: CLAWS, tgt: 'stagger', pre: [motion('shake', 'source', { stageId: 'twist', duration: 450, intensity: 0.5 })],
}, ab('claw')));
put('NdMSHDtV9G7MbdP2', design('Survive the Wilds: the pelt shines gold and a protective 15-foot aura draws the chosen energy into itself.', () => [
  motion('brace', 'source', { stageId: 'wrap', duration: 600, intensity: 0.4 }),
  aura('Golden pelt shines', BUFF('orangeyellow'), { after: 'wrap', anchor: 'start', offset: 150, duration: 1600, scale: 1, ...tint('#f2c86a') }),
  aura('Protective aura', ['bless.400px.intro.yellow'], { after: 'wrap', anchor: 'start', offset: 400, duration: 2000, scale: 2.2, opacity: 0.6 }),
], sp('bless')));
put('E48YTUyreo1kc9GM', design('Swarm Forth: the swarm boils out of the user\'s body into an adjacent space as a roiling dark cloud.', () => [
  motion('shake', 'source', { stageId: 'boil', duration: 700, intensity: 0.4 }),
  aura('Swarm emerges', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { stageId: 'swarm', after: 'boil', anchor: 'start', offset: 200, duration: 1800, scale: 0.9, opacity: 0.85, ...side(1), ...tint('#2d2a24') }),
], sp('swarm')));
put('Wukpm200zHDuS85V', design('Swarming Assault: the dispersed eidolon swarms over every creature in its space, biting and clawing.', () => [
  motion('shake', 'source', { stageId: 'surge', duration: 900, intensity: 0.4 }),
  impact('Biting swarm', CLAWS, { stageId: 'bites', after: 'surge', anchor: 'start', offset: 200, duration: 900, scale: 0.6, repeats: 2, repeatInterval: 350, ...ALL }),
  impact('Swarm roils', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { after: 'surge', anchor: 'start', offset: 100, duration: 1500, scale: 0.7, opacity: 0.6, ...ALL, ...tint('#2d2a24') }),
  motion('shake', 'targets', { after: 'bites', anchor: 'start', duration: 900, intensity: 0.4, ...ALL }),
], sp('swarm')));
put('cyl7y8GcGjd8ENC7', design('Swift Choreography: a quick called reminder and the ally twists out of the effect with the rehearsed move.', () => [
  cast('Called cue', WAVE('orangeyellow'), { stageId: 'call', scale: 0.5, duration: 800, opacity: 0.6, faceTarget: true }),
  motion('dodge', 'targets', { after: 'call', anchor: 'start', offset: 350, duration: 900, intensity: 0.5, distance: 0.3, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', ...FIRST }),
], quiet()));
put('c8TGiZ48ygoSPofx', design('Swim: a few strong strokes carry the swimmer through the water amid splashes and bubbles.', () => [
  path('rush', 1.5, { duration: 1600, intensity: 0.2 }),
  aura('Ripples', WATER, { after: 'mv', anchor: 'start', duration: 1300, scale: 0.7, opacity: 0.7, below: true }),
  aura('Bubbles', BUBBLES, { after: 'mv', anchor: 'start', offset: 300, duration: 1200, scale: 0.5, opacity: 0.7 }),
], sp('water')));
put('Gu0QsFvWoR9EP5SE', design('Swirl Crimson Shroud: the shroud is swirled around the body in a crimson ring, turning blows aside.', () => [
  motion('spin', 'source', { stageId: 'swirl', duration: 900, intensity: 1 }),
  aura('Crimson swirl', RING, { after: 'swirl', anchor: 'start', duration: 1000, scale: 0.9, opacity: 0.8, ...tint('#a0202a') }),
], quiet()));

// ---------------------------------------------------------------- T
put('KInVpdfrxg0AqjRt', design('Tactical Retreat: frightened, the user wisely backs off at speed.', () => [
  path('rush', 2, { duration: 1400, motionHeading: 'away' }),
  dust({ after: 'mv', anchor: 'start', mirrorX: false }),
  aura('Fear spurs the retreat', FEAR('dark_purple'), { after: 'mv', anchor: 'start', duration: 1100, scale: 0.35, opacity: 0.7, ...above(-0.6) }),
], quiet()));
put('KtxzyElOleyy74Lg', command('Tactical Takedown: two squadmates close from both sides and the enemy is knocked off its feet.', {
  noChevron: true,
  onTargets: [
    impact('Knocked down', DUST, { stageId: 'down', after: 'cue', anchor: 'start', offset: 500, duration: 900, scale: 0.7, ...FIRST, ...tint('#bba98d') }),
    motion('press', 'targets', { after: 'down', anchor: 'start', duration: 900, intensity: 0.55, ...FIRST }),
  ],
}));
put('ev8OHpBO3xq3Zt08', handwork('Tail Toxin: the kobold draws venom from its tail and slicks the weapon with it.', {
  art: ['liquid.blob.green', 'liquid.blob.blue'], artTint: '#7fbf5a', label: 'Venom slicks the blade',
  extra: [aura('Poisoned', POISON, { after: 'hands', anchor: 'end', duration: 1000, scale: 0.35, ...above(-0.6) })],
}));
put('yh9O9BQjwWrAIiuf', handwork('Take Control: the pilot grabs the reins or wheel and wrestles the vehicle back under control.', { gesture: 'brace', label: 'Hands on the controls' }));
put('ust1jJSCZQUhBZIz', design('Take Cover: the user ducks low behind the obstacle, pressing against it.', () => [
  motion('press', 'source', { stageId: 'duck', duration: 1300, intensity: 0.55 }),
  aura('Scuff of dust', DUST, { after: 'duck', anchor: 'start', duration: 800, scale: 0.45, opacity: 0.5, below: true, ...tint('#bba98d') }),
], quiet()));
put('HUJBYqs2vTTBeZgO', command('Take the High Ground: the squad boosts a squadmate into a long, high leap.', {
  onTargets: [motion('leap', 'targets', { after: 'cue', anchor: 'start', offset: 500, duration: 1400, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', jumpHeight: 1.2, ...FIRST })],
}));
put('IR95FFdO7MtC8C0E', design('Talon Stance: the user sways into a loose stance, foot-claws sweeping in wide arcs.', () => [
  motion('drift', 'source', { stageId: 'sway', duration: 1200, intensity: 0.5 }),
  aura('Sweeping talon arc', ['melee_generic.whirlwind.01.orange'], { after: 'sway', anchor: 'start', offset: 300, duration: 900, scale: 0.9, opacity: 0.7, below: true, ...tint('#d8c8a0') }),
], quiet()));
put('cGCQkCz14sF238gE', design('Tangle in Riddle: a bizarre koan twists the listener\'s thoughts into knots.', () => [
  cast('Koan spoken', WAVE('purple'), { stageId: 'koan', scale: 0.55, duration: 900, opacity: 0.7, faceTarget: true }),
  impact('Thoughts tangle', ['magic_signs.rune.enchantment.complete.pink'], { stageId: 'knot', after: 'koan', anchor: 'start', offset: 450, duration: 1300, scale: 0.4, ...above(-0.55), ...FIRST, ...spin(3000) }),
  impact('Stupefied', DIZZY('purple'), { after: 'knot', anchor: 'start', offset: 300, duration: 1300, scale: 0.5, ...FIRST }),
], sp('whispers')));
put('gxtq81VAhpmNvEgA', design('Tap Ley Line: a stream of ley energy is drawn from the line into the user.', () => [
  motion('press', 'source', { stageId: 'reach', duration: 800, intensity: 0.25 }),
  travel('Ley energy drawn', ['energy_beam.normal.blue.01'], { stageId: 'ley', after: 'reach', anchor: 'start', offset: 200, duration: 2000, opacity: 0.75, ...FIRST }),
  aura('Ley power fills', STRANDS_IN('blue'), { after: 'ley', anchor: 'start', offset: 500, duration: 1200, scale: 0.8 }),
], sp('force')));
put('jsEBrm8SPcsokJLw', reroll('Tap the Past: a past life\'s memory surfaces — a faint ghostly echo — and the Recall Knowledge is rolled twice.', {
  extra: [sprite('Echo of a past life', { after: 'roll', anchor: 'start', duration: 1100, opacity: 0.3, offsetX: -0.35, offsetUnits: 'token' })],
}));
put('4DYFJ4TUsNkgFBDb', design('Taunt: a threatening shout and gesture draw the enemy\'s attention firmly onto the guardian.', () => [
  motion('brace', 'source', { stageId: 'call', duration: 600, intensity: 0.6 }),
  cast('Challenge', WAVE('red'), { stageId: 'shout', after: 'call', anchor: 'start', offset: 200, scale: 0.8, duration: 1000, faceTarget: true }),
  impact('Taunted', CHEVRON('red'), { after: 'shout', anchor: 'start', offset: 450, duration: 1400, scale: 0.4, ...above(-0.6), ...FIRST }),
  motion('shake', 'targets', { after: 'shout', anchor: 'start', offset: 500, duration: 600, intensity: 0.25, ...FIRST }),
], ab('battleCry')));
put('W87FYSsY21BFQWNU', design('Tell Me More: a flutter of the eyes and a friendly nudge get the target talking.', () => [
  motion('pulse', 'source', { stageId: 'charm', duration: 600, intensity: 0.2 }),
  impact('Charmed into talking', ['icon.heart.pink'], { after: 'charm', anchor: 'start', offset: 300, duration: 1400, scale: 0.35, opacity: 0.85, ...above(-0.6), ...FIRST }),
], quiet()));
put('EeM0Czaep7G5ZSh5', stride('Ten Paces: at the first sign of trouble the gunslinger draws and steps smartly into position.', {
  distance: 2, lines: false,
  extra: [aura('Weapon drawn', GLINT, { after: 'mv', anchor: 'start', offset: 200, duration: 700, scale: 0.4, ...side(0.4) })],
}));
put('5HZ4cYDowUw2oUbZ', surge('Tenacious Stance: the user plants their feet, steadying as tough and immutable as stone.', {
  art: ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], artTint: '#b8b0a0', scale: 0.8, gesture: 'brace', gestureI: 0.6,
  accent: RAMPART, accentTint: '#b8b0a0', accentScale: 0.5,
}));
put('YpuEmI1fJBZD3kMc', strike('Tendril Strike: the eidolon stretches its body to the limit and lashes a foe beyond its normal reach.', {
  hit: ['melee_generic.creature_attack.fist.002.blue'], hitTint: '#9fbf7a', srcI: 1.1, tgt: 'stagger',
}, ab('whip')));
put('kUME7DMhhHH6eIiH', reroll('That\'s My Number: the lucky number comes up and the die is tossed again — pushing one\'s luck.'));
put('Czcdh3pPzQ7y1cV7', command('The Bigger They Are: the squad piles into the maneuver together and topples the giant.', {
  noChevron: true,
  onTargets: [
    impact('Combined heave', SHOVE, { stageId: 'heave', after: 'cue', anchor: 'start', offset: 450, duration: 900, scale: 0.9, ...FIRST }),
    motion('stagger', 'targets', { after: 'heave', anchor: 'start', duration: 800, intensity: 0.7, ...FIRST }),
  ],
}));
put('cx5tBTy6weK6YSw9', design('Thermal Eruption: stored heat explodes outward from the user in a 20-foot emanation of fire.', () => [
  motion('brace', 'source', { stageId: 'build', duration: 600, intensity: 0.6 }),
  aura('Thermal eruption', ['explosion.01.orange'], { stageId: 'boom', after: 'build', anchor: 'end', duration: 1300, scale: 2.4 }),
  aura('Scorched ring', ['impact.ground_crack.03.orange'], { after: 'boom', anchor: 'start', duration: 1500, scale: 2, below: true, opacity: 0.7 }),
  impact('Flames wash over', ['impact.fire.01.orange'], { after: 'boom', anchor: 'start', offset: 300, duration: 1000, scale: 0.7, ...ALL }),
  motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 300, duration: 700, intensity: 0.5, ...ALL }),
], sp('fireball')));
put('9kIvFxA5V9rvNWiH', observe('Thoughtful Reload: in analytical calm the gunslinger studies the foe while their hands reload by instinct.', {
  c: 'bluegreen', eyeTint: '#9fd8e8',
  extra: [aura('Round chambered', GLINT, { after: 'look', anchor: 'end', duration: 700, scale: 0.4, ...side(0.4) })],
}));
put('W4M8L9WepGLamlHs', design('Threatening Approach: the user stalks up to the foe and looms over it, terrifying it.', () => [
  toTarget('rush', 3, { duration: 1400, intensity: 0.3 }),
  dust({ after: 'mv', anchor: 'start' }),
  cast('Menacing glare', WAVE('red'), { stageId: 'loom', after: 'mv', anchor: 'arrival', scale: 0.8, duration: 1000, faceTarget: true }),
  impact('Frightened', FEAR('dark_red'), { stageId: 'fear', after: 'loom', anchor: 'start', offset: 350, duration: 1400, scale: 0.55, ...FIRST }),
  motion('cower', 'targets', { after: 'fear', anchor: 'start', offset: 100, duration: 900, intensity: 0.5, ...FIRST }),
], sp('fear')));
put('6SAdjml3OZw0BZnn', design('Thundering Roar: a powerful roar booms out 10 feet, battering enemies with sound and fear.', () => [
  motion('brace', 'source', { stageId: 'draw', duration: 500, intensity: 0.6 }),
  aura('Thundering roar', ['thunderwave.center.dark_red', 'thunderwave.center.blue'], { stageId: 'roar', after: 'draw', anchor: 'end', duration: 1300, scale: 1.4 }),
  impact('Fear', FEAR('dark_red'), { after: 'roar', anchor: 'start', offset: 450, duration: 1300, scale: 0.5, ...ALL }),
  motion('cower', 'targets', { after: 'roar', anchor: 'start', offset: 400, duration: 800, intensity: 0.5, ...ALL }),
], sp('sonic')));
put('gohBPHf4dxi4PkBk', design('Timely Dodge: the user darts aside from the incoming Strike, leaving an afterimage, then Steps away.', () => [
  motion('dodge', 'source', { stageId: 'dart', duration: 900, intensity: 0.6, distance: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'dart', anchor: 'start', duration: 600, opacity: 0.35 }),
  aura('Quick feet', SPEED, { after: 'dart', anchor: 'start', duration: 800, scale: 0.6, opacity: 0.5 }),
], quiet()));
put('Ypwa9HIw7uXdt25D', design('Topple the Pillar of Heaven: the ikon extends to an impossible length and sweeps down a 60-foot line.', () => [
  motion('lunge', 'source', { stageId: 'thrust', duration: 700, intensity: 0.8 }),
  travel('Ikon extends', ['energy_beam.normal.yellow.01', 'energy_beam.normal.blue.01'], { stageId: 'reach', after: 'thrust', anchor: 'start', offset: 200, duration: 1300, ...FIRST, ...tint('#f2dc8a') }),
  impact('Struck in the line', SLASH, { after: 'reach', anchor: 'start', offset: 400, duration: 900, scale: 0.8, ...ALL }),
  motion('recoil', 'targets', { after: 'reach', anchor: 'start', offset: 450, duration: 700, intensity: 0.5, ...ALL }),
], sp('slash')));
put('WpCs3QmPVn8SRbXy', design('Touch and Go: shadows mask the hands as the gunslinger steps in, flips the weapon\'s mode and reloads.', () => [
  path('rush', 1, { duration: 1000, intensity: 0.2 }),
  aura('Shadows mask the hands', DARK_SMOKE, { after: 'mv', anchor: 'start', duration: 900, scale: 0.5, opacity: 0.5, ...side(0.3), ...tint('#3a3a4a') }),
  aura('Reloaded', GLINT, { after: 'mv', anchor: 'start', offset: 600, duration: 700, scale: 0.4, ...side(0.4) }),
], quiet()));
put('WcpJPssJB98lsdI5', design('Trace Rune: dancing fingers leave a glowing rune that settles onto the target.', () => [
  motion('press', 'source', { stageId: 'trace', duration: 900, intensity: 0.2 }),
  aura('Fingers trace light', GLINT, { after: 'trace', anchor: 'start', duration: 900, scale: 0.4, ...side(0.4) }),
  impact('Rune applied', ['icon.runes.orange'], { after: 'trace', anchor: 'start', offset: 500, duration: 1500, scale: 0.45, fadeIn: 200, fadeOut: 500, ...FIRST }),
], quiet()));
put('KjoCEEmPGTeFE4hh', design('Treat Poison: the healer works with their toolkit on the patient, slowing the poison\'s spread.', () => [
  motion('press', 'source', { stageId: 'tend', duration: 1000, intensity: 0.25 }),
  impact('Poison checked', HEAL('green'), { after: 'tend', anchor: 'start', offset: 300, duration: 1400, scale: 0.5, opacity: 0.7, ...FIRST }),
], quiet()));
put('kWrks0NxMQH39JHD', design('Trench Digging: claw spikes bite into the earth as the user is forced along, churning the ground into difficult terrain.', () => [
  motion('brace', 'source', { stageId: 'dig', duration: 800, intensity: 0.6 }),
  aura('Churned earth', ['impact.ground_crack.02.orange'], { after: 'dig', anchor: 'start', offset: 150, duration: 1600, scale: 0.9, below: true, opacity: 0.8 }),
  dust({ after: 'dig', anchor: 'start', offset: 150, scale: 0.7 }),
], sp('earth')));
put('ge56Lu1xXVFYUnLP', strike('Trip: a sweeping kick or hook takes the creature\'s legs out and it falls prone.', {
  hit: SHOVE, scale: 0.6, srcI: 0.6, tgt: null,
  post: [
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 900, intensity: 0.6, requiresHit: true, ...FIRST }),
    aura('Thud of the fall', DUST, { subject: 'targets', after: 'hit', anchor: 'start', offset: 300, duration: 800, scale: 0.5, opacity: 0.6, below: true, requiresHit: true, ...FIRST, ...tint('#bba98d') }),
  ],
}, ab('kick')));
put('pn557VVMaNJyq0jX', design('True Shapeshift: in a swirl of leaves the druid flows from one untamed form into another.', () => [
  aura('Leaves swirl', ['swirling_leaves.complete.01.green'], { stageId: 'swirl', duration: 1500, scale: 1 }),
  motion('shake', 'source', { after: 'swirl', anchor: 'start', offset: 200, duration: 700, intensity: 0.4 }),
  motion('pulse', 'source', { after: 'swirl', anchor: 'start', offset: 900, duration: 700, intensity: 0.4 }),
], sp('transform')));
put('21WIfSu7Xd7uKqV8', design('Tumble Through: the acrobat rolls straight through the enemy\'s space.', () => [
  toTarget('roll', 2, { duration: 1400, intensity: 0.5, motionEndpoint: 'near' }),
  dust({ after: 'mv', anchor: 'start', scale: 0.5 }),
], quiet()));
put('5g0gCXJnUVipYtW0', guard('Turn Aside Ambient Magic: the ostilli glows a faint yellow and spreads a barrier against the chosen energy.', {
  art: SHIELD('yellow'), artTint: '#f2e08a', scale: 0.8, overhead: false,
}));
put('cwBsPU24715fUCub', shout('Ultimatum of Liberation: an ultimatum is proclaimed against the oppressor — chains break and the oppressors quail.', {
  cue: WAVE('orangeyellow'), color: 'dark_orange', many: true,
  extra: [aura('Chains broken', CHAIN('yellow'), { stageId: 'chains', duration: 1100, scale: 0.6, opacity: 0.8, ...tint('#e0c870') })],
}));
put('7GeguyqyD1TjoC4r', design('Unleash Psyche: psychic power floods out of the mind in a visible surge that wraps the psychic.', () => [
  motion('brace', 'source', { stageId: 'gather', duration: 600, intensity: 0.5 }),
  aura('Psyche unleashed', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 'surge', after: 'gather', anchor: 'end', duration: 2000, scale: 1.2, fadeOut: 500 }),
  aura('Mind blazes', ['extras.tmfx.outpulse.circle.01.normal'], { after: 'surge', anchor: 'start', duration: 1300, scale: 1.6, opacity: 0.5, ...tint('#c88af0') }),
  motion('pulse', 'source', { after: 'surge', anchor: 'start', duration: 800, intensity: 0.5 }),
], sp('psychic')));
put('mpFTlTGmPBKXMq2C', design('Unleash Realm: the realm lashes out at a transgressor, erupting beneath it.', () => [
  motion('press', 'source', { stageId: 'will', duration: 600, intensity: 0.3 }),
  impact('Realm erupts', ['impact.ground_crack.01.purple', 'impact.ground_crack.01.orange'], { stageId: 'erupt', after: 'will', anchor: 'start', offset: 300, duration: 1300, scale: 0.9, below: true, ...FIRST, ...tint('#7a4a8c') }),
  impact('Punished', ['impact.004.dark_purple', 'impact.004.blue'], { after: 'erupt', anchor: 'start', offset: 200, duration: 1000, scale: 0.7, ...FIRST }),
  motion('stagger', 'targets', { after: 'erupt', anchor: 'start', offset: 200, duration: 700, intensity: 0.5, ...FIRST }),
], sp('divineWrath')));
put('TIIM35m8aDUEU4gF', design('Unravel the Future: a single golden thread is plucked from the ikon and loops itself three times around the wrist.', () => [
  motion('press', 'source', { stageId: 'pluck', duration: 700, intensity: 0.2 }),
  aura('Thread loops the wrist', ['energy_strands.complete.orange.01', 'energy_strands.complete.blue.01'], { after: 'pluck', anchor: 'start', offset: 200, duration: 1400, scale: 0.4, ...side(0.4), ...tint('#f2dc8a') }),
], quiet()));
put('KofrLYBif2QKyiqe', guard('Unwavering Resilience: the Plane of Wood\'s strength rises in green growth that steels body and mind.', {
  art: ['plant_growth.03.round.2x2.complete.greenyellow'], scale: 0.6, overhead: false,
  extra: [aura('Blossoms sprout', LEAVES, { after: 'ward', anchor: 'start', offset: 300, duration: 1200, scale: 0.6, opacity: 0.8 })],
}, sp('growth')));
put('F0JgJR2rXKOg9k1z', design('Upstage: after the rival\'s attempt the user shows how it\'s really done, with a flourish to an applauding crowd.', () => [
  motion('spin', 'source', { stageId: 'flourish', duration: 900, intensity: 1 }),
  aura('Showstopper', ['particle_burst.01.star.yellow', 'particle_burst.01.star.bluepurple'], { after: 'flourish', anchor: 'end', offset: -200, duration: 1100, scale: 0.6, ...above(-0.4) }),
], sp('applause')));
put('DGmzeAr4IfCnKN0R', design('Valkyrie\'s Charge: a glorious cry restores the fallen squad, and they charge with the commander toward the foe.', () => [
  cast('Glorious cry', WAVE('orangeyellow'), { stageId: 'cry', scale: 1, duration: 1100 }),
  aura('Squad restored', HEAL('yellow'), { subject: 'targets', after: 'cry', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, ...ALL }),
  path('rush', 3, { after: 'cry', anchor: 'start', offset: 900, duration: 1500, intensity: 0.45 }),
  dust({ after: 'mv', anchor: 'start' }),
], sp('battleCry')));
put('B7wDxyjX66JkiCOV', handwork('Venom Draw: the weapon comes out of its sheath already glistening with poisonous saliva.', {
  art: ['liquid.blob.green', 'liquid.blob.blue'], artTint: '#7fbf5a', label: 'Envenomed draw', gesture: 'lunge',
  extra: [aura('Poisoned', POISON, { after: 'hands', anchor: 'end', duration: 1000, scale: 0.35, ...above(-0.6) })],
}));
put('JAka1VWMPGOm5JpR', design('Verdant Rest: the user grows still and takes root, bark and leaves overtaking their form.', () => [
  motion('sink', 'source', { stageId: 'root', duration: 1500, intensity: 0.2 }),
  aura('Takes root', ['plant_growth.03.round.2x2.complete.greenyellow'], { after: 'root', anchor: 'start', duration: 2200, scale: 0.9, below: true }),
  aura('Leaves unfurl', ['swirling_leaves.complete.02.green'], { after: 'root', anchor: 'start', offset: 400, duration: 1600, scale: 0.8 }),
], sp('growth')));
put('iJLzVonevhsi2uPs', design('Visions of Sin: the eidolon floods the target\'s mind with tormenting images of sin.', () => [
  motion('pulse', 'source', { stageId: 'project', duration: 700, intensity: 0.35 }),
  travel('Visions sent', TETHER('dark_red'), { stageId: 'send', after: 'project', anchor: 'start', offset: 200, duration: 1100, opacity: 0.7, ...FIRST }),
  impact('Torment', ['icon.horror.purple'], { stageId: 'torment', after: 'send', anchor: 'start', offset: 600, duration: 1400, scale: 0.5, ...above(-0.5), ...FIRST }),
  motion('cower', 'targets', { after: 'torment', anchor: 'start', duration: 900, intensity: 0.4, ...FIRST }),
], sp('whispers')));
put('vO0Y1dVjNfbDyT4S', shot('Vital Shot: a careful shot pierces an artery of the unsuspecting foe and blood follows.', {
  post: [impact('Vital bleed', BLOOD, { after: 'hit', anchor: 'start', offset: 300, duration: 1200, scale: 0.4, requiresHit: true, ...FIRST })],
}));
put('5stdIykWux9WHqce', command('Wait For It...: a raised hand holds the squad ready, guards up, poised for the ideal moment.', {
  onTargets: [aura('Guard held', RAMPART, { subject: 'targets', after: 'ans', anchor: 'start', offset: 300, duration: 1300, scale: 0.4, opacity: 0.8, ...above(-0.5), ...ALL, ...tint('#d9dde3') })],
}, quiet()));
put('NKjQup6NyQvg2J7y', design('Warding Shift: the user nudges an adjacent ally 5 feet and steps into the space it vacated.', () => [
  motion('dodge', 'targets', { stageId: 'nudge', duration: 900, intensity: 0.5, distance: 0.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', ...FIRST }),
  path('rush', 1, { after: 'nudge', anchor: 'start', offset: 250, duration: 1000, intensity: 0.2 }),
], quiet()));
put('7pdG8l9POMK76Lf2', guard('Warding Sign: a personal eldritch sign of protection flares brightly before slowly fading.', {
  art: ['ward.rune.yellow.01'], scale: 0.5,
}));
put('eBgO5gp5kKhGtmk9', design('Water Transfer: the user sinks into the adjacent water and vanishes with a splash.', () => [
  aura('Splash', WATER, { stageId: 'splash', duration: 1200, scale: 0.8 }),
  motion('sink', 'source', { after: 'splash', anchor: 'start', offset: 100, duration: 1400, intensity: 0.7 }),
  aura('Bubbles', BUBBLES, { after: 'splash', anchor: 'start', offset: 500, duration: 1200, scale: 0.6, opacity: 0.8 }),
], sp('water')));
put('nYR1q5D1jLiJj4JM', design('Weaponsight: eyes close and sight shifts to the warshard weapon, which glints with an all-seeing eye.', () => [
  motion('press', 'source', { stageId: 'close', duration: 900, intensity: 0.15 }),
  aura('Sight in the weapon', EYE('bluegreen'), { after: 'close', anchor: 'start', offset: 250, duration: 1500, scale: 0.35, ...side(0.45), ...tint('#9fd8e8') }),
  aura('Edge glints', GLINT, { after: 'close', anchor: 'start', offset: 500, duration: 700, scale: 0.4, ...side(0.45) }),
], quiet()));
put('tu5viJZT4zFE1sYn', design('Whirlwind Maul: the eidolon lashes out in all directions, striking up to four enemies within reach.', () => [
  motion('spin', 'source', { stageId: 'spin', duration: 1000, intensity: 1 }),
  aura('Flailing arc', ['melee_generic.whirlwind.01.orange'], { stageId: 'arc', after: 'spin', anchor: 'start', offset: 100, duration: 1000, scale: 1.2 }),
  impact('Mauled', CLAWS, { after: 'arc', anchor: 'start', offset: 300, duration: 800, scale: 0.6, targetLimit: 4, ...ALL }),
  motion('recoil', 'targets', { after: 'arc', anchor: 'start', offset: 350, duration: 700, intensity: 0.5, requiresHit: true, targetLimit: 4, ...ALL }),
], ab('claw')));
put('ncdryKskPwHMgHFh', design('Wicked Thorns: thorns snap off and hook into the attacker, drawing blood.', () => [
  motion('shake', 'source', { stageId: 'bristle', duration: 450, intensity: 0.4 }),
  impact('Thorns hook in', ['side_impact.ice_shard.blue'], { stageId: 'thorns', after: 'bristle', anchor: 'start', offset: 150, duration: 900, scale: 0.7, ...FIRST, ...tint('#6a8a3a') }),
  impact('Bleeding', BLOOD, { after: 'thorns', anchor: 'start', offset: 400, duration: 1100, scale: 0.4, ...FIRST }),
  motion('recoil', 'targets', { after: 'thorns', anchor: 'start', offset: 100, duration: 650, intensity: 0.5, ...FIRST }),
], sp('pierce')));
put('UyMkWfVqdabLTgkH', strike('Wind Them Up: a melee strike covers a deft lift of the target\'s purse.', {
  post: [aura('Purse lifted', GLINT, { subject: 'targets', after: 'hit', anchor: 'start', offset: 500, duration: 700, scale: 0.4, ...FIRST })],
}));
put('5vLvLriQQGwgIIfz', flight('Winged Leap: the dragon companion beats its wings and takes to the air.', { feathers: SPEED2 }));

export default out;

import { timedStages } from '../../engines/playback/composition.mjs';

// Description-reviewed movement in the current activation. Distances are
// finite artwork samples, not legal destinations or TokenDocument updates.
const route = (motion, label, distance = 1.5, extra = {}) => ({
  motion, label, distance, duration: 3000, intensity: .4,
  motionRange: 'distance', motionArrival: 40, motionHold: 20, ...extra,
});
const approach = (label, extra = {}) => route('rush', label, 8, {
  motionRange: 'target', duration: 3800, motionArrival: 35, motionHold: 30, ...extra,
});
const jump = (label, extra = {}) => approach(label, {
  motion: 'leap', duration: 4000, jumpHeight: .75, ...extra,
});
const step = (label, extra = {}) => route('dodge', label, .5, { duration: 1800, ...extra });

export const SPELL_MOTION_REVIEWS = {
  airlift: route('leap', 'Wind-carried caster', 2.5, { jumpHeight: .2, duration: 3600 }),
  'comet-charge': approach('Elemental comet approach', { duration: 4400, intensity: .65 }),
  'dive-and-breach': route('leap', 'Dive into the water passage', 1, { jumpHeight: .3, duration: 2800, secondLeap: true }),
  'earth-and-sky': route('rush', 'Caster rises into the sky', 2, { motionHeading: 'up', duration: 4000, intensity: .2 }),
  'warp-step': route('rush', 'Two extended Strides', 1.6, { duration: 2700, repeats: 2, repeatScope: 'total', repeatInterval: 2900 }),
  'ghost-rush': route('rush', 'Ghostlike double Stride', 2.4, { duration: 3900, intensity: .15 }),
  'hippocampus-retreat': route('rush', 'Swim away after the parting blow', 2, { motionHeading: 'away', duration: 3400, intensity: .15, when: 'after', anchorKind: 'impact' }),
  jump: route('leap', 'Thirty-foot self Leap', 6, { duration: 3800, jumpHeight: 1 }),
  'lively-flight': route('rush', 'Healed ally flies away from danger', 1.6, { subject: 'targets', targetLimit: 1, motionHeading: 'away', duration: 3300, intensity: .15, when: 'after', anchorKind: 'impact' }),
  'mercurial-stride': route('rush', 'Quicksilver double Stride', 2.2, { duration: 3700, intensity: .15 }),
  'mirrors-misfortune': step('Optional Step beside the duplicate', { when: 'after' }),
  friendfetch: approach('Willing allies drawn toward caster', { subject: 'targets', targetLimit: 2, duration: 3600, intensity: .25, when: 'after', anchorKind: 'impact' }),
  'friendly-push': route('rush', 'Willing ally propelled away', 2, { subject: 'targets', targetLimit: 1, motionHeading: 'away', duration: 3200, intensity: .2, when: 'after' }),
};

export const FEAT_ACTION_MOTION_REVIEWS = {
  'airy-step': step('Step after the fog conceals', { when: 'after' }),
  'as-a-thousand-soldiers': route('rush', 'Bee-swarm double transit', 2.4, { duration: 3900, intensity: .15, when: 'after' }),
  'blazing-talon-surge': approach('Stride into the fire talon Strike'),
  'bodily-disintegration': route('rush', 'Disassembled-body transit', 1.6, { when: 'after', intensity: .15 }),
  'bombing-run': route('rush', 'Aerial bombing pass', 2, { duration: 4000, intensity: .15 }),
  'combined-form': approach('Join the willing ally', { when: 'after', stopGap: 0 }),
  'dance-of-bloody-ink': step('Step between the two rune Strikes', { when: 'between' }),
  'dance-of-intercession': route('leap', 'Half-Speed intercession dance', 1.1, { jumpHeight: .15 }),
  'dastardly-dash': approach('Dash past the maneuvered foe', { motionEndpoint: 'past', duration: 4000 }),
  'dream-guise': approach('Approach the willing disguise partner', { when: 'after', stopGap: 0 }),
  'drifters-juke': step('First Step before the shot', { secondStep: true }),
  'dual-weapon-blitz': approach('Weaving Stride with paired cuts', { duration: 4600, motionHold: 35 }),
  'final-shot-knows-the-way': route('rush', 'Double Stride with the final shot', 2.3, { duration: 4000 }),
  'flinging-charge': approach('Double approach with the thrown weapon', { duration: 4300 }),
  'five-gods-ram': approach('Initial Stride before the first horn Strike', { duration: 4500, motionHold: 35 }),
  'flying-tackle': jump('Running leap before the Trip attempt'),
  'four-winds': route('rush', 'Selected willing allies ride the wind', 1.2, { subject: 'targets', motionHeading: 'away', targetLimit: 4, intensity: .2 }),
  'helts-spelldance': route('leap', 'Single Stride before the chosen spell', 1.7, { jumpHeight: .15, duration: 3300 }),
  'jotuns-grasp': step('Step before the Grapple attempt'),
  'march-of-law': approach('Purposeful advance toward the lawbreaker', { duration: 4000, intensity: .25 }),
  'my-kingdom-my-blood': route('rush', 'Stride before planting the protective field', 1.6),
  'needle-in-the-gods-eyes': jump('Long leap with two airborne Strikes', { duration: 4600, jumpHeight: 1.1, motionHold: 35 }),
  'noble-sacrifice': approach('Advance to the threatened knight', { duration: 3400 }),
  'now-you-see-me': route('rush', 'Concealed timeline Stride', 1.8, { duration: 3300, intensity: .15, when: 'after' }),
  'parting-shot': route('rush', 'Backward Step before the shot', .5, { motionHeading: 'away', duration: 2200 }),
  'pass-through': route('rush', 'Spectral Fly through the obstacle', 1.7, { when: 'after', intensity: .12 }),
  'peonys-flourish': route('leap', 'Double dancing Stride', 2.2, { duration: 3900, jumpHeight: .2 }),
  'roaring-heart': approach('Double Stride with Shove attempts', { duration: 4400 }),
  'running-tackle': approach('Double Stride into the Grapple attempt', { duration: 4200 }),
  'scattering-charge': approach('Armored approach before Shove attempts', { duration: 4200, intensity: .55 }),
  'scouts-pounce': approach('Shadow Stride before paired attacks', { duration: 4500, intensity: .25, motionHold: 35 }),
  'shadowpiercing-charge': approach('Selected mount carries the paired assault', { duration: 4700, motionHold: 35 }),
  'shielded-attrition': route('rush', 'Guarded half-Speed advance', 1.1, { when: 'after', duration: 3200, intensity: .2 }),
  'silent-step': step('Quiet Step before hiding'),
  'stand-for-the-fallen': approach('Double Stride to the fallen ally', { duration: 4100, intensity: .25 }),
  'statement-strut': route('leap', 'Confident performing Stride', 1.6, { jumpHeight: .1, duration: 3400 }),
  'sweeping-fan-block': route('leap', 'One-legged defensive hop', .04, { jumpHeight: .35, duration: 2400 }),
  'swimming-charge': approach('Direct swimming approach', { duration: 3900, intensity: .15 }),
  'take-in-the-catch': step('Step between the net attempt and weapon Strike'),
  'temporal-fury': step('Extended Step between temporal Strikes', { distance: 1, when: 'between', duration: 2100 }),
  'triggerbrand-blitz': approach('Moving melee and ranged combination', { duration: 5600, motionArrival: 25, motionHold: 50 }),
  'weft-and-warp': approach('Half-Speed approach to the first Strike', { duration: 4400, motionHold: 35 }),
  'whirling-in-the-summer-storm': step('Step before the pirouette Shoves'),
  'wing-bounce': jump('Wing-assisted Leap before the Trip attempt', { jumpHeight: .5 }),
  'writhing-runelord-weapon': approach('Default Stride before the two Strikes', { duration: 4500, motionHold: 35 }),
  'battlefield-agility': step('Default Step before the melee Strike'),
  'dance-of-thunder': step('One optional Step before the first shot'),
  'divide-and-conquer': step('Step into position for two different foes'),
  'dodge-away': step('Evasive posture against the incoming attack', { distance: .18, duration: 1500 }),
  'hurling-charge': approach('Stride after the thrown Strike', { when: 'after', anchorKind: 'travel' }),
  'pouncing-transformation': route('rush', 'Stride after changing shape', 1.7, { when: 'after' }),
  'pounding-leap': route('leap', 'Jump after the fist Strike', 1.2, { when: 'after', anchorKind: 'impact', jumpHeight: .8 }),
  'duo-dragon-kick': jump('Selected performer leaps into the tandem kick', { duration: 4400, motionHold: 35 }),
  'pack-movement': approach('Selected companion advances before the paired assault', { duration: 4500, motionHold: 35, contactSpacing: 200 }),
  'rolling-white-bottle-form': route('roll', 'Two short crawling rolls', 1, { duration: 3500, motionHeading: 'away', intensity: .5, when: 'after' }),
  'slingshot-maneuver': route('leap', 'Willing ally swings onward from the lash', 1.5, { subject: 'targets', motionHeading: 'away', jumpHeight: .2, duration: 2900, when: 'after', targetLimit: 1 }),
};

// A native activity chooses the action branch. No movement is added to another
// activity merely because it shares the same item's description.
// Takeoff/landing samples for D&D flight and jump grants (cosmetic, restored).
const takeoff = (label, extra = {}) => route('rush', label, .6, { motionHeading: 'up', duration: 3400, intensity: .12, motionArrival: 45, motionHold: 35, ...extra });
const bound = (label, extra = {}) => route('leap', label, 1.2, { jumpHeight: .9, duration: 3000, ...extra });
const DND_ITEM_SPELL_MOTION = {
  'expeditious-retreat': () => route('rush', 'Expeditious Retreat Dash', 2.2, { duration: 3400 }),
  jump: () => bound('Jump-empowered bound', { subject: 'targets', targetLimit: 1, when: 'after', anchorKind: 'aura' }),
  fly: () => takeoff('Recipient rises into flight', { subject: 'targets', targetLimit: 3, when: 'after', anchorKind: 'aura' }),
  'ring-of-jumping': () => bound('Ring-empowered bound', { when: 'after' }),
  'winged-boots': () => takeoff('Winged boots lift the wearer', { when: 'after' }),
  'wings-of-flying': () => takeoff('Wings open and lift', { when: 'after' }),
  'potion-of-flying': () => takeoff('Drinker lifts into flight', { when: 'after' }),
  'broom-of-flying': name => /send|recall/i.test(name) ? null : takeoff('Broom lifts the rider', { when: 'after' }),
  'carpet-of-flying': () => takeoff('Carpet lifts its riders', { when: 'after' }),
};

export function dndMotionReview(entry, variant) {
  const name = variant.activityName ?? '';
  if (['spell', 'item'].includes(entry.kind)) return DND_ITEM_SPELL_MOTION[entry.slug.replace(/-\d.*$/, '')]?.(name) ?? null;
  if (entry.kind !== 'feat') return null;
  // Unnamed native activities are labelled by type ("save", "utility").
  const save = /save|damage/i.test(`${name} ${variant.label ?? ''}`);
  switch (entry.slug) {
    case 'charge': case 'trampling-charge': case 'aquatic-charge': case 'pounce': case 'charging-horn': case 'onslaught':
      return save ? null : approach('Straight advance toward the enemy', { duration: 3600 });
    case 'bubble-dash': return route('rush', 'Swim without provoking', 2, { duration: 3300, intensity: .15 });
    case 'move-legendary': return route('rush', 'Legendary half-Speed move', 1.6, { duration: 3300, intensity: .15 });
    case 'hasten': return route('rush', 'Dash and Disengage', 2.2, { duration: 3500 });
    case 'nimble-escape': return step('Nimble Disengage or Hide', { duration: 1800 });
    case 'leap': return bound('Monster leap', { distance: 2, duration: 3400 });
    case 'otherworldly-leap': return bound('Self-cast Jump bound', { when: 'after' });
    case 'draconic-flight': return takeoff('Spectral wings lift the dragonborn', { when: 'after' });
    case 'dragon-wings': return /restore/i.test(name) ? null : takeoff('Draconic wings lift the sorcerer', { when: 'after' });
    case 'step-of-the-wind': return bound('Step of the Wind bound', { distance: 2, jumpHeight: .5, duration: 3400 });
    case 'aggressive': return approach('Advance toward the visible hostile creature');
    case 'rampage': return approach('Half-Speed rampaging advance', { duration: 3400 });
    case 'prowl': return route('rush', 'Prowl before hiding', 1.5, { duration: 3300, intensity: .15 });
    case 'cloaked-flight': return route('rush', 'Cloaked half-Speed flight', 1.6, { when: 'after', duration: 3400, intensity: .12 });
    case 'adrenaline-rush': return route('rush', 'Adrenaline Dash', 2.3, { duration: 3700 });
    case 'world-shaking-movement': return route('rush', 'Heavy advance before the shock wave', 2, { duration: 4100, intensity: .6 });
    case 'deadly-leap': return /damage/i.test(name) ? null : jump('Deadly landing leap', { distance: 3, duration: 3800 });
    case 'cunning-strike': return /withdraw/i.test(name) ? route('rush', 'Withdraw after the prior attack', 1.2, { motionHeading: 'away', when: 'after' }) : null;
    case 'patient-defense': return step('Patient defensive evasion', { distance: .18, duration: 1600 });
    case 'monks-focus': return /step of the wind/i.test(name) ? bound('Step of the Wind Dash with doubled jump', { distance: 2, jumpHeight: .5, duration: 3400 }) : /patient defense.*focus point/i.test(name) ? step('Patient defensive evasion', { distance: .18, duration: 1600 }) : null;
    case 'cunning-action': return /dash/i.test(name) ? route('rush', 'Chosen Cunning Action Dash', 1.8, { duration: 3300 }) : /disengage/i.test(name) ? step('Chosen Cunning Action Disengage', { duration: 1800 }) : null;
    default: return null;
  }
}

function motionStage(item, review, suffix = '') {
  const { when, anchorKind, secondLeap, secondStep, contactSpacing, ...pose } = review;
  return { kind: 'motion', assets: [], subject: 'source', delay: 120,
    stageId: `${item.id}-reviewed-motion${suffix}`, targetSelection: pose.subject === 'targets' ? 'all' : 'first', stopGap: .1, ...pose };
}
const recipients = s => ['impact', 'travel', 'template', 'projectile'].includes(s.kind) || s.subject === 'targets';

export function applyCatalogMotion(item, stages, review) {
  if (!review) return stages;
  const original = timedStages({ stages });
  const who = review.subject ?? 'source';
  const removed = new Set(stages.filter(s => s.kind === 'motion' && s.subject === who).map(s => s.stageId));
  const kept = stages.filter(s => !removed.has(s.stageId));
  for (const s of kept) if (removed.has(s.afterStage)) {
    s.delay = original.find(t => t.stageId === s.stageId).delay; s.afterStage = '';
  }
  const move = motionStage(item, review);
  const contacts = kept.filter(s => ['impact', 'travel', 'template', 'projectile'].includes(s.kind));
  if (review.when === 'after') {
    const anchor = review.anchorKind ? kept.find(s => s.kind === review.anchorKind) : kept.find(s => s.kind !== 'sprite');
    if (anchor) Object.assign(move, { afterStage: anchor.stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
  } else if (review.when === 'between' && contacts.length >= 2) {
    Object.assign(move, { afterStage: contacts[0].stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
    Object.assign(contacts[1], { afterStage: move.stageId, timingAnchor: 'arrival', startOffset: 0, delay: 0 });
    for (const s of kept.filter(s => s.kind === 'aura' && s.subject === 'targets'))
      Object.assign(s, { afterStage: contacts[1].stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
  } else {
    const roots = kept.filter(s => recipients(s) && !s.afterStage);
    const first = Math.min(...roots.map(s => Number(s.delay) || 0));
    for (const s of roots) Object.assign(s, {
      afterStage: move.stageId, timingAnchor: 'arrival',
      startOffset: Math.max(0, (Number(s.delay) || 0) - first), delay: 0,
    });
  }
  kept.push(move);
  if (review.contactSpacing != null && contacts.length > 1) {
    // Two resolved performers arrive, then deliver the close paired contacts.
    // The one-source sample remains subject to the native performer-role gate.
    contacts.forEach((s, index) => Object.assign(s, {
      afterStage: move.stageId, timingAnchor: 'arrival',
      startOffset: index * review.contactSpacing, delay: 0,
    }));
    for (const s of kept.filter(s => s.kind === 'aura' && s.subject === 'targets'))
      Object.assign(s, { afterStage: contacts.at(-1).stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
  }
  if (review.secondStep && contacts.length >= 2) {
    const second = motionStage(item, { ...review, secondStep: false, label: 'Second Step before the melee Strike' }, '-2');
    Object.assign(second, { afterStage: contacts[0].stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
    Object.assign(contacts[1], { afterStage: second.stageId, timingAnchor: 'arrival', startOffset: 0, delay: 0 });
    kept.push(second);
  }
  if (review.secondLeap) {
    const anchor = kept.findLast(s => s.kind === 'aura') ?? kept.findLast(s => s.kind !== 'motion');
    kept.push({ ...motionStage(item, { ...review, secondLeap: false, label: 'Leap out of the water passage' }, '-2'),
      afterStage: anchor?.stageId ?? move.stageId, timingAnchor: 'end', startOffset: 100, delay: 0 });
  }
  return kept;
}

export function addPhysicalFeatGesture(feat, stages) {
  if (stages.some(s => s.kind === 'motion' && s.subject === 'source')) return stages;
  const shooting = ['ranged', 'firearm', 'alchemicalShot', 'bombThrow', 'throughShot'].includes(feat.motif);
  const launch = shooting && stages.find(s => s.kind === 'travel' && (!s.travelOrigin || s.travelOrigin === 'source'));
  if (!launch) return stages;
  const throwing = feat.motif === 'bombThrow' || /thrown/i.test(feat.direction?.weapon ?? '') || ['flinging-charge', 'hurling-charge'].includes(feat.slug);
  return [...stages, { kind: 'motion', assets: [], stageId: `${feat.id}-physical-release`,
    motion: throwing ? 'lunge' : 'recoil', label: throwing ? 'Throw and settle' : 'Release and settle', subject: 'source',
    afterStage: launch.stageId, timingAnchor: 'start', startOffset: throwing ? -450 : 0, delay: 0,
    duration: throwing ? 1200 : 1100, distance: throwing ? .16 : feat.motif === 'firearm' ? .1 : .06,
    intensity: .5, targetSelection: 'first' }];
}

export function withoutCatalogMotion(stages) {
  const sample = timedStages({ stages }), removed = new Set(stages.filter(s => s.kind === 'motion').map(s => s.stageId));
  return stages.filter(s => s.kind !== 'motion').map(s => removed.has(s.afterStage)
    ? { ...s, delay: sample.find(t => t.stageId === s.stageId).delay, afterStage: '' } : s);
}

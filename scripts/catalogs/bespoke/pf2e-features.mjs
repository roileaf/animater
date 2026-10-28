// Bespoke compositions (pf2e-features). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Damage riders play ON TOP of the weapon's own Strike animation on the damage
// roll: a short, precise accent on the target only — no lunge, no second swing.
const rider = (label, assets, o = {}) => [
  impact(label, assets, { stageId: 'rd', duration: 1100, scale: 0.65, fadeIn: 80, fadeOut: 350, ...o }),
  motion('stagger', 'targets', { after: 'rd', anchor: 'start', offset: 150, duration: 600, intensity: 0.3 }),
];

export default {
  'pf2e:NLHHHiAcdnZ5ohc2': design('Flurry of Blows: two rapid unarmed Strikes in a blur of fists.', () => [
    motion('lunge', 'source', { stageId: 'sw', duration: 900, intensity: 0.6 }),
    impact('Flurry', ['flurry_of_blows.physical.orange', 'flurry_of_blows.physical.blue'], { stageId: 'fl', after: 'sw', anchor: 'start', offset: 200, duration: 1400 }),
    impact('Second blow', ['unarmed_strike.physical.01.orange', 'unarmed_strike.physical.01.blue'], { after: 'fl', anchor: 'start', offset: 700, duration: 900, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'fl', anchor: 'start', offset: 200, duration: 1100, intensity: 0.5 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),

  'pf2e:RQH6vigvhmiYKKjg': design("Precise Strike: the finesse blow finds a gap — a small golden precision flash on the target, layered on the weapon's own Strike.", () =>
    rider('Precise hit', ['sneak_attack.yellow', 'sneak_attack.dark_green'], { scale: 0.55 }), { sound: null }),

  'pf2e:u6cBjqz2fiRBadBt': design("Precision: the hunter's eye finds the prey's weak point — a green precision flash on the target, layered on the weapon's own Strike.", () =>
    rider('Weak point', ['sneak_attack.dark_green', 'sneak_attack.dark_green'], { scale: 0.6 }), { sound: null }),

  // GGG 0.2.3's own Strategic Strike sound: the one rider that has a sound made for it.
  'pf2e:2Fe4YZCvAr9Yf6w7': design("Strategic Strike: the blow the investigator foresaw lands exactly where planned — a violet precision flash on the target, layered on the weapon's own Strike.", () =>
    rider('Strategic strike', ['sneak_attack.dark_purple', 'sneak_attack.yellow'], { scale: 0.6 }), { sound: 'strategicStrike', soundNamespace: 'ability' }),

  'pf2e:j1JE61quDxdge4mg': design("Sneak Attack: the off-guard foe takes a vicious precision hit — a sharp sneak-attack flash on the target, layered on the weapon's own Strike.", () =>
    rider('Sneak attack', ['sneak_attack.dark_red', 'sneak_attack.dark_green'], { scale: 0.7 }), { sound: null }),
};

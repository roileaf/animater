// Bespoke compositions (sf2e-c). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// Wave 3 (sf2e-c): Starfinder 2e tech weapons, grenades, conditions and effects.
// Weapon/grenade designs mostly re-skin the generated stages (keeping their
// timing links, area routing and sound anchors) with art that matches the
// item; condition/effect designs are persistent source auras only.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const J = list => (Array.isArray(list) ? list : [list]).map(k => (k.startsWith('jb2a.') || k.includes('/') ? k : `jb2a.${k}`));
const own = recipe => recipe.stages.filter(s => s.kind !== 'sound');
const swap = (s, assets, o = {}) => ({ ...s, assets: J(assets), tintEnabled: false, colorize: false, ...o });
const isHit = s => s.kind === 'impact' || s.kind === 'template';
/** Re-skin the generated stages: fn(stages, recipe) → stages. */
const re = (rationale, fn, extra) => design(rationale, ({ recipe }) => fn(own(recipe), recipe), extra);

// ── Grenades ────────────────────────────────────────────────────────────────
// Swap the lobbed bomb for grenade art, recolor the burst, add a reaction and
// (optionally) a lingering cloud. Works for both the [thrown] and [Area Fire]
// variants because the generated stages already route to target or area.
const GRENADE_FREE = 'throwable.throw.bomb.01.black';
const grenade = ({ fly, burst, burstTint, burstScale, react, linger, lingerTint }) => rationale => re(rationale, stages => {
  const out = stages.map(s => s.kind === 'travel' && fly ? swap(s, [fly, GRENADE_FREE])
    : isHit(s) && burst ? swap(s, burst, { ...(burstTint ? tint(burstTint) : {}), ...(burstScale && s.kind === 'impact' ? { scale: burstScale } : {}) })
    : s);
  const hit = out.find(isHit);
  if (!hit) return out;
  const isArea = hit.kind === 'template';
  if (linger) out.push((isArea ? area : impact)('Cloud lingers', linger, { after: hit.stageId, anchor: 'start', offset: 450, duration: 4800, scale: isArea ? 1 : 1.9, opacity: 0.8, fadeIn: 700, fadeOut: 1400, ...(lingerTint ? tint(lingerTint) : {}) }));
  if (react) out.push(motion(react, 'targets', { after: hit.stageId, anchor: 'start', offset: 150, duration: 750, intensity: 0.8 }));
  return out;
});
const G = {
  flash: grenade({ fly: 'throwable.throw.grenade.03.blackblue', burst: ['explosion.05.yellowwhite', 'explosion.03.blueyellow'], burstScale: 1.3, react: 'cower' }),
  frag: grenade({ fly: 'throwable.throw.grenade.01.green', burst: ['explosion.shrapnel.grenade.02.black', 'explosion.shrapnel.bomb.01.black'], react: 'stagger' }),
  foam: grenade({ fly: 'throwable.throw.grenade.03.blackblue', burst: ['liquid.splash.grey', 'smoke.puff.centered.grey'], burstTint: '#f1ede2', react: 'shake' }),
  incendiary: grenade({ fly: 'throwable.throw.grenade.03.red' }),
  magefoil: grenade({ fly: 'throwable.throw.grenade.03.blackblue', burst: ['explosion.02.purple', 'explosion.02.blue'], burstTint: '#c591e5', react: 'shake' }),
  miasma: grenade({ fly: 'throwable.throw.grenade.03.green', burst: ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], burstTint: '#b9c46a', react: 'cower', linger: ['fog_cloud.02.green', 'fog_cloud.01.white'], lingerTint: '#b9c46a' }),
  ossifying: grenade({ fly: 'throwable.throw.grenade.03.blackblue' }),
  smoke: grenade({ fly: 'throwable.throw.grenade.02.blackyellow', burst: ['smoke.puff.centered.grey'], linger: ['fog_cloud.01.white'], lingerTint: '#c9ccd2' }),
  acid: grenade({ fly: 'throwable.throw.grenade.03.green' }),
  launcher: rationale => re(rationale, stages => stages.map(s => s.kind === 'travel' ? swap(s, ['throwable.launch.grenade.02.blackyellow', 'throwable.launch.cannon_ball.01.black'])
    : isHit(s) ? swap(s, ['explosion.shrapnel.grenade.02.black', 'explosion.shrapnel.bomb.01.black']) : s)),
};

// ── Weapons ─────────────────────────────────────────────────────────────────
const muzzleBurst = (o = {}) => cast('Muzzle burst', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'w-muzzle', delay: 430, duration: 700, scale: 0.6, ...o });
const W = {
  hardlight: rationale => re(rationale, stages => stages.map(s => s.kind === 'impact' ? swap(s, ['unarmed_strike.magical.01.blue', 'unarmed_strike.physical.01.blue']) : s)),
  chompers: rationale => re(rationale, stages => stages.map(s => s.kind === 'impact' ? swap(s, ['bite.200px.grey', 'bite.200px.red'], { scale: 0.85, ...tint('#efe6d0') }) : s)),
  autofire: rationale => re(rationale, stages => [...stages, muzzleBurst()]),
  magnetar: rationale => re(rationale, stages => [...stages.map(s => s.kind === 'travel' ? swap(s, ['bullet.02.blue', 'bullet.03.blue']) : s),
    cast('Coil discharge', ['static_electricity.01.blue'], { delay: 380, duration: 800, scale: 0.45, opacity: 0.85 })]),
  sniper: rationale => re(rationale, stages => stages.map(s => s.kind === 'travel' ? swap(s, ['bullet.Snipe.orange', 'bullet.02.orange']) : s)),
  silencedSniper: rationale => re(rationale, stages => stages.filter(s => s.kind !== 'cast').map(s => s.kind === 'travel' ? swap(s, ['bullet.Snipe.orange', 'bullet.02.orange'], { opacity: 0.8 }) : s)),
  breacher: rationale => re(rationale, stages => {
    const out = stages.map(s => s.kind === 'travel' ? swap(s, ['ranged_missile.missile_only.001.orangeyellow', 'ranged_missile.missile_only.001.blue'], { repeats: 3, repeatInterval: 160 })
      : s.kind === 'impact' ? swap(s, ['explosion.shrapnel.grenade.03.orange', 'explosion.01.orange'], { scale: 0.9 }) : s);
    const hit = out.find(s => s.kind === 'impact');
    return hit ? [...out, motion('stagger', 'targets', { after: hit.stageId, anchor: 'start', offset: 120, duration: 700, intensity: 0.9 })] : out;
  }),
  rotolaserRanged: rationale => re(rationale, stages => stages.map(s => s.kind === 'travel' ? swap(s, ['lasershot.orange', 'lasershot.red'], { repeats: 3, repeatInterval: 110 }) : s)),
  rotolaserAuto: rationale => design(rationale, () => [
    motion('recoil', 'source', { delay: 520, duration: 900, distance: 0.08 }),
    cast('Rotating barrels flare', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'rl-muzzle', delay: 430, duration: 700, scale: 0.6, ...tint('#ff9a3d') }),
    travel('Plasma beam spray', ['lasershot.orange', 'lasershot.red'], { stageId: 'rl-fan', travelDestination: 'area', areaLayout: 'fan', fanCount: 7, delay: 500, duration: 1450, opacity: 0.9, fadeOut: 120, oneShot: true }),
  ], { sound: 'fireRay' }),
  plasmaCannonRanged: rationale => re(rationale, stages => stages.map(s => s.kind === 'impact' ? swap(s, ['explosion.01.orange', 'impact.fire.01.orange'], { scale: 0.8 }) : s)),
  plasmaCannonArea: rationale => design(rationale, () => [
    motion('recoil', 'source', { delay: 520, duration: 900, distance: 0.1 }),
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'pc-muzzle', delay: 400, duration: 650, scale: 0.55, ...tint('#ffb070') }),
    travel('Ionized gas charge', ['fire_bolt.orange'], { stageId: 'pc-bolt', travelDestination: 'area', delay: 450, duration: 1300 }),
    area('Superheated plasma blast', ['explosion.01.orange', 'fireball.explosion.orange'], { stageId: 'pc-blast', after: 'pc-bolt', anchor: 'end', offset: -100, duration: 2200 }),
  ]),
  stellarRanged: rationale => re(rationale, stages => stages.map(s => s.kind === 'impact' ? swap(s, ['explosion.shrapnel.grenade.02.black', 'explosion.shrapnel.bomb.01.black'], { scale: 0.9 }) : s)),
  stellarArea: rationale => design(rationale, () => [
    motion('recoil', 'source', { delay: 520, duration: 900, distance: 0.1 }),
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'sc-muzzle', delay: 400, duration: 650, scale: 0.55 }),
    travel('Mini-missile round', ['ranged_missile.missile_only.001.orangeyellow', 'ranged_missile.missile_only.001.blue'], { stageId: 'sc-missile', travelDestination: 'area', delay: 450, duration: 1300 }),
    area('Flechette burst', ['explosion.shrapnel.grenade.02.black', 'explosion.shrapnel.bomb.01.black'], { stageId: 'sc-burst', after: 'sc-missile', anchor: 'end', offset: -100, duration: 2200 }),
  ]),
  starknife: rationale => re(rationale, stages => stages.map(s => s.kind === 'travel' ? swap(s, ['shuriken.01', 'dagger.throw.01.white']) : s), { sound: 'shuriken', soundNamespace: 'ability' }),
  // Sound-only fixes: keep the visuals, give the silent/wrong entry a fitting profile.
  sound: (profile, namespace) => rationale => re(rationale, stages => stages, { sound: profile, ...(namespace ? { soundNamespace: namespace } : {}) }),
};

// ── Conditions / effects: persistent source auras only ──────────────────────
const A = (label, assets, o = {}) => aura(label, assets, { persist: true, subject: 'source', duration: 6000, fadeIn: 400, fadeOut: 500, ...o });
const fx = stagesFn => rationale => design(rationale, () => stagesFn());
const E = {
  targetLock: fx(() => [A('Target lock', ['markers_scifi.001.loop.001.orangeyellow'], { scale: 1.1, opacity: 0.85 })]),
  techLink: fx(() => [A('Data link', ['markers_scifi.002.loop.001.blueteal'], { scale: 1.05, opacity: 0.8 })]),
  eyes: fx(() => [A('Sharpened sight', ['eyes.01.bluegreen.few', 'eyes.01.dark_green.few'], { scale: 0.75, opacity: 0.8, offsetY: -0.35, offsetUnits: 'token' })]),
  catEyes: fx(() => [A('Feline eyes', ['eyes.01.orangeyellow.few', 'eyes.01.dark_green.few'], { scale: 0.75, opacity: 0.8, offsetY: -0.35, offsetUnits: 'token' })]),
  allSight: fx(() => [A('All-around vision', ['eyes.01.bluegreen.many', 'eyes.01.dark_green.many'], { scale: 1.1, opacity: 0.7 })]),
  echo: fx(() => [A('Echolocation pulses', ['soundwave.01.blue'], { scale: 1.5, opacity: 0.55, below: true })]),
  tremor: fx(() => [A('Ground tremors sensed', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { scale: 1.6, opacity: 0.5, below: true })]),
  regen: fx(() => [A('Regenerating tissue', ['healing_generic.loop.greenorange'], { scale: 0.9, opacity: 0.65, below: true })]),
  techRepair: fx(() => [A('Repair routine', ['healing_generic.loop.tealyellow', 'healing_generic.loop.greenorange'], { scale: 0.9, opacity: 0.65, below: true }), A('Diagnostic ring', ['markers_scifi.002.loop.001.greenyellow'], { scale: 1.05, opacity: 0.6 })]),
  stone: fx(() => [A('Stone skin', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.6, opacity: 0.85, ...tint('#a39178') })]),
  wood: fx(() => [A('Oaken bark', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 1.6, opacity: 0.85 })]),
  sand: fx(() => [A('Swirling sand', ['whirlwind.bluegrey'], { scale: 1.1, opacity: 0.6, below: true, ...tint('#d8bf8a') })]),
  ooze: fx(() => [A('Ooze body', ['bubble.001.001.loop.green', 'bubble.001.001.loop.blue'], { scale: 1.5, opacity: 0.8, ...tint('#9bd46a') })]),
  phase: fx(() => [A('Phased outline', ['condition.boon.02.001.refraction'], { scale: 1.35, opacity: 0.9 })]),
  vapor: fx(() => [A('Vapor body', ['fog_cloud.01.white'], { scale: 1.25, opacity: 0.7, ...tint('#dfe6ee') })]),
  field: fx(() => [A('Energy field', ['energy_field.02.above.blue'], { scale: 1.1, opacity: 0.5 })]),
  aegis: fx(() => [A('Multi-energy aegis', ['energy_field.01.multicolored', 'energy_field.01.blue'], { scale: 1.3, opacity: 0.5, below: true })]),
  hover: fx(() => [A('Lift field', ['energy_field.02.below.blue'], { scale: 1.25, opacity: 0.65, below: true, ...tint('#bedcf5') })]),
  nanites: fx(() => [A('Nanite cloud', ['swirling_sparkles.01.blue'], { scale: 1.6, opacity: 0.8, ...tint('#c6ccd6') })]),
  gravity: fx(() => [A('Graviton drag', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.5, opacity: 0.75, ...tint('#8a6fd1') })]),
  photon: fx(() => [A('Photon glow', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.9, opacity: 0.8, ...tint('#fff2b0') })]),
  sunlight: fx(() => [A('Bright emanation', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 1.8, opacity: 0.75, below: true, ...tint('#ffe9a8') })]),
  circuitGlow: fx(() => [A('Circuitry glow', ['markers.light.loop.blue'], { scale: 1.5, opacity: 0.75, below: true, ...tint('#9fe8ff') })]),
  music: fx(() => [A('Music notes', ['markers.music_note.blue', 'markers.music.greenorange'], { scale: 0.8, opacity: 0.85 })]),
  glitch: fx(() => [A('Glitching static', ['static_electricity.02.blue'], { scale: 1.1, opacity: 0.7 })]),
  overdrive: fx(() => [A('Overdrive static', ['static_electricity.02.blue'], { scale: 1.1, opacity: 0.65 }), A('Overdrive speed', ['token_border.circle.spinning.blue.007', 'token_border.circle.spinning.blue'], { scale: 1.45, opacity: 0.8, below: true })]),
  vines: fx(() => [A('Clinging vines', ['vine.loop.nature.single.01.green'], { scale: 1.1, opacity: 0.85, below: true })]),
  acid: fx(() => [A('Acid grip', ['bubble.001.001.loop.green', 'bubble.001.001.loop.blue'], { scale: 1.3, opacity: 0.75, ...tint('#b8e580') })]),
  voidHeal: fx(() => [A('Void-fed vitality', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { scale: 1.3, opacity: 0.7, ...tint('#7a4fb0') })]),
  zeroG: fx(() => [A('Drifting motes', ['swirling_sparkles.01.blue'], { scale: 1.35, opacity: 0.6, ...tint('#cfe3ff'), ...breathe(2600, 0.94, 1.04) })]),
  transmute: fx(() => [A('Battle form', ['magic_signs.circle.02.transmutation.loop.yellow'], { scale: 1.45, opacity: 0.85, below: true })]),
  rampart: fx(() => [A('Behind cover', ['markers.shield_rampart.loop.01.white', 'markers.shield_rampart.loop.01.orange'], { scale: 0.85, opacity: 0.85 })]),
  water: fx(() => [A('Underwater bubbles', ['bubble.002.001.loop.blue', 'bubble.001.001.loop.blue'], { scale: 1.4, opacity: 0.75 })]),
  scorch: fx(() => [A('Scorching blood', ['flames.04.loop.orange'], { scale: 1.2, opacity: 0.7, below: true })]),
  speed: fx(() => [A('Quickened stride', ['token_border.circle.spinning.blue.007', 'token_border.circle.spinning.blue'], { scale: 1.5, opacity: 0.95, below: true })]),
};

export default {
  'sf2e:sf2e-weapon-equipment-0fZ9jBVvpljgAZC8:thrown': G.flash("A flash grenade blast of bright light: a white-hot flare bursts over the area and caught creatures flinch from the glare."), // Flash Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-0fZ9jBVvpljgAZC8:area': G.flash("A flash grenade blast of bright light: a white-hot flare bursts over the area and caught creatures flinch from the glare."), // Flash Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-p4S4iBqbVkpvWP6Z:thrown': G.flash("A flash grenade blast of bright light: a white-hot flare bursts over the area and caught creatures flinch from the glare."), // Flash Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-p4S4iBqbVkpvWP6Z:area': G.flash("A flash grenade blast of bright light: a white-hot flare bursts over the area and caught creatures flinch from the glare."), // Flash Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-omxqK2E84pGaMj6x:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-omxqK2E84pGaMj6x:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-SzGr78zdpnnrorre:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-SzGr78zdpnnrorre:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-KaUapB2WwBE6wnzd:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-KaUapB2WwBE6wnzd:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-weV9f340wsszD1rD:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-weV9f340wsszD1rD:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-8ThQnRVi44idLq8T:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-8ThQnRVi44idLq8T:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-BmJARyq7RrMXQezF:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-BmJARyq7RrMXQezF:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-LaDOwzjCIAskfql0:thrown': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-LaDOwzjCIAskfql0:area': G.frag("Fragmentary grenade lobbed as a real grenade that bursts in a cloud of shrapnel; caught creatures stagger."), // Frag Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-rgprAOXrCIFtwfpr:ranged': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Commercial) [ranged]
  'sf2e:sf2e-weapon-equipment-rgprAOXrCIFtwfpr:area': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-qqFSu3Ed6zirmoXn:ranged': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Superior) [ranged]
  'sf2e:sf2e-weapon-equipment-qqFSu3Ed6zirmoXn:area': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-Gvd406aqaxjBcnFI:ranged': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Tactical) [ranged]
  'sf2e:sf2e-weapon-equipment-Gvd406aqaxjBcnFI:area': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-P4SuZ6SumQ0YV9JN:ranged': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Ultimate) [ranged]
  'sf2e:sf2e-weapon-equipment-P4SuZ6SumQ0YV9JN:area': G.launcher("The rotating launcher fires a grenade round in a flat arc that bursts in shrapnel at the target or area."), // Grenade Launcher (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-SFgmhbrinHfYVgKB:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-SFgmhbrinHfYVgKB:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-87ExVxkkYur012Hq:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-87ExVxkkYur012Hq:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-MozoKkEBcU8BGHTF:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-MozoKkEBcU8BGHTF:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-wK4qod7qCY9ltDA5:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-wK4qod7qCY9ltDA5:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-PcwjlZ2nnoSEQNpg:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-PcwjlZ2nnoSEQNpg:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-ZZXbmSq3g8AA67RC:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-ZZXbmSq3g8AA67RC:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-jlqSlawTivhHODKE:thrown': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-jlqSlawTivhHODKE:area': G.foam("The grenade erupts as rapidly hardening off-white foam instead of a sonic shatter; caught creatures struggle against it."), // Hardening Foam Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-h53QPQt1GlzPwdaY:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-h53QPQt1GlzPwdaY:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-EgAVqAYCrSJzxF1j:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-EgAVqAYCrSJzxF1j:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-R8dEureCA93msBsa:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-R8dEureCA93msBsa:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-ZIm4WMr5CYblEBHF:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-ZIm4WMr5CYblEBHF:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-fvKj2J4p6MwXeupx:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-fvKj2J4p6MwXeupx:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-TrS4puy7wfjbDJIA:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-TrS4puy7wfjbDJIA:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-xFmyDUWtH9PDJ8ww:thrown': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-xFmyDUWtH9PDJ8ww:area': G.incendiary("A tech incendiary grenade (not an antique bomb) explodes in a blast of intense chemical heat."), // Incendiary Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-RAeyWxgTEoOwP2xV:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-RAeyWxgTEoOwP2xV:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-OpLJBOVPohstbsBm:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-OpLJBOVPohstbsBm:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-VqijQYqNCEb4c8uL:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-VqijQYqNCEb4c8uL:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-MEXkVq8CfpZq7Eos:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-MEXkVq8CfpZq7Eos:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-M5WuIvPAhoA1iH9Q:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-M5WuIvPAhoA1iH9Q:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-67OvC3ZhEwabDVLg:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-67OvC3ZhEwabDVLg:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-tvJFONGdHn3i0Tt5:thrown': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-tvJFONGdHn3i0Tt5:area': G.magefoil("Magefoil grenades discharge waves of psychic energy: a violet mental burst instead of grey gas, and caught minds reel."), // Magefoil Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-IPpC3rDSJQmT2OSa:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-IPpC3rDSJQmT2OSa:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-QA6oL6Or7ujqBm9M:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-QA6oL6Or7ujqBm9M:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-LSSDx7G6gSdadCbQ:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-LSSDx7G6gSdadCbQ:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-hA6PckW47NsPA4IM:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-hA6PckW47NsPA4IM:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-SYs1P6qEpnnZNT6q:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-SYs1P6qEpnnZNT6q:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-1bAsr4Tu6fSfNg6y:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-1bAsr4Tu6fSfNg6y:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-qtlfVxeIH7e35yqY:thrown': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-qtlfVxeIH7e35yqY:area': G.miasma("The miasmatic grenade releases a foul, noxious chemical cloud (not a sonic shatter) that hangs briefly; caught creatures gag and cower."), // Miasmatic Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-T6mFICQAIuByIyV2:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-T6mFICQAIuByIyV2:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-DUg4iVtsgCidutJM:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-DUg4iVtsgCidutJM:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-05fb97mQM2HkKCxD:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-05fb97mQM2HkKCxD:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-qMbuhxD7SVA11fOE:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-qMbuhxD7SVA11fOE:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-9UnShOLCo6JWWrtW:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-9UnShOLCo6JWWrtW:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-HHasuyLvKgVdv5r5:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-HHasuyLvKgVdv5r5:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-WRAI1Ho6T8XLRXvk:thrown': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-WRAI1Ho6T8XLRXvk:area': G.ossifying("An Eoxian tech grenade releasing calcifying void agents; grenade art replaces the antique bomb, void miasma burst kept."), // Ossifying Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-HlrNSzynsQuZrc2o:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-HlrNSzynsQuZrc2o:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-7y8IWTlnQnnjkfXe:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-7y8IWTlnQnnjkfXe:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-kzc2sa3DulMUTx3m:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-kzc2sa3DulMUTx3m:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-OvyHsBJVspNBZQhR:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-OvyHsBJVspNBZQhR:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-Lx9IS1tHIzSICJi7:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-Lx9IS1tHIzSICJi7:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-5Tc2Eaaf15LVByBJ:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-5Tc2Eaaf15LVByBJ:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-7NnacNASvkIezlZO:thrown': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-7NnacNASvkIezlZO:area': G.smoke("The smoke grenade unleashes a concealing smoke cloud that lingers over the burst instead of a shrapnel explosion."), // Smoke Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-bXqSTn1rNGSArlYV:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Advanced) [thrown]
  'sf2e:sf2e-weapon-equipment-bXqSTn1rNGSArlYV:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Advanced) [Area Fire]
  'sf2e:sf2e-weapon-equipment-GLQU3x0e36J7OHHC:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Commercial) [thrown]
  'sf2e:sf2e-weapon-equipment-GLQU3x0e36J7OHHC:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Commercial) [Area Fire]
  'sf2e:sf2e-weapon-equipment-re5z8UAVuxwSIQlt:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Elite) [thrown]
  'sf2e:sf2e-weapon-equipment-re5z8UAVuxwSIQlt:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Elite) [Area Fire]
  'sf2e:sf2e-weapon-equipment-UtAWKbJ39jj3w0Lv:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Paragon) [thrown]
  'sf2e:sf2e-weapon-equipment-UtAWKbJ39jj3w0Lv:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Paragon) [Area Fire]
  'sf2e:sf2e-weapon-equipment-uZc036NvIdxm38jA:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Superior) [thrown]
  'sf2e:sf2e-weapon-equipment-uZc036NvIdxm38jA:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Superior) [Area Fire]
  'sf2e:sf2e-weapon-equipment-ymmebPeT4rMwfwoY:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Tactical) [thrown]
  'sf2e:sf2e-weapon-equipment-ymmebPeT4rMwfwoY:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Tactical) [Area Fire]
  'sf2e:sf2e-weapon-equipment-XE8RQRpoCrvupdU5:thrown': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Ultimate) [thrown]
  'sf2e:sf2e-weapon-equipment-XE8RQRpoCrvupdU5:area': G.acid("Szynegation tech grenade thrown as grenade art; the acidic Swarm-blood splash is kept."), // Szynegation Grenade (Ultimate) [Area Fire]
  'sf2e:sf2e-weapon-equipment-pwN8Bh8amBjBPka4': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Advanced)
  'sf2e:sf2e-weapon-equipment-b12tnjobe9IrphII': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Commercial)
  'sf2e:sf2e-weapon-equipment-Q2wVgoS7y1JlciTV': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Elite)
  'sf2e:sf2e-weapon-equipment-xIyau4fBsCcoLB9x': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Paragon)
  'sf2e:sf2e-weapon-equipment-MeV8qRq6cMlSBC2E': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Superior)
  'sf2e:sf2e-weapon-equipment-xJBRvJHRz7KHAlpj': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Tactical)
  'sf2e:sf2e-weapon-equipment-Vp7O4NTBJ5OZwGMG': W.hardlight("Hardlight handwraps shine as glowing hard light, so the punch is a luminous energy fist rather than a plain physical strike."), // Hardlight Handwraps (Ultimate)
  'sf2e:sf2e-weapon-equipment-dSBaVgdksA6zDfWZ': W.chompers("Pneumatic ivory dental veneers: the strike is a snapping ivory bite, not a punch."), // Ivory Chompers
  'sf2e:sf2e-weapon-equipment-V0LgOSOvkNvs2i0x:thrown': W.sound('thrownDagger', 'ability')("Thrown knife keeps its dagger flight and gains the thrown-dagger release/contact sound instead of silence."), // Knife [thrown]
  'sf2e:sf2e-weapon-equipment-EnufuFPBa1U2pPDn:area': W.autofire("Automatic machine gun emptying its magazine: a sustained muzzle burst accompanies the fan of rounds across the area."), // Machine Gun [Auto-Fire]
  'sf2e:sf2e-weapon-equipment-bHHFXS2nmfOQFQyu:ranged': W.magnetar("Electromagnets accelerate slugs: the shot is a blue magnetically driven slug with a coil discharge at the muzzle."), // Magnetar Rifle [ranged]
  'sf2e:sf2e-weapon-equipment-bHHFXS2nmfOQFQyu:area': W.magnetar("Magnetar auto-fire: a fan of blue electromagnetic slugs with a coil discharge at the muzzle."), // Magnetar Rifle [Auto-Fire]
  'sf2e:sf2e-weapon-equipment-vsc8EKggLM79qfNy:ranged': W.sound('sonic')("Meme cannon fires bursts of sonic and visual gibberish, so it uses the sonic profile instead of a firearm report."), // Meme Cannon [ranged]
  'sf2e:sf2e-weapon-equipment-vsc8EKggLM79qfNy:area': W.sound('sonic')("Meme cannon fires bursts of sonic and visual gibberish, so it uses the sonic profile instead of a firearm report."), // Meme Cannon [Area Fire]
  'sf2e:sf2e-weapon-equipment-iXnHjgQcBR9wEvMk:area': W.sound('coldRay')("Numbing beam line keeps its frost ray and gains the frost-ray sound instead of silence."), // Numbing Beam Rifle [Area Fire]
  'sf2e:sf2e-weapon-equipment-WTG6BeN4WJfbA3lO:ranged': W.plasmaCannonRanged("Plasma cannon charges of ionized gas explode in a blast of superheated plasma at the target."), // Plasma Cannon [ranged]
  'sf2e:sf2e-weapon-equipment-WTG6BeN4WJfbA3lO:area': W.plasmaCannonArea("Area fire: an ionized-gas charge flies to the burst and explodes in superheated plasma filling the 10-foot area."), // Plasma Cannon [Area Fire]
  'sf2e:sf2e-weapon-equipment-nCDhToSxmf9xrpEh': W.breacher("Reaction breacher launches flak from miniature cluster missiles: a salvo of three missiles bursting in shrapnel that rocks the target."), // Reaction Breacher
  'sf2e:sf2e-weapon-equipment-QqR5bmqrv8VzWdll:ranged': W.rotolaserRanged("A rotolaser fires multiple beams of plasma at once: a quick triple volley of orange plasma bolts."), // Rotolaser [ranged]
  'sf2e:sf2e-weapon-equipment-QqR5bmqrv8VzWdll:area': W.rotolaserAuto("Rotolaser auto-fire spews a fan of plasma beams across the area from its rotating barrels, replacing an unrelated blue fire cone."), // Rotolaser [Auto-Fire]
  'sf2e:sf2e-weapon-equipment-2gIo208O7zxPTL5J': W.sniper("Single-shot sniper rifle: a long, fast sniper round instead of a generic bullet."), // Seeker Rifle
  'sf2e:sf2e-weapon-equipment-LTYzHdOOhCjtb79T': W.sniper("Single-shot sniper rifle: a long, fast sniper round instead of a generic bullet."), // Shirren-eye Rifle
  'sf2e:sf2e-weapon-equipment-7cpnKlkU5QEiuISo': W.silencedSniper("Shobhad longrifle has a built-in silencer and scope: a sniper round with no muzzle flash."), // Shobhad Longrifle
  'sf2e:sf2e-weapon-equipment-wbKiBgYY120RyoGg:thrown': W.starknife("Star-shaped blade thrown: a spinning star (shuriken) flight with a thrown-star sound instead of a silent dagger."), // Shooting Starknife [thrown]
  'sf2e:sf2e-weapon-equipment-HubVnt6gFuzaXMUK:ranged': W.stellarRanged("Stellar cannon mini-missiles packed with flechettes: the round bursts in shrapnel at the target."), // Stellar Cannon [ranged]
  'sf2e:sf2e-weapon-equipment-HubVnt6gFuzaXMUK:area': W.stellarArea("Area fire: a flechette mini-missile flies to the burst and shreds the 10-foot area in shrapnel."), // Stellar Cannon [Area Fire]
  'sf2e:sf2e-weapon-equipment-nTfNpQOrzgNuWcSx:area': W.sound('coldRay')("Zero cannon line keeps its endothermic frost ray and gains the frost-ray sound instead of silence."), // Zero Cannon [Area Fire]
  'sf2e:sf2e-weapon-equipment-Jtl2vxrTdhm1e3Er': W.sound('dagger', 'ability')("Zero knife is a blade of ice; it keeps the cold-finished stab and gains a dagger contact sound instead of silence."), // Zero Knife
  'sf2e:6A2QDy8wRGCVQsSd': E.glitch("Glitching tech seizes up: crackling static around the creature instead of a generic stun marker."), // Glitching
  'sf2e:z1ucw4CLwLqHoAp3': E.zeroG("Untethered: floating without support in zero gravity, shown as slowly drifting motes instead of a plain ring."), // Untethered
  'sf2e:iMh34rzRpLOoKNbL': E.field("Adaptive Dermis grants energy resistance: a faint protective energy field."), // Effect: Adaptive Dermis
  'sf2e:q9gRPJBtyyJwgTRb': E.field("Adaptive Resistance grants resistance to a chosen damage type: a faint protective energy field."), // Effect: Adaptive Resistance
  'sf2e:xZ5XMY55S42aGyjg': E.hover("Uplifting aeon stone grants a fly Speed: a lift field beneath the creature."), // Effect: Aeon Stone (Uplifting)
  'sf2e:TPbr1kErAAJKBi3V': E.water("Aquatic Combat: fighting underwater, shown as rising bubbles instead of a curse sigil."), // Effect: Aquatic Combat
  'sf2e:yDgrjb3OuB51axy7': E.hover("Atmospheric Flight grants a fly Speed: a lift field beneath the creature."), // Effect: Atmospheric Flight
  'sf2e:e2z2ZdHOdc3BrVf8': E.gravity("Graviton-attuned aura slows Speeds: an inward violet gravitational drag."), // Effect: Attunement Aura (Graviton-Attuned)
  'sf2e:uVKf8emUoSGeRZQt': E.photon("Photon-attuned aura speeds you up: a bright photon glow."), // Effect: Attunement Aura (Photon-Attuned)
  'sf2e:P5r9ZR5tOvzQnTyb': E.ooze("Become Ooze: an ooze body resisting slashing and piercing, shown as bubbling green ooze."), // Effect: Become Ooze
  'sf2e:qj97oOs2Z2qk9w00': E.regen("Blood Renewal grants regeneration: a steady healing glow."), // Effect: Blood Renewal
  'sf2e:Crg77XKCHxittH5a': E.voidHeal("Bone Serum grants void healing: dark void strands instead of a heart icon."), // Effect: Bone Serum
  'sf2e:MXV9PRH3mK7o6TDP': E.circuitGlow("Bursting Surge: your circuitry exudes bright light in an emanation."), // Effect: Bursting Surge
  'sf2e:22BLEySiAaQwoO6f': E.regen("Cellular Regeneration grants regeneration: a steady healing glow."), // Effect: Cellular Regeneration
  'sf2e:ue31mD8kFdI3AlYM': E.field("Convergent Ablation grants resistance to the triggering energy: a faint protective energy field."), // Effect: Convergent Ablation
  'sf2e:x9nA4lIcHmE7x8Tt': E.targetLock("Coordinated Fire grants a bonus to your next attack: a targeting lock instead of unrelated flames."), // Effect: Coordinated Fire
  'sf2e:I9lfZUiCwMiGogVi': E.rampart("Cover: being behind an obstacle, shown as a rampart marker instead of a light orb."), // Effect: Cover
  'sf2e:ii1NY1YvM7lsql6n': E.music("Cue the Music: music notes for the musical bonus."), // Effect: Cue the Music
  'sf2e:2Iuhg4udP9eQF3oM': E.targetLock("Digital Assessment! marks a creature with a digital targeting overlay."), // Effect: Digital Assessment!
  'sf2e:f92GBWr5lfx4tKot': E.field("Elemental Perfect Harmony grants resistance to two elements: a faint protective energy field."), // Effect: Elemental Perfect Harmony
  'sf2e:YbBoPkBHnyyy3xLd': E.echo("Focus Senses grants precise echolocation: pulsing sound waves."), // Effect: Focus Senses
  'sf2e:QFglrJ1STC0L82aP': E.tremor("Activate Sensilla grants imprecise tremorsense: low ground-hugging vibration rings."), // Effect: Activate Sensilla
  'sf2e:7CtHz1DQcMXLafOS': E.field("Force Field: a personal force field tracking its own Hit Points, shown as an energy dome."), // Effect: Force Field
  'sf2e:VhJBxcduyXuNED74': E.phase("Fractal-Lite: a refracted, fractal body resisting physical damage."), // Effect: Fractal-Lite
  'sf2e:a9EaJsV7mwXohaY1': E.hover("Gift of Gadrathar grants a fly Speed: a lift field beneath the creature."), // Effect: Gift of Gadrathar
  'sf2e:SS3He5Oh41NZjmf7': E.targetLock("Homing Mote: the origin ignores your cover and concealment, so a homing target lock replaces fog."), // Effect: Homing Mote
  'sf2e:kUsIxlsS2CzXnwyB': E.hover("Hull Hop grants a fly Speed: a lift field beneath the creature."), // Effect: Hull Hop
  'sf2e:NqP5f6IChp8XNCrJ': E.regen("Hypopen grants quickened or fast healing: a steady healing glow."), // Effect: Hypopen (Quickened or Fast Healing)
  'sf2e:2UI9dt0QM2VEvpJV': E.hover("Interstellar Raft grants a 40-foot fly Speed: a lift field beneath the creature."), // Effect: Interstellar Raft
  'sf2e:MlcCtlwwJEKusoUK': E.transmute("Invoke the Leviathan transforms you into a leviathan battle form: a transmutation circle."), // Effect: Invoke the Leviathan
  'sf2e:0kP4P73w0PykYkPY': E.hover("Jetpack grants a fly Speed: a lift field beneath the creature."), // Effect: Jetpack
  'sf2e:9e4U9NUgOytOimaj': E.sunlight("Let the Sun Shine: you emanate bright light in a 20-foot emanation."), // Effect: Let the Sun Shine
  'sf2e:YSEse0Vs6r639go5': E.speed("Let's Go grants extra Speed and quickened Strides: a speed ring instead of fog."), // Effect: Let's Go
  'sf2e:81igjVgKBDXMomwb': E.hover("Manifest Energy Wings grants a fly Speed: a lift field beneath the creature."), // Effect: Manifest Energy Wings
  'sf2e:Uwb0PSFXd4QGG9Q1': E.targetLock("Mobile Aim: precision aim that reduces cover, shown as a targeting lock."), // Effect: Mobile Aim
  'sf2e:B8kDmWVlRX1uJb1o': E.targetLock("Mobile Aim: precision aim that reduces cover, shown as a targeting lock."), // Effect: Mobile Aim (Ephemeral)
  'sf2e:cRv8Hd1LmNp4QsWt': E.targetLock("Multi-Weapon Aim reduces your cover bonus: you are under a targeting lock."), // Effect: Multi-Weapon Aim (Reduce Cover)
  'sf2e:F2VaEGedUJJ5aPqF': E.targetLock("Aim (Reduce Cover): you are under a targeting lock that reduces your cover bonus."), // Effect: Aim (Reduce Cover)
  'sf2e:aw4sF8U2odkls99H': E.nanites("Nanite Form: you become a Huge flying swarm of nanites, shown as a silver nanite cloud."), // Effect: Nanite Form
  'sf2e:ErLweSmVAN57QIpp': E.circuitGlow("Nanite Surge: your circuitry glows, lighting the emanation."), // Effect: Nanite Surge
  'sf2e:g5T2YGRn0nSGKYyy': E.hover("Natural Thruster boosts your fly Speed: a lift field beneath the creature."), // Effect: Natural Thruster
  'sf2e:EKRBg0ydRsHdvc7G': E.stone("One with the Stone: stony temporary Hit Points while enlarged, shown as orbiting stone."), // Effect: One with the Stone
  'sf2e:y6VGOjPa8TtVVvYR': E.phase("Phase Shift: the swarm becomes incorporeal, shown as a refracted outline."), // Effect: Phase Shift
  'sf2e:O4Ck3SKtbPWN3WKU': E.regen("Photosynthetic Regeneration grants regeneration 20: a steady healing glow."), // Effect: Photosynthetic Regeneration
  'sf2e:mKWPyxaEKvO5RrZx': E.music("Picklecore Music speeds you along: music notes for the musical bonus."), // Effect: Picklecore Music (Critical Success)
  'sf2e:97keYapBgpIlaoNI': E.regen("Queen's Sacrifice grants fast healing 15: a steady healing glow."), // Effect: Queen's Sacrifice
  'sf2e:DjxZpQ4xJWWvYQqY': E.techRepair("Repair Module grants fast healing: a tech repair routine with a diagnostic ring."), // Effect: Repair Module
  'sf2e:j8PdZa8f0ekkdIYw': E.regen("Restorative Chatter: your body physically heals, shown as a healing glow."), // Effect: Restorative Chatter
  'sf2e:h1bYCRQFvDl0gPkG': E.sand("Sandstorm veil/vortex grants physical resistance: swirling sand around the creature."), // Effect: Sandstorm Veil
  'sf2e:cA7lJArsiFL45GFa': E.sand("Sandstorm veil/vortex grants physical resistance: swirling sand around the creature."), // Effect: Sandstorm Vortex
  'sf2e:JDvBWzG4ivMPPYfI': E.scorch("Scorching Lifeblood burns anyone who touches or wounds you: smouldering flames instead of a blood drop."), // Effect: Scorching Lifeblood
  'sf2e:mprZBMDC5a4U2STA': E.targetLock("Sharpshooter targeting reduces cover against ranged Strikes: a targeting lock."), // Effect: Sharpshooter
  'sf2e:UB0yKVxoS0EBXyCO': E.targetLock("Sharpshooter targeting reduces cover against ranged Strikes: a targeting lock."), // Effect: Sharpshooter Serum
  'sf2e:DL7GOlVLthV6HJpb': E.targetLock("Sharpshooter targeting reduces cover against ranged Strikes: a targeting lock."), // Effect: Sharpshooter Serum (Reduce Cover)
  'sf2e:0sNnWNSToD3FrbtF': E.phase("Shifthide Camouflage: refraction camouflage for Hide and Sneak."), // Effect: Shifthide Camouflage
  'sf2e:JgJ4Iw8BvJ4tWkah': E.regen("Soul Lock (Healing) grants fast healing 5: a steady healing glow."), // Effect: Soul Lock (Healing)
  'sf2e:ycvnhhQUcxfnZNhg': E.field("Spell Membrane grants resistance against the triggering effect: a faint protective energy field."), // Effect: Spell Membrane
  'sf2e:4J30S9nhyfaCX1Cm': E.techLink("Starship Possession: the driftdead sees through the ship's systems, shown as a data link."), // Effect: Starship Possession
  'sf2e:n33jAVZDDWQ7ifvl': E.targetLock("Tactical Tutelage adds precision damage and reduces the target's cover: a targeting lock."), // Effect: Tactical Tutelage
  'sf2e:IgDTjR6XT2nlZU26': E.techLink("Unauthorized Helldriver boosts Piloting: a tech data link."), // Effect: Unauthorized Helldriver
  'sf2e:hJI3OxpC4qcr7uxp': E.overdrive("Unstable Overdrive: quickened and glitching, shown as crackling static over a speed ring."), // Effect: Unstable Overdrive
  'sf2e:eETBTvKEhaCxCnG8': E.vapor("Vapor Form: a vaporous body resisting physical damage with a slow fly Speed."), // Effect: Vapor Form
  'sf2e:lBNPZGhjrJy38W4P': E.allSight("Wide Field of View grants all-around vision: many watchful eyes."), // Effect: Wide Field of View
  'sf2e:6TGcfVyzzVHEo7ke': E.acid("Acid Grip: persistent acid slows your Speeds, shown as clinging acid bubbles."), // Spell Effect: Acid Grip
  'sf2e:mvMWmP3m9Xawbwpx': E.hover("Aerial Form grants a flying battle form: a lift field beneath the creature."), // Spell Effect: Aerial Form
  'sf2e:h1i8c47U0IOrMrHJ': E.techLink("Akashic Download feeds you knowledge for Recall Knowledge: a data link."), // Spell Effect: Akashic Download
  'sf2e:v724q5Xi7KPPnLQ3': E.stone("Cairn Form: a stony body resisting physical damage with stone fists."), // Spell Effect: Cairn Form
  'sf2e:q47pDFylqDY1VYEk': E.techLink("Commune with Tech: bonus to Hack and interact with technology, shown as a data link."), // Spell Effect: Commune with Tech
  'sf2e:IXS15IQXYCZ8vsmX': E.eyes("Darkvision: eyes that see in the dark instead of a light orb."), // Spell Effect: Darkvision
  'sf2e:inNfTmtWpsxeGBI9': E.eyes("Darkvision: eyes that see in the dark instead of a light orb."), // Spell Effect: Darkvision (24 hours)
  'sf2e:1pC1qjvCuAKzjYo8': E.transmute("Dragon Form: a transmutation circle for the dragon battle form."), // Spell Effect: Dragon Form
  'sf2e:Qp0dlhJaCzXIx73r': E.transmute("Elemental Form: a transmutation circle for the elemental battle form."), // Spell Effect: Elemental Form
  'sf2e:4Lo2qb5PmavSsLNk': E.aegis("Energy Aegis grants resistance to many energy types: a multicolored energy field."), // Spell Effect: Energy Aegis
  'sf2e:sPCWrhUHqlbGhYSD': E.transmute("Enlarge: transmutation growth to Large, shown as a transmutation circle."), // Spell Effect: Enlarge
  'sf2e:rjM25qfw5BKj9h97': E.vines("Entangling Flora slows Speeds: clinging vines."), // Spell Effect: Entangling Flora
  'sf2e:1Ut6QrRtIZzjmqZW': E.catEyes("Feline Senses grants darkvision: glowing cat eyes."), // Spell Effect: Feline Senses
  'sf2e:R9R0Nf8YX5ahx5FH': E.catEyes("Feline Senses grants darkvision: glowing cat eyes."), // Spell Effect: Feline Senses (6th-Rank)
  'sf2e:ZlsuhS9J0S3PuvCO': E.phase("Flicker grants resistance to all damage except force: a flickering refracted outline."), // Spell Effect: Flicker
  'sf2e:MuRBCiZn5IKeaoxi': E.hover("Fly grants a fly Speed: a lift field beneath the creature."), // Spell Effect: Fly
  'sf2e:4cFhz9knnHUHj3wi': E.regen("Genetic Regeneration grants regeneration: a steady healing glow."), // Spell Effect: Genetic Regeneration
  'sf2e:NmhqKZyMgQSHbyHj': E.music("Motivating Ringtone: an upbeat tune, shown as music notes instead of a fear marker."), // Spell Effect: Motivating Ringtone
  'sf2e:JHpYudY14g0H4VWU': E.stone("Mountain Resilience grants stone-like physical resistance: orbiting stone."), // Spell Effect: Mountain Resilience
  'sf2e:HoOujAdQWCN4E6sQ': E.wood("Oaken Resilience: oak-bark resistance to bludgeoning and piercing."), // Spell Effect: Oaken Resilience
  'sf2e:dXq7z633ve4E0nlX': E.regen("Regenerate grants regeneration: a steady healing glow."), // Spell Effect: Regenerate
  'sf2e:T5bk6UH7yuYog1Fp': E.eyes("See the Unseen: eyes that pierce invisibility."), // Spell Effect: See the Unseen
  'sf2e:LXf1Cqi1zyo4DaLv': E.transmute("Shrink: transmutation to Tiny size, shown as a transmutation circle."), // Spell Effect: Shrink
  'sf2e:4P2rPLVKjSpUbOWI': E.field("Subjective Reality grants resistance against the target: a faint protective energy field."), // Spell Effect: Subjective Reality
  'sf2e:TwtUIEyenrtAbeiX': E.vines("Tangle Vine slows Speeds: clinging vines."), // Spell Effect: Tangle Vine
  'sf2e:NcPiz5TOhnel5ZoX': E.techLink("Tech Intuition: a data link guiding your tech check."), // Spell Effect: Tech Intuition
  'sf2e:sILRkGTwoBywy0BU': E.vapor("Vapor Form: a vaporous body resisting physical damage with a slow fly Speed."), // Spell Effect: Vapor Form
  'sf2e:NWNXwJhNpNvNdyLd': E.hover("Void Vessel grants a 30-foot fly Speed: a lift field beneath the creature."), // Spell Effect: Void Vessel
};

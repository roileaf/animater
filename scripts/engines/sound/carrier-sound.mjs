// What a carrier sounds like. Roi's mock asked for five things from a wagon: the rims on whatever it is rolling over,
// the axle creaking now and then and louder on a jolt, the harness and trace chains jingling with the pace, the load
// shifting when a wheel drops, and the brake and skid when it stops short. A covered wagon adds its canvas and ropes.
//
// The rims are one sustained sound held under the wagon while it moves, the way a river is held (river-sound.mjs), not
// a footstep per stride: a wheel does not step. Everything else fires once, off what the body is doing
// (carrier-look.mjs bodyRide says when a wheel drops).
//
// A boat is the same five things in water: the wash along the hull in place of the rims, the stroke of the oars in
// place of the harness, the timbers working in place of the axle, and the hull knocking on whatever stopped it in
// place of the brake. It is the one kind with something to say standing still, because water slaps a moored hull
// whether or not anyone is rowing — that is the idle voice, and it fades out as the wash comes up.
//
// Every clip is CC0 from Freesound, auditioned, and recorded in assets/sounds/vehicles/catalog.json with its source.
//
// Pure: no Foundry, no audio. The caller plays what this picks.

const BASE = 'modules/animater/assets/sounds/vehicles';
const of = (...names) => names.map((name) => `${BASE}/${name}.ogg`);

// The rims, by what is under them. A surface with no recording of its own borrows the nearest one that is honest: a
// paved road and a gravel track are both the dirt recording (iron on hard ground); ice is the snow one.
export const ROLL_SOUNDS = Object.freeze({
  dirt: of('roll-dirt-437078-a', 'roll-dirt-437078-b', 'roll-dirt-437092-b', 'roll-dirt-675230-a', 'roll-dirt-675230-b'),
  wood: of('roll-wood-480042-a', 'roll-wood-480042-b'),
  snow: of('roll-snow-721122-a'),
  barrow: of('barrow-787859'),
  // A boat has no rims: what is held under it while it moves is the water running along the hull.
  wash: of('wash-509322-a', 'wash-509322-b', 'wash-509323-a', 'wash-509323-b'),
});

// A mount has no rims and nothing in harness: what it has is its own hooves, and unlike a wheel they change with the
// pace (Roi: "horse(mount) sfx doesnt match galloping horse" — it was a footstep paced by the creature's size, one
// coconut clop every 450 ms whether the horse was stepping over a log or crossing a field at a run). So a mount holds
// a recording of a real horse at the pace it is actually going, the way a wagon holds its rims.
export const HOOF_SOUNDS = Object.freeze({
  walk: of('walk-233345-a', 'walk-233345-b', 'walk-640199-a', 'walk-640199-b'),
  trot: of('trot-182504-a', 'trot-182504-b'),
  gallop: of('gallop-368583-a', 'gallop-684446-a'),
});
export const MOUNT_PACES = Object.freeze(['walk', 'trot', 'gallop']);
// Where one pace gives way to the next, in squares covered since it set off. A horse is not told to gallop, it works
// up to one: out of the gate at a walk, into a trot once it is going somewhere, and flat out across a field. Measuring
// the journey rather than this frame's speed is also the only honest reading, because Foundry slides every token at
// the same speed however far it is going.
export const PACE_AT = Object.freeze({ trot: 2, gallop: 6 });
export function mountPace(run = 0) {
  const squares = Math.max(0, Number(run) || 0);
  return squares >= PACE_AT.gallop ? 'gallop' : squares >= PACE_AT.trot ? 'trot' : 'walk';
}
/**
 * Whether there are hooves to be heard at all: a mount is itself the horse, and a wagon has a pair of them in the
 * shafts (Roi: "i think wagon should combine wagon and horse sfx no?" — it should; a wagon was rims and chains with
 * nothing pulling it). A hand cart and a sled have nobody in harness, and a boat has no hooves to put anywhere.
 */
export const hasHooves = (kind) => kind === 'mount' || hasTeam(kind);
/** The hooves held under a mount or a team at this pace; null for a kind with no horse about it. */
export function hoofFile(kind, pace = 'walk', seed = '') {
  if (!hasHooves(kind)) return null;
  return pick(HOOF_SOUNDS[pace] ?? HOOF_SOUNDS.walk, seed, `hoof:${pace}`);
}
// A gallop carries further than a walk, as it does in a field.
const HOOF_VOLUME = { walk: 0.26, trot: 0.3, gallop: 0.34 };
// A team in the shafts is heard under its own wagon: the rims and the chains are nearer the listener than the horses
// are, so the hooves sit below them rather than fighting them for the front.
const TEAM_GAIN = 0.7;
/**
 * How loud the hooves run and at what pitch (pure). They fade in with the horse rather than switching on, and the
 * recording is left at its own pace: the only pitch move is a couple of percent by seed, so two horses abreast do not
 * fall into step with each other.
 */
export function hoofShape({ speed = 0, pace = 'walk', seed = '', kind = 'mount' } = {}) {
  const s = Math.max(0, Number(speed) || 0);
  if (s < 0.05) return { volume: 0, rate: 1 };
  const under = kind === 'mount' ? 1 : TEAM_GAIN;
  const volume = Math.min(1, (HOOF_VOLUME[pace] ?? HOOF_VOLUME.walk) * under * Math.min(1, s / 1.1));
  let h = 2166136261;
  const text = `hoof:${seed}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return { volume: +volume.toFixed(3), rate: +(0.97 + (Math.abs(h) % 7) / 100).toFixed(3) };
}

// What a carrier says while it is standing still. Only a boat has anything: it sits on water, and water slaps a hull
// whether or not anyone is rowing. Everything else is simply quiet, which is why this is its own small thing rather
// than another entry in ROLL_SOUNDS.
export const IDLE_SOUNDS = Object.freeze({
  boat: of('lap-637945-a', 'lap-637945-b', 'lap-843242-a', 'lap-843242-b'),
});
const SURFACE = { stone: 'dirt', dirt: 'dirt', grass: 'dirt', sand: 'dirt', mud: 'dirt', pebbles: 'dirt', lava: 'dirt', metal: 'wood', wood: 'wood', snow: 'snow', ice: 'snow' };
/** Which set of rims a floor calls for; null for one nothing rolls on (a wagon on water is not rolling). */
export const rollSurface = (floor) => (floor === 'water' ? null : SURFACE[floor] ?? 'dirt');

// The one-offs.
export const KNOCK_SOUNDS = Object.freeze({
  creak: of('creak-218163-a', 'creak-218163-b'),
  harness: of('harness-124399-a', 'harness-637356-a', 'harness-637356-b'),
  load: of('load-721414-a'),
  brake: of('brake-146805'),
  canvas: of('canvas-428336', 'canvas-428337', 'canvas-870602-b'),
  // The boat's two: its timbers working when it is shoved about, and the hull knocking on whatever stopped it.
  hull: of('hull-31574-a', 'hull-31574-b'),
  bump: of('bump-637206-a', 'bump-637206-b'),
});

// The stroke of the oars. Like the harness it goes with the pace rather than with a jolt, so it has its own list.
export const OAR_SOUNDS = of('oar-525030-a', 'oar-525030-b');

// A horse waiting in the shafts calls now and then (Roi: "can he sometime raise his head and neigh from time to
// time?"). It is the animal voice the module already ships and licenses for a horse, not a vehicle clip, so it is
// named on its own and is not one of carrierSoundFiles().
export const TEAM_CALL = 'modules/animater/assets/sounds/wildlife/farm/horse-0863-0.ogg';
// How long between one call and the next, in milliseconds: long enough that a wagon parked in a market square is not
// a nuisance, and never the same gap twice running.
export function callGap(seed = '', n = 0) {
  let h = 2166136261;
  const text = `call:${seed}:${n}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 26000 + (Math.abs(h) % 34000);
}
/**
 * The team calling once (pure): only a kind with something in harness, only while it is standing, and only with its
 * head up — a horse with its nose in the grass does not neigh. Each one a little different in pitch, so the same
 * recording does not wear out.
 */
/** Whether a kind has a horse about it at all: one in the shafts, or one that is itself the carrier. */
export const hasHorse = (kind) => hasTeam(kind) || kind === 'mount';
export function teamCall({ kind = 'wagon', standing = true, headUp = true, seed = '', n = 0 } = {}) {
  if (!hasHorse(kind) || !standing || !headUp) return null;
  let h = 2166136261;
  const text = `pitch:${seed}:${n}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return { kind: 'call', file: TEAM_CALL, volume: 0.22, rate: +(0.92 + (Math.abs(h) % 17) / 100).toFixed(3) };
}

// Which of the one-offs each kind of carrier owns. Every carrier was creaking its axle and jingling a harness it has not
// got: a rowing boat has no axle, a sled runs on runners, and a token merely told to carry (a palanquin, a giant's hand)
// has none of it. Only a wagon has a team in the shafts, and only a wagon has a brake to put on or a canvas to pull at.
const KNOCKS_BY_KIND = Object.freeze({
  wagon: Object.freeze(['creak', 'load', 'brake', 'canvas']),
  cart: Object.freeze(['creak', 'load']),
  sled: Object.freeze(['load']),
  boat: Object.freeze(['hull', 'bump']),
  mount: Object.freeze([]),
  party: Object.freeze([]),
});
/** Which one-offs a kind of carrier can make at all. */
export const knocksOf = (kind) => KNOCKS_BY_KIND[kind] ?? [];
/** Whether a kind has anything in harness, so its chains ring with the pace. */
export const hasTeam = (kind) => kind === 'wagon';
/** Whether a kind is rowed, so a stroke goes with the pace the way a harness does. */
export const isRowed = (kind) => kind === 'boat';

// A steady choice for one carrier, so a wagon keeps the same voice all the way down the road rather than changing files
// under the listener.
function pick(list, seed, salt = '') {
  if (!list?.length) return null;
  let h = 2166136261;
  const text = `${seed}:${salt}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return list[Math.abs(h) % list.length];
}

/**
 * The rolling sound a carrier holds under it: its kind decides the set (a hand cart has its own, lighter one), the
 * floor decides which surface, and the carrier's own id decides which recording of that surface. null when nothing is
 * rolling — a boat, or a wagon on water.
 */
export function rollFile(kind, floor, seed = '') {
  // A boat's wash is what it is afloat on, so a boat that is somehow on dry land makes none of it.
  if (kind === 'boat') return floor === 'water' ? pick(ROLL_SOUNDS.wash, seed, 'wash') : null;
  if (kind === 'cart') return pick(ROLL_SOUNDS.barrow, seed, 'barrow');
  if (kind !== 'wagon' && kind !== 'sled') return null;
  const surface = rollSurface(floor);
  if (!surface) return null;
  // A sled has no rims: on anything but snow it is being dragged, which is the snow recording slowed down.
  if (kind === 'sled') return pick(ROLL_SOUNDS.snow, seed, 'sled');
  return pick(ROLL_SOUNDS[surface], seed, surface);
}

/**
 * How loud and how fast the rolling sound runs (pure). `speed` in grid squares a second — a walking team makes about
 * one and a half. It fades in from nothing rather than switching on, so a wagon easing away does not thump into full
 * volume; `load` (0 to 1) makes it heavier and a shade slower; `rough` ground makes it louder.
 */
export function rollShape({ speed = 0, load = 0, rough = 0.5, kind = 'wagon' } = {}) {
  const s = Math.max(0, Number(speed) || 0);
  if (s < 0.05) return { volume: 0, rate: 1 };
  const reach = Math.min(1, s / 1.4);
  const laden = 1 + 0.25 * Math.min(1, Math.max(0, load));
  const base = kind === 'cart' ? 0.22 : kind === 'sled' ? 0.26 : kind === 'boat' ? 0.3 : 0.34;
  const volume = Math.min(1, base * reach * (0.75 + 0.5 * Math.min(1, Math.max(0, rough))) * laden);
  // It rolls faster as it goes faster, but a recording stretched far off its own pace stops sounding like wood and iron.
  const rate = Math.min(1.45, Math.max(0.6, (0.72 + s * 0.28) / laden));
  return { volume: +volume.toFixed(3), rate: +rate.toFixed(3) };
}

// How often the harness and the trace chains speak: with the pace, so a faster team jingles more often, and never so
// often that it becomes a rattle.
export function jingleGap(speed = 0) {
  const s = Math.max(0.15, Number(speed) || 0);
  return Math.round(Math.min(2600, Math.max(620, 1500 / s)));
}

/**
 * The idle voice a carrier holds while it is standing (pure): a boat sits on water and the water slaps its hull. It is
 * the opposite of the rolling sound — loudest at rest, gone the moment the thing is properly under way, and the two
 * cross over so nothing switches on or off under the listener. null for a kind with nothing to say standing still, and
 * for a boat that is not on water.
 */
export function lapFile(kind, floor, seed = '') {
  if (kind === 'boat' && floor !== 'water') return null;
  return pick(IDLE_SOUNDS[kind], seed, 'idle');
}
// Where the lapping has faded out entirely, in grid squares a second: by a walking pace the wash has it.
const IDLE_GONE = 0.8;
export function lapShape({ speed = 0, kind = 'boat' } = {}) {
  const s = Math.max(0, Number(speed) || 0);
  const away = Math.min(1, s / IDLE_GONE);
  const base = kind === 'boat' ? 0.22 : 0.18;
  return { volume: +(base * (1 - away) ** 1.3).toFixed(3), rate: 1 };
}

// How often the oars go in. A rowing stroke is a slower thing than a chain's jingle and it is what is driving the
// boat, so it comes round faster as the boat goes faster and never turns into paddling.
export function strokeGap(speed = 0) {
  const s = Math.max(0.15, Number(speed) || 0);
  return Math.round(Math.min(3200, Math.max(1100, 2300 / s)));
}

/** How long to wait before the next of whatever this kind does with the pace; null for a kind that does nothing. */
export function paceGap(kind, speed = 0) {
  if (hasTeam(kind)) return jingleGap(speed);
  if (isRowed(kind)) return strokeGap(speed);
  return null;
}

/**
 * What this kind does with the pace, once (pure): a wagon's team jingles in the shafts, a boat's oars go in and pull.
 * null for a carrier that is neither drawn nor rowed.
 */
export function paceVoice({ kind = 'wagon', speed = 0, seed = '', n = 0 } = {}) {
  if (hasTeam(kind)) return jingle({ kind, speed, seed, n });
  if (!isRowed(kind)) return null;
  const file = pick(OAR_SOUNDS, seed, `oar:${n}`);
  if (!file) return null;
  const s = Math.max(0, Number(speed) || 0);
  // A harder pull is a louder one, but an oar is never the loudest thing on the water.
  return { kind: 'oar', file, volume: +Math.min(1, 0.1 + 0.09 * Math.min(1, s / 1.2)).toFixed(3), rate: +Math.min(1.15, 0.92 + s * 0.06).toFixed(3) };
}

/**
 * What fires at this moment, as a list of { kind, file, volume, rate } (pure). A wheel dropping creaks the axle and, if
 * there is anything aboard, shifts the load; stopping short puts the brake on; a covered wagon's canvas speaks when the
 * body swings hardest. `jolt` is bodyRide's, 0 to 1; `swing` how far the body is over, 0 to 1. `kind` says which of
 * these the carrier owns at all — a boat has no axle to creak and no brake to stand on.
 */
export function knocksFor({ jolt = 0, stopping = false, covered = false, load = 0, swing = 0, seed = '', n = 0, kind = 'wagon' } = {}) {
  const out = [], owns = knocksOf(kind);
  const add = (what, volume, rate = 1) => {
    if (!owns.includes(what)) return;
    const file = pick(KNOCK_SOUNDS[what], seed, `${what}:${n}`);
    if (file) out.push({ kind: what, file, volume: +Math.min(1, volume).toFixed(3), rate: +rate.toFixed(3) });
  };
  if (jolt > 0.25) {
    add('creak', 0.1 + 0.22 * jolt, 0.9 + jolt * 0.2);
    // A boat has no axle; what works when it is shoved about is the hull itself.
    add('hull', 0.09 + 0.2 * jolt, 0.92 + jolt * 0.16);
    // Only a laden wagon has anything to shift, and the harder the drop the more of it moves.
    if (load > 0.1 && jolt > 0.5) add('load', 0.08 + 0.2 * jolt * load, 0.95);
  }
  if (stopping) { add('brake', 0.3, 1); add('bump', 0.26, 1); }
  if (covered && swing > 0.8) add('canvas', 0.07 + 0.08 * swing, 0.95);
  return out;
}

/**
 * The harness and the trace chains speaking once (pure): what a team in the shafts does with the pace, so it is its own
 * thing rather than something a jolt brings on. Only a drawn carrier has a team — a hand cart and a sled have nobody in
 * harness — so the caller asks for it only for those.
 */
export function jingle({ speed = 0, seed = '', n = 0, kind = 'wagon' } = {}) {
  if (!hasTeam(kind)) return null;
  const file = pick(KNOCK_SOUNDS.harness, seed, `harness:${n}`);
  if (!file) return null;
  const s = Math.max(0, Number(speed) || 0);
  return { kind: 'harness', file, volume: +Math.min(1, 0.07 + 0.05 * Math.min(1, s / 1.4)).toFixed(3), rate: +Math.min(1.2, 0.9 + s * 0.08).toFixed(3) };
}

/** Every file this engine can ask for, so they can be preloaded with the rest. */
export const carrierSoundFiles = () => [
  ...Object.values(ROLL_SOUNDS).flat(), ...Object.values(IDLE_SOUNDS).flat(),
  ...Object.values(KNOCK_SOUNDS).flat(), ...Object.values(HOOF_SOUNDS).flat(), ...OAR_SOUNDS,
];

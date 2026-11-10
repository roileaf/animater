// Fires heard (assets/sounds/places/fire, its License.txt): the few fires nearest a listener (a torch, a lantern, a
// brazier, a campfire, a cooking pot), each its own loop of its kind, at its own pitch, started at its own place, as loud
// as the listener is near it. A lantern plays a torch's loop, quieter; a cooking pot bubbles over a small fire, so it
// also sounds as a quiet brazier.

const DIR = 'modules/animater/assets/sounds/places/fire';
const files = (kind, ids) => ids.map((id) => `${DIR}/fire-${kind}-${id}-0.ogg`);
// Two long torch loops: a third, nine seconds long, was heard over and over when a torch was held a while.
const TORCH = files('torch', [483692, 813328]);
export const FIRE_SOUNDS = Object.freeze({
  torch: TORCH,
  lantern: TORCH,
  brazier: files('brazier', [484338, 346321, 501417]),
  bonfire: files('campfire', [637523, 729396, 588401, 563764]),
  pot: files('pot', [415893, 451287, 456382, 137229]),
});
export const FIRE_VOICES = Object.freeze(['torch', 'lantern', 'brazier', 'bonfire', 'pot']);
// How far each carries (squares) and how loud it is beside it: a campfire roars furthest, a lantern hardly at all.
export const FIRE_REACH = Object.freeze({ torch: 4, lantern: 2.5, brazier: 6, bonfire: 9, pot: 5 });
export const FIRE_VOLUME = Object.freeze({ torch: 0.22, lantern: 0.1, brazier: 0.3, bonfire: 0.4, pot: 0.26 });
// What a cooking pot's fire adds to the brazier's voice (a share of a brazier's own).
export const POT_FIRE = 0.5;

// Which voice a light plays (pure): its fire kind (Light configuration → Animater → Fire), a torch by default.
export const fireVoiceOf = (kind) => (FIRE_VOICES.includes(kind) ? kind : 'torch');

// How many fires are heard at once, the nearest: each its own loop, so a hall of torches is several torches, not one.
export const FIRES_HEARD = 4;
// How far a fire's pitch and pace may stray from the recording (±), so two fires on the same loop never sound the same.
export const FIRE_PITCH = 0.07;

// A number 0-1 from a text (pure, the same each time): a fire's own, from its key.
// (Mixed at the end, so keys a letter apart land far apart.)
const shareOf = (text, salt = '') => {
  let h = 2166136261; for (const c of `${salt}${text}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// What a fire sounds like (pure), always the same for the same fire (`key`, its light or token): which of its kind's
// recordings it plays and at what pitch and pace (1 as recorded). Each `turn` it moves on to the next of its kind's
// recordings, so a fire burning a long while goes from one to another instead of one loop over and over.
export const fireVoiceFor = (key, voice, turn = 0) => {
  const list = FIRE_SOUNDS[voice] ?? FIRE_SOUNDS.torch;
  const first = Math.floor(shareOf(key, voice) * list.length) % list.length;
  return { file: list[(first + Math.max(0, Math.floor(Number(turn) || 0))) % list.length], rate: 1 + (shareOf(key, 'pitch') * 2 - 1) * FIRE_PITCH };
};

// How long (seconds) the crossfade from one recording into the next takes.
export const FIRE_CROSSFADE = 3;
// When to begin crossfading into the next recording (pure): seconds after a recording `length` s long starts playing at
// `offset` s, at `rate`, so the next has faded in as it reaches its end. Null when its length is not known (it just loops).
export const fireNextIn = (length, offset = 0, rate = 1, fade = FIRE_CROSSFADE) => {
  const len = Number(length);
  if (!(len > 0)) return null;
  const left = Math.max(0, len - Math.max(0, Number(offset) || 0)) / (Number(rate) > 0 ? Number(rate) : 1);
  return Math.max(fade, left - fade);
};

// The fires heard now (pure): `fires` [{ key, kind, x, y }], `ears` the listening points, `grid` px a square. The
// FIRES_HEARD loudest, each { id, voice, file, rate, level 0-1, from, at }: `from` the listener nearest it, `at` the
// fire, for what stands between. A cooking pot is two: its bubbling, and its fire as a quiet brazier.
export function firesHeard(fires = [], ears = [], { grid = 100, most = FIRES_HEARD } = {}) {
  const out = [];
  const hear = (fire, voice, weight, id) => {
    const reach = FIRE_REACH[voice] * grid;
    let best = { level: 0, from: null };
    for (const ear of ears) {
      const k = weight * Math.max(0, 1 - Math.hypot(ear.x - fire.x, ear.y - fire.y) / reach) ** 2;
      if (k > best.level) best = { level: k, from: ear };
    }
    if (best.level > 0) out.push({ id, voice, ...fireVoiceFor(id, voice), ...best, at: { x: fire.x, y: fire.y } });
  };
  for (const fire of fires) {
    const voice = fireVoiceOf(fire.kind), key = String(fire.key ?? `${fire.x},${fire.y}`);
    hear(fire, voice, 1, key);
    if (voice === 'pot') hear(fire, 'brazier', POT_FIRE, `${key}:fire`);
  }
  return out.sort((a, b) => b.level * FIRE_VOLUME[b.voice] - a.level * FIRE_VOLUME[a.voice]).slice(0, most);
}

// Where a loop starts (pure): anywhere in its `length` seconds, so fires lit together don't crackle in step; its
// beginning when the length is not known.
export const fireStart = (length, random = Math.random) => Math.max(0, Number(length) || 0) * random();

// Whether a placed light sounds (pure): its own choice (Light configuration → Animater → Sound), else whether it burns.
export const soundsLight = (flags = {}, burns = false) => {
  const v = flags?.fireSound;
  return v === true || v === 'true' ? true : v === false || v === 'false' ? false : !!burns;
};

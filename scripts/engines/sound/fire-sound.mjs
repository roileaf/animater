// Fires heard (assets/sounds/places/fire, its License.txt): a loop for each kind of fire on the map (a torch, a lantern, a
// brazier, a campfire, a cooking pot), as loud as the nearest listener is near the nearest fire of that kind. A lantern
// plays a torch's loop, quieter; a cooking pot bubbles over a small fire, so it also sounds as a quiet brazier.

const DIR = 'modules/animater/assets/sounds/places/fire';
const files = (kind, ids) => ids.map((id) => `${DIR}/fire-${kind}-${id}-0.ogg`);
const TORCH = files('torch', [483692, 497195, 813328]);
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

// How much of each kind is heard (pure): `fires` [{ kind, x, y }], `ears` the listening points, `grid` px a square.
// { torch: { level 0-1, from, at }, ... }: `from` the listener nearest it, `at` that fire, for what stands between.
export function fireHeard(fires = [], ears = [], { grid = 100 } = {}) {
  const out = Object.fromEntries(FIRE_VOICES.map((k) => [k, { level: 0, from: null, at: null }]));
  const hear = (voice, fire, weight) => {
    const reach = FIRE_REACH[voice] * grid, now = out[voice];
    for (const ear of ears) {
      const k = weight * Math.max(0, 1 - Math.hypot(ear.x - fire.x, ear.y - fire.y) / reach) ** 2;
      if (k > now.level) { now.level = k; now.from = ear; now.at = { x: fire.x, y: fire.y }; }
    }
  };
  for (const fire of fires) {
    const voice = fireVoiceOf(fire.kind);
    hear(voice, fire, 1);
    if (voice === 'pot') hear('brazier', fire, POT_FIRE);
  }
  return out;
}

// One recording for a scene (pure), the same on every visit: `seed` its id.
export function fireFile(voice, seed = '') {
  const list = FIRE_SOUNDS[voice]; if (!list?.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// Whether a placed light sounds (pure): its own choice (Light configuration → Animater → Sound), else whether it burns.
export const soundsLight = (flags = {}, burns = false) => {
  const v = flags?.fireSound;
  return v === true || v === 'true' ? true : v === false || v === 'false' ? false : !!burns;
};

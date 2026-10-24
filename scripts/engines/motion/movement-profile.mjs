import { GAITS, BODIES, creatureGait, creatureBody, creatureFlight } from './creature-gait.mjs';

const gain = (value, fallback = 1) => {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : fallback;
};
// Token flags are optional overrides; absent/invalid values always retain automatic classification.
export function movementSoundMix(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    silent: raw.silent === true || raw.silent === 'true',
    gait: GAITS.includes(raw.gait) ? raw.gait : '',
    body: [...BODIES, 'none'].includes(raw.body) ? raw.body : '',
    flight: ['wing', 'flight'].includes(raw.flight) ? raw.flight : '',
    contact: gain(raw.contact), weight: gain(raw.weight), tremor: gain(raw.tremor),
    pitch: Math.max(0.5, gain(raw.pitch)),
  };
}
export function resolveMovementSound(input = {}, raw = {}) {
  const sound = movementSoundMix(raw);
  const body = sound.body === 'none' ? null : sound.body || creatureBody(input);
  return { sound, gait: sound.gait || creatureGait(input),
    body, flight: sound.flight || (['air', 'fire', 'water'].includes(body) ? 'flight' : creatureFlight(input)) };
}
// A recording's reference size is independent of the moving creature's weight. Horse clops already depict Large.
export const movementContactWeight = (gait, weight) => Math.max(0, weight - (gait === 'hooves' ? 1 : 0));

// A preview owns its sounds and timers; closing/restarting cancels delayed layers as well as the next steps.
export function createMovementPreview({ playStep, stopTremor = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let session = null;
  const stop = () => {
    if (!session) return;
    session.active = false;
    for (const timer of session.timers) clearTimer(timer);
    for (const sound of session.sounds) { try { sound.stop?.(); } catch { /* already ended */ } }
    stopTremor(session.id);
    session = null;
  };
  const start = ({ gap = 700, count = 4, ...options } = {}) => {
    stop();
    const current = session = { id: Symbol('movement-preview'), active: true, step: 0, timers: new Set(), sounds: new Set() };
    for (let n = 0; n < count; n++) {
      const fire = () => { if (current.active) playStep({ ...options, preview: current }); };
      if (!n) fire();
      else { const timer = setTimer(() => { current.timers.delete(timer); fire(); }, n * gap); current.timers.add(timer); }
    }
    return current;
  };
  return { start, stop };
}

// A surface cue and the weapon's own sound start together, but each recording reaches its hit at its own moment:
// a plate clang at once, a crunch a third of a second in, a blade strike after its swish. Once the sounds are
// loaded, each cue moves so its loudest moment lands clearly after the weapon's: 70 ms (plus the cue's own 0-30 ms
// jitter), past the point where two hits blur into one, so the blow lands and then the body or armour answers;
// and its layers (blood, a flame burst...) move with it.
import { meleeClip, meleeHit } from "../../systems/outcome.mjs";
const LAG = 70, WINDOW = 0.005;
// The loudest 5 ms of a decoded sound, in ms from its start.
export function peakOf(buffer) {
  const data = buffer?.getChannelData?.(0), rate = buffer?.sampleRate;
  if (!data?.length || !(rate > 0)) return null;
  const w = Math.max(1, Math.round(rate * WINDOW));
  let best = -1, at = 0;
  for (let i = 0; i + w <= data.length; i += w) {
    let sum = 0;
    for (let j = i; j < i + w; j++) sum += data[j] * data[j];
    if (sum > best) { best = sum; at = i; }
  }
  return Math.round((at / rate) * 1000);
}
const sameTarget = (a, b) => a === b || (a?.id ?? a?.document?.id) === (b?.id ?? b?.document?.id);
// A JB2A melee swing winds up before it connects: a sound tied to the swing lands where the weapon reaches the
// target in the clip (the same moment a miss is dodged at, outcome.mjs meleeHit), not where the clip starts. A
// shot's or throw's impact sound lands as it arrives, not when its recording's thunk comes.
const WEAPON_SOUND = /^audio-.+-(melee|ranged|thrown)-/;
function alignSwings(out, peakMs) {
  for (const sound of out.filter((s) => s.kind === "sound" && !s.surfaceRole && s.afterStage)) {
    const anchor = out.find((s) => s.stageId === sound.afterStage && s.kind === "impact"), key = anchor && (anchor.asset ?? anchor.assets?.[0]);
    // A weapon's impact sound where its shot or throw arrives (not a spell's, which builds to its own boom).
    const arrival = anchor && !meleeClip(key) && WEAPON_SOUND.test(sound.stageId ?? "");
    const peak = anchor && (meleeClip(key) || arrival) && peakMs(sound.soundFile);
    if (!Number.isFinite(peak) || Math.abs(sound.delay - anchor.delay) > 30) continue;
    const at = anchor.delay + (arrival ? 0 : anchor.duration * meleeHit(key)) - peak / (sound.pitch > 0 ? sound.pitch : 1);
    sound.swingShift = Math.round(Math.max(0, at) - sound.delay);
    sound.delay += sound.swingShift;
  }
}
// The plan with each weapon sound and surface cue retimed; peakMs(file) is the loudest moment of a loaded file, or null.
export function alignSurfaceHits(plan, peakMs) {
  if (!peakMs) return plan;
  const out = plan.map((s) => ({ ...s }));
  alignSwings(out, peakMs);
  for (const cue of out.filter((s) => s.surfaceRole === "cue")) {
    const base = cue.delay - (cue.surfaceJitter ?? 0);
    // The weapon's own sound for the same blow: tied to the same stage (it may have moved to the swing's
    // contact), else a sound of this attack starting at the blow.
    const near = (s) => Math.abs(s.delay - (s.swingShift ?? 0) - base);
    const weapon = out.filter((s) => s.kind === "sound" && !s.surfaceRole && (s.subject === "source" || sameTarget(s.destination, cue.destination)) && (cue.afterStage ? s.afterStage === cue.afterStage : true) && near(s) <= 30)
      .sort((a, b) => near(a) - near(b))[0];
    const weaponPeak = weapon && peakMs(weapon.soundFile), cuePeak = peakMs(cue.soundFile);
    if (!Number.isFinite(weaponPeak) || !Number.isFinite(cuePeak)) continue;
    const at = weapon.delay + weaponPeak / (weapon.pitch > 0 ? weapon.pitch : 1) + LAG + (cue.surfaceJitter ?? 0) - cuePeak / (cue.pitch > 0 ? cue.pitch : 1);
    const start = cue.delay, landed = Math.max(0, at) + cuePeak / (cue.pitch > 0 ? cue.pitch : 1);
    cue.delay = Math.round(Math.max(0, at));
    // Its layers (blood, a flame burst...) keep their delay after the cue's hit, each by its own loudest moment.
    for (const s of out) if (s.surfaceRole && s.surfaceRole !== "cue" && s.stageId.startsWith(`${cue.stageId}-`) && sameTarget(s.destination, cue.destination)) {
      const layerPeak = peakMs(s.soundFile);
      s.delay = Math.round(Number.isFinite(layerPeak) ? Math.max(cue.delay, landed + (s.delay - start) - layerPeak / (s.pitch > 0 ? s.pitch : 1)) : Math.max(0, s.delay + cue.delay - start));
    }
  }
  return out;
}

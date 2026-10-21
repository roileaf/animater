// A surface cue and the weapon's own sound start together, but each recording reaches its hit at its own moment:
// a plate clang at once, a crunch a third of a second in, a blade strike after its swish. Once the sounds are
// loaded, each cue moves so its loudest moment lands clearly after the weapon's: 70 ms (plus the cue's own 0-30 ms
// jitter), past the point where two hits blur into one, so the blow lands and then the body or armour answers;
// and its layers (blood, a flame burst...) move with it.
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
// The plan with each surface cue retimed; peakMs(file) is the loudest moment of a loaded file, or null.
export function alignSurfaceHits(plan, peakMs) {
  if (!peakMs) return plan;
  const out = plan.map((s) => ({ ...s }));
  for (const cue of out.filter((s) => s.surfaceRole === "cue")) {
    const base = cue.delay - (cue.surfaceJitter ?? 0);
    // The weapon's own sound landing with it: a sound of this attack, not a surface one, starting at the blow.
    const weapon = out.filter((s) => s.kind === "sound" && !s.surfaceRole && Math.abs(s.delay - base) <= 30 && (s.subject === "source" || sameTarget(s.destination, cue.destination)))
      .sort((a, b) => Math.abs(a.delay - base) - Math.abs(b.delay - base))[0];
    const weaponPeak = weapon && peakMs(weapon.soundFile), cuePeak = peakMs(cue.soundFile);
    if (!Number.isFinite(weaponPeak) || !Number.isFinite(cuePeak)) continue;
    const at = weapon.delay + weaponPeak / (weapon.pitch > 0 ? weapon.pitch : 1) + LAG + (cue.surfaceJitter ?? 0) - cuePeak / (cue.pitch > 0 ? cue.pitch : 1);
    const shift = Math.round(Math.max(0, at) - cue.delay);
    if (!shift) continue;
    for (const s of out) if (s === cue || (s.surfaceRole && s.surfaceRole !== "cue" && s.stageId.startsWith(`${cue.stageId}-`) && sameTarget(s.destination, cue.destination))) s.delay = Math.max(0, s.delay + shift);
  }
  return out;
}

import {
  SOUND_SOURCE,
  SOUND_PROFILES,
  SPELL_SOUND_DESIGNS,
} from "../../../data/spell-sounds.mjs";
import { validateSoundFile } from "../../core/stage-options.mjs";
import { timedStages } from "../playback/composition.mjs";
import { ABILITY_SOUND_PROFILES } from "../../../data/ability-sounds.mjs";
import { MAX_STAGES } from "../../core/model.mjs";
import { repeatStride } from "../../core/stage-options.mjs";
export { SOUND_SOURCE, SOUND_PROFILES, SPELL_SOUND_DESIGNS };
const fileValues = (value) =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(fileValues)
      : Object.values(value ?? {}).flatMap(fileValues);
const valid = (file) => {
  try {
    validateSoundFile(file);
    return true;
  } catch {
    return false;
  }
};
const seed = (text) =>
  [...String(text)].reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0,
    0,
  );
export const soundGain = (candidate) => Number.isFinite(candidate?.gain)
  ? Math.max(.05, Math.min(1, candidate.gain)) : 1;
export const automaticCueVolume = (userVolume, candidate) =>
  Math.max(0, Math.min(1, Number(userVolume) || 0)) * soundGain(candidate);
// These installed PSFX recordings begin with silence before their release.
// Decode evidence confirms the 300-570ms window contains each variant's attack.
const cueOpening = (profile, file) => profile === "forceMissile" &&
  /(?:^|\/)magic-missile-001-\d+ft\.ogg$/i.test(String(file)) ? 300 : 0;
const resolvedOptionalCue = (stage, candidate) => {
  const opening = cueOpening(stage.optionalSound.profile, candidate.file);
  const clipStart = Math.max(0, Number(stage.clipStart ?? 0) -
    Number(stage.optionalSound.clipStart ?? 0) + opening);
  const nativeDuration = candidate.nativeDuration ?? candidate.duration;
  const result = {
    ...stage,
    soundFile: candidate.file,
    duration: Math.min(stage.duration, candidate.duration, Math.max(100, nativeDuration - clipStart)),
    clipStart,
    volume: Math.max(0, Math.min(1, stage.volume / soundGain(stage.optionalSound) * soundGain(candidate))),
    optionalSound: { ...stage.optionalSound, gain: soundGain(candidate), clipStart: opening },
  };
  delete result.skipSound;
  return result;
};
// Check current activation and database registration on every request. Cached
// absence during Foundry startup must not silence a pack registered later.
// A pack's Patreon edition has its own module id but registers the same Sequencer sounds.
export const SOUND_PACK_EDITIONS = { psfx: ["psfx-patreon"] };
// Resolving every cue against Sequencer's database takes ~0.1 s, and the catalog windows
// ask for it several times per click. The answer is reused while the same packs are
// active and the database holds the same number of entries (registering a pack later
// grows it); a database that cannot say how many it holds is always asked again.
let lastCatalog = null;
export function installedSoundCatalog(modules, database) {
  const packs = SOUND_SOURCE.packs.filter(
    (p) => [p.module, ...(SOUND_PACK_EDITIONS[p.module] ?? [])].some((id) => modules?.get?.(id)?.active),
  );
  const size = database?.flattenedEntries?.length;
  const key = Number.isInteger(size) ? `${packs.map((p) => p.module).join()}|${size}` : null;
  if (key && lastCatalog?.database === database && lastCatalog.key === key) return lastCatalog.value;
  const value = resolveSoundCatalog(packs, database);
  lastCatalog = key ? { database, key, value } : null;
  return value;
}
function resolveSoundCatalog(packs, database) {
  const resolved = new Map();
  // Spell wards and physical shield impacts intentionally share a profile label,
  // not their candidates. Enumerate both namespaces instead of overwriting one.
  for (const cues of [...Object.values(SOUND_PROFILES), ...Object.values(ABILITY_SOUND_PROFILES)])
    for (const c of cues)
      for (const candidate of c.candidates) {
        if (!packs.some((p) => p.module === candidate.module)) continue;
        const id = candidate.module + ":" + candidate.file;
        if (resolved.has(id)) continue;
        let file = candidate.file;
        if (candidate.key) {
          try {
            if (!database?.entryExists?.(candidate.key)) continue;
            const files = fileValues(
              database.getAllFileEntries?.(candidate.key),
            ).filter(valid);
            const basename = candidate.file.split("/").at(-1);
            file =
              files.find((f) => f.split("/").at(-1) === basename) ?? files[0];
            if (!file) continue;
          } catch {
            continue;
          }
        }
        if (valid(file)) resolved.set(id, { ...candidate, file });
      }
  return {
    packs,
    entries: [...resolved.values()].map(entry => ({...entry, type:'audio', source:packs.find(p=>p.module===entry.module)?.title ?? entry.module})),
    resolve: (candidate) =>
      resolved.get(candidate.module + ":" + candidate.file) ?? null,
  };
}
export function catalogSoundOptions(host) {
  const state = host.catalogState?.() ?? {};
  return {
    motion: state.motion !== false,
    sounds: state.sound === false ? null : host.soundCatalog?.(),
    soundVolume: state.soundVolume ?? 0.35,
  };
}
function candidatesFor(cue, catalog) {
  return cue.candidates
    .map((c) => ({ original: c, active: catalog?.resolve?.(c) }))
    .filter((c) => c.active);
}
export function spellSoundInfo(spell, catalog, enabled = true) {
  const design = SPELL_SOUND_DESIGNS[spell.id] ?? {
    profile: "",
    reason: "No sound design available.",
  };
  return {
    ...design,
    cues: (SOUND_PROFILES[design.profile] ?? []).map((c) => ({
      ...c,
      available: enabled ? candidatesFor(c, catalog).length : 0,
    })),
  };
}
export function addSpellSounds(
  spell,
  stages,
  { sounds, soundVolume = 0.35, design = SPELL_SOUND_DESIGNS[spell.id] } = {},
) {
  if (!sounds) return stages;
  const cues = SOUND_PROFILES[design?.profile] ?? [];
  const result = [...stages];
  for (const [i, cue] of cues.entries()) {
    if (design?.excludeRoles?.includes(cue.role)) continue;
    if (result.length >= MAX_STAGES) break;
    const choices = candidatesFor(cue, sounds);
    if (!choices.length) continue;
    // Prefer authored spell-specific PSFX over broad material cues. GGG then
    // supplies elemental/form families; filename identity preserves variants.
    const order =
      cue.role === "chain" || design?.profile === "forceMissile"
        ? ["ggg", "soundfxlibrary", "psfx", "pf2e-creature-sounds"]
        : ["psfx", "ggg", "soundfxlibrary", "pf2e-creature-sounds"];
    const best = order.find((module) =>
      choices.some((c) => c.active.module === module),
    );
    const variants = choices.filter((c) => c.active.module === best);
    const chosen = variants[seed(spell.slug + ":" + i) % variants.length];
    const travel = stages.find(
      (s) =>
        ["travel", "projectile"].includes(s.kind) ||
        (s.kind === "template" &&
          ["lineBeam", "lineFlight"].includes(spell.design?.pattern)),
    );
    if (["release", "chain"].includes(cue.role) && !travel) continue;
    const strike = cue.role === "impact" && design?.profile === "lightningBolt"
      ? stages.find((s) => /lightning strike/i.test(s.label)) : null;
    const anchor = strike ?? (
      cue.role === "cast"
        ? stages.find((s) => s.kind === "cast")
        : cue.role === "release" || cue.role === "chain"
          ? travel
          : cue.role === "impact"
            ? stages.find((s) => s.kind === "impact" || s.kind === "template")
            : stages.find((s) =>
                ["impact", "template", "aura"].includes(s.kind),
              ));
    const ref = anchor ?? stages.find((s) => s.kind === "cast") ?? stages[0];
    // A simultaneous volley shares one complete release/contact sound. Stacking
    // identical recordings multiplies volume without adding audible identity.
    const repeated = cue.role !== "chain" && !ref.repeatSimultaneous && (ref.repeats ?? 1) > 1;
    const stride = repeated ? repeatStride(ref) : 0;
    result.push({
      kind: "sound",
      stageId: `${spell.id}-sound-${i}`,
      label: cue.label,
      assets: [],
      delay: ref.delay,
      duration:
        cue.role === "chain"
          ? Math.min(550, chosen.active.duration)
          : repeated ? Math.min(chosen.active.duration, Math.max(100, stride * .9)) : chosen.active.duration,
      afterStage: ref.stageId,
      timingAnchor: "start",
      startOffset: 0,
      repeats: repeated ? ref.repeats : 1,
      repeatInterval: stride,
      repeatScope: ref.repeatScope ?? "perTarget",
      subject: cue.role === "chain" ? "targets" : "source",
      volume:
        automaticCueVolume(soundVolume, chosen.active) *
        (cue.role === "chain" ? 0.55 : cue.role === "cast" ? 0.65 : 1),
      soundFile: chosen.active.file,
      clipStart: cueOpening(design?.profile, chosen.active.file),
      fadeIn: repeated ? 10 : 30,
      fadeOut: repeated ? 60 : 180,
      optionalSound: {
        profile: design.profile,
        cue: i,
        gain: soundGain(chosen.active),
        clipStart: cueOpening(design?.profile, chosen.active.file),
        candidates: [
          chosen.original,
          ...cue.candidates.filter((c) => c !== chosen.original),
        ],
      },
    });
  }
  return result;
}
// Saved customizations retain alternatives. Disabling a dependency skips only
// that optional cue; manually chosen sound files stay independent of packs.
export function prepareRecipeSounds(recipe, catalog) {
  if (!recipe.stages.some((s) => s.optionalSound)) return recipe;
  const retained = recipe.stages.flatMap((s) => {
    if (!s.optionalSound) return [s];
    const candidate = s.optionalSound.candidates
      .map((c) => catalog?.resolve?.(c))
      .find(Boolean);
    return candidate
      ? [
          resolvedOptionalCue(s, candidate),
        ]
      : [];
  });
  const ids = new Set(retained.map((s) => s.stageId));
  let resolved;
  return {
    ...recipe,
    stages: retained.map((s) => {
      if (!s.afterStage || ids.has(s.afterStage)) return s;
      resolved ??= timedStages(recipe);
      return {
        ...s,
        afterStage: "",
        delay: resolved.find((p) => p.stageId === s.stageId).delay,
      };
    }),
  };
}
// Keep editor stage indices stable for highlights and editing. Unavailable
// optional audio has no media element; its configured timing remains inspectable.
export function previewRecipeSounds(recipe, catalog) {
  return {
    ...recipe,
    stages: recipe.stages.map((s) => {
      if (!s.optionalSound) return s;
      const candidate = s.optionalSound.candidates
        .map((c) => catalog?.resolve?.(c))
        .find(Boolean);
      return candidate
        ? resolvedOptionalCue(s, candidate)
        : { ...s, skipSound: true };
    }),
  };
}

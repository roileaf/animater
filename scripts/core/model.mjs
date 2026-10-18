import { normalizeKeyframes } from "../engines/motion/keyframe-path.mjs";
import { normalizeFragments } from "../engines/fragments/fragments.mjs";
import { normalizeOptions, validateSoundFile, EASES } from "./stage-options.mjs";
import { fallbackColorParity } from "../engines/playback/color-parity.mjs";
import { OPTIONAL_FX_KINDS, normalizeFxStage } from '../engines/playback/optional-fx.mjs';
import { visualReference, safeMediaFile, mediaType } from '../engines/media/media-library-model.mjs';
import { coneFanPoints } from "../engines/playback/cone-fan.mjs";
import { normalizePreviewArea } from "../engines/preview/canvas-preview-area.mjs";
import { repeatStride } from "./stage-options.mjs";
import { completeMediaStage } from "../engines/media/media-lifetime.mjs";
import { normalizePlaybackRoles } from "./playback-roles.mjs";
import { isPathMotion, PATH_MOTIONS, HOLDING_MOTIONS } from "../engines/motion/motion-path.mjs";
import { meleeClip } from "../systems/outcome.mjs";
import {
  compositionOptions,
  timedStages,
  targetDistance,
  centerOf,
} from "../engines/playback/composition.mjs";
export const ID = "animater";
export const MAX_STAGES = 16;
export const EVENTS = {
  manual: "Manual only",
  use: "Item used / sent to chat",
  attack: "Attack rolled",
  damage: "Damage rolled",
  template: "Area placed",
  effect: "Effect added",
};
export const STRIKE_SCOPES = { melee: 'All melee strikes', ranged: 'All ranged strikes' };
// Finishers: recipes that play on the real token for assigned items (scripts/engines/finishers/finisher-model.mjs).
export const FINISHER_ON = { kill: "Killing blow", use: "Every successful use", critical: "Critical hit", criticalOrKill: "Critical hit or killing blow" };
export const FINISHER_ENDINGS = { vanish: "Vanish (fade, then hidden)", body: "Body (stays, Defeated)", stay: "Stay" };
export const FINISHER_SUCCESS = { success: "Any success", critical: "Only on a critical" };
export const FINISHER_WALLS = { fit: "Stop short smoothly", slam: "Slam into it" };
export function normalizeFinisher(input = {}) {
  const pick = (table, value, fallback) => (Object.hasOwn(table, value) ? value : fallback);
  const knockback = Number(input.knockback);
  return {
    on: pick(FINISHER_ON, input.on, "kill"),
    knockback: Number.isFinite(knockback) ? Math.min(6, Math.max(0, Math.round(knockback))) : 0,
    ending: pick(FINISHER_ENDINGS, input.ending, "body"),
    success: pick(FINISHER_SUCCESS, input.success, "success"),
    wall: pick(FINISHER_WALLS, input.wall, "fit"),
    players: [...new Set((Array.isArray(input.players) ? input.players : []).filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()))].slice(0, 64),
    ...finisherLinks(input.links),
  };
}
// Applies-to item links, for showing and opening an item: normalized name → uuid. Matching stays by name.
function finisherLinks(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const links = {};
  for (const [name, uuid] of Object.entries(input)) {
    const key = normalize(name);
    if (!key || typeof uuid !== "string" || !uuid.trim() || Object.keys(links).length >= 50) continue;
    links[key] = uuid.trim().slice(0, 300);
  }
  return Object.keys(links).length ? { links } : {};
}
export const KINDS = {
  cast: "Source",
  travel: "Source → target",
  projectile: "Moving orb / projectile",
  impact: "Target",
  aura: "Stays on token",
  template: "Area (circle / cone / square / line)",
  motion: "Token motion",
  sprite: "Token copy / shadow",
  sound: "Sound cue",
  overlay: "Screen overlay",
  tokenfx: "Tokenshade",
  scenefx: "FXMaster scene effect",
};
export const MOTIONS = {
  rush: "Rush and hold at destination",
  leap: "Arcing leap and landing",
  roll: "Rolling approach / evasion",
  dodge: "Lateral dodge and settle",
  lunge: "Lunge toward target",
  recoil: "Recoil from source",
  shake: "Impact shake",
  spin: "Full spin",
  levitate: "Rise and settle",
  pulse: "Casting pulse",
  press: "Pressed down by force",
  sink: "Sink into the ground",
  flicker: "Flicker / phase out",
  throw: "Wind-up and throw",
  brace: "Brace / guard",
  stagger: "Stagger and recover",
  cower: "Cower in fear",
  slam: "Rise and slam down",
  drift: "Drift gently down",
  squash: "Squash on impact",
  collapse: "Collapse when dropped",
  fade: "Fade out",
  path: "Keyframed path",
  fragments: "Token fragments",
};
export const clone = (value) => structuredClone(value);
export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, " ");
export function validateRecipe(input) {
  if (!input || typeof input !== "object")
    throw Error("Recipe must be an object.");
  const text = (v, max = 200) =>
    typeof v === "string" ? v.slice(0, max).trim() : "";
  const number = (v, min, max, fallback) =>
    Number.isFinite(Number(v))
      ? Math.min(max, Math.max(min, Number(v)))
      : fallback;
  const id = text(input.id, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error("Recipe ID is invalid.");
  if (!text(input.name)) throw Error("Give this recipe a name.");
  if (!Object.hasOwn(EVENTS, input.trigger))
    throw Error("Choose a valid trigger.");
  if (
    !Array.isArray(input.stages) ||
    !input.stages.length ||
    input.stages.length > MAX_STAGES
  )
    throw Error(`Recipes need 1–${MAX_STAGES} stages.`);
  const strikeScope = Object.hasOwn(STRIKE_SCOPES, input.matchScope ?? '') && ['attack', 'damage'].includes(input.trigger) ? input.matchScope : null;
  for (const field of ['teleportOut', 'teleportIn']) {
    if (input[field] && input[field] !== 'none' && !visualReference(input[field]))
      throw Error('Teleport effect needs a database key or relative visual media file.');
  }
  if (input.teleportTint && !/^#[\da-f]{6}$/i.test(input.teleportTint))
    throw Error('Teleport tint must be a hex color such as #aa88ff, or blank.');
  const recipe = {
    id,
    name: text(input.name),
    description: text(input.description, 600),
    category: text(input.category, 40) || "Custom",
    color: /^#[\da-f]{6}$/i.test(input.color) ? input.color : "#9e8aff",
    enabled: input.enabled !== false,
    trigger: input.trigger,
    match: text(input.match, 1000),
    itemUuid: strikeScope ? '' : text(input.itemUuid, 300),
    ...(strikeScope ? { matchScope: strikeScope } : {}),
    // A flash screen shown to everyone right before this animation plays.
    ...(/^[A-Za-z0-9-]{1,40}$/.test(input.flash ?? "") ? { flash: input.flash } : {}),
    // Teleport: the caster or first target moves to a spot the one who cast clicks (see teleport.mjs).
    ...(["none", "source", "target"].includes(input.teleport) ? { teleport: input.teleport } : {}),
    ...(Number(input.teleportRange) > 0 ? { teleportRange: Math.min(5280, Math.round(Number(input.teleportRange))) } : {}),
    ...(typeof input.teleportAdjacent === "boolean" ? { teleportAdjacent: input.teleportAdjacent } : {}),
    ...(input.teleportOut ? { teleportOut: input.teleportOut } : {}),
    ...(input.teleportIn ? { teleportIn: input.teleportIn } : {}),
    ...(/^#[\da-f]{6}$/i.test(input.teleportTint ?? '') ? { teleportTint: input.teleportTint } : {}),
    ...(Number(input.teleportScale) > 0 ? { teleportScale: number(input.teleportScale, .1, 5, 1.8) } : {}),
    ...(['pf2e','sf2e','dnd5e','daggerheart'].includes(input.systemId)?{systemId:input.systemId}:/^Compendium\.(pf2e|sf2e|dnd5e|daggerheart)\./.test(input.itemUuid??'')?{systemId:input.itemUuid.split('.')[1]}:{}),
    ...(!strikeScope&&text(input.catalogEntry,100)?{catalogEntry:text(input.catalogEntry,100)}:{}),
    ...(!strikeScope&&text(input.activityId,100)?{activityId:text(input.activityId,100)}:{}),
    ...(normalizePlaybackRoles(input.playbackRoles)?{playbackRoles:normalizePlaybackRoles(input.playbackRoles)}:{}),
    ...(input.lifecycle === "document" && input.trigger === "effect"
      ? { lifecycle: "document", stateEntry: text(input.stateEntry, 100),
          ...(/^[a-z-]{1,30}$/.test(input.stateDamageType ?? "") ? {stateDamageType:input.stateDamageType} : {}) } : {}),
    ...(strikeScope ? { weaponMode: strikeScope } : ["melee", "ranged", "thrown"].includes(input.weaponMode)
      ? { weaponMode: input.weaponMode } : {}),
    // Play-time element choice (scripts/catalogs/shared/element-choice.mjs).
    ...(input.elementChoice === true ? { elementChoice: true } : {}),
    ...(text(input.bespoke, 120) ? { bespoke: text(input.bespoke, 120) } : {}),
    ...(normalizePreviewArea(input.previewArea)
      ? { previewArea: normalizePreviewArea(input.previewArea) }
      : {}),
    // A finisher never plays through normal dispatch: only its finisher triggers fire it.
    ...(input.finisher && typeof input.finisher === "object" ? { finisher: normalizeFinisher(input.finisher), trigger: "manual", category: "Finisher" } : {}),
    stages: input.stages
      .map((s, index) => {
        if (!s || !Object.hasOwn(KINDS, s.kind))
          throw Error("Unknown stage type.");
        if (input.lifecycle === "document" && input.trigger === "effect" && !['aura','tokenfx'].includes(s.kind))
          throw Error("Document-linked visuals use “Stays on token” layers or token filters.");
        if (input.lifecycle === "document" && input.trigger === "effect" && s.subject === "targets")
          throw Error("Document-linked layers follow the affected token.");
        if (s.kind === "sound") validateSoundFile(s.soundFile);
        if (
          Number(s.clipEnd) > 0 &&
          Number(s.clipEnd) <= Number(s.clipStart ?? 0)
        )
          throw Error("Clip end must be after its opening skip.");
        const assets = (OPTIONAL_FX_KINDS.has(s.kind) ? [] : Array.isArray(s.assets) ? s.assets : [])
          .filter(
            visualReference,
          )
          .slice(0, 8);
        if (!assets.length && !["motion", "sprite", "sound"].includes(s.kind) && !OPTIONAL_FX_KINDS.has(s.kind))
          throw Error("Each effect stage needs a database key or relative media file.");
        return {
          kind: s.kind,
          ...compositionOptions(
            s,
            index,
            input.stages.map((p) => p?.stageId),
          ),
          assets,
          delay: number(s.delay, 0, 30000, 0),
          duration: number(s.duration, 100, 30000, 1500),
          scale: number(s.scale, 0.1, 5, 1),
          opacity: number(s.opacity, 0.1, 1, 1),
          below: s.below === true,
          // A canvas point the effect plays at instead of on its token (a finisher's crash stays
          // where the token hit, wherever the token is drawn when it starts). Offsets still apply.
          ...(["impact", "aura"].includes(s.kind) && Number.isFinite(s.atPoint?.x) && Number.isFinite(s.atPoint?.y) ? { atPoint: { x: s.atPoint.x, y: s.atPoint.y } } : {}),
          // Random variants: stages sharing a group are alternatives, one plays each time.
          ...(/^[A-Za-z0-9-]{1,40}$/.test(s.variantGroup ?? "") ? { variantGroup: s.variantGroup } : {}),
          // Drawn over the bearer's artwork (head-level stars, strands across the body).
          ...(s.above === true && s.below !== true ? { above: true } : {}),
          // Editor start mode; the link itself lives in afterStage/timingAnchor/startOffset.
          ...(['after', 'with'].includes(s.startMode) && s.afterStage ? { startMode: s.startMode, ...(s.startRef && s.startRef === s.afterStage ? { startRef: text(s.startRef, 100) } : {}) } : {}),
          // A persistent template stage lives as long as its placed template.
          // A lasting emanation (Spirit Guardians) moves with the caster.
          ...(s.kind === "template" && s.followSource === true ? { followSource: true } : {}),
          // Condition/effect layers always last while it is on the token; elsewhere it is opt-in.
          persist: input.lifecycle === 'document' && input.trigger === 'effect' ? ['aura', 'tokenfx'].includes(s.kind) : (s.kind === "aura" || s.kind === "template") && s.persist === true,
          ...(s.kind==='aura'&&Number(s.auraRadius)>0?{auraRadius:number(s.auraRadius,0.1,240,5),auraSlug:text(s.auraSlug,100)}:{}),
          ...(s.elementTint === true ? { elementTint: true } : {}),
          // When a flight's projectile reaches its target (ms into the clip): arrival timing uses it.
          ...(Number(s.contact) > 0 ? { contact: number(s.contact, 1, 60000, 0) } : {}),
          // A chosen element's own clip length and contact (applyEventElement).
          ...(s.elementTiming && typeof s.elementTiming === "object"
            ? { elementTiming: Object.fromEntries(Object.entries(s.elementTiming)
                .filter(([k, v]) => /^[a-z]{2,15}$/.test(k) && Number(v?.duration) > 0)
                .map(([k, v]) => [k, { duration: number(v.duration, 50, 60000, 1000), ...(Number(v.contact) > 0 ? { contact: number(v.contact, 1, 60000, 0) } : {}) }])) }
            : {}),
          ...(s.elementAssets && typeof s.elementAssets === "object"
            ? { elementAssets: Object.fromEntries(Object.entries(s.elementAssets)
                .filter(([k, v]) => /^[a-z]{2,15}$/.test(k) && Array.isArray(v))
                .map(([k, v]) => [k, v.filter(visualReference).slice(0, 8)])
                .filter(([, v]) => v.length)) }
            : {}),
          ...normalizeOptions({
            ...s,
            duration: number(s.duration, 100, 30000, 1500),
          }),
          ...(OPTIONAL_FX_KINDS.has(s.kind) ? normalizeFxStage(s) : {}),
          ...(["sprite", "aura", "sound", "tokenfx"].includes(s.kind)
            ? { subject: s.subject === "targets" ? "targets" : "source" }
            : {}),
          ...(s.kind === "sound" && s.optionalSound
            ? {
                optionalSound: {
                  profile: text(s.optionalSound.profile, 50),
                  cue: number(s.optionalSound.cue, 0, 3, 0),
                  clipStart: number(s.optionalSound.clipStart, 0, 30000, 0),
                  gain: number(s.optionalSound.gain, 0.05, 1, 1),
                  candidates: (s.optionalSound.candidates ?? [])
                    .slice(0, 24)
                    .filter((c) => {
                      try {
                        validateSoundFile(c.file);
                        return [
                          "ggg",
                          "psfx",
                          "soundfxlibrary",
                          "pf2e-creature-sounds",
                        ].includes(c.module);
                      } catch {
                        return false;
                      }
                    })
                    .map((c) => ({
                      module: c.module,
                      key: text(c.key, 300),
                      file: text(c.file, 500),
                      duration: number(c.duration, 100, 30000, 1500),
                      gain: number(c.gain, 0.05, 1, 1),
                    })),
                },
              }
            : {}),
          ...(s.kind === "motion"
            ? {
                motion: MOTIONS[s.motion] ? s.motion : "lunge",
                subject: s.subject === "targets" ? "targets" : "source",
                intensity: number(s.intensity, 0.1, 3, 1),
                distance: number(
                  s.distance,
                  0.05,
                  PATH_MOTIONS.has(s.motion) ? 20 : 2,
                  PATH_MOTIONS.has(s.motion) ? 8 : 0.35,
                ),
                // Finishers: a held travel stays where it lands; an exact offset (squares) lands on a square.
                ...(HOLDING_MOTIONS.has(s.motion) && s.motionEnd === "hold" ? { motionEnd: "hold" } : {}),
                ...(["rush", "leap", "roll"].includes(s.motion) && s.motionOffset && Number.isFinite(Number(s.motionOffset.x)) && Number.isFinite(Number(s.motionOffset.y))
                  ? { motionOffset: { x: number(s.motionOffset.x, -20, 20, 0), y: number(s.motionOffset.y, -20, 20, 0) } } : {}),
                // Keyframed path: the real token's authored movement; finishers add an aim frame.
                // A framed finisher end is a rotated authored end, so it may reach 12*sqrt(2); clamping at 12 would move it off the landing.
                ...(s.motion === "fragments" ? normalizeFragments(s) : {}),
                // One ease for the whole path's progress; its keyframes are linear by default.
                ...(s.motion === "path" ? { pathEase: Object.hasOwn(EASES, s.pathEase) ? s.pathEase : "linear" } : {}),
                ...(s.motion === "path" ? { keyframes: normalizeKeyframes(s.keyframes, { limit: s.motionFrame && ["cos", "sin", "k"].every((key) => Number.isFinite(Number(s.motionFrame[key]))) ? 17 : 12 }) } : {}),
                ...(s.motion === "path" && s.motionFrame && ["cos", "sin", "k"].every((key) => Number.isFinite(Number(s.motionFrame[key])))
                  ? { motionFrame: { cos: number(s.motionFrame.cos, -1, 1, 1), sin: number(s.motionFrame.sin, -1, 1, 0), k: number(s.motionFrame.k, 0, 1, 1) } } : {}),
                ...(PATH_MOTIONS.has(s.motion)
                  ? {
                      motionRange:
                        s.motionRange === "distance" || s.motion === "dodge"
                          ? "distance"
                          : "target",
                      motionEndpoint:
                        s.motionEndpoint === "past" ? "past" : "near",
                      motionHeading:
                        ["away", "up", "down", "left", "right"].includes(s.motionHeading)
                          ? s.motionHeading
                          : "toward",
                      motionArrival: number(s.motionArrival, 15, 70, 45),
                      motionHold: number(
                        s.motionHold,
                        5,
                        90 - number(s.motionArrival, 15, 70, 45),
                        Math.min(25, 90 - number(s.motionArrival, 15, 70, 45)),
                      ),
                      jumpHeight: number(s.jumpHeight, 0, 3, 0.8),
                      arrivalLift: number(s.arrivalLift, 0, 2, 0),
                      stopGap: number(s.stopGap, 0, 2, 0.1),
                      motionSide: Number(s.motionSide) === -1 ? -1 : 1,
                    }
                  : {}),
              }
            : {}),
        };
      })
      .map(completeMediaStage),
  };
  timedStages(recipe);
  return recipe;
}
export function parseImport(text) {
  if (text.length > 1_000_000) throw Error("Import too large. Limit: 1 MB.");
  const data = JSON.parse(text);
  if (
    data.schema !== 1 ||
    !Array.isArray(data.recipes) ||
    data.recipes.length > 200
  )
    throw Error(
      "Expected Animater recipe export (schema 1, up to 200 recipes).",
    );
  const recipes = data.recipes.map(validateRecipe);
  if (new Set(recipes.map((r) => r.id)).size !== recipes.length)
    throw Error("Duplicate recipe IDs in import.");
  return recipes;
}
export function matchRecipe(recipes, event) {
  const names = new Set(
    [
      event.item?.name,
      event.item?.slug,
      event.item?.system?.slug,
      event.item?.system?.baseItem,
      event.item?.system?.group,
      event.activityName,
    ]
      .filter(Boolean)
      .map(normalize),
  );
  const uuids = [
    event.itemUuid,
    event.item?.uuid,
    event.item?.sourceId,
    event.item?.original?.uuid,
    event.item?.flags?.core?.sourceId,
    event.item?._stats?.compendiumSource,
  ];
  return (
    recipes
      .filter(
        (r) =>
          r.enabled &&
          (!r.systemId || !event.systemId || r.systemId === event.systemId) &&
          (!r.activityId || r.activityId === event.activityId) &&
          (!r.weaponMode || r.weaponMode === event.weaponMode) &&
          r.trigger === event.type &&
          (Object.hasOwn(STRIKE_SCOPES, r.matchScope ?? '')
            ? event.weaponMode === r.matchScope && ['weapon', 'melee'].includes(event.item?.type)
            : r.itemUuid
            ? uuids.includes(r.itemUuid)
            : r.match
                .split(",")
                .some((n) => n.trim() && names.has(normalize(n)))),
      )
      .sort(
        (a, b) =>
          Number(Object.hasOwn(STRIKE_SCOPES, a.matchScope ?? '')) - Number(Object.hasOwn(STRIKE_SCOPES, b.matchScope ?? '')) ||
          Number(Boolean(b.itemUuid)) - Number(Boolean(a.itemUuid)) ||
          a.id.localeCompare(b.id),
      )[0] ?? null
  );
}
// A deliberate strike-wide override also preserves more specific saved exceptions.
export function matchStrikeOverride(recipes, event) {
  return matchRecipe(recipes.filter(r => Object.hasOwn(STRIKE_SCOPES, r.matchScope ?? '')), event)
    ? matchRecipe(recipes, event) : null;
}
export function resolveAsset(stage, catalog) {
  return installedAssets(stage, catalog, 1)[0] ?? null;
}
// Every installed asset in the stage's list, in list order (the first is the one that plays,
// unless the stage picks at random).
export function installedAssets(stage, catalog, limit = Infinity) {
  if (["motion", "sprite", "sound"].includes(stage.kind)) return [];
  const index = catalog instanceof CatalogIndex ? catalog : null, keys = index ? null : catalog.map((e) => e.key), found = [];
  for (const key of stage.assets) {
    if (found.length >= limit) break;
    const hit = (index ? index.has(key) : keys.includes(key)) ? key : safeMediaFile(key) && mediaType(key) !== 'audio' ? key : index ? index.firstWithPrefix(key + ".") : keys.find((k) => k.startsWith(key + "."));
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}
// The catalog's keys prepared for many lookups (a render checks every stage of
// every recipe card): a set for exact keys, and keys sorted by code unit so a
// "key." prefix is a binary search. A prefix still resolves to its first match
// in catalog order, as the plain catalog does.
class CatalogIndex {
  constructor(catalog) {
    this.keys = new Set();
    this.order = new Map();
    catalog.forEach(({ key }, i) => { this.keys.add(key); if (!this.order.has(key)) this.order.set(key, i); });
    this.sorted = [...this.keys].sort();
  }
  has(key) { return this.keys.has(key); }
  firstWithPrefix(prefix) {
    let lo = 0, hi = this.sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.sorted[mid] < prefix) lo = mid + 1; else hi = mid; }
    let best;
    for (let i = lo; i < this.sorted.length && this.sorted[i].startsWith(prefix); i++)
      if (best === undefined || this.order.get(this.sorted[i]) < this.order.get(best)) best = this.sorted[i];
    return best;
  }
}
export const catalogIndex = (catalog) => new CatalogIndex(catalog);
export function planRecipe(recipe, catalog, context) {
  return buildPlan(recipe, catalog, context, true);
}
// Composition uses the same target routing/timing without requiring installed
// media. Missing files stay visible in the editor; canvas preflight stays strict.
export function previewPlan(recipe, context) {
  return buildPlan(recipe, [], context, false);
}
function buildPlan(recipe, catalog, context, requireMedia) {
  const plan = [];
  const landings = new Map();
  const motionTargetFor = (s) => {
    const targets=s.targetLimit>0?context.targets?.slice(0,s.targetLimit):context.targets;
    return s.targetSelection === "last"
      ? targets?.at(-1)
      : s.targetSelection === "second"
        ? targets?.[1]
        : s.targetSelection === "third"
          ? targets?.[2]
        : targets?.[0];
  };
  const stagesFor = (destination, targetIndex, origin = context.source) =>
    timedStages(
      recipe,
      targetDistance(origin, destination, context.gridSize ?? 100),
      targetIndex,
      (s) =>
        targetDistance(
          s.subject === "source" ? context.source : destination,
          s.subject === "source" ? motionTargetFor(s) : context.source,
          context.gridSize ?? 100,
        ),
    );
  for (const [index, s] of recipe.stages.entries()) {
    const o = normalizeOptions(s);
    // A fragments stage's `tint` names a fragments tint ("frozen"), not an effect colour: the
    // generic "#ffffff" default would overwrite it and the pieces would play untinted.
    if (s.kind === "motion" && s.motion === "fragments") delete o.tint;
    // A chat-card use or unknown/missed attack cannot establish this rider.
    // Editor and local canvas previews deliberately show the success branch.
    if(requireMedia && o.requiresHit && !context.preview && !['success','criticalSuccess'].includes(context.outcome))continue;
    const areaFan = ["travel", "projectile"].includes(s.kind) && s.travelDestination === "area" && o.areaLayout === "fan";
    if (areaFan && s.travelOrigin !== "source") throw Error("Cone fans travel outward from their area origin.");
    if (requireMedia && s.kind === "sound") validateSoundFile(o.soundFile);
    const asset = resolveAsset(s, catalog);
    const parity = fallbackColorParity(s, asset);
    if (
      requireMedia &&
      !asset &&
      !["motion", "sprite", "sound"].includes(s.kind) && !OPTIONAL_FX_KINDS.has(s.kind)
    )
      throw Error(
        `Stage ${index + 1}: no installed asset. Open Assets and choose a replacement.`,
      );
    let destinations =
      ["travel", "projectile"].includes(s.kind) &&
      s.travelDestination === "area"
        ? areaFan
          ? coneFanPoints(context.area, o.fanCount).map((point, i) => ({ id: `area-fan-${i}`, ...point, center: point }))
          : [context.template]
        : s.kind === "travel" ||
            s.kind === "projectile" ||
            s.kind === "impact" ||
            (["motion", "sprite", "aura", "sound", "tokenfx"].includes(s.kind) &&
              s.subject === "targets")
          ? context.targets
          : [s.kind === "template" ? context.template : context.source];
    // An area can catch no one (Fear aimed at empty ground): its creature
    // reactions skip while the area itself still plays.
    if(destinations===context.targets && (o.optionalTargets || context.template) && !destinations?.length)continue;
    if(destinations===context.targets&&o.targetSelection==='secondary'){
      destinations=destinations.slice(1);
      if(o.targetLimit>0)destinations=destinations.slice(0,o.targetLimit);
      if(!destinations.length)continue;
    }
    if (
      destinations === context.targets &&
      o.targetSelection !== "all" &&
      destinations?.length
    ) {
      const selected = motionTargetFor(o);
      // Secondary contacts are optional when fewer creatures were selected.
      // Never turn a missing second/third creature into another first hit.
      if (!selected) continue;
      destinations = [selected];
    }
    if (destinations === context.targets && o.targetLimit > 0)
      destinations = destinations.slice(0, o.targetLimit);
    if (s.catalogFx && s.kind==='tokenfx' && !context.source)continue;
    if (!context.source && !["template", "sound", "overlay", "scenefx"].includes(s.kind))
      throw Error("Select a source token first.");
    if (
      !["sound", "overlay", "scenefx"].includes(s.kind) &&
      (!destinations?.length || destinations.some((d) => !d))
    )
      throw Error(
        s.kind === "template"
          ? "Select a supported area first."
          : "Target at least one token first.",
      );
    if (s.kind === "template" && !context.area)
      throw Error("Select a supported circular, cone, square or line area first.");
    if (s.travelDestination === "area" && !context.area)
      throw Error("Select an area for this projectile first.");
    if (s.kind === "motion" && s.motion === "lunge" && !context.targets?.length)
      throw Error("Lunge needs a target token for direction.");
    if (
      isPathMotion(s) &&
      s.motionRange === "target" &&
      !context.targets?.length
    )
      throw Error(
        "This motion needs a target. Select one or use a fixed-distance path.",
      );
    const motionTarget = motionTargetFor(s);
    if (context.targets?.length && !motionTarget && s.kind === "motion" && (isPathMotion(s) || s.motion === "lunge")) continue;
    for (const [targetIndex, destination] of (
      destinations ?? [null]
    ).entries()) {
      const parent = recipe.stages.find((p) => p.stageId === s.afterStage);
      const routedParent =
        parent?.repeatScope === "total"
          ? parent
          : recipe.stages.find(
              (p) =>
                p.stageId === parent?.afterStage && p.repeatScope === "total",
            );
      if (
        s.subject === "targets" &&
        routedParent &&
        targetIndex >= routedParent.repeats
      )
        continue;
      let timed = stagesFor(
        s.travelDestination === "area" && !areaFan
          ? { center: context.area.center }
          : isPathMotion(s) &&
              s.subject === "source" &&
              s.motionRange === "target"
            ? motionTarget
            : destination,
        targetIndex,
        areaFan ? { center: context.area.center } : s.travelOrigin === "firstTarget" ? context.targets[0] : context.source,
      )[index];
      const targeted =
        ["travel", "projectile", "impact"].includes(s.kind) ||
        s.subject === "targets";
      if (s.afterStage && !targeted && context.targets?.length) {
        const pathParent = isPathMotion(parent) && parent.subject === "source";
        const timingTargets = pathParent ? [motionTarget] : context.targets;
        timed = timingTargets
          .map((target, i) => stagesFor(target, i)[index])
          .reduce((latest, stage) =>
            s.kind === "sound" && s.timingAnchor === "start"
              ? stage.delay < latest.delay
                ? stage
                : latest
              : stage.delay > latest.delay
                ? stage
                : latest,
          );
      }
      let landing = null;
      if (
        s.landingGroup &&
        ["projectile", "impact"].includes(s.kind) &&
        !(s.kind === "projectile" && s.travelOrigin === "target")
      ) {
        const key = `${s.landingGroup}:${targetIndex}`;
        if (!landings.has(key)) {
          // The first stage in a group owns its scatter; every layer reuses it.
          const owner = recipe.stages.find(
            (p) => p.landingGroup === s.landingGroup,
          );
          const center = centerOf(destination),
            grid = context.gridSize ?? 100;
          const random = context.random ?? Math.random;
          landings.set(key, {
            x: center.x + (random() * 2 - 1) * (owner.scatter ?? 0) * grid,
            y: center.y + (random() * 2 - 1) * (owner.scatter ?? 0) * grid,
          });
        }
        landing = landings.get(key);
      }
      landing ??= s.atPoint ?? null;
      for (let iteration = 0; iteration < o.repeats; iteration++) {
        if (
          o.repeatScope === "total" &&
          iteration % (destinations?.length || 1) !== targetIndex
        )
          continue;
        const areaTiles =
          s.kind === "template" &&
          o.areaLayout === "tiles" &&
          context.area?.type === "line";
        const tileCount = areaTiles
          ? Math.max(
              1,
              Math.min(24, Math.ceil(context.area.length / context.area.width)),
            )
          : 1;
        for (
          let copy = 0;
          copy < (s.kind === "sprite" ? o.copies : tileCount);
          copy++
        )
          plan.push({
            ...s,
            ...timed,
            ...o,
            ...parity,
            ...(areaFan && o.fanColors?.length ? { tintEnabled: true, colorize: true, tint: o.fanColors[targetIndex % o.fanColors.length] } : {}),
            duration: timed.duration,
            index,
            asset,
            destination,
            ...(isPathMotion(s) ? { motionTarget } : {}),
            ...(areaTiles
              ? {
                  areaTile: {
                    center: {
                      x:
                        context.area.center.x +
                        ((context.area.endpoint.x - context.area.center.x) *
                          (copy + 0.5)) /
                          tileCount,
                      y:
                        context.area.center.y +
                        ((context.area.endpoint.y - context.area.center.y) *
                          (copy + 0.5)) /
                          tileCount,
                    },
                    width: context.area.width,
                  },
                }
              : {}),
            ...(["travel", "projectile"].includes(s.kind)
              ? {
                  origin:
                    areaFan
                      ? { ...context.area.center, center: context.area.center, w: context.gridSize ?? 100, h: context.gridSize ?? 100 }
                      : s.travelOrigin === "firstTarget"
                      ? context.targets[0]
                      : s.travelOrigin === "previousTarget"
                      ? (context.targets[targetIndex - 1] ?? context.source)
                      : s.travelOrigin === "target"
                        ? destination
                        : context.source,
                  endpoint:
                    s.travelOrigin === "target"
                      ? context.source
                      : s.travelDestination === "area" && !areaFan
                        ? context.area.center
                        : destination,
                }
              : {}),
            // Directional source cues (muzzle flash) turn toward their target.
            ...(o.faceTarget && !["travel", "projectile", "template"].includes(s.kind) && context.targets?.length
              ? { facing: context.targets[targetIndex] ?? context.targets[0] }
              : {}),
            // A JB2A melee clip is drawn from the wielder's side (Sequencer anchors it there when
            // turned): it plays at the attacker, turned toward the target, mirrored when the
            // target stands to the left so the blade stays on top.
            ...(s.kind === "impact" && meleeClip(asset) && context.source && destination && destination !== context.source
              ? { meleeFrom: context.source, facing: destination, ...(centerOf(destination).x < centerOf(context.source).x ? { facingMirror: true } : {}) }
              : {}),
            ...(areaFan ? { areaFan: true } : {}),
            landing,
            targetIndex,
            iteration,
            offsetX:
              o.offsetX +
              (s.kind === "sprite"
                ? (copy - (o.copies - 1) / 2) * o.copySpread
                : 0),
            delay: timed.delay + iteration * repeatStride({ ...timed, ...o }),
          });
      }
    }
  }
  return plan;
}

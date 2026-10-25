import { uuid } from "../../core/uuid.mjs";
import { ID, DEFAULT_RECIPE_COLOR, matchRecipe, planRecipe, resolveAsset, validateRecipe } from "../../core/model.mjs";
import { applyEventElement } from "../../catalogs/shared/element-choice.mjs";
import { OPTIONAL_FX_KINDS } from './optional-fx.mjs';
import { applyEffectOptions, applyMediaOptions, cropAreaArt, normalizeOptions } from "../../core/stage-options.mjs";
import { tokenFootprint, effectFootprint, artworkSize, offsetInGridSquares, beamGeometry } from "../media/media-preview.mjs";
// A mask (a polygon, a { points } shape, or a list of them) grown by k around a point.
function scaleMask(mask, at, k) {
  if (!mask || k === 1) return mask;
  if (Array.isArray(mask)) return mask.map((m) => scaleMask(m, at, k));
  if (!Array.isArray(mask.points)) return mask;
  const points = mask.points.map((v, i) => (i % 2 ? at.y + (v - at.y) * k : at.x + (v - at.x) * k));
  return mask.constructor && mask.constructor !== Object ? new mask.constructor(points) : { ...mask, points };
}
import { prepareRecipeSounds } from "../sound/spell-sounds.mjs";
import { previewFields } from '../../ui/activity-actions.mjs';
import { registeredMedia, mediaForReference } from '../media/media-library-model.mjs';
import { mediaSpan } from '../media/media-lifetime.mjs';
import { staggerDelays } from './adaptive.mjs';
import { stageTiers } from '../../core/quality.mjs';
import { withLastingArea } from './lasting-area.mjs';
import { meleeClip, withOutcome } from '../../systems/outcome.mjs';
import { centerOf, pickVariants } from './composition.mjs';
import { alignSurfaceHits } from '../sound/hit-timing.mjs';
import { activityEntryMeta, cleanOrigin } from '../../ui/activity-actions.mjs';
import { planLights, lightColor } from '../lighting/effect-lights.mjs';
import { isHarmful, planMarks } from '../marks/ground-marks.mjs';
import { isCritical, planDistortions } from '../distortion/scene-distortion.mjs';
import { arrivalOf, tokenId as tokenIdOf, withFlightPaths } from './flight-path.mjs';
import { addSurfaceSounds } from '../sound/surface-sounds.mjs';
import { teleportPlan, withTeleportStage } from '../motion/teleport.mjs';
import { createMomentum, applyMomentum, applyStrain } from './momentum.mjs';

// Two places (tokens, token documents or points) less than a pixel apart; unknown places never are.
const spotOf = (p) => { const c = p?.center ?? p?.object?.center ?? p; return Number.isFinite(c?.x) && Number.isFinite(c?.y) ? c : null; };
export const sameSpot = (a, b) => { const p = spotOf(a), q = spotOf(b); return !!p && !!q && Math.hypot(p.x - q.x, p.y - q.y) < 1; };
// A token's middle, in scene pixels.
const soundPlace = (t) => { const c = t?.center ?? (Number.isFinite(t?.x) ? { x: t.x + (t.w ?? 0) / 2, y: t.y + (t.h ?? 0) / 2 } : null); return c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { x: Math.round(c.x), y: Math.round(c.y) } : null; };
// A token's scene and level, else the scene and level this client views.
const soundFloor = (t, host) => {
  const doc = t?.document ?? t, own = typeof doc?.level === "string" && doc.level ? doc.level : null;
  return { scene: doc?.parent?.id ?? host.viewedScene?.() ?? null, level: own ?? host.viewedLevel?.()?.level ?? null };
};
const SOUND_PRELOAD_TIMEOUT = 2000;
// A play's id as a number (FNV-1a), the seed every client lays its marks' blotches out from.
const hashSeed = (text) => { let h = 0x811c9dc5; for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 0x01000193); return h >>> 0; };
// "Stay until the effect ends": if no effect from the item shows up on the token
// within this time (never applied), the layer ends instead of lingering.
export const EFFECT_GRACE_MS = 60000;
// A one-time animation still on screen this long after its planned end is stuck; it is ended.
export const STALL_GRACE_MS = 5000;
// "Spell Effect: Shield", "Effect: Shield" and "Shield" name the same effect.
export const sameEffectName = (name) => String(name ?? "").replace(/^\s*(?:spell\s+)?effect\s*:\s*/i, "").trim().toLowerCase();
// The placed document a lasting area is tied to. Foundry 14 keeps a MeasuredTemplate
// as a Region with the same id; deleting either removes the Region.
export function templateDocument(template) {
  const doc = template?.document ?? template;
  if (!doc?.documentName || !doc.id) return null;
  if (doc.documentName === "MeasuredTemplate") return doc.parent?.regions?.get?.(doc.id) ?? doc;
  return ["Region", "MeasuredTemplate"].includes(doc.documentName) ? doc : null;
}
// Weapon hits and residue are sized to the target token; the world setting
// enlarges them to JB2A's intended swing size. Placed Area Fire keeps its template size.
export function withWeaponScale(recipe, factor) {
  if (!recipe.weaponMode || recipe.weaponMode === 'area' || !(factor > 0) || factor === 1) return recipe;
  return { ...recipe, stages: recipe.stages.map(s => ['impact', 'aura'].includes(s.kind) ? { ...s, scale: (s.scale ?? 1) * factor } : s) };
}
// Afterimage trails, decided on the starting client so every client trails alike: ghosts take the stage's tint,
// else the play's element, else the recipe colour ("" leaves each client's soft white). The world setting off
// keeps any motion from trailing.
export function withTrail(stage, { element, recipeColor, allowed = true } = {}) {
  // A tint already set (a push's shove, replayed without the play's element) is kept.
  return { ...stage, trailTint: stage.trailTint || lightColor(stage, { element, recipeColor, fallback: "" }), ...(allowed ? {} : { afterimages: "never" }) };
}
// A shot that ends at a wall bursts there in a small generic impact (the first installed), 0.6 of the shot's size.
export const WALL_IMPACTS = ['jb2a.impact.001.white', 'jb2a.impact.002.white', 'jb2a.impact.010.white', 'jb2a.impact.005.white', 'jb2a.impact.009.white'];
const WALL_IMPACT_SIZE = 0.6, WALL_IMPACT_MS = 900;
// A shot that flies on past its target fades out over its last moments.
const PAST_FADE_MS = 150;
let flightPathsWarned = false;
// A travel clip Sequencer bends wide itself (.missed()): a miss with no planned path.
const missBent = (s, context) => s.kind === "travel" && !s.flightTo && ["failure", "criticalFailure"].includes(context.outcome) && !s.shieldBlock;
// A target whose own shot was planned to miss (engines/playback/flight-path.mjs missed: one target missed in a
// multi-target roll, D&D 5e targetOutcomes or Daggerheart's mixed results, which the roll-wide withOutcome never
// sees) loses its own effects as a whole miss does: its impacts, reactions and surface sounds. A melee swing and
// its dodge stay (withWallStrikes drops the dodge of a miss stopped short of it).
export function withoutMissedTargets(plan, missed) {
  if (!missed?.size) return plan;
  const keeps = (s) => s.kind === 'motion' && s.motion === 'dodge' || s.kind === 'impact' && s.subject !== 'targets' && s.assets?.some(meleeClip);
  return plan.filter((s) => !(missed.has(tokenIdOf(s.destination)) && (s.kind === 'impact' || s.subject === 'targets') && !keeps(s)));
}
// Flights whose arrival moved (flightArrivalShift, engines/playback/flight-path.mjs: a shot stopped by a wall, or
// landing on its target when its range variant's shot lands). Its target's impacts from the flight on, and
// stages tied to the flight or those impacts (by afterStage, through any chain), move by that much. A stage of
// another target stays, and so does one not on a target while those impacts also land on a target whose flight
// kept its time. A stage tied to several moved flights moves with the first that reaches its target. A stage
// timed to the flight's end (D&D 5e's contact) keeps that time: the flight's length does not change.
export function withFlightArrivals(plan) {
  const moved = plan.filter((f) => f.flightArrivalShift).sort((a, b) => (a.flightOutcome === 'wall') - (b.flightOutcome === 'wall'));
  if (!moved.length) return plan;
  const targets = new Set(plan.filter((s) => s.kind === 'impact' || s.subject === 'targets').map((s) => tokenIdOf(s.destination)).filter(Boolean));
  const shifted = new Set(moved.map((f) => tokenIdOf(f.endpoint)));
  const shift = new Map();
  for (const f of moved) {
    const id = tokenIdOf(f.endpoint), atEnd = (s) => s.afterStage === f.stageId && s.timingAnchor === 'end';
    const hits = plan.filter((s) => s.kind === 'impact' && tokenIdOf(s.destination) === id && (s.delay ?? 0) >= (f.delay ?? 0) && !atEnd(s));
    for (const s of hits) if (!shift.has(s)) shift.set(s, f.flightArrivalShift);
    const anchors = new Set([f.stageId, ...hits.map((s) => s.stageId)]);
    const elsewhere = () => plan.some((s) => anchors.has(s.stageId) && targets.has(tokenIdOf(s.destination)) && !shifted.has(tokenIdOf(s.destination)));
    for (let grew = true; grew;) {
      grew = false;
      for (const s of plan) {
        if (!s.afterStage || !anchors.has(s.afterStage) || shift.has(s) || atEnd(s)) continue;
        const on = tokenIdOf(s.destination);
        if (targets.has(on) ? on !== id : elsewhere()) continue;
        shift.set(s, f.flightArrivalShift);
        if (!anchors.has(s.stageId)) { anchors.add(s.stageId); grew = true; }
      }
    }
  }
  return plan.map((s) => (shift.has(s) ? { ...s, delay: Math.max(0, (s.delay ?? 0) + shift.get(s)) } : s));
}
// Shots that end at a wall (flightOutcome 'wall', engines/playback/flight-path.mjs). A blocked target's own
// effects (its impacts, reactions and surface sounds) do not play, nor does the dodge of a target a miss never
// reached; a small impact and a knock on stone (wood for a door) play at the wall point as the shot arrives there
// (its contact, flight-path.mjs wallArrivalOf). What followed the hit moves first (withFlightArrivals).
// asset: the wall impact, or null; cueOf(material) -> { file, volume, duration } | null.
export function withWallStrikes(plan, blocked, { asset = null, grid = 100, cueOf = () => null } = {}) {
  const walls = plan.filter((s) => s.flightOutcome === 'wall');
  if (!walls.length) return plan;
  const reach = (f, p) => Math.hypot(p.x - f.flightFrom.x, p.y - f.flightFrom.y);
  const unreached = new Set(walls.filter((f) => !blocked.has(tokenIdOf(f.endpoint)) && reach(f, f.flightTo) < reach(f, centerOf(f.endpoint))).map((f) => tokenIdOf(f.endpoint)));
  const dropped = (s) => blocked.has(tokenIdOf(s.destination)) && (s.kind === 'impact' || s.subject === 'targets')
    || s.stageId === 'miss-dodge' && unreached.has(tokenIdOf(s.destination));
  const out = [], struck = new Set();
  for (const s of plan) {
    if (dropped(s)) continue;
    out.push(s);
    if (s.flightOutcome !== 'wall') continue;
    // Right after its flight, so the moment of contact (outcome.mjs strikeTime) finds it.
    const at = Math.round((s.delay ?? 0) + arrivalOf(s)), landing = { x: s.flightTo.x, y: s.flightTo.y };
    const key = `${Math.round(landing.x)},${Math.round(landing.y)},${at}`;
    if (struck.has(key)) continue;
    struck.add(key);
    if (asset) out.push({
      ...normalizeOptions({ kind: 'impact' }), stageId: `${s.stageId}-wall`, kind: 'impact', label: 'Strikes the wall', assets: [asset], asset,
      delay: at, duration: WALL_IMPACT_MS, scale: 1, opacity: 1, destination: s.endpoint, landing,
      // Its size in pixels: sized to the shot, not to the target it never reached.
      footprint: WALL_IMPACT_SIZE * tokenFootprint(s.origin, grid) * (s.scale ?? 1),
    });
    const cue = cueOf(s.wallDoor ? 'wood' : 'stone');
    if (cue) out.push({ stageId: `${s.stageId}-wall-cue`, kind: 'sound', label: 'Strikes the wall', assets: [], soundFile: cue.file, volume: cue.volume, duration: cue.duration, delay: at, destination: landing, surfaceRole: 'cue' });
  }
  return out;
}
// Namespaces and their entry counts: cheap enough to compare on every catalog read.
function databaseSignature(database) {
  try {
    const entries = database?.entries;
    if (entries && typeof entries === "object") return Object.entries(entries).map(([ns, list]) => `${ns}:${list?.length ?? 0}`).sort().join("|");
    const namespaces = database?.searchFor?.("");
    return Array.isArray(namespaces) ? [...namespaces].sort().join("|") : "";
  } catch { return ""; }
}
const LOG_KEY = "animater.activity";
function loadLog() {
  try { const list = JSON.parse(globalThis.sessionStorage?.getItem(LOG_KEY) ?? "[]"); return Array.isArray(list) ? list.slice(0, 40) : []; }
  catch { return []; }
}
function saveLog(log) {
  try { globalThis.sessionStorage?.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* storage off or full: the log still works in memory */ }
}
export class AnimaterRuntime {
  constructor(host) {
    this.host = host;
    // The Activity log survives a page reload in this browser tab (session storage).
    this.log = loadLog();
    this.seen = new Set();
    this.catalog = [];
    this.sessions = new Set();
    this.pending = new Map();
    this.watchdogs = new Set();
    this.preparations = new Map();
    this.epoch = 0;
    this.previewAreas = new Set();
    // Lasting areas that end with their caster's concentration: {session, actorId, itemId}.
    this.lasting = [];
    // Lasting plays still on the table, for the Activity page's Now playing: session -> row.
    this.running = new Map();
    // Hit streaks and strained Strikes (engines/playback/momentum.mjs), on the combat turn the host names.
    this.momentum = createMomentum({ now: () => this.host.now?.() ?? Date.now(), turnKey: () => this.host.turnKey?.() ?? null });
  }
  // The caster stopped concentrating: end the lasting areas of that spell (or, when
  // the spell is unknown, every concentration area that caster still holds).
  async endConcentration(actorId, itemId) {
    return this.endLasting(this.lasting.filter((l) => !l.effect && l.actorId === actorId && (!itemId || !l.itemId || l.itemId === itemId)), "the spell ended");
  }
  // An effect left a token: end the "stay until the effect ends" layers of the item
  // it came from (matched by the effect's origin item, or its name: "Effect: Shield").
  async endWithEffect(actorId, { itemId, name } = {}) {
    const effectName = sameEffectName(name);
    return this.endLasting(this.lasting.filter((l) => l.effect && l.actorId === actorId && (itemId && l.itemId === itemId || effectName && sameEffectName(l.itemName) === effectName)), "its effect ended");
  }
  async endLasting(ending, why) {
    if (!ending.length) return 0;
    this.lasting = this.lasting.filter((l) => !ending.includes(l));
    await Promise.allSettled(ending.map((l) => this.host.endEffects({ name: l.session })));
    for (const l of ending) { clearTimeout(l.grace); this.sessions.delete(l.session); this.running.delete(l.session); }
    this.trace("Ended", `${ending.length} lasting ${ending.length === 1 ? "animation" : "animations"}: ${why}.`);
    return ending.length;
  }
  // meta: {origin, session, key, preview, automatic} lets the Activity page act on the entry later.
  trace(status, detail, recipe = null, meta = null) {
    this.log.unshift({
      time: new Date().toLocaleTimeString(),
      status,
      detail,
      recipe: recipe?.name ?? "",
      ...activityEntryMeta(recipe, meta),
    });
    this.log.length = Math.min(this.log.length, 40);
    saveLog(this.log);
    this.host.onTrace?.();
  }
  refreshCatalog() {
    this.catalogSignature = databaseSignature(this.host.database);
    this.catalog = registeredMedia(this.host.database).filter(a => a.type !== 'audio').sort((a,b)=>a.key.localeCompare(b.key));
    return this.catalog;
  }
  // Where an automatic play came from: the host knows its catalogs; a saved recipe is a recipe.
  originOf(recipe, context) {
    const known = cleanOrigin(this.host.recipeOrigin?.(recipe, context));
    if (known) return known;
    return recipe?.id && (this.host.recipes?.() ?? []).some((r) => r.id === recipe.id) ? { type: "recipe", id: recipe.id } : null;
  }
  // Lasting plays still running. A session whose effects are gone (its template was removed) drops out.
  runningAnimations() {
    for (const [session, row] of this.running)
      if (row.layers && this.host.effectRunning && !this.host.effectRunning(session)) this.running.delete(session);
    return [...this.running.values()].map(({ layers, ...row }) => ({ ...row }));
  }
  // Ends one lasting play: for everyone (Sequencer's synced end) or only on this screen.
  async endSession(session, { everyone = true } = {}) {
    const row = this.running.get(session);
    if (!row && !this.sessions.has(session)) return false;
    this.running.delete(session);
    this.sessions.delete(session);
    const ending = this.lasting.filter((l) => l.session === session);
    for (const l of ending) clearTimeout(l.grace);
    this.lasting = this.lasting.filter((l) => l.session !== session);
    this.cancelWaits(session);
    await Promise.allSettled([
      this.host.endEffects({ name: session }, everyone),
      this.host.endSounds?.({ name: session }),
      this.host.stopOptionalFx?.({ session }),
    ]);
    this.trace("Stopped", `${row?.name ?? "Animation"}: stopped${everyone ? "" : " on this screen"}.`, row ? { id: row.recipeId, name: row.name } : null);
    return true;
  }
  // A library can register with Sequencer after sequencer.ready (BLFX does): rebuild when the
  // database's namespaces or entry counts change, or its assets read as missing until Refresh.
  getCatalog() {
    const stale = this.catalogSignature !== undefined && databaseSignature(this.host.database) !== this.catalogSignature;
    return this.catalog.length && !stale ? this.catalog : this.refreshCatalog();
  }
  // Would this event's attack roll play something (the same weapon, as an attack)?
  attackAnimates(event, saved) {
    const attack = { ...event, type: "attack", id: undefined };
    try { return Boolean(this.host.resolveRecipe ? this.host.resolveRecipe(attack, saved) : (matchRecipe(saved, attack) ?? this.host.catalogRecipe?.(attack, saved))); }
    catch { return false; }
  }
  async dispatch(event) {
    if (!event || !this.host.enabled()) return;
    if (event.id && this.seen.has(event.id)) return;
    if (event.id) {
      this.seen.add(event.id);
      if (this.seen.size > 500)
        this.seen.delete(this.seen.values().next().value);
    }
    const saved = this.host.recipes();
    const resolved = this.host.resolveRecipe
      ? this.host.resolveRecipe(event, saved)
      : (matchRecipe(saved, event) ?? this.host.catalogRecipe?.(event, saved));
    // A lasting PF2e/SF2e area stays on its template (D&D marks it in its catalog).
    const recipe = withLastingArea(applyEventElement(resolved, event.element), event, {
      exists: (key) => Boolean(this.host.database?.entryExists?.(key)),
    });
    // Damage riders (e.g. Sneak Attack) play alongside the event's own recipe.
    const riders = (this.host.riderRecipes?.(event, saved) ?? []).filter(Boolean);
    if (!recipe && !riders.length) {
      // A weapon animates on its attack roll; its damage roll having nothing more is not "no animation".
      if (event.type === "damage" && event.item?.type === "weapon" && this.attackAnimates(event, saved)) return;
      return this.trace(
        "Skipped",
        `${event.item?.name ?? "Unknown item"}: ${event.skipReason ?? `no enabled ${event.type} recipe`}.`,
        null,
        event.skipReason ? { item: event.item?.name, reroll: event.reroll } : { item: event.item?.name, reason: "no-recipe", itemType: event.item?.type, reroll: event.reroll },
      );
    }
    // Other modules may claim the event (return false) before anything plays.
    if (globalThis.Hooks?.call?.("animater.preDispatch", event, recipe) === false)
      return this.trace("Skipped", `${event.item?.name ?? "Unknown item"}: claimed by another module.`, recipe, { item: event.item?.name, reason: "claimed" });
    await Promise.all([recipe, ...riders].filter(Boolean).map(async (next) => {
      try {
        await this.play(next, {...event,automatic:true});
      } catch (error) {
        this.trace("Blocked", error.message, next);
      }
    }));
    globalThis.Hooks?.callAll?.("animater.played", event, recipe);
  }
  async play(recipe, context, { preview = false, onStart, sampleArea = false } = {}) {
    recipe = validateRecipe(recipe);
    const epoch = this.epoch;
    let area;
    try {
      // A manual table play with no placed template borrows the preview's sample area.
      if ((preview || (sampleArea && !context.template)) && this.host.ready()) {
        area = await this.host.previewArea?.(recipe, context);
        if (area) this.previewAreas.add(area);
      }
      if (this.epoch !== epoch) return null;
      return await this.playPrepared(
        recipe,
        area ? { ...area.context, previewFootprint: true } : context,
        {
          preview,
          onStart,
        },
      );
    } finally {
      if (area) {
        if (this.previewAreas.delete(area)) area.cleanup();
      }
    }
  }
  async playPrepared(recipe, context, { preview = false, onStart } = {}) {
    if(!preview && context.automatic && recipe.playbackRoles?.automatic==='requires-role-resolution')
      throw Error(recipe.playbackRoles.reason);
    if (recipe.lifecycle === "document" && !preview)
      throw Error("Enable this condition or effect in its catalog. Native documents control its lifetime; use Local canvas preview to test it.");
    if (recipe.lifecycle === "document" && preview) this.host.previewBody?.(recipe, context.source);
    // Random variants: each play keeps one stage of every variant group.
    recipe = pickVariants(recipe);
    // A miss never lands on the target; a critical hit lands harder.
    if (context.outcome) recipe = validateRecipe(withOutcome(recipe, context));
    // Momentum (world setting): a hit streak lands harder; a strained PF2e Strike's miss looks laboured.
    const streak = !preview && context.automatic && this.host.momentum?.() === true ? this.momentum.observe(context) : null;
    const surge = streak?.factor > 1 ? streak.factor : 1;
    if (surge > 1) recipe = applyMomentum(recipe, surge);
    if (streak?.strained) recipe = validateRecipe(applyStrain(recipe));
    recipe = prepareRecipeSounds(recipe, this.host.soundCatalog?.());
    recipe = withWeaponScale(recipe, this.host.weaponScale?.() ?? 1);
    if (!this.host.ready())
      throw Error("Activate Sequencer, then reload Foundry.");
    this.getCatalog();
    if (!preview && !this.host.canPlay(context))
      throw Error("You need ownership of the source token.");
    let plan = planRecipe(recipe, this.catalog, {
      ...context,
      preview,
      // What each target's body or shield is, for a weapon's surface cue.
      surfaceOf: this.host.surfaceOf,
      sizeOf: this.host.sizeOf,
      voices: (this.surfaceVoices ??= []),
      gridSize: this.host.gridSize?.() ?? 100,
    });
    // Where each shot really flies (stopping at walls).
    plan = this.flightPaths(plan, recipe, context, preview);
    if (
      !preview &&
      plan.some((s) => s.kind === "motion" || s.kind === "tokenfx" && !s.catalogFx && this.host.fxCatalog?.().tokenReady) &&
      this.host.canSyncMotion?.() === false
    )
      throw Error(
        "Foundry has not registered Animater's token-motion channel. Stop and start the Foundry server instance serving this world, then reload connected clients. Local preview is available now.",
      );
    if(!preview&&this.host.canSyncMotion?.()===false&&plan.some(s=>s.kind==='tokenfx'&&s.catalogFx)) {
      plan=plan.filter(s=>s.kind!=='tokenfx'||!s.catalogFx);
      this.trace('Skipped','Catalog token filters: synchronization channel unavailable.');
    }
    // A linked flash screen shows to everyone first (only once the animation is sure to play);
    // the animation follows as it fades. Stop during the screen cancels the animation too.
    if (!preview && recipe.flash) {
      const before = this.epoch;
      await this.host.flashBefore?.(recipe, context)?.catch?.(() => {});
      if (this.epoch !== before) return null;
    }
    // Teleport: the one who cast clicks the spot first; the jump plays at the recipe's teleport stage, its own
    // or one placed where the animation reaches the mover (engines/motion/teleport.mjs).
    // Cancelling the pick still plays the animation, without moving anyone. A preview vanishes and reappears in place.
    // A picked spot is a move in the game: it happens even when the animation fails or is stopped first (landTeleport).
    // A fetch (Friendfetch) moves every target, each to its own spot (a list from the host); each jumps on its
    // own copy of the teleport stage. Its preview acts the pull out instead.
    let moves = [];
    const teleporting = teleportPlan(recipe), who = teleporting?.who;
    if (!preview && this.host.pickTeleport) {
      const before = this.epoch, picked = await this.host.pickTeleport(recipe, context)?.catch?.(() => null);
      moves = (Array.isArray(picked) ? picked : [picked]).filter(Boolean).map((spot) => ({ spot, mover: spot.mover }));
      if (this.epoch !== before) { this.landTeleports(moves); return null; }
    } else if (preview && who && !teleporting.fetch && this.host.previewTeleport) {
      const mover = who === "target" ? context.targets?.[0] : context.source;
      if (mover) moves = [{ mover }];
    }
    let jumps = [], session;
    // A stage planned once per target keeps the tier of its first copy.
    const tiers = new Map();
    try {
      jumps = moves.map((move) => {
        const stage = withTeleportStage(plan, { who, mover: move.mover }).find((s) => s.kind === "teleport");
        return stage && { ...stage, move };
      }).filter(Boolean);
      // A stage that only stands in for the move (Friendfetch's pull) gives way on the tokens that really move.
      const moved = (token) => jumps.some((j) => tokenIdOf(j.move.mover) === tokenIdOf(token));
      const standIn = (s) => s.skipOnTeleport && jumps.length && (s.subject === "targets" ? moved(s.destination) : who === "source");
      plan = plan.filter((s) => s.kind !== "teleport" && !standIn(s));
      session = `${ID}-${this.host.userId()}-${uuid()}`;
      for (const [s, tier] of stageTiers(plan)) tiers.set(s.stageId, Math.min(tier, tiers.get(s.stageId) ?? tier));
    } catch (error) {
      this.landTeleports(moves);
      throw error;
    }
    const epoch = this.epoch;
    let failed = false;
    // Every client remembers what this actor played, so it can warm those files on their next turn.
    const animaterActor = context.source?.actor?.id;
    // ...and what played, from where, started by whom, so any client can explain it on hover (ui/hover-explain.mjs).
    const playedOrigin = !preview && context.automatic ? this.originOf(recipe, context) : null;
    const animaterRecipe = preview ? null : { name: String(recipe.name ?? ""), ...(playedOrigin ? { origin: playedOrigin } : {}), by: String(this.host.userId?.() ?? "") };
    // Effect lights (anchor stage -> light), planned from the final timings.
    let lights = null;
    // Ground marks (anchor stage -> mark), planned from the same timings.
    let groundMarks = null;
    // Map distortions (anchor stage -> warp), planned from the same timings.
    let distortions = null;
    // Camera shakes (anchor stage -> shock) while map distortion is off; on, its warp tags serve the shake.
    let shakes = null;
    const build = (stages) => {
      const sequence = this.host.sequence();
      // Copies of one stage start a few ms apart on the table, never in the preview.
      const adapt = preview ? null : this.host.adaptive?.();
      const spread = adapt?.stagger ? staggerDelays(stages) : null;
      if (spread?.size) adapt.staggered?.([...spread.values()].filter((ms) => ms > 0).length);
      for (const s of stages) {
        if (s.kind === "motion" || OPTIONAL_FX_KINDS.has(s.kind)) continue;
        if (s.kind === "sound") {
          // Players who turned Animater off hear nothing either.
          const listeners = preview ? null : this.host.soundUsers?.() ?? null;
          if (listeners && !listeners.length) continue;
          const sound = sequence
            .sound()
            .file(s.soundFile)
            .name(session)
            .playIf(() => this.epoch === epoch && !failed)
            .duration(s.duration)
            .volume(s.volume);
          if (listeners) sound.forUsers(listeners);
          // Every client that plays it shapes it alike: pitch, and an echo off a shield or a ward (engines/sound/sound-pitch.mjs).
          // Where it happens (the target it lands on, else the source), so each client places it from its own seat.
          const from = s.subject === "source" ? context.source : s.destination ?? context.source, at = soundPlace(from);
          // ...and on which scene and level (its token's, else what this client views), so others hear its room's walls.
          const floor = at ? soundFloor(from, this.host) : null;
          if ((s.pitch > 0 && s.pitch !== 1) || s.echo || s.surfaceRole || at) sound.addOverride?.(async (_, data) => ({ ...data, ...(at ? { animaterAt: at } : {}), ...(floor?.scene ? { animaterScene: floor.scene } : {}), ...(floor?.level ? { animaterLevel: floor.level } : {}), ...(s.pitch > 0 && s.pitch !== 1 ? { animaterPitch: s.pitch } : {}), ...(s.echo ? { animaterEcho: { delay: s.echo.delay, wet: s.echo.wet, feedback: s.echo.feedback, tone: s.echo.tone } } : {}), ...(s.surfaceRole ? { animaterSurface: s.surfaceRole } : {}) }));
          applyMediaOptions(sound, s);
          if (s.fadeIn) sound.fadeInAudio(s.fadeIn, { ease: s.ease });
          if (s.fadeOut) sound.fadeOutAudio(s.fadeOut, { ease: s.ease });
          continue;
        }
        // Optional layers only reach viewers whose quality setting allows them.
        const tier = tiers.get(s.stageId) ?? 0;
        const users = preview ? null : this.host.usersFor?.(tier) ?? null;
        if (users && !users.length) continue;
        // A flight from a spot to itself (the attacker on its target, a finisher's mover struck by itself) has no
        // length: Sequencer refuses to stretch it, so it is left out.
        if (s.kind === "travel" && sameSpot(s.flightTo ? s.flightFrom : s.origin, s.flightTo ?? s.endpoint)) continue;
        const e = sequence
          .effect()
          .name(session)
          .playIf(() => this.epoch === epoch && !failed)
          .opacity(s.opacity);
        // Sequencer uses media milliseconds before applying skips/rate.
        // Recipe durations, motion and stage links use elapsed milliseconds.
        // A lasting layer loops its whole clip: a stage duration would make Sequencer loop
        // only that much of it and jump back (a lasting Darkness looped 2.3s of its 5s clip).
        const lasts = s.persist && !preview && (s.kind !== "template" || templateDocument(context.template));
        // ...but never past the end of a clip that plays once: it would hold its last frame (media-lifetime.mjs).
        if (!lasts) e.duration(mediaSpan(s));
        if (users) e.forUsers(users);
        // Tagged on the starting client; each client's adapter reads it (engines/playback/adaptive.mjs).
        const animaterTier = tier, animaterLasting = Boolean(lasts);
        // Every client lights the scene from this one description (engines/lighting/effect-lights.mjs).
        const animaterLight = lights?.get(s) ?? null;
        // ...and paints the floor mark from this one (engines/marks/ground-marks.mjs).
        const animaterMark = groundMarks?.get(s) ?? null;
        // ...and bends the scene from this one (engines/distortion/scene-distortion.mjs).
        const animaterWarp = distortions?.get(s) ?? null;
        // ...and shakes the view from this one (engines/camera/camera-shake.mjs).
        const animaterShake = shakes?.get(s) ?? null;
        e.addOverride?.(async (_, data) => ({ ...data, animaterTier, animaterLasting, ...(animaterActor ? { animaterActor } : {}), ...(animaterRecipe ? { animaterRecipe } : {}), ...(preview ? { animaterPreview: true } : {}), ...(animaterLight ? { animaterLight } : {}), ...(animaterMark ? { animaterMark } : {}), ...(animaterWarp ? { animaterWarp } : {}), ...(animaterShake ? { animaterShake } : {}) }));
        if (spread?.get(s)) e.delay(spread.get(s));
        if (s.kind === "sprite") e.copySprite(s.destination);
        else e.file(s.asset);
        const location = {
          offset: offsetInGridSquares(s, s.destination, this.host.gridSize?.() ?? 100),
          gridUnits: true,
        };
        const media = mediaForReference(this.catalog, s.asset);
        const grid = this.host.gridSize?.() ?? 100;
        if (s.kind === "projectile") {
          // A planned path (flightFrom/flightTo) is literal points: every client flies the same line.
          e.atLocation(s.flightFrom ?? s.origin, location)
            .size(artworkSize(tokenFootprint(s.origin, grid) * s.scale, media))
            .moveTowards(s.flightTo ?? s.landing ?? s.endpoint, {
              delay: s.moveDelay ?? 0,
              ease: s.moveEase || 'linear',
              rotate: false,
              cacheLocation: true,
            });
        } else if (s.kind === "travel") {
          // Sequencer divides distance by scale.x. A scalar cancels its own
          // thickness; keep x=1 so the user's scale controls beam thickness.
          // A planned path already flies a miss wide (or into a wall); Sequencer's own miss bend is for unplanned ones.
          if (s.flightTo)
            e.atLocation(s.flightFrom, location)
              .stretchTo(s.flightTo, { cacheLocation: true })
              .scale({ x: 1, y: s.scale });
          else {
            e.atLocation(s.origin, location)
              .stretchTo(s.endpoint)
              .scale({ x: 1, y: s.scale });
            if (missBent(s, context)) e.missed();
          }
        } else if (s.kind === "template") {
          if (s.areaTile) {
            e.atLocation(s.areaTile.center, location).size(
              artworkSize(s.areaTile.width * s.scale, media),
            );
          } else if (["line", "cone"].includes(context.area.type)) {
            const g = beamGeometry(
              context.area.length,
              media?.width,
              media?.height,
              media?.template,
            );
            // Reach past the area: the art runs on beyond the far edge (a cone widens with it).
            const reach = 1 + (Number(s.areaReach) || 0) / 100, { center: from, endpoint: to } = context.area;
            const end = reach === 1 ? to : { x: from.x + (to.x - from.x) * reach, y: from.y + (to.y - from.y) * reach };
            e.atLocation(context.area.center, location)
              .stretchTo(end)
              .scale({
                x: 1,
                y: ((context.area.type === "cone" ? reach : 1) * s.scale * (context.area.type === "cone"
                  ? 2 * context.area.length * Math.tan(context.area.angle * Math.PI / 360)
                  : context.area.width)) / Math.max(1, g.height),
              });
            if (cropAreaArt(s, context.area.type)) {
              // Reaching past the area crops to the same shape grown from its start by the reach.
              const mask = scaleMask(this.host.areaMask?.(context.template), from, reach);
              if (mask) e.mask(mask);
            }
          } else {
            // A lasting emanation (Spirit Guardians) rides on the caster as they move.
            const follow = s.followSource && context.source ? context.source.object ?? context.source : null;
            if (follow) e.attachTo(follow, { bindAlpha: false, bindVisibility: true });
            else e.atLocation(context.area.center, location);
            e.size({
              ...artworkSize(context.area.diameter * s.scale, media),
            });
            // A following emanation leaves its placed outline behind, so it is never cropped to it.
            if (!follow && cropAreaArt(s, context.area.type)) {
              const mask = this.host.areaMask?.(context.template);
              if (mask) e.mask(mask);
            }
          }
        } else if (s.kind === "overlay") {
          e.screenSpace()
            .screenSpaceAnchor({ x: s.anchorX, y: s.anchorY })
            .screenSpacePosition({
              x: s.offsetX * (this.host.gridSize?.() ?? 100),
              y: s.offsetY * (this.host.gridSize?.() ?? 100),
            })
            .scale(s.scale);
          if (s.overlayFit) e.screenSpaceScale({ fitX: true, fitY: true });
        } else if (s.meleeFrom && !sameSpot(s.meleeFrom, s.facing)) {
          // A JB2A melee clip is stretched like a flight: its template's start point on the
          // wielder, its end point on the target, so the swing reaches exactly that far.
          e.atLocation(s.meleeFrom, location)
            .stretchTo(s.facing, { cacheLocation: true })
            .scale({ x: 1, y: s.scale });
        } else {
          e.atLocation(s.landing ?? s.destination, location);
          if (s.facing && !sameSpot(s.landing ?? s.destination, s.facing)) e.rotateTowards(s.facing, { cacheLocation: true });
          // copySprite already captures mesh dimensions, texture scale and
          // mirroring. Sizing it to the footprint loses those properties.
          if (s.kind === "sprite") e.scale(s.scale);
          else
            e.size(
              artworkSize((s.footprint ?? effectFootprint(s,s.destination,grid,this.host.gridDistance?.()??5)) * s.scale, media),
            );
          if (s.kind === "aura" || s.attach)
            e.attachTo(s.destination, {
              ...location,
              bindRotation: s.bindRotation,
              bindAlpha: s.bindAlpha,
            });
          if (s.maskToken) e.mask(s.destination);
        }
        applyEffectOptions(e, s);
        if (s.flightOutcome === "past" && !(s.fadeOut >= PAST_FADE_MS)) e.fadeOut(PAST_FADE_MS);
        if (s.below) e.belowTokens();
        if (s.persist && !preview) {
          // A lasting area loops until its template (a Region on Foundry 14) is
          // removed. Without a placed template there is nothing to end it, so it plays once.
          const doc = s.kind === "template" ? templateDocument(context.template) : null;
          if (s.kind !== "template") e.persist();
          else if (doc) e.persist().tieToDocuments(doc);
        }
      }
      return sequence;
    };
    this.sessions.add(session);
    try {
      const soundFiles=[...new Set(plan.filter(s=>s.kind==='sound').map(s=>s.soundFile))];
      if(soundFiles.length && this.host.preloadSounds) {
        const prepared=await this.prepare(Promise.resolve().then(()=>this.host.preloadSounds(soundFiles,{preview})),session);
        if(prepared.status==='cancelled' || this.epoch!==epoch)return null;
        if(prepared.status!=='ready') {
          const reason=prepared.status==='timeout'?'Sound preparation timed out':`Sound preparation failed: ${prepared.error?.message??prepared.error}`;
          plan=plan.filter(s=>s.kind!=='sound');
          if(!plan.length)throw Error(reason);
          this.trace('Skipped',`${reason}; playing animation without audio.`,recipe);
        }
        // Loaded: each surface hit lands just after the weapon's own (engines/sound/hit-timing.mjs).
        else if(this.host.soundPeak) plan=alignSurfaceHits(plan,this.host.soundPeak);
      }
      // Where each stage shows and how big, for the lights and the marks below (pixels).
      const grid = this.host.gridSize?.() ?? 100, gridDistance = this.host.gridDistance?.() ?? 5;
      const half = (n) => (Number(n) > 0 ? Number(n) / 2 : null);
      // A line or cone shows at its middle, as far as half its length; any other area at its centre.
      const area = context.area, along = ["line", "cone"].includes(area?.type) && area.center && area.endpoint;
      const areaPoint = along ? { x: (area.center.x + area.endpoint.x) / 2, y: (area.center.y + area.endpoint.y) / 2 } : area?.center;
      // A flight with a planned path ends where it stops (a bolt stopped by a wall, at the wall).
      const pointOf = (s) => soundPlace(s.flightTo ?? s.landing) ?? s.areaTile?.center ?? (s.kind === "template" ? areaPoint : null) ?? soundPlace(s.destination);
      // The footprint the effect is sized to, as a radius.
      const radiusOf = (s) => {
        if (s.kind === "template") return half(s.areaTile ? s.areaTile.width * s.scale : along ? area.length : area?.diameter * s.scale);
        if (s.kind === "travel" || s.kind === "projectile") return half(tokenFootprint(s.origin, grid) * s.scale);
        return half((s.footprint ?? effectFootprint(s, s.destination, grid, gridDistance)) * s.scale);
      };
      // The source token's level and elevation, so every client lights and marks the same floor.
      const token = context.source?.document ?? context.source;
      // Effects attached to a token (auras, a following emanation) carry their light and haze with them; see build().
      const follows = (s) => s.kind === "template"
        ? !s.areaTile && !along && !!s.followSource && !!context.source
        : s.kind !== "overlay" && !s.meleeFrom && (s.kind === "aura" || !!s.attach);
      // Effect lighting: planned once here from the final plan; previews always show it.
      if (preview || this.host.effectLights?.() === true) {
        lights = planLights(plan, {
          tiers,
          grid,
          pointOf,
          radiusOf,
          originOf: (s) => soundPlace(s.flightFrom ?? s.origin),
          // A line area stretched along its template (a wall) is lit along its length.
          spanOf: (s) => (s.kind === "template" && !s.areaTile && area?.type === "line" && along ? { from: area.center, to: area.endpoint } : null),
          follows,
          element: context.element ?? recipe.chosenElement,
          recipeColor: recipe.color,
          level: token?.level,
          elevation: token?.elevation,
        });
      }
      // Ground marks (world setting): described once here on the same final plan; a preview never marks the floor.
      if (!preview && this.host.groundMarks?.() === true && isHarmful(context, { itemDamages: this.host.itemDamages })) {
        // A weapon's mark is its payload's (recipe.markElement): rune or rider damage leaves none.
        const strike = ["weapon", "melee"].includes(context.item?.type);
        // A placed area has no damage roll to name its element: the item's own damage does.
        const element = strike ? undefined : context.element ?? this.host.itemElement?.(context.item, context) ?? undefined;
        groundMarks = planMarks(plan, {
          context: { ...context, element },
          recipe,
          tiers,
          gridPx: grid,
          pointOf,
          sizeOf: (s) => 2 * (radiusOf(s) ?? 0) || null,
          area: area?.center ? area : null,
          seed: hashSeed(context.messageId ?? context.id ?? session),
        });
        // Without the source token's level, the level this client views.
        const viewed = typeof token?.level === "string" && token.level ? null : this.host.viewedLevel?.();
        if (viewed?.level) for (const tag of groundMarks.values()) Object.assign(tag, { level: viewed.level, ...(Number.isFinite(viewed.elevation) && !Number.isFinite(tag.elevation) ? { elevation: viewed.elevation } : {}) });
        // An area mark names its placed Region, so every client clips it to that shape (mark-paint.mjs areaMaskFor).
        const region = templateDocument(context.template);
        if (region?.documentName === "Region") for (const tag of groundMarks.values()) if (tag.shape !== "spot") tag.regionId = region.id;
      }
      // Map distortion (world setting): described once here on the same final plan.
      // Camera shake (world setting) needs the shocks alone when map distortion is off.
      const warps = this.host.mapDistortion?.() === true;
      if (warps || this.host.cameraShake?.() === true) {
        const planned = planDistortions(plan, {
          context,
          tiers,
          gridPx: grid,
          pointOf,
          radiusOf,
          follows,
          // The source token's level: a client viewing another level is not distorted.
          level: token?.level,
          shockReach: this.host.shockwaveReach?.(),
          // A placed area has no damage roll to name its element: the item's own damage does.
          element: context.element ?? recipe.chosenElement ?? this.host.itemElement?.(context.item, context) ?? undefined,
          // A critical hit with a heavy weapon ripples too (only a critical play asks).
          heavyItem: context.item && isCritical(context) ? this.host.heavyItem?.(context.item) === true : false,
          // A plain round area ripples only when its item deals damage (no healing or detecting sphere).
          harmful: context.item && this.host.itemDamages ? this.host.itemDamages(context.item) === true : true,
        });
        if (surge > 1) for (const tag of planned.values()) tag.strength = (tag.strength ?? 1) * surge;
        if (warps) distortions = planned;
        else shakes = new Map([...planned].filter(([, tag]) => tag.kind === "shock"));
      }
      // Afterimage trails (world setting; on while the host has none).
      // An unpicked recipe colour (the default card accent) leaves plain motions their soft white.
      const trail = { element: context.element ?? recipe.chosenElement, recipeColor: recipe.color === DEFAULT_RECIPE_COLOR ? undefined : recipe.color,
        allowed: this.host.afterimages?.() !== false };
      const groups = new Map();
      // The teleport waits with the stages that start with it, so a slow wait or path delays it alike.
      for (const s of [...plan, ...jumps]) {
        if (!groups.has(s.delay)) groups.set(s.delay, []);
        groups.get(s.delay).push(s);
      }
      // Prebuild every group so a bad Sequencer option cannot produce half a recipe.
      const sequences = [...groups].map(([delay, stages]) => ({
        delay,
        sequence: stages.some((s) => s.kind !== "motion" && s.kind !== "teleport" && !OPTIONAL_FX_KINDS.has(s.kind)) ? build(stages.filter((s) => s.kind !== "teleport")) : null,
        motions: stages.filter((s) => s.kind === "motion"),
        optionalFx: stages.filter((s) => OPTIONAL_FX_KINDS.has(s.kind)),
        teleports: stages.filter((s) => s.kind === "teleport"),
      }));
      onStart?.({ ...recipe, playbackPlan: plan });
      // Local previews never broadcast; real plays use Sequencer's own sync.
      const results = await Promise.all([
        ...sequences.map(async ({ delay, sequence, motions, optionalFx, teleports }) => {
          if (delay && !(await this.wait(delay, session))) return false;
          if (this.epoch !== epoch || failed) return false;
          await Promise.all([
            ...(sequence
              ? [(async()=>{
                  await sequence.play(preview ? { local: true } : {});
                  // Loading can finish after Stop (including locked audio).
                  // Drain only this late session, never another user's media.
                  if(this.epoch!==epoch || failed)await Promise.allSettled([
                    this.host.endEffects({name:session}),
                    this.host.endSounds?.({name:session}),
                  ]);
                })()]
              : []),
            ...motions.map((s) =>
              this.host.motion(withTrail(s, trail), context, { preview, session }),
            ),
            ...optionalFx.map(s=>this.host.optionalFx?.(s,context,{preview,session})),
            ...teleports.map((s) => this.playTeleportStage(s.move, s, recipe, context, preview)),
          ]);
          return this.epoch===epoch && !failed;
        }),
        ...(preview
          ? [
              this.wait(
                Math.max(...[...plan, ...jumps].map((s) => s.delay + s.duration)),
                session,
              ),
            ]
          : []),
      ]);
      if (results.some((result) => !result)) return null;
      // A one-time animation never outstays its plan: if a client's Sequencer stalls (a cast circle
      // left on the tokens after a session), the caster's client ends it everywhere shortly after.
      if (!preview && !plan.some((s) => s.persist)) {
        const end = Math.max(0, ...plan.map((s) => (s.delay ?? 0) + (s.duration ?? 0)));
        const timer = setTimeout(() => { this.watchdogs.delete(timer); void this.host.endEffects({ name: session }); }, end + STALL_GRACE_MS);
        timer.unref?.();
        this.watchdogs.add(timer);
      }
      // "Stay until the effect ends" layers (Shield's ward) end when the item's effect
      // leaves the token; never applied within the grace time, they end anyway.
      const bearer = context.actor ?? context.source?.actor ?? context.source?.document?.actor;
      if (!preview && recipe.lifecycle !== "document" && bearer && plan.some((s) => s.kind === "aura" && s.persist)) {
        const entry = { session, actorId: bearer.id, itemId: context.item?.id, itemName: context.item?.name ?? recipe.name, effect: true };
        entry.grace = setTimeout(() => {
          if (this.lasting.includes(entry) && this.host.hasItemEffect && !this.host.hasItemEffect(bearer, context.item ?? { name: recipe.name })) void this.endLasting([entry], "no effect was applied");
        }, this.effectGrace ?? EFFECT_GRACE_MS);
        this.lasting.push(entry);
        if (this.lasting.length > 50) void this.endLasting([this.lasting[0]], "too many lasting animations");
      }
      // Lasting areas of a concentration spell end with the caster's concentration.
      if (!preview && context.actor && plan.some((s) => s.kind === "template" && s.persist)) {
        const sys = context.item?.system;
        // D&D concentration; PF2e/SF2e sustained spells end when their effect on the caster does.
        const concentration = Boolean(sys?.properties?.has?.("concentration") || sys?.properties?.includes?.("concentration") || sys?.duration?.concentration || sys?.duration?.sustained);
        if (concentration) {
          this.lasting.push({ session, actorId: context.actor.id, itemId: context.item?.id });
          if (this.lasting.length > 50) this.lasting.shift();
        }
      }
      const persists = !preview && plan.some((s) => s.persist);
      const origin = !preview && context.automatic ? this.originOf(recipe, context) : null;
      if (persists) this.running.set(session, {
        session, name: recipe.name, recipeId: recipe.id, origin,
        on: context.source?.name ?? context.source?.document?.name ?? "",
        startedAt: Date.now(),
        ...previewFields(plan, context.source, context.item),
        layers: plan.some((s) => s.persist && s.kind !== "motion" && !OPTIONAL_FX_KINDS.has(s.kind)),
      });
      this.trace(
        preview ? "Previewed" : "Played",
        `${plan.length} effects · ${context.targets?.length ?? 0} targets`,
        recipe,
        { origin, preview, automatic: !preview && context.automatic, session: persists ? session : null, reroll: context.reroll },
      );
      return session;
    } catch (error) {
      failed = true;
      this.cancelWaits(session);
      await Promise.allSettled([
        this.host.endEffects({ name: session }),
        this.host.endSounds?.({ name: session }),
        this.host.stopOptionalFx?.({session}),
      ]);
      throw error;
    } finally {
      if (failed || preview || !plan.some((s) => s.persist))
        this.sessions.delete(session);
      // Stopped or failed before its teleport stage started: the token still goes to its spot.
      this.landTeleports(moves);
    }
  }
  landTeleports(moves) {
    for (const move of moves) this.landTeleport(move);
  }
  // A picked teleport whose stage never started: the move at once, without its effects.
  landTeleport(jump) {
    if (!jump?.spot || jump.started) return;
    jump.started = true;
    this.placeTeleport(jump.spot);
  }
  // Only the move (host.place: the token's document, no canvas reads), never its effects; a host without it
  // plays a teleport with no effects and no time gone.
  placeTeleport(spot) {
    const plain = { ...spot, visuals: { ...(spot.visuals ?? {}), out: null, in: null } };
    Promise.resolve().then(() => this.host.place ? this.host.place(spot) : this.host.teleport?.(plain, { outAt: 0, goneMs: 0 }))
      .catch((error) => this.trace("Blocked", `Teleport: ${error.message}`));
  }
  // The teleport stage has started (its group waited for it): the token vanishes now and reappears after the
  // stage's length. The timing is decided here, on the client that played; a mover this user does not own is
  // moved by the GM when its time comes (main.mjs receiveTeleport).
  async playTeleportStage(jump, stage, recipe, context, preview) {
    if (jump.started) return;
    jump.started = true;
    const timing = { outAt: 0, goneMs: Math.max(0, stage.duration ?? 0) };
    try {
      if (preview) await this.host.previewTeleport?.(jump.mover, recipe, context, timing);
      else await this.host.teleport?.(jump.spot, timing);
    } catch (error) {
      this.trace("Blocked", `Teleport: ${error.message}`);
      // The effects failed (a token torn down mid-way): the move still happens, once.
      if (!preview) this.placeTeleport(jump.spot);
    }
  }
  // The plan with its flights' paths (engines/playback/flight-path.mjs) and their wall strikes. Without a wall
  // test, or when it fails (no collision backend), the flights play as they always did.
  flightPaths(plan, recipe, context, preview) {
    const grid = this.host.gridSize?.() ?? 100, collides = this.host.collides;
    let paths;
    try {
      paths = withFlightPaths(plan, {
        context, gridPx: grid, preview,
        // The shooter rides along so the wall test reads its level (a multi-level scene).
        collides: collides ? (a, b, type) => this.host.collides(a, b, type, context.source) : null,
        walls: this.host.projectileWalls?.() !== false,
      });
    } catch (error) {
      // Said once, so a broken wall test (or a planner bug) does not quietly switch the feature off.
      if (!flightPathsWarned) {
        flightPathsWarned = true;
        console.warn("Animater | Flight paths unavailable; projectiles fly as before.", error);
      }
      return plan;
    }
    const random = context.random ?? Math.random;
    // The knock on the wall: the recipe's own surface sounds for stone or wood, else Animater's bundled ones.
    // A recipe that plays no sounds stays silent.
    const sounded = recipe.stages.some((s) => s.kind === 'sound');
    const surfaces = recipe.stages.find((s) => s.surfaces)?.surfaces;
    const cueOf = (material) => {
      if (!sounded) return null;
      const set = surfaces?.[material] ?? addSurfaceSounds(null, [], { sounds: {}, blow: 'blunt', anchor: { stageId: 'wall', delay: 0 } })[0]?.surfaces?.[material];
      return set?.length ? set[Math.floor(random() * set.length)] : null;
    };
    const asset = resolveAsset({ kind: 'impact', assets: WALL_IMPACTS }, this.catalog);
    return withWallStrikes(withFlightArrivals(withoutMissedTargets(paths.plan, paths.missed)), paths.blocked, { asset, grid, cueOf });
  }
  wait(delay, session) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(timer);
        resolve(true);
      }, delay);
      this.pending.set(timer, Object.assign(resolve, { session }));
    });
  }
  prepare(task,session) {
    return new Promise(resolve=>{
      let settled=false;
      const finish=result=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        this.preparations.delete(session);
        resolve(result);
      };
      const timer=setTimeout(()=>finish({status:'timeout'}),SOUND_PRELOAD_TIMEOUT);
      this.preparations.set(session,()=>finish({status:'cancelled'}));
      Promise.resolve(task).then(()=>finish({status:'ready'}),error=>finish({status:'failed',error}));
    });
  }
  cancelWaits(session = null) {
    for(const [id,cancel]of this.preparations)if(session===null||session===id)cancel();
    for (const [timer, resolve] of this.pending) {
      if (session !== null && resolve.session !== session) continue;
      clearTimeout(timer);
      this.pending.delete(timer);
      resolve(false);
    }
  }
  async stop() {
    this.epoch++;
    this.cancelWaits();
    this.clearPreviewAreas();
    await this.host.stopMotion?.();
    await this.host.stopOptionalFx?.();
    // User-scoped names keep one user's stop button from ending another's effects.
    await this.host.endEffects({ name: `${ID}-${this.host.userId()}-*` });
    await this.host.endSounds?.({ name: `${ID}-${this.host.userId()}-*` });
    this.sessions.clear();
    this.running.clear();
    this.trace("Stopped", "Your Animater effects ended.");
  }
  clearPreviewAreas() {
    for (const area of this.previewAreas) area.cleanup();
    this.previewAreas.clear();
  }
}

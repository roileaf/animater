import { uuid } from "../../core/uuid.mjs";
import { ID, matchRecipe, planRecipe, validateRecipe } from "../../core/model.mjs";
import { applyEventElement } from "../../catalogs/shared/element-choice.mjs";
import { OPTIONAL_FX_KINDS } from './optional-fx.mjs';
import { applyEffectOptions, applyMediaOptions } from "../../core/stage-options.mjs";
import { tokenFootprint, effectFootprint, artworkSize, offsetInGridSquares, beamGeometry } from "../media/media-preview.mjs";
import { prepareRecipeSounds } from "../sound/spell-sounds.mjs";
import { previewFields } from '../../ui/activity-actions.mjs';
import { registeredMedia, mediaForReference } from '../media/media-library-model.mjs';
import { stageTiers } from '../../core/quality.mjs';
import { withLastingArea } from './lasting-area.mjs';
import { withOutcome } from '../../systems/outcome.mjs';
import { pickVariants } from './composition.mjs';
import { activityEntryMeta, cleanOrigin } from '../../ui/activity-actions.mjs';
const SOUND_PRELOAD_TIMEOUT = 2000;
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
    if (!recipe && !riders.length)
      return this.trace(
        "Skipped",
        `${event.item?.name ?? "Unknown item"}: ${event.skipReason ?? `no enabled ${event.type} recipe`}.`,
        null,
        event.skipReason ? { item: event.item?.name } : { item: event.item?.name, reason: "no-recipe", itemType: event.item?.type },
      );
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
      gridSize: this.host.gridSize?.() ?? 100,
    });
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
    // Teleport: the one who cast clicks the spot first; the jump plays alongside the animation.
    // Cancelling the pick still plays the animation, without moving anyone.
    if (!preview && this.host.pickTeleport) {
      const before = this.epoch, spot = await this.host.pickTeleport(recipe, context)?.catch?.(() => null);
      if (this.epoch !== before) return null;
      if (spot) void this.host.teleport?.(spot)?.catch?.((error) => this.trace("Blocked", `Teleport: ${error.message}`));
    }
    const session = `${ID}-${this.host.userId()}-${uuid()}`;
    const epoch = this.epoch;
    let failed = false;
    // A stage planned once per target keeps the tier of its first copy.
    const tiers = new Map();
    for (const [s, tier] of stageTiers(plan)) tiers.set(s.stageId, Math.min(tier, tiers.get(s.stageId) ?? tier));
    const build = (stages) => {
      const sequence = this.host.sequence();
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
          applyMediaOptions(sound, s);
          if (s.fadeIn) sound.fadeInAudio(s.fadeIn, { ease: s.ease });
          if (s.fadeOut) sound.fadeOutAudio(s.fadeOut, { ease: s.ease });
          continue;
        }
        // Optional layers only reach viewers whose quality setting allows them.
        const users = preview ? null : this.host.usersFor?.(tiers.get(s.stageId) ?? 0) ?? null;
        if (users && !users.length) continue;
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
        if (!lasts) e.duration(s.duration * s.playbackRate + (s.clipEnd ? 0 : s.clipStart));
        if (users) e.forUsers(users);
        if (s.kind === "sprite") e.copySprite(s.destination);
        else e.file(s.asset);
        const location = {
          offset: offsetInGridSquares(s, s.destination, this.host.gridSize?.() ?? 100),
          gridUnits: true,
        };
        const media = mediaForReference(this.catalog, s.asset);
        const grid = this.host.gridSize?.() ?? 100;
        if (s.kind === "projectile") {
          e.atLocation(s.origin, location)
            .size(artworkSize(tokenFootprint(s.origin, grid) * s.scale, media))
            .moveTowards(s.landing ?? s.endpoint, {
              delay: s.moveDelay,
              ease: s.moveEase,
              rotate: false,
              cacheLocation: true,
            });
        } else if (s.kind === "travel") {
          // Sequencer divides distance by scale.x. A scalar cancels its own
          // thickness; keep x=1 so the user's scale controls beam thickness.
          e.atLocation(s.origin, location)
            .stretchTo(s.endpoint)
            .scale({ x: 1, y: s.scale });
          if (["failure", "criticalFailure"].includes(context.outcome))
            e.missed();
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
            e.atLocation(context.area.center, location)
              .stretchTo(context.area.endpoint)
              .scale({
                x: 1,
                y: (s.scale * (context.area.type === "cone"
                  ? 2 * context.area.length * Math.tan(context.area.angle * Math.PI / 360)
                  : context.area.width)) / Math.max(1, g.height),
              });
            if (context.area.type === "cone") {
              const mask = this.host.areaMask?.(context.template);
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
        } else if (s.meleeFrom) {
          // A JB2A melee clip is stretched like a flight: its template's start point on the
          // wielder, its end point on the target, so the swing reaches exactly that far.
          e.atLocation(s.meleeFrom, location)
            .stretchTo(s.facing, { cacheLocation: true })
            .scale({ x: 1, y: s.scale });
        } else {
          e.atLocation(s.landing ?? s.destination, location);
          if (s.facing) e.rotateTowards(s.facing, { cacheLocation: true });
          // copySprite already captures mesh dimensions, texture scale and
          // mirroring. Sizing it to the footprint loses those properties.
          if (s.kind === "sprite") e.scale(s.scale);
          else
            e.size(
              artworkSize(effectFootprint(s,s.destination,grid,this.host.gridDistance?.()??5) * s.scale, media),
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
      }
      const groups = new Map();
      for (const s of plan) {
        if (!groups.has(s.delay)) groups.set(s.delay, []);
        groups.get(s.delay).push(s);
      }
      // Prebuild every group so a bad Sequencer option cannot produce half a recipe.
      const sequences = [...groups].map(([delay, stages]) => ({
        delay,
        sequence: stages.some((s) => s.kind !== "motion" && !OPTIONAL_FX_KINDS.has(s.kind)) ? build(stages) : null,
        motions: stages.filter((s) => s.kind === "motion"),
        optionalFx: stages.filter((s) => OPTIONAL_FX_KINDS.has(s.kind)),
      }));
      onStart?.({ ...recipe, playbackPlan: plan });
      // Local previews never broadcast; real plays use Sequencer's own sync.
      const results = await Promise.all([
        ...sequences.map(async ({ delay, sequence, motions, optionalFx }) => {
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
              this.host.motion(s, context, { preview, session }),
            ),
            ...optionalFx.map(s=>this.host.optionalFx?.(s,context,{preview,session})),
          ]);
          return this.epoch===epoch && !failed;
        }),
        ...(preview
          ? [
              this.wait(
                Math.max(...plan.map((s) => s.delay + s.duration)),
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
        { origin, preview, automatic: !preview && context.automatic, session: persists ? session : null },
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
    }
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

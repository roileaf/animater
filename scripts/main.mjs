import { uuid } from "./core/uuid.mjs";
import { ID, validateRecipe, clone, matchRecipe, resolveAsset, FINISHER_ENDINGS } from "./core/model.mjs";
import { registerFlashSettings, flashScreens, downMoment } from "./engines/flash/flash-combat.mjs";
import { creatureRank, partyLevels, isNotableKill } from "./systems/notable-kill.mjs";
import { SLOW_TEMPO } from "./engines/playback/impact-moments.mjs";
import { damageFromMessage, damageFromParts, recallDamage, recallAttribution, hitRecipe, deathRecipe } from "./engines/playback/damage-moments.mjs";
import { displaceAllowed, landingSpot, wallDistance, withinKnockback } from "./engines/motion/displacement.mjs";
import { hpPath, hpState, hpChange, isNpcActor, displaceHp } from "./systems/hp-state.mjs";
import { matchFinishers, killFinisher, critFinishers, usePasses, finisherMoment, checkFinisherEvent, mayDisplace, pickedFinisher, playerFinisherChoices, pickPlays, createFinishedMemory, finishedKey, finishedMessage, FINISHED_MESSAGE, critTargets, targetPassed, saveFinisherEvent, finisherHitStop } from "./engines/finishers/finisher-model.mjs";
import { playFinisher, previewFinisher } from "./engines/finishers/finisher-play.mjs";
import { STRIKE_FLAG, strikeKey, strikeOf, strikePick, picksOnActor } from "./engines/finishers/strike-finishers.mjs";
import { createFragmentRenderer } from "./engines/fragments/fragment-render.mjs";
import { starterRecipes } from "./core/presets.mjs";
import { pf2eEvent, sf2eEvent, dnd5eEvent, twoeEvent, eventTargets } from "./systems/adapters.mjs";
import { daggerheartRollEvent, daggerheartUseEvent, daggerheartDamageEvent, dualityAccent, versionBelow as daggerheartVersionBelow, DAGGERHEART_VERIFIED } from "./systems/daggerheart.mjs";
import { dhStateHost, dhDefeatedStates, DH_DEFEATED_STATUSES, findDhState } from "./catalogs/daggerheart/daggerheart-states.mjs";
import { applyEventElement } from "./catalogs/shared/element-choice.mjs";
import { AA_ID, AA_TAKEOVER, AA_FILL_GAPS, aaCustomized, aaAnimates, registerAATakeover } from "./integrations/automated-animations.mjs";
import { TA_ID, TA_FILL_GAPS, taAnimates } from "./integrations/trigger-animations.mjs";
import { MOTION_PRIORITY, guardSequencerMotions } from "./integrations/sequencer-motions.mjs";
import { registerSequencerSpeedups, sequencerSpeedupsApi, turboState, holdSession, hitStopReady } from "./integrations/sequencer-turbo/index.mjs";
import { createAdaptiveHost } from "./engines/playback/adaptive-host.mjs";
import { createHitStopHost } from "./engines/playback/hit-stop-host.mjs";
import { createLightHost } from "./engines/lighting/light-host.mjs";
import { registerSpellArsenal } from "./integrations/spell-arsenal.mjs";
import { registerTriggerEngine } from "./integrations/trigger-engine.mjs";
import { AnimaterRuntime, sameEffectName } from "./engines/playback/runtime.mjs";
import { nowPlayingRows } from "./ui/activity-actions.mjs";
import { installedSoundCatalog, catalogSoundOptions } from "./engines/sound/spell-sounds.mjs";
import { targetSurface, withSurfaceSounds, blowOfItem, sizeOf, heftOfItem } from "./engines/sound/surface-sounds.mjs";
import { weaponFamily } from "./systems/daggerheart.mjs";
import { installSoundPitch } from "./engines/sound/sound-pitch.mjs";
import { hitSoundsMenu } from "./ui/hit-sounds-settings.mjs";
import { peakOf } from "./engines/sound/hit-timing.mjs";
const soundPeaks = new Map();
import { Workspace, JB2A_MISSING } from "./ui/workspace.mjs";
import { mediaIndexStore } from "./engines/media/media-index-store.mjs";
import { MediaLibraryLoader } from './engines/media/media-library-sources.mjs';
import { libraryPreferences } from './ui/media-library.mjs';
import {TokenFxPreview} from './engines/preview/token-fx-preview.mjs';
import {tokenFx} from './engines/tokenshade/api.mjs';
import {warmShaders} from './engines/tokenshade/warmup.mjs';
import {normalizeLayers} from './engines/tokenshade/layers.mjs';
import { SceneFxPreview } from "./engines/preview/scene-fx-preview.mjs";
import {
  createCanvasPreviewArea,
  templateArea,
} from "./engines/preview/canvas-preview-area.mjs";
import { TokenMotionPlayer, motionDirection, withFragmentSeed, withFragmentCut, withFragmentTowards } from "./engines/motion/motion.mjs";
import { installedFxCatalog, OptionalFxPlayer, fxAvailability, startTokenFxPreview, effectOptions } from './engines/playback/optional-fx.mjs';
import {catalogFxSettings} from './catalogs/shared/catalog-fx.mjs';
import {conditionLookMode} from './catalogs/shared/condition-look-choice.mjs';
import {RUNE_SETTING} from './catalogs/pf2e/weapons/weapon-runes.mjs';
import {
  normalizeCatalogState,
  catalogSpell,
  spellRecipe,
  PF2E_SOURCE,
  PF2E_SPELLS,
} from "./catalogs/pf2e/spells/spell-catalog.mjs";
import {
  PF2E_FEATS,
  PF2E_FEAT_SOURCE,
  catalogFeat,
  featRecipe,
  normalizeFeatCatalogState,
} from "./catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG, isFeatureItem, riderRecipes } from "./catalogs/pf2e/ability-catalog.mjs";
// PF2e ability catalogs beside feats: setting key → catalog.
import { findCatalogSpell as findSpellEntry } from "./catalogs/pf2e/spells/spell-catalog.mjs";
import { teleportPlan, teleportVisuals, playTeleport, itemRangeFeet, pickTeleportSpot } from "./engines/motion/teleport.mjs";
import { isMoveStage, playMoveStage, previewMotion, allowedSpot, movePrompt, moveCone, ASK_TIMEOUT } from "./engines/motion/move-targets.mjs";
import { findCatalogFeat as findFeatEntry } from "./catalogs/pf2e/feats/feat-catalog.mjs";
import { findCatalogWeapon as findWeaponEntry } from "./catalogs/pf2e/weapons/weapon-catalog.mjs";
import { findStateEntry as findConditionEntry } from "./catalogs/pf2e/state-catalog.mjs";
import { findDndEntry as findDndCatalogEntry } from "./catalogs/dnd5e/dnd5e-catalog.mjs";
import { findSfEntry as findSfCatalogEntry } from "./catalogs/sf2e/sf2e-catalog.mjs";
const ABILITY_CATALOGS = { actionCatalog: PF2E_ACTION_CATALOG, featureCatalog: PF2E_FEATURE_CATALOG };
const abilitySettingKey = item => item?.type === "action" ? "actionCatalog" : isFeatureItem(item) ? "featureCatalog" : null;
import { PF2E_WEAPONS, PF2E_WEAPON_SOURCE, catalogWeapon, weaponRecipe, normalizeWeaponCatalogState } from "./catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_CONDITIONS, PF2E_EFFECTS, PF2E_STATE_SOURCE, normalizeStateCatalogState, catalogStateEntry, stateRecipe } from "./catalogs/pf2e/state-catalog.mjs";
import { PersistentStates, perceivedStates, LASTING_MODES, tokenLookChanged } from "./engines/playback/persistent-states.mjs";
import { DEFEATED_LOOK, registerDefeatedLook, installDefeatedLook, markDefeated, defeatedStates, defeatedStatusId, isDefeated } from "./engines/playback/defeated-look.mjs";
import { DND_KINDS,DND5E_SOURCE,dndEntries,dndEntry,dndRecipe,normalizeDndCatalogState,resolveDndAutomaticRecipe, addDndBookEntries } from './catalogs/dnd5e/dnd5e-catalog.mjs';
import { saveReaction, twoeSaveOutcome, dnd5eSaveOutcome } from './systems/outcome.mjs';
import { approvalState, approvedPlayerRecipe, playerSubmissions, validatePlayerRecipes, decide } from './core/player-recipes.mjs';
import { dndSettingKey,sfSettingKey,dhSettingKey, catalogListText } from './catalogs/shared/catalog-system.mjs';
import { dndStateHost } from './catalogs/dnd5e/dnd5e-states.mjs';
import {SF_KINDS,SF2E_SOURCE,sfEntries,sfEntry,sfRecipe,normalizeSfCatalogState} from './catalogs/sf2e/sf2e-catalog.mjs';
import {sfStateHost} from './catalogs/sf2e/sf2e-states.mjs';
import { CROSSOVER_CATALOG, crossoverSystem, crossoverResolve, crossoverSettingText, twoeCatalogRecipe, twoeSettingKey, seedBorrowedState, TWOE_KINDS } from "./systems/twoe-crossover.mjs";
import { DH_KINDS, DAGGERHEART_SOURCE, dhEntries, dhEntry, dhRecipe, normalizeDhCatalogState, resolveDaggerheartAutomaticRecipe, findDhEntry } from "./catalogs/daggerheart/daggerheart-catalog.mjs";
import {QUALITY_CHOICES,qualityRank,allowsMotion,allowsTokenFx, lightenEffect,stateBudget,usersForTier,usersForSound} from './core/quality.mjs';
import {ConditionBody,bodyTreatment} from './engines/motion/condition-body.mjs';
let conditionBody;
const localQuality=()=>{try{return game.settings.get('animater','quality');}catch{return 'full';}};
// Mirror this client's choice so the client that starts an animation can route optional layers.
const syncQuality=()=>{const value=localQuality(),user=game.user;if(typeof user?.getFlag==='function'&&typeof user.setFlag==='function'&&user.getFlag('animater','quality')!==value)void Promise.resolve(user.setFlag('animater','quality',value)).catch(()=>{});};
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let runtime, app;
registerTriggerEngine();
const mediaLibraryLoader=new MediaLibraryLoader(()=>({modules:game.modules,database:globalThis.Sequencer?.Database,
  folderSources:libraryPreferences(game.settings.get(ID,'mediaLibrary')).sources,
  browse:path=>foundry.applications.apps.FilePicker.implementation.browse('data',path)}),{store:mediaIndexStore()});
let motions;
let optionalFx;
let persistentStates;
let flash;
const clientId = uuid();
// Tokenshade, animater's own token shaders: local to this client, paused while token filters are off.
tokenFx.engine.enabled = () => allowsTokenFx(localQuality());
// Adaptive playback on this client (engines/playback/adaptive-host.mjs): Foundry is read only when it runs.
const adaptiveHost = createAdaptiveHost({
  state: turboState,
  quality: localQuality,
  catalog: () => runtime?.getCatalog() ?? [],
  weaponRecipes: (actor) => (actor?.items?.contents ?? []).filter((item) => ["weapon", "melee"].includes(item.type)).slice(0, 6)
    .map((item) => { try { return resolveEvent({ type: "attack", item, actor }); } catch { return null; } }).filter(Boolean),
  preload: (files) => Sequencer.Preloader.preload(files, false),
  endLocally: (effect) => queueMicrotask(() => void Sequencer.EffectManager.endEffects({ effects: [effect] }, false)),
  sceneId: () => canvas?.scene?.id,
  view: () => ({
    zoom: canvas?.stage?.scale?.x ?? 1, gridSize: canvas?.grid?.size ?? 100, targetMs: 1000 / (canvas?.app?.ticker?.maxFPS || 60),
    tokenSize: (uuid) => { try { const t = fromUuidSync(uuid)?.object; return t ? { width: t.w, height: t.h } : null; } catch { return null; } },
  }),
});
// Hit-stop on this client: a crit's tagged effects and motions freeze together at contact.
const hitStopHost = createHitStopHost({
  allowed: () => {
    try { return game.settings.get(ID, "hitStopLocal") !== false && qualityRank(localQuality()) >= 2 && !!canvas?.app?.ticker?.started && hitStopReady(); } catch { return false; }
  },
  holdEffects: holdSession,
  holdMotions: (owner, ms) => motions.hold(owner, ms),
});
// Effect lights on this client (engines/lighting/light-host.mjs): local Foundry light sources, never documents.
const lightHost = createLightHost({
  makeSource: (id) => {
    const source = new CONFIG.Canvas.lightSourceClass({ sourceId: `${ID}.light.${id}`, object: null });
    return {
      initialize: (data) => source.initialize(data),
      add: () => source.add(),
      // Brightness only: uniforms are refreshed, the wall polygon is kept.
      setLevel: ({ alpha, luminosity }) => { source.data.alpha = alpha; source.data.luminosity = luminosity; source.refresh(); },
      destroy: () => source.destroy(),
    };
  },
  refreshLighting: () => canvas?.perception?.update({ refreshLighting: true, refreshVision: true }),
  sceneId: () => canvas?.scene?.id,
  levelOk: (level) => { try { return !!canvas?.scene?.levels?.get(level ?? canvas.level?.id); } catch { return false; } },
  heldMs: (session, since) => sequencerSpeedupsApi.holds.heldMs(session, since),
  steady: () => { try { return game.settings.get(ID, "effectLightAnimation") === false; } catch { return false; } },
  gridSize: () => canvas?.grid?.size ?? 100,
  now: () => performance.now(),
});
// Light, Balanced and Low draw Animater's effects without blur or glow, on this client only (core/quality.mjs).
Hooks.on("createSequencerEffect", (effect) => { lightenEffect(effect?.data, localQuality()); adaptiveHost.onEffect(effect); hitStopHost.onEffect(effect?.data); lightHost.onEffect(effect); });
Hooks.on("endedSequencerEffect", (effect) => lightHost.onEnded(effect));
Hooks.on("canvasTearDown", () => lightHost.clear());
// canvas.app (and its ticker) survives scene changes; time each frame's work once per ticker: from before
// every other listener to after the canvas render (PIXI's Application renders at UPDATE_PRIORITY.LOW).
let adaptiveTicker = null;
Hooks.on("canvasReady", () => {
  adaptiveHost.onCanvasReady(performance.now());
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  if (ticker && P && adaptiveTicker !== ticker) {
    adaptiveTicker = ticker;
    ticker.add(() => adaptiveHost.onFrameStart(performance.now()), undefined, P.HIGH + 2);
    ticker.add(() => lightHost.tick(), undefined, P.NORMAL);
    ticker.add(() => adaptiveHost.onFrameEnd(performance.now()), undefined, P.UTILITY);
  }
});
// The next combatant's likely files load ahead on every client, one turn early.
Hooks.on("updateCombat", (combat, changed) => { if ("turn" in (changed ?? {}) || "round" in (changed ?? {})) adaptiveHost.onTurn(combat); });
tokenFx.custom = () => { try { return game.settings.get(ID, 'tokenFxPresets') ?? []; } catch { return []; } };
const fxCatalog = () => installedFxCatalog({
  modules:game.modules, tokenFx, fxmaster:globalThis.FXMASTER?.api,
  config:globalThis.CONFIG?.fxmaster, localize:key=>game.i18n.localize(key), isGM:game.user.isGM,
});
async function receiveOptionalFx(data) {
  if(!data || !optionalFx)return;
  const user=game.users.get(data.userId);
  if(!user)return;
  if(data.type==='fx-stop' || data.type==='stop')return optionalFx.stop({userId:user.id,session:data.type==='stop'?undefined:data.session});
  if(data.type!=='tokenfx' || !canvas.ready || data.sceneId!==canvas.scene?.id)return;
  if(!allowsTokenFx(localQuality()))return;
  const source=canvas.tokens.get(data.sourceId);
  if(!source || !(user.isGM || source.document.testUserPermission(user,'OWNER')))return;
  try {
    const stage=validateRecipe({id:'socket-tokenfx',name:'Tokenshade',trigger:'manual',stages:[{...data.stage,kind:'tokenfx',assets:[],afterStage:''}]}).stages[0];
    const token=stage.subject==='targets'?canvas.tokens.get(data.tokenId):source;
    if(token)await optionalFx.play({...stage,destination:token},{session:data.session,userId:user.id});
  } catch(error){console.warn('Animater Tokenshade:',error.message);}
}
async function receiveMotion(data, { strict = false } = {}) {
  if (!data || !canvas.ready) return;
  const user = game.users.get(data.userId);
  if (!user) return;
  if (data.type === "stop") {
    motions.stop(data.userId, { prefix: true });
    return;
  }
  if (data.type !== "motion") return;
  if (data.sceneId !== canvas.scene?.id) return;
  if (!allowsMotion(localQuality())) return;
  const source = canvas.tokens.get(data.sourceId);
  if (
    !source ||
    !(user.isGM || source.document.testUserPermission(user, "OWNER"))
  )
    return;
  try {
    const stage = validateRecipe({
      id: "socket-motion",
      name: "Motion",
      trigger: "manual",
      stages: [{ ...data.stage, kind: "motion" }],
    }).stages[0];
    const token =
      stage.subject === "targets" ? canvas.tokens.get(data.tokenId) : source;
    if (!token) return;
    const target = canvas.tokens.get(data.targetId);
    hitStopHost.onMotion(data);
    await motions.play(
      token,
      stage,
      motionDirection(token, source, target, stage.motion, canvas.grid?.size ?? 100),
      data.session ? `${data.userId}:${data.session}` : data.userId,
      { target: token === source ? target : source },
    );
  } catch (error) {
    if (strict) throw error;
    console.warn("Animater token motion:", error.message);
  }
}
const recipes = () =>
  clone(game.settings.get(ID, "recipes")?.recipes ?? starterRecipes());
const playerDecisions = () => game.settings.get(ID, "playerApprovals") ?? {};
// Players' finisher picks: the item's flag names it; it holds while the GM still gives it to an owner.
const ownerUsers = (actor) => [...(game.users?.values?.() ?? [])].filter((u) => !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map((u) => u.id);
// A synthetic strike (PF2e's basic unarmed or a rule-element strike, or a { actor, name, slug }
// descriptor) has no Item document: its pick lives on the actor, by strike slug or name, and it
// matches finishers by name and slug only (a rule-element strike's uuid names its feat).
const itemKeys = (item) => ({ itemName: item?.name, itemSlug: item?.slug ?? item?.system?.slug, itemUuid: picksOnActor(item) ? undefined : item?.uuid });
const choiceOf = (item) => (picksOnActor(item) ? strikePick(item.actor, strikeOf(item)) : item?.getFlag?.(ID, "finisher") ?? null);
const pickFor = (item) => (item ? pickedFinisher(recipes(), { choiceId: choiceOf(item), ownerUserIds: ownerUsers(item.actor), ...itemKeys(item) }) : null);
// A player's pick (pf2e-combater's item sheet, or api.finishers) replaces the GM's finishers for
// its item. With no pick, or one no longer given to an owner, every item keeps the GM's Applies-to
// matching and the default finisher; an NPC item's stray pick flag is ignored.
const ownerPick = (item) => (item && ownerUsers(item.actor).length > 0 ? pickFor(item) : null);
const finisherChoices = (item, user = game.user) => playerFinisherChoices(recipes(), { userId: user?.id, ...itemKeys(item) })
  .map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", on: r.finisher.on }));
// Other modules (pf2e-combater's item sheet) read and set an item's pick through api.finishers.
// Each takes an Item or a strike descriptor { actor, name, slug } (a synthetic strike's pick is
// stored on its actor). setChoice fires "animater.finisherChoiceChanged" (item, id) only on the
// client that changed it; other clients see the flag change through updateItem / updateActor.
const finishersApi = {
  choices: finisherChoices,
  getChoice: (item) => choiceOf(item),
  async setChoice(item, id) {
    const user = game.user, onActor = picksOnActor(item);
    if (onActor && !strikeKey(strikeOf(item))) throw new Error("A strike needs a name or slug.");
    const owned = onActor ? item.actor?.isOwner : item?.isOwner;
    if (!item || !(user?.isGM || owned)) throw new Error(onActor ? "Only the actor's owner or a GM can choose this strike's finisher." : "Only the item's owner or a GM can choose its finisher.");
    // A GM may pick any finisher given to one of the item's player owners (or, on an item no player
    // owns, any that applies to it); never one that would not play.
    const fits = (r) => r?.id === id && r.finisher && r.enabled !== false && matchFinishers([r], itemKeys(item), r.finisher.on).length > 0;
    const owners = ownerUsers(item.actor), offered = (u) => finisherChoices(item, u).some((c) => c.id === id);
    const allowed = !user.isGM ? offered(user) : owners.length ? owners.some((u) => offered({ id: u })) : recipes().some(fits);
    if (id !== null && !allowed) throw new Error("That finisher isn't available for this item.");
    if (onActor) {
      const key = strikeKey(strikeOf(item));
      if (id === null) await item.actor.unsetFlag(ID, `${STRIKE_FLAG}.${key}`); else await item.actor.setFlag(ID, STRIKE_FLAG, { [key]: id });
    } else if (id === null) await item.unsetFlag(ID, "finisher"); else await item.setFlag(ID, "finisher", id);
    Hooks.callAll("animater.finisherChoiceChanged", item, id);
  },
};
// One action plays a finisher once per target: a crit that then kills only adds the ending.
// The crit plays on the attacker's client and the kill on the client that applied the damage,
// so every client keeps the memory and a crit broadcasts its mark (or takes it back).
const finished = createFinishedMemory();
const announceFinished = (key, played) => {
  if (played) finished.mark(key); else finished.forget(key);
  game.socket?.emit?.(`module.${ID}`, { type: FINISHED_MESSAGE, sender: clientId, key, played });
};
const receiveFinished = (data) => {
  const message = finishedMessage(data);
  if (!message) return;
  if (message.played) finished.mark(message.key); else finished.forget(message.key);
};
const ownPlayerRecipes = () => clone(game.user?.getFlag?.(ID, "playerRecipes")?.recipes ?? []);
// The player whose animations the GM has open in the Studio, if any.
let reviewing = null;
const reviewedUser = () => (game.user?.isGM && reviewing ? game.users?.get(reviewing) ?? null : null);
const enabled = () => game.settings.get(ID, "automatic");
// Players' approved recipes play for their own characters even when the GM's
// automatic playback is off.
const ownApprovedRecipe = (event) => game.user?.isGM ? null : approvedPlayerRecipe(event, ownPlayerRecipes(), playerDecisions()[game.user.id], { owns: (actor) => Boolean(actor?.isOwner) });
const hasOwnApproved = () => !game.user?.isGM && ownPlayerRecipes().some((r) => approvalState(r, playerDecisions()[game.user.id]) === "approved");
const acceptsEvents = () =>
  enabled() ||
  (game.system.id === "sf2e" && SF_KINDS.some(kind=>{const state=game.settings.get(ID,sfSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === 'dnd5e' && DND_KINDS.some(kind=>{const state=game.settings.get(ID,dndSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === 'daggerheart' && DH_KINDS.some(kind=>{const state=game.settings.get(ID,dhSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === "pf2e" &&
    ["spellCatalog", "featCatalog", "actionCatalog", "featureCatalog", "weaponCatalog"].some((key) => {
      const state = game.settings.get(ID, key);
      return state?.enabled && state.independent;
    }));
function environment() {
  const seq = game.modules.get("sequencer");
  const patreon = game.modules.get("jb2a_patreon");
  const free = game.modules.get("JB2A_DnD5e");
  const databaseReady = Boolean(
    globalThis.Sequencer?.Database?.entryExists?.("jb2a"),
  );
  const pack = patreon?.active
    ? "JB2A Patreon"
    : free?.active
      ? "JB2A Free"
      : "Sequencer media";
  const system =
    { pf2e: "Pathfinder 2e", sf2e: "Starfinder 2e", dnd5e: "D&D 5e", daggerheart: "Daggerheart" }[game.system.id] ??
    game.system.title;
  const supported = ["pf2e", "sf2e", "dnd5e", "daggerheart"].includes(game.system.id);
  const ready = Boolean(seq?.active && globalThis.Sequencer);
  return {
    ready,
    // Built-in animations draw on JB2A artwork: one of the two packs must be active.
    jb2a: Boolean(patreon?.active || free?.active),
    // Active is not enough: its animations must also be registered in Sequencer's database.
    jb2aRegistered: databaseReady,
    motionReady: game.modules.get(ID)?.socket === true,
    version: game.modules.get(ID)?.version,
    motionServerVersion: game.modules.get(ID)?.version,
    systemId: game.system.id,
    crossover: crossoverOn(),
    pack,
    system,
    conflicts: ["autoanimations", "trigger-animations"]
      .filter((id) => game.modules.get(id)?.active && !(id === AA_ID && (aaTakeover() || aaFillGaps())) && !(id === TA_ID && taFillGaps()))
      .map((id) => game.modules.get(id).title),
    problem: !seq?.active
      ? "Turn on Sequencer in Manage Modules, then reload the world (F5)."
      : !databaseReady
        ? "Turn on JB2A Free or JB2A Patreon in Manage Modules, then reload the world (F5)."
        : "Turn on one JB2A pack in Manage Modules, then reload the world (F5).",
    dependencies: [
      {
        name: "Sequencer",
        ok: seq?.active,
        detail: seq?.active
          ? `Playback engine · ${seq.version}`
          : "Required · install it, then turn it on in Manage Modules",
      },
      {
        name: pack,
        ok: databaseReady,
        detail: databaseReady
          ? "Installed variants available · no assets bundled"
          : patreon?.active || free?.active
            ? "Turned on, but Sequencer lists no JB2A animations yet · reload the world (F5); if it stays empty, update JB2A and Sequencer to their latest versions"
            : "Required for built-in animations · install JB2A Free (or Patreon) and turn it on in Manage Modules",
      },
      {
        name: system,
        ok: supported,
        detail: supported
          ? `${game.system.version} · automatic adapter available`
          : "Manual playback available; automatic adapter unavailable",
      },
    ],
  };
}
function sourceFor(event) {
  if (event.source) return event.source.object ?? event.source;
  // A save against the saver's own effect: no attacker, not even the item actor's token.
  if (event.noSource) return null;
  if (event.sceneId && event.sceneId !== canvas.scene?.id) return null;
  if (event.tokenId) return canvas.tokens?.get(event.tokenId) ?? null;
  const actorId = event.actor?.id ?? event.item?.actor?.id;
  if (!actorId) return null;
  const tokens = (canvas.tokens?.placeables ?? []).filter(
    (t) => t.actor?.id === actorId,
  );
  const selected = tokens.filter((t) => t.controlled);
  return selected.length === 1
    ? selected[0]
    : tokens.length === 1
      ? tokens[0]
      : null;
}
function circleArea(template, source, spec) {
  const doc = template?.document ?? template;
  if (!doc) return null;
  return templateArea(template, {
    source,
    spec,
    gridSize: canvas.grid?.size ?? 100,
    gridDistance: canvas.scene?.grid.distance ?? 5,
  });
}
function manualContext() {
  const source = canvas.tokens?.controlled?.[0];
  const template =
    canvas.regions?.controlled?.[0] ?? canvas.templates?.controlled?.[0];
  return {
    source,
    targets: Array.from(game.user.targets ?? []),
    template,
    area: circleArea(
      template,
      source,
      (template?.item ?? template?.document?.item)?.system?.area,
    ),
  };
}
async function enrich(event) {
  if (!event.item && event.itemUuid)
    event.item = await fromUuid(event.itemUuid);
  event.source = sourceFor(event);
  if (event.sceneId && event.sceneId !== canvas.scene?.id) return null;
  if(event.targetUuids?.length){
    event.targets=(await Promise.all(event.targetUuids.map(uuid=>fromUuid(uuid)))).map(doc=>doc?.object).filter(token=>token?.document?.parent?.id===canvas.scene?.id);
  }else if (event.targetUuid) {
    const doc =
      typeof event.targetUuid === "string"
        ? await fromUuid(event.targetUuid)
        : null;
    event.targets = eventTargets(event, doc?.object ?? null, Array.from(game.user.targets ?? []));
  } else event.targets = Array.from(game.user.targets ?? []);
  event.area = eventArea(event);
  return event;
}
function eventArea(event) {
  return circleArea(
    event.template,
    event.source,
    (event.systemId ?? game.system.id)==='dnd5e' ? {...event.activity?.target?.template,type:event.activity?.target?.template?.type==='wall'?'line':event.activity?.target?.template?.type} : event.item?.system?.area,
  );
}
function findRecipe(id) {
  if (id && typeof id === "object") return id;
  const saved = recipes();
  return saved.find(r=>r.id===id) ?? builtinRecipe(id) ??
    saved.find(r=>typeof id === "string" && r.name?.trim().toLowerCase() === id.trim().toLowerCase());
}
// Where a finisher's mover lands: walks the grid until a wall, the scene edge or `squares`.
const finisherWalk = (mover, direction, squares) => ({
  from: { x: mover.document.x, y: mover.document.y }, direction, squares, grid: canvas.grid.size, size: { w: mover.w, h: mover.h },
  collides: (a, b) => CONFIG.Canvas.polygonBackends.move.testCollision(a, b, { type: "move", mode: "any" }),
  bounds: canvas.dimensions.sceneRect, snap: (p) => mover.getSnappedPosition?.(p) ?? p,
});
const finisherLanding = (mover, direction, squares) => landingSpot(finisherWalk(mover, direction, squares));
// How far (squares) the first wall is along that walk, or null: Wall slam seeks the nearest one.
const finisherWallHit = (mover, direction, squares) => wallDistance(finisherWalk(mover, direction, squares));
// A test play (studio Play at table / Local preview, api.play, api.preview). A finisher with a
// mover token plays composed as a kill would (wall cut, crash and landing where the token hits)
// but writes nothing; anything else, or a finisher with no token to move, plays as authored.
function playTest(recipe, context, options = {}) {
  const host = { gridSize: () => canvas.grid.size, landing: finisherLanding, wallHit: finisherWallHit, trace: (status, detail) => runtime.trace(status, detail) };
  const { onStart, ...rest } = options;
  return previewFinisher(recipe, context, host, (composed, ctx, first) => runtime.play(composed, ctx, first ? options : rest))
    ?? runtime.play(recipe, context, options);
}
// Dice So Nice: an attack or damage animation waits until that roll's 3D dice land
// (never longer than DICE_WAIT_LIMIT, and not at all when Dice So Nice shows none).
const WAIT_FOR_DICE = "waitForDice", DICE_WAIT_LIMIT = 8000;
const DAMAGE_REACTIONS = "damageReactions", DRAMATIC_DEATHS = "dramaticDeaths", TELEPORT_TOKENS = "teleportTokens", DEFAULT_FINISHER = "defaultFinisher", DEFAULT_FINISHER_ENDING = "defaultFinisherEnding", DUALITY_ACCENT = "daggerheartDualityAccent";
const COLLAPSE = { id: "animater-collapse", name: "Dropped to 0 HP", trigger: "manual", stages: [{ stageId: "collapse", kind: "motion", motion: "collapse", subject: "source", duration: 1800, distance: 0.25, intensity: 0.8, assets: [] }] };
async function afterDice(event) {
  const dice = globalThis.game?.dice3d;
  if (!event.messageId || !dice?.waitFor3DAnimationByMessageID || !(["attack", "damage", "save", "check"].includes(event.type) || event.skillCheck)) return;
  if (game.settings.get(ID, WAIT_FOR_DICE) === false) return;
  // Dice So Nice marks the message as animating from its own creation hook.
  await new Promise((resolve) => setTimeout(resolve, 60));
  await Promise.race([dice.waitFor3DAnimationByMessageID(event.messageId), new Promise((resolve) => setTimeout(resolve, DICE_WAIT_LIMIT))]);
}
async function playSaveReaction(outcome, tokenId, messageId, sceneId) {
  if (!acceptsEvents() || (sceneId && sceneId !== canvas.scene?.id)) return;
  const token = canvas.tokens?.get(tokenId), recipe = saveReaction(outcome);
  if (!token || !recipe) return;
  await afterDice({ type: "save", messageId });
  await runtime.play(recipe, { source: token, targets: [] }).catch((error) => runtime.trace("Blocked", error.message));
}
// Set once Foundry is ready (finisher wiring); dispatch hands every enriched event to it.
let playUseFinishers = async () => {};
// Items whose event came while nothing plays automatically: logged once a minute each, so the
// Activity page can say why instead of staying silent.
const offNoted = new Map();
async function dispatch(event) {
  if (!event) return;
  if (!(acceptsEvents() || hasOwnApproved())) {
    const name = event.item?.name, now = Date.now();
    if (name && game.user.isGM && now - (offNoted.get(name) ?? 0) > 60000) {
      offNoted.set(name, now);
      runtime.trace("Skipped", `${name}: nothing is set to play automatically.`, null, { item: name, reason: "off", itemType: event.item?.type });
    }
    return;
  }
  // An event the adapter chose not to play (a hidden roll): Activity says why.
  if (event.skipped) return runtime.trace("Skipped", event.skipped);
  if (yieldsToAA(event)) return runtime.trace("Skipped", `${event.item?.name ?? "Unknown item"}: ${aaYield(event)}.`, null, { item: event.item?.name, reason: "aa", why: aaYield(event) });
  try {
    await afterDice(event);
    const enriched = await enrich(event);
    // A maneuver's check carries its finishers on its own (checkFinisherEvent): never twice.
    await Promise.all([runtime.dispatch(enriched), enriched?.skillCheck ? null : playUseFinishers(enriched)]);
  } catch (error) {
    runtime.trace("Blocked", error.message);
  }
}
export class AnimaterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "animater-workspace",
    classes: ["animater"],
    tag: "div",
    window: { title: "Animater", resizable: true },
    position: { width: 1240, height: 880 },
  };
  static PARTS = {
    workspace: { template: "modules/animater/templates/workspace.hbs" },
  };
  async _prepareContext() {
    return {};
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element.querySelector(".an-root");
    if (this.workspace?.root !== root) {
      this.workspace?.destroy();
      this.workspace = new Workspace(root, workspaceHost());
    }
  }
  async close(options) {
    // Unsaved recipe edits live only in this window: ask before throwing them away.
    const unsaved = this.workspace?.unsavedNames?.() ?? [];
    if (unsaved.length && !options?.force) {
      const list = unsaved.slice(0, 3).map((n) => `“${String(n).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}”`).join(", ") + (unsaved.length > 3 ? ` and ${unsaved.length - 3} more` : "");
      const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Unsaved changes" }, content: `<p>Close Animater and discard your unsaved changes to ${list}?</p>` }).catch(() => false);
      if (!ok) return this;
    }
    this.workspace?.destroy();
    this.workspace = null;
    return super.close(options);
  }
}
// Players open their own Studio (their recipes, pending GM approval); the GM gets everything.
function open() {
  app ??= new AnimaterApp();
  return app.render({ force: true });
}
// The catalog page an item's animation lives on (by system and item type).
function itemPage(item) {
  const type = item?.type, sys = game.system.id;
  if (sys === "daggerheart") return type === "domainCard" ? "spells" : type === "weapon" ? "weapons" : null;
  if (type === "spell") return "spells";
  if (type === "weapon" || (sys !== "dnd5e" && type === "shield")) return "weapons";
  if (type === "condition") return "conditions";
  if (type === "effect") return "effects";
  if (sys === "dnd5e") return type === "feat" ? "feats" : ["consumable", "equipment", "tool", "loot", "container"].includes(type) ? "items" : null;
  if (type === "action") return "actions";
  if (type === "feat") return sys === "pf2e" && isFeatureItem(item) ? "features" : "feats";
  return null;
}
// The catalog entry for an item (by its compendium source, like playback finds it), or null.
function catalogEntryFor(item) {
  const event = { type: "use", item, actor: item.actor, systemId: game.system.id };
  try {
    if (game.system.id === "dnd5e") return findDndCatalogEntry(event);
    if (game.system.id === "sf2e") return findSfCatalogEntry(event);
    if (game.system.id === "daggerheart") return findDhEntry(event);
    if (item.type === "spell") return findSpellEntry(event);
    if (["weapon", "shield", "melee"].includes(item.type)) return findWeaponEntry(event);
    if (["condition", "effect"].includes(item.type)) return findConditionEntry(item);
    const key = abilitySettingKey(item);
    if (key) return ABILITY_CATALOGS[key].find(event);
    if (item.type === "feat") return findFeatEntry(event);
  } catch {}
  return null;
}
// Where an automatic animation comes from, for the Activity page's Exclude: a saved recipe, or a
// built-in catalog entry (catalog kind + entry id). null when neither is known (e.g. a damage rider).
const PAGE_KINDS = { spells: "spell", weapons: "weapon", conditions: "condition", effects: "effect", feats: "feat", actions: "action", features: "feature", items: "item" };
function recipeOrigin(recipe, context = {}) {
  if (!recipe?.id) return null;
  if (recipes().some((r) => r.id === recipe.id)) return { type: "recipe", id: recipe.id };
  const sys = game.system.id, named = recipe.catalogEntry ?? recipe.stateEntry;
  if (named) {
    // A PF2e world's borrowed SF2e entries are managed on their own pages.
    const sf = sys === "sf2e" || (recipe.systemId === "sf2e" && borrowsSfPages());
    const entry = sf ? sfEntry(named) : sys === "dnd5e" ? dndEntry(named) : sys === "daggerheart" ? dhEntry(named) : catalogStateEntry(named);
    if (entry?.kind) return { type: "catalog", system: sf ? "sf2e" : sys, kind: entry.kind, id: entry.id ?? named };
  }
  const item = context?.item, entry = item ? catalogEntryFor(item) : null;
  // A rider (Sneak Attack on a Strike) plays for the Strike's item but is not its entry.
  if (!entry?.id || !String(recipe.id).includes(entry.id)) return null;
  const kind = sys === "pf2e" ? PAGE_KINDS[itemPage(item)] : entry.kind;
  return kind ? { type: "catalog", system: sys, kind, id: entry.id } : null;
}
// Activity page Stop: a GM ends a lasting animation for everyone; a player only on their own screen.
async function stopActivityRow(row) {
  if (row?.kind === "state" && row.key) {
    await persistentStates?.stop(row.key);
    if (game.user.isGM) game.socket?.emit?.(`module.${ID}`, { type: "activity-stop", sender: clientId, userId: game.user.id, key: row.key });
    return;
  }
  if (row?.kind === "session" && row.session) await runtime.endSession(row.session, { everyone: game.user.isGM });
}
function receiveActivityStop(data, senderId) {
  if (data?.type !== "activity-stop" || !data.key) return;
  if (!game.users.get(senderId ?? data.userId)?.isGM) return;
  void persistentStates?.stop(data.key);
}
// An item sheet's Animater button: your own recipe for it in the Studio, else its catalog entry.
async function openForItem(item) {
  if (!game.user.isGM || !item) return;
  let recipe = null;
  try { recipe = resolveEvent({ type: "use", item, actor: item.actor, systemId: game.system.id }); } catch {}
  const saved = recipe && recipes().find((r) => r.id === recipe.id);
  await open();
  const w = app?.workspace;
  if (!w) return;
  // An NPC's "Slow (2/day)" is the catalog's "Slow".
  const entry = saved ? null : catalogEntryFor(item);
  if (!w.reveal(saved ? { recipeId: saved.id } : { page: itemPage(item), name: entry?.name ?? item.name.replace(/\s*\([^)]*\)\s*$/, ""), id: entry?.id })) w.message = `No Animater catalog covers ${item.name}; make a recipe for it with + New recipe.`;
  w.render();
}
// Teleport (recipes that ask for it): pick the spot on the canvas, then vanish and reappear.
const placeable = (t) => t?.object ?? t;
async function pickTeleport(recipe, context) {
  if (!game.settings.get(ID, TELEPORT_TOKENS)) return null;
  const plan = teleportPlan(recipe);
  if (!plan) return null;
  const caster = placeable(context.source), mover = plan.who === "target" ? placeable(context.targets?.[0]) : caster;
  if (!caster?.center) return null;
  if (!mover?.center) { ui.notifications.warn("Teleport: target the creature to move first."); return null; }
  const feet = plan.adjacent ? 5 : plan.range || itemRangeFeet(context.item) || Infinity;
  ui.notifications.info(`Teleport ${mover.name}: click a spot${Number.isFinite(feet) ? ` within ${feet} feet` : ""} (Esc to cancel).`);
  const spot = await pickTeleportSpot({ caster, mover, feet, notify: (text) => ui.notifications.warn(text) });
  return spot ? { mover, caster, ...spot, visuals: teleportVisuals(recipe, runtime.getCatalog()) } : null;
}
async function moveToken(doc, x, y) { await doc.update({ x, y }, { animate: false, animater: { teleport: true } }); }
async function teleport(spot) {
  return playTeleport(spot, {
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    effect: (asset, point, size, tint) => {
      const effect = new Sequence({ moduleName: ID }).effect().file(asset).atLocation(point).size(size);
      if (tint) effect.tint(tint);
      void effect.play().catch(error => console.warn('Animater teleport effect:', error.message));
    },
    move: async (mover, x, y) => {
      const doc = mover.document;
      // A creature this player does not own (an ally fetched to them) is moved by the active GM.
      if (doc.isOwner) await moveToken(doc, x, y);
      else game.socket.emit(`module.${ID}`, { type: "teleport", sender: clientId, userId: game.user.id, uuid: doc.uuid, casterUuid: spot.caster?.document?.uuid, x, y });
    },
  });
}
// The active GM moves a teleported token for the player who cast the spell: only when that
// player owns the caster, and only a token on the caster's scene.
// `senderId` is the id Foundry's server attaches to the relayed event; data.userId could be forged.
async function receiveTeleport(data, senderId) {
  if (data?.type !== "teleport" || !game.users.activeGM?.isSelf) return;
  const user = senderId ? game.users.get(senderId) : null, doc = await fromUuid(String(data.uuid ?? ""));
  const caster = await fromUuid(String(data.casterUuid ?? ""));
  if (!user || !doc || doc.documentName !== "Token" || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
  if (caster?.documentName !== "Token" || caster.parent !== doc.parent || !caster.testUserPermission(user, "OWNER")) return;
  await moveToken(doc, data.x, data.y);
}
// Push and Pull stages where someone picks the square. "actor": the one playing the recipe (this client).
// "target": the target's side, its connected owning player (their character), else the GM, on their own screen.
// Esc, or no pick in time, leaves the target where it is.
const movePicks = new Map();
const tokenOf = (doc) => doc?.object ?? doc;
// The square (top-left) picked on this screen: inside the ring, the right way, with no wall in between.
function pickMoveSpot({ mover, source, squares, pull, degrees = 90 }) {
  const grid = canvas.grid.size, distance = canvas.scene?.grid?.distance ?? 5;
  const wallFree = (center) => !CONFIG.Canvas.polygonBackends?.move?.testCollision?.(mover.center, center, { type: "move", mode: "any" });
  ui.notifications.info(movePrompt(pull, mover, source, squares));
  return pickTeleportSpot({ caster: mover, mover, feet: squares * distance, notify: (text) => ui.notifications.warn(text),
    allow: (center) => allowedSpot({ mover, source, center, pull, grid, degrees }) && wallFree(center), cone: moveCone({ mover, source, pull, degrees }),
    outside: `Pick a square inside the shaded area, ${pull ? "toward" : "away from"} ${source.name}, with no wall in the way.` });
}
// A picked square stands only if it keeps the rules here too (an answer from another screen included).
function keepsMoveRules(spot, { mover, source, squares, pull, degrees = 90 }) {
  if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.y)) return null;
  const grid = canvas.grid.size, center = { x: spot.x + mover.w / 2, y: spot.y + mover.h / 2 };
  const far = Math.max(Math.abs(center.x - mover.center.x), Math.abs(center.y - mover.center.y)) / grid;
  return far <= squares + 0.01 && allowedSpot({ mover, source, center, pull, grid, degrees }) ? { x: spot.x, y: spot.y } : null;
}
async function pickMove(who, request) {
  const { mover } = request, doc = mover?.document ?? mover;
  const player = who === "target" ? game.users.find((u) => u.active && !u.isGM && doc?.testUserPermission?.(u, "OWNER")) : null;
  const asked = who === "target" ? player ?? game.users.activeGM : game.user;
  if (!asked || asked.isSelf) return keepsMoveRules(await pickMoveSpot(request), request);
  const id = foundry.utils.randomID();
  const picked = new Promise((resolve) => { movePicks.set(id, { resolve, from: asked.id }); setTimeout(() => { if (movePicks.delete(id)) resolve(null); }, ASK_TIMEOUT); });
  game.socket.emit(`module.${ID}`, { type: "move-pick", sender: clientId, id, to: asked.id, moverUuid: doc.uuid, sourceUuid: (request.source.document ?? request.source).uuid, squares: request.squares, pull: request.pull === true, degrees: request.degrees });
  return keepsMoveRules(await picked, request);
}
// Asked on this screen: pick, and send the square back. A square counts only from the user it was asked of.
async function receiveMovePick(data, senderId) {
  if (data?.type === "move-pick" && data.to === game.user.id && senderId) {
    const mover = tokenOf(await fromUuid(String(data.moverUuid ?? ""))), source = tokenOf(await fromUuid(String(data.sourceUuid ?? "")));
    const squares = Math.min(10, Math.max(1, Math.round(Number(data.squares) || 1)));
    const degrees = Math.min(180, Math.max(10, Math.round(Number(data.degrees) || 90)));
    const spot = mover?.center && source?.center ? await pickMoveSpot({ mover, source, squares, pull: data.pull === true, degrees }) : null;
    game.socket.emit(`module.${ID}`, { type: "move-picked", sender: clientId, id: data.id, spot: spot ? { x: spot.x, y: spot.y } : null });
  } else if (data?.type === "move-picked") {
    const waiting = movePicks.get(data.id);
    if (!waiting || waiting.from !== senderId) return;
    movePicks.delete(data.id);
    waiting.resolve(data.spot ?? null);
  }
}
// A finisher ends in at most three writes: the move where its travel landed, then hidden
// or Defeated. A player's request goes to the active GM.
async function applyDisplace(doc, { x, y, hidden, defeated, fromX, fromY, finisher }) {
  const update = {};
  // The GM writes this flag from a player's request: only finite numbers and a short name.
  const origin = Number.isFinite(fromX) && Number.isFinite(fromY) ? { fromX, fromY } : {};
  if (Number.isFinite(x) && Number.isFinite(y)) Object.assign(update, { x, y, [`flags.${ID}.displaced`]: { ...origin, finisher: (typeof finisher === "string" ? finisher : "").slice(0, 80) } });
  if (hidden === true) update.hidden = true;
  if (Object.keys(update).length) await doc.update(update, { animate: false, animater: { displace: true } });
  if (defeated === true) await markDefeated(doc.actor, game.settings.get(ID, DEFEATED_LOOK));
}
async function commitDisplace(token, data, attacker = null) {
  if (game.user.isGM) return applyDisplace(token.document, data);
  // Nobody would write it: throw so the finisher traces it and the token eases back.
  if (!game.users.activeGM) throw new Error("no GM is connected to finish it");
  game.socket.emit(`module.${ID}`, { type: "displace-commit", sender: clientId, userId: game.user.id, uuid: token.document.uuid, attackerUuid: attacker?.document?.uuid, ...data });
}
async function receiveDisplace(data, senderId) {
  if (data?.type !== "displace-commit" || !game.users.activeGM?.isSelf) return;
  const user = senderId ? game.users.get(senderId) : null, doc = await fromUuid(String(data.uuid ?? ""));
  if (!user || doc?.documentName !== "Token") return;
  // A move stays within the longest landing (a keyframed path's) of where the token stands, and on the scene.
  const grid = canvas.grid?.size ?? 100, w = doc.width ?? 1, h = doc.height ?? 1;
  if ((data.x !== undefined || data.y !== undefined) && !withinKnockback({ from: { x: doc.x, y: doc.y }, to: { x: data.x, y: data.y }, grid,
    size: Math.max(w, h), bounds: canvas.dimensions?.sceneRect ?? null, footprint: { w: w * grid, h: h * grid } })) return;
  const attacker = data.attackerUuid ? await fromUuid(String(data.attackerUuid)) : null;
  const ownsAttacker = attacker?.documentName === "Token" && attacker.parent === doc.parent && attacker.testUserPermission(user, "OWNER");
  const request = { isOwner: mayDisplace({ ownsToken: doc.testUserPermission(user, "OWNER"), ownsAttacker }), alreadyHidden: doc.hidden, hp: displaceHp(doc.actor, game.system.id),
    hidden: data.hidden === true, defeated: data.defeated === true, ...(data.x !== undefined || data.y !== undefined ? { x: data.x, y: data.y } : {}) };
  if (!displaceAllowed(request)) return;
  await applyDisplace(doc, data);
}
// Every built-in catalog of this system: turn them all on at once (exclusions and your own
// recipes stay), as each catalog's own "Use the catalog" button does.
const CATALOG_KINDS = { pf2e: ["spellCatalog", "featCatalog", "actionCatalog", "featureCatalog", "weaponCatalog", "conditionCatalog", "effectCatalog"],
  sf2e: ["spell", "feat", "action", "feature", "weapon", "item", "condition", "effect"].map(sfSettingKey),
  dnd5e: ["spell", "feat", "weapon", "item", "condition", "effect"].map(dndSettingKey),
  daggerheart: DH_KINDS.map(dhSettingKey) };
const crossoverOn = () => game.settings.get(ID, CROSSOVER_CATALOG) === true;
// A PF2e world shows (and so manages) the SF2e catalogs it borrows.
const borrowsSfPages = () => game.system.id === "pf2e" && crossoverOn();
// The other 2e system whose catalogs this world shows and plays (crossover on), or null.
const borrowedSystemId = () => (crossoverOn() ? crossoverSystem(game.system.id) : null);
async function seedBorrowedCatalogs() {
  const other = borrowedSystemId();
  if (!other || !game.user.isGM || !(game.users.activeGM?.isSelf ?? true)) return;
  for (const kind of TWOE_KINDS) {
    const key = twoeSettingKey(other, kind), seeded = seedBorrowedState(game.settings.get(ID, twoeSettingKey(game.system.id, kind)), game.settings.get(ID, key));
    if (seeded) await game.settings.set(ID, key, other === "sf2e" ? normalizeSfCatalogState(seeded) : seeded);
  }
}
const catalogKeys = () => [...(CATALOG_KINDS[game.system.id] ?? []), ...(borrowedSystemId() ? TWOE_KINDS.map((kind) => twoeSettingKey(borrowedSystemId(), kind)) : [])].filter((key) => game.settings.settings.has(`${ID}.${key}`));
const catalogOn = (key) => { const s = game.settings.get(ID, key) ?? {}; return s.enabled === true && (s.scope ?? "all") === "all"; };
function catalogsOn() { const keys = catalogKeys(); return { on: keys.filter(catalogOn).length, total: keys.length }; }
async function useEveryCatalog() {
  if (!game.user.isGM) throw Error("Only a GM can turn catalogs on.");
  for (const key of catalogKeys()) await game.settings.set(ID, key, { ...(game.settings.get(ID, key) ?? {}), enabled: true, scope: "all", independent: true, preferCatalog: true });
  if (!game.settings.get(ID, "automatic")) await game.settings.set(ID, "automatic", true);
  persistentStates?.schedule();
  return catalogsOn();
}
// Once per world, on first load as the active GM: offer to turn every catalog on (only when
// none is on yet, so a table that already chose its catalogs is never asked).
async function welcome() {
  if (!game.user.isGM || !(game.users.activeGM?.isSelf ?? true) || game.settings.get(ID, "welcomed")) return;
  await game.settings.set(ID, "welcomed", true);
  if (catalogsOn().on > 0) return;
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Animater: welcome" },
    content: `<p><b>Turn on every built-in animation?</b></p><p>${(() => { const t = catalogListText({ systemId: game.system.id }); return t.charAt(0).toUpperCase() + t.slice(1); })()} then animate automatically when used: no setup. You can pause any catalog, leave out single entries or customize them later in Animater.</p>`,
    yes: { label: "Turn them all on" }, no: { label: "Not now" },
  }).catch(() => false);
  if (!yes) return void ui.notifications.info("Animater: open Animater → Setup to turn every catalog on later.");
  const { on, total } = await useEveryCatalog();
  ChatMessage.create({ whisper: [game.user.id], speaker: { alias: "Animater" }, content: `<p><b>Animater is ready.</b> ${on} of ${total} catalogs are on: ${catalogListText({ systemId: game.system.id })} animate when used. Open Animater to pause a catalog, exclude an entry or make your own version.</p>` });
}
// A catalog recipe by id; an SF2e id in a PF2e world (or back) once crossover is on.
function builtinRecipe(id) {
 const sys=game.system.id,other=crossoverOn()?crossoverSystem(sys):null;
 return systemBuiltinRecipe(id,sys)??(other?systemBuiltinRecipe(id,other):null);
}
function systemBuiltinRecipe(id,sys) {
 if(sys==='sf2e'){
  const entry=sfEntry(id);if(!entry)return null;
  const state=normalizeSfCatalogState(game.settings.get(ID,sfSettingKey(entry.kind))),variant=entry.variants.find(v=>v.recipe.id===id);
  return sfRecipe(entry,variant?.id,{motion:state.motion,sounds:state.sound?installedSoundCatalog(game.modules,globalThis.Sequencer?.Database):null,soundVolume:state.soundVolume,catalog:runtime.getCatalog()});
 }
 if(sys==='dnd5e') {
  const entry=dndEntry(id)??dndEntries().find(e=>e.variants.some(v=>v.recipe.id===id));
  if(!entry)return null;
  const variant=entry.variants.find(v=>v.recipe.id===id),state=normalizeDndCatalogState(game.settings.get(ID,dndSettingKey(entry.kind)));
  return dndRecipe(entry,variant?.id,{motion:state.motion,sounds:state.sound?installedSoundCatalog(game.modules,globalThis.Sequencer?.Database):null,soundVolume:state.soundVolume});
 }
 if(sys==='daggerheart'){
  const entry=dhEntry(id)??dhEntries().find(e=>e.variants.some(v=>v.recipe.id===id));
  if(!entry)return null;
  const variant=entry.variants.find(v=>v.recipe.id===id),state=normalizeDhCatalogState(game.settings.get(ID,dhSettingKey(entry.kind)));
  return dhRecipe(entry,variant?.id,{motion:state.motion,sounds:state.sound?installedSoundCatalog(game.modules,globalThis.Sequencer?.Database):null,soundVolume:state.soundVolume});
 }
 if(sys!=='pf2e')return null;
 return (catalogStateEntry(id) && stateRecipe(catalogStateEntry(id),{catalog:runtime.getCatalog()})) ??
        (catalogSpell(id) &&
          spellRecipe(
            catalogSpell(id),
            undefined,
            catalogSoundOptions(workspaceHost()),
          )) ??
        (catalogWeapon(id) && weaponRecipe(catalogWeapon(id), /-(melee|ranged|thrown)$/.exec(id)?.[1], { motion: game.settings.get(ID, "weaponCatalog")?.motion !== false, soundCatalog: game.settings.get(ID, "weaponCatalog")?.sound === false ? null : installedSoundCatalog(game.modules, globalThis.Sequencer?.Database), soundVolume: game.settings.get(ID, "weaponCatalog")?.soundVolume })) ??
        Object.entries(ABILITY_CATALOGS).map(([key,catalog])=>catalog.entry(id)&&catalog.recipe(catalog.entry(id),game.settings.get(ID,key)??{},installedSoundCatalog(game.modules,globalThis.Sequencer?.Database))).find(Boolean) ??
        (catalogFeat(id) &&
          featRecipe(catalogFeat(id), {
            motion: game.settings.get(ID, "featCatalog")?.motion !== false,
            soundVolume: game.settings.get(ID, "featCatalog")?.soundVolume,
            soundCatalog: game.settings.get(ID, "featCatalog")?.sound === false ? null : installedSoundCatalog(
              game.modules,
              globalThis.Sequencer?.Database,
            ),
          }));
}
// FXMaster particles drawn on this client's canvas only (Local preview): FXMaster's
// own particle class runs in a scoped context over the scene, nothing is saved.
const LOCAL_PARTICLE_PREWARM = 6;
// The template's Region document: Foundry 14 keeps a MeasuredTemplate as a Region
// with the same id. A private preview area is not in the Scene and has none.
function templateRegion(template) {
  const doc = template?.document ?? template;
  const region = doc?.documentName === "MeasuredTemplate" ? doc.parent?.regions?.get?.(doc.id) : doc?.documentName === "Region" ? doc : null;
  return region?.parent?.regions?.get?.(region.id) === region ? region : null;
}
// FXMaster particles or filters kept inside a placed template: a temporary FXMaster
// region behavior on the template's Region (removed when the stage ends, and with
// the template). Returns null when the template has no Region in the Scene.
async function regionFx(stage, effect, template) {
  const region = templateRegion(template);
  const category = stage.fxCategory ?? "particle";
  const type = category === "particle" ? "fxmaster.particleEffectsRegion" : "fxmaster.filterEffectsRegion";
  const Model = CONFIG.RegionBehavior?.dataModels?.[type];
  if (!region || !Model || !effect) return null;
  const fields = new Set(Object.keys(Model.defineSchema()));
  const system = { [`${stage.fxType}_enabled`]: true };
  for (const [key, value] of Object.entries(effectOptions(stage, effect))) {
    // Colors are {value, apply}: FXMaster stores them as <key> and <key>_apply.
    if (value && typeof value === "object" && "value" in value) {
      if (fields.has(`${stage.fxType}_${key}`)) system[`${stage.fxType}_${key}`] = value.value;
      if (fields.has(`${stage.fxType}_${key}_apply`)) system[`${stage.fxType}_${key}_apply`] = value.apply === true;
    } else if (fields.has(`${stage.fxType}_${key}`)) system[`${stage.fxType}_${key}`] = value;
  }
  const [behavior] = await region.createEmbeddedDocuments("RegionBehavior", [{ name: "Animater", type, system }]);
  return async () => { if (behavior && region.behaviors?.get?.(behavior.id)) await behavior.delete(); };
}
// The shape of a placed area or private preview area, as canvas polygons.
function areaMask(template) {
  const doc = template?.document ?? template;
  if (doc?.documentName === "Region") {
    const polygons = Array.from(doc.shapes ?? []).flatMap(s => s.polygons ?? []);
    return polygons.length ? polygons.map(p => new PIXI.Polygon(p.points)) : null;
  }
  // Preview documents are deliberately not registered in the Scene. Raw
  // shapes serialize across Sequencer without resolving their temporary UUID.
  const points = template?.shape?.points;
  return points?.length ? new PIXI.Polygon(Array.from(points, (n, i) => n + (i % 2 ? doc.y : doc.x))) : null;
}
function localParticles(stage, effect, template) {
  const Effect = CONFIG.fxmaster?.particleEffects?.[stage.fxType], PIXI = globalThis.PIXI;
  // Foundry 14's weather layer draws only its own containers; the interface layer
  // draws an added container over the board like scene weather.
  const layer = canvas?.interface;
  if (!Effect || !effect || !PIXI || !layer || !canvas.dimensions) return null;
  const d = canvas.dimensions;
  const context = { scope: "animater-local-preview", dimensions: d, renderer: canvas.app.renderer, ticker: canvas.app.ticker };
  const options = Object.fromEntries(Object.entries(effectOptions(stage, effect)).map(([key, value]) => [key, { value }]));
  options.__fxmParticleContext = context;
  const particles = new Effect(options);
  particles.__fxmParticleContext = context;
  const root = new PIXI.Container();
  root.addChild(particles);
  layer.addChild(root);
  // With an area, the particles stay inside its shape.
  const doc = template?.document ?? template;
  const shape = doc?.documentName !== "Region" ? template?.shape : null;
  const polygons = template && !shape ? [areaMask(template)].flat().filter(Boolean) : [];
  if (shape || polygons.length) {
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    // A preview template's own shape (circle, rectangle, cone polygon) is relative to it.
    if (shape) { mask.position.set(doc.x, doc.y); mask.drawShape(shape); }
    else for (const polygon of polygons) mask.drawPolygon(polygon);
    mask.endFill();
    root.addChild(mask);
    particles.mask = mask;
  }
  particles.play({ prewarm: true });
  // Particles fade in over several seconds; fast-forward so a short stage shows them
  // at full strength, as on a scene where the weather has been running.
  for (const emitter of particles.emitters ?? []) { try { emitter.update(LOCAL_PARTICLE_PREWARM); } catch { /* procedural effect */ } }
  return () => {
    try { particles.stop?.(); } catch { /* already stopped */ }
    root.destroy({ children: true });
  };
}
function workspaceHost() {
  return {
    // Tuck the window away while a canvas preview or table playback runs, then restore it.
    tuckWindow: async () => {
      let on = true; try { on = game.settings.get(ID, 'tuckDuringPlayback') !== false; } catch {}
      if (!on || !app?.rendered || app.minimized) return null;
      await app.minimize();
      return async () => { if (app?.rendered && app.minimized) await app.maximize(); };
    },
    mediaPreferences:()=>libraryPreferences(game.settings.get(ID,'mediaLibrary')),
    setMediaPreferences:value=>game.settings.set(ID,'mediaLibrary',libraryPreferences(value)),
    mediaCatalog:()=>mediaLibraryLoader.peek(),
    loadMediaCatalog:(refresh,onProgress)=>mediaLibraryLoader.load(refresh,onProgress),
    sfCatalogState:kind=>normalizeSfCatalogState(game.settings.get(ID,sfSettingKey(kind))),
    setSfCatalogState:async(kind,change)=>{
      if(!game.user.isGM||!(game.system.id==="sf2e"||borrowsSfPages()&&TWOE_KINDS.includes(kind))||!SF_KINDS.includes(kind))throw Error("SF2e catalog configuration requires a GM in an SF2e world, or a PF2e world that uses the SF2e catalogs.");
      const key=sfSettingKey(kind);
      await game.settings.set(ID,key,normalizeSfCatalogState({...game.settings.get(ID,key),...change}));
      persistentStates?.schedule();
    },
    dndCatalogState:kind=>normalizeDndCatalogState(game.settings.get(ID,dndSettingKey(kind))),
    setDndCatalogState:async(kind,change)=>{
      if(!game.user.isGM||game.system.id!=='dnd5e'||!DND_KINDS.includes(kind))throw Error('D&D catalog configuration requires a GM in a D&D world.');
      const key=dndSettingKey(kind);
      await game.settings.set(ID,key,normalizeDndCatalogState({...game.settings.get(ID,key),...change}));
      persistentStates?.schedule();
    },
    dhCatalogState:kind=>normalizeDhCatalogState(game.settings.get(ID,dhSettingKey(kind))),
    setDhCatalogState:async(kind,change)=>{
      if(!game.user.isGM||game.system.id!=='daggerheart'||!DH_KINDS.includes(kind))throw Error('Daggerheart catalog configuration requires a GM in a Daggerheart world.');
      const key=dhSettingKey(kind);
      await game.settings.set(ID,key,normalizeDhCatalogState({...game.settings.get(ID,key),...change}));
      persistentStates?.schedule();
    },
    soundCatalog: () =>
      installedSoundCatalog(game.modules, globalThis.Sequencer?.Database),
    weaponScale: () => Number(game.settings.get(ID, "weaponScale")) || 1,
    // Flash screens (GM): the library, defaults and playback for the editor page.
    ...(game.user.isGM ? {
      flashScreens: () => flash?.screens() ?? [],
      saveFlashScreens: (list) => flash.save(list),
      useEveryCatalog,
      catalogsOn,
      flashDefaults: () => flash?.defaults() ?? {},
      setFlashDefault: (event, id) => flash.setDefault(event, id),
      setFlashStartOnAdd: (on) => flash.setStartOnAdd(on),
      playFlash: function (screen, options) {
        // Played from the editor: the sample hero and action fill {name}, {action} and the cut-in.
        const { name, action, actor } = this.flashVars?.() ?? {};
        return flash.play(screen, { ...options, extra: { name, action, actor, ...options?.extra } });
      },
      flashSound: (screen) => flash.sound(screen),
      flashPlaySound: (src, volume, ms) => flash.playSound(src, volume, ms),
      downloadJSON: (data, name) => foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", name),
      // A text file the GM picks, or null if they cancel.
      pickTextFile: (accept) => new Promise((resolve) => {
        const input = Object.assign(document.createElement("input"), { type: "file", accept });
        input.addEventListener("change", async () => resolve(input.files?.[0] ? await input.files[0].text() : null));
        input.addEventListener("cancel", () => resolve(null));
        input.click();
      }),
      flashVars: () => {
        const v = { name: "Valeros", action: "Dragon's Fury", manualSample: true, ...(flash?.vars() ?? {}) };
        // The cut-in's stand-in: a selected token, else the first party member, else a silhouette.
        const tok = canvas?.tokens?.controlled?.[0], party = v.combatants?.find((c) => c.side === "party");
        v.actor = tok ? { name: tok.name, img: tok.document?.texture?.src ?? "", portrait: tok.actor?.img ?? "" } : party ?? { name: "Valeros", img: "icons/svg/mystery-man.svg", portrait: "icons/svg/mystery-man.svg" };
        if (v.combatants?.length) return v;
        const stand = (name, img, side) => ({ name, img, portrait: img, side });
        return { ...v, combatants: [stand("Hero", "icons/svg/mystery-man.svg", "party"), stand("Ally", "icons/svg/mystery-man.svg", "party"), stand("Friend", "icons/svg/mystery-man.svg", "party"), stand("Foe", "icons/svg/skull.svg", "enemies"), stand("Brute", "icons/svg/skull.svg", "enemies"), stand("Boss", "icons/svg/skull.svg", "enemies")] };
      },
      flashFonts: () => [...new Set(["Signika", "Modesto Condensed", "Amiri", ...Object.keys(CONFIG.fontDefinitions ?? {})])],
      resolveFlashMedia: (src) => (!src || /\.(webm|mp4|png|jpe?g|webp|gif|svg)$/i.test(src) ? src : runtime.getCatalog().find((i) => i.key === src || i.key.startsWith(`${src}.`))?.file ?? ""),
      confirm: (content) => foundry.applications.api.DialogV2.confirm({ window: { title: "Animater" }, content: `<p>${content}</p>` }),
    } : {}),
    // Players edit their own recipes (on their user); the GM's stay world-wide.
    // While the GM reviews a player, the Studio shows and saves that player's recipes.
    // Whether anything plays automatically on this client (a catalog, custom recipes, or a player's approved ones).
    acceptsEvents: () => acceptsEvents() || hasOwnApproved(),
    // This device's "Lasting condition animations" choice ("world" follows each catalog).
    lastingMode: () => game.settings.get(ID, "lastingMode"),
    defaultFinisher: () => game.settings.get(ID, DEFAULT_FINISHER) ?? "",
    players: () => game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, name: u.name, color: u.color?.css ?? u.color ?? "" })),
    // Players pick finishers only in pf2e-combater's item sheet: Available to shows only with it.
    playerPicks: () => game.modules.get("pf2e-combater")?.active === true,
    setDefaultFinisher: async (id) => {
      if (!game.user.isGM) throw Error("Only a GM can choose the default finisher.");
      await game.settings.set(ID, DEFAULT_FINISHER, String(id ?? ""));
    },
    // How the default finisher ends: "" as each finisher is made, or a FINISHER_ENDINGS key.
    defaultFinisherEnding: () => game.settings.get(ID, DEFAULT_FINISHER_ENDING) ?? "",
    setDefaultFinisherEnding: async (ending) => {
      if (!game.user.isGM) throw Error("Only a GM can choose how the default finisher ends.");
      await game.settings.set(ID, DEFAULT_FINISHER_ENDING, Object.hasOwn(FINISHER_ENDINGS, ending) ? ending : "");
    },
    recipes: () => { const user = reviewedUser(); return user ? clone(user.getFlag(ID, "playerRecipes")?.recipes ?? []) : game.user.isGM ? recipes() : ownPlayerRecipes(); },
    get playerMode() { return !game.user.isGM || Boolean(reviewedUser()); },
    approvalState: (recipe) => { const user = game.user.isGM ? reviewedUser() : game.user; return user ? approvalState(recipe, playerDecisions()[user.id]) : null; },
    reviewing: () => { const user = reviewedUser(); return user ? { userId: user.id, userName: user.name } : null; },
    review: (userId) => { reviewing = game.user.isGM && userId && game.users?.get(userId) ? userId : null; },
    playerSubmissions: () => (game.user.isGM ? playerSubmissions(Array.from(game.users?.contents ?? []), playerDecisions()) : []),
    decidePlayerRecipe: async (userId, recipe, status) => {
      if (!game.user.isGM) throw Error('Only a GM can approve player animations.');
      await game.settings.set(ID, 'playerApprovals', decide(playerDecisions(), userId, recipe, status));
    },
    catalog: () => runtime.getCatalog(),
    fxCatalog,
    createSceneFxPreview:(scene,recipe,grid)=>{
      const catalog=fxCatalog();
      if(!catalog.sceneReady||!CONFIG.fxmaster?.particleEffects)return null;
      return new SceneFxPreview({scene,recipe,grid,PIXI:globalThis.PIXI,fxmaster:CONFIG.fxmaster,catalog});
    },
    tokenFxPreset:(library,name)=>name?tokenFx.getPresets(library).find(p=>p.name===name)??null:null,
    createTokenFxPreview:async(scene,recipe)=>{
      if(!fxCatalog().tokenReady)return null;
      return new TokenFxPreview({scene,recipe,PIXI:globalThis.PIXI,tokenFx,world:()=>game.time.serverTime});
    },
    previewTokenFx:stage=>{
      if(!canvas.ready)throw Error('Open a scene first.');
      const unavailable=fxAvailability({...stage,kind:'tokenfx'},fxCatalog(),{preview:true});
      if(unavailable)throw Error(unavailable);
      const context=manualContext();
      return startTokenFxPreview(optionalFx,stage,{tokens:stage.subject==='targets'?context.targets:[context.source],userId:game.user.id});
    },
    catalogFxSettings:()=>catalogFxSettings(),
    setCatalogFxSetting:async(key,value)=>{
      if(!game.user.isGM||!['catalogTokenFx','catalogSceneFx'].includes(key))return;
      await game.settings.set(ID,key,value===true);
    },
    setConditionLooks:async mode=>{
      if(!game.user.isGM)throw Error('Only a GM can change how conditions look.');
      await game.settings.set(ID,'conditionLooks',conditionLookMode(mode));
    },
    // The world's own Tokenshade presets: saved from an edited stage, shared by every recipe.
    saveTokenFxPreset:async(name,layers)=>{
      if(!game.user.isGM)throw Error('Only a GM can save Tokenshade presets.');
      const clean=normalizeLayers(layers),title=String(name??'').trim().slice(0,80);
      if(!title)throw Error('Name the preset first.');
      if(!clean)throw Error('This effect has no layers to save.');
      const list=(game.settings.get(ID,'tokenFxPresets')??[]).filter(p=>p.name!==title);
      await game.settings.set(ID,'tokenFxPresets',[...list,{name:title,params:clean}].slice(-200));
    },
    deleteTokenFxPreset:async name=>{
      if(!game.user.isGM)throw Error('Only a GM can delete Tokenshade presets.');
      await game.settings.set(ID,'tokenFxPresets',(game.settings.get(ID,'tokenFxPresets')??[]).filter(p=>p.name!==name));
    },
    logs: () => runtime.log,
    isGM: () => game.user.isGM,
    // Activity page: lasting animations on the table now (runtime sessions + condition/effect layers).
    nowPlaying: () => nowPlayingRows(runtime?.runningAnimations() ?? [], persistentStates?.running() ?? []),
    stopAnimation: (row) => stopActivityRow(row),
    environment,
    enabled,
    catalogState: () =>
      normalizeCatalogState(game.settings.get(ID, "spellCatalog")),
    setCatalogState: async (change) => {
      if (!game.user.isGM)
        throw Error("Only a GM can configure the spell catalog.");
      const current = game.settings.get(ID, "spellCatalog");
      await game.settings.set(
        ID,
        "spellCatalog",
        normalizeCatalogState({ ...current, ...change }),
      );
    },
    featCatalogState: () =>
      normalizeFeatCatalogState(game.settings.get(ID, "featCatalog")),
    setFeatCatalogState: async (change) => {
      if (!game.user.isGM)
        throw Error("Only a GM can configure the feat catalog.");
      const current = game.settings.get(ID, "featCatalog");
      await game.settings.set(
        ID,
        "featCatalog",
        normalizeFeatCatalogState({ ...current, ...change }),
      );
    },
    actionCatalogState: () => PF2E_ACTION_CATALOG.normalizeState(game.settings.get(ID, "actionCatalog")),
    setActionCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure the action catalog.");
      return game.settings.set(ID, "actionCatalog", PF2E_ACTION_CATALOG.normalizeState({ ...game.settings.get(ID, "actionCatalog"), ...change }));
    },
    featureCatalogState: () => PF2E_FEATURE_CATALOG.normalizeState(game.settings.get(ID, "featureCatalog")),
    setFeatureCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure the feature catalog.");
      return game.settings.set(ID, "featureCatalog", PF2E_FEATURE_CATALOG.normalizeState({ ...game.settings.get(ID, "featureCatalog"), ...change }));
    },
    weaponCatalogState: () => normalizeWeaponCatalogState(game.settings.get(ID, "weaponCatalog")),
    setWeaponCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure weapon animations.");
      return game.settings.set(ID, "weaponCatalog", normalizeWeaponCatalogState({ ...game.settings.get(ID, "weaponCatalog"), ...change }));
    },
    stateCatalogState: (kind) => normalizeStateCatalogState(game.settings.get(ID, kind === "condition" ? "conditionCatalog" : "effectCatalog")),
    setStateCatalogState: async (kind, change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure persistent animations.");
      const key = kind === "condition" ? "conditionCatalog" : "effectCatalog";
      await game.settings.set(ID, key, normalizeStateCatalogState({ ...game.settings.get(ID, key), ...change }));
      persistentStates?.schedule();
    },
    async save(data) {
      // A player saves their own recipes; each new version waits for the GM.
      if (!game.user.isGM) {
        const decisions = playerDecisions()[game.user.id] ?? {}, waiting = (list) => new Set(list.filter((r) => approvalState(r, decisions) === "pending").map((r) => r.id));
        const before = waiting(ownPlayerRecipes()), recipes = validatePlayerRecipes(data);
        await game.user.setFlag(ID, "playerRecipes", { schema: 1, recipes });
        // Tell the GMs when something new waits for them, so it is not found by chance.
        const fresh = recipes.filter((r) => waiting(recipes).has(r.id) && !before.has(r.id));
        const gms = game.users.filter((u) => u.isGM && u.active).map((u) => u.id);
        if (fresh.length && gms.length) {
          const names = fresh.slice(0, 3).map((r) => `“${foundry.utils.escapeHTML?.(r.name) ?? r.name}”`).join(", ") + (fresh.length > 3 ? ` and ${fresh.length - 3} more` : "");
          await ChatMessage.create({ whisper: gms, speaker: { alias: "Animater" }, content: `<p><b>${foundry.utils.escapeHTML?.(game.user.name) ?? game.user.name}</b> sent ${names} for approval. Open Animater: Recipes, at the bottom.</p>` }).catch(() => {});
        }
        return;
      }
      // The GM's edits to a player's animation go back to that player; the new version still needs approving.
      const player = reviewedUser();
      if (player) return player.setFlag(ID, "playerRecipes", { schema: 1, recipes: validatePlayerRecipes(data) });
      if (data.length > 200) throw Error("Maximum 200 recipes.");
      const valid = data.map(validateRecipe);
      if (new Set(valid.map((r) => r.id)).size !== valid.length)
        throw Error("Recipe IDs must be unique.");
      await game.settings.set(ID, "recipes", { schema: 1, recipes: valid });
      persistentStates?.schedule();
    },
    setEnabled: async (value) => {
      if (!game.user.isGM) throw Error("Only a GM can enable automation.");
      await game.settings.set(ID, "automatic", value);
    },
    // Play at table without a placed template uses the same sample area as Local preview.
    play: (recipe, preview, options = {}) =>
      playTest(recipe, manualContext(), { ...options, preview, sampleArea: !preview }),
    previewTokens: () => {
      if (!canvas.ready) return {};
      const context = manualContext();
      const info = (token) =>
        token
          ? {
              id: token.id,
              name: token.name,
              img: token.document?.texture?.src,
              width: (token.w ?? canvas.grid.size) / canvas.grid.size,
              height: (token.h ?? canvas.grid.size) / canvas.grid.size,
              mechanicalWidth: (token.mechanicalBounds?.width ?? token.w ?? canvas.grid.size) / canvas.grid.size,
              textureScaleX: token.document?.texture?.scaleX ?? 1,
              textureScaleY: token.document?.texture?.scaleY ?? 1,
              spriteWidth:
                Math.abs(token.mesh?.width ?? token.w ?? canvas.grid.size) /
                canvas.grid.size,
              spriteHeight:
                Math.abs(token.mesh?.height ?? token.h ?? canvas.grid.size) /
                canvas.grid.size,
              rotation: token.document?.rotation ?? 0,
              auraRadii: Object.fromEntries(Array.from(token.actor?.auras?.values?.()??[],a=>[a.slug,a.radius])),
            }
          : null;
      return {
        source: info(context.source),
        targets: info(context.targets?.[0]),
        targetList: context.targets.map(info),
        targetCount: context.targets?.length ?? 0,
        gridDistance: canvas.scene?.grid?.distance ?? 5,
      };
    },
    stop: () => runtime.stop(),
    pickSound: (current, callback) =>
      new foundry.applications.apps.FilePicker.implementation({
        type: "audio",
        current,
        callback,
      }).browse(),
    pickMedia: (type,current,callback)=>new foundry.applications.apps.FilePicker.implementation({type,current,callback}).browse(),
    pickMediaFolder:callback=>new foundry.applications.apps.FilePicker.implementation({type:'folder',activeSource:'data',callback:(path,picker)=>{
      if(picker.activeSource!=='data'){ui.notifications.warn('Choose a folder in User Data.');return;}
      void Promise.resolve(callback(path)).catch(error=>ui.notifications.error(error.message));
    }}).browse(),
    refreshCatalog: () => runtime.refreshCatalog(),
    resolveItem: (uuid) => fromUuid(uuid),
    // Name/icon for a bound item without loading it (compendium index or world doc).
    itemSummary: (uuid) => {
      try {
        const doc = fromUuidSync(uuid);
        if (!doc) return null;
        const pack = uuid.startsWith("Compendium.") ? game.packs.get(uuid.split(".").slice(1, 3).join("."))?.title : "";
        return { name: doc.name, img: doc.img, type: doc.type, source: pack || (doc.parent?.name ?? "World") };
      } catch { return null; }
    },
    confirm: (content) => {
      const p = document.createElement("p");
      p.textContent = content;
      return foundry.applications.api.DialogV2.confirm({
        window: { title: "Animater" },
        content: p.outerHTML,
      });
    },
    export: (text) =>
      foundry.utils.saveDataToFile(
        text,
        "application/json",
        "animater-recipes.json",
      ),
  };
}
Hooks.once("init", () => {
  registerSequencerSpeedups(ID);
  game.settings.register(ID,'mediaLibrary',{scope:'client',config:false,type:Object,default:libraryPreferences()});
  game.settings.register(ID,'tokenFxPresets',{scope:'world',config:false,type:Array,default:[],onChange:()=>app?.workspace?.render()});
  for(const [key,name,hint] of [
    ['catalogTokenFx','Tokenshade filters in catalog animations','Catalog animations add matching shader effects on the token itself (flames, frost, glows, shimmer). Drawn by Animater on each screen; nothing is saved to the token.'],
    ['catalogSceneFx','FXMaster scene effects in catalog animations','When FXMaster is active, weather-like catalog spells add brief scene effects (rain, fog, embers). Skipped automatically when the module is missing.']])
    game.settings.register(ID,key,{name,hint,scope:'world',config:true,type:Boolean,default:true,
      onChange:()=>{persistentStates?.schedule();app?.workspace?.render();}});
  game.settings.register(ID,'conditionLooks',{name:'Condition looks',
    hint:'How catalog conditions show on a creature. Tokenshade: a quiet look on the creature itself. JB2A: the condition’s JB2A animation only, with no Tokenshade filters. Also set from each conditions catalog in Animater.',
    scope:'world',config:true,type:String,choices:{tokenshade:'Tokenshade',jb2a:'JB2A'},default:'tokenshade',
    onChange:()=>{persistentStates?.schedule();app?.workspace?.render();}});
  game.settings.register(ID,'weaponScale',{name:'Weapon effect size',hint:'Multiplies the size of weapon hit and residue effects (1 = the target token\'s footprint).',
    scope:'world',config:true,type:Number,range:{min:0.5,max:3,step:0.1},default:1.5});
  game.settings.register(ID,RUNE_SETTING,{name:'Weapon rune flourishes',hint:'Catalog weapon Strikes show each weapon’s runes: potency adds a glint, striking a bigger hit, and each property rune (flaming, frost, shock, holy…) its own accent on a hit. Saved recipes are never changed.',
    scope:'world',config:game.system.id==='pf2e',type:Boolean,default:true});
  game.settings.register(ID,'showControlButton',{name:'Show Animater scene control button',
    hint:'Shows the Animater button in the token controls. Turn off to hide it; Alt+Shift+A still opens Animater.',
    scope:'client',config:true,type:Boolean,default:true,onChange:()=>ui.controls?.render()});
  // The hit sounds engine: one menu (Hit sounds) holds its world switch and each device's mix (ui/hit-sounds-settings.mjs).
  game.settings.registerMenu(ID,'hitSoundsMenu',{name:'Hit sounds',label:'Hit sounds',icon:'fa-solid fa-volume-high',
    hint:'Weapon hits that sound like what they land on, and how you hear them: on or off, volume, blood, echo, and hearing hits where they happen.',
    type:hitSoundsMenu(ApplicationV2,{id:ID}),restricted:false});
  game.settings.register(ID,SURFACE_SETTING,{name:'Weapon surface sounds',scope:'world',config:false,type:Boolean,default:true,onChange:()=>app?.workspace?.render()});
  game.settings.register(ID,'hitSounds',{name:'Hit sounds on this device',scope:'client',config:false,type:Boolean,default:true});
  game.settings.register(ID,'surfaceVolume',{name:'Surface sounds volume',scope:'client',config:false,type:Number,range:{min:0,max:1,step:0.05},default:1});
  game.settings.register(ID,'surfaceGore',{name:'Blood sounds',scope:'client',config:false,type:String,choices:{full:'Full',subtle:'Subtle',off:'Off'},default:'full'});
  game.settings.register(ID,'surfaceEcho',{name:'Surface echo',scope:'client',config:false,type:Number,range:{min:0,max:1.5,step:0.1},default:1});
  game.settings.register(ID,'surfaceSpace',{name:'Hear hits where they happen',scope:'client',config:false,type:Boolean,default:true});
  game.settings.register(ID,'tuckDuringPlayback',{name:'Minimize Animater during canvas playback',
    hint:'Local preview and Play at table minimize the Animater window while the animation runs, then restore it.',
    scope:'client',config:true,type:Boolean,default:true});
  game.settings.register(ID,'quality',{name:'Animation quality (this device)',
    hint:'Lower this on slower computers. Applies only to what you see; other players keep their own setting.',
    scope:'client',config:true,type:String,choices:{...QUALITY_CHOICES},default:'full',
    onChange:()=>{syncQuality();persistentStates?.schedule();}});
  game.settings.register(ID,'lastingMode',{name:'Lasting condition animations (this device)',
    hint:'How lasting conditions and effects show on your screen. "Follow the catalog setting" uses each catalog\'s Lasting animation switch in Animater. "On application and at its turn start" plays them when applied and again briefly whenever that creature\'s turn starts in combat. The Defeated look keeps its own setting. Each player\'s choice affects only their screen.',
    scope:'client',config:true,type:String,choices:{...LASTING_MODES},default:'world',onChange:()=>persistentStates?.schedule()});
  game.settings.register(ID,CROSSOVER_CATALOG,{...crossoverSettingText(game.system.id),scope:'world',
    // PF2e and SF2e only: the two systems share one rules engine.
    config:Boolean(crossoverSystem(game.system.id)),type:Boolean,default:false,
    onChange:()=>{void seedBorrowedCatalogs().finally(()=>{persistentStates?.schedule();app?.workspace?.render();});}});
  for(const kind of SF_KINDS)game.settings.register(ID,sfSettingKey(kind),{scope:"world",config:false,type:Object,default:normalizeSfCatalogState(),onChange:()=>persistentStates?.schedule()});
  for(const kind of DND_KINDS)game.settings.register(ID,dndSettingKey(kind),{scope:'world',config:false,type:Object,default:normalizeDndCatalogState(),onChange:()=>persistentStates?.schedule()});
  for(const kind of DH_KINDS)game.settings.register(ID,dhSettingKey(kind),{scope:'world',config:false,type:Object,default:normalizeDhCatalogState(),onChange:()=>persistentStates?.schedule()});
  for (const key of ["conditionCatalog", "effectCatalog"])
    game.settings.register(ID, key, { scope: "world", config: false, type: Object, default: normalizeStateCatalogState(), onChange: () => persistentStates?.schedule() });
  game.settings.register(ID, "weaponCatalog", { scope: "world", config: false, type: Object, default: normalizeWeaponCatalogState() });
  for (const [key, catalog] of Object.entries(ABILITY_CATALOGS))
    game.settings.register(ID, key, { scope: "world", config: false, type: Object, default: catalog.normalizeState() });
  game.settings.register(ID, "featCatalog", {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeFeatCatalogState(),
  });
  game.settings.register(ID, "spellCatalog", {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeCatalogState(),
  });
  // The GM's decisions on player-made recipes (players cannot write world settings).
  game.settings.register(ID, "playerApprovals", { scope: "world", config: false, type: Object, default: {}, onChange: () => app?.workspace?.render() });
  game.settings.register(ID, "recipes", {
    scope: "world",
    config: false,
    type: Object,
    default: { schema: 1, recipes: starterRecipes() },
  });
  game.settings.register(ID, WAIT_FOR_DICE, {
    name: "Wait for Dice So Nice",
    hint: "Attack and damage animations start when the 3D dice for that roll have landed, so a hit or miss plays after you see the result.",
    scope: "client",
    // Listed only where Dice So Nice is active; elsewhere there is nothing to wait for.
    config: Boolean(game.modules.get("dice-so-nice")?.active),
    type: Boolean,
    default: true,
  });
  game.settings.register(ID, AA_TAKEOVER, {
    name: "Take over from Automated Animations when Animater has an animation",
    hint: "Automated Animations skips items Animater animates. Items customized in Automated Animations stay with it. If “Only animate what Automated Animations doesn't” is also on, that one wins.",
    scope: "world",
    // Only worth listing where Automated Animations is active in this world.
    config: Boolean(game.modules.get(AA_ID)?.active),
    type: Boolean,
    default: true,
  });
  game.settings.register(ID, AA_FILL_GAPS, {
    name: "Only animate what Automated Animations doesn't",
    hint: "Items Automated Animations animates (by its Automatic Recognition or a customized item) stay with it; Animater animates the rest. Items turned off in Automated Animations play Animater's animation.",
    scope: "world",
    // Listed only where Automated Animations is active; elsewhere there are no gaps to fill.
    config: Boolean(game.modules.get(AA_ID)?.active),
    type: Boolean,
    default: false,
  });
  game.settings.register(ID, TA_FILL_GAPS, {
    name: "Only animate what Trigger Animations doesn't",
    hint: "Items a Trigger Animations trigger names (attack:longsword, template:fireball, condition:frightened, or the item's UUID) stay with it; Animater animates the rest. Wildcard triggers such as damage:* don't count.",
    scope: "world",
    // Listed only where Trigger Animations is active.
    config: Boolean(game.modules.get(TA_ID)?.active),
    type: Boolean,
    default: false,
  });
  game.settings.register(ID, MOTION_PRIORITY, {
    name: "Animater's token motions come first",
    hint: "While Animater moves a token (a finisher or attack, a condition's trembling or swaying, a look that rocks it), other modules' passing Sequencer motions on that token don't play, such as PF2e RPG Numbers' damage shake. Off: both play, and the token can jitter between them.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(ID, "automatic", {
    name: "Play my own recipes automatically",
    hint: "Your saved recipes play when their spell, attack, damage or area happens. The catalogs have their own Plug & play switch and play whether or not this is on. Turn off overlapping animations in other modules to avoid playing twice.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    // Your own lasting animations start or stop with it.
    onChange: () => persistentStates?.schedule(),
  });
  registerFlashSettings(ID);
  game.settings.register(ID, DUALITY_ACCENT, {
    name: "Hope/Fear accent",
    hint: "Daggerheart: a duality roll with Hope adds a short gold glint on the roller's token, one with Fear a dark purple wisp, beside the item's own animation. Critical successes keep their own crit visuals.",
    scope: "world", config: game.system.id === "daggerheart", type: Boolean, default: true,
  });
  game.settings.register(ID, "hitStop", {
    name: "Hit-stop on critical hits",
    hint: "A critical hit freezes its animation for a split second at the moment of contact, on every screen.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "slowMotionKills", {
    name: "Slow motion on notable kills",
    hint: "The last enemy of a fight, a boss-level foe or a critical kill falls in slow motion.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "hitStopLocal", {
    name: "Hit-stop on my screen",
    hint: "Turn off to never freeze animations on this screen; they still keep the short beat after a critical hit.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "effectLighting", {
    name: "Effect lighting",
    hint: "Fire, lightning and other glowing effects light up the scene around them while they play (lasting areas and auras until they end), blocked by walls like any light.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "effectLightingDaylight", {
    name: "Effect lighting in daylight",
    hint: "Also add a soft coloured glow around effects in fully lit scenes.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "effectLightAnimation", {
    name: "Flickering and flashing effect lights",
    hint: "Turn off to see effect lights as a steady glow, without flicker or strobe.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, DAMAGE_REACTIONS, {
    name: "Damage reactions",
    hint: "A token that takes energy damage (fire, cold, lightning, acid, poison and so on) flashes in that damage's look. Physical damage keeps its weapon animation only.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  // A table with its own teleport automation (D&D premade modules, rule engines) turns this off.
  game.settings.register(ID, TELEPORT_TOKENS, {
    name: "Teleport tokens",
    hint: `Teleport spells (${({ dnd5e: "Misty Step, Dimension Door", daggerheart: "Teleport" })[game.system.id] ?? "Translocate, Friendfetch"}…) let whoever cast them click a spot, and the token jumps there. Turn off if another module already moves tokens for these spells: they then only play their animation.`,
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, "welcomed", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(ID, DRAMATIC_DEATHS, {
    name: "Damage-typed knockouts",
    hint: "A creature dropping to 0 HP goes down in the look of the damage that dropped it: burned to ash, frozen and shattered, fried by lightning. Off: a plain collapse.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(ID, DEFAULT_FINISHER, { scope: "world", config: false, type: String, default: "" });
  game.settings.register(ID, DEFAULT_FINISHER_ENDING, { scope: "world", config: false, type: String, default: "" });
  registerDefeatedLook(game.settings, ID, { onChange: () => persistentStates?.schedule() });
  installDefeatedLook(Hooks, { mode: () => game.settings.get(ID, DEFEATED_LOOK), statuses: () => (game.system.id === "daggerheart" ? DH_DEFEATED_STATUSES : [defeatedStatusId()]) });
  game.settings.registerMenu(ID, "workspace", {
    name: "Animater workspace",
    label: "Open Animater",
    hint: "Browse assets, build recipes, preview, and configure automatic triggers.",
    icon: "fas fa-wand-magic-sparkles",
    type: AnimaterApp,
    restricted: true,
  });
  game.keybindings.register(ID, "open", {
    name: "Open Animater",
    editable: [{ key: "KeyA", modifiers: ["Alt", "Shift"] }],
    // Players open their own Studio too.
    restricted: false,
    onDown: () => {
      open();
      return true;
    },
  });
});
const SURFACE_SETTING = "surfaceSounds";
// A built-in weapon animation, in any system, also sounds like what each target is (surface sounds).
function withWeaponSurface(recipe, event, saved, sounds) {
  if (!recipe || event?.type !== "attack" || game.settings.get(ID, SURFACE_SETTING) === false) return recipe ? (game.settings.get(ID, SURFACE_SETTING) === false ? withoutSurfaces(recipe) : recipe) : recipe;
  if (saved.some((r) => r.id === recipe.id)) return recipe;
  const item = event.item, family = game.system.id === "daggerheart" ? weaponFamily(item?.name) : null;
  return withSurfaceSounds(recipe, { blow: blowOfItem(item, { family, element: event.element }), heft: heftOfItem(item), sounds, soundVolume: weaponSoundVolume() });
}
const withoutSurfaces = (recipe) => recipe.stages?.some((s) => s.surfaces) ? { ...recipe, stages: recipe.stages.filter((s) => !s.surfaces) } : recipe;
const weaponSoundVolume = () => { const sys = game.system.id, key = sys === "dnd5e" ? dndSettingKey("weapon") : sys === "daggerheart" ? dhSettingKey("weapon") : sys === "sf2e" ? sfSettingKey("weapon") : "weaponCatalog";
  try { return game.settings.get(ID, key)?.soundVolume ?? 0.35; } catch { return 0.35; } };
function systemRecipe(event, saved) {
  const sounds = installedSoundCatalog(game.modules, globalThis.Sequencer?.Database);
  return withWeaponSurface(catalogSystemRecipe(event, saved, sounds), event, saved, sounds);
}
function catalogSystemRecipe(event, saved, sounds) {
  const sys = game.system.id;
  if (["pf2e", "sf2e"].includes(sys)) return crossoverResolve(event, { systemId: sys, on: crossoverOn(),
    // Borrowed catalogs are managed on their own pages, so each reads its own settings.
    resolve: (from, e) => twoeCatalogRecipe(from, e, saved, { customEnabled: enabled(), sounds, stateFor: (kind) => game.settings.get(ID, twoeSettingKey(from, kind)) }),
    knows: (e) => Boolean(catalogEntryFor(e.item) || saved.some((r) => matchRecipe([{ ...r, enabled: true }], e))) });
  return sys==='dnd5e'?resolveDndAutomaticRecipe(event,kind=>game.settings.get(ID,dndSettingKey(kind)),saved,{customEnabled:enabled(),sounds}):sys==='daggerheart'?resolveDaggerheartAutomaticRecipe(event,kind=>game.settings.get(ID,dhSettingKey(kind)),saved,{customEnabled:enabled(),sounds}):matchRecipe(saved,event);
}
// The recipe dispatch would play, or null. AA-customized items stay with AA.
function resolveEvent(event) {
  if (!event || yieldsToAA(event)) return null;
  return applyEventElement(systemRecipe({ systemId: game.system.id, ...event }, recipes()), event.element) ?? null;
}
// Why an event stays with Automated Animations (or Trigger Animations), or null when Animater plays it.
function aaYield(event) {
  if (taFillGaps() && taAnimates(event)) return "Trigger Animations animates it";
  if (!game.modules.get(AA_ID)?.active) return null;
  if (aaCustomized(event.item, event.activity)) return "customized in Automated Animations";
  if (aaFillGaps() && aaAnimates(event, (key) => game.settings.get(AA_ID, key))) return "Automated Animations animates it";
  return null;
}
const yieldsToAA = event => Boolean(aaYield(event));
const aaFillGaps = () => Boolean(game.modules.get(AA_ID)?.active && game.settings.get(ID, AA_FILL_GAPS));
const taFillGaps = () => Boolean(game.modules.get(TA_ID)?.active && game.settings.get(ID, TA_FILL_GAPS));
const aaTakeover = () => Boolean(game.modules.get(AA_ID)?.active && game.settings.get(ID, AA_TAKEOVER));
function eventFrom(input) {
  if (input?.documentName === "ChatMessage") {
    if (["pf2e", "sf2e"].includes(game.system.id)) {
      const event = twoeEvent(input, input.author?.id ?? game.user.id, game.system.id);
      return event?.skipped ? null : event;
    }
    if (game.system.id === "daggerheart") {
      const author = input.author?.id ?? game.user.id, event = daggerheartRollEvent(input, author) ?? daggerheartDamageEvent(input, author);
      return event?.skipped ? null : event;
    }
    const roll = input.flags?.dnd5e?.roll?.type;
    return { type: roll === "attack" ? "attack" : roll === "damage" ? "damage" : "use", systemId: game.system.id, id: input.id,
      item: input.getAssociatedItem?.() ?? input.item, actor: input.getAssociatedActor?.() ?? input.actor,
      tokenId: input.speaker?.token, sceneId: input.speaker?.scene };
  }
  return input;
}
// Official D&D book modules (PHB, DMG, Monster Manual…) add their own content to the
// D&D catalog while active; the data loads only in worlds that use one.
const DND_BOOKS = /^dnd-/;
async function loadDndBooks() {
  const active = Array.from(game.modules?.values?.() ?? []).filter((m) => m.active && DND_BOOKS.test(m.id));
  if (game.system.id !== "dnd5e" || !active.length) return;
  try {
    const { DND5E_BOOK_ENTRIES } = await import("../data/dnd5e-book-catalog.mjs");
    const added = addDndBookEntries(DND5E_BOOK_ENTRIES, (id) => Boolean(game.modules.get(id)?.active));
    if (added) app?.workspace?.render();
  } catch (error) {
    console.warn("Animater | official book catalog unavailable", error);
  }
}
// Scene configuration: how Animater's sounds ring in this scene.
Hooks.on("renderSceneConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.acoustics"]`)) return;
  const tab = root.querySelector('.tab[data-tab="environment"]') ?? root.querySelector('.tab[data-tab="ambience"]') ?? root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector(".tab");
  if (!tab) return;
  const value = app.document?.getFlag?.(ID, "acoustics") ?? "";
  const group = document.createElement("div");
  group.className = "form-group";
  group.innerHTML = `<label>Animater acoustics</label><div class="form-fields"><select name="flags.${ID}.acoustics">${[["", "As recorded"], ["outdoors", "Open air: little echo"], ["hall", "Hall or temple: longer echo"], ["cave", "Cave or dungeon: long, dark echo"]].map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select></div><p class="hint">How Animater's hit sounds ring in this scene.</p>`;
  tab.append(group);
});
Hooks.once("ready", () => {
  // Surface hits ask for a slight pitch shift so repeated blows vary; each player's own mix applies here.
  installSoundPitch({
    enabled: () => game.settings.get(ID, "hitSounds") !== false,
    mix: () => ({ volume: game.settings.get(ID, "surfaceVolume"), gore: game.settings.get(ID, "surfaceGore"), echo: game.settings.get(ID, "surfaceEcho") }),
    // Where this player hears from: their token, else the middle of their view.
    listener: () => {
      const stage = canvas?.stage;
      if (!game.settings.get(ID, "surfaceSpace") || !canvas?.ready || !(stage?.scale?.x > 0)) return null;
      const token = canvas.tokens?.controlled?.[0] ?? game.user.character?.getActiveTokens?.(true)?.find((t) => t.scene === canvas.scene || t.document?.parent === canvas.scene) ?? null;
      const view = { x: stage.pivot.x, y: stage.pivot.y, width: window.innerWidth / stage.scale.x };
      return { ear: token?.center ?? { x: view.x, y: view.y }, view, grid: canvas.grid?.size ?? 100 };
    },
    // The scene's acoustics (Scene configuration → Ambience): open air, a hall or a cave.
    acoustics: () => canvas?.scene?.getFlag?.(ID, "acoustics") ?? null,
  });
  void loadDndBooks();
  setTimeout(() => void welcome().catch((e) => console.warn("Animater welcome:", e.message)), 1500);
  // Item sheets (GM): a shortcut to the item's animation. AppV1 sheets get a header button;
  // AppV2 sheets (D&D 5e) get an entry in the header's menu.
  if (game.user.isGM) {
    Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
      if (!sheet.item || buttons.some((b) => b.class === "animater-open")) return;
      buttons.unshift({ label: "Animation", class: "animater-open", icon: "fa-solid fa-wand-magic-sparkles", onclick: () => void openForItem(sheet.item) });
    });
    Hooks.on("getHeaderControlsApplicationV2", (sheet, controls) => {
      const item = sheet.document;
      if (!(item instanceof Item) || controls.some((c) => c.action === "animaterOpen")) return;
      controls.push({ icon: "fa-solid fa-wand-magic-sparkles", label: "Animater animation", action: "animaterOpen", onClick: () => void openForItem(item) });
    });
  }
  syncQuality();
  const env = environment();
  if (game.user.isGM && env.ready && !env.jb2a) ui.notifications.warn(`Animater: ${JB2A_MISSING}`, { permanent: true });
  motions = new TokenMotionPlayer({ grid: () => canvas.grid?.size ?? 100, fragments: { start: (...args) => createFragmentRenderer({ PIXI: globalThis.PIXI, grid: () => canvas.grid?.size ?? 100 }).start(...args) } });
  // Lasting conditions move the creature itself; one-off motions take priority.
  conditionBody = new ConditionBody({ tokenFx: () => tokenFx, busy: (token) => motions.active.has(token), enabled: () => allowsMotion(localQuality()) });
  guardSequencerMotions(globalThis.Sequencer?.MotionManager, { claims: (data) => {
    if (!game.settings.get(ID, MOTION_PRIORITY)) return false;
    const token = fromUuidSync(data?.uuid, { strict: false })?.object;
    return Boolean(token) && (motions.active.has(token) || conditionBody.moves(token) || tokenFx.engine.moves(token));
  } });
  optionalFx = new OptionalFxPlayer({catalog:fxCatalog,tokenFx:()=>tokenFx,
    fxmaster:()=>globalThis.FXMASTER?.api,scene:()=>canvas.scene,
    localParticles,
    regionFx,
    trace:(status,detail)=>runtime?.trace(status,detail)});
  // Foundry's server relays a module event with the sender's user id as the second argument.
  game.socket?.on(`module.${ID}`, (data, senderId) => {
    if (data?.sender !== clientId) { void receiveMotion(data); void receiveOptionalFx(data); flash?.receive(data); receiveFinished(data); receiveActivityStop(data, senderId); void receiveTeleport(data, senderId).catch((e) => console.warn("Animater teleport:", e.message)); void receiveDisplace(data, senderId).catch((e) => console.warn("Animater finisher:", e.message)); void receiveMovePick(data, senderId).catch((e) => console.warn("Animater push/pull:", e.message)); }
  });
  Hooks.on("canvasTearDown", () => {
    void persistentStates?.clear();
    conditionBody?.clear();
    motions.stop();
    void optionalFx.stop();
    tokenFx.clear();
    void runtime?.stop();
    app?.workspace?.syncPreviewTokens({ clear: true });
  });
  const syncPreviewTokens = () => app?.workspace?.syncPreviewTokens();
  Hooks.on("controlToken", syncPreviewTokens);
  Hooks.on("targetToken", (user) => {
    if (user.id === game.user.id) syncPreviewTokens();
  });
  Hooks.on("updateToken", syncPreviewTokens);
  Hooks.on("canvasReady", syncPreviewTokens);
  const pruneFx=()=>void optionalFx.pruneExpired().catch(error=>console.warn('Animater FXMaster cleanup:',error.message));
  Hooks.on('canvasReady',pruneFx);
  setInterval(pruneFx,30000).unref?.();
  pruneFx();
  // Compile Tokenshade's shaders in the background once the scene has settled, so the
  // first token look of the session does not freeze the canvas while it compiles.
  let warming=null;
  const warmTokenFx=()=>void setTimeout(()=>{
    const renderer=canvas?.ready?canvas.app?.renderer:null;
    if(warming||!renderer||!globalThis.PIXI?.Program||!allowsTokenFx(localQuality()))return;
    warming=warmShaders(globalThis.PIXI,renderer).catch(error=>console.warn('Animater Tokenshade warm-up:',error.message)).finally(()=>{warming=null;});
  },3000).unref?.();
  Hooks.on('canvasReady',warmTokenFx);
  if(canvas?.ready)warmTokenFx();
  runtime = new AnimaterRuntime({
    soundCatalog: () =>
      installedSoundCatalog(game.modules, globalThis.Sequencer?.Database),
    get database() {
      return globalThis.Sequencer?.Database;
    },
    enabled: () => acceptsEvents() || hasOwnApproved(),
    weaponScale: () => Number(game.settings.get(ID, "weaponScale")) || 1,
    // Crits freeze at contact (world setting); on while the setting is not registered.
    hitStop: () => game.settings.get(ID, "hitStop") !== false,
    // Effects light the scene (world setting); in daylight only when allowed.
    effectLights: () => game.settings.get(ID, "effectLighting") !== false
      && (game.settings.get(ID, "effectLightingDaylight") !== false || (canvas?.environment?.darknessLevel ?? 0) > 0),
    usersFor: (tier) => usersForTier(Array.from(game.users?.contents ?? game.users?.values?.() ?? []), tier),
    soundUsers: () => usersForSound(Array.from(game.users?.contents ?? game.users?.values?.() ?? [])),
    recipes,
    riderRecipes: (event, saved) => game.system.id === "pf2e" ? riderRecipes(event, game.settings.get(ID, "featureCatalog"), saved, { customEnabled: enabled(), soundCatalog: installedSoundCatalog(game.modules, globalThis.Sequencer?.Database) }) : [],
    flashBefore: (recipe, context) => flash?.before(recipe, context),
    pickTeleport,
    teleport,
    // Does the token still carry an effect from this item ("Effect: Shield")?
    hasItemEffect: (actor, item) => {
      const name = sameEffectName(item?.name), id = item?.id;
      const from = (origin) => Boolean(id && String(origin ?? "").includes(id));
      const effects = ["dnd5e", "daggerheart"].includes(game.system.id) ? Array.from(actor?.appliedEffects ?? actor?.effects ?? []) : Array.from(actor?.items ?? []).filter((i) => i.type === "effect");
      return effects.some((e) => from(e.origin ?? e.system?.context?.origin?.item) || (name && sameEffectName(e.name) === name));
    },
    // A player's GM-approved recipe animates their own characters first.
    resolveRecipe: (event, saved) => ownApprovedRecipe(event) ?? systemRecipe(event, saved),
    // What a Strike lands on (metal armour, a raised shield, chitin…), for its surface cue.
    surfaceOf: (token, outcome) => targetSurface(token?.actor ?? token?.document?.actor, outcome),
    sizeOf: (token) => sizeOf(token?.actor ?? token?.document?.actor, token),
    surfaceSounds: () => game.settings.get(ID, SURFACE_SETTING) !== false,
    setSurfaceSounds: (on) => game.settings.set(ID, SURFACE_SETTING, on === true),
    recipeOrigin: (recipe, context) => recipeOrigin(recipe, context),
    ready: () => Boolean(canvas.ready && environment().ready),
    canPlay: (context) => Boolean(game.user.isGM || context.source?.isOwner),
    canSyncMotion: () => game.modules.get(ID)?.socket === true,
    // Preview of a lasting condition: show its body treatment for the preview's span.
    previewBody: (recipe, token) => {
      const kind = bodyTreatment(recipe.name);
      if (!kind || !token) return;
      const name = `preview-${uuid()}`;
      conditionBody?.add(name, token, kind);
      setTimeout(() => conditionBody?.remove(name), Math.max(3000, ...recipe.stages.map((s) => (s.delay ?? 0) + (s.duration ?? 0))));
    },
    fxCatalog,
    optionalFx: async (stage,context,{preview,session}) => {
      const unavailable=fxAvailability(stage,fxCatalog(),{preview});
      if(unavailable){runtime.trace('Skipped',unavailable);return;}
      if(stage.kind==='tokenfx' && !preview) {
        const portable={...stage,afterStage:''};
        for(const key of ['destination','origin','endpoint','motionTarget','landing'])delete portable[key];
        game.socket.emit(`module.${ID}`,{type:'tokenfx',sender:clientId,userId:game.user.id,
          sceneId:canvas.scene?.id,sourceId:context.source.id,tokenId:stage.destination.id,session,stage:portable});
      }
      return optionalFx.play(stage,{session,userId:game.user.id,preview,template:context.template??null});
    },
    stopOptionalFx: async ({session} = {}) => {
      if(session)game.socket.emit(`module.${ID}`,{type:'fx-stop',sender:clientId,userId:game.user.id,session});
      await optionalFx.stop({userId:game.user.id,session});
    },
    userId: () => game.user.id,
    gridSize: () => canvas.grid.size,
    gridDistance: () => canvas.scene?.grid?.distance ?? 5,
    areaMask,
    previewArea: (recipe, context) => {
      const prepared = {
        ...recipe,
        previewArea:
          recipe.previewArea ??
          (game.system.id==='pf2e'?catalogSpell(recipe.id)?.area:null) ??
          (recipe.itemUuid?.startsWith("Compendium.pf2e.spells-srd.")
            ? catalogSpell(recipe.itemUuid.split(".").at(-1))?.area
            : null),
      };
      if (
        !prepared.previewArea &&
        !recipe.stages.some((s) => s.kind === "template")
      )
        return null;
      return createCanvasPreviewArea(prepared, context, {
        canvas,
        DocumentClass: CONFIG.MeasuredTemplate.documentClass,
        TemplateClass: CONFIG.MeasuredTemplate.objectClass,
        userId: game.user.id,
        randomId: foundry.utils.randomID,
      });
    },
    sequence: () => new Sequence({ moduleName: ID }),
    // push false ends it on this screen only (a player's Activity Stop).
    endEffects: (filters, push) => Sequencer.EffectManager.endEffects(filters, push),
    effectRunning: (name) => (Sequencer.EffectManager.getEffects?.({ name })?.length ?? 1) > 0,
    endSounds: (filters) => Sequencer.SoundManager.endSounds(filters),
    // Sequencer synchronizes playback and loads media on each receiving client.
    // Waiting for every client here can stall the rolling user's animation.
    preloadSounds: files => Sequencer.Preloader.preload(files,false),
    adaptive: () => adaptiveHost.adaptive(),
    // Where a loaded sound is loudest (ms in), measured once per file.
    soundPeak: (file) => { if (!soundPeaks.has(file)) { const b = game.audio?.buffers?.getBuffer?.(file); if (!b) return null; soundPeaks.set(file, peakOf(b)); } return soundPeaks.get(file); },
    motion: async (stage, context, { preview, session }) => {
      if (isMoveStage(stage)) {
        if (!preview) return playMoveStage(stage, context, {
          gridSize: () => canvas.grid.size,
          pick: pickMove,
          // A picked square is where it lands, exactly; otherwise the shove walks the line and stops at walls.
          playFinisher: (shove, mover, source, spot) => playFinisher({ recipe: shove, mover, attacker: source }, spot ? { ...finisherHost(source), landing: () => ({ x: spot.x, y: spot.y }) } : finisherHost(source))
            .catch((error) => { runtime.trace("Blocked", error.message); return null; }),
        });
        stage = previewMotion(stage);
      }
      stage = withFragmentSeed(stage);
      // The cut follows this client's view of the swing; receivers reuse it, as they do the seed.
      if (stage.motion === "fragments") {
        const target = stage.motionTarget ?? context.targets?.[0];
        stage = withFragmentCut(stage, motionDirection(stage.destination, context.source, target, stage.motion, canvas.grid?.size ?? 100));
        // Absorbed pieces fly to the attacker as this client sees it; receivers reuse it too.
        stage = withFragmentTowards(stage, stage.destination, context.source, target, canvas.grid?.size ?? 100);
      }
      const data = {
        type: "motion",
        sceneId: canvas.scene?.id,
        userId: game.user.id,
        session,
        sender: clientId,
        sourceId: context.source.id,
        tokenId: stage.destination.id,
        targetId: stage.motionTarget?.id ?? context.targets?.[0]?.id,
        stage,
      };
      // Send only portable stage settings; placeables contain cyclic references.
      data.stage = { ...stage };
      delete data.stage.destination;
      delete data.stage.origin;
      delete data.stage.endpoint;
      delete data.stage.motionTarget;
      // A standalone remote stage already has resolved delay and duration.
      data.stage.afterStage = "";
      if (!preview) game.socket.emit(`module.${ID}`, data);
      return receiveMotion(data, { strict: true });
    },
    stopMotion: async () => {
      motions.stop(game.user.id, { prefix: true });
      game.socket.emit(`module.${ID}`, {
        type: "stop",
        userId: game.user.id,
        sender: clientId,
      });
    },
    onTrace: () => {
      if (app?.workspace?.page === "activity") app.workspace.render();
    },
  });
  runtime.refreshCatalog();
  if (['pf2e','sf2e','dnd5e','daggerheart'].includes(game.system.id)) {
    persistentStates = new PersistentStates({
      ...(game.system.id==='sf2e'?sfStateHost:game.system.id==='dnd5e'?dndStateHost:game.system.id==='daggerheart'?dhStateHost:{}),
      clientId,
      ready: () => Boolean(canvas.ready && environment().ready),
      sceneId: () => canvas.scene?.id,
      tokens: () => canvas.tokens?.placeables ?? [],
      lastingMode: () => game.settings.get(ID, "lastingMode"),
      recipes,
      // Your own lasting recipes follow the same switch as every other custom recipe.
      customEnabled: () => enabled(),
      // Filling AA's gaps: a condition or effect AA animates stays with AA.
      yields: (item) => (aaFillGaps() || taFillGaps()) && yieldsToAA({ type: "effect", item }),
      catalog: () => runtime.getCatalog(),
      state: (kind) => game.settings.get(ID, game.system.id==='sf2e'?sfSettingKey(kind):game.system.id==='dnd5e'?dndSettingKey(kind):game.system.id==='daggerheart'?dhSettingKey(kind):kind === "condition" ? "conditionCatalog" : "effectCatalog"),
      visibility: () => ({ isGM: game.user.isGM, secretConditions: ['pf2e','sf2e'].includes(game.system.id)&&game.settings.get(game.system.id, "metagame_secretCondition") === true }),
      gridSize: () => canvas.grid?.size ?? 100,
      gridDistance: () => canvas.scene?.grid?.distance ?? 5,
      sequence: () => new Sequence({ moduleName: ID }),
      end: (name) => Sequencer.EffectManager.endEffects({ name }, false),
      alive: (name) => Sequencer.EffectManager.getEffects({ name }).length > 0,
      // Condition looks are how the state shows at all, so they play down to Low quality; other filters need Full.
      retainFx:(stage,{session})=>(stage.fxEssential?allowsMotion(localQuality()):allowsTokenFx(localQuality()))?optionalFx.retain(stage,{session,userId:`state:${clientId}`}):undefined,
      budget:()=>stateBudget(localQuality()),
      stopFx:session=>optionalFx.stop({session}),
      // The selected Dazzled token sees everyone else as Concealed.
      perceivedStates:(token)=>{
        if(!["pf2e","sf2e"].includes(game.system.id))return [];
        const controlled=canvas.tokens?.controlled??[],observer=controlled.length===1?controlled[0]:null;
        const slugs=observer?.actor?.itemTypes?.condition?.map((c)=>c.slug)??[];
        return perceivedStates(slugs,token,observer);
      },
      opaqueArt:(token)=>squareTokenArt(token),
      // Daggerheart's defeated set (Defeated, Unconscious, Dead, Death move) follows the Defeated look, as one layer per actor.
      // Defeated (dead) creatures keep only their Defeated look; their conditions and effects stop showing.
      defeated:(token)=>isDefeated(token.actor,game.system.id==='daggerheart'?DH_DEFEATED_STATUSES:[defeatedStatusId()]),
      builtinStates:(token)=>game.system.id==='daggerheart'?dhDefeatedStates(token.actor,game.settings.get(ID,DEFEATED_LOOK)):defeatedStates(token.actor,{mode:game.settings.get(ID,DEFEATED_LOOK),statusId:defeatedStatusId()}),
      // A token deleted or left behind with its scene is not drawn on, and only existing documents are tied.
      tokenAlive:(token)=>!token?.destroyed&&(typeof fromUuidSync!=="function"||!token?.document?.uuid||!!fromUuidSync(token.document.uuid,{strict:false})),
      documentExists:(uuid)=>typeof fromUuidSync!=="function"||!!fromUuidSync(uuid,{strict:false}),
      body:{add:(...a)=>conditionBody?.add(...a),remove:(...a)=>conditionBody?.remove(...a)},
      origin: (item, recipe) => recipeOrigin(recipe, { item }),
      trace: (status, detail, recipe, meta) => runtime.trace(status, detail, recipe, meta),
    });
    for (const hook of ["createActiveEffect","updateActiveEffect","deleteActiveEffect","createItem", "updateItem", "deleteItem", "updateActor", "createToken", "updateToken", "deleteToken", "canvasReady", "updateWorldTime", "updateCombat", "deleteCombat", "updateUser", "controlToken"])
      Hooks.on(hook, () => persistentStates.schedule());
    // Hovering or selecting refreshes tokens many times a second; only a change a look depends on re-checks.
    const lookChanged = tokenLookChanged();
    Hooks.on("refreshToken", (token) => { if (lookChanged(token)) persistentStates.schedule(); });
    // Sequencer re-initializes a drawn scene shortly after it is ready (450 ms after a scene switch), destroying
    // every effect on the canvas, ours included; check again once it has (token refreshes can delay it), and redraw what it dropped.
    Hooks.on("canvasReady", () => { for (const ms of [1000, 3000]) setTimeout(() => persistentStates?.schedule(), ms); });
    // A creature's turn starts: its played-once conditions show again for a moment (lastingMode "turn").
    Hooks.on("updateCombat", (combat, changed) => {
      if (!("turn" in (changed ?? {}) || "round" in (changed ?? {})) || combat?.scene?.id && combat.scene.id !== canvas.scene?.id) return;
      const token = combat?.combatant?.token?.object;
      if (token) void persistentStates.replay(token);
    });
    Hooks.on("preCreateSequencerEffect", (data) => persistentStates.accepts(data.name) ? undefined : false);
    Hooks.on("createSequencerEffect", (effect) => {
      queueMicrotask(() => {
        if (!persistentStates.accepts(effect.data?.name))
          void Sequencer.EffectManager.endEffects({ effects: [effect] }, false);
      });
    });
    Hooks.on("updateSetting", (setting) => {
      if (String(setting.key ?? setting.id ?? "").startsWith(`${game.system.id}.`) || String(setting.key ?? setting.id ?? "").startsWith(`${ID}.`)) persistentStates.schedule();
    });
    persistentStates.schedule();
  }
  game.modules.get(ID).api = {
    open,
    recipes,
    catalog: () => clone(runtime.getCatalog()),
    activity: () => clone(runtime.log),
    spells: () => ({ source: clone(game.system.id==='daggerheart'?DAGGERHEART_SOURCE:game.system.id==='sf2e'?SF2E_SOURCE:game.system.id==='dnd5e'?DND5E_SOURCE:PF2E_SOURCE), spells: clone(game.system.id==='daggerheart'?dhEntries('card'):game.system.id==='sf2e'?sfEntries('spell'):game.system.id==='dnd5e'?dndEntries('spell'):game.system.id==='pf2e'?PF2E_SPELLS:[]) }),
    feats: () => ({ source: clone(game.system.id==='sf2e'?SF2E_SOURCE:game.system.id==='dnd5e'?DND5E_SOURCE:PF2E_FEAT_SOURCE), feats: clone(game.system.id==='sf2e'?sfEntries('feat'):game.system.id==='dnd5e'?dndEntries('feat'):game.system.id==='pf2e'?PF2E_FEATS:[]) }),
    actions: () => ({ source: clone(game.system.id==='sf2e'?SF2E_SOURCE:PF2E_ACTION_CATALOG.source), actions: clone(game.system.id==='sf2e'?sfEntries('action'):game.system.id==='pf2e'?PF2E_ACTION_CATALOG.entries:[]) }),
    features: () => ({ source: clone(game.system.id==='sf2e'?SF2E_SOURCE:PF2E_FEATURE_CATALOG.source), features: clone(game.system.id==='sf2e'?sfEntries('feature'):game.system.id==='pf2e'?PF2E_FEATURE_CATALOG.entries:[]) }),
    weapons: () => ({ source: clone(game.system.id==='daggerheart'?DAGGERHEART_SOURCE:game.system.id==='sf2e'?SF2E_SOURCE:game.system.id==='dnd5e'?DND5E_SOURCE:PF2E_WEAPON_SOURCE), weapons: clone(game.system.id==='daggerheart'?dhEntries('weapon'):game.system.id==='sf2e'?sfEntries('weapon'):game.system.id==='dnd5e'?dndEntries('weapon'):game.system.id==='pf2e'?PF2E_WEAPONS:[]) }),
    items:()=>({source:clone(DND5E_SOURCE),items:clone(game.system.id==='dnd5e'?dndEntries('item'):[])}),
    conditions: () => ({ source: clone(game.system.id==='daggerheart'?DAGGERHEART_SOURCE:game.system.id==='sf2e'?SF2E_SOURCE:game.system.id==='dnd5e'?DND5E_SOURCE:PF2E_STATE_SOURCE), conditions: clone(game.system.id==='daggerheart'?dhEntries('condition'):game.system.id==='sf2e'?sfEntries('condition'):game.system.id==='dnd5e'?dndEntries('condition'):game.system.id==='pf2e'?PF2E_CONDITIONS:[]) }),
    effects: () => ({ source: clone(game.system.id==='sf2e'?SF2E_SOURCE:game.system.id==='dnd5e'?DND5E_SOURCE:PF2E_STATE_SOURCE), effects: clone(game.system.id==='sf2e'?sfEntries('effect'):game.system.id==='dnd5e'?dndEntries('effect'):game.system.id==='pf2e'?PF2E_EFFECTS:[]) }),
    refreshPersistent: () => persistentStates?.reconcile(),
    finishers: finishersApi,
    sequencerSpeedups: sequencerSpeedupsApi,
    // id, saved recipe name, or a recipe object (e.g. from resolve()).
    async play(id, context = manualContext()) {
      const recipe = findRecipe(id);
      if (!recipe) throw Error(`Unknown Animater recipe: ${id?.id ?? id}`);
      const source = sourceFor(context);
      return playTest(recipe, {
        ...context,
        source,
        targets: context.targets ?? [],
        area: context.area ?? (context.template ? eventArea({ ...context, source }) : undefined),
      });
    },
    resolve: (input) => clone(resolveEvent(eventFrom(input))) ?? null,
    handles(input) {
      if (input?.documentName !== "Item") return Boolean(resolveEvent(eventFrom(input)));
      return ["use", "attack", "damage", "template"].some(type => resolveEvent({ type, item: input, actor: input.actor }));
    },
    preview: async (id) => {
      const r = findRecipe(id);
      if (!r) throw Error("Unknown recipe.");
      return playTest(r, manualContext(), { preview: true });
    },
    stop: () => runtime.stop(),
  };
  registerAATakeover({
    // Filling gaps, AA keeps whatever it animates: Animater only stops AA for items AA has nothing for.
    enabled: () => acceptsEvents() && aaTakeover() && !aaFillGaps(),
    // Conditions and effects are Animater's lasting animations, not recipes: AA stops for those too.
    resolve: (event) => resolveEvent(event) ?? (event.type === "effect" && persistentStates?.covers(event.item) ? true : null),
    context: () => ({ systemId: game.system.id, userId: game.user.id, twoe: ["pf2e", "sf2e"].includes(game.system.id) ? twoeEvent : null }),
  });
  registerSpellArsenal();
  // Combat flash screens: the active GM plays one to everyone when combat starts or ends.
  flash = flashScreens({
    ID, clientId,
    quietHere: () => qualityRank(localQuality()) === 0,
    resolveMedia: (src) => (!src || /\.(webm|mp4|png|jpe?g|webp|gif|svg)$/i.test(src) ? src : runtime.getCatalog().find((i) => i.key === src || i.key.startsWith(`${src}.`))?.file ?? ""),
    trace: (status, detail) => runtime.trace(status, detail),
  });
  // Damage rolls are remembered briefly so the HP change that follows knows its damage type.
  // D&D reports the damage it applies on the applying client; PF2e/SF2e through the roll message.
  const damageLog = [];
  const remember = (damage) => {
    if (!damage) return;
    damageLog.push({ ...damage, at: Date.now() });
    if (damageLog.length > 30) damageLog.shift();
  };
  // D&D applies damage without naming its attacker; its roll message does (finishers).
  if (game.system.id === "dnd5e") Hooks.on("dnd5e.calculateDamage", (actor, damages) => remember(damageFromParts(damages, actor?.id)));
  Hooks.on("createChatMessage", (message) => remember(damageFromMessage(message, game.system.id)));
  // Stages whose artwork is not installed (Free vs Patreon) are left out rather than blocking the rest.
  // Token filter layers play only while Tokenshade is on.
  const installedStages = (recipe) => ({ ...recipe, stages: recipe.stages.filter((s) => ["motion", "sound"].includes(s.kind) || (s.kind === "tokenfx" ? fxCatalog().tokenReady : resolveAsset(s, runtime.getCatalog()))) });
  // A creature going down collapses once (dropping to 0 HP in D&D 5e, PF2e and SF2e; marking
  // its last hit point in Daggerheart, or a companion its last stress), finished in the damage's
  // look; its Unconscious or Dying body treatment takes over afterwards. Energy damage short of
  // that flashes on the token. hp-state.mjs reads each system's track.
  const hpOf = (actor) => hpState(actor, game.system.id);
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (foundry.utils.hasProperty(changes, hpPath(actor, game.system.id))) options.animaterHpBefore = hpOf(actor);
  });
  // Finishers play on the real token (finisher-play.mjs): travel lands, the token is moved
  // there, then it vanishes, stays as a body, or stays.
  // A slowed kill (tempo) slows its ending fade too.
  const finisherHost = (attacker, { tempo } = {}) => ({
    gridSize: () => canvas.grid.size,
    landing: finisherLanding,
    wallHit: finisherWallHit,
    play: (recipe, context) => new Promise((resolve) => {
      runtime.play(installedStages(recipe), context, { onStart: (started) => resolve(started.playbackPlan) })
        .then(() => resolve(null), (error) => { runtime.trace("Blocked", error.message); resolve(null); });
    }),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fade: (token) => runtime.play({ id: "animater-finisher-fade", name: "Finisher fade", trigger: "manual", stages: [{ kind: "motion", motion: "fade", subject: "source", duration: 900, motionEnd: "hold", assets: [] }] }, { source: token, targets: [], tempo }),
    commit: (token, data) => commitDisplace(token, data, attacker),
    trace: (status, detail) => runtime.trace(status, detail),
  });
  // Resolves playFinisher's answer: true played, false a write failed, null never played.
  const runFinisher = (recipe, { mover, attacker, extra }) => {
    const dead = hpOf(mover.actor)?.down === true;
    return playFinisher({ recipe, mover, attacker, dead, extra }, finisherHost(attacker, extra)).catch((error) => { runtime.trace("Blocked", error.message); return null; });
  };
  // A critical strike: a player's pick plays when it plays on crits; with no pick, the GM's critical
  // finishers. It plays on each critically struck target (critTargets), from the event's source
  // (for a save, the caster), marks each one on every client and answers the ids of the targets it started on.
  const playCritFinisher = (event, item, struck) => {
    const started = new Set();
    const pick = ownerPick(event.item);
    const recipe = pick ? pickPlays(pick, "crit", { outcome: "criticalSuccess" }) : critFinishers(recipes(), item)[0];
    if (!recipe) return started;
    const keyOf = (target) => finishedKey({ attackerId: event.source?.id, targetId: target.id, itemUuid: item.itemUuid ?? "", recipeId: recipe.id, save: event.type === "save" });
    for (const mover of struck) {
      started.add(mover.id);
      announceFinished(keyOf(mover), true);
      // It freezes with the attack's hit-stop, if the event is playing one (runtime.mjs: contactOf).
      const extra = finisherHitStop(event);
      // A play that never started (blocked) takes its mark back, so the kill plays it in full.
      void runFinisher(recipe, { mover, attacker: event.source, extra }).then((played) => { if (played === null) announceFinished(keyOf(mover), false); });
    }
    return started;
  };
  // Every successful use of an assigned item (the roll that has a degree of success, else the use),
  // and every target it critically struck (a critical roll, or a critically failed save against it).
  // Answers the ids of the targets a crit finisher started on.
  const finisherSeen = new Set();
  playUseFinishers = async (event) => {
    const struck = critTargets(event), moment = finisherMoment(event);
    if (!event || (!moment && !struck.length)) return;
    if (event.id) { if (finisherSeen.has(event.id)) return; finisherSeen.add(event.id); if (finisherSeen.size > 500) finisherSeen.delete(finisherSeen.values().next().value); }
    const item = { itemName: event.item?.name ?? event.itemName, itemSlug: event.item?.slug ?? event.item?.system?.slug, itemUuid: event.itemUuid ?? event.item?.uuid };
    const crit = struck.length ? playCritFinisher(event, item, struck) : new Set();
    if (!moment) return crit;
    // A player's pick: only it, when it plays on uses. Otherwise the GM's use finishers.
    const pick = ownerPick(event.item);
    const uses = pick ? [pickPlays(pick, "use", { event })].filter(Boolean)
      : matchFinishers(recipes(), item, "use").filter((recipe) => usePasses(recipe.finisher, event));
    for (const recipe of uses) for (const mover of (event.targets ?? []).filter((t) => t && targetPassed(event, t))) {
      // A crit finisher already moves this target in this action: one finisher per token.
      if (!crit.has(mover.id)) void runFinisher(recipe, { mover, attacker: event.source });
    }
    return crit;
  };
  // The killing blow on an NPC (hp-state.mjs: a PF2e/SF2e/D&D npc; a Daggerheart adversary or any
  // creature no player owns): the killing item's kill finisher, else the default finisher.
  const killFinisherFor = (actor, token) => {
    if (!isNpcActor(actor, game.system.id, { playerOwned: ownerUsers(actor).length > 0 }) || token.document.hidden) return null;
    const ids = { actorId: actor.id, tokenId: token.id };
    const by = recallAttribution(damageLog, ids) ?? recallDamage(damageLog, ids);
    const attacker = by?.sourceTokenId ? canvas.tokens.get(by.sourceTokenId) ?? null : null;
    // A player's pick on the killing item plays only itself, when it plays on kills ("Needs: Only on a
    // critical" holds for it). Any other killing item (an NPC's, a player's with no pick, or one that
    // cannot be found) keeps the GM's kill finishers and the default finisher.
    const pick = ownerPick(killingItem(by, attacker)), item = { itemUuid: by?.synthetic ? undefined : by?.itemUuid, itemName: by?.itemName, itemSlug: by?.itemSlug ?? undefined };
    // A critically failed save against this item left its crit finisher's mark on this token: the
    // spell's own (non-critical) damage is that crit's killing blow, so the kill counts as critical.
    const base = { attackerId: by?.sourceTokenId, targetId: token.id, itemUuid: by?.itemUuid ?? "" };
    const critIds = (pick ? [pick] : critFinishers(recipes(), item)).filter(Boolean).map((r) => r.id);
    const saveKey = critIds.map((recipeId) => finishedKey({ ...base, recipeId, save: true })).find((key) => finished.has(key));
    const crit = by?.crit === true || Boolean(saveKey);
    const recipe = pick ? pickPlays(pick, "kill", { outcome: crit ? "criticalSuccess" : "success" })
      : killFinisher(recipes(), item, game.settings.get(ID, DEFAULT_FINISHER), { crit, damageType: recallDamage(damageLog, ids)?.type ?? by?.type, defaultEnding: game.settings.get(ID, DEFAULT_FINISHER_ENDING) });
    if (!recipe) return null;
    // The crit already played a finisher's travel on this token: only an ending is left. A critical
    // killing blow is that crit's own damage (the same finisher's mark); after a save crit, whichever
    // finisher the kill chose (the default included) only ends it, never travels again. Marks are used once.
    const endingOnly = saveKey ? finished.consume(saveKey) : by?.crit === true && finished.consume(finishedKey({ ...base, recipeId: recipe.id }));
    return { recipe, attacker, endingOnly, crit };
  };
  // Slow motion for a notable kill (systems/notable-kill.mjs): the last enemy, a critical kill or a
  // boss-level foe, in a started combat it fights in (with none, only a crit counts).
  const killTempo = (actor, crit) => {
    if (!game.settings.get(ID, "slowMotionKills")) return undefined;
    const systemId = game.system.id;
    const combat = game.combats?.find((c) => c.started && Array.from(c.combatants).some((cb) => cb.actor?.id === actor.id)) ?? game.combat;
    const notable = isNotableKill({
      finalEnemy: downMoment(combat, actor, systemId) === "finalEnemy", crit,
      rank: creatureRank(actor, systemId), partyLevels: combat?.started ? partyLevels(combat, systemId) : [], systemId,
    });
    return notable ? SLOW_TEMPO : undefined;
  };
  // The item that struck the killing blow, from the damage roll's origin. A synthetic strike (no
  // Item document) answers a descriptor on the attacking actor, whose flag holds its pick.
  const killingItem = (by, attacker) => {
    if (!by?.itemUuid && !by?.itemName && !by?.itemSlug) return null;
    if (by.synthetic) {
      let actor = attacker?.actor ?? null;
      try { actor ??= by.actorUuid ? globalThis.fromUuidSync?.(by.actorUuid, { strict: false }) ?? null : null; } catch { actor = null; }
      return actor && (by.itemName || by.itemSlug) ? { actor, name: by.itemName ?? undefined, slug: by.itemSlug ?? undefined } : null;
    }
    let item = null;
    try { item = by.itemUuid ? globalThis.fromUuidSync?.(by.itemUuid, { strict: false }) ?? null : null; } catch { item = null; }
    return item ?? attacker?.actor?.items?.find?.((i) => (by.itemUuid && i.uuid === by.itemUuid) || (!by.itemUuid && i.name === by.itemName)) ?? null;
  };
  // Just the ending of a finisher whose travel already played: hidden or Defeated, as playFinisher ends.
  // A slowed kill fades slowly; hidden is written once the fade ends.
  const finishOnly = async (recipe, token, attacker, tempo) => {
    const host = finisherHost(attacker, { tempo }), ending = recipe.finisher?.ending;
    host.trace("Finisher", `${recipe.name}: ${token.name ?? "token"} (ending)`);
    try {
      if (ending === "vanish") { await host.fade(token); await host.commit(token, { hidden: true, finisher: recipe.id }); }
      else if (ending === "body") await host.commit(token, { defeated: true, finisher: recipe.id });
      return true;
    } catch (error) { host.trace("Blocked", `Finisher ${recipe.name}: ${error.message}`); return false; }
  };
  // The collapse (or dramatic death) on a drop to 0 HP, else the energy-damage flash.
  const playDamageMoment = (actor, token, dropped, tempo) => {
    const type = recallDamage(damageLog, { actorId: actor.id, tokenId: token.id })?.type;
    const recipe = dropped ? (game.settings.get(ID, DRAMATIC_DEATHS) ? deathRecipe(type, COLLAPSE) : COLLAPSE) : hitRecipe(type);
    const playable = recipe && installedStages(recipe);
    if (!playable?.stages.length) return;
    void runtime.play(playable, { source: token, targets: [], tempo }).catch((error) => runtime.trace("Blocked", error.message));
  };
  // A use finisher's travel (and its move write) still playing on this token finishes first,
  // so the kill finisher starts from where it landed.
  const motionSettled = async (token, limit = 4000) => {
    for (let waited = 0; motions?.active.has(token) && waited < limit; waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
  };
  const playKill = async (actor, token, kill) => {
    // Notable or not is read at the drop, before the finale screen.
    const tempo = killTempo(actor, kill.crit);
    // The last enemy falling: its screen (Finish Him!) plays first, then the finisher.
    const finale = flash?.finaleLength?.(actor) ?? 0;
    await Promise.all([motionSettled(token), finale ? new Promise((resolve) => setTimeout(resolve, finale + 150)) : null]);
    if (kill.endingOnly) return void await finishOnly(kill.recipe, token, kill.attacker, tempo);
    // Nothing played and nothing was written: the old collapse stands in.
    const extra = tempo ? { tempo } : {};
    if ((await runFinisher(kill.recipe, { mover: token, attacker: kill.attacker, extra })) === null) playDamageMoment(actor, token, true, tempo);
  };
  // A drop with no kill finisher (a player character, a hidden token) collapses, slowed when notable.
  const dropTempo = (actor, token) => {
    const ids = { actorId: actor.id, tokenId: token.id };
    return killTempo(actor, (recallAttribution(damageLog, ids) ?? recallDamage(damageLog, ids))?.crit === true);
  };
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    const change = hpChange(options.animaterHpBefore, hpOf(actor));
    if (userId !== game.user.id || !acceptsEvents() || !change) return;
    const dropped = change.dropped;
    if (!dropped && !game.settings.get(ID, DAMAGE_REACTIONS)) return;
    for (const token of actor.getActiveTokens?.() ?? []) {
      if (token.document?.parent?.id !== canvas.scene?.id) continue;
      const kill = dropped ? killFinisherFor(actor, token) : null;
      if (kill) void playKill(actor, token, kill).catch((error) => runtime.trace("Blocked", error.message));
      else playDamageMoment(actor, token, dropped, dropped ? dropTempo(actor, token) : undefined);
    }
  });
  if (["pf2e","sf2e"].includes(game.system.id)) {
    Hooks.on("createChatMessage", (message) => {
      // Actions such as Shove roll a skill check; dispatch plays the action, finishers ride the check.
      // Gated and paced like dispatch: events accepted, AA-customized items left alone, dice landed.
      const check = acceptsEvents() ? checkFinisherEvent(message, game.system.id, game.user.id) : null;
      if (check && !yieldsToAA(check)) void afterDice(check).then(() => enrich(check)).then((e) => e && !yieldsToAA(e) && playUseFinishers(e)).catch((error) => runtime.trace("Blocked", error.message));
      // A save against a spell or effect: a critical failure is a crit finisher on the saver.
      const saved = acceptsEvents() ? saveFinisherEvent(message, game.system.id, game.user.id) : null;
      const critStarted = saved ? afterDice(saved).then(() => enrich(saved)).then((e) => (e && !yieldsToAA(e) ? playUseFinishers(e) : null))
        .catch((error) => { runtime.trace("Blocked", error.message); return null; }) : null;
      // A saving throw against a spell or effect: the saving creature reacts by degree, unless a crit
      // finisher started on it from this save (one animation per token per action: the finisher wins).
      const save = (message.author?.id ?? message.user?.id) === game.user.id ? twoeSaveOutcome(message, game.system.id) : null;
      if (save) {
        const saver = message.speaker?.token;
        return void Promise.resolve(critStarted).then((started) => { if (!started?.has?.(saver)) return playSaveReaction(save, saver, message.id, message.speaker?.scene); });
      }
      void dispatch((game.system.id==="sf2e"?sf2eEvent:pf2eEvent)(message, game.user.id));
    });
    // A sustained spell's effect on its caster ends (expired, dismissed, not
    // sustained): its lasting area ends on the client that cast it.
    Hooks.on("deleteItem", (item) => {
      if (item.type !== "effect" || !item.actor) return;
      const origin = item.system?.context?.origin?.item ?? item.flags?.pf2e?.origin?.item ?? "";
      const spellId = /Item\.([^.]+)$/.exec(String(origin))?.[1];
      if (spellId) void runtime.endConcentration(item.actor.id, spellId);
      // A "stay until the effect ends" animation of that item (or same-named recipe) ends too.
      void runtime.endWithEffect(item.actor.id, { itemId: spellId, name: item.name });
    });
    Hooks.on("createItem", (item, _options, userId) => {
      if (
        userId !== game.user.id ||
        !["effect", "condition"].includes(item.type) ||
        !item.actor
      )
        return;
      // Document-linked custom layers belong to the lifecycle reconciler.
      if (matchRecipe(recipes().filter(r => r.lifecycle === "document"), { type: "effect", systemId:game.system.id, item })) return;
      void dispatch({
        id: `effect:${item.uuid}`,
        type: "effect",
        systemId:game.system.id,
        item,
        actor: item.actor,
      });
    });
  }
  if (game.system.id === "dnd5e") {
    Hooks.on("dnd5e.rollAttackV2", (rolls, data) => {
      void dispatch(dnd5eEvent("attack", data?.subject, { rolls }));
    });
    // A saving throw against a known DC: the saving creature reacts to passing or failing.
    const onSave = (rolls, data) => {
      const outcome = dnd5eSaveOutcome(rolls, { isGM: game.user.isGM }), actor = data?.subject;
      const token = actor?.getActiveTokens?.()?.find((t) => t.document?.parent?.id === canvas.scene?.id);
      if (outcome && token) void playSaveReaction(outcome, token.id, rolls[0]?.parent?.id, canvas.scene?.id);
    };
    Hooks.on("dnd5e.rollSavingThrow", onSave);
    Hooks.on("dnd5e.rollDamageV2", (rolls, data) => {
      void dispatch(dnd5eEvent("damage", data?.subject, { rolls }));
    });
    // Concentration ends (broken, dropped or expired): the spell's lasting areas end
    // on the client that cast them, which is the one that recorded them.
    Hooks.on("deleteActiveEffect", (effect) => {
      const actor = effect.parent?.documentName === "Actor" ? effect.parent : effect.parent?.actor;
      if (!actor) return;
      // A "stay until the effect ends" animation of the effect's item ends with it.
      void runtime.endWithEffect(actor.id, { itemId: /Item\.([^.]+)/.exec(effect.origin ?? "")?.[1], name: effect.name });
      if (!effect.statuses?.has?.("concentrating")) return;
      const itemId = effect.flags?.dnd5e?.item?.id ?? /Item\.([^.]+)/.exec(effect.origin ?? "")?.[1];
      void runtime.endConcentration(actor.id, itemId);
    });
    Hooks.on("dnd5e.postUseActivity", (activity, _config, results) => {
      void dispatch(dnd5eEvent("use", activity, { results }));
    });
    Hooks.on("createActiveEffect", (effect, _options, userId) => {
      if (userId !== game.user.id || effect.disabled || effect.isSuppressed) return;
      if(matchRecipe(recipes().filter(r=>r.lifecycle==='document'),{type:'effect',systemId:'dnd5e',item:effect}))return;
      const actor =
        effect.parent?.documentName === "Actor"
          ? effect.parent
          : effect.parent?.actor;
      if (actor)
        void dispatch({
          id: `effect:${effect.uuid}`,
          type: "effect",
          item: effect,
          actor,
        });
    });
  }
  if (game.system.id === "daggerheart") {
    // Shapes verified against Daggerheart 2.10.12; an older system may move the fields the adapter reads.
    if (daggerheartVersionBelow(game.system.version)) console.warn(`Animater | Daggerheart ${game.system.version} is older than ${DAGGERHEART_VERIFIED}, the version its roll and chat shapes were checked against; some automatic animations may be skipped.`);
    const sceneId = () => canvas.scene?.id ?? null;
    // An event the adapter recognised but could not resolve is traced as Skipped, never thrown.
    const resolved = (read, label) => {
      try {
        const event = read();
        if (event?.skipped) { runtime.trace("Skipped", event.skipped); return null; }
        return event;
      } catch (error) { runtime.trace("Skipped", `${label}: ${error.message}`); return null; }
    };
    // An action used without an attack or spellcast roll (a buff, a heal, a feature); rolled ones ride their roll message.
    // An unlinked adversary's actor knows its own token; a linked one is found by its actor (sourceFor).
    Hooks.on("daggerheart.postUseAction", (action, config) => {
      void dispatch(resolved(() => daggerheartUseEvent(action, config, { sceneId: sceneId(), tokenId: action?.actor?.token?.id ?? null }), "Daggerheart action"));
    });
    // Hope or Fear on this user's duality roll: a short accent on the roller's token, beside the item's own animation.
    const playDualityAccent = async (message) => {
      if (!acceptsEvents() || game.settings.get(ID, DUALITY_ACCENT) === false) return;
      const accent = dualityAccent(message, game.user.id), token = accent && (!accent.sceneId || accent.sceneId === canvas.scene?.id) ? canvas.tokens?.get(accent.tokenId) : null;
      if (!token) return;
      await afterDice({ type: "check", messageId: message.id });
      const playable = installedStages(validateRecipe(accent.recipe));
      if (playable.stages.length) await runtime.play(playable, { source: token, targets: [] });
    };
    Hooks.on("createChatMessage", (message) => {
      void dispatch(resolved(() => daggerheartRollEvent(message, game.user.id, { sceneId: sceneId() }), "Daggerheart roll"));
      void dispatch(resolved(() => daggerheartDamageEvent(message, game.user.id, { sceneId: sceneId() }), "Daggerheart damage"));
      void playDualityAccent(message).catch((error) => runtime.trace("Blocked", error.message));
    });
    // Damage rolled from an attack or spellcast card is written onto that card: every client remembers
    // it (kills know their attacker, item and type). Anyone who owns the speaker's actor may roll it
    // (the GM, a co-owner): the client that wrote it plays it, whoever authored the card.
    Hooks.on("updateChatMessage", (message, changes, _options, userId) => {
      if (!foundry.utils.hasProperty(changes ?? {}, "system.damage")) return;
      remember(damageFromMessage(message, "daggerheart"));
      const author = message?.author?.id ?? message?.user?.id;
      if (userId === game.user.id) void dispatch(resolved(() => daggerheartDamageEvent(message, author, { sceneId: sceneId() }), "Daggerheart damage"));
    });
    // A condition applied by this client: Death move plays its moment through dispatch; lasting
    // conditions are the persistent layers' (daggerheart-states.mjs).
    Hooks.on("createActiveEffect", (effect, _options, userId) => {
      if (userId !== game.user.id || effect?.disabled || effect?.isSuppressed) return;
      if (matchRecipe(recipes().filter((r) => r.lifecycle === "document"), { type: "effect", systemId: "daggerheart", item: effect })) return;
      // Lasting conditions and the defeated set are drawn as layers, not one-shot moments: no Skipped row for them.
      const statuses = Array.from(effect?.statuses ?? []);
      if (statuses.some((statusId) => findDhState({ type: "condition", statusId }) || (DH_DEFEATED_STATUSES.includes(statusId) && statusId !== "deathMove"))) return;
      const actor = effect?.parent?.documentName === "Actor" ? effect.parent : effect?.parent?.actor;
      if (actor) void dispatch({ id: `effect:${effect.uuid}`, type: "effect", systemId: "daggerheart", item: effect, actor });
    });
  }
  for (const hook of ["createMeasuredTemplate", "createRegion"])
    Hooks.on(hook, (template, _options, userId) => {
      if (userId !== game.user.id) return;
      if (template.parent?.id && template.parent.id !== canvas.scene?.id) return;
      const run = async () => {
        let item, actor, activity, source, tokenId, castRank;
        if (["pf2e","sf2e"].includes(game.system.id)) {
          const flags = template.flags?.[game.system.id];
          const origin = flags?.origin;
          // Native Regions retain the card that placed them. Its item getter
          // reconstructs embedded/heightened spells; a temporary UUID alone
          // can no longer resolve after a scroll or wand has been used.
          const message = template.message ?? game.messages?.get(flags?.messageId);
          item = template.item ?? message?.item ??
            (origin?.uuid ? await fromUuid(origin.uuid) : null);
          if (item?.type === "consumable" && item.actor)
            item = item.embeddedSpell ?? item;
          actor = item?.actor ?? message?.speakerActor ?? message?.actor;
          if (!actor && origin?.actor) {
            const document = await fromUuid(origin.actor);
            if (document?.documentName === "Actor") actor = document;
          }
          if (message?.speaker?.scene === template.parent?.id)
            tokenId = message.speaker.token;
          castRank = Number(origin?.castRank ?? item?.rank) || undefined;
          if (!item && (origin?.uuid || flags?.messageId))
            runtime.trace("Skipped", `${template.name ?? "Placed area"}: source item could not be resolved.`);
        }
        if (game.system.id === "dnd5e") {
          const uuid =
            template.flags?.dnd5e?.activity ?? template.flags?.dnd5e?.origin;
          const origin = typeof uuid === "string" ? await fromUuid(uuid) : null;
          item =
            origin?.item ?? (origin?.documentName === "Item" ? origin : null);
          actor = origin?.actor;
          activity=origin?.item?origin:null;
          const tokenUuid=template.flags?.dnd5e?.origin;
          const token=typeof tokenUuid==='string'?await fromUuid(tokenUuid):null;
          if(token?.documentName==='Token')source=token;
        }
        if (item)
          await dispatch({
            id: `area:${template.uuid}`,
            type: "template",
            systemId:game.system.id,
            activity,
            activityId:activity?.id??activity?._id,
            activityName:activity?.name,
            spellLevel:template.flags?.dnd5e?.spellLevel,
            source,
            tokenId,
            castRank,
            item,
            actor: actor ?? item.actor,
            template,
            sceneId: template.parent?.id,
          });
      };
      if (acceptsEvents())
        void run().catch((error) => runtime.trace("Blocked", error.message));
    });
});
Hooks.on("sequencer.ready", () => {
  // JB2A registers in this hook; wait until all synchronous listeners finish.
  queueMicrotask(() => {
    runtime?.refreshCatalog();
    persistentStates?.schedule();
    app?.workspace?.render();
  });
});
// Square token art (no dynamic ring) that is opaque to its corners hides anything drawn under the token.
// Read once per image at 16x16; unreadable or not-yet-loaded art counts as round and is checked again later.
const artOpacity = new Map();
function squareTokenArt(token) {
  const doc = token?.document;
  if (!doc || doc.ring?.enabled) return false;
  const src = doc.texture?.src;
  if (!src) return false;
  if (artOpacity.has(src)) return artOpacity.get(src);
  const source = token.mesh?.texture?.baseTexture?.resource?.source ?? token.texture?.baseTexture?.resource?.source;
  const width = source?.naturalWidth || source?.videoWidth || source?.width;
  if (!width) return false;
  let opaque = false;
  try {
    const canvasEl = document.createElement("canvas");
    canvasEl.width = canvasEl.height = 16;
    const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data, alpha = (x, y) => data[(y * 16 + x) * 4 + 3];
    opaque = [alpha(1, 1), alpha(14, 1), alpha(1, 14), alpha(14, 14)].every((v) => v > 200);
  } catch { opaque = false; }
  artOpacity.set(src, opaque);
  return opaque;
}
Hooks.on("getSceneControlButtons", (controls) => {
  if (controls.tokens?.tools)
    controls.tokens.tools.animater = {
      name: "animater",
      title: "Animater",
      icon: "fas fa-wand-magic-sparkles",
      button: true,
      // Players open their own Studio; the GM sees the full workspace.
      visible: game.settings.get(ID, "showControlButton") !== false,
      onChange: () => open(),
    };
});
// A role change re-renders the workspace for its new permissions. Players saving
// their own recipes also update their user, which must not close their Studio.
Hooks.on("updateUser", (user, changes) => {
  // A player saved their recipes: the GM's review list shows the new version.
  if (game.user.isGM && user.id !== game.user.id && changes?.flags?.[ID]) app?.workspace?.render();
  if (user.id === game.user.id && "role" in (changes ?? {})) {
    void app?.close();
    ui.controls?.render();
  }
});

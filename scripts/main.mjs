import { frameSettings } from './core/frame-settings.mjs';
import { uuid } from "./core/uuid.mjs";
import * as npcAbilities from './catalogs/pf2e/npc-abilities.mjs';
import * as sfNpcAbilities from './catalogs/sf2e/sf2e-npc-actions.mjs';
import * as dndNpcAbilities from './catalogs/dnd5e/dnd5e-npc-actions.mjs';
import {createCreatureShowcaseTools} from './integrations/creature-showcase.mjs';
import { setHidePrivateResults } from "./core/privacy.mjs";
import { ID, validateRecipe, clone, matchRecipe, resolveAsset, FINISHER_ENDINGS } from "./core/model.mjs";
import { registerFlashSettings, flashScreens } from "./engines/flash/flash-combat.mjs";
import { damageFromMessage, damageFromParts, recallDamage, recallAttribution, hitRecipe, deathRecipe } from "./engines/playback/damage-moments.mjs";
import { displaceAllowed, landingSpot, wallDistance, withinKnockback } from "./engines/motion/displacement.mjs";
import { hpPath, hpState, hpChange, isNpcActor, displaceHp } from "./systems/hp-state.mjs";
import { matchFinishers, killFinisher, critFinishers, usePasses, finisherMoment, checkFinisherEvent, mayDisplace, pickedFinisher, playerFinisherChoices, pickPlays, createFinishedMemory, finishedKey, finishedMessage, FINISHED_MESSAGE, critTargets, targetPassed, saveFinisherEvent } from "./engines/finishers/finisher-model.mjs";
import { playFinisher, previewFinisher } from "./engines/finishers/finisher-play.mjs";
import { STRIKE_FLAG, strikeKey, strikeOf, strikePick, picksOnActor } from "./engines/finishers/strike-finishers.mjs";
import { createFragmentRenderer } from "./engines/fragments/fragment-render.mjs";
import { createAfterimages, placeUnder } from "./engines/motion/afterimage-render.mjs";
import { streakLayout } from "./engines/motion/afterimages.mjs";
import { FLOOR_CHOICES, sceneFloor, floorAt, movementDensity, footstepFile, gaitStep, gaitStepFiles, bodyStep, bodyStepFiles, footstepVolume, footstepVariation, stepWeight, createStepPacer, thudFile, thudLevel, audioPeakMs, thudDelayMs, THUD_FILES, FOOTSTEP_FILES, MOVE_SOUND_FILES, moveSoundFile, moveSoundGap, moveSoundShape, createMovementFeel, perceive, footstepReach, FOOTSTEP_RANGES, rainFloor, RAIN_SPLASH_GAIN } from "./engines/motion/movement-feel.mjs";
import { createMovementFeelLayer } from "./engines/motion/movement-feel-render.mjs";
import { createBurrowSink, poseMesh, drawnBeforeSink } from "./engines/motion/burrow-sink.mjs";
import {underwaterPose,underwaterTint} from './engines/motion/underwater-appearance.mjs';
import { creatureGait, creatureBulk, creatureBody, creatureFlight } from "./engines/motion/creature-gait.mjs";
import { movementSoundMix, movementContactWeight, resolveMovementSound, createMovementPreview } from "./engines/motion/movement-profile.mjs";
import { movementSoundsForm, mountMovementSounds } from "./ui/movement-sounds-config.mjs";
import { movementSound, movementEnvironment } from "./engines/motion/movement-feel.mjs";
import { createGroundTrails, bloodColor, sceneWeather, isCold } from "./engines/motion/ground-trails.mjs";
import { BLOOD_TYPES, tableBlood, creatureBloodType, creatureHasHeart } from "./engines/motion/blood-colors.mjs";
import { bloodColorsMenu, BLOOD_SETTING } from "./ui/blood-colors-settings.mjs";
import { createBreathVapor, VAPOR_CAP, vaporArt } from "./engines/motion/breath-vapor.mjs";
import { starterRecipes, planRecipeImport } from "./core/presets.mjs";
import { pf2eEvent, sf2eEvent, dnd5eEvent, twoeEvent, eventTargets, midiRunsActivity } from "./systems/adapters.mjs";
import { usedItemDamages, usedItemElement } from "./systems/item-damages.mjs";
import { heavyItem } from "./systems/heavy-item.mjs";
import { daggerheartRollEvent, daggerheartUseEvent, daggerheartDamageEvent, dualityAccent, versionBelow as daggerheartVersionBelow, DAGGERHEART_VERIFIED } from "./systems/daggerheart.mjs";
import { dhStateHost, dhDefeatedStates, DH_DEFEATED_STATUSES, findDhState } from "./catalogs/daggerheart/daggerheart-states.mjs";
import { applyEventElement } from "./catalogs/shared/element-choice.mjs";
import { AA_ID, AA_TAKEOVER, AA_FILL_GAPS, aaCustomized, aaAnimates, registerAATakeover } from "./integrations/automated-animations.mjs";
import { TA_ID, TA_FILL_GAPS, TA_TAKEOVER, taAnimates, registerTATakeover } from "./integrations/trigger-animations.mjs";
import { SPLATTER_ID, SPLATTER_SYNC, splatterReady, splatterOn, splatScale, tokenSize } from "./integrations/splatter.mjs";
import { MOTION_PRIORITY, guardSequencerMotions } from "./integrations/sequencer-motions.mjs";
import { registerSequencerSpeedups, sequencerSpeedupsApi, turboState } from "./integrations/sequencer-turbo/index.mjs";
import { createAdaptiveHost } from "./engines/playback/adaptive-host.mjs";
import { createLightHost } from "./engines/lighting/light-host.mjs";
import { createDistortionHost, canDistort, attachFilter, detachFilter } from "./engines/distortion/distortion-host.mjs";
import { createCameraShake, canShake } from "./engines/camera/camera-shake.mjs";
import { createKillCam, canKillCam, killCamLength } from "./engines/camera/kill-cam.mjs";
import { lensSplashFor, lingerLevel, lensAmount, woundOf, lensWho, lensRoleWanted, LENS_BLOOD, LENS_BASE_SECONDS } from "./engines/camera/lens-blood.mjs";
import { createLensBloodOverlay } from "./engines/camera/lens-blood-draw.mjs";
import { lensEffectHit, lensEffectTypes } from "./engines/camera/lens-effects.mjs";
import { lifeOf, isDown, woundedView, woundedWanted, muffleFor, heartbeatDown, nextBeatMs, heartbeatDeath, transitionSteps, stainsAfterHit, settleStains, stainCap, downLook, downPreviews, WAKE } from "./engines/camera/lens-wounds.mjs";
import { createWorldMuffle } from "./engines/sound/world-muffle.mjs";
import { heartbeatPlan, heartbeatLinger, heartbeatWanted, playHeartbeat } from "./engines/sound/heartbeat.mjs";
import { creatureBlood } from "./integrations/splatter.mjs";
import { sceneWarpFilter } from "./engines/tokenshade/filters/scene-warp.mjs";
import { createSummonsLights } from "./integrations/summons-walls.mjs";
import { createReactionHost } from "./engines/marks/reactions.mjs";
import { reactionVisual } from "./engines/marks/reaction-fx.mjs";
import { twoeCounteract, dnd5eDispelSpell, createDnd5eDispels, createDispelWindow, createFlickerHost, dispelMessage, receiveDispel as receiveDispelData, lastingAnimaterEffect, effectTokenIds, idsOfTokens, spotHolds } from "./engines/playback/dispel.mjs";
import { shatterVisual, createShatterHost, shatterSeed, spotFromBounds } from "./engines/playback/shatter-fx.mjs";
import { areaMaskFor, createMarkLayer, markSprite, markTextures } from "./engines/marks/mark-paint.mjs";
import { clearGroundMarks, receiveClearMarks } from "./engines/marks/clear-marks.mjs";
import { markTiming } from "./engines/marks/ground-marks.mjs";
import { registerSpellArsenal } from "./integrations/spell-arsenal.mjs";
import { wrapRulerHighlight } from "./integrations/walked-path.mjs";
import { registerTriggerEngine } from "./integrations/trigger-engine.mjs";
import { AnimaterRuntime, sameEffectName } from "./engines/playback/runtime.mjs";
import { wallHit } from "./engines/playback/flight-path.mjs";
import { nowPlayingRows } from "./ui/activity-actions.mjs";
import { createHoverExplain, tokenRows, hoverView, hoverExplainDefault } from "./ui/hover-explain.mjs";
import { installedSoundCatalog, catalogSoundOptions } from "./engines/sound/spell-sounds.mjs";
import { targetSurface, withSurfaceSounds, blowOfItem, sizeOf, heftOfItem } from "./engines/sound/surface-sounds.mjs";
import { weaponFamily } from "./systems/daggerheart.mjs";
import { installSoundPitch, muffleEar } from "./engines/sound/sound-pitch.mjs";
import { isSneaking, sneakStep, darker } from "./engines/motion/quiet-steps.mjs";
import { libraryBank, mergeBanks } from "./engines/sound/voice-library.mjs";
import { CREATURE_VOICES } from "../data/creature-voices.mjs";
import { LIBRARY_VOICES, LIBRARY_FOLDERS } from "../data/library-voices.mjs";
import { attackSpeaker, tokenVoice, creatureOf, voiceOf, voiceEvent, voiceFile, voiceShape, voiceDeferred, ownsVoice, voiceBorrows, voiceGroups, familyGroups, voiceLineage, VOICE_FAMILIES, VOICE_COOLDOWN_MS } from "./engines/sound/creature-voice.mjs";
import { voicesThisTurn, parseCreatureSoundDb, pickSoundSet, idleSoundFile, idleShape, IDLE_FROM_WEIGHT } from "./engines/sound/creature-idle.mjs";
import { createRoomCache, roomFor, reverbSend } from "./engines/sound/room-acoustics.mjs";
import { createReverbBuses } from "./engines/sound/reverb-bus.mjs";
import { hitSoundsMenu } from "./ui/hit-sounds-settings.mjs";
import { settingsWindow, WINDOW_SETTING_KEYS } from "./ui/settings-window.mjs";
import { peakOf } from "./engines/sound/hit-timing.mjs";
const soundPeaks = new Map();
const hotSettings = frameSettings({
  get: key => game.settings.get(ID, key),
  frame: () => globalThis.canvas?.app?.ticker?.lastTime ?? performance.now(),
});
const hotSetting = key => hotSettings.get(key);
// Invalidate before our own onChange callbacks (not only after Foundry's
// update hook): quality routing and other synchronous readers need the new value.
const registerSetting = (key, config) => game.settings.register(ID, key, {
  ...config,
  onChange: (...args) => {
    if (args.length) hotSettings.changed(key, args[0]); else hotSettings.invalidate();
    movementViews.clear();
    sinkDirty = true;
    return config.onChange?.(...args);
  },
});
for (const hook of ['clientSettingChanged', 'updateSetting', 'canvasReady', 'canvasTearDown'])
  Hooks.on(hook, () => hotSettings.invalidate());

import { JB2A_MISSING } from "./ui/environment-message.mjs";
import { mediaIndexStore } from "./engines/media/media-index-store.mjs";
import { MediaLibraryLoader } from './engines/media/media-library-sources.mjs';
import { libraryPreferences } from './ui/media-library.mjs';
import {TokenFxPreview} from './engines/preview/token-fx-preview.mjs';
import {tokenFx} from './engines/tokenshade/api.mjs';
import {warmShaders,buildSceneWarpNow} from './engines/tokenshade/warmup.mjs';
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
import { teleportPlan, teleportVisuals, playTeleport, itemRangeFeet, pickTeleportSpot, streakToken, holdHidden, previewSpot } from "./engines/motion/teleport.mjs";
import { fetchLandings } from "./engines/motion/fetch-path.mjs";
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
import { IdleLife, breathes, idleKind, pickIdle } from "./engines/motion/idle-life.mjs";
import { WoundedLooks, tokenMoving, woundTier } from "./engines/playback/wounded-looks.mjs";
import { builtinPreset } from "./engines/tokenshade/presets.mjs";
let conditionBody;
let idleLife;
let woundedLooks;
const localQuality=()=>{try{return hotSetting('quality');}catch{return 'full';}};
// Mirror this client's choice so the client that starts an animation can route optional layers.
const syncQuality=()=>{const value=localQuality(),user=game.user;if(typeof user?.getFlag==='function'&&typeof user.setFlag==='function'&&user.getFlag('animater','quality')!==value)void Promise.resolve(user.setFlag('animater','quality',value)).catch(()=>{});};
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
let runtime, app, showcaseTools;
registerTriggerEngine();
const mediaLibraryLoader=new MediaLibraryLoader(()=>({modules:game.modules,database:globalThis.Sequencer?.Database,
  folderSources:libraryPreferences(hotSetting('mediaLibrary')).sources,
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
// Whether effect lights reveal the creatures they light, for PF2e Visioner (a homebrew option): each light says so
// in `revealsCreatures`, and Visioner's auto-visibility skips the ones that reveal nothing.
const LIGHT_REVEALS = "effectLightsReveal";
const lightReveals = () => { try { return hotSetting(LIGHT_REVEALS) === true; } catch { return false; } };
// Effect lights on this client (engines/lighting/light-host.mjs): local Foundry light sources, never documents.
const lightHost = createLightHost({
  makeSource: (id) => {
    const source = new CONFIG.Canvas.lightSourceClass({ sourceId: `${ID}.light.${id}`, object: null });
    // Whether this light lets anyone see the creatures it lights (the homebrew setting); PF2e Visioner reads it too.
    Object.defineProperty(source, "revealsCreatures", { get: lightReveals, configurable: true });
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
  steady: () => { try { return hotSetting("effectLightAnimation") === false; } catch { return false; } },
  gridSize: () => canvas?.grid?.size ?? 100,
  now: () => performance.now(),
});
// "Effect lighting on my screen": off, this client draws no effect lights (the effects still carry them for others).
const lightsHere = () => { try { return hotSetting("effectLightingLocal") !== false; } catch { return true; } };
// Map distortion on this client (engines/distortion/distortion-host.mjs): one screen filter on the primary group,
// after Foundry's own, only while something distorts. Full quality only, unless this client turned it off.
const distortsHere = () => {
  let local = true;
  try { local = hotSetting("mapDistortionLocal"); } catch { /* not registered yet */ }
  return canDistort(localQuality(), local);
};
// Builds or warms the shaders this client now needs (set once the canvas is up, in "ready"); the quality and
// "Map distortion on my screen" settings call it when they change.
let rewarmShaders = () => {};
const distortionHost = createDistortionHost({
  makeFilter: () => {
    const renderer = canvas.app.renderer, gl = renderer.gl, filter = sceneWarpFilter(globalThis.PIXI);
    // Built now (warm-up has usually done it): a shader this GPU cannot compile turns distortion off instead.
    const built = filter.program.glPrograms[renderer.CONTEXT_UID] ?? renderer.shader.generateProgram(filter);
    if (!gl.getProgramParameter(built.program, gl.LINK_STATUS)) {
      filter.destroy();
      throw new Error("the scene filter's shader did not compile");
    }
    return filter;
  },
  attach: (filter) => attachFilter(canvas.primary, filter, canvas.app.renderer.screen),
  detach: (filter) => detachFilter(canvas?.primary, filter),
  allowed: distortsHere,
  tight: () => adaptiveHost.tight(),
  sceneId: () => canvas?.scene?.id,
  // The stage maps world to screen pixels (no rotation); the view is the screen's world rectangle. This tick runs
  // before the render updates transforms, so this frame's pan and zoom are read from the stage's own transform
  // (the stage is the root: local is world).
  view: () => {
    const t = canvas.stage.transform, screen = canvas.app.renderer.screen;
    t.updateLocalTransform();
    const wt = t.localTransform;
    return { x: -wt.tx / wt.a, y: -wt.ty / wt.d, w: screen.width / wt.a, h: screen.height / wt.d, zoom: Math.hypot(wt.a, wt.b) || 1, worldToScreen: wt };
  },
  now: () => performance.now(),
  // The level this client views, as ground marks use; and whether it can see any of an area (its centre and
  // points around it), as Foundry tests a point.
  viewedLevel: () => canvas?.level?.id ?? null,
  seen: (point, radius) => {
    try {
      const v = canvas?.visibility;
      if (!v?.tokenVision) return true;
      const r = radius / Math.SQRT2;
      return v.testVisibility({ x: point.x, y: point.y }, { tolerance: Math.max(2, r) });
    } catch { return true; }
  },
});
// Camera shake on this client (engines/camera/camera-shake.mjs): big blasts' shock tags jolt the stage's position
// (Foundry pans by its pivot) for a moment. World and client settings, Full or Light quality only.
const shakeSetting = (key, fallback) => { try { return hotSetting(key); } catch { return fallback; } };
const cameraShake = createCameraShake({
  getPosition: () => canvas.stage.position,
  setPosition: (x, y) => canvas.stage.position.set(x, y),
  // The screen's world rectangle, read from the stage's own transform (pan and zoom; no rotation).
  view: () => {
    const t = canvas.stage.transform, screen = canvas.app.renderer.screen;
    t.updateLocalTransform();
    const wt = t.localTransform;
    return { x: -wt.tx / wt.a, y: -wt.ty / wt.d, w: screen.width / wt.a, h: screen.height / wt.d };
  },
  gridPx: () => canvas?.grid?.size ?? 100,
  now: () => performance.now(),
  enabled: () => shakeSetting("cameraShake", true) !== false && canShake(localQuality(), shakeSetting("cameraShakeLocal", true)),
  strength: () => Number(shakeSetting("cameraShakeStrength", 1)) || 1,
  sceneId: () => canvas?.scene?.id,
  viewedLevel: () => canvas?.level?.id ?? null,
  // A blast this client cannot see any of does not shake it.
  seen: (point, radius) => {
    try {
      const v = canvas?.visibility;
      if (!v?.tokenVision) return true;
      return v.testVisibility({ x: point.x, y: point.y }, { tolerance: Math.max(2, radius / Math.SQRT2) });
    } catch { return true; }
  },
});
// Slow-motion kill-cam on this client (engines/camera/kill-cam.mjs): an NPC's killing blow eases the view to it, slows
// Animater's effects on it and shows a soft desaturated vignette, then pans back. World and client settings, Full or Light.
const killCamOn = () => shakeSetting("killCam", false) === true;
// The kill finisher playing on each actor (by uuid) on this client, until it ends.
const killsPlaying = new Map();
// How long the finisher, Finish Him! and a kill's blood wait for it: the table uses it, the creature is an NPC and has
// a token in view that is not hidden (the client that saw the drop plays it).
const killCamWait = (actor) => killCamLength({
  worldOn: killCamOn() && acceptsEvents(),
  npc: isNpcActor(actor, game.system.id, { playerOwned: ownerUsers(actor).length > 0 })
    && (actor?.getActiveTokens?.() ?? []).some((t) => t.document?.parent?.id === canvas?.scene?.id && !t.document.hidden),
});
const killCamVignette = (() => {
  let el = null;
  const node = () => {
    if (el?.isConnected) return el;
    el = document.createElement("div");
    el.id = "animater-kill-cam";
    el.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity 200ms ease;"
      + "background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);"
      + "backdrop-filter:saturate(0.4);-webkit-backdrop-filter:saturate(0.4);";
    // Right over the canvas, under Foundry's interface.
    const board = document.getElementById("board");
    if (board) board.after(el); else document.body.append(el);
    return el;
  };
  return {
    show: (ms) => { const n = node(); n.style.transitionDuration = `${ms}ms`; void n.offsetWidth; n.style.opacity = "1"; },
    hide: (ms) => { if (!el) return; el.style.transitionDuration = `${ms}ms`; el.style.opacity = "0"; },
  };
})();
const killCam = createKillCam({
  // A token on the viewed scene that this screen sees, with both settings on and Full or Light quality.
  target: (tokenId, sceneId) => {
    const token = canvas?.ready ? canvas.tokens?.get(tokenId) : null;
    if (!token || !canKillCam({ worldOn: killCamOn(), localOn: shakeSetting("killCamLocal", true), quality: localQuality(),
      sameScene: sceneId === canvas.scene?.id, visible: token.visible === true, hidden: token.document?.hidden === true })) return null;
    return { center: token.center, uuid: token.document.uuid, radius: Math.max(token.w ?? 0, token.h ?? 0) };
  },
  view: () => ({ x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x }),
  maxZoom: () => canvas.dimensions?.scale?.max ?? CONFIG.Canvas?.maxZoom,
  pan: (to) => void Promise.resolve(canvas.animatePan(to)).catch(() => {}),
  dragging: () => canvas?.mouseInteractionManager?.isDragging === true,
  effects: () => globalThis.Sequencer?.EffectManager?.effects ?? [],
  vignette: killCamVignette,
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (h) => clearTimeout(h),
  trace: (status, detail) => runtime?.trace(status, detail),
});
// Another screen saw an NPC's killing blow.
const receiveKillCam = (data, senderId) => {
  if (data?.type !== "kill-cam" || (senderId && data.userId !== senderId)) return;
  killCam.play({ tokenId: data.tokenId, sceneId: data.sceneId, ms: Number(data.ms) });
};
// Blood on the camera lens and tunnel vision (engines/camera/lens-blood.mjs), on players' screens only; wired to HP
// changes in the ready hook (see "Blood on the lens" there). The heartbeat under the tunnel (engines/sound/heartbeat.mjs).
const lensBlood = createLensBloodOverlay();
let stopHeartbeat = null, heartbeatUntil = 0, lingerTimer = null;
// The Damage immersion showcase's player (set in the ready hook): hit, deal, linger, snapshot, stop.
let lensPreview = null;
// The wounded view's muffle on music and ambience (engines/sound/world-muffle.mjs), and its state's reset (set in the
// ready hook): both always put back with the lens.
const worldMuffle = createWorldMuffle({ contexts: () => [game.audio?.music, game.audio?.environment] });
let woundReset = null, woundRefresh = null;
const stopLensBlood = () => {
  try { woundReset?.(); } catch { /* nothing kept */ }
  worldMuffle.restore();
  lensBlood.clear();
  if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  try { stopHeartbeat?.(); } catch { /* gone */ }
  stopHeartbeat = null;
};
Hooks.on("canvasTearDown", stopLensBlood);
// PF2e Summons Assistant's glowing walls and summons (integrations/summons-walls.mjs): lit on every client
// from their own effect or token data, on the same light host. Only its creatures' tokens qualify.
const finitePoint = (p) => (Number.isFinite(p?.x) && Number.isFinite(p?.y) ? { x: p.x, y: p.y } : null);
const summonsLights = createSummonsLights({
  host: lightHost,
  enabled: () => hotSetting("effectLighting") !== false && lightsHere()
    && (hotSetting("effectLightingDaylight") !== false || (canvas?.environment?.darknessLevel ?? 0) > 0),
  grid: () => canvas?.grid?.size ?? 100,
  // The token an effect is tied to (or drawn on), on the viewed scene; a stretched line's two ends.
  describeEffect: (effect) => {
    const data = effect?.data, scene = canvas?.scene;
    if (!data || !scene || data.sceneId !== scene.id) return null;
    const uuid = [...(data.tiedDocuments ?? []), data.source?.uuid ?? data.source].find((u) => typeof u === "string" && u.includes(".Token."));
    const doc = uuid ? fromUuidSync(uuid) : null;
    if (!doc || doc.parent?.id !== scene.id) return null;
    const line = !!data.stretchTo;
    const end = (raw, live) => finitePoint(raw) ?? (() => { try { return finitePoint(live()); } catch { return null; } })();
    return {
      data, tokenId: doc.id, actor: doc.actor, hidden: doc.hidden, elevation: doc.elevation,
      from: line ? end(data.source, () => effect.sourcePosition) : null,
      to: line ? end(data.target, () => effect.targetPosition) : null,
      sizePx: Math.max(effect.sprite?.width ?? 0, effect.sprite?.height ?? 0),
    };
  },
  describeToken: (doc) => {
    const grid = canvas?.grid?.size ?? 100;
    return {
      id: doc.id, actor: doc.actor, hidden: doc.hidden, src: doc.texture?.src, elevation: doc.elevation,
      widthPx: (doc.width ?? 1) * grid, heightPx: (doc.height ?? 1) * grid,
      scale: Math.max(Math.abs(doc.texture?.scaleX ?? 1), Math.abs(doc.texture?.scaleY ?? 1)),
    };
  },
  // The drawn token's centre (it follows the token while it slides), else its document's.
  centerOf: (doc) => {
    const grid = canvas?.grid?.size ?? 100;
    const object = doc.object;
    return object && !object.destroyed ? object.center
      : { x: doc.x + (doc.width ?? 1) * grid / 2, y: doc.y + (doc.height ?? 1) * grid / 2 };
  },
});
Hooks.on("createToken", (doc) => { if (doc.parent?.id === canvas?.scene?.id) summonsLights.onToken(doc); });
Hooks.on("updateToken", (doc, changes) => { if (doc.parent?.id === canvas?.scene?.id) summonsLights.onTokenUpdate(doc, changes); });
Hooks.on("deleteToken", (doc) => summonsLights.onTokenDelete(doc));
// Ground marks on this client (engines/marks/mark-paint.mjs): local sprites on the floor, never documents. One
// container per scene in the primary group at the viewed level's floor, between drawings (600) and tokens (700).
// Viewing another level redraws the whole canvas (Scene#view -> Canvas#draw), so its tear-down clears them too.
let markTex = null, markRoot = null, reactRoot = null;
const clearMarks = () => {
  markReactions.clear();
  try { reactRoot?.destroy({ children: true }); } catch { /* canvas gone */ }
  reactRoot = null;
  markLayer.clear();
  try { markRoot?.destroy({ children: true }); } catch { /* canvas gone */ }
  markRoot = null;
};
// Clear on demand (api.clearGroundMarks, the GM keybinding): a GM clears every screen, a player their own.
const clearGroundMarksApi = (options) => clearGroundMarks(options, {
  isGM: () => game.user.isGM, clear: clearMarks, emit: (data) => game.socket.emit(`module.${ID}`, data), sender: clientId, userId: game.user.id,
});
const receiveMarksClear = (data, senderId) => receiveClearMarks(data, senderId, { clear: clearMarks, isGMUser: (id) => game.users.get(id)?.isGM === true });
const markLayer = createMarkLayer({
  makeSprite: (tag, blotches, mask) => markSprite(PIXI, markTex ??= markTextures(PIXI, canvas.app.renderer), tag, blotches, mask),
  addToScene: (sprite) => {
    if (!markRoot || markRoot.destroyed) {
      markRoot = new PIXI.Container();
      markRoot.eventMode = "none";
      markRoot.elevation = canvas.level?.elevation?.base ?? 0;
      markRoot.sortLayer = 650;
      canvas.primary.addChild(markRoot);
    }
    markRoot.addChild(sprite);
  },
  removeFromScene: (sprite) => sprite.destroy({ children: true }),
  viewedLevel: () => canvas?.level?.id ?? null,
  sceneId: () => canvas?.scene?.id,
  gridSize: () => canvas?.grid?.size ?? 100,
  now: () => performance.now(),
  // Off draws none; Low keeps half as many.
  enabled: () => hotSetting("groundMarksLocal") !== false && qualityRank(localQuality()) > 0,
  cap: () => (localQuality() === "low" ? 30 : 60),
  timing: () => markTiming(hotSetting("groundMarkMinutes")),
  // An area clips to its placed Region (v14 templates are Regions), found by the id on its tag.
  mask: (tag) => areaMaskFor(tag, { regions: canvas?.scene?.regions, grid: canvas?.grid?.size ?? 100, polygonsOf: areaMask }),
  onLand: (record) => markReactions.onLand(record),
});
// Element reactions (engines/marks/reactions.mjs): a new mark landing on an older one can react (fire on frost puffs
// steam and melts it). Each client works it out from the marks it holds; the visuals sit just above the tokens.
const markReactions = createReactionHost({
  near: (point, radius) => markLayer.near(point, radius),
  remove: (record) => markLayer.remove(record),
  spawn: (reaction) => {
    if (!canvas?.primary) return null;
    if (!reactRoot || reactRoot.destroyed) {
      reactRoot = new PIXI.Container();
      reactRoot.eventMode = "none";
      reactRoot.elevation = canvas.level?.elevation?.base ?? 0;
      reactRoot.sortLayer = 800;
      canvas.primary.addChild(reactRoot);
    }
    const fx = reactionVisual(PIXI, reaction, performance.now());
    reactRoot.addChild(fx.display);
    return fx;
  },
  enabled: () => hotSetting("elementReactions") !== false && hotSetting("elementReactionsLocal") !== false
    && hotSetting("groundMarksLocal") !== false && qualityRank(localQuality()) > 0,
  now: () => performance.now(),
  gridSize: () => canvas?.grid?.size ?? 100,
  // Arcs reach only the tokens this viewer can see.
  tokensOn: (point, radius) => (canvas?.tokens?.placeables ?? [])
    .filter((t) => t?.center && !t.document?.hidden && t.visible !== false && Math.hypot(t.center.x - point.x, t.center.y - point.y) <= radius + (t.w ?? 0) / 2)
    .map((t) => ({ x: t.center.x, y: t.center.y })),
});
// Light, Balanced and Low draw Animater's effects without blur or glow, on this client only (core/quality.mjs).
Hooks.on("createSequencerEffect", (effect) => {
  lightenEffect(effect?.data, localQuality()); adaptiveHost.onEffect(effect); if (lightsHere()) lightHost.onEffect(effect); markLayer.onEffect(effect);
  summonsLights.onEffect(effect); distortionHost.onEffect(effect); cameraShake.onEffect(effect);
});
Hooks.on("endedSequencerEffect", (effect) => {
  lightHost.onEnded(effect); summonsLights.onEffectEnded(effect); markLayer.onEnded(effect); distortionHost.onEnded(effect);
});
// The effect lights here go out at once, or the summons' glows come back (effects already playing stay unlit).
const effectLightsHere = (on) => {
  if (on === false) { summonsLights.clear(); lightHost.clear(); }
  else for (const doc of canvas?.scene?.tokens ?? []) summonsLights.onToken(doc);
  canvas?.perception?.update({ refreshLighting: true, refreshVision: true });
};
Hooks.on("canvasTearDown", () => { summonsLights.clear(); lightHost.clear(); clearMarks(); distortionHost.clear(); cameraShake.clear(); killCam.clear(); });
// Movement feel on this client (engines/motion/movement-feel.mjs): each floor's own marks at a moving token's feet,
// a drop shadow under a flier. Every move from any source is read from the drawn token each frame (v14 writes the
// animated x/y into the TokenDocument while it animates), so drags, ruler moves and macros all show. Animater's own
// teleports and motions already leave afterimages and are skipped. Local sprites on the viewed level's floor, under
// the tokens, like the ground marks.
let feelRoot = null, feelTicker = null;
const feelSkip = new Map();
// Each creature's tracks (engines/motion/creature-gait.mjs), worked out once per actor and token name and forgotten
// when an actor or a token's name or actor changes.
const feelGaits = new Map();
const movementFeelGait = (d) => {
  const key = `${d.actorId ?? ""}|${d.name ?? ""}`;
  let gait = feelGaits.get(key);
  if (gait === undefined) {
    try { gait = creatureGait({ system: game.system.id, actor: d.actor, name: d.name }); } catch { gait = "unknown"; }
    feelGaits.set(key, gait);
  }
  return gait;
};
const movementFeelFlight = (d) => {
  const key = `flight|${d.actorId ?? ""}|${d.name ?? ""}`;
  if (!feelGaits.has(key)) {
    let flight = 'flight';
    try { flight = creatureFlight({ system: game.system.id, actor: d.actor, name: d.name }); } catch { /* unknown anatomy */ }
    feelGaits.set(key, flight);
  }
  return feelGaits.get(key);
};
// What this screen may see and hear of each moving token (engines/motion/movement-feel.mjs perceive): a GM-hidden
// token nothing; for a player, PF2e Visioner's state from each of their own tokens on the scene (undetected or
// unnoticed: silent and unseen; hidden: heard only), else the creature's conditions and whether it is drawn here.
// Visioner's answers are kept for a quarter second per token.
const AWARE_MS = 250;
const awareness = new Map(), conditionCache = new Map();
const visionerStates = (target) => {
  const api = game.modules.get("pf2e-visioner")?.active ? game.modules.get("pf2e-visioner").api : null;
  if (!api?.getVisibility) return [];
  const cached = awareness.get(target.id), time = performance.now();
  if (cached && time - cached.at < AWARE_MS) return cached.states;
  const mine = canvas.tokens?.controlled?.length ? canvas.tokens.controlled : (canvas.tokens?.placeables ?? []).filter((o) => o.isOwner && o.actor);
  const states = [];
  for (const observer of mine) {
    if (observer === target) continue;
    try { const s = api.getVisibility(observer.document.id, target.document.id); if (typeof s === "string") states.push(s); } catch { /* skip */ }
  }
  awareness.set(target.id, { at: time, states });
  return states;
};
// Tokens a burrow sink hid on this screen (see "Burrowed creatures sink out of sight" below), each with whether
// Foundry itself drew it: perception goes by that, so a creature this screen could see still churns and digs audibly.
const sunkHidden = new Map();
const movementPerception = (t, d, level) => {
  const onLevel = level === undefined || d.level === undefined || d.level === level;
  if (!onLevel || t.isPreview) return { visible: false, audible: false };
  // A GM may perceive as their selected token does ("GM perceives movement"); with nothing selected, everything.
  let gm = game.user.isGM;
  if (gm && canvas.tokens?.controlled?.length) { try { gm = hotSetting("movementGmPerception") !== "token"; } catch { /* everything */ } }
  // A player's own creature (or the GM's selected one) is always perceived.
  if (!gm && (game.user.isGM ? t.controlled : t.isOwner)) return { visible: drawnBeforeSink(t, sunkHidden) && !d.hidden, audible: !d.hidden };
  // Stealth off: what is drawn on this screen is what it perceives (GM-hidden tokens still give nothing away).
  let stealth = true;
  try { stealth = hotSetting("movementStealth") !== false; } catch { /* on */ }
  if (!stealth && !gm) { const shown = drawnBeforeSink(t, sunkHidden) && !d.hidden; return { visible: shown, audible: shown }; }
  const time = performance.now(), cached = conditionCache.get(d.id);
  let conditions = cached && time - cached.at < AWARE_MS ? cached.conditions : null;
  if (!conditions) {
    conditions = [...Array.from(d.actor?.statuses ?? []), ...(d.actor?.itemTypes?.condition?.map((c) => c.slug) ?? [])];
    conditionCache.set(d.id, { at: time, conditions });
  }
  const { see, hear } = perceive({ isGM: gm, docHidden: d.hidden === true, tokenVisible: drawnBeforeSink(t, sunkHidden),
    states: gm ? [] : visionerStates(t), conditions });
  return { visible: see, audible: hear };
};
Hooks.on("canvasTearDown", () => { awareness.clear(); conditionCache.clear(); });
// Selecting another token changes whose eyes and ears this screen uses: judge again at once.
Hooks.on("controlToken", () => awareness.clear());
// Whether a token moves stealthily (engines/motion/quiet-steps.mjs isSneaking; world setting "Sneaking is quiet"):
// PF2e/SF2e's Avoid Notice exploration activity or a Sneak/Avoid Notice effect, PF2e Visioner's 'sneak-active' token
// flag, D&D 5e's Hiding status. Read for a second at a time per token.
const sneakCache = new Map();
const movementSneaking = (id) => {
  try { if (hotSetting("quietSneaking") === false) return false; } catch { return false; }
  const time = performance.now(), cached = sneakCache.get(id);
  if (cached && time - cached.at < 1000) return cached.on;
  let on = false;
  try {
    const t = canvas.tokens?.get?.(id), d = t?.document, actor = d?.actor;
    const slugs = [...(actor?.itemTypes?.effect ?? []), ...(actor?.itemTypes?.condition ?? [])].map((i) => i?.slug).filter(Boolean);
    const chosen = Array.isArray(actor?.system?.exploration) ? actor.system.exploration : [];
    const exploration = chosen.map((itemId) => actor.items?.get?.(itemId)?.slug).filter(Boolean);
    on = isSneaking({ system: game.system.id, statuses: actor?.statuses, slugs, exploration,
      visionerSneak: !!d?.flags?.["pf2e-visioner"]?.["sneak-active"], inCombat: d?.inCombat === true });
  } catch { on = false; }
  sneakCache.set(id, { at: time, on });
  return on;
};
Hooks.on("canvasTearDown", () => sneakCache.clear());
// Each token's footstep beat (engines/motion/movement-feel.mjs createStepPacer).
const stepPacer = createStepPacer();
// How late (ms) a step, wing beat or thud may start after it was due before it is dropped instead.
const LATE_BEAT_MS = 150;
// How heavy its steps are (size category, a heavy body), cached the same way.
const movementFeelBulk = (d) => {
  const key = `bulk|${d.actorId ?? ""}|${d.name ?? ""}`;
  let bulk = feelGaits.get(key);
  if (bulk === undefined) {
    try { bulk = creatureBulk({ system: game.system.id, actor: d.actor, name: d.name }); } catch { bulk = { size: undefined, heavy: false }; }
    feelGaits.set(key, bulk);
  }
  return bulk;
};
// What its body adds to each stride (a skeleton's rattle, a golem's clank, a fire elemental's flame), cached the same way.
const movementFeelBody = (d) => {
  const key = `body|${d.actorId ?? ""}|${d.name ?? ""}`;
  let body = feelGaits.get(key);
  if (body === undefined) {
    try { body = creatureBody({ system: game.system.id, actor: d.actor, name: d.name }); } catch { body = null; }
    feelGaits.set(key, body);
  }
  return body;
};
Hooks.on("updateActor", () => feelGaits.clear());
// An ancestry, a race or an Incorporeal Movement feature can change the feet.
for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item) => { if (item?.parent?.documentName === "Actor") feelGaits.clear(); });
Hooks.on("updateToken", (doc, changes) => { if ("name" in changes || "actorId" in changes || "delta" in changes) feelGaits.clear(); });
// A token's own blood colour (Animater's or Splatter's flag) changes only its blood.
Hooks.on("updateToken", (doc, changes) => { if (changes?.flags?.[ID]?.bloodColor !== undefined || changes?.flags?.splatter !== undefined || Object.keys(changes?.flags ?? {}).some((k) => k.startsWith("-="))) feelGaits.delete(`blood|${doc.id}`); });
const movementFeelRoot = () => {
  if (!feelRoot || feelRoot.destroyed) {
    feelRoot = new PIXI.Container();
    feelRoot.eventMode = "none";
    feelRoot.elevation = canvas.level?.elevation?.base ?? 0;
    feelRoot.sortLayer = 650;
    canvas.primary.addChild(feelRoot);
  }
  return feelRoot;
};
const movementFeelSettingOn = (key) => { try { return hotSetting(key) !== false; } catch { return false; } };
const movementFeelFloor = (point, token) => {
  const scene = canvas?.scene;
  const base = sceneFloor({
    flag: scene?.flags?.[ID]?.floor, globalLight: scene?.environment?.globalLight?.enabled === true, name: scene?.name,
    // v14 keeps the backdrop on the level (Scene#background is deprecated and warns).
    background: canvas.level?.background?.src ?? "",
  });
  const regions = Array.from(scene?.regions ?? [], (doc) => ({ name: doc.name, flag: doc.flags?.[ID]?.floor, doc }));
  const elevation=Math.max(Number(token?.elevation??0),canvas.level?.elevation?.base??0);
  const floor = floorAt(point, { sceneFloor: base, regions, testPoint: (r, p) => r.doc.testPoint({ x: p.x, y: p.y, elevation }) });
  // Rain ("Weather on the ground"): soil out in the rain turns to mud, in its sound and its prints.
  return movementFeelSettingOn("weatherOnGround") && weatherAt(point, elevation) === "rain" ? rainFloor(floor, "rain").floor : floor;
};
// The scene's weather (engines/motion/ground-trails.mjs sceneWeather): Foundry's own scene weather, else FXMaster's
// rain or snow; none inside a region with a Suppress Weather behavior (a roof, a cave).
const sceneWeatherNow = () => {
  const scene = canvas?.scene;
  try { return sceneWeather({ weather: scene?.weather, fxmaster: scene?.flags?.fxmaster?.effects }); } catch { return null; }
};
const shelteredAt = (point, elevation = 0) => {
  for (const region of canvas?.scene?.regions ?? []) {
    try {
      if (!Array.from(region.behaviors ?? []).some((b) => b.type === "suppressWeather" && !b.disabled)) continue;
      if (region.testPoint({ x: point.x, y: point.y, elevation })) return true;
    } catch { /* a broken region never breaks the weather */ }
  }
  return false;
};
const weatherAt = (point, elevation) => { const sky = sceneWeatherNow(); return sky && !shelteredAt(point, elevation) ? sky : null; };
// Ground trails (engines/motion/ground-trails.mjs): feet that walked through water, mud or snow print the next floor
// ("Feet carry mud, water and snow"), a badly hurt creature drips blood ("Wounded creatures leave blood drops"; Splatter
// paints it instead when Animater feeds it), and rain splashes or snow dusts each step ("Weather on the ground").
const groundTrails = createGroundTrails({
  tracked: () => movementFeelSettingOn("trackedPrints"),
  blood: () => movementFeelSettingOn("bloodTrail") && !(splatterReady() && movementFeelSettingOn(SPLATTER_SYNC)),
  weather: (feet, token) => (movementFeelSettingOn("weatherOnGround") ? weatherAt(feet, token?.elevation ?? 0) : null),
});
// A token's blood (placeable or TokenDocument): Splatter's rules while it is active, else Animater's own Blood colours
// (the token's override, then the GM's table by creature type; integrations/splatter.mjs creatureBlood).
const bloodTable = () => { try { return game.settings.get(ID, BLOOD_SETTING) ?? {}; } catch { return {}; } };
const tokenBlood = (token) => creatureBlood(token, {
  active: game.modules.get(SPLATTER_ID)?.active === true, setting: (key) => game.settings.get(SPLATTER_ID, key),
  getProperty: (obj, path) => foundry.utils.getProperty(obj, path), system: game.system.id, table: bloodTable(),
});
// Whether a token is badly hurt (a quarter of its HP or less, engines/playback/wounded-looks.mjs woundTier) with blood
// to lose, and its blood colour (tokenBlood); cached per token with the gaits (forgotten as an actor or a token
// changes, a token's blood flags change or the Blood colours are saved).
const movementFeelBlood = (d) => {
  const key = `blood|${d.id}`;
  let blood = feelGaits.get(key);
  if (blood === undefined) {
    try {
      const actor = d.actor;
      const own = tokenBlood(d);
      blood = { bleeding: own.bleeds && woundTier(hpState(actor, game.system.id)) === 2, bloodColor: own.color };
    } catch { blood = { bleeding: false }; }
    feelGaits.set(key, blood);
  }
  return blood;
};
// Position/visibility are checked every frame; stationary metadata is reused.
// Native document/perception hooks invalidate immediately, with a short fallback
// lifetime for integrations that change actor data without emitting a hook.
const movementViews = new Map();
for (const hook of ['canvasReady', 'canvasTearDown', 'updateActor', 'createItem', 'updateItem', 'deleteItem', 'sightRefresh', 'controlToken', 'clientSettingChanged', 'updateSetting','updateScene','createRegion','updateRegion','deleteRegion','updateSceneLevel'])
  Hooks.on(hook, () => movementViews.clear());
for (const hook of ['updateToken', 'deleteToken']) Hooks.on(hook, doc => movementViews.delete(doc.id));
const FOOTPRINT_LIFETIME_KEYS = {
  sand:'movementFootprintSandSeconds',mud:'movementFootprintMudSeconds',snow:'movementFootprintSnowSeconds',
  dirt:'movementFootprintDirtSeconds',grass:'movementFootprintGrassSeconds',stone:'movementFootprintStoneSeconds',
  wood:'movementFootprintWoodSeconds',water:'movementFootprintWaterSeconds',ice:'movementFootprintIceSeconds',
};
const movementFeel = createMovementFeel({
  trails: groundTrails,
  enabled: () => movementFeelSettingOn("movementFeel") && movementFeelSettingOn("movementFeelLocal"),
  // Burrowers' entrance and exit holes (world setting "Burrow holes").
  holes: () => movementFeelSettingOn("burrowHoles"),
  // Balanced and up draw it all, Low half, Off none.
  density: () => movementDensity(qualityRank(localQuality())),
  cap: () => (localQuality() === "low" ? 60 : 120),
  // Footprints last long and have their own budget, so a trail never holds back the dust.
  printCap: () => (localQuality() === "low" ? 40 : 80),
  printLifetime: floor => Number(hotSetting(FOOTPRINT_LIFETIME_KEYS[floor]) ?? 0) * 1000,
  trailLifetime: kind => Number(hotSetting({swim:'swimWakeSeconds',underwater:'underwaterBubbleSeconds',burrow:'burrowTrailSeconds'}[kind])??0)*1000,
  burrowDepth: () => Number(hotSetting('burrowTrailDepth')??-10),
  grid: () => canvas?.grid?.size ?? 100,
  distance: () => canvas?.dimensions?.distance ?? 5,
  now: () => performance.now(),
  floorAt: movementFeelFloor,
  layer: createMovementFeelLayer({ PIXI: globalThis.PIXI, root: movementFeelRoot }),
  tokens: () => {
    const placeables = canvas?.tokens?.placeables;
    if (!placeables?.length) return [];
    const base = canvas.level?.elevation?.base ?? 0, level = canvas.level?.id, time = performance.now();
    return placeables.map((t) => {
      const d = t.document, c = d.getCenterPoint();
      const until = feelSkip.get(d.id);
      if (until !== undefined && until <= time) feelSkip.delete(d.id);
      const skip = (until ?? 0) > time || motions?.active?.has?.(t) === true;
      const signature = [c.x, c.y, t.w, d.elevation, base, level, d.movementAction, t.visible, d.hidden, t.controlled, t.isOwner, t.isPreview];
      const cached = movementViews.get(d.id);
      if (cached && cached.token === t && time - cached.at < 100 && signature.every((value, i) => value === cached.signature[i])) {
        cached.view.skip = skip;
        return cached.view;
      }
      const sound = movementSoundMix(d.flags?.[ID]?.movementSound);
      const soundBody = sound.body === 'none' ? null : sound.body || movementFeelBody(d);
      const view = {
        id: d.id, x: c.x, y: c.y, width: t.w ?? 100, elevation: d.elevation ?? 0, base, action: d.movementAction,
        ...((d.elevation??0)<base?{floor:movementFeelFloor(c,d)}:{}),
        statuses: d.actor?.statuses, gait: sound.gait || movementFeelGait(d), bulk: movementFeelBulk(d),
        body: soundBody, flight: sound.flight || (['air', 'fire', 'water'].includes(soundBody) ? 'flight' : movementFeelFlight(d)), sound,
        ...movementFeelBlood(d),
        ...movementPerception(t, d, level),
        skip,
      };
      movementViews.set(d.id, {token: t, signature, at: time, view});
      return view;
    });
  },
  // Quiet positional steps on every floor: Animater's bundled steps, or PSFX's outdoor steps on soft ground when it is
  // active. Scaled by this device's surface sounds volume (Hit sounds menu); 0 there silences them.
  // How it moves picks the sound (engines/motion/movement-feel.mjs movementSound): footsteps for a walk, a wing beat for
  // a flier, a churn for a burrower, a stroke for a swimmer, a grip for a climber, a shuffle for a crawl, a whoosh as a
  // jump leaves the ground and a heavier footstep where it lands.
  footstep: (floor, at, token, kind = "step") => {
    const mix = movementSoundMix(token.sound);
    if (mix.silent || token.gait === 'none' || (token.preview && !token.preview.active)) return;
    let level = 1;
    try { level = Number(hotSetting("surfaceVolume") ?? 1); } catch { /* not registered yet */ }
    // "Footstep sounds" (the GM's, past it in the creature showcase) and this screen's own: off keeps the step's
    // timing and tremor, silent.
    const soundOn = (key) => { try { return hotSetting(key) !== false; } catch { return true; } };
    if (!((token.preview || soundOn("footstepSounds")) && soundOn("footstepSoundsLocal"))) level = 0;
    if (!(level > 0) && !(mix.tremor > 0)) return;
    const seed = token.id ?? "";
    // How heavy the creature is: its size category (else its token width) and whether its body is heavy.
    const squares = (token.width ?? 100) / (canvas.grid?.size || 100);
    const body = stepWeight({ size: token.bulk?.size, squares, heavy: token.bulk?.heavy === true });
    // A landing comes down a size heavier.
    const weight = kind === "land" ? body + 1 : body;
    // Sneaking ("Sneaking is quiet"): softer, a slower beat, duller, and no thud below Huge.
    const sneak = movementSneaking(seed) ? sneakStep(body) : null;
    // Its own beat: a giant's THUMP ... THUMP, a dragon's slow wing beat, however fast Foundry slides the token.
    const step = token.preview ? token.preview.step++ : stepPacer.take(seed, body, performance.now(), Math.round(moveSoundGap(kind, body, { gait: token.gait }) * (sneak?.gap ?? 1)));
    if (step === null) return;
    // Its own feet (engines/motion/movement-feel.mjs gaitStep): paws, hooves, talons, a dragon's claws, an ooze's
    // squelch, or a person's steps for boots; on mud, water, snow and sand the floor's own step plays quietly under it.
    const walking = kind === "step" || kind === "land";
    const pick = walking ? gaitStep(token.gait, floor, step, { psfx: game.modules.get("psfx")?.active === true, seed }) : null;
    // Its body (engines/motion/movement-feel.mjs bodyStep): a skeleton's rattle, a golem's clank, stone grinding or
    // leaves layered on the step; a water, fire or air body's slosh, flame or gust in place of it (they do not step).
    const layer = (walking || kind === "flight") && token.body ? bodyStep(token.body, step, { seed }) : null;
    const replaced = layer?.replaces === true;
    if (walking && !pick?.file && !replaced) return;
    // Hoof recordings depict a horse already: Large is their natural pitch reference. Treating that horse like an
    // enlarged humanoid darkens the clop into a knock. Keep size-based volume/pacing and lower pitch for larger hooves.
    const vary = footstepVariation({ seed, n: step, weight: movementContactWeight(token.gait, weight) });
    vary.rate = Math.min(2, Math.max(0.35, vary.rate * mix.pitch));
    // How far it carries ("Footstep hearing range"), half as far again for Huge and bigger.
    let range = "normal";
    try { range = hotSetting("footstepRange") ?? "normal"; } catch { /* not registered yet */ }
    const where = { x: at.x, y: at.y, elevation: token.elevation }, reach = footstepReach(range, weight) * (canvas.dimensions?.distance ?? 5);
    // A rained-on hard or open floor has puddles: a quiet splash under the step.
    const puddle = walking && movementFeelSettingOn("weatherOnGround") && weatherAt(at, token.elevation ?? 0) === "rain" && rainFloor(floor, "rain").splash;
    const volume = Math.min(1, footstepVolume(floor, { weight }) * vary.gain * Math.min(1, level) * (kind === "land" ? 1.25 : 1) * (sneak?.gain ?? 1));
    const contactVolume = Math.min(1, volume * mix.contact);
    const sceneId = canvas.scene?.id, sceneLevel = canvas.level?.id;
    const later = (fn, delay) => {
      const timer = setTimeout(() => {
        token.preview?.timers.delete(timer);
        if (!token.preview || token.preview.active) fn();
      }, delay);
      token.preview?.timers.add(timer);
    };
    // Where it happens ("Footsteps ring in the room"): it rings in the room and is muffled behind walls as Animater's
    // hits are (engines/sound/sound-pitch.mjs), at 0.6 of a hit's room. Foundry's own wall occlusion stays off.
    const room = movementFeelSettingOn("footstepAcoustics")
      ? { at: { x: at.x, y: at.y, elevation: token.elevation, sceneId: canvas.scene?.id, level: canvas.level?.id }, roomShare: 0.6 } : {};
    // Its own pitch, lower for heavier creatures (a giant's tread deep and slow, a pixie's light and quick). Asked for
    // just before it plays, so it is set as Foundry builds the sound (engines/sound/sound-pitch.mjs) and the very first
    // millisecond is already at that pitch; set again once it plays in case that hook is missing.
    const play = (file, rate, level, shape = {}) => {
      if (!(level > 0) || (token.preview && !token.preview.active)) return Promise.resolve(null);
      Hooks.callAll("animater.shapeSound", { file, rate, ...room, ...shape });
      const asked = performance.now();
      const playing = token.preview ? game.audio.play(file, { volume: level, context: game.audio.interface })
        : canvas.sounds?.playAtPosition?.(file, where, reach, { volume: level, walls: false, gmAlways: false });
      // Resolves to the playing sound, or null when it was dropped (then nothing is layered on it).
      return Promise.resolve(playing).then((sound) => {
        // A beat that only starts long after it was due (its file was still loading) is dropped, not played late:
        // several late beats would otherwise pile up and sound together.
        if (performance.now() - asked > LATE_BEAT_MS || (token.preview && !token.preview.active)) { try { sound?.stop?.(); } catch { /* already gone */ } return null; }
        if (sound && token.preview) token.preview.sounds.add(sound);
        const node = sound?.sourceNode?.playbackRate;
        if (node && node.value !== rate) node.value = rate;
        else if (!node && sound?.element) { sound.element.preservesPitch = false; sound.element.playbackRate = rate; }
        return sound ?? null;
      }).catch(() => null);
    };
    // Any other way of moving plays its own family, pitched, darkened and levelled by the creature's weight.
    if (kind === "flight" && replaced) {
      const shape = moveSoundShape(kind, { weight, seed, n: step });
      play(layer.file, shape.rate * mix.pitch, Math.min(1, shape.volume * Math.min(1, level) * layer.gain * mix.contact * (sneak?.gain ?? 1)), sneak ? { lowpass: sneak.lowpass } : {});
      return;
    }
    if (kind !== "step" && kind !== "land") {
      const file = moveSoundFile(kind, step, { seed });
      if (!file) return;
      const shape = moveSoundShape(kind, { weight, seed, n: step });
      const lowpass = darker(shape.lowpass, sneak?.lowpass);
      play(file, shape.rate * mix.pitch, Math.min(1, shape.volume * Math.min(1, level) * mix.contact * (sneak?.gain ?? 1)),
        lowpass ? { lowpass, ...(shape.lowpass ? { bass: shape.bass } : {}) } : {});
      return;
    }
    if (replaced) {
      // No foot touches the floor: no floor layer, no thud, no tremor; the body's own sound at the step's pitch and level.
      play(layer.file, vary.rate, Math.min(1, contactVolume * layer.gain), sneak ? { lowpass: sneak.lowpass } : {});
      return;
    }
    const muffle = darker(pick.lowpass, sneak?.lowpass);
    // A muted contact still provides its impact timing. Load locally without playing or broadcasting a preload.
    const silentAnchor = async () => {
      const asked = performance.now();
      const sound = game.audio?.create?.({ src: pick.file, singleton: true });
      if (sound && !sound.loaded) await sound.load();
      if (performance.now() - asked > LATE_BEAT_MS) return null;
      return sound ?? { buffer: null };
    };
    const stepping = contactVolume > 0 ? play(pick.file, vary.rate, Math.min(1, contactVolume * (pick.gain ?? 1)),
      muffle ? { lowpass: muffle, ...(pick.bass ? { bass: pick.bass } : {}) } : {}) : silentAnchor().catch(() => null);
    // The floor under the creature's own foot (a hoof in mud, a paw in snow), quieter, at the same pitch and shape.
    if (pick.under) play(pick.under, vary.rate, Math.min(1, contactVolume * pick.underGain), sneak ? { lowpass: sneak.lowpass } : {});
    if (puddle && contactVolume > 0) play(footstepFile("water", step, { psfx: game.modules.get("psfx")?.active === true, seed: `${seed}:rain` }), vary.rate, Math.min(1, contactVolume * RAIN_SPLASH_GAIN), sneak ? { lowpass: sneak.lowpass } : {});
    if (pick.texture && contactVolume > 0 && pick.texture.file !== layer?.file) stepping.then((sound) => {
      if (!sound) return;
      const texture = pick.texture;
      const delay = thudDelayMs({ stepPeakMs: audioPeakMs(sound.buffer), stepRate: vary.rate, thudPeakMs: texture.peakMs, thudRate: vary.rate });
      later(() => play(texture.file, vary.rate, Math.min(1, contactVolume * texture.gain), sneak ? { lowpass: sneak.lowpass } : {}), delay);
    }).catch(() => {});
    // The body's layer lands with the foot: started once the step plays, timed to the step's loudest moment (as the thud),
    // quieter, at the same pitch.
    if (layer && contactVolume > 0) stepping.then((sound) => {
      if (!sound) return;
      const delay = thudDelayMs({ stepPeakMs: audioPeakMs(sound.buffer), stepRate: vary.rate, thudPeakMs: layer.peakMs, thudRate: vary.rate });
      const shape = sneak ? { lowpass: sneak.lowpass } : {};
      later(() => play(layer.file, vary.rate, Math.min(1, contactVolume * layer.gain), shape), delay);
    }).catch(() => {});
    // Large and heavier: a low thud lands under the step, deeper, louder and longer the bigger the creature, always at
    // its size's own pitch (never varied: a giant's thud is always the same deep thud). It waits for the footfall:
    // started once the step is playing, timed to the step's loudest moment at its playback rate.
    // An ordinary Large horse already has weight in its hoof contact; a giant's bass layer masks its clip-clop.
    const thudWeight = token.gait === "hooves" && !token.bulk?.heavy && weight < 4 ? 2 : weight;
    const thud = thudFile(thudWeight, step, seed), boom = thudLevel(thudWeight);
    // Tremor is a separate layer of the footfall, independent of bass volume or bass-file playback.
    if (weight >= 4 && mix.tremor > 0 && !sneak && movementFeelSettingOn("footfallTremor")) stepping.then((sound) => {
      if (!sound) return;
      later(() => cameraShake.tremor({ at: { x: at.x, y: at.y }, weight, sceneId, level: sceneLevel,
        seed: `${seed}:${step}`, scale: mix.tremor, previewId: token.preview?.id }), thudDelayMs({ stepPeakMs: audioPeakMs(sound.buffer), stepRate: vary.rate, thudPeakMs: 0 }));
    }).catch(() => {});
    if (thud && boom && mix.weight > 0 && (!sneak || sneak.thud)) {
      // Darkened and given body (a low-pass and a bass shelf); Huge and up also rumble an octave lower still.
      // The bass boost is paid for in level (its headroom), so the boosted thud stays under full scale; a limiter on
      // each layer catches the rest when they stack.
      const shape = { lowpass: boom.lowpass, bass: boom.bass }, level = Math.min(1, volume * mix.weight * boom.gain * 2.5 * (boom.headroom ?? 1));
      stepping.then((sound) => {
        if (!sound) return;
        const stepPeakMs = audioPeakMs(sound.buffer);
        later(() => play(thud, boom.rate, level, shape), thudDelayMs({ stepPeakMs, stepRate: vary.rate, thudRate: boom.rate }));
        if (boom.sub) later(() => play(thud, boom.sub.rate, Math.min(1, level * boom.sub.gain), { lowpass: Math.round(boom.lowpass * 0.6), bass: boom.bass }),
          thudDelayMs({ stepPeakMs, stepRate: vary.rate, thudRate: boom.sub.rate }));
      }).catch(() => {});
    }
  },
});
const clearMovementFeel = () => {
  movementFeel.clear();
  stepPacer.clear();
  feelSkip.clear();
  try { feelRoot?.destroy({ children: true }); } catch { /* canvas gone */ }
  feelRoot = null;
};
// Animater's own teleports carry animater.teleport on the update: no dust along the slide.
Hooks.on("updateToken", (doc, changed, options) => {
  if (options?.animater?.teleport && ("x" in (changed ?? {}) || "y" in (changed ?? {})))
    feelSkip.set(doc.id, performance.now() + (options.animation?.duration ?? 1500) + 400);
});
Hooks.on("canvasTearDown", clearMovementFeel);
// Burrowed creatures sink out of sight (engines/motion/burrow-sink.mjs; world setting "Burrowed creatures sink out of
// sight"): a token whose elevation is below its level's floor shrinks and fades into its hole. Once it is down, a
// viewer who does not own it no longer sees it at all (nor its nameplate, bars or effects, nor can hover, click or
// target it: Foundry's TokenLayer only picks visible, interactive tokens), while its owner and the GM see a faint
// ghost. It rises back out where it surfaces. Foundry rewrites the mesh's alpha and scale and the token's visibility
// on each refresh (Token#_refreshState, #_refreshMesh, PlaceableObject#_refreshVisibility), and the refreshToken hook
// runs right after those, so the pose is laid on there and, while it moves, every frame after Foundry's own updates.
const burrowSink = createBurrowSink({ now: () => performance.now(), duration: 350 });
const waterSink = createBurrowSink({now:()=>performance.now(),duration:450});
const waterTints=new Map();
const sinkPoses = new Map(); // token -> poseMesh record
const sinkSeen = new Set(); // token ids already judged on this canvas (one already under on load starts down)
const sinkMoving = new Set(); // token ids part-way down or up last frame
let sinkDirty = true, sinkLevel;
const sinkPending = new Set();
const dirtySink = token => { if (token?.id) sinkPending.add(token.id); else sinkDirty = true; };
for (const hook of ['createToken', 'updateToken']) Hooks.on(hook, dirtySink);
for (const hook of ['canvasReady', 'controlToken', 'clientSettingChanged', 'updateSetting','updateScene','createRegion','updateRegion','deleteRegion','updateSceneLevel']) Hooks.on(hook, () => { sinkDirty = true; });
let sinkTicker = null;
const burrowSinkOn = () => movementFeelSettingOn("burrowSink");
const underwaterLooksOn=()=>movementFeelSettingOn('underwaterLooks')&&movementFeelSettingOn('movementFeel')&&movementFeelSettingOn('movementFeelLocal');
const sinkViewer = (token) => ({ owner: token.isOwner === true, gm: game.user?.isGM === true });
const unhideSunk = (token) => {
  if (!sunkHidden.has(token)) return;
  sunkHidden.delete(token);
  // Foundry decides its visibility and interactivity afresh.
  try { token.renderFlags?.set?.({ refreshVisibility: true, refreshState: true }); } catch { /* destroyed */ }
};
const applyBurrowSink = (token, flags) => {
  const d = token?.document, mesh = token?.mesh;
  if (!d || token.destroyed || !mesh || mesh.destroyed) return;
  const viewer = sinkViewer(token);
  if (burrowSink.hiddenFor(d.id, viewer)) {
    // What Foundry decided: read now unless it is still our own false from before (no visibility refresh since).
    const foundry = sunkHidden.has(token) && !flags?.refreshVisibility ? sunkHidden.get(token) : token.visible === true;
    sunkHidden.set(token, foundry);
    token.visible = false;
    mesh.visible = false;
    token.eventMode = "none";
    return;
  }
  unhideSunk(token);
  // Another animation (an Animater motion, a prone or idle body) owning the scale keeps it; the fade still applies.
  const busy = motions?.active?.has?.(token) === true || conditionBody?.moves?.(token) === true;
  const waterDepth=waterSink.depth(d.id),water=underwaterPose(waterDepth,hotSetting('underwaterOpacity')??.35);
  const pose=burrowSink.pose(d.id,viewer);pose.alpha*=water.alpha;
  const tint=underwaterTint(mesh,waterDepth,waterTints.get(token));if(tint)waterTints.set(token,tint);else waterTints.delete(token);
  const record = poseMesh(mesh, pose, sinkPoses.get(token), { scale: !busy });
  if (record) sinkPoses.set(token, record); else sinkPoses.delete(token);
};
const restoreBurrowSink = (token) => {
  unhideSunk(token);
  const record = sinkPoses.get(token);
  underwaterTint(token?.mesh,0,waterTints.get(token));waterTints.delete(token);
  sinkPoses.delete(token);
  if (record && token?.mesh && !token.mesh.destroyed) poseMesh(token.mesh, { alpha: 1, scale: 1 }, record);
};
const clearBurrowSink = () => {
  for (const token of new Set([...sunkHidden.keys(), ...sinkPoses.keys(),...waterTints.keys()])) restoreBurrowSink(token);
  sunkHidden.clear();
  sinkPoses.clear();
  sinkSeen.clear();
  sinkMoving.clear();
  sinkPending.clear();
  sinkDirty = true;
  burrowSink.clear();
  waterSink.clear();
};
// Each frame: who is under the floor of the level on view, and the pose of any token part-way down or up.
const tickBurrowSink = () => {
  const burrowsOn=burrowSinkOn(),waterOn=underwaterLooksOn();
  if (!burrowsOn&&!waterOn) {if(sinkPoses.size||waterTints.size)clearBurrowSink();return;}
  const placeables = canvas?.tokens?.placeables;
  if (!placeables?.length) return;
  const base = canvas.level?.elevation?.base ?? 0, level = canvas.level?.id;
  const levelKey = `${level}:${base}`;
  if (sinkLevel !== levelKey) { sinkLevel = levelKey; sinkDirty = true; }
  const candidates = sinkDirty ? placeables : [...new Set([...sinkPending, ...sinkMoving])].map(id => canvas.tokens.get(id)).filter(Boolean);
  sinkDirty = false;
  sinkPending.clear();
  for (const t of candidates) {
    const d = t.document;
    if (!d || t.isPreview) continue;
    const onLevel = level === undefined || d.level === undefined || d.level === level;
    const below = onLevel && (d.elevation ?? 0) < base;
    const medium=below?movementEnvironment({elevation:d.elevation,base,action:d.movementAction},movementFeelFloor(t.center??d.getCenterPoint?.(),d)):null;
    const under = burrowsOn&&medium?.underground===true;
    const first = !sinkSeen.has(d.id);
    if (first) sinkSeen.add(d.id);
    const turned = burrowSink.update(d.id, under, { instant: first });
    const waterTurned=waterSink.update(d.id,waterOn&&medium?.submerged===true,{instant:first});
    const moving = burrowSink.moving(d.id)||waterSink.moving(d.id), was = sinkMoving.has(d.id);
    // At the first instant depth can still be exactly zero. Keep a newly
    // started transition scheduled until the following frame advances it.
    if (moving || turned||waterTurned) sinkMoving.add(d.id); else sinkMoving.delete(d.id);
    // Part-way, or just finished (the last frame's pose, and the hiding once it is all the way down).
    if (turned ||waterTurned|| moving || was ||waterSink.has(d.id)||waterTints.has(t)|| (first && under)) applyBurrowSink(t);
  }
};
Hooks.on("refreshToken", (token, flags) => {
  try {
    if (!burrowSinkOn()&&!underwaterLooksOn()) return;
    dirtySink(token.document);
    if (burrowSink.has(token.document?.id)||waterSink.has(token.document?.id) || sunkHidden.has(token) || sinkPoses.has(token)) applyBurrowSink(token, flags);
  } catch { /* never break a token refresh */ }
});
Hooks.on("destroyToken", (token) => { const id=token.document?.id;sunkHidden.delete(token);sinkPoses.delete(token);waterTints.delete(token);sinkSeen.delete(id);sinkMoving.delete(id);sinkPending.delete(id);burrowSink.delete(id);waterSink.delete(id); });
Hooks.on("canvasReady", () => {
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  if (!ticker || !P || sinkTicker === ticker) return;
  sinkTicker = ticker;
  // After Foundry's object refresh (OBJECTS) and perception (PERCEPTION) for the frame, before the render (LOW).
  ticker.add(() => { try { tickBurrowSink(); } catch { /* never stop the canvas */ } }, undefined, P.NORMAL);
});
Hooks.on("canvasTearDown", clearBurrowSink);
// Creature idle sounds (engines/sound/creature-idle.mjs; world setting "Creatures growl on their turn"): with PF2e
// Creature Sounds active, a Large or bigger NPC sometimes growls as its own combat turn starts. Every client sees the
// same combat update and the same seeded chance, so no broadcast; each plays it only if this screen hears the creature.
// The sound sets are read once from that module's bundle (it has no API), and its own on/off and volume apply.
// Creature voices from the GM's own folder (engines/sound/voice-library.mjs): the GM's screen browses it once (when the
// setting is set, or at ready if it was never scanned) and shares what it found as a world setting; every screen
// builds its voice bank from that, Animater's own voices (data/creature-voices.mjs and the library voices it ships,
// data/library-voices.mjs) and the folder's together.
let voiceLibrary = null;
const voiceBank = () => voiceLibrary ??= (() => {
  let index = {};
  try { index = game.settings.get(ID, "creatureVoiceIndex") ?? {}; } catch { /* not registered yet */ }
  return mergeBanks([...CREATURE_VOICES, ...LIBRARY_VOICES], libraryBank(index.base ?? "", index.entries ?? [], index.verdicts ?? {}), LIBRARY_FOLDERS);
})();
const VOICE_AUDIO = /\.(ogg|oga|mp3|wav|flac|m4a|webm)$/i;
async function scanVoiceFolder({ quiet = false } = {}) {
  let base = "";
  try { base = String(game.settings.get(ID, "creatureVoiceFolder") ?? "").trim().replace(/\/+$/, ""); } catch { return; }
  if (!base) return void game.settings.set(ID, "creatureVoiceIndex", {});
  const browse = (path) => foundry.applications.apps.FilePicker.implementation.browse("data", path).catch(() => null);
  const name = (p) => decodeURIComponent(String(p).split("/").filter(Boolean).pop() ?? "");
  const top = await browse(base);
  if (!top) return void ui.notifications?.warn(`Animater | Could not open the creature voice folder "${base}".`);
  const entries = [], folders = (top.dirs ?? []).map(name);
  // A few folders at a time: a big library has hundreds.
  for (let i = 0; i < folders.length; i += 8) {
    await Promise.all(folders.slice(i, i + 8).map(async (folder) => {
      const inner = await browse(`${base}/${folder}`);
      for (const use of (inner?.dirs ?? []).map(name).filter((u) => ["attack", "hurt", "death"].includes(u.toLowerCase()))) {
        const files = (await browse(`${base}/${folder}/${use}`))?.files?.map(name).filter((f) => VOICE_AUDIO.test(f)) ?? [];
        if (files.length) entries.push({ folder, use: use.toLowerCase(), files });
      }
    }));
  }
  // The GM's audition of the folder (animater-voices.json beside its voices: keep, reject, family), if there is one.
  let verdicts = {};
  if ((top.files ?? []).some((f) => name(f) === "animater-voices.json")) {
    try {
      let url = `${base}/animater-voices.json`;
      try { url = foundry.utils.getRoute(url); } catch { /* relative */ }
      const res = await fetch(url, { cache: "no-store" });
      const raw = res.ok ? await res.json() : {};
      verdicts = { keep: Array.isArray(raw.keep) ? raw.keep : [], reject: Array.isArray(raw.reject) ? raw.reject : [], family: raw.family && typeof raw.family === "object" ? raw.family : {}, prefer: Array.isArray(raw.prefer) ? raw.prefer : [] };
    } catch (error) { ui.notifications?.warn(`Animater | animater-voices.json in "${base}" could not be read: ${error.message}`); }
  }
  await game.settings.set(ID, "creatureVoiceIndex", { base, entries, verdicts, scanned: Date.now() });
  const voices = Object.values(libraryBank(base, entries, verdicts)).reduce((n, v) => n + v.length, 0);
  if (!quiet) ui.notifications?.info(`Animater | ${voices} creature voices found in "${base}".`);
}
Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  try {
    // Every start, in the background: new voices and a new animater-voices.json take effect on the next reload.
    if (String(game.settings.get(ID, "creatureVoiceFolder") ?? "").trim()) void scanVoiceFolder({ quiet: true });
  } catch { /* not registered */ }
});
// Whether PF2e Creature Sounds voices this world's creatures (voiceDeferred's world half).
function pf2eSoundsState() {
  let moduleEnabled = true;
  try { moduleEnabled = game.settings.get("pf2e-creature-sounds", "creatureSounds_enable") !== false; } catch { /* its default: on */ }
  return { systemId: game.system?.id, moduleActive: game.modules?.get("pf2e-creature-sounds")?.active, moduleEnabled };
}
let creatureSoundDb = null;
const creatureSoundSets = () => creatureSoundDb ??= (async () => {
  const path = "modules/pf2e-creature-sounds/dist/pf2e-creature-sounds.js";
  let url = path;
  try { url = foundry.utils.getRoute(path); } catch { /* relative */ }
  const res = await fetch(url);
  return res.ok ? parseCreatureSoundDb(await res.text()) : {};
})().catch(() => ({}));
const idleVoiced = new Set();
Hooks.on("updateCombat", (combat, changes) => {
  if (!changes || !("turn" in changes || "round" in changes)) return;
  try {
    if (hotSetting("creatureIdleSounds") === false) return;
    if (game.modules.get("pf2e-creature-sounds")?.active !== true) return;
    try { if (game.settings.get("pf2e-creature-sounds", "creatureSounds_enable") === false) return; } catch { /* its default: on */ }
    if (!combat?.started || !canvas?.ready) return;
    const key = `${combat.id}:${combat.round}:${combat.turn}`;
    if (idleVoiced.has(key) || !voicesThisTurn({ combatId: combat.id, round: combat.round, turn: combat.turn })) return;
    const combatant = combat.combatant, t = combatant?.token?.object, d = t?.document, actor = d?.actor;
    if (!t || !actor || actor.type !== "npc" || d.parent?.id !== canvas.scene?.id) return;
    if (actor.system?.attributes?.emitsSound === false || actor.isDead || combatant.defeated) return;
    const bulk = movementFeelBulk(d);
    const weight = stepWeight({ size: bulk?.size, squares: (t.w ?? 100) / (canvas.grid?.size || 100), heavy: bulk?.heavy === true });
    if (!(weight >= IDLE_FROM_WEIGHT)) return;
    idleVoiced.add(key);
    if (idleVoiced.size > 200) idleVoiced.delete(idleVoiced.values().next().value);
    // Only screens that hear it (stealth, levels, GM perception as for its footsteps).
    if (!movementPerception(t, d, canvas.level?.id ?? undefined).audible) return;
    void creatureSoundSets().then((db) => {
      let custom = {};
      try { custom = game.settings.get("pf2e-creature-sounds", "custom_sound_sets") ?? {}; } catch { /* none */ }
      const traits = Array.from(actor.system?.traits?.value ?? []);
      const sizes = { tiny: 0, sm: 1, med: 2, lg: 3, huge: 4, grg: 5 };
      const set = pickSoundSet({ name: actor.flags?.babele?.originalName ?? actor.name, chosen: actor.flags?.["pf2e-creature-sounds"]?.soundset ?? null,
        traits, size: sizes[actor.system?.traits?.size?.value] ?? -1, seed: actor.id }, db, custom);
      const file = idleSoundFile(set, key);
      if (!file) return;
      let volume = 0.5;
      try { volume = Number(game.settings.get("pf2e-creature-sounds", "creatureSounds_volume") ?? 0.5); } catch { /* its default */ }
      const shape = idleShape(weight, key), level = Math.min(1, volume * shape.volume);
      if (!(level > 0)) return;
      const c = d.getCenterPoint?.() ?? t.center, where = { x: c.x, y: c.y, elevation: d.elevation ?? 0 };
      const room = movementFeelSettingOn("footstepAcoustics") ? { at: { ...where, sceneId: canvas.scene?.id, level: canvas.level?.id }, roomShare: 0.8 } : {};
      // A breath after the turn's own sounds settle.
      setTimeout(() => {
        if (!canvas?.ready || canvas.scene?.id !== d.parent?.id) return;
        Hooks.callAll("animater.shapeSound", { file, rate: shape.rate, ...room });
        void Promise.resolve(canvas.sounds?.playAtPosition?.(file, where, 12 * (canvas.dimensions?.distance ?? 5), { volume: level, walls: false, gmAlways: false }))
          .then((sound) => {
            const node = sound?.sourceNode?.playbackRate;
            if (node && node.value !== shape.rate) node.value = shape.rate;
          }).catch(() => {});
      }, 700);
    });
  } catch (err) { console.warn("Animater | creature idle sound skipped", err); }
});
Hooks.on("canvasReady", () => {
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  // Every footstep (people's and creatures') and footfall thud loads now (about 750 KB in all), so no step waits on a download: a late step
  // would fall out of its creature's beat and land after its thud.
  if (movementFeelSettingOn("movementFeel") && movementFeelSettingOn("movementFeelLocal")) {
    const psfx = game.modules.get("psfx")?.active === true;
    const files = new Set([...Object.values(FOOTSTEP_FILES).flat(), ...gaitStepFiles(), ...bodyStepFiles(), ...THUD_FILES, ...Object.values(MOVE_SOUND_FILES).flat(),
      ...(psfx ? Array.from({ length: 16 }, (_, n) => footstepFile("dirt", n, { psfx: true, seed: "preload" })) : [])]);
    for (const file of files) { try { void Promise.resolve(game.audio?.preload?.(file)).catch(() => {}); } catch { /* optional */ } }
  }
  if (!ticker || !P || feelTicker === ticker) return;
  feelTicker = ticker;
  // After token animations write this frame's position (they run above NORMAL), before the render.
  ticker.add(() => { try { movementFeel.tick(); } catch { /* never stop the canvas */ } }, undefined, P.NORMAL);
});
// Breath vapor on this client (engines/motion/breath-vapor.mjs): in the cold (snow falling, a snow or ice floor
// underfoot, or the scene flag animater.cold), breathing creatures in view puff a faint white cloud with each breath out.
// Above the tokens, at Balanced quality or better, and off wherever idle life is off on this screen.
let vaporRoot = null, vaporTicker = null, vaporList = [], vaporListAt = -Infinity;
const VAPOR_REFRESH_MS = 500;
const vaporOn = () => {
  try {
    return hotSetting("breathVapor") !== false && hotSetting("idleLifeLocal") !== false
      && qualityRank(localQuality()) >= 2 && !!canvas?.ready;
  } catch { return false; }
};
const vaporRootOf = () => {
  if (!vaporRoot || vaporRoot.destroyed) {
    vaporRoot = new PIXI.Container();
    vaporRoot.eventMode = "none";
    vaporRoot.elevation = canvas.level?.elevation?.base ?? 0;
    // Over the tokens (700), under the weather (1000).
    vaporRoot.sortLayer = 900;
    canvas.primary.addChild(vaporRoot);
  }
  return vaporRoot;
};
// The breathing creatures in view, nearest the middle first, and whether each stands in the cold; refreshed twice a second.
const listVaporTokens = () => {
  const stage = canvas.stage, s = stage?.scale?.x || 1, [sw, sh] = canvas.screenDimensions ?? [window.innerWidth, window.innerHeight];
  const view = stage ? { x: stage.pivot.x - sw / 2 / s, y: stage.pivot.y - sh / 2 / s, width: sw / s, height: sh / s } : null;
  const scene = canvas.scene, level = canvas.level?.id, raw = scene?.flags?.[ID]?.cold;
  // Scene configuration's Animater climate: "cold" or "warm" decides; unset, the weather and floor do.
  const flag = raw === true || raw === "cold" ? true : raw === false || raw === "warm" ? false : undefined;
  const placed = [];
  for (const t of canvas.tokens?.placeables ?? []) {
    try {
      const d = t.document;
      if (!t.visible || d.hidden || t.isPreview || (level !== undefined && d.level !== undefined && d.level !== level)) continue;
      if (!breathes(t.actor) || !idleKind({ actor: t.actor, statuses: [...Array.from(t.actor?.statuses ?? []), ...(t.actor?.itemTypes?.condition?.map((c) => c.slug) ?? [])], movementAction: d.movementAction })) continue;
      placed.push({ t, x: t.x ?? 0, y: t.y ?? 0, w: t.w ?? 0, h: t.h ?? 0 });
    } catch { /* a token mid-teardown: skip it */ }
  }
  return pickIdle(placed, view, VAPOR_CAP).map(({ t }) => {
    let cold = false;
    try {
      const d = t.document, c = d.getCenterPoint(), feet = { x: c.x, y: c.y + (t.w ?? 100) * 0.25 };
      cold = isCold({ flag, weather: weatherAt(feet, d.elevation ?? 0), floor: movementFeelFloor(feet, { elevation: d.elevation ?? 0 }) });
    } catch { /* warm */ }
    return { t, cold };
  });
};
const breathVapor = createBreathVapor({
  enabled: vaporOn,
  grid: () => canvas?.grid?.size ?? 100,
  now: () => performance.now(),
  layer: createMovementFeelLayer({ PIXI: globalThis.PIXI, root: vaporRootOf }),
  tokens: () => {
    const time = performance.now();
    if (time - vaporListAt >= VAPOR_REFRESH_MS) { vaporListAt = time; vaporList = listVaporTokens(); }
    const out = [];
    for (const { t, cold } of vaporList) {
      if (!t || t.destroyed || !t.document) continue;
      const d = t.document, c = d.getCenterPoint();
      out.push({ id: d.id, x: c.x, y: c.y, width: t.w ?? 100, rotation: d.rotation ?? 0, visible: t.visible === true && !d.hidden, breathes: true, cold,
        // Portrait or top-down art decides where the mouth is.
        art: vaporArt({ ring: d.ring?.enabled === true, lockRotation: d.lockRotation === true, rotation: d.rotation ?? 0 }),
        // Token configuration's Breath from: where this token's art has its mouth.
        mouth: d.flags?.[ID]?.breathFrom || "auto" });
    }
    return out;
  },
});
Hooks.on("canvasTearDown", () => {
  breathVapor.clear();
  vaporList = []; vaporListAt = -Infinity;
  try { vaporRoot?.destroy({ children: true }); } catch { /* canvas gone */ }
  vaporRoot = null;
});
Hooks.on("canvasReady", () => {
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  if (!ticker || !P || vaporTicker === ticker) return;
  vaporTicker = ticker;
  ticker.add(() => { try { breathVapor.tick(); } catch { /* never stop the canvas */ } }, undefined, P.NORMAL);
});
// Hover explanation (ui/hover-explain.mjs): hovering a token lists what Animater plays on it here.
// Lasting plays started on this client, lasting condition/effect layers (drawn on every client), and
// every Animater effect Sequencer shows on this screen (tagged animaterRecipe by whichever client started it).
const hoverEffects = () => {
  const manager = globalThis.Sequencer?.EffectManager;
  try { return [...(manager?.effects ?? manager?.getEffects?.({}) ?? [])]; } catch { return []; }
};
const hoverToScreen = (point) => {
  if (typeof canvas?.clientCoordinatesFromCanvas === "function") return canvas.clientCoordinatesFromCanvas(point);
  const p = canvas?.stage?.worldTransform?.apply?.(point), box = canvas?.app?.view?.getBoundingClientRect?.();
  return p && box ? { x: p.x + box.left, y: p.y + box.top } : null;
};
const hoverExplain = createHoverExplain({
  document: globalThis.document,
  enabled: () => { try { const on = hotSetting("hoverExplain"); return on ?? game.user?.isGM === true; } catch { return false; } },
  isGM: () => game.user?.isGM === true,
  rowsFor: (token) => tokenRows({
    sessions: runtime?.runningAnimations() ?? [], states: persistentStates?.running() ?? [], effects: hoverEffects(),
    tokenId: token.id ?? token.document?.id, tokenUuid: token.document?.uuid, userId: game.user?.id,
  }),
  view: (rows) => hoverView(rows, { userId: game.user?.id, isGM: game.user?.isGM === true, userName: (id) => game.users?.get(id)?.name ?? "", userIsGM: (id) => game.users?.get(id)?.isGM === true }),
  toScreen: hoverToScreen,
});
let hoverCanvasView = null;
Hooks.on("hoverToken", (token, hovered) => {
  // A token being dragged (its preview clone) explains nothing.
  if (token?.isPreview) return hoverExplain.hide();
  hoverExplain.hover(token, hovered);
});
Hooks.on("canvasPan", () => hoverExplain.refresh());
Hooks.on("canvasTearDown", () => hoverExplain.hide());
Hooks.on("deleteToken", () => hoverExplain.hide());
Hooks.on("canvasReady", () => {
  // Pressing on the canvas (to drag a token, or select) hides it until the next hover.
  const view = canvas?.app?.view;
  if (!view || hoverCanvasView === view) return;
  hoverCanvasView = view;
  view.addEventListener?.("pointerdown", () => hoverExplain.hide());
});
// Counteract and dispel (engines/playback/dispel.mjs, shatter-fx.mjs): the client that rolled a counteract check, or
// cast Dispel Magic or Counterspell, tells every screen. A success opens a 4 s window there: Animater's lasting areas
// and auras that end inside it break into glass shards as they go. A failure makes the lasting animations on its
// targets flicker for a moment, then hold. Local visuals only, above the tokens like the element reactions.
const dispelOn = () => { try { return hotSetting("dispelShatter") !== false && hotSetting("dispelShatterLocal") !== false && qualityRank(localQuality()) > 0; } catch { return false; } };
const dispelWindow = createDispelWindow({ now: () => performance.now() });
const dispelFlicker = createFlickerHost({ now: () => performance.now() });
const dispelLasting = new Set();
let dispelShattered = new WeakSet(), shatterRoot = null, dispelTicker = null;
const shatterHost = createShatterHost({
  now: () => performance.now(),
  enabled: dispelOn,
  spawn: (spec) => {
    if (!canvas?.primary) return null;
    if (!shatterRoot || shatterRoot.destroyed) {
      shatterRoot = new PIXI.Container();
      shatterRoot.eventMode = "none";
      shatterRoot.elevation = canvas.level?.elevation?.base ?? 0;
      shatterRoot.sortLayer = 800;
      canvas.primary.addChild(shatterRoot);
    }
    const fx = shatterVisual(PIXI, spec, performance.now());
    shatterRoot.addChild(fx.display);
    return fx;
  },
});
// Where an effect is drawn: its sprite's bounds in canvas space, else its position at a square's size.
const dispelSpot = (effect) => {
  try {
    const t = canvas.stage.worldTransform;
    const spot = spotFromBounds(effect.sprite?.getBounds?.(), { tx: t.tx, ty: t.ty, scale: canvas.stage.scale.x });
    if (spot) return spot;
  } catch { /* sprite gone */ }
  try {
    const p = finitePoint(effect.worldPosition) ?? finitePoint(effect.position);
    if (p) return { x: p.x, y: p.y, radius: (canvas?.grid?.size ?? 100) / 2 };
  } catch { /* effect gone */ }
  return null;
};
// Never on an effect this viewer does not see, nor on a token hidden from them.
const dispelSeen = (effect) => {
  if (effect.worldVisible === false || effect.sprite?.worldVisible === false) return false;
  return effectTokenIds(effect.data).every((id) => {
    const token = canvas?.tokens?.get(id);
    return !token || ((game.user.isGM || !token.document?.hidden) && token.visible !== false);
  });
};
const shatterEffect = (effect) => {
  if (dispelShattered.has(effect)) return;
  dispelShattered.add(effect);
  if (!dispelSeen(effect)) return;
  const spot = dispelSpot(effect);
  if (!spot) return;
  if (shatterHost.play({ at: { x: spot.x, y: spot.y }, radius: spot.radius, tint: effect.data?.tint, seed: shatterSeed(effect.data?.id ?? effect.id) })) {
    // The shards replace Sequencer's own fade.
    try { effect.alpha = 0; } catch { /* effect gone */ }
  }
};
const dispelCandidate = (effect) => !effect.destroyed && effect.data?.sceneId === canvas?.scene?.id;
const flickerDispelTargets = (tokenIds) => {
  if (!tokenIds?.length) return;
  const ids = new Set(tokenIds);
  const centres = tokenIds.map((id) => canvas?.tokens?.get(id)?.center).filter(Boolean);
  for (const effect of dispelLasting) {
    if (!dispelCandidate(effect)) continue;
    const on = effectTokenIds(effect.data);
    if (on.some((id) => ids.has(id)) || (!on.length && centres.some((c) => spotHolds(dispelSpot(effect), c)))) dispelFlicker.start(effect);
  }
};
const handleDispel = ({ outcome, tokenIds }) => {
  try {
    if (!dispelOn()) return;
    if (outcome === "failure") flickerDispelTargets(tokenIds);
    else dispelWindow.add({ outcome, tokenIds });
  } catch (error) { console.warn("Animater | dispel skipped", error); }
};
const announceDispel = (found) => {
  if (!found) return;
  const data = dispelMessage(found, { sender: clientId, userId: game.user.id, sceneId: canvas?.scene?.id ?? null, at: Date.now() });
  try { game.socket.emit(`module.${ID}`, data); } catch (error) { console.warn("Animater | dispel not sent", error); }
  handleDispel(found);
};
const receiveDispel = (data, senderId) => receiveDispelData(data, senderId, { sceneId: canvas?.scene?.id ?? null, handle: handleDispel });
Hooks.on("createSequencerEffect", (effect) => { try { if (lastingAnimaterEffect(effect)) dispelLasting.add(effect); } catch { /* not ours */ } });
Hooks.on("endedSequencerEffect", (effect) => {
  try {
    if (!dispelLasting.delete(effect) && !lastingAnimaterEffect(effect)) return;
    if (dispelCandidate(effect) && dispelOn() && dispelWindow.shatters(effect.data)) shatterEffect(effect);
  } catch (error) { console.warn("Animater | dispel shatter skipped", error); }
});
Hooks.on("canvasTearDown", () => { shatterHost.clear(); dispelFlicker.clear(); dispelWindow.clear(); dispelLasting.clear(); dispelShattered = new WeakSet(); try { shatterRoot?.destroy({ children: true }); } catch { /* canvas gone */ } shatterRoot = null; });
Hooks.on("canvasReady", () => {
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  if (!ticker || !P || dispelTicker === ticker) return;
  dispelTicker = ticker;
  ticker.add(() => {
    try {
      // A lasting effect that starts its fade while a dispel is open shatters now, not after the fade.
      if (dispelLasting.size && dispelWindow.isOpen() && dispelOn())
        for (const effect of dispelLasting) if (effect._isEnding && !dispelShattered.has(effect) && dispelCandidate(effect) && dispelWindow.shatters(effect.data)) shatterEffect(effect);
      shatterHost.tick(); dispelFlicker.tick();
    } catch { /* never stop the canvas */ }
  }, undefined, P.NORMAL);
});
// PF2e/SF2e: the author's client reads its own counteract check (every client sees the message; one speaks).
Hooks.on("createChatMessage", (message) => {
  const system = game.system?.id;
  if (!["pf2e", "sf2e"].includes(system) || (message?.author?.id ?? message?.user?.id) !== game.user.id) return;
  try { announceDispel(twoeCounteract(message, system, { targets: idsOfTokens(game.user.targets) })); } catch (error) { console.warn("Animater | counteract skipped", error); }
});
// D&D 5e: casting Dispel Magic or Counterspell succeeds; the caster's ability check against a DC soon after (higher
// level magic) succeeds again or fails.
const dnd5eDispels = createDnd5eDispels();
Hooks.on("dnd5e.postUseActivity", (activity) => {
  try {
    if (!dnd5eDispelSpell(activity)) return;
    announceDispel(dnd5eDispels.cast((activity.actor ?? activity.item?.actor)?.id, idsOfTokens(game.user.targets)));
  } catch (error) { console.warn("Animater | dispel skipped", error); }
});
Hooks.on("dnd5e.rollAbilityCheck", (rolls, data) => {
  try { announceDispel(dnd5eDispels.check(data?.subject?.id, rolls)); } catch (error) { console.warn("Animater | dispel check skipped", error); }
});
// canvas.app (and its ticker) survives scene changes; time each frame's work once per ticker: from before
// every other listener to after the canvas render (PIXI's Application renders at UPDATE_PRIORITY.LOW).
let adaptiveTicker = null;
Hooks.on("canvasReady", () => {
  adaptiveHost.onCanvasReady(performance.now());
  for (const doc of canvas?.scene?.tokens ?? []) summonsLights.onToken(doc);
  const ticker = canvas?.app?.ticker, P = globalThis.PIXI?.UPDATE_PRIORITY;
  if (ticker && P && adaptiveTicker !== ticker) {
    adaptiveTicker = ticker;
    ticker.add(() => adaptiveHost.onFrameStart(performance.now()), undefined, P.HIGH + 2);
    ticker.add(() => { try { summonsLights.tick(); } catch { /* never stop the canvas */ } lightHost.tick(); }, undefined, P.NORMAL);
    ticker.add(() => { markLayer.tick(); markReactions.tick(); }, undefined, P.NORMAL);
    // The shake moves the stage first, so the distortion reads the view this frame renders.
    ticker.add(() => cameraShake.tick(), undefined, P.NORMAL);
    ticker.add(() => distortionHost.tick(), undefined, P.NORMAL);
    ticker.add(() => adaptiveHost.onFrameEnd(performance.now()), undefined, P.UTILITY);
  }
});
// The next combatant's likely files load ahead on every client, one turn early.
Hooks.on("updateCombat", (combat, changed) => { if ("turn" in (changed ?? {}) || "round" in (changed ?? {})) adaptiveHost.onTurn(combat); });
tokenFx.custom = () => { try { return hotSetting('tokenFxPresets') ?? []; } catch { return []; } };
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
  clone(hotSetting("recipes")?.recipes ?? starterRecipes());
const playerDecisions = () => hotSetting("playerApprovals") ?? {};
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
const enabled = () => hotSetting("automatic");
// Players' approved recipes play for their own characters even when the GM's
// automatic playback is off.
const ownApprovedRecipe = (event) => game.user?.isGM ? null : approvedPlayerRecipe(event, ownPlayerRecipes(), playerDecisions()[game.user.id], { owns: (actor) => Boolean(actor?.isOwner) });
const hasOwnApproved = () => !game.user?.isGM && ownPlayerRecipes().some((r) => approvalState(r, playerDecisions()[game.user.id]) === "approved");
const acceptsEvents = () =>
  enabled() ||
  (game.system.id === "sf2e" && SF_KINDS.some(kind=>{const state=hotSetting(sfSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === 'dnd5e' && DND_KINDS.some(kind=>{const state=hotSetting(dndSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === 'daggerheart' && DH_KINDS.some(kind=>{const state=hotSetting(dhSettingKey(kind));return state?.enabled&&state.independent;})) ||
  (game.system.id === "pf2e" &&
    ["spellCatalog", "featCatalog", "actionCatalog", "featureCatalog", "weaponCatalog"].some((key) => {
      const state = hotSetting(key);
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
      .filter((id) => game.modules.get(id)?.active && !(id === AA_ID && (aaTakeover() || aaFillGaps())) && !(id === TA_ID && (taTakeover() || taFillGaps())))
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
  if (hotSetting(WAIT_FOR_DICE) === false) return;
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
      const { Workspace } = await import("./ui/workspace.mjs");
      if (this.rendered === false || root !== this.element.querySelector(".an-root")) return;
      if (this.workspace?.root === root) return;
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
// Action sheets open the owner's catalog; other items keep their direct custom
// recipe shortcut, or their normal spell/weapon/effect catalog.
async function openForItem(item) {
  if (!game.user.isGM || !item) return;
  const action = ['pf2e','sf2e'].includes(game.system.id) && item.type === 'action';
  const npcAction = item.actor?.type === 'npc' && (action || game.system.id==='dnd5e' && item.type==='feat');
  let recipe = null;
  if (!action && !npcAction) try { recipe = resolveEvent({ type: "use", item, actor: item.actor, systemId: game.system.id }); } catch {}
  const saved = recipe && recipes().find((r) => r.id === recipe.id);
  await open();
  const w = app?.workspace;
  if (!w) return;
  // An NPC's "Slow (2/day)" is the catalog's "Slow".
  let entry = saved ? null : catalogEntryFor(item);
  if (npcAction) {
    const event = {type:'use',item,actor:item.actor,systemId:game.system.id};
    entry = game.system.id==='dnd5e'?dndNpcAbilities.findDndNpcAction(event):game.system.id==='sf2e'?sfNpcAbilities.findSfNpcAction(event):npcAbilities.findNpcCatalogAction?.(event);
    if (!entry && game.system.id!=='dnd5e') { const shared = npcAbilities.findNpcAbility?.(event); if (shared) entry = {id:shared.id,name:shared.names[0]}; }
  }
  const page = npcAction ? 'npc-abilities' : itemPage(item);
  if (!w.reveal(saved ? { recipeId: saved.id } : { page, name: entry?.name ?? item.name.replace(/\s*\([^)]*\)\s*$/, ""), id: entry?.id })) w.message = `No Animater catalog covers ${item.name}; make a recipe for it with + New recipe.`;
  w.render();
}
// Teleport (recipes that ask for it): pick the spot on the canvas, then vanish and reappear.
const placeable = (t) => t?.object ?? t;
async function pickTeleport(recipe, context) {
  if (!hotSetting(TELEPORT_TOKENS)) return null;
  const plan = teleportPlan(recipe);
  if (!plan) return null;
  const caster = placeable(context.source), mover = plan.who === "target" ? placeable(context.targets?.[0]) : caster;
  if (!caster?.center) return null;
  if (plan.fetch) return fetchSpots(recipe, context, caster);
  if (!mover?.center) { ui.notifications.warn("Teleport: target the creature to move first."); return null; }
  const feet = plan.adjacent ? 5 : plan.range || itemRangeFeet(context.item) || Infinity;
  ui.notifications.info(`Teleport ${mover.name}: click a spot${Number.isFinite(feet) ? ` within ${feet} feet` : ""} (Esc to cancel).`);
  const spot = await pickTeleportSpot({ caster, mover, feet, notify: (text) => ui.notifications.warn(text) });
  return spot ? { mover, caster, ...spot, visuals: teleportVisuals(recipe, runtime.getCatalog()), element: context.element ?? recipe.chosenElement } : null;
}
// Friendfetch: no pick. Each target (up to 2) is dragged straight toward the caster, to the closest free space on
// that line short of any wall (engines/motion/fetch-path.mjs), and slides there. One with no closer free space stays.
const FETCH_LIMIT = 2;
function fetchSpots(recipe, context, caster) {
  const targets = (context.targets ?? []).map(placeable).filter((t) => t?.document && t !== caster).slice(0, FETCH_LIMIT);
  if (!targets.length) { ui.notifications.warn("Friendfetch: target the creatures to bring to you first."); return null; }
  const box = (t) => ({ id: t.document.id, x: t.document.x, y: t.document.y, w: t.w, h: t.h });
  const level = caster.document?.level;
  const tokens = canvas.tokens.placeables.filter((t) => t.document && (level === undefined || t.document.level === undefined || t.document.level === level)).map(box);
  const blocked = (from, to) => Boolean(CONFIG.Canvas.polygonBackends?.move?.testCollision?.(from, to, { type: "move", mode: "any" }));
  const snap = (point, target) => targets.find((t) => t.document.id === target.id)?.getSnappedPosition?.(point) ?? point;
  const landings = fetchLandings({ caster: box(caster), targets: targets.map(box), tokens, snap, blocked, gridSize: canvas.grid.size });
  const visuals = teleportVisuals(recipe, runtime.getCatalog()), element = context.element ?? recipe.chosenElement;
  return landings.map((spot) => ({ mover: targets.find((t) => t.document.id === spot.id), caster, x: spot.x, y: spot.y, slide: true, visuals, element }));
}
// Big magic bends the scene (world setting); on while the setting is not registered.
function mapDistortion() { try { return hotSetting("mapDistortion") !== false; } catch { return true; } }
// `slide` (ms): Foundry's own move animation over that long (a fetch dragged along its line), else a jump.
// The spot is already chosen clear: no walls, terrain cost or tokens in between stop it (D&D 5e's full movement
// automation otherwise halts it beside the first hostile token on the line).
const SLIDE_MS = 500, SLIDE_MAX_MS = 3000;
const TELEPORT_CONSTRAIN = { ignoreWalls: true, ignoreCost: true, ignoreTokens: true };
async function moveToken(doc, x, y, slide = 0) {
  const options = { animater: { teleport: true }, constrainOptions: TELEPORT_CONSTRAIN, showRuler: false };
  await doc.update({ x, y }, slide > 0 ? { ...options, animation: { duration: slide } } : { ...options, animate: false });
}
// What a teleport's effects play through. `local`: a preview, on this screen only, with no streak.
function teleportHost({ local = false } = {}) {
  return {
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    mapDistortion,
    gridSize: () => canvas.grid?.size ?? 100,
    // `data` (the departure's vanish, the arrival's afterimage streak, either end's warp) rides on the effect to
    // every client; the streak only while the world has trails on.
    effect: (asset, point, size, tint, data = null) => {
      const effect = new Sequence({ moduleName: ID }).effect().file(asset).atLocation(point).size(size);
      if (tint) effect.tint(tint);
      const { animaterTrail, ...rest } = data ?? {};
      const tags = { ...rest, ...(animaterTrail && !local && hotSetting("afterimages") !== false ? { animaterTrail } : {}) };
      if (Object.keys(tags).length) effect.addOverride(async (_, effectData) => ({ ...effectData, ...tags }));
      void effect.play(local ? { local: true } : {}).catch(error => console.warn('Animater teleport effect:', error.message));
    },
    // A preview's token never moves: a copy of its art lands at the spot, holds, and fades as the token comes back.
    move: local ? async (mover, x, y) => previewLanding(mover, x, y) : async () => {},
    ...(local ? { vanishGrace: 0, holdMs: PREVIEW_HOLD_MS } : {}),
  };
}
// A preview's teleport: the token vanishes and a copy of it appears three squares off (toward its target), on this
// screen only; the document never moves.
const PREVIEW_HOLD_MS = 1200, PREVIEW_FADE_MS = 300;
function previewTeleport(mover, recipe, context, timing) {
  const token = placeable(mover);
  if (!token?.center || !token.document) return null;
  const visuals = teleportVisuals(recipe, runtime.getCatalog());
  const target = (context.targets ?? []).map(placeable).find((t) => t?.center && t !== token);
  const spot = previewSpot(token, { gridSize: canvas.grid?.size ?? 100, bounds: canvas.dimensions?.sceneRect ?? null, toward: target?.center ?? null });
  return playTeleport({ mover: token, x: spot.x, y: spot.y, visuals, element: context.element ?? recipe.chosenElement }, teleportHost({ local: true }), timing);
}
// The copy a preview lands: the token's art at (x, y), in at once, held, then faded out and removed.
function previewLanding(token, x, y) {
  const mesh = token?.mesh;
  if (!mesh?.texture || mesh.destroyed) return;
  const copy = new PIXI.Sprite(mesh.texture);
  copy.anchor.set(mesh.anchor?.x ?? 0.5, mesh.anchor?.y ?? 0.5);
  copy.scale.set(mesh.scale.x, mesh.scale.y);
  copy.rotation = mesh.rotation;
  copy.position.set(x + token.w / 2, y + token.h / 2);
  placeUnder(copy, mesh);
  copy.zIndex = (mesh.zIndex ?? 0) + 1;
  const start = performance.now();
  const step = () => {
    if (copy.destroyed) return;
    const fade = performance.now() - start - PREVIEW_HOLD_MS;
    if (fade >= PREVIEW_FADE_MS || !copy.parent) { copy.destroy(); return; }
    copy.alpha = fade > 0 ? 1 - fade / PREVIEW_FADE_MS : 1;
    requestAnimationFrame(step);
  };
  step();
}
// Only the move: from the token's document alone, so it works after the canvas is gone (a stopped play).
// A creature this player does not own (an ally fetched to them) is moved by the active GM.
async function placeTeleport(spot) {
  const doc = spot?.mover?.document;
  if (!doc) return;
  const slide = spot.slide ? (Number(spot.slide) > 1 ? Number(spot.slide) : SLIDE_MS) : 0;
  if (doc.isOwner) await moveToken(doc, spot.x, spot.y, slide);
  else game.socket.emit(`module.${ID}`, { type: "teleport", sender: clientId, userId: game.user.id, uuid: doc.uuid, casterUuid: spot.caster?.document?.uuid, x: spot.x, y: spot.y, slide });
}
// A fetch slides over its stage's length, with no departure or arrival effects.
async function teleport(spot, timing) {
  if (spot.slide) return placeTeleport({ ...spot, slide: Math.max(1, timing?.goneMs || SLIDE_MS) });
  return playTeleport(spot, { ...teleportHost(), move: (mover, x, y) => placeTeleport({ ...spot, mover, x, y }) }, timing);
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
  await moveToken(doc, data.x, data.y, Math.min(SLIDE_MAX_MS, Math.max(0, Number(data.slide) || 0)));
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
  if (defeated === true) await markDefeated(doc.actor, hotSetting(DEFEATED_LOOK));
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
const crossoverOn = () => hotSetting(CROSSOVER_CATALOG) === true;
// A PF2e world shows (and so manages) the SF2e catalogs it borrows.
const borrowsSfPages = () => game.system.id === "pf2e" && crossoverOn();
// The other 2e system whose catalogs this world shows and plays (crossover on), or null.
const borrowedSystemId = () => (crossoverOn() ? crossoverSystem(game.system.id) : null);
async function seedBorrowedCatalogs() {
  const other = borrowedSystemId();
  if (!other || !game.user.isGM || !(game.users.activeGM?.isSelf ?? true)) return;
  for (const kind of TWOE_KINDS) {
    const key = twoeSettingKey(other, kind), seeded = seedBorrowedState(hotSetting(twoeSettingKey(game.system.id, kind)), hotSetting(key));
    if (seeded) await game.settings.set(ID, key, other === "sf2e" ? normalizeSfCatalogState(seeded) : seeded);
  }
}
const catalogKeys = () => [...(CATALOG_KINDS[game.system.id] ?? []), ...(borrowedSystemId() ? TWOE_KINDS.map((kind) => twoeSettingKey(borrowedSystemId(), kind)) : [])].filter((key) => game.settings.settings.has(`${ID}.${key}`));
const catalogOn = (key) => { const s = hotSetting(key) ?? {}; return s.enabled === true && (s.scope ?? "all") === "all"; };
function catalogsOn() { const keys = catalogKeys(); return { on: keys.filter(catalogOn).length, total: keys.length }; }
async function useEveryCatalog() {
  if (!game.user.isGM) throw Error("Only a GM can turn catalogs on.");
  for (const key of catalogKeys()) await game.settings.set(ID, key, { ...(hotSetting(key) ?? {}), enabled: true, scope: "all", independent: true, preferCatalog: true });
  if (!hotSetting("automatic")) await game.settings.set(ID, "automatic", true);
  persistentStates?.schedule();
  return catalogsOn();
}
// Once per world, on first load as the active GM: offer to turn every catalog on (only when
// none is on yet, so a table that already chose its catalogs is never asked).
async function welcome() {
  if (!game.user.isGM || !(game.users.activeGM?.isSelf ?? true) || hotSetting("welcomed")) return;
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
  const state=normalizeSfCatalogState(hotSetting(sfSettingKey(entry.kind))),variant=entry.variants.find(v=>v.recipe.id===id);
  return sfRecipe(entry,variant?.id,{motion:state.motion,sounds:state.sound?installedSoundCatalog(game.modules,globalThis.Sequencer?.Database):null,soundVolume:state.soundVolume,catalog:runtime.getCatalog()});
 }
 if(sys==='dnd5e') {
  const entry=dndEntry(id)??dndEntries().find(e=>e.variants.some(v=>v.recipe.id===id));
  if(!entry)return null;
  const variant=entry.variants.find(v=>v.recipe.id===id),state=normalizeDndCatalogState(hotSetting(dndSettingKey(entry.kind)));
  return dndRecipe(entry,variant?.id,{motion:state.motion,sounds:state.sound?installedSoundCatalog(game.modules,globalThis.Sequencer?.Database):null,soundVolume:state.soundVolume});
 }
 if(sys==='daggerheart'){
  const entry=dhEntry(id)??dhEntries().find(e=>e.variants.some(v=>v.recipe.id===id));
  if(!entry)return null;
  const variant=entry.variants.find(v=>v.recipe.id===id),state=normalizeDhCatalogState(hotSetting(dhSettingKey(entry.kind)));
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
        (catalogWeapon(id) && weaponRecipe(catalogWeapon(id), /-(melee|ranged|thrown)$/.exec(id)?.[1], { motion: hotSetting("weaponCatalog")?.motion !== false, soundCatalog: hotSetting("weaponCatalog")?.sound === false ? null : installedSoundCatalog(game.modules, globalThis.Sequencer?.Database), soundVolume: hotSetting("weaponCatalog")?.soundVolume })) ??
        Object.entries(ABILITY_CATALOGS).map(([key,catalog])=>catalog.entry(id)&&catalog.recipe(catalog.entry(id),hotSetting(key)??{},installedSoundCatalog(game.modules,globalThis.Sequencer?.Database))).find(Boolean) ??
        (catalogFeat(id) &&
          featRecipe(catalogFeat(id), {
            motion: hotSetting("featCatalog")?.motion !== false,
            soundVolume: hotSetting("featCatalog")?.soundVolume,
            soundCatalog: hotSetting("featCatalog")?.sound === false ? null : installedSoundCatalog(
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
      let on = true; try { on = hotSetting('tuckDuringPlayback') !== false; } catch {}
      if (!on || !app?.rendered || app.minimized) return null;
      await app.minimize();
      return async () => { if (app?.rendered && app.minimized) await app.maximize(); };
    },
    mediaPreferences:()=>libraryPreferences(hotSetting('mediaLibrary')),
    setMediaPreferences:value=>game.settings.set(ID,'mediaLibrary',libraryPreferences(value)),
    mediaCatalog:()=>mediaLibraryLoader.peek(),
    loadMediaCatalog:(refresh,onProgress)=>mediaLibraryLoader.load(refresh,onProgress),
    sfCatalogState:kind=>normalizeSfCatalogState(hotSetting(sfSettingKey(kind))),
    setSfCatalogState:async(kind,change)=>{
      if(!game.user.isGM||!(game.system.id==="sf2e"||borrowsSfPages()&&TWOE_KINDS.includes(kind))||!SF_KINDS.includes(kind))throw Error("SF2e catalog configuration requires a GM in an SF2e world, or a PF2e world that uses the SF2e catalogs.");
      const key=sfSettingKey(kind);
      await game.settings.set(ID,key,normalizeSfCatalogState({...hotSetting(key),...change}));
      persistentStates?.schedule();
    },
    dndCatalogState:kind=>normalizeDndCatalogState(hotSetting(dndSettingKey(kind))),
    setDndCatalogState:async(kind,change)=>{
      if(!game.user.isGM||game.system.id!=='dnd5e'||!DND_KINDS.includes(kind))throw Error('D&D catalog configuration requires a GM in a D&D world.');
      const key=dndSettingKey(kind);
      await game.settings.set(ID,key,normalizeDndCatalogState({...hotSetting(key),...change}));
      persistentStates?.schedule();
    },
    dhCatalogState:kind=>normalizeDhCatalogState(hotSetting(dhSettingKey(kind))),
    setDhCatalogState:async(kind,change)=>{
      if(!game.user.isGM||game.system.id!=='daggerheart'||!DH_KINDS.includes(kind))throw Error('Daggerheart catalog configuration requires a GM in a Daggerheart world.');
      const key=dhSettingKey(kind);
      await game.settings.set(ID,key,normalizeDhCatalogState({...hotSetting(key),...change}));
      persistentStates?.schedule();
    },
    soundCatalog: () =>
      installedSoundCatalog(game.modules, globalThis.Sequencer?.Database),
    weaponScale: () => Number(hotSetting("weaponScale")) || 1,
    // Flash screens (GM): the library, defaults and playback for the editor page.
    ...(game.user.isGM ? {
      creatureShowcase: tokenId=>showcaseTools.snapshot(tokenId),
      // Damage immersion showcase: lens blood, tunnel vision and the heartbeat on the GM's own screen.
      damageShowcase: () => lensPreview?.snapshot() ?? { tokens: [], presets: {}, settings: {} },
      previewLensHit: (o) => lensPreview?.hit(o),
      previewLensDeal: (o) => lensPreview?.deal(o),
      previewLensLinger: (o) => lensPreview?.linger(o),
      previewLensDuel: (o) => lensPreview?.duel(o),
      previewLensWounded: (o) => lensPreview?.wounded(o),
      previewLensDown: (o) => lensPreview?.down(o),
      previewLensWake: (o) => lensPreview?.wake(o),
      stopLensPreview: () => lensPreview?.stop(),
      lensPreviewBusy: () => lensPreview?.busy() ?? false,
      previewCreatureMovement: tokenId=>showcaseTools.movement(tokenId),
      playBossEntrance: (tokenId,options)=>showcaseTools.playBoss(tokenId,options),
      stopBossEntrance: options=>{ app?.workspace?.creatureShowcase?.restoreBossWindow();return showcaseTools.stopBoss(options); },
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
    lastingMode: () => hotSetting("lastingMode"),
    defaultFinisher: () => hotSetting(DEFAULT_FINISHER) ?? "",
    players: () => game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, name: u.name, color: u.color?.css ?? u.color ?? "" })),
    // Players pick finishers only in pf2e-combater's item sheet: Available to shows only with it.
    playerPicks: () => game.modules.get("pf2e-combater")?.active === true,
    setDefaultFinisher: async (id) => {
      if (!game.user.isGM) throw Error("Only a GM can choose the default finisher.");
      await game.settings.set(ID, DEFAULT_FINISHER, String(id ?? ""));
    },
    // How the default finisher ends: "" as each finisher is made, or a FINISHER_ENDINGS key.
    defaultFinisherEnding: () => hotSetting(DEFAULT_FINISHER_ENDING) ?? "",
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
      const list=(hotSetting('tokenFxPresets')??[]).filter(p=>p.name!==title);
      await game.settings.set(ID,'tokenFxPresets',[...list,{name:title,params:clean}].slice(-200));
    },
    deleteTokenFxPreset:async name=>{
      if(!game.user.isGM)throw Error('Only a GM can delete Tokenshade presets.');
      await game.settings.set(ID,'tokenFxPresets',(hotSetting('tokenFxPresets')??[]).filter(p=>p.name!==name));
    },
    logs: () => runtime.log,
    isGM: () => game.user.isGM,
    // Activity page: lasting animations on the table now (runtime sessions + condition/effect layers).
    nowPlaying: () => nowPlayingRows(runtime?.runningAnimations() ?? [], persistentStates?.running() ?? []),
    stopAnimation: (row) => stopActivityRow(row),
    environment,
    enabled,
    catalogState: () =>
      normalizeCatalogState(hotSetting("spellCatalog")),
    setCatalogState: async (change) => {
      if (!game.user.isGM)
        throw Error("Only a GM can configure the spell catalog.");
      const current = hotSetting("spellCatalog");
      await game.settings.set(
        ID,
        "spellCatalog",
        normalizeCatalogState({ ...current, ...change }),
      );
    },
    featCatalogState: () =>
      normalizeFeatCatalogState(hotSetting("featCatalog")),
    setFeatCatalogState: async (change) => {
      if (!game.user.isGM)
        throw Error("Only a GM can configure the feat catalog.");
      const current = hotSetting("featCatalog");
      await game.settings.set(
        ID,
        "featCatalog",
        normalizeFeatCatalogState({ ...current, ...change }),
      );
    },
    actionCatalogState: () => PF2E_ACTION_CATALOG.normalizeState(hotSetting("actionCatalog")),
    setActionCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure the action catalog.");
      return game.settings.set(ID, "actionCatalog", PF2E_ACTION_CATALOG.normalizeState({ ...hotSetting("actionCatalog"), ...change }));
    },
    featureCatalogState: () => PF2E_FEATURE_CATALOG.normalizeState(hotSetting("featureCatalog")),
    setFeatureCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure the feature catalog.");
      return game.settings.set(ID, "featureCatalog", PF2E_FEATURE_CATALOG.normalizeState({ ...hotSetting("featureCatalog"), ...change }));
    },
    // The NPC abilities page: its three switches and the abilities left out.
    npcAbilityState: () => ({ abilities: hotSetting("npcAbilities") !== false, guess: hotSetting("npcAbilityGuess") !== false,
      strikes: hotSetting("npcStrikeGuess") !== false, excluded: [...(hotSetting("npcAbilityExcluded") ?? [])] }),
    setNpcAbilityState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure NPC abilities.");
      const keys = { abilities: "npcAbilities", guess: "npcAbilityGuess", strikes: "npcStrikeGuess", excluded: "npcAbilityExcluded" };
      for (const [field, value] of Object.entries(change)) if (keys[field]) await game.settings.set(ID, keys[field], field === "excluded" ? [...new Set(value)] : value === true);
    },
    weaponCatalogState: () => normalizeWeaponCatalogState(hotSetting("weaponCatalog")),
    setWeaponCatalogState: async (change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure weapon animations.");
      return game.settings.set(ID, "weaponCatalog", normalizeWeaponCatalogState({ ...hotSetting("weaponCatalog"), ...change }));
    },
    stateCatalogState: (kind) => normalizeStateCatalogState(hotSetting(kind === "condition" ? "conditionCatalog" : "effectCatalog")),
    setStateCatalogState: async (kind, change) => {
      if (!game.user.isGM) throw Error("Only a GM can configure persistent animations.");
      const key = kind === "condition" ? "conditionCatalog" : "effectCatalog";
      await game.settings.set(ID, key, normalizeStateCatalogState({ ...hotSetting(key), ...change }));
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
    stop: () => { app?.workspace?.creatureShowcase?.stop();if(game.user.isGM)showcaseTools?.stopBoss();return runtime.stop(); },
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
  registerSetting('mediaLibrary',{scope:'client',config:false,type:Object,default:libraryPreferences()});
  registerSetting('tokenFxPresets',{scope:'world',config:false,type:Array,default:[],onChange:()=>app?.workspace?.render()});
  for(const [key,name,hint] of [
    ['catalogTokenFx','Tokenshade filters in catalog animations','Catalog animations add matching shader effects on the token itself (flames, frost, glows, shimmer). Drawn by Animater on each screen; nothing is saved to the token.'],
    ['catalogSceneFx','FXMaster scene effects in catalog animations','When FXMaster is active, weather-like catalog spells add brief scene effects (rain, fog, embers). Skipped automatically when the module is missing.']])
    registerSetting(key,{name,hint,scope:'world',config:true,type:Boolean,default:true,
      onChange:()=>{persistentStates?.schedule();app?.workspace?.render();}});
  registerSetting('conditionLooks',{name:'Condition looks',
    hint:'How catalog conditions show on a creature. Tokenshade: a quiet look on the creature itself. JB2A: the condition’s JB2A animation only, with no Tokenshade filters. Also set from each conditions catalog in Animater.',
    scope:'world',config:true,type:String,choices:{tokenshade:'Tokenshade',jb2a:'JB2A'},default:'tokenshade',
    onChange:()=>{persistentStates?.schedule();app?.workspace?.render();}});
  registerSetting('weaponScale',{name:'Weapon effect size',hint:'Multiplies the size of weapon hit and residue effects (1 = the target token\'s footprint).',
    scope:'world',config:true,type:Number,range:{min:0.5,max:3,step:0.1},default:1.5});
  registerSetting(RUNE_SETTING,{name:'Weapon rune flourishes',hint:'Catalog weapon Strikes show each weapon’s runes: potency adds a glint, striking a bigger hit, and each property rune (flaming, frost, shock, holy…) its own accent on a hit. Saved recipes are never changed.',
    scope:'world',config:game.system.id==='pf2e',type:Boolean,default:true});
  registerSetting('showControlButton',{name:'Show Animater scene control button',
    hint:'Shows the Animater button in the token controls. Turn off to hide it; Alt+Shift+A still opens Animater.',
    scope:'client',config:true,type:Boolean,default:true,onChange:()=>ui.controls?.render()});
  // On for GMs, off for players: game.user does not exist yet at init, the world's user data does.
  registerSetting('hoverExplain',{name:'Explain animations on hover',
    hint:'Hovering a token shows what Animater is playing on it right now: each animation\'s name, whether it comes from a catalog or a recipe, and whether it lasts.',
    scope:'client',config:true,type:Boolean,default:hoverExplainDefault(game),onChange:()=>hoverExplain.refresh()});
  // Every Animater setting but the animation quality, by topic, in one window (ui/settings-window.mjs).
  game.settings.registerMenu(ID,'settingsWindow',{name:'Animater settings',label:'Animater settings',icon:'fa-solid fa-sliders',
    hint:'All of Animater\'s settings by topic, with a search. Each feature\'s switch for everyone (GM) sits beside its own switch for your screen.',
    type:settingsWindow(ApplicationV2,{id:ID}),restricted:false});
  // The hit sounds engine: one menu (Hit sounds) holds its world switch and each device's mix (ui/hit-sounds-settings.mjs).
  game.settings.registerMenu(ID,'hitSoundsMenu',{name:'Hit sounds',label:'Hit sounds',icon:'fa-solid fa-volume-high',
    hint:'Weapon hits that sound like what they land on, and how you hear them: on or off, volume, blood, echo, and hearing hits where they happen.',
    type:hitSoundsMenu(ApplicationV2,{id:ID}),restricted:false});
  // Blood colours by creature type when Splatter is not deciding (ui/blood-colors-settings.mjs; engines/motion/blood-colors.mjs).
  game.settings.registerMenu(ID,'bloodColorsMenu',{name:'Blood colours',label:'Blood colours',icon:'fa-solid fa-droplet',
    hint:'What each creature type bleeds on the lens, on the ground and in the damage showcase: its colour, or no blood at all. A token can have its own (Token configuration). With Splatter active, its Blood Sheet decides instead.',
    type:bloodColorsMenu(ApplicationV2,{id:ID}),restricted:true});
  registerSetting(BLOOD_SETTING,{name:'Blood colours',scope:'world',config:false,type:Object,default:{},
    onChange:()=>{ for (const key of [...feelGaits.keys()]) if (key.startsWith('blood|')) feelGaits.delete(key); }});
  registerSetting(SURFACE_SETTING,{name:'Weapon surface sounds',scope:'world',config:false,type:Boolean,default:true,onChange:()=>app?.workspace?.render()});
  registerSetting('hitSounds',{name:'Hit sounds on this device',scope:'client',config:false,type:Boolean,default:true});
  registerSetting('surfaceVolume',{name:'Surface sounds volume',scope:'client',config:false,type:Number,range:{min:0,max:1,step:0.05},default:1});
  registerSetting('surfaceGore',{name:'Blood sounds',scope:'client',config:false,type:String,choices:{full:'Full',subtle:'Subtle',off:'Off'},default:'full'});
  registerSetting('surfaceEcho',{name:'Surface echo',scope:'client',config:false,type:Number,range:{min:0,max:1.5,step:0.1},default:1});
  registerSetting('surfaceSpace',{name:'Hear hits where they happen',scope:'client',config:false,type:Boolean,default:true});
  registerSetting('tuckDuringPlayback',{name:'Minimize Animater during canvas playback',
    hint:'Local preview and Play at table minimize the Animater window while the animation runs, then restore it.',
    scope:'client',config:true,type:Boolean,default:true});
  registerSetting('quality',{name:'Animation quality (this device)',
    hint:'Lower this on slower computers. Applies only to what you see; other players keep their own setting.',
    scope:'client',config:true,type:String,choices:{...QUALITY_CHOICES},default:'full',
    onChange:()=>{syncQuality();persistentStates?.schedule();markLayer.refresh();rewarmShaders();}});
  registerSetting('lastingMode',{name:'Lasting condition animations (this device)',
    hint:'How lasting conditions and effects show on your screen. "Follow the catalog setting" uses each catalog\'s Lasting animation switch in Animater. "On application and at its turn start" plays them when applied and again briefly whenever that creature\'s turn starts in combat. The Defeated look keeps its own setting. Each player\'s choice affects only their screen.',
    scope:'client',config:true,type:String,choices:{...LASTING_MODES},default:'world',onChange:()=>persistentStates?.schedule()});
  registerSetting(CROSSOVER_CATALOG,{...crossoverSettingText(game.system.id),scope:'world',
    // PF2e and SF2e only: the two systems share one rules engine.
    config:Boolean(crossoverSystem(game.system.id)),type:Boolean,default:false,
    onChange:()=>{void seedBorrowedCatalogs().finally(()=>{persistentStates?.schedule();app?.workspace?.render();});}});
  for(const kind of SF_KINDS)registerSetting(sfSettingKey(kind),{scope:"world",config:false,type:Object,default:normalizeSfCatalogState(),onChange:()=>persistentStates?.schedule()});
  for(const kind of DND_KINDS)registerSetting(dndSettingKey(kind),{scope:'world',config:false,type:Object,default:normalizeDndCatalogState(),onChange:()=>persistentStates?.schedule()});
  for(const kind of DH_KINDS)registerSetting(dhSettingKey(kind),{scope:'world',config:false,type:Object,default:normalizeDhCatalogState(),onChange:()=>persistentStates?.schedule()});
  for (const key of ["conditionCatalog", "effectCatalog"])
    registerSetting(key, { scope: "world", config: false, type: Object, default: normalizeStateCatalogState(), onChange: () => persistentStates?.schedule() });
  registerSetting("weaponCatalog", { scope: "world", config: false, type: Object, default: normalizeWeaponCatalogState() });
  for (const [key, catalog] of Object.entries(ABILITY_CATALOGS))
    registerSetting(key, { scope: "world", config: false, type: Object, default: catalog.normalizeState() });
  registerSetting("featCatalog", {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeFeatCatalogState(),
  });
  registerSetting("spellCatalog", {
    scope: "world",
    config: false,
    type: Object,
    default: normalizeCatalogState(),
  });
  // The GM's decisions on player-made recipes (players cannot write world settings).
  registerSetting("playerApprovals", { scope: "world", config: false, type: Object, default: {}, onChange: () => app?.workspace?.render() });
  registerSetting("recipes", {
    scope: "world",
    config: false,
    type: Object,
    default: { schema: 1, recipes: starterRecipes() },
  });
  registerSetting(WAIT_FOR_DICE, {
    name: "Wait for Dice So Nice",
    hint: "Attack and damage animations start when the 3D dice for that roll have landed, so a hit or miss plays after you see the result.",
    scope: "client",
    // Listed only where Dice So Nice is active; elsewhere there is nothing to wait for.
    config: Boolean(game.modules.get("dice-so-nice")?.active),
    type: Boolean,
    default: true,
  });
  registerSetting(AA_TAKEOVER, {
    name: "Take over from Automated Animations when Animater has an animation",
    hint: "Automated Animations skips items Animater animates. Items customized in Automated Animations stay with it. If “Only animate what Automated Animations doesn't” is also on, that one wins.",
    scope: "world",
    // Only worth listing where Automated Animations is active in this world.
    config: Boolean(game.modules.get(AA_ID)?.active),
    type: Boolean,
    default: true,
  });
  registerSetting(AA_FILL_GAPS, {
    name: "Only animate what Automated Animations doesn't",
    hint: "Items Automated Animations animates (by its Automatic Recognition or a customized item) stay with it; Animater animates the rest. Items turned off in Automated Animations play Animater's animation.",
    scope: "world",
    // Listed only where Automated Animations is active; elsewhere there are no gaps to fill.
    config: Boolean(game.modules.get(AA_ID)?.active),
    type: Boolean,
    default: false,
  });
  registerSetting(TA_TAKEOVER, {
    name: "Take over from Trigger Animations when Animater has an animation",
    hint: "Trigger Animations skips attacks, actions, areas, effects and conditions Animater animates, its wildcard triggers and Trove's included. A trigger made for that very item (naming its UUID) stays with it. If “Only animate what Trigger Animations doesn't” is also on, that one wins.",
    scope: "world",
    // Listed only where Trigger Animations is active.
    config: Boolean(game.modules.get(TA_ID)?.active),
    type: Boolean,
    default: false,
  });
  registerSetting(TA_FILL_GAPS, {
    name: "Only animate what Trigger Animations doesn't",
    hint: "Items a Trigger Animations trigger names (attack:longsword, template:fireball, condition:frightened, or the item's UUID) stay with it; Animater animates the rest. Wildcard triggers such as damage:* don't count.",
    scope: "world",
    // Listed only where Trigger Animations is active.
    config: Boolean(game.modules.get(TA_ID)?.active),
    type: Boolean,
    default: false,
  });
  registerSetting(MOTION_PRIORITY, {
    name: "Animater's token motions come first",
    hint: "While Animater moves a token (a finisher or attack, a condition's trembling or swaying, a look that rocks it), other modules' passing Sequencer motions on that token don't play, such as PF2e RPG Numbers' damage shake. Off: both play, and the token can jitter between them.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  registerSetting("automatic", {
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
  registerSetting(DUALITY_ACCENT, {
    name: "Hope/Fear accent",
    hint: "Daggerheart: a duality roll with Hope adds a short gold glint on the roller's token, one with Fear a dark purple wisp, beside the item's own animation. Critical successes keep their own crit visuals.",
    scope: "world", config: game.system.id === "daggerheart", type: Boolean, default: true,
  });
  registerSetting("effectLighting", {
    name: "Effect lighting",
    hint: "Fire, lightning and other glowing effects light up the scene around them while they play (lasting areas and auras until they end), blocked by walls like any light.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("effectLightingDaylight", {
    name: "Effect lighting in daylight",
    hint: "Also add a soft coloured glow around effects in fully lit scenes.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting(LIGHT_REVEALS, {
    name: "Effect light reveals creatures (PF2e Visioner, homebrew)",
    hint: "For PF2e Visioner's auto-visibility only. When on, a creature lit by a spell's light (a Fireball in a dark room) counts as lit, so anyone with line of sight can see it for that moment. Not the rules: most spells don't shed light. Off, Visioner ignores effect lights. Needs PF2e Visioner 8.14.12 or later; without Visioner this does nothing.",
    // Listed only where PF2e Visioner runs: elsewhere it would do nothing.
    scope: "world", config: Boolean(game.modules.get("pf2e-visioner")?.active), type: Boolean, default: false,
  });
  registerSetting("effectLightAnimation", {
    name: "Flickering and flashing effect lights",
    hint: "Turn off to see effect lights as a steady glow, without flicker or strobe.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  // Lights are planned by the client that plays the effect (the world switches) and drawn by each client: this one
  // stops only the drawing here.
  registerSetting("effectLightingLocal", {
    name: "Effect lighting on my screen",
    hint: "Turn off to never light the scene from Animater's effects on this screen.",
    scope: "client", config: false, type: Boolean, default: true,
    onChange: (on) => effectLightsHere(on),
  });
  registerSetting("projectileWalls", {
    name: "Projectiles stop at walls",
    hint: "Arrows, bolts and thrown weapons strike walls instead of passing through; a hit aims at the part of the target the shooter can see.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("hidePrivateResults", {
    name: "Hide the result of private GM rolls",
    hint: "A GM's private attack or save animates without showing whether it hit or missed: the shot flies at the target and nothing lands. Off: private rolls animate their real result, like public ones (the numbers stay private either way).",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: (on) => setHidePrivateResults(on),
  });
  setHidePrivateResults(hotSetting("hidePrivateResults"));
  registerSetting("groundMarks", {
    name: "Ground marks",
    hint: "Fire, frost, acid and other elemental hits leave a fading mark on the floor where they landed. Marks are drawn on each screen and never saved.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("groundMarkMinutes", {
    name: "Ground mark lifetime (minutes)",
    hint: "How long a ground mark stays before it is gone: fully visible for the first 40%, then fading. 0 keeps marks until the scene changes or the page reloads.",
    scope: "world", config: true, type: Number, range: { min: 0, max: 60, step: 1 }, default: 5,
    onChange: () => markLayer.refresh(),
  });
  registerSetting("groundMarksLocal", {
    name: "Ground marks on my screen",
    hint: "Turn off to never draw ground marks on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    // Turning it off wipes the marks already on the floor.
    onChange: () => markLayer.refresh(),
  });
  registerSetting("elementReactions", {
    name: "Element reactions",
    hint: "A new ground mark that lands on an older one can react: fire on frost puffs steam and melts it, frost on a scorch hisses out in smoke, fire on poison flares, lightning on acid arcs to the creatures standing in it, and acid on frost sizzles. Drawn on each screen that shows ground marks.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (!on) markReactions.clear(); },
  });
  registerSetting("elementReactionsLocal", {
    name: "Element reactions on my screen",
    hint: "Turn off to never draw element reactions (steam, smoke, flares, arcs) on this screen.",
    scope: "client", config: false, type: Boolean, default: true,
    onChange: (on) => { if (on === false) markReactions.clear(); },
  });
  registerSetting("afterimages", {
    name: "Afterimage trails",
    hint: "Charges, leaps, knockbacks and teleports that Animater plays leave a brief trail of ghost copies behind the token.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("afterimagesLocal", {
    name: "Afterimages on my screen",
    hint: "Turn off to never draw afterimage trails on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    // Off: the ghosts already drawn go at once.
    onChange: (on) => { if (on === false) motions?.afterimages?.clear(); },
  });
  registerSetting("movementFeel", {
    name: "Movement effects",
    hint: "Moving tokens kick up dust on dirt, grass, sand and snow, ripple water and faintly scuff stone and wood; fliers cast a soft shadow on the ground. Set each scene's floor in its configuration. Footprint lifetimes below are separate for each ground (0 = natural fading). Drawn on each screen and never saved.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) movementFeel.clear(); },
  });
  registerSetting("movementFeelLocal", {
    name: "Movement effects on my screen",
    hint: "Turn off to never draw movement dust, ripples or flier shadows on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) movementFeel.clear(); },
  });
  for (const [floor,key] of Object.entries(FOOTPRINT_LIFETIME_KEYS)) registerSetting(key, {
    name: `${floor[0].toUpperCase()+floor.slice(1)} footprint lifetime (seconds)`,
    hint: `Total time until footprints, creature grooves and flattened grass left on ${floor} fully fade, including carried wet/muddy/snowy prints on that ground. 0 keeps their natural lifetime (sand 6 seconds, mud 12, snow 20). Applies to existing and new tracks on every screen. Does not create tracks where none would normally appear. Dust, blood, water ripples and burrow holes keep their own timing; track limits still remove the oldest marks when full.`,
    scope: 'world', config: true, type: Number, default: 0,
    range: { min: 0, max: 3600, step: 1 },
  });
  registerSetting("walkedPathHighlight", {
    name: "Walked path highlight",
    hint: "Foundry highlights every square a token moves through, which hides the dust, prints and splashes it leaves. Faded: the squares already walked show at a quarter strength (the way ahead stays as it is). Hidden: walked squares are not highlighted. As Foundry draws it: unchanged.",
    scope: "client", config: true, type: String, default: "fade",
    choices: { fade: "Faded", hide: "Hidden", off: "As Foundry draws it" },
  });
  registerSetting("movementStealth", {
    name: "Movement respects stealth",
    hint: "Players only see and hear what their characters could: an undetected or unnoticed creature moves in silence and leaves no tracks, and a hidden one is heard but leaves nothing to see (PF2e Visioner, judged from each player's own tokens, else the creature's conditions). Off: everyone sees and hears every movement drawn on their screen. Tokens the GM hid never give anything away either way.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => awareness.clear(),
  });
  registerSetting("movementGmPerception", {
    name: "GM perceives movement",
    hint: "As my selected token: with a token selected, you see and hear only what it could, as its player would (a creature PF2e Visioner says it has not detected leaves no tracks and makes no sound); with none selected, everything. Everything: you always see and hear every creature move (except tokens hidden in Foundry).",
    scope: "client", config: true, type: String, default: "token",
    choices: { all: "Everything", token: "As my selected token" },
    onChange: () => awareness.clear(),
  });
  registerSetting("burrowHoles", {
    name: "Burrow holes",
    hint: "A burrowing creature leaves a hole where it goes under and a wider one where it comes up, with earth thrown out, lingering about 20 seconds.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting('burrowTrailDepth',{
    name:'Hide burrow paths at relative elevation',
    hint:'Burrowing at or below this elevation relative to the viewed level’s floor leaves no visible path. -10 hides paths 10 scene units below that floor; 0 hides every underground path. Entrance and exit holes still appear when the creature crosses the surface. Existing shallow trails fade normally.',
    scope:'world',config:true,type:Number,default:-10,range:{min:-1000,max:0,step:1},
  });
  registerSetting('underwaterLooks',{name:'Submerged token appearance',hint:'Below the water surface, visible swimmers fade to a blue, translucent silhouette. Surfacing restores their original appearance. This changes artwork only, not Foundry visibility or detection.',scope:'world',config:true,type:Boolean,default:true,onChange:()=>clearBurrowSink()});
  registerSetting('underwaterOpacity',{name:'Submerged token opacity',hint:'How clearly a submerged creature’s artwork is drawn (0.35 = 35%). Applies equally to GM and player artwork, while Foundry still decides who can see the creature.',scope:'world',config:true,type:Number,default:.35,range:{min:.1,max:1,step:.05}});
  for(const [key,name,natural] of [['swimWakeSeconds','Swimming wake lifetime',1.6],['underwaterBubbleSeconds','Underwater bubble lifetime',1.8],['burrowTrailSeconds','Burrow path lifetime',8]])registerSetting(key,{
    name:`${name} (seconds)`,hint:`Time until fully faded. 0 keeps natural fading (${natural} seconds). Applies to existing and new effects. Burrow holes keep their own lifetime.`,
    scope:'world',config:true,type:Number,default:0,range:{min:0,max:3600,step:.1},
  });
  registerSetting("burrowSink", {
    name: "Burrowed creatures sink out of sight",
    hint: "A creature below the floor sinks into its hole and vanishes for players who don't own it (they still see the ground churn and hear it dig); its owner and the GM see a faint ghost. It rises back out where it surfaces.",
    scope: "world", config: true, type: Boolean, default: true,
    // Off: every token comes straight back as Foundry draws it. On: tokens already under go down at once.
    onChange: () => clearBurrowSink(),
  });
  registerSetting("footstepSounds", {
    name: "Footstep sounds",
    hint: "Moving tokens make their sounds: footsteps by floor and feet, wing beats, a burrower's churn, a swimmer's stroke, the thud of a landing. Off: tokens move silently; the view still shakes under giant footfalls (Giant footfalls shake the view).",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("footstepSoundsLocal", {
    name: "Footstep sounds on my screen",
    hint: "Turn off to hear no footsteps, wing beats or other movement sounds on this device. Other players keep theirs.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  registerSetting("footstepAcoustics", {
    name: "Footsteps ring in the room",
    hint: "Footsteps, wing beats and footfall thuds echo softly in the room they happen in and sound muffled from behind a wall, as Animater's hit sounds do (with Room acoustics and Muffle sounds behind walls on).",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("footstepRange", {
    name: "Footstep hearing range",
    hint: "How far away footsteps, wing beats and other movement sounds can be heard (Foundry plays them only to tokens within this range). Huge and bigger creatures carry half as far again. Close 3 squares, Normal 6, Far 10, Very far 15.",
    scope: "world", config: true, type: String, default: "normal",
    choices: { close: "Close (3 squares)", normal: "Normal (6 squares)", far: "Far (10 squares)", veryFar: "Very far (15 squares)" },
  });
  registerSetting("quietSneaking", {
    name: "Sneaking is quiet",
    hint: "A creature moving stealthily steps softer, slower and duller, and only a Huge or bigger one still thuds: PF2e's Avoid Notice exploration activity or a Sneak effect, PF2e Visioner's sneaking, D&D 5e's Hiding status.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => sneakCache.clear(),
  });
  registerSetting("footfallTremor", {
    name: "Giant footfalls shake the view",
    hint: "Every footfall of a Huge or Gargantuan creature gives a small tremor to screens that hear it nearby, stronger the heavier it is (a stone golem or a dragon more than a giant). Needs Camera shake on.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("creatureIdleSounds", {
    name: "Creatures growl on their turn",
    hint: "With PF2e Creature Sounds active, a Large or bigger NPC sometimes growls from where it stands as its combat turn starts, heard only by those who could hear it. Uses that module's sound sets and volume.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("creatureVoices", {
    name: "Creatures cry out when they attack and are hurt",
    hint: "An attacking creature now and then grunts, snarls or roars as it attacks, a hurt one now and then cries out, in a voice for its creature and its creature type (a man or a woman, small folk, a wolf, a bear, a bird, a dragon, a zombie, a spider, a fiend and more), and one that falls always does, from where it stands, heard only by those who could hear it. Ghosts wail, skeletons rattle, oozes gurgle; animated objects and elementals stay silent. On PF2e, PF2e Creature Sounds voices them instead when it is active.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("creatureVoiceFolder", {
    name: "Creature voices from my own folder",
    hint: "A folder of your own creature sounds (in your Data folder) to use besides Animater's: each sub-folder is one voice, filed by its name (Huge Dragon, orc, banshee, Crow…), its attack, hurt and death folders holding the takes. The files stay yours and are played from your server, never bundled. Empty: Animater's own voices only.",
    scope: "world", config: true, type: String, default: "", filePicker: "folder",
    onChange: () => { if (game.user?.isGM) void scanVoiceFolder(); },
  });
  // What the GM's screen found in that folder, for every screen (players may not browse files).
  registerSetting("creatureVoiceIndex", { scope: "world", config: false, type: Object, default: {}, onChange: () => { voiceLibrary = null; } });
  registerSetting("creatureVoicesLocal", {
    name: "Creature cries on my screen",
    hint: "Turn off to hear no hurt or dying creature cries on this device. Other players keep theirs.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  registerSetting("trackedPrints", {
    name: "Feet carry mud, water and snow",
    hint: "A creature that walked through water, mud or snow leaves wet, muddy or snowy prints in its own tracks on the next floor for a few strides, fainter each stride. Creatures that slither, ooze or leave no prints carry nothing.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("bloodTrail", {
    name: "Wounded creatures leave blood drops",
    hint: "A badly hurt creature (a quarter of its HP or less) now and then drips blood as it moves, lasting about 20 seconds. Constructs, elementals, oozes and incorporeal creatures never bleed. With Splatter painting the blood (Splatter: blood follows the damage), Splatter's blood is used instead.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("weatherOnGround", {
    name: "Weather on the ground",
    hint: "When it rains on the scene (Foundry's scene weather or FXMaster), every step splashes, dirt turns to mud (its sound and prints), stone, wood, grass and sand get puddles under each step, and prints on sand, dirt and mud look wet; when it snows, every step kicks up a light dusting. Never under a region that suppresses weather.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("idleLife", {
    name: "Idle life",
    hint: "Creatures on screen idle subtly: living creatures breathe and fliers bob in the air. Constructs, undead, objects and creatures that are down or defeated stay still, and any condition's movement takes over. Drawn on each screen at Balanced quality or better.",
    scope: "world", config: true, type: Boolean, default: true,
    // Takes effect at once: the breathing starts or stops on every screen.
    onChange: () => idleLife?.sync(),
  });
  registerSetting("idleLifeLocal", {
    name: "Idle life on my screen",
    hint: "Turn off to never draw idle breathing or hovering on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => idleLife?.sync(),
  });
  registerSetting("idleBreathing", {
    name: "Idle breathing",
    hint: "Living creatures on screen breathe, a slow rise and fall. Off: they stand still (fliers can still hover).",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => idleLife?.sync(),
  });
  registerSetting("idleHover", {
    name: "Fliers hover",
    hint: "Flying creatures bob gently in the air, so they stand out from those on the ground. Off: they hold still (others can still breathe).",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => idleLife?.sync(),
  });
  // Each player chooses for their own screen too (the world switches above are the GM's).
  registerSetting("idleBreathingLocal", {
    name: "Idle breathing on my screen",
    hint: "Turn off to never draw idle breathing on this screen (fliers can still hover).",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => idleLife?.sync(),
  });
  registerSetting("idleHoverLocal", {
    name: "Fliers hover on my screen",
    hint: "Turn off to never draw fliers bobbing on this screen (others can still breathe).",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => idleLife?.sync(),
  });
  registerSetting("idleLifeStrength", {
    name: "Idle life strength",
    hint: "How much creatures breathe and fliers bob on this screen: 1 is a visible but calm breath, 2 twice as much, 0.5 half.",
    scope: "client", config: true, type: Number, range: { min: 0.5, max: 2, step: 0.25 }, default: 1,
    onChange: () => idleLife?.sync(),
  });
  registerSetting("breathVapor", {
    name: "Breath shows in the cold",
    hint: "In the cold (snow falling, a snow or ice floor underfoot, or a scene flagged cold), breathing creatures on screen puff a faint white cloud with each breath out. Constructs and undead do not. Drawn on each screen at Balanced quality or better, and not where idle life is off on that screen.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) breathVapor.clear(); },
  });
  registerSetting("woundedLooks", {
    name: "Wounded looks",
    hint: "Creatures show how hurt they are. At half their HP or less they look wounded; at a quarter or less the look is stronger, they stand hunched and limp as they move. Healing takes it away, and a defeated creature shows the defeated look instead. Choose whether every creature shows it or only player characters.",
    scope: "world", config: true, type: String, default: "all",
    choices: { all: "All creatures", pcs: "Player characters only", off: "Off" },
    onChange: () => woundedLooks?.sync(),
  });
  registerSetting("woundedLooksLocal", {
    name: "Wounded looks on my screen",
    hint: "Turn off to never draw wounded looks, hunches or limps on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => woundedLooks?.sync(),
  });
  registerSetting("mapDistortion", {
    name: "Map distortion",
    hint: "Big blasts ripple across the map, lasting fire shimmers with heat and teleports warp the air. Drawn only on screens at Full animation quality.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("shockwaveReach", {
    name: "Shockwave reach (× blast size)",
    hint: "How far a blast's shockwave ripples across the map, as a multiple of the blast's size. It always clears the blast by at least a square, and its ripple keeps the same width at any reach.",
    scope: "world", config: true, type: Number, range: { min: 1, max: 4, step: 0.25 }, default: 1.5,
  });
  registerSetting("mapDistortionLocal", {
    name: "Map distortion on my screen",
    hint: "Turn off to never bend the map on this screen (for example if it is uncomfortable to watch).",
    scope: "client", config: true, type: Boolean, default: true,
    // Off: whatever is bending stops at once. On: its shader is readied before the next blast.
    onChange: (on) => { if (on === false) distortionHost.clear(); else rewarmShaders(); },
  });
  registerSetting("cameraShake", {
    name: "Camera shake",
    hint: "Big blasts jolt the view for a moment on each screen, more for bigger blasts and less the further away they land. Drawn only on screens at Full or Light animation quality.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) cameraShake.clear(); },
  });
  registerSetting("cameraShakeLocal", {
    name: "Camera shake on my screen",
    hint: "Turn off to never shake the view on this screen. Off at first when this browser asks for reduced motion.",
    scope: "client", config: true, type: Boolean,
    default: !(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true),
    onChange: (on) => { if (on === false) cameraShake.clear(); },
  });
  registerSetting("cameraShakeStrength", {
    name: "Camera shake strength",
    hint: "How hard blasts shake the view on this screen, as a multiple of the usual jolt. Above 1 it also lasts longer (4 shakes about twice as long).",
    scope: "client", config: true, type: Number, range: { min: 0.25, max: 4, step: 0.25 }, default: 1,
  });
  registerSetting("killCam", {
    name: "Slow-motion kill-cam",
    hint: "When a killing blow lands on an NPC, every screen that can see it eases the view towards it with a gentle zoom, slows Animater's effects on it and fades the colour for a moment, then pans back. The finisher and Finish Him! wait for it. Drawn only on screens at Full or Light animation quality.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: (on) => { if (on === false) killCam.clear(); },
  });
  registerSetting("killCamLocal", {
    name: "Kill-cam on my screen",
    hint: "Turn off to never move the view or slow effects for a kill-cam on this screen.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) killCam.clear(); },
  });
  registerSetting("lensBlood", {
    name: "Damage lens",
    hint: "Blood on the lens, on players' screens only. When a player's creature hits an enemy, that enemy's blood splats on the player's screen, more for more damage, on the side the enemy is. When the player's own creature is hit, the view closes in (tunnel vision) and its own blood splashes the screen; a badly hurt creature keeps a faint tunnel in combat. Uses Splatter's blood colours and bloodless creatures when Splatter is active. Bloodless creatures, creatures that screen cannot see and hidden tokens never bleed on it. Players' Blood sounds choice (Hit sounds) Off turns it off, Subtle makes it subtle.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) stopLensBlood(); },
  });
  registerSetting("lensBloodLocal", {
    name: "Damage lens on my screen",
    hint: "Turn off to never see the damage lens (blood on the screen) or tunnel vision on this screen. Off at first when this browser asks for reduced motion.",
    scope: "client", config: true, type: Boolean,
    default: !(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true),
    onChange: (on) => { if (on === false) { lensBlood.clear(); worldMuffle.restore(); woundReset?.(); } },
  });
  registerSetting("lensEffects", {
    name: "Damage type effects",
    hint: "On players' screens only, with the same rule as the damage lens: each energy damage type their creature takes or deals leaves its own short mark on the screen beside the blood. Fire scorches the edges and throws embers, cold frosts them over, lightning arcs across, acid drops and bubbles, poison sways the view, sonic ripples it, force cracks the lens, void drains its colour, vitality flares, mental damage doubles the view, spirit sends pale wisps; Daggerheart's magic shimmers. Stronger for more damage, clearly stronger for critical hits. Damage lens amount Subtle and Subtle gore tone it down; Low animation quality keeps only the marks.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) lensBlood.clearEffects(); },
  });
  registerSetting("lensEffectsLocal", {
    name: "Damage type effects on my screen",
    hint: "Turn off to never see the damage type effects (scorch, frost, arcs, cracks, double vision...) on this screen. Off at first when this browser asks for reduced motion.",
    scope: "client", config: true, type: Boolean,
    default: !(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true),
    onChange: (on) => { if (on === false) lensBlood.clearEffects(); },
  });
  registerSetting("lensWho", {
    name: "Damage lens shows",
    hint: "Which of a player's blows reach their screen: hits their creature takes and hits it deals, only hits it takes, or only hits it deals. Covers the blood, tunnel vision, the heartbeat on a hit and the damage type effects. The wounded view of a hurt creature stays with its own switch.",
    scope: "world", config: true, type: String, choices: { both: "Hits taken and dealt", hurt: "Only hits taken", dealt: "Only hits dealt" }, default: "both",
  });
  registerSetting("lensWhoLocal", {
    name: "Damage lens shows on my screen",
    hint: "Your own choice of which blows reach this screen: hits your creature takes, hits it deals, or both. As the GM set uses the GM's Damage lens shows.",
    scope: "client", config: true, type: String, choices: { "": "As the GM set", both: "Hits taken and dealt", hurt: "Only hits taken", dealt: "Only hits dealt" }, default: "",
  });
  registerSetting("lensBloodAmount", {
    name: "Damage lens amount",
    hint: "Heavy: bigger splats that drip and stay about four and a half seconds for a big hit. Subtle: a few small splats near the edges for about three seconds, and a lighter tunnel vision. Low animation quality always draws Subtle. How long it stays is set with Damage lens duration.",
    scope: "client", config: true, type: String, choices: { heavy: "Heavy", subtle: "Subtle" }, default: "heavy",
  });
  registerSetting("lensDuration", {
    name: "Damage lens duration (seconds)",
    hint: "How long a big hit's blood stays on players' screens, in seconds (4.5 by default). Smaller hits stay proportionally shorter, drying and fading stretch with it, and damage type effects hold longer or shorter to match.",
    scope: "world", config: true, type: Number, range: { min: 2, max: 20, step: 0.5 }, default: 4.5,
  });
  registerSetting("lensDurationLocal", {
    name: "Damage lens duration on my screen (seconds)",
    hint: "Your own length for a big hit's blood on this screen, in seconds. 0 uses the GM's Damage lens duration.",
    scope: "client", config: true, type: Number, range: { min: 0, max: 20, step: 0.5 }, default: 0,
  });
  registerSetting("lensTunnel", {
    name: "Tunnel vision when hurt",
    hint: "When your creature is hit, the view closes in from the edges for a few seconds, harder hits closer. Off at first when this browser asks for reduced motion.",
    scope: "client", config: true, type: Boolean,
    default: !(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true),
    onChange: (on) => { if (on === false) lensBlood.linger(0); },
  });
  registerSetting("lensHeartbeat", {
    name: "Heartbeat when hurt",
    hint: "When your creature is hit, a few heavy heartbeats under the tunnel vision, harder hits louder and faster; while it stays at or under a quarter of its HP in combat, a quiet heartbeat that quickens the lower it gets. Played at the Hit sounds volume.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) { if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; } try { stopHeartbeat?.(); } catch { /* gone */ } stopHeartbeat = null; } },
  });
  registerSetting("lensWounded", {
    name: "Wounded view",
    hint: "With the damage lens on, your own creature's state stays on your screen: from half its HP the edges darken red, deeper as it falls (beating with the heartbeat at a quarter HP in combat, much fainter out of combat), each hit taken leaves a stain or two on the edges that stay until it is healed, and under a quarter HP in combat the music and ambience close in. At 0 HP, dying or unconscious, the view closes to a dim blurred window, the world goes nearly silent and a faint heartbeat goes on; waking up gasps back to the light. Damage lens amount Subtle halves it; Low animation quality keeps only the edges.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) { woundReset?.(); worldMuffle.restore(); lensBlood.clearWounds(); } else woundRefresh?.(); },
  });
  registerSetting("roomAcoustics", {
    name: "Room acoustics from walls",
    hint: "In scenes without an Acoustics choice, Animater's sounds echo to fit the space around them, worked out from the walls: dry outdoors, tight in small rooms, ringing in halls.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("roomReverbLocal", {
    name: "Room reverb on my screen",
    hint: "Turn off to hear Animater's sounds without room reverb.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  registerSetting("muffleWalls", {
    name: "Muffle sounds behind walls",
    hint: "Animater's sounds from beyond a wall sound muffled, as Foundry's own sounds do.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  registerSetting(DAMAGE_REACTIONS, {
    name: "Damage reactions",
    hint: "A token that takes energy damage (fire, cold, lightning, acid, poison and so on) flashes in that damage's look. Physical damage keeps its weapon animation only.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("dispelShatter", {
    name: "Dispels shatter lasting effects",
    hint: "After a successful counteract check (PF2e, SF2e) or Dispel Magic or Counterspell (D&D 5e), Animater's lasting areas and auras that end in the next few seconds break apart like glass. A failed one makes the lasting animations on its targets flicker, then hold.",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: (on) => { if (on === false) { shatterHost.clear(); dispelFlicker.clear(); dispelWindow.clear(); } },
  });
  registerSetting("dispelShatterLocal", {
    name: "Dispel shatter on my screen",
    hint: "Turn off to never draw dispels shattering or flickering lasting effects on this screen.",
    scope: "client", config: false, type: Boolean, default: true,
    onChange: (on) => { if (on === false) { shatterHost.clear(); dispelFlicker.clear(); dispelWindow.clear(); } },
  });
  registerSetting("momentum", {
    name: "Momentum",
    hint: "Hits in a row by the same attacker on the same target, in one turn (or within 12 seconds out of combat), land harder: bigger, louder and with stronger ripples. A miss starts the streak over. In PF2e and SF2e, a third Strike in a turn that misses looks strained.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  // A table with its own teleport automation (D&D premade modules, rule engines) turns this off.
  registerSetting(TELEPORT_TOKENS, {
    name: "Teleport tokens",
    hint: `Teleport spells (${({ dnd5e: "Misty Step, Dimension Door", daggerheart: "Blink Out" })[game.system.id] ?? "Translocate, Friendfetch"}…) let whoever cast them click a spot, and the token jumps there${game.system.id === "pf2e" ? " (Friendfetch drags its targets to the caster on its own)" : ""}. Turn off if another module already moves tokens for these spells: they then only play their animation.`,
    scope: "world", config: true, type: Boolean, default: true,
  });
  registerSetting("welcomed", { scope: "world", config: false, type: Boolean, default: false });
  registerSetting(DRAMATIC_DEATHS, {
    name: "Damage-typed knockouts",
    hint: "A creature dropping to 0 HP goes down in the look of the damage that dropped it: burned to ash, frozen and shattered, fried by lightning. Off: a plain collapse.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  // PF2e NPC monster abilities (catalogs/pf2e/npc-abilities.mjs). Registered in every world: an SF2e world
  // borrowing the PF2e catalogs reads it too.
  registerSetting("npcAbilities", {
    name: "Animate NPC abilities",
    hint: "PF2e and SF2e NPCs' monster abilities animate when used: Grab, Constrict, Swallow Whole, Engulf, Breath Weapon (when its area is placed), Trample, Pounce, Rend, Knockdown, Throw Rock, Ferocity, Change Shape and more. Your own recipes for an ability still come first.",
    scope: "world", config: ["pf2e", "sf2e"].includes(game.system.id), type: Boolean, default: true,
  });
  registerSetting("npcAbilityGuess", {
    name: "Animate other NPC abilities from what they do",
    hint: "With Animate NPC abilities on, an NPC ability that has no animation of its own gets one from what it does: an area it places plays in that shape (cone, line, burst, emanation) and its damage's colour, damage with no area strikes its target, else its traits decide (a teleport blinks, a fear ability cries out). Off: only the named monster abilities animate.",
    scope: "world", config: ["pf2e", "sf2e"].includes(game.system.id), type: Boolean, default: true,
  });
  registerSetting("npcStrikeGuess", {
    name: "Guess NPC Strikes",
    hint: "An NPC Strike that no weapon or creature attack name places still animates: by its damage (a slashing one rakes like a claw, others land as a blow), and a ranged one by what it throws or spits. Off: those Strikes play nothing unless you make a recipe for them.",
    scope: "world", config: ["pf2e", "sf2e"].includes(game.system.id), type: Boolean, default: true,
  });
  // Named NPC abilities the GM left out on the Studio's NPC abilities page (ability ids).
  registerSetting("npcAbilityExcluded", { scope: "world", config: false, type: Array, default: [] });
  // Shown only where Splatter is on; off, Splatter bleeds on its own.
  registerSetting(SPLATTER_SYNC, {
    name: "Splatter: blood follows the damage",
    hint: "Animater sets how much each wound bleeds in Splatter: slashing and piercing most, bludgeoning less, fire and lightning little, psychic not at all. Critical hits and killing blows bleed more, and a kill's blood waits for its Finish Him! screen. The creature keeps its own blood color. Off: Splatter bleeds on its own.",
    scope: "world", config: Boolean(game.modules.get(SPLATTER_ID)?.active), type: Boolean, default: true,
  });
  registerSetting(DEFAULT_FINISHER, { scope: "world", config: false, type: String, default: "" });
  registerSetting(DEFAULT_FINISHER_ENDING, { scope: "world", config: false, type: String, default: "" });
  registerDefeatedLook(game.settings, ID, { onChange: () => persistentStates?.schedule() });
  installDefeatedLook(Hooks, { mode: () => hotSetting(DEFEATED_LOOK), statuses: () => (game.system.id === "daggerheart" ? DH_DEFEATED_STATUSES : [defeatedStatusId()]) });
  // The Animater settings window edits these; Configure Settings keeps only the animation quality. Each
  // registration's own `config` above still says where it applies, as the window's rows do (ui/settings-window.mjs).
  for (const key of WINDOW_SETTING_KEYS) {
    const setting = key === "quality" ? null : game.settings.settings?.get?.(`${ID}.${key}`);
    if (setting) try { setting.config = false; } catch (error) { console.warn(`Animater | ${key} stays in Configure Settings`, error); }
  }
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
  game.keybindings.register(ID, "clearGroundMarks", {
    name: "Clear ground marks",
    hint: "Wipe every ground mark from the floor on all connected screens.",
    editable: [],
    restricted: true,
    onDown: () => {
      clearGroundMarksApi();
      return true;
    },
  });
});
const SURFACE_SETTING = "surfaceSounds";
// A built-in weapon animation, in any system, also sounds like what each target is (surface sounds).
function withWeaponSurface(recipe, event, saved, sounds) {
  if (!recipe || event?.type !== "attack" || hotSetting(SURFACE_SETTING) === false) return recipe ? (hotSetting(SURFACE_SETTING) === false ? withoutSurfaces(recipe) : recipe) : recipe;
  if (saved.some((r) => r.id === recipe.id)) return recipe;
  const item = event.item, family = game.system.id === "daggerheart" ? weaponFamily(item?.name) : null;
  return withSurfaceSounds(recipe, { blow: blowOfItem(item, { family, element: event.element }), heft: heftOfItem(item), sounds, soundVolume: weaponSoundVolume() });
}
const withoutSurfaces = (recipe) => recipe.stages?.some((s) => s.surfaces) ? { ...recipe, stages: recipe.stages.filter((s) => !s.surfaces) } : recipe;
const weaponSoundVolume = () => { const sys = game.system.id, key = sys === "dnd5e" ? dndSettingKey("weapon") : sys === "daggerheart" ? dhSettingKey("weapon") : sys === "sf2e" ? sfSettingKey("weapon") : "weaponCatalog";
  try { return hotSetting(key)?.soundVolume ?? 0.35; } catch { return 0.35; } };
function systemRecipe(event, saved) {
  const sounds = installedSoundCatalog(game.modules, globalThis.Sequencer?.Database);
  return withWeaponSurface(catalogSystemRecipe(event, saved, sounds), event, saved, sounds);
}
function catalogSystemRecipe(event, saved, sounds) {
  const sys = game.system.id;
  if (["pf2e", "sf2e"].includes(sys)) return crossoverResolve(event, { systemId: sys, on: crossoverOn(),
    // Borrowed catalogs are managed on their own pages, so each reads its own settings.
    resolve: (from, e) => twoeCatalogRecipe(from, e, saved, { customEnabled: enabled(), sounds, stateFor: (kind) => hotSetting(twoeSettingKey(from, kind)) }),
    knows: (e) => Boolean(catalogEntryFor(e.item) || saved.some((r) => matchRecipe([{ ...r, enabled: true }], e))) });
  return sys==='dnd5e'?resolveDndAutomaticRecipe(event,kind=>hotSetting(dndSettingKey(kind)),saved,{customEnabled:enabled(),sounds,npcEnabled:hotSetting('npcAbilities')!==false,npcExcluded:hotSetting('npcAbilityExcluded')??[]}):sys==='daggerheart'?resolveDaggerheartAutomaticRecipe(event,kind=>hotSetting(dhSettingKey(kind)),saved,{customEnabled:enabled(),sounds}):matchRecipe(saved,event);
}
// Read-only designs for the GM's choreography. Catalog on/off choices are not
// changed; custom recipes (including paused ones) keep their native priority.
function showcaseRecipe(event){
  const sys=game.system.id,sounds=installedSoundCatalog(game.modules,globalThis.Sequencer?.Database);
  const stateFor=kind=>{
    if(kind==='npcAbility'||kind==='npcAbilityGuess')return true;
    if(kind==='npcAbilityExcluded')return [];
    const key=sys==='dnd5e'?dndSettingKey(kind):sys==='daggerheart'?dhSettingKey(kind):twoeSettingKey(sys,kind);
    const state=key?hotSetting(key):{};
    return {...state,enabled:true,scope:'all',selected:[],excluded:[],independent:true,preferCatalog:false};
  };
  const options={customEnabled:true,sounds};
  return ['pf2e','sf2e'].includes(sys)?twoeCatalogRecipe(sys,event,recipes(),{...options,stateFor}):sys==='dnd5e'?resolveDndAutomaticRecipe(event,stateFor,recipes(),options):sys==='daggerheart'?resolveDaggerheartAutomaticRecipe(event,stateFor,recipes(),options):null;
}
function previewShowcaseMovement(tokenId){
  if(!game.user.isGM)throw Error('Only a GM can preview NPC movement.');
  const token=canvas?.ready?canvas.tokens.get(tokenId):null;if(!token)return ()=>{};
  const doc=token.document,profile=resolveMovementSound({system:game.system.id,actor:token.actor,name:token.name},doc?.flags?.[ID]?.movementSound);
  const bulk=creatureBulk({system:game.system.id,actor:token.actor,name:token.name}),kind=movementSound('walk',profile);
  if(!kind||profile.sound.silent)return ()=>{};
  const weight=stepWeight({size:bulk.size,squares:(token.w??100)/(canvas.grid.size||100),heavy:bulk.heavy});
  const engine=createMovementPreview({playStep:({floor,at,token,kind,preview})=>movementFeel.previewStep(floor,at,{...token,preview},kind),stopTremor:id=>cameraShake.stopPreview(id)});
  engine.start({count:4,gap:Math.min(700,Math.max(400,moveSoundGap(kind,weight,{gait:profile.gait}))),floor:movementFeelFloor(token.center,doc),kind,at:token.center,
    token:{id:`showcase:${tokenId}`,width:token.w,elevation:doc?.elevation??0,bulk,...profile}});
  return ()=>engine.stop();
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
const aaFillGaps = () => Boolean(game.modules.get(AA_ID)?.active && hotSetting(AA_FILL_GAPS));
const taFillGaps = () => Boolean(game.modules.get(TA_ID)?.active && hotSetting(TA_FILL_GAPS));
const aaTakeover = () => Boolean(game.modules.get(AA_ID)?.active && hotSetting(AA_TAKEOVER));
const taTakeover = () => Boolean(game.modules.get(TA_ID)?.active && hotSetting(TA_TAKEOVER));
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
  group.innerHTML = `<label>Animater acoustics</label><div class="form-fields"><select name="flags.${ID}.acoustics">${[["", "From the walls"], ["outdoors", "Open air: little echo"], ["hall", "Hall or temple: longer echo"], ["cave", "Cave or dungeon: long, dark echo"]].map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select></div><p class="hint">How Animater's sounds ring in this scene. From the walls: each sound gets reverb to fit the space where it happens (with Room acoustics from walls on; else as recorded). A choice here applies everywhere in the scene.</p>`;
  tab.append(group);
});
// Scene and Region configuration: the floor Animater's movement effects read (dust, ripples or a scuff).
const floorSelect = (value, first, hint) => {
  const group = document.createElement("div");
  group.className = "form-group";
  const options = FLOOR_CHOICES.map(([v, l]) => [v, v ? l : first]);
  group.innerHTML = `<label>Animater floor</label><div class="form-fields"><select name="flags.${ID}.floor">${options.map(([v, l]) => `<option value="${v}"${v === (value ?? "") ? " selected" : ""}>${l}</option>`).join("")}</select></div><p class="hint">${hint}</p>`;
  return group;
};
Hooks.on("renderSceneConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.floor"]`)) return;
  const tab = root.querySelector('.tab[data-tab="environment"]') ?? root.querySelector('.tab[data-tab="ambience"]') ?? root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector(".tab");
  if (!tab) return;
  // Whether the scene is cold enough for breath to show (Breath shows in the cold).
  if (!root.querySelector(`[name="flags.${ID}.cold"]`)) {
    const raw = app.document?.flags?.[ID]?.cold, value = raw === true || raw === "cold" ? "cold" : raw === false || raw === "warm" ? "warm" : "";
    const climate = document.createElement("div");
    climate.className = "form-group";
    climate.innerHTML = `<label>Animater climate</label><div class="form-fields"><select name="flags.${ID}.cold">${[["", "From the weather and floor"], ["cold", "Cold: breath shows"], ["warm", "Warm: no breath"]].map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select></div><p class="hint">Whether creatures' breath shows as vapor here (Breath shows in the cold). From the weather and floor: cold in snow or a blizzard, or standing on snow or ice.</p>`;
    tab.append(climate);
  }
  tab.append(floorSelect(app.document?.flags?.[ID]?.floor, "From the scene (auto)", "What moving tokens walk on here: dust on dirt, grass, sand and snow, ripples on water, a faint scuff on stone and wood. From the scene: dirt when the scene has global illumination or its name or background sounds outdoors, else stone. Regions named for water (river, lake, pond, sea, stream, swamp) are water inside."));
});
// Token configuration: where breath vapor leaves this token's art (portrait art, top-down art turned to face, or an
// edge where the head is drawn).
Hooks.on("renderTokenConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.breathFrom"]`)) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]') ?? root.querySelector('.tab[data-tab="identity"]') ?? root.querySelector(".tab");
  if (!tab) return;
  const doc = app.document ?? app.token ?? app.object, value = doc?.flags?.[ID]?.breathFrom ?? "";
  const group = document.createElement("div");
  group.className = "form-group";
  group.innerHTML = `<label>Animater breath from</label><div class="form-fields"><select name="flags.${ID}.breathFrom">${[["", "Auto (portrait: the mouth, above the centre; turned top-down art: where it faces)"], ["top", "Top"], ["right", "Right"], ["bottom", "Bottom"], ["left", "Left"], ["facing", "Where it faces (top-down art)"]].map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select></div><p class="hint">Where this creature's breath shows in the cold, for art whose head is not in the middle (a dragon drawn side-on, its head on the right).</p>`;
  tab.append(group);
});
// Token configuration: this token's own blood colour (flags.animater.bloodColor: '' by creature type, 'none' no blood,
// '#rrggbb'), used when Splatter is not deciding.
Hooks.on("renderTokenConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.bloodColor"]`)) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]') ?? root.querySelector('.tab[data-tab="identity"]') ?? root.querySelector(".tab");
  if (!tab) return;
  const doc = app.document ?? app.token ?? app.object, raw = String(doc?.flags?.[ID]?.bloodColor ?? "").trim().toLowerCase();
  const mode = raw === "none" ? "none" : /^#[0-9a-f]{6}$/.test(raw) ? "color" : "";
  let typeColor = "#7a0d0d";
  try { if (doc) typeColor = `#${(tokenBlood({ actor: doc.actor, document: { name: doc.name, flags: {} } }).color >>> 0).toString(16).padStart(6, "0")}`; } catch { /* the default */ }
  const group = document.createElement("div");
  group.className = "form-group";
  group.innerHTML = `<label>Animater blood colour</label><div class="form-fields"><select data-animater-blood-mode>${[["", "Use creature type"], ["none", "No blood"], ["color", "This colour"]].map(([v, l]) => `<option value="${v}"${v === mode ? " selected" : ""}>${l}</option>`).join("")}</select><input type="color" data-animater-blood-color value="${mode === "color" ? raw : typeColor}"${mode === "color" ? "" : " disabled"}><input type="hidden" name="flags.${ID}.bloodColor" value="${mode === "color" ? raw : mode}"></div><p class="hint">What this creature bleeds on the lens and the ground, over its creature type's colour (Animater settings, Blood colours). With Splatter active, Splatter's own blood colour decides instead.</p>`;
  const select = group.querySelector("[data-animater-blood-mode]"), color = group.querySelector("[data-animater-blood-color]"), hidden = group.querySelector(`[name="flags.${ID}.bloodColor"]`);
  const sync = () => { color.disabled = select.value !== "color"; hidden.value = select.value === "color" ? color.value : select.value; };
  select.addEventListener("change", sync);
  color.addEventListener("input", sync);
  color.addEventListener("change", sync);
  tab.append(group);
});
// Token configuration: this token's own cry (flags.animater.voice: '' its creature's, 'auto' Animater's pick for its
// creature, 'none' silent, a voice family) and one voice by name (flags.animater.voiceSpeaker: '' the best fit). On
// PF2e with PF2e Creature Sounds on, '' leaves the token to that module, and any other choice is Animater's (and
// silences that module for its actor, below). Attack, Hurt and Death preview a take of the choice on this screen.
Hooks.on("renderTokenConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.voice"]`)) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]') ?? root.querySelector('.tab[data-tab="identity"]') ?? root.querySelector(".tab");
  if (!tab) return;
  const doc = app.document ?? app.token ?? app.object, actor = doc?.actor ?? null;
  const value = String(doc?.flags?.[ID]?.voice ?? ""), speaker = String(doc?.flags?.[ID]?.voiceSpeaker ?? "");
  const pf2eSounds = voiceDeferred(pf2eSoundsState());
  // What its creature gets on its own: the voice that fits it best, as playback picks it.
  let auto = "", bank = [];
  try {
    bank = voiceBank();
    const picked = actor ? voiceOf(creatureOf(actor), { voiceSeed: actor.uuid, bank }) : null;
    auto = picked ? ` (${picked.label ?? picked.id})` : " (silent)";
  } catch { /* no hint */ }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const options = (list, chosen) => list.map(([v, l]) => `<option value="${esc(v)}"${v === chosen ? " selected" : ""}>${esc(l)}</option>`).join("");
  // The kinds of creature by category, and female, male and other creatures' voices apart, so one is easy to find.
  const firstOptions = pf2eSounds ? [["", "Use PF2e Creature Sounds"], ["auto", `Animater: its creature's${auto}`]] : [["", `Its creature's${auto}`]];
  const familyOptions = options([...firstOptions, ["none", "Silent"]], value) + familyGroups().map((g) => `<optgroup label="${esc(g.label)}">${options(g.families, value)}</optgroup>`).join("");
  // The voices to pick from are those of the kind chosen on the left (its creature's own, or a family and its
  // fallbacks), the one already chosen kept.
  const own = (() => { try { return actor ? creatureOf(actor).kinds : []; } catch { return []; } })();
  const kindsOf = (family) => (family === "none" ? [] : VOICE_FAMILIES[family] ? voiceLineage(family) : own);
  const voiceOptions = (family, chosen) => options([["", "Best fit"]], chosen) + voiceGroups(bank, { kinds: kindsOf(family), chosen }).map((g) => `<optgroup label="${esc(g.label)}">${options(g.voices, chosen)}</optgroup>`).join("");
  const group = document.createElement("div");
  group.className = "form-group";
  const buttons = ["attack", "hurt", "death"].map((u) => `<button type="button" data-animater-voice-preview="${u}" title="Play a ${u} cry">${u[0].toUpperCase()}${u.slice(1)}</button>`).join("");
  group.innerHTML = `<label>Animater creature voice</label><div class="form-fields"><select name="flags.${ID}.voice">${familyOptions}</select><select name="flags.${ID}.voiceSpeaker">${voiceOptions(value, speaker)}</select></div><div class="form-fields animater-voice-preview" style="flex: 0 0 100%; justify-content: flex-end;">${buttons}</div><p class="hint">How this token cries out when it attacks, is hurt or falls (Animater settings, Creatures cry out when they attack and are hurt): the voice that best fits its creature, silence, the best voice for another kind of creature, or one voice by name${pf2eSounds ? ", or PF2e Creature Sounds' own" : ""}. Attack, Hurt and Death play a cry of the choice here, for you only.</p>`;
  const [familySelect, speakerSelect] = group.querySelectorAll("select");
  // No voice to name when the token is silent or left to PF2e Creature Sounds: hidden, and cleared so none is saved.
  const voiceless = (family) => family === "none" || (pf2eSounds && family === "");
  const showSpeaker = () => {
    if (voiceless(familySelect.value)) speakerSelect.value = "";
    speakerSelect.hidden = voiceless(familySelect.value);
    group.querySelectorAll("[data-animater-voice-preview]").forEach((b) => { b.disabled = familySelect.value === "none"; });
  };
  // A new kind lists its own voices; a voice picked for the old kind goes back to the best fit.
  familySelect.addEventListener("change", () => {
    const keep = voiceGroups(bank, { kinds: kindsOf(familySelect.value) }).some((g) => g.voices.some(([id]) => id === speakerSelect.value)) ? speakerSelect.value : "";
    speakerSelect.innerHTML = voiceOptions(familySelect.value, keep);
    speakerSelect.value = keep;
    showSpeaker();
  });
  showSpeaker();
  group.querySelectorAll("[data-animater-voice-preview]").forEach((button) => button.addEventListener("click", async () => {
    const use = button.dataset.animaterVoicePreview, family = familySelect.value;
    try {
      let file = null;
      if (pf2eSounds && family === "") {
        // PF2e Creature Sounds' own set for this actor, as that module picks it.
        let custom = {};
        try { custom = game.settings.get("pf2e-creature-sounds", "custom_sound_sets") ?? {}; } catch { /* none */ }
        const sizes = { tiny: 0, sm: 1, med: 2, lg: 3, huge: 4, grg: 5 };
        const set = actor ? pickSoundSet({ name: actor.flags?.babele?.originalName ?? actor.name, chosen: actor.flags?.["pf2e-creature-sounds"]?.soundset ?? null,
          traits: Array.from(actor.system?.traits?.value ?? []), size: sizes[actor.system?.traits?.size?.value] ?? -1, seed: actor.id }, await creatureSoundSets(), custom) : null;
        const takes = set?.[`${use}_sounds`] ?? [];
        file = takes[Math.floor(Math.random() * takes.length)] ?? null;
      } else {
        const choice = tokenVoice(actor, { voice: family, speaker: speakerSelect.value });
        // A family chosen with no actor to match: the family itself.
        const creature = choice.creature;
        if (creature && !creature.kinds.length && VOICE_FAMILIES[family]) creature.kinds = voiceLineage(family);
        file = creature ? voiceFile(creature, use, { seed: `${Date.now()}`, voiceSeed: actor?.uuid ?? doc?.uuid ?? "", voiceId: choice.voiceId, bank }) : null;
      }
      if (!file) { ui.notifications?.info(`No ${use} cry for this voice.`); return; }
      foundry.audio.AudioHelper.play({ src: file, volume: 0.8, loop: false }, false);
    } catch (error) { runtime.trace("Blocked", `Voice preview: ${error.message}`); }
  }));
  tab.append(group);
});
// A token given its own Animater voice on PF2e: PF2e Creature Sounds is silenced for its actor (its soundset 'none'),
// so the two never cry at once; the actor's own soundset comes back when the token is left to that module again.
// Run by the user who changed the token only.
Hooks.on("updateToken", (doc, changes, _options, userId) => {
  try {
    if (userId !== game.user?.id || !changes?.flags?.[ID] || !voiceDeferred(pf2eSoundsState())) return;
    const actor = doc.actor, flags = { voice: doc.flags?.[ID]?.voice, speaker: doc.flags?.[ID]?.voiceSpeaker };
    if (!actor?.isOwner) return;
    const soundset = actor.flags?.["pf2e-creature-sounds"]?.soundset, saved = actor.flags?.[ID]?.pf2eSoundsetBefore;
    if (ownsVoice(flags) && soundset !== "none") {
      void actor.update({ [`flags.${ID}.pf2eSoundsetBefore`]: soundset ?? "", "flags.pf2e-creature-sounds.soundset": "none" });
    } else if (!ownsVoice(flags) && soundset === "none" && saved !== undefined) {
      void actor.update({ [`flags.${ID}.-=pf2eSoundsetBefore`]: null, ...(saved ? { "flags.pf2e-creature-sounds.soundset": saved } : { "flags.pf2e-creature-sounds.-=soundset": null }) });
    }
  } catch (error) { runtime.trace("Blocked", `PF2e Creature Sounds handoff: ${error.message}`); }
});
const movementConfigCleanup = new WeakMap(), movementConfigStops = new Set();
Hooks.on("renderTokenConfig", (app, html) => {
  movementConfigCleanup.get(app)?.();
  const root = html instanceof HTMLElement ? html : html?.[0];
  const doc = app.document ?? app.token ?? app.object;
  if (!root || (!doc?.isOwner && !game.user?.isGM)) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]') ?? root.querySelector('.tab[data-tab="identity"]') ?? root.querySelector('.tab');
  if (!tab) return;
  if (!root.querySelector('.animater-movement-sounds')) tab.insertAdjacentHTML('beforeend', movementSoundsForm(doc?.flags?.[ID]?.movementSound));
  const engine = createMovementPreview({
    playStep: ({ floor, at, token, kind, preview }) => movementFeel.previewStep(floor, at, { ...token, preview }, kind),
    stopTremor: (id) => cameraShake.stopPreview(id),
  });
  const stop = () => engine.stop();
  movementConfigStops.add(stop);
  const preview = { stop, start: ({ raw, floor, action }) => {
    if (!canvas?.ready) { ui.notifications.warn('Open a scene to preview movement sounds.'); return; }
    const profile = resolveMovementSound({ system: game.system.id, actor: doc?.actor, name: doc?.name }, raw);
    const bulk = creatureBulk({ system: game.system.id, actor: doc?.actor, name: doc?.name });
    const kind = action === 'land' ? 'land' : movementSound(action, profile);
    if (!kind || profile.sound.silent) { stop(); return; }
    const width = Number(doc?.width ?? 1) * canvas.grid.size;
    const weight = stepWeight({ size: bulk.size, squares: width / canvas.grid.size, heavy: bulk.heavy });
    // Preview is local and centred in the view; neither the real token nor its live movement pacer is touched.
    engine.start({ floor, kind, gap: Math.max(400, moveSoundGap(kind, weight, { gait: profile.gait })),
      at: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y },
      token: { id: `preview:${doc?.id ?? 'prototype'}`, width, elevation: doc?.elevation ?? 0, bulk, ...profile } });
  } };
  const initialFloor = canvas?.ready ? movementFeelFloor(doc?.getCenterPoint?.() ?? { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y }, doc) : 'stone';
  const unmount = mountMovementSounds(root, { document: doc, system: game.system.id, preview, floor: initialFloor });
  movementConfigCleanup.set(app, () => { unmount(); movementConfigStops.delete(stop); movementConfigCleanup.delete(app); });
});
Hooks.on('closeTokenConfig', (app) => movementConfigCleanup.get(app)?.());
Hooks.on('canvasTearDown', () => { for (const stop of movementConfigStops) stop(); });
Hooks.on("renderRegionConfig", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector(`[name="flags.${ID}.floor"]`)) return;
  const tab = root.querySelector('.tab[data-tab="appearance"]') ?? root.querySelector(".tab");
  if (!tab) return;
  tab.append(floorSelect(app.document?.flags?.[ID]?.floor, "From the name (water names are water, else the scene's floor)", "The floor Animater's movement effects use inside this region, over the scene's."));
});
Hooks.once("ready", () => {
  // Room-aware sound: each grid square's room, swept once on the sound's level, forgotten when walls, doors, the
  // scene or its levels change.
  const rooms = createRoomCache({
    sweep: (at, levelId) => {
      const level = typeof levelId === "string" ? canvas.scene?.levels?.get?.(levelId) : undefined;
      return CONFIG.Canvas.polygonBackends.sound.create(at, { type: "sound", radius: 30 * canvas.grid.size, ...(level ? { level } : {}) })?.points;
    },
    // A sound sweep also stops at the canvas edge (its outer bounds): that edge is open, not a wall.
    bounds: () => canvas.dimensions?.rect ?? null,
  });
  for (const hook of ["createWall", "updateWall", "deleteWall", "canvasReady", "updateScene", "createLevel", "updateLevel", "deleteLevel"])
    Hooks.on(hook, () => rooms.bump());
  // One shared reverb per room class, built from Foundry's own impulse in the context Animater's sounds play in.
  const reverb = createReverbBuses({ contextOf: () => game.audio?.interface ?? null });
  // Load Foundry's impulse ahead of the first sound (it waits for the audio context, and retries cheaply).
  reverb.ready();
  Hooks.on("canvasReady", () => reverb.ready());
  // Where this player hears walls from (none for a GM with no token selected: nothing muffled, as in Foundry).
  const soundEar = () => muffleEar({
    controlled: canvas.tokens?.controlled?.[0] ?? null,
    owned: game.user.isGM ? null : canvas.tokens?.placeables?.find((t) => t.isOwner) ?? null,
    isGM: game.user.isGM,
    view: { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y },
  });
  // Surface hits ask for a slight pitch shift so repeated blows vary; each player's own mix applies here.
  installSoundPitch({
    enabled: () => hotSetting("hitSounds") !== false,
    mix: () => ({ volume: hotSetting("surfaceVolume"), gore: hotSetting("surfaceGore"), echo: hotSetting("surfaceEcho") }),
    // Where this player hears from: their token, else the middle of their view.
    listener: () => {
      const stage = canvas?.stage;
      if (!hotSetting("surfaceSpace") || !canvas?.ready || !(stage?.scale?.x > 0)) return null;
      const token = canvas.tokens?.controlled?.[0] ?? game.user.character?.getActiveTokens?.(true)?.find((t) => t.scene === canvas.scene || t.document?.parent === canvas.scene) ?? null;
      const view = { x: stage.pivot.x, y: stage.pivot.y, width: window.innerWidth / stage.scale.x };
      return { ear: token?.center ?? { x: view.x, y: view.y }, view, grid: canvas.grid?.size ?? 100 };
    },
    // The scene's acoustics (Scene configuration → Ambience): open air, a hall or a cave.
    acoustics: () => canvas?.scene?.getFlag?.(ID, "acoustics") ?? null,
    // Where the GM chose none: the room around the sound, from the walls of the scene this client views.
    room: (data) => {
      const r = roomFor(data, {
        sceneAcoustics: canvas.scene?.getFlag(ID, "acoustics") || null,
        viewedScene: canvas.scene?.id,
        enabled: canvas.ready && hotSetting("roomAcoustics") && hotSetting("roomReverbLocal"),
        cache: rooms,
        gridPx: canvas.grid.size,
      });
      if (r.kind !== "reverb") return null;
      // This player's echo strength scales the room too.
      const level = reverbSend(r.room, hotSetting("surfaceEcho"));
      return { node: (context) => reverb.send(context, r.room, level) };
    },
    // A wall between this player and the sound muffles it, in any scene.
    muffle: (data) => {
      const at = data.animaterAt;
      if (!hotSetting("muffleWalls") || !canvas.ready || (data.animaterScene && data.animaterScene !== canvas.scene?.id)) return false;
      const ear = soundEar();
      if (!ear) return false;
      const level = typeof data.animaterLevel === "string" ? canvas.scene?.levels?.get?.(data.animaterLevel) : undefined;
      return CONFIG.Canvas.polygonBackends.sound.testCollision(ear, at, { type: "sound", mode: "any", ...(level ? { level } : {}) }) === true;
    },
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
  // Afterimages show at Full, Light and Balanced, unless this client turned them off.
  const afterimages = createAfterimages({ makeSprite: (texture) => new globalThis.PIXI.Sprite(texture), place: placeUnder,
    enabled: () => hotSetting("afterimagesLocal") !== false && qualityRank(localQuality()) >= 2 });
  // A teleport's arrival effect carries its streak (playTeleport): every client draws it as that effect arrives.
  // Its departure effect carries its vanish: every client hides the token until it has moved (holdHidden).
  Hooks.on("createSequencerEffect", (effect) => {
    const vanish = effect?.data?.animaterVanish;
    if (!vanish?.tokenId || (effect.data.sceneId && effect.data.sceneId !== canvas?.scene?.id)) return;
    const ms = Math.min(30000, Number(vanish.ms) || 0), grace = Number(vanish.grace);
    try { holdHidden(canvas.scene?.tokens?.get(vanish.tokenId)?.object, ms, { origin: vanish.from, ...(Number.isFinite(grace) ? { grace: Math.min(30000, Math.max(0, grace)) } : {}) }); }
    catch (error) { console.warn("Animater teleport:", error?.message ?? error); }
  });
  Hooks.on("createSequencerEffect", (effect) => {
    const trail = effect?.data?.animaterTrail;
    if (!trail) return;
    try {
      const token = streakToken(trail, { sceneId: effect.data.sceneId, scene: canvas?.scene, isGM: game.user.isGM });
      if (token) afterimages.streak(token.mesh, trail.tint, streakLayout(trail.from, trail.to));
    } catch (error) { console.warn("Animater afterimages:", error?.message ?? error); }
  });
  motions = new TokenMotionPlayer({ beforeStart: (token) => conditionBody?.restore(token), grid: () => canvas.grid?.size ?? 100, fragments: { start: (...args) => createFragmentRenderer({ PIXI: globalThis.PIXI, grid: () => canvas.grid?.size ?? 100 }).start(...args) }, afterimages });
  // Lasting conditions move the creature itself; one-off motions take priority.
  conditionBody = new ConditionBody({ tokenFx: () => tokenFx, busy: (token) => motions.active.has(token), enabled: () => allowsMotion(localQuality()) });
  // Idle life: creatures in view breathe or hover through ConditionBody's lowest kinds.
  idleLife = new IdleLife({ body: conditionBody,
    strength: () => { try { return hotSetting("idleLifeStrength"); } catch { return 1; } },
    kinds: () => ({ breathe: hotSetting("idleBreathing") !== false && hotSetting("idleBreathingLocal") !== false, hover: hotSetting("idleHover") !== false && hotSetting("idleHoverLocal") !== false }),
    enabled: () => hotSetting("idleLife") !== false && hotSetting("idleLifeLocal") !== false && qualityRank(localQuality()) >= 2 && !!canvas?.ready,
    tokens: () => canvas.tokens?.placeables ?? [],
    view: () => {
      const stage = canvas.stage, s = stage?.scale?.x || 1, [sw, sh] = canvas.screenDimensions ?? [window.innerWidth, window.innerHeight];
      return stage ? { x: stage.pivot.x - sw / 2 / s, y: stage.pivot.y - sh / 2 / s, width: sw / s, height: sh / s } : null;
    },
    statuses: (token) => [...Array.from(token.actor?.statuses ?? []), ...(token.actor?.itemTypes?.condition?.map((c) => c.slug) ?? [])],
    defeated: (token) => isDefeated(token.actor, game.system.id === "daggerheart" ? DH_DEFEATED_STATUSES : [defeatedStatusId()]),
    levelBase: () => canvas.level?.elevation?.base ?? 0 });
  let idlePending = null;
  const scheduleIdle = () => { idlePending ??= setTimeout(() => { idlePending = null; try { idleLife.sync(); } catch (error) { console.warn("Animater idle life:", error?.message ?? error); } }, 150); };
  for (const hook of ["canvasReady", "canvasPan", "createToken", "updateToken", "deleteToken", "updateActor", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "createItem", "deleteItem", "sightRefresh", "clientSettingChanged", "updateSetting"])
    Hooks.on(hook, scheduleIdle);
  Hooks.on("canvasTearDown", () => { clearTimeout(idlePending); idlePending = null; idleLife.clear(); });
  // Wounded looks: every client reads the same HP and draws the look locally (a Tokenshade
  // look under its own key, beside any condition looks, and a hunch or limp through ConditionBody).
  woundedLooks = new WoundedLooks({ body: conditionBody, fx: () => tokenFx, preset: () => builtinPreset("Wounded"),
    enabled: () => hotSetting("woundedLooks") !== "off" && hotSetting("woundedLooksLocal") !== false && !!canvas?.ready,
    mode: () => hotSetting("woundedLooks"),
    fxAllowed: () => allowsTokenFx(localQuality()) && tokenFx.ready(),
    motionAllowed: () => allowsMotion(localQuality()),
    tokens: () => canvas.tokens?.placeables ?? [],
    hp: (actor) => hpState(actor, game.system.id),
    defeated: (token) => isDefeated(token.actor, game.system.id === "daggerheart" ? DH_DEFEATED_STATUSES : [defeatedStatusId()]),
    moving: tokenMoving });
  let woundPending = null;
  const scheduleWounds = () => { woundPending ??= setTimeout(() => { woundPending = null; try { woundedLooks.sync(); } catch (error) { console.warn("Animater wounded looks:", error?.message ?? error); } }, 120); };
  for (const hook of ["canvasReady", "createToken", "deleteToken", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "createItem", "deleteItem", "sightRefresh", "clientSettingChanged", "updateSetting"])
    Hooks.on(hook, scheduleWounds);
  Hooks.on("updateActor", (actor, changes) => {
    const track = hpPath(actor, game.system.id).replace(/\.value$/, "");
    if (foundry.utils.hasProperty(changes, track)) scheduleWounds();
  });
  Hooks.on("updateToken", (doc, changes) => {
    scheduleWounds();
    // A move: a badly hurt creature limps for as long as it is under way.
    if ("x" in changes || "y" in changes) { try { woundedLooks.poke(); } catch (error) { console.warn("Animater wounded looks:", error?.message ?? error); } }
  });
  Hooks.on("canvasTearDown", () => { clearTimeout(woundPending); woundPending = null; woundedLooks.clear(); });
  guardSequencerMotions(globalThis.Sequencer?.MotionManager, { claims: (data) => {
    if (!hotSetting(MOTION_PRIORITY)) return false;
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
    if (data?.sender !== clientId) { showcaseTools?.receive(data,senderId); receiveKillCam(data, senderId); receiveDispel(data, senderId);void receiveMotion(data); void receiveOptionalFx(data); flash?.receive(data); receiveFinished(data); receiveMarksClear(data, senderId); receiveActivityStop(data, senderId); void receiveTeleport(data, senderId).catch((e) => console.warn("Animater teleport:", e.message)); void receiveDisplace(data, senderId).catch((e) => console.warn("Animater finisher:", e.message)); void receiveMovePick(data, senderId).catch((e) => console.warn("Animater push/pull:", e.message)); }
  });
  Hooks.on("canvasTearDown", () => {
    void persistentStates?.clear();
    conditionBody?.clear();
    motions.stop();
    motions.afterimages?.clear();
    void optionalFx.stop();
    tokenFx.clear();
    void runtime?.stop();
    showcaseTools?.clear();
    app?.workspace?.creatureShowcase?.stop();
    app?.workspace?.creatureShowcase?.restoreBossWindow();
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
  // first token look of the session does not freeze the canvas while it compiles (and
  // map distortion's scene filter, on a client that draws it).
  let warming=null;
  const warmTokenFx=()=>void setTimeout(()=>{
    const renderer=canvas?.ready?canvas.app?.renderer:null;
    if(!renderer||!globalThis.PIXI?.Program||!allowsTokenFx(localQuality()))return;
    const sceneWarp=distortsHere();
    // A warm-up already running is kept, unless this client has just started drawing map distortion.
    if(warming){if(!sceneWarp||warming.sceneWarp)return;warming.stop();}
    const run=warmShaders(globalThis.PIXI,renderer,{sceneWarp});
    run.sceneWarp=sceneWarp;warming=run;
    run.catch(error=>console.warn('Animater Tokenshade warm-up:',error.message)).finally(()=>{if(warming===run)warming=null;});
  },3000).unref?.();
  // Without background compiling, map distortion's scene filter is built now, while the scene loads, rather than
  // at the first blast; with it, the warm-up above does it.
  const prepareShaders=()=>{
    try{const renderer=canvas?.ready?canvas.app?.renderer:null;if(renderer&&globalThis.PIXI?.Program&&distortsHere())buildSceneWarpNow(globalThis.PIXI,renderer);}
    catch(error){console.warn('Animater map distortion warm-up:',error.message);}
    warmTokenFx();
  };
  rewarmShaders=prepareShaders;
  Hooks.on('canvasReady',prepareShaders);
  if(canvas?.ready)prepareShaders();
  runtime = new AnimaterRuntime({
    soundCatalog: () =>
      installedSoundCatalog(game.modules, globalThis.Sequencer?.Database),
    get database() {
      return globalThis.Sequencer?.Database;
    },
    enabled: () => acceptsEvents() || hasOwnApproved(),
    weaponScale: () => Number(hotSetting("weaponScale")) || 1,
    // Effects light the scene (world setting); in daylight only when allowed.
    effectLights: () => hotSetting("effectLighting") !== false
      && (hotSetting("effectLightingDaylight") !== false || (canvas?.environment?.darknessLevel ?? 0) > 0),
    // Shots stop at walls (world setting); on while the setting is not registered.
    projectileWalls: () => { try { return hotSetting("projectileWalls") !== false; } catch { return true; } },
    // Harmful plays leave ground marks (world setting).
    groundMarks: () => hotSetting("groundMarks") !== false,
    // Fast motions leave afterimage trails (world setting; off sends every motion as Never).
    afterimages: () => hotSetting("afterimages") !== false,
    // Hit streaks land harder (world setting); a streak lasts one combat turn, else 12 s.
    momentum: () => { try { return hotSetting("momentum") !== false; } catch { return true; } },
    turnKey: () => { const c = game.combat; return c?.started ? `${c.id}:${c.round}:${c.turn}` : null; },
    // Big blasts, lasting fire and teleports bend the scene (world setting).
    mapDistortion,
    // Big blasts shake each screen's view (world setting): their shocks are planned even with map distortion off.
    cameraShake: () => shakeSetting("cameraShake", true) !== false,
    // How far a blast's shockwave ripples, as a multiple of its radius (world setting).
    shockwaveReach: () => { try { return Number(hotSetting("shockwaveReach")); } catch { return undefined; } },
    // A two-handed heavy weapon: its critical hit sends a shockwave.
    heavyItem: (item) => heavyItem(item, game.system.id),
    // Whether a used item deals damage, so its cast or use marks the floor (a buff that picks an element does not).
    itemDamages: (item) => usedItemDamages(item, game.system.id),
    // The element of that damage, for a placed area no damage roll names one for.
    itemElement: (item, context) => usedItemElement(item, game.system.id, context?.activity),
    // The level this client views and its floor, for a mark whose source token names none.
    viewedLevel: () => { const level = canvas?.level; return level?.id ? { level: level.id, elevation: level.elevation?.base } : null; },
    // The scene this client views, for a sound whose token names none.
    viewedScene: () => canvas?.scene?.id ?? null,
    // The first wall on a line ("sight" or "move"), and whether it is a door, on the shooter's level (Foundry
    // otherwise tests the level this client views). A failing backend throws, and the runtime plays its flights as before.
    collides: (a, b, type, source) => {
      const levelId = (source?.document ?? source)?.level;
      const level = typeof levelId === "string" ? canvas.scene?.levels?.get?.(levelId) : undefined;
      return wallHit(CONFIG.Canvas.polygonBackends[type].testCollision(a, b, { type, mode: "closest", ...(level ? { level } : {}) }), CONST.WALL_DOOR_TYPES.DOOR);
    },
    usersFor: (tier) => usersForTier(Array.from(game.users?.contents ?? game.users?.values?.() ?? []), tier),
    soundUsers: () => usersForSound(Array.from(game.users?.contents ?? game.users?.values?.() ?? [])),
    recipes,
    riderRecipes: (event, saved) => game.system.id === "pf2e" ? riderRecipes(event, hotSetting("featureCatalog"), saved, { customEnabled: enabled(), soundCatalog: installedSoundCatalog(game.modules, globalThis.Sequencer?.Database) }) : [],
    flashBefore: (recipe, context) => flash?.before(recipe, context),
    pickTeleport,
    teleport,
    place: placeTeleport,
    previewTeleport,
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
    surfaceSounds: () => hotSetting(SURFACE_SETTING) !== false,
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
      lastingMode: () => hotSetting("lastingMode"),
      recipes,
      // Your own lasting recipes follow the same switch as every other custom recipe.
      customEnabled: () => enabled(),
      // Filling AA's gaps: a condition or effect AA animates stays with AA.
      yields: (item) => (aaFillGaps() || taFillGaps()) && yieldsToAA({ type: "effect", item }),
      catalog: () => runtime.getCatalog(),
      state: (kind) => hotSetting(game.system.id==='sf2e'?sfSettingKey(kind):game.system.id==='dnd5e'?dndSettingKey(kind):game.system.id==='daggerheart'?dhSettingKey(kind):kind === "condition" ? "conditionCatalog" : "effectCatalog"),
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
      builtinStates:(token)=>game.system.id==='daggerheart'?dhDefeatedStates(token.actor,hotSetting(DEFEATED_LOOK)):defeatedStates(token.actor,{mode:hotSetting(DEFEATED_LOOK),statusId:defeatedStatusId()}),
      // A token deleted or left behind with its scene is not drawn on, and only existing documents are tied.
      tokenAlive:(token)=>!token?.destroyed&&(typeof fromUuidSync!=="function"||!token?.document?.uuid||!!fromUuidSync(token.document.uuid,{strict:false})),
      documentExists:(uuid)=>typeof fromUuidSync!=="function"||!!fromUuidSync(uuid,{strict:false}),
      body:{add:(...a)=>conditionBody?.add(...a),remove:(...a)=>conditionBody?.remove(...a)},
      origin: (item, recipe) => recipeOrigin(recipe, { item }),
      trace: (status, detail, recipe, meta) => runtime.trace(status, detail, recipe, meta),
    });
    for (const hook of ["createActiveEffect","updateActiveEffect","deleteActiveEffect","createItem", "updateItem", "deleteItem", "updateActor", "createToken", "deleteToken", "canvasReady", "updateWorldTime", "updateCombat", "deleteCombat", "updateUser", "controlToken"])
      Hooks.on(hook, () => persistentStates.schedule());
    // Moving/resizing an ordinary token only changes its own attached looks.
    // The controlled observer can change everybody's perceived conditions.
    const scheduleTokenState = token => {
      const object = token?.object ?? token;
      if (object?.controlled || !token?.id) persistentStates.schedule();
      else persistentStates.schedule([token.id]);
    };
    Hooks.on('updateToken', scheduleTokenState);
    // Hovering or selecting refreshes tokens many times a second; only a change a look depends on re-checks.
    const lookChanged = tokenLookChanged();
    Hooks.on("refreshToken", (token) => { if (lookChanged(token)) scheduleTokenState(token); });
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
  showcaseTools=createCreatureShowcaseTools({
    resolve:showcaseRecipe,
    sounds:()=>installedSoundCatalog(game.modules,globalThis.Sequencer?.Database),
    catalog:()=>runtime.getCatalog(),
    trace:(status,detail)=>runtime.trace(status,detail),
    quality:localQuality,canFocus:()=>!killCam.playing,clientId,
    movement:previewShowcaseMovement,
  });
  game.modules.get(ID).api = {
    creatureShowcase:tokenId=>clone(showcaseTools.snapshot(tokenId)),
    bossEntrance:(tokenId,options)=>showcaseTools.playBoss(tokenId,options),
    stopBossEntrance:options=>{ app?.workspace?.creatureShowcase?.restoreBossWindow();return showcaseTools.stopBoss(options); },
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
    // Wipes ground marks: a GM's screen and every connected one (everyone: false for only yours), a player's own.
    clearGroundMarks: (options) => clearGroundMarksApi(options),
    // Read-only views for live checks (tools/live/*.mjs): what this screen perceives of a moving token (seen: its
    // tracks show; heard: its steps play), and how many marks it has laid and this view shows.
    debug: {
      movementPerception: (token) => {
        const t = typeof token === "string" ? canvas.tokens?.get(token) : token;
        return t ? movementPerception(t, t.document, canvas.level?.id) : null;
      },
      movementMarks: (id) => movementFeel.marksOf?.(id) ?? null,
    },
    // GM only: share codes (one or several, or a list of them), export JSON, an export object or a recipe array,
    // checked and merged by id like the Import box. Returns { added, replaced, skipped }.
    importRecipes: async (data) => {
      try {
        if (!game.user.isGM) throw Error("Only a GM can import recipes.");
        const plan = planRecipeImport(data, recipes());
        if (plan.incoming.length) {
          await game.settings.set(ID, "recipes", { schema: 1, recipes: plan.recipes });
          persistentStates?.schedule();
          app?.workspace?.render();
        }
        const { added, replaced, skipped } = plan;
        ui.notifications.info(`Animater: ${added} recipe${added === 1 ? "" : "s"} added, ${replaced} replaced${skipped ? `, ${skipped} unchanged starter${skipped === 1 ? "" : "s"} skipped` : ""}.`);
        return { added, replaced, skipped };
      } catch (error) {
        ui.notifications.error(`Animater: ${error.message}`);
        throw error;
      }
    },
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
    stop: () => { app?.workspace?.creatureShowcase?.stop();if(game.user.isGM)showcaseTools?.stopBoss();return runtime.stop(); },
  };
  registerAATakeover({
    // Filling gaps, AA keeps whatever it animates: Animater only stops AA for items AA has nothing for.
    enabled: () => acceptsEvents() && aaTakeover() && !aaFillGaps(),
    // Conditions and effects are Animater's lasting animations, not recipes: AA stops for those too.
    resolve: (event) => resolveEvent(event) ?? (event.type === "effect" && persistentStates?.covers(event.item) ? true : null),
    context: () => ({ systemId: game.system.id, userId: game.user.id, twoe: ["pf2e", "sf2e"].includes(game.system.id) ? twoeEvent : null }),
  });
  // The same in front of Trigger Animations, once its API is up (now, or when it says it is ready).
  const taTakeoverOptions = {
    enabled: () => acceptsEvents() && taTakeover() && !taFillGaps(),
    resolve: (event) => resolveEvent(event) ?? (event.type === "effect" && persistentStates?.covers(event.item) ? true : null),
    systemId: () => game.system.id,
  };
  if (game.modules.get(TA_ID)?.active && !registerTATakeover(taTakeoverOptions)) Hooks.once("triggerAnimations.ready", () => registerTATakeover(taTakeoverOptions));
  registerSpellArsenal();
  // Combat flash screens: the active GM plays one to everyone when combat starts or ends.
  flash = flashScreens({
    ID, clientId,
    quietHere: () => qualityRank(localQuality()) === 0,
    killCamLength: (actor) => killCamWait(actor),
    killFinishing: (actor) => killsPlaying.get(actor?.uuid) ?? null,
    resolveMedia: (src) => (!src || /\.(webm|mp4|png|jpe?g|webp|gif|svg)$/i.test(src) ? src : runtime.getCatalog().find((i) => i.key === src || i.key.startsWith(`${src}.`))?.file ?? ""),
    trace: (status, detail) => runtime.trace(status, detail),
  });
  void flash.tidy().catch((error) => console.warn("Animater | flash screen cleanup failed", error));
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
  // Splatter's blood follows the damage (integrations/splatter.mjs): Splatter's own splat for this change is
  // called off (it reads the HP it left in options.oldHpVal, registered before this hook), and Animater splats instead.
  const bloodSync = () => splatterReady() && acceptsEvents() && hotSetting(SPLATTER_SYNC);
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (!foundry.utils.hasProperty(changes, hpPath(actor, game.system.id))) return;
    options.animaterHpBefore = hpOf(actor);
    if (bloodSync()) { delete options.oldHpVal; options.animaterBlood = true; }
  });
  const splatterSetting = (key, fallback) => { try { return game.settings.get(SPLATTER_ID, key); } catch { return fallback; } };
  // Hidden tokens leave no blood, so none gives them away.
  const splatBlood = (actor, token, before) => {
    if (token.document?.hidden || !splatterOn(splatterSetting, game.combat)) return;
    const after = hpOf(actor), ids = { actorId: actor.id, tokenId: token.id };
    const damage = recallDamage(damageLog, ids), crit = damage?.crit === true || recallAttribution(damageLog, ids)?.crit === true;
    const scale = splatScale({ before, after, type: damage?.type, crit, size: tokenSize(token.document), threshold: Number(splatterSetting("bloodsplatterThreshold", 100)) });
    if (!scale) return;
    // A kill's blood waits for the last enemy's screen (Finish Him!).
    const wait = (Number(splatterSetting("bloodsplatterDelay", 0)) || 0) + (after?.down ? (flash?.finaleLength?.(actor) ?? 0) + killCamWait(actor) : 0);
    setTimeout(() => { try { CONFIG.Splatter.splat(token, { scale }); } catch (error) { runtime.trace("Blocked", `Splatter: ${error.message}`); } }, Math.max(0, wait));
  };
  // Finishers play on the real token (finisher-play.mjs): travel lands, the token is moved
  // there, then it vanishes, stays as a body, or stays.
  const finisherHost = (attacker) => ({
    gridSize: () => canvas.grid.size,
    landing: finisherLanding,
    wallHit: finisherWallHit,
    play: (recipe, context) => new Promise((resolve) => {
      runtime.play(installedStages(recipe), context, { onStart: (started) => resolve(started.playbackPlan) })
        .then(() => resolve(null), (error) => { runtime.trace("Blocked", error.message); resolve(null); });
    }),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fade: (token) => runtime.play({ id: "animater-finisher-fade", name: "Finisher fade", trigger: "manual", stages: [{ kind: "motion", motion: "fade", subject: "source", duration: 900, motionEnd: "hold", assets: [] }] }, { source: token, targets: [] }),
    commit: (token, data) => commitDisplace(token, data, attacker),
    trace: (status, detail) => runtime.trace(status, detail),
  });
  // Resolves playFinisher's answer: true played, false a write failed, null never played.
  const runFinisher = (recipe, { mover, attacker }) => {
    const dead = hpOf(mover.actor)?.down === true;
    return playFinisher({ recipe, mover, attacker, dead }, finisherHost(attacker)).catch((error) => { runtime.trace("Blocked", error.message); return null; });
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
      // A play that never started (blocked) takes its mark back, so the kill plays it in full.
      void runFinisher(recipe, { mover, attacker: event.source }).then((played) => { if (played === null) announceFinished(keyOf(mover), false); });
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
      : killFinisher(recipes(), item, hotSetting(DEFAULT_FINISHER), { crit, damageType: recallDamage(damageLog, ids)?.type ?? by?.type, defaultEnding: hotSetting(DEFAULT_FINISHER_ENDING) });
    if (!recipe) return null;
    // The crit already played a finisher's travel on this token: only an ending is left. A critical
    // killing blow is that crit's own damage (the same finisher's mark); after a save crit, whichever
    // finisher the kill chose (the default included) only ends it, never travels again. Marks are used once.
    const endingOnly = saveKey ? finished.consume(saveKey) : by?.crit === true && finished.consume(finishedKey({ ...base, recipeId: recipe.id }));
    return { recipe, attacker, endingOnly };
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
  const finishOnly = async (recipe, token, attacker) => {
    const host = finisherHost(attacker), ending = recipe.finisher?.ending;
    host.trace("Finisher", `${recipe.name}: ${token.name ?? "token"} (ending)`);
    try {
      if (ending === "vanish") { await host.fade(token); await host.commit(token, { hidden: true, finisher: recipe.id }); }
      else if (ending === "body") await host.commit(token, { defeated: true, finisher: recipe.id });
      return true;
    } catch (error) { host.trace("Blocked", `Finisher ${recipe.name}: ${error.message}`); return false; }
  };
  // The collapse (or dramatic death) on a drop to 0 HP, else the energy-damage flash.
  const playDamageMoment = (actor, token, dropped) => {
    const type = recallDamage(damageLog, { actorId: actor.id, tokenId: token.id })?.type;
    const recipe = dropped ? (hotSetting(DRAMATIC_DEATHS) ? deathRecipe(type, COLLAPSE) : COLLAPSE) : hitRecipe(type);
    const playable = recipe && installedStages(recipe);
    if (!playable?.stages.length) return;
    void runtime.play(playable, { source: token, targets: [] }).catch((error) => runtime.trace("Blocked", error.message));
  };
  // A use finisher's travel (and its move write) still playing on this token finishes first,
  // so the kill finisher starts from where it landed.
  const motionSettled = async (token, limit = 4000) => {
    for (let waited = 0; motions?.active.has(token) && waited < limit; waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
  };
  const playKill = async (actor, token, kill) => {
    // The last enemy falling: its screen (Finish Him!) plays first, then the finisher.
    // The slow-motion kill-cam plays before both (Finish Him! waits for it too).
    const finale = (flash?.finaleLength?.(actor) ?? 0) + killCamWait(actor);
    await Promise.all([motionSettled(token), finale ? new Promise((resolve) => setTimeout(resolve, finale + 150)) : null]);
    if (kill.endingOnly) return void await finishOnly(kill.recipe, token, kill.attacker);
    // Nothing played and nothing was written: the old collapse stands in.
    if ((await runFinisher(kill.recipe, { mover: token, attacker: kill.attacker })) === null) playDamageMoment(actor, token, true);
  };
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    const change = hpChange(options.animaterHpBefore, hpOf(actor));
    if (userId !== game.user.id || !acceptsEvents() || !change) return;
    const dropped = change.dropped;
    const tokens = (actor.getActiveTokens?.() ?? []).filter((token) => token.document?.parent?.id === canvas.scene?.id);
    if (options.animaterBlood) for (const token of tokens) splatBlood(actor, token, options.animaterHpBefore);
    if (!dropped && !hotSetting(DAMAGE_REACTIONS)) return;
    // An NPC's killing blow: the slow-motion kill-cam here and on every screen that sees it, finisher or not.
    const camMs = dropped ? killCamWait(actor) : 0;
    for (const token of tokens) {
      if (camMs && !token.document?.hidden) {
        const cam = { type: "kill-cam", sender: clientId, userId: game.user.id, sceneId: token.document.parent?.id, tokenId: token.id, ms: camMs };
        try { game.socket.emit(`module.${ID}`, cam); } catch (error) { runtime.trace("Blocked", `Kill-cam: ${error.message}`); }
        killCam.play(cam);
      }
      const kill = dropped ? killFinisherFor(actor, token) : null;
      if (kill) {
        // Kept while it plays: the drop's flash screen (Last One Standing) waits for it.
        const run = playKill(actor, token, kill).catch((error) => runtime.trace("Blocked", error.message));
        killsPlaying.set(actor.uuid, run);
        void run.then(() => { if (killsPlaying.get(actor.uuid) === run) killsPlaying.delete(actor.uuid); });
      }
      else playDamageMoment(actor, token, dropped);
    }
  });
  // Blood on the lens (engines/camera/lens-blood.mjs), decided on each player's screen from the damage it heard
  // about (damageLog) and the HP it last saw: preUpdateActor's animaterHpBefore exists only on the updating screen,
  // so the HP before each change is kept here, filled when the canvas is drawn and when tokens are made.
  const lensHp = new Map();
  const lensKeep = (actor) => { const s = actor?.uuid ? hpOf(actor) : null; if (s) lensHp.set(actor.uuid, s); };
  const lensFill = () => { lensHp.clear(); for (const t of canvas.tokens?.placeables ?? []) lensKeep(t.actor); };
  Hooks.on("canvasReady", lensFill);
  if (canvas?.ready) lensFill();
  Hooks.on("createToken", (doc) => lensKeep(doc.actor));
  // Splatter's blood (its colour, and whether it bleeds at all) when it is active, else Animater's own rules.
  const splatterActive = () => game.modules.get(SPLATTER_ID)?.active === true;
  const splatterSettingOf = (key) => game.settings.get(SPLATTER_ID, key);
  const lensBloodOf = (token) => tokenBlood(token);
  const lensScreen = (p) => {
    try { const s = canvas.clientCoordinatesFromCanvas?.(p) ?? canvas.stage.worldTransform.apply(p); return { x: s.x, y: s.y }; } catch { return null; }
  };
  const lensView = () => ({ width: window.innerWidth, height: window.innerHeight });
  // This screen's look; the showcase may preview another amount or gore without saving it.
  const lensLook = (variant = {}) => ({ amount: variant.amount ?? shakeSetting("lensBloodAmount", "heavy"), gore: variant.gore ?? shakeSetting("surfaceGore", "full"), quality: localQuality() });
  const lensWorldOn = () => shakeSetting("lensBlood", true) !== false;
  const lensLocalOn = () => shakeSetting("lensBloodLocal", true) !== false;
  // The damage-type effects beside the blood (engines/camera/lens-effects.mjs), switched on their own.
  const effectsWorldOn = () => shakeSetting("lensEffects", true) !== false;
  const effectsLocalOn = () => shakeSetting("lensEffectsLocal", true) !== false;
  const tunnelOn = () => shakeSetting("lensTunnel", true) !== false;
  const heartbeatOn = () => shakeSetting("lensHeartbeat", true) !== false;
  const beat = (plan) => {
    const ctx = game.audio?.interface;
    if (!ctx || !plan?.length) return;
    if (ctx.state === "suspended") void Promise.resolve(ctx.resume?.()).catch(() => {});
    try { stopHeartbeat?.(); } catch { /* gone */ }
    stopHeartbeat = playHeartbeat(ctx, ctx.gainNode ?? ctx.destination, plan, { volume: Number(shakeSetting("surfaceVolume", 1)) });
    heartbeatUntil = Date.now() + (plan.at(-1)?.at ?? 0) + 600;
  };
  // Paints a splash (tunnel vision only with its switch on) and plays a victim's heartbeat (its own switch, so it
  // plays with the lens off on this screen too).
  // A heartbeat only for a creature with a heart (engines/motion/blood-colors.mjs HEARTLESS: undead, constructs, oozes...).
  const hasHeart = (token) => { try { return !token?.actor || creatureHasHeart(creatureBloodType({ system: game.system.id, actor: token.actor, name: token.name })); } catch { return true; } };
  const lensShow = (splash, { args, color, seed, variant, heart = true }) => {
    const look = lensLook(variant);
    // "Damage lens duration": how long a big hit's blood stays, in seconds (this player's own when set, else the GM's),
    // against the usual 4.5.
    const own = Number(shakeSetting("lensDurationLocal", 0)) || 0, seconds = own > 0 ? own : Number(shakeSetting("lensDuration", LENS_BASE_SECONDS)) || LENS_BASE_SECONDS;
    const duration = Math.min(6, Math.max(0.4, seconds / LENS_BASE_SECONDS));
    if (splash) lensBlood.splash(tunnelOn() ? splash : { ...splash, tunnel: 0 }, { seed, color, duration });
    // The hit's damage-type effects, by the same rule as the blood (the showcase past the world switch).
    const fx = lensEffectHit({ ...args, worldOn: args.preview === true || effectsWorldOn(), localOn: effectsLocalOn(), types: args.effectTypes ?? [] });
    if (fx) lensBlood.effects(fx, { seed, duration });
    if (args.role === "victim" && heart !== false && heartbeatWanted({ isGM: false, on: heartbeatOn(), ...look })) {
      const hit = splash ?? lensSplashFor({ ...args, localOn: true });
      if (hit?.tunnel > 0) beat(heartbeatPlan(hit.tunnel, { amount: hit.amount }));
    }
  };
  // The lingering tunnel and heartbeat while the player's own creature (their character on this scene, else a
  // controlled token they own) is at or under a quarter of its HP in combat. The showcase stands in a state.
  let lingerPreview = null;
  const lensMine = () => {
    const onScene = (t) => t?.document?.parent?.id === canvas.scene?.id;
    return game.user.character?.getActiveTokens?.().find(onScene) ?? canvas.tokens?.controlled?.find((t) => t.actor?.isOwner) ?? null;
  };
  const lingerNow = () => {
    if (lingerPreview) return { state: lingerPreview.state, inCombat: true, shown: true, heart: lingerPreview.heart !== false, look: lensLook(lingerPreview.variant) };
    if (game.user.isGM || !canvas?.ready) return null;
    const token = lensMine(), actor = token?.actor, raw = actor ? hpOf(actor) : null;
    const state = raw ? { ...raw, unconscious: ["unconscious", "dead", "dying"].some((s) => actor.statuses?.has?.(s)) } : null;
    return { state, inCombat: game.combat?.started === true, shown: Boolean(token) && !token.document.hidden, heart: hasHeart(token), look: lensLook() };
  };
  const lingerBeat = (now) => (now && now.heart !== false && lensWorldOn()
    ? heartbeatLinger(now.state, { isGM: false, on: heartbeatOn(), inCombat: now.inCombat, ...now.look, amount: lensAmount(now.look) ?? "subtle" }) : null);
  // The wounded view (engines/camera/lens-wounds.mjs) of the same creature: red edges from half its HP, stains that
  // stay, the world muffled; down (0 HP, dying, unconscious) the dark window, a faint uneven heartbeat, waking and death.
  // Its own switch under the Damage lens world switch; the showcase stands in a state (woundPreview).
  const woundOn = () => shakeSetting("lensWounded", true) !== false;
  let woundPreview = null, woundPhase = null, woundActor = null, woundStains = [], woundSteps = [], woundUntil = 0, woundPulse = 0, lastBeat = null;
  // What the system says of the creature: its HP, statuses (PF2e's conditions too), dying value, death saves.
  const lifeFacts = (actor) => {
    const statuses = new Set(actor?.statuses ?? []);
    for (const c of actor?.itemTypes?.condition ?? []) if (c?.slug) statuses.add(c.slug);
    const attr = actor?.system?.attributes ?? {}, dyingItem = (actor?.itemTypes?.condition ?? []).find((c) => c?.slug === "dying");
    return { systemId: game.system.id, hp: hpOf(actor), statuses: [...statuses],
      dying: { value: Number(attr.dying?.value ?? dyingItem?.value ?? 0) || 0, max: Number(attr.dying?.max) || 4 },
      death: { success: Number(attr.death?.success) || 0, failure: Number(attr.death?.failure) || 0 } };
  };
  const woundNow = () => {
    if (woundPreview) return { ...woundPreview, shown: true, look: lensLook(woundPreview.variant), key: "preview", preview: true };
    if (game.user.isGM || !canvas?.ready) return null;
    const token = lensMine(), actor = token?.actor;
    if (!actor) return null;
    const blood = lensBloodOf(token);
    return { life: lifeOf(lifeFacts(actor)), inCombat: game.combat?.started === true, shown: !token.document.hidden, heart: hasHeart(token),
      color: blood.color, bleeds: blood.bleeds, look: lensLook(), key: actor.uuid };
  };
  const woundGate = (now) => ({ isGM: false, worldOn: now?.preview === true || lensWorldOn(), localOn: lensLocalOn(), on: woundOn() });
  const woundClearSteps = () => { for (const h of woundSteps) clearTimeout(h); woundSteps = []; woundUntil = 0; };
  woundReset = () => { woundClearSteps(); woundPhase = null; woundActor = null; woundStains = []; woundPulse = 0; };
  // The steps of a death or a waking (transitionSteps): the look eased, a flash, the muffle held or let go.
  const woundPlay = (steps, now, quality) => {
    woundClearSteps();
    const last = steps.at(-1);
    woundUntil = Date.now() + last.at + last.ms;
    for (const step of steps) woundSteps.push(setTimeout(() => {
      lensBlood.wound(step.look, { ms: step.ms });
      if (step.flash) lensBlood.flash(step.flash.peak, step.flash.ms);
      if (step.muffle === "hold" && qualityRank(quality) > 1) worldMuffle.set(muffleFor({ phase: "dead", weak: 1 }, { amount: lensAmount(now.look) ?? "subtle" }), { ms: step.ms });
      if (step.muffle === "release") worldMuffle.release({ ms: WAKE.releaseMs });
    }, step.at));
    // Settled again once it has played.
    woundSteps.push(setTimeout(() => { woundUntil = 0; try { lensWound(); } catch { /* next change */ } }, last.at + last.ms + 50));
  };
  const lensWound = () => {
    const now = woundNow(), amount = now ? lensAmount(now.look) : null, quality = now?.look.quality ?? localQuality();
    // Another creature (picked up, a new scene): nothing carried over from the last one.
    if ((now?.key ?? null) !== woundActor) { woundClearSteps(); woundActor = now?.key ?? null; woundPhase = null; woundStains = []; }
    const view = woundedView(now ? { ...now, ...woundGate(now) } : null, { amount, quality });
    const wanted = Boolean(now && amount && now.shown && woundedWanted({ ...woundGate(now), quality }));
    const phase = wanted ? now.life?.phase ?? null : null, prev = woundPhase;
    woundPhase = phase;
    woundPulse = view.pulse;
    // Stains stay while HP stays low (down counts as none left); healed past their threshold they fade.
    const left = !view.stains || !now?.bleeds ? null : isDown(now.life) ? 0 : now.life.left;
    woundStains = settleStains(woundStains, { left, now: performance.now(), amount: amount ?? "heavy" });
    lensBlood.stains(woundStains);
    const steps = wanted ? transitionSteps(prev, phase, { look: view.look, quality }) : null;
    if (steps) {
      // Death: the heartbeat lets go, a few fainter beats and none.
      if (phase === "dead" && now.heart !== false && heartbeatWanted({ isGM: false, on: heartbeatOn(), ...now.look })) {
        if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
        beat(heartbeatDeath(lastBeat));
      }
      woundPlay(steps, now, quality);
      return;
    }
    if (Date.now() < woundUntil) return;
    lensBlood.wound(view.look, { ms: 900 });
    if (view.muffle) worldMuffle.set(view.muffle, { ms: 1400 }); else worldMuffle.release();
  };
  // A hit taken while hurt leaves a stain or two on the lens edges, in the creature's own blood.
  const woundHit = (splash) => {
    const now = woundNow(), amount = now ? lensAmount(now.look) : null;
    if (!now?.bleeds || !now.life) return;
    const view = woundedView({ ...now, ...woundGate(now) }, { amount, quality: now.look.quality });
    if (!view.stains) return;
    woundStains = stainsAfterHit(woundStains, { left: isDown(now.life) ? 0 : now.life.left, seed: `wound:${Date.now()}:${woundStains.length}`, now: performance.now(),
      ...lensBlood.view(), edge: splash?.edge ?? null, color: now.color, amount });
    lensBlood.stains(woundStains);
  };
  // The heartbeat while down (dying slower and fainter, uneven), on the same loop as the lingering one.
  const woundBeat = () => {
    const now = woundNow();
    if (!now || !isDown(now.life) || woundPhase === null || !heartbeatWanted({ isGM: false, on: heartbeatOn(), ...now.look })) return null;
    return heartbeatDown(now.life, { heart: now.heart, amount: lensAmount(now.look) ?? "subtle" });
  };
  const lingerTick = () => {
    lingerTimer = null;
    const down = woundBeat(), plan = down ?? lingerBeat(lingerNow());
    if (!plan) return void lensLinger();
    // A hit's own heartbeat still playing: the lingering one waits for it.
    if (Date.now() >= heartbeatUntil) {
      lastBeat = { gain: plan.gain };
      beat([{ at: 0, gain: plan.gain, dubAt: plan.dubAt ?? 280, dubGain: plan.dubGain ?? Math.round(plan.gain * 600) / 1000 }]);
      // The red edges beat with it.
      if (!down && woundPulse > 0) lensBlood.pulse(woundPulse);
    }
    lingerTimer = setTimeout(lingerTick, down ? nextBeatMs(down) : plan.intervalMs);
  };
  const lensLinger = () => {
    const now = lingerNow(), amount = now ? lensAmount(now.look) : null;
    const tunnel = now && amount && lensWorldOn() && lensLocalOn() && tunnelOn() && now.inCombat && now.shown && !now.state?.unconscious;
    lensBlood.linger(tunnel ? lingerLevel(now.state, amount) : 0);
    const plan = woundBeat() ?? lingerBeat(now);
    if (!plan) { if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; } return; }
    if (!lingerTimer) lingerTimer = setTimeout(lingerTick, plan.intervalMs);
  };
  const lensRefresh = () => { try { lensWound(); } catch (error) { runtime.trace("Blocked", `Wounded view: ${error.message}`); } try { lensLinger(); } catch { /* next change */ } };
  woundRefresh = lensRefresh;
  for (const hook of ["combatStart", "updateCombat", "deleteCombat", "controlToken", "canvasReady"]) Hooks.on(hook, lensRefresh);
  // Conditions and statuses (dying, unconscious, stable, dead) come as effects, or items in PF2e: a change to the
  // player's own creature refreshes the view (once, a moment later, for a batch of them).
  let woundSoon = null;
  const woundChanged = (doc) => {
    if (game.user.isGM) return;
    const actor = doc?.parent?.documentName === "Actor" ? doc.parent : doc?.actor ?? null;
    if (!actor?.isOwner) return;
    clearTimeout(woundSoon);
    woundSoon = setTimeout(lensRefresh, 60);
  };
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "createItem", "updateItem", "deleteItem"]) Hooks.on(hook, woundChanged);
  const lensBloodFor = (actor, before) => {
    if (game.user.isGM || !canvas?.ready || (!lensWorldOn() && !effectsWorldOn())) return;
    const after = hpOf(actor);
    if (!hpChange(before, after)) return;
    const tokens = (actor.getActiveTokens?.() ?? []).filter((t) => t.document?.parent?.id === canvas.scene?.id);
    const since = Date.now() - 15000, log = damageLog.filter((d) => d.at >= since), look = lensLook(), level = canvas.level?.id ?? undefined;
    for (const token of tokens) {
      const ids = { actorId: actor.id, tokenId: token.id };
      const damage = recallDamage(log, ids), by = recallAttribution(log, ids);
      const attacker = by?.sourceTokenId && by.sourceTokenId !== token.id ? canvas.tokens.get(by.sourceTokenId) ?? null : null;
      // The player owns the creature hit (victim) or the creature that hit it (attacker); anyone else sees nothing.
      const role = actor.isOwner ? "victim" : attacker?.actor?.isOwner ? "attacker" : null;
      // "Damage lens shows": only the hits taken, only those dealt, or both.
      if (!lensRoleWanted(role, lensWho(shakeSetting("lensWho", "both"), shakeSetting("lensWhoLocal", "")))) continue;
      const blood = lensBloodOf(token), crit = damage?.crit === true || by?.crit === true;
      const args = { isGM: false, worldOn: lensWorldOn(), localOn: lensLocalOn(), ...look, role, before, after,
        crit, bleeds: blood.bleeds,
        // Its damage type shapes the splats and shifts the blood (engines/camera/lens-blood.mjs DAMAGE_WOUNDS), and
        // its energy types play their own effects (lens-effects.mjs; Daggerheart's magic as the arcane shimmer).
        damageType: woundOf(damage ?? by ?? {}), effectTypes: lensEffectTypes({ ...(damage ?? by ?? {}), crit }),
        visible: movementPerception(token, token.document, level).visible === true, hidden: token.document.hidden === true,
        screen: lensScreen(token.center), attackerScreen: attacker ? lensScreen(attacker.center) : null, view: lensView() };
      const splash = lensSplashFor(args);
      lensShow(splash, { args, color: blood.color, seed: `${token.id}:${Date.now()}`, heart: hasHeart(token) });
      // The player's own creature hurt: a stain or two that stay (the wounded view).
      if (role === "victim" && splash && lensMine()?.actor === actor) woundHit(splash);
      return;
    }
  };
  // Creature voices (engines/sound/creature-voice.mjs; world setting "Creatures cry out when hurt"): every screen sees
  // the same HP change and the same seeded chance, so no broadcast; each plays it only if this screen hears the creature.
  // The take each token cried last, so the next is another (every screen hears the same cries, so they agree).
  const voiceQuietUntil = new Map(), voiceLast = new Map();
  const voicesOn = () => canvas?.ready && movementFeelSettingOn("creatureVoices") && movementFeelSettingOn("creatureVoicesLocal");
  // One creature's cry (attack, hurt or death) from each of its tokens on this scene this screen can hear.
  const voiceFrom = (actor, tokens, event, seed) => {
    const level = canvas.level?.id ?? undefined;
    for (const token of tokens) {
      const d = token.document;
      if (d?.parent?.id !== canvas.scene?.id || !movementPerception(token, d, level).audible) continue;
      // The token's own voice (Token configuration, Animater creature voice), else its creature's; on PF2e, PF2e
      // Creature Sounds voices the tokens not given one.
      const flags = { voice: d.flags?.[ID]?.voice, speaker: d.flags?.[ID]?.voiceSpeaker };
      if (voiceDeferred({ ...pf2eSoundsState(), ...flags })) continue;
      const own = tokenVoice(actor, flags);
      if (!own.creature) continue;
      const file = voiceFile(own.creature, event, { seed, voiceSeed: actor.uuid, voiceId: own.voiceId, avoid: voiceLast.get(token.id), bank: voiceBank() });
      if (!file) continue;
      voiceLast.set(token.id, file);
      const borrowed = voiceBorrows(voiceOf(own.creature, { voiceSeed: actor.uuid, voiceId: own.voiceId, bank: voiceBank() }), event);
      const shape = voiceShape(sizeOf(actor, token), actor.id, { hitSeed: `${seed}:${token.id}`, event, borrowed }), c = d.getCenterPoint?.() ?? token.center, where = { x: c.x, y: c.y, elevation: d.elevation ?? 0 };
      const room = movementFeelSettingOn("footstepAcoustics") ? { at: { ...where, sceneId: canvas.scene?.id, level: canvas.level?.id }, roomShare: 0.8 } : {};
      setTimeout(() => {
        try {
          if (!canvas?.ready || canvas.scene?.id !== d.parent?.id) return;
          Hooks.callAll("animater.shapeSound", { file, rate: shape.rate, ...room });
          void Promise.resolve(canvas.sounds?.playAtPosition?.(file, where, 15 * (canvas.dimensions?.distance ?? 5), { volume: shape.volume, walls: false, gmAlways: false }))
            .then((sound) => {
              const node = sound?.sourceNode?.playbackRate;
              if (node && node.value !== shape.rate) node.value = shape.rate;
            }).catch(() => {});
        } catch { /* the scene went away while it waited */ }
      }, shape.delay);
    }
  };
  const creatureVoiceFor = (actor, before) => {
    if (!voicesOn()) return;
    const after = hpOf(actor), change = hpChange(before, after);
    if (!change || actor.system?.attributes?.emitsSound === false) return;
    if ((voiceQuietUntil.get(actor.uuid) ?? 0) > Date.now() && !change.dropped) return;
    const seed = `${actor.uuid}:${before.value}:${after.value}`, event = voiceEvent({ dropped: change.dropped, seed });
    if (!event) return;
    voiceQuietUntil.set(actor.uuid, Date.now() + VOICE_COOLDOWN_MS);
    voiceFrom(actor, actor.getActiveTokens?.() ?? [], event, seed);
  };
  // An attacker voices its effort as it attacks (a grunt, a snarl, a roar), from its attack roll's chat message, which
  // every screen receives: the same seeded chance everywhere, no broadcast.
  Hooks.on("createChatMessage", (message) => {
    try {
      const who = attackSpeaker(message, game.system.id);
      if (!who || who.sceneId !== canvas.scene?.id || !voicesOn()) return;
      const token = canvas.tokens?.get(who.tokenId), actor = token?.actor;
      if (!actor || actor.system?.attributes?.emitsSound === false) return;
      const event = voiceEvent({ attack: true, seed: message.id });
      if (event) voiceFrom(actor, [token], event, message.id);
    } catch (error) { runtime.trace("Blocked", `Attack voice: ${error.message}`); }
  });
  Hooks.on("updateActor", (actor, changes, options) => {
    const before = (actor?.uuid && lensHp.get(actor.uuid)) ?? options?.animaterHpBefore ?? null;
    try { creatureVoiceFor(actor, before); } catch (error) { runtime.trace("Blocked", `Creature voice: ${error.message}`); }
    lensKeep(actor);
    if (game.user.isGM) return;
    try { lensBloodFor(actor, before); } catch (error) { runtime.trace("Blocked", `Lens blood: ${error.message}`); }
    lensRefresh();
  });
  // Damage immersion showcase (ui/damage-showcase-ui.mjs): the same decisions and drawing on the GM's own screen,
  // past the players-only rule, with the GM's own switches for the lens, tunnel and heartbeat.
  const colorNumber = (c) => (typeof c === "number" ? c : parseInt(String(c ?? "").replace(/^#/, "").slice(0, 6), 16) || bloodColor());
  const colorText = (n) => `#${(Number(n) >>> 0).toString(16).padStart(6, "0")}`;
  const previewArgs = (role, hit, variant, extra) => {
    const max = Math.max(1, Number(hit.max) || 100), lost = Math.max(0, Number(hit.lost) || 0);
    return { isGM: false, worldOn: true, localOn: lensLocalOn(), ...lensLook(variant), role, crit: hit.crit === true, bleeds: hit.bleeds !== false,
      before: { value: max, max, down: false, marked: false }, after: { value: max - lost, max, down: max - lost <= 0, marked: false },
      visible: true, hidden: false, view: lensView(), preview: true,
      // The picked damage type's lens effects ('arcane': Daggerheart's magic).
      effectTypes: lensEffectTypes({ type: extra?.damageType ?? null, crit: hit.crit === true }), ...extra };
  };
  const edgePoint = (side, view) => ({ left: { x: view.width * 0.12, y: view.height * 0.5 }, right: { x: view.width * 0.88, y: view.height * 0.45 },
    top: { x: view.width * 0.5, y: view.height * 0.1 }, bottom: { x: view.width * 0.55, y: view.height * 0.9 } }[side] ?? { x: view.width * 0.2, y: view.height * 0.5 });
  lensPreview = {
    snapshot: () => {
      const tokens = (canvas?.ready ? canvas.tokens?.placeables ?? [] : []).filter((t) => t.actor).map((t) => {
        const b = lensBloodOf(t);
        const hp = hpOf(t.actor), pc = t.actor.hasPlayerOwner === true || t.actor.type === "character";
        return { id: t.id, name: t.name, img: t.document?.texture?.src, color: colorText(b.color), bleeds: b.bleeds, pc,
          hp: hp ? { value: hp.value, max: hp.max } : null, heart: hasHeart(t), selected: t.controlled === true, targeted: t.isTargeted === true };
      });
      let presets = {};
      try {
        if (splatterActive()) for (const [type, c] of Object.entries(splatterSettingOf("BloodSheetData") ?? {})) presets[type] = String(c).slice(0, 7);
      } catch { presets = {}; }
      // Without Splatter: the GM's Blood colours table, by type with its current colours.
      if (!splatterActive()) {
        const table = bloodTable();
        for (const { key, label } of BLOOD_TYPES) presets[key] = { ...tableBlood(key, table), label };
      }
      tokens.sort((x, y) => (y.pc - x.pc) || x.name.localeCompare(y.name));
      return { scene: canvas?.scene?.name ?? "", tokens, presets, systemId: game.system.id,
        // The down states this system has, by its own names (PF2e Dying N, D&D 5e death saves, Daggerheart's death move).
        downStates: downPreviews(game.system.id).map(({ id, label }) => ({ id, label })),
        settings: { amount: shakeSetting("lensBloodAmount", "heavy"), gore: shakeSetting("surfaceGore", "full"), heartbeat: heartbeatOn(), tunnel: tunnelOn(), local: lensLocalOn(), effects: effectsLocalOn(), effectsWorld: effectsWorldOn(), wounded: woundOn() } };
    },
    hit: ({ share = 0.15, crit = false, color, bleeds = true, amount = null, gore = null, damageType = null } = {}) => {
      const variant = { amount, gore }, view = lensView();
      const args = previewArgs("victim", { lost: share * 100, max: 100, crit, bleeds }, variant,
        { screen: { x: view.width / 2, y: view.height / 2 }, attackerScreen: edgePoint(["left", "right", "top"][Math.floor(Math.random() * 3)], view), damageType });
      lensBlood.clear();
      lensShow(lensSplashFor(args), { args, color: colorNumber(color), seed: `preview:${Date.now()}`, variant });
    },
    deal: ({ damage = 8, max = 40, crit = false, color, bleeds = true, side = "left", amount = null, gore = null, damageType = null } = {}) => {
      const variant = { amount, gore }, view = lensView();
      const args = previewArgs("attacker", { lost: damage, max, crit, bleeds }, variant, { screen: edgePoint(side, view), attackerScreen: { x: view.width / 2, y: view.height / 2 }, damageType });
      lensBlood.clear();
      lensShow(lensSplashFor(args), { args, color: colorNumber(color), seed: `preview:${Date.now()}`, variant });
    },
    // Two real tokens on this scene: "mine" (the player whose screen this is) and "other". Selects mine, targets
    // other, centres the view on mine, then plays the hit either way with their own blood, HP and screen positions.
    duel: async ({ mineId, otherId, role = "victim", share = 0.15, crit = false, amount = null, gore = null, damageType = null } = {}) => {
      const mine = canvas.tokens?.get(mineId), other = canvas.tokens?.get(otherId);
      if (!mine || !other || mine === other) return false;
      mine.control({ releaseOthers: true });
      try { other.setTarget(true, { releaseOthers: true }); } catch { /* targeting is only a cue */ }
      try { await canvas.animatePan({ x: mine.center.x, y: mine.center.y, duration: 350 }); } catch { /* stays put */ }
      const victim = role === "victim" ? mine : other, attacker = role === "victim" ? other : mine;
      const blood = lensBloodOf(victim), hp = hpOf(victim.actor), max = Math.max(1, Number(hp?.max) || 100);
      const variant = { amount, gore };
      const args = previewArgs(role, { lost: Math.max(1, Math.round(share * max)), max, crit, bleeds: blood.bleeds }, variant,
        { screen: lensScreen(victim.center), attackerScreen: lensScreen(attacker.center), damageType });
      lensBlood.clear();
      lensShow(lensSplashFor(args), { args, color: colorNumber(blood.color), seed: `preview:${Date.now()}`, variant, heart: hasHeart(mine) });
      return true;
    },
    linger: ({ hp = 0.15, amount = null, gore = null, heart = true } = {}) => {
      lingerPreview = { state: { value: Math.round(100 * hp), max: 100, down: false, marked: false }, variant: { amount, gore }, heart };
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
      lensLinger();
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; lingerTick(); }
    },
    // The wounded view at an HP share (0..1), in combat or not, as the picked creature (mineId: its blood and heart):
    // its edges, a few hits' worth of lasting stains, the muffle, and at a quarter or under in combat the lingering
    // heartbeat and tunnel. 0 HP is down (unconscious).
    wounded: ({ hp = 0.3, inCombat = true, mineId = null, amount = null, gore = null } = {}) => {
      const token = mineId ? canvas.tokens?.get(mineId) ?? null : null, blood = token ? lensBloodOf(token) : { color: bloodColor(), bleeds: true };
      const left = Math.min(1, Math.max(0, Number(hp) || 0)), variant = { amount, gore }, heart = token ? hasHeart(token) : true;
      const life = left <= 0 ? lifeOf({ systemId: "", hp: { value: 0, max: 100, down: true, marked: false }, statuses: ["unconscious"] }) : { phase: "up", weak: 0, left };
      const was = woundPreview;
      woundPreview = { life, inCombat: inCombat !== false, heart, color: blood.color, bleeds: blood.bleeds, variant };
      // A new preview (or another creature) starts clean; then hits until the stains this HP keeps are there.
      if (!was || was.color !== blood.color) { woundStains = []; woundActor = "preview"; }
      lensWound();
      const look = lensLook(variant), amt = lensAmount(look) ?? "subtle", cap = stainCap(isDown(life) ? 0 : left, { amount: amt });
      const keeping = () => woundStains.filter((s) => s.fadeAt == null).length;
      for (let i = 0; blood.bleeds && woundedView({ ...woundPreview, shown: true, ...woundGate({ preview: true }) }, { amount: amt, quality: look.quality }).stains && keeping() < Math.min(cap, 6) && i < 6; i++)
        woundHit({ edge: ["left", "right", "top", "bottom"][i % 4] });
      lingerPreview = inCombat !== false && left > 0 && left <= LENS_BLOOD.lowHp ? { state: { value: Math.round(100 * left), max: 100, down: false, marked: false }, variant, heart } : null;
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
      lensLinger();
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; lingerTick(); }
    },
    // A down state by its showcase id (lens-wounds.mjs downPreviews: dying1-3, unconscious, stable, dead), as the picked
    // creature; Dead plays the death from whatever came before (dying, when nothing did).
    down: ({ state = "dying1", mineId = null, amount = null, gore = null } = {}) => {
      const entry = downPreviews(game.system.id).find((e) => e.id === state);
      if (!entry) return false;
      const token = mineId ? canvas.tokens?.get(mineId) ?? null : null, blood = token ? lensBloodOf(token) : { color: bloodColor(), bleeds: true };
      const life = lifeOf(entry.facts), variant = { amount, gore };
      if (!woundPreview) { woundStains = []; woundActor = "preview"; }
      if (life.phase === "dead" && !isDown(woundPreview?.life)) woundPhase = "dying";
      woundPreview = { life, inCombat: true, heart: token ? hasHeart(token) : true, color: blood.color, bleeds: blood.bleeds, variant };
      lingerPreview = null;
      lensWound();
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
      lensLinger();
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; lingerTick(); }
      return true;
    },
    // Waking up from a down state (from dying, when not down): the gasp back to the light, at a tenth of its HP.
    wake: ({ mineId = null, amount = null, gore = null } = {}) => {
      if (!isDown(woundPreview?.life) || woundPreview.life.phase === "dead") {
        lensPreview.down({ state: "dying1", mineId, amount, gore });
        lensBlood.wound(downLook(woundPreview?.life, lensLook({ amount, gore })), { ms: 0 });
      }
      const p = woundPreview;
      if (!p) return false;
      woundPreview = { ...p, life: { phase: "up", weak: 0, left: 0.1 } };
      lingerPreview = { state: { value: 10, max: 100, down: false, marked: false }, variant: p.variant, heart: p.heart };
      lensWound();
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
      lingerTimer = setTimeout(lingerTick, WAKE.liftMs + 400);
      return true;
    },
    // Still on screen or in the ears: a splash, a tunnel pulse, a heartbeat, the low-HP loop or a wounded state.
    busy: () => Boolean(lingerPreview) || Boolean(woundPreview) || Date.now() < woundUntil || lensBlood.alive > 0 || Date.now() < heartbeatUntil,
    stop: () => {
      if (!lingerPreview && !woundPreview && !lensBlood.alive && !worldMuffle.wired) return;
      lingerPreview = null;
      woundPreview = null;
      stopLensBlood();
      lensRefresh();
    },
  };
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
    // Midi-QOL fast-forwards an attack into its own card: the roll has no chat message, so no targets or
    // ACs, and Midi decides the hits after this hook. That attack plays on Midi's verdict instead.
    // Look for a workflow running this activity (weak workflow references or not).
    const midiWorkflow = (subject) => midiRunsActivity(globalThis.MidiQOL?.Workflow?.workflows, subject);
    Hooks.on("dnd5e.rollAttackV2", (rolls, data) => {
      if (!rolls?.some((r) => r?.parent) && midiWorkflow(data?.subject)) return;
      void dispatch(dnd5eEvent("attack", data?.subject, { rolls }));
    });
    Hooks.on("midi-qol.AttackRollComplete", (workflow) => {
      const roll = workflow?.attackRoll;
      if (!roll || roll.parent || !workflow.activity) return;
      // Each target's AC as Midi recorded it (cover and AC5e's changes in), else its actor's. With
      // "Auto check hits" off Midi leaves its hit list empty, so those ACs decide.
      const descriptors = Array.from(workflow.targetDescriptors ?? []);
      const targets = Array.from(workflow.targets ?? [], (t) => {
        const doc = t?.document ?? t, own = descriptors.find((d) => d?.token === doc?.uuid);
        return doc?.uuid ? { token: doc.uuid, ac: own ? own.ac : doc.actor?.system?.attributes?.ac?.value } : null;
      }).filter(Boolean);
      const checked = game.settings.get("midi-qol", "ConfigSettings")?.autoCheckHit !== "none";
      void dispatch(dnd5eEvent("attack", workflow.activity, { rolls: [roll], verdict: {
        messageId: workflow.itemCardId,
        targets,
        hits: checked ? Array.from(workflow.hitTargets ?? [], (t) => (t?.document ?? t)?.id).filter(Boolean) : null,
      } }));
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
      if (!acceptsEvents() || hotSetting(DUALITY_ACCENT) === false) return;
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
      visible: hotSetting("showControlButton") !== false,
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

// Foundry's movement ruler: fade (or hide) the squares a token has already walked, so its dust, prints and splashes show
// (integrations/walked-path.mjs; client setting "Walked path highlight").
Hooks.once("ready", () => {
  try { wrapRulerHighlight(CONFIG.Token?.rulerClass, () => { try { return hotSetting("walkedPathHighlight"); } catch { return "fade"; } }); }
  catch (error) { console.warn("Animater walked path:", error?.message ?? error); }
});

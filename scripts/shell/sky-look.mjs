// What the sky draws on the map: the clouds and the shadows they throw, the snow lying on the roofs and in the trees,
// the trees swaying, the heat shimmer over hot ground, and the lightning — each its own layer, placed among the others.
// It also keeps Calendaria's and FXMaster's own weather out of the way while Animater is drawing the sky itself.
//
// Only the drawing is here. What the weather IS at this moment stayed in main.mjs, because half the module reads it, and
// so did the tick that moves all this, because that tick drives every living thing on the map and is the frame loop
// rather than anything of the sky's. Both reach the drawing through the names this returns.

import { isClockSave } from "../engines/props/quiet-writes.mjs";
import { attachFilter, detachFilter } from "../engines/distortion/distortion-host.mjs";
import { windowFlashes, windowsFacing } from "../engines/motion/wall-shadows.mjs";
import { createTreeSway } from "../engines/motion/canopy-light.mjs";
import { createLightningBolts } from "../engines/motion/lightning-bolt.mjs";
import { createSurfaceLight, createTileSnow, createHeatShimmer, createLightningFlash } from "../engines/motion/sky-light.mjs";
import { createDrawnClouds } from "../engines/motion/drawn-clouds.mjs";

export function createSkyLook(ctx) {
  const { floorLayer, skyRootOf, birdRootOf, glowRootOf, bakeInto, floorTextures, outdoorOn, bothSettingsOn, hotSetting, weatherOffHere, weatherMapOn, lightningOn, undergroundScene, sunlitTiles, indoorPolygons, wallsHere, footInSquares, lightBlockedOutside, openToSky, lastStrike, snowOf } = ctx;

  // Drawn clouds (the Weather panel): just above the rain and the birds, over the roofs; their shadows on the ground, under the creatures.
  let cloudRoot = null;
  const cloudRootOf = () => {
    if (!cloudRoot || cloudRoot.destroyed) { cloudRoot = new PIXI.Container(); cloudRoot.eventMode = "none"; cloudRoot.sortLayer = 1101; canvas.primary.addChild(cloudRoot); }
    cloudRoot.elevation = birdRootOf().elevation;
    return cloudRoot;
  };
  const drawnClouds = createDrawnClouds({ PIXI: globalThis.PIXI, render: (g, rt) => bakeInto(g, rt), root: cloudRootOf, floor: floorLayer("cloudShadows", 644), grid: () => canvas?.grid?.size ?? 100, bounds: () => canvas?.dimensions?.sceneRect ?? null, screen: () => canvas?.app?.renderer?.screen ?? null });
  const surfaceLight = createSurfaceLight({ PIXI: globalThis.PIXI, root: skyRootOf, above: birdRootOf, glowing: glowRootOf, render: bakeInto, renderAt: (o, rt, transform) => canvas.app.renderer.render(o, { renderTexture: rt, clear: true, transform }) });
  // Snow lying on the roofs and in the trees (sky-light.mjs createTileSnow): just over the highest overhead tile, under the
  // birds' shadows.
  let snowRoot = null, snowTiles = [];
  const snowRootOf = () => {
    if (!snowRoot || snowRoot.destroyed) {
      snowRoot = new PIXI.Container();
      snowRoot.eventMode = "none";
      snowRoot.sortLayer = 1099;
      canvas.primary.addChild(snowRoot);
    }
    snowRoot.elevation = Math.max(Number(canvas.level?.elevation?.base) || 0, ...(canvas.tiles?.placeables ?? []).map((t) => Number(t.document?.elevation) || 0)) + 0.01;
    return snowRoot;
  };
  const tileSnow = createTileSnow({ PIXI: globalThis.PIXI, root: snowRootOf, snowTile: () => floorTextures.tile("snow", "powder") });
  // The trees swaying in the wind (canopy-light.mjs createTreeSway): on the tree tiles themselves.
  const treeSway = createTreeSway({ PIXI: globalThis.PIXI, grid: () => canvas?.grid?.size ?? 100 });
  const treeSwayOn = () => outdoorOn("treeSway");
  const swayTrees = () => { try { treeSway.attach(canvas?.ready && treeSwayOn() ? sunlitTiles().tree.map((t) => t.mesh) : []); } catch { treeSway.clear(); } };
  const tileSnowOn = () => bothSettingsOn("tileSnow");
  const rebuildTileSnow = () => {
    try {
      if (!canvas?.ready || !tileSnowOn()) { tileSnow.clear(); snowTiles = []; return; }
      const { tree, roof } = sunlitTiles(), tiles = [...roof.map((t) => ({ ...t, kind: "roof" })), ...tree.map((t) => ({ ...t, kind: "tree" }))];
      tileSnow.build({ tiles, grid: canvas.grid.size });
      snowTiles = tiles.map((t) => t.mesh);
      tileSnow.look(snowOf());
    } catch { tileSnow.clear(); snowTiles = []; }
  };
  const heatShimmer = createHeatShimmer({ PIXI: globalThis.PIXI, attach: (f) => attachFilter(canvas.primary, f, canvas.app.renderer.screen), detach: (f) => detachFilter(canvas?.primary, f), render: bakeInto });
  // The flash sits over the lighting, as the dawn and dusk colour does.
  // A flash lights the rooms only through their windows, a roof as drawn now flashing as the open map does.
  // (Over the lighting with the flash: in the map's own layers the dark would dim it.)
  let boltRoot = null;
  const boltRootOf = () => { if (!boltRoot || boltRoot.destroyed || boltRoot.parent !== canvas.effects) { boltRoot = new PIXI.Container(); boltRoot.eventMode = "none"; boltRoot.zIndex = 99996; canvas.effects.addChild(boltRoot); canvas.effects.sortChildren?.(); } return boltRoot; };
  const lightningBolts = createLightningBolts({ PIXI: globalThis.PIXI, root: boltRootOf });
  const lightning = createLightningFlash({ PIXI: globalThis.PIXI, root: () => { const fx = canvas.effects; return fx; }, bounds: () => canvas.dimensions.sceneRect, render: bakeInto,
    // Each player's own say; those who ask for less motion get a gentler flash whatever it says.
    dim: () => { let own = 1; try { own = hotSetting("lightningFlashStrength"); } catch { /* not registered yet */ } return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true ? Math.min(own, 0.5) : own; },
    cover: () => {
      // (Underground the whole scene is under the ceiling, but for its openings.)
      const rooms = indoorPolygons(), r = canvas.dimensions.sceneRect, indoors = undergroundScene() && openToSky().length ? [[r.x, r.y, r.x + r.width, r.y, r.x + r.width, r.y + r.height, r.x, r.y + r.height]] : rooms;
      if (!indoors.length) return null;
      return { indoors, open: openToSky(), windows: rooms.length ? windowsFacing(windowFlashes({ walls: wallsHere(), indoors: rooms, grid: canvas.grid.size, height: Number(hotSetting("wallShadowHeight")) || 2, foot: footInSquares(), blocked: lightBlockedOutside }), lastStrike()) : [], roofs: sunlitTiles().roof };
    } });
  // Calendaria draws its own lightning in its calendar HUD: a white flash and a bolt over the screen, not the scene. While
  // Animater's lightning flashes are on, its thunderstorm shows heavy rain there instead (in memory only: Calendaria's
  // settings are never touched), and gets its own back when they are turned off.
  const calendariaFlashes = new Map();
  const syncCalendariaFlash = async () => {
    try {
      const api = globalThis.CALENDARIA?.api;
      if (!api?.getWeatherPresets) return;
      const ours = lightningOn();
      const all = (v) => (Array.isArray(v) ? v.flatMap(all) : v && typeof v === "object" && !("id" in v) ? Object.values(v).flatMap(all) : v ? [v] : []);
      let changed = false;
      for (const preset of all(await api.getWeatherPresets())) {
        if (!preset || typeof preset !== "object") continue;
        if (ours && preset.hudEffect === "lightning") { calendariaFlashes.set(preset, preset.hudEffect); preset.hudEffect = "rain-heavy"; changed = true; }
        else if (!ours && calendariaFlashes.has(preset)) { preset.hudEffect = calendariaFlashes.get(preset); calendariaFlashes.delete(preset); changed = true; }
      }
      if (changed) for (const app of foundry.applications.instances.values()) if (/calendaria-hud/.test(app.id ?? "")) app.render?.();
    } catch { /* Calendaria changed its insides: leave it be */ }
  };
  for (const hook of ["ready", "calendaria.ready", "calendaria.weatherChange", "updateSetting", "clientSettingChanged"]) Hooks.on(hook, (first) => { if (!isClockSave(first)) syncCalendariaFlash(); });
  // FXMaster's own lightning (its Lightning filter, as Calendaria's thunderstorm puts on the scene) flashes the open map
  // only, never through a window: while Animater's flashes are on, it is stopped on this screen (the scene keeps it, so it
  // comes back when they are turned off). FXMaster makes its filters anew as the weather changes: looked at once a second.
  let fxLightningAt = 0;
  // While Animater draws Calendaria's weather ("Weather on the map"), FXMaster's effects for it (the ones Calendaria starts:
  // apiPreset_…) are hidden on this screen, their filters off; nothing of FXMaster's own settings changes, and turning ours
  // off brings them back.
  let fxWeatherAt = 0;
  const syncFxWeather = (now) => {
    if (now - fxWeatherAt < 500) return;
    fxWeatherAt = now;
    try {
      let ours = false;
      // (No weather here means none of the calendar's by way of FXMaster either.)
      try { ours = (weatherMapOn() || weatherOffHere()) && !!globalThis.CALENDARIA?.api?.getCurrentWeather?.(); } catch { ours = false; }
      for (const [id, effect] of canvas.particleeffects?.particleEffects ?? []) {
        if (!String(id).startsWith("apiPreset_")) continue;
        if (ours) { if (!effect.animaterHidden) effect.animaterHidden = true; effect.visible = false; }
        else if (effect.animaterHidden) { delete effect.animaterHidden; effect.visible = true; }
      }
      for (const [id, filter] of Object.entries(globalThis.FXMASTER?.filters?.filters ?? {})) {
        if (!String(id).startsWith("apiPreset_") || filter?.constructor?.name === "LightningFilter") continue;
        if (ours) { if (!filter.animaterHidden) filter.animaterHidden = true; filter.enabled = false; }
        else if (filter.animaterHidden) { delete filter.animaterHidden; filter.enabled = true; }
      }
    } catch { /* FXMaster changed its insides: leave it be */ }
  };
  const syncFxLightning = (now) => {
    if (now - fxLightningAt < 1000) return;
    fxLightningAt = now;
    try {
      const ours = lightningOn();
      for (const filter of Object.values(globalThis.FXMASTER?.filters?.filters ?? {})) {
        if (filter?.constructor?.name !== "LightningFilter") continue;
        if (ours) { if (!filter.animaterMuted) { filter.animaterMuted = true; filter.stop?.(); } filter.enabled = false; }
        else if (filter.animaterMuted) { delete filter.animaterMuted; filter.enabled = true; filter.play?.(); }
      }
    } catch { /* FXMaster changed its insides: leave it be */ }
  };
  return { drawnClouds, surfaceLight, tileSnow, treeSway, heatShimmer, lightningBolts, lightning, swayTrees, rebuildTileSnow, tileSnowOn, syncFxWeather, syncFxLightning, snowTiles: () => snowTiles, clear: () => {
    drawnClouds.clear();
    try { cloudRoot?.destroy({ children: true }); } catch { /* gone with the canvas */ }
    cloudRoot = null;
    surfaceLight.clear(); heatShimmer.clear(); lightning.clear(); lightningBolts.clear();
  } };
}

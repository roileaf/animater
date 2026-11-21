// The Map painting bar and the strokes it lays: floors, decorations, structures and heights.
//
// This is the shell for map making — the pointer, the ghost under it, the undo stack and the writes to the scene —
// lifted out of main.mjs, which had grown to twenty thousand lines of every feature at once. The bar itself is
// ui/decor-brush-bar.mjs and the thinking is in the engines; what is here is the hand that holds them.
//
// Everything it needs from the rest of the module arrives in `ctx`, so what map making depends on is a list you can
// read rather than a file you have to search.

import { ID } from "../core/model.mjs";
import { quietSave } from "../engines/props/quiet-writes.mjs";
import { readDecorBroken, carryDecorBroken } from "../engines/props/decor-break.mjs";
import { DOOR_KINDS, doorFor, doorwaySpan } from "../engines/motion/door-paint.mjs";
import { roomAt, roofsOf, under as underRoof } from "../engines/motion/roof-looks.mjs";
import { buildingAt as buildingPlanAt, roomCells, roomOutline } from "../engines/motion/building-plan.mjs";
import { rectRoom, roundRoom } from "../engines/motion/room-shapes.mjs";
import { DRESSING_COLOURS_MOST } from "../engines/motion/holiday-dressing.mjs";
import { ROOF_IDS, ROOF_FORM_IDS, roofFor, formFits } from "../engines/motion/roof-paint.mjs";
import { WINDOW_ART, windowFor } from "../engines/motion/window-paint.mjs";
import { alongStretch } from "../engines/motion/wall-looks.mjs";
import { WALL_MATERIAL_CHOICES, WALL_MATERIAL_IDS, WALL_THICK, WALL_LIFT, smoothRun } from "../engines/motion/wall-paint.mjs";
import { WATER_KINDS } from "../engines/motion/region-steps.mjs";
import { colourAt as floorColourAt, dabCells as floorDabCells, planFloorStroke, floorRegionName, modelMaskFor, hoverLine as floorHoverLine } from "../engines/regions/floor-brush.mjs";
import { toRegionData as floorRegionData, floorColour as floorTint, fitSize as floorFitSize, areaPixels as floorAreaPixels, toCaveRegionData, caveName, caveColour, floorName } from "../engines/regions/floor-detect.mjs";
import { nearbyClicks as smartNearbyClicks, cleanSelection } from "../engines/regions/smart-select.mjs";
import { decorSettings, strokeShapes, decorPlacements, trunkWalls, carryDecor, shapesBox } from "../engines/motion/decor-regions.mjs";
import { openBrushBar, brushChoices, BRUSH_EDGE, BRUSH_SIZE } from "../ui/decor-brush-bar.mjs";
import { edgeTouches, openAt as heightOpenAt, OPEN_EDGES_MOST, nextHeight, rampFromDrag, rampOutline, heightRegionData, rampRegionData, heightsHoverLine, heightName, refitHeights } from "../engines/regions/heights.mjs";
import { DECOR_KINDS, stampDecor, paintDecor } from "../engines/motion/decor-paint.mjs";

// The stand-in id a stroke on open ground paints under, until the region it is drawing is actually made.
export const NEW_DECOR_REGION = "animater-decor-new";

export function createMapPainting(ctx) {
  const { floorLayer, regionsHere, regionAreas, syncDecorations, decorations, decorLook, heightUnits, heightStep, heightsSceneOn, heightsOf, cliffsTopDown, floorTextures, openFloorRegionsTool, paintWallList, wallsOutsideAir, insideWall, leadGM, lifeAfterPaint, hotSetting, bothSettingsOn, pointInPolygon, sunLit } = ctx;

  // The decorations brush: paints decorations by hand, each dab a few within its circle, kept off what already stands there.
  // From a region's Decorations section (Brush) it paints that region's ticked kinds into it. From the Decorations tool in
  // Animater's controls it paints the kinds ticked on its bar (ui/decor-brush-bar.mjs): into the region a stroke starts in, when
  // that one has decorations on, or, starting on open ground, into a new region drawn round the stroke as it goes. Shift-drag
  // rubs out (the scatter leaves those places bare). What a stroke paints shows at once and is saved when it ends.
  // [ and ] make the brush smaller or bigger; right-click or Esc stops.
  let decorBrushing = null;
  // (One layer for the brush's ghost, made once: made afresh on each open, an empty container was left behind every time.)
  const decorBrushRoot = floorLayer("decorBrush");
  // While a stroke paints: its decorations shown again at most every tenth of a second, not on every dab (each built the whole
  // region again: every sprite, its filters and its snow); built whole, snow and canopy too, once the stroke ends.
  let decorBrushSyncAt = 0, decorBrushSyncTimer = null;
  const decorBrushSyncSoon = () => { if (decorBrushSyncTimer) return; const wait = Math.max(0, 100 - (performance.now() - decorBrushSyncAt)); decorBrushSyncTimer = setTimeout(() => { decorBrushSyncTimer = null; decorBrushSyncAt = performance.now(); if (decorBrushing) syncDecorations(); }, wait); };
  // The bar's own bounds, not a second copy of them: the keys and the wheel move the brush by the step its slider uses.
  const DECOR_BRUSH = BRUSH_SIZE;
  const decorBrushTarget = (p) => regionsHere().find((r) => decorSettings(r.flags?.[ID]?.decor) && regionPointIn(p, regionAreas(r)));
  const startDecorBrush = (doc = null) => {
    stopDecorBrush();
    if (!canvas?.ready || !game.user?.isGM) return;
    const view = canvas.app.view, ring = new PIXI.Graphics(), grid = () => canvas.grid.size;
    // A ghost of what the next click lays, under the ring, following the pointer and changing as the bar's choices change.
    const ghost = new PIXI.Container(); ghost.eventMode = "none"; ghost.alpha = 0.55;
    // (The ghost lies lit on the floor like the decorations it shows; the ring and the Floors tab's previews sit above the
    // scene's lighting, in canvas.interface, so they show in their own colours at night too.)
    const top = new PIXI.Container(); top.eventMode = "none"; canvas.interface.addChild(top);
    ring.eventMode = "none"; decorBrushRoot().addChild(ghost); top.addChild(ring);
    const state = decorBrushing = { id: null, doc: null, brushed: [], erased: [], circles: [], fresh: null, size: DECOR_BRUSH.usual, down: false, last: null, at: null, seed: Date.now() % 1e6, ring, ghost, ghostKey: null, ghostItems: [], ghostSeed: Date.now() % 1e5, bar: null };
    // A region's own brush shows the bar too, with only its place and its ticked kinds; either way it paints one kind at a time.
    const own = doc ? decorSettings(doc.flags?.[ID]?.decor) : null;
    const region = own ? { name: doc.name, where: own.where, kinds: Object.keys(own.kinds).filter((id) => DECOR_KINDS[id] && (DECOR_KINDS[id].set === "both" || DECOR_KINDS[id].set === own.where)) } : null;
    // Map painting: the bar's Floors tab paints floor regions, its Decorations tab decorations (each kind with its own picture).
    const thumbs = new Map(), thumb = (kind) => { if (!thumbs.has(kind)) { let pic = null; try { pic = paintDecor(kind, 7, 48, decorLook({ where: brushChoices().where }))?.canvas ?? null; } catch { /* no picture */ } thumbs.set(kind, pic); } return thumbs.get(kind); };
    state.bar = openBrushBar({ onClose: () => stopDecorBrush(), onChange: () => { draw(); if ((floorsOn() || (heightsOn() && brushChoices().heightMode === "raise")) && modelOn()) void loadSam(); refreshHeights(); refreshStatus(); }, region, thumb,
      onTab: () => { if (floorsOn() || heightsOn()) void readMap(); if (!floorsOn()) hideHover(); refreshHeights(); draw(); refreshStatus(); },
      sceneTicks: { get: () => ({ walls: heightsSceneOn("walls"), shadows: heightsSceneOn("shadows"), topdown: cliffsTopDown() }), set: (key, on) => void canvas.scene?.update(key === "topdown" ? { [`flags.${ID}.cliffView`]: on ? "topdown" : "side" } : { [`flags.${ID}.${key === "walls" ? "cliffWalls" : "heightShadows"}`]: on }) },
      // The feast the GM has called on this scene, with no calendar behind it.
      sceneHoliday: { get: () => canvas.scene?.flags?.[ID]?.holiday ?? null, set: (said) => void canvas.scene?.update({ [`flags.${ID}.holiday`]: { on: said?.on === true, colours: (said?.colours ?? []).slice(0, DRESSING_COLOURS_MOST) } }) },
      onUndo: () => { if (!state.down) void undoDecorStep().then(refreshStatus); }, onRedo: () => { if (!state.down) void redoDecorStep().then(refreshStatus); },
      onReadMap: game.settings.get(ID, "experimentalWaterRegions") === true ? () => { stopDecorBrush(); void openFloorRegionsTool(); } : null });
    const sizeNow = () => brushChoices().size;
    const at = (e) => { const p = canvas.canvasCoordinatesFromClient?.({ x: e.clientX, y: e.clientY }) ?? canvas.stage.toLocal({ x: e.clientX, y: e.clientY }); return { x: p.x, y: p.y }; };
    // Floors (engines/regions/floor-brush.mjs): the level's map read once; a stroke painted as a mask over it and shown as it goes;
    // the level's floor regions tinted while the brush is out; each stroke saved as it ends (growing the region of its floor it
    // touches, or a new one), Shift rubbing out any floor.
    const fl = state.floors = { map: null, reading: null, why: "", stroke: null, erasing: false, seed: null, claimed: null, saved: [], preview: null, pixels: null, overlay: new PIXI.Graphics() };
    fl.overlay.eventMode = "none"; top.addChildAt(fl.overlay, 0);
    const floorsOn = () => brushChoices().tab === "floors";
    // Heights (engines/regions/heights.mjs): the level's raised parts and ramps outlined with their heights while the tab is open.
    // Raise: a click raises the outline under it (Edges finds it), or picks a raised part for the wheel; Ramp: a drag up across a
    // raised edge lays a ramp; Shift-click takes either away. Each is a region of its own, saved at once.
    const heightsOn = () => brushChoices().tab === "heights";
    const hz = state.heights = { overlay: new PIXI.Graphics(), labels: new PIXI.Container(), sel: null, drag: null, busy: "", hoverText: "", wheel: null, wheelTimer: null };
    hz.overlay.eventMode = "none"; hz.labels.eventMode = "none"; top.addChild(hz.overlay, hz.labels);
    const heightsHere = () => heightsOf(canvas.scene, canvas.level?.id ?? null);
    const heightLabel = (text, x, y) => { const t = new PIXI.Text(text, { fontFamily: "Signika, sans-serif", fontSize: Math.max(14, Math.round(grid() * 0.28)), fill: 0xf3e4c4, stroke: 0x1e160e, strokeThickness: 4, fontWeight: "bold" }); t.anchor.set(0.5); t.position.set(x, y); hz.labels.addChild(t); };
    // (A label in the middle of the biggest outline's box.)
    const labelSpot = (areas) => { let best = null; for (const a of areas) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); } const size = (x1 - x0) * (y1 - y0); if (!best || size > best.size) best = { size, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; } return best ?? { x: 0, y: 0 }; };
    const shownHeight = (part) => (hz.wheel?.id === part.id ? hz.wheel.height : part.height);
    const drawRamp = (ramp, field, units, ghost) => {
      const o = hz.overlay, [lo, hi] = field.rampEnds(ramp), vx = ramp.b.x - ramp.a.x, vy = ramp.b.y - ramp.a.y, len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len, nx = (-uy * ramp.w) / 2, ny = (ux * ramp.w) / 2;
      o.lineStyle(3, 0x22180e, ghost ? 0.6 : 0.95); o.beginFill(0xb08c5a, ghost ? 0.35 : 0.6); o.drawPolygon(rampOutline(ramp)); o.endFill();
      o.lineStyle(2, 0x5a4126, 0.9); const n = Math.max(3, Math.round(len / (grid() / 5))); for (let i = 1; i < n; i++) { const cx = ramp.a.x + (vx * i) / n, cy = ramp.a.y + (vy * i) / n; o.moveTo(cx + nx, cy + ny); o.lineTo(cx - nx, cy - ny); }
      // (An arrow at the end it climbs to.)
      const up = hi >= lo ? 1 : -1, end = up > 0 ? ramp.b : ramp.a, tip = grid() * 0.12, back = grid() * 0.25, tx = end.x - up * ux * back, ty = end.y - up * uy * back;
      o.lineStyle(0); o.beginFill(0xf3d27a, 0.95); o.drawPolygon([end.x + up * ux * tip, end.y + up * uy * tip, tx + nx * 0.6, ty + ny * 0.6, tx - nx * 0.6, ty - ny * 0.6]); o.endFill();
      if (lo !== hi) heightLabel(`${ramp.kind ?? "ramp"} ${Math.min(lo, hi)} → ${Math.max(lo, hi)} ${units}`, (ramp.a.x + ramp.b.x) / 2, Math.max(ramp.a.y, ramp.b.y) + ramp.w);
    };
    const refreshHeights = () => {
      if (decorBrushing !== state) return;
      hz.overlay.clear(); for (const c of hz.labels.removeChildren()) { try { c.destroy(); } catch { /* gone */ } }
      const on = heightsOn(); hz.overlay.visible = hz.labels.visible = on; if (!on) return;
      const { parts, ramps, field } = heightsHere(), units = heightUnits();
      for (const part of [...parts].sort((a, b) => a.height - b.height)) {
        const picked = part.id === hz.sel;
        hz.overlay.lineStyle(0); hz.overlay.beginFill(0x8a7a5c, 0.18);
        for (const a of part.areas) { hz.overlay.drawPolygon(a); for (const h of a.holes ?? []) { hz.overlay.beginHole(); hz.overlay.drawPolygon(h); hz.overlay.endHole(); } }
        hz.overlay.endFill();
        // Its outline, left out where an edge is open (Roi: "it doesnt actually remove the yellow line?").
        hz.overlay.lineStyle(picked ? 4 : 2, picked ? 0xffe9a8 : 0xd9b46a, 0.95);
        for (const a of part.areas) for (const loop of [a, ...(a.holes ?? [])]) {
          const n = loop.length / 2; let down = false;
          for (let i = 0; i <= n; i++) {
            const x1 = loop[(i % n) * 2], y1 = loop[(i % n) * 2 + 1], x2 = loop[((i + 1) % n) * 2], y2 = loop[((i + 1) % n) * 2 + 1], steps = i === n ? 0 : Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6));
            for (let k = 0; k <= steps; k++) { const x = x1 + ((x2 - x1) * k) / Math.max(1, steps), y = y1 + ((y2 - y1) * k) / Math.max(1, steps); if (heightOpenAt(part, { x, y })) { down = false; continue; } if (down) hz.overlay.lineTo(x, y); else { hz.overlay.moveTo(x, y); down = true; } }
            if (i === n) break;
          }
        }
        const c = labelSpot(part.areas); heightLabel(`${shownHeight(part)} ${units}`, c.x, c.y);
      }
      for (const ramp of ramps) drawRamp(ramp, field, units, false);
      if (hz.drag) drawRamp(hz.drag.ramp, field, units, true);
      // Open edges, faint green; an open-edge stroke as it goes (red when closing).
      hz.overlay.lineStyle(0);
      for (const part of parts) { hz.overlay.beginFill(0x7fd17a, 0.16); for (const c of part.open ?? []) hz.overlay.drawCircle(c.x, c.y, c.r); hz.overlay.endFill(); }
      if (hz.open) { hz.overlay.beginFill(hz.open.erase ? 0xff6a5a : 0x7fd17a, 0.3); for (const c of hz.open.circles) hz.overlay.drawCircle(c.x, c.y, c.r); hz.overlay.endFill(); }
    };
    const heightsSummary = () => { const { parts, ramps } = heightsHere(), units = heightUnits(); if (!parts.length && !ramps.length) return "Nothing raised yet"; return `Heights here: ${[...parts.map((p) => `${p.height} ${units}`), ...(ramps.length ? [`${ramps.length} ramp${ramps.length > 1 ? "s" : ""}`] : [])].join(" · ")}`; };
    const heightsHover = (p) => { const text = heightsHoverLine({ field: heightsHere().field, at: p, mode: brushChoices().heightMode, units: heightUnits() }); if (hz.hoverText !== text) { hz.hoverText = text; refreshStatus(); } };
    const readMap = () => fl.reading ??= (async () => {
      const level = canvas.level, src = level?.background?.src, rect = canvas.dimensions?.sceneRect;
      if (!src || !(rect?.width > 0) || !(rect?.height > 0)) { fl.why = "This level has no map image to paint floors on."; return; }
      const ui = await import("../ui/floor-regions-ui.mjs");
      if (!ui.levelMapIsPlain(level?.textures)) { fl.why = "This level's map is moved, scaled or rotated in its configuration, so floors painted on it would land in the wrong place."; return; }
      const loaded = await ui.loadMapRgba(src, floorFitSize(rect.width, rect.height));
      if (!loaded?.ok) { fl.why = "The map image could not be read."; return; }
      if (decorBrushing !== state) return;
      fl.map = { rgba: loaded.rgba, width: loaded.width, height: loaded.height, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, levelId: level?.id, ui };
      refreshFloors();
    })().catch((err) => { console.warn("Animater | map painting floors", err); fl.why = "The map image could not be read."; });
    // The level's floor regions as the brush sees them, and tinted on the map in their floor's colour.
    const refreshFloors = () => {
      const m = fl.map; fl.overlay.clear(); if (!m) return;
      try { fl.saved = m.ui.savedAreaProposals(canvas.scene?.regions, { levelId: m.levelId, sceneRect: m.rect, width: m.width, height: m.height }).filter((s) => s.floor && !s.overhead).map((s) => ({ ...s, key: floorKeyOf(s.floor, s.savedChoices?.waterKind) })); }
      catch (err) { console.warn("Animater | map painting floors", err); fl.saved = []; }
      // (Cave growth the brush laid: its own regions over the floors, drawn fainter in its growth's colour.)
      try { fl.caves = m.ui.savedCaveAreas(canvas.scene?.regions, { levelId: m.levelId, sceneRect: m.rect, width: m.width, height: m.height }); }
      catch (err) { console.warn("Animater | map painting cave growth", err); fl.caves = []; }
      const sx = m.rect.width / m.width, sy = m.rect.height / m.height, toScene = (pts) => Array.from(pts, (v, i) => (i % 2 ? m.rect.y + v * sy : m.rect.x + v * sx));
      for (const s of [...fl.saved, ...fl.caves]) {
        const tint = Number.parseInt(String(s.cave ? caveColour(s.floor) : floorTint(s.floor)).slice(1), 16) || 0x2c7da0;
        fl.overlay.lineStyle(2, tint, s.cave ? 0.7 : 0.9); fl.overlay.beginFill(tint, s.cave ? 0.14 : 0.22);
        for (const loop of s.loops ?? []) { if (loop.hole) { fl.overlay.beginHole(); fl.overlay.drawPolygon(toScene(loop.points)); fl.overlay.endHole(); } else fl.overlay.drawPolygon(toScene(loop.points)); }
        fl.overlay.endFill();
      }
      fl.overlay.visible = floorsOn();
    };
    // The header's line: what floors this level has, and how many decorations are painted here.
    const refreshStatus = () => {
      if (decorBrushing !== state) return;
      const counts = new Map(); for (const s of fl.saved) counts.set(s.floor, (counts.get(s.floor) ?? 0) + 1);
      const floorsText = [...counts].map(([f, n]) => `${floorRegionName(f, []).replace(/ 1$/, "")}${n > 1 ? ` ×${n}` : ""}`);
      if (fl.caves?.length) floorsText.push(`Cave growth${fl.caves.length > 1 ? ` ×${fl.caves.length}` : ""}`);
      let painted = 0; for (const r of regionsHere()) painted += decorSettings(r.flags?.[ID]?.decor)?.brushed?.length ?? 0;
      const parts = [...floorsText, ...(painted ? [`${painted} decorations`] : [])];
      // (Hovering the map on Floors: what is under the pointer, and what a dab there would do.)
      const text = heightsOn() ? (hz.busy || (modelOn() && brushChoices().heightMode === "raise" && sam.status) || hz.hoverText || heightsSummary()) : floorsOn() && !fl.map ? (fl.why || "Reading the map…") : floorsOn() && modelOn() && sam.status ? sam.status : floorsOn() && fl.hoverText ? fl.hoverText : parts.length ? `On this level: ${parts.join(" · ")}` : "Nothing painted yet";
      state.bar?.setStatus(text, { undo: decorSteps.undo.length > 0, redo: decorSteps.redo.length > 0 });
    };
    const toImage = (p) => ({ x: ((p.x - fl.map.rect.x) * fl.map.width) / fl.map.rect.width, y: ((p.y - fl.map.rect.y) * fl.map.height) / fl.map.rect.height });
    // The stroke as it goes: a picture the size of the map image, over the map, each dab's pixels coloured in.
    const showStroke = (cells) => {
      const m = fl.map;
      if (!fl.preview) { const c = document.createElement("canvas"); c.width = m.width; c.height = m.height; fl.pixels = c.getContext("2d").createImageData(m.width, m.height); fl.preview = new PIXI.Sprite(PIXI.Texture.from(c)); fl.preview.canvas = c; fl.preview.eventMode = "none"; fl.preview.position.set(m.rect.x, m.rect.y); fl.preview.scale.set(m.rect.width / m.width, m.rect.height / m.height); top.addChildAt(fl.preview, 1); }
      const d = fl.pixels.data, hex = fl.erasing ? "#ff6a5a" : fl.heights ? "#d9b46a" : brushTint(brushChoices()), r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      const look = fl.erasing || fl.heights ? null : textureLook();
      if (!cells.length) return;
      // Only the box the dab touched is copied in (the picture is the whole map: copying all of it every dab made the brush lag),
      // and the picture goes to the screen at most once a frame.
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (const i of cells) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = look ? 225 : 130; const x = i % m.width, y = (i / m.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const pg = fl.preview.canvas.getContext("2d"), w = x1 - x0 + 1, h = y1 - y0 + 1;
      pg.putImageData(fl.pixels, 0, 0, x0, y0, w, h);
      if (look) { pg.save(); pg.beginPath(); pg.rect(x0, y0, w, h); pg.clip(); texturise(pg, m.width, m.height, 0, 0, look); pg.restore(); }
      fl.preview.visible = true;
      if (!fl.uploading) { fl.uploading = true; requestAnimationFrame(() => { fl.uploading = false; if (!fl.preview || fl.preview.destroyed) return; fl.preview.texture.update?.(); fl.preview.texture.baseTexture?.update?.(); }); }
    };
    // Hovering: what the next dab would take there, in the floor's colour (Smart edges shows it stopping at the bank), drawn
    // into a small picture the size of the ring, at most every few frames.
    let hoverAt = null, hoverTimer = null, claimedKey = null, claimedMask = null;
    // What the floor will look like when it is painted (Texture: Paint it, or As the scene says on a scene that paints floors):
    // the scene's own tile of it, at its size on the map (four squares a tile), for the previews; null to show the floor's tint.
    const textureLook = () => {
      const c = brushChoices(), m = fl.map; if (!m || c.cave) return null;
      if (!m.ui.paintsTexture(c.floor, c.texture, canvas.scene?.flags?.[ID]?.floorTextures ?? "")) return null;
      const styles = m.ui.patternOptions(c.floor), style = styles.find(([k]) => k && k === c.pattern)?.[0] ?? styles[0]?.[0] ?? "", key = `${c.floor}/${style}`;
      fl.tiles ??= new Map();
      if (!fl.tiles.get(key)) { let tile = null; try { tile = floorTextures.tileImage(c.floor, style) ?? null; } catch { /* not drawn yet */ } if (tile) fl.tiles.set(key, tile); else return null; }
      return { tile: fl.tiles.get(key), size: grid() * 4 * (m.width / m.rect.width) };
    };
    // Lays the texture over what a preview picture shows, aligned to the map (the picture's corner at x0, y0 of the map image).
    const texturise = (g, w, h, x0, y0, look) => {
      const pattern = g.createPattern(look.tile, "repeat"); if (!pattern) return;
      const k = look.size / (look.tile.width || 1); pattern.setTransform?.(new DOMMatrix([k, 0, 0, k, -x0, -y0]));
      g.save(); g.globalCompositeOperation = "source-in"; g.fillStyle = pattern; g.fillRect(0, 0, w, h); g.restore();
    };
    // The pixels other floors' regions hold, which painting `floor` keeps off (made again when the regions or the floor change).
    // (Decorations stand on the floor: the brush paints under them, and they show above it.)
    // Cave growth (the Cave tile) paints its own regions, over the floors: it keeps off other growth, not off floors, and floors off
    // neither. What the brush paints and the regions it keeps to: the floor, or the growth's word with the brush's cave regions.
    // Water of one kind is its own floor to the brush: a waterfall painted up against a lake used to be folded into the lake and
    // come out a still pool. Each kind keeps to its own regions, keeps off the others' and is rubbed out with its own kind picked.
    const WATER_KEY_NAMES = Object.fromEntries(WATER_KINDS.map(([key, label]) => [`water:${key}`, label]));
    const floorKeyOf = (floor, kind) => (floor === "water" ? `water:${WATER_KEY_NAMES[`water:${kind}`] ? kind : "still"}` : floor);
    const keyName = (key) => WATER_KEY_NAMES[key] ?? floorName(key);
    const brushKey = (c) => (c.cave ? c.cave.cavern : floorKeyOf(c.floor, c.waterKind));
    const brushPool = (c) => (c.cave ? fl.caves ?? [] : fl.saved);
    const brushName = (c) => (c.cave ? caveName : keyName);
    // What a saved region is to the brush: its floor, or its water's kind.
    const floorKey = (s) => s.key ?? s.floor;
    const brushTint = (c) => (c.cave ? caveColour(c.cave.cavern) : floorTint(c.floor));
    const claimedBy = (floor, pool = fl.saved) => {
      if (claimedKey?.saved === pool && claimedKey.floor === floor) return claimedMask;
      claimedMask = new Uint8Array(fl.map.width * fl.map.height); for (const s of pool) if (floorKey(s) !== floor) for (const px of s.pixels) claimedMask[px] = 1;
      claimedKey = { saved: pool, floor }; return claimedMask;
    };
    // Which floor region holds each pixel of the map image (the saved region's floor, or none), made again when the regions change.
    let ownerKey = null, ownerMap = null;
    const floorUnder = (i, pool = fl.saved) => {
      if (ownerKey !== pool) { ownerMap = new Uint16Array(fl.map.width * fl.map.height); pool.forEach((s, n) => { for (const px of s.pixels) ownerMap[px] = n + 1; }); ownerKey = pool; }
      const s = pool[ownerMap[i] - 1]; return s ? floorKey(s) : null;
    };
    const setHoverText = (text) => { if ((fl.hoverText ?? "") === (text ?? "")) return; fl.hoverText = text ?? ""; refreshStatus(); };
    // What rubbing out `floor` may not touch: every pixel outside that floor's regions.
    const notFloor = (floor, pool = fl.saved) => { const out = new Uint8Array(fl.map.width * fl.map.height).fill(1); for (const s of pool) if (floorKey(s) === floor) for (const px of s.pixels) out[px] = 0; return out; };
    const hideHover = () => { hoverAt = null; if (fl.hover) fl.hover.visible = false; setHoverText(""); };
    const drawHover = () => {
      hoverTimer = null; const p = hoverAt, m = fl.map; if (!p || !m || state.down || !floorsOn() || decorBrushing !== state) return hideHover();
      const c = brushChoices(), q = toImage(p);
      if (q.x < 0 || q.y < 0 || q.x >= m.width || q.y >= m.height) return hideHover();
      setHoverText(floorHoverLine(floorUnder(Math.floor(q.y) * m.width + Math.floor(q.x), brushPool(c)), brushKey(c), brushName(c)));
      const radius = ((sizeNow() * grid()) / 2) * (m.width / m.rect.width), R = Math.ceil(radius) + 1;
      const x0 = Math.max(0, Math.floor(q.x) - R), y0 = Math.max(0, Math.floor(q.y) - R), w = Math.max(1, Math.min(m.width, Math.floor(q.x) + R + 1) - x0), h = Math.max(1, Math.min(m.height, Math.floor(q.y) + R + 1) - y0);
      const claimed = claimedBy(brushKey(c), brushPool(c));
      // With the model: the outline under the pointer, asked once the pointer rests a moment (and kept while it stays inside).
      let within = null;
      if (modelOn()) {
        if (!sam.ready) { void loadSam(); if (fl.hover) fl.hover.visible = false; return; }
        if (!fl.hoverWithin?.[Math.round(q.y) * m.width + Math.round(q.x)]) {
          clearTimeout(fl.hoverAsk); if (fl.hover) fl.hover.visible = false;
          // (One quick question, once the pointer has rested a little: the model runs on this page, so the five-point read a
          // stroke makes would hold the brush up while it moves.)
          fl.hoverAsk = setTimeout(async () => { const at = hoverAt; if (!at || state.down || decorBrushing !== state) return; try { fl.hoverWithin = await askModel(toImage(at), { quick: true }); } catch (err) { console.warn("Animater | map painting smart model", err); return; } if (hoverAt) hoverFloor(hoverAt); }, 450);
          return;
        }
        within = fl.hoverWithin;
      }
      const cells = floorDabCells({ rgba: m.rgba, width: m.width, height: m.height, x: q.x, y: q.y, radius, seed: floorColourAt(m.rgba, m.width, m.height, q.x, q.y), tolerance: c.tol, smart: c.smart, allowed: (i) => !claimed[i], within });
      if (!fl.hover) { const cv = document.createElement("canvas"); fl.hover = new PIXI.Sprite(PIXI.Texture.from(cv)); fl.hover.canvas = cv; fl.hover.eventMode = "none"; top.addChildAt(fl.hover, 1); }
      const cv = fl.hover.canvas; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext("2d"), img = g.createImageData(w, h), d = img.data, hex = brushTint(c), r = parseInt(hex.slice(1, 3), 16), gr = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      const look = textureLook(), alpha = look ? 225 : 105;
      for (const i of cells) { const x = (i % m.width) - x0, y = ((i / m.width) | 0) - y0; if (x < 0 || y < 0 || x >= w || y >= h) continue; const k = (y * w + x) * 4; d[k] = r; d[k + 1] = gr; d[k + 2] = b; d[k + 3] = alpha; }
      g.putImageData(img, 0, 0); if (look) texturise(g, w, h, x0, y0, look); fl.hover.texture.baseTexture?.setSize?.(w, h); fl.hover.texture.update?.(); fl.hover.texture.baseTexture?.update?.();
      const sx = m.rect.width / m.width, sy = m.rect.height / m.height; fl.hover.position.set(m.rect.x + x0 * sx, m.rect.y + y0 * sy); fl.hover.scale.set(sx, sy); fl.hover.visible = true;
    };
    const hoverFloor = (p) => { hoverAt = p; if (!hoverTimer) hoverTimer = setTimeout(drawHover, 40); };
    const clearStroke = () => { fl.stroke = null; if (fl.pixels) fl.pixels.data.fill(0); if (fl.preview) { fl.preview.canvas.getContext("2d").clearRect(0, 0, fl.map.width, fl.map.height); fl.preview.texture.update?.(); fl.preview.texture.baseTexture?.update?.(); fl.preview.visible = false; } };
    // Edges: Model (ui/smart-model.mjs): SAM 2.1, after the GM agrees once to its download (as Floor regions asks, and remembered
    // with it), reads the map once (about 2 s on WebGPU) and then says in about 0.2 s what outline lies under a point.
    const sam = fl.sam = { ready: null, loading: null, status: "" };
    const modelOn = () => brushChoices().edges === "model";
    const SAM_PREFS = "animater.floorRegions";
    const samPrefs = () => { try { return JSON.parse(globalThis.localStorage?.getItem(SAM_PREFS) ?? "{}") ?? {}; } catch { return {}; } };
    const samStatus = (text) => { sam.status = text ?? ""; refreshStatus(); };
    // (The model runs in a background worker (ui/smart-model.mjs smartModelWorker), one for the page, kept between uses of the
    // brush: Foundry keeps drawing while it loads, reads and answers. Without WebGPU it is slow, never frozen.)
    const loadSam = () => sam.loading ??= (async () => {
      await readMap(); if (!fl.map) throw new Error(fl.why || "no map");
      const { smartModelShared, isSmartModelCached, SMART_MODEL } = await import("../ui/smart-model.mjs");
      // (transformers.js reports progress while it reads a cached model back too: that is loading, not downloading.)
      const cached = await isSmartModelCached();
      if (samPrefs().smartAgreed !== SMART_MODEL.repo && !cached) {
        const { SMART_CONSENT } = await import("../ui/floor-regions-ui.mjs");
        const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Map painting: smart model" }, content: `<p>${SMART_CONSENT}</p>` });
        if (!ok) throw new Error("declined");
        try { globalThis.localStorage?.setItem(SAM_PREFS, JSON.stringify({ ...samPrefs(), smartAgreed: SMART_MODEL.repo })); } catch { /* storage unavailable */ }
      }
      samStatus("Loading the smart model…");
      const seg = await smartModelShared({ onProgress: (loaded, total) => samStatus(`${cached ? "Loading" : "Downloading"} the smart model… ${Math.round((loaded / Math.max(1, total)) * 100)}%`) });
      samStatus(seg.device === "webgpu" ? "The smart model is reading the map…" : "The smart model is reading the map (no WebGPU here, so this takes a while)…");
      const view = await seg.read(fl.map.rgba, fl.map.width, fl.map.height);
      if (decorBrushing !== state) { void seg.drop(view); return; }
      sam.ready = { seg, view }; samStatus("");
    })().catch((err) => {
      sam.loading = null; samStatus("");
      if (err?.message !== "declined") { console.warn("Animater | map painting smart model", err); ui.notifications?.warn?.("The smart model could not load, so Edges is back on Colour."); }
      if (decorBrushing === state) state.bar?.setEdges("colour");
    });
    // The model's outline under a point of the map image (pure: floor-brush modelMaskFor).
    // (Asked as Floor regions' Smart selection asks about a click: the point and four round it, the outline they most agree
    // on, kept to the clicked floor's colours, so a bush or a rock inside the outline is not painted.)
    // `quick` (the hover): the point alone, one call.
    const askModel = async (q, { quick = false } = {}) => {
      const m = fl.map, at = { x: Math.round(q.x), y: Math.round(q.y) };
      if (quick) { const r = await sam.ready.seg.masks(sam.ready.view, [{ ...at, label: 1 }]); return modelMaskFor({ masks: r.masks, scores: r.scores, rgba: m.rgba, width: m.width, height: m.height, at: q }); }
      const sets = [];
      // (A breath between the model's calls, so the screen keeps drawing while it answers.)
      for (const spot of smartNearbyClicks(at, m.width, m.height)) { sets.push((await sam.ready.seg.masks(sam.ready.view, [spot])).masks); await new Promise((r) => setTimeout(r, 0)); }
      return modelMaskFor({ sets, rgba: m.rgba, width: m.width, height: m.height, at: q });
    };
    // Heights: Raise is a brush, as Floors is (Edges and How alike, the brush's size): a stroke grows the raised part it starts on,
    // or, on lower ground, raises a new one a step over it, joining any of that height it touches; Shift-drag rubs out of the
    // raised part it starts on. Each saved as the stroke ends. Ramps are dragged, and the wheel over a raised part sets its height.
    const heightBegin = (p, erase) => {
      if (!fl.map) { void readMap().then(() => { if (fl.why) ui.notifications?.warn?.(fl.why); refreshStatus(); }); refreshStatus(); return false; }
      if (fl.finishing) return false;
      const model = modelOn() && !erase;
      if (model && !sam.ready) { void loadSam(); ui.notifications?.info?.("The smart model is getting ready; paint again in a moment (or set Edges to Colour)."); return false; }
      const m = fl.map, q = toImage(p), { field } = heightsHere(), part = field.partAt(p);
      if (erase && !part) return false;
      fl.stroke = new Uint8Array(m.width * m.height); fl.erasing = erase; fl.seed = floorColourAt(m.rgba, m.width, m.height, q.x, q.y);
      // (Started on a raised part: that height. On lower ground: a step over it.)
      fl.heights = { height: part ? part.height : nextHeight(field.groundAt(p), true, heightStep()) };
      // Raising keeps off nothing (raised ground lies over any floor); rubbing out takes only from the parts of that height.
      fl.claimed = erase ? notHeight(fl.heights.height) : new Uint8Array(m.width * m.height);
      fl.model = model; fl.dabs = []; fl.asking = null; fl.within = model ? new Uint8Array(m.width * m.height) : null;
      if (model && fl.hoverWithin?.[Math.round(q.y) * m.width + Math.round(q.x)]) fl.within.set(fl.hoverWithin);
      hideHover(); return true;
    };
    // A raised part's outline in the map image's pixels, as the floor brush keeps its floors' (areaPixels).
    const heightPixels = (part) => { const m = fl.map, sx = m.width / m.rect.width, sy = m.height / m.rect.height, img = (pts) => Array.from(pts, (v, i) => (i % 2 ? (v - m.rect.y) * sy : (v - m.rect.x) * sx)); const loops = []; for (const a of part.areas) { loops.push({ points: img(a), hole: false }); for (const h of a.holes ?? []) loops.push({ points: img(h), hole: true }); } return floorAreaPixels(loops, m.width, m.height); };
    const heightSaved = () => heightsHere().parts.map((part) => ({ regionId: part.id, floor: `h${part.height}`, pixels: heightPixels(part) }));
    const notHeight = (height) => { const out = new Uint8Array(fl.map.width * fl.map.height).fill(1); for (const s of heightSaved()) if (s.floor === `h${height}`) for (const px of s.pixels) out[px] = 0; return out; };
    const heightFinish = async () => {
      const m = fl.map, height = fl.heights.height;
      try {
        // (Raised ground is solid: the holes Colour edges leave in a stroke over textured ground are filled; each would be a cliff.)
        const stroke = fl.erasing ? fl.stroke : cleanSelection(fl.stroke, m.width, m.height, []);
        const plan = planFloorStroke({ saved: heightSaved(), floor: `h${height}`, stroke, erase: fl.erasing, width: m.width, height: m.height });
        const scene = canvas.scene, shapesOf = (loops) => floorRegionData({ loops }, { sceneRect: m.rect, imageWidth: m.width, imageHeight: m.height }).shapes;
        const updates = [], creates = [], removes = [];
        for (const u of plan.updates) { const doc = scene.regions.get(u.regionId); if (!doc) continue; const before = doc.toObject().shapes, after = shapesOf(u.loops); await doc.update({ shapes: after }); updates.push({ id: doc.id, before, after }); }
        for (const id of plan.removes) { const doc = scene.regions.get(id); if (!doc) continue; const data = doc.toObject(); delete data._id; await doc.delete(); removes.push({ id, data }); }
        for (const made of plan.creates) { const data = heightRegionData({ shapes: shapesOf(made.loops), height, levelId: m.levelId ?? null, units: heightUnits() }); const [doc] = await scene.createEmbeddedDocuments("Region", [data]); if (doc) creates.push({ id: doc.id, data }); }
        if (updates.length || creates.length || removes.length) rememberDecorStep({ kind: "floor", updates, creates, removes });
      } catch (err) { console.warn("Animater | heights", err); ui.notifications?.warn?.("The raised ground could not be saved."); }
    };
    const layRamp = async (drag) => {
      const kind = drag.ramp.kind ?? "ramp", ramp = rampFromDrag({ a: drag.ramp.a, b: drag.ramp.b, w: drag.ramp.w, field: heightsHere().field, min: grid() * 0.5, kind });
      if (!ramp) { refreshHeights(); ui.notifications?.info?.(kind === "bridge" ? "A bridge spans from raised ground: drag from one raised part to another." : `A ${kind} climbs a raised edge: drag from lower ground up onto a raised part.`); return; }
      try { const data = rampRegionData({ ...ramp, levelId: canvas.level?.id ?? null }); const [doc] = await canvas.scene.createEmbeddedDocuments("Region", [data]); if (doc) rememberDecorStep({ kind: "floor", updates: [], creates: [{ id: doc.id, data }], removes: [] }); }
      catch (err) { console.warn("Animater | heights", err); ui.notifications?.warn?.("The ramp could not be saved."); }
      if (decorBrushing === state) { refreshHeights(); refreshStatus(); }
    };
    // An open-edge stroke saved onto each raised part whose rim it crossed (or, closing, taken off them), one step to take back.
    const saveOpenEdges = async (open) => {
      const changed = [];
      try {
        for (const part of heightsHere().parts) {
          const touched = open.circles.filter((c) => edgeTouches(part, c)); if (!touched.length) continue;
          const doc = canvas.scene.regions.get(part.id); if (!doc) continue;
          const before = Array.isArray(doc.flags?.[ID]?.openEdges) ? doc.flags[ID].openEdges : [];
          const after = open.erase ? before.filter(([x, y, r]) => !open.circles.some((c) => Math.hypot(x - c.x, y - c.y) < r + c.r)) : [...before, ...touched.map((c) => [c.x, c.y, c.r])].slice(-OPEN_EDGES_MOST);
          if (after.length === before.length && open.erase) continue;
          await doc.update({ [`flags.${ID}.openEdges`]: after }); changed.push({ id: doc.id, before, after });
        }
        if (changed.length) rememberDecorStep({ kind: "open", changed });
        else if (!open.erase) ui.notifications?.info?.("Alt-drag along a raised part's edge to open it.");
      } catch (err) { console.warn("Animater | heights", err); }
      if (decorBrushing === state) { refreshHeights(); refreshStatus(); }
    };
    const removeHeight = async (id) => {
      const doc = canvas.scene?.regions?.get(id); if (!doc) return;
      try { const data = doc.toObject(); delete data._id; await doc.delete(); rememberDecorStep({ kind: "floor", updates: [], creates: [], removes: [{ id, data }] }); }
      catch (err) { console.warn("Animater | heights", err); }
      if (hz.sel === id) hz.sel = null;
      if (decorBrushing === state) { refreshHeights(); refreshStatus(); }
    };
    // True when a stroke began (the pointer then paints it as a floor stroke is painted).
    const heightsDown = (p, shift, alt = false) => {
      const { field } = heightsHere(), ramp = field.rampAt(p)?.ramp;
      // Alt-drag along a raised part's rim opens that stretch of its edge (no cliff, no walls); with Shift, closes it again.
      if (alt && brushChoices().heightMode === "raise") { const r = Math.max(grid() * 0.25, (sizeNow() * grid()) / 2); hz.open = { erase: shift, r, circles: [{ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(r) }] }; state.down = true; refreshHeights(); return false; }
      if (brushChoices().heightMode === "ramp") {
        if (shift) { const hit = ramp ?? field.partAt(p); if (hit) void removeHeight(hit.id); return false; }
        // (A ramp or a bridge as wide as the brush: a whole side of a raised part can be a slope. A ladder or a rope its own width.)
        const kind = brushChoices().crossKind, w = kind === "ladder" ? grid() * 0.45 : kind === "rope" ? grid() * 0.3 : Math.max(grid() * 0.5, sizeNow() * grid());
        hz.drag = { ramp: { a: p, b: p, w, kind } }; state.down = true; return false;
      }
      if (shift && ramp) { void removeHeight(ramp.id); return false; }
      return heightBegin(p, shift);
    };
    // The wheel over a raised part: a step higher or lower, shown at once and saved once the wheel rests.
    const flushWheel = () => {
      clearTimeout(hz.wheelTimer); const w = hz.wheel; hz.wheel = null; if (!w || w.height === w.from) return;
      const doc = canvas.scene?.regions?.get(w.id); if (!doc) return;
      void doc.update({ ...(/^Raised\b/.test(doc.name ?? "") ? { name: heightName(w.height, heightUnits()) } : {}), [`flags.${ID}.height`]: w.height }).then(() => rememberDecorStep({ kind: "height", id: w.id, before: w.from, after: w.height })).catch((err) => console.warn("Animater | heights", err));
    };
    const wheelHeight = (part, up) => {
      if (hz.wheel && hz.wheel.id !== part.id) flushWheel();
      hz.sel = part.id; const next = nextHeight(shownHeight(part), up, heightStep());
      if (hz.wheel) hz.wheel.height = next; else hz.wheel = { id: part.id, from: part.height, height: next };
      hz.hoverText = `Over: raised ${next} ${heightUnits()} · a stroke grows it, the wheel raises or lowers it, Shift-drag rubs it out`;
      refreshHeights(); refreshStatus();
      clearTimeout(hz.wheelTimer); hz.wheelTimer = setTimeout(flushWheel, 350);
    };
    const floorBegin = (p, erase) => {
      if (!fl.map) { void readMap().then(() => { if (fl.why) ui.notifications?.warn?.(fl.why); refreshStatus(); }); refreshStatus(); return false; }
      if (fl.finishing) return false;
      const model = modelOn() && !erase;
      if (model && !sam.ready) { void loadSam(); ui.notifications?.info?.("The smart model is getting ready; paint again in a moment (or set Edges to Colour)."); return false; }
      const m = fl.map, c = brushChoices(), q = toImage(p);
      fl.stroke = new Uint8Array(m.width * m.height); fl.erasing = erase; fl.seed = floorColourAt(m.rgba, m.width, m.height, q.x, q.y); fl.heights = null;
      // Painting keeps off the other floors' regions; rubbing out takes only from the picked floor's.
      fl.claimed = erase ? notFloor(brushKey(c), brushPool(c)) : claimedBy(brushKey(c), brushPool(c));
      // With the model, the stroke paints inside the outlines it has asked for, starting from the one hovering already found.
      fl.model = model; fl.dabs = []; fl.asking = null; fl.within = model ? new Uint8Array(m.width * m.height) : null;
      if (model && fl.hoverWithin?.[Math.round(q.y) * m.width + Math.round(q.x)]) fl.within.set(fl.hoverWithin);
      hideHover(); return true;
    };
    const radiusNow = () => ((sizeNow() * grid()) / 2) * (fl.map.width / fl.map.rect.width);
    const paintDab = (q) => {
      const m = fl.map, c = brushChoices();
      const cells = floorDabCells({ rgba: m.rgba, width: m.width, height: m.height, x: q.x, y: q.y, radius: radiusNow(), seed: fl.seed, tolerance: c.tol, smart: c.smart && !fl.erasing, allowed: (i) => !fl.claimed[i], within: fl.model ? fl.within : null });
      for (const i of cells) fl.stroke[i] = 1;
      showStroke(cells);
    };
    // A dab whose middle lies outside the outlines so far asks the model about it (one question at a time); when the answer
    // comes, every dab of the stroke paints again inside the outlines.
    const askAt = (q) => {
      if (fl.asking) return;
      const stroke = fl.stroke;
      fl.asking = askModel(q).then((mask) => {
        if (fl.stroke !== stroke) return;
        if (mask) for (let i = 0; i < mask.length; i++) if (mask[i]) fl.within[i] = 1;
        for (const d of fl.dabs) paintDab(d);
      }).catch((err) => console.warn("Animater | map painting smart model", err)).finally(() => {
        if (fl.stroke !== stroke) return; fl.asking = null;
        const last = fl.dabs.at(-1); if (last && !fl.within[Math.round(last.y) * fl.map.width + Math.round(last.x)]) askAt(last);
      });
    };
    const floorDab = (p) => {
      const q = toImage(p);
      if (!fl.model) return paintDab(q);
      fl.dabs.push(q);
      if (fl.within[Math.round(q.y) * fl.map.width + Math.round(q.x)]) paintDab(q); else askAt(q);
    };
    // (Always in a finally: `fl.finishing` holds every new stroke off while one is being saved, so a throw on the way out left the
    // brush showing what a dab would do and doing nothing, until the scene changed or the page was reloaded.)
    const floorFinish = async () => { try { await floorSave(); } finally { fl.finishing = false; } };
    const floorSave = async () => {
      // (A stroke still waiting on the model's answer is saved once it comes.)
      fl.finishing = true;
      while (fl.asking) await fl.asking;
      if (fl.heights) { await heightFinish(); fl.heights = null; if (decorBrushing === state) { clearStroke(); refreshHeights(); refreshStatus(); } return; }
      const c = brushChoices(), saved = brushPool(c), m = fl.map;
      try {
        // (The planner joins by the floor it is given: water's kind is part of that key, so one kind never folds into another's region.)
        const plan = planFloorStroke({ saved: saved.map((s) => ({ ...s, floor: floorKey(s) })), floor: brushKey(c), stroke: fl.stroke, erase: fl.erasing, width: fl.map.width, height: fl.map.height });
        const scene = canvas.scene, opts = { sceneRect: m.rect, imageWidth: m.width, imageHeight: m.height, levelId: m.levelId }, shapesOf = (loops) => floorRegionData({ loops }, opts).shapes;
        const updates = [], creates = [], removes = [];
        for (const u of plan.updates) { const doc = scene.regions.get(u.regionId); if (!doc) continue; const before = doc.toObject().shapes, after = shapesOf(u.loops); await doc.update({ shapes: after }); updates.push({ id: doc.id, before, after }); }
        for (const id of plan.removes) { const doc = scene.regions.get(id); if (!doc) continue; const data = doc.toObject(); delete data._id; await doc.delete(); removes.push({ id, data }); }
        const names = scene.regions.map((r) => r.name);
        for (const made of plan.creates) {
          const data = c.cave ? toCaveRegionData({ loops: made.loops }, { ...opts, ...c.cave, name: floorRegionName(c.cave.cavern, names, caveName) })
            : floorRegionData({ loops: made.loops }, { ...opts, name: floorRegionName(c.floor, names), floor: c.floor, texture: c.texture, pattern: c.pattern, waterKind: c.waterKind, overWater: c.overWater, edge: c.edge === BRUSH_EDGE.usual ? "" : c.edge });
          const [doc] = await scene.createEmbeddedDocuments("Region", [data]); if (doc) { creates.push({ id: doc.id, data }); names.push(data.name); }
        }
        if (updates.length || creates.length || removes.length) rememberDecorStep({ kind: "floor", updates, creates, removes });
      } catch (err) { console.warn("Animater | map painting floors", err); ui.notifications?.warn?.("The floor could not be saved."); }
      if (decorBrushing === state) { clearStroke(); refreshFloors(); refreshStatus(); }
    };
    const regionHooks = ["createRegion", "updateRegion", "deleteRegion"].map((hook) => [hook, Hooks.on(hook, () => { if (decorBrushing === state && !state.down) { refreshFloors(); refreshHeights(); refreshStatus(); } })]);
    // The ghost: one dab's worth laid out round the pointer (the very ones a click puts down), drawn again only when the choices change.
    const refreshGhost = () => {
      const radius = (sizeNow() * grid()) / 2, using = paintWith(), key = JSON.stringify([using, radius, state.ghostSeed]);
      if (key === state.ghostKey) return;
      state.ghostKey = key;
      for (const c of ghost.removeChildren()) { try { c.destroy(); } catch { /* gone */ } }
      const placed = [];
      for (let i = 0, n = dabCount(using.density); i < n; i++) { const d = stampDecor({ x: 0, y: 0, radius, grid: grid(), kinds: using.kinds, seed: state.ghostSeed * 131 + i * 7919, existing: placed, scale: using.scale, turn: using.turn }); if (d) placed.push(d); }
      state.ghostItems = placed;
      const look = decorLook({ where: brushChoices().where });
      for (const d of [...placed].sort((a, b) => (DECOR_KINDS[a.kind].flat ? 0 : 1) - (DECOR_KINDS[b.kind].flat ? 0 : 1) || a.size - b.size)) { const s = decorations.sprite(d, look); if (s) ghost.addChild(s); }
    };
    const draw = () => {
      ring.clear();
      const floors = floorsOn(); fl.overlay.visible = floors;
      // Walls have no brush and lay no decoration: the ring and the ghost would both be lying about what a drag does.
      if (wallsOn()) { ghost.visible = false; wl.overlay.visible = true; if (!state.down) wallsHover(); return; }
      wl.overlay.visible = false;
      if (heightsOn()) {
        ghost.visible = false;
        // (Raise is a brush: its ring, in the raised ground's colour.)
        if (brushChoices().heightMode === "raise" && state.at) { ring.lineStyle(2, state.erasing ? 0xff7a64 : 0xd9b46a, 0.95); ring.drawCircle(state.at.x, state.at.y, (sizeNow() * grid()) / 2); }
        return;
      }
      const showGhost = !!state.at && !state.down && !state.erasing && !floors; ghost.visible = showGhost;
      if (!state.at) return;
      if (showGhost) { refreshGhost(); ghost.position.set(state.at.x, state.at.y); }
      // On Floors the ring is in the floor's colour.
      const ringTint = state.erasing ? 0xff7a64 : floors ? (Number.parseInt(String(floorTint(brushChoices().floor)).slice(1), 16) || 0xffffff) : 0xffffff;
      ring.lineStyle(2, ringTint, 0.95); ring.drawCircle(state.at.x, state.at.y, (sizeNow() * grid()) / 2);
    };
    // Where a stroke goes: the region the brush was opened on; else the region it starts in; else a new one round it.
    const begin = (p) => {
      const target = doc ?? decorBrushTarget(p);
      if (target) { const s = decorSettings(target.flags?.[ID]?.decor) ?? { brushed: [], erased: [] }; Object.assign(state, { id: target.id, doc: target, brushed: [...s.brushed], erased: [...s.erased], circles: [], fresh: null }); }
      else { const c = brushChoices(); Object.assign(state, { id: NEW_DECOR_REGION, doc: null, brushed: [], erased: [], circles: [], fresh: { where: c.where, kinds: Object.fromEntries(c.kinds.map((k) => [k, { size: 1, amount: 1 }])) } }); }
    };
    const paintWith = () => {
      // The kind picked on the bar, at the bar's size. (Into a region, its own Size and the kind's size there apply as it is drawn, so
      // turning them later scales what was painted too.)
      const c = brushChoices();
      return { kinds: c.kinds.filter((id) => DECOR_KINDS[id]).map((id) => ({ id, size: 1, amount: 1 })), density: c.thick, scale: c.scale, turn: c.turn };
    };
    const dabCount = (density) => Math.max(1, Math.round(sizeNow() * Math.max(0.2, density) * 1.5));
    // How it breaks, as picked on the bar for the kind (decor-options.mjs): saved on each one laid, never moving where it stands.
    // And the bar's Decoration height (how long its shadows reach), when it isn't the usual.
    const withProp = (d) => { const c = brushChoices(), look = d && c.tall !== 1 ? { ...d, tall: c.tall } : d; return look && Object.keys(c.prop ?? {}).length ? { ...look, prop: c.prop } : look; };
    const dab = (p, erase, first = false) => {
      const radius = (sizeNow() * grid()) / 2;
      if (erase) { state.brushed = state.brushed.filter((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 > radius * radius); if (state.doc) state.erased.push([Math.round(p.x), Math.round(p.y), Math.round(radius)]); }
      else {
        if (!state.doc) state.circles.push([Math.round(p.x), Math.round(p.y), Math.round(radius)]);
        const areas = state.doc ? regionAreas(state.doc) : null, { kinds, density, scale, turn } = paintWith();
        // A click lays exactly what its ghost showed; then a new ghost is dealt for the next.
        if (first && state.ghostItems.length) { for (const g of state.ghostItems) { const d = withProp({ ...g, x: Math.round(p.x + g.x), y: Math.round(p.y + g.y), seed: (g.seed ^ state.seed++) >>> 0 }); if (!areas || regionPointIn(d, areas)) state.brushed.push(d); } state.ghostSeed++; }
        else for (let i = 0, n = dabCount(density); i < n; i++) { const d = withProp(stampDecor({ x: p.x, y: p.y, radius, grid: grid(), kinds, seed: state.seed++, existing: state.brushed, scale, turn })); if (d && (!areas || regionPointIn(d, areas))) state.brushed.push(d); }
      }
      decorBrushSyncSoon();
    };
    const finish = async () => {
      const { doc: target, brushed, erased, circles, fresh } = state;
      try {
        if (target) {
          // What it held before the stroke, for Ctrl+Z.
          const before = decorSettings(target.flags?.[ID]?.decor) ?? { brushed: [], erased: [] }, after = { brushed: brushed.slice(-600), erased: erased.slice(-400) };
          await target.update({ flags: { [ID]: { decor: after } } }, { render: false });
          rememberDecorStep({ kind: "edit", id: target.id, before: { brushed: before.brushed, erased: before.erased }, after });
        } else if (circles.length && brushed.length) {
          const data = { name: "Decorations", color: "#7a9a4a", shapes: strokeShapes(circles), flags: { [ID]: { decor: { on: true, where: fresh.where, density: 0, scale: 1, seed: state.seed, kinds: fresh.kinds, brushed: brushed.slice(-600), erased: [] } } } };
          const [made] = await canvas.scene.createEmbeddedDocuments("Region", [data]);
          if (made) rememberDecorStep({ kind: "create", id: made.id, data });
        }
      } catch (err) { console.warn("Animater | decorations brush", err); ui.notifications?.warn?.("The decorations could not be saved."); }
      if (decorBrushing === state) Object.assign(state, { id: null, doc: null, brushed: [], erased: [], circles: [], fresh: null });
    };
    // (A right-drag pans the map as ever, and a right-click does nothing to the brush: Esc puts it away.)
    // Walls (engines/motion/wall-paint.mjs): a drag lays a run of Foundry's own walls — which is what the vision and the
    // movement need — each carrying the material that paints it. Nothing of a map's existing walls is touched: Animater
    // paints only what was drawn here. Shift-click takes a painted wall away again.
    const wl = state.walls = { points: null, round: null, rect: null, move: null, rubbing: false, rubbed: new Set(), gone: [], overlay: new PIXI.Graphics() };
    wl.overlay.eventMode = "none"; top.addChild(wl.overlay);
    const wallsOn = () => brushChoices().tab === "walls";
    // To the nearest grid corner, which is where a wall belongs; the grid's own answer where Foundry gives one.
    const wallSnap = (p) => {
      try {
        const mode = CONST?.GRID_SNAPPING_MODES?.VERTEX;
        if (mode && canvas.grid?.getSnappedPoint) { const s = canvas.grid.getSnappedPoint(p, { mode, resolution: 1 }); if (Number.isFinite(s?.x)) return { x: s.x, y: s.y }; }
      } catch { /* an older grid, or a kind that has no corners */ }
      const g = grid(), r = canvas.dimensions?.sceneRect ?? { x: 0, y: 0 };
      return { x: r.x + Math.round((p.x - r.x) / g) * g, y: r.y + Math.round((p.y - r.y) / g) * g };
    };
    const wallsSame = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < 1;
    // The painted wall under the pointer, if any: only ones drawn here, never a wall the map came with.
    const wallsUnder = (p) => {
      // About the wall's own width, not half a square: on a 200px grid half a square was 100px, so rubbing out near a
      // corner took the wall round the corner with it and left the room full of gaps.
      const reach = grid() * Math.max(WALL_THICK, 0.12);
      let best = null;
      for (const w of canvas.walls?.placeables ?? []) {
        if (!WALL_MATERIAL_IDS.includes(w.document.flags?.[ID]?.material)) continue;
        // One already rubbed out this stroke: its placeable is still on the canvas for a frame or two after its
        // document has gone, and asking Foundry to delete it again is what shouted "Wall ... does not exist!".
        if (wl.rubbed.has(w.id) || !w.document.parent?.walls?.get(w.id)) continue;
        const [x1, y1, x2, y2] = w.document.c, dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
        const away = Math.hypot(p.x - (x1 + dx * t), p.y - (y1 + dy * t));
        if (away <= reach && (!best || away < best.away)) best = { doc: w.document, away };
      }
      return best?.doc ?? null;
    };
    // Erase is a mode of its own on the bar, with Shift as the shortcut either way round: a GM should be able to see
    // that the next drag takes walls away, not have to remember it.
    const wallsErasing = (shift) => (brushChoices().wallMode === "erase") !== (shift === true);
    // Rubbing out is a drag, so the same wall comes under the pointer many times over: each is remembered, and asked
    // to go only once. A delete that fails because somebody else got there first is not worth shouting about.
    const wallsRub = (p) => {
      const had = wallsUnder(p);
      if (!had) return false;
      wl.rubbed.add(had.id);
      wl.gone.push(had.toObject());
      void Promise.resolve(had.delete()).catch(() => { /* already gone */ });
      return true;
    };
    // A doorway is cut, not drawn: the wall under the click is split, and the middle of it becomes a door of Foundry's
    // own with the leaf's kind on it. The stone either side carries on exactly as it was, which is why a doorway reads
    // as a gap in a wall rather than as something laid over one.
    // A window set into an opening. One that opens and closes is left as the wall has it — window-state.mjs shapes its
    // edge from its own flags, as it always has. One that never closes is an opening in the stone, so sight goes
    // through it; an arrow slit is deep enough that sound does not.
    const windowDoc = (c, keep, choice) => {
      const kind = WINDOW_ART[choice.windowKind] ? choice.windowKind : windowFor(keep.material);
      const flags = { ...keep, window: kind, windowOpen: false, windowSlats: false, windowWalk: choice.windowWalk === true, swing: choice.swing === "out" ? "out" : "in" };
      const doc = { c, flags: { [ID]: flags } };
      // (0 is NONE: it lets that sense through. The named constants are a deprecated proxy that warns on every read,
      // so the numbers are used here as engines/motion/window-state.mjs uses them.)
      if (!WINDOW_ART[kind].opens) {
        doc.sight = 0;
        if (kind !== "arrowWindow") doc.sound = 0;
      }
      return doc;
    };
    // What is in an opening is changed by clicking it, rather than being refused: a door becomes another kind of door,
    // or a window, and the other way about. The stone either side is not touched — only what hangs in the gap.
    const wallsFillOpening = async (found, as, choice) => {
      const own = found.flags?.[ID] ?? {}, was = found.toObject();
      const NORMAL = 20, swing = choice.swing === "out" ? "out" : "in";
      // Taking a flag away: v14 wants a ForcedDeletion, and warns on the old `-=` spelling. Older cores only know `-=`.
      const forget = (...fields) => Object.fromEntries(fields.map((f) => {
        const Gone = foundry?.data?.operators?.ForcedDeletion;
        return Gone ? [`flags.${ID}.${f}`, new Gone()] : [`flags.${ID}.-=${f}`, null];
      }));
      let change;
      if (as === "window") {
        const kind = WINDOW_ART[choice.windowKind] ? choice.windowKind : windowFor(own.material);
        const opens = WINDOW_ART[kind].opens;
        // (0 is NONE, 20 NORMAL. A window that closes is left as the wall has it — window-state.mjs shapes its edge.)
        change = {
          door: 0, ds: 0, sight: opens ? NORMAL : 0, sound: opens || kind === "arrowWindow" ? NORMAL : 0,
          [`flags.${ID}.window`]: kind, [`flags.${ID}.windowOpen`]: false, [`flags.${ID}.windowSlats`]: false,
          [`flags.${ID}.windowWalk`]: choice.windowWalk === true, [`flags.${ID}.swing`]: swing,
          ...forget("door", "hinge"),
        };
      } else {
        change = {
          door: 1, ds: 0, sight: NORMAL, sound: NORMAL,
          [`flags.${ID}.door`]: DOOR_KINDS[choice.doorKind] ? choice.doorKind : doorFor(own.material),
          [`flags.${ID}.hinge`]: choice.doorFlip ? "far" : "near", [`flags.${ID}.swing`]: swing,
          ...forget("window", "windowOpen", "windowSlats", "windowWalk"),
        };
      }
      try {
        await found.update(change);
        rememberDecorStep({ kind: "walls", made: [found.toObject()], gone: [was] });
      } catch (err) { ui.notifications?.warn("Animater: that opening could not be changed."); console.warn("Animater | opening", err); }
    };
    const wallsCutDoor = async (p, as = "door") => {
      const thing = as === "window" ? "window" : "doorway";
      const found = wallsUnder(p);
      if (!found) { ui.notifications?.info(`Animater: click a painted wall to cut a ${thing} in it.`); return; }
      if (Number(found.door) > 0 || found.flags?.[ID]?.window) { await wallsFillOpening(found, as, brushChoices()); return; }
      const g = grid(), choice = brushChoices();
      const own = found.flags?.[ID] ?? {}, material = own.material;
      const kind = DOOR_KINDS[choice.doorKind] ? choice.doorKind : doorFor(material);
      // A GM draws a wall a square at a time, so the wall clicked on is usually one square long. The opening is cut
      // from the whole straight stretch it belongs to, not from that one square, or the bar could ask for three
      // squares and get one (Roi: "this is NOT 3 squares wide").
      const stretch = alongStretch(paintWallList(), found.id);
      if (!stretch) { ui.notifications?.info(`Animater: click a painted wall to cut a ${thing} in it.`); return; }
      const { a: head, d, length: len, parts } = stretch;
      // As wide as the bar asks for, but never wider than the wall it is cut from.
      const wide = Math.min(len * 0.9, g * (choice.doorWide ?? 1));
      // Where along the wall: under the click, then slid so it sits wholly inside the wall it is cut from.
      const t = Math.max(wide / 2, Math.min(len - wide / 2, ((p.x - head[0]) * d[0] + (p.y - head[1]) * d[1])));
      // A stub too short to be a wall is not dropped — dropping it left a hole in the room (Roi: "why is there a whole
      // in the wall it's supposed to be a complete room"). The doorway is slid flush to that end instead, so the stone
      // either side always reaches the corner it is meant to reach.
      const cut = doorwaySpan(len, t, wide);
      const at = (k) => [Math.round(head[0] + d[0] * k), Math.round(head[1] + d[1] * k)];
      const a = at(cut.from), b = at(cut.to);
      const keep = { ...own };
      const swing = choice.swing === "out" ? "out" : "in";
      const door = (one, two, hinge, pair = false) => ({ c: [...one, ...two], door: 1, ds: 0, flags: { [ID]: { ...keep, door: kind, hinge, swing, ...(pair ? { pair: true } : {}) } } });
      // A pair is ONE doorway with one door in it, marked as a pair: one Foundry door, so one control and one thing
      // to open, and the painting hangs two leaves in it, each at its own end, meeting in the middle. Cut as two
      // Foundry doors it had two controls side by side and each half opened on its own, which is not a pair of hall
      // doors but two doors in one hole (Roi: "thats not how foundry double doors work").
      const pair = as !== "window" && choice.doorDouble === true && cut.to - cut.from > g * 0.5;
      const docs = as === "window"
        ? [windowDoc([...a, ...b], keep, choice)]
        : [door(a, b, choice.doorFlip ? "far" : "near", pair)];
      // Every wall the opening reaches into goes, and whatever is left of each at either end comes back as its own
      // wall, keeping that wall's own material and years.
      const gone = [];
      const SCRAP = 1; // a leftover shorter than this is not a wall, it is a rounding error
      for (const part of parts) {
        if (part.to <= cut.from + SCRAP || part.from >= cut.to - SCRAP) continue;
        const doc = canvas.scene?.walls?.get(part.id);
        if (!doc) continue;
        gone.push(doc);
        const mine = { ...(doc.flags?.[ID] ?? {}) };
        if (part.from < cut.from - SCRAP) docs.push({ c: [...at(part.from), ...a], flags: { [ID]: mine } });
        if (part.to > cut.to + SCRAP) docs.push({ c: [...b, ...at(part.to)], flags: { [ID]: mine } });
      }
      if (!gone.length) gone.push(found);
      try {
        const was = gone.map((doc) => doc.toObject());
        const made = await canvas.scene?.createEmbeddedDocuments("Wall", docs);
        await canvas.scene?.deleteEmbeddedDocuments("Wall", gone.map((doc) => doc.id));
        if (made?.length) rememberDecorStep({ kind: "walls", made: made.map((d) => d.toObject()), gone: was });
      } catch (err) { ui.notifications?.warn(`Animater: that ${thing} could not be cut.`); console.warn("Animater | opening", err); }
    };
    // A roof is laid over a room, not drawn: the click says which room, and the walls say where that room ends. A
    // click on a roof already there takes it off again.
    const roofHere = (p) => {
      const grid = canvas?.grid?.size ?? 100;
      return roofsOf(canvas?.scene?.flags?.[ID] ?? {}, { grid }).find((r) => underRoof(r.room, p.x, p.y)) ?? null;
    };
    // The room under a point, worked out at most once a square: walking a room is cheap, doing it sixty times a
    // second over every wall on the map is not.
    let roomSeen = { key: "", room: null };
    const roomUnder = (p) => {
      const g = grid(), key = `${Math.floor(p.x / g)},${Math.floor(p.y / g)}:${canvas.walls?.placeables?.length ?? 0}`;
      if (key === roomSeen.key) return roomSeen.room;
      const rect = canvas.dimensions?.sceneRect;
      const room = roomAt(p, (canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c })), {
        grid: g, most: 900,
        bounds: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
      });
      roomSeen = { key, room };
      return room;
    };
    // A whole building: the room under the click, the painted walls that close it in — doorways and windows among
    // them, since those are walls too — and the roof over it. Foundry's own Walls layer moves walls and nothing else,
    // and a roof is a box kept in the scene's flags, so moving a house that way left its roof behind (Roi: "how do we
    // move a whole building somewhere else?").
    const buildingAt = (p) => {
      // The whole building, not the room clicked. Asked of roomUnder, a house with a wall down the middle answered
      // with half of itself, so Move building picked up one room and left the rest standing (Roi: "move building
      // doesnt select all the building"). building-plan.mjs walks the indoor squares straight through partitions,
      // which is the same question the Shift roof asks; roomUnder is only the fallback for a point that is not
      // indoors at all, where there is nothing to walk.
      const air = wallsOutsideAir();
      const whole = air
        ? buildingPlanAt(p, (canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c })), { grid: grid(), bounds: air.bounds, outside: air.outside })
        : null;
      const room = whole ?? roomUnder(p);
      if (!room) return null;
      const g = grid(), edge = g * 0.6;
      const round = { x: room.x - edge, y: room.y - edge, w: room.w + edge * 2, h: room.h + edge * 2 };
      const walls = (canvas.walls?.placeables ?? [])
        .filter((w) => WALL_MATERIAL_IDS.includes(w.document.flags?.[ID]?.material))
        .filter((w) => underRoof(round, (w.document.c[0] + w.document.c[2]) / 2, (w.document.c[1] + w.document.c[3]) / 2))
        .map((w) => w.document);
      if (!walls.length) return null;
      // Whichever roofs stand over this room: a roof is kept by its box, and the one over this room is the one whose
      // middle is in it.
      const roofs = (canvas.scene?.flags?.[ID]?.roofs ?? []).filter((r) => Number.isFinite(r?.x)
        && underRoof(round, r.x + r.w / 2, r.y + r.h / 2));
      return { room, walls, roofs };
    };
    // What the building would look like once it had been moved: its walls and its roof, drawn where they would land.
    const buildingShow = (move) => {
      wl.overlay.clear();
      if (!move) return;
      const [dx, dy] = move.by;
      wl.overlay.lineStyle({ width: Math.max(2, grid() * 0.08), color: 0xf3e4c4, alpha: 0.85, cap: "round" });
      for (const w of move.building.walls) {
        const [ax, ay, bx, by] = w.c;
        wl.overlay.moveTo(ax + dx, ay + dy); wl.overlay.lineTo(bx + dx, by + dy);
      }
      for (const r of move.building.roofs) {
        wl.overlay.lineStyle(2, 0xf3e4c4, 0.6);
        wl.overlay.drawRect(r.x + dx, r.y + dy, r.w, r.h);
      }
    };
    const buildingMove = async (move) => {
      const here = canvas?.scene;
      const [dx, dy] = move?.by ?? [0, 0];
      if (!here || (!dx && !dy)) return;
      const walls = move.building.walls.filter((w) => here.walls.get(w.id));
      const updates = walls.map((w) => ({ _id: w.id, c: [w.c[0] + dx, w.c[1] + dy, w.c[2] + dx, w.c[3] + dy] }));
      const was = (here.flags?.[ID]?.roofs ?? []);
      const moved = new Set(move.building.roofs.map((r) => r.id));
      const roofs = was.map((r) => (moved.has(r.id) ? { ...r, x: r.x + dx, y: r.y + dy } : r));
      try {
        // Where everything stood, and where it stands now: taken back, each goes back to exactly where it was, rather
        // than being stepped back by the same distance. A step is a sum, and sums go wrong when something else has
        // moved in between.
        const step = {
          kind: "moved",
          walls: walls.map((w, i) => ({ id: w.id, was: [...w.c], now: [...updates[i].c] })),
          roofs: [...moved].map((id) => { const r = was.find((x) => x.id === id); return { id, was: [r.x, r.y], now: [r.x + dx, r.y + dy] }; }),
        };
        if (updates.length) await here.updateEmbeddedDocuments("Wall", updates);
        if (moved.size) await here.update({ [`flags.${ID}.roofs`]: roofs });
        rememberDecorStep(step);
      } catch (err) { ui.notifications?.warn("Animater: that building could not be moved."); console.warn("Animater | move", err); }
    };
    const roofLay = async (p, whole = false) => {
      const here = canvas?.scene;
      if (!here) return;
      const was = roofsOf(here.flags?.[ID] ?? {}, { grid: canvas?.grid?.size ?? 100 });
      const had = was.find((r) => underRoof(r.room, p.x, p.y));
      if (had) {
        // Take it off again.
        await here.update({ [`flags.${ID}.roofs`]: (here.flags?.[ID]?.roofs ?? []).filter((r) => (r?.id ?? "") !== had.id) });
        return;
      }
      const grid = canvas.grid?.size ?? 100;
      // Shift lays one roof over the whole building rather than over the room clicked: a house with a wall down the
      // middle is two rooms and one roof (Roi: "we need to know how to deal with inside walls").
      const air = whole ? wallsOutsideAir() : null;
      const found = whole && air
        ? buildingPlanAt(p, (canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c })), { grid, bounds: air.bounds, outside: air.outside })
        : roomUnder(p);
      if (!found) { ui.notifications?.info(whole ? "Animater: no building there — the walls round that spot do not close anything in." : "Animater: that is not a room — the walls there do not close it in."); return; }
      const choice = brushChoices();
      // What the walls of that room are made of, so a roof can match them.
      const near = (canvas.walls?.placeables ?? []).filter((w) => WALL_MATERIAL_IDS.includes(w.document.flags?.[ID]?.material))
        .filter((w) => underRoof({ ...found, x: found.x - grid, y: found.y - grid, w: found.w + grid * 2, h: found.h + grid * 2 }, (w.document.c[0] + w.document.c[2]) / 2, (w.document.c[1] + w.document.c[3]) / 2));
      // Whether the room is round, asked of the walls rather than of the squares it covers. A tower two squares
      // across fills every square of its own box, so counting squares called it a box and refused it a cone; the
      // walls round it are a ring of short legs, most of them lying across the grid rather than along it.
      const legs = near.map((w) => w.document.c).filter(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay) > 1);
      const askew = legs.filter(([ax, ay, bx, by]) => Math.abs(bx - ax) > 1 && Math.abs(by - ay) > 1).length;
      const round = legs.length >= 8 && askew >= legs.length * 0.5;
      // A round room's squares are not its size. The floor of a tower 3 squares across only fills the 2x2 of squares
      // its circle wholly covers, so a roof laid on that box stopped short of its own walls (Roi: "shouldnt the roof
      // pass the wall?"). Where the walls are a ring, the ring is what the roof is measured against.
      let box = { x: found.x, y: found.y, w: found.w, h: found.h };
      if (round) {
        // The ring itself, not whatever else stands nearby: its legs all lie the same distance from the middle of the
        // room, so the ones that do not are another building's walls and have no say in how far this roof reaches.
        const cx = found.x + found.w / 2, cy = found.y + found.h / 2;
        const outFrom = ([ax, ay, bx, by]) => Math.hypot((ax + bx) / 2 - cx, (ay + by) / 2 - cy);
        const askewLegs = legs.filter(([ax, ay, bx, by]) => Math.abs(bx - ax) > 1 && Math.abs(by - ay) > 1);
        const sorted = askewLegs.map(outFrom).sort((a, b) => a - b);
        const usual = sorted[Math.floor(sorted.length / 2)] || 0;
        const ring = usual > 0 ? legs.filter((l) => Math.abs(outFrom(l) - usual) <= usual * 0.25) : [];
        const xs = ring.flatMap(([ax, , bx]) => [ax, bx]), ys = ring.flatMap(([, ay, , by]) => [ay, by]);
        if (xs.length) {
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          if (x1 > x0 && y1 > y0) box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
      }
      const room = { ...found, ...box, round };
      // A cone is a circle, so it only covers a room that is actually round — a tower, a mill. On a square or an
      // oblong one its corners are left open to the sky. The roof still goes on, it just takes the shape that fits,
      // and says so.
      if (choice.roofForm && !formFits(choice.roofForm, room, { grid })) {
        ui.notifications?.info("Animater: a conical roof only fits a round room, so this one takes the shape that does.");
      }
      const material = near[0]?.document?.flags?.[ID]?.material ?? "fieldstone";
      const roof = {
        id: foundry?.utils?.randomID?.() ?? `roof${Date.now()}`,
        x: Math.round(room.x), y: Math.round(room.y), w: Math.round(room.w), h: Math.round(room.h),
        kind: ROOF_IDS.includes(choice.roofKind) ? choice.roofKind : roofFor(material),
        form: ROOF_FORM_IDS.includes(choice.roofForm) ? choice.roofForm : undefined,
        age: Math.max(0, Math.min(1, Number(choice.roofAge) || 0)),
        chimney: choice.roofChimney === "brick" || choice.roofChimney === "stone" ? choice.roofChimney : null,
        dressed: choice.roofDressed === true,
        tint: choice.roofTint || null,
        // What this building hangs out is its own, kept with it like its chimney and its colour — not a live
        // setting on the bar, which was both the same for every building and forgotten on reload.
        hangs: choice.dressingKind || "garlands",
        material,
        // Only the box is kept, and a round room's box is a square one's box, so whether the room was round is
        // remembered here: it is the one thing a cone needs and the box cannot say.
        round: formFits("cone", room, { grid }),
      };
      try { await here.update({ [`flags.${ID}.roofs`]: [...(here.flags?.[ID]?.roofs ?? []), roof] }); }
      catch (err) { ui.notifications?.warn("Animater: that roof could not be laid."); console.warn("Animater | roof", err); }
    };
    // A round room, laid as a ring of walls. A wall drawn by hand snaps to the grid's corners, so a circle could only
    // ever be stepped out of right angles, and a conical roof — which wants a room that is actually round — had
    // nothing to sit on (Roi: "i cant manage to put a circle wall to use conical roof"). Here the centre is a corner
    // and the drag is the radius; the ring itself is laid off the grid, which is what makes it round.
    // The shapes themselves are engines/motion/room-shapes.mjs; what is here is only where the drag started and
    // where the pointer is. A rectangle is dragged corner to corner and snaps to the grid both ends; a ring is laid
    // off the grid on purpose, which is what makes it round, so only its middle is snapped.
    const ringRoom = (middle, p) => roundRoom(middle, p, grid());
    const boxRoom = (corner, p) => rectRoom(corner, wallSnap(p), grid());
    // A region shaped to what the walls close in: click inside a room and it is drawn round that room, Shift-click
    // and it is drawn round the whole building, partitions and all (Roi: "is there a way to choose an area
    // delimited by walls and make that an animater region?"). Everything else that makes a region here works from
    // the map's picture or from a stroke; this one works from the stone.
    const roomRegion = async (p, whole = false) => {
      const air = wallsOutsideAir();
      if (!air) { ui.notifications?.info("Animater: the walls have not been worked out yet — try again in a moment."); return; }
      const g = grid();
      const walls = (canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c }));
      const cells = roomCells(p, walls, { grid: g, bounds: air.bounds, outside: air.outside, through: whole });
      if (!cells.size) { ui.notifications?.info("Animater: that spot is not inside anything — the walls there do not close it in."); return; }
      // In by the stone: a wall's own drawn half-thickness, taken from the thickest painted wall round this room so
      // the region never lies under one. A wall the map came with has no thickness of ours; those get the usual.
      const near = (canvas.walls?.placeables ?? []).filter((w) => {
        const own = w.document.flags?.[ID];
        if (!WALL_MATERIAL_IDS.includes(own?.material)) return false;
        const mx = (w.document.c[0] + w.document.c[2]) / 2, my = (w.document.c[1] + w.document.c[3]) / 2;
        return cells.has(`${Math.floor(mx / g)},${Math.floor(my / g)}`) || cells.has(`${Math.round(mx / g)},${Math.round(my / g)}`)
          || [...cells].some((k) => { const [cx, cy] = k.split(',').map(Number); return Math.abs(cx * g + g / 2 - mx) <= g && Math.abs(cy * g + g / 2 - my) <= g; });
      });
      const thick = Math.max(WALL_THICK, ...near.map((w) => Number(w.document.flags?.[ID]?.thick) || 0));
      const loops = roomOutline(cells, { grid: g, inset: thick * g });
      if (!loops.length) { ui.notifications?.info("Animater: that room has no outline to draw."); return; }
      // The biggest loop is the room's own edge; the rest are the holes in it, which the region keeps as holes.
      const span = (l) => { const xs = l.filter((_, i) => i % 2 === 0), ys = l.filter((_, i) => i % 2 === 1); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); };
      const sorted = loops.slice().sort((a, b) => span(b) - span(a));
      const data = {
        name: whole ? "Building" : "Room",
        color: "#6c8ebf",
        shapes: sorted.map((points, i) => ({ type: "polygon", points: points.map((n) => Math.round(n)), hole: i > 0 })),
        ...(canvas.level?.id ? { elevation: { bottom: Number(canvas.level?.elevation?.base) || 0 } } : {}),
      };
      try {
        const [made] = await canvas.scene.createEmbeddedDocuments("Region", [data]);
        if (made) {
          rememberDecorStep({ kind: "create", id: made.id, data });
          ui.notifications?.info(`Animater: a region over ${cells.size} square${cells.size === 1 ? "" : "s"}. Ctrl+Z takes it back.`);
        }
      } catch (err) { console.warn("Animater | room region", err); ui.notifications?.warn?.("That region could not be made."); }
    };
    const wallsDown = (p, shift) => {
      const mode = brushChoices().wallMode;
      if (mode === "roof") { void roofLay(p, shift).then(refreshStatus); return; }
      if (mode === "round" && !shift) { wl.round = wallSnap(p); wl.points = ringRoom(wl.round, p); wallsShow(); return; }
      if (mode === "rect" && !shift) { wl.rect = wallSnap(p); wl.points = boxRoom(wl.rect, p); wallsShow(); return; }
      if (mode === "region") { void roomRegion(p, shift).then(refreshStatus); return; }
      if (mode === "move" && !shift) {
        // On a wall, that wall alone; inside a room, the whole building (Roi: "we should be able to also just move
        // a walls").
        const one = wallsUnder(p);
        const building = one ? { room: null, walls: [one], roofs: [] } : buildingAt(p);
        if (!building) { ui.notifications?.info("Animater: click a painted wall to move it, or inside a building to move the whole of it."); return; }
        wl.move = { building, from: wallSnap(p), by: [0, 0] };
        buildingShow(wl.move);
        return;
      }
      if ((mode === "door" || mode === "window") && !shift) { void wallsCutDoor(p, mode).then(refreshStatus); return; }
      if (wallsErasing(shift)) { wl.rubbing = true; wl.rubbed.clear(); wl.gone = []; wallsRub(p); return; }
      wl.points = [wallSnap(p)];
      wallsShow();
    };
    const wallsMove = (p) => {
      if (wl.rubbing) { wallsRub(p); return; }
      if (wl.move) { const to = wallSnap(p); wl.move.by = [to.x - wl.move.from.x, to.y - wl.move.from.y]; buildingShow(wl.move); return; }
      if (wl.round) { wl.points = ringRoom(wl.round, p); wallsShow(); return; }
      if (wl.rect) { wl.points = boxRoom(wl.rect, p); wallsShow(); return; }
      const s = wallSnap(p);
      if (wallsSame(s, wl.points.at(-1))) return;
      // Back over the last corner takes that leg off again, so a wrong turn is undone without letting go.
      if (wl.points.length > 1 && wallsSame(s, wl.points.at(-2))) wl.points.pop();
      else wl.points.push(s);
      wallsShow();
    };
    // Hovering: the corner a drag would start from, or, when rubbing out, the wall that would go.
    const wallsHover = () => {
      wl.overlay.clear();
      const p = state.at;
      if (!p) return;
      const mode = brushChoices().wallMode;
      if (mode === "roof") {
        // The roof that is there, or what a roof would cover: the room under the pointer, or — with Shift held — the
        // whole building it belongs to. Finding either means walking squares, so it is worked out once a square
        // rather than once a mouse move: it was once a move, and the page stopped answering.
        const had = roofHere(p);
        const air = state.erasing ? wallsOutsideAir() : null;
        const box = had?.room ?? (air
          ? buildingPlanAt(p, (canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c })), { grid: grid(), bounds: air.bounds, outside: air.outside })
          : roomUnder(p));
        if (!box) return;
        wl.overlay.lineStyle(2, had ? 0xff7a64 : 0xf3e4c4, 0.9);
        wl.overlay.beginFill(had ? 0xff7a64 : 0xf3e4c4, 0.1);
        wl.overlay.drawRect(box.x, box.y, box.w, box.h);
        wl.overlay.endFill();
        return;
      }
      if (mode === "move" && !state.erasing) {
        // What a drag would pick up: the one wall under the pointer, or, between walls, the whole building — its
        // walls and the roof that would travel with them.
        const one = wallsUnder(p);
        const building = one ? { walls: [one], roofs: [] } : buildingAt(p);
        if (!building) return;
        wl.overlay.lineStyle({ width: Math.max(2, grid() * 0.08), color: 0xf3e4c4, alpha: 0.6, cap: "round" });
        for (const w of building.walls) { wl.overlay.moveTo(w.c[0], w.c[1]); wl.overlay.lineTo(w.c[2], w.c[3]); }
        for (const r of building.roofs) { wl.overlay.lineStyle(2, 0xf3e4c4, 0.4); wl.overlay.drawRect(r.x, r.y, r.w, r.h); }
        return;
      }
      if ((mode === "door" || mode === "window") && !state.erasing) {
        const had = wallsUnder(p);
        if (!had) return;
        // An opening already there would be filled with something else, so it is marked whole rather than part-way.
        if (Number(had.door) > 0 || had.flags?.[ID]?.window) {
          const [ax, ay, bx, by] = had.c;
          wl.overlay.lineStyle({ width: Math.max(3, grid() * 0.34), color: 0xf3e4c4, alpha: 0.4, cap: "butt" });
          wl.overlay.moveTo(ax, ay); wl.overlay.lineTo(bx, by);
          return;
        }
        // Where the opening would be cut, marked on the straight stretch it would be cut from — the same stretch the
        // cut itself uses, so what is shown is what is got.
        const stretch = alongStretch(paintWallList(), had.id);
        if (!stretch) return;
        const { a: head, d, length: len } = stretch;
        const g = grid(), wide = Math.min(len * 0.9, g * (brushChoices().doorWide ?? 1));
        const t = Math.max(wide / 2, Math.min(len - wide / 2, (p.x - head[0]) * d[0] + (p.y - head[1]) * d[1]));
        // A painted wall is drawn as a wall seen from a little to one side, so its picture sits lifted off the line the
        // wall really runs along. The mark is lifted the same way, or it points at bare ground beside the stone.
        const up = sunLit() ?? [-0.62, -0.78], lift = g * WALL_LIFT;
        wl.overlay.lineStyle({ width: Math.max(3, g * 0.34), color: 0xf3e4c4, alpha: 0.5, cap: "butt" });
        wl.overlay.moveTo(head[0] + d[0] * (t - wide / 2) + up[0] * lift, head[1] + d[1] * (t - wide / 2) + up[1] * lift);
        wl.overlay.lineTo(head[0] + d[0] * (t + wide / 2) + up[0] * lift, head[1] + d[1] * (t + wide / 2) + up[1] * lift);
        return;
      }
      if (wallsErasing(state.erasing)) {
        const had = wallsUnder(p);
        if (!had) return;
        const [x1, y1, x2, y2] = had.c;
        wl.overlay.lineStyle({ width: Math.max(3, grid() * 0.1), color: 0xff7a64, alpha: 0.85, cap: "round" });
        wl.overlay.moveTo(x1, y1); wl.overlay.lineTo(x2, y2);
        return;
      }
      const s = wallSnap(p), r = Math.max(3, grid() * 0.07);
      wl.overlay.lineStyle(2, 0xf3e4c4, 0.9);
      wl.overlay.drawCircle(s.x, s.y, r);
    };
    // The run as it goes: a band as thick as the wall will be drawn, in its own colour.
    // The corners a drag has been through, bent into a curve when the bar asks for one.
    const wallsPath = (points) => {
      const choice = brushChoices();
      if (!choice.wallCurve || points.length < 3) return points.map((p) => [p.x, p.y]);
      return smoothRun(points, Math.max(8, grid() * 0.25));
    };
    const wallsShow = () => {
      wl.overlay.clear();
      const points = wl.points;
      if (!points?.length) return;
      const choice = brushChoices(), colour = Number.parseInt((WALL_MATERIAL_CHOICES.find((c) => c.id === choice.wallMaterial)?.base ?? "#6c6a62").slice(1), 16);
      const thick = Math.max(2, (choice.wallWidth ?? WALL_THICK) * 2 * grid()), path = wallsPath(points);
      wl.overlay.lineStyle({ width: thick, color: colour, alpha: 0.75, cap: "round", join: "round" });
      wl.overlay.moveTo(path[0][0], path[0][1]);
      for (const p of path.slice(1)) wl.overlay.lineTo(p[0], p[1]);
      if (path.length === 1) { wl.overlay.lineStyle(0); wl.overlay.beginFill(colour, 0.6); wl.overlay.drawCircle(path[0][0], path[0][1], thick * 0.5); wl.overlay.endFill(); }
      // The corners themselves, so a curve shows what it was drawn through. A ring has nothing to show that way: it is
      // the circle that is being drawn, not the corners it happens to be made of.
      // A ring is drawn as the shape it is, so the corners it happens to be made of are not marked: for a circle
      // that is its middle, for a rectangle the corner it is being dragged out of.
      if (wl.round) { wl.overlay.lineStyle(2, 0xf3e4c4, 0.8); wl.overlay.drawCircle(wl.round.x, wl.round.y, Math.max(2, grid() * 0.05)); return; }
      if (wl.rect) { wl.overlay.lineStyle(2, 0xf3e4c4, 0.8); wl.overlay.drawCircle(wl.rect.x, wl.rect.y, Math.max(2, grid() * 0.05)); return; }
      wl.overlay.lineStyle(2, 0xf3e4c4, 0.8);
      for (const p of points) wl.overlay.drawCircle(p.x, p.y, Math.max(2, grid() * 0.04));
    };
    // Letting go lays them: one Foundry wall a leg, each with its material and its years on it.
    const wallsLay = async (points, ring = false) => {
      if (!Array.isArray(points) || points.length < 2) return;
      // A ring is already the shape it is meant to be: curving it again, or throwing away its shorter legs, would
      // leave a round room with a gap in it.
      const choice = brushChoices(), path = ring ? points.map((p) => [p.x, p.y]) : wallsPath(points), least = ring ? 2 : choice.wallCurve ? 2 : grid() * 0.4;
      const docs = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < least) continue;
        // The colour it is painted in is kept on the wall, like its years and its thickness: the walls already up
        // keep the colour they were drawn in when the GM picks another.
        docs.push({ c: [Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1])], flags: { [ID]: { material: choice.wallMaterial, age: choice.wallAge ?? 0, thick: choice.wallWidth ?? WALL_THICK, ...(choice.wallTint ? { tint: choice.wallTint } : {}) } } });
      }
      if (!docs.length) return;
      try {
        const made = await canvas.scene?.createEmbeddedDocuments("Wall", docs);
        if (made?.length) rememberDecorStep(wallStepOf(made, []));
      } catch (err) { ui.notifications?.warn("Animater: those walls could not be laid."); console.warn("Animater | walls", err); }
    };

    // (Heard on the window before Foundry's canvas hears them, and kept from it while painting, so a stroke never draws
    // Foundry's drag-select box or selects what it passes over.)
    const down = (e) => {
      if (e.target !== view) return; if (e.button === 2) { state.rightAt = { x: e.clientX, y: e.clientY }; return; } if (e.button !== 0) return; e.stopImmediatePropagation(); e.preventDefault(); const p = at(e);
      if (wallsOn()) { wallsDown(p, e.shiftKey); state.down = !!wl.points || !!wl.move || wl.rubbing; state.erasing = e.shiftKey; draw(); return; }
      if (heightsOn()) { if (!heightsDown(p, e.shiftKey, e.altKey)) return; state.down = true; state.erasing = e.shiftKey; state.last = p; draw(); floorDab(p); return; }
      if (floorsOn()) { if (!floorBegin(p, e.shiftKey)) return; state.down = true; state.erasing = e.shiftKey; state.last = p; draw(); floorDab(p); return; }
      begin(p); state.down = true; state.erasing = e.shiftKey; state.last = p; draw(); dab(p, e.shiftKey, true);
    };
    const move = (e) => {
      // Off the map (over the bar, say): the ring and the ghost go with the pointer, instead of being left standing at the last
      // place it was over the map and redrawn there by every choice the bar changes.
      if (!state.down && e.target !== view) { hideHover(); if (state.at) { state.at = null; draw(); } return; } const p = at(e); state.at = p; if (!state.down) state.erasing = e.shiftKey; draw();
      if (hz.drag) { e.stopImmediatePropagation(); hz.drag.ramp.b = p; refreshHeights(); return; }
      if (hz.open) { e.stopImmediatePropagation(); const last = hz.open.circles.at(-1); if (Math.hypot(p.x - last.x, p.y - last.y) >= hz.open.r * 0.5) { hz.open.circles.push({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(hz.open.r) }); refreshHeights(); } return; }
      if (wallsOn()) { if (state.down && (wl.points || wl.move || wl.rubbing)) { e.stopImmediatePropagation(); wallsMove(p); } else hideHover(); return; }
      if (!state.down && heightsOn()) { hideHover(); heightsHover(p); return; }
      if (!state.down) { if (floorsOn() && fl.map && !e.shiftKey) hoverFloor(p); else hideHover(); return; } e.stopImmediatePropagation();
      // A floor stroke dabs every third of the ring, filling the gaps between, so a quick drag paints a band, not beads.
      if (fl.stroke) { const step = sizeNow() * grid() / 6, dist = Math.hypot(p.x - state.last.x, p.y - state.last.y); if (dist < step) return; for (let s = step; s <= dist; s += step) floorDab({ x: state.last.x + ((p.x - state.last.x) * s) / dist, y: state.last.y + ((p.y - state.last.y) * s) / dist }); state.last = p; return; }
      if (Math.hypot(p.x - state.last.x, p.y - state.last.y) > sizeNow() * grid() * 0.35) { state.last = p; dab(p, e.shiftKey); }
    };
    const up = (e) => { if (wl.rubbing) { e.stopImmediatePropagation(); state.down = false; wl.rubbing = false;
        // One stroke, one step: a drag that rubbed out a dozen walls is taken back in one go.
        if (wl.gone.length) { rememberDecorStep({ kind: "walls", made: [], gone: wl.gone }); wl.gone = []; }
        refreshStatus(); return; }
      if (wl.move) { e.stopImmediatePropagation(); state.down = false; const move = wl.move; wl.move = null; wl.overlay.clear(); void buildingMove(move).then(refreshStatus); return; }
      if (wl.points) { e.stopImmediatePropagation(); state.down = false; const run = wl.points, ring = !!wl.round || !!wl.rect; wl.points = null; wl.round = null; wl.rect = null; wl.overlay.clear(); void wallsLay(run, ring).then(refreshStatus); return; }
      if (hz.open) { e.stopImmediatePropagation(); state.down = false; const open = hz.open; hz.open = null; void saveOpenEdges(open); return; } if (hz.drag) { e.stopImmediatePropagation(); state.down = false; const drag = hz.drag; hz.drag = null; void layRamp(drag); return; } if (!state.down) return; e.stopImmediatePropagation(); state.down = false; draw(); if (fl.stroke) void floorFinish(); else void finish().then(refreshStatus); };
    const key = (e) => {
      if (e.target?.closest?.("input, textarea")) return;
      // Ctrl+Z takes back the last stroke, Ctrl+Shift+Z or Ctrl+Y puts it back (Foundry's own undo waits while the brush is out).
      const z = e.key === "z" || e.key === "Z", undo = (e.ctrlKey || e.metaKey) && z && !e.shiftKey, redo = (e.ctrlKey || e.metaKey) && ((z && e.shiftKey) || e.key === "y" || e.key === "Y");
      if (undo || redo) { e.preventDefault(); e.stopImmediatePropagation(); if (!state.down) void (undo ? undoDecorStep() : redoDecorStep()).then(refreshStatus); return; }
      // 1, 2 and 3 switch the tabs (kept from Foundry's macro bar while the brush is out).
      if ((e.key === "1" || e.key === "2" || e.key === "3") && !(e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); e.stopImmediatePropagation(); state.bar?.setTab(e.key === "1" ? "floors" : e.key === "2" ? "decor" : "heights"); return; }
      if (e.key === "Escape") stopDecorBrush();
      else if (e.key === "[" || e.key === "]") { const next = Math.min(DECOR_BRUSH.max, Math.max(DECOR_BRUSH.min, sizeNow() + (e.key === "]" ? DECOR_BRUSH.step : -DECOR_BRUSH.step))); state.bar?.setSize(next); draw(); }
    };
    // The wheel still zooms the map; Ctrl+wheel sets the brush's size and Shift+wheel how thick it lays them (both kept from
    // Foundry, whose Ctrl or Shift+wheel would turn the selected tokens).
    const wheel = (e) => {
      // On Heights (Raise), the plain wheel over a raised part raises or lowers it; elsewhere it zooms as ever.
      if (e.target === view && heightsOn() && brushChoices().heightMode === "raise" && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { const part = heightsHere().field.partAt(at(e)); if (part) { e.preventDefault(); e.stopImmediatePropagation(); wheelHeight(part, (e.deltaY || e.deltaX) < 0); return; } }
      if (e.target !== view || !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const up = (e.deltaY || e.deltaX) < 0;
      // On Walls there is no brush to size, so the wheel moves what the mode is about instead: Ctrl+wheel a wider
      // doorway or a thicker wall, Shift+wheel the years on it. A mode with nothing to move leaves the wheel alone.
      if (wallsOn()) {
        const main = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey, second = e.shiftKey && !(e.ctrlKey || e.metaKey || e.altKey);
        if ((main || second) && state.bar?.nudge(main ? "main" : "second", up ? 1 : -1)) refreshStatus();
        return;
      }
      // On Floors, Alt+wheel is How alike; Shift+wheel turns nothing.
      if ((floorsOn() || heightsOn()) && e.altKey && !(e.ctrlKey || e.metaKey || e.shiftKey)) state.bar?.setTol(brushChoices().tol + (up ? 2 : -2));
      else if ((floorsOn() || heightsOn()) && e.shiftKey) return;
      else if (e.altKey && !(e.ctrlKey || e.metaKey || e.shiftKey)) state.bar?.setScale(brushChoices().scale + (up ? 0.1 : -0.1));
      else if (e.shiftKey && !(e.ctrlKey || e.metaKey)) state.bar?.turnBy(up ? -1 : 1);
      else if (e.shiftKey) state.bar?.setThick(brushChoices().thick + (up ? 0.1 : -0.1));
      else { const next = Math.min(DECOR_BRUSH.max, Math.max(DECOR_BRUSH.min, sizeNow() + (up ? DECOR_BRUSH.step : -DECOR_BRUSH.step))); state.bar?.setSize(next); }
      draw();
    };
    // The browser's own menu is kept off the map while painting, and that is all it does now. A right-click that
    // stayed put used to put the brush away, which is a hair's breadth from a right-drag that panned the map and a
    // two-finger tap that is a right-click to the browser: the bar went out from under whoever was painting with it.
    // It is put away with Esc, or with the cross on the bar (Roi: "it only needs to be closed with Esc").
    const menu = (e) => { state.rightAt = null; e.preventDefault(); };
    window.addEventListener("pointerdown", down, true); window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("keydown", key, true); view.addEventListener("contextmenu", menu, true); window.addEventListener("wheel", wheel, { capture: true, passive: false });
    state.stop = () => { flushWheel(); window.removeEventListener("pointerdown", down, true); window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("keydown", key, true); view.removeEventListener("contextmenu", menu, true); window.removeEventListener("wheel", wheel, { capture: true }); for (const [hook, id] of regionHooks) Hooks.off(hook, id); try { ring.destroy(); ghost.destroy({ children: true }); fl.overlay.destroy(); hz.overlay.destroy(); hz.labels.destroy({ children: true }); fl.preview?.destroy({ texture: true, baseTexture: true }); clearTimeout(hoverTimer); clearTimeout(fl.hoverAsk); fl.hover?.destroy({ texture: true, baseTexture: true }); top.parent?.removeChild(top); top.destroy(); if (sam.ready) void sam.ready.seg.drop(sam.ready.view); } catch { /* gone */ } state.bar?.close(); };
    if (floorsOn()) void readMap().then(refreshStatus);
    if (heightsOn()) { void readMap(); refreshHeights(); }
    refreshStatus();
    // The smart model already downloaded (this browser keeps it): the brush starts on Model, never asking for a download,
    // unless the GM picked Edges themselves this session.
    void (async () => {
      try {
        const { isSmartModelCached } = await import("../ui/smart-model.mjs");
        if (!brushChoices().edgesChosen && await isSmartModelCached() && decorBrushing === state) { state.bar?.setEdges("model"); if (floorsOn() || heightsOn()) void loadSam(); }
      } catch { /* the cache unreadable: stays as it is */ }
    })();
  };
  // Trunks that block (a region's "Trunks block movement, sight and light"): a small ring of real walls round each tree's trunk and
  // each stump, made by the lead GM and kept in step with the trees as they are reshuffled, brushed, rubbed out or turned off, and
  // removed with their region. Each is marked as its region's (flags.animater.trunkOf), so no other wall is ever touched.
  let trunkWallsTimer = null;
  // (The GM who changed the region builds them; on a scene shown afresh, the lead GM checks them.)
  const trunkWallsSoon = (mine = false) => { clearTimeout(trunkWallsTimer); trunkWallsTimer = setTimeout(() => { trunkWallsTimer = null; void syncTrunkWalls(mine); }, 700); };
  const trunkKey = (list) => list.map((w) => w.c.join(",")).sort().join("|");
  const syncTrunkWalls = async (mine = false) => {
    if (!canvas?.ready || !game.user?.isGM || !(mine || leadGM())) return;
    const scene = canvas.scene, g = canvas.grid?.size ?? 100, want = new Map(), have = new Map();
    for (const region of scene.regions ?? []) {
      try { const s = decorSettings(region.flags?.[ID]?.decor); if (s?.blocks) want.set(region.id, { walls: trunkWalls(decorPlacements({ settings: s, areas: regionAreas(region), grid: g, id: region.id }), g), levels: [...(region.levels ?? [])] }); } catch { /* a broken region never breaks the rest */ }
    }
    for (const wall of scene.walls ?? []) { const of = wall.flags?.[ID]?.trunkOf; if (!of) continue; if (!have.has(of)) have.set(of, []); have.get(of).push(wall); }
    const gone = [], made = [];
    for (const [id, walls] of have) { const w = want.get(id); if (!w || trunkKey(walls) !== trunkKey(w.walls)) gone.push(...walls.map((x) => x.id)); }
    for (const [id, w] of want) { const had = have.get(id); if (had && trunkKey(had) === trunkKey(w.walls)) continue; for (const { c } of w.walls) made.push({ c, move: CONST.WALL_MOVEMENT_TYPES.NORMAL, sight: 20, light: 20, sound: 0, levels: w.levels, flags: { [ID]: { trunkOf: id } } }); }
    try { if (gone.length) await scene.deleteEmbeddedDocuments("Wall", gone); if (made.length) await scene.createEmbeddedDocuments("Wall", made); }
    catch (err) { console.warn("Animater | trunk walls", err); }
  };
  // Dragging a region carries what was painted into it by hand (and the spots rubbed out) along with it, in the same update, and
  // the breaks of those hand decorations too (decor-break carryDecorBroken).
  Hooks.on("preUpdateRegion", (doc, change) => { if (!change?.shapes) return; try { const moved = carryDecor(doc.flags?.[ID]?.decor, doc.toObject().shapes, change.shapes); if (moved) { foundry.utils.setProperty(change, `flags.${ID}.decor.brushed`, moved.brushed); foundry.utils.setProperty(change, `flags.${ID}.decor.erased`, moved.erased); const broken = readDecorBroken(doc.flags?.[ID]?.decorBroken); if (broken.length) foundry.utils.setProperty(change, `flags.${ID}.decorBroken`, carryDecorBroken(broken, moved.dx, moved.dy)); } } catch (err) { console.warn("Animater | moving a region's decorations", err); } });
  // Dragging a crossing's region carries its ends (the ladder, rope or bridge with them), a raised part's its open edges;
  // stretching it stretches them, so a bridge grows to fill its bigger region.
  Hooks.on("preUpdateRegion", (doc, change) => { if (!change?.shapes) return; try { const own = doc.flags?.[ID]; if (!own?.ramp && !own?.openEdges?.length) return; for (const [k, v] of Object.entries(refitHeights(own, shapesBox(doc.toObject().shapes), shapesBox(change.shapes)))) foundry.utils.setProperty(change, `flags.${ID}.${k}`, v); } catch (err) { console.warn("Animater | moving a region's crossing", err); } });
  // (A decoration break or repair write moves no trunk: trees never break.)
  for (const hook of ["createRegion", "updateRegion", "deleteRegion"]) Hooks.on(hook, (first, changes, options, ...more) => { if (quietSave(first, changes, options)) return; const userId = [changes, options, ...more].at(-1); if (first?.parent === canvas?.scene) trunkWallsSoon(userId === game.user?.id); });
  Hooks.on("canvasReady", () => { trunkWallsSoon(); });
  const stopDecorBrush = () => { const s = decorBrushing; decorBrushing = null; if (s) { s.stop?.(); syncDecorations(); } lifeAfterPaint(); };
  /** Is a GM drawing walls at this moment? (The living world holds still while they are.) */
  const paintingWalls = () => { try { return !!decorBrushing && brushChoices().tab === "walls"; } catch { return false; } };
  // The brush's strokes, to take back and put back (this screen, this scene, the last 30): a stroke into a region (what it held
  // before and after) or one that made a new region (taken back, the region goes; put back, it is made again).
  const decorSteps = { undo: [], redo: [] };
  const rememberDecorStep = (step) => { decorSteps.undo.push(step); if (decorSteps.undo.length > 30) decorSteps.undo.shift(); decorSteps.redo = []; };
  const decorRegion = (id) => canvas.scene?.regions?.get(id) ?? null;
  // A stroke of the Structures tab, taken back and put back: what it made, and what it took away to make it. Both sides are
  // kept whole, with their ids, so a doorway undone puts the one wall back exactly as it was and redone cuts it again.
  const wallStepOf = (made, gone) => ({ kind: "walls", made: made.map((d) => d.toObject()), gone: gone.map((d) => d.toObject()) });
  const wallsBack = async (drop, make) => {
    const here = canvas?.scene;
    if (!here) return;
    const ids = drop.map((w) => w._id).filter((id) => here.walls.get(id));
    if (ids.length) await here.deleteEmbeddedDocuments("Wall", ids);
    const missing = make.filter((w) => !here.walls.get(w._id));
    if (missing.length) await here.createEmbeddedDocuments("Wall", missing, { keepId: true });
  };
  const undoWallStep = (step) => wallsBack(step.made, step.gone);
  const redoWallStep = (step) => wallsBack(step.gone, step.made);
  // A building carried somewhere else: its walls went by the same step, and so did the roofs over it. Taken back, both
  // go the other way; put back, they go again.
  const moveStepTo = async (step, which) => {
    const here = canvas?.scene;
    if (!here) return;
    const updates = (step.walls ?? []).filter((w) => here.walls.get(w.id)).map((w) => ({ _id: w.id, c: [...w[which]] }));
    if (updates.length) await here.updateEmbeddedDocuments("Wall", updates);
    const spots = new Map((step.roofs ?? []).map((r) => [r.id, r[which]]));
    if (spots.size) {
      const roofs = (here.flags?.[ID]?.roofs ?? []).map((r) => (spots.has(r.id) ? { ...r, x: spots.get(r.id)[0], y: spots.get(r.id)[1] } : r));
      await here.update({ [`flags.${ID}.roofs`]: roofs });
    }
  };
  const undoDecorStep = async () => {
    const step = decorSteps.undo.pop(); if (!step) { ui.notifications?.info?.("No brush stroke to take back."); return; }
    try {
      if (step.kind === "walls") await undoWallStep(step);
      else if (step.kind === "moved") await moveStepTo(step, "was");
      else if (step.kind === "floor") await undoFloorStep(step);
      else if (step.kind === "open") { for (const c of step.changed) await decorRegion(c.id)?.update({ [`flags.${ID}.openEdges`]: c.before }); }
      else if (step.kind === "height") await decorRegion(step.id)?.update({ [`flags.${ID}.height`]: step.before, ...(/^Raised\b/.test(decorRegion(step.id)?.name ?? "") ? { name: heightName(step.before, heightUnits()) } : {}) });
      else if (step.kind === "edit") await decorRegion(step.id)?.update({ flags: { [ID]: { decor: step.before } } }, { render: false });
      else await decorRegion(step.id)?.delete();
      decorSteps.redo.push(step);
    } catch (err) { console.warn("Animater | decorations undo", err); }
  };
  const redoDecorStep = async () => {
    const step = decorSteps.redo.pop(); if (!step) return;
    try {
      if (step.kind === "walls") await redoWallStep(step);
      else if (step.kind === "moved") await moveStepTo(step, "now");
      else if (step.kind === "floor") await redoFloorStep(step);
      else if (step.kind === "open") { for (const c of step.changed) await decorRegion(c.id)?.update({ [`flags.${ID}.openEdges`]: c.after }); }
      else if (step.kind === "height") await decorRegion(step.id)?.update({ [`flags.${ID}.height`]: step.after, ...(/^Raised\b/.test(decorRegion(step.id)?.name ?? "") ? { name: heightName(step.after, heightUnits()) } : {}) });
      else if (step.kind === "edit") await decorRegion(step.id)?.update({ flags: { [ID]: { decor: step.after } } }, { render: false });
      else { const [made] = await canvas.scene.createEmbeddedDocuments("Region", [step.data]); if (made) step.id = made.id; }
      decorSteps.undo.push(step);
    } catch (err) { console.warn("Animater | decorations redo", err); }
  };
  // A floor stroke (Map painting's Floors tab): the regions it reshaped (their shapes before and after), made and removed.
  // Taken back, reshaped ones get their old shapes, made ones go and removed ones come back; put back, the other way.
  const undoFloorStep = async (step) => {
    for (const u of step.updates) await decorRegion(u.id)?.update({ shapes: u.before });
    for (const c of step.creates) await decorRegion(c.id)?.delete();
    for (const r of step.removes) { const [made] = await canvas.scene.createEmbeddedDocuments("Region", [r.data]); if (made) r.id = made.id; }
  };
  const redoFloorStep = async (step) => {
    for (const u of step.updates) await decorRegion(u.id)?.update({ shapes: u.after });
    for (const c of step.creates) { const [made] = await canvas.scene.createEmbeddedDocuments("Region", [c.data]); if (made) c.id = made.id; }
    for (const r of step.removes) await decorRegion(r.id)?.delete();
  };
  Hooks.on("canvasTearDown", () => { stopDecorBrush(); decorSteps.undo = []; decorSteps.redo = []; });
  const regionPointIn = (p, areas) => areas.some((a) => pointInPolygon(p, a) && !(a.holes ?? []).some((h) => pointInPolygon(p, h)));
  return { start: startDecorBrush, stop: stopDecorBrush, brushing: () => decorBrushing, NEW_DECOR_REGION, paintingWalls };
}

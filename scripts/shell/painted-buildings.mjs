// The buildings a map is painted with: walls, the doorways and windows cut in them, the roofs over them, and what a
// building hangs out on a feast day. This is the shell for that one feature — it talks to Foundry, keeps the layers
// and registers the hooks — while the painting itself is done by the pure engines under engines/motion.
//
// It is the first piece lifted out of main.mjs, which had grown to twenty thousand lines of every feature at once.
// Everything it needs from the rest of the module arrives in one object, so what it depends on is a list you can
// read rather than a file you have to search: whether painting is on, the sun, the season, the weather, the wind
// the sky is blowing, whether the scene is underground, and a layer to draw into.

import { createPaintedWalls } from '../engines/motion/painted-walls.mjs';
import { createPaintedDoors } from '../engines/motion/painted-doors.mjs';
import { createPaintedWindows } from '../engines/motion/painted-windows.mjs';
import { createPaintedRoofs } from '../engines/motion/painted-roofs.mjs';
import { createPaintedDressing } from '../engines/motion/painted-dressing.mjs';
import { wallRuns, wallLook, wallDoors, wallWindows } from '../engines/motion/wall-looks.mjs';
import { WALL_THICK, WALL_LIFT, litFrom } from '../engines/motion/wall-paint.mjs';
import { roofsOf, roofLook, under as underRoof } from '../engines/motion/roof-looks.mjs';
import { roofShape, ROOF_OVERHANG } from '../engines/motion/roof-paint.mjs';
import { roofOpenings } from '../engines/motion/roof-sight.mjs';
import { dressingOf, dressingKey, handDressing } from '../engines/motion/holiday-dressing.mjs';
import { outsideSquares, partition } from '../engines/motion/building-plan.mjs';

/** Degrees of sky worth painting a building again for. */
const SUN_STEP = 12;
/** How much of a wall's thickness a partition keeps: a stud wall between two rooms, not the outside stone. */
export const PARTITION_THIN = 0.62;
/** One light per lantern, small: a lantern throws light about as far as it hangs from the eave. */
const GARLAND_LIGHTS_MOST = 160, GARLAND_REACH = 0.62, GARLAND_LIGHT = 0.55;
/** The eave as an edge that stops light, a touch beyond the roof's own edge so the lanterns hang outside it. */
// (20 is the "normal" sense: the number Foundry's own walls carry. Asked of CONST by name it comes back through a
// deprecated proxy that warns on every read, so the number is written out here instead.)
const EAVE_STEP = -0.08, LIGHT_BLOCKS = 20;

/**
 * Start the painted buildings. `ctx` is everything this feature needs from the rest of the module:
 *
 * - `ID` the module id, `floorLayer(name)` a container to draw into
 * - `painting()` whether painted walls are switched on, `underground()` whether this scene is below ground
 * - `sun()` the sun now (or null), `season()` the season, `weather()` the scene's weather
 * - `sky()` what the sky is actually blowing: `{ seen, wind, windAngle }`
 * - `skyColour()` the colour of the light falling out of the sky now, `[r, g, b]` from 0 to 1
 * - `sunCasts()` whether the sun is casting shadows on this scene now
 */
export function createPaintedBuildings(ctx) {
  const { ID, floorLayer } = ctx;
  const gridNow = () => globalThis.canvas?.grid?.size ?? 100;
  const scene = () => globalThis.canvas?.scene ?? null;
  const flags = () => scene()?.flags?.[ID] ?? {};
  const on = () => ctx.painting() === true;

  const PIXI = globalThis.PIXI;
  const wallRoot = floorLayer('paintedWalls'), doorRoot = floorLayer('paintedDoors');
  const walls = createPaintedWalls({ PIXI, root: wallRoot, grid: gridNow });
  const doors = createPaintedDoors({ PIXI, root: doorRoot, grid: gridNow });
  const windows = createPaintedWindows({ PIXI, root: doorRoot, grid: gridNow });
  // The roofs are drawn OVER the lighting, not in the map with everything else.
  //
  // Foundry composites its lighting across the whole primary canvas group in one pass, so a lamp standing in a room
  // lit the roof above it — the light came up through the tiles (Roi: "also i see lights through the roof...", and
  // the same thing read as "sun light is..weird on roofs?" when a bright slope tracked where a light had been put).
  // Nothing drawn inside that group can escape it, which is the same wall the garland lanterns hit from the other
  // side. So a roof is drawn above the lighting instead.
  //
  // Above it, in the INTERFACE group — not in canvas.effects, where the lightning flash goes. That group is the
  // lighting itself: it is masked and its contents are composited as light, so a roof put there came out as a
  // translucent wash and the room showed straight through it, uncut, unfaded and at full alpha (Roi: "still
  // see-through"). A flash belongs in the lighting. A roof is a thing in the way, and belongs over it.
  //
  // Above the tokens, since a roof hides what is under it, and below the walls, the templates and the door controls,
  // which a GM has to be able to see and reach. The cost of being out of the lighting is that the map's darkness no
  // longer reaches the roofs either, so they take the sky's light themselves (skyTint below). What they must never
  // take is a lamp's, which is the whole point.
  const ROOF_ABOVE_LIGHT = 250;
  let roofRoot = null, roofLight = null;
  const roofHost = () => globalThis.canvas?.interface ?? globalThis.canvas?.effects;
  const roofRootOf = () => {
    if (!roofRoot || roofRoot.destroyed || roofRoot.parent !== roofHost()) {
      roofRoot = new PIXI.Container();
      roofRoot.eventMode = 'none';
      roofRoot.zIndex = ROOF_ABOVE_LIGHT;
      roofRoot.name = `animater.paintedRoofs`;
      // A colour matrix, not the container's `tint`: tint is a sprite's property and setting it on a container does
      // nothing at all — it reads back as you left it while the roofs carry on in their painted colours.
      try {
        const Filter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
        roofLight = Filter ? new Filter() : null;
        if (roofLight) roofRoot.filters = [roofLight];
      } catch { roofLight = null; }
      const host = roofHost();
      host.sortableChildren = true;
      host.addChild(roofRoot);
      host.sortChildren?.();
    }
    return roofRoot;
  };
  const roofs = createPaintedRoofs({ PIXI, root: roofRootOf, grid: gridNow });
  /** How dark a roof goes at midnight. Not to black: a roof under a night sky is still a shape you can make out. */
  const ROOF_NIGHT = 0.1;
  // The sky's own light on the roofs, and nothing else's: how bright, from the scene's darkness, and what colour,
  // from the sun itself — so a roof turns gold at dawn and dusk and silver under the moon along with the ground,
  // instead of keeping a noon colour all evening.
  const skyTint = () => {
    const dark = Math.max(0, Math.min(1, Number(globalThis.canvas?.environment?.darknessLevel) || 0));
    // Straight off the scene's darkness, which is what the lighting pass would have done to them: eased back a
    // little only so a roof never goes flat black and loses its own shape.
    const lit = Math.max(ROOF_NIGHT, 1 - dark);
    const colour = ctx.skyColour?.();
    // How much of the sun's colour the roofs take. Not all of it: the lighting pass the ground gets lays its colour
    // on far more gently than a straight multiply, and at a deep orange-red sunset a roof taking the whole of it
    // went rust while the street below it was merely warm.
    const SKY_STAIN = 0.45;
    const k = (i) => {
      const c = Array.isArray(colour) && Number.isFinite(Number(colour[i])) ? Math.max(0, Math.min(1, Number(colour[i]))) : 1;
      return 1 - SKY_STAIN + SKY_STAIN * c;
    };
    return [lit * k(0), lit * k(1), lit * k(2)];
  };
  // What the sky's light does to the roofs, as a colour matrix: each channel scaled, nothing moved about.
  let litWas = '';
  const lightRoofs = () => {
    if (!roofLight) return;
    const [r, g, b] = skyTint();
    const said = `${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}`;
    if (said === litWas) return;
    litWas = said;
    roofLight.matrix = [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
  };
  const dressing = createPaintedDressing({ PIXI, root: floorLayer('paintedDressing'), shadeRoot: floorLayer('paintedDressingShade'), grid: gridNow });

  // The scene's walls as the engines want them: plain records, our own flags and nothing of Foundry's.
  const wallList = () => (globalThis.canvas?.walls?.placeables ?? []).map((w) => ({ id: w.id, c: w.document.c, door: w.document.door, ds: w.document.ds, move: w.document.move, animater: w.document.flags?.[ID] ?? null }));
  const wallScene = () => ({ underground: ctx.underground() });

  let dirty = false, were = false, saw = null, from = '', told = false;
  // What the walls on this map amount to, in a word. canvasReady can arrive before the walls are on the canvas, and
  // a rebuild then finds nothing and sets the flag down again — so the map stayed bare until something else happened
  // to change a wall. The tick watches this instead of trusting one pulse, and catches up by itself.
  const wallsNow = () => `${scene()?.id ?? ''}:${globalThis.canvas?.walls?.placeables?.length ?? -1}`;

  // What the sky is doing to the roofs: the snow lying on the ground is lying on them too, and rain that darkens the
  // one darkens the other. Rounded, because a roof is a picture and must not be painted again for a hundredth of a
  // degree of wet.
  const roofWeatherNow = () => {
    const ground = flags().ground ?? {};
    const much = (v) => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 5) / 5;
    return { snow: much(ground.snow), wet: much(ground.wet) };
  };
  const sunLit = () => { const sun = ctx.sun(); return sun ? litFrom(sun.angle) : null; };
  const sunKey = () => { const sun = ctx.sun(); return sun ? `:s${Math.round((Number(sun.angle) || 0) / SUN_STEP)}` : ''; };
  // The feast day the calendar says it is, if any — or the one the GM has called by hand, which wins, because a
  // world with no calendar module has nothing else to go on.
  const dressingNow = () => {
    try {
      const byHand = handDressing(flags().holiday);
      if (byHand) return byHand;
      const api = globalThis.CALENDARIA?.api;
      const today = api?.getCurrentFestival?.();
      if (!today?.name) return null;
      // More than one feast can fall on a day. The calendar names one of them; the rest are the ones in its own
      // records standing on the same day as that one. Found this way rather than by working the date out again:
      // the records count their months from zero and the clock counts from one, and the calendar has already done
      // the sum correctly once.
      const kept = api?.getActiveCalendar?.()?.festivals ?? {};
      const sameDay = Object.entries(kept)
        .filter(([, f]) => f?.month === today.month && f?.dayOfMonth === today.dayOfMonth)
        .map(([key, f]) => ({ ...f, festivalKey: key }));
      return dressingOf(sameDay.length ? sameDay : today);
    } catch { return null; }
  };
  // Everything about a roof's picture that is not the roof itself: the sun it stands in, the weather on it and the
  // feast day. The layer knows a roof by its key, so whoever asks it about one — to fade it, to open it — has to
  // spell it the same way, and there are three places that do.
  // Whether the sun is casting the building's shadow just now. While it is, the roof's own painted shadow is left
  // off: a building throws one shadow, and the cast one is the one that knows the hour. Where nothing is cast —
  // underground, a map told to have no shadows, the sun switched off — the painted one stays, since without any
  // shadow clear of the eaves a hip roof reads as a box you are looking down into.
  const sunCasts = () => { try { return ctx.sunCasts?.() === true; } catch { return false; } };
  const roofSuffix = () => { const w = roofWeatherNow(); return `${sunKey()}:w${Math.round(w.snow * 5)}${Math.round(w.wet * 5)}${dressingKey(dressingNow())}${sunCasts() ? ':c' : ''}`; };

  let sunKeySeen = null;
  const followSun = () => {
    const now = roofSuffix();
    if (now === sunKeySeen) return;
    sunKeySeen = now;
    dirty = true;
    soon();
  };

  // The air outside the buildings on this scene, kept for as long as the walls stay as they are: it is a flood of
  // the whole map and there is no sense in doing it again for every run painted.
  let air = null, airFrom = '';
  const outsideAir = () => {
    const rect = globalThis.canvas?.dimensions?.sceneRect;
    if (!rect || !globalThis.canvas?.ready) return null;
    const grid = gridNow();
    const said = `${scene()?.id}:${grid}:${(globalThis.canvas.walls?.placeables ?? []).map((w) => w.document.c.map(Math.round).join()).join('|')}`;
    if (air && airFrom === said) return air;
    const bounds = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    try {
      const outside = outsideSquares((globalThis.canvas.walls?.placeables ?? []).map((w) => ({ c: w.document.c })), { grid, bounds });
      air = { outside, bounds };
      airFrom = said;
    } catch { air = null; airFrom = ''; }
    return air;
  };
  /** Is this stretch of wall a partition — a wall with rooms on both sides? */
  const insideWall = (points) => { const a = outsideAir(); return a ? partition(points, { grid: gridNow(), bounds: a.bounds, outside: a.outside }) : false; };

  const rebuild = () => {
    dirty = false;
    if (!on()) { walls.drop(); doors.drop(); windows.drop(); roofs.drop(); dressing.drop(); return; }
    const said = wallScene(), season = ctx.season(), list = wallList();
    const lit = sunLit(), litKey = sunKey();
    // A wall inside a house is a stud wall between two rooms, not the stone holding the weather out: thinner, lower,
    // and passing under the walls that do hold it out.
    const runs = wallRuns(list, said).map((run) => {
      const thin = insideWall(run.points);
      const thick = thin ? Math.max(0.05, (run.thick ?? WALL_THICK) * PARTITION_THIN) : run.thick;
      const height = thin ? WALL_LIFT * PARTITION_THIN : undefined;
      return { ...run, thick, height, under: thin, key: `${run.key}${thin ? ':p' : ''}${litKey}`, look: { ...wallLook({ ...said, age: run.age }, { season }), lit } };
    });
    saw = { walls: list.length, runs: runs.length, season, said };
    from = wallsNow();
    walls.populate({ runs, look: { ...wallLook(said, { season }), lit } });
    // An opening is as thick as the wall round it, partition and all, and stands as high as that wall does — so it
    // is lifted off the line the wall runs along by the same step the wall's own top is.
    const thinOpening = (ends, thick) => {
      const thin = insideWall(ends);
      return {
        thick: thin ? Math.max(0.05, (thick ?? WALL_THICK) * PARTITION_THIN) : thick,
        lift: thin ? WALL_LIFT * PARTITION_THIN : WALL_LIFT,
        p: thin ? ':p' : '',
      };
    };
    doors.populate({ doors: wallDoors(list).map((d) => {
      const { thick, lift, p } = thinOpening([d.hinge, d.far], d.thick ?? WALL_THICK);
      return { ...d, thick, lift, key: `${d.key}${p}${litKey}`, lit };
    }) });
    windows.populate({ windows: wallWindows(list).map((w) => {
      const half = w.length / 2, dx = Math.cos(w.along) * half, dy = Math.sin(w.along) * half;
      const { thick, lift, p } = thinOpening([[w.middle[0] - dx, w.middle[1] - dy], [w.middle[0] + dx, w.middle[1] + dy]], w.thick ?? WALL_THICK);
      return { ...w, thick, lift, lit, key: `${w.key}${p}${litKey}` };
    }) });
    // Roofs are the scene's own, not walls: it keeps them, and each takes the year as its own age says. The weather
    // belongs in the key as much as the sun does — a picture of a bare roof does not become a snowy one by being
    // left alone.
    const grid = gridNow();
    const over = roofsOf(flags(), { grid });
    const sky = { ...flags(), ...roofWeatherNow() };
    const skyKey = roofSuffix();
    // (Reach nought: the painted shadow lies wholly under the roof it belongs to, which is to say nowhere.)
    const own = sunCasts() ? { shadowReach: 0 } : {};
    roofs.populate({
      roofs: over.map((r) => ({ ...r, key: `${r.key}${skyKey}`, look: { ...roofLook(sky, { season, age: r.age }), ...own, lit, dressing: dressingNow()?.colour ?? null } })),
      look: { ...roofLook(sky, { season }), ...own, lit },
    });
    // What the dressed buildings hang out, off the eave ring of each roof. Not part of the roof's own picture: it
    // swings in the wind and lights up at dusk, and that picture is painted once and kept.
    const feast = dressingNow();
    dressing.populate({
      colour: feast?.colour ?? null,
      colours: feast?.colours ?? null,
      roofs: over.filter((r) => r.dressed).map((r) => ({
        key: r.key,
        dressed: true,
        kind: r.hangs,
        ring: roofShape(r.form, r.room.x, r.room.y, r.room.w, r.room.h, grid * ROOF_OVERHANG, r.high)?.eave ?? [],
      })),
    });
    drain();
  };

  // Painting a few at a time keeps a big map from holding the frame, on a clock of its own rather than the canvas
  // ticker: that callback never fired at all on one table, and the runs sat in the queue with the map bare.
  let draining = null;
  const drain = () => {
    if (draining) return;
    const tick = () => {
      draining = null;
      let left = 0;
      try {
        left = walls.step(3) + doors.step(0.05, 3) + windows.step(0.05, 3) + roofs.step(0.05, 2);
        // Painting is not the only thing that needs a tick: a door swinging, a window opening and a roof fading all
        // move a little each time. Stopping the moment the queue was empty left them frozen half way.
        left += doors.state.swinging + windows.state.moving + roofs.state.fading;
        // Bunting never settles: it stirs in still air and swings in a wind, so while a building is dressed this
        // clock keeps running. The wind is the sky's, which is where the Weather panel's own wind lands.
        try {
          const blowing = ctx.sky(), fallback = ctx.weather();
          dressing.weather({
            wind: blowing?.seen ? blowing.wind : fallback.wind,
            windAngle: blowing?.seen ? blowing.windAngle : fallback.windAngle,
            sun: ctx.sun(), ...roofWeatherNow(),
          });
          left += dressing.step(0.05);
          garlandLightsTick();
        } catch { /* no weather yet */ }
      } catch (err) { if (!told) { told = true; console.warn('Animater | painted walls', err); } return; }
      if (left > 0) draining = setTimeout(tick, 30);
    };
    draining = setTimeout(tick, 0);
  };

  // Painting is done a couple of runs a frame: a keep with three hundred segments fills in over a second or two
  // instead of holding the frame while every one of them is drawn.
  let ticks = 0;
  const tick = () => {
    ticks++;
    // The sky's light on the roofs, kept up each frame: it is theirs to carry now that the lighting pass cannot
    // reach them. Cheap, and the clock moves it a little at dawn and dusk.
    if (roofRoot && !roofRoot.destroyed) lightRoofs();
    try { hoverNow(); } catch { /* no pointer yet */ }
    const now = on();
    if (now !== were) { were = now; dirty = true; }
    if (now && wallsNow() !== from) dirty = true;
    // A throw in here would otherwise be swallowed by the ticker and the walls would simply never appear.
    if (dirty) {
      try { rebuild(); }
      catch (err) { if (!told) { told = true; console.warn('Animater | painted walls', err); } }
    }
    walls.step();
    // A door swings rather than snapping, so the leaves want the frame's own time.
    const step = Math.min(0.1, (globalThis.canvas?.app?.ticker?.deltaMS ?? 16) / 1000);
    doors.step(step);
    windows.step(step);
  };
  const catchUp = () => {
    const now = on();
    if (now !== were) { were = now; dirty = true; }
    if (now && wallsNow() !== from) dirty = true;
    // The sky a roof is painted under may not be known yet when the canvas is first ready: a calendar still loading
    // has no festival to give, so the first paint of a scene is an ordinary day whatever the date. This is where a
    // building finds out it is wrong and puts its garlands up.
    if (now) { try { followSun(); } catch { /* nothing painted yet */ } }
    if (!dirty) return;
    try { rebuild(); }
    catch (err) { if (!told) { told = true; console.warn('Animater | painted walls', err); } }
  };
  let soonTimer = null;
  const soon = () => { clearTimeout(soonTimer); soonTimer = setTimeout(() => { soonTimer = null; catchUp(); }, 120); };

  // ---------------------------------------------------------------------------------------------- roofs and sight

  /**
   * Whose eyes a roof answers to: the creature you have hold of, and nobody else. A GM owns every token on the map,
   * so ownership alone opened a house because an innkeeper was standing in it with nothing selected. Selected
   * first, then — for a player, who is not forever picking tokens up — their own creatures that can see.
   */
  const seeing = () => {
    const all = (globalThis.canvas?.tokens?.placeables ?? []).filter((t) => !t.document?.hidden);
    const held = all.filter((t) => t.controlled);
    if (held.length) return held;
    if (globalThis.game?.user?.isGM) return [];
    return all.filter((t) => t.isOwner && t.document?.sight?.enabled !== false);
  };
  // The layers a GM puts things down on. While one of those is up, every roof stands aside: there is no creature to
  // see the room from, and a room you cannot see is a room you cannot drop a light, a sound or a wall into
  // (Roi: "putting elements on the canvas like lights etc should fade the roof lol").
  const PLACING = new Set(['lighting', 'sounds', 'templates', 'tiles', 'walls', 'regions', 'notes', 'drawings']);
  const placing = () => {
    try {
      if (globalThis.game?.user?.isGM !== true) return false;
      const layer = globalThis.canvas?.activeLayer;
      return PLACING.has(layer?.options?.name ?? layer?.constructor?.layerOptions?.name ?? '');
    } catch { return false; }
  };
  const allRoofs = () => roofsOf(flags(), { grid: gridNow() }).map((r) => `${r.key}${roofSuffix()}`);
  // A roof fades while one of your own creatures is under it, and comes back when they leave.
  const covering = () => {
    if (placing()) return allRoofs();
    const mine = seeing();
    if (!mine.length) return [...hovered];
    return [...new Set([...hovered, ...roofsOf(flags(), { grid: gridNow() })
      .filter((r) => mine.some((t) => underRoof(r.room, t.center?.x ?? t.x, t.center?.y ?? t.y)))
      .map((r) => `${r.key}${roofSuffix()}`)])];
  };
  // A GM has no creature of their own to look from, so the pointer is their eye: the roof it rests on stands aside
  // and comes back when the pointer leaves (Roi: "when hovering over a roof i dont see the insides of the house").
  // On their own screen only, as every roof's fading is. Looked at when the pointer has moved, and the roofs are
  // only asked to change when it has crossed onto or off one.
  let hovered = [], hoverAt = '';
  const hoverNow = () => {
    if (globalThis.game?.user?.isGM !== true) return;
    const p = globalThis.canvas?.mousePosition;
    if (!p) return;
    const at = `${Math.round(p.x)},${Math.round(p.y)}`;
    if (at === hoverAt) return;
    hoverAt = at;
    const now = roofsOf(flags(), { grid: gridNow() }).filter((r) => underRoof(r.room, p.x, p.y)).map((r) => `${r.key}${roofSuffix()}`);
    if (now.join('|') !== hovered.join('|')) { hovered = now; coverSoon(); }
  };
  const sightFrom = (point) => {
    try {
      const Backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
      // Swept on the level being looked at, as every other sweep in the module is (openingRoom below does the same).
      // Asked without one, the walls of a scene that has real levels are not the walls it sweeps against, and what
      // comes back is a polygon nothing stopped — which, handed to roofOpenings, cuts the whole roof open from
      // wherever the creature happens to be standing.
      const level = globalThis.canvas?.level;
      const poly = Backend?.create(
        { x: point.x, y: point.y, elevation: Number(level?.elevation?.base) || 0 },
        { type: 'sight', ...(level ? { level } : {}) },
      );
      const pts = poly?.points;
      return Array.isArray(pts) ? pts : (pts?.length ? [...pts] : null);
    } catch { return null; }
  };
  // Instead of the lid coming off the whole house, each roof opens where your own creatures can actually see. The
  // cut reaches out past the walls, so a player indoors sees the stone the room is made of, and stops well short of
  // the eaves, so the roof keeps its own edge.
  const opening = () => {
    const open = new Map();
    // Nothing to cut while the GM is placing things: the whole roof is already standing aside.
    if (placing()) return open;
    const mine = seeing();
    if (!mine.length) return open;
    const grid = gridNow();
    const over = roofsOf(flags(), { grid });
    if (!over.length) return open;
    const inset = -grid * 0.22;
    const sights = [];
    for (const t of mine) { const s = sightFrom({ x: t.center?.x ?? t.x, y: t.center?.y ?? t.y }); if (s) sights.push(s); }
    if (!sights.length) return open;
    for (const roof of over) {
      const holes = roofOpenings(roof.room, sights, { inset });
      if (holes.length) open.set(`${roof.key}${roofSuffix()}`, holes);
    }
    return open;
  };

  // --------------------------------------------------------------------------------------------- lights and edges

  const eaveEdges = new Map();
  const eaveEdgesOut = () => {
    if (!eaveEdges.size) return;
    for (const id of eaveEdges.keys()) { try { globalThis.canvas?.edges?.delete(id); } catch { /* gone with the canvas */ } }
    eaveEdges.clear();
  };
  // While a building is lit, its eave is an edge that stops light and nothing else: sight, movement and sound all
  // pass through it. Laid as a wall, because a sweep only looks at the kinds of edge it has been told about and a
  // kind of our own was quietly skipped.
  const eaveEdgesNow = (grid) => {
    const Edge = globalThis.foundry?.canvas?.geometry?.edges?.Edge;
    const eaves = dressing?.eaves ?? [];
    if (!Edge || !globalThis.canvas?.edges || !eaves.length) { eaveEdgesOut(); return false; }
    const step = grid * EAVE_STEP, keep = new Set();
    let changed = false, n = 0;
    for (const { ring, middle } of eaves) {
      if (!Array.isArray(ring) || ring.length < 3) continue;
      const pull = (p) => { const dx = middle[0] - p[0], dy = middle[1] - p[1], l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * step, p[1] + (dy / l) * step]; };
      for (let i = 0; i < ring.length; i++) {
        const a = pull(ring[i]), b = pull(ring[(i + 1) % ring.length]);
        const id = `animater.eave.${n++}`;
        keep.add(id);
        const was = eaveEdges.get(id);
        // Asked of the canvas, not only of this note of it: an edge taken away elsewhere has to be laid again.
        if (was && globalThis.canvas.edges.has(id) && Math.abs(was[0] - a[0]) < 0.5 && Math.abs(was[1] - a[1]) < 0.5 && Math.abs(was[2] - b[0]) < 0.5 && Math.abs(was[3] - b[1]) < 0.5) continue;
        try {
          globalThis.canvas.edges.set(id, new Edge({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, { id, type: 'wall', light: LIGHT_BLOCKS, darkness: 0, move: 0, sight: 0, sound: 0 }));
          eaveEdges.set(id, [a[0], a[1], b[0], b[1]]);
          changed = true;
        } catch { /* a version with no edges of its own to lend */ }
      }
    }
    for (const id of [...eaveEdges.keys()]) {
      if (keep.has(id)) continue;
      try { globalThis.canvas.edges.delete(id); } catch { /* gone */ }
      eaveEdges.delete(id);
      changed = true;
    }
    return changed;
  };

  // Real light off the garlands: light sources of Foundry's own, made at run time and never written to the scene.
  const lights = new Map();
  const lightsOut = () => {
    if (!lights.size) return;
    for (const src of lights.values()) { try { src.destroy(); } catch { /* gone with the canvas */ } }
    lights.clear();
    eaveEdgesOut();
    try { globalThis.canvas?.perception?.update({ refreshLighting: true }); } catch { /* not drawn */ }
  };
  const lightsNow = () => {
    const Cls = globalThis.foundry?.canvas?.sources?.PointLightSource;
    const lamps = dressing?.lamps ?? [];
    if (!Cls || !globalThis.canvas?.ready || !lamps.length) { lightsOut(); return; }
    const want = lamps.slice(0, GARLAND_LIGHTS_MOST);
    const grid = gridNow(), reach = grid * GARLAND_REACH;
    // The roof line first: a light worked out before its eave was there would have swept past it.
    eaveEdgesNow(grid);
    const keep = new Set();
    for (const [i, lamp] of want.entries()) {
      const id = `animater.garland.${i}`;
      keep.add(id);
      let src = lights.get(id);
      if (!src) { src = new Cls({ sourceId: id }); lights.set(id, src); }
      try {
        src.initialize({
          x: lamp.x, y: lamp.y, elevation: 0, dim: reach, bright: reach * 0.3,
          color: lamp.colour, alpha: GARLAND_LIGHT * Math.max(0, Math.min(1, lamp.glow)),
          // It shines all round, as a lantern does, and the eave edge is what keeps it off the roof.
          angle: 360, rotation: 0,
          animation: { type: 'none' }, walls: true, vision: false, disabled: false,
        });
        // A source only lights anything once it is attached to the scene's own collection.
        src.add();
      } catch { lights.delete(id); try { src.destroy(); } catch { /* gone */ } }
    }
    for (const [id, src] of [...lights]) {
      if (keep.has(id)) continue;
      lights.delete(id);
      try { src.destroy(); } catch { /* gone with the canvas */ }
    }
    try { globalThis.canvas.perception.update({ refreshLighting: true }); } catch { /* not drawn */ }
  };
  // Lanterns swing, so their lights would too — but a light is a sweep of every wall near it, and sixty of those a
  // second is a scene that stops answering. They are put where the lanterns are a few times a second instead.
  let lightsAt = 0;
  const garlandLightsTick = () => {
    const now = performance.now();
    if (now - lightsAt < 400) return;
    lightsAt = now;
    try { lightsNow(); } catch (err) { console.warn('Animater | garland lights', err); }
  };

  // (A painted door keeps Foundry's own door control exactly as Foundry draws it. Animater used to fade it and
  // shrink it on painted doors so the leaf showed through, and bring it back under the pointer; Roi found it too
  // hard to see and asked for the plain control back.)

  let coverTimer = null;
  const coverSoon = () => {
    if (coverTimer) return;
    coverTimer = setTimeout(() => {
      coverTimer = null;
      try { roofs.cover(covering()); roofs.open(opening()); drain(); }
      catch (err) { if (!told) { told = true; console.warn('Animater | roofs', err); } }
    }, 60);
  };

  // ------------------------------------------------------------------------------------------------------- hooks

  const Hooks = globalThis.Hooks;
  Hooks.on('canvasReady', () => {
    dirty = true;
    try { globalThis.canvas.app.ticker.add(tick); } catch { /* the clock above does the work anyway */ }
    soon();
    // canvasReady can arrive before the walls are on the canvas, so it is asked again a moment later as well.
    for (const wait of [400, 1200, 2500]) setTimeout(catchUp, wait);
  });
  Hooks.on('canvasTearDown', () => {
    try { globalThis.canvas?.app?.ticker?.remove(tick); } catch { /* gone with the canvas */ }
    walls.drop(); doors.drop(); windows.drop(); roofs.drop(); dressing.drop();
    // The roofs' own layer is not the map's, so the canvas going does not take it: it is put away here.
    try { roofRoot?.destroy({ children: true }); } catch { /* gone with the canvas */ }
    roofRoot = null; roofLight = null; litWas = '';
    lightsOut();
    lights.clear(); eaveEdges.clear();
  });
  for (const hook of ['canvasReady', 'controlToken', 'updateToken', 'createToken', 'deleteToken', 'refreshToken']) Hooks.on(hook, () => { coverSoon(); });
  // And whenever the GM changes what they are working on, since that is what decides whether the roofs stand aside.
  for (const hook of ['activateCanvasLayer', 'renderSceneControls']) Hooks.on(hook, () => { coverSoon(); });
  for (const hook of ['createWall', 'updateWall', 'deleteWall']) Hooks.on(hook, (doc) => { if (doc?.parent?.id === scene()?.id) { dirty = true; soon(); } });
  Hooks.on('updateScene', (doc) => { if (doc?.id === scene()?.id) { dirty = true; soon(); } });

  return {
    walls, doors, windows, roofs, dressing,
    /** The scene's walls as the engines want them. The map painting bar wants this too. */
    wallList,
    /** Which way the light is coming from, and the key a picture painted under it is kept by. */
    sunLit, sunKey, roofSuffix,
    /** The feast day, if any: the calendar's, or the one the GM called by hand. */
    dressingNow,
    /** The air outside the buildings, and whether a stretch of wall has rooms on both sides. */
    outsideAir, insideWall,
    /** Say that something changed and the buildings want painting again. */
    touch: () => { dirty = true; },
    rebuild, soon, catchUp, drain, followSun,
    /** Whether painting is on at all, and what it has painted: for the module's debug readout. */
    get state() {
      return { on: on(), dirty, were, ticks, saw, walls: walls.state, doors: doors.state, windows: windows.state, roofs: roofs.state, chimneys: roofs.chimneys, dressing: dressing.state, garlandLights: lights.size };
    },
  };
}

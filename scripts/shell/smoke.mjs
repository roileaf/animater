// The smoke a fire fills a room with: the round the active GM runs to work it out, and the painted cloud every screen
// draws from what that round wrote.
//
// Both halves are here because they are two sides of one thing — the round writes the cells, the cloud shows exactly
// those cells, and the fence that blocks sight has to move at the same moment as the paint. The fire's own round ticker
// stayed in main.mjs: it runs the fire first and this second, so it belongs to neither.

import { ID } from "../core/model.mjs";
import { smokeCellsOf, smokeSourcesOf, smokeOpeningsOf, smokeWalls } from "../engines/props/smoke-field.mjs";
import { smokeGridOf, storedSmokeGrid, smokeCellList, smokeLevelOf } from "../engines/props/smoke-edges.mjs";
import { createSmokeLooks, smokePuffs, smokeSheets, smokeSeedOf, SMOKE_SORT_LAYER } from "../engines/props/smoke-look.mjs";
import { ROOM_AIR, airSourcesOf, airPrimeOf, airStepSeconds } from "../engines/props/smoke-air.mjs";
import { createSmokeAirLook } from "../engines/props/smoke-air-look.mjs";
import { CONCEALMENT_BEHAVIOUR, smokeRegionPlan, skyRegionsOf, openSideRegionsOf, regionsOnLevel } from "../engines/props/smoke-regions.mjs";
import { smokeRoundPlan, smokeRoomAt, smokeClearPlan, smokeRunsOn, smokeHeldBy, smokeLevelFor, createSmokeAlarm, smokeNote, SMOKE_VENT_FLAG } from "../engines/props/smoke-round.mjs";
import { smokeGathering } from "../engines/props/smoke-gather.mjs";
import { quietSave, isClockSave } from "../engines/props/quiet-writes.mjs";
import { withDeletes } from "../engines/props/prop-requests.mjs";
import { onLevel } from "../engines/props/prop-pick.mjs";
import { blockingWalls } from "../engines/props/prop-walls.mjs";
import { wallBetween } from "../engines/props/fire-rounds.mjs";
import { SMOKE_LIGHT_FLAG } from "../ui/prop-config.mjs";
import { indoorPolygonsOf } from "../engines/regions/image-plane.mjs";
import { sceneOpenings, createSmokeAir } from "../engines/motion/indoor-air.mjs";
import { isFireLight } from "../engines/distortion/fire-haze.mjs";
import { breathes } from "../engines/motion/idle-life.mjs";
import { viewedRegions } from '../core/viewed-regions.mjs';
import { undergroundOf } from '../core/underground.mjs';
import { decide } from '../core/player-recipes.mjs';

export function createSmoke(ctx) {
  const { runtime, propGrid, propDel, propSafe, regionAreas, pointInPolygon, wallView, fireNow, fireRound, fireRunning, floorLayer, airField, gustAt, windNow } = ctx;

  // ---- The smoke a fire fills its room with, round by round (engines/props/smoke-round.mjs). ----
  // The GM's switch is the scene's "Fires fill rooms with smoke" (flags.animater.smokeFills), off by default: it suits a
  // closed inn or a mine, not an open market. The round's whole decision is pure and lives in smoke-round.mjs; all that
  // is here is looking the scene up, saying what is indoors and where the walls are, and writing what comes back.
  // Every write is the active GM's; each screen draws its own view of what is written (the fence, registerSmokeFence,
  // the region's concealment, and the painted cloud below).
  // (The scene flag is smokeFills and a light's own is smokeSource. NEITHER is the settings pair "Smoke in the air"
  // (skyPair("roomSmoke", "roomSmokeLocal")), which is a different, older, purely visual haze: three things shared the
  // name roomSmoke before any of this shipped, and the two new ones were renamed so the next reader is not caught.)
  // The marker every write of this round's is stamped with comes from smokeNote(), imported above: it is declared beside
  // the smokeOnlySave that reads it, in smoke-round.mjs, and never copied here, so the stamp and its reader cannot
  // drift apart. (Drift them and the round mistakes its own write back for a GM's map edit and throws the room cache
  // away every single tick.) It is a MAKER, not the constant: Foundry writes to an options object it is given
  // (createEmbeddedDocuments sets options.parent), so handing it the frozen SMOKE_NOTE threw on every region write and
  // the concealment region never once appeared. Every document call below gets its own fresh note.
  // Which lights make smoke: a fire light (a torch, flame, fire, candle or flicker) the GM ticked "Fills the room with
  // smoke" on. Off by default, so a lit hearth or brazier does not fog the inn. Each keeps its levels, so a light on
  // the cellar floor records its smoke there and not on whatever floor the scene opens on.
  const smokeLightsOf = (scene) => (scene?.lights?.contents ?? [])
    .filter((d) => d.hidden !== true && d.flags?.[ID]?.[SMOKE_LIGHT_FLAG] === true && isFireLight(d.config ?? {}))
    .map((d) => ({ x: d.x, y: d.y, smokes: true, levels: [...(d.levels ?? [])] }));
  // Whether a token in the smoke is concealed: only through pf2e-visioner's own region behaviour, and only when that
  // behaviour type is really registered. Installed is not enough.
  const smokeConceals = () => {
    try { return game.modules?.get("pf2e-visioner")?.active === true && !!CONFIG.RegionBehavior?.dataModels?.[CONCEALMENT_BEHAVIOUR]; }
    catch { return false; }
  };
  // The rooms of each scene, as smoke-round.mjs's own walk works them out (smokeRoomAt): each cell's room, by name and
  // by cell count, so one doorway on a closet is a gale and the same doorway on a great hall is a draught, and each
  // room is stepped on its own — a burning closet never vents the hall beside it nor lends it its cell count.
  // Kept per scene between rounds and thrown away whenever the walls, the regions or the scene really change (the
  // round's own write back is not a change: smokeOnlySave), since a walk over a whole cave is far too much every tick.
  let smokeRooms = new Map();
  for (const hook of ["canvasReady", "createWall", "updateWall", "deleteWall", "createRegion", "updateRegion", "deleteRegion", "updateScene", "deleteScene"]) {
    Hooks.on(hook, (first, changes, options) => { if (!quietSave(first, changes, options)) smokeRooms = new Map(); });
  }
  // Everything the round works out about a scene's SHAPE — which cells are indoors, which pairs have a wall between
  // them, which lie under a hole in the roof — is smoke-gather.mjs's (smokeGathering), kept for as long as the room
  // walk is and thrown away with it. All that is here is the Foundry looking-up: the regions on the smoke's level,
  // the polygons of the ones that keep the weather out and of the ones open to the sky, and the walls that stop it.
  // Each is a thunk, so a scene with no smoke to decide about pays for none of them (smokeGathering asks at most
  // once per record), and so a test can drive the real gathering with fakes — which is the point: it lived here,
  // where no test could import it, and two of its keys collided unseen.
  const smokeShapeOf = (scene, geo, level, deep) => {
    // The regions that count for the smoke's level, worked out ONCE for both lists below: they are two thunks and
    // each is asked at most once per record, but both wanted the same filter, so both ran it.
    let here = null;
    const onLevel = () => (here ??= regionsOnLevel(scene.regions, level));
    return smokeGathering({
      cache: smokeRooms, sceneId: scene.id, geo, level, deep,
      polygons: () => (deep ? [] : indoorPolygonsOf(onLevel(), regionAreas)),
      // One malformed region is skipped, so it cannot stop a whole map's smoke; a broken helper is not caught here,
      // and reaches smokeThrew, which tells the GM once. (smoke-gather.mjs says the same in full.)
      shafts: () => skyRegionsOf(onLevel()).flatMap((r) => { try { return regionAreas(r) ?? []; } catch { return []; } }),
      // The roofs the GM marked as standing open at their sides, and the ONLY ones whose own outline lets smoke out.
      // A roof region is drawn by hand around a building whose walls are the real enclosure; where its outline runs
      // diagonally it steps across squares, and each step was read as a hole. Five of them vented a ship's hold at
      // 15% a round with every door and window shut — nothing the GM closed could touch it, because nothing they had
      // closed was what stood open. One malformed region is skipped, as for the shafts above.
      sides: () => openSideRegionsOf(onLevel()).flatMap((r) => { try { return regionAreas(r) ?? []; } catch { return []; } }),
      // smokeWalls, not blockingWalls: the walls that stop SMOKE. A window's state never reaches the wall document —
      // opening one reshapes the live edge's light, sight and sound but never its `move`, and a smashed one keeps
      // `move` on purpose, since a broken window still stops a body — so blockingWalls answers the same for a window
      // shut, swung open or smashed. Smoke crossed none of them, while an open one was still counted an opening, so
      // the smoke left the model instead of drifting into the next room.
      walls: () => smokeWalls((scene.walls?.contents ?? []).map(wallView)),
      // Both REQUIRED by smokeGathering, which throws without them rather than quietly answering "nothing": this
      // one line going missing left the whole feature dead with 850 tests passing.
      inside: pointInPolygon, crosses: wallBetween,
    });
  };
  // One round of smoke on one scene, run by the active GM on the fire's own tick, straight after fireRound, with what
  // fireRound found alight. Switched off, or with nothing stored, nothing burning and no light set to smoke, it costs
  // a flag read and a pass over the scene's lights — and nothing of the scene's shape is looked at at all.
  async function smokeRound(scene, burning = []) {
    if (!scene) return;
    // All three switches, not only "Fires fill rooms with smoke": the round rides the fire's tick, so Breakable props
    // and Fire spreads are the smoke's switches too (smoke-round.mjs smokeRunsOn). Any of them off and the round's
    // whole job is to clear what is stored.
    const activeGM = game.users?.activeGM?.isSelf === true, on = smokeRunsOn(scene);
    const geo = activeGM && on ? smokeGridOf(scene.dimensions) : null;
    // Nothing stored, nothing alight and no light set to smoke: there is nothing for the round to decide, and the
    // plan's own early return would throw away everything gathered below. That gathering is the expensive half —
    // the indoor polygons, a blocking-wall list over every wall, the sky polygons, the openings over every wall
    // again — and it was paid every tick on every switched-on scene with no fire on it, which is most of them.
    const lights = geo ? smokeLightsOf(scene) : [];
    const idle = !burning.length && !lights.length && !smokeHeldBy(scene);
    let plan;
    if (!geo || idle) plan = smokeRoundPlan({ activeGM, on, scene });
    else {
      const { cols, rows, cell, origin } = geo;
      const sources = smokeSourcesOf({ fires: burning, lights, grid: propGrid(scene), cell, origin, cols });
      // The round runs on EVERY scene with a fire on it, so almost always on a scene the canvas has not drawn. Its
      // regions are therefore picked by what they are — their own flags, and the level they name (smoke-regions.mjs
      // regionsOnLevel) — and never by `viewed`, which needs the scene's own view and answers false for every region
      // of every scene but the canvas's. Off-canvas that filter returned nothing: no cell was ever indoors, so the
      // smoke never formed, and our own region was never found, so a new one was made every round it burned.
      // (viewedRegions stays where something really is drawn on the viewed level.)
      const level = smokeLevelFor(scene, sources);
      // Indoors is a cell whose middle lies in a region that keeps the weather out, or every cell of an underground
      // scene; a hole in the roof is a cell under a region the GM marked "Open to the sky" (a shaft, a broken roof),
      // which vents upward whatever its walls do and is the one opening an inside room can have with no outdoor cell
      // near it. All three are smoke-gather.mjs's, asked once per cell (per PAIR, for the walls) and kept.
      const deep = undergroundOf(scene.flags?.[ID], null);
      const work = smokeShapeOf(scene, geo, level, deep);
      const { indoors, walled, sky, openSide, nearWall } = work;
      // Where the room breathes out through its own walls (smoke-field.mjs smokeOpeningsOf): an open door, a window
      // standing open, a smashed one, a hole battered through — each counted only where it leads OUT, which is why it
      // is handed the very same `indoors`. An inside door joins two rooms into one for the walk and carries the smoke
      // next door by itself; vented as well, the smoke would leave the model and an inn would never fill.
      // indoor-air's own sceneOpenings is a different list for a different job (the drafts' way out, doors near the
      // scene's edge only, never a window) and is deliberately not used here.
      const openings = smokeOpeningsOf({ walls: scene.walls?.contents ?? [], cell, origin, cols, rows, indoors });
      plan = smokeRoundPlan({ activeGM, on, scene, sources, indoors, walled, openings, sky, openSide, nearWall,
        roomOf: (i) => smokeRoomAt({ from: i, cols, rows, indoors, walled, cache: work.rooms }) });
    }
    if (!plan) return;
    if (Object.keys(plan.fields).length) {
      // Told, not merely traced. This write failing is the user's whole symptom: no cells means no stored flag,
      // so no sight-blocking fence and no drawn cloud — "I see no smoke in a closed room" — and it was swallowed
      // into a trace line while the region write beside it threw loudly. Both were the same frozen-options bug.
      // The alarm is the one the round already uses, so the two of them cannot between them spam a GM: whichever
      // speaks first speaks, once for that scene, and every failure after it is traced as before.
      await scene.update(withDeletes(plan.fields, propDel()), smokeNote())
        .catch((e) => smokeThrew(scene, "smoke not written", e));
    }
    await smokeRegionNow(scene, plan.shapes, plan.level);
  }
  // The region the smoke conceals in: one region per scene, flagged as ours, grown or shrunk to the smoke and taken
  // away with it. pf2e-visioner owns concealment; without its behaviour the region carries none and nothing is
  // concealed.
  // The whole decision is smoke-regions.mjs's (smokeRegionPlan): one region of ours per scene and level, found by its own
  // flag so it is found on any scene, grown or shrunk to the smoke, remade only when the concealment itself comes or goes,
  // and taken away with the last of the smoke. An unchanged round writes nothing.
  // The plan's own `steps` carry the ORDER, so there is nothing here to put in the wrong one: a removal lands before the
  // creation that replaces it. Nothing is caught: a removal that the database refuses MUST stop the creation behind it,
  // or the scene is left carrying two concealment regions and only one of them comes off per later round. The throw goes
  // up to whoever asked — for the round, its own catch in fireRoundsNow, which traces it and tries again next round.
  async function smokeRegionNow(scene, shapes, level) {
    const plan = smokeRegionPlan(scene.regions, shapes, { level, visioner: smokeConceals() });
    for (const step of plan.steps) {
      if (step.kind === "remove") await scene.deleteEmbeddedDocuments("Region", step.ids, smokeNote());
      else if (step.kind === "create") await scene.createEmbeddedDocuments("Region", step.data, smokeNote());
      else await scene.updateEmbeddedDocuments("Region", step.data, smokeNote());
    }
  }
  // A fire round still writing would put back whatever is cleared or thinned while it is in flight. One wait, used by
  // everything that clears behind the round's back (Repair, a quench): never a second mechanism.
  const afterFireRound = async (scene) => {
    for (let i = 0; i < 100 && fireRunning.has(scene.id); i++) await new Promise((done) => { setTimeout(done, 50)?.unref?.(); });
  };
  // Everything the smoke has left on a scene, taken off it at once (smoke-round.mjs smokeClearPlan): the cells by name,
  // the geometry stored beside them by name, the concealment region, and — the flag being gone — every client's
  // sight-blocking fence with them (smoke-fence.mjs rebuilds from the stored flag on this very update). Repair asks for
  // this, so a room that was smoked out is clear the moment the props are put back.
  // Only the active GM writes, as every other smoke write does. Another GM pressing Repair leaves the room to empty
  // itself over the next rounds instead, which it does: with nothing burning the fade clears it on its own.
  async function clearSmokeNow(scene) {
    if (!scene || game.users?.activeGM?.isSelf !== true) return;
    // A round in flight would write its pre-clear cells and region back after this: let it finish first, then hold
    // the scene itself, so none can start while this writes. (Still running after the wait: leave it be and say so;
    // taking the lock then would free it under the round's feet.)
    await afterFireRound(scene);
    if (fireRunning.has(scene.id)) { runtime?.trace("props", "smoke not cleared: a round is still writing"); return; }
    fireRunning.add(scene.id);
    try {
      const plan = smokeClearPlan(scene);
      if (Object.keys(plan.fields).length) {
        await scene.update(withDeletes(plan.fields, propDel()), smokeNote())
          .catch((e) => smokeThrew(scene, "smoke not cleared", e));
      }
      await smokeRegionNow(scene, [], null).catch((e) => smokeThrew(scene, "smoke region not cleared", e));
    } finally { fireRunning.delete(scene.id); }
  }
  // A round of smoke that threw: traced as everything here is, and ALSO said once to the GM, per scene, per session
  // (smoke-round.mjs createSmokeAlarm, which holds the counting and is tested there). All that is here is this
  // client's three ways of speaking.
  const smokeThrew = createSmokeAlarm({
    trace: (message) => runtime?.trace("props", message),
    warn: (message, error) => console.warn(message, error),
    notify: (message) => ui?.notifications?.warn(message),
  });

  // ---- What the room smoke looks like on the viewed map, for everyone (engines/props/smoke-look.mjs). ----
  // Painted stepped grey puffs standing in the very cells the active GM wrote, drifting from one round to the next
  // instead of jumping. Nothing here writes anything: it reads the scene's own stored cells, and it reads them against
  // the geometry they were WRITTEN with (storedSmokeGrid), exactly as the sight-blocking fence does, so a resize or a
  // grid change can never slide the cloud out from under the cells.
  // The cloud drifts; the fence does NOT. A sight-blocker that moved mid-round would pop the fog and rebuild every
  // client's vision every frame, so the edges stay on the round boundary (smoke-fence.mjs, untouched).
  // Its depth is SMOKE_SORT_LAYER, which smoke-look.mjs declares and gives its reasons for; there is no number here.
  // The scene's own wind as the plume outside wants it: a vector in squares, 0 when the air is still. The cloud
  // INSIDE a room is not blown by this — a room's air is the draft, not the weather — and the plume is the only
  // part of the smoke that is out in it.
  const smokePlumeWind = () => {
    try {
      const { speed: blowing, angle: from } = windNow();
    const speed = Math.max(0, Math.min(1, Number(blowing) || 0));
      if (!(speed > 0)) return null;
      const angle = Number(from) || 0;
      return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    } catch { return null; }
  };
  const smokeLooksRoot = floorLayer("smokeLooks", SMOKE_SORT_LAYER);
  const smokeLooks = createSmokeLooks({ PIXI: globalThis.PIXI, layer: smokeLooksRoot,
    grid: () => canvas?.grid?.size ?? 100, now: () => fireNow(), wind: smokePlumeWind });
  let smokeLooksTimer = 0;
  // The same cells drifting on the indoor air instead (engines/props/smoke-air.mjs, smoke-air-look.mjs): the round's cells
  // are the air's sources and what already hangs there, the draft carries them along and out through whatever doors stand
  // open, and one pass over the scene draws what the air holds. It draws into the bake's own layer at the bake's own depth,
  // and only ever one cloud is drawn: with no field (Drafts off, no WebGL, a scene the air is not worked out for) the
  // baked cloud paints exactly as it always has. The plume outside is NOT the cloud and is left to the bake either way.
  const smokeAirLook = createSmokeAirLook({ PIXI: globalThis.PIXI, layer: smokeLooksRoot });
  // How long the billows' clock runs before it starts again (ms). The pass rolls by the SHARED clock, so two players
  // watching one cellar see the same billows at the same point in their roll — the cloud must never disagree between two
  // screens. The shared clock counts milliseconds from the epoch, though, and that many seconds is a number a shader's
  // float cannot hold to nearer than a couple of minutes, so it is taken modulo four hours: still a shared reading, and
  // small enough to keep its fractions. The phase jumps once at each wrap, four hours apart, which is a far smaller fault
  // than every screen rolling on a clock of its own. Do NOT "simplify" this to fireNow() / 1000.
  const BILLOW_WRAP_MS = 4 * 60 * 60 * 1000;
  // The sim; the door that last swung (pushed through on the next fill); the clock reading it was last stepped at (ms);
  // and the step not yet taken.
  let roomAir = null, roomAirDoor = null, roomAirAt = 0, roomAirWait = 0;
  const dropRoomAir = () => { roomAir = null; roomAirDoor = null; roomAirWait = 0; smokeAirLook.clear(); };
  // Both ways of drawing it put away: a level that is not the smoke's, or a scene with no smoke, leaves the map clean.
  const clearSmokeDrawing = () => { smokeLooks.clear(); dropRoomAir(); };
  // The round's cells handed to the air: each one a source at its own weight, and the same cells as the smoke already
  // hanging there, so a screen arriving mid-fire finds the cellar full rather than filling from nothing. They are read
  // against the grid they were WRITTEN with, as everything else here reads them. What the air already holds is kept: the
  // round's write every few seconds never starts the cloud again.
  const fillRoomAir = (cells, geo) => {
    try {
      if (!airField) { dropRoomAir(); return; }
      roomAir ??= createSmokeAir(ROOM_AIR);
      roomAir.setup(airField, airSourcesOf(cells, geo, airField));
      roomAir.prime(airPrimeOf(cells, geo));
      // The door that just swung pushes what hangs by it through the doorway.
      if (roomAirDoor) { roomAir.push(roomAirDoor); roomAirDoor = null; }
      roomAirAt = fireNow();
      // A round that wrote no cells into an air that holds nothing leaves the pass nothing to draw and no picture to keep.
      smokeAirLook.fill(roomAir.busy ? roomAir.pixels : null, airField.cols, airField.rows);
    } catch { dropRoomAir(); }
  };
  // Moved on a few times a second and drawn every frame. The air is stepped by the shared clock (fireNow, in milliseconds,
  // which is what airStepSeconds takes and gives seconds for), by the whole of what has gathered since the last step —
  // but airStepSeconds never reads more than six seconds at a time, so a screen that was asleep catches up by six seconds
  // in one go and whatever it missed beyond that is LOST: come back after a minute away and the cloud has moved on
  // without you. That is the trade and it is deliberate. Replaying ten minutes of air into one frame would lock the tab
  // up, and the round re-primes the cells every few seconds anyway, so a screen that has fallen behind is put back on
  // terms with the others at the next write rather than by grinding through the while. The pass is handed seconds.
  const tickRoomAir = () => {
    if (!roomAir || !airField) return;
    const now = fireNow();
    roomAirWait += airStepSeconds(roomAirAt, now); roomAirAt = now;
    // Nothing being made and nothing left hanging: the pass is given no smoke, which takes its mesh off screen, and
    // neither it nor the sim is worked on again until the round writes another cell — the baked cloud's own loop stops
    // itself the same way. The sim is KEPT, not dropped: when the round clears the last cell what is already in the air
    // has to thin away over the next seconds, and dropping it here would take the cloud off the map in one frame.
    if (!roomAir.busy) { roomAirWait = 0; smokeAirLook.fill(null); return; }
    // Always in steps of exactly 0.25 s, the remainder kept for the next tick. Stepping by whatever had gathered (0.26 s here,
    // 0.31 s there) makes two clients integrate the same diffusion with different quanta, and their fields drift apart where
    // prime() never re-anchors them. Do NOT "simplify" this to stepping the accumulated wait.
    let stepped = false;
    while (roomAirWait >= 0.25) { roomAir.step(0.25); roomAirWait -= 0.25; stepped = true; }
    if (stepped) smokeAirLook.fill(roomAir.pixels, airField.cols, airField.rows);
    smokeAirLook.look({ now: (now % BILLOW_WRAP_MS) / 1000, grid: canvas.grid?.size ?? 100, bounds: canvas.dimensions?.sceneRect ?? null, amount: 1,
      // The one per-client wall clock the pass reads: a DELTA since a hook every client receives within network latency, so it
      // cannot drift apart between screens the way an absolute clock would.
      since: Math.min(1e3, (performance.now() - gustAt) / 1000) });
  };
  function syncSmokeLooksNow() {
    if (!canvas?.ready) return;
    const scene = canvas.scene;
    // The same three switches the round itself asks (smokeRunsOn): with any of them off there is no smoke to paint,
    // and whatever is still stored is on its way off the scene this very round.
    if (!scene || !smokeRunsOn(scene)) { clearSmokeDrawing(); return; }
    // The smoke is recorded on one level; a screen looking at another floor sees none of it.
    const level = smokeLevelOf(scene);
    if (level && canvas?.level?.id && canvas.level.id !== level) { clearSmokeDrawing(); return; }
    const cells = smokeCellsOf(scene);
    const grid = storedSmokeGrid(scene, cells) ?? smokeGridOf(scene.dimensions);
    if (!grid) { clearSmokeDrawing(); return; }
    // Seeded from the scene's own id, so every screen looking at this map paints the same cloud and the map next door
    // wears a different brush. No clock and no dice: the drift and the sway are the shared clock's alone.
    // The bodies are the cloud (one wash over all of it, one dark mass over what blocks sight); the puffs are the brush
    // shading over them.
    const list = smokeCellList(cells), geo = { cols: grid.cols, origin: grid.origin, cell: grid.cell, seed: smokeSeedOf(scene.id) };
    // One cloud per scene, never two layered: where the air is worked out the pass draws these very cells drifting on it
    // and the baked cloud stands down; with no field the bake paints them, exactly as it always has.
    // The plume is NOT the cloud. The smoke leaving a room through a doorway is drawn outside the cloud by
    // smoke-plume.mjs, it has nothing to do with the air indoors, and it pours whichever of the two draws the room's
    // own smoke — so the bake is still told to paint it, with no cloud of its own to paint.
    const onAir = !!airField;
    if (onAir) fillRoomAir(cells, geo); else dropRoomAir();
    // The plume outside each opening. The vents are read from the scene, not worked out here: which cells are
    // openings depends on the regions and the walls and is the active GM's answer alone (smoke-round.mjs), so the
    // round writes them beside the cells and every client simply pours from what it finds. Indexed against the same
    // stored geometry as the cells, since that is the grid the vent indices were written on.
    const vents = scene.flags?.[ID]?.[SMOKE_VENT_FLAG];
    smokeLooks.sync({ sheets: onAir ? null : smokeSheets(list, geo), puffs: onAir ? [] : smokePuffs(list, geo),
      plume: Array.isArray(vents) && vents.length ? { list: vents, ...geo } : null });
  }
  const syncSmokeLooks = () => { clearTimeout(smokeLooksTimer); smokeLooksTimer = setTimeout(() => propSafe("smoke looks", syncSmokeLooksNow), 60); };
  // The round's own write back is the new smoke, so unlike the fire's looks this is NOT filtered by quietSave: skipping
  // it would leave the cloud a round behind for ever. Only a clock save, which changes nothing of ours, is passed over.
  // initializeEdges is in the list because that is the hook the sight-blocking fence is rebuilt on, and it is what a
  // level switch fires: the paint and the blockers are asked the same question at the same moment, so the cloud is
  // never left showing another floor's smoke while the fence has already moved on.
  for (const hook of ["canvasReady", "initializeEdges", "updateScene"]) Hooks.on(hook, (first) => { if (!isClockSave(first)) syncSmokeLooks(); });
  Hooks.on("canvasTearDown", () => { clearTimeout(smokeLooksTimer); smokeLooksTimer = 0; smokeLooks.clear(); dropRoomAir(); roomAirAt = 0; });
  return { smokeRooms, smokeShapeOf, smokeRound, smokeRegionNow, afterFireRound, clearSmokeNow, smokeThrew, smokeAirLook, roomAir: () => roomAir, roomAirDoor: (door) => { roomAirDoor = door; }, dropRoomAir, tickRoomAir, syncSmokeLooks };
}

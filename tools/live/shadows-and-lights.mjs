// Live check, run inside a Foundry world as a GM (never shipped): 2.3.1's lights and the shadow work after it — the
// prototype token's Animater fields, which carried light is drawn (lantern, torch, Light orb), and creatures' shadows
// (in their own shape, away from a light above them, none from a light below, the scene's sun, standing creatures).
//
//   const live = await import('/modules/animater/tools/live/shadows-and-lights.mjs');
//   const report = await live.run();            // { keep: true } leaves the scratch scene to look at
//
// It makes a scene named "Animater shadow check (temporary)", views it on this screen only, places unlinked tokens of
// one of the world's NPCs, and deletes the scene at the end. "Shadows under every token" is switched on for the
// standing-creature check and put back as it was.

const SCENE_NAME = 'Animater shadow check (temporary)';
const GRID = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(test, ms = 4000, step = 100) {
  const end = performance.now() + ms;
  for (;;) {
    let value;
    try { value = await test(); } catch { value = null; }
    if (value) return value;
    if (performance.now() > end) return value;
    await sleep(step);
  }
}

export async function run({ keep = false, actor: actorRef } = {}) {
  if (!game.user.isGM) throw Error('Run the live check as a GM.');
  const debug = game.modules.get('animater')?.api?.debug;
  if (!debug?.shapedShadows) throw Error('This Animater has no shadow probes (api.debug.shapedShadows): reload after updating.');
  const results = [];
  const record = (check, ok, detail = '') => { results.push({ check, result: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); };
  const base = (actorRef && (game.actors.get(actorRef) ?? game.actors.getName(actorRef)))
    ?? game.actors.find((a) => a.type === 'npc' && /\.(webp|png)$/i.test(a.prototypeToken?.texture?.src ?? ''));
  if (!base) throw Error('No NPC actor in this world to place.');

  // 1. The prototype token's configuration carries Animater's fields.
  try {
    const Sheet = foundry.applications.sheets.PrototypeTokenConfig;
    const app = new Sheet({ prototype: base.prototypeToken });
    await app.render({ force: true });
    await until(() => app.element?.querySelector?.('[name="flags.animater.torchHand"]'), 4000);
    const el = app.element, has = (sel) => !!el?.querySelector(sel);
    const fields = { torchHand: has('[name="flags.animater.torchHand"]'), lightAs: has('[name="flags.animater.lightAs"]'), breathFrom: has('[name="flags.animater.breathFrom"]'),
      bloodColor: has('[name="flags.animater.bloodColor"]'), voice: has('[name="flags.animater.voice"]'), movementSounds: has('.animater-movement-sounds') };
    record('Prototype token config has Animater fields', Object.values(fields).every(Boolean), fields);
    await app.close();
  } catch (error) { record('Prototype token config has Animater fields', false, error.message); }

  const previous = canvas.scene?.name === SCENE_NAME ? game.scenes.active : canvas.scene;
  const groundBefore = game.settings.get('animater', 'groundShadows');
  for (const old of game.scenes.filter((s) => s.name === SCENE_NAME)) await old.delete();
  const scene = await Scene.create({
    name: SCENE_NAME, width: 20 * GRID, height: 12 * GRID, padding: 0, grid: { size: GRID },
    environment: { darknessLevel: 0.85, globalLight: { enabled: false } }, tokenVision: false,
    flags: { animater: { sun: { mode: 'none' } } },
  });
  try {
    await scene.view();
    await until(() => canvas.ready && canvas.scene?.id === scene.id, 10000);
    await sleep(500);
    const token = async (name, col, row, extra = {}) => {
      const data = (await base.getTokenDocument({ name, actorLink: false, x: col * GRID, y: row * GRID, delta: { name }, ...extra })).toObject();
      const [doc] = await scene.createEmbeddedDocuments('Token', [data]);
      await until(() => canvas.tokens.get(doc.id)?.mesh, 5000);
      return doc;
    };
    const centre = (doc) => canvas.tokens.get(doc.id).center;

    // 2. Which carried light is drawn: the lit one of a torch and a lantern; a Light spell over both.
    const pack = game.packs.get('pf2e.equipment-srd');
    const find = async (name) => { const idx = await pack?.getIndex(); const e = idx?.find((i) => i.name === name); return e ? (await pack.getDocument(e._id)).toObject() : null; };
    const torchItem = await find('Torch'), lanternItem = await find('Lantern (Hooded)');
    if (!torchItem || !lanternItem) record('Lantern or torch: the lit one', null, 'no PF2e Torch / Hooded Lantern in pf2e.equipment-srd');
    else {
      const holder = await token('Live Holder', 2, 2, { light: { dim: 60, bright: 30, animation: { type: 'torch' } } });
      for (const i of [torchItem, lanternItem]) { delete i._id; foundry.utils.setProperty(i, 'system.equipped', { carryType: 'held', handsHeld: 1, invested: null }); }
      await holder.actor.createEmbeddedDocuments('Item', [torchItem, lanternItem]);
      const lantern = await until(() => debug.heldLanterns() === 1 && debug.heldTorches() === 0, 4000);
      record('Lantern or torch: lantern light shows the lantern', !!lantern, { lanterns: debug.heldLanterns(), torches: debug.heldTorches() });
      await holder.update({ light: { dim: 40, bright: 20, animation: { type: 'flame' } } });
      const torch = await until(() => debug.heldTorches() === 1 && debug.heldLanterns() === 0, 4000);
      record('Lantern or torch: torch light shows the torch', !!torch, { lanterns: debug.heldLanterns(), torches: debug.heldTorches() });
      await holder.actor.createEmbeddedDocuments('Item', [{ name: 'Spell Effect: Light', type: 'effect', img: 'icons/svg/light.svg' }]);
      await holder.update({ light: { dim: 40, bright: 20, animation: { type: 'pulse' } } });
      const orb = await until(() => debug.lightOrbs() >= 1 && debug.heldLanterns() === 0 && debug.heldTorches() === 0, 4000);
      record('Light spell over a held lantern shows the orb', !!orb, { orbs: debug.lightOrbs(), lanterns: debug.heldLanterns(), torches: debug.heldTorches() });
      await holder.delete();
    }

    // 3. A flier's shadow in its own shape, away from a light above it.
    const flier = await token('Live Flier', 8, 5, { elevation: 20 });
    await flier.update({ movementAction: 'fly' });
    const c = centre(flier);
    const [lamp] = await scene.createEmbeddedDocuments('AmbientLight', [{ x: c.x + 250, y: c.y, elevation: 60, config: { dim: 60, bright: 30 } }]);
    const shaped = await until(() => { const s = debug.shapedShadows().filter((x) => x.visible); return s.length && s[0].x < c.x - 20 ? s : null; }, 5000);
    record('Flier shadow: own shape, away from a light above', !!shaped, shaped ?? debug.shapedShadows());

    // 4. A light below the flier throws no floor shadow (the scene has no sun).
    await lamp.update({ elevation: 0 });
    const gone = await until(() => debug.shapedShadows().every((x) => !x.visible || x.alpha < 0.05), 5000);
    record('Flier shadow: none from a light below it', !!gone, debug.shapedShadows());
    await lamp.delete();

    // 5. The scene's fixed sun: a low evening sun in the east throws it long to the west.
    await scene.update({ 'environment.darknessLevel': 0, 'flags.animater.sun': { mode: 'fixed', from: 'e', height: 'low', strength: 1 } });
    const sunny = await until(() => { const s = debug.shapedShadows().filter((x) => x.visible && x.alpha > 0.1); return s.length && s[0].x < c.x - 100 ? s : null; }, 6000);
    record('Scene sun: low eastern sun throws it long to the west', !!sunny, { sun: debug.sun(), shadows: debug.shapedShadows() });
    await scene.update({ 'flags.animater.sun.mode': 'none' });
    const noSun = await until(() => debug.sun() === null, 3000);
    record('Scene sun: "No sun" clears it', !!noSun, debug.sun());

    // 6. The sun from the clock (read only: the world's time is not changed).
    await scene.update({ 'flags.animater.sun.mode': 'time' });
    await sleep(300);
    const { hour, minute } = game.time.components, sun = debug.sun();
    const daytime = hour >= 6 && hour < 18;
    record('Scene sun follows the clock', daytime ? !!sun : sun === null, { time: `${hour}:${String(minute).padStart(2, '0')}`, sun, calendar: game.modules.get('calendaria')?.active ? 'Calendaria' : game.modules.get('foundryvtt-simple-calendar-reborn')?.active ? 'Simple Calendar Reborn' : 'Foundry clock' });

    // 7. A standing creature's shadow in its own shape, from its feet away from the sun.
    await flier.delete();
    await scene.update({ 'flags.animater.sun': { mode: 'fixed', from: 'w', height: 'mid', strength: 1 } });
    await game.settings.set('animater', 'groundShadows', true);
    const walker = await token('Live Walker', 8, 5);
    const w = centre(walker);
    const ground = await until(() => { const s = debug.shapedShadows().filter((x) => x.visible); return s.length && s[0].x > w.x ? s : null; }, 6000);
    record('Standing creature: own-shape shadow away from the sun', !!ground, ground ?? debug.shapedShadows());
  } catch (error) {
    record('Live check ran to the end', false, error.stack ?? error.message);
  } finally {
    try { await game.settings.set('animater', 'groundShadows', groundBefore); } catch { /* left as is */ }
    if (!keep) {
      try { await previous?.view(); } catch { /* stay */ }
      try { await scene.delete(); } catch { /* left */ }
    }
  }
  console.table(results);
  return results;
}

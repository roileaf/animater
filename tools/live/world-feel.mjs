// Live check, run inside a Foundry world as a GM (never shipped): the world-feel features of 2.2.33 on a scratch
// scene — condition values, region looks, spell marks as floors, heat and cold around creatures, fliers' dust and
// cast shadows, creatures lit by their surroundings, and heat haze and smoke over fires. In the browser console (F12):
//
//   const live = await import('/modules/animater/tools/live/world-feel.mjs');
//   const report = await live.run();            // { keep: true } leaves the scratch scene to look at
//
// It makes a scene named "Animater live check (temporary)", views it on this screen only (players stay where they
// are), places unlinked tokens of one of the world's NPCs on it, and deletes the scene at the end. Nothing else in
// the world changes: tokens, regions and lights all live on the scratch scene. Each check reports PASS, FAIL or SKIP
// (with why), and console.table prints them.

const SCENE_NAME = 'Animater live check (temporary)';
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
const at = (col, row) => ({ x: col * GRID, y: row * GRID });

export async function run({ keep = false, actor: actorRef } = {}) {
  if (!game.user.isGM) throw Error('Run the live check as a GM.');
  const api = game.modules.get('animater')?.api, debug = api?.debug;
  if (!debug?.tokenLooks) throw Error('This Animater has no live-check probes (api.debug.tokenLooks): reload after updating.');
  const results = [];
  const record = (check, ok, detail = '') => { results.push({ check, result: ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL', detail: String(detail) }); };
  const looks = (tok) => debug.tokenLooks(canvas.tokens.get(tok.id)) ?? [];
  const has = (tok, re) => looks(tok).some((k) => re.test(k));

  const base = (actorRef && (game.actors.get(actorRef) ?? game.actors.getName(actorRef)))
    ?? game.actors.find((a) => a.type === 'npc' && !(a.system?.traits?.value ?? []).some((t) => ['fire', 'cold', 'water', 'earth', 'air'].includes(t)));
  if (!base) throw Error('No NPC actor in this world to place.');
  // Where to come back to: the scene this screen viewed, unless it was a leftover scratch scene (then the active one).
  const previous = canvas.scene?.name === SCENE_NAME ? game.scenes.active : canvas.scene;
  for (const old of game.scenes.filter((s) => s.name === SCENE_NAME)) await old.delete();
  const scene = await Scene.create({
    name: SCENE_NAME, width: 16 * GRID, height: 12 * GRID, padding: 0, grid: { size: GRID },
    environment: { darknessLevel: 0.85, globalLight: { enabled: false } }, tokenVision: false,
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
    const move = async (doc, col, row, more = {}) => { await doc.update({ x: col * GRID, y: row * GRID, ...more }, { animate: false }); await sleep(400); };

    // 1. Condition values: Frightened 1, then 2, then 3 picks its own look.
    const walker = await token('Live Walker', 2, 2);
    const actor = canvas.tokens.get(walker.id).actor;
    if (typeof actor?.increaseCondition !== 'function') record('Condition values', null, 'not PF2e');
    else {
      const seen = [];
      for (let v = 1; v <= 3; v++) {
        await actor.increaseCondition('frightened');
        await until(() => looks(walker).some((k) => /Trembling/.test(k)), 4000);
        await sleep(1200);
        seen.push(looks(walker).filter((k) => /Trembling/.test(k)).join('+') || 'none');
      }
      const ok = /Trembling 3/.test(seen[2]) && /Trembling 2/.test(seen[1]);
      record('Condition values (Frightened 1→3)', seen.every((s) => s === 'none') ? null : ok,
        seen.every((s) => s === 'none') ? 'no Tokenshade condition look shows at all (lasting looks set to JB2A here?)' : seen.join(' → '));
      await actor.decreaseCondition('frightened', { forceRemove: true }).catch(() => {});
    }

    // 2. Region looks: in → look; out → gone.
    const [region] = await scene.createEmbeddedDocuments('Region', [{
      name: 'Live haunted ground', color: '#7799ff',
      shapes: [{ type: 'rectangle', x: 6 * GRID, y: 1 * GRID, width: 3 * GRID, height: 3 * GRID }],
      flags: { animater: { tokenshade: 'Haunted ground' } },
    }]);
    await move(walker, 7, 2);
    const inside = await until(() => has(walker, /^region:/), 3000);
    const shown = looks(walker).filter((k) => /^region/.test(k)).join(', ') || 'none';
    await move(walker, 11, 2);
    const left = await until(() => !has(walker, /^region:/), 3000);
    record('Region look in and out', !!inside && !!left, `inside: ${shown}; after leaving: ${left ? 'gone' : looks(walker)}`);
    await region.delete();

    // 3. Spell marks as floors: frost is ice, acid mud, fire on grass bare earth.
    const spot = { x: 3.5 * GRID, y: 8.5 * GRID }, floorBefore = debug.floorAt(spot);
    const frost = debug.landMark(spot, 'cold', GRID);
    const iced = await until(() => debug.floorAt(spot) === 'ice' && 'ice', 4000);
    record('Frost mark is ice underfoot', frost ? iced === 'ice' : false, `before ${floorBefore}, after ${debug.floorAt(spot)}${frost ? '' : ' (no mark landed)'}`);
    const spot2 = { x: 6.5 * GRID, y: 8.5 * GRID };
    debug.landMark(spot2, 'acid', GRID);
    const mud = await until(() => debug.floorAt(spot2) === 'mud' && 'mud', 4000);
    record('Acid mark is mud underfoot', mud === 'mud', `after ${debug.floorAt(spot2)}`);
    api.clearGroundMarks?.({ everyone: false });

    // 4. Heat and cold around creatures (from the name: the base NPC has neither trait).
    const hot = await token('Fire Elemental', 12, 6), cold = await token('Frost Giant', 14, 6);
    const shimmer = await until(() => has(hot, /^nature:.*Heat shimmer/), 3000), mist = await until(() => has(cold, /^nature:.*Cold mist/), 3000);
    record('Fire creature shimmers', !!shimmer, looks(hot).join(', ') || 'no looks');
    record('Cold creature mists', !!mist, looks(cold).join(', ') || 'no looks');

    // 5. Fliers: dust as they take off and land; their cast shadow on a creature below.
    const flier = await token('Live Flier', 2, 5);
    await sleep(300);
    const laid0 = debug.movementMarks(flier.id)?.total ?? 0;
    await flier.update({ movementAction: 'fly', elevation: 20 });
    const laid1 = await until(() => { const n = debug.movementMarks(flier.id)?.total ?? 0; return n > laid0 && n; }, 3000) || laid0;
    record('Dust on take-off', laid1 > laid0, `${laid1 - laid0} particles`);
    await move(walker, 2, 6);
    const over = await until(() => debug.overShadows() > 0 && debug.overShadows(), 3000);
    record('Flier shadow falls on the creature below', !!over, `${over || 0} over-token shadows (setting ${game.settings.get('animater', 'shadowsOverTokens')})`);
    // Effects riding on the flier (a border, a condition's loop) bob with it; checked on any it has.
    const flying = canvas.tokens.get(flier.id), riding = globalThis.Sequencer?.EffectManager?.getEffects({ object: flying })?.filter((e) => !e.data?.belowTokens) ?? [];
    if (!riding.length) record('Effects bob with a hovering flier', null, 'the flier has no attached effect here');
    else {
      let worst = 0, moved = 0;
      for (let i = 0; i < 10; i++) {
        await sleep(150);
        const e = riding[0], y = e.position.y - e.pivot.y;
        worst = Math.max(worst, Math.abs(y - flying.mesh.position.y));
        moved = Math.max(moved, Math.abs(flying.mesh.position.y - flying.center.y));
      }
      record('Effects bob with a hovering flier', moved > 0.5 ? worst < 0.5 : null, `bob ${moved.toFixed(1)} px, effect off by at most ${worst.toFixed(2)} px`);
    }
    await move(walker, 11, 8);
    await flier.update({ movementAction: 'walk', elevation: 0 });
    const laid2 = await until(() => { const n = debug.movementMarks(flier.id)?.total ?? 0; return n > laid1 && n; }, 3000) || laid1;
    record('Dust on landing (heavier)', laid2 - laid1 > laid1 - laid0, `${laid2 - laid1} particles (take-off ${laid1 - laid0})`);

    // 6. Lit by surroundings, and heat haze over a fire light.
    await move(walker, 9, 9);
    const hazes0 = debug.fireHazes();
    const [torch] = await scene.createEmbeddedDocuments('AmbientLight', [{
      x: 10.5 * GRID, y: 9.5 * GRID, config: { dim: 30, bright: 10, color: '#ff8a30', alpha: 0.6, animation: { type: 'torch', speed: 5, intensity: 5 } },
    }]);
    const lit = await until(() => has(walker, /^lit:/), 4000);
    record('Creature lit by a nearby torch', !!lit, looks(walker).join(', ') || 'no looks');
    const hazes = await until(() => debug.fireHazes() > hazes0 && debug.fireHazes(), 3000);
    const puffs = await until(() => debug.smokePuffs() > 0 && debug.smokePuffs(), 3000);
    record('Smoke above the torch', !!puffs, `${puffs || 0} puffs rising${game.settings.get('animater', 'fireSmoke') === false ? ' (setting off)' : ''}`);
    record('Heat haze over the torch', !!hazes, `${hazes || 0} fire hazes${game.settings.get('animater', 'mapDistortionLocal') === false ? ' (Map distortion is off on this screen)' : ''}`);
    await move(walker, 1, 10);
    const unlit = await until(() => !has(walker, /^lit:/), 3000);
    record('Lit look leaves with the light', !!unlit, looks(walker).join(', ') || 'none');
    await torch.delete();
    const hazeGone = await until(() => debug.fireHazes() === hazes0, 3000);
    record('Heat haze ends with the light', !!hazeGone, `${debug.fireHazes()} left`);
    const smokeGone = await until(() => debug.smokePuffs() === 0, 6000);
    record('Smoke ends with the light', !!smokeGone, `${debug.smokePuffs()} puffs left`);

    // 7. A creature carrying a torch light holds a burning torch, and its smoke rises from the flame.
    const bearer = await token('Live Torchbearer', 4, 9, { light: { dim: 40, bright: 20, color: '#ff9a40', alpha: 0.4, animation: { type: 'torch', speed: 5, intensity: 5 } } });
    const held = await until(() => debug.heldTorches() > 0 && debug.heldTorches(), 3000);
    record('Creature holds its torch', !!held, `${held || 0} held torches${game.settings.get('animater', 'heldTorches') === false ? ' (setting off)' : ''}`);
    await bearer.update({ light: { dim: 0, bright: 0, animation: { type: null } } });
    const dropped = await until(() => debug.heldTorches() === 0, 3000);
    record('Torch goes out with the light', !!dropped, `${debug.heldTorches()} left`);

    // 8. A Light spell floats as an orb at the creature's shoulder, its light coming from the orb.
    const pack = game.packs.get('pf2e.spell-effects');
    const entry = pack ? (await pack.getIndex()).find((e) => e.name === 'Spell Effect: Light') : null;
    if (!entry) record('Light spell floats as an orb', null, 'no PF2e Spell Effect: Light here');
    else {
      const caster = await token('Live Lightbearer', 7, 9);
      const lit = canvas.tokens.get(caster.id);
      await lit.actor.createEmbeddedDocuments('Item', [(await pack.getDocument(entry._id)).toObject()]);
      const orbs = await until(() => debug.lightOrbs() > 0 && debug.lightOrbs(), 4000);
      const moved = Math.hypot(lit.light?.data?.x - lit.center.x, lit.light?.data?.y - lit.center.y);
      record('Light spell floats as an orb', !!orbs && moved > 10, `${orbs || 0} orbs; light ${moved.toFixed(0)} px from the creature's middle`);
      // The catalog's own Light marker steps aside while the orb shows (no double light).
      await sleep(1500);
      const markers = (debug.lastingStates?.() ?? []).filter((r) => r.token === lit.id && /Light/.test(r.recipe ?? ''));
      // Only meaningful where the catalog would show Light at all (a world can exclude it).
      const catalog = game.settings.get('animater', 'effectCatalog') ?? {};
      const excluded = (catalog.excluded ?? []).some((id) => String(id).endsWith(entry._id)) || catalog.enabled === false;
      record('No catalog Light marker under the orb', excluded ? null : markers.length === 0,
        excluded ? 'this world’s effect catalog leaves Light out, so there is no marker to step aside' : markers.length ? markers.map((r) => r.recipe).join(', ') : 'none');
      await lit.actor.deleteEmbeddedDocuments('Item', lit.actor.items.filter((i) => i.name === 'Spell Effect: Light').map((i) => i.id));
      const gone = await until(() => debug.lightOrbs() === 0, 4000);
      record('Orb goes with the spell', !!gone, `${debug.lightOrbs()} left`);
    }

    // 9. A creature holding a lantern carries it hanging from its hand, not a torch.
    const eq = game.packs.get('pf2e.equipment-srd');
    const lanternEntry = eq ? (await eq.getIndex()).find((e) => /^Lantern \(Hooded\)$/i.test(e.name)) : null;
    if (!lanternEntry) record('Held lantern', null, 'no PF2e Lantern (Hooded) here');
    else {
      const keeper = await token('Live Lanternkeeper', 10, 9, { light: { dim: 30, bright: 15, color: '#ffb060', alpha: 0.4, animation: { type: 'torch', speed: 3, intensity: 3 } } });
      const kt = canvas.tokens.get(keeper.id), lantern = (await eq.getDocument(lanternEntry._id)).toObject();
      foundry.utils.setProperty(lantern, 'system.equipped', { carryType: 'held', handsHeld: 1 });
      const torches0 = debug.heldTorches();
      await kt.actor.createEmbeddedDocuments('Item', [lantern]);
      kt.initializeLightSource();
      const lanterns = await until(() => debug.heldLanterns() > 0 && debug.heldLanterns(), 4000);
      record('Held lantern', !!lanterns && debug.heldTorches() <= torches0, `${lanterns || 0} lanterns, ${debug.heldTorches()} torches`);
    }

    // 10. Dancing Lights: several wisps circling the creature.
    const dancer = await token('Live Dancer', 12, 3, { light: { dim: 20, bright: 10, color: '#ffe8a0', alpha: 0.3 } });
    const before = debug.lightOrbs();
    await canvas.tokens.get(dancer.id).actor.createEmbeddedDocuments('Item', [{ name: 'Spell Effect: Dancing Lights', type: 'effect', img: 'icons/svg/light.svg' }]);
    const wisps = await until(() => debug.lightOrbs() - before >= 4 && debug.lightOrbs() - before, 4000);
    record('Dancing Lights circle as wisps', !!wisps, `${wisps || debug.lightOrbs() - before} wisps`);

    // 11. A sustained spell on another creature: a thread from its caster.
    const caster = canvas.tokens.get(walker.id).actor, target = canvas.tokens.get(dancer.id);
    const [ward] = await target.actor.createEmbeddedDocuments('Item', [{ name: 'Spell Effect: Live Ward', type: 'effect', img: 'icons/svg/aura.svg',
      system: { duration: { value: 1, unit: 'minutes', sustained: true, expiry: 'turn-start' }, context: { origin: { actor: caster.uuid, token: null, item: null, spellcasting: null }, target: null, roll: null } } }]);
    const threads = await until(() => debug.sustainThreads() > 0 && debug.sustainThreads(), 4000);
    record('Sustained spell shows its thread', !!threads, `${threads || 0} threads`);
    await ward.delete();
    const unthreaded = await until(() => debug.sustainThreads() === 0, 4000);
    record('Thread goes with the spell', !!unthreaded, `${debug.sustainThreads()} left`);

    // 12. Out of deep water, a creature drips as it walks.
    const swimmer = await token('Live Swimmer', 1, 6);
    const drops = async () => (debug.movementMarks(swimmer.id)?.total ?? 0);
    const stroll = async (from) => { for (let c = from; c < from + 3; c++) { await swimmer.update({ x: c * GRID }, { animate: false }); await sleep(250); } };
    await stroll(1);
    const dry = await drops();
    await swimmer.update({ movementAction: 'swim' }); await sleep(400);
    await swimmer.update({ movementAction: 'walk' });
    const wetFrom = await drops();
    await stroll(4);
    const wet = (await drops()) - wetFrom;
    record('Drips after swimming', wet > dry, `walking dry laid ${dry}, fresh out of the water ${wet}`);
  } catch (error) {
    record('Live check', false, error.message);
    console.error(error);
  } finally {
    if (!keep) {
      if (previous && previous.id !== scene.id && game.scenes.get(previous.id)) await previous.view();
      await scene.delete();
    }
  }
  console.table(results);
  return results;
}

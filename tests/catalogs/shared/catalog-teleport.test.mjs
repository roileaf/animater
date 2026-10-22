import test from 'node:test';
import assert from 'node:assert/strict';
import { PF2E_SPELLS, spellRecipe } from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { PF2E_FEATS, featRecipe } from '../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from '../../../scripts/catalogs/pf2e/ability-catalog.mjs';
import { dndEntries, dndRecipe, addDndBookEntries } from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import { DND5E_BOOK_ENTRIES } from '../../../data/dnd5e-book-catalog.mjs';
import { SF2E_ENTRIES, sfRecipe } from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import { dhEntries, dhRecipe } from '../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs';
import { withCatalogTeleport } from '../../../scripts/catalogs/shared/catalog-teleport.mjs';
import { teleportPlan, teleportVisuals } from '../../../scripts/engines/motion/teleport.mjs';
import { timedStages } from '../../../scripts/engines/playback/composition.mjs';
import { arrivalOf } from '../../../scripts/engines/playback/flight-path.mjs';
import { validateRecipe } from '../../../scripts/core/model.mjs';

addDndBookEntries(DND5E_BOOK_ENTRIES);
const slugOf = (name) => String(name ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Every catalog recipe in every system, with and without token motion.
function* catalogRecipes() {
  for (const motion of [true, false]) {
    for (const s of PF2E_SPELLS) yield [s.slug, () => spellRecipe(s, undefined, { motion })];
    for (const f of PF2E_FEATS) yield [f.slug, () => featRecipe(f, { motion })];
    for (const catalog of [PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG]) for (const a of catalog.entries) yield [a.slug, () => catalog.recipe(a, { motion })];
    for (const e of dndEntries()) for (const v of e.variants) yield [e.slug, () => dndRecipe(e, v.id, { motion })];
    for (const e of SF2E_ENTRIES) for (const v of e.variants) yield [e.slug, () => sfRecipe(e, v.id, { motion })];
    for (const e of dhEntries()) for (const v of e.variants) yield [slugOf(e.name), () => dhRecipe(e, v.id, { motion })];
  }
}
// Who each catalog teleport moves. A new teleporting entry fails here until it is reviewed and listed.
const MOVER = { friendfetch: 'target', translocate: 'source', 'misty-step': 'source', 'dimension-door': 'source' };
const FLIGHT = new Set(['travel', 'projectile']);
let teleports;
const built = () => teleports ??= [...catalogRecipes()].map(([slug, build]) => [slug, build()]).filter(([slug, r]) => teleportPlan(r) || r.stages.some((s) => s.kind === 'teleport') || MOVER[slug]);

test('every catalog teleport has one Teleport stage inside its animation, moving the right token', () => {
  const moving = built().filter(([, r]) => teleportPlan(r));
  assert.ok(moving.length >= 16, `found ${moving.length}`);
  assert.deepEqual(new Set(moving.map(([slug]) => slug)), new Set(Object.keys(MOVER)));
  for (const [slug, r] of moving) {
    const who = teleportPlan(r).who, name = `${r.id} (${slug})`;
    assert.equal(who, MOVER[slug], `${name} moves the ${MOVER[slug]}`);
    const own = r.stages.filter((s) => s.kind === 'teleport');
    assert.equal(own.length, 1, `${name} has one teleport stage`);
    // Linked, so it moves with the art it is timed from when that is dragged.
    assert.ok(r.stages.some((s) => s.stageId === own[0].afterStage), `${name} is linked to a stage`);
    const timed = timedStages(r), stage = timed.find((s) => s.kind === 'teleport');
    const visuals = timed.filter((s) => !['teleport', 'sound'].includes(s.kind));
    const first = Math.min(...visuals.map((s) => s.delay)), last = Math.max(...visuals.map((s) => s.delay + s.duration));
    assert.ok(stage.delay >= first && stage.delay <= last, `${name} vanishes at ${stage.delay}, inside ${first}..${last}`);
    if (who === 'target') {
      const flights = timed.filter((s) => FLIGHT.has(s.kind) && s.travelOrigin !== 'target');
      assert.ok(flights.length, `${name} reaches its target`);
      assert.equal(own[0].timingAnchor, 'arrival');
      assert.ok(stage.delay >= Math.min(...flights.map((s) => s.delay + arrivalOf(s))) - 1, `${name} vanishes once its flight arrives`);
    } else {
      // Nothing on the caster rides along when it jumps; arrival art plays once it has landed.
      const moved = stage.delay + stage.duration;
      for (const s of timed.filter((s) => s.kind === 'aura' && s.subject === 'source' && !s.persist))
        assert.ok(s.delay >= moved || s.delay + s.duration <= stage.delay, `${name}: ${s.label || s.stageId} is not dragged along`);
    }
    // Its departure and arrival effects exist in either JB2A library.
    const free = ['blue', 'purple', 'yellow'].flatMap((c) => [`jb2a.misty_step.01.${c}`, `jb2a.misty_step.02.${c}`]).map((key) => ({ key }));
    const look = teleportVisuals(r, free);
    assert.ok(look.out && look.in, `${name} has departure and arrival effects`);
  }
});

test('a teleport spell only teleports when it is cast, not on its damage roll', () => {
  const others = built().filter(([slug, r]) => MOVER[slug] && !['use', 'manual'].includes(r.trigger));
  assert.ok(others.length >= 2, 'Dimension Door has failed-teleport damage activities');
  for (const [, r] of others) {
    assert.equal(teleportPlan(r), null, r.id);
    assert.ok(!r.stages.some((s) => s.kind === 'teleport'), r.id);
  }
});

test('withCatalogTeleport times the vanish and moves art the jump would carry off', () => {
  const recipe = (stages, extra = {}) => validateRecipe({ id: 'dd', name: 'Dimension Door', trigger: 'use', match: 'dimension-door', stages, ...extra });
  const door = recipe([
    { kind: 'aura', stageId: 'd', label: 'Departure mist', subject: 'source', assets: ['jb2a.misty_step.01.purple'], duration: 1500 },
    { kind: 'motion', stageId: 'flick', motion: 'flicker', subject: 'source', afterStage: 'd', timingAnchor: 'start', startOffset: 200, duration: 1200 },
    { kind: 'aura', stageId: 'a', label: 'Arrival mist', subject: 'source', assets: ['jb2a.misty_step.02.purple'], afterStage: 'd', timingAnchor: 'start', startOffset: 1100, duration: 1500 },
  ]);
  const out = withCatalogTeleport(door), tp = out.stages.find((s) => s.kind === 'teleport');
  assert.deepEqual([tp.afterStage, tp.timingAnchor, tp.startOffset, tp.duration], ['flick', 'start', 540, 700]);
  assert.equal(out.stages.find((s) => s.stageId === 'd').kind, 'cast', 'the departure mist stays where the caster stood');
  assert.deepEqual(['afterStage', 'timingAnchor', 'startOffset'].map((k) => out.stages.find((s) => s.stageId === 'a')[k]), [tp.stageId, 'end', 100]);
  assert.deepEqual([out.teleportOut, out.teleportIn], ['jb2a.misty_step.01.purple', 'jb2a.misty_step.02.purple']);
  assert.equal(withCatalogTeleport(out), out, 'a recipe with its own stage is left alone');
  // No gesture: 45% into its departure art.
  const plain = withCatalogTeleport(recipe([{ kind: 'cast', stageId: 'c', label: 'Departure', assets: ['jb2a.misty_step.01.blue'], duration: 1000 }]));
  assert.deepEqual(['afterStage', 'startOffset'].map((k) => plain.stages.find((s) => s.kind === 'teleport')[k]), ['c', 450]);
  assert.equal(plain.teleportOut, undefined, 'blue keeps the default look');
  // A recipe that turns teleporting off, or a non-teleport recipe, gets nothing.
  for (const r of [recipe(door.stages, { teleport: 'none' }), recipe(door.stages, { match: 'fireball' })]) assert.equal(withCatalogTeleport(r), r);
  assert.equal(withCatalogTeleport(recipe(door.stages, { trigger: 'damage' })).teleport, 'none');
});

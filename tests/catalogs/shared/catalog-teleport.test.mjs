import test from 'node:test';
import assert from 'node:assert/strict';
import { PF2E_SPELLS, spellRecipe } from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { PF2E_FEATS, featRecipe } from '../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from '../../../scripts/catalogs/pf2e/ability-catalog.mjs';
import { dndEntries, dndRecipe, addDndBookEntries } from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import { DND5E_BOOK_ENTRIES } from '../../../data/dnd5e-book-catalog.mjs';
import { SF2E_ENTRIES, sfRecipe } from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import { dhEntries, dhRecipe } from '../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs';
import { withCatalogTeleport, FETCH_HOLD_MS } from '../../../scripts/catalogs/shared/catalog-teleport.mjs';
import { teleportPlan, teleportVisuals, withTeleportStage } from '../../../scripts/engines/motion/teleport.mjs';
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
// Who each catalog teleport moves, and the picker's range in feet (0: the item's own). A new teleporting entry
// fails here until it is reviewed and listed.
const MOVER = { friendfetch: 'target', translocate: 'source', 'misty-step': 'source', 'dimension-door': 'source',
  'dimensional-steps': 'source', 'echo-jump': 'source', flicker: 'source', blink: 'source', 'shadowy-teleport': 'source', 'warp-step': 'source',
  'deathly-teleport': 'source', 'radiant-teleport': 'source', 'tricksters-transposition': 'source', 'blink-out': 'source' };
const RANGE = { flicker: 10, blink: 10, 'shadowy-teleport': 30, 'warp-step': 30, 'deathly-teleport': 60, 'radiant-teleport': 60, 'tricksters-transposition': 120, 'blink-out': 60 };
const FLIGHT = new Set(['travel', 'projectile']);
let teleports;
const built = () => teleports ??= [...catalogRecipes()].map(([slug, build]) => [slug, build()]).filter(([slug, r]) => teleportPlan(r) || r.stages.some((s) => s.kind === 'teleport') || MOVER[slug]);

test('every catalog teleport has one Teleport stage inside its animation, moving the right token', () => {
  const moving = built().filter(([, r]) => teleportPlan(r));
  assert.ok(moving.length >= 36, `found ${moving.length}`);
  assert.deepEqual(new Set(moving.map(([slug]) => slug)), new Set(Object.keys(MOVER)));
  for (const [slug, r] of moving) {
    const who = teleportPlan(r).who, name = `${r.id} (${slug})`;
    assert.equal(who, MOVER[slug], `${name} moves the ${MOVER[slug]}`);
    if (RANGE[slug]) assert.equal(teleportPlan(r).range, RANGE[slug], `${name} range`);
    const own = r.stages.filter((s) => s.kind === 'teleport');
    assert.equal(own.length, 1, `${name} has one teleport stage`);
    // Linked, so it moves with the art it is timed from when that is dragged.
    assert.ok(r.stages.some((s) => s.stageId === own[0].afterStage), `${name} is linked to a stage`);
    const timed = timedStages(r), stage = timed.find((s) => s.kind === 'teleport');
    const visuals = timed.filter((s) => !['teleport', 'sound'].includes(s.kind));
    const first = Math.min(...visuals.map((s) => s.delay)), last = Math.max(...visuals.map((s) => s.delay + s.duration));
    assert.ok(stage.delay >= first && stage.delay <= last, `${name} vanishes at ${stage.delay}, inside ${first}..${last}`);
    if (who === 'target') {
      // As the hit on it lands (linked to the flight), else as the flight arrives.
      const anchor = timed.find((s) => s.stageId === own[0].afterStage);
      const flight = timed.find((s) => FLIGHT.has(s.kind) && s.travelOrigin !== 'target' && s.stageId === (anchor.kind === 'impact' ? anchor.afterStage : anchor.stageId));
      assert.ok(flight, `${name} follows the flight to its target`);
      if (anchor.kind === 'impact') assert.ok(stage.delay >= anchor.delay && stage.delay >= flight.delay, `${name} vanishes as the hit lands`);
      else assert.ok(own[0].timingAnchor === 'arrival' && stage.delay >= flight.delay + arrivalOf(flight) - 1, `${name} vanishes once its flight arrives`);
      // The pull it only acted out gives way to the real move.
      for (const s of timed.filter((s) => s.kind === 'motion' && ['rush', 'leap', 'roll', 'dodge'].includes(s.motion) && s.subject === 'targets' && s.delay >= stage.delay))
        assert.equal(s.skipOnTeleport, true, `${name}: ${s.label} plays only without a teleport`);
    } else {
      // Nothing on the caster rides along when it jumps; arrival art plays once it has landed.
      const moved = stage.delay + stage.duration;
      for (const s of timed.filter((s) => s.kind === 'aura' && s.subject === 'source' && !s.persist))
        assert.ok(s.delay >= moved || s.delay + s.duration <= stage.delay, `${name}: ${s.label || s.stageId} is not dragged along`);
    }
    // Its departure and arrival effects exist in either JB2A library.
    const free = [...['blue', 'purple', 'yellow'].flatMap((c) => [`jb2a.misty_step.01.${c}`, `jb2a.misty_step.02.${c}`]), 'jb2a.teleport.01.yellow', 'jb2a.teleport.01.blue'].map((key) => ({ key }));
    const look = teleportVisuals(r, free);
    assert.ok(look.out && look.in, `${name} has departure and arrival effects`);
  }
});

test('Friendfetch drags each ally only after its own tether has reached it and held', () => {
  const r = spellRecipe(PF2E_SPELLS.find((s) => s.slug === 'friendfetch'));
  const own = r.stages.find((s) => s.kind === 'teleport');
  const beam = r.stages.find((s) => s.stageId === own.afterStage);
  assert.ok(FLIGHT.has(beam.kind), 'linked to the tether itself, not the glint on it');
  assert.deepEqual([own.timingAnchor, own.startOffset], ['arrival', FETCH_HOLD_MS]);
  // Played: each ally's own tether arrival (a farther one later), then the hold.
  const timed = timedStages(r), stage = timed.find((s) => s.kind === 'teleport'), flight = timed.find((s) => s.stageId === beam.stageId);
  const near = { id: 'near' }, far = { id: 'far' };
  const plan = [{ ...flight, endpoint: near, contact: 300 }, { ...flight, endpoint: far, contact: 900 }, stage];
  const at = (mover) => withTeleportStage(plan, { who: 'target', mover }).find((s) => s.kind === 'teleport').delay;
  assert.equal(at(near), flight.delay + 300 + FETCH_HOLD_MS);
  assert.equal(at(far), flight.delay + 900 + FETCH_HOLD_MS);
  // The drag ends while the tether still shows.
  assert.ok(at(far) + stage.duration <= flight.delay + flight.duration, 'slide inside the tether');
});

test('a teleport is never on a damage roll, nor on the plain cast of a spell that teleports later', () => {
  const still = built().filter(([slug, r]) => MOVER[slug] && (r.trigger === 'damage' || slug === 'blink' && r.activityName === 'Cast'));
  assert.ok(still.length >= 6, 'Dimension Door failed-teleport damage, Blink 2014 cast');
  for (const [, r] of still) {
    assert.equal(teleportPlan(r), null, r.id);
    assert.ok(!r.stages.some((s) => s.kind === 'teleport'), r.id);
  }
  // Blink 2014 teleports on its Blink Check; 2024 (no roll activity) on its cast.
  assert.ok(built().some(([slug, r]) => slug === 'blink' && r.activityName === 'Blink Check' && teleportPlan(r)));
});

test('rules fixes: Warp Step moves the one who acts, Radiant Teleport bursts where it lands', () => {
  const find = (slug) => built().find(([s, r]) => s === slug && teleportPlan(r))[1];
  const warp = find('warp-step');
  assert.ok(!warp.stages.some((s) => s.subject === 'targets'), 'its art is on itself, not a companion');
  const radiant = find('radiant-teleport'), timed = timedStages(radiant), tp = timed.find((s) => s.kind === 'teleport');
  assert.ok(timed.find((s) => s.kind === 'template').delay >= tp.delay + tp.duration);
  assert.deepEqual([radiant.teleportOut, radiant.teleportIn], ['jb2a.teleport.01.yellow', 'jb2a.teleport.01.yellow']);
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

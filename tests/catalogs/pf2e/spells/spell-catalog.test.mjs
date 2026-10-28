import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PF2E_SPELLS,
  PF2E_SOURCE,
  spellRecipe,
  filterSpells,
  findCatalogSpell,
  automaticCatalogRecipe,
  normalizeCatalogState,
  useCatalogSpell,
  resolveAutomaticRecipe,
  catalogSpellReady,
} from "../../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { validateRecipe, parseImport } from "../../../../scripts/core/model.mjs";
const spell = (name) =>
  PF2E_SPELLS.find((s) => s.name === name && s.edition === "remaster") ??
  PF2E_SPELLS.find((s) => s.name === name);
const event = (record) => ({
  type: record.trigger,
  item: {
    type: "spell",
    name: record.name,
    system: { slug: record.slug },
    _stats: {
      compendiumSource: `Compendium.pf2e.spells-srd.Item.${record.id}`,
    },
  },
});

test("using one catalog animation enables only that spell without editing saved recipes", () => {
  const frost = spell("Frostbite"),
    shield = spell("Shield");
  const old = { enabled: false, excluded: [frost.id], motion: false };
  const state = useCatalogSpell(old, frost.id);
  assert.equal(state.scope, "selected");
  assert.deepEqual(state.selected, [frost.id]);
  assert.deepEqual(state.excluded, []);
  assert.equal(state.motion, false);
  assert.equal(automaticCatalogRecipe(event(shield), state), null);
  assert.equal(
    automaticCatalogRecipe(event(frost), state).id,
    spellRecipe(frost).id,
  );
  assert.deepEqual(old.excluded, [frost.id]);
  assert.deepEqual(useCatalogSpell(state, frost.id).selected, [frost.id]);
  assert.deepEqual(useCatalogSpell(state, shield.id).selected, [
    frost.id,
    shield.id,
  ]);
});

test("explicit catalog choice bypasses saved overrides and their alternate triggers; customization restores priority", () => {
  const frost = spell("Frostbite"),
    input = event(frost);
  const custom = { ...spellRecipe(frost), name: "My frost", enabled: false };
  const state = useCatalogSpell({ enabled: true }, frost.id);
  assert.equal(
    resolveAutomaticRecipe(input, state, [custom]).name,
    "Frostbite",
  );
  assert.equal(custom.enabled, false);
  assert.equal(
    resolveAutomaticRecipe(input, { ...state, selected: [] }, [custom]),
    null,
  );
  custom.enabled = true;
  assert.equal(
    resolveAutomaticRecipe(input, { ...state, selected: [] }, [custom]).name,
    "My frost",
  );
  custom.trigger = "use";
  assert.equal(
    resolveAutomaticRecipe({ ...input, type: "use" }, state, [custom]),
    null,
  );
});

test("legacy catalog settings retain full coverage; selected scope, pauses and exclusions remain opt-in", () => {
  const frost = spell("Frostbite");
  const state = normalizeCatalogState({
    enabled: true,
    selected: [frost.id, "bad", frost.id],
  });
  assert.equal(state.scope, "all");
  assert.deepEqual(state.selected, [frost.id]);
  assert.ok(automaticCatalogRecipe(event(spell("Shield")), state));
  assert.equal(
    automaticCatalogRecipe(event(frost), { ...state, enabled: false }),
    null,
  );
  assert.equal(
    automaticCatalogRecipe(event(frost), { ...state, excluded: [frost.id] }),
    null,
  );
  assert.equal(
    automaticCatalogRecipe(event(frost), {
      ...state,
      scope: "selected",
      selected: [],
    }),
    null,
  );
});

test("ready-made catalog defaults and explicit customizations work without enabling unrelated saved recipes", () => {
  const frost = spell("Frostbite"),
    shield = spell("Shield");
  const custom = { ...spellRecipe(frost), name: "My Frost" };
  const other = spellRecipe(shield);
  const state = {
    ...useCatalogSpell({}, frost.id),
    scope: "all",
    preferCatalog: true,
  };
  assert.equal(
    resolveAutomaticRecipe(event(frost), state, [custom, other], {
      customEnabled: false,
    }).name,
    "Frostbite",
  );
  assert.equal(
    resolveAutomaticRecipe(event(shield), state, [custom, other], {
      customEnabled: false,
    }).name,
    "Shield",
  );
  const customized = {
    ...state,
    selected: [],
    customized: [frost.id],
    scope: "selected",
  };
  assert.equal(
    resolveAutomaticRecipe(event(frost), customized, [custom, other], {
      customEnabled: false,
    }).name,
    "My Frost",
  );
  assert.equal(
    resolveAutomaticRecipe(event(shield), customized, [custom, other], {
      customEnabled: false,
    }),
    null,
  );
  assert.equal(
    resolveAutomaticRecipe(
      event(frost),
      customized,
      [{ ...custom, enabled: false }],
      { customEnabled: false },
    ),
    null,
  );
});

test("complete pinned PF2e spell inventory includes cantrips, focus, ranked, ritual and legacy entries", () => {
  assert.equal(PF2E_SPELLS.length, 2017);
  assert.equal(PF2E_SOURCE.sourceFiles, PF2E_SPELLS.length);
  assert.equal(new Set(PF2E_SPELLS.map((s) => s.id)).size, PF2E_SOURCE.total);
  assert.equal(
    createHash("sha256")
      .update(
        PF2E_SPELLS.map((s) => s.id)
          .sort()
          .join("\n"),
      )
      .digest("hex"),
    PF2E_SOURCE.digest,
  );
  for (const kind of ["cantrip", "focus", "ritual", "spell"])
    assert.equal(filterSpells({ kind }).length, PF2E_SOURCE.kinds[kind]);
  assert.equal(filterSpells({ edition: "legacy" }).length, 409);
});
test("every catalog animation validates, stays bounded, and round-trips as an editable recipe", () => {
  for (const record of PF2E_SPELLS) {
    const recipe = spellRecipe(record);
    if(!catalogSpellReady(record)){
      assert.equal(recipe.enabled,false,record.name);
      assert.deepEqual(recipe.stages[0].assets,[],record.name);
      assert.throws(()=>validateRecipe(recipe),/database key/);
      continue;
    }
    assert.deepEqual(validateRecipe(recipe), recipe, record.name);
    assert.deepEqual(
      parseImport(JSON.stringify({ schema: 1, recipes: [recipe] }))[0],
      recipe,
      record.name,
    );
    assert.equal(
      recipe.itemUuid,
      `Compendium.pf2e.spells-srd.Item.${record.id}`,
    );
    assert.ok(recipe.stages.length >= 1 && recipe.stages.length <= 8);
    // Lasting looks come from effects on tokens, except a sustained spell's own layer (it ends with the sustain).
    assert.ok(recipe.stages.every((s) => !s.persist || s.sustain), record.name);
  }
});
test("source UUID survives localization and renaming; non-spell items cannot enter the PF2e catalog", () => {
  const record = spell("Fireball");
  const input = event(record);
  input.item.name = "Renamed localized spell";
  input.item.system.slug = "translated-slug";
  assert.equal(findCatalogSpell(input).id, record.id);
  assert.equal(
    findCatalogSpell({ ...input, item: { ...input.item, type: "weapon" } }),
    null,
  );
  assert.equal(
    findCatalogSpell({ item: { type: "spell", name: "Fireball surprise" } }),
    null,
  );
});
test("automatic catalog is opt-in and respects exclusions, event types, and disabled saved overrides", () => {
  const record = spell("Frostbite"),
    input = event(record);
  assert.equal(automaticCatalogRecipe(input, { enabled: false }), null);
  assert.equal(
    automaticCatalogRecipe(input, { enabled: true, excluded: [record.id] }),
    null,
  );
  assert.equal(
    automaticCatalogRecipe({ ...input, type: "attack" }, { enabled: true }),
    null,
  );
  const recipe = spellRecipe(record);
  assert.equal(
    automaticCatalogRecipe(input, { enabled: true }, [
      { ...recipe, enabled: false },
    ]),
    null,
  );
  assert.equal(
    automaticCatalogRecipe(input, { enabled: true, excluded: [] }).id,
    recipe.id,
  );
});
test("native trigger choices distinguish attacks, save damage, area placement and manual rituals", () => {
  assert.equal(spell("Ignition").trigger, "attack");
  assert.equal(spell("Frostbite").trigger, "damage");
  assert.equal(spell("Fireball").trigger, "template");
  assert.equal(spell("Shield").trigger, "use");
  assert.ok(
    filterSpells({ kind: "ritual" }).every((s) => s.trigger === "manual"),
  );
  assert.ok(
    PF2E_SPELLS.filter((s) => s.trigger === "template").every((s) =>
      ["burst", "line", "cone", "emanation", "square", "cube", "cylinder"].includes(s.area?.type),
    ),
  );
});
test("choreography distinguishes volleys, chains, afterimages, protective and elemental art", () => {
  const volley = spellRecipe(spell("Force Barrage"));
  assert.equal(volley.stages[1].repeats, 3);
  assert.equal(
    spellRecipe(spell("Chain Lightning")).stages[1].targetStagger,
    260,
  );
  assert.equal(
    spellRecipe(spell("Mirror Image")).stages.find((s) => s.kind === "sprite")
      .copies,
    3,
  );
  assert.notDeepEqual(
    spellRecipe(spell("Shield")).stages[1].assets,
    spellRecipe(spell("Ignition")).stages[1].assets,
  );
});
test("symbolic geometry and utility cues expose limitations instead of promising mechanical effects", () => {
  for (const record of PF2E_SPELLS.filter((s) =>
    !s.design.unavailable && ["wall", "point", "portal", "ritual"].includes(s.delivery),
  )) {
    assert.equal(record.quality, "symbolic");
    assert.ok(record.notes.length, record.name);
  }
  const fireCone=spell('Breathe Fire');
  assert.equal(fireCone.quality,'themed');
  assert.ok(spellRecipe(fireCone).stages.some(s=>s.kind==='template'));
  assert.ok(fireCone.notes.some(note=>/native area/i.test(note)));
  for(const record of PF2E_SPELLS.filter(s=>s.delivery==='cone'))
    assert.ok(record.notes.length,record.name);
  assert.ok(
    filterSpells({ tradition: "primal", rank: "3", edition: "remaster" }).every(
      (s) => s.rank === 3 && s.traditions.includes("primal"),
    ),
  );
  assert.ok(
    filterSpells({ search: "  FIREBALL  " }).some((s) => s.name === "Fireball"),
  );
});

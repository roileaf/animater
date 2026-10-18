import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSpellMedia,
  assetGeometry,
} from "../../../../tools/spell-asset-selection.mjs";
import { databaseEntries } from "../../../../tools/asset-databases.mjs";
const row = (key, file = "Square_400x400.webm") => ({
  key: `jb2a.${key}`,
  file,
});
const defaults = {
  cast: "cast_generic",
  bolt: "magic_missile",
  hit: "impact",
  aura: "energy_field",
  area: "impact",
};
const rows = [
  row("cast_generic.purple"),
  row("magic_missile.purple", "MagicMissile_15ft_1000x400.webm"),
  row("impact.purple"),
  row("energy_field.purple"),
  row("energy_beam.normal.purple.01", "EnergyBeam_15ft_1000x400.webm"),
  row("web.01.purple"),
  row("fireball.beam.orange", "FireballBeam_15ft_1000x400.webm"),
  row("fireball.explosion.orange"),
  row("breath_weapons.fire.cone.orange", "Fire_Cone_600x600.webm"),
  row("wall_of_fire.ring.yellow", "Wall_Ring_400x400.webm"),
  row("wall_of_fire.300x100.yellow", "Wall_300x100.webm"),
];
const db = { free: rows, patreon: rows };

test('reviewed slot geometry preserves local artwork and rejects incompatible directional fallback', () => {
  const profile = {bolt:'web.01',slotGeometry:{bolt:'radial'}};
  for (const context of [{name:'Local web threads'}, {name:'Local web threads',design:{slotGeometry:{bolt:'radial'}}}]) {
    const selected=resolveSpellMedia(db,'arcane',profile,defaults,context);
    assert.deepEqual(selected.bolt,['jb2a.web.01.purple']);
  }
  assert.throws(()=>resolveSpellMedia(db,'arcane',{...profile,slotGeometry:{bolt:'invalid'}},defaults),/Unknown authored media geometry/);
});

test("localized spear melee sibling never inherits thrown projectile geometry", () => {
  assert.equal(assetGeometry(row("spear.melee.01.white", "SpearMelee_800x600.webm")), "radial");
  assert.equal(assetGeometry(row("spear.throw.01.white", "SpearThrow_15ft_1000x400.webm")), "projectile");
});
test("ray geometry rejects projectile fallback and chooses genuine beam from inventory", () => {
  const out = resolveSpellMedia(db, "force", {}, defaults, {
    name: "Force Ray",
    design: { pattern: "ray" },
    delivery: "bolt",
  });
  assert.equal(out.bolt[0], "jb2a.energy_beam.normal.purple.01");
});
test("full inventory discovers relevant spell family absent from configured hints", () => {
  const out = resolveSpellMedia(db, "arcane", {}, defaults, {
    name: "Web",
    delivery: "target",
  });
  assert.equal(out.hit[0], "jb2a.web.01.purple");
});
test("explosion role never resolves fireball traveling beam or cone", () => {
  const out = resolveSpellMedia(db, "fire", { hit: "fireball" }, defaults, {
    name: "Fireball",
    delivery: "burst",
  });
  assert.equal(out.hit[0], "jb2a.fireball.explosion.orange");
});
test("wall geometry rejects ring alias while cone role requires cone asset", () => {
  assert.equal(
    resolveSpellMedia(db, "fire", {}, defaults, {
      name: "Wall of Fire",
      delivery: "wall",
    }).area[0],
    "jb2a.wall_of_fire.300x100.yellow",
  );
  assert.equal(
    resolveSpellMedia(db, "fire", {}, defaults, {
      name: "Burning Hands",
      delivery: "cone",
    }).area[0],
    "jb2a.breath_weapons.fire.cone.orange",
  );
  assert.equal(
    assetGeometry(row("wall_of_fire.500x100.blue", "Wall_Ring_400x400.webm")),
    "radial",
  );
});
test("inventory retains inherited Sequencer templates, dimensions and all distance variants", async () => {
  const source = `export const db={}; export async function init(){db._templates={ray:[100,0,0]};db.custom_ray={_template:'ray',_metadata:{name:'Custom Ray'},blue:{'05ft':'Ray_05ft_600x400.webm','15ft':'Ray_15ft_1000x400.webm','30ft':'Ray_30ft_1600x400.webm'}};}`;
  const [entry] = await databaseEntries(source, "init", "db");
  assert.equal(entry.key, "jb2a.custom_ray.blue");
  assert.equal(entry.file, "Ray_15ft_1000x400.webm");
  assert.deepEqual(entry.template, [100, 0, 0]);
  assert.equal(entry.metadata.name, "Custom Ray");
  assert.equal(entry.width, 1000);
  assert.equal(Object.keys(entry.distanceFiles).length, 3);
});
test("still image variants never enter video inventory", async () => {
  const source = `export const db={};export async function init(){db.test={endframe:['Image.webp'],animation:['Movie_400x400.webm','Second_400x400.webm']};}`;
  const entries = await databaseEntries(source, "init", "db");
  assert.deepEqual(
    entries.map((entry) => entry.key),
    ["jb2a.test.animation"],
  );
  assert.equal(entries[0].files.length, 2);
});
test("unlisted beam family can enter ray selection through metadata and semantic name", () => {
  const custom = {
    ...row("necrotic_ray.grey", "NecroticRay_15ft_1000x400.webm"),
    templateName: "ray",
  };
  const out = resolveSpellMedia(
    { free: [...rows, custom], patreon: [...rows, custom] },
    "void",
    {},
    defaults,
    { name: "Necrotic Ray", design: { pattern: "ray" }, delivery: "bolt" },
  );
  assert.equal(out.bolt[0], custom.key);
});
test("moving globs use localized objects while missile spells retain built-in moving lanes", () => {
  const water = row("liquid.blob.blue"),
    ice = row("snowball_toss.blue", "Snowball_15ft_1000x400.webm");
  const inventory = {
    free: [...rows, water, ice],
    patreon: [...rows, water, ice],
  };
  assert.equal(
    resolveSpellMedia(inventory, "water", { bolt: "liquid.blob" }, defaults, {
      name: "Briny Bolt",
      design: { pattern: "movingGlob" },
    }).bolt[0],
    water.key,
  );
  assert.equal(
    resolveSpellMedia(inventory, "cold", { bolt: "snowball_toss" }, defaults, {
      name: "Winter Bolt",
      design: { pattern: "missile" },
    }).bolt[0],
    ice.key,
  );
});
test("mixed families distinguish localized complete strands from range strands", () => {
  const local = row(
      "energy_strands.complete.purple.01",
      "EnergyStrands_600x600.webm",
    ),
    beam = row(
      "energy_strands.range.standard.purple.01",
      "EnergyStrand_15ft_1000x400.webm",
    );
  assert.equal(assetGeometry(local), "radial");
  assert.equal(assetGeometry(beam), "beam");
  assert.equal(
    assetGeometry(
      row("vine.complete.nature.single.green", "Vine_300x300.webm"),
    ),
    "radial",
  );
  assert.equal(assetGeometry(row("spiritual_weapon.club.green")), "radial");
  const inventory = {
    free: [...rows, local, beam],
    patreon: [...rows, local, beam],
  };
  const out = resolveSpellMedia(
    inventory,
    "void",
    { bolt: "energy_strands", aura: "energy_strands" },
    defaults,
    { name: "Drain", design: { pattern: "drain" } },
  );
  assert.equal(out.bolt[0], beam.key);
  assert.equal(out.aura[0], local.key);
});
test("edition fallback preserves object geometry when desired color is Patreon-only", () => {
  const blue = row("liquid.blob.blue"),
    green = row("liquid.blob.green");
  const out = resolveSpellMedia(
    { patreon: [...rows, blue, green], free: [...rows, blue] },
    "acid",
    { bolt: "liquid.blob.green" },
    defaults,
    { name: "Acid Splash", design: { pattern: "movingGlob" } },
  );
  assert.deepEqual(out.bolt, [green.key, blue.key]);
});
test("role-specific residue intent wins over an exact spell-name explosion", () => {
  const smoke = row("smoke.loop.grey");
  const inventory = { free: [...rows, smoke], patreon: [...rows, smoke] };
  const out = resolveSpellMedia(
    inventory,
    "fire",
    { aura: "smoke" },
    defaults,
    { name: "Fireball", delivery: "burst" },
  );
  assert.equal(out.aura[0], smoke.key);
});
test("a flying swarm carries localized creature footage rather than a beam", () => {
  const bats = row("bats.complete.01.red");
  const inventory = { free: [...rows, bats], patreon: [...rows, bats] };
  const out = resolveSpellMedia(inventory, "void", { bolt: "bats" }, defaults, {
    name: "Murder of Crows",
    design: { pattern: "flyingSwarm" },
  });
  assert.equal(out.bolt[0], bats.key);
  assert.equal(assetGeometry(bats), "radial");
});

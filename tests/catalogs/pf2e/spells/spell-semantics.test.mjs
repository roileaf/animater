import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSpellDescription,
  descriptionOpening,
} from "../../../../tools/spell-semantics.mjs";

function analyze(name, slug, prose, overrides = {}) {
  const {
    theme = "arcane",
    delivery = "target",
    traits = [],
    ...fields
  } = overrides;
  return analyzeSpellDescription(
    {
      name,
      system: {
        description: { value: `<p>${prose}</p>` },
        traits: { value: traits },
        target: { value: "1 creature" },
        time: { value: "2" },
        damage: {},
        ...fields,
      },
    },
    { slug, kind: "spell", theme, delivery },
  );
}

test('fire trait and a later explosion do not rewrite cloud placement into detonation',()=>{
 for(const prose of ['You conjure a cloud of black dust. It explodes only when ignited.', 'You create a dust cloud that explodes when touched by fire.']){
  const design=analyze('Dust cloud','qa-dust-cloud',prose,{theme:'fire',delivery:'burst',traits:['fire'],area:{type:'burst',value:10},target:{value:''}});
  assert.notEqual(design.motif,'detonation');
 }
 const blast=analyze('Blast','qa-blast','You create a roaring explosion of flame.',{theme:'fire',delivery:'burst',traits:['fire'],area:{type:'burst',value:10},target:{value:''}});
 assert.equal(blast.motif,'detonation');
});

test('GM-only native descriptions are analyzed without copying private prose into design metadata',()=>{
 const prose='A secret blue portal connects corresponding locations. Later failures cause feedback.';
 const withPublic=analyze('GM ritual','gm-ritual',prose,{delivery:'ritual'});
 const withPrivate=analyze('GM ritual','gm-ritual','',{delivery:'ritual',description:{value:'',gm:`<p>${prose}</p>`}});
 assert.equal(withPrivate.descriptionHash,withPublic.descriptionHash);
 assert.equal(withPrivate.descriptionChars,prose.length);
 assert.equal(withPrivate.analysis,'full-description');
 assert.ok(!JSON.stringify(withPrivate).includes('Later failures cause feedback'));
 const precedence=analyze('GM ritual','gm-ritual',prose,{delivery:'ritual',description:{value:`<p>${prose}</p>`,gm:'different hidden notes'}});
 assert.equal(precedence.descriptionHash,withPublic.descriptionHash);
});

test("direct spell attacks missing PF2e attack trait retain their stated delivery and trigger evidence", () => {
  const corruption = analyze(
    "Ray of Corruption",
    "ray-of-corruption",
    "A sickly gray beam of toxic spores strikes your target. Make a spell attack against the target.",
    { theme: "poison" },
  );
  assert.equal(corruption.delivery, "bolt");
  assert.equal(corruption.spellAttack, true);
  assert.equal(corruption.subject, "targets");
  const containment = analyze(
    "Unbreaking Wave Containment",
    "unbreaking-wave-containment",
    "You wrap enemies in four strands of water. When you cast the spell, make a spell attack roll against the targets.",
    { theme: "water" },
  );
  assert.equal(containment.delivery, "target");
  assert.equal(containment.spellAttack, true);
});

test("automatic force bolt and target-centered Heartbolt do not become stationary caster effects", () => {
  const force = analyze(
    "Force Bolt",
    "force-bolt",
    "An arrow-shaped bolt automatically hits your target.",
    { theme: "force" },
  );
  assert.equal(force.delivery, "bolt");
  assert.equal(force.spellAttack, false);
  const heart = analyze(
    "Heartbolt",
    "heartbolt",
    "Life energy plunges into your target, then explodes outward from that target.",
    {
      theme: "healing",
      delivery: "emanation",
      area: { type: "emanation", value: 20 },
    },
  );
  assert.equal(heart.delivery, "bolt");
  assert.equal(heart.subject, "targets");
});

test("blade-shaped light stays melee while rays and physical bolts have separate semantic cues", () => {
  const blade = analyze(
    "Blazing Blade",
    "blazing-blade",
    "A scimitar-shaped beam springs from your hand.",
    { theme: "fire", delivery: "bolt", traits: ["attack"] },
  );
  assert.equal(blade.delivery, "melee");
  const ray = analyze(
    "Polar Ray",
    "polar-ray",
    "A blue-white ray strikes the target.",
    { theme: "cold", delivery: "bolt", traits: ["attack"] },
  );
  assert.ok(ray.cues.includes("ray"));
  const icicle = analyze(
    "Winter Bolt",
    "winter-bolt",
    "You fling a hollow icicle. The bolt lodges in the target.",
    { theme: "cold", delivery: "bolt", traits: ["attack"] },
  );
  assert.ok(!icicle.cues.includes("ray"));
  assert.ok(icicle.cues.includes("bolt"));
  const water = analyze(
    "Briny Bolt",
    "briny-bolt",
    "You hurl a bolt of saltwater.",
    { theme: "water", delivery: "bolt", traits: ["attack"] },
  );
  assert.ok(!water.cues.includes("ray"));
});

test("incidental ray examples and sustained attacks cannot rewrite base casting delivery", () => {
  const antimagic = analyze(
    "Antimagic Field",
    "antimagic-field",
    "Magic cannot function here. For example, a ray can pass outside the field.",
    { delivery: "emanation" },
  );
  assert.equal(antimagic.delivery, "emanation");
  assert.equal(antimagic.spellAttack, false);
  const creepers = analyze(
    "Tangling Creepers",
    "tangling-creepers",
    "Plants fill the area. Once per round, Sustain to make a melee spell attack.",
    { theme: "plant", delivery: "burst" },
  );
  assert.equal(creepers.delivery, "burst");
  assert.equal(creepers.spellAttack, false);
  const spirit = analyze(
    "Spirit Object",
    "spirit-object",
    "Bring an object to life. Sustain to prompt it to Strike. Make a melee spell attack.",
    { theme: "spirit" },
  );
  assert.equal(spirit.delivery, "target");
  assert.equal(spirit.spellAttack, false);
});

test("legacy stat paragraphs cannot hide the spell's visual opening", () => {
  const html =
    "<p><strong>Trigger</strong> A foe strikes you.</p><p><strong>Requirements</strong> One hand free.</p><p>You fire a freezing beam.</p>";
  assert.equal(descriptionOpening(html), "You fire a freezing beam.");
  const result = analyze("Cold Retaliation", "cold-retaliation", "", {
    theme: "cold",
    delivery: "bolt",
    traits: ["attack"],
    description: { value: html },
  });
  assert.equal(result.motif, "icyRay");
  assert.ok(result.cues.includes("ray"));
});

test("native touch range and direct melee attacks keep contact geometry; secondary flight preserves projectile delivery", () => {
  const touch = analyze(
    "Withering Grasp",
    "withering-grasp",
    "Your touch decays organic matter. Make a spell attack.",
    {
      theme: "void",
      delivery: "bolt",
      traits: ["attack"],
      range: { value: "touch" },
    },
  );
  assert.equal(touch.delivery, "melee");
  const weapon = analyze(
    "Imaginary Weapon",
    "imaginary-weapon",
    "You create a simple weapon of force. Make a melee spell attack against your target.",
    { theme: "force", delivery: "bolt", traits: ["attack"] },
  );
  assert.equal(weapon.delivery, "melee");
  const air = analyze(
    "Propelling Air Stream",
    "propelling-air-stream",
    "You shoot a high-speed blast of air. Make a ranged spell attack. You gain a fly Speed.",
    { theme: "wind", delivery: "bolt", traits: ["attack"] },
  );
  assert.equal(air.delivery, "bolt");
  assert.notEqual(air.motif, "flight");
});

test("projectile markings retain flight despite a secondary detection cue", () => {
  const mark = analyze(
    "Vindicator's Mark",
    "vindicators-mark",
    "You launch a magical dart at your foe, leaving a nimbus only you can detect.",
    { theme: "spirit", delivery: "bolt", traits: ["attack"] },
  );
  assert.equal(mark.delivery, "bolt");
  assert.notEqual(mark.motif, "eye");
});

test("attacking spell imagery does not classify spells that batter flying creatures as flight buffs", () => {
  const sky = analyze(
    "Falling Sky",
    "falling-sky",
    "Telekinetic pressure smashes down. Flying creatures descend to the ground.",
    {
      theme: "arcane",
      delivery: "self",
      area: { type: "cylinder", value: 30 },
    },
  );
  assert.notEqual(sky.motif, "flight");
  const vortex = analyze(
    "Flame Vortex",
    "flame-vortex",
    "A blazing inferno swirls. It creates difficult terrain for flying creatures.",
    { theme: "fire", delivery: "self", area: { type: "cylinder", value: 5 } },
  );
  assert.notEqual(vortex.motif, "flight");
});

test("reviewed remote summons and secondary emanations use their stated visual anchor", () => {
  const summon = analyze(
    "Incarnate Kaiju",
    "incarnate-kaiju",
    "You conjure a kaiju. It rises to attack your foes.",
    { theme: "arcane", delivery: "self" },
  );
  assert.equal(summon.delivery, "point");
  assert.equal(summon.pattern, "arrival");
  const corpse = analyze(
    "Shambling Horror",
    "shambling-horror",
    "You reanimate a corpse. Its attacks use your spell attack modifier.",
    {
      theme: "arcane",
      delivery: "bolt",
      traits: ["attack"],
      range: { value: "touch" },
    },
  );
  assert.equal(corpse.delivery, "target");
  assert.equal(corpse.spellAttack, false);
  for (const [name, slug] of [
    ["Final Sacrifice", "final-sacrifice"],
    ["Necrotic Bomb", "necrotic-bomb"],
    ["Deathly Scream", "deathly-scream"],
    ["Rebuke Death", "rebuke-death"],
    ["Detonate Magic", "detonate-magic"],
  ]) {
    const result = analyze(
      name,
      slug,
      "An effect spreads from your chosen target.",
      { delivery: "emanation", area: { type: "emanation", value: 10 } },
    );
    assert.equal(result.delivery, "target", name);
    assert.equal(result.subject, "targets", name);
  }
});

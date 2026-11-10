// Breaks tied to the animation reaching the thing (main.mjs glue around the pure play-moments.mjs and area-damage.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name) => { const i = main.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return main.slice(i, main.indexOf("\n}\n", i)); };

test("an area breaks at its animation's impact, with the spell's own damage types, no roll needed", () => {
  assert.match(main, /onPlayStart: \(started\) => propSafe\("area", \(\) => \{\n\s*const impactAt = Date\.now\(\) \+ impactDelay\(started\?\.playbackPlan\);\n\s*propAreas\.played\(template\.uuid, impactAt\);\n\s*breakAreaOnPlay\(template\.uuid, impactAt\);/);
  assert.match(body("breakAreaOnPlay"), /breakAreaThings\(now, now\.damageTypes \?\? \[\]\)/);
  // every screen remembers the spell's types with the area
  assert.match(body("rememberArea"), /damageTypes: areaDamageTypes\(doc\)/);
  assert.match(main, /Hooks\.on\(hook, \(doc, _options, userId\) => propSafe\("area", \(\) => rememberArea\(doc, userId\)\)\)/);
});

test("the damage roll is the fallback: only the roll's types the spell deals, through the same claims", () => {
  const b = body("breakAreaProps");
  assert.match(b, /filter\(\(t\) => spell\.includes\(t\)\)/);
  assert.match(b, /breakAreaThings\(propAreas\.get\(area\.templateId\) \?\? area, types, named\)/);
  assert.doesNotMatch(b, /askProp|askWall|askDecor/);
  const t = body("breakAreaThings");
  for (const claim of ["thing.id)", "`wall:${thing.id}`", "`ignite:${t.id}`"]) assert.ok(t.includes(`propAreas.claim(area.templateId, ${claim}`), claim);
  assert.match(t, /types\.includes\("fire"\)/);
});

test("the GM reads an area it never saw placed from its document, and its damage types from its spell", () => {
  const b = body("areaPlace");
  assert.match(b, /placedRecordOf\(doc, \{ localNow: now, serverNow: now, message: card\(\) \}\)/);
  assert.ok(b.includes("damageTypes: doc ? areaPlaceTypes(doc, cause, user, now) : []"));
  assert.doesNotMatch(b, /cause\.damageType/);
});

test("an attack's play tells its breaks when it starts, or that none will, and melee breaks wait for the blow", () => {
  assert.match(body("dispatch"), /attackPlays\.started\(key, started\?\.playbackPlan\)/);
  assert.match(body("dispatch"), /finally \{ attackPlays\.ended\(key\); \}/);
  assert.match(body("strikeWait"), /momentWait\(strikeMoment\(play\.plan\), play\.age\)/);
  const miss = body("breakPropOnMiss");
  assert.match(miss, /const wait = await strikeWait\(event\);/);
  assert.match(miss, /playedShots|missShotOf/);
  assert.match(body("missShotOf"), /await playedShots\(missFlights, key\)/);
  const hit = body("breakWindowOnHit");
  assert.match(hit, /askAfter\(await strikeWait\(event\), ask\)/);
  assert.match(hit, /await playedShots\(hitFlights, playKeyOf\(event\)\)/);
  assert.doesNotMatch(main, /MISS_FLIGHT_WAIT/);
});

test("a screen that loads after an area was placed remembers it from its card, within the ttl", () => {
  assert.match(main, /Hooks\.on\("canvasReady", \(\) => \{ propSafe\("area reload", rememberLoadedAreas\); \}\);/);
  const hook = body("rememberLoadedAreas");
  assert.match(hook, /placedRecordOf\(doc, \{ localNow: now, serverNow: now, message \}\)/);
  assert.match(hook, /now - placed\.rememberedAt <= AREA_TTL_MS\) rememberArea\(doc, placed\.authorId, placed\.rememberedAt\)/);
});

test("claims are held only while the GM may still write the break, so a refused animation ask leaves it to the roll", () => {
  const t = body("breakAreaThings");
  assert.ok(t.includes("askClaimed({ ask, written, release: () => propAreas.release(areaUuid, claimId), wait: CLAIM_SETTLE_MS })"));
  assert.doesNotMatch(t, /void ask(Prop|Wall|Decor)\(/);
  assert.ok(t.includes("flagsOf(scene.tiles.get(thing.id))?.prop?.broken"));
  assert.ok(t.includes("flagsOf(scene.walls?.get(thing.id))?.breakWall?.broken"));
  assert.ok(t.includes("decorBroken ?? []).some((e) => e?.key === thing.decor?.key)"));
  assert.ok(t.includes('prop?.broken?.powder !== "spilled"'));
});

test("a spell with no damage type on its item breaks from its roll only, the GM reading that roll itself", () => {
  const b = body("breakAreaProps");
  assert.ok(b.includes("const types = spell.length ? rolled.filter((t) => spell.includes(t)) : rolled, named = spell.length ? {} : { messageId: message.id }"));
  assert.ok(b.includes("breakAreaThings(propAreas.get(area.templateId) ?? area, types, named)"));
  // the animation path passes the item's types only: with none, nothing breaks until the roll
  assert.ok(body("breakAreaOnPlay").includes("breakAreaThings(now, now.damageTypes ?? [])"));
  const g = body("areaPlaceTypes");
  assert.ok(g.includes('if (own.length || typeof cause?.messageId !== "string") return own;'));
  assert.ok(g.includes("game.messages?.get(cause.messageId)"));
  assert.ok(g.includes("rollDamageTypes(summary, { itemUuid, actorUuid, sender: { id: user?.id, isGM: user?.isGM === true }, now })"));
});


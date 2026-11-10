// tests/engines/props/decor-break-wiring.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");

test("the decor relay: asked of the GM, checked twice, written coalesced", () => {
  assert.match(main, /if \(data\?\.type === DECOR_BREAK_MESSAGE\) \{ void receiveDecorBreak\(data, senderId\)/);
  assert.match(main, /async function requestDecorBreak\(regionDoc, key, cause, \{ from \} = \{\}\)/);
  assert.match(main, /async function applyDecorBreak\(scene, regionDoc, key, cause, rawNote, user\)/);
  assert.ok((main.match(/validDecorBreakRequest\(/g) ?? []).length >= 2, "requester and GM");
  assert.match(main, /breakNoteFor\(\{ tile: view, walls: \[\]/);
  assert.match(main, /decorBrokenAfter\(/);
  assert.match(main, /\{ animater: \{ decorBreak: true \} \}/);
  assert.match(main, /makeRubbleRegion\(scene, \{ id: decorRubbleId\(/);
});
test("the painter and the wreck layer", () => {
  assert.match(main, /broken: decorBrokenKeys\(region\)/);
  assert.match(main, /const decorWreckage = createPropWreckage\(\{[^]*?layer: floorLayer\("decorWrecks", 656\)/);
  assert.match(main, /decorWreckTile\(view, decorations\.art\(/);
  assert.match(main, /syncDecorWrecks\(options\?\.animater\?\.decorBreak === true\)/);
});
test("Repair clears every region's breaks; a deleted region takes its rubble", () => {
  assert.match(main, /decorRepairUpdates\(sceneRegions\(scene\)\)/);
  assert.match(main, /async function repairDecorRegion\(regionDoc\)/);
  assert.match(main, /Hooks\.on\("deleteRegion", [^\n]*decor/);
  assert.match(main, /breakDecor: \(regionId, key, cause = \{\}\) =>/);
});

// The controller's rulings (progress.md D5, D7, D11) and the Task 2/3 notes.
const body = (name) => {
  let at = main.indexOf(`function ${name}(`);
  if (at < 0) at = main.indexOf(`const ${name} = `);
  assert.ok(at >= 0, `${name} exists`);
  return main.slice(at, main.indexOf("\n}", at));
};
test("a key is held from the GM's check until its region write lands (D5)", () => {
  const apply = body("applyDecorBreak");
  assert.match(apply, /decorWriting\.has\(/);
  assert.match(apply, /decorWriting\.add\(/);
  assert.match(apply, /finally \{ decorWriting\.delete\(/);
  assert.match(apply, /queued: queuedDecorKeys\(regionDoc\.id\)/);
  // the hold lasts until the coalesced write resolves
  assert.ok(apply.indexOf("await queueDecorWrite(") > 0 && apply.indexOf("await queueDecorWrite(") < apply.indexOf("finally"));
  // the rubble and whisper come only after the GM's check, the whisper only once the write landed
  assert.ok(apply.indexOf("makeRubbleRegion(") > apply.indexOf("validDecorBreakRequest("));
  assert.ok(apply.indexOf("whisperTopple(") > apply.indexOf("await queueDecorWrite("));
  assert.match(main, /const decorQueue = createDecorQueue\(/);
  assert.match(main, /const queuedDecorKeys = \(regionId\) => decorQueue\.keys\(regionId\)/);
});
test("the GM's write is fed validated adds over the parsed stored breaks (Task 2 note)", () => {
  assert.match(main, /stored = readDecorBroken\(region\.broken\)/);
  assert.match(main, /decorBrokenAfter\(stored, adds\.filter\(\(a\) => keys\.has\(a\.key\)\), keys\)/);
});
test("decorations break and leave wrecks whatever Region steps says: they are drawn regardless", () => {
  assert.match(body("decorViews"), /if \(!propsOn\(scene\)\) return \[\];/);
  assert.doesNotMatch(body("decorViews") + body("syncDecorWrecks") + body("breakDecorHere"), /regionStepsOn/);
  assert.doesNotMatch(main, /const syncDecorations = \(\) => \{\s*if \(!canvas\?\.ready\) return;\s*const list = \[\];\s*if \(regionStepsOn\(\)\)/);
});
test("the wreck is cut from the painter's own picture (Task 3 ruling)", () => {
  assert.match(main, /const decorArtLook = \(settings\) => \(\{ \.\.\.decorLook\(settings\), snow: 0 \}\)/);
  assert.doesNotMatch(main, /decorations\.art\([^)]*decorLook\(/);
});
test("Repair decorations deletes the region's own rubble; the toolbar Repair keeps every rubble region's delete", () => {
  const one = body("repairDecorRegion");
  assert.match(one, /decorRegionRepair\(/);
  assert.match(one, /deletePropRegions\(scene, deleteRegions\)/);
  assert.match(one, /withDeletes\(/);
  const all = body("repairAllProps");
  assert.match(all, /r\.deleteRegions\?\.length\) await deletePropRegions/);
  assert.match(all, /updateEmbeddedDocuments\("Region", decorFixes\.map\(\(u\) => withDeletes\(u, del\)\)/);
});
test("a torn-down canvas forgets every decoration wreck and timer", () => {
  assert.match(main, /decorWrecksShown\.clear\(\); decorPending\.clear\(\); decorLate\.clear\(\); decorWreckage\.clear\(\)/);
});

// Fix round 1 (task-4-review.md).
test("a pruned stale entry's rubble goes once the region write lands", () => {
  const q = main.slice(main.indexOf("const decorQueue = createDecorQueue("), main.indexOf("const queueDecorWrite"));
  assert.match(q, /decorPrunedRubble\(\[\.\.\.stored, \.\.\.adds\], keys, sceneRegions\(scene\), region\.id\)/);
  assert.ok(q.indexOf("await regionDoc.update(") < q.indexOf("deletePropRegions(scene, orphans)"), "deleted after the write");
  assert.match(q, /adds\.filter\(\(a\) => keys\.has\(a\.key\)\)/, "an add checked before an edit is not stored");
});
test("the wreck sync computes no placements for a region with nothing stored", () => {
  const sync = body("syncDecorWrecks"), guard = sync.indexOf("if (!readDecorBroken(doc.flags?.[ID]?.decorBroken).length) continue;");
  assert.ok(guard > 0, "guard present");
  assert.ok(guard < sync.indexOf("decorRegionOf(doc)") && guard < sync.indexOf("decorIndex(region, grid)"), "before regionAreas and the scatter");
});
test("break and decoration repair writes skip the generic region rebuilds", () => {
  assert.match(main, /const quietSave = \(first, changes, options\) => isClockSave\(first\) \|\| \(first\?\.documentName === "Region" && decorOnlySave\(changes, options\)\)/);
  const lines = main.split(/\r?\n/).filter((l) => /for \(const hook of \[[^\]]*"updateRegion"/i.test(l) || /'updateRegion'/.test(l));
  assert.ok(lines.length >= 11, `the rebuild listeners (${lines.length})`);
  const next = (l) => main.split(/\r?\n/)[main.split(/\r?\n/).indexOf(l) + 1];
  for (const l of lines) assert.match(l.includes("Hooks.on") ? l : next(l), /quietSave\(first, changes, options\)/, l.slice(0, 120));
  for (const name of ["forgetPlanes(); floorLooksSoon()", "canopySoon(); glowsSoon()", "skySoon()", "airSoon()", "lifeSoon()", "draftSoon()", "syncRegionLooksSoon()", "dressBlood()"])
    assert.ok(lines.some((l) => l.includes(name)) || main.includes(`quietSave(first, changes, options)) ${name}`), name);
  assert.match(body("repairDecorRegion"), /\{ animater: \{ decorRepair: true \} \}/);
  assert.match(body("repairAllProps"), /decorFixes\.map\(\(u\) => withDeletes\(u, del\)\), \{ animater: \{ decorRepair: true \} \}/);
  // the decoration painter's own hook is not filtered
  assert.doesNotMatch(main.slice(main.indexOf('Hooks.on("updateRegion", (doc, changes, options) => { propSafe("decor region"'), main.indexOf('Hooks.on("deleteRegion", (doc) => { propSafe("decor region gone"')), /quietSave/);
});
test("every trigger asks for decorations too; decorations never free walls", () => {
  // an area (breakAreaThings, from its animation or its damage roll) reads the decorations on its levels
  assert.match(main, /const decor = propSafe\("area decorations", \(\) => decorViews\(scene, area\.levels\)\)/);
  assert.match(main, /propsInArea\(decor, area\.testPoint, grid, type\)/);
  assert.match(main, /tiles: \[\.\.\.[^\]]*decorViews\(scene, target\.level\)\]/);
  assert.match(main, /pick\.tile\.decor/);
  assert.match(main, /slamProps\(doc, a, b, \{ decor: false \}\)\.filter\(\(t\) => !t\.decor\)/);
  assert.match(main, /t\.decor \? askDecor\(/);
  assert.match(main, /groundSlams\(travel, size, \[\.\.\.[^\]]*decorViews\(scene, doc\.level\)\]/);
  assert.match(main, /decorSeen = decorViews\(scene, levels\), decorHit = blastTargets\(\{[^}]*tiles: decorSeen, walls: \[\]/);
  assert.match(main, /tile\.decor \? askDecor\(scene, tile, cause, a\)/);
  // D3: the blast-push site, D11: the blast loop reads the region document
  assert.match(main, /slammed\.map\(\(s\) => \(s\.t\.decor \? askDecor\(scene, s\.t,/);
  assert.match(main, /scene\.regions\.get\(view\.decor\.regionId\)/);
  assert.match(main, /applyDecorBreak\(scene, region, view\.decor\.key, cause, note, game\.user\)/);
  // (a keg tile's blast runs runBlastAt with its own id; a decoration's with its view id)
  assert.match(main, /return runBlastAt\(scene, \{ centre, burst, levels, sourceId: doc\.id \}\);/);
  assert.match(main, /const cause = \{ kind: "blast", sourceId \}, look/);
});

// Task 8: the town and dungeon kinds, the lights, and the live check's fixes.
test("only drawn decorations break (D1): the cavern records what it drew; the triggers, the requester and the GM all ask", () => {
  // I1: what can break comes from what every screen shares, never this screen's Quality, switches or sparks and dust.
  const now = body("decorCaveNow");
  assert.match(now, /decorCaveBreakable\(\{ setting: \(key\) => hotSetting\(key\), webAreas, decorRegions, walls: wallsHere\(\), lights: caveLightShapes\(\), grid: canvas\.grid\.size, seed: sceneId \?\? "cave", index: decorIndex \}\)/);
  assert.match(now, /cavernRegions\(\{ preview: false \}\)/);
  assert.doesNotMatch(now, /bothSettingsOn|localQuality|lampLights|regionStepsOn/);
  assert.doesNotMatch(main, /decorCaveDrawn = \{ sceneId: canvas\.scene\?\.id \?\? null, crystals: bothSettingsOn/);
  assert.doesNotMatch(body("caveLightShapes"), /embersOn|motesOn|bothSettingsOn/);
  assert.match(body("caveLightShapes"), /documentName !== "AmbientLight"/);
  // Each screen draws its webs as main does: on its own floor, wherever the lights it sees reach (a creature's torch
  // included), so no map's webs look different from main's. The shared floor decides only what can break.
  assert.match(main, /const floor = \(pt\) => !lampLights\.length \|\| lampLights\.some\(\(l\) => Array\.isArray\(l\.shape\) && l\.shape\.length >= 6 && pointInPolygon\(pt, l\.shape\)\);/);
  assert.match(main, /laid = webAreas\.length \|\| gone\.length \? webCorners\(\{ walls, areas: \[\.\.\.webAreas, \.\.\.gone\], grid, seed, floor \}\) : \[\];/);
  assert.doesNotMatch(body("rebuildCavern"), /lightFloor\(/);
  assert.match(body("rebuildCavern"), /decorCaveDrawn = null;/);
  assert.match(main, /for \(const hook of \[[^\]]*"updateAmbientLight"[^\]]*"lightingRefresh"[^\]]*\]\) Hooks\.on\(hook, \(first, changes, options\) => \{ if \(!quietSave\(first, changes, options\)\) decorCaveDrawn = null; \}\);/);
  // What this screen draws underground (its own laid-out webs, broken ones' included, and whether it draws crystals):
  // a wreck is drawn only where its decoration was drawn here.
  assert.match(body("rebuildCavern"), /decorDrawnHere = \{ sceneId: canvas\.scene\?\.id \?\? null, crystals: bothSettingsOn\("caveCrystals"\), webs: laid \};/);
  assert.match(body("rebuildCavern"), /propSafe\("decor wrecks", \(\) => syncDecorWrecks\(false\)\)/);
  assert.match(main, /const decorShownHere = \(view\) => \{/);
  assert.match(body("decorShownHere"), /decorDrawn\(view, \{ crystals: here\.crystals, webs: here\.webs, grid: propGrid\(canvas\?\.scene\) \}\)/);
  assert.match(body("syncDecorWrecks"), /if \(view && decorShownHere\(view\)\) \{ wanted\.push/);
  assert.match(body("breakDecorHere"), /const tile = decorShownHere\(view\) \? decorWreckOf\(view, region\.settings\) : null;/);
  assert.match(main, /const corners = keptWebCorners\(laid, \{ keep: webAreas, gone, grid \}\);/);
  assert.match(main, /const gone = bothSettingsOn\("caveWebs"\) \? decor\.websGone \?\? \[\] : \[\]/);
  assert.match(body("decorViews"), /decorTargets\([^\n]*decorDrawnOn\(scene\)\)/);
  assert.match(body("requestDecorBreak"), /drawn: decorDrawnOn\(scene\)/);
  assert.match(body("applyDecorBreak"), /drawn: decorDrawnOn\(scene\)/);
  assert.match(body("decorDrawnOn"), /scene\?\.id && scene\.id === canvas\?\.scene\?\.id \? decorCaveNow\(\) : null/);
});
test("a wreck spills what its decoration held", () => {
  assert.match(main, /const decorContents = \(view\) => view\?\.flags\?\.animater\?\.prop\?\.contents \?\? "none";/);
  // (drawn as stored, broken here, and an ignite played over a spilled wreck)
  assert.equal((main.match(/decorWreckage\.show\(tile, note, decorContents\(view\)/g) ?? []).length, 3);
  assert.doesNotMatch(main, /decorWreckage\.show\(tile, note, "none"/);
  const wreck = readFileSync(new URL("../../../scripts/engines/props/prop-wreck.mjs", import.meta.url), "utf8");
  assert.match(wreck, /cutApart\(\{ tile, d, note, entry, box, texture, tones, centre, sortLayer, animate, contents \}\)/);
  assert.match(wreck, /halves\?\.update\(u\); grow\(u\);/);
});
test("an edit that moved a toppled decoration takes its rubble at once (GM, quiet, not over a write in flight)", () => {
  const prune = body("pruneToppledDecor");
  assert.match(prune, /game\.users\.activeGM\?\.isSelf/);
  assert.match(prune, /queuedDecorKeys\(doc\.id\)\.length/);
  assert.match(prune, /decorToppledPrune\(stored, decorIndex\(region, propGrid\(scene\)\)\.keys, sceneRegions\(scene\), doc\.id\)/);
  assert.match(prune, /\{ animater: \{ decorBreak: true \} \}\);\r?\n  await deletePropRegions\(scene, out\.deleteRegions\);/);
  assert.match(main, /if \(decorOnlySave\(changes, options\) \|\| !\(decorFlagsChanged\(changes\) \|\| "shapes" in \(changes \?\? \{\}\)\)\) return;\r?\n  void pruneToppledDecor\(doc\)/);
});
test("a broken underground crystal or cobweb leaves the cavern and the webs; many at once repaint once (I2)", () => {
  assert.match(main, /const decorRedraw = createDecorRedraw\(\{ redraw: \(\{ cave \}\) => propSafe\("decor redraw", \(\) => \(cave \? rebuildCavern\(\) : syncDecorations\(\)\)\) \}\);/);
  assert.match(main, /const decorRedrawSoon = \(regionId, doc = canvas\?\.scene\?\.regions\?\.get\(regionId\)\) => decorRedraw\.soon\(regionId, \{ cave: doc\?\.flags\?\.\[ID\]\?\.decor\?\.where === "cave" \}\);/);
  // The requester's break and refusal, and every screen's stored write, ask for the repaint; none repaints itself.
  for (const fn of ["breakDecorHere", "refuseDecorHere"]) { assert.match(body(fn), /decorRedrawSoon\(/, fn); assert.doesNotMatch(body(fn), /syncDecorations\(\)|rebuildCavern\(\)/, fn); }
  assert.match(main, /if \(decorOnlySave\(changes, options\)\) decorRedrawSoon\(doc\.id, doc\); else syncDecorations\(\);\r?\n  syncDecorWrecks\(options\?\.animater\?\.decorBreak === true\);/);
  assert.doesNotMatch(main, /decorCaveFollows/);
  // The wreck still plays at once.
  assert.match(body("breakDecorHere"), /decorRedrawSoon\(regionDoc\.id, regionDoc\);[^]*decorWreckage\.show\(tile, note, decorContents\(view\), \{ animate: true \}\)/);
});
test("final review minors: Repair waits for the writes and holds them (M1), walls skip decorations (M2), the memo forgets (M6), a write prunes (M7)", () => {
  assert.match(body("holdDecorWrites"), /await decorQueue\.idle\(\)/);
  assert.match(main, /const decorQueue = createDecorQueue\(\{[^]*?write: async \(regionDoc, adds\) => \{\r?\n  await decorRepairFree;/);
  // Holds are counted: a write waits until the last of overlapping repairs has landed.
  assert.match(body("holdDecorWrites"), /if \(decorRepairHolds\+\+ === 0\) decorRepairFree = new Promise/);
  assert.match(body("holdDecorWrites"), /finally \{ if \(--decorRepairHolds === 0\) releaseDecorRepairs\(\); \}/);
  assert.match(body("repairDecorRegion"), /holdDecorWrites\(/);
  assert.match(body("repairAllProps"), /await holdDecorWrites\(async \(\) => \{\r?\n    const decorFixes = decorRepairUpdates\(sceneRegions\(scene\)\);/);
  assert.match(main, /function slamProps\(doc, a, b, \{ decor = true \} = \{\}\)/);
  assert.match(body("slamProps"), /\.\.\.\(decor \? decorViews\(scene, doc\.level\) : \[\]\)/);
  assert.match(main, /Hooks\.on\("deleteRegion", \(doc\) => \{ decorIndex\.forget\(doc\.id\);/);
  assert.match(main, /decorWrecksShown\.clear\(\); decorPending\.clear\(\); decorLate\.clear\(\); decorWreckage\.clear\(\); decorIndex\.clear\(\);/);
  assert.match(body("applyDecorBreak"), /void pruneToppledDecor\(regionDoc\)\.catch\(/);
  // The live check's look at what this screen lets break (any user; read-only).
  assert.match(main, /decorBreakable: \(regionId\) => \{[^]*?decorTargets\(\[region\], propGrid\(scene\), decorIndex, decorDrawnOn\(scene\)\)/);
});

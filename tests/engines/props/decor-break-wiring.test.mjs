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
  const at = main.indexOf(`function ${name}(`);
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
test("invisible decorations neither break nor draw wrecks (D7)", () => {
  assert.match(body("decorViews"), /!propsOn\(scene\) \|\| !regionStepsOn\(\)/);
  assert.match(body("syncDecorWrecks"), /regionStepsOn\(\)/);
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
  assert.match(main, /propsInArea\(decorViews\(scene, area\.levels\), area\.testPoint/);
  assert.match(main, /tiles: \[\.\.\.[^\]]*decorViews\(scene, target\.level\)\]/);
  assert.match(main, /pick\.tile\.decor/);
  assert.match(main, /slamProps\(doc, a, b\)\.filter\(\(t\) => !t\.decor\)/);
  assert.match(main, /t\.decor \? askDecor\(/);
  assert.match(main, /groundSlams\(travel, size, \[\.\.\.[^\]]*decorViews\(scene, doc\.level\)\]/);
  assert.match(main, /decorSeen = decorViews\(scene, levels\), decorHit = blastTargets\(\{[^}]*tiles: decorSeen, walls: \[\]/);
  assert.match(main, /tile\.decor \? askDecor\(scene, tile, cause, a\)/);
  // D3: the blast-push site, D11: the blast loop reads the region document
  assert.match(main, /slammed\.map\(\(s\) => \(s\.t\.decor \? askDecor\(scene, s\.t,/);
  assert.match(main, /scene\.regions\.get\(view\.decor\.regionId\)/);
  assert.match(main, /applyDecorBreak\(scene, region, view\.decor\.key, cause, note, game\.user\)/);
  assert.match(main, /const cause = \{ kind: "blast", sourceId: doc\.id \}, look/);
});

// Task 8: the town and dungeon kinds, the lights, and the live check's fixes.
test("only drawn decorations break (D1): the cavern records what it drew; the triggers, the requester and the GM all ask", () => {
  assert.match(main, /decorCaveDrawn = \{ sceneId: canvas\.scene\?\.id \?\? null, crystals: bothSettingsOn\("caveCrystals"\), webs: bothSettingsOn\("caveWebs"\) \? corners : \[\] \}/);
  assert.match(main, /const corners = webAreas\.length \? webCorners\(\{ walls, areas: webAreas, grid, seed, floor \}\) : \[\];/);
  assert.match(body("decorViews"), /decorTargets\([^\n]*decorDrawnOn\(scene\)\)/);
  assert.match(body("requestDecorBreak"), /drawn: decorDrawnOn\(scene\)/);
  assert.match(body("applyDecorBreak"), /drawn: decorDrawnOn\(scene\)/);
  assert.match(main, /decorCaveDrawn\?\.sceneId && decorCaveDrawn\.sceneId === scene\?\.id \? decorCaveDrawn : \{\}/);
});
test("a wreck spills what its decoration held", () => {
  assert.match(main, /const decorContents = \(view\) => view\?\.flags\?\.animater\?\.prop\?\.contents \?\? "none";/);
  assert.equal((main.match(/decorWreckage\.show\(tile, note, decorContents\(view\)/g) ?? []).length, 2);
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
test("a broken underground crystal or cobweb leaves the cavern and the webs (a quiet write rebuilds them for a cave region)", () => {
  assert.match(main, /const decorCaveFollows = \(regionDoc\) => \{ if \(regionDoc\?\.flags\?\.\[ID\]\?\.decor\?\.where === "cave"\) propSafe\("decor cavern", \(\) => rebuildCavern\(\)\); \};/);
  assert.match(main, /syncDecorWrecks\(options\?\.animater\?\.decorBreak === true\);\r?\n  if \(decorOnlySave\(changes, options\)\) decorCaveFollows\(doc\);/);
  assert.match(body("breakDecorHere"), /syncDecorations\(\); decorCaveFollows\(regionDoc\);/);
  assert.match(body("refuseDecorHere"), /decorCaveFollows\(/);
});

import {catalogAuditEntries,auditScope} from './catalog-audit-entries.mjs';
import {PF2E_STATE_SOURCE} from '../scripts/catalogs/pf2e/state-catalog.mjs';
// Cross-catalog ledger. Fine configuration counts are never presented as
// bespoke animation counts; quantized media/topology signatures are separate.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { assetDatabases, variantFiles } from "./asset-databases.mjs";
import { assetGeometry } from "./spell-asset-selection.mjs";
import { soundInventory } from "./sound-databases.mjs";
import { PF2E_SPELLS, PF2E_SOURCE, spellRecipe } from "../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, PF2E_FEAT_SOURCE, featRecipe } from "../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, PF2E_WEAPON_SOURCE, weaponRecipe } from "../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { installedSoundCatalog, SPELL_SOUND_DESIGNS } from "../scripts/engines/sound/spell-sounds.mjs";
import { FEAT_SOUND_DESIGNS, WEAPON_SOUND_DESIGNS } from "../scripts/engines/sound/ability-sounds.mjs";
import { planRecipe, resolveAsset } from "../scripts/core/model.mjs";
import { recipeDuration } from "../scripts/engines/playback/choreography.mjs";
import { GENERATED_MOTION_DURATION } from "../scripts/engines/motion/motion-pacing.mjs";
import { visualFingerprint } from "./design-audit.mjs";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const q = (n, step) => Math.round((Number(n) || 0) / step) * step;
export function meaningfulFingerprint(recipe, rows, { familyOnly = false } = {}) {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const visual = recipe.stages.filter(s => s.kind !== "sound");
  return hash(visual.map(s => {
    const row = byKey.get(resolveAsset(s, rows));
    const result = {
      kind: s.kind, subject: s.subject, target: s.targetSelection, limit: s.targetLimit, requiresHit:s.requiresHit,
      delay: q(s.delay, 250), duration: q(s.duration, 500), after: visual.findIndex(p => p.stageId === s.afterStage), anchor: s.afterStage ? s.timingAnchor : undefined,
      repeat: [s.repeats, q(s.repeatInterval, 200), s.repeatScope, q(s.targetStagger, 200)],
    };
    if (s.kind === "motion") return { ...result, motion: s.motion, range: s.motionRange, heading: s.motionHeading, endpoint: s.motionEndpoint, distance: q(s.distance, s.motionRange === "target" ? 1 : .1), intensity: q(s.intensity, .2), arrival: q(s.motionArrival, 5), hold: q(s.motionHold, 5), jumpHeight: q(s.jumpHeight, .2), arrivalLift: q(s.arrivalLift, .2), side: s.motionSide };
    const media = row ? (familyOnly ? `${row.key.split(".")[1]}:${assetGeometry(row)}` : variantFiles(row).map(file => basename(file)).sort()) : s.kind === "sprite" ? "token-copy" : "missing";
    return { ...result, media, scale: q(s.scale, .25), opacity: q(s.opacity, .25), hue: familyOnly ? undefined : q(s.hue, 30), tint: !familyOnly && s.tintEnabled ? s.tint : undefined, saturation: q(s.saturation, .25), glow: Boolean(s.glow), below: s.below, attach: s.kind === "aura" || s.attach, origin: ["travel", "projectile"].includes(s.kind) ? s.travelOrigin : undefined, destination: ["travel", "projectile"].includes(s.kind) ? s.travelDestination : undefined, layout: s.kind === "template" || ["travel","projectile"].includes(s.kind) && s.travelDestination === "area" ? s.areaLayout : undefined, fanCount: s.areaLayout === "fan" ? s.fanCount : undefined, fanColors: !familyOnly && s.fanColors?.length ? s.fanColors : undefined, offsetUnits:s.offsetUnits, copies: s.kind === "sprite" ? s.copies : undefined, shot: s.oneShot,
      offset: [q(s.offsetX, .25), q(s.offsetY, .25)], rotation: q(s.rotation, 30), mirrors: [s.mirrorX, s.mirrorY],
      entrance: [q(s.fadeIn, 250), s.scaleInDuration ? [q(s.scaleIn, .25), q(s.scaleInDuration, 250)] : undefined],
      tracks: (s.tracks ?? []).map(t => ({ property: t.property, from: q(t.from, t.property === "rotation" ? 30 : .2), to: q(t.to, t.property === "rotation" ? 30 : .2), duration: q(t.duration, 250), delay: q(t.delay, 250), loop: t.loop, pingPong: t.pingPong, fromEnd: t.fromEnd, ease: t.ease })),
    };
  }));
}

async function audit() {
  const libraries = await assetDatabases(), inventory = await soundInventory();
  const dataRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const modules = new Map(inventory.packs.map(pack => [pack.module, { active: pack.files > 0 }]));
  const soundKeys = new Map();
  for (const row of inventory.entries) if (row.key) soundKeys.set(row.key, [...(soundKeys.get(row.key) ?? []), row.file]);
  const sounds = installedSoundCatalog(modules, { entryExists: key => soundKeys.has(key), getAllFileEntries: key => soundKeys.get(key) });
  const full=process.argv.includes('--full');
  const entries=catalogAuditEntries().filter(e=>full||['spell','feat','weapon'].includes(e.domain));
  const domains=[...new Set(entries.map(e=>e.domain))];
  const source = { id: "source", center: { x: 100, y: 100 }, w: 100, h: 100 }, targets = [300, 500, 700].map((x, i) => ({ id: `target-${i}`, center: { x, y: 100 + i * 100 }, w: 100, h: 100 }));
  const rows = [], issues = [], editions = {};
  for (const [edition, db] of Object.entries(libraries)) {
    const keys = new Map(db.map(row => [row.key, row])), used = new Set(), variants = new Set(), families = new Set(), byKey = new Map();
    const groups = Object.fromEntries(domains.map(domain => [domain, { exact: new Map(), meaningful: new Map(), family: new Map() }]));
    for (const entry of entries) {
      const { domain, item, mode } = entry;
      const recipe = entry.build({ sounds, soundCatalog: sounds, catalog:db });
      const areaType = recipe.previewArea?.type, length = (recipe.previewArea?.value ?? 15) * 20;
      const area = ["line", "cone"].includes(areaType) ? { type: areaType, center: source.center, endpoint: { x: source.center.x + length, y: source.center.y }, length, width: 100, angle: 90 } : { type: ["cube", "square"].includes(areaType) ? "square" : "circle", center: targets[0].center, diameter: length * (["cube", "square"].includes(areaType) ? 1 : 2) };
      const record = { domain, id: item.id, name: item.name, mode, edition, sourcePath: item.path, descriptionChars: item.design?.descriptionChars ?? item.descriptionChars ?? item.plainDescription?.length ?? item.description?.length ?? 0, descriptionHash: item.descriptionHash ?? item.design?.descriptionHash, descriptionAnalysis: item.design?.analysis ?? item.review?.method ?? "native-fields-and-description-rules", evidence: item.evidence ?? item.design?.evidence, motif: item.design?.motif ?? item.motif, rationale: item.design?.rationale ?? item.rationale, notes: item.notes, quality: item.quality, area: recipe.previewArea, trigger: recipe.trigger, stages: recipe.stages.length, duration: recipeDuration(recipe), soundProfile: entry.sound?.profile, media: [], motion: [], sounds: [] };
      try {
        for (const targetCount of [1, 3]) planRecipe(recipe, db, { source, targets: targets.slice(0, targetCount), template: { id: "native-area" }, area, gridSize: 100 });
      } catch (error) { issues.push({ domain, id: item.id, name: item.name, mode, edition, code: "invalid-plan", reason: error.message }); }
      for (const stage of recipe.stages) {
        if (stage.kind === "motion") {
          record.motion.push({ motion: stage.motion, duration: stage.duration, distance: stage.distance, intensity: stage.intensity, subject: stage.subject, range: stage.motionRange, heading: stage.motionHeading, endpoint: stage.motionEndpoint });
          if (stage.duration < (GENERATED_MOTION_DURATION[stage.motion] ?? 0)) issues.push({ domain, id: item.id, name: item.name, mode, edition, code: "short-motion", stage: stage.label, duration: stage.duration });
          continue;
        }
        if (stage.kind === "sound") { record.sounds.push({ file: stage.soundFile, volume:stage.volume, gain:stage.optionalSound?.gain, profile: stage.optionalSound?.profile, repeats: stage.repeats, interval: stage.repeatInterval, after: stage.afterStage }); if (!existsSync(resolve(dataRoot, stage.soundFile))) issues.push({ domain, id: item.id, name: item.name, mode, code: "missing-sound-file", file: stage.soundFile }); continue; }
        if (stage.kind === "sprite") continue;
        const key = resolveAsset(stage, db), row = keys.get(key);
        if (!row) { issues.push({ domain, id: item.id, name: item.name, mode, edition, code: "missing-asset", stage: stage.label }); continue; }
        used.add(key); families.add(key.split(".")[1]);
        byKey.set(key, (byKey.get(key) ?? 0) + 1);
        for (const file of variantFiles(row)) variants.add(file);
        const geometry = assetGeometry(row), local = ["cast", "impact", "aura"].includes(stage.kind);
        const valid = local ? geometry === "radial" : stage.kind === "travel" ? ["beam", "line", "projectile"].includes(geometry) : stage.kind === "projectile" ? geometry === "radial" : stage.kind !== "template" || (areaType === "cone" ? geometry === "cone" : areaType === "line" ? stage.areaLayout === "tiles" ? geometry === "radial" : ["beam", "line", "projectile", "wall"].includes(geometry) : ["radial", "wall"].includes(geometry));
        if (!valid) issues.push({ domain, id: item.id, name: item.name, mode, edition, code: "geometry-mismatch", stage: stage.label, kind: stage.kind, key, geometry });
        record.media.push({ stage: stage.label, kind: stage.kind, key, geometry, scale: stage.scale, hue: stage.hue, tint: stage.tintEnabled ? stage.tint : null, saturation: stage.saturation, variants: variantFiles(row).length, files: variantFiles(row) });
      }
      const identities = { exact: visualFingerprint({ ...recipe, stages: recipe.stages.filter(s => s.kind !== "sound") }, db), meaningful: meaningfulFingerprint(recipe, db), family: meaningfulFingerprint(recipe, db, { familyOnly: true }) };
      Object.assign(record, { fingerprints: identities });
      for (const [kind, fp] of Object.entries(identities)) { const group = groups[domain][kind]; group.set(fp, [...(group.get(fp) ?? []), { id: item.id, name: item.name, mode }]); }
      rows.push(record);
    }
    const usage = Object.fromEntries(domains.map(domain => {
      const selected = rows.filter(row => row.edition === edition && row.domain === domain), media = selected.flatMap(row => row.media);
      return [domain, { entries: selected.length, selectedKeys: new Set(media.map(m => m.key)).size, selectedVariantFiles: new Set(media.flatMap(m => m.files)).size, selectedFamilies: new Set(media.map(m => m.key.split(".")[1])).size, nativeColorTokens: [...new Set(media.flatMap(m => m.key.split(".").filter(part => /^(?:dark_|bright_)?(?:red|blue|green|yellow|orange|purple|pink|white|black|brown|grey|gray|rainbow|gold|silver|teal|multicolored)+$/i.test(part))))].sort(), filteredColorStages: media.filter(m => m.tint || m.hue || m.saturation !== 0).length, motionRecipes: selected.filter(row => row.motion.length).length, motionStages: selected.reduce((sum, row) => sum + row.motion.length, 0), motionTypes: [...new Set(selected.flatMap(row => row.motion.map(m => m.motion)))].sort(), soundRecipes: selected.filter(row => row.sounds.length).length, selectedSoundFiles: new Set(selected.flatMap(row => row.sounds.map(s => s.file))).size, selectedSoundProfiles: [...new Set(selected.map(row => row.soundProfile).filter(Boolean))].sort() }];
    }));
    editions[edition] = { inventoryKeys: db.length, inventoryHash: hash(db), inventorySource: edition === "free" ? "https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/scripts/jb2a_sequencer.js" : "modules/jb2a_patreon/scripts/jb2a_sequencer.js", selectedKeys: used.size, selectedVariantFiles: variants.size, selectedFamilies: families.size, families: [...families].sort(), usage, mostReused: [...byKey].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([key, stages]) => ({ key, stages })), domains: Object.fromEntries(Object.entries(groups).map(([domain, sets]) => [domain, Object.fromEntries(Object.entries(sets).map(([kind, map]) => [kind, { distinct: map.size, sharedGroups: [...map.values()].filter(items => items.length > 1).sort((a, b) => b.length - a.length).map(items => ({ count: items.length, items })) }]))])) };
  }
  const report = { date: "2026-10-07", sources: { spell: PF2E_SOURCE.sha, feat: PF2E_FEAT_SOURCE.sha, weapon: PF2E_WEAPON_SOURCE.sha, ...(full?{state:PF2E_STATE_SOURCE.sha}:{}) }, scope: { ...(full?{allRecipes:auditScope()}:{}), spells: PF2E_SPELLS.length, activeFeats: PF2E_FEATS.length, weapons: PF2E_WEAPONS.length, weaponUses: entries.filter(e => e.domain === "weapon").length }, methodology: { automated: "Every included catalog recipe, both JB2A inventories, 1 and 3 targets, native sample area shape, active installed sound providers. Per-entry media, motion and audio ledger.", meaningful: "Selected actual random/distance filenames, topology, medium-scale visual differences. Timing quantized to 250/500 ms; scale/opacity 0.25; motion intensity 0.2; hue 30 degrees. Includes property tracks, entrances, offsets and headings. Labels and sound do not differentiate visual identity.", family: "Same quantized topology, colors ignored and actual files replaced by JB2A family+geometry. Reveals shared visual structures even when colored footage differs.", limitations: "These signatures measure observable configuration, not subjective artistic similarity. Shared attack/media families are expected. Programmatic full-description analysis is separate from individually reading every description or watching every recipe. Non-weapon equipment is outside existing weapons catalog." }, soundPacks: inventory.packs, editions, issues, records: rows };
  await writeFile(new URL(`../data/${full?'full':'deep'}-catalog-audit-2026-10-07.json`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ scope: report.scope, issues: issues.slice(0, 25), issueCount: issues.length, editions: Object.fromEntries(Object.entries(editions).map(([edition, value]) => [edition, { ...value, domains: Object.fromEntries(Object.entries(value.domains).map(([domain, sets]) => [domain, Object.fromEntries(Object.entries(sets).map(([kind, set]) => [kind, set.distinct]))])), families: undefined, mostReused: undefined }])) }, null, 2));
  if (issues.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await audit();

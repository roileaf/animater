// Rule-based quality audit of the D&D 5e catalog. Joins each catalog entry with
// its native source (activity, damage, healing, area, duration, range) and the
// recipe that actually plays (bespoke designs included), then flags semantic
// defects. Writes data/dnd5e-audit.json (git-ignored) and prints a summary.
//   node tools/audit-dnd5e-catalog.mjs [--kind=spell] [--rule=HEAL_HOSTILE_MOTION] [--list=40]
import { writeFile } from "node:fs/promises";
import { dnd5eSources } from "./dnd5e-source.mjs";
import { assetDatabases } from "./asset-databases.mjs";
import { assetGeometry } from "./spell-asset-selection.mjs";
import { dndEntries, dndRecipe } from "../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const data = await dnd5eSources(), db = await assetDatabases();
const rowsByUuid = new Map(Object.values(data).filter(Array.isArray).flat().filter((r) => r?.uuid).map((r) => [r.uuid, r]));
const rowByKey = new Map([...db.free, ...db.patreon].map((r) => [r.key, r]));
const geometryOf = (key) => { const r = rowByKey.get(key); return r ? assetGeometry(r) : "unknown"; };
// Art shape each native template shape needs.
const SHAPE_FITS = { cone: ["cone"], line: ["line", "beam"], wall: ["wall", "line", "beam"], radius: ["radial"], sphere: ["radial"], cylinder: ["radial"], emanation: ["radial"], cube: ["radial"], square: ["radial"], circle: ["radial"] };
const reviewed = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../data/dnd5e-native-directions.json", import.meta.url), "utf8"));
const reviewedBy = new Map(reviewed.directions.map((d) => [`${d.uuid}::${d.activityId}`, d]));
const families = new Set([...db.patreon, ...db.free].map((r) => r.key.split(".")[1]));
const snake = (s) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// JB2A families named after a specific spell/feature (excluding generic words).
const GENERIC_FAMILIES = new Set(["shield", "light", "darkness", "web", "fog_cloud", "sleep", "fear", "bless", "aid", "haste", "slow", "heroism", "sanctuary", "invisibility", "levitate", "jump", "knock", "message", "grease", "entangle", "barkskin", "thunderwave", "teleport", "portal", "explosion", "impact", "healing_generic"]);
const namedFamily = new Map();
for (const e of dndEntries()) { const f = snake(e.name); if (e.kind === "spell" && families.has(f) && !GENERIC_FAMILIES.has(f)) namedFamily.set(f, e.name); }
const HOSTILE_MOTION = new Set(["lunge", "recoil", "stagger", "press", "slam", "rush", "leap", "shake"]);
const BIG_BOOM = /^(fireball\.explosion|explosion\.0[1-9]|explosion\.side_impact|thunderwave|shatter|meteor)/;
const GENERIC_ART = /^(dancing_light|magic_signs|cast_generic|cast_shape|glint|swirling_sparkles|token_border|detect_magic|markers|condition)\b/;
const MULTI = /\b(three|four|five|3|4|5)\s+(glowing\s+)?(darts|rays|beams|bolts|motes|orbs|missiles|arrows)\b|\bcreate(s)?\s+(three|3)\s+rays\b|each\s+(dart|ray|beam|bolt)\b/i;
const minutes = (d) => ({ minute: 1, hour: 60, day: 1440, round: 0.1 }[d?.units] ?? 0) * (Number(d?.value) || 1);

function audit(entry, variant) {
  const row = rowsByUuid.get(entry.uuid), sys = row?.source?.system ?? {};
  const acts = row?.effectiveActivities ?? row?.activities ?? [];
  const act = acts.find((a) => a._id === variant.activityId) ?? acts[0] ?? {};
  let recipe;
  try { recipe = dndRecipe(entry, variant.id, {}); } catch (e) { return [{ rule: "BUILD_ERROR", note: e.message }]; }
  const visual = recipe.stages.filter((s) => !["sound", "motion"].includes(s.kind));
  const fams = visual.flatMap((s) => s.assets.map((a) => a.split(".").slice(1).join(".")));
  const motions = recipe.stages.filter((s) => s.kind === "motion");
  const damage = (act.damage?.parts ?? []).flatMap((p) => p.types ?? []);
  const heals = act.type === "heal" || !!act.healing?.number || /\bregains?\b.*\bhit points\b/i.test(entry.descriptionText ?? "");
  const hostile = damage.length > 0 || ["attack", "save"].includes(act.type);
  const template = sys.target?.template?.type || act.target?.template?.type || "";
  const selfRange = (sys.range?.units ?? act.range?.units) === "self";
  const lasting = minutes(sys.duration) >= 1 || (sys.properties ?? []).includes("concentration");
  const text = entry.descriptionText ?? "";
  const out = [];
  const flag = (rule, note) => out.push({ rule, note });
  if (heals && !damage.length && motions.some((m) => HOSTILE_MOTION.has(m.motion))) flag("HEAL_HOSTILE_MOTION", `healing plays ${motions.map((m) => m.motion).join("+")}`);
  if (!hostile && !heals && entry.kind === "spell" && motions.some((m) => m.subject === "targets" && ["recoil", "stagger"].includes(m.motion))) flag("BUFF_HOSTILE_MOTION", `non-hostile spell makes targets ${motions.map((m) => m.motion).join("+")}`);
  if (entry.kind === "spell" && entry.level === 0 && visual.some((s) => s.kind === "impact" && s.assets.some((a) => BIG_BOOM.test(a.replace(/^jb2a\./, ""))))) flag("CANTRIP_BIG_BOOM", "cantrip ends in a large explosion");
  if (MULTI.test(text) && !recipe.stages.some((s) => ["travel", "projectile"].includes(s.kind) && (s.repeats ?? 1) > 1) && recipe.stages.filter((s) => ["travel", "projectile"].includes(s.kind)).length < 2) flag("MULTI_MISSILE", "description has several missiles/rays; recipe fires one");
  if (selfRange && /radius|sphere|emanation|cylinder/.test(template) && lasting && !recipe.stages.some((s) => s.kind === "aura" || (s.kind === "template" && s.persist))) flag("SELF_AURA_ONESHOT", `lasting ${template} around the caster plays as a one-off`);
  if (template && !selfRange && hostile && !recipe.stages.some((s) => s.kind === "template")) flag("AREA_NO_TEMPLATE", `${template} area with no area stage`);
  // Area spells: the template's own shape must be drawn by art of that shape.
  const actTemplate = act.target?.template?.type || "", followupLike = /start of turn|end of turn|enter|ongoing|subsequent|move|repeat|each turn/i.test(variant.label + " " + (act.name ?? ""));
  if (entry.kind === "spell" && actTemplate && SHAPE_FITS[actTemplate] && !followupLike) {
    const areaStages = recipe.stages.filter((s) => s.kind === "template");
    if (!areaStages.length) flag("TEMPLATE_NO_AREA", `${actTemplate} template but no area stage`);
    else for (const s of areaStages) { const geo = geometryOf(s.assets[0]); if (s.areaLayout !== "tiles" && !SHAPE_FITS[actTemplate].includes(geo)) flag("TEMPLATE_SHAPE", `${actTemplate} template drawn with ${geo} art (${(s.assets[0] ?? "").replace(/^jb2a./, "")})`); }
  }
  // A reviewed ray/beam/missile must actually travel from the caster.
  const review = reviewedBy.get(`${entry.uuid}::${variant.activityId}`);
  const travels = recipe.stages.some((s) => ["travel", "projectile"].includes(s.kind));
  if (review && ["beam", "projectile", "missile", "ray"].includes(review.delivery) && !review.followup && !travels) flag("DELIVERY_LOST", `reviewed ${review.delivery} has no travelling stage${recipe.bespoke ? " (bespoke " + recipe.bespoke + ")" : ""}`);
  if (!review && /^(?:ray|bolt|beam)|(?:ray|bolt|beam|missile|dart)s?$/i.test(entry.name) && act.type === "attack" && !travels) flag("DELIVERY_LOST", `named ${entry.name} attack with no travelling stage${recipe.bespoke ? " (bespoke)" : ""}`);
  if (!review && act.type === "attack" && act.attack?.type?.value === "ranged" && !["self", "touch"].includes(act.range?.units ?? sys.range?.units) && !travels && entry.kind === "spell") flag("DELIVERY_LOST", `ranged spell attack with no travelling stage${recipe.bespoke ? " (bespoke)" : ""}`);
  const own = snake(entry.name);
  if (families.has(own) && !fams.some((f) => f.split(".")[0] === own)) flag("NAMED_ART_UNUSED", `JB2A has ${own} art; unused`);
  for (const f of new Set(fams.map((f) => f.split(".")[0]))) if (namedFamily.has(f) && namedFamily.get(f) !== entry.name && !own.includes(f)) flag("FOREIGN_NAMED_ART", `uses ${f} (art for ${namedFamily.get(f)})`);
  if (!["condition", "effect"].includes(entry.kind) && visual.length && visual.every((s) => s.assets.every((a) => GENERIC_ART.test(a.replace(/^jb2a\./, ""))))) flag("GENERIC_ONLY", "only generic placeholder art");
  if (hostile && visual.length <= 1 && !["weapon", "condition", "effect"].includes(entry.kind)) flag("THIN_HOSTILE", `hostile activity with ${visual.length} visual stage(s)`);
  return out.map((f) => ({ ...f, entry: entry.name, kind: entry.kind, edition: entry.edition, variant: variant.label, id: entry.id, variantId: variant.id, stages: visual.map((s) => `${s.kind}:${(s.assets[0] ?? "").replace(/^jb2a\./, "")}`).join(" → ") }));
}

const kind = arg("kind"), only = arg("rule"), list = Number(arg("list") ?? 25);
const findings = [];
for (const entry of dndEntries()) if (!kind || entry.kind === kind) for (const variant of entry.variants) findings.push(...audit(entry, variant));
const byRule = {};
for (const f of findings) (byRule[f.rule] ??= []).push(f);
await writeFile(new URL("../data/dnd5e-audit.json", import.meta.url), JSON.stringify({ generated: new Date().toISOString(), counts: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, v.length])), findings }, null, 1));
for (const [rule, items] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
  if (only && rule !== only) continue;
  const byKind = items.reduce((m, f) => ((m[f.kind] = (m[f.kind] ?? 0) + 1), m), {});
  console.log(`\n${rule}: ${items.length}  ${JSON.stringify(byKind)}`);
  for (const f of items.slice(0, list)) console.log(`  ${f.entry} (${f.edition}${f.variant !== "Cast" ? ", " + f.variant : ""}): ${f.note} | ${f.stages}`);
}

// Daggerheart card designs: a compact record per domain card, authored from the card's own text
// (data/daggerheart-card-designs/<domain>.mjs, guide in docs/daggerheart-designs/README.md), turned
// into recipe stages with the bespoke stage builders (scripts/catalogs/bespoke/helpers.mjs) the PF2e, SF2e and
// D&D per-entry designs use. Cards without a record keep the domain palette rules
// (daggerheart-catalog.mjs cardStages). Pure: no Foundry globals.
import { cast, travel, impact, aura, sprite, motion, tint } from "../bespoke/helpers.mjs";
import { MOTIONS } from "../../core/model.mjs";

// What the card does, which sets where each layer lands by default and whether targets are required.
export const DESIGN_SHAPES = Object.freeze({
  bolt: "A shot from the caster to the target",
  beam: "A sustained ray from the caster to the target",
  cone: "A spray from the caster over the targets",
  burst: "A blast around the caster that reaches the targets",
  aura: "A lasting layer on the caster",
  buff: "A boon laid on an ally (or the caster when nobody is targeted)",
  heal: "Mending on an ally (or the caster)",
  summon: "Something appears near the caster",
  teleport: "The caster vanishes and reappears",
  ward: "A protection raised on the caster",
  wall: "A barrier raised by the caster",
  debuff: "A hindrance laid on the target",
  utility: "A quiet effect on the caster",
});
// Shapes whose contact needs a target; the rest play with no target and skip any target layer.
const TARGETED = new Set(["bolt", "beam", "cone", "debuff"]);
// Shapes that land their impact and aura on the caster unless a layer says `on: "targets"`.
const SELF = new Set(["burst", "aura", "summon", "teleport", "ward", "wall", "utility"]);
export const DESIGN_ROLES = Object.freeze(["cast", "travel", "impact", "aura"]);
const LAYER_OPTIONS = new Set(["assets", "on", "at", "duration", "scale", "opacity", "below", "above", "tint", "label", "repeats", "repeatInterval",
  "travelOrigin", "targetSelection", "targetStagger", "offsetY", "offsetUnits", "fadeIn", "fadeOut", "playbackRate", "role"]);
const COPY_OPTIONS = new Set(["count", "spread", "opacity", "at", "duration"]);
const MOTION_OPTIONS = new Set(["motion", "subject", "at", "duration", "intensity", "distance"]);
const RECORD_FIELDS = new Set(["shape", "motif", "notes", "tint", "scale", "cast", "travel", "impact", "aura", "extra", "copies", "motion", "use", "sameAs", "actions"]);
const NESTED_ONLY_TOP = ["use", "sameAs", "actions"];
const ACTION_ID = /^[A-Za-z0-9]{16}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const KEY = /^(jb2a\.)?[a-z0-9_]+(\.[A-Za-z0-9_-]+)*$/;

const asLayer = (value) => (Array.isArray(value) ? { assets: value } : value);
const asList = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

// Problems with one record (empty when valid). `use` and each of `actions` (per-action designs keyed by
// the action's id) are nested records without `use`, `sameAs` or `actions`; a per-action one quotes the card.
export function validateCardDesign(record, { nested = false, quoted = !nested } = {}) {
  const problems = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["record must be an object"];
  for (const field of Object.keys(record)) if (!RECORD_FIELDS.has(field) || (nested && NESTED_ONLY_TOP.includes(field))) problems.push(`unknown field ${field}`);
  if (!Object.hasOwn(DESIGN_SHAPES, record.shape)) problems.push(`shape ${JSON.stringify(record.shape)}`);
  if (typeof record.motif !== "string" || !record.motif.trim()) problems.push("motif missing");
  if (quoted && (typeof record.notes !== "string" || !/["“][^"”]{3,}["”]/.test(record.notes))) problems.push("notes must quote the card's key phrase");
  if (!quoted && record.notes !== undefined && typeof record.notes !== "string") problems.push("notes must be text");
  if (record.tint !== undefined && !HEX.test(record.tint)) problems.push(`tint ${record.tint}`);
  if (record.scale !== undefined && !(record.scale >= 0.3 && record.scale <= 2)) problems.push(`scale ${record.scale}`);
  if (record.sameAs !== undefined && !/^[A-Za-z0-9]{16}$/.test(record.sameAs)) problems.push(`sameAs ${record.sameAs}`);
  const layer = (value, where, role) => {
    const l = asLayer(value);
    if (!l || typeof l !== "object") return problems.push(`${where}: layer must be a key list or an object`);
    for (const option of Object.keys(l)) if (!LAYER_OPTIONS.has(option)) problems.push(`${where}: unknown option ${option}`);
    if (!Array.isArray(l.assets) || !l.assets.length || l.assets.length > 8) problems.push(`${where}: 1–8 assets`);
    else for (const key of l.assets) if (typeof key !== "string" || !KEY.test(key)) problems.push(`${where}: asset ${JSON.stringify(key)}`);
    if (role !== undefined && !DESIGN_ROLES.includes(role)) problems.push(`${where}: role ${JSON.stringify(role)}`);
    if (l.on !== undefined && !["self", "targets"].includes(l.on)) problems.push(`${where}: on ${l.on}`);
    if (l.tint !== undefined && l.tint !== false && !HEX.test(l.tint)) problems.push(`${where}: tint ${l.tint}`);
    for (const n of ["at", "duration", "scale", "opacity", "repeats", "repeatInterval"]) if (l[n] !== undefined && !Number.isFinite(l[n])) problems.push(`${where}: ${n}`);
  };
  if (record.cast !== undefined && record.cast !== false) layer(record.cast, "cast");
  for (const role of ["travel", "impact", "aura"]) if (record[role] !== undefined) layer(record[role], role);
  if (record.extra !== undefined && !Array.isArray(record.extra)) problems.push("extra must be a list");
  for (const [i, l] of asList(record.extra).entries()) layer(l, `extra[${i}]`, l?.role);
  for (const [i, m] of asList(record.motion).entries()) {
    if (!m || typeof m !== "object") { problems.push(`motion[${i}] must be an object`); continue; }
    for (const option of Object.keys(m)) if (!MOTION_OPTIONS.has(option)) problems.push(`motion[${i}]: unknown option ${option}`);
    if (!Object.hasOwn(MOTIONS, m.motion) || ["path", "fragments"].includes(m.motion)) problems.push(`motion[${i}]: ${m.motion}`);
    if (!["source", "targets"].includes(m.subject)) problems.push(`motion[${i}]: subject ${m.subject}`);
  }
  if (record.copies !== undefined) {
    const c = record.copies;
    if (!c || typeof c !== "object" || Array.isArray(c)) problems.push("copies must be an object");
    else {
      for (const option of Object.keys(c)) if (!COPY_OPTIONS.has(option)) problems.push(`copies: unknown option ${option}`);
      if (!(Number.isInteger(c.count) && c.count >= 1 && c.count <= 6)) problems.push("copies: count 1–6");
    }
  }
  if (!DESIGN_ROLES.some((r) => record[r]) && !asList(record.extra).length) problems.push("no visual layer");
  if (record.use !== undefined) problems.push(...validateCardDesign(record.use, { nested: true }).map((p) => `use: ${p}`));
  if (record.actions !== undefined && !nested) {
    if (!record.actions || typeof record.actions !== "object" || Array.isArray(record.actions)) problems.push("actions must map action ids to designs");
    else for (const [id, design] of Object.entries(record.actions)) {
      if (!ACTION_ID.test(id)) problems.push(`actions: key ${JSON.stringify(id)} is not an action id`);
      problems.push(...validateCardDesign(design, { nested: true, quoted: true }).map((p) => `actions.${id}: ${p}`));
    }
  }
  return problems;
}

const round = (n) => Math.round(n * 100) / 100;
// Default timing (ms from the start) and look per role; `at`, `duration`, `scale` and the rest override.
const ROLE = {
  cast: { duration: 1000, scale: 1, opacity: 0.95 },
  travel: { duration: 1000, scale: 1 },
  impact: { duration: 1200, scale: 1.2 },
  aura: { duration: 2000, scale: 1.2, opacity: 0.95 },
};
// JB2A melee and unarmed clips carry a stretch template: aimed at targets they reach from the caster.
const STRETCH = /^(?:jb2a.)?(?:[a-z_]+.melee.|melee_generic.|unarmed_strike.|greatclub.standard)/;
// On a token, a layer below this reads as a speck (markers and icons fill little of their frame).
const MIN_SCALE = { cast: 1, impact: 1, aura: 1 };
// Stages for one record: cast, travel, impact, aura, extra layers, afterimages, then motion, timed in that order
// unless a layer gives `at`. `palette` supplies the cast when the record leaves it out; `level` scales.
export function designStages(record, { palette, level = 1, levelScale = () => 1 } = {}) {
  const grow = levelScale(level) * (record.scale ?? 1);
  const castLayer = record.cast === false ? null : asLayer(record.cast ?? palette?.cast);
  const times = {};
  times.cast = 0;
  times.travel = castLayer ? 400 : 0;
  times.impact = record.travel ? times.travel + 700 : castLayer ? 600 : 0;
  times.aura = record.impact ? times.impact + 250 : castLayer ? 300 : 0;
  const optional = !TARGETED.has(record.shape);
  const build = (role, l, label) => {
    const on = role === "cast" ? "self" : role === "travel" ? "targets" : l.on ?? (SELF.has(record.shape) ? "self" : "targets");
    const d = ROLE[role];
    const colour = l.tint === false ? {} : l.tint ?? record.tint ? tint(l.tint ?? record.tint) : {};
    const options = { delay: l.at ?? times[role], duration: l.duration ?? d.duration, scale: round(Math.max(MIN_SCALE[role] ?? 0, (l.scale ?? d.scale) * grow)),
      ...(l.opacity ?? d.opacity ? { opacity: l.opacity ?? d.opacity } : {}), ...colour,
      ...Object.fromEntries(["below", "above", "repeats", "repeatInterval", "travelOrigin", "targetSelection", "targetStagger", "offsetY", "offsetUnits", "fadeIn", "fadeOut", "playbackRate"]
        .filter((k) => l[k] !== undefined).map((k) => [k, l[k]])),
      ...(on === "targets" && (optional || l.targetSelection === "secondary") ? { optionalTargets: true } : {}) };
    const name = l.label ?? label;
    if (role === "aura") return aura(name, l.assets, { ...options, subject: on === "targets" ? "targets" : "source" });
    if (role === "travel") return travel(name, l.assets, options);
    if (on !== "self" && STRETCH.test(asList(l.assets)[0] ?? "")) return travel(name, l.assets, options);
    return on === "self" ? cast(name, l.assets, options) : impact(name, l.assets, options);
  };
  const stages = [];
  if (castLayer) stages.push(build("cast", castLayer, "Gather"));
  if (record.travel) stages.push(build("travel", asLayer(record.travel), "Flight"));
  if (record.impact) stages.push(build("impact", asLayer(record.impact), "Contact"));
  if (record.aura) stages.push(build("aura", asLayer(record.aura), "Linger"));
  for (const l of asList(record.extra)) stages.push(build(l.role ?? "impact", l, "Layer"));
  // Afterimages: cosmetic copies of the caster's token art (illusions, astral doubles).
  if (record.copies) {
    const c = record.copies;
    stages.push(sprite("Afterimages", { subject: "source", delay: c.at ?? (castLayer ? 400 : 0), duration: c.duration ?? 2000, copies: c.count, copySpread: c.spread ?? 0.3,
      opacity: c.opacity ?? 0.4, fadeIn: 200, fadeOut: 400 }));
  }
  for (const m of asList(record.motion)) {
    const at = m.at ?? (m.subject === "targets" ? times.impact + 100 : castLayer ? 200 : 0);
    stages.push(motion(m.motion, m.subject, { delay: at, duration: m.duration ?? 900, intensity: m.intensity ?? 0.6,
      ...(m.distance !== undefined ? { distance: m.distance } : {}), ...(m.subject === "targets" && optional ? { optionalTargets: true } : {}) }));
  }
  return stages.map((s, i) => ({ stageId: `d${i + 1}`, ...s }));
}

// Compares recipes by what they show: each stage's kind and first asset (or motion and subject).
export const stageSignature = (stages) => stages.map((s) => `${s.kind}:${s.kind === "motion" ? `${s.motion}@${s.subject}` : s.assets?.[0] ?? ""}`).join("|");

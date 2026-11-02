// Draw Steel library: the hero abilities of data/draw-steel-catalog.mjs (built by
// tools/build-draw-steel.mjs from the system's Abilities compendium), fallbacks for every other
// ability (monster abilities, homebrew) and the system's conditions. What each plays is designed in
// draw-steel-design.mjs from the same facts the adapter reads from a used ability: its look (element
// and shape), its class's style, its name, its forced movement and conditions, its cost. A monster
// ability plays its look's fallback, with its own forced movement and conditions added when it fires.
// Pure: no Foundry globals.
import { DRAW_STEEL_SOURCE, DRAW_STEEL_ABILITIES } from "../../../data/draw-steel-catalog.mjs";
import { clone, normalize, validateRecipe, matchRecipe, ownRecipe, matchStrikeOverride, MAX_STAGES } from "../../core/model.mjs";
import { fitCastClips } from "../../engines/playback/cast-clip.mjs";
import { wholeBreathClips, clipLength } from "../../engines/media/media-lifetime.mjs";
import { abilityLook, abilityRow, DS_ELEMENTS } from "../../systems/draw-steel.mjs";
import { NATURAL_ATTACK } from "../daggerheart/daggerheart-catalog.mjs";
import { withDhSounds } from "../daggerheart/daggerheart-polish.mjs";
import { withConditionLook } from "../shared/catalog-fx.mjs";
import { DS_LOOKS, dsLook, designAbility, riderStages, classStyle, wholeClips, untargetedStages } from "./draw-steel-design.mjs";
export { DRAW_STEEL_SOURCE, DS_LOOKS, dsLook };
export const DS_KINDS = Object.freeze(["ability", "fallback", "condition"]);
const SOURCE_URL = `https://github.com/${DRAW_STEEL_SOURCE.repository ?? "MetaMorphic-Digital/draw-steel"}/tree/${DRAW_STEEL_SOURCE.version}`;

const recipeFor = (entry, variantId, trigger, stages, extra = {}) => validateRecipe({
  id: `animater-${variantId}`, name: entry.name, description: "", category: "Draw Steel", color: entry.color, trigger,
  systemId: "draw-steel", itemUuid: entry.uuid ?? "", catalogEntry: entry.id, stages, ...extra,
});
const SHAPE_LABEL = { strike: "strike", burst: "burst", area: "area", line: "line", self: "self" };
function abilityEntry(row) {
  const look = abilityLook(row);
  const d = designAbility({ look, name: row.name, group: row.group, keywords: row.keywords, forced: row.forced, conditions: row.conditions, category: row.category, resource: row.resource,
    verbs: row.verbs ?? [], damages: row.damages, target: row.target });
  const entry = { id: `draw-steel-ability-${row.id}`, systemId: "draw-steel", kind: "ability", uuid: `Compendium.draw-steel.${DRAW_STEEL_SOURCE.packs?.ability ?? "abilities"}.Item.${row.id}`,
    name: row.name, img: row.img, level: Number(row.resource) || 0, group: row.group ?? "Other", edition: row.group ?? "Other", theme: row.group ?? "Other", quality: "signature", color: d.color,
    look, keywords: [...row.keywords], sourceURL: `${SOURCE_URL}/src/packs/abilities`,
    descriptionText: [row.group, ...row.keywords, row.distance, look.shape === "self" ? look.utility : look.element, row.forced?.kind, ...row.conditions, d.design, row.resource ? `${row.resource} resource` : ""].filter(Boolean).join(" ") };
  const trigger = row.rolled ? "attack" : "use", id = `${entry.id}-${trigger}`;
  entry.variants = [{ id, label: `${row.rolled ? "power roll" : "use"} · ${d.design}`, design: d.design, recipe: recipeFor(entry, id, trigger, d.stages), sound: d.sound }];
  return entry;
}

// Fallbacks: a weapon strike by what its name names, each element in each shape, a boon and a heal.
const WEAPON_FALLBACKS = [
  ["melee", "Any melee weapon strike", "melee", "Strike"], ["ranged", "Any ranged weapon strike", "ranged", "Strike"],
  ["claws", "Any claw strike", "melee", "Claws"], ["bite", "Any bite strike", "melee", "Bite"], ["unarmed", "Any unarmed strike", "melee", "Fist"],
];
function weaponFallback([key, name, mode, sample]) {
  const entry = { id: `draw-steel-fallback-weapon-${key}`, systemId: "draw-steel", kind: "fallback", uuid: null, name, img: mode === "ranged" ? "icons/svg/target.svg" : "icons/svg/sword.svg",
    level: 0, generic: true, natural: ["claws", "bite", "unarmed"].includes(key) ? key : null, weaponMode: mode, edition: "Fallback", group: "Weapon", theme: "Weapon", quality: "themed", color: "#c9a36b",
    sourceURL: `${SOURCE_URL}/src/packs/monsters`, descriptionText: `weapon strike ${mode} ${key}` };
  const d = designAbility({ look: { shape: "strike", element: "physical", mode, weapon: true }, name: sample, generic: true }), id = `${entry.id}-attack`;
  entry.variants = [{ id, label: `strike · ${mode}`, weaponMode: mode, recipe: recipeFor(entry, id, "attack", d.stages), sound: d.sound }];
  return entry;
}
function elementFallback(element) {
  const look = dsLook(element);
  const entry = { id: `draw-steel-fallback-${element}`, systemId: "draw-steel", kind: "fallback", uuid: null, name: `Any ${look.label.toLowerCase()} ability`, img: "icons/svg/explosion.svg",
    level: 0, generic: true, element, edition: "Fallback", group: "Element", theme: look.label, quality: "themed", color: look.color,
    sourceURL: `${SOURCE_URL}/src/packs/monsters`, descriptionText: `${look.label.toLowerCase()} strike burst aura cube wall line` };
  entry.variants = [...["melee", "ranged"].map((mode) => ({ shape: "strike", mode })), ...["burst", "area", "line"].map((shape) => ({ shape }))].map(({ shape, mode }) => {
    const id = `${entry.id}-${shape}${mode ? `-${mode}` : ""}`, d = designAbility({ look: { shape, element, mode, weapon: false }, generic: true });
    return { id, label: `${shape}${mode ? ` · ${mode}` : ""}`, dsShape: shape, ...(mode ? { weaponMode: mode } : {}), recipe: recipeFor(entry, id, "attack", d.stages), sound: d.sound };
  });
  return entry;
}
function utilityFallback(utility) {
  const entry = { id: `draw-steel-fallback-utility-${utility}`, systemId: "draw-steel", kind: "fallback", uuid: null, name: `Any ability · ${utility === "heal" ? "Heal" : "Boon"}`, img: "icons/svg/aura.svg",
    level: 0, generic: true, utility, edition: "Fallback", group: "Ability", theme: "Ability", quality: "themed", color: utility === "heal" ? "#6fe08a" : classStyle(null).glow, sourceURL: SOURCE_URL,
    descriptionText: utility === "heal" ? "any self or ally ability that heals or grants a Recovery" : "any self or ally ability without damage" };
  const id = `${entry.id}-use`, d = designAbility({ look: { shape: "self", utility }, generic: true });
  entry.variants = [{ id, label: "use", recipe: recipeFor(entry, id, "use", d.stages), sound: d.sound }];
  return entry;
}

// Conditions (ds.CONFIG.conditions): lasting layers through the persistent states, each with its
// Tokenshade look when it is available (condition-looks.mjs).
export const DS_CONDITION_LIST = Object.freeze([
  { statusId: "bleeding", name: "Bleeding", color: "#b3262e", description: "Blood drips from the creature while it is Bleeding.",
    stages: [{ stageId: "drip", kind: "aura", assets: ["jb2a.liquid.splash.red", "jb2a.liquid.splash.blue"], scale: 0.6, opacity: 0.6, tintEnabled: true, tint: "#b3262e" }] },
  { statusId: "dazed", name: "Dazed", color: "#e8d27a", description: "Stars circle the creature's head while it is Dazed.",
    stages: [{ stageId: "stars", kind: "aura", assets: ["jb2a.twinkling_stars.points07.white", "jb2a.twinkling_stars.points07.orange"], scale: 0.7, opacity: 0.8 }] },
  { statusId: "frightened", name: "Frightened", color: "#5b2a86", description: "A dark, trembling haze while the creature is Frightened.",
    stages: [{ stageId: "fear", kind: "aura", assets: ["jb2a.markers.fear.dark_purple.03", "jb2a.markers.fear.dark_purple.01"], scale: 0.8, opacity: 0.7 }] },
  { statusId: "grabbed", name: "Grabbed", color: "#8c8f99", description: "A binding grip holds the creature while it is Grabbed.",
    stages: [{ stageId: "grip", kind: "aura", assets: ["jb2a.markers.chain.standard.loop.02.grey", "jb2a.markers.chain.standard.loop.02.red"], scale: 0.85, opacity: 0.8 }] },
  { statusId: "prone", name: "Prone", color: "#9aa0a6", description: "Dust settles around the creature while it is Prone.",
    stages: [{ stageId: "dust", kind: "aura", assets: ["jb2a.smoke.puff.centered.grey"], scale: 0.8, opacity: 0.4, below: true }] },
  { statusId: "restrained", name: "Restrained", color: "#8c8f99", description: "Chains and vines hold the creature while it is Restrained.",
    stages: [{ stageId: "chains", kind: "aura", assets: ["jb2a.markers.chain.standard.loop.02.grey", "jb2a.markers.chain.standard.loop.02.red"], scale: 0.9, opacity: 0.9 },
      { stageId: "vines", kind: "aura", assets: ["jb2a.entangle.02.loop.02.green", "jb2a.entangle.green"], scale: 0.9, opacity: 0.5, below: true }] },
  { statusId: "slowed", name: "Slowed", color: "#8fb8ff", description: "A slow blue haze clings to the creature while it is Slowed.",
    stages: [{ stageId: "haze", kind: "aura", assets: ["jb2a.energy_strands.overlay.blue.01", "jb2a.static_electricity.01.blue"], scale: 0.8, opacity: 0.4 }] },
  { statusId: "surprised", name: "Surprised", color: "#f2c94c", description: "A startled flash while the creature is Surprised.",
    stages: [{ stageId: "flash", kind: "aura", assets: ["jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points07.orange"], scale: 0.6, opacity: 0.7 }] },
  { statusId: "taunted", name: "Taunted", color: "#d0485a", description: "A red mark on the creature while it is Taunted.",
    stages: [{ stageId: "mark", kind: "aura", assets: ["jb2a.markers.light.complete.red", "jb2a.energy_strands.overlay.dark_red.01", "jb2a.markers.fear.dark_purple.01"], scale: 0.6, opacity: 0.6 }] },
  { statusId: "weakened", name: "Weakened", color: "#7a7f8a", description: "A grey, drained haze while the creature is Weakened.",
    stages: [{ stageId: "drain", kind: "aura", assets: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.smoke.puff.centered.grey"], scale: 0.8, opacity: 0.35 }] },
]);
function conditionEntry(c) {
  const entry = { id: `draw-steel-condition-${c.statusId}`, systemId: "draw-steel", kind: "condition", uuid: null, statusId: c.statusId, name: c.name, img: null,
    level: 0, edition: "Condition", group: "Lasting", theme: "Lasting", quality: "themed", color: c.color, state: { lasting: true, moment: false, defeated: false },
    sourceURL: SOURCE_URL, descriptionText: c.description };
  const id = `${entry.id}-effect`;
  entry.variants = [{ id, label: "while the condition lasts", recipe: recipeFor(entry, id, "effect", c.stages, { lifecycle: "document", stateEntry: entry.id }) }];
  return entry;
}

const DS_ENTRIES = [...DRAW_STEEL_ABILITIES.map(abilityEntry), ...WEAPON_FALLBACKS.map(weaponFallback), ...DS_ELEMENTS.map(elementFallback),
  ...["boon", "heal"].map(utilityFallback), ...DS_CONDITION_LIST.map(conditionEntry)];
const byId = new Map(DS_ENTRIES.map((e) => [e.id, e]));
const byUuid = new Map(DS_ENTRIES.filter((e) => e.uuid).map((e) => [e.uuid, e]));
const byDsid = new Map(DRAW_STEEL_ABILITIES.filter((a) => a.dsid).map((a) => [a.dsid, byId.get(`draw-steel-ability-${a.id}`)]));
export const dsEntries = (kind) => (kind ? DS_ENTRIES.filter((e) => e.kind === kind) : DS_ENTRIES);
export const dsEntry = (id) => byId.get(String(id).replace(/^animater-/, "")) ?? null;

export function normalizeDsCatalogState(state = {}) {
  state ??= {};
  const ids = (values) => [...new Set((Array.isArray(values) ? values : []).filter((id) => byId.has(id)))];
  return { enabled: state.enabled === true, independent: state.independent === true, preferCatalog: state.preferCatalog === true, scope: state.scope === "selected" ? "selected" : "all",
    selected: ids(state.selected), excluded: ids(state.excluded), customized: ids(state.customized), motion: state.motion !== false, fade: state.fade === true, turn: state.turn === true, sound: state.sound !== false,
    soundVolume: Number.isFinite(Number(state.soundVolume)) ? Math.max(0, Math.min(1, Number(state.soundVolume))) : 0.35,
    opacity: Number.isFinite(Number(state.opacity)) ? Math.max(0.1, Math.min(1, Number(state.opacity))) : 1 };
}
export const dsEntryEnabled = (id, state) => state?.enabled === true && !state.excluded?.includes(id) && (state.scope !== "selected" || state.selected?.includes(id) || state.customized?.includes(id));
export function useDsEntry(state, id) {
  if (!byId.has(id)) throw Error("Choose a Draw Steel catalog entry first.");
  state = normalizeDsCatalogState(state);
  return normalizeDsCatalogState({ ...state, enabled: true, independent: true, scope: state.enabled ? state.scope : "selected", selected: state.enabled ? [...state.selected, id] : [id],
    excluded: state.excluded.filter((v) => v !== id), customized: state.customized.filter((v) => v !== id) });
}
// `motion: false` drops the motion stages; `sounds` (an installed audio catalog, null when the Sounds
// switch is off) adds the variant's sound design; `trigger` plays the variant on the event that fired
// (a fallback serves rolled and unrolled abilities alike); `riders` (a monster ability's forced
// movement and conditions) join a fallback, whose stages know nothing of them. Cast clips play whole
// and breaths fill their line, as in every built-in catalog.
export function dsRecipe(entry, variantId, { motion = true, sounds = null, soundVolume = 0.35, trigger = null, riders = null, untargeted = false, variant: given = null } = {}) {
  if (!entry) throw Error("Choose a Draw Steel catalog entry first.");
  const variant = given ?? entry.variants.find((v) => v.id === variantId) ?? entry.variants[0];
  const recipe = clone(variant.recipe);
  if (trigger && recipe.lifecycle !== "document") recipe.trigger = trigger;
  if (entry.generic && riders && recipe.lifecycle !== "document") {
    const at = recipe.stages.find((s) => s.kind === "impact")?.delay ?? 700, room = MAX_STAGES - recipe.stages.length - 2;
    if (room > 0) recipe.stages.push(...riderStages(riders, at).slice(0, room));
  }
  if (untargeted && recipe.lifecycle !== "document") recipe.stages = untargetedStages(recipe.stages);
  if (!motion && recipe.stages.some((s) => s.kind !== "motion")) recipe.stages = recipe.stages.filter((s) => s.kind !== "motion");
  if (recipe.lifecycle !== "document") recipe.stages = withDhSounds(entry, variant, recipe.stages, { sounds, soundVolume });
  if (recipe.lifecycle === "document") return withConditionLook(validateRecipe(recipe), entry);
  const fitted = validateRecipe(wholeBreathClips(fitCastClips(validateRecipe(recipe))));
  return validateRecipe({ ...fitted, stages: wholeClips(fitted.stages, clipLength) });
}
// An element fallback plays the variant of the event's shape (and, for a strike, its range).
export function dsVariantForEvent(entry, event) {
  const variants = entry?.variants ?? [];
  if (!entry?.element) return variants[0] ?? null;
  const mode = event?.weaponMode === "ranged" ? "ranged" : "melee";
  return variants.find((v) => v.dsShape === event?.dsShape && (v.dsShape !== "strike" || v.weaponMode === mode)) ?? variants.find((v) => v.dsShape === "strike" && v.weaponMode === mode) ?? variants[0] ?? null;
}

// The entry for an event: a condition by its status; an ability by its compendium source, its Draw
// Steel id or its name; anything else (a monster's ability, homebrew) the fallback of its look.
function fallbackFor(event) {
  const shape = event?.dsShape, element = event?.dsElement;
  if (shape === "self") return dsEntry(`draw-steel-fallback-utility-${event?.utilityLook === "heal" ? "heal" : "boon"}`);
  const keywords = new Set(Array.from(event?.keywords ?? []));
  if (shape === "strike" && (keywords.has("weapon") || element === "physical")) {
    const ranged = event?.weaponMode === "ranged", name = String(event?.item?.name ?? event?.itemName ?? "");
    const natural = ranged ? null : Object.entries(NATURAL_ATTACK).find(([, pattern]) => pattern.test(name))?.[0];
    return dsEntry(`draw-steel-fallback-weapon-${natural ?? (ranged ? "ranged" : "melee")}`);
  }
  return element ? dsEntry(`draw-steel-fallback-${element}`) : null;
}
export function findDsEntry(event) {
  const item = event?.item ?? null;
  if (event?.type === "effect") {
    const statuses = new Set(Array.from(item?.statuses ?? []));
    return dsEntries("condition").find((e) => statuses.has(e.statusId)) ?? null;
  }
  if (item && item.type !== "ability") return null;
  for (const uuid of [item?._stats?.compendiumSource, item?.flags?.core?.sourceId]) { const hit = uuid ? byUuid.get(uuid) : null; if (hit) return hit; }
  const dsid = item?.system?._dsid;
  if (dsid && byDsid.has(dsid)) return byDsid.get(dsid);
  const name = normalize(item?.name ?? event?.itemName);
  // Only a hero's ability is known by name: a monster's same-named ability is its own.
  const byName = name && item?.actor?.type !== "npc" ? dsEntries("ability").find((e) => normalize(e.name) === name) : null;
  if (byName) return byName;
  // An event without the adapter's look (an older trace, a preview) takes it from the item.
  return fallbackFor(event?.dsShape || !item ? event : { ...event, ...lookFields(item) });
}
const lookFields = (item) => { const row = abilityRow(item), look = abilityLook(row); return { dsShape: look.shape, dsElement: look.element, utilityLook: look.utility, weaponMode: look.mode, keywords: row.keywords }; };

// Plays like the other catalogs: your recipes that match by name win unless you picked the catalog's;
// lasting conditions belong to the persistent layers, not to dispatch.
export function resolveDrawSteelAutomaticRecipe(event, stateFor, saved = [], { customEnabled = true, sounds = null } = {}) {
  const entry = findDsEntry(event), state = normalizeDsCatalogState(entry && stateFor(entry.kind));
  const custom = customEnabled || (entry && dsEntryEnabled(entry.id, state) && state.customized.includes(entry.id)) ? saved : [];
  const selected = entry && dsEntryEnabled(entry.id, state), prefer = selected && (state.selected.includes(entry.id) || (state.preferCatalog && !state.customized.includes(entry.id) && !ownRecipe(custom, event)));
  const override = matchStrikeOverride(custom, event);
  if (override) return override;
  if (!prefer) { const match = matchRecipe(custom, event); if (match) return match; }
  if (!selected || entry.state?.lasting) return null;
  if (!prefer && custom.some((r) => !r.enabled && matchRecipe([{ ...r, enabled: true }], event))) return null;
  const variant = dsVariantForEvent(entry, event), live = entry.generic && event?.item?.type === "ability" && variant ? liveVariant(entry, variant, event.item) : null;
  return variant ? dsRecipe(entry, variant.id, { motion: state.motion, sounds: state.sound ? sounds : null, soundVolume: state.soundVolume, trigger: event?.type ?? null, variant: live,
    riders: !live && (event?.dsForced || event?.dsConditions) ? { forced: event.dsForced ?? null, conditions: event.dsConditions ?? [] } : null,
    untargeted: Array.isArray(event?.targetUuids) && !event.targetUuids.length }) : null;
}
// A monster's (or homebrew) ability the library does not list: designed when it fires from its own
// facts and words (what its text says it does, its forced movement and conditions), under its
// fallback's entry and settings.
export function liveVariant(entry, variant, item) {
  const row = abilityRow(item), look = abilityLook(row);
  const d = designAbility({ look, name: row.name, keywords: row.keywords, forced: row.forced, conditions: row.conditions, category: row.category, resource: row.resource,
    verbs: row.verbs, damages: row.damages, target: row.target, monster: true });
  return { ...variant, sound: d.sound, design: d.design, recipe: recipeFor(entry, variant.id, variant.recipe.trigger, d.stages) };
}

export function filterDsEntries(kind, { search = "", level = "all", theme = "all" } = {}) {
  const query = normalize(search);
  const score = (e) => (normalize(e.name) === query ? 3 : normalize(e.name).startsWith(query) ? 2 : normalize(e.name).includes(query) ? 1 : 0);
  return dsEntries(kind).filter((e) => (level === "all" || e.level === Number(level)) && (theme === "all" || e.theme === theme)
    && (!query || normalize(`${e.name} ${e.descriptionText ?? ""} ${e.group ?? ""}`).includes(query))).sort((a, b) => (query ? score(b) - score(a) : 0));
}

// The shared catalog page (dnd5e-catalog-ui.mjs) for Draw Steel: hero abilities on the spells page with
// class chips, fallbacks on the weapons page, conditions.
const GROUPS = [...new Set(DRAW_STEEL_ABILITIES.map((a) => a.group ?? "Other"))].sort();
const COSTS = [...new Set(DRAW_STEEL_ABILITIES.map((a) => Number(a.resource) || 0))].sort((a, b) => a - b);
export const dsCatalogProfile = {
  systemId: "draw-steel", label: "Draw Steel", source: DRAW_STEEL_SOURCE, entries: dsEntries, entry: dsEntry, recipe: dsRecipe, filter: filterDsEntries,
  normalize: normalizeDsCatalogState, enabled: dsEntryEnabled, use: useDsEntry, stateKey: "dsCatalogState", setStateKey: "setDsCatalogState",
  kinds: { spells: "ability", weapons: "fallback", conditions: "condition" },
  labels: { ability: "abilities", fallback: "fallbacks", condition: "conditions" },
  levelKind: "ability", levelLabel: "Cost", levels: COSTS,
  themeLabel: (kind) => (kind === "ability" ? "Class" : kind === "fallback" ? "Look" : "Kind"),
  chips: (kind) => (kind === "ability" ? GROUPS.map((g) => [g, g]) : null),
  governedBy: () => null,
  intro: "Native Draw Steel compendium abilities. Each animates its element (its damage type, or the keyword naming its power) in its shape: a strike, a burst or aura, a cube or wall, a line. Monster and homebrew abilities play the fallbacks.",
  hint: "Native system compendiums.",
};

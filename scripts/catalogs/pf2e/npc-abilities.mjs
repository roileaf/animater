// PF2e NPC abilities: the monster abilities hundreds of creatures share (Grab, Constrict, Swallow
// Whole, Breath Weapon…), matched by name on an NPC's action, with or without its frequency or
// distance ("Breath Weapon (Fire)", "Push 10 feet"). The looks are bespoke designs in
// catalogs/bespoke/pf2e-npc-abilities.mjs. A basic action the action catalog knows (Grapple,
// Shove) keeps its own entry; this catalog only fills in what that one has no entry for.
import { matchRecipe, validateRecipe } from "../../core/model.mjs";
import { applyBespoke } from "../shared/bespoke.mjs";
import { BREATH_ELEMENTS, ABILITY_ELEMENTS } from "../bespoke/pf2e-npc-abilities.mjs";
import { npcActionSemantics } from './npc-action-semantics.mjs';
import { catalogDataNeeded } from '../shared/catalog-data.mjs';
const {PF2E_NPC_ACTIONS,PF2E_NPC_ACTION_SOURCE}=catalogDataNeeded('pf2e')?await import('../../../data/pf2e-npc-actions.mjs'):{PF2E_NPC_ACTIONS:[],PF2E_NPC_ACTION_SOURCE:{}};
export {PF2E_NPC_ACTION_SOURCE};
export const NPC_ACTIONS=PF2E_NPC_ACTIONS;
const actionsById=new Map(NPC_ACTIONS.map(a=>[a.id,a]));
const actionsBySource=new Map(NPC_ACTIONS.flatMap(a=>a.sources.map(source=>[source,a])));
const actionsByName=new Map();
for(const a of NPC_ACTIONS){const key=a.name.toLowerCase();if(!actionsByName.has(key))actionsByName.set(key,[]);actionsByName.get(key).push(a);}
export function findNpcCatalogAction(event){
  if(event?.item?.type!=='action'||(event.actor??event.item.actor)?.type!=='npc')return null;
  const item=event.item,actor=event.actor??item.actor;
  const source=item.sourceId??item._stats?.compendiumSource??item.flags?.core?.sourceId;
  if(source&&actionsBySource.has(source))return actionsBySource.get(source);
  const actorSource=actor?.sourceId??actor?._stats?.compendiumSource;
  // A same-named action from another system/module is not this native source.
  // Shared name families and conservative live-data inference still run below.
  if(/^Compendium\.(?!pf2e\.)/.test(source??actorSource??''))return null;
  if(actorSource&&item.id){const embedded=`${actorSource}.Item.${item.id}`;if(actionsBySource.has(embedded))return actionsBySource.get(embedded);}
  const matches=actionsByName.get(String(item.name??'').toLowerCase())??[];
  const inferred=findNpcAbility(event)??abilityForm(event);
  const variant=inferred?.id==='breath'?`${breathElement(item)}-${breathShape(item)}`:inferred?.variant;
  const semantic=matches.find(a=>a.creatures.includes(actor?.name)&&a.form?.id===inferred?.id&&a.form?.variant===variant);
  if(semantic)return semantic;
  // Source links are strongest. For imported copies missing them, only an
  // unambiguous native creature/name/action-shape match may select a review.
  const traits=[...(item.system?.traits?.value??[])].sort().join('|');
  const native=matches.filter(a=>a.creatures.includes(actor?.name)&&[...a.traits].sort().join('|')===traits&&a.actionType===(item.system?.actionType?.value??'action')&&a.actions===(item.system?.actions?.value??null));
  return native.length===1?native[0]:(matches.length===1&&matches[0].coverage!=='reviewed'?matches[0]:null);
}

// design id → { names, trigger, aim }. aim: "target" (one creature), "area" (the placed template),
// "self" (no creature needed).
const ABILITIES = {
  grab: { names: ["Grab", "Improved Grab", "Quick Capture", "Efficient Capture", "Combat Grab"], aim: "target" },
  constrict: { names: ["Constrict", "Greater Constrict"], aim: "target" },
  swallow: { names: ["Swallow Whole", "Fast Swallow"], aim: "target" },
  engulf: { names: ["Engulf"], aim: "self" },
  drain: { names: ["Blood Drain", "Drink Blood", "Consume Flesh", "Gnaw", "Feed", "Siphon Life"], aim: "target" },
  knockdown: { names: ["Knockdown", "Improved Knockdown"], aim: "target" },
  push: { names: ["Push", "Improved Push", "Buck", "Wing Rebuff"], aim: "target" },
  rend: { names: ["Rend"], aim: "target" },
  sweep: { names: ["Wide Swing", "Swipe", "Broad Swipe", "Thrash", "Knocking Sweep", "Tail Lash", "Twisting Tail", "Tail Sweep"], aim: "self" },
  trample: { names: ["Trample", "Overrun"], aim: "self" },
  charge: { names: ["Sudden Charge", "Powerful Charge", "Impaling Charge", "Knockdown Rush", "Aquatic Ambush", "Flying Strafe", "Rush", "Charge"], aim: "self" },
  pounce: { names: ["Pounce", "Swift Leap", "Leaping Pounce"], aim: "self" },
  dash: { names: ["Gallop", "Speed Surge", "Scamper", "Goblin Scuttle", "Hurried Retreat"], aim: "self" },
  dodge: { names: ["Nimble Dodge", "Wing Deflection"], aim: "self" },
  "throw-rock": { names: ["Throw Rock", "Rock Throw"], aim: "target" },
  "catch-rock": { names: ["Catch Rock"], aim: "self" },
  fury: { names: ["Ferocity", "Rage", "Blood Frenzy", "Fanatical Frenzy"], aim: "self" },
  frenzy: { names: ["Draconic Frenzy", "Flurry of Blows", "Swarming Bites", "Coiling Frenzy", "Hungry Flurry", "Focused Assault"], aim: "self" },
  fear: { names: ["Frightful Moan", "Terrifying Croak", "Bloodcurdling Screech", "Feed on Fear", "Terrifying Roar", "Horrific Visage"], aim: "self" },
  gaze: { names: ["Focus Gaze", "Focus Beauty", "Petrifying Gaze", "Petrifying Glance"], aim: "target" },
  dominate: { names: ["Dominate"], aim: "target" },
  "change-shape": { names: ["Change Shape"], aim: "self" },
  mist: { names: ["Turn to Mist", "Mist Escape"], aim: "self" },
  shield: { names: ["Shield Block", "Raise a Shield"], aim: "self" },
  spores: { names: ["Spore Cloud"], aim: "self" },
  breath: { names: ["Breath Weapon", "Poison Breath", "Hellfire Breath", "Chill Breath", "Fire Breath", "Frost Breath", "Acid Breath", "Lightning Breath"], aim: "area", trigger: "template" },
};
// "Breath Weapon (Fire)", "Push 10 feet", "Grab (Jaws)": the ability's own name.
export const abilityName = (name) => String(name ?? "").replace(/\s*\([^)]*\)/g, "").replace(/\s+\d+\s*(?:feet|foot|ft\.?)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const byName = new Map(Object.entries(ABILITIES).flatMap(([id, a]) => a.names.map((n) => [abilityName(n), id])));
export const NPC_ABILITY_IDS = Object.keys(ABILITIES);
// The named abilities as the Studio lists them: the first name is the one shown.
export const NPC_ABILITIES = Object.entries(ABILITIES).map(([id, a]) => ({ id, name: a.names[0], names: a.names, aim: a.aim, trigger: a.trigger ?? "use" }));
// A longer name's last word that names an ability ("Boar Charge", "Angle-Cutting Rush", "Squirming Embrace").
const WORDS = { charge: "charge", rush: "charge", stampede: "trample", pounce: "pounce", leap: "pounce", swoop: "pounce", dive: "pounce", lunge: "charge",
  retreat: "dash", scuttle: "dash", scamper: "dash", dash: "dash", grab: "grab", grip: "grab", embrace: "grab", seize: "grab", constrict: "constrict", squeeze: "constrict",
  swallow: "swallow", engulf: "engulf", trample: "trample", rend: "rend", sweep: "sweep", swipe: "sweep", lash: "sweep", knockdown: "knockdown", shove: "push",
  gaze: "gaze", glance: "gaze", stare: "gaze", roar: "fear", screech: "fear", howl: "fear", shriek: "fear", wail: "fear", moan: "fear", croak: "fear", breath: "breath",
  drain: "drain", ferocity: "fury", frenzy: "frenzy", flurry: "frenzy", mist: "mist" };
function byWord(name) {
  const words = abilityName(name).split(/[^a-z]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) if (WORDS[words[i]]) return WORDS[words[i]];
  return null;
}

const npcItem = (event) => event?.item?.type === "action" && (event.actor ?? event.item.actor)?.type === "npc";
export function findNpcAbility(event) {
  if (!npcItem(event)) return null;
  const id = byName.get(abilityName(event.item.name)) ?? byName.get(abilityName(String(event.item.system?.slug ?? event.item.slug ?? "").replace(/-/g, " "))) ?? byWord(event.item.name);
  return id ? { id, ...ABILITIES[id], trigger: ABILITIES[id].trigger ?? "use" } : null;
}

const ALIASES = { negative: "void", positive: "vitality", lightning: "electricity", necrotic: "void" };
const text = (item) => String(item?.system?.description?.value ?? item?.description ?? "");
// A breath's energy: its trait, else the damage it deals ("@Damage[8d6[fire]]"), else its name.
export function breathElement(item) {
  const traits = item?.system?.traits?.value ?? item?.traits ?? [];
  const named = [...traits, ...(text(item).match(/\[(fire|cold|electricity|acid|poison|sonic|void|negative|vitality|positive|force|mental|spirit)\]/i)?.slice(1) ?? []), ...String(item?.name ?? "").toLowerCase().split(/[^a-z]+/)]
    .map((t) => ALIASES[String(t).toLowerCase()] ?? String(t).toLowerCase());
  return named.find((t) => BREATH_ELEMENTS.includes(t) && t !== "other") ?? (named.includes("chill") || named.includes("frost") ? "cold" : named.includes("hellfire") ? "fire" : "other");
}
// A breath's shape: the placed area's, else the one its text places ("@Template[line|distance:60]").
export function breathShape(item, area) {
  // A placed template names a line "ray".
  const shape = area?.type ?? area?.t ?? text(item).match(/@Template\[(?:type:)?(cone|line|burst|emanation)/i)?.[1]?.toLowerCase();
  return ["line", "ray"].includes(shape) ? "line" : "cone";
}

// An ability's energy for its one-of-a-kind look: its trait, else the damage it deals, else physical.
export function abilityElement(item) {
  const traits = (item?.system?.traits?.value ?? item?.traits ?? []).map((t) => ALIASES[t] ?? t);
  const dealt = [...text(item).matchAll(/@Damage\[((?:[^\[\]]|\[[^\[\]]*\])*)\]/g)].flatMap((m) => m[1].toLowerCase().match(/[a-z]+/g) ?? []).map((t) => ALIASES[t] ?? t);
  return [...traits, ...dealt].find((t) => ABILITY_ELEMENTS.includes(t) && t !== "physical") ?? "physical";
}
const dealsDamage = (item) => /@Damage\[|\[\[\/r/.test(text(item));
// An area the ability places: its text's shape, else the placed template's (a circle is a burst).
function areaShape(item, template) {
  const written = text(item).match(/@Template\[(?:type:)?(cone|line|burst|emanation|cube|square|cylinder|circle)/i)?.[1]?.toLowerCase();
  const shape = written ?? ({ ray: "line", cone: "cone", circle: "burst", rect: "burst" })[template?.t ?? template?.type] ?? template?.type;
  return ["cone", "line", "burst", "emanation"].includes(shape) ? shape : shape ? "burst" : null;
}
// Traits that set a look when the ability neither places an area nor deals damage; first match wins.
const TRAIT_LOOKS = [
  [["teleportation"], "blink", "self"], [["polymorph"], "change-shape", "self"], [["fear", "emotion"], "fear", "self"],
  [["mental", "visual", "illusion", "curse", "misfortune", "incapacitation"], "dominate", "target"], [["auditory"], "sound", "self"],
  [["move"], "dash", "self"], [["healing"], "heal", "self"], [["arcane", "divine", "occult", "primal", "magical"], "magic", "self"],
];
// A one-of-a-kind NPC ability (Devastating Blast, Drench): its look from what it does. An area it places
// plays when placed, in that shape; damage with no area strikes its target; else its traits decide.
// A reaction or flourish that makes a Strike ("Retributive Strike") is left to the Strike's own animation.
export function abilityForm(event) {
  if (!npcItem(event)) return null;
  const item = event.item, traits = item.system?.traits?.value ?? item.traits ?? [];
  if (traits.includes("spellshape")) return null;
  const shape = areaShape(item, event.type === "template" ? event.area ?? event.template : null);
  if (!shape && /(^|[^a-z])strike([^a-z]|$)|attack of opportunity|spellstrike/i.test(item.name ?? "")) return null;
  if (shape) return { id: "generic", aim: "area", trigger: "template", variant: `${shape}-${abilityElement(item)}` };
  if (dealsDamage(item)) return { id: "generic", aim: "target", trigger: "use", variant: `hit-${abilityElement(item)}` };
  const semantic=npcActionSemantics(item);
  if(semantic)return semantic;
  const look = TRAIT_LOOKS.find(([wanted]) => wanted.some((t) => traits.includes(t)));
  return look ? { id: look[1], aim: look[2], trigger: "use" } : null;
}

// The single-recipient or area skeleton the design replaces, so its targets play as the ability aims.
const BASE = {
  target: { kind: "impact", label: "Contact", assets: ["jb2a.impact.009.orange"], targetSelection: "first" },
  area: { kind: "template", label: "Area", assets: ["jb2a.impact.009.orange"] },
  self: { kind: "aura", label: "Self", assets: ["jb2a.impact.009.orange"], subject: "source" },
};
const abilityBase = form => ({...BASE[form.aim], ...(['all','first','secondary'].includes(form.targetSelection)?{targetSelection:form.targetSelection}:{})});
// The recipe for an NPC's ability, or null. A saved recipe for it plays instead (a paused one silences it).
// A named monster ability (findNpcAbility) plays its own design, any other its one-of-a-kind look (abilityForm).
// `excluded` names abilities left out (their ids): those play only a saved recipe.
export function npcAbilityRecipe(event, saved = [], { soundCatalog, soundVolume, motion = true, generic = true, excluded = [] } = {}) {
  const catalogAction=findNpcCatalogAction(event);
  const reviewed=catalogAction?.coverage==='reviewed'?catalogAction.form:null;
  const found = findNpcAbility(event) ?? reviewed ?? (generic ? abilityForm(event) : null);
  if (!found || found.trigger !== event.type) return null;
  const own = matchRecipe(saved, event);
  if (own) return own;
  if (Array.isArray(excluded) && (excluded.includes(found.id)||excluded.includes(catalogAction?.id))) return null;
  if (saved.some((r) => !r.enabled && matchRecipe([{ ...r, enabled: true }], event))) return null;
  const variant = found.id === "breath" ? `${breathElement(event.item)}-${breathShape(event.item, event.area ?? event.template)}` : found.variant;
  const recipe = validateRecipe({ id: `pf2e-npc-${found.id}`, name: event.item.name, trigger: found.trigger, systemId: "pf2e", catalogEntry: `npc-${found.id}`,
    stages: [{ stageId: `pf2e-npc-${found.id}-base`, duration: 1200, ...abilityBase(found) }] });
  const played = applyBespoke(recipe, { id: `npc-${found.id}`, systemId: "pf2e" }, { soundCatalog, soundVolume, motion, ...(variant ? { variant: { id: variant } } : {}) });
  return played.bespoke ? played : null;
}
// Factual catalog entries store compact resolved semantics, not bestiary prose.
// Preview them through the same design builder without fabricating damage or traits.
export function npcActionPreview(id,options={}){
  const a=actionsById.get(id);if(!a?.form)return null;
  const found=a.form,recipe=validateRecipe({id:`pf2e-npc-${a.id}`,name:a.name,trigger:found.trigger,systemId:'pf2e',catalogEntry:`npc-${found.id}`,
    stages:[{stageId:`pf2e-npc-${a.id}-base`,duration:1200,...abilityBase(found)}]});
  const played=applyBespoke(recipe,{id:`npc-${found.id}`,systemId:'pf2e'},{...options,...(found.variant?{variant:{id:found.variant}}:{})});
  return played.bespoke?played:null;
}
// A named ability's look as the Studio previews it, on a stand-in NPC action (a breath as a fire cone).
export function npcAbilityPreview(id, options = {}) {
  const a = ABILITIES[id];
  if (!a) return null;
  const actor = { type: "npc" }, item = { type: "action", name: a.names[0], actor, system: { traits: { value: id === "breath" ? ["fire"] : [] }, description: { value: "" } } };
  return npcAbilityRecipe({ type: a.trigger ?? "use", systemId: "pf2e", item, actor, ...(a.aim === "area" ? { area: { type: "cone" } } : {}) }, [], { ...options, excluded: [] });
}

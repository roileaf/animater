import {catalogDataNeeded} from '../../shared/catalog-data.mjs';
const {PF2E_SOURCE, PF2E_SPELLS} = catalogDataNeeded('pf2e') ? await import('../../../../data/pf2e-spells.mjs') : {PF2E_SOURCE: {}, PF2E_SPELLS: []};
import { normalize, matchRecipe, ownRecipe } from "../../../core/model.mjs";
import {
  spellRecipe,
  SPELL_THEMES,
  DELIVERY_LABELS,
} from "./spell-choreography.mjs";
export { PF2E_SOURCE, PF2E_SPELLS, spellRecipe, SPELL_THEMES, DELIVERY_LABELS };

const byId = new Map(PF2E_SPELLS.map((s) => [s.id, s]));
const byName = new Map();
for (const spell of [...PF2E_SPELLS].sort(
  (a, b) => Number(a.edition === "legacy") - Number(b.edition === "legacy"),
))
  for (const name of [spell.name, spell.slug]) {
    const key = normalize(name);
    if (!byName.has(key)) byName.set(key, spell);
  }
export const catalogSpell = (id) =>
  byId.get(String(id).replace(/^pf2e-/, "")) ?? null;
export const catalogSpellReady = spell => Boolean(spell && !spell.design?.unavailable && spell.design?.motif !== 'generic');
export function normalizeCatalogState(state = {}) {
  state ??= {};
  const ids = (values) => [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((id) => catalogSpell(id)?.id)
        .filter(Boolean),
    ),
  ];
  return {
    enabled: state.enabled === true,
    excluded: ids(state.excluded),
    motion: state.motion !== false,
    sound: state.sound !== false,
    soundVolume: Number.isFinite(Number(state.soundVolume))
      ? Math.max(0, Math.min(1, Number(state.soundVolume)))
      : 0.35,
    scope: state.scope === "selected" ? "selected" : "all",
    selected: ids(state.selected),
    customized: ids(state.customized),
    preferCatalog: state.preferCatalog === true,
    independent: state.independent === true,
  };
}
export function catalogSpellEnabled(id, state) {
  return (
    state?.enabled === true &&
    catalogSpellReady(catalogSpell(id)) &&
    !state.excluded?.includes(id) &&
    (state.scope !== "selected" || state.selected?.includes(id) === true)
  );
}
export function useCatalogSpell(state, id) {
  state = normalizeCatalogState(state);
  id = catalogSpell(id)?.id;
  if (!id) throw Error("Choose a catalog spell first.");
  if(!catalogSpellReady(catalogSpell(id)))throw Error('This spell needs configuration before playback.');
  return normalizeCatalogState({
    ...state,
    enabled: true,
    independent: true,
    scope: state.enabled ? state.scope : "selected",
    selected: state.enabled ? [...state.selected, id] : [id],
    excluded: state.excluded.filter((value) => value !== id),
    customized: state.customized.filter((value) => value !== id),
  });
}
export function findCatalogSpell(event) {
  if (event.item?.type !== "spell") return null;
  const item = event.item;
  for (const uuid of [
    item.uuid,
    item.original?.uuid,
    item._stats?.compendiumSource,
    item.flags?.core?.sourceId,
    event.itemUuid,
  ]) {
    if (!uuid?.startsWith("Compendium.pf2e.spells-srd.")) continue;
    const spell = byId.get(uuid.split(".").at(-1));
    if (spell) return spell;
  }
  // A name with notes ("Dragon Breath (Gold)", "Detect Alignment (At Will) (Evil Only)") is the spell of that name;
  // a pre-Remaster name on an older NPC is the spell it became.
  const bare = String(item.name ?? "").replace(/\s*\([^)]*\)/g, "").trim();
  return (
    byName.get(normalize(item.system?.slug ?? item.slug)) ??
    byName.get(normalize(item.name)) ??
    byName.get(normalize(bare)) ??
    byName.get(normalize(LEGACY_SPELLS[normalize(bare).replace(/[^a-z ]/g, "")])) ??
    null
  );
}
// Pre-Remaster spell names NPCs still carry, and the Remaster spell each became (or the nearest one
// when the old spell is gone, like the alignment spells).
export const LEGACY_SPELLS = {
  "dancing lights": "Light", "produce flame": "Ignition", "detect alignment": "Detect Magic", "detect good": "Detect Magic", "detect evil": "Detect Magic",
  "undetectable alignment": "Disguise Magic", "misdirection": "Disguise Magic", "remove curse": "Cleanse Affliction", "remove disease": "Cleanse Affliction",
  "neutralize poison": "Cleanse Affliction", "veil": "Illusory Disguise", "sound burst": "Noise Blast", "meteor swarm": "Falling Stars",
  "commune with nature": "Commune", "deep slumber": "Sleep", "magic missile": "Force Barrage", "burning hands": "Breathe Fire",
  "color spray": "Dizzying Colors", "true strike": "Sure Strike", "ray of frost": "Frostbite", "acid splash": "Caustic Blast",
  "magic weapon": "Runic Weapon", "magic fang": "Runic Body", "mage armor": "Mystic Armor", "mage hand": "Telekinetic Hand",
  "chill touch": "Void Warp", "disrupt undead": "Vitality Lash", "finger of death": "Execute", "flesh to stone": "Petrify",
  "glitterdust": "Revealing Light", "faerie fire": "Revealing Light", "obscuring mist": "Mist", "hideous laughter": "Laughing Fit",
  "horrid wilting": "Desiccate", "tanglefoot": "Tangle Vine", "calm emotions": "Calm", "comprehend language": "Translate",
  "animate dead": "Summon Undead", "gentle repose": "Peaceful Rest", "tongues": "Truespeech", "plane shift": "Interplanar Teleport",
  // Renames the pf2e system's own compendium links record (an old NPC's spell links to its Remaster entry).
  "dimension door": "Translocate", "ray of enfeeblement": "Enfeeble", "vampiric touch": "Vampiric Feast", "see invisibility": "See the Unseen",
  "true seeing": "Truesight", "freedom of movement": "Unfettered Movement", "know direction": "Know the Way", "feeblemind": "Never Mind",
  "cloudkill": "Toxic Cloud", "abyssal pact": "Demonic Pact", "crushing despair": "Wave of Despair", "inspire courage": "Courageous Anthem",
  "baleful polymorph": "Cursed Metamorphosis", "false life": "False Vitality", "entangle": "Entangling Flora", "touch of idiocy": "Stupefy",
  "feather fall": "Gentle Landing", "prying eye": "Scouting Eye", "unseen servant": "Phantasmal Minion", "hallucinatory terrain": "Mirage",
  "modify memory": "Rewrite Memory", "discern location": "Pinpoint", "maze": "Quandary", "dimensional anchor": "Planar Tether", "stoneskin": "Mountain Resilience",
};
export function automaticCatalogRecipe(
  event,
  state,
  customRecipes = [],
  soundCatalog,
) {
  if (!state?.enabled) return null;
  const spell = findCatalogSpell(event);
  // A spell with the attack trait plays on its attack roll, not its cast card, even when its catalog entry
  // casts on use (legacy Ray of Enfeeblement rolls an attack; its remaster, Enfeeble, is a save).
  const trigger = spell?.trigger === "use" && attackSpell(event.item) ? "attack" : spell?.trigger;
  if (
    !spell ||
    trigger !== event.type ||
    !catalogSpellEnabled(spell.id, state)
  )
    return null;
  // Disabling a matching saved override must not silently revive its built-in.
  if (
    customRecipes.some(
      (r) => !r.enabled && matchRecipe([{ ...r, enabled: true }], event),
    )
  )
    return null;
  const recipe = spellRecipe(spell, undefined, {
    castRank: event.castRank ?? event.item?.rank ?? event.item?.system?.location?.heightenedLevel ?? spell.rank,
    motion: state.motion !== false,
    sounds: state.sound === false ? null : soundCatalog,
    soundVolume: state.soundVolume ?? 0.35,
  });
  return trigger === recipe.trigger ? recipe : { ...recipe, trigger };
}
const attackSpell = (item) => (item?.system?.traits?.value ?? item?.traits ?? []).includes("attack");
export function resolveAutomaticRecipe(
  event,
  state,
  customRecipes = [],
  { customEnabled = true, soundCatalog } = {},
) {
  const spell = findCatalogSpell(event);
  // Explicitly choosing the catalog preserves saved edits while bypassing
  // their trigger, media and enabled state for this spell. Customize restores
  // the saved override by removing this explicit preference.
  if (
    spell &&
    catalogSpellEnabled(spell.id, state) &&
    (state.selected?.includes(spell.id) ||
      (state.preferCatalog && !state.customized?.includes(spell.id) && !ownRecipe(customEnabled ? customRecipes : [], event)))
  )
    return automaticCatalogRecipe(event, state, [], soundCatalog);
  const configured =
    customEnabled ||
    (spell &&
      state?.enabled &&
      !state.excluded?.includes(spell.id) &&
      state.customized?.includes(spell.id))
      ? customRecipes
      : [];
  return (
    matchRecipe(configured, event) ??
    automaticCatalogRecipe(event, state, configured, soundCatalog)
  );
}
export function filterSpells({
  search = "",
  rank = "all",
  kind = "all",
  tradition = "all",
  edition = "all",
  theme = "all",
  quality = "all",
} = {}) {
  const query = normalize(search);
  return PF2E_SPELLS.filter(
    (s) =>
      (rank === "all" || s.rank === Number(rank)) &&
      (kind === "all" || s.kind === kind) &&
      (tradition === "all" || s.traditions.includes(tradition)) &&
      (edition === "all" || s.edition === edition) &&
      (theme === "all" || s.theme === theme) &&
      (quality === "all" || s.quality === quality) &&
      (!query ||
        normalize(
          `${s.name} ${s.slug} ${s.traits.join(" ")} ${s.publication}`,
        ).includes(query)),
  );
}

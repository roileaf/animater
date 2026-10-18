// Play-time element choice. Some abilities let the player pick the damage type
// or element when used (Chromatic Orb, dragon breath, Kobold Breath, Elemental
// Explosion, Resist Energy…). Catalog recipes for them are flagged
// `elementChoice`; their element-dependent stages either carry per-element
// assets (`elementAssets`) or are colorized (`elementTint`). The chosen type is
// read from the native roll/message, never inferred from the item name.

// Canonical element → [colorize hex, fallback JB2A color word].
export const ELEMENT_COLORS = {
  fire: ['#ff9a4d', 'orange'], cold: ['#8cdcff', 'blue'], electricity: ['#f3e46a', 'yellow'],
  acid: ['#a6df71', 'green'], poison: ['#8cd894', 'green'], sonic: ['#c4adf0', 'purple'],
  force: ['#c3a8f0', 'purple'], void: ['#8f6bc8', 'purple'], vitality: ['#fff0ab', 'yellow'],
  mental: ['#e29be9', 'pink'], spirit: ['#e9e4f6', 'white'], air: ['#e3eef6', 'white'],
  earth: ['#c8a27a', 'orange'], metal: ['#c1c6cc', 'grey'], water: ['#87d6ee', 'blue'], wood: ['#9de6b0', 'green'],
};
const ALIASES = { lightning: 'electricity', thunder: 'sonic', necrotic: 'void', negative: 'void', radiant: 'spirit',
  positive: 'vitality', psychic: 'mental', 'chosen-element': null };
export function normalizeElement(value) {
  const key = String(value ?? '').toLowerCase().trim();
  const element = key in ALIASES ? ALIASES[key] : key;
  return element && ELEMENT_COLORS[element] ? element : null;
}
const first = values => values.map(normalizeElement).find(Boolean) ?? null;

// PF2e/SF2e chat message: roll options, damage instances, then the item's rule selections.
export function twoeEventElement(message, systemId = 'pf2e') {
  const flags = message?.flags?.[systemId] ?? {};
  const options = flags.context?.options ?? [];
  const fromOptions = options.map(o => /^(?:item:|self:action:|action:)?damage:type:([a-z-]+)$/.exec(o)?.[1] ?? /^(?:item:)?element:([a-z]+)$/.exec(o)?.[1]).filter(Boolean);
  const instances = (message?.rolls ?? []).flatMap(r => r?.instances ?? []).map(i => i?.type ?? i?.damageType);
  const selections = Object.values(message?.item?.flags?.[systemId]?.rulesSelections ?? {}).filter(v => typeof v === 'string');
  // Last, an element trait on the rolled item (Elemental Blast in fire carries item:trait:fire).
  const traits = options.map(o => /^item:trait:([a-z]+)$/.exec(o)?.[1]).filter(Boolean);
  return first([...fromOptions, ...instances, ...selections, ...traits]);
}
// D&D 5e activity: chosen damage type on the roll, else a single damage type on the activity.
export function dnd5eEventElement(activity, rolls = []) {
  const rolled = rolls.flatMap(r => [r?.options?.type, ...(r?.options?.types ?? [])]);
  const parts = (activity?.damage?.parts ?? []).flatMap(p => p?.types ? [...p.types] : []);
  return first(rolled) ?? (new Set(parts).size === 1 ? normalizeElement(parts[0]) : null);
}

// Apply the chosen element to a flagged recipe. Unflagged recipes and unknown
// elements are returned unchanged, so authored multi-color designs never shift.
export function applyEventElement(recipe, element) {
  const chosen = normalizeElement(element);
  if (!recipe?.elementChoice || !chosen) return recipe;
  const [hex] = ELEMENT_COLORS[chosen];
  return {
    ...recipe,
    chosenElement: chosen,
    stages: recipe.stages.map(stage => {
      const swap = stage.elementAssets?.[chosen], timing = stage.elementTiming?.[chosen];
      // The element's own clip plays its own length and lands when its projectile arrives.
      if (swap?.length) return { ...stage, assets: swap, ...(timing ? { duration: timing.duration, ...(timing.contact ? { contact: timing.contact } : {}) } : {}) };
      if (stage.elementTint) return { ...stage, tintEnabled: true, colorize: true, tint: hex, hue: 0 };
      return stage;
    }),
  };
}

// Mark a catalog recipe as element-choice when its native text offers a choice
// of damage type/element. Element-dependent stages are the moving or landing
// energy (travel/projectile/impact/template); casting gestures, motion, sound
// and authored tints are left alone.
// Either an explicit "choose … damage type/element" phrase, or a choice word in
// the same sentence as a list of at least three damage types/elements.
const EXPLICIT = /\b(?:choose|choice of|chosen|select|pick)\b[^.]{0,60}\b(?:damage type|type of (?:damage|energy)|energy type|elements?|elemental trait)\b|\bdamage type (?:you|of your) cho/i;
const TYPE = '(?:acid|cold|electricity|fire|sonic|poison|lightning|thunder|force|necrotic|radiant|psychic|air|earth|metal|water|wood)';
const LIST = new RegExp(`\\b${TYPE}\\b(?:,? (?:or |and )?\\b${TYPE}\\b){2,}`, 'i');
const CHOICE_WORD = /\b(?:choose|choice|chosen|select|pick)\b/i;
export function offersElementChoice(text) {
  const t = String(text ?? '');
  if (EXPLICIT.test(t)) return true;
  return t.split(/(?<=[.!?])\s+/).some(sentence => CHOICE_WORD.test(sentence) && LIST.test(sentence));
}
// The moving or landing energy takes the element rolled at play time (applyEventElement).
export const withElementChoice = recipe => ({
  ...recipe,
  elementChoice: true,
  stages: recipe.stages.map(s => ['travel', 'projectile', 'impact', 'template'].includes(s.kind) && !s.tintEnabled && !s.catalogFx ? { ...s, elementTint: true } : s),
});
export function markElementChoice(recipe, text) {
  if (!recipe || recipe.elementChoice || !offersElementChoice(text)) return recipe;
  return withElementChoice(recipe);
}

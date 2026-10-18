// Lasting areas for systems whose catalogs carry no spell duration (PF2e, SF2e).
// The cast event holds the real item: a spell that lasts, placed as a template,
// whose name describes a standing area (a wall, a cloud, a web) keeps its area art
// on the map until the template is removed. D&D 5e marks these in its catalog build.

// Names of areas that stay on the map. Spells that only affect creatures in the
// area when cast (Calm, Fear, Slow) keep playing once, whatever their duration.
const STANDING = /\b(wall|walls|mist|fog|cloud|clouds|darkness|web|webs|grease|storm|tempest|blizzard|hurricane|zone|tentacles|spikes|stones|thorns|barrier|ground|terrain|sphere|globe|vortex|whirlpool|quicksand|bog|swamp|smoke|haze|sleet|snow|rain|veil|sanctuary|circle|field|pillar|column|maelstrom|ash|embers|brambles|briars|garden|growth|silence|haunt|miasma|pall|flora|vines)\b/i;
// Personal effects or reshaped terrain that stays as plain map, not a living area.
const NOT_AREA = /pave ground|restore ground|storm lord|shroud of flame|wall of stone|ash-strewn ending/i;
// One-off blasts sometimes share those words ("Fiery Storm Blast", "Thunder Sphere").
const BLAST = /\b(blast|burst|bolt|ray|strike|spray|wave|nova|explosion|eruption|breath)\b/i;
// The description says the area keeps acting: on whoever enters it or starts or ends a turn in it.
const STAYS = /\b(?:enters?|entering|moves? (?:into|through)|(?:starts?|ends?|start of|end of) (?:its|their|your) turns?)\b[^.]{0,40}\b(?:in|within|into) the (?:area|cloud|zone|field|darkness|fog|mist|web|wall|emanation)\b|\bthe area (?:becomes|is) (?:greater )?difficult terrain\b/i;

export function lastingDuration(text) {
  const t = String(text ?? '').toLowerCase().trim();
  return Boolean(t) && !/^instant/.test(t) && /round|minute|hour|day|sustain|unlimited|until|permanent/.test(t);
}

// An emanation centred on the caster. When the spell applies a spell effect, the
// system draws its aura from that effect (a native aura that follows the token), so
// the template stays one-shot instead of doubling it.
export function isEmanation(item) {
  return item?.system?.area?.type === 'emanation';
}
const hasAuraTrait = (item) => [item?.system?.traits?.value ?? []].flat().includes('aura');
const appliesEffect = (item) => /spell-effects|Item\.[^\]]*[Ee]ffect/.test(String(item?.system?.description?.value ?? ''));

export function isLastingArea(item) {
  if (!item || item.type !== 'spell') return false;
  const name = String(item.name ?? '');
  const duration = item.system?.duration?.value ?? item.system?.duration;
  const lasting = lastingDuration(typeof duration === 'object' ? duration?.value : duration) || item.system?.duration?.sustained === true;
  if (!lasting || BLAST.test(name) || NOT_AREA.test(name)) return false;
  const sustained = item.system?.duration?.sustained === true || /sustain/i.test(String(typeof duration === 'object' ? duration?.value : duration));
  const stays = STAYS.test(String(item.system?.description?.value ?? '').replace(/<[^>]+>/g, ' '));
  // An emanation only stays when the system calls it an aura (Divine Aura, Reaper's
  // Lantern); others just affect whoever is inside when cast (Synaptic Pulse).
  if (isEmanation(item)) return hasAuraTrait(item) && !appliesEffect(item);
  // A sustained area (Pernicious Poltergeist) or one the text says keeps acting stays too, whatever its name.
  return STANDING.test(name) || sustained || stays;
}

// Loop footage for an area that stays: JB2A's .loop twin of .complete/.burst art,
// and a ground ward circle instead of a standing hex dome.
export function lastingAsset(key, exists = () => false) {
  if (/^jb2a\.energy_field\.02\./.test(key) && exists('jb2a.magic_signs.circle.02.abjuration.loop.blue')) return 'jb2a.magic_signs.circle.02.abjuration.loop.blue';
  for (const from of ['.complete.', '.burst.']) {
    const loop = key.replace(from, '.loop.');
    if (loop !== key && exists(loop)) return loop;
  }
  return key;
}

// The first area layer persists (later layers are one-off flourishes). A recipe that
// already marks a lasting area (D&D 5e) is left as it is.
export function withLastingArea(recipe, event, { exists } = {}) {
  if (!recipe?.stages?.length || !event?.template) return recipe;
  if (recipe.systemId === 'dnd5e') return recipe;
  if (recipe.stages.some(s => s.kind === 'template' && s.persist)) return recipe;
  if (!isLastingArea(event.item)) return recipe;
  const i = recipe.stages.findIndex(s => s.kind === 'template');
  if (i < 0) return recipe;
  const stages = recipe.stages.slice();
  const s = stages[i];
  stages[i] = { ...s, persist: true, oneShot: false, fadeOut: Math.max(s.fadeOut ?? 0, 800), ...(isEmanation(event.item) ? { followSource: true } : {}), assets: [...new Set((s.assets ?? []).map(k => lastingAsset(k, exists)))] };
  return { ...recipe, stages };
}

// Whether a used item is a heavy melee weapon, so its critical hit sends a shockwave (map distortion): a PF2e/SF2e
// melee weapon (no range) held in two hands (usage) or with a two-hand trait; a D&D 5e melee weapon (simpleM,
// martialM) both heavy ("hvy") and two-handed ("two"); in any system, a weapon of the great two-handed families by
// its slug, base item or name. A ranged weapon (a longbow, a heavy crossbow) never is.
const HEAVY_SLUGS = new Set(['greataxe', 'greatsword', 'greatclub', 'maul', 'glaive', 'halberd', 'earthbreaker', 'greatpick', 'lucerne-hammer', 'pike']);
const DND_MELEE = new Set(['simpleM', 'martialM']);
const slug = (v) => String(v ?? '').toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const has = (set, key) => (set instanceof Set ? set.has(key) : Array.isArray(set) ? set.includes(key) : false);

export function heavyItem(item, systemId) {
  try {
    const sys = item?.system;
    if (!sys) return false;
    if (systemId === 'pf2e' || systemId === 'sf2e') {
      // PF2e's own test (WeaponPF2e.isMelee: no range) where the document has it.
      if (typeof item.isMelee === 'boolean' ? !item.isMelee : !!sys.range) return false;
      if (sys.usage?.value === 'held-in-two-hands') return true;
      if ((sys.traits?.value ?? []).some((t) => String(t).startsWith('two-hand'))) return true;
    }
    if (systemId === 'dnd5e') {
      if (sys.type?.value && !DND_MELEE.has(sys.type.value)) return false;
      if (has(sys.properties, 'hvy') && has(sys.properties, 'two')) return true;
    }
    return [sys.slug, sys.baseItem, sys.type?.baseItem, item.name].some((v) => HEAVY_SLUGS.has(slug(v)));
  } catch { return false; }
}

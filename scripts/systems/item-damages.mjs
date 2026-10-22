import { normalizeElement } from '../catalogs/shared/element-choice.mjs';

// Whether a used item deals damage (ground marks): a PF2e/SF2e spell with a damage (not only healing) formula, or
// a weapon or consumable with damage; a D&D 5e activity with damage parts (a heal activity has none); a
// Daggerheart action, or a weapon's attack, with hit-point damage (system.damage.main) that is not healing.
const values = (v) => (v instanceof Map ? [...v.values()] : Array.isArray(v) ? v : Object.values(v ?? {}));

export function usedItemDamages(item, systemId) {
  try {
    const sys = item?.system;
    if (!sys) return false;
    if (systemId === 'pf2e' || systemId === 'sf2e') {
      if (item.type === 'spell') return values(sys.damage).some((d) => d?.formula && [...(d.kinds ?? ['damage'])].includes('damage'));
      if (item.type === 'weapon') return Number(sys.damage?.dice) > 0 || !!sys.damage?.damageType;
      if (item.type === 'consumable') return !!sys.damage?.formula && sys.damage.kind !== 'healing';
      return false;
    }
    if (systemId === 'dnd5e') return values(sys.activities).some((a) => a?.damage?.parts?.length > 0);
    if (systemId === 'daggerheart') return [...values(sys.actions), sys.attack].some((a) => a && a.type !== 'healing' && !!a.damage?.main);
    return false;
  } catch { return false; }
}

// The element of a used item's own damage, for a play no roll names one for (a placed area): a PF2e/SF2e spell's
// or consumable's damage type, else (no damage type given) its element trait; a D&D 5e activity's single damage
// type (the used one, else across the item's activities). A choice of types, or none, is no element.
export function usedItemElement(item, systemId, activity) {
  try {
    const sys = item?.system;
    if (!sys) return null;
    const single = (types) => { const found = new Set(types.map(normalizeElement).filter(Boolean)); return found.size === 1 ? [...found][0] : null; };
    if (systemId === 'pf2e' || systemId === 'sf2e') {
      const damage = item.type === 'spell' ? values(sys.damage).filter((d) => d?.formula && [...(d.kinds ?? ['damage'])].includes('damage'))
        : item.type === 'consumable' && sys.damage?.formula && sys.damage.kind !== 'healing' ? [sys.damage] : [];
      if (!damage.length) return null;
      const types = damage.map((d) => d.type ?? d.damageType).filter(Boolean);
      return single(types.length ? types : [...(sys.traits?.value ?? [])]);
    }
    if (systemId === 'dnd5e') {
      const parts = (activity ? [activity] : values(sys.activities)).flatMap((a) => a?.damage?.parts ?? []);
      return single(parts.flatMap((p) => (p?.types ? [...p.types] : [])));
    }
    return null;
  } catch { return null; }
}

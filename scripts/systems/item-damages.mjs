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

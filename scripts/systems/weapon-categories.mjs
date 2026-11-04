// The weapon categories a system itself defines, for a recipe's Applies to: read from the system's own configuration, so a system's update or a module's added group
// shows by itself. Pure: main.mjs hands in CONFIG and the localizer. [{ label, entries: { scope: name } }], the scopes as core/model.mjs weaponClassOf reads them.

const named = (table, prefix, localize) => {
  const out = Object.entries(table ?? {}).map(([id, value]) => {
    const key = typeof value === 'string' ? value : value?.label;
    return [`${prefix}:${id}`, String(key ? localize(key) : id)];
  }).filter(([scope]) => /^[a-z]+:[\w-]{1,40}$/.test(scope));
  return Object.fromEntries(out.sort((a, b) => a[1].localeCompare(b[1])));
};
const kept = (groups) => groups.filter((g) => Object.keys(g.entries).length);

export function weaponCategories(systemId, config = {}, localize = (key) => key) {
  if (systemId === 'pf2e' || systemId === 'sf2e') return kept([
    { label: 'Weapon categories', entries: named(config.PF2E?.weaponCategories, 'category', localize) },
    { label: 'Weapon groups', entries: named(config.PF2E?.weaponGroups, 'group', localize) },
  ]);
  if (systemId === 'dnd5e') return kept([{ label: 'Weapon types', entries: named(config.DND5E?.weaponTypes, 'type', localize) }]);
  // Daggerheart has no weapon groups: a weapon is told by its slot, its burden, its range and the trait it rolls.
  if (systemId === 'daggerheart') {
    const { self: _self, ...ranges } = config.DH?.GENERAL?.range ?? {};
    return kept([
      { label: 'Weapon slot', entries: config.DH ? { 'slot:primary': 'Primary', 'slot:secondary': 'Secondary' } : {} },
      { label: 'Burden', entries: named(config.DH?.GENERAL?.burden, 'burden', localize) },
      { label: 'Range', entries: named(ranges, 'range', localize) },
      { label: 'Trait', entries: named(config.DH?.ACTOR?.abilities, 'trait', localize) },
    ]);
  }
  // Draw Steel's strikes are abilities, told by their keywords (Weapon, Melee, Ranged, Strike, Magic...).
  if (systemId === 'draw-steel') return kept([{ label: 'Ability keywords', entries: named(config.DS?.abilities?.keywords, 'keyword', localize) }]);
  return [];
}

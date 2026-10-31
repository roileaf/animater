const SA = 'spell-arsenal';
const KINDS = { template: 'area', damage: 'damage', use: 'caster' };
const normalized = value => String(value ?? '').trim().toLowerCase();
// Same matching as Spell Arsenal's runner: enabled rule, trigger kind and spell name.
export function spellArsenalRule(event, g = globalThis.game) {
  const kind = KINDS[event?.type];
  if (!kind || !g?.modules?.get(SA)?.active || !g.modules.get('tile-arsenal')?.active || !g.users?.activeGM) return null;
  let rules;
  try {
    if (!g.settings.get(SA, 'enabled')) return null;
    rules = g.settings.get(SA, 'rules');
  } catch { return null; }
  if (!Array.isArray(rules)) return null;
  const item = event.item;
  if (kind !== 'area' && !(item?.type === 'spell' || item?.isOfType?.('spell'))) return null;
  const names = [kind === 'area' ? event.template?.flags?.[event.systemId ?? g.system?.id]?.origin?.name : null, item?.name]
    .filter(Boolean).map(normalized);
  return rules.find(rule => rule?.enabled && rule.effect && rule.kind === kind && names.includes(normalized(rule.spell))) ?? null;
}
// Mapped areas always belong to Spell Arsenal (tiles, plus Animater when opted in).
// Opted-in damage/cast rules play Animater from Spell Arsenal's GM runner instead.
export const spellArsenalClaims = (event, g) => {
  const rule = spellArsenalRule(event, g);
  return Boolean(rule && (rule.kind === 'area' || rule.animater === true));
};
// A claimed placed area still leaves Animater's ground mark (`markArea(event)`): Spell Arsenal draws the spell, the
// floor keeps its scorch like any other Fireball's. Spell Arsenal's own Animater plays never mark.
export function registerSpellArsenal(hooks = globalThis.Hooks, { markArea } = {}) {
  return hooks?.on?.('animater.preDispatch', event => {
    if (!spellArsenalClaims(event)) return undefined;
    if (event.type === 'template') try { markArea?.(event); } catch (error) { console.warn('Animater | Spell Arsenal area mark skipped', error); }
    return false;
  });
}

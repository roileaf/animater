export const TA_ID = 'trigger-animations';
export const TA_FILL_GAPS = 'taFillGaps';
// Trigger Animations fires animation-events named "<moment>:<slug or uuid>" (attack:longsword,
// template:fireball, condition:frightened). These are the names it would fire for this event.
const slugOf = item => item.slug ?? item.system?.slug ?? String(item.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function moments(event) {
  const item = event.item;
  if (event.type === 'effect') return [item.type === 'condition' ? 'condition' : 'effect'];
  if (event.type === 'use') return event.skillCheck ? ['check'] : ['template', 'attack', 'damage', 'check'];
  return ['attack', 'damage', 'template', 'check'].includes(event.type) ? [event.type] : [];
}
export function taNames(event) {
  const item = event?.item;
  if (!item) return [];
  const keys = [slugOf(item), item.uuid ?? event.itemUuid];
  // A weapon's triggers may name its base item or group (attack:longsword, attack:sword).
  if (['weapon', 'melee'].includes(item.type)) keys.push(item.system?.baseItem ?? item.baseItem, item.system?.group ?? item.group);
  const named = [...new Set(keys.filter(Boolean))];
  return moments(event).flatMap(m => named.map(k => `${m}:${k}`));
}
// Does a Trigger Animations trigger name this event outright? Wildcards ("damage:*", as Trigger
// Animations Trove ships) do not count, so only triggers made for the item claim it.
export function taAnimates(event, api = globalThis.triggerAnimations?.api) {
  const names = taNames(event);
  if (!names.length || typeof api?.matchTrigger !== 'function') return false;
  try { return Boolean(api.matchTrigger(names.join(','), { literalOnly: true })); } catch { return false; }
}

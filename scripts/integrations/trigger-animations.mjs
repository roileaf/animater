export const TA_ID = 'trigger-animations';
export const TA_FILL_GAPS = 'taFillGaps';
export const TA_TAKEOVER = 'taTakeover';
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
// The event behind one of Trigger Animations' own animation-events ({ name: "attack:<uuid>,attack:longsword", item,
// actor, sources, targets }, as its system triggers post them), in Animater's terms; null for moments Animater has no
// part in (checks, damage taken, healing) and for an animation chained from another (it carries a sequence).
const TA_MOMENTS = { action: 'use', attack: 'attack', template: 'template', effect: 'effect', condition: 'effect' };
export function taEvent(payload, { systemId, fromUuid = globalThis.fromUuidSync } = {}) {
  if (!payload || payload.sequence) return null;
  const moment = String(payload.name ?? '').split(',')[0].trim().split(':')[0], type = TA_MOMENTS[moment];
  let item = payload.item;
  if (typeof item === 'string') { try { item = fromUuid?.(item) ?? null; } catch { item = null; } }
  if (!type || !item || typeof item !== 'object') return null;
  const first = (v) => (Array.isArray(v) || v instanceof Set ? [...v][0] : v);
  const source = first(payload.sources);
  return { systemId, type, moment, item, actor: payload.actor ?? item.actor, source: source?.object ?? source,
    targets: [...(payload.targets ?? [])].map((t) => t?.object ?? t) };
}
// "Take over from Trigger Animations": its animation-events all run through api.runFromTrigger (its StartHook sets
// it there when enabled), so Animater stands in front of it and drops those it plays itself. A trigger made for this
// very item (naming its UUID) keeps it, as a customized item does in Automated Animations. Synchronous; never throws.
export function registerTATakeover({ api = () => globalThis.triggerAnimations?.api, enabled, resolve, systemId }) {
  const target = api();
  if (!target || target.animaterTakeover) return false;
  let inner = target.runFromTrigger;
  const ownTrigger = (event) => {
    const uuid = event.item.uuid;
    try { return Boolean(uuid && target.matchTrigger?.(`${event.moment}:${uuid}`, { literalOnly: true })); } catch { return false; }
  };
  function runFromTrigger(payload, ...rest) {
    try {
      const event = enabled() ? taEvent(payload, { systemId: systemId() }) : null;
      if (event && !ownTrigger(event) && resolve(event)) return undefined;
    } catch (error) {
      console.warn('Animater: Trigger Animations takeover', error);
    }
    return inner?.call(this, payload, ...rest);
  }
  // Trigger Animations sets it again on enable and disable: keep its own behind ours.
  Object.defineProperty(target, 'runFromTrigger', { configurable: true, enumerable: true, get: () => runFromTrigger, set: (fn) => { inner = fn; } });
  target.animaterTakeover = true;
  return true;
}

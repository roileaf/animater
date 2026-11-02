// Draw Steel 1.1.2 shapes as live documents expose them to hooks: the "standard" ChatMessage
// AbilityModel#use creates, whose system.parts hold an abilityUse part and one abilityResult part per
// tier rolled, each with its PowerRolls (options.target: the target actor's uuid) and DamageRolls.
// Parts are plain objects here (a Collection there); `ability` is the parts' getter.
const slug = (name) => String(name).replace(/\W/g, "");
export const hero = { id: "hero", uuid: "Actor.hero", documentName: "Actor", name: "Hero", type: "hero" };
export const goblin = { id: "gob", uuid: "Actor.gob", documentName: "Actor", name: "Goblin", type: "npc" };
// An ability Item: keywords, distance and target types, and its power roll effects.
export function ability(name, { keywords = ["melee", "strike", "weapon"], distance = "melee", target = "creature", damage = [[]], applied = [], actor = hero, reactive = false } = {}) {
  const effects = {};
  damage.forEach((types, i) => { effects[`dmg${i}`] = { type: "damage", damage: { tier1: { value: "3", types }, tier2: { value: "5", types }, tier3: { value: "8", types } } }; });
  applied.forEach((condition, i) => { effects[`app${i}`] = { type: "applied", applied: { tier1: { effects: {} }, tier2: { effects: {} }, tier3: { effects: { [condition]: { condition: "failure", end: "save" } } } } }; });
  return { id: `a${slug(name)}`, uuid: `${actor.uuid}.Item.a${slug(name)}`, documentName: "Item", type: "ability", name, actor,
    system: { keywords: new Set(keywords), type: "main", category: "", distance: { type: distance }, target: { type: target }, story: "",
      power: { roll: { reactive, enabled: !reactive && Object.keys(effects).length > 0 }, effects } } };
}
// A PowerRoll: 2d10 + modifier; the natural result decides the critical (19+).
export function powerRoll({ natural = 12, modifier = 2, target = null, criticalThreshold = 19 } = {}) {
  return { class: "PowerRoll", total: natural + modifier, options: { type: "ability", criticalThreshold, ...(target ? { target } : {}) },
    terms: [{ class: "Die", faces: 10, number: 2, results: [{ result: Math.ceil(natural / 2), active: true }, { result: Math.floor(natural / 2), active: true }] }] };
}
export const damageRoll = ({ type = "", total = 5, aoe = false } = {}) => ({ class: "DamageRoll", total, options: { type, aoe } });
const tierOf = (natural, modifier) => (natural >= 19 ? 3 : natural + modifier >= 17 ? 3 : natural + modifier >= 12 ? 2 : 1);
// The message of one use: `targets` [{ uuid, natural }] each roll on their own; none rolls once.
export function abilityMessage(item, { id = "msg1", author = "u", speaker = { scene: "s", token: "t" }, targets = [], natural = 12, modifier = 2, damageType = null, whisper = [], blind = false } = {}) {
  const parts = { abilityUse00000000: { _id: "abilityUse00000000", type: "abilityUse", abilityUuid: item.uuid, ability: item, rolls: [] } };
  if (item.system.power.roll.enabled) {
    const rolls = targets.length ? targets.map((t) => powerRoll({ natural: t.natural ?? natural, modifier, target: t.uuid })) : [powerRoll({ natural, modifier })];
    for (const roll of rolls) {
      const natural = roll.total - modifier, tier = tierOf(natural, modifier), key = `tier${tier}Result`.padEnd(16, "0");
      parts[key] ??= { _id: key, type: "abilityResult", tier, abilityUuid: item.uuid, ability: item, rolls: [] };
      parts[key].rolls.push(roll);
    }
    const types = Object.values(item.system.power.effects).filter((e) => e.type === "damage").map((e) => e.damage.tier1.types[0] ?? "");
    for (const part of Object.values(parts).filter((p) => p.type === "abilityResult")) for (const type of types) part.rolls.push(damageRoll({ type: damageType ?? type, total: 3 + part.tier * 2 }));
  }
  return { id, type: "standard", author: { id: author }, speaker, whisper, blind, title: item.name, content: item.name, rolls: [], system: { parts } };
}

// Hit points per system, for the kill path and finishers. PF2e, SF2e and D&D 5e count HP down to 0
// at system.attributes.hp; Daggerheart marks hit points up to their maximum at
// system.resources.hitPoints, and a companion marks stress instead (its takeDamage marks stress).
// Pure: main.mjs passes game.system.id.
export function hpPath(actor, systemId) {
  if (systemId !== "daggerheart") return "system.attributes.hp.value";
  return actor?.type === "companion" ? "system.resources.stress.value" : "system.resources.hitPoints.value";
}

// { value, max, down, marked }: `marked` tracks count up (Daggerheart), others count down.
// null when the actor has no readable track.
export function hpState(actor, systemId) {
  if (systemId === "daggerheart") {
    const track = actor?.type === "companion" ? actor?.system?.resources?.stress : actor?.system?.resources?.hitPoints;
    const value = Number(track?.value), max = Number(track?.max);
    if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
    return { value, max, down: max > 0 && value >= max, marked: true };
  }
  const hp = actor?.system?.attributes?.hp, value = Number(hp?.value);
  if (!Number.isFinite(value)) return null;
  return { value, max: Number(hp?.max), down: value <= 0, marked: false };
}

// What an HP update did to a creature that was not already down: { dropped } when it was harmed
// (lost HP, or marked more), null for healing, no change, an unreadable track or one already down.
export function hpChange(before, after) {
  if (!before || !after || before.down) return null;
  const harmed = before.marked ? after.value > before.value : after.value < before.value;
  return harmed ? { dropped: after.down } : null;
}

export const isKillTransition = (before, after) => hpChange(before, after)?.dropped === true;

// Who a kill finisher plays on: PF2e/SF2e/D&D NPC actors; in Daggerheart an adversary, or any
// creature no player owns (a GM-run character or companion).
export function isNpcActor(actor, systemId, { playerOwned = false } = {}) {
  if (!actor) return false;
  if (systemId === "daggerheart") return actor.type === "adversary" || !playerOwned;
  return actor.type === "npc";
}

// The hp displaceAllowed checks (hidden/Defeated writes need it at or below 0): the HP value where it
// counts down, 0 or 1 for a marked track that is down or not, NaN when unreadable.
export function displaceHp(actor, systemId) {
  const state = hpState(actor, systemId);
  if (!state) return Number.NaN;
  return state.marked ? (state.down ? 0 : 1) : state.value;
}

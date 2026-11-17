// What a won roll is allowed to do, and what the choice the GM makes writes. Pure: no Foundry globals.
//
// A success is not always the same thing twice. Sherp, who plays with this: "GM prompt on success of lock pick or
// force open to allow GM to control when it breaks or opens to help time it with GM explanation of the scene." So
// where the GM has asked to be asked, nothing moves until they say so — the dialog standing open is the timing, and
// there is no roll kept in hand to apply later, which would only be a second thing to remember. On a door whose own
// rules leave room for it, they may also say something other than "it breaks":
//
//   open    a critical success forces it without wrecking it. Only a critical: an ordinary success breaking the door
//           is what the rules say happens, and a GM who wants it anyway can open the door themselves.
//   damage  a door with HP takes a blow the GM measures and keeps standing. Only where doors have HP at all, which
//           is PF2e (door-attack.mjs, Table 11-4). Its own Hardness comes off first, as any other blow's does, so a
//           number big enough still breaks it — the GM is deciding how hard it was hit, not whether it survived.
//
// A window is never here: Force Open does not reach one, and no window has HP. Picking a lock is the plainer case —
// it opens or it does not — and the same waiting applies to it.
import { DOOR_ATTACK_SYSTEMS, wallDamageResult } from "./door-attack.mjs";

export const FORCE_CHOICES = Object.freeze({
  break: "Break it open",
  open: "Open it, unbroken",
  damage: "It holds, and takes damage",
  none: "It does not open",
});
export const PICK_CHOICES = Object.freeze({ open: "Unlock it", none: "It stays locked" });
export const MAX_FORCE_DAMAGE = 999;

/**
 * What a won Force Open roll may be told to do, in the order a dialog should offer it. Breaking it open comes first
 * because it is what the roll already did; the others are the GM's to reach for.
 */
export function forceOpenChoices({ crit = false, system } = {}) {
  const out = ["break"];
  if (crit === true) out.push("open");
  if (DOOR_ATTACK_SYSTEMS.has(system)) out.push("damage");
  out.push("none");
  return out;
}

/** What a won lockpicking roll may be told to do. */
export function pickLockChoices() {
  return ["open", "none"];
}

/**
 * A blow the GM measured against a door's own Hardness and HP: what it did and where that leaves the door. Exactly
 * the arithmetic a Strike at the door goes through (doorDamage), so the two can never say different things about the
 * same door. A door taken to 0 reads as broken, and the shell breaks it rather than writing 0 HP and walking away.
 */
export function forceDamageResult({ own = {}, material = "wood", damage = 0 } = {}) {
  const n = Number(damage), want = Number.isFinite(n) ? Math.max(0, Math.min(MAX_FORCE_DAMAGE, Math.floor(n))) : 0;
  return wallDamageResult({ own, kind: "door", material, damage: want });
}

/**
 * Where a lock stands when the GM says it does not give after all: on the brink, so the next success opens it and
 * nothing that was won is taken back — the same rule picking a lock goes by everywhere else.
 */
export function lockHeldProgress(needed) {
  const n = Number.isInteger(needed) ? needed : 1;
  return Math.max(0, n - 1);
}

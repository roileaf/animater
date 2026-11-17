// Picking a locked door, from the door itself: the lock's quality and the DC that goes with it, the prompt's words,
// what a roll message did to the lock, and how far along a lock that takes more than one success now is.
// Pure: no Foundry globals. The GM always judges a roll against the lock it reads from the wall, never the one the
// message claims — the same rule Force Open goes by.
//
// Whose rules these are. The roll happens in every system that has a Force Open roll, each with its own skill and
// difficulty. PF2e's own consequences stay PF2e's (and SF2e's, which prints the same action word for word): a lock
// that takes several successes, a critical success worth two of them, and a critical failure that breaks your picks.
// Giving Daggerheart or Draw Steel a broken toolkit would be a house rule nobody asked for, so elsewhere one success
// opens the lock and a bad roll is only a bad roll.
import { FORCE_OPEN_SYSTEMS, natural20, pf2eDegree } from "./force-open.mjs";

export const PICK_LOCK_SYSTEMS = FORCE_OPEN_SYSTEMS;
// The systems that count successes and break picks: the ones whose own Pick a Lock action says so.
const COUNTS_SUCCESSES = new Set(["pf2e", "sf2e"]);

/**
 * The locks, as PF2e's own items have them: a poor lock takes two successful DC 15 Thievery checks, and so on up.
 * (The simple lock is printed at DC 20 in the item entry; one secondary source gives 17. The GM's own DC on the
 * door always wins, so the disagreement costs nothing.)
 */
export const LOCKS = Object.freeze({
  poor: { label: "Poor lock", dc: 15, successes: 2 },
  simple: { label: "Simple lock", dc: 20, successes: 3 },
  average: { label: "Average lock", dc: 25, successes: 4 },
  good: { label: "Good lock", dc: 30, successes: 5 },
  superior: { label: "Superior lock", dc: 40, successes: 6 },
});
export const LOCK_DEFAULT = "average";
export const LOCK_QUALITIES = Object.freeze(Object.keys(LOCKS));

// D&D 5e counts on a different scale: its own typical lock is DC 15, and its table tops out at 30 for the nearly
// impossible, so PF2e's ladder (which runs to 40) would put a superior lock out of reach of any party that ever
// plays. These are 5e's own difficulties — easy, then up through hard and very hard.
const DND5E_DC = { poor: 10, simple: 12, average: 15, good: 20, superior: 25 };
// Daggerheart has no lock table of its own, so these are ours, set at the same remove from its difficulties as the
// Force Open ones already shipped. Draw Steel has no DC at all: its power roll goes by tier, as Force Open does.
const DAGGERHEART_DC = { poor: 11, simple: 13, average: 16, good: 19, superior: 22 };
const DRAW_STEEL_TIER = { poor: 2, simple: 2, average: 2, good: 3, superior: 3 };
const MAX_DC = 60;
const MAX_SUCCESSES = 20;
const WORDING = {
  pf2e: { skill: "Thievery", label: "Pick the lock", dc: "DC" },
  sf2e: { skill: "Thievery", label: "Pick the lock", dc: "DC" },
  // 5e picks a lock with thieves' tools, not Sleight of Hand: that is what tool proficiency is for.
  dnd5e: { skill: "Dexterity (thieves' tools)", label: "Pick the lock", dc: "DC" },
  daggerheart: { skill: "Finesse", label: "Pick the lock", dc: "Difficulty" },
  "draw-steel": { skill: "Agility", label: "Pick the lock", dc: null },
};
const PF2E_TIERS = ["criticalFailure", "failure", "success", "criticalSuccess"];
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const whole = (raw) => {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return Number.isInteger(n) ? n : null;
};

/** The lock's quality on a door (breakWall.lock), else the default. Anything unrecognised is not a choice. */
export function lockQualityOf(own) {
  const q = own?.lock;
  return Object.hasOwn(LOCKS, q) ? q : LOCK_DEFAULT;
}

/** The GM's own DC on a lock (breakWall.lockDC, 1 to 60, maybe saved as text), else null. */
export function ownLockDC(own) {
  const n = whole(own?.lockDC);
  return n !== null && n >= 1 && n <= MAX_DC ? n : null;
}

/** The DC this lock is picked against: the GM's own, else its quality's in this system. Null where there is none. */
export function lockDCOf(own, system) {
  if (system === "draw-steel") return null;
  const own_ = ownLockDC(own);
  if (own_ !== null) return own_;
  const quality = lockQualityOf(own);
  if (system === "daggerheart") return DAGGERHEART_DC[quality];
  if (system === "dnd5e") return DND5E_DC[quality];
  return PICK_LOCK_SYSTEMS.has(system) ? LOCKS[quality].dc : null;
}

/** The power-roll tier a lock yields to, for the system that has no DC. */
export const lockTierOf = (own) => DRAW_STEEL_TIER[lockQualityOf(own)];

/** The GM's own number of successes on a lock (breakWall.lockSuccesses, 1 to 20, maybe saved as text), else null. */
export function ownLockSuccesses(own) {
  const n = whole(own?.lockSuccesses);
  return n !== null && n >= 1 && n <= MAX_SUCCESSES ? n : null;
}

/**
 * How many successes this lock takes. The GM's own number wins wherever they set one, in every system — the same rule
 * their own DC goes by, and a door that takes more or fewer ways in than its quality says is the GM's call to make.
 * Left blank: PF2e and SF2e count them, because their own action does; everywhere else one success opens it, which is
 * what those systems' rules actually say about locks.
 */
export function lockSuccessesNeeded(own, system) {
  return ownLockSuccesses(own) ?? (COUNTS_SUCCESSES.has(system) ? LOCKS[lockQualityOf(own)].successes : 1);
}

/** How far along this lock already is (breakWall.lockProgress), never below zero and never past what it takes. */
export function lockProgressOf(own, system) {
  const n = whole(own?.lockProgress);
  return Math.max(0, Math.min(lockSuccessesNeeded(own, system) - 1, n === null ? 0 : n));
}

/** The prompt's words for this system, or null where there is no roll for it. */
export function pickLockWording(system) {
  const w = WORDING[system];
  return w ? { ...w } : null;
}

/**
 * What the door asks. Shows how far along a lock is only when it takes more than one success and has been started,
 * so an ordinary lock reads as plainly as Force Open does.
 */
export function pickLockPrompt({ system, dc, showDC = true, progress = 0, needed = 1 } = {}) {
  const w = WORDING[system];
  if (!w) return null;
  const left = needed > 1 ? ` (${progress} of ${needed} ways in)` : "";
  if (!w.dc) return `Pick the lock? ${w.skill} test${left}`;
  if (!showDC || !isNum(dc)) return `Pick the lock? ${w.skill}${left}`;
  return `Pick the lock? ${w.skill} vs ${w.dc} ${dc}${left}`;
}

function drawSteelTier(roll) {
  const p = Number(roll?.product);
  if (p === 1 || p === 2 || p === 3) return p;
  const total = Number(roll?.total);
  return 1 + [12, 17].filter((t) => total >= t).length;
}
const daggerheartCritical = (roll) => {
  if (roll?.isCritical === true || roll?.options?.roll?.isCritical === true) return true;
  const hope = roll?.dHope?.total, fear = roll?.dFear?.total;
  return isNum(hope) && hope === fear && isNum(hope);
};

/**
 * What this roll message did to the lock, judged against the DC the GM read from the wall:
 *   gained  successes won (2 for a critical success where successes are counted, else 1, else 0)
 *   breaks  the picks broke (a critical failure, where that is this system's rule)
 *   why     "roll" when the message carries no roll at all, "outcome" when it simply did not get in
 * Nothing here opens anything: lockPicked says whether the lock is open once the gain is added.
 */
export function pickLockResult({ system, message, dc, own } = {}) {
  const roll = (system === "daggerheart" ? message?.system?.roll : null) ?? Array.from(message?.rolls ?? [])[0];
  const total = Number(roll?.total);
  if (!roll || !Number.isFinite(total) || !PICK_LOCK_SYSTEMS.has(system)) return { gained: 0, breaks: false, why: "roll" };
  const counts = COUNTS_SUCCESSES.has(system);
  const won = (gained, breaks = false) => ({ gained, breaks, ...(gained ? {} : { why: "outcome" }) });

  if (system === "draw-steel") return won(drawSteelTier(roll) >= lockTierOf(own) ? 1 : 0);
  if (!isNum(dc)) return won(0);
  if (counts) {
    // The system's own outcome when it was rolled against this same DC, else PF2e's degrees from the total.
    const ctx = message?.flags?.[system]?.context ?? message?.flags?.pf2e?.context;
    const outcome = ctx?.outcome && Number(ctx?.dc?.value) === dc ? ctx.outcome : PF2E_TIERS[pf2eDegree(total, dc, natural20(roll))];
    if (outcome === "criticalSuccess") return won(2);
    if (outcome === "success") return won(1);
    if (outcome === "criticalFailure") return { gained: 0, breaks: true, why: "outcome" };
    return won(0);
  }
  if (system === "daggerheart") return won(daggerheartCritical(roll) || total >= dc ? 1 : 0);
  return won(total >= dc ? 1 : 0);
}

/**
 * Where the lock stands after a roll that gained this much: the progress to store and whether it is open.
 * Progress is never lost — PF2e's action takes nothing back on a failure, not even a critical one.
 */
export function lockPicked({ progress = 0, gained = 0, needed = 1 } = {}) {
  const was = Math.max(0, whole(progress) ?? 0), want = Math.max(1, whole(needed) ?? 1);
  const now = was + Math.max(0, whole(gained) ?? 0);
  return now >= want ? { opened: true, progress: 0 } : { opened: false, progress: now };
}

/** What the GM is told happened, in words, for the one line this posts. */
export function pickLockLine({ opened, breaks, gained, progress, needed, name = "The lock" } = {}) {
  if (opened) return `${name} is open.`;
  if (breaks) return `${name} holds, and the picks break.`;
  if (!gained) return `${name} holds.`;
  return needed > 1 ? `${name} gives a little: ${progress} of ${needed} ways in.` : `${name} holds.`;
}

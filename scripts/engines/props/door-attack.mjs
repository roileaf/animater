// Attacking a door (PF2e): the door's AC, Hardness, HP and Broken Threshold (its own, else Table 11-4 by material), what
// a hit does to its HP, whether a Strike reaches it, and the GM's check of an attack and its damage from its own copies
// of the two chat messages. Pure: no Foundry globals. A door at 0 HP breaks through the wall-break relay (cause "attack").
import { wallTraits } from "./wall-break.mjs";
import { onLevel, segRectDist } from "./prop-pick.mjs";
import { pf2eDegree, natural20 } from "./force-open.mjs";

export const DOOR_ATTACK_SYSTEMS = new Set(["pf2e"]);
// Table 11-4: a simple wooden door, a reinforced wooden one, iron or steel, and a stone structure.
const STATS = {
  wood: { ac: 10, hardness: 5, maxHp: 20, bt: 10 },
  reinforced: { ac: 10, hardness: 10, maxHp: 40, bt: 20 },
  metal: { ac: 10, hardness: 9, maxHp: 36, bt: 18 },
  stone: { ac: 10, hardness: 14, maxHp: 56, bt: 28 },
};
export const DOOR_STAT_KEYS = ["ac", "hardness", "maxHp", "bt"];
const MIN = { ac: 1, hardness: 0, maxHp: 1, bt: 0 }, MAX = 999;
export const HITS_KEPT = 200; // the attack and damage message ids a door remembers, so each is applied once
const WINS = ["success", "criticalSuccess"];
// Whether a PF2e roll message was rolled at a target (its context's or its own target).
const targeted = (m) => { const c = m?.flags?.pf2e?.context; return !!(c?.target || m?.flags?.pf2e?.target); };
const footprint = (t) => [t?.x, t?.y, t?.w, t?.h].every(Number.isFinite);
const str = (v) => (typeof v === "string" && v ? v.slice(0, 64) : null);

// Table 11-4 structures, for a breakable plain wall (wall-break.mjs kind "wall"): a wooden, brick, stone or iron one.
// Recorded and shown in Wall Configuration; walls have no Attack yet (they break from blasts, spells, slams and the GM).
const WALL_STATS = {
  wood: { hardness: 10, maxHp: 40, bt: 20 },
  brick: { hardness: 12, maxHp: 48, bt: 24 },
  stone: { hardness: 14, maxHp: 56, bt: 28 },
  metal: { hardness: 18, maxHp: 72, bt: 36 },
};
export function defaultWallStats(material) {
  return { ...(WALL_STATS[material] ?? WALL_STATS.wood) };
}

export function defaultDoorStats(material) {
  return { ...(STATS[material] ?? STATS.wood) };
}

// The GM's own value for one stat (a whole number, maybe saved as text; AC and HP at least 1), else null (Automatic).
export function ownDoorStat(own, key) {
  const raw = own?.[key], n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return Number.isInteger(n) && n >= (MIN[key] ?? 0) && n <= MAX ? n : null;
}

export function doorStats(own, material) {
  const base = defaultDoorStats(material), out = {};
  for (const k of DOOR_STAT_KEYS) out[k] = ownDoorStat(own, k) ?? base[k];
  return out;
}

// The door's HP now: breakWall.hp when it is a whole number from 0 to its maximum, else full (never hit, or repaired).
export function doorHp(own, stats) {
  const hp = own?.hp;
  if (!Number.isInteger(hp) || hp < 0) return stats.maxHp;
  return Math.min(hp, stats.maxHp);
}

// A hit of `damage`: Hardness comes off first, the rest off its HP (never below 0).
export function doorDamage({ hp, damage, hardness }) {
  const d = Number(damage), past = Number.isFinite(d) ? Math.max(0, Math.floor(d) - Math.max(0, hardness)) : 0;
  const dealt = Math.min(past, hp);
  return { dealt, hp: hp - dealt };
}

// Cracked: at or below its Broken Threshold while it still stands (at 0 its wreck shows instead).
export function doorCracked(own, stats) {
  const hp = doorHp(own, stats);
  return hp > 0 && hp <= stats.bt && hp < stats.maxHp;
}

export function doorHpLine({ hp, maxHp, dealt, hardness, cracked = false }) {
  const left = `${hp} of ${maxHp} HP left.`;
  if (!dealt) return `Door: the blow does not get past its Hardness ${hardness}. ${left}`;
  if (hp <= 0) return `Door: ${left} It breaks.`;
  return cracked ? `Door: ${left} It is cracked.` : `Door: ${left}`;
}

// Whether a Strike {ranged, feet} from this token's footprint {x, y, w, h, level} reaches the door: null, else why
// ("level", "far", "sight"). A melee Strike reaches a door within its reach (5 feet: a door within a square of the
// token, as Force Open); a ranged or thrown one reaches it within its maximum range with line of sight (sight: the
// GM's own wall test, true when nothing blocks the line to the door).
export function strikeReaches({ token, wall, grid = 100, gridDistance = 5, strike, sight } = {}) {
  if (!footprint(token) || !Array.isArray(wall?.c)) return "far";
  if (!onLevel(wall.levels, token.level)) return "level";
  const feet = Number(strike?.feet), per = Number(gridDistance) > 0 ? Number(gridDistance) : 5;
  if (!Number.isFinite(feet) || feet <= 0) return "far";
  const [x1, y1, x2, y2] = wall.c, d = segRectDist({ x: x1, y: y1 }, { x: x2, y: y2 }, { x: token.x, y: token.y, width: token.w, height: token.h });
  if ((d / grid) * per > feet + 0.01) return "far";
  if (strike.ranged === true && sight !== true) return "sight";
  return null;
}

// A PF2e Strike's identifier on its attack roll: "itemId.slug.melee|ranged".
export function strikeIdentifier(id) {
  if (typeof id !== "string") return null;
  const m = /^([^.]+)\.([^.]*)\.(melee|ranged)$/.exec(id);
  return m ? { itemId: m[1], slug: m[2], use: m[3] } : null;
}

// The door attack a message carries (flags.animater.doorAttack, stamped by the client that rolled it from the door):
// {wallId, tokenId, sceneId, attackId (on the damage roll: its attack's message), authorId}, else null.
export function doorAttackOf(message) {
  const f = message?.flags?.animater?.doorAttack;
  if (!f || typeof f !== "object") return null;
  const wallId = str(f.wallId), tokenId = str(f.tokenId);
  if (!wallId || !tokenId) return null;
  return { wallId, tokenId, sceneId: str(f.sceneId), attackId: str(f.attackId), authorId: (message.author ?? message.user)?.id ?? null };
}

// The attack roll's degree of success against the door's AC as the GM reads it (0-3), null without a roll.
export function attackDegree(message, ac) {
  const roll = Array.from(message?.rolls ?? [])[0], total = Number(roll?.total);
  return Number.isFinite(total) ? pf2eDegree(total, ac, natural20(roll)) : null;
}

// The GM's check of a door hit: {ok: true, hp, dealt, maxHp, hardness, bt, cracked, broken, hits} or {ok: false, why}.
// attack, damage: the GM's copies of the attack and damage messages; token: the striker's footprint {x, y, w, h, level,
// authorOwns, actorId} on this scene (authorOwns: the messages' author owns it); strike: {ranged, feet} as the GM reads
// the Strike from the actor (undefined when it is not there); sight: the GM's line-of-sight test; used: this GM applied
// that damage already; walls: the scene's walls (a roll applied to any door of the scene is spent). Neither roll may
// have a target: a door Strike is rolled at no one, so damage rolled at a creature is never the door's. The AC, Hardness
// and HP are the GM's own, read from the wall.
export function doorAttackCheck({ wall, scene, grid = 100, gridDistance = 5, sender, attack, damage, token, strike, sight, system, used = false, walls = [] } = {}) {
  const no = (why) => ({ ok: false, why });
  if (scene?.flags?.animater?.breakableProps !== true || scene.flags.animater.breakWalls === false) return no("off");
  if (!DOOR_ATTACK_SYSTEMS.has(system)) return no("system");
  if (!sender) return no("sender");
  if (sender.viewedScene !== scene.id) return no("scene");
  if (!wall) return no("missing");
  const own = wall.flags?.animater?.breakWall ?? {};
  if (own.broken) return no("broken");
  const traits = wallTraits(wall, scene, system);
  if (traits.kind !== "door") return no("kind");
  if (wall.ds === 1) return no("open");
  const A = doorAttackOf(attack), D = doorAttackOf(damage);
  if (!A || !D) return no("roll");
  if (A.authorId !== sender.id || D.authorId !== sender.id) return no("sender");
  const actx = attack.flags?.pf2e?.context, dctx = damage.flags?.pf2e?.context;
  if (actx?.type !== "attack-roll" || dctx?.type !== "damage-roll" || dctx.sourceType !== "attack") return no("roll");
  if (targeted(attack) || targeted(damage)) return no("target");
  if (A.wallId !== wall.id || D.wallId !== wall.id) return no("kind");
  if (D.attackId !== attack.id || D.tokenId !== A.tokenId) return no("roll");
  const sid = strikeIdentifier(actx.identifier), origin = damage.flags?.pf2e?.origin?.uuid;
  if (!sid || !actx.actor || dctx.actor !== actx.actor || typeof origin !== "string" || !origin.endsWith(`Item.${sid.itemId}`)) return no("roll");
  const hits = Array.isArray(own.hits) ? own.hits.filter((h) => typeof h === "string") : [];
  const spent = (w) => { const h = w?.flags?.animater?.breakWall?.hits; return Array.isArray(h) && (h.includes(attack.id) || h.includes(damage.id)); };
  if (used === true || hits.includes(attack.id) || hits.includes(damage.id) || (walls ?? []).some(spent)) return no("used");
  if (!footprint(token)) return no("far");
  if ((sender.isGM !== true && token.authorOwns !== true) || token.actorId !== actx.actor) return no("sender");
  if (!strike) return no("roll");
  const reach = strikeReaches({ token, wall, grid, gridDistance, strike, sight });
  if (reach) return no(reach);
  const stats = doorStats(own, traits.material), degree = attackDegree(attack, stats.ac);
  if (degree === null) return no("roll");
  if (degree < 2) return no("miss");
  if (!WINS.includes(dctx.outcome)) return no("roll");
  if (dctx.outcome === "criticalSuccess" && degree < 3) return no("outcome");
  const total = Number(Array.from(damage.rolls ?? [])[0]?.total);
  if (!Number.isFinite(total)) return no("roll");
  const { dealt, hp } = doorDamage({ hp: doorHp(own, stats), damage: total, hardness: stats.hardness });
  const after = { ...own, hp };
  return { ok: true, hp, dealt, maxHp: stats.maxHp, hardness: stats.hardness, bt: stats.bt, cracked: doorCracked(after, stats), broken: hp <= 0,
    hits: [...hits, attack.id, damage.id].slice(-HITS_KEPT) };
}

// The wall write for a hit that leaves the door standing (the GM's).
export function doorHitUpdate(wall, result) {
  return { _id: wall.id, "flags.animater.breakWall.hp": result.hp, "flags.animater.breakWall.hits": [...result.hits] };
}

// Who attacks from the door: the one selected token, else the user's only owned token on the scene (tokens: {id}).
export function doorAttackRoller({ controlled = [], owned = [] } = {}) {
  const c = controlled ?? [];
  if (c.length > 1) return { why: "many" };
  if (c.length === 1) return { tokenId: c[0].id };
  const o = owned ?? [];
  if (o.length === 1) return { tokenId: o[0].id };
  return { why: o.length ? "many" : "none" };
}

// Whether a Strike's weapon has the ammunition PF2e needs to roll it (PF2e's own test: nothing to spend, built-in
// ammunition, or enough loaded: an ammunition item's uses when it has several, else its quantity).
// {expend, builtIn, ammo: {isAmmo, usesMax, usesValue, quantity} | null}.
export function strikeHasAmmo({ expend = 0, builtIn = false, ammo = null } = {}) {
  const need = Number(expend) || 0;
  if (need <= 0 || builtIn) return true;
  const have = ammo ? (ammo.isAmmo ? (Number(ammo.usesMax) > 1 ? Number(ammo.usesValue) : Number(ammo.quantity)) : Number(ammo.quantity)) : 0;
  return (Number.isFinite(have) ? have : 0) >= need;
}

// Which stamp, if any, a chat message this client is creating takes (doc: its data), and the stamps kept.
// stamps: [{kind: "attack", actorId, itemId, ac, flag, until} | {kind: "damage", actorId, itemId, flag, until}]; now: ms.
// Expired stamps go. Any attack roll by an actor drops that actor's damage stamps (a later Strike at a goblin ends the
// door hit's damage). An attack stamp takes that actor's attack roll with that weapon at the door's AC; a damage stamp
// takes that actor's damage roll from that weapon with no target. A stamp is used once.
export function pickDoorStamp(stamps, doc, now) {
  const ctx = doc?.flags?.pf2e?.context, actor = doc?.speaker?.actor, attackRoll = ctx?.type === "attack-roll";
  let keep = (stamps ?? []).filter((s) => now <= s.until && !(attackRoll && s.kind === "damage" && s.actorId === actor));
  const fits = (s) => {
    if (s.actorId !== actor) return false;
    if (s.kind === "attack") return attackRoll && Number(ctx?.dc?.value) === s.ac && strikeIdentifier(ctx.identifier)?.itemId === s.itemId;
    return ctx?.type === "damage-roll" && ctx.sourceType === "attack" && !targeted(doc) && String(doc?.flags?.pf2e?.origin?.uuid ?? "").endsWith(`Item.${s.itemId}`);
  };
  const use = keep.find(fits) ?? null;
  if (use) keep = keep.filter((s) => s !== use);
  return { use, keep };
}

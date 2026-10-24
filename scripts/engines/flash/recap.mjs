// Combat recap: the GM's client remembers a combat's highlight moments and the reel replays the best three.
// A moment is one strike (one attack or damage message): its killing blow, critical hit, natural 20 or 1 are
// badges on that one moment, never separate moments. Each moment keeps what the reel needs to replay it: the
// scene, the attacker's and targets' tokens (id, actor, art, size and place), the item, the outcome and the
// messages that rolled it. Pure: recap-table.mjs reads the chat messages and HP changes and hands facts in.
import { perceive } from "../motion/movement-feel.mjs";

export const RECAP_MODES = Object.freeze({ off: "Off", gm: "GM only", everyone: "Everyone" });
// Badges, strongest first; the first a moment has is its kind.
export const RECAP_BADGES = Object.freeze({ kill: "Killing blow", crit: "Critical hit", nat20: "Natural 20", bigHit: "Biggest hit", nat1: "Natural 1" });
const BADGE_ORDER = Object.keys(RECAP_BADGES);
export const BADGE_TAGS = Object.freeze({ kill: "KILL", crit: "CRIT", nat20: "NAT 20", bigHit: "BIGGEST HIT", nat1: "NAT 1" });
const BASE = { kill: 70, crit: 55, nat20: 40, bigHit: 30, nat1: 38 };
export const RECAP_LIMIT = 40;
// Facts of one strike arrive within a few seconds (attack roll, damage roll, the HP change).
export const MERGE_MS = 12000;
// The generic name a player sees for a creature whose name is hidden from them.
export const HIDDEN_NAME = "a foe";
// The name a player sees for a creature they only heard (hidden or invisible to them) at the time.
export const UNSEEN_NAME = "something unseen";

// Names and items show on screen: short, single-line, never a {variable}.
const clean = (v, max = 40) => String(v ?? "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const id = (v) => (typeof v === "string" && /^[\w.-]{1,64}$/.test(v) ? v : "");
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
const url = (v) => (typeof v === "string" ? v.slice(0, 300) : "");

// A creature as kept: the name players see (name), the real one for GMs (trueName), portrait (img) and the
// token as it stood: id, actor, art (src), place (x, y: top-left px), size (w, h px), elevation, hidden.
export function normalizePerson(p) {
  if (!p || typeof p !== "object") return null;
  const name = clean(p.name);
  if (!name) return null;
  const out = { name, img: url(p.img) };
  const trueName = clean(p.trueName);
  if (trueName && trueName !== name) out.trueName = trueName;
  for (const k of ["tokenId", "actorId"]) if (id(p[k])) out[k] = id(p[k]);
  if (url(p.src)) out.src = url(p.src);
  for (const k of ["x", "y", "w", "h", "elevation"]) { const n = num(p[k]); if (n !== null) out[k] = n; }
  if (p.hidden === true) out.hidden = true;
  return out;
}
// What one player knew of a creature at the time: 'seen', 'heard' (hidden or invisible: its square, not its face)
// or 'unknown' (undetected or unnoticed). The same rules as movement's perceive(): PF2e Visioner's states from each
// of the player's own tokens (the most aware counts), else the creature's conditions, else seen unless GM-hidden.
const LEVELS = ["unknown", "heard", "seen"];
export function awarenessLevel({ docHidden = false, visible, states = [], conditions = [] } = {}) {
  const { see, hear } = perceive({ docHidden, tokenVisible: visible ?? !docHidden, states, conditions });
  return see ? "seen" : hear ? "heard" : "unknown";
}
// A moment's awareness as kept: { creature tokenId: { userId: level } }, valid ids and levels only.
function normalizeAwareness(a) {
  if (!a || typeof a !== "object") return undefined;
  const out = {};
  for (const [tokenId, users] of Object.entries(a).slice(0, 8)) {
    if (!id(tokenId) || !users || typeof users !== "object") continue;
    const row = {};
    for (const [userId, level] of Object.entries(users).slice(0, 32)) if (id(userId) && LEVELS.includes(level)) row[userId] = level;
    if (Object.keys(row).length) out[tokenId] = row;
  }
  return Object.keys(out).length ? out : undefined;
}
// One strike's facts arrive over a few seconds: what a player knew is the least they knew in any of them.
function mergeAwareness(a, b) {
  if (!a || !b) return a ?? b;
  const out = structuredClone(a);
  for (const [tokenId, users] of Object.entries(b)) for (const [userId, level] of Object.entries(users)) {
    const had = out[tokenId]?.[userId];
    (out[tokenId] ??= {})[userId] = had && LEVELS.indexOf(had) < LEVELS.indexOf(level) ? had : level;
  }
  return out;
}
// A creature only heard: a name that gives nothing away, no portrait, no token art, no place to frame or ghost.
const unseen = (p) => (p ? { name: UNSEEN_NAME, img: "" } : p);
/**
 * A moment as one viewer may see it: as is for a GM, with stealth off (Movement respects stealth) or with no
 * awareness recorded for this user (old recaps); null when a creature in it was unknown to them; else, when one was
 * only heard, a copy (masked: true, shown as a card) with that creature as UNSEEN_NAME and no art of it.
 */
export function momentForViewer(m, { userId = "", gm = false, stealth = true } = {}) {
  if (!m || gm || !stealth || !m.awareness || !userId) return m;
  const levelOf = (p) => (p?.tokenId ? m.awareness[p.tokenId]?.[userId] : undefined);
  const people = [m.actor, ...(m.targets ?? [])];
  if (people.some((p) => levelOf(p) === "unknown")) return null;
  if (!people.some((p) => levelOf(p) === "heard")) return m;
  const mask = (p) => (levelOf(p) === "heard" ? unseen(p) : p);
  const targets = (m.targets ?? []).map(mask);
  return { ...m, actor: mask(m.actor), targets, target: targets[0] ?? null, masked: true };
}
const samePerson = (a, b) => !!a && !!b && (a.tokenId && b.tokenId ? a.tokenId === b.tokenId : (a.trueName ?? a.name) === (b.trueName ?? b.name));

/**
 * The name a player sees for a creature: its token's name, unless the name is hidden from players — a creature no
 * player owns whose nameplate only its owners see, where the system says nameplates decide (PF2e's "Token
 * settings set name visibility"), or any NPC while Anonymous hides names. Then HIDDEN_NAME.
 * TOKEN_DISPLAY_MODES: HOVER 30 and ALWAYS 50 show the name to everyone.
 */
export function publicName({ name, playerOwned = false, displayName, nameplatesDecide = false, anonymous = false } = {}) {
  const n = clean(name);
  if (!n || playerOwned) return n;
  if (anonymous) return HIDDEN_NAME;
  if (nameplatesDecide && ![30, 50].includes(Number(displayName))) return HIDDEN_NAME;
  return n;
}
/** Who a viewer sees: the real name for a GM, else the public one. */
export const nameFor = (p, gm = false) => (p ? (gm && p.trueName ? p.trueName : p.name) : "");

const badgesOf = (m) => {
  const set = new Set((Array.isArray(m?.badges) ? m.badges : []).filter((b) => BADGE_ORDER.includes(b)));
  if (BADGE_ORDER.includes(m?.kind)) set.add(m.kind);
  if (m?.crit === true) set.add("crit");
  if (Number(m?.natural) === 20) set.add("nat20");
  if (Number(m?.natural) === 1 && !set.has("crit")) set.add("nat1");
  return BADGE_ORDER.filter((b) => set.has(b));
};

// One strike's worth: its strongest badge, a bit for each other badge, and the damage it dealt. A plain hit
// (no badge) still counts by its damage, so the biggest hit can be found.
export function scoreMoment(m) {
  const badges = badgesOf(m), amount = Math.max(0, Number(m?.amount) || 0);
  const top = badges.length ? Math.max(...badges.map((b) => BASE[b])) : 20;
  return top + 15 * Math.max(0, badges.length - 1) + Math.min(30, amount / 3);
}

/**
 * A moment as kept: { badges, kind, actor, targets, target, item, itemUuid, amount, crit, natural, outcome,
 * eventType, sceneId, attackMessageId, damageMessageId, key, at, score }. Old saved moments ({ kind, actor,
 * target, … }) read the same. Null when there is nothing to show.
 */
export function normalizeMoment(m = {}) {
  if (!m || typeof m !== "object") return null;
  const badges = badgesOf(m);
  const amount = Math.round(Number(m.amount));
  const dealt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (!badges.length && !dealt) return null;
  const targets = [];
  for (const t of [...(Array.isArray(m.targets) ? m.targets : []), m.target]) {
    const p = normalizePerson(t);
    if (p && !targets.some((x) => samePerson(x, p))) targets.push(p);
  }
  const attackMessageId = id(m.attackMessageId), damageMessageId = id(m.damageMessageId);
  const out = {
    badges, kind: badges[0] ?? "hit", actor: normalizePerson(m.actor), targets: targets.slice(0, 4), target: targets[0] ?? null,
    item: clean(m.item, 60), itemUuid: typeof m.itemUuid === "string" ? m.itemUuid.slice(0, 200) : "",
    amount: dealt, crit: badges.includes("crit"),
    natural: [1, 20].includes(Number(m.natural)) ? Number(m.natural) : null,
    outcome: clean(m.outcome, 30), eventType: clean(m.eventType, 20), sceneId: id(m.sceneId),
    attackMessageId, damageMessageId,
    key: (typeof m.key === "string" ? m.key.slice(0, 80) : "") || attackMessageId || damageMessageId,
    at: Number(m.at) || 0,
  };
  const awareness = normalizeAwareness(m.awareness);
  if (awareness) out.awareness = awareness;
  return { ...out, score: scoreMoment(out) };
}

// Whether two facts are one strike: the same message, or the same attacker on the same target a moment apart
// (attack roll, damage roll, HP change) when neither already belongs to a different message.
export function sameStrike(a, b, mergeMs = MERGE_MS) {
  if (!a || !b) return false;
  if (a.attackMessageId && a.attackMessageId === b.attackMessageId) return true;
  if (a.damageMessageId && a.damageMessageId === b.damageMessageId) return true;
  if (a.attackMessageId && b.attackMessageId) return false;
  if (a.damageMessageId && b.damageMessageId) return false;
  if (!samePerson(a.actor, b.actor) || Math.abs((a.at || 0) - (b.at || 0)) > mergeMs) return false;
  const ta = a.targets ?? [], tb = b.targets ?? [];
  return ta.length > 0 && tb.length > 0 && ta.some((x) => tb.some((y) => samePerson(x, y)));
}
/** One strike's facts as one moment: badges joined, the largest damage, every target, the first time. */
export function mergeMoments(a, b) {
  const pick = (k) => a[k] || b[k];
  return normalizeMoment({
    ...a, badges: [...a.badges, ...b.badges],
    actor: a.actor?.tokenId ? a.actor : b.actor ?? a.actor,
    targets: [...a.targets, ...b.targets],
    amount: Math.max(a.amount, b.amount), natural: a.natural ?? b.natural,
    item: pick("item"), itemUuid: pick("itemUuid"), outcome: pick("outcome"), eventType: pick("eventType"), sceneId: pick("sceneId"),
    attackMessageId: pick("attackMessageId"), damageMessageId: pick("damageMessageId"), key: pick("key"),
    at: Math.min(a.at || b.at, b.at || a.at), awareness: mergeAwareness(a.awareness, b.awareness),
  });
}

const actorKey = (m) => m.actor?.tokenId || m.actor?.trueName || m.actor?.name || "";
const strikeKey = (m) => m.attackMessageId || m.damageMessageId || m.key || "";

/**
 * The best n moments, one per strike and, while anyone else has a moment, one per attacker. The hardest-hitting
 * moment wears the Biggest hit badge. Played in the order they happened.
 */
export function topMoments(moments, n = 3) {
  let pool = (moments ?? []).map((m) => normalizeMoment(m)).filter(Boolean);
  // Old recaps could hold the same strike twice (kill, crit and biggest hit cards): merged here.
  const merged = [];
  for (const m of pool) {
    const i = merged.findIndex((x) => sameStrike(x, m));
    if (i >= 0) merged[i] = mergeMoments(merged[i], m); else merged.push(m);
  }
  pool = merged;
  const biggest = pool.filter((m) => m.amount > 0).reduce((a, b) => (!a || b.amount > a.amount ? b : a), null);
  if (biggest && !biggest.badges.includes("bigHit")) pool[pool.indexOf(biggest)] = normalizeMoment({ ...biggest, badges: [...biggest.badges, "bigHit"] });
  const picked = [];
  while (picked.length < n && pool.length) {
    const fresh = pool.filter((m) => !picked.some((p) => actorKey(p) === actorKey(m)));
    const from = fresh.length ? fresh : pool;
    const best = from.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.at < a.at) ? b : a));
    picked.push(best);
    pool = pool.filter((m) => m !== best && !(strikeKey(m) && strikeKey(m) === strikeKey(best)));
  }
  return picked.sort((a, b) => a.at - b.at);
}

// One combat's moments: each fact joins the strike it belongs to, or starts a new moment.
export function createRecap({ limit = RECAP_LIMIT, mergeMs = MERGE_MS } = {}) {
  let list = [];
  return {
    record(fact) {
      const m = normalizeMoment(fact);
      if (!m) return null;
      const i = list.findIndex((x) => sameStrike(x, m, mergeMs));
      const out = i >= 0 ? mergeMoments(list[i], m) : m;
      if (i >= 0) list[i] = out; else list.push(out);
      if (list.length > limit) list = list.sort((a, b) => b.score - a.score).slice(0, limit);
      return out;
    },
    moments: () => list.slice(),
    top: (n = 3) => topMoments(list, n),
    clear: () => { list = []; },
  };
}

// What a d20 roll message says: crit (an attack's critical success), the natural 1 or 20, its outcome and kind of
// check, or null when there is nothing to remember. Whispered and blind rolls stay secret.
const PF_CHECKS = /attack-roll|saving-throw|skill-check|perception-check|spell-attack/;
const DND_CHECKS = new Set(["attack", "save", "skill", "ability", "check", "tool", "concentration", "death"]);
function naturalOf(rolls) {
  for (const roll of rolls ?? []) for (const die of roll?.dice ?? []) {
    if (Number(die?.faces) !== 20) continue;
    const kept = (die.results ?? []).find((r) => r?.active !== false && !r?.discarded);
    const n = Number(kept?.result);
    return n === 1 || n === 20 ? n : null;
  }
  return null;
}
const secret = (message) => !message || message.blind || (Array.isArray(message.whisper) ? message.whisper.length : message.whisper?.size);
// An attack roll message, whatever it rolled: its attacker's token, target and outcome (the reel replays it).
export function attackFacts(message, systemId) {
  if (secret(message)) return null;
  if (["pf2e", "sf2e"].includes(systemId)) {
    const context = message.flags?.[systemId]?.context;
    if (!/attack/.test(context?.type ?? "")) return null;
    return { messageId: String(message.id ?? ""), tokenId: message.speaker?.token ?? null, targetUuid: context.target?.token ?? context.target?.actor ?? null, outcome: context.outcome ?? "" };
  }
  if (systemId === "dnd5e") {
    const dnd = message.flags?.dnd5e;
    if (dnd?.roll?.type !== "attack") return null;
    const target = Array.isArray(dnd?.targets) ? dnd.targets[0] : null;
    const crit = Array.from(message.rolls ?? []).some((r) => r?.isCritical === true);
    return { messageId: String(message.id ?? ""), tokenId: message.speaker?.token ?? null, targetUuid: target?.uuid ?? null, outcome: crit ? "criticalSuccess" : "" };
  }
  return null;
}
// A damage roll message: its attacker's token, the creatures it was aimed at and the damage it rolled in all.
export function damageFacts(message, systemId) {
  if (secret(message)) return null;
  const rolls = Array.from(message.rolls ?? []);
  const pf = message.flags?.[systemId]?.context, dnd = message.flags?.dnd5e;
  if (!(pf?.type === "damage-roll" || dnd?.roll?.type === "damage")) return null;
  const total = rolls.reduce((sum, r) => sum + (Number(r?.total) || 0), 0);
  if (!(total > 0)) return null;
  const idOf = (uuid, kind) => String(uuid ?? "").match(new RegExp(`${kind}\\.([^.]+)`))?.[1];
  const tokenIds = [], actorIds = [];
  const add = (uuid) => { const t = idOf(uuid, "Token"), a = idOf(uuid, "Actor"); if (t) tokenIds.push(t); if (a) actorIds.push(a); };
  if (pf?.target) { add(pf.target.token); add(pf.target.actor); }
  for (const t of Array.isArray(dnd?.targets) ? dnd.targets : []) add(t?.uuid);
  return { messageId: String(message.id ?? ""), tokenId: message.speaker?.token ?? null, tokenIds, actorIds, total: Math.round(total) };
}
/**
 * The damage a creature was dealt. A creature still standing lost exactly what it took (the system's own number,
 * else the HP it lost). One that dropped lost only the HP it had left, so its blow counts the damage roll's total
 * too (overkill): a creature on 1 HP struck for 38 shows 38, never 1.
 */
export function damageDealt({ rolled, taken, hpLost, dropped = false } = {}) {
  const pos = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  if (!dropped) return pos(taken) || pos(hpLost) || pos(rolled);
  return Math.max(pos(rolled), pos(taken), pos(hpLost));
}
export function rollFacts(message, systemId) {
  if (secret(message)) return null;
  const rolls = Array.from(message.rolls ?? []);
  let crit = false, targetUuid = null, targetName = null, outcome = "", check = "";
  if (["pf2e", "sf2e"].includes(systemId)) {
    const context = message.flags?.[systemId]?.context;
    if (!PF_CHECKS.test(context?.type ?? "")) return null;
    crit = /attack/.test(context.type) && context.outcome === "criticalSuccess";
    targetUuid = context.target?.token ?? context.target?.actor ?? null;
    outcome = context.outcome ?? "";
    check = /attack/.test(context.type) ? "attack" : context.type;
  } else if (systemId === "dnd5e") {
    const dnd = message.flags?.dnd5e;
    const type = dnd?.roll?.type;
    if (!DND_CHECKS.has(type)) return null;
    crit = type === "attack" && rolls.some((r) => r?.isCritical === true);
    const target = Array.isArray(dnd?.targets) ? dnd.targets[0] : null;
    targetUuid = target?.uuid ?? null;
    targetName = target?.name ?? null;
    outcome = crit ? "criticalSuccess" : "";
    check = type;
  } else return null;
  const natural = naturalOf(rolls);
  if (!crit && !natural) return null;
  return { crit, natural, targetUuid, targetName, key: String(message.id ?? ""), outcome, check };
}
// The fact a roll makes: its crit and natural 20 or 1 as badges on its attack.
export function rollMoment(facts, { actor, target, targets, item, itemUuid, at, sceneId } = {}) {
  if (!facts) return null;
  const badges = [facts.crit && "crit", facts.natural === 20 && "nat20", facts.natural === 1 && !facts.crit && "nat1"].filter(Boolean);
  if (!badges.length) return null;
  return { badges, actor, targets: targets ?? (target ? [target] : []), item, itemUuid, natural: facts.natural, crit: facts.crit,
    outcome: facts.outcome ?? "", eventType: facts.check === "attack" ? "attack" : facts.check ?? "", sceneId,
    attackMessageId: facts.check === "attack" || !facts.check ? facts.key : "", key: facts.key, at };
}

const HEADLINES = { kill: "Killing Blow", crit: "Critical Hit", nat20: "Natural 20", bigHit: "Biggest Hit", nat1: "Natural 1", hit: "Hit" };
/**
 * A moment's caption for one viewer: who, the headline ("Critical Hit"; a critical killing blow says both), the
 * detail ("38 damage — vs Kobold Dragon Mage"), the item, the badges' tags and the number. Plain text: the page
 * sets it as text, and its CSS wraps and clamps it.
 */
export function captionFor(m, { gm = false } = {}) {
  const who = nameFor(m?.actor, gm) || "Someone";
  const kind = m?.kind ?? "hit";
  const headline = kind === "kill" && m.crit ? "Critical Killing Blow" : HEADLINES[kind] ?? "Hit";
  const vs = (m?.targets ?? []).map((t) => nameFor(t, gm)).filter(Boolean);
  const versus = vs.length > 2 ? `${vs.slice(0, 2).join(", ")} +${vs.length - 2}` : vs.join(" & ");
  const detail = [m?.amount ? `${m.amount} damage` : "", versus ? `vs ${versus}` : ""].filter(Boolean).join(" — ");
  return { who, headline, detail, item: m?.item ? `with ${m.item}` : "", badges: (m?.badges ?? []).map((b) => BADGE_TAGS[b]).filter(Boolean),
    number: m?.amount ? String(m.amount) : m?.natural ? String(m.natural) : "", line: [who, headline, detail].filter(Boolean).join(" — ") };
}

// The Highlights screen's id (kept for the flash host's per-screen switch).
export const RECAP_SCREEN_ID = "combat-recap";

// The recap plays after the combat's ending screen: its length (plus a beat), then while any screen
// still shows here (a GM typing names, a longer random pick), up to limit ms more.
export async function whenClear({ endMs = 0, busy = () => false, sleep, limit = 8000, step = 250 } = {}) {
  await sleep(Math.max(0, Number(endMs) || 0) + 300);
  for (let waited = 0; busy() && waited < limit; waited += step) await sleep(step);
}

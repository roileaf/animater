// Forcing a door open from the door itself, in every supported system: the door's DC (its own, else by material and
// system), the prompt's words, whether a roll message meets it, which door a roll from the sheet is about, and which
// token rolls from the door. Pure: no Foundry globals. The GM always judges a roll against the DC it reads from the wall.
import { wallTraits } from "./wall-break.mjs";
import { onLevel, segRectDist } from "./prop-pick.mjs";

export const FORCE_OPEN_SYSTEMS = new Set(["pf2e", "sf2e", "dnd5e", "daggerheart", "draw-steel"]);
const D20_DC = { wood: 15, metal: 20, stone: 25 }; // PF2e, SF2e and D&D 5e
const DAGGERHEART_DC = { wood: 13, metal: 16, stone: 19 };
const DCS = { pf2e: D20_DC, sf2e: D20_DC, dnd5e: D20_DC, daggerheart: DAGGERHEART_DC };
const WORDING = {
  pf2e: { skill: "Athletics", label: "Force Open", dc: "DC" },
  sf2e: { skill: "Athletics", label: "Force Open", dc: "DC" },
  dnd5e: { skill: "Strength (Athletics)", label: "Force open", dc: "DC" },
  daggerheart: { skill: "Strength", label: "Force open", dc: "Difficulty" },
  "draw-steel": { skill: "Might", label: "Force open", dc: null }, // no DC: the tier decides
};
const MAX_DC = 60;
const PF2E_WINS = ["success", "criticalSuccess"];
const DRAW_STEEL_TIERS = [12, 17]; // the power roll's tier 2 and tier 3 thresholds
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const matOf = (m) => (m === "metal" || m === "stone" ? m : "wood");

// The DC a door of this material has in this system when the GM left it blank. Null where the system has no DC
// (Draw Steel goes by tier) or no Force open roll here.
export function defaultForceDC(material, system) {
  return DCS[system]?.[matOf(material)] ?? null;
}

// The GM's own DC on a door (breakWall.forceDC, a whole number from 1 to 60, maybe saved as text), else null.
export function ownForceDC(own) {
  const raw = own?.forceDC, n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return Number.isInteger(n) && n >= 1 && n <= MAX_DC ? n : null;
}

// The door's DC: the GM's own, else the default. Null for a system without DCs.
export function forceDCOf(own, material, system) {
  return DCS[system] ? ownForceDC(own) ?? defaultForceDC(material, system) : null;
}

// The prompt's words for this system ({skill, label, dc}: dc is "DC", "Difficulty" or null), null when it has no
// Force open roll here.
export function forceOpenWording(system) {
  const w = WORDING[system];
  return w ? { ...w } : null;
}

export function forceOpenPrompt(system, material, dc) {
  const w = WORDING[system];
  if (!w) return null;
  if (!w.dc) return `Force it open? ${w.skill} test: ${matOf(material) === "wood" ? "tier 2 or 3 breaks it" : "only tier 3 breaks it"}`;
  return `Force it open? ${w.skill} vs ${w.dc} ${dc}`;
}

// The kept d20 of a check (the die's total: the higher of a roll-twice), else null.
function natural20(roll) {
  const die = Array.from(roll?.dice ?? []).find((d) => d?.faces === 20);
  const n = Number(die?.total ?? die?.results?.find((r) => r?.active !== false)?.result);
  return Number.isFinite(n) ? n : null;
}

// PF2e's degree of success of a total against a DC, a natural 20 a step up and a natural 1 a step down.
function pf2eDegree(total, dc, nat) {
  let degree = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (nat === 20) degree += 1; else if (nat === 1) degree -= 1;
  return Math.max(0, Math.min(3, degree));
}

function drawSteelTier(roll) {
  const p = Number(roll?.product);
  if (p === 1 || p === 2 || p === 3) return p;
  const total = Number(roll?.total);
  return 1 + DRAW_STEEL_TIERS.filter((t) => total >= t).length;
}

const daggerheartCritical = (roll) => {
  if (roll?.isCritical === true || roll?.options?.roll?.isCritical === true) return true;
  const hope = roll?.dHope?.total, fear = roll?.dFear?.total;
  return isNum(hope) && hope === fear;
};

// Whether this roll message forces the door: {ok: true} or {ok: false, why: "roll" | "outcome"}.
// dc: the DC the GM read from the wall (never one the message claims); material: the door's (Draw Steel's tier rule).
// PF2e/SF2e: the system's outcome when it was rolled against this same DC, else the total against it by PF2e's degrees.
// D&D 5e: total >= DC. Daggerheart: a critical, or total >= difficulty. Draw Steel: tier 2+ for wood, tier 3 otherwise.
export function forceOpenResult({ system, message, dc, material } = {}) {
  const roll = (system === "daggerheart" ? message?.system?.roll : null) ?? Array.from(message?.rolls ?? [])[0];
  const total = Number(roll?.total);
  if (!roll || !Number.isFinite(total) || !FORCE_OPEN_SYSTEMS.has(system)) return { ok: false, why: "roll" };
  const verdict = (ok) => (ok ? { ok: true } : { ok: false, why: "outcome" });
  if (system === "draw-steel") return verdict(drawSteelTier(roll) >= (matOf(material) === "wood" ? 2 : 3));
  if (!isNum(dc)) return verdict(false);
  if (system === "pf2e" || system === "sf2e") {
    const ctx = message?.flags?.[system]?.context ?? message?.flags?.pf2e?.context;
    if (ctx?.outcome && Number(ctx?.dc?.value) === dc) return verdict(PF2E_WINS.includes(ctx.outcome));
    return verdict(pf2eDegree(total, dc, natural20(roll)) >= 2);
  }
  if (system === "daggerheart") return verdict(daggerheartCritical(roll) || total >= dc);
  return verdict(total >= dc);
}

const footprint = (t) => [t?.x, t?.y, t?.w, t?.h].every(Number.isFinite);
const besideDoor = (token, wall, grid) => {
  if (!footprint(token) || !Array.isArray(wall?.c) || !onLevel(wall.levels, token.level)) return Infinity;
  const [x1, y1, x2, y2] = wall.c, d = segRectDist({ x: x1, y: y1 }, { x: x2, y: y2 }, { x: token.x, y: token.y, width: token.w, height: token.h });
  return d <= grid ? d : Infinity;
};

// The door a Force Open from the sheet is about: the closest intact, breakable door that can be forced open and is not
// open, within one square of the token's footprint {x, y, w, h, level} and on its level. Null when none.
export function closestForcedDoor(token, walls, scene, grid = 100) {
  if (!footprint(token)) return null;
  let best = null, bestD = Infinity;
  for (const w of walls ?? []) {
    if (w?.flags?.animater?.breakWall?.broken || w?.ds === 1) continue;
    const t = wallTraits(w, scene);
    if (t.kind !== "door" || !t.forceOpen) continue;
    const d = besideDoor(token, w, grid);
    if (d < bestD) { best = w; bestD = d; }
  }
  return best;
}

// Who rolls from the door: the one selected token when it stands within one square of the door (else "far"); with none
// selected, the only owned token within one square ("many" when several, "none" when no token is beside it).
// Tokens are footprints {id, x, y, w, h, level}.
export function forceOpenRoller(wall, { controlled = [], owned = [] } = {}, grid = 100) {
  const picked = (controlled ?? []).filter(footprint);
  if (picked.length > 1) return { why: "many" };
  if (picked.length === 1) return besideDoor(picked[0], wall, grid) < Infinity ? { token: picked[0] } : { why: "far" };
  const near = (owned ?? []).filter((t) => besideDoor(t, wall, grid) < Infinity);
  if (near.length === 1) return { token: near[0] };
  return { why: near.length ? "many" : "none" };
}

// What breaks a decoration where its material's prop rules say otherwise (pure, no imports). Only a decoration view carries
// a rule (decor-break.mjs puts it on view.decor.rule); a tile never does, so the tile props' rules are unchanged.
//   torn:   sacks. A blade or a point tears them open, fire burns them; a club or a slam only thumps them.
//   any:    candles. Anything knocks them over: any damage that breaks things, any slam, however small.
//   noSlam: a sarcophagus. Stone that only force breaks: no slam, however big, moves a box that heavy.
//   heavy:  a street lamp. Iron on a post: only force, or a Large or bigger creature slammed into it, knocks it down.
export const DECOR_RULES = Object.freeze(["torn", "any", "noSlam", "heavy"]);

// The damage that breaks things at all (as the prop rules count it).
const HARM = new Set(["bludgeoning", "piercing", "slashing", "fire", "cold", "electricity", "acid", "sonic", "force"]);
const TEARS = new Set(["slashing", "piercing", "fire"]);
const BIG_SLAM = 2; // Large or bigger, as the prop rules count a slam

/** Whether a cause breaks a decoration with this rule (pure); null when there is no such rule (the material decides). */
export function decorRuleBreaks(rule, cause = {}) {
  if (!DECOR_RULES.includes(rule)) return null;
  const { damageType, slam, blast } = cause ?? {};
  if (blast === true) return true; // a powder keg's blast breaks anything that is a prop at all
  if (rule === "any") return !!slam || HARM.has(damageType);
  if (rule === "heavy") return slam ? Number(slam.size) >= BIG_SLAM : damageType === "force";
  if (slam) return false;
  if (rule === "torn") return TEARS.has(damageType);
  return damageType === "force";
}

/** The style a break with this rule plays (pure); null leaves it to the prop rules. A torn sack splits open, or burns. */
export function decorRuleStyle(rule, cause = {}) {
  if (rule !== "torn") return null;
  return cause?.damageType === "fire" || cause?.blast === true ? "burn" : "split";
}

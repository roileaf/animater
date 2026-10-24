// PF2e and SF2e reroll a check (a Hero Point, a fortune effect) by deleting its message and posting a new one with
// context.isReroll set and the outcome of the roll it keeps. When the new roll is kept the result may have changed,
// so the reroll plays like any roll; when the old one is kept ("keep higher" and the new roll came out lower), the
// card marks the new roll discarded and nothing has changed, so it stays quiet.
export function rerollChangesNothing(message, systemId = "pf2e") {
  if (!message?.flags?.[systemId]?.context?.isReroll) return false;
  return /reroll-second[^"]*\breroll-discard\b/.test(String(message.content ?? ""));
}
// What paid for a reroll, for the Activity page: a Hero Point, a Mythic Point, or a plain reroll (a fortune effect,
// the GM's reroll menu). null when the message is no reroll.
export function rerollKind(message, systemId = "pf2e") {
  const context = message?.flags?.[systemId]?.context;
  if (!context?.isReroll) return null;
  const options = Array.isArray(context.options) ? context.options : [];
  return options.includes("check:reroll:hero-points") ? "hero-point" : options.includes("check:reroll:mythic-points") ? "mythic-point" : "reroll";
}

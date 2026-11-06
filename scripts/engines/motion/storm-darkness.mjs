// A storm that shuts the sky darkens the scene for real: the scene's own Darkness Level, so Foundry's lighting and vision, the game system's rules and anything else that reads it follow.
// What the clock asked for is kept beside it (flags.animater.stormDark, { base, target }), so it goes back when the storm ends and carries on following the clock meanwhile.

const SMALLEST = 0.02;
// How dark this storm asks the scene to be (pure), from its gloom (sky-light.mjs stormGloom, taken with no darkness and a cap of 1): Storm darkness at 100% is the scene's darkest. 0 for none.
export function stormDarkTarget(gloom = 0) {
  const target = Math.min(1, Number(gloom) || 0);
  return target >= SMALLEST ? target : 0;
}
// What to write now (pure), or null to leave it: { darkness, kept }, kept null once the scene is back to the clock's.
// `darkness` the scene's now, `kept` its flag, `target` stormDarkTarget's. Small changes wait, so a gust doesn't mean a save for every client.
export function stormDarkStep({ darkness = 0, kept = null, target = 0, step = 0.05 } = {}) {
  const now = Number(darkness) || 0, asked = Number(target) || 0;
  if (!kept) return asked > now + SMALLEST ? { darkness: asked, kept: { base: now, target: asked } } : null;
  const base = Number(kept.base) || 0;
  // Over: the clock's own again (and a clock that has passed the storm needs nothing of it).
  if (!(asked > base + SMALLEST)) return { darkness: base, kept: null };
  if (Math.abs(asked - (Number(kept.target) || 0)) < step) return null;
  return { darkness: asked, kept: { base, target: asked } };
}
// Someone else setting the scene's darkness in a storm (the clock, the GM's slider), pure: what they asked for becomes what it goes back to, and the storm holds it down. { darkness, kept }, or null with no storm on.
export function stormDarkAsked(asked = 0, kept = null) {
  if (!kept) return null;
  const value = Number(asked) || 0, target = Number(kept.target) || 0;
  return target > value + SMALLEST ? { darkness: target, kept: { base: value, target } } : { darkness: value, kept: null };
}

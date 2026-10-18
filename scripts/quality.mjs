// Per-client animation quality. Each client picks a level; it is mirrored to a
// user flag so the client that starts an animation can send optional layers
// only to viewers whose level allows them (Sequencer forUsers). Token motion,
// Token filters and persistent state layers are rendered locally, so each
// client filters those itself.
export const QUALITY_LEVELS = Object.freeze({ full: 3, balanced: 2, low: 1, off: 0 });
export const QUALITY_CHOICES = Object.freeze({
  full: 'Full: every layer, token motion and token filters',
  balanced: 'Balanced: skip decorative layers and token filters',
  low: 'Low: only the main effect of each animation, one effect per token',
  off: 'Off: no Animater visuals or sounds on this client',
});
export const qualityRank = value => QUALITY_LEVELS[value] ?? QUALITY_LEVELS.full;

// Tier 0 is the defining contact (flight, hit or area); tier 1 the next layers;
// tier 2 decoration (sprites, echoes and anything past the first few layers).
const VISUAL = s => !['sound', 'motion', 'tokenfx', 'scenefx'].includes(s.kind);
export function stageTiers(stages) {
  const tiers = new Map(), visual = stages.filter(VISUAL);
  const core = [visual.find(s => ['travel', 'projectile'].includes(s.kind)), visual.find(s => ['impact', 'template'].includes(s.kind))].filter(Boolean);
  if (!core.length && visual.length) core.push(visual.find(s => s.kind !== 'sprite') ?? visual[0]);
  let secondary = 0;
  for (const s of visual) {
    if (core.includes(s)) tiers.set(s, 0);
    else if (s.kind !== 'sprite' && secondary++ < 2) tiers.set(s, 1);
    else tiers.set(s, 2);
  }
  return tiers;
}
export const allowsTier = (value, tier) => qualityRank(value) > 0 && tier <= qualityRank(value) - 1;
export const allowsMotion = value => qualityRank(value) >= QUALITY_LEVELS.low;
export const allowsTokenFx = value => qualityRank(value) >= QUALITY_LEVELS.full;
// Persistent state layers: how many states per token, and layers per state.
export function stateBudget(value) {
  return ({ 3: { states: Infinity, layers: Infinity, pips: true }, 2: { states: 3, layers: 1, pips: true }, 1: { states: 1, layers: 1, pips: false }, 0: { states: 0, layers: 0, pips: false } })[qualityRank(value)];
}
// Users who hear Animater sounds: everyone except those who turned Animater off.
// null means everyone (no filter).
export function usersForSound(users) {
  const active = users.filter(u => u.active);
  const allowed = active.filter(u => qualityRank(u.getFlag?.('animater', 'quality') ?? 'full') > 0);
  return allowed.length === active.length ? null : allowed.map(u => u.id);
}
// Users allowed to see a stage of the given tier; null means everyone (no filter).
export function usersForTier(users, tier) {
  const active = users.filter(u => u.active);
  const allowed = active.filter(u => allowsTier(u.getFlag?.('animater', 'quality') ?? 'full', tier));
  return allowed.length === active.length ? null : allowed.map(u => u.id);
}

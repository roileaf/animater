export const MOTION_PRIORITY = 'motionPriority';
// Other modules move tokens through Sequencer's motions (PF2e RPG Numbers' damage shake, via
// Genga). Two modules moving one token fight over it, so while Animater moves a token, passing
// motions aimed at it never start. Motions meant to last start as usual: skipped now, they would
// stay gone until a reload. Sequencer has no hook here: every motion, local or sent by another
// client, starts in MotionManager._startMotion, so that is what is wrapped.
const GUARD = Symbol('animater.motionGuard');
export function guardSequencerMotions(manager = globalThis.Sequencer?.MotionManager, { claims }) {
  const start = manager?._startMotion;
  if (typeof start !== 'function') return () => undefined;
  const original = start[GUARD] ?? start;
  const guarded = function (data, ...rest) {
    let skip = false;
    if (!data?.persist && !data?.persistUntilUpdate) { try { skip = Boolean(claims(data)); } catch { skip = false; } }
    return skip ? { duration: 0, finished: Promise.resolve() } : original.call(this, data, ...rest);
  };
  guarded[GUARD] = original;
  manager._startMotion = guarded;
  // Ours (this guard or a later one) comes off; another module's wrapper on top stays.
  return () => { if (manager._startMotion?.[GUARD] === original) manager._startMotion = original; };
}

import { timedStages } from '../../engines/playback/composition.mjs';
import { applyCatalogMotion } from '../shared/catalog-motion.mjs';
import { paceGeneratedMotion } from '../../engines/motion/motion-pacing.mjs';

// SF2e-native token-motion corrections (2026-10-08 audit, wave 2). A patch is a
// list of ops applied to a built recipe's stages:
//  {drop:'lunge@source'}            remove matching motions ('*' wildcards either side)
//  {swap:'levitate', to:'press'}    rename a motion in place (gravity presses down)
//  {review:{...}, keep:true}        reviewed catalog route/approach (catalog-motion.mjs);
//                                   keep re-adds the source's original gestures (e.g. a recoil)
//  {add:{motion,subject,...}}       plain finite pose, optionally anchored with `after: kind`
// Motion is cosmetic token-art movement; nothing here moves a TokenDocument.
const matches = (stage, pattern) => {
  const [motion = '*', subject = '*'] = pattern.split('@');
  return stage.kind === 'motion' && (motion === '*' || stage.motion === motion) && (subject === '*' || stage.subject === subject);
};
export function dropMotion(stages, pattern) {
  const removed = new Set(stages.filter(s => matches(s, pattern)).map(s => s.stageId));
  if (!removed.size) return stages;
  const sample = timedStages({ stages });
  return stages.filter(s => !removed.has(s.stageId)).map(s => removed.has(s.afterStage)
    ? { ...s, afterStage: '', delay: sample.find(t => t.stageId === s.stageId)?.delay ?? s.delay ?? 0 } : s);
}
export function applySfMotionPatch(item, stages, patch) {
  if (!patch?.length) return stages;
  let result = stages.map(s => ({ ...s }));
  for (const op of patch) {
    if (op.drop) result = dropMotion(result, op.drop);
    else if (op.swap) result = result.map(s => s.kind === 'motion' && s.motion === op.swap ? paceGeneratedMotion({ ...s, motion: op.to, label: op.label ?? s.label }) : s);
    else if (op.review) {
      const who = op.review.subject ?? 'source', kept = op.keep ? result.filter(s => s.kind === 'motion' && s.subject === who) : [];
      result = applyCatalogMotion(item, result, op.review);
      for (const s of kept) if (!result.some(r => r.stageId === s.stageId)) result.push(s.afterStage && !result.some(r => r.stageId === s.afterStage) ? { ...s, afterStage: '' } : s);
    } else if (op.add) {
      const { after, ifNone, ...pose } = op.add, anchor = after && result.find(s => s.kind === after);
      if (ifNone && result.some(s => s.kind === 'motion' && s.subject === (pose.subject ?? 'source'))) continue;
      result.push(paceGeneratedMotion({ kind: 'motion', assets: [], stageId: `${item.id}-sf-${pose.motion}-${result.length}`, subject: 'source', delay: 0, duration: 1000,
        intensity: .3, distance: .1, ease: 'easeInOutQuad', targetSelection: 'all', ...pose,
        ...(anchor ? { afterStage: anchor.stageId, timingAnchor: 'start', startOffset: pose.startOffset ?? 0 } : {}) }));
    }
  }
  return result;
}

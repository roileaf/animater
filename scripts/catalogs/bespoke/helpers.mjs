// Stage builders for bespoke compositions. Every builder takes JB2A database
// keys (Patreon first, then Free fallbacks) and Sequencer-style options; any
// recipe/stage option from scripts/core/stage-options.mjs may be passed through.
// Timing: `delay` is absolute ms; or link with { after:'<stageId>', anchor:'start'|'end'|'arrival', offset:ms }.
const keys = assets => (Array.isArray(assets) ? assets : [assets]).map(k => (k.startsWith('jb2a.') || k.includes('/') ? k : `jb2a.${k}`));
const link = ({ after, anchor, offset, ...o }) => (after ? { afterStage: after, timingAnchor: anchor ?? 'end', startOffset: offset ?? 0, ...o } : o);
const base = (kind, label, assets, o = {}) => ({ kind, label, assets: keys(assets), duration: 1500, scale: 1, ...link(o) });

export const cast = (label, assets, o) => base('cast', label, assets, o);
/** Caster → targets beam/missile film stretched between tokens. */
export const travel = (label, assets, o) => base('travel', label, assets, o);
/** Radial film moved from caster to target (object flight). */
export const projectile = (label, assets, o) => base('projectile', label, assets, o);
export const impact = (label, assets, o) => base('impact', label, assets, o);
/** Fills the native/measured area (burst, cone, line, emanation). Lines may use areaLayout:'tiles'. */
export const area = (label, assets, o) => base('template', label, assets, o);
/** Lingering layer on source (default) or targets: aura(label, assets, { subject:'targets' }). */
export const aura = (label, assets, o = {}) => base('aura', label, assets, { subject: 'source', ...o });
/** Cosmetic copy of the token art (afterimages, silhouettes). */
export const sprite = (label, o = {}) => ({ kind: 'sprite', label, assets: [], duration: 1500, ...link(o) });
/**
 * Token motion. Kinds: lunge recoil shake spin levitate pulse (local), rush leap roll dodge (path),
 * press sink flicker throw brace stagger cower slam drift (gestures).
 */
export const motion = (kind, subject = 'source', o = {}) => ({ kind: 'motion', motion: kind, subject, assets: [], duration: 900, intensity: 1, ...link(o) });
/** Colorize to a hex while keeping the film's light/dark structure. */
export const tint = hex => ({ tintEnabled: true, colorize: true, tint: hex });
/** Looping rotation track; dir -1 spins the other way. */
export const spin = (ms = 6000, dir = 1) => ({ tracks: [{ property: 'rotation', from: 0, to: 360 * dir, duration: ms, loop: true, pingPong: false, ease: 'linear' }] });
/** Gentle pulsing scale track. */
export const breathe = (ms = 1600, from = 0.92, to = 1.06) => ({ tracks: [{ property: 'scale.x', from, to, duration: ms, loop: true, pingPong: true, ease: 'easeInOutQuad' }, { property: 'scale.y', from, to, duration: ms, loop: true, pingPong: true, ease: 'easeInOutQuad' }] });
/** Define a bespoke design: design('Rationale…', ({recipe, entry, options}) => [stages], { sound:'profile'|null, soundNamespace:'ability' }). */
export const design = (rationale, build, extra = {}) => ({ rationale, build: ctx => build(ctx), ...extra });

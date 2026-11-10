// The breaking options a decoration offers, as rows for the region panel and the Decorations brush bar (pure: no DOM). The tile's
// Breakable prop lists and labels (prop-config.mjs), each led by Automatic: for the region "Automatic (by kind)", for one kind
// its own default named ("Automatic (water)").
import { MATERIALS } from '../engines/props/prop-material.mjs';
import { CONTENTS, STYLE_CHOICES, burstOf } from '../engines/props/prop-traits.mjs';
import { DECOR_PROP_KEYS, decorOptionApplies, cleanDecorProp } from '../engines/props/decor-options.mjs';
import { decorDefaultsOf } from '../engines/props/decor-break.mjs';
import { MATERIAL_LABELS, CONTENT_LABELS, STYLE_LABELS } from './prop-config.mjs';

export const DECOR_PROP_LABELS = Object.freeze({ material: 'Material', style: 'Breaks as', contents: 'Contents', burst: 'Burst (squares)', light: 'Light prop', tips: 'Tips over instead of breaking' });
// Shorter names where a label column is narrow (the region panel).
export const DECOR_PROP_SHORT = Object.freeze({ tips: 'Tips over' });
export const DECOR_PROP_HINTS = Object.freeze({
  material: 'What it is made of decides what can break it: wood gives way to blows and fire, stone and metal only to force or a heavy slam, plants only burn.',
  style: 'How it comes apart. Topple needs force or a heavy slam; Burn away needs fire.',
  contents: 'What spills when it breaks. Black powder explodes from fire, electricity or another blast, and sets off the powder near it.',
  burst: 'How far its black powder\'s explosion reaches.',
  light: 'Its light goes out when it breaks (a street lamp, a brazier), and so do the lights standing on it; Repair lights them again.',
  tips: 'Knocked over whole by any shove: its fire goes out and hot coals scatter.',
});
const lower = (s) => String(s).toLowerCase();
const yesNo = (on) => (on ? 'yes' : 'no');

/**
 * The rows to show (pure): [{ key, label, hint, type: 'select' | 'number', options?, value }]. `kind` null for the region (every
 * option, Automatic by kind), else the kind being painted (only the options offered for it, Automatic naming its default).
 * `own` the choices saved so far ({ material, ... }; Automatic left out). Burst shows only while Contents is Black powder (the
 * choice, else the kind's default). A kind that never breaks offers nothing.
 */
export function decorPropRows(kind = null, own = {}) {
  const mine = cleanDecorProp(own), d = kind ? decorDefaultsOf(kind) : null;
  if (kind && !d) return [];
  const auto = (text) => ['', kind ? `Automatic (${text})` : 'Automatic (by kind)'];
  const lists = {
    material: [auto(d?.material ? lower(MATERIAL_LABELS[d.material]) : 'as painted'), ...MATERIALS.map((m) => [m, MATERIAL_LABELS[m]])],
    style: [auto(d?.style ? lower(STYLE_LABELS[d.style] ?? d.style) : 'as painted'), ...STYLE_CHOICES.map((s) => [s, STYLE_LABELS[s]])],
    contents: [auto(lower(CONTENT_LABELS[d?.contents ?? 'none'])), ...CONTENTS.map((c) => [c, CONTENT_LABELS[c]])],
    light: [auto(yesNo(d?.light)), ['yes', 'Yes'], ['no', 'No']],
    tips: [auto(yesNo(d?.tips)), ['yes', 'Yes'], ['no', 'No']],
  };
  const powder = (mine.contents ?? (kind ? d.contents : '')) === 'powder';
  const out = [];
  for (const key of DECOR_PROP_KEYS) {
    if (kind && !decorOptionApplies(kind, key)) continue;
    if (key === 'burst') { if (powder) out.push({ key, label: DECOR_PROP_LABELS.burst, hint: DECOR_PROP_HINTS.burst, type: 'number', min: 1, max: 4, value: burstOf(mine.burst) }); continue; }
    out.push({ key, label: DECOR_PROP_LABELS[key], hint: DECOR_PROP_HINTS[key], type: 'select', options: lists[key], value: mine[key] ?? '' });
  }
  return out;
}

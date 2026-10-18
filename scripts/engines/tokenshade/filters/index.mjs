// Registry of animater FX filter specs.
//
// A spec is plain data so it can be checked in node:
//   type      filter type name (matches Token Magic preset `filterType`)
//   defaults  parameter defaults (names match Token Magic's, meanings are ours)
//   uniforms  {uName: [kind, params => value]}; kinds float|int|bool|vec2|vec3|vec4
//   textures  {uName: params => imagePath} (optional)
//   reach     (params, {width, height, size}) => canvas pixels the effect reaches past the art
//   timeScale shader seconds per unit of the `time` parameter
//   order     default stacking order (lower renders first, closer to the art)
//   glsl      the fragment `main()` (see ../glsl.mjs for helpers)
import { COLOR_SPECS } from './color.mjs';
import { LIGHT_SPECS } from './light.mjs';
import { WARP_SPECS } from './warp.mjs';
import { ELEMENT_SPECS } from './elemental.mjs';
import { FIELD_SPECS } from './field.mjs';
import { IMAGE_SPECS } from './image.mjs';
import { STATUS_SPECS } from './status.mjs';
import { DAMAGE_SPECS } from './damage.mjs';

export const SPECS = Object.fromEntries([...COLOR_SPECS, ...LIGHT_SPECS, ...WARP_SPECS, ...ELEMENT_SPECS, ...FIELD_SPECS, ...IMAGE_SPECS, ...STATUS_SPECS, ...DAMAGE_SPECS].map(s => [s.type, s]));
export const FILTER_TYPES = Object.keys(SPECS);
export const specFor = type => (Object.hasOwn(SPECS, type) ? SPECS[type] : null);

import { isColorArray } from './util.mjs';
export { rgb, deg, clamp } from './util.mjs';

// Defaults merged with the preset's own values; anything malformed falls back to the default.
export function resolveParams(spec, params = {}) {
  const out = { ...spec.defaults };
  for (const [key, value] of Object.entries(params)) {
    if (key === 'animated' || key === 'filterType') continue;
    const d = spec.defaults[key];
    if (d === undefined) {
      if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || typeof value === 'string') out[key] = value;
      continue;
    }
    if (typeof d === 'number' && typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof d === 'number' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(+value)) out[key] = +value;
    else if (typeof d === 'boolean' && typeof value === 'boolean') out[key] = value;
    else if (typeof d === 'string' && typeof value === 'string') out[key] = value;
    else if (isColorArray(d) && isColorArray(value)) out[key] = value;
    else if (Array.isArray(d) && Array.isArray(value)) out[key] = value;
  }
  return out;
}

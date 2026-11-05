// The shaders a scene draws as soon as it appears. PIXI compiles a shader the first time it draws it, on the main thread, and on Windows
// one can hold the frame for a few hundred milliseconds: warmed in the background beforehand (tokenshade/warmup.mjs), the same one takes a few.
import { FLOOR_SHADER_SOURCES } from './floor-looks.mjs';
import { LAMP_AIR_SHADER_SOURCES } from './lamp-air.mjs';
import { SKY_SHADER_SOURCES } from './sky-light.mjs';
import { waterShaderSources } from './water-engine.mjs';
import { WAKE_SHADER_SOURCES } from './wake-ripples.mjs';
import { CAVERN_SHADER_SOURCES } from './cavern.mjs';
import { CANOPY_SHADER_SOURCES } from './canopy-light.mjs';
import { COAST_SHADER_SOURCES } from './coast.mjs';
import { STEP_RIPPLE_SHADER_SOURCES } from './step-ripples.mjs';
import { WINDOW_SHADER_SOURCES } from './wall-shadows.mjs';
import { MIRROR_SHADER_SOURCES } from './water-mirror.mjs';
import { WATERFALL_SHADER_SOURCES } from './waterfall.mjs';
import { TORCH_SHADER_SOURCES } from './held-torch.mjs';

// Each [vertex, fragment], what most scenes hold the frame for longest first. `fullWater`: this screen draws the water at full quality.
export const sceneShaderSources = ({ fullWater = true } = {}) => [
  ...FLOOR_SHADER_SOURCES, ...LAMP_AIR_SHADER_SOURCES, ...TORCH_SHADER_SOURCES, ...SKY_SHADER_SOURCES, ...waterShaderSources(fullWater), ...WAKE_SHADER_SOURCES, ...CAVERN_SHADER_SOURCES,
  ...CANOPY_SHADER_SOURCES, ...COAST_SHADER_SOURCES, ...STEP_RIPPLE_SHADER_SOURCES, ...WINDOW_SHADER_SOURCES, ...MIRROR_SHADER_SOURCES, ...WATERFALL_SHADER_SOURCES,
];
// PIXI's own Program for each: Program.from keeps one per source, so these are the very programs the meshes will use.
export const sceneShaderPrograms = (PIXI, options) => sceneShaderSources(options).map(([vertex, fragment]) => PIXI.Program.from(vertex, fragment));

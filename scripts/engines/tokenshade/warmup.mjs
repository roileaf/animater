// Tokenshade shader warm-up. On Windows (ANGLE → Direct3D) a Tokenshade shader's first
// compile takes 0.1–0.9 s, and PIXI does it on the main thread the first time a look
// shows: the frame freezes just as a fireball's Burning look lands on its targets.
// With KHR_parallel_shader_compile the driver compiles in the background instead. Each
// program is compiled and linked exactly as PIXI will (same sources, same attribute
// binding); once it is ready, PIXI builds its own from them, which the browser's shader
// cache answers in a few milliseconds. Without the extension nothing is warmed:
// compiling up front would freeze the canvas just the same (except map distortion's single
// scene program, built at once while the scene loads: buildSceneWarpNow).
import { shaderSource, fieldSource } from './filter-factory.mjs';
import { SPECS } from './filters/index.mjs';
import { sceneWarpProgram } from './filters/scene-warp.mjs';

const COMPLETION_STATUS = 0x91b1; // COMPLETION_STATUS_KHR
// Looks the catalogs reach for first (damage accents, hit reactions), then everything else.
const FIRST = ['fire', 'xfire', 'frost', 'electric', 'adjustment', 'glow', 'corrode', 'fumes', 'veins', 'xbloom', 'xray',
  'shockwave', 'bulgepinch', 'rgbSplit', 'twist', 'transform', 'ripples', 'images', 'liquid', 'xglow', 'smoke', 'zapshadow', 'distortion'];
export const warmOrder = (types = Object.keys(SPECS)) => [...FIRST.filter(t => types.includes(t)), ...types.filter(t => !FIRST.includes(t))];

// PIXI's Program objects for every Tokenshade pass, in warm-up order. Program.from caches
// by source, so these are the very programs the filters will use.
export function tokenshadePrograms(PIXI, types = Object.keys(SPECS)) {
  const vertex = PIXI.Filter.defaultVertexSrc, out = [];
  for (const type of warmOrder(types)) {
    const spec = SPECS[type];
    if (!spec) continue;
    for (const source of [shaderSource(spec), fieldSource(spec)]) if (source) out.push(PIXI.Program.from(vertex, source));
  }
  return out;
}

// Without KHR_parallel_shader_compile, map distortion's one scene program is built at once, on the main thread:
// called while the scene loads, so the first blast does not freeze the canvas compiling it. Returns whether
// it built it (false with the extension: warmShaders does it in the background).
export function buildSceneWarpNow(PIXI, renderer) {
  const gl = renderer?.gl, uid = renderer?.CONTEXT_UID;
  if (!gl || gl.getExtension?.('KHR_parallel_shader_compile') || gl.isContextLost?.()) return false;
  const program = sceneWarpProgram(PIXI);
  if (program.glPrograms[uid]) return false;
  renderer.shader.generateProgram({ program });
  return true;
}

// Warms every program PIXI has not built yet (`sceneWarp`: map distortion's scene filter too,
// first). Resolves with how many were warmed; `stop()` on the returned promise ends it early. A build that still takes long means the cache is
// not helping on this machine, so warming stops rather than freezing the canvas itself.
export function warmShaders(PIXI, renderer, { types, sceneWarp = false, parallel = 3, tick = 40, slowBuild = 120, now = () => performance.now() } = {}) {
  const gl = renderer?.gl, uid = renderer?.CONTEXT_UID;
  let stopped = false;
  const done = new Promise(resolve => {
    if (!gl?.getExtension?.('KHR_parallel_shader_compile') || gl.isContextLost?.()) return resolve(0);
    const queue = [...(sceneWarp ? [sceneWarpProgram(PIXI)] : []), ...tokenshadePrograms(PIXI, types)].filter(p => !p.glPrograms[uid]);
    const active = [];
    let warmed = 0;
    const start = program => {
      const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; };
      const vs = shader(gl.VERTEX_SHADER, program.vertexSrc), fs = shader(gl.FRAGMENT_SHADER, program.fragmentSrc), glp = gl.createProgram();
      gl.attachShader(glp, vs); gl.attachShader(glp, fs);
      gl.linkProgram(glp);
      active.push({ program, glp, vs, fs, bound: false });
    };
    const release = job => { gl.deleteShader(job.vs); gl.deleteShader(job.fs); gl.deleteProgram(job.glp); };
    const step = () => {
      if (stopped || gl.isContextLost()) { active.forEach(release); return resolve(warmed); }
      for (const job of [...active]) {
        if (!gl.getProgramParameter(job.glp, COMPLETION_STATUS)) continue;
        if (!gl.getProgramParameter(job.glp, gl.LINK_STATUS)) { active.splice(active.indexOf(job), 1); release(job); continue; }
        if (!job.bound) {
          // PIXI links once as written, then again with attributes bound in name order.
          const names = [];
          for (let i = 0, n = gl.getProgramParameter(job.glp, gl.ACTIVE_ATTRIBUTES); i < n; i++) names.push(gl.getActiveAttrib(job.glp, i).name);
          names.sort((a, b) => (a > b ? 1 : -1)).forEach((name, i) => gl.bindAttribLocation(job.glp, i, name));
          gl.linkProgram(job.glp);
          job.bound = true;
          continue;
        }
        active.splice(active.indexOf(job), 1);
        release(job);
        if (job.program.glPrograms[uid]) continue;
        const t0 = now();
        renderer.shader.generateProgram({ program: job.program });
        warmed++;
        if (now() - t0 > slowBuild) stopped = true;
      }
      while (!stopped && active.length < parallel && queue.length) {
        const program = queue.shift();
        if (!program.glPrograms[uid]) start(program);
      }
      if (!active.length && !queue.length) return resolve(warmed);
      setTimeout(step, tick);
    };
    step();
  });
  done.stop = () => { stopped = true; };
  return done;
}

// The painted animals. Each animal engine paints its own frames (a pigeon standing, its four walking steps, its wings at six
// spreads...). The painted look is baked from tools/fx-gallery (bake-animals.html, animal-bake-spec.mjs) into one picture
// sheet per engine, assets/animals/<group>.webp, with a map of which frame sits where. restyle() takes an engine's set of
// textures and hands back the same set with every frame that has a baked picture redrawn in the painted look, fitted to the
// engine's own frame's size and place, so every scale, shadow and layer the engine works out stays as it was. A frame with
// no baked picture, or any frame before the sheets have loaded, stays as the engine drew it. Our own code.

export const ART_GROUPS = Object.freeze(['town', 'wildlife', 'field', 'pond', 'farm', 'vermin', 'aftermath']);
const BASE = 'modules/animater/assets/animals';
// How much finer than the engine's own frame each group's pictures are drawn (a farm's frames are already drawn twice over).
const SHARP = { farm: 1.5, vermin: 2, town: 2.5, wildlife: 2.5, field: 2.5, pond: 2.5, aftermath: 2.5 };
const sheets = new Map();
let loading = null;

/** Loads the sheets once (each group's map and picture); resolves when all have loaded or failed (a failed one leaves that group as drawn). */
export function loadAnimalArt({ base = BASE, fetchJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)), loadImage = imageOf } = {}) {
  return (loading ??= Promise.all(ART_GROUPS.map(async (group) => {
    try {
      const map = await fetchJson(`${base}/${group}.json`);
      if (!map?.frames) return;
      const img = await loadImage(`${base}/${group}.webp`);
      let normals = null; try { if (map.ncell) normals = await loadImage(`${base}/${group}-n.webp`); } catch { normals = null; }
      sheets.set(group, { map, img, normals });
    } catch { /* that group stays as drawn */ }
  })));
}
const imageOf = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
export const animalArtReady = (group) => sheets.has(group);
/** For tests: set or forget a group's sheet. */
export function setAnimalSheet(group, sheet) { if (sheet) sheets.set(group, sheet); else sheets.delete(group); }

/** The bounds of what is drawn (alpha over `cut`) in RGBA `data` of `w` x `h` (pure); null when nothing is. */
export function drawnBox(data, w, h, cut = 32) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > cut) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/**
 * How to lay a baked picture over the engine's own frame (pure): scaled so the animal is as long as the engine's (along its
 * length: up the picture, or across it when `across`, as a rat drawn facing right), its middle on the engine's middle.
 * { scale, dx, dy } take a point of the baked picture to the frame's; null if either box is empty.
 */
export function fitOf(own, baked, across = false) {
  if (!own || !baked) return null;
  const scale = across ? own.w / baked.w : own.h / baked.h;
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  return { scale, dx: own.x + own.w / 2 - (baked.x + baked.w / 2) * scale, dy: own.y + own.h / 2 - (baked.y + baked.h / 2) * scale };
}

const isTexture = (v) => !!v && typeof v === 'object' && 'baseTexture' in v;
const sourceOf = (tex) => tex?.baseTexture?.resource?.source ?? tex?.baseTexture?.source ?? null;
// Every texture in a set by its path ('walk/2', '0/fly/3'), and the set rebuilt with each one passed through `swap`.
function leavesOf(set, prefix, out = new Map()) {
  if (isTexture(set)) out.set(prefix, set);
  else if (Array.isArray(set)) set.forEach((v, i) => leavesOf(v, prefix ? `${prefix}/${i}` : String(i), out));
  else if (set && typeof set === 'object') for (const [k, v] of Object.entries(set)) leavesOf(v, prefix ? `${prefix}/${k}` : k, out);
  return out;
}
function rebuild(set, prefix, swap) {
  if (isTexture(set)) return swap(prefix, set);
  if (Array.isArray(set)) return set.map((v, i) => rebuild(v, prefix ? `${prefix}/${i}` : String(i), swap));
  if (set && typeof set === 'object') return Object.fromEntries(Object.entries(set).map(([k, v]) => [k, rebuild(v, prefix ? `${prefix}/${k}` : k, swap)]));
  return set;
}

/**
 * The engine's set with its frames in the painted look where `group`'s sheet has them. `prefix` the set's place in the
 * group's paths ('pigeon', 'cat/1'). The same set back, untouched, when the sheet is not loaded or there is no canvas.
 */
export function restyle(PIXI, group, set, prefix = '') {
  const sheet = sheets.get(group);
  if (!sheet || !set || typeof document === 'undefined') return set;
  const { map, img, normals } = sheet, cell = map.cell, leaves = leavesOf(set, prefix), fits = new Map();
  // One cell of a sheet (the colours, or at `ncell` which way they face) on a canvas the colours' size, turned to face as
  // the engine's frames do (`rot`, radians clockwise).
  const cellCanvas = (f, from = img, size = cell) => {
    const c = document.createElement('canvas'); c.width = c.height = cell; const x = c.getContext('2d');
    x.translate(cell / 2, cell / 2); if (f.rot) x.rotate(f.rot); x.translate(-cell / 2, -cell / 2);
    x.drawImage(from, (f.i % map.cols) * size, Math.floor(f.i / map.cols) * size, size, size, 0, 0, cell, cell);
    return c;
  };
  const boxOf = (c) => { const x = c.getContext('2d', { willReadFrequently: true }); return drawnBox(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); };
  // A family's fit, from its reference frame: the engine's drawing of it against the baked picture of it.
  const fitFor = (f) => {
    if (fits.has(f.ref)) return fits.get(f.ref);
    const refFrame = map.frames[f.ref] ?? f, own = sourceOf(leaves.get(f.ref));
    let fit = null;
    // matched along its length (across, for one turned on its side), or a flyer by its wingspan (fit 'w')
    const across = refFrame.fit === 'w' || (!!refFrame.rot && Math.abs(Math.sin(refFrame.rot)) > 0.5);
    try { if (own?.getContext) fit = fitOf(boxOf(own), boxOf(cellCanvas(refFrame)), across); } catch { fit = null; }
    fits.set(f.ref, fit);
    return fit;
  };
  return rebuild(set, prefix, (path, tex) => {
    const f = map.frames[path], src = sourceOf(tex);
    if (!f || !src?.width) return tex;
    const fit = fitFor(f);
    if (!fit) return tex;
    try {
      // Drawn at SHARP times the engine's own frame and given to PIXI at that resolution: the same size on the map (every
      // scale the engine works out holds), but sharp when the map is shown bigger than its pictures, as on a fine grid.
      const R = SHARP[group] ?? 2;
      const laid = (from, size) => { const out = document.createElement('canvas'); out.width = Math.round(src.width * R); out.height = Math.round(src.height * R);
        const x = out.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.setTransform(fit.scale * R, 0, 0, fit.scale * R, fit.dx * R, fit.dy * R); x.drawImage(cellCanvas(f, from, size), 0, 0); return out; };
      const look = PIXI.Texture.from(laid(img, cell), { resolution: R });
      // which way its surface faces, laid the same, for the lit sprite (LitSprite) to shade it by the light where it is
      if (normals && map.ncell) { look.animaterNormal = PIXI.Texture.from(laid(normals, map.ncell), { resolution: R }); look.animaterTurn = f.rot ?? 0; }
      return look;
    } catch { return tex; }
  });
}

// ---- The painted animals lit where they are ----
// A baked frame carries which way its surface faces (animaterNormal). A lit sprite shades it, as the mock painted it (a few
// painted steps), by the light that is really on it: the sun from where it stands in the sky, the moon at night, and the
// lamps near it, each from its own side. Foundry's own lighting still brightens and darkens the scene over it; this gives
// the light its direction. Shadows (tinted black) and frames without the facing are drawn as plain sprites.
const light = { key: [-0.43, -0.48, 0.76], keyOn: 0.35, lamps: new Float32Array(6 * 4), lampCount: 0 };
/** The light from the sky (pure): `sun` as sun.mjs gives it ({ angle screen degrees toward it, height degrees, strength, moon }), null with none. */
export function keyLightOf(sun) {
  if (!sun) return { dir: [-0.43, -0.48, 0.76], on: 0.35 };
  const a = (Number(sun.angle) || 0) * Math.PI / 180, h = Math.max(6, Math.min(90, Number(sun.height) || 40)) * Math.PI / 180;
  const on = Math.max(0, Math.min(1, Number(sun.strength) || 0)) * (sun.moon ? 0.6 : 1);
  return { dir: [Math.cos(a) * Math.cos(h), Math.sin(a) * Math.cos(h), Math.sin(h)], on: Math.max(0.2, on) };
}
/** The lamps nearest `at` (pure): up to `most` of { x, y, radius, strength }, as [x, y, radius, strength] runs. */
export function nearestLamps(lamps = [], at = { x: 0, y: 0 }, most = 6) {
  return lamps.filter((l) => l && l.radius > 0 && Math.hypot(l.x - at.x, l.y - at.y) < l.radius * 1.2)
    .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) / a.radius - Math.hypot(b.x - at.x, b.y - at.y) / b.radius).slice(0, most);
}
/** The light the animals are lit by now (main sets it each frame): the sun or moon, and the lamps about the view. */
export function setAnimalLight({ sun = null, lamps = [], at = null } = {}) {
  const key = keyLightOf(sun); light.key = key.dir; light.keyOn = key.on;
  const near = at ? nearestLamps(lamps, at) : lamps.slice(0, 6);
  light.lamps.fill(0); near.forEach((l, i) => light.lamps.set([l.x, l.y, l.radius, Math.max(0, Math.min(1, l.strength ?? 1))], i * 4));
  light.lampCount = near.length;
}
export const animalLightNow = () => ({ key: [...light.key], keyOn: light.keyOn, lampCount: light.lampCount });
const canvasDarkness = () => { try { return Number(globalThis.canvas?.environment?.darknessLevel) || 0; } catch { return 0; } };
/**
 * Which way and how far an animal's shadow at (x, y) is drawn out (pure): `dir` radians on the map, `k` how many times its
 * own length. In the dark the nearest lamp in reach throws it away from itself (the nearer, the longer); else the sun or
 * moon, the lower the longer, faint ones barely. null when nothing throws one.
 */
export function shadowStretch({ key, keyOn, lamps, lampCount }, x, y, darkness = 0) {
  if (darkness > 0.45) {
    let best = null;
    for (let i = 0; i < lampCount; i++) { const lx = lamps[i * 4], ly = lamps[i * 4 + 1], r = lamps[i * 4 + 2], d = Math.hypot(x - lx, y - ly); if (r > 0 && d < r && (!best || d / r < best.near)) best = { near: d / r, dir: Math.atan2(y - ly, x - lx) }; }
    if (best) return { dir: best.dir, k: 1 + 1.4 * (1 - best.near) };
  }
  const len = Math.hypot(key[0], key[1]);
  if (len < 0.02) return null;
  const elevation = Math.atan2(key[2], len);
  return { dir: Math.atan2(-key[1], -key[0]), k: 1 + Math.min(2.2, 0.75 / Math.tan(Math.max(0.12, elevation))) * Math.min(1, keyOn) };
}

const LIT_VERT = `precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix; uniform vec2 uPos, uSize, uScale; uniform float uRot;
varying vec2 vUv; varying vec2 vScene;
void main(){
  vUv = aTextureCoord;
  vec2 local = (aTextureCoord - 0.5) * uSize * uScale; float c = cos(uRot), s = sin(uRot);
  vScene = uPos + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;
const LIT_FRAG = `precision highp float;
varying vec2 vUv; varying vec2 vScene;
uniform sampler2D uSampler, uNormal; uniform float uRot, uAlpha; uniform vec3 uTint;
uniform vec3 uKey; uniform float uKeyOn; uniform vec4 uLamps[6]; uniform float uLampCount;
float band(float dif){ return smoothstep(0.42, 0.48, dif) * 0.35 + smoothstep(0.6, 0.66, dif) * 0.35 + smoothstep(0.8, 0.86, dif) * 0.3; }
float painted(vec3 n, vec3 L){ return 0.5 + 0.6 * band(dot(n, L) * 0.5 + 0.5); }
void main(){
  vec4 c = texture2D(uSampler, vUv);
  if (c.a < 0.002) { gl_FragColor = vec4(0.0); return; }
  vec3 alb = c.rgb / c.a;
  vec4 f = texture2D(uNormal, vUv);
  vec3 n = f.a > 0.02 ? normalize(f.rgb / f.a * 2.0 - 1.0) : vec3(0.0, 0.0, 1.0);
  n.y = -n.y;   // baked with y up; the scene's y runs down
  float cr = cos(uRot), sr = sin(uRot); n.xy = vec2(n.x * cr - n.y * sr, n.x * sr + n.y * cr);
  // the sky's light, its steps stronger the stronger it is; then each lamp near, from its own side, more the closer
  float shade = mix(0.92, painted(n, normalize(uKey)), uKeyOn), lampW = 0.0, lampS = 0.0;
  for (int i = 0; i < 6; i++) { if (float(i) >= uLampCount) break; vec4 l = uLamps[i]; vec2 to = l.xy - vScene; float d = length(to);
    float w = l.w * (1.0 - smoothstep(l.z * 0.15, l.z, d)); if (w <= 0.0) continue;
    lampS += w * painted(n, normalize(vec3(to, l.z * 0.3))); lampW += w; }
  if (lampW > 0.0) shade = mix(shade, lampS / lampW, min(1.0, lampW) * (1.0 - 0.6 * uKeyOn));
  gl_FragColor = vec4(alb * shade * uTint, 1.0) * c.a * uAlpha;
}`;

/** PIXI with its Sprite lit (for the animal engines): the same namespace, Sprite a LitSprite. */
export function litPIXI(PIXI) {
  if (!PIXI?.Sprite || PIXI.__animaterLit) return PIXI;
  let shader = null, geometry = null, state = null, broken = false;
  const ready = () => {
    if (shader || broken) return !!shader;
    try {
      shader = PIXI.Shader.from(LIT_VERT, LIT_FRAG, { uSampler: PIXI.Texture.EMPTY, uNormal: PIXI.Texture.EMPTY, uPos: [0, 0], uSize: [1, 1], uScale: [1, 1], uRot: 0, uAlpha: 1, uTint: [1, 1, 1], uKey: light.key, uKeyOn: light.keyOn, uLamps: light.lamps, uLampCount: 0 });
      geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new Float32Array(8), 2).addAttribute('aTextureCoord', new Float32Array(8), 2).addIndex([0, 1, 2, 0, 2, 3]);
      state = PIXI.State.for2d();
    } catch { broken = true; shader = null; }
    return !!shader;
  };
  class LitSprite extends PIXI.Sprite {
    _render(renderer) {
      const tex = this.texture, normal = tex?.animaterNormal;
      if (this.tint === 0 && normal) return this._renderShadow(renderer);
      if (!normal || !ready()) return super._render(renderer);
      try {
        renderer.batch.flush();
        this.calculateVertices();
        geometry.buffers[0].update(this.vertexData); geometry.buffers[1].update(tex._uvs.uvsFloat32);
        const u = shader.uniforms, t = this.tint ?? 0xffffff;
        u.uSampler = tex; u.uNormal = normal; u.uPos = [this.x, this.y]; u.uSize = [tex.width, tex.height]; u.uScale = [this.scale.x, this.scale.y];
        u.uRot = this.rotation + (tex.animaterTurn ?? 0); u.uAlpha = this.worldAlpha; u.uTint = [((t >> 16) & 255) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
        u.uKey = light.key; u.uKeyOn = light.keyOn; u.uLamps = light.lamps; u.uLampCount = light.lampCount;
        renderer.shader.bind(shader); renderer.state.set(state); renderer.geometry.bind(geometry, shader);
        renderer.geometry.draw(PIXI.DRAW_MODES.TRIANGLES, 6, 0);
      } catch { broken = true; super._render(renderer); }
    }
    // Its shadow (the engine's black copy of it) drawn out along the light, from its feet: away from the sun, longer the lower
    // it stands; at night by a lamp, away from the lamp, longer the nearer. The engine has already set where it falls.
    _renderShadow(renderer) {
      const s = shadowStretch(light, this.x, this.y, canvasDarkness());
      if (!s || s.k <= 1.02 || !this.parent) return super._render(renderer);
      const keep = { x: this.x, y: this.y, r: this.rotation, sx: this.scale.x, sy: this.scale.y, kx: this.skew.x, ky: this.skew.y };
      try {
        const len = Math.max(this.texture.width, this.texture.height) * Math.abs(this.scale.x) * 0.25 * (s.k - 1);
        const m = new PIXI.Matrix().scale(this.scale.x, this.scale.y).rotate(this.rotation).rotate(-s.dir).scale(s.k, 1).rotate(s.dir)
          .translate(this.x + Math.cos(s.dir) * len, this.y + Math.sin(s.dir) * len);
        this.transform.setFromMatrix(m); this.transform.updateTransform(this.parent.transform); this._transformID = -1;
        super._render(renderer);
      } finally {
        this.position.set(keep.x, keep.y); this.rotation = keep.r; this.scale.set(keep.sx, keep.sy); this.skew.set(keep.kx, keep.ky);
        this.transform.updateTransform(this.parent.transform);
      }
    }
  }
  const out = Object.create(PIXI); Object.defineProperty(out, 'Sprite', { value: LitSprite }); Object.defineProperty(out, '__animaterLit', { value: true });
  return out;
}

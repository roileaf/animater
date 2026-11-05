// A step into water: the water around the foot rings out, as a drop into a pool does (drips.mjs), its waves bending the
// map seen through it, the crests lit on the side facing the light and glinting, the troughs dark, with a little crown
// of splashed droplets. On the GPU, a quad a ripple (the last MAX_RIPPLES), the floor read from the map's own picture.

export const MAX_RIPPLES = 24;
const LIFE = 2.2;

const VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec4 aRipple;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos; varying vec4 vRipple;
void main(){ vPos = aVertexPosition; vRipple = aRipple;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vPos;
varying vec4 vRipple;       // x, y, when (seconds), size (1 a Medium creature's step; below 0 where the map is painted over)
uniform sampler2D uFloor;   // the map's own picture
uniform vec4 uRect;         // where it lies: x, y, w, h
uniform float uTime, uGrid, uHasFloor;
vec3 floorAt(vec2 at){ return uHasFloor > 0.5 ? texture2D(uFloor, clamp((at - uRect.xy) / uRect.zw, 0.0, 1.0)).rgb : vec3(0.2, 0.25, 0.3); }
void main(){
  float s = uTime - vRipple.z, size = abs(vRipple.w), g = uGrid * size;
  if (s < 0.0 || s > ${LIFE.toFixed(1)}) { gl_FragColor = vec4(0.0); return; }
  vec2 p = vPos - vRipple.xy; float dist = length(p);
  // A short train of waves running out from the foot and dying away.
  float off = dist - s * g * 0.9, wid = g * 0.3;
  float env = exp(-pow((off + g * 0.24) / wid, 2.0)) * exp(-s * 1.6) * min(1.0, g * 0.4 / (dist + g * 0.12)) * 1.1;
  vec2 slope = -env * sin(off * 28.0 / g) * 0.42 * p / max(dist, 0.001);
  vec3 L = normalize(vec3(-0.55, -0.45, 0.7)), H = normalize(L + vec3(0.0, 0.0, 1.0)), n = normalize(vec3(-slope, 1.0));
  float spec = pow(max(0.0, dot(n, H)), 220.0) * 1.8, shade = (-slope.x * L.x - slope.y * L.y) * 1.6;
  vec3 col = floorAt(vPos + slope * g * 0.9) + vec3(0.27, 0.24, 0.22) * shade + vec3(1.0, 0.85, 0.63) * spec;
  float a = clamp(env * 3.0, 0.0, 1.0);
  // Painted over: the map's picture is not what is seen here, so only the waves' light and dark go on it.
  float painted = vRipple.w < 0.0 ? 1.0 : 0.0, wave = a;
  if (painted > 0.5) { col = vec3(0.27, 0.24, 0.22) * max(0.0, shade) + vec3(1.0, 0.85, 0.63) * spec; a = clamp(-shade * 0.55, 0.0, 0.5) * wave; }
  // The splash: droplets thrown out round the foot and falling back.
  if (s < 0.4) { float c = s / 0.4, spark = 0.0; for (int j = 0; j < 9; j++) { float an = float(j) / 9.0 * 6.2832 + vRipple.x * 0.01, r = g * 0.32 * c * (0.7 + 0.3 * fract(float(j) * 0.618));
    vec2 at = vec2(cos(an), sin(an) * 0.85) * r - vec2(0.0, sin(c * 3.1416) * g * 0.1); spark += 0.7 * (1.0 - c) * exp(-dot(p - at, p - at) / (g * g * 0.00015)); }
    col += vec3(0.88, 0.91, 0.95) * spark; a = max(a, min(1.0, spark)); wave = max(wave, min(1.0, spark)); }
  gl_FragColor = vec4(col * (painted > 0.5 ? wave : a), a);
}`;

// Whether something moving through the water has come far enough for its next ripple (pure): `from` where the last was, `at` where it is now, `spacing` px.
export const rippleDue = (from, at, spacing) => !from || Math.hypot(at.x - from.x, at.y - from.y) >= spacing;

/** The layer: add({ x, y, size, painted }) rings the water there now (`painted`: the map is covered there); floor({ texture, rect }) the map's picture; tick(seconds); clear(). */
export function createStepRipples({ PIXI, root, grid = () => 100 }) {
  let mesh = null, own = null, pos = null, info = null, next = 0, live = 0;
  const make = () => {
    pos = new Float32Array(MAX_RIPPLES * 8); info = new Float32Array(MAX_RIPPLES * 16).fill(-99);
    const index = []; for (let i = 0; i < MAX_RIPPLES; i++) index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    own = { uFloor: PIXI.Texture.WHITE, uRect: [0, 0, 1, 1], uTime: 0, uGrid: grid(), uHasFloor: 0 };
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(pos, false), 2).addAttribute('aRipple', new PIXI.Buffer(info, false), 4).addIndex(index);
    mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own)); mesh.eventMode = 'none'; mesh.visible = false;
    root().addChild(mesh);
  };
  const clear = () => { try { mesh?.parent?.removeChild(mesh); mesh?.destroy(); } catch { /* gone */ } mesh = null; own = null; live = 0; };
  return {
    floor(f) { if (!mesh || mesh.destroyed) make(); const ok = !!f?.texture?.valid; own.uFloor = ok ? f.texture : PIXI.Texture.WHITE; own.uRect = ok ? [f.rect.x, f.rect.y, f.rect.width, f.rect.height] : [0, 0, 1, 1]; own.uHasFloor = ok ? 1 : 0; },
    add({ x, y, size = 1, painted = false } = {}) {
      if (!mesh || mesh.destroyed) make();
      own.uGrid = grid();
      const i = next, H = own.uGrid * size * 2.4; next = (next + 1) % MAX_RIPPLES;
      pos.set([x - H, y - H, x + H, y - H, x + H, y + H, x - H, y + H], i * 8);
      for (let k = 0; k < 4; k++) info.set([x, y, own.uTime, painted ? -size : size], (i * 4 + k) * 4);
      mesh.geometry.getBuffer('aVertexPosition').update(); mesh.geometry.getBuffer('aRipple').update();
      mesh.visible = true; live = LIFE;
    },
    tick(seconds) { if (!own || live <= 0) return; own.uTime += seconds; live -= seconds; if (live <= 0) mesh.visible = false; },
    clear,
    get busy() { return live > 0; },
  };
}

// Water going over an edge. Inside the region: white strands that speed up as they fall and come apart into strings, and churning foam at the foot. Past the foot, over everything:
// mist rising and going off with the wind, and a faint spray rainbow on the side away from the sun when it is well up. In a hard frost: hung still, blue-white icicles. Two meshes
// for each fall and nothing drawn when it is out of view. Every screen has its own: nothing here is saved or shared.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const S = Math.SQRT1_2;
// The ways water can go, north up the map.
export const FLOW_WAYS = Object.freeze({ n: [0, -1], ne: [S, -S], e: [1, 0], se: [S, S], s: [0, 1], sw: [-S, S], w: [-1, 0], nw: [-S, -S] });

// The lie of a fall (pure), from its region's flat points and which way it goes: `head` the line it comes over and `foot` where it lands (each { a, b, mid }), `length` between them,
// `width` the region's whole span across, `way` and `across` unit vectors. Each line is as wide as the region is near that end, so a fall narrowing to a point keeps a real lip. null: no shape.
export function fallAxis(area, flowTo = 's') {
  if (!area || area.length < 6) return null;
  const [dx, dy] = FLOW_WAYS[String(flowTo).toLowerCase()] ?? FLOW_WAYS.s, ax = -dy, ay = dx;
  const along = [], side = [];
  for (let i = 0; i < area.length; i += 2) { along.push(area[i] * dx + area[i + 1] * dy); side.push(area[i] * ax + area[i + 1] * ay); }
  const low = Math.min(...along), high = Math.max(...along), length = high - low, width = Math.max(...side) - Math.min(...side);
  if (length <= 0 || width <= 0) return null;
  // What the region spans at a slice across it, taking in every corner beyond the slice.
  const span = (slice, beyond) => {
    let a = Infinity, b = -Infinity;
    const see = (v) => { a = Math.min(a, v); b = Math.max(b, v); };
    for (let i = 0, j = along.length - 1; i < along.length; j = i++) {
      if (beyond(along[i])) see(side[i]);
      if ((along[i] > slice) !== (along[j] > slice)) see(side[j] + ((slice - along[j]) / (along[i] - along[j])) * (side[i] - side[j]));
    }
    return Number.isFinite(a) ? [a, b] : [Math.min(...side), Math.max(...side)];
  };
  const point = (p, q) => ({ x: dx * p + ax * q, y: dy * p + ay * q });
  const line = (p, [a, b]) => ({ a: point(p, a), b: point(p, b), mid: point(p, (a + b) / 2) });
  const cut = length * 0.1;
  return { way: { x: dx, y: dy }, across: { x: ax, y: ay }, head: line(low, span(low + cut, (v) => v <= low + cut)), foot: line(high, span(high - cut, (v) => v >= high - cut)), length, width };
}

// Where a drop has got to in the time of its fall (pure): for `u` 0-1 of the way down, 0-1 of the time. Equal times cover more and more ground: it speeds up as it falls.
export const fallPhase = (u) => Math.sqrt(clamp(Number(u) || 0, 0, 1));

// Where the spray shows a rainbow (pure): `foot` a place or a fall's foot line, `sun` { angle degrees toward it, height degrees up, strength 0-1, moon }. Out from the foot on the side away
// from the sun, { x, y, radius, angle, strength 0-1 }. null: no sun, the moon, or the sun low or weak.
export const RAINBOW_LEAST_HEIGHT = 15;
export function rainbowAt(foot, sun, { grid = 100 } = {}) {
  if (!foot || !sun || sun.moon) return null;
  const height = sun.height === undefined ? 45 : Number(sun.height) || 0, power = sun.strength === undefined ? 1 : Number(sun.strength) || 0;
  if (height < RAINBOW_LEAST_HEIGHT || power < 0.3) return null;
  const at = foot.mid ?? foot, away = (((Number(sun.angle) || 0) + 180) * Math.PI) / 180;
  return { x: at.x + Math.cos(away) * grid * 1.6, y: at.y + Math.sin(away) * grid * 1.6, radius: grid * 1.4, angle: away, strength: Math.min(1, (power - 0.3) / 0.4) * Math.min(1, (height - RAINBOW_LEAST_HEIGHT) / 15) };
}

// The square the mist is drawn in (pure): past the foot, wide enough for the fall, for its going off with the wind and for its rainbow.
export function mistBox(axis, grid = 100) {
  const half = axis.width / 2 + grid * 3.2, cx = axis.foot.mid.x + axis.way.x * grid * 1.2, cy = axis.foot.mid.y + axis.way.y * grid * 1.2;
  return { x: cx - half, y: cy - half, w: half * 2, h: half * 2 };
}

const VERT = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos;
void main(){ vPos = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const BODY_FRAG = `
precision highp float;
varying vec2 vPos;
uniform vec2 uHead, uWay, uAcross;           // the middle of the lip, the way down, the way across
uniform float uLength, uGrid, uTime, uSwift, uLight, uFrozen;
${NOISE}
void main(){
  vec2 rel = vPos - uHead;
  float a = clamp(dot(rel, uWay) / uLength, 0.0, 1.0), side = dot(rel, uAcross) / uGrid, fall = sqrt(a);
  vec2 p = vPos / uGrid;
  float shade = mix(0.25, 1.0, uLight), lip = smoothstep(0.0, 0.03, a);
  if (uFrozen > 0.5) {
    // Hung still: a sheet of ice with icicles of their own lengths down it, a heap at the foot.
    float cols = side * 6.0, strand = floor(cols), reach = mix(0.45, 1.0, hash(vec2(strand, 3.7))), t = a / reach;
    float wid = 0.5 * (1.0 - t * t), ice = (1.0 - smoothstep(wid - 0.12, wid, abs(fract(cols) - 0.5))) * step(t, 1.0);
    float frost = noise(p * 8.0), heap = smoothstep(0.8, 0.98, a) * smoothstep(0.3, 0.6, frost + 0.2);
    vec3 col = mix(vec3(0.5, 0.66, 0.82), vec3(0.93, 0.97, 1.0), max(ice * (0.5 + 0.5 * frost), heap));
    float al = lip * clamp(0.42 + 0.48 * ice + 0.5 * heap, 0.0, 0.95);
    gl_FragColor = vec4(col * shade * al, al);
    return;
  }
  // A drop's place in its fall stays the same number as it goes down, so strands drawn on that number speed up as they fall.
  float flow = fall * uLength / uGrid * 1.6 - uTime * (1.7 + uSwift * 0.9);
  float col0 = side + (noise(vec2(side * 0.7, a * 3.0)) - 0.5) * 0.25 * (0.3 + a);
  float strands = noise(vec2(col0 * 9.0, flow)) * 0.65 + noise(vec2(col0 * 23.0, flow * 1.7 + 3.0)) * 0.35;
  float th = mix(0.62, 0.4, a) - uSwift * 0.06, white = smoothstep(th, th + 0.16, strands);
  // They come apart into strings the further they have dropped.
  white *= smoothstep(0.18, 0.38, noise(vec2(col0 * 5.0, flow * 3.0)) + (1.0 - a) * 0.3);
  float n1 = noise(p * 3.0 + vec2(uTime * 0.9, -uTime * 0.7)), n2 = noise(p * 7.0 - vec2(uTime * 1.4, uTime * 0.3)), n3 = noise(p * 14.0 + vec2(n1, n2) * 4.0);
  float foot = smoothstep(0.76, 0.97, a), foam = foot * smoothstep(0.35, 0.68, n1 * 0.45 + n2 * 0.3 + n3 * 0.3);
  float w = max(white, foam);
  vec3 col = mix(vec3(0.3, 0.4, 0.46), vec3(0.95, 0.98, 1.0), w);
  float al = lip * clamp(0.26 + 0.6 * w + 0.2 * foot, 0.0, 0.96);
  gl_FragColor = vec4(col * shade * al, al);
}`;

const MIST_FRAG = `
precision highp float;
varying vec2 vPos;
uniform vec2 uFoot, uWay, uAcross, uDrift, uLean;   // the foot, the way down, across, how far the wind has carried the mist (squares), and leans it now (px)
uniform vec4 uBow;                           // the rainbow: x, y, radius, strength
uniform float uWidth, uGrid, uTime, uLight;
${NOISE}
void main(){
  vec2 rel = vPos - uFoot - uLean;
  float along = dot(rel, uWay) / uGrid, side = abs(dot(rel, uAcross)) / uGrid, half0 = uWidth / uGrid * 0.5;
  float plume = smoothstep(-0.6, 0.3, along) * (1.0 - smoothstep(1.0, 3.0, along)) * (1.0 - smoothstep(half0 + 0.1, half0 + 2.0, side));
  if (plume < 0.003) { gl_FragColor = vec4(0.0); return; }
  // Billows swelling out from the foot, the wind taking them.
  vec2 p = vPos / uGrid - uDrift, out0 = uWay * uTime * 0.22;
  float fog = noise(p * 1.3 - out0) * 0.55 + noise(p * 2.9 - out0 * 1.6 + 5.0) * 0.3 + noise(p * 6.1 - out0 * 2.4 + 9.0) * 0.15;
  float mist = plume * smoothstep(0.28, 0.72, fog), al = 0.42 * mist;
  vec3 c = vec3(0.92, 0.95, 0.97) * mix(0.25, 1.0, uLight) * al;
  if (uBow.w > 0.001) {
    // Only as far as there is mist to show it. Red outermost.
    float band = (length(vPos - uBow.xy) / uBow.z - 0.82) / 0.18;
    float ring = smoothstep(0.0, 0.2, band) * (1.0 - smoothstep(0.8, 1.0, band));
    vec3 hue = 0.5 + 0.5 * cos(6.2832 * ((1.0 - band) * 0.72 + vec3(0.0, 0.33, 0.67)));
    // An arc, not a ring: the part of the circle facing back up the fall, fading out at its ends.
    float arc = smoothstep(0.05, 0.65, dot(normalize(vPos - uBow.xy), -uWay));
    float bow = uBow.w * 0.26 * ring * arc * (mist * 0.85 + plume * 0.15);
    c = c * (1.0 - bow) + hue * uLight * bow; al = bow + al * (1.0 - bow);
  }
  gl_FragColor = vec4(c, al);
}`;
export const WATERFALL_SHADERS = Object.freeze({ vert: VERT, body: BODY_FRAG, mist: MIST_FRAG });

// The triangles of a region (flat points), with earcut as PIXI carries it; a fan if it does not.
const trianglesOf = (PIXI, area) => {
  const earcut = PIXI.utils?.earcut;
  if (earcut) { const made = earcut(area); if (made?.length) return made; }
  const out = []; for (let i = 1; i < area.length / 2 - 1; i++) out.push(0, i, i + 1);
  return out;
};

/**
 * The layer: build({ falls: [{ area (flat points), flowTo ('n', 'ne', ... 'nw', north up), swift }], grid }); look({ sun { angle, height, strength, moon }, light 0-1, frozen, wind 0-1, windAngle radians });
 * tick(seconds, { view { x, y, w, h } }); clear(). `floor()` under the creatures for the water, `above()` over them for the mist. `render` is taken for the same shape as the other water layers and not called: nothing is baked.
 */
export function createWaterfalls({ PIXI, floor, above, render = () => {} }) {
  void render;
  let falls = [], grid = 100, time = 0, drift = [0, 0], asked = null;
  let state = { sun: null, light: 1, frozen: false, wind: 0, windAngle: 0.6 };
  const dress = () => {
    const lean = [Math.cos(state.windAngle) * state.wind * grid * 0.9, Math.sin(state.windAngle) * state.wind * grid * 0.9];
    for (const f of falls) {
      const bow = state.frozen ? null : rainbowAt(f.axis.foot, state.sun, { grid });
      f.body.uniforms.uLight = state.light; f.body.uniforms.uFrozen = state.frozen ? 1 : 0;
      f.mist.uniforms.uLight = state.light; f.mist.uniforms.uLean = lean;
      f.mist.uniforms.uBow = bow ? [bow.x, bow.y, bow.radius, bow.strength] : [0, 0, 1, 0];
    }
  };
  const clear = () => {
    for (const f of falls) for (const part of [f.body.mesh, f.mist.mesh]) { try { part.parent?.removeChild(part); part.destroy(); } catch { /* gone */ } }
    falls = [];
  };
  const meshOf = (points, index, frag, uniforms, parent) => {
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array(points), true), 2).addIndex(new Uint16Array(index));
    const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, frag, uniforms));
    mesh.eventMode = 'none'; parent.addChild(mesh);
    return { mesh, uniforms };
  };
  const build = ({ falls: list = [], grid: g = 100 } = {}) => {
    clear(); grid = g; asked = { falls: list, grid: g };
    for (const fall of list) {
      const axis = fallAxis(fall.area, fall.flowTo);
      if (!axis) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < fall.area.length; i += 2) { x0 = Math.min(x0, fall.area[i]); x1 = Math.max(x1, fall.area[i]); y0 = Math.min(y0, fall.area[i + 1]); y1 = Math.max(y1, fall.area[i + 1]); }
      const box = mistBox(axis, grid), way = [axis.way.x, axis.way.y], across = [axis.across.x, axis.across.y];
      const body = meshOf(fall.area, trianglesOf(PIXI, fall.area), BODY_FRAG, { uHead: [axis.head.mid.x, axis.head.mid.y], uWay: way, uAcross: across, uLength: axis.length, uGrid: grid, uTime: time, uSwift: fall.swift ? 1 : 0, uLight: 1, uFrozen: 0 }, floor());
      const mist = meshOf([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], [0, 1, 2, 0, 2, 3], MIST_FRAG, { uFoot: [axis.foot.mid.x, axis.foot.mid.y], uWay: way, uAcross: across, uDrift: drift, uLean: [0, 0], uBow: [0, 0, 1, 0], uWidth: axis.width, uGrid: grid, uTime: time, uLight: 1 }, above());
      falls.push({ axis, body, mist, seen: { x: Math.min(x0, box.x), y: Math.min(y0, box.y), r: Math.max(x1, box.x + box.w), b: Math.max(y1, box.y + box.h) } });
    }
    dress();
  };
  return {
    build,
    look({ sun = state.sun, light = state.light, frozen = state.frozen, wind = state.wind, windAngle = state.windAngle } = {}) { state = { sun, light, frozen, wind, windAngle }; dress(); },
    tick(seconds, { view = null } = {}) {
      if (falls.some((f) => f.body.mesh.destroyed) && asked) build(asked);
      if (!falls.length) return;
      const dt = Math.min(0.1, seconds);
      let moving = false;
      for (const f of falls) {
        const shows = !view || (f.seen.x < view.x + view.w && f.seen.r > view.x && f.seen.y < view.y + view.h && f.seen.b > view.y);
        f.body.mesh.visible = shows; f.mist.mesh.visible = shows && !state.frozen;
        moving ||= shows;
      }
      if (!moving || state.frozen) return;
      time += dt;
      drift[0] += Math.cos(state.windAngle) * state.wind * 0.45 * dt; drift[1] += Math.sin(state.windAngle) * state.wind * 0.45 * dt;
      for (const f of falls) { f.body.uniforms.uTime = time; f.mist.uniforms.uTime = time; f.mist.uniforms.uDrift = drift; }
    },
    clear() { clear(); asked = null; },
    get busy() { return falls.length > 0; },
  };
}

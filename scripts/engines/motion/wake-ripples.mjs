// What moving through water leaves. Going somewhere: wherever the swimmer, duck or frog has just been, the water parts to either side and stays parted there, each
// piece spreading out from the spot that made it and fading, whatever the swimmer does next. Together they trail behind it as a real wake does: one narrow V opening to the same
// angle whatever the speed or size (about 19.5 degrees each side), its arms gently curved and made of a few short bowed crests, and faint curved crests across the
// water between them, all drawn with the pool's own waves and light (drips.mjs). Staying put (a duck feeding, a heron standing): rings let go now and then, all adding
// into one surface. On the GPU, both faded out where the water ends (a small picture of the water, baked as regions change).

export const MAX_WAKE_RINGS = 32;
const LIFE = 3.2;
const TRAIL_LIFE = 2.6, KELVIN_TAN = Math.tan(Math.asin(1 / 3)), SPACING = 0.3, MAX_POINTS = 160;
const MAX_QUADS = MAX_POINTS * 3;

const RING_VERT = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos;
void main(){ vPos = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

// The water and the light, as on a pool: from the upper left, warm.
const SURFACE = `
uniform sampler2D uFloor;                    // the map's own picture
uniform vec4 uRect;                          // where it lies: x, y, w, h
uniform sampler2D uWater;                    // where the water is, baked
uniform vec4 uWaterRect;                     // where that picture lies: x, y, w, h
uniform float uTime, uGrid, uHasFloor, uHasWater;
vec3 floorAt(vec2 at){ return uHasFloor > 0.5 ? texture2D(uFloor, clamp((at - uRect.xy) / uRect.zw, 0.0, 1.0)).rgb : vec3(0.2, 0.25, 0.3); }
vec4 surface(vec2 slope, float waves){
  if (waves < 0.002) return vec4(0.0);
  vec4 where = uHasWater > 0.5 ? texture2D(uWater, (vPos - uWaterRect.xy) / uWaterRect.zw) : vec4(1.0);
  float inWater = where.r;
  if (inWater < 0.01) return vec4(0.0);
  vec3 L = normalize(vec3(-0.55, -0.45, 0.7)), H = normalize(L + vec3(0.0, 0.0, 1.0)), n = normalize(vec3(-slope, 1.0));
  float spec = pow(max(0.0, dot(n, H)), 220.0) * 1.8, shade = (-slope.x * L.x - slope.y * L.y) * 1.6;
  float a = clamp(waves * 3.0, 0.0, 1.0) * inWater;
  // Green: the map's own water. Elsewhere something is painted over the map, so only the light and dark of the waves go on it.
  if (where.g < 0.5) return vec4((vec3(0.27, 0.24, 0.22) * max(0.0, shade) + vec3(1.0, 0.85, 0.63) * spec) * a, clamp(-shade * 0.55, 0.0, 0.5) * a);
  vec3 col = floorAt(vPos + slope * uGrid * 0.3) + vec3(0.27, 0.24, 0.22) * shade + vec3(1.0, 0.85, 0.63) * spec;
  return vec4(col * a, a);
}`;

const RING_FRAG = `
precision highp float;
varying vec2 vPos;
uniform vec4 uRings[${MAX_WAKE_RINGS}];       // x, y, when (seconds), size
${SURFACE}
void main(){
  vec2 slope = vec2(0.0); float waves = 0.0;
  for (int i = 0; i < ${MAX_WAKE_RINGS}; i++) {
    vec4 r = uRings[i]; float s = uTime - r.z; if (s < 0.0 || s > ${LIFE.toFixed(1)}) continue;
    vec2 p = vPos - r.xy; float dist = length(p), g = uGrid * r.w;
    float off = dist - (s * 0.85 + 0.6) * g, wid = g * 0.33; if (off > g * 0.3 || off < -wid * 3.0) continue;
    float env = exp(-pow((off + g * 0.27) / wid, 2.0)) * exp(-s * 1.0) * min(1.0, g * 0.45 / (dist + g * 0.15)) * 1.1;
    env *= smoothstep(0.0, g * 0.1, dist);
    waves += env; slope += -env * sin(off * 28.0 / g) * 0.42 * p / max(dist, 0.001);
  }
  gl_FragColor = surface(slope, waves);
}`;

const ARM_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec4 aOut; attribute vec4 aBand; attribute vec2 aKind;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos; varying vec4 vOut; varying vec4 vBand; varying vec2 vKind;
void main(){ vPos = aVertexPosition; vOut = aOut; vBand = aBand; vKind = aKind; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const ARM_FRAG = `
precision highp float;
varying vec2 vPos;
varying vec4 vOut;                           // the way this piece spreads: x, y; the way the swimmer was going: x, y
varying vec4 vBand;                          // px off its crest (between the arms: off the path), its scale (px), how strong, how far along the path (px)
varying vec2 vKind;                          // 0 an arm, 1 the water between; how wide the band (between the arms: how far out they are)
${SURFACE}
void main(){
  vec2 side = vOut.xy, dir = vOut.zw;
  float d = vBand.x, g = vBand.y, along = vBand.w;
  if (vKind.x < 0.5) {
    // An arm: a few crests slanting forward from its outer edge, about 55 degrees to the path, bowed rather than ruled straight.
    float env = exp(-pow(d / vKind.y, 2.0)) * vBand.z, crest = (along * 0.816 + d * 0.577 + 1.8 * d * d / g) * 6.2832 / (g * 0.45);
    float swell = 0.82 + 0.18 * sin(along * 6.2832 / (g * 1.3) + d * 0.02);
    // Tilted only so far, so neither arm catches the light in a hard glint where the other shows none.
    vec2 slope = -env * swell * sin(crest) * 0.75 * normalize(dir * 0.816 + side * (0.577 + 3.6 * d / g));
    gl_FragColor = surface(slope * min(1.0, 0.27 / max(length(slope), 0.001)), env * swell);
  } else {
    // Between them: faint crests right across, their middles leading and their tips trailing, thinning out toward the arms.
    float t = d / max(vKind.y, 1.0), bow = 0.45 * vKind.y * t * t, crest = (along + bow) * 6.2832 / (g * 0.95);
    float env = vBand.z * 0.42 * (1.0 - t * t);
    gl_FragColor = surface(-env * sin(crest) * 0.4 * normalize(dir + side * 0.9 * t), env);
  }
}`;

// How far a ring has got by the time it is gone (pure), for the quad over them all.
export const wakeReach = (size, grid) => LIFE * grid * size * 0.85 + grid * size * 1.0;
// The way a swimmer is going (pure): null until it has come `least` px from where it last was.
export function wakeAim(from, at, least = 0) {
  if (!from) return null;
  const dx = at.x - from.x, dy = at.y - from.y, d = Math.hypot(dx, dy);
  return d <= Math.max(least, 0.001) ? null : { x: dx / d, y: dy / d };
}
// How far an arm has spread from the path (pure), from the flanks of something `g` px across: quickly and then less so, which curves the arm, reaching the wake's one angle by its end whatever the speed. `speed` px a second.
export const wakeSpread = (g, speed, age) => { const life = wakeLife(g, speed); return g * 0.45 + KELVIN_TAN * speed * life * Math.pow(Math.max(0, age) / life, 0.72); };
// How long a piece lasts (pure): a fast swimmer's wake reaches no further than a slow one's.
export const wakeLife = (g, speed) => Math.min(TRAIL_LIFE, (g * 7) / Math.max(1, speed));
// How strong a piece is at an age (pure): coming up as it parts, gone by the end of its life.
export function wakeFade(age, life = TRAIL_LIFE) {
  if (age <= 0 || age >= life) return 0;
  const up = Math.min(1, age / 0.2);
  return up * up * (3 - 2 * up) * Math.pow(1 - age / life, 1.2);
}

/** The pieces themselves, with no drawing (pure): drive(key, { x, y, g, dir, keep }, now) as something moves; sweep(now) lets go of the faded. Each piece keeps the place, way and speed it was made with. Over the limit, the oldest of what is not `keep` goes first. */
export function createWakeTrails({ limit = MAX_POINTS } = {}) {
  const open = new Map(), trails = [];
  let total = 0;
  const cull = () => {
    while (total > limit) {
      let pick = null;
      for (const t of trails) { if (!t.points.length) continue; if (!pick || (pick.keep && !t.keep) || (pick.keep === t.keep && t.points[0].t < pick.points[0].t)) pick = t; }
      if (!pick) return;
      pick.points.shift(); total--;
    }
  };
  const addPoint = (trail, x, y, now) => { trail.points.push({ x, y, nx: -trail.dir.y, ny: trail.dir.x, dx: trail.dir.x, dy: trail.dir.y, t: now, u: trail.u, speed: trail.speed }); total++; };
  return {
    trails,
    drive(key, { x, y, g, dir, keep = false }, now) {
      let trail = open.get(key);
      const last = trail?.points[trail.points.length - 1];
      if (!trail || !last || now - trail.lastDrive > 0.4 || Math.hypot(x - last.x, y - last.y) > g * 8) {
        trail = { key, g, keep, dir: { x: dir.x, y: dir.y }, points: [], head: null, lastDrive: now, u: 0, speed: g * 2 };
        open.set(key, trail); trails.push(trail);
        addPoint(trail, x, y, now);
      } else {
        const step = Math.hypot(x - last.x, y - last.y);
        if (step >= g * SPACING) {
          const dt = Math.max(0.001, now - last.t), dx = trail.dir.x + dir.x, dy = trail.dir.y + dir.y, d = Math.hypot(dx, dy);
          trail.speed = trail.points.length === 1 ? step / dt : trail.speed * 0.5 + (step / dt) * 0.5;
          trail.dir = d > 0.001 ? { x: dx / d, y: dy / d } : { x: dir.x, y: dir.y };
          trail.u += step;
          addPoint(trail, x, y, now);
        }
      }
      trail.head = { x, y }; trail.lastDrive = now;
      cull();
    },
    sweep(now) {
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i];
        while (t.points.length && now - t.points[0].t >= wakeLife(t.g, t.points[0].speed)) { t.points.shift(); total--; }
        if (!t.points.length) { trails.splice(i, 1); if (open.get(t.key) === t) open.delete(t.key); }
      }
    },
    clear() { open.clear(); trails.length = 0; total = 0; },
    get total() { return total; },
  };
}

/** The layer: drive(key, { x, y, size, dir, keep }) as something moves; add({ x, y, size }) a ring where it stays put; floor({ texture, rect }) the map's picture; water(areas) where it may show (flat points, each with its `holes`, `painted` where the map is covered; none: anywhere), baked with `render(object, renderTexture, transform)`; tick(seconds); clear(). */
export function createWakeRipples({ PIXI, root, grid = () => 100, render = () => {} }) {
  let rings = null, arms = null, ringUniforms = null, armUniforms = null, ringPos = null, armPos = null, armOut = null, armBand = null, armKind = null, baked = null, next = 0, live = 0, time = 0, waterAreas = [], floorNow = null, drawn = 0;
  const ringList = [], pieces = createWakeTrails();
  const shared = () => [ringUniforms, armUniforms].filter(Boolean);
  const bake = () => {
    if (!rings) return;
    try { baked?.destroy(true); } catch { /* gone */ } baked = null;
    if (!waterAreas.length) { for (const u of shared()) u.uHasWater = 0; return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const area of waterAreas) for (let i = 0; i < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); }
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), k = Math.min(1, 1024 / Math.max(w, h));
    const shape = new PIXI.Graphics();
    for (const area of waterAreas) { shape.beginFill(area.painted ? 0xff0000 : 0xffffff); shape.drawPolygon(area); for (const hole of area.holes ?? []) { shape.beginHole(); shape.drawPolygon(hole); shape.endHole(); } shape.endFill(); }
    baked = PIXI.RenderTexture.create({ width: Math.ceil(w * k), height: Math.ceil(h * k) });
    render(shape, baked, new PIXI.Matrix(k, 0, 0, k, -x0 * k, -y0 * k));
    shape.destroy();
    for (const u of shared()) { u.uWater = baked; u.uWaterRect = [x0, y0, w, h]; u.uHasWater = 1; }
  };
  const base = () => ({ uFloor: PIXI.Texture.WHITE, uRect: [0, 0, 1, 1], uTime: time, uGrid: grid(), uHasFloor: 0, uWater: PIXI.Texture.WHITE, uWaterRect: [0, 0, 1, 1], uHasWater: 0 });
  const make = () => {
    ringPos = new Float32Array(8);
    ringUniforms = { ...base(), uRings: new Float32Array(MAX_WAKE_RINGS * 4).fill(-99) };
    rings = new PIXI.Mesh(new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(ringPos, false), 2).addIndex([0, 1, 2, 0, 2, 3]), PIXI.Shader.from(RING_VERT, RING_FRAG, ringUniforms));
    rings.eventMode = 'none'; rings.visible = false;
    armPos = new Float32Array(MAX_QUADS * 8); armOut = new Float32Array(MAX_QUADS * 16); armBand = new Float32Array(MAX_QUADS * 16); armKind = new Float32Array(MAX_QUADS * 8);
    const index = new Uint16Array(MAX_QUADS * 6); for (let i = 0; i < MAX_QUADS; i++) index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    armUniforms = base();
    arms = new PIXI.Mesh(new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(armPos, false), 2).addAttribute('aOut', new PIXI.Buffer(armOut, false), 4).addAttribute('aBand', new PIXI.Buffer(armBand, false), 4).addAttribute('aKind', new PIXI.Buffer(armKind, false), 2).addIndex(index), PIXI.Shader.from(ARM_VERT, ARM_FRAG, armUniforms));
    arms.eventMode = 'none'; arms.visible = false;
    root().addChild(rings); root().addChild(arms);
    bake();
    if (floorNow) for (const u of shared()) Object.assign(u, floorNow);
  };
  const ready = () => { if (!rings || rings.destroyed) make(); };
  const fitRings = () => {
    const g = ringUniforms.uGrid; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of ringList) { if (time - r.when > LIFE) continue; const R = wakeReach(r.size, g); x0 = Math.min(x0, r.x - R); y0 = Math.min(y0, r.y - R); x1 = Math.max(x1, r.x + R); y1 = Math.max(y1, r.y + R); }
    if (!Number.isFinite(x0)) return;
    ringPos.set([x0, y0, x1, y0, x1, y1, x0, y1]); rings.geometry.getBuffer('aVertexPosition').update();
  };
  // Where a piece is now and how strong. Its first and last are at nothing, so a strip tapers in and out rather than ending square.
  const stateOf = (p, g, i, count) => {
    const age = time - p.t, life = wakeLife(g, p.speed);
    return { p, c: wakeSpread(g, p.speed, age), wid: g * (0.16 + 0.12 * Math.min(1, age / life)), power: i === 0 || i === count - 1 ? 0 : wakeFade(age, life) };
  };
  const quadAt = (quad, kind, a, b, corners) => {
    armPos.set(corners.pos, quad * 8);
    for (let k = 0; k < 4; k++) {
      const s = k === 0 || k === 1 ? a : b, side = corners.side[k];
      armOut.set([s.p.nx * side, s.p.ny * side, s.p.dx, s.p.dy], (quad * 4 + k) * 4);
      armBand.set([corners.d[k], corners.g, s.power, s.p.u], (quad * 4 + k) * 4);
      armKind.set([kind, kind ? s.c : s.wid], (quad * 4 + k) * 2);
    }
  };
  const paintTrail = (trail, line, start) => {
    const g = trail.g; let quad = start, prev = null;
    for (let i = 0; i < line.length; i++) {
      const here = stateOf(line[i], g, i, line.length);
      if (prev && (prev.power > 0 || here.power > 0)) {
        const at = (s, off) => [s.p.x + s.p.nx * off, s.p.y + s.p.ny * off];
        // The water between the arms, under them.
        if (quad < MAX_QUADS) { quadAt(quad++, 1, prev, here, { g, pos: [...at(prev, -prev.c), ...at(prev, prev.c), ...at(here, here.c), ...at(here, -here.c)], d: [-prev.c, prev.c, here.c, -here.c], side: [1, 1, 1, 1] }); }
        for (const side of [-1, 1]) {
          if (quad >= MAX_QUADS) break;
          const reachA = prev.wid * 2.4, reachB = here.wid * 2.4, inA = Math.min(reachA, prev.c), inB = Math.min(reachB, here.c);
          quadAt(quad++, 0, prev, here, { g, pos: [...at(prev, side * (prev.c - inA)), ...at(prev, side * (prev.c + reachA)), ...at(here, side * (here.c + reachB)), ...at(here, side * (here.c - inB))], d: [-inA, reachA, reachB, -inB], side: [side, side, side, side] });
        }
      }
      prev = here;
    }
    return quad;
  };
  const paint = () => {
    pieces.sweep(time);
    let quad = 0;
    for (const trail of pieces.trails) {
      // Up to where it is now, while it is still going.
      const going = time - trail.lastDrive < 0.2 && trail.head, last = trail.points[trail.points.length - 1];
      const line = going ? [...trail.points, { ...last, x: trail.head.x, y: trail.head.y, t: time, u: last.u + Math.hypot(trail.head.x - last.x, trail.head.y - last.y) }] : trail.points;
      quad = paintTrail(trail, line, quad);
    }
    if (quad < drawn) armPos.fill(0, quad * 8, drawn * 8);
    drawn = quad;
    for (const name of ['aVertexPosition', 'aOut', 'aBand', 'aKind']) arms.geometry.getBuffer(name).update();
    arms.visible = quad > 0;
  };
  const clear = () => { try { rings?.parent?.removeChild(rings); arms?.parent?.removeChild(arms); rings?.destroy(); arms?.destroy(); baked?.destroy(true); } catch { /* gone */ } rings = arms = ringUniforms = armUniforms = baked = floorNow = null; live = 0; ringList.length = 0; next = 0; drawn = 0; pieces.clear(); };
  return {
    floor(f) { ready(); const ok = !!f?.texture?.valid; floorNow = { uFloor: ok ? f.texture : PIXI.Texture.WHITE, uRect: ok ? [f.rect.x, f.rect.y, f.rect.width, f.rect.height] : [0, 0, 1, 1], uHasFloor: ok ? 1 : 0 }; for (const u of shared()) Object.assign(u, floorNow); },
    water(areas = []) { waterAreas = areas; bake(); },
    add({ x, y, size = 1 } = {}) {
      ready();
      ringUniforms.uGrid = grid();
      const i = next; next = (next + 1) % MAX_WAKE_RINGS;
      ringList[i] = { x, y, size, when: time };
      ringUniforms.uRings.set([x, y, time, size], i * 4);
      fitRings(); rings.visible = true; live = LIFE;
    },
    drive(key, { x, y, size = 1, dir, keep = false }) {
      ready();
      armUniforms.uGrid = grid();
      pieces.drive(key, { x, y, g: armUniforms.uGrid * size, dir, keep }, time);
    },
    tick(seconds) {
      if (!rings) return;
      time += seconds; ringUniforms.uTime = time; armUniforms.uTime = time;
      if (live > 0) { live -= seconds; if (live <= 0) rings.visible = false; }
      if (pieces.trails.length || drawn) paint();
    },
    clear,
    get busy() { return live > 0 || pieces.trails.length > 0 || drawn > 0; },
    get count() { return ringList.filter((r) => r && time - r.when <= LIFE).length + pieces.trails.length; },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const WAKE_SHADER_SOURCES = Object.freeze([[RING_VERT, RING_FRAG], [ARM_VERT, ARM_FRAG]]);

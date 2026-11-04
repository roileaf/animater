// The air around the lamps, drawn over the darkness (added light) on the GPU in one pass: sparks rising off fires,
// carried on the draft (indoor-air.mjs's field), fine dust and faint currents where the air moves; and, in a second
// pass laid over the floor and the creatures, the smoke the fires send up gathering in the rooms and streaming out along
// the draft. Sparks off fires,
// flaring and dying out, and fine dust turning in the air, seen only where the lights reach (their lit areas, walls and
// all, baked into a small mask when the lights change). No particles on the CPU: each pixel works out the few sparks
// near it, so a dungeon of torches costs what one does.

export const MAX_FIRES = 24;

const VERT = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main(){
  vUv = aUvs;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uLit;     // where the lights reach (a), and how warm (rgb)
uniform vec2 uSize;         // the scene rectangle, pixels
uniform float uTime, uGrid, uEmbers, uMotes, uCount;
uniform vec2 uWind;         // a draft or the air's own drift, squares a second
uniform vec4 uFires[${MAX_FIRES}];  // each fire: x, y (scene pixels from the rectangle's corner), size (squares), seed
uniform vec4 uReachA[${MAX_FIRES}], uReachB[${MAX_FIRES}];  // how far each fire's eight ways are open (wall-reach.mjs), px
uniform sampler2D uDraft;   // the air's flow per square: rg the way (0.5 still), b whether it moves
uniform sampler2D uDraftWas; // the air before it last changed (a door opened or shut), faded out over uDraftMix 0–1
uniform float uDraftMix;
uniform float uGust;        // seconds since a door last opened (the gust sweeping out from it)
uniform float uLean;        // flames bending in the draft (0 off)
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
// The draft here, squares a second, and how much it moves (0 still).
// How hard the air moves in a cell of the draft (indoor-air.mjs draftPixels): its speed (b), times the steady draft, or
// the gust once it has swept that far from the door (a: when it arrives, 0–6 s; 1 never).
float airHere(vec4 d){ float delay = d.a * 6.0, since = uGust - delay; float k = (d.a > 0.99 || since < 0.0) ? 0.3 : 0.3 + 0.3 * smoothstep(0.0, 1.2, since) * exp(-max(0.0, since - 1.2) / 3.0); return d.b * k; }
vec3 draftAt(vec2 uv){ vec4 d = mix(texture2D(uDraftWas, uv), texture2D(uDraft, uv), uDraftMix); float a = airHere(d); return vec3((d.rg * 2.0 - 1.0) * a * 2.6, min(1.0, a * 1.8)); }
void main(){
  vec2 px = vUv * uSize;
  vec3 col = vec3(0.0);
  // Dust turning in the air: fine motes, each wandering in its own small loop and drifting on the air, catching the
  // light now and then; thick only close to a fire (a grid square or two out), a faint few farther into the light.
  vec4 lit = texture2D(uLit, vUv);
  vec3 draft = draftAt(vUv);
  float nearFire = 0.0;
  for (int k = 0; k < ${MAX_FIRES}; k++) {
    if (float(k) >= uCount) break;
    vec2 d = (px - uFires[k].xy) / (uGrid * 1.6);
    nearFire = max(nearFire, exp(-dot(d, d)));
  }
  float dusty = lit.a * max(nearFire, 0.08);
  if (uMotes > 0.01 && dusty > 0.01) {
    // Carried on the air without ever jumping when the air changes (a door opening): two sets of motes, each carried for
    // a few seconds from where it started, then faded out and started afresh, half a period apart (a flowmap's two
    // phases); the air's speed only sets how far each has drifted so far, never how far since the scene loaded.
    vec2 vel = (uWind + draft.xy) * uGrid * 0.5;
    float period = 6.0, pa = fract(uTime / period), pb = fract(uTime / period + 0.5), wa = 1.0 - abs(2.0 * pa - 1.0);
    for (int set = 0; set < 2; set++) {
      float ph = set == 0 ? pa : pb, weight = set == 0 ? wa : 1.0 - wa;
      vec2 p = px - vel * ph * period + float(set) * uGrid * vec2(3.7, 1.9);
      for (int i = 0; i < 2; i++) {
        float layer = float(i), cell = uGrid * (0.2 + 0.12 * layer);
        vec2 q = p / cell + layer * 7.3 + float(set) * 13.1;
        vec2 id = floor(q), f = fract(q) - 0.5;
        float h = hash(id);
        if (h < 0.11) {
          float w = uTime * (0.25 + 0.35 * hash(id + 5.3)) + h * 60.0;
          f -= (vec2(hash(id + 1.7), hash(id + 3.1)) - 0.5) * 0.4 + vec2(sin(w), cos(w * 1.3)) * 0.22;
          float twinkle = pow(0.5 + 0.5 * sin(uTime * (0.9 + h * 3.0) + h * 40.0), 4.0);
          float speck = 1.0 - smoothstep(0.0, 0.045 + 0.02 * layer, length(f));
          col += mix(vec3(1.0, 0.86, 0.66), lit.rgb, 0.75) * speck * (0.15 + 0.85 * twinkle) * dusty * (0.6 - 0.25 * layer) * (uMotes + draft.z * 0.8) * weight;
        }
      }
    }
    // Where the air runs fast (a doorway, a gust), faint fine wisps of dust streaming with it; a slow room's air shows
    // only in the motes drifting.
    // The air running fast (a doorway, a gust): specks of dust carried along it, a little drawn out the faster it runs,
    // each glinting as it passes through the light. Carried as the motes are, in two staggered sets, so a change in the
    // air never throws them along.
    float fast = smoothstep(0.25, 0.8, draft.z);
    if (fast > 0.0) {
      vec2 flow = normalize(draft.xy + vec2(1e-4)), side = vec2(-flow.y, flow.x);
      float speed = uGrid * (0.8 + 1.6 * draft.z), period = 3.0;
      float fa = fract(uTime / period), fb = fract(uTime / period + 0.5), fw = 1.0 - abs(2.0 * fa - 1.0);
      for (int set = 0; set < 2; set++) {
        float ph = set == 0 ? fa : fb, weight = set == 0 ? fw : 1.0 - fw;
        vec2 p = px - flow * speed * ph * period;
        vec2 q = vec2(dot(p, flow), dot(p, side)) / (uGrid * 0.3) + float(set) * 17.3;
        vec2 id = floor(q), f = fract(q) - 0.5;
        float h = hash(id + 2.9);
        if (h < 0.2) {
          f -= (vec2(hash(id + 4.1), hash(id + 6.7)) - 0.5) * 0.5;
          f.y += sin(uTime * (1.5 + h * 3.0) + h * 30.0) * 0.12;
          // Drawn out along the air, the more the faster it runs.
          float speck = 1.0 - smoothstep(0.55, 1.0, length(vec2(f.x / (0.08 + 0.2 * draft.z), f.y / 0.06)));
          float glint = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (2.0 + h * 4.0) + h * 50.0), 3.0);
          col += mix(vec3(1.0, 0.9, 0.75), lit.rgb, 0.6) * speck * glint * weight * lit.a * max(nearFire, 0.3) * fast * 0.55;
        }
      }
    }
  }
  // Sparks off the fires: a few at a time from each, thrown out every way (seen from above, rising is going outward),
  // carried on the draft, wandering, flaring, dying out.
  // A flame in moving air: a bright tongue leaning with the draft, licking and flickering harder the stronger it blows.
  if (uLean > 0.01) {
    for (int k = 0; k < ${MAX_FIRES}; k++) {
      if (float(k) >= uCount) break;
      vec4 fire = uFires[k];
      vec2 d = px - fire.xy;
      if (dot(d, d) > uGrid * uGrid * 0.25) continue;
      vec3 fd = draftAt(fire.xy / uSize);
      float lean = min(1.0, length(fd.xy) * 0.9) * uLean;
      if (lean < 0.03) continue;
      float lick = noise(vec2(uTime * 11.0, fire.w));
      vec2 way = normalize(fd.xy + vec2(1e-4)), side = vec2(-way.y, way.x);
      vec2 tip = way * uGrid * (0.1 + 0.14 * lean) * (0.7 + 0.5 * lick) + side * sin(uTime * 11.0 + fire.w) * uGrid * 0.02 * lean;
      // How far along the tongue (0 base – 1 tip), and how far off it; narrower toward the tip.
      float along = clamp(dot(d, tip) / dot(tip, tip), 0.0, 1.0), off = length(d - tip * along), w = uGrid * (0.035 * (1.0 - along) + 0.006);
      float core = exp(-off * off / (w * w)) * (1.0 - along * 0.6);
      col += mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.88, 0.55), core) * core * lean * (0.55 + 0.45 * lick) * 0.8;
    }
  }
  if (uEmbers > 0.01) {
    for (int k = 0; k < ${MAX_FIRES}; k++) {
      if (float(k) >= uCount) break;
      vec4 fire = uFires[k];
      vec2 d = px - fire.xy;
      float reach = uGrid * (1.6 + fire.z);
      if (dot(d, d) > reach * reach) continue;
      vec3 fireDraft = draftAt(fire.xy / uSize);
      for (int s = 0; s < 6; s++) {
        float fs = float(s), period = 1.6 + hash(vec2(fire.w, fs)) * 1.6, phase = uTime / period + hash(vec2(fs, fire.w + 3.0));
        float n = floor(phase), life = fract(phase);
        float seed = hash(vec2(n, fs + fire.w * 7.0));
        if (seed > 0.55 + 0.25 * min(fire.z, 1.0)) continue;
        // Its path: out from the flame at its own angle, slowing, curling a little, and off with the air.
        float ang = hash(vec2(seed, fs + 9.0)) * 6.2832, travel = (1.0 - (1.0 - life) * (1.0 - life)) * uGrid * (0.5 + 0.7 * seed) * (0.8 + 0.4 * fire.z);
        vec2 dir = vec2(cos(ang), sin(ang)), side = vec2(-dir.y, dir.x);
        vec2 at = fire.xy + dir * travel + side * sin(life * 5.0 + seed * 20.0) * uGrid * 0.06 + (uWind + fireDraft.xy) * life * uGrid * 1.5;
        // A wall stops it: gone before it would pass through, into the next room.
        vec2 off = at - fire.xy;
        float way = mod(atan(off.y, off.x) / 6.2832 * 8.0 + 8.5, 8.0);
        vec4 inA = step(vec4(0.0, 1.0, 2.0, 3.0), vec4(way)) * (1.0 - step(vec4(1.0, 2.0, 3.0, 4.0), vec4(way)));
        vec4 inB = step(vec4(4.0, 5.0, 6.0, 7.0), vec4(way)) * (1.0 - step(vec4(5.0, 6.0, 7.0, 8.0), vec4(way)));
        if (length(off) > dot(inA, uReachA[k]) + dot(inB, uReachB[k])) continue;
        float r = length(px - at), size = uGrid * (0.012 + 0.008 * seed);
        float flicker = 0.6 + 0.4 * sin(uTime * 23.0 + seed * 50.0);
        float fade = (1.0 - life) * smoothstep(0.0, 0.08, life);
        float core = exp(-r * r / (size * size)), bloom = exp(-r * r / (size * size * 16.0)) * 0.35;
        col += mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.9, 0.6), core) * (core + bloom) * flicker * fade * uEmbers;
      }
    }
  }
  gl_FragColor = vec4(col, 0.0);
}`;

const SMOKE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSmoke;   // the fires' reach (a), walls and all, and their colour: lights the smoke, and where it fills with no air worked out
uniform sampler2D uFill;    // where the smoke is in the air now (a; indoor-air.mjs createSmokeAir)
uniform float uFillOn;
uniform sampler2D uDraft, uDraftWas;
uniform float uDraftMix;
uniform vec2 uSize;
uniform float uTime, uGrid, uAmount, uGust;   // uGust: seconds since a door last opened
// How hard the air moves in a cell of the draft (indoor-air.mjs draftPixels): its speed (b), times the steady draft, or
// the gust once it has swept that far from the door (a: when it arrives, 0–6 s; 1 never).
float airHere(vec4 d){ float delay = d.a * 6.0, since = uGust - delay; float k = (d.a > 0.99 || since < 0.0) ? 0.3 : 0.3 + 0.3 * smoothstep(0.0, 1.2, since) * exp(-max(0.0, since - 1.2) / 3.0); return d.b * k; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
void main(){
  vec2 px = vUv * uSize;
  vec4 lit = texture2D(uSmoke, vUv);
  // As much as has gathered there by now: thickest near the fires, and out along the draft through the doors.
  float fill = uFillOn > 0.5 ? texture2D(uFill, vUv).a : lit.a * lit.a;
  if (fill < 0.02 || uAmount < 0.01) { gl_FragColor = vec4(0.0); return; }
  vec4 d = mix(texture2D(uDraftWas, vUv), texture2D(uDraft, vUv), uDraftMix);
  // Where the air runs (a doorway, a gust) the smoke's billows drift along with it; a closed room's slow drift leaves them
  // rolling where they are.
  float moving = smoothstep(0.12, 0.55, min(1.0, airHere(d) * 1.8));
  vec2 flow = (d.rg * 2.0 - 1.0) * moving;
  vec2 q = px / (uGrid * 4.0);
  vec2 warp = vec2(noise(q * 0.7 + uTime * 0.03), noise(q * 0.7 + 5.1 - uTime * 0.025)) - 0.5;
  vec2 rolling = q + warp * 1.2 + vec2(uTime * 0.02, -uTime * 0.015);
  // Drifting: the same billows, carried along the air and handed over between two phases as each runs out, so they flow on
  // without ever jumping back or being drawn out into lines.
  float roll;
  if (moving > 0.01) {
    float p1 = fract(uTime * 0.1), p2 = fract(uTime * 0.1 + 0.5);
    roll = mix(fbm(rolling - flow * 1.6 * p1), fbm(rolling - flow * 1.6 * p2), abs(1.0 - 2.0 * p1));
  } else roll = fbm(rolling);
  // Billows with clear air between them; the more has gathered, the more of the air they take.
  float density = fill * smoothstep(0.62 - 0.22 * fill, 0.72 - 0.1 * fill, roll) * (1.0 - 0.25 * moving);
  float a = density * 0.5 * uAmount;
  // Smoke with a body: lit pale and warm on the side the fire catches, dark in its folds. One grey would vanish on a dark
  // floor, and all pale washed out the floor and everyone on it.
  float folds = smoothstep(0.3, 0.7, noise(q * 1.7 + warp * 2.0 + uTime * 0.02));
  vec3 pale = mix(vec3(0.62, 0.58, 0.54), lit.rgb / max(lit.a, 0.01), 0.4 * lit.a);
  vec3 col = mix(vec3(0.12, 0.11, 0.1), pale, folds);
  gl_FragColor = vec4(col * a, a);
}`;

/**
 * The air around the lamps. build({ lights: [{ x, y, radius, shape (its lit polygon, flat x, y pairs, or null), color
 * (0xrrggbb or null) }], bounds, grid }) bakes where the lights reach; look({ fires: [{ x, y, size }] (scene pixels; the
 * nearest MAX_FIRES), embers 0–1, motes 0–1, wind: { x, y } squares a second }) sets what shows; tick(seconds).
 */
export function createLampAir({ PIXI, root, render, smokeRoot = null }) {
  let mesh = null, mask = null, own = null, bounds = null, smoke = null, smokeMask = null, smokeOwn = null, draftTex = null;
  // The air's flow as last given (draft()): kept, so lamps built again afterwards still feel it.
  let lastDraft = null;
  // The clock, and what was showing, kept through a rebuild (a door changing what the lights reach): the dust, sparks and
  // smoke carry on where they were instead of all starting over at once.
  let clock = 0, showing = null, smokeShowing = null;
  // The air before it last changed and how far the fade to the new is (a door opening swaps the whole field at once; the
  // dust, wisps and smoke would jump with it): kept through a rebuild too.
  let draftWas = null, draftMix = 1;
  // Where the smoke is now (smokeFill): kept through a rebuild.
  let fill = null, lastFill = null;
  const fillTexture = (at) => (at ? PIXI.Texture.fromBuffer(at.pixels, at.cols, at.rows, { scaleMode: PIXI.SCALE_MODES.LINEAR }) : still());
  const dropFills = () => { try { fill?.destroy(true); } catch { /* gone */ } fill = null; };
  const dropDrafts = () => { for (const t of new Set([draftTex, draftWas])) { try { t?.destroy(true); } catch { /* gone */ } } draftTex = null; draftWas = null; draftMix = 1; };
  const draftTexture = () => (lastDraft ? PIXI.Texture.fromBuffer(lastDraft.pixels, lastDraft.cols, lastDraft.rows, { scaleMode: PIXI.SCALE_MODES.LINEAR }) : still());
  const smokeMesh = () => smoke;
  const still = () => PIXI.Texture.fromBuffer(new Uint8Array([128, 128, 0, 255]), 1, 1);
  const drop = () => {
    for (const m of [mesh, smoke]) { try { m?.parent?.removeChild(m); m?.destroy(); } catch { /* gone with the canvas */ } }
    for (const t of [mask, smokeMask]) { try { t?.destroy(true); } catch { /* gone */ } }
    mesh = null; mask = null; own = null; bounds = null; smoke = null; smokeMask = null; smokeOwn = null;
  };
  return {
    build({ lights = [], bounds: b, grid = 100 } = {}) {
      if (own) showing = { uGust: own.uGust, uLean: own.uLean, uEmbers: own.uEmbers, uMotes: own.uMotes, uCount: own.uCount, uWind: own.uWind, uFires: own.uFires, uReachA: own.uReachA, uReachB: own.uReachB, visible: !!mesh?.visible };
      if (smokeOwn) smokeShowing = { uAmount: smokeOwn.uAmount, uGust: smokeOwn.uGust, visible: !!smoke?.visible };
      drop();
      if (!b || !lights.length) { dropDrafts(); dropFills(); return; }
      bounds = b;
      const k = Math.min(0.25, 2048 / Math.max(1, b.width, b.height)), w = Math.max(1, Math.ceil(b.width * k)), h = Math.max(1, Math.ceil(b.height * k));
      // Each light's reach: a soft disc in its colour, cut to the area it lights (walls stop it).
      const reach = (list, scale = 1) => {
      const stage = new PIXI.Container();
      for (const l of list) {
        if (!(l.radius > 0)) continue;
        const disc = new PIXI.Graphics(), steps = 6, color = Number.isFinite(l.color) ? l.color : 0xffd9a8;
        for (let i = steps; i >= 1; i--) { disc.beginFill(color, (1 / steps) * 0.9); disc.drawCircle((l.x - b.x) * k, (l.y - b.y) * k, l.radius * scale * k * (i / steps)); disc.endFill(); }
        if (Array.isArray(l.shape) && l.shape.length >= 6) {
          const cut = new PIXI.Graphics(); cut.beginFill(0xffffff, 1); cut.drawPolygon(l.shape.map((v, i) => (v - (i % 2 ? b.y : b.x)) * k)); cut.endFill();
          disc.mask = cut; stage.addChild(cut);
        }
        stage.addChild(disc);
      }
      stage.filters = [new PIXI.BlurFilter(2 + 4 * (scale > 1))];
      const out = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, out); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      return out;
      };
      mask = reach(lights);
      if (!draftTex) { draftTex = draftTexture(); draftWas = draftTex; draftMix = 1; }
      own = { uLit: mask, uDraft: draftTex, uDraftWas: draftWas, uDraftMix: draftMix, uGust: 1e3, uLean: 0, uSize: [b.width, b.height], uTime: clock, uGrid: grid, uEmbers: 0, uMotes: 0, uCount: 0, uWind: [0, 0], uFires: new Float32Array(MAX_FIRES * 4), uReachA: new Float32Array(MAX_FIRES * 4).fill(1e5), uReachB: new Float32Array(MAX_FIRES * 4).fill(1e5) };
      const was = showing; showing = null;
      if (was) { const { visible, ...u } = was; Object.assign(own, u); }
      const geometry = new PIXI.Geometry()
        .addAttribute('aVertexPosition', [b.x, b.y, b.x + b.width, b.y, b.x + b.width, b.y + b.height, b.x, b.y + b.height], 2)
        .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
      mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own));
      mesh.blendMode = PIXI.BLEND_MODES.ADD;
      mesh.eventMode = 'none';
      mesh.visible = !!was?.visible;
      root().addChild(mesh);
      // The smoke: where the fires' smoke fills (their reach, a little further, walls and all).
      const fires = lights.filter((l) => l.fire);
      if (smokeRoot && fires.length) {
        // A torch on a wall lights both sides of it, but smokes only its own (Light: smokeShape).
        smokeMask = reach(fires.map((l) => (l.smokeShape ? { ...l, shape: l.smokeShape } : l)), 1.15);
        if (!fill) fill = fillTexture(lastFill);
        smokeOwn = { uSmoke: smokeMask, uFill: fill, uFillOn: lastFill ? 1 : 0, uDraft: draftTex, uDraftWas: draftWas, uDraftMix: draftMix, uSize: [b.width, b.height], uTime: clock, uGrid: grid, uAmount: smokeShowing?.uAmount ?? 0, uGust: smokeShowing?.uGust ?? 1e3 };
        smoke = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, SMOKE_FRAG, smokeOwn));
        smoke.eventMode = 'none'; smoke.visible = !!smokeShowing?.visible;
        smokeRoot().addChild(smoke);
      }
      smokeShowing = null;
    },
    // The air's flow (indoor-air.mjs draftPixels, cols x rows over the same rectangle); null: still everywhere.
    draft(pixels = null, cols = 1, rows = 1) {
      lastDraft = pixels ? { pixels, cols, rows } : null;
      if (!own) { dropDrafts(); return; }
      // The new air fades in over the old over a couple of seconds.
      const next = draftTexture();
      if (draftWas && draftWas !== draftTex) { try { draftWas.destroy(true); } catch { /* gone */ } }
      draftWas = draftTex ?? next; draftTex = next; draftMix = 0;
      for (const u of [own, smokeOwn]) if (u) { u.uDraft = draftTex; u.uDraftWas = draftWas; u.uDraftMix = 0; }
    },
    // Where the smoke is now (indoor-air.mjs createSmokeAir's pixels, over the same rectangle, changing in place); null: by
    // the fires' reach. Called as often as it changes: the same pixels are only sent again.
    smokeFill(pixels = null, cols = 1, rows = 1) {
      const same = pixels && lastFill?.pixels === pixels && fill;
      lastFill = pixels ? { pixels, cols, rows } : null;
      if (!smokeOwn) { dropFills(); return; }
      if (same) { fill.baseTexture.update(); return; }
      dropFills(); fill = fillTexture(lastFill);
      smokeOwn.uFill = fill; smokeOwn.uFillOn = lastFill ? 1 : 0;
    },
    look({ fires = [], embers = 0, motes = 0, wind = { x: 0, y: 0 }, air = false, since = 1e3, smoke = 0, lean = 0 } = {}) {
      if (!own) return;
      const list = fires.slice(0, MAX_FIRES);
      list.forEach((f, i) => { own.uFires[i * 4] = f.x - bounds.x; own.uFires[i * 4 + 1] = f.y - bounds.y; own.uFires[i * 4 + 2] = Number(f.size) || 1; own.uFires[i * 4 + 3] = (f.seed ?? ((Math.abs(f.x * 0.0137 + f.y * 0.0071) * 97) % 97));
        for (let w = 0; w < 4; w++) { own.uReachA[i * 4 + w] = f.reach?.[w] ?? 1e5; own.uReachB[i * 4 + w] = f.reach?.[w + 4] ?? 1e5; } });
      own.uCount = list.length; own.uEmbers = list.length ? embers : 0; own.uMotes = motes; own.uWind = [Number(wind.x) || 0, Number(wind.y) || 0];
      own.uGust = since; own.uLean = list.length && air ? lean : 0;
      mesh.visible = own.uEmbers > 0.01 || motes > 0.01 || air;
      if (smokeOwn) { smokeOwn.uAmount = smoke; smokeOwn.uGust = since; this.smokeShown = smoke > 0.01; smokeMesh().visible = smoke > 0.01; }
    },
    tick(seconds) {
      clock += seconds;
      if (draftMix < 1) draftMix = Math.min(1, draftMix + seconds / 2);
      for (const u of [own, smokeOwn]) if (u) { u.uTime = clock; u.uDraftMix = draftMix; }
    },
    clear() { drop(); dropDrafts(); dropFills(); lastFill = null; showing = null; smokeShowing = null; },
    get shown() { return !!mesh?.visible || !!smoke?.visible; },
  };
}

// The fires to throw sparks, nearest the view first: [{ x, y, size }] from fire lights ({ x, y, radius, fire }), at most
// MAX_FIRES, within `margin` of the view ({ x, y, w, h }).
export function fireSparksOf(lights = [], view = null, grid = 100) {
  const inView = (l) => !view || (l.x > view.x - grid * 2 && l.y > view.y - grid * 2 && l.x < view.x + view.w + grid * 2 && l.y < view.y + view.h + grid * 2);
  const mid = view ? { x: view.x + view.w / 2, y: view.y + view.h / 2 } : { x: 0, y: 0 };
  return lights.filter((l) => l.fire && inView(l))
    .sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))
    .slice(0, MAX_FIRES)
    .map((l) => ({ x: l.x, y: l.y, reach: l.reach, size: Math.min(2, Math.max(0.4, (Number(l.radius) || grid * 3) / (grid * 5))) }));
}

// The room smoke the indoor air holds (indoor-air.mjs createSmokeAir), drawn on the GPU in one pass over the scene: billows
// carried along the draft, streaming out through doorways and rolling slowly in a shut room.
//
// It is the lamp haze's build (motion/lamp-air.mjs SMOKE_FRAG: a mesh over the scene rectangle, density from one texture,
// the flow from another, two staggered phases of the same billows handed over so the motion never snaps back) with one real
// difference: weight. The haze is atmosphere and tops out near half alpha; this is the smoke that blocks sight, so a full
// cell must hide what stands in it (THICK_COVER) while a thin one only veils (THIN_COVER). airCover is that curve, as a
// plain function so the promise is tested without a GPU.
//
// The painted style of smoke-look.mjs: stepped tone out of GREYS (never a smooth gradient), a ragged, soft edge, and nothing
// shaped like the cells of the field: the density is sampled through a warp, so its boundary knows nothing of the grid.
//
// Pure and driven by the clock it is handed (look({ now })): no Math.random, no Date.now, no performance.now. It draws and
// writes no documents, and has nothing to do with the sight fence.

import { GREYS } from "./smoke-look.mjs";

// How quickly cover rises with the density the sim holds (0-1, 1 = THICK): 1 - e^(-rate * v). A full cell reaches 0.909
// (THICK_COVER 0.9), a thin one (THIN / THICK, about 0.27) 0.48 (THIN_COVER 0.62). The shader is built from this same number.
const COVER_RATE = 2.4;

/**
 * The cover the pass paints for a held density `v` (0-1 as the sim holds it), 0-1: what the shader's alpha follows in the body
 * of a billow. KEEP IN STEP with SMOKE_FRAG below, whose `cover` is the same expression built from COVER_RATE.
 */
export function airCover(v) {
  const d = Math.max(0, Math.min(1, Number(v) || 0));
  return d <= 0 ? 0 : 1 - Math.exp(-COVER_RATE * d);
}

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

// GREYS ("#rrggbb", palest first) as shader constants.
const grey = (i) => {
  const n = parseInt(GREYS[i].slice(1), 16);
  return `vec3(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(4)).join(", ")})`;
};

const SMOKE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFill;    // the smoke the air holds (a: 0-1, 1 = a full cell), cols x rows over the scene rectangle
uniform sampler2D uDraft, uDraftWas;
uniform float uDraftMix;
uniform vec2 uSize, uCell;  // the scene rectangle, px; one cell of uFill, px
uniform float uTime, uGrid, uAmount, uGust;   // uGust: seconds since a door last opened
float airHere(vec4 d){ float delay = d.a * 6.0, since = uGust - delay; float k = (d.a > 0.99 || since < 0.0) ? 0.3 : 0.3 + 0.3 * smoothstep(0.0, 1.2, since) * exp(-max(0.0, since - 1.2) / 3.0); return d.b * k; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
// airCover (smoke-air-look.mjs), the same curve: KEEP IN STEP.
float cover(float v){ return 1.0 - exp(-${COVER_RATE.toFixed(4)} * clamp(v, 0.0, 1.0)); }
// The four painted greys, palest (0) to darkest (3).
vec3 grey(int i){ if (i == 0) return ${grey(0)}; if (i == 1) return ${grey(1)}; if (i == 2) return ${grey(2)}; return ${grey(3)}; }
void main(){
  vec2 px = vUv * uSize;
  vec2 q = px / (uGrid * 3.0);
  // Where the density is read is warped, so the edge of the smoke wanders across the field's cells instead of following them.
  vec2 warp = vec2(noise(q * 1.3 + uTime * 0.03), noise(q * 1.3 + 5.1 - uTime * 0.025)) - 0.5;
  vec2 at = clamp(vUv + warp * uCell / uSize * 1.6, 0.0, 1.0);
  float fill = texture2D(uFill, at).a;
  if (fill < 0.02 || uAmount < 0.01) { gl_FragColor = vec4(0.0); return; }
  vec4 d = mix(texture2D(uDraftWas, vUv), texture2D(uDraft, vUv), uDraftMix);
  // Where the air runs (a doorway, a gust) the billows are carried with it; in a shut room they only roll where they are.
  float moving = smoothstep(0.12, 0.55, min(1.0, airHere(d) * 1.8));
  vec2 flow = (d.rg * 2.0 - 1.0) * moving;
  vec2 rolling = q + warp * 1.4 + vec2(uTime * 0.02, -uTime * 0.015);
  // Two phases of the same billows, each carried for a while and handed over as it runs out, half a period apart: they flow on
  // without ever jumping back or being drawn into lines.
  float p1 = fract(uTime * 0.1), p2 = fract(uTime * 0.1 + 0.5);
  float roll = moving > 0.01 ? mix(fbm(rolling - flow * 2.0 * p1), fbm(rolling - flow * 2.0 * p2), abs(1.0 - 2.0 * p1)) : fbm(rolling);
  // A fine ragged brush on the edge, so it is never a clean contour.
  roll += (noise(px / (uGrid * 0.35) + uTime * 0.05) - 0.5) * 0.16;
  // Billows with clear air between them while the smoke is thin; a full cell leaves none (the threshold sinks below every
  // value the billows take), so what stands in thick smoke is hidden all through it.
  float thr = 0.6 - 0.85 * fill;
  float body = smoothstep(thr, thr + 0.16, roll);
  float a = cover(fill) * body * uAmount;
  // Stepped tone: four greys, no gradient. Deep in the thick the smoke is dark, toward its thin edge and in its pale
  // billows it is lighter.
  float folds = noise(q * 1.7 + warp * 2.0 + uTime * 0.02);
  float tone = clamp(0.2 + 0.55 * fill + 0.45 * folds - 0.35 * (1.0 - body), 0.0, 0.999);
  vec3 col = grey(int(floor(tone * 4.0)));
  gl_FragColor = vec4(col * a, a);
}`;

const FADE_SECONDS = 2;

/**
 * The pass. createSmokeAirLook({ PIXI, layer: () => container or null, render }) -> { draft(pixels, cols, rows),
 * fill(pixels, cols, rows), look({ now (seconds), grid, bounds: { x, y, width, height }, amount 0-1, since (seconds since a door
 * last opened) }), clear() }. fill is createSmokeAir().pixels (RGBA, the amount in alpha); draft is indoor-air.mjs draftPixels;
 * both change in place or are replaced, and null clears them. Nothing is drawn while there is no layer, no field, no bounds
 * or no smoke.
 */
export function createSmokeAirLook({ PIXI, layer, render } = {}) {
  void render;   // kept for the shape every pass of this kind is made with; this one bakes nothing
  let mesh = null, own = null, key = "";
  let fillGiven = null, fillTex = null, draftGiven = null, draftTex = null, draftWas = null;
  let draftChangedAt = null, draftMix = 1;
  const destroyTex = (t) => { try { t?.destroy(true); } catch { /* gone */ } };
  const texture = (g) => PIXI.Texture.fromBuffer(g.pixels, g.cols, g.rows, { scaleMode: PIXI.SCALE_MODES.LINEAR });
  const still = () => PIXI.Texture.fromBuffer(new Uint8Array([128, 128, 0, 255]), 1, 1);
  const dropMesh = () => {
    try { mesh?.parent?.removeChild(mesh); mesh?.destroy(); } catch { /* gone with the canvas */ }
    mesh = null; own = null; key = "";
  };
  const dropDrafts = () => { for (const t of new Set([draftTex, draftWas])) destroyTex(t); draftTex = null; draftWas = null; draftMix = 1; draftChangedAt = null; };
  const dropFill = () => { destroyTex(fillTex); fillTex = null; };
  const use = () => { if (own) { own.uFill = fillTex; own.uDraft = draftTex; own.uDraftWas = draftWas; own.uDraftMix = draftMix; } };
  return {
    // The air's flow (draftPixels, cols x rows over the scene rectangle); null: still everywhere. The new air fades in over the
    // old, so a door opening never makes the billows jump.
    draft(pixels = null, cols = 1, rows = 1) {
      const next = pixels ? { pixels, cols, rows } : null;
      if (draftGiven?.pixels === next?.pixels && draftTex) { draftTex.baseTexture?.update?.(); return; }
      draftGiven = next;
      const was = draftTex;
      if (draftWas && draftWas !== was) destroyTex(draftWas);
      draftTex = next ? texture(next) : still();
      draftWas = was ?? draftTex; draftMix = 0; draftChangedAt = null;
      use();
    },
    // Where the smoke is now (createSmokeAir's pixels). The same pixels again are only re-uploaded: they change in place.
    fill(pixels = null, cols = 1, rows = 1) {
      if (pixels && fillGiven?.pixels === pixels && fillTex) { fillTex.baseTexture.update(); fillGiven = { pixels, cols, rows }; return; }
      fillGiven = pixels ? { pixels, cols, rows } : null;
      dropFill();
      if (fillGiven) fillTex = texture(fillGiven);
      use();
    },
    look({ now = 0, grid = 100, bounds = null, amount = 0, since = 1e3 } = {}) {
      const parent = layer?.() ?? null;
      if (!parent || !bounds || !fillTex) { if (mesh) mesh.visible = false; return; }
      const k = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${grid}`;
      if (mesh && (k !== key || mesh.parent !== parent)) dropMesh();
      if (!mesh) {
        if (!draftTex) { draftTex = still(); draftWas = draftTex; draftMix = 1; }
        const b = bounds;
        own = { uFill: fillTex, uDraft: draftTex, uDraftWas: draftWas, uDraftMix: draftMix, uSize: [b.width, b.height],
          uCell: [b.width / Math.max(1, fillGiven.cols), b.height / Math.max(1, fillGiven.rows)], uTime: now, uGrid: grid, uAmount: 0, uGust: since };
        const geometry = new PIXI.Geometry()
          .addAttribute("aVertexPosition", [b.x, b.y, b.x + b.width, b.y, b.x + b.width, b.y + b.height, b.x, b.y + b.height], 2)
          .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
        mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, SMOKE_FRAG, own));
        mesh.eventMode = "none";
        parent.addChild(mesh);
        key = k;
      }
      // A new draft fades in over FADE_SECONDS, counted from the first look after it came.
      if (draftMix < 1) {
        draftChangedAt ??= now;
        draftMix = Math.min(1, Math.max(0, (now - draftChangedAt) / FADE_SECONDS));
      }
      use();
      own.uTime = now; own.uAmount = Math.max(0, Math.min(1, Number(amount) || 0)); own.uGust = since;
      mesh.visible = own.uAmount > 0.01;
    },
    clear() { dropMesh(); dropDrafts(); dropFill(); fillGiven = null; draftGiven = null; },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const SMOKE_AIR_SHADER_SOURCES = Object.freeze([[VERT, SMOKE_FRAG]]);

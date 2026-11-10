// What a raised floor shows of its height (a region's "Casts a shadow"). Under the floors' own layer's top: the shadow it throws on the ground and floors below, never on itself or on what stands as high as it.
// Plain, that is all: the floor and its shadow. Built as old boards or a railed pier, over the floors, what real docks show from above: edge boards, gaps between planks, posts, beam ends, rails, and the thin
// shadows that join them to its shadow. The sun and moon decide it all; on moving water the water engine draws the deck's shadow, as it can take the glitter off too.
//
// Everything built is small quads with what they need in their corners, so the pixels asked for are only those it covers, and however many posts there are costs no more per pixel.

import { OVER_SHADOWS } from './region-steps.mjs';
import { skyForFloors, SUN_REACH, sunUniforms } from './floor-looks.mjs';
import { OVER_PATTERNS, shapeOf } from './water-engine.mjs';

const MOST_POSTS = 160, MOST_BOLTS = 400;
const VERT = `precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld;
void main(){ vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

export const SHADOW_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uShape; // red its shape; green where nothing of it may fall: itself, what stands as high, moving water
uniform vec4 uBox;
uniform vec2 uToSun;
uniform float uLift, uLow, uSun, uDark, uKind, uAcross, uGrid, uTime, uOverSoft;
${SUN_REACH}
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
${OVER_PATTERNS}
void main(){
  vec2 at = vWorld + uToSun * uLift * (1.0 + 1.6 * uLow), uv = (vWorld - uBox.xy) / uBox.zw;
  float free = 1.0 - texture2D(uShape, uv).g, reach = sunReach(vWorld);
  float s = texture2D(uShape, (at - uBox.xy) / uBox.zw).r * overPattern(at, uKind, uAcross) * free * uSun * reach;
  // Coloured glass lets its colours through, a pane at a time, faintly on the ground.
  if (uKind > 6.5 && uKind < 7.5) { vec2 pane = floor(at / (uGrid * 0.45)); gl_FragColor = vec4((0.55 + 0.45 * sin(fract(sin(dot(pane, vec2(12.9, 78.2))) * 437.5) * 6.28318 + vec3(0.0, 2.1, 4.2))) * s * 0.2, s * 0.26); return; }
  float a = s * uDark;
  gl_FragColor = vec4(vec3(0.02, 0.03, 0.05) * a, a);
}`;

// The thin shadows of what it is built from. A strip runs between two points, each thrown away from the sun by so much of its lift and so much of a rail's height; the sun moves them with no new shape. No backticks in here.
const STRIP_VERT = `precision highp float;
attribute vec2 aVertexPosition, aTo, aCorner;
attribute vec4 aLifts;
attribute vec3 aLook;
uniform mat3 projectionMatrix, translationMatrix;
uniform vec2 uAway;
uniform float uReach, uRailH;
varying vec2 vWorld;
varying float vSide, vStrength, vClip;
void main(){
  vec2 from = aVertexPosition + uAway * (aLifts.x * uReach + aLifts.z * uRailH), to = aTo + uAway * (aLifts.y * uReach + aLifts.w * uRailH), d = to - from;
  float len = length(d); vec2 way = len > 0.001 ? d / len : uAway;
  vWorld = mix(from, to, aCorner.x) + vec2(-way.y, way.x) * aCorner.y * aLook.x;
  vSide = aCorner.y; vStrength = aLook.y; vClip = aLook.z;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(vWorld, 1.0)).xy, 0.0, 1.0);
}`;
// Clip 0 lies off the deck, and is lost where the deck's own shadow already lies; 1 lies on the deck; 2 on either. Never on what stands higher.
export const STRIP_FRAG = `precision highp float;
varying vec2 vWorld;
varying float vSide, vStrength, vClip;
uniform sampler2D uShape; // red its shape, green what stands higher
uniform vec4 uBox;
uniform vec2 uAway;
uniform vec3 uInk;
uniform float uReach, uSun;
${SUN_REACH}
float shape(vec2 p){ return smoothstep(0.35, 0.65, texture2D(uShape, (p - uBox.xy) / uBox.zw).r); }
void main(){
  float a = (1.0 - smoothstep(0.5, 1.0, abs(vSide))) * vStrength, deck = shape(vWorld);
  if (vClip < 0.5) a *= (1.0 - deck) * (1.0 - shape(vWorld - uAway * uReach));
  else if (vClip < 1.5) a *= deck;
  a *= (1.0 - texture2D(uShape, (vWorld - uBox.xy) / uBox.zw).g) * uSun * sunReach(vWorld);
  gl_FragColor = vec4(uInk * a, a);
}`;

// Its planks: dark gaps across its length, each plank a little lighter or darker. No backticks in here.
export const DECK_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uShape;
uniform vec4 uBox;
uniform vec2 uAlong;
uniform float uRow;
float hash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
void main(){
  float s = dot(vWorld, uAlong) / uRow, f = fract(s), tone = (hash(floor(s)) - 0.5) * 0.3, gap = (1.0 - smoothstep(0.03, 0.09, min(f, 1.0 - f))) * 0.85, cover = smoothstep(0.35, 0.65, texture2D(uShape, (vWorld - uBox.xy) / uBox.zw).r);
  vec3 c = tone > 0.0 ? vec3(0.8, 0.7, 0.55) * tone * 0.7 : vec3(0.0); float a = tone > 0.0 ? tone * 0.7 : -tone;
  c = vec3(0.015, 0.012, 0.01) * gap + c * (1.0 - gap); a = gap + a * (1.0 - gap);
  gl_FragColor = vec4(c, a) * cover;
}`;

// What it is built from, in the wood or stone or metal of its tile, each quad its kind. No backticks in here.
const PIECE_VERT = `precision highp float;
attribute vec2 aVertexPosition, aUv;
attribute vec4 aMeta;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld, vUv;
varying vec4 vMeta;
void main(){ vWorld = aVertexPosition; vUv = aUv; vMeta = aMeta; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
export const PIECE = Object.freeze({ beam: 0, round: 1, square: 2, rail: 3, upright: 4, board: 5, boardShade: 6, bolt: 7 });
export const PIECE_FRAG = `precision highp float;
varying vec2 vWorld, vUv;
varying vec4 vMeta; // kind, a number of its own, the way out from the deck
uniform sampler2D uTile;
uniform vec2 uToSun;
uniform float uTileSize, uSun;
void main(){
  float kind = vMeta.x, a = 1.0, facing = dot(vMeta.zw, uToSun), d = length(vUv), v = abs(vUv.y), light = 0.5 + 0.5 * uSun;
  vec2 out_ = vMeta.zw, along = vec2(-out_.y, out_.x);
  vec3 c = vec3(0.0);
  if (kind < 0.5) { c = texture2D(uTile, vec2(dot(vWorld, out_), dot(vWorld, along) * 0.2) / uTileSize).rgb * (0.58 - 0.22 * smoothstep(0.55, 1.0, v)) * light; a = 1.0 - smoothstep(0.82, 1.0, v); }
  else if (kind < 1.5) { float rings = 0.5 + 0.5 * sin(d * 19.0 + vMeta.y * 6.0); c = texture2D(uTile, vWorld / uTileSize).rgb * (0.62 + rings * 0.22 + dot(vUv, uToSun) * 0.3) * (0.45 + 0.55 * smoothstep(1.0, 0.72, d)) * light; a = 1.0 - smoothstep(0.92, 1.0, d); }
  else if (kind < 2.5) { float m = max(abs(vUv.x), abs(vUv.y)); c = texture2D(uTile, vWorld / uTileSize).rgb * (0.74 + dot(vUv, uToSun) * 0.28) * (0.55 + 0.45 * smoothstep(1.0, 0.78, m)) * light; a = 1.0 - smoothstep(0.92, 1.0, m); }
  else if (kind < 3.5) { vec3 t = texture2D(uTile, vec2(dot(vWorld, along), dot(vWorld, out_) * 0.2) / uTileSize).rgb; c = mix(t * 1.35 + vec3(0.04), t * 0.5, smoothstep(0.1, 0.8, v)) * light; a = 1.0 - smoothstep(0.78, 1.0, v); }
  else if (kind < 4.5) { c = texture2D(uTile, vWorld / uTileSize).rgb * (0.72 + dot(vUv, uToSun) * 0.3) * (0.5 + 0.5 * smoothstep(1.0, 0.6, d)) * light; a = 1.0 - smoothstep(0.85, 1.0, d); }
  else if (kind < 5.5) { c = texture2D(uTile, vec2(dot(vWorld, along), dot(vWorld, out_) * 0.2) / uTileSize).rgb * (1.12 + max(0.0, facing) * 0.4) * (1.0 - 0.35 * smoothstep(0.72, 1.0, v)) * mix(1.0, light, 0.5); }
  else if (kind < 6.5) { a = (1.0 - smoothstep(0.0, 1.0, v)) * 0.42 * max(0.0, facing) * uSun; }
  else { a = (1.0 - smoothstep(0.6, 1.0, d)) * 0.7; c = vec3(0.05, 0.04, 0.03); }
  gl_FragColor = vec4(c * a, a);
}`;

// Its post's size and spacing, in squares, thick and slim, how far a beam end shows past its edge, and whether square. A floor with no post has none to offer.
const FLOOR_BODIES = Object.freeze({ wood: { planked: true, post: { size: 0.12, slim: 0.05, gap: 1.12, beam: 0.3, slimBeam: 0.14, square: false } }, stone: { post: { size: 0.19, slim: 0.1, gap: 2.6, beam: 0, slimBeam: 0, square: true } }, metal: { post: { size: 0.07, slim: 0.04, gap: 1.7, beam: 0.14, slimBeam: 0.14, square: true } } });
export const floorBody = (floor) => FLOOR_BODIES[floor] ?? {};

// A region's long edges (pure), each with the way along it and the way out of the region. `inside(x, y)` whether a point is in the region.
export function longEdges(areas, { grid = 100, inside = () => false } = {}) {
  const out = [];
  for (const area of areas) { let longest = 0; for (let i = 0; i + 1 < area.length; i += 2) longest = Math.max(longest, Math.hypot(area[(i + 2) % area.length] - area[i], area[(i + 3) % area.length] - area[i + 1]));
    for (let i = 0; i + 1 < area.length; i += 2) {
      const ax = area[i], ay = area[i + 1], bx = area[(i + 2) % area.length], by = area[(i + 3) % area.length], len = Math.hypot(bx - ax, by - ay);
      if (len < Math.max(grid * 1.5, longest * 0.4)) continue;
      const ux = (bx - ax) / len, uy = (by - ay) / len, mx = (ax + bx) / 2, my = (ay + by) / 2, way = inside(mx - uy * grid * 0.05, my + ux * grid * 0.05) ? -1 : 1;
      out.push({ ax, ay, bx, by, ux, uy, nx: -uy * way, ny: ux * way, len });
    } }
  return out;
}

// Where posts stand along a region's long edges (pure): just outside them, evenly, so those on its two sides stand across from one another. `where(x, y)` whether one may stand there. [{ x, y, size, ex, ey, nx, ny }] (on its edge there, and the way out), at most MOST_POSTS.
export function postSpots(areas, { grid = 100, gap = 1.7, size = 0.11, inside = () => false, where = () => true } = {}) {
  const out = [], step = grid * gap, off = grid * size * 0.55;
  for (const { ax, ay, ux, uy, nx, ny, len } of longEdges(areas, { grid, inside })) {
    const room = Math.max(1, Math.floor(len / step));
    for (let n = 0; n < room; n++) {
      const along = ((n + 0.5) / room) * len, ex = ax + ux * along, ey = ay + uy * along, x = ex + nx * off, y = ey + ny * off;
      if (where(x, y) && out.length < MOST_POSTS) out.push({ x, y, size: 1, ex, ey, nx, ny });
    }
  }
  return out;
}

// How much further than with the sun well up a shadow falls (pure). Moving water reads it from the sun's colour, so what lies on water must too, to meet the shadow it draws.
export const shadowStretch = ({ onWater = false, low = 0, blue = 1 } = {}) => 1 + 1.6 * (onWater ? Math.min(1, Math.max(0, (0.62 - blue) / 0.45)) : low);

// What a built floor is made of (pure): `strips` the thin shadows, `pieces` the quads drawn from its tile, in the order they are drawn. Lengths in px.
export function dockPieces({ style, floor, grid = 100, posts = [], edges = [], painted = true, railH = grid * 0.34 } = {}) {
  const body = floorBody(floor), post = body.post, strips = [], pieces = [], old = style === 'old';
  if (!style || !post) return { strips, pieces };
  const r = grid * (old ? post.size : post.slim), reach = grid * (old ? post.beam : post.slimBeam), board = grid * 0.09;
  for (const p of posts) {
    strips.push({ from: [p.x, p.y], to: [p.ex, p.ey], lifts: [0, 1, 0, 0], width: Math.max(r * 0.65, grid * 0.02), strength: 0.66, clip: 0 });
    if (reach > 0) {
      strips.push({ from: [p.ex, p.ey], to: [p.ex + p.nx * reach, p.ey + p.ny * reach], lifts: [1, 1, 0, 0], width: grid * 0.06, strength: 0.7, clip: 0 });
      pieces.push({ kind: PIECE.beam, at: [p.ex + (p.nx * reach) / 2, p.ey + (p.ny * reach) / 2], axis: [p.nx, p.ny], half: [reach / 2, grid * 0.055], out: [p.nx, p.ny], seed: 0 });
    }
  }
  for (const e of edges) {
    if (painted) {
      pieces.push({ kind: PIECE.boardShade, at: [(e.ax + e.bx) / 2 - e.nx * (board + grid * 0.025), (e.ay + e.by) / 2 - e.ny * (board + grid * 0.025)], axis: [e.ux, e.uy], half: [e.len / 2, grid * 0.05], out: [e.nx, e.ny], seed: 0 });
      pieces.push({ kind: PIECE.board, at: [(e.ax + e.bx) / 2 - (e.nx * board) / 2, (e.ay + e.by) / 2 - (e.ny * board) / 2], axis: [e.ux, e.uy], half: [e.len / 2, board / 2], out: [e.nx, e.ny], seed: 0 });
    }
  }
  if (painted && body.planked) {
    const row = grid * 0.19, inset = board + grid * 0.07; let bolts = 0;
    for (const e of edges) for (let n = 0.5; n * row < e.len && bolts < MOST_BOLTS; n += 1, bolts += 1) pieces.push({ kind: PIECE.bolt, at: [e.ax + e.ux * n * row - e.nx * inset, e.ay + e.uy * n * row - e.ny * inset], axis: [1, 0], half: [grid * 0.02, grid * 0.02], out: [e.nx, e.ny], seed: 0 });
  }
  if (style === 'railed') {
    const inset = grid * 0.04, between_ = grid * post.gap * 0.5;
    for (const e of edges) {
      const ax = e.ax - e.nx * inset, ay = e.ay - e.ny * inset, bx = e.bx - e.nx * inset, by = e.by - e.ny * inset;
      strips.push({ from: [ax, ay], to: [bx, by], lifts: [0, 0, 1, 1], width: grid * 0.015, strength: 0.22, clip: 1 }, { from: [ax, ay], to: [bx, by], lifts: [1, 1, 1, 1], width: grid * 0.015, strength: 0.55, clip: 0 });
      pieces.push({ kind: PIECE.rail, at: [(ax + bx) / 2, (ay + by) / 2], axis: [e.ux, e.uy], half: [e.len / 2, grid * 0.022], out: [e.nx, e.ny], seed: 0 });
      const room = Math.max(1, Math.floor(e.len / between_));
      for (let n = 0; n <= room; n++) { const x = ax + e.ux * (n / room) * e.len, y = ay + e.uy * (n / room) * e.len;
        strips.push({ from: [x, y], to: [x, y], lifts: [0, 0, 0, 1], width: grid * 0.015, strength: 0.22, clip: 1 }, { from: [x, y], to: [x, y], lifts: [1, 1, 0, 1], width: grid * 0.015, strength: 0.55, clip: 0 });
        pieces.push({ kind: PIECE.upright, at: [x, y], axis: [1, 0], half: [grid * 0.032, grid * 0.032], out: [e.nx, e.ny], seed: 0 }); }
    }
  }
  for (const [i, p] of posts.entries()) {
    strips.push({ from: [p.x, p.y], to: [p.x, p.y], lifts: [0, 0, 0, (r * 2.2) / railH], width: r * 0.8, strength: old ? 0.5 : 0.3, clip: 2 });
    pieces.push({ kind: post.square ? PIECE.square : PIECE.round, at: [p.x, p.y], axis: [1, 0], half: [r + 1, r + 1], out: [p.nx, p.ny], seed: ((i * 7) % 11) / 11 });
  }
  return { strips, pieces };
}

const boxAround = (areas, margin) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const area of areas) for (let i = 0; i + 1 < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); } return Number.isFinite(x0) ? { x: x0 - margin, y: y0 - margin, w: x1 - x0 + margin * 2, h: y1 - y0 + margin * 2 } : null; };

/**
 * The layer. sync(list): `list` what casts, [{ id, areas, kind (OVER_SHADOWS), soft, dark, across, lift (px), blockers: [areas, ...] (where its shadow may not fall, itself among them), floor,
 * tile (its painted tile, none: nothing of its body yet), tileSize, style (DOCK_STYLES), painted, onWater, above: [areas, ...] (what stands higher),
 * edges (longEdges), posts: [{ x, y, size, water, ex, ey, nx, ny }] }]. tick(seconds, { sky, shade, view, weather }) while busy.
 * ripples(seconds) gives the posts in water due a ring now. clear(). `root(spec)` lies under what lies on the floors. A root that ignores the argument stays the map layer. `edges()` over the floors.
 */
export function createFloorShadows({ PIXI, root, edges = root, grid = () => 100 }) {
  const known = new Map();
  let clock = 0, ringIn = 0, seenLast = null;
  const quadOf = (box) => new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array([box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h]), true), 2).addIndex(new Uint16Array([0, 1, 2, 0, 2, 3]));
  const textureOf = (pixels, w, h) => { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0); return new PIXI.Texture(new PIXI.BaseTexture(canvas, { scaleMode: PIXI.SCALE_MODES.LINEAR, wrapMode: PIXI.WRAP_MODES.CLAMP })); };
  const drop = (entry) => { try { for (const mesh of [entry.mesh, entry.deck, entry.strips, entry.pieces]) { if (!mesh) continue; mesh.parent?.removeChild(mesh); mesh.destroy(); } entry.shape.destroy(true); entry.outline?.destroy(true); } catch { /* gone with the canvas */ } };
  const indices = (count) => { const out = new Uint16Array(count * 6); for (let i = 0; i < count; i++) out.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); return out; };
  const stripGeometry = (list) => { const n = list.length * 4, from = new Float32Array(n * 2), to = new Float32Array(n * 2), corner = new Float32Array(n * 2), lifts = new Float32Array(n * 4), look = new Float32Array(n * 3), corners = [[0, -1], [1, -1], [1, 1], [0, 1]];
    list.forEach((s, i) => corners.forEach((c, j) => { const v = i * 4 + j; from.set(s.from, v * 2); to.set(s.to, v * 2); corner.set(c, v * 2); lifts.set(s.lifts, v * 4); look.set([s.width, s.strength, s.clip], v * 3); }));
    return new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(from, true), 2).addAttribute('aTo', new PIXI.Buffer(to, true), 2).addAttribute('aCorner', new PIXI.Buffer(corner, true), 2).addAttribute('aLifts', new PIXI.Buffer(lifts, true), 4).addAttribute('aLook', new PIXI.Buffer(look, true), 3).addIndex(indices(list.length)); };
  const pieceGeometry = (list) => { const n = list.length * 4, at = new Float32Array(n * 2), uv = new Float32Array(n * 2), meta = new Float32Array(n * 4), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    list.forEach((p, i) => corners.forEach((c, j) => { const v = i * 4 + j, [ux, uy] = p.axis; at.set([p.at[0] + ux * c[0] * p.half[0] - uy * c[1] * p.half[1], p.at[1] + uy * c[0] * p.half[0] + ux * c[1] * p.half[1]], v * 2); uv.set(c, v * 2); meta.set([p.kind, p.seed, p.out[0], p.out[1]], v * 4); }));
    return new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(at, true), 2).addAttribute('aUv', new PIXI.Buffer(uv, true), 2).addAttribute('aMeta', new PIXI.Buffer(meta, true), 4).addIndex(indices(list.length)); };
  const make = (spec) => {
    const size = grid() || 100, lift = spec.lift ?? size * 0.45, box = boxAround(spec.areas, lift * 2.7 + size * 0.5);
    if (!box) return null;
    const k = Math.min(0.25, 1024 / Math.max(box.w, box.h)), soft = spec.soft ?? 0, shown = shapeOf(spec.areas, box, k, size * k * (0.08 + soft * 0.5)), pixels = new Uint8ClampedArray(shown.w * shown.h * 4);
    for (let i = 0; i < shown.data.length; i++) { pixels[i * 4] = shown.data[i]; pixels[i * 4 + 3] = 255; }
    for (const areas of spec.blockers ?? [spec.areas]) { const barred = shapeOf(areas, box, k, 0); for (let i = 0; i < barred.data.length; i++) pixels[i * 4 + 1] = Math.max(pixels[i * 4 + 1], barred.data[i]); }
    const shape = textureOf(pixels, shown.w, shown.h);
    const mesh = new PIXI.Mesh(quadOf(box), PIXI.Shader.from(VERT, SHADOW_FRAG, { ...sunUniforms(PIXI), uShape: shape, uBox: [box.x, box.y, box.w, box.h], uToSun: [1, 0], uLift: lift, uLow: 0, uSun: 0, uDark: spec.dark ?? 0.45, uKind: Math.max(0, OVER_SHADOWS.indexOf(spec.kind)), uAcross: spec.across ? 1 : 0, uGrid: size, uTime: clock, uOverSoft: soft * 0.3 }));
    mesh.eventMode = 'none';
    if (spec?.plane?.zIndex != null) mesh.zIndex = spec.plane.zIndex;
    root(spec).addChild(mesh);
    // Its body wants its tile: till that is ready, none.
    let outline = null, deck = null, strips = null, pieces = null;
    const posts = spec.posts ?? [];
    if (spec.tile && spec.style) {
      const fine = shapeOf(spec.areas, box, k, 0), linePixels = new Uint8ClampedArray(fine.w * fine.h * 4);
      for (let i = 0; i < fine.data.length; i++) { linePixels[i * 4] = fine.data[i]; linePixels[i * 4 + 3] = 255; }
      for (const areas of spec.above ?? []) { const higher = shapeOf(areas, box, k, 0); for (let i = 0; i < higher.data.length; i++) linePixels[i * 4 + 1] = Math.max(linePixels[i * 4 + 1], higher.data[i]); }
      outline = textureOf(linePixels, fine.w, fine.h);
      const body = floorBody(spec.floor), place = [box.x, box.y, box.w, box.h], tileSize = spec.tileSize ?? size * 4;
      {
        const built = dockPieces({ style: spec.style, floor: spec.floor, grid: size, posts, edges: spec.edges ?? [], painted: !!spec.painted, railH: size * 0.34 }), longest = (spec.edges ?? []).reduce((best, e) => (e.len > (best?.len ?? 0) ? e : best), null);
        if (spec.painted && body.planked && longest) { deck = new PIXI.Mesh(quadOf(boxAround(spec.areas, 1)), PIXI.Shader.from(VERT, DECK_FRAG, { uShape: outline, uBox: place, uAlong: [longest.ux, longest.uy], uRow: tileSize / 21 })); deck.eventMode = 'none'; edges().addChild(deck); }
        if (built.strips.length) { strips = new PIXI.Mesh(stripGeometry(built.strips), PIXI.Shader.from(STRIP_VERT, STRIP_FRAG, { ...sunUniforms(PIXI), uShape: outline, uBox: place, uAway: [-1, 0], uReach: lift, uRailH: size * 0.34, uSun: 0, uInk: spec.onWater ? [0.03, 0.09, 0.12] : [0.02, 0.03, 0.05] })); strips.eventMode = 'none'; edges().addChild(strips); }
        if (built.pieces.length) { pieces = new PIXI.Mesh(pieceGeometry(built.pieces), PIXI.Shader.from(PIECE_VERT, PIECE_FRAG, { uTile: spec.tile, uToSun: [1, 0], uTileSize: tileSize, uSun: 0 })); pieces.eventMode = 'none'; edges().addChild(pieces); }
      }
    }
    return { mesh, deck, strips, pieces, shape, outline, box, posts, lift, rail: size * 0.34, onWater: !!spec.onWater };
  };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const spec of list) {
        seen.add(spec.id);
        const key = JSON.stringify([spec.areas, spec.areas.map((a) => a.holes ?? null), spec.kind, spec.soft, spec.dark, !!spec.across, spec.lift, (spec.blockers ?? []).map((list_) => [list_, list_.map((a) => a.holes ?? null)]), spec.floor, !!spec.tile, spec.tile?.baseTexture?.uid ?? null, spec.tileSize, spec.posts ?? [], spec.style ?? '', !!spec.painted, !!spec.onWater, (spec.above ?? []).map((list_) => [list_, list_.map((a) => a.holes ?? null)]), spec.edges ?? []]), had = known.get(spec.id);
        if (had?.key === key && had.mesh?.parent === root(spec)) continue;
        if (had) { drop(had); known.delete(spec.id); }
        try { const entry = make(spec); if (entry) { entry.key = key; known.set(spec.id, entry); } } catch (error) { console.warn('Animater | floor shadow', error); }
      }
      for (const [id, entry] of known) if (!seen.has(id)) { drop(entry); known.delete(id); }
    },
    tick(seconds, { sky = () => null, shade = () => null, view = () => null, weather = () => null } = {}) {
      clock += seconds;
      const sun = sky(), light = skyForFloors(sun, weather()?.clouds), height = Number(sun?.height), low = Number.isFinite(height) ? Math.min(1, Math.max(0, (45 - height) / 45)) : 0, seen = view(), reach = shade();
      seenLast = seen;
      for (const { mesh, deck, strips, pieces, box, lift, rail, onWater } of known.values()) {
        const shows = !seen || (box.x < seen.x + seen.w && box.x + box.w > seen.x && box.y < seen.y + seen.h && box.y + box.h > seen.y);
        for (const part of [mesh, deck, strips, pieces]) if (part) part.visible = shows;
        if (!shows) continue;
        const w = mesh.shader.uniforms;
        w.uToSun = light.toSun; w.uLow = low; w.uSun = light.shine; w.uTime = clock;
        if (reach) { w.uSunlit = reach.sunlit; w.uTreeShade = reach.trees; w.uSceneRect = reach.rect; }
        if (strips) { const s = strips.shader.uniforms, stretch = shadowStretch({ onWater, low, blue: light.color?.[2] ?? 1 }); s.uAway = [-light.toSun[0], -light.toSun[1]]; s.uReach = lift * stretch; s.uRailH = rail * stretch; s.uSun = light.shine; if (reach) { s.uSunlit = reach.sunlit; s.uTreeShade = reach.trees; s.uSceneRect = reach.rect; } }
        if (pieces) { const p = pieces.shader.uniforms; p.uToSun = light.toSun; p.uSun = light.shine; }
      }
    },
    // Every so often, which posts standing in water and in view ring it: a few at a time, however many there are.
    ripples(seconds) { ringIn -= seconds; if (ringIn > 0) return []; ringIn = 1.4; const seen = seenLast, wet = []; for (const { posts } of known.values()) for (const p of posts) if (p.water && (!seen || (p.x > seen.x && p.x < seen.x + seen.w && p.y > seen.y && p.y < seen.y + seen.h))) wet.push(p); const chance = Math.min(0.45, 5 / Math.max(1, wet.length)); return wet.filter(() => Math.random() < chance); },
    clear() { for (const entry of known.values()) drop(entry); known.clear(); },
    get busy() { return known.size > 0; },
    get count() { return known.size; },
  };
}

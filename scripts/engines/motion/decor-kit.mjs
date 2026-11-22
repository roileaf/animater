// The catalog's kits: things painted from a palette, not from colours written into them.
//
// A piece here is one drawing. What it is made of is asked for when it is painted: which wood, which metal, which
// cloth, how worn, standing or fallen. So one chair is every chair — oak or walnut, with a red cushion or a green
// one, new or battered — and no two painted of it come out quite alike, because each takes its colours a little off
// the palette's, by its own seed. (Roi: "we use the same decorations over and over, theres no tint difference
// between everything".)
//
// The finish is the decorations' own (decor-paint.mjs paintTools): a flat base, a shade band, a lit edge, grain
// hatched along the boards, a heavy ink outline. Everything is seen from straight above, lit from the top left.

import { paintTools, seeded, DECOR_KINDS } from './decor-paint.mjs'; // (seeded: also the hand's own wander, in thinLine)

const { inked, painted, boxAt, softShadow, blob, line, mix, shade, pathOf, reach, centre, INKD } = paintTools;

/** The woods a piece can be made of: its board colour, and what it is called. */
export const WOODS = Object.freeze({
  oak: { label: 'Oak', base: '#8a6a42' },
  pine: { label: 'Pine', base: '#b39058' },
  ash: { label: 'Ash', base: '#a59c88' },
  walnut: { label: 'Walnut', base: '#5c4029' },
  cherry: { label: 'Cherry', base: '#7c412b' },
  weathered: { label: 'Weathered', base: '#7d786d' },
  charred: { label: 'Charred', base: '#34302c' },
});
/** The metals of its hoops, bands, nails and locks. */
export const METALS = Object.freeze({
  iron: { label: 'Iron', base: '#5a5d64' },
  steel: { label: 'Polished steel', base: '#99a0a8' },
  rusted: { label: 'Rusted', base: '#7c4a2a' },
  brass: { label: 'Brass', base: '#a98838' },
  copper: { label: 'Copper', base: '#9b5c39' },
});
/** The dyes of its cushions and covers. */
export const CLOTHS = Object.freeze({
  red: { label: 'Red', base: '#9b2f2a' },
  blue: { label: 'Blue', base: '#2f4f8c' },
  green: { label: 'Green', base: '#3f6b3a' },
  yellow: { label: 'Yellow', base: '#c3a13a' },
  purple: { label: 'Purple', base: '#5f3b7c' },
  brown: { label: 'Brown', base: '#6b4b31' },
  black: { label: 'Black', base: '#2b2927' },
  cream: { label: 'Cream', base: '#d9cdb1' },
});
export const WOOD_IDS = Object.freeze(Object.keys(WOODS)), METAL_IDS = Object.freeze(Object.keys(METALS)), CLOTH_IDS = Object.freeze(Object.keys(CLOTHS));
/** How a piece stands: upright, knocked over, or smashed. */
export const STATES = Object.freeze(['standing', 'fallen', 'broken']);

// A colour a little off itself (pure): hue, lightness and saturation each moved by a part of what is allowed, from the
// piece's own seed. Two crates of one oak are two oaks.
const toHsl = (hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)), h = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; return [(h + 360) % 360, s, l]; };
const fromHsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return `#${[r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('')}`; };
// (The painters' mix and shade answer in rgb(); the palettes are kept in hex.)
const hexOf = (c) => (c.startsWith('#') ? c : `#${c.match(/\d+/g).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`);
/** A colour varied by a seed's worth (pure): `by` 0 none, 1 the usual, 2 a lot. */
export function varied(hex, rng, by = 1) {
  const [h, s, l] = toHsl(hex), k = Math.max(0, by);
  return fromHsl((h + (rng() - 0.5) * 12 * k + 360) % 360, Math.min(1, Math.max(0, s * (1 + (rng() - 0.5) * 0.24 * k))), Math.min(0.92, Math.max(0.06, l * (1 + (rng() - 0.5) * 0.2 * k))));
}
/**
 * What a piece is painted in (pure): its wood, metal and cloth as colours, each varied by the piece's own seed, and
 * darker and greyer the more worn it is. `look` { wood, metal, cloth, wear 0-1, vary 0-2 }.
 */
export function paletteOf(look = {}, rng = Math.random) {
  const wear = Math.min(1, Math.max(0, Number(look.wear) || 0)), vary = look.vary ?? 1;
  const aged = (hex, grey = 0.34, dark = 0.22) => mix(mix(hex, '#8a857a', wear * grey), '#0c0904', wear * dark);
  // (look.warm, a trial: woods fuller and a touch lighter, dyes a little deeper.)
  const dust = (hex, by) => { if (!look.warm) return hex; const [h, s, l] = toHsl(hex); return fromHsl(h, Math.min(1, s * (1 + by * 1.5)), Math.min(0.9, l * (1 + by * 0.3))); };
  const wood = hexOf(aged(dust(varied((WOODS[look.wood] ?? WOODS.oak).base, rng, vary), 0.22))), metal = hexOf(aged(dust(varied((METALS[look.metal] ?? METALS.iron).base, rng, vary * 0.6), 0), 0.1, 0.2)), cloth = hexOf(aged(dust(varied((CLOTHS[look.cloth] ?? CLOTHS.red).base, rng, vary * 0.7), 0.12), 0.3, 0.1));
  return { wood, woodDark: shade(wood, -0.28), woodPale: shade(wood, 0.16), metal, metalDark: shade(metal, -0.3), metalLit: shade(metal, 0.3), cloth, clothDark: shade(cloth, -0.25), clothLit: shade(cloth, 0.18), wear };
}

// ------------------------------------------------------------------------------------------------ painting helpers

const at = (a, cx = 0, cy = 0) => { const c = Math.cos(a), s = Math.sin(a); return (u, v) => [cx + c * u - s * v, cy + s * u + c * v]; };
const disc = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = fill; g.fill(); };
const ring = (g, x, y, r, stroke, w) => { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); };
const circle = (x, y, r, n = 28) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * 6.283) * r, y + Math.sin((i / n) * 6.283) * r]);
const seam = (g, o, a, b, alpha = 0.7) => line(g, [a, b], `rgba(20,12,4,${alpha})`, Math.max(0.6, o.ink * 0.8), 'butt');
// Boards across a shape: seams every `step` along its width, clipped to it.
const boards = (g, o, pts, a, half, step, sharp = true) => { g.save(); pathOf(g, pts, sharp); g.clip(); const p = at(a); for (let v = -half + step; v < half - step * 0.3; v += step) seam(g, o, p(-half * 3, v), p(half * 3, v)); g.restore(); };
// A nail or a rivet: a dark head with a glint.
const nail = (g, o, x, y, r, pal) => { disc(g, x, y, r, pal.metalDark); disc(g, x - r * 0.25, y - r * 0.3, r * 0.4, pal.metalLit); };
// A metal band across something: its strip, a lit line along it, inked.
const band = (g, rng, o, pts, pal) => { inked(g, rng, pts, pal.metal, o, { sharp: true, band: 0.3, lit: 0.18, ink: 1.2 }); };
// What use leaves on wood: pale scratches along the grain and a dark stain or two, more of them the more worn.
const worn = (g, rng, o, pts, a, r, wear, sharp = true) => {
  if (!(wear > 0.05)) return;
  g.save(); pathOf(g, pts, sharp); g.clip();
  const p = at(a);
  for (let i = 0, n = Math.round(wear * 26); i < n; i++) { const u = (rng() - 0.5) * r * 1.8, v = (rng() - 0.5) * r * 1.8, len = r * (0.1 + rng() * 0.3); line(g, [p(u, v), p(u + len, v + (rng() - 0.5) * r * 0.04)], `rgba(240,225,195,${0.12 + rng() * 0.16})`, Math.max(0.5, o.ink * 0.5)); }
  g.filter = `blur(${Math.max(1, r * 0.08)}px)`;
  for (let i = 0, n = Math.round(wear * 7); i < n; i++) { g.fillStyle = `rgba(18,10,4,${0.16 + rng() * 0.2})`; g.beginPath(); g.ellipse((rng() - 0.5) * r * 1.4, (rng() - 0.5) * r * 1.4, r * (0.12 + rng() * 0.2), r * (0.08 + rng() * 0.14), rng() * 3, 0, 6.283); g.fill(); }
  g.filter = 'none'; g.restore();
};
// A cushion: a soft rounded pad of cloth with a seam round it and a button in its middle.
const cushion = (g, rng, o, cx, cy, w, h, a, pal) => {
  const p = at(a, cx, cy), n = 22, pts = Array.from({ length: n }, (_, i) => { const t = (i / n) * 6.283, k = 1 / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))) ** 0.55; return p(Math.cos(t) * w * k * 0.92, Math.sin(t) * h * k * 0.92); });
  painted(g, rng, pts, pal.cloth, o, { band: 0.36, lit: 0.12, ink: 1.3 });
  g.save(); pathOf(g, pts, false); g.clip(); pathOf(g, pts.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.8]), false); g.strokeStyle = 'rgba(14,8,2,0.3)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); g.restore();
  disc(g, cx, cy, Math.max(1, Math.min(w, h) * 0.09), pal.clothDark);
  return pts;
};

// A round vessel knocked on its side: its body tapering from its mouth to its foot, its mouth a dark slanted oval.
// `deco(p)` draws what is on its body (clipped to it). Returns the body's outline.
const onSide = (g, rng, o, a, L, Rm, Rf, base, deco) => {
  const p = at(a), body = [p(-L, -Rf), p(L * 0.7, -Rm), p(L * 0.7, Rm), p(-L, Rf)];
  softShadow(g, body, o, 0.5); painted(g, rng, body, base, o, { sharp: true, grain: a, lines: 8, hatch: 0.3, ink: 1.6 });
  g.save(); pathOf(g, body, true); g.clip(); deco?.(p); g.restore();
  const mouth = Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * 6.283; return p(L * 0.7 + Math.cos(t) * Rm * 0.34, Math.sin(t) * Rm); });
  inked(g, rng, mouth, '#17100a', o, { band: 0.2, ink: 1.5 });
  return body;
};

// ---------------------------------------------------------------------------------------------------- the pieces
//
// Each `paint(g, s, rng, o, pal)`: `s` half the picture's side in pixels, `pal` from paletteOf, `o.state` how it
// stands. Returns the outlines that cast its shadow.

const KIT = {
  barrel: { label: 'Barrel', set: 'storage', size: 0.6, uses: ['wood', 'metal'], states: ['standing', 'fallen', 'broken'], paint(g, s, rng, o, pal) {
    if (o.state === 'fallen') {
      // On its side: staves along it, bulging in the middle, a hoop toward either end and its head seen end on.
      const a = (rng() - 0.5) * 0.5, p = at(a), L = s * 0.78, R = s * 0.5, n = 20;
      const body = [...Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return p(-L + 2 * L * t, -R * (0.82 + 0.18 * Math.sin(t * Math.PI))); }), ...Array.from({ length: n + 1 }, (_, i) => { const t = 1 - i / n; return p(-L + 2 * L * t, R * (0.82 + 0.18 * Math.sin(t * Math.PI))); })];
      softShadow(g, body, o, 0.5); painted(g, rng, body, pal.wood, o, { sharp: true, grain: a, lines: 12, hatch: 0.3, ink: 1.6 });
      g.save(); pathOf(g, body, true); g.clip(); for (let v = -R * 0.7; v <= R * 0.71; v += R * 0.35) seam(g, o, p(-L, v), p(L, v), 0.55); g.restore();
      for (const u of [-L * 0.62, L * 0.62]) band(g, rng, o, boxAt(...p(u, 0), s * 0.05, R * 0.95, a), pal);
      worn(g, rng, o, body, a, s * 0.6, pal.wear);
      return [body];
    }
    // From above: its head of boards inside a rim of stave ends, an iron hoop round it, a bung.
    const a = rng() * 6.28, R = s * 0.74, rim = circle(0, 0, R), head = circle(0, 0, R * 0.78);
    softShadow(g, rim, o, 0.55); inked(g, rng, rim, pal.woodDark, o, { band: 0.3, ink: 1.7 });
    for (let i = 0; i < 14; i++) { const t = a + (i / 14) * 6.283; seam(g, o, [Math.cos(t) * R * 0.8, Math.sin(t) * R * 0.8], [Math.cos(t) * R * 0.99, Math.sin(t) * R * 0.99], 0.6); }
    ring(g, 0, 0, R * 0.9, pal.metalDark, Math.max(1.5, s * 0.075)); ring(g, -s * 0.008, -s * 0.01, R * 0.9, pal.metal, Math.max(1, s * 0.04));
    painted(g, rng, head, pal.wood, o, { grain: a, lines: 10, hatch: 0.32, band: 0.34, ink: 1.3 });
    boards(g, o, head, a, R * 0.78, R * 0.4, false);
    if (o.state === 'broken') { const p = at(a + 0.6); const gap = [p(-R * 0.1, -R * 0.8), p(R * 0.34, -R * 0.2), p(R * 0.12, R * 0.3), p(R * 0.5, R * 0.8), p(-R * 0.2, R * 0.5), p(-R * 0.36, -R * 0.1)]; pathOf(g, gap, true); g.fillStyle = '#120c06'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke(); }
    else disc(g, Math.cos(a + 1) * R * 0.38, Math.sin(a + 1) * R * 0.38, s * 0.05, '#17100a');
    worn(g, rng, o, head, a, R * 0.78, pal.wear, false);
    return [rim];
  } },
  crate: { label: 'Crate', set: 'storage', size: 0.8, uses: ['wood', 'metal'], states: ['standing', 'broken'], paint(g, s, rng, o, pal) {
    // A lid of boards in a frame, a brace across it, an iron bracket at each corner.
    const a = (rng() - 0.5) * 0.3, p = at(a), H = s * 0.7, box = boxAt(0, 0, H, H, a), open = o.state === 'broken';
    softShadow(g, box, o, 0.55);
    painted(g, rng, box, open ? '#1a120a' : pal.wood, o, { sharp: true, grain: a, lines: open ? 0 : 16, hatch: 0.34, ink: 1.7 });
    if (open) { for (let i = 0; i < 9; i++) line(g, [p((rng() - 0.5) * H * 1.4, (rng() - 0.5) * H * 1.4), p((rng() - 0.5) * H * 1.4, (rng() - 0.5) * H * 1.4)], `rgba(200,170,90,${0.5 + rng() * 0.3})`, Math.max(0.8, o.ink)); const plank = boxAt(...p(H * 0.2, -H * 0.1), H * 0.75, H * 0.14, a + 0.5); painted(g, rng, plank, pal.wood, o, { sharp: true, grain: a + 0.5, lines: 4, ink: 1.3 }); }
    else { boards(g, o, box, a, H, H * 0.5); const lean = a + (rng() < 0.5 ? 1 : -1) * Math.PI / 4, brace = boxAt(0, 0, H * 1.25, H * 0.13, lean); g.save(); pathOf(g, box, true); g.clip(); painted(g, rng, brace, pal.woodDark, o, { sharp: true, grain: lean, lines: 5, band: 0.3, ink: 1.2 }); g.restore(); }
    for (const u of [-1, 1]) { painted(g, rng, boxAt(...p(u * H * 0.88, 0), H * 0.12, H, a), pal.woodDark, o, { sharp: true, grain: a + 1.57, lines: 5, band: 0.3, ink: 1.4 }); }
    for (const v of [-1, 1]) { painted(g, rng, boxAt(...p(0, v * H * 0.88), H, H * 0.12, a), pal.woodDark, o, { sharp: true, grain: a, lines: 5, band: 0.3, ink: 1.4 }); }
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) nail(g, o, ...p(u * H * 0.86, v * H * 0.86), Math.max(1.2, s * 0.045), pal);
    worn(g, rng, o, box, a, H, pal.wear);
    return [box];
  } },
  chest: { label: 'Chest', set: 'storage', size: 1.1, uses: ['wood', 'metal'], states: ['standing', 'broken'], paint(g, s, rng, o, pal) {
    // A lid longer than it is deep, boards along it, two iron straps over it, a lock plate at its front.
    const a = (rng() - 0.5) * 0.3, p = at(a), L = s * 0.8, D = s * 0.5, box = boxAt(0, 0, L, D, a);
    softShadow(g, box, o, 0.55); painted(g, rng, box, pal.wood, o, { sharp: true, grain: a, lines: 14, hatch: 0.34, ink: 1.8 });
    boards(g, o, box, a, D, D * 0.5);
    for (const u of [-L * 0.55, L * 0.55]) { band(g, rng, o, boxAt(...p(u, 0), L * 0.075, D * 1.02, a), pal); for (const v of [-D * 0.7, 0, D * 0.7]) nail(g, o, ...p(u, v), Math.max(1, s * 0.03), pal); }
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) band(g, rng, o, boxAt(...p(u * L * 0.9, v * D * 0.84), L * 0.1, D * 0.16, a), pal);
    const lock = boxAt(...p(0, D * 0.82), L * 0.1, D * 0.2, a); band(g, rng, o, lock, pal); disc(g, ...p(0, D * 0.84), Math.max(1, s * 0.03), '#120c06');
    if (o.state === 'broken') { g.save(); pathOf(g, box, true); g.clip(); const gash = [p(-L * 0.3, -D), p(-L * 0.05, -D * 0.3), p(-L * 0.25, D * 0.2), p(-L * 0.42, -D * 0.2)]; pathOf(g, gash, true); g.fillStyle = '#120c06'; g.fill(); g.restore(); }
    worn(g, rng, o, box, a, L, pal.wear);
    return [box];
  } },
  sack: { label: 'Sack', set: 'storage', size: 0.75, uses: ['cloth'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // A full sack: a slumped body of coarse cloth, tied at the neck, a seam down it.
    const a = rng() * 6.28, p = at(a), fallen = o.state === 'fallen', body = blob(rng, 0, 0, s * (fallen ? 0.82 : 0.66), s * (fallen ? 0.5 : 0.62), 18, 0.1, a);
    const hemp = mix(pal.cloth, '#b79c6a', 0.72);
    softShadow(g, body, o, 0.5); painted(g, rng, body, hemp, o, { grain: a + 0.8, lines: 16, hatch: 0.16, cross: true, band: 0.4, lit: 0.1, ink: 1.6 });
    line(g, [p(-s * 0.5, s * 0.05), p(-s * 0.1, -s * 0.04), p(s * 0.3, s * 0.06)], 'rgba(40,26,10,0.5)', Math.max(0.6, o.ink * 0.7));
    const neck = blob(rng, ...p(s * (fallen ? 0.78 : 0.5), 0), s * 0.2, s * 0.15, 10, 0.2); painted(g, rng, neck, shade(hemp, 0.08), o, { band: 0.3, ink: 1.3 });
    line(g, [p(s * (fallen ? 0.62 : 0.36), -s * 0.14), p(s * (fallen ? 0.62 : 0.36), s * 0.14)], pal.cloth, Math.max(1.2, s * 0.05));
    return [body];
  } },
  basket: { label: 'Basket', set: 'storage', size: 0.75, uses: ['wood', 'cloth'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // Woven: rings of withy round a dark middle, crossed by the stakes it is woven on, a handle over it.
    const a = rng() * 6.28, R = s * 0.7, rim = circle(0, 0, R), withy = mix(pal.wood, '#c9a868', 0.45);
    if (o.state === 'fallen') {
      // Tipped over: its woven side, its mouth, and what was in it rolled out across the floor.
      const L = s * 0.6, q = at(a);
      for (let i = 0; i < 5; i++) { const c = q(L * (0.95 + rng() * 0.45), (rng() - 0.5) * R * 1.3), r = R * (0.13 + rng() * 0.05); disc(g, c[0], c[1], r, shade(pal.cloth, (rng() - 0.5) * 0.3)); ring(g, c[0], c[1], r, INKD, Math.max(0.7, o.ink * 0.8)); }
      return [onSide(g, rng, o, a, L, R * 0.8, R * 0.56, withy, (p) => { for (let u = -L; u < L * 0.7; u += L * 0.2) seam(g, o, p(u, -R), p(u, R), 0.5); for (const v of [-R * 0.4, 0, R * 0.4]) seam(g, o, p(-L, v * 0.7), p(L, v), 0.3); })];
    }
    softShadow(g, rim, o, 0.5); painted(g, rng, rim, withy, o, { band: 0.36, ink: 1.6 });
    for (let k = 0; k < 4; k++) ring(g, 0, 0, R * (0.92 - k * 0.11), `rgba(40,26,10,${0.5 - k * 0.06})`, Math.max(0.6, o.ink * 0.7));
    for (let i = 0; i < 16; i++) { const t = a + (i / 16) * 6.283; seam(g, o, [Math.cos(t) * R * 0.5, Math.sin(t) * R * 0.5], [Math.cos(t) * R * 0.96, Math.sin(t) * R * 0.96], 0.45); }
    disc(g, 0, 0, R * 0.5, o.state === 'fallen' ? '#1c140c' : shade(pal.cloth, -0.05));
    if (o.state !== 'fallen') { for (let i = 0; i < 6; i++) { const t = rng() * 6.283, d = rng() * R * 0.3; disc(g, Math.cos(t) * d, Math.sin(t) * d, R * 0.14, shade(pal.cloth, (rng() - 0.5) * 0.3)); ring(g, Math.cos(t) * d, Math.sin(t) * d, R * 0.14, 'rgba(14,8,2,0.5)', Math.max(0.5, o.ink * 0.5)); } }
    ring(g, 0, 0, R * 0.5, INKD, o.ink);
    const p = at(a); line(g, [p(-R * 0.96, 0), p(-R * 0.5, -R * 0.2), p(R * 0.5, -R * 0.2), p(R * 0.96, 0)], INKD, Math.max(2, s * 0.1)); line(g, [p(-R * 0.96, 0), p(-R * 0.5, -R * 0.2), p(R * 0.5, -R * 0.2), p(R * 0.96, 0)], shade(withy, -0.1), Math.max(1, s * 0.06));
    return [rim];
  } },
  bucket: { label: 'Bucket', set: 'storage', size: 0.6, uses: ['wood', 'metal'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // Staves round a dark inside, an iron hoop, a bail across it.
    const a = rng() * 6.28, R = s * 0.7, rim = circle(0, 0, R), p = at(a);
    if (o.state === 'fallen') {
      // On its side: staves along it, a hoop round it, its bail fallen slack past its mouth.
      const L = s * 0.62, bail = [p(L * 0.7, -R * 0.74), p(L * 1.2, -R * 0.2), p(L * 1.1, R * 0.5), p(L * 0.7, R * 0.74)];
      line(g, bail, INKD, Math.max(1.6, s * 0.075)); line(g, bail, pal.metal, Math.max(0.8, s * 0.035));
      return [onSide(g, rng, o, a, L, R * 0.8, R * 0.6, pal.wood, (q) => { for (const v of [-0.5, 0, 0.5]) seam(g, o, q(-L, v * R * 0.6), q(L, v * R * 0.8), 0.55); for (const u of [-L * 0.55, L * 0.3]) { line(g, [q(u, -R), q(u, R)], pal.metalDark, Math.max(1.6, s * 0.09), 'butt'); line(g, [q(u - s * 0.012, -R), q(u - s * 0.012, R)], pal.metal, Math.max(0.8, s * 0.04), 'butt'); } })];
    }
    softShadow(g, rim, o, 0.5); painted(g, rng, rim, pal.wood, o, { band: 0.34, ink: 1.6 });
    for (let i = 0; i < 12; i++) { const t = a + (i / 12) * 6.283; seam(g, o, [Math.cos(t) * R * 0.66, Math.sin(t) * R * 0.66], [Math.cos(t) * R * 0.98, Math.sin(t) * R * 0.98], 0.6); }
    ring(g, 0, 0, R * 0.86, pal.metalDark, Math.max(1.4, s * 0.07)); ring(g, 0, 0, R * 0.86, pal.metal, Math.max(0.8, s * 0.035));
    disc(g, 0, 0, R * 0.66, o.state === 'fallen' ? '#17100a' : '#22303a'); ring(g, 0, 0, R * 0.66, INKD, o.ink * 1.1);
    if (o.state !== 'fallen') { g.save(); g.beginPath(); g.arc(0, 0, R * 0.64, 0, 6.283); g.clip(); g.fillStyle = 'rgba(190,215,225,0.22)'; g.beginPath(); g.ellipse(-R * 0.2, -R * 0.24, R * 0.3, R * 0.14, -0.6, 0, 6.283); g.fill(); g.restore(); }
    line(g, [p(-R * 0.92, 0), p(0, R * 0.34), p(R * 0.92, 0)], INKD, Math.max(1.6, s * 0.075)); line(g, [p(-R * 0.92, 0), p(0, R * 0.34), p(R * 0.92, 0)], pal.metal, Math.max(0.8, s * 0.035));
    return [rim];
  } },
  chair: { label: 'Chair', set: 'seating', size: 0.7, uses: ['wood', 'cloth'], states: ['standing', 'fallen', 'broken'], paint(g, s, rng, o, pal) {
    // A seat on four legs with a back along one side of it, and a cushion on the seat.
    const a = o.state === 'fallen' ? rng() * 6.28 : (rng() - 0.5) * 0.24, p = at(a), H = s * 0.56, seat = boxAt(0, 0, H, H, a), out = [seat];
    if (o.state === 'fallen') {
      // On its side, seen in profile: the seat edge on, its cushion a strip along it, two legs one way and the
      // back the other.
      const K = H * 0.8, bar = boxAt(0, 0, K, K * 0.17, a), stick = (u, v, w, h) => painted(g, rng, boxAt(...p(u, v), w, h, a), pal.woodDark, o, { sharp: true, grain: a + 1.57, lines: 3, band: 0.3, ink: 1.3 });
      softShadow(g, bar, o, 0.45);
      stick(-K * 0.88, K * 0.8, K * 0.1, K * 0.72); stick(K * 0.88, K * 0.8, K * 0.1, K * 0.72); stick(0, K * 0.75, K * 0.82, K * 0.07);
      stick(-K * 0.88, -K * 0.9, K * 0.11, K * 0.85); stick(-K * 0.6, -K * 1.6, K * 0.34, K * 0.1);
      painted(g, rng, boxAt(...p(K * 0.08, -K * 0.28), K * 0.78, K * 0.13, a), pal.cloth, o, { band: 0.36, ink: 1.2 });
      painted(g, rng, bar, pal.wood, o, { sharp: true, grain: a, lines: 6, ink: 1.5 });
      return [bar];
    }
    const broken = o.state === 'broken';
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { if (broken && u > 0 && v > 0) continue; painted(g, rng, boxAt(...p(u * H * 0.9, v * H * 0.9), H * 0.15, H * 0.15, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 }); }
    softShadow(g, seat, o, 0.45); painted(g, rng, seat, pal.wood, o, { sharp: true, grain: a + 1.57, lines: 8, hatch: 0.34, ink: 1.6 });
    boards(g, o, seat, a + 1.57, H, H * 0.66);
    if (broken) {
      // Its seat split, its cushion gone, half its back snapped off and lying beside it with a leg.
      const crack = [p(H * 0.2, -H), p(H * 0.42, -H * 0.3), p(H * 0.14, H * 0.2), p(H * 0.4, H)];
      g.save(); pathOf(g, seat, true); g.clip(); line(g, crack, '#120c06', Math.max(1.6, H * 0.12)); g.restore();
      const half = boxAt(...p(-H * 0.5, -H * 0.98), H * 0.54, H * 0.17, a); painted(g, rng, half, pal.woodDark, o, { sharp: true, grain: a, lines: 4, band: 0.32, ink: 1.6 }); out.push(half);
      const lost = boxAt(...p(H * 1.2, -H * 0.2), H * 0.5, H * 0.15, a + 1.1); softShadow(g, lost, o, 0.4); painted(g, rng, lost, pal.woodDark, o, { sharp: true, grain: a + 1.1, lines: 4, band: 0.32, ink: 1.4 });
      const leg = boxAt(...p(H * 1.0, H * 1.1), H * 0.42, H * 0.09, a - 0.5); painted(g, rng, leg, pal.woodDark, o, { sharp: true, grain: a - 0.5, lines: 2, ink: 1.2 });
      worn(g, rng, o, seat, a, H, Math.max(0.5, pal.wear));
      return out;
    }
    cushion(g, rng, o, ...p(0, H * 0.14), H * 0.66, H * 0.62, a, pal);
    // Its back: a top rail between two posts, standing over the rear of the seat.
    const back = boxAt(...p(0, -H * 0.94), H * 1.06, H * 0.19, a); softShadow(g, back, o, 0.45); painted(g, rng, back, pal.wood, o, { sharp: true, grain: a, lines: 6, band: 0.3, lit: 0.14, ink: 1.6 }); out.push(back);
    for (const u of [-1, 1]) painted(g, rng, boxAt(...p(u * H * 0.94, -H * 0.94), H * 0.16, H * 0.22, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.3 });
    worn(g, rng, o, back, a, H, pal.wear);
    return out;
  } },
  stool: { label: 'Stool', set: 'seating', size: 0.5, uses: ['wood'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // A round seat on three legs that show past its edge.
    const a = rng() * 6.28, R = s * 0.62, seat = circle(0, 0, R);
    if (o.state === 'fallen') {
      // On its side: the seat edge on, its three legs splayed out from under it.
      const p = at(a), edge = boxAt(...p(-R * 0.75, 0), R * 0.17, R * 0.95, a);
      softShadow(g, edge, o, 0.45);
      for (const [v, t] of [[-0.6, -0.2], [0.05, 0.03], [0.6, 0.2]]) painted(g, rng, boxAt(...p(R * 0.1, v * R + t * R * 2.2), R * 0.78, R * 0.1, a + t), pal.woodDark, o, { sharp: true, grain: a + t, lines: 3, band: 0.3, ink: 1.3 });
      painted(g, rng, edge, pal.wood, o, { sharp: true, grain: a + 1.57, lines: 5, ink: 1.6 });
      return [edge];
    }
    for (let i = 0; i < 3; i++) { const t = a + (i / 3) * 6.283, leg = boxAt(Math.cos(t) * R * 0.92, Math.sin(t) * R * 0.92, R * 0.2, R * 0.13, t); painted(g, rng, leg, pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 }); }
    softShadow(g, seat, o, 0.45); painted(g, rng, seat, pal.wood, o, { grain: a, lines: 9, hatch: 0.32, band: 0.36, ink: 1.6 });
    boards(g, o, seat, a, R, R * 0.66, false); ring(g, 0, 0, R * 0.82, 'rgba(14,8,2,0.28)', Math.max(0.6, o.ink * 0.7));
    worn(g, rng, o, seat, a, R, pal.wear, false);
    return [seat];
  } },
  bench: { label: 'Bench', set: 'seating', size: 1.6, uses: ['wood', 'metal'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // Two long boards on trestle ends, nailed down.
    const a = (rng() - 0.5) * 0.2 + (o.state === 'fallen' ? 0.5 : 0), p = at(a), L = s * 0.9, W = s * 0.2, seat = boxAt(0, 0, L, W, a);
    for (const u of [-L * 0.74, L * 0.74]) painted(g, rng, boxAt(...p(u, 0), W * 0.28, W * 1.28, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 });
    softShadow(g, seat, o, 0.5); painted(g, rng, seat, pal.wood, o, { sharp: true, grain: a, lines: 14, hatch: 0.38, ink: 1.7 });
    seam(g, o, p(-L, 0), p(L, 0), 0.75);
    for (const u of [-L * 0.74, L * 0.74]) for (const v of [-W * 0.5, W * 0.5]) nail(g, o, ...p(u, v), Math.max(1, s * 0.02), pal);
    worn(g, rng, o, seat, a, L, pal.wear);
    return [seat];
  } },
  armchair: { label: 'Armchair', set: 'seating', size: 1, uses: ['wood', 'cloth'], states: ['standing'], paint(g, s, rng, o, pal) {
    // Upholstered: a padded back and two arms round a deep seat cushion, wooden feet under its corners.
    const a = (rng() - 0.5) * 0.2, p = at(a), H = s * 0.62, frame = boxAt(0, 0, H, H * 0.94, a);
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) painted(g, rng, boxAt(...p(u * H * 0.92, v * H * 0.86), H * 0.14, H * 0.14, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 });
    softShadow(g, frame, o, 0.5); painted(g, rng, frame, pal.clothDark, o, { sharp: true, band: 0.3, ink: 1.6 });
    cushion(g, rng, o, ...p(0, H * 0.18), H * 0.66, H * 0.66, a, pal);
    cushion(g, rng, o, ...p(0, -H * 0.72), H * 0.98, H * 0.26, a, pal);
    for (const u of [-1, 1]) cushion(g, rng, o, ...p(u * H * 0.8, H * 0.2), H * 0.22, H * 0.7, a, pal);
    return [frame];
  } },
  roundTable: { label: 'Round table', set: 'tables', size: 1.4, uses: ['wood', 'metal'], states: ['standing', 'fallen'], paint(g, s, rng, o, pal) {
    // Boards across a round top, held by a rim; a foot showing either side of it.
    const a = rng() * 6.28, R = s * 0.8, top = circle(0, 0, R, 40), p = at(a);
    if (o.state === 'fallen') {
      // Tipped on its edge: the top seen at a slant, a narrow oval with its thickness under it, its legs out behind.
      const oval = (dv, k = 1) => Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * 6.283; return p(Math.cos(t) * R * k, dv + Math.sin(t) * R * 0.4 * k); });
      const face = oval(-R * 0.1), under = oval(R * 0.02);
      for (const u of [-0.4, 0.4]) painted(g, rng, boxAt(...p(u * R, R * 0.62), R * 0.09, R * 0.42, a + u * 0.3), pal.woodDark, o, { sharp: true, grain: a + 1.57, lines: 3, band: 0.3, ink: 1.3 });
      softShadow(g, under, o, 0.55); inked(g, rng, under, pal.woodDark, o, { band: 0.3, ink: 1.8 });
      painted(g, rng, face, pal.wood, o, { grain: a, lines: 16, hatch: 0.36, band: 0.4, ink: 1.6 });
      boards(g, o, face, a, R * 0.4, R * 0.16, false);
      return [under];
    }
    for (const u of [-1, 1]) painted(g, rng, boxAt(...p(u * R * 0.9, 0), R * 0.2, R * 0.12, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 });
    softShadow(g, top, o, 0.55); painted(g, rng, top, pal.wood, o, { grain: a, lines: 26, hatch: 0.36, band: 0.36, ink: 1.9 });
    boards(g, o, top, a, R, R * 0.36, false);
    ring(g, 0, 0, R * 0.9, 'rgba(14,8,2,0.32)', Math.max(0.8, o.ink)); ring(g, -R * 0.01, -R * 0.012, R * 0.96, 'rgba(255,240,210,0.1)', Math.max(0.8, o.ink));
    worn(g, rng, o, top, a, R, pal.wear, false);
    return [top];
  } },
  longTable: { label: 'Long table', set: 'tables', size: 2.2, uses: ['wood', 'metal'], states: ['standing', 'broken'], paint(g, s, rng, o, pal) {
    // Long boards, a breadboard end across each end of them, pegged; trestle feet showing at the sides.
    const a = (rng() - 0.5) * 0.14, p = at(a), L = s * 0.92, W = s * 0.4, top = boxAt(0, 0, L, W, a);
    for (const u of [-L * 0.66, L * 0.66]) painted(g, rng, boxAt(...p(u, 0), W * 0.16, W * 1.16, a), pal.woodDark, o, { sharp: true, band: 0.3, ink: 1.2 });
    softShadow(g, top, o, 0.55); painted(g, rng, top, pal.wood, o, { sharp: true, grain: a, lines: 30, hatch: 0.36, ink: 1.9 });
    boards(g, o, top, a, W, W * 0.5);
    for (const u of [-1, 1]) { const end = boxAt(...p(u * L * 0.93, 0), L * 0.07, W, a); painted(g, rng, end, pal.woodDark, o, { sharp: true, grain: a + 1.57, lines: 6, band: 0.3, ink: 1.4 }); for (const v of [-W * 0.6, 0, W * 0.6]) nail(g, o, ...p(u * L * 0.93, v), Math.max(1, s * 0.016), pal); }
    if (o.state === 'broken') { g.save(); pathOf(g, top, true); g.clip(); g.globalCompositeOperation = 'destination-out'; pathOf(g, [p(-L * 0.08, -W * 1.1), p(L * 0.04, -W * 0.3), p(-L * 0.05, W * 0.2), p(L * 0.07, W * 1.1), p(L * 0.16, W * 1.1), p(L * 0.1, W * 0.1), p(L * 0.15, -W * 0.5), p(L * 0.05, -W * 1.1)], true); g.fill(); g.globalCompositeOperation = 'source-atop'; line(g, [p(-L * 0.08, -W * 1.1), p(L * 0.04, -W * 0.3), p(-L * 0.05, W * 0.2), p(L * 0.07, W * 1.1)], INKD, o.ink * 2.4); line(g, [p(L * 0.05, -W * 1.1), p(L * 0.15, -W * 0.5), p(L * 0.1, W * 0.1), p(L * 0.16, W * 1.1)], INKD, o.ink * 2.4); g.restore(); }
    worn(g, rng, o, top, a, L, pal.wear);
    return [top];
  } },
  counter: { label: 'Counter', set: 'tables', size: 2, uses: ['wood', 'metal'], states: ['standing'], paint(g, s, rng, o, pal) {
    // A bar: a thick top, pale where elbows have worn it, a brass rail along its front and its panels below.
    const a = (rng() - 0.5) * 0.08, p = at(a), L = s * 0.92, W = s * 0.3, base = boxAt(...p(0, W * 0.16), L * 0.97, W * 0.98, a), top = boxAt(...p(0, -W * 0.1), L, W * 0.78, a);
    softShadow(g, base, o, 0.55); painted(g, rng, base, pal.woodDark, o, { sharp: true, grain: a + 1.57, lines: 20, hatch: 0.3, ink: 1.7 });
    for (let u = -L * 0.72; u <= L * 0.73; u += L * 0.36) seam(g, o, p(u, W * 0.55), p(u, W * 1.12), 0.6);
    painted(g, rng, top, pal.wood, o, { sharp: true, grain: a, lines: 26, hatch: 0.34, ink: 1.8 });
    g.save(); pathOf(g, top, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; g.fillStyle = 'rgba(255,238,205,0.14)'; pathOf(g, boxAt(...p(0, -W * 0.02), L * 0.86, W * 0.26, a), true); g.fill(); g.filter = 'none'; g.restore();
    line(g, [p(-L * 0.94, W * 0.98), p(L * 0.94, W * 0.98)], pal.metalDark, Math.max(1.6, s * 0.035)); line(g, [p(-L * 0.94, W * 0.96), p(L * 0.94, W * 0.96)], pal.metalLit, Math.max(0.7, s * 0.014));
    worn(g, rng, o, top, a, L, pal.wear);
    return [base, top];
  } },
};

// ------------------------------------------------------------------------------------- the richer finish (a trial)
//
// Roi, of the first sheet: "too cartoony no?" — a heavy black outline round flat colour. Here instead: a thin outline
// in the thing's own colour darkened, boards laid one by one each a little its own tone with grain and knots, metal
// and cloth painted as what they are.
//
// And of the second: "the decorations should integrate seamlessly with all our engines, so light reflecting from
// surfaces etc shadows etc". So nothing here paints light from a side, nor a shadow on the floor: the sun moves and a
// torch stands anywhere, and a highlight painted at the top left is wrong for both. The picture holds colour, grain
// and the dark of its crevices only. Beside it a second picture is painted (`o.maps`): how high each part stands
// (red) and how much it shines (green). The engines light the piece from those (decor-lit.mjs), and cast its shadows
// from its outline and its height as they do every decoration's.

// The outline: thin, in the thing's own colour darkened — never a black line round it. (Roi, of the bold black
// one tried after: "whats with all these thick lines... i liked pass 2 direction better".)
// (o.line, a trial: the same thin line, but dark and sharp enough to hold a shape's edge by itself.)
// (And the smaller the shape, the softer and thinner its line: a pebble ringed in the dark line that suits a table
// reads as a bead. Roi asked that the pieces be checked for being cartoony; this was the commonest cause.)
const thinLine = (g, pts, sharp, base, o, w = 1) => { const small = o.line ? Math.min(1, Math.max(0, 1 - reach(pts) / (o.unit * 0.16))) : 0; pathOf(g, pts, sharp); g.strokeStyle = o.line ? mix(base, '#0c0904', 0.94 - small * 0.34) : mix(base, '#0c0904', 0.78); g.lineWidth = o.line ? Math.max(1.1 - small * 0.5, o.ink * w * (0.95 - small * 0.4)) : Math.max(0.8, o.ink * w); g.lineJoin = 'round'; g.stroke(); };
const SEAM = 'rgba(16,8,2,0.7)';
// The fine work (o.fine). Roi, of pieces that were sharp but still wrong: "something about the fidelity also feels
// off". Side by side with a hand-painted board at the same size, ours had eight grain lines and smooth paint between
// them; the hand-painted one had hundreds of hair-thin streaks, so that no part of it was empty. These are those:
// drawn a pixel wide whatever size the picture is painted at, so a picture painted finer holds more, not the same
// strokes larger. 'along' true for wood (streaks flowing the board's length, bending together), false for cloth and
// metal (short flecks any way).
const fineWork = (g, rng, p, hl, hw, { along = true, dark = '62,24,4', pale = '255,214,140', much = 1 } = {}) => {
  const n = Math.round(Math.min(2200, Math.max(40, (hl * hw * 4) / 24)) * much), f = 1.2 + rng() * 2.2, ph = rng() * 6.28, amp = hw * 0.05;
  g.lineCap = 'butt';
  for (let i = 0; i < n; i++) {
    const u = (rng() - 0.5) * hl * 2, v = (rng() - 0.5) * hw * 2, isDark = rng() < 0.64, a = isDark ? 0.08 + rng() * 0.26 : 0.06 + rng() * 0.18;
    g.strokeStyle = `rgba(${isDark ? dark : pale},${a})`; g.lineWidth = 0.5 + rng() * 0.7; g.beginPath();
    if (along) { const len = hl * (0.06 + rng() * rng() * 0.7), wave = (x) => Math.sin((x / hl) * f + ph) * amp, a0 = p(u, v + wave(u)), a1 = p(u + len * 0.5, v + wave(u + len * 0.5) + (rng() - 0.5) * 0.8), a2 = p(u + len, v + wave(u + len)); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); }
    else { const t = rng() * 6.283, len = 1.5 + rng() * 4, a0 = p(u, v); g.moveTo(a0[0], a0[1]); g.lineTo(a0[0] + Math.cos(t) * len, a0[1] + Math.sin(t) * len); }
    g.stroke();
  }
  // And long thin bands of slightly other colour, the board's own streakiness.
  if (along) for (let i = 0, k = 5 + Math.floor(rng() * 6); i < k; i++) { const v = (rng() - 0.5) * hw * 1.9; g.strokeStyle = rng() < 0.5 ? `rgba(${dark},${0.05 + rng() * 0.08})` : `rgba(${pale},${0.04 + rng() * 0.07})`; g.lineWidth = 1 + rng() * Math.max(1, hw * 0.16); g.beginPath(); const b0 = p(-hl, v), b1 = p(hl, v + (rng() - 0.5) * hw * 0.1); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke(); }
};
// The dark gathered under a part that stands over another: all round it, toward no side.
const under = (g, pts, o, a0 = 0.4) => { const r = reach(pts), a = o.line ? a0 * 0.8 : a0; g.save(); g.filter = `blur(${Math.max(0.6, r * 0.05)}px)`; pathOf(g, pts, false); g.fillStyle = `rgba(6,3,0,${a})`; g.fill(); g.restore(); };
// The second picture: a part's height (0 the floor, 1 the tallest a piece gets) and its shine (0 dull, 1 a mirror).
const mapsColour = (h, shine) => `rgb(${Math.round(Math.min(1, Math.max(0, h)) * 255)},${Math.round(Math.min(1, Math.max(0, shine)) * 255)},0)`;
const rel = (o, pts, sharp, h, shine = 0.07) => { const m = o.maps; if (!m) return; pathOf(m, pts, sharp); m.fillStyle = mapsColour(h, shine); m.fill(); };
const relRing = (o, r, w, h, shine) => { const m = o.maps; if (!m) return; m.beginPath(); m.arc(0, 0, r, 0, 6.283); m.strokeStyle = mapsColour(h, shine); m.lineWidth = w; m.stroke(); };
const relLine = (o, pts, w, h, shine = 0.15) => { const m = o.maps; if (!m) return; line(m, pts, mapsColour(h, shine), w, 'butt'); };
// A part that swells: high in its middle, falling away to its edge.
const relDome = (o, pts, cx, cy, r, edge, top, shine = 0.05) => { const m = o.maps; if (!m) return; m.save(); pathOf(m, pts, false); m.clip(); const gr = m.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, mapsColour(top, shine)); gr.addColorStop(1, mapsColour(edge, shine)); m.fillStyle = gr; m.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); m.restore(); };
// One board: its own tone, grain running along it and bending round a knot, dark where it meets the next.
const plank = (g, rng, o, cx, cy, hl, hw, a, base, h = 0.5) => {
  // (Each board a little its own wood: lighter or darker, warmer or cooler than the one beside it.)
  const p = at(a, cx, cy), pts = [p(-hl, -hw), p(hl, -hw), p(hl, hw), p(-hl, hw)], tone = varied(hexOf(shade(base, (rng() - 0.5) * 0.18)), rng, 1.3);
  g.save(); pathOf(g, pts, true); g.fillStyle = tone; g.fill(); g.clip();
  // (o.form, a trial) Painted a little round: darker into both its long edges, paler along its middle. The same on
  // both sides: the board's own shape, not light from anywhere.
  if (o.form) { const e0 = p(0, -hw), e1 = p(0, hw), gr = g.createLinearGradient(e0[0], e0[1], e1[0], e1[1]); gr.addColorStop(0, 'rgba(24,10,0,0.38)'); gr.addColorStop(0.28, 'rgba(24,10,0,0.04)'); gr.addColorStop(0.5, 'rgba(255,228,170,0.17)'); gr.addColorStop(0.72, 'rgba(24,10,0,0.04)'); gr.addColorStop(1, 'rgba(24,10,0,0.38)'); g.fillStyle = gr; g.fillRect(cx - (hl + hw) * 2, cy - (hl + hw) * 2, (hl + hw) * 4, (hl + hw) * 4); }
  // Brushed on, not poured: soft patches of lighter and darker paint along it.
  g.filter = `blur(${Math.max(1, hw * 0.45)}px)`;
  for (let i = 0, n = 3 + Math.floor(rng() * 4); i < n; i++) { const c = p((rng() - 0.5) * hl * 2, (rng() - 0.5) * hw * 1.4); g.fillStyle = rng() < 0.5 ? `rgba(255,226,170,${0.1 + rng() * 0.14})` : `rgba(26,12,2,${0.12 + rng() * 0.16})`; g.beginPath(); g.ellipse(c[0], c[1], hl * (0.12 + rng() * 0.25), hw * (0.4 + rng() * 0.5), a, 0, 6.283); g.fill(); }
  g.filter = 'none';
  const knot = rng() < 0.35 ? [(rng() - 0.5) * hl * 1.4, (rng() - 0.5) * hw * 1.1, hw * (0.14 + rng() * 0.12)] : null;
  const n = Math.max(3, Math.round((hw * 2) / Math.max(1.6, o.unit * 0.02)));
  for (let i = 0; i < n; i++) {
    const v0 = -hw + ((i + rng()) / n) * 2 * hw, f = 1.5 + rng() * 2.5, ph = rng() * 6.28, amp = hw * 0.07 * (0.4 + rng()), line1 = [];
    for (let k = 0; k <= 12; k++) { const u = -hl + (k / 12) * 2 * hl; let v = v0 + Math.sin((u / hl) * f + ph) * amp; if (knot) { const d = Math.hypot(u - knot[0], v - knot[1]), R = knot[2] * 2.8; if (d < R) v += Math.sign(v - knot[1] || 1) * (R - d) * 0.6; } line1.push(p(u, v)); }
    line(g, line1, rng() < 0.7 ? `rgba(30,16,4,${0.1 + rng() * 0.2})` : `rgba(255,232,190,${0.07 + rng() * 0.12})`, Math.max(0.5, o.ink * (0.35 + rng() * 0.55)));
  }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(cx * 13 + cy * 7 + hl * 3 + hw * 31)) >>> 0) + 5), p, hl, hw);
  if (knot) { const c = p(knot[0], knot[1]); g.fillStyle = 'rgba(28,14,4,0.6)'; g.beginPath(); g.ellipse(c[0], c[1], knot[2] * 1.3, knot[2] * 0.8, a, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(28,14,4,0.35)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.beginPath(); g.ellipse(c[0], c[1], knot[2] * 2, knot[2] * 1.3, a, 0, 6.283); g.stroke(); }
  for (const v of [-hw, hw]) line(g, [p(-hl, v), p(hl, v)], 'rgba(8,4,0,0.3)', Math.max(0.8, o.ink * 1.2), 'butt');
  for (const u of [-hl, hl]) line(g, [p(u, -hw), p(u, hw)], 'rgba(8,4,0,0.28)', Math.max(1, hw * 0.3), 'butt');
  // Its edges worn pale where hands and things have rubbed them, in short broken strokes.
  for (let i = 0, n = 4 + Math.floor(rng() * 5); i < n; i++) { const v = (rng() < 0.5 ? -1 : 1) * hw * (0.84 + rng() * 0.08), u = (rng() - 0.5) * hl * 1.9, len = hl * (0.04 + rng() * 0.16); line(g, [p(u, v), p(u + len, v)], `rgba(255,236,200,${0.22 + rng() * 0.22})`, Math.max(0.6, o.ink * (0.6 + rng() * 0.5))); }
  // Split in from its ends as boards do.
  const cracks = [];
  for (const end of [-1, 1]) for (let i = 0, n = Math.floor(rng() * 2.4); i < n; i++) { const v = (rng() - 0.5) * hw * 1.4, len = hl * (0.08 + rng() * 0.22), c = [p(end * hl, v), p(end * (hl - len * 0.5), v + (rng() - 0.5) * hw * 0.16), p(end * (hl - len), v + (rng() - 0.5) * hw * 0.1)]; line(g, c, 'rgba(14,6,0,0.7)', Math.max(0.6, o.ink * 0.75)); cracks.push(c); }
  g.restore();
  pathOf(g, pts, true); g.strokeStyle = o.line || o.warm ? 'rgba(16,7,0,0.94)' : SEAM; g.lineWidth = o.line ? Math.max(0.9, o.ink * 0.8) : Math.max(0.6, o.ink * 0.7); g.stroke();
  // In the second picture: the board at its height, the joins round it a little lower, so light catches each board's edge.
  rel(o, pts, true, h); for (const c of cracks) relLine(o, c, Math.max(1, o.ink * 1.2), h - 0.1, 0.05); if (o.maps) { pathOf(o.maps, pts, true); o.maps.strokeStyle = mapsColour(h - 0.03, 0.05); o.maps.lineWidth = Math.max(1, o.ink * 1.4); o.maps.stroke(); }
  return pts;
};
// A cushion with some body: paler where it swells, dark into its edges, piped, tufted at a button.
const pad = (g, rng, o, cx, cy, w, h, a, pal, low = 0.45) => {
  const p = at(a, cx, cy), n = 24, pts = Array.from({ length: n }, (_, i) => { const t = (i / n) * 6.283, k = 1 / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))) ** 0.6; return p(Math.cos(t) * w * k * 0.92, Math.sin(t) * h * k * 0.92); }), R = Math.max(w, h);
  under(g, pts, o, 0.45);
  g.save(); pathOf(g, pts, false); g.fillStyle = pal.cloth; g.fill(); g.clip();
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1); gr.addColorStop(0, o.form ? 'rgba(255,240,220,0.3)' : 'rgba(255,240,220,0.16)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, o.form ? 'rgba(8,4,0,0.62)' : 'rgba(8,4,0,0.5)'); g.fillStyle = gr; g.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);
  // (More detail) A pattern woven into it: a lattice of paler thread, a dark knot where the threads cross.
  if (o.detail) {
    const step = Math.min(w, h) * 0.5, far = (w + h) * 1.5;
    for (let k = -4; k <= 4; k++) for (const dir of [1, -1]) line(g, [p(k * step - far, -far * dir), p(k * step + far, far * dir)], mix(pal.cloth, '#f4ead0', 0.45).replace('rgb', 'rgba').replace(')', ',0.34)'), Math.max(0.5, o.ink * 0.5));
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { if ((i + j) % 2) continue; const c = p(i * step * 0.5, j * step * 0.5); disc(g, c[0], c[1], Math.max(0.5, o.ink * 0.42), mix(pal.cloth, '#0c0904', 0.4)); }
  }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(cx * 13 + cy * 7 + w * 3)) >>> 0) + 9), p, w, h, { along: false, dark: '10,6,2', pale: '255,244,225', much: 1.6 });
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line(g, [p(u * w * 0.1, v * h * 0.1), p(u * w * 0.45, v * h * 0.42 + (rng() - 0.5) * h * 0.1), p(u * w * 0.8, v * h * 0.76)], 'rgba(8,4,0,0.22)', Math.max(0.6, o.ink * 0.9));
  pathOf(g, pts.map(([x, y]) => [cx + (x - cx) * 0.84, cy + (y - cy) * 0.84]), false); g.strokeStyle = mix(pal.cloth, '#0c0904', 0.45); g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke();
  g.restore();
  // Stitched round inside its piping, in a paler thread.
  pathOf(g, pts.map(([x, y]) => [cx + (x - cx) * 0.74, cy + (y - cy) * 0.74]), false); g.strokeStyle = 'rgba(255,240,215,0.4)'; g.lineWidth = Math.max(0.5, o.ink * 0.55); g.setLineDash([o.ink * 2.2, o.ink * 1.8]); g.stroke(); g.setLineDash([]);
  disc(g, cx, cy, Math.max(1, R * 0.09), mix(pal.cloth, '#0c0904', 0.5)); disc(g, cx, cy, Math.max(0.6, R * 0.05), pal.clothLit);
  thinLine(g, pts, false, pal.cloth, o, 1);
  // A tassel at each corner, in the cloth's own colour paled.
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const c = p(u * w * 0.86, v * h * 0.86), r = Math.max(1, R * 0.085); disc(g, c[0], c[1], r, pal.clothLit); ring(g, c[0], c[1], r, mix(pal.cloth, '#0c0904', 0.7), Math.max(0.5, o.ink * 0.7)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], r, 0, 6.283); o.maps.fillStyle = mapsColour(low + 0.1, 0.05); o.maps.fill(); } }
  relDome(o, pts, cx, cy, R * 1.05, low, low + 0.2); if (o.maps) { o.maps.beginPath(); o.maps.arc(cx, cy, Math.max(1, R * 0.12), 0, 6.283); o.maps.fillStyle = mapsColour(low + 0.08, 0.05); o.maps.fill(); }
  return pts;
};
// A metal hoop: its band, dark at both its edges. What it catches of the light is the engines' to add.
const hoop = (g, o, r, w, pal, h) => { ring(g, 0, 0, r, pal.metal, w); ring(g, 0, 0, r + w / 2, 'rgba(8,4,0,0.6)', Math.max(0.5, o.ink * 0.6)); ring(g, 0, 0, r - w / 2, 'rgba(8,4,0,0.6)', Math.max(0.5, o.ink * 0.6)); relRing(o, r, w, h, 0.9); };
// A nail's head: dull dark metal in the picture, a bright raised point in the second.
const stud = (g, o, x, y, r, pal, h) => { disc(g, x, y, r, pal.metalDark); disc(g, x, y, r * 0.55, pal.metal); if (o.maps) { o.maps.beginPath(); o.maps.arc(x, y, r, 0, 6.283); o.maps.fillStyle = mapsColour(h, 0.9); o.maps.fill(); } };

const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
// An iron plate: mottled, flecked, thin-lined, standing a little proud and shining.
const plate = (g, o, pts, pal, h) => {
  const c = centre(pts), r = reach(pts, c), dr = seeded((Math.abs(Math.round(c[0] * 7 + c[1] * 3 + r * 5)) >>> 0) + 11);
  pathOf(g, pts, true); g.fillStyle = pal.metal; g.fill();
  g.save(); pathOf(g, pts, true); g.clip();
  for (let i = 0; i < 6; i++) { g.fillStyle = dr() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(60,26,8,0.28)'; g.beginPath(); g.arc(c[0] + (dr() - 0.5) * r * 1.6, c[1] + (dr() - 0.5) * r * 1.6, r * 0.22, 0, 6.283); g.fill(); }
  if (o.fine) fineWork(g, dr, at(0, c[0], c[1]), r, r, { along: false, dark: '14,14,16', pale: '255,255,255', much: 0.8 });
  g.restore(); thinLine(g, pts, true, pal.metal, o, 0.9); rel(o, pts, true, h, 0.85);
};
// A round top of boards: so many across it, cut to the circle.
const roundBoards = (g, rng, o, cx, cy, R, a, base, h, n = 5) => {
  const w = R / n, p = at(a, cx, cy);
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.clip(); if (o.maps) { o.maps.save(); o.maps.beginPath(); o.maps.arc(cx, cy, R, 0, 6.283); o.maps.clip(); }
  for (let k = -(n - 1); k <= n - 1; k += 2) plank(g, rng, o, ...p(0, k * w), R, w, a, base, h);
  g.restore(); o.maps?.restore();
};
// Where mugs have stood: a ring or three, each not quite closed.
const mugRings = (g, rng, o, p, hl, hw, clip, sharp) => { g.save(); pathOf(g, clip, sharp); g.clip(); for (let i = 0, n = 1 + Math.floor(rng() * 3); i < n; i++) { const c = p((rng() - 0.5) * hl * 1.6, (rng() - 0.5) * hw * 1.5), r = o.unit * (0.07 + rng() * 0.03), t = rng() * 6; g.beginPath(); g.arc(c[0], c[1], r, t, t + 3.5 + rng() * 2.7); g.strokeStyle = `rgba(22,9,0,${0.16 + rng() * 0.14})`; g.lineWidth = Math.max(0.8, o.unit * 0.012); g.stroke(); } g.restore(); };

// An oval's outline (pure).
const oval = (cx, cy, rx, ry, a, n = 36) => { const p = at(a, cx, cy); return Array.from({ length: n }, (_, i) => { const t = (i / n) * 6.283; return p(Math.cos(t) * rx, Math.sin(t) * ry); }); };
// Cloth laid flat: its dye, flecked with thread, darker into its edges, creased along its folds.
const clothFlat = (g, o, pts, sharp, colour, h, folds = []) => {
  const c = centre(pts), r = reach(pts, c);
  pathOf(g, pts, sharp); g.fillStyle = colour; g.fill();
  g.save(); pathOf(g, pts, sharp); g.clip();
  const gr = g.createRadialGradient(c[0], c[1], r * 0.3, c[0], c[1], r * 1.05); gr.addColorStop(0, 'rgba(255,244,225,0.08)'); gr.addColorStop(1, 'rgba(8,4,0,0.34)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
  // Its weave: thread over thread both ways, a few pixels apart whatever size it is painted.
  if (o.fine) { const gap = Math.max(2.2, o.unit * 0.011), wt = (pts.length > 1 ? Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) : 0), q = at(wt, c[0], c[1]); g.lineCap = 'butt'; for (let v = -r; v <= r; v += gap) { g.strokeStyle = 'rgba(10,6,2,0.085)'; g.lineWidth = 0.7; g.beginPath(); const a0 = q(-r, v), a1 = q(r, v); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); g.strokeStyle = 'rgba(255,244,225,0.06)'; g.beginPath(); const b0 = q(v, -r), b1 = q(v, r); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke(); } }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(c[0] * 5 + c[1] * 9 + r)) >>> 0) + 21), at(0, c[0], c[1]), r, r, { along: false, dark: '10,6,2', pale: '255,244,225', much: 0.9 });
  // Its folds: soft, a valley of shade and a crest of pale beside it (both sides alike down its length — the cloth's
  // own lie, not light from anywhere), and the fine line of the crease itself.
  if (folds.length) { const fw = Math.max(2, r * 0.07); g.filter = `blur(${Math.max(1, fw * 0.5)}px)`; for (const f of folds) { line(g, f, 'rgba(8,4,0,0.22)', fw); line(g, f.map(([x, y]) => [x + fw * 0.9, y + fw * 0.5]), 'rgba(255,246,228,0.16)', fw * 0.8); line(g, f.map(([x, y]) => [x - fw * 0.9, y - fw * 0.5]), 'rgba(255,246,228,0.12)', fw * 0.7); } g.filter = 'none'; }
  for (const f of folds) { line(g, f, 'rgba(8,4,0,0.24)', Math.max(0.6, o.ink * 0.7)); }
  g.restore(); thinLine(g, pts, sharp, colour, o, 1); rel(o, pts, sharp, h, 0.03);
  // (For the wind: cloth marks itself on the cloth mask, where the piece is one the wind moves.)
  if (o.clothMask) { pathOf(o.clothMask, pts, sharp); o.clothMask.fillStyle = '#fff'; o.clothMask.fill(); }
};
// Still water in something: dark, darker under its rim all round, a few thin ripples on it.
const water = (g, rng, o, pts, sharp, h = 0.2) => {
  const c = centre(pts), r = reach(pts, c);
  pathOf(g, pts, sharp); g.fillStyle = '#22323c'; g.fill();
  g.save(); pathOf(g, pts, sharp); g.clip();
  const gr = g.createRadialGradient(c[0], c[1], r * 0.3, c[0], c[1], r * 1.02); gr.addColorStop(0, 'rgba(120,160,175,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
  for (let i = 0; i < 6; i++) { const x = c[0] + (rng() - 0.5) * r * 1.3, y = c[1] + (rng() - 0.5) * r * 0.9, w = r * (0.12 + rng() * 0.26); line(g, [[x - w, y], [x, y + (rng() - 0.5) * r * 0.04], [x + w, y]], 'rgba(190,220,230,0.17)', Math.max(0.6, o.ink * 0.6)); }
  g.restore(); rel(o, pts, sharp, h, 0.3);
  if (o.frozen) iceOver(g, rng, o, pts, sharp);
};
// A turned post seen end on: rings within rings.
const post = (g, o, c, r, pal, h) => { disc(g, c[0], c[1], r, pal.woodDark); disc(g, c[0], c[1], r * 0.62, shade(pal.wood, 0.1)); disc(g, c[0], c[1], r * 0.26, pal.woodDark); ring(g, c[0], c[1], r * 0.62, 'rgba(16,8,2,0.6)', Math.max(0.5, o.ink * 0.6)); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, h - 0.12, h, 0.25); };

// The cut end of a log: pale heartwood inside its bark, its growth rings, a check split in from its edge.
const cutEnd = (g, rng, o, c, rx, ry, a, pal, h) => {
  const face = oval(c[0], c[1], rx, ry, a, 18), heart = hexOf(shade(pal.wood, 0.22));
  pathOf(g, face, false); g.fillStyle = heart; g.fill();
  for (const k of [0.72, 0.44, 0.2]) { const r = oval(c[0], c[1], rx * k, ry * k, a, 14); r.push(r[0]); line(g, r, 'rgba(60,30,8,0.4)', Math.max(0.5, o.ink * 0.5)); }
  const q = at(a + rng() * 6.28, c[0], c[1]); line(g, [q(0, 0), q(Math.min(rx, ry) * 0.9, 0)], 'rgba(30,14,2,0.6)', Math.max(0.5, o.ink * 0.6));
  thinLine(g, face, false, pal.wood, o, 0.8); rel(o, face, false, h, 0.1);
};
// A stump's or a block's top: bark round it, ring inside ring, checks running out from its heart, axe scars.
const stumpTop = (g, rng, o, cx, cy, R, a, pal, h) => {
  const out = circle(cx, cy, R, 36).map(([x, y], i) => [x + Math.sin(i * 1.7 + a) * R * 0.025, y + Math.cos(i * 2.3 + a) * R * 0.025]), bark = hexOf(mix(pal.wood, '#3a2a1c', 0.65)), heart = hexOf(shade(pal.wood, 0.16));
  pathOf(g, out, false); g.fillStyle = bark; g.fill(); disc(g, cx, cy, R * 0.9, heart);
  g.save(); g.beginPath(); g.arc(cx, cy, R * 0.9, 0, 6.283); g.clip();
  const gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 0.92); gr.addColorStop(0, 'rgba(60,26,6,0.22)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,18,4,0.4)'); g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (let k = 1; k <= 9; k++) { const r = circle(cx + Math.sin(k) * R * 0.02, cy + Math.cos(k * 1.3) * R * 0.02, R * 0.09 * k * (0.95 + rng() * 0.1), 28); r.push(r[0]); line(g, r, `rgba(70,34,8,${0.22 + rng() * 0.25})`, Math.max(0.5, o.ink * (0.4 + rng() * 0.4))); }
  for (let i = 0; i < 5; i++) { const t = a + i * 1.26 + rng() * 0.5, r1 = R * (0.5 + rng() * 0.38); line(g, [[cx + Math.cos(t) * R * 0.06, cy + Math.sin(t) * R * 0.06], [cx + Math.cos(t + 0.06) * r1 * 0.6, cy + Math.sin(t + 0.06) * r1 * 0.6], [cx + Math.cos(t) * r1, cy + Math.sin(t) * r1]], 'rgba(26,10,0,0.7)', Math.max(0.6, o.ink * 0.8)); }
  for (let i = 0; i < 7; i++) { const t = rng() * 6.283, d = rng() * R * 0.7, k = rng() * 3.14, len = R * (0.1 + rng() * 0.22), c = [cx + Math.cos(t) * d, cy + Math.sin(t) * d]; line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], 'rgba(26,10,0,0.5)', Math.max(0.6, o.ink * 0.7)); line(g, [[c[0] + o.ink * 0.8, c[1] + o.ink * 0.8], [c[0] + Math.cos(k) * len + o.ink * 0.8, c[1] + Math.sin(k) * len + o.ink * 0.8]], 'rgba(255,232,190,0.3)', Math.max(0.5, o.ink * 0.5)); }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(cx * 3 + cy * 5 + R)) >>> 0) + 31), at(a, cx, cy), R, R, { along: false, much: 0.7 });
  g.restore();
  ring(g, cx, cy, R * 0.9, 'rgba(16,7,0,0.85)', Math.max(0.7, o.ink * 0.8)); thinLine(g, out, false, pal.wood, o, 1.2);
  rel(o, out, false, h - 0.05, 0.05); if (o.maps) { o.maps.beginPath(); o.maps.arc(cx, cy, R * 0.9, 0, 6.283); o.maps.fillStyle = mapsColour(h, 0.1); o.maps.fill(); }
};

// Stone, as it is painted here: a grey a little its own, mottled, flecked, dark into its edges, sometimes cracked.
const STONE = '#8a867e';
const stonePoly = (g, rng, o, pts, sharp, tone0, h) => {
  const tone = o.cave ? hexOf(mix(tone0, '#46444a', 0.4)) : tone0, c = centre(pts), r = reach(pts, c), col = varied(tone, rng, 1.4);
  pathOf(g, pts, sharp); g.fillStyle = col; g.fill();
  g.save(); pathOf(g, pts, sharp); g.clip();
  const gr = g.createRadialGradient(c[0], c[1], r * 0.3, c[0], c[1], r * 1.05); gr.addColorStop(0, 'rgba(255,250,240,0.1)'); gr.addColorStop(1, 'rgba(10,8,6,0.52)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
  for (let i = 0; i < 5; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,250,240,0.07)' : 'rgba(0,0,0,0.08)'; g.beginPath(); g.ellipse(c[0] + (rng() - 0.5) * r, c[1] + (rng() - 0.5) * r, r * (0.2 + rng() * 0.3), r * (0.15 + rng() * 0.2), rng() * 3, 0, 6.283); g.fill(); }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(c[0] * 11 + c[1] * 7 + r * 3)) >>> 0) + 41), at(0, c[0], c[1]), r, r, { along: false, dark: '20,20,22', pale: '255,255,250', much: 1 });
  if (rng() < 0.45) { const t = rng() * 6.283; line(g, [[c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r], [c[0] + Math.cos(t + 0.3) * r * 0.5, c[1] + Math.sin(t + 0.3) * r * 0.5], [c[0] + Math.cos(t + 0.1) * r * 0.15, c[1] + Math.sin(t + 0.1) * r * 0.15]], 'rgba(16,14,12,0.6)', Math.max(0.5, o.ink * 0.6)); }
  // The mason's tool on it: short strokes side by side, in a patch here and there.
  for (let i = 0; i < 3; i++) { const t = rng() * 3.14, cc = [c[0] + (rng() - 0.5) * r, c[1] + (rng() - 0.5) * r], ct = Math.cos(t), st = Math.sin(t); for (let k = -2; k <= 2; k++) { const off = k * r * 0.055, len = r * (0.07 + rng() * 0.06); line(g, [[cc[0] - st * off - ct * len, cc[1] + ct * off - st * len], [cc[0] - st * off + ct * len, cc[1] + ct * off + st * len]], k % 2 ? 'rgba(10,8,6,0.2)' : 'rgba(255,252,240,0.14)', 0.6 + rng() * 0.5); } }
  // Pits, and a corner knocked off.
  for (let i = 0, np = Math.round(5 + r * 0.22); i < np; i++) disc(g, c[0] + (rng() - 0.5) * r * 1.6, c[1] + (rng() - 0.5) * r * 1.6, 0.5 + rng() * 1.1, 'rgba(8,6,4,0.42)');
  { const v = pts[Math.floor(rng() * pts.length)], k = 0.22 + rng() * 0.14, w = [v[0] + (c[0] - v[0]) * k, v[1] + (c[1] - v[1]) * k]; pathOf(g, [v, [w[0] + r * 0.14, w[1] - r * 0.04], [w[0] - r * 0.04, w[1] + r * 0.14]], true); g.fillStyle = 'rgba(255,252,240,0.18)'; g.fill(); line(g, [[w[0] + r * 0.14, w[1] - r * 0.04], [w[0] - r * 0.04, w[1] + r * 0.14]], 'rgba(10,8,6,0.4)', Math.max(0.5, o.ink * 0.5)); }
  g.restore(); thinLine(g, pts, sharp, col, o, 1.1); rel(o, pts, sharp, h, 0.12);
  return col;
};
// A loose stone: a lump, highest in its middle.
const stoneLump = (g, rng, o, cx, cy, rx, ry, turn, tone, h) => rockForm(g, rng, o, cx, cy, rx, ry, turn, tone, h, 8);
// A dressed block: a box whose corners are each a little off true.
const blockAt = (rng, cx, cy, hw, hh, a, j) => boxAt(cx, cy, hw, hh, a).map(([x, y]) => [x + (rng() - 0.5) * j * 2, y + (rng() - 0.5) * j * 2]);
// Cold ash: a grey bed, paler in drifts, flecked with charcoal.
const ashBed = (g, rng, o, cx, cy, R, wide = 1) => {
  const pts = blob(rng, cx, cy, R * wide, R, 14, 0.14);
  pathOf(g, pts, false); g.fillStyle = '#4c4844'; g.fill();
  g.save(); pathOf(g, pts, false); g.clip();
  for (let i = 0; i < 9; i++) { g.fillStyle = rng() < 0.6 ? `rgba(170,166,158,${0.3 + rng() * 0.35})` : `rgba(20,16,14,${0.3 + rng() * 0.3})`; g.beginPath(); g.ellipse(cx + (rng() - 0.5) * R * 1.5 * wide, cy + (rng() - 0.5) * R * 1.4, R * (0.12 + rng() * 0.24), R * (0.08 + rng() * 0.16), rng() * 3, 0, 6.283); g.fill(); }
  for (let i = 0; i < 60; i++) disc(g, cx + (rng() - 0.5) * R * 1.8 * wide, cy + (rng() - 0.5) * R * 1.8, Math.max(0.5, R * (0.012 + rng() * 0.02)), rng() < 0.5 ? 'rgba(16,12,10,0.8)' : 'rgba(214,210,200,0.7)');
  g.restore(); rel(o, pts, false, 0.05, 0.03);
};
// A log burnt black: charcoal, checked across into squares, grey with ash along it.
const charLog = (g, rng, o, cx, cy, hl, hw, a) => {
  const p = at(a, cx, cy), n = 6, ragged = (e) => Array.from({ length: n }, (_, k) => p(e * hl * (1 - rng() * 0.12), (-1 + (2 * k) / (n - 1)) * hw)), pts = [...ragged(-1), ...ragged(1).reverse()];
  under(g, pts, o, 0.3); pathOf(g, pts, true); g.fillStyle = '#211b17'; g.fill();
  g.save(); pathOf(g, pts, true); g.clip();
  for (let u = -hl; u < hl; u += hw * (0.9 + rng() * 1.6)) line(g, [p(u, -hw), p(u + (rng() - 0.5) * hw * 1.1, (0.2 + rng() * 0.8) * hw)], 'rgba(150,146,138,0.2)', Math.max(0.5, o.ink * 0.45));
  line(g, [p(-hl, (rng() - 0.5) * hw), p(0, (rng() - 0.5) * hw * 0.6), p(hl, (rng() - 0.5) * hw)], 'rgba(150,146,138,0.18)', Math.max(0.5, o.ink * 0.45));
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(176,172,164,0.3)'; g.beginPath(); const c = p((rng() - 0.5) * hl * 1.6, (rng() - 0.5) * hw); g.ellipse(c[0], c[1], hl * 0.14, hw * 0.4, a, 0, 6.283); g.fill(); }
  g.restore(); thinLine(g, pts, true, '#211b17', o, 0.9); rel(o, pts, true, 0.2, 0.05);
};
// Live coals in a bowl: fire showing in the gaps between black lumps. (The light they give is the engines' to cast.)
const coalBed = (g, rng, o, cx, cy, R) => {
  disc(g, cx, cy, R, '#e2701e'); g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.clip();
  { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, 'rgba(255,214,110,0.75)'); gr.addColorStop(0.6, 'rgba(226,100,24,0.2)'); gr.addColorStop(1, 'rgba(90,20,6,0.7)'); g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2); }
  for (let i = 0; i < 26; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * R * 0.95, c = [cx + Math.cos(t) * d, cy + Math.sin(t) * d], r = R * (0.13 + rng() * 0.1), lump = blob(rng, c[0], c[1], r, r * 0.8, 7, 0.25); pathOf(g, lump, true); g.fillStyle = rng() < 0.25 ? '#4a3a34' : '#1c1614'; g.fill(); pathOf(g, lump, true); g.strokeStyle = 'rgba(8,4,2,0.9)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); if (rng() < 0.4) { pathOf(g, [lump[0], lump[1], lump[2], c], true); g.fillStyle = 'rgba(190,186,178,0.3)'; g.fill(); } }
  g.restore(); if (o.maps) { o.maps.beginPath(); o.maps.arc(cx, cy, R, 0, 6.283); o.maps.fillStyle = mapsColour(0.5, 0.05); o.maps.fill(); }
};

// Straw and hay: a dull gold ground, and stalk on stalk lying mostly one way across it.
const STRAW = '#c9aa5a';
const strawOn = (g, rng, o, pts, sharp, a, n) => {
  const c = centre(pts), r = reach(pts, c);
  pathOf(g, pts, sharp); g.fillStyle = mix(STRAW, '#5a4418', 0.5); g.fill();
  g.save(); pathOf(g, pts, sharp); g.clip();
  for (let i = 0; i < n; i++) { const x = c[0] + (rng() - 0.5) * r * 2, y = c[1] + (rng() - 0.5) * r * 2, k = a + (rng() - 0.5) * 0.9, len = r * (0.1 + rng() * 0.3), tone = rng(); line(g, [[x, y], [x + Math.cos(k) * len, y + Math.sin(k) * len]], tone < 0.25 ? 'rgba(70,50,14,0.55)' : tone < 0.8 ? varied(STRAW, rng, 1.8) : '#ecdc9c', 0.7 + rng() * 1.1); }
  const gr = g.createRadialGradient(c[0], c[1], r * 0.4, c[0], c[1], r * 1.05); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,18,4,0.4)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
  g.restore(); thinLine(g, pts, sharp, STRAW, o, 1);
};
// ---- What the world's conditions do to a piece. Roi: "make sure ... it supports season, weather, light and shadow
// engines". The old painters ask the season fifty times and the snow thirty; a piece that ignored them would stand
// summer-green in a winter scene. These are asked by the pieces below and by paintKitPiece after them.
//
// A green as the season has it: fresher in spring, turned in autumn, dead straw in winter.
const inSeason = (o, hex) => (o.season === 'autumn' ? hexOf(mix(hex, '#b0802a', 0.6)) : o.season === 'winter' ? hexOf(mix(hex, '#8a7e62', 0.66)) : o.season === 'spring' ? hexOf(mix(hex, '#8cc03c', 0.22)) : hex);
// Ice over still water: pale, clouded, cracked.
const iceOver = (g, rng, o, pts, sharp) => {
  const c = centre(pts), r = reach(pts, c), dr = seeded((Math.abs(Math.round(c[0] * 3 + c[1] * 5 + r)) >>> 0) + 71);
  g.save(); pathOf(g, pts, sharp); g.clip(); g.fillStyle = 'rgba(206,226,236,0.82)'; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
  g.filter = `blur(${Math.max(1, r * 0.08)}px)`; for (let i = 0; i < 6; i++) { g.fillStyle = dr() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(120,150,170,0.3)'; g.beginPath(); g.ellipse(c[0] + (dr() - 0.5) * r * 1.4, c[1] + (dr() - 0.5) * r * 1.4, r * (0.15 + dr() * 0.3), r * (0.1 + dr() * 0.2), dr() * 3, 0, 6.283); g.fill(); } g.filter = 'none';
  for (let i = 0; i < 5; i++) { const t = dr() * 6.283, from = [c[0] + (dr() - 0.5) * r * 0.6, c[1] + (dr() - 0.5) * r * 0.6], crack = [from]; let p = from; for (let k = 0; k < 4; k++) { p = [p[0] + Math.cos(t + (dr() - 0.5)) * r * 0.24, p[1] + Math.sin(t + (dr() - 0.5)) * r * 0.24]; crack.push(p); } line(g, crack, 'rgba(255,255,255,0.75)', Math.max(0.5, o.ink * 0.6)); }
  g.restore(); rel(o, pts, sharp, 0.03, 0.85);
};
// Growing things: a leaf, a tuft of leaves from one root, a five-petalled flower. Their line is soft — their own
// green darkened, and hair-thin: the dark line that holds a table's edge turns a blade of grass into a black stroke.
const softLine = (g, pts, sharp, green, o, w = 1) => { pathOf(g, pts, sharp); g.strokeStyle = mix(green, '#0c0904', 0.5); g.lineWidth = Math.max(0.5, o.ink * 0.45 * w); g.lineJoin = 'round'; g.stroke(); };
const GREEN = '#5d7a3a';
const leaf = (g, o, c, t, len, wid, green) => { const q = at(t, c[0], c[1]), pts = [q(0, 0), q(len * 0.4, -wid), q(len, 0), q(len * 0.4, wid)]; pathOf(g, pts, false); g.fillStyle = green; g.fill(); line(g, [q(len * 0.06, 0), q(len * 0.9, 0)], mix(green, '#0c0904', 0.36), Math.max(0.4, o.ink * 0.4)); softLine(g, pts, false, green, o); };
const tuft = (g, rng, o, cx, cy, r, green, h) => { const n = 7 + Math.floor(rng() * 4), t0 = rng() * 6.28; for (let i = 0; i < n; i++) leaf(g, o, [cx, cy], t0 + (i / n) * 6.283 + (rng() - 0.5) * 0.4, r * (0.75 + rng() * 0.35), r * (0.2 + rng() * 0.1), varied(green, rng, 1.8)); disc(g, cx, cy, r * 0.1, hexOf(shade(green, -0.45))); relDome(o, circle(cx, cy, r), cx, cy, r, h * 0.6, h, 0.1); };
const flower = (g, rng, o, cx, cy, r, dye) => { const t0 = rng() * 6.28; if (o.season === 'winter') return; for (let i = 0; i < 5; i++) { const t = t0 + i * 1.257, c = [cx + Math.cos(t) * r * 0.55, cy + Math.sin(t) * r * 0.55]; disc(g, c[0], c[1], r * 0.42, dye); ring(g, c[0], c[1], r * 0.42, mix(dye, '#0c0904', 0.7), Math.max(0.4, o.ink * 0.4)); } disc(g, cx, cy, r * 0.3, '#e6c04a'); };
// The second picture of something in two slopes to a ridge: low at both eaves, stepping up to the ridge along its middle.
const ridgeRel = (o, p, hl, hw, a, lo, hi, n0 = 4) => { const n = Math.max(16, n0); for (const side of [-1, 1]) for (let k = 0; k < n; k++) rel(o, boxAt(...p(0, side * hw * (1 - (k + 0.5) / n)), hl, (hw / (2 * n)) * 1.05, a), true, lo + ((hi - lo) * (k + 0.5)) / n, 0.04); };

// A line cut into stone or wood: dark in the cut, pale along the lip of it, and lower in the second picture.
const cutLine = (g, o, pts, h) => { const w = Math.max(0.8, o.ink); line(g, pts, 'rgba(20,16,12,0.62)', w); line(g, pts.map(([x, y]) => [x + w * 0.7, y + w * 0.7]), 'rgba(255,248,232,0.26)', Math.max(0.5, w * 0.55)); relLine(o, pts, Math.max(1, o.ink * 1.3), h - 0.08, 0.05); };
// The top of a squared post: end grain, a ring or two in it, a check across.
const postEnd = (g, rng, o, c, r, a, pal, h) => {
  const b = boxAt(c[0], c[1], r, r, a), q = at(a, c[0], c[1]);
  under(g, b, o, 0.35); pathOf(g, b, true); g.fillStyle = varied(hexOf(shade(pal.wood, 0.12)), rng, 1.2); g.fill();
  for (const k of [0.62, 0.3]) { const in1 = boxAt(c[0], c[1], r * k, r * k, a + 0.1); pathOf(g, in1, false); g.strokeStyle = 'rgba(60,30,8,0.4)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); }
  line(g, [q(-r * 0.1, 0), q(r * 0.9, r * (rng() - 0.5))], 'rgba(30,14,2,0.6)', Math.max(0.5, o.ink * 0.6));
  thinLine(g, b, true, pal.wood, o, 1); rel(o, b, true, h, 0.1);
};

// A small round thing (a fruit, a cabbage) painted round: its colour, paler where it swells, dark into its edge.
const roundBody = (g, o, c, r, col) => { disc(g, c[0], c[1], r, col); const gr = g.createRadialGradient(c[0], c[1], r * 0.1, c[0], c[1], r); gr.addColorStop(0, 'rgba(255,246,225,0.26)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,8,0,0.5)'); g.beginPath(); g.arc(c[0], c[1], r, 0, 6.283); g.fillStyle = gr; g.fill(); };
// A long bone lying: its shaft, a knuckle at each end.
const bone = (g, o, A, B, w, h) => { line(g, [A, B], 'rgba(50,36,20,0.9)', Math.max(1.6, w * 1.7)); line(g, [A, B], '#ded2b6', Math.max(0.9, w)); for (const c of [A, B]) { disc(g, c[0], c[1], w * 1.1, '#ded2b6'); ring(g, c[0], c[1], w * 1.1, 'rgba(50,36,20,0.8)', Math.max(0.4, o.ink * 0.5)); } relLine(o, [A, B], Math.max(1.4, w * 1.5), h, 0.1); };

// A rock with some shape to it: a ragged outline, a flat on top, and between them faces each its own tone. Which face
// is lit is the engines' to say (the faces stand at a slope in the second picture); the tones here are the stone's.
const rockForm = (g, rng, o, cx, cy, rx, ry, turn, tone0, h, n = 11) => {
  const tone = o.cave ? hexOf(mix(tone0, '#46444a', 0.4)) : tone0, outer = blob(rng, cx, cy, rx, ry, n, 0.2, turn), col = varied(tone, rng, 1.4), r = Math.max(rx, ry), ox = cx + (rng() - 0.5) * rx * 0.36, oy = cy + (rng() - 0.5) * ry * 0.36, tiers = r > o.unit * 0.22 ? 5 : r > o.unit * 0.1 ? 3 : 2;
  under(g, outer, o, 0.45); pathOf(g, outer, true); g.fillStyle = hexOf(shade(col, -0.3)); g.fill(); rel(o, outer, true, h * 0.22, 0.12);
  g.save(); pathOf(g, outer, true); g.clip();
  for (let k = 1; k <= tiers; k++) {
    const f = k / (tiers + 1), mx = cx + (ox - cx) * f, my = cy + (oy - cy) * f, tier = outer.map(([x, y]) => { const j = (1 - f * 0.84) * (0.9 + rng() * 0.2); return [mx + (x - cx) * j, my + (y - cy) * j]; });
    pathOf(g, tier, true); g.fillStyle = hexOf(shade(col, -0.3 + f * 0.44)); g.fill();
    // Its edge drawn where the hand felt like it, harder here, missing there.
    for (let i = 0; i < n; i++) if (rng() < 0.62) line(g, [tier[i], tier[(i + 1) % n]], `rgba(12,10,8,${0.16 + rng() * 0.3})`, Math.max(0.5, o.ink * (0.4 + rng() * 0.6)));
    for (let i = 0; i < n; i++) if (rng() < 0.3) line(g, [[tier[i][0] + o.ink, tier[i][1] + o.ink], [tier[(i + 1) % n][0] + o.ink, tier[(i + 1) % n][1] + o.ink]], 'rgba(255,252,240,0.2)', Math.max(0.4, o.ink * 0.5));
    rel(o, tier, true, h * (0.22 + 0.78 * f * 1.15), 0.12);
  }
  // Cracks in from its rim, forking once; pale along their lip.
  for (let i = 0, nc = r > o.unit * 0.1 ? 4 : 1; i < nc; i++) { const t = rng() * 6.283, from = [cx + Math.cos(t) * rx * 0.96, cy + Math.sin(t) * ry * 0.96], back = Math.atan2(oy - from[1], ox - from[0]), run = [from]; let c = from; for (let k = 0; k < 5; k++) { const d = back + (rng() - 0.5) * 1.2; c = [c[0] + Math.cos(d) * r * 0.16, c[1] + Math.sin(d) * r * 0.16]; run.push(c); } line(g, run, 'rgba(8,6,4,0.6)', Math.max(0.5, o.ink * 0.75)); line(g, run.map(([x, y]) => [x + o.ink * 0.8, y + o.ink * 0.8]), 'rgba(255,252,240,0.22)', Math.max(0.4, o.ink * 0.5)); if (rng() < 0.6) line(g, [run[2], [run[2][0] + Math.cos(back + 1) * r * 0.2, run[2][1] + Math.sin(back + 1) * r * 0.2]], 'rgba(8,6,4,0.6)', Math.max(0.5, o.ink * 0.7)); }
  // Scratches and specks: what weather does to a face of stone.
  for (let i = 0, ns = Math.round(8 + (r / o.unit) * 60); i < ns; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * r * 0.9, c = [cx + Math.cos(t) * d, cy + Math.sin(t) * d], k = rng() * 6.283, len = r * (0.04 + rng() * 0.14); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], rng() < 0.55 ? `rgba(255,252,240,${0.1 + rng() * 0.2})` : `rgba(8,6,4,${0.14 + rng() * 0.2})`, 0.5 + rng() * 0.6); }
  if (o.fine) fineWork(g, seeded((Math.abs(Math.round(cx * 11 + cy * 7 + r * 3)) >>> 0) + 51), at(0, cx, cy), r, r, { along: false, dark: '14,12,10', pale: '255,252,240', much: 1.3 });
  const gr = g.createRadialGradient(ox, oy, r * 0.3, cx, cy, r * 1.05); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(6,5,4,0.5)'); g.fillStyle = gr; g.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  g.restore(); thinLine(g, outer, true, col, o, 0.9);
  return outer;
};
// The dust and grit that lies under fallen stone.
const dustBed = (g, rng, o, cx, cy, rx, ry) => {
  const pts = blob(rng, cx, cy, rx, ry, 18, 0.2);
  g.save(); g.filter = `blur(${Math.max(1, rx * 0.06)}px)`; pathOf(g, pts, false); g.fillStyle = 'rgba(96,90,80,0.55)'; g.fill(); g.restore();
  for (let i = 0; i < 90; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()), c = [cx + Math.cos(t) * d * rx, cy + Math.sin(t) * d * ry], r = rx * (0.006 + rng() * 0.014); disc(g, c[0], c[1], r, rng() < 0.7 ? hexOf(shade(varied(STONE, rng, 1.6), -0.3)) : varied(STONE, rng, 1.6)); }
};
// A skull from over it: the round of the cranium, two sockets, the jaw forward of them.
const skullAt = (g, rng, o, c, r, t) => {
  const q = at(t, c[0], c[1]), sk = [q(-r, -r * 0.5), q(-r * 0.6, -r * 0.86), q(r * 0.1, -r * 0.8), q(r * 0.7, -r * 0.42), q(r, 0), q(r * 0.7, r * 0.42), q(r * 0.1, r * 0.8), q(-r * 0.6, r * 0.86), q(-r, r * 0.5)];
  under(g, sk, o, 0.35); pathOf(g, sk, false); g.fillStyle = '#ded2b6'; g.fill();
  for (const e of [-1, 1]) { const eye = q(r * 0.36, e * r * 0.34); disc(g, eye[0], eye[1], r * 0.2, '#2a1c12'); }
  { const n = q(r * 0.7, 0); disc(g, n[0], n[1], r * 0.08, '#2a1c12'); line(g, [q(-r * 0.8, 0), q(-r * 0.1, r * 0.06)], 'rgba(50,36,20,0.5)', Math.max(0.5, o.ink * 0.5)); }
  thinLine(g, sk, false, '#8a7a5a', o, 1); relDome(o, sk, c[0], c[1], r, 0.1, 0.3, 0.12);
  return sk;
};
// Bark over a shape: its ground, then the furrows and ridges running the way the wood runs.
const barkOn = (g, rng, o, pts, a, bark, h) => {
  const c = centre(pts), r = reach(pts, c), col = varied(bark, rng, 1.1), q = at(a, c[0], c[1]);
  pathOf(g, pts, true); g.fillStyle = col; g.fill();
  g.save(); pathOf(g, pts, true); g.clip();
  for (let i = 0; i < Math.round(r * 0.9) + 30; i++) { const u = (rng() - 0.5) * r * 2, v = (rng() - 0.5) * r * 2, len = r * (0.06 + rng() * 0.2), dark = rng() < 0.62; line(g, [q(u, v), q(u + len * 0.5, v + (rng() - 0.5) * r * 0.02), q(u + len, v + (rng() - 0.5) * r * 0.03)], dark ? `rgba(16,7,0,${0.3 + rng() * 0.4})` : `rgba(214,186,140,${0.12 + rng() * 0.18})`, dark ? 0.8 + rng() * 1.6 : 0.6 + rng() * 0.8); }
  g.restore(); thinLine(g, pts, true, col, o, 1.1); rel(o, pts, true, h, 0.05);
};

// A blade of grass or reed: from its foot out along a bend, tapering to nothing. Returns where its tip came to.
const bladeAt = (g, o, c, t, len, w, green, bend, h) => {
  const n = 6, mid = Array.from({ length: n + 1 }, (_, k) => { const u = (k / n) * len, tt = t + bend * (k / n) ** 1.5; return [c[0] + Math.cos(tt) * u, c[1] + Math.sin(tt) * u, tt]; });
  const side = (e) => mid.map(([x, y, tt], k) => { const ww = w * (1 - k / n) * (k ? 1 : 0.6); return [x - Math.sin(tt) * ww * e, y + Math.cos(tt) * ww * e]; }), shape = [...side(1), ...side(-1).reverse()];
  pathOf(g, shape, true); g.fillStyle = green; g.fill(); softLine(g, shape, true, green, o);
  relLine(o, mid.map(([x, y]) => [x, y]), Math.max(1.2, w * 1.6), h, 0.08);
  return [mid[n][0], mid[n][1]];
};

// Dripstone: rounded tier on tier, each smaller and paler than the one under it, up to a point. Returns its foot's outline.
const dripstone = (g, rng, o, cx, cy, R, tiers, tone0, h) => {
  const tone = o.cave ? hexOf(mix(tone0, '#46444a', 0.4)) : tone0; let foot = null;
  for (let k = 0; k < tiers; k++) {
    const f = 1 - k / tiers, r = R * (0.16 + f * 0.84), c = [cx + (rng() - 0.5) * R * 0.06, cy + (rng() - 0.5) * R * 0.06], tier = blob(rng, c[0], c[1], r, r * (0.9 + rng() * 0.1), 14, 0.12), col = varied(hexOf(shade(tone, -0.12 + k * 0.07)), rng, 1);
    if (!k) { foot = tier; under(g, tier, o, 0.4); }
    pathOf(g, tier, false); g.fillStyle = col; g.fill();
    g.save(); pathOf(g, tier, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], r * 0.5, c[0], c[1], r * 1.04); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,14,8,0.32)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
    if (o.fine) fineWork(g, seeded((Math.abs(Math.round(cx * 11 + cy * 7 + r * 3 + k)) >>> 0) + 61), at(0, c[0], c[1]), r, r, { along: false, dark: '30,24,16', pale: '255,250,235', much: 0.8 });
    g.restore(); if (k) softLine(g, tier, false, col, o, 1.6); else thinLine(g, tier, false, col, o, 1); rel(o, tier, false, (h * (k + 1)) / tiers, 0.25);
  }
  return foot;
};
// A crack's line: a jagged run from a point, and the long thin shape of it — widest in its middle, closing at both ends.
const crackLine = (rng, from, t, len, n) => { const pts = [from]; let c = from; for (let k = 1; k <= n; k++) { const d = t + (rng() - 0.5) * 1.1; c = [c[0] + Math.cos(d) * len / n, c[1] + Math.sin(d) * len / n]; pts.push(c); } return pts; };
const crackShape = (pts, w) => { const n = pts.length - 1, side = (e) => pts.map(([x, y], k) => { const d = Math.atan2(pts[Math.min(n, k + 1)][1] - pts[Math.max(0, k - 1)][1], pts[Math.min(n, k + 1)][0] - pts[Math.max(0, k - 1)][0]), ww = w * Math.sin((k / n) * Math.PI) * (0.6 + ((k * 7) % 5) * 0.14); return [x - Math.sin(d) * ww * e, y + Math.cos(d) * ww * e]; }); return [...side(1), ...side(-1).reverse()]; };

const RICH = {
  barrel(g, s, rng, o, pal) {
    // From straight above a barrel is rings: its belly widest and lowest, a hoop round it, its staves leaning in to
    // the chime (their top ends) with a second hoop just under it, and inside the chime its head, sunk a finger deep.
    const a = rng() * 6.28, R = s * 0.8, belly = circle(0, 0, R, 44), N = 18, pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r], chime = R * 0.78, inner = R * 0.66;
    // The staves, each its own wood, from the belly up to the chime.
    for (let i = 0; i < N; i++) {
      const t0 = a + (i / N) * 6.283, t1 = t0 + 6.283 / N, tm = (t0 + t1) / 2, wood = varied(hexOf(shade(pal.wood, -0.08 + (rng() - 0.5) * 0.2)), rng, 1.2), stave = [pol(inner * 0.97, t0), pol(R, t0), pol(R * 1.006, tm), pol(R, t1), pol(inner * 0.97, t1)];
      pathOf(g, stave, true); g.fillStyle = wood; g.fill();
      g.save(); pathOf(g, stave, true); g.clip();
      for (let k = 0, n = 2 + Math.floor(rng() * 3); k < n; k++) { const t = t0 + rng() * (t1 - t0); line(g, [pol(inner, t), pol(R, t + (rng() - 0.5) * 0.03)], rng() < 0.7 ? `rgba(30,16,4,${0.14 + rng() * 0.2})` : `rgba(255,232,190,${0.1 + rng() * 0.12})`, Math.max(0.5, o.ink * 0.5)); }
      if (rng() < 0.3) { const c = pol(chime + (R - chime) * rng(), tm); line(g, [c, pol(R, tm + (rng() - 0.5) * 0.05)], 'rgba(14,6,0,0.65)', Math.max(0.6, o.ink * 0.7)); }
      g.restore();
      pathOf(g, stave, true); g.strokeStyle = 'rgba(16,8,2,0.65)'; g.lineWidth = Math.max(0.5, o.ink * 0.6); g.stroke();
    }
    // It rounds away below its widest: darker out toward its edge, all the way round.
    g.save(); pathOf(g, belly, false); g.clip(); const gr = g.createRadialGradient(0, 0, chime, 0, 0, R * 1.02); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(8,4,0,0.08)'); gr.addColorStop(1, 'rgba(8,4,0,0.5)'); g.fillStyle = gr; g.fillRect(-R * 2, -R * 2, R * 4, R * 4); g.restore();
    relDome(o, belly, 0, 0, R, 0.4, 0.74, 0.07); for (let i = 0; i < N; i++) { const t0 = a + (i / N) * 6.283; relLine(o, [pol(inner, t0), pol(R, t0)], Math.max(1, o.ink), 0.44); }
    // Two hoops: the wide one round its belly, the narrow one under the chime. Scuffed, and rusting where they sit.
    for (const [r, wd, h] of [[R * 0.94, Math.max(1.6, s * 0.055), 0.5], [chime * 1.045, Math.max(1.2, s * 0.04), 0.72]]) {
      ring(g, 0, 0, r, 'rgba(60,26,8,0.35)', wd * 1.5); hoop(g, o, r, wd, pal, h);
      for (let k = 0, n = 5 + Math.floor(rng() * 5); k < n; k++) { const t = rng() * 6.283, len = 0.06 + rng() * 0.2; g.beginPath(); g.arc(0, 0, r + (rng() - 0.5) * wd * 0.5, t, t + len); g.strokeStyle = rng() < 0.5 ? `rgba(255,240,220,${0.18 + rng() * 0.2})` : `rgba(70,30,8,${0.25 + rng() * 0.25})`; g.lineWidth = Math.max(0.5, wd * (0.12 + rng() * 0.2)); g.stroke(); }
    }
    stud(g, o, ...pol(R * 0.93, a + 0.4), Math.max(1, s * 0.024), pal, 0.62); stud(g, o, ...pol(chime * 1.04, a + 2.9), Math.max(1, s * 0.018), pal, 0.76);
    // The chime: the staves' cut tops, paler where they are rubbed.
    ring(g, 0, 0, (chime + inner) / 2, shade(pal.wood, 0.14), chime - inner); relRing(o, (chime + inner) / 2, chime - inner, 0.8, 0.2);
    for (let i = 0; i < N; i++) { const t0 = a + (i / N) * 6.283; line(g, [pol(inner, t0), pol(chime, t0)], 'rgba(16,8,2,0.6)', Math.max(0.5, o.ink * 0.6)); }
    for (let k = 0; k < 9; k++) { const t = rng() * 6.283; g.beginPath(); g.arc(0, 0, chime - (chime - inner) * (0.2 + rng() * 0.6), t, t + 0.1 + rng() * 0.3); g.strokeStyle = `rgba(255,238,205,${0.2 + rng() * 0.25})`; g.lineWidth = Math.max(0.6, o.ink * 0.8); g.stroke(); }
    ring(g, 0, 0, chime, 'rgba(10,5,0,0.7)', Math.max(0.7, o.ink * 0.8));
    // The head: boards across it, sunk below the chime, dark all round where the chime stands over them.
    const w = inner / 5; g.save(); g.beginPath(); g.arc(0, 0, inner, 0, 6.283); g.clip(); if (o.maps) { o.maps.save(); o.maps.beginPath(); o.maps.arc(0, 0, inner, 0, 6.283); o.maps.clip(); }
    for (let k = -2; k <= 2; k++) plank(g, rng, o, ...at(a)(0, k * w * 2), inner, w, a, pal.wood, 0.58);
    g.filter = `blur(${Math.max(1, R * 0.05)}px)`; g.strokeStyle = 'rgba(6,3,0,0.6)'; g.lineWidth = R * 0.12; g.beginPath(); g.arc(0, 0, inner * 1.03, 0, 6.283); g.stroke(); g.filter = 'none'; g.restore(); o.maps?.restore();
    // Its bung, a cork in a turned hole, and a ring where a mug stood.
    const b = pol(inner * 0.52, a + 1); disc(g, b[0], b[1], s * 0.058, '#17100a'); disc(g, b[0], b[1], s * 0.04, '#8a6f4a'); ring(g, b[0], b[1], s * 0.058, 'rgba(8,4,0,0.6)', Math.max(0.5, o.ink * 0.6)); if (o.maps) { o.maps.beginPath(); o.maps.arc(b[0], b[1], s * 0.045, 0, 6.283); o.maps.fillStyle = mapsColour(0.66, 0.05); o.maps.fill(); }
    if (rng() < 0.6) { const c = pol(inner * 0.4, a + 3.4 + rng()); ring(g, c[0], c[1], s * 0.11, 'rgba(20,8,0,0.2)', Math.max(0.8, s * 0.014)); }
    if (o.detail) {
      for (let i = 0; i < 8; i++) stud(g, o, ...pol(R * 0.94, a + 0.4 + ((i + 0.5) / 8) * 6.283), Math.max(0.9, s * 0.014), pal, 0.58);
      for (let i = 0; i < 6; i++) stud(g, o, ...pol(chime * 1.045, a + 2.9 + ((i + 0.5) / 6) * 6.283), Math.max(0.8, s * 0.011), pal, 0.76);
      // The cooper's brand, burned in: a ring round three strokes and a bar across them.
      const q = at(a + 0.5, ...pol(inner * 0.36, a - 1.9)), br = inner * 0.26, burn = 'rgba(28,10,0,0.62)', bw = Math.max(0.9, o.ink * 1.2);
      g.save(); g.beginPath(); g.arc(0, 0, inner, 0, 6.283); g.clip();
      line(g, circle(...q(0, 0), br, 22).concat([circle(...q(0, 0), br, 22)[0]]), burn, bw);
      for (const u of [-0.42, 0, 0.42]) line(g, [q(u * br, -br * 0.55), q(u * br, br * 0.55)], burn, bw);
      line(g, [q(-br * 0.7, 0), q(br * 0.7, 0)], burn, bw);
      const dr = seeded(4243);
      // A tally in chalk, by whoever counted the barrels in.
      const t = at(a - 0.3, ...pol(inner * 0.55, a + 2.2)), ch = inner * 0.12;
      for (let i = 0; i < 4; i++) line(g, [t(i * ch * 0.6, -ch + (dr() - 0.5) * ch * 0.2), t(i * ch * 0.6 + (dr() - 0.5) * ch * 0.1, ch)], 'rgba(240,236,222,0.42)', Math.max(0.5, o.ink * 0.45));
      line(g, [t(-ch * 0.4, ch * 0.6), t(ch * 2.2, -ch * 0.6)], 'rgba(240,236,222,0.4)', Math.max(0.5, o.ink * 0.45));
      g.restore();
    }
    worn(g, rng, o, circle(0, 0, inner), a, inner, pal.wear, false);
    ring(g, 0, 0, inner, 'rgba(10,5,0,0.8)', Math.max(0.7, o.ink * 0.9)); thinLine(g, belly, false, pal.wood, o, 1.1);
    return [belly];
  },
  longTable(g, s, rng, o, pal) {
    const a = (rng() - 0.5) * 0.14, p = at(a), L = s * 0.92, W = s * 0.4, top = boxAt(0, 0, L, W, a);
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = boxAt(...p(u * L * 0.8, v * W * 0.96), W * 0.14, W * 0.14, a); pathOf(g, leg, true); g.fillStyle = pal.woodDark; g.fill(); thinLine(g, leg, true, pal.wood, o, 0.9); rel(o, leg, true, 0.3); }
    under(g, top, o, 0.35); pathOf(g, top, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = -2; k <= 2; k++) plank(g, rng, o, ...p(0, k * W * 0.4), L * 0.86, W * 0.2, a, pal.wood, 0.55);
    for (const u of [-1, 1]) { plank(g, rng, o, ...p(u * L * 0.93, 0), W, L * 0.07, a + Math.PI / 2, shade(pal.wood, -0.12), 0.56); for (const v of [-W * 0.6, 0, W * 0.6]) stud(g, o, ...p(u * L * 0.93, v), Math.max(1, s * 0.014), pal, 0.6); }
    if (o.detail) {
      const dr = seeded(4242);
      // Its legs turned on a lathe: round, ringed, standing out past its corners.
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const c = p(u * L * 0.93, v * W * 0.93), r = W * 0.15; disc(g, c[0], c[1], r, pal.woodDark); disc(g, c[0], c[1], r * 0.68, shade(pal.wood, 0.04)); disc(g, c[0], c[1], r * 0.3, pal.woodDark); ring(g, c[0], c[1], r * 0.68, 'rgba(16,8,2,0.6)', Math.max(0.5, o.ink * 0.6)); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.78), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.56, 0.72, 0.2); }
      // Iron straps let into the breadboard ends, three rivets in each.
      for (const u of [-1, 1]) for (const v of [-0.55, 0.55]) { const c = p(u * L * 0.93, v * W), strap = boxAt(c[0], c[1], L * 0.05, W * 0.2, a); pathOf(g, strap, true); g.fillStyle = pal.metal; g.fill(); g.save(); pathOf(g, strap, true); g.clip(); for (let i = 0; i < 5; i++) { const m = p(u * L * 0.93 + (dr() - 0.5) * L * 0.09, v * W + (dr() - 0.5) * W * 0.36); g.fillStyle = dr() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(60,26,8,0.3)'; g.beginPath(); g.arc(m[0], m[1], W * 0.05, 0, 6.283); g.fill(); } if (o.fine) fineWork(g, seeded(Math.round(c[0] * 7 + c[1] * 3 + 11) >>> 0 || 3), at(a, c[0], c[1]), L * 0.05, W * 0.2, { along: false, dark: '14,14,16', pale: '255,255,255', much: 1.4 }); g.restore(); thinLine(g, strap, true, pal.metal, o, 0.9); rel(o, strap, true, 0.6, 0.85); for (const dv of [-0.13, 0, 0.13]) stud(g, o, ...p(u * L * 0.93, (v + dv) * W), Math.max(0.9, s * 0.01), pal, 0.66); }
      // Carved down its middle board: a groove either side, and between them lozenges and rounds, cut in.
      const cut = 'rgba(30,12,0,0.62)', lip = 'rgba(255,232,190,0.3)', cw = Math.max(0.8, o.ink), r = W * 0.105, low = [];
      g.save(); pathOf(g, top, true); g.clip();
      for (const v of [-W * 0.165, W * 0.165]) { const gl = [p(-L * 0.78, v), p(L * 0.78, v)]; line(g, gl, cut, cw, 'butt'); line(g, [p(-L * 0.78, v + cw), p(L * 0.78, v + cw)], lip, Math.max(0.5, cw * 0.6), 'butt'); low.push(gl); }
      for (let i = -5; i <= 5; i++) {
        const u = i * L * 0.145, shape = i % 2 ? [p(u - r * 1.25, 0), p(u, -r), p(u + r * 1.25, 0), p(u, r)] : circle(...p(u, 0), r * 0.72, 16);
        const closed = shape.concat([shape[0]]); line(g, closed, cut, cw); line(g, closed.map(([x, y]) => [x + cw * 0.7, y + cw * 0.7]), lip, Math.max(0.5, cw * 0.55)); low.push(closed);
        const c = p(u, 0); disc(g, c[0], c[1], Math.max(0.7, r * 0.16), cut);
      }
      g.restore(); for (const l of low) relLine(o, l, Math.max(1, o.ink * 1.3), 0.44, 0.05);
    }
    // What a table gathers: rings where mugs stood, a dark spill, knife nicks; its edge rubbed pale all round.
    g.save(); pathOf(g, top, true); g.clip();
    for (let i = 0, n = 1 + Math.floor(rng() * 3); i < n; i++) { const c = p((rng() - 0.5) * L * 1.5, (rng() - 0.5) * W * 1.4), r = o.unit * (0.07 + rng() * 0.03); g.beginPath(); g.arc(c[0], c[1], r, rng() * 6, rng() * 6 + 3.5 + rng() * 2.7); g.strokeStyle = `rgba(22,9,0,${0.16 + rng() * 0.14})`; g.lineWidth = Math.max(0.8, o.unit * 0.012); g.stroke(); }
    g.filter = `blur(${Math.max(1, o.unit * 0.02)}px)`; { const c = p((rng() - 0.5) * L * 1.3, (rng() - 0.5) * W); g.fillStyle = 'rgba(30,8,4,0.22)'; g.beginPath(); g.ellipse(c[0], c[1], o.unit * (0.1 + rng() * 0.1), o.unit * (0.06 + rng() * 0.06), rng() * 3, 0, 6.283); g.fill(); } g.filter = 'none';
    for (let i = 0, n = 3 + Math.floor(rng() * 5); i < n; i++) { const c = p((rng() - 0.5) * L * 1.7, (rng() - 0.5) * W * 1.7), t = rng() * 3.14, len = o.unit * (0.03 + rng() * 0.07); line(g, [c, [c[0] + Math.cos(t) * len, c[1] + Math.sin(t) * len]], `rgba(255,238,205,${0.25 + rng() * 0.25})`, Math.max(0.5, o.ink * 0.6)); }
    pathOf(g, boxAt(0, 0, L - o.ink * 1.6, W - o.ink * 1.6, a), true); g.strokeStyle = 'rgba(255,236,200,0.22)'; g.lineWidth = Math.max(0.8, o.ink * 1.1); g.setLineDash([o.unit * 0.09, o.unit * 0.03, o.unit * 0.2, o.unit * 0.05]); g.stroke(); g.setLineDash([]);
    g.restore();
    worn(g, rng, o, top, a, L, pal.wear); thinLine(g, top, true, pal.wood, o, 1.2);
    return [top];
  },
  chair(g, s, rng, o, pal) {
    const a = (rng() - 0.5) * 0.24, p = at(a), H = s * 0.56, seat = boxAt(0, 0, H, H, a);
    for (const [u, v] of [[-1, 1], [1, 1]]) { const leg = boxAt(...p(u * H * 0.9, v * H * 0.92), H * 0.14, H * 0.14, a); pathOf(g, leg, true); g.fillStyle = pal.woodDark; g.fill(); thinLine(g, leg, true, pal.wood, o, 0.9); rel(o, leg, true, 0.25); }
    for (let k = -1; k <= 1; k++) plank(g, rng, o, ...p(k * H * 0.667, 0), H, H * 0.333, a + Math.PI / 2, pal.wood, 0.36);
    thinLine(g, seat, true, pal.wood, o, 1.1);
    pad(g, rng, o, ...p(0, H * 0.14), H * 0.7, H * 0.66, a, pal, 0.4);
    // Its back: a bowed rail standing over the rear of the seat, a round post at either end of it.
    const bow = (u) => (u / H) ** 2 * H * 0.14, us = Array.from({ length: 13 }, (_, i) => -H * 1.06 + (i / 12) * H * 2.12), back = [...us.map((u) => p(u, -H * 1.16 + bow(u))), ...us.slice().reverse().map((u) => p(u, -H * 0.8 + bow(u)))];
    under(g, back, o, 0.5); pathOf(g, back, true); g.fillStyle = shade(pal.wood, 0.06); g.fill(); rel(o, back, true, 0.8, 0.25);
    g.save(); pathOf(g, back, true); g.clip(); for (const dv of [-1.08, -0.98, -0.9]) line(g, us.map((u) => p(u, H * dv + bow(u))), `rgba(30,16,4,${0.16 + rng() * 0.14})`, Math.max(0.5, o.ink * 0.6)); g.restore();
    thinLine(g, back, true, pal.wood, o, 1.1);
    if (o.detail) {
      // Brass tacks holding the seat's cloth, along the three edges of it that show.
      for (let i = -3; i <= 3; i++) { stud(g, o, ...p(i * H * 0.27, H * 0.9), Math.max(0.8, H * 0.035), pal, 0.42); if (i > -3 && i < 3) for (const u of [-1, 1]) stud(g, o, ...p(u * H * 0.9, i * H * 0.27 + H * 0.1), Math.max(0.8, H * 0.035), pal, 0.42); }
      // Its back rail carved: scallops cut along it, a round boss at its middle.
      g.save(); pathOf(g, back, true); g.clip();
      for (let i = -3; i <= 3; i++) { if (!i) continue; const u = i * H * 0.27, arc = Array.from({ length: 7 }, (_, k) => { const t = Math.PI * (k / 6); return p(u + Math.cos(t) * H * 0.1, -H * 0.9 + bow(u) - Math.sin(t) * H * 0.13); }); line(g, arc, 'rgba(30,12,0,0.6)', Math.max(0.7, o.ink * 0.9)); line(g, arc.map(([x, y]) => [x, y + o.ink * 0.8]), 'rgba(255,232,190,0.28)', Math.max(0.5, o.ink * 0.5)); relLine(o, arc, Math.max(1, o.ink * 1.2), 0.7, 0.2); }
      g.restore();
      const boss = p(0, -H * 0.98), br = H * 0.13; disc(g, boss[0], boss[1], br, shade(pal.wood, 0.12)); disc(g, boss[0], boss[1], br * 0.45, pal.woodDark); ring(g, boss[0], boss[1], br, mix(pal.wood, '#0c0904', 0.78), Math.max(0.7, o.ink * 0.9)); relDome(o, circle(boss[0], boss[1], br), boss[0], boss[1], br, 0.8, 0.95, 0.3);
    }
    for (const u of [-1, 1]) { const c = p(u * H * 0.98, -H * 0.98 + bow(H * 0.98)), r = H * 0.17; disc(g, c[0], c[1], r, pal.woodDark); if (o.detail) { disc(g, c[0], c[1], r * 0.62, shade(pal.wood, 0.1)); disc(g, c[0], c[1], r * 0.26, pal.woodDark); ring(g, c[0], c[1], r * 0.62, 'rgba(16,8,2,0.6)', Math.max(0.5, o.ink * 0.6)); } ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.78), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.8, 1, 0.3); }
    return [seat, back];
  },
  crate(g, s, rng, o, pal) {
    // A lid of four boards in a frame of battens, a brace let in across it, iron at its corners.
    const a = (rng() - 0.5) * 0.3, p = at(a), H = s * 0.7, box = boxAt(0, 0, H, H, a), lean = (rng() < 0.5 ? 1 : -1) * Math.PI / 4;
    under(g, box, o, 0.3); pathOf(g, box, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = 0; k < 4; k++) plank(g, rng, o, ...p(0, (k - 1.5) * H * 0.5), H, H * 0.25, a, pal.wood, 0.5);
    g.save(); pathOf(g, box, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, box, true); o.maps.clip(); }
    plank(g, rng, o, 0, 0, H * 1.3, H * 0.11, a + lean, shade(pal.wood, -0.1), 0.58);
    if (o.detail) {
      // A shipper's mark painted on the lid: a triangle over two bars.
      const q = at(a, ...p(-H * 0.36 * Math.sign(lean), -H * 0.36)), m = H * 0.17, paint = 'rgba(18,8,2,0.5)', w = Math.max(1, o.ink * 1.5);
      line(g, [q(0, -m), q(m, m * 0.5), q(-m, m * 0.5), q(0, -m)], paint, w); line(g, [q(-m, m * 0.85), q(m, m * 0.85)], paint, w); line(g, [q(-m * 0.6, m * 1.2), q(m * 0.6, m * 1.2)], paint, w);
    }
    g.restore(); o.maps?.restore();
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * H * 0.88), H, H * 0.12, a, shade(pal.wood, -0.14), 0.62);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * H * 0.88, 0), H * 0.76, H * 0.12, a + Math.PI / 2, shade(pal.wood, -0.14), 0.62);
    for (const [u, v] of C4) { plate(g, o, boxAt(...p(u * H * 0.86, v * H * 0.86), H * 0.14, H * 0.14, a), pal, 0.66); stud(g, o, ...p(u * H * 0.86, v * H * 0.86), Math.max(1, s * 0.028), pal, 0.72); }
    worn(g, rng, o, box, a, H, pal.wear); thinLine(g, box, true, pal.wood, o, 1.2);
    return [box];
  },
  chest(g, s, rng, o, pal) {
    // Three boards along its lid, the middle one proud; iron straps over it, iron at its corners, a lock at its front.
    const a = (rng() - 0.5) * 0.3, p = at(a), L = s * 0.8, D = s * 0.5, box = boxAt(0, 0, L, D, a);
    under(g, box, o, 0.3); pathOf(g, box, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = -1; k <= 1; k++) plank(g, rng, o, ...p(0, k * D * 0.667), L, D * 0.333, a, pal.wood, k ? 0.52 : 0.6);
    for (const u of [-0.55, 0.55]) { plate(g, o, boxAt(...p(u * L, 0), L * 0.07, D * 1.02, a), pal, 0.66); for (const v of [-0.7, 0, 0.7]) stud(g, o, ...p(u * L, v * D), Math.max(1, s * 0.024), pal, 0.72); }
    for (const [u, v] of C4) plate(g, o, boxAt(...p(u * L * 0.9, v * D * 0.84), L * 0.1, D * 0.16, a), pal, 0.64);
    plate(g, o, boxAt(...p(0, D * 0.82), L * 0.1, D * 0.2, a), pal, 0.68); { const k = p(0, D * 0.84); disc(g, k[0], k[1], Math.max(1, s * 0.026), '#120c06'); line(g, [k, p(0, D * 0.94)], '#120c06', Math.max(0.8, s * 0.014)); }
    if (o.detail) {
      // Nail heads along its front and back edges, and a carrying ring at each end.
      for (const v of [-0.9, 0.9]) for (let i = -3; i <= 3; i++) { if (Math.abs(Math.abs(i) * 0.17 - 0.55) < 0.1 || !i) continue; stud(g, o, ...p(i * L * 0.17, v * D), Math.max(0.8, s * 0.013), pal, 0.6); }
      for (const u of [-1, 1]) { const arc = Array.from({ length: 9 }, (_, k) => { const t = -Math.PI / 2 + (k / 8) * Math.PI; return p(u * (L * 1.0 + Math.cos(t) * L * 0.07), Math.sin(t) * D * 0.3); }); line(g, arc, mix(pal.metal, '#0c0904', 0.8), Math.max(1.6, s * 0.045)); line(g, arc, pal.metal, Math.max(0.9, s * 0.024)); relLine(o, arc, Math.max(1.5, s * 0.04), 0.5, 0.85); }
    }
    worn(g, rng, o, box, a, L, pal.wear); thinLine(g, box, true, pal.wood, o, 1.2);
    return [box];
  },
  sack: (g, s, rng, o, pal) => {
    // A full sack of coarse hemp, slumped round, gathered and tied at its neck.
    const a0 = rng() * 6.28, a = o.sackTurn ?? a0, p = at(a), R = s * 0.66, body = blob(rng, 0, 0, R, s * 0.6, 18, 0.1, a), hemp = hexOf(mix(pal.cloth, '#b79c6a', 0.72));
    const neck = blob(rng, ...p(R * 0.74, 0), R * 0.26, R * 0.2, 10, 0.2);
    under(g, body, o, 0.3);
    g.save(); pathOf(g, body, false); g.fillStyle = hemp; g.fill(); g.clip();
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.05); gr.addColorStop(0, 'rgba(255,236,200,0.22)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,10,0,0.5)'); g.fillStyle = gr; g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
    // Its weave, coarse enough to see, and the creases drawn toward the neck.
    for (let k = -14; k <= 14; k++) { line(g, [p(-R, (k / 14) * R), p(R, (k / 14) * R)], 'rgba(44,26,6,0.13)', Math.max(0.5, o.ink * 0.4)); line(g, [p((k / 14) * R, -R), p((k / 14) * R, R)], 'rgba(255,240,210,0.09)', Math.max(0.5, o.ink * 0.4)); }
    if (o.fine) fineWork(g, seeded(771), p, R, R, { along: false, dark: '44,26,6', pale: '255,240,210', much: 1.2 });
    for (let i = -2; i <= 2; i++) line(g, [p(R * 0.5, i * R * 0.06), p(R * 0.1, i * R * 0.2), p(-R * (0.3 + Math.abs(i) * 0.1), i * R * 0.34)], 'rgba(30,16,2,0.26)', Math.max(0.6, o.ink * 0.8));
    if (o.detail) {
      // Sewn down its side, and patched where it tore.
      g.setLineDash([o.ink * 2.4, o.ink * 1.8]); line(g, [p(-R * 0.7, -R * 0.42), p(-R * 0.2, -R * 0.5), p(R * 0.35, -R * 0.4)], 'rgba(60,34,10,0.5)', Math.max(0.5, o.ink * 0.5)); g.setLineDash([]);
      const patch = boxAt(...p(-R * 0.3, R * 0.3), R * 0.2, R * 0.16, a + 0.3); pathOf(g, patch, true); g.fillStyle = mix(pal.cloth, '#8a7a5a', 0.5); g.fill(); g.setLineDash([o.ink * 2, o.ink * 1.6]); pathOf(g, patch, true); g.strokeStyle = 'rgba(60,34,10,0.55)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); g.setLineDash([]);
    }
    g.restore();
    relDome(o, body, 0, 0, R, 0.2, 0.44, 0.03);
    thinLine(g, body, false, hemp, o, 1.1);
    pathOf(g, neck, false); g.fillStyle = shade(hemp, 0.1); g.fill();
    for (let i = -1; i <= 1; i++) line(g, [p(R * 0.56, i * R * 0.1), p(R * 0.95, i * R * 0.16)], 'rgba(30,16,2,0.35)', Math.max(0.6, o.ink * 0.7));
    thinLine(g, neck, false, hemp, o, 0.9); rel(o, neck, false, 0.4, 0.03);
    if (o.detail && !o.sackTurn) { const dr = seeded(976); for (let i = 0; i < 34; i++) { const c = p(R * (0.9 + dr() * 0.36), (dr() - 0.5) * R * 0.6); disc(g, c[0], c[1], Math.max(0.6, s * (0.01 + dr() * 0.012)), varied('#c9a858', dr, 1.6)); } }
    const cord = [p(R * 0.55, -R * 0.2), p(R * 0.59, 0), p(R * 0.55, R * 0.2)]; line(g, cord, mix(pal.cloth, '#0c0904', 0.8), Math.max(1.6, s * 0.06)); line(g, cord, pal.cloth, Math.max(0.9, s * 0.034));
    return [body];
  },
  basket(g, s, rng, o, pal) {
    // Woven of withies, ring over ring; what it carries heaped in its dark middle; a handle bent over it.
    const a = rng() * 6.28, R = s * 0.7, rim = circle(0, 0, R, 40), withy = hexOf(mix(pal.wood, '#c9a868', 0.45)), N = 24, mouth = R * 0.5;
    under(g, rim, o, 0.3); pathOf(g, rim, false); g.fillStyle = shade(withy, -0.3); g.fill();
    for (let k = 0; k < 5; k++) {
      const r = R * (0.56 + k * 0.095), wd = R * 0.082;
      for (let i = 0; i < N; i++) { const t0 = a + ((i + (k % 2) * 0.5) / N) * 6.283; g.beginPath(); g.arc(0, 0, r, t0, t0 + (6.283 / N) * 0.84); g.strokeStyle = varied(hexOf(shade(withy, i % 2 ? 0.1 : -0.1)), rng, 1); g.lineWidth = wd; g.lineCap = 'butt'; g.stroke(); }
      ring(g, 0, 0, r + wd / 2, 'rgba(20,10,2,0.55)', Math.max(0.5, o.ink * 0.55));
    }
    if (o.fine) { g.save(); g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.arc(0, 0, mouth, 0, 6.283, true); g.clip(); fineWork(g, seeded(772), at(a), R, R, { along: false, dark: '40,20,4', pale: '255,236,190', much: 0.8 }); g.restore(); }
    relRing(o, (R + mouth) / 2, R - mouth, 0.44, 0.05);
    disc(g, 0, 0, mouth, '#1c140c'); if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, mouth, 0, 6.283); o.maps.fillStyle = mapsColour(0.2, 0.03); o.maps.fill(); }
    for (let i = 0; i < 7; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * mouth * 0.62, c = [Math.cos(t) * d, Math.sin(t) * d], r = mouth * 0.3, fruit = varied(pal.cloth, rng, 1.6); roundBody(g, o, c, r, fruit); disc(g, c[0] + r * 0.1, c[1] - r * 0.1, r * 0.12, '#2a1a0a'); ring(g, c[0], c[1], r, mix(fruit, '#0c0904', 0.8), Math.max(0.6, o.ink * 0.8)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.26, 0.4, 0.2); }
    ring(g, 0, 0, mouth, mix(withy, '#0c0904', 0.9), Math.max(0.8, o.ink));
    const hp = at(a), handle = Array.from({ length: 9 }, (_, i) => { const t = -1 + i / 4; return hp(t * R * 0.98, -R * 0.24 * (1 - t * t)); });
    line(g, handle, mix(withy, '#0c0904', 0.9), Math.max(2, s * 0.11)); line(g, handle, shade(withy, -0.04), Math.max(1.2, s * 0.074)); relLine(o, handle, Math.max(2, s * 0.09), 0.62, 0.05);
    for (let i = 1; i < 8; i++) line(g, [[handle[i][0] - s * 0.03, handle[i][1] - s * 0.025], [handle[i][0] + s * 0.03, handle[i][1] + s * 0.025]], 'rgba(20,10,2,0.45)', Math.max(0.5, o.ink * 0.5));
    thinLine(g, rim, false, withy, o, 1.1);
    return [rim];
  },
  bucket(g, s, rng, o, pal) {
    // Staves round still water, one iron hoop, its bail lying across it.
    const a = rng() * 6.28, R = s * 0.7, rim = circle(0, 0, R, 36), N = 12, inner = R * 0.66, pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r], p = at(a);
    under(g, rim, o, 0.3);
    for (let i = 0; i < N; i++) { const t0 = a + (i / N) * 6.283, t1 = t0 + 6.283 / N, stave = [pol(inner * 0.97, t0), pol(R, t0), pol(R * 1.008, (t0 + t1) / 2), pol(R, t1), pol(inner * 0.97, t1)]; pathOf(g, stave, true); g.fillStyle = varied(hexOf(shade(pal.wood, (rng() - 0.5) * 0.2)), rng, 1.2); g.fill(); g.strokeStyle = 'rgba(16,7,0,0.9)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
    if (o.fine) { g.save(); g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.arc(0, 0, inner, 0, 6.283, true); g.clip(); fineWork(g, seeded(773), p, R, R, { along: false, much: 0.7 }); g.restore(); }
    relRing(o, (R + inner) / 2, R - inner, 0.46, 0.07);
    hoop(g, o, R * 0.85, Math.max(1.4, s * 0.06), pal, 0.52);
    disc(g, 0, 0, inner, '#1f2c35'); for (const k of [0.45, 0.75]) ring(g, 0, 0, inner * k, 'rgba(190,215,225,0.13)', Math.max(0.6, o.ink * 0.7)); if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, inner, 0, 6.283); o.maps.fillStyle = mapsColour(0.22, 0.3); o.maps.fill(); }
    if (o.frozen) iceOver(g, rng, o, circle(0, 0, inner, 24), false);
    { const sh = g.createRadialGradient(0, 0, inner * 0.5, 0, 0, inner); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)'); g.save(); g.beginPath(); g.arc(0, 0, inner, 0, 6.283); g.clip(); g.fillStyle = sh; g.fillRect(-R, -R, R * 2, R * 2); g.restore(); }
    ring(g, 0, 0, inner, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink));
    const bail = Array.from({ length: 9 }, (_, i) => { const t = -1 + i / 4; return p(t * R * 0.9, R * 0.36 * (1 - t * t)); });
    line(g, bail, mix(pal.metal, '#0c0904', 0.85), Math.max(1.8, s * 0.075)); line(g, bail, pal.metal, Math.max(1, s * 0.04)); relLine(o, bail, Math.max(1.6, s * 0.06), 0.62, 0.85);
    for (const u of [-1, 1]) stud(g, o, ...p(u * R * 0.9, 0), Math.max(1, s * 0.035), pal, 0.66);
    thinLine(g, rim, false, pal.wood, o, 1.1);
    return [rim];
  },
  stool(g, s, rng, o, pal) {
    // A round seat of three boards on three turned legs, their feet showing past its edge.
    const a = rng() * 6.28, R = s * 0.62, seat = circle(0, 0, R, 32), pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r];
    for (let i = 0; i < 3; i++) { const c = pol(R * 0.9, a + 0.5 + (i / 3) * 6.283), r = R * 0.2; disc(g, c[0], c[1], r, pal.woodDark); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.18, 0.28, 0.1); }
    under(g, seat, o, 0.35);
    roundBoards(g, rng, o, 0, 0, R, a, pal.wood, 0.42, 3);
    ring(g, 0, 0, R * 0.84, 'rgba(16,7,0,0.4)', Math.max(0.6, o.ink * 0.7));
    if (o.detail) {
      // The legs' tenons come up through the seat, each wedged.
      for (let i = 0; i < 3; i++) { const t = a + 0.5 + (i / 3) * 6.283, c = pol(R * 0.52, t), r = R * 0.12; disc(g, c[0], c[1], r, shade(pal.wood, -0.3)); ring(g, c[0], c[1], r, 'rgba(16,7,0,0.85)', Math.max(0.6, o.ink * 0.7)); line(g, [[c[0] - Math.sin(t) * r, c[1] + Math.cos(t) * r], [c[0] + Math.sin(t) * r, c[1] - Math.cos(t) * r]], 'rgba(255,228,170,0.4)', Math.max(0.6, o.ink * 0.6)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], r, 0, 6.283); o.maps.fillStyle = mapsColour(0.45, 0.1); o.maps.fill(); } }
    }
    worn(g, rng, o, seat, a, R, pal.wear, false); thinLine(g, seat, false, pal.wood, o, 1.2);
    return [seat];
  },
  bench(g, s, rng, o, pal) {
    // Two long boards on a trestle at either end.
    const a = (rng() - 0.5) * 0.2, p = at(a), L = s * 0.9, W = s * 0.2, seat = boxAt(0, 0, L, W, a);
    for (const u of [-0.74, 0.74]) { const leg = boxAt(...p(u * L, 0), W * 0.28, W * 1.32, a); pathOf(g, leg, true); g.fillStyle = pal.woodDark; g.fill(); thinLine(g, leg, true, pal.wood, o, 0.9); rel(o, leg, true, 0.25); }
    under(g, seat, o, 0.35); pathOf(g, seat, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (const v of [-0.5, 0.5]) plank(g, rng, o, ...p(0, v * W), L, W * 0.5, a, pal.wood, 0.45);
    if (o.detail) {
      // Each trestle's tenon comes up through the seat, wedged; a row of pegs beside it.
      for (const u of [-0.74, 0.74]) { const c = p(u * L, 0), ten = boxAt(c[0], c[1], W * 0.2, W * 0.34, a); pathOf(g, ten, true); g.fillStyle = shade(pal.wood, -0.3); g.fill(); line(g, [p(u * L, -W * 0.34), p(u * L, W * 0.34)], 'rgba(255,228,170,0.4)', Math.max(0.6, o.ink * 0.6)); thinLine(g, ten, true, pal.wood, o, 0.7); rel(o, ten, true, 0.5, 0.1); for (const du of [-0.07, 0.07]) for (const v of [-0.6, 0.6]) stud(g, o, ...p((u + du) * L, v * W), Math.max(0.8, s * 0.011), pal, 0.5); }
    } else for (const u of [-0.74, 0.74]) for (const v of [-0.5, 0.5]) stud(g, o, ...p(u * L, v * W), Math.max(1, s * 0.016), pal, 0.5);
    worn(g, rng, o, seat, a, L, pal.wear); thinLine(g, seat, true, pal.wood, o, 1.2);
    return [seat];
  },
  armchair(g, s, rng, o, pal) {
    // Upholstered all over: a deep seat cushion, a padded back, a padded arm either side, on four turned feet.
    const a = (rng() - 0.5) * 0.2, p = at(a), H = s * 0.62, frame = boxAt(0, 0, H, H * 0.94, a);
    for (const [u, v] of C4) { const c = p(u * H * 0.92, v * H * 0.86), r = H * 0.15; disc(g, c[0], c[1], r, pal.woodDark); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.16, 0.26, 0.2); }
    under(g, frame, o, 0.35); pathOf(g, frame, true); g.fillStyle = pal.clothDark; g.fill(); rel(o, frame, true, 0.4, 0.03); thinLine(g, frame, true, pal.cloth, o, 1.1);
    pad(g, rng, o, ...p(0, H * 0.2), H * 0.62, H * 0.62, a, pal, 0.48);
    pad(g, rng, o, ...p(0, -H * 0.7), H * 0.98, H * 0.25, a, pal, 0.72);
    for (const u of [-1, 1]) pad(g, rng, o, ...p(u * H * 0.8, H * 0.22), H * 0.2, H * 0.66, a, pal, 0.62);
    if (o.detail) for (let i = -3; i <= 3; i++) stud(g, o, ...p(i * H * 0.2, H * 0.9), Math.max(0.8, H * 0.03), pal, 0.44);
    return [frame];
  },
  roundTable(g, s, rng, o, pal) {
    // Seven boards across a round top, banded at its edge; a foot showing either side.
    const a = rng() * 6.28, R = s * 0.8, top = circle(0, 0, R, 44), p = at(a), pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r];
    for (const u of [-1, 1]) { const c = p(u * R * 0.93, 0), r = R * 0.13; disc(g, c[0], c[1], r, pal.woodDark); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.2, 0.3, 0.1); }
    under(g, top, o, 0.35);
    roundBoards(g, rng, o, 0, 0, R, a, pal.wood, 0.55, 7);
    ring(g, 0, 0, R * 0.955, shade(pal.wood, -0.22), R * 0.09); ring(g, 0, 0, R * 0.91, 'rgba(16,7,0,0.85)', Math.max(0.7, o.ink * 0.8)); relRing(o, R * 0.955, R * 0.09, 0.6, 0.1);
    if (o.detail) {
      for (let i = 0; i < 10; i++) stud(g, o, ...pol(R * 0.955, a + (i / 10) * 6.283), Math.max(0.9, s * 0.012), pal, 0.64);
      // Carved in its middle: two rings cut round a wheel of eight lozenges.
      const cut = 'rgba(30,12,0,0.62)', lip = 'rgba(255,232,190,0.3)', cw = Math.max(0.8, o.ink), low = [];
      for (const k of [0.5, 0.58]) { const c = circle(0, 0, R * k, 40); c.push(c[0]); line(g, c, cut, cw); line(g, c.map(([x, y]) => [x + cw * 0.7, y + cw * 0.7]), lip, Math.max(0.5, cw * 0.55)); low.push(c); }
      for (let i = 0; i < 8; i++) { const q = at(a + (i / 8) * 6.283), d = R * 0.28, m = R * 0.1, shape = [q(d - m * 1.3, 0), q(d, -m * 0.7), q(d + m * 1.3, 0), q(d, m * 0.7), q(d - m * 1.3, 0)]; line(g, shape, cut, cw); line(g, shape.map(([x, y]) => [x + cw * 0.7, y + cw * 0.7]), lip, Math.max(0.5, cw * 0.55)); low.push(shape); }
      { const c = circle(0, 0, R * 0.09, 16); c.push(c[0]); line(g, c, cut, cw); low.push(c); disc(g, 0, 0, Math.max(0.8, R * 0.025), cut); }
      for (const l of low) relLine(o, l, Math.max(1, o.ink * 1.3), 0.44, 0.05);
    }
    mugRings(g, rng, o, p, R * 0.7, R * 0.7, top, false);
    worn(g, rng, o, top, a, R, pal.wear, false); thinLine(g, top, false, pal.wood, o, 1.2);
    return [top];
  },
  counter(g, s, rng, o, pal) {
    // A bar: two long boards for its top, its panelled front showing under their edge, a brass rail along the foot of it.
    const a = (rng() - 0.5) * 0.08, p = at(a), L = s * 0.92, W = s * 0.3, base = boxAt(...p(0, W * 0.2), L * 0.97, W * 0.96, a), top = boxAt(...p(0, -W * 0.12), L, W * 0.8, a);
    under(g, base, o, 0.3); pathOf(g, base, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.62); g.fill();
    for (let i = 0; i < 6; i++) plank(g, rng, o, ...p((i - 2.5) * (L * 0.97 / 3), W * 0.92), W * 0.24, L * 0.97 / 6, a + Math.PI / 2, shade(pal.wood, -0.18), 0.4);
    thinLine(g, base, true, pal.wood, o, 1.1);
    plate(g, o, boxAt(...p(0, W * 1.06), L * 0.94, W * 0.04, a), pal, 0.5); for (let i = -2; i <= 2; i++) stud(g, o, ...p(i * L * 0.45, W * 1.06), Math.max(1, s * 0.016), pal, 0.56);
    under(g, top, o, 0.4); pathOf(g, top, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (const k of [-0.5, 0.5]) plank(g, rng, o, ...p(0, -W * 0.12 + k * W * 0.8), L, W * 0.4, a, pal.wood, 0.7);
    mugRings(g, rng, o, at(a, ...p(0, -W * 0.12)), L, W * 0.8, top, true);
    if (o.detail) {
      // A rag left on it, and a row of pegs along its back edge.
      const rc = p(L * 0.6, -W * 0.14), rq = at(a + 0.35, rc[0], rc[1]), rw = W * 0.34, rh = W * 0.24, rag = [rq(-rw, -rh), rq(rw * 0.9, -rh * 1.05), rq(rw, rh * 0.9), rq(-rw * 0.95, rh)], linen = hexOf(mix(pal.cloth, '#d8cdb4', 0.45));
      under(g, rag, o, 0.3); pathOf(g, rag, true); g.fillStyle = linen; g.fill();
      g.save(); pathOf(g, rag, true); g.clip();
      for (const v of [-0.33, 0.33]) line(g, [rq(-rw, v * rh), rq(rw, v * rh * 1.1)], 'rgba(20,10,2,0.3)', Math.max(0.7, o.ink * 0.9));
      line(g, [rq(0, -rh), rq(rw * 0.04, rh)], 'rgba(20,10,2,0.22)', Math.max(0.7, o.ink * 0.8));
      pathOf(g, [rq(rw, rh * 0.9), rq(rw * 0.35, rh * 0.95), rq(rw, rh * 0.1)], true); g.fillStyle = shade(linen, 0.2); g.fill(); line(g, [rq(rw * 0.35, rh * 0.95), rq(rw, rh * 0.1)], 'rgba(20,10,2,0.4)', Math.max(0.7, o.ink * 0.8));
      if (o.fine) fineWork(g, seeded(774), rq, rw, rh, { along: false, dark: '20,12,4', pale: '255,246,228', much: 1.2 });
      g.restore(); thinLine(g, rag, true, linen, o, 0.9); rel(o, rag, true, 0.75, 0.03);
      for (let i = -4; i <= 4; i++) stud(g, o, ...p(i * L * 0.22, -W * 0.84), Math.max(0.8, s * 0.009), pal, 0.74);
    }
    worn(g, rng, o, top, a, L, pal.wear); thinLine(g, top, true, pal.wood, o, 1.2);
    return [base, top];
  },
  // ------------------------------------------------------------------ the rest of the decorations, batch by batch
  bed(g, s, rng, o, pal) {
    // A bedstead: head and foot boards between four turned posts, a linen mattress and pillow, a blanket turned back.
    const a = (rng() - 0.5) * 0.1, p = at(a), L = s * 0.86, W = s * 0.5, frame = boxAt(0, 0, L, W, a), linen = hexOf(mix(pal.cloth, '#e2d8c2', 0.82));
    under(g, frame, o, 0.35); pathOf(g, frame, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * W * 0.93), L * 0.92, W * 0.07, a, pal.wood, 0.42);
    clothFlat(g, o, boxAt(...p(L * 0.03, 0), L * 0.86, W * 0.85, a), true, linen, 0.44);
    pad(g, rng, o, ...p(-L * 0.64, 0), L * 0.17, W * 0.62, a, { ...pal, cloth: linen, clothLit: hexOf(shade(linen, 0.14)) }, 0.5);
    const bl = boxAt(...p(L * 0.3, 0), L * 0.58, W * 0.9, a);
    clothFlat(g, o, bl, true, pal.cloth, 0.5, [[p(-L * 0.2, -W * 0.5), p(L * 0.3, -W * 0.4), p(L * 0.85, -W * 0.52)], [p(-L * 0.1, W * 0.34), p(L * 0.4, W * 0.24), p(L * 0.86, W * 0.36)], [p(L * 0.15, -W * 0.06), p(L * 0.7, W * 0.03)]]);
    if (o.detail) { g.save(); pathOf(g, bl, true); g.clip(); for (const u of [0.0, 0.07, 0.62, 0.69]) line(g, [p(L * u, -W), p(L * u, W)], mix(pal.cloth, '#f4ead0', 0.5).replace('rgb', 'rgba').replace(')', ',0.55)'), Math.max(1, W * 0.045), 'butt'); g.restore(); }
    clothFlat(g, o, boxAt(...p(-L * 0.32, 0), L * 0.055, W * 0.9, a), true, hexOf(shade(pal.cloth, 0.22)), 0.54);
    plank(g, rng, o, ...p(-L * 0.96, 0), W * 1.0, L * 0.06, a + Math.PI / 2, shade(pal.wood, -0.1), 0.82);
    plank(g, rng, o, ...p(L * 0.97, 0), W * 1.0, L * 0.045, a + Math.PI / 2, shade(pal.wood, -0.1), 0.62);
    for (const [u, v] of C4) post(g, o, p(u * L * 0.96, v * W * 1.0), W * 0.13, pal, u < 0 ? 0.95 : 0.76);
    return [frame];
  },
  desk(g, s, rng, o, pal) {
    // A writing desk: three boards, a leather pad let into it, and what a clerk leaves lying.
    const a = (rng() - 0.5) * 0.12, p = at(a), L = s * 0.88, W = s * 0.5, top = boxAt(0, 0, L, W, a), leather = hexOf(mix(pal.cloth, '#3a2414', 0.55));
    for (const [u, v] of C4) { const leg = boxAt(...p(u * L * 0.92, v * W * 0.92), W * 0.12, W * 0.12, a); pathOf(g, leg, true); g.fillStyle = pal.woodDark; g.fill(); thinLine(g, leg, true, pal.wood, o, 0.9); rel(o, leg, true, 0.3); }
    under(g, top, o, 0.35); pathOf(g, top, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = -1; k <= 1; k++) plank(g, rng, o, ...p(0, k * W * 0.667), L, W * 0.333, a, pal.wood, 0.6);
    clothFlat(g, o, boxAt(...p(0, W * 0.2), L * 0.44, W * 0.52, a), true, leather, 0.63);
    pathOf(g, boxAt(...p(0, W * 0.2), L * 0.39, W * 0.44, a), true); g.strokeStyle = mix(pal.metalLit, leather, 0.35); g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke();
    if (o.detail) {
      for (const [u, v, t] of [[-0.1, 0.22, 0.2], [0.14, 0.12, -0.14]]) { const sheet = boxAt(...p(u * L, v * W), L * 0.15, W * 0.3, a + t), q = at(a + t, ...p(u * L, v * W)); under(g, sheet, o, 0.2); pathOf(g, sheet, true); g.fillStyle = '#e6dcc2'; g.fill(); for (let i = -3; i <= 3; i++) line(g, [q(-L * 0.11, i * W * 0.07), q(L * (0.04 + ((i * 7 + 21) % 5) * 0.015), i * W * 0.07)], 'rgba(40,28,16,0.5)', Math.max(0.5, o.ink * 0.45)); thinLine(g, sheet, true, '#e6dcc2', o, 0.7); rel(o, sheet, true, 0.65, 0.05); }
      // An inkwell, and a quill laid by it.
      const ink = p(L * 0.66, -W * 0.5), ir = W * 0.13; disc(g, ink[0], ink[1], ir, pal.metalDark); disc(g, ink[0], ink[1], ir * 0.55, '#0c0a10'); ring(g, ink[0], ink[1], ir, mix(pal.metal, '#0c0904', 0.9), Math.max(0.7, o.ink * 0.9)); relDome(o, circle(ink[0], ink[1], ir), ink[0], ink[1], ir, 0.66, 0.74, 0.85);
      const q0 = p(L * 0.6, -W * 0.2), q1 = p(L * 0.3, W * 0.5), qd = [(q1[0] - q0[0]), (q1[1] - q0[1])], qn = [-qd[1] * 0.09, qd[0] * 0.09];
      for (let i = 2; i <= 9; i++) { const c = [q0[0] + qd[0] * (i / 10), q0[1] + qd[1] * (i / 10)], k = Math.sin((i / 10) * Math.PI) ; line(g, [[c[0] - qn[0] * k, c[1] - qn[1] * k], [c[0] - qd[0] * 0.06, c[1] - qd[1] * 0.06], [c[0] + qn[0] * k, c[1] + qn[1] * k]], 'rgba(238,232,218,0.85)', Math.max(0.6, o.ink * 0.7)); }
      line(g, [q0, q1], 'rgba(60,40,20,0.8)', Math.max(0.6, o.ink * 0.6));
      // A book, shut, and a candle burnt down in its dish.
      const bk = boxAt(...p(-L * 0.64, -W * 0.34), L * 0.15, W * 0.3, a - 0.18), bq = at(a - 0.18, ...p(-L * 0.64, -W * 0.34)); under(g, bk, o, 0.3); clothFlat(g, o, bk, true, pal.cloth, 0.72); line(g, [bq(-L * 0.11, -W * 0.3), bq(-L * 0.11, W * 0.3)], 'rgba(8,4,0,0.45)', Math.max(0.7, o.ink * 0.9)); for (const v of [-0.2, 0.2]) line(g, [bq(-L * 0.15, v * W), bq(-L * 0.11, v * W)], mix(pal.metalLit, pal.cloth, 0.3), Math.max(0.7, o.ink * 0.9));
      const cd = p(-L * 0.72, W * 0.56), cr = W * 0.12; disc(g, cd[0], cd[1], cr, pal.metal); ring(g, cd[0], cd[1], cr, mix(pal.metal, '#0c0904', 0.9), Math.max(0.7, o.ink * 0.9)); disc(g, cd[0], cd[1], cr * 0.5, '#e8dcc0'); disc(g, cd[0], cd[1], cr * 0.12, '#1a1208'); relDome(o, circle(cd[0], cd[1], cr), cd[0], cd[1], cr, 0.64, 0.74, 0.6);
    }
    worn(g, rng, o, top, a, L, pal.wear); thinLine(g, top, true, pal.wood, o, 1.2);
    return [top];
  },
  bookshelf(g, s, rng, o, pal) {
    // A bookcase against a wall, seen from over it: its top board, and past the edge of that the spines of its books.
    const a = (rng() - 0.5) * 0.06, p = at(a), L = s * 0.92, D = s * 0.3, body = boxAt(0, 0, L, D, a);
    under(g, body, o, 0.35); pathOf(g, body, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.78); g.fill(); rel(o, body, true, 0.3);
    for (let u = -L * 0.93; u < L * 0.9;) {
      const w = L * (0.03 + rng() * 0.045), gap = rng() < 0.08, lean = rng() < 0.12 ? (rng() - 0.5) * 0.3 : 0, v0 = D * (0.44 + rng() * 0.08), v1 = D * (0.9 + rng() * 0.08);
      if (!gap && u + w < L * 0.93) {
        const dye = varied(hexOf(mix(CLOTHS[CLOTH_IDS[Math.floor(rng() * CLOTH_IDS.length)]].base, '#3a2c1c', 0.3)), rng, 1.4), c = p(u + w / 2, (v0 + v1) / 2), book = boxAt(c[0], c[1], w * 0.46, (v1 - v0) / 2, a + lean), q = at(a + lean, c[0], c[1]);
        pathOf(g, book, true); g.fillStyle = dye; g.fill();
        for (const k of [-0.55, 0.5]) line(g, [q(-w * 0.46, k * (v1 - v0) / 2), q(w * 0.46, k * (v1 - v0) / 2)], mix(pal.metalLit, dye, 0.4), Math.max(0.5, o.ink * 0.6), 'butt');
        line(g, [q(-w * 0.46, (v1 - v0) / 2), q(w * 0.46, (v1 - v0) / 2)], 'rgba(235,225,200,0.7)', Math.max(0.6, o.ink * 0.8), 'butt');
        pathOf(g, book, true); g.strokeStyle = 'rgba(16,7,0,0.9)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); rel(o, book, true, 0.5 + rng() * 0.12, 0.08);
      }
      u += w;
    }
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * L * 0.97, D * 0.36), D * 0.64, L * 0.03, a + Math.PI / 2, shade(pal.wood, -0.15), 0.88);
    const topB = boxAt(...p(0, -D * 0.3), L, D * 0.7, a); under(g, topB, o, 0.45);
    for (const k of [-0.5, 0.5]) plank(g, rng, o, ...p(0, -D * 0.3 + k * D * 0.7), L, D * 0.35, a, pal.wood, 0.92);
    if (o.detail) {
      // Left on top of it: two books stacked, a scroll, a candle.
      for (const [du, t, k] of [[0, 0.1, 0], [0.01, -0.2, 1]]) { const bk = boxAt(...p((-0.55 + du) * L, -D * 0.3), L * (0.11 - k * 0.015), D * (0.42 - k * 0.06), a + t); under(g, bk, o, 0.25); clothFlat(g, o, bk, true, k ? hexOf(shade(pal.cloth, -0.2)) : pal.cloth, 0.96 + k * 0.02); }
      const sc = boxAt(...p(L * 0.2, -D * 0.3), L * 0.14, D * 0.14, a + 0.3); under(g, sc, o, 0.25); pathOf(g, sc, true); g.fillStyle = '#e2d6b8'; g.fill(); thinLine(g, sc, true, '#e2d6b8', o, 0.8); rel(o, sc, true, 0.97, 0.05);
      const cd = p(L * 0.66, -D * 0.3), cr = D * 0.2; disc(g, cd[0], cd[1], cr, pal.metal); ring(g, cd[0], cd[1], cr, mix(pal.metal, '#0c0904', 0.9), Math.max(0.7, o.ink * 0.9)); disc(g, cd[0], cd[1], cr * 0.5, '#e8dcc0'); disc(g, cd[0], cd[1], cr * 0.12, '#1a1208'); relDome(o, circle(cd[0], cd[1], cr), cd[0], cd[1], cr, 0.94, 1, 0.6);
    }
    thinLine(g, topB, true, pal.wood, o, 1.1); thinLine(g, body, true, pal.wood, o, 1.2);
    return [body];
  },
  throne(g, s, rng, o, pal) {
    // A high seat: a broad carved back between two tall posts, an arm either side ending in a knob, a cushion, a step.
    const a = (rng() - 0.5) * 0.06, p = at(a), H = s * 0.52, base = boxAt(...p(0, H * 0.1), H * 1.05, H * 1.05, a), back = boxAt(...p(0, -H * 1.1), H * 1.15, H * 0.24, a);
    under(g, boxAt(...p(0, H * 1.34), H * 0.9, H * 0.2, a), o, 0.3); plank(g, rng, o, ...p(0, H * 1.34), H * 0.9, H * 0.2, a, shade(pal.wood, -0.1), 0.2);
    under(g, base, o, 0.4); pathOf(g, base, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = -1; k <= 1; k++) plank(g, rng, o, ...p(k * H * 0.7, H * 0.1), H * 1.05, H * 0.35, a + Math.PI / 2, pal.wood, 0.45);
    pad(g, rng, o, ...p(0, H * 0.22), H * 0.64, H * 0.7, a, pal, 0.5);
    for (const u of [-1, 1]) { under(g, boxAt(...p(u * H * 0.92, H * 0.15), H * 0.15, H * 0.95, a), o, 0.4); plank(g, rng, o, ...p(u * H * 0.92, H * 0.15), H * 0.95, H * 0.15, a + Math.PI / 2, shade(pal.wood, -0.12), 0.7); post(g, o, p(u * H * 0.92, H * 1.08), H * 0.18, pal, 0.8); }
    under(g, back, o, 0.5); plank(g, rng, o, ...p(0, -H * 1.1), H * 1.15, H * 0.24, a, pal.wood, 0.94);
    if (o.detail) {
      // Carved along its back, a boss of metal at its middle, studs either side of it.
      g.save(); pathOf(g, back, true); g.clip();
      for (let i = -4; i <= 4; i++) { if (!i) continue; const u = i * H * 0.23, arc = Array.from({ length: 7 }, (_, k) => { const t = Math.PI * (k / 6); return p(u + Math.cos(t) * H * 0.09, -H * 1.0 - Math.sin(t) * H * 0.16); }); line(g, arc, 'rgba(30,12,0,0.6)', Math.max(0.7, o.ink * 0.9)); line(g, arc.map(([x, y]) => [x, y + o.ink * 0.8]), 'rgba(255,232,190,0.28)', Math.max(0.5, o.ink * 0.5)); relLine(o, arc, Math.max(1, o.ink * 1.2), 0.84, 0.2); }
      g.restore();
      const boss = p(0, -H * 1.1), br = H * 0.17; disc(g, boss[0], boss[1], br, pal.metal); disc(g, boss[0], boss[1], br * 0.5, pal.cloth); ring(g, boss[0], boss[1], br * 0.5, mix(pal.cloth, '#0c0904', 0.8), Math.max(0.6, o.ink * 0.7)); ring(g, boss[0], boss[1], br, mix(pal.metal, '#0c0904', 0.9), Math.max(0.8, o.ink)); relDome(o, circle(boss[0], boss[1], br), boss[0], boss[1], br, 0.94, 1, 0.9);
      for (const u of [-0.7, -0.45, 0.45, 0.7]) stud(g, o, ...p(u * H, -H * 1.22), Math.max(0.9, H * 0.035), pal, 0.98);
      for (let i = -3; i <= 3; i++) stud(g, o, ...p(i * H * 0.27, H * 1.08), Math.max(0.8, H * 0.03), pal, 0.48);
    }
    for (const u of [-1, 1]) post(g, o, p(u * H * 1.12, -H * 1.1), H * 0.2, pal, 1);
    thinLine(g, base, true, pal.wood, o, 1.2); thinLine(g, back, true, pal.wood, o, 1.1);
    return [base, back];
  },
  bathtub(g, s, rng, o, pal) {
    // A long staved tub, banded in metal, full.
    const a = (rng() - 0.5) * 0.2, p = at(a), RX = s * 0.86, RY = s * 0.5, outer = oval(0, 0, RX, RY, a, 44), inner = oval(0, 0, RX * 0.85, RY * 0.76, a, 40), N = 22, linen = hexOf(mix(pal.cloth, '#e2d8c2', 0.7));
    under(g, outer, o, 0.35);
    for (let i = 0; i < N; i++) { const t0 = (i / N) * 6.283, t1 = t0 + 6.283 / N, e = (t, kx, ky) => p(Math.cos(t) * RX * kx, Math.sin(t) * RY * ky), stave = [e(t0, 0.83, 0.74), e(t0, 1, 1), e(t1, 1, 1), e(t1, 0.83, 0.74)]; pathOf(g, stave, true); g.fillStyle = varied(hexOf(shade(pal.wood, (rng() - 0.5) * 0.2)), rng, 1.2); g.fill(); g.strokeStyle = 'rgba(16,7,0,0.9)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
    rel(o, outer, false, 0.5, 0.07);
    { const band = oval(0, 0, RX * 0.925, RY * 0.88, a, 44); band.push(band[0]); line(g, band, mix(pal.metal, '#0c0904', 0.85), Math.max(1.8, s * 0.05)); line(g, band, pal.metal, Math.max(1, s * 0.03)); relLine(o, band, Math.max(1.6, s * 0.04), 0.56, 0.85); for (let i = 0; i < 10; i++) { const t = (i / 10) * 6.283 + 0.3; stud(g, o, ...p(Math.cos(t) * RX * 0.925, Math.sin(t) * RY * 0.88), Math.max(0.8, s * 0.011), pal, 0.6); } }
    water(g, rng, o, inner, false, 0.22);
    if (o.detail) {
      // Suds at the one end, a towel over its side, a cake of soap on the rim.
      const sr = seeded(881); for (let i = 0; i < 12; i++) { const c = p(-RX * (0.3 + sr() * 0.4), (sr() - 0.5) * RY * 0.8), r = s * (0.025 + sr() * 0.04); disc(g, c[0], c[1], r, 'rgba(238,243,245,0.88)'); ring(g, c[0], c[1], r, 'rgba(110,130,140,0.5)', Math.max(0.5, o.ink * 0.5)); }
      const tw = boxAt(...p(RX * 0.25, RY * 0.9), RX * 0.2, RY * 0.24, a + 0.1); under(g, tw, o, 0.3); clothFlat(g, o, tw, true, linen, 0.6, [[p(RX * 0.1, RY * 0.9), p(RX * 0.42, RY * 0.94)], [p(RX * 0.25, RY * 0.7), p(RX * 0.27, RY * 1.1)]]);
      const sp = boxAt(...p(RX * 0.62, -RY * 0.62), RX * 0.07, RY * 0.07, a + 0.5); pathOf(g, sp, true); g.fillStyle = '#d9cfa8'; g.fill(); thinLine(g, sp, true, '#d9cfa8', o, 0.8); rel(o, sp, true, 0.56, 0.3);
    }
    thinLine(g, inner, false, pal.wood, o, 0.9); thinLine(g, outer, false, pal.wood, o, 1.2);
    return [outer];
  },
  weaponRack(g, s, rng, o, pal) {
    // Two rails on a pair of feet, and arms laid across them: a sword, an axe, a spear, a mace.
    const a = (rng() - 0.5) * 0.08, p = at(a), L = s * 0.88, W = s * 0.4, box = boxAt(0, 0, L, W * 0.75, a);
    for (const u of [-0.86, 0.86]) { under(g, boxAt(...p(u * L, 0), L * 0.06, W * 1.0, a), o, 0.3); plank(g, rng, o, ...p(u * L, 0), W * 1.0, L * 0.06, a + Math.PI / 2, shade(pal.wood, -0.15), 0.3); }
    for (const v of [-0.55, 0.55]) { under(g, boxAt(...p(0, v * W), L, W * 0.1, a), o, 0.35); plank(g, rng, o, ...p(0, v * W), L, W * 0.1, a, pal.wood, 0.78); }
    const haft = (u, v0, v1, w) => { const h = boxAt(...p(u * L, (v0 + v1) / 2 * W), L * w, Math.abs(v1 - v0) / 2 * W, a); under(g, h, o, 0.3); pathOf(g, h, true); g.fillStyle = shade(pal.wood, -0.16); g.fill(); thinLine(g, h, true, pal.wood, o, 0.8); rel(o, h, true, 0.88, 0.12); };
    // The sword: a tapered blade with a fuller down it, a guard, a bound grip, a pommel.
    { const u = -0.6 * L, bw = L * 0.036, blade = [p(u - bw, -W * 0.5), p(u + bw, -W * 0.5), p(u + bw * 0.85, W * 0.8), p(u, W * 1.02), p(u - bw * 0.85, W * 0.8)]; under(g, blade, o, 0.3); plate(g, o, blade, { ...pal, metal: hexOf(pal.metalLit) }, 0.9); line(g, [p(u, -W * 0.46), p(u, W * 0.7)], 'rgba(20,20,24,0.4)', Math.max(0.6, o.ink * 0.7)); const grip = boxAt(...p(u, -W * 0.74), L * 0.022, W * 0.19, a); pathOf(g, grip, true); g.fillStyle = pal.woodDark; g.fill(); for (let i = -2; i <= 2; i++) line(g, [p(u - L * 0.022, (-0.74 + i * 0.07) * W), p(u + L * 0.022, (-0.71 + i * 0.07) * W)], 'rgba(8,4,0,0.5)', Math.max(0.5, o.ink * 0.5)); thinLine(g, grip, true, pal.wood, o, 0.8); rel(o, grip, true, 0.9, 0.1); plate(g, o, boxAt(...p(u, -W * 0.53), L * 0.1, W * 0.04, a), pal, 0.92); stud(g, o, ...p(u, -W * 0.96), Math.max(1, L * 0.03), pal, 0.92); }
    // The axe.
    haft(-0.24, -0.95, 0.95, 0.02); { const u = -0.24 * L, head = [p(u - L * 0.02, -W * 0.82), p(u + L * 0.14, -W * 0.96), p(u + L * 0.17, -W * 0.68), p(u + L * 0.14, -W * 0.4), p(u - L * 0.02, -W * 0.54)]; under(g, head, o, 0.3); plate(g, o, head, pal, 0.94); line(g, [p(u + L * 0.14, -W * 0.94), p(u + L * 0.165, -W * 0.68), p(u + L * 0.14, -W * 0.42)], 'rgba(255,255,255,0.35)', Math.max(0.6, o.ink * 0.7)); }
    // The spear.
    haft(0.12, -0.9, 1.05, 0.015); { const u = 0.12 * L, head = [p(u, -W * 1.3), p(u + L * 0.038, -W * 1.04), p(u, -W * 0.86), p(u - L * 0.038, -W * 1.04)]; under(g, head, o, 0.3); plate(g, o, head, { ...pal, metal: hexOf(pal.metalLit) }, 0.92); line(g, [p(u, -W * 1.26), p(u, -W * 0.9)], 'rgba(20,20,24,0.4)', Math.max(0.6, o.ink * 0.6)); }
    // The mace.
    haft(0.46, -0.6, 0.95, 0.02); { const c = p(0.46 * L, -W * 0.78), r = L * 0.07; under(g, circle(c[0], c[1], r), o, 0.3); disc(g, c[0], c[1], r, pal.metal); ring(g, c[0], c[1], r, mix(pal.metal, '#0c0904', 0.9), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.86, 0.98, 0.85); for (let i = 0; i < 6; i++) stud(g, o, c[0] + Math.cos(i * 1.047) * r * 0.62, c[1] + Math.sin(i * 1.047) * r * 0.62, Math.max(0.8, r * 0.2), pal, 1); }
    if (o.detail) {
      // A round shield hung at its end: three boards, an iron rim, a boss.
      const c = p(L * 0.72, W * 0.1), r = W * 0.5; under(g, circle(c[0], c[1], r), o, 0.4); roundBoards(g, rng, o, c[0], c[1], r, a + 0.4, hexOf(mix(pal.wood, pal.cloth, 0.45)), 0.9, 3);
      ring(g, c[0], c[1], r * 0.94, pal.metal, r * 0.1); ring(g, c[0], c[1], r, mix(pal.metal, '#0c0904', 0.92), Math.max(0.8, o.ink)); ring(g, c[0], c[1], r * 0.88, 'rgba(8,4,0,0.6)', Math.max(0.5, o.ink * 0.6));
      disc(g, c[0], c[1], r * 0.26, pal.metal); ring(g, c[0], c[1], r * 0.26, mix(pal.metal, '#0c0904', 0.9), Math.max(0.7, o.ink * 0.9)); relDome(o, circle(c[0], c[1], r * 0.26), c[0], c[1], r * 0.26, 0.92, 1, 0.9);
      for (let i = 0; i < 8; i++) stud(g, o, c[0] + Math.cos(i * 0.785) * r * 0.94, c[1] + Math.sin(i * 0.785) * r * 0.94, Math.max(0.8, r * 0.05), pal, 0.96);
    }
    return [box];
  },
  washtub(g, s, rng, o, pal) {
    // A broad low tub of staves, soapy, a washboard stood in it.
    const a = rng() * 6.28, R = s * 0.78, rim = circle(0, 0, R, 40), N = 16, inner = R * 0.8, pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r], p = at(a);
    for (const u of [-1, 1]) plate(g, o, boxAt(...p(u * R * 1.02, 0), R * 0.06, R * 0.2, a), pal, 0.4);
    under(g, rim, o, 0.3);
    for (let i = 0; i < N; i++) { const t0 = a + (i / N) * 6.283, t1 = t0 + 6.283 / N, stave = [pol(inner * 0.97, t0), pol(R, t0), pol(R * 1.006, (t0 + t1) / 2), pol(R, t1), pol(inner * 0.97, t1)]; pathOf(g, stave, true); g.fillStyle = varied(hexOf(shade(pal.wood, (rng() - 0.5) * 0.2)), rng, 1.2); g.fill(); g.strokeStyle = 'rgba(16,7,0,0.9)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
    relRing(o, (R + inner) / 2, R - inner, 0.4, 0.07); hoop(g, o, R * 0.91, Math.max(1.3, s * 0.045), pal, 0.44);
    water(g, rng, o, circle(0, 0, inner, 36), false, 0.2);
    { const sr = seeded(882); for (let i = 0; i < 14; i++) { const t = sr() * 6.283, d = Math.sqrt(sr()) * inner * 0.85, r = s * (0.02 + sr() * 0.035); disc(g, Math.cos(t) * d, Math.sin(t) * d, r, 'rgba(238,243,245,0.8)'); ring(g, Math.cos(t) * d, Math.sin(t) * d, r, 'rgba(110,130,140,0.45)', Math.max(0.5, o.ink * 0.5)); } }
    if (o.detail) {
      // The washboard: a frame round a ribbed plate. And a shirt soaking.
      const wc = p(inner * 0.28, -inner * 0.1), wq = at(a + 0.5, wc[0], wc[1]), wb = boxAt(wc[0], wc[1], inner * 0.5, inner * 0.3, a + 0.5); under(g, wb, o, 0.3); pathOf(g, wb, true); g.fillStyle = pal.wood; g.fill(); plate(g, o, boxAt(wc[0], wc[1], inner * 0.4, inner * 0.22, a + 0.5), pal, 0.5);
      for (let i = -4; i <= 4; i++) line(g, [wq(i * inner * 0.085, -inner * 0.2), wq(i * inner * 0.085, inner * 0.2)], i % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(8,8,10,0.4)', Math.max(0.6, o.ink * 0.7), 'butt'); thinLine(g, wb, true, pal.wood, o, 0.9);
      const shirt = blob(seeded(883), ...p(-inner * 0.42, inner * 0.3), inner * 0.3, inner * 0.22, 11, 0.25); clothFlat(g, o, shirt, false, pal.cloth, 0.3, [[p(-inner * 0.6, inner * 0.25), p(-inner * 0.3, inner * 0.34)], [p(-inner * 0.5, inner * 0.42), p(-inner * 0.3, inner * 0.2)]]);
    }
    ring(g, 0, 0, inner, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); thinLine(g, rim, false, pal.wood, o, 1.2);
    return [rim];
  },
  trough(g, s, rng, o, pal) {
    // A long plank trough on two cross feet, full of water.
    const a = (rng() - 0.5) * 0.1, p = at(a), L = s * 0.92, W = s * 0.3, box = boxAt(0, 0, L, W, a);
    for (const u of [-0.7, 0.7]) { under(g, boxAt(...p(u * L, 0), L * 0.05, W * 1.25, a), o, 0.3); plank(g, rng, o, ...p(u * L, 0), W * 1.25, L * 0.05, a + Math.PI / 2, shade(pal.wood, -0.18), 0.2); }
    under(g, box, o, 0.35); pathOf(g, box, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.7); g.fill();
    water(g, rng, o, boxAt(0, 0, L * 0.9, W * 0.7, a), true, 0.24);
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * W * 0.84), L, W * 0.16, a, pal.wood, 0.5);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * L * 0.95, 0), W * 0.68, L * 0.05, a + Math.PI / 2, pal.wood, 0.5);
    if (o.detail) {
      // Iron cleats over its walls, straw adrift in it, green where it stays wet.
      for (const u of [-0.45, 0.45]) for (const v of [-0.84, 0.84]) { plate(g, o, boxAt(...p(u * L, v * W), L * 0.035, W * 0.19, a), pal, 0.56); stud(g, o, ...p(u * L, v * W), Math.max(0.8, s * 0.01), pal, 0.62); }
      const sr = seeded(884); for (let i = 0; i < 9; i++) { const c = p((sr() - 0.5) * L * 1.6, (sr() - 0.5) * W * 1.0), t = sr() * 3.14, len = s * (0.03 + sr() * 0.05); line(g, [c, [c[0] + Math.cos(t) * len, c[1] + Math.sin(t) * len]], 'rgba(214,190,120,0.75)', Math.max(0.6, o.ink * 0.7)); }
      g.save(); pathOf(g, box, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; for (const [u, v] of [[-0.9, 0.8], [0.6, -0.85]]) { const c = p(u * L, v * W); g.fillStyle = 'rgba(70,96,40,0.4)'; g.beginPath(); g.ellipse(c[0], c[1], L * 0.14, W * 0.2, a, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
    }
    thinLine(g, box, true, pal.wood, o, 1.2);
    return [box];
  },
  firewood(g, s, rng, o, pal) {
    // A stack of split logs: a row laid side by side, a shorter row on top of it, their cut ends pale.
    const a = (rng() - 0.5) * 0.3, p = at(a), HL = s * 0.7, box = boxAt(0, 0, HL * 1.05, s * 0.72, a), bark = hexOf(mix(pal.wood, '#3a2a1c', 0.6));
    under(g, box, o, 0.3);
    const lay = (n, hw, h, shift) => { for (let i = 0; i < n; i++) { const v = (i - (n - 1) / 2) * hw * 2.04 + shift, u = (rng() - 0.5) * HL * 0.14, hl = HL * (0.88 + rng() * 0.14), c = p(u, v); under(g, boxAt(c[0], c[1], hl, hw, a), o, 0.3); plank(g, rng, o, c[0], c[1], hl, hw, a, rng() < 0.35 ? shade(pal.wood, 0.1) : bark, h); for (const e of [-1, 1]) cutEnd(g, rng, o, p(u + e * hl * 0.985, v), hw * 0.34, hw * 0.94, a, pal, h); } };
    lay(6, s * 0.115, 0.3, 0); lay(o.detail ? 4 : 3, s * 0.115, 0.55, s * 0.03);
    if (o.detail) for (const [u, v, t] of [[0.2, 0.86, 0.3], [-0.5, -0.9, -0.5]]) { const c = p(u * s, v * s); plank(g, rng, o, c[0], c[1], s * 0.2, s * 0.045, a + t, shade(pal.wood, 0.12), 0.1); }
    return [box];
  },
  choppingBlock(g, s, rng, o, pal) {
    // A broad stump for a block, an axe left standing in it, chips all round.
    const a = rng() * 6.28, p = at(a), R = s * 0.52, block = circle(0, 0, R, 36);
    if (o.detail) { const sr = seeded(885); for (let i = 0; i < 16; i++) { const t = sr() * 6.283, d = R * (1.08 + sr() * 0.6), c = [Math.cos(t) * d, Math.sin(t) * d], k = sr() * 3.14, len = s * (0.03 + sr() * 0.05); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], 'rgba(226,200,150,0.85)', Math.max(1, s * 0.016)); } { const c = p(R * 1.25, R * 0.9); plank(g, rng, o, c[0], c[1], s * 0.24, s * 0.07, a + 0.7, shade(pal.wood, 0.12), 0.12); } }
    under(g, block, o, 0.35); stumpTop(g, rng, o, 0, 0, R, a, pal, 0.45);
    // The axe: its haft out over the block's edge, its head bitten into the wood.
    const haft = boxAt(...p(R * 0.55, 0), R * 0.75, R * 0.07, a); under(g, haft, o, 0.35); pathOf(g, haft, true); g.fillStyle = shade(pal.wood, 0.02); g.fill(); thinLine(g, haft, true, pal.wood, o, 0.9); rel(o, haft, true, 0.85, 0.12);
    const head = [p(-R * 0.3, -R * 0.09), p(-R * 0.02, -R * 0.12), p(-R * 0.02, R * 0.12), p(-R * 0.3, R * 0.09), p(-R * 0.34, 0)]; under(g, head, o, 0.3); plate(g, o, head, pal, 0.9);
    line(g, [p(-R * 0.6, 0), p(-R * 0.34, 0)], 'rgba(16,7,0,0.8)', Math.max(0.8, o.ink));
    return [block];
  },
  anvil(g, s, rng, o, pal) {
    // An anvil on its block: a flat face, a horn drawn to a point, a hardy hole and a pritchel hole.
    const a = (rng() - 0.5) * 0.4, p = at(a), R = s * 0.62, block = circle(0, 0, R, 32), L = s * 0.5, W = s * 0.2, iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.55)) };
    under(g, block, o, 0.35); stumpTop(g, rng, o, 0, 0, R, a + 0.6, pal, 0.35);
    const foot = boxAt(...p(-L * 0.1, 0), L * 0.62, W * 1.3, a); under(g, foot, o, 0.35); plate(g, o, foot, iron, 0.6);
    const body = [p(-L * 0.78, -W), p(L * 0.3, -W), p(L * 0.62, -W * 0.72), p(L * 1.12, 0), p(L * 0.62, W * 0.72), p(L * 0.3, W), p(-L * 0.78, W)];
    under(g, body, o, 0.4); plate(g, o, body, iron, 0.95);
    const face = boxAt(...p(-L * 0.24, 0), L * 0.52, W * 0.86, a); pathOf(g, face, true); g.fillStyle = mix(iron.metal, '#c8ccd2', 0.3); g.fill(); thinLine(g, face, true, iron.metal, o, 0.7); rel(o, face, true, 1, 0.95);
    { const h = boxAt(...p(-L * 0.6, 0), W * 0.2, W * 0.2, a); pathOf(g, h, true); g.fillStyle = '#0c0a0a'; g.fill(); const c = p(-L * 0.6, W * 0.52); disc(g, c[0], c[1], Math.max(0.8, W * 0.1), '#0c0a0a'); }
    line(g, [p(L * 0.3, -W), p(L * 0.3, W)], 'rgba(8,8,10,0.5)', Math.max(0.6, o.ink * 0.7));
    if (o.detail) {
      // A hammer left on the block, and scale shed round the anvil's foot.
      const hq = at(a + 1.1, ...p(-L * 0.2, R * 0.66)), hh = boxAt(...hq(0, 0), R * 0.42, R * 0.045, a + 1.1); under(g, hh, o, 0.3); pathOf(g, hh, true); g.fillStyle = shade(pal.wood, 0.02); g.fill(); thinLine(g, hh, true, pal.wood, o, 0.8); rel(o, hh, true, 0.45, 0.12);
      const hd = boxAt(...hq(R * 0.4, 0), R * 0.08, R * 0.15, a + 1.1); under(g, hd, o, 0.3); plate(g, o, hd, iron, 0.52);
      const sr = seeded(886); for (let i = 0; i < 18; i++) { const t = sr() * 6.283, d = R * (0.5 + sr() * 0.45); disc(g, Math.cos(t) * d, Math.sin(t) * d, Math.max(0.6, s * (0.006 + sr() * 0.008)), sr() < 0.3 ? 'rgba(200,120,50,0.8)' : 'rgba(24,22,24,0.8)'); }
    }
    return [block];
  },
  cage(g, s, rng, o, pal) {
    // An iron cage from over it: a frame, bars both ways across its top, straw on its floor, a lock on its door.
    const a = (rng() - 0.5) * 0.14, p = at(a), H = s * 0.74, box = boxAt(0, 0, H, H, a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) };
    under(g, box, o, 0.4); pathOf(g, box, true); g.fillStyle = '#2a2118'; g.fill(); rel(o, box, true, 0.1, 0.03);
    g.save(); pathOf(g, box, true); g.clip();
    { const sr = seeded(887); for (let i = 0; i < 70; i++) { const c = p((sr() - 0.5) * H * 1.9, (sr() - 0.5) * H * 1.9), t = sr() * 3.14, len = s * (0.04 + sr() * 0.09); line(g, [c, [c[0] + Math.cos(t) * len, c[1] + Math.sin(t) * len]], `rgba(${200 + Math.round(sr() * 30)},${170 + Math.round(sr() * 30)},100,${0.45 + sr() * 0.4})`, Math.max(0.6, o.ink * 0.7)); } }
    if (o.detail) { const b0 = p(-H * 0.3, H * 0.2), b1 = p(H * 0.1, H * 0.42); line(g, [b0, b1], 'rgba(20,10,4,0.9)', Math.max(2, s * 0.07)); line(g, [b0, b1], '#ded2b6', Math.max(1.2, s * 0.045)); for (const b of [b0, b1]) disc(g, b[0], b[1], s * 0.04, '#ded2b6'); const d = p(H * 0.4, -H * 0.35); disc(g, d[0], d[1], s * 0.12, hexOf(mix(iron.metal, '#5a4a3a', 0.4))); disc(g, d[0], d[1], s * 0.08, '#22303a'); ring(g, d[0], d[1], s * 0.12, 'rgba(8,6,6,0.9)', Math.max(0.7, o.ink * 0.9)); }
    { const gr = g.createRadialGradient(0, 0, H * 0.3, 0, 0, H * 1.3); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore();
    const bar = (pts, w) => { line(g, pts, 'rgba(8,6,6,0.6)', w * 2.1, 'butt'); line(g, pts, mix(iron.metal, '#0c0904', 0.6), w * 1.5, 'butt'); line(g, pts, iron.metal, w, 'butt'); relLine(o, pts, w * 1.5, 0.95, 0.85); };
    for (let i = -3; i <= 3; i++) bar([p(i * H * 0.27, -H), p(i * H * 0.27, H)], Math.max(1, s * 0.022));
    for (const v of [-0.5, 0, 0.5]) bar([p(-H, v * H), p(H, v * H)], Math.max(1.2, s * 0.03));
    for (const [u, v, w, h] of [[0, -1, 1.05, 0.07], [0, 1, 1.05, 0.07], [-1, 0, 0.07, 1.05], [1, 0, 0.07, 1.05]]) plate(g, o, boxAt(...p(u * H * 0.98, v * H * 0.98), H * w, H * h, a), iron, 1);
    for (const [u, v] of C4) stud(g, o, ...p(u * H * 0.98, v * H * 0.98), Math.max(1, s * 0.03), iron, 1);
    plate(g, o, boxAt(...p(H * 1.02, H * 0.2), H * 0.1, H * 0.14, a), pal, 0.9); { const k = p(H * 1.02, H * 0.2); disc(g, k[0], k[1], Math.max(0.8, s * 0.02), '#0c0a0a'); }
    for (const v of [-0.6, -0.25]) plate(g, o, boxAt(...p(H * 1.0, v * H), H * 0.06, H * 0.08, a), iron, 0.96);
    return [box];
  },
  urns(g, s, rng, o, pal) {
    // Three earthen jars stood together: each a belly, a shoulder, a neck and a dark mouth; one stoppered, one banded.
    const a = rng() * 6.28, p = at(a), spots = [[-0.42, -0.2, 0.42], [0.36, -0.3, 0.34], [0.1, 0.42, 0.38]], out = [];
    spots.forEach(([u, v, r0], i) => {
      const c = p(u * s, v * s), R = r0 * s, clay = varied(['#a8643c', '#b98a5a', '#8a5a44'][i], rng, 1.5), body = circle(c[0], c[1], R, 32); out.push(body);
      under(g, body, o, 0.35); pathOf(g, body, false); g.fillStyle = clay; g.fill();
      g.save(); pathOf(g, body, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], R * 0.45, c[0], c[1], R * 1.02); gr.addColorStop(0, 'rgba(255,232,200,0.1)'); gr.addColorStop(1, 'rgba(20,8,0,0.55)'); g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2);
      if (o.fine) fineWork(g, seeded(888 + i), at(0, c[0], c[1]), R, R, { along: false, dark: '40,16,4', pale: '255,230,200', much: 0.8 });
      g.restore(); relDome(o, body, c[0], c[1], R, 0.2, 0.6, 0.25);
      // A painted band round its shoulder, in the dye.
      if (i !== 1 || o.detail) { ring(g, c[0], c[1], R * 0.74, pal.cloth, R * 0.1); if (o.detail) for (let k = 0; k < 14; k++) { const t = (k / 14) * 6.283; disc(g, c[0] + Math.cos(t) * R * 0.74, c[1] + Math.sin(t) * R * 0.74, Math.max(0.6, R * 0.025), '#e6dcc2'); } ring(g, c[0], c[1], R * 0.79, 'rgba(20,8,0,0.5)', Math.max(0.5, o.ink * 0.5)); ring(g, c[0], c[1], R * 0.69, 'rgba(20,8,0,0.5)', Math.max(0.5, o.ink * 0.5)); }
      ring(g, c[0], c[1], R * 0.52, shade(clay, 0.08), R * 0.16); ring(g, c[0], c[1], R * 0.6, 'rgba(20,8,0,0.6)', Math.max(0.6, o.ink * 0.7)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], R * 0.52, 0, 6.283); o.maps.strokeStyle = mapsColour(0.7, 0.25); o.maps.lineWidth = R * 0.16; o.maps.stroke(); }
      if (i === 0) { disc(g, c[0], c[1], R * 0.44, hexOf(shade(clay, -0.12))); ring(g, c[0], c[1], R * 0.44, 'rgba(20,8,0,0.8)', Math.max(0.6, o.ink * 0.8)); disc(g, c[0], c[1], R * 0.14, shade(clay, 0.1)); ring(g, c[0], c[1], R * 0.14, 'rgba(20,8,0,0.8)', Math.max(0.6, o.ink * 0.7)); relDome(o, circle(c[0], c[1], R * 0.44), c[0], c[1], R * 0.44, 0.7, 0.82, 0.25); }
      else if (i === 2 && o.detail) { const cover = circle(c[0], c[1], R * 0.56, 20).map(([x, y], k) => [x + Math.sin(k * 2.1) * R * 0.05, y + Math.cos(k * 1.7) * R * 0.05]); clothFlat(g, o, cover, false, pal.cloth, 0.74); ring(g, c[0], c[1], R * 0.44, 'rgba(60,34,10,0.8)', Math.max(0.8, R * 0.04)); }
      else { disc(g, c[0], c[1], R * 0.44, '#140e0a'); ring(g, c[0], c[1], R * 0.44, 'rgba(20,8,0,0.9)', Math.max(0.6, o.ink * 0.8)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], R * 0.44, 0, 6.283); o.maps.fillStyle = mapsColour(0.2, 0.03); o.maps.fill(); } }
      if (o.detail && i === 1) line(g, [[c[0] + R * 0.6, c[1] - R * 0.2], [c[0] + R * 0.78, c[1]], [c[0] + R * 0.7, c[1] + R * 0.3], [c[0] + R * 0.9, c[1] + R * 0.42]], 'rgba(20,8,0,0.75)', Math.max(0.6, o.ink * 0.7));
      thinLine(g, body, false, clay, o, 1.1);
    });
    return out;
  },
  timbers(g, s, rng, o, pal) {
    // Fallen beams: long squared timbers lying across each other where they came down, their ends splintered.
    const a = rng() * 6.28, p = at(a), out = [], beams = [[-0.1, 0.3, 0.86, 0.2, 0.2], [0.15, -0.3, 0.8, -0.35, 0.3], [-0.3, -0.05, 0.62, 1.2, 0.42], [0.35, 0.15, 0.56, 0.75, 0.54], [0, 0, 0.7, -0.05, 0.66]];
    if (o.detail) { const sr = seeded(889); for (let i = 0; i < 22; i++) { const c = p((sr() - 0.5) * s * 1.7, (sr() - 0.5) * s * 1.5), k = sr() * 3.14, len = s * (0.02 + sr() * 0.05); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], 'rgba(214,186,132,0.8)', Math.max(0.8, s * 0.01)); } }
    beams.forEach(([u, v, hl, t, h], i) => {
      const c = p(u * s, v * s), hw = s * (0.07 + (i % 2) * 0.015), q = at(a + t, c[0], c[1]), n = 7;
      // (A splintered end: the board's end cut to a ragged line.)
      const ragged = (e) => Array.from({ length: n }, (_, k) => q(e * hl * s * (1 - 0.03 - rng() * 0.09), (-1 + (2 * k) / (n - 1)) * hw)), ends = [ragged(-1), ragged(1)];
      const shape = [...ends[0], ...ends[1].slice().reverse()]; out.push(boxAt(c[0], c[1], hl * s, hw, a + t));
      under(g, shape, o, 0.38);
      g.save(); pathOf(g, shape, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, shape, true); o.maps.clip(); }
      plank(g, rng, o, c[0], c[1], hl * s * 1.02, hw, a + t, i % 2 ? shade(pal.wood, -0.14) : pal.wood, h);
      g.restore(); o.maps?.restore();
      thinLine(g, shape, true, pal.wood, o, 1.1);
      if (o.detail && i % 2 === 0) { plate(g, o, boxAt(...q(hl * s * 0.4, 0), hw * 0.5, hw * 1.02, a + t), pal, h + 0.05); for (const dv of [-0.5, 0.5]) stud(g, o, ...q(hl * s * 0.4, dv * hw), Math.max(0.8, s * 0.011), pal, h + 0.08); }
    });
    return out;
  },
  cart(g, s, rng, o, pal) {
    // A two-wheeled cart: a boarded bed with rails, an axle under it and a wheel either side, two shafts out in front.
    const a = (rng() - 0.5) * 0.14, p = at(a), L = s * 0.5, W = s * 0.3, bed = boxAt(...p(-L * 0.2, 0), L, W, a), tyre = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) };
    // The shafts and the bar across their ends.
    for (const v of [-0.62, 0.62]) { under(g, boxAt(...p(L * 1.25, v * W), L * 0.62, W * 0.07, a), o, 0.3); plank(g, rng, o, ...p(L * 1.25, v * W), L * 0.62, W * 0.07, a, shade(pal.wood, -0.06), 0.3); }
    plank(g, rng, o, ...p(L * 1.8, 0), W * 0.72, L * 0.035, a + Math.PI / 2, shade(pal.wood, -0.1), 0.34);
    // The wheels, seen down onto their rims: a tyre, the ends of the felloes, the hub and its pin.
    for (const v of [-1, 1]) { const c = p(-L * 0.2, v * W * 1.2), wheel = boxAt(c[0], c[1], L * 0.6, W * 0.11, a); under(g, wheel, o, 0.4); plate(g, o, wheel, tyre, 0.7); const q = at(a, c[0], c[1]); for (let i = -4; i <= 4; i++) line(g, [q(i * L * 0.13, -W * 0.11), q(i * L * 0.13, W * 0.11)], 'rgba(8,6,6,0.5)', Math.max(0.5, o.ink * 0.6), 'butt'); const hub = boxAt(...p(-L * 0.2, v * W * 1.05), L * 0.1, W * 0.07, a); pathOf(g, hub, true); g.fillStyle = pal.woodDark; g.fill(); thinLine(g, hub, true, pal.wood, o, 0.8); rel(o, hub, true, 0.45, 0.1); stud(g, o, ...p(-L * 0.2, v * W * 1.2), Math.max(1, s * 0.018), tyre, 0.74); }
    under(g, bed, o, 0.4); pathOf(g, bed, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.65); g.fill();
    for (let k = -2; k <= 2; k++) plank(g, rng, o, ...p(-L * 0.2, k * W * 0.34), L * 0.94, W * 0.17, a, pal.wood, 0.5);
    if (o.detail) {
      // What it carries: two sacks, a keg on its side, a coil of rope.
      for (const [u, v, t] of [[-0.75, -0.4, 0.3], [-0.6, 0.38, -0.5]]) { const c = p(u * L, v * W), sack = blob(seeded(890 + Math.round(u * 10)), c[0], c[1], L * 0.24, W * 0.34, 12, 0.14, a + t), hemp = hexOf(mix(pal.cloth, '#b79c6a', 0.74)); under(g, sack, o, 0.35); clothFlat(g, o, sack, false, hemp, 0.72, [[p((u - 0.15) * L, v * W), p((u + 0.16) * L, (v + 0.1) * W)]]); }
      { const c = p(L * 0.08, -W * 0.12), t = a + 0.12, q = at(t, c[0], c[1]), H = W * 0.36, box = boxAt(c[0], c[1], H, H, t); under(g, box, o, 0.35); for (let k = -1; k <= 1; k++) plank(g, rng, o, ...q(0, k * H * 0.667), H, H * 0.333, t, shade(pal.wood, -0.04), 0.76); for (const v of [-1, 1]) plank(g, rng, o, ...q(0, v * H * 0.86), H, H * 0.14, t, shade(pal.wood, -0.18), 0.82); for (const u of [-1, 1]) plank(g, rng, o, ...q(u * H * 0.86, 0), H * 0.72, H * 0.14, t + Math.PI / 2, shade(pal.wood, -0.18), 0.82); thinLine(g, box, true, pal.wood, o, 1); }
      { const c = p(L * 0.52, W * 0.42), rope = hexOf(mix(pal.wood, '#c9a868', 0.6)); for (const k of [1, 0.66, 0.36]) { ring(g, c[0], c[1], W * 0.26 * k, 'rgba(20,10,2,0.8)', Math.max(1.6, W * 0.11)); ring(g, c[0], c[1], W * 0.26 * k, rope, Math.max(1, W * 0.075)); } if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], W * 0.3, 0, 6.283); o.maps.fillStyle = mapsColour(0.62, 0.05); o.maps.fill(); } }
    }
    // The rails round the bed, and iron at its corners.
    for (const v of [-1, 1]) plank(g, rng, o, ...p(-L * 0.2, v * W * 0.93), L, W * 0.085, a, shade(pal.wood, -0.14), 0.8);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(-L * 0.2 + u * L * 0.965, 0), W * 0.85, L * 0.04, a + Math.PI / 2, shade(pal.wood, -0.14), 0.8);
    for (const [u, v] of C4) plate(g, o, boxAt(...p(-L * 0.2 + u * L * 0.95, v * W * 0.92), L * 0.06, W * 0.1, a), pal, 0.84);
    thinLine(g, bed, true, pal.wood, o, 1.2);
    return [bed];
  },
  mineCart(g, s, rng, o, pal) {
    // A mine tub: thick boards bound in iron, heaped with ore, on four small wheels.
    const a = (rng() - 0.5) * 0.14, p = at(a), L = s * 0.72, W = s * 0.52, box = boxAt(0, 0, L, W, a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) };
    for (const [u, v] of C4) { const wh = boxAt(...p(u * L * 0.6, v * W * 1.08), L * 0.2, W * 0.1, a); under(g, wh, o, 0.35); plate(g, o, wh, iron, 0.3); }
    plate(g, o, boxAt(...p(L * 1.1, 0), L * 0.1, W * 0.1, a), iron, 0.4); { const c = p(L * 1.24, 0); ring(g, c[0], c[1], W * 0.1, 'rgba(8,6,6,0.9)', Math.max(1.6, s * 0.05)); ring(g, c[0], c[1], W * 0.1, iron.metal, Math.max(0.9, s * 0.028)); }
    under(g, box, o, 0.4); pathOf(g, box, true); g.fillStyle = '#17120e'; g.fill(); rel(o, box, true, 0.3, 0.03);
    // The ore: lumps of grey rock, a seam of something brighter in some of them.
    { const sr = seeded(891); for (let i = 0; i < 16; i++) { const c = p((sr() - 0.5) * L * 1.5, (sr() - 0.5) * W * 1.4), r = s * (0.08 + sr() * 0.07), rock = varied('#6e6a66', sr, 1.6), lump = blob(sr, c[0], c[1], r, r * 0.8, 8, 0.25); pathOf(g, lump, true); g.fillStyle = rock; g.fill(); pathOf(g, [lump[0], lump[1], lump[2], [c[0], c[1]]], true); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill(); pathOf(g, [lump[4], lump[5], lump[6], [c[0], c[1]]], true); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill(); if (o.detail && sr() < 0.5) { line(g, [[c[0] - r * 0.4, c[1] - r * 0.1], [c[0], c[1] + r * 0.1], [c[0] + r * 0.4, c[1] - r * 0.15]], hexOf(pal.metalLit), Math.max(0.8, r * 0.14)); relLine(o, [[c[0] - r * 0.4, c[1] - r * 0.1], [c[0] + r * 0.4, c[1] - r * 0.15]], Math.max(1, r * 0.14), 0.6, 0.95); } thinLine(g, lump, true, rock, o, 0.8); relDome(o, lump, c[0], c[1], r, 0.36, 0.58, 0.2); } }
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * W * 0.88), L, W * 0.12, a, pal.wood, 0.7);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * L * 0.92, 0), W * 0.76, L * 0.08, a + Math.PI / 2, pal.wood, 0.7);
    for (const [u, v] of C4) { plate(g, o, boxAt(...p(u * L * 0.9, v * W * 0.86), L * 0.12, W * 0.16, a), iron, 0.76); stud(g, o, ...p(u * L * 0.9, v * W * 0.86), Math.max(0.9, s * 0.022), iron, 0.8); }
    if (o.detail) for (const u of [-0.3, 0.3]) for (const v of [-0.88, 0.88]) { plate(g, o, boxAt(...p(u * L, v * W), L * 0.04, W * 0.13, a), iron, 0.76); stud(g, o, ...p(u * L, v * W), Math.max(0.8, s * 0.014), iron, 0.8); }
    thinLine(g, box, true, pal.wood, o, 1.2);
    return [box];
  },
  campfire(g, s, rng, o, pal) {
    // A fire gone cold: a ring of stones round a bed of ash, the black ends of what burned lying across it.
    const a = rng() * 6.28, R = s * 0.5, out = [];
    ashBed(g, rng, o, 0, 0, R * 1.12);
    for (const [t, l] of [[0.3, 0.8], [1.5, 0.7], [2.6, 0.76]]) charLog(g, rng, o, Math.cos(a + t) * R * 0.1, Math.sin(a + t * 2) * R * 0.1, R * l, R * 0.13, a + t);
    if (o.detail) { const sr = seeded(892); for (let i = 0; i < 7; i++) { const t = sr() * 6.283, d = sr() * R * 0.5, c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.02 + sr() * 0.02); disc(g, c[0], c[1], r * 1.5, 'rgba(120,30,8,0.5)'); disc(g, c[0], c[1], r, 'rgba(226,96,28,0.9)'); } }
    for (let i = 0; i < 8; i++) { const t = a + (i / 8) * 6.283 + (rng() - 0.5) * 0.2, c = [Math.cos(t) * R * 1.36, Math.sin(t) * R * 1.36]; out.push(rockForm(g, rng, o, c[0], c[1], R * (0.36 + rng() * 0.1), R * (0.26 + rng() * 0.06), t + 1.57, i % 3 ? '#7a746a' : '#8a867e', 0.4, 7)); }
    return out;
  },
  brazier(g, s, rng, o, pal) {
    // An iron bowl of coals on three feet.
    const a = rng() * 6.28, R = s * 0.72, rim = circle(0, 0, R, 36), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.5)) }, pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r];
    for (let i = 0; i < 3; i++) { const t = a + (i / 3) * 6.283; plate(g, o, boxAt(...pol(R * 1.0, t), R * 0.17, R * 0.09, t), iron, 0.2); }
    under(g, rim, o, 0.4); plate(g, o, rim, iron, 0.8);
    coalBed(g, rng, o, 0, 0, R * 0.78);
    ring(g, 0, 0, R * 0.78, 'rgba(8,6,6,0.95)', Math.max(0.8, o.ink)); ring(g, 0, 0, R * 0.89, mix(iron.metal, '#c8ccd2', 0.25), Math.max(0.8, s * 0.02));
    if (o.detail) {
      for (let i = 0; i < 10; i++) stud(g, o, ...pol(R * 0.89, a + (i / 10) * 6.283), Math.max(0.8, s * 0.016), iron, 0.86);
      for (const t of [a + 0.5, a + 0.5 + Math.PI]) { const c = pol(R * 1.06, t); ring(g, c[0], c[1], R * 0.12, 'rgba(8,6,6,0.9)', Math.max(1.6, s * 0.05)); ring(g, c[0], c[1], R * 0.12, iron.metal, Math.max(0.9, s * 0.028)); }
      for (const t of [a + 1.1, a + 2.4]) { const b = [pol(R * 0.78, t), pol(R * 0.78, t + Math.PI)]; line(g, b, 'rgba(8,6,6,0.9)', Math.max(1.4, s * 0.04), 'butt'); line(g, b, iron.metal, Math.max(0.8, s * 0.022), 'butt'); relLine(o, b, Math.max(1.2, s * 0.03), 0.6, 0.85); }
    }
    return [rim];
  },
  hearth(g, s, rng, o, pal) {
    // A stone fireplace from over it: a back wall and two cheeks of dressed blocks, the firebed between, a slab of flags before it.
    const a = (rng() - 0.5) * 0.05, p = at(a), L = s * 0.9, D = s * 0.56, foot = boxAt(0, 0, L, D, a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.5)) };
    under(g, foot, o, 0.3);
    for (let i = 0; i < 5; i++) { const b = blockAt(rng, ...p((i - 2) * L * 0.4, D * 0.68), L * 0.195, D * 0.3, a, s * 0.012); stonePoly(g, rng, o, b, true, STONE, 0.12); }
    const bed = boxAt(...p(0, -D * 0.1), L * 0.62, D * 0.46, a); pathOf(g, bed, true); g.fillStyle = '#191412'; g.fill(); rel(o, bed, true, 0.08, 0.03);
    { const c = p(0, -D * 0.08); ashBed(g, rng, o, c[0], c[1], D * 0.4, 1.5); charLog(g, rng, o, ...p(-L * 0.06, -D * 0.14), L * 0.36, D * 0.075, a + 0.12); charLog(g, rng, o, ...p(L * 0.05, D * 0.02), L * 0.32, D * 0.07, a - 0.2); }
    // The fire dogs: an iron bar either side, a knob at its front.
    for (const u of [-0.34, 0.34]) { const b = [p(u * L, -D * 0.46), p(u * L, D * 0.3)]; line(g, b, 'rgba(8,6,6,0.9)', Math.max(1.6, s * 0.035), 'butt'); line(g, b, iron.metal, Math.max(0.9, s * 0.02), 'butt'); relLine(o, b, Math.max(1.4, s * 0.03), 0.3, 0.85); stud(g, o, ...p(u * L, D * 0.32), Math.max(1, s * 0.024), iron, 0.4); }
    if (o.detail) {
      // A pot hung over it, a poker stood against a cheek.
      const c = p(L * 0.14, -D * 0.18), r = D * 0.24; under(g, circle(c[0], c[1], r), o, 0.4); plate(g, o, circle(c[0], c[1], r, 24), iron, 0.5); disc(g, c[0], c[1], r * 0.74, '#3a2c1c'); ring(g, c[0], c[1], r * 0.74, 'rgba(8,6,6,0.9)', Math.max(0.7, o.ink * 0.9)); for (const k of [0.3, 0.52]) ring(g, c[0], c[1], r * k, 'rgba(220,190,140,0.22)', Math.max(0.5, o.ink * 0.6));
      const pk = [p(-L * 0.5, -D * 0.3), p(-L * 0.42, D * 0.84)]; line(g, pk, 'rgba(8,6,6,0.9)', Math.max(1.4, s * 0.03)); line(g, pk, iron.metal, Math.max(0.8, s * 0.016)); stud(g, o, ...pk[1], Math.max(0.9, s * 0.018), iron, 0.2);
      g.save(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; g.fillStyle = 'rgba(8,6,4,0.4)'; const st = p(0, D * 0.42); g.beginPath(); g.ellipse(st[0], st[1], L * 0.5, D * 0.14, a, 0, 6.283); g.fill(); g.restore();
    }
    for (const u of [-1, 1]) for (let j = 0; j < 2; j++) { const b = blockAt(rng, ...p(u * L * 0.81, -D * 0.34 + j * D * 0.44), L * 0.185, D * 0.215, a, s * 0.012); under(g, b, o, 0.35); stonePoly(g, rng, o, b, true, STONE, 0.86); }
    for (let i = 0; i < 5; i++) { const b = blockAt(rng, ...p((i - 2) * L * 0.4, -D * 0.78), L * 0.195, D * 0.215, a, s * 0.012); under(g, b, o, 0.35); stonePoly(g, rng, o, b, true, STONE, 0.94); }
    return [foot];
  },
  candles(g, s, rng, o, pal) {
    // Three candles burnt down in a pool of their own wax.
    const a = rng() * 6.28, p = at(a), pool = blob(rng, 0, 0, s * 0.72, s * 0.6, 14, 0.2, a), WAX = '#e6dcc0';
    under(g, pool, o, 0.22); pathOf(g, pool, false); g.fillStyle = mix(WAX, '#a89c7c', 0.45); g.fill(); thinLine(g, pool, false, WAX, o, 0.8); rel(o, pool, false, 0.06, 0.3);
    [[-0.26, -0.1, 0.3], [0.3, -0.2, 0.22], [0.08, 0.32, 0.18]].forEach(([u, v, r0], i) => {
      const c = p(u * s, v * s), R = r0 * s, wax = varied(WAX, rng, 0.8);
      if (o.detail && !i) { disc(g, c[0], c[1], R * 1.35, pal.metal); ring(g, c[0], c[1], R * 1.35, mix(pal.metal, '#0c0904', 0.9), Math.max(0.8, o.ink)); ring(g, c[0], c[1], R * 1.15, 'rgba(8,6,6,0.4)', Math.max(0.5, o.ink * 0.6)); relDome(o, circle(c[0], c[1], R * 1.35), c[0], c[1], R * 1.35, 0.1, 0.16, 0.85); }
      const body = circle(c[0], c[1], R, 22).map(([x, y], k) => { const w = 1 + (Math.sin(k * 2.3 + i) > 0.6 ? 0.14 : 0); return [c[0] + (x - c[0]) * w, c[1] + (y - c[1]) * w]; });
      under(g, body, o, 0.3); pathOf(g, body, false); g.fillStyle = wax; g.fill();
      g.save(); pathOf(g, body, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], R * 0.3, c[0], c[1], R * 1.1); gr.addColorStop(0, 'rgba(255,255,245,0.2)'); gr.addColorStop(1, 'rgba(90,70,30,0.4)'); g.fillStyle = gr; g.fillRect(c[0] - R * 2, c[1] - R * 2, R * 4, R * 4); g.restore();
      disc(g, c[0], c[1], R * 0.56, hexOf(mix(wax, '#c8a860', 0.35))); ring(g, c[0], c[1], R * 0.56, 'rgba(90,70,30,0.5)', Math.max(0.5, o.ink * 0.6));
      disc(g, c[0], c[1], Math.max(0.9, R * 0.13), '#1a1208'); disc(g, c[0], c[1], Math.max(0.5, R * 0.06), '#e0782a');
      thinLine(g, body, false, wax, o, 1); relDome(o, body, c[0], c[1], R * 1.1, 0.2 + i * 0.05, 0.3 + i * 0.05, 0.35);
    });
    return [pool];
  },
  lampPost(g, s, rng, o, pal) {
    // A street lamp from over it: a stone foot, the lantern's iron cap with its panes showing under the eaves, a ladder bar.
    const a = (rng() - 0.5) * 0.3, p = at(a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.5)) }, base = circle(0, 0, s * 0.56, 8).map(([x, y]) => { const c = Math.cos(a + 0.39), n = Math.sin(a + 0.39); return [x * c - y * n, x * n + y * c]; }), H = s * 0.4;
    under(g, base, o, 0.35); stonePoly(g, rng, o, base, true, STONE, 0.14); ring(g, 0, 0, s * 0.4, 'rgba(20,18,16,0.5)', Math.max(0.6, o.ink * 0.7));
    { const bar = [p(-s * 0.74, 0), p(s * 0.74, 0)]; under(g, boxAt(0, 0, s * 0.74, s * 0.03, a), o, 0.35); line(g, bar, 'rgba(8,6,6,0.9)', Math.max(1.8, s * 0.05), 'butt'); line(g, bar, iron.metal, Math.max(1, s * 0.03), 'butt'); relLine(o, bar, Math.max(1.6, s * 0.04), 0.86, 0.85); for (const u of [-1, 1]) stud(g, o, ...p(u * s * 0.74, 0), Math.max(1, s * 0.03), iron, 0.9); }
    const glass = boxAt(0, 0, H, H, a); under(g, glass, o, 0.45); pathOf(g, glass, true); g.fillStyle = o.night ? '#f6de9a' : '#b4a884'; g.fill(); thinLine(g, glass, true, '#8a6a2a', o, 0.9); rel(o, glass, true, 0.9, 0.7);
    // The cap: four slopes up to a finial.
    const cap = boxAt(0, 0, H * 0.8, H * 0.8, a);
    for (let i = 0; i < 4; i++) { const tri = [cap[i], cap[(i + 1) % 4], [0, 0]]; pathOf(g, tri, true); g.fillStyle = mix(iron.metal, i % 2 ? '#0c0904' : '#c8ccd2', i % 2 ? 0.25 : 0.12); g.fill(); pathOf(g, tri, true); g.strokeStyle = 'rgba(8,6,6,0.85)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.lineJoin = 'round'; g.stroke(); }
    relDome(o, cap, 0, 0, H * 1.1, 0.9, 1, 0.85); thinLine(g, cap, true, iron.metal, o, 1);
    for (const [u, v] of C4) stud(g, o, ...p(u * H, v * H), Math.max(1, s * 0.03), iron, 0.94);
    stud(g, o, 0, 0, Math.max(1.2, s * 0.045), iron, 1);
    if (o.detail) for (let i = 0; i < 4; i++) { const m = [(cap[i][0] + cap[(i + 1) % 4][0]) / 2, (cap[i][1] + cap[(i + 1) % 4][1]) / 2]; line(g, [[m[0] * 0.3, m[1] * 0.3], [m[0] * 0.9, m[1] * 0.9]], 'rgba(8,6,6,0.5)', Math.max(0.5, o.ink * 0.6)); }
    return [base];
  },
  treasure(g, s, rng, o, pal) {
    // A heap of coin, with what else was in the hoard lying on it.
    const a = rng() * 6.28, p = at(a), RX = s * 0.8, RY = s * 0.62, heap = oval(0, 0, RX, RY, a, 28), GOLD = '#c9a23a', coins = [];
    under(g, heap, o, 0.2); pathOf(g, heap, false); g.fillStyle = '#7a5f1c'; g.fill();
    for (let i = 0; i < 220; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()); coins.push([d, p(Math.cos(t) * d * RX * 0.96, Math.sin(t) * d * RY * 0.96), rng() < 0.12]); }
    coins.sort((x, y) => y[0] - x[0]);
    for (const [, c, silver] of coins) { const r = s * (0.04 + rng() * 0.012), col = silver ? varied(hexOf(pal.metalLit), rng, 0.6) : varied(GOLD, rng, 1.2); disc(g, c[0], c[1], r, col); ring(g, c[0], c[1], r * 0.62, 'rgba(255,244,200,0.3)', Math.max(0.4, o.ink * 0.4)); ring(g, c[0], c[1], r, 'rgba(50,30,4,0.85)', Math.max(0.5, o.ink * 0.55)); }
    relDome(o, heap, 0, 0, RX, 0.03, 0.26, 0.85);
    if (o.detail) {
      // Cut stones, a cup on its side, a chain.
      const sr = seeded(893);
      for (let i = 0; i < 7; i++) { const c = p((sr() - 0.5) * RX * 1.3, (sr() - 0.5) * RY * 1.2), r = s * (0.04 + sr() * 0.03), dye = varied(CLOTHS[CLOTH_IDS[Math.floor(sr() * 5)]].base, sr, 1), t0 = sr() * 6, gem = Array.from({ length: 6 }, (_, k) => [c[0] + Math.cos(t0 + k * 1.047) * r, c[1] + Math.sin(t0 + k * 1.047) * r]); pathOf(g, gem, true); g.fillStyle = dye; g.fill(); for (let k = 0; k < 6; k += 2) { pathOf(g, [gem[k], gem[(k + 1) % 6], c], true); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill(); } pathOf(g, gem.map(([x, y]) => [c[0] + (x - c[0]) * 0.5, c[1] + (y - c[1]) * 0.5]), true); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(0.4, o.ink * 0.4); g.stroke(); thinLine(g, gem, true, dye, o, 0.8); relDome(o, gem, c[0], c[1], r, 0.3, 0.42, 0.95); }
      { const c = p(RX * 0.3, -RY * 0.2), q = at(a + 0.6, c[0], c[1]), cup = oval(c[0], c[1], s * 0.11, s * 0.09, a + 0.6, 16); under(g, cup, o, 0.3); plate(g, o, cup, { ...pal, metal: GOLD }, 0.4); const mouth = oval(...q(s * 0.07, 0), s * 0.04, s * 0.075, a + 0.6, 12); pathOf(g, mouth, false); g.fillStyle = '#2a1c08'; g.fill(); line(g, [q(-s * 0.1, 0), q(-s * 0.22, 0)], 'rgba(50,30,4,0.9)', Math.max(1.6, s * 0.04)); line(g, [q(-s * 0.1, 0), q(-s * 0.22, 0)], GOLD, Math.max(0.9, s * 0.024)); plate(g, o, oval(...q(-s * 0.24, 0), s * 0.025, s * 0.07, a + 0.6, 12), { ...pal, metal: GOLD }, 0.38); }
      { const pts = Array.from({ length: 18 }, (_, k) => { const t = k / 17; return p(-RX * 0.6 + t * RX * 0.7, RY * 0.3 + Math.sin(t * 5) * RY * 0.14); }); for (const c of pts) { disc(g, c[0], c[1], Math.max(0.9, s * 0.016), hexOf(pal.metalLit)); ring(g, c[0], c[1], Math.max(0.9, s * 0.016), 'rgba(20,20,24,0.8)', Math.max(0.4, o.ink * 0.4)); } }
    }
    return [heap];
  },
  pickaxe(g, s, rng, o, pal) {
    // Tools dropped where the work stopped: a pick and a shovel lying across each other.
    const a = rng() * 6.28, iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) }, out = [];
    { const t = a + 0.25, q = at(t, 0, -s * 0.1), haft = boxAt(...q(0, 0), s * 0.74, s * 0.05, t); out.push(haft); under(g, haft, o, 0.3); g.save(); pathOf(g, haft, true); g.clip(); plank(g, rng, o, ...q(0, 0), s * 0.76, s * 0.05, t, shade(pal.wood, 0.04), 0.06); g.restore(); thinLine(g, haft, true, pal.wood, o, 1);
      const head = [q(s * 0.6, -s * 0.5), q(s * 0.7, -s * 0.26), q(s * 0.76, 0), q(s * 0.7, s * 0.26), q(s * 0.6, s * 0.5), q(s * 0.64, s * 0.24), q(s * 0.66, 0), q(s * 0.64, -s * 0.24)]; under(g, head, o, 0.3); plate(g, o, head, iron, 0.09); plate(g, o, boxAt(...q(s * 0.7, 0), s * 0.06, s * 0.07, t), iron, 0.1); }
    { const t = a - 0.5, q = at(t, s * 0.05, s * 0.2), haft = boxAt(...q(-s * 0.1, 0), s * 0.5, s * 0.04, t); out.push(haft); under(g, haft, o, 0.3); pathOf(g, haft, true); g.fillStyle = shade(pal.wood, -0.04); g.fill(); thinLine(g, haft, true, pal.wood, o, 1); rel(o, haft, true, 0.06, 0.1);
      const blade = [q(s * 0.36, -s * 0.14), q(s * 0.62, -s * 0.15), q(s * 0.76, -s * 0.08), q(s * 0.8, 0), q(s * 0.76, s * 0.08), q(s * 0.62, s * 0.15), q(s * 0.36, s * 0.14), q(s * 0.4, 0)]; under(g, blade, o, 0.3); plate(g, o, blade, iron, 0.08); line(g, [q(s * 0.4, 0), q(s * 0.72, 0)], 'rgba(8,8,10,0.4)', Math.max(0.6, o.ink * 0.7));
      const c = q(-s * 0.68, 0); ring(g, c[0], c[1], s * 0.08, mix(pal.wood, '#0c0904', 0.9), Math.max(2, s * 0.06)); ring(g, c[0], c[1], s * 0.08, shade(pal.wood, -0.04), Math.max(1.2, s * 0.036)); }
    return out;
  },
  bedroll(g, s, rng, o, pal) {
    // A traveller's bed: a ground cloth, a blanket laid over it, the rest rolled at its head in two straps.
    const a = (rng() - 0.5) * 0.5, p = at(a), L = s * 0.78, W = s * 0.42, mat = boxAt(0, 0, L, W, a), ground = hexOf(mix(pal.cloth, '#8a7a5a', 0.6)), leather = hexOf(mix(pal.wood, '#5a3a22', 0.6));
    under(g, mat, o, 0.25); clothFlat(g, o, mat, true, ground, 0.06, [[p(-L * 0.4, -W * 0.7), p(L * 0.1, -W * 0.62), p(L * 0.8, -W * 0.72)]]);
    const bl = boxAt(...p(L * 0.24, 0), L * 0.66, W * 0.9, a); clothFlat(g, o, bl, true, pal.cloth, 0.12, [[p(-L * 0.3, W * 0.3), p(L * 0.3, W * 0.2), p(L * 0.85, W * 0.34)], [p(-L * 0.2, -W * 0.3), p(L * 0.5, -W * 0.2)]]);
    if (o.detail) { g.save(); pathOf(g, bl, true); g.clip(); for (const u of [-0.25, -0.17, 0.7, 0.78]) line(g, [p(L * u, -W), p(L * u, W)], mix(pal.cloth, '#f4ead0', 0.5).replace('rgb', 'rgba').replace(')', ',0.5)'), Math.max(1, W * 0.05), 'butt'); g.restore(); }
    const roll = boxAt(...p(-L * 0.86, 0), L * 0.16, W * 1.02, a); under(g, roll, o, 0.35); clothFlat(g, o, roll, true, hexOf(shade(pal.cloth, -0.16)), 0.26, [[p(-L * 0.94, -W), p(-L * 0.94, W)], [p(-L * 0.8, -W), p(-L * 0.8, W)]]);
    for (const v of [-0.5, 0.5]) { const strap = boxAt(...p(-L * 0.86, v * W), L * 0.17, W * 0.07, a); pathOf(g, strap, true); g.fillStyle = leather; g.fill(); thinLine(g, strap, true, leather, o, 0.8); rel(o, strap, true, 0.3, 0.2); stud(g, o, ...p(-L * 0.86, v * W), Math.max(0.9, s * 0.02), pal, 0.34); }
    if (o.detail) { const c = p(L * 0.48, W * 0.08), t = a + 0.4, q = at(t, c[0], c[1]), bag = blockAt(seeded(894), c[0], c[1], s * 0.2, s * 0.15, t, s * 0.012); under(g, bag, o, 0.3); clothFlat(g, o, bag, true, leather, 0.3); const flap = [q(-s * 0.2, -s * 0.15), q(s * 0.2, -s * 0.15), q(s * 0.2, -s * 0.02), q(0, s * 0.02), q(-s * 0.2, -s * 0.02)]; pathOf(g, flap, true); g.fillStyle = shade(leather, -0.16); g.fill(); thinLine(g, flap, true, leather, o, 0.8); const strap = boxAt(...q(0, 0), s * 0.03, s * 0.15, t); pathOf(g, strap, true); g.fillStyle = shade(leather, -0.3); g.fill(); thinLine(g, strap, true, leather, o, 0.7); stud(g, o, ...q(0, s * 0.03), Math.max(0.9, s * 0.022), pal, 0.36); }
    return [mat];
  },
  rug(g, s, rng, o, pal) {
    // A knotted rug: a border in three bands, a field of small figures, a great lozenge at its middle, a fringe at either end.
    const a = (rng() - 0.5) * 0.06, p = at(a), L = s * 0.86, W = s * 0.58, field = boxAt(0, 0, L, W, a), cream = hexOf(mix(pal.cloth, '#e2d8c2', 0.82)), dark = hexOf(shade(pal.cloth, -0.5)), other = hexOf(mix(CLOTHS[CLOTH_IDS[Math.floor(rng() * CLOTH_IDS.length)]].base, '#5a4a3a', 0.35));
    const cw = Math.max(0.7, o.ink * 0.9), loz = (cx, cy, rx, ry) => [p(cx - rx, cy), p(cx, cy - ry), p(cx + rx, cy), p(cx, cy + ry)], fill = (pts, col) => { pathOf(g, pts, true); g.fillStyle = col; g.fill(); }, edge = (pts, col, w = cw) => { pathOf(g, pts, true); g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'miter'; g.stroke(); };
    for (const e of [-1, 1]) for (let v = -W * 0.98; v <= W * 0.98; v += W * 0.045) line(g, [p(e * L, v), p(e * (L + s * 0.06), v + (rng() - 0.5) * s * 0.02)], cream, Math.max(0.7, o.ink * 0.8));
    pathOf(g, field, true); g.fillStyle = pal.cloth; g.fill();
    g.save(); pathOf(g, field, true); g.clip();
    fill(boxAt(0, 0, L, W, a), dark); fill(boxAt(0, 0, L * 0.955, W * 0.93, a), other); fill(boxAt(0, 0, L * 0.9, W * 0.85, a), pal.cloth);
    edge(boxAt(0, 0, L * 0.955, W * 0.93, a), cream); edge(boxAt(0, 0, L * 0.9, W * 0.85, a), cream);
    // Small lozenges along the middle band of the border.
    for (let i = -11; i <= 11; i++) for (const v of [-1, 1]) fill(loz(i * L * 0.08, v * W * 0.89, L * 0.022, W * 0.028), cream);
    for (let j = -6; j <= 6; j++) for (const u of [-1, 1]) fill(loz(u * L * 0.927, j * W * 0.12, L * 0.016, W * 0.04), cream);
    // The field: rows of small figures, every other one the other dye.
    for (let i = -7; i <= 7; i++) for (let j = -4; j <= 4; j++) { if ((i + j) % 2) continue; const cx = i * L * 0.115, cy = j * W * 0.18; if (Math.abs(cx) / (L * 0.5) + Math.abs(cy) / (W * 0.58) < 1.08) continue; fill(loz(cx, cy, L * 0.026, W * 0.045), (i + j) % 4 ? cream : other); }
    // The great lozenge, stepped inward, a wheel of eight at its heart.
    fill(loz(0, 0, L * 0.5, W * 0.58), dark); edge(loz(0, 0, L * 0.5, W * 0.58), cream, cw * 1.3); fill(loz(0, 0, L * 0.4, W * 0.46), other); edge(loz(0, 0, L * 0.4, W * 0.46), cream); fill(loz(0, 0, L * 0.28, W * 0.32), pal.cloth); edge(loz(0, 0, L * 0.28, W * 0.32), cream);
    for (let i = 0; i < 8; i++) { const t = (i / 8) * 6.283, q = at(a + t), d = W * 0.16, m = W * 0.06; fill([q(d - m * 1.3, 0), q(d, -m * 0.7), q(d + m * 1.3, 0), q(d, m * 0.7)], cream); }
    { const c = p(0, 0); disc(g, c[0], c[1], W * 0.05, cream); disc(g, c[0], c[1], W * 0.025, dark); }
    for (const [u, v] of C4) { fill(loz(u * L * 0.9, v * W * 0.85, L * 0.16, W * 0.22), dark); edge(loz(u * L * 0.9, v * W * 0.85, L * 0.16, W * 0.22), cream); }
    // Its weave over all of it, and where feet have worn it.
    if (o.fine) fineWork(g, seeded(895), p, L, W, { along: false, dark: '10,6,2', pale: '255,244,225', much: 1.5 });
    { const gr = g.createRadialGradient(0, 0, W * 0.4, 0, 0, L * 1.15); gr.addColorStop(0, 'rgba(255,244,225,0.05)'); gr.addColorStop(1, 'rgba(8,4,0,0.34)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore(); thinLine(g, field, true, pal.cloth, o, 1.1); rel(o, field, true, 0.04, 0.03);
    return [field];
  },
  strawBed(g, s, rng, o, pal) {
    // A heap of straw to sleep on, pressed down where someone lay.
    const a = rng() * 6.28, p = at(a), RX = s * 0.84, RY = s * 0.58, heap = blob(rng, 0, 0, RX, RY, 18, 0.12, a);
    for (let i = 0; i < 40; i++) { const t = rng() * 6.283, c = p(Math.cos(t) * RX * (0.95 + rng() * 0.16), Math.sin(t) * RY * (0.95 + rng() * 0.2)), k = a + (rng() - 0.5) * 2.4, len = s * (0.05 + rng() * 0.1); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], varied(STRAW, rng, 1.6), Math.max(0.7, o.ink * 0.8)); }
    pathOf(g, heap, false); g.fillStyle = mix(STRAW, '#5a4418', 0.5); g.fill();
    g.save(); pathOf(g, heap, false); g.clip();
    for (let i = 0; i < 520; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()), c = p(Math.cos(t) * d * RX, Math.sin(t) * d * RY), k = a + (rng() - 0.5) * 1.5 + (rng() < 0.2 ? 1.2 : 0), len = s * (0.06 + rng() * 0.16), tone = rng(); line(g, [c, [c[0] + Math.cos(k) * len * 0.5, c[1] + Math.sin(k) * len * 0.5 + (rng() - 0.5) * 1.5], [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], tone < 0.25 ? 'rgba(70,50,14,0.55)' : tone < 0.8 ? varied(STRAW, rng, 1.8) : '#ecdc9c', 0.7 + rng() * 1.1); }
    g.filter = `blur(${Math.max(1, s * 0.05)}px)`; g.fillStyle = 'rgba(40,26,6,0.34)'; { const c = p(-RX * 0.05, 0); g.beginPath(); g.ellipse(c[0], c[1], RX * 0.5, RY * 0.36, a, 0, 6.283); g.fill(); } g.filter = 'none';
    { const gr = g.createRadialGradient(0, 0, RY * 0.5, 0, 0, RX * 1.05); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,18,4,0.42)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore(); thinLine(g, heap, false, STRAW, o, 0.7); rel(o, heap, false, 0.07, 0.04);
    if (o.detail) { const c = p(RX * 0.36, RY * 0.06), rag = blockAt(seeded(896), c[0], c[1], RX * 0.4, RY * 0.5, a + 0.25, s * 0.03), q = at(a + 0.25, c[0], c[1]); under(g, rag, o, 0.25); clothFlat(g, o, rag, true, hexOf(mix(pal.cloth, '#8a7a5a', 0.72)), 0.1, [[q(-RX * 0.4, -RY * 0.16), q(RX * 0.4, -RY * 0.1)], [q(-RX * 0.4, RY * 0.2), q(RX * 0.4, RY * 0.14)], [q(-RX * 0.1, -RY * 0.5), q(-RX * 0.06, RY * 0.5)]]); }
    return [heap];
  },
  well(g, s, rng, o, pal) {
    // A well from over it: a ring of wedge-cut stones round a dark shaft, a windlass across it on two posts.
    const a = rng() * 6.28, p = at(a), R = s * 0.64, inner = R * 0.62, N = 12, pol = (r, t) => [Math.cos(t) * r, Math.sin(t) * r], rim = circle(0, 0, R, 32), rope = hexOf(mix(pal.wood, '#c9a868', 0.6)), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) };
    under(g, rim, o, 0.4);
    water(g, rng, o, circle(0, 0, inner * 0.72, 28), false, 0.02); disc(g, 0, 0, inner * 0.72, 'rgba(0,0,0,0.5)');
    for (let i = 0; i < 9; i++) { const t0 = a + 0.2 + (i / 9) * 6.283 + 0.02, t1 = t0 + 6.283 / 9 - 0.04, tm = (t0 + t1) / 2; stonePoly(g, rng, o, [pol(inner * 0.7, t0), pol(inner * 1.01, t0), pol(inner * 1.01, t1), pol(inner * 0.7, t1), pol(inner * 0.69, tm)], true, '#5a564e', 0.3); }
    { const gr = g.createRadialGradient(0, 0, inner * 0.5, 0, 0, inner); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)'); g.beginPath(); g.arc(0, 0, inner, 0, 6.283); g.fillStyle = gr; g.fill(); }
    for (let i = 0; i < N; i++) { const t0 = a + (i / N) * 6.283 + 0.02, t1 = t0 + 6.283 / N - 0.04, tm = (t0 + t1) / 2; stonePoly(g, rng, o, [pol(inner, t0), pol(R, t0), pol(R * 1.012, tm), pol(R, t1), pol(inner, t1), pol(inner * 0.985, tm)], true, STONE, 0.6); }
    ring(g, 0, 0, inner, 'rgba(10,8,6,0.9)', Math.max(0.8, o.ink));
    if (o.detail) {
      // Moss on the stones' shaded side of nothing in particular, and a bucket stood on the rim.
      const sr = seeded(897), mossy = inSeason(o, '#465e2a');
      for (let i = 0; i < 11; i++) { const t = sr() * 6.283, d = R * (0.62 + sr() * 0.42), c = pol(d, t); for (let k = 0; k < 16; k++) { const m = [c[0] + (sr() - 0.5) * R * 0.2, c[1] + (sr() - 0.5) * R * 0.2], r = R * (0.012 + sr() * 0.028), col = varied(mossy, sr, 2.2); disc(g, m[0], m[1], r, col); if (sr() < 0.4) disc(g, m[0], m[1], r * 0.5, shade(col, 0.2)); } for (let k = 0; k < 3; k++) { const tt = t + (sr() - 0.5) * 2.4, hang = [c]; let h = c; for (let j = 0; j < 4; j++) { h = [h[0] + Math.cos(tt + (sr() - 0.5)) * R * 0.05, h[1] + Math.sin(tt + (sr() - 0.5)) * R * 0.05]; hang.push(h); } line(g, hang, varied(hexOf(shade(mossy, -0.2)), sr, 1.6), Math.max(0.8, R * 0.02)); } }
      const c = pol(R * 0.82, a + 2.3), r = R * 0.2; under(g, circle(c[0], c[1], r), o, 0.35); disc(g, c[0], c[1], r, pal.wood); for (let i = 0; i < 8; i++) { const t = i * 0.785; line(g, [[c[0] + Math.cos(t) * r * 0.66, c[1] + Math.sin(t) * r * 0.66], [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]], 'rgba(16,7,0,0.8)', Math.max(0.5, o.ink * 0.6)); } ring(g, c[0], c[1], r * 0.84, pal.metal, Math.max(1, r * 0.12)); disc(g, c[0], c[1], r * 0.66, '#1f2c35'); ring(g, c[0], c[1], r * 0.66, 'rgba(8,6,6,0.9)', Math.max(0.6, o.ink * 0.7)); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.72, 0.8, 0.2);
    }
    // The windlass.
    under(g, boxAt(0, 0, R * 1.14, R * 0.08, a), o, 0.4); plank(g, rng, o, 0, 0, R * 1.14, R * 0.075, a, shade(pal.wood, -0.05), 0.9);
    for (let k = -4; k <= 4; k++) { const w = [p(k * R * 0.055, -R * 0.085), p(k * R * 0.055 + R * 0.03, R * 0.085)]; line(g, w, 'rgba(30,16,2,0.85)', Math.max(1.4, R * 0.05), 'butt'); line(g, w, rope, Math.max(0.8, R * 0.03), 'butt'); }
    { const crank = [p(R * 1.14, 0), p(R * 1.36, 0), p(R * 1.36, R * 0.22)]; line(g, crank, 'rgba(8,6,6,0.9)', Math.max(1.6, s * 0.04)); line(g, crank, iron.metal, Math.max(0.9, s * 0.022)); relLine(o, crank, Math.max(1.4, s * 0.03), 0.9, 0.85); }
    for (const u of [-1, 1]) post(g, o, p(u * R * 1.14, 0), R * 0.14, pal, 0.96);
    return [rim];
  },
  haystack(g, s, rng, o, pal) {
    // Hay in bales: two side by side and a third thrown across them, each bound twice with twine.
    const a = (rng() - 0.5) * 0.4, p = at(a), out = [];
    if (o.detail) { const sr = seeded(898); for (let i = 0; i < 34; i++) { const c = p((sr() - 0.5) * s * 1.7, (sr() - 0.5) * s * 1.6), k = sr() * 3.14, len = s * (0.04 + sr() * 0.08); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], varied(STRAW, sr, 1.6), Math.max(0.7, o.ink * 0.8)); } }
    const bale = (c, hl, hw, t, h) => { const b = boxAt(c[0], c[1], hl, hw, t), q = at(t, c[0], c[1]); out.push(b); under(g, b, o, 0.38); strawOn(g, rng, o, b, true, t, 300); rel(o, b, true, h, 0.04); for (const u of [-0.45, 0.45]) { const tw = [q(u * hl, -hw), q(u * hl, hw)]; line(g, tw, 'rgba(40,24,6,0.85)', Math.max(1.2, s * 0.028), 'butt'); line(g, tw, '#b89a6a', Math.max(0.7, s * 0.015), 'butt'); relLine(o, tw, Math.max(1, s * 0.028), h + 0.03, 0.05); } };
    bale(p(-s * 0.08, s * 0.33), s * 0.6, s * 0.29, a, 0.35); bale(p(s * 0.06, -s * 0.33), s * 0.6, s * 0.29, a + 0.06, 0.35); bale(p(s * 0.02, 0), s * 0.56, s * 0.28, a + 1.25, 0.7);
    return out;
  },
  signpost(g, s, rng, o, pal) {
    // A post with three boards pointing three ways, stones heaped at its foot.
    const a = rng() * 6.28, out = [circle(0, 0, s * 0.2, 12)];
    for (let i = 0; i < 6; i++) { const t = a + i * 1.05, c = [Math.cos(t) * s * 0.26, Math.sin(t) * s * 0.26]; stoneLump(g, rng, o, c[0], c[1], s * 0.13, s * 0.1, t, STONE, 0.14); }
    [[0.3, 0.74, 0.7], [2.5, 0.6, 0.82], [4.4, 0.68, 0.94]].forEach(([t, len, h], i) => {
      const q = at(a + t), w = s * 0.115, board = [q(s * 0.05, -w), q(len * s, -w), q(len * s + w * 1.1, 0), q(len * s, w), q(s * 0.05, w)]; out.push(board);
      under(g, board, o, 0.4); g.save(); pathOf(g, board, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, board, true); o.maps.clip(); }
      plank(g, rng, o, ...q(len * s * 0.55, 0), len * s * 0.7, w, a + t, i % 2 ? shade(pal.wood, -0.12) : pal.wood, h);
      if (o.detail) for (const v of [-0.4, 0.3]) { let u = s * 0.22; for (let k = 0; k < 5 && u < len * s * 0.9; k++) { const l = s * (0.04 + ((k * 7 + i * 3) % 5) * 0.012); line(g, [q(u, v * w), q(u + l, v * w)], 'rgba(20,10,2,0.6)', Math.max(0.7, o.ink * 0.9), 'butt'); u += l + s * 0.03; } }
      g.restore(); o.maps?.restore(); thinLine(g, board, true, pal.wood, o, 1.1);
      for (const v of [-0.5, 0.5]) stud(g, o, ...q(s * 0.12, v * w), Math.max(0.8, s * 0.018), pal, h + 0.03);
    });
    post(g, o, [0, 0], s * 0.16, pal, 1);
    return out;
  },
  hitchingPost(g, s, rng, o, pal) {
    // A rail on two posts, iron rings under it to tie to.
    const a = (rng() - 0.5) * 0.2, p = at(a), L = s * 0.8, rail = boxAt(0, 0, L, s * 0.07, a), rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    for (const u of [-0.5, 0, 0.5]) { const c = p(u * L, s * 0.13); ring(g, c[0], c[1], s * 0.075, 'rgba(8,6,6,0.9)', Math.max(1.6, s * 0.04)); ring(g, c[0], c[1], s * 0.075, pal.metal, Math.max(0.9, s * 0.022)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], s * 0.075, 0, 6.283); o.maps.strokeStyle = mapsColour(0.5, 0.85); o.maps.lineWidth = Math.max(1.4, s * 0.035); o.maps.stroke(); } }
    if (o.detail) { const tail = [p(-L * 0.24, s * 0.05), p(-L * 0.3, s * 0.3), p(-L * 0.1, s * 0.46), p(L * 0.06, s * 0.6)]; line(g, tail, 'rgba(30,16,2,0.85)', Math.max(1.6, s * 0.04)); line(g, tail, rope, Math.max(0.9, s * 0.024)); const sh = p(L * 0.5, -s * 0.36), q = at(a + 0.8, sh[0], sh[1]), shoe = Array.from({ length: 9 }, (_, k) => { const t = Math.PI * 0.15 + (k / 8) * Math.PI * 1.7; return q(Math.cos(t) * s * 0.1, Math.sin(t) * s * 0.12); }); line(g, shoe, 'rgba(8,6,6,0.9)', Math.max(1.8, s * 0.045)); line(g, shoe, pal.metal, Math.max(1, s * 0.026)); relLine(o, shoe, Math.max(1.4, s * 0.035), 0.05, 0.85); }
    under(g, rail, o, 0.4); plank(g, rng, o, 0, 0, L, s * 0.07, a, pal.wood, 0.85);
    for (const e of [-1, 1]) cutEnd(g, rng, o, p(e * L * 0.99, 0), s * 0.025, s * 0.066, a, pal, 0.85);
    if (o.detail) for (let k = -2; k <= 2; k++) { const w = [p(-L * 0.24 + k * s * 0.022, -s * 0.078), p(-L * 0.24 + k * s * 0.022 + s * 0.012, s * 0.078)]; line(g, w, 'rgba(30,16,2,0.85)', Math.max(1.2, s * 0.022), 'butt'); line(g, w, rope, Math.max(0.7, s * 0.013), 'butt'); }
    for (const u of [-0.8, 0.8]) post(g, o, p(u * L, 0), s * 0.12, pal, 0.96);
    return [rail];
  },
  planter(g, s, rng, o, pal) {
    // A box of earth with things growing in it.
    const a = (rng() - 0.5) * 0.1, p = at(a), L = s * 0.9, W = s * 0.38, box = boxAt(0, 0, L, W, a);
    under(g, box, o, 0.35); pathOf(g, box, true); g.fillStyle = '#2a1f16'; g.fill(); rel(o, box, true, 0.34, 0.03);
    g.save(); pathOf(g, box, true); g.clip(); for (let i = 0; i < 120; i++) { const c = p((rng() - 0.5) * L * 1.9, (rng() - 0.5) * W * 1.7); disc(g, c[0], c[1], Math.max(0.5, s * (0.006 + rng() * 0.012)), rng() < 0.5 ? 'rgba(90,66,40,0.7)' : 'rgba(12,8,4,0.7)'); } g.restore();
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * W * 0.86), L, W * 0.14, a, pal.wood, 0.5);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * L * 0.955, 0), W * 0.72, L * 0.045, a + Math.PI / 2, pal.wood, 0.5);
    if (o.detail) for (const u of [-0.5, 0, 0.5]) for (const v of [-0.86, 0.86]) { plate(g, o, boxAt(...p(u * L, v * W), L * 0.025, W * 0.15, a), pal, 0.54); }
    thinLine(g, box, true, pal.wood, o, 1.2);
    for (let i = 0; i < 5; i++) { const c = p((i - 2) * L * 0.38 + (rng() - 0.5) * L * 0.08, (rng() - 0.5) * W * 0.4); tuft(g, rng, o, c[0], c[1], W * (0.5 + rng() * 0.16), o.green, 0.7); }
    if (o.detail) for (let i = 0; i < 11; i++) { const c = p((rng() - 0.5) * L * 1.7, (rng() - 0.5) * W * 1.3); flower(g, rng, o, c[0], c[1], s * (0.035 + rng() * 0.015), varied(pal.cloth, rng, 1.2)); }
    return [box];
  },
  washingLine(g, s, rng, o, pal) {
    // A line between two poles with the wash on it, blown a little to one side so each piece lies out from the line.
    const a = (rng() - 0.5) * 0.12, p = at(a), L = s * 0.9, linen = hexOf(mix(pal.cloth, '#e6dcc6', 0.86)), other = hexOf(mix(CLOTHS[CLOTH_IDS[Math.floor(rng() * CLOTH_IDS.length)]].base, '#8a7a6a', 0.3)), rope = hexOf(mix(pal.wood, '#c9a868', 0.6)), out = [], sag = (u) => (1 - (u / L) ** 2) * s * 0.06;
    [[-0.72, 0.17, linen, 0.34], [-0.4, 0.1, pal.cloth, 0.22], [-0.14, 0.11, linen, 0.26], [0.2, 0.18, other, 0.3], [0.54, 0.1, linen, 0.2], [0.76, 0.07, pal.cloth, 0.16]].forEach(([u0, hw, dye, drop], i) => {
      const u = u0 * L, w = hw * L, d = drop * s, y0 = sag(u), piece = [p(u - w, y0 - s * 0.01), p(u + w, y0 - s * 0.01), p(u + w * (0.9 + rng() * 0.15), y0 + d), p(u + w * 0.2, y0 + d * (1 + rng() * 0.12)), p(u - w * (0.9 + rng() * 0.15), y0 + d * 0.96)]; out.push(piece);
      under(g, piece, o, 0.35); clothFlat(g, o, piece, true, dye, 0.62, [[p(u - w * 0.4, y0), p(u - w * 0.3, y0 + d)], [p(u + w * 0.35, y0), p(u + w * 0.45, y0 + d * 0.95)]]);
      if (o.detail && i === 3) { g.save(); pathOf(g, piece, true); g.clip(); for (const k of [0.3, 0.42, 0.74]) line(g, [p(u - w, y0 + d * k), p(u + w, y0 + d * k)], 'rgba(255,244,225,0.5)', Math.max(0.8, s * 0.014), 'butt'); g.restore(); }
      for (const e of [-0.8, 0.8]) { const c = p(u + e * w, y0); const peg = boxAt(c[0], c[1], s * 0.012, s * 0.03, a); pathOf(g, peg, true); g.fillStyle = pal.woodPale; g.fill(); thinLine(g, peg, true, pal.wood, o, 0.6); }
    });
    { const pts = Array.from({ length: 13 }, (_, k) => { const u = -L + (k / 12) * 2 * L; return p(u, sag(u)); }); line(g, pts, 'rgba(30,16,2,0.85)', Math.max(1.2, s * 0.022)); line(g, pts, rope, Math.max(0.7, s * 0.012)); relLine(o, pts, Math.max(1, s * 0.02), 0.92, 0.05); }
    for (const u of [-1, 1]) { post(g, o, p(u * L, 0), s * 0.07, pal, 1); out.push(circle(...p(u * L, 0), s * 0.07, 10)); }
    return out;
  },
  pump(g, s, rng, o, pal) {
    // A hand pump on a stone slab: its barrel from over it, a spout one way, a long handle the other.
    const a = rng() * 6.28, p = at(a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) }, slab = blockAt(rng, 0, 0, s * 0.56, s * 0.56, a, s * 0.02), bar = (pts, w, h, col = iron.metal) => { line(g, pts, 'rgba(8,6,6,0.9)', w * 1.7); line(g, pts, col, w); relLine(o, pts, w * 1.4, h, 0.85); };
    under(g, slab, o, 0.3); stonePoly(g, rng, o, slab, true, STONE, 0.1);
    if (o.detail) {
      g.save(); pathOf(g, slab, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; g.fillStyle = 'rgba(20,24,28,0.45)'; { const c = p(s * 0.4, 0); g.beginPath(); g.ellipse(c[0], c[1], s * 0.3, s * 0.22, a, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
      const c = p(s * 0.52, 0), r = s * 0.2; under(g, circle(c[0], c[1], r), o, 0.35); disc(g, c[0], c[1], r, pal.wood); for (let i = 0; i < 8; i++) { const t = i * 0.785; line(g, [[c[0] + Math.cos(t) * r * 0.66, c[1] + Math.sin(t) * r * 0.66], [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]], 'rgba(16,7,0,0.8)', Math.max(0.5, o.ink * 0.6)); } ring(g, c[0], c[1], r * 0.84, pal.metal, Math.max(1, r * 0.12)); disc(g, c[0], c[1], r * 0.66, '#1f2c35'); ring(g, c[0], c[1], r * 0.66, 'rgba(8,6,6,0.9)', Math.max(0.6, o.ink * 0.7)); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.8, o.ink)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.24, 0.3, 0.2);
    }
    plate(g, o, circle(0, 0, s * 0.27, 20), iron, 0.3); for (let i = 0; i < 4; i++) stud(g, o, Math.cos(a + 0.78 + i * 1.57) * s * 0.21, Math.sin(a + 0.78 + i * 1.57) * s * 0.21, Math.max(0.9, s * 0.022), iron, 0.34);
    bar([p(0, 0), p(s * 0.36, 0)], Math.max(1.6, s * 0.07), 0.7); bar([p(s * 0.36, 0), p(s * 0.44, 0)], Math.max(1.4, s * 0.05), 0.6);
    bar([p(0, 0), p(-s * 0.6, s * 0.08)], Math.max(1.2, s * 0.035), 0.94); bar([p(-s * 0.6, s * 0.08), p(-s * 0.86, s * 0.12)], Math.max(1.6, s * 0.055), 0.94, hexOf(shade(pal.wood, -0.1)));
    under(g, circle(0, 0, s * 0.17), o, 0.4); plate(g, o, circle(0, 0, s * 0.17, 20), iron, 0.9); ring(g, 0, 0, s * 0.11, 'rgba(8,6,6,0.7)', Math.max(0.6, o.ink * 0.7)); stud(g, o, 0, 0, Math.max(1, s * 0.04), iron, 1);
    return [slab];
  },
  kennel(g, s, rng, o, pal) {
    // A dog's house from over it: a boarded roof in two slopes to a ridge, its doorway at one end.
    const a = (rng() - 0.5) * 0.3, p = at(a), L = s * 0.62, W = s * 0.58, roof = boxAt(0, 0, L, W, a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) };
    { const door = boxAt(...p(L * 1.02, 0), L * 0.07, W * 0.34, a); pathOf(g, door, true); g.fillStyle = '#120c06'; g.fill(); }
    if (o.detail) {
      const ch = Array.from({ length: 12 }, (_, k) => { const t = k / 11; return p(L * (1.02 + t * 0.36), W * (0.05 + Math.sin(t * 4) * 0.12 - t * 0.3)); }); for (const c of ch) { disc(g, c[0], c[1], Math.max(0.9, s * 0.018), iron.metal); ring(g, c[0], c[1], Math.max(0.9, s * 0.018), 'rgba(8,6,6,0.85)', Math.max(0.4, o.ink * 0.4)); }
      const b = p(L * 1.26, W * 0.5), r = s * 0.13; under(g, circle(b[0], b[1], r), o, 0.3); plate(g, o, circle(b[0], b[1], r, 18), pal, 0.16); disc(g, b[0], b[1], r * 0.7, '#1f2c35'); ring(g, b[0], b[1], r * 0.7, 'rgba(8,6,6,0.85)', Math.max(0.5, o.ink * 0.6));
      const bq = at(a + 0.7, ...p(L * 1.28, -W * 0.56)), bone = [bq(-s * 0.1, 0), bq(s * 0.1, 0)]; line(g, bone, 'rgba(40,30,16,0.9)', Math.max(2, s * 0.06)); line(g, bone, '#e2d6b8', Math.max(1.2, s * 0.038)); for (const e of [-1, 1]) for (const v of [-1, 1]) { const c = bq(e * s * 0.11, v * s * 0.03); disc(g, c[0], c[1], s * 0.035, '#e2d6b8'); ring(g, c[0], c[1], s * 0.035, 'rgba(40,30,16,0.8)', Math.max(0.4, o.ink * 0.5)); }
    }
    under(g, roof, o, 0.4); pathOf(g, roof, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) plank(g, rng, o, ...p(0, side * W * (1 - (k + 0.5) / 3)), L, W / 6, a, shade(pal.wood, -0.05), 0.5 + k * 0.14);
    plank(g, rng, o, 0, 0, L * 1.02, W * 0.06, a, shade(pal.wood, -0.22), 0.96);
    for (let i = -2; i <= 2; i++) stud(g, o, ...p(i * L * 0.4, 0), Math.max(0.8, s * 0.016), pal, 0.98);
    if (o.detail) { const patch = boxAt(...p(-L * 0.3, W * 0.5), L * 0.22, W * 0.15, a + 0.08), q = at(a + 0.08, ...p(-L * 0.3, W * 0.5)); under(g, patch, o, 0.25); plank(g, rng, o, ...q(0, 0), L * 0.22, W * 0.15, a + 0.08, shade(pal.wood, 0.14), 0.74); for (const [u, v] of C4) stud(g, o, ...q(u * L * 0.18, v * W * 0.1), Math.max(0.7, s * 0.012), pal, 0.76); }
    thinLine(g, roof, true, pal.wood, o, 1.2);
    return [roof];
  },
  tent(g, s, rng, o, pal) {
    // A ridge tent: canvas in two slopes, guyed out to pegs, its flaps open at one end.
    const a = (rng() - 0.5) * 0.2, p = at(a), L = s * 0.72, W = s * 0.54, canvas = hexOf(mix(pal.cloth, '#c9bc9a', 0.8)), body = boxAt(0, 0, L, W, a), rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    const guy = (from, to) => { line(g, [from, to], 'rgba(30,16,2,0.8)', Math.max(1, s * 0.016)); line(g, [from, to], rope, Math.max(0.6, s * 0.008)); const peg = boxAt(to[0], to[1], s * 0.018, s * 0.035, a + 0.6); pathOf(g, peg, true); g.fillStyle = pal.woodPale; g.fill(); thinLine(g, peg, true, pal.wood, o, 0.7); rel(o, peg, true, 0.08, 0.1); };
    for (const u of [-1, -0.33, 0.33, 1]) for (const side of [-1, 1]) guy(p(u * L, side * W), p(u * L * 1.08, side * W * 1.52));
    for (const e of [-1, 1]) guy(p(e * L, 0), p(e * L * 1.24, 0));
    under(g, body, o, 0.4);
    for (const side of [-1, 1]) clothFlat(g, o, boxAt(...p(0, side * W * 0.5), L, W * 0.5, a), true, canvas, 0.5, [-0.8, -0.45, -0.1, 0.3, 0.66].map((u) => [p(u * L, 0), p((u + (rng() - 0.5) * 0.1) * L, side * W * 0.55), p((u + (rng() - 0.5) * 0.14) * L, side * W)]));
    ridgeRel(o, p, L, W, a, 0.3, 0.94, 5);
    for (const u of [-0.33, 0.33]) line(g, [p(u * L, -W), p(u * L, W)], 'rgba(40,30,14,0.45)', Math.max(0.6, o.ink * 0.7), 'butt');
    line(g, [p(-L, 0), p(L, 0)], 'rgba(30,22,10,0.8)', Math.max(0.9, o.ink * 1.1)); line(g, [p(-L, o.ink), p(L, o.ink)], 'rgba(255,246,225,0.3)', Math.max(0.5, o.ink * 0.6));
    { const open = [p(L, -W * 0.34), p(L * 0.66, 0), p(L, W * 0.34)]; pathOf(g, open, true); g.fillStyle = '#17110b'; g.fill(); thinLine(g, open, true, canvas, o, 0.9); rel(o, open, true, 0.12, 0.03); for (const side of [-1, 1]) { const flap = [p(L, side * W * 0.34), p(L * 0.66, 0), p(L * 0.8, side * W * 0.3)]; pathOf(g, flap, true); g.fillStyle = shade(canvas, -0.1); g.fill(); thinLine(g, flap, true, canvas, o, 0.8); } }
    if (o.detail) {
      for (const [u, v, t] of [[-0.5, -0.55, 0.2], [0.2, 0.6, -0.15]]) { const patch = boxAt(...p(u * L, v * W), L * 0.09, W * 0.12, a + t); pathOf(g, patch, true); g.fillStyle = shade(canvas, -0.18); g.fill(); g.setLineDash([o.ink * 2, o.ink * 1.6]); pathOf(g, patch, true); g.strokeStyle = 'rgba(60,34,10,0.6)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); g.setLineDash([]); }
      g.save(); pathOf(g, body, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; for (const [u, v] of [[-0.7, 0.7], [0.5, -0.8], [0, 0.9]]) { const c = p(u * L, v * W); g.fillStyle = 'rgba(60,50,24,0.26)'; g.beginPath(); g.ellipse(c[0], c[1], L * 0.2, W * 0.16, a, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
    }
    for (const e of [-1, 1]) { const c = p(e * L * 0.98, 0); disc(g, c[0], c[1], s * 0.03, pal.woodDark); ring(g, c[0], c[1], s * 0.03, mix(pal.wood, '#0c0904', 0.92), Math.max(0.7, o.ink * 0.8)); }
    thinLine(g, body, true, canvas, o, 1.2);
    return [body];
  },
  marketStall(g, s, rng, o, pal) {
    // A stall: a striped awning on four posts, sloping to a scalloped front, and under its edge the counter with what is for sale.
    const a = (rng() - 0.5) * 0.08, p = at(a), L = s * 0.84, W = s * 0.44, cream = hexOf(mix(pal.cloth, '#e6dcc6', 0.86)), awn = boxAt(...p(0, -W * 0.3), L, W * 0.78, a), foot = boxAt(0, 0, L, W * 1.08, a), N = 9, sw = (L * 2) / N;
    const counter = boxAt(...p(0, W * 0.8), L * 0.96, W * 0.26, a); under(g, counter, o, 0.35);
    for (const k of [-0.5, 0.5]) plank(g, rng, o, ...p(0, W * 0.8 + k * W * 0.26), L * 0.96, W * 0.13, a, pal.wood, 0.5);
    thinLine(g, counter, true, pal.wood, o, 1.1);
    if (o.detail) {
      // On the counter: trays of produce, loaves, bolts of cloth.
      const sr = seeded(899);
      for (const [u, dye] of [[-0.74, '#b0382c'], [-0.44, '#c9a23a'], [-0.14, '#5d7a3a']]) { const c = p(u * L, W * 0.8), q = at(a, c[0], c[1]), tray = boxAt(c[0], c[1], L * 0.12, W * 0.2, a); under(g, tray, o, 0.3); pathOf(g, tray, true); g.fillStyle = '#1c140c'; g.fill(); for (let i = 0; i < 9; i++) { const f = q((sr() - 0.5) * L * 0.18, (sr() - 0.5) * W * 0.3), r = s * 0.028, col = varied(dye, sr, 1.4); roundBody(g, o, f, r, col); ring(g, f[0], f[1], r, mix(col, '#0c0904', 0.6), Math.max(0.4, o.ink * 0.4)); } pathOf(g, tray, true); g.strokeStyle = shade(pal.wood, -0.1); g.lineWidth = Math.max(1.4, s * 0.02); g.stroke(); thinLine(g, tray, true, pal.wood, o, 0.9); rel(o, tray, true, 0.58, 0.1); }
      for (let i = 0; i < 3; i++) { const c = p((0.14 + i * 0.13) * L, W * (0.76 + (i % 2) * 0.08)), loaf = oval(c[0], c[1], s * 0.05, s * 0.085, a + 0.3 + i * 0.2, 14); under(g, loaf, o, 0.25); pathOf(g, loaf, false); g.fillStyle = varied('#b8843c', sr, 1); g.fill(); const q = at(a + 0.3 + i * 0.2, c[0], c[1]); for (const v of [-0.4, 0, 0.4]) line(g, [q(-s * 0.03, v * s * 0.085), q(s * 0.03, v * s * 0.085 + s * 0.01)], 'rgba(60,30,6,0.6)', Math.max(0.6, o.ink * 0.7)); thinLine(g, loaf, false, '#b8843c', o, 0.9); relDome(o, loaf, c[0], c[1], s * 0.085, 0.54, 0.62, 0.1); }
      for (const [u, dye] of [[0.62, pal.cloth], [0.76, hexOf(mix(CLOTHS[CLOTH_IDS[Math.floor(sr() * CLOTH_IDS.length)]].base, '#6a5a4a', 0.3))], [0.9, cream]]) { const bolt = boxAt(...p(u * L, W * 0.8), L * 0.055, W * 0.22, a + (sr() - 0.5) * 0.2); under(g, bolt, o, 0.25); clothFlat(g, o, bolt, true, dye, 0.6); }
    }
    for (const [u, v] of [[-1, -1.02], [1, -1.02], [-1, 0.52], [1, 0.52]]) post(g, o, p(u * L * 0.97, v * W), s * 0.045, pal, 0.9);
    under(g, awn, o, 0.45); pathOf(g, awn, true); g.fillStyle = cream; g.fill(); if (o.clothMask) { pathOf(o.clothMask, awn, true); o.clothMask.fillStyle = '#fff'; o.clothMask.fill(); }
    g.save(); pathOf(g, awn, true); g.clip();
    for (let i = 0; i < N; i += 2) { pathOf(g, boxAt(...p(-L + (i + 0.5) * sw, -W * 0.3), sw / 2, W * 0.8, a), true); g.fillStyle = pal.cloth; g.fill(); }
    if (o.fine) fineWork(g, seeded(900), at(a, ...p(0, -W * 0.3)), L, W * 0.78, { along: false, dark: '10,6,2', pale: '255,244,225', much: 1.3 });
    for (let i = 1; i < N; i++) line(g, [p(-L + i * sw, -W * 1.1), p(-L + i * sw, W * 0.5)], 'rgba(8,4,0,0.2)', Math.max(0.5, o.ink * 0.6), 'butt');
    for (const u of [-0.6, -0.1, 0.45]) { const f = [p(u * L, -W * 1.08), p((u + 0.03) * L, -W * 0.3), p((u - 0.02) * L, W * 0.48)]; line(g, f, 'rgba(8,4,0,0.22)', Math.max(0.7, o.ink * 0.9)); line(g, f.map(([x, y]) => [x + o.ink, y]), 'rgba(255,244,225,0.14)', Math.max(0.5, o.ink * 0.6)); }
    { const c = p(0, -W * 0.3), gr = g.createRadialGradient(c[0], c[1], W * 0.5, c[0], c[1], L * 1.1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,4,0,0.3)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore();
    for (let k = 0; k < 16; k++) rel(o, boxAt(...p(0, -W * 1.08 + (k + 0.5) * W * 0.0975), L, W * 0.052, a), true, 0.96 - k * 0.025, 0.03);
    // Its front edge cut in scallops, one to each stripe.
    for (let i = 0; i < N; i++) { const c = p(-L + (i + 0.5) * sw, W * 0.48), sc = Array.from({ length: 9 }, (_, k) => { const t = (k / 8) * Math.PI; return [c[0] + Math.cos(a + t) * sw * 0.48, c[1] + Math.sin(a + t) * sw * 0.42]; }); pathOf(g, sc, true); g.fillStyle = i % 2 ? cream : pal.cloth; g.fill(); thinLine(g, sc, true, i % 2 ? cream : pal.cloth, o, 0.8); rel(o, sc, true, 0.58, 0.03); }
    thinLine(g, awn, true, pal.cloth, o, 1.2);
    return [foot];
  },
  fence(g, s, rng, o, pal) {
    // A length of post-and-rail fence, laid dead along its run so that length joins length: a post at each end and one between.
    const L = s * 0.9, rail = boxAt(0, 0, L, s * 0.04, 0), out = [rail];
    plank(g, rng, o, 0, s * 0.04, L, s * 0.028, 0, shade(pal.wood, -0.22), 0.4);
    under(g, rail, o, 0.35); plank(g, rng, o, 0, 0, L, s * 0.04, 0, pal.wood, 0.75);
    if (o.detail) { g.save(); pathOf(g, rail, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.012)}px)`; const sr = seeded(901); for (let i = 0; i < 5; i++) { g.fillStyle = sr() < 0.5 ? 'rgba(96,118,60,0.5)' : 'rgba(170,172,160,0.45)'; g.beginPath(); g.arc((sr() - 0.5) * L * 1.8, (sr() - 0.5) * s * 0.06, s * (0.02 + sr() * 0.03), 0, 6.283); g.fill(); } g.filter = 'none'; g.restore(); }
    for (const u of [-1, 0, 1]) { const c = [u * L, 0]; postEnd(g, rng, o, c, s * 0.07, 0, pal, 0.84); out.push(boxAt(c[0], c[1], s * 0.07, s * 0.07, 0)); for (const e of [-1, 1]) if (Math.abs(u + e * 0.11) <= 1) stud(g, o, c[0] + e * s * 0.1, 0, Math.max(0.8, s * 0.011), pal, 0.78); }
    return out;
  },
  stakeFence(g, s, rng, o, pal) {
    // A palisade of sharpened stakes, withies woven between them: each stake seen down onto its point.
    const L = s * 0.85, n = 11, withy = hexOf(mix(pal.wood, '#c9a868', 0.5)), out = [boxAt(0, 0, L, s * 0.07, 0)], step = (L * 2) / (n - 1);
    for (const ph of [0, Math.PI]) { const band = Array.from({ length: 45 }, (_, k) => { const u = -L + (k / 44) * 2 * L; return [u, Math.sin((u + L) / step * Math.PI + ph) * s * 0.05]; }); line(g, band, 'rgba(30,16,2,0.85)', Math.max(1.6, s * 0.03)); line(g, band, ph ? shade(withy, -0.12) : withy, Math.max(0.9, s * 0.018)); relLine(o, band, Math.max(1.4, s * 0.026), 0.4, 0.05); }
    for (let i = 0; i < n; i++) {
      const c = [-L + i * step, (rng() - 0.5) * s * 0.02], r = s * (0.055 + rng() * 0.015), wood = varied(hexOf(shade(pal.wood, 0.1)), rng, 1.3), tip = circle(c[0], c[1], r, 14);
      under(g, tip, o, 0.35); disc(g, c[0], c[1], r, hexOf(mix(pal.wood, '#3a2a1c', 0.6))); disc(g, c[0], c[1], r * 0.84, wood);
      const t0 = rng() * 6.28; for (let k = 0; k < 5; k++) { const t = t0 + k * 1.257; line(g, [c, [c[0] + Math.cos(t) * r * 0.84, c[1] + Math.sin(t) * r * 0.84]], 'rgba(40,18,4,0.55)', Math.max(0.5, o.ink * 0.5)); }
      disc(g, c[0], c[1], Math.max(0.6, r * 0.14), hexOf(shade(wood, 0.25)));
      ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.7, o.ink * 0.8)); relDome(o, tip, c[0], c[1], r, 0.5, 0.74, 0.1);
    }
    return out;
  },
  rails(g, s, rng, o, pal) {
    // Mine track, laid dead along its run: two iron rails spiked to wooden sleepers.
    const L = s * 0.9, G = s * 0.26, iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.45)) }, foot = boxAt(0, 0, L, s * 0.42, 0);
    if (o.detail) { const sr = seeded(902); for (let i = 0; i < 90; i++) { const c = [(sr() - 0.5) * L * 2, (sr() - 0.5) * s * 0.84], r = s * (0.012 + sr() * 0.02), col = varied(STONE, sr, 1.6); disc(g, c[0], c[1], r, col); ring(g, c[0], c[1], r, mix(col, '#0c0904', 0.7), Math.max(0.4, o.ink * 0.4)); } }
    for (let i = -3; i <= 3; i++) { const c = [i * L * 0.3, (rng() - 0.5) * s * 0.02], t = Math.PI / 2 + (rng() - 0.5) * 0.06; under(g, boxAt(c[0], c[1], s * 0.055, s * 0.42, t - Math.PI / 2), o, 0.25); plank(g, rng, o, c[0], c[1], s * 0.42, s * 0.055, t, shade(pal.wood, -0.2), 0.05); for (const v of [-1, 1]) for (const e of [-1, 1]) stud(g, o, c[0] + e * s * 0.025, v * G + e * v * s * 0.03, Math.max(0.8, s * 0.011), iron, 0.1); }
    for (const v of [-1, 1]) { const r = [[-L, v * G], [L, v * G]]; line(g, r, 'rgba(8,6,6,0.9)', Math.max(2.2, s * 0.05), 'butt'); line(g, r, iron.metal, Math.max(1.4, s * 0.032), 'butt'); line(g, r, mix(iron.metal, '#d2d6dc', 0.5), Math.max(0.7, s * 0.012), 'butt'); relLine(o, r, Math.max(1.8, s * 0.04), 0.14, 0.9); }
    return [foot];
  },
  sarcophagus(g, s, rng, o, pal) {
    // A stone coffin: its chest, and on it a lid a hand narrower all round, carved with a sword between two wheels.
    const a = (rng() - 0.5) * 0.1, p = at(a), L = s * 0.86, W = s * 0.44, base = blockAt(rng, 0, 0, L, W, a, s * 0.01), ajar = !!o.detail, t = ajar ? a + 0.07 : a, lc = ajar ? p(L * 0.04, -W * 0.07) : [0, 0], q = at(t, lc[0], lc[1]), lid = boxAt(lc[0], lc[1], L * 0.93, W * 0.86, t);
    under(g, base, o, 0.4); stonePoly(g, rng, o, base, true, STONE, 0.6);
    if (ajar) { const gap = boxAt(0, 0, L * 0.88, W * 0.76, a); pathOf(g, gap, true); g.fillStyle = '#0e0b09'; g.fill(); rel(o, gap, true, 0.2, 0.03); }
    under(g, lid, o, 0.45); stonePoly(g, rng, o, lid, true, '#98948c', 0.9);
    { const b = boxAt(lc[0], lc[1], L * 0.86, W * 0.74, t); b.push(b[0]); cutLine(g, o, b, 0.84); }
    cutLine(g, o, [q(-L * 0.6, 0), q(-L * 0.48, -W * 0.06), q(L * 0.24, -W * 0.06), q(L * 0.24, -W * 0.26), q(L * 0.31, -W * 0.26), q(L * 0.31, -W * 0.06), q(L * 0.5, -W * 0.05), q(L * 0.56, 0), q(L * 0.5, W * 0.05), q(L * 0.31, W * 0.06), q(L * 0.31, W * 0.26), q(L * 0.24, W * 0.26), q(L * 0.24, W * 0.06), q(-L * 0.48, W * 0.06), q(-L * 0.6, 0)], 0.84);
    cutLine(g, o, [q(-L * 0.5, 0), q(L * 0.2, 0)], 0.84);
    for (const u of [-0.74, 0.72]) { const c = q(u * L, 0), r = W * 0.17, w = circle(c[0], c[1], r, 18); w.push(w[0]); cutLine(g, o, w, 0.84); for (let i = 0; i < 6; i++) { const k = t + i * 1.047; cutLine(g, o, [[c[0] + Math.cos(k) * r * 0.25, c[1] + Math.sin(k) * r * 0.25], [c[0] + Math.cos(k) * r * 0.9, c[1] + Math.sin(k) * r * 0.9]], 0.84); } }
    return [base];
  },
  coffin(g, s, rng, o, pal) {
    // A plain wooden coffin, widest at the shoulder: boards along it, a batten across at shoulder and knee, nailed down all round.
    const a = (rng() - 0.5) * 0.3, p = at(a), L = s * 0.84, W = s * 0.4, shape = [p(-L, -W * 0.55), p(-L * 0.42, -W), p(L, -W * 0.62), p(L, W * 0.62), p(-L * 0.42, W), p(-L, W * 0.55)], rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    if (o.detail) for (const v of [-1, 1]) for (const u of [-0.1, 0.55]) { const arc = Array.from({ length: 7 }, (_, k) => { const tt = (k / 6) * Math.PI; return p(u * L + Math.cos(tt) * L * 0.12, v * (W * (u < 0.2 ? 0.94 : 0.72) + Math.sin(tt) * W * 0.2)); }); line(g, arc, 'rgba(30,16,2,0.85)', Math.max(1.6, s * 0.035)); line(g, arc, rope, Math.max(0.9, s * 0.02)); }
    under(g, shape, o, 0.4); pathOf(g, shape, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    g.save(); pathOf(g, shape, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, shape, true); o.maps.clip(); }
    for (let k = -2; k <= 2; k++) plank(g, rng, o, ...p(0, k * W * 0.4), L * 1.02, W * 0.2, a, pal.wood, 0.5);
    for (const u of [-0.42, 0.5]) plank(g, rng, o, ...p(u * L, 0), W * 1.02, L * 0.05, a + Math.PI / 2, shade(pal.wood, -0.16), 0.56);
    g.restore(); o.maps?.restore();
    for (let i = 0; i < 6; i++) { const A = shape[i], B = shape[(i + 1) % 6]; for (const k of i === 0 || i === 3 ? [0.5] : [0.25, 0.5, 0.75]) { const x = A[0] + (B[0] - A[0]) * k, y = A[1] + (B[1] - A[1]) * k; stud(g, o, x * 0.93, y * 0.93, Math.max(0.8, s * 0.013), pal, 0.54); } }
    if (o.detail) { plate(g, o, boxAt(...p(-L * 0.08, 0), L * 0.13, W * 0.22, a), pal, 0.56); for (const v of [-0.4, 0, 0.4]) line(g, [p(-L * 0.17, v * W * 0.3), p(L * 0.01, v * W * 0.3)], 'rgba(8,6,6,0.45)', Math.max(0.5, o.ink * 0.5)); }
    worn(g, rng, o, shape, a, L, pal.wear); thinLine(g, shape, true, pal.wood, o, 1.2);
    return [shape];
  },
  tombstone(g, s, rng, o, pal) {
    // A grave: a mound of turned earth, a headstone standing at the head of it, seen down onto its top edge.
    const a = (rng() - 0.5) * 0.3, p = at(a), mc = p(s * 0.14, 0), mound = oval(mc[0], mc[1], s * 0.62, s * 0.36, a, 26), SOIL = '#4a3a28', out = [];
    pathOf(g, mound, false); g.fillStyle = SOIL; g.fill();
    g.save(); pathOf(g, mound, false); g.clip();
    { const gr = g.createRadialGradient(mc[0], mc[1], s * 0.05, mc[0], mc[1], s * 0.62); gr.addColorStop(0, 'rgba(160,130,90,0.3)'); gr.addColorStop(1, 'rgba(10,6,2,0.45)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    for (let i = 0; i < 170; i++) { const c = p(s * 0.14 + (rng() - 0.5) * s * 1.3, (rng() - 0.5) * s * 0.76); disc(g, c[0], c[1], Math.max(0.5, s * (0.006 + rng() * 0.012)), rng() < 0.5 ? 'rgba(120,96,64,0.7)' : 'rgba(16,10,4,0.7)'); }
    g.restore(); thinLine(g, mound, false, SOIL, o, 0.8); relDome(o, mound, mc[0], mc[1], s * 0.62, 0.02, 0.16, 0.03);
    for (let i = 0; i < 16; i++) { const t = (i / 16) * 6.283 + rng() * 0.3, c = p(s * 0.14 + Math.cos(t) * s * 0.6, Math.sin(t) * s * 0.35); for (let k = -1; k <= 1; k++) line(g, [c, [c[0] + Math.cos(t + k * 0.5) * s * 0.07, c[1] + Math.sin(t + k * 0.5) * s * 0.07]], varied(o.green, rng, 1.6), Math.max(0.8, o.ink * 0.9)); }
    if (o.detail) {
      const dr = seeded(904);
      for (let i = 0; i < 12; i++) { const t = (i / 12) * 6.283, c = p(s * 0.14 + Math.cos(t) * s * 0.56, Math.sin(t) * s * 0.31); stoneLump(g, dr, o, c[0], c[1], s * 0.05, s * 0.04, t, STONE, 0.1); }
      for (const [u, v] of [[0.0, -0.05], [0.14, 0.06], [-0.06, 0.1]]) { const c = p(u * s, v * s); line(g, [c, p((u + 0.2) * s, (v + 0.02) * s)], hexOf(shade(o.green, -0.1)), Math.max(0.8, o.ink)); flower(g, dr, o, c[0], c[1], s * 0.05, varied(pal.cloth, dr, 1.2)); }
    }
    const plinth = blockAt(rng, ...p(-s * 0.62, 0), s * 0.12, s * 0.4, a, s * 0.008), head = blockAt(rng, ...p(-s * 0.62, 0), s * 0.07, s * 0.34, a, s * 0.006); out.push(plinth);
    under(g, plinth, o, 0.35); stonePoly(g, rng, o, plinth, true, '#7c7870', 0.3); under(g, head, o, 0.4); stonePoly(g, rng, o, head, true, STONE, 0.95);
    g.save(); pathOf(g, head, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.012)}px)`; for (let i = 0; i < 4; i++) { const c = p(-s * 0.62 + (rng() - 0.5) * s * 0.1, (rng() - 0.5) * s * 0.6); g.fillStyle = 'rgba(86,110,52,0.55)'; g.beginPath(); g.arc(c[0], c[1], s * (0.03 + rng() * 0.04), 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
    return out;
  },
  altar(g, s, rng, o, pal) {
    // A stone altar on its step: the table's slab, a cloth laid across it and hanging down both sides.
    const a = (rng() - 0.5) * 0.06, p = at(a), L = s * 0.8, W = s * 0.46, step = blockAt(rng, 0, 0, L * 1.12, W * 1.34, a, s * 0.008), top = blockAt(rng, 0, 0, L, W, a, s * 0.006), cream = hexOf(mix(pal.cloth, '#e6dcc6', 0.86));
    under(g, step, o, 0.35); stonePoly(g, rng, o, step, true, '#7e7a72', 0.2);
    for (const u of [-0.38, 0.38]) cutLine(g, o, [p(u * L * 1.12, -W * 1.34), p(u * L * 1.12, W * 1.34)], 0.14);
    under(g, top, o, 0.45); stonePoly(g, rng, o, top, true, '#98948c', 0.9);
    { const b = boxAt(0, 0, L * 0.93, W * 0.86, a); b.push(b[0]); cutLine(g, o, b, 0.84); }
    const run = boxAt(0, 0, L * 0.34, W * 1.18, a);
    for (const e of [-1, 1]) for (let u = -L * 0.32; u <= L * 0.32; u += L * 0.035) line(g, [p(u, e * W * 1.18), p(u + (rng() - 0.5) * s * 0.01, e * (W * 1.18 + s * 0.05))], cream, Math.max(0.7, o.ink * 0.8));
    under(g, run, o, 0.3); clothFlat(g, o, run, true, pal.cloth, 0.93, [[p(-L * 0.34, -W), p(L * 0.34, -W * 1.0)], [p(-L * 0.34, W), p(L * 0.34, W * 1.0)]]);
    if (o.detail) {
      g.save(); pathOf(g, run, true); g.clip(); for (const u of [-0.27, 0.27]) line(g, [p(u * L, -W * 1.2), p(u * L, W * 1.2)], cream, Math.max(0.9, s * 0.014), 'butt'); const m = [p(-L * 0.16, 0), p(0, -W * 0.3), p(L * 0.16, 0), p(0, W * 0.3)]; pathOf(g, m, true); g.strokeStyle = cream; g.lineWidth = Math.max(0.9, s * 0.014); g.stroke(); ring(g, 0, 0, W * 0.1, cream, Math.max(0.9, s * 0.014)); g.restore();
      // A candle at either end of it, and a bowl for what is offered.
      for (const u of [-0.72, 0.72]) { const c = p(u * L, -W * 0.5), r = s * 0.06; disc(g, c[0], c[1], r * 1.5, pal.metal); ring(g, c[0], c[1], r * 1.5, mix(pal.metal, '#0c0904', 0.9), Math.max(0.7, o.ink * 0.9)); disc(g, c[0], c[1], r, '#e6dcc0'); ring(g, c[0], c[1], r, 'rgba(90,70,30,0.6)', Math.max(0.5, o.ink * 0.6)); disc(g, c[0], c[1], r * 0.2, '#1a1208'); disc(g, c[0], c[1], r * 0.1, '#e0782a'); relDome(o, circle(c[0], c[1], r * 1.5), c[0], c[1], r * 1.5, 0.92, 1, 0.5); }
      const b = p(L * 0.68, W * 0.42), r = s * 0.12; under(g, circle(b[0], b[1], r), o, 0.3); plate(g, o, circle(b[0], b[1], r, 18), pal, 0.95); disc(g, b[0], b[1], r * 0.72, '#3a1410'); ring(g, b[0], b[1], r * 0.72, 'rgba(8,6,6,0.85)', Math.max(0.5, o.ink * 0.6));
    }
    return [step];
  },
  statue(g, s, rng, o, pal) {
    // A statue from over it: a robed figure on a stepped plinth, hands on the pommel of a sword stood point down before it.
    const a = rng() * 6.28, p = at(a), ST = '#9a968e', plinth = blockAt(rng, 0, 0, s * 0.66, s * 0.66, a, s * 0.008);
    under(g, plinth, o, 0.4); stonePoly(g, rng, o, plinth, true, '#7e7a72', 0.2);
    { const up = blockAt(rng, 0, 0, s * 0.52, s * 0.52, a, s * 0.006); under(g, up, o, 0.4); stonePoly(g, rng, o, up, true, '#8c8880', 0.32); const b = boxAt(0, 0, s * 0.45, s * 0.45, a); b.push(b[0]); cutLine(g, o, b, 0.28); }
    const robe = circle(0, 0, s * 0.37, 30); under(g, robe, o, 0.45); stonePoly(g, rng, o, robe, false, '#88847c', 0.55);
    for (let i = 0; i < 14; i++) { const t = a + (i / 14) * 6.283 + 0.2; cutLine(g, o, [[Math.cos(t) * s * 0.15, Math.sin(t) * s * 0.15], [Math.cos(t + 0.06) * s * 0.36, Math.sin(t + 0.06) * s * 0.36]], 0.5); }
    // The sword stood point down before it: only its hilt shows from above, a cross of guard and grip.
    { const guard = boxAt(...p(0, s * 0.33), s * 0.13, s * 0.028, a), grip = boxAt(...p(0, s * 0.33), s * 0.028, s * 0.07, a); for (const part of [guard, grip]) { under(g, part, o, 0.4); pathOf(g, part, true); g.fillStyle = '#aaa69e'; g.fill(); thinLine(g, part, true, '#aaa69e', o, 0.9); rel(o, part, true, 0.72, 0.12); } }
    // Its arms come forward to the hilt; its shoulders one broad bar; its head, hooded, palest of all.
    for (const e of [-1, 1]) { const arm = oval(...p(e * s * 0.15, s * 0.17), s * 0.05, s * 0.17, a - e * 0.5, 16); pathOf(g, arm, false); g.fillStyle = '#98948c'; g.fill(); thinLine(g, arm, false, '#98948c', o, 0.9); rel(o, arm, false, 0.8, 0.12); }
    const sh = oval(0, 0, s * 0.29, s * 0.13, a, 24); under(g, sh, o, 0.4); stonePoly(g, rng, o, sh, false, '#98948c', 0.86);
    const head = circle(0, 0, s * 0.13, 20); under(g, head, o, 0.5); stonePoly(g, rng, o, head, false, '#aeaaa2', 0.95); relDome(o, head, 0, 0, s * 0.13, 0.9, 1, 0.12);
    cutLine(g, o, Array.from({ length: 9 }, (_, k) => { const t = Math.PI * (0.1 + (k / 8) * 0.8); return p(Math.cos(t) * s * 0.105, Math.sin(t) * s * 0.085); }), 0.9);
    if (o.detail) {
      g.save(); pathOf(g, plinth, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.016)}px)`; const sr = seeded(903); for (let i = 0; i < 6; i++) { const t = sr() * 6.283, c = [Math.cos(t) * s * 0.56, Math.sin(t) * s * 0.56]; g.fillStyle = 'rgba(86,110,52,0.5)'; g.beginPath(); g.arc(c[0], c[1], s * (0.04 + sr() * 0.05), 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
      cutLine(g, o, [p(-s * 0.66, s * 0.3), p(-s * 0.5, s * 0.42), p(-s * 0.56, s * 0.56), p(-s * 0.44, s * 0.66)], 0.14);
    }
    return [plinth];
  },
  brokenPillar(g, s, rng, o, pal) {
    // A column broken off short: its plinth, the fluted drum still standing with a ragged top, two drums lying where they fell.
    const a = rng() * 6.28, p = at(a), R = s * 0.33, c0 = p(-s * 0.24, -s * 0.12), plinth = blockAt(rng, c0[0], c0[1], s * 0.42, s * 0.42, a, s * 0.008), out = [plinth];
    const fallen = (c, hl, hw, t) => { const q = at(t, c[0], c[1]), drum = blockAt(rng, c[0], c[1], hl, hw, t, s * 0.01); out.push(drum); under(g, drum, o, 0.4); stonePoly(g, rng, o, drum, true, STONE, 0.55); for (let k = -3; k <= 3; k++) cutLine(g, o, [q(-hl * 0.96, k * hw * 0.26), q(hl * 0.8, k * hw * 0.26)], 0.5); const end = oval(...q(hl * 0.86, 0), hl * 0.16, hw * 0.96, t, 16); stonePoly(g, rng, o, end, false, '#a29e96', 0.52); };
    if (o.detail) { const dr = seeded(905); for (let i = 0; i < 9; i++) { const c = p((dr() - 0.5) * s * 1.6, (dr() - 0.5) * s * 1.6); stoneLump(g, dr, o, c[0], c[1], s * (0.04 + dr() * 0.04), s * 0.04, dr() * 6, STONE, 0.1); } }
    fallen(p(s * 0.42, s * 0.36), R * 0.6, R * 0.86, a + 0.7); fallen(p(s * 0.34, -s * 0.5), R * 0.42, R * 0.8, a - 0.4);
    under(g, plinth, o, 0.4); stonePoly(g, rng, o, plinth, true, '#7e7a72', 0.2);
    const drum = circle(c0[0], c0[1], R, 32).map(([x, y], i) => { const k = 1 - (i % 2) * 0.05; return [c0[0] + (x - c0[0]) * k, c0[1] + (y - c0[1]) * k]; }); under(g, drum, o, 0.45); stonePoly(g, rng, o, drum, true, STONE, 0.7); out.push(drum);
    ring(g, c0[0], c0[1], R * 0.84, 'rgba(20,18,16,0.5)', Math.max(0.6, o.ink * 0.7));
    const brk = blob(rng, c0[0], c0[1], R * 0.74, R * 0.62, 12, 0.3); stonePoly(g, rng, o, brk, true, '#6e6a64', 0.56); for (let i = 0; i < 12; i += 3) { pathOf(g, [brk[i], brk[(i + 1) % 12], c0], true); g.fillStyle = 'rgba(255,250,240,0.14)'; g.fill(); }
    return out;
  },
  chains(g, s, rng, o, pal) {
    // A chain lying loose from a ring bolted to the floor, a shackle open at its end.
    const a = rng() * 6.28, p = at(a), iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.4)) }, pts = Array.from({ length: 17 }, (_, k) => { const t = k / 16; return p(-s * 0.56 + t * s * 1.05, -s * 0.34 + Math.sin(t * 5.2) * s * 0.24 + t * s * 0.56); });
    const pc = pts[0]; plate(g, o, boxAt(pc[0], pc[1], s * 0.13, s * 0.13, a), iron, 0.05); for (const [u, v] of C4) stud(g, o, pc[0] + u * s * 0.09, pc[1] + v * s * 0.09, Math.max(0.8, s * 0.016), iron, 0.07);
    const ringAt = (c, r, w, h) => { ring(g, c[0], c[1], r, 'rgba(8,6,6,0.9)', w * 1.7); ring(g, c[0], c[1], r, iron.metal, w); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], r, 0, 6.283); o.maps.strokeStyle = mapsColour(h, 0.85); o.maps.lineWidth = w * 1.4; o.maps.stroke(); } };
    ringAt(pc, s * 0.07, Math.max(1.2, s * 0.03), 0.08);
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], t = Math.atan2(B[1] - A[1], B[0] - A[0]), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (i % 2) { const l = [[m[0] - Math.cos(t) * len * 0.6, m[1] - Math.sin(t) * len * 0.6], [m[0] + Math.cos(t) * len * 0.6, m[1] + Math.sin(t) * len * 0.6]]; line(g, l, 'rgba(8,6,6,0.9)', Math.max(2, s * 0.045)); line(g, l, iron.metal, Math.max(1.1, s * 0.026)); relLine(o, l, Math.max(1.6, s * 0.036), 0.06, 0.85); }
      else { const link = oval(m[0], m[1], len * 0.72, len * 0.4, t, 14); link.push(link[0]); line(g, link, 'rgba(8,6,6,0.9)', Math.max(1.8, s * 0.04)); line(g, link, iron.metal, Math.max(1, s * 0.022)); relLine(o, link, Math.max(1.4, s * 0.03), 0.05, 0.85); }
    }
    { const e = pts[pts.length - 1], t0 = a + 0.4, cuff = Array.from({ length: 13 }, (_, k) => { const t = t0 + (k / 12) * 5.2; return [e[0] + Math.cos(a) * s * 0.12 + Math.cos(t) * s * 0.12, e[1] + Math.sin(a) * s * 0.12 + Math.sin(t) * s * 0.12]; }); line(g, cuff, 'rgba(8,6,6,0.9)', Math.max(2.6, s * 0.07)); line(g, cuff, iron.metal, Math.max(1.6, s * 0.045)); relLine(o, cuff, Math.max(2, s * 0.055), 0.07, 0.85); stud(g, o, ...cuff[0], Math.max(1, s * 0.03), iron, 0.09); }
    return pts.map((c) => circle(c[0], c[1], s * 0.04, 6));
  },
  rowboat(g, s, rng, o, pal) {
    // A rowing boat from over it: a pointed bow, a square stern, ribs and floorboards inside, three thwarts across.
    const a = (rng() - 0.5) * 0.2, p = at(a), L = s * 0.9, W = s * 0.3, wid = (t, k = 1) => W * k * (t > 0 ? 1 - Math.pow(t, 2.2) * 0.96 : 0.8 + 0.2 * (1 + t)), hullOf = (k, kl) => [...Array.from({ length: 15 }, (_, i) => { const t = -1 + i / 7; return p(t * L * kl, -wid(t, k)); }), ...Array.from({ length: 15 }, (_, i) => { const t = 1 - i / 7; return p(t * L * kl, wid(t, k)); })], hull = hullOf(1, 1), well = hullOf(0.8, 0.93), rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    under(g, hull, o, 0.4); pathOf(g, hull, true); g.fillStyle = shade(pal.wood, -0.1); g.fill();
    g.save(); pathOf(g, hull, true); g.clip(); if (o.fine) fineWork(g, seeded(906), p, L, W, {}); g.restore(); rel(o, hull, true, 0.5, 0.08);
    pathOf(g, well, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.7); g.fill(); rel(o, well, true, 0.18, 0.05);
    g.save(); pathOf(g, well, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, well, true); o.maps.clip(); }
    for (let k = -2; k <= 2; k++) plank(g, rng, o, ...p(-L * 0.06, k * W * 0.3), L * 0.96, W * 0.15, a, shade(pal.wood, -0.04), 0.2);
    for (let i = -3; i <= 3; i++) { const u = i * L * 0.23; line(g, [p(u, -W), p(u, W)], 'rgba(16,7,0,0.85)', Math.max(1.6, s * 0.03), 'butt'); line(g, [p(u, -W), p(u, W)], shade(pal.wood, -0.2), Math.max(0.9, s * 0.018), 'butt'); relLine(o, [p(u, -W), p(u, W)], Math.max(1.4, s * 0.026), 0.26, 0.08); }
    { const gr = g.createRadialGradient(0, 0, W * 0.4, 0, 0, L); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    if (o.detail) { const c = p(L * 0.62, 0); for (const k of [1, 0.64, 0.32]) { ring(g, c[0], c[1], W * 0.34 * k, 'rgba(20,10,2,0.85)', Math.max(1.4, W * 0.11)); ring(g, c[0], c[1], W * 0.34 * k, rope, Math.max(0.9, W * 0.07)); } if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], W * 0.4, 0, 6.283); o.maps.fillStyle = mapsColour(0.3, 0.05); o.maps.fill(); } }
    g.restore(); o.maps?.restore();
    for (const u of [-0.62, -0.1, 0.4]) { const hw = wid(u, 0.86); under(g, boxAt(...p(u * L, 0), L * 0.05, hw, a), o, 0.35); plank(g, rng, o, ...p(u * L, 0), hw, L * 0.05, a + Math.PI / 2, pal.wood, 0.42); }
    if (o.detail) {
      // The oars shipped along the thwarts, blades toward the bow.
      for (const v of [-0.42, 0.42]) { const shaft = [p(-L * 0.7, v * W), p(L * 0.2, v * W * 0.9)]; line(g, shaft, 'rgba(16,7,0,0.85)', Math.max(1.6, s * 0.028)); line(g, shaft, shade(pal.wood, 0.12), Math.max(0.9, s * 0.016)); relLine(o, shaft, Math.max(1.4, s * 0.024), 0.46, 0.1); const blade = [p(L * 0.2, v * W * 0.9 - W * 0.07), p(L * 0.5, v * W * 0.82 - W * 0.1), p(L * 0.54, v * W * 0.82), p(L * 0.5, v * W * 0.82 + W * 0.1), p(L * 0.2, v * W * 0.9 + W * 0.07)]; pathOf(g, blade, true); g.fillStyle = shade(pal.wood, 0.12); g.fill(); thinLine(g, blade, true, pal.wood, o, 0.9); rel(o, blade, true, 0.46, 0.1); }
      for (const v of [-1, 1]) stud(g, o, ...p(-L * 0.1, v * wid(-0.1, 0.92)), Math.max(1, s * 0.018), pal, 0.56);
    }
    thinLine(g, well, true, pal.wood, o, 0.9); thinLine(g, hull, true, pal.wood, o, 1.2);
    return [hull];
  },
  dock(g, s, rng, o, pal) {
    // A length of jetty, laid dead along its run: boards across it on two stringers, a pile at each corner.
    const L = s * 0.9, W = s * 0.42, deck = boxAt(0, 0, L, W, 0), n = 10, bw = L / n, rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    for (const v of [-0.7, 0.7]) plank(g, rng, o, 0, v * W, L, W * 0.07, 0, shade(pal.wood, -0.3), 0.14);
    under(g, deck, o, 0.3); pathOf(g, deck, true); g.fillStyle = '#17110b'; g.fill();
    for (let i = 0; i < n; i++) plank(g, rng, o, -L + (i + 0.5) * bw * 2, (rng() - 0.5) * W * 0.03, W * (0.97 + rng() * 0.05), bw * 0.9, Math.PI / 2, i % 3 === 1 ? shade(pal.wood, -0.1) : pal.wood, 0.28);
    for (let i = 0; i < n; i++) for (const v of [-0.7, 0.7]) stud(g, o, -L + (i + 0.5) * bw * 2, v * W, Math.max(0.7, s * 0.008), pal, 0.3);
    if (o.detail) { plate(g, o, boxAt(L * 0.2, W * 0.72, s * 0.07, s * 0.02, 0), pal, 0.34); for (const e of [-1, 1]) stud(g, o, L * 0.2 + e * s * 0.07, W * 0.72, Math.max(1, s * 0.016), pal, 0.38); const tail = [[L * 0.2, W * 0.72], [L * 0.05, W * 0.5], [-L * 0.2, W * 0.56], [-L * 0.3, W * 0.3]]; line(g, tail, 'rgba(30,16,2,0.85)', Math.max(1.4, s * 0.026)); line(g, tail, rope, Math.max(0.8, s * 0.014)); }
    for (const [u, v] of C4) { const c = [u * L * 0.97, v * W * 0.95]; under(g, circle(c[0], c[1], s * 0.07), o, 0.35); stumpTop(g, rng, o, c[0], c[1], s * 0.07, rng() * 6, pal, 0.5); }
    return [deck];
  },
  mooringPost(g, s, rng, o, pal) {
    // A pile to tie up to: its weathered top, rope made fast round it, the fall of the rope lying off.
    const a = rng() * 6.28, p = at(a), R = s * 0.34, post = circle(0, 0, R, 24), rope = hexOf(mix(pal.wood, '#c9a868', 0.6));
    if (o.detail) { const tail = Array.from({ length: 12 }, (_, k) => { const t = k / 11; return p(R * (1 + t * 1.5), Math.sin(t * 5) * R * 0.5 + t * R * 0.6); }); line(g, tail, 'rgba(30,16,2,0.85)', Math.max(1.8, s * 0.06)); line(g, tail, rope, Math.max(1, s * 0.036)); relLine(o, tail, Math.max(1.6, s * 0.05), 0.06, 0.05); }
    under(g, post, o, 0.4);
    for (const k of [1.42, 1.22]) { ring(g, 0, 0, R * k, 'rgba(30,16,2,0.85)', Math.max(1.8, R * 0.24)); ring(g, 0, 0, R * k, rope, Math.max(1.1, R * 0.16)); for (let i = 0; i < 16; i++) { const t = (i / 16) * 6.283; line(g, [[Math.cos(t) * R * (k - 0.08), Math.sin(t) * R * (k - 0.08)], [Math.cos(t + 0.12) * R * (k + 0.08), Math.sin(t + 0.12) * R * (k + 0.08)]], 'rgba(30,16,2,0.5)', Math.max(0.5, o.ink * 0.5)); } }
    relRing(o, R * 1.32, R * 0.42, 0.5, 0.05);
    stumpTop(g, rng, o, 0, 0, R, a, pal, 0.9);
    if (o.detail) { ring(g, 0, 0, R * 0.96, 'rgba(8,6,6,0.9)', Math.max(1.4, R * 0.12)); ring(g, 0, 0, R * 0.96, pal.metal, Math.max(0.8, R * 0.07)); for (let i = 0; i < 4; i++) stud(g, o, Math.cos(a + i * 1.57) * R * 0.96, Math.sin(a + i * 1.57) * R * 0.96, Math.max(0.8, s * 0.016), pal, 0.94); }
    return [circle(0, 0, R * 1.42, 20)];
  },
  tableStools(g, s, rng, o, pal) {
    // A square table and the four stools round it, with a meal left on it.
    const a = (rng() - 0.5) * 0.3, p = at(a), H = s * 0.44, top = boxAt(0, 0, H, H, a), out = [top];
    for (let i = 0; i < 4; i++) { const t = a + i * 1.571 + (rng() - 0.5) * 0.3, d = s * (0.72 + (rng() - 0.5) * 0.08), c = [Math.cos(t) * d, Math.sin(t) * d], r = s * 0.16, seat = circle(c[0], c[1], r, 20); out.push(seat); under(g, seat, o, 0.35); roundBoards(g, rng, o, c[0], c[1], r, t + 0.6, pal.wood, 0.35, 3); ring(g, c[0], c[1], r * 0.8, 'rgba(16,7,0,0.4)', Math.max(0.5, o.ink * 0.6)); thinLine(g, seat, false, pal.wood, o, 1.1); }
    for (const [u, v] of C4) post(g, o, p(u * H * 0.94, v * H * 0.94), H * 0.12, pal, 0.5);
    under(g, top, o, 0.4); pathOf(g, top, true); g.fillStyle = mix(pal.wood, '#0c0904', 0.6); g.fill();
    for (let k = -1; k <= 1; k++) plank(g, rng, o, ...p(0, k * H * 0.667), H, H * 0.333, a, pal.wood, 0.6);
    mugRings(g, rng, o, p, H * 0.7, H * 0.7, top, true);
    if (o.detail) {
      // Two plates, two mugs, a loaf, a candle.
      for (const [u, v] of [[-0.45, -0.4], [0.4, 0.45]]) { const c = p(u * H, v * H), r = H * 0.24; under(g, circle(c[0], c[1], r), o, 0.25); plate(g, o, circle(c[0], c[1], r, 18), pal, 0.64); ring(g, c[0], c[1], r * 0.7, 'rgba(8,6,6,0.4)', Math.max(0.5, o.ink * 0.6)); for (let i = 0; i < 3; i++) disc(g, c[0] + (i - 1) * r * 0.25, c[1] + (i % 2) * r * 0.2, r * 0.18, ['#8a4a2a', '#b8843c', '#5d7a3a'][i]); }
      for (const [u, v] of [[0.5, -0.5], [-0.55, 0.3]]) { const c = p(u * H, v * H), r = H * 0.13; under(g, circle(c[0], c[1], r), o, 0.25); disc(g, c[0], c[1], r, pal.wood); ring(g, c[0], c[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.7, o.ink * 0.8)); disc(g, c[0], c[1], r * 0.68, '#5a3a14'); ring(g, c[0], c[1], r * 0.68, 'rgba(16,7,0,0.8)', Math.max(0.5, o.ink * 0.5)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.66, 0.72, 0.15); }
      { const c = p(-H * 0.05, -H * 0.1), loaf = oval(c[0], c[1], H * 0.14, H * 0.24, a + 0.5, 14), q = at(a + 0.5, c[0], c[1]); under(g, loaf, o, 0.25); pathOf(g, loaf, false); g.fillStyle = '#b8843c'; g.fill(); for (const v of [-0.4, 0, 0.4]) line(g, [q(-H * 0.08, v * H * 0.24), q(H * 0.08, v * H * 0.24 + H * 0.03)], 'rgba(60,30,6,0.6)', Math.max(0.6, o.ink * 0.7)); thinLine(g, loaf, false, '#b8843c', o, 0.9); relDome(o, loaf, c[0], c[1], H * 0.24, 0.64, 0.72, 0.1); }
      { const c = p(H * 0.1, H * 0.5), r = H * 0.09; disc(g, c[0], c[1], r * 1.5, pal.metal); ring(g, c[0], c[1], r * 1.5, mix(pal.metal, '#0c0904', 0.9), Math.max(0.6, o.ink * 0.8)); disc(g, c[0], c[1], r, '#e6dcc0'); disc(g, c[0], c[1], r * 0.22, '#1a1208'); relDome(o, circle(c[0], c[1], r * 1.5), c[0], c[1], r * 1.5, 0.62, 0.72, 0.5); }
    }
    worn(g, rng, o, top, a, H, pal.wear); thinLine(g, top, true, pal.wood, o, 1.2);
    return out;
  },
  pottedPlant(g, s, rng, o, pal) {
    // A plant in an earthen pot on its saucer, its leaves grown out past the rim.
    const a = rng() * 6.28, R = s * 0.5, pot = circle(0, 0, R, 28), clay = varied('#a8643c', rng, 1.4);
    { const sau = circle(0, 0, R * 1.18, 28); under(g, sau, o, 0.3); pathOf(g, sau, false); g.fillStyle = hexOf(shade(clay, -0.16)); g.fill(); thinLine(g, sau, false, clay, o, 0.9); rel(o, sau, false, 0.08, 0.2); }
    under(g, pot, o, 0.35); pathOf(g, pot, false); g.fillStyle = clay; g.fill();
    g.save(); pathOf(g, pot, false); g.clip(); if (o.fine) fineWork(g, seeded(907), at(0), R, R, { along: false, dark: '40,16,4', pale: '255,230,200', much: 0.8 }); g.restore();
    relRing(o, R * 0.88, R * 0.24, 0.6, 0.25);
    disc(g, 0, 0, R * 0.76, '#2a1f16'); ring(g, 0, 0, R * 0.76, 'rgba(20,8,0,0.8)', Math.max(0.6, o.ink * 0.8)); if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, R * 0.76, 0, 6.283); o.maps.fillStyle = mapsColour(0.45, 0.03); o.maps.fill(); }
    thinLine(g, pot, false, clay, o, 1.1);
    for (let i = 0; i < 9; i++) leaf(g, o, [0, 0], a + (i / 9) * 6.283 + (rng() - 0.5) * 0.3, R * (1.25 + rng() * 0.4), R * (0.24 + rng() * 0.08), varied(hexOf(shade(o.green, -0.12)), rng, 1.6));
    for (let i = 0; i < 7; i++) leaf(g, o, [0, 0], a + 0.35 + (i / 7) * 6.283 + (rng() - 0.5) * 0.3, R * (0.8 + rng() * 0.25), R * (0.2 + rng() * 0.06), varied(o.green, rng, 1.6));
    disc(g, 0, 0, R * 0.1, hexOf(shade(o.green, -0.45))); relDome(o, circle(0, 0, R * 1.5, 20), 0, 0, R * 1.5, 0.5, 0.9, 0.1);
    if (o.detail) { const dr = seeded(908); for (let i = 0; i < 5; i++) { const t = dr() * 6.283, d = R * (0.4 + dr() * 0.7); flower(g, dr, o, Math.cos(t) * d, Math.sin(t) * d, s * 0.07, varied(pal.cloth, dr, 1.2)); } }
    return [circle(0, 0, R * 1.2, 20)];
  },
  produce(g, s, rng, o, pal) {
    // A slatted crate filled to its top with what was picked.
    const a = (rng() - 0.5) * 0.4, p = at(a), H = s * 0.66, box = boxAt(0, 0, H, H, a), kinds = [['#b0382c', 0.13], ['#6a8a3a', 0.2], ['#c9a23a', 0.12], ['#8a4a8a', 0.11]], [dye, r0] = kinds[Math.floor(rng() * kinds.length)];
    if (o.detail) { const dr = seeded(909); for (let i = 0; i < 4; i++) { const c = p((dr() < 0.5 ? -1 : 1) * H * (1.15 + dr() * 0.25), (dr() - 0.5) * H * 1.6), r = H * r0, col = varied(dye, dr, 1.4); under(g, circle(c[0], c[1], r), o, 0.25); roundBody(g, o, c, r, col); ring(g, c[0], c[1], r, mix(col, '#0c0904', 0.78), Math.max(0.6, o.ink * 0.7)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.08, 0.2, 0.2); } }
    under(g, box, o, 0.4); pathOf(g, box, true); g.fillStyle = '#1c140c'; g.fill(); rel(o, box, true, 0.3, 0.03);
    g.save(); pathOf(g, box, true); g.clip();
    for (let i = 0; i < Math.round(26 * (0.13 / r0)); i++) { const c = p((rng() - 0.5) * H * 1.7, (rng() - 0.5) * H * 1.7), r = H * r0 * (0.85 + rng() * 0.3), col = varied(dye, rng, 1.6); roundBody(g, o, c, r, col); disc(g, c[0] + r * 0.15, c[1] - r * 0.1, r * 0.1, '#2a1a0a'); ring(g, c[0], c[1], r, mix(col, '#0c0904', 0.78), Math.max(0.6, o.ink * 0.7)); relDome(o, circle(c[0], c[1], r), c[0], c[1], r, 0.36, 0.5, 0.2); }
    g.restore();
    for (const v of [-1, 1]) plank(g, rng, o, ...p(0, v * H * 0.9), H, H * 0.1, a, pal.wood, 0.56);
    for (const u of [-1, 1]) plank(g, rng, o, ...p(u * H * 0.9, 0), H * 0.8, H * 0.1, a + Math.PI / 2, pal.wood, 0.56);
    for (const [u, v] of C4) stud(g, o, ...p(u * H * 0.9, v * H * 0.9), Math.max(0.9, s * 0.02), pal, 0.6);
    thinLine(g, box, true, pal.wood, o, 1.2);
    return [box];
  },
  papers(g, s, rng, o, pal) {
    // Papers let fall: sheets lying any way over each other, written on, one sealed, one rolled.
    const a = rng() * 6.28, out = [];
    if (o.detail) { g.save(); g.filter = `blur(${Math.max(0.8, s * 0.01)}px)`; g.fillStyle = 'rgba(14,12,20,0.75)'; const c = [Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5]; g.beginPath(); g.ellipse(c[0], c[1], s * 0.14, s * 0.1, a, 0, 6.283); g.fill(); g.restore(); }
    for (let i = 0; i < 8; i++) {
      const t = a + rng() * 6.28, d = Math.sqrt(rng()) * s * 0.52, c = [Math.cos(t) * d, Math.sin(t) * d], k = rng() * 6.28, w = s * (0.16 + rng() * 0.05), h = w * 1.36, q = at(k, c[0], c[1]), sheet = [q(-w, -h), q(w, -h), q(w * (0.96 + rng() * 0.06), h), q(-w, h * (0.96 + rng() * 0.06))], paper = varied('#e2d6b8', rng, 1.2); out.push(sheet);
      under(g, sheet, o, 0.2); pathOf(g, sheet, true); g.fillStyle = paper; g.fill(); if (o.clothMask) { pathOf(o.clothMask, sheet, true); o.clothMask.fillStyle = '#fff'; o.clothMask.fill(); }
      g.save(); pathOf(g, sheet, true); g.clip(); for (let r = -5; r <= 5; r++) { if (rng() < 0.15) continue; line(g, [q(-w * 0.78, r * h * 0.15), q(w * (0.2 + rng() * 0.55), r * h * 0.15)], 'rgba(40,28,16,0.55)', Math.max(0.5, o.ink * 0.45)); } if (o.fine) fineWork(g, seeded(910 + i), q, w, h, { along: false, dark: '90,70,40', pale: '255,250,235', much: 0.5 }); g.restore();
      if (o.detail && i === 6) { const sl = q(w * 0.5, h * 0.66); disc(g, sl[0], sl[1], w * 0.2, '#8a1c18'); ring(g, sl[0], sl[1], w * 0.2, 'rgba(40,6,4,0.8)', Math.max(0.5, o.ink * 0.6)); ring(g, sl[0], sl[1], w * 0.1, 'rgba(40,6,4,0.5)', Math.max(0.4, o.ink * 0.4)); }
      thinLine(g, sheet, true, paper, o, 0.8); rel(o, sheet, true, 0.02 + i * 0.004, 0.05);
    }
    { const c = [Math.cos(a + 2.5) * s * 0.5, Math.sin(a + 2.5) * s * 0.5], roll = boxAt(c[0], c[1], s * 0.24, s * 0.05, a + 0.7), q = at(a + 0.7, c[0], c[1]); out.push(roll); under(g, roll, o, 0.25); pathOf(g, roll, true); g.fillStyle = '#d8ccae'; g.fill(); for (const e of [-1, 1]) { const end = oval(...q(e * s * 0.24, 0), s * 0.016, s * 0.05, a + 0.7, 10); pathOf(g, end, false); g.fillStyle = '#b8ac8e'; g.fill(); thinLine(g, end, false, '#d8ccae', o, 0.7); } line(g, [q(-s * 0.03, -s * 0.05), q(-s * 0.03, s * 0.05)], '#8a1c18', Math.max(1, s * 0.02), 'butt'); thinLine(g, roll, true, '#d8ccae', o, 0.8); rel(o, roll, true, 0.06, 0.05); }
    return out;
  },
  rubbish(g, s, rng, o, pal) {
    // A heap of what was thrown out: broken boards, rags, shards of pot, a bone or two, an iron hoop.
    const a = rng() * 6.28, p = at(a), heap = blob(rng, 0, 0, s * 0.8, s * 0.62, 22, 0.24, a);
    under(g, heap, o, 0.22); pathOf(g, heap, false); g.fillStyle = '#54483a'; g.fill();
    g.save(); pathOf(g, heap, false); g.clip(); { const gr = g.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 0.85); gr.addColorStop(0, 'rgba(20,14,8,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); } g.restore();
    g.save(); pathOf(g, heap, false); g.clip(); for (let i = 0; i < 160; i++) { const c = p((rng() - 0.5) * s * 1.6, (rng() - 0.5) * s * 1.3); disc(g, c[0], c[1], Math.max(0.5, s * (0.006 + rng() * 0.014)), rng() < 0.5 ? 'rgba(96,80,60,0.7)' : 'rgba(10,8,6,0.7)'); } g.restore();
    thinLine(g, heap, false, '#54483a', o, 0.7); relDome(o, heap, 0, 0, s * 0.8, 0.04, 0.24, 0.04);
    for (let i = 0; i < 6; i++) { const c = p((rng() - 0.5) * s * 1.1, (rng() - 0.5) * s * 0.8), t = rng() * 6.28, hl = s * (0.14 + rng() * 0.14); under(g, boxAt(c[0], c[1], hl, s * 0.045, t), o, 0.3); plank(g, rng, o, c[0], c[1], hl, s * 0.045, t, rng() < 0.5 ? shade(pal.wood, -0.2) : pal.wood, 0.2 + rng() * 0.1); }
    for (let i = 0; i < 3; i++) { const c = p((rng() - 0.5) * s * 0.9, (rng() - 0.5) * s * 0.7), rag = blob(rng, c[0], c[1], s * (0.14 + rng() * 0.08), s * 0.1, 10, 0.25); under(g, rag, o, 0.25); clothFlat(g, o, rag, false, hexOf(mix(i ? pal.cloth : '#8a7a5a', '#6a5a4a', 0.55)), 0.26); }
    for (let i = 0; i < 6; i++) { const c = p((rng() - 0.5) * s * 1.1, (rng() - 0.5) * s * 0.85), t0 = rng() * 6.28, r = s * (0.06 + rng() * 0.05), clay = varied('#a8643c', rng, 1.5), shard = Array.from({ length: 6 }, (_, k) => { const t = t0 + (k / 5) * 1.3; return [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]; }).concat(Array.from({ length: 4 }, (_, k) => { const t = t0 + 1.3 - (k / 3) * 1.3; return [c[0] + Math.cos(t) * r * 0.6, c[1] + Math.sin(t) * r * 0.6]; })); under(g, shard, o, 0.25); pathOf(g, shard, true); g.fillStyle = clay; g.fill(); thinLine(g, shard, true, clay, o, 0.8); rel(o, shard, true, 0.24, 0.2); }
    if (o.detail) {
      for (const [u, v, t] of [[0.3, -0.3, 0.6], [-0.4, 0.3, 2.2]]) bone(g, o, p(u * s, v * s), p(u * s + Math.cos(a + t) * s * 0.22, v * s + Math.sin(a + t) * s * 0.22), s * 0.03, 0.26);
      const c = p(-s * 0.2, -s * 0.3); ring(g, c[0], c[1], s * 0.15, 'rgba(8,6,6,0.9)', Math.max(1.8, s * 0.05)); ring(g, c[0], c[1], s * 0.15, hexOf(mix(pal.metal, '#7c4a2a', 0.5)), Math.max(1, s * 0.03)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], s * 0.15, 0, 6.283); o.maps.strokeStyle = mapsColour(0.3, 0.5); o.maps.lineWidth = Math.max(1.4, s * 0.04); o.maps.stroke(); }
    }
    return [heap];
  },
  brokenFurniture(g, s, rng, o, pal) {
    // A table smashed: its top in two ragged halves, its legs lying where they were kicked, splinters between.
    const a = rng() * 6.28, p = at(a), out = [];
    { const sr = seeded(911); for (let i = 0; i < 26; i++) { const c = p((sr() - 0.5) * s * 1.7, (sr() - 0.5) * s * 1.5), k = sr() * 3.14, len = s * (0.03 + sr() * 0.07); line(g, [c, [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]], 'rgba(214,186,132,0.85)', Math.max(0.8, s * 0.011)); } }
    const half = (c, t, e) => { const q = at(t, c[0], c[1]), HL = s * 0.36, HW = s * 0.34, n = 8, edge = Array.from({ length: n }, (_, k) => q(e * HL * (0.86 + rng() * 0.3 - 0.15), (-1 + (2 * k) / (n - 1)) * HW)), shape = [q(-e * HL, -HW), ...edge, q(-e * HL, HW)]; out.push(shape); under(g, shape, o, 0.38); g.save(); pathOf(g, shape, true); g.clip(); if (o.maps) { o.maps.save(); pathOf(o.maps, shape, true); o.maps.clip(); } for (let k = -1; k <= 1; k++) plank(g, rng, o, ...q(0, k * HW * 0.667), HL * 1.3, HW * 0.333, t, pal.wood, 0.3); g.restore(); o.maps?.restore(); thinLine(g, shape, true, pal.wood, o, 1.1); };
    half(p(-s * 0.36, -s * 0.1), a + 0.15, 1); half(p(s * 0.36, s * 0.14), a - 0.3, -1);
    for (const [u, v, t] of [[-0.1, 0.62, 0.3], [0.5, -0.55, 1.4], [-0.62, 0.5, 2.3], [0.1, -0.7, 0.1]]) { const c = p(u * s, v * s), leg = boxAt(c[0], c[1], s * 0.22, s * 0.035, a + t); out.push(leg); under(g, leg, o, 0.3); pathOf(g, leg, true); g.fillStyle = pal.woodDark; g.fill(); const q = at(a + t, c[0], c[1]); for (const k of [-0.5, 0.2, 0.7]) line(g, [q(k * s * 0.22, -s * 0.035), q(k * s * 0.22, s * 0.035)], 'rgba(8,4,0,0.5)', Math.max(0.5, o.ink * 0.6), 'butt'); thinLine(g, leg, true, pal.wood, o, 0.9); rel(o, leg, true, 0.12, 0.2); }
    if (o.detail) { const c = p(s * 0.05, s * 0.02), rag = blob(seeded(912), c[0], c[1], s * 0.2, s * 0.13, 10, 0.25, a); under(g, rag, o, 0.25); clothFlat(g, o, rag, false, pal.cloth, 0.14, [[p(-s * 0.1, 0), p(s * 0.2, s * 0.05)]]); const m = p(s * 0.3, -s * 0.2), r = s * 0.07; under(g, circle(m[0], m[1], r), o, 0.25); disc(g, m[0], m[1], r, pal.wood); disc(g, m[0], m[1], r * 0.68, '#1c140c'); ring(g, m[0], m[1], r, mix(pal.wood, '#0c0904', 0.92), Math.max(0.6, o.ink * 0.8)); }
    return out;
  },
  carcass(g, s, rng, o, pal) {
    // What is left of a beast: its spine and ribs, hip and skull, the long bones of its legs, dark where it lay.
    const a = rng() * 6.28, p = at(a), BONE = '#ded2b6', spine = Array.from({ length: 13 }, (_, k) => { const t = -1 + k / 6; return p(t * s * 0.5, Math.sin(t * 1.4) * s * 0.07); }), out = [oval(0, 0, s * 0.62, s * 0.34, a, 20)];
    g.save(); g.filter = `blur(${Math.max(1, s * 0.04)}px)`; g.fillStyle = 'rgba(40,14,8,0.5)'; g.beginPath(); g.ellipse(0, 0, s * 0.72, s * 0.42, a, 0, 6.283); g.fill(); g.restore();
    if (o.detail) { const dr = seeded(913); g.save(); g.filter = `blur(${Math.max(0.8, s * 0.012)}px)`; for (let i = 0; i < 5; i++) { const c = p((dr() - 0.5) * s * 0.9, (dr() - 0.5) * s * 0.4); g.fillStyle = 'rgba(86,44,30,0.7)'; g.beginPath(); g.ellipse(c[0], c[1], s * (0.08 + dr() * 0.1), s * (0.05 + dr() * 0.06), dr() * 3, 0, 6.283); g.fill(); } g.restore(); }
    for (const [u, v, t, len] of [[-0.42, -0.2, -2.2, 0.34], [-0.42, 0.2, 2.3, 0.36], [0.3, -0.18, -1.2, 0.34], [0.3, 0.2, 1.0, 0.32]]) { const A = p(u * s, v * s), B = [A[0] + Math.cos(a + t) * s * len, A[1] + Math.sin(a + t) * s * len]; bone(g, o, A, B, s * 0.026, 0.1); bone(g, o, B, [B[0] + Math.cos(a + t + 0.9) * s * len * 0.7, B[1] + Math.sin(a + t + 0.9) * s * len * 0.7], s * 0.02, 0.08); }
    for (let i = 3; i <= 9; i++) for (const e of [-1, 1]) { const c = spine[i], k = Math.sin(((i - 3) / 6) * Math.PI), rib = Array.from({ length: 7 }, (_, j) => { const t = j / 6; return [c[0] + Math.cos(a) * (t * t) * s * 0.05 * -1 - Math.sin(a) * e * t * s * (0.14 + k * 0.14), c[1] - Math.sin(a) * (t * t) * s * 0.05 + Math.cos(a) * e * t * s * (0.14 + k * 0.14)]; }); line(g, rib, 'rgba(50,36,20,0.9)', Math.max(1.6, s * 0.03)); line(g, rib, BONE, Math.max(0.9, s * 0.017)); relLine(o, rib, Math.max(1.4, s * 0.026), 0.24, 0.1); }
    line(g, spine, 'rgba(50,36,20,0.9)', Math.max(2.2, s * 0.05)); line(g, spine, BONE, Math.max(1.4, s * 0.032)); relLine(o, spine, Math.max(2, s * 0.045), 0.3, 0.1);
    for (const c of spine) { disc(g, c[0], c[1], Math.max(0.9, s * 0.022), BONE); ring(g, c[0], c[1], Math.max(0.9, s * 0.022), 'rgba(50,36,20,0.7)', Math.max(0.4, o.ink * 0.4)); }
    { const c = p(-s * 0.56, 0), hip = oval(c[0], c[1], s * 0.1, s * 0.17, a, 14); pathOf(g, hip, false); g.fillStyle = BONE; g.fill(); for (const e of [-1, 1]) { const h = p(-s * 0.56, e * s * 0.08); disc(g, h[0], h[1], s * 0.03, '#2a1c12'); } thinLine(g, hip, false, '#8a7a5a', o, 0.9); rel(o, hip, false, 0.24, 0.1); }
    { const c = p(s * 0.66, s * 0.08), q = at(a + 0.2, c[0], c[1]), skull = [q(-s * 0.13, -s * 0.09), q(s * 0.02, -s * 0.1), q(s * 0.17, -s * 0.045), q(s * 0.2, 0), q(s * 0.17, s * 0.045), q(s * 0.02, s * 0.1), q(-s * 0.13, s * 0.09)]; under(g, skull, o, 0.3); pathOf(g, skull, false); g.fillStyle = BONE; g.fill(); for (const e of [-1, 1]) { const eye = q(-s * 0.02, e * s * 0.05); disc(g, eye[0], eye[1], s * 0.028, '#2a1c12'); const horn = [q(-s * 0.1, e * s * 0.08), q(-s * 0.18, e * s * 0.16), q(-s * 0.14, e * s * 0.26)]; line(g, horn, 'rgba(50,36,20,0.9)', Math.max(1.6, s * 0.035)); line(g, horn, '#c8bc9c', Math.max(0.9, s * 0.02)); } line(g, [q(s * 0.1, 0), q(s * 0.18, 0)], 'rgba(50,36,20,0.6)', Math.max(0.5, o.ink * 0.6)); thinLine(g, skull, false, '#8a7a5a', o, 1); relDome(o, skull, c[0], c[1], s * 0.2, 0.2, 0.34, 0.12); }
    return out;
  },
  rock(g, s, rng, o, pal) {
    // One rock, and a chip off it.
    const a = rng() * 6.28, out = [rockForm(g, rng, o, 0, 0, s * 0.78, s * 0.64, a, STONE, 0.8)];
    if (o.detail) { const dr = seeded(914), c = [Math.cos(a + 2) * s * 0.9, Math.sin(a + 2) * s * 0.9]; stoneLump(g, dr, o, c[0], c[1], s * 0.16, s * 0.12, a, STONE, 0.14); }
    return out;
  },
  boulder(g, s, rng, o, pal) {
    // A boulder: a great faceted rock, cracked, mossed where it holds the wet, smaller stones at its foot.
    const a = rng() * 6.28, out = [];
    if (o.detail) { const dr = seeded(915); for (let i = 0; i < 4; i++) { const t = a + i * 1.7, c = [Math.cos(t) * s * 0.82, Math.sin(t) * s * 0.74]; stoneLump(g, dr, o, c[0], c[1], s * (0.1 + dr() * 0.06), s * 0.08, t, STONE, 0.12); } }
    const body = rockForm(g, rng, o, 0, 0, s * 0.8, s * 0.68, a, '#84807a', 0.95, 13); out.push(body);
    if (o.detail) { g.save(); pathOf(g, body, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.022)}px)`; const dr = seeded(916); for (let i = 0; i < 9; i++) { const t = dr() * 6.283, d = s * (0.3 + dr() * 0.45); g.fillStyle = dr() < 0.7 ? 'rgba(82,108,48,0.55)' : 'rgba(196,196,180,0.4)'; g.beginPath(); g.ellipse(Math.cos(t) * d, Math.sin(t) * d * 0.85, s * (0.05 + dr() * 0.1), s * (0.04 + dr() * 0.06), dr() * 3, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore(); }
    return out;
  },
  pebbles(g, s, rng, o, pal) {
    // A scatter of water-worn pebbles.
    const out = [];
    for (let i = 0; i < 10; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.72, c = [Math.cos(t) * d, Math.sin(t) * d], rx = s * (0.1 + rng() * 0.1), ry = rx * (0.6 + rng() * 0.3), peb = oval(c[0], c[1], rx, ry, rng() * 3.14, 14), col = varied(['#8a867e', '#7a6e62', '#9a948a', '#6e726e'][Math.floor(rng() * 4)], rng, 1.4); out.push(peb);
      under(g, peb, o, 0.3); pathOf(g, peb, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, peb, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], rx * 0.2, c[0], c[1], rx * 1.05); gr.addColorStop(0, 'rgba(255,250,240,0.14)'); gr.addColorStop(1, 'rgba(10,8,6,0.45)'); g.fillStyle = gr; g.fillRect(c[0] - rx, c[1] - rx, rx * 2, rx * 2); if (o.fine) fineWork(g, seeded(917 + i), at(0, c[0], c[1]), rx, rx, { along: false, dark: '20,20,22', pale: '255,255,250', much: 0.8 }); g.restore(); thinLine(g, peb, false, col, o, 0.9); relDome(o, peb, c[0], c[1], rx, 0.03, 0.1, 0.2); }
    return out;
  },
  rubble(g, s, rng, o, pal) {
    // Fallen masonry: broken blocks tumbled on each other in their own dust.
    const a = rng() * 6.28, out = [];
    dustBed(g, rng, o, 0, 0, s * 0.82, s * 0.7);
    for (let i = 0; i < 10; i++) { const t = a + (i / 10) * 6.283 + rng() * 0.4, d = s * (i < 6 ? 0.42 + rng() * 0.2 : rng() * 0.22), c = [Math.cos(t) * d, Math.sin(t) * d], hw = s * (0.13 + rng() * 0.1), b = blockAt(rng, c[0], c[1], hw, hw * (0.6 + rng() * 0.35), rng() * 6.28, hw * 0.3); out.push(b); under(g, b, o, 0.38); stonePoly(g, rng, o, b, true, i % 3 ? STONE : '#7a7268', 0.2 + (i >= 6 ? 0.2 : 0) + rng() * 0.1); }
    return out;
  },
  bones(g, s, rng, o, pal) {
    // Old bones: a skull, two long bones, a few ribs.
    const a = rng() * 6.28, p = at(a), out = [];
    for (let i = 0; i < 3; i++) { const c = p(-s * 0.3 + i * s * 0.12, s * 0.35), rib = Array.from({ length: 7 }, (_, k) => { const t = k / 6; return [c[0] + Math.cos(a + 0.4) * t * s * 0.45 - Math.sin(a + 0.4) * Math.sin(t * Math.PI) * s * 0.14, c[1] + Math.sin(a + 0.4) * t * s * 0.45 + Math.cos(a + 0.4) * Math.sin(t * Math.PI) * s * 0.14]; }); line(g, rib, 'rgba(50,36,20,0.9)', Math.max(1.6, s * 0.05)); line(g, rib, '#ded2b6', Math.max(0.9, s * 0.03)); relLine(o, rib, Math.max(1.4, s * 0.04), 0.05, 0.1); }
    bone(g, o, p(-s * 0.7, -s * 0.2), p(s * 0.3, -s * 0.5), s * 0.045, 0.06); bone(g, o, p(-s * 0.2, -s * 0.72), p(s * 0.1, s * 0.1), s * 0.04, 0.08);
    out.push(skullAt(g, rng, o, p(s * 0.42, s * 0.2), s * 0.26, a + 0.6));
    return out;
  },
  boneRubble(g, s, rng, o, pal) {
    // A cave-in with someone under it: broken stone, and bones among the stones.
    const a = rng() * 6.28, p = at(a), out = [];
    dustBed(g, rng, o, 0, 0, s * 0.86, s * 0.66);
    const chunk = (i) => { const t = a + (i / 9) * 6.283 + rng() * 0.4, d = s * (0.3 + rng() * 0.42), c = [Math.cos(t) * d, Math.sin(t) * d * 0.8], hw = s * (0.1 + rng() * 0.08), b = blockAt(rng, c[0], c[1], hw, hw * (0.6 + rng() * 0.35), rng() * 6.28, hw * 0.3); out.push(b); under(g, b, o, 0.38); stonePoly(g, rng, o, b, true, i % 3 ? STONE : '#7a7268', 0.2 + rng() * 0.2); };
    for (let i = 0; i < 5; i++) chunk(i);
    for (let i = 3; i <= 9; i++) { const c = p(-s * 0.36 + i * s * 0.05, -s * 0.06), k = Math.sin(((i - 3) / 6) * Math.PI); for (const e of [-1, 1]) { const rib = Array.from({ length: 6 }, (_, j) => { const t = j / 5; return [c[0] - Math.sin(a) * e * t * s * (0.08 + k * 0.1) - Math.cos(a) * t * t * s * 0.03, c[1] + Math.cos(a) * e * t * s * (0.08 + k * 0.1) - Math.sin(a) * t * t * s * 0.03]; }); line(g, rib, 'rgba(50,36,20,0.9)', Math.max(1.4, s * 0.022)); line(g, rib, '#ded2b6', Math.max(0.8, s * 0.012)); } }
    bone(g, o, p(-s * 0.2, -s * 0.06), p(s * 0.14, -s * 0.06), s * 0.016, 0.1);
    bone(g, o, p(-s * 0.3, s * 0.1), p(-s * 0.62, s * 0.34), s * 0.022, 0.1); bone(g, o, p(-s * 0.1, -s * 0.2), p(-s * 0.4, -s * 0.44), s * 0.02, 0.1); bone(g, o, p(s * 0.5, -s * 0.3), p(s * 0.26, -s * 0.5), s * 0.018, 0.1);
    out.push(skullAt(g, rng, o, p(s * 0.3, -s * 0.02), s * 0.13, a - 0.3));
    for (let i = 5; i < 9; i++) chunk(i);
    return out;
  },
  mushrooms(g, s, rng, o, pal) {
    // A clump of mushrooms seen onto their caps.
    const out = [], roll = rng() < 0.6, plain = ['#b08a5a', '#8a5a3c', '#c2aa80'][Math.floor(rng() * 3)], spotted = roll && !!o.detail, tone = spotted ? '#a8342a' : plain, dr = seeded(921);
    for (let i = 0; i < 6; i++) {
      const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.56, c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.16 + rng() * 0.2), cap = circle(c[0], c[1], r, 18).map(([x, y], k) => [x + Math.sin(k * 1.9 + i) * r * 0.05, y + Math.cos(k * 2.3 + i) * r * 0.05]), col = varied(tone, rng, 1.3); out.push(cap);
      under(g, cap, o, 0.4); pathOf(g, cap, false); g.fillStyle = col; g.fill();
      g.save(); pathOf(g, cap, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], r * 0.1, c[0], c[1], r * 1.05); gr.addColorStop(0, 'rgba(255,240,210,0.26)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,8,0,0.5)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
      for (let k = 0; k < 22; k++) { const tt = (k / 22) * 6.283; line(g, [[c[0] + Math.cos(tt) * r * 0.78, c[1] + Math.sin(tt) * r * 0.78], [c[0] + Math.cos(tt) * r, c[1] + Math.sin(tt) * r]], 'rgba(30,12,2,0.26)', Math.max(0.4, o.ink * 0.4)); }
      if (spotted) for (let k = 0; k < 6; k++) { const tt = dr() * 6.283, dd = dr() * r * 0.7; disc(g, c[0] + Math.cos(tt) * dd, c[1] + Math.sin(tt) * dd, r * (0.06 + dr() * 0.07), '#efe6d2'); }
      g.restore(); thinLine(g, cap, false, col, o, 1); relDome(o, cap, c[0], c[1], r, 0.2, 0.5 + rng() * 0.3, 0.15);
    }
    return out;
  },
  log(g, s, rng, o, pal) {
    // A fallen log: bark along it, a sawn face at one end and a break at the other, a branch stub, a knothole.
    const a = (rng() - 0.5) * 0.5, p = at(a), L = s * 0.86, W = s * 0.15, bark = hexOf(mix(pal.wood, '#3a2a1c', 0.62)), n = 7, brk = Array.from({ length: n }, (_, k) => p(L * (0.92 + rng() * 0.12), (-1 + (2 * k) / (n - 1)) * W)), body = [p(-L, -W), ...brk, p(-L, W)];
    { const st = boxAt(...p(L * 0.2, -W * 1.5), W * 0.42, W * 0.6, a + 0.5); under(g, st, o, 0.3); barkOn(g, rng, o, st, a + 0.5 + 1.57, bark, 0.3); cutEnd(g, rng, o, at(a + 0.5, ...p(L * 0.2, -W * 1.5))(0, -W * 0.6), W * 0.4, W * 0.16, a + 0.5, pal, 0.3); }
    under(g, body, o, 0.4); barkOn(g, rng, o, body, a, bark, 0.36);
    relLine(o, [p(-L, 0), p(L * 0.9, 0)], W * 0.9, 0.5, 0.05);
    { const c = p(-L * 0.3, W * 0.3); pathOf(g, oval(c[0], c[1], W * 0.34, W * 0.2, a, 12), false); g.fillStyle = '#1a120a'; g.fill(); const k = oval(c[0], c[1], W * 0.5, W * 0.32, a, 14); k.push(k[0]); line(g, k, 'rgba(20,10,2,0.6)', Math.max(0.6, o.ink * 0.7)); }
    cutEnd(g, rng, o, p(-L * 0.99, 0), W * 0.3, W * 0.98, a, pal, 0.4);
    if (o.detail) {
      g.save(); pathOf(g, body, true); g.clip(); g.filter = `blur(${Math.max(1, s * 0.016)}px)`; const dr = seeded(918); for (let i = 0; i < 7; i++) { const c = p((dr() - 0.5) * L * 1.7, (dr() - 0.5) * W * 1.2); g.fillStyle = 'rgba(82,108,48,0.6)'; g.beginPath(); g.ellipse(c[0], c[1], L * (0.05 + dr() * 0.08), W * (0.2 + dr() * 0.3), a, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore();
      for (let i = 0; i < 4; i++) { const c = p(L * (0.36 + i * 0.1), W * (1.0 + (i % 2) * 0.1)), r = W * (0.3 + (i % 3) * 0.08), fan = Array.from({ length: 9 }, (_, k) => { const t = a + (k / 8) * Math.PI; return [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r * 0.8]; }); under(g, fan, o, 0.3); pathOf(g, fan, true); g.fillStyle = '#d2bc8e'; g.fill(); for (const k of [0.4, 0.7]) line(g, fan.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]), 'rgba(110,70,30,0.5)', Math.max(0.5, o.ink * 0.6)); thinLine(g, fan, true, '#d2bc8e', o, 0.8); rel(o, fan, true, 0.3, 0.1); }
    }
    return [body];
  },
  stump(g, s, rng, o, pal) {
    // A tree's stump: its sawn top, and its roots flaring out into the ground all round.
    const a = rng() * 6.28, R = s * 0.56, bark = hexOf(mix(pal.wood, '#3a2a1c', 0.65)), out = [circle(0, 0, R, 20)];
    for (let i = 0; i < 7; i++) { const t = a + (i / 7) * 6.283 + (rng() - 0.5) * 0.4, len = R * (1.2 + rng() * 0.25), w = R * (0.42 + rng() * 0.14), q = at(t), root = [q(R * 0.5, -w), q(R * 0.9, -w * 0.8), q(len * 0.9, -w * 0.42), q(len, -w * 0.15), q(len, w * 0.15), q(len * 0.9, w * 0.42), q(R * 0.9, w * 0.8), q(R * 0.5, w)]; under(g, root, o, 0.3); pathOf(g, root, false); g.fillStyle = varied(bark, rng, 1.2); g.fill(); line(g, [q(R * 0.7, 0), q(len * 0.9, 0)], 'rgba(255,232,190,0.14)', Math.max(0.6, o.ink * 0.8)); for (const e of [-0.5, 0.5]) line(g, [q(R * 0.7, e * w), q(len * 0.8, e * w * 0.3)], 'rgba(16,7,0,0.45)', Math.max(0.5, o.ink * 0.6)); thinLine(g, root, false, bark, o, 0.9); rel(o, root, false, 0.2, 0.05); }
    under(g, out[0], o, 0.4); stumpTop(g, rng, o, 0, 0, R, a, pal, 0.85);
    if (o.detail) { g.save(); g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.clip(); g.filter = `blur(${Math.max(1, s * 0.02)}px)`; const dr = seeded(919); for (let i = 0; i < 5; i++) { const t = dr() * 6.283; g.fillStyle = 'rgba(82,108,48,0.55)'; g.beginPath(); g.arc(Math.cos(t) * R * 0.86, Math.sin(t) * R * 0.86, R * (0.1 + dr() * 0.12), 0, 6.283); g.fill(); } g.filter = 'none'; g.restore(); }
    return out;
  },
  roots(g, s, rng, o, pal) {
    // Roots come up through the ground: thick where they start, forking and thinning as they run.
    const a = rng() * 6.28, bark = hexOf(mix(pal.wood, '#3a2a1c', 0.6)), out = [];
    const run = (from, t, len, w, depth) => { const n = 7, pts = [from]; let dir = t, c = from; for (let k = 1; k <= n; k++) { dir += (rng() - 0.5) * 0.5; c = [c[0] + Math.cos(dir) * len / n, c[1] + Math.sin(dir) * len / n]; pts.push(c); } const left = pts.map(([x, y], k) => { const ww = w * (1 - (k / n) * 0.85), d = k < n ? Math.atan2(pts[k + 1][1] - y, pts[k + 1][0] - x) : dir; return [x - Math.sin(d) * ww, y + Math.cos(d) * ww]; }), right = pts.map(([x, y], k) => { const ww = w * (1 - (k / n) * 0.85), d = k < n ? Math.atan2(pts[k + 1][1] - y, pts[k + 1][0] - x) : dir; return [x + Math.sin(d) * ww, y - Math.cos(d) * ww]; }), shape = [...left, ...right.reverse()]; if (!depth) out.push(shape);
      under(g, shape, o, 0.3); pathOf(g, shape, false); g.fillStyle = varied(bark, rng, 1.2); g.fill(); line(g, pts, 'rgba(255,232,190,0.16)', Math.max(0.6, w * 0.3)); line(g, left, 'rgba(16,7,0,0.4)', Math.max(0.5, o.ink * 0.5)); thinLine(g, shape, false, bark, o, 0.9); relLine(o, pts, Math.max(1.4, w * 1.4), 0.14, 0.05);
      if (depth < 1 && len > s * 0.3) { const k = 3 + Math.floor(rng() * 2); run(pts[k], dir + (rng() < 0.5 ? 0.7 : -0.7), len * 0.55, w * 0.55, depth + 1); } };
    const hub = [Math.cos(a) * s * -0.5, Math.sin(a) * s * -0.5];
    for (let i = 0; i < 5; i++) run(hub, a + (i - 2) * 0.42 + (rng() - 0.5) * 0.2, s * (0.9 + rng() * 0.4), s * (0.07 + rng() * 0.03), 0);
    return out;
  },
  nest(g, s, rng, o, pal) {
    // A bird's nest: twigs woven round and round, a soft lining, three eggs.
    const R = s * 0.74, rim = circle(0, 0, R, 24);
    under(g, rim, o, 0.35); pathOf(g, rim, false); g.fillStyle = '#4a3622'; g.fill();
    for (let i = 0; i < 150; i++) { const t = rng() * 6.283, d = R * (0.5 + rng() * 0.52), len = 0.35 + rng() * 0.5, tw = Array.from({ length: 5 }, (_, k) => { const tt = t + (k / 4) * len; return [Math.cos(tt) * (d + (rng() - 0.5) * R * 0.05), Math.sin(tt) * (d + (rng() - 0.5) * R * 0.05)]; }); line(g, tw, varied(['#6a4e30', '#8a6a42', '#a58a5a', '#3a2a1a'][Math.floor(rng() * 4)], rng, 1.3), 0.8 + rng() * 1.3); }
    relRing(o, R * 0.76, R * 0.5, 0.6, 0.05);
    disc(g, 0, 0, R * 0.5, '#b8a680'); g.save(); g.beginPath(); g.arc(0, 0, R * 0.5, 0, 6.283); g.clip(); for (let i = 0; i < 60; i++) { const c = [(rng() - 0.5) * R, (rng() - 0.5) * R], t = rng() * 6.28; line(g, [c, [c[0] + Math.cos(t) * R * 0.14, c[1] + Math.sin(t) * R * 0.14]], rng() < 0.5 ? 'rgba(255,246,225,0.5)' : 'rgba(90,70,40,0.4)', 0.7 + rng() * 0.6); } const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 0.5); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,18,6,0.55)'); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); g.restore();
    if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, R * 0.5, 0, 6.283); o.maps.fillStyle = mapsColour(0.3, 0.03); o.maps.fill(); }
    for (let i = 0; i < 3; i++) { const t = i * 2.1 + 0.4, c = [Math.cos(t) * R * 0.2, Math.sin(t) * R * 0.2], egg = oval(c[0], c[1], R * 0.2, R * 0.15, t + 0.8, 14), col = varied('#bcd0cc', rng, 1); under(g, egg, o, 0.3); pathOf(g, egg, false); g.fillStyle = col; g.fill(); if (o.detail) { const dr = seeded(922 + i); for (let k = 0; k < 9; k++) disc(g, c[0] + (dr() - 0.5) * R * 0.26, c[1] + (dr() - 0.5) * R * 0.2, Math.max(0.5, R * 0.014), 'rgba(90,70,50,0.6)'); } thinLine(g, egg, false, col, o, 0.9); relDome(o, egg, c[0], c[1], R * 0.2, 0.36, 0.5, 0.3); }
    return [rim];
  },
  beehive(g, s, rng, o, pal) {
    // A straw skep on its board: rope of straw coiled round and up to a point, a hole low in its side for the bees.
    const a = rng() * 6.28, p = at(a), R = s * 0.62, hive = circle(0, 0, R, 28), board = boxAt(0, 0, s * 0.78, s * 0.78, a + 0.3);
    under(g, board, o, 0.3); for (let k = -1; k <= 1; k++) plank(g, rng, o, ...at(a + 0.3)(0, k * s * 0.52), s * 0.78, s * 0.26, a + 0.3, shade(pal.wood, -0.1), 0.1);
    { const c = p(R * 0.92, 0); disc(g, c[0], c[1], R * 0.16, '#120c06'); }
    under(g, hive, o, 0.4); pathOf(g, hive, false); g.fillStyle = mix(STRAW, '#5a4418', 0.35); g.fill();
    g.save(); pathOf(g, hive, false); g.clip();
    for (let k = 7; k >= 1; k--) { const r = R * (k / 7.3), w = R * 0.125; ring(g, 0, 0, r, varied(STRAW, rng, 1.2), w); ring(g, 0, 0, r + w / 2, 'rgba(60,40,10,0.7)', Math.max(0.6, o.ink * 0.7)); for (let i = 0; i < 10 + k * 5; i++) { const t = a + (i / (10 + k * 5)) * 6.283; line(g, [[Math.cos(t) * (r - w * 0.45), Math.sin(t) * (r - w * 0.45)], [Math.cos(t + 0.06) * (r + w * 0.45), Math.sin(t + 0.06) * (r + w * 0.45)]], 'rgba(70,46,12,0.4)', Math.max(0.5, o.ink * 0.5)); } }
    { const gr = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R); gr.addColorStop(0, 'rgba(255,240,190,0.16)'); gr.addColorStop(1, 'rgba(30,18,4,0.4)'); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); }
    g.restore(); disc(g, 0, 0, R * 0.07, '#8a6a2a'); thinLine(g, hive, false, STRAW, o, 1.1); relDome(o, hive, 0, 0, R, 0.3, 1, 0.05);
    if (o.detail) { const dr = seeded(920), c = p(R * 0.95, 0); for (let i = 0; i < 9; i++) { const b = [c[0] + (dr() - 0.3) * R * 0.7, c[1] + (dr() - 0.5) * R * 0.8]; disc(g, b[0], b[1], Math.max(0.9, s * 0.022), '#2a1c08'); disc(g, b[0], b[1], Math.max(0.5, s * 0.012), '#e2b030'); } }
    return [hive];
  },
  bush(g, s, rng, o, pal) {
    // A bush from over it: leaf on leaf, darker down inside, paler where the outermost stand up into the light of the open.
    const R = s * 0.8, hull = blob(rng, 0, 0, R * 0.86, R * 0.78, 22, 0.24), deep = hexOf(shade(o.green, -0.42));
    under(g, hull, o, 0.45); pathOf(g, hull, false); g.fillStyle = deep; g.fill();
    for (const [k, n, tone] of [[0.92, 15, -0.2], [0.66, 13, -0.05], [0.38, 10, 0.1], [0.1, 5, 0.24]]) for (let i = 0; i < n; i++) {
      const t = (i / n) * 6.283 + rng() * 0.6, base = [Math.cos(t) * R * k * 0.72, Math.sin(t) * R * k * 0.66], dir = t + (rng() - 0.5) * 1.5, len = R * (0.3 + rng() * 0.16), bend = (rng() - 0.5) * 0.6, turned = rng() < 0.07, green = varied(turned ? hexOf(mix(o.green, '#b0a030', 0.6)) : hexOf(shade(o.green, tone)), rng, 2), stem = Array.from({ length: 6 }, (_, j) => { const d = dir + bend * (j / 5); return [base[0] + Math.cos(d) * len * (j / 5), base[1] + Math.sin(d) * len * (j / 5)]; });
      line(g, stem, 'rgba(60,40,20,0.75)', Math.max(0.5, o.ink * 0.6));
      for (let j = 1; j <= 5; j++) { const d = dir + bend * (j / 5), ll = R * 0.13 * (1 - j * 0.07) * (0.85 + rng() * 0.3); for (const e of j === 5 ? [0] : [-1, 1]) leaf(g, o, stem[j], d + e * 0.95, ll, ll * 0.36, varied(green, rng, 1.4)); }
    }
    relDome(o, hull, 0, 0, R, 0.3, 1, 0.08);
    if (o.detail) { const dr = seeded(923); for (let i = 0; i < 14; i++) { const t = dr() * 6.283, d = Math.sqrt(dr()) * R * 0.8, c = [Math.cos(t) * d, Math.sin(t) * d * 0.9], r = s * 0.028, col = varied(pal.cloth, dr, 1); disc(g, c[0], c[1], r, col); ring(g, c[0], c[1], r, mix(col, '#0c0904', 0.75), Math.max(0.4, o.ink * 0.5)); } }
    return [hull];
  },
  fern(g, s, rng, o, pal) {
    // A fern: fronds arching out from one crown, each a rib with leaflets down both sides growing smaller to its tip.
    const a = rng() * 6.28, out = [circle(0, 0, s * 0.24, 12)], n = 8;
    for (let i = 0; i < n; i++) {
      const t = a + (i / n) * 6.283 + (rng() - 0.5) * 0.3, len = s * (0.72 + rng() * 0.2), bend = (rng() - 0.5) * 0.5, green = varied(o.green, rng, 1.6), rib = Array.from({ length: 9 }, (_, k) => { const u = (k / 8) * len, tt = t + bend * (k / 8); return [Math.cos(tt) * u, Math.sin(tt) * u]; });
      for (let k = 1; k < 9; k++) { const tt = t + bend * (k / 8), ll = len * 0.2 * (1 - (k / 9) * 0.75); for (const e of [-1, 1]) leaf(g, o, rib[k], tt + e * 1.15, ll, ll * 0.24, k % 2 ? green : hexOf(shade(green, -0.1))); }
      line(g, rib, mix(green, '#0c0904', 0.5), Math.max(0.7, o.ink * 0.8)); relLine(o, rib, Math.max(2, len * 0.14), 0.5, 0.08);
    }
    disc(g, 0, 0, s * 0.05, hexOf(shade(o.green, -0.45)));
    return out;
  },
  agave(g, s, rng, o, pal) {
    // A spiky plant: a rosette of stiff pointed blades, a dark thorn at each tip.
    const a = rng() * 6.28, out = [circle(0, 0, s * 0.24, 12)], col = '#6a8a6a';
    for (const [n, k, off] of [[9, 1, 0], [7, 0.66, 0.35], [5, 0.36, 0.1]]) for (let i = 0; i < n; i++) {
      const t = a + off + (i / n) * 6.283 + (rng() - 0.5) * 0.14, len = s * 0.84 * k * (0.9 + rng() * 0.15), w = s * 0.11 * (0.6 + k * 0.5), q = at(t), green = varied(hexOf(shade(col, (1 - k) * 0.2)), rng, 1.4), blade = [q(0, -w * 0.6), q(len * 0.4, -w), q(len, 0), q(len * 0.4, w), q(0, w * 0.6)];
      pathOf(g, blade, true); g.fillStyle = green; g.fill(); line(g, [q(len * 0.05, 0), q(len * 0.92, 0)], mix(green, '#0c0904', 0.4), Math.max(0.5, o.ink * 0.6)); for (const e of [-1, 1]) line(g, [q(len * 0.1, e * w * 0.7), q(len * 0.4, e * w * 0.86), q(len * 0.96, e * w * 0.04)], 'rgba(232,240,210,0.45)', Math.max(0.5, o.ink * 0.6)); softLine(g, blade, true, green, o, 1.6); disc(g, ...q(len, 0), Math.max(0.7, s * 0.014), '#2a1a0a'); rel(o, blade, true, 0.3 + (1 - k) * 0.5, 0.15);
    }
    return out;
  },
  reeds(g, s, rng, o, pal) {
    // A clump of reeds: thin blades splaying out every way from where they stand, a brown plume on some.
    const out = [circle(0, 0, s * 0.24, 12)], dr = seeded(924);
    for (let i = 0; i < 26; i++) { const t = rng() * 6.283, len = s * (0.5 + rng() * 0.42), green = varied(inSeason(o, '#7a8a4a'), rng, 1.8), tip = bladeAt(g, o, [(rng() - 0.5) * s * 0.2, (rng() - 0.5) * s * 0.2], t, len, s * 0.035, green, (rng() - 0.5) * 0.9, 0.5 + rng() * 0.4); if (o.detail && dr() < 0.3) { const pl = oval(tip[0], tip[1], s * 0.07, s * 0.025, t, 10); pathOf(g, pl, false); g.fillStyle = '#a58a5a'; g.fill(); thinLine(g, pl, false, '#a58a5a', o, 0.7); } }
    return out;
  },
  cattails(g, s, rng, o, pal) {
    // Cattails: long blades, and among them the stems that end in a fat brown head.
    const out = [circle(0, 0, s * 0.24, 12)];
    for (let i = 0; i < 22; i++) bladeAt(g, o, [(rng() - 0.5) * s * 0.3, (rng() - 0.5) * s * 0.3], rng() * 6.283, s * (0.5 + rng() * 0.4), s * 0.045, varied(inSeason(o, '#6e8a4e'), rng, 1.8), (rng() - 0.5) * 0.8, 0.4 + rng() * 0.4);
    for (let i = 0; i < 7; i++) { const t = (i / 7) * 6.283 + rng() * 0.5, d = s * (0.3 + rng() * 0.36), c = [Math.cos(t) * d, Math.sin(t) * d], stem = [[Math.cos(t) * s * 0.05, Math.sin(t) * s * 0.05], c]; line(g, stem, 'rgba(40,50,16,0.9)', Math.max(1.2, s * 0.03)); line(g, stem, '#8a9a5a', Math.max(0.7, s * 0.016)); const head = oval(c[0] + Math.cos(t) * s * 0.1, c[1] + Math.sin(t) * s * 0.1, s * 0.13, s * 0.045, t, 12); under(g, head, o, 0.3); pathOf(g, head, false); g.fillStyle = varied('#5a3a22', rng, 1.2); g.fill(); line(g, [[c[0] + Math.cos(t) * s * 0.02, c[1] + Math.sin(t) * s * 0.02], [c[0] + Math.cos(t) * s * 0.2, c[1] + Math.sin(t) * s * 0.2]], 'rgba(255,220,170,0.2)', Math.max(0.5, o.ink * 0.7)); thinLine(g, head, false, '#5a3a22', o, 0.9); relDome(o, head, c[0] + Math.cos(t) * s * 0.1, c[1] + Math.sin(t) * s * 0.1, s * 0.13, 0.8, 1, 0.1); line(g, [[c[0] + Math.cos(t) * s * 0.23, c[1] + Math.sin(t) * s * 0.23], [c[0] + Math.cos(t) * s * 0.3, c[1] + Math.sin(t) * s * 0.3]], '#8a9a5a', Math.max(0.6, s * 0.01)); }
    return out;
  },
  grass(g, s, rng, o, pal) {
    // A tuft of grass.
    const out = [circle(0, 0, s * 0.24, 12)];
    for (let i = 0; i < 26; i++) bladeAt(g, o, [(rng() - 0.5) * s * 0.16, (rng() - 0.5) * s * 0.16], rng() * 6.283, s * (0.45 + rng() * 0.45), s * 0.05, varied(o.green, rng, 2), (rng() - 0.5) * 1.1, 0.2 + rng() * 0.4);
    return out;
  },
  flowers(g, s, rng, o, pal) {
    // Wildflowers: a scatter of small blooms in two or three colours, each over a few leaves.
    const out = [], dyes = [pal.cloth, hexOf(mix(CLOTHS[CLOTH_IDS[Math.floor(rng() * 5)]].base, '#ffffff', 0.15)), '#efe6d2'];
    for (let i = 0; i < 16; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.78, c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.06 + rng() * 0.035); for (let k = 0; k < 3; k++) leaf(g, o, c, rng() * 6.283, r * 2.2, r * 0.5, varied(o.green, rng, 1.8)); flower(g, rng, o, c[0], c[1], r, varied(dyes[i % 3], rng, 1)); out.push(circle(c[0], c[1], r, 8)); if (o.maps) { o.maps.beginPath(); o.maps.arc(c[0], c[1], r * 1.4, 0, 6.283); o.maps.fillStyle = mapsColour(0.06, 0.05); o.maps.fill(); } }
    return out;
  },
  moss(g, s, rng, o, pal) {
    // A carpet of moss: cushion against cushion, deeper green between them, ragged at its edge.
    const a = rng() * 6.28, bed = blob(rng, 0, 0, s * 0.84, s * 0.7, 30, 0.3, a), MOSS = o.season === 'winter' ? '#5a6a3e' : inSeason(o, '#4e7032');
    pathOf(g, bed, false); g.fillStyle = hexOf(shade(MOSS, -0.3)); g.fill();
    g.save(); pathOf(g, bed, false); g.clip();
    g.filter = `blur(${Math.max(0.8, s * 0.012)}px)`;
    for (let i = 0; i < 220; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.84, c = [Math.cos(t) * d, Math.sin(t) * d * 0.84], r = s * (0.03 + rng() * 0.05); disc(g, c[0], c[1], r, varied(hexOf(shade(MOSS, (rng() - 0.5) * 0.3)), rng, 1.8)); }
    g.filter = 'none';
    for (let i = 0; i < 500; i++) { const c = [(rng() - 0.5) * s * 1.7, (rng() - 0.5) * s * 1.4]; disc(g, c[0], c[1], Math.max(0.5, s * (0.004 + rng() * 0.008)), rng() < 0.5 ? 'rgba(190,220,130,0.5)' : 'rgba(14,30,6,0.5)'); }
    if (o.fine) fineWork(g, seeded(925), at(a), s * 0.84, s * 0.7, { along: false, dark: '14,26,6', pale: '220,240,170', much: 1.2 });
    if (o.detail) { const dr = seeded(926); for (let i = 0; i < 30; i++) { const c = [(dr() - 0.5) * s * 1.5, (dr() - 0.5) * s * 1.2]; line(g, [c, [c[0], c[1] - s * 0.03]], 'rgba(150,110,50,0.8)', Math.max(0.5, o.ink * 0.5)); disc(g, c[0], c[1] - s * 0.03, Math.max(0.5, s * 0.008), '#b0803a'); } }
    g.restore(); softLine(g, bed, false, MOSS, o, 1.4); rel(o, bed, false, 0.04, 0.05);
    return [bed];
  },
  leaves(g, s, rng, o, pal) {
    // Fallen leaves: browns and ochres and a red or two, lying any way.
    const out = [], tones = ['#9a6a2a', '#b8843a', '#7a4a22', '#a8442a', '#c2a24a', '#6a4a2a'];
    for (let i = 0; i < 46; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.82, c = [Math.cos(t) * d, Math.sin(t) * d], len = s * (0.12 + rng() * 0.09), k = rng() * 6.283, col = varied(tones[Math.floor(rng() * tones.length)], rng, 1.5), q = at(k, c[0], c[1]); leaf(g, o, c, k, len, len * 0.34, col); for (const e of [-1, 1]) for (const u of [0.35, 0.6]) line(g, [q(len * u, 0), q(len * (u + 0.16), e * len * 0.2)], mix(col, '#0c0904', 0.45), Math.max(0.4, o.ink * 0.4)); line(g, [q(0, 0), q(-len * 0.2, 0)], mix(col, '#0c0904', 0.6), Math.max(0.5, o.ink * 0.5)); if (i % 6 === 0) out.push(circle(c[0], c[1], len, 6)); }
    if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, s * 0.8, 0, 6.283); o.maps.fillStyle = mapsColour(0.03, 0.05); o.maps.fill(); }
    return out;
  },
  lilyPads(g, s, rng, o, pal) {
    // Lily pads: round leaves lying on the water, each cut with one notch to its middle, veins fanning from there.
    const out = [];
    [[-0.4, -0.3, 0.36], [0.3, -0.42, 0.28], [0.44, 0.2, 0.34], [-0.14, 0.34, 0.3], [-0.6, 0.3, 0.2], [0.02, -0.02, 0.2]].forEach(([u, v, r0], i) => {
      const c = [u * s, v * s], R = r0 * s, t0 = rng() * 6.283, green = varied(inSeason(o, '#4e7a3a'), rng, 1.8), pad = [c, ...Array.from({ length: 21 }, (_, k) => { const t = t0 + 0.18 + (k / 20) * (6.283 - 0.36); return [c[0] + Math.cos(t) * R * (1 + Math.sin(k * 2.1) * 0.03), c[1] + Math.sin(t) * R * (1 + Math.cos(k * 1.7) * 0.03)]; })]; out.push(pad);
      under(g, pad, o, 0.25); pathOf(g, pad, true); g.fillStyle = green; g.fill();
      g.save(); pathOf(g, pad, true); g.clip(); for (let k = 1; k < 12; k++) { const t = t0 + 0.18 + (k / 12) * (6.283 - 0.36); line(g, [c, [c[0] + Math.cos(t) * R, c[1] + Math.sin(t) * R]], 'rgba(220,240,180,0.3)', Math.max(0.4, o.ink * 0.5)); } const gr = g.createRadialGradient(c[0], c[1], R * 0.2, c[0], c[1], R); gr.addColorStop(0, 'rgba(230,245,190,0.14)'); gr.addColorStop(1, 'rgba(10,26,6,0.34)'); g.fillStyle = gr; g.fillRect(c[0] - R, c[1] - R, R * 2, R * 2); g.restore();
      softLine(g, pad, true, green, o, 2); rel(o, pad, true, 0.03, 0.3);
      if (o.detail && (i === 0 || i === 2)) { const f = [c[0] + Math.cos(t0 + 2) * R * 0.3, c[1] + Math.sin(t0 + 2) * R * 0.3], fr = R * 0.42, petal = i ? '#f0d0d8' : '#f4eee0'; for (const [n, k] of [[8, 1], [6, 0.6]]) for (let j = 0; j < n; j++) { const t = (j / n) * 6.283 + k; leaf(g, o, f, t, fr * k, fr * k * 0.3, petal); } disc(g, f[0], f[1], fr * 0.16, '#e6c04a'); }
    });
    return out;
  },
  fairyRing(g, s, rng, o, pal) {
    // A ring of mushrooms come up in the grass, the grass greener inside it.
    const R = s * 0.66, out = [];
    g.save(); g.filter = `blur(${Math.max(1, s * 0.04)}px)`; ring(g, 0, 0, R * 0.86, 'rgba(60,96,34,0.5)', R * 0.34); g.restore();
    for (let i = 0; i < 46; i++) { const t = rng() * 6.283, d = R * (0.66 + rng() * 0.5); bladeAt(g, o, [Math.cos(t) * d, Math.sin(t) * d], rng() * 6.283, s * (0.07 + rng() * 0.07), s * 0.016, varied(o.green, rng, 2), (rng() - 0.5) * 0.8, 0.04); }
    for (let i = 0; i < 15; i++) { const t = (i / 15) * 6.283 + (rng() - 0.5) * 0.2, d = R * (0.94 + rng() * 0.12), c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.04 + rng() * 0.035), col = varied('#d8c8a0', rng, 1.2), cap = circle(c[0], c[1], r, 12); out.push(cap); under(g, cap, o, 0.25); pathOf(g, cap, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, cap, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); gr.addColorStop(0, 'rgba(150,100,50,0.45)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,24,6,0.4)'); g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, r * 2, r * 2); g.restore(); thinLine(g, cap, false, col, o, 0.9); relDome(o, cap, c[0], c[1], r, 0.3, 0.9, 0.15); }
    return out;
  },
  lichen(g, s, rng, o, pal) {
    // Lichen on stone: crusted rosettes, grey-green and a rust-orange, each ringed where it has grown outward.
    const out = [];
    for (let i = 0; i < 9; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.6, c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.12 + rng() * 0.16), col = varied(i % 4 === 3 ? '#c08a3a' : '#9aa88a', rng, 1.5), patch = blob(rng, c[0], c[1], r, r * 0.86, 14, 0.3); out.push(patch);
      pathOf(g, patch, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, patch, false); g.clip(); for (const k of [0.78, 0.52, 0.26]) { const inner = patch.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]); inner.push(inner[0]); line(g, inner, mix(col, '#0c0904', 0.3), Math.max(0.4, o.ink * 0.5)); } if (o.fine) fineWork(g, seeded(927 + i), at(0, c[0], c[1]), r, r, { along: false, dark: '30,34,24', pale: '240,244,225', much: 1.4 }); g.restore(); thinLine(g, patch, false, col, o, 0.7); rel(o, patch, false, 0.02, 0.04); }
    return out;
  },
  crystals(g, s, rng, o, pal) {
    // A cluster of crystals: six-sided prisms standing out of a knot of rock, each cut in long faces to a ridge.
    const a = rng() * 6.28, ICE = '#9ac8f0', out = [];
    stoneLump(g, rng, o, 0, 0, s * 0.5, s * 0.42, a, '#5e5a58', 0.2);
    [[0.2, 0.86, 0.17], [1.5, 0.62, 0.13], [2.7, 0.74, 0.15], [4.0, 0.56, 0.12], [5.1, 0.7, 0.14], [3.3, 0.36, 0.1]].forEach(([t0, len, w], i) => {
      const t = a + t0 + (rng() - 0.5) * 0.3, q = at(t), L = len * s, W = w * s, col = varied(ICE, rng, 1), pts = [q(s * 0.06, -W * 0.7), q(L * 0.78, -W), q(L, 0), q(L * 0.78, W), q(s * 0.06, W * 0.7)]; out.push(pts);
      under(g, pts, o, 0.35); pathOf(g, pts, true); g.fillStyle = col; g.fill();
      pathOf(g, [q(s * 0.06, -W * 0.7), q(L * 0.78, -W), q(L, 0), q(s * 0.06, 0)], true); g.fillStyle = i % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(20,40,80,0.26)'; g.fill();
      pathOf(g, [q(L * 0.78, -W), q(L, 0), q(L * 0.78, W), q(L * 0.7, 0)], true); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill();
      line(g, [q(s * 0.06, 0), q(L, 0)], 'rgba(255,255,255,0.6)', Math.max(0.5, o.ink * 0.6)); line(g, [q(L * 0.78, -W), q(L * 0.7, 0), q(L * 0.78, W)], 'rgba(20,40,80,0.4)', Math.max(0.4, o.ink * 0.5));
      if (o.fine) { g.save(); pathOf(g, pts, true); g.clip(); fineWork(g, seeded(930 + i), q, L, W, { dark: '20,40,80', pale: '255,255,255', much: 0.5 }); g.restore(); }
      thinLine(g, pts, true, col, o, 0.9); rel(o, pts, true, 0.4 + i * 0.05, 0.95); relLine(o, [q(s * 0.06, 0), q(L, 0)], Math.max(1.2, W * 0.5), 0.7 + i * 0.05, 0.95);
    });
    return out;
  },
  stalagmite(g, s, rng, o, pal) {
    // A stalagmite from over its tip: ring on ring of dripstone, each a little paler and smaller than the one it stands on.
    const out = [dripstone(g, rng, o, 0, 0, s * 0.78, 6, '#8a8272', 1)];
    if (o.detail) { ring(g, 0, 0, s * 0.05, 'rgba(210,230,236,0.6)', Math.max(0.6, o.ink * 0.7)); disc(g, 0, 0, s * 0.02, 'rgba(230,244,248,0.8)'); }
    return out;
  },
  column(g, s, rng, o, pal) {
    // A rock column, floor to roof, from over it: a broad fluted foot of flowstone round the shaft.
    const a = rng() * 6.28, R = s * 0.82, foot = dripstone(g, rng, o, 0, 0, R, 4, '#7c7466', 0.5);
    g.save(); pathOf(g, foot, false); g.clip(); for (let i = 0; i < 22; i++) { const t = a + (i / 22) * 6.283 + (rng() - 0.5) * 0.1; line(g, [[Math.cos(t) * R * 0.34, Math.sin(t) * R * 0.34], [Math.cos(t + 0.04) * R * 0.7, Math.sin(t + 0.04) * R * 0.7], [Math.cos(t) * R * 1.02, Math.sin(t) * R * 1.02]], i % 2 ? 'rgba(20,16,10,0.34)' : 'rgba(255,246,225,0.18)', Math.max(0.6, o.ink * (0.6 + rng() * 0.6))); } g.restore();
    const shaft = blob(rng, 0, 0, R * 0.36, R * 0.32, 12, 0.14, a); under(g, shaft, o, 0.5); stonePoly(g, rng, o, shaft, false, '#9a9282', 1); relDome(o, shaft, 0, 0, R * 0.36, 0.9, 1, 0.3);
    return [foot];
  },
  cavePool(g, s, rng, o, pal) {
    // A pool of still black water in the rock, pale with lime round its lip, rings spreading where a drop falls.
    const a = rng() * 6.28, lip = blob(rng, 0, 0, s * 0.84, s * 0.7, 20, 0.16, a), pool = lip.map(([x, y]) => [x * 0.88, y * 0.88]);
    pathOf(g, lip, false); g.fillStyle = '#b4ae9c'; g.fill(); g.save(); pathOf(g, lip, false); g.clip(); if (o.fine) fineWork(g, seeded(940), at(a), s * 0.84, s * 0.7, { along: false, dark: '40,36,28', pale: '255,252,240', much: 1 }); g.restore(); softLine(g, lip, false, '#8a8474', o, 1.4); rel(o, lip, false, 0.06, 0.2);
    pathOf(g, pool, false); g.fillStyle = '#10181c'; g.fill();
    g.save(); pathOf(g, pool, false); g.clip(); { const gr = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.8); gr.addColorStop(0, 'rgba(60,100,110,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    { const c = [Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.16]; for (const k of [0.08, 0.18, 0.3, 0.44]) ring(g, c[0], c[1], s * k, `rgba(190,220,230,${0.34 - k * 0.5})`, Math.max(0.6, o.ink * 0.7)); disc(g, c[0], c[1], Math.max(0.8, s * 0.014), 'rgba(220,240,246,0.8)'); }
    g.restore(); thinLine(g, pool, false, '#3a4a50', o, 0.9); rel(o, pool, false, 0.02, 0.6);
    if (o.frozen) iceOver(g, rng, o, pool, false);
    return [lip];
  },
  glowShrooms(g, s, rng, o, pal) {
    // Mushrooms that give their own light: a pale green-blue, brightest at the heart of each cap.
    const out = [], GLOW = '#7ae0c0';
    g.save(); g.filter = `blur(${Math.max(1, s * 0.1)}px)`; disc(g, 0, 0, s * 0.62, o.night ? 'rgba(110,230,200,0.44)' : 'rgba(110,230,200,0.2)'); g.restore();
    for (let i = 0; i < 7; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.52, c = [Math.cos(t) * d, Math.sin(t) * d], r = s * (0.12 + rng() * 0.16), cap = circle(c[0], c[1], r, 16), col = varied(GLOW, rng, 1); out.push(cap);
      under(g, cap, o, 0.25); pathOf(g, cap, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, cap, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); gr.addColorStop(0, 'rgba(240,255,250,0.85)'); gr.addColorStop(0.5, 'rgba(160,250,230,0.2)'); gr.addColorStop(1, 'rgba(10,70,70,0.5)'); g.fillStyle = gr; g.fillRect(c[0] - r, c[1] - r, r * 2, r * 2); for (let k = 0; k < 16; k++) { const tt = (k / 16) * 6.283; line(g, [[c[0] + Math.cos(tt) * r * 0.7, c[1] + Math.sin(tt) * r * 0.7], [c[0] + Math.cos(tt) * r, c[1] + Math.sin(tt) * r]], 'rgba(10,70,70,0.3)', Math.max(0.4, o.ink * 0.4)); } g.restore(); softLine(g, cap, false, '#2a6a64', o, 1.6); relDome(o, cap, c[0], c[1], r, 0.2, 0.6, 0.3); }
    return out;
  },
  cobweb(g, s, rng, o, pal) {
    // A spider's web: spokes from its hub, a spiral of thread sagging between them, dew on some of it.
    const a = rng() * 6.28, n = 11, R = s * 0.84, spokes = Array.from({ length: n }, (_, i) => a + (i / n) * 6.283 + (rng() - 0.5) * 0.16), thread = 'rgba(236,238,234,0.5)', w = Math.max(0.5, o.ink * 0.45);
    g.save(); g.filter = `blur(${Math.max(1, s * 0.06)}px)`; disc(g, 0, 0, R * 0.8, 'rgba(10,8,6,0.12)'); g.restore(); // (under it all round: toward no side)
    for (const t of spokes) line(g, [[0, 0], [Math.cos(t) * R * (0.86 + rng() * 0.14), Math.sin(t) * R * (0.86 + rng() * 0.14)]], 'rgba(240,242,238,0.7)', w * 1.3);
    for (let k = 1; k <= 8; k++) { const r = R * (0.1 + k * 0.1); for (let i = 0; i < n; i++) { if (rng() < 0.06) continue; const t0 = spokes[i], t1 = spokes[(i + 1) % n] + (i === n - 1 ? 6.283 : 0), tm = (t0 + t1) / 2, A = [Math.cos(t0) * r, Math.sin(t0) * r], B = [Math.cos(t1) * r, Math.sin(t1) * r], M = [Math.cos(tm) * r * 0.9, Math.sin(tm) * r * 0.9]; g.beginPath(); g.moveTo(A[0], A[1]); g.quadraticCurveTo(M[0], M[1], B[0], B[1]); g.strokeStyle = thread; g.lineWidth = w; g.stroke(); if (o.detail && rng() < 0.14) disc(g, M[0] * 1.03, M[1] * 1.03, Math.max(0.7, s * 0.012), 'rgba(220,240,250,0.85)'); } }
    if (o.detail) { const c = [Math.cos(a + 1) * R * 0.3, Math.sin(a + 1) * R * 0.3]; for (let k = 0; k < 8; k++) { const t = (k / 8) * 6.283 + 0.3; line(g, [c, [c[0] + Math.cos(t) * s * 0.08, c[1] + Math.sin(t) * s * 0.08]], '#1a1410', Math.max(0.6, o.ink * 0.6)); } disc(g, c[0], c[1], s * 0.035, '#1a1410'); disc(g, c[0] + s * 0.03, c[1], s * 0.022, '#2a201a'); }
    disc(g, 0, 0, Math.max(1, s * 0.03), 'rgba(244,246,242,0.85)');
    if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, R * 0.5, 0, 6.283); o.maps.fillStyle = mapsColour(0.02, 0.4); o.maps.fill(); }
    return [circle(0, 0, s * 0.1, 8)];
  },
  hangingRoots(g, s, rng, o, pal) {
    // Roots let down through the roof of a cave: a mat of pale tendrils, each forking finer and finer.
    const a = rng() * 6.28, pale = hexOf(mix(pal.wood, '#c8b890', 0.6)), out = [];
    const strand = (from, t, len, w, depth) => { const n = 6, pts = [from]; let dir = t, c = from; for (let k = 1; k <= n; k++) { dir += (rng() - 0.5) * 0.7; c = [c[0] + Math.cos(dir) * len / n, c[1] + Math.sin(dir) * len / n]; pts.push(c); } line(g, pts, 'rgba(30,18,6,0.7)', w * 1.7); line(g, pts, varied(pale, rng, 1.2), w); relLine(o, pts, Math.max(1, w * 1.4), 0.05, 0.05); if (depth < 2) for (const k of [2, 4]) if (rng() < 0.75) strand(pts[k], dir + (rng() < 0.5 ? 0.8 : -0.8), len * 0.55, Math.max(0.5, w * 0.6), depth + 1); return pts; };
    for (let i = 0; i < 9; i++) { const t = a + (i / 9) * 6.283, pts = strand([(rng() - 0.5) * s * 0.3, (rng() - 0.5) * s * 0.3], t, s * (0.5 + rng() * 0.3), Math.max(1, s * 0.022), 0); out.push(pts.slice(0, 4).map(([x, y]) => [x, y]).concat([[pts[3][0] + 1, pts[3][1] + 1]])); }
    return out;
  },
  timberProps(g, s, rng, o, pal) {
    // A mine prop: a cap beam on two posts, wedged tight, a brace let in at each corner.
    const a = (rng() - 0.5) * 0.14, p = at(a), L = s * 0.86, cap = boxAt(0, 0, L, s * 0.12, a);
    for (const u of [-0.8, 0.8]) postEnd(g, rng, o, p(u * L, 0), s * 0.15, a, pal, 0.6);
    for (const u of [-0.5, 0.5]) { const b = boxAt(...p(u * L, s * 0.05), s * 0.2, s * 0.04, a + (u > 0 ? -0.6 : 0.6)); under(g, b, o, 0.3); plank(g, rng, o, ...p(u * L, s * 0.05), s * 0.2, s * 0.04, a + (u > 0 ? -0.6 : 0.6), shade(pal.wood, -0.2), 0.7); }
    under(g, cap, o, 0.45); plank(g, rng, o, 0, 0, L, s * 0.12, a, pal.wood, 1);
    for (const e of [-1, 1]) cutEnd(g, rng, o, p(e * L * 0.99, 0), s * 0.03, s * 0.115, a, pal, 1);
    for (const u of [-0.8, 0.8]) { const w = boxAt(...p(u * L, -s * 0.15), s * 0.07, s * 0.03, a + 0.1); under(g, w, o, 0.3); pathOf(g, w, true); g.fillStyle = shade(pal.wood, 0.14); g.fill(); thinLine(g, w, true, pal.wood, o, 0.8); rel(o, w, true, 0.9, 0.1); stud(g, o, ...p(u * L, 0), Math.max(1, s * 0.022), pal, 1); }
    if (o.detail) { const c = p(L * 0.2, s * 0.2), hook = [p(L * 0.2, s * 0.06), c]; line(g, hook, 'rgba(8,6,6,0.9)', Math.max(1.4, s * 0.03)); line(g, hook, pal.metal, Math.max(0.8, s * 0.016)); plate(g, o, circle(c[0], c[1] + s * 0.07, s * 0.08, 12), pal, 0.6); disc(g, c[0], c[1] + s * 0.07, s * 0.04, '#e9cf8c'); }
    return [cap];
  },
  lavaCrack(g, s, rng, o, pal) {
    // A crack with fire in it: molten rock showing through split black crust, branching as it goes.
    const a = rng() * 6.28, out = [];
    const crust = blob(rng, 0, 0, s * 0.9, s * 0.5, 18, 0.2, a); g.save(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; pathOf(g, crust, false); g.fillStyle = 'rgba(20,14,12,0.6)'; g.fill(); g.restore();
    const run = (from, t, len, w, depth) => { const pts = crackLine(rng, from, t, len, 9), shape = crackShape(pts, w); if (!depth) out.push(shape);
      g.save(); g.filter = `blur(${Math.max(1, w * 1.2)}px)`; pathOf(g, shape, true); g.fillStyle = 'rgba(230,90,20,0.55)'; g.fill(); g.restore();
      pathOf(g, shape, true); g.fillStyle = '#e2601a'; g.fill(); pathOf(g, crackShape(pts, w * 0.5), true); g.fillStyle = '#ffd060'; g.fill(); pathOf(g, shape, true); g.strokeStyle = 'rgba(20,8,4,0.9)'; g.lineWidth = Math.max(0.7, o.ink * 0.9); g.lineJoin = 'round'; g.stroke(); rel(o, shape, true, 0.01, 0.3);
      if (depth < 1) for (const k of [3, 6]) run(pts[k], t + (rng() < 0.5 ? 0.9 : -0.9), len * 0.42, w * 0.6, depth + 1); };
    run([Math.cos(a) * -s * 0.86, Math.sin(a) * -s * 0.86], a, s * 1.7, s * 0.07, 0);
    if (o.detail) { const dr = seeded(941); for (let i = 0; i < 14; i++) { const c = [(dr() - 0.5) * s * 1.6, (dr() - 0.5) * s * 0.8]; stoneLump(g, dr, o, c[0], c[1], s * (0.03 + dr() * 0.03), s * 0.03, dr() * 6, '#2a2422', 0.05); } }
    return out;
  },
  oreVein(g, s, rng, o, pal) {
    // A vein of ore showing in the rock of the floor: a dark band, bright metal flecked and streaked through it, a seam of quartz beside.
    const a = rng() * 6.28, p = at(a), pts = crackLine(rng, p(-s * 0.86, 0), a, s * 1.7, 9), band = crackShape(pts, s * 0.22), bright = hexOf(pal.metalLit);
    g.save(); g.filter = `blur(${Math.max(1, s * 0.035)}px)`; pathOf(g, band, false); g.fillStyle = 'rgba(52,46,42,0.8)'; g.fill(); g.restore();
    g.save(); pathOf(g, crackShape(pts, s * 0.26), false); g.clip(); if (o.fine) fineWork(g, seeded(942), p, s * 0.9, s * 0.3, { along: false, dark: '14,12,10', pale: '200,196,188', much: 1.2 });
    for (let i = 0; i < 60; i++) { const k = Math.floor(rng() * 8), c = [pts[k][0] + (rng() - 0.5) * s * 0.3, pts[k][1] + (rng() - 0.5) * s * 0.3], t = a + (rng() - 0.5) * 1.2, len = s * (0.02 + rng() * 0.07), col = varied(bright, rng, 1); line(g, [c, [c[0] + Math.cos(t) * len, c[1] + Math.sin(t) * len]], col, 0.8 + rng() * 2); relLine(o, [c, [c[0] + Math.cos(t) * len, c[1] + Math.sin(t) * len]], 1.5, 0.05, 0.95); }
    line(g, pts.map(([x, y], k) => [x - Math.sin(a) * s * 0.1 + Math.sin(k) * s * 0.02, y + Math.cos(a) * s * 0.1]), 'rgba(236,236,228,0.75)', Math.max(1, s * 0.022));
    g.restore(); rel(o, band, false, 0.02, 0.1);
    return [band];
  },
  dripSpot(g, s, rng, o, pal) {
    // Where water drips from the roof: a wet patch, a crust of lime round where it lands, rings on the wet.
    const a = rng() * 6.28, wet = blob(rng, 0, 0, s * 0.8, s * 0.7, 16, 0.2, a);
    g.save(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; pathOf(g, wet, false); g.fillStyle = 'rgba(18,22,26,0.5)'; g.fill(); g.restore();
    { const crust = blob(rng, 0, 0, s * 0.3, s * 0.26, 12, 0.2); pathOf(g, crust, false); g.fillStyle = '#b8b2a0'; g.fill(); softLine(g, crust, false, '#8a8474', o, 1.4); rel(o, crust, false, 0.05, 0.3); }
    disc(g, 0, 0, s * 0.16, '#141c20'); for (const k of [0.07, 0.12]) ring(g, 0, 0, s * k, 'rgba(190,220,230,0.4)', Math.max(0.5, o.ink * 0.6)); disc(g, 0, 0, Math.max(0.8, s * 0.02), 'rgba(226,242,248,0.85)');
    if (o.maps) { o.maps.beginPath(); o.maps.arc(0, 0, s * 0.16, 0, 6.283); o.maps.fillStyle = mapsColour(0.02, 0.7); o.maps.fill(); }
    return [circle(0, 0, s * 0.3, 10)];
  },
  fissure(g, s, rng, o, pal) {
    // A crack in the ground: black down inside it, its lips broken and chipped, branching.
    const a = rng() * 6.28, out = [];
    const run = (from, t, len, w, depth) => { const pts = crackLine(rng, from, t, len, 10), shape = crackShape(pts, w); if (!depth) out.push(shape);
      g.save(); g.filter = `blur(${Math.max(1, w * 0.8)}px)`; pathOf(g, crackShape(pts, w * 1.7), true); g.fillStyle = 'rgba(10,8,6,0.4)'; g.fill(); g.restore();
      pathOf(g, shape, true); g.fillStyle = '#0c0a08'; g.fill(); pathOf(g, shape, true); g.strokeStyle = 'rgba(30,24,18,0.9)'; g.lineWidth = Math.max(0.7, o.ink * 0.9); g.lineJoin = 'round'; g.stroke(); line(g, pts.map(([x, y]) => [x - w * 0.5, y - w * 0.5]), 'rgba(255,246,225,0.14)', Math.max(0.5, o.ink * 0.6)); rel(o, shape, true, 0, 0.03);
      if (depth < 1) for (const k of [3, 6]) run(pts[k], t + (rng() < 0.5 ? 0.8 : -0.8), len * 0.4, w * 0.55, depth + 1); };
    run([Math.cos(a) * -s * 0.86, Math.sin(a) * -s * 0.86], a, s * 1.7, s * 0.06, 0);
    if (o.detail) { const dr = seeded(943); for (let i = 0; i < 12; i++) { const c = [(dr() - 0.5) * s * 1.6, (dr() - 0.5) * s * 0.7]; stoneLump(g, dr, o, c[0], c[1], s * (0.025 + dr() * 0.03), s * 0.025, dr() * 6, STONE, 0.04); } }
    return out;
  },
  puddle(g, s, rng, o, pal) {
    // A puddle: a skin of water in the mud it has made, a leaf afloat on it.
    const a = rng() * 6.28, mud = blob(rng, 0, 0, s * 0.86, s * 0.68, 20, 0.2, a), pool = mud.map(([x, y]) => [x * 0.8, y * 0.8]);
    g.save(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; pathOf(g, mud, false); g.fillStyle = 'rgba(70,52,34,0.75)'; g.fill(); g.restore();
    pathOf(g, pool, false); g.fillStyle = '#3a4a4e'; g.fill();
    g.save(); pathOf(g, pool, false); g.clip(); { const gr = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.75); gr.addColorStop(0, 'rgba(150,180,190,0.3)'); gr.addColorStop(1, 'rgba(40,30,18,0.5)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); }
    for (let i = 0; i < 5; i++) { const x = (rng() - 0.5) * s * 0.9, y = (rng() - 0.5) * s * 0.6, w = s * (0.08 + rng() * 0.14); line(g, [[x - w, y], [x, y + (rng() - 0.5) * s * 0.02], [x + w, y]], 'rgba(210,230,236,0.26)', Math.max(0.5, o.ink * 0.6)); }
    g.restore(); softLine(g, pool, false, '#5a4a36', o, 1.6); rel(o, pool, false, 0.01, 0.7);
    if (o.frozen) iceOver(g, rng, o, pool, false);
    if (o.detail) { const c = [Math.cos(a + 1) * s * 0.24, Math.sin(a + 1) * s * 0.2]; leaf(g, o, c, a, s * 0.16, s * 0.055, '#a8742a'); }
    return [pool];
  },
  streamRock(g, s, rng, o, pal) {
    // A rock standing in running water: foam where the stream breaks on it, moss on its dry top, smaller rocks in its lee.
    const a = rng() * 6.28, out = [];
    for (const k of [1.18, 1.34]) { const foam = blob(rng, 0, 0, s * 0.56 * k, s * 0.46 * k, 18, 0.14, a); foam.push(foam[0]); g.setLineDash([s * 0.07, s * 0.05, s * 0.03, s * 0.06]); line(g, foam, `rgba(236,244,246,${k < 1.2 ? 0.75 : 0.4})`, Math.max(0.8, s * (k < 1.2 ? 0.022 : 0.014))); g.setLineDash([]); }
    { const dr = seeded(950); for (const [t, d, r] of [[2.2, 0.76, 0.14], [3.1, 0.7, 0.1]]) { const c = [Math.cos(a + t) * s * d, Math.sin(a + t) * s * d]; out.push(rockForm(g, dr, o, c[0], c[1], s * r, s * r * 0.8, t, '#6a6862', 0.3, 8)); } }
    const body = rockForm(g, rng, o, 0, 0, s * 0.56, s * 0.46, a, '#6e6c66', 0.9, 12); out.push(body);
    if (o.detail) { g.save(); pathOf(g, body, false); g.clip(); g.filter = `blur(${Math.max(1, s * 0.02)}px)`; const dr = seeded(951); for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(82,108,48,0.6)'; g.beginPath(); g.ellipse((dr() - 0.5) * s * 0.5, (dr() - 0.5) * s * 0.4, s * (0.05 + dr() * 0.08), s * (0.04 + dr() * 0.05), dr() * 3, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore(); }
    return out;
  },
  steppingStones(g, s, rng, o, pal) {
    // Stones set across water to walk on, laid dead along their run: each flat-topped, a ring where the water laps it.
    const out = [];
    for (let i = 0; i < 6; i++) { const c = [-s * 0.86 + i * s * 0.344 + (rng() - 0.5) * s * 0.05, (rng() - 0.5) * s * 0.1], rx = s * (0.13 + rng() * 0.03), ry = s * (0.1 + rng() * 0.03), t = rng() * 6.28, lap = oval(c[0], c[1], rx * 1.25, ry * 1.3, t, 16); lap.push(lap[0]); g.setLineDash([s * 0.04, s * 0.05, s * 0.02, s * 0.06]); line(g, lap, 'rgba(226,238,242,0.3)', Math.max(0.6, s * 0.008)); g.setLineDash([]); const st = blob(rng, c[0], c[1], rx, ry, 10, 0.14, t); out.push(st); under(g, st, o, 0.25); { const col = varied(i % 2 ? '#7e7a72' : STONE, rng, 1.4); pathOf(g, st, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, st, false); g.clip(); const gr = g.createRadialGradient(c[0], c[1], rx * 0.3, c[0], c[1], rx * 1.1); gr.addColorStop(0, 'rgba(255,250,240,0.1)'); gr.addColorStop(1, 'rgba(10,14,16,0.5)'); g.fillStyle = gr; g.fillRect(c[0] - rx * 2, c[1] - rx * 2, rx * 4, rx * 4); if (o.fine) fineWork(g, seeded(975 + i), at(0, c[0], c[1]), rx, rx, { along: false, dark: '20,20,22', pale: '255,255,250', much: 0.9 }); g.restore(); softLine(g, st, false, col, o, 2); rel(o, st, false, 0.5, 0.2); } const top = st.map(([x, y]) => [c[0] + (x - c[0]) * 0.72, c[1] + (y - c[1]) * 0.72]); pathOf(g, top, false); g.fillStyle = 'rgba(255,250,240,0.1)'; g.fill(); rel(o, top, false, 0.9, 0.2); }
    return out;
  },
  waterDebris(g, s, rng, o, pal) {
    // What a stream carries and leaves in a slack: sticks, leaves, a board, a patch of scum.
    const a = rng() * 6.28, out = [];
    { const scum = blob(rng, 0, 0, s * 0.7, s * 0.5, 16, 0.24, a); g.save(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; pathOf(g, scum, false); g.fillStyle = 'rgba(120,130,80,0.34)'; g.fill(); g.restore(); out.push(scum); }
    { const c = [Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2], b = boxAt(c[0], c[1], s * 0.32, s * 0.06, a + 0.5); under(g, b, o, 0.2); plank(g, rng, o, c[0], c[1], s * 0.32, s * 0.06, a + 0.5, shade(pal.wood, -0.14), 0.04); }
    for (let i = 0; i < 9; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.66, c = [Math.cos(t) * d, Math.sin(t) * d], k = rng() * 6.283, len = s * (0.14 + rng() * 0.22), st = [c, [c[0] + Math.cos(k) * len * 0.5, c[1] + Math.sin(k) * len * 0.5 + (rng() - 0.5) * s * 0.03], [c[0] + Math.cos(k) * len, c[1] + Math.sin(k) * len]]; line(g, st, 'rgba(30,18,6,0.8)', Math.max(1.4, s * 0.03)); line(g, st, varied('#6a4e30', rng, 1.4), Math.max(0.8, s * 0.018)); relLine(o, st, Math.max(1.2, s * 0.025), 0.03, 0.2); }
    for (let i = 0; i < 12; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.7; leaf(g, o, [Math.cos(t) * d, Math.sin(t) * d], rng() * 6.283, s * (0.08 + rng() * 0.06), s * 0.035, varied(['#8a6a2a', '#5d7a3a', '#a8742a'][i % 3], rng, 1.5)); }
    if (o.detail) for (let i = 0; i < 3; i++) { const c = [(rng() - 0.5) * s, (rng() - 0.5) * s * 0.7]; for (const k of [0.05, 0.09]) ring(g, c[0], c[1], s * k, 'rgba(226,238,242,0.3)', Math.max(0.5, o.ink * 0.5)); }
    return out;
  },
  sacks(g, s, rng, o, pal) {
    // Sacks stacked: two side by side, a third thrown on them.
    const a = rng() * 6.28, out = [];
    for (const [u, v, t, h] of [[-0.36, -0.14, 0.3, 0], [0.34, -0.2, 2.6, 0], [0.02, 0.3, 4.4, 1]]) { const c = [Math.cos(a) * u * s - Math.sin(a) * v * s, Math.sin(a) * u * s + Math.cos(a) * v * s], k = 0.6; for (const ctx of [g, o.maps]) if (ctx) { ctx.save(); ctx.translate(c[0], c[1]); } const [body] = RICH.sack(g, s * k, seeded(960 + Math.round(u * 10) + (rng() * 1000 | 0)), { ...o, sackTurn: a + t, detail: o.detail && !h && u < 0 }, { ...pal, cloth: varied(pal.cloth, rng, 1.6) }); for (const ctx of [g, o.maps]) if (ctx) ctx.restore(); out.push(body.map(([x, y]) => [x + c[0], y + c[1]])); if (h && o.maps) { /* (the one on top stands higher) */ pathOf(o.maps, out[out.length - 1], false); o.maps.fillStyle = mapsColour(0.8, 0.03); o.maps.fill(); } }
    return out;
  },
  strongbox(g, s, rng, o, pal) {
    // A strongbox: a chest bound all over in iron, a hasp and padlock at its front.
    const iron = { ...pal, metal: hexOf(mix(pal.metal, '#33353a', 0.45)) }, wood = { ...iron, wood: hexOf(shade(pal.wood, -0.18)) }, before = seeded(970)(), out = RICH.chest(g, s, rng, o, wood), box = out[0], c = centre(box), a = Math.atan2(box[1][1] - box[0][1], box[1][0] - box[0][0]), p = at(a, c[0], c[1]), L = s * 0.8, D = s * 0.5; void before;
    for (const v of [-0.5, 0.5]) { plate(g, o, boxAt(...p(0, v * D), L * 0.98, D * 0.07, a), iron, 0.7); for (let i = -4; i <= 4; i++) stud(g, o, ...p(i * L * 0.22, v * D), Math.max(0.8, s * 0.014), iron, 0.74); }
    { const lock = boxAt(...p(0, D * 1.02), L * 0.09, D * 0.14, a); under(g, lock, o, 0.3); plate(g, o, lock, pal, 0.5); const k = p(0, D * 1.04); disc(g, k[0], k[1], Math.max(0.8, s * 0.02), '#0c0a0a'); const sh = Array.from({ length: 7 }, (_, i) => { const t = Math.PI + (i / 6) * Math.PI; return p(Math.cos(t) * L * 0.06, D * 0.9 + Math.sin(t) * D * 0.1); }); line(g, sh, 'rgba(8,6,6,0.9)', Math.max(1.4, s * 0.03)); line(g, sh, pal.metal, Math.max(0.8, s * 0.016)); }
    return out;
  },
  cobbles(g, s, rng, o, pal) {
    // A patch of paving: stones fitted close, each a little rounded with wear, earth in the joints, a few gone from its edge.
    const a = rng() * 6.28, p = at(a), out = [], nx = 6, ny = 5, w = (s * 1.7) / nx, h = (s * 1.4) / ny, setts = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1; if (edge && rng() < 0.22) continue; const c = p(-s * 0.85 + (i + 0.5 + (j % 2) * 0.3 - 0.15) * w, -s * 0.7 + (j + 0.5) * h); setts.push([c, blockAt(rng, c[0], c[1], w * 0.47, h * 0.46, a + (rng() - 0.5) * 0.08, w * 0.035), i, j]); }
    // The earth they are bedded in: only under and between them, so a missing stone leaves a gap, not a dark square.
    for (const [c, st] of setts) { pathOf(g, st.map(([x, y]) => [c[0] + (x - c[0]) * 1.14, c[1] + (y - c[1]) * 1.14]), true); g.fillStyle = '#3e342a'; g.fill(); }
    for (const [c, st, i, j] of setts) {
      const col = varied(['#8a867e', '#7e7a72', '#948e84'][Math.floor(rng() * 3)], rng, 1.4), r = Math.max(w, h) * 0.5;
      pathOf(g, st, true); g.fillStyle = col; g.fill();
      g.save(); pathOf(g, st, true); g.clip(); const gr = g.createRadialGradient(c[0], c[1], r * 0.3, c[0], c[1], r * 1.2); gr.addColorStop(0, 'rgba(255,250,240,0.1)'); gr.addColorStop(1, 'rgba(10,8,6,0.4)'); g.fillStyle = gr; g.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
      if (o.fine) fineWork(g, seeded(974 + i * 7 + j), at(0, c[0], c[1]), r, r, { along: false, dark: '20,20,22', pale: '255,255,250', much: 0.8 });
      if (rng() < 0.2) { const t = rng() * 6.283; line(g, [[c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r], [c[0], c[1]]], 'rgba(16,14,12,0.5)', Math.max(0.5, o.ink * 0.6)); }
      g.restore(); softLine(g, st, true, col, o, 1.8); rel(o, st, true, 0.05, 0.12);
      if (!(i % 2) && !(j % 2)) out.push(st);
    }
    return out;
  },
  burrow(g, s, rng, o, pal) {
    // A burrow: a hole going down at a slant, the earth dug out of it thrown in a fan before it.
    const a = rng() * 6.28, p = at(a), SOIL = '#5a4630', fan = [p(-s * 0.2, -s * 0.3), p(s * 0.3, -s * 0.56), p(s * 0.8, -s * 0.3), p(s * 0.86, s * 0.1), p(s * 0.6, s * 0.5), p(s * 0.1, s * 0.5), p(-s * 0.26, s * 0.2)];
    pathOf(g, fan, false); g.fillStyle = SOIL; g.fill();
    g.save(); pathOf(g, fan, false); g.clip(); for (let i = 0; i < 180; i++) { const c = p(-s * 0.3 + rng() * s * 1.2, (rng() - 0.5) * s * 1.1); disc(g, c[0], c[1], Math.max(0.5, s * (0.008 + rng() * 0.018)), rng() < 0.5 ? 'rgba(130,104,70,0.75)' : 'rgba(20,12,6,0.7)'); } { const c = p(s * 0.3, 0), gr = g.createRadialGradient(c[0], c[1], s * 0.1, c[0], c[1], s * 0.7); gr.addColorStop(0, 'rgba(170,140,96,0.25)'); gr.addColorStop(1, 'rgba(10,6,2,0.4)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); } g.restore();
    softLine(g, fan, false, SOIL, o, 1.6); relDome(o, fan, ...p(s * 0.3, 0), s * 0.6, 0.01, 0.08, 0.03);
    const hole = oval(...p(-s * 0.36, 0), s * 0.3, s * 0.24, a, 18); pathOf(g, hole, false); g.fillStyle = '#0c0906'; g.fill(); g.save(); pathOf(g, hole, false); g.clip(); { const c = p(-s * 0.2, 0), gr = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], s * 0.3); gr.addColorStop(0, 'rgba(90,70,46,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); } g.restore(); thinLine(g, hole, false, '#3a2c1c', o, 1); rel(o, hole, false, 0, 0.02);
    if (o.detail) { const dr = seeded(971); for (let i = 0; i < 9; i++) { const t = a + Math.PI + (dr() - 0.5) * 2.6, c = p(-s * 0.36 + Math.cos(t - a) * s * 0.36, Math.sin(t - a) * s * 0.3); bladeAt(g, o, c, t + (dr() - 0.5), s * (0.12 + dr() * 0.1), s * 0.022, varied(o.green, dr, 1.8), (dr() - 0.5), 0.03); } }
    return [hole];
  },
  anthill(g, s, rng, o, pal) {
    // An anthill: a low cone of crumbs of earth, a hole at its top, ants about it.
    const hill = blob(rng, 0, 0, s * 0.74, s * 0.68, 16, 0.12), SOIL = '#6a5236';
    under(g, hill, o, 0.3); pathOf(g, hill, false); g.fillStyle = SOIL; g.fill();
    g.save(); pathOf(g, hill, false); g.clip(); for (let i = 0; i < 420; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.74, c = [Math.cos(t) * d, Math.sin(t) * d]; disc(g, c[0], c[1], Math.max(0.5, s * (0.008 + rng() * 0.016)), rng() < 0.55 ? varied('#8a6c46', rng, 1.6) : 'rgba(26,16,8,0.7)'); } { const gr = g.createRadialGradient(0, 0, s * 0.06, 0, 0, s * 0.74); gr.addColorStop(0, 'rgba(190,160,110,0.3)'); gr.addColorStop(1, 'rgba(14,8,2,0.45)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); } g.restore();
    softLine(g, hill, false, SOIL, o, 1.8); relDome(o, hill, 0, 0, s * 0.74, 0.05, 0.9, 0.03);
    disc(g, 0, 0, s * 0.08, '#120c06'); ring(g, 0, 0, s * 0.08, 'rgba(40,26,12,0.8)', Math.max(0.6, o.ink * 0.7));
    if (o.detail) { const dr = seeded(972); for (let i = 0; i < 22; i++) { const t = dr() < 0.6 ? 0.6 + (dr() - 0.5) * 0.3 : dr() * 6.283, d = s * (0.1 + dr() * 0.8), c = [Math.cos(t) * d, Math.sin(t) * d]; for (const k of [-1, 0, 1]) disc(g, c[0] + Math.cos(t) * k * s * 0.012, c[1] + Math.sin(t) * k * s * 0.012, Math.max(0.6, s * 0.009), '#0e0a08'); } }
    return [hill];
  },
  feathers(g, s, rng, o, pal) {
    // Feathers shed: a quill and its vane, barbs slanting from it, a split or two in the vane.
    const out = [], tones = ['#e6e0d2', '#8a8478', '#6a5236', '#b8b2a6'];
    for (let i = 0; i < 6; i++) { const t = rng() * 6.283, d = Math.sqrt(rng()) * s * 0.5, c = [Math.cos(t) * d, Math.sin(t) * d], k = rng() * 6.283, len = s * (0.36 + rng() * 0.24), w = len * 0.2, q = at(k, c[0] - Math.cos(k) * len * 0.5, c[1] - Math.sin(k) * len * 0.5), col = varied(tones[Math.floor(rng() * tones.length)], rng, 1.2), vane = [q(len * 0.14, 0), q(len * 0.3, -w * 0.8), q(len * 0.7, -w), q(len, 0), q(len * 0.7, w * 0.8), q(len * 0.3, w * 0.7)]; out.push(vane);
      pathOf(g, vane, false); g.fillStyle = col; g.fill(); g.save(); pathOf(g, vane, false); g.clip(); for (let b = 0; b < 12; b++) { const u = len * (0.16 + b * 0.068); for (const e of [-1, 1]) line(g, [q(u, 0), q(u + len * 0.1, e * w)], mix(col, '#0c0904', 0.3), Math.max(0.4, o.ink * 0.4)); } g.restore();
      line(g, [q(0, 0), q(len * 0.98, 0)], mix(col, '#f4ead0', 0.5), Math.max(0.6, o.ink * 0.7)); softLine(g, vane, false, col, o, 1.4); rel(o, vane, false, 0.02, 0.1); }
    return out;
  },
  tracks(g, s, rng, o, pal) {
    // A line of prints pressed into soft ground: a heel pad and four toes each, left and right by turns.
    const a = rng() * 6.28, out = [];
    for (let i = 0; i < 7; i++) { const u = -s * 0.8 + i * s * 0.27, bend = Math.sin(i * 0.6) * s * 0.08, side = i % 2 ? 1 : -1, c = [Math.cos(a) * u - Math.sin(a) * (bend + side * s * 0.1), Math.sin(a) * u + Math.cos(a) * (bend + side * s * 0.1)], q = at(a + side * 0.12 + (rng() - 0.5) * 0.2, c[0], c[1]), r = s * 0.065, pad = oval(...q(0, 0), r, r * 0.8, a, 12); out.push(pad);
      const press = (pts) => { g.save(); g.filter = `blur(${Math.max(0.6, s * 0.008)}px)`; pathOf(g, pts, false); g.fillStyle = 'rgba(24,16,8,0.62)'; g.fill(); g.restore(); pathOf(g, pts, false); g.strokeStyle = 'rgba(255,240,215,0.12)'; g.lineWidth = Math.max(0.4, o.ink * 0.5); g.stroke(); rel(o, pts, false, 0, 0.02); };
      press(pad); for (const [du, dv] of [[1.5, -0.8], [1.9, -0.28], [1.9, 0.28], [1.5, 0.8]]) press(oval(...q(du * r, dv * r), r * 0.36, r * 0.3, a, 8)); }
    return out;
  },
  bloodstain(g, s, rng, o, pal) {
    // Blood long dry: a dark brown stain, drops flung out from it, a smear where something was dragged.
    const a = rng() * 6.28, p = at(a), stain = blob(rng, 0, 0, s * 0.5, s * 0.4, 18, 0.3, a), BLOOD = '#4a1a14';
    { const smear = [p(s * 0.2, -s * 0.12), p(s * 0.86, -s * 0.2), p(s * 0.9, s * 0.02), p(s * 0.2, s * 0.14)]; g.save(); g.filter = `blur(${Math.max(1, s * 0.03)}px)`; pathOf(g, smear, false); g.fillStyle = 'rgba(74,26,20,0.5)'; g.fill(); g.restore(); for (let i = 0; i < 6; i++) { const v = (-0.12 + i * 0.05) * s; line(g, [p(s * 0.3, v), p(s * (0.6 + rng() * 0.28), v * 1.2 - s * 0.04)], 'rgba(60,18,14,0.4)', Math.max(0.6, s * 0.012)); } }
    pathOf(g, stain, false); g.fillStyle = BLOOD; g.fill();
    g.save(); pathOf(g, stain, false); g.clip(); { const gr = g.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.5); gr.addColorStop(0, 'rgba(20,4,2,0.6)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(110,40,24,0.4)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); } if (o.fine) fineWork(g, seeded(973), p, s * 0.5, s * 0.4, { along: false, dark: '14,2,0', pale: '140,60,40', much: 0.8 }); g.restore();
    softLine(g, stain, false, BLOOD, o, 1.6); rel(o, stain, false, 0.01, 0.1);
    for (let i = 0; i < 16; i++) { const t = rng() * 6.283, d = s * (0.5 + rng() * 0.36), r = s * (0.012 + rng() * 0.03), c = [Math.cos(t) * d, Math.sin(t) * d * 0.8], drop = oval(c[0], c[1], r * (1 + rng()), r, t, 8); pathOf(g, drop, false); g.fillStyle = varied(BLOOD, rng, 1); g.fill(); }
    return [stain];
  },
};
/** The pieces painted in the house look (look.finish 'rich'): all of them, standing. */
export const RICH_IDS = Object.freeze(Object.keys(RICH));

/** The kit's pieces as the catalog lists them: id → { id, label, set, size (squares), uses (which materials), states }. */
// The decorations beyond the first thirteen: painted in the house look from the start, so they have no first-finish
// painter; standing only until their states are painted. Sizes and heights as decor-paint.mjs has them, so one can
// stand in for the other.
const MORE = {
  bed: { label: 'Bed', set: 'bedroom', size: 2, height: 0.6, uses: ['wood', 'cloth'] },
  desk: { label: 'Desk', set: 'study', size: 1.6, height: 0.8, uses: ['wood', 'metal', 'cloth'] },
  bookshelf: { label: 'Bookshelf', set: 'study', size: 1.8, height: 1.8, uses: ['wood', 'cloth'] },
  throne: { label: 'Throne', set: 'seating', size: 1.4, height: 1.2, uses: ['wood', 'metal', 'cloth'] },
  bathtub: { label: 'Bathtub', set: 'washing', size: 1.4, height: 0.6, uses: ['wood', 'metal', 'cloth'] },
  weaponRack: { label: 'Weapon rack', set: 'armoury', size: 1.4, height: 1.2, uses: ['wood', 'metal', 'cloth'] },
  washtub: { label: 'Washtub', set: 'washing', size: 1, height: 0.45, uses: ['wood', 'metal', 'cloth'] },
  trough: { label: 'Water trough', set: 'yard', size: 1.8, height: 0.5, uses: ['wood', 'metal'] },
  firewood: { label: 'Firewood stack', set: 'workshop', size: 1.2, height: 0.7, uses: ['wood'] },
  choppingBlock: { label: 'Chopping block', set: 'workshop', size: 1.2, height: 0.45, uses: ['wood', 'metal'] },
  anvil: { label: 'Anvil', set: 'workshop', size: 0.9, height: 0.6, uses: ['wood', 'metal'] },
  cage: { label: 'Cage', set: 'workshop', size: 1.1, height: 1.4, uses: ['metal'] },
  urns: { label: 'Urns', set: 'storage', size: 1.6, height: 0.5, uses: ['cloth'] },
  timbers: { label: 'Collapsed timbers', set: 'workshop', size: 2, height: 0.6, uses: ['wood', 'metal'] },
  cart: { label: 'Cart', set: 'yard', size: 2.6, height: 1, uses: ['wood', 'metal', 'cloth'] },
  mineCart: { label: 'Mine cart', set: 'workshop', size: 1, height: 0.7, uses: ['wood', 'metal'] },
  campfire: { label: 'Old campfire', set: 'fire', size: 0.9, height: 0.1, uses: [] },
  brazier: { label: 'Brazier', set: 'fire', size: 0.8, height: 0.9, uses: ['metal'] },
  hearth: { label: 'Hearth', set: 'fire', size: 1.8, height: 0.5, uses: ['metal'] },
  candles: { label: 'Candles', set: 'fire', size: 0.6, height: 0.25, uses: ['metal'] },
  lampPost: { label: 'Street lamp', set: 'fire', size: 1, height: 2.4, uses: ['metal'] },
  treasure: { label: 'Treasure', set: 'storage', size: 1.3, height: 0.2, uses: ['metal'] },
  pickaxe: { label: 'Dropped tools', set: 'workshop', size: 0.7, height: 0.05, uses: ['wood', 'metal'] },
  bedroll: { label: 'Bedroll', set: 'bedroom', size: 1.3, height: 0.15, uses: ['wood', 'metal', 'cloth'] },
  rug: { label: 'Rug', set: 'bedroom', size: 2.4, height: 0, flat: true, uses: ['cloth'] },
  strawBed: { label: 'Straw bed', set: 'bedroom', size: 1.6, height: 0, flat: true, uses: ['cloth'] },
  well: { label: 'Well', set: 'yard', size: 1.4, height: 0.8, uses: ['wood', 'metal'] },
  haystack: { label: 'Hay bales', set: 'yard', size: 1.2, height: 0.7, uses: [] },
  signpost: { label: 'Signpost', set: 'yard', size: 0.8, height: 1.8, uses: ['wood', 'metal'] },
  hitchingPost: { label: 'Hitching post', set: 'yard', size: 1.4, height: 0.9, uses: ['wood', 'metal'] },
  planter: { label: 'Planter', set: 'yard', size: 1.3, height: 0.5, uses: ['wood', 'metal', 'cloth'] },
  washingLine: { label: 'Washing line', set: 'yard', size: 2.2, height: 1.4, uses: ['wood', 'cloth'] },
  pump: { label: 'Water pump', set: 'yard', size: 0.9, height: 1.1, uses: ['wood', 'metal'] },
  kennel: { label: 'Kennel', set: 'yard', size: 1, height: 0.8, uses: ['wood', 'metal'] },
  tent: { label: 'Tent', set: 'camp', size: 2.4, height: 1.6, uses: ['wood', 'cloth'] },
  marketStall: { label: 'Market stall', set: 'market', size: 2.8, height: 1.4, uses: ['wood', 'cloth'] },
  fence: { label: 'Fence', set: 'yard', size: 2, height: 0.8, run: 0.9, uses: ['wood', 'metal'] },
  stakeFence: { label: 'Stake fence', set: 'yard', size: 2, height: 0.7, run: 0.85, uses: ['wood'] },
  rails: { label: 'Mine rails', set: 'workshop', size: 2, height: 0, flat: true, run: 0.9, uses: ['wood', 'metal'] },
  sarcophagus: { label: 'Sarcophagus', set: 'burial', size: 1.7, height: 0.9, uses: [] },
  coffin: { label: 'Coffin', set: 'burial', size: 1.5, height: 0.5, uses: ['wood', 'metal'] },
  tombstone: { label: 'Gravestone', set: 'burial', size: 1, height: 0.3, uses: ['cloth'] },
  altar: { label: 'Altar', set: 'ritual', size: 1.6, height: 0.9, uses: ['metal', 'cloth'] },
  statue: { label: 'Statue', set: 'ritual', size: 1.4, height: 2, uses: [] },
  brokenPillar: { label: 'Broken pillar', set: 'ruin', size: 1.2, height: 1.2, uses: [] },
  chains: { label: 'Chains', set: 'workshop', size: 0.9, height: 0.05, uses: ['metal'] },
  rowboat: { label: 'Rowboat', set: 'water', size: 2.6, height: 0.5, uses: ['wood', 'metal'] },
  dock: { label: 'Dock section', set: 'water', size: 2, height: 0.3, run: 0.9, uses: ['wood', 'metal'] },
  mooringPost: { label: 'Mooring post', set: 'water', size: 0.9, height: 0.6, uses: ['wood', 'metal'] },
  tableStools: { label: 'Table and stools', set: 'tables', size: 1.8, height: 0.8, uses: ['wood', 'metal'] },
  pottedPlant: { label: 'Potted plant', set: 'yard', size: 0.8, height: 0.7, uses: ['cloth'] },
  produce: { label: 'Produce crate', set: 'market', size: 1, height: 0.45, uses: ['wood', 'metal'] },
  papers: { label: 'Scattered papers', set: 'study', size: 1.1, height: 0, flat: true, uses: [] },
  rubbish: { label: 'Rubbish heap', set: 'ruin', size: 1.6, height: 0.3, uses: ['wood', 'metal', 'cloth'] },
  brokenFurniture: { label: 'Broken furniture', set: 'ruin', size: 1.6, height: 0.4, uses: ['wood', 'cloth'] },
  carcass: { label: 'Carcass', set: 'ruin', size: 1.5, height: 0.35, uses: [] },
  rock: { label: 'Rock', set: 'stone', size: 0.4, height: 0.35, uses: [] },
  boulder: { label: 'Boulder', set: 'stone', size: 1.3, height: 1.2, uses: [] },
  pebbles: { label: 'Pebbles', set: 'stone', size: 0.5, height: 0.06, uses: [] },
  rubble: { label: 'Rubble', set: 'ruin', size: 1.1, height: 0.35, uses: [] },
  bones: { label: 'Bones', set: 'ruin', size: 0.6, height: 0.05, uses: [] },
  boneRubble: { label: 'Bones in rubble', set: 'ruin', size: 1.8, height: 0.35, uses: [] },
  mushrooms: { label: 'Mushrooms', set: 'growing', size: 0.4, height: 0.12, uses: [] },
  log: { label: 'Fallen log', set: 'wood', size: 1.8, height: 0.35, uses: ['wood'] },
  stump: { label: 'Stump', set: 'wood', size: 0.9, height: 0.3, uses: ['wood'] },
  roots: { label: 'Roots', set: 'wood', size: 1.2, height: 0.05, uses: ['wood'] },
  nest: { label: 'Bird nest', set: 'growing', size: 0.6, height: 0.2, uses: [] },
  beehive: { label: 'Beehive', set: 'yard', size: 0.7, height: 0.8, uses: ['wood'] },
  bush: { label: 'Bush', set: 'growing', size: 0.9, height: 0.5, uses: ['cloth'] },
  fern: { label: 'Fern', set: 'growing', size: 0.8, height: 0.3, uses: [] },
  agave: { label: 'Spiky plant', set: 'growing', size: 0.8, height: 0.35, uses: [] },
  reeds: { label: 'Reeds', set: 'water', size: 0.7, height: 0.8, uses: [] },
  cattails: { label: 'Cattails', set: 'water', size: 1, height: 0.8, uses: [] },
  grass: { label: 'Grass tuft', set: 'growing', size: 0.5, height: 0.2, uses: [] },
  flowers: { label: 'Wildflowers', set: 'growing', size: 0.8, height: 0, flat: true, uses: ['cloth'] },
  moss: { label: 'Moss', set: 'growing', size: 1.2, height: 0, flat: true, uses: [] },
  leaves: { label: 'Leaf litter', set: 'growing', size: 1, height: 0, flat: true, uses: [] },
  lilyPads: { label: 'Lily pads', set: 'water', size: 1.2, height: 0, flat: true, uses: [] },
  fairyRing: { label: 'Mushroom ring', set: 'growing', size: 1.6, height: 0.06, uses: [] },
  lichen: { label: 'Lichen', set: 'stone', size: 1, height: 0, flat: true, uses: [] },
  crystals: { label: 'Crystals', set: 'cave', size: 0.6, height: 0.6, uses: [] },
  stalagmite: { label: 'Stalagmite', set: 'cave', size: 0.7, height: 1.1, uses: [] },
  column: { label: 'Rock column', set: 'cave', size: 1.4, height: 3, uses: [] },
  cavePool: { label: 'Cave pool', set: 'cave', size: 1.3, height: 0, flat: true, uses: [] },
  glowShrooms: { label: 'Glowing mushrooms', set: 'cave', size: 0.6, height: 0.15, uses: [] },
  cobweb: { label: 'Cobweb', set: 'cave', size: 1, height: 0, flat: true, uses: [] },
  hangingRoots: { label: 'Hanging roots', set: 'cave', size: 1.8, height: 0.1, uses: ['wood'] },
  timberProps: { label: 'Timber props', set: 'cave', size: 1.2, height: 2.2, uses: ['wood', 'metal'] },
  lavaCrack: { label: 'Lava crack', set: 'cave', size: 1.6, height: 0, flat: true, uses: [] },
  oreVein: { label: 'Ore vein', set: 'cave', size: 1.2, height: 0, flat: true, uses: ['metal'] },
  dripSpot: { label: 'Drip spot', set: 'cave', size: 0.6, height: 0, flat: true, uses: [] },
  fissure: { label: 'Fissure', set: 'cave', size: 1.6, height: 0, flat: true, uses: [] },
  puddle: { label: 'Puddle', set: 'water', size: 1.1, height: 0, flat: true, uses: [] },
  streamRock: { label: 'Stream rock', set: 'water', size: 1.8, height: 0.4, uses: [] },
  steppingStones: { label: 'Stepping stones', set: 'water', size: 2.6, height: 0.1, run: 0.9, uses: [] },
  waterDebris: { label: 'Floating debris', set: 'water', size: 1.2, height: 0, flat: true, uses: ['wood'] },
  sacks: { label: 'Sacks', set: 'storage', size: 1.4, height: 0.5, uses: ['cloth'] },
  strongbox: { label: 'Strongbox', set: 'storage', size: 1.4, height: 0.6, uses: ['wood', 'metal'] },
  cobbles: { label: 'Paving', set: 'stone', size: 1.4, height: 0, flat: true, uses: [] },
  burrow: { label: 'Burrow', set: 'growing', size: 0.9, height: 0, flat: true, uses: [] },
  anthill: { label: 'Anthill', set: 'growing', size: 0.8, height: 0.25, uses: [] },
  feathers: { label: 'Feathers', set: 'growing', size: 0.6, height: 0, flat: true, uses: [] },
  tracks: { label: 'Tracks', set: 'growing', size: 1.4, height: 0, flat: true, uses: [] },
  bloodstain: { label: 'Old bloodstain', set: 'ruin', size: 1.2, height: 0, flat: true, uses: [] },
};
for (const k of Object.values(MORE)) k.states = ['standing'];
// How tall each stands, in squares: what the engines cast its shadow by.
const HEIGHTS = { barrel: 0.6, crate: 0.55, chest: 0.45, sack: 0.3, basket: 0.3, bucket: 0.3, chair: 0.55, stool: 0.35, bench: 0.45, armchair: 0.6, roundTable: 0.5, longTable: 0.5, counter: 0.9 };
export const KIT_PIECES = Object.freeze(Object.fromEntries(Object.entries({ ...KIT, ...MORE }).map(([id, k]) => [id, Object.freeze({ id, label: k.label, set: k.set, size: k.size, height: HEIGHTS[id] ?? k.height ?? 0.5, uses: Object.freeze([...k.uses]), states: Object.freeze([...k.states]), flat: !!(k.flat ?? DECOR_KINDS[id]?.flat), run: k.run ?? null, light: DECOR_KINDS[id]?.light ?? null, glow: DECOR_KINDS[id]?.glow ?? null, cloth: DECOR_KINDS[id]?.cloth ?? false, water: DECOR_KINDS[id]?.water ?? null })])));
export const KIT_IDS = Object.freeze(Object.keys({ ...KIT, ...MORE }));

/**
 * Paints one piece. `px` its picture's side in pixels, `look` { wood, metal, cloth, state, wear, vary, ink }, `make`
 * (w, h) → a canvas. Returns { canvas, outlines } or null. The seed decides its small differences: where its grain
 * falls, how its colours sit off the palette's, which way it is turned a little.
 */
export function paintKitPiece(id, seed, px, look = {}, make = (w, h) => (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(globalThis.document.createElement('canvas'), { width: w, height: h }))) {
  const k = KIT[id] ?? MORE[id]; if (!k) return null;
  if (!k.paint) look = { ...look, finish: 'rich' };
  const size = Math.max(8, Math.ceil(px)), pad = Math.ceil(size * 0.14), w = size + pad * 2, canvas = make(w, w), g = canvas.getContext('2d'), rng = seeded(seed);
  const state = k.states.includes(look.state) ? look.state : 'standing', unit = look.unit ?? size / k.size;
  // (Warm colour, painted form and the crisp thin line were tried one by one and all kept — Roi: "all three" — and the fine
  // work after them — "Yes, keep it" — so a rich piece is painted with all four unless one is turned off.)
  if (look.finish === 'rich') look = { warm: true, form: true, line: true, fine: true, depth: true, ...look };
  const old = DECOR_KINDS[id] ?? null;
  const o = { season: 'summer', snow: 0, wet: 0, ...look, state, unit, ink: look.ink ?? Math.max(1, unit / 60) };
  // (The colours first, so a piece keeps its colours whatever else of it changes with its state.)
  const pal = paletteOf(look, seeded((seed >>> 0) * 31 + 7));
  g.translate(w / 2, w / 2);
  const rich = look.finish === 'rich' && state === 'standing' && !!RICH[id];
  // The second picture (rich pieces only): heights in red, shine in green, painted sharp and then softened so that
  // every edge in it is a slope the light can fall across.
  let raw = null; if (rich) { raw = make(w, w); o.maps = raw.getContext('2d'); o.maps.translate(w / 2, w / 2); }
  o.green = inSeason(o, GREEN);
  // Cloth the wind moves (a tent, an awning, washing, papers) marks where it is, as decor-paint's painters do.
  let mask = null; if (rich && old?.cloth) { mask = make(w, w); o.clothMask = mask.getContext('2d'); o.clothMask.translate(w / 2, w / 2); }
  const outlines = (rich ? RICH[id] : k.paint)(g, size / 2, rng, o, pal);
  // Deeper darks (o.depth): beside a hand-painted piece at the same size, ours sat in a narrow band of middle tones.
  // The picture laid softly over itself pulls its darks down and its lights up.
  if (rich && o.depth) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55; g.drawImage(canvas, 0, 0); g.restore(); }
  if (rich) {
    // Rain: everything but water goes darker while wet, and dries back (as paintDecor does for the old painters).
    if (o.wet > 0 && !old?.water) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(10,14,18,${0.3 * Math.min(1, o.wet)})`; g.fillRect(0, 0, w, w); g.restore(); }
    // Snow: lying in patches on whatever is there, more of them the more it has snowed. (In the map the snow layer
    // lays its own over standing things and this is asked for none; this is for where there is no such layer.)
    if (o.snow > 0) { const sr = seeded((seed >>> 0) * 13 + 5), sn = Math.min(1, o.snow); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(196,212,226,${0.2 * sn})`; g.fillRect(0, 0, w, w); g.filter = `blur(${Math.max(1, w * 0.012)}px)`; for (let i = 0, n = Math.round(10 + 70 * sn); i < n; i++) { g.fillStyle = `rgba(242,247,251,${0.5 + 0.4 * sn})`; g.beginPath(); g.ellipse(sr() * w, sr() * w, w * (0.03 + sr() * 0.07), w * (0.02 + sr() * 0.05), sr() * 3, 0, 6.283); g.fill(); } g.filter = 'none'; g.restore(); }
  }
  let maps = null; if (raw) { maps = make(w, w); const m = maps.getContext('2d'); m.filter = `blur(${Math.max(0.8, unit * 0.007)}px)`; m.drawImage(raw, 0, 0); m.filter = 'none'; }
  // Its outline filled, for the shadows the engines cast of it (as decor-paint's paintDecor gives every decoration).
  const shadow = make(w, w), sh = shadow.getContext('2d'); sh.translate(w / 2, w / 2); sh.fillStyle = '#fff';
  for (const pts of outlines ?? []) { pathOf(sh, pts, true); sh.fill(); }
  // The cloth's mask, eaten back from its edges and softened, as paintDecor makes it.
  let cloth = null; if (mask) { cloth = make(w, w); const c = cloth.getContext('2d'), soft = Math.max(1, w * 0.03); c.filter = `blur(${soft}px)`; c.drawImage(mask, 0, 0); c.filter = 'none'; c.globalCompositeOperation = 'destination-in'; c.filter = `blur(${soft}px)`; c.drawImage(mask, 0, 0); c.filter = 'none'; }
  return { canvas, outlines, palette: pal, maps, shadow, cloth, width: w, height: HEIGHTS[id] ?? k.height ?? 0.5 };
}

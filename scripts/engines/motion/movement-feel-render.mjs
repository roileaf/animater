// Movement feel drawing: small PIXI Graphics (soft discs, chips, blades, glints, cracks, footprints) on the floor under
// the tokens, never documents. Each particle is drawn once at a fixed size and then only moved, scaled, turned and
// faded; a flier's shadow is its art's soft silhouette laid on the floor (flier-silhouette.mjs), else a stack of faint
// ellipses, no blur.
// `root()` returns (and makes, when needed) the container on the viewed level's floor.
import { kickArt, shadowArt } from './kick-art.mjs';
import { createSilhouettes, silhouettePose, silhouetteScale, silhouetteSize, isMoving, SHARP_BLUR, SOFT_BLUR } from './flier-silhouette.mjs';

const DRAW = 100;
const SHADOW_RINGS = 14;

function drawSoftDisc(g, color, rings = 3) {
  // Concentric fills fake a soft edge: the centre is denser than the rim.
  for (let i = rings; i >= 1; i--) {
    g.beginFill(color, 1 / rings);
    g.drawCircle(0, 0, (DRAW / 2) * (i / rings));
    g.endFill();
  }
}

const R = DRAW / 2;
function drawSoftEllipse(g, color, rx, ry, rings = 2, cx = 0) {
  for (let i = rings; i >= 1; i--) {
    g.beginFill(color, 1 / rings);
    g.drawEllipse(cx, 0, rx * (0.6 + 0.4 * (i / rings)), ry * (0.6 + 0.4 * (i / rings)));
    g.endFill();
  }
}
const fillPolygon = (g, color, points, alpha = 1) => { g.beginFill(color, alpha); g.drawPolygon(points); g.endFill(); };
// A colour scaled toward black (k < 1) or brighter (k > 1).
const shade = (color, k) => {
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((color >> s) & 255) * k)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
// A trample patch's streaks when its spec carries none.
const TRAMPLED = [[-0.4, -0.3, 0.6, 0.1, 0], [0.1, 0.25, 0.7, -0.15, 0], [0.4, -0.1, 0.55, 0.05, 1], [-0.2, 0.35, 0.5, 0.2, 0], [0.25, -0.4, 0.6, -0.1, 1]];
// Every shape is drawn once in a DRAW-wide box around (0, 0), pointing along +x (the heading) where it has a direction.
const SHAPES = {
  ring(g, spec) { g.lineStyle(DRAW * 0.05, spec.color, 1); g.drawCircle(0, 0, R); },
  puff(g, spec) { drawSoftDisc(g, spec.color, 3); },
  // Smoke: many faint rings with a square-root falloff, so the puff has a feathered edge and no visible bands.
  smoke(g, spec) {
    // Seven rings look the same as twelve at smoke's size and alpha, at little more than half the drawing.
    for (let i = 7; i >= 1; i--) {
      g.beginFill(spec.color, 1 / 7);
      g.drawCircle(0, 0, (DRAW / 2) * Math.sqrt(i / 7));
      g.endFill();
    }
  },
  drop(g, spec) { drawSoftDisc(g, spec.color, 3); },
  scuff(g, spec) { drawSoftDisc(g, spec.color, 2); },
  // A hard grit chip: an uneven four-sided stone.
  chip(g, spec) { fillPolygon(g, spec.color, [-R, -0.5 * R, 0.7 * R, -0.85 * R, R, 0.45 * R, -0.35 * R, 0.9 * R]); },
  // A sawdust fleck: a soft little sliver.
  fleck(g, spec) { drawSoftEllipse(g, spec.color, R, 0.42 * R); },
  // A grass blade: a tapered sliver, bright with a dark outline (about a pixel at normal zoom) so it reads on grass.
  blade(g, spec) {
    g.lineStyle(DRAW * 0.1, spec.edge ?? shade(spec.color, 0.4), 1);
    fillPolygon(g, spec.color, [-R, -0.12 * R, -0.15 * R, -0.28 * R, R, 0, -0.15 * R, 0.26 * R, -R, 0.12 * R]);
    g.lineStyle(0);
  },
  // A tuft: five outlined blades fanning up from its foot (about twice its radius tall), so turning it bends the whole
  // tuft about the root.
  tuft(g, spec) {
    g.lineStyle(DRAW * 0.02, spec.edge ?? shade(spec.color, 0.4), 0.7);
    for (const a of [-0.75, -0.38, 0, 0.38, 0.75]) {
      const h = 1.85 * R * (1 - 0.18 * Math.abs(a)), tx = Math.sin(a) * h, ty = -Math.cos(a) * h, bx = a * 0.3 * R;
      fillPolygon(g, spec.color, [bx - 0.13 * R, 0, (bx + tx) / 2 - 0.08 * R, ty / 2, tx, ty, (bx + tx) / 2 + 0.08 * R, ty / 2, bx + 0.13 * R, 0]);
    }
    g.lineStyle(0);
  },
  // Trampled grass: a faint flattened patch with blades pressed flat along +x (the heading), most dark, a few catching
  // the light (the spec's seeded streaks [x, y, length, tilt, light] in unit space).
  trample(g, spec) {
    const light = spec.light ?? shade(spec.color, 1.8);
    g.beginFill(spec.color, 0.35); g.drawEllipse(0, 0, R, 0.62 * R); g.endFill();
    for (const [x, y, length, tilt, lit] of spec.blades?.length ? spec.blades : TRAMPLED) {
      const cx = x * R * 0.8, cy = y * R * 0.55, l = length * R * 0.5, w = 0.09 * R, c = Math.cos(tilt), s = Math.sin(tilt);
      fillPolygon(g, lit ? light : spec.color, [cx - c * l - s * w, cy - s * l + c * w, cx + c * l, cy + s * l, cx - c * l + s * w, cy - s * l - c * w], lit ? 0.9 : 1);
    }
  },
  // Spray and skids: a long, thin, soft streak.
  streak(g, spec) { drawSoftEllipse(g, spec.color, R, 0.16 * R); },
  // A glint: a four-pointed star with a bright core.
  spark(g, spec) {
    const k = 0.18 * R;
    fillPolygon(g, spec.color, [0, -R, k, -k, R, 0, k, k, 0, R, -k, k, -R, 0, -k, -k]);
    g.beginFill(0xffffff, 1); g.drawCircle(0, 0, 0.16 * R); g.endFill();
  },
  // A hairline crack along the spec's seeded polylines (unit space).
  crack(g, spec) {
    g.lineStyle(DRAW * 0.035, spec.color, 1);
    for (const line of spec.points ?? []) {
      if (!(line?.length >= 4)) continue;
      g.moveTo(line[0] * R, line[1] * R);
      for (let i = 2; i + 1 < line.length; i += 2) g.lineTo(line[i] * R, line[i + 1] * R);
    }
  },
  // A splatter blob: a dense disc with a small flung droplet beside it.
  blob(g, spec) {
    drawSoftDisc(g, spec.color, 2);
    g.beginFill(spec.color, 0.9); g.drawCircle(0.75 * R, -0.45 * R, 0.24 * R); g.endFill();
  },
  // A footprint in the creature's own shape (its gait), toe along +x.
  print(g, spec) { drawPrint(g, spec.gait, spec.color, spec.mirror === true); },
  // A burrower's churned earth along +x: a low soft ridge with its seeded lumps (unit space) heaped on it, each lump
  // with a darker hollow beside it, so it reads as crumbly turned soil.
  // A burrow's mouth: a dark pit (deepest at its heart) ringed by lumps of loose earth, each with a soft shadow.
  hole(g, spec) {
    for (const [x, y, r] of spec.rim ?? []) {
      g.beginFill(spec.rimColor ?? 0x4a3522, 0.95); g.drawCircle(x * 0.8 * R, y * 0.8 * R, r * R); g.endFill();
      g.beginFill(0x000000, 0.2); g.drawCircle(x * 0.8 * R + 0.2 * r * R, y * 0.8 * R + 0.3 * r * R, 0.6 * r * R); g.endFill();
    }
    g.beginFill(spec.color, 0.75); g.drawEllipse(0, 0, 0.78 * R, 0.66 * R); g.endFill();
    g.beginFill(0x000000, 0.55); g.drawEllipse(0.04 * R, 0.06 * R, 0.5 * R, 0.42 * R); g.endFill();
  },
  mound(g, spec) {
    const ry = (spec.ry ?? 0.4) * R;
    drawSoftEllipse(g, spec.color, R, ry, 3);
    for (const [x, y, r] of spec.lumps ?? []) {
      g.beginFill(spec.color, 0.9); g.drawCircle(x * R, y * ry * 1.6, r * ry); g.endFill();
      g.beginFill(0x000000, 0.18); g.drawCircle(x * R + 0.25 * r * ry, y * ry * 1.6 + 0.35 * r * ry, 0.6 * r * ry); g.endFill();
    }
  },
  // One arm of a swimmer's wake: a thin rippled line out along +x from its root, fading toward its tip.
  wake(g, spec) {
    for (let i = 0; i < 8; i++) {
      const x0 = (2 * R * i) / 8, x1 = (2 * R * (i + 1)) / 8;
      g.lineStyle(DRAW * 0.035 * (1 - i / 10), spec.color, 1 - i / 9);
      g.moveTo(x0, Math.sin(i * 1.3) * 0.05 * R);
      g.lineTo(x1, Math.sin((i + 1) * 1.3) * 0.05 * R);
    }
    g.lineStyle(0);
  },
  // A continuous track segment along +x: a snake's wavy groove, an ooze's smear or a lizard's tail drag.
  groove(g, spec) {
    if (spec.gait === 'ooze') { drawSoftEllipse(g, spec.color, R, (spec.ry ?? 0.5) * R, 3); return; }
    const amp = (spec.amp ?? 0.3) * R, flip = spec.flip ?? 1;
    g.lineStyle(Math.max(1, (spec.thick ?? 0.1) * R), spec.color, 1);
    // Half a wave per stride, flipped every stride, so the segments join into one S-curve.
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = -R + 2 * R * t, y = flip * amp * Math.sin(Math.PI * t);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.lineStyle(0);
  },
};
// What a print is being drawn in, and which foot: a left foot is the right one's mirror.
let printInk = 0xffffff, printFlip = 1;
// A closed, smooth shape through points given in R units.
const smooth = (g, pts) => { const n = pts.length, mid = (a, b) => [((a[0] + b[0]) * R) / 2, ((a[1] + b[1]) * R * printFlip) / 2], s = mid(pts[n - 1], pts[0]); g.beginFill(printInk, 1); g.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0] * R, pts[i][1] * R * printFlip, m[0], m[1]); } g.endFill(); };
const oval = (g, x, y, rx, ry, turn = 0) => { const c = Math.cos(turn), s = Math.sin(turn); smooth(g, Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5, px = Math.cos(a) * rx, py = Math.sin(a) * ry; return [x + px * c - py * s, y + px * s + py * c]; })); };
// A finger from a base along an angle: knobbly at its joints, thinning, ending in a claw that hooks to one side (`gap`: a claw mark standing clear of it).
const finger = (g, x, y, angle, len, wide, { claw = 0, hook = 0.25, knobs = 2, gap = 0 } = {}) => {
  const c = Math.cos(angle), s = Math.sin(angle), at = (d, o) => [x + c * d - s * o, y + s * d + c * o], one = [], two = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, w = wide * (1 - 0.42 * t) * (1 + 0.14 * Math.sin(t * Math.PI * 2 * knobs)); one.push(at(t * len, w)); two.unshift(at(t * len, -w)); }
  smooth(g, [...one, ...two]);
  if (!claw) return;
  const d0 = len + gap, w = wide * 0.5, tip = at(d0 + claw, hook * claw), midA = at(d0 + claw * 0.55, w * 0.55 + hook * claw * 0.3), midB = at(d0 + claw * 0.55, -w * 0.3 + hook * claw * 0.4), a = at(d0 - 0.02, w), b = at(d0 - 0.02, -w), to = ([px, py]) => [px * R, py * R * printFlip];
  g.beginFill(printInk, 1); g.moveTo(...to(a)); g.quadraticCurveTo(...to(midA), ...to(tip)); g.quadraticCurveTo(...to(midB), ...to(b)); g.endFill();
};
// One footprint per print shape (a gait's own, or creature-gait.mjs printShape's), each drawn once into the DRAW box: along +x, its
// outer side +y (a right foot). Drawn from what real tracks show: toe counts and proportions, claws or none, which pads leave a mark.
const PRINTS = {
  // Sole with a broad ball and a pinched waist, a separate heel with a gap between them; the big toe side is fuller.
  boots(g) { smooth(g, [[-0.08, -0.3], [0.2, -0.42], [0.55, -0.45], [0.88, -0.32], [0.98, -0.05], [0.84, 0.22], [0.55, 0.36], [0.22, 0.3], [-0.08, 0.2], [-0.14, -0.05]]); smooth(g, [[-0.34, -0.26], [-0.34, 0.2], [-0.62, 0.3], [-0.92, 0.24], [-1.02, -0.02], [-0.92, -0.26], [-0.62, -0.32]]); },
  // Three long toes (the middle longest), each with its row of pads and a claw mark standing clear; a short spur behind; hardly any heel.
  talons(g) { finger(g, -0.12, 0, -0.62, 0.72, 0.1, { claw: 0.2, knobs: 2, gap: 0.03 }); finger(g, -0.12, 0, 0.02, 0.92, 0.11, { claw: 0.22, knobs: 3, gap: 0.03 }); finger(g, -0.12, 0, 0.6, 0.66, 0.1, { claw: 0.2, knobs: 2, gap: 0.03, hook: -0.25 }); finger(g, -0.12, 0, Math.PI + 0.05, 0.42, 0.09, { claw: 0.2, knobs: 1, gap: 0.03 }); },
  // A heavy palm, three long knobbled digits (the middle longest), a thumb set wide and low, every claw long and hooked.
  dragon(g) { smooth(g, [[-0.82, -0.08], [-0.72, -0.42], [-0.42, -0.56], [-0.08, -0.5], [0.12, -0.26], [0.16, 0.08], [0.1, 0.32], [-0.14, 0.52], [-0.48, 0.58], [-0.74, 0.34]]); finger(g, -0.1, -0.3, -0.58, 0.6, 0.17, { claw: 0.32, hook: -0.2 }); finger(g, 0.02, -0.04, -0.06, 0.74, 0.18, { claw: 0.34, hook: 0.2 }); finger(g, -0.02, 0.22, 0.44, 0.62, 0.17, { claw: 0.32, hook: 0.2 }); finger(g, -0.36, 0.46, 1.2, 0.3, 0.13, { claw: 0.26, hook: 0.3, knobs: 1 }); },
  // A small palm and five slender splayed toes, the fourth longest, all clawed.
  claws(g) { smooth(g, [[-0.68, -0.14], [-0.48, -0.36], [-0.16, -0.3], [0, -0.05], [-0.04, 0.22], [-0.3, 0.38], [-0.58, 0.26]]); finger(g, -0.2, -0.26, -1.0, 0.34, 0.08, { claw: 0.16, knobs: 1 }); finger(g, -0.1, -0.16, -0.5, 0.56, 0.08, { claw: 0.17 }); finger(g, -0.04, 0, -0.08, 0.72, 0.085, { claw: 0.18 }); finger(g, -0.08, 0.12, 0.3, 0.82, 0.085, { claw: 0.18 }); finger(g, -0.26, 0.3, 1.0, 0.46, 0.08, { claw: 0.17, knobs: 1 }); },
  // A dog's: a triangular pad, two toes ahead and two outer ones further back, small claw nicks ahead of each.
  paws(g) { smooth(g, [[-0.72, -0.36], [-0.42, -0.42], [-0.08, -0.14], [-0.08, 0.14], [-0.42, 0.42], [-0.72, 0.36], [-0.62, 0]]); for (const [x, y, t] of [[0.36, -0.18, -0.08], [0.36, 0.18, 0.08], [0.0, -0.52, -0.38], [0.0, 0.52, 0.38]]) { oval(g, x, y, 0.27, 0.15, t); const c = Math.cos(t), s = Math.sin(t); oval(g, x + c * 0.4, y + s * 0.4, 0.07, 0.035, t); } },
  // A cat's: a broad three-lobed pad, round toes, no claws, one toe leading.
  cat(g) { smooth(g, [[-0.8, -0.32], [-0.62, -0.14], [-0.82, 0], [-0.62, 0.14], [-0.8, 0.32], [-0.52, 0.5], [-0.14, 0.32], [-0.06, 0], [-0.14, -0.32], [-0.52, -0.5]]); for (const [x, y, t] of [[0.42, -0.14, -0.05], [0.3, 0.24, 0.1], [0.04, -0.54, -0.35], [0.0, 0.58, 0.35]]) oval(g, x, y, 0.24, 0.17, t); },
  // A wide round pad with blunt toenails along its front edge.
  padded(g) { oval(g, -0.08, 0, 0.72, 0.78); for (const a of [-0.8, -0.28, 0.28, 0.8]) oval(g, Math.cos(a) * 0.9, Math.sin(a) * 0.96, 0.08, 0.16, a); },
  // Long splayed toes with bulbs at their tips and a scalloped web between them.
  webbed(g) { smooth(g, [[-0.5, 0], [-0.1, -0.42], [0.28, -0.48], [0.3, -0.2], [0.56, -0.12], [0.5, 0.14], [0.3, 0.2], [0.28, 0.48], [-0.1, 0.42]]); for (const [a, l] of [[-0.8, 0.86], [-0.05, 1.08], [0.72, 0.9]]) { finger(g, -0.3, 0, a, l, 0.075, { knobs: 1 }); oval(g, -0.3 + Math.cos(a) * l, Math.sin(a) * l, 0.09, 0.09); } },
  // A horse's: just the round wall, open at the back.
  hooves(g) { const wall = []; for (let i = 0; i <= 12; i++) { const a = -2.35 + (4.7 * i) / 12; wall.push([Math.cos(a) * 0.86, Math.sin(a) * 0.8]); } for (let i = 12; i >= 0; i--) { const a = -2.35 + (4.7 * i) / 12; wall.push([Math.cos(a) * 0.58, Math.sin(a) * 0.54]); } smooth(g, wall); },
  // Cloven: two teardrop halves with a gap down the middle, their points forward (a deer, a bull, a goat).
  cloven(g) { smooth(g, [[-0.6, -0.56], [-0.2, -0.62], [0.4, -0.44], [0.92, -0.12], [0.3, -0.1], [-0.3, -0.1], [-0.62, -0.2]]); smooth(g, [[-0.6, 0.56], [-0.2, 0.62], [0.4, 0.44], [0.92, 0.12], [0.3, 0.1], [-0.3, 0.1], [-0.62, 0.2]]); oval(g, -0.9, -0.32, 0.07, 0.07); oval(g, -0.9, 0.32, 0.07, 0.07); },
  // A knot with root tendrils, each bending once and thinning.
  roots(g) { oval(g, 0, 0, 0.3, 0.27); for (const [a, l, w] of [[-0.55, 0.85, 0.09], [0.05, 0.95, 0.1], [0.62, 0.8, 0.09], [Math.PI - 0.4, 0.55, 0.08], [Math.PI + 0.45, 0.5, 0.08]]) { const c = Math.cos(a), s = Math.sin(a), bend = 0.09 * (a > 0 ? 1 : -1); finger(g, 0, 0, a, l * 0.5, w, { knobs: 0 }); finger(g, c * l * 0.46, s * l * 0.46, a + bend * 3, l * 0.56, w * 0.62, { knobs: 0 }); } },
  // Many legs: small pointed jabs in two rows, each slanting back from the body.
  legs(g) { for (const x of [-0.6, 0, 0.6]) for (const side of [-1, 1]) { const a = side * (Math.PI / 2 + 0.5); finger(g, x + 0.08, side * 0.4, a, 0.3, 0.075, { knobs: 0 }); } },
  // A fallen leaf along +x: a pointed blade with a darker midrib and a short stem.
  leaf(g, color) {
    g.beginFill(color, 1);
    g.moveTo(-0.85 * R, 0);
    g.quadraticCurveTo(0, -0.62 * R, 0.95 * R, 0);
    g.quadraticCurveTo(0, 0.62 * R, -0.85 * R, 0);
    g.endFill();
    const dark = [16, 8, 0].reduce((n, sh) => n | (Math.round(((color >> sh) & 255) * 0.55) << sh), 0);
    g.lineStyle(0.07 * R, dark, 0.9); g.moveTo(-0.85 * R, 0); g.lineTo(0.8 * R, 0);
    g.lineStyle(0.06 * R, dark, 0.9); g.moveTo(-0.85 * R, 0); g.lineTo(-1.1 * R, 0.08 * R);
    g.lineStyle(0);
  },
};
const drawPrint = (g, shape, color, mirror = false) => { printInk = color; printFlip = mirror ? -1 : 1; try { (PRINTS[shape] ?? PRINTS.boots)(g, color); } finally { printInk = 0xffffff; printFlip = 1; } };

// `sunlit()`: the sunlit floor (wall-shadows.mjs: { texture, x, y, scale }, null with no wall shading it), the mask the
// sun's shadows lie under, so a floor a wall already shades from the sun never darkens twice.
// A footprint pressed into snow, mud or sand: the print's own shape (its gait's, PRINTS) made a hollow, shaded by a light from
// the upper left (dark on the side toward it, lit on the far wall) with a little ridge of pushed-up ground round it;
// `hollow` the floor. Or a wet print (`wet`): the shape as a patchy dark stain. Made once a gait, floor and direction
// (sixteen), as a picture `N` px wide standing for HOLLOW_SPAN of the DRAW box.
const HOLLOW_N = 96, HOLLOW_SPAN = 1.3;
const HOLLOW_LOOK = {
  snow: { tint: [78, 92, 118], glint: [255, 255, 255], deep: 0.5, rim: 0.75, ridge: 0.35 },
  mud: { tint: [30, 20, 10], glint: [190, 170, 140], deep: 0.7, rim: 0.45, ridge: 0.55 },
  sand: { tint: [92, 68, 38], glint: [250, 236, 200], deep: 0.55, rim: 0.5, ridge: 0.45 },
};
const blurred = (src, n, radius) => {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, c = 0; for (let k = -radius; k <= radius; k++) { const xx = x + k; if (xx < 0 || xx >= n) continue; s += src[y * n + xx]; c++; } tmp[y * n + x] = s / c; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, c = 0; for (let k = -radius; k <= radius; k++) { const yy = y + k; if (yy < 0 || yy >= n) continue; s += tmp[yy * n + x]; c++; } out[y * n + x] = s / c; }
  return out;
};
const hash01 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function hollowPixels(mask, n, { look = 'snow', turn = 0, wet = false } = {}) {
  const m1 = blurred(mask, n, 1), m2 = blurred(mask, n, 4), px = new Uint8ClampedArray(n * n * 4);
  if (wet) {
    // A wet stain: the shape a little ragged at its edge, dark, never quite even.
    for (let i = 0; i < n * n; i++) { const x = i % n, y = (i - x) / n, rag = (hash01(Math.floor(x / 3), Math.floor(y / 3)) - 0.5) * 0.35, a = Math.max(0, Math.min(1, (m1[i] + rag - 0.25) / 0.35));
      px[i * 4] = 12; px[i * 4 + 1] = 14; px[i * 4 + 2] = 20; px[i * 4 + 3] = a * 255; }
    return px;
  }
  const L0 = HOLLOW_LOOK[look] ?? HOLLOW_LOOK.snow, c = Math.cos(-turn), s = Math.sin(-turn), lw = [-0.55, -0.45, 0.7];
  const L = [lw[0] * c - lw[1] * s, lw[0] * s + lw[1] * c, lw[2]], Ln = Math.hypot(...L);
  const h = new Float32Array(n * n); for (let i = 0; i < n * n; i++) h[i] = -m1[i] * 1.3 + L0.ridge * Math.max(0, m2[i] - m1[i]) * 2.5;
  const at = (x, y) => h[Math.max(0, Math.min(n - 1, y)) * n + Math.max(0, Math.min(n - 1, x))];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, nx = -(at(x + 1, y) - at(x - 1, y)) * 4, ny = -(at(x, y + 1) - at(x, y - 1)) * 4, nn = Math.hypot(nx, ny, 1);
    const lit = (nx * L[0] + ny * L[1] + L[2]) / (nn * Ln) - L[2] / Ln;
    const dark = Math.min(1, Math.max(0, -lit) * 1.6 + (m1[i] > 0.5 ? 0.15 * m1[i] : 0)), bright = Math.min(1, Math.max(0, lit) * 1.5);
    const a = Math.max(dark * L0.deep, bright * L0.rim), col = dark * L0.deep >= bright * L0.rim ? L0.tint : L0.glint;
    px[i * 4] = col[0]; px[i * 4 + 1] = col[1]; px[i * 4 + 2] = col[2]; px[i * 4 + 3] = a * 255;
  }
  return px;
}

export function createMovementFeelLayer({ PIXI, root, overRoot = null, silhouettes: given = null, sunlit: sunlitOf = null, renderer = null }) {
  const live = new Set();
  const add = (g, to = root) => { g.eventMode = 'none'; to().addChild(g); live.add(g); return g; };
  const shadowEllipse = () => {
    const g = new PIXI.Graphics();
    // Many faint rings stack into a smooth falloff (dense heart, feathered rim) with no visible bands.
    for (let i = SHADOW_RINGS; i >= 1; i--) {
      const r = (DRAW / 2) * (0.2 + 0.8 * Math.sqrt(i / SHADOW_RINGS));
      g.beginFill(0x000000, 0.1);
      g.drawEllipse(0, 0, r, r);
      g.endFill();
    }
    return g;
  };
  const remove = (g) => { live.delete(g); if (g.__animaterShadow) remove(g.__animaterShadow); try { g.destroy(); } catch { /* already gone */ } };
  // A painted bit: one of kick-art.mjs's pictures, shared, every bit a sprite of it (with its shadow, on the floor under
  // it, in its own shape). They batch into one draw where a vector shape each would cost far more.
  const artTextures = new Map();
  const artTexture = (family, n) => {
    const canvas = kickArt(family, n); if (!canvas) return null;
    let tex = artTextures.get(canvas);
    if (!tex || tex.baseTexture?.destroyed) artTextures.set(canvas, tex = PIXI.Texture.from(canvas));
    return tex;
  };
  let bitShadowCanvas = null, bitShadowTex = null;
  const bitShadow = () => { if (!bitShadowTex || bitShadowTex.baseTexture?.destroyed) bitShadowTex = PIXI.Texture.from(bitShadowCanvas ??= shadowArt()); return bitShadowTex; };
  // Shadows in the flier's own shape: its art as a soft black silhouette, sharp low and soft high, laid flat.
  // Made on first use: the module loads before PIXI is up (and in tests, without it).
  let made = given;
  const silhouettes = () => (made ??= typeof PIXI?.Sprite === 'function' && typeof document !== 'undefined' ? createSilhouettes({ PIXI }) : null);
  const shapes = new WeakMap();
  const silhouetteNode = () => {
    const outer = new PIXI.Container(), inner = new PIXI.Container(), sharp = new PIXI.Sprite(), soft = new PIXI.Sprite();
    outer.eventMode = 'none';
    sharp.anchor.set(0.5); soft.anchor.set(0.5);
    inner.addChild(sharp, soft); outer.addChild(inner);
    return { outer, inner, sharp, soft, shape: null };
  };
  // Lays the art's silhouette as the shadow `geom` describes, in `parent`; false where the art has none to cast (no
  // art, solid art, not loaded yet), and the round shadow shows instead.
  const laySilhouette = (holder, parent, geom, cast) => {
    let node = shapes.get(holder);
    const art = typeof geom.art === 'function' ? geom.art() : geom.art;
    // Made at about the size the art is drawn, so a big creature's shadow is as crisp as a small one's.
    const shape = art?.texture ? silhouettes()?.get(art.texture, silhouetteSize(Math.max(art.width, art.height))) ?? null : null;
    if (!shape) { if (node && !node.outer.destroyed) node.outer.visible = false; return false; }
    if (!node || node.outer.destroyed) { shapes.set(holder, node = silhouetteNode()); parent.addChild(node.outer); }
    else if (node.outer.parent !== parent) parent.addChild(node.outer);
    // Art that plays (a video token): its own frames as they play, tinted black and blurred as the made ones are, so
    // the shadow moves with it; the made silhouette still says whether it has an outline and how much of it is art.
    const moving = isMoving(art.texture) && typeof PIXI.BlurFilter === 'function';
    const key = moving ? art.texture : shape;
    if (node.shape !== key) {
      node.sharp.texture = moving ? art.texture : shape.sharp.texture; node.soft.texture = shape.soft.texture; node.shape = key;
      node.sharp.tint = moving ? 0x000000 : 0xffffff; node.soft.visible = !moving;
      node.inner.filters = moving ? [node.blur ??= new PIXI.BlurFilter()] : null;
    }
    const pose = silhouettePose(geom, { cast }), k = silhouetteScale({ artWidth: art.width * (shape.fill?.w ?? 1), artHeight: art.height * (shape.fill?.h ?? 1), width: geom.width }) * pose.size;
    node.outer.visible = true;
    node.outer.position.set(geom.fall?.x ?? geom.x, geom.fall?.y ?? geom.y);
    // Laid on the floor along the light (`along`, radians): stretched out along it (`stretch`, a standing creature's
    // long shadow), squashed across it (the pose's `flat`), the art keeping its own turn inside.
    const along = Number(geom.along) || 0;
    node.outer.rotation = along;
    node.outer.scale.set(Math.max(1, Number(geom.stretch) || 1), pose.flat);
    node.outer.alpha = geom.alpha;
    node.inner.rotation = (art.rotation || 0) - along;
    const sx = ((art.width * k) / shape.width) * (art.flipX ? -1 : 1), sy = ((art.height * k) / shape.height) * (art.flipY ? -1 : 1);
    if (moving) {
      const f = art.texture.frame, zoom = Math.abs(parent.worldTransform?.a ?? 1) || 1;
      node.sharp.scale.set(((art.width * k) / f.width) * (art.flipX ? -1 : 1), ((art.height * k) / f.height) * (art.flipY ? -1 : 1));
      node.sharp.alpha = 1;
      // The made ones' blur, carried from the silhouette's pixels to the screen's.
      node.blur.blur = (SHARP_BLUR + (SOFT_BLUR - SHARP_BLUR) * pose.soft) * ((art.width * k) / shape.width) * zoom;
      return true;
    }
    node.sharp.scale.set(sx, sy); node.soft.scale.set(sx, sy);
    node.sharp.alpha = 1 - pose.soft; node.soft.alpha = pose.soft;
    return true;
  };
  const dropSilhouette = (holder) => {
    const node = shapes.get(holder);
    shapes.delete(holder);
    try { if (node && !node.outer.destroyed) node.outer.destroy({ children: true }); } catch { /* already gone */ }
  };
  // The sun's shadows together under the sunlit floor (`sunlit()`), the mask moved and swapped as the walls change.
  let sunHome = null, sunMask = null;
  const applySunlit = () => {
    if (!sunHome || sunHome.destroyed) return;
    const lit = sunlitOf?.() ?? null;
    if (!lit?.texture) { sunHome.mask = null; if (sunMask && !sunMask.destroyed) sunMask.visible = false; return; }
    if (!sunMask || sunMask.destroyed) { sunMask = new PIXI.Sprite(lit.texture); sunMask.eventMode = 'none'; root().addChild(sunMask); }
    if (sunMask.texture !== lit.texture) sunMask.texture = lit.texture;
    sunMask.visible = true;
    sunMask.position.set(lit.x, lit.y);
    sunMask.scale.set(lit.scale, lit.scale);
    sunHome.mask = sunMask;
  };
  const homeOf = (geom) => {
    if (!geom.sun || !sunlitOf || typeof PIXI.Container !== 'function') return root();
    if (!sunHome || sunHome.destroyed) { sunHome = new PIXI.Container(); sunHome.eventMode = 'none'; root().addChild(sunHome); applySunlit(); }
    return sunHome;
  };
  // A shadow stops at walls: masked by the floor its light reaches (`clip`, flat x, y pairs), the round one and its
  // shape each by their own copy (a mask serves one thing), drawn again only when that floor changes.
  const clips = new WeakMap();
  const dropClip = (holder) => {
    const c = clips.get(holder);
    if (!c) return;
    clips.delete(holder);
    try { holder.mask = null; } catch { /* gone */ }
    const node = shapes.get(holder);
    try { if (node && !node.outer.destroyed) node.outer.mask = null; } catch { /* gone */ }
    for (const m of [c.round, c.shape]) remove(m);
  };
  const clipShadow = (holder, points, home) => {
    if (!points) { dropClip(holder); return; }
    let c = clips.get(holder);
    if (!c) clips.set(holder, c = { round: add(new PIXI.Graphics(), () => home), shape: add(new PIXI.Graphics(), () => home), points: null });
    // Never drawn themselves: the shape's copy waits unused while a creature has no silhouette (one made a frame
    // after a refresh), and drawn it would be a white floor the size of the light's reach.
    for (const m of [c.round, c.shape]) { if (m.parent !== home) home.addChild(m); m.renderable = false; }
    if (c.points !== points) {
      for (const m of [c.round, c.shape]) { m.clear?.(); m.beginFill(0xffffff, 1); m.drawPolygon(points); m.endFill(); }
      c.points = points;
    }
    holder.mask = c.round;
    const node = shapes.get(holder);
    if (node && !node.outer.destroyed) node.outer.mask = c.shape;
  };
  // Smoke: one soft white disc drawn once into a texture, every puff a sprite of it tinted grey, so hundreds of puffs
  // batch into a single draw (each its own vector shape cost over a millisecond a frame at a busy table).
  let softDisc = null;
  const softDiscTexture = () => {
    if (softDisc && !softDisc.baseTexture?.destroyed) return softDisc;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = DRAW;
    const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(DRAW / 2, DRAW / 2, 0, DRAW / 2, DRAW / 2, DRAW / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.75)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, DRAW, DRAW);
    return (softDisc = PIXI.Texture.from(canvas));
  };
  // Prints pressed into the ground, and wet ones (hollowPixels), each made once and kept.
  const hollows = new Map();
  const hollowTexture = (spec) => {
    const r = renderer?.(); if (!r || typeof document === 'undefined') return null;
    const turn = spec.wet ? 0 : (((Math.round((spec.rotation ?? 0) / (Math.PI / 8)) % 16) + 16) % 16) * (Math.PI / 8);
    const key = `${spec.gait ?? 'boots'}:${spec.mirror === true ? 'left' : 'right'}:${spec.wet ? 'wet' : spec.hollow}:${turn.toFixed(3)}`;
    if (hollows.has(key)) return hollows.get(key);
    let tex = null;
    try {
      const g = new PIXI.Graphics(), holder = new PIXI.Container(), k = HOLLOW_N / (DRAW * HOLLOW_SPAN);
      drawPrint(g, spec.gait, 0xffffff, spec.mirror === true); g.scale.set(k); g.position.set(HOLLOW_N / 2, HOLLOW_N / 2); holder.addChild(g);
      const rt = PIXI.RenderTexture.create({ width: HOLLOW_N, height: HOLLOW_N });
      r.render(holder, { renderTexture: rt, clear: true });
      const raw = r.extract.pixels(rt), mask = new Float32Array(HOLLOW_N * HOLLOW_N);
      for (let i = 0; i < mask.length; i++) mask[i] = raw[i * 4 + 3] / 255;
      rt.destroy(true); holder.destroy({ children: true });
      const px = hollowPixels(mask, HOLLOW_N, { look: spec.hollow, turn, wet: !!spec.wet });
      const cv = document.createElement('canvas'); cv.width = cv.height = HOLLOW_N; cv.getContext('2d').putImageData(new ImageData(px, HOLLOW_N, HOLLOW_N), 0, 0);
      tex = PIXI.Texture.from(cv);
    } catch { tex = null; }
    hollows.set(key, tex);
    return tex;
  };
  // A breath's cloud: a soft, torn puff of noise drawn once (CLOUD px), every cloud a sprite of it.
  let cloud = null;
  const CLOUD = 64;
  const cloudTexture = () => {
    if (cloud && !cloud.baseTexture?.destroyed) return cloud;
    const cv = document.createElement('canvas'); cv.width = cv.height = CLOUD; const g = cv.getContext('2d'), im = g.createImageData(CLOUD, CLOUD);
    const nz = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash01(ix, iy), b = hash01(ix + 1, iy), c = hash01(ix, iy + 1), d = hash01(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
    for (let y = 0; y < CLOUD; y++) for (let x = 0; x < CLOUD; x++) {
      const dx = (x - CLOUD / 2) / (CLOUD / 2), dy = (y - CLOUD / 2) / (CLOUD / 2), r = Math.hypot(dx, dy), tear = 0.5 * nz(x / 9, y / 9) + 0.3 * nz(x / 4, y / 4) + 0.2 * nz(x / 2, y / 2);
      const edge = 1 - Math.min(1, Math.max(0, (r - 0.15 - tear * 0.45) / 0.4)), k = (y * CLOUD + x) * 4;
      im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.min(1, Math.max(0, edge * (0.35 + Math.max(0, tear * 2.2 - 0.4)))) * 255;
    }
    g.putImageData(im, 0, 0);
    return (cloud = PIXI.Texture.from(cv));
  };
  return {
    addParticle(spec) {
      if (spec.art && typeof PIXI.Sprite === 'function' && typeof document !== 'undefined') {
        const tex = artTexture(spec.art, spec.artN);
        if (tex) {
          let shadow = null;
          if (spec.shadow) { shadow = new PIXI.Sprite(bitShadow()); shadow.anchor.set(0.5); shadow.alpha = 0; shadow.__animaterThin = spec.thin === true; add(shadow); }
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5); sp.position.set(spec.x, spec.y); sp.rotation = spec.rotation ?? 0; sp.alpha = 0;
          sp.__animaterRadius = spec.radius; sp.__animaterUnit = DRAW / (tex.width || DRAW); sp.__animaterShadow = shadow;
          return add(sp);
        }
      }
      if (spec.cloud && typeof PIXI.Sprite === 'function' && typeof document !== 'undefined') {
        const sp = new PIXI.Sprite(cloudTexture());
        sp.anchor.set(0.5); sp.tint = spec.color; sp.position.set(spec.x, spec.y); sp.rotation = spec.rotation ?? 0; sp.alpha = 0;
        sp.__animaterRadius = spec.radius; sp.__animaterUnit = DRAW / CLOUD;
        return add(sp);
      }
      if ((spec.hollow || spec.wet) && typeof PIXI.Sprite === 'function') {
        const tex = hollowTexture(spec);
        if (tex) {
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5); sp.position.set(spec.x, spec.y); sp.rotation = spec.rotation ?? 0; sp.alpha = 0;
          sp.__animaterRadius = spec.radius; sp.__animaterUnit = (DRAW * HOLLOW_SPAN) / HOLLOW_N;
          return add(sp);
        }
      }
      if (spec.kind === 'smoke' && typeof PIXI.Sprite === 'function' && typeof document !== 'undefined') {
        const sp = new PIXI.Sprite(softDiscTexture());
        sp.anchor.set(0.5);
        sp.tint = spec.color;
        sp.position.set(spec.x, spec.y);
        sp.rotation = spec.rotation ?? 0;
        sp.alpha = 0;
        sp.__animaterRadius = spec.radius;
        return add(sp);
      }
      const g = new PIXI.Graphics();
      (SHAPES[spec.kind] ?? SHAPES.puff)(g, spec);
      g.position.set(spec.x, spec.y);
      g.rotation = spec.rotation ?? 0;
      g.alpha = 0;
      g.__animaterRadius = spec.radius;
      return add(g);
    },
    updateParticle(g, state) {
      if (g.destroyed) return;
      const s = ((g.__animaterRadius * 2 * state.scale) / DRAW) * (g.__animaterUnit ?? 1);
      g.position.set(state.x, state.y);
      g.scale.set(s, s);
      g.rotation = state.rotation ?? 0;
      g.alpha = state.alpha;
      // Its shadow on the floor under it: off to the side and fainter the higher it is, long and thin under a thin thing.
      const shadow = g.__animaterShadow;
      if (shadow && !shadow.destroyed) {
        const up = Number(state.lift) || 0, high = Math.min(1, up / 22), r = g.__animaterRadius * state.scale, across = shadow.__animaterThin ? 0.11 : 0.58, unit = 1 / (shadow.texture.width / 2);
        shadow.position.set(state.x + 0.5 + up * 0.28, state.y + up + 0.7 + up * 0.38);
        shadow.rotation = shadow.__animaterThin ? (state.rotation ?? 0) : 0;
        shadow.scale.set(r * 1.25 * unit, r * across * 2 * unit);
        shadow.alpha = state.alpha * (0.62 - 0.38 * high);
      }
    },
    removeParticle: remove,
    addShadow() {
      const g = shadowEllipse();
      g.alpha = 0;
      return add(g);
    },
    // Returns whether the shadow is settled: drawn in its shape, or round for good (no art, or art with no outline);
    // false while its shape still waits its turn to be made, so the caller keeps updating it.
    updateShadow(g, geom) {
      if (g.destroyed) return true;
      // The round shadow where art has no shape: where the light lays it, stretched along the light like the rest.
      g.position.set(geom.fall?.x ?? geom.x, geom.fall?.y ?? geom.y);
      g.rotation = Number(geom.along) || 0;
      g.scale.set((geom.rx * 2 * Math.max(1, Number(geom.stretch) || 1)) / DRAW, (geom.ry * 2) / DRAW);
      const home = homeOf(geom);
      if (g.parent !== home) home.addChild(g);
      const shaped = !!geom.art && laySilhouette(g, home, geom, false);
      clipShadow(g, geom.clip ?? null, home);
      // With its shape drawn, the round one is hidden; a grounding rim (`rim`) shows only in the art's shape, never round.
      g.alpha = shaped || geom.rim ? 0 : geom.alpha;
      if (shaped || !geom.art) return true;
      const art = typeof geom.art === 'function' ? geom.art() : geom.art;
      return !art?.texture || silhouettes()?.known?.(art.texture, silhouetteSize(Math.max(art.width, art.height))) !== false;
    },
    removeShadow(g) { dropClip(g); dropSilhouette(g); remove(g); },
    // The walls changed: the sunlit floor the sun's shadows lie under, again.
    refreshSunlit() { applySunlit(); },
    // A standing creature's grounding rim (movement-feel.mjs rimGeometry): drawn as a shadow is.
    addRim() { return this.addShadow(); },
    updateRim(g, geom) { return this.updateShadow(g, geom); },
    removeRim(g) { this.removeShadow(g); },
    // A flier's shadow over the creatures below: the same ellipse above the tokens, cut to the creatures' squares
    // (rounded, as most token art is), so only their art darkens and the floor keeps its one shadow.
    ...(overRoot ? {
      addOverShadow() {
        const box = new PIXI.Container(), shade = new PIXI.Container(), g = shadowEllipse(), mask = new PIXI.Graphics();
        shade.addChild(g);
        box.addChild(shade, mask);
        shade.mask = mask;
        box.__animaterShadow = g; box.__animaterShade = shade; box.__animaterMask = mask;
        box.alpha = 0;
        return add(box, overRoot);
      },
      updateOverShadow(box, geom, covers) {
        if (box.destroyed) return;
        const g = box.__animaterShadow, mask = box.__animaterMask;
        // Where it lies: a flier's below it, a standing creature's laid out along its light.
        g.position.set(geom.fall?.x ?? geom.x, geom.fall?.y ?? geom.y);
        g.rotation = Number(geom.along) || 0;
        g.scale.set((geom.rx * 2 * Math.max(1, Number(geom.stretch) || 1)) / DRAW, (geom.ry * 2) / DRAW);
        // In the flier's shape where its art has one (the silhouette brings its own strength), else the ellipse.
        const shaped = !!geom.art && laySilhouette(box, box.__animaterShade, geom, true);
        g.visible = !shaped;
        box.alpha = shaped ? 1 : geom.alpha;
        mask.clear();
        mask.beginFill(0xffffff, 1);
        // A token in a ring: its disc exactly (`ring`, how far its ring reaches as a share of its width), darkened
        // evenly; no band of its background left pale at the edge, no floor round it darkened.
        for (const t of covers) { const w = t.width * 0.9; if (t.ring) mask.drawCircle(t.x, t.y, t.width * (typeof t.ring === 'number' ? t.ring : 0.45)); else mask.drawRoundedRect(t.x - w / 2, t.y - w / 2, w, w, w * 0.3); }
        mask.endFill();
      },
      removeOverShadow(box) { dropSilhouette(box); remove(box); },
    } : {}),
    clear() { for (const g of [...live]) { dropSilhouette(g); remove(g); } made?.clear(); },
  };
}

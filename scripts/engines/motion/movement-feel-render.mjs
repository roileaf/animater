// Movement feel drawing: small PIXI Graphics (soft discs, chips, blades, glints, cracks, footprints) on the floor under
// the tokens, never documents. Each particle is drawn once at a fixed size and then only moved, scaled, turned and
// faded; a flier's shadow is a stack of faint ellipses, no blur.
// `root()` returns (and makes, when needed) the container on the viewed level's floor.

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
    g.lineStyle(DRAW * 0.05, spec.edge ?? shade(spec.color, 0.4), 1);
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
  print(g, spec) { (PRINTS[spec.gait] ?? PRINTS.boots)(g, spec.color); },
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
// Strokes from (x, y) out along `angle` for `length`, with a thinner claw tip beyond each when `tip` is set.
function toes(g, color, x, y, angles, length, width, tip = 0) {
  g.lineStyle(width, color, 1);
  for (const a of angles) { g.moveTo(x, y); g.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length); }
  if (tip) {
    g.lineStyle(width * 0.45, color, 1);
    for (const a of angles) {
      g.moveTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
      g.lineTo(x + Math.cos(a) * (length + tip), y + Math.sin(a) * (length + tip));
    }
  }
  g.lineStyle(0);
}
const dot = (g, color, x, y, r, alpha = 1) => { g.beginFill(color, alpha); g.drawCircle(x, y, r); g.endFill(); };
// One footprint per gait (creature-gait.mjs), each drawn once into the DRAW box.
const PRINTS = {
  // A boot: sole and heel.
  boots(g, color) {
    drawSoftEllipse(g, color, 0.62 * R, 0.4 * R, 2, 0.3 * R);
    drawSoftEllipse(g, color, 0.34 * R, 0.3 * R, 2, -0.62 * R);
  },
  // A paw: a broad pad and four toe dots fanned ahead of it.
  paws(g, color) {
    drawSoftEllipse(g, color, 0.42 * R, 0.45 * R, 2, -0.25 * R);
    for (const [x, y] of [[0.42, -0.52], [0.62, -0.18], [0.62, 0.18], [0.42, 0.52]]) dot(g, color, x * R, y * R, 0.17 * R, 0.85);
  },
  // A talon: three long forward toes and a back spur, each with a claw tip, and a small heel pad.
  talons(g, color) {
    toes(g, color, -0.2 * R, 0, [-0.55, 0, 0.55], 0.8 * R, 0.13 * R, 0.25 * R);
    toes(g, color, -0.2 * R, 0, [Math.PI], 0.5 * R, 0.13 * R, 0.18 * R);
    dot(g, color, -0.2 * R, 0, 0.17 * R);
  },
  // A dragon's foot: a broad, deep-pressed pad (wider than long, darker at its heart), four short thick toes fanned
  // ahead, each ending in a long hooked claw gouge dug into the ground.
  dragon(g, color) {
    drawSoftEllipse(g, color, 0.46 * R, 0.6 * R, 3, -0.28 * R);
    g.beginFill(color, 0.45); g.drawEllipse(-0.3 * R, 0, 0.26 * R, 0.36 * R); g.endFill();
    const toesAt = [-0.62, -0.2, 0.2, 0.62];
    for (const a of toesAt) {
      const bx = -0.05 * R + Math.cos(a) * 0.12 * R, by = Math.sin(a) * 0.32 * R;
      const tx = bx + Math.cos(a) * 0.42 * R, ty = by + Math.sin(a) * 0.42 * R;
      // The toe: a thick pressed stroke.
      g.lineStyle(0.2 * R, color, 1); g.moveTo(bx, by); g.lineTo(tx, ty);
      // The claw: a tapering gouge that hooks inward at its tip.
      const hook = a * 0.35;
      g.lineStyle(0.09 * R, color, 1); g.moveTo(tx, ty);
      g.lineTo(tx + Math.cos(a) * 0.22 * R, ty + Math.sin(a) * 0.22 * R);
      g.lineStyle(0.05 * R, color, 1);
      g.lineTo(tx + Math.cos(a - hook) * 0.36 * R, ty + Math.sin(a - hook) * 0.36 * R);
    }
    g.lineStyle(0);
  },
  // A hoof: a thick crescent open to the back, with a faint inside.
  hooves(g, color) {
    g.lineStyle(0.26 * R, color, 1);
    for (let i = 0; i <= 10; i++) {
      const a = -2.1 + (4.2 * i) / 10, x = Math.cos(a) * 0.62 * R, y = Math.sin(a) * 0.72 * R;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.lineStyle(0);
    g.beginFill(color, 0.25); g.drawEllipse(0, 0, 0.4 * R, 0.5 * R); g.endFill();
  },
  // A lizard's foot: a palm and five splayed, clawed toes.
  claws(g, color) {
    drawSoftEllipse(g, color, 0.36 * R, 0.4 * R, 2, -0.3 * R);
    toes(g, color, -0.15 * R, 0, [-1.15, -0.58, 0, 0.58, 1.15], 0.6 * R, 0.11 * R, 0.24 * R);
  },
  // Many legs: two rows of tiny dots.
  legs(g, color) {
    for (const [x, y] of [[-0.6, -0.5], [0, -0.62], [0.6, -0.5], [-0.6, 0.5], [0, 0.62], [0.6, 0.5]]) dot(g, color, x * R, y * R, 0.11 * R);
  },
};

export function createMovementFeelLayer({ PIXI, root }) {
  const live = new Set();
  const add = (g) => { g.eventMode = 'none'; root().addChild(g); live.add(g); return g; };
  const remove = (g) => { live.delete(g); try { g.destroy(); } catch { /* already gone */ } };
  return {
    addParticle(spec) {
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
      const s = (g.__animaterRadius * 2 * state.scale) / DRAW;
      g.position.set(state.x, state.y);
      g.scale.set(s, s);
      g.rotation = state.rotation ?? 0;
      g.alpha = state.alpha;
    },
    removeParticle: remove,
    addShadow() {
      const g = new PIXI.Graphics();
      // Many faint rings stack into a smooth falloff (dense heart, feathered rim) with no visible bands.
      for (let i = SHADOW_RINGS; i >= 1; i--) {
        const r = (DRAW / 2) * (0.2 + 0.8 * Math.sqrt(i / SHADOW_RINGS));
        g.beginFill(0x000000, 0.09);
        g.drawEllipse(0, 0, r, r);
        g.endFill();
      }
      g.alpha = 0;
      return add(g);
    },
    updateShadow(g, geom) {
      if (g.destroyed) return;
      g.position.set(geom.x, geom.y);
      g.scale.set((geom.rx * 2) / DRAW, (geom.ry * 2) / DRAW);
      g.alpha = geom.alpha;
    },
    removeShadow: remove,
    clear() { for (const g of [...live]) remove(g); },
  };
}

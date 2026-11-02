// Movement feel drawing: small PIXI Graphics (soft discs, chips, blades, glints, cracks, footprints) on the floor under
// the tokens, never documents. Each particle is drawn once at a fixed size and then only moved, scaled, turned and
// faded; a flier's shadow is its art's soft silhouette laid on the floor (flier-silhouette.mjs), else a stack of faint
// ellipses, no blur.
// `root()` returns (and makes, when needed) the container on the viewed level's floor.
import { createSilhouettes, silhouettePose, silhouetteScale } from './flier-silhouette.mjs';

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
  padded(g, color) {
    drawSoftEllipse(g, color, 0.68 * R, 0.62 * R, 3);
  },
  webbed(g, color) {
    g.beginFill(color, 0.65);
    g.drawPolygon([-0.45 * R, 0, 0.5 * R, -0.7 * R, 0.36 * R, -0.22 * R, 0.8 * R, 0, 0.36 * R, 0.22 * R, 0.5 * R, 0.7 * R]);
    g.endFill();
    toes(g, color, -0.3 * R, 0, [-0.65, 0, 0.65], 0.95 * R, 0.1 * R, 0);
  },
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

export function createMovementFeelLayer({ PIXI, root, overRoot = null, silhouettes: given = null }) {
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
  const remove = (g) => { live.delete(g); try { g.destroy(); } catch { /* already gone */ } };
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
    const shape = art?.texture ? silhouettes()?.get(art.texture) ?? null : null;
    if (!shape) { if (node && !node.outer.destroyed) node.outer.visible = false; return false; }
    if (!node || node.outer.destroyed) { shapes.set(holder, node = silhouetteNode()); parent.addChild(node.outer); }
    if (node.shape !== shape) { node.sharp.texture = shape.sharp.texture; node.soft.texture = shape.soft.texture; node.shape = shape; }
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
    node.sharp.scale.set(sx, sy); node.soft.scale.set(sx, sy);
    node.sharp.alpha = 1 - pose.soft; node.soft.alpha = pose.soft;
    return true;
  };
  const dropSilhouette = (holder) => {
    const node = shapes.get(holder);
    shapes.delete(holder);
    try { if (node && !node.outer.destroyed) node.outer.destroy({ children: true }); } catch { /* already gone */ }
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
  return {
    addParticle(spec) {
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
      const s = (g.__animaterRadius * 2 * state.scale) / DRAW;
      g.position.set(state.x, state.y);
      g.scale.set(s, s);
      g.rotation = state.rotation ?? 0;
      g.alpha = state.alpha;
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
      const shaped = !!geom.art && laySilhouette(g, root(), geom, false);
      // With its shape drawn, the round one is hidden; a grounding rim (`rim`) shows only in the art's shape, never round.
      g.alpha = shaped || geom.rim ? 0 : geom.alpha;
      if (shaped || !geom.art) return true;
      const art = typeof geom.art === 'function' ? geom.art() : geom.art;
      return !art?.texture || silhouettes()?.known?.(art.texture) !== false;
    },
    removeShadow(g) { dropSilhouette(g); remove(g); },
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

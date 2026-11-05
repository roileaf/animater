// What moves on a region's floor look (region-steps.mjs, floor-looks.mjs): boiling bubbles swell and burst, flames flicker and throw
// embers, steam rises, arcs flash. The look under them is a still image, so this layer alone costs anything, and it is kept cheap:
// plain sprites from a few shared textures, only for regions in view, with hard caps. Every screen runs its own and nothing is saved.

export const MOST_PER_REGION = 100, MOST_ANYWHERE = 320;

// Sizes in squares; rate in starts per square per second, tint and blend as drawn.
const bubble = (rate, size, tint, alpha, life = [0.9, 2.2]) => ({ kind: 'bubble', art: 'bubble', rate, size, tint, alpha, life, bursts: true });
const ring = (rate, size, tint, alpha, life = [0.8, 1.6]) => ({ kind: 'ring', art: 'ring', rate, size, tint, alpha, life });
const rising = (art, rate, size, tint, alpha, life, rise, add = false) => ({ kind: 'rise', art, rate, size, tint, alpha, life, rise, add });
const drifting = (art, rate, size, tint, alpha, life, wind, add = false) => ({ kind: 'drift', art, rate, size, tint, alpha, life, wind, add });
const flash = (art, rate, size, tint, alpha, life, add = true) => ({ kind: 'flash', art, rate, size, tint, alpha, life, add });
export const MOTIONS = Object.freeze({
  boiling: [bubble(1.1, [0.05, 0.13], 0xdfe8e6, 0.75), bubble(0.3, [0.13, 0.26], 0xdfe8e6, 0.7, [1.4, 2.8]), rising('puff', 0.07, [0.4, 0.8], 0xe6ebeb, 0.2, [2, 4], 0.3)],
  acid: [bubble(0.5, [0.03, 0.09], 0xc8dc78, 0.7), rising('puff', 0.04, [0.3, 0.6], 0xa8bc50, 0.14, [1.5, 3], 0.2)],
  burning: [
    { kind: 'flash', art: 'glow', rate: 0.5, size: [0.28, 0.6], tint: 0xc84a10, alpha: 0.22, life: [0.5, 1.1], add: true, cluster: true },
    { kind: 'flame', art: 'flame', rate: 3.2, size: [0.05, 0.13], tint: 0xffffff, alpha: 0.8, life: [0.3, 0.7], add: true, cluster: true },
    { kind: 'flame', art: 'flame', rate: 0.8, size: [0.11, 0.19], tint: 0xffe0b0, alpha: 0.72, life: [0.45, 0.9], add: true, cluster: true },
    { ...rising('spark', 0.45, [0.008, 0.02], 0xffb060, 0.95, [0.8, 1.8], 0.9, true), cluster: true },
    { ...rising('puff', 0.07, [0.3, 0.75], 0x171513, 0.26, [1.8, 3.6], 0.5), cluster: true },
  ],
  burnt: [rising('spark', 0.04, [0.01, 0.024], 0xff9040, 0.8, [1, 2.2], 0.5, true), rising('puff', 0.02, [0.3, 0.6], 0x24211e, 0.16, [3, 5], 0.2)],
  steam: [rising('puff', 0.2, [0.5, 1.1], 0xe8ecec, 0.26, [3, 6], 0.35)],
  misty: [drifting('puff', 0.05, [1.2, 2.4], 0xc8d0d4, 0.14, [8, 14], [0.14, 0.03])],
  fog: [drifting('puff', 0.04, [1, 2], 0xd0d6d8, 0.12, [8, 14], [0.1, 0.02])],
  lavacracks: [flash('glow', 0.14, [0.3, 0.8], 0xff6018, 0.4, [1.6, 3.2]), rising('spark', 0.2, [0.012, 0.03], 0xffa050, 0.9, [0.8, 1.8], 0.7, true)],
  hot: [flash('glow', 0.06, [0.5, 1.1], 0xff5010, 0.2, [2, 4]), rising('spark', 0.03, [0.01, 0.022], 0xff9040, 0.75, [0.8, 1.6], 0.5, true)],
  electric: [flash('bolt', 0.5, [0.45, 1.05], 0x90b8ff, 0.95, [0.07, 0.2]), rising('spark', 0.12, [0.01, 0.024], 0xb8d0ff, 0.9, [0.3, 0.7], 0.4, true)],
  arcane: [rising('mote', 0.24, [0.025, 0.06], 0x7c9cff, 0.8, [2, 4], 0.22, true), flash('sparkle', 0.08, [0.05, 0.11], 0x9cb8ff, 0.7, [0.5, 1.1])],
  holy: [rising('mote', 0.22, [0.02, 0.05], 0xffdc90, 0.75, [2.4, 4.6], 0.2, true)],
  cursed: [rising('puff', 0.09, [0.35, 0.8], 0x1c0c24, 0.3, [2.5, 5], 0.18), rising('mote', 0.05, [0.018, 0.04], 0x8c50b0, 0.6, [1.6, 3], 0.14, true)],
  poison: [drifting('puff', 0.08, [0.5, 1.1], 0x70805a, 0.15, [4, 8], [0.05, -0.02]), bubble(0.06, [0.03, 0.08], 0xb4c490, 0.5)],
  blood: [ring(0.025, [0.05, 0.14], 0x3a0408, 0.4, [1, 2])],
  flooded: [ring(0.12, [0.08, 0.26], 0xcfe0e8, 0.26, [1.2, 2.4])],
  murky: [bubble(0.05, [0.02, 0.05], 0xa8a884, 0.4, [1.4, 3])],
  oil: [flash('glow', 0.03, [0.3, 0.7], 0x6050a0, 0.09, [2, 4]), bubble(0.015, [0.03, 0.07], 0x504c58, 0.4, [2, 4])],
  frozen: [flash('sparkle', 0.1, [0.03, 0.08], 0xe8f4ff, 0.85, [0.4, 0.9])],
  frost: [flash('sparkle', 0.07, [0.025, 0.06], 0xeef6ff, 0.8, [0.4, 0.9])],
  snowed: [flash('sparkle', 0.09, [0.025, 0.06], 0xffffff, 0.8, [0.4, 0.9]), drifting('fleck', 0.14, [0.012, 0.03], 0xf4f8fc, 0.75, [1.6, 3.2], [0.7, 0.12])],
  drifts: [drifting('puff', 0.05, [0.3, 0.7], 0xe4e8ec, 0.16, [1.6, 3.2], [0.9, 0.1]), drifting('fleck', 0.2, [0.01, 0.024], 0xf4f8fc, 0.7, [1, 2.2], [1.2, 0.14])],
  ash: [drifting('fleck', 0.14, [0.01, 0.026], 0x9a9896, 0.7, [2.4, 5], [0.16, 0.12])],
  quicksand: [bubble(0.03, [0.05, 0.13], 0x8c7450, 0.45, [2.2, 4.2]), ring(0.04, [0.15, 0.4], 0x3c2c18, 0.2, [2.4, 4.2])],
  slush: [ring(0.02, [0.05, 0.13], 0xc8ccd0, 0.18, [1.2, 2.2])],
  wet: [flash('sparkle', 0.02, [0.02, 0.05], 0xdfeaf4, 0.5, [0.5, 1.1])],
});
// How many places burn at once in a region of so many squares.
export const hotSpotsFor = (squares) => Math.min(8, Math.max(2, Math.round(squares * 0.2)));
// How hot a flame is at a point of its picture (pure): x -1 to 1 across, up 0 at its root to 1 at its tip. A narrow tongue, widest low
// down, hottest low in its middle. 0 outside it. The picture's colours are read from this.
export function flameShade(x, up) {
  if (up <= 0 || up >= 1) return 0;
  const width = Math.pow(1 - up, 0.75) * (0.3 + 0.7 * Math.sin(Math.min(1, up * 5.5) * Math.PI / 2)), inside = 1 - Math.abs(x) / Math.max(0.001, width);
  return inside <= 0 ? 0 : Math.pow(inside, 0.72) * (1 - up * 0.62);
}

// What a burst bubble leaves: a spreading ring and a few flung drops.
const BURST_RING = Object.freeze({ kind: 'ring', art: 'ring', alpha: 0.7, size: [1, 1], life: [0.22, 0.34] });
const BURST_DROP = Object.freeze({ kind: 'fling', art: 'mote', alpha: 0.85, size: [0.14, 0.14], life: [0.16, 0.3] });

// Where a particle is at `u` (0 just born, 1 gone), and how it shows (pure). `p`: { x, y, size in pixels, phase, grid, way }.
export function particleAt(part, u, p) {
  const fadeIn = Math.min(1, u / 0.18), fadeOut = Math.min(1, (1 - u) / 0.35), alpha = part.alpha ?? 1, grid = p.grid ?? 100, age = u * (p.life ?? 1);
  switch (part.kind) {
    case 'bubble': {
      // Swells to its size and wobbles; a last quick growth as the skin thins, and it is gone.
      const swell = u < 0.82 ? Math.pow(u / 0.82, 0.6) : 1 + (u - 0.82) * 0.9, wob = Math.sin(age * 7 + p.phase) * p.size * 0.03;
      return { x: p.x + wob, y: p.y - wob * 0.6, scale: Math.max(0.01, p.size * swell), alpha: u >= 1 ? 0 : alpha * Math.min(1, u / 0.1) * (u > 0.82 ? 1 - (u - 0.82) / 0.18 : 1), rotation: 0 };
    }
    case 'ring':
      return { x: p.x, y: p.y, scale: Math.max(0.01, p.size * (0.3 + 1.1 * u)), alpha: alpha * (1 - u) * (1 - u), rotation: 0 };
    case 'fling': {
      const d = p.size * 3.4 * Math.sqrt(u);
      return { x: p.x + Math.cos(p.phase) * d, y: p.y + Math.sin(p.phase) * d, scale: Math.max(0.01, p.size * (1 - u * 0.6)), alpha: alpha * (1 - u), rotation: 0 };
    }
    case 'flame': {
      // Licks up, flickering, and thins as it goes.
      const flick = 0.82 + 0.18 * Math.sin(age * 24 + p.phase) + 0.1 * Math.sin(age * 41 + p.phase * 2);
      return { x: p.x + Math.sin(age * 11 + p.phase) * p.size * 0.14, y: p.y - p.size * 1.5 * u, scale: Math.max(0.01, p.size * (0.72 - 0.3 * u)), scaleY: Math.max(0.01, p.size * (1.15 + 0.75 * Math.sin(Math.min(1, u * 1.6) * Math.PI)) * flick), alpha: alpha * Math.min(fadeIn * 1.8, 1) * fadeOut * flick, rotation: Math.sin(age * 7 + p.phase) * 0.14 };
    }
    case 'flash': {
      const flick = 0.55 + 0.45 * Math.sin(age * 46 + p.phase);
      return { x: p.x, y: p.y, scale: Math.max(0.01, p.size * (0.92 + 0.14 * u)), alpha: alpha * Math.sin(Math.PI * Math.min(1, u)) * (part.art === 'bolt' ? flick : 1), rotation: p.phase };
    }
    case 'drift': {
      const [wx, wy] = part.wind ?? [0.1, 0], go = u * (p.life ?? 1) * grid;
      return { x: p.x + wx * go, y: p.y + wy * go + Math.sin(age * 1.4 + p.phase) * grid * 0.03, scale: Math.max(0.01, p.size * (0.86 + 0.28 * u)), alpha: alpha * Math.min(fadeIn, 1) * fadeOut, rotation: p.phase + u * 0.5 };
    }
    default: { // rise
      const up = (part.rise ?? 0.3) * u * (p.life ?? 1) * grid, sway = Math.sin(age * 1.8 + p.phase) * Math.max(p.size * 0.12, grid * 0.012);
      return { x: p.x + sway, y: p.y - up, scale: Math.max(0.01, p.size * (0.72 + 0.56 * u)), alpha: alpha * Math.min(fadeIn, 1) * fadeOut, rotation: p.phase * 0.4 + u * 0.3 };
    }
  }
}

// How many start in this slice of time (pure), and what is carried to the next. A long stall never brings a flood.
export function howMany({ rate, carry = 0, squares, seconds }) {
  const due = carry + rate * squares * Math.min(seconds, 1);
  const whole = Math.floor(due);
  return { count: Math.min(whole, MOST_PER_REGION), carry: due - whole };
}

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    if ((ring[i + 1] > y) !== (ring[j + 1] > y) && x < ((ring[j] - ring[i]) * (y - ring[i + 1])) / (ring[j + 1] - ring[i + 1]) + ring[i]) inside = !inside;
  }
  return inside;
};
export const insideAreas = (x, y, areas) => areas.some((area) => inRing(x, y, area) && !(area.holes ?? []).some((hole) => inRing(x, y, hole)));
const ringArea = (ring) => { let a = 0; for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) a += ring[j] * ring[i + 1] - ring[i] * ring[j + 1]; return Math.abs(a) / 2; };
// A shape's area, without its holes.
export const areaOf = (areas) => areas.reduce((sum, area) => sum + ringArea(area) - (area.holes ?? []).reduce((h, hole) => h + ringArea(hole), 0), 0);
// A random spot inside, `margin` clear of the edge (so nothing starts where the look has faded out). null if none is found quickly.
export function pickSpot(areas, random = Math.random, margin = 0) {
  if (!areas?.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const area of areas) for (let i = 0; i + 1 < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); }
  for (let tries = 0; tries < 8; tries++) {
    const x = x0 + random() * (x1 - x0), y = y0 + random() * (y1 - y0);
    if (!insideAreas(x, y, areas)) continue;
    if (margin > 0 && !(insideAreas(x + margin, y, areas) && insideAreas(x - margin, y, areas) && insideAreas(x, y + margin, areas) && insideAreas(x, y - margin, areas))) continue;
    return { x, y };
  }
  return null;
}

// The few shapes everything is drawn with, painted once.
const paintArt = (PIXI) => {
  const make = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return PIXI.Texture.from(c); };
  const soft = (g, s, stops) => { const f = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); for (const [at, colour] of stops) f.addColorStop(at, colour); g.fillStyle = f; g.fillRect(0, 0, s, s); };
  // A tongue of flame, its sides torn by a wander that grows toward the tip; a pale core, then orange, then a deep red edge.
  const wave = (x, y, seed) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < 3; i++) { v += a * Math.sin(x * f * 1.7 + seed + Math.sin(y * f * 1.3 + seed * 2) * 1.6); a *= 0.5; f *= 2.1; } return v; };
  const flame = (seed) => { const c = document.createElement('canvas'), w = 48, h = 96; c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const up = 1 - py / (h - 1), x = (px - w / 2) / (w / 2) + wave(py * 0.11, up * 3, seed) * up * 0.5, heat = flameShade(x * 1.05, up), k = (py * w + px) * 4;
      if (heat <= 0) continue;
      const t = Math.min(1, heat / 0.75), r = 150 + 105 * Math.min(1, t * 2.2), gr = t < 0.45 ? 26 + 140 * (t / 0.45) : 166 + 76 * ((t - 0.45) / 0.55), b = t < 0.7 ? 8 : 8 + 130 * ((t - 0.7) / 0.3);
      im.data[k] = r; im.data[k + 1] = gr; im.data[k + 2] = b; im.data[k + 3] = Math.min(1, heat * 1.9) * 255;
    }
    g.putImageData(im, 0, 0); return PIXI.Texture.from(c); };
  const bolt = (seed) => make(128, (g, s) => {
    let h = seed; const r = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
    const path = (x, y, a, left, width, alpha) => { g.strokeStyle = `rgba(255,255,255,${alpha})`; g.lineWidth = width; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < left; i++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (r() < 0.2 && width > 0.9) { const keep = g.lineWidth; g.stroke(); path(x, y, a + (r() - 0.5) * 2, Math.floor(left / 2), width * 0.55, alpha * 0.7); g.lineWidth = keep; g.strokeStyle = `rgba(255,255,255,${alpha})`; g.beginPath(); g.moveTo(x, y); } } g.stroke(); };
    g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
    path(s * 0.12, s * (0.3 + r() * 0.4), (r() - 0.5) * 0.5, 11, 2, 1);
  });
  return {
    puff: make(128, (g, s) => soft(g, s, [[0, 'rgba(255,255,255,0.85)'], [0.42, 'rgba(255,255,255,0.42)'], [1, 'rgba(255,255,255,0)']])),
    glow: make(64, (g, s) => soft(g, s, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']])),
    mote: make(32, (g, s) => soft(g, s, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']])),
    spark: make(16, (g, s) => soft(g, s, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']])),
    fleck: make(16, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.42, s * 0.26, 0.5, 0, Math.PI * 2); g.fill(); }),
    ring: make(96, (g, s) => { g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); g.stroke(); }),
    bubble: make(96, (g, s) => {
      const c = s / 2, r = s * 0.45, body = g.createRadialGradient(c, c, r * 0.55, c, c, r);
      body.addColorStop(0, 'rgba(255,255,255,0.03)'); body.addColorStop(0.82, 'rgba(255,255,255,0.13)'); body.addColorStop(1, 'rgba(255,255,255,0.72)');
      g.fillStyle = body; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
      const shine = g.createRadialGradient(c - r * 0.38, c - r * 0.42, 0, c - r * 0.38, c - r * 0.42, r * 0.34); shine.addColorStop(0, 'rgba(255,255,255,0.95)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = shine; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, r * 0.76, 0.5, 1.9); g.stroke();
    }),
    flames: [flame(1.1), flame(4.7), flame(8.3), flame(13.9)],
    sparkle: make(48, (g, s) => { g.translate(s / 2, s / 2); g.fillStyle = '#fff'; for (let i = 0; i < 2; i++) { g.rotate(Math.PI / 2 * i); g.beginPath(); g.moveTo(-s / 2, 0); g.quadraticCurveTo(0, 1.4, s / 2, 0); g.quadraticCurveTo(0, -1.4, -s / 2, 0); g.fill(); } g.setTransform(1, 0, 0, 1, 0, 0); soft(g, s, [[0, 'rgba(255,255,255,0.7)'], [0.22, 'rgba(255,255,255,0.1)'], [0.4, 'rgba(255,255,255,0)']]); }),
    bolts: [bolt(1931), bolt(7411), bolt(5303), bolt(9127)],
  };
};

/**
 * The layer: sync([{ id, areas, look }]) with the regions' current looks (empty turns it all off); tick(seconds, view { x, y, w, h }, light 0-1)
 * while `busy`; clear(). `root()` the floor layer it draws in.
 */
export function createFloorMotion({ PIXI, root, grid = () => 100, random = Math.random }) {
  const regions = new Map();
  let art = null, live = [], spare = [];
  const artOf = (name) => { art ??= paintArt(PIXI); const many = name === 'bolt' ? art.bolts : name === 'flame' ? art.flames : null; return many ? many[Math.floor(random() * many.length)] : art[name]; };
  const retire = (p) => { p.sprite.visible = false; spare.push(p.sprite); };
  const start = (part, x, y, size, region, phase = random() * Math.PI * 2) => {
    if (live.length >= MOST_ANYWHERE || region.count >= MOST_PER_REGION) return;
    let sprite = spare.pop();
    if (!sprite || sprite.destroyed) { sprite = new PIXI.Sprite(); sprite.anchor.set(0.5); sprite.eventMode = 'none'; root().addChild(sprite); }
    else if (!sprite.parent) root().addChild(sprite);
    sprite.texture = artOf(part.art); sprite.tint = part.tint ?? 0xffffff; sprite.blendMode = part.add ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL; sprite.visible = true; sprite.alpha = 0;
    const life = part.life[0] + random() * (part.life[1] - part.life[0]);
    live.push({ sprite, part, region, age: 0, life, x, y, size, phase, grid: grid() || 100 }); region.count++;
  };
  const burst = (p) => {
    const tint = p.part.tint, ringPart = { ...BURST_RING, tint }, dropPart = { ...BURST_DROP, tint };
    start(ringPart, p.x, p.y, p.size * 1.5, p.region);
    for (let i = 0, n = 3 + Math.floor(random() * 3); i < n; i++) start(dropPart, p.x, p.y, Math.max(1.5, p.size * 0.16), p.region);
  };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const spec of list) {
        const parts = MOTIONS[spec.look];
        if (!parts) continue;
        seen.add(spec.id);
        const shape = JSON.stringify(spec.areas), had = regions.get(spec.id), strength = spec.strength ?? 1;
        if (had && had.look === spec.look && had.shape === shape) { had.strength = strength; continue; }
        const g = grid() || 100, bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const area of spec.areas) for (let i = 0; i + 1 < area.length; i += 2) { bounds.x0 = Math.min(bounds.x0, area[i]); bounds.x1 = Math.max(bounds.x1, area[i]); bounds.y0 = Math.min(bounds.y0, area[i + 1]); bounds.y1 = Math.max(bounds.y1, area[i + 1]); }
        // The same record, as what is already moving counts itself against it.
        regions.set(spec.id, Object.assign(had ?? { id: spec.id, count: 0 }, { hot: [], look: spec.look, strength, shape, parts, areas: spec.areas, bounds, squares: areaOf(spec.areas) / (g * g), carries: parts.map(() => 0), margin: g * 0.3 * (spec.edge ?? 1) }));
      }
      for (const id of regions.keys()) if (!seen.has(id)) regions.delete(id);
    },
    tick(seconds, view = null, light = 1) {
      const g = grid() || 100, glint = 0.2 + 0.8 * Math.min(1, Math.max(0, light));
      for (const region of regions.values()) {
        const b = region.bounds, seen = !view || (b.x0 < view.x + view.w && b.x1 > view.x && b.y0 < view.y + view.h && b.y1 > view.y);
        if (!seen) continue;
        region.parts.forEach((part, i) => {
          const { count, carry } = howMany({ rate: part.rate * region.strength, carry: region.carries[i], squares: region.squares, seconds });
          region.carries[i] = carry;
          for (let n = 0; n < count; n++) {
            let spot;
            if (part.cluster) {
              // Fire keeps to its hot spots, each moving on in time; a tongue starts close by one.
              const want = hotSpotsFor(region.squares);
              while (region.hot.length < want) { const made = pickSpot(region.areas, random, region.margin); if (!made) break; region.hot.push(made); }
              if (region.hot.length && random() < 0.004) region.hot.splice(Math.floor(random() * region.hot.length), 1);
              const h = region.hot[Math.floor(random() * region.hot.length)], reach = g * 0.42;
              const near = h && { x: h.x + (random() + random() - 1) * reach, y: h.y + (random() + random() - 1) * reach * 0.7 };
              spot = near && insideAreas(near.x, near.y, region.areas) ? near : null;
            } else spot = pickSpot(region.areas, random, region.margin);
            // Not started where nobody can see it.
            if (!spot || (view && (spot.x < view.x - g || spot.y < view.y - g || spot.x > view.x + view.w + g || spot.y > view.y + view.h + g))) continue;
            start(part, spot.x, spot.y, g * (part.size[0] + random() * (part.size[1] - part.size[0])), region);
          }
        });
      }
      const keep = [];
      for (const p of live) {
        p.age += seconds;
        const u = Math.min(1, p.age / p.life);
        if (u >= 1 || p.sprite.destroyed) { p.region.count--; if (!p.sprite.destroyed) retire(p); if (u >= 1 && p.part.bursts && regions.has(p.region.id)) burst(p); continue; }
        const at = particleAt(p.part, u, { x: p.x, y: p.y, size: p.size, phase: p.phase, grid: p.grid, life: p.life });
        const s = p.sprite;
        s.position.set(at.x, at.y); s.width = at.scale * 2; s.height = (at.scaleY ?? at.scale) * 2; s.rotation = at.rotation; s.alpha = p.part.art === 'sparkle' ? at.alpha * glint : at.alpha; // a sparkle is the sun's or moon's, and goes with it
        keep.push(p);
      }
      // (A burst's ring and drops join \`live\` as this runs, so the loop reaches them too.)
      live = keep;
    },
    clear() { for (const p of live) { try { p.sprite.destroy(); } catch { /* gone */ } } for (const s of spare) { try { s.destroy(); } catch { /* gone */ } } live = []; spare = []; regions.clear(); },
    get busy() { return regions.size > 0 || live.length > 0; },
    get count() { return live.length; },
  };
}

// A lightning strike seen on the map: where it hits, the jagged bolt itself and the glow where it lands, gone in under half a second.

// Where a strike lands (pure): mostly somewhere on the scene; else off past an edge, which only lights the scene from that side. `rect` the scene.
export function strikePlace(random, rect, grid = 100, onScene = 0.7) {
  const r = rect ?? { x: 0, y: 0, width: 0, height: 0 };
  if (random() < onScene) return { x: r.x + random() * r.width, y: r.y + random() * r.height, inside: true };
  const side = Math.floor(random() * 4) % 4, along = random(), out = grid * (3 + random() * 9);
  if (side === 0) return { x: r.x + along * r.width, y: r.y - out, inside: false };
  if (side === 1) return { x: r.x + r.width + out, y: r.y + along * r.height, inside: false };
  if (side === 2) return { x: r.x + along * r.width, y: r.y + r.height + out, inside: false };
  return { x: r.x - out, y: r.y + along * r.height, inside: false };
}
// Whether this flash is the rare one that lands on the scene (pure): most lightning is off in the storm, a flash from afar. Never sooner than a while after the last, then one flash in a few. `sinceMs` since the last bolt; `storm` how fierce, 0-1.
// (`built`: a GM's own Lightning slider, whose top end means a bolt every few seconds and nearly every flash landing.)
export const boltDue = (sinceMs, storm = 0.55, random = Math.random, built = false) => { const s = Math.min(1, Math.max(0, Number(storm) || 0)); return built ? sinceMs >= 60000 - 54000 * s && random() < 0.4 + 0.5 * s : sinceMs >= 60000 - 40000 * s && random() < 0.4; };
// The way the light of a strike comes from (pure): degrees, from the scene's middle toward it, as a sun's angle.
export const strikeAngle = (place, rect) => (Math.atan2(place.y - (rect.y + rect.height / 2), place.x - (rect.x + rect.width / 2)) * 180) / Math.PI;
// A jagged line from one point to another (pure): each stretch split at its middle, pushed aside by less each time.
export function boltPath(random, from, to, { rough = 0.2, splits = 5 } = {}) {
  let points = [from, to];
  for (let n = 0, push = rough; n < splits; n++, push *= 0.58) {
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, off = (random() - 0.5) * 2 * push;
      next.push({ x: (a.x + b.x) / 2 - dy * off, y: (a.y + b.y) / 2 + dx * off }, b);
    }
    points = next;
  }
  return points;
}
// How bright a bolt is at an age in seconds (pure): it strikes, all but goes, strikes again down the same path, and fades. `steady`: no strobe, for those who ask for less motion.
export const BOLT_SECONDS = 0.42;
export function boltLevel(age, steady = false) {
  if (age < 0 || age >= BOLT_SECONDS) return 0;
  if (steady) return 1 - age / BOLT_SECONDS;
  if (age < 0.06) return 1;
  if (age < 0.11) return 0.2;
  if (age < 0.19) return 0.92;
  return Math.pow(1 - (age - 0.19) / (BOLT_SECONDS - 0.19), 1.6);
}

/** The layer: strike({ x, y, grid, strength, steady }) draws a bolt down to that spot; tick(seconds); clear(). */
export function createLightningBolts({ PIXI, root, random = Math.random }) {
  let live = [], glowTexture = null;
  const glowOf = () => {
    if (glowTexture?.valid) return glowTexture;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(235,242,255,1)'); g.addColorStop(0.22, 'rgba(170,200,255,0.5)'); g.addColorStop(1, 'rgba(120,160,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (glowTexture = PIXI.Texture.from(c));
  };
  const line = (g, points, width, colour, alpha) => { g.lineStyle(width, colour, alpha); g.moveTo(points[0].x, points[0].y); for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y); };
  const drop = (b) => { try { b.view.parent?.removeChild(b.view); b.view.destroy({ children: true }); } catch { /* gone with the canvas */ } };
  return {
    strike({ x, y, grid = 100, strength = 1, steady = false } = {}) {
      const view = new PIXI.Container(), g = new PIXI.Graphics(), to = { x, y };
      // Down from high overhead, leaning a little, its top off beyond what is seen close to.
      const from = { x: x + (random() - 0.5) * grid * 7, y: y - grid * (12 + random() * 6) }, main = boltPath(random, from, to);
      const forks = [];
      for (let i = 0; i < 3; i++) {
        const at = main[Math.floor(main.length * (0.25 + random() * 0.5))], reach = grid * (1.5 + random() * 3.5), lean = (random() - 0.5) * 1.6;
        forks.push(boltPath(random, at, { x: at.x + Math.sin(lean) * reach, y: at.y + Math.cos(lean) * reach }, { rough: 0.24, splits: 3 }));
      }
      for (const fork of forks) { line(g, fork, grid * 0.1, 0x8fb4ff, 0.22); line(g, fork, grid * 0.024, 0xdfe9ff, 0.8); }
      line(g, main, grid * 0.3, 0x7fa8ff, 0.2); line(g, main, grid * 0.11, 0xb8d0ff, 0.55); line(g, main, grid * 0.04, 0xffffff, 1);
      g.blendMode = PIXI.BLEND_MODES.ADD;
      const glow = new PIXI.Sprite(glowOf()); glow.anchor.set(0.5); glow.position.set(x, y); glow.width = glow.height = grid * 5; glow.blendMode = PIXI.BLEND_MODES.ADD;
      view.addChild(glow, g); view.eventMode = 'none'; root().addChild(view);
      live.push({ view, age: 0, strength: Math.min(1, Math.max(0.35, strength)), steady });
    },
    tick(seconds) {
      if (!live.length) return;
      live = live.filter((b) => {
        b.age += seconds;
        const level = boltLevel(b.age, b.steady);
        if (level <= 0 && b.age > 0) { drop(b); return false; }
        b.view.alpha = level * b.strength;
        return true;
      });
    },
    clear() { for (const b of live) drop(b); live = []; },
    get busy() { return live.length > 0; },
  };
}

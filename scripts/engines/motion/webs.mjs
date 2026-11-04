// Cobwebs in the corners of a region marked for them: dusty, tangled, half torn, a thin gauze of threads with loose ends
// hanging. They stir in the air (the loose strands most), and now and then a small spider lowers itself on a line, hangs a
// while and climbs back. Laid out once from the walls; a frame moves only the loose strands and the spider.

import { spiderArt, shadowArt } from './kick-art.mjs';

const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
const inside = ({ x, y }, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * noise(x, y); x = x * 2.03 + 17; y = y * 2.03 + 9; a *= 0.5; } return s; };

// The corners a web can hang in (pure): where two walls that stop movement meet at a corner of 50–140°, its inside within
// one of `areas` and on the floor (`floor({ x, y })`, not the rock behind a pillar). Each { x, y, u: [x, y], v: [x, y]
// (the two walls' ways out of the corner), L (how far the web reaches) }.
export function webCorners({ walls = [], areas = [], grid = 100, seed = 'webs', share = 0.7, floor = () => true } = {}) {
  const r = rng(seed), ends = new Map(), out = [];
  const key = (x, y) => `${Math.round(x / 4)},${Math.round(y / 4)}`;
  for (const w of walls) {
    if (!(Number(w.move) > 0) || Number(w.door) > 0) continue;
    const [x1, y1, x2, y2] = w.c, len = Math.hypot(x2 - x1, y2 - y1); if (len < grid * 0.4) continue;
    for (const [ax, ay, bx, by] of [[x1, y1, x2, y2], [x2, y2, x1, y1]]) { const k = key(ax, ay); if (!ends.has(k)) ends.set(k, []); ends.get(k).push({ x: ax, y: ay, u: [(bx - ax) / len, (by - ay) / len], len }); }
  }
  for (const list of ends.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], cos = a.u[0] * b.u[0] + a.u[1] * b.u[1], ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (ang < 50 || ang > 140) continue;
    const mid = { x: a.x + (a.u[0] + b.u[0]) * grid * 0.25, y: a.y + (a.u[1] + b.u[1]) * grid * 0.25 };
    if (!areas.some((p) => inside(mid, p)) || !floor(mid)) continue;
    if (r() > share) continue;
    out.push({ x: a.x, y: a.y, u: a.u, v: b.u, L: Math.min(grid * (1 + 0.8 * r()), a.len * 0.8, b.len * 0.8) });
  }
  return out;
}

// One web's threads (pure): main threads wall to wall across the corner (some torn short), threads out from the corner,
// cross threads tying them, and loose ends hanging. Each { p, q, sag, loose, a (alpha), ph, w (width, px) }.
export function webStrands(c, { grid = 100, seed = 'web' } = {}) {
  const r = rng(seed), P = (a, b) => [c.x + c.u[0] * a + c.v[0] * b, c.y + c.u[1] * a + c.v[1] * b], L = c.L, k = grid / 100, s = [];
  for (let i = 0; i < 24; i++) { const a = 6 * k + r() * L, b = 6 * k + r() * L * (1.1 - (a / L) * 0.6), p = P(a, 0), q = P(0, b), torn = r() < 0.2, f = 0.3 + r() * 0.4;
    s.push({ p, q: torn ? [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f] : q, sag: (r() - 0.3) * 14 * k, loose: torn, a: 0.12 + r() * 0.2, ph: r() * 6.28, w: (0.5 + r() * 0.5) * k }); }
  for (let i = 0; i < 8; i++) { const a = r() * L * 0.9, b = r() * L * 0.9 * (1 - a / L); s.push({ p: [c.x, c.y], q: P(a, b), sag: (r() - 0.5) * 8 * k, a: 0.1 + r() * 0.14, ph: r() * 6.28, w: 0.5 * k }); }
  for (let i = 0; i < 16; i++) { const A = s[Math.floor(r() * 24)], B = s[Math.floor(r() * 24)], ka = r(), kb = r();
    s.push({ p: [A.p[0] + (A.q[0] - A.p[0]) * ka, A.p[1] + (A.q[1] - A.p[1]) * ka], q: [B.p[0] + (B.q[0] - B.p[0]) * kb, B.p[1] + (B.q[1] - B.p[1]) * kb], sag: (r() - 0.5) * 6 * k, a: 0.08 + r() * 0.1, ph: r() * 6.28, w: 0.4 * k }); }
  for (let i = 0; i < 4; i++) { const a = grid * 0.2 + r() * L * 0.7, b = grid * 0.2 + r() * L * 0.4 * (1 - a / L), p = P(a, b), d = [c.u[0] + c.v[0], c.u[1] + c.v[1]], dl = Math.hypot(d[0], d[1]) || 1;
    s.push({ p, q: [p[0] + (d[0] / dl) * grid * (0.15 + r() * 0.3) + (r() - 0.5) * grid * 0.2, p[1] + (d[1] / dl) * grid * (0.15 + r() * 0.3) + (r() - 0.5) * grid * 0.2], sag: 5 * k, loose: true, a: 0.15 + r() * 0.15, ph: r() * 6.28, w: 0.45 * k }); }
  return s;
}

// How much of the web shows: threads bright and fine enough to read on a dark floor, the gauze thick.
const WEB_THICK = 2.1, WEB_BRIGHT = 2.2, WEB_WIDTH = 1.25;

/** The webs' layer. build({ corners, grid, seed }); tick(seconds, { view, air: (x, y) => 0–1 how the air moves there }); clear(). */
export function createWebs({ PIXI, root }) {
  let webs = [], time = 0, grid = 100, spider = null, spiderTex = null, shadowTex = null;
  const drop = () => { for (const w of webs) { try { w.box.destroy({ children: true }); w.tex?.destroy(true); } catch { /* gone */ } } try { spider?.box.destroy({ children: true }); } catch { /* gone */ } webs = []; spider = null; };
  // Three poses painted once, the spider a sprite of one of them; its line a thin strip, its shadow on the floor below it.
  const makeSpider = (web) => {
    spiderTex ??= [0, 2, 4].map((pose) => PIXI.Texture.from(spiderArt(pose)));
    shadowTex ??= PIXI.Texture.from(shadowArt());
    const box = new PIXI.Container(), shadow = new PIXI.Sprite(shadowTex), line = new PIXI.Sprite(PIXI.Texture.WHITE), body = new PIXI.Sprite(spiderTex[0]);
    box.eventMode = 'none'; shadow.anchor.set(0.5); body.anchor.set(0.5); line.anchor.set(0, 0.5); line.tint = 0xebe8de; line.alpha = 0.5; shadow.alpha = 0.32;
    box.addChild(shadow, line, body); box.visible = false; root().addChild(box);
    return { box, shadow, line, body, web, phase: 0 };
  };
  // The gauze: a thin, torn, dusty sheet over the tightest part of the corner, as a picture (once per web).
  const gauze = (c, seed) => {
    const n = Math.ceil(c.L), size = n * 2, cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'), im = g.createImageData(size, size), off = (seed % 97) * 3.1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x - n, dy = y - n, a = dx * c.u[0] + dy * c.u[1], b = dx * c.v[0] + dy * c.v[1]; if (a < 0 || b < 0) continue;
      const reach = (a + b) / (c.L * 0.75); if (reach > 1) continue;
      const tear = fbm(x / (c.L / 10) + off, y / (c.L / 10), 4), fib = fbm(x / 3 + a * 0.2, y / 3, 2), k = (y * size + x) * 4;
      im.data[k] = 205; im.data[k + 1] = 202; im.data[k + 2] = 195; im.data[k + 3] = Math.min(255, 255 * Math.max(0, tear - 0.42) * 1.4 * (1 - reach) * (0.5 + 0.5 * fib) * 0.5 * WEB_THICK);
    }
    g.putImageData(im, 0, 0);
    return PIXI.Texture.from(cv);
  };
  return {
    build({ corners = [], grid: g = 100, seed = 'webs' } = {}) {
      drop(); grid = g;
      corners.forEach((c, i) => {
        const strands = webStrands(c, { grid, seed: `${seed}:${i}` });
        // The web turns a little about its corner as one sheet; its loose ends move on their own.
        const box = new PIXI.Container(); box.eventMode = 'none'; box.position.set(c.x, c.y); box.pivot.set(c.x, c.y);
        const tex = gauze(c, i), sheet = new PIXI.Sprite(tex); sheet.position.set(c.x - Math.ceil(c.L), c.y - Math.ceil(c.L)); box.addChild(sheet);
        const fixed = new PIXI.Graphics(), loose = new PIXI.Graphics();
        for (const s of strands.filter((t) => !t.loose)) {
          const mx = (s.p[0] + s.q[0]) / 2, my = (s.p[1] + s.q[1]) / 2, dx = s.q[0] - s.p[0], dy = s.q[1] - s.p[1], len = Math.hypot(dx, dy) + 1;
          fixed.lineStyle(s.w * WEB_WIDTH, 0xd8d6ce, Math.min(1, s.a * WEB_BRIGHT)); fixed.moveTo(s.p[0], s.p[1]); fixed.quadraticCurveTo(mx - (dy / len) * s.sag, my + (dx / len) * s.sag, s.q[0], s.q[1]);
        }
        box.addChild(fixed, loose); root().addChild(box);
        webs.push({ c, box, tex, loose, strands: strands.filter((t) => t.loose), seen: false });
      });
      // A spider, in one of the webs.
      if (webs.length) spider = makeSpider(webs[Math.floor(webs.length / 2)]);
    },
    tick(seconds, { view = null, air = () => 0 } = {}) {
      time += seconds;
      for (const w of webs) {
        const { c } = w, seen = !view || (c.x > view.x - c.L && c.y > view.y - c.L && c.x < view.x + view.w + c.L && c.y < view.y + view.h + c.L);
        w.box.visible = seen; if (!seen) continue;
        const pull = air(c.x, c.y), breathe = (noise(time * (0.3 + 1.2 * pull), c.x * 0.01) - 0.5) * 2;
        w.box.rotation = breathe * 0.02 * (0.3 + pull);
        const g = w.loose; g.clear();
        for (const s of w.strands) {
          const sway = (Math.sin(time * (0.7 + 2.2 * pull) + s.ph) * 0.6 + breathe) * (3 + 14 * pull) * grid / 100;
          const mx = (s.p[0] + s.q[0]) / 2, my = (s.p[1] + s.q[1]) / 2, dx = s.q[0] - s.p[0], dy = s.q[1] - s.p[1], len = Math.hypot(dx, dy) + 1;
          g.lineStyle(s.w * WEB_WIDTH, 0xd8d6ce, Math.min(1, s.a * WEB_BRIGHT)); g.moveTo(s.p[0], s.p[1]); g.quadraticCurveTo(mx - (dy / len) * (s.sag + sway), my + (dx / len) * (s.sag + sway), s.q[0] + sway, s.q[1] + sway * 0.4);
        }
      }
      // The spider: down on its line, a pause, back up; a long wait in between.
      if (spider) {
        spider.phase += seconds;
        const { c } = spider.web, cyc = spider.phase % 14, drop = cyc < 3 ? (1 - Math.cos((cyc / 3) * Math.PI)) / 2 : cyc < 5.5 ? 1 : cyc < 8.5 ? (1 + Math.cos(((cyc - 5.5) / 3) * Math.PI)) / 2 : 0;
        const shows = drop > 0.01 && spider.web.box.visible; spider.box.visible = shows;
        if (shows) {
          const k = grid / 100, ax = c.x + (c.u[0] + c.v[0]) * c.L * 0.3, ay = c.y + (c.u[1] + c.v[1]) * c.L * 0.3, d = [c.u[0] + c.v[0], c.u[1] + c.v[1]], dl = Math.hypot(...d) || 1;
          const x = ax + (d[0] / dl) * grid * 0.9 * drop + Math.sin(time * 1.1) * 4 * k * drop, y = ay + (d[1] / dl) * grid * 0.9 * drop, R = 19 * k;
          // Its line from the web to its back; it swings a little, and its legs work while it moves.
          const { line, body, shadow } = spider; line.position.set(ax, ay); line.rotation = Math.atan2(y - 5 * k - ay, x - ax); line.width = Math.max(0, Math.hypot(x - ax, y - 5 * k - ay)); line.height = 0.7 * k;
          const moving = cyc < 3 || (cyc >= 5.5 && cyc < 8.5);
          body.texture = spiderTex[Math.floor(time * (moving ? 7 : 2)) % 3]; body.position.set(x, y); body.rotation = Math.sin(time * 1.1) * 0.07 * drop; body.width = body.height = R * 2;
          shadow.position.set(x + 12 * k, y + 16 * k); shadow.width = R * 1.6; shadow.height = R * 1.2;
        }
      }
    },
    clear: drop,
    get count() { return webs.length; },
  };
}

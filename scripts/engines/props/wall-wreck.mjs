// Draws a smashed door (from wall-wreck-layout): a ragged dark gap with an ink edge over the painted door, splintered
// stubs on the hinge and latch ends, planks thrown flat through to the far side, splinters, and the dust it raised. A
// shattered window: the pane gone dark with glass teeth in the frame, pale shards fanned out past the wall (a few on the
// near side), a handful of glints that twinkle once. One Container per wreck on the primary canvas, on the wall's
// level's floor, sorted above the tiles.
import { doorWreckLayout, windowWreckLayout, wallWreckTargets, wallLevelBase, DOOR_COLOUR, IRON_TONES, STONE_TONES } from "./wall-wreck-layout.mjs";
import { flatMark } from "./prop-wreck-layout.mjs";
import { paintMark, paintShard } from "./prop-wreck.mjs";
import { wallSound } from "./prop-sounds.mjs";
import { wallMid } from "./wall-break.mjs";
import { seededRandom } from "../fragments/fragments.mjs";

const INK = 0x1a1410, FRESH = 0xd6b47c, K = 2; // planks are painted at twice their size, sharp when zoomed in
const THROW_MS = 600, END_MS = 1000; // planks fly over the throw; dust settles by the end
const GLASS_END_MS = 1500, GLINT_MS = 350, GLINT_REST = 0.4; // shards land by ~650 ms; the last glint is done by the end
const PANE = 0x1c1814, TOOTH = 0xb8d6de, TOOTH_EDGE = 0x2a3a40, FRAME = 0x5a3e26;
const ABOVE_TILES = 1e7; // a sort above any tile on the same floor (tokens draw in a later sort layer)
const quiet = (fn) => { try { fn(); } catch { /* keep cleaning */ } };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = (u) => 1 - (1 - u) ** 3, outQuart = (u) => 1 - (1 - u) ** 4;
const span = (t, at, dur) => clamp01((t - at) / dur);
const shade = (c, k) => (Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k));
const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
const turnBy = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from)); // the short way round

// A plank painted from above, its length along x about its centre: the door's boards with grain, a lit top edge, a
// shaded lower edge, nails, perhaps the iron band, jagged snapped ends with a pale fresh edge, all inked.
function plankCanvas(p, rand) {
  const { len, wid } = p, c = document.createElement("canvas");
  c.width = Math.ceil((len + 8) * K); c.height = Math.ceil((wid + 8) * K);
  const g = c.getContext("2d"); g.scale(K, K); g.translate(4, 4);
  const end = (x0, y0, x1, y1, amp) => {
    const pts = [];
    for (let i = 0; i <= 4; i++) pts.push(lerp(x0, x1, i / 4) + (i === 0 || i === 4 ? 0 : (rand() - 0.5) * 2 * amp), lerp(y0, y1, i / 4));
    return pts;
  };
  const e0 = end(0, 0, 0, wid, 3.5), e1 = end(len, wid, len, 0, 4), pts = [...e0, ...e1];
  const line = (list, close) => { g.beginPath(); g.moveTo(list[0], list[1]); for (let i = 2; i < list.length; i += 2) g.lineTo(list[i], list[i + 1]); if (close) g.closePath(); };
  g.save(); line(pts, true); g.clip();
  g.fillStyle = hex(p.tone); g.fillRect(-5, -5, len + 10, wid + 10);
  g.fillStyle = hex(shade(p.tone, 1.18)); g.fillRect(-5, -5, len + 10, wid * 0.28);
  g.fillStyle = hex(shade(p.tone, 0.78)); g.fillRect(-5, wid * 0.74, len + 10, wid * 0.4);
  g.strokeStyle = hex(shade(p.tone, 0.6)); g.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const yy = wid * (0.2 + i * 0.2) + (rand() - 0.5) * 2;
    g.beginPath(); g.moveTo(-2, yy);
    for (let x = 0; x <= len + 2; x += 8) g.lineTo(x, yy + Math.sin(x * 0.07 + i * 2) * 1.2);
    g.stroke();
  }
  const bandX = len * 0.22, bw = 6 * (wid / 30);
  if (p.band) { g.fillStyle = "#3b3733"; g.fillRect(bandX, -2, bw, wid + 4); g.fillStyle = "rgba(160,150,140,0.5)"; g.fillRect(bandX, -2, bw, 1.5); }
  g.fillStyle = "#1e1a16";
  for (const nx of [bandX + bw / 2, len * 0.72]) for (const ny of [wid * 0.3, wid * 0.7]) { g.beginPath(); g.arc(nx, ny, 1.1, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = "rgba(214,180,124,0.95)"; g.lineWidth = 2.5; line(e1, false); g.stroke();
  g.strokeStyle = "rgba(20,15,10,0.95)"; g.lineWidth = 1.5; line(pts, true); g.stroke();
  return c;
}

// A metal door's slab painted from above, its length along x about its centre: dark iron in stepped bands (lit top
// edge, shaded lower edge), a raised rim, rivets with a glint, the dent where it was hit (a dark hollow with a bright
// rim on its lit side), a scuffed bright scrape across it, all inked.
function ironCanvas(p, rand) {
  const { len, wid } = p, c = document.createElement("canvas");
  c.width = Math.ceil((len + 8) * K); c.height = Math.ceil((wid + 8) * K);
  const g = c.getContext("2d"); g.scale(K, K); g.translate(4, 4);
  const base = p.tone ?? IRON_TONES[1];
  g.fillStyle = hex(base); g.fillRect(0, 0, len, wid);
  g.fillStyle = hex(shade(base, 1.3)); g.fillRect(0, 0, len, wid * 0.18);
  g.fillStyle = hex(shade(base, 0.72)); g.fillRect(0, wid * 0.8, len, wid * 0.2);
  g.fillStyle = hex(shade(base, 0.86)); g.fillRect(0, wid * 0.46, len, wid * 0.08); // the middle band's shadow
  g.strokeStyle = hex(shade(base, 1.45)); g.lineWidth = 1; g.strokeRect(2.5, 2.5, len - 5, wid - 5); // the rim
  const at = (u, v) => [len / 2 + u * len, wid / 2 + v * wid];
  // The dent: a darker hollow, stepped, with a bright crescent on its upper-left rim and a crumpled ink line.
  const [dx, dy] = at(p.dent.u, p.dent.v), r = p.dent.r;
  g.fillStyle = hex(shade(base, 0.8)); g.beginPath(); g.ellipse(dx, dy, r, r * 0.8, 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(shade(base, 0.58)); g.beginPath(); g.ellipse(dx + r * 0.12, dy + r * 0.1, r * 0.62, r * 0.48, 0.3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(200,190,175,0.75)"; g.lineWidth = 1.4; g.beginPath(); g.ellipse(dx, dy, r, r * 0.8, 0.3, Math.PI * 0.95, Math.PI * 1.7); g.stroke();
  g.strokeStyle = "rgba(20,15,10,0.8)"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(dx - r * 0.5, dy + r * 0.1);
  for (let i = 1; i <= 4; i++) g.lineTo(dx - r * 0.5 + i * r * 0.25, dy + r * 0.1 + (rand() - 0.5) * r * 0.4);
  g.stroke();
  // Rivets: a dark head, a pale glint up-left.
  for (const q of p.rivets) {
    const [x, y] = at(q.u, q.v);
    g.fillStyle = "#1c1916"; g.beginPath(); g.arc(x, y, 1.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(190,180,165,0.8)"; g.beginPath(); g.arc(x - 0.5, y - 0.5, 0.7, 0, Math.PI * 2); g.fill();
  }
  // A bright scrape where it hit the floor.
  g.strokeStyle = "rgba(205,195,180,0.55)"; g.lineWidth = 0.8; g.beginPath();
  const sx = len * (0.2 + rand() * 0.5), sy = wid * (0.25 + rand() * 0.5); g.moveTo(sx, sy); g.lineTo(sx + len * 0.18, sy + (rand() - 0.5) * wid * 0.2); g.stroke();
  g.strokeStyle = "rgba(20,15,10,0.95)"; g.lineWidth = 1.6; g.strokeRect(0, 0, len, wid);
  return c;
}

// A stone door's slab painted from above about its centre: its broken outline (p.poly) in stepped stone shading, a
// pale fresh edge, hairline cracks, a few pits, inked.
function stoneCanvas(p, rand) {
  const poly = p.poly;
  let mx = 0, my = 0;
  for (let i = 0; i < poly.length; i += 2) { mx = Math.max(mx, Math.abs(poly[i])); my = Math.max(my, Math.abs(poly[i + 1])); }
  const c = document.createElement("canvas");
  c.width = Math.ceil((2 * mx + 8) * K); c.height = Math.ceil((2 * my + 8) * K);
  const g = c.getContext("2d"); g.scale(K, K); g.translate(mx + 4, my + 4);
  const path = () => { g.beginPath(); g.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) g.lineTo(poly[i], poly[i + 1]); g.closePath(); };
  g.save(); path(); g.clip();
  g.fillStyle = hex(p.tone); g.fillRect(-mx - 4, -my - 4, 2 * mx + 8, 2 * my + 8);
  g.fillStyle = hex(shade(p.tone, 1.2)); g.fillRect(-mx - 4, -my - 4, 2 * mx + 8, my * 0.55 + 4);
  g.fillStyle = hex(shade(p.tone, 0.78)); g.fillRect(-mx - 4, my * 0.55, 2 * mx + 8, my);
  g.fillStyle = hex(shade(p.tone, 0.65));
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((rand() - 0.5) * mx * 1.6, (rand() - 0.5) * my * 1.6, 0.8 + rand() * 1.2, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "rgba(20,15,10,0.7)"; g.lineWidth = 0.9;
  for (const q of p.cracks) { g.beginPath(); g.moveTo(q[0] * 2 * mx, q[1] * 2 * my); for (let i = 2; i < q.length; i += 2) g.lineTo(q[i] * 2 * mx, q[i + 1] * 2 * my); g.stroke(); }
  g.restore();
  g.strokeStyle = "rgba(205,200,190,0.9)"; g.lineWidth = 2; path(); g.stroke();
  g.strokeStyle = "rgba(20,15,10,0.95)"; g.lineWidth = 1.5; path(); g.stroke();
  return c;
}
const SLAB_PAINT = { wood: plankCanvas, iron: ironCanvas, stone: stoneCanvas };

// grid() and layer() as in prop-wreck.mjs (a number or object works too); playSound(file, at) plays a recording at a point.
export function createWallWreckage({ PIXI, layer, grid, playSound = () => {} }) {
  const wrecks = new Map(); // wall id -> { box, textures, stop, key }
  const gridOf = () => (typeof grid === "function" ? grid() : grid) || 100;
  const layerOf = () => (typeof layer === "function" ? layer() : layer);
  const sortLayer = () => globalThis.canvas?.primary?.constructor?.SORT_LAYERS?.TILES ?? globalThis.foundry?.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS?.TILES;
  const keyOf = (d, note) => `${note.seed}:${note.cutAngle}:${note.mark}:${(d.c ?? []).join(",")}`;

  const release = (e) => {
    e.stop?.();
    quiet(() => e.box.destroy({ children: true }));
    for (const t of e.textures) quiet(() => t.destroy(true));
    e.textures.length = 0;
  };
  const hide = (id) => { const e = wrecks.get(id); if (e) { wrecks.delete(id); release(e); } };

  // The gap, its inner shadow and the two stubs, painted once.
  function drawGap(L, k) {
    const g = new PIXI.Graphics();
    g.lineStyle(1.4, INK, 0.9).beginFill(0x15110e, 0.94).drawPolygon(L.gap.poly).endFill();
    g.lineStyle(0).beginFill(0x2e2620, 0.8).drawPolygon(L.gap.inner).endFill();
    // Each stub in its own frame: x along its rot into the doorway, y across the wall (half the door's thickness).
    const profile = [[0, -1], [12, -1], [7, -0.45], [15, 0], [6, 0.55], [10, 1], [0, 1]];
    const stone = L.look === "stone", body = stone ? STONE_TONES[1] : DOOR_COLOUR, fresh = stone ? 0xcfc9bd : FRESH;
    for (const s of L.stubs) {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot), h = L.doorHalf, f = s.len / 15;
      const pts = profile.flatMap(([x, y]) => { const px = x * f, py = y * h; return [s.x + px * c - py * sn, s.y + px * sn + py * c]; });
      g.lineStyle(1.3, INK, 1).beginFill(body).drawPolygon(pts).endFill();
      g.lineStyle(1.6, fresh, 0.9).moveTo(pts[2], pts[3]);
      for (let i = 4; i <= 10; i += 2) g.lineTo(pts[i], pts[i + 1]);
    }
    // A metal door's hinges: two iron straps left on the frame, bent through the doorway (ink, iron, a lit edge).
    for (const hg of L.hinges ?? []) {
      const a = hg.rot, b = hg.rot + hg.bend, mid = { x: hg.x + Math.cos(a) * hg.len * 0.45, y: hg.y + Math.sin(a) * hg.len * 0.45 };
      const tip = { x: mid.x + Math.cos(b) * hg.len * 0.55, y: mid.y + Math.sin(b) * hg.len * 0.55 };
      const strap = (w, colour, alpha) => g.lineStyle(w * k, colour, alpha).moveTo(hg.x, hg.y).lineTo(mid.x, mid.y).lineTo(tip.x, tip.y);
      strap(5.2, INK, 1); strap(3.2, IRON_TONES[1], 1); strap(1, IRON_TONES[2] + 0x303030, 0.8);
      g.lineStyle(0).beginFill(0x1c1916, 1).drawCircle(hg.x, hg.y, 2.4 * k).endFill();
    }
    return g;
  }

  // Splinters from where the door stood to where they lie, a small hop and a shadow each; settled, drawn once.
  function splinterDrawer(g, list, origin) {
    const items = list.map((s, i) => {
      let cx = 0, cy = 0;
      for (let j = 0; j < 8; j += 2) { cx += s.pts[j] / 4; cy += s.pts[j + 1] / 4; }
      return { s, cx, cy, dur: 600 * (0.7 + ((i * 7) % 10) * 0.06) };
    });
    return (ms) => {
      g.clear();
      for (const { s, cx, cy, dur } of items) {
        const r = span(ms, 0, dur), u = outQuart(r), lift = Math.sin(Math.PI * r) * 10;
        const ox = lerp(origin.x, cx, u) - cx, oy = lerp(origin.y, cy, u) - cy - lift;
        const pts = s.pts.map((v, j) => v + (j % 2 ? oy : ox));
        g.lineStyle(0).beginFill(0x000000, 0.25).drawPolygon(pts.map((v, j) => v + (j % 2 ? 2.5 + lift * 0.6 : 1.5))).endFill();
        g.lineStyle(0.8, INK, 0.55).beginFill(s.tone, 1).drawPolygon(pts).endFill();
      }
    };
  }

  // Dust (or smoke, from a fire) billowing out of the far side of the doorway, gone by the end.
  function puffDrawer(g, mid, n, k, mark, seed) {
    const tones = mark === "scorch" ? [0x5a524a, 0x6d6660] : mark === "stone" ? [0xa59b8a, 0xbdb3a2] : [0x9d8b6e, 0xb3a184];
    const along = { x: -n.y, y: n.x };
    const list = [0, 1, 2, 3].map((i) => ({
      x: mid.x + along.x * (i - 1.5) * 22 * k + n.x * 12 * k, y: mid.y + along.y * (i - 1.5) * 22 * k + n.y * 12 * k,
      vx: (along.x * (i - 1.5) * 12 + n.x * (50 + i * 6)) * k, vy: (along.y * (i - 1.5) * 12 + n.y * (50 + i * 6)) * k, at: i * 25, seed: (seed >>> 0) * 13 + 50 + i,
    }));
    return (ms) => {
      g.clear();
      for (const p of list) {
        const r = span(ms, p.at, 900);
        if (r <= 0 || r >= 1) continue;
        const u = outCubic(r), rr = lerp(12, 34, u) * k, x = p.x + p.vx * u, y = p.y + p.vy * u, a = 0.4 * (r < 0.15 ? r / 0.15 : 1 - (r - 0.15) / 0.85);
        const rnd = seededRandom(p.seed);
        tones.forEach((c, i) => {
          const s = 1 - i * 0.28;
          for (let l = 0; l < 5; l++) {
            const la = rnd() * Math.PI * 2, ld = rr * 0.35 * rnd(), pts = [];
            for (let q = 0; q < 10; q++) { const qa = (q / 10) * Math.PI * 2, qr = rr * s * (0.55 + rnd() * 0.18); pts.push(x + Math.cos(la) * ld + Math.cos(qa) * qr, y + Math.sin(la) * ld + Math.sin(qa) * qr); }
            g.lineStyle(i === 0 ? 1 : 0, INK, 0.08 * a).beginFill(c, a * 0.45).drawPolygon(pts).endFill();
          }
        });
      }
    };
  }

  function show(wallDoc, note, { animate = false } = {}) {
    const d = wallDoc?.document ?? wallDoc, id = d?.id;
    if (!id) return;
    hide(id);
    const entry = { box: null, textures: [], stop: null, key: keyOf(d, note) };
    try { draw(d, note, entry, animate); wrecks.set(id, entry); }
    catch (error) { release(entry); console.warn("Animater wall wreckage: could not draw", error); }
  }

  function draw(d, note, entry, animate) {
    const grid = gridOf(), k = grid / 100, mid = wallMid(d);
    const box = new PIXI.Container(); entry.box = box;
    const scene = d.parent;
    box.elevation = wallLevelBase(d.levels, scene?.levels?.contents ?? scene?.levels ?? [], scene?.initialLevel?.id ?? null);
    box.sort = ABOVE_TILES;
    const sl = sortLayer();
    if (sl !== undefined) box.sortLayer = sl;

    const look = (note.kind === "window" ? windowLook : doorLook)(d, note, entry, box, { grid, k, mid, animate });
    layerOf().addChild(box);
    if (!animate) { look.frame(look.end); return; }

    // Only a break seen happening is heard (a door mid-throw, a window at the hit); the note's seed gives every screen
    // the same recording.
    let heard = false;
    const hear = () => {
      heard = true;
      try { playSound(wallSound(note.kind, seededRandom(note.seed), note.material).file, mid); }
      catch (error) { console.warn("Animater wall wreckage: no sound", error); }
    };
    const t0 = performance.now(); let raf = 0;
    entry.stop = () => { cancelAnimationFrame(raf); entry.stop = null; };
    const tick = () => {
      const ms = Math.min(look.end, performance.now() - t0);
      look.frame(ms);
      if (!heard && ms >= look.soundAt) hear();
      if (ms < look.end) raf = requestAnimationFrame(tick);
      else { entry.stop = null; look.done?.(); }
    };
    look.frame(0); raf = requestAnimationFrame(tick);
  }

  // A door: the gap and stubs, the mark, planks thrown through, splinters and (seen happening) dust.
  function doorLook(d, note, entry, box, { grid, k, mid, animate }) {
    const L = doorWreckLayout(note, d, grid), [x1, y1, x2, y2] = d.c;
    box.addChild(drawGap(L, k));
    const mark = paintMark(PIXI, flatMark(L.mark.kind, { ...L.mark, squash: 0.6, angle: Math.atan2(y2 - y1, x2 - x1) }, seededRandom((note.seed >>> 0) * 31 + 9)), entry.textures);
    box.addChild(mark);

    const shadows = new PIXI.Container(), boards = new PIXI.Container();
    box.addChild(shadows, boards);
    const planks = L.planks.map((p, i) => {
      const tex = PIXI.Texture.from((SLAB_PAINT[p.look] ?? plankCanvas)(p, seededRandom((note.seed >>> 0) * 53 + 7 + i)));
      entry.textures.push(tex);
      const body = new PIXI.Sprite(tex), sh = new PIXI.Sprite(tex);
      for (const s of [body, sh]) s.anchor.set(0.5);
      sh.tint = 0x000000; shadows.addChild(sh); boards.addChild(body);
      return { p, body, sh, dur: THROW_MS + i * 60, spin: turnBy(p.home.rot, p.rot) };
    });
    const throwAt = (ms) => {
      for (const { p, body, sh, dur, spin } of planks) {
        const r = span(ms, 0, dur), u = outCubic(r), lift = Math.sin(Math.PI * r) * 0.5;
        const x = lerp(p.home.x, p.x, u), y = lerp(p.home.y, p.y, u), sc = (1 + lift * 0.25) / K;
        body.position.set(x, y - lift * 18 * k); body.rotation = p.home.rot + spin * u; body.scale.set(sc);
        sh.position.set(x + (2.5 + lift * 10) * k, y + (4 + lift * 16) * k); sh.rotation = body.rotation; sh.scale.set(sc); sh.alpha = 0.4 * (1 - lift * 0.5);
      }
    };

    const chips = new PIXI.Graphics(); box.addChild(chips);
    const far = splinterDrawer(chips, L.splinters.far, mid), nearG = new PIXI.Graphics(); box.addChild(nearG);
    const near = splinterDrawer(nearG, L.splinters.near, mid);
    let dust = null, puffs = null, sparkG = null;
    if (animate) {
      const n = { x: (L.mark.x - mid.x) / (40 * k), y: (L.mark.y - mid.y) / (40 * k) }; // toward the far side
      dust = new PIXI.Graphics(); box.addChild(dust);
      puffs = puffDrawer(dust, mid, n, k, L.mark.kind, note.seed);
      // A metal door's sparks: short hot streaks off the hit, yellow cooling to red as they fade.
      if (L.sparks?.length) { sparkG = new PIXI.Graphics(); sparkG.blendMode = PIXI.BLEND_MODES?.ADD ?? 1; box.addChild(sparkG); }
    }
    const sparksAt = (ms) => {
      if (!sparkG) return;
      sparkG.clear();
      for (const q of L.sparks) {
        const r = span(ms, q.at, q.life);
        if (r <= 0 || r >= 1) continue;
        const u = outQuart(r), tail = outQuart(Math.max(0, r - 0.18)), x = lerp(q.x0, q.x, u), y = lerp(q.y0, q.y, u);
        sparkG.lineStyle(q.w * 1.6, r < 0.5 ? 0xffd27a : 0xff7a2a, 0.9 * (1 - r)).moveTo(lerp(q.x0, q.x, tail), lerp(q.y0, q.y, tail)).lineTo(x, y);
      }
    };
    return {
      end: END_MS, soundAt: THROW_MS / 2,
      frame: (ms) => { throwAt(ms); far(ms); near(ms); sparksAt(ms); mark.alpha = span(ms, 0, 500); puffs?.(ms); },
      done: () => { if (dust) quiet(() => dust.destroy()); if (sparkG) quiet(() => sparkG.destroy()); },
    };
  }

  // A window: the empty pane, its teeth and the mullion at once; frame splinters; pale shards flying out to rest; glints
  // that flash once as their shard settles, then stay faint (a reload shows them faint).
  function windowLook(d, note, entry, box, { grid, mid }) {
    const L = windowWreckLayout(note, d, grid), [x1, y1, x2, y2] = d.c;
    if (L.mark) box.addChild(paintMark(PIXI, flatMark(L.mark.kind, { ...L.mark, squash: 0.6, angle: Math.atan2(y2 - y1, x2 - x1) }, seededRandom((note.seed >>> 0) * 31 + 9)), entry.textures));

    const pane = new PIXI.Graphics(); box.addChild(pane);
    pane.lineStyle(1, 0x15110e, 0.95).beginFill(PANE, 0.92).drawPolygon(L.gap.poly).endFill();
    for (const t of L.teeth) pane.lineStyle(0.8, TOOTH_EDGE, 0.8).beginFill(TOOTH, 0.9).drawPolygon(t.pts).endFill();
    const { x, y, rot, along, across } = L.mullion, c = Math.cos(rot), sn = Math.sin(rot);
    const bar = [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([a, b]) => { const u = (a * along) / 2, v = (b * across) / 2; return [x + u * c - v * sn, y + u * sn + v * c]; });
    pane.lineStyle(1, INK, 1).beginFill(FRAME).drawPolygon(bar).endFill();

    const chips = new PIXI.Graphics(); box.addChild(chips);
    const slivers = splinterDrawer(chips, L.slivers, mid);
    const glass = new PIXI.Graphics(), sparks = new PIXI.Graphics(); box.addChild(glass, sparks);
    const flights = [...L.shards.far.map((s) => [s, 0.72]), ...L.shards.near.map((s) => [s, 0.7])];
    const shardsAt = (ms) => {
      glass.clear();
      for (const [s, alpha] of flights) {
        const u = outQuart(span(ms, 0, s.dur)), px = lerp(s.from.x, s.x, u), py = lerp(s.from.y, s.y, u), ro = s.rot - s.spin * (1 - u);
        const rc = Math.cos(ro), rs = Math.sin(ro), pts = [];
        for (let i = 0; i < 6; i += 2) pts.push(px + s.pts[i] * rc - s.pts[i + 1] * rs, py + s.pts[i] * rs + s.pts[i + 1] * rc);
        paintShard(glass, pts, s.tone, alpha);
      }
    };
    const glintsAt = (ms) => {
      sparks.clear();
      for (const q of L.glints) {
        if (ms < q.at) continue;
        const flare = Math.sin(Math.PI * span(ms, q.at, GLINT_MS)), a = GLINT_REST + (1 - GLINT_REST) * flare, z = q.size * (1 + 0.5 * flare);
        sparks.lineStyle(1.1, 0xffffff, 0.8 * a).moveTo(q.x - z, q.y).lineTo(q.x + z, q.y).moveTo(q.x, q.y - z).lineTo(q.x, q.y + z);
      }
    };
    return { end: GLASS_END_MS, soundAt: 0, frame: (ms) => { slivers(ms); shardsAt(ms); glintsAt(ms); } };
  }

  // Draws every wall with a broken note and removes the rest; a wreck already drawn for the same note is left alone.
  function sync(wallDocs) {
    const want = wallWreckTargets(wallDocs), byId = new Map((wallDocs ?? []).map((w) => [(w.document ?? w).id, w.document ?? w]));
    const ids = new Set(want.map((w) => w.id));
    for (const id of [...wrecks.keys()]) if (!ids.has(id)) hide(id);
    for (const { id, note } of want) {
      const d = byId.get(id);
      if (wrecks.get(id)?.key === keyOf(d, note)) continue;
      show(d, note, { animate: false });
    }
  }

  function clear() { for (const id of [...wrecks.keys()]) hide(id); }

  return { show, hide, sync, clear };
}

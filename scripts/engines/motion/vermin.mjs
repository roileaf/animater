// Life in the dark: rats scurrying along the floor, keeping out of the light and scattering from anyone who comes close,
// and bats flitting high overhead. A few small shapes, moved on the CPU (a dozen at most); nothing drawn where nobody
// looks.

const TAU = Math.PI * 2;

// How many of a kind of creature a scene has, and how big they are (pure): the scene's choice (Scene configuration â†’
// Animater) as times the usual. Anything unknown is the usual.
export const CREATURE_AMOUNTS = Object.freeze({ none: 0, few: 0.5, '': 1, more: 2, many: 3 });
export const CREATURE_SIZES = Object.freeze({ small: 0.7, '': 1, big: 1.4, huge: 1.8 });
export const creatureAmount = (v) => CREATURE_AMOUNTS[String(v ?? '')] ?? 1;
export const creatureSize = (v) => CREATURE_SIZES[String(v ?? '')] ?? 1;

// One rat's next step (pure): `rat` { x, y, angle, speed, wait }; `dt` seconds; `grid` pixels a square. `lit(x, y)` says
// how lit a spot is (0 dark – 1 bright); `near` the creatures ([{ x, y }]); `blocked(a, b)` whether a wall stands between
// two points; `random()`. Rats dart and freeze, turn away from light and walls, and flee whoever comes within two squares.
export function ratStep(rat, { dt = 1 / 60, grid = 100, lit = () => 0, near = [], blocked = () => false, random = Math.random } = {}) {
  const r = { ...rat };
  r.wait -= dt;
  const threat = near.find((c) => Math.hypot(c.x - r.x, c.y - r.y) < grid * 2);
  if (threat) { r.angle = Math.atan2(r.y - threat.y, r.x - threat.x) + (random() - 0.5) * 0.6; r.speed = grid * 4; r.wait = 0.5; r.fleeing = true; }
  else if (r.wait <= 0) {
    r.fleeing = false;
    // Dart a little way or stop and sniff, turning as it goes.
    r.speed = r.speed > 0 && random() < 0.55 ? 0 : grid * (1.2 + 1.6 * random());
    r.angle += (random() - 0.5) * 2.2;
    r.wait = r.speed ? 0.25 + random() * 0.8 : 0.4 + random() * 1.6;
  }
  if (r.speed > 0) {
    const nx = r.x + Math.cos(r.angle) * r.speed * dt, ny = r.y + Math.sin(r.angle) * r.speed * dt;
    // Its snout a quarter square ahead of its middle: it turns before its head would go into the wall, not after.
    const snout = { x: nx + Math.cos(r.angle) * grid * 0.25, y: ny + Math.sin(r.angle) * grid * 0.25 };
    // Into the light or a wall: turn back (a fleeing rat runs through light rather than toward what scared it). Only into
    // brighter light: one caught in the light runs out of it, not round and round where it stands.
    const glare = !r.fleeing && lit(nx, ny) > 0.55 && lit(nx, ny) > lit(r.x, r.y);
    if (blocked({ x: r.x, y: r.y }, snout) || glare) { r.angle += Math.PI * (0.6 + 0.8 * random()); r.speed *= 0.6; }
    else { r.x = nx; r.y = ny; }
  }
  return r;
}

// How wide a bat can circle round a spot (pure): its loop (`r` across, 0.6 r up and down, wandering `wobble` more) cut
// down until no wall stands between the spot and anywhere on it (`blocked(a, b)`); at least half a square.
export function batReach(at, { r = 200, grid = 100, blocked = () => false } = {}) {
  let reach = r;
  for (let tries = 0; tries < 8 && reach > grid * 0.5; tries++) {
    const clear = Array.from({ length: 16 }, (_, i) => (i / 16) * TAU).every((a) => !blocked(at, { x: at.x + Math.sin(a) * (reach + grid * 0.4), y: at.y + Math.cos(a) * (reach * 0.6 + grid * 0.4) }));
    if (clear) return reach;
    reach *= 0.75;
  }
  return Math.max(grid * 0.5, reach);
}

// Where a few rats start (pure): dark spots near `spots` (candidate points, e.g. walls' ends), `count` at most.
export function ratsAt(spots = [], { count = 8, lit = () => 0, random = Math.random } = {}) {
  const dark = spots.filter((p) => lit(p.x, p.y) < 0.35);
  const out = [];
  for (let i = 0; i < count && dark.length; i++) {
    const p = dark[Math.floor(random() * dark.length)];
    out.push({ x: p.x, y: p.y, angle: random() * TAU, speed: 0, wait: random() * 2 });
  }
  return out;
}

// ---- Drawing ---------------------------------------------------------------------------------------------------------
// Where a creature's shadow falls from a light (pure): `from` { x, y, strength 0–1 } the light, `at` the creature, `high`
// how far above the floor it is (squares; a rat 0, a bat high in the air). Away from the light: a rat's just beside it,
// a flier's further the higher it flies and the nearer the light, bigger and softer. { x, y, scale, alpha }, or null
// without a light.
export function shadowFrom(from, at, { grid = 100, high = 0 } = {}) {
  if (!from || !(from.strength > 0)) return null;
  const dx = at.x - from.x, dy = at.y - from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const reach = high > 0 ? grid * (0.4 + high * 0.5) + (grid * grid * high * 0.25) / (d + grid * 0.5) : grid * 0.06;
  return { x: at.x + ux * reach, y: at.y + uy * reach, scale: high > 0 ? 1 + Math.min(1.2, (grid * high * 0.4) / (d + grid * 0.5)) : 1.08,
    alpha: Math.min(1, from.strength) * (high > 0 ? 0.32 / (1 + high * 0.3) : 0.5) };
}

// The rat and the bat as pictures, drawn once (several frames each) with shading, fur and shadow, then only moved,
// turned and swapped. A rat faces +x; a bat faces -y. Both lit from the upper left, as the map's own art usually is.
const RAT_W = 96, RAT_H = 48, RAT_FRAMES = 4, BAT_W = 128, BAT_H = 96, BAT_SPANS = [1, 0.86, 0.6, 0.34, 0.6, 0.86];
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// One rat frame: its four feet at `step` (0–1 of a stride), then its body over them.
function drawRat(ctx, step) {
  const cx = RAT_W / 2, cy = RAT_H / 2;
  ctx.save(); ctx.translate(cx, cy);
  // A soft shadow under it, away from the light.
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(3, 3, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
  // The feet, diagonal pairs moving together.
  const swing = Math.sin(step * Math.PI * 2) * 3.2;
  ctx.fillStyle = '#9a7e74';
  for (const [x, y, s] of [[13, -8.5, 1], [13, 8.5, -1], [-10, -9, -1], [-10, 9, 1]]) { ctx.beginPath(); ctx.ellipse(x + swing * s, y, 2.6, 1.7, 0, 0, Math.PI * 2); ctx.fill(); }
  // The body: a rounded rump, narrowing to the shoulders, a tapering head and snout.
  const body = new Path2D();
  body.moveTo(31, 0);
  body.bezierCurveTo(27, -4.5, 20, -6.5, 14, -6.8);
  body.bezierCurveTo(6, -9, -6, -11.5, -14, -10);
  body.bezierCurveTo(-23, -8, -24, 8, -14, 10);
  body.bezierCurveTo(-6, 11.5, 6, 9, 14, 6.8);
  body.bezierCurveTo(20, 6.5, 27, 4.5, 31, 0);
  const grad = ctx.createLinearGradient(-8, -12, 4, 12);
  grad.addColorStop(0, '#6b5a4f'); grad.addColorStop(0.45, '#4a3d35'); grad.addColorStop(1, '#2b231e');
  ctx.fillStyle = grad; ctx.fill(body);
  // Fur: short strokes along the body, lighter on the lit side.
  ctx.save(); ctx.clip(body);
  for (let i = 0; i < 260; i++) {
    const x = -24 + hash(i, 1) * 54, y = -11 + hash(i, 2) * 22, len = 2 + hash(i, 3) * 3, light = y < 0 ? 0.18 : 0.06;
    ctx.strokeStyle = hash(i, 4) < 0.5 ? `rgba(160,140,120,${light})` : 'rgba(20,14,10,0.22)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y + (hash(i, 5) - 0.5) * 1.2); ctx.stroke();
  }
  // The darker line of the back.
  ctx.strokeStyle = 'rgba(25,18,14,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(0, -1, 22, 0); ctx.stroke();
  ctx.restore();
  // Ears, pink inside; eyes with a glint; whiskers.
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#5a4840'; ctx.beginPath(); ctx.ellipse(15, s * 6.2, 3.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a07e78'; ctx.beginPath(); ctx.ellipse(15.4, s * 6.3, 1.9, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0a09'; ctx.beginPath(); ctx.arc(22.5, s * 3.2, 1.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(22.1, s * 3.2 - 0.7, 0.6, 0.6);
    ctx.strokeStyle = 'rgba(220,210,200,0.35)'; ctx.lineWidth = 0.4;
    for (let w = 0; w < 3; w++) { ctx.beginPath(); ctx.moveTo(29, s * 1.2); ctx.quadraticCurveTo(33, s * (3 + w * 2), 37, s * (2 + w * 3.5)); ctx.stroke(); }
  }
  ctx.fillStyle = '#c0958c'; ctx.beginPath(); ctx.arc(31, 0, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// One bat frame, its wings at `span` (1 spread wide – small: raised or folded in the stroke).
function drawBat(ctx, span) {
  const cx = BAT_W / 2, cy = BAT_H / 2;
  ctx.save(); ctx.translate(cx, cy);
  for (const s of [-1, 1]) {
    // The arm and the three long fingers, the membrane stretched between them, its edge scalloped between the tips.
    const sh = [s * 5, -3], wrist = [s * (14 + 10 * span), -10 + 4 * (1 - span)];
    const tips = [[s * (24 + 34 * span), -12 + 6 * (1 - span)], [s * (22 + 36 * span), 2], [s * (16 + 26 * span), 14], [s * 7, 14]];
    const wing = new Path2D();
    wing.moveTo(...sh); wing.lineTo(...wrist); wing.lineTo(...tips[0]);
    for (let i = 1; i < tips.length; i++) { const a = tips[i - 1], b = tips[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ix = (wrist[0] + sh[0]) / 2 - mx, iy = (wrist[1] + sh[1]) / 2 - my; wing.quadraticCurveTo(mx + ix * 0.22, my + iy * 0.22, ...b); }
    wing.closePath();
    const g = ctx.createLinearGradient(0, -14, s * 40, 16);
    g.addColorStop(0, 'rgba(58,44,40,0.95)'); g.addColorStop(1, 'rgba(34,26,24,0.88)');
    ctx.fillStyle = g; ctx.fill(wing);
    // The light through the thin membrane near its edge, and its bones.
    ctx.save(); ctx.clip(wing); ctx.strokeStyle = 'rgba(120,96,86,0.25)'; ctx.lineWidth = 3; ctx.stroke(wing); ctx.restore();
    ctx.strokeStyle = 'rgba(22,16,14,0.95)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(...sh); ctx.lineTo(...wrist); ctx.stroke();
    ctx.lineWidth = 0.8; for (const t of tips.slice(0, 3)) { ctx.beginPath(); ctx.moveTo(...wrist); ctx.lineTo(...t); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,22,20,1)'; ctx.beginPath(); ctx.arc(wrist[0] + s * 1.5, wrist[1] - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  // The furry body and head, ears pricked forward.
  const bg = ctx.createRadialGradient(-2, -2, 1, 0, 2, 11); bg.addColorStop(0, '#5c4a40'); bg.addColorStop(1, '#2a201c');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 3, 5.5, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2d27'; ctx.beginPath(); ctx.arc(0, -7, 4.2, 0, Math.PI * 2); ctx.fill();
  for (const s of [-1, 1]) { ctx.fillStyle = '#2e2420'; ctx.beginPath(); ctx.moveTo(s * 1.5, -9); ctx.lineTo(s * 4.5, -15); ctx.lineTo(s * 4.5, -8.5); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(140,118,100,0.25)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) { const x = (hash(i, 7) - 0.5) * 9, y = -4 + hash(i, 8) * 14; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash(i, 9) - 0.5) * 1.5, y + 2); ctx.stroke(); }
  ctx.restore();
}

/**
 * The layer: populate({ spots, count, lit, grid, size, batSize }) places the rats (sizes: times their usual); tick(seconds, { near, lit, blocked, view }) moves and
 * draws them (only those in `view`), and the bats when `bats` is on, their shadows passing over the floor; clear().
 */
export function createVermin({ PIXI, root, batsRoot = root }) {
  let rats = [], bats = [], shapes = [], batShapes = [], grid = 100, size = 1, batSize = 1, time = 0, ratTex = null, batTex = null;
  const frames = (w, h, n, paint) => Array.from({ length: n }, (_, i) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), i); return PIXI.Texture.from(c); });
  const ratFrames = () => (ratTex ??= frames(RAT_W, RAT_H, RAT_FRAMES, (ctx, i) => drawRat(ctx, i / RAT_FRAMES)));
  const batFrames = () => (batTex ??= frames(BAT_W, BAT_H, BAT_SPANS.length, (ctx, i) => drawBat(ctx, BAT_SPANS[i])));
  const sprite = (tex, parent) => { const sp = new PIXI.Sprite(tex); sp.anchor.set(0.5); sp.eventMode = 'none'; parent.addChild(sp); return sp; };
  const drop = () => { for (const s of [...shapes, ...batShapes]) { try { s.body?.destroy(); s.tail?.destroy(); s.shadow?.destroy(); } catch { /* gone */ } } shapes = []; batShapes = []; rats = []; bats = []; };
  return {
    populate({ spots = [], count = 8, lit = () => 0, grid: g = 100, bats: batCount = 0, area = null, blocked = () => false, size: big = 1, batSize: wide = 1 } = {}) {
      drop(); grid = g; size = Number(big) > 0 ? Number(big) : 1; batSize = Number(wide) > 0 ? Number(wide) : 1;
      rats = ratsAt(spots, { count, lit }).map((r) => ({ ...r, stride: Math.random() }));
      // The tail first, then the body over its root.
      shapes = rats.map(() => { const shadow = sprite(ratFrames()[0], root()); shadow.tint = 0x000000; const t = new PIXI.Graphics(); t.eventMode = 'none'; root().addChild(t); return { shadow, tail: t, body: sprite(ratFrames()[0], root()) }; });
      // Each bat circles a room (one of the spots, inside the walls), not over the rock; without spots, anywhere in `area`.
      const home = () => spots.length ? spots[Math.floor(Math.random() * spots.length)] : area && { x: area.x + area.w * (0.2 + 0.6 * Math.random()), y: area.y + area.h * (0.2 + 0.6 * Math.random()) };
      if (batCount > 0 && (spots.length || area)) bats = Array.from({ length: batCount }, (_, i) => {
        // Out in the room near a spot (not by its wall): of a few tries, the one with the widest loop clear of walls.
        const want = grid * (1.5 + 1.5 * Math.random());
        let best = null;
        for (let k = 0; k < 8; k++) {
          const h = home(), c = { x: h.x + (Math.random() - 0.5) * grid * 4, y: h.y + (Math.random() - 0.5) * grid * 4 };
          if (blocked(h, c)) continue;
          const r = batReach(c, { r: want, grid, blocked });
          if (!best || r > best.r) best = { c, r };
          if (r >= want) break;
        }
        best ??= (() => { const h = home(); return { c: h, r: batReach(h, { r: want, grid, blocked }) }; })();
        return { cx: best.c.x, cy: best.c.y, r: best.r, p: i * 1.7 };
      });
      // A bat flies high: its shadow on the floor (with the rats), the bat over everything.
      batShapes = bats.map(() => { const shadow = sprite(batFrames()[0], root()); shadow.tint = 0x000000; shadow.alpha = 0; return { body: sprite(batFrames()[0], batsRoot()), shadow }; });
    },
    tick(seconds, { near = [], lit = () => 0, blocked = () => false, view = null, light = () => null } = {}) {
      time += seconds;
      const dt = Math.min(0.05, seconds), seen = (x, y) => !view || (x > view.x - grid && y > view.y - grid && x < view.x + view.w + grid && y < view.y + view.h + grid);
      const k = (grid / 100) * size, kb = (grid / 100) * batSize, rt = ratFrames(), bt = batFrames();
      rats = rats.map((r, i) => {
        const n = ratStep(r, { dt, grid, lit, near, blocked });
        // Its feet step with how far it runs.
        n.stride = ((r.stride ?? 0) + (n.speed * dt) / (grid * 0.22)) % 1;
        const { body, tail: t, shadow } = shapes[i], show = seen(n.x, n.y);
        body.visible = t.visible = show;
        const cast = show ? shadowFrom(light(n.x, n.y), n, { grid }) : null;
        shadow.visible = !!cast;
        if (show) {
          body.texture = rt[Math.floor(n.stride * RAT_FRAMES) % RAT_FRAMES];
          body.position.set(n.x, n.y); body.rotation = n.angle; body.scale.set(k * 0.5);
          // Its shadow on the floor, away from the nearest light.
          if (cast) { shadow.texture = body.texture; shadow.position.set(cast.x, cast.y); shadow.rotation = n.angle; shadow.scale.set(k * 0.5 * cast.scale); shadow.alpha = cast.alpha; }
          // The tail: long, tapering, swinging behind it, quicker as it runs.
          const swing = Math.sin(time * (n.speed ? 14 : 2.5) + i) * (n.speed ? 5 : 2.5);
          t.clear(); t.position.set(n.x, n.y); t.rotation = n.angle;
          const pts = []; for (let s = 0; s <= 10; s++) { const f = s / 10; pts.push([(-11 - 22 * f) * k, Math.sin(f * 3 + time * (n.speed ? 14 : 2.5) + i) * swing * f * k * 0.6]); }
          for (let s = 0; s < 10; s++) { t.lineStyle((1.9 - 1.5 * (s / 10)) * k, 0x8a6d66, 0.95); t.moveTo(...pts[s]); t.lineTo(...pts[s + 1]); }
        }
        return n;
      });
      bats.forEach((b, i) => {
        const at = (u) => ({ x: b.cx + Math.sin(u * 0.7 + b.p) * b.r + Math.sin(u * 2.3 + b.p * 3) * Math.min(grid * 0.4, b.r * 0.25), y: b.cy + Math.cos(u * 0.9 + b.p) * b.r * 0.6 });
        const s = batShapes[i], p = at(time), ahead = at(time + 0.05), show = seen(p.x, p.y);
        const cast = show ? shadowFrom(light(p.x, p.y), p, { grid, high: 2 }) : null;
        s.body.visible = show; s.shadow.visible = !!cast;
        if (!show) return;
        const frame = bt[Math.floor((time * 11 + b.p * 3) % BAT_SPANS.length)], heading = Math.atan2(ahead.y - p.y, ahead.x - p.x) + Math.PI / 2;
        for (const sp of [s.body, s.shadow]) { sp.texture = frame; sp.rotation = heading; sp.scale.set(kb * 0.42); }
        s.body.position.set(p.x, p.y);
        // Its shadow flitting over the floor, thrown away from the nearest light: bigger and fainter the nearer the light.
        if (cast) { s.shadow.position.set(cast.x, cast.y); s.shadow.scale.set(kb * 0.42 * cast.scale); s.shadow.alpha = cast.alpha; }
      });
    },
    clear: drop,
    get count() { return rats.length + bats.length; },
  };
}

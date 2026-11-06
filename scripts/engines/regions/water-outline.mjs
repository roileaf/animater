import { isSimple } from "./water-detect.mjs";

export function outlinePoint(event, rect, width, height) {
  return { x: Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
    y: Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)) };
}

function projection(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return { x: ax + t * dx, y: ay + t * dy };
}

export function hitOutline(loops, event, rect, width, height, radius = 7) {
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const sx = rect.width / width, sy = rect.height / height;
  let edge = null, nearest = radius;
  for (let ring = 0; ring < loops.length; ring++) {
    const p = loops[ring].points;
    for (let i = 0; i < p.length; i += 2) {
      if (Math.hypot(x - p[i] * sx, y - p[i + 1] * sy) <= radius) return { ring, vertex: i / 2 };
      const j = (i + 2) % p.length;
      const at = projection(x, y, p[i] * sx, p[i + 1] * sy, p[j] * sx, p[j + 1] * sy);
      const distance = Math.hypot(x - at.x, y - at.y);
      if (distance <= nearest) { nearest = distance; edge = { ring, edge: i / 2, x: at.x / sx, y: at.y / sy }; }
    }
  }
  return edge;
}

const area = (p) => p.reduce((sum, v, i) => i % 2 ? sum : sum + v * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1], 0);
function inside(x, y, p) {
  let yes = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) yes = !yes;
  }
  return yes;
}
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function meet(a, i, b, j) {
  const k = (i + 2) % a.length, l = (j + 2) % b.length;
  if (Math.max(a[i], a[k]) < Math.min(b[j], b[l]) || Math.max(b[j], b[l]) < Math.min(a[i], a[k]) ||
      Math.max(a[i + 1], a[k + 1]) < Math.min(b[j + 1], b[l + 1]) || Math.max(b[j + 1], b[l + 1]) < Math.min(a[i + 1], a[k + 1])) return false;
  return cross(a[i], a[i + 1], a[k], a[k + 1], b[j], b[j + 1]) * cross(a[i], a[i + 1], a[k], a[k + 1], b[l], b[l + 1]) <= 0 &&
    cross(b[j], b[j + 1], b[l], b[l + 1], a[i], a[i + 1]) * cross(b[j], b[j + 1], b[l], b[l + 1], a[k], a[k + 1]) <= 0;
}

export function validateOutline(before, after, width, height) {
  if (before.length !== after.length) return "Keep the existing shores and holes.";
  for (let r = 0; r < after.length; r++) {
    const p = after[r].points, old = before[r].points;
    if (after[r].hole !== before[r].hole) return "Keep the existing shores and holes.";
    if (p.length === old.length && p.every((v, i) => v === old[i])) continue;
    if (p.length % 2 || p.length < 6 || new Set(p.filter((_, i) => i % 2 === 0).map((v, i) => `${v},${p[i * 2 + 1]}`)).size < 3) return "A ring needs at least three distinct vertices.";
    if (p.some((v, i) => !Number.isFinite(v) || v < 0 || v > (i % 2 ? height : width))) return "Keep edited vertices inside the map.";
    if (!area(p) || area(p) * area(old) <= 0) return "Keep the ring's direction and a nonzero area.";
    if (!isSimple(p)) return "The outline cannot cross or touch itself.";
  }
  for (let r = 0; r < after.length; r++) for (let s = r + 1; s < after.length; s++) {
    const a = after[r].points, b = after[s].points;
    for (let i = 0; i < a.length; i += 2) for (let j = 0; j < b.length; j += 2) if (meet(a, i, b, j)) return "Shores and holes cannot cross or touch.";
    for (const [i, j] of [[r, s], [s, r]]) {
      if (inside(after[i].points[0], after[i].points[1], after[j].points) !== inside(before[i].points[0], before[i].points[1], before[j].points)) return "Keep each hole inside its original shore and shores separate.";
    }
  }
  return "";
}

export function changeVertex(loops, { ring, vertex, action, x, y }) {
  return loops.map((loop, i) => {
    if (i !== ring) return loop;
    const points = [...loop.points];
    if (action === "insert") points.splice((vertex + 1) * 2, 0, x, y);
    else if (action === "delete") points.splice(vertex * 2, 2);
    else points.splice(vertex * 2, 2, x, y);
    return { ...loop, points };
  });
}

function simplifyArc(p, tolerance) {
  if (p.length <= 2) return p;
  const a = p[0], b = p.at(-1);
  let distance = tolerance, split = -1;
  for (let i = 1; i < p.length - 1; i++) {
    const at = projection(...p[i], ...a, ...b);
    const d = Math.hypot(p[i][0] - at.x, p[i][1] - at.y);
    if (d > distance) { distance = d; split = i; }
  }
  return split < 0 ? [a, b] : [...simplifyArc(p.slice(0, split + 1), tolerance).slice(0, -1), ...simplifyArc(p.slice(split), tolerance)];
}

export function smoothOutline(loops, maxDriftPx = 2) {
  return loops.map((loop) => {
    if (loop.hole) return loop;
    const p = Array.from({ length: loop.points.length / 2 }, (_, i) => loop.points.slice(i * 2, i * 2 + 2));
    let split = 1;
    for (let i = 2; i < p.length; i++) if (Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]) > Math.hypot(p[split][0] - p[0][0], p[split][1] - p[0][1])) split = i;
    const simple = [...simplifyArc(p.slice(0, split + 1), maxDriftPx / 2).slice(0, -1), ...simplifyArc([...p.slice(split), p[0]], maxDriftPx / 2).slice(0, -1)];
    const points = simple.flatMap((at, i) => [simple[(i + simple.length - 1) % simple.length], simple[(i + 1) % simple.length]].flatMap((next) => {
      const distance = Math.hypot(next[0] - at[0], next[1] - at[1]);
      const t = Math.min(0.25, maxDriftPx / 2 / (distance || 1));
      return [at[0] + (next[0] - at[0]) * t, at[1] + (next[1] - at[1]) * t];
    }));
    return { ...loop, points };
  });
}

// Split polygon edges at crossings, then retain the union's directed boundary.
export function unionOutlines(left, right) {
  const edges = (loops) => loops.flatMap((loop) => {
    let p = loop.points;
    if ((area(p) > 0) === loop.hole) p = Array.from({ length: p.length / 2 }, (_, i) => p.slice(i * 2, i * 2 + 2)).reverse().flat();
    return Array.from({ length: p.length / 2 }, (_, i) => ({ a: p.slice(i * 2, i * 2 + 2), b: [p[(i * 2 + 2) % p.length], p[(i * 2 + 3) % p.length]], cuts: [0, 1] }));
  });
  const a = edges(left), b = edges(right);
  const epsilon = 1e-9;
  const cut = (edge, point) => {
    const dx = edge.b[0] - edge.a[0], dy = edge.b[1] - edge.a[1];
    if (Math.abs(cross(...edge.a, ...edge.b, ...point)) > epsilon) return;
    const t = ((point[0] - edge.a[0]) * dx + (point[1] - edge.a[1]) * dy) / (dx * dx + dy * dy);
    if (t > 0 && t < 1) edge.cuts.push(t);
  };
  for (const e of a) for (const f of b) {
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], ux = f.b[0] - f.a[0], uy = f.b[1] - f.a[1];
    const denominator = dx * uy - dy * ux;
    if (Math.abs(denominator) < epsilon) { cut(e, f.a); cut(e, f.b); cut(f, e.a); cut(f, e.b); continue; }
    const vx = f.a[0] - e.a[0], vy = f.a[1] - e.a[1];
    const t = (vx * uy - vy * ux) / denominator, u = (vx * dy - vy * dx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { e.cuts.push(t); f.cuts.push(u); }
  }
  const contains = (x, y) => left.reduce((yes, loop) => yes !== inside(x, y, loop.points), false) || right.reduce((yes, loop) => yes !== inside(x, y, loop.points), false);
  const key = (p) => p.map((v) => Math.round(v * 1e8)).join(",");
  const boundary = new Map();
  for (const e of [...a, ...b]) {
    const cuts = [...new Set(e.cuts)].sort((x, y) => x - y);
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], length = Math.hypot(dx, dy);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] < epsilon) continue;
      const at = (t) => [e.a[0] + dx * t, e.a[1] + dy * t];
      const start = at(cuts[i - 1]), end = at(cuts[i]), mid = at((cuts[i - 1] + cuts[i]) / 2);
      const offset = Math.min(1e-6, length * (cuts[i] - cuts[i - 1]) / 10);
      if (contains(mid[0] + dy / length * offset, mid[1] - dx / length * offset)) continue;
      boundary.set(`${key(start)}>${key(end)}`, { start, end });
    }
  }
  const outgoing = new Map();
  for (const edge of boundary.values()) {
    const k = key(edge.start);
    if (outgoing.has(k)) throw new Error("The addition would make shores touch. Try a different click.");
    outgoing.set(k, edge);
  }
  const loops = [];
  while (outgoing.size) {
    const first = outgoing.values().next().value, points = [];
    let edge = first;
    do {
      if (!edge) throw new Error("The addition could not form a closed shore.");
      points.push(...edge.start); outgoing.delete(key(edge.start));
      edge = key(edge.end) === key(first.start) ? first : outgoing.get(key(edge.end));
    } while (edge !== first);
    if (!isSimple(points) || !area(points)) throw new Error("The addition would make an invalid shore.");
    loops.push({ points, hole: area(points) < 0 });
  }
  return loops;
}

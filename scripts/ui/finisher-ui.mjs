// The Finishers page, the studio's Finisher settings and the catalog entries' Finisher dropdown.
import { normalize, FINISHER_ON, FINISHER_ENDINGS, FINISHER_SUCCESS, FINISHER_WALLS } from "../core/model.mjs";
import { linkedFinisher, finisherTravelPath, finisherNames, finisherItemLink } from "../engines/finishers/finisher-model.mjs";
import { pathSquares, samplePath, normalizeKeyframes } from "../engines/motion/keyframe-path.mjs";
import { fragmentPieces, fragmentFlight, fragmentPose, normalizeFragments } from "../engines/fragments/fragments.mjs";
import { FINISHER_PRESETS, presetFinisher, BY_DAMAGE_TYPE } from "../engines/finishers/finisher-presets.mjs";
import { studioHTML } from "./studio.mjs";
import { finisherToursHTML } from "./finisher-tour.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const choices = (table, current) => Object.entries(table).map(([k, v]) => `<option value="${esc(k)}" ${String(current) === k ? "selected" : ""}>${esc(v)}</option>`).join("");
const hex = (v, fallback) => (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(String(v ?? "")) ? String(v) : fallback);

// ---- Finisher glyph: a small picture of what a finisher does, as inline SVG ----
// Viewbox 100x50. Drawn static (posed part-way through) by default; `live` draws the looping SMIL
// twin instead, which the page swaps in only while a card or tile is hovered or focused.
// No ids, so many glyphs can share one page.
const W = 100, H = 50, LOOP = 'dur="2.4s" repeatCount="indefinite"';
const num = (v, d = 1) => { const f = 10 ** d; return Number.isFinite(v) ? Math.round(v * f) / f + 0 : 0; };
const pt = (p) => `${num(p.x)} ${num(p.y)}`;
const wrap = (kind, color, size, body, extra = "", live = false) =>
  `<svg class="an-glyph${live ? " is-live" : ""}" data-kind="${kind}"${extra} viewBox="0 0 ${W} ${H}" width="${num(size * 2)}" height="${num(size)}" style="--glyph:${esc(color)}" aria-hidden="true" focusable="false">${body}</svg>`;

function travelGlyph(r, keyframes, live) {
  const samples = Array.from({ length: 24 }, (_, i) => samplePath(keyframes, i / 23));
  const xs = samples.map((p) => p.x), ys = samples.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(80 / Math.max(x1 - x0, 1e-6), 30 / Math.max(y1 - y0, 1e-6), 24);
  const at = (p) => ({ x: W / 2 + (p.x - (x0 + x1) / 2) * scale, y: H / 2 + (p.y - (y0 + y1) / 2) * scale });
  const pts = samples.map(at), d = `M${pts.map(pt).join(" L")}`, end = pts.at(-1);
  const fades = keyframes.at(-1).alpha <= 0.01;
  let wall = "";
  if (r.finisher?.wall === "slam") {
    const prev = pts.at(-2), dx = end.x - prev.x, dy = end.y - prev.y, len = Math.hypot(dx, dy);
    const u = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 }, c = { x: end.x + u.x * 5, y: end.y + u.y * 5 };
    wall = `<line class="an-glyph-wall" x1="${num(c.x - u.y * 10)}" y1="${num(c.y + u.x * 10)}" x2="${num(c.x + u.y * 10)}" y2="${num(c.y - u.x * 10)}"/>`;
  }
  const fade = fades ? `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.55;0.7;1" ${LOOP}/>` : "";
  return `<path class="an-glyph-trail" d="${d}"/><circle class="an-glyph-start" cx="${num(pts[0].x)}" cy="${num(pts[0].y)}" r="2"/>${wall}`
    + (live ? `<g class="an-glyph-anim"><circle class="an-glyph-dot" r="5"><animateMotion ${LOOP} path="${d}" keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="linear"/>${fade}</circle></g>`
    : `<g class="an-glyph-still"><circle class="an-glyph-dot" cx="${num(end.x)}" cy="${num(end.y)}" r="5"${fades ? ' opacity="0.4"' : ""}/></g>`);
}

function inPlaceGlyph(keyframes, live) {
  const poses = [0, 0.25, 0.5, 0.75, 1].map((q) => samplePath(keyframes, q));
  const values = (key, d) => [...poses.map((p) => num(p[key], d)), num(poses.at(-1)[key], d)].join(";");
  const times = 'keyTimes="0;0.175;0.35;0.525;0.7;1"';
  const token = `<circle class="an-glyph-dot" r="10"/><line class="an-glyph-notch" x1="0" y1="0" x2="0" y2="-10"/>`;
  if (!live) return `<g class="an-glyph-still"><g transform="translate(${W / 2} ${H / 2})">${token}</g></g>`;
  return `<g class="an-glyph-anim"><g transform="translate(${W / 2} ${H / 2})"><g><animateTransform attributeName="transform" type="rotate" values="${values("rotation", 0)}" ${times} ${LOOP}/>`
    + `<g><animateTransform attributeName="transform" type="scale" values="${values("scale", 2)}" ${times} ${LOOP}/><animate attributeName="opacity" values="${values("alpha", 2)}" ${times} ${LOOP}/>${token}</g></g></g></g>`;
}

// A convex piece of the token's unit square, cut to the token's circle (both convex).
const CIRCLE = Array.from({ length: 24 }, (_, i) => ({ x: 0.5 * Math.cos((i * Math.PI) / 12), y: 0.5 * Math.sin((i * Math.PI) / 12) }));
function clipConvex(pts, clipper) {
  let out = pts;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length], side = (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const input = out; out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    });
  }
  return out;
}

// Newer patterns get a line sketch of their cut over the pieces, and behaviours an arrow, so a
// 22px card glyph still reads. Explicit strokes, like the pieces, so no stylesheet is needed.
const GC = { x: W / 2, y: H / 2 }, GR = 15;
const MARK = 'class="an-glyph-mark" fill="none" stroke="#e8eaf2" stroke-width="1" stroke-linecap="round" opacity="0.75"';
const HINT = 'class="an-glyph-hint" fill="none" stroke="#e8eaf2" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
const polar = (a, r) => ({ x: GC.x + Math.cos(a) * r, y: GC.y + Math.sin(a) * r });
const markLine = (a, b) => `<line ${MARK} x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}"/>`;
const PATTERN_MARKS = {
  cross: (cut) => [cut + Math.PI / 4, cut - Math.PI / 4].map((a) => markLine(polar(a, -GR), polar(a, GR))).join(""),
  claw: (cut) => {
    const a = cut + Math.PI / 6, n = { x: -Math.sin(a), y: Math.cos(a) }, d = { x: Math.cos(a) * GR * 0.85, y: Math.sin(a) * GR * 0.85 };
    return [-0.25, 0, 0.25].map((o) => { const m = { x: GC.x + n.x * o * 2 * GR, y: GC.y + n.y * o * 2 * GR }; return markLine({ x: m.x - d.x, y: m.y - d.y }, { x: m.x + d.x, y: m.y + d.y }); }).join("");
  },
  diced: () => [-1, 1].flatMap((k) => [markLine({ x: GC.x + (k * GR) / 3, y: GC.y - GR }, { x: GC.x + (k * GR) / 3, y: GC.y + GR }), markLine({ x: GC.x - GR, y: GC.y + (k * GR) / 3 }, { x: GC.x + GR, y: GC.y + (k * GR) / 3 })]).join(""),
  starburst: () => Array.from({ length: 8 }, (_, i) => markLine(polar((i * Math.PI) / 4, GR * 0.35), polar((i * Math.PI) / 4, GR * 1.3))).join(""),
  rings: () => [0.4, 0.75].map((k) => `<circle ${MARK} cx="${GC.x}" cy="${GC.y}" r="${num(GR * k)}"/>`).join(""),
  pixelate: () => [[1.25, -0.6], [1.5, -0.2], [1.3, 0.3], [1.65, 0.55]].map(([x, y]) => `<rect ${MARK} x="${num(GC.x + x * GR - 1.5)}" y="${num(GC.y + y * GR - 1.5)}" width="3" height="3"/>`).join(""),
  ribbons: () => [-0.5, 0, 0.5].map((k) => `<path ${MARK} d="M${num(GC.x + k * GR)} ${GC.y - GR} q 3 5 0 10 t 0 10 t 0 10"/>`).join(""),
  // Four punctures along the swing.
  perforate: (cut) => [-0.6, -0.2, 0.2, 0.6].map((k) => { const p = polar(cut, k * GR); return `<circle ${MARK} cx="${num(p.x)}" cy="${num(p.y)}" r="1.8"/>`; }).join(""),
  // Three parallel cuts along the swing.
  slashes: (cut) => {
    const n = { x: -Math.sin(cut), y: Math.cos(cut) }, d = { x: Math.cos(cut) * GR * 0.9, y: Math.sin(cut) * GR * 0.9 };
    return [-0.3, 0, 0.3].map((o) => { const m = { x: GC.x + n.x * o * 2 * GR, y: GC.y + n.y * o * 2 * GR }; return markLine({ x: m.x - d.x, y: m.y - d.y }, { x: m.x + d.x, y: m.y + d.y }); }).join("");
  },
  // A spiderweb round the impact, on the attacker's side: two rings and seven spokes.
  crush: (cut) => {
    const c = { x: GC.x - Math.cos(cut) * GR * 0.5, y: GC.y - Math.sin(cut) * GR * 0.5 };
    const rings = [0.35, 0.7].map((k) => `<circle ${MARK} cx="${num(c.x)}" cy="${num(c.y)}" r="${num(GR * k)}"/>`).join("");
    return rings + Array.from({ length: 7 }, (_, i) => { const a = (i * 2 * Math.PI) / 7; return markLine(c, { x: c.x + Math.cos(a) * GR * 0.9, y: c.y + Math.sin(a) * GR * 0.9 }); }).join("");
  },
  // A zig-zag bolt along the swing.
  lightning: (cut) => {
    const u = { x: Math.cos(cut), y: Math.sin(cut) }, v = { x: -u.y, y: u.x };
    const pts = [0, 0.25, -0.25, 0.25, -0.25, 0].map((o, j) => { const t = -GR + (2 * GR * j) / 5; return { x: GC.x + u.x * t + v.x * o * GR, y: GC.y + u.y * t + v.y * o * GR }; });
    return `<path ${MARK} d="M${pts.map(pt).join(" L")}"/>`;
  },
};
function hintArrow(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const left = { x: to.x - ux * 4 - uy * 2.5, y: to.y - uy * 4 + ux * 2.5 }, right = { x: to.x - ux * 4 + uy * 2.5, y: to.y - uy * 4 - ux * 2.5 };
  return `<path ${HINT} d="M${pt(from)} L${pt(to)} M${pt(left)} L${pt(to)} L${pt(right)}"/>`;
}
const SIDE = GC.x + GR + 9, down = () => hintArrow({ x: SIDE, y: GC.y - 10 }, { x: SIDE, y: GC.y + 14 });
const BEHAVIOR_MARKS = {
  implode: () => [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => hintArrow(polar(a, GR + 9), polar(a, GR + 3))).join(""),
  absorb: () => `<circle class="an-glyph-attacker" cx="${ABSORB_X}" cy="${GC.y}" r="3"/>${hintArrow({ x: GC.x - GR - 3, y: GC.y }, { x: ABSORB_X + 6, y: GC.y })}`,
  rise: () => hintArrow({ x: SIDE, y: GC.y + 8 }, { x: SIDE, y: GC.y - 14 }),
  bounce: down,
  drip: down,
  // A down arrow onto a little heap.
  crumble: () => `${hintArrow({ x: SIDE, y: GC.y - 12 }, { x: SIDE, y: GC.y + 8 })}<path ${HINT} d="M${SIDE - 7} ${GC.y + 15} Q${SIDE} ${GC.y + 9} ${SIDE + 7} ${GC.y + 15}"/>`,
  // A squash bar under the token.
  flatten: () => `<path ${HINT} d="M${GC.x - GR - 4} ${GC.y + GR + 4} L${GC.x + GR + 4} ${GC.y + GR + 4} M${GC.x - 6} ${GC.y + GR + 1} L${GC.x + 6} ${GC.y + GR + 1}"/>`,
  // Vibration lines either side.
  shudder: () => [-1, 1].map((k) => `<path ${HINT} d="M${GC.x + k * (GR + 6)} ${GC.y - 8} l${2 * k} 4 l${-2 * k} 4 l${2 * k} 4 l${-2 * k} 4"/>`).join(""),
  // A box snapped out of place beside its outline.
  glitch: () => `<rect ${HINT} x="${SIDE - 5}" y="${GC.y - 9}" width="8" height="8"/><rect ${HINT} x="${SIDE - 2}" y="${GC.y - 5}" width="8" height="8" stroke-dasharray="2 2"/>`,
  sink: down,
};
const ABSORB_X = 8;

function fragmentsGlyph(stage, color, live) {
  const n = normalizeFragments(stage), cut = Math.PI / 5, R = 30, pieces = fragmentPieces(stage, cut);
  // Dust keeps every few specks so a glyph stays small; the flight still comes from the real index.
  const stride = Math.max(1, Math.ceil(pieces.length / 20));
  const shapes = pieces.map((p, i) => {
    if (i % stride) return null;
    const poly = clipConvex(p.polygon, CIRCLE).filter((q, j, all) => j === 0 || Math.hypot(q.x - all[j - 1].x, q.y - all[j - 1].y) > 1e-3);
    if (poly.length < 3) return null;
    const flight = fragmentFlight(stage, p, i, cut), end = flight.keyframes.at(-1), cx = W / 2 + p.centroid.x * R, cy = H / 2 + p.centroid.y * R;
    let dx = Math.max(-30, Math.min(30, end.x * R * 1.4)), dy = Math.max(-16, Math.min(16, end.y * R * 1.4)), grow = null;
    if (n.behavior) {
      // The end is an offset from the piece's start, in squares: use it as is, and the pose's scale and stretch.
      // Absorbed pieces land on the attacker mark instead, wherever the real attacker would be.
      if (n.behavior === "absorb") { dx = ABSORB_X - cx; dy = GC.y - cy; }
      else { dx = Math.max(-30, Math.min(30, end.x * R)); dy = Math.max(-16, Math.min(16, end.y * R)); }
      const pose = fragmentPose(stage, p, flight, 1);
      if (pose.scale !== 1 || pose.stretchX !== 1 || pose.stretchY !== 1) grow = { sx: pose.scale * pose.stretchX, sy: pose.scale * pose.stretchY, cx, cy };
    }
    const points = poly.map((q) => `${num(W / 2 + q.x * R)},${num(H / 2 + q.y * R)}`).join(" ");
    return { points, dx, dy, grow };
  }).filter(Boolean);
  // Explicit fill and outline so a piece never falls back to an invisible default if the stylesheet misses.
  const polygon = (s) => `<polygon class="an-glyph-piece" fill="${esc(color)}" stroke="#e8eaf2" stroke-width="1.2" stroke-linejoin="round" points="${s.points}"/>`;
  const ghost = `<circle class="an-glyph-ghost" cx="${W / 2}" cy="${H / 2}" r="${R}" fill="none" stroke="${esc(color)}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.45"/>`;
  const move = (s) => `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;${num(s.dx)} ${num(s.dy)};${num(s.dx)} ${num(s.dy)}" keyTimes="0;0.2;0.75;1" ${LOOP}/><animate attributeName="opacity" values="1;1;0.3;0.3" keyTimes="0;0.5;0.8;1" ${LOOP}/>`;
  // Shrinking or stretching pieces scale about their own centre, in nested groups so the animations do not clash.
  const sized = (s, grown) => {
    if (!s.grow) return polygon(s);
    const { sx, sy, cx, cy } = s.grow, ends = grown ? `${num(sx, 3)} ${num(sy, 3)}` : "1 1";
    const scale = grown ? `<animateTransform attributeName="transform" type="scale" values="1 1;1 1;${ends};${ends}" keyTimes="0;0.2;0.75;1" ${LOOP}/>` : "";
    return `<g transform="translate(${num(cx)} ${num(cy)})"><g${grown ? "" : ` transform="scale(${num(sx, 3)} ${num(sy, 3)})"`}>${scale}<g transform="translate(${num(-cx)} ${num(-cy)})">${polygon(s)}</g></g></g>`;
  };
  const marks = (PATTERN_MARKS[n.pattern]?.(cut) ?? "") + (BEHAVIOR_MARKS[n.behavior]?.() ?? "");
  if (live) return `${ghost}${marks}<g class="an-glyph-anim">${shapes.map((s) => `<g>${move(s)}${sized(s, true)}</g>`).join("")}</g>`;
  return `${ghost}${marks}<g class="an-glyph-still">${shapes.map((s) => `<g transform="translate(${num(s.dx * 0.35)} ${num(s.dy * 0.35)})">${sized(s, false)}</g>`).join("")}</g>`;
}

function knockbackGlyph(knockback, live) {
  const len = 10 + Math.min(6, Math.max(0, knockback)) * 6, from = 40, tip = from + 9 + len;
  const arrow = `<path class="an-glyph-arrow" d="M${from + 9} 25 L${tip - 5} 25"/><polygon class="an-glyph-arrow" points="${tip},25 ${tip - 6},21 ${tip - 6},29"/>`;
  return `<circle class="an-glyph-attacker" cx="20" cy="25" r="4"/>${arrow}`
    + (live ? `<g class="an-glyph-anim"><circle class="an-glyph-dot" cx="${from}" cy="25" r="7"><animateTransform attributeName="transform" type="translate" values="0 0;${num(len * 0.8)} 0;${num(len * 0.8)} 0" keyTimes="0;0.6;1" ${LOOP}/></circle></g>`
    : `<g class="an-glyph-still"><circle class="an-glyph-dot" cx="${from}" cy="25" r="7"/></g>`);
}

// `key`: the page's handle for the live twin (data-glyph-live), set on the static glyph only.
export function finisherGlyphSVG(recipe, { size = 80, live = false, key = "" } = {}) {
  const tag = !live && key ? ` data-glyph-live="${esc(key)}"` : "";
  const color = hex(recipe?.color, "#9e8aff"), stages = Array.isArray(recipe?.stages) ? recipe.stages : [];
  const path = finisherTravelPath(recipe), keyframes = path ? normalizeKeyframes(path.keyframes, { limit: 24 }) : null;
  const fragments = stages.find((s) => s?.kind === "motion" && s.motion === "fragments");
  if (keyframes && pathSquares(keyframes) >= 1) return wrap("travel", color, size, travelGlyph(recipe, keyframes, live), tag, live);
  if (fragments) {
    const n = normalizeFragments(fragments);
    return wrap("fragments", color, size, fragmentsGlyph(fragments, color, live), ` data-pattern="${esc(n.pattern)}"${n.behavior ? ` data-behavior="${esc(n.behavior)}"` : ""}${tag}`, live);
  }
  if (keyframes) return wrap("inplace", color, size, inPlaceGlyph(keyframes, live), tag, live);
  return wrap("knockback", color, size, knockbackGlyph(Number(recipe?.finisher?.knockback) || 0, live), tag, live);
}

// ---- The Finishers page ----
export const FINISHER_PRESET_GROUPS = {
  Flung: ["launch", "wall-slam", "sky-launch", "ragdoll-tumble", "jolt", "blast", "skewer", "struck-down"],
  "In place": ["ash", "melt", "ascend", "unmade", "soul-departs", "fall", "shaken-apart", "pancake", "cleave"],
  Pieces: ["slice-in-half", "bisect", "shatter-shards", "disintegrate", "shatter", "vortex-spiral", "diced", "claw-shred", "pixel-delete", "soul-drain", "frozen-shatter", "ember-ascent", "turn-to-dust",
    "perforated", "carved", "pulverized", "bled-out", "cinders", "frostbitten", "thunderstruck", "dissolved", "shattered-by-sound", "blown-apart", "consumed", "smitten", "unraveled", "withered"],
};
const ENDING_PILL = { vanish: "Vanish", body: "Body", stay: "Stay" };
// Live twins by key: a card's latest recipe (rebuilt on hover, since it can change), a preset's
// recipe and its cached string. Static preset tiles never change, so their strings are cached too.
const LIVE = new Map(), PRESET_GLYPHS = new Map(), LIVE_CAP = 500;
const presetRecipe = (id) => { try { return presetFinisher(id, `preset-${id}`); } catch { return FINISHER_PRESETS[id].build(); } };
export function presetGlyph(id) {
  if (!PRESET_GLYPHS.has(id)) {
    const r = presetRecipe(id);
    LIVE.set(`preset:${id}`, { recipe: r, size: 22 });
    PRESET_GLYPHS.set(id, finisherGlyphSVG(r, { size: 22, key: `preset:${id}` }));
  }
  return PRESET_GLYPHS.get(id);
}
function cardGlyph(r) {
  const key = `card:${r.id}`;
  if (!LIVE.has(key) && LIVE.size >= LIVE_CAP) for (const k of LIVE.keys()) if (k.startsWith("card:")) { LIVE.delete(k); break; }
  LIVE.set(key, { recipe: r, size: 80 });
  return finisherGlyphSVG(r, { key });
}
export function liveGlyphSVG(key) {
  const entry = LIVE.get(key);
  if (!entry) return null;
  if (key.startsWith("preset:")) return (entry.svg ??= finisherGlyphSVG(entry.recipe, { size: entry.size, live: true }));
  return finisherGlyphSVG(entry.recipe, { size: entry.size, live: true });
}

// One delegated hook per document: hovering or focusing a card or tile puts its looping twin next
// to the static glyph (hidden meanwhile); leaving removes it. Bound from here so the page needs no
// workspace wiring; a re-render patches the extra node away and the static glyph shows again.
const BOUND = new WeakSet(), HOSTS = ".an-finishers .an-fcard, .an-finishers .an-preset-tile";
function glyphHover(doc, event, on) {
  const host = event.target?.closest?.(HOSTS);
  if (!host || host.contains(event.relatedTarget)) return;
  const still = host.querySelector("svg.an-glyph[data-glyph-live]");
  if (!still) return;
  const live = host.querySelector("svg.an-glyph.is-live");
  if (!on) { live?.remove(); still.style.removeProperty("display"); return; }
  if (live || doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const markup = liveGlyphSVG(still.dataset.glyphLive);
  if (!markup) return;
  still.insertAdjacentHTML("afterend", markup);
  still.style.display = "none";
}
export function bindGlyphHover(doc = globalThis.document) {
  if (typeof doc?.addEventListener !== "function" || BOUND.has(doc)) return false;
  BOUND.add(doc);
  for (const [type, on] of [["pointerover", true], ["focusin", true], ["pointerout", false], ["focusout", false]])
    doc.addEventListener(type, (event) => glyphHover(doc, event, on));
  return true;
}

function cardChipsHTML(r, itemSummary) {
  const list = finisherNames(r.match), legacy = r.itemUuid ? itemSummary?.(r.itemUuid) : null;
  const linkOf = (n) => finisherItemLink(r.finisher, n) ?? (r.itemUuid && (!legacy || normalize(legacy.name) === normalize(n)) ? r.itemUuid : null);
  const chip = (n) => { const uuid = linkOf(n), info = uuid ? itemSummary?.(uuid) : null; return `<span class="an-fcard-chip"><img src="${esc(info?.img || "icons/svg/item-bag.svg")}" alt="">${esc(n)}</span>`; };
  if (!list.length) return r.itemUuid ? chip(legacy?.name || "One bound item") : `<small>Not assigned yet</small>`;
  return list.slice(0, 3).map(chip).join("") + (list.length > 3 ? `<span class="an-fcard-chip is-more">+${list.length - 3}</span>` : "");
}

function playersPill(f, players) {
  const has = f.players ?? [];
  const who = has.includes("*") ? "All players" : players.filter((p) => has.includes(p.id)).map((p) => `<i class="an-player-dot" style="background:${esc(hex(p.color, "#a6aec2"))}"></i>${esc(p.name)}`).join(", ");
  return `<span class="an-pill an-pill-players">${who === "All players" ? who : who ? `Players: ${who}` : "GM only"}</span>`;
}

function finisherCardHTML(r, players, itemSummary, playerPicks) {
  const f = r.finisher, path = finisherTravelPath(r), squares = path ? pathSquares(normalizeKeyframes(path.keyframes, { limit: 24 })) : 0;
  const reach = path ? (squares ? `Travels ${squares} sq` : "In place") : f.knockback ? `Knockback: ${f.knockback} sq` : "Knockback: none";
  const id = esc(r.id), off = r.enabled === false;
  return `<article class="an-card an-fcard${off ? " is-off" : ""}" data-action="select" data-id="${id}" style="--effect:${esc(hex(r.color, "#9e8aff"))}">`
    + `<button type="button" data-action="select" data-id="${id}" class="an-fcard-open" aria-label="Open ${esc(r.name)}">`
    + `<div class="an-art an-fcard-art">${cardGlyph(r)}<span class="an-fcard-badges"><span class="an-fcard-badge">${esc(FINISHER_ON[f.on])}</span>${off ? `<span class="an-fcard-badge is-off">Off</span>` : ""}</span></div>`
    + `<div class="an-card-body"><h2>${esc(r.name)}</h2><div class="an-fcard-chips">${cardChipsHTML(r, itemSummary)}</div>`
    + `<div class="an-fcard-pills"><span class="an-pill">Ending: ${esc(ENDING_PILL[f.ending] ?? FINISHER_ENDINGS[f.ending] ?? f.ending)}</span><span class="an-pill">${esc(reach)}</span>${playerPicks ? playersPill(f, players) : ""}</div></div></button>`
    + `<span class="an-fcard-actions"><button type="button" data-action="select" data-id="${id}" class="an-fcard-quick">Edit</button><button type="button" data-action="recipe-menu-duplicate" data-id="${id}" class="an-fcard-quick">Duplicate</button></span></article>`;
}

// The preset groups never change: built once.
let PRESET_GROUPS_HTML = null;
function presetGroupsHTML() {
  const tile = (id) => { const p = FINISHER_PRESETS[id]; return `<button type="button" data-action="new-finisher" data-preset="${esc(id)}" data-tooltip="${esc(p.description)}" class="an-preset-tile">${presetGlyph(id)}<span>${esc(p.name)}</span></button>`; };
  return (PRESET_GROUPS_HTML ??= Object.entries(FINISHER_PRESET_GROUPS).map(([name, ids]) => `<div class="an-preset-group"><h3 class="an-preset-heading">${esc(name)}</h3><div class="an-preset-tiles">${ids.filter((id) => FINISHER_PRESETS[id]).map(tile).join("")}</div></div>`).join(""));
}

export function finishersPageHTML(w, recipe) {
  if (w.studio && recipe) return studioHTML(w, recipe);
  bindGlyphHover();
  const all = w.listedRecipes().filter((r) => r.finisher), def = w.host.defaultFinisher?.() ?? "";
  const players = w.host.players?.() ?? [], itemSummary = w.host.itemSummary ? (uuid) => w.host.itemSummary(uuid) : null;
  const playerPicks = w.host.playerPicks?.() === true;
  const cards = all.map((r) => finisherCardHTML(r, players, itemSummary, playerPicks)).join("");
  const groups = presetGroupsHTML();
  return `<div class="an-work is-library"><section class="an-library an-finishers">
    <div class="an-finishers-sub"><span>${all.length} finisher${all.length === 1 ? "" : "s"}</span><small>Assign them to spells, feats, actions and weapons. They play on the real token.</small></div>
    <label class="an-finisher-default"><span>Default finisher for other kills</span><select data-finisher-default><option value="">None (plain collapse)</option><option value="${BY_DAMAGE_TYPE}" ${def === BY_DAMAGE_TYPE ? "selected" : ""}>By damage type (built-in)</option>${all.map((r) => `<option value="${esc(r.id)}" ${r.id === def ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
    <p class="an-hint">Plays for NPC kills when no finisher matches the item.</p>
    ${def === BY_DAMAGE_TYPE ? `<p class="an-hint" data-finisher-default-hint>Plays the built-in finisher that matches the killing blow's damage type (Perforated for piercing, Cinders for fire…).</p>` : ""}
    ${cards ? `<div class="an-grid an-fcard-grid">${cards}</div>` : `<div class="an-empty an-finishers-empty">No finishers yet. Pick a preset below or start blank.</div>`}
    <div class="an-section-title"><span>Presets</span><small>Copy one to make it yours</small>${finisherToursHTML(w.showFinisherTours)}</div>
    <div class="an-preset-groups">${groups}<div class="an-preset-tiles"><button type="button" data-action="new-finisher" class="an-preset-tile is-blank">+ Blank finisher</button></div></div>
  </section></div>`;
}

// Applies to: one card per name in `match`, shaped like a recipe's bound item. A name dropped
// from an item (or the legacy bound item's name) opens that item; a typed name is matched by name only.
const capital = (v) => (v ? v[0].toUpperCase() + v.slice(1) : "");
const unbindHTML = (n) => `<button type="button" class="an-bound-unbind" data-action="finisher-unlink" data-name="${esc(n)}" aria-label="Remove ${esc(n)}" data-tooltip="Remove ${esc(n)}">Unbind</button>`;
function appliesCardHTML(n, uuid, itemSummary) {
  if (!uuid) return `<div class="an-bound is-by-name"><div class="an-bound-item"><img src="icons/svg/item-bag.svg" alt=""><span><b>${esc(n)}</b><small>By name</small></span></div>${unbindHTML(n)}</div>`;
  const info = itemSummary?.(uuid) ?? null;
  const meta = info ? [capital(info.type), info.source].filter(Boolean).join(" · ") : "Item not found";
  return `<div class="an-bound"><button type="button" class="an-bound-item" data-action="open-bound" data-uuid="${esc(uuid)}" data-tooltip="Open ${esc(n)}<br><small>${esc(uuid)}</small>" ${info ? "" : "disabled"}><img src="${esc(info?.img || "icons/svg/item-bag.svg")}" alt=""><span><b>${esc(n)}</b><small>${esc(meta)}</small></span></button>${unbindHTML(n)}</div>`;
}
function appliesToHTML(r, itemSummary) {
  const list = finisherNames(r.match), legacy = r.itemUuid ? itemSummary?.(r.itemUuid) : null;
  const linkOf = (n) => finisherItemLink(r.finisher, n) ?? (legacy && normalize(legacy.name) === normalize(n) ? r.itemUuid : null);
  const cards = list.map((n) => appliesCardHTML(n, linkOf(n), itemSummary)).join("");
  return `<div class="an-finisher-applies"><span class="an-label">Applies to</span>
    <div class="an-finisher-cards${list.length ? "" : " is-empty"}">${cards || `<small>No items yet. Drop one below or add a name.</small>`}</div>
    <div class="an-finisher-drop" data-finisher-drop>Drop spells, feats, actions, weapons or items here</div>
    <input data-finisher-add aria-label="Add a name" placeholder="Add a name…"></div><p class="an-hint">Matched by item name. The Finisher dropdown on catalog entries edits this list too.</p>`;
}

function availableToHTML(f, players) {
  const has = f.players ?? [], everyone = has.includes("*");
  const boxes = players.map((p) => `<label class="an-check"><input type="checkbox" data-finisher-player="${esc(p.id)}" ${has.includes(p.id) ? "checked" : ""} ${everyone ? "disabled" : ""}><i class="an-player-dot" style="background:${esc(p.color)}"></i>${esc(p.name)}</label>`).join("");
  return `<div class="an-finisher-players"><span class="an-label">Available to</span><label class="an-check"><input type="checkbox" data-finisher-player="*" ${everyone ? "checked" : ""}>All players</label>${boxes}</div><p class="an-hint">Chosen players can pick this finisher for their own items in Combater. A player's pick replaces Applies-to for that item; with no pick, Applies-to and the default finisher still play.</p>`;
}

// "Needs" only means something for a use or a killing blow (a critical is always critical):
// it shows for those two, with what it decides there. The stored value stays as it is.
const NEEDS_HINTS = { use: "Which results count as a successful use.", kill: "Critical only: the killing blow must itself be a critical." };
const needsHTML = (f, select) => (NEEDS_HINTS[f.on] ? `${select("success", "Needs", FINISHER_SUCCESS)}<p class="an-hint">${esc(NEEDS_HINTS[f.on])}</p>` : "");

// The At walls option in effect, with what it does.
const WALL_HINTS = { slam: "Flies toward the nearest wall within reach (never back toward the attacker) and crashes into it." };

// Available to only decides what players may pick in pf2e-combater (playerPicks): hidden without it.
export function finisherSettingsHTML(r, { itemSummary, players = [], playerPicks = false } = {}) {
  const f = r.finisher, path = finisherTravelPath(r), select = (key, label, table) => `<label>${label}<select data-field="finisher.${key}">${choices(table, f[key])}</select></label>`;
  return `<div class="an-editor-section an-binding an-finisher"><div class="an-section-title"><b>Finisher</b><label class="an-check"><input type="checkbox" data-field="enabled" ${r.enabled ? "checked" : ""}>Enabled</label></div>
    <label>Description<textarea aria-label="Description" data-field="description" rows="2" class="an-description">${esc(r.description)}</textarea></label>
    ${appliesToHTML(r, itemSummary)}
    ${select("on", "Plays on", FINISHER_ON)}${playerPicks ? availableToHTML(f, players) : ""}${needsHTML(f, select)}
    ${path ? `<p class="an-hint">Lands where its keyframed path ends (${pathSquares(path.keyframes)} sq), away from the attacker and stopping at walls.</p>${select("wall", "At walls", FINISHER_WALLS)}${WALL_HINTS[f.wall] ? `<p class="an-hint">${esc(WALL_HINTS[f.wall])}</p>` : ""}` : `<label>Knockback (squares)<input type="number" min="0" max="6" step="1" data-field="finisher.knockback" value="${f.knockback}"></label><p class="an-hint">Shoves the target this far away from the attacker before the rest plays (stops at walls).</p>`}
    ${select("ending", "Ending", FINISHER_ENDINGS)}
    <p class="an-hint">${path ? "A stage named “landing” plays where it lands." : "Set a travel motion's End to “Hold at the end”: knockback replaces its distance and the token is moved to where it lands, stopping at walls. A stage named “landing” plays there."} Vanish and Body apply only to a creature at 0 HP.</p></div>`;
}

// `uuid`: the catalog entry's item, remembered for its Applies-to card when given.
export function finisherLinkHTML(w, entryName, uuid) {
  const finishers = w.host.recipes().filter((r) => r.finisher);
  if (!finishers.length || !entryName) return "";
  const current = linkedFinisher(finishers, entryName)?.id ?? "";
  return `<label class="an-finisher-link">Finisher<select data-finisher-link="${esc(entryName)}"${uuid ? ` data-finisher-uuid="${esc(uuid)}"` : ""}><option value="">None</option>${finishers.map((r) => `<option value="${esc(r.id)}" ${r.id === current ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`;
}

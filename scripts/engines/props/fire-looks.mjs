// What a spreading fire leaves on the map for everyone to see: the pulsing edge of something about to catch, and the
// scorched ground a burnt grass square becomes. Both are read from what is stored on the documents, so every screen
// draws the same thing, and both are painted (ink outline, stepped tones), never a glow filter.
// The picking and the pulse are pure; only createFireLooks touches PIXI.
import { seededRandom } from "../fragments/fragments.mjs";
import { readFire, HEAT_WARN, HEAT_CATCH } from "./fire-spread.mjs";

// The things that are smouldering: at or over the warning heat and not yet alight. `heat` is how far they are from
// the warning heat to catching (0-1), which is how hard the edge pulses. Things are {id, fire} (a tile's flag, a
// decoration's saved entry: read through readFire, never raw).
export function warmEdges(things) {
  const out = [];
  for (const t of things ?? []) {
    const fire = readFire(t?.fire ?? null);
    if (!fire || fire.burning || !(fire.heat >= HEAT_WARN)) continue;
    out.push({ id: t.id, heat: Math.max(0, Math.min(1, (fire.heat - HEAT_WARN) / (HEAT_CATCH - HEAT_WARN))) });
  }
  return out;
}

// The grass squares of a region that have burnt out: charred, and so scorched ground until Repair. The saved cells
// are read through fireCellsOf by the caller; the keys are square indices.
export function charredCells(saved) {
  return Object.entries(saved ?? {}).filter(([, c]) => c?.charred === true).map(([key]) => Number(key)).filter(Number.isInteger).sort((a, b) => a - b);
}

// The grass squares with fire on them now: the ones alight (flames, `burning`) and the ones only warming (the same
// ember edge a prop about to catch shows, so grass and props read alike). A charred square is out for good and
// shows only its scorch. `heat` is 0-1 as warmEdges measures it, and 1 for one alight.
export function litCells(saved) {
  const out = [];
  for (const [key, c] of Object.entries(saved ?? {})) {
    const i = Number(key);
    if (!Number.isInteger(i) || c?.charred === true) continue;
    const fire = readFire(c);
    if (!fire) continue;
    if (fire.burning) { out.push({ i, burning: true, heat: 1 }); continue; }
    if (fire.heat >= HEAT_WARN) out.push({ i, burning: false, heat: Math.max(0, Math.min(1, (fire.heat - HEAT_WARN) / (HEAT_CATCH - HEAT_WARN))) });
  }
  return out.sort((a, b) => a.i - b.i);
}

// How bright a warm edge burns at `ms`, 0-1: a slow swell that quickens and deepens the closer the thing is to
// catching. Pure, so the pulse is the same wherever it is drawn.
export function firePulse(ms, heat = 0) {
  const h = Math.max(0, Math.min(1, Number(heat) || 0));
  const period = 1600 - 700 * h;
  return (0.3 + 0.35 * h) + (0.25 + 0.1 * h) * (0.5 + 0.5 * Math.sin((2 * Math.PI * (Number(ms) || 0)) / period));
}

// The still glow a settled fire keeps: the middle of its swell. Heat never cools on its own, so a prop warmed by a
// fire that has since burnt out stays warm for the rest of the session; it goes on showing its edge, at this
// brightness, instead of breathing at sixty frames a second for ever.
export function fireSteady(heat = 0) {
  const h = Math.max(0, Math.min(1, Number(heat) || 0));
  return (0.3 + 0.35 * h) + (0.25 + 0.1 * h) * 0.5;
}

// How long the fire keeps breathing after anything last changed. A round is six seconds, so a fire that is really
// going is woken again long before this runs out; it is only fire that has stopped changing that settles.
export const PULSE_QUIET_MS = 20000;

const INK = 0x1b1410, EMBER = 0xff8a30, EMBER_CORE = 0xffd08a, SOOT = [0x2a2420, 0x4a403a];

// The painted looks of fire on the map. `layer()` gives the container the warm edges are drawn in (over the props,
// so an edge is never hidden by what carries it) and `floor()` the one the scorch is drawn in (under the props, so
// burnt ground never paints over a prop standing on it). `grid()` is the square size and `now()` the shared clock
// the pulse is read from, so the swell is in step on every screen.
// sync({edges, flames, scorch}) is given everything that should show now: edges are {id, rect:{x,y,w,h}, rotation,
// heat}, flames are the burning grass squares {id, rect, seed}, scorch are {id, rect, seed}. Anything left out goes.
// The edges and the flames breathe while anything is changing and settle still when nothing is (the heat of a prop
// warmed by a fire that is already out never changes again); the scorch is still from the first.
export function createFireLooks({ PIXI, layer, floor = layer, grid = () => 100, now = () => 0 }) {
  let box = null, under = null, edgeArt = null, flameArt = null, scorchArt = null, raf = 0;
  let edges = [], flames = [], scorched = "", shown = "", liveUntil = 0;
  const ensure = () => {
    const root = layer?.(), below = floor?.();
    if (!root || !below) return null;
    if (!box || box.destroyed) { box = new PIXI.Container(); flameArt = new PIXI.Graphics(); edgeArt = new PIXI.Graphics(); box.addChild(flameArt); box.addChild(edgeArt); }
    if (!under || under.destroyed) { under = new PIXI.Container(); scorchArt = new PIXI.Graphics(); under.addChild(scorchArt); }
    if (box.parent !== root) root.addChild(box);
    if (under.parent !== below) below.addChild(under);
    return box;
  };
  // The four corners of a rectangle, turned about its middle as the tile is turned.
  const corners = ({ x, y, w, h }, rotation = 0) => {
    const cx = x + w / 2, cy = y + h / 2, a = ((Number(rotation) || 0) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  };
  const drawEdges = (ms, still) => {
    if (!edgeArt) return;
    edgeArt.clear();
    const k = (grid() || 100) / 100;
    for (const e of edges) {
      const pts = corners(e.rect, e.rotation), glow = still ? fireSteady(e.heat) : firePulse(ms, e.heat);
      edgeArt.lineStyle(3.5 * k, EMBER, Math.min(1, glow * 0.8)).drawPolygon(pts);
      edgeArt.lineStyle(1.4 * k, EMBER_CORE, Math.min(1, glow)).drawPolygon(pts);
      edgeArt.lineStyle(1.1 * k, INK, 0.5).drawPolygon(pts);
    }
  };
  // A burning square of grass: a few painted tongues of flame leaning out of the square, each a stepped shape (a
  // wide ember one with a hot core inside it) under a thin ink outline, as a burning prop's flames are drawn. Their
  // number, their feet and their lean are seeded from the square's own index, so the same square burns the same way
  // on every screen; the swell is the shared clock's, so they lean together too.
  const drawFlames = (ms, still) => {
    if (!flameArt) return;
    flameArt.clear();
    const k = (grid() || 100) / 100;
    for (const f of flames) {
      const rand = seededRandom((f.seed >>> 0) || 1), { x, y, w, h } = f.rect;
      const glow = still ? fireSteady(1) : firePulse(ms, 1);
      const count = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < count; i++) {
        const foot = x + w * (0.18 + 0.64 * rand()), base = y + h * (0.55 + 0.35 * rand());
        const wide = w * (0.16 + 0.1 * rand()), tall = h * (0.34 + 0.3 * rand()) * (0.75 + 0.35 * glow);
        const lean = (rand() - 0.5) * w * 0.2 + Math.sin((2 * Math.PI * ms) / 900 + i) * w * 0.05;
        const tongue = (s) => [foot - wide * s, base, foot - wide * s * 0.45, base - tall * s * 0.55,
          foot + lean * s, base - tall * s, foot + wide * s * 0.5, base - tall * s * 0.5, foot + wide * s, base];
        flameArt.beginFill(EMBER, Math.min(1, 0.45 + 0.35 * glow)).drawPolygon(tongue(1)).endFill();
        flameArt.beginFill(EMBER_CORE, Math.min(1, 0.4 + 0.4 * glow)).drawPolygon(tongue(0.5)).endFill();
        flameArt.lineStyle(1.1 * k, INK, 0.45).drawPolygon(tongue(1));
        flameArt.lineStyle(0);
      }
    }
  };
  // The swell is read off the shared clock, not this screen's own, so every screen is at the same point in it. It
  // breathes only while something is still changing (liveUntil, set on each sync that brings something new); after
  // that the loop stops and the last frame is redrawn still, so the edge and the flames stay on screen at no cost.
  const tick = () => {
    const ms = Number(now()) || 0, lively = ms < liveUntil;
    drawEdges(ms, !lively);
    drawFlames(ms, !lively);
    raf = (edges.length || flames.length) && lively ? requestAnimationFrame(tick) : 0;
  };
  // A burnt square: a soot patch of its own, stepped (a wide faint one with a darker one inside), its ragged outline
  // seeded from the square so every screen burns the same ground.
  const drawScorch = (list) => {
    if (!scorchArt) return;
    scorchArt.clear();
    for (const s of list) {
      const rand = seededRandom((s.seed >>> 0) || 1), cx = s.rect.x + s.rect.w / 2, cy = s.rect.y + s.rect.h / 2;
      const r = Math.min(s.rect.w, s.rect.h) / 2;
      const ring = (scale, wobble) => {
        const pts = [];
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * Math.PI * 2, rr = r * scale * (1 - wobble / 2 + rand() * wobble);
          pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        return pts;
      };
      scorchArt.beginFill(SOOT[1], 0.38).drawPolygon(ring(1.02, 0.22)).endFill();
      scorchArt.beginFill(SOOT[0], 0.5).drawPolygon(ring(0.72, 0.3)).endFill();
    }
  };
  return {
    sync({ edges: warm = [], flames: lit = [], scorch = [] } = {}) {
      if (!ensure()) return;
      edges = warm.filter((e) => e?.rect);
      flames = lit.filter((f) => f?.rect);
      const key = scorch.map((s) => s.id).join("|");
      if (key !== scorched) { scorched = key; drawScorch(scorch.filter((s) => s?.rect)); }
      // Anything new or hotter than last time wakes the swell for a while; the same fire as before leaves it alone,
      // so a prop left warm by a fire long out is drawn once and then costs nothing.
      const mark = [...edges.map((e) => `${e.id}@${e.heat}`), ...flames.map((f) => `f:${f.id}`)].join("|");
      const ms = Number(now()) || 0;
      if (mark !== shown) { shown = mark; liveUntil = ms + PULSE_QUIET_MS; }
      if ((edges.length || flames.length) && !raf) raf = requestAnimationFrame(tick);
      else if (!edges.length && !flames.length) { cancelAnimationFrame(raf); raf = 0; drawEdges(0, true); drawFlames(0, true); }
    },
    clear() {
      cancelAnimationFrame(raf); raf = 0; edges = []; flames = []; scorched = ""; shown = ""; liveUntil = 0;
      try { edgeArt?.clear(); flameArt?.clear(); scorchArt?.clear(); box?.destroy({ children: true }); under?.destroy({ children: true }); } catch { /* gone */ }
      box = null; under = null; edgeArt = null; flameArt = null; scorchArt = null;
    },
  };
}

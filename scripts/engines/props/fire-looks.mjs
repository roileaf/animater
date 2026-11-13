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

// How bright a warm edge burns at `ms`, 0-1: a slow swell that quickens and deepens the closer the thing is to
// catching. Pure, so the pulse is the same wherever it is drawn.
export function firePulse(ms, heat = 0) {
  const h = Math.max(0, Math.min(1, Number(heat) || 0));
  const period = 1600 - 700 * h;
  return (0.3 + 0.35 * h) + (0.25 + 0.1 * h) * (0.5 + 0.5 * Math.sin((2 * Math.PI * (Number(ms) || 0)) / period));
}

const INK = 0x1b1410, EMBER = 0xff8a30, EMBER_CORE = 0xffd08a, SOOT = [0x2a2420, 0x4a403a];

// The painted looks of fire on the map. `layer()` gives the container to draw in, `grid()` the square size.
// sync({edges, scorch}) is given everything that should show now: edges are {id, rect:{x,y,w,h}, rotation, heat},
// scorch are {id, rect, seed}. Anything left out goes. The edges breathe on their own; the scorch is still.
export function createFireLooks({ PIXI, layer, grid = () => 100 }) {
  let box = null, edgeArt = null, scorchArt = null, raf = 0, edges = [], scorched = "";
  const start = (typeof performance === "object" && performance?.now ? () => performance.now() : () => Date.now())();
  const ensure = () => {
    const root = layer?.();
    if (!root) return null;
    if (!box || box.destroyed) {
      box = new PIXI.Container();
      box.sortableChildren = true;
      scorchArt = new PIXI.Graphics(); scorchArt.zIndex = 0;
      edgeArt = new PIXI.Graphics(); edgeArt.zIndex = 1;
      box.addChild(scorchArt, edgeArt);
    }
    if (box.parent !== root) root.addChild(box);
    return box;
  };
  // The four corners of a rectangle, turned about its middle as the tile is turned.
  const corners = ({ x, y, w, h }, rotation = 0) => {
    const cx = x + w / 2, cy = y + h / 2, a = ((Number(rotation) || 0) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  };
  const drawEdges = (ms) => {
    if (!edgeArt) return;
    edgeArt.clear();
    const k = (grid() || 100) / 100;
    for (const e of edges) {
      const pts = corners(e.rect, e.rotation), glow = firePulse(ms, e.heat);
      edgeArt.lineStyle(3.5 * k, EMBER, Math.min(1, glow * 0.8)).drawPolygon(pts);
      edgeArt.lineStyle(1.4 * k, EMBER_CORE, Math.min(1, glow)).drawPolygon(pts);
      edgeArt.lineStyle(1.1 * k, INK, 0.5).drawPolygon(pts);
    }
  };
  const tick = () => { drawEdges((typeof performance === "object" && performance?.now ? performance.now() : Date.now()) - start); raf = edges.length ? requestAnimationFrame(tick) : 0; };
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
    sync({ edges: warm = [], scorch = [] } = {}) {
      if (!ensure()) return;
      edges = warm.filter((e) => e?.rect);
      const key = scorch.map((s) => s.id).join("|");
      if (key !== scorched) { scorched = key; drawScorch(scorch.filter((s) => s?.rect)); }
      if (edges.length && !raf) raf = requestAnimationFrame(tick);
      else if (!edges.length) { cancelAnimationFrame(raf); raf = 0; drawEdges(0); }
    },
    clear() {
      cancelAnimationFrame(raf); raf = 0; edges = []; scorched = "";
      try { edgeArt?.clear(); scorchArt?.clear(); box?.destroy({ children: true }); } catch { /* gone */ }
      box = null; edgeArt = null; scorchArt = null;
    },
  };
}

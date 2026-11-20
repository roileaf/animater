// The garlands and banners on the map: drawn fresh every tick rather than painted into a roof, because they move.
//
// Everything else a roof wears is baked — the slates, the capping, the snow — and that is what makes a roof cheap
// to have. But bunting swings and a banner flaps, so the dressing is kept out of the picture and lives here, as a
// few hundred lines redrawn each frame. That is a handful of buildings' worth of work; it would be madness for
// the slates and it is nothing for a rope.

import {
  outwardOf, ropePoints, lanternSpots, bannerShape, bannerSpots, dressingLook, dressingKindOf, sheltered,
} from './dressing-paint.mjs';

/** How fast the bunting breathes when nothing is blowing: a slow stir, not a wobble. */
export const DRESSING_STIR = 0.55;

// Toward the light, as the painters in this module have it (wall-paint.mjs LIT). Written out rather than imported
// because this layer draws with the graphics card and never touches the painting kit.
const LIT_X = -0.62, LIT_Y = -0.78;

export function createPaintedDressing({ PIXI, root, shadeRoot = null, grid = () => 100 } = {}) {
  let houses = [];           // [{ key, ring, middle, colour, kind }]
  let art = null;            // the one Graphics everything is drawn into
  let shade = null;          // and the one its shadows go into, under the roof rather than over it
  let clock = 0;
  const lamps = [];          // where the lit lanterns hang, for real lights to be put there
  let sky = { wind: 0, windDir: [1, 0], sun: null, snow: 0, wet: 0 };

  const host = () => { try { return root?.(); } catch { return null; } };

  const under = () => { try { return shadeRoot?.(); } catch { return null; } };

  const drop = () => {
    houses = [];
    for (const had of [art, shade]) { try { had?.parent?.removeChild(had); had?.destroy(); } catch { /* gone with the canvas */ } }
    art = null; shade = null;
  };

  const sheetIn = (where, had, put) => {
    if (!where || !PIXI?.Graphics) return null;
    if (had && !had.destroyed && had.parent === where) return had;
    try { had?.parent?.removeChild(had); had?.destroy(); } catch { /* gone */ }
    const made = new PIXI.Graphics();
    made.eventMode = 'none';
    where.addChild(made);
    put(made);
    return made;
  };
  const sheet = () => (art = sheetIn(host(), art, (made) => { art = made; }));
  // The shadows go under the roof, so the roof hides the part of one that falls on it — which is what a roof does
  // to anything hanging below its own eave. With no layer to put them under, they go in with the dressing.
  const shadeSheet = () => (shade = sheetIn(under() ?? host(), shade, (made) => { shade = made; }));

  /**
   * A steady number for a name, so each thing gets its own place in the swing and keeps it. One clock drove every
   * rope and every banner on the map, so a whole village breathed in time, which nothing does (Roi: "they all move
   * together isnt it weird?"). Each run of rope is its own length under its own tension and the gust reaches it at
   * its own moment, so each gets an offset to start from and a rate a little of its own.
   */
  const steady = (said) => {
    let n = 2166136261;
    for (let i = 0; i < said.length; i++) { n ^= said.charCodeAt(i); n = Math.imul(n, 16777619); }
    return ((n >>> 0) % 10000) / 10000;
  };

  /**
   * A colour turned up or down, keeping its own hue. Shading cloth by mixing it toward a dark brown turned a red
   * flag olive and laid a muddy stripe down the middle of it (Roi: "what the hell is this..."). Light does not
   * change what colour a thing is; it changes how much of it there is.
   */
  const toned = (said, by) => {
    const from = hex(said), much = Math.max(0.5, Math.min(1.35, by));
    const part = (shift) => Math.max(0, Math.min(255, Math.round(((from >> shift) & 255) * much)));
    return (part(16) << 16) | (part(8) << 8) | part(0);
  };

  const hex = (colour, fallback = 0xe8b24a) => {
    const said = String(colour ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(said) ? Number.parseInt(said.slice(1), 16) : fallback;
  };

  /** One run of rope, and whatever hangs off it, laid down twice: once as its shadow and once as itself. */
  const drawEdge = (g, a, b, middle, wears, kind, look, unit, shade, own) => {
    // A day can carry more than one feast, and then the colours go up together: each lantern and each flag takes
    // the next one along, so a street celebrating three things is striped with all three.
    const colour = wears[0];
    const out = outwardOf(a, b, middle);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(len > unit * 0.3)) return;
    const swags = Math.max(1, Math.round(len / Math.max(unit * 0.85, 24)));
    const hang = unit * 0.025, amp = unit * 0.09 * (0.85 + own * 0.3), lamp = Math.max(2.4, unit * 0.05);
    // The wind this particular wall is getting: the face driven at takes all of it, the one round the back is in
    // the building's own lee.
    const gust = sheltered(sky.wind, sky.windDir, out);
    // Its own place in the swing, and its own rate: a long slack rope is slower than a short tight one.
    const ride = { swags, hang, amp, wind: gust, windDir: sky.windDir, phase: clock * (0.82 + own * 0.36) + own * 6.283 };
    const slip = shade ? [look.shadow.dir[0] * unit * 0.1 * look.shadow.long, look.shadow.dir[1] * unit * 0.1 * look.shadow.long] : [0, 0];
    const move = (p) => [p[0] + slip[0], p[1] + slip[1]];

    if (kind !== 'banners') {
      const rope = ropePoints(a, b, out, ride).map(move);
      const run = (from) => { g.moveTo(from[0][0], from[0][1]); for (let i = 1; i < from.length; i++) g.lineTo(from[i][0], from[i][1]); };
      // The rope is rope. It was being drawn in the festival's own colour, so a feast in scarlet strung a bright
      // red line round the building, which is the single most cartoonish thing in the picture: the colour belongs
      // to what hangs on it. Laid down twice — a dark core and a thin lit edge — as every other cord in the module.
      if (shade) { g.lineStyle(Math.max(1, unit * 0.016) * 1.8, 0x120d07, look.shadow.dark); run(rope); }
      else {
        g.lineStyle(Math.max(1, unit * 0.018), 0x2e2415, 0.75); run(rope);
        g.lineStyle(Math.max(0.8, unit * 0.009), 0x7a6038, 0.6);
        run(rope.map(([x, y]) => [x + LIT_X * unit * 0.006, y + LIT_Y * unit * 0.006]));
      }
      // Snow gathers along the top of the rope: a second, paler line sitting on it.
      if (!shade && look.snow > 0.05) {
        g.lineStyle(Math.max(1, unit * 0.016) * 0.7, 0xeef4fb, 0.35 + 0.5 * look.snow);
        run(rope.map(([x, y]) => [x - LIT_X * unit * 0.008, y - LIT_Y * unit * 0.008]));
      }
      g.lineStyle(0);
      for (const [k, { at, nail, lit }] of lanternSpots(a, b, out, { ...ride, lamp }).entries()) {
        const p = move(at);
        if (shade) { g.beginFill(0x120d07, look.shadow.dark); g.drawCircle(p[0], p[1], lamp * 1.05); g.endFill(); continue; }
        // No two lanterns on a string are quite the same size.
        const own2 = ((own * 97 + k * 31) % 11) / 11, size = lamp * (0.86 + own2 * 0.28);
        // The light it gives, when the sun is not giving it: three rings fading out rather than one flat disc the
        // size of a plate, which read as a bubble round the lantern.
        if (look.glow > 0.12) {
          for (const [wide, much] of [[2.4, 0.05], [1.7, 0.08], [1.25, 0.12]]) {
            g.beginFill(0xffce86, much * look.glow);
            g.drawCircle(p[0], p[1], size * wide);
            g.endFill();
          }
        }
        const paint = lit ? 0xf6e7bd : hex(wears[k % wears.length]);
        // Where each lit lantern is, for whatever wants to put a real light there: painting a halo makes a lantern
        // look lit, it does not light the street (Roi: "still no actual lights on the garlands").
        // `out` is the way off the building: a lantern hangs clear of the eave, so its light belongs out there and
        // not back over the slates it is nailed under (Roi: "lights should not render above the roof").
        if (look.glow > 0.12) lamps.push({ x: p[0], y: p[1], out: [out[0], out[1]], colour: lit ? 0xffd79a : hex(wears[k % wears.length]), glow: look.glow });
        // Its own shadow under it, then the body, then where the light catches it, then the ink round it.
        g.beginFill(0x19120a, 0.4);
        g.drawCircle(p[0] - LIT_X * size * 0.22, p[1] - LIT_Y * size * 0.22, size * 1.02);
        g.endFill();
        g.beginFill(paint, 1);
        g.drawCircle(p[0], p[1], size);
        g.endFill();
        g.beginFill(0x120c06, 0.22);
        g.drawCircle(p[0] - LIT_X * size * 0.3, p[1] - LIT_Y * size * 0.3, size * 0.72);
        g.endFill();
        g.beginFill(0xfff6de, 0.35 + 0.35 * look.glow);
        g.drawCircle(p[0] + LIT_X * size * 0.34, p[1] + LIT_Y * size * 0.34, size * 0.3);
        g.endFill();
        g.lineStyle(Math.max(0.7, unit * 0.008), 0x1b1309, 0.55);
        g.drawCircle(p[0], p[1], size);
        g.lineStyle(0);
        g.beginFill(0x1e1609, 0.6);
        g.drawCircle(move(nail)[0], move(nail)[1], Math.max(0.8, lamp * 0.3));
        g.endFill();
      }
    }

    if (kind !== 'garlands') {
      const spots = bannerSpots(a, b, out, { every: unit * 2.4, bite: unit * 0.07 });
      for (const [k, spot] of spots.entries()) {
        // Each flag on its own pole has its own place in the flutter: they are not one flag drawn several times.
        const { pole, cloth, ribs } = bannerShape(spot, out, {
          // A pennant: a short pole, a long narrow tail. Chosen against the shorter, broader cloth because it is
          // the one that still reads as a flag at the size a building is on a map.
          pole: unit * 0.22, long: unit * 0.58, wide: unit * 0.11,
          wind: gust, windDir: sky.windDir, phase: clock * (0.9 + own * 0.3) + own * 6.283 + k * 1.9,
        });
        // A pole is a round stick with a light side and a dark one, not a brown line — and it throws its own
        // shadow like everything else standing out in the sun (Roi: "the pole also doesnt cast shadow").
        const stick = (into, at0, at1, half, body, edge, alpha) => {
          const dx = at1[0] - at0[0], dy = at1[1] - at0[1], l = Math.hypot(dx, dy) || 1;
          const n = [(-dy / l) * half, (dx / l) * half];
          into.beginFill(body, alpha);
          into.drawPolygon([at0[0] + n[0], at0[1] + n[1], at1[0] + n[0], at1[1] + n[1], at1[0] - n[0], at1[1] - n[1], at0[0] - n[0], at0[1] - n[1]]);
          into.endFill();
          if (edge === null) return;
          into.beginFill(edge, alpha);
          into.drawPolygon([at0[0] + n[0] * 0.35, at0[1] + n[1] * 0.35, at1[0] + n[0] * 0.35, at1[1] + n[1] * 0.35, at1[0] + n[0], at1[1] + n[1], at0[0] + n[0], at0[1] + n[1]]);
          into.endFill();
          into.beginFill(body, alpha);
          into.drawCircle(at1[0], at1[1], half * 1.35);
          into.endFill();
        };
        const thick = Math.max(1.2, unit * 0.02);
        const flat = cloth.map(move).flat();
        if (shade) {
          stick(g, move(pole[0]), move(pole[1]), thick, 0x120d07, null, look.shadow.dark);
          g.beginFill(0x120d07, look.shadow.dark); g.drawPolygon(flat); g.endFill();
          continue;
        }
        // Laid a band at a time, each the tone its own fold has turned to — the way the roof lays its courses,
        // rather than as one flat shape with an outline round it, which is what made it read as a sticker.
        const base = wears[k % wears.length];
        for (const { quad, lean, at: along } of ribs) {
          // A fold turning toward the light catches a little more of it, one turning away a little less, and the
          // cloth thins toward the fly. Gently: this is a fold in cloth, not a facet of a gemstone.
          const turn = lean * 0.14 + along * 0.05;
          g.beginFill(toned(base, 1 + turn), 0.93 - 0.2 * look.wet);
          g.drawPolygon(quad.map(move).flat());
          g.endFill();
        }
        // One ink line round the whole of it, fine, as everything else in the module is edged.
        g.lineStyle(Math.max(0.7, unit * 0.007), 0x1d1510, 0.45);
        g.drawPolygon(flat);
        // The pole itself, jutting out of the wall and holding still while the cloth works: timber with the light
        // down one side of it and a knob on the end, drawn over the cloth it carries.
        stick(g, pole[0], pole[1], thick, 0x4a3a1e, 0x7c6434, 1);
        g.lineStyle(Math.max(0.6, unit * 0.006), 0x1d1510, 0.5);
        g.drawCircle(pole[1][0], pole[1][1], thick * 1.35);
        g.lineStyle(0);
      }
    }
  };

  return {
    /** Which buildings are dressed, and in what. `roofs` are the laid roofs; only the dressed ones put anything up. */
    populate({ roofs = [], colour = null, colours = null, kind = 'garlands' } = {}) {
      const wears = (Array.isArray(colours) && colours.length ? colours : [colour]).filter(Boolean);
      houses = (roofs ?? []).filter((r) => r?.dressed && Array.isArray(r?.ring) && r.ring.length >= 3 && wears.length).map((r) => ({
        key: r.key, ring: r.ring, colour: wears[0], colours: wears, kind: dressingKindOf(r.kind ?? kind), seed: steady(String(r.key ?? '')),
        middle: r.ring.reduce((s, p) => [s[0] + p[0] / r.ring.length, s[1] + p[1] / r.ring.length], [0, 0]),
      }));
      if (!houses.length) { const g = art; if (g && !g.destroyed) g.clear(); }
      return houses.length;
    },
    /** What the sky is doing to it: the wind that moves it, the sun that lights it, the weather on it. */
    weather({ wind = 0, windAngle = 0, sun = null, snow = 0, wet = 0 } = {}) {
      // `windAngle` is in radians and is the way the air goes, as every other layer here takes it (coast.mjs:
      // "windAngle radians"; seepReach: "the way the air goes"). Turning it from degrees squashed every angle to
      // very nearly nought, which is east — so whatever the wind was doing, the flags pointed right (Roi: "if the
      // wind is coming from the right side why the banners pointing right and flying right?").
      const a = Number(windAngle) || 0;
      sky = { wind: Math.max(0, Math.min(1, Number(wind) || 0)), windDir: [Math.cos(a), Math.sin(a)], sun, snow, wet };
    },
    /** Draw it where it is now. `dt` in seconds. */
    step(dt = 0) {
      if (!houses.length) return 0;
      const g = sheet(), dim = shadeSheet();
      if (!g) return 0;
      // It stirs on its own in still air and hurries along as the wind gets up.
      clock += Math.max(0, Number(dt) || 0) * DRESSING_STIR * (1 + sky.wind * 2.5);
      const look = dressingLook({ sun: sky.sun, snow: sky.snow, wet: sky.wet });
      const unit = grid() || 100;
      g.clear();
      if (dim && dim !== g) dim.clear();
      lamps.length = 0;
      // A shadow cast by a rope is soft, and this layer has no blur to soften one with — so it is laid down thin
      // and faint rather than as an opaque cut-out of the thing above it, which read as a second rope lying on
      // the ground. The shadows go into their own sheet beneath the roof; the dressing goes over it.
      for (const pass of look.shadow.long > 0 ? [true, false] : [false]) {
        const into = pass ? (dim ?? g) : g;
        for (const house of houses) {
          for (let e = 0; e < house.ring.length; e++) {
            drawEdge(into, house.ring[e], house.ring[(e + 1) % house.ring.length], house.middle, house.colours, house.kind, look, unit, pass, (house.seed + e * 0.317) % 1);
          }
        }
      }
      return houses.length;
    },
    drop,
    /** Every lit lantern drawn last time, where it hangs and what colour it burns. Empty by day. */
    get lamps() { return lamps; },
    /** The eave ring of each dressed building: the roof line the lanterns hang off. */
    get eaves() { return houses.map((h) => ({ ring: h.ring, middle: h.middle })); },
    get state() { return { dressed: houses.length, kinds: houses.map((h) => h.kind), wind: sky.wind, lamps: lamps.length }; },
  };
}

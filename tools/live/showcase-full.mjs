// Renders the full Animater showcase (never shipped): every immersion feature, by day and by night, in Bokken's Hut,
// frame by frame at 1920 x 1080. Chapters: the day (light, water, trees), the seasons, the weather by day, the dusk,
// the night (moon, windows, fireflies, storms) and the weather by night. Each shot draws Animater's own layers on
// temporary containers with its own weather, season and hour; nothing is saved to the world (darkness is a local
// preview, undone by a reload), and the live weather (Calendaria's, FXMaster's) is hidden while it records.
//
//   const f = await import('/modules/animater/tools/live/showcase-full.mjs'); await f.prepare(); await f.record();
//   (one shot to check: await f.shot('rainDay', 0, 1))

const W = 1920, H = 1080, FPS = 24, DIR = 'modules/animater/tools/live/full-frames';
const v = Date.now();
let S, SW, C, WS, AL, FS, MF, kit = null;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const smooth = (a, b, t) => ease((t - a) / (b - a));

// The sun the film shines (from the south-west, well up), and where a cloud's shadow falls from it.
const SUN = { angle: -150, height: 40, strength: 1 };
const shiftOf = (grid) => { const away = ((SUN.angle + 180) * Math.PI) / 180, reach = grid * (1.5 + 4 * (1 - SUN.height / 90)); return { x: Math.cos(away) * reach, y: Math.sin(away) * reach }; };
const SUN_ANGLE = (SUN.angle * Math.PI) / 180;

export async function prepare() {
  S = await import(`/modules/animater/scripts/engines/motion/sky-light.mjs?t=${v}`);
  SW = await import(`/modules/animater/scripts/engines/motion/sky-weather.mjs?t=${v}`);
  C = await import(`/modules/animater/scripts/engines/motion/canopy-light.mjs?t=${v}`);
  WS = await import(`/modules/animater/scripts/engines/motion/wall-shadows.mjs?t=${v}`);
  AL = await import(`/modules/animater/scripts/engines/motion/ambient-life.mjs?t=${v}`);
  FS = await import(`/modules/animater/scripts/engines/motion/fire-smoke.mjs?t=${v}`);
  MF = await import(`/modules/animater/scripts/engines/motion/movement-feel-render.mjs?t=${v}`);
  const SUNMOD = await import(`/modules/animater/scripts/engines/motion/sun.mjs?t=${v}`);
  const r = canvas.app.renderer, bake = (g, rt) => r.render(g, { renderTexture: rt, clear: true });
  const b = canvas.dimensions.sceneRect, grid = canvas.grid.size;
  // Temporary layers: the ground's light (trees, roofs, sky), over the tiles (leaves, birds, snow, the weather), the
  // chimney's smoke over the roofs, and the window glow, the flash and the weather's own light over the darkness.
  const layer = (sortLayer, elevation) => { const c = new PIXI.Container(); c.sortLayer = sortLayer; c.elevation = elevation; canvas.primary.addChild(c); return c; };
  const low = layer(644, 0), high = layer(1101, 20.02), snowTop = layer(1098, 20.01), chimneyTop = layer(1099, 20.015);
  const glowRoot = new PIXI.Container(), flashRoot = new PIXI.Container(), skyGlow = new PIXI.Container();
  const tile = (t) => ({ texture: t.mesh.texture, x: t.mesh.x, y: t.mesh.y, width: t.mesh.width, height: t.mesh.height, rotation: t.mesh.rotation, anchorX: t.mesh.anchor.x, anchorY: t.mesh.anchor.y, alpha: 1, shown: 1 });
  const treeTiles = canvas.tiles.placeables.filter((t) => /tree/i.test(t.document.texture.src));
  const roofTiles = canvas.tiles.placeables.filter((t) => /roof|outhouse/i.test(t.document.texture.src));
  const trees = treeTiles.map((t) => ({ ...tile(t), up: 5, leaves: 0.55 })), roofs = roofTiles.map((t) => ({ ...tile(t), up: 4 }));
  const indoors = Array.from(canvas.scene.regions).filter((g) => Array.from(g.behaviors).some((x) => x.type === 'suppressWeather')).flatMap((g) => Array.from(g.polygons, (p) => Array.from(p.points)));
  // The scene's own water regions (each area with its holes), the river flowing south.
  const areas = (region) => { const out = []; const walk = (node) => { for (const a of node.children ?? []) { if (a.isHole) continue; const pts = Array.from(a.points ?? []); pts.holes = (a.children ?? []).filter((c) => c.isHole).map((c) => Array.from(c.points ?? [])); out.push(pts); for (const h of (a.children ?? []).filter((c) => c.isHole)) walk(h); } }; walk(region.polygonTree ?? {}); return out; };
  const waters = canvas.scene.regions.filter((g) => g.flags?.animater?.floor === 'water').flatMap((g) => areas(g.object ?? g));
  const canopy = C.createCanopyLight({ PIXI, root: () => low, above: () => high, render: bake });
  canopy.build({ trees, roofs, indoors, bounds: b, grid, sun: SUN });
  const surf = S.createSurfaceLight({ PIXI, root: () => low, above: () => high, glowing: () => skyGlow, render: bake,
    renderAt: (o, rt, transform) => r.render(o, { renderTexture: rt, clear: true, transform }) });
  surf.build({ water: waters, flows: [{ polygons: waters, angle: Math.PI / 2, speed: 0.7 }], grassAll: true, indoors, bounds: b, grid });
  surf.shade({ trees: canopy.treeShade, crowns: canopy.crowns });
  const tileSnow = S.createTileSnow({ PIXI, root: () => snowTop });
  tileSnow.build({ tiles: [...roofs.map((t) => ({ ...t, kind: 'roof' })), ...trees.map((t) => ({ ...t, kind: 'tree' }))], grid });
  // The trees sway with the wind.
  const sway = C.createTreeSway({ PIXI, grid: () => grid });
  sway.attach(treeTiles.map((t) => t.mesh));
  // The lamps as placed, lit for the film's night.
  const perPx = canvas.dimensions.size / canvas.dimensions.distance;
  const lights = canvas.lighting.placeables.map((l) => { const c = l.document.config; return { x: l.document.x, y: l.document.y, radius: Math.max(Number(c.dim) || 0, Number(c.bright) || 0) * perPx, bright: (Number(c.bright) || 0) * perPx, color: c.color ? Number(new PIXI.Color(c.color).toNumber()) : null }; }).filter((l) => l.radius > 0);
  const walls = canvas.walls.placeables.map((w) => w.document).map((d) => ({ c: d.c, light: d.light, move: d.move, door: d.door, ds: d.ds, kind: d.flags?.animater?.window ?? null }));
  const glow = WS.createWindowGlow({ PIXI, root: () => glowRoot, render: bake });
  glow.build({ glows: WS.windowGlows({ walls, indoors, lights, grid, foot: 0.2 }), bounds: b, alpha: 0.85, covers: [...trees, ...roofs] });
  const art = (t) => { let texture = t.mesh.texture; const ring = t.document.ring; if (ring?.enabled && ring.subject?.texture) { try { texture = foundry.canvas.getTexture(ring.subject.texture) ?? texture; } catch { /* own */ } } return { texture, width: Math.abs(t.mesh.width), height: Math.abs(t.mesh.height), flipX: t.mesh.scale.x < 0, flipY: t.mesh.scale.y < 0, rotation: t.mesh.rotation }; };
  const creatures = () => canvas.tokens.placeables.filter((t) => t.actor && t.visible).map((t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2, r: Math.min(t.w, t.h) * 0.32, half: Math.min(t.w, t.h) / 2, height: 1.2, art: art(t) }));
  for (let i = 0; i < 40 && glow.shadows(creatures(), walls) === true; i++) await new Promise((res) => setTimeout(res, 30));
  const windows = WS.windowFlashes({ walls, indoors, grid, foot: 0.2 });
  const flash = S.createLightningFlash({ PIXI, root: () => flashRoot, bounds: () => b, render: bake, cover: () => ({ indoors, windows, roofs: kit?.roofless ? [] : roofs }) });
  // The hearth's chimney: its smoke above the roof, downwind.
  const hearth = canvas.lighting.placeables.find((l) => l.document.config.animation?.type === 'torch') ?? canvas.lighting.placeables[0];
  const smokeClock = { ms: 0 };
  const chimney = FS.createFireSmoke({ enabled: () => true, grid: () => grid, now: () => smokeClock.ms,
    layer: MF.createMovementFeelLayer({ PIXI, root: () => chimneyTop }),
    fires: () => (kit?.chimney ? [FS.chimneyPlume({ key: 'hearth', x: hearth.document.x, y: hearth.document.y, size: 1.1, visible: true }, kit.chimney.wind, kit.chimney.angle)] : []) });
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
  { const g = vignette.getContext('2d'), grad = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.02); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.42)'); g.fillStyle = grad; g.fillRect(0, 0, W, H); }
  kit = { r, low, high, snowTop, chimneyTop, glowRoot, flashRoot, skyGlow, canopy, surf, tileSnow, sway, glow, flash, chimney, smokeClock, creatures, roofs, roofTiles, treeTiles,
    out, ctx: out.getContext('2d'), vignette, dark: null, grid, skyClear: SUNMOD.skyClear, chimney: null };
  // (kit.chimney is the plume's wind while a shot shows it; the engine is kit.smoke.)
  kit.smoke = chimney; kit.chimney = null;
  await Promise.all(['400 66px "Modesto Condensed"', '400 27px "Signika"', '600 22px "Signika"'].map((f) => document.fonts.load(f)));
  try { await FilePicker.implementation.createDirectory('data', DIR); } catch { /* there */ }
  return { waters: waters.length, trees: trees.length, roofs: roofs.length, indoors: indoors.length, windows: windows.length, lamps: lights.length, glowing: glow.built, hearth: [hearth.document.x, hearth.document.y] };
}

// The live layers kept out of the film: Animater's own (the shots draw theirs), the live weather and lightning.
const liveLayers = () => [
  ...canvas.primary.children.filter((c) => ([642, 643, 1099, 1100].includes(c.sortLayer) && ![kit.low, kit.high, kit.snowTop, kit.chimneyTop].includes(c))
    || ['ParticleEffectsLayer', 'WeatherEffects'].includes(c.constructor.name) || /fxmaster/i.test(c.label ?? c.name ?? '')),
  ...canvas.effects.children.filter((c) => [99985, 99995].includes(c.zIndex) || /fxm/i.test(c.label ?? c.name ?? '')),
];
// Animater's floor layers that stay live (wall shadows, light through windows, creatures' shadows): hidden for the
// plain-Foundry side of a wipe.
const animaterFloor = () => canvas.primary.children.filter((c) => [640, 645, 650].includes(c.sortLayer));

async function setDark(d, settle = 3) {
  if (kit.dark !== null && Math.abs(kit.dark - d) < 0.004 && Math.abs(canvas.environment.darknessLevel - d) < 0.01) return;
  kit.dark = d;
  canvas.environment.initialize({ environment: { darknessLevel: d, base: { hue: 0, intensity: 0, luminosity: 0, saturation: 0, shadows: 0 }, dark: { hue: 0.62, intensity: 0.35, luminosity: 0.1, saturation: 0, shadows: 0 } } });
  for (let i = 0; i < settle; i++) { canvas.perception.update({ refreshLighting: true, refreshVision: true }); canvas.app.ticker.update(performance.now()); await new Promise((res) => setTimeout(res, 40)); }
}

// A render texture as it shows over black: its raw colours, opaque.
function readOpaque(rt) {
  const r = kit.r, gl = r.gl, buf = new Uint8Array(W * H * 4);
  r.renderTexture.bind(rt); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); r.renderTexture.bind(null);
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), W, H), 0, 0);
  return c;
}
// The board at a camera, with the glow, the flash and the weather's own light laid over it.
function grab(cam, { over = true } = {}) {
  const s = canvas.stage, keep = { px: s.pivot.x, py: s.pivot.y, sc: s.scale.x, x: s.position.x, y: s.position.y };
  s.pivot.set(cam.x, cam.y); s.scale.set(cam.scale); s.position.set(W / 2, H / 2);
  canvas.primary.sortDirty = true; canvas.primary.sortChildren?.(); canvas.primary.renderDirty = true;
  const rt = PIXI.RenderTexture.create({ width: W, height: H });
  const hidden = liveLayers().map((c) => [c, c.visible, c.renderable]);
  hidden.forEach(([c]) => { c.visible = false; c.renderable = false; });
  try { kit.r.render(s, { renderTexture: rt, clear: true }); } finally { hidden.forEach(([c, vis, ren]) => { c.visible = vis; c.renderable = ren; }); }
  s.pivot.set(keep.px, keep.py); s.scale.set(keep.sc); s.position.set(keep.x, keep.y);
  if (over) for (const layer of [kit.glowRoot, kit.skyGlow, kit.flashRoot]) {
    if (!layer.visible || !layer.children.length) continue;
    const wrap = new PIXI.Container(); wrap.addChild(layer);
    wrap.pivot.set(cam.x, cam.y); wrap.scale.set(cam.scale); wrap.position.set(W / 2, H / 2);
    kit.r.render(wrap, { renderTexture: rt, clear: false });
    wrap.removeChild(layer);
  }
  const img = readOpaque(rt);
  rt.destroy(true);
  return img;
}

// A lower third: a gold kicker, the title and one line, on a soft dark band, sliding in and out.
function lowerThird(ctx, cap, k) {
  const a = Math.min(smooth(0.05, 0.16, k), 1 - smooth(0.84, 0.95, k));
  if (a <= 0.001) return;
  const lift = (1 - smooth(0.05, 0.18, k)) * 16, x = 118, y = H - 238 + lift;
  ctx.save();
  ctx.globalAlpha = a;
  const band = ctx.createLinearGradient(0, 0, 1150, 0);
  band.addColorStop(0, 'rgba(8,8,10,0.62)'); band.addColorStop(0.7, 'rgba(8,8,10,0.32)'); band.addColorStop(1, 'rgba(8,8,10,0)');
  ctx.fillStyle = band; ctx.fillRect(0, y - 26, 1150, 196);
  ctx.fillStyle = '#d8b26a'; ctx.fillRect(x - 30, y - 4, 4, 150);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = '600 22px "Signika"'; ctx.letterSpacing = '6px'; ctx.fillStyle = '#e3c27f'; ctx.fillText(cap.kicker.toUpperCase(), x, y);
  ctx.font = '400 66px "Modesto Condensed"'; ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.fillText(cap.title, x, y + 34);
  ctx.shadowBlur = 0; ctx.font = '400 27px "Signika"'; ctx.letterSpacing = '0px'; ctx.fillStyle = 'rgba(236,236,236,0.92)'; ctx.fillText(cap.line, x, y + 106);
  ctx.restore();
}
// The wipe: plain Foundry on the left of the line, Animater on the right.
function wipeTags(ctx, wipe) {
  ctx.save();
  if (wipe > 2 && wipe < W - 2) {
    const g = ctx.createLinearGradient(wipe - 40, 0, wipe + 40, 0);
    g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(0.5, 'rgba(255,240,210,0.9)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.fillRect(wipe - 40, 0, 80, H);
    ctx.fillStyle = 'rgba(255,248,232,1)'; ctx.fillRect(wipe - 1, 0, 2, H);
  }
  ctx.font = '600 20px "Signika"'; ctx.letterSpacing = '5px'; ctx.textBaseline = 'middle';
  const tag = (text, x, align, alpha) => { if (alpha <= 0) return; ctx.globalAlpha = alpha; ctx.textAlign = align; const w = ctx.measureText(text).width + 36, bx = align === 'right' ? x - w : x; ctx.fillStyle = 'rgba(10,10,12,0.6)'; ctx.fillRect(bx, 56, w, 44); ctx.fillStyle = '#f2e6cc'; ctx.fillText(text, align === 'right' ? x - 18 : x + 18, 79); };
  tag('PLAIN FOUNDRY', Math.min(W - 60, wipe - 24), 'right', clamp01((wipe - 300) / 200));
  tag('WITH ANIMATER', Math.max(60, wipe + 24), 'left', clamp01((W - 300 - wipe) / 200));
  ctx.restore();
}

// ---- The shots. Each: seconds, darkness (or a function of k 0–1), camera from/to, and look(k) giving the sky
// (surf.look's), the trees, the season, the weather by Calendaria's id, glow, snow on the tiles, chimney, birds, strikes.
const DAY = { light: 1, clouds: 0, color: [1, 0.95, 0.84], wind: 0.45, windAngle: 0.5 };
const NIGHT = { light: 0, color: [0.7, 0.78, 1], wind: 0.25, windAngle: 0.5 };
const WHOLE = { x: 3900, y: 3000, scale: 0.392 };
const HUT = { x: 3000, y: 3200, scale: 0.58 };
const YARD = { x: 4300, y: 3100, scale: 0.5 };
const RIVER_CAM = { x: 5300, y: 2800, scale: 1.0 };
const near = (c, d = 0.06) => [c, { ...c, x: c.x + 60, y: c.y - 40, scale: c.scale + d }];
const weatherShot = (name, id, title, line, { dark = 0, cam = YARD, night = false, extra = {}, seconds = 7, kicker } = {}) => ({
  name, seconds, dark, cam: near(cam),
  look: () => ({ surf: { ...(night ? NIGHT : DAY), wind: 0.55, windAngle: 0.4, ...extra }, trees: !night, weather: id, glow: night ? 1 : 0 }),
  cap: { kicker: kicker ?? (night ? 'Weather by night' : 'Weather by day'), title, line },
});

const shots = [
  // ---------- Day ----------
  { name: 'whole', seconds: 11, dark: 0, wipe: true, birds: [[2600, 2000], [6000, 3300]], cam: [WHOLE, { ...WHOLE, scale: 0.42 }],
    look: () => ({ surf: { ...DAY, clouds: 0.3 }, trees: true, weather: 'partly-cloudy' }),
    cap: { kicker: "Bokken's Hut", title: 'Plain Foundry, then Animater', line: 'The same map and the same moment: sun and shade, clouds, water and life' } },
  { name: 'leaves', seconds: 8, dark: 0, cam: [{ x: 4400, y: 2750, scale: 0.58 }, { x: 4600, y: 2650, scale: 0.64 }],
    look: () => ({ surf: { ...DAY, wind: 0.75 }, trees: true }),
    cap: { kicker: 'Trees', title: 'Swaying in the wind', line: 'Each tree in its own rhythm, dappled shade stirring beneath, sun flecks drifting' } },
  { name: 'river', seconds: 8, dark: 0, birds: [[4600, 2000], [6100, 2900]], cam: [{ x: 5400, y: 2700, scale: 0.92 }, { x: 5420, y: 2450, scale: 1.0 }],
    look: () => ({ surf: { ...DAY, wind: 0.4 }, trees: true }),
    cap: { kicker: 'Water', title: 'A river that flows', line: 'Ripples and foam carried downstream, glints where the swell turns to the sun' } },
  { name: 'chimney', seconds: 8, dark: 0.15, chimney: true, cam: [{ x: 2700, y: 3100, scale: 0.62 }, { x: 2650, y: 3050, scale: 0.68 }],
    look: () => ({ surf: { ...DAY, wind: 0.5, windAngle: -0.4, color: [1, 0.88, 0.72] }, trees: true }),
    cap: { kicker: 'Life', title: 'Smoke from the chimney', line: 'A hearth inside smokes above the roof, its plume carried off downwind' } },
  { name: 'roofs', seconds: 9, dark: 0.15, roofless: (k) => k > 0.45, cam: [{ x: 2950, y: 3150, scale: 0.6 }, { x: 2950, y: 3150, scale: 0.66 }],
    look: () => ({ surf: { ...DAY, light: 0.5, wind: 0.6, windAngle: 0.8, wet: 1 }, weather: 'rain' }),
    cap: { kicker: 'Weather', title: 'It knows where the roofs are', line: 'Rain on the rooftops; look inside, and the room stays dry' } },
  // ---------- Seasons ----------
  { name: 'spring', seconds: 6, dark: 0, cam: near(YARD), look: () => ({ surf: { ...DAY, wind: 0.4 }, trees: true, season: 'spring', weather: 'sakura-bloom' }),
    cap: { kicker: 'Seasons', title: 'Spring', line: 'Fresh green ground and blossom on the wind' } },
  { name: 'summer', seconds: 6, dark: 0, cam: near(YARD), look: () => ({ surf: { ...DAY, wind: 0.3 }, trees: true, season: 'summer' }),
    cap: { kicker: 'Seasons', title: 'Summer', line: 'Sun-bleached grass under a high sun' } },
  { name: 'autumn', seconds: 7, dark: 0, cam: near({ x: 4500, y: 2700, scale: 0.6 }), look: () => ({ surf: { ...DAY, wind: 0.8, windAngle: 0.3, color: [1, 0.9, 0.75] }, trees: true, season: 'autumn', weather: 'autumn-leaves' }),
    cap: { kicker: 'Seasons', title: 'Autumn', line: 'Brown ground, fallen leaves lying under the trees and more on the wind' } },
  { name: 'winter', seconds: 8, dark: 0.05, cam: near({ x: 4700, y: 2800, scale: 0.5 }), look: () => ({ surf: { ...DAY, light: 0.7, wind: 0.3, snow: 0.85, ice: 1, color: [0.95, 0.97, 1] }, snow: 0.85, season: 'winter', weather: 'snow' }),
    cap: { kicker: 'Seasons', title: 'Winter', line: 'Snow lying on the ground, the roofs and the trees, and the river frozen over' } },
  // The river freezes on while nobody is there: the GM moves the clock, the scene keeps its own weather.
  { name: 'freezeBefore', seconds: 6, dark: 0.05, cam: near(RIVER_CAM, 0.03), look: () => ({ surf: { ...DAY, light: 0.75, wind: 0.2, ice: 0.18, snow: 0.3, color: [0.95, 0.97, 1] }, trees: true, season: 'winter' }),
    cap: { kicker: 'A hard frost', title: 'The party moves on', line: 'A thin skin of ice creeping in from the banks as they leave' } },
  { name: 'freezeAfter', seconds: 7, dark: 0.05, cam: near(RIVER_CAM, 0.03), look: () => ({ surf: { ...DAY, light: 0.75, wind: 0.2, ice: 1, snow: 0.45, color: [0.95, 0.97, 1] }, trees: true, season: 'winter' }),
    cap: { kicker: 'Eight hours later', title: 'Frozen while nobody watched', line: 'Every scene keeps its own weather as the clock moves, for every player alike' } },
  // ---------- Weather by day ----------
  weatherShot('cloudy', 'cloudy', 'Clouds overhead', 'Seen from above, lit by the sun, their shadows sweeping the ground', { cam: WHOLE, extra: { clouds: 0.6 } }),
  weatherShot('overcast', 'overcast', 'Overcast', 'One low grey ceiling and the flat, cool light under it', { cam: WHOLE, extra: { light: 0.4, clouds: 0.9 } }),
  weatherShot('rainDay', 'rain', 'Rain', 'Drops in depth, gusting sheets and splashes, the ground darkening', { extra: { light: 0.4, clouds: 0.9, wet: 1, rain: 0.8 } }),
  { name: 'rainbow', seconds: 8, dark: 0, rainbow: true, cam: near(WHOLE, 0.02), look: () => ({ surf: { ...DAY, wet: 1, rainbow: 1, sunAngle: SUN_ANGLE }, trees: true }),
    cap: { kicker: 'After the rain', title: 'A rainbow', line: 'When the rain stops and the sun breaks through, fading as the ground dries' } },
  { name: 'stormDay', seconds: 8, dark: 0.3, strikes: [1.2, 1.45, 4.3, 6.4], cam: near(YARD), look: () => ({ surf: { ...DAY, light: 0.25, clouds: 1, wind: 0.8, windAngle: 0.9, wet: 1, rain: 1 }, weather: 'thunderstorm' }),
    cap: { kicker: 'Weather by day', title: 'Thunderstorm', line: 'Lightning as fierce as the storm, rain driven by the wind' } },
  weatherShot('snowDay', 'snow', 'Snowfall', 'Flakes drifting on the eddies, near ones soft, far ones crisp', { extra: { light: 0.6, clouds: 0.8, snow: 0.5 } }),
  weatherShot('blizzard', 'blizzard', 'Blizzard', 'A wind-driven whiteout', { extra: { light: 0.5, clouds: 1, snow: 1, wind: 1 } }),
  weatherShot('fog', 'fog', 'Fog', 'Banks drifting in, thickest over the water and in the hollows', { cam: { x: 4800, y: 2900, scale: 0.42 }, extra: { light: 0.6, clouds: 0.8 } }),
  weatherShot('sandstorm', 'sandstorm', 'Sandstorm', 'Billowing walls of dust and grit racing on the wind', { extra: { light: 0.7, clouds: 0.4, wind: 1, windAngle: 0 } }),
  weatherShot('heat', 'heat-wave', 'Heat wave', 'A golden haze, the air rippling off the ground', { extra: { light: 1, clouds: 0 } }),
  weatherShot('tornado', 'tornado', 'Tornado', 'A swirling funnel tearing across the map, debris flung round it', { cam: { x: 4000, y: 3000, scale: 0.3 }, extra: { light: 0.4, clouds: 1, wind: 0.8, rain: 0.6 } }),
  weatherShot('divine', 'divine-light', 'Divine light', 'Golden shafts through the air, motes turning in them', { cam: WHOLE, kicker: 'Fantasy weather' }),
  weatherShot('bloodRain', 'blood-rain', 'Blood rain', 'And every other weather Calendaria knows', { kicker: 'Fantasy weather', extra: { light: 0.5, clouds: 0.85, rain: 0.7 } }),
  // ---------- Dusk ----------
  { name: 'dusk', seconds: 11, dark: (k) => 0.8 * smooth(0.12, 0.88, k), chimney: true, cam: [WHOLE, { ...WHOLE, scale: 0.41 }],
    look: (k) => ({ surf: { light: Math.max(0, 1 - 1.25 * smooth(0.1, 0.8, k)), color: [1, lerp(0.95, 0.66, smooth(0.15, 0.6, k)), lerp(0.84, 0.42, smooth(0.15, 0.6, k))], wind: 0.25, windAngle: 0.5, fireflies: smooth(0.75, 1, k), moon: smooth(0.7, 1, k) }, trees: k < 0.8, glow: smooth(0.45, 0.85, k) }),
    cap: { kicker: 'Time', title: 'From day into night', line: 'Light that follows the clock, through the golden dusk and into the dark' } },
  // ---------- Night ----------
  { name: 'wholeNight', seconds: 9, dark: 0.8, wipe: true, cam: [WHOLE, { ...WHOLE, scale: 0.41 }],
    look: () => ({ surf: { ...NIGHT, fireflies: 1, moon: 1 }, glow: 1 }),
    cap: { kicker: 'Before & after', title: 'A summer night', line: 'Moonlight on the open ground, lamplight from the windows, fireflies' } },
  { name: 'moon', seconds: 8, dark: 0.85, cam: near({ x: 4400, y: 3000, scale: 0.45 }), look: () => ({ surf: { ...NIGHT, moon: 1, clouds: 0.45 }, weather: 'partly-cloudy' }),
    cap: { kicker: 'Night', title: 'By the light of the moon', line: 'Silver on the open ground as the moon waxes, dimmed as clouds cross it' } },
  { name: 'windows', seconds: 9, dark: 0.8, cam: [{ x: 3050, y: 3650, scale: 0.68 }, { x: 3000, y: 3620, scale: 0.75 }],
    look: () => ({ surf: { ...NIGHT, fireflies: 0.35, moon: 0.5 }, glow: 1 }),
    cap: { kicker: 'Night', title: 'Light from the windows', line: 'Every lit room spills its light; those standing in it cast their shadows' } },
  { name: 'fireflies', seconds: 7, dark: 0.78, cam: [{ x: 4750, y: 3500, scale: 0.68 }, { x: 4850, y: 3400, scale: 0.74 }],
    look: () => ({ surf: { ...NIGHT, wind: 0.15, fireflies: 1, moon: 0.4 } }),
    cap: { kicker: 'Life', title: 'Fireflies', line: 'On warm nights, over the grass and along the water' } },
  // ---------- Weather by night ----------
  { name: 'stormNight', seconds: 9, dark: 0.85, roofless: () => true, strikes: [0.7, 0.95, 3.4, 6.0, 6.35, 8.0],
    cam: [{ x: 2950, y: 3180, scale: 0.64 }, { x: 2950, y: 3160, scale: 0.7 }],
    look: () => ({ surf: { ...NIGHT, wind: 0.8, windAngle: 0.9, wet: 1, rain: 1 }, weather: 'thunderstorm', glow: 1 }),
    cap: { kicker: 'Weather by night', title: 'Lightning through the windows', line: 'A flash lights a room only where it comes in, as fierce as the storm' } },
  weatherShot('rainNight', 'rain', 'Rain at night', 'Rain on the roofs and in the lamplight', { night: true, dark: 0.8, cam: HUT, extra: { wet: 1, rain: 0.8 } }),
  weatherShot('snowNight', 'snow', 'Snow at night', 'Falling through the light of the windows', { night: true, dark: 0.8, cam: HUT, extra: { snow: 0.5 } }),
  weatherShot('aurora', 'luminous-sky', 'Aurora', 'Curtains of light over the map', { night: true, dark: 0.9, cam: WHOLE, kicker: 'Fantasy weather' }),
  weatherShot('meteors', 'meteor-shower', 'Meteor shower', 'Streaks of fire across the night', { night: true, dark: 0.9, cam: WHOLE, kicker: 'Fantasy weather' }),
  weatherShot('wildfire', 'wildfire-smoke', 'Wildfire smoke', 'Embers glowing in the dark, smoke rolling over', { night: true, dark: 0.8, extra: { wind: 0.5 } }),
  weatherShot('ley', 'ley-surge', 'Ley surge', 'Motes streaming along glowing currents', { night: true, dark: 0.85, kicker: 'Fantasy weather' }),
];
export const SHOTS = shots.map((s) => s.name);

async function upload(name, index) {
  const blob = await new Promise((res) => kit.out.toBlob(res, 'image/jpeg', 0.92));
  await FilePicker.implementation.upload('data', DIR, new File([blob], `${name}_${String(index).padStart(4, '0')}.jpg`, { type: 'image/jpeg' }), {}, { notify: false });
}

// What a shot asks for, laid on the layers.
function lay(spec, look, t) {
  const grid = kit.grid, night = Number(canvas.environment.darknessLevel) || 0;
  const scene = look.weather ? SW.weatherScene({ id: look.weather }) : null;
  const cover = look.weather ? Math.min(1, Math.max(0, 1 - kit.skyClear({ id: look.weather }))) : (look.surf.clouds ?? 0);
  const wind = Math.max(scene?.windMin ?? 0, look.surf.wind ?? 0.3);
  const season = look.season ? AL.seasonGround(look.season, { wind }) : null;
  kit.surf.look({ ...look.surf, wind, clouds: look.surf.clouds ?? cover, cover, weather: scene, cloudShift: shiftOf(grid),
    season: season?.tint ?? null, litter: season ? season.litter * (1 - (look.surf.snow ?? 0)) : 0 });
  // The weather's light outdoors, and the roofs as drawn (a faded roof lets the room keep its own).
  const cast = look.weather ? S.weatherLight({ kind: look.weather, rain: look.surf.rain ?? 0, snow: look.surf.snow ?? 0, storm: !!scene?.storm, severity: scene?.storm ?? 0, clouds: cover, day: Math.max(0, 1 - night * 1.2) }) : null;
  kit.surf.veil(cast, kit.roofs.map((r) => ({ ...r, shown: kit.roofless ? 0 : 1 })));
  kit.canopy.look({ fall: look.trees ? C.canopyFall(SUN, { height: 5, grid, darkness: night }) : null, roofFall: look.trees ? C.canopyFall(SUN, { height: 4, grid, darkness: night }) : null,
    color: look.surf.color, wind, windAngle: look.surf.windAngle, roofShade: 0.2, leaves: look.season === 'autumn' ? AL.leavesOf({ season: 'autumn', wind }) : null });
  kit.tileSnow.look({ snow: look.snow ?? 0, wind });
  kit.glowRoot.visible = (look.glow ?? 0) > 0.01; kit.glowRoot.alpha = look.glow ?? 0;
  kit.skyGlow.visible = true;
  kit.chimney = spec.chimney ? { wind, angle: look.surf.windAngle ?? 0 } : null;
  return { wind };
}

// One shot, frames from..to (exclusive).
export async function shot(name, from = 0, to = null) {
  const spec = shots.find((s) => s.name === name), n = spec.seconds * FPS;
  to ??= n;
  const live = liveLayers(), floor = animaterFloor();
  live.forEach((c) => { c.visible = false; });
  // No token selected: the whole map shows, not one creature's sight.
  canvas.tokens.releaseAll();
  kit.flash.clear(); kit.smoke.clear();
  // Settled before the first frame: the rainbow fully out, the chimney already smoking.
  kit.surf.tick(20 + from / FPS + (spec.rainbow ? 10 : 0)); kit.canopy.tick(20 + from / FPS); kit.sway.tick(20 + from / FPS);
  kit.smokeClock.ms = 100000;
  if (spec.chimney) { const look = spec.look(0); lay(spec, look, 0); for (let i = 0; i < 6 * FPS; i++) { kit.smokeClock.ms += 1000 / FPS; kit.smoke.tick(); } }
  try {
    for (let i = from; i < to; i++) {
      const k = n > 1 ? i / (n - 1) : 0, t = i / FPS;
      await setDark(typeof spec.dark === 'function' ? spec.dark(k) : spec.dark, typeof spec.dark === 'function' ? 2 : 4);
      kit.roofless = typeof spec.roofless === 'function' ? spec.roofless(k) : !!spec.roofless;
      kit.roofTiles.forEach((tl) => { tl.mesh.visible = !kit.roofless; });
      const look = spec.look(k), { wind } = lay(spec, look, t);
      if (spec.birds) { const [a, b] = spec.birds; kit.surf.bird({ x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }, kit.roofs); } else kit.surf.bird(null);
      let flashLevel = 0;
      if (spec.strikes) {
        const ms = t * 1000;
        for (const at of spec.strikes) if (Math.abs(at * 1000 - ms) < 500 / FPS) kit.flash.strike(ms);
        flashLevel = kit.flash.tick(ms, 0);
      }
      kit.flashRoot.visible = flashLevel > 0;
      const cam = { x: lerp(spec.cam[0].x, spec.cam[1].x, ease(k)), y: lerp(spec.cam[0].y, spec.cam[1].y, ease(k)), scale: lerp(spec.cam[0].scale, spec.cam[1].scale, ease(k)) };
      // The trees sway as the camera sees them.
      kit.sway.set({ wind, angle: look.surf.windAngle ?? 0, view: { x: W / 2 - cam.x * cam.scale, y: H / 2 - cam.y * cam.scale, scale: cam.scale } });
      const after = grab(cam);
      const ctx = kit.ctx;
      ctx.globalAlpha = 1; ctx.drawImage(after, 0, 0);
      if (spec.wipe) {
        const ours = [kit.low, kit.high, kit.snowTop, kit.chimneyTop, ...floor].map((c) => [c, c.visible]), skyWas = kit.skyGlow.visible;
        ours.forEach(([c]) => { c.visible = false; }); kit.skyGlow.visible = false;
        const swayWas = kit.treeTiles.map((tl) => [tl.mesh, tl.mesh.filters]); swayWas.forEach(([m]) => { m.filters = null; });
        const before = grab(cam, { over: false });
        ours.forEach(([c, was]) => { c.visible = was; }); kit.skyGlow.visible = skyWas; swayWas.forEach(([m, f]) => { m.filters = f; });
        const wipe = W * (1 - ease((k - 0.2) / 0.3));
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, wipe, H); ctx.clip(); ctx.drawImage(before, 0, 0); ctx.restore();
        wipeTags(ctx, wipe);
      }
      ctx.drawImage(kit.vignette, 0, 0);
      lowerThird(ctx, spec.cap, k);
      await upload(name, i);
      kit.surf.tick(1 / FPS); kit.canopy.tick(1 / FPS); kit.sway.tick(1 / FPS);
      kit.smokeClock.ms += 1000 / FPS; kit.smoke.tick();
    }
  } finally {
    live.forEach((c) => { c.visible = true; });
    kit.roofTiles.forEach((tl) => { tl.mesh.visible = true; }); kit.roofless = false;
    kit.chimney = null; kit.smoke.clear();
  }
  return { name, frames: to - from };
}

// A title card: the map behind, softly blurred and darkened, drifting; the name in gold.
async function card(name, seconds, { background, title = 'ANIMATER', big = 190, lines }) {
  const n = seconds * FPS, ctx = kit.ctx;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), a = Math.min(smooth(0, 0.22, k), 1 - smooth(0.8, 1, k));
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = '#060607'; ctx.fillRect(0, 0, W, H);
    const zoom = 1.06 + 0.05 * k;
    ctx.globalAlpha = a; ctx.filter = 'blur(9px) brightness(0.42) saturate(0.85)';
    ctx.drawImage(background, W / 2 - (W * zoom) / 2, H / 2 - (H * zoom) / 2, W * zoom, H * zoom);
    ctx.filter = 'none'; ctx.drawImage(kit.vignette, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(0, H / 2 - 110, 0, H / 2 + 10);
    grad.addColorStop(0, '#f7e2ad'); grad.addColorStop(1, '#c79a4d');
    ctx.font = `400 ${big}px "Modesto Condensed"`; ctx.letterSpacing = big > 150 ? '22px' : '10px'; ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30;
    ctx.fillText(title, W / 2 + (big > 150 ? 11 : 5), H / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(216,178,106,0.85)'; ctx.fillRect(W / 2 - 160, H / 2 + 40, 320, 2);
    ctx.letterSpacing = '3px';
    lines.forEach(([text, size, color], j) => { ctx.font = `400 ${size}px "Signika"`; ctx.fillStyle = color; ctx.fillText(text, W / 2, H / 2 + 92 + j * (size + 22)); });
    ctx.restore();
    await upload(name, i);
  }
}

// The cards' backgrounds: the whole map by day and by night.
async function backgrounds() {
  liveLayers().forEach((c) => { c.visible = false; });
  await setDark(0);
  lay({}, { surf: { ...DAY, clouds: 0.3 }, trees: true, weather: 'partly-cloudy' });
  const day = grab(WHOLE);
  await setDark(0.85);
  lay({}, { surf: { ...NIGHT, fireflies: 1, moon: 1 }, glow: 1 });
  const night = grab(WHOLE);
  liveLayers().forEach((c) => { c.visible = true; });
  return { day, night };
}

// The order: cards between the chapters.
const CARD_AT = { whole: 'opening', spring: 'cardSeasons', freezeAfter: 'awayScene', cloudy: 'cardWeather', dusk: 'cardDusk', stormNight: 'cardNightWeather' };
export const ORDER = shots.flatMap((s) => (CARD_AT[s.name] ? [CARD_AT[s.name], s.name] : [s.name])).concat('closing');

// The party far away while the hut's river freezes: another scene, viewed on this screen only (not activated: the
// players stay where they are), snow falling over it, and the clock running from 08:00 to 16:00 at −8 °C. Leaves the
// view on that scene; the caller views the hut again and prepares.
export async function away(sceneName = 'Forest Path', seconds = 8) {
  const scene = game.scenes.getName(sceneName);
  await scene.view();
  for (let i = 0; i < 200 && !(canvas.ready && canvas.scene?.id === scene.id); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 2500));
  canvas.tokens.releaseAll();
  S ??= await import(`/modules/animater/scripts/engines/motion/sky-light.mjs?t=${v}`);
  SW ??= await import(`/modules/animater/scripts/engines/motion/sky-weather.mjs?t=${v}`);
  const r = canvas.app.renderer, bake = (g, rt) => r.render(g, { renderTexture: rt, clear: true });
  const b = canvas.dimensions.sceneRect, grid = canvas.grid.size;
  const layer = (sortLayer, elevation) => { const c = new PIXI.Container(); c.sortLayer = sortLayer; c.elevation = elevation; canvas.primary.addChild(c); return c; };
  const low = layer(644, 0), high = layer(1101, 20.02);
  const indoors = Array.from(canvas.scene.regions).filter((g) => Array.from(g.behaviors).some((x) => x.type === 'suppressWeather')).flatMap((g) => Array.from(g.polygons, (p) => Array.from(p.points)));
  const surf = S.createSurfaceLight({ PIXI, root: () => low, above: () => high, glowing: () => high, render: bake });
  surf.build({ water: [], grassAll: true, indoors, bounds: b, grid });
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
  { const g = vignette.getContext('2d'), grad = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.02); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.42)'); g.fillStyle = grad; g.fillRect(0, 0, W, H); }
  kit = { r, low, high, snowTop: null, chimneyTop: null, glowRoot: new PIXI.Container(), flashRoot: new PIXI.Container(), skyGlow: new PIXI.Container(), out, ctx: out.getContext('2d'), vignette, dark: null, grid };
  const scene0 = SW.weatherScene({ id: 'snow' }), cover = 0.75;
  // The scene filling the frame, drifting in a little.
  const fit = Math.max(W / b.width, H / b.height);
  const cam0 = { x: b.x + b.width / 2, y: b.y + b.height / 2, scale: fit * 1.15 }, cam1 = { ...cam0, scale: fit * 1.25 };
  const n = seconds * FPS, live = liveLayers();
  live.forEach((c) => { c.visible = false; });
  // The scene's own tokens kept out (the party is the story here, not what lies on this map).
  const tokens = canvas.tokens.placeables.map((t) => [t, t.visible]);
  tokens.forEach(([t]) => { t.visible = false; t.renderable = false; });
  surf.tick(20);
  try {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      await setDark(0.08, 3);
      surf.look({ light: 0.55, clouds: cover, color: [0.92, 0.95, 1], wind: 0.45, windAngle: 0.3, snow: lerp(0.15, 0.7, k), weather: scene0, cover, cloudShift: shiftOf(grid) });
      surf.veil(S.weatherLight({ kind: 'snow', snow: 0.5, clouds: cover, day: 0.9 }), []);
      const cam = { x: cam0.x, y: cam0.y, scale: lerp(cam0.scale, cam1.scale, ease(k)) };
      const ctx = kit.ctx;
      ctx.globalAlpha = 1; ctx.drawImage(grab(cam), 0, 0);
      ctx.drawImage(kit.vignette, 0, 0);
      // The clock running, the frost, and where the party is.
      const minutes = 8 * 60 + Math.round(ease(k) * 8 * 60), hh = String(Math.floor(minutes / 60)).padStart(2, '0'), mm = String(minutes % 60).padStart(2, '0');
      const a = Math.min(smooth(0.02, 0.12, k), 1 - smooth(0.92, 1, k));
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,8,10,0.6)'; ctx.fillRect(W - 430, 60, 370, 150);
      ctx.fillStyle = '#d8b26a'; ctx.fillRect(W - 430, 60, 4, 150);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '600 20px "Signika"'; ctx.letterSpacing = '5px'; ctx.fillStyle = '#e3c27f'; ctx.fillText(sceneName.toUpperCase(), W - 404, 78);
      ctx.font = '400 74px "Modesto Condensed"'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffffff'; ctx.fillText(`${hh}:${mm}`, W - 404, 104);
      ctx.font = '400 30px "Signika"'; ctx.letterSpacing = '0px'; ctx.fillStyle = 'rgba(200,225,255,0.95)'; ctx.fillText('\u22128 \u00b0C  \u00b7  snow', W - 220, 132);
      ctx.restore();
      lowerThird(ctx, { kicker: 'Meanwhile, far away', title: 'The party travels on', line: "Eight hours of frost on the clock; back at the hut, the river freezes on its own" }, k);
      await upload('awayScene', i);
      surf.tick(1 / FPS);
    }
  } finally {
    live.forEach((c) => { c.visible = true; });
    tokens.forEach(([t, was]) => { t.visible = was; t.renderable = true; });
    try { surf.clear(); } catch { /* gone */ }
    for (const c of [low, high]) { try { c.destroy({ children: true }); } catch { /* gone */ } }
    kit = null;
  }
  return { frames: n };
}

// Only some parts, by name (cards too). Progress in window.__full.
export async function parts(names) {
  window.__full = { done: [], current: null, error: null, started: Date.now() };
  try {
    const bg = await backgrounds();
    for (const part of names) {
      window.__full.current = part;
      if (part === 'cardAway') await card('cardAway', 4, { background: bg.day, title: 'MEANWHILE', big: 120, lines: [['The party is far away; eight hours of frost pass on the clock', 28, 'rgba(240,236,226,0.95)']] });
      else await shot(part);
      window.__full.done.push(part);
    }
    window.__full.current = 'finished';
  } catch (e) { window.__full.error = String(e?.stack ?? e); }
  return window.__full;
}
// The whole film (or from one part on). Progress in window.__full.
export async function record(startAt = null) {
  window.__full = { done: [], current: null, error: null, started: Date.now() };
  try {
    const bg = await backgrounds();
    const cards = {
      opening: () => card('opening', 6, { background: bg.day, lines: [['Light, weather and life for Foundry VTT', 34, 'rgba(240,236,226,0.95)'], ['By day and by night, through every season', 24, 'rgba(216,178,106,0.85)']] }),
      cardSeasons: () => card('cardSeasons', 4, { background: bg.day, title: 'THE SEASONS', big: 120, lines: [['The ground and the trees through the year', 28, 'rgba(240,236,226,0.95)']] }),
      cardAway: () => card('cardAway', 4, { background: bg.day, title: 'MEANWHILE', big: 120, lines: [['The party is far away; eight hours of frost pass on the clock', 28, 'rgba(240,236,226,0.95)']] }),
      cardWeather: () => card('cardWeather', 4, { background: bg.day, title: 'THE WEATHER', big: 120, lines: [["All of Calendaria's weathers, drawn by Animater", 28, 'rgba(240,236,226,0.95)']] }),
      cardDusk: () => card('cardDusk', 4, { background: bg.night, title: 'NIGHT FALLS', big: 120, lines: [['Moonlight, lamplight and life in the dark', 28, 'rgba(240,236,226,0.95)']] }),
      cardNightWeather: () => card('cardNightWeather', 4, { background: bg.night, title: 'WEATHER BY NIGHT', big: 110, lines: [['Storms, snow and stranger skies', 28, 'rgba(240,236,226,0.95)']] }),
      closing: () => card('closing', 7, { background: bg.night, lines: [['Every effect has its own setting, and a quality level for every machine', 28, 'rgba(240,236,226,0.95)'], ["Shown in Bokken's Hut", 22, 'rgba(216,178,106,0.85)']] }),
    };
    let on = !startAt;
    for (const part of ORDER) {
      if (!on && part === startAt) on = true;
      if (!on) continue;
      window.__full.current = part;
      if (cards[part]) await cards[part](); else await shot(part);
      window.__full.done.push(part);
    }
    finish();
    window.__full.current = 'finished';
  } catch (e) { window.__full.error = String(e?.stack ?? e); }
  return window.__full;
}

export function finish() {
  for (const x of [kit?.canopy, kit?.surf, kit?.glow, kit?.flash, kit?.tileSnow, kit?.sway, kit?.smoke]) { try { x.clear(); } catch { /* gone */ } }
  for (const x of [kit?.low, kit?.high, kit?.snowTop, kit?.chimneyTop, kit?.glowRoot, kit?.flashRoot, kit?.skyGlow]) { try { x.destroy({ children: true }); } catch { /* gone */ } }
  canvas.environment.initialize();
  kit = null;
}

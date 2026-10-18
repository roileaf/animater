// Development gallery for animater's token FX: every built-in preset on sample tokens,
// rendered with Foundry's own PIXI build. Also compiles every filter type and reports errors.
import * as PIXI from '/preview-pixi.mjs';
import { PRESETS, FILTER_TYPES, presetFilters, specFor } from '../../scripts/engines/tokenshade/index.mjs';
import { shaderSource, fieldSource } from '../../scripts/engines/tokenshade/filter-factory.mjs';

globalThis.PIXI ??= PIXI;
const params = new URLSearchParams(location.search);
const ART = (params.get('art') ?? '/icons/svg/mystery-man.svg,/icons/svg/mystery-man.svg').split(',');
const stageEl = document.getElementById('stage'), hud = document.getElementById('hud'), errorsEl = document.getElementById('errors');
const errors = [];
const origError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(' ')); errorsEl.textContent = errors.slice(-6).join('\n'); origError(...args); };

const app = new PIXI.Application({ resizeTo: stageEl, backgroundColor: 0x2a2e26, antialias: true, resolution: devicePixelRatio, autoDensity: true });
stageEl.appendChild(app.view);
const world = new PIXI.Container();
const grid = new PIXI.Graphics();
app.stage.addChild(grid, world);

const GRID = 100;
const tokens = [];
for (const [i, src] of ART.entries()) {
  const sprite = PIXI.Sprite.from(src);
  sprite.anchor.set(0.5);
  const size = GRID * (i === 0 ? 2 : 1.5);
  const fit = () => { const t = sprite.texture; if (t.width > 1) sprite.scale.set(size / Math.max(t.width, t.height)); };
  sprite.texture.baseTexture.on('loaded', fit); fit();
  tokens.push({ sprite, size: { width: size, height: size } });
  world.addChild(sprite);
}
let zoom = 1;
function layout() {
  grid.clear().lineStyle(1, 0x000000, 0.22);
  const step = GRID * zoom;
  for (let x = (app.screen.width / 2) % step; x < app.screen.width; x += step) grid.moveTo(x, 0).lineTo(x, app.screen.height);
  for (let y = (app.screen.height / 2) % step; y < app.screen.height; y += step) grid.moveTo(0, y).lineTo(app.screen.width, y);
  world.scale.set(zoom);
  world.position.set(app.screen.width / 2, app.screen.height / 2);
  tokens[0].sprite.position.set(-GRID * 1.6, 0);
  tokens[1]?.sprite.position.set(GRID * 1.6, 0);
}
app.renderer.on('resize', layout); layout();

let active = [], start = performance.now(), current = null;
function show(preset) {
  for (const t of tokens) { t.sprite.filters = null; }
  active.forEach(f => f.destroy()); active = [];
  current = preset;
  start = performance.now();
  if (!preset) return;
  for (const t of tokens) {
    const filters = presetFilters(PIXI, preset, { tokenSize: t.size, key: 'gallery' });
    t.sprite.filters = filters; active.push(...filters);
  }
  hud.textContent = `${preset.name} · ${preset.params.map(p => p.filterType).join(' + ')}`;
  history.replaceState(null, '', `${location.pathname}?${new URLSearchParams({ ...Object.fromEntries(params), preset: preset.name, lib: preset.library })}`);
}
let frames = 0, acc = 0;
app.ticker.add(() => {
  const now = performance.now();
  for (const f of active) f.update(now - start, Date.now());
  acc += app.ticker.deltaMS; frames++;
  if (acc > 500) { hud.dataset.fps = Math.round(frames * 1000 / acc); hud.textContent = `${current?.name ?? ''} · ${current?.params.map(p => p.filterType).join(' + ') ?? ''} · ${hud.dataset.fps} fps`; acc = 0; frames = 0; }
});

const list = document.getElementById('list');
const search = document.getElementById('search'), library = document.getElementById('library');
function renderList() {
  const q = search.value.toLowerCase(), lib = library.value;
  list.innerHTML = '';
  for (const p of PRESETS) {
    if (lib && p.library !== lib) continue;
    if (q && !`${p.name} ${p.params.map(x => x.filterType).join(' ')}`.toLowerCase().includes(q)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<span></span><small></small>`;
    li.firstChild.textContent = p.name; li.lastChild.textContent = p.params.map(x => x.filterType).join('+');
    li.classList.toggle('on', p === current);
    li.onclick = () => { show(p); renderList(); };
    list.append(li);
  }
}
search.oninput = renderList; library.onchange = renderList;
document.getElementById('zoom').onchange = e => { zoom = +e.target.value; layout(); };

// Compile every filter type's fragment shader directly, then render each once.
globalThis.fxCheck = async () => {
  const gl = app.renderer.gl, failed = [], messages = [];
  const prefix = app.renderer.context.webGLVersion === 2 ? '' : '';
  for (const type of FILTER_TYPES) for (const [label, source] of [[type, shaderSource(specFor(type))], [`${type} field`, fieldSource(specFor(type))]]) {
    if (!source) continue;
    const sh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(sh, prefix + source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { failed.push(type); messages.push(`${label}: ${gl.getShaderInfoLog(sh)}`); }
    gl.deleteShader(sh);
  }
  const rt = PIXI.RenderTexture.create({ width: 128, height: 128 });
  const probe = PIXI.Sprite.from(ART[0]); probe.anchor.set(0.5); probe.position.set(64); probe.width = probe.height = 80;
  for (const type of FILTER_TYPES) {
    const [f] = presetFilters(PIXI, { name: type, params: [{ filterType: type }] }, { tokenSize: { width: 80, height: 80 } });
    try { probe.filters = f ? [f] : null; app.renderer.render(probe, { renderTexture: rt }); }
    catch (e) { failed.push(type); messages.push(`${type}: ${e.message}`); }
    f?.destroy();
  }
  probe.destroy(); rt.destroy(true);
  return { types: FILTER_TYPES.length, failed: [...new Set(failed)], messages };
};

const wanted = PRESETS.find(p => p.name === params.get('preset') && (!params.get('lib') || p.library === params.get('lib'))) ?? PRESETS.find(p => p.name === 'fire');
show(wanted); renderList();
globalThis.fxGallery = { app, show, PRESETS, tokens };

// Contact sheet: ?sheet=0,1,… shows 20 presets at a time on one token each.
const sheet = params.get('sheet');
if (sheet !== null) {
  show(null);
  world.visible = false; grid.visible = false;
  document.body.style.gridTemplateColumns = "0 1fr"; app.resize();
  const per = +(params.get("per") ?? 20), cols = +(params.get("cols") ?? 5), rows = Math.ceil(per / cols);
  const start = params.has("from") ? +params.get("from") : +sheet * per;
  // ?names=a|b|c puts each named preset on every art in ?art= side by side.
  const named = params.get('names')?.split('|').map(n => PRESETS.find(p => p.name === n)).filter(Boolean);
  const src0 = ART[+(params.get('artIndex') ?? 1)] ?? ART[0];
  const page = named ? named.flatMap(preset => ART.map(art => ({ preset, art }))) : PRESETS.slice(start, start + per).map(preset => ({ preset, art: src0 }));
  const cells = new PIXI.Container();
  app.stage.addChild(cells);
  const all = [];
  const cw = () => app.screen.width / cols, ch = () => app.screen.height / rows;
  page.forEach(({ preset, art: src }, i) => {
    const cell = new PIXI.Container();
    const s = PIXI.Sprite.from(src); s.anchor.set(0.5);
    const size = Math.min(cw(), ch()) * 0.5;
    const fit = () => { const t = s.texture; if (t.width > 1) s.scale.set(size / Math.max(t.width, t.height)); };
    s.texture.baseTexture.on('loaded', fit); fit();
    const filters = presetFilters(PIXI, preset, { tokenSize: { width: size, height: size }, key: 'sheet' });
    s.filters = filters; all.push(...filters);
    const label = new PIXI.Text(preset.name, { fontSize: 11, fill: 0xe9e6df });
    label.anchor.set(0.5, 0); label.position.set(0, ch() * 0.4);
    cell.addChild(s, label);
    cell.position.set((i % cols + 0.5) * cw(), (Math.floor(i / cols) + 0.42) * ch());
    cells.addChild(cell);
  });
  const t0 = performance.now();
  app.ticker.add(() => { const now = performance.now(); for (const f of all) f.update(now - t0, Date.now()); });
  hud.textContent = `sheet ${sheet}: ${page[0]?.preset.name} … ${page.at(-1)?.preset.name}`;
}

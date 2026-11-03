// Weather audition: a panel inside the running game to try every weather Animater draws, on this screen only (nothing
// in the world changes), and mark each Good or Needs work with a note. Open it from the console or a macro:
//   (await import('/modules/animater/tools/live/weather-audition.mjs')).open()
// The verdicts stay in this browser (localStorage 'animater.weatherAudition').
import { WEATHERS, weatherLabel } from '../../scripts/engines/motion/sky-weather.mjs';
import { skyClear } from '../../scripts/engines/motion/sun.mjs';

const KEY = 'animater.weatherAudition';
const GROUPS = {
  Standard: ['clear', 'partly-cloudy', 'cloudy', 'overcast', 'drizzle', 'rain', 'fog', 'mist', 'windy', 'sunshower', 'snow', 'sleet', 'heat-wave'],
  Severe: ['thunderstorm', 'blizzard', 'hail', 'tornado', 'hurricane', 'ice-storm', 'monsoon'],
  Environmental: ['ashfall', 'sandstorm', 'luminous-sky', 'sakura-bloom', 'autumn-leaves', 'rolling-fog', 'wildfire-smoke', 'dust-devil'],
  Fantasy: ['black-sun', 'ley-surge', 'aether-haze', 'nullfront', 'permafrost-surge', 'gravewind', 'veilfall', 'arcane-winds', 'acid-rain', 'blood-rain', 'meteor-shower', 'spore-cloud', 'divine-light', 'plague-miasma'],
};
const STORMS = new Set(['thunderstorm', 'hurricane', 'tornado', 'monsoon']);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage refused */ } };

let panel = null, envInit = null;
const state = { preset: null, time: 'scene', wind: 0.4, from: 'w' };
// The hour shown: the scene's own, broad day, or deep night (this screen only).
const TIMES = { scene: ['As scene', null], day: ['Day', 0.05], night: ['Night', 0.9] }, ORDER = ['scene', 'day', 'night'];
const ANGLES = { w: 0, nw: Math.PI / 4, n: Math.PI / 2, ne: (3 * Math.PI) / 4, e: Math.PI, se: -(3 * Math.PI) / 4, s: -Math.PI / 2, sw: -Math.PI / 4 };

// The darkness on this screen only (null: the scene's own), put back as it was.
let forced = null;
const setDarkness = (level) => {
  const env = canvas.environment;
  forced = level;
  if (level !== null && !envInit) {
    envInit = env.initialize;
    env.initialize = function (cfg = {}) { return envInit.call(this, forced === null ? cfg : foundry.utils.mergeObject(cfg ?? {}, { environment: { darknessLevel: forced } }, { inplace: false })); };
  }
  if (level === null && envInit) { env.initialize = envInit; delete env.initialize; envInit = null; }
  env.initialize(level === null ? { environment: { darknessLevel: canvas.scene._source.environment.darknessLevel } } : {});
};

const presetOf = async (id) => {
  try { const all = await globalThis.CALENDARIA?.api?.getWeatherPresets?.(); const list = Array.isArray(all) ? all : Object.values(all ?? {}); return list.find((p) => p.id === id) ?? { id }; } catch { return { id }; }
};

const show = async (id) => {
  state.preset = id;
  const p = await presetOf(id), type = String(p.precipitation?.type ?? ''), amount = Number(p.precipitation?.intensity) || 0;
  const clouds = Math.min(1, Math.max(0, 1 - skyClear({ id })));
  game.modules.get('animater').api.debug.previewWeatherLight({
    preset: id, clouds,
    rain: /rain|drizzle|sleet/.test(type) ? amount : 0, snow: /snow|sleet/.test(type) ? amount : 0,
    storm: STORMS.has(id), severity: STORMS.has(id) ? 0.85 : 0,
    wind: state.wind, windAngle: ANGLES[state.from],
  });
  render();
};

const css = `
#animater-audition{position:fixed;top:60px;right:330px;width:330px;max-height:80vh;display:flex;flex-direction:column;background:#1d1b22f2;color:#e8e4dc;border:1px solid #4a4452;border-radius:8px;font:13px/1.35 Signika,sans-serif;z-index:1000;box-shadow:0 6px 24px #0008}
#animater-audition header{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #3a3542;cursor:move}
#animater-audition header b{flex:1}
#animater-audition .ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #3a3542}
#animater-audition .list{overflow:auto;padding:4px 10px 10px}
#animater-audition h4{margin:10px 0 4px;color:#b9a9d6;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
#animater-audition .row{display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:5px}
#animater-audition .row.on{background:#3a3150}
#animater-audition .row .name{flex:1;cursor:pointer}
#animater-audition button{background:#2c2833;color:inherit;border:1px solid #4a4452;border-radius:4px;padding:2px 7px;cursor:pointer;font:inherit;line-height:1.4;width:auto;flex:none}
#animater-audition button.good{background:#2d5a36;border-color:#3f7a4a}
#animater-audition button.bad{background:#6a3030;border-color:#8a4040}
#animater-audition textarea{width:100%;min-height:52px;margin:4px 0 6px;background:#14121a;color:inherit;border:1px solid #4a4452;border-radius:4px;font:inherit;resize:vertical}
#animater-audition select,#animater-audition input[type=range]{flex:1;min-width:80px}
#animater-audition .tally{color:#a8a2b4;font-size:12px}`;

const render = () => {
  if (!panel) return;
  const verdicts = load();
  const rows = Object.entries(GROUPS).map(([group, ids]) => `<h4>${group}</h4>` + ids.filter((id) => WEATHERS.includes(id)).map((id) => {
    const v = verdicts[id] ?? {}, on = state.preset === id;
    return `<div class="row ${on ? 'on' : ''}" data-id="${id}"><span class="name">${weatherLabel(id)}</span>
      <button data-v="good" class="${v.verdict === 'good' ? 'good' : ''}" title="Good">✓</button>
      <button data-v="bad" class="${v.verdict === 'bad' ? 'bad' : ''}" title="Needs work">✗</button></div>
      ${on ? `<textarea data-note="${id}" placeholder="What needs work? (saved as you type)">${v.note ?? ''}</textarea>` : ''}`;
  }).join('')).join('');
  const all = Object.values(GROUPS).flat(), done = all.filter((id) => verdicts[id]?.verdict).length, bad = all.filter((id) => verdicts[id]?.verdict === 'bad').length;
  panel.querySelector('.list').innerHTML = rows;
  panel.querySelector('.tally').textContent = `${done}/${all.length} judged · ${bad} need work`;
  panel.querySelector('textarea')?.focus({ preventScroll: true });
};

export function open() {
  if (panel) return panel;
  const style = document.createElement('style'); style.id = 'animater-audition-style'; style.textContent = css; document.head.append(style);
  panel = document.createElement('section');
  panel.id = 'animater-audition';
  panel.innerHTML = `<header><b>Weather audition</b><span class="tally"></span><button data-act="close" title="Close">✕</button></header>
    <div class="ctl">
      <button data-act="time" title="The hour shown, on this screen only">${TIMES[state.time][0]}</button>
      <label>Wind</label><input type="range" min="0" max="1" step="0.05" value="${state.wind}" data-act="wind">
      <select data-act="from">${Object.keys(ANGLES).map((k) => `<option value="${k}" ${k === state.from ? 'selected' : ''}>from ${k.toUpperCase()}</option>`).join('')}</select>
      <button data-act="near">Close</button><button data-act="far">Whole map</button>
    </div>
    <div class="list"></div>`;
  document.body.append(panel);
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button'), row = e.target.closest('.row');
    if (b?.dataset.act === 'close') return close();
    if (b?.dataset.act === 'time') { state.time = ORDER[(ORDER.indexOf(state.time) + 1) % ORDER.length]; setDarkness(TIMES[state.time][1]); b.textContent = TIMES[state.time][0]; return; }
    if (b?.dataset.act === 'near') return void canvas.animatePan({ scale: 0.6, duration: 250 });
    if (b?.dataset.act === 'far') return void canvas.animatePan({ scale: 0.2, duration: 250 });
    if (b?.dataset.v && row) { const v = load(), id = row.dataset.id; v[id] = { ...(v[id] ?? {}), verdict: v[id]?.verdict === b.dataset.v ? null : b.dataset.v }; save(v); if (state.preset !== id) void show(id); else render(); return; }
    if (row && e.target.classList.contains('name')) void show(row.dataset.id);
  });
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.act === 'wind') { state.wind = Number(t.value); if (state.preset) void show(state.preset); }
    if (t.dataset.note) { const v = load(); v[t.dataset.note] = { ...(v[t.dataset.note] ?? {}), note: t.value }; save(v); }
  });
  panel.addEventListener('change', (e) => { if (e.target.dataset.act === 'from') { state.from = e.target.value; if (state.preset) void show(state.preset); } });
  // Dragged by its header.
  const head = panel.querySelector('header');
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (m) => { panel.style.left = `${m.clientX - dx}px`; panel.style.top = `${m.clientY - dy}px`; panel.style.right = 'auto'; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  render();
  return panel;
}

export function close() {
  try { game.modules.get('animater').api.debug.previewWeatherLight(null); } catch { /* gone */ }
  setDarkness(null); state.time = 'scene';
  panel?.remove(); panel = null; state.preset = null;
  document.getElementById('animater-audition-style')?.remove();
}

// The verdicts so far ({ id: { verdict: 'good' | 'bad', note } }).
export const verdicts = load;

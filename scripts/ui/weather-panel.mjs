// The Weather panel (Animater controls): build the scene's weather. Start from any weather, or none, choose what falls
// and add any effect; save it as a preset. A slider shows on the GM's screen as it moves and reaches everyone on
// letting go, so nothing is written to the scene while dragging.
import { FALL_CHOICES, TUNE_COLORS, TUNE_EFFECTS, TUNE_SLIDERS, cleanTune, effectIn, tuneTouched } from '../engines/motion/weather-tune.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Which way what falls goes, as four choices side by side.
const WAYS = [
  ['', 'Auto', 'fa-wand-magic-sparkles', "As the module's setting."],
  ['off', 'With wind', 'fa-wind', 'The wind takes it whichever way it blows.'],
  ['on', 'Down map', 'fa-arrow-down', 'Always down the map; the wind only leans it.'],
  ['top', 'From above', 'fa-bullseye', 'For top-down maps: rain and snow stream in toward the point under the camera, and rain lands in ripples.'],
];
// The compass, row by row, north up the map (the middle is the weather's own direction).
const COMPASS = ['nw', 'n', 'ne', 'w', '', 'e', 'sw', 's', 'se'];
const COMPASS_NAMES = { n: 'north', ne: 'north-east', e: 'east', se: 'south-east', s: 'south', sw: 'south-west', w: 'west', nw: 'north-west' };
// The weathers, in families (anything else, under Strange): a tab for each, showing its own.
const FAMILIES = [
  ['clear', 'Clear', 'fa-cloud-sun', ['clear', 'partly-cloudy', 'cloudy', 'overcast', 'windy', 'heat-wave']],
  ['rain', 'Rain', 'fa-cloud-rain', ['drizzle', 'rain', 'sunshower', 'monsoon', 'sleet', 'hail']],
  ['snow', 'Snow', 'fa-snowflake', ['snow', 'blizzard', 'ice-storm', 'permafrost-surge']],
  ['storms', 'Storms', 'fa-cloud-bolt', ['thunderstorm', 'tornado', 'hurricane', 'sandstorm', 'dust-devil']],
  ['fog', 'Fog', 'fa-smog', ['fog', 'mist', 'rolling-fog', 'ashfall', 'wildfire-smoke']],
  ['seasons', 'Seasons', 'fa-leaf', ['sakura-bloom', 'autumn-leaves', 'spore-cloud']],
  ['strange', 'Strange', 'fa-wand-sparkles', null],
];
const FALL_ICONS = { rain: 'fa-cloud-rain', snow: 'fa-snowflake', hail: 'fa-icicles', ash: 'fa-fire-flame-simple', petal: 'fa-spa', leaf: 'fa-leaf', spore: 'fa-bacterium', sand: 'fa-hourglass-half', ember: 'fa-fire', gust: 'fa-wind', debris: 'fa-mound' };
const EFFECT_ICONS = { mist: 'fa-smog', curtains: 'fa-cloud-showers-heavy', bands: 'fa-hurricane', tornado: 'fa-tornado', dustDevil: 'fa-wind', smoke: 'fa-cloud', heat: 'fa-temperature-high', frost: 'fa-icicles', glaze: 'fa-snowflake', rays: 'fa-sun', glow: 'fa-lightbulb', rainbow: 'fa-rainbow', aurora: 'fa-water', sparks: 'fa-bolt', wisps: 'fa-ghost', meteors: 'fa-meteor', noise: 'fa-tv' };

const bare = (value) => String(value ?? '').replace(/^animater\./, '');
// Which tab a weather is under (pure): 'calendar' for none of its own.
export function familyOf(weather) {
  if (!weather) return 'calendar';
  return (FAMILIES.find(([, , , ids]) => ids?.includes(bare(weather))) ?? FAMILIES.at(-1))[0];
}
// A module's own word for an effect, for reading ("rainsimple" stays as it is; "heavy_fog" reads "Heavy fog").
const wordsOf = (type) => { const text = String(type ?? '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase(); return text ? text[0].toUpperCase() + text.slice(1) : 'Effect'; };
const AMOUNT_ROWS = [['cover', 'fa-cloud'], ['gloom', 'fa-moon'], ['fog', 'fa-smog'], ['lightning', 'fa-cloud-bolt'], ['wind', 'fa-wind'], ['temperature', 'fa-temperature-half']];
// What is at work on this scene and who says so (pure): one row each, { key, icon, name, detail, source, action, data }. `action` is how to turn it off from here; other modules' effects have none, as they are theirs to turn off.
export function activeWeather({ off = false, weather = '', weatherName = '', calendar = null, tune: raw = null, stormDark = null, fxEffects = null, fxFilters = null } = {}) {
  const tune = cleanTune(raw), rows = [], own = String(weather).startsWith('animater.'), mine = 'Set in this panel', fx = [...Object.entries(fxEffects ?? {}), ...Object.entries(fxFilters ?? {})];
  const others = fx.map(([id, effect]) => ({ key: `fx-${id}`, icon: 'fa-wand-magic-sparkles', name: wordsOf(effect?.type ?? id), detail: 'Turn off in FXMaster', source: 'FXMaster' }));
  if (off) return [{ key: 'off', icon: 'fa-ban', name: 'No weather on this scene', detail: 'Whatever the calendar says', source: 'Animater', action: 'setWeatherOff' }, ...others];
  if (weather) rows.push({ key: 'weather', icon: 'fa-cloud-sun-rain', name: weatherName || wordsOf(weather), detail: calendar?.name ? `The scene's own, in place of ${calendar.name}` : "The scene's own weather", source: own ? 'Animater' : 'Foundry', action: 'setWeather', data: 'data-weather=""' });
  else if (calendar?.name) rows.push({ key: 'calendar', icon: 'fa-calendar-days', name: calendar.name, detail: "The calendar's weather", source: 'Calendaria' });
  for (const slot of ['fall', 'fall2']) if (FALL_CHOICES[tune[slot]]) rows.push({ key: slot, icon: FALL_ICONS[tune[slot]], name: FALL_CHOICES[tune[slot]], detail: slot === 'fall' ? mine : 'Also falling, set in this panel', source: 'Animater', action: 'setFall', data: `data-slot="${slot}" data-kind=""` });
  if (tune.fall === 'none') rows.push({ key: 'fall', icon: 'fa-ban', name: 'Nothing falling', detail: mine, source: 'Animater', action: 'setFall', data: 'data-slot="fall" data-kind=""' });
  for (const [key, icon] of AMOUNT_ROWS) if (tune[key] !== null) rows.push({ key, icon, name: `${TUNE_SLIDERS[key].label} ${sliderText(key, tune[key])}`, detail: mine, source: 'Animater', action: 'resetTune', data: `data-key="${key}"` });
  for (const [key, effect] of Object.entries(TUNE_EFFECTS)) if (tune[key] > 0) rows.push({ key, icon: EFFECT_ICONS[key], name: `${effect.label} ${sliderText(key, tune[key])}`, detail: mine, source: 'Animater', action: 'resetTune', data: `data-key="${key}"` });
  if (stormDark) rows.push({ key: 'stormDark', icon: 'fa-moon', name: 'Storm darkness', detail: `Scene darkness raised to ${Math.round(Number(stormDark.target) * 100) / 100}`, source: 'Animater' });
  return [...rows, ...others];
}
function activeSection(rows) {
  const list = rows.map((r) => `<li class="animater-wx-active-row"><i class="fa-solid ${r.icon ?? 'fa-circle'}" inert></i><span class="animater-wx-active-text"><strong>${esc(r.name)}</strong><small>${esc(r.detail)}</small></span><span class="animater-wx-source" data-source="${esc(r.source)}">${esc(r.source)}</span>${r.action ? `<button type="button" class="animater-wx-off" data-action="${r.action}" ${r.data ?? ''} data-tooltip="Turn off" aria-label="Turn off ${esc(r.name)}"><i class="fa-solid fa-xmark" inert></i></button>` : '<span></span>'}</li>`).join('');
  return `<section class="animater-wx-section animater-wx-active"><h3>What's active on this scene <small>${rows.length ? (rows.length === 1 ? '1 effect' : `${rows.length} effects`) : ''}</small></h3>${rows.length ? `<ul>${list}</ul>` : '<p class="animater-wx-none">No weather or effects on this scene.</p>'}</section>`;
}
// One button, active or not. `data` its data attributes, as written.
const chip = (action, data, label, { icon = '', active = false, tip = '' } = {}) => `<button type="button" class="${active ? 'is-active' : ''}" data-action="${action}" ${data} aria-pressed="${active}"${tip ? ` data-tooltip="${esc(tip)}"` : ''}>${icon ? `<i class="fa-solid ${icon}" inert></i>` : ''}<span>${esc(label)}</span></button>`;
function weatherButtons(weathers, now, family, off = false) {
  const tabs = [chip('setWeatherOff', '', 'No weather', { icon: 'fa-ban', active: off, tip: 'None on this scene, whatever the calendar says.' }), chip('setFamily', 'data-family="calendar"', 'Calendar', { icon: 'fa-calendar-days', active: !off && family === 'calendar', tip: "The calendar's weather, or none." }), ...FAMILIES.map(([id, label, icon]) => chip('setFamily', `data-family="${id}"`, label, { icon, active: !off && family === id }))].join('');
  const row = off ? null : FAMILIES.find(([id]) => id === family);
  const own = !row ? [] : row[3] ? weathers.filter(([v]) => v && row[3].includes(bare(v))) : weathers.filter(([v]) => v && !FAMILIES.some(([, , , ids]) => ids?.includes(bare(v))));
  const list = own.length ? `<div class="animater-wx-chips is-words">${own.map(([v, l]) => chip('setWeather', `data-weather="${esc(v)}"`, l, { active: v === now })).join('')}</div>` : '';
  return `<div class="animater-wx-chips is-tabs">${tabs}</div>${list}`;
}
// What choosing an effect's button does to it (pure): on at half strength, or off again, or (the weather's own) off and back.
export function effectToggled(tune, key, base = null) {
  const set = tune?.[key] ?? null, own = effectIn(base, key) > 0.001, on = set === null ? own : set > 0;
  if (on) return own ? 0 : null;
  return own ? null : TUNE_EFFECTS[key]?.start ?? 0.5;
}

// What a slider says now (pure). Left alone it follows the weather: "Auto".
export function sliderText(key, value) {
  const slider = TUNE_SLIDERS[key];
  if (value === null || value === undefined) return slider.times ? '100%' : 'Auto';
  if (slider.unit) return `${Math.round(value)}${slider.unit}`;
  return `${Math.round(value * 100)}%`;
}
const restOf = (key, base) => { const s = TUNE_SLIDERS[key]; return s.times ? 1 : s.default ?? effectIn(base, key); };
// How far along its track a slider sits (pure, for its filled part). Left alone, where the weather has it.
export const sliderFill = (key, value, base = null) => { const s = TUNE_SLIDERS[key], v = value ?? restOf(key, base); return Math.round(((Math.min(s.max, Math.max(s.min, v)) - s.min) / (s.max - s.min)) * 100); };

const resetButton = (key, label) => `<button type="button" class="animater-wx-reset" data-action="resetTune" data-key="${key}" data-tooltip="Back to Auto" aria-label="Reset ${esc(label)}"><i class="fa-solid fa-rotate-left" inert></i></button>`;
function controlRow(key, tune, base, off = false, lead = '') {
  const slider = TUNE_SLIDERS[key], touched = tune[key] !== null;
  const classes = `animater-wx-row${touched ? ' is-set' : ''}${off ? ' is-off' : ''}${lead ? ' is-sub' : ''}`;
  if (slider) {
    return `<div class="${classes}" data-row="${key}">
      <label for="animater-tune-${key}" data-tooltip="${esc(slider.hint)}">${esc(slider.label)}</label>
      <input id="animater-tune-${key}" type="range" data-tune="${key}" min="${slider.min}" max="${slider.max}" step="${slider.step}" value="${tune[key] ?? restOf(key, base)}" style="--fill:${sliderFill(key, tune[key], base)}%"${off ? ' disabled' : ''}>
      <output data-text="${key}">${esc(sliderText(key, tune[key]))}</output>
      ${resetButton(key, slider.label)}
    </div>`;
  }
  const color = TUNE_COLORS[key];
  return `<div class="${classes}" data-row="${key}">
    <label for="animater-tune-${key}" data-tooltip="${esc(color.hint)}">${esc(color.label)}</label>
    <span class="animater-wx-color"><input id="animater-tune-${key}" type="color" data-tune="${key}" value="${esc(tune[key] ?? '#ffffff')}"${off ? ' disabled' : ''}><span class="animater-wx-swatch"${touched ? ` style="background:${esc(tune[key])}"` : ''}></span></span>
    <output data-text="${key}">${touched ? 'Custom' : 'Auto'}</output>
    ${resetButton(key, color.label)}
  </div>`;
}
const fallNames = Object.entries(FALL_CHOICES);
const KIND_NAMES = { 1: 'Rain', 2: 'Snow', 3: 'Hail', 4: 'Ash', 5: 'Petals', 6: 'Leaves', 7: 'Spores', 8: 'Sand', 9: 'Embers', 10: 'Wind gusts', 11: 'Debris' };
function fallButtons(slot, now, first) {
  const kinds = fallNames.map(([id, label]) => chip('setFall', `data-slot="${slot}" data-kind="${id}"`, label, { icon: FALL_ICONS[id], active: now === id }));
  return `<div class="animater-wx-chips">${first.join('')}${kinds.join('')}</div>`;
}

// The panel's content (pure). `state` { weather, tune, way, windFrom }; `weathers` [[value, label]]; `looks` the saved names; `base` the weather as it stands, before any of this (weatherScene's); `family` the tab open, else the weather's own; `second` whether a second thing falling is being chosen; `note` why it would not show.
export function weatherPanelHtml({ state, weathers = [], looks = [], base = null, family = null, second = false, note = '', active = {} }) {
  const tune = cleanTune(state?.tune), now = state?.weather ?? '', known = weathers.some(([v]) => v === now);
  const list = known ? weathers : [...weathers, [now, now]], open = family ?? familyOf(now);
  const own = base?.falls ?? [], ownNames = own.filter((f) => f.kind).map((f) => KIND_NAMES[f.kind]).filter(Boolean);
  const quiet = tune.fall === 'none' || (!tune.fall && !ownNames.length), hasSecond = !!tune.fall2 && tune.fall2 !== 'none';
  const way = state?.way ?? '', from = state?.windFrom ?? '';
  const ways = WAYS.map(([v, label, icon, hint]) => `<button type="button" class="${v === way ? 'is-active' : ''}" data-action="setWay" data-way="${v}" aria-pressed="${v === way}" data-tooltip="${esc(hint)}"><i class="fa-solid ${icon}" inert></i><span>${esc(label)}</span></button>`).join('');
  const compass = COMPASS.map((v) => {
    const name = COMPASS_NAMES[v], tip = name ? `From the ${name}` : "The weather's direction";
    return `<button type="button" class="${v === from ? 'is-active' : ''}" data-action="setFrom" data-from="${v}" aria-pressed="${v === from}" aria-label="${tip}" data-tooltip="${tip}">${v ? esc(v.toUpperCase()) : '<i class="fa-solid fa-wand-magic-sparkles" inert></i>'}</button>`;
  }).join('');
  // Every effect a button; each that is on has its strength below.
  const effectOn = (key) => (tune[key] === null ? effectIn(base, key) > 0.001 : tune[key] > 0);
  const effectButtons = Object.entries(TUNE_EFFECTS).map(([key, e]) => chip('toggleEffect', `data-key="${key}"`, e.label, { icon: EFFECT_ICONS[key], active: effectOn(key), tip: e.hint })).join('');
  const effects = Object.keys(TUNE_EFFECTS).filter(effectOn).map((key) => controlRow(key, tune, base) + (TUNE_EFFECTS[key].color ? controlRow(TUNE_EFFECTS[key].color, tune, base, false, 'sub') : '') + (TUNE_EFFECTS[key].more ?? []).map((more) => controlRow(more, tune, base, false, 'sub')).join('')).join('');
  const presets = looks.length ? `<div class="animater-wx-presets">${looks.map((n) => `<span class="animater-wx-preset"><button type="button" data-action="applyLook" data-name="${esc(n)}" data-tooltip="Use this weather">${esc(n)}</button><button type="button" data-action="deleteLook" data-name="${esc(n)}" data-tooltip="Delete this preset" aria-label="Delete ${esc(n)}"><i class="fa-solid fa-xmark" inert></i></button></span>`).join('')}</div>` : '';
  return `<div class="animater-wx">
    ${note ? `<p class="animater-wx-note"><i class="fa-solid fa-triangle-exclamation" inert></i> ${esc(note)}</p>` : ''}
    ${activeSection(activeWeather({ ...active, off: state?.off === true, weather: now, weatherName: list.find(([v]) => v === now)?.[1] ?? '', tune }))}
    <section class="animater-wx-section"><h3>Start from</h3>${weatherButtons(list, now, open, state?.off === true)}</section>
    <section class="animater-wx-section"><h3>Precipitation</h3>
      ${fallButtons('fall', tune.fall, [chip('setFall', 'data-slot="fall" data-kind=""', `Auto: ${ownNames.length ? ownNames.join(', ') : 'nothing'}`, { icon: 'fa-wand-magic-sparkles', active: !tune.fall, tip: 'What this weather has falling.' }), chip('setFall', 'data-slot="fall" data-kind="none"', 'Nothing', { icon: 'fa-ban', active: tune.fall === 'none' })])}
      ${controlRow('amount', tune, base, quiet)}${controlRow('size', tune, base, quiet)}${controlRow('speed', tune, base, quiet && !hasSecond)}${controlRow('color', tune, base, quiet)}
      ${hasSecond || second ? `<h4>Also falling</h4>${fallButtons('fall2', tune.fall2, [chip('setFall', 'data-slot="fall2" data-kind=""', 'Nothing more', { icon: 'fa-ban', active: !hasSecond })])}` : '<button type="button" class="animater-wx-more" data-action="showSecond"><i class="fa-solid fa-plus" inert></i> Add something else falling</button>'}
      ${hasSecond ? controlRow('amount2', tune, base) + controlRow('color2', tune, base) : ''}
      <h4>Direction</h4><div class="animater-wx-ways" role="group" aria-label="Which way it falls">${ways}</div>
    </section>
    <section class="animater-wx-section"><h3>Sky</h3>
      ${controlRow('temperature', tune, base)}${controlRow('cover', tune, base)}${controlRow('gloom', tune, base)}${controlRow('fog', tune, base)}${controlRow('fogColor', tune, base)}${controlRow('lightning', tune, base)}
    </section>
    <section class="animater-wx-section"><h3>Effects</h3>
      <div class="animater-wx-chips">${effectButtons}</div>
      ${effects}
    </section>
    <section class="animater-wx-section"><h3>Wind</h3>
      ${controlRow('wind', tune, base)}
      <div class="animater-wx-from"><span>Blows from</span><div class="animater-wx-compass" role="group" aria-label="Wind direction">${compass}</div></div>
    </section>
    <section class="animater-wx-section"><h3>My presets</h3>
      ${presets}
      <div class="animater-wx-line"><input type="text" data-look-name placeholder="Name this weather" aria-label="Name this weather" maxlength="60"><button type="button" class="animater-wx-button" data-action="saveLook">Save</button></div>
    </section>
    <footer class="animater-wx-foot"><span>Previews as you drag. Players see it when you let go.</span><button type="button" class="animater-wx-link" data-action="resetAll" data-tooltip="Everything here back to Auto and the calendar's weather. Your presets stay."${tuneTouched(tune) || now || way || from || state?.off ? '' : ' disabled'}>Clear all</button></footer>
  </div>`;
}

// `read()` the scene's { weather, tune, way, windFrom }; `write(changes)` saves those to the scene, for everyone;
// `preview(tune | null)` shows a tune on this screen alone; `looks()`/`saveLooks(all)` the world's presets ({ name: state }); `base()` the weather as it stands before any of this; `active()` what else activeWeather needs to know ({ calendar, stormDark, fxEffects, fxFilters }).
export function weatherPanel(ApplicationV2, { id, read, write, preview, weathers, looks, saveLooks, base = () => null, note = () => '', active = () => ({}) }) {
  return class WeatherPanel extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-weather`, classes: ['animater-weather-panel'],
      window: { title: 'Weather', icon: 'fa-solid fa-cloud-sun-rain', resizable: true }, position: { width: 360, height: 'auto' },
      actions: {
        resetTune(_event, target) { const tune = { ...read().tune, [target.dataset.key]: null }; preview(null); void write({ tune }).then(() => this.render()); },
        resetAll() { preview(null); this.family = null; this.second = false; void write({ off: false, weather: '', tune: cleanTune(), way: '', windFrom: '' }).then(() => this.render()); },
        setWay(_event, target) { void write({ way: target.dataset.way }).then(() => this.render()); },
        setFrom(_event, target) { void write({ windFrom: target.dataset.from }).then(() => this.render()); },
        setWeatherOff() { void write({ off: !read().off }).then(() => this.render()); },
        setFamily(_event, target) { this.family = target.dataset.family; if (target.dataset.family === 'calendar') void write({ off: false, weather: '' }).then(() => this.render()); else if (read().off) void write({ off: false }).then(() => this.render()); else void this.render(); },
        setWeather(_event, target) { void write({ off: false, weather: target.dataset.weather }).then(() => this.render()); },
        setFall(_event, target) { preview(null); void write({ tune: { ...read().tune, [target.dataset.slot]: target.dataset.kind || null } }).then(() => this.render()); },
        toggleEffect(_event, target) { const key = target.dataset.key, tune = read().tune; preview(null); void write({ tune: { ...tune, [key]: effectToggled(tune, key, base()) } }).then(() => this.render()); },
        showSecond() { this.second = true; void this.render(); },
        applyLook(_event, target) { const look = looks()[target.dataset.name]; if (look) { preview(null); this.family = null; void write({ ...look, tune: cleanTune(look.tune) }).then(() => this.render()); } },
        deleteLook(_event, target) { const name = target.dataset.name, all = { ...looks() }; if (!name || !(name in all)) return; delete all[name]; void saveLooks(all).then(() => this.render()); },
        saveLook() { const name = this.element.querySelector('[data-look-name]')?.value?.trim(); if (!name) return; void saveLooks({ ...looks(), [name]: read() }).then(() => this.render()); },
      },
    };
    async _renderHTML() { this.dragged = null; return weatherPanelHtml({ state: read(), weathers: weathers(), looks: Object.keys(looks()).sort(), base: base(), family: this.family ?? null, second: this.second === true, note: note(), active: active() }); }
    _replaceHTML(html, content) { const top = content.scrollTop; content.innerHTML = html; content.scrollTop = top; }
    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      const tuneOf = (input) => cleanTune({ ...read().tune, ...this.dragged, [input.dataset.tune]: input.type === 'range' ? Number(input.value) : input.value });
      const save = (changes) => { preview(null); return write(changes).then(() => this.render()); };
      this.element.addEventListener('input', (event) => {
        const input = event.target; if (!input?.dataset?.tune) return;
        const tune = tuneOf(input), key = input.dataset.tune, text = this.element.querySelector(`[data-text="${key}"]`), row = this.element.querySelector(`[data-row="${key}"]`);
        this.dragged = tune;
        if (input.type === 'range') { input.style.setProperty('--fill', `${sliderFill(key, tune[key])}%`); if (text) text.textContent = sliderText(key, tune[key]); }
        else { const swatch = row?.querySelector('.animater-wx-swatch'); if (swatch) swatch.style.background = tune[key]; if (text) text.textContent = 'Custom'; }
        row?.classList.toggle('is-set', tune[key] !== null);
        preview(tune);
      });
      this.element.addEventListener('change', (event) => {
        const input = event.target; if (!input?.dataset) return;
        if (input.dataset.tune) { void save({ tune: tuneOf(input) }); return; }
      });
    }
    async close(options) { preview(null); return super.close(options); }
  };
}

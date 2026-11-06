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
  ['top', 'From above', 'fa-bullseye', 'For top-down maps: drops and flakes fall away from the eye and rain lands in rings.'],
];
// The compass, row by row, north up the map (the middle is the weather's own direction).
const COMPASS = ['nw', 'n', 'ne', 'w', '', 'e', 'sw', 's', 'se'];
const COMPASS_NAMES = { n: 'north', ne: 'north-east', e: 'east', se: 'south-east', s: 'south', sw: 'south-west', w: 'west', nw: 'north-west' };
// The list of weathers, in families (anything else, under Otherworldly).
const FAMILIES = [
  ['Clear and cloudy', ['clear', 'partly-cloudy', 'cloudy', 'overcast', 'windy', 'heat-wave']],
  ['Rain', ['drizzle', 'rain', 'sunshower', 'monsoon', 'sleet', 'hail']],
  ['Snow and ice', ['snow', 'blizzard', 'ice-storm', 'permafrost-surge']],
  ['Storms', ['thunderstorm', 'tornado', 'hurricane', 'sandstorm', 'dust-devil']],
  ['Fog and smoke', ['fog', 'mist', 'rolling-fog', 'ashfall', 'wildfire-smoke']],
  ['Seasons', ['sakura-bloom', 'autumn-leaves', 'spore-cloud']],
];

const bare = (value) => String(value ?? '').replace(/^animater\./, '');
const LOOK = 'look:';
function weatherOptions(weathers, now, looks) {
  const option = ([v, l]) => `<option value="${esc(v)}"${v === (now ?? '') ? ' selected' : ''}>${esc(l)}</option>`;
  const taken = new Set(), groups = [];
  if (looks.length) groups.push(`<optgroup label="My presets">${looks.map((n) => option([`${LOOK}${n}`, n])).join('')}</optgroup>`);
  for (const [name, ids] of FAMILIES) {
    const rows = weathers.filter(([v]) => v && ids.includes(bare(v)));
    rows.forEach(([v]) => taken.add(v));
    if (rows.length) groups.push(`<optgroup label="${esc(name)}">${rows.map(option).join('')}</optgroup>`);
  }
  const rest = weathers.filter(([v]) => v && !taken.has(v));
  if (rest.length) groups.push(`<optgroup label="Otherworldly">${rest.map(option).join('')}</optgroup>`);
  return [...weathers.filter(([v]) => !v).map(option), ...groups].join('');
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
function fallPicker(field, label, now, autoLabel) {
  const list = [['', autoLabel], ['none', 'Nothing'], ...fallNames];
  return `<div class="animater-wx-pick"><label for="animater-wx-${field}">${esc(label)}</label><select id="animater-wx-${field}" data-tune-pick="${field}">${list.map(([v, l]) => `<option value="${esc(v)}"${v === (now ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}

// The panel's content (pure). `state` { weather, tune, way, windFrom }; `weathers` [[value, label]]; `looks` the saved names; `base` the weather as it stands, before any of this (weatherScene's); `note` why it would not show.
export function weatherPanelHtml({ state, weathers = [], looks = [], base = null, note = '' }) {
  const tune = cleanTune(state?.tune), known = weathers.some(([v]) => v === (state?.weather ?? ''));
  const list = known ? weathers : [...weathers, [state.weather, state.weather]];
  const own = base?.falls ?? [], ownNames = own.filter((f) => f.kind).map((f) => KIND_NAMES[f.kind]).filter(Boolean);
  const quiet = tune.fall === 'none' || (!tune.fall && !ownNames.length);
  const way = state?.way ?? '', from = state?.windFrom ?? '';
  const ways = WAYS.map(([v, label, icon, hint]) => `<button type="button" class="${v === way ? 'is-active' : ''}" data-action="setWay" data-way="${v}" aria-pressed="${v === way}" data-tooltip="${esc(hint)}"><i class="fa-solid ${icon}" inert></i><span>${esc(label)}</span></button>`).join('');
  const compass = COMPASS.map((v) => {
    const name = COMPASS_NAMES[v], tip = name ? `From the ${name}` : "The weather's direction";
    return `<button type="button" class="${v === from ? 'is-active' : ''}" data-action="setFrom" data-from="${v}" aria-pressed="${v === from}" aria-label="${tip}" data-tooltip="${tip}">${v ? esc(v.toUpperCase()) : '<i class="fa-solid fa-wand-magic-sparkles" inert></i>'}</button>`;
  }).join('');
  // An effect shows once the weather has it or it was added; the rest wait in the list to add.
  const effectKeys = Object.keys(TUNE_EFFECTS), shown = effectKeys.filter((key) => tune[key] !== null || effectIn(base, key) > 0.001), hidden = effectKeys.filter((key) => !shown.includes(key));
  const effects = shown.map((key) => controlRow(key, tune, base) + (TUNE_EFFECTS[key].color ? controlRow(TUNE_EFFECTS[key].color, tune, base, false, 'sub') : '')).join('');
  const lookPicker = looks.length
    ? `<div class="animater-wx-line"><select data-look aria-label="My presets">${looks.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select><button type="button" class="animater-wx-icon" data-action="deleteLook" data-tooltip="Delete this preset" aria-label="Delete this preset"><i class="fa-solid fa-trash" inert></i></button></div>`
    : '';
  return `<div class="animater-wx">
    ${note ? `<p class="animater-wx-note"><i class="fa-solid fa-triangle-exclamation" inert></i> ${esc(note)}</p>` : ''}
    <header class="animater-wx-head">
      <label for="animater-weather-kind">Start from</label>
      <select id="animater-weather-kind" data-field="weather">${weatherOptions(list, state?.weather, looks)}</select>
    </header>
    <section class="animater-wx-section"><h3>Precipitation</h3>
      ${fallPicker('fall', 'Falling', tune.fall, `Auto (${ownNames.length ? ownNames.join(' and ') : 'nothing'})`)}
      ${controlRow('amount', tune, base, quiet)}${controlRow('size', tune, base, quiet)}${controlRow('speed', tune, base, quiet && !tune.fall2)}${controlRow('color', tune, base, quiet)}
      ${fallPicker('fall2', 'Also falling', tune.fall2 === 'none' ? '' : tune.fall2, 'Nothing more')}
      ${tune.fall2 && tune.fall2 !== 'none' ? controlRow('amount2', tune, base) + controlRow('color2', tune, base) : ''}
      <div class="animater-wx-ways" role="group" aria-label="Which way it falls">${ways}</div>
    </section>
    <section class="animater-wx-section"><h3>Sky</h3>
      ${controlRow('temperature', tune, base)}${controlRow('cover', tune, base)}${controlRow('fog', tune, base)}${controlRow('fogColor', tune, base)}${controlRow('lightning', tune, base)}
    </section>
    <section class="animater-wx-section"><h3>Effects</h3>
      ${effects}
      ${hidden.length ? `<div class="animater-wx-pick"><label for="animater-wx-add">Add</label><select id="animater-wx-add" data-add-effect><option value="">Choose an effect...</option>${hidden.map((key) => `<option value="${key}">${esc(TUNE_EFFECTS[key].label)}</option>`).join('')}</select></div>` : ''}
    </section>
    <section class="animater-wx-section"><h3>Wind</h3>
      ${controlRow('wind', tune, base)}
      <div class="animater-wx-from"><span>Blows from</span><div class="animater-wx-compass" role="group" aria-label="Wind direction">${compass}</div></div>
    </section>
    <section class="animater-wx-section"><h3>My presets</h3>
      <div class="animater-wx-line"><input type="text" data-look-name placeholder="Name this weather" aria-label="Name this weather" maxlength="60"><button type="button" class="animater-wx-button" data-action="saveLook">Save</button></div>
      ${lookPicker}
    </section>
    <footer class="animater-wx-foot"><span>Previews as you drag. Players see it when you let go.</span><button type="button" class="animater-wx-link" data-action="resetAll"${tuneTouched(tune) ? '' : ' disabled'}>Reset all</button></footer>
  </div>`;
}

// `read()` the scene's { weather, tune, way, windFrom }; `write(changes)` saves those to the scene, for everyone;
// `preview(tune | null)` shows a tune on this screen alone; `looks()`/`saveLooks(all)` the world's presets ({ name: state }); `base()` the weather as it stands before any of this.
export function weatherPanel(ApplicationV2, { id, read, write, preview, weathers, looks, saveLooks, base = () => null, note = () => '' }) {
  return class WeatherPanel extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-weather`, classes: ['animater-weather-panel'],
      window: { title: 'Weather', icon: 'fa-solid fa-cloud-sun-rain', resizable: true }, position: { width: 360, height: 'auto' },
      actions: {
        resetTune(_event, target) { const tune = { ...read().tune, [target.dataset.key]: null }; preview(null); void write({ tune }).then(() => this.render()); },
        resetAll() { preview(null); void write({ tune: cleanTune() }).then(() => this.render()); },
        setWay(_event, target) { void write({ way: target.dataset.way }).then(() => this.render()); },
        setFrom(_event, target) { void write({ windFrom: target.dataset.from }).then(() => this.render()); },
        deleteLook() { const name = this.element.querySelector('[data-look]')?.value, all = { ...looks() }; if (!name || !(name in all)) return; delete all[name]; void saveLooks(all).then(() => this.render()); },
        saveLook() { const name = this.element.querySelector('[data-look-name]')?.value?.trim(); if (!name) return; void saveLooks({ ...looks(), [name]: read() }).then(() => this.render()); },
      },
    };
    async _renderHTML() { this.dragged = null; return weatherPanelHtml({ state: read(), weathers: weathers(), looks: Object.keys(looks()).sort(), base: base(), note: note() }); }
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
        if (input.dataset.tunePick) { void save({ tune: { ...read().tune, [input.dataset.tunePick]: input.value || null } }); return; }
        if ('addEffect' in input.dataset) { if (input.value) void save({ tune: { ...read().tune, [input.value]: 0.5 } }); return; }
        const field = input.dataset.field; if (!field) return;
        if (field === 'weather' && input.value.startsWith(LOOK)) { const look = looks()[input.value.slice(LOOK.length)]; if (look) void save({ ...look, tune: cleanTune(look.tune) }); return; }
        void save({ [field]: input.value });
      });
    }
    async close(options) { preview(null); return super.close(options); }
  };
}

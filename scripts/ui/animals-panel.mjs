import { SIZE_RANGE, sizePercent } from '../engines/motion/vermin.mjs';
import { scopeBar } from './level-scope.mjs';
import { exactCountOf, MOST_COUNT, MOST_HAWKS } from '../engines/motion/region-animals.mjs';
import { normalizeOrder } from '../engines/motion/animal-orders.mjs';

// The Animals panel (Animater controls): how much life a scene has, quickly. Amounts and sizes are the same scene flags as
// Scene configuration > Animater > Creatures, not a copy; the same with Outdoor life. Animals placed by hand are kept on the
// scene (flags.animater.placedAnimals), so every screen adds them, though each screen's animals then go their own way.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ANIMAL_GROUPS = Object.freeze([
  ['Open ground', [['rabbits', 'Rabbits'], ['wildBirds', 'Birds'], ['crows', 'Crows'], ['hawks', 'Hawks'], ['deer', 'Deer'], ['foxes', 'Foxes'], ['wolves', 'Wolves'], ['squirrels', 'Squirrels'], ['snakes', 'Snakes'], ['insects', 'Insects'], ['owls', 'Owls']]],
  ['Water', [['fish', 'Fish'], ['waterBirds', 'Ducks'], ['herons', 'Herons'], ['gulls', 'Gulls'], ['frogs', 'Frogs']]],
  ['Town', [['pigeons', 'Pigeons'], ['hens', 'Hens'], ['cats', 'Cats'], ['dogs', 'Dogs']]],
  ['Farm', [['cows', 'Cows'], ['goats', 'Goats'], ['sheep', 'Sheep'], ['pigs', 'Pigs'], ['horses', 'Horses']]],
  ['Dark places', [['rats', 'Rats'], ['bats', 'Bats'], ['moths', 'Moths'], ['crawlers', 'Crawlers']]],
]);
// The kinds that come only when asked for (none until chosen): wolves, and the town's and the farm's animals.
export const ASKED_FOR = Object.freeze(new Set(['wolves', 'pigeons', 'hens', 'cats', 'dogs', 'cows', 'goats', 'sheep', 'pigs', 'horses']));
// What a level can have of its own.
export const ANIMAL_KEYS = Object.freeze([...ANIMAL_GROUPS.flatMap(([, kinds]) => kinds.flatMap(([kind]) => [kind, `${kind}Size`])), 'outdoorLife', 'animalScale', 'birdHeight', 'placedAnimals']);
const AMOUNTS = [['none', 'None'], ['few', 'Few'], ['', 'Usual'], ['more', 'More'], ['many', 'Many']];
// Wolves are the GM's to ask for: none until chosen, on any scene.
const WOLF_AMOUNTS = [['', 'None'], ['few', 'Few'], ['usual', 'Usual'], ['more', 'More'], ['many', 'Many']];
// Hawks are counted, not given an amount: one unless set (unset reads as 1), up to four.
const HAWK_COUNTS = [['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']];
// What can be placed by hand, and how it is kept.
export const PLACEABLE = Object.freeze([['rabbit', 'Rabbit', 'fa-carrot'], ['songbird', 'Bird', 'fa-dove'], ['deer', 'Deer', 'fa-tree'], ['fox', 'Fox', 'fa-paw'], ['wolf', 'Wolf', 'fa-dog'], ['squirrel', 'Squirrel', 'fa-tree'], ['snake', 'Snake', 'fa-staff-snake'], ['hawk', 'Hawk', 'fa-feather'],
  ['crow', 'Crow', 'fa-crow'], ['duck', 'Duck', 'fa-water'], ['heron', 'Heron', 'fa-feather-pointed'], ['gull', 'Gull', 'fa-kiwi-bird'], ['frog', 'Frog', 'fa-frog'],
  ['pigeon', 'Pigeon', 'fa-dove'], ['hen', 'Hen', 'fa-egg'], ['dog', 'Dog', 'fa-bone'],
  ['cow', 'Cow', 'fa-cow'], ['goat', 'Goat', 'fa-mountain'], ['sheep', 'Sheep', 'fa-cloud'], ['pig', 'Pig', 'fa-piggy-bank'], ['horse', 'Horse', 'fa-horse']]);
export const MOST_PLACED = 40;
const PLACEABLE_IDS = new Set(PLACEABLE.map(([id]) => id));

// The scene flags a preset writes (pure): every outdoor kind at one amount; dark places are left alone, as those belong to underground scenes, and wolves, who come only when asked for.
export function animalPreset(amount = '') {
  const out = {};
  for (const [group, kinds] of ANIMAL_GROUPS) if (group !== 'Dark places') for (const [kind] of kinds) if (!ASKED_FOR.has(kind)) out[kind] = amount;
  return out;
}
// How high a map's birds fly as a share of the usual (pure), from its slider's percent: unset, as usual.
export const BIRD_HEIGHT = Object.freeze({ min: 25, max: 300, step: 5 });
export const birdHeightOf = (percent) => { const n = Number(percent); return percent === null || percent === undefined || percent === '' || !Number.isFinite(n) ? 1 : Math.min(BIRD_HEIGHT.max, Math.max(BIRD_HEIGHT.min, n)) / 100; };
// How big a bird looks at that height (pure): seen from above, a higher one is nearer the eye. About a third bigger at the top of the slider, a little smaller at the bottom. (Its shadow: soft-shadow.mjs.)
export const birdBodyOf = (percent) => 1 + 0.15 * (birdHeightOf(percent) - 1);
// The list as saved, tidied (pure): only what can be placed, with numbers for where it stands.
export function placedList(raw) {
  if (!Array.isArray(raw)) return [];
  // (An order given from the animal's HUD stays with it: animal-orders.mjs.)
  return raw.filter((p) => PLACEABLE_IDS.has(p?.kind) && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && p.id).map((p) => { const order = normalizeOrder(p.order); return { id: String(p.id), kind: p.kind, x: Number(p.x), y: Number(p.y), ...(order ? { order } : {}) }; }).slice(-MOST_PLACED);
}
// The list with one animal's order set, or cleared with null (pure).
export const withOrder = (raw, id, order) => placedList(raw).map((p) => { if (p.id !== id) return p; const { order: _old, ...rest } = p; const o = normalizeOrder(order); return o ? { ...rest, order: o } : rest; });
// The list without one animal (pure).
export const withoutId = (raw, id) => placedList(raw).filter((p) => p.id !== id);
// One more on the list (pure). The oldest goes past the most a scene keeps.
export const withPlaced = (raw, animal) => placedList([...placedList(raw), animal]);
// The list without its latest of a kind, or without that kind altogether (pure).
export function withoutPlaced(raw, kind, { all = false } = {}) {
  const list = placedList(raw);
  if (all) return list.filter((p) => p.kind !== kind);
  const last = list.map((p) => p.kind).lastIndexOf(kind);
  return last < 0 ? list : list.filter((_, i) => i !== last);
}
// What a screen has to do to match the list (pure): `shown` the ids it has added.
export function placedChanges(shown, raw) {
  const list = placedList(raw), ids = new Set(list.map((p) => p.id));
  return { add: list.filter((p) => !shown.has(p.id)), remove: [...shown].filter((id) => !ids.has(id)) };
}

const chip = (action, data, label, { active = false, tip = '', icon = '' } = {}) => `<button type="button" class="${active ? 'is-active' : ''}" data-action="${action}" ${data} aria-pressed="${active}"${tip ? ` data-tooltip="${esc(tip)}"` : ''}>${icon ? `<i class="fa-solid ${icon}" inert></i>` : ''}<span>${esc(label)}</span></button>`;
const sizeSlider = (key, label, value) => { const percent = sizePercent(value); return `<label class="animater-an-size"><input type="range" data-size-key="${key}" min="${SIZE_RANGE.min}" max="${SIZE_RANGE.max}" step="${SIZE_RANGE.step}" value="${percent}" aria-label="${esc(label)}"><output class="${percent === 100 ? '' : 'is-changed'}">${percent}%</output></label>`; };
const birdHeightSlider = (value) => { const percent = Math.round(birdHeightOf(value) * 100); return `<label class="animater-an-size"><input type="range" data-size-key="birdHeight" min="${BIRD_HEIGHT.min}" max="${BIRD_HEIGHT.max}" step="${BIRD_HEIGHT.step}" value="${percent}" aria-label="Bird height"><output class="${percent === 100 ? '' : 'is-changed'}">${percent}%</output></label>`; };
// A kind's row: how many, counted. A number set is that many; left alone (Auto) it shows how many the scene has of it now,
// worked out from the map as before; the town's, the farm's and wolves start at none, hawks at one. − and + set the number.
// Beside it, how many more of the kind live in regions of their own (a region's Animals): the scene's number is only the scene's.
const regionNote = (n) => (n > 0 ? `+${n} in regions` : '');
const animalRow = (kind, label, flags, live = {}, regions = {}) => {
  const raw = flags[kind] ?? '', exact0 = exactCountOf(raw), exact = kind === 'hawks' && exact0 !== null ? Math.min(MOST_HAWKS, exact0) : exact0, auto = exact === null && !ASKED_FOR.has(kind);
  const shown = exact ?? (ASKED_FOR.has(kind) ? 0 : Math.max(0, Math.round(Number(live[kind]) || 0)));
  const most = kind === 'hawks' ? MOST_HAWKS : MOST_COUNT;
  const step = (to, icon, tip) => `<button type="button" class="animater-an-step" data-action="setAnimal" data-key="${kind}" data-value="${Math.max(0, Math.min(most, to))}" data-tooltip="${esc(tip)}"${to < 0 || to > most ? ' disabled' : ''} aria-label="${esc(`${label}: ${tip}`)}"><i class="fa-solid ${icon}" inert></i></button>`;
  const counter = `<div class="animater-an-count">${step(shown - 1, 'fa-minus', 'One fewer')}<output class="${auto ? 'is-auto' : ''}">${shown}</output>${step(shown + 1, 'fa-plus', 'One more')}${auto || ASKED_FOR.has(kind) ? '' : chip('setAnimal', `data-key="${kind}" data-value=""`, 'Auto', { tip: 'As many as the map suits, as before' })}</div>`;
  const more = Math.max(0, Math.round(Number(regions[kind]) || 0));
  return `<div class="animater-an-row" data-kind="${kind}"><span>${esc(label)}<small class="animater-an-regions" data-region-count>${regionNote(more)}</small></span>${counter}${sizeSlider(`${kind}Size`, `${label}: size`, flags[`${kind}Size`])}</div>`;
};
// What the rows left on Auto show now (pure): { kind: how many }, from `live` as the panel's rows count them. A kind with
// a number set, or one that starts at none, keeps what it shows.
export function autoCounts(flags = {}, live = {}) {
  const out = {};
  for (const kind of Object.keys(live ?? {})) {
    if (exactCountOf(flags[kind] ?? '') !== null || ASKED_FOR.has(kind)) continue;
    out[kind] = Math.max(0, Math.round(Number(live[kind]) || 0));
  }
  return out;
}

// The whole map's count (pure): the scene's own and the regions' together, kinds left out of the panel too.
export const mapTotals = (live = {}, regions = {}) => { const sum = (o) => Object.values(o ?? {}).reduce((n, v) => n + Math.max(0, Math.round(Number(v) || 0)), 0), inRegions = sum(regions); return { all: sum(live) + inRegions, inRegions }; };
export const mapTotalText = ({ all, inRegions }) => `${all} on this map now${inRegions ? `, ${inRegions} of them in regions` : ''}`;
// The panel's content (pure). `flags` the scene's Animater flags; `count` how many are about on this screen; `note` why none would show; `aiming` the kind being placed; `underground` whether the scene is one: only its dark places are offered there, nothing wild living underground, and they only there; `water` whether the map has any, for what lives on it.
export function animalsPanelHtml({ flags = {}, count = 0, note = '', aiming = '', underground = false, water = true, scope = null, live = {}, regions = {} } = {}) {
  const on = flags.outdoorLife === 'on', placed = placedList(flags.placedAnimals);
  const place = PLACEABLE.map(([id, label, icon]) => {
    const n = placed.filter((p) => p.kind === id).length;
    return `<div class="animater-an-place">${chip('placeAnimal', `data-kind="${id}"`, label, { active: aiming === id, icon, tip: `Click the map to put one down. Escape or right click to stop.` })}<output>${n}</output><button type="button" class="animater-wx-off" data-action="removeAnimal" data-kind="${id}" data-tooltip="Take away the last one"${n ? '' : ' disabled'} aria-label="Take away the last ${esc(label)}"><i class="fa-solid fa-minus" inert></i></button></div>`;
  }).join('');
  return `<div class="animater-wx animater-animals">
    ${note ? `<p class="animater-wx-note"><i class="fa-solid fa-triangle-exclamation" inert></i> ${esc(note)}</p>` : ''}
    ${scopeBar(scope)}
    <p class="animater-an-total"><i class="fa-solid fa-paw" inert></i> <span data-map-total>${esc(mapTotalText(mapTotals(live, regions)))}</span></p>
    ${underground ? '' : `<section class="animater-wx-section"><div class="animater-an-top"><span><strong>Outdoor life on this scene</strong><small${on ? ' data-animals-about' : ''}>${on ? `${count} about on your screen` : 'Off: only placed by you once it is on'}</small></span><div class="animater-wx-chips">${chip('setLife', 'data-value=""', 'Off', { active: !on })}${chip('setLife', 'data-value="on"', 'On', { active: on })}</div></div>
      <div class="animater-wx-chips animater-an-presets">${chip('presetAnimals', 'data-value="few"', 'Quiet', { tip: 'A few of everything outdoors.' })}${chip('presetAnimals', 'data-value=""', 'Usual', { tip: 'The usual number of everything outdoors.' })}${chip('presetAnimals', 'data-value="many"', 'Lively', { tip: 'Many of everything outdoors.' })}${chip('reshuffleAnimals', '', 'Reshuffle', { icon: 'fa-rotate', tip: 'Scatter them afresh, on your screen. Each screen scatters its own.' })}</div>
    </section>
    <section class="animater-wx-section"><h3>Place by hand</h3><div class="animater-an-places">${place}</div><p class="animater-an-hint">Kept with the scene, and they start there on every screen. Then each wanders, on each screen, its own way.</p></section>`}
    <section class="animater-wx-section"><div class="animater-an-all"><span><strong>All animals on this map</strong><small>For a map drawn at a different scale. Multiplies each size below.</small></span>${sizeSlider('animalScale', 'All animals on this map: size', flags.animalScale)}</div>${underground ? '' : `<div class="animater-an-all"><span><strong>Bird height</strong><small>How high birds fly over this map. Higher, they look bigger, and their shadows land further off, wider, softer and fainter.</small></span>${birdHeightSlider(flags.birdHeight)}</div>`}</section>
    ${ANIMAL_GROUPS.filter(([group]) => (group === 'Dark places' ? underground : !underground && (group !== 'Water' || water))).map(([group, kinds]) => `<section class="animater-wx-section"><h3>${esc(group)}</h3>${kinds.map(([kind, label]) => animalRow(kind, label, flags, live, regions)).join('')}</section>`).join('')}
    <footer class="animater-wx-foot"><span>Kept with the scene, for everyone. To keep them out of an area, use that region's Keep out.</span></footer>
  </div>`;
}

// `flags()` the scene's Animater flags; `save(changes)` saves those flags, for everyone; `count()`, `note()`, `underground()` and `water()` as above; `aim(kind, onPlace)` starts placing, `stopAim()` ends it; `reshuffle()` scatters afresh on this screen.
export function animalsPanel(ApplicationV2, { id, flags, save, count = () => 0, note = () => '', aim = () => {}, stopAim = () => {}, reshuffle = () => {}, underground = () => false, water = () => true, scope = () => null, scopeTo = () => {}, clearLevel = async () => {}, live = () => ({}), regionLive = () => ({}) }) {
  return class AnimalsPanel extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-animals`, classes: ['animater-weather-panel', 'animater-animals-panel'],
      window: { title: 'Animals', icon: 'fa-solid fa-paw', resizable: true }, position: { width: 500, height: 'auto' },
      actions: {
        setAnimal(_event, target) { void save({ [target.dataset.key]: target.dataset.value }).then(() => this.render()); },
        setLife(_event, target) { void save({ outdoorLife: target.dataset.value }).then(() => this.render()); },
        presetAnimals(_event, target) { void save(animalPreset(target.dataset.value)).then(() => this.render()); },
        reshuffleAnimals() { reshuffle(); },
        setScope(_event, target) { scopeTo(target.dataset.value); void this.render(); },
        clearLevel() { void clearLevel().then(() => this.render()); },
        placeAnimal(_event, target) {
          const kind = target.dataset.kind;
          if (this.aiming === kind) { this.aiming = ''; stopAim(); void this.render(); return; }
          this.aiming = kind;
          aim(kind, () => { this.aiming = ''; if (this.rendered) void this.render(); });
          void this.render();
        },
        removeAnimal(_event, target) { void save({ placedAnimals: withoutPlaced(flags().placedAnimals, target.dataset.kind) }).then(() => this.render()); },
      },
    };
    async _renderHTML() { return animalsPanelHtml({ flags: flags(), count: count(), note: note(), aiming: this.aiming ?? '', underground: underground(), water: water(), scope: scope(), live: live(), regions: regionLive() }); }
    _replaceHTML(html, content) { const top = content.scrollTop; content.innerHTML = html; content.scrollTop = top; }
    // A slider says its size as it moves, and saves when let go: saving scatters the animals afresh.
    // While open, the Auto rows and the count above follow the animals as they come and go (fish swim off, a rabbit is
    // taken), every two seconds; only those numbers change, so a slider being moved is left alone.
    _refreshCounts() {
      if (!this.rendered || !this.element) return;
      try {
        const counts = autoCounts(flags(), live());
        for (const [kind, n] of Object.entries(counts)) {
          const row = this.element.querySelector(`.animater-an-row[data-kind="${kind}"]`), shown = row?.querySelector('output.is-auto');
          if (!shown || shown.textContent === String(n)) continue;
          shown.textContent = String(n);
          for (const button of row.querySelectorAll('button.animater-an-step')) {
            const to = button.querySelector('.fa-minus') ? n - 1 : n + 1, most = kind === 'hawks' ? MOST_HAWKS : MOST_COUNT;
            button.dataset.value = String(Math.max(0, Math.min(most, to))); button.disabled = to < 0 || to > most;
          }
        }
        const about = this.element.querySelector('[data-animals-about]'); if (about) about.textContent = `${count()} about on your screen`;
        // The regions' own beside each kind, and the whole map's count.
        const regions = regionLive();
        for (const row of this.element.querySelectorAll('.animater-an-row[data-kind]')) { const note = row.querySelector('[data-region-count]'); if (note) note.textContent = regionNote(Math.max(0, Math.round(Number(regions[row.dataset.kind]) || 0))); }
        const total = this.element.querySelector('[data-map-total]'); if (total) total.textContent = mapTotalText(mapTotals(live(), regions));
      } catch { /* next time */ }
    }
    _onRender() { clearInterval(this._countsTimer); this._countsTimer = setInterval(() => this._refreshCounts(), 2000); for (const input of this.element.querySelectorAll('input[data-size-key]')) { const shown = input.parentElement.querySelector('output'); input.addEventListener('input', () => { shown.textContent = `${input.value}%`; shown.classList.toggle('is-changed', input.value !== '100'); }); input.addEventListener('change', () => { void save({ [input.dataset.sizeKey]: Number(input.value) }).then(() => this.render()); }); } }
    async close(options) { clearInterval(this._countsTimer); this._countsTimer = null; this.aiming = ''; stopAim(); return super.close(options); }
  };
}

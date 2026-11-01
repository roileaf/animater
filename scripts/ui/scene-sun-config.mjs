// The sun for creatures' shadows, set on a picture instead of lists: in Scene configuration → Environment → Animater
// sun for one scene, and in Animater settings → Sun for the world's default. Buttons pick how the sun behaves (the
// world default, scenes only; the time of day; fixed; none). A dial shows the
// map from above with a creature and its shadow: for a fixed sun, drag the sun round the dial (nearer the middle is
// higher in the sky); following the time of day, drag the dial to set where east lies on this map, and scrub the day
// ruler under it to see the sun at any hour (only here: the game's clock is not changed). Its values go in hidden
// fields, so the form saves them: <prefix>.{mode, from, height, east, strength} (flags.<id>.sun for a scene).
import { sunFromClock, directionOf, heightOf, COMPASS, DEFAULT_SUN, DEFAULT_SUN_SETTING } from '../engines/motion/sun.mjs';

const C = 110, R = 88, TOKEN = 15;
const rad = (deg) => (deg * Math.PI) / 180;
const at = (deg, r) => [C + Math.cos(rad(deg)) * r, C + Math.sin(rad(deg)) * r];
// Height in degrees to distance from the dial's middle (overhead in the middle, on the horizon at the rim), and back.
const radiusOf = (height) => R * (1 - (Math.min(89, Math.max(3, height)) - 3) / 86);
const heightAt = (r) => Math.round(3 + (1 - Math.min(R, Math.max(0, r)) / R) * 86);
const NAMES = [['east', 0], ['south-east', 45], ['south', 90], ['south-west', 135], ['west', 180], ['north-west', -135], ['north', -90], ['north-east', -45]];
const nameOf = (deg) => {
  const d = ((deg % 360) + 540) % 360 - 180;
  return NAMES.reduce((best, n) => (Math.abs(((d - n[1] + 540) % 360) - 180) < Math.abs(((d - best[1] + 540) % 360) - 180) ? n : best))[0];
};
const clockText = (day) => { const m = Math.round(((day % 1) + 1) % 1 * 1440); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// The fieldset for `flags` (a scene's sun flags, or the world default), `defaults` the world's default sun (shown,
// not edited, while a scene keeps "World default"; `null`: this is the world default itself, with no such button),
// `clock` the time now ({ day, sunrise, sunset } or null), `prefix` the field names' start (`flags.<id>.sun` from
// `id` when not given), `legend` its title.
export function sunConfigElement({ flags = {}, defaults = DEFAULT_SUN_SETTING, clock = null, id = 'animater', prefix = `flags.${id}.sun`, legend = 'Animater sun' } = {}) {
  const scene = defaults !== null, world = { ...DEFAULT_SUN_SETTING, ...(defaults ?? {}) };
  const state = {
    mode: flags.mode ?? (scene ? '' : 'fixed'),
    from: directionOf(flags.from, DEFAULT_SUN.angle),
    height: heightOf(flags.height, DEFAULT_SUN.height),
    east: directionOf(flags.east, COMPASS.e),
    strength: Number.isFinite(Number(flags.strength)) && flags.strength !== '' && flags.strength !== undefined ? Number(flags.strength) : 1,
  };
  const day = clock ?? { day: 0.5, sunrise: 0.25, sunset: 0.75 };
  let preview = day.day;
  const el = document.createElement('fieldset');
  el.className = 'animater-sun';
  const field = (name, value) => `<input type="hidden" name="${prefix}.${name}" value="${value}">`;
  const worldName = { time: 'time of day', fixed: 'fixed', none: 'no sun' }[world.mode] ?? 'fixed';
  const modes = [...(scene ? [['', `World default (${worldName})`]] : []), ['time', 'Time of day'], ['fixed', 'Fixed'], ['none', 'No sun']];
  el.innerHTML = `<legend>${legend}</legend>
    ${field('mode', state.mode)}${field('from', state.from)}${field('height', state.height)}${field('east', state.east)}
    <div class="an-sun-modes" role="radiogroup" aria-label="Sun">${modes.map(([v, l]) => `<button type="button" role="radio" data-mode="${v}">${l}</button>`).join('')}</div>
    <div class="an-sun-main">
      <svg class="an-sun-dial" viewBox="0 0 220 220" aria-label="The map from above: drag the sun">
        <defs>
          <radialGradient id="an-sun-sky" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f6e7b8" stop-opacity="0.35"/><stop offset="100%" stop-color="#1c2a44" stop-opacity="0.55"/></radialGradient>
          <radialGradient id="an-sun-glow"><stop offset="0%" stop-color="#fff6c8"/><stop offset="55%" stop-color="#ffc341"/><stop offset="100%" stop-color="#ff9a1f" stop-opacity="0"/></radialGradient>
        </defs>
        <circle cx="${C}" cy="${C}" r="${R}" fill="url(#an-sun-sky)" class="an-sun-ring"/>
        <circle cx="${C}" cy="${C}" r="${R * 0.5}" class="an-sun-guide"/>
        ${[['N', -90], ['E', 0], ['S', 90], ['W', 180]].map(([l, a]) => { const [x, y] = at(a, R + 12); return `<text x="${x}" y="${y}" class="an-sun-compass">${l}</text>`; }).join('')}
        <polyline class="an-sun-path" points=""/>
        <g class="an-sun-east"><circle r="9"/><text>E</text></g>
        <line class="an-sun-shadow" x1="${C}" y1="${C}" x2="${C}" y2="${C}"/>
        <circle class="an-sun-token" cx="${C}" cy="${C}" r="${TOKEN}"/>
        <g class="an-sun-sun"><circle r="17" fill="url(#an-sun-glow)"/><circle r="7" class="an-sun-core"/></g>
      </svg>
      <div class="an-sun-side">
        <p class="an-sun-readout"></p>
        <label class="an-sun-strength"><span>Shadow strength</span>
          <span class="an-sun-range"><i class="fa-solid fa-cloud" aria-hidden="true"></i><input type="range" name="${prefix}.strength" min="0" max="1" step="0.05" value="${state.strength}"><i class="fa-solid fa-sun" aria-hidden="true"></i><output></output></span>
        </label>
        <p class="hint an-sun-hint"></p>
      </div>
    </div>
    <div class="an-sun-day">
      <div class="an-sun-ruler" aria-label="Preview the time of day">
        <span class="an-sun-mark an-sun-rise"></span><span class="an-sun-mark an-sun-set"></span>
        <span class="an-sun-now" title="Now"></span><span class="an-sun-scrub"></span>
      </div>
      <div class="an-sun-hours">${[0, 6, 12, 18, 24].map((h) => `<span style="left:${(h / 24) * 100}%">${String(h).padStart(2, '0')}:00</span>`).join('')}</div>
    </div>`;
  const $ = (s) => el.querySelector(s), input = (n) => el.querySelector(`[name="${prefix}.${n}"]`);
  const svg = $('.an-sun-dial'), range = $('input[type="range"]');
  // The ruler's sky: night, dawn at sunrise, day, dusk at sunset, night.
  const pct = (f) => `${(f * 100).toFixed(2)}%`, rise = day.sunrise, set = day.sunset, edge = Math.min(0.04, (set - rise) / 6);
  $('.an-sun-ruler').style.background = `linear-gradient(90deg, #101a33 0%, #101a33 ${pct(rise - edge)}, #e8925a ${pct(rise)}, #9fd0ff ${pct(rise + edge * 2)}, #9fd0ff ${pct(set - edge * 2)}, #e87a4a ${pct(set)}, #101a33 ${pct(set + edge)}, #101a33 100%)`;
  $('.an-sun-rise').style.left = pct(rise); $('.an-sun-rise').title = `Sunrise ${clockText(rise)}`;
  $('.an-sun-set').style.left = pct(set); $('.an-sun-set').title = `Sunset ${clockText(set)}`;
  $('.an-sun-now').style.left = pct(day.day);

  const inherits = () => scene && !state.mode;
  // What is drawn: the scene's own sun, or (on "World default") the world's, shown but not editable here.
  const shown = () => (inherits() ? { mode: world.mode || 'fixed', from: directionOf(world.from, DEFAULT_SUN.angle), height: heightOf(world.height, DEFAULT_SUN.height), east: directionOf(world.east, COMPASS.e), strength: Number(world.strength ?? 1) } : state);
  const mode = () => shown().mode || 'fixed';
  const draw = () => {
    const m = mode(), v = shown();
    el.dataset.mode = m;
    el.classList.toggle('an-sun-inherits', inherits());
    range.disabled = inherits();
    if (inherits()) range.value = String(v.strength);
    el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    input('mode').value = state.mode; input('from').value = Math.round(state.from); input('height').value = Math.round(state.height); input('east').value = Math.round(state.east);
    $('output').textContent = `${Math.round(v.strength * 100)}%`;
    let sun = null;
    if (m === 'fixed') sun = { angle: v.from, height: v.height };
    if (m === 'time') sun = sunFromClock({ day: preview, sunrise: rise, sunset: set, east: v.east });
    // The sun on the dial, and the creature's shadow cast away from it (longer the lower it stands).
    const sunG = $('.an-sun-sun'), shadow = $('.an-sun-shadow');
    if (sun && m !== 'none') {
      const [x, y] = at(sun.angle, radiusOf(sun.height));
      sunG.setAttribute('transform', `translate(${x} ${y})`); sunG.style.display = '';
      const len = Math.min(R * 0.85, (TOKEN * 1.2) / Math.tan(rad(Math.max(3, sun.height)))), [sx, sy] = at(sun.angle + 180, len);
      shadow.setAttribute('x2', sx); shadow.setAttribute('y2', sy);
      shadow.style.opacity = String(0.15 + 0.45 * v.strength * (m === 'time' ? Math.min(1, sun.height / 8) : 1));
    } else { sunG.style.display = 'none'; shadow.setAttribute('x2', C); shadow.setAttribute('y2', C); }
    // Following the day: the sun's path across the sky, and the map's east marker to drag.
    const path = [];
    if (m === 'time') for (let i = 0; i <= 24; i++) { const t = i / 24; path.push(at(v.east + 180 * t, radiusOf(60 * Math.sin(Math.PI * t))).map((v) => v.toFixed(1)).join(',')); }
    $('.an-sun-path').setAttribute('points', path.join(' '));
    const [ex, ey] = at(v.east, R);
    $('.an-sun-east').setAttribute('transform', `translate(${ex} ${ey})`);
    $('.an-sun-scrub').style.left = pct(preview);
    $('.an-sun-scrub').title = clockText(preview);
    const readout = $('.an-sun-readout'), hint = $('.an-sun-hint');
    const times = `Sunrise ${clockText(rise)}, sunset ${clockText(set)}${clock ? '' : ' (no clock: 06:00 to 18:00)'}.`;
    if (m === 'none') { readout.textContent = 'No sun: only lights cast shadows here.'; hint.textContent = 'For caves, dungeons and overcast scenes.'; }
    else if (m === 'fixed') {
      readout.textContent = `Shines from the ${nameOf(v.from)}, ${Math.round(v.height)}° up: shadows ${v.height >= 60 ? 'short' : v.height >= 30 ? 'medium' : 'long'}.`;
      hint.textContent = 'Drag the sun: round the dial for its direction, toward the middle for a higher sun.';
    } else {
      readout.textContent = sun ? `${clockText(preview)}: the sun in the ${nameOf(sun.angle)}, ${Math.round(sun.height)}° up.` : `${clockText(preview)}: night, no sunlight shadows.`;
      hint.textContent = `Drag the dial to turn the map's east (the sun rises there, crosses the south at noon, sets in the west). Scrub the day to preview an hour; the game's clock stays as it is. ${times}`;
    }
    if (inherits()) hint.textContent = `This scene uses the world default (Animater settings → Sun); pick a button to give it its own.${m === 'time' ? ` ${times}` : ''}`;
  };

  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; draw(); }));
  range.addEventListener('input', () => { state.strength = Number(range.value); draw(); });
  // Dragging on the dial: the sun (fixed) or the map's east (time of day).
  const point = (event) => {
    const box = svg.getBoundingClientRect(), x = ((event.clientX - box.left) / box.width) * 220 - C, y = ((event.clientY - box.top) / box.height) * 220 - C;
    return { angle: (Math.atan2(y, x) * 180) / Math.PI, r: Math.hypot(x, y) };
  };
  const drag = (event) => {
    const p = point(event), m = mode();
    if (inherits()) return;
    if (m === 'fixed') { state.from = Math.round(p.angle); state.height = heightAt(p.r); }
    else if (m === 'time') state.east = Math.round(p.angle / 5) * 5;
    else return;
    draw();
  };
  svg.addEventListener('pointerdown', (event) => { if (mode() === 'none' || inherits()) return; svg.setPointerCapture(event.pointerId); drag(event); });
  svg.addEventListener('pointermove', (event) => { if (svg.hasPointerCapture(event.pointerId)) drag(event); });
  // Scrubbing the day ruler: a preview only.
  const ruler = $('.an-sun-ruler');
  const scrub = (event) => { const box = ruler.getBoundingClientRect(); preview = Math.min(0.9999, Math.max(0, (event.clientX - box.left) / box.width)); draw(); };
  ruler.addEventListener('pointerdown', (event) => { ruler.setPointerCapture(event.pointerId); scrub(event); });
  ruler.addEventListener('pointermove', (event) => { if (ruler.hasPointerCapture(event.pointerId)) scrub(event); });
  draw();
  return el;
}

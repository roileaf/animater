import { GAITS, BODIES } from '../engines/motion/creature-gait.mjs';
import { FLOORS } from '../engines/motion/movement-feel.mjs';
import { movementSoundMix, resolveMovementSound } from '../engines/motion/movement-profile.mjs';

const LABELS = { boots: 'Boots / shoes', paws: 'Paws', padded: 'Padded feet (elephant)', webbed: 'Webbed feet (frog)',
  talons: 'Bird talons', dragon: 'Dragon tread', hooves: 'Hooves', claws: 'Reptile claws', slither: 'Slither',
  ooze: 'Ooze', legs: 'Many legs', unknown: 'Ordinary fallback', none: 'None',
  bone: 'Bone', metal: 'Metal', stone: 'Stone', plant: 'Woody plant', foliage: 'Leaves / foliage', water: 'Water', fire: 'Fire', air: 'Air',
  wing: 'Wingbeats', flight: 'Wingless air movement' };
const label = (key) => LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
const choices = (keys, value, first) => [["", first], ...keys.map((k) => [k, label(k)])]
  .map(([k, text]) => `<option value="${k}"${k === value ? ' selected' : ''}>${text}</option>`).join('');
export function movementSoundsForm(raw = {}) {
  const v = movementSoundMix(raw), prefix = 'flags.animater.movementSound.';
  const select = (key, title, keys) => `<div class="form-group"><label>${title}</label><div class="form-fields"><select aria-label="${title}" name="${prefix}${key}">${choices(keys, v[key], 'Automatic')}</select></div></div>`;
  const number = (key, title, min = 0) => `<div class="form-group"><label>${title}</label><div class="form-fields"><input type="number" aria-label="${title}" name="${prefix}${key}" data-dtype="Number" min="${min}" max="2" step="0.05" value="${v[key]}"></div></div>`;
  return `<details class="animater-movement-sounds"><summary>Animater movement sounds</summary><fieldset><legend>Creature and mix</legend>
    <div class="form-group"><label>Silent movement</label><div class="form-fields"><input type="checkbox" aria-label="Silent movement" name="${prefix}silent" data-dtype="Boolean"${v.silent ? ' checked' : ''}></div><p class="hint">Disables movement audio and tremor. Footprint choices remain separate.</p></div>
    ${select('gait', 'Feet / gait', GAITS)}${select('body', 'Body texture', [...BODIES, 'none'])}${select('flight', 'Flight sound', ['wing', 'flight'])}
    ${number('contact', 'Contact / body volume')}${number('pitch', 'Contact pitch', 0.5)}${number('weight', 'Weight / bass volume')}${number('tremor', 'Camera tremor strength')}
    <p class="hint">1 = automatic level; 0 = off; 2 = twice the level. Contact, bass and tremor are independent. Camera settings and sneaking still apply.</p>
    <p class="hint" data-movement-summary></p><button type="button" data-movement-reset>Reset to automatic</button></fieldset>
    <fieldset><legend>Preview on this device</legend><div class="form-group"><label>Floor</label><div class="form-fields"><select aria-label="Preview floor" data-movement-floor>${FLOORS.map((f) => `<option value="${f}">${label(f)}</option>`).join('')}</select></div></div>
    <div class="form-group"><label>Movement</label><div class="form-fields"><select aria-label="Preview movement" data-movement-action><option value="walk">Walk</option><option value="fly">Fly</option><option value="land">Land</option></select></div></div>
    <div class="form-fields"><button type="button" data-movement-preview>Play four steps</button><button type="button" data-movement-stop>Stop</button></div>
    <p class="hint">Uses unsaved choices. Plays locally; moves no token. Save Token Configuration to apply changes.</p></fieldset></details>`;
}
export function mountMovementSounds(root, { document: doc, system, preview, floor = 'stone' } = {}) {
  const panel = root.querySelector('.animater-movement-sounds');
  if (!panel) return () => {};
  const read = () => movementSoundMix(Object.fromEntries([...panel.querySelectorAll('[name]')].map((el) =>
    [el.name.split('.').pop(), el.type === 'checkbox' ? el.checked : el.value])));
  const summary = () => {
    const p = resolveMovementSound({ system, actor: doc?.actor, name: doc?.name }, read());
    panel.querySelector('[data-movement-summary]').textContent = p.sound.silent ? 'Silent movement.'
      : `Resolved: ${label(p.gait)}; ${p.body ? label(p.body) : 'no body texture'}; ${label(p.flight)}.`;
  };
  panel.querySelector('[data-movement-floor]').value = FLOORS.includes(floor) ? floor : 'stone';
  const play = () => preview?.start({ raw: read(), floor: panel.querySelector('[data-movement-floor]').value, action: panel.querySelector('[data-movement-action]').value });
  const stop = () => preview?.stop();
  const reset = () => {
    stop();
    const defaults = movementSoundMix();
    for (const el of panel.querySelectorAll('[name]')) {
      const key = el.name.split('.').pop();
      if (el.type === 'checkbox') el.checked = false; else el.value = defaults[key];
    }
    summary();
  };
  panel.addEventListener('input', summary);
  panel.querySelector('[data-movement-preview]').addEventListener('click', play);
  panel.querySelector('[data-movement-stop]').addEventListener('click', stop);
  panel.querySelector('[data-movement-reset]').addEventListener('click', reset);
  summary();
  return () => {
    stop(); panel.removeEventListener('input', summary);
    panel.querySelector('[data-movement-preview]').removeEventListener('click', play);
    panel.querySelector('[data-movement-stop]').removeEventListener('click', stop);
    panel.querySelector('[data-movement-reset]').removeEventListener('click', reset);
  };
}

// Animater settings → Sun: the world's default sun for creatures' shadows (every scene left on "World default" uses
// it), set on the same dial as a scene's (scene-sun-config.mjs), and which calendar gives the time of day, sunrise and
// sunset. Built on Foundry's ApplicationV2; saves the `sunDefault` and `sunClock` world settings.
import { sunConfigElement } from './scene-sun-config.mjs';
import { CLOCKS, DEFAULT_SUN_SETTING } from '../engines/motion/sun.mjs';

export const SUN_SETTING = 'sunDefault';
export const CLOCK_SETTING = 'sunClock';

// The form's sun fields as the setting keeps them.
export function sunValues(o = {}) {
  const num = (v, fallback) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    mode: ['time', 'fixed', 'none'].includes(o.mode) ? o.mode : 'fixed',
    from: num(o.from, DEFAULT_SUN_SETTING.from), height: num(o.height, DEFAULT_SUN_SETTING.height),
    east: num(o.east, DEFAULT_SUN_SETTING.east), strength: Math.min(1, Math.max(0, num(o.strength, 1))),
  };
}

// The calendar choices, those not active marked so.
export const clockChoices = (active = () => false) => Object.entries(CLOCKS).map(([value, label]) => ({
  value, label: value === 'auto' ? 'Automatic (Calendaria, else Simple Calendar Reborn, else Foundry’s clock)' : value === 'foundry' || active(value) ? label : `${label} (not active: Foundry’s clock instead)`,
}));

export function sunSettingsMenu(ApplicationV2, { id, settings = () => globalThis.game.settings, clock = () => null, active = (m) => globalThis.game?.modules?.get(m)?.active === true, expand = (o) => globalThis.foundry.utils.expandObject(o) } = {}) {
  return class SunSettings extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-sun`, tag: 'form', classes: ['animater-sun-settings'],
      window: { title: 'Animater: sun', icon: 'fa-solid fa-sun' }, position: { width: 620 },
      form: {
        closeOnSubmit: true,
        handler: async (_event, _form, formData) => {
          const o = expand(formData?.object ?? {});
          await settings().set(id, SUN_SETTING, sunValues(o.sun));
          await settings().set(id, CLOCK_SETTING, Object.hasOwn(CLOCKS, o.clock) ? o.clock : 'auto');
        },
      },
    };
    async _renderHTML() {
      let saved = DEFAULT_SUN_SETTING, chosen = 'auto';
      try { saved = { ...DEFAULT_SUN_SETTING, ...(settings().get(id, SUN_SETTING) ?? {}) }; } catch { /* the default */ }
      try { chosen = settings().get(id, CLOCK_SETTING) || 'auto'; } catch { /* automatic */ }
      const wrap = document.createElement('div');
      wrap.className = 'an-sun-settings';
      const pick = document.createElement('div');
      pick.className = 'form-group an-sun-clock';
      pick.innerHTML = `<label>Time of day from</label><select name="clock">${clockChoices(active).map((c) => `<option value="${c.value}"${c.value === chosen ? ' selected' : ''}>${c.label}</option>`).join('')}</select>`;
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'Where the time of day, sunrise and sunset come from for a sun that follows the time of day. Foundry’s own clock has the sun up from 06:00 to 18:00.';
      const footer = document.createElement('footer');
      footer.className = 'form-footer';
      footer.innerHTML = '<button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button>';
      wrap.append(sunConfigElement({ flags: saved, defaults: null, clock: clock(), id, prefix: 'sun', legend: 'Default sun for every scene' }), pick, note, footer);
      return wrap;
    }
    _replaceHTML(result, content) { content.replaceChildren(result); }
  };
}

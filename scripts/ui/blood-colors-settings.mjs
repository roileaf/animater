// Blood colours (a settings menu, GM only): what each creature type bleeds when Splatter is not deciding, saved as
// the world setting "bloodColors" (only what differs from the defaults of engines/motion/blood-colors.mjs). A row per
// type: its colour, a No blood box and a reset; Save and Reset all below.
import { BLOOD_TYPES, DEFAULT_BLOOD, normalizeBloodTable, tableBlood } from '../engines/motion/blood-colors.mjs';

export const BLOOD_SETTING = 'bloodColors';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const on = (v) => v === true || v === 'on' || v === 'true';

// The editor's rows: each type's colour and whether it bleeds, saved over the defaults.
export function bloodEditorRows(saved) {
  const table = normalizeBloodTable(saved);
  return BLOOD_TYPES.map(({ key, label }) => {
    const now = tableBlood(key, table), base = DEFAULT_BLOOD[key];
    return { key, label, color: now.color, bleeds: now.bleeds, defaultColor: base.color, defaultBleeds: base.bleeds,
      changed: now.color !== base.color || now.bleeds !== base.bleeds };
  });
}

export function bloodColorsForm(rows, { splatterActive = false } = {}) {
  // One compact row per type: a colour swatch you click to change, the name, a No blood chip and a reset.
  const row = (r) => `<div class="an-blood-row${r.changed ? ' is-changed' : ''}" data-blood-type="${esc(r.key)}">
<input type="color" name="color-${esc(r.key)}" value="${esc(r.color)}" aria-label="${esc(r.label)} blood colour">
<span class="an-blood-name" title="${esc(r.label)}">${esc(r.label)}</span>
<label class="an-blood-none" data-tooltip="This creature type does not bleed"><input type="checkbox" name="none-${esc(r.key)}"${r.bleeds ? '' : ' checked'}><span>No blood</span></label>
<button type="button" class="an-blood-reset" data-action="resetType" data-type="${esc(r.key)}" data-tooltip="Back to ${esc(r.defaultBleeds ? r.defaultColor : 'no blood')}" aria-label="Reset ${esc(r.label)}"><i class="fa-solid fa-rotate-left"></i></button>
</div>`;
  const types = rows.filter((r) => r.key !== 'default'), fallback = rows.filter((r) => r.key === 'default');
  return `<div class="an-blood-note${splatterActive ? ' is-splatter' : ''}">${splatterActive ? '<strong>Splatter is active.</strong> Its Blood Sheet decides blood colours; these wait until it is off.' : 'With the Splatter module active, its Blood Sheet decides instead.'} Used for the damage lens, blood drops on the ground and the damage showcase. A token's own colour (Token configuration → Animater blood colour) comes before its type.</div>
<section class="an-blood-section"><h4>By creature type</h4><div class="an-blood-grid">${types.map(row).join('')}</div></section>
<section class="an-blood-section"><h4>Anything else</h4><div class="an-blood-grid">${fallback.map(row).join('')}</div></section>
<footer class="form-footer an-blood-footer"><button type="button" data-action="resetAll"><i class="fa-solid fa-rotate-left"></i> Reset all</button><button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button></footer>`;
}

// What the submitted form saves: per type, the colour and No blood where they differ from the defaults.
export function bloodColorsValues(data = {}) {
  const read = (field, key) => (Object.hasOwn(data, `${field}-${key}`) ? data[`${field}-${key}`] : data[field]?.[key]);
  const raw = {};
  for (const [key, base] of Object.entries(DEFAULT_BLOOD)) {
    // A type the form did not send is left at its default.
    if (read('color', key) === undefined && read('none', key) === undefined) continue;
    const entry = {}, color = String(read('color', key) ?? '').toLowerCase(), bleeds = !on(read('none', key));
    if (/^#[0-9a-f]{6}$/.test(color) && color !== base.color) entry.color = color;
    if (bleeds !== base.bleeds) entry.bleeds = bleeds;
    if (Object.keys(entry).length) raw[key] = entry;
  }
  return normalizeBloodTable(raw);
}

const resetRow = (root, key) => {
  const base = DEFAULT_BLOOD[key];
  if (!base || !root) return;
  const color = root.querySelector(`[name="color-${key}"]`), none = root.querySelector(`[name="none-${key}"]`);
  if (color) color.value = base.color;
  if (none) none.checked = !base.bleeds;
};

// The settings menu, built on Foundry's ApplicationV2.
export function bloodColorsMenu(ApplicationV2, { id, settings = () => globalThis.game.settings, splatterActive = () => globalThis.game?.modules?.get('splatter')?.active === true } = {}) {
  return class BloodColorsSettings extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-blood-colors`, tag: 'form', classes: ['animater-blood-colors'],
      window: { title: 'Animater: blood colours', icon: 'fa-solid fa-droplet' }, position: { width: 640 },
      form: { closeOnSubmit: true, handler: async (_event, _form, formData) => { await settings().set(id, BLOOD_SETTING, bloodColorsValues(formData?.object ?? {})); } },
      actions: {
        resetType(_event, target) { resetRow(this.element, target?.dataset?.type); },
        resetAll() { for (const key of Object.keys(DEFAULT_BLOOD)) resetRow(this.element, key); },
      },
    };
    async _renderHTML() {
      let saved = {};
      try { saved = settings().get(id, BLOOD_SETTING) ?? {}; } catch { saved = {}; }
      return bloodColorsForm(bloodEditorRows(saved), { splatterActive: splatterActive() });
    }
    _replaceHTML(html, content) { content.innerHTML = html; }
  };
}

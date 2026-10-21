// One place for the whole hit sounds engine: whether weapon hits sound like what they land on (the world, set by
// the GM), and how each player hears them on their own device (on or off, level, blood, echo, where they happen).
export const HIT_SOUND_FIELDS = [
  { key: "surfaceSounds", scope: "world", type: "boolean", name: "Weapon surface sounds",
    hint: "A weapon hit also sounds like what it lands on: metal armour, leather, flesh, a spider’s shell, stone, a magical ward. A miss against a raised or magical shield rings off it. Every system; uses the built-in weapon animations." },
  { key: "hitSounds", scope: "client", type: "boolean", name: "Hit sounds on this device",
    hint: "Turn off to hear no surface hits, and no pitch, echo or placement on Animater’s sounds, on this device only. Other players keep theirs." },
  { key: "surfaceVolume", scope: "client", type: "range", min: 0, max: 1, step: 0.05, name: "Volume",
    hint: "How loud surface hits are for you: what a blow lands on, blood, ice, shards." },
  { key: "surfaceGore", scope: "client", type: "select", choices: { full: "Full", subtle: "Subtle", off: "Off" }, name: "Blood",
    hint: "The splatter of blood on hits to flesh. Subtle keeps it faint; Off removes it for you only." },
  { key: "surfaceEcho", scope: "client", type: "range", min: 0, max: 1.5, step: 0.1, name: "Echo",
    hint: "How much room the hits ring in: 0 for a dry sound, higher for a bigger space. A scene’s own acoustics (Scene configuration) come on top." },
  { key: "surfaceSpace", scope: "client", type: "boolean", name: "Hear hits where they happen",
    hint: "Sounds come from where they happen: further from your token is quieter and duller, and a hit on the left of your screen sounds on the left. Without a token, from the middle of your view." },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// The form: the GM's world switch first (players do not see it), then this device's mix.
export function hitSoundsForm(values, { isGM = false } = {}) {
  const field = (f) => {
    const v = values[f.key], name = esc(f.key);
    const input = f.type === "boolean" ? `<input type="checkbox" name="${name}"${v ? " checked" : ""}>`
      : f.type === "select" ? `<select name="${name}">${Object.entries(f.choices).map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<range-picker name="${name}" value="${esc(v)}" min="${f.min}" max="${f.max}" step="${f.step}"></range-picker>`;
    return `<div class="form-group"><label>${esc(f.name)}</label><div class="form-fields">${input}</div><p class="hint">${esc(f.hint)}</p></div>`;
  };
  const world = HIT_SOUND_FIELDS.filter((f) => f.scope === "world"), device = HIT_SOUND_FIELDS.filter((f) => f.scope === "client");
  return `${isGM ? `<fieldset><legend>For everyone (this world)</legend>${world.map(field).join("")}</fieldset>` : ""}
<fieldset><legend>This device</legend>${device.map(field).join("")}</fieldset>
<footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button></footer>`;
}
// What the submitted form sets: unchecked boxes are off, numbers stay in range, a choice must be one offered.
export function hitSoundsValues(data, { isGM = false } = {}) {
  const out = {};
  for (const f of HIT_SOUND_FIELDS) {
    if (f.scope === "world" && !isGM) continue;
    const v = data[f.key];
    if (f.type === "boolean") out[f.key] = v === true || v === "on" || v === "true";
    else if (f.type === "range") { const n = Number(v); if (Number.isFinite(n)) out[f.key] = Math.min(f.max, Math.max(f.min, n)); }
    else if (f.type === "select" && Object.hasOwn(f.choices, v)) out[f.key] = v;
  }
  return out;
}
// The settings menu, built on Foundry's ApplicationV2.
export function hitSoundsMenu(ApplicationV2, { id, settings = () => globalThis.game.settings, isGM = () => globalThis.game.user?.isGM === true } = {}) {
  return class HitSoundsSettings extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-hit-sounds`, tag: "form", classes: ["animater-hit-sounds"],
      window: { title: "Animater: hit sounds", icon: "fa-solid fa-volume-high" }, position: { width: 520 },
      form: { closeOnSubmit: true, handler: async (_event, _form, formData) => {
        for (const [key, value] of Object.entries(hitSoundsValues(formData.object, { isGM: isGM() }))) await settings().set(id, key, value);
      } },
    };
    async _renderHTML() {
      return hitSoundsForm(Object.fromEntries(HIT_SOUND_FIELDS.map((f) => [f.key, settings().get(id, f.key)])), { isGM: isGM() });
    }
    _replaceHTML(html, content) { content.innerHTML = html; }
  };
}

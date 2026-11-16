// The Moments dashboard: what it looks like, written once and apart from the shell that drives it.
//
// It is a console rather than a list of switches, because fourteen-odd effects as a column of labels is a wall. So:
// a readout at the top saying what is running and where (the thing that stops a GM leaving Grey on for ten
// minutes), the moments grouped by what they take hold of, and a drawn glyph on each so it is read at a glance.
//
// Pure: this builds a string. No Foundry, no document, no listeners — main.mjs hangs those on it.

// A glyph for each moment. Small, single-stroke, and about what the moment does rather than what it is called.
export const MOMENT_GLYPHS = Object.freeze({
  shake: '<path d="M3 12h3l2-6 3 12 3-9 2 3h5"/>',
  rumble: '<path d="M2 9h20M2 15h20"/><path d="M6 6l2 3-2 3 2 3-2 3"/>',
  roll: '<path d="M3 16a9 9 0 0 1 18-4"/><path d="M21 7v5h-5"/>',
  blur: '<circle cx="12" cy="12" r="7" opacity=".35"/><circle cx="12" cy="12" r="4" opacity=".7"/><circle cx="12" cy="12" r="1.5"/>',
  grey: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" opacity=".6"/>',
  split: '<circle cx="9" cy="12" r="5" opacity=".7"/><circle cx="15" cy="12" r="5" opacity=".7"/>',
  smear: '<path d="M4 12h6" opacity=".35"/><path d="M8 12h6" opacity=".7"/><circle cx="18" cy="12" r="2.5"/>',
  pulse: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5" opacity=".55"/><circle cx="12" cy="12" r="10" opacity=".25"/>',
  vignette: '<rect x="3" y="5" width="18" height="14" rx="3"/><rect x="7" y="9" width="10" height="6" rx="2" opacity=".45"/>',
  grain: '<circle cx="6" cy="7" r=".9"/><circle cx="12" cy="5" r=".9"/><circle cx="18" cy="8" r=".9"/><circle cx="8" cy="13" r=".9"/><circle cx="15" cy="12" r=".9"/><circle cx="5" cy="18" r=".9"/><circle cx="12" cy="17" r=".9"/><circle cx="19" cy="16" r=".9"/>',
  streak: '<path d="M3 7h12M6 12h12M3 17h10"/>',
  glow: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M6.2 6.2l1.8 1.8M16 16l1.8 1.8M17.8 6.2L16 8M8 16l-1.8 1.8"/>',
  shock: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6" opacity=".6"/><circle cx="12" cy="12" r="10" opacity=".3"/>',
  dust: '<path d="M4 4h16" opacity=".5"/><circle cx="7" cy="10" r=".9"/><circle cx="13" cy="13" r=".9"/><circle cx="18" cy="9" r=".9"/><circle cx="10" cy="18" r=".9"/><circle cx="16" cy="17" r=".9"/>',
  sway: '<path d="M12 21V9"/><path d="M7 7a5 4 0 0 1 10 0"/><path d="M8 18q4 3 8 0" opacity=".6"/>',
  bob: '<path d="M3 14q3-3 6 0t6 0 6 0"/><path d="M3 19q3-3 6 0t6 0 6 0" opacity=".5"/><circle cx="12" cy="7" r="3"/>',
  tether: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M6.6 8q2.4 7 10.8 8" opacity=".85"/>',
});

// Grouped by what a moment takes hold of, which is also the order a GM reaches for them in.
export const MOMENT_GROUPS = Object.freeze([
  { name: "The map itself", keys: ["shake", "rumble", "roll", "blur", "grey", "split", "smear"] },
  { name: "Over the map", keys: ["pulse", "vignette", "grain", "streak"] },
  { name: "At a place", keys: ["glow", "shock", "dust"] },
  { name: "On what you picked", keys: ["sway", "bob", "tether"] },
]);

const safe = (text) => String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Each tile carries the modes it works in, so the panel can hide the rest when a mode is chosen rather than
// offering a button that only ever says no.
const tile = (kind, how) => `<button type="button" class="an-tile" data-an-moment="${safe(kind)}" data-an-wheres="${safe((how.wheres ?? []).join(" "))}" title="${safe(how.hint)}">
  <svg viewBox="0 0 24 24" aria-hidden="true">${MOMENT_GLYPHS[kind] ?? ""}</svg><span>${safe(how.name)}</span></button>`;

const segment = (name, options) => `<div class="an-seg" data-an-seg="${safe(name)}">${options
  .map(([value, label], i) => `<button type="button" data-an-${safe(name)}="${safe(value)}"${i ? "" : ' class="on"'}>${safe(label)}</button>`)
  .join("")}</div>`;

/**
 * The whole dashboard, as HTML. `moments` and `wheres` are the engine's own lists, so a moment added there appears
 * here without anyone remembering to add it; anything grouped nowhere falls into a last group rather than vanishing.
 */
export function momentsPanelHtml({ moments = {}, wheres = {}, styles = {}, presets = {}, sounds = {} } = {}) {
  const placed = new Set(MOMENT_GROUPS.flatMap((g) => g.keys));
  const groups = [...MOMENT_GROUPS.map((g) => ({ name: g.name, keys: g.keys.filter((k) => moments[k]) })),
    { name: "More", keys: Object.keys(moments).filter((k) => !placed.has(k)) }].filter((g) => g.keys.length);
  return `<header><span>Moments</span><button type="button" data-an-close title="Close">×</button></header>
  <div class="an-readout" data-an-readout>Nothing running.</div>
  <div class="an-row">${segment("where", Object.entries(wheres).map(([v, l]) => [v, v === "screen" ? "Screen" : v === "point" ? "A place" : "Picked"]).map(([v, l]) => [v, l]))}</div>
  ${groups.map((g) => `<section class="an-group" data-an-group><h2>${safe(g.name)}</h2><div class="an-tiles">${g.keys.map((k) => tile(k, moments[k])).join("")}</div></section>`).join("")}
  <div class="an-fields">
    <div class="an-field"><span>Strength</span><input type="range" data-an-strength min="0.05" max="1" step="0.05" value="0.6"><b class="an-val" data-an-strength-val>60%</b></div>
    <div class="an-field"><span>Who</span>${segment("who", [["all", "Everyone"], ["players", "Players"]])}</div>
    <div class="an-field an-pair"><span>Time</span>
      <label><input type="number" data-an-seconds value="0" min="0" max="600" step="1"> s for</label>
      <label><input type="number" data-an-fade value="0.4" min="0" max="10" step="0.1"> s easing</label>
    </div>
    <div class="an-field"><span>Colour</span><input type="color" data-an-colour value="#c81e1e">
      <label class="an-check"><input type="checkbox" data-an-beat> Breathing</label></div>
    <div class="an-field" data-an-style-row hidden><span>Look</span><select data-an-style>${momentsStyleOptions(styles)}</select></div>
    <div class="an-field"><span>Heard</span><select data-an-heard><option value="auto" selected>What suits it</option><option value="">Nothing</option>${Object.entries(sounds).map(([v, s]) => `<option value="${safe(v)}">${safe(s.name)}</option>`).join("")}<option value="own">A file of my own…</option></select></div>
    <div class="an-field" data-an-sound-row hidden><span>File</span><input type="text" data-an-sound placeholder="worlds/…/boom.ogg"><button type="button" data-an-pick title="Choose a sound file">…</button></div>
  </div>
  <section class="an-group an-presets">
    <h2>Together</h2>
    <div class="an-field"><select data-an-preset>${momentsPresetOptions(presets)}</select><button type="button" data-an-play title="Call every moment in this set at once">Call</button></div>
    <div class="an-feet an-thin">
      <button type="button" data-an-save title="Keep what is running now as a set of your own">Keep this</button>
      <button type="button" data-an-forget title="Forget the chosen set (your own only)">Forget</button>
      <button type="button" data-an-macro title="Put the last moment on the clipboard as a macro line">Copy</button>
      <button type="button" data-an-make title="Make a macro of the last moment in your macro directory">Macro</button>
    </div>
  </section>
  <button type="button" class="an-stop" data-an-stop disabled>Stop everything</button>`;
}

// Every style any moment has, in one list but grouped by whose it is, so "On the swell" is plainly a sway's and
// "Chain" is plainly a tether's. A style belonging to another kind is ignored by the engine, not obeyed.
export function momentsStyleOptions(styles = {}) {
  const groups = new Map();
  for (const [key, style] of Object.entries(styles)) {
    const forKind = style.forKind ?? "";
    if (!groups.has(forKind)) groups.set(forKind, []);
    groups.get(forKind).push(`<option value="${safe(key)}">${safe(style.name ?? key)}</option>`);
  }
  return [...groups].map(([forKind, options]) =>
    (forKind ? `<optgroup label="${safe(forKind === "tether" ? "Tether" : "Sway and bob")}">${options.join("")}</optgroup>` : options.join(""))).join("");
}

// The sets to choose between, the GM's own marked so the panel knows which may be forgotten. Redrawn whenever one
// is kept or forgotten, rather than asking the GM to open the panel again.
export function momentsPresetOptions(presets = {}) {
  return Object.entries(presets)
    .map(([key, preset]) => `<option value="${safe(key)}" data-an-own="${preset.own ? "1" : ""}">${safe(preset.name ?? key)}${preset.own ? " · mine" : ""}</option>`)
    .join("");
}

/**
 * Shows only what the chosen mode can do: the tiles that cannot work in it go, a group left with nothing goes with
 * them, and the fields that mean nothing in it are hidden. Nothing is disabled-but-present, because a row of dead
 * buttons is what made the first of these panels unreadable.
 */
export function momentsPanelMode(box, where = "screen") {
  if (!box?.querySelectorAll) return;
  for (const tile of box.querySelectorAll("[data-an-moment]")) {
    const wheres = (tile.dataset.anWheres ?? "").split(" ").filter(Boolean);
    tile.toggleAttribute("hidden", wheres.length > 0 && !wheres.includes(where));
  }
  for (const group of box.querySelectorAll("[data-an-group]")) {
    group.toggleAttribute("hidden", ![...group.querySelectorAll("[data-an-moment]")].some((t) => !t.hasAttribute("hidden")));
  }
  // A line's look is only ever a tether's, and a tether is only ever on what was picked.
  box.querySelector("[data-an-style-row]")?.toggleAttribute("hidden", where !== "tokens");
}

// What the readout says: what is running, and where each one is. Said plainly, because it is read mid-sentence.
export function momentsReadout(calls = [], moments = {}) {
  if (!calls.length) return "Nothing running.";
  return calls
    .map((c) => `<b>${safe(moments[c.kind]?.name ?? c.kind)}</b> ${c.where === "screen" ? "everywhere" : c.where === "point" ? "at a place" : "on what was picked"}`)
    .join(" · ");
}

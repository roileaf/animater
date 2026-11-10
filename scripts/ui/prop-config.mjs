// Breakable props: the tile's material and contents fields, the scene's switch, chance and Repair button.
import { MATERIALS } from "../engines/props/prop-material.mjs";
import { CONTENTS, STYLE_CHOICES, propGuesses, burstOf } from "../engines/props/prop-traits.mjs";

const ID = "animater";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LABELS = { wood: "Wood", glass: "Glass", clay: "Clay", metal: "Metal", stone: "Stone", none: "Won't break" };
const CONTENT_LABELS = { none: "Nothing", water: "Water", wine: "Wine", oil: "Oil", grain: "Grain", goods: "Loose goods", books: "Books", potions: "Potions", lampoil: "Lamp oil", powder: "Black powder" };
const STYLE_LABELS = { shatter: "Shatter", collapse: "Collapse" };
const options = (list, value) => list.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("");

// Groups marked data-show-for="powder" show only while Contents resolves to black powder (the GM's pick, else the
// guess in data-guess-contents); a hidden group's inputs are disabled so they do not submit. The tile config hook
// toggles them when Contents changes.
export function propTileFieldsHTML({ src, material = "", contents = "", style = "", light = "", tips = "", burst } = {}) {
  const guesses = propGuesses(src), guess = guesses.material, mat = MATERIALS.includes(material) ? material : "", own = CONTENTS.includes(contents) ? contents : "", sty = STYLE_CHOICES.includes(style) ? style : "";
  const mats = [["", `Automatic (${guess === "none" ? "won't break" : guess})`], ...MATERIALS.map((m) => [m, LABELS[m]])];
  const styles = [["", `Automatic (${guesses.style})`], ...STYLE_CHOICES.map((c) => [c, STYLE_LABELS[c]])];
  const conts = [["", `Automatic (${CONTENT_LABELS[guesses.contents]})`], ...CONTENTS.map((c) => [c, CONTENT_LABELS[c]])];
  const lit = light === "yes" || light === "no" ? light : "";
  const lightOpts = [["", `Automatic (${guesses.light ? "yes" : "no"})`], ["yes", "Yes"], ["no", "No"]];
  const tip = tips === "yes" || tips === "no" ? tips : "";
  const tipOpts = [["", `Automatic (${guesses.tips ? "yes" : "no"})`], ["yes", "Yes"], ["no", "No"]];
  const powder = (own || guesses.contents) === "powder";
  return `<fieldset data-animater-prop data-src="${esc(src)}" data-guess-contents="${esc(guesses.contents)}"><legend>Breakable prop</legend>
    <div class="form-group"><label>Material</label><div class="form-fields"><select name="flags.${ID}.prop.material">${options(mats, mat)}</select></div><p class="hint">What the prop is made of decides what can break it. Automatic goes by the file name.</p></div>
    <div class="form-group"><label>Breaks as</label><div class="form-fields"><select name="flags.${ID}.prop.style">${options(styles, sty)}</select></div><p class="hint">How it comes apart. Automatic goes by the file name: furniture collapses, everything else shatters.</p></div>
    <div class="form-group"><label>Contents</label><div class="form-fields"><select name="flags.${ID}.prop.contents">${options(conts, own)}</select></div><p class="hint">What spills when it breaks. Black powder explodes from fire, electricity or another blast; anything else spills it, and a later fire spell can still set it off.</p></div>
    <div class="form-group" data-show-for="powder"${powder ? "" : " hidden"}><label>Burst (squares)</label><div class="form-fields"><input type="number" name="flags.${ID}.prop.burst" min="1" max="4" step="1" value="${burstOf(burst)}"${powder ? "" : " disabled"}></div><p class="hint">How far the explosion reaches. Every prop, door and window inside it breaks, and the GM is told who stands in it.</p></div>
    <div class="form-group"><label>Light prop</label><div class="form-fields"><select name="flags.${ID}.prop.light">${options(lightOpts, lit)}</select></div><p class="hint">A lantern, brazier or candelabra puts out the lights on it when it breaks, and Repair lights them again. Automatic goes by the file name.</p></div>
    <div class="form-group"><label>Tips over instead of breaking</label><div class="form-fields"><select name="flags.${ID}.prop.tips">${options(tipOpts, tip)}</select></div><p class="hint">A brazier is knocked over by any shove: its fire goes out and hot coals scatter. Spells and blows still go by its material. Automatic goes by the file name.</p></div>
  </fieldset>`;
}

export function propSceneFieldsHTML({ on = false, chance = 25, breakWalls } = {}) {
  const n = Number(chance), pct = Number.isFinite(n) && n >= 0 && n <= 100 ? n : 25;
  return `<div class="form-group"><label>Breakable props</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.breakableProps"${on === true ? " checked" : ""}></div><p class="hint">Prop tiles (barrels, crates, pots) break from spells, shoves and missed swings and leave wreckage.</p></div>
    <div class="form-group"><label>Chance a miss breaks a prop (%)</label><div class="form-fields"><input type="number" min="0" max="100" step="1" name="flags.${ID}.propMissChance" value="${pct}"></div></div>
    <div class="form-group"><label>Doors and windows break</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.breakWalls"${breakWalls === false ? "" : " checked"}></div><p class="hint">With Breakable props on, doors (and windows the GM marks breakable) can be smashed open by hits, Force Open and heavy shoves.</p></div>
    <div class="form-group"><label>Repair</label><div class="form-fields"><button type="button" data-action="animater-repair-props"><i class="fa-solid fa-hammer"></i> Repair broken props</button></div></div>`;
}

// The Breakable fieldset in a wall's configuration: the door group for doors, the window group (Window box and Material)
// for a wall with no door. Only the group matching Door Type shows; the hidden group's inputs are disabled, so the one
// Material name submits once.
export function wallBreakFieldsHTML({ door, own = {}, sceneOn = false } = {}) {
  const isDoor = door === 1 || door === 2, off = (hidden) => (hidden ? " disabled" : "");
  const mat = ["wood", "metal", "stone"].includes(own.material) ? own.material : "wood";
  const doors = [["", "Automatic (on when the scene has Breakable props)"], ["never", "Never"]];
  const mats = [["wood", "Wood"], ["metal", "Metal"], ["stone", "Stone"]];
  const panes = [["glass", "Glass"], ["none", "Won't break"]];
  return `<fieldset data-animater-break-wall><legend>Breakable</legend>
    <div data-group="door"${isDoor ? "" : " hidden"}>
      <div class="form-group"><label>Breakable door</label><div class="form-fields"><select name="flags.${ID}.breakWall.door"${off(!isDoor)}>${options(doors, own.door === "never" ? "never" : "")}</select></div><p class="hint">${sceneOn ? "This scene has Breakable props on." : "Needs Breakable props on in the scene."} Never keeps this door whole.</p></div>
      <div class="form-group"><label>Material</label><div class="form-fields"><select name="flags.${ID}.breakWall.material"${off(!isDoor)}>${options(mats, mat)}</select></div><p class="hint">Wood gives way to blows, fire and hard shoves; metal and stone only to force or a heavy slam.</p></div>
      <div class="form-group"><label>Force Open breaks it</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.breakWall.forceOpen"${own.forceOpen === false ? "" : " checked"}${off(!isDoor)}></div><p class="hint">A successful Force Open on this door breaks it open.</p></div>
    </div>
    <div data-group="window"${isDoor ? " hidden" : ""}>
      <div class="form-group"><label>Window</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.breakWall.window"${own.window === true ? " checked" : ""}${off(isDoor)}></div><p class="hint">${sceneOn ? "This scene has Breakable props on." : "Needs Breakable props on in the scene."} Tick it to make this wall a window that can break. It is separate from the light a window lets through.</p></div>
      <div class="form-group"><label>Material</label><div class="form-fields"><select name="flags.${ID}.breakWall.material"${off(isDoor)}>${options(panes, own.material === "none" ? "none" : "glass")}</select></div><p class="hint">Glass breaks to most blows, cold, fire and any shove, and a shot that misses can shatter it. Won't break keeps it whole. A broken window lets sight, light and sound through but still blocks movement.</p></div>
    </div>
  </fieldset>`;
}

// Breakable props: the tile's material and contents fields, the scene's switch, chance and Repair button.
import { MATERIALS, guessMaterial } from "../engines/props/prop-material.mjs";

const ID = "animater";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LABELS = { wood: "Wood", glass: "Glass", clay: "Clay", metal: "Metal", stone: "Stone", none: "Won't break" };
const CONTENTS = ["none", "water", "wine", "oil", "grain", "goods"];
const CONTENT_LABELS = { none: "Nothing", water: "Water", wine: "Wine", oil: "Oil", grain: "Grain", goods: "Loose goods" };
const options = (list, value) => list.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("");

export function propTileFieldsHTML({ src, material = "", contents = "none" } = {}) {
  const guess = guessMaterial(src), mat = MATERIALS.includes(material) ? material : "", own = CONTENTS.includes(contents) ? contents : "none";
  const mats = [["", `Automatic (${guess === "none" ? "won't break" : guess})`], ...MATERIALS.map((m) => [m, LABELS[m]])];
  return `<fieldset data-animater-prop data-src="${esc(src)}"><legend>Breakable prop</legend>
    <div class="form-group"><label>Material</label><div class="form-fields"><select name="flags.${ID}.prop.material">${options(mats, mat)}</select></div><p class="hint">What the prop is made of decides what can break it. Automatic goes by the file name.</p></div>
    <div class="form-group"><label>Contents</label><div class="form-fields"><select name="flags.${ID}.prop.contents">${options(CONTENTS.map((c) => [c, CONTENT_LABELS[c]]), own)}</select></div><p class="hint">What spills when it breaks.</p></div>
  </fieldset>`;
}

export function propSceneFieldsHTML({ on = false, chance = 25 } = {}) {
  const n = Number(chance), pct = Number.isFinite(n) && n >= 0 && n <= 100 ? n : 25;
  return `<div class="form-group"><label>Breakable props</label><div class="form-fields"><input type="checkbox" name="flags.${ID}.breakableProps"${on === true ? " checked" : ""}></div><p class="hint">Prop tiles (barrels, crates, pots) break from spells, shoves and missed swings and leave wreckage.</p></div>
    <div class="form-group"><label>Chance a miss breaks a prop (%)</label><div class="form-fields"><input type="number" min="0" max="100" step="1" name="flags.${ID}.propMissChance" value="${pct}"></div></div>
    <div class="form-group"><label>Repair</label><div class="form-fields"><button type="button" data-action="animater-repair-props"><i class="fa-solid fa-hammer"></i> Repair broken props</button></div></div>`;
}

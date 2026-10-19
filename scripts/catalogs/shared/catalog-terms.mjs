// The words every catalog page uses, so PF2e, SF2e, D&D 5e and Daggerheart read the same.
// Pure: no Foundry globals.
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// How an entry's animation was made, with what that means on hover.
export const QUALITY = Object.freeze({
  signature: { label: "Signature", tip: "Made for this entry: its own art, timing and motion." },
  themed: { label: "Themed", tip: "Built from its element or theme (fire, cold, healing…) and tuned to this entry." },
  symbolic: { label: "Symbolic", tip: "A symbol or marker stands in where JB2A has no art of the thing itself." },
  unconfigured: { label: "Needs setup", tip: "No animation yet: press Customize to make one." },
});
export const qualityLabel = (quality) => QUALITY[quality]?.label ?? QUALITY.symbolic.label;
export function qualityBadgeHTML(quality) {
  const q = QUALITY[quality] ? quality : "symbolic";
  return `<span class="an-treatment is-${esc(q)}" data-tooltip="${esc(QUALITY[q].tip)}">${esc(QUALITY[q].label)}</span>`;
}

// Plug & play: the one name for "plays automatically from the catalog".
export const PLUG = Object.freeze({
  name: "Plug & play",
  allOn: (excluded) => `All on${excluded ? ` · ${excluded} left out` : ""}`,
  picked: (count) => (count ? `${count} hand-picked` : "Off"),
});
// The chip above a catalog grid: whether the whole catalog plays, or only picked entries.
export function plugModeHTML(state, total) {
  const all = state?.enabled && state.scope === "all";
  const picked = state?.enabled && !all ? [...new Set([...(state.selected ?? []), ...(state.customized ?? [])])].length : 0;
  const text = all ? PLUG.allOn(state.excluded?.length ?? 0) : PLUG.picked(picked);
  const tip = all ? "Every entry plays automatically; ⊘ on a card leaves it out." : picked ? "Only the entries marked ✓ play automatically." : "Nothing here plays automatically yet: turn on the whole catalog, or ✓ entries one by one.";
  return `<span class="an-plug-mode ${all ? "is-all" : picked ? "is-picked" : "is-off"}" data-tooltip="${esc(tip)}">${esc(PLUG.name)}: ${esc(text)}${total && (all || picked) ? ` <small>of ${Number(total).toLocaleString()}</small>` : ""}</span>`;
}

// ── An entry's panel ────────────────────────────────────────────────────────
// One status line saying whether this entry plays, then the buttons that change that.
// tone: "on" (plays from the catalog), "custom" (your version plays), "off", "manual".
// buttons: [{ label, action, primary?, disabled?, attrs? }].
export function catalogStatusHTML({ tone = "off", title, text = "", buttons = [] }) {
  const dot = { on: "●", custom: "✎", off: "○", manual: "▷" }[tone] ?? "○";
  const button = (b) => `<button type="button" data-action="${esc(b.action)}" class="${b.primary ? "an-primary" : "an-quiet"}" ${b.attrs ?? ""} ${b.disabled ? "disabled" : ""}>${esc(b.label)}</button>`;
  return `<div class="an-entry-status is-${esc(tone)}" role="status"><div><b><span aria-hidden="true">${dot}</span> ${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ""}</div><div class="an-entry-actions">${buttons.filter(Boolean).map(button).join("")}</div></div>`;
}
// The preview row: play the sample here, or on the canvas with your tokens.
export function previewRowHTML({ duration = 0, busy = false, canvasDisabled = false, label = "▶ Preview", progressLabel = "Preview progress" }) {
  return `<div class="an-preview-transport an-entry-preview"><button class="an-primary" data-action="recipe-preview" ${busy ? "disabled" : ""}>${esc(label)}</button><span data-preview-time>0.0 / ${(duration / 1000).toFixed(1)}s</span><button class="an-quiet" data-action="preview" data-tooltip="Play it on the canvas with your selected token and targets" ${canvasDisabled ? "disabled" : ""}>▷ On canvas</button></div><progress data-recipe-progress aria-label="${esc(progressLabel)}" max="${duration}" value="0"></progress><small class="an-preview-status" data-preview-status role="status"></small>`;
}
// Everything else about the entry (its stages, sounds, notes, media), folded away.
export function entryDetailsHTML(parts = [], summary = "Details: stages, sounds and source") {
  const body = parts.filter(Boolean).join("");
  return body ? `<details class="an-advanced an-entry-details"><summary>${esc(summary)}</summary>${body}</details>` : "";
}
// The stage list in plain time.
export function stageListHTML(stages = []) {
  const s = (ms) => `${(Math.round(Number(ms) || 0) / 1000).toFixed(2)} s`;
  return `<div class="an-catalog-steps">${stages.map((st, i) => `<div class="an-stage" data-stage-drag="${i}"><span>${i + 1}</span><div><b>${esc(st.label)}</b><small>from ${s(st.delay)} · ${s(st.duration)}</small></div></div>`).join("")}</div>`;
}

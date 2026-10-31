// The Flagged page (Tools > Flagged): every look a GM flagged for a new look, from a token's looks panel (Shift held over
// its hover tooltip) or a catalog's Flag button. Each opens in its catalog or is cleared; the whole list copies as text
// to send Animater's author.
import { catalogStateEntry } from "../catalogs/pf2e/state-catalog.mjs";
import { lookName } from "./token-looks.mjs";

export const FLAGGED_PAGE = "flagged";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const when = (ms, now) => {
  if (!ms) return "";
  const minutes = Math.round((now - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(ms).toLocaleDateString();
};

// Flagged looks newest first, each with its catalog entry when this world still has it.
export function flaggedRows(flags = {}, { entryOf = catalogStateEntry } = {}) {
  return Object.entries(flags).map(([id, f]) => ({ id, ...f, entry: entryOf(id) ?? null })).sort((a, b) => (b.flaggedAt ?? 0) - (a.flaggedAt ?? 0));
}

export function flaggedPageHTML(w, { now = Date.now() } = {}) {
  const rows = flaggedRows(w.host.flaggedLooks?.() ?? {}), userName = (id) => w.host.userName?.(id) ?? "";
  const row = (r) => `<li class="an-flagged-row"><img src="${esc(w.host.imageURL?.(r.entry?.img) ?? r.entry?.img ?? "")}" alt=""><div><b title="${esc(r.name)}">${esc(lookName(r.name))}</b><small>${r.kind === "condition" ? "Condition" : "Effect"}${r.flaggedAt ? ` · flagged ${esc(when(r.flaggedAt, now))}` : ""}${userName(r.by) ? ` by ${esc(userName(r.by))}` : ""}${r.entry ? "" : " · no longer in this world's catalog"}</small></div>`
    + `<span class="an-flagged-actions">${r.entry ? `<button type="button" data-action="flag-open" data-id="${esc(r.id)}">Open in catalog</button>` : ""}<button type="button" data-action="flag-clear" data-id="${esc(r.id)}">Clear flag</button></span></li>`;
  return `<div class="an-work an-flagged-work"><section class="an-library">
  <div class="an-catalog-intro"><div><span class="an-eyebrow">TOOLS</span><h2>${rows.length ? `${rows.length} flagged look${rows.length === 1 ? "" : "s"}` : "Nothing flagged"}</h2><p>Looks you marked for a new look during play. Open one in its catalog to customize it or leave it out, clear it when it is done, or copy the whole list to send Animater's author so the default can change for everyone.</p></div></div>
  ${rows.length ? `<div class="an-section-title"><span>Newest first</span><button class="an-text-button" data-action="flags-copy">Copy flagged list</button><button class="an-text-button" data-action="flags-clear-all">Clear all</button></div><ul class="an-flagged-list">${rows.map(row).join("")}</ul>`
    : `<div class="an-empty">No flagged looks.<small>Hover a token and hold Shift to see its looks with their buttons, then use Flag on one. Or press Flag on an entry in the Conditions or Effects catalog.</small></div>`}
  </section></div>`;
}

// The page's buttons. Returns true when it handled the action.
export async function handleFlaggedAction(w, action, b) {
  if (!["flag-open", "flag-clear", "flags-copy", "flags-clear-all"].includes(action)) return false;
  if (action === "flag-open") {
    const entry = catalogStateEntry(b.dataset.id);
    if (entry) {
      const kind = entry.kind === "condition" ? "condition" : "effect";
      w.page = kind === "condition" ? "conditions" : "effects";
      w.selectedState[kind] = entry.id;
      w.stateFlaggedOnly = { ...w.stateFlaggedOnly, [kind]: true };
      w.statePages[kind] = 0;
    }
  } else if (action === "flag-clear") {
    const f = (w.host.flaggedLooks?.() ?? {})[b.dataset.id];
    if (f) { await w.host.toggleFlaggedLook({ id: b.dataset.id, ...f }); w.message = `${lookName(f.name)}: flag cleared.`; }
  } else if (action === "flags-copy") {
    const text = w.host.flaggedLooksText?.() ?? "";
    if (text) { await (globalThis.game?.clipboard?.copyPlainText?.(text) ?? globalThis.navigator?.clipboard?.writeText?.(text)); w.message = "Flagged looks copied: paste them to Animater’s author on Discord or in a GitHub issue."; }
  } else {
    await w.host.clearFlaggedLooks?.();
    w.message = "All flags cleared.";
  }
  w.render();
  return true;
}

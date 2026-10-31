// Token looks panel: holding Shift over a token's hover tooltip turns it into a list of the lasting effect, condition and aura looks Animater shows
// on it, each with quick buttons: hide it here for now, always leave it out of its catalog, or flag it for a new
// look. Flags are the GM's to-do list in the catalog and a list to send Animater's author. Pure helpers plus a small
// DOM controller; main.mjs wires it to the token HUD, the lasting states and the catalog settings.

// A look's name without PF2e's "Spell Effect:" / "Effect:" prefix, which every effect shares: "Bless", not "Spell Effect…".
export const lookName = (name) => String(name ?? "").replace(/^\s*(?:spell\s+|stance:\s*)?effect\s*:\s*/i, "").trim() || String(name ?? "");

// Flags: { [entryId]: { name, kind, flaggedAt, by } }, a world setting.
export function normalizeFlags(flags) {
  const out = {};
  for (const [id, f] of Object.entries(flags && typeof flags === "object" ? flags : {})) {
    if (!id || !f || typeof f !== "object") continue;
    out[id] = { name: String(f.name ?? id), kind: f.kind === "condition" ? "condition" : "effect", flaggedAt: Number(f.flaggedAt) || 0, by: String(f.by ?? "") };
  }
  return out;
}
export function toggleFlag(flags, entry, { by = "", now = Date.now() } = {}) {
  const next = normalizeFlags(flags);
  if (!entry?.id) return next;
  if (next[entry.id]) delete next[entry.id];
  else next[entry.id] = { name: String(entry.name ?? entry.id), kind: entry.kind === "condition" ? "condition" : "effect", flaggedAt: now, by: String(by) };
  return next;
}
// The flagged looks as plain text, ready to paste to Animater's author (Discord, an issue).
export function flaggedText(flags, { system = "pf2e", version = "" } = {}) {
  const rows = Object.entries(normalizeFlags(flags)).sort(([, a], [, b]) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  if (!rows.length) return "";
  const head = `Animater${version ? ` ${version}` : ""} · ${system.toUpperCase()} looks flagged for a new look (${rows.length}):`;
  return [head, ...rows.map(([id, f]) => `- ${f.name} (${f.kind}, ${id})`)].join("\n");
}

// The panel's rows for one token: its lasting looks showing now (states.onToken), each with what its buttons can
// do. `entryOf(row)` gives its catalog entry ({ id, name, kind }) or null when it has none (your own recipe, another
// system's catalog): then only Hide here is offered.
export function panelRows(states, { entryOf = () => null, flags = {}, isGM = false } = {}) {
  const flagged = normalizeFlags(flags);
  return (states ?? []).filter((s) => s?.key).map((s) => {
    const entry = entryOf(s) ?? null;
    return { key: s.key, name: String(s.name ?? entry?.name ?? ""), entry, flagged: Boolean(entry && flagged[entry.id]), canAlways: isGM && Boolean(entry), canFlag: isGM && Boolean(entry) };
  });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function panelHTML(rows, { tokenName = "", isGM = false } = {}) {
  const head = `<header><span>Animater · ${esc(tokenName)}</span><button type="button" data-look-action="close" aria-label="Close">×</button></header>`;
  if (!rows.length) return `${head}<p class="animater-looks-empty">No lasting looks on this token right now.</p>`;
  const row = (r) => `<li data-key="${esc(r.key)}"><b title="${esc(r.name)}">${esc(lookName(r.name))}</b><span class="animater-looks-buttons">`
    + `<button type="button" data-look-action="hide" data-key="${esc(r.key)}" title="${isGM ? "Hide it on this token on every screen" : "Hide it on this token on your screen"}, until it is applied again">Hide here</button>`
    + (r.canAlways ? `<button type="button" data-look-action="always" data-key="${esc(r.key)}" title="Leave it out of its catalog for the whole world">Always off</button>` : "")
    + (r.canFlag ? `<button type="button" data-look-action="flag" data-key="${esc(r.key)}" aria-pressed="${r.flagged}" title="${r.flagged ? "Flagged for a new look: click to clear" : "Flag it for a new look (listed in its catalog, and in a list you can send Animater's author)"}">${r.flagged ? "⚑ Flagged" : "⚐ Flag"}</button>` : "")
    + `</span></li>`;
  return `${head}<ul>${rows.map(row).join("")}</ul>`;
}

// The panel: one element in document.body beside the token. `rowsFor(token)` gives its rows; `act(action, row)`
// runs a button (hide, always, flag) and the panel redraws. Escape, a click elsewhere or the close button hide it.
export function createTokenLooks({ document, rowsFor, act, isGM = () => false, toScreen }) {
  let el = null, token = null;
  const close = () => { token = null; if (el) el.hidden = true; };
  const draw = () => {
    if (!token || !el) return;
    el.innerHTML = panelHTML(rowsFor(token), { tokenName: token.name ?? token.document?.name ?? "", isGM: isGM() });
  };
  const element = () => {
    if (el) return el;
    el = document.createElement("div");
    el.className = "animater-token-looks";
    el.setAttribute("role", "dialog");
    el.hidden = true;
    el.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("[data-look-action]");
      if (!button) return;
      const action = button.dataset.lookAction;
      if (action === "close") return close();
      const row = rowsFor(token).find((r) => r.key === button.dataset.key);
      if (!row) return draw();
      button.disabled = true;
      try { await act(action, row, token); } finally { draw(); }
    });
    document.body.append(el);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    document.addEventListener("pointerdown", (event) => { if (el && !el.hidden && !el.contains(event.target)) close(); }, true);
    return el;
  };
  return {
    open(next) {
      if (!next) return;
      token = next;
      const box = element();
      draw();
      const at = toScreen({ x: (Number(next.x) || 0) + (Number(next.w) || 0), y: Number(next.y) || 0 });
      if (at) { box.style.left = `${Math.round(at.x)}px`; box.style.top = `${Math.round(at.y)}px`; }
      box.hidden = false;
    },
    refresh: draw,
    close,
  };
}

// Animater's per-player settings live in its own settings window. Where a settings-lock module runs (BBMM locks
// only what Configure Settings lists), they are listed in Configure Settings too, so a GM can lock them for players
// there. They are grouped under the same tabs as the Animater settings window, in its order.
import { SETTINGS_TABS } from "./settings-window.mjs";

// Modules that lock players' settings from the rows of Configure Settings.
export const LOCK_TOOLS = Object.freeze(["bbmm"]);
// Configure Settings draws these as a switch, number, slider or choice; anything else stays in Animater's window.
const listable = (c) => c?.scope === "client" && (c.type === Boolean || c.type === Number || (c.type === String && c.choices));

// The per-player settings to list, by tab: [{ id, label, icon, keys }]. A row for another system or module, or one
// only a GM uses, is left out, as the window leaves it out.
export function listedClientSettings({ id = "animater", registry, systemId = "", modules = [] }) {
  const env = { isGM: false, systemId, modules: modules instanceof Set ? modules : new Set(modules) };
  const seen = new Set();
  return SETTINGS_TABS.map((tab) => ({
    id: tab.id, label: tab.label, icon: tab.icon,
    keys: tab.rows.filter((row) => !row.menu && !row.gmOnly && (!row.when || row.when(env)))
      .flatMap((row) => [row.local, ...(row.extras ?? [])])
      .filter((key) => key && !seen.has(key) && listable(registry.get(`${id}.${key}`)) && seen.add(key)),
  })).filter((tab) => tab.keys.length);
}

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Puts the listed rows of Animater's section of Configure Settings under a heading per tab, after its own entries
// (the menus and animation quality). Safe to run again on a re-render.
export function organizeConfigCategory(section, tabs, id = "animater") {
  if (!section) return 0;
  section.querySelectorAll(".animater-config-tab").forEach((el) => el.remove());
  const doc = section.ownerDocument;
  let moved = 0;
  for (const [index, tab] of tabs.entries()) {
    const rows = tab.keys.map((key) => section.querySelector(`[name="${id}.${key}"]`)?.closest(".form-group")).filter(Boolean);
    if (!rows.length) continue;
    const heading = doc.createElement("h3");
    heading.className = "divider animater-config-tab";
    heading.innerHTML = `<i class="${esc(tab.icon)}" inert></i> ${esc(tab.label)}`;
    section.append(heading);
    if (index === 0) {
      const note = doc.createElement("p");
      note.className = "hint animater-config-tab";
      note.textContent = "Each player's own Animater options, the same as in Animater settings, listed here so they can be locked for players.";
      section.append(note);
    }
    section.append(...rows);
    moved += rows.length;
  }
  return moved;
}

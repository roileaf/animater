// Combat initiated with several screens on: the GM sees each one playing, silently and on a loop,
// and clicks the one everyone should see. None, Escape or closing the window plays nothing.
import { createFlash } from "./flash-render.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const seconds = (ms) => `${(ms / 1000).toFixed(1).replace(/\.0$/, "")} s`;

const MOMENTS = {
  initiated: { title: "Combat initiated", hint: "The encounter is ready. Pick the flash screen everyone sees." },
  start: { title: "Combat start", hint: "Combat begins. Pick the flash screen everyone sees." },
};
export function pickerHTML(options, event = "initiated") {
  return `<p class="an-flash-picker-hint">${MOMENTS[event]?.hint ?? MOMENTS.initiated.hint}</p><div class="an-flash-picker-grid">${options.map((s, i) =>
    `<button type="button" class="an-flash-picker-card" data-flash-pick="${esc(s.id)}" ${i === 0 ? "autofocus" : ""}><span class="an-flash-picker-stage" data-flash-pick-stage="${esc(s.id)}"></span><span class="an-flash-picker-name">${esc(s.name)}</span><small>${seconds(s.duration)} · click to play for everyone</small></button>`).join("")}</div>`;
}

export async function pickFlash(options, { event = "initiated", resolveMedia, vars = {} } = {}) {
  let chosen = null;
  const runs = [];
  const stopAll = () => { for (const r of runs.splice(0)) r.stop(); };
  try {
    const answer = await foundry.applications.api.DialogV2.wait({
      window: { title: MOMENTS[event]?.title ?? MOMENTS.initiated.title, icon: "fa-solid fa-bolt" },
      classes: ["animater-flash-picker"],
      position: { width: Math.min(920, 140 + options.length * 270) },
      content: pickerHTML(options, event),
      buttons: [{ action: "none", label: "None", icon: "fa-solid fa-ban" }],
      rejectClose: false,
      render: (_event, dialog) => {
        const root = dialog.element ?? _event?.target?.element;
        for (const box of root?.querySelectorAll("[data-flash-pick-stage]") ?? []) {
          const screen = options.find((s) => s.id === box.dataset.flashPickStage);
          if (!screen) continue;
          const run = createFlash(box, screen, { resolveMedia, vars });
          runs.push(run);
          // Loop with a short rest between plays, until the window closes.
          void (async () => {
            while (box.isConnected && runs.includes(run)) {
              await run.play();
              await new Promise((r) => setTimeout(r, 500));
            }
          })();
        }
        for (const card of root?.querySelectorAll("[data-flash-pick]") ?? [])
          card.addEventListener("click", () => { chosen = card.dataset.flashPick; void dialog.close(); });
      },
    });
    return chosen ?? (answer && answer !== "none" ? answer : null);
  } finally { stopAll(); }
}

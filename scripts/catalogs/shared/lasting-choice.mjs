// A condition or effect catalog's Lasting animation switch: stays while active, plays once when
// applied, or plays once and again briefly whenever the creature's turn starts in combat. Stored as
// the catalog state's `fade` (played once) and `turn` (also at turn start). Pure: no Foundry globals.
export const LASTING_CHOICES = Object.freeze({ lasting: "Stay while active", once: "Play once, then fade", turn: "Play once and at turn start" });
export const LASTING_HINT = "Stay while active keeps the animation on the token until it ends. Play once shows it when it is applied, then fades it away. Play once and at turn start also shows it again briefly whenever the creature's turn starts in combat.";
export const lastingChoice = (state) => (state?.fade !== true ? "lasting" : state.turn === true ? "turn" : "once");
// The switch steps through the three choices in order.
const NEXT = { lasting: { fade: true, turn: false }, once: { fade: true, turn: true }, turn: { fade: false, turn: false } };
export const nextLastingChange = (state) => ({ ...NEXT[lastingChoice(state)] });
export const lastingMessage = (state, noun) => ({
  lasting: `${noun} stay on the token while they last.`,
  once: `${noun} play once when applied, then fade away.`,
  turn: `${noun} play once when applied and again briefly at the creature's turn start.`,
})[lastingChoice(state)];
// Picking one of the three directly (a segmented control), not stepping through them.
const CHANGE = { lasting: { fade: false, turn: false }, once: { fade: true, turn: false }, turn: { fade: true, turn: true } };
export const lastingChange = (choice) => (CHANGE[choice] ? { ...CHANGE[choice] } : null);
// A player's own "Lasting condition animations" setting wins on their screen.
const DEVICE = { always: "Always visible", turn: "Played once and at turn start", once: "Played once" };
const escape = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function lastingChoiceHTML(state, action, { label = "Lasting animation", disabled = false, deviceMode = "world" } = {}) {
  const current = lastingChoice(state);
  const buttons = Object.entries(LASTING_CHOICES).map(([key, text]) => `<button type="button" data-action="${escape(action)}" data-choice="${key}" aria-pressed="${key === current}" class="${key === current ? "is-active" : ""}" ${disabled ? "disabled" : ""}>${escape(text)}</button>`).join("");
  const device = DEVICE[deviceMode] ? `<small class="an-lasting-override">On this device: ${escape(DEVICE[deviceMode])} (your own setting)</small>` : "";
  return `<div class="an-catalog-automation an-lasting"><div><b>Lasting animation</b><small>${escape(LASTING_HINT)}</small></div><div class="an-segmented" role="group" aria-label="${escape(label)}">${buttons}</div>${device}</div>`;
}

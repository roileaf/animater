// Which press opens a region's panel on the map. A GM who right-clicks to pan, or who aims at a token and
// misses it, kept opening the panel by accident, so the gesture is theirs to choose. Nothing here touches
// Foundry: it is given what the press was and says whether the panel should open.

// A plain right-click as it always was; the same with Shift held; two right-clicks in quick succession; or
// never, leaving the region's own sheet (its Animater tab) as the way in.
export const PANEL_OPENS = Object.freeze({
  right: 'Right-click',
  shift: 'Shift + right-click',
  double: 'Double right-click',
  sheet: "Only the region's sheet",
});

// How close together two right-clicks must be to count as one double: the same reach a quick click allows,
// and about as long as a system double-click.
export const DOUBLE_MS = 450;
export const DOUBLE_PX = 8;

export const panelOpensMode = (mode) => (Object.hasOwn(PANEL_OPENS, mode) ? mode : 'right');

/**
 * Whether this press opens the panel. `press` is the right button's own record: `quick` (pressed and
 * released in place rather than held or dragged, which is panning), `shift`, `x`, `y` and `at` (ms).
 * `last` is the press that opened or counted before it, for the double. A press we know nothing about
 * (no record at all) is taken as a plain right-click, as it was before the choice existed.
 */
export function panelOpens(mode, press, last = null) {
  const how = panelOpensMode(mode);
  if (how === 'sheet') return false;
  if (!press) return how !== 'double';
  if (press.quick !== true) return false;
  if (how === 'shift') return press.shift === true;
  if (how !== 'double') return true;
  if (!last || !Number.isFinite(last.at) || !Number.isFinite(press.at)) return false;
  return press.at - last.at <= DOUBLE_MS && Math.hypot((press.x ?? 0) - (last.x ?? 0), (press.y ?? 0) - (last.y ?? 0)) <= DOUBLE_PX;
}

// What to remember after a press that did not open the panel, so the next one can be its double. A press
// that opened starts afresh, or a third click would open it again.
export const panelPressMemory = (press, opened) => (opened || !press || press.quick !== true ? null : { x: press.x ?? 0, y: press.y ?? 0, at: press.at });

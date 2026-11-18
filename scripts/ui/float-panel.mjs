// Everything this module floats over the page — a panel, a tooltip, a full-screen flash — is a plain element put into
// Foundry's page, and where it sits comes from the stylesheet alone. Foundry's <body> is a flex row, so an element
// that the stylesheet has not reached is not merely plain: it becomes a column of that row, taking a strip of the
// window for itself and pushing Foundry's own sidebar aside to make room.
//
// (Issue #25: Map Painter and Moments "move the right-hand menu over to the left", with nothing selectable. Forcing
// the Moments panel to position: static here moved the sidebar left by exactly the panel's width, which is the
// screenshot. The stylesheet had not reached it.)
//
// So nothing is trusted to arrive styled. Each floating thing is put on the page through here, and anything that lands
// without a placing of its own is given one. When the stylesheet is doing its job — which is every ordinary session —
// none of this runs at all: the element is already placed, and it is left exactly as it was.

/** Whether a floating element has lost its placing (pure): one left static is a column of Foundry's flex body. */
export const adrift = (position) => !position || position === "static";

// Where each kind of floating thing goes when it has to place itself. Plain, not pretty: this is the look of a
// stylesheet that did not arrive, and it only has to be usable and out of the way of Foundry's own furniture.
const PLACES = Object.freeze({
  // A panel the GM works in: in the corner its stylesheet would have put it, and never taller than the window.
  panel: { position: "fixed", right: "18px", bottom: "18px", "z-index": "71", "max-height": "80vh", "overflow": "auto" },
  // A layer over the whole window that is only ever looked at, never clicked.
  cover: { position: "fixed", inset: "0", "z-index": "70", "pointer-events": "none" },
  // A layer over the whole window that is meant to be clicked (a handout waiting to be put down).
  stage: { position: "fixed", inset: "0", "z-index": "73" },
  // One that puts itself where it points (a tooltip sets its own top and left): it needs taking out of the row, no more.
  point: { position: "fixed", "z-index": "72" },
});

/** What a floating element of this kind must be given to place itself (pure). An unknown kind is treated as a panel. */
export const placing = (kind = "panel") => ({ ...(PLACES[kind] ?? PLACES.panel) });

/**
 * Puts a floating element on the page and makes sure it is placed. `put` does the putting (so one can go after the
 * board rather than at the end of the body), `styleOf` reads back what the stylesheet made of it. True when this had
 * to place the element itself, which is to say the stylesheet never reached it.
 */
export function floated(el, kind = "panel", put = null, styleOf = (e) => globalThis.getComputedStyle?.(e)) {
  if (!el) return false;
  if (put) put(el); else globalThis.document?.body?.append(el);
  let how = null;
  try { how = styleOf(el); } catch { how = null; }
  // Only when it is plainly adrift: told nothing about how it landed, nothing is changed. A rule that cannot see must
  // not reach for the element either.
  if (!how || !adrift(how.position)) return false;
  // Set as the element's own, and firmly: a stylesheet that placed it would not have left it static, so whatever is
  // overriding it here is not something to lose a working panel to.
  for (const [name, value] of Object.entries(placing(kind))) {
    try { el.style?.setProperty?.(name, value, "important"); } catch { /* an element with no style of its own */ }
  }
  return true;
}

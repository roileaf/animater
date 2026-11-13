// Foundry's movement ruler highlights every grid square a token moves through, at half strength in the mover's
// colour, on the interface layer above the floor: over the squares already walked it washes out Animater's dust,
// prints and splashes. Each highlighted square says whether the token has passed it ('passed') or is still heading
// there ('pending', 'planned'); the walked squares fade (or hide) and the way ahead stays as Foundry draws it.
// `mode`: 'fade' (a quarter strength), 'hide' (not drawn) or 'off' (as Foundry draws it).
const FADE = 0.25;
export function walkedHighlight(style, waypoint, mode) {
  if (!style || waypoint?.stage !== 'passed' || !(style.alpha > 0)) return style;
  if (mode === 'hide') return { ...style, alpha: 0 };
  if (mode === 'fade') return { ...style, alpha: style.alpha * FADE };
  return style;
}

// Wraps the ruler class's _getGridHighlightStyle (Foundry v14 TokenRuler, client/canvas/placeables/tokens/ruler.mjs)
// once; `mode()` is read on every square, so changing the setting takes effect on the next redraw. Returns an undo.
// Given libWrapper and the method's path (`target`), it wraps through libWrapper (which then warns of no foreign wrapping).
const WRAPPED = Symbol('animater.walkedPath');
const ruled = new WeakSet();
export function wrapRulerHighlight(RulerClass, mode, { libWrapper: lw = null, target = null, id = 'animater' } = {}) {
  const proto = RulerClass?.prototype;
  const original = proto?._getGridHighlightStyle;
  if (typeof original !== 'function' || original[WRAPPED] || ruled.has(RulerClass)) return () => {};
  const shaped = function (wrapped, waypoint, offset) {
    const style = wrapped(waypoint, offset);
    try { return walkedHighlight(style, waypoint, mode()); } catch { return style; }
  };
  if (lw && target) {
    lw.register(id, target, shaped, 'WRAPPER'); ruled.add(RulerClass);
    return () => { try { lw.unregister(id, target); } catch { /* gone */ } ruled.delete(RulerClass); };
  }
  function _getGridHighlightStyle(waypoint, offset) { return shaped.call(this, (w, o) => original.call(this, w, o), waypoint, offset); }
  _getGridHighlightStyle[WRAPPED] = true;
  proto._getGridHighlightStyle = _getGridHighlightStyle;
  return () => { if (proto._getGridHighlightStyle === _getGridHighlightStyle) proto._getGridHighlightStyle = original; };
}

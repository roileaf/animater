// Windows that open and close, as doors do, with no sound of their own. What a wall's Window says fills it: a wooden window stops everything when
// shut; wooden shutters do too, then with their slats open can be seen through and show light through in bands, for the look only, before the window itself opens; glass lets the light and sight through. None lets sound or air through until it is open. Open, each is an empty frame.
// Nobody walks through a window, open or shut, unless the wall says it can be climbed through when open (flags.windowWalk): its movement otherwise stays as the wall has it.
const NONE = 0, NORMAL = 20;
export const CLOSING_WINDOWS = Object.freeze({ woodWindow: 'Wooden window: shut, it stops everything', shutterWindow: 'Wooden shutters: shut, slats open for light in bands, then the window open', glassWindow: 'Glass: shut, light and sight come through', curtainWindow: 'Curtains: shut, only a dim light comes through', mosaicWindow: 'Mosaic or stained glass: shut, coloured light comes through', leadedWindow: 'Leaded diamonds: shut, light in a fine diagonal net', roseWindow: 'Rose window: a wheel of coloured light', frostedWindow: 'Frosted glass or oiled paper: a soft glow, nothing seen through' });
export const closesWindow = (kind) => Object.hasOwn(CLOSING_WINDOWS, kind ?? '');

// What a window lets through (pure), as a wall's own settings: { light, sight, sound }.
export function windowSenses(kind, open, slats = false) {
  if (open) return { light: NONE, sight: NONE, sound: NONE };
  // Shutters with their slats open: you can see out between them, and the bands of light are drawn, by day and night (wall-shadows.mjs windowOpening, slats). Foundry's own light can only come through whole, so it stops here. (They show only where sight reaches, so sight has to pass for them to be seen at all.)
  if (kind === 'shutterWindow' && slats) return { light: NORMAL, sight: NONE, sound: NORMAL };
  // (Drawn curtains: the wall's light stops, and Animater draws the dim light through them, wall-shadows.mjs windowOpening.)
  if (kind === 'woodWindow' || kind === 'shutterWindow' || kind === 'curtainWindow') return { light: NORMAL, sight: NORMAL, sound: NORMAL };
  // (Frosted glass or oiled paper: its light comes in, but nothing is seen through it.)
  if (kind === 'frostedWindow') return { light: NONE, sight: NORMAL, sound: NORMAL };
  return { light: NONE, sight: NONE, sound: NORMAL };
}
// Puts them on the wall's edge, Foundry's working copy that light, sight and sound are worked out from (pure on what it is given). The wall itself is never changed: what the GM set on it stays, and it is back as soon as it is no window that opens.
export function applyWindowEdge(edge, kind, open, slats = false, walk = false) {
  if (!edge || !closesWindow(kind)) return false;
  Object.assign(edge, windowSenses(kind, open, slats));
  if (walk && open) edge.move = NONE;
  return true;
}

// Whether this user may use it now (pure): as a door's, those allowed doors, not while paused unless the GM; and a player only with one of their creatures close enough to reach it.
export const mayUseWindow = ({ isGM = false, canDoors = false, paused = false, inReach = true } = {}) => isGM || (canDoors && !paused && inReach);
// How much of a window's control shows (pure), by the "Window icons" setting. A hidden control still answers the pointer: over it, it shows.
export const WINDOW_ICON_NEAR = 3;
export const windowIconAlpha = ({ style = 'usual', hovered = false, near = false, gm = false } = {}) => { if (hovered) return 1; if (style === 'near') return near ? 0.8 : gm ? 0.3 : 0; if (style === 'faint') return near ? 0.8 : 0.3; return 0.8; };
// How far a creature reaches to a window, in squares past its own edge.
export const WINDOW_REACH_SQUARES = 1.5;
// Whether any of `tokens` ({ x, y the middle, radius }) reaches the wall `c` [ax, ay, bx, by] (pure), by the nearest point along it.
export function windowInReach(tokens = [], c = [0, 0, 0, 0], grid = 100, squares = WINDOW_REACH_SQUARES) {
  const [ax, ay, bx, by] = c.map(Number), dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  return tokens.some(({ x, y, radius = 0 }) => { const k = length > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / length)) : 0; return Math.hypot(x - (ax + k * dx), y - (ay + k * dy)) <= radius + grid * squares; });
}
// The next state a click brings it to (pure): shut and open; shutters go by way of their slats. { open, slats }.
export function nextWindowState(kind, { open = false, slats = false } = {}) {
  if (kind !== 'shutterWindow') return { open: !open, slats: false };
  if (open) return { open: false, slats: false };
  return slats ? { open: true, slats: false } : { open: false, slats: true };
}
// What a click does (pure): a locked window will not open, for anyone, until the GM unlocks it: 'rattle' it, else 'toggle'.
export const windowClick = ({ locked = false } = {}) => (locked ? 'rattle' : 'toggle');
// What locking writes (pure): a window is shut to be locked; unlocking leaves it shut. { open, locked }.
export const windowLockState = ({ locked = false } = {}) => ({ open: false, slats: false, locked: !locked });

// Its control's picture (a PIXI.Graphics, its middle at 0, 0), with no box or frame round it, telling what fills it: planks of wood, slats of shutters, panes of glass; shut, filling its square; open, swung out either side of a dark gap. Locked, a padlock.
const WOOD = 0xa8713c, WOOD_DARK = 0x5e3a1b, SLAT = 0xb98a55, GLASS = 0x8fc9ee, CREAM = 0xf2ece0, CLOTH = 0xa8504a, CLOTH_DARK = 0x6a2c2a, LEAD = 0x2e3036, FROST = 0xe4ecef;
const JEWEL_PANES = [0xc8473f, 0x3f63c8, 0xe0b440, 0x4f9a55, 0x8a4ab0, 0xe07a3a];
export function drawWindowIcon(PIXI, { kind = 'glassWindow', open = false, slats = false, locked = false, size = 40 } = {}) {
  const g = new PIXI.Graphics(), s = size, h = s * 0.44, line = Math.max(1, s * 0.035);
  const pane = (x, y, w, tall, skew = 0) => {
    // A pane from (x, y), `skew` lifting its far side, as it swings.
    const quad = [x, y, x + w, y - skew, x + w, y + tall + skew, x, y + tall];
    if (kind === 'woodWindow') {
      g.lineStyle(0); g.beginFill(WOOD, 1); g.drawPolygon(quad); g.endFill();
      g.lineStyle(line, WOOD_DARK, 1);
      for (const k of [1 / 3, 2 / 3]) { g.moveTo(x + w * k, y - skew * k); g.lineTo(x + w * k, y + tall + skew * k); }
    } else if (kind === 'curtainWindow') {
      // Cloth hanging in folds.
      g.lineStyle(0); g.beginFill(CLOTH, 1); g.drawPolygon(quad); g.endFill();
      g.lineStyle(Math.max(1, s * 0.03), CLOTH_DARK, 1);
      for (const k of [0.2, 0.45, 0.7, 0.9]) { g.moveTo(x + w * k, y - skew * k); g.lineTo(x + w * k, y + tall + skew * k); }
    } else if (kind === 'mosaicWindow' || kind === 'roseWindow') {
      // (A rose window swung open: its coloured glass in each leaf.)
      // Coloured panes in lead.
      g.lineStyle(0);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const u0 = i / 2, u1 = (i + 1) / 2, v0 = j / 3, v1 = (j + 1) / 3; g.beginFill(JEWEL_PANES[(i * 3 + j + (x > 0 ? 2 : 0)) % JEWEL_PANES.length], 0.95); g.drawPolygon([x + w * u0, y - skew * u0 + (tall + 2 * skew * u0) * v0, x + w * u1, y - skew * u1 + (tall + 2 * skew * u1) * v0, x + w * u1, y - skew * u1 + (tall + 2 * skew * u1) * v1, x + w * u0, y - skew * u0 + (tall + 2 * skew * u0) * v1]); g.endFill(); }
      g.lineStyle(Math.max(1, s * 0.025), LEAD, 1); g.moveTo(x + w / 2, y - skew / 2); g.lineTo(x + w / 2, y + tall + skew / 2);
    } else if (kind === 'leadedWindow') {
      // Small diamond panes.
      g.lineStyle(0); g.beginFill(GLASS, 0.8); g.drawPolygon(quad); g.endFill();
      g.lineStyle(Math.max(1, s * 0.02), LEAD, 0.9);
      // A grid of cells, each crossed corner to corner: a net of diamonds, following the pane as it swings.
      const at = (u, v) => [x + w * u, y - skew * u + (tall + 2 * skew * u) * v], cols = 2, rows = 4;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { g.moveTo(...at(i / cols, j / rows)); g.lineTo(...at((i + 1) / cols, (j + 1) / rows)); g.moveTo(...at((i + 1) / cols, j / rows)); g.lineTo(...at(i / cols, (j + 1) / rows)); }
    } else if (kind === 'frostedWindow') {
      g.lineStyle(0); g.beginFill(FROST, 0.92); g.drawPolygon(quad); g.endFill();
    } else if (kind === 'shutterWindow') {
      // Shut, close-set slats, solid; slats open, thin ones with light between them. Thrown open, the wooden leaves as they are, swung out to either side.
      const tilted = slats && !open, rows = tilted ? 4 : 6;
      g.lineStyle(0); g.beginFill(tilted ? 0xf0dcae : SLAT, 1); g.drawPolygon(quad); g.endFill();
      g.lineStyle(Math.max(1, s * (tilted ? 0.05 : 0.02)), WOOD_DARK, 1);
      for (let i = 0; i < rows; i++) { const t = (i + 0.5) / rows; g.moveTo(x, y + tall * t); g.lineTo(x + w, y - skew + (tall + 2 * skew) * t); }
    } else {
      g.lineStyle(0); g.beginFill(GLASS, 0.85); g.drawPolygon(quad); g.endFill();
      g.lineStyle(Math.max(1, s * 0.03), 0xffffff, 0.9); g.moveTo(x + w * 0.25, y + tall * 0.55); g.lineTo(x + w * 0.7, y + tall * 0.2);
    }
  };
  if (open) {
    g.beginFill(0x15171c, 1); g.drawRect(-h, -h, h * 2, h * 2); g.endFill();
    // Hinged on the frame's sides, swung in toward the eye: each narrower and shorter at its free edge, the dark between them.
    pane(-h, -h, h * 0.62, h * 2, -h * 0.24); pane(h * 0.38, -h * 0.76, h * 0.62, h * 1.52, h * 0.24);
  } else if (kind === 'roseWindow') {
    // A round window of coloured wedges.
    for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2; g.lineStyle(0); g.beginFill(JEWEL_PANES[k % JEWEL_PANES.length], 0.95); g.moveTo(0, 0); g.arc(0, 0, h, a0, a1); g.lineTo(0, 0); g.endFill(); }
    g.lineStyle(Math.max(1, s * 0.03), LEAD, 1); g.drawCircle(0, 0, h); g.drawCircle(0, 0, h * 0.3);
    // (Two leaves, as every window that opens: the line where they meet.)
    g.lineStyle(Math.max(1, s * 0.04), CREAM, 1); g.moveTo(0, -h); g.lineTo(0, h);
  }
  else { pane(-h, -h, h - line / 2, h * 2); pane(line / 2, -h, h - line / 2, h * 2); }
  g.lineStyle(Math.max(1, s * 0.04), CREAM, 1);
  if (!open && kind === 'glassWindow') { g.moveTo(0, -h); g.lineTo(0, h); g.moveTo(-h, 0); g.lineTo(h, 0); }
  // Every window that opens is two leaves: the line where they meet.
  if (!open && (kind === 'shutterWindow' || kind === 'woodWindow' || kind === 'mosaicWindow' || kind === 'leadedWindow' || kind === 'frostedWindow' || kind === 'curtainWindow')) { g.moveTo(0, -h); g.lineTo(0, h); }
  if (locked) {
    const bx = s * 0.26, by = s * 0.28, w = s * 0.2;
    g.lineStyle(s * 0.045, 0xf4d9a0, 1); g.moveTo(bx - w * 0.3, by - w * 0.35); g.arc(bx, by - w * 0.35, w * 0.3, Math.PI, 0);
    g.lineStyle(0); g.beginFill(0xf4d9a0, 1); g.drawRoundedRect(bx - w / 2, by - w * 0.35, w, w * 0.8, w * 0.12); g.endFill();
  }
  return g;
}

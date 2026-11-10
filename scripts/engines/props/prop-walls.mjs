// Walls a prop tile owns (non-door, not a breakable window, both ends inside its rotated bounds) and the updates that open and restore them.
const KEYS = ["move", "sight", "light", "sound"];
const saved = w => w.flags?.animater?.prop?.restore;

export function ownWalls(tile, walls, grid) {
  const cx = tile.x + tile.width / 2, cy = tile.y + tile.height / 2;
  const a = -(tile.rotation || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const hw = tile.width / 2 + grid / 4, hh = tile.height / 2 + grid / 4;
  // undo the tile's rotation about its centre, then test against the grown axis-aligned rectangle
  const inside = (x, y) => {
    const dx = x - cx, dy = y - cy;
    return Math.abs(dx * cos - dy * sin) <= hw && Math.abs(dx * sin + dy * cos) <= hh;
  };
  return walls.filter(w => !w.door && w.flags?.animater?.breakWall?.window !== true && inside(w.c[0], w.c[1]) && inside(w.c[2], w.c[3]));
}

export function openUpdates(walls) {
  // a wall already opened keeps its saved originals (overlapping props)
  return walls.filter(w => !saved(w)).map(w => ({
    _id: w.id, move: 0, sight: 0, light: 0, sound: 0,
    "flags.animater.prop.restore": Object.fromEntries(KEYS.map(k => [k, w[k]])),
  }));
}

export function restoreUpdates(walls) {
  return walls.filter(saved).map(w => ({ _id: w.id, ...Object.fromEntries(KEYS.map(k => [k, saved(w)[k]])), "flags.animater.prop.-=restore": null }));
}

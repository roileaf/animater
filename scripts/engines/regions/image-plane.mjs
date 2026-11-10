const SOLID_ALPHA = 200;
const MATTE = 210;

/**
 * @typedef {{
 *   id: { kind: "map", levelId: string } | { kind: "tile", tileId: string },
 *   src: string,
 *   frame: { x: number, y: number, width: number, height: number },
 *   role: "floor" | "overhead",
 *   elevation: number | null,
 *   blocksLight: boolean,
 *   blocksWeather: boolean,
 * }} Plane
 */

/**
 * @typedef {{
 *   source: Plane["id"],
 *   loops: { hole: boolean, points: number[] }[],
 * }} Binding
 */

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pixelCount(rgba, width, height) {
  const w = finite(width);
  const h = finite(height);
  if (w == null || h == null || w < 1 || h < 1) throw new Error("image size is missing");
  const n = Math.round(w) * Math.round(h);
  if (!rgba || rgba.length < n * 4) throw new Error("rgba is shorter than width * height * 4");
  return n;
}

export function sameSource(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "map" ? a.levelId === b.levelId : a.tileId === b.tileId;
}

export function levelList(levels) {
  if (Array.isArray(levels)) return [...levels];
  if (levels && typeof levels.forEach === "function") return [...levels];
  return [];
}

// A rotated or scaled tile's picture does not fill its rectangle, so an outline traced on it would land in the wrong place.
export function tileFrameIsPlain(tile) {
  const rotation = Number(tile?.rotation);
  const tex = tile?.texture ?? {};
  const scaleX = tex.scaleX == null || tex.scaleX === "" ? 1 : Number(tex.scaleX);
  const scaleY = tex.scaleY == null || tex.scaleY === "" ? 1 : Number(tex.scaleY);
  const fit = tex.fit ?? "fill";
  return (!Number.isFinite(rotation) || rotation === 0) && scaleX === 1 && scaleY === 1 && fit === "fill";
}

function planeFor(planes, source) {
  return planes.find((plane) => sameSource(plane.id, source)) ?? null;
}

function mapFor(planes, region) {
  const maps = planes.filter((plane) => plane.id.kind === "map");
  const levels = region?.levels;
  if (Array.isArray(levels) && levels.length > 0) {
    const listed = maps.find((plane) => levels.includes(plane.id.levelId));
    if (listed) return listed;
  }
  return maps[0] ?? null;
}

function legacyCovers(region, height) {
  const span = region?.elevation;
  if (span == null || (span.bottom == null && span.top == null)) return true;
  const bottom = span.bottom == null ? -Infinity : Number(span.bottom);
  const top = span.top == null ? Infinity : Number(span.top);
  return Number.isFinite(height) && height >= bottom && height <= top;
}

function floorName(region) {
  const floor = region?.flags?.animater?.floor;
  return typeof floor === "string" && floor !== "" ? floor : null;
}

function planeFromTile(tile, levelId, { allowHidden = false } = {}) {
  if (!tile || (tile.hidden === true && !allowHidden)) return null;
  if (!tileFrameIsPlain(tile)) return null;
  const levels = tile.levels;
  if (Array.isArray(levels) && levels.length > 0 && !levels.includes(levelId)) return null;
  const tileId = tile.id ?? tile._id;
  const src = tile.texture?.src ?? "";
  const x = finite(tile.x);
  const y = finite(tile.y);
  const width = finite(tile.width);
  const height = finite(tile.height);
  if (tileId == null || tileId === "" || !src) return null;
  if (x == null || y == null || width == null || height == null || width <= 0 || height <= 0) return null;
  const blocksLight = tile.restrictions?.light === true;
  const blocksWeather = tile.restrictions?.weather === true;
  const elevation = finite(tile.elevation);
  return {
    id: { kind: "tile", tileId: String(tileId) },
    src: String(src),
    frame: { x, y, width, height },
    role: blocksLight || blocksWeather ? "overhead" : "floor",
    elevation: elevation == null ? 0 : elevation,
    blocksLight,
    blocksWeather,
  };
}

export function planesFrom({ levelId, sceneRect, backgroundSrc, tiles = [], allowHidden = false } = {}) {
  const width = finite(sceneRect?.width);
  const height = finite(sceneRect?.height);
  if (width == null || height == null || width <= 0 || height <= 0) throw new Error("planesFrom: sceneRect needs a width and a height");
  const planes = [{
    id: { kind: "map", levelId: String(levelId ?? "") },
    src: String(backgroundSrc ?? ""),
    frame: { x: finite(sceneRect.x) ?? 0, y: finite(sceneRect.y) ?? 0, width, height },
    role: "floor",
    elevation: null,
    blocksLight: false,
    blocksWeather: false,
  }];
  for (const tile of tiles) {
    const plane = planeFromTile(tile, levelId, { allowHidden });
    if (plane) planes.push(plane);
  }
  return planes;
}

export function solidMask(rgba, width, height) {
  const n = pixelCount(rgba, width, height);
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = rgba[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0;
  return mask;
}

export function rgbForModel(rgba, width, height) {
  const n = pixelCount(rgba, width, height);
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (rgba[i * 4 + 3] >= SOLID_ALPHA) {
      out[o] = rgba[i * 4];
      out[o + 1] = rgba[i * 4 + 1];
      out[o + 2] = rgba[i * 4 + 2];
    } else {
      out[o] = MATTE;
      out[o + 1] = MATTE;
      out[o + 2] = MATTE;
    }
  }
  return out;
}

export function project(frame, u, v) {
  return { x: frame.x + u * frame.width, y: frame.y + v * frame.height };
}

function sourceId(id) {
  if (id?.kind === "map") return { kind: "map", levelId: id.levelId };
  return { kind: "tile", tileId: id.tileId };
}

export function bindingFromProposal(plane, proposal, image) {
  const width = finite(image?.width);
  const height = finite(image?.height);
  if (width == null || height == null || width <= 0 || height <= 0) throw new Error("bindingFromProposal: image size is missing");
  const loops = [];
  for (const loop of proposal?.loops ?? []) {
    const src = loop?.points ?? [];
    const points = [];
    for (let i = 0; i + 1 < src.length; i += 2) points.push(src[i] / width, src[i + 1] / height);
    if (points.length >= 6) loops.push({ hole: loop.hole === true, points });
  }
  return { source: sourceId(plane.id), loops };
}

function hit(contains, region, point) {
  try {
    return contains(region, point) === true;
  } catch {
    return false;
  }
}

export function surfaceAt(point, { elevation = 0, regions = [], planes = [], contains } = {}) {
  const height = elevation == null ? 0 : Number(elevation);
  let tileFloor = null;
  let mapFloor = null;
  let blocksWeather = false;
  let blocksLight = false;

  for (const region of regions ?? []) {
    if (!hit(contains, region, point)) continue;
    const binding = region?.flags?.animater?.imageRegion ?? null;
    if (binding) {
      const plane = planeFor(planes, binding.source);
      if (!plane) continue;
      if (plane.role === "overhead") {
        if (plane.elevation != null && height < plane.elevation) {
          if (plane.blocksWeather) blocksWeather = true;
          if (plane.blocksLight) blocksLight = true;
        }
        continue;
      }
      const name = floorName(region);
      if (!name) continue;
      // A token nudged a fraction off the deck, such as 10.5 on a deck at 10, is still on it. A full step away is not.
      const covers = plane.elevation == null || (plane.id.kind === "tile" ? Math.abs(height - plane.elevation) <= 1 : height === plane.elevation);
      if (!covers) continue;
      const chosen = { floor: name, source: plane };
      if (plane.id.kind === "tile") tileFloor = chosen;
      else mapFloor = chosen;
      continue;
    }
    if (!legacyCovers(region, height)) continue;
    const name = floorName(region);
    if (!name) continue;
    mapFloor = { floor: name, source: mapFor(planes, region) };
  }

  const chosen = tileFloor ?? mapFloor;
  return {
    floor: chosen?.floor ?? null,
    blocksWeather,
    blocksLight,
    source: chosen?.source ?? null,
  };
}

function weatherSuppressed(region) {
  for (const behavior of Array.from(region?.behaviors ?? [])) {
    if (behavior?.type === "suppressWeather" && !behavior.disabled) return true;
  }
  return false;
}

export function regionsForSurface(regions, { elevation = 0, action = "", present = false } = {}) {
  const height = Number(elevation);
  const at = Number.isFinite(height) ? height : 0;
  const list = [];
  for (const region of regions ?? []) {
    const own = region?.flags?.animater;
    const bottom = Number(region?.elevation?.bottom);
    const legacyDock = present === true && !own?.imageRegion && own?.overWater === true && Number.isFinite(bottom);
    if (legacyDock && at < bottom && action !== "swim") {
      list.push({ ...region, elevation: { bottom: null, top: region.elevation?.top ?? null } });
    } else {
      list.push(region);
    }
  }
  list.sort((a, b) => (a?.flags?.animater?.overWater === true ? 1 : 0) - (b?.flags?.animater?.overWater === true ? 1 : 0));
  return list;
}

export function weatherSheltered(point, { elevation = 0, regions = [], planes = [], contains, openToSky = false } = {}) {
  if (openToSky) return false;
  const height = elevation == null ? 0 : Number(elevation);
  for (const region of regions ?? []) {
    try {
      if (!weatherSuppressed(region) || !hit(contains, region, point) || !legacyCovers(region, height)) continue;
      return true;
    } catch { }
  }
  return surfaceAt(point, { elevation, regions, planes, contains }).blocksWeather === true;
}

export function indoorPolygonsOf(regions, polygonsOf) {
  const out = [];
  for (const region of regions ?? []) {
    try {
      if (!weatherSuppressed(region)) continue;
      for (const area of polygonsOf(region) ?? []) out.push(area);
    } catch { }
  }
  return out;
}

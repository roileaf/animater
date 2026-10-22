// Room-aware sound: where no acoustics were chosen for the scene, an Animater sound gets reverb that fits the
// space around it, worked out from the walls (a sound sweep from the spot: how closed in, how big). This file is
// the pure part: classify, cache, choose, shape. The sweep itself and the audio wiring live elsewhere.
export const ROOMS = {
  small: { tail: 0.3, send: 0.12 },
  room: { tail: 0.8, send: 0.22 },
  hall: { tail: 1.8, send: 0.32, lowpass: 4000 },
};
// Mostly open to the sky or the far distance: no reverb. Otherwise the size of the space decides (in grid squares).
export function classifyRoom({ openness, area }) {
  if (openness >= 0.5) return 'open';
  if (area < 20) return 'small';
  if (area > 120) return 'hall';
  return 'room';
}
// A sweep polygon (flat x,y list): openness is the share of corners out at the sweep's reach (no wall there),
// area is in grid squares.
export function measurePolygon(points, { origin, radius, tolerance = 2, gridPx = 100 } = {}) {
  const n = Math.floor((points?.length ?? 0) / 2);
  if (n < 3) return { openness: 0, area: 0 };
  let far = 0, twice = 0;
  for (let i = 0; i < n; i++) {
    const x = points[i * 2], y = points[i * 2 + 1], j = (i + 1) % n;
    if (Math.hypot(x - origin.x, y - origin.y) >= radius - tolerance) far++;
    twice += x * points[j * 2 + 1] - points[j * 2] * y;
  }
  return { openness: far / n, area: Math.abs(twice / 2) / (gridPx * gridPx) };
}
// Remembers each grid square's room class, so a square is swept once. bump() forgets them all (walls changed).
export function createRoomCache({ sweep, limit = 500 }) {
  const known = new Map();
  let epoch = 0;
  return {
    classAt(sceneId, levelId, at, gridPx) {
      const gx = Math.floor(at.x / gridPx), gy = Math.floor(at.y / gridPx);
      const key = `${sceneId}|${levelId}|${gx},${gy}|${epoch}`;
      if (known.has(key)) return known.get(key);
      const centre = { x: (gx + 0.5) * gridPx, y: (gy + 0.5) * gridPx };
      let room = null;
      try {
        const points = sweep(centre, levelId);
        if (!points) return null;
        room = classifyRoom(measurePolygon(points, { origin: centre, radius: 30 * gridPx, gridPx }));
      } catch {
        return null;
      }
      known.set(key, room);
      if (known.size > limit) known.delete(known.keys().next().value);
      return room;
    },
    bump() { epoch++; },
  };
}
// How one sound is heard: the GM's choice for the scene wins; else reverb if it happens in the scene being
// viewed, in an enclosed space; else plain.
export function roomFor(data, { sceneAcoustics, viewedScene, enabled, cache, gridPx = 100 } = {}) {
  if (sceneAcoustics) return { kind: 'gm' };
  const at = data?.animaterAt;
  if (!enabled || !cache || !at || data.animaterScene !== viewedScene) return { kind: 'dry' };
  const room = cache.classAt(viewedScene, data.animaterLevel ?? null, at, gridPx);
  return ROOMS[room] ? { kind: 'reverb', room } : { kind: 'dry' };
}
export function reverbSend(room, echoMix = 1) {
  return ROOMS[room] ? ROOMS[room].send * echoMix : 0;
}
// Cut an impulse response to the room's tail, fading the last 30% out so it does not click.
export function shapeImpulse(samples, sampleRate, { tail }) {
  return samples.map((channel) => {
    const n = Math.min(channel.length, Math.round(tail * sampleRate));
    const out = channel.slice(0, n), start = Math.floor(n * 0.7);
    for (let i = start; i < n; i++) out[i] *= 0.5 * (1 + Math.cos(Math.PI * (i - start) / Math.max(1, n - 1 - start)));
    return out;
  });
}

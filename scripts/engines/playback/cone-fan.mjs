// Finite illustrative flights within a native cone. Endpoints are area points,
// never creature hits; selection order and save outcomes cannot change the fan.
export function coneFanPoints(area, count = 5) {
  if (area?.type !== "cone" || !area.endpoint || !(area.length > 0))
    throw Error("A cone fan needs a placed cone area.");
  const angle = Number(area.angle ?? 90);
  if (!(angle > 0 && angle <= 90)) throw Error("A cone fan needs an aperture from 1 to 90 degrees.");
  const rays = Math.max(3, Math.min(9, Math.round(Number(count) || 5)));
  const heading = Math.atan2(area.endpoint.y - area.center.y, area.endpoint.x - area.center.x);
  const half = angle * Math.PI / 360 * .85;
  return Array.from({ length: rays }, (_, i) => {
    const theta = heading - half + 2 * half * i / (rays - 1);
    return { x: area.center.x + Math.cos(theta) * area.length * .9, y: area.center.y + Math.sin(theta) * area.length * .9 };
  });
}

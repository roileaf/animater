// A still layout of a cave area for the floor creator's map. Fungus and crystals are placed with the same
// layout the scene uses. Mist, lava, drips and the rest are named, not drawn. This is not the lit scene.

import { stepFlags, caveLook } from "../engines/motion/region-steps.mjs";
import { fungusIn, crystalsIn, FUNGUS_COLORS, CRYSTAL_STONES } from "../engines/motion/cavern.mjs";
import { regionHasAnimals } from "../engines/motion/region-animals.mjs";
import { worldAreas } from "../engines/regions/area-outline.mjs";

const DRESSING = { webs: "Cobwebs", wet: "Wet walls", steam: "Steam", foul: "Bad air" };
const KIND_BADGE = { mist: "Mist", lava: "Lava" };

const wallRev = (walls) => {
  let n = 0, sum = 0;
  for (const wall of walls ?? []) {
    n++;
    for (const value of wall?.c ?? []) sum += Number(value) || 0;
    sum += Number(wall?.move) || 0;
  }
  return `${n}:${Math.round(sum)}`;
};

function badgesFor(flags, own, look) {
  const badges = [];
  if (look && look.kind !== "fungus" && look.kind !== "crystals") badges.push(KIND_BADGE[look.kind] ?? look.kind);
  if (own.drips) badges.push("Drips");
  if (regionHasAnimals(flags ?? {})) badges.push("Animals");
  if (flags?.roof === true) badges.push("Roof");
  const dressing = DRESSING[flags?.cavern];
  if (dressing) badges.push(dressing);
  return badges;
}

// `walls` may be a function: only crystals need them, so the scene's walls are read only for a crystal cave.
const wallsOf = (walls) => (typeof walls === "function" ? walls() : walls) ?? [];

// The loops are not in the key: the cache below holds the loops array it was laid out for.
function previewKey({ flags = {}, rect, width, height, grid = 100, walls, seed = "cave" } = {}, look) {
  const own = stepFlags(flags ?? {});
  return [look?.kind ?? "", look?.tone ?? "", look?.amount ?? "", look?.scale ?? "", grid, look?.kind === "crystals" ? wallRev(wallsOf(walls)) : "", seed, rect?.x ?? "", rect?.y ?? "", rect?.width ?? "", rect?.height ?? "", width ?? "", height ?? "", own.drips ? 1 : 0, flags?.roof === true ? 1 : 0, flags?.cavern ?? ""].join("|");
}

export function layoutCavePreview(args = {}) {
  const flags = args.flags ?? {};
  const own = stepFlags(flags);
  const look = caveLook(own);
  const grid = args.grid || 100;
  const sized = args.rect?.width > 0 && args.rect?.height > 0 && args.width > 0 && args.height > 0;
  const areas = sized ? worldAreas(args.loops ?? [], args.rect, args.width, args.height) : [];
  const seed = String(args.seed ?? "cave");
  const fungus = look?.kind === "fungus" ? fungusIn(areas, { grid, seed: `${seed}:fungus`, amount: look.amount ?? 1, scale: look.scale ?? 1 }) : [];
  const crystals = look?.kind === "crystals" ? crystalsIn(areas, { walls: wallsOf(args.walls), grid, seed: `${seed}:crystals`, amount: look.amount ?? 1, scale: look.scale ?? 1 }) : [];
  return { look, fungus, crystals, badges: badgesFor(flags, own, look) };
}

// Per proposal. Every outline edit gives the proposal a new loops array, so a moved vertex misses.
const cache = new WeakMap();
export function cachedCavePreview(holder, args) {
  const key = previewKey(args, caveLook(stepFlags(args.flags ?? {})));
  const hit = holder ? cache.get(holder) : null;
  if (hit?.key === key && hit.loops === args.loops) return hit.layout;
  const layout = layoutCavePreview(args);
  if (holder) cache.set(holder, { key, loops: args.loops, layout });
  return layout;
}

const rgb = (channels) => `rgb(${(channels ?? [1, 1, 1]).map((channel) => Math.round(Number(channel) * 255)).join(",")})`;

// Scene coordinates back into read pixels. The read is stretched to the scene rect on each axis.
export function paintCavePreview(ctx, layout, rect, width, height) {
  if (!ctx || !layout || !(rect?.width > 0) || !(rect?.height > 0) || !(width > 0) || !(height > 0)) return;
  const xOf = (x) => (x - rect.x) * width / rect.width;
  const yOf = (y) => (y - rect.y) * height / rect.height;
  ctx.save();
  if (layout.fungus?.length) {
    ctx.fillStyle = rgb(FUNGUS_COLORS[layout.look?.tone]?.[2] ?? FUNGUS_COLORS.green[2]);
    for (const cluster of layout.fungus) {
      for (const cap of cluster.caps ?? []) {
        ctx.beginPath();
        ctx.arc(xOf(cap.x), yOf(cap.y), Math.max(0.4, (cap.r * width) / rect.width), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (layout.crystals?.length) {
    ctx.fillStyle = rgb(CRYSTAL_STONES[layout.look?.tone]?.[0] ?? CRYSTAL_STONES.amethyst[0]);
    for (const cluster of layout.crystals) {
      for (const shard of cluster.shards ?? []) {
        const x = xOf(shard.x), y = yOf(shard.y), len = Math.max(1.2, ((shard.L ?? 0) * width) / rect.width), angle = shard.a ?? 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.lineTo(x + Math.cos(angle + 1.2) * len * 0.35, y + Math.sin(angle + 1.2) * len * 0.35);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

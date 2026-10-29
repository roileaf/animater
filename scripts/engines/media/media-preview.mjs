import { MEDIA_FOOTPRINTS } from "../../../data/media-footprints.mjs";

// Database padding is outside the visible beam. Stretch the visible portion
// between token centers while preserving the complete video's aspect ratio.
export function beamGeometry(distance, width = 1000, height = 400, template) {
  width = Number(width) > 0 ? Number(width) : 1000;
  height = Number(height) > 0 ? Number(height) : 400;
  let start = Math.max(0, Number(template?.[1]) || 0);
  let end = Math.max(0, Number(template?.[2]) || 0);
  if (start + end >= width) start = end = 0;
  const ratio = Math.max(0, distance) / (width - start - end);
  return {
    width: width * ratio,
    height: height * ratio,
    start: start * ratio,
    end: end * ratio,
  };
}

// Art follows the token's occupied footprint. Texture mirroring/oversizing
// belongs to copied token sprites, not rings or impacts placed around them.
// A dynamic-ring token draws its creature at texture scale ÷ subject scale of the footprint: Medium 2 ÷ 2 fills
// its square, Small 1.6 ÷ 2 is 0.8 of it, and a ring sized to the bare square stands off the creature with a gap.
export function tokenFootprint(token, grid = 100) {
  const pixel = (value, squares) =>
    Number(value) > 0
      ? Number(value)
      : (Number(squares) > 0 ? Number(squares) : 1) * grid;
  const doc = token?.document ?? token;
  const texture = Math.abs(Number(doc?.texture?.scaleX)), subject = Number(doc?.ring?.subject?.scale);
  const drawn = doc?.ring?.enabled && texture > 0 && subject > 0 ? Math.min(4, Math.max(0.25, texture / subject)) : 1;
  return Math.max(
    pixel(token?.w, token?.document?.width ?? token?.width),
    pixel(token?.h, token?.document?.height ?? token?.height),
  ) * drawn;
}

export function auraRadius(stage,token){
  const native=token?.actor?.auras?.get?.(stage.auraSlug)??token?.document?.auras?.get?.(stage.auraSlug);
  const radius=native?.radius??token?.auraRadii?.[stage.auraSlug]??stage.auraRadius;
  return Number.isFinite(Number(radius))&&Number(radius)>0?Number(radius):0;
}

// PF2e TokenAura measures reach from mechanical token bounds, not its center.
export function effectFootprint(stage,token,grid=100,gridDistance=5){
  const radius=stage.kind==='aura'?auraRadius(stage,token):0;
  if(!radius)return tokenFootprint(token,grid);
  const width=token?.mechanicalBounds?.width??token?.document?.mechanicalBounds?.width??token?.w??(Number(token?.mechanicalWidth??token?.document?.width??token?.width)||1)*grid;
  return Number(width)+2*radius*grid/(Number(gridDistance)>0?Number(gridDistance):5);
}

export function auraPreviewGrid(recipe,token,width=400,height=300,gridDistance=5){
  const extent=Math.max(1,...recipe.stages.filter(s=>s.kind==='aura'&&auraRadius(s,token)).map(s=>effectFootprint(s,token,1,gridDistance)*s.scale));
  // Leave room for labels, media padding and the scene's top/bottom chrome.
  return Math.min(55,Math.max(1,Math.min(width-48,height-80)/extent));
}

export function offsetInGridSquares(stage, token, grid = 100) {
  const units = stage.offsetUnits === 'token' ? tokenFootprint(token, grid) / grid : 1;
  return {x:(stage.offsetX??0)*units,y:(stage.offsetY??0)*units};
}

export function artworkPaddingScale(media) {
  const filename = String(media?.file ?? "")
    .split(/[\\/]/).at(-1).split(/[?#]/)[0];
  const profile = MEDIA_FOOTPRINTS[filename];
  if (!profile) return 1;
  const [width, height, visibleWidth, visibleHeight] = profile;
  // Keep custom media and changed-resolution files at their authored sizing.
  if ((media.width && Number(media.width) !== width) ||
      (media.height && Number(media.height) !== height)) return 1;
  return Math.max(width, height) / Math.max(visibleWidth, visibleHeight);
}

export function artworkGeometry(size, width, height, media) {
  width = Number(width) > 0 ? Number(width) : 1;
  height = Number(height) > 0 ? Number(height) : width;
  const longest = Math.max(width, height);
  const frameSize = size * artworkPaddingScale(media);
  return {
    width: frameSize * (width / longest),
    height: frameSize * (height / longest),
  };
}

export function artworkSize(size, media) {
  size *= artworkPaddingScale(media);
  return Number(media?.height) > Number(media?.width)
    ? { width: "auto", height: size }
    : { width: size, height: "auto" };
}


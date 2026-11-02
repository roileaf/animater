// Effects on top-down and pop-out tokens: on cut-out art (a creature on a clear background, not a ring token or an
// opaque portrait) an effect sitting on the creature shows only on its body, cropped to the art's own shape, instead
// of across its whole square. A hit or burst, a ward or dome round the creature, an emanation and a mark on the ground
// under it still reach past the body.
import { coverageOf, SOLID_COVERAGE } from '../motion/flier-silhouette.mjs';

// How much bigger than the creature an effect may be drawn and still sit on it: a passing one a little, a lasting one
// (Blaze's flames, drawn half again its size) more.
const ON_CREATURE_SCALE = 1.2, LASTING_ON_CREATURE_SCALE = 2;
// Clips that surround a creature rather than cover it (a ward, shield, bubble, dome or field), and badges, marks and
// borders whose own shape must stay whole (a condition icon, a hunter's mark).
const SURROUNDS = /(?:^|[._])(?:shield|ward|bubble|energy_field|wall_of_force|antilife_shell|protect\w*|sphere|dome|barrier|zoning|template_circle|magic_signs|spirit_guardians|aura_themed|markers|condition|hunters_mark|token_border|icon\w*)(?=$|[._\d])/i;

export function cropsToArt(stage, cutOut) {
  if (!cutOut || !stage || stage.below || stage.auraRadius > 0) return false;
  if (!(stage.kind === 'aura' || (stage.kind === 'impact' && stage.persist === true))) return false;
  if ((stage.assets ?? [stage.asset]).some((a) => SURROUNDS.test(String(a ?? '')))) return false;
  return (Number(stage.scale) || 1) <= (stage.persist ? LASTING_ON_CREATURE_SCALE : ON_CREATURE_SCALE);
}

// `pixels`: the art's RGBA bytes (any small size); `ring`: the token shows a dynamic ring.
export const cutOutArt = ({ ring, pixels }) => !ring && !!pixels?.length && coverageOf(pixels) <= SOLID_COVERAGE;

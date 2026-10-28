// Footage that fills the frame with web, vines, smoke, fog, sparkles, flames, orbs or a shield dome. A lasting
// layer of it drawn over the token buries the creature (an audit measured 40–90% of the face covered), so at
// token size it is drawn under the token: a web binds round the feet, smoke is ground haze, a dome a halo.
// Small or offset layers are deliberate placements (Blinded's blindfold over the eyes) and stay on top, and so does
// a faint layer marked `above` (Shield's force bubble enclosing the creature).
const COVERING=/\.(?:web|vine|entangle|ice_spikes|fog_cloud|ambient_fog|fumes|smoke|sleep\.cloud|darkness|whirlwind|sleet_storm|lightning_ball|lightning_orb|flames|falling_rocks|twinkling_stars|dancing_light|moonbeam|shield\.0\d|template_circle\.(?:whirl|aura)|markers\.(?!chain\.))/;
// Rings that surround the creature without filling the middle: on top of square art they frame the face.
const HOLLOW=/\.(?:token_border|condition\.curse|markers|template_circle|magic_signs\.circle|aura_themed|fire_ring)\./;
export const hollowFootage = asset => HOLLOW.test(`.${String(asset).replace(/^jb2a\./,'')}`);
// Refraction clips bend what lies behind them; their frame is a full square that only reads as a
// ripple under the token. Lifted over the art, the whole frame shows as a pale sheet (Invisible).
// Flames rise from the bearer: under round art only an ember shows past the edge, so the creature does
// not look on fire. They burn over any token at half strength, as filling footage does over square art.
export const risingFlames = asset => /^(?:jb2a\.)?flames\./.test(String(asset));
export const refractionFootage = asset => /refraction/.test(String(asset));
export function coversToken(stage, asset = stage?.asset ?? stage?.assets?.[0] ?? '') {
 if(!stage||stage.below||stage.above||stage.maskToken||(stage.scale??1)<.9||stage.offsetX||stage.offsetY)return false;
 return COVERING.test(`.${String(asset).replace(/^jb2a\./,'')}`);
}
// Built-in defaults describe visible artwork, not its transparent video frame.
// Saved custom recipes keep their authored scale, opacity and placement.
export function statePresentation(design) {
 const asset=design.assets?.[0]??'';
 if(/\.markers\.(?:chain)|\.web\./.test(asset))return {presentationRole:'binding',scale:1.5,opacity:.92,below:false,offsetX:0,offsetY:0};
 // A marker's ring of icons circles the token under its art, wide enough (1.6x) that the icons orbit just outside a
 // round token's art; it never hovers over the head into the next square.
 if(/\.markers\./.test(asset))return {presentationRole:'marker',scale:1.6,opacity:.96,below:true,offsetX:0,offsetY:0};
 // The hex barrier footage fills its frame; it should hug the bearer, not dome over neighbours.
 if(/\.shield\.0\d\./.test(asset))return {presentationRole:'shield',scale:1.15,opacity:.8,below:false,offsetX:0,offsetY:0};
 if(/\.shield_themed\./.test(asset))return {presentationRole:'shield',scale:1.35,opacity:.86,below:false,offsetX:0,offsetY:0};
 // Curse rings read as a hindrance border under the token, sized like token borders.
 if(/\.token_border\.|\.condition\.curse\./.test(asset))return {presentationRole:'border',scale:1.5,opacity:.95,below:true,offsetX:0,offsetY:0};
 if(/\.fumes\.|\.smoke\./.test(asset))return {presentationRole:'haze',scale:1.5,opacity:.68,below:false,offsetX:0,offsetY:0};
 // Hunter's Mark art is a bold opaque icon (eye, paw, glyph) made to flash on a target. Held for a whole
 // effect it is a small badge in the token's top corner, inside its own square, never a sheet over the face.
 if(/\.hunters_mark\./.test(asset))return {presentationRole:'mark',scale:.38,opacity:.9,below:false,offsetX:.3,offsetY:-.3,offsetUnits:'token'};
 if(/\.flames\./.test(asset))return {presentationRole:'flame',scale:1.5,opacity:.82,below:false,offsetX:0,offsetY:0};
 if(/\.aura_themed\.|\.swirling_leaves\./.test(asset))return {presentationRole:'orbit',scale:1.5,opacity:.84,below:false,offsetX:0,offsetY:0};
 // A looping strike is a quiet style cue, not a repeated attack.
 if(/\.(?:claws|bite)\./.test(asset))return {presentationRole:'field',scale:1.2,opacity:.5,below:false,offsetX:0,offsetY:0};
 if(/\.magic_signs\.circle\./.test(asset))return {presentationRole:'field',scale:1.45,opacity:.7,below:true,offsetX:0,offsetY:0};
 if(/\.bless\.|\.condition\.boon\./.test(asset))return {presentationRole:'boon',scale:1.5,opacity:.86,below:true,offsetX:0,offsetY:0};
 // Bearer layers stay within ~1.5x the token so they never swamp adjacent creatures.
 return {presentationRole:'field',scale:1.5,opacity:.82,below:false,offsetX:0,offsetY:0};
}

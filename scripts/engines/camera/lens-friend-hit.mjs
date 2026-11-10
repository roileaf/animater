// The friendly-hit cue on the damage lens: a friend strikes the enemy next to the player's creature, and before the
// enemy's blood lands the blow itself crosses the lens, big, from the friend's side: the weapon's swing or shot, or
// the spell's bolt (JB2A's own clips), then a flinch and a hit flash tinted by what struck.
//
// Each clip was measured frame by frame: `from` (fraction of its length) skips the weapon idling before the swing,
// `hit` is where it connects, `end` a moment after; `at` is the impact point in clip pixels and `span` the visible
// art's width there, so the art (not its mostly empty frame) is what gets sized.

export const FRIEND_HIT_CLIPS = {
  sword: { kind: 'melee', file: 'Library/Generic/Weapon_Attacks/Melee/Sword01_01_Regular_White_800x600.webm', size: [800, 600], from: 0.27, hit: 0.5, end: 0.64, at: [515, 310], span: 472 },
  axe: { kind: 'melee', file: 'Library/Generic/Weapon_Attacks/Melee/GenericSlash01_01_Regular_Orange_800x600.webm', size: [800, 600], from: 0.08, hit: 0.24, end: 0.45, at: [460, 312], span: 336 },
  spear: { kind: 'melee', file: 'Library/Generic/Weapon_Attacks/Melee/Spear01_01_Regular_White_800x600.webm', size: [800, 600], from: 0.3, hit: 0.44, end: 0.58, at: [560, 300], span: 428 },
  mace: { kind: 'melee', file: 'Library/Generic/Weapon_Attacks/Melee/Mace01_01_Regular_White_800x600.webm', size: [800, 600], from: 0.32, hit: 0.5, end: 0.66, at: [490, 330], span: 400 },
  arrow: { kind: 'ranged', file: 'Library/Generic/Weapon_Attacks/Ranged/Arrow01_01_Regular_White_30ft_1600x400.webm', size: [1600, 400], from: 0.18, hit: 0.38, end: 0.5, at: [1370, 194], span: 1246 },
  fire: { kind: 'ranged', file: 'Library/Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_30ft_1600x400.webm', size: [1600, 400], from: 0.12, hit: 0.44, end: 0.75, at: [1400, 202], span: 1180 },
  cold: { kind: 'ranged', file: 'Library/Cantrip/Ray_Of_Frost/RayOfFrost_01_Regular_Blue_30ft_1600x400.webm', size: [1600, 400], from: 0.05, hit: 0.4, end: 0.75, at: [1400, 200], span: 1180 },
  lightning: { kind: 'ranged', file: 'Library/1st_Level/Witch_Bolt/WitchBolt_01_Regular_Blue_30ft_1600x400.webm', size: [1600, 400], from: 0.02, hit: 0.3, end: 0.6, at: [1400, 200], span: 1180 },
  arcane: { kind: 'ranged', file: 'Library/Cantrip/Eldritch_Blast/EldritchBlast_01_Regular_Purple_30ft_1600x400.webm', size: [1600, 400], from: 0.1, hit: 0.45, end: 0.75, at: [1400, 200], span: 1180 },
};
// Where JB2A lives: the Patreon module first, then the free one (the same Library layout).
export const JB2A_MODULES = ['jb2a_patreon', 'JB2A_DnD5e'];

const PHYSICAL = new Set(['slashing', 'piercing', 'bludgeoning', 'physical', 'bleed']);
const SPELL_BY_TYPE = { fire: 'fire', cold: 'cold', electricity: 'lightning', lightning: 'lightning', thunder: 'lightning', sonic: 'lightning' };
const MELEE_BY_NAME = [[/spear|pike|lance|trident|halberd|glaive|ranseur|guisarme|javelin|rapier|estoc|dagger|stiletto|pick|horn|tusk/, 'spear'],
  [/mace|hammer|club|maul|flail|morningstar|staff|cudgel|sap|fist|unarmed|gauntlet|knuckle|warhammer|tail|slam/, 'mace'],
  [/axe|scythe|sickle|cleaver|claw|talon|jaws?/, 'axe'],
  [/sword|blade|katana|scimitar|falchion|saber|sabre|machete|kukri|khopesh|shortsword|longsword|greatsword/, 'sword']];
const RANGED_BY_NAME = /bow|arrow|crossbow|dart|sling|shuriken|thrown|javelin|gun|pistol|musket|rifle/;
const SHOT_WEAPON = /bow\b|crossbow|sling|arrow|pistol|musket|rifle|firearm/;
const SPELL_BY_NAME =[[/fire|flame|burn|scorch|ignit|inferno|ember/, 'fire'], [/frost|ice|cold|freez|chill|snow/, 'cold'],
  [/lightning|shock|electr|thunder|storm|witch bolt|spark/, 'lightning'], [/eldritch|force|magic missile|arcane|blast/, 'arcane']];

// Which clip stands for the blow, from what the damage log knows of it: its attack kind (melee, ranged, spell,
// other), its damage type(s) and the item's name or slug. Null when nothing is known of it at all.
export function friendHitClip({ attackKind = null, type = null, types = [], itemName = '', itemSlug = '' } = {}) {
  const name = `${itemName ?? ''} ${itemSlug ?? ''}`.toLowerCase().replace(/-/g, ' ');
  const all = [type, ...(types ?? [])].filter(Boolean).map((t) => String(t).toLowerCase());
  const energy = all.find((t) => !PHYSICAL.has(t)) ?? null, physical = all.find((t) => PHYSICAL.has(t)) ?? null;
  const spell = () => SPELL_BY_NAME.find(([re]) => re.test(name))?.[1] ?? SPELL_BY_TYPE[energy] ?? 'arcane';
  const melee = () => MELEE_BY_NAME.find(([re]) => re.test(name))?.[1] ?? { piercing: 'spear', bludgeoning: 'mace' }[physical] ?? 'sword';
  if (attackKind === 'spell') return spell();
  if (attackKind === 'ranged') return RANGED_BY_NAME.test(name) || physical || !energy ? 'arrow' : spell();
  // D&D counts every weapon as melee: a bow is still a shot.
  if (attackKind === 'melee') return SHOT_WEAPON.test(name) ? 'arrow' : melee();
  if (!name.trim() && !all.length) return null;
  if (RANGED_BY_NAME.test(name)) return 'arrow';
  if (energy && !physical) return spell();
  return melee();
}

// A friend's blow: someone other than the player's own creature next to the enemy struck it, and they stand on the
// same side (the same disposition, never a hostile one; a creature the player owns counts too).
export function isFriendlyHit({ attacker, near }) {
  const a = attacker, n = near?.token ?? near;
  if (!a || !n || a === n || a.id === n.id) return false;
  if (a.actor?.isOwner) return true;
  const da = a.document?.disposition, dn = n.document?.disposition;
  return typeof da === 'number' && da === dn && da >= 0;
}

// The clip's place on the screen: much bigger than the blow on the map, as if it passed just in front of the camera,
// its impact point on the enemy and turned to come from the friend. A swing's art about the screen's height across;
// a shot sized by its projectile, its path running in from well past the edge.
export function friendHitPlacement(clip, { from, to, view }) {
  const W = view?.width || 1, H = view?.height || 1, [cw, ch] = clip.size;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const k = clip.kind === 'melee' ? (H * 0.95) / clip.span : Math.max((Math.hypot(W, H) * 0.75) / clip.span, (H * 0.7) / ch);
  const r = (v) => Math.round(v * 100) / 100;
  return { angle, scale: k, width: r(cw * k), height: r(ch * k),
    transform: `translate(${r(to.x)}px,${r(to.y)}px) rotate(${r(angle * 1000) / 1000}rad) translate(${r(-clip.at[0] * k)}px,${r(-clip.at[1] * k)}px)` };
}

// The hit flash's tint by damage type.
export const flashTint = (type) => ({ fire: '255,170,80', cold: '170,220,255', electricity: '200,225,255', lightning: '200,225,255', force: '210,170,255', acid: '190,255,140', poison: '190,255,140' }[type] ?? '255,245,225');

/**
 * Plays cues over the board, under the lens blood. play({ clip, url, from, to, view, type, onHit }) calls onHit once
 * when the blow connects, at once if the clip cannot play (missing file, the page hidden), and resolves when done.
 */
export function createFriendHitPlayer({ doc = globalThis.document, win = globalThis.window, reducedMotion = () => false } = {}) {
  let layer = null, flash = null, current = null;
  const node = () => {
    if (layer?.isConnected) return layer;
    layer = doc.createElement('div');
    layer.id = 'animater-lens-friend-hit';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;';
    flash = doc.createElement('div');
    flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;';
    layer.append(flash);
    // Right over the canvas, under the lens blood and Foundry's interface.
    const board = doc.getElementById('board');
    if (board) board.after(layer); else doc.body.append(layer);
    return layer;
  };
  const stop = () => { current?.(false); current = null; };
  const play = ({ clip, url, from, to, view, type = null, onHit = () => {} }) => new Promise((resolve) => {
    stop();
    let landed = false, done = false;
    const land = () => {
      if (landed) return; landed = true;
      try { onHit(); } catch (error) { console.warn('Animater | friendly hit', error); }
    };
    // Stopped (stop()), it goes without landing; otherwise the blow always lands.
    const finish = (landIt = true) => { if (done) return; done = true; if (current === finish) current = null; if (landIt !== false) land(); video?.remove(); clearTimeout(guard); clearInterval(ticker); resolve(); };
    if (!clip || !url || !from || !to || doc.hidden) { finish(); return; }
    node();
    const place = friendHitPlacement(clip, { from, to, view });
    var video = doc.createElement('video');
    Object.assign(video, { muted: true, playsInline: true, preload: 'auto', src: url });
    // Foundry caps every video at max-width:100%: a shot's clip is wider than the screen, and squashed its impact
    // point landed short of the target. Its exact size, uncapped and unfitted.
    video.style.cssText = `position:absolute;left:0;top:0;max-width:none;max-height:none;min-width:0;min-height:0;object-fit:fill;margin:0;padding:0;border:0;transform-origin:0 0;mix-blend-mode:screen;opacity:0;width:${place.width}px;height:${place.height}px;transform:${place.transform};filter:drop-shadow(0 0 18px rgba(255,255,255,.25));`;
    layer.append(video);
    current = finish;
    // Never holds the blood back long: a clip that will not start in time is dropped.
    var guard = setTimeout(finish, 1500);
    const hitAt = () => {
      landed || land();
      const board = doc.getElementById('board');
      if (!reducedMotion()) {
        // The flinch: the view knocked a few pixels away from the blow, settling back.
        const kx = Math.cos(place.angle) * 12, ky = Math.sin(place.angle) * 12;
        board?.animate?.([{ translate: '0 0' }, { translate: `${kx}px ${ky}px` }, { translate: `${-kx * 0.35}px ${-ky * 0.35}px` }, { translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
      const tint = flashTint(type);
      flash.style.background = `radial-gradient(circle at ${to.x}px ${to.y}px, rgba(${tint},.7) 0, rgba(${tint},.22) 90px, rgba(${tint},0) 260px)`;
      flash.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
    };
    // Watched on a timer, not animation frames: those stop when the window is in the background, the video does not.
    let out = false;
    var ticker; // eslint-disable-line no-var -- finish() may run before this line (a clip that cannot play)
    const watch = () => {
      if (done || !video.isConnected) return clearInterval(ticker);
      const f = video.duration ? video.currentTime / video.duration : 0;
      if ((f >= clip.hit || video.ended) && !landed) hitAt();
      if ((f >= clip.end || video.ended) && !out) {
        out = true; clearInterval(ticker);
        const fade = video.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
        if (fade) { fade.onfinish = finish; setTimeout(finish, 400); } else finish();
      }
    };
    video.addEventListener('error', finish, { once: true });
    video.addEventListener('playing', () => { clearTimeout(guard); guard = setTimeout(finish, 4000); video.style.transition = 'opacity 60ms'; video.style.opacity = '1'; ticker = setInterval(watch, 16); }, { once: true });
    video.addEventListener('loadedmetadata', () => {
      try { video.currentTime = video.duration * clip.from; } catch { /* plays from the start */ }
      void video.play?.()?.catch?.(finish);
    }, { once: true });
  });
  return { play, stop, get playing() { return current !== null; }, destroy: () => { stop(); layer?.remove(); layer = null; } };
}

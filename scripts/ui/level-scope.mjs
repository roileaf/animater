// Where a panel's changes go in a scene with levels: the level being looked at, or the whole scene. A level's own settings come first; whatever it leaves alone it takes from its scene.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// `scope` { multi, mode: 'level' | 'scene', name the level's, own whether it has settings of its own }. Nothing in a scene with one level.
export function scopeBar(scope) {
  if (!scope?.multi) return '';
  const chip = (mode, label) => `<button type="button" class="${scope.mode === mode ? 'is-active' : ''}" data-action="setScope" data-value="${mode}" aria-pressed="${scope.mode === mode}">${esc(label)}</button>`;
  const clear = scope.mode === 'level' && scope.own ? '<button type="button" class="animater-wx-link" data-action="clearLevel" data-tooltip="Everything set for this level goes back to what the scene has.">Use the scene\'s</button>' : '';
  return `<section class="animater-wx-section animater-wx-scope"><span>Changes apply to</span><div class="animater-wx-scope-chips" role="group" aria-label="Changes apply to">${chip('level', `This level: ${scope.name ?? ''}`)}${chip('scene', 'Whole scene')}</div>${clear}</section>`;
}

// The settings in force, a level's over its scene's (pure): `keys` those a level can have, null or absent leaving it to the scene.
export function overLevel(sceneFlags = {}, levelFlags = {}, keys = []) {
  const out = { ...(sceneFlags ?? {}) };
  for (const key of keys) { const own = levelFlags?.[key]; if (own !== null && own !== undefined) out[key] = own; }
  return out;
}
// Whether a level has any of them (pure).
export const hasOwn = (levelFlags = {}, keys = []) => keys.some((key) => levelFlags?.[key] !== null && levelFlags?.[key] !== undefined);
// What takes them all back to the scene's (pure): each one it has, cleared.
export const clearedOwn = (levelFlags = {}, keys = []) => Object.fromEntries(keys.filter((key) => levelFlags?.[key] !== null && levelFlags?.[key] !== undefined).map((key) => [key, null]));

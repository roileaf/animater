// Energy Blasts of the GM's own: a kind it is built on (how it moves, what it leaves on the floor) with its own name,
// colours, size, what it does to the creatures it catches (one of the reactions, or any Tokenshade preset), its sound
// (any kind's, or a file) and its shake. Kept for the world in a setting; a blast fired carries its own whole, so every
// screen draws it alike.
import { BLAST_TYPES, blastShake, AIM_LEAST, AIM_MOST } from './energy-blast.mjs';
import { BLAST_REACTIONS } from './blast-reactions.mjs';

const KINDS = BLAST_TYPES.map((t) => t.id);
const HEX = /^#[0-9a-f]{6}$/i;
// What it does to the creatures it catches, as the editor lists it.
export const VARIANT_REACTIONS = Object.freeze({ auto: 'As its kind', none: 'Nothing', burn: 'Burn', frost: 'Frost', shock: 'Shock', shove: 'Shove', tremble: 'Tremble', preset: 'A Tokenshade preset' });
export const VARIANT_SHAKES = Object.freeze({ auto: 'As its kind', none: 'None', light: 'Light', heavy: 'Heavy' });
const SHAKE_HARD = { light: 0.5, heavy: 1.4 };
// A sound file: a path in Foundry's data, never an address that runs something.
const safeFile = (f) => (typeof f === 'string' && /^[\w\-./ %()[\]']+\.(ogg|mp3|wav|webm|m4a|flac|opus)$/i.test(f) && !f.includes('..') ? f : '');
const idOf = (raw) => (typeof raw === 'string' && /^[a-z0-9-]{1,40}$/.test(raw) ? raw : `blast-${Math.random().toString(36).slice(2, 10)}`);

// Whatever was saved or sent, made safe (pure).
export function cleanVariant(raw = {}) {
  const base = KINDS.includes(raw?.base) ? raw.base : 'fire';
  const squares = Number(raw?.squares);
  const sound = raw?.sound === 'none' || raw?.sound === 'file' || (typeof raw?.sound === 'string' && raw.sound.startsWith('kind:') && KINDS.includes(raw.sound.slice(5))) ? raw.sound : 'auto';
  return {
    id: idOf(raw?.id), name: String(raw?.name ?? '').trim().slice(0, 40) || 'My blast', base,
    a: HEX.test(raw?.a ?? '') ? raw.a.toLowerCase() : null, b: HEX.test(raw?.b ?? '') ? raw.b.toLowerCase() : null,
    squares: Number.isFinite(squares) && squares > 0 ? Math.min(AIM_MOST, Math.max(AIM_LEAST, squares)) : null,
    reaction: Object.hasOwn(VARIANT_REACTIONS, raw?.reaction) ? raw.reaction : 'auto',
    preset: typeof raw?.preset === 'string' ? raw.preset.slice(0, 80) : '', presetLibrary: typeof raw?.presetLibrary === 'string' && /^[\w-]{1,40}$/.test(raw.presetLibrary) ? raw.presetLibrary : '',
    sound, file: sound === 'file' ? safeFile(raw?.file) : '',
    shake: Object.hasOwn(VARIANT_SHAKES, raw?.shake) ? raw.shake : 'auto',
    melts: raw?.melts === undefined ? base === 'fire' : raw.melts === true,
  };
}
export const cleanVariants = (list) => { const seen = new Set(); return (Array.isArray(list) ? list : []).slice(0, 60).map(cleanVariant).filter((v) => !seen.has(v.id) && seen.add(v.id)); };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
// How it looks (pure): its kind's shader in its colours; given any colour of its own, recoloured all over (fire's flames
// and smoke too, which the kinds draw in fixed colours).
export function variantLook(v) {
  const type = BLAST_TYPES.find((t) => t.id === v.base) ?? BLAST_TYPES[0], own = !!(v.a || v.b);
  return { kind: type.id, a: v.a ? rgb(v.a) : type.a, b: v.b ? rgb(v.b) : type.b, recolor: own ? 1 : 0 };
}
// What it does to the caught (pure): { reaction (a reaction's id or null), preset ({ name, library } or null) }.
export function variantReaction(v) {
  if (v.reaction === 'auto') return { reaction: BLAST_REACTIONS[v.base] ?? null, preset: null };
  if (v.reaction === 'preset') return { reaction: null, preset: v.preset ? { name: v.preset, library: v.presetLibrary || 'tokenshade' } : null };
  return { reaction: v.reaction === 'none' ? null : v.reaction, preset: null };
}
// Its sound (pure): { kind (whose blast sound plays) or null, file or null }.
export function variantSound(v) {
  if (v.sound === 'none') return { kind: null, file: null };
  if (v.sound === 'file') return v.file ? { kind: null, file: v.file } : { kind: v.base, file: null };
  return { kind: v.sound.startsWith('kind:') ? v.sound.slice(5) : v.base, file: null };
}
export const variantShake = (v, big = false) => (v.shake === 'auto' ? blastShake(v.base, big) : v.shake === 'none' ? [] : blastShake(v.base, big, SHAKE_HARD[v.shake]));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexOf = (c) => `#${c.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
const opt = (value, label, now) => `<option value="${esc(value)}"${value === now ? ' selected' : ''}>${esc(label)}</option>`;
// The editor's form (pure). `presets` Tokenshade's [{ name, library }].
export function variantEditorHtml(v, { presets = [] } = {}) {
  const type = BLAST_TYPES.find((t) => t.id === v.base) ?? BLAST_TYPES[0], kinds = BLAST_TYPES.map((t) => opt(t.id, t.name, v.base)).join('');
  const presetNow = v.preset ? `${v.presetLibrary || 'tokenshade'}|${v.preset}` : '';
  const presetList = presets.length ? `<select name="preset">${opt('', 'Pick one…', presetNow)}${presets.map((p) => opt(`${p.library}|${p.name}`, p.library === 'tokenshade' ? p.name : `${p.name} (${p.library})`, presetNow)).join('')}</select>` : '<span class="hint">Tokenshade is not on, so its presets are not listed.</span><input type="hidden" name="preset" value="">';
  const sounds = [opt('auto', `As ${type.name}`, v.sound), ...BLAST_TYPES.filter((t) => t.id !== v.base).map((t) => opt(`kind:${t.id}`, `As ${t.name}`, v.sound)), opt('file', 'A file…', v.sound), opt('none', 'Silent', v.sound)].join('');
  const row = (label, field, hint = '') => `<div class="form-group"><label>${esc(label)}</label><div class="form-fields">${field}</div>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
  return `<div class="animater-blast-edit">
    <div class="animater-blast-swatch" data-swatch style="--a:${esc(v.a ?? hexOf(type.a))};--b:${esc(v.b ?? hexOf(type.b))}" aria-hidden="true"></div>
    ${row('Name', `<input type="text" name="name" value="${esc(v.name)}" maxlength="40">`)}
    ${row('Based on', `<select name="base">${kinds}</select>`, 'How it moves and what it leaves on the floor.')}
    ${row('Main colour', `<input type="color" name="a" value="${esc(v.a ?? hexOf(type.a))}">`)}
    ${row('Highlight', `<input type="color" name="b" value="${esc(v.b ?? hexOf(type.b))}">`, 'Recolours all of it, fire\'s flames and smoke too.')}
    ${row('Size', `<input type="number" name="squares" min="${AIM_LEAST}" max="${AIM_MOST}" step="0.5" value="${v.squares ?? ''}" placeholder="As last used">`, 'In squares from its middle; scroll still changes it as you aim.')}
    ${row('On creatures', `<select name="reaction">${Object.entries(VARIANT_REACTIONS).map(([k, l]) => opt(k, k === 'auto' ? `As ${type.name}` : l, v.reaction)).join('')}</select>`)}
    ${row('Tokenshade preset', presetList, 'Played on each creature it catches, when On creatures says a preset.')}
    ${row('Sound', `<select name="sound">${sounds}</select>`)}
    ${row('Sound file', `<input type="text" name="file" value="${esc(v.file)}" placeholder="modules/animater/assets/sounds/…"><button type="button" data-action="pickFile" data-tooltip="Browse Animater's sounds or your own"><i class="fa-solid fa-file-audio" inert></i></button>`, 'When Sound says a file.')}
    ${row('Shake', `<select name="shake">${Object.entries(VARIANT_SHAKES).map(([k, l]) => opt(k, k === 'auto' ? `As ${type.name}` : l, v.shake)).join('')}</select>`)}
    ${row('Melts snow', `<input type="checkbox" name="melts"${v.melts ? ' checked' : ''}>`)}
  </div>`;
}

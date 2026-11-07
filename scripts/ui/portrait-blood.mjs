// Blood on a creature's portrait (the "Blood on portraits" setting): its character sheet's picture and Image Hover's, more of it the more it is hurt, in its own blood colour. Only drawn over the picture on this screen: nothing is saved.

const CLASS = 'animater-portrait-blood';
// (Its sheet's, and the PF2e HUD's portrait of the selected creature.)
const SHEET_IMAGES = 'img[data-edit="img"], img.profile, img.profile-img, img.actor-image, .actor-image img, .profile-img img, [data-panel="portrait"] .avatar .image';

// How much blood shows (pure), 0 to 1: none at three quarters of its HP or better, all of it once down.
export function portraitBloodLevel(hp) {
  if (!hp) return 0;
  if (hp.down === true) return 1;
  const max = Number(hp.max), value = Number(hp.value);
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, (0.75 - value / max) / 0.75)) * 8) / 8;
}

const seeded = (seed) => { let h = 2166136261; for (const c of String(seed)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// A blood colour as the canvas wants it (pure): the module keeps them as numbers or as strings.
export const bloodCss = (color) => { if (Number.isFinite(color)) return `#${(Number(color) & 0xffffff).toString(16).padStart(6, '0')}`; const text = String(color ?? ''); return /^#?[0-9a-f]{6}$/i.test(text) ? (text.startsWith('#') ? text : `#${text}`) : '#7a0d0d'; };

// Where each mark lies (pure), from the creature's id, so its wounds stay where they are as it is hurt more: { blots, specks }, in 0 to 1 of the picture.
export function portraitMarks(seed, level) {
  const random = seeded(seed), blots = [], specks = [], most = 6;
  for (let i = 0; i < most; i++) {
    const blot = { x: 0.16 + random() * 0.68, y: 0.14 + random() * 0.56, r: 0.035 + random() * 0.06, edge: Array.from({ length: 22 }, () => random()), way: random() * Math.PI * 2, runs: [random(), random()], flecks: Array.from({ length: 14 }, () => [random(), random(), random()]) };
    if ((i + 1) / most <= level + 0.001) blots.push(blot);
  }
  const shown = Math.round(level * 30);
  for (let i = 0; i < 30; i++) { const speck = { x: random(), y: random(), r: 0.002 + random() * random() * 0.009 }; if (i < shown) specks.push(speck); }
  return { blots, specks };
}

// A darker shade of the same blood, where it lies thick.
const thick = (css) => { const n = parseInt(css.slice(1), 16), part = (s) => Math.round(((n >> s) & 255) * 0.55).toString(16).padStart(2, '0'); return `#${part(16)}${part(8)}${part(0)}`; };

// The marks drawn: a wet patch with an uneven edge, thick at its heart, thrown out in flecks to one side where the blow landed, and running down.
function paint(document, seed, level, color) {
  const size = 320, canvas = document.createElement('canvas'), css = bloodCss(color), dark = thick(css);
  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d'), { blots, specks } = portraitMarks(seed, level);
  g.lineCap = 'round';
  const patch = (b, scale, fill, alpha) => {
    g.fillStyle = fill; g.globalAlpha = alpha; g.beginPath();
    b.edge.forEach((n, i) => { const a = (i / b.edge.length) * Math.PI * 2, r = b.r * size * scale * (0.55 + n * 0.75), x = b.x * size + Math.cos(a) * r, y = b.y * size + Math.sin(a) * r * 0.9; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath(); g.fill();
  };
  for (const b of blots) {
    const x = b.x * size, y = b.y * size, r = b.r * size;
    patch(b, 1.25, css, 0.5); patch(b, 0.85, css, 0.8); patch(b, 0.5, dark, 0.75);
    // Thrown out from the blow, the far ones small and long.
    g.fillStyle = css;
    for (const [spread, far, big] of b.flecks) {
      const a = b.way + (spread - 0.5) * 1.5, d = r * (1.3 + far * far * 3.6), s = Math.max(0.7, r * (0.03 + big * 0.14) * (1.1 - far * 0.7));
      g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, s * (1 + far * 1.8), s, a, 0, Math.PI * 2); g.fill();
    }
    // Running down, thinning as it goes.
    g.strokeStyle = css;
    for (const n of b.runs) { const from = x + (n - 0.5) * r * 1.2, to = y + r * (1.2 + n * 3.2), width = Math.max(1, r * (0.07 + n * 0.09)); g.globalAlpha = 0.72; g.lineWidth = width; g.beginPath(); g.moveTo(from, y); g.quadraticCurveTo(from + (n - 0.5) * 3, (y + to) / 2, from + (n - 0.5) * 2, to); g.stroke(); g.fillStyle = css; g.beginPath(); g.ellipse(from + (n - 0.5) * 2, to, width * 0.75, width * 1.15, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = css; g.globalAlpha = 0.8;
  for (const d of specks) { g.beginPath(); g.arc(d.x * size, d.y * size, Math.max(0.6, d.r * size), 0, Math.PI * 2); g.fill(); }
  return canvas.toDataURL('image/png');
}

const painted = new Map();
const marksFor = (document, seed, level, color) => { const key = `${seed}|${level}|${color}`; let url = painted.get(key); if (!url) { if (painted.size > 40) painted.clear(); url = paint(document, seed, level, color); painted.set(key, url); } return url; };

// Over `holder`, whose box the marks fill. level 0 takes them away.
export function showPortraitBlood(holder, { level = 0, color = '#7a0d0d', seed = '' } = {}) {
  if (!holder) return null;
  const had = holder.querySelector?.(`:scope > .${CLASS}`);
  if (!(level > 0)) { had?.remove(); return null; }
  const document = holder.ownerDocument, mark = had ?? document.createElement('div');
  mark.className = CLASS;
  mark.setAttribute('aria-hidden', 'true');
  mark.style.backgroundImage = `url("${marksFor(document, seed, level, color)}")`;
  if (!had) holder.append(mark);
  return mark;
}

// A sheet's picture, within whatever holds it (the marks cover just the picture, not its frame).
export function bloodOnSheet(root, options = {}) {
  for (const img of root?.querySelectorAll?.(SHEET_IMAGES) ?? []) {
    const picture = img.tagName === 'IMG' || img.tagName === 'VIDEO' ? img : img.querySelector?.('img');
    const holder = picture?.parentElement;
    if (!holder) continue;
    if (options.level > 0 && root.ownerDocument.defaultView?.getComputedStyle?.(holder).position === 'static') holder.classList.add('animater-portrait-holder');
    showPortraitBlood(holder, options);
    return true;
  }
  return false;
}

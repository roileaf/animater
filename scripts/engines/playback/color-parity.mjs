// When a recipe's first-choice film is missing (typically JB2A Free) and the
// installed fallback has a clearly different hue, colorize the fallback to the
// first choice's color so fire stays orange, acid green and void purple.
const HUES = { red: 0, orange: 30, brown: 28, gold: 45, yellow: 55, green: 120, teal: 175, blue: 220, purple: 275, pink: 320 };
const HEX = { red: '#e8564b', orange: '#ff9a4d', brown: '#b48b60', gold: '#f0c24a', yellow: '#f6dc5c', green: '#7fd36b', teal: '#5ccfc2', blue: '#5fa8ff', purple: '#a874ee', pink: '#f08fcf' };
const NEUTRAL = /^(?:white|grey|gray|black|silver|rainbow|multicolou?red|textured)$/;
const BASES = [...Object.keys(HUES), 'white', 'grey', 'gray', 'black', 'silver'].sort((a, b) => b.length - a.length);
function firstHue(token) {
  let rest = String(token).toLowerCase().replace(/^(?:dark|bright|light)_?/, '');
  while (rest) {
    const base = BASES.find(b => rest.startsWith(b));
    if (!base) return null;
    if (base in HUES) return base;
    rest = rest.slice(base.length);
  }
  return null;
}
function keyHue(key) {
  const parts = String(key ?? '').toLowerCase().split('.');
  for (let i = parts.length - 1; i >= 0; i--) {
    if (NEUTRAL.test(parts[i])) return 'neutral';
    const hue = firstHue(parts[i]);
    if (hue) return hue;
  }
  return null;
}
const distance = (a, b) => { const d = Math.abs(HUES[a] - HUES[b]) % 360; return d > 180 ? 360 - d : d; };
export function fallbackColorParity(stage, asset) {
  const intended = stage?.assets?.[0];
  if (!asset || !intended || asset === intended || asset.startsWith(intended + '.')) return {};
  if (stage.tintEnabled || stage.hue || stage.saturation) return {};
  const want = keyHue(intended), have = keyHue(asset);
  // A hued first choice falling back to grey/white footage (e.g. toxic green
  // fumes → grey smoke) is recolored too; unknown or neutral first choices are not.
  if (!want || want === 'neutral' || !have || have !== 'neutral' && distance(want, have) < 60) return {};
  return { tintEnabled: true, colorize: true, tint: HEX[want] };
}

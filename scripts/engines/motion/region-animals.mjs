// Animals of a region's own (Region configuration → Animater → Animals in this region): they live inside it and keep to
// it, on top of whatever the scene has. The scene's outdoor kinds, the town's four (without turning on town life), farm
// animals (farm-life.mjs), rats and bats. Kept in the region's flags: regionAnimals { kind: amount }, regionAnimalSize.

export const REGION_ANIMAL_GROUPS = Object.freeze([
  ['Open ground', [['rabbits', 'Rabbits'], ['wildBirds', 'Birds'], ['deer', 'Deer'], ['foxes', 'Foxes'], ['wolves', 'Wolves'], ['squirrels', 'Squirrels'], ['snakes', 'Snakes'], ['insects', 'Insects'], ['owls', 'Owls']]],
  ['Water', [['fish', 'Fish'], ['waterBirds', 'Water birds'], ['frogs', 'Frogs']]],
  ['Town', [['pigeons', 'Pigeons'], ['hens', 'Hens'], ['cats', 'Cats'], ['dogs', 'Dogs']]],
  ['Farm', [['cows', 'Cows'], ['goats', 'Goats'], ['sheep', 'Sheep'], ['pigs', 'Pigs'], ['horses', 'Horses']]],
  ['Dark places', [['rats', 'Rats'], ['bats', 'Bats']]],
]);
const KINDS = REGION_ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k));
export const REGION_AMOUNTS = Object.freeze([['', 'None'], ['few', 'Few'], ['usual', 'Usual'], ['more', 'More'], ['many', 'Many']]);
const SHARE = { few: 0.5, usual: 1, more: 1.6, many: 2.5 };
// How many "usual" is, each kind, in one region.
const USUAL = { rabbits: 3, wildBirds: 4, deer: 3, foxes: 1, wolves: 3, squirrels: 2, snakes: 1, insects: 4, owls: 1, fish: 4, waterBirds: 3, frogs: 3, pigeons: 6, hens: 3, cats: 1, dogs: 1, cows: 3, goats: 4, sheep: 6, pigs: 3, horses: 2, rats: 5, bats: 3 };
// Just one, however many asked: an owl.
const ONE = new Set(['owls']);

const amountOf = (own, kind) => { const a = own?.regionAnimals?.[kind]; return Object.hasOwn(SHARE, a ?? '') ? a : ''; };
// How many of each kind (pure): every kind, 0 where none is asked.
export function regionAnimalCounts(own = {}) {
  const out = {};
  for (const kind of KINDS) { const a = amountOf(own, kind); out[kind] = !a ? 0 : ONE.has(kind) ? 1 : Math.max(1, Math.round(USUAL[kind] * SHARE[a])); }
  return out;
}
export const regionHasAnimals = (own = {}) => KINDS.some((k) => amountOf(own, k));
// The town's animals come in a quiet or a busy town's numbers: busy once any of them asks for more.
export const townLevelOf = (own = {}) => (['pigeons', 'hens', 'cats', 'dogs'].some((k) => ['more', 'many'].includes(amountOf(own, k))) ? 'busy' : 'quiet');
// How big they are, as a number (a slider): saved as 0.5 to 2. The words it was once saved as, small and big, still read as they did.
export const ANIMAL_SIZE = Object.freeze({ min: 0.5, max: 2, step: 0.05 });
export const animalSizeOf = (own) => {
  const v = own?.regionAnimalSize, word = { small: 0.75, big: 1.3 }[v];
  if (word) return word;
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(ANIMAL_SIZE.max, Math.max(ANIMAL_SIZE.min, n)) : 1;
};
export const regionAnimalSize = (own = {}) => animalSizeOf(own);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The region's settings (pure): a row of amounts for each kind, as chips (radio buttons), saved with the region by its form.
export function regionAnimalsHtml(own = {}, id = 'animater') {
  const chips = (name, now, choices) => `<div class="animater-region-chips">${choices.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}"${v === now ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  const rows = REGION_ANIMAL_GROUPS.map(([group, list]) => `<h4>${esc(group)}</h4>${list.map(([kind, label]) => `<div class="form-group animater-region-animal"><label>${esc(label)}</label>${chips(`flags.${id}.regionAnimals.${kind}`, amountOf(own, kind), REGION_AMOUNTS)}</div>`).join('')}`).join('');
  const size = own?.regionAnimalSize === 'small' || own?.regionAnimalSize === 'big' ? own.regionAnimalSize : '';
  return `<fieldset class="animater-region-animals"><legend>Animals in this region</legend>
    <p class="hint">They live here and stay inside it, besides the scene's own animals. Scared out, they come back once it is quiet. Each screen has its own; nothing is saved as they move.</p>
    ${rows}
    <div class="form-group animater-region-animal"><label>Their size</label>${chips(`flags.${id}.regionAnimalSize`, size, [['small', 'Small'], ['', 'Usual'], ['big', 'Big']])}</div>
  </fieldset>`;
}

// Animals of a region's own (Region configuration → Animater → Animals in this region): they live inside it and keep to
// it, on top of whatever the scene has. The scene's outdoor kinds, the town's four (without turning on town life), farm
// animals (farm-life.mjs), rats and bats. Kept in the region's flags: regionAnimals { kind: amount }, regionAnimalSize.

export const REGION_ANIMAL_GROUPS = Object.freeze([
  ['Open ground', [['rabbits', 'Rabbits'], ['wildBirds', 'Birds'], ['crows', 'Crows'], ['hawks', 'Hawks'], ['deer', 'Deer'], ['foxes', 'Foxes'], ['wolves', 'Wolves'], ['squirrels', 'Squirrels'], ['snakes', 'Snakes'], ['insects', 'Insects'], ['owls', 'Owls']]],
  ['Water', [['fish', 'Fish'], ['waterBirds', 'Ducks'], ['herons', 'Herons'], ['gulls', 'Gulls'], ['frogs', 'Frogs']]],
  ['Town', [['pigeons', 'Pigeons'], ['hens', 'Hens'], ['cats', 'Cats'], ['dogs', 'Dogs']]],
  ['Farm', [['cows', 'Cows'], ['goats', 'Goats'], ['sheep', 'Sheep'], ['pigs', 'Pigs'], ['horses', 'Horses']]],
  ['Dark places', [['rats', 'Rats'], ['bats', 'Bats']]],
]);
const KINDS = REGION_ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k));
export const REGION_AMOUNTS = Object.freeze([['', 'None'], ['few', 'Few'], ['usual', 'Usual'], ['more', 'More'], ['many', 'Many']]);
const SHARE = { few: 0.5, usual: 1, more: 1.6, many: 2.5 };
// How many "usual" is, each kind, in one region.
const USUAL = { crows: 3, hawks: 1, herons: 1, gulls: 2, rabbits: 3, wildBirds: 4, deer: 3, foxes: 1, wolves: 3, squirrels: 2, snakes: 1, insects: 4, owls: 1, fish: 4, waterBirds: 3, frogs: 3, pigeons: 6, hens: 3, cats: 1, dogs: 1, cows: 3, goats: 4, sheep: 6, pigs: 3, horses: 2, rats: 5, bats: 3 };
// Just one, however many asked: an owl, a hawk.
const ONE = new Set(['owls', 'hawks']);

const amountOf = (own, kind) => { const a = own?.regionAnimals?.[kind]; return Object.hasOwn(SHARE, a ?? '') ? a : ''; };
// Kinds counted one by one rather than by amount: hawks, one unless set (0 to MOST_HAWKS), as the panels show it.
export const MOST_HAWKS = 4;
export const hawkCountOf = (v) => { if (v === undefined || v === null || v === '') return 1; const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(MOST_HAWKS, n)) : 1; };
// Every kind is counted: a number saved is that many (up to MOST_COUNT); the words it was once saved as (few, usual, more,
// many) still read as their numbers.
export const MOST_COUNT = 40;
export const exactCountOf = (v) => { if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(MOST_COUNT, Math.floor(v))); return typeof v === 'string' && /^\d+$/.test(v) ? Math.min(MOST_COUNT, Number(v)) : null; };
// How many of each kind (pure): every kind, 0 where none is asked; hawks as many as set, one when left alone.
export function regionAnimalCounts(own = {}) {
  const out = {};
  for (const kind of KINDS) {
    const raw = own?.regionAnimals?.[kind], exact = exactCountOf(raw);
    // (a region's hawks only when asked for: the scene's own hawk, one by default, already flies over the whole map)
    if (kind === 'hawks') { out.hawks = Math.min(MOST_HAWKS, exactCountOf(raw) ?? 0); continue; }
    if (exact !== null) { out[kind] = exact; continue; }
    const a = amountOf(own, kind); out[kind] = !a ? 0 : ONE.has(kind) ? 1 : Math.max(1, Math.round(USUAL[kind] * SHARE[a]));
  }
  return out;
}
// Whether a region has animals of its own: any kind asked for.
export const regionHasAnimals = (own = {}) => KINDS.some((k) => amountOf(own, k) || (exactCountOf(own?.regionAnimals?.[k]) ?? 0) > 0);
// The town's animals come in a quiet or a busy town's numbers: busy once any of them asks for more.
export const townLevelOf = (own = {}) => (['pigeons', 'hens', 'cats', 'dogs'].some((k) => ['more', 'many'].includes(amountOf(own, k)) || (exactCountOf(own?.regionAnimals?.[k]) ?? 0) > USUAL[k]) ? 'busy' : 'quiet');
// How big they are, as a number (a slider): saved as 0.5 to 2. The words it was once saved as, small and big, still read as they did.
export const ANIMAL_SIZE = Object.freeze({ min: 0.5, max: 2, step: 0.05 });
export const animalSizeOf = (own) => {
  const v = own?.regionAnimalSize, word = { small: 0.75, big: 1.3 }[v];
  if (word) return word;
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(ANIMAL_SIZE.max, Math.max(ANIMAL_SIZE.min, n)) : 1;
};
export const regionAnimalSize = (own = {}) => animalSizeOf(own);

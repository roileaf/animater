// Animals of a region's own (Region configuration → Animater → Animals in this region): they live inside it and keep to
// it, on top of whatever the scene has. The scene's outdoor kinds, the town's four (without turning on town life), farm
// animals (farm-life.mjs), rats and bats. Kept in the region's flags: regionAnimals { kind: amount }, regionAnimalSize,
// regionAnimalPace (a percent), animalHours ('all': its day animals stay out in the dark).

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
// How fast the animals live, as a share of the usual (pure), from a slider's percent: unset, as usual. A map has one
// (the scene's animalPace, the Animals panel) and a region one of its own on top (regionAnimalPace).
export const ANIMAL_PACE = Object.freeze({ min: 25, max: 200, step: 5 });
export const animalPaceOf = (percent) => { const n = Number(percent); return percent === null || percent === undefined || percent === '' || !Number.isFinite(n) ? 1 : Math.min(ANIMAL_PACE.max, Math.max(ANIMAL_PACE.min, n)) / 100; };
export const regionPace = (own, mapPace = 1) => animalPaceOf(own?.regionAnimalPace) * mapPace;
// The time to give an engine this frame at a pace (pure): `seconds` of it (no more than `most`, what the engine was
// given before) made longer or shorter, in pieces no longer than `step`, since every engine takes at most that at
// once and would drop the rest. At the usual pace, the one piece it always had. Never more than ten pieces.
export function pacedSteps(seconds, pace = 1, { most = 0.25, step = 0.05 } = {}) {
  const base = Math.min(Number(seconds) || 0, most);
  if (!(base > 0)) return [];
  if (pace === 1) return [base];
  const out = [];
  for (let left = Math.min(base * pace, step * 10); left > 0.0001; left -= step) out.push(Math.min(left, step));
  return out;
}
// The day's animals go in as it gets dark (main.mjs wildDay: by the scene's darkness, the clock's night, or underground).
// A region can keep its own out whatever the hour (animalHours 'all'): snakes and insects in a dungeon. Off unless asked for.
export const outAtAllHours = (own) => own?.animalHours === 'all';
// How much a region's day animals are out (pure, 0–1): the scene's `day`, or all of it where they are kept out.
export const regionDay = (own, day) => (outAtAllHours(own) ? 1 : day);

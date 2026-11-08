// What the region panel (the right-click panel holding every Animater setting of a map region) is made of, apart from how it
// is drawn: the kinds of region, the sections each kind shows, and the one-line summary on each section's heading.
import { waterKindOf, stepMenu, caveMenu, caveKindFlags,WATER_KINDS, WATER_TOWARD, WATER_DEPTHS, DOCK_STYLES, dockStyleOf, castsShadow } from '../engines/motion/region-steps.mjs';
import { REGION_ANIMAL_GROUPS, regionAnimalCounts, regionHasAnimals } from '../engines/motion/region-animals.mjs';
import { weatherLabel } from '../engines/motion/sky-weather.mjs';

// The animals' size lives with the animals (it is read as they are placed); the panel's slider reads it from here.
export { animalSizeOf, ANIMAL_SIZE } from '../engines/motion/region-animals.mjs';

// What a region can be: [id, icon, label].
export const REGION_KINDS = Object.freeze([
  ['water', 'fa-water', 'Water'],
  ['ground', 'fa-seedling', 'Ground'],
  ['indoors', 'fa-house', 'Indoors'],
  ['cave', 'fa-mountain', 'Cave'],
  ['deck', 'fa-bridge', 'Dock'],
  ['lava', 'fa-fire', 'Lava'],
].map((k) => Object.freeze(k)));

// Which kind a region is, from its own flags and the floor it comes to (pure).
export function regionKindOf(own = {}, floor) {
  if (floor === 'lava') return 'lava';
  if (floor === 'cavern' || own?.cavern) return 'cave';
  if (own?.overWater) return 'deck';
  if (floor === 'water' || (own?.drips && ['pool', 'deep'].includes(own?.dripDepth))) return 'water';
  if (own?.indoors === true) return 'indoors';
  return 'ground';
}

// The flags to save to make a region this kind. Only the panel reads `indoors`: it tells an indoor room from open ground.
// Leaving a kind undoes what made it that kind (indoors, a cave's decor), or the region would read as the old kind still.
export function kindFlags(kind, own = {}) {
  const f = own?.floor, out = { ...(kind !== 'indoors' ? { indoors: false } : {}), ...(kind !== 'cave' && own?.cavern ? { cavern: '' } : {}) };
  switch (kind) {
    case 'water': return { ...out, floor: 'water', overWater: false };
    case 'indoors': return { ...out, floor: 'wood', indoors: true, overWater: false };
    case 'cave': {
      // A cave has no floor of its own: its decor makes it a cave (glowing fungus, as the old menu began, when it has none).
      // Coming from lava, the lava's steps go too.
      const { cavern, ...away } = caveKindFlags(own, 'fungus'), decor = own?.cavern && own.cavern !== 'lava';
      return { ...out, ...away, floor: '', ...(decor ? {} : { cavern }) };
    }
    case 'deck': return { ...out, overWater: true, floor: f && f !== 'water' ? f : 'wood' };
    case 'lava': return { ...out, floor: 'lava' };
    default: return { ...out, floor: f && f !== 'water' && f !== 'lava' && f !== 'cavern' ? f : 'grass', overWater: false };
  }
}

const TITLES = {
  water: ['fa-water', 'Water'], ground: ['fa-seedling', 'Ground'], cavern: ['fa-gem', 'Cavern'], drips: ['fa-droplet', 'Drips'],
  deck: ['fa-bridge', 'Dock'], steps: ['fa-shoe-prints', 'Steps'], animals: ['fa-paw', 'Animals'], air: ['fa-cloud-sun', 'Air'], look: ['fa-palette', 'Look'],
};
const ORDER = {
  water: ['water', 'steps', 'animals', 'air', 'look'],
  ground: ['ground', 'animals', 'steps', 'air', 'look'],
  indoors: ['ground', 'animals', 'air', 'look'],
  cave: ['cavern', 'drips', 'air', 'animals'],
  deck: ['deck', 'steps', 'look'],
  lava: ['steps', 'air', 'look'],
};

// The sections of the panel for a kind, in order, each { id, icon, title, summary, open }; one is open to begin with.
// (`floor` only sharpens the summaries; the kind already says what it is.)
export function panelSections(kind, own = {}, floor) {
  const ids = ORDER[kind] ?? ORDER.ground;
  const first = kind === 'ground' && regionHasAnimals(own) ? 'animals' : ids[0];
  return ids.map((id) => ({ id, icon: TITLES[id][0], title: TITLES[id][1], summary: summaryOf(id, own, floor ?? defaultFloor(kind, own)), open: id === first }));
}
const defaultFloor = (kind, own) => ({ water: 'water', cave: 'cavern', lava: 'lava', indoors: 'wood' }[kind] ?? own?.floor ?? (kind === 'deck' ? 'wood' : 'grass'));

const lower = (s) => String(s).toLowerCase();
const capital = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const labelIn = (list, key, fallback = '') => list.find(([k]) => k === key)?.[1] ?? fallback;
const SINGULAR = { foxes: 'fox', wolves: 'wolf', wildBirds: 'bird', waterBirds: 'water bird' };
const PLURAL = new Map(REGION_ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k, label]) => [k, lower(label)])));
const SUMMARY_ORDER = [...REGION_ANIMAL_GROUPS].sort(([a], [b]) => (b === 'Farm') - (a === 'Farm')).flatMap(([, list]) => list.map(([k]) => k));
const oneOf =(kind) => SINGULAR[kind] ?? PLURAL.get(kind).replace(/s$/, '');
const aOrAn = (word) => (/^[aeiou]/.test(word) ? 'an' : 'a');
const POND = { still: 'Pond', river: 'River', rapids: 'Rapids', falls: 'Waterfall', sea: 'Sea' };

// The one line shown on a section's heading (pure), in plain words.
export function summaryOf(id, own = {}, floor) {
  switch (id) {
    case 'water': {
      const kind = waterKindOf(own), flows = ['river', 'rapids', 'falls'].includes(kind) || !!own?.flowTo;
      const toward = labelIn(WATER_TOWARD, own?.flowTo), way = flows ? (toward ? `flowing ${lower(toward)}` : 'flowing with the wind') : 'still';
      return [POND[kind] ?? labelIn(WATER_KINDS, kind), way, lower(labelIn(WATER_DEPTHS, own?.waterDepth ?? '', 'Medium'))].join(' · ');
    }
    case 'animals': {
      // (Farm animals first, as the ones a map most often holds.)
      const counts = regionAnimalCounts(own), parts = SUMMARY_ORDER.map((kind) => [kind, counts[kind]]).filter(([, n]) => n > 0)
        .map(([kind, n]) => (n === 1 ? `${aOrAn(oneOf(kind))} ${oneOf(kind)}` : `${n} ${PLURAL.get(kind)}`));
      return parts.length ? parts.join(', ') : 'None';
    }
    case 'steps': {
      const m = stepMenu(own, floor);
      return m.steps.length ? `${m.steps[m.current] ?? m.steps[0]} (${m.current + 1} of ${m.steps.length})${m.hidden ? ' · hidden' : ''}` : 'None';
    }
    case 'air': return own?.regionWeather ? weatherLabel(own.regionWeather) : 'As the scene';
    case 'cavern': {
      const m = caveMenu(own, floor);
      if (!m) return 'Bare';
      return m.kind === 'lava' ? 'Lava' : `${m.name} · ${m.steps[m.step]}`;
    }
    case 'drips': return own?.drips ? 'Dripping' : 'Dry';
    case 'deck': return `${labelIn(DOCK_STYLES, dockStyleOf(own), 'Plain')} · ${castsShadow(own) ? 'shadow' : 'no shadow'}`;
    case 'ground': return `${capital(floor ?? own?.floor ?? 'grass')} · ${own?.season === 'on' ? 'seasons' : own?.season === 'off' ? 'no seasons' : 'seasons as the scene'}`;
    case 'look': return own?.texture === 'on' ? 'Textured' : own?.texture === 'off' ? 'Plain' : 'As the scene';
    default: return '';
  }
}

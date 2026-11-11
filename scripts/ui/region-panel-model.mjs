// What the region panel (the right-click panel holding every Animater setting of a map region) is made of, apart from how it
// is drawn: the kinds of region, the sections each kind shows, and the one-line summary on each section's heading.
import { waterKindOf, stepMenu, caveMenu, caveKindFlags, caveHasMenu, stepFlags, WATER_KINDS, WATER_TOWARD, WATER_DEPTHS, DOCK_STYLES, dockStyleOf, castsShadow } from '../engines/motion/region-steps.mjs';
import { REGION_ANIMAL_GROUPS, regionAnimalCounts, regionHasAnimals, animalSizeOf } from '../engines/motion/region-animals.mjs';
import { weatherLabel } from '../engines/motion/sky-weather.mjs';

// The animals' size lives with the animals (it is read as they are placed); the panel's slider reads it from here.
export { animalSizeOf, ANIMAL_SIZE } from '../engines/motion/region-animals.mjs';

// What a region can be: [id, icon, label]. (A dock is Ground with Over water on: the panel reads it as its own kind, 'deck',
// for its settings, but it is picked and shown as Ground.)
export const REGION_KINDS = Object.freeze([
  // (None: a region Animater has nothing to do with, a teleport or a trigger.)
  ['none', 'fa-ban', 'None'],
  ['water', 'fa-water', 'Water'],
  ['ground', 'fa-seedling', 'Ground'],
  ['indoors', 'fa-house', 'Indoors'],
  ['cave', 'fa-mountain', 'Cave'],
  ['lava', 'fa-fire', 'Lava'],
].map((k) => Object.freeze(k)));

// Whether a flag is set to anything but its default (unset, empty, off, or a set of nothing but those).
const set = (v) => v !== undefined && v !== null && v !== '' && v !== false && (typeof v !== 'object' || Object.values(v).some(set));

// Cobwebs, wet walls, steam and bad air dress any room; only a floorless region they dress is a cave.
export const ROOM_DRESSING = Object.freeze([['', 'None'], ['webs', 'Cobwebs'], ['wet', 'Wet walls'], ['steam', 'Steam vents'], ['foul', 'Bad air']]);
const dressed = (own) => ROOM_DRESSING.some(([k]) => k && k === own?.cavern);

// Which kind a region is, from its own flags and the floor it comes to (pure). A cave is a region with no floor of its
// own (its decor makes it one), or one with a cave's growth: fungus, crystals or mist. A drip pool is only its drips.
// A region with no Animater setting at all is None (unless its name makes it water, as Animater reads names).
export function regionKindOf(own = {}, floor) {
  if (!Object.values(own ?? {}).some(set) && !['water', 'lava', 'cavern'].includes(floor)) return 'none';
  if (floor === 'lava') return 'lava';
  if (floor === 'cavern' || caveHasMenu(stepFlags(own ?? {})) || (!floor && own?.cavern && own.cavern !== 'lava')) return 'cave';
  if (own?.overWater) return 'deck';
  if (floor === 'water') return 'water';
  if (own?.indoors === true) return 'indoors';
  return 'ground';
}

// The floor each kind shows as when the region has none of its own (from the scene): the one place this is decided.
export const floorOfKind = (kind) => ({ water: 'water', cave: 'cavern', lava: 'lava', indoors: 'wood', deck: 'wood' }[kind] ?? 'grass');
// The floor the panel shows and sets a region's controls by: its own, else its kind's (pure).
export const shownFloorOf = (own = {}, floor) => floor || floorOfKind(regionKindOf(own, floor));

// Floors that make no room floor: going indoors, they become wood.
const NOT_INDOORS = ['water', 'lava', 'cavern', 'grass', 'snow', 'none'];

// The flags to save to make a region this kind. Only the panel reads `indoors`: it tells an indoor room from open ground.
// Leaving a kind undoes what made it that kind (indoors, a cave's growth), or the region would read as the old kind still;
// a room's dressing (cobwebs and the like) stays with it between the other kinds.
export function kindFlags(kind, own = {}) {
  // None takes every Animater setting off the region (Foundry's way to delete a key).
  if (kind === 'none') return Object.fromEntries(Object.keys(own ?? {}).map((k) => [`-=${k}`, null]));
  const f = own?.floor, leavesCave = kind !== 'cave' && own?.cavern && regionKindOf(own, f) === 'cave';
  const out = { ...(kind !== 'indoors' ? { indoors: false } : {}), ...(leavesCave ? { cavern: '' } : {}) };
  switch (kind) {
    case 'water': return { ...out, floor: 'water', overWater: false };
    case 'indoors': return { ...out, floor: f && !NOT_INDOORS.includes(f) ? f : 'wood', indoors: true, overWater: false };
    case 'cave': {
      // A cave has no floor of its own: its decor makes it a cave (glowing fungus, as the old menu began, when it has none).
      // Coming from lava, the lava's steps go too.
      const { cavern, ...away } = caveKindFlags(own, 'fungus'), decor = own?.cavern && own.cavern !== 'lava';
      return { ...out, ...away, floor: '', ...(decor ? {} : { cavern }) };
    }
    // (A deck is built of something to stand on: never water, lava or a cave's bare rock.)
    case 'deck': return { ...out, overWater: true, floor: f && !['water', 'lava', 'cavern'].includes(f) ? f : 'wood' };
    case 'lava': return { ...out, floor: 'lava' };
    default: return { ...out, floor: f && f !== 'water' && f !== 'lava' && f !== 'cavern' ? f : 'grass', overWater: false };
  }
}

const TITLES = {
  water: ['fa-water', 'Water'], ground: ['fa-seedling', 'Ground'], cavern: ['fa-gem', 'Cavern'], drips: ['fa-droplet', 'Drips'],
  deck: ['fa-seedling', 'Ground'], steps: ['fa-shoe-prints', 'Steps'], animals: ['fa-paw', 'Animals'], air: ['fa-cloud-sun', 'Air'], look: ['fa-palette', 'Look'],
  decor: ['fa-tree', 'Decorations'],
};
const ORDER = {
  none: [],
  water: ['water', 'steps', 'animals', 'air', 'look'],
  ground: ['ground', 'animals', 'steps', 'air', 'look'],
  indoors: ['ground', 'animals', 'air', 'look'],
  cave: ['cavern', 'drips', 'air', 'animals'],
  deck: ['deck', 'steps', 'look'],
  lava: ['steps', 'air', 'look'],
};

// The sections any kind can hold, and whether a region's flags use each: one that does always shows, whatever the kind,
// so no setting the region has is ever out of reach.
const IN_USE = {
  air: (own) => ['regionWeather', 'cold', 'openSky', 'skyWindow', 'skyPattern', 'indoorEdge', 'opensOutside', 'tavern'].some((k) => set(own[k])) || dressed(own),
  animals: (own) => regionHasAnimals(own) || animalSizeOf(own) !== 1 || own.animalSound === 'off' || set(own.keepOut),
  look: (own) => ['texture', 'textureStyles', 'tokenshade', 'stepEdgeOff'].some((k) => set(own[k])) || (own.stepEdge !== undefined && own.stepEdge !== null && own.stepEdge !== ''),
  drips: (own) => ['drips', 'dripPace', 'dripDepth'].some((k) => set(own[k])),
  steps: (own) => !!own.stepsEdited || Number(own.step) > 0 || own.stepHidden === true,
  decor: (own) => own.decor?.on === true,
};
// Sections a kind holds inside another of its own (water's drips sit in its water section).
const HELD = { water: ['drips'] };
// Sections More sections never offers: decorations are laid with the Decorations brush, which makes the section.
const NOT_ADDED = new Set(['decor']);
const sectionOf = (id, own, floor, open) => ({ id, icon: TITLES[id][0], title: TITLES[id][1], summary: summaryOf(id, own, floor), open });

// The sections of the panel for a kind, in order, each { id, icon, title, summary, open }; one is open to begin with.
// After the kind's own come any others its flags use, then those added by hand from More sections (`added`, ids).
// (`floor` only sharpens the summaries; the kind already says what it is.)
export function panelSections(kind, own = {}, floor, added = []) {
  if (kind === 'none') return [];
  const base = ORDER[kind] ?? ORDER.ground, extra = Object.keys(IN_USE).filter((id) => !base.includes(id) && !HELD[kind]?.includes(id) && (IN_USE[id](own ?? {}) || added.includes(id)));
  const ids = [...base, ...extra], first = kind === 'ground' && regionHasAnimals(own) ? 'animals' : ids[0], shown = floor || floorOfKind(kind);
  return ids.map((id) => sectionOf(id, own, shown, id === first));
}
// The sections a kind can still add (the "More sections" line): each { id, icon, title }.
export function moreSections(kind, own = {}, added = []) {
  if (kind === 'none') return [];
  const shown = panelSections(kind, own, undefined, added).map((s) => s.id);
  return Object.keys(IN_USE).filter((id) => !shown.includes(id) && !HELD[kind]?.includes(id) && !NOT_ADDED.has(id)).map((id) => ({ id, icon: TITLES[id][0], title: TITLES[id][1] }));
}

// A roof: Foundry's Suppress Weather behavior on the region, which is what keeps the weather, the sun and the sky's light
// out for everything Animater draws. Whether the region has one switched on.
export const ROOF_BEHAVIOR = 'suppressWeather';
const roofsOf = (doc) => Array.from(doc?.behaviors ?? []).filter((b) => b?.type === ROOF_BEHAVIOR);
export const hasRoof = (doc) => roofsOf(doc).some((b) => !b.disabled);
// Put a roof on the region or take it off: switches its Suppress Weather behaviors on or off, and adds one when it has none.
// (Taken off, they are only switched off, so one set up by hand keeps its name and settings.) A promise.
export async function setRoof(doc, on) {
  const roofs = roofsOf(doc);
  if (on && !roofs.length) return doc.createEmbeddedDocuments('RegionBehavior', [{ name: 'Roof', type: ROOF_BEHAVIOR }]);
  const change = roofs.filter((b) => !b.disabled === !on).map((b) => ({ _id: b.id, disabled: !on }));
  return change.length ? doc.updateEmbeddedDocuments('RegionBehavior', change) : null;
}

const lower = (s) => String(s).toLowerCase();
const capital = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const labelIn = (list, key, fallback = '') => list.find(([k]) => k === key)?.[1] ?? fallback;
const SINGULAR = { foxes: 'fox', wolves: 'wolf', wildBirds: 'bird', waterBirds: 'duck', crows: 'crow', hawks: 'hawk', herons: 'heron', gulls: 'gull' };
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
      const counts = regionAnimalCounts(own);
      const parts = SUMMARY_ORDER.map((kind) => [kind, counts[kind]]).filter(([, n]) => n > 0)
        .map(([kind, n]) => (n === 1 ? `${aOrAn(oneOf(kind))} ${oneOf(kind)}` : `${n} ${PLURAL.get(kind)}`));
      return parts.length ? parts.join(', ') : 'None';
    }
    case 'steps': {
      const m = stepMenu(own, floor);
      return m.steps.length ? `${m.steps[m.current] ?? m.steps[0]} (${m.current + 1} of ${m.steps.length})${m.hidden ? ' · hidden' : ''}` : 'None';
    }
    case 'air': return own?.regionWeather ? weatherLabel(own.regionWeather) : 'As the scene';
    case 'decor': {
      if (own?.decor?.on !== true) return 'None';
      const byHand = (own.decor.brushed ?? []).length;
      return byHand ? `${byHand} painted` : 'On';
    }
    case 'cavern': {
      const m = caveMenu(own, floor);
      if (!m) return 'Bare';
      return m.kind === 'lava' ? 'Lava' : `${m.name} · ${m.steps[m.step]}`;
    }
    case 'drips': return own?.drips ? 'Dripping' : 'Dry';
    case 'deck': return `Over water · ${labelIn(DOCK_STYLES, dockStyleOf(own), 'Plain')} · ${castsShadow(own) ? 'shadow' : 'no shadow'}`;
    case 'ground': return `${own?.floor ? capital(floor ?? own.floor) : 'From the scene'} · ${own?.season === 'on' ? 'seasons' : own?.season === 'off' ? 'no seasons' : 'seasons as the scene'}`;
    case 'look': return own?.texture === 'on' ? 'Textured' : own?.texture === 'off' ? 'Plain' : 'As the scene';
    default: return '';
  }
}

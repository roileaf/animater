// A region's steps: states the GM moves it through in play, grass going from fresh to bloodied to burnt. A step has a look
// drawn on the floor (floor-looks.mjs), the floor it walks as, and may switch on one of the region effects Animater already
// has (mist, steam, lava...) or set a river's speed. All of it lives in the region's flags, so it reaches every screen and
// stays when the scene is loaded again: `steps` the list, `stepsFloor` the floor it was made for, `step` the current one, `stepAt` where it was clicked,
// `stepHidden`, `stepHow` ('spread' or 'fade') and `stepSeconds`.

// Each look: its key, its number in floor-looks.mjs, its name in the list, and its group there.
const LOOKS = Object.freeze([
  ['none', 0, 'As painted', 'Plain'],
  ['wet', 2, 'Wet', 'Weather and wear'], ['frozen', 48, 'Frozen solid', 'Weather and wear'], ['snowed', 50, 'Snowed over', 'Weather and wear'], ['steam', 49, 'Steaming', 'Weather and wear'], ['misty', 51, 'Misty', 'Weather and wear'], ['frost', 5, 'Frost', 'Weather and wear'], ['drifts', 40, 'Drifted snow or sand', 'Weather and wear'], ['slush', 10, 'Slush', 'Weather and wear'], ['fog', 12, 'Fogged', 'Weather and wear'], ['flooded', 29, 'Flooded', 'Weather and wear'], ['withered', 9, 'Withered', 'Weather and wear'], ['churned', 16, 'Churned or trampled', 'Weather and wear'], ['cracks', 6, 'Cracks', 'Weather and wear'], ['rubble', 41, 'Rubble', 'Weather and wear'], ['rust', 8, 'Rust', 'Weather and wear'], ['salt', 19, 'Salt crust', 'Weather and wear'], ['murky', 11, 'Murky', 'Weather and wear'], ['blackice', 46, 'Black ice', 'Weather and wear'], ['drained', 47, 'Drained to mud', 'Weather and wear'], ['quicksand', 44, 'Quicksand', 'Weather and wear'], ['glaze', 45, 'Fused to glass', 'Weather and wear'], ['stained', 34, 'Stained colour', 'Weather and wear'],
  ['blood', 1, 'Blood', 'Violence'], ['dried', 43, 'Dried blood', 'Violence'], ['bones', 18, 'Bones', 'Violence'],
  ['moss', 7, 'Moss or algae', 'Nature'], ['vines', 14, 'Vines', 'Nature'], ['flowers', 15, 'Flowers', 'Nature'], ['blight', 17, 'Blight', 'Nature'],
  ['arcane', 22, 'Arcane glow', 'Magic'], ['holy', 23, 'Consecrated', 'Magic'], ['cursed', 24, 'Cursed', 'Magic'], ['deadmagic', 25, 'Dead magic', 'Magic'], ['electric', 33, 'Electrified', 'Magic'],
  ['burnt', 3, 'Burnt', 'Disaster'], ['burning', 42, 'Burning', 'Disaster'], ['ash', 4, 'Ash', 'Disaster'], ['oil', 20, 'Oil', 'Disaster'], ['acid', 30, 'Acid', 'Disaster'], ['poison', 31, 'Poison', 'Disaster'], ['boiling', 21, 'Boiling', 'Disaster'], ['hot', 13, 'Red-hot', 'Disaster'], ['lavacracks', 32, 'Lava cracks', 'Disaster'],
]);
export const STEP_LOOKS = Object.freeze(Object.fromEntries(LOOKS.map(([key, id]) => [key, id])));
export const STEP_LOOK_NAMES = Object.freeze(LOOKS.map(([key, , name, group]) => [key, name, group]));
// The effects a step can switch on: the region's Cavern choices, and its dripping water.
export const STEP_EFFECTS = Object.freeze([['', 'None'], ['mist', 'Mist on the floor'], ['drips', 'Dripping water'], ['steam', 'Steam vents'], ['lava', 'Lava'], ['lava-cracking', 'Lava (cracking)'], ['lava-crust', 'Lava (crust)'], ['wet', 'Wet walls'], ['webs', 'Cobwebs'], ['fungus-green', 'Glowing fungus (green)'], ['fungus-blue', 'Glowing fungus (blue)'], ['fungus-violet', 'Glowing fungus (violet)'], ['crystals-amethyst', 'Crystals (amethyst)'], ['crystals-quartz', 'Crystals (clear quartz)'], ['crystals-rose', 'Crystals (rose)'], ['foul', 'Bad air']]);
export const STEP_SPEEDS = Object.freeze([['slower', 'Very slow'], ['slow', 'Slow'], ['gentle', 'Gentle'], ['swift', 'Swift']]);
export const STEP_SECONDS = 6;
// How far a region's edge fades, in about squares: `stepEdge` in its flags.
export const STEP_EDGE = Object.freeze({ min: 0.1, max: 3, usual: 1 });
// How big a region's pattern is, its painted floor and its looks, 1 as painted, smaller for more of it: `stepScale` on the region.
export const STEP_SCALE = Object.freeze({ min: 0.25, max: 3, usual: 1 });
export const stepScale = (own) => { const v = own?.stepScale; const n = v === undefined || v === null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(STEP_SCALE.max, Math.max(STEP_SCALE.min, n)) : STEP_SCALE.usual; };
// How much of its look a step puts down, 1 as painted: `strength` on the step.
export const STEP_STRENGTH = Object.freeze({ min: 0.1, max: 2, usual: 1 });
export const stepStrength = (step) => { const v = step?.strength; const n = v === undefined || v === null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(STEP_STRENGTH.max, Math.max(STEP_STRENGTH.min, n)) : STEP_STRENGTH.usual; };
export const stepEdge = (own) => { if (own?.stepEdgeOff === true) return 0; const v = own?.stepEdge; const n = v === undefined || v === null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(STEP_EDGE.max, Math.max(STEP_EDGE.min, n)) : STEP_EDGE.usual; };

// [name, look, floor it walks as (its own when left out), effect]
const LISTS = Object.freeze({
  grass: [['Fresh', 'none'], ['Rain-soaked', 'wet'], ['Bloodied', 'blood'], ['Dried blood', 'dried'], ['Trampled', 'churned', 'dirt'], ['Overgrown', 'vines'], ['Flowering', 'flowers'], ['Frost-bitten', 'frost'], ['Withered', 'withered', 'dirt'], ['Blighted', 'blight'], ['Consecrated', 'holy'], ['Morning mist', 'misty', '', 'mist'], ['Burning', 'burning', 'dirt'], ['Burnt', 'burnt', 'dirt']],
  dirt: [['Dry', 'none'], ['Turned to mud', 'wet', 'mud'], ['Bloodied', 'blood'], ['Parched', 'cracks'], ['Dug up', 'churned'], ['Fresh grave', 'churned'], ['Salted', 'salt'], ['Ash-covered', 'ash'], ['Cursed ground', 'cursed'], ['Scorched', 'burnt']],
  mud: [['Mud', 'none'], ['Waterlogged', 'wet'], ['Bloodied', 'blood'], ['Baked hard', 'cracks', 'dirt'], ['Quicksand', 'quicksand'], ['Bubbling swamp', 'acid'], ['Frozen ruts', 'frost', 'ice'], ['Scorched', 'burnt', 'dirt']],
  sand: [['Dry', 'none'], ['Tide-wet', 'wet'], ['Bloodied', 'blood'], ['Scorched', 'burnt'], ['Blown in drifts', 'drifts'], ['Fused to glass', 'glaze', 'glass'], ['Tide pools', 'flooded', 'water'], ['Bone-strewn', 'bones']],
  snow: [['Fresh', 'none'], ['Churned to slush', 'slush', 'mud'], ['Bloodied', 'blood'], ['Ash-fallen', 'ash'], ['Melted', 'wet', 'water'], ['Blizzard-drifted', 'drifts'], ['Crusted ice', 'frost', 'ice'], ['Scorched', 'burnt', 'dirt']],
  water: [['Clear', 'none'], ['Murky', 'murky'], ['Bloody', 'blood'], ['Choked with algae', 'moss'], ['Frozen over', 'frozen', 'ice'], ['Oil slick', 'oil'], ['Burning oil', 'burning'], ['Boiling', 'boiling'], ['Glowing', 'arcane'], ['Acid', 'acid'], ['Poisoned', 'poison'], ['Drained to mud', 'drained', 'mud'], ['Misty', 'misty', '', 'mist'], ['Steaming', 'steam', '', 'steam']],
  ice: [['Clear', 'none'], ['Frosted', 'frost'], ['Cracking', 'cracks'], ['Blood under the ice', 'blood'], ['Thawed', 'wet', 'water'], ['Black ice', 'blackice'], ['Snow-dusted', 'drifts', 'snow'], ['Breaking up', 'cracks', 'water']],
  pebbles: [['Dry', 'none'], ['Wet', 'wet'], ['Bloodied', 'blood'], ['Mossy', 'moss'], ['Bone-strewn', 'bones'], ['Rubble', 'rubble'], ['Flooded', 'flooded', 'water'], ['Scorched', 'burnt']],
  stone: [['Dry', 'none'], ['Rain-wet', 'wet'], ['Dripping', 'wet', '', 'drips'], ['Steam vents', 'steam', '', 'steam'], ['Lava', 'lavacracks', '', 'lava'], ['Bloodied', 'blood'], ['Overgrown', 'vines'], ['Mossy', 'moss'], ['Glowing fungus', 'none', '', 'fungus-green'], ['Crystals', 'none', '', 'crystals-amethyst'], ['Webbed', 'none', '', 'webs'], ['Slime-covered', 'acid'], ['Flooded', 'flooded', 'water'], ['Crumbling', 'cracks'], ['Rubble', 'rubble'], ['Runes glowing', 'arcane'], ['Consecrated', 'holy'], ['Cursed', 'cursed'], ['Dead magic', 'deadmagic'], ['Misty', 'misty', '', 'mist'], ['Bad air', 'none', '', 'foul'], ['Scorched', 'burnt']],
  wood: [['Sound', 'none'], ['Wet', 'wet'], ['Bloodied', 'blood'], ['Rotting', 'moss'], ['Splintered', 'cracks'], ['Oil-soaked', 'oil'], ['Burning', 'burning'], ['Termite-eaten', 'churned'], ['Webbed', 'none', '', 'webs'], ['Charred', 'burnt']],
  glass: [['Clean', 'none'], ['Fogged', 'fog'], ['Frosted', 'frost'], ['Cracked', 'cracks'], ['Bloodied', 'blood'], ['Shattered', 'rubble', 'pebbles'], ['Stained with colour', 'stained'], ['Black and cursed', 'cursed']],
  metal: [['Clean', 'none'], ['Wet', 'wet'], ['Bloodied', 'blood'], ['Rusted', 'rust'], ['Red-hot', 'hot'], ['Electrified', 'electric'], ['Frosted', 'frost'], ['Acid-eaten', 'acid'], ['Slick with oil', 'oil'], ['Scorched', 'burnt']],
  // Cooled enough to walk on, then breaking up, then all molten: a chamber can fill or cool.
  lava: [['Crust', 'none', 'stone', 'lava-crust'], ['Cracking', 'none', '', 'lava-cracking'], ['Molten', 'none', '', 'lava']],
});
// A list that is all there is: nothing else a floor can become means anything here.
const ONLY_OWN = Object.freeze(['lava']);
// The step a floor stands at until one is picked, when that is not its first.
const STARTS_AT = Object.freeze({ lava: 2 });

// What any floor can become, after its own list: each is left out where the floor already has that look, or where it means nothing.
const EVERY_FLOOR = Object.freeze([['Bloodied', 'blood'], ['Dried blood', 'dried'], ['Rain-wet', 'wet'], ['Frozen over', 'frozen', 'ice'], ['Snowed over', 'snowed', 'snow'], ['Steaming', 'steam', '', 'steam'], ['Misty', 'misty', '', 'mist'], ['Flooded', 'flooded', 'water'], ['Mossy', 'moss'], ['Overgrown', 'vines'], ['Ash-covered', 'ash'], ['Cracked', 'cracks'], ['Bone-strewn', 'bones'], ['Rubble-strewn', 'rubble'], ['Scorched', 'burnt'], ['Burning', 'burning'], ['Oil-soaked', 'oil'], ['Acid', 'acid'], ['Poisoned', 'poison'], ['Blighted', 'blight'], ['Glowing runes', 'arcane'], ['Consecrated', 'holy'], ['Cursed', 'cursed'], ['Dead magic', 'deadmagic'], ['Electrified', 'electric']]);
const NOT_ON = Object.freeze({ water: ['snowed', 'flooded', 'bones', 'rubble', 'vines', 'cracks', 'ash', 'dried', 'wet'], ice: ['frozen', 'flooded', 'vines', 'moss', 'burning'], snow: ['snowed', 'frozen', 'vines', 'moss'], mud: ['wet'] });

// A floor's own list, then what any floor can become; a fresh copy each time.
export function defaultSteps(floor) {
  if (!Object.hasOwn(LISTS, floor)) return [];
  const own = LISTS[floor], looks = new Set(own.map(([, look]) => look)), names = new Set(own.map(([name]) => name)), not = NOT_ON[floor] ?? [];
  const more = ONLY_OWN.includes(floor) ? [] : EVERY_FLOOR.filter(([name, look]) => !looks.has(look) && !names.has(name) && !not.includes(look));
  return [...own, ...more].map(([name, look, walks, effect]) => ({ name, look, walks: walks || floor, effect: effect ?? '' }));
}
// A list belongs to the floor it was made for: set the region to another floor and that floor's own list takes over, until it
// is set back. (A list saved before this was noted belongs to the floor its first step walks on.)
const leftBehind = (own) => { const made = own?.stepsFloor ?? own?.steps?.[0]?.walks; return !!(own?.floor && made && own.floor !== made); };
const hasList = (own) => Array.isArray(own?.steps) && own.steps.length > 0 && !leftBehind(own);
// The list on offer. One the GM edited (`stepsEdited`) is as they made it. One only saved by picking a step keeps its order, so its
// current step stays put, and takes up the presets as they are now, with any speed set on them.
export const stepListOf = (own, floor) => {
  if (!hasList(own)) return defaultSteps(floor);
  if (own.stepsEdited) return own.steps;
  const presets = defaultSteps(floor), byName = new Map(presets.map((s) => [s.name, s]));
  const kept = own.steps.map((s) => (byName.has(s.name) ? { ...byName.get(s.name), ...(s.speed ? { speed: s.speed } : {}), ...(s.strength !== undefined ? { strength: s.strength } : {}) } : s)), names = new Set(kept.map((s) => s.name));
  return [...kept, ...presets.filter((s) => !names.has(s.name))];
};
const indexIn = (list, index) => { const i = Number(index); return Number.isInteger(i) && i >= 0 && i < list.length ? i : 0; };
// Which step of its list a region is on.
export const stepIndexOf = (own, floor) => (hasList(own) ? indexIn(own.steps, own.step) : STARTS_AT[floor] ?? 0);

// The step showing now, or null: no steps saved, or hidden. Read as a creature walks, so it builds nothing.
export function activeStep(own) {
  if (!hasList(own) || own.stepHidden) return null;
  return own.steps[indexIn(own.steps, own.step)] ?? null;
}

// The region's flags with its step applied: what the floor, cave and water code read. Without one, the flags themselves.
export function stepFlags(own) {
  const step = activeStep(own);
  if (!step) return own;
  const out = { ...own };
  if (step.walks) out.floor = step.walks;
  if (step.effect === 'drips') out.drips = true;
  else if (step.effect) out.cavern = step.effect;
  if (step.speed) out.current = step.speed === 'gentle' ? '' : step.speed;
  return out;
}

// What the look layer needs: the look's name, whether it covers the region whole (water, not patches), how it changes.
export function stepLook(own, floor) {
  const step = activeStep(own), seconds = Number(own?.stepSeconds);
  return {
    look: step && step.look in STEP_LOOKS ? step.look : 'none',
    cover: (step?.walks ?? floor) === 'water',
    how: own?.stepHow === 'fade' ? 'fade' : 'spread',
    seconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : STEP_SECONDS,
    at: own?.stepAt ?? null,
    flowTo: own?.flowTo ?? '',
    edge: stepEdge(own),
    strength: stepStrength(step),
    scale: stepScale(own),
  };
}

// Ground a step has put under water for now: it walks and sounds as water, but it is no pond and nothing lives there.
export const floodedByStep = (own, floor) => activeStep(own)?.walks === 'water' && floor !== 'water';
// Ground a step has made no place to live: what would hurt an animal, and what it would shun. Snow, frost, mist, bones and old blood are all ground they will still cross.
const NO_HOME_LOOKS = new Set(['burning', 'lavacracks', 'hot', 'boiling', 'acid', 'poison', 'electric', 'oil', 'burnt', 'ash', 'blight', 'cursed', 'deadmagic', 'withered', 'blood']);
export const unfitForLife = (own) => NO_HOME_LOOKS.has(activeStep(own)?.look);
// Water with something painted over the map: what moves on it can't show the map's picture, which is not what is seen there.
export const paintsOverWater = (own, floor, sceneChoice) => stepLook(own, floor).look !== 'none' || showsTexture(own, sceneChoice);

// What a region's water does: said outright (`waterKind`), else going by what it is marked as.
export const WATER_KINDS = Object.freeze([['still', 'Still pool'], ['river', 'River'], ['rapids', 'Rapids'], ['falls', 'Waterfall'], ['sea', 'Sea']]);
export const WATER_TOWARD = Object.freeze([['n', 'North'], ['ne', 'North-east'], ['e', 'East'], ['se', 'South-east'], ['s', 'South'], ['sw', 'South-west'], ['w', 'West'], ['nw', 'North-west']]);
// What the water engine does with it. Region configuration's ticks for a waterfall and the sea are their own drawings, apart from this.
export const waterKindOf = (own) => { const said = own?.waterKind; if (WATER_KINDS.some(([key]) => key === said)) return said; return own?.flowTo ? 'river' : 'still'; };
// How deep a region's water is, for how it looks. `hold`: how soon its own colour takes over from its bed; `dark`: how much of it is the dark of deep water, over the fish too; `tint`: a clear sea's own colours instead of the map's, turquoise to deep blue.
export const WATER_DEPTHS = Object.freeze([['shallow', 'Shallow'], ['', 'Medium'], ['deep', 'Deep'], ['abyss', 'Very deep'], ['turquoise', 'Clear turquoise']]);
const DEPTH_LOOKS = Object.freeze({ shallow: Object.freeze({ hold: 0.35, dark: 0 }), deep: Object.freeze({ hold: 1.35, dark: 0.4 }), abyss: Object.freeze({ hold: 1.6, dark: 0.72 }), turquoise: Object.freeze({ hold: 1, dark: 0, tint: true }) });
export const waterDepthLook = (key) => DEPTH_LOOKS[key] ?? { hold: 1, dark: 0 };
// The ways water can be set to run: a compass point, or with the wind.
export const flowChoices = () => [['wind', 'Follows the wind'], ...WATER_TOWARD];
// The way a fall follows the wind (radians, pure): the nearest of eight, so that it only turns when the wind has really turned.
export const fallWindAngle = (angle) => (Math.round((Number(angle) || 0) / (Math.PI / 4)) * Math.PI) / 4;
export const waterFlows = (kind) => kind === 'river' || kind === 'rapids' || kind === 'falls';
// Water nothing lives on: too fast to swim, nest or float a lily pad on.
export const noLifeOnWater = (own) => { const kind = waterKindOf(own); return !!own?.waterfall || kind === 'falls' || kind === 'rapids'; };
// The flags to save for a kind of water: which way it runs and how fast go with it.
export function waterKindFlags(own, kind) {
  const flows = waterFlows(kind);
  return { waterKind: kind, flowTo: flows ? own?.flowTo || 's' : '', ...(kind === 'rapids' || kind === 'falls' ? { current: 'swift' } : !flows ? { current: '' } : {}) };
}

// The flags to save to move to a step (it goes round at either end). `at`: where the GM clicked.
export function changeStep(own, floor, index, at = null) {
  const steps = stepListOf(own, floor), size = Math.max(1, steps.length);
  return { steps, stepsFloor: floor, step: ((index % size) + size) % size, stepAt: at ?? null, stepHidden: false };
}

// The flags to save for this step's river speed.
export function setStepSpeed(own, floor, speed) {
  const steps = stepListOf(own, floor).map((s) => ({ ...s })), i = stepIndexOf(own, floor);
  if (steps[i]) steps[i].speed = speed;
  return { steps, stepsFloor: floor, step: i };
}

// The flags to save for how strong this step's look is.
export function setStepStrength(own, floor, strength) {
  const steps = stepListOf(own, floor).map((s) => ({ ...s })), i = stepIndexOf(own, floor);
  if (steps[i]) steps[i].strength = strength;
  return { steps, stepsFloor: floor, step: i };
}

// What the right-click menu shows. `speed` only for running water, `reflections` only for water, `strength` only for a step with a look; null where it has none.
export function stepMenu(own, floor) {
  const list = stepListOf(own, floor), current = stepIndexOf(own, floor), shown = stepFlags({ floor, ...own });
  const wet = (shown?.floor ?? floor) === 'water';
  return {
    steps: list.map((s) => s.name),
    current,
    walks: list[current]?.walks && list[current].walks !== floor ? list[current].walks : null,
    hidden: !!own?.stepHidden,
    grassy: (shown?.floor ?? floor) === 'grass',
    edge: stepEdge(own),
    scale: stepScale(own),
    strength: list[current]?.look && list[current].look !== 'none' ? stepStrength(list[current]) : null,
    speed: wet && own?.flowTo ? (shown.current || 'gentle') : null,
    reflections: wet ? own?.reflections !== 'off' : null,
  };
}

// What a cavern region holds, to the eye only: its own stages, and how big and how many (`caveSize`, `caveAmount`, `caveStep` in its flags). Lava is a floor, with steps like any other.
export const CAVE_AMOUNT = Object.freeze({ min: 0.2, max: 4, usual: 1 });
const CAVE_SIZE = Object.freeze({ min: 0.4, max: 3, usual: 1 });
const CAVE_DECOR = Object.freeze({
  // (Past twice the size its caps' glows run together into white.)
  fungus: { name: 'Glowing fungus', toneLabel: 'Colour', tones: [['green', 'Green'], ['blue', 'Blue'], ['violet', 'Violet']], most: 2, steps: [{ name: 'Dormant', glow: 0.15, amount: 0.5, scale: 0.75 }, { name: 'Growing', glow: 0.6, amount: 0.8, scale: 0.9 }, { name: 'In bloom', glow: 1, amount: 1, scale: 1 }] },
  crystals: { name: 'Crystals', toneLabel: 'Stone', tones: [['amethyst', 'Amethyst'], ['quartz', 'Quartz'], ['rose', 'Rose']], steps: [{ name: 'Dim', torch: 0.35, amount: 0.5, scale: 0.8 }, { name: 'Awake', torch: 0.75, amount: 1, scale: 1 }, { name: 'Blazing', torch: 1, amount: 1.4, scale: 1.15 }] },
  mist: { name: 'Low mist', steps: [{ name: 'Thin', thick: 0.45, amount: 1, scale: 1 }, { name: 'Low', thick: 0.75, amount: 1, scale: 1 }, { name: 'Thick', thick: 1, amount: 1, scale: 1 }] },
});
export const CAVE_CHOICES = Object.freeze([['fungus', 'Fungus'], ['crystals', 'Crystals'], ['lava', 'Lava'], ['mist', 'Mist']]);
const LAVA_HEAT = Object.freeze({ crust: 0.05, cracking: 0.3 });
const inRange = (value, range) => { const n = value === undefined || value === null || value === '' ? NaN : Number(value); return Number.isFinite(n) ? Math.min(range.max, Math.max(range.min, n)) : range.usual; };
const sizeRange = (kind) => (CAVE_DECOR[kind]?.most ? { ...CAVE_SIZE, max: CAVE_DECOR[kind].most } : CAVE_SIZE);
// What cavern effect flags (stepFlags' result) ask for: the word as saved, and a lava floor is lava.
export const caveKindOf = (flags) => String(flags?.cavern ?? '') || (flags?.floor === 'lava' ? 'lava' : '');
const caveStepOf = (flags, kind) => { const steps = CAVE_DECOR[kind].steps, i = flags?.caveStep === null || flags?.caveStep === '' ? NaN : Number(flags?.caveStep); return Number.isInteger(i) && i >= 0 && i < steps.length ? i : steps.length - 1; };
// How to draw it, from those flags: { kind, tone }, with how much and how big the sliders and its stage come to. null: nothing here.
export function caveLook(flags) {
  const word = caveKindOf(flags); if (!word) return null;
  const [kind, tone] = word.split('-');
  if (kind === 'lava') return { kind, tone, heat: LAVA_HEAT[tone] ?? 0.6 };
  if (!Object.hasOwn(CAVE_DECOR, kind)) return { kind, tone };
  const step = CAVE_DECOR[kind].steps[caveStepOf(flags, kind)], size = inRange(flags?.caveSize, sizeRange(kind)), amount = inRange(flags?.caveAmount, CAVE_AMOUNT);
  return { kind, tone, scale: size * step.scale, amount: amount * step.amount, glow: step.glow ?? 1, torch: step.torch ?? 1, thick: (step.thick ?? 1) * (kind === 'mist' ? amount : 1) };
}
// Whether a right-click on it has anything to offer, floor or none.
export const caveHasMenu = (flags) => Object.hasOwn(CAVE_DECOR, caveKindOf(flags).split('-')[0]);
// What the right-click menu shows for it, on `floor` ('cavern': a region with no floor of its own). null: nothing to show.
export function caveMenu(own, floor) {
  if (floor === 'lava') return { kind: 'lava', choosable: true };
  const flags = stepFlags(own), [kind, tone] = caveKindOf(flags).split('-');
  if (!Object.hasOwn(CAVE_DECOR, kind)) return null;
  const decor = CAVE_DECOR[kind], byStep = !!activeStep(own)?.effect;
  return { kind, name: decor.name, choosable: floor === 'cavern' && !byStep, tones: byStep ? null : decor.tones ?? null, toneLabel: decor.toneLabel ?? '', tone: tone || decor.tones?.[0][0] || '', size: inRange(own?.caveSize, sizeRange(kind)), sizeRange: sizeRange(kind), amount: inRange(own?.caveAmount, CAVE_AMOUNT), steps: decor.steps.map((s) => s.name), step: caveStepOf(own, kind) };
}
// The flags to save to make it another of these. Lava takes the region to its floor; away from it, the region has no floor, and no lava steps.
export function caveKindFlags(own, kind) {
  if (kind === 'lava') return { floor: 'lava', cavern: '', steps: null, stepsFloor: null, step: 0, stepHidden: false };
  const away = own?.floor === 'lava' ? { floor: '', steps: null, stepsFloor: null, step: 0, stepHidden: false } : {}, tone = CAVE_DECOR[kind]?.tones?.[0][0];
  return { ...away, cavern: tone ? `${kind}-${tone}` : kind };
}

// How far the weather, the clouds and their shadows fade in at the edge of a region that keeps the weather out, in about squares (`indoorEdge` in its flags): 0 is a hard line.
export const INDOOR_EDGE = Object.freeze({ min: 0, max: 3, usual: 0.5 });
export const indoorEdgeOf = (own) => inRange(own?.indoorEdge, INDOOR_EDGE);

// The ways each floor can be painted: [key, name], the usual one first. The painters are in floor-looks.mjs.
// The shadow what stands over water can throw, by its floor; the first is its usual. What the water engine knows them by: OVER_SHADOWS, in the shader's order.
export const OVER_SHADOWS = Object.freeze(['solid', 'planks', 'slats', 'beams', 'dappled', 'arches', 'grate', 'stained', 'frosted', 'leaded', 'faint', 'cracked']);
const SHADOW_NAMES = Object.freeze({ solid: 'Solid', planks: 'Planks', slats: 'Slats', beams: 'Beams', dappled: 'Dappled', arches: 'Arches', grate: 'Grate', stained: 'Coloured light', frosted: 'Frosted', leaded: 'Leaded', faint: 'Faint', cracked: 'Cracked' });
const SHADOW_SETS = Object.freeze({ wood: ['planks', 'slats', 'beams', 'solid'], stone: ['solid', 'arches'], metal: ['solid', 'grate', 'beams'], glass: ['stained', 'frosted', 'leaded'], ice: ['faint', 'cracked'], grass: ['dappled', 'solid'], dirt: ['dappled', 'solid'], mud: ['dappled', 'solid'], sand: ['solid', 'dappled'], pebbles: ['solid', 'dappled'], snow: ['solid', 'dappled'] });
export const OVER_SOFT = Object.freeze({ min: 0, max: 1, usual: 0 });
export const OVER_DARK = Object.freeze({ min: 0.1, max: 0.9, usual: 0.45 });
// Whether a region throws a shadow: its own say, else as what stands over water does.
export const castsShadow = (own) => (typeof own?.castShadow === 'boolean' ? own.castShadow : own?.overWater === true);
// How a raised floor is built, for a floor that has posts to offer. Plain is the floor itself; the others show what real docks show from above.
export const DOCK_STYLES = Object.freeze([['', 'Plain'], ['old', 'Old boards'], ['railed', 'Railed pier']]);
export const dockStyleOf = (own) => (DOCK_STYLES.some(([key]) => key && key === own?.dockStyle) ? own.dockStyle : '');
// Whether a built floor shows its posts: yes until told not to.
export const showsPosts = (own) => own?.overPosts !== false;
// A floor's shadows, as [key, name]. (A marble floor is stone; anything unlisted, solid.)
export const overShadowChoices = (floor) => (SHADOW_SETS[floor] ?? ['solid']).map((key) => [key, SHADOW_NAMES[key]]);
// What a region throws on its floor now: it keeps a choice for each floor. { kind, soft, dark }.
export const overShadowOf = (own, floor) => {
  const set = SHADOW_SETS[floor] ?? ['solid'], chosen = own?.overShadows?.[floor], number = (value, range) => { const n = value === undefined || value === null || value === '' ? NaN : Number(value); return Number.isFinite(n) ? Math.min(range.max, Math.max(range.min, n)) : range.usual; };
  return { kind: set.includes(chosen) ? chosen : dockStyleOf(own) && set.includes('solid') ? 'solid' : set[0], soft: number(own?.overShadowSoft, OVER_SOFT), dark: number(own?.overShadowDark, OVER_DARK) };
};
export const TEXTURE_STYLES = Object.freeze({
  grass: [['meadow', 'Meadow'], ['long', 'Long grass'], ['turf', 'Short turf'], ['dry', 'Dry straw'], ['clover', 'Clover'], ['forest', 'Forest floor']],
  stone: [['flagstones', 'Flagstones'], ['cobbles', 'Cobbles'], ['dungeon', 'Dungeon blocks'], ['cave', 'Cave rock'], ['marble', 'Marble'], ['crazy', 'Crazy paving']],
  wood: [['planks', 'Planks'], ['old', 'Old dark boards'], ['pale', 'Pale boards'], ['deck', "Ship's deck"], ['logs', 'Logs'], ['parquet', 'Parquet']],
  dirt: [['earth', 'Packed earth'], ['cracked', 'Cracked dry'], ['forest', 'Forest earth'], ['road', 'Rutted road'], ['clay', 'Red clay']],
  sand: [['dunes', 'Wind ripples'], ['beach', 'Beach'], ['red', 'Red desert'], ['wet', 'Wet sand'], ['gravelly', 'Gravelly']],
  snow: [['drifts', 'Drifts'], ['powder', 'Fresh powder'], ['packed', 'Packed'], ['dirty', 'Dirty'], ['crust', 'Icy crust']],
  water: [['deep', 'Deep'], ['shallow', 'Shallow'], ['swamp', 'Swamp'], ['sea', 'Sea'], ['dark', 'Black cave pool']],
  ice: [['clear', 'Clear'], ['milky', 'Milky'], ['black', 'Black ice'], ['sheets', 'Broken sheets'], ['dusted', 'Snow-dusted']],
  mud: [['wet', 'Wet'], ['drying', 'Drying'], ['swamp', 'Swamp'], ['red', 'Red'], ['rutted', 'Rutted']],
  pebbles: [['river', 'River stones'], ['gravel', 'Gravel'], ['beach', 'Beach stones'], ['slate', 'Slate chips'], ['mixed', 'Mixed colours']],
  glass: [['leaded', 'Leaded'], ['panes', 'Large panes'], ['frosted', 'Frosted'], ['mosaic', 'Mosaic'], ['obsidian', 'Obsidian']],
  metal: [['plates', 'Plates'], ['grate', 'Grate'], ['rusted', 'Rusted plates'], ['tread', 'Tread plate'], ['copper', 'Copper']],
});
// The style a region paints a floor in (it keeps one for each floor, `textureStyles`), else that floor's usual one.
export const textureStyleOf = (own, floor) => { const styles = TEXTURE_STYLES[floor] ?? [], chosen = own?.textureStyles?.[floor]; return styles.some(([key]) => key === chosen) ? chosen : styles[0]?.[0] ?? ''; };

// Whether a region paints its floor: its own choice, else its scene's (Scene configuration), which is off so a map that is
// already painted stays as it is.
export const showsTexture = (own, sceneChoice) => (own?.floor === 'lava' || own?.cavern === 'lava' ? false : own?.texture === 'on' ? true : own?.texture === 'off' ? false : sceneChoice === 'on');
// Whether the season colours it (grass, in Scene and sky settings): the GM's tick, else only if it paints its floor, since on a
// painted map a tinted region shows as a patch.
export const takesSeason = (own, sceneChoice) => (own?.season === 'on' ? true : own?.season === 'off' ? false : showsTexture(own, sceneChoice));
// The floor it paints: the one its step walks as, so frozen water paints ice.
export const textureFloor = (own, floor) => activeStep(own)?.walks || floor;

// Where a change starts and how far it has to go: the clicked spot, a river's upstream end, else the middle. null: no shape.
export function spreadFrom(areas, at, flowTo) {
  const xs = [], ys = [];
  for (const area of areas ?? []) for (let i = 0; i + 1 < area.length; i += 2) { xs.push(area[i]); ys.push(area[i + 1]); }
  if (!xs.length) return null;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let x = at?.x ?? (x0 + x1) / 2, y = at?.y ?? (y0 + y1) / 2;
  const way = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] }[flowTo];
  if (way) { if (way[0]) x = way[0] > 0 ? x0 : x1; if (way[1]) y = way[1] > 0 ? y0 : y1; }
  let reach = 0;
  for (let i = 0; i < xs.length; i++) reach = Math.max(reach, Math.hypot(xs[i] - x, ys[i] - y));
  return { x, y, reach };
}

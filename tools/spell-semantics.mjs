import { createHash } from "node:crypto";
import {FEAR_SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-fear-designs.mjs';
import {BROAD_VARIETY_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-broad-variety-designs.mjs';
import { REVIEWED_DELIVERY } from "../scripts/catalogs/pf2e/spells/spell-delivery-designs.mjs";
import { DEEP_SPELL_MOTIFS } from "../scripts/catalogs/pf2e/spells/spell-deep-designs.mjs";
import {SPECIFIC_FALLBACK_MOTIFS,describedMaterialArea} from '../scripts/catalogs/pf2e/spells/spell-specific-fallbacks.mjs';
import {GAP_SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-gap-designs.mjs';
import {refineSpellMotif} from '../scripts/catalogs/pf2e/spells/spell-fix-designs.mjs';
import {
  AUTHORED_SPELL_DESIGNS,
  SPELL_MOTIFS,
} from "../scripts/catalogs/pf2e/spells/spell-design.mjs";

export function descriptionText(html = "") {
  return html
    .replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g, (_m, uuid, label) => {
      if (label) return label;
      const tail = uuid.split('.').at(-1);
      // Slug references contain useful native terms; opaque document IDs do
      // not. Keep those IDs in raw provenance rather than invent their label.
      return /^[a-zA-Z][a-zA-Z_-]*$/.test(tail) && !/^[a-zA-Z0-9]{16}$/.test(tail)
        ? tail.replace(/[-_]/g, ' ')
        : " ";
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function descriptionOpening(html = "") {
  // Legacy entries can start with several stat/trigger paragraphs. Those are
  // casting constraints, not the description's imagery.
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => descriptionText(match[1]))
    .filter(Boolean);
  return (
    paragraphs.find(
      (text) =>
        !/^(?:trigger|requirements?|area|range|duration|targets?|cost|saving throw)\b/i.test(
          text,
        ),
    ) ??
    descriptionText(html).split(
      /Heightened|Critical Success|Critical Failure/,
    )[0]
  );
}

export function nativeSpellDescription(item) {
 const description=item?.system?.description;
 return String(description?.value??'').trim()?description.value:description?.gm??'';
}
const signals = [
  [
    "push",
    /\b(knock(?:s|ed)? back|push(?:es|ed)?|shove|moves? (?:it|the target|the creature) up to)\b/i,
  ],
  ["impact", /\b(bludgeon\w*|impact|jolt|wracks|strikes?|blast|damage)\b/i],
  ["persistent", /\bpersistent (?:\w+ )?damage\b|\[persistent,/i],
  ["sustained", /\bsustain\b/i],
  [
    "musical",
    /\b(song|sing|singing|melody|music|musical|hymn|refrain|ballad)\b/i,
  ],
  ["swarm", /\b(swarm|swarming|flock|butterflies|bats)\b/i],
  ["flight", /\b(fly speed|soar|wings|flying)\b/i],
  ["gravity", /\b(levitate|defy gravity|floating.*ground)\b/i],
  ["drain", /\b(leeches?|drains?|siphon|steal.*life|lifeblood)\b/i],
  ["needles", /\b(needles|darts)\b/i],
  ["claws", /\b(claw(?:s|ed)?|talon(?:s|ed)?)\b/i],
  ["vines", /\b(vine(?:s)?|tendrils?|roots? wrap|entangl\w*)\b/i],
  ["ward", /\b(shield|protective|barrier|armor|armour)\b/i],
  [
    "scan",
    /\b(detect|sense|read aura|foretell|reveal.*invisible|scry|clairvoyance)\b/i,
  ],
  ["stone", /\b(stone|rock|boulder|ground cracks|earthquake)\b/i],
  ["mist", /\b(fumes|mist|fog|vapou?r|cloud of.*poison)\b/i],
  ["ray", /\b(rays?|beams?)\b/i],
  ["bolt", /\bbolts?\b/i],
  ["jet", /\bjets?\b/i],
  ["orb", /\b(orb|sphere|coalesces around)\b/i],
  [
    "heal",
    /\b(restore\w*.*hit points|regains?.*hit points|heals? (?:the|a) (?:target|creature)|healing.*wounds)\b/i,
  ],
];
const themeMotif = {
  healing: "restore",
  fear: "dread",
  divination: "eye",
  ward: "forceShield",
  flight: "flight",
  gravity: "gravity",
  poison: "poisonMist",
  disease: "poisonMist",
  weapon: "weapon",
  transform: "form",
  sonic: "sonicWave",
  summon: "summon",
};
// Narrow opening evidence only. Later save results, examples and heightened
// choices must not become the base cast's imagery.
function utilityMotif(opening, delivery, traits, theme) {
  if (!["target", "self", "emanation"].includes(delivery)) return;
  const first = opening
    .split(
      /\b(?:On a (?:failure|success)|Critical Success|Critical Failure|Success|Failure|Heightened)\b/i,
    )[0]
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ");
  if (
    /\b(?:send|sends|sending|transmit)\b[^.]*\b(?:mental message|message|words)\b/i.test(
      first,
    )
  )
    return "whisper";
  if (
    /\b(?:amplify|deaden|alter|change|reshape)\b[^.]*\bsounds?\b/i.test(first)
  )
    return "soundSculpt";
  if (/\b(?:makes? no sound|silenc(?:e|ing) all sound)\b/i.test(first))
    return "silenceField";
  if (/\b(?:glowing|temporary) runes\b/i.test(first))
    return /weapon/i.test(first) ? "weaponRunes" : "bodyRunes";
  if (
    /\b(?:encourage|empower|bolster|strengthen|invigorate)\b/i.test(first) &&
    theme !== "healing" &&
    !traits.some((trait) =>
      ["healing", "fear", "incarnate", "composition"].includes(trait),
    ) &&
    /\b(?:bonus|willing|ally|allies|yourself)\b/i.test(opening) &&
    !/\b(?:damage|attack roll against)\b/i.test(first)
  )
    return "empower";
  if (/\b(?:sap|saps|sapped)\b[^.]*\bstrength\b/i.test(first))
    return "strengthSap";
  if (
    /\b(?:ghostlike|incorporeal|ethereal)\b/i.test(first) &&
    /\b(?:become|turn|transform)\b/i.test(first)
  )
    return "spectralRush";
  if (
    /\b(?:ward|protect)\b[^.]*\b(?:against harm|protective energy|harmful effects)\b/i.test(
      first,
    )
  )
    return "protectiveWard";
  if (traits.includes("illusion") && /\bdreamy haze\b/i.test(first))
    return "charmHaze";
}
// Individually checked against the pinned PF2e descriptions. Native metadata
// can describe the secondary area, or omit an attack trait, rather than the
// initial visual delivery. Do not infer attacks from later Sustain options.
const reviewedDelivery = {
  ...REVIEWED_DELIVERY,
  "ray-of-corruption": "bolt",
  "dimensional-assault": "melee",
  "blink-charge": "melee",
  "sky-laughs-at-waves": "melee",
  "shooting-star": "bolt",
  "force-fling": "target",
  "dancing-blade": "target",
  "pyrefowl-rebuke": "target",
  // Native remote troop copies need explicitly selected troop stand-ins, not
  // unrelated caster copies. Remote destinations remain a manual choice.
  "boots-on-the-ground": "target",
  "recurring-nightmare": "point",
  "shadow-spy": "point",
  "force-bolt": "bolt",
  heartbolt: "bolt",
  "blazing-blade": "melee",
  "shambling-horror": "target",
  "final-sacrifice": "target",
  "necrotic-bomb": "target",
  "detonate-magic": "target",
  "deathly-scream": "target",
  "rebuke-death": "target",
  "incarnate-ancient-specter": "point",
  "incarnate-archmage": "point",
  "incarnate-deific-herald": "point",
  "incarnate-draconic-legion": "point",
  "incarnate-faerie-revelers": "point",
  "incarnate-kaiju": "point",
  "incarnate-skeletal-giant": "point",
  "incarnate-tempest-of-shades": "point",
  "incarnate-wild-rose": "point",
};
const reviewedDirectAttacks = new Set([
  "ray-of-corruption",
  "unbreaking-wave-containment",
]);
export function analyzeSpellDescription(item, direction) {
  const slug = direction.slug.replace(/-legacy$/, "");
  const nativeDescription = nativeSpellDescription(item);
  const opening = descriptionOpening(nativeDescription);
  direction = {
    ...direction,
    delivery: reviewedDelivery[slug] ?? direction.delivery,
  };
  // Cylinder radius and square/cube side are valid native placed footprints.
  // Do not reduce them to a self cue because they are not named "burst".
  if (direction.kind !== "ritual" && ["cylinder", "cube", "square"].includes(item.system.area?.type))
    direction.delivery = "burst";
  if (
    !reviewedDelivery[slug] &&
    direction.delivery === "bolt" &&
    item.system.traits.value.includes("attack") &&
    (/\btouch\b/i.test(item.system.range?.value ?? "") ||
      /\b(?:make|attempt)\s+(?:a\s+)?melee spell attack\b/i.test(opening))
  )
    direction.delivery = "melee";
  const text = descriptionText(nativeDescription);
  const name = item.name.toLowerCase();
  const cueText = `${name} ${opening}`;
  const facts = Object.fromEntries(
    signals.map(([id, pattern]) => [id, pattern.test(text)]),
  );
  const cues = signals
    .filter(([_id, pattern]) => pattern.test(cueText))
    .map(([id]) => id);
  const authored = AUTHORED_SPELL_DESIGNS[slug];
  const utility = utilityMotif(
    opening,
    direction.delivery,
    item.system.traits.value,
    direction.theme,
  );
  let motif = authored?.[0];
  if (!motif) {
    if (direction.kind === "ritual") motif = "generic";
    else if (utility) motif = utility;
    else if (cues.includes("musical")) motif = "song";
    else if (cues.includes("swarm")) motif = "swarm";
    else if (cues.includes("drain") && direction.delivery === "target")
      motif = "drain";
    else if (cues.includes("gravity") && direction.delivery !== "bolt")
      motif = "gravity";
    else if (
      cues.includes("flight") &&
      direction.delivery !== "bolt" &&
      (direction.theme === "flight" ||
        /\b(?:gain|gains|grant|grants|granting)\b[^.]*\bfly speed\b/i.test(
          opening,
        ))
    )
      motif = "flight";
    else if (
      cues.includes("claws") &&
      item.system.traits.value.includes("attack") &&
      /melee/.test(text)
    )
      motif = "claws";
    else if (cues.includes("needles") && direction.delivery === "bolt")
      motif = "needles";
    else if (cues.includes("vines") && direction.delivery === "bolt")
      motif = "vineLash";
    else if (
      cues.includes("ward") &&
      ["self", "target"].includes(direction.delivery)
    )
      motif = direction.theme === "fire" ? "fireShield" : "forceShield";
    else if (cues.includes("scan") && direction.delivery !== "bolt")
      motif = "eye";
    else if (cues.includes("stone") && direction.theme === "earth")
      motif = "stone";
    else if (cues.includes("mist") && direction.theme === "poison")
      motif = "poisonMist";
    else if (
      direction.delivery === "burst" &&
      ["fire", "acid", "plant", "illusion"].includes(direction.theme) &&
      (direction.theme!=='fire'||(
        /\b(?:explosion|detonat\w*|explodes?)\b/i.test(opening.split(/(?<=[.!?])\s+/)[0])&&
        !/\b(?:if|when|until|later|only)\b/i.test(opening.split(/(?<=[.!?])\s+/)[0])
      ))
    )
      motif = {
        fire: "detonation",
        acid: "acidGlob",
        plant: "growingPlants",
        illusion: "prismatic",
      }[direction.theme];
    else if (direction.delivery === "portal") motif = "portalStep";
    else if (direction.delivery === "mirror") motif = "duplicates";
    else if (direction.delivery === "vanish") motif = "lightBend";
    else if (direction.delivery === "transform") motif = "form";
    else if (
      direction.theme === "cold" &&
      cues.includes("orb") &&
      direction.delivery === "target"
    )
      motif = "frostOrb";
    else if (direction.delivery === "bolt" && cues.includes("ray"))
      motif =
        direction.theme === "cold"
          ? "icyRay"
          : direction.theme === "fire"
            ? "flameRay"
            : "energyRay";
    else if (
      direction.theme === "water" &&
      facts.push &&
      direction.delivery === "bolt"
    )
      motif = "waterJet";
    else if (
      direction.theme === "mind" &&
      direction.delivery === "target" &&
      facts.impact
    )
      motif = "mentalJolt";
    else motif = themeMotif[direction.theme] ?? "generic";
    // Split shared clusters (wards, senses, polymorphs) by element and form.
    motif = refineSpellMotif(motif, { name: item.name, traits: item.system.traits.value, theme: direction.theme });
  }
  // Directionally incompatible decorations remain native base geometry cues.
  if (
    ["cone", "line", "wall", "point", "ritual"].includes(direction.delivery) &&
    !GAP_SPELL_MOTIFS[motif] &&
    !FEAR_SPELL_MOTIFS[motif] &&
    !BROAD_VARIETY_MOTIFS[motif] &&
    !SPELL_MOTIFS[motif]?.nativeArea &&
    !["summon", "song", "swarm", "generic"].includes(motif) &&
    !(direction.delivery === 'cone' && ['coneStarFan','coneRayFan','coneObjectFan'].includes(SPELL_MOTIFS[motif].pattern)) &&
    !(direction.delivery === 'wall' && SPELL_MOTIFS[motif].pattern === 'metalBarrierCue') &&
    !(
      direction.delivery === "line" &&
      ["lineBeam", "lineFlight", "lineTiles", "lineBarrier"].includes(
        SPELL_MOTIFS[motif].pattern,
      )
    ) &&
    !(
      direction.delivery === "point" &&
      ["arrival", "hoveringFlame", "fix:summon"].includes(SPELL_MOTIFS[motif].pattern)
    )
  )
    motif = "generic";
  // Retain a concrete native material footprint; do not invent a caster rune
  // or target impact. Unrepresentable utility fiction has no automatic fallback.
  if(motif==='generic' && direction.kind!=='ritual' && item.system.area &&
     ['burst','cone','line','emanation'].includes(direction.delivery))
    motif=describedMaterialArea(opening,direction)??'generic';
  if (
    direction.delivery === "burst" &&
    !GAP_SPELL_MOTIFS[motif] &&
    !FEAR_SPELL_MOTIFS[motif] &&
    !BROAD_VARIETY_MOTIFS[motif] &&
    !DEEP_SPELL_MOTIFS[motif] &&
    !SPELL_MOTIFS[motif].nativeArea &&
    ![
      "generic",
      "detonation",
      "acidGlob",
      "growingPlants",
      "prismatic",
      "stone",
      "poisonMist",
      "burstDebris",
      "darkTeeth",
      "stormCloud",
      "launchedBomb",
      "landscapeMissile",
      "wardStrike",
      "sonicWave",
      "song",
      "swarm",
      "shadowTendrils",
      "darkShroud",
      "decay",
      "hoveringFlame",
      "geyser",
    ].includes(motif) &&
    !["areaVolley", "areaRain"].includes(SPELL_MOTIFS[motif].pattern)
  )
    motif = "generic";
  const delivery = SPELL_MOTIFS[motif].delivery ?? direction.delivery;
  const dice = Object.values(item.system.damage ?? {}).reduce(
    (sum, d) => sum + Number(d.formula.match(/^(\d+)d/)?.[1] ?? 0),
    0,
  );
  const actions = Number(item.system.time.value.match(/^([123])$/)?.[1] ?? 2);
  const previewArea = SPELL_MOTIFS[motif].previewArea;
  const nativeArea = previewArea ?? item.system.area;
  const nativeFootprint = direction.kind !== "ritual" && Boolean(nativeArea) &&
    (["burst", "cylinder", "cube", "square"].includes(nativeArea.type) && delivery === "burst" ||
     nativeArea.type === delivery && ["cone", "line", "emanation"].includes(delivery));
  const areaLabel = motif.startsWith('materialArea-') && nativeFootprint
    ? `${direction.theme[0].toUpperCase()}${direction.theme.slice(1)} ${item.system.area.type} at placed origin`
    : SPELL_MOTIFS[motif].label;
  return {
    ...(SPELL_MOTIFS[motif].theme ? {theme:SPELL_MOTIFS[motif].theme} : {}),
    delivery,
    ...(previewArea ? {previewArea} : {}),
    ...(SPELL_MOTIFS[motif].areaLayout ? {areaLayout:SPELL_MOTIFS[motif].areaLayout} : {}),
    ...(SPELL_MOTIFS[motif].slotGeometry ? {slotGeometry:SPELL_MOTIFS[motif].slotGeometry} : {}),
    ...(SPELL_MOTIFS[motif].contactFx===false ? {contactFx:false} : {}),
    nativeFootprint,
    spellAttack:
      !["shambling-horror", "aqueous-blast", "scorching-blast"].includes(
        slug,
      ) &&
      (item.system.traits.value.includes("attack") ||
        reviewedDirectAttacks.has(slug)),
    motif,
    pattern: SPELL_MOTIFS[motif].pattern,
    label: areaLabel,
    unavailable: SPELL_MOTIFS[motif].unavailable === true,
    rationale:
      (SPELL_MOTIFS[motif].unavailable ? 'No matching built-in composition. Configure this spell; generic casting effects are not played.' : authored?.[1]) ??
      (motif.startsWith('materialArea-') && nativeFootprint
        ? `${areaLabel}; native ${item.system.area.value}-foot area uses its full footprint. Material fidelity depends on the installed JB2A edition.`
        : `${areaLabel}; ${cues.length ? `description cues: ${cues.join(", ")}` : "native traits, targets and area determine the base cue"}.`),
    authored: Boolean(authored),
    analysis: text.length ? "full-description" : "native-fields-only",
    descriptionHash: createHash("sha256").update(text).digest("hex"),
    descriptionChars: text.length,
    cues,
    subject:
      ["bolt", "volley", "chain", "melee", "target"].includes(
        delivery,
      ) ||
      (item.system.target.value &&
        !/^\s*(you|self)\b/i.test(item.system.target.value) &&
        ![
          "emanation",
          "portal",
          "point",
          "ritual",
          "burst",
          "cone",
          "line",
          "wall",
        ].includes(delivery))
        ? "targets"
        : "source",
    actions,
    damageDice: dice,
    subtle: item.system.traits.value.includes("subtle"),
    deferredResidue: ["blood-chestnuts", "winter-bolt", "slashing-gust"].includes(slug) || SPELL_MOTIFS[motif].castingOnly === true,
    ...facts,
  };
}

import {createHash} from 'node:crypto';
import {SPELL_THEMES,SIGNATURES} from '../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import {SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-design.mjs';
import {analyzeSpellDescription} from './spell-semantics.mjs';
import {resolveSpellMedia,coneMaterialMatches,SPELL_SELECTION_REVISION} from './spell-asset-selection.mjs';
import {UTILITY_SPELL_DESIGNS} from '../scripts/catalogs/pf2e/spells/spell-utility-designs.mjs';
import {GAP_SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-gap-designs.mjs';
const damageTheme = {
  fire: "fire",
  cold: "cold",
  electricity: "electricity",
  acid: "acid",
  poison: "poison",
  force: "force",
  sonic: "sonic",
  vitality: "vitality",
  positive: "vitality",
  void: "void",
  negative: "void",
  spirit: "spirit",
  mental: "mind",
  bleed: "blood",
  slashing: "weapon",
  piercing: "weapon",
  bludgeoning: "earth",
};
function direction(entry) {
  const s = entry.source.system;
  const name = entry.source.name.toLowerCase();
  const slug =
    s.slug ||
    entry.path
      .split("/")
      .at(-1)
      .replace(/\.json$/, "");
  const signature =
    SIGNATURES[slug] ?? SIGNATURES[slug.replace(/-legacy$/, "")];
  const traits = s.traits.value;
  const kind =
    entry.path.includes("/rituals/") || s.ritual
      ? "ritual"
      : traits.includes("focus")
        ? "focus"
        : traits.includes("cantrip")
          ? "cantrip"
          : "spell";
  let theme = signature?.[0];
  if (!theme) {
    if (
      traits.includes("healing") ||
      Object.values(s.damage ?? {}).some(
        (d) => d.kinds?.includes("healing") && !d.kinds.includes("damage"),
      )
    )
      theme = "healing";
    else if (traits.includes("teleportation")) theme = "teleport";
    else if (traits.includes("fear")) theme = "fear";
    else if (traits.includes("curse")) theme = "curse";
    else if (traits.includes("disease")) theme = "disease";
    else if (traits.includes("illusion")) theme = "illusion";
    else if (traits.includes("fortune") || traits.includes("misfortune"))
      theme = "luck";
    else if (traits.includes("polymorph") || traits.includes("morph"))
      theme = "transform";
    else if (traits.includes("summon") || /^summon\b/.test(name))
      theme = "summon";
    else if (
      traits.includes("detection") ||
      /^(detect|read|locate|see|true seeing|clair|scry|augury|foresight|prognostic)/.test(
        name,
      )
    )
      theme = "divination";
    else if (
      s.counteraction ||
      /^(dispel|counterspell|banish|remove)/.test(name)
    )
      theme = "dispel";
    else if (/\b(fly|flight|wings|air walk|feather)\b/.test(name))
      theme = "flight";
    else if (/\b(gravity|levitate|gravitational)\b/.test(name))
      theme = "gravity";
    else if (/\b(time|haste|slow|temporal|stasis)\b/.test(name)) theme = "time";
    else if (/\b(dream|sleep|slumber|nightmare)\b/.test(name)) theme = "dream";
    else if (/\b(web|silk|spider)\b/.test(name)) theme = "web";
    else {
      theme = [
        "fire",
        "cold",
        "electricity",
        "acid",
        "poison",
        "water",
        "air",
        "earth",
        "wood",
        "metal",
        "light",
        "darkness",
        "shadow",
        "mental",
        "sonic",
        "vitality",
        "void",
        "spirit",
        "plant",
      ].find((trait) => traits.includes(trait));
      theme =
        { air: "wind", wood: "plant", darkness: "shadow", mental: "mind" }[
          theme
        ] ?? theme;
      if (!theme)
        theme = Object.values(s.damage ?? {})
          .map((d) => damageTheme[d.type])
          .find(Boolean);
      if (
        !theme &&
        /\b(shield|armor|armour|ward|protect|resist|barrier|sanctuary|aegis)\b/.test(
          name,
        )
      )
        theme = "ward";
      if (!theme && /\b(blood|vampir|sanguine|bleed)\b/.test(name))
        theme = "blood";
      if (!theme && /\b(weapon|blade|sword|strike|claw|fang)\b/.test(name))
        theme = "weapon";
      if (
        !theme &&
        /\b(vine|flora|tree|plant|leaf|bloom|verdant|thorn)\b/.test(name)
      )
        theme = "plant";
      if (!theme && /\b(ghost|spirit|soul|angel|holy)\b/.test(name))
        theme = "spirit";
      if (!theme && /\b(death|dead|necrom|corpse|undead)\b/.test(name))
        theme = "void";
      theme ??= "arcane";
    }
  }
  if (!SPELL_THEMES[theme]) throw Error(`Unknown theme ${theme}: ${name}`);
  let delivery = signature?.[1];
  if (kind === "ritual") delivery = "ritual";
  if (!delivery) {
    if (traits.includes("attack")) delivery = "bolt";
    else if (s.area?.type === "burst") delivery = "burst";
    else if (s.area?.type === "emanation") delivery = "emanation";
    else if (s.area?.type === "cone") delivery = "cone";
    else if (s.area?.type === "line") delivery = "line";
    else if (/\bwall\b/.test(name)) delivery = "wall";
    else if (theme === "summon") delivery = "point";
    else if (theme === "teleport") delivery = "portal";
    else if (theme === "transform" && !s.target.value) delivery = "transform";
    else if (s.target.value && !/^\s*(you|self)\b/i.test(s.target.value))
      delivery = "target";
    else delivery = "self";
  }
  // Some legacy spell names reference an optional area, not a native base burst.
  if (
    ["self", "transform"].includes(delivery) &&
    s.target.value &&
    !/^\s*(you|self)\b/i.test(s.target.value)
  )
    delivery = "target";
  if (delivery === "burst" && s.area?.type !== "burst")
    delivery = s.target.value ? "target" : "self";
  const notes = [];
  if (theme === "arcane")
    notes.push(
      "Generic arcane casting cue; unique spell imagery needs customization.",
    );
  if (delivery === "emanation")
    notes.push("Caster aura cue; exact emanation radius is not modeled.");
  if (delivery === "volley")
    notes.push(
      "Base volley illustration; customize shard count for action and heightened choices.",
    );
  if (delivery === "chain")
    notes.push(
      "Visual chain follows targeting order; PF2e range, saves and stopping rules remain mechanical.",
    );
  if (["cone", "wall"].includes(delivery))
    notes.push(
      `Symbolic caster cue; exact ${delivery} placement/extent is not modeled.`,
    );
  if (delivery === "line")
    notes.push(
      "Place a native line area; its origin and endpoint determine the beam.",
    );
  if (delivery === "point")
    notes.push(
      "Conjuration cue plays at caster; place the summoned creature or remote object separately.",
    );
  if (delivery === "portal")
    notes.push(
      "Cosmetic departure cue; destination travel is handled by PF2e/GM.",
    );
  if (["transform", "vanish", "mirror"].includes(delivery))
    notes.push(
      "Cosmetic afterimages only; token form, visibility and game state remain unchanged.",
    );
  if (delivery === "ritual")
    notes.push("Manual ceremony preview; ritual resolution remains manual.");
  if (
    s.overlays ||
    s.heightening?.type === "fixed" ||
    /[123] to [123]/.test(s.time.value)
  )
    notes.push(
      "Base casting mode; heightened/action-choice variants may need a customized recipe.",
    );
  if (["target", "bolt", "volley", "chain", "melee"].includes(delivery))
    notes.push("Target the affected creature(s) for target effects.");
  const trigger =
    delivery === "ritual"
      ? "manual"
      : delivery === "burst"
        ? "template"
        : traits.includes("attack")
          ? "attack"
          : Object.values(s.damage ?? {}).length &&
              !["cone", "line", "wall", "point", "self", "emanation"].includes(
                delivery,
              )
            ? "damage"
            : "use";
  return {
    slug,
    theme,
    delivery,
    trigger,
    kind,
    notes,
    quality:
      ["cone", "line", "wall", "point", "portal", "ritual"].includes(
        delivery,
      ) || theme === "arcane"
        ? "symbolic"
        : signature
          ? "signature"
          : "themed",
  };
}

export function buildSpellDesign(entry,databases,previousEntry) {
  const { source: item } = entry;
  const s = item.system;
  const animation = direction(entry);
  const design = analyzeSpellDescription(item, animation);
  if (design.theme) animation.theme = design.theme;
  if (design.authored) animation.notes=animation.notes.filter(note=>!note.startsWith('Generic arcane casting cue'));
  if (design.delivery) animation.delivery = design.delivery;
  if (design.motif === "smolder") animation.delivery = "target";
  animation.trigger =
    animation.delivery === "ritual"
      ? "manual"
      : design.nativeFootprint || ["burst", "line"].includes(animation.delivery)
        ? "template"
        : SPELL_MOTIFS[design.motif].castingOnly
          ? 'use'
        : design.spellAttack &&
            ["bolt", "target", "melee"].includes(animation.delivery)
          ? "attack"
          : Object.values(s.damage ?? {}).length &&
              !["cone", "line", "wall", "point", "self", "emanation"].includes(
                animation.delivery,
              )
            ? "damage"
            : "use";
  if (animation.delivery !== "emanation")
    animation.notes = animation.notes.filter(
      (note) => !note.startsWith("Caster aura cue"),
    );
  if (design.nativeFootprint) {
    animation.notes = animation.notes.filter(note =>
      !note.startsWith("Caster aura cue") && !note.startsWith("Symbolic caster cue") &&
      !note.startsWith("Target the affected") && !note.startsWith("Target-centered spout cue"));
    animation.notes.push("Place the native area; preview uses its footprint. Vertical extent, saves and later Sustain effects remain mechanical.");
    if (["cube", "square"].includes(s.area?.type) && /\b(?:two|four|2|4|additional)\b[^.]{0,70}\b(?:cubes|squares|spaces)\b/i.test(s.area?.details ?? s.description.value))
      animation.notes.push("Base footprint illustrates one native square/cube; multiple separated areas and heightened areas need separate placement or customization.");
  }
  if (
    ["bolt", "target", "melee", "chain", "volley"].includes(
      animation.delivery,
    ) &&
    !animation.notes.some((note) => note.startsWith("Target the affected"))
  )
    animation.notes.push("Target the affected creature(s) for target effects.");
  if (animation.delivery === "point") {
    animation.quality = "symbolic";
    if (!animation.notes.some((note) => note.startsWith("Conjuration cue")))
      animation.notes.push(
        "Conjuration cue plays at caster; place the summoned creature or remote object separately.",
      );
  }
  if (UTILITY_SPELL_DESIGNS[animation.slug.replace(/-legacy$/,'')] &&
      /\b(?:objects?|surface|clothing|stone|weapon|tool|rope|cubic foot)\b/i.test(s.target.value)) {
    if (!/\bcreature\b/i.test(s.target.value))
      animation.notes=animation.notes.filter(note=>!note.startsWith('Target the affected creature'));
    animation.notes.push('Object/surface targets need a stand-in token at that location; automatic item or wall-surface aiming is unavailable. Held-object illustrations may use the holder as a stand-in.');
  }
  if (design.authored && animation.quality !== "symbolic")
    animation.quality = "signature";
  if(design.unavailable){
    animation.quality='unconfigured';
    animation.notes=['Configure this spell before playback. Generic casting effects are not substituted.'];
  }
  if (animation.delivery === "line")
    animation.quality = design.authored ? "signature" : "themed";
  if (SPELL_MOTIFS[design.motif].symbolic) {
    animation.quality = "symbolic";
    animation.notes.push(
      design.rationale
        ? "Available JB2A artwork is a symbolic substitute; see the design rationale."
        : "Available JB2A artwork is a symbolic substitute.",
    );
  }
  if (animation.slug.replace(/-legacy$/, "") === "slither") {
    animation.quality = "symbolic";
    animation.notes.push(
      "Tentacle artwork stands in for the described snakes; exact snake artwork is unavailable in JB2A.",
    );
  }
  const cached = previousEntry;
  design.selectionRevision=SPELL_SELECTION_REVISION;
  design.selectionSignature=createHash('sha256').update(JSON.stringify(SPELL_MOTIFS[design.motif])).digest('hex');
  const compatible = cached?.design.selectionRevision===SPELL_SELECTION_REVISION && cached?.design.descriptionHash === design.descriptionHash && cached.design.motif === design.motif && cached.theme === animation.theme && cached.delivery === animation.delivery &&
    Boolean(cached.design.nativeFootprint) === design.nativeFootprint && cached.design.areaLayout === design.areaLayout &&
    JSON.stringify(cached.design.slotGeometry) === JSON.stringify(design.slotGeometry) &&
    (cached.design.selectionSignature ? cached.design.selectionSignature===design.selectionSignature : !GAP_SPELL_MOTIFS[design.motif]);
  design.assets = design.unavailable ? {cast:[],bolt:[],hit:[],aura:[],area:[]} : compatible ? structuredClone(cached.design.assets) : resolveSpellMedia(
    databases,
    animation.theme,
    SPELL_MOTIFS[design.motif],
    SPELL_THEMES[animation.theme],
    {
      name: item.name,
      slug: animation.slug,
      design: { ...design, pattern: SPELL_MOTIFS[design.motif].pattern },
      area: design.previewArea ?? s.area,
      delivery: animation.delivery,
    },
  );
  if (design.nativeFootprint && animation.delivery === 'cone' && !SPELL_MOTIFS[design.motif].symbolic) {
    const matched = Object.values(databases).every(rows => {
      const keys = new Set(rows.map(row => row.key));
      const selected = design.assets.area.find(key => keys.has(key));
      return selected && coneMaterialMatches(selected, animation.theme);
    });
    animation.quality = matched ? (design.authored ? 'signature' : 'themed') : 'symbolic';
    if (!matched) animation.notes.push('Cone shape is retained; available artwork is a geometric or symbolic substitute for the described material.');
  }
  if (design.motif === "geyser") {
    animation.quality = "symbolic";
    animation.notes.push(
      design.nativeFootprint
        ? 'Native cube footprint carries a symbolic upward water-spout illustration; vertical height and fall damage remain mechanical.'
        : "Target-centered spout cue; exact cube extent is not modeled.",
    );
  }
  if (!design.descriptionChars)
    animation.notes.push(
      "Official source has no description; this entry uses native fields only and needs manual review.",
    );
  if (animation.delivery === "volley" && design.motif === "flameRay")
    animation.notes = animation.notes.filter(
      (n) => !n.startsWith("Base volley illustration"),
    );
  if(design.unavailable)animation.quality='unconfigured';
  return {
    id: item._id,
    name: item.name,
    img: item.img,
    rank: s.level.value,
    traditions: s.traits.traditions,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    edition:
      s.publication?.remaster === false || entry.path.includes("legacy")
        ? "legacy"
        : "remaster",
    publication: s.publication?.title ?? "",
    path: entry.path,
    area: design.previewArea ?? s.area,
    ...animation,
    design,
  };
}

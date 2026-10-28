// The sounds Animater ships (assets/sounds) as media library entries, so they can be found, auditioned and put on a
// sound stage like any pack's: creature voices, creature movement, and hits and surfaces. Each takes of one sound
// (attack-01, attack-02…) is one family, shown as one card with its variants.
import { BUNDLED_SOUND_DIRS } from "../../../data/bundled-sounds.mjs";

const ROOT = "modules/animater/assets/sounds/";
const USES = new Set(["attack", "hurt", "death", "idle", "alert", "roar", "growl", "pain", "taunt", "laugh", "breath", "step", "flap"]);
const title = (text) => text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
// A file's name without its take number (attack-03) or source id (acid-fizz-713705-0).
const stem = (name) => name.replace(/\.[^.]+$/, "").replace(/(?:[-_ ]\d+)+$/, "").replace(/[-_]\d{4,}$/, "");
const CATEGORY = { voices: "Creature voices", creatures: "Creature movement", surfaces: "Hits & surfaces" };

// family: the take group; label: what it is, in words ("Ghoul Male · Hurt").
export function describeBundledSound(dir, name) {
  const parts = dir.split("/"), top = parts[0], base = stem(name);
  if (top === "voices" && parts[1] === "library") {
    const voice = parts.at(-1);
    return { family: `${voice}-${base}`, label: `${title(voice)} · ${title(base)}` };
  }
  if (top === "voices" && parts[1] === "khron") {
    const [, , creature, use] = parts;
    return { family: `khron-${creature}-${use ?? base}`, label: `${title(creature)} · ${title(use ?? base)}` };
  }
  if (top === "voices") {
    // boom-fantasy-goblin-attack, zombie-zombie-goofy-hurt: the creature's own words, its use last.
    const words = base.split("-").filter((w, i, all) => w !== all[i - 1] && w !== "boom");
    const use = USES.has(words.at(-1)) ? words.pop() : null;
    return { family: `voice-${base}`, label: `${title(words.join(" "))}${use ? ` · ${title(use)}` : ""}` };
  }
  // footstep_concrete_000, flight-any-862337-0, acid-fizz-713705-0.
  const words = base.split(/[-_]/).filter((w) => w && w !== "any");
  return { family: `${top}-${base}`, label: title(words.join(" ").replace(/([a-z])([A-Z])/g, "$1 $2")) };
}

let memo = null;
export function bundledSounds() {
  if (memo) return memo;
  memo = [];
  for (const [dir, files] of Object.entries(BUNDLED_SOUND_DIRS)) {
    const category = CATEGORY[dir.split("/")[0]] ?? "Animater sounds";
    for (const name of files) memo.push({ type: "audio", file: `${ROOT}${dir}/${name}`, source: "Animater", category, ...describeBundledSound(dir, name) });
  }
  return memo;
}

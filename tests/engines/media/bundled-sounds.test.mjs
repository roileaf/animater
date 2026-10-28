import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { bundledSounds, describeBundledSound } from "../../../scripts/engines/media/bundled-sounds.mjs";
import { mergeMedia, mediaGroups } from "../../../scripts/engines/media/media-library-model.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

test("every sound Animater ships is in the media library, and only those", () => {
  const sounds = bundledSounds();
  const onDisk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? onDisk(path.join(dir, e.name)) : /\.(?:ogg|mp3|wav|flac|m4a|webm)$/i.test(e.name) ? [e.name] : []);
  assert.equal(sounds.length, onDisk(path.join(root, "assets/sounds")).length, "the list matches assets/sounds (run tools/build-bundled-sounds.mjs)");
  for (const s of sounds) assert.ok(existsSync(path.join(root, "..", s.file.replace(/^modules\//, ""))), s.file);
  const items = mergeMedia(sounds);
  assert.equal(items.length, sounds.length, "every file is a valid library entry with its own id");
  assert.ok(items.every((i) => i.type === "audio" && i.source === "Animater" && i.label && !/\d{4,}/.test(i.label)));
  assert.deepEqual([...new Set(items.map((i) => i.category))].sort(), ["Creature movement", "Creature voices", "Hits & surfaces"]);
  // Takes of one sound are one card.
  assert.ok(mediaGroups(items, { type: "audio" }).groups.length < sounds.length / 5);
});

test("bundled sounds read as what they are", () => {
  assert.deepEqual(describeBundledSound("voices/library/zombie/ghoul-male", "hurt-30.ogg"), { family: "ghoul-male-hurt", label: "Ghoul Male · Hurt" });
  assert.equal(describeBundledSound("voices/khron/aberration/attack", "CREAHmn_Aberration_Attack_01.ogg").label, "Aberration · Attack");
  assert.equal(describeBundledSound("voices/goblin", "boom-fantasy-goblin-attack-01.ogg").label, "Fantasy Goblin · Attack");
  assert.equal(describeBundledSound("surfaces/freesound", "acid-fizz-713705-0.ogg").label, "Acid Fizz");
  assert.equal(describeBundledSound("surfaces/kenney", "footstep_concrete_000.ogg").label, "Footstep Concrete");
  assert.equal(describeBundledSound("creatures/completed", "flight-any-862337-0.ogg").label, "Flight");
});

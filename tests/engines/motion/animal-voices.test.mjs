import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ANIMAL_VOICES, SILENT_ANIMALS, WILD_SOUNDS, WILD_GAPS } from '../../../scripts/engines/motion/wildlife.mjs';
import { UNDERGROUND_SOUNDS, CRITTER_GAPS } from '../../../scripts/engines/motion/underground-sounds.mjs';
import { REGION_ANIMAL_GROUPS } from '../../../scripts/engines/motion/region-animals.mjs';

const root = new URL('../../../', import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');
const filesOf = (key) => WILD_SOUNDS[key] ?? UNDERGROUND_SOUNDS[key] ?? [];

test('every animal a region can be given has its own sounds, or is named as silent', () => {
  const kinds = REGION_ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k));
  assert.ok(kinds.length > 20);
  for (const kind of kinds) assert.ok(ANIMAL_VOICES[kind]?.length || SILENT_ANIMALS.includes(kind), `${kind} has no sound`);
});

test('the scene-only animals have sounds too', () => {
  for (const kind of ['hawk', 'crows', 'herons', 'gulls', 'ducks', 'crickets', 'dragonflies', 'crabs']) assert.ok(ANIMAL_VOICES[kind]?.length, kind);
});

test('each animal sound has recordings on disk, a wait between calls and a volume to play at', () => {
  const main = read('scripts/main.mjs');
  const wild = main.match(/^const WILD_SOUND = (\{.*\});$/m)?.[1] ?? '', critter = main.match(/^const CRITTER_SOUND = (\{.*\});$/m)?.[1] ?? '';
  assert.ok(wild && critter, 'WILD_SOUND and CRITTER_SOUND found in main.mjs');
  for (const key of new Set(Object.values(ANIMAL_VOICES).flat())) {
    const files = filesOf(key);
    assert.ok(files.length, `${key} has no recordings`);
    for (const f of files) assert.ok(fs.existsSync(new URL(f.replace(/^modules\/animater\//, ''), root)), f);
    assert.ok(WILD_GAPS[key] || CRITTER_GAPS[key], `${key} has no wait`);
    assert.ok(new RegExp(`[{ ]${key}: \\{ volume`).test(WILD_SOUND_OR(wild, critter)), `${key} has no volume in main.mjs`);
  }
});
const WILD_SOUND_OR = (a, b) => `${a} ${b}`;

test('each animal sound is called for by some engine, not only listed', () => {
  const dir = new URL('scripts/engines/motion/', root);
  // The tables themselves name every sound; what counts is a call elsewhere.
  const tables = /export const (WILD_SOUNDS|UNDERGROUND_SOUNDS|ANIMAL_VOICES) = Object\.freeze\(\{[\s\S]*?\n\}\);|export const (WILD_GAPS|CRITTER_GAPS) = .*/g;
  const code = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => fs.readFileSync(new URL(f, dir), 'utf8').replace(tables, '')).join('\n');
  for (const key of new Set(Object.values(ANIMAL_VOICES).flat())) assert.ok(code.includes(`'${key}'`), `${key} is never played`);
});

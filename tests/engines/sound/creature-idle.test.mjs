import test from 'node:test';
import assert from 'node:assert/strict';
import { voicesThisTurn, parseCreatureSoundDb, pickSoundSet, idleSoundFile, idleShape, seeded, IDLE_CHANCE } from '../../../scripts/engines/sound/creature-idle.mjs';

// The shape of PF2e Creature Sounds' bundle: named sets, then the database with inline ones.
const BUNDLE = `
function getActorName(actor) { return actor.name; }
const Dragon = {
  display_name: "Dragon",
  category: "Dragons",
  notes: "",
  hurt_sounds: [
    "modules/pf2e-creature-sounds/sounds/Dragon_Hurt_01.m4a"
  ],
  attack_sounds: [
    "modules/pf2e-creature-sounds/sounds/Dragon_Attack_01.m4a",
    "modules/pf2e-creature-sounds/sounds/Dragon_Attack_02.m4a"
  ],
  death_sounds: [],
  creatures: [],
  keywords: [
    "dragon",
    "wyrm"
  ],
  traits: [
    "dragon"
  ],
  size: 4
};
const Troll = {
  display_name: "Troll",
  category: "Giants",
  notes: "",
  hurt_sounds: [],
  attack_sounds: [
    "modules/pf2e-creature-sounds/sounds/Troll_Attack_01.m4a"
  ],
  death_sounds: [],
  creatures: [
    "Troll King"
  ],
  keywords: [
    "troll"
  ],
  traits: [
    ["giant", "troll"]
  ],
  size: 3
};
const creature_sounds_db = {
  Dragon,
  Troll,
  "Female Creature": {
    display_name: "Hag",
    category: "Monstrous Humanoids",
    notes: "",
    hurt_sounds: [],
    attack_sounds: [
      "modules/pf2e-creature-sounds/sounds/Hag_Attack_01.m4a"
    ],
    death_sounds: [],
    creatures: [],
    keywords: [
      "hag"
    ],
    traits: [
      "hag",
      "female"
    ],
    size: 2
  }
};
function createEmptySoundSet() { const emptySoundSet = { id: "", display_name: "", category: CUSTOM_CATEGORY, hurt_sounds: [] }; }
`;

test('the idle chance is seeded by combat, round and turn: every client agrees, about a third of turns', () => {
  const a = voicesThisTurn({ combatId: 'c1', round: 2, turn: 3 });
  for (let i = 0; i < 5; i++) assert.equal(voicesThisTurn({ combatId: 'c1', round: 2, turn: 3 }), a, 'same turn, same answer');
  let yes = 0;
  for (let r = 1; r <= 40; r++) for (let t = 0; t < 10; t++) if (voicesThisTurn({ combatId: 'abc', round: r, turn: t })) yes++;
  assert.ok(yes / 400 > IDLE_CHANCE - 0.1 && yes / 400 < IDLE_CHANCE + 0.1, `about ${IDLE_CHANCE} (${yes / 400})`);
  assert.equal(voicesThisTurn({ combatId: '', round: 1, turn: 0 }), false);
  assert.equal(voicesThisTurn({ combatId: 'c', round: null, turn: undefined }), false);
  assert.equal(voicesThisTurn({ combatId: 'c1', round: 2, turn: 3, chance: 0 }), false);
  assert.equal(voicesThisTurn({ combatId: 'c1', round: 2, turn: 3, chance: 1 }), true);
  assert.ok(seeded('x') >= 0 && seeded('x') < 1);
});
test("PF2e Creature Sounds' sets are read from its bundle by id, named and inline; anything else is skipped", () => {
  const db = parseCreatureSoundDb(BUNDLE);
  assert.deepEqual(Object.keys(db).sort(), ['Dragon', 'Female Creature', 'Troll']);
  assert.equal(db.Dragon.attack_sounds.length, 2);
  assert.deepEqual(db.Troll.traits, [['giant', 'troll']]);
  assert.equal(db['Female Creature'].display_name, 'Hag');
  assert.deepEqual(parseCreatureSoundDb(null), {});
  assert.deepEqual(parseCreatureSoundDb('const X = { display_name: oops }'), {});
});
test('a creature gets its own chosen set, an exact name, then the best keyword and trait fit; none is silent', () => {
  const db = parseCreatureSoundDb(BUNDLE);
  assert.equal(pickSoundSet({ name: 'Young Red Dragon', traits: ['dragon', 'fire'], size: 3 }, db).id, 'Dragon');
  assert.equal(pickSoundSet({ name: 'Troll King', traits: [] }, db).id, 'Troll', 'exact creature name');
  assert.equal(pickSoundSet({ name: 'Bog Beast', traits: ['giant', 'troll'], size: 3 }, db).id, 'Troll', 'a trait set all matched');
  assert.equal(pickSoundSet({ name: 'Ooze', traits: ['ooze'] }, db), null, 'nothing fits');
  assert.equal(pickSoundSet({ name: 'Ancient Wyrm', chosen: 'none' }, db), null, 'chosen silence');
  assert.equal(pickSoundSet({ name: 'Ooze', chosen: 'Troll' }, db).id, 'Troll', 'its own choice wins');
  const custom = { 'Custom-1': { id: 'Custom-1', display_name: 'Mine', attack_sounds: ['worlds/x/roar.ogg'], hurt_sounds: [] } };
  assert.equal(pickSoundSet({ name: 'Ooze', chosen: 'Custom-1' }, db, custom).id, 'Custom-1', 'a GM custom set');
});
test('the idle file is one of its attack voices, the same for the same seed; pitched lower the heavier', () => {
  const db = parseCreatureSoundDb(BUNDLE);
  const f = idleSoundFile(db.Dragon, 'c1:2:3');
  assert.ok(db.Dragon.attack_sounds.includes(f));
  assert.equal(idleSoundFile(db.Dragon, 'c1:2:3'), f);
  assert.equal(idleSoundFile({ attack_sounds: [] }, 's'), null);
  assert.equal(idleSoundFile(null, 's'), null);
  const large = idleShape(3, 's'), grg = idleShape(5, 's');
  assert.ok(grg.rate < large.rate, 'heavier is lower');
  assert.ok(large.rate <= 1 && grg.rate >= 0.7);
  assert.ok(large.volume > 0.3 && grg.volume <= 0.75, 'modest');
  assert.deepEqual(idleShape(4, 'q'), idleShape(4, 'q'));
});

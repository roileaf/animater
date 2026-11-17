import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PICK_LOCK_SYSTEMS, LOCK_QUALITIES } from '../../scripts/engines/props/pick-lock.mjs';
import { wallBreakFieldsHTML } from '../../scripts/ui/prop-config.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const block = (from) => {
  const at = main.indexOf(from);
  assert.ok(at > 0, from);
  return main.slice(at, main.indexOf('\r\n}\r\n', at) + 3);
};

test('the engine decides the lock, and the shell only asks and writes', () => {
  assert.match(main, /from "\.\/engines\/props\/pick-lock\.mjs"/);
  for (const fn of ['pickLockPrompt', 'pickLockResult', 'lockPicked', 'lockDCOf', 'lockSuccessesNeeded', 'lockProgressOf']) {
    assert.ok(main.includes(fn), `${fn} is used rather than rewritten`);
  }
  // Nothing of PF2e's degrees or the lock ladder is worked out here.
  assert.ok(!/criticalSuccess["']\s*\?/.test(block('async function judgePickLock')), 'the shell never judges a degree itself');
});

test('only a thing that is actually locked offers its lock to be picked', () => {
  const kind = block('const lockedKindOf = (doc) => {');
  assert.ok(kind.includes('doc.ds === 2'), 'a door Foundry calls locked');
  assert.ok(kind.includes('windowLocked') && kind.includes('closesWindow('), 'or one of our own windows the GM locked');
  assert.ok(kind.includes('return null'), 'and nothing else');
  assert.match(main, /const canPick = lockedKindOf\(doc\) === "door" && !!pickLockWording\(sys\);/);
});

test('a locked door offers picking beside forcing and hitting', () => {
  const choice = block('async function doorChoice(');
  assert.ok(choice.includes('action: "pick", label: "Pick the lock"'), 'the button is there');
  assert.ok(choice.includes('else if (choice === "pick") pickLockAsk(doc, scene, false);'), 'and it leads somewhere');
  assert.ok(choice.includes('canPick ?'), 'only when the lock can be picked');
  // A system with no attack still gets the choice when it has both ways in.
  assert.match(main, /if \(attackable \|\| \(canPick && canForce\)\)/);
  assert.match(main, /if \(canPick\) return pickLockAsk\(doc, scene, true\);/);
});

test('a window that used to only rattle now offers the picks', () => {
  assert.match(main, /if \(lockedKindOf\(doc\) === "window"\) pickLockAsk\(doc, doc\.parent, true\);/);
  // The GM keeps the right click for locking it; Alt gets them the picks, as Force Open does on a door.
  assert.match(main, /if \(game\.user\.isGM && !alt\) \{ void lockWindow\(doc\); return; \}/);
  assert.ok(main.includes('that window is locked. Right click it to pick the lock.'), 'and the rattle says so');
});

test('the one who tries rolls; the GM judges against its own lock and is the only one that writes', () => {
  const judge = block('async function judgePickLock');
  assert.ok(judge.includes('if (!game.users.activeGM?.isSelf) return;'), 'one screen judges');
  assert.ok(judge.includes('const dc = lockDCOf(own, sys)'), 'and reads the DC from the wall');
  assert.ok(!judge.includes('flag.dc'), 'never the DC the message claims');
  assert.ok(judge.includes('await afterDice('), 'after the dice have finished rolling');
  assert.ok(judge.includes('{ ds: 0 }'), 'a door is unlocked');
  assert.ok(judge.includes('[`flags.${ID}.windowLocked`]: false'), 'a window is unlocked');
  // held is after.progress, unless the GM was asked and said the lock holds after all (success-choices.mjs).
  assert.ok(judge.includes('let opened = after.opened, held = after.progress;'), 'and a lock that held keeps what it gave up');
  assert.ok(judge.includes('lockProgress`]: held'), 'which is what is written');
});

test('nothing is said in chat but a broken toolkit', () => {
  const judge = block('async function judgePickLock');
  assert.ok(judge.includes('if (!got.breaks) return;'), 'a lock that held or gave a little says nothing');
  assert.ok(judge.indexOf('ChatMessage.create') > judge.indexOf('if (!got.breaks) return;'), 'the only message is after that gate');
  assert.ok(judge.includes('whisper'), 'and it is not shouted at the table');
  assert.ok(judge.includes('message.author?.id'), 'the one who broke them is told too');
});

test('a lock is set up where everything else about the wall is', () => {
  for (const [args, what] of [[{ door: 1, own: {}, system: 'pf2e' }, 'door'], [{ door: 0, own: {}, system: 'pf2e', windowKind: 'glassWindow' }, 'window']]) {
    const html = wallBreakFieldsHTML({ ...args, sceneOn: true });
    assert.ok(html.includes('breakWall.lock"'), `${what} has a lock quality`);
    assert.ok(html.includes('breakWall.lockDC"'), `${what} has a DC of its own`);
    assert.ok(html.includes('breakWall.lockSuccesses"'), `${what} takes as many ways in as the GM says`);
    for (const q of LOCK_QUALITIES) assert.ok(html.includes(`value="${q}"`), `${what} offers ${q}`);
  }
  // A system with no lockpicking roll is offered no lock at all, rather than a field that does nothing.
  assert.ok(!wallBreakFieldsHTML({ door: 1, own: {}, sceneOn: true, system: 'swade' }).includes('breakWall.lock"'));
});

test('every system that picks locks can really roll one', () => {
  const roll = block('async function rollPickLock(');
  for (const sys of PICK_LOCK_SYSTEMS) assert.ok(roll.includes(`"${sys}"`), `${sys} has a roll`);
  // PF2e has its own Pick a Lock action, which carries the action's traits and tags its message; a bare skill check
  // does neither, so the action leads and the check is only the fallback.
  assert.ok(roll.includes('actions.get("pick-a-lock")'), 'PF2e and SF2e use the system’s own action');
  assert.ok(roll.indexOf('actions.get("pick-a-lock")') < roll.indexOf('skills?.thievery'), 'and the plain check comes after it');
  assert.ok(roll.includes('action:pick-a-lock'), 'its message is recognised by the action it names');
  assert.ok(roll.includes('skills?.thievery'), 'PF2e and SF2e fall back to Thievery');
  assert.ok(roll.includes('rollToolCheck'), "D&D 5e rolls thieves' tools");
  assert.ok(roll.includes('tool: "thief"'), 'by the tool 5e names');
  assert.ok(roll.indexOf('rollToolCheck') < roll.indexOf('"slt"'), 'and Sleight of Hand is only the fallback for an older 5e');
  assert.ok(roll.includes('"finesse"'), 'Daggerheart rolls Finesse');
  assert.ok(roll.includes('"agility"'), 'Draw Steel tests Agility');
  assert.ok(roll.includes('return false'), 'and a system whose roll is not there says so rather than pretending');
});

test('main.mjs is still CRLF throughout', () => {
  assert.equal((main.match(/(?<!\r)\n/g) || []).length, 0);
});

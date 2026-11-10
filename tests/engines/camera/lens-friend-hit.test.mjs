import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { friendHitClip, isFriendlyHit, friendHitPlacement, FRIEND_HIT_CLIPS, createFriendHitPlayer } from '../../../scripts/engines/camera/lens-friend-hit.mjs';

// Roi: "some sort of animation before the splatter of the enemy blood that will indicate that the hit was from a
// friend, like a woosh arrow or a sword arcing (based on the weapon\spell)".

test('the clip follows the weapon or spell', () => {
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'slashing', itemName: 'Longsword' }), 'sword');
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'slashing', itemName: 'Greataxe' }), 'axe');
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'piercing', itemName: 'Spear' }), 'spear');
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'bludgeoning', itemSlug: 'warhammer' }), 'mace');
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'piercing', itemName: 'Mystery prod' }), 'spear', 'by damage type when the name says nothing');
  assert.equal(friendHitClip({ attackKind: 'ranged', type: 'piercing', itemName: 'Composite Longbow' }), 'arrow');
  assert.equal(friendHitClip({ attackKind: 'melee', type: 'piercing', itemName: 'Longbow' }), 'arrow', 'D&D weapons all count as melee');
  assert.equal(friendHitClip({ attackKind: 'spell', type: 'fire', itemName: 'Produce Flame' }), 'fire');
  assert.equal(friendHitClip({ attackKind: 'spell', type: 'cold', itemName: 'Ray of Frost' }), 'cold');
  assert.equal(friendHitClip({ attackKind: 'spell', type: 'electricity', itemName: 'Electric Arc' }), 'lightning');
  assert.equal(friendHitClip({ attackKind: 'spell', type: 'force', itemName: 'Force Barrage' }), 'arcane');
  assert.equal(friendHitClip({ attackKind: 'spell', type: 'acid' }), 'arcane');
  assert.equal(friendHitClip({ attackKind: 'other', type: 'fire', itemName: 'Fire Bolt' }), 'fire');
  assert.equal(friendHitClip({}), null, 'nothing known, no cue');
  for (const key of ['sword', 'axe', 'spear', 'mace', 'arrow', 'fire', 'cold', 'lightning', 'arcane']) assert.ok(FRIEND_HIT_CLIPS[key].file.endsWith('.webm'));
});

test('only a friend\'s blow, not the player\'s own and not a foe\'s', () => {
  const tok = (id, disposition, isOwner = false) => ({ id, document: { disposition }, actor: { isOwner } });
  const mine = tok('me', 1, true);
  assert.equal(isFriendlyHit({ attacker: tok('ally', 1), near: { token: mine } }), true);
  assert.equal(isFriendlyHit({ attacker: mine, near: { token: mine } }), false, 'the player struck it themself');
  assert.equal(isFriendlyHit({ attacker: tok('foe', -1), near: { token: mine } }), false);
  assert.equal(isFriendlyHit({ attacker: tok('pet', 0, true), near: { token: mine } }), true, 'another creature of theirs');
  assert.equal(isFriendlyHit({ attacker: null, near: { token: mine } }), false);
});

test('the blow lands on the enemy, big, turned to come from the friend', () => {
  const view = { width: 1600, height: 900 }, to = { x: 900, y: 500 };
  const sword = friendHitPlacement(FRIEND_HIT_CLIPS.sword, { from: { x: 400, y: 500 }, to, view });
  assert.equal(sword.angle, 0);
  assert.ok(Math.abs(sword.scale * FRIEND_HIT_CLIPS.sword.span - 900 * 0.95) < 1e-6, 'the swing about the screen\'s height across');
  assert.match(sword.transform, /^translate\(900px,500px\) rotate\(0rad\) translate\(-/);
  const bolt = friendHitPlacement(FRIEND_HIT_CLIPS.fire, { from: { x: 900, y: 100 }, to, view });
  assert.ok(Math.abs(bolt.angle - Math.PI / 2) < 1e-9, 'from above');
  assert.ok(bolt.height >= 900 * 0.7 - 1, 'the bolt itself big');
});

test('the clip keeps its exact size past Foundry\'s video max-width (found live: the bolt hit short of the target)', () => {
  const src = readFileSync(new URL('../../../scripts/engines/camera/lens-friend-hit.mjs', import.meta.url), 'utf8');
  assert.match(src, /video\.style\.cssText = `[^`]*max-width:none;[^`]*object-fit:fill;/);
});

test('a clip that cannot play still lets the blood land at once', async () => {
  let hits = 0;
  const player = createFriendHitPlayer({ doc: { hidden: true }, win: {} });
  await player.play({ clip: FRIEND_HIT_CLIPS.sword, url: 'x.webm', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, view: { width: 2, height: 2 }, onHit: () => hits++ });
  await player.play({ clip: FRIEND_HIT_CLIPS.sword, url: null, from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, onHit: () => hits++ });
  assert.equal(hits, 2);
});

test('the lens plays the cue before a friend\'s hit, behind its own switch', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("lensFriendHit"/);
  assert.match(main, /role === "attacker" && friendHitOn\(\) && isFriendlyHit\(\{ attacker, near \}\)/);
  assert.match(main, /friendHit\.play\(\{[^}]*onHit: show \}\)/);
});

test('the damage showcase previews a friend\'s blow with a weapon or spell picked', async () => {
  const { DamageShowcaseUI, FRIEND_WEAPONS } = await import('../../../scripts/ui/damage-showcase-ui.mjs');
  for (const [key] of FRIEND_WEAPONS) if (key) assert.ok(FRIEND_HIT_CLIPS[key], key);
  const calls = [];
  const tokens = [{ id: 'a', name: 'Ann', pc: true, selected: true }, { id: 'b', name: 'Orc', pc: false, targeted: true }];
  const w = { render() {}, host: { damageShowcase: () => ({ tokens, presets: {}, settings: { friendHit: true, jb2a: true } }), previewLensFriend: async (o) => { calls.push(o); return true; } } };
  const ui = new DamageShowcaseUI(w);
  const html = ui.html();
  assert.match(html, /data-action="damage-friend"[^>]*>▶ A friend hits Orc</);
  assert.match(html, /data-damage="friendWeapon"/);
  ui.change({ dataset: { damage: 'friendWeapon' }, value: 'fire' });
  await ui.action('damage-friend', {});
  assert.deepEqual([calls[0].mineId, calls[0].otherId, calls[0].weapon], ['a', 'b', 'fire']);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /previewLensFriend: \(o\) => lensPreview\?\.friend\(o\)/);
  assert.match(main, /busy: \(\) => [^\n]*friendHit\.playing/);
});

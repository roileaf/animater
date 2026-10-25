import test from 'node:test';
import assert from 'node:assert/strict';
import { DamageShowcaseUI, DAMAGE_SHOWCASE_PAGE, BLOOD_PRESETS } from '../../scripts/ui/damage-showcase-ui.mjs';

function fixture(extra = {}) {
  const calls = [];
  const snapshot = {
    tokens: [{ id: 'orc', name: '<Orc>', img: 'orc.webp', color: '#a51414', bleeds: true }, { id: 'golem', name: 'Golem', color: '#5f4d39', bleeds: false }],
    presets: { humanoid: '#a51414', ooze: '#f3900f' },
    settings: { amount: 'heavy', gore: 'full', heartbeat: true, tunnel: true, local: true },
  };
  const w = { page: DAMAGE_SHOWCASE_PAGE, render: () => calls.push('render'),
    host: { damageShowcase: () => snapshot,
      previewLensHit: (o) => calls.push(['hit', o]), previewLensDeal: (o) => calls.push(['deal', o]),
      previewLensLinger: (o) => calls.push(['linger', o]), stopLensPreview: () => calls.push('stop'), ...extra } };
  const ui = new DamageShowcaseUI(w);
  ui.html();
  return { w, ui, calls, snapshot };
}

test('the page names who sees what and escapes token names', () => {
  const { ui } = fixture();
  const html = ui.html();
  assert.match(html, /&lt;Orc&gt;/);
  assert.doesNotMatch(html, /<Orc>/);
  assert.match(html, /players/i);
  assert.match(html, /Splatter/);
  assert.match(html, /bloodless/i);
  for (const a of ['damage-hit', 'damage-deal', 'damage-linger-start', 'damage-linger-stop']) assert.match(html, new RegExp(`data-action="${a}"`));
  assert.match(html, /no blood/i, 'bloodless tokens are marked');
});

test('"Your creature is hit" previews the share of max HP, crit and victim colour', async () => {
  const { ui, calls } = fixture();
  ui.change({ dataset: { damage: 'share' }, value: '0.6' });
  ui.change({ dataset: { damage: 'crit' }, type: 'checkbox', checked: true });
  ui.change({ dataset: { damage: 'victimColor' }, value: 'ooze' });
  assert.equal(await ui.action('damage-hit', { dataset: {} }), true);
  const [, o] = calls.find((c) => c[0] === 'hit');
  assert.deepEqual(o, { share: 0.6, crit: true, color: '#f3900f', bleeds: true, amount: null, gore: null, damageType: 'slashing' });
  // A scene token's own blood.
  ui.change({ dataset: { damage: 'victimColor' }, value: 'token:golem' });
  await ui.action('damage-hit', { dataset: {} });
  const last = calls.filter((c) => c[0] === 'hit').at(-1)[1];
  assert.equal(last.color, '#5f4d39');
  assert.equal(last.bleeds, false);
});

test('"Your creature hits an enemy" previews damage against max HP, crit, side and the enemy blood', async () => {
  const { ui, calls } = fixture();
  ui.change({ dataset: { damage: 'enemy' }, value: 'token:orc' });
  ui.change({ dataset: { damage: 'damage' }, value: '25' });
  ui.change({ dataset: { damage: 'enemyMax' }, value: '40' });
  ui.change({ dataset: { damage: 'side' }, value: 'right' });
  await ui.action('damage-deal', { dataset: {} });
  const [, o] = calls.find((c) => c[0] === 'deal');
  assert.deepEqual(o, { damage: 25, max: 40, crit: false, color: '#a51414', bleeds: true, side: 'right', amount: null, gore: null, damageType: 'slashing' });
});

test('variant buttons preview Heavy/Subtle and gore Full/Subtle without saving; Saved goes back', async () => {
  const { ui, calls } = fixture();
  await ui.action('damage-amount', { dataset: { value: 'subtle' } });
  await ui.action('damage-gore', { dataset: { value: 'subtle' } });
  await ui.action('damage-hit', { dataset: {} });
  const o = calls.filter((c) => c[0] === 'hit').at(-1)[1];
  assert.equal(o.amount, 'subtle');
  assert.equal(o.gore, 'subtle');
  await ui.action('damage-amount', { dataset: { value: 'saved' } });
  await ui.action('damage-hit', { dataset: {} });
  assert.equal(calls.filter((c) => c[0] === 'hit').at(-1)[1].amount, null);
  assert.ok(calls.includes('render'));
});

test('the low HP loop starts at the chosen HP% and stops', async () => {
  const { ui, calls } = fixture();
  ui.change({ dataset: { damage: 'lowHp' }, value: '0.1' });
  await ui.action('damage-linger-start', { dataset: {} });
  assert.deepEqual(calls.find((c) => c[0] === 'linger')[1], { hp: 0.1, amount: null, gore: null, damageType: 'slashing' });
  await ui.action('damage-linger-stop', { dataset: {} });
  assert.ok(calls.includes('stop'));
  ui.stop();
  assert.equal(calls.filter((c) => c === 'stop').length, 2);
});

test('other actions are left to the workspace; players are refused', async () => {
  const { ui, w } = fixture();
  assert.equal(await ui.action('showcase-play', {}), false);
  assert.equal(ui.change({ dataset: {} }), false);
  w.host.playerMode = true;
  await assert.rejects(ui.action('damage-hit', { dataset: {} }), /Only a GM/);
  assert.ok(BLOOD_PRESETS.humanoid);
});

test("without Splatter the host's Blood colours table is the preset list, labelled by type with its colours", async () => {
  const { ui, calls, snapshot } = fixture();
  snapshot.presets = { humanoid: { color: '#7a0d0d', bleeds: true, label: 'Humanoid' }, construct: { color: '#3a3530', bleeds: false, label: 'Construct' }, plant: { color: '#00ff00', bleeds: true, label: 'Plant' } };
  const html = ui.html();
  assert.match(html, /Humanoid · #7a0d0d/);
  assert.match(html, /Construct · no blood/);
  assert.doesNotMatch(html, /value="ooze"/, 'only the types the host sent');
  ui.change({ dataset: { damage: 'enemy' }, value: 'plant' });
  await ui.action('damage-deal', { dataset: {} });
  assert.equal(calls.find((c) => c[0] === 'deal')[1].color, '#00ff00');
  ui.change({ dataset: { damage: 'victimColor' }, value: 'construct' });
  await ui.action('damage-hit', { dataset: {} });
  assert.equal(calls.find((c) => c[0] === 'hit')[1].bleeds, false);
  // No presets at all: Animater's defaults.
  snapshot.presets = {};
  assert.match(ui.html(), /Aberration · #9ab83a/);
  assert.equal(BLOOD_PRESETS.ooze.bleeds, false);
});

function duelFixture() {
  const calls = [];
  let busy = true;
  const snapshot = { scene: 'Crypt', presets: {}, settings: {}, tokens: [
    { id: 'ed', name: 'Ed', pc: true, hp: { value: 30, max: 30 }, color: '#a51414', bleeds: true },
    { id: 'kim', name: 'Kim', pc: true, hp: { value: 20, max: 24 }, color: '#a51414', bleeds: true, selected: true },
    { id: 'spider', name: 'Spider', pc: false, hp: { value: 40, max: 40 }, color: '#9ab83a', bleeds: true, targeted: true },
    { id: 'golem', name: 'Golem', pc: false, hp: { value: 80, max: 80 }, color: '#5f4d39', bleeds: false }] };
  const w = { page: DAMAGE_SHOWCASE_PAGE, render: () => calls.push('render'), untuck: null,
    tuckForPlayback: async () => { calls.push('tuck'); const once = async () => { if (w.untuck !== once) return; w.untuck = null; calls.push('restore'); }; w.untuck = once; return once; },
    host: { damageShowcase: () => snapshot, previewLensDuel: async (o) => { calls.push(['duel', o]); return true; },
      lensPreviewBusy: () => busy, stopLensPreview: () => calls.push('stop') } };
  const ui = new DamageShowcaseUI(w);
  ui.html();
  return { ui, w, calls, snapshot, idle: () => { busy = false; } };
}

test('PCs and NPCs of the scene sit in their own sections and start on the selected and targeted tokens', () => {
  const { ui } = duelFixture();
  const html = ui.html();
  for (const name of ['Ed', 'Kim', 'Spider', 'Golem']) assert.equal(html.split(`<b>${name}</b>`).length - 1, 1, `${name} listed once`);
  assert.match(html, /20\/24 HP/);
  const [pcs, npcs] = html.split('NPCS ·');
  assert.match(pcs, /PLAYER CHARACTERS · 2/);
  assert.ok(pcs.includes('<b>Ed</b>') && pcs.includes('<b>Kim</b>') && !pcs.includes('<b>Spider</b>'), 'PCs in their own section');
  assert.ok(npcs.startsWith(' 2') && npcs.includes('<b>Spider</b>') && npcs.includes('<b>Golem</b>') && !npcs.includes('<b>Ed</b>'), 'NPCs in theirs');
  assert.match(html, /Crypt/);
  assert.equal(ui.mine, 'kim');
  assert.equal(ui.other, 'spider');
  assert.match(html, /Spider hits Kim/);
  assert.match(html, /Kim hits Spider/);
});

test('mix and match: any two tokens, picking the other side swaps, Swap flips them', async () => {
  const { ui } = duelFixture();
  await ui.action('damage-pick', { dataset: { slot: 'other', id: 'ed' } });
  assert.deepEqual([ui.mine, ui.other], ['kim', 'ed'], 'a PC can be the other creature');
  await ui.action('damage-pick', { dataset: { slot: 'mine', id: 'ed' } });
  assert.deepEqual([ui.mine, ui.other], ['ed', 'kim'], 'picking the other one for mine swaps them');
  await ui.action('damage-pick', { dataset: { slot: 'mine', id: 'golem' } });
  await ui.action('damage-swap', {});
  assert.deepEqual([ui.mine, ui.other], ['kim', 'golem'], 'an NPC can be mine, then swapped');
});

test('a duel plays the two real tokens either way, minimizes Animater and restores it once the preview ends', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  const { ui, calls, idle } = duelFixture();
  ui.change({ dataset: { damage: 'share' }, value: '0.3' });
  await ui.action('damage-duel', { dataset: { role: 'victim' } });
  assert.deepEqual(calls.find((c) => c[0] === 'duel')[1], { mineId: 'kim', otherId: 'spider', role: 'victim', share: 0.3, crit: false, amount: null, gore: null, damageType: 'slashing' });
  assert.ok(calls.includes('tuck'));
  t.mock.timers.tick(2000);
  assert.ok(!calls.includes('restore'), 'still playing');
  idle();
  t.mock.timers.tick(300);
  assert.ok(calls.includes('restore'));
  await ui.action('damage-duel', { dataset: { role: 'attacker' } });
  assert.equal(calls.filter((c) => c[0] === 'duel').at(-1)[1].role, 'attacker');
});

test('From canvas takes the selected and targeted tokens; Stop restores the window', async () => {
  const { ui, calls, snapshot } = duelFixture();
  await ui.action('damage-pick', { dataset: { slot: 'mine', id: 'ed' } });
  snapshot.tokens[2].targeted = false; snapshot.tokens[3].targeted = true;
  await ui.action('damage-from-canvas', {});
  assert.deepEqual([ui.mine, ui.other], ['kim', 'golem']);
  await ui.action('damage-linger-start', { dataset: {} });
  await ui.action('damage-linger-stop', { dataset: {} });
  assert.ok(calls.includes('restore'));
});

function woundFixture(downStates) {
  const calls = [];
  const snapshot = { scene: 'Crypt', presets: {}, settings: { wounded: true, heartbeat: true }, systemId: 'dnd5e', downStates, tokens: [
    { id: 'kim', name: 'Kim', pc: true, hp: { value: 20, max: 24 }, color: '#a51414', bleeds: true, selected: true, heart: true },
    { id: 'bones', name: 'Bones', pc: true, hp: { value: 10, max: 10 }, color: '#d8d0c0', bleeds: false, heart: false },
    { id: 'spider', name: 'Spider', pc: false, hp: { value: 40, max: 40 }, color: '#9ab83a', bleeds: true, targeted: true }] };
  const w = { page: DAMAGE_SHOWCASE_PAGE, render: () => calls.push('render'), untuck: null,
    tuckForPlayback: async (ms) => { calls.push(['tuck', ms]); const once = async () => { if (w.untuck !== once) return; w.untuck = null; calls.push('restore'); }; w.untuck = once; return once; },
    host: { damageShowcase: () => snapshot, lensPreviewBusy: () => false, stopLensPreview: () => calls.push('stop'),
      previewLensWounded: (o) => calls.push(['wounded', o]), previewLensDown: (o) => calls.push(['down', o]), previewLensWake: (o) => calls.push(['wake', o]) } };
  const ui = new DamageShowcaseUI(w);
  ui.html();
  return { ui, w, calls, snapshot };
}

test('the Wounded view section: an HP slider, In combat, the system\'s down states by its own names, Wake up and Stop', () => {
  const { ui } = woundFixture([{ id: 'dying1', label: 'Dying, no failures' }, { id: 'dying2', label: '1 failure' }, { id: 'dying3', label: '2 failures' }, { id: 'dead', label: '3 failures (dead)' }]);
  const html = ui.html();
  assert.match(html, /Wounded view/);
  assert.match(html, /type="range" min="0" max="100" step="5" data-damage="woundHp" value="30"/);
  assert.match(html, /data-damage="woundCombat" checked/);
  for (const a of ['damage-wound-show', 'damage-wake', 'damage-wound-stop']) assert.match(html, new RegExp(`data-action="${a}"`));
  assert.match(html, /data-action="damage-down" data-state="dying2"[^>]*>1 failure</);
  assert.match(html, />2 failures</);
  assert.doesNotMatch(html, /Dying 2/, 'the host\'s labels, not the defaults');
  assert.match(html, /As Kim · your screen: wounded view on · heartbeat on/);
  // Without labels from the host: PF2e-style defaults.
  const plain = woundFixture(undefined).ui.html();
  for (const l of ['Dying 1', 'Dying 2', 'Dying 3', 'Unconscious', 'Stable', 'Dead']) assert.ok(plain.includes(`>${l}<`), l);
});

test('Show plays the HP and combat chosen as the picked creature; the slider and combat switch follow live', async () => {
  const { ui, calls } = woundFixture();
  const out = { textContent: '' };
  ui.change({ dataset: { damage: 'woundHp' }, value: '20', closest: () => ({ querySelector: () => out }) });
  assert.equal(out.textContent, '20%');
  assert.equal(calls.filter((c) => c[0] === 'wounded').length, 0, 'nothing plays before Show');
  await ui.action('damage-wound-show', { dataset: {} });
  assert.deepEqual(calls.find((c) => c[0] === 'wounded')[1], { hp: 0.2, inCombat: true, mineId: 'kim', amount: null, gore: null });
  ui.change({ dataset: { damage: 'woundCombat' }, type: 'checkbox', checked: false });
  assert.deepEqual(calls.filter((c) => c[0] === 'wounded').at(-1)[1], { hp: 0.2, inCombat: false, mineId: 'kim', amount: null, gore: null });
  ui.change({ dataset: { damage: 'woundHp' }, value: '0' });
  assert.equal(calls.filter((c) => c[0] === 'wounded').at(-1)[1].hp, 0);
  // Tucked only a few seconds (a lasting state), so Stop is in reach.
  assert.ok(calls.some((c) => c[0] === 'tuck' && c[1] <= 8000));
});

test('down states, waking and Stop go to the host as the picked creature (a heartless one has no heartbeat)', async () => {
  const { ui, calls } = woundFixture();
  await ui.action('damage-pick', { dataset: { slot: 'mine', id: 'bones' } });
  assert.match(ui.html(), /As Bones \(no heart: no heartbeat\)/);
  for (const state of ['dying1', 'dying2', 'dying3', 'unconscious', 'stable', 'dead']) {
    await ui.action('damage-down', { dataset: { state } });
    assert.deepEqual(calls.filter((c) => c[0] === 'down').at(-1)[1], { state, mineId: 'bones', amount: null, gore: null });
  }
  assert.match(ui.html(), /data-state="dead" class="is-active"/);
  await ui.action('damage-amount', { dataset: { value: 'subtle' } });
  await ui.action('damage-wake', { dataset: {} });
  assert.deepEqual(calls.find((c) => c[0] === 'wake')[1], { mineId: 'bones', amount: 'subtle', gore: null });
  // The slider no longer drives anything once a down state plays.
  ui.change({ dataset: { damage: 'woundHp' }, value: '50' });
  assert.equal(calls.filter((c) => c[0] === 'wounded').length, 0);
  await ui.action('damage-wound-stop', { dataset: {} });
  assert.ok(calls.includes('stop') && calls.includes('restore'));
  assert.equal(ui.woundLive, null);
  assert.equal(await ui.action('damage-down', { dataset: {} }), true, 'no state: nothing');
  const player = woundFixture();
  player.w.host.playerMode = true;
  await assert.rejects(player.ui.action('damage-down', { dataset: { state: 'dead' } }), /Only a GM/);
});

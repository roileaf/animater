import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artWords, isSummonsActor, summonsEffectLight, summonsTokenLight, createSummonsLights,
} from '../../scripts/integrations/summons-walls.mjs';
import { createLightHost } from '../../scripts/engines/lighting/light-host.mjs';

// Shaped like PF2e Summons Assistant's compendium creatures (pf2e-summons-assistant-actors) once summoned.
const PACK = 'Compendium.pf2e-summons-assistant.pf2e-summons-assistant-actors.Actor';
const wallOfFire = (blurb) => ({ name: 'Wall of Fire', sourceId: `${PACK}.r60N6I3qmqC8K965`, flags: { pf2e: { maxhealingRank: 0 } }, system: { details: { blurb } } });
const floatingFlame = { name: 'Floating Flame', _stats: { compendiumSource: `${PACK}.HOq9yGxQLhhZcEAP` }, flags: {} };
const igniteTheSun = { name: 'Ignite The Sun', flags: { 'pf2e-summons-assistant': { summoner: { uuid: 'Actor.abc' } } } };
const bestiaryActor = { name: 'Fire Elemental', sourceId: 'Compendium.pf2e.pathfinder-bestiary.Actor.xyz', flags: {} };
const FLAMING_SPHERE = 'modules/jb2a_patreon/Library/2nd_Level/Flaming_Sphere/FlamingSphere_02_Orange_400x400.webm';
const FIREBALL_LOOP = 'modules/JB2A_DnD5e/Library/3rd_Level/Fireball/FireballLoopNoDebris_01_Orange_800x800.webm';
const INDICATOR = 'modules/pf2e-summons-assistant/assets/indicator.svg';

// Sequencer effect data as handlePostSummon's WALL_OF_FIRE plays it (moduleName defaults to 'Sequencer').
const lineData = { moduleName: 'Sequencer', file: 'jb2a.wall_of_fire.300x100.yellow', persist: true, stretchTo: { onlyX: true }, tiedDocuments: ['Scene.s1.Token.t1'], sceneId: 's1' };
const ringData = { moduleName: 'Sequencer', file: 'jb2a.wall_of_fire.500x100.yellow', persist: true, stretchTo: false, attachTo: { active: true }, tiedDocuments: ['Scene.s1.Token.t1'], sceneId: 's1' };

test('art words: Sequencer keys stay, file paths become dotted words', () => {
  assert.equal(artWords('jb2a.wall_of_fire.300x100.yellow'), 'jb2a.wall_of_fire.300x100.yellow');
  assert.equal(artWords(FLAMING_SPHERE), 'flaming.sphere.flaming.sphere.02.orange.400x400');
  assert.equal(artWords(FIREBALL_LOOP), 'fireball.fireball.loop.no.debris.01.orange.800x800');
  assert.equal(artWords(INDICATOR), 'assets.indicator');
  assert.equal(artWords(''), '');
});

test('summons actors are known by compendium source or module flags', () => {
  assert.equal(isSummonsActor(wallOfFire('line')), true);
  assert.equal(isSummonsActor(floatingFlame), true);
  assert.equal(isSummonsActor(igniteTheSun), true);
  assert.equal(isSummonsActor(bestiaryActor), false);
  assert.equal(isSummonsActor(null), false);
});

test('a line Wall of Fire gets three flickering lights along it', () => {
  const tag = summonsEffectLight({ data: lineData, actor: wallOfFire('line'), hidden: false, from: { x: 0, y: 0 }, to: { x: 1200, y: 0 }, elevation: 5 }, { grid: 100 });
  assert.equal(tag.shape, 'flicker');
  assert.equal(tag.color, '#f6dc5c');
  assert.equal(tag.lasting, true);
  assert.deepEqual(tag.points, [{ x: 200, y: 0 }, { x: 600, y: 0 }, { x: 1000, y: 0 }]);
  assert.deepEqual(tag.at, { x: 600, y: 0 });
  assert.equal(tag.dim, 3);
  assert.equal(tag.bright, 1.5);
  assert.equal(tag.elevation, 5);
  assert.equal(tag.follow, undefined);
});

test('a short line wall gets one light at its middle', () => {
  const tag = summonsEffectLight({ data: lineData, actor: wallOfFire('line'), from: { x: 0, y: 0 }, to: { x: 300, y: 0 } }, { grid: 100 });
  assert.equal(tag.points, undefined);
  assert.deepEqual(tag.at, { x: 150, y: 0 });
  assert.equal(tag.dim, 2.25);
});

test('a ring Wall of Fire gets one light riding on it, sized to it and clamped', () => {
  const tag = summonsEffectLight({ data: ringData, actor: wallOfFire('circle'), sizePx: 550 }, { grid: 100 });
  assert.equal(tag.follow, true);
  assert.equal(tag.at, undefined);
  assert.equal(tag.dim, 4.125);
  const huge = summonsEffectLight({ data: ringData, actor: wallOfFire('circle'), sizePx: 5000 }, { grid: 100 });
  assert.equal(huge.dim, 12);
});

test('no effect light for hidden tokens, other actors, Animater effects, one-shots or dull art', () => {
  const base = { data: ringData, actor: wallOfFire('circle'), sizePx: 550 };
  assert.equal(summonsEffectLight({ ...base, hidden: true }), null);
  assert.equal(summonsEffectLight({ ...base, actor: bestiaryActor }), null);
  assert.equal(summonsEffectLight({ ...base, data: { ...ringData, moduleName: 'animater' } }), null);
  assert.equal(summonsEffectLight({ ...base, data: { ...ringData, persist: false } }), null);
  assert.equal(summonsEffectLight({ ...base, data: { ...ringData, file: 'modules/pf2e-summons-assistant/assets/tokens/token/wall_of_ice.webp' } }), null);
  assert.equal(summonsEffectLight({}), null);
});

test('summons tokens with glowing art get a light riding on them', () => {
  const flame = summonsTokenLight({ actor: floatingFlame, src: FLAMING_SPHERE, widthPx: 100, heightPx: 100 }, { grid: 100 });
  assert.equal(flame.shape, 'flicker');
  assert.equal(flame.color, '#ff9a4d');
  assert.equal(flame.follow, true);
  assert.equal(flame.dim, 1);
  const sun = summonsTokenLight({ actor: igniteTheSun, src: FIREBALL_LOOP, widthPx: 200, heightPx: 200, scale: 1.2 }, { grid: 100 });
  assert.equal(sun.dim, 1.8);
});

test('no token light for indicator art, other actors or hidden tokens', () => {
  assert.equal(summonsTokenLight({ actor: wallOfFire('line'), src: INDICATOR, widthPx: 100, heightPx: 100 }), null);
  assert.equal(summonsTokenLight({ actor: bestiaryActor, src: FLAMING_SPHERE, widthPx: 100, heightPx: 100 }), null);
  assert.equal(summonsTokenLight({ actor: floatingFlame, src: FLAMING_SPHERE, widthPx: 100, heightPx: 100, hidden: true }), null);
});

// The controller against the real light host, with fake light sources.
function rig({ enabled = true, max = 8 } = {}) {
  const out = { t: 0, sources: [], on: enabled };
  const host = createLightHost({
    makeSource: (id) => {
      const s = { id, inits: [], levels: [], destroyed: 0 };
      s.initialize = (data) => s.inits.push(data);
      s.add = () => {};
      s.setLevel = (l) => s.levels.push(l);
      s.destroy = () => { s.destroyed++; };
      out.sources.push(s);
      return s;
    },
    refreshLighting: () => {},
    sceneId: () => 's1',
    levelOk: () => true,
    gridSize: () => 100,
    now: () => out.t,
    max,
  });
  const tokens = new Map();
  const lights = createSummonsLights({
    host,
    enabled: () => out.on,
    grid: () => 100,
    describeEffect: (effect) => {
      const doc = tokens.get('t1');
      return doc && { data: effect.data, tokenId: doc.id, actor: doc.actor, hidden: doc.hidden, from: effect.from, to: effect.to, sizePx: effect.sizePx };
    },
    describeToken: (doc) => ({ id: doc.id, actor: doc.actor, hidden: doc.hidden, src: doc.texture.src, widthPx: doc.width * 100, heightPx: doc.height * 100, scale: 1 }),
    centerOf: (doc) => ({ x: doc.x + 50, y: doc.y + 50 }),
  });
  const frame = (ms = 20) => { out.t += ms; lights.tick(); host.tick(); };
  const live = () => out.sources.filter((s) => !s.destroyed);
  return { host, lights, out, tokens, frame, live };
}

test('a line Wall of Fire effect is lit once drawn, and goes when it ends', () => {
  const { lights, tokens, frame, live, host } = rig();
  tokens.set('t1', { id: 't1', actor: wallOfFire('line'), hidden: false });
  const effect = { data: lineData, ready: false, from: { x: 0, y: 0 }, to: { x: 1200, y: 0 }, worldPosition: { x: 0, y: 0 } };
  lights.onEffect(effect);
  frame();
  assert.equal(live().length, 0, 'waits until Sequencer has drawn it');
  effect.ready = true;
  frame(); frame();
  assert.equal(live().length, 3);
  assert.deepEqual(live().map((s) => s.inits[0].x), [200, 600, 1000]);
  assert.equal(live()[0].inits[0].animation.type, 'torch');
  lights.onEffectEnded(effect);
  for (let i = 0; i < 30; i++) frame();
  assert.equal(live().length, 0);
  assert.equal(host.count(), 0);
});

test('a ring Wall of Fire light follows its effect', () => {
  const { lights, tokens, frame, live } = rig();
  tokens.set('t1', { id: 't1', actor: wallOfFire('circle'), hidden: false });
  const effect = { data: ringData, ready: true, sizePx: 550, worldPosition: { x: 500, y: 500 } };
  lights.onEffect(effect);
  frame(); frame();
  assert.equal(live().length, 1);
  assert.equal(live()[0].inits[0].x, 500);
  effect.worldPosition = { x: 900, y: 500 };
  frame(); frame(); frame();
  assert.equal(live()[0].inits.at(-1).x, 900);
});

test('hiding the token darkens its wall; showing it lights it again', () => {
  const { lights, tokens, frame, live } = rig();
  const doc = { id: 't1', actor: wallOfFire('circle'), hidden: false, x: 0, y: 0, width: 1, height: 1, texture: { src: INDICATOR } };
  tokens.set('t1', doc);
  const effect = { data: ringData, ready: true, sizePx: 550, worldPosition: { x: 500, y: 500 } };
  lights.onEffect(effect);
  frame(); frame();
  assert.equal(live().length, 1);
  doc.hidden = true;
  lights.onTokenUpdate(doc, { hidden: true });
  for (let i = 0; i < 30; i++) frame();
  assert.equal(live().length, 0);
  doc.hidden = false;
  lights.onTokenUpdate(doc, { hidden: false });
  frame(); frame();
  assert.equal(live().length, 1);
});

test('a token with glowing art is lit, follows its token and fades on delete', () => {
  const { lights, frame, live, host } = rig();
  const doc = { id: 'f1', actor: floatingFlame, hidden: false, x: 300, y: 300, width: 1, height: 1, texture: { src: FLAMING_SPHERE } };
  lights.onToken(doc);
  frame(); frame();
  assert.equal(live().length, 1);
  assert.equal(live()[0].inits[0].x, 350);
  doc.x = 800;
  frame(); frame(); frame();
  assert.equal(live()[0].inits.at(-1).x, 850);
  lights.onTokenDelete(doc);
  for (let i = 0; i < 30; i++) frame();
  assert.equal(live().length, 0);
  assert.equal(host.count(), 0);
});

test('resizing a glowing token relights it at the new size; ordinary tokens stay dark', () => {
  const { lights, frame, live } = rig();
  const doc = { id: 'f1', actor: floatingFlame, hidden: false, x: 0, y: 0, width: 1, height: 1, texture: { src: FLAMING_SPHERE } };
  lights.onToken(doc);
  lights.onToken({ id: 'b1', actor: bestiaryActor, hidden: false, x: 0, y: 0, width: 1, height: 1, texture: { src: FLAMING_SPHERE } });
  frame(); frame();
  assert.equal(live().length, 1);
  doc.width = 4; doc.height = 4;
  lights.onTokenUpdate(doc, { width: 4, height: 4 });
  for (let i = 0; i < 30; i++) frame();
  assert.equal(live().length, 1);
  assert.equal(live()[0].inits[0].dim, 300, '4 squares wide: dim 1.5 x its 2 square radius');
});

test('nothing is lit while effect lighting is off', () => {
  const { lights, tokens, frame, live } = rig({ enabled: false });
  tokens.set('t1', { id: 't1', actor: wallOfFire('circle'), hidden: false });
  lights.onEffect({ data: ringData, ready: true, sizePx: 550, worldPosition: { x: 0, y: 0 } });
  lights.onToken({ id: 'f1', actor: floatingFlame, hidden: false, x: 0, y: 0, width: 1, height: 1, texture: { src: FLAMING_SPHERE } });
  frame(); frame();
  assert.equal(live().length, 0);
});

test('a lasting summons light makes room under the per-client cap like any lasting light', () => {
  const { host, lights, tokens, frame, live } = rig({ max: 2 });
  const oneShot = (x) => ({ data: { moduleName: 'animater', sceneId: 's1', animaterLight: { color: '#fff', shape: 'flash', dim: 2, bright: 1, startMs: 0, lengthMs: 5000, fadeMs: 300 } }, ready: true, worldPosition: { x, y: 0 } });
  host.onEffect(oneShot(0));
  host.onEffect(oneShot(100));
  frame();
  tokens.set('t1', { id: 't1', actor: wallOfFire('line'), hidden: false });
  lights.onEffect({ data: lineData, ready: true, from: { x: 0, y: 0 }, to: { x: 800, y: 0 }, worldPosition: { x: 0, y: 0 } });
  for (let i = 0; i < 30; i++) frame();
  assert.equal(live().length, 2, 'both one-shots faded for the two wall lights');
});

test('clear forgets effects still waiting to be drawn', () => {
  const { lights, tokens, frame, live } = rig();
  tokens.set('t1', { id: 't1', actor: wallOfFire('circle'), hidden: false });
  const effect = { data: ringData, ready: false, sizePx: 550, worldPosition: { x: 0, y: 0 } };
  lights.onEffect(effect);
  lights.clear();
  effect.ready = true;
  frame(); frame();
  assert.equal(live().length, 0);
});

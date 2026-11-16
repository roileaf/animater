import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDOUT_ARRIVALS, HANDOUT_LOOKS } from '../../scripts/engines/camera/handout-arrival.mjs';
import { BLEED_KEYS, BLEED_DEFAULTS } from '../../scripts/engines/camera/interface-bleed.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');

test('both engines are wired in, and nothing of them is reimplemented in the shell', () => {
  assert.match(main, /from "\.\/engines\/camera\/handout-arrival\.mjs"/);
  assert.match(main, /from "\.\/engines\/camera\/interface-bleed\.mjs"/);
  for (const fn of ['handoutAt', 'handoutPick', 'handoutLight', 'handoutMs']) {
    assert.ok(main.includes(fn), `${fn} is used rather than rewritten`);
  }
  for (const fn of ['bleedFrame', 'bleedSplats', 'bleedShudder', 'hurtLevel', 'bleedLooks']) {
    assert.ok(main.includes(fn), `${fn} is used rather than rewritten`);
  }
});

test('a handout is caught where Foundry opens it on each screen, and let go when it closes', () => {
  assert.match(main, /Hooks\.on\("renderImagePopout"/, 'the window every shared image opens');
  assert.match(main, /Hooks\.on\("closeImagePopout"/, 'and the dark behind it goes with it');
  // Nothing of this crosses the wire: each client builds its own from the popout Foundry already gave it.
  const block = main.slice(main.indexOf('Hooks.on("renderImagePopout"'), main.indexOf('Hooks.on("closeImagePopout"'));
  assert.ok(!/socket|emit\(/.test(block), 'a handout arriving is not sent anywhere');
});

test('one handout is only ever dressed once, however many times Foundry redraws it', () => {
  assert.match(main, /dataset\?\.animaterHandout === "1"/, 'a window already dressed is left alone');
  assert.match(main, /dataset\.animaterHandout = "1"/);
});

test('every look the engine offers is a choice a GM can actually pick', () => {
  assert.match(main, /registerSetting\("handoutArrival", \{/);
  assert.match(main, /choices: HANDOUT_ARRIVALS/, 'the list comes from the engine, so the two can never drift');
  assert.match(main, /registerSetting\("handoutArrivalLocal", \{/, 'and a player may refuse it on their own screen');
  // Off is the default: a beat on every handout is tiresome before anybody asked for it.
  const at = main.indexOf('registerSetting("handoutArrival", {');
  assert.match(main.slice(at, at + 1400), /default: "off"/);
  assert.ok(HANDOUT_LOOKS.length >= 6 && Object.keys(HANDOUT_ARRIVALS).length >= 8);
});

test('a map spread open gets its two rods, and gives them back when it has arrived', () => {
  assert.match(main, /handoutHasRods\(look\)/, 'the engine says which looks have them');
  assert.match(main, /animater-handout-rod-\$\{side\}/);
  assert.match(main, /--an-ho-spread/, 'and the sides it has not uncovered yet');
  const at = main.indexOf('for (const bar of rods) bar.remove();');
  assert.ok(at > 0, 'both rods are taken off the page at the end');
  for (const cls of ['animater-handout-rod-side', 'animater-handout-rod-left', 'animater-handout-rod-right']) {
    assert.ok(css.includes(cls), cls);
  }
  assert.match(css, /calc\(var\(--an-ho-spread, 0\) \* 100%\)/, 'the clip and the rods both follow it');
});

test('a scene may choose its own arrival, as scenes already choose their own everything', () => {
  assert.match(main, /handoutHere\(canvas\?\.scene\?\.flags\?\.\[ID\]\?\.handout/);
});

test('every bleed look is a setting of its own, with the engine’s own default', () => {
  for (const key of BLEED_KEYS) {
    const setting = `bleed${key[0].toUpperCase()}${key.slice(1)}`;
    assert.match(main, new RegExp(`registerSetting\\("${setting}", \\{`), setting);
    const at = main.indexOf(`registerSetting("${setting}", {`);
    const body = main.slice(at, at + 900);
    assert.ok(body.includes(`default: ${BLEED_DEFAULTS[key]}`), `${setting} starts ${BLEED_DEFAULTS[key]}`);
    assert.match(body, /scope: "world"/, `${setting} is the table's choice`);
  }
  for (const setting of ['interfaceBleed', 'interfaceBleedLocal', 'interfaceBleedStrength', 'bleedChatReadable']) {
    assert.match(main, new RegExp(`registerSetting\\("${setting}", \\{`), setting);
  }
});

test('the two loud looks are off until somebody asks for them', () => {
  for (const setting of ['bleedShudder', 'bleedTunnel']) {
    const at = main.indexOf(`registerSetting("${setting}", {`);
    assert.match(main.slice(at, at + 900), /default: false/, setting);
  }
});

test('the bleed is for players, and never for a GM who has no one creature to be dying', () => {
  assert.match(main, /game\.user\?\.isGM !== true/, 'the same rule the damage lens already follows');
  assert.match(main, /allowsTokenFx\(localQuality\(\)\)/, 'and it goes with the quality tiers');
});

test('a marked health track is turned the right way round before the engine sees it', () => {
  // Daggerheart counts up as a character is hurt; everything past this point is health left.
  assert.match(main, /hp\.marked \? Number\(hp\.max\) - Number\(hp\.value\) : Number\(hp\.value\)/);
});

test('the colour drains out of the furniture by name, never off the map', () => {
  const at = main.indexOf('const BLEED_CHROME');
  const list = main.slice(at, main.indexOf('\r\n', at) + 2);
  assert.ok(list.includes('#sidebar') && list.includes('#hotbar'), 'the panels a player reads');
  for (const never of ['#board', 'canvas', '#interface"', 'body']) {
    assert.ok(!list.includes(never), `the map is not drained a second time: ${never}`);
  }
});

test('blood is kept thin where a player has to read', () => {
  assert.match(main, /bleedKeepClear/);
  assert.match(main, /keepClear: bleedKeepClear\(\)/, 'the engine is told, rather than the shell deciding');
  assert.match(main, /shakeSetting\("bleedChatReadable", true\)/);
});

test('anyone who asked for less motion gets the look and none of the movement', () => {
  assert.match(main, /prefers-reduced-motion: reduce/);
  // The handout is still lit by the scene; it simply does not move.
  const at = main.indexOf('if (prefersStill()) return;');
  assert.ok(at > 0, 'the handout stops before its motion, not before its light');
  assert.ok(main.lastIndexOf('content.append(lit);', at) > 0, 'the scene’s light is already on the page by then');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'and the stylesheet agrees');
});

test('everything built is taken down again', () => {
  for (const marker of ['const bleedClear', 'bleedLayer?.remove()', 'bleedUndrain', 'handoutVeil(false)']) {
    assert.ok(main.includes(marker), marker);
  }
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ bleedSeen\.clear\(\); bleedClear\(\); \}\)/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ handoutOpen = 0; handoutVeil\(false\); \}\)/);
});

test('the stylesheet carries every class the shell puts on', () => {
  for (const cls of [
    'animater-handout', 'animater-handout-arriving', 'animater-handout-light', 'animater-handout-flicker',
    'animater-handout-wet', 'animater-handout-rod', 'animater-handout-dust', 'animater-handout-veil',
    'animater-bleed-edge', 'animater-bleed-tunnel', 'animater-bleed-drained', 'animater-bleed-splat', 'animater-beating',
  ]) {
    assert.ok(css.includes(cls), cls);
  }
  assert.ok(css.includes('#animater-bleed'), 'and the layer itself');
});

test('the shell never reads a DOM that may not be there', () => {
  // Every test harness in this repo runs without a document; a hook that assumes one breaks unrelated tests.
  for (const guard of ['globalThis.document?.body?.append', 'globalThis.document?.createElement', 'globalThis.document?.getElementById?.']) {
    assert.ok(main.includes(guard), guard);
  }
});

test('main.mjs and the stylesheet are still CRLF throughout', () => {
  assert.equal((main.match(/(?<!\r)\n/g) || []).length, 0, 'main.mjs');
  assert.equal((css.match(/(?<!\r)\n/g) || []).length, 0, 'animater.css');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HANDOUT_ARRIVALS, HANDOUT_LOOKS } from '../../scripts/engines/camera/handout-arrival.mjs';
import { BLEED_KEYS, BLEED_DEFAULTS } from '../../scripts/engines/camera/interface-bleed.mjs';
import { BUNDLED_SOUND_DIRS } from '../../data/bundled-sounds.mjs';
import { existsSync } from 'node:fs';

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
  const at = main.indexOf('Hooks.on("renderImagePopout"');
  const block = main.slice(at, main.indexOf('\r\n});', at) + 5);
  assert.ok(block.length > 40 && !/socket|emit\(/.test(block), 'a handout arriving is not sent anywhere');
  const dress = main.indexOf('const handoutShow = ({ app, root, chosen, seedText, art, caption }) => {');
  assert.ok(dress > 0 && !/\bemit\(/.test(main.slice(dress, at)), 'nor is the arrival of it');
});

test('the window is hidden and a whole screen stands in its place', () => {
  // Roi, of the first version: "it just shows the window opening differently... hardly immersive". A window stays a
  // window however it opens, so Foundry's is kept (for the permissions and the uuid) and never seen.
  assert.match(main, /root\?\.classList\?\.add\("animater-handout-instead"\)/, 'the window Foundry opened is hidden');
  assert.ok(css.includes('.animater-handout-instead'), 'and the stylesheet is what hides it');
  assert.match(main, /open\.app\?\.close\?\.\(\)/, 'putting the handout down closes it, so Foundry ends it its own way');
  assert.ok(main.includes('el.className = "animater-handout-stage"'), 'the stage is what is seen instead');
  assert.ok(css.includes('.animater-handout-stage'), 'and it is styled');
});

test('every look the engine offers is a choice a GM can actually pick', () => {
  assert.match(main, /registerSetting\("handoutArrival", \{/);
  assert.match(main, /choices: HANDOUT_ARRIVALS/, 'the list comes from the engine, so the two can never drift');
  assert.match(main, /registerSetting\("handoutArrivalLocal", \{/, 'and a player may refuse it on their own screen');
  // Off is the default: a beat on every handout is tiresome before anybody asked for it.
  const at = main.indexOf('registerSetting("handoutArrival", {');
  assert.match(main.slice(at, at + 1400), /default: "off"/);
  assert.ok(HANDOUT_LOOKS.length >= 8 && Object.keys(HANDOUT_ARRIVALS).length >= 10);
  // Every look the engine knows is on the stage: a look offered with nothing to draw is a promise not kept.
  for (const look of HANDOUT_LOOKS) assert.ok(css.includes(`animater-ho-${look}`) || main.includes(look), look);
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

test('the page is asked first, then the scene, then the table', () => {
  assert.match(main, /handoutHere\(handoutPageLook\(app\), canvas\?\.scene\?\.flags\?\.\[ID\]\?\.handout, shakeSetting\("handoutArrival", "off"\)\)/);
});

test('a picture may choose how it arrives, and that choice travels with it', () => {
  // The uuid Foundry sends with an image shown on its own is the only thing that says which page this popout is of.
  assert.match(main, /const handoutPageLook = \(app\) => \{/);
  assert.match(main, /app\?\.options\?\.uuid/);
  assert.match(main, /fromUuidSync\?\.\(uuid\)/, 'the page is read where it already is, never fetched mid-render');
  assert.match(main, /page\?\.flags\?\.\[ID\]\?\.handout \?\? null/);
  // Opened any other way there is no page to ask, and the scene's choice stands.
  const at = main.indexOf('const handoutPageLook = (app) => {');
  assert.match(main.slice(at, at + 420), /if \(!uuid\) return null;/);
  assert.match(main.slice(at, at + 420), /catch \{ return null; \}/, 'a page in an unloaded pack is not a crash');
});

test('a journal somebody is shown arrives, and one a player opened for themselves does not', () => {
  assert.match(main, /Hooks\.on\("renderJournalEntrySheet"/);
  // Foundry already tells every screen to open it; this only listens, so nothing new crosses the wire.
  assert.match(main, /game\.socket\?\.on\?\.\("showEntry"/);
  // There is no "showEntry" hook in Foundry: Journal.show emits to the others and calls Journal._showEntry itself,
  // which renders and calls nothing. Listening for one looked right and did nothing at all.
  assert.ok(!main.includes('Hooks.on("showEntry"'), 'and never a hook Foundry does not call');
  const at = main.indexOf('Hooks.on("renderJournalEntrySheet"');
  const block = main.slice(at, at + 1200);
  assert.ok(!/emit\(/.test(block), 'a journal arriving is not sent anywhere');
  assert.match(block, /if \(!handoutShownTake\(entry\?\.uuid\)\) return;/,
    'nothing arrives unless this screen was told to show it');
  assert.match(block, /page\?\.flags\?\.\[ID\]\?\.handout,\r?\n\s*entry\?\.flags\?\.\[ID\]\?\.handout/,
    'the page they were shown speaks before the journal it lives in');
  // A note goes stale rather than dressing the next journal opened an hour later.
  assert.match(main, /HANDOUT_SHOWN_MS/);
  assert.match(main, /handoutShownFor\.delete\(key\)/, 'and is spent once it is used');
});

test('the stage goes with the window it stands in for, and never takes another one down with it', () => {
  // A plain journal closing must not clear a handout somebody is still reading, so the stage only answers to the
  // one window it replaced. Foundry hands a closing window over after its element is gone, so it is known by app.
  assert.match(main, /const handoutClosed = \(app\) => \{ if \(handoutStage && handoutStage\.app === app\) handoutStageDown\(true\); \};/);
  for (const hook of ['closeImagePopout', 'closeJournalEntrySheet']) {
    assert.match(main, new RegExp(`Hooks\\.on\\("${hook}", \\(app\\) => handoutClosed\\(app\\)\\)`), hook);
  }
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => handoutStageDown\(true\)\)/, 'and leaving the scene puts it down');
  // One at a time: a second handout shown over the first takes its place rather than stacking.
  assert.match(main, /handoutStageDown\(true\);\r?\n\s*const light = handoutSceneLight\(\);/);
});

test('the room goes dark even on a screen that is drawing nothing', () => {
  // Found by showing a handout to a tab that was not painting: it arrived on a fully lit interface. A screen that
  // is not drawing runs no animation frames AND makes no progress through a transition, and a transition that has
  // not finished keeps overriding the value it is travelling towards — so neither may be what the dark depends on.
  assert.ok(!main.includes('requestAnimationFrame(() => el.classList.add("animater-on"))'),
    'the dark is not switched on inside a frame');
  assert.match(main, /void el\.offsetWidth;\r?\n\s*el\.classList\.add\("animater-on"\);/,
    'a forced reflow gives the fade something to start from, without waiting for a frame');
  assert.match(main, /const veilTo = 0\.74 \+ light\.veil \* 0\.24;/, 'how dark it ends up is a number, not a stylesheet');
  assert.match(main, /dark\.style\.transition = "none";\r?\n\s*dark\.style\.opacity = String\(veilTo\);/,
    'and landing sets it outright, past the transition');
  assert.match(main, /open\.dark\.style\.opacity = "0";/, 'taken off the same way');
});

test('a handout can be put down with a click or with Escape', () => {
  assert.match(main, /el\.addEventListener\("click", \(\) => handoutStageDown\(\)\);/);
  assert.match(main, /event\?\.key === "Escape" && handoutStage/);
  assert.ok(main.includes('click anywhere to put it down'), 'and is told so, once it has arrived');
  assert.ok(css.includes('.animater-handout-put'), 'quietly');
});

test('an arrival lands even on a screen that is drawing no frames', () => {
  // A tab behind another runs no animation frames at all: without this the page would keep its rods and its clip
  // for as long as nobody looked at it.
  assert.match(main, /handoutStage\.timer = setTimeout\(land, ms \+ 400\);/);
  assert.match(main, /let done = false;/);
  assert.match(main, /const land = \(\) => \{ if \(done\) return; done = true; landed\(\); \};/);
  assert.match(main, /if \(!el\.isConnected \|\| handoutStage\?\.el !== el\) return land\(\);/,
    'and one taken away mid-flight, or replaced by the next handout, is let go');
  const at = main.indexOf('const landed = () => {');
  assert.match(main.slice(at, at + 1400), /for \(const bar of rods\) bar\.remove\(\);/, 'every rod comes off in one place');
});

test('one arrival serves both, rather than two that drift apart', () => {
  assert.match(main, /const handoutShow = \(\{ app, root, chosen, seedText, art, caption \}\) => \{/);
  assert.match(main, /chosen: handoutLookNow\(app\), seedText: String\(src\)/, 'a picture');
  assert.match(main, /art, caption: page\?\.name && page\.type === "image" \? page\.name : "" \}\);/, 'and a journal page');
});

test('what is laid on the paper is the handout itself, and a kind with nothing to lay keeps its window', () => {
  const at = main.indexOf('const handoutArtOfPage = async (page) => {');
  assert.ok(at > 0, 'a page is read for what it has');
  const block = main.slice(at, main.indexOf('\r\n};', at) + 3);
  assert.ok(block.includes('page.type === "image" && page.src'), 'a picture page is its picture');
  assert.ok(block.includes('page.type !== "text" || !page.text?.content'), 'a text page is its words');
  assert.ok(block.includes('return null'), 'and a PDF or a video keeps Foundry\u2019s own window, which can show it');
  assert.ok(block.includes('enrichHTML'), 'the words are filled in first, so links and rolls work on the paper');
  assert.ok(css.includes('.animater-handout-words'), 'and words are given a column to be read in');
});

test('the choice is made where the page is edited, once, and never over its reader', () => {
  assert.match(main, /const HANDOUT_PAGE_SHEETS = \["Image", "Text", "Video", "PDF"\]/, 'every kind of page, not only pictures');
  assert.match(main, /Hooks\.on\(`renderJournalEntryPage\$\{kind\}Sheet`, handoutPageRow\)/);
  assert.match(main, /app\?\.isView === true/, 'and only while it is being edited');
  assert.match(main, /root\.querySelector\("\.animater-handout-page"\)/, 'one row however often it redraws');
  assert.match(main, /name="flags\.\$\{ID\}\.handout"/, 'Foundry saves it as the page’s own flag');
  assert.match(main, /\[\["", "From the scene or the module"\], \.\.\.Object\.entries\(HANDOUT_ARRIVALS\)\]/,
    'the list comes from the engine, and nothing chosen leaves it to the scene');
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
  const at = main.indexOf('if (prefersStill()) { landed(); return true; }');
  assert.ok(at > 0, 'the handout stops before its motion, not before its light');
  assert.ok(main.lastIndexOf('lit.style.setProperty("--an-ho-lit"', at) > 0, 'the scene’s light is already on the page by then');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'and the stylesheet agrees');
});

test('everything built is taken down again', () => {
  for (const marker of ['const bleedClear', 'bleedLayer?.remove()', 'bleedUndrain', 'open.el.remove()']) {
    assert.ok(main.includes(marker), marker);
  }
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ bleedSeen\.clear\(\); bleedClear\(\); \}\)/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => handoutStageDown\(true\)\)/);
});

test('the stylesheet carries every class the shell puts on', () => {
  for (const cls of [
    'animater-handout', 'animater-handout-arriving', 'animater-handout-light', 'animater-handout-flicker',
    'animater-handout-wet', 'animater-handout-rod', 'animater-handout-dust', 'animater-handout-stage',
    'animater-handout-dark', 'animater-handout-sheet', 'animater-handout-art', 'animater-handout-pin',
    'animater-handout-lamp', 'animater-handout-crease', 'animater-handout-cap',
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

test('a GM says how a handout arrives from where the journal is read, not only from where a page is edited', () => {
  // The choice used to live at the bottom of a page's edit form, which is a detour from the journal a GM is looking at.
  const at = main.indexOf('const handoutButton = (app, element, entry, pageNow)');
  assert.ok(at > 0, 'the journal window gets a button of its own');
  const block = main.slice(at, main.indexOf('\r\n});', at) + 5);
  assert.ok(block.includes('header-control'), 'it sits in the window header, next to the close button');
  assert.ok(block.includes('animater-handout-button'), 'and is known by name, so a re-render does not stack two of them');
  assert.ok(block.includes('header.querySelector(".animater-handout-button")'), 'which is what stops the second one');
  assert.ok(block.includes('game.user?.isGM !== true'), 'a player never sees it: it is not their choice to make');
  assert.ok(block.includes('button[data-action=toggleControls]'), 'before the menu button, so it is seen without opening a menu');
  assert.match(main, /Hooks\.on\("renderJournalEntrySheet", \(app, element\) => \{\r\n  const entry = app\?\.document;\r\n  handoutButton\(/);
});

test('the button asks about the page in front of the GM and about the journal behind it', () => {
  const at = main.indexOf('const handoutAsk = async (entry, page)');
  assert.ok(at > 0, 'there is something to ask');
  const block = main.slice(at, main.indexOf('\r\n};', at) + 3);
  assert.ok(block.includes('handoutRow("page"'), 'the page in front of them');
  assert.ok(block.includes('handoutRow("entry"'), 'and the journal, which speaks for every page that says nothing');
  assert.ok(block.includes('page?.pages') === false, 'the page is the page, not a journal');
  assert.ok(block.includes('await put(page, said.page)') && block.includes('await put(entry, said.entry)'), 'both are saved');
  assert.ok(block.includes('unsetFlag(ID, "handout")'), 'and choosing nothing takes the choice off, rather than storing an empty one');
  assert.ok(block.includes('app.pageId') === false, 'what the page is was settled at the click, not at the render');
  // Every look the engine knows is offered, so a new one needs no second list here.
  const row = main.slice(main.indexOf('const handoutRow = '), at);
  assert.ok(row.includes('Object.entries(HANDOUT_ARRIVALS)'), 'the list comes from the engine');
  for (const look of HANDOUT_LOOKS) assert.ok(look in HANDOUT_ARRIVALS, look);
});

test('every handout sound this build ships is really on disk, indexed and named', () => {
  // The index is generated (tools/build-bundled-sounds.mjs). A sound added to assets without running it is invisible
  // to the module, and the whole folder is filed under "Animater sounds" unless the media library is told its name.
  const files = BUNDLED_SOUND_DIRS.handouts ?? [];
  assert.ok(files.length > 0, 'the handouts folder is in the generated index');
  for (const name of files) {
    assert.ok(existsSync(new URL(`../../assets/sounds/handouts/${name}`, import.meta.url)), name);
    assert.match(name, /^[a-z]+-\d+\.ogg$/, `${name} is <look>-<freesound id>.ogg`);
    assert.ok(HANDOUT_LOOKS.includes(name.split('-')[0]), `${name} is named for a look that exists`);
  }
  const media = readFileSync(new URL('../../scripts/engines/media/bundled-sounds.mjs', import.meta.url), 'utf8');
  assert.match(media, /handouts: "Handouts"/, 'and the media library knows what to call the folder');
});

test('a handout is heard on the screen it arrives on, and nowhere else', () => {
  assert.match(main, /const heard = soundsOn\(\) \? handoutSound\(look, BUNDLED_SOUND_DIRS\.handouts \?\? \[\], seed\) : null;/,
    'the take comes from the engine, from what is really shipped, and anyone with sound off hears nothing');
  assert.match(main, /AudioHelper\.play\(\{ src: `modules\/\$\{ID\}\/assets\/sounds\/handouts\/\$\{heard\}`[^)]*\}, false\)/,
    'played locally: the false is what keeps it off the wire, as the arrival itself is');
  // The same seed decides the look and the take, so a page that arrives one way always sounds that way.
  assert.match(main, /const seed = handoutSeed\(seedText\);\r?\n\s*const look = handoutPick\(chosen, seed\);/);
});

test('a handout put down before its moment never taps over an empty map', () => {
  assert.match(main, /const handoutStageSounds = new Set\(\);/);
  assert.match(main, /const at = prefersStill\(\) \? 0 : handoutSoundAt\(look\) \* \(handoutMs\(look\) \|\| 0\);/,
    'the engine says when, and a screen that was asked for less motion waits for nothing');
  assert.match(main, /if \(at > 0\) handoutStageSounds\.add\(setTimeout\(play, at\)\); else play\(\);/);
  const at = main.indexOf('const handoutStageDown');
  const block = main.slice(at, main.indexOf('\r\n};', at));
  assert.ok(block.includes('for (const t of handoutStageSounds) clearTimeout(t);'), 'and putting it down cancels what has not played');
  assert.ok(block.includes('handoutStageSounds.clear();'));
});

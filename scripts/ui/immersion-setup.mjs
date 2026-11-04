// "Choose your immersion": once after an update, and whenever asked from the settings, each immersion feature explained and shown live on the scene that is open, on this
// screen only and with nothing saved until Save. The GM chooses for the table; each player chooses for their own screen from what the GM left on.
//
// A feature here is several settings that belong together. The pure parts (which settings, what to write, what is new) come first; the window takes what it needs as options.

export const IMMERSION_FEATURES = Object.freeze([
  // A new id, so everyone who chose the old automatic animals is asked again: they now play only on scenes the GM turns them on for.
  { id: "outdoors", name: "Outdoor life", short: "Only on scenes you choose", about: "Birds, deer, rabbits, frogs and ducks live in the outdoor scenes you choose: they graze, swim and fly, run from noise and from your creatures, and hunt each other. This used to be automatic. Now each scene has its own switch, off until you turn it on.", keys: ["wildlife", "wildlifeSounds", "fireflies"], scene: { flag: "outdoorLife", options: [["", "Off"], ["on", "On"]] } },
  { id: "vermin", name: "Vermin and critters", short: "Rats, bats, things behind doors", about: "Rats scuttle along the walls indoors and underground, bats wheel in the dark, and things burst out when a door opens.", keys: ["vermin", "verminSounds", "doorBurst"] },
  { id: "light", name: "Sun and shadows", short: "Shadows that follow the hour", about: "Creatures, walls and roofs cast shadows that move with the time of day. Light falls through windows and tree cover, and clouds pass over the ground.", keys: ["groundShadows", "shadowsOverTokens", "shadowShapes", "lightShadows", "wallShadows", "windowLight", "canopyLight", "roofLight", "cloudShadows", "surfaceGlints", "sunColor", "litBySurroundings"] },
  { id: "weather", name: "Weather on the map", short: "Rain, snow, wind, seasons", about: "Weather changes the ground itself: puddles and rings in the water, snow lying on open ground, leaves falling, trees swaying in the wind, mist at dawn.", keys: ["weatherLight", "weatherOnMap", "weatherClouds", "wetGround", "snowCover", "tileSnow", "frozenWater", "rainRings", "lightningFlashes", "rainbows", "fallingLeaves", "morningMist", "treeSway", "seasonGround", "heatShimmer", "weatherOnCreatures"] },
  { id: "fire", name: "Fire and lamplight", short: "Flames, smoke, embers", about: "Lights get flames and embers, smoke gathers in rooms, torches are held and flicker in drafts, and windows glow at night.", keys: ["fireHaze", "fireSmoke", "heldTorches", "lightOrbs", "lampEmbers", "lampMotes", "lightFlames", "roomSmoke", "torchDraft", "windowGlow"] },
  { id: "windflames", name: "Flames in the wind", short: "Fires and smoke lean outdoors", about: "Out of doors, flames, torches and their smoke lean with the wind, swelling in the gusts. Under a roof they feel none of it, and the light itself never changes.", keys: ["windFlames"] },
  { id: "feet", name: "Feet on the floor", short: "Prints, dust, ripples, wakes", about: "Creatures leave prints and kick up what they walk on, wade with ripples and swim with a wake. Sand, mud, snow and grass each answer in their own way.", keys: ["movementFeel"] },
  { id: "creatures", name: "Living creatures", short: "Breathing, shifting, voices", about: "Creatures breathe and shift while they wait, fliers hover, and they make their own sounds now and then.", keys: ["idleLife", "idleBreathing", "idleHover", "creatureIdleSounds", "creatureVoices"] },
  { id: "caves", name: "Caves and dungeons", short: "Mist, drips, moths, rubble", about: "Underground scenes get drips, drafts, dust from the ceiling, glowing fungus, crystals, webs, eyes in the dark and falling pebbles.", keys: ["drips", "drafts", "ceilingDust", "caveMist", "caveFungus", "caveCrystals", "caveLava", "caveWebs", "caveWet", "caveSteam", "caveFoul", "caveSoot", "caveEyes", "caveMoths", "cavePebbles", "caveRubble", "caveSkylight"] },
  { id: "sound", name: "Sounds of the world", short: "Rain, wind, rivers, footsteps", about: "Weather and rivers can be heard as you come near them, footsteps match the floor, and rooms echo as their size suggests.", keys: ["weatherSounds", "riverSounds", "footstepSounds", "roomAcoustics"] },
  { id: "tavern", name: "Tavern murmur", short: "Voices in a room you mark", about: "A region marked as a tavern (Region configuration → Floor and water) is full of voices: loud inside, faint through its walls, spilling out when a door opens.", keys: ["tavernMurmur"] },
  { id: "aftermath", name: "Aftermath", short: "Stuck arrows, flies, crows", about: "A fight leaves its mark: arrows stay in the walls and the floor, and bodies draw flies, then crows that scatter when you come near.", keys: ["stuckShots", "carrion"] },
  { id: "shores", name: "Coasts and falling water", short: "Waves, waterfalls, reflections", about: "Waves wash in on regions marked as the sea, with a tide and crabs. Waterfalls fall with foam, mist and a rainbow. Still water mirrors what stands beside it.", keys: ["coast", "waterfalls", "waterMirror"] },
  { id: "dayshift", name: "Dawn and dusk", short: "Birdsong at dawn, a hush at dusk", about: "Birds sing all around at first light, go quiet as the sun sets, and after a hush the crickets take over.", keys: ["dawnChorus"] },
  { id: "town", name: "Town life", short: "Only on scenes you choose", about: "Pigeons, chickens, a cat and a stray dog, and windows that go dark through the night. Each scene has its own switch, off until you turn it on.", keys: ["townLife"], scene: { flag: "townLife", options: [["", "Off"], ["quiet", "Quiet"], ["busy", "Busy"]] } },
  { id: "tracks", name: "Old tracks", short: "Only on scenes you choose", about: "Prints that stay and age by the game's clock, so someone can read who passed and when. For each scene you choose: off, the GM only, or everyone. How long they last is in Scene configuration.", keys: ["oldTracks"], scene: { flag: "oldTracks", options: [["off", "Off"], ["gm", "The GM sees them"], ["everyone", "Everyone sees them"]] } },
  { id: "blood", name: "Blood and impact", short: "For tables that want it", about: "Blood on the floor and on the screen, camera shake, wounded looks and dramatic deaths. Turn this off for a gentler game.", keys: ["lensBlood", "lensEffects", "bloodTrail", "cameraShake", "killCam", "mapDistortion", "woundedLooks", "dramaticDeaths"] },
]);

const LOCAL_NAMES = Object.freeze({ roomAcoustics: "roomReverbLocal" });
const localOf = (key) => LOCAL_NAMES[key] ?? `${key}Local`;

// The on-or-off settings a feature has here: `has(key)` whether such a setting is registered.
export function featureKeys(feature, has) {
  const world = feature.keys.filter(has);
  return { world, local: world.map(localOf).filter(has) };
}
// Whether a feature counts as on (pure): for the GM, any of its table's settings on; for a player, any they can see on their own screen.
export function featureOn(feature, { get, has, isGM }) {
  const { world } = featureKeys(feature, has);
  if (isGM) return world.some((key) => get(key) !== false);
  return world.some((key) => get(key) !== false && has(localOf(key)) && get(localOf(key)) !== false);
}
// Whether a person gets to choose this feature (pure): a player has nothing to choose in what the GM turned off, or what has no setting for a screen.
export function featureShown(feature, { get, has, isGM }) {
  const { world } = featureKeys(feature, has);
  if (isGM) return world.length > 0;
  return world.some((key) => get(key) !== false && has(localOf(key)));
}
// The settings to change for a person's choices (pure), only for features they changed, so a table's careful mix survives leaving a feature alone.
// `before` and `after` are id to on-or-off. Turning a feature on for the GM also turns it on for their own screen; a player only ever writes their screen's.
export function choiceWrites(features, before, after, { has, isGM }) {
  const writes = new Map();
  for (const feature of features) {
    const on = after.get(feature.id);
    if (on === undefined || on === before.get(feature.id)) continue;
    const { world, local } = featureKeys(feature, has);
    if (isGM) { for (const key of world) writes.set(key, on); if (on) for (const key of local) writes.set(key, true); }
    else for (const key of local) writes.set(key, on);
  }
  return writes;
}
// What a feature's switch for the open scene says now (pure): its flag, or Off for anything it does not know.
export function sceneValue(feature, flags = {}) {
  const options = feature.scene?.options ?? [], value = String(flags?.[feature.scene?.flag] ?? "");
  return options.some(([v]) => v === value) ? value : options[0]?.[0] ?? "";
}
// What to write to the scene for the switches changed (pure). `before` and `after` are id to value; `id` the module. Only what changed, so nothing else of the scene's is touched.
export function sceneWrites(features, before, after, id) {
  const changes = {};
  for (const feature of features) {
    if (!feature.scene || !after.has(feature.id) || after.get(feature.id) === before.get(feature.id)) continue;
    changes[`flags.${id}.${feature.scene.flag}`] = after.get(feature.id);
  }
  return changes;
}
// The features this person has not been asked about yet (pure).
export const newFeatures = (features, seen) => features.filter((feature) => !(seen ?? []).includes(feature.id));

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The window's content (pure).
export function immersionHTML({ features, choices, selected, isGM, note = "", sceneValues = new Map(), sceneName = "" }) {
  // The GM's switch for the open scene, in the row that is open; saved with the rest.
  const sceneSwitch = (feature) => {
    if (!isGM || !feature.scene || !sceneName) return "";
    const value = sceneValues.get(feature.id) ?? "";
    return `<label class="an-imm-scene">On ${esc(sceneName)}: <select data-scene="${esc(feature.id)}">${feature.scene.options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  };
  const intro = isGM
    ? "<b>Not every table wants all of this, so choose what you like.</b> Click one to see it on this scene, on your screen only. Nothing is saved until you choose below. You can change this any time in Animater settings."
    : "<b>Choose what plays on your screen.</b> Your GM has these on for the table. Click one to see it on this scene. Turning one off changes only what you see and hear.";
  const rows = features.map((feature) => {
    const open = feature.id === selected;
    return `<div class="an-imm-row${open ? " open" : ""}" data-feature="${esc(feature.id)}">
  <label class="an-imm-head"><input type="checkbox" data-tick="${esc(feature.id)}"${choices.get(feature.id) ? " checked" : ""} aria-label="${esc(feature.name)}"><span class="an-imm-name">${esc(feature.name)}<small>${esc(feature.short)}</small></span></label>
  ${open ? `<div class="an-imm-more"><p>${esc(feature.about)}</p>${sceneSwitch(feature)}<p class="an-imm-note" aria-live="polite">${esc(note)}</p></div>` : ""}
</div>`;
  }).join("");
  const on = features.filter((feature) => choices.get(feature.id)).length;
  return `<div class="an-imm"><p class="an-imm-intro">${intro}</p><div class="an-imm-list">${rows}</div>
<footer class="an-imm-foot"><button type="button" data-all="on">Use all</button><button type="button" data-all="off">Use none</button><span class="an-imm-count">${on} of ${features.length} on</span><button type="button" class="an-imm-save" data-save>Save my choices</button></footer></div>`;
}

/**
 * The window class. Options: `id` the module; `settings()` game.settings; `isGM()`; `demo(featureId)` shows a feature on the canvas, returning { note, undo };
 * `preview(values)` makes these setting values count on this screen without saving them (null: none); `reloadConfirm(options)`; `scene()` the open scene document, whose switches are saved with the rest.
 * Open it with `new Window({ only: [ids] })` to ask about those features alone.
 */
export function immersionWindow(ApplicationV2, {
  id, settings = () => globalThis.game.settings, isGM = () => globalThis.game.user?.isGM === true,
  demo = () => ({}), preview = () => {}, reloadConfirm = (options) => globalThis.foundry?.applications?.settings?.SettingsConfig?.reloadConfirm?.(options), scene = () => globalThis.canvas?.scene ?? null,
} = {}) {
  return class AnimaterImmersion extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-immersion`, classes: ["animater", "animater-immersion"],
      window: { title: "Animater: choose your immersion", icon: "fa-solid fa-leaf", resizable: true },
      position: { width: 400, height: 640 },
    };
    context() {
      const s = settings(), full = (key) => `${id}.${key}`;
      return { get: (key) => s.get(id, key), has: (key) => s.settings.get(full(key))?.type === Boolean, isGM: isGM() };
    }
    prepare() {
      if (this.features) return;
      const ctx = this.context(), only = this.options.only;
      this.features = IMMERSION_FEATURES.filter((feature) => featureShown(feature, ctx) && (!only || only.includes(feature.id)));
      this.before = new Map(this.features.map((feature) => [feature.id, featureOn(feature, ctx)]));
      this.choices = new Map(this.before);
      this.note = "";
      const flags = scene()?.flags?.[id] ?? {};
      this.sceneBefore = new Map(this.features.filter((feature) => feature.scene).map((feature) => [feature.id, sceneValue(feature, flags)]));
      this.sceneNow = new Map(this.sceneBefore);
    }
    async _renderHTML() { this.prepare(); return immersionHTML({ features: this.features, choices: this.choices, selected: this.selected, isGM: isGM(), note: this.note, sceneValues: this.sceneNow, sceneName: scene()?.name ?? "" }); }
    _replaceHTML(html, content) {
      const top = content.querySelector(".an-imm-list")?.scrollTop ?? 0;
      content.innerHTML = html;
      const list = content.querySelector(".an-imm-list");
      if (list) list.scrollTop = top;
      content.querySelector(".an-imm-row.open")?.scrollIntoView?.({ block: "nearest" });
    }
    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      // Beside the canvas rather than over the middle of it, where the examples play.
      this.setPosition({ left: Math.max(10, globalThis.innerWidth - 400 - 320), top: 60 });
    }
    _onRender(context, options) {
      super._onRender?.(context, options);
      if (this._wired) return;
      this._wired = true;
      this.element.addEventListener("click", (event) => {
        const all = event.target.closest?.("[data-all]");
        if (all) return void this.finish(new Map(this.features.map((feature) => [feature.id, all.dataset.all === "on"])));
        if (event.target.closest?.("[data-save]")) return void this.finish(this.choices);
        if (event.target.closest?.("[data-tick]") || event.target.closest?.(".an-imm-scene")) return; // Their own change, below.
        const row = event.target.closest?.("[data-feature]");
        if (row) { event.preventDefault(); this.select(row.dataset.feature); } // Its name shows it; only the box ticks it.
      });
      this.element.addEventListener("change", (event) => {
        const chosen = event.target.closest?.("[data-scene]");
        if (chosen) { this.sceneNow.set(chosen.dataset.scene, chosen.value); return; }
        const tick = event.target.closest?.("[data-tick]"); if (!tick) return;
        this.choices.set(tick.dataset.tick, tick.checked);
        this.previewNow();
        this.select(tick.dataset.tick);
      });
    }
    previewNow() { preview(choiceWrites(this.features, this.before, this.choices, this.context())); }
    stop() { try { this.undo?.(); } catch { /* it was only an example */ } this.undo = null; }
    select(featureId) {
      this.stop();
      this.selected = featureId;
      if (this.choices.get(featureId)) {
        const shown = (() => { try { return demo(featureId) ?? {}; } catch (e) { console.warn("Animater immersion example:", e); return {}; } })();
        this.note = shown.note ?? ""; this.undo = shown.undo ?? null;
      } else this.note = "Off: this will not play.";
      this.render();
    }
    async finish(choices) {
      this.stop(); preview(null);
      const s = settings(), writes = choiceWrites(this.features, this.before, choices, this.context());
      let reload = false;
      for (const [key, value] of writes) {
        if (s.get(id, key) === value) continue;
        await s.set(id, key, value);
        reload ||= s.settings.get(`${id}.${key}`)?.requiresReload === true;
      }
      const place = isGM() ? scene() : null, changes = place ? sceneWrites(this.features, this.sceneBefore, this.sceneNow, id) : {};
      if (Object.keys(changes).length) await place.update(changes);
      this.saved = true;
      await this.close();
      if (reload) await reloadConfirm({ world: isGM() });
    }
    async close(options) { this.stop(); preview(null); return super.close(options); }
  };
}

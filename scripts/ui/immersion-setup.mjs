// "Choose your immersion": once after an update, and whenever asked from the settings, each immersion feature explained and shown live on the scene that is open, on this
// screen only and with nothing saved until Save. The GM chooses for the table; each player chooses for their own screen from what the GM left on.
//
// A feature here is several settings that belong together. The pure parts (which settings, what to write, what is new) come first; the window takes what it needs as options.

export const IMMERSION_FEATURES = Object.freeze([
  { id: "wildlife", name: "Animals in the wild", short: "Birds, deer, rabbits, frogs, ducks", about: "Animals live in your outdoor scenes: they graze, swim and fly, run from noise and from your creatures, and hunt each other. They keep to the ground that suits them.", keys: ["wildlife", "wildlifeSounds", "birdShadows", "fireflies"] },
  { id: "vermin", name: "Vermin and critters", short: "Rats, bats, things behind doors", about: "Rats scuttle along the walls indoors and underground, bats wheel in the dark, and things burst out when a door opens.", keys: ["vermin", "verminSounds", "doorBurst"] },
  { id: "light", name: "Sun and shadows", short: "Shadows that follow the hour", about: "Creatures, walls and roofs cast shadows that move with the time of day. Light falls through windows and tree cover, and clouds pass over the ground.", keys: ["groundShadows", "shadowsOverTokens", "shadowShapes", "lightShadows", "wallShadows", "windowLight", "canopyLight", "roofLight", "cloudShadows", "surfaceGlints", "sunColor", "litBySurroundings"] },
  { id: "weather", name: "Weather on the map", short: "Rain, snow, wind, seasons", about: "Weather changes the ground itself: puddles and rings in the water, snow lying on open ground, leaves falling, trees swaying in the wind, mist at dawn.", keys: ["weatherLight", "weatherOnMap", "weatherClouds", "wetGround", "snowCover", "tileSnow", "frozenWater", "rainRings", "lightningFlashes", "rainbows", "fallingLeaves", "morningMist", "treeSway", "seasonGround", "heatShimmer", "weatherOnCreatures"] },
  { id: "fire", name: "Fire and lamplight", short: "Flames, smoke, embers", about: "Lights get flames and embers, smoke gathers in rooms, torches are held and flicker in drafts, and windows glow at night.", keys: ["fireHaze", "fireSmoke", "heldTorches", "lightOrbs", "lampEmbers", "lampMotes", "lightFlames", "roomSmoke", "torchDraft", "windowGlow"] },
  { id: "feet", name: "Feet on the floor", short: "Prints, dust, ripples, wakes", about: "Creatures leave prints and kick up what they walk on, wade with ripples and swim with a wake. Sand, mud, snow and grass each answer in their own way.", keys: ["movementFeel"] },
  { id: "creatures", name: "Living creatures", short: "Breathing, shifting, voices", about: "Creatures breathe and shift while they wait, fliers hover, and they make their own sounds now and then.", keys: ["idleLife", "idleBreathing", "idleHover", "creatureIdleSounds", "creatureVoices"] },
  { id: "caves", name: "Caves and dungeons", short: "Mist, drips, moths, rubble", about: "Underground scenes get drips, drafts, dust from the ceiling, glowing fungus, crystals, webs, eyes in the dark and falling pebbles.", keys: ["drips", "drafts", "ceilingDust", "caveMist", "caveFungus", "caveCrystals", "caveLava", "caveWebs", "caveWet", "caveSteam", "caveFoul", "caveSoot", "caveEyes", "caveMoths", "cavePebbles", "caveRubble", "caveSkylight"] },
  { id: "sound", name: "Sounds of the world", short: "Rain, wind, rivers, footsteps", about: "Weather and rivers can be heard as you come near them, footsteps match the floor, and rooms echo as their size suggests.", keys: ["weatherSounds", "riverSounds", "footstepSounds", "roomAcoustics"] },
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
// The features this person has not been asked about yet (pure).
export const newFeatures = (features, seen) => features.filter((feature) => !(seen ?? []).includes(feature.id));

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The window's content (pure).
export function immersionHTML({ features, choices, selected, isGM, note = "" }) {
  const intro = isGM
    ? "<b>Not every table wants all of this, so choose what you like.</b> Click one to see it on this scene, on your screen only. Nothing is saved until you choose below. You can change this any time in Animater settings."
    : "<b>Choose what plays on your screen.</b> Your GM has these on for the table. Click one to see it on this scene. Turning one off changes only what you see and hear.";
  const rows = features.map((feature) => {
    const open = feature.id === selected;
    return `<div class="an-imm-row${open ? " open" : ""}" data-feature="${esc(feature.id)}">
  <label class="an-imm-head"><input type="checkbox" data-tick="${esc(feature.id)}"${choices.get(feature.id) ? " checked" : ""} aria-label="${esc(feature.name)}"><span class="an-imm-name">${esc(feature.name)}<small>${esc(feature.short)}</small></span></label>
  ${open ? `<div class="an-imm-more"><p>${esc(feature.about)}</p><p class="an-imm-note" aria-live="polite">${esc(note)}</p></div>` : ""}
</div>`;
  }).join("");
  const on = features.filter((feature) => choices.get(feature.id)).length;
  return `<div class="an-imm"><p class="an-imm-intro">${intro}</p><div class="an-imm-list">${rows}</div>
<footer class="an-imm-foot"><button type="button" data-all="on">Use all</button><button type="button" data-all="off">Use none</button><span class="an-imm-count">${on} of ${features.length} on</span><button type="button" class="an-imm-save" data-save>Save my choices</button></footer></div>`;
}

/**
 * The window class. Options: `id` the module; `settings()` game.settings; `isGM()`; `demo(featureId)` shows a feature on the canvas, returning { note, undo };
 * `preview(values)` makes these setting values count on this screen without saving them (null: none); `reloadConfirm(options)`.
 * Open it with `new Window({ only: [ids] })` to ask about those features alone.
 */
export function immersionWindow(ApplicationV2, {
  id, settings = () => globalThis.game.settings, isGM = () => globalThis.game.user?.isGM === true,
  demo = () => ({}), preview = () => {}, reloadConfirm = (options) => globalThis.foundry?.applications?.settings?.SettingsConfig?.reloadConfirm?.(options),
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
    }
    async _renderHTML() { this.prepare(); return immersionHTML({ features: this.features, choices: this.choices, selected: this.selected, isGM: isGM(), note: this.note }); }
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
        if (event.target.closest?.("[data-tick]")) return; // The tick's own change, below.
        const row = event.target.closest?.("[data-feature]");
        if (row) { event.preventDefault(); this.select(row.dataset.feature); } // Its name shows it; only the box ticks it.
      });
      this.element.addEventListener("change", (event) => {
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
      this.saved = true;
      await this.close();
      if (reload) await reloadConfirm({ world: isGM() });
    }
    async close(options) { this.stop(); preview(null); return super.close(options); }
  };
}

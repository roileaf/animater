// Damage immersion showcase (GM page): previews on the GM's own screen exactly what players see from the damage lens,
// tunnel vision and the heartbeat. The host plays them through the live feature's own code (main.mjs lensPreview);
// this page only gathers the choices. The main mode uses two real tokens of this scene: the player's creature (whose
// screen it is) and the other creature, any PC or NPC mixed and matched; the host selects the one, targets the other,
// centres the view and plays. A sampler below tries any creature type's blood without tokens.
import { BLOOD_TYPES, DEFAULT_BLOOD } from '../engines/motion/blood-colors.mjs';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const DAMAGE_SHOWCASE_PAGE = 'damage-showcase';
// Stand-in blood when the host sends no presets: Animater's default table (engines/motion/blood-colors.mjs). The host
// sends Splatter's Blood Sheet ('#rrggbb' by type) while Splatter is active, else the GM's Blood colours table
// ({ color, bleeds, label } by type).
export const BLOOD_PRESETS = Object.freeze(Object.fromEntries(BLOOD_TYPES.map(({ key, label }) => [key, Object.freeze({ ...DEFAULT_BLOOD[key], label })])));
const presetBlood = (p) => (typeof p === 'string' ? { color: p, bleeds: true } : p && typeof p === 'object' ? { color: p.color, bleeds: p.bleeds !== false } : null);
const SHARES = [0.05, 0.15, 0.3, 0.6];
// The damage types a preview can strike with (engines/camera/lens-blood.mjs DAMAGE_WOUNDS); '' is the plain mixed look.
export const DAMAGE_TYPES = Object.freeze([['', 'Any (mixed)'], ['slashing', 'Slashing'], ['piercing', 'Piercing'], ['bludgeoning', 'Bludgeoning'], ['bleed', 'Bleed'],
  ['force', 'Force'], ['sonic', 'Sonic / thunder'], ['electricity', 'Electricity / lightning'], ['fire', 'Fire'], ['cold', 'Cold'], ['acid', 'Acid'],
  ['poison', 'Poison'], ['void', 'Void / necrotic'], ['vitality', 'Vitality / radiant'], ['mental', 'Mental / psychic'], ['spirit', 'Spirit'],
  ['arcane', 'Arcane (Daggerheart magical)']]);
const ACTIONS = ['damage-pick', 'damage-swap', 'damage-from-canvas', 'damage-duel', 'damage-hit', 'damage-deal', 'damage-linger-start', 'damage-linger-stop', 'damage-amount', 'damage-gore', 'damage-refresh',
  'damage-wound-show', 'damage-down', 'damage-wake', 'damage-wound-stop'];
// The down states when the host sends none (engines/camera/lens-wounds.mjs downPreviews names them by system).
export const DOWN_STATES = Object.freeze([{ id: 'dying1', label: 'Dying 1' }, { id: 'dying2', label: 'Dying 2' }, { id: 'dying3', label: 'Dying 3' },
  { id: 'unconscious', label: 'Unconscious' }, { id: 'stable', label: 'Stable' }, { id: 'dead', label: 'Dead' }]);
// How long the window stays tucked at most, and how often the host is asked whether the preview still plays.
const TUCK_LIMIT_MS = 20000, LINGER_TUCK_MS = 7000, TUCK_POLL_MS = 250;

export class DamageShowcaseUI {
  constructor(workspace) {
    this.w = workspace;
    this.options = { share: 0.15, crit: false, victimColor: 'humanoid', enemy: 'humanoid', damage: 8, enemyMax: 40, dealCrit: false, side: 'left', lowHp: 0.15, amount: null, gore: null, damageType: 'slashing', woundHp: 0.3, woundCombat: true };
    // Which wounded-view preview plays now ('hp' follows the slider), so a change of HP or combat shows at once.
    this.woundLive = null;
    this.mine = null; this.other = null;
  }
  // A blood choice ('token:<id>' or a preset name) as { color, bleeds }.
  blood(choice) {
    const s = this.snapshot ?? {}, presets = this.presets();
    if (String(choice).startsWith('token:')) {
      const t = (s.tokens ?? []).find((x) => x.id === String(choice).slice(6));
      if (t) return { color: t.color, bleeds: t.bleeds !== false };
    }
    return presetBlood(presets[choice]) ?? presetBlood(presets.humanoid) ?? presetBlood(BLOOD_PRESETS.humanoid);
  }
  // The creature types offered: the host's (Splatter's sheet, or the GM's table), else the defaults.
  presets() {
    const sent = this.snapshot?.presets;
    return sent && typeof sent === 'object' && Object.keys(sent).length ? sent : BLOOD_PRESETS;
  }
  bloodOptions(selected) {
    const s = this.snapshot ?? {}, presets = this.presets();
    const presetLabel = (k, p) => { const b = presetBlood(p); return `${(p && typeof p === 'object' && p.label) || k} · ${b?.bleeds === false ? 'no blood' : b?.color ?? ''}`; };
    const opt = (value, label) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
    return `<optgroup label="Scene tokens">${(s.tokens ?? []).map((t) => opt(`token:${t.id}`, `${t.name}${t.bleeds === false ? ' (no blood)' : ''}`)).join('')}</optgroup>`
      + `<optgroup label="Creature types">${Object.entries(presets).map(([k, p]) => opt(k, presetLabel(k, p))).join('')}</optgroup>`;
  }
  tokens() { return this.snapshot?.tokens ?? []; }
  token(id) { return this.tokens().find((t) => t.id === id) ?? null; }
  // Keeps both picks on tokens still on the scene: mine defaults to the selected token (else the first PC), other to
  // the target (else the first creature that is not mine).
  settlePicks() {
    const list = this.tokens();
    if (!this.token(this.mine)) this.mine = (list.find((t) => t.selected) ?? list.find((t) => t.pc) ?? list[0])?.id ?? null;
    if (!this.token(this.other) || this.other === this.mine) this.other = (list.find((t) => t.targeted && t.id !== this.mine) ?? list.find((t) => t.id !== this.mine && !t.pc) ?? list.find((t) => t.id !== this.mine))?.id ?? null;
  }
  // One creature: its look, HP and blood, with Select (the player's creature) and Target (the other creature).
  tile(t) {
    const mine = this.mine === t.id, other = this.other === t.id;
    const hp = t.hp ? `${t.hp.value}/${t.hp.max} HP` : "no HP";
    const blood = t.bleeds === false ? "<em class=\"an-dmg-swatch is-none\"></em>no blood" : `<em class="an-dmg-swatch" style="--blood:${esc(t.color)}"></em>${esc(t.color)}`;
    const pick = (slot, on, label) => `<button type="button" class="${on ? "is-active" : ""}" data-action="damage-pick" data-slot="${slot}" data-id="${esc(t.id)}" aria-pressed="${on}">${label}</button>`;
    return `<div class="an-dmg-token${mine ? " is-mine" : ""}${other ? " is-other" : ""}">${t.img ? `<img src="${esc(t.img)}" alt="">` : "<img alt=\"\">"}
      <span><b>${esc(t.name)}</b><small>${hp}${t.heart === false ? ' · no heartbeat' : ''}</small><small>${blood}</small></span>
      <div class="an-dmg-token-picks">${pick("mine", mine, "◎ Select")}${pick("other", other, "⌖ Target")}</div></div>`;
  }
  group(title, list) {
    return `<section class="an-dmg-group"><div class="an-eyebrow">${title} · ${list.length}</div>
      <div class="an-dmg-token-grid">${list.length ? list.map((t) => this.tile(t)).join("") : "<p class=\"an-hint\">None on this scene.</p>"}</div></section>`;
  }
  html() {
    this.snapshot = this.w.host.damageShowcase?.() ?? { tokens: [], presets: {}, settings: {} };
    this.settlePicks();
    const o = this.options, saved = this.snapshot.settings ?? {}, mine = this.token(this.mine), other = this.token(this.other);
    const variant = (kind, value, label, title = label) => `<button type="button" data-action="damage-${kind}" data-value="${value}" title="${title}" aria-pressed="${(o[kind] ?? 'saved') === value}" class="${(o[kind] ?? 'saved') === value ? 'is-active' : ''}">${label}</button>`;
    const ready = mine && other && mine.id !== other.id;
    const name = (t, fallback) => esc(t?.name ?? fallback);
    return `<div class="an-showcase an-damage-showcase">
     <div class="an-dmg-body"><div class="an-dmg-main">
     <header class="an-dmg-head"><div><div class="an-eyebrow">DAMAGE IMMERSION · LOCAL PREVIEW${this.snapshot.scene ? ` · ${esc(this.snapshot.scene)}` : ''}</div>
      <p>Only players see these, each on their own screen: the enemy's blood on the lens when their creature lands a hit; tunnel vision, their own blood and a heartbeat when their creature is hit. Colours come from Splatter when it is active, else from Animater's Blood colours (by creature type, or a token's own colour). Energy damage also leaves its own effect on the lens (Damage type effects: scorch and embers, frost, arcs, cracks, double vision...), bloodless creatures included. Bloodless creatures never bleed, and nothing shows for creatures a player cannot see. This plays on your screen only; Animater minimizes while it plays.</p></div>
      <p class="an-hint">Your screen: damage lens ${saved.local === false ? 'off' : 'on'} · damage type effects ${saved.effects === false ? 'off' : 'on'}${saved.effectsWorld === false ? ' (off for players)' : ''} · tunnel vision ${saved.tunnel === false ? 'off' : 'on'} · heartbeat ${saved.heartbeat === false ? 'off' : 'on'}</p></header>
     <div class="an-dmg-cast">
      <div class="an-dmg-cast-bar"><p><b>Select</b> the player's creature (whose screen you see; the view centres on it) and <b>Target</b> the other creature. Any PC or NPC, either way round.</p>
       <div><button type="button" data-action="damage-swap" aria-label="Swap selected and targeted">⇄ Swap</button><button type="button" data-action="damage-from-canvas" title="Use the token you selected and the one you targeted on the canvas">From canvas</button><button type="button" data-action="damage-refresh">Refresh</button></div></div>
      ${this.group("PLAYER CHARACTERS", this.tokens().filter((t) => t.pc))}
      ${this.group("NPCS", this.tokens().filter((t) => !t.pc))}
     </div>
     <details class="an-dmg-sampler"><summary>Try any blood colour without tokens</summary><div class="an-dmg-sampler-grid">
      <section><div class="an-eyebrow">YOUR CREATURE IS HIT</div>
       <label>Blood<select data-damage="victimColor">${this.bloodOptions(o.victimColor)}</select></label>
       <button type="button" data-action="damage-hit">Play</button></section>
      <section><div class="an-eyebrow">YOUR CREATURE HITS AN ENEMY</div>
       <label>Enemy<select data-damage="enemy">${this.bloodOptions(o.enemy)}</select></label>
       <div class="an-dmg-row"><label>Damage dealt<input type="number" min="1" max="500" data-damage="damage" value="${o.damage}"></label>
       <label>Enemy max HP<input type="number" min="1" max="2000" data-damage="enemyMax" value="${o.enemyMax}"></label>
       <label>Enemy is on the<select data-damage="side">${['left', 'right', 'top', 'bottom'].map((s) => `<option value="${s}" ${s === o.side ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
       <label class="an-showcase-check"><input type="checkbox" data-damage="dealCrit" ${o.dealCrit ? 'checked' : ''}> Critical hit</label>
       <button type="button" data-action="damage-deal">Play</button></section>
     </div></details></div>
     <aside class="an-dmg-play">
      <div class="an-dmg-controls">
       <label>Damage<select data-damage="share">${SHARES.map((v) => `<option value="${v}" ${v === o.share ? 'selected' : ''}>${Math.round(v * 100)}% of the victim's max HP</option>`).join('')}</select></label>
       <label>Damage type<select data-damage="damageType">${DAMAGE_TYPES.map(([v, l]) => `<option value="${v}" ${v === o.damageType ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
       <label class="an-showcase-check"><input type="checkbox" data-damage="crit" ${o.crit ? 'checked' : ''}> Critical hit</label>
       <div class="an-dmg-field"><span>Amount</span><div class="an-dmg-seg">${variant('amount', 'saved', 'Saved', `Your saved setting: ${esc(saved.amount ?? 'heavy')}`)}${variant('amount', 'heavy', 'Heavy')}${variant('amount', 'subtle', 'Subtle')}</div></div>
       <div class="an-dmg-field"><span>Gore</span><div class="an-dmg-seg">${variant('gore', 'saved', 'Saved', `Your saved setting: ${esc(saved.gore ?? 'full')}`)}${variant('gore', 'full', 'Full')}${variant('gore', 'subtle', 'Subtle')}</div></div>
      </div>
      <div class="an-dmg-buttons">
       <button type="button" class="an-dmg-go is-hurt" data-action="damage-duel" data-role="victim" ${ready ? '' : 'disabled'}><b>${name(other, 'Other')} hits ${name(mine, 'mine')}</b><small>Tunnel vision, heartbeat, ${name(mine, 'their')}'s blood</small></button>
       <button type="button" class="an-dmg-go is-deal" data-action="damage-duel" data-role="attacker" ${ready ? '' : 'disabled'}><b>${name(mine, 'Mine')} hits ${name(other, 'other')}</b><small>${name(other, 'The enemy')}'s blood on the lens</small></button>
      </div>
      <div class="an-dmg-linger"><span>Badly hurt, in combat</span><select class="an-dmg-linger-hp" data-damage="lowHp" aria-label="HP left">${[0.25, 0.15, 0.05].map((v) => `<option value="${v}" ${v === o.lowHp ? 'selected' : ''}>${Math.round(v * 100)}% HP left</option>`).join('')}</select>
       <div class="an-dmg-linger-buttons"><button type="button" data-action="damage-linger-start">▶ Start loop</button><button type="button" data-action="damage-linger-stop">■ Stop</button></div></div>
      ${this.woundHtml(mine, saved)}
     </aside></div></div>`;
  }
  // The wounded view: an HP slider (edges, lasting stains, muffle, heartbeat at a quarter or under in combat) and the
  // system's down states (the host's labels: PF2e Dying N, D&D 5e death saves...), waking and Stop, as the picked creature.
  woundHtml(mine, saved = {}) {
    const o = this.options, pct = Math.round(o.woundHp * 100);
    const states = Array.isArray(this.snapshot?.downStates) && this.snapshot.downStates.length ? this.snapshot.downStates : DOWN_STATES;
    const who = mine ? `As ${esc(mine.name)}${mine.heart === false ? ' (no heart: no heartbeat)' : ''}` : 'As a creature with a heart';
    return `<div class="an-dmg-wound"><span>Wounded view</span>
       <p class="an-hint">${who} · your screen: wounded view ${saved.wounded === false ? 'off' : 'on'} · heartbeat ${saved.heartbeat === false ? 'off' : 'on'}</p>
       <label class="an-dmg-wound-hp">HP left <output data-wound-hp>${pct}%</output><input type="range" min="0" max="100" step="5" data-damage="woundHp" value="${pct}" aria-label="HP left"></label>
       <label class="an-showcase-check"><input type="checkbox" data-damage="woundCombat" ${o.woundCombat ? 'checked' : ''}> In combat</label>
       <button type="button" data-action="damage-wound-show" class="${this.woundLive === 'hp' ? 'is-active' : ''}">▶ Show at this HP</button>
       <div class="an-dmg-wound-states">${states.map((st) => `<button type="button" data-action="damage-down" data-state="${esc(st.id)}" class="${this.woundLive === st.id ? 'is-active' : ''}">${esc(st.label)}</button>`).join('')}</div>
       <div class="an-dmg-linger-buttons"><button type="button" data-action="damage-wake">Wake up (gasp)</button><button type="button" data-action="damage-wound-stop">■ Stop</button></div></div>`;
  }
  // Minimizes Animater while a preview plays and brings it back once the host says nothing is left on screen.
  // The low-HP loop runs until stopped, so it comes back after a few seconds instead.
  async tuck(limitMs = TUCK_LIMIT_MS) {
    clearInterval(this.tuckPoll); this.tuckPoll = null;
    const restore = this.w.untuck ?? await this.w.tuckForPlayback?.(limitMs);
    if (!restore || !this.w.host.lensPreviewBusy) return;
    const started = Date.now();
    this.tuckPoll = setInterval(() => {
      if (Date.now() - started < 600 || this.w.host.lensPreviewBusy()) return;
      clearInterval(this.tuckPoll); this.tuckPoll = null; void restore();
    }, TUCK_POLL_MS);
  }
  untuck() { clearInterval(this.tuckPoll); this.tuckPoll = null; void this.w.untuck?.(); }
  stop() { this.w.host.stopLensPreview?.(); }
  suspend() { this.stop(); this.untuck(); }
  destroy() { this.stop(); this.untuck(); }
  change(el) {
    const field = el?.dataset?.damage;
    if (!field || !Object.hasOwn(this.options, field)) return false;
    this.options[field] = el.type === 'checkbox' ? el.checked : field === 'woundHp' ? Math.min(1, Math.max(0, Number(el.value) / 100)) : ['share', 'damage', 'enemyMax', 'lowHp'].includes(field) ? Number(el.value) : el.value;
    if (field === 'woundHp') {
      const out = el.closest?.('.an-dmg-wound')?.querySelector?.('[data-wound-hp]');
      if (out) out.textContent = `${Math.round(this.options.woundHp * 100)}%`;
    }
    // The HP preview playing follows the slider and the combat switch.
    if ((field === 'woundHp' || field === 'woundCombat') && this.woundLive === 'hp') this.w.host.previewLensWounded?.(this.woundArgs());
    return true;
  }
  woundArgs() {
    const o = this.options;
    return { hp: o.woundHp, inCombat: o.woundCombat !== false, mineId: this.mine ?? null, amount: o.amount, gore: o.gore };
  }
  async action(action, b) {
    if (!ACTIONS.includes(action)) return false;
    if (this.w.host.playerMode) throw Error('Only a GM can use Damage immersion showcase.');
    const o = this.options, variant = { amount: o.amount, gore: o.gore, damageType: o.damageType || null };
    if (action === 'damage-amount' || action === 'damage-gore') {
      const key = action.slice(7), value = b?.dataset?.value;
      o[key] = value === 'saved' ? null : value;
      this.w.render();
    } else if (action === 'damage-refresh') this.w.render();
    else if (action === 'damage-pick') {
      const slot = b?.dataset?.slot, id = b?.dataset?.id;
      if (slot !== 'mine' && slot !== 'other') return true;
      const rival = slot === 'mine' ? 'other' : 'mine';
      if (this[rival] === id) this[rival] = this[slot];
      this[slot] = id;
      this.w.render();
    } else if (action === 'damage-swap') { [this.mine, this.other] = [this.other, this.mine]; this.w.render(); }
    else if (action === 'damage-from-canvas') {
      const list = this.w.host.damageShowcase?.()?.tokens ?? [];
      const sel = list.find((t) => t.selected), tgt = list.find((t) => t.targeted && t.id !== sel?.id);
      if (sel) this.mine = sel.id;
      if (tgt) this.other = tgt.id;
      this.w.render();
    } else if (action === 'damage-duel') {
      if (!this.mine || !this.other || this.mine === this.other) return true;
      const role = b?.dataset?.role === 'attacker' ? 'attacker' : 'victim';
      await this.tuck();
      const played = await this.w.host.previewLensDuel?.({ mineId: this.mine, otherId: this.other, role, share: o.share, crit: o.crit, ...variant });
      if (!played) this.untuck();
    } else if (action === 'damage-hit') {
      const blood = this.blood(o.victimColor);
      await this.tuck();
      this.w.host.previewLensHit?.({ share: o.share, crit: o.crit, color: blood.color, bleeds: blood.bleeds, ...variant });
    } else if (action === 'damage-deal') {
      const blood = this.blood(o.enemy);
      await this.tuck();
      this.w.host.previewLensDeal?.({ damage: o.damage, max: o.enemyMax, crit: o.dealCrit, color: blood.color, bleeds: blood.bleeds, side: o.side, ...variant });
    } else if (action === 'damage-linger-start') { await this.tuck(LINGER_TUCK_MS); this.w.host.previewLensLinger?.({ hp: o.lowHp, ...variant }); }
    else if (action === 'damage-wound-show') {
      // A lasting state: tucked a few seconds only, so Stop stays in reach.
      this.woundLive = 'hp';
      await this.tuck(LINGER_TUCK_MS);
      this.w.host.previewLensWounded?.(this.woundArgs());
    } else if (action === 'damage-down') {
      const state = String(b?.dataset?.state ?? '');
      if (!state) return true;
      this.woundLive = state;
      await this.tuck(LINGER_TUCK_MS);
      this.w.host.previewLensDown?.({ state, mineId: this.mine ?? null, amount: o.amount, gore: o.gore });
    } else if (action === 'damage-wake') {
      this.woundLive = 'wake';
      await this.tuck(LINGER_TUCK_MS);
      this.w.host.previewLensWake?.({ mineId: this.mine ?? null, amount: o.amount, gore: o.gore });
    } else { this.woundLive = null; this.stop(); this.untuck(); }
    return true;
  }
}

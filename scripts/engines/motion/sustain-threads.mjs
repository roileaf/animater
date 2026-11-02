// Sustain threads (the "Sustained spells show who holds them" setting): while a creature sustains a spell on another
// (an effect marked sustained, cast by someone else), a faint shimmering thread runs from the caster to it — sagging a
// little, motes of the spell flowing along it toward the target — so everyone sees who holds what. It goes when the
// spell ends or either creature leaves the scene. Under the tokens, on this screen only; nothing is saved.

const TAU = Math.PI * 2;
const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

// An effect Foundry or the system treats as off (disabled, suppressed, inactive) holds nothing.
const isOn = (e) => !!e && e.disabled !== true && e.isSuppressed !== true && e.active !== false;

// The threads to draw: one per sustained effect on a creature that someone else cast, from the caster's token to it.
// `tokens`: [{ id, actorId, effects: [{ id, sustained, originActorId, hidden }] }] (actor uuids: unlinked copies of one
// NPC share an id); a caster with no token here draws
// none. Several effects between the same pair still draw one thread each (each its own spell).
export function sustainLinks(tokens = []) {
  const byActor = new Map();
  for (const t of tokens) if (t.actorId && !byActor.has(t.actorId)) byActor.set(t.actorId, t);
  const out = [];
  for (const t of tokens) {
    for (const e of t.effects ?? []) {
      if (!e.sustained || !isOn(e) || e.hidden || !e.originActorId || e.originActorId === t.actorId) continue;
      const caster = byActor.get(e.originActorId);
      if (caster && caster.id !== t.id) out.push({ key: `${caster.id}>${t.id}:${e.id}`, from: caster.id, to: t.id });
    }
  }
  return out;
}

// D&D 5e: a caster's Concentrating effect lists what it holds (dnd5e's getDependents): the effects it put on others and
// the creatures it summoned. Each on another creature here gets a thread from the caster. `tokens`: placeables (or
// alike: { id, actor: { uuid, effects }, document: { uuid } }).
export function concentrationLinks(tokens = []) {
  const byActor = new Map(tokens.map((t) => [t.actor?.uuid, t])), byDoc = new Map(tokens.map((t) => [t.document?.uuid, t])), out = [];
  for (const caster of tokens) {
    for (const effect of caster.actor?.effects ?? []) {
      if (!effect.statuses?.has?.('concentrating') || !isOn(effect) || typeof effect.getDependents !== 'function') continue;
      let held = [];
      try { held = effect.getDependents() ?? []; } catch { /* a dependent gone */ }
      for (const d of held) {
        if (d?.documentName === 'ActiveEffect' && !isOn(d)) continue;
        const target = d?.documentName === 'Token' ? byDoc.get(d.uuid) : d?.documentName === 'ActiveEffect' ? byActor.get(d.parent?.uuid) : null;
        if (target && target !== caster) out.push({ key: `${caster.id}>${target.id}:${d.id}`, from: caster.id, to: target.id });
      }
    }
  }
  return out;
}

// A point `u` (0 caster … 1 target) along the thread between a and b, sagging by `sag` of its length, wavering at `t`.
export function threadPoint(a, b, u, t = 0, { sag = 0.08, seed = 0 } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const bow = Math.sin(Math.PI * u) * len * sag + Math.sin(u * 9 + t * 2.2 + seed) * Math.sin(Math.PI * u) * 3;
  return { x: a.x + dx * u + nx * bow, y: a.y + dy * u + ny * bow };
}

// Motes flowing along it at `t`: [{ u, alpha }], each leaving the caster and fading in and out as it travels.
export function threadMotes(key, t, count = 5) {
  const p = hash(String(key));
  return Array.from({ length: count }, (_, i) => {
    const u = ((t * 0.35 + i / count + p) % 1 + 1) % 1;
    return { u, alpha: Math.sin(Math.PI * u) };
  });
}

// The drawing: one Graphics per thread under the tokens, redrawn each frame. `sync(list)` keeps one per
// [{ key, a: {x,y}, b: {x,y}, color, visible }] and `tick(t)` draws them.
export function createSustainThreads({ PIXI, root }) {
  const threads = new Map();
  const drop = (th) => { try { if (!th.g.destroyed) th.g.destroy(); } catch { /* gone */ } };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const l of list) {
        if (!l?.visible) continue;
        seen.add(l.key);
        let th = threads.get(l.key);
        if (!th || th.g.destroyed || th.g.parent !== root()) {
          if (th) drop(th);
          const g = new PIXI.Graphics();
          g.eventMode = 'none';
          if (PIXI.BLEND_MODES?.ADD !== undefined) g.blendMode = PIXI.BLEND_MODES.ADD;
          root().addChild(g);
          threads.set(l.key, th = { g, seed: hash(l.key) * TAU });
        }
        th.spec = l;
      }
      for (const [key, th] of threads) if (!seen.has(key)) { drop(th); threads.delete(key); }
    },
    tick(seconds) {
      for (const [key, th] of threads) {
        try {
          const { a, b, color = 0xc9b8ff } = th.spec, g = th.g, steps = 24, len = Math.hypot(b.x - a.x, b.y - a.y);
          g.clear();
          if (len < 10) continue;
          const pts = Array.from({ length: steps + 1 }, (_, i) => threadPoint(a, b, i / steps, seconds, { seed: th.seed }));
          // A soft wide glow under a thin bright strand, breathing slowly.
          const breathe = 0.75 + 0.25 * Math.sin(seconds * 1.6 + th.seed);
          for (const [width, alpha] of [[7, 0.06], [3.5, 0.12], [1.4, 0.35]]) {
            g.lineStyle(width, color, alpha * breathe);
            g.moveTo(pts[0].x, pts[0].y);
            for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
          }
          g.lineStyle(0);
          for (const m of threadMotes(key, seconds)) {
            const p = threadPoint(a, b, m.u, seconds, { seed: th.seed });
            g.beginFill(color, 0.35 * m.alpha).drawCircle(p.x, p.y, 4).endFill();
            g.beginFill(0xffffff, 0.7 * m.alpha).drawCircle(p.x, p.y, 1.6).endFill();
          }
        } catch { /* a thread mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const th of threads.values()) drop(th); threads.clear(); },
    get size() { return threads.size; },
  };
}

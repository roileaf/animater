// The animal HUD (GM only): right-click an animal on the canvas for a small HUD like a token's. Go here, Follow token and
// Circle token each ask for a click (a spot, or a token); Let it go ends an order; Remove takes a placed animal away.
// The orders themselves: engines/motion/animal-orders.mjs. This file only draws the HUD and asks for the click.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const ANIMAL_NAMES = Object.freeze({ rabbit: 'Rabbit', songbird: 'Bird', hawk: 'Hawk', deer: 'Deer', fox: 'Fox', wolf: 'Wolf', squirrel: 'Squirrel', snake: 'Snake' });
const ORDER_WORDS = { go: 'Going to a spot', follow: 'Following', circle: 'Circling' };
// What the pick asks for, by order.
export const PICK_HINT = Object.freeze({ go: 'Click where it should go · Esc cancels', follow: 'Click a token to follow · Esc cancels', circle: 'Click a token to circle · Esc cancels' });

// The HUD's inside (pure HTML): the name and what it is doing, the order buttons (the current one lit), Let it go and
// Remove where they apply, and the pick prompt while one is asked for.
export function animalHudHTML({ kind, order = null, placed = false, picking = null, tokenName = '' } = {}) {
  const lit = (type) => (order?.type === type || picking === type ? ' active' : '');
  const doing = order ? `${ORDER_WORDS[order.type] ?? ''}${order.type !== 'go' && tokenName ? ` ${esc(tokenName)}` : ''}` : 'Wandering';
  const btn = (action, icon, title, cls = '') => `<button type="button" class="an-ahud-btn${cls}" data-ahud="${action}" title="${title}" aria-label="${title}"><i class="fa-solid ${icon}"></i></button>`;
  return `<div class="an-ahud-name"><b>${esc(ANIMAL_NAMES[kind] ?? kind)}</b><small>${doing}</small></div>
    <div class="an-ahud-col an-ahud-left">${btn('go', 'fa-location-dot', 'Go here', lit('go'))}${btn('follow', 'fa-shoe-prints', 'Follow token', lit('follow'))}${btn('circle', 'fa-rotate-right', 'Circle token', lit('circle'))}</div>
    <div class="an-ahud-col an-ahud-right">${order ? btn('release', 'fa-wind', 'Let it go') : ''}${placed ? btn('remove', 'fa-trash', 'Remove') : ''}</div>
    ${picking ? `<div class="an-ahud-pick">${PICK_HINT[picking]}</div>` : ''}`;
}

/**
 * Opens the HUD over an animal. ctx: { kind, placed, order, tokenName(order), at() → client { x, y } or null (it follows the
 * animal; null closes), onOrder(type), onRelease(), onRemove(), onClose() }. Returns { close, picking(type|null), refresh(order, placed) }.
 */
export function openAnimalHud(ctx, doc = globalThis.document, win = globalThis.window) {
  const el = doc.createElement('div');
  el.id = 'animater-animal-hud';
  let state = { order: ctx.order ?? null, placed: Boolean(ctx.placed), picking: null }, frame = null, closed = false;
  const draw = () => { el.innerHTML = animalHudHTML({ kind: ctx.kind, ...state, tokenName: ctx.tokenName?.(state.order) ?? '' }); };
  const follow = () => {
    if (closed) return;
    const p = ctx.at();
    if (!p) { close(); return; }
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    frame = win.requestAnimationFrame(follow);
  };
  const close = () => { if (closed) return; closed = true; win.cancelAnimationFrame?.(frame); el.remove(); ctx.onClose?.(); };
  for (const type of ['pointerdown', 'mousedown', 'contextmenu', 'wheel']) el.addEventListener(type, (e) => e.stopPropagation());
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const action = e.target.closest?.('[data-ahud]')?.dataset.ahud;
    if (action === 'go' || action === 'follow' || action === 'circle') ctx.onOrder(action);
    else if (action === 'release') ctx.onRelease();
    else if (action === 'remove') ctx.onRemove();
  });
  draw();
  doc.body.append(el);
  follow();
  return {
    close,
    get closed() { return closed; },
    picking(type) { state.picking = type; draw(); },
    refresh(order, placed) { state = { ...state, order: order ?? null, placed: Boolean(placed) }; draw(); },
  };
}

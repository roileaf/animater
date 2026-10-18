// Builds PIXI filters from animater FX specs (see filters/index.mjs).
// One class per PIXI instance; programs are cached by PIXI per shader source.
import { fragment } from './glsl.mjs';
import { compileAnimations } from './animation.mjs';
import { specFor, resolveParams } from './filters/index.mjs';

const classes = new WeakMap();
const sources = new Map();

const DECL = { float: 'float', int: 'float', bool: 'float', vec2: 'vec2', vec3: 'vec3', vec4: 'vec4' };
export function shaderSource(spec) {
  if (!sources.has(spec.type)) {
    const decls = [
      ...Object.entries(spec.uniforms ?? {}).map(([name, [kind]]) => `uniform ${DECL[kind]} ${name};`),
      ...Object.keys(spec.textures ?? {}).flatMap(name => [`uniform sampler2D ${name};`, `uniform vec2 ${name}Size;`]),
    ].join('\n');
    sources.set(spec.type, fragment(decls, spec.glsl));
  }
  return sources.get(spec.type);
}

function uniformValue(kind, value) {
  if (kind === 'bool') return value ? 1 : 0;
  if (kind === 'int' || kind === 'float') return Number.isFinite(+value) ? +value : 0;
  return value;
}

let seedCounter = 0;
export function fxFilterClass(PIXI) {
  if (classes.has(PIXI)) return classes.get(PIXI);
  class FxFilter extends PIXI.Filter {
    constructor(params, { tokenSize = null, key = '', textures = null } = {}) {
      const spec = specFor(params.filterType);
      if (!spec) throw Error(`Unknown token FX filter: ${params.filterType}`);
      const uniforms = {
        uTime: 0, uZoom: 1, uCenter: new Float32Array(2), uSeed: (seedCounter++ * 0.618034) % 1,
        uScreenToArt: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        uArtToScreen: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        uArtSize: new Float32Array([100, 100]), uTokenSize: new Float32Array([100, 100]),
      };
      for (const [name, [kind]] of Object.entries(spec.uniforms ?? {}))
        uniforms[name] = kind === 'vec2' ? new Float32Array(2) : kind === 'vec3' ? new Float32Array(3) : kind === 'vec4' ? new Float32Array(4) : 0;
      for (const name of Object.keys(spec.textures ?? {})) { uniforms[name] = PIXI.Texture.EMPTY; uniforms[`${name}Size`] = new Float32Array([0, 0]); }
      super(undefined, shaderSource(spec), uniforms);
      this.spec = spec;
      this.fxKey = key;
      this.tokenSize = tokenSize;
      this.base = resolveParams(spec, params);
      this.current = { ...this.base };
      this.animations = compileAnimations(params.animated, this.base);
      this.zOrder = Number.isFinite(params.zOrder) ? params.zOrder : spec.order ?? 500;
      this.fxZoom = 1;
      this.autoFit = true;
      this.bindTextures(textures);
      this.writeUniforms();
    }
    // Images come from the caller (previews own theirs) or PIXI's shared texture cache.
    bindTextures(own) {
      for (const [name, read] of Object.entries(this.spec.textures ?? {})) {
        const path = String(read(this.base) ?? '');
        if (!path) continue;
        let texture = own?.get?.(path);
        try { texture ??= PIXI.Texture.from(path); } catch { texture = null; }
        if (!texture) continue;
        this.uniforms[name] = texture;
        (this.images ??= []).push([name, texture]);
      }
    }
    // Padding is the effect's reach beyond the art, in screen pixels at the current zoom.
    get padding() {
      if (!this.spec) return 0;
      const reach = this.spec.reach?.(this.current, this.reachContext()) ?? 0;
      return Math.min(2048, Math.ceil(Math.max(0, reach) * this.fxZoom));
    }
    set padding(_) { /* computed */ }
    reachContext() {
      const t = this.tokenSize, a = this.uniforms.uArtSize;
      return { width: t?.width ?? a[0], height: t?.height ?? a[1], size: Math.max(t?.width ?? a[0], t?.height ?? a[1]) };
    }
    // Advance animations to `local` ms since the effect began and `world` ms (shared clock).
    update(local, world) {
      this.animations.sample(this.current, { local, world, key: this.fxKey });
      this.writeUniforms();
    }
    writeUniforms() {
      const p = this.current, u = this.uniforms;
      // An image's size is only known once it has loaded; until then shaders ignore it.
      for (const [name, texture] of this.images ?? []) {
        const b = texture.baseTexture, size = u[`${name}Size`];
        if (size[0] < 1 && b?.valid) size.set([b.realWidth || 1, b.realHeight || 1]);
      }
      u.uTime = (Number(p.time) || 0) * (this.spec.timeScale ?? 1);
      for (const [name, [kind, read]] of Object.entries(this.spec.uniforms ?? {})) {
        const value = uniformValue(kind, read(p));
        if (value && typeof value === 'object') u[name].set(value);
        else u[name] = value;
      }
    }
    apply(filterManager, input, output, clear) {
      this.measure(filterManager.activeState?.target ?? this.fxTarget);
      filterManager.applyFilter(this, input, output, clear);
    }
    // Screen ↔ art transforms from the filtered object's world transform.
    measure(target) {
      if (!target?.worldTransform) return;
      const wt = target.worldTransform;
      const tex = target.texture, orig = tex?.orig ?? tex?.frame;
      let w = orig?.width, h = orig?.height, ox = -(target.anchor?.x ?? 0) * (w ?? 0), oy = -(target.anchor?.y ?? 0) * (h ?? 0);
      if (!(w > 0 && h > 0)) {
        const b = target.getLocalBounds?.();
        if (!b || !(b.width > 0)) return;
        w = b.width; h = b.height; ox = b.x; oy = b.y;
      }
      const A = wt.a * w, B = wt.b * w, C = wt.c * h, D = wt.d * h;
      const TX = wt.a * ox + wt.c * oy + wt.tx, TY = wt.b * ox + wt.d * oy + wt.ty;
      const u = this.uniforms;
      u.uArtToScreen.set([A, B, 0, C, D, 0, TX, TY, 1]);
      const det = A * D - B * C || 1e-6;
      u.uScreenToArt.set([D / det, -B / det, 0, -C / det, A / det, 0, (C * TY - D * TX) / det, (B * TX - A * TY) / det, 1]);
      u.uCenter[0] = A * 0.5 + C * 0.5 + TX; u.uCenter[1] = B * 0.5 + D * 0.5 + TY;
      const pw = target.parent?.worldTransform;
      const zoom = pw ? Math.hypot(pw.a, pw.b) || 1 : 1;
      this.fxZoom = zoom;
      u.uZoom = zoom;
      u.uArtSize[0] = Math.hypot(A, B) / zoom; u.uArtSize[1] = Math.hypot(C, D) / zoom;
      const t = this.tokenSize;
      u.uTokenSize[0] = t?.width ?? u.uArtSize[0]; u.uTokenSize[1] = t?.height ?? u.uArtSize[1];
    }
  }
  classes.set(PIXI, FxFilter);
  return FxFilter;
}

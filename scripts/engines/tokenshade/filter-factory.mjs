// Tokenshade: builds PIXI filters from filter specs (see filters/index.mjs).
// One class per PIXI instance; programs are cached by PIXI per shader source.
//
// Silhouette fields: a spec with `field` first renders its slow, smooth silhouette terms
// (rings of alpha taps: fuel below the art, nearness, depth inside it) into a small
// texture, a few screen pixels per texel, then its main pass reads them with one
// filtered tap per pixel through fxField(). The field pass sees exactly the main
// pass's input and uniforms, so it follows every animation and earlier filter.
//
// Own reach: PIXI renders every filter of a token over the padding of the widest one, so
// a glow stacked under tall flames would run its noise over the whole fire area. Each
// filter passes pixels beyond its own reach through untouched. Its reach starts from
// everything drawn before it (the art box plus the padding of the filters ahead of it in
// the stack, since a glow after a shockwave lights the ring too) and adds its own padding.
import { fragment, FIELD_SAMPLER, REACH } from './glsl.mjs';
import { compileAnimations } from './animation.mjs';
import { specFor, resolveParams } from './filters/index.mjs';

const classes = new WeakMap();
const sources = new Map();
const fieldSources = new Map();

const DECL = { float: 'float', int: 'float', bool: 'float', vec2: 'vec2', vec3: 'vec3', vec4: 'vec4' };
export function shaderSource(spec) {
  if (!sources.has(spec.type)) {
    const decls = [
      ...Object.entries(spec.uniforms ?? {}).map(([name, [kind]]) => `uniform ${DECL[kind]} ${name};`),
      ...Object.keys(spec.textures ?? {}).flatMap(name => [`uniform sampler2D ${name};`, `uniform vec2 ${name}Size;`]),
    ].join('\n');
    const body = spec.glsl.replace(/\bvoid main\(\)/, 'void fxMain()');
    sources.set(spec.type, fragment(decls, `${REACH}\n${spec.field ? FIELD_SAMPLER : ''}\n${body}
void main() { if (fxBeyondReach(0.0)) { gl_FragColor = fxSample(vTextureCoord); return; } fxMain(); }`));
    // A margin of two coarsest texels keeps filtering at the edge of the reach unchanged.
    // phases: 2 averages two ring rotations half a turn of the dither apart, for sparse
    // wide rings: the mean the per-pixel dither gave the eye, without its grain turning
    // into stripes at the field's coarser grid.
    const sample = spec.field?.phases === 2
      ? 'fxJit = fxDither(); vec4 a = field(); fxJit = fract(fxJit + 0.5); gl_FragColor = clamp((a + field()) * 0.5, 0.0, 1.0);'
      : 'gl_FragColor = clamp(field(), 0.0, 1.0);';
    if (spec.field) fieldSources.set(spec.type, fragment(decls, `${REACH}\n${spec.field.glsl}
void main() {
  if (fxBeyondReach(16.0)) { gl_FragColor = vec4(0.0); return; }
  ${sample}
}`));
  }
  return sources.get(spec.type);
}
export function fieldSource(spec) {
  if (!spec.field) return null;
  shaderSource(spec);
  return fieldSources.get(spec.type);
}
// Field texels per logical screen pixel for texels `spacing` screen pixels apart, never
// finer than the input itself and never coarser than an eighth of it.
export function fieldResolution(spacing, inputResolution) {
  return Math.min(inputResolution, Math.max(inputResolution / 8, 1 / Math.max(1e-6, spacing)));
}
// Canvas pixels between field texels: the spec's own (about a third of its smallest
// ring), else 3% of the token radius.
export function fieldSpacing(spec, params, context) {
  const s = spec.field?.spacing?.(params, context);
  return Number.isFinite(s) && s > 0 ? s : context.size * 0.015;
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
      if (!spec) throw Error(`Unknown Tokenshade filter: ${params.filterType}`);
      const uniforms = {
        uTime: 0, uZoom: 1, uCenter: new Float32Array(2), uSeed: (seedCounter++ * 0.618034) % 1,
        uScreenToArt: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        uArtToScreen: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        uArtSize: new Float32Array([100, 100]), uTokenSize: new Float32Array([100, 100]),
        uReach: new Float32Array([-1e9, -1e9, 1e9, 1e9]),
      };
      for (const [name, [kind]] of Object.entries(spec.uniforms ?? {}))
        uniforms[name] = kind === 'vec2' ? new Float32Array(2) : kind === 'vec3' ? new Float32Array(3) : kind === 'vec4' ? new Float32Array(4) : 0;
      for (const name of Object.keys(spec.textures ?? {})) { uniforms[name] = PIXI.Texture.EMPTY; uniforms[`${name}Size`] = new Float32Array([0, 0]); }
      if (spec.field) { uniforms.uField = PIXI.Texture.EMPTY; uniforms.uFieldSize = new Float32Array([1, 1]); }
      super(undefined, shaderSource(spec), uniforms);
      this.spec = spec;
      // Same uniforms object, so both passes always agree.
      if (spec.field) this.fieldPass = new PIXI.Filter(undefined, fieldSource(spec), this.uniformGroup ?? this.uniforms);
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
      const stack = filterManager.activeState?.filters ?? [];
      let ahead = 0;
      for (const f of stack) { if (f === this) break; ahead = Math.max(ahead, f.padding || 0); }
      this.measure(filterManager.activeState?.target ?? this.fxTarget, ahead);
      if (!this.fieldPass) { filterManager.applyFilter(this, input, output, clear); return; }
      const u = this.uniforms, spacing = fieldSpacing(this.spec, this.current, this.reachContext()) * this.fxZoom;
      const field = filterManager.getFilterTexture(input, fieldResolution(spacing, input.resolution));
      filterManager.applyFilter(this.fieldPass, input, field, PIXI.CLEAR_MODES?.CLEAR ?? true);
      u.uField = field;
      u.uFieldSize[0] = field.width; u.uFieldSize[1] = field.height;
      filterManager.applyFilter(this, input, output, clear);
      u.uField = PIXI.Texture.EMPTY;
      filterManager.returnFilterTexture(field);
    }
    destroy(...args) {
      this.fieldPass?.destroy();
      this.fieldPass = null;
      super.destroy(...args);
    }
    // Screen ↔ art transforms from the filtered object's world transform.
    // `ahead`: screen px that filters earlier in the stack may have drawn beyond the art.
    measure(target, ahead = 0) {
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
      // Screen box of the art (never smaller than the bounds PIXI pads) plus this filter's padding.
      const pad = ahead + this.padding + 1;
      u.uReach[0] = TX + Math.min(0, A) + Math.min(0, C) - pad; u.uReach[1] = TY + Math.min(0, B) + Math.min(0, D) - pad;
      u.uReach[2] = TX + Math.max(0, A) + Math.max(0, C) + pad; u.uReach[3] = TY + Math.max(0, B) + Math.max(0, D) + pad;
    }
  }
  classes.set(PIXI, FxFilter);
  return FxFilter;
}

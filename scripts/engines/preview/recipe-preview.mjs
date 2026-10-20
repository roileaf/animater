import { RecipeClock, recipeFrame } from "../playback/choreography.mjs";
import { motionPose, motionDirection, combineMotionPoses, poseTransform } from "../motion/motion.mjs";
import {
  previewPose,
  normalizeOptions,
  easeValue,
  stageFrame,
} from "../../core/stage-options.mjs";
import { sampleRecipe } from "../playback/composition.mjs";
import { chainPreview } from "./chain-preview.mjs";
import { prepareFragments, fragmentPieces, fragmentFlight, fragmentPose, FRAGMENT_TINT_LOOKS } from "../fragments/fragments.mjs";
import { clearPreviewMediaFailure, markPreviewMediaFailure } from "../media/preview-media-status.mjs";
import {
  beamGeometry,
  artworkGeometry,
  effectFootprint,
  auraPreviewGrid,
  offsetInGridSquares,
} from "../media/media-preview.mjs";

// Token fragments in the preview: each piece is a copy of the token image clipped to the piece's
// polygon (unit square -0.5..0.5 as percent of the image) and turned about its centroid.
const percent = (v) => Math.round((v + 0.5) * 100000) / 1000 || 0;
export function fragmentPreviewParts(stage, cutAngle, turn = 0, size) {
  const s = prepareFragments(stage);
  return fragmentPieces(s, cutAngle, turn).map((piece, i) => ({
    clip: `polygon(${piece.polygon.map((p) => `${percent(p.x)}% ${percent(p.y)}%`).join(", ")})`,
    origin: `${percent(piece.centroid.x)}% ${percent(piece.centroid.y)}%`,
    piece,
    flight: fragmentFlight(s, piece, i, cutAngle, turn, size),
  }));
}
// The artwork a fragments stage cuts: the token image, or a placeholder actor's glyph element.
const previewArt = (token) => token.querySelector?.("img") ?? token.querySelector?.(".an-preview-token-art") ?? null;
const isFragments = (s) => s?.kind === "motion" && s.motion === "fragments";

// Editor composition uses installed media and the same motion pose function.
// Canvas preview remains the authoritative Sequencer rendering on real tokens.
export class RecipePreview {
  constructor(scene, recipe, onFrame, {tokenFx, sceneFx} = {}) {
    this.scene = scene;
    this.chain =
      scene.dataset.chainPreview !== undefined
        // Match the plan that generated DOM layers. A narrower inspector may
        // otherwise generate fewer area tiles and invalidate playback indices.
        ? chainPreview(recipe, { ...JSON.parse(scene.dataset.previewTokens ?? "{}"), previewWidth: Number(scene.dataset.previewWidth) || scene.clientWidth, previewHeight: Number(scene.dataset.previewHeight) || scene.clientHeight })
        : null;
    this.recipe = this.chain?.recipe ?? sampleRecipe(recipe);
    this.tokenInfo = JSON.parse(scene.dataset.previewTokens ?? "{}");
    this.onFrame = onFrame;
    this.tokenFxFactory=tokenFx;
    this.clock = new RecipeClock();
    this.videos = [...scene.querySelectorAll("video[data-preview-stage]")];
    this.images = [...scene.querySelectorAll('img[data-preview-stage]')];
    this.audio = [...scene.querySelectorAll("audio[data-preview-stage]")];
    this.layers = [...scene.querySelectorAll("[data-layer-stage]")];
    this.started = new Set();
    this.ended = new Set();
    this.abort = new AbortController();
    this.tokens = [...scene.querySelectorAll("[data-preview-token]")];
    this.fragments = new Map();
    this.grid=this.chain?.grid??55;
    const aura=recipe.lifecycle==='document'&&recipe.stages.some(s=>s.auraRadius);
    if(aura){
      this.grid=auraPreviewGrid(this.recipe,this.tokenInfo.source,scene.clientWidth||400,scene.clientHeight||300,Number(scene.dataset.previewGridDistance)||5);
    }
    if(aura||this.chain?.pathFrame){
      scene.style?.setProperty('background-size',`${this.grid}px ${this.grid}px`);
      for(const token of this.tokens){
        const chainActor=this.chain?.actors.find(a=>a.subject===token.dataset.previewToken&&(a.subject==='source'||a.targetIndex===Number(token.dataset.targetIndex??0)));
        const info=chainActor?.token??this.tokenInfo[token.dataset.previewToken],width=(info?.width??1)*this.grid,height=(info?.height??1)*this.grid;
        token.style.width=`${width}px`;token.style.height=`${height}px`;token.style.fontSize=`${this.grid*.45}px`;
        const actor=token.closest?.('.an-recipe-actor');
        if(actor){const labelWidth=Math.max(90,width);actor.style.width=`${labelWidth}px`;actor.style.marginLeft=`${-labelWidth/2}px`;actor.style.top=chainActor?`calc(${chainActor.y}% - ${height/2}px)`:`calc(45% + 27px - ${height/2}px)`;if(chainActor)actor.style.left=`${chainActor.x}%`;token.style.marginLeft=`${(labelWidth-width)/2}px`;}
        const image=token.querySelector?.('img');
        if(image){image.style.width=`${(info?.spriteWidth??info?.width??1)*this.grid}px`;image.style.height=`${(info?.spriteHeight??info?.height??1)*this.grid}px`;}
      }
    }
    try { this.sceneFx = sceneFx?.(scene, this.recipe, this.grid) ?? null; } catch (error) { this.sceneFx = null; scene.dataset.fxError = error.message; }
    if (this.chain && recipe.previewArea?.type === "cone" && !recipe.stages.some(s=>s.kind==='motion')) {
      for (const token of this.tokens) {
        const actor = this.chain.actors.find(a => a.subject === token.dataset.previewToken && (a.subject === "source" || a.targetIndex === Number(token.dataset.targetIndex ?? 0)));
        if (actor) { token.style.left = `${actor.x}%`; token.style.top = `${actor.y}%`; }
      }
    }
  }
  stateFor(element, frame) {
    if (element.dataset.previewPlan !== undefined) {
      const s = this.recipe.playbackPlan[Number(element.dataset.previewPlan)];
      const state = {
        ...stageFrame({ ...s, repeats: 1, targetStagger: 0 }, frame.time),
        stage: s,
        targetIndex: s.targetIndex,
        iteration: s.iteration,
      };
      if (this.muted?.has(s.index)) state.state = "pending";
      return state;
    }
    return frame.stages[
      Number(element.dataset.previewStage ?? element.dataset.layerStage)
    ];
  }
  // Buffer all layers before starting one shared recipe clock.
  prepare() {
    return this.mediaReady ??= Promise.all(
      [...this.videos, ...this.audio].map((video) => this.ready(video)).concat(this.images.map(image=>this.readyImage(image))),
    );
  }
  // from: start offset (ms). loop(): checked at each end to replay. range(): { start, end } of
  // one clip to loop instead of the whole recipe (null: the whole recipe).
  async play({ from = 0, loop, range } = {}) {
    await this.prepare();
    await this.prepareTokenFx();
    if (this.abort.signal.aborted) return false;
    let complete;
    this.sceneFx?.resume();
    do {
      // Re-entering stages mid-way must seek media to the shared clock again.
      this.started.clear();
      const span = range?.();
      if (span && (from < span.start || from >= span.end)) from = span.start;
      complete = await this.clock.play(this.recipe, (frame) => this.draw(frame), { from, until: span?.end ?? Infinity });
      from = range?.()?.start ?? 0;
    } while (complete && loop?.() && !this.abort.signal.aborted);
    return complete;
  }
  duration() { return recipeFrame(this.recipe, 0).duration; }
  // Show one still moment (timeline scrubbing): media seek but never play.
  async seek(ms) {
    await this.prepare();
    if (this.abort.signal.aborted) return;
    this.clock.stop();
    this.scrubbing = true;
    this.started.clear();
    try { this.draw(recipeFrame(this.recipe, ms)); } finally { this.scrubbing = false; }
    [...this.videos, ...this.audio].forEach((v) => v.pause());
    this.sceneFx?.freeze();
    // A seek made while its layer was hidden is not painted once the layer
    // shows; nudge visible videos so the browser decodes that frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (this.abort.signal.aborted) return;
    for (const v of this.videos)
      if (!v.closest(".an-recipe-layer")?.hidden) v.currentTime = v.currentTime + 0.001;
  }
  pause() {
    this.clock.stop();
    this.sceneFx?.freeze();
    [...this.videos, ...this.audio].forEach((v) => v.pause());
  }
  prepareTokenFx() {
    return this.fxReady??=Promise.resolve().then(async()=>{
      if(!this.tokenFxFactory||!this.recipe.stages.some(s=>s.kind==='tokenfx'))return;
      const preview=await this.tokenFxFactory(this.scene,this.recipe);
      if(this.abort.signal.aborted){preview?.stop();return;}
      this.tokenFx=preview;await preview?.ready();
      if(this.abort.signal.aborted)preview?.stop();
    }).catch(error=>{this.tokenFx?.stop();this.tokenFx=null;this.scene.dataset.fxError=error.message;});
  }
  ready(video) {
    if (this.abort.signal.aborted) return Promise.resolve();
    if (video.readyState >= 2 && !video.error) {
      clearPreviewMediaFailure(video);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        video.removeEventListener("loadeddata", finish);
        video.removeEventListener("error", finish);
        this.abort.signal.removeEventListener("abort", finish);
        if (!this.abort.signal.aborted) {
          clearPreviewMediaFailure(video);
          markPreviewMediaFailure(video);
        }
        resolve();
      };
      const timer = setTimeout(finish, 5000);
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("error", finish, { once: true });
      this.abort.signal.addEventListener("abort", finish, { once: true });
      video.load();
    });
  }
  readyImage(image) {
    if(this.abort.signal.aborted||image.complete&&image.naturalWidth>0)return Promise.resolve();
    return new Promise(resolve=>{
      const finish=()=>{
        clearTimeout(timer);image.removeEventListener('load',finish);image.removeEventListener('error',finish);this.abort.signal.removeEventListener('abort',finish);
        if(!this.abort.signal.aborted)image.closest('.an-recipe-layer')?.classList.toggle('is-unavailable',!image.naturalWidth);
        resolve();
      };
      const timer=setTimeout(finish,5000);
      image.addEventListener('load',finish,{once:true});image.addEventListener('error',finish,{once:true});this.abort.signal.addEventListener('abort',finish,{once:true});
    });
  }
  // Studio mute/solo: muted stages stay silent and hidden in this preview only.
  setMuted(indices) {
    this.muted = new Set(indices);
    this.started.clear();
  }
  draw(frame) {
    if (this.muted?.size)
      frame = { ...frame, muted: this.muted, stages: frame.stages.map((s) => (this.muted.has(s.index) ? { ...s, state: "pending" } : s)) };
    this.tokenFx?.draw(frame);
    try { this.sceneFx?.draw(frame, { seek: !!this.scrubbing }); } catch (error) { this.sceneFx?.stop(); this.sceneFx = null; this.scene.dataset.fxError = error.message; }
    for (const video of [...this.videos, ...this.audio]) {
      const index = Number(video.dataset.previewStage);
      const state = this.stateFor(video, frame);
      const layer = video.closest(".an-recipe-layer");
      const stage = state.stage ?? this.recipe.stages[index];
      const opts = normalizeOptions(stage);
      if (video.tagName !== "AUDIO") video.loop = !opts.oneShot;
      if (layer) layer.hidden = state.state !== "playing";
      const key = `${index}:${state.targetIndex}:${state.iteration}:${video.dataset.previewPlan ?? ""}`;
      const start = opts.clipStart / 1000,
        rate = video.tagName === "AUDIO" ? 1 : opts.playbackRate;
      const end = Math.min(
        opts.clipEnd ? opts.clipEnd / 1000 : Infinity,
        Number.isFinite(video.duration) ? video.duration : Infinity,
      );
      let expected = start + (state.localTime * rate) / 1000;
      if (end > start && Number.isFinite(end))
        expected = video.loop
          ? start + ((expected - start) % (end - start))
          : Math.min(expected, Math.max(start, end - 0.001));
      if (state.state === "playing" && !this.started.has(key)) {
        this.started.add(key);
        // A background/throttled frame can enter several stages late. Seek
        // each instance to its own shared-clock position, never replay from 0.
        video.currentTime = expected;
        if (video.tagName === "AUDIO") video.volume = opts.volume;
        else video.playbackRate = opts.playbackRate;
        if (!this.scrubbing) void video.play().catch((error) => {
          // A seek, stage transition or Stop can cancel pending play(). The
          // media is still valid; only resource/codec failures need a badge.
          if (error?.name === "AbortError" || this.abort.signal.aborted) return;
          if (markPreviewMediaFailure(video, error))
            this.scene.dataset.mediaError = "Asset media unavailable";
        });
      }
      if (
        state.state === "playing" &&
        Math.abs(video.currentTime - expected) > 0.15
      )
        video.currentTime = expected;
      if (
        state.state === "playing" &&
        (video.currentTime < opts.clipStart / 1000 ||
          (!opts.oneShot &&
            opts.clipEnd &&
            video.currentTime >= opts.clipEnd / 1000))
      )
        video.currentTime = opts.clipStart / 1000;
      if (
        opts.oneShot &&
        opts.clipEnd &&
        video.currentTime >= opts.clipEnd / 1000
      )
        video.pause();
      if (video.tagName === "AUDIO") {
        // A stage without a volume, or a pose before its first key, must not
        // hand the media element NaN (it throws and stops the preview frame).
        const volume = opts.volume *
          previewPose({ ...stage, opacity: 1, tracks: [] }, state.localTime).alpha;
        video.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
      }
      if (state.state !== "playing") {
        video.pause();
      }
    }
    for (const layer of this.layers) {
      if (!layer.dataset?.layerStage) continue;
      const index = Number(layer.dataset.layerStage),
        state = this.stateFor(layer, frame),
        stage = state.stage ?? this.recipe.stages[index];
      layer.hidden = state.state !== "playing";
      // Live FXMaster particles play in the monitor; their cue shrinks to a badge.
      if (layer.classList?.contains("an-provider-cue")) layer.classList.toggle("is-live", !!this.sceneFx?.handles(index));
      if (layer.hidden) continue;
      const s = { ...stage, ...normalizeOptions(stage) };
      let pose;
      const artwork = layer.querySelector("video,img,.an-copy-art");
      if (!artwork) continue;
      const areaLine =
        s.kind === "template" &&
        ["line", "cone"].includes(this.recipe.previewArea?.type) &&
        !s.areaTile;
      if (!["travel", "overlay"].includes(s.kind) && !areaLine) {
        const subject =
          s.kind === "projectile"
            ? s.travelOrigin === "target"
              ? "targets"
              : "source"
            : s.kind === "impact" || s.subject === "targets"
              ? "targets"
              : "source";
        const actor = this.chain?.actors.find(
          (a) =>
            a.id ===
            (s.kind === "projectile" ? s.origin?.id : s.destination?.id),
        );
        const info = actor?.token ?? this.tokenInfo[subject];
        if (actor && s.kind !== "projectile") { layer.style.left = `${actor.x}%`; layer.style.top = `${actor.y}%`; }
        let geometry;
        if (s.kind === "sprite") {
          geometry = {
            width: (info?.spriteWidth ?? info?.width ?? 1) * this.grid,
            height: (info?.spriteHeight ?? info?.height ?? 1) * this.grid,
          };
        } else {
          const area = this.recipe.previewArea;
          const gridDistance =
            Number(this.scene.dataset.previewGridDistance) || 5;
          const size = s.areaTile
            ? s.areaTile.width
            : s.kind === "template"
              ? ((area?.value ?? 15) / gridDistance) *
                (["square", "cube", "rect"].includes(area?.type) ? 1 : 2) *
                this.grid
              : effectFootprint(s,info,this.grid,gridDistance);
          geometry = artworkGeometry(
            size,
            artwork.videoWidth || artwork.naturalWidth || layer.dataset.mediaWidth,
            artwork.videoHeight || artwork.naturalHeight || layer.dataset.mediaHeight,
            { file: artwork.currentSrc || artwork.getAttribute?.("src"), width: artwork.videoWidth || artwork.naturalWidth || layer.dataset.mediaWidth, height: artwork.videoHeight || artwork.naturalHeight || layer.dataset.mediaHeight },
          );
        }
        layer.style.width = `${geometry.width}px`;
        layer.style.height = `${geometry.height}px`;
        artwork.style.objectFit = "fill";
      }
      const offsetActor=this.chain?.actors.find(a=>a.id===(s.kind==='projectile'?s.origin?.id:s.destination?.id));
      const offsetInfo=offsetActor?.token??this.tokenInfo[s.kind==='impact'||s.subject==='targets'?'targets':'source'];
      const offsets=offsetInGridSquares(s,offsetInfo,this.grid);
      pose = previewPose({...s,offsetX:offsets.x,offsetY:offsets.y}, state.localTime, this.grid, {
        width: parseFloat(layer.style.width) || 115,
        height: parseFloat(layer.style.height) || 115,
      });
      if (s.areaTile) {
        layer.style.left = `${s.areaTile.center.x / (this.chain?.width ?? 400) * 100}%`;
        layer.style.top = `${s.areaTile.center.y / (this.chain?.height ?? 300) * 100}%`;
      }
      if (s.kind === "travel" || areaLine) {
        const reverse = s.travelOrigin === "target";
        const from = areaLine
            ? (this.chain?.actors[0] ?? { x: 24, y: 45 })
            : s.areaFan && this.chain
            ? { x: s.origin.x / this.chain.width * 100, y: s.origin.y / this.chain.height * 100 }
            : this.chain
            ? this.chain.actors.find((a) => a.id === layer.dataset.previewFrom)
            : { x: reverse ? 76 : 24, y: 45 },
          to = areaLine
            ? (this.chain?.actors[1] ?? { x: 90, y: 45 })
            : s.areaFan && this.chain
              ? { x: s.endpoint.x / this.chain.width * 100, y: s.endpoint.y / this.chain.height * 100 }
              : this.chain
              ? this.chain.actors.find((a) => a.id === layer.dataset.previewTo)
              : { x: reverse ? 24 : 76, y: 45 };
        // A template stage may reach past the area's far edge (Reach past the area).
        const reach = areaLine ? 1 + (Number(s.areaReach) || 0) / 100 : 1;
        const dx = (reach * (to.x - from.x) * (this.scene.clientWidth || 400)) / 100,
          dy = (reach * (to.y - from.y) * (this.scene.clientHeight || 300)) / 100;
        const g = beamGeometry(
          Math.hypot(dx, dy),
          artwork.videoWidth || artwork.naturalWidth || Number(layer.dataset.mediaWidth),
          artwork.videoHeight || artwork.naturalHeight || Number(layer.dataset.mediaHeight),
          JSON.parse(layer.dataset.previewTemplate || "null"),
        );
        layer.style.left = `${from.x}%`;
        layer.style.top = this.chain ? `${from.y}%` : `calc(${from.y}% + 27px)`;
        layer.style.width = `${g.width}px`;
        layer.style.height = `${g.height}px`;
        layer.style.transformOrigin = `${g.start}px 50%`;
        layer.style.transform = `translate(-${g.start}px, -50%) rotate(${Math.atan2(dy, dx)}rad)`;
        artwork.style.objectFit = "fill";
        pose.scaleX /= s.scale || 1;
        if (areaLine) {
          const width = this.recipe.previewArea?.type === "cone" ? 2 * Math.hypot(dx, dy) : this.grid;
          pose.scaleY *= width / Math.max(1, g.height);
        }
      }
      if (s.kind === "projectile") {
        const p = easeValue(
          (state.localTime - s.moveDelay) / (s.duration - s.moveDelay),
          s.moveEase,
        );
        if (this.chain) {
          const from = s.areaFan ? { x: s.origin.x / this.chain.width * 100, y: s.origin.y / this.chain.height * 100 } : this.chain.actors.find((a) => a.id === s.origin.id),
            to = s.areaFan ? { x: s.endpoint.x / this.chain.width * 100, y: s.endpoint.y / this.chain.height * 100 } : this.chain.actors.find((a) => a.id === s.endpoint.id);
          layer.style.left = `${from.x + (to.x - from.x) * p}%`;
          layer.style.top = `${from.y + (to.y - from.y) * p}%`;
        } else
          layer.style.left = `${s.travelOrigin === "target" ? 76 - 52 * p : 24 + 52 * p}%`;
      }
      if (
        s.kind === "aura" ||
        (s.attach &&
          !["travel", "projectile", "template", "overlay"].includes(s.kind))
      ) {
        const motion = this.subjectPose(
          s.kind === "impact" ? "targets" : (s.subject ?? "source"),
          frame,
          s.targetIndex,
        );
        pose.x += motion.x;
        pose.y += motion.y;
        if (s.bindRotation) pose.rotation += (motion.rotation * 180) / Math.PI;
      }
      if (s.kind === "sprite" && !this.chain)
        pose.x +=
          (Number(layer.dataset.copy) - (s.copies - 1) / 2) * s.copySpread * 55;
      layer.style.setProperty("--stage-scale", "1");
      layer.style.opacity = pose.alpha;
      layer.style.zIndex = s.below ? 1 : 3 + s.zIndex;
      if (s.kind === "overlay") {
        layer.style.left = `${s.anchorX * 100}%`;
        layer.style.top = `${s.anchorY * 100}%`;
      }
      artwork.style.transformOrigin = `${s.anchorX * 100}% ${s.anchorY * 100}%`;
      // The point selected as anchor must land on the token, not merely become
      // the rotation pivot. Layer itself is centered by workspace CSS.
      if (
        s.customAnchor &&
        !["travel", "projectile", "template", "overlay"].includes(s.kind)
      ) {
        pose.x += (0.5 - s.anchorX) * (parseFloat(layer.style.width) || 115);
        pose.y += (0.5 - s.anchorY) * (parseFloat(layer.style.height) || 115);
      }
      if (s.kind === "sprite") {
        const info =
          this.chain?.actors.find((a) => a.id === s.destination?.id)?.token ??
          this.tokenInfo[s.subject ?? "source"];
        // Sequencer's explicit mirror option preserves a mirrored source;
        // multiplying two negatives would incorrectly unmirror the copy.
        if (Number(info?.textureScaleX) < 0)
          pose.scaleX = -Math.abs(pose.scaleX);
        if (Number(info?.textureScaleY) < 0)
          pose.scaleY = -Math.abs(pose.scaleY);
        pose.rotation += Number(info?.rotation) || 0;
        const image = artwork.querySelector?.("img");
        if (image) image.style.objectFit = "fill";
      }
      artwork.style.transform = `translate(${pose.x}px,${pose.y}px) rotate(${pose.rotation}deg) scale(${pose.scaleX},${pose.scaleY})`;
      artwork.style.filter = `${s.tintEnabled && layer.dataset.tintFilter ? `${s.colorize?'grayscale(1) ':''}url(#${layer.dataset.tintFilter}) ` : ""}brightness(${s.kind === "sprite" && s.shadow ? 0 : s.brightness}) contrast(${1 + s.contrast}) saturate(${1 + s.saturation}) hue-rotate(${s.hue}deg) blur(${s.blur}px)${s.glow ? ` drop-shadow(0 0 ${s.glow * 2}px ${s.glowColor})` : ""}`;
      artwork.style.clipPath =
        s.maskToken &&
        !["travel", "projectile", "template", "overlay"].includes(s.kind)
          ? "circle(28px at center)"
          : "";
    }
    // Same recipe gestures compose on one baseline, matching canvas playback.
    for (const token of this.tokens) {
      const subject = token.dataset.previewToken;
      const targetIndex = Number(token.dataset.targetIndex ?? 0);
      // With artwork, fragments hide the image and draw pieces; without it the token just fades.
      const art = previewArt(token);
      if (art) this.drawFragments(token, art, subject, targetIndex, frame);
      const pose = this.subjectPose(subject, frame, targetIndex, { fragments: !art });
      token.style.transform = poseTransform(pose);
      token.style.opacity = pose.alpha ?? "";
    }
    this.onFrame(frame);
  }
  // The fragments stage on this token now: playing (with progress), or ended but held.
  activeFragments(subject, targetIndex, frame) {
    let held = false;
    const candidates = this.chain
      ? this.recipe.playbackPlan.filter((s) => isFragments(s) && !this.muted?.has(s.index) && s.subject === subject && (subject === "source" || s.targetIndex === targetIndex))
        .map((s) => [s, stageFrame({ ...s, repeats: 1, targetStagger: 0 }, frame.time)])
      : this.recipe.stages.flatMap((s, index) => isFragments(s) && (s.subject ?? "source") === subject ? [[s, frame.stages[index]]] : []);
    for (const [stage, state] of candidates) {
      if (state?.state === "playing") return { stage, progress: state.progress };
      if (state?.state === "done" && stage.motionEnd === "hold") held = true;
    }
    return held ? { held } : null;
  }
  // The cut, as the table makes it: the stage's sent angle, a fixed angle, or the swing direction.
  fragmentCutAngle(stage, subject, targetIndex = 0) {
    if (Number.isFinite(stage.cutAngle)) return stage.cutAngle;
    if (stage.cut === "fixed") return ((Number(stage.angle) || 0) * Math.PI) / 180;
    const direction = this.stageDirection(stage, subject, targetIndex);
    return Math.atan2(direction.y, direction.x);
  }
  // Where absorbed pieces fly: the attacker's preview token less this one, in preview squares,
  // as the table's sender measures it; a stage that already carries towards keeps it.
  fragmentTowards(stage, subject, targetIndex = 0) {
    if (Number.isFinite(stage.towards?.x) && Number.isFinite(stage.towards?.y)) return stage.towards;
    const grid = this.chain ? this.grid ?? 55 : 55;
    let token, other;
    if (this.chain) {
      const at = (a) => a && { x: (a.x * (this.scene.clientWidth || 400)) / 100, y: (a.y * (this.scene.clientHeight || 300)) / 100 };
      const actor = this.chain.actors.find((a) => a.id === stage.destination?.id) ?? this.chain.actors.find((a) => a.subject === subject && (subject === "source" || a.targetIndex === targetIndex));
      const source = this.chain.actors[0], target = this.chain.actors.find((a) => a.id === stage.motionTarget?.id) ?? this.chain.actors[targetIndex + 1];
      token = at(actor);
      other = at(actor === source || (actor?.id && actor.id === source?.id) ? target : source);
    } else {
      const w = this.scene.clientWidth || 400, y = 0.45 * (this.scene.clientHeight || 300), source = { x: 0.24 * w, y }, target = { x: 0.76 * w, y };
      token = subject === "source" ? source : target;
      other = subject === "source" ? target : source;
    }
    return token && other ? { x: (other.x - token.x) / grid, y: (other.y - token.y) / grid } : null;
  }
  drawFragments(token, art, subject, targetIndex, frame) {
    const active = this.activeFragments(subject, targetIndex, frame);
    let entry = this.fragments.get(token);
    if (entry && entry.stage !== active?.stage) { this.clearFragments(token); entry = null; }
    art.style.visibility = active ? "hidden" : "";
    token.classList?.toggle("is-fragmented", !!active);
    if (!active?.stage) return;
    if (!entry) entry = this.buildFragments(token, art, active.stage, subject, targetIndex);
    const grid = this.chain ? this.grid ?? 55 : 55;
    for (const part of entry.parts) {
      const pose = fragmentPose(entry.prepared, part.piece, part.flight, active.progress);
      part.box.style.transform = `translate(-50%,-50%) translate(${pose.x * grid}px,${pose.y * grid}px) rotate(${entry.turn}rad)`;
      // A stretch or squash runs along the screen: undo the box's turn around it, so a turned token still melts downward.
      part.cut.style.transform = pose.stretchY === 1 && pose.stretchX === 1 ? `rotate(${pose.rotation}deg) scale(${pose.scale},${pose.scale})`
        : `rotate(${-entry.turn}rad) scale(${pose.scale * pose.stretchX},${pose.scale * pose.stretchY}) rotate(${entry.turn}rad) rotate(${pose.rotation}deg)`;
      part.box.style.opacity = pose.alpha * entry.look.alpha;
    }
  }
  // Built once per activation; each frame only moves them.
  buildFragments(token, art, stage, subject, targetIndex) {
    const doc = token.ownerDocument ?? globalThis.document;
    const info = this.actorToken(subject, targetIndex);
    const turn = ((Number(info?.rotation) || 0) * Math.PI) / 180;
    const sx = Number(info?.textureScaleX) < 0 ? -1 : 1, sy = Number(info?.textureScaleY) < 0 ? -1 : 1;
    const width = art.style?.width || `${(info?.spriteWidth ?? info?.width ?? 1) * 55}px`;
    const height = art.style?.height || `${(info?.spriteHeight ?? info?.height ?? 1) * 55}px`;
    const isImage = art.tagName === "IMG";
    const src = isImage ? art.getAttribute?.("src") ?? art.src : null;
    // Absorb flies to the attacker's preview token, measured the way the table sends it.
    const towards = this.fragmentTowards(stage, subject, targetIndex);
    const prepared = prepareFragments(towards ? { ...stage, towards } : stage);
    const look = FRAGMENT_TINT_LOOKS[prepared.tint] ?? FRAGMENT_TINT_LOOKS.none;
    const grid = this.chain ? this.grid ?? 55 : 55, size = { w: (parseFloat(width) || 55) / grid, h: (parseFloat(height) || 55) / grid };
    const holder = doc.createElement("div");
    holder.className = "an-fragment-pieces";
    Object.assign(holder.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    const parts = fragmentPreviewParts(prepared, this.fragmentCutAngle(stage, subject, targetIndex), turn, size).map((part) => {
      const box = doc.createElement("div"), cut = doc.createElement("div"), copy = isImage ? doc.createElement("img") : doc.createElement("div");
      box.dataset.fragmentPiece = "";
      Object.assign(box.style, { position: "absolute", left: "50%", top: "50%", width, height, transformOrigin: "50% 50%" });
      Object.assign(cut.style, { position: "absolute", inset: "0", clipPath: part.clip, transformOrigin: part.origin, ...(look.css ? { filter: look.css } : {}) });
      if (isImage) {
        copy.setAttribute("src", src);
        copy.setAttribute("alt", "");
      } else {
        // A placeholder has no image: each piece is the disc with a clone of its glyph element.
        copy.className = "an-fragment-disc";
        copy.appendChild(art.cloneNode(true));
      }
      Object.assign(copy.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", maxWidth: "none", maxHeight: "none", transform: `scale(${sx},${sy})` });
      cut.appendChild(copy);
      box.appendChild(cut);
      holder.appendChild(box);
      return { ...part, box, cut };
    });
    token.appendChild(holder);
    const entry = { stage, prepared, turn, parts, holder, look };
    this.fragments.set(token, entry);
    return entry;
  }
  clearFragments(token) {
    this.fragments.get(token)?.holder.remove();
    this.fragments.delete(token);
  }
  actorToken(subject, targetIndex) {
    return this.chain?.actors.find((a) => a.subject === subject && (subject === "source" || a.targetIndex === targetIndex))?.token ?? this.tokenInfo[subject];
  }
  // The direction motions use: attacker to target, from the chain layout or the plain two-token row.
  stageDirection(stage, subject, targetIndex = 0) {
    if (this.chain) {
      const place = (a) => ({
        ...a,
        center: {
          x: (a.x * (this.scene.clientWidth || 400)) / 100,
          y: (a.y * (this.scene.clientHeight || 300)) / 100,
        },
        w: (a.token?.width ?? 1) * (this.grid??55),
        h: (a.token?.height ?? 1) * (this.grid??55),
      });
      const actor = this.chain.actors.find((a) => a.id === stage.destination?.id) ??
        this.chain.actors.find((a) => a.subject === subject && (subject === "source" || a.targetIndex === targetIndex));
      const target =
        this.chain.actors.find((a) => a.id === stage.motionTarget?.id) ??
        this.chain.actors[targetIndex + 1];
      return motionDirection(place(actor), place(this.chain.actors[0]), place(target), stage.motion, this.grid??55);
    }
    const place = (subject, x) => ({
      id: subject,
      center: {
        x: x * (this.scene.clientWidth || 400),
        y: 0.45 * (this.scene.clientHeight || 300),
      },
      w: (this.tokenInfo[subject]?.width ?? 1) * 55,
      h: (this.tokenInfo[subject]?.height ?? 1) * 55,
    });
    const source = place("source", 0.24),
      target = place("targets", 0.76);
    return motionDirection(subject === "source" ? source : target, source, target, stage.motion, 55);
  }
  subjectPose(subject, frame, targetIndex = 0, { fragments = true } = {}) {
    if (this.chain) {
      const stages = this.recipe.playbackPlan
        .filter(
          (s) =>
            s.kind === "motion" &&
            (fragments || s.motion !== "fragments") &&
            !this.muted?.has(s.index) &&
            s.subject === subject &&
            (subject === "source" || s.targetIndex === targetIndex) &&
            frame.time >= s.delay,
        );
      return combineMotionPoses(stages.map(stage => {
      const state = stageFrame(
        { ...stage, repeats: 1, targetStagger: 0 },
        frame.time,
      );
      const direction = this.stageDirection(stage, subject, targetIndex);
      // A held motion stays where it ended, as the token does at the table.
      return state.state === "playing" || (state.state === "done" && stage.motionEnd === "hold")
        ? motionPose(stage, state.state === "done" ? 1 : state.progress, direction, this.grid??55)
        : { x: 0, y: 0, rotation: 0, scale: 1 };
      }));
    }
    return combineMotionPoses(this.recipe.stages.flatMap((stage, index) => {
      const state = frame.stages[index];
      const held = state.state === "done" && stage.motionEnd === "hold";
      if (stage.kind !== "motion" || stage.subject !== subject || (state.state !== "playing" && !held) || (!fragments && stage.motion === "fragments")) return [];
      return [motionPose(stage, held ? 1 : state.progress, this.stageDirection(stage, subject, targetIndex), 55)];
    }));
  }
  stop() {
    this.abort.abort();
    this.clock.stop();
    this.tokenFx?.stop();
    this.sceneFx?.stop();
    [...this.videos, ...this.audio].forEach((v) => v.pause());
    this.tokens.forEach((t) => {
      t.style.transform = "";
      this.clearFragments(t);
      const art = previewArt(t);
      if (art) art.style.visibility = "";
      t.classList?.remove("is-fragmented");
    });
    this.scene.querySelectorAll(".an-recipe-layer").forEach((e) => {
      e.hidden = true;
    });
  }
}

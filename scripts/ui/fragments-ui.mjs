// The Token fragments editor: pattern, behaviour, tint and knobs, plus a preview of the cut pieces.
import { FRAGMENT_PATTERNS, FRAGMENT_COUNTS, FRAGMENT_BEHAVIORS, FRAGMENT_TINTS, normalizeFragments, fragmentPieces, fragmentFlight, fragmentPose } from "../engines/fragments/fragments.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const BEHAVIOR_HINTS = {
  implode: "Pieces collapse into the centre.",
  absorb: "Pieces stream into the attacker.",
  rise: "Pieces float away upward.",
  bounce: "Pieces fall, bounce once and settle.",
  drip: "Pieces stretch and slide down.",
  crumble: "Pieces fall from the top down and pile up at its feet.",
  flatten: "Pieces squash down, then skid low across the floor.",
  shudder: "It vibrates hard, then bursts.",
  glitch: "Pieces jitter out of place and blink away.",
  sink: "Pieces sag into the ground and fade.",
};
// The piece count names what it counts.
const PIECES_LABEL = { diced: "Per side", rings: "Rings", perforate: "Punctures", slashes: "Cuts", crush: "Rings" };

export function fragmentsPreviewSVG(stage, at) {
  const s = { duration: 1400, ...stage, ...normalizeFragments(stage) }, angle = s.cut === "fixed" ? (s.angle * Math.PI) / 180 : 0;
  const shapes = fragmentPieces(s, angle).map((p, i) => {
    const pose = fragmentPose(s, p, fragmentFlight(s, p, i, angle), at), cx = p.centroid.x, cy = p.centroid.y;
    const pts = p.polygon.map((q) => `${(q.x - cx).toFixed(3)},${(q.y - cy).toFixed(3)}`).join(" ");
    // Scaled only when a behaviour shrinks or stretches, so the classic patterns draw as before.
    const scale = pose.scale !== 1 || pose.stretchX !== 1 || pose.stretchY !== 1 ? ` scale(${(pose.scale * pose.stretchX).toFixed(3)} ${(pose.scale * pose.stretchY).toFixed(3)})` : "";
    return `<polygon data-fragment="${i}" points="${pts}" transform="translate(${(cx + pose.x).toFixed(3)} ${(cy + pose.y).toFixed(3)}) rotate(${pose.rotation.toFixed(1)})${scale}" opacity="${Math.max(0.15, pose.alpha).toFixed(2)}"/>`;
  }).join("");
  return `<svg class="an-fragments-preview" viewBox="-2 -2 4 4" aria-label="Cut pieces preview"><rect x="-0.5" y="-0.5" width="1" height="1" class="an-fragments-outline"/>${shapes}</svg>`;
}

// Only the fields that change the chosen pattern and cut are shown; the hold hint is for finishers.
export function fragmentsControlsHTML(stage, index, previewAt = 0.6, { finisher = false } = {}) {
  // Behaviour and tint are set outright: a stage's generic colour `tint` is not a fragments tint.
  const n = normalizeFragments(stage), s = { ...stage, ...n, behavior: n.behavior ?? "burst", tint: n.tint ?? "none" };
  const field = (key, label, min, max, step) => `<label>${label}<input type="number" min="${min}" max="${max}" step="${step}" data-field="${key}" data-index="${index}" value="${s[key]}"></label>`;
  const select = (key, label, table) => `<label>${label}<select data-field="${key}" data-index="${index}">${Object.entries(table).map(([k, v]) => `<option value="${esc(k)}" ${s[key] === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
  const [lo, hi] = FRAGMENT_COUNTS[s.pattern], hint = BEHAVIOR_HINTS[s.behavior];
  // Bursting dust specks and pixels, and absorbed, glitching or sinking pieces, fade over their own windows; everything else fades with the stage.
  const ownFade = ((s.pattern === "dust" || s.pattern === "pixelate") && s.behavior === "burst") || ["absorb", "glitch", "sink"].includes(s.behavior);
  return `<div class="an-editor-section an-fragments"><div class="an-section-title"><b>Token fragments</b><small>The real token disappears as the pieces fly</small></div>
    <div class="an-field-row">${select("pattern", "Pattern", FRAGMENT_PATTERNS)}${select("cut", "Cut", { attack: "Follow the attack", fixed: "Fixed angle" })}${s.cut === "fixed" ? field("angle", "Angle°", 0, 180, 5) : ""}</div>
    <div class="an-field-row">${select("behavior", "Behaviour", FRAGMENT_BEHAVIORS)}${select("tint", "Tint", FRAGMENT_TINTS)}</div>
    <div class="an-field-row">${lo === hi ? "" : field("pieces", PIECES_LABEL[s.pattern] ?? "Pieces", lo, hi, 1)}${field("spread", "Spread (sq)", 0, 3, 0.1)}${field("spin", "Spin°", 0, 720, 5)}</div>
    <div class="an-field-row">${field("fall", "Fall", 0, 1, 0.05)}${field("drift", "Drift", 0, 1, 0.05)}${ownFade ? "" : field("fade", "Fade (ms)", 100, 3000, 50)}</div>
    ${hint ? `<p class="an-hint" data-behavior-hint>${hint}</p>` : ""}
    ${fragmentsPreviewSVG(stage, previewAt)}<label>Preview<input type="range" min="0" max="1" step="0.01" value="${previewAt}" data-fragments-scrub data-index="${index}"></label>
    ${s.cut === "attack" ? `<p class="an-hint">Preview: attack from the left. "Follow the attack" cuts along the swing.</p>` : ""}${finisher ? `<p class="an-hint">Use End: hold in a finisher so the token stays hidden until it is hidden for good.</p>` : ""}</div>`;
}

// Changing a fragments stage's pattern drops the stored piece count so the new pattern's default applies.
export function resetPiecesOnPattern(stage, key) {
  if (key === "pattern" && stage?.motion === "fragments") delete stage.pieces;
}

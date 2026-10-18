// Media errors can outlive a seek, src replacement or released decoder. Read
// current media state instead of treating every queued error as a missing file.
export function previewMediaFailed(video, playbackError) {
  if (playbackError && ["AbortError", "NotAllowedError"].includes(playbackError.name)) return false;
  const source = video.getAttribute ? video.getAttribute("src") : video.src;
  if (source === "" || source === null) return false;
  if (video.currentSrc && video.src && video.currentSrc !== video.src) return false;
  return Number(video.error?.code) >= 2 || playbackError?.name === "NotSupportedError";
}

export function clearPreviewMediaFailure(video) {
  if (video.error || video.readyState < 2) return;
  const layer = video.closest(".an-recipe-layer");
  layer?.classList?.remove?.("is-unavailable");
  layer?.removeAttribute?.("aria-label");
  layer?.removeAttribute?.("data-tooltip");
}

export function markPreviewMediaFailure(video, playbackError) {
  if (!previewMediaFailed(video, playbackError)) return false;
  const layer = video.closest(".an-recipe-layer");
  layer?.classList?.add("is-unavailable");
  layer?.setAttribute("aria-label", "Asset media unavailable");
  layer?.setAttribute("data-tooltip", `Could not load ${video.currentSrc || video.src || "asset media"}. Replay to retry.`);
  return true;
}

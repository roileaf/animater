// Only generated catalog effects are paced here. Saved user recipes keep their
// chosen clips and timing. Baked JB2A flight must reach its native contact frame.
export function paceDeliveryEffects(layers, design) {
  const result = layers.map((s) => ({ ...s }));
  const timings = design.mediaTiming ?? {};
  for (const s of result) {
    const media = timings[s.mediaSlot ?? (["travel","projectile"].includes(s.kind)?"bolt":"hit")];
    const rate = s.playbackRate ?? 1;
    if (s.kind === "projectile" && media?.baked) {
      s.kind = "travel";
      s.perSquare = 0;
      s.moveDelay = 0;
    }
    if (s.kind === "travel") {
      s.duration = Math.max(
        s.duration,
        media?.duration / rate || (design.pattern === "volley" ? 1900 : 1500),
      );
      s.fadeIn = 0;
      s.fadeOut = Math.min(100, s.fadeOut ?? 100);
      s.oneShot = true;
    }
    if (s.kind === "impact") {
      s.duration = Math.max(
        s.duration,
        media?.duration / rate || 850,
      );
      s.fadeIn = Math.min(40, s.fadeIn ?? 40);
      s.fadeOut = Math.min(150, s.fadeOut ?? 150);
      s.oneShot = true;
    }
    // Local contact and shield-intro footage already animates its own arrival.
    // This applies to self/area contacts too, not only target impact sections.
    const nativeContact = (s.assets ?? []).some(key =>
      /^jb2a\.(?:melee_|melee_attack|unarmed|impact\.|liquid\.splash|divine_smite\.)/.test(key));
    const shieldIntro = (s.assets ?? []).some(key => /^jb2a\.shield\.[^.]+\.intro\./.test(key));
    const contactRole = s.kind === "impact" || ["hit", "area"].includes(s.mediaSlot);
    const deliberateGrowth = ["growth", "enclose", "runes", "bodyRunes", "armor", "sanctuary", "woodenHands", "elementalBody"].includes(design.pattern);
    if (["cast", "impact", "template", "aura"].includes(s.kind) &&
      (shieldIntro || contactRole && nativeContact && !deliberateGrowth)) {
      s.oneShot = true;
      s.duration = Math.max(s.duration, media?.duration / rate || 0);
      s.fadeIn = 0;
      s.scaleInDuration = 0;
      s.rotateInDuration = 0;
    }
    if(design.preserveStageTiming && media?.duration)
      s.duration=Math.max(s.duration,media.duration/rate+(s.fadeOut??0));
  }
  if(design.preserveStageTiming)return result;
  const flights = result.filter(
    (s) =>
      ["travel", "projectile"].includes(s.kind) && s.travelOrigin !== "target" && s.travelDestination !== 'area',
  );
  for (const hit of result.filter((s) => s.kind === "impact")) {
    const flight = flights.filter((s) => s.delay <= hit.delay).at(-1);
    if (!flight) continue;
    const contact =
      flight.kind === "projectile"
        ? flight.duration - 30
        : Math.min(
            flight.duration - 80,
            (timings[flight.mediaSlot ?? 'bolt']?.contact !== undefined ? timings[flight.mediaSlot ?? 'bolt'].contact / (flight.playbackRate ?? 1) : undefined) ??
              (design.pattern === "volley"
                ? 1100
                : Math.round(flight.duration * 0.6)),
          );
    hit.afterStage = flight.stageId;
    hit.timingAnchor = flight.kind === "projectile" ? "end" : "start";
    hit.startOffset = flight.kind === "projectile" ? -30 : contact;
    hit.delay = flight.delay + contact;
    hit.targetStagger = 0;
    if (flight.repeats > 1) {
      hit.repeats = flight.repeats;
      hit.repeatScope = flight.repeatScope;
      hit.repeatInterval =
        flight.repeatInterval || flight.duration + (flight.repeatGap ?? 0);
    }
    // Target reaction follows the first visible contact, including each chain hop.
    for (const pose of result.filter(
      (s) => s.kind === "motion" && s.subject === "targets" && !s.afterStage,
    )) {
      pose.afterStage = hit.stageId;
      pose.timingAnchor = "start";
      pose.startOffset = 30;
      pose.delay = hit.delay + 30;
      pose.targetStagger =
        flight.repeatScope === "total" ? (flight.repeatInterval ?? 0) : 0;
    }
  }
  return result;
}

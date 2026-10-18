import { existsSync } from "node:fs";
import { FEAT_MOTIFS } from "../scripts/catalogs/pf2e/feats/feat-choreography.mjs";
import { reviewedFeatActivation } from "../scripts/catalogs/pf2e/feats/feat-direction.mjs";
import { ensureFeatReviews } from "./ensure-feat-reviews.mjs";

export async function loadFeatReviews() {
  ensureFeatReviews();
  const reviews={};
  for(const file of ["feat-early-review","feat-description-review","feat-support-review","feat-late-review","feat-update-review"]){
    const url=new URL(`../data/${file}.mjs`,import.meta.url);
    if(!existsSync(url))continue;
    const exports=await import(url.href);
    const map=Object.values(exports).find(value=>value&&typeof value==="object"&&Object.values(value).some(r=>r?.review?.descriptionHash));
    if(!map)throw Error(`No keyed description review in ${file}.`);
    for(const [id,review] of Object.entries(map)){
      if(reviews[id])throw Error(`Overlapping description reviewers: ${id}`);
      reviews[id]=review;
    }
  }
  return reviews;
}

export function reviewedFeatDesign(design,review,hash,name) {
  if(!review)return design;
  if(review.review?.descriptionHash!==hash||review.review?.fullDescriptionRead!==true)throw Error(`Stale/incomplete description review: ${name}`);
  let motif=review.overrideMotif??review.motif??design.motif;
  // Complete descriptions explicitly require two ranged Strikes. A paired
  // attack is not necessarily paired melee; preserve their different routing.
  if(["double-shot","hunted-shot"].includes(design.slug))motif="ranged";
  if(design.slug==="lightning-dash")motif="lightningDash";
  if(design.slug==="lava-leap")motif="lavaLeap";
  if(["eidolons-trample","trample-centaur","trample-sarangay","trample-mimicry"].includes(design.slug))motif="trample";
  if(["penetrating-fire","penetrating-shot","penetrating-projectile"].includes(design.slug))motif="throughShot";
  if(design.slug==="channel-smite")motif="smite";
  if(design.slug==="ruby-resurrection")motif="phoenix";
  if(design.slug==="mixed-maneuver")motif="maneuverCombo";
  if(/^(?:counterspell|counter-thought|counter-charm|counter-curse|counter-element|cast-out|liberate-soul|challenge-insight|interfering-surge)/.test(design.slug))motif="counteract";
  if(["grovel","dirty-trick","instant-opening"].includes(design.slug))motif="feint";
  if(["hypnotic-lure","mesmerizing-gaze","disruptive-stare"].includes(design.slug))motif="gaze";
  if(!FEAT_MOTIFS[motif])throw Error(`Unknown reviewed motif ${motif}: ${name}`);
  const subject=/^(?:source|caster|self|source-centered)$/.test(review.subject??"")?"source":"targets";
  const direction=review.design??Object.fromEntries(["approach","contacts","weapon","tempo","shape","finish","constraints","origin"].map(key=>[key,review[key]]));
  const theme=["double-shot","hunted-shot"].includes(design.slug)?"weapon":{holy:"spirit",unholy:"void",music:"sonic",bone:"earth"}[review.theme]??review.theme??design.theme;
  return reviewedFeatActivation({...design,name,motif,theme,subject,direction,
    review:review.review,evidence:review.evidence??design.evidence,
    rationale:review.rationale??design.rationale,
    // Complete reading and expressive design are separate claims. Symbolic
    // approximations stay labeled; strong existing authored treatments remain.
    authored:design.authored,quality:design.quality,
    notes:[...design.notes.filter(n=>!n.startsWith("Target the affected")),
      ...(subject==="targets"?["Target the affected creature(s) or choose the manifestation position before sending the feat to chat."]:[]),
      ...(direction.constraints??[])],
  });
}

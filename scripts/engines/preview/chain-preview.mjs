import { previewPlan } from "../../core/model.mjs";
import { isPathMotion } from "../motion/motion-path.mjs";
import { motionDirection, motionPose, combineMotionPoses } from "../motion/motion.mjs";
import { stageFrame } from "../../core/stage-options.mjs";
import { isMoveStage, moveOptions } from "../motion/move-targets.mjs";

// Fit the complete cosmetic route rather than clipping long fixed movements.
// Only the schematic camera/grid changes; recipe distances and durations stay.
function fitPathPreview(actors, places, plan, width, height) {
  const grid=55, moving=plan.filter(s=>s.kind==='motion');
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  const include=(actor,pose={x:0,y:0})=>{
    const place=places.find(p=>p.id===actor.id),info=actor.token;
    const halfW=Math.max(info?.width??1,info?.spriteWidth??1)*grid*.75;
    const halfH=Math.max(info?.height??1,info?.spriteHeight??1)*grid*.75;
    left=Math.min(left,place.center.x+pose.x-halfW);right=Math.max(right,place.center.x+pose.x+halfW);
    top=Math.min(top,place.center.y+pose.y-halfH);bottom=Math.max(bottom,place.center.y+pose.y+halfH);
  };
  const poseFor=(stage,progress)=>motionPose(stage,progress,motionDirection(
    places.find(p=>p.id===stage.destination.id),places[0],
    places.find(p=>p.id===stage.motionTarget?.id)??places[stage.targetIndex+1],stage.motion,grid),grid);
  for(const actor of actors) include(actor);
  for(const stage of moving){
    const actor=actors.find(a=>a.id===stage.destination.id);
    for(let i=0;i<=100;i++) include(actor,poseFor(stage,i/100));
  }
  const duration=Math.max(0,...moving.map(s=>s.delay+s.duration));
  // Concurrent gestures use the same combined pose as canvas and editor.
  for(let i=0;i<=200;i++) for(const actor of actors){
    const poses=moving.filter(s=>s.destination.id===actor.id).flatMap(s=>{
      const state=stageFrame({...s,repeats:1,targetStagger:0},duration*i/200);
      return state.state==='playing'?[poseFor(s,state.progress)]:[];
    });
    include(actor,combineMotionPoses(poses));
  }
  const scale=Math.min(1,Math.max(1,width-48)/(right-left),Math.max(1,height-64)/(bottom-top));
  const x=width/2-(left+right)/2*scale,y=height/2-(top+bottom)/2*scale;
  for(const actor of actors){actor.x=(actor.x*width/100*scale+x)/width*100;actor.y=(actor.y*height/100*scale+y)/height*100;}
  return grid*scale;
}
export const hasChain = (recipe) =>
  recipe.stages.some(
    (s) => s.kind === "travel" && ["previousTarget", "firstTarget"].includes(s.travelOrigin),
  );

export function previewRoleName(recipe,index=0) {
  const roles=recipe.playbackRoles?.targets??[];
  const role=roles[Math.min(index,roles.length-1)];
  return role==='willing-adjacent-ally'?'Willing ally':role==='grabbed-victim'?'Held victim':role==='adjacent-collateral-victims'?`Nearby foe ${index}`:`Target ${index+1}`;
}

// Schematic spacing, real native planner. Target order matches table playback.
export function chainPreview(recipe, tokens = {}) {
  const chained = hasChain(recipe);
  const overlapping = recipe.stages.some(
    (s) =>
      s.repeats > 1 && s.repeatInterval > 0 && s.repeatInterval < s.duration,
  );
  const line = recipe.previewArea?.type === "line";
  const cone = recipe.previewArea?.type === "cone";
  const path = recipe.stages.some((s) => isPathMotion(s) || (s.kind === "motion" && s.motion === "path"));
  const passThrough = recipe.stages.some(
    (s) => isPathMotion(s) && s.motionEndpoint === "past",
  );
  // A push or pull shows where the target can go (engines/motion/move-targets.mjs).
  const moveStage = recipe.stages.find(isMoveStage);
  if (!chained && !overlapping && !line && !cone && !path && !moveStage) return null;
  const actual = tokens.targetList ?? (tokens.targets ? [tokens.targets] : []);
  const flights=recipe.stages.filter(s=>s.kind==='travel');
  const boundedChain=chained&&flights.length>0&&flights.every(s=>s.targetLimit>0);
  const sampleCount=boundedChain?Math.max(...flights.map(s=>s.targetLimit)):3;
  const collateralExample=recipe.playbackRoles?.targets[0]==='grabbed-victim';
  const targets =
    actual.length > 1
      ? actual.slice(0, boundedChain?sampleCount:6)
      : chained || collateralExample
        ? Array.from({length:collateralExample?3:sampleCount},(_,i)=>actual[i]??null)
        : [actual[0]];
  const count = targets.length;
  const actors = [
    {
      id: "source",
      subject: "source",
      token: tokens.source,
      name: "Source",
      x: chained || targets.length > 1 ? 16 : 24,
      y: cone ? 50 : chained || targets.length > 1 ? 52 : 45,
    },
    ...targets.map((token, i) => ({
      id: `target-${i}`,
      subject: "targets",
      targetIndex: i,
      token,
      name: token?.name ?? previewRoleName(recipe,i),
      x:
        count === 1
          ? cone
            ? Math.min(76, 24 + 40 * (tokens.previewHeight || 300) / (tokens.previewWidth || 400))
            : passThrough
            ? 64
            : 76
          : count <= 3
            ? [48, 80, 48][i]
            : i % 2
              ? 80
              : 47,
      y:
        count === 1
          ? cone ? 50 : 45
          : count <= 3
            ? [25, 51, 77][i]
            : 22 + (i * 52) / (count - 1),
    })),
  ];
  const width = tokens.previewWidth || 400, height = tokens.previewHeight || 300;
  // A push: the target beside the source, the wedge opening away from it. A pull: the target its squares away, the
  // wedge pointing back. Laid out in real pixels from the left edge (`left`), in whole squares of the grid key, so it
  // reads true whatever the panel's size; the squares shrink only for a long reach. With nobody picking, a straight line.
  const moving = moveStage && !chained && count === 1 ? moveStage : null;
  let moveCone = null, moveGrid = 55;
  if (moving) {
    const { squares, moveCone: degrees, moveAsk } = moveOptions(moving), pull = moving.motion === "pull";
    moveGrid = Math.max(24, Math.min(55, 560 / (squares + 1.6)));
    const sx = 70, tx = sx + (pull ? squares + 1 : 1) * moveGrid;
    Object.assign(actors[0], { x: (sx / width) * 100, y: 50, left: `${sx}px` });
    Object.assign(actors[1], { x: (tx / width) * 100, y: 50, left: `${tx}px` });
    moveCone = { left: tx, r: squares * moveGrid + moveGrid / 2, angle: pull ? Math.PI : 0, half: moveAsk === "none" ? 0 : ((degrees / 2) * Math.PI) / 180, pull, squares, picked: moveAsk !== "none" };
  }
  const places = actors.map((a) => ({
    ...a,
    center: { x: a.x * width / 100, y: a.y * height / 100 },
    w: (a.token?.width??1)*55,
    h: (a.token?.height??1)*55,
  }));
  const plan = previewPlan(recipe, {
    source: places[0],
    targets: places.slice(1),
    gridSize: 100,
    template: { id: "area" },
    area: line || cone
      ? {
          type: cone ? "cone" : "line",
          center: places[0].center,
          endpoint: places[1].center,
          length: Math.hypot(
            places[1].center.x - places[0].center.x,
            places[1].center.y - places[0].center.y,
          ),
          width: 55,
          ...(cone ? { angle: 90 } : {}),
        }
      : { center: places[1].center, diameter: 200 },
    random: () => 0.5,
  });
  const grid=path?fitPathPreview(actors,places,plan,width,height):moving?moveGrid:55;
  return {
    actors,
    width,
    height,
    grid,
    ...(moveCone ? { moveCone } : {}),
    pathFrame: path,
    recipe: { ...recipe, targetCount: count, playbackPlan: plan },
    note: moveCone
      ? `${moveCone.pull ? "Pull" : "Push"} · up to ${moveCone.squares} square${moveCone.squares === 1 ? "" : "s"}${moveCone.picked ? " · shaded: where it can be placed" : " · straight along the line"}`
      : actual.length > 1
        ? `${count} targets in targeting order${actual.length > 6 ? " · first 6 shown" : ""}`
        : chained
          ? boundedChain?`${sampleCount}-target route · canvas uses your actual targets`:recipe.stages.some(s=>s.travelOrigin==='firstTarget') ? "Secondary-ray example · canvas uses your actual targets" : "Three-hop example · canvas uses your actual targets"
          : line
            ? "Sample line · canvas uses native area endpoints"
            : cone
              ? "Sample cone · canvas uses native vertex, direction and reach"
            : path
              ? "Path motion · approach, hold, return"
              : "Overlapping flights · every contact shown",
  };
}

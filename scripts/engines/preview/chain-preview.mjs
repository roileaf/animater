import { previewPlan } from "../../core/model.mjs";
import { isPathMotion } from "../motion/motion-path.mjs";
import { motionDirection, motionPose, combineMotionPoses } from "../motion/motion.mjs";
import { stageFrame } from "../../core/stage-options.mjs";

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
  const path = recipe.stages.some(isPathMotion);
  const passThrough = recipe.stages.some(
    (s) => isPathMotion(s) && s.motionEndpoint === "past",
  );
  if (!chained && !overlapping && !line && !cone && !path) return null;
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
  const grid=path?fitPathPreview(actors,places,plan,width,height):55;
  return {
    actors,
    width,
    height,
    grid,
    pathFrame: path,
    recipe: { ...recipe, targetCount: count, playbackPlan: plan },
    note:
      actual.length > 1
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

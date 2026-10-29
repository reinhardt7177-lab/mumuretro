import * as T from 'three';
import { subjectVisibility } from './SubjectCamera.js';
import { hasRayHit } from './StaticRaycastTree.js';
import { forecastVisibilityScore } from './ForecastVisibilityScore.js';

const next=new T.Vector3(),delta=new T.Vector3(),inward=new T.Vector3(),side=new T.Vector3(),rayDirection=new T.Vector3(),ray=new T.Raycaster();

// Opt-in follow path for narrow foreground piers. A clear destination alone
// does not make a straight interpolation through the pier safe.
export function followVisibleCamera(current,desired,target,foot,meshes,inside,blend,dt,halfWidth=.22,motion=null,trajectory=null){
  const step=18*dt;
  const safe=p=>{
    if(!inside(p))return false;
    rayDirection.subVectors(p,target);const length=rayDirection.length();
    if(length<.15)return false;
    ray.set(target,rayDirection.divideScalar(length));ray.far=length+.25;
    return !hasRayHit(ray,meshes)&&subjectVisibility(p,foot,meshes,halfWidth)===3;
  };
  if(motion&&motion.lengthSq()>1e-8){
    const moving=followMovingSubject(current,desired,foot,meshes,safe,blend,step,motion,halfWidth,trajectory);
    if(moving)return moving;
  }
  delta.subVectors(desired,current).multiplyScalar(blend).clampLength(0,step);next.copy(current).add(delta);
  if(trajectory&&Math.hypot(next.x-target.x,next.z-target.z)<1.8&&Math.hypot(desired.x-target.x,desired.z-target.z)>1.8){
    const radius=Math.max(1.8,Math.hypot(current.x-target.x,current.z-target.z)),from=Math.atan2(current.x-target.x,current.z-target.z),to=Math.atan2(desired.x-target.x,desired.z-target.z),turn=Math.atan2(Math.sin(to-from),Math.cos(to-from)),yaw=from+T.MathUtils.clamp(turn,-step/radius,step/radius);
    orbitPoint.set(target.x+Math.sin(yaw)*radius,current.y+(desired.y-current.y)*blend,target.z+Math.cos(yaw)*radius).sub(current).clampLength(0,step).add(current);
    if(safe(orbitPoint)){const amount=current.distanceTo(orbitPoint);current.copy(orbitPoint);return{mode:'orbit',step:amount};}
  }
  if(safe(next)){current.copy(next);return {mode:'follow',step:delta.length()};}

  // Retract on the already clear sightline before crossing to the other side.
  // Input yaw/pitch/zoom stay untouched; only the camera's actual path changes.
  inward.subVectors(target,current);const distance=inward.length();
  if(distance>1.65){
    const amount=Math.min(step,distance-1.65);next.copy(current).addScaledVector(inward.divideScalar(distance),amount);
    if(safe(next)){current.copy(next);return {mode:'retract',step:amount};}
  }
  side.set(target.z-current.z,0,current.x-target.x).normalize();
  const preferred=side.dot(delta)<0?-1:1;
  for(const sign of [preferred,-preferred]){
    next.copy(current).addScaledVector(side,step*sign);
    if(safe(next)){current.copy(next);return {mode:'slide',step};}
  }
  if(safe(current))return {mode:'hold',step:0};
  // A moving subject can invalidate the old position. Prefer a valid endpoint
  // to remaining inside geometry; this fallback is counted by regression tests.
  if(safe(desired)){const amount=current.distanceTo(desired);current.copy(desired);return {mode:'emergency',step:amount};}
  return {mode:'unresolved',step:0};
}

const forecastFoot=new T.Vector3(),forecastMotion=new T.Vector3(),movingCandidate=new T.Vector3(),movingBest=new T.Vector3(),planningCandidate=new T.Vector3(),orbitPoint=new T.Vector3();
const escapeDirections=[];
for(const x of[-1,0,1])for(const y of[-1,0,1])for(const z of[-1,0,1])if(x||y||z)escapeDirections.push(new T.Vector3(x,y,z).normalize());

// Only the court opts in. Rank nearby clear positions before a moving foot
// reaches a foreground edge. A failed forecast must not freeze a still-clear
// camera: a small sideways/upward step can gain clearance on the next frame.
function followMovingSubject(current,desired,foot,meshes,safe,blend,step,motion,halfWidth,trajectory){
  forecastMotion.copy(motion).multiplyScalar(16).clampLength(0,1.6);
  const samples=trajectory||[.25,.5,.75,1].map(fraction=>foot.clone().addScaledVector(forecastMotion,fraction));
  function score(p,minimum=-Infinity){
    if(!safe(p))return -Infinity;
    return forecastVisibilityScore(p,foot,samples,desired,position=>{
      forecastFoot.copy(position);
      return subjectVisibility(p,forecastFoot,meshes,halfWidth);
    },meshes.rayQuery&&meshes.rayQuery.fallback.length===0?minimum:-Infinity);
  }
  delta.subVectors(desired,current).multiplyScalar(blend).clampLength(0,step);
  movingCandidate.copy(current).add(delta);
  let best=score(movingCandidate);
  movingBest.copy(movingCandidate);
  if(best>samples.length*103-1)return null; // Ordinary follow has sufficient clearance.
  if(trajectory){
    // Binary visibility has flat regions: all neighbouring steps can score the
    // same until it is too late to pass a post. Find a clear future endpoint
    // first, then approach it through currently clear, speed-limited steps.
    let goal=trajectory.cameraGoal,goalScore=goal?score(goal):-Infinity;
    if(goalScore<samples.length*103-1){
      goal=null;goalScore=-Infinity;
      const length=Math.max(3.5,current.distanceTo(targetOf(foot))),yaw=Math.atan2(current.x-foot.x,current.z-foot.z),pitch=Math.atan2(current.y-foot.y-1.25,Math.hypot(current.x-foot.x,current.z-foot.z));
      for(const radius of[length,Math.max(3.5,length*.75)])for(const turn of[0,-.35,.35,-.7,.7,-1.05,1.05,-1.4,1.4])for(const elevation of[pitch,.7]){
        planningCandidate.set(Math.sin(yaw+turn)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw+turn)*Math.cos(elevation)).multiplyScalar(radius).add(foot);planningCandidate.y+=1.25;
        const travelPenalty=current.distanceTo(planningCandidate)*.1,value=score(planningCandidate,goalScore+travelPenalty)-travelPenalty;
        if(value>goalScore){goalScore=value;goal=planningCandidate.clone();}
      }
      trajectory.cameraGoal=goal;
    }
    if(goal&&goalScore>best+1){
      movingCandidate.copy(goal).sub(current).multiplyScalar(blend).clampLength(0,step).add(current);
      if(safe(movingCandidate)&&score(movingCandidate,best-.05)>=best-.05){const amount=current.distanceTo(movingCandidate);current.copy(movingCandidate);return{mode:'anticipate-path',step:amount};}
    }
  }
  inward.subVectors(foot,current).y+=1.25;
  const distance=inward.length();
  if(distance>2.2){
    movingCandidate.copy(current).addScaledVector(inward,Math.min(step,distance-2.2)/distance);
    const value=score(movingCandidate,best+.00001);
    if(value>best+.00001){best=value;movingBest.copy(movingCandidate);}
  }
  for(const direction of escapeDirections){
    movingCandidate.copy(current).addScaledVector(direction,step);
    const value=score(movingCandidate,best+.00001);
    if(value>best+.00001){best=value;movingBest.copy(movingCandidate);}
  }
  if(best===-Infinity)return null;
  const amount=current.distanceTo(movingBest);current.copy(movingBest);
  return{mode:'anticipate',step:amount};
}

const planningTarget=new T.Vector3();
function targetOf(foot){return planningTarget.copy(foot).add(new T.Vector3(0,1.25,0));}

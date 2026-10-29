import * as T from 'three';
import { hasRayHit } from './StaticRaycastTree.js';

// Own framing rule. A single head ray misses foreground objects over the legs.
const ray=new T.Raycaster(),point=new T.Vector3(),direction=new T.Vector3(),candidate=new T.Vector3(),lateral=new T.Vector3();
export function subjectVisibility(position,foot,meshes,halfWidth=0){
  let clear=0;
  lateral.set(foot.z-position.z,0,position.x-foot.x).normalize().multiplyScalar(halfWidth);
  for(const height of [.25,.8,1.35]){
   for(const side of halfWidth?[-1,0,1]:[0]){
    point.copy(foot).addScaledVector(lateral,side).y+=height;direction.subVectors(point,position);const length=direction.length();
    ray.set(position,direction.divideScalar(length));ray.far=Math.max(0,length-.12);
    if(!hasRayHit(ray,meshes))clear++;
   }
  }
  return clear/(halfWidth?3:1);
}
export function frameSubject(actor,target,desired,meshes,inside,avoid,preferred,dt=0,halfWidth=0,pitchAssist=0,minRetreat=0,yawAssist=.5){
  const visibility=p=>subjectVisibility(p,actor.position,meshes,halfWidth);
  const initial=visibility(desired),baseline=desired.clone(),origin=preferred||baseline,baseDistance=origin.distanceTo(target);
  // A clear ray can still leave the camera against a pier, cropping the body.
  // Only opted-in rooms prefer an equally clear candidate with more retreat.
  const retreat=Math.min(minRetreat,baseDistance*.85),framingPenalty=p=>retreat>0?Math.max(0,retreat-p.distanceTo(target))*2:0;
  const yaw=Math.atan2(origin.x-target.x,origin.z-target.z),pitch=Math.atan2(origin.y-target.y,Math.hypot(origin.x-target.x,origin.z-target.z));
  const oldPitch=Math.atan2(desired.y-target.y,Math.hypot(desired.x-target.x,desired.z-target.z));
  let best=initial*10-Math.abs(oldPitch-pitch)*.4-framingPenalty(desired),bestOffset=0,bestClear=initial,bestElevation=oldPitch;
  actor._subjectCacheAge=(actor._subjectCacheAge||0)+dt;
  const cached=actor._subjectCameraCache;
  if(actor._camPlaced&&cached&&cached.pitchAssist===pitchAssist&&cached.minRetreat===minRetreat&&cached.yawAssist===yawAssist&&actor._subjectCacheAge<.2&&(initial<3||Math.abs(oldPitch-pitch)>.02||framingPenalty(desired)>0)){
    const elevation=pitchAssist>0?Math.min(.7,pitch+cached.pitchDelta):pitch+cached.pitchDelta;
    candidate.copy(target).add(new T.Vector3(Math.sin(yaw+cached.offset)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw+cached.offset)*Math.cos(elevation)).multiplyScalar(baseDistance));
    if(inside(candidate)){
      avoid(candidate);
      if(candidate.distanceTo(target)>=Math.min(2.2,baseDistance*.85)&&visibility(candidate)===3){
        desired.copy(candidate);actor._subjectOffset=cached.offset;
        actor.cameraReadability={initial,chosen:3,automaticYaw:cached.offset,cached:true,baseline:baseline.toArray(),desired:desired.toArray()};return;
      }
    }
  }
  if(baseDistance>1.4&&(initial<3||baseline.distanceTo(origin)>.01)){
    const elevations=Math.abs(oldPitch-pitch)>.02?[pitch,oldPitch]:[pitch];
    if(pitchAssist>0)for(const fraction of[1/3,2/3,1]){const raised=Math.min(.7,pitch+pitchAssist*fraction);if(elevations.every(v=>Math.abs(v-raised)>.02))elevations.push(raised);}
    const offsets=[0,.25,-.25,.5,-.5];if(yawAssist>.5)for(const amount of[(.5+yawAssist)/2,yawAssist])offsets.push(amount,-amount);
    for(const elevation of elevations)for(const offset of offsets){
      candidate.copy(target).add(new T.Vector3(Math.sin(yaw+offset)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw+offset)*Math.cos(elevation)).multiplyScalar(baseDistance));
      if(!inside(candidate))continue;avoid(candidate);
      const distance=candidate.distanceTo(target);if(distance<Math.min(2.2,baseDistance*.85))continue;
      const clear=visibility(candidate),score=clear*10-Math.abs(elevation-pitch)*.4-Math.abs(offset)*.1-Math.abs(offset-(actor._subjectOffset||0))*.05-framingPenalty(candidate);
      if(score>best){best=score;bestOffset=offset;bestClear=clear;bestElevation=elevation;desired.copy(candidate);}
    }
  }
  actor._subjectOffset=bestOffset;
  actor._subjectCameraCache={offset:bestOffset,pitchDelta:bestElevation-pitch,pitchAssist,minRetreat,yawAssist};actor._subjectCacheAge=0;
  actor.cameraReadability={initial,chosen:bestClear,automaticYaw:bestOffset,baseline:baseline.toArray(),desired:desired.toArray()};
}

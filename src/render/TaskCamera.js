import * as T from 'three';
import { subjectVisibility } from './SubjectCamera.js';
import { hasRayHit } from './StaticRaycastTree.js';
import {frameWorkspace} from './WorkspaceFraming.js';
export {relaxWorkspace} from './WorkspaceFraming.js';

const ray=new T.Raycaster(),direction=new T.Vector3(),candidate=new T.Vector3(),projected=new T.Vector3(),probe=new T.PerspectiveCamera();
// Authored working composition: keep the traveller and visible task contours.
// The solid scene stays visible and collidable; free yaw outside the work cone wins.
export function frameTask(actor,camera,target,desired,meshes,zone,inside,avoid,dt=0){
  if(zone.workspace)return frameWorkspace(actor,camera,target,desired,meshes,zone,inside,avoid,dt);
  const points=zone.points();if(!points?.length)return;
  actor._taskAge=(actor._taskAge||0)+dt;
  const key=[...actor.position.toArray(),...target.toArray(),...desired.toArray(),camera.fov,camera.aspect,zone.signature()].join('/'),previous=actor._taskCache;
  if(actor._camPlaced&&previous?.key===key&&actor._taskAge<.2){desired.fromArray(previous.desired);actor.taskReadability={...previous.readability,cachedKey:true};return;}
  const distance=desired.distanceTo(target),pitch=Math.atan2(desired.y-target.y,Math.hypot(desired.x-target.x,desired.z-target.z));
  const yaw=Math.atan2(desired.x-target.x,desired.z-target.z);probe.copy(camera,false);
  function framed(position){probe.position.copy(position);probe.lookAt(target);probe.updateMatrixWorld(true);return[...zone.framePoints(),...points].every(p=>{projected.copy(p).project(probe);return Math.abs(projected.x)<=.98&&Math.abs(projected.y)<=.98&&Math.abs(projected.z)<=1;});}
  function score(position){
    probe.position.copy(position);probe.lookAt(target);probe.updateMatrixWorld(true);let clear=0;
    for(const p of points){projected.copy(p).project(probe);if(Math.abs(projected.x)>.96||Math.abs(projected.y)>.96||Math.abs(projected.z)>1)continue;direction.subVectors(p,position);const length=direction.length();ray.set(position,direction.divideScalar(length));ray.far=Math.max(0,length-.04);if(!hasRayHit(ray,meshes))clear++;}
    return clear;
  }
  const base=score(desired);let best=base,bestOffset=0,bestPenalty=Infinity;
  function place(offset){candidate.copy(target).add(new T.Vector3(Math.sin(yaw+offset)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw+offset)*Math.cos(pitch)).multiplyScalar(distance));if(!inside(candidate))return false;avoid(candidate);return candidate.distanceTo(target)>=Math.min(3.5,distance*.85)&&framed(candidate)&&subjectVisibility(candidate,actor.position,meshes,.22)===3;}
  if(actor._camPlaced&&actor._taskOffset!==undefined&&place(actor._taskOffset)){const clear=score(candidate);if(clear>=base){desired.copy(candidate);actor._taskAge=0;actor.taskReadability={baseline:base,chosen:clear,features:points.length,offset:actor._taskOffset,cached:true};actor._taskCache={key,desired:desired.toArray(),readability:actor.taskReadability};return;}}
  const offsets=[0,.2,.4,.55,-.2,-.4,-.55];
  if(actor._taskOffset!==undefined)offsets.unshift(actor._taskOffset);
  for(const offset of offsets){
    if(!place(offset))continue;
    const clear=score(candidate),penalty=Math.abs(offset)+Math.abs(offset-(actor._taskOffset||0))*.2;
    if(clear>best||(clear===best&&penalty<bestPenalty)){best=clear;bestOffset=offset;bestPenalty=penalty;desired.copy(candidate);}
  }
  actor._taskOffset=bestOffset;actor._taskAge=0;actor.taskReadability={baseline:base,chosen:best,features:points.length,offset:bestOffset};
  actor._taskCache={key,desired:desired.toArray(),readability:actor.taskReadability};
}

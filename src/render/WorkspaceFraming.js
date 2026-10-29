import * as T from 'three';
import {subjectVisibility} from './SubjectCamera.js';
import {hasRayHit} from './StaticRaycastTree.js';

const probe=new T.PerspectiveCamera(),ray=new T.Raycaster(),screen=new T.Vector2(),point=new T.Vector3(),direction=new T.Vector3(),baseTarget=new T.Vector3(),baseDesired=new T.Vector3(),right=new T.Vector3(),candidateTarget=new T.Vector3(),candidate=new T.Vector3();
const blend=dt=>1-Math.exp(-10*dt);
function apply(actor,target,desired,meshes,avoid,cameraGoal,lookGoal,dt){
  const value=actor._workspaceOffset??=new T.Vector3(),cameraValue=actor._workspaceCameraOffset??=new T.Vector3();
  if(!actor._camPlaced||dt<=0){value.copy(lookGoal);cameraValue.copy(cameraGoal);}else{
    value.add(lookGoal.clone().sub(value).multiplyScalar(blend(dt)).clampLength(0,3.6*dt));
    cameraValue.lerp(cameraGoal,blend(dt));
  }
  if(value.lengthSq()<1e-8)value.set(0,0,0);if(cameraValue.lengthSq()<1e-8)cameraValue.set(0,0,0);
  desired.add(cameraValue);avoid(desired);
}
export function relaxWorkspace(actor,target,desired,meshes,avoid,dt){
  if(!actor._workspaceOffset?.lengthSq()&&!actor._workspaceCameraOffset?.lengthSq())return;
  apply(actor,target,desired,meshes,avoid,new T.Vector3(),new T.Vector3(),dt);
  actor.workspaceReadability={active:false,applied:actor._workspaceOffset.toArray()};
}
export function frameWorkspace(actor,camera,target,desired,meshes,zone,inside,avoid,dt){
  baseTarget.copy(target);baseDesired.copy(desired);
  direction.subVectors(baseDesired,baseTarget);const distance=direction.length();right.set(direction.z,0,-direction.x).normalize();
  const points=zone.points(),bounds=zone.framePoints(),signature=zone.signature(),key=[zone.id,...actor.position.toArray(),...baseTarget.toArray(),...baseDesired.toArray(),camera.aspect,camera.fov,signature].join('/');
  actor._workspaceAge=(actor._workspaceAge||0)+dt;
  let best=actor._workspaceCache?.key===key&&actor._workspaceAge<.2?actor._workspaceCache.best:null;
  if(!best){
    probe.copy(camera,false);
    const framed=p=>{point.copy(p).project(probe);return Math.abs(point.x)<.96&&Math.abs(point.y)<.96&&point.z>-1&&point.z<1;};
    function evaluate(offset,pose=null){
      if(pose){candidateTarget.copy(pose.target);candidate.copy(pose.position);}else{candidateTarget.copy(baseTarget).addScaledVector(right,offset);candidate.copy(baseDesired).addScaledVector(right,offset);}
      if(!inside(candidate))return null;
      avoid(candidate);
      if(candidate.distanceTo(candidateTarget)<Math.min(3.2,distance*.8)||subjectVisibility(candidate,actor.position,meshes,.22)!==3)return null;
      probe.position.copy(candidate);probe.lookAt(candidateTarget);probe.updateMatrixWorld(true);
      if(!bounds.every(framed))return null;
      const lateral=new T.Vector3(actor.position.z-candidate.z,0,candidate.x-actor.position.x).normalize().multiplyScalar(.22);
      for(const h of[.25,.8,1.65])for(const sign of[-1,0,1]){const v=actor.position.clone().addScaledVector(lateral,sign);v.y+=h;if(!framed(v))return null;}
      let clear=0,foreground=0;
      for(const p of points){direction.subVectors(p,candidate);const length=direction.length();ray.set(candidate,direction.divideScalar(length));ray.far=Math.max(0,length-.06);if(!hasRayHit(ray,meshes))clear++;}
      for(const y of[-.75,-.5,-.25,0,.25,.5,.75])for(const x of[-.9,-.675,-.45,-.225,0,.225,.45,.675,.9]){screen.set(x,y);ray.setFromCamera(screen,probe);ray.far=candidate.distanceTo(baseTarget)*.6;const hit=meshes.rayQuery?.closest(ray);if(hit&&hit.point.y>actor.position.y+.45)foreground++;}
      const head=actor.position.clone().add(new T.Vector3(0,1.75,0)).project(probe),feet=actor.position.clone().project(probe),bodyHeight=Math.abs(head.y-feet.y);
      if(camera.aspect<.8&&feet.y<-.65)return null;
      return{offset,kind:pose?.kind||(pose?'recover':'lateral'),clear,features:points.length,foreground,foreSamples:63,bodyHeight,cameraDelta:candidate.clone().sub(baseDesired).toArray(),lookDelta:candidateTarget.clone().sub(baseTarget).toArray(),score:clear*100-foreground*70/63-Math.abs(offset)*.12-(pose?.penalty||0)-candidate.distanceTo(camera.position)*.4+(camera.aspect<.8?Math.min(.65,bodyHeight)*20:0)};
    }
    for(const offset of[0,-.4,.4,-.8,.8,-1.2,1.2,-1.6,1.6]){const value=evaluate(offset);if(value&&(!best||value.score>best.score+.001))best=value;}
    if(camera.aspect<.8){
      const back=new T.Vector3(Math.sin(actor.camYaw),0,Math.cos(actor.camYaw)),across=new T.Vector3(back.z,0,-back.x);
      for(const cameraSide of[0,-.8,.8,-1.6,1.6])for(const lookSide of[0,-.8,.8,-1.6,1.6])for(const radius of[2.1,2.8])for(const height of[3.4])for(const lookHeight of[1.8,2.4]){
        const position=actor.position.clone().addScaledVector(across,cameraSide).addScaledVector(back,radius);position.y+=height;
        const target=actor.position.clone().addScaledVector(across,lookSide).addScaledVector(back,-1.6);target.y+=lookHeight;
        const value=evaluate(lookSide,{position,target,kind:'portrait',penalty:.1*Math.abs(cameraSide-lookSide)});if(value&&(!best||value.score>best.score+.001))best=value;
      }
    }
    if(!best||best.foreground>0){
      const radius=T.MathUtils.clamp((actor._cameraInput?.camDist??6.5)*5/6.5,3.2,6.5);
      for(const turn of[-.75,-.5,.5,.75])for(const[angle,height]of[[.5,0],[.7,0],[.62,.75]]){
        const yaw=actor.camYaw+turn,side=Math.sign(turn)*1.6,target=baseTarget.clone().add(new T.Vector3(Math.cos(yaw)*side,height,-Math.sin(yaw)*side));
        const position=target.clone().add(new T.Vector3(Math.sin(yaw)*Math.cos(angle),Math.sin(angle),Math.cos(yaw)*Math.cos(angle)).multiplyScalar(radius));
        const value=evaluate(side,{target,position,penalty:Math.abs(turn)*.3+Math.abs(angle-(actor._cameraInput?.camPitch??.38))*.2});if(value&&(!best||value.score>best.score+.001))best=value;
      }
    }
    best??={offset:0,kind:'none',clear:0,features:points.length,foreground:null,foreSamples:63,cameraDelta:[0,0,0],lookDelta:[0,0,0],score:null};
    actor._workspaceCache={key,best};actor._workspaceAge=0;
  }
  const angle=Math.abs(Math.atan2(Math.sin(actor.camYaw),Math.cos(actor.camYaw))),gain=1-T.MathUtils.smoothstep(angle,.25,.65);
  const cameraGoal=new T.Vector3(...best.cameraDelta).multiplyScalar(gain),lookGoal=new T.Vector3(...best.lookDelta).multiplyScalar(gain);apply(actor,target,desired,meshes,avoid,cameraGoal,lookGoal,dt);
  actor.workspaceReadability={active:true,id:zone.id,...best,applied:actor._workspaceOffset.toArray(),cameraApplied:actor._workspaceCameraOffset.toArray()};actor.taskReadability=actor.workspaceReadability;
}

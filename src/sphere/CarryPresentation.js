import * as T from 'three';
import { actionContract } from './ActionPoses.js';

export const hasHeld=value=>value!==null&&value!==undefined&&value!==false;
const descriptors=new WeakMap(),geometryCache=new WeakMap();
const up=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1);
function descriptor(mesh,profile,device,kind){
  if(!mesh)return null;let d=descriptors.get(mesh);
  if(!d){d={mesh,profile,device,kind};descriptors.set(mesh,d);}return d;
}
// Explicit adapters keep logical ownership with the existing puzzle/controller.
export function carriedItem(room){
  if(!room)return null;
  if(room.fireAdventure){const w=room.world,i=w?.mechanics.held;return hasHeld(i)?descriptor(w.braces[i],'overhead',w,'brace'):null;}
  const devices=[...room.gates.map(g=>g.gate),room.final];
  for(const d of devices){
    if(!hasHeld(d.held))continue;
    if(d.stock&&Number.isInteger(d.held))return descriptor(d.stock[d.held]?.mesh,'overhead',d,'crate');
    if(room.waterAdventure&&d.state?.held)return descriptor(d.ice,'overhead',d,'ice');
    if(d.sieves&&d.held?.grp)return descriptor(d.held.grp,'overhead',d,'sieve');
    if(d.items&&d.held?.mesh)return descriptor(d.held.mesh,'overhead',d,'sample');
    if(d.pot&&d.held===true)return descriptor(d.pot,'overhead',d,'pot');
    // These pieces are 0.72–0.79m tall: chest carry hides a 1.5m traveller.
    if(d.fossils&&d.held?.mesh)return descriptor(d.held.mesh,'overhead',d,'fossil');
    if(d.orbs&&d.held?.mesh)return descriptor(d.held.mesh,'overhead',d,'offering');
    if(d.tools&&d.held?.mesh)return descriptor(d.held.mesh,'cradle',d,'tool');
  }
  return null;
}
export function registerActionRoom(room){
  room.poseRevision=0;
  for(const method of ['restart','importState']){const original=room[method]?.bind(room);if(!original)continue;
    room[method]=(...args)=>{const result=original(...args);if(method==='restart'||result)room.poseRevision++;return result;};}
  return room;
}

function geometryFor(mesh,profile,spec){
  let data=geometryCache.get(mesh);if(data)return data;
  mesh.updateWorldMatrix(true,true);const proto=mesh.clone(true),scale=mesh.getWorldScale(new T.Vector3());
  proto.visible=true;proto.position.set(0,0,0);proto.quaternion.identity();proto.scale.copy(scale);proto.updateMatrixWorld(true);
  const solid=[];proto.traverse(o=>{let visible=true;for(let p=o;p&&p!==proto.parent;p=p.parent)if(!p.visible)visible=false;if(o.isMesh&&visible)solid.push(o);});
  const bounds=new T.Box3();for(const part of solid)bounds.expandByObject(part);if(bounds.isEmpty())throw Error('Carried object has no visible surface '+mesh.name);
  const p=spec.profiles[profile],centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),ray=new T.Raycaster(),hits=[],grips={};
  const preferredZ=T.MathUtils.clamp(centre.z+p.palmZ-p.propCentreZ,bounds.min.z+size.z*.08,bounds.max.z-size.z*.08);
  for(const [side,sign]of [['Left',1],['Right',-1]]){
    const preferredX=T.MathUtils.clamp(centre.x+sign*p.palmX,bounds.min.x+size.x*.10,bounds.max.x-size.x*.10);let best=null,score=Infinity;
    for(const dx of [0,-.025,.025,-.055,.055,-.09,.09,-.14,.14])for(const dz of [0,-.025,.025,-.055,.055,-.09,.09,-.14,.14]){
      const x=preferredX+dx,z=preferredZ+dz;if(x<bounds.min.x||x>bounds.max.x||z<bounds.min.z||z>bounds.max.z)continue;
      ray.set(new T.Vector3(x,bounds.min.y-.15,z),up);hits.length=0;ray.intersectObjects(solid,false,hits);
      if(hits[0]&&dx*dx+dz*dz<score){best=hits[0].point.clone();score=dx*dx+dz*dz;}
    }
    if(!best)throw Error('No actual underside grip '+side+' '+mesh.name);grips[side]=best;
  }
  data={scale,bounds,size,grips,centreGrip:grips.Left.clone().add(grips.Right).multiplyScalar(.5)};geometryCache.set(mesh,data);return data;
}
function poseOf(mesh){mesh.updateWorldMatrix(true,false);return{position:mesh.getWorldPosition(new T.Vector3()),quaternion:mesh.getWorldQuaternion(new T.Quaternion()),scale:mesh.getWorldScale(new T.Vector3())};}
function applyPose(mesh,position,quaternion,scale){const matrix=new T.Matrix4().compose(position,quaternion,scale);if(mesh.parent){mesh.parent.updateWorldMatrix(true,false);matrix.premultiply(new T.Matrix4().copy(mesh.parent.matrixWorld).invert());}matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.updateWorldMatrix(false,true);}
function visualPoint(d,point){if(d.kind==='ice')d.device.renderCarryPoint=point?.clone()||null;}

export class CarryPresentation {
  constructor(){this.room=null;this.revision=-1;this.active=null;this.release=null;this.events=[];}
  clear(actor){if(this.active)visualPoint(this.active.descriptor,null);if(this.release){applyPose(this.release.mesh,this.release.to.position,this.release.to.quaternion,this.release.to.scale);visualPoint(this.release.descriptor,null);}this.active=null;this.release=null;const u=actor.body.userData;u.carryProfile=null;u.carryTargets=null;u.carryPresentation=null;u.carryGripErrors=null;u.actionTargetWorld=null;u.workContact=null;u.workTargets=null;u.workGripErrors=null;u.carrying=false;u.navigator?.setCarryImmediate(false);u.navigator?.setWorkImmediate(false);u.navigator?.poseLayer?.clear();}
  accepted(actor,obj,before,after){
    if(this.active?.descriptor.device===obj)obj.workshop?.process?.correctStart(this.active.last.position);
    const kind=hasHeld(before)===hasHeld(after)?'use':hasHeld(after)?'pickup':'release';
    this.events.push({kind,time:performance.now()});if(this.events.length>16)this.events.shift();
    if(kind==='use'&&!hasHeld(after)){
      let target=obj.handTarget?.(actor.position);const local=target?actor.body.worldToLocal(target.clone()):null;
      if(target&&Math.hypot(target.x-actor.position.x,target.z-actor.position.z)<.8){actor.body.userData.actionTargetWorld=target;actor.body.userData.navigator?.poseLayer?.trigger(local?.x>0?'Left':'Right');}
    }
  }
  update(actor,room,dt){
    const n=actor.body.userData.navigator,u=actor.body.userData,spec=actionContract();if(!n?.poseLayer||!spec)return;
    const fresh=room!==this.room||room?.poseRevision!==this.revision;
    if(fresh){this.clear(actor);this.room=room;this.revision=room?.poseRevision;}
    const contact=room?.panelWorkshop?.contact(actor);u.workContact=contact||null;if(contact){u.workTargets=contact.targets;if(fresh){n.setWorkImmediate(true);n.update(0,actor.moving,false,{airborne:!actor.grounded,vy:actor.vy,speed:actor.travelSpeed});}n.applyWorkTargets();}else if(n.workAmount<.001){u.workTargets=null;u.workGripErrors=null;}
    const d=carriedItem(room);actor.body.updateWorldMatrix(true,true);
    if(d?.mesh!==this.active?.descriptor.mesh){
      if(this.active){const old=this.active,to=poseOf(old.descriptor.mesh);
        if(this.release){applyPose(this.release.mesh,this.release.to.position,this.release.to.quaternion,this.release.to.scale);visualPoint(this.release.descriptor,null);this.release=null;}
        if(old.descriptor.mesh.visible&&to.position.distanceTo(old.last.position)<2.5)this.release={descriptor:old.descriptor,mesh:old.descriptor.mesh,from:old.last,to,last:old.last,age:0};
        else visualPoint(old.descriptor,null);
      }
      this.active=d?{descriptor:d,data:geometryFor(d.mesh,d.profile,spec),from:poseOf(d.mesh),last:poseOf(d.mesh),age:fresh?spec.timing.pickupSeconds:0}:null;
    }
    if(this.release){const r=this.release,canonical=poseOf(r.mesh);
      if(canonical.position.distanceTo(r.last.position)>1e-5)r.to=canonical;
      r.age+=dt;const t=T.MathUtils.smoothstep(r.age,0,spec.timing.releaseSeconds),pos=r.from.position.clone().lerp(r.to.position,t),q=r.from.quaternion.clone().slerp(r.to.quaternion,t);
      applyPose(r.mesh,pos,q,r.to.scale);r.last=poseOf(r.mesh);visualPoint(r.descriptor,pos);
      if(t>=1||!r.mesh.visible){visualPoint(r.descriptor,null);this.release=null;}
    }
    u.carrying=!!d;u.carryProfile=d?.profile||(n.carryAmount>.001?u.carryProfile:null);u.carryTargets=null;
    n.applyUseTarget();
    n.applyWorkTargets();
    if(!this.active){u.carryPresentation=null;return;}
    const a=this.active,{data}=a,p=spec.profiles[d.profile];a.age+=dt;
    const localOrigin=new T.Vector3(0,p.palmHeight,p.palmZ).sub(data.centreGrip),target=actor.body.localToWorld(localOrigin.clone()),rotation=actor.body.getWorldQuaternion(new T.Quaternion());
    const t=T.MathUtils.smoothstep(a.age,0,spec.timing.pickupSeconds),position=a.from.position.clone().lerp(target,t),q=a.from.quaternion.clone().slerp(rotation,t);
    applyPose(d.mesh,position,q,data.scale);a.last=poseOf(d.mesh);
    if(d.kind==='ice'&&d.device.state.held){d.device.state.pos=[position.x,position.y-.39,position.z];d.device.paint();d.mesh.updateMatrixWorld(true);}
    visualPoint(d,position);
    u.carryTargets={};for(const side of ['Left','Right'])u.carryTargets[side]=actor.body.worldToLocal(data.grips[side].clone().applyQuaternion(q).add(position));
    if(fresh){n.setCarryImmediate(true);n.update(0,actor.moving,actor.running,{airborne:!actor.grounded,vy:actor.vy,speed:actor.travelSpeed});}
    n.applyCarryTargets();
    // Landing lowers the torso. Follow the reachable palms instead of stretching
    // the arms or leaving the object suspended above them during that dip.
    if(n.carryAmount>.98){
      const desired=u.carryTargets.Left.clone().add(u.carryTargets.Right).multiplyScalar(.5);actor.body.localToWorld(desired);
      const correction=n.gripWorld('Left').add(n.gripWorld('Right')).multiplyScalar(.5).sub(desired);
      if(correction.length()>.001){
        correction.clampLength(0,.18);position.add(correction);applyPose(d.mesh,position,q,data.scale);a.last=poseOf(d.mesh);
        if(d.kind==='ice'&&d.device.state.held){d.device.state.pos=[position.x,position.y-.39,position.z];d.device.paint();d.mesh.updateMatrixWorld(true);}
        visualPoint(d,position);
        for(const side of ['Left','Right'])u.carryTargets[side]=actor.body.worldToLocal(data.grips[side].clone().applyQuaternion(q).add(position));
        n.applyCarryTargets();
      }
    }
    u.carryPresentation={kind:d.kind,profile:d.profile,age:a.age,grips:{Left:data.grips.Left.toArray(),Right:data.grips.Right.toArray()},size:data.size.toArray(),errors:{...u.carryGripErrors}};
  }
}

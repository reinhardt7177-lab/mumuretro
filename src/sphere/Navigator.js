import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadActionPoses, createActionPoseLayer } from './ActionPoses.js';
let source,props,clips;
// Three r160 parse overwrites UUID with json.uuid, even when absent.
// Missing IDs make AnimationMixer reuse idle for every named action.
export async function loadNavigator(){
  try{const loader=new GLTFLoader();const [s,p,response]=await Promise.all([loader.loadAsync('assets/characters/sky-navigator/navigator-v01.glb'),loader.loadAsync('assets/characters/sky-navigator/props-v02.glb'),fetch('assets/characters/sky-navigator/motions-v01.json'),loadActionPoses(loader)]);if(!response.ok)throw Error('Motion download failed');clips=Object.fromEntries(Object.entries(await response.json()).map(([n,c])=>[n,T.AnimationClip.parse({...c,uuid:c.uuid||T.MathUtils.generateUUID()})]));source=s.scene;props=p.scene;return true;}catch(e){console.warn('[navigator] Loading failed; keeping existing explorer.',e);return false;}
}
function cloneSkin(root){const clone=root.clone(true),map=new Map();function pair(a,b){map.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));}pair(root,clone);root.traverse(o=>{if(o.isSkinnedMesh){const c=map.get(o);c.skeleton=o.skeleton.clone();c.skeleton.bones=o.skeleton.bones.map(b=>map.get(b));c.bind(c.skeleton,o.bindMatrix);}});return clone;}
export function buildNavigator(glider){
  if(!source)return null;
  const k=new T.Group();k.name='하늘의 항해사';const body=cloneSkin(source);k.add(body);
  body.updateMatrixWorld(true);const box=new T.Box3().setFromObject(body),s=1.5/(box.max.y-box.min.y);body.scale.setScalar(s);body.position.set(-(box.min.x+box.max.x)*s/2,-box.min.y*s,-(box.min.z+box.max.z)*s/2);
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.outlineParameters={visible:false};m.emissiveMap=m.map;m.emissive.setRGB(.28,.28,.28);}}});
  const mixer=new T.AnimationMixer(body),actions={};for(const [n,c] of Object.entries(clips)){actions[n]=mixer.clipAction(c);actions[n].play();actions[n].setEffectiveWeight(n==='idle'?1:0);}mixer.update(0);k.updateMatrixWorld(true);
  const book=props.getObjectByName('notebook').clone(true),scope=new T.Group();scope.add(props.getObjectByName('telescope').clone(true));
  // Independent sockets retain global orientation when attached to the hips.
  function socket(name,x,y,z){const o=new T.Group();o.name=name;o.position.set(x,y,z);k.add(o);k.updateMatrixWorld(true);bones.Hips.attach(o);return o;}
  const bookSlot=socket('Notebook hip socket',-.145,.73,.04),scopeSlot=socket('Telescope hip socket',.14,.70,.02),inspectionSlot=socket('Inspection tool belt socket',.22,.85,-.16);
  bookSlot.add(book);scopeSlot.add(scope);scope.rotation.z=-.18;scope.scale.setScalar(.95);
  const leather=new T.MeshStandardMaterial({color:0x654129,roughness:.9}),brass=new T.MeshStandardMaterial({color:0xb58b43,metalness:.55,roughness:.5});
  function loop(parent,x,y,z,w,h){const strap=new T.Mesh(new T.BoxGeometry(w,h,.014),leather);strap.name='Belt attachment strap';strap.position.set(x,y,z);parent.add(strap);const buckle=new T.Mesh(new T.TorusGeometry(w*.55,.004,6,16),brass);buckle.position.set(x,y+h*.22,z+.009);parent.add(buckle);}
  loop(scopeSlot,-.012,.11,0,.026,.14);loop(bookSlot,0,.12,0,.035,.095);
  function tether(parent,a,b){const delta=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(.009,.009,delta.length(),8),leather);m.name='Leather belt tether';m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(m);}
  tether(scopeSlot,new T.Vector3(-.035,.15,-.015),new T.Vector3(0,.08,0));tether(bookSlot,new T.Vector3(.035,.12,-.03),new T.Vector3(0,.055,0));
  const collar=new T.Mesh(new T.TorusGeometry(.033,.006,6,24),leather);collar.rotation.x=Math.PI/2;collar.position.y=.08;scopeSlot.add(collar);
  const cover=book.getObjectByName('Cover'),hinge=new T.Group();hinge.position.x=-.072;book.add(hinge);if(cover){book.updateMatrixWorld(true);hinge.attach(cover);}
  glider.removeFromParent();k.add(glider);glider.scale.setScalar(.8);glider.position.y=-.15;glider.visible=false;
  const restBodyY=body.position.y;
  // Restore the authored pose before sampling: procedural offsets must not
  // accumulate on bones whose idle tracks are constant or absent.
  const authoredRotations=Object.entries(bones).map(([name,b])=>[b,b.quaternion.clone()]);
  let locomotion=0,runBlend=0,carrying=0,working=0,air=0,time=0,wasAirborne=false,landing=0,tuck=0,travelJump=false;
  const world=new T.Vector3(),at=new T.Vector3(),parentQ=new T.Quaternion(),q=new T.Quaternion();
  function aim(name,child,target,weight){const b=bones[name],c=bones[child];if(!b||!c||weight<.001)return;k.updateMatrixWorld(true);b.getWorldPosition(at);const dir=c.getWorldPosition(new T.Vector3()).sub(at).normalize();world.copy(target);k.localToWorld(world);world.sub(at).normalize();q.setFromUnitVectors(dir,world);b.getWorldQuaternion(parentQ);q.multiply(parentQ);b.parent.getWorldQuaternion(parentQ).invert();q.premultiply(parentQ);b.quaternion.slerp(q,weight);}
  function reach(side,target,weight){
    k.updateMatrixWorld(true);const local=b=>k.worldToLocal(b.getWorldPosition(new T.Vector3())),a=local(bones[side+'Arm']),b=local(bones[side+'ForeArm']),c=local(bones[side+'Hand']);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a),d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
    const bend=new T.Vector3(side==='Left'?1:-1,-.6,-.3);bend.addScaledVector(axis,-bend.dot(axis)).normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(side+'Arm',side+'ForeArm',elbow,weight);aim(side+'ForeArm',side+'Hand',target,weight);
  }
  function raiseWorkingFoot(side,amount){
    k.updateMatrixWorld(true);const foot=bones[side+'Foot'],orientation=foot.getWorldQuaternion(new T.Quaternion()),local=b=>k.worldToLocal(b.getWorldPosition(new T.Vector3())),a=local(bones[side+'UpLeg']),b=local(bones[side+'Leg']),c=local(foot),target=c.clone().add(new T.Vector3(0,amount,0)),axis=target.clone().sub(a),l1=a.distanceTo(b),l2=b.distanceTo(c),d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();let bend=b.clone().sub(a).addScaledVector(axis,-b.clone().sub(a).dot(axis));if(bend.lengthSq()<1e-6)bend.set(0,0,1).addScaledVector(axis,-axis.z);bend.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),joint=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));aim(side+'UpLeg',side+'Leg',joint,1);aim(side+'Leg',side+'Foot',target,1);foot.parent.getWorldQuaternion(gripParentQ).invert();foot.quaternion.copy(gripParentQ.multiply(orientation));
  }
  // Express flexion around each joint, not absolute targets near the floor.
  // This keeps the knee bend anatomical at different hip heights and poses.
  function jumpLeg(side,thigh,knee,weight){
    k.updateMatrixWorld(true);
    const hip=k.worldToLocal(bones[side+'UpLeg'].getWorldPosition(new T.Vector3()));
    aim(side+'UpLeg',side+'Leg',hip.add(new T.Vector3(0,-Math.cos(thigh),Math.sin(thigh))),weight);
    k.updateMatrixWorld(true);
    const joint=k.worldToLocal(bones[side+'Leg'].getWorldPosition(new T.Vector3()));
    aim(side+'Leg',side+'Foot',joint.add(new T.Vector3(0,-Math.cos(thigh-knee),Math.sin(thigh-knee))),weight);
  }
  const u=k.userData;Object.assign(u,{bob:0,glider,head:bones.Head,armL:bones.LeftArm,armR:bones.RightArm,legL:bones.LeftUpLeg,legR:bones.RightUpLeg});
  const poseLayer=createActionPoseLayer(k,bones);
  const gripQ=new T.Quaternion(),gripParentQ=new T.Quaternion(),gripScale=new T.Vector3(),gripOffset=new T.Vector3(),gripTarget=new T.Vector3();
  function gripWorld(side,out=new T.Vector3()){
    const socket=poseLayer?.grips[side];if(!socket)return null;k.updateMatrixWorld(true);return out.copy(socket.position).applyMatrix4(bones[side+'Hand'].matrixWorld);
  }
  function solvePalm(side,target,weight,orientation=null){
      const socket=poseLayer.grips[side],hand=bones[side+'Hand'];
      k.updateMatrixWorld(true);k.getWorldQuaternion(gripQ);if(orientation)gripQ.multiply(orientation);gripQ.multiply(socket.quaternion.clone().invert());
      hand.getWorldScale(gripScale);gripOffset.copy(socket.position).multiply(gripScale).applyQuaternion(gripQ);
      gripTarget.copy(target);k.localToWorld(gripTarget);gripTarget.sub(gripOffset);k.worldToLocal(gripTarget);
      reach(side,gripTarget,weight);
      hand.parent.getWorldQuaternion(gripParentQ).invert();gripParentQ.multiply(gripQ);hand.quaternion.slerp(gripParentQ,weight);
      k.updateMatrixWorld(true);const actual=k.worldToLocal(gripWorld(side));return actual.distanceTo(target);
  }
  function applyCarryTargets(){
    if(!poseLayer||!u.carryTargets||carrying<.001)return;
    const errors={};for(const side of ['Left','Right'])if(u.carryTargets[side])errors[side]=solvePalm(side,u.carryTargets[side],carrying);
    u.carryGripErrors=errors;
  }
  function applyUseTarget(){
    const action=poseLayer?.use;if(!action||u.carrying||!u.actionTargetWorld)return;
    const t=action.time/poseLayer.spec.timing.useSeconds,weight=Math.sin(Math.PI*T.MathUtils.clamp(t,0,1));
    const local=k.worldToLocal(u.actionTargetWorld.clone());u.useGripError=solvePalm(action.side,local,weight);
  }
  const workOrientation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
  function applyWorkTargets(){if(!poseLayer||!u.workTargets||working<.001)return;const errors={};for(const side of['Left','Right'])errors[side]=solvePalm(side,k.worldToLocal(u.workTargets[side].clone()),working,workOrientation);u.workGripErrors=errors;}
  u.armL.userData.lower=bones.LeftForeArm;u.armR.userData.lower=bones.RightForeArm;u.legL.userData.lower=bones.LeftLeg;u.legR.userData.lower=bones.RightLeg;
  u.navigator={mixer,bones,book,scope,inspectionSlot,poseLayer,gripWorld,applyCarryTargets,applyUseTarget,applyWorkTargets,get carryAmount(){return carrying;},get workAmount(){return working;},setCarryImmediate(value){carrying=value?1:0;},setWorkImmediate(value){working=value?1:0;},update(dt,moving,running,pose={}){
    if(!wasAirborne&&pose.airborne){travelJump=!!(pose.traveling??moving);landing=0;}
    if(wasAirborne&&!pose.airborne)landing=1;wasAirborne=!!pose.airborne;landing=Math.max(0,landing-dt*4);time+=dt;const f=1-Math.exp(-dt*16);
    const speed=pose.speed??(moving?(running?6:3.6):0),amount=moving&&!pose.airborne?T.MathUtils.clamp(speed/.75,0,1):0;
    locomotion=T.MathUtils.lerp(locomotion,amount,f);runBlend=T.MathUtils.lerp(runBlend,pose.runBlend??T.MathUtils.smoothstep(speed,1.8,3.4),f);
    carrying=T.MathUtils.lerp(carrying,u.carrying&&!pose.gliding?1:0,f);air=T.MathUtils.lerp(air,pose.airborne?1:0,f);
    working=T.MathUtils.lerp(working,u.workContact&&!pose.reading&&!pose.airborne?1:0,f);
    for(const [bone,rotation] of authoredRotations)bone.quaternion.copy(rotation);
    actions.idle.setEffectiveWeight(1-locomotion);actions.walk.setEffectiveWeight(locomotion*(1-runBlend));actions.run.setEffectiveWeight(locomotion*runBlend);
    // Median backward toe speed while both samples are below .055m at 120Hz:
    // walk 1.2073, run 4.0315 m/s. Measured from our current asset, not Zelda.
    actions.walk.setEffectiveTimeScale(T.MathUtils.clamp(speed/1.2073,.2,3.2)*(pose.reverse?-1:1));
    actions.run.setEffectiveTimeScale(T.MathUtils.clamp(speed/4.0315,.2,3.2)*(pose.reverse?-1:1));
    mixer.update(dt);u.gait={speed,runBlend,walkRate:actions.walk.getEffectiveTimeScale(),runRate:actions.run.getEffectiveTimeScale()};
    for(const [bone,rotation] of authoredRotations)rotation.copy(bone.quaternion);
    // Velocity distinguishes takeoff/apex/descent without delaying the actual jump.
    tuck=T.MathUtils.lerp(tuck,pose.airborne&&!pose.gliding?T.MathUtils.smoothstep(pose.vy||0,-3,3):0,f);
    body.position.y=restBodyY-Math.max(.085*landing,.10*working);
    u.bob=0;u.airBlend=air;u.glideBlend=pose.gliding?1:0;glider.visible=!!pose.gliding;
    const reading=!!pose.reading&&!u.carrying;
    hinge.rotation.y=T.MathUtils.lerp(hinge.rotation.y,reading?-2.25:0,f);
    const lean=landing*.22+(!pose.gliding&&travelJump?air*.12:0);
    if(lean>.001&&bones.Spine&&!reading){
      k.updateMatrixWorld(true);
      const axis=new T.Vector3(1,0,0).applyQuaternion(k.getWorldQuaternion(new T.Quaternion()));
      bones.Spine.getWorldQuaternion(q);q.premultiply(new T.Quaternion().setFromAxisAngle(axis,lean));
      bones.Spine.parent.getWorldQuaternion(parentQ).invert();bones.Spine.quaternion.copy(parentQ.multiply(q));
    }
    for(const [side,x] of [['Left',1],['Right',-1]]){
      if(air>.01){
        const lead=side==='Left',fold=pose.gliding?.15:tuck;
        const thigh=travelJump?(lead?.10+fold*.55:-.10+fold*.16):.06+fold*(lead?.32:.24);
        const knee=travelJump?(lead?.20+fold*.80:.24+fold*.38):.15+fold*(lead?.62:.50);
        jumpLeg(side,thigh,knee,air);
      }
      if(landing>0){aim(side+'UpLeg',side+'Leg',new T.Vector3(x*.12,.36,.22),landing);aim(side+'Leg',side+'Foot',new T.Vector3(x*.12,.035,.015),landing);}
      // Lower the neutral A-pose; source locomotion retains its authored arm swing.
      aim(side+'Arm',side+'ForeArm',new T.Vector3(x*.27,.89,.015),1-locomotion);
      aim(side+'ForeArm',side+'Hand',new T.Vector3(x*.24,.65,.04),1-locomotion);
      if(air>.01){
        if(pose.gliding){aim(side+'Arm',side+'ForeArm',new T.Vector3(x*.42,1.31,-.04),air);aim(side+'ForeArm',side+'Hand',new T.Vector3(x*.61,1.48,.28),air);}
        else {
          const lead=side==='Right';
          aim(side+'Arm',side+'ForeArm',new T.Vector3(x*(travelJump?.29:.27),.91,travelJump?(lead?.10:-.09):.025),air);
          aim(side+'ForeArm',side+'Hand',new T.Vector3(x*(travelJump?.31:.28),travelJump?(lead?.96+tuck*.12:.76):.78+tuck*.12,travelJump?(lead?.28:-.13):.16),air);
        }
      }
      if((carrying>.01&&(!poseLayer||!u.carryProfile))||reading){const w=reading?1:carrying;reach(side,new T.Vector3(x*(reading?.105:.26),reading?.98:.91,reading?.30:.34),w);}
    }
    if(working>.001&&!pose.airborne)for(const side of['Left','Right'])raiseWorkingFoot(side,.10*working);
    poseLayer?.update(dt,reading?null:u.carryProfile,carrying,!!pose.reading&&u.carrying,!!u.inspectMagnet&&!reading&&!pose.airborne,reading?0:working);
    if(!reading)applyCarryTargets();
    if(!reading)applyUseTarget();
    if(!reading)applyWorkTargets();
    // Sampled after locomotion, with the same two-bone reach as the held props.
    // The VFX controller owns the smooth envelope; carrying/reading retain priority.
    if(u.waterCasting?.weight>.001&&carrying<.01&&!reading&&!pose.airborne){
      reach('Left',u.waterCasting.target,u.waterCasting.weight);
    }
    if(reading){if(book.parent!==k){k.add(book);book.position.set(0,.99,.37);book.rotation.set(-.8,0,Math.PI/2);}bones.Head.rotation.x+=.12;}else if(book.parent!==bookSlot){bookSlot.add(book);book.position.set(0,0,0);book.rotation.set(0,0,0);}
    book.visible=u.hasNotebook!==false;scope.rotation.z=-.06+Math.sin(time*4)*.015*locomotion;
  }};
  u.navigator.update(0,false,false);return k;
}

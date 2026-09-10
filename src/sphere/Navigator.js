import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let source,props,clips;
// Three r160 parse overwrites UUID with json.uuid, even when absent.
// Missing IDs make AnimationMixer reuse idle for every named action.
export async function loadNavigator(){
  try{const loader=new GLTFLoader();const [s,p,response]=await Promise.all([loader.loadAsync('assets/characters/sky-navigator/navigator-v01.glb'),loader.loadAsync('assets/characters/sky-navigator/props-v01.glb'),fetch('assets/characters/sky-navigator/motions-v01.json')]);if(!response.ok)throw Error('Motion download failed');clips=Object.fromEntries(Object.entries(await response.json()).map(([n,c])=>[n,T.AnimationClip.parse({...c,uuid:c.uuid||T.MathUtils.generateUUID()})]));source=s.scene;props=p.scene;return true;}catch(e){console.warn('[navigator] Loading failed; keeping existing explorer.',e);return false;}
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
  const bookSlot=socket('Notebook hip socket',-.145,.73,.04),scopeSlot=socket('Telescope hip socket',.14,.70,.02);
  bookSlot.add(book);scopeSlot.add(scope);scope.rotation.z=-.18;scope.scale.setScalar(.95);
  const leather=new T.MeshStandardMaterial({color:0x654129,roughness:.9}),brass=new T.MeshStandardMaterial({color:0xb58b43,metalness:.55,roughness:.5});
  function loop(parent,x,y,z,w,h){const strap=new T.Mesh(new T.BoxGeometry(w,h,.014),leather);strap.name='Belt attachment strap';strap.position.set(x,y,z);parent.add(strap);const buckle=new T.Mesh(new T.TorusGeometry(w*.55,.004,6,16),brass);buckle.position.set(x,y+h*.22,z+.009);parent.add(buckle);}
  loop(scopeSlot,-.012,.11,0,.026,.14);loop(bookSlot,0,.12,0,.035,.095);
  function tether(parent,a,b){const delta=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(.009,.009,delta.length(),8),leather);m.name='Leather belt tether';m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(m);}
  tether(scopeSlot,new T.Vector3(-.035,.15,-.015),new T.Vector3(0,.08,0));tether(bookSlot,new T.Vector3(.035,.12,-.03),new T.Vector3(0,.055,0));
  const collar=new T.Mesh(new T.TorusGeometry(.033,.006,6,24),leather);collar.rotation.x=Math.PI/2;collar.position.y=.08;scopeSlot.add(collar);
  const cover=book.getObjectByName('Cover'),hinge=new T.Group();hinge.position.x=-.072;book.add(hinge);if(cover){book.updateMatrixWorld(true);hinge.attach(cover);}
  glider.removeFromParent();k.add(glider);glider.scale.setScalar(.8);glider.position.y=-.15;glider.visible=false;
  let locomotion=0,carrying=0,air=0,time=0,wasAirborne=false,landing=0;
  const world=new T.Vector3(),at=new T.Vector3(),parentQ=new T.Quaternion(),q=new T.Quaternion();
  function aim(name,child,target,weight){const b=bones[name],c=bones[child];if(!b||!c||weight<.001)return;k.updateMatrixWorld(true);b.getWorldPosition(at);const dir=c.getWorldPosition(new T.Vector3()).sub(at).normalize();world.copy(target);k.localToWorld(world);world.sub(at).normalize();q.setFromUnitVectors(dir,world);b.getWorldQuaternion(parentQ);q.multiply(parentQ);b.parent.getWorldQuaternion(parentQ).invert();q.premultiply(parentQ);b.quaternion.slerp(q,weight);}
  function reach(side,target,weight){
    k.updateMatrixWorld(true);const local=b=>k.worldToLocal(b.getWorldPosition(new T.Vector3())),a=local(bones[side+'Arm']),b=local(bones[side+'ForeArm']),c=local(bones[side+'Hand']);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a),d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
    const bend=new T.Vector3(side==='Left'?1:-1,-.6,-.3);bend.addScaledVector(axis,-bend.dot(axis)).normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(side+'Arm',side+'ForeArm',elbow,weight);aim(side+'ForeArm',side+'Hand',target,weight);
  }
  const u=k.userData;Object.assign(u,{bob:0,glider,head:bones.Head,armL:bones.LeftArm,armR:bones.RightArm,legL:bones.LeftUpLeg,legR:bones.RightUpLeg});
  u.armL.userData.lower=bones.LeftForeArm;u.armR.userData.lower=bones.RightForeArm;u.legL.userData.lower=bones.LeftLeg;u.legR.userData.lower=bones.RightLeg;
  u.navigator={mixer,bones,book,scope,update(dt,moving,running,pose={}){
    if(wasAirborne&&!pose.airborne)landing=1;wasAirborne=!!pose.airborne;landing=Math.max(0,landing-dt*4);time+=dt;const f=1-Math.exp(-dt*12);locomotion=T.MathUtils.lerp(locomotion,moving&&!pose.airborne?1:0,f);carrying=T.MathUtils.lerp(carrying,u.carrying&&!pose.gliding?1:0,f);air=T.MathUtils.lerp(air,pose.airborne?1:0,f);
    actions.idle.setEffectiveWeight(1-locomotion);actions.walk.setEffectiveWeight(locomotion*(running?0:1));actions.run.setEffectiveWeight(locomotion*(running?1:0));mixer.update(dt);
    u.bob=-.015*landing;u.airBlend=air;u.glideBlend=pose.gliding?1:0;glider.visible=!!pose.gliding;
    const reading=!!pose.reading;
    hinge.rotation.y=T.MathUtils.lerp(hinge.rotation.y,reading?-2.25:0,f);
    for(const [side,x] of [['Left',1],['Right',-1]]){
      if(landing>0){aim(side+'UpLeg',side+'Leg',new T.Vector3(x*.11,.4,.1),landing*.35);aim(side+'Leg',side+'Foot',new T.Vector3(x*.11,.10,.025),landing*.35);}// Lower the neutral A-pose; source locomotion retains its authored arm swing.
      aim(side+'Arm',side+'ForeArm',new T.Vector3(x*.27,.89,.015),1-locomotion);
      aim(side+'ForeArm',side+'Hand',new T.Vector3(x*.24,.65,.04),1-locomotion);
      if(air>.01){aim(side+'Arm',side+'ForeArm',new T.Vector3(x*(pose.gliding?.42:.32),pose.gliding?1.31:1.05,.09),air);aim(side+'ForeArm',side+'Hand',new T.Vector3(x*(pose.gliding?.61:.38),pose.gliding?1.48:1.05,.28),air);}
      if(carrying>.01||reading){const w=reading?1:carrying;reach(side,new T.Vector3(x*(reading?.105:.26),reading?.98:.91,reading?.30:.34),w);}
    }
    if(reading){if(book.parent!==k){k.add(book);book.position.set(0,.99,.37);book.rotation.set(-.8,0,Math.PI/2);}bones.Head.rotation.x+=.12;}else if(book.parent!==bookSlot){bookSlot.add(book);book.position.set(0,0,0);book.rotation.set(0,0,0);}
    book.visible=u.hasNotebook!==false;scope.rotation.z=-.06+Math.sin(time*4)*.015*locomotion;
  }};
  u.navigator.update(0,false,false);return k;
}

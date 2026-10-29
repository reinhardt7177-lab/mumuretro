import * as T from 'three';

let library=null;
const upper=['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand'];
export async function loadActionPoses(loader){
  try{
    const response=await fetch('assets/characters/sky-navigator/action-contract-v01.json');if(!response.ok)return false;
    const spec=await response.json(),asset=await loader.loadAsync(spec.model);
    for(const name of ['referenceRest','carryOverhead','carryCradle','useLeftHandle','useRightHandle'])if(!asset.animations.some(c=>c.name===name))throw Error('Missing action '+name);
    for(const side of ['Left','Right'])if(!asset.scene.getObjectByName('Grip'+side))throw Error('Missing palm socket '+side);
    library={spec,asset};return true;
  }catch(error){console.warn('[action-poses] retained existing motion',error);return false;}
}
export function actionContract(){return library?.spec;}
export function createActionPoseLayer(root,bones){
  if(!library)return null;
  const proxy=library.asset.scene.clone(true),mixer=new T.AnimationMixer(proxy),actions={},nodes={},rest={};
  for(const name of upper){nodes[name]=proxy.getObjectByName(name);if(!nodes[name]||!bones[name])throw Error('Action skeleton differs at '+name);}
  for(const clip of library.asset.animations){const a=mixer.clipAction(clip);a.play();a.setEffectiveWeight(clip.name==='referenceRest'?1:0);actions[clip.name]=a;}
  mixer.update(0);for(const name of upper)rest[name]=nodes[name].quaternion.clone();
  const grips=Object.fromEntries(['Left','Right'].map(side=>{const node=proxy.getObjectByName('Grip'+side);return[side,{position:node.position.clone(),quaternion:node.quaternion.clone(),parent:node.parent.name}];}));
  let time=0,use=null,inspection=0;
  function sample(name,t){for(const [key,a]of Object.entries(actions)){a.enabled=true;a.setEffectiveWeight(key===name?1:0);}const a=actions[name];a.time=Math.min(a.getClip().duration-1e-5,Math.max(0,t));mixer.update(0);}
  return{spec:library.spec,proxy,mixer,grips,clips:Object.keys(actions),get use(){return use;},
    trigger(side='Right'){use={side,time:0};},clear(){use=null;},
    update(dt,profile,weight,paused=false,inspect=false,workWeight=0){
      if(!paused){time+=dt;if(use)use.time+=dt;}
      if(profile&&weight>.001){const clip=library.spec.profiles[profile]?.clip;if(clip){sample(clip,time%actions[clip].getClip().duration);for(const name of upper)if(nodes[name].quaternion.angleTo(rest[name])>1e-6)bones[name].quaternion.slerp(nodes[name].quaternion,weight);}}
      inspection=T.MathUtils.lerp(inspection,inspect&&weight<.01?1:0,1-Math.exp(-dt*16));
      if(inspection>.001){sample('useLeftHandle',library.spec.timing.useSeconds*.5);for(const bone of upper)if(bone.startsWith('Left'))bones[bone].quaternion.slerp(nodes[bone].quaternion,inspection);}
      if(workWeight>.001&&weight<.01){for(const side of['Left','Right']){sample('use'+side+'Handle',library.spec.timing.useSeconds*.5);for(const bone of upper)if(bone.startsWith(side))bones[bone].quaternion.slerp(nodes[bone].quaternion,workWeight);}}
      if(use&&use.time>=library.spec.timing.useSeconds)use=null;
      if(use&&weight<.01){const name='use'+use.side+'Handle';sample(name,use.time);const w=Math.sin(Math.PI*use.time/library.spec.timing.useSeconds);for(const bone of upper)if(bone.startsWith(use.side)&&nodes[bone].quaternion.angleTo(rest[bone])>1e-6)bones[bone].quaternion.slerp(nodes[bone].quaternion,w);}
    }
  };
}

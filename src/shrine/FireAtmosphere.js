import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { FIRE_COURT_LIGHT } from '../data/lighting.js';

// Own art direction. Reuses authored cliffs; no puzzle/save/collision mutation.
export async function installFireAtmosphere(scene){
  if(scene.userData.fireAtmosphere)return scene.userData.fireAtmosphere;
  const p=FIRE_COURT_LIGHT;
  scene.background=new T.Color(p.horizon);scene.fog=new T.Fog(p.horizon,p.fogNear,p.fogFar);scene.userData.softMidShadows=true;
  scene.traverse(o=>{if(o.isHemisphereLight){o.color.set(p.sky);o.groundColor.set(p.ground);o.intensity=p.ambient;}if(o.isDirectionalLight&&o.castShadow){o.color.set(p.sun);o.intensity=p.sunIntensity;o.userData.authoredShadowBias=p.bias;o.userData.authoredShadowNormalBias=p.normalBias;o.shadow.bias=p.bias;o.shadow.normalBias=p.normalBias;}});
  const material=new T.ShaderMaterial({uniforms:{top:{value:new T.Color(p.top)},horizon:{value:new T.Color(p.horizon)}},side:T.BackSide,depthWrite:false,fog:false,
    vertexShader:'varying vec3 local;void main(){local=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 top,horizon;varying vec3 local;void main(){float t=smoothstep(-.04,.65,normalize(local).y);gl_FragColor=vec4(mix(horizon,top,t),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  material.userData.outlineParameters={visible:false};
  const sky=new T.Mesh(new T.SphereGeometry(420,24,16),material);sky.name='Fire caldera sky';sky.userData.sky=true;sky.renderOrder=-100;sky.frustumCulled=false;scene.add(sky);
  const state=scene.userData.fireAtmosphere={loaded:false,cliffs:[],model:'assets/models/adventure/strata-surround-v01.glb',lightsAdded:0};
  try{
    const pending=[];const source=(await new GLTFLoader().loadAsync(state.model)).scene,materials=new Map();
    const placements=Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return {part:'ErodedMesa'+(i%3+1),position:[Math.cos(a)*125,-55,-14+Math.sin(a)*140],scale:1.8+(i%3)*.22,yaw:a+.3};});
    for(const q of placements){const part=source.getObjectByName(q.part);if(!part)throw Error('Missing cliff '+q.part);const root=part.clone(true);root.position.fromArray(q.position);root.scale.set(q.scale,5,q.scale);root.rotation.y=q.yaw;root.name='Fire distant '+q.part;
      root.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!materials.has(m)){const c=m.clone();c.color.multiplyScalar(.87);c.envMapIntensity=.28;c.roughness=.93;c.userData.outlineParameters={visible:false};materials.set(m,c);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);o.castShadow=o.receiveShadow=false;});
      root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root,true);
      // Conservative envelope encloses all fire rooms/corridors and camera space.
      if(b.min.x<48&&b.max.x>-48&&b.min.z<44&&b.max.z>-68)throw Error('Cliff crosses playable envelope');
      state.cliffs.push({...q,verticalScale:5,min:b.min.toArray(),max:b.max.toArray()});pending.push(root);
    }
    const basin=(await new GLTFLoader().loadAsync('assets/models/fire-temple/caldera-basin-v01.glb')).scene;basin.position.y=-60;basin.name='Fire caldera basin';basin.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=false;o.material.userData.outlineParameters={visible:false};}});scene.add(basin);for(const root of pending)scene.add(root);state.loaded=true;state.materials=materials.size;
  }catch(error){state.cliffs=[];state.error=error.message;console.warn('[fire-atmosphere] distant cliffs unavailable; sky retained',error);}
  return state;
}

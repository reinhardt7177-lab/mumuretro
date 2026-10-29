import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Own art direction, not extracted or measured Zelda lighting. No new save fields.
let assetsPromise;
const records=new WeakMap(),renderers=new WeakMap();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0);
function assets(){
  return assetsPromise??=fetch('assets/models/adventure/interior-art-v01.json').then(async response=>{
    if(!response.ok)return null; // Existing authored scenes are the fallback.
    const spec=await response.json();
    const gltf=await new GLTFLoader().loadAsync(spec.model).catch(error=>{console.warn('[interior-art] witness model unavailable',error);return null;});
    return {spec,source:gltf?.scene};
  }).catch(error=>{console.warn('[interior-art] retained authored scene',error);return null;});
}
function recordFor(scene){
  let r=records.get(scene);
  if(!r){r={scene,ready:Promise.resolve(),bindings:[],meshes:[],initialised:false,snap:true,time:0,environment:null};records.set(scene,r);}
  return r;
}

// Soft sky and two broad architectural reflection sources, in linear light.
// Diffuse and rough specular use PMREM; no added real-time lamps or shadow maps.
function environment(renderer,profile,spec){
  let cache=renderers.get(renderer);
  if(!cache){cache={pmrem:new THREE.PMREMGenerator(renderer),maps:new Map()};renderers.set(renderer,cache);}
  if(cache.maps.has(profile))return cache.maps.get(profile);
  const p=spec.profiles[profile],w=spec.environment.width,h=spec.environment.height;
  const sky=new THREE.Color(p.sky),floor=new THREE.Color(p.floor),key=new THREE.Color(p.key),c=new THREE.Color();
  const data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const phi=(x+.5)/w*Math.PI*2,theta=(y+.5)/h*Math.PI,dy=Math.cos(theta);
    const dx=-Math.sin(theta)*Math.cos(phi),dz=Math.sin(theta)*Math.sin(phi);
    const blend=THREE.MathUtils.smoothstep(dy,-.35,.65);
    c.copy(floor).lerp(sky,blend).multiplyScalar(p.gain);
    const softbox=Math.pow(Math.max(0,dx*.50+dy*.74+dz*.45),22);
    const fill=Math.pow(Math.max(0,-dx*.84+dy*.48-dz*.25),12)*.28;
    const boost=p.gain*(softbox*3.0+fill);c.r+=key.r*boost;c.g+=key.g*boost;c.b+=key.b*boost;
    const i=(y*w+x)*4;data[i]=c.r;data[i+1]=c.g;data[i+2]=c.b;data[i+3]=1;
  }
  const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.needsUpdate=true;
  const target=cache.pmrem.fromEquirectangular(texture);texture.dispose();target.texture.name='Mumu interior reflection — '+profile;
  cache.maps.set(profile,target);return target;
}

export function prepareInteriorScene(renderer,scene){
  const profile=scene.userData.lookProfile;
  if(!['ship','balance','shadow','sift','water','fire','strata'].includes(profile))return null;
  const r=recordFor(scene);
  if(!r.environmentReady){
    r.environmentReady=assets().then(a=>{
      if(!a)return;
      const target=environment(renderer,profile,a.spec);scene.environment=target.texture;r.environment=target;
      scene.userData.interiorDirection={...(scene.userData.interiorDirection||{}),profile,environment:true,generatedMapSize:[a.spec.environment.width,a.spec.environment.height],reflectionTargetSize:[target.width,target.height],estimatedEnvironmentTargetBytes:target.width*target.height*(target.texture.type===THREE.HalfFloatType?8:16),newPointLights:0};
    });
    r.ready=Promise.all([r.ready,r.environmentReady]);
  }
  return r;
}

function doorBindings(room,spec){
  // The deeper water portal has its own grounded pier behind the marker.
  // Bring the marker forward with its mesh/body binding, clear of that stone.
  const doorFrontOffset=room.waterCourts?.loaded?1.1:spec.witness.doorFrontOffset;
  if(room.fireAdventure){
    return spec.fireWitnesses.map(v=>({id:v.id,point:new THREE.Vector3(...v.position),yaw:v.yaw,halfWidth:v.halfWidth,
      read:()=>{const [stage,key]=v.state.split('.');return !!(stage==='fracture'?room.world?.mechanics.state[key]:room.world?.[stage]?.mechanics.state[key]);}}));
  }
  return Object.entries(room.dungeon.doors).map(([id,d])=>{
    // Deep balance pockets own their grounded jamb. Keep the solved signal,
    // rendered marker and capsule body together in front of that stone.
    const frontZ=d.portal?d.mesh.position.z+1.55:d.rect.z1+doorFrontOffset;
    return{id,point:new THREE.Vector3((d.rect.x0+d.rect.x1)/2,room.dungeon.rects.floorAt?.(0,frontZ)??0,frontZ),
      yaw:0,halfWidth:(d.rect.x1-d.rect.x0)/2,read:()=>!!d.opened};});
}
function meshGeometry(source,name){
  const part=source.getObjectByName(name);if(!part?.isMesh)throw Error('Missing interior part '+name);
  source.updateMatrixWorld(true);return {geometry:part.geometry.clone().applyMatrix4(part.matrixWorld),material:part.material};
}
function installWitnesses(r,a){
  const {room}=r,profile=room.spec.id;r.spec=a.spec;r.bindings=doorBindings(room,a.spec);
  if(!r.bindings.length)return;
  const count=r.bindings.length*2;
  const parts=[meshGeometry(a.source,'witness-balance-stone'),meshGeometry(a.source,'witness-balance-bronze'),meshGeometry(a.source,`witness-${profile}-light`)];
  for(let k=0;k<parts.length;k++){
    const p=parts[k],material=k===2?new THREE.MeshBasicMaterial({color:0xffffff}):p.material;
    material.userData.outlineParameters={visible:false};
    const mesh=new THREE.InstancedMesh(p.geometry,material,count);mesh.name=`Interior witness ${profile} ${['stone','bronze','signal'][k]}`;
    mesh.castShadow=k<2;mesh.receiveShadow=k<2;mesh.userData.interiorWitness=true;
    for(let i=0;i<r.bindings.length;i++)for(let side=0;side<2;side++){
      const b=r.bindings[i],offset=(side?1:-1)*(b.halfWidth+a.spec.witness.width/2+a.spec.witness.gapOutsidePassage);
      position.set(offset,0,0).applyAxisAngle(up,b.yaw).add(b.point);rotation.setFromAxisAngle(up,b.yaw);
      // The left completion marker must not cover the shadow-theatre screen.
      // Keep its rendered instances, capsule body and saved signal binding together.
      if(profile==='shadow'&&b.id==='r3'&&side===0)position.x=-5.8;
      matrix.compose(position,rotation,scale);mesh.setMatrixAt(i*2+side,matrix);
      if(k===0){
        (b.positions??=[]).push(position.toArray());
        const left=new THREE.Vector3(-.21,0,0).applyAxisAngle(up,b.yaw).add(position),right=new THREE.Vector3(.21,0,0).applyAxisAngle(up,b.yaw).add(position);
        const escape=new THREE.Vector3(side?-1:1,0,0).applyAxisAngle(up,b.yaw);
        room.obstacles.push({x:left.x,z:left.z,x2:right.x,z2:right.z,r:.44,minY:position.y,maxY:position.y+a.spec.witness.height,escapeX:escape.x,escapeZ:escape.z,interiorWitness:true,interiorWitnessDoor:b.id});
      }
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();r.scene.add(mesh);r.meshes.push(mesh);
    if(k<2)(room.dungeon.rects.cameraOccluders??=[]).push(mesh);
  }
  r.light=r.meshes[2];r.colour=new THREE.Color();r.solved=new THREE.Color(a.spec.witness.solvedColour);r.waiting=new THREE.Color('#344c5a');
  r.scene.userData.interiorDirection={...(r.scene.userData.interiorDirection||{}),witnesses:count,drawMeshes:3};
  syncInteriorScene(r.scene,0);
}

export function registerInteriorRoom(room){
  const r=recordFor(room.scene);r.room=room;room.interiorArt=r;
  r.ready=Promise.all([assets(),room.ready]).then(([a])=>{if(a?.source)installWitnesses(r,a);});
  room.ready=Promise.all([room.ready,r.ready]);
  for(const method of ['importState','restart']){
    const original=room[method]?.bind(room);if(!original)continue;
    room[method]=(...args)=>{const result=original(...args);if(method==='restart'||result){r.snap=true;syncInteriorScene(room.scene,0);}return result;};
  }
  return room;
}

// A replacement doorway owns its piers as well as its moving panel. Suppress
// only that pair in the shared instance batches; other doors keep their art.
export function suppressInteriorDoorWitness(room,id){
  const r=records.get(room.scene),i=r?.bindings.findIndex(b=>b.id===id)??-1;
  if(i<0)return 0;
  const b=r.bindings[i];if(b.suppressed)return 2;b.suppressed=true;
  const hidden=new THREE.Matrix4().makeScale(0,0,0);
  for(const mesh of r.meshes){for(let side=0;side<2;side++)mesh.setMatrixAt(i*2+side,hidden);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  room.obstacles.splice(0,room.obstacles.length,...room.obstacles.filter(o=>o.interiorWitnessDoor!==id));
  return 2;
}

export function syncInteriorScene(scene,dt=0){
  const r=records.get(scene);if(!r?.light)return;
  r.time+=dt;
  for(let i=0;i<r.bindings.length;i++){
    const b=r.bindings[i],next=b.read();
    if(b.suppressed)continue;
    if(r.snap||!r.initialised){b.on=next;b.age=r.spec.witness.pulseSeconds;}
    else if(next!==b.on){b.on=next;b.age=0;}
    else b.age=Math.min(r.spec.witness.pulseSeconds,b.age+dt);
    const pulse=b.on&&!reduced.matches?Math.sin(Math.PI*b.age/r.spec.witness.pulseSeconds)*.45:0;
    const fade=b.on?THREE.MathUtils.smoothstep(b.age,0,.25):0;
    r.colour.copy(r.waiting).lerp(r.solved,fade).multiplyScalar(1+pulse);
    r.light.setColorAt(i*2,r.colour);r.light.setColorAt(i*2+1,r.colour);
  }
  r.light.instanceColor.needsUpdate=true;r.initialised=true;r.snap=false;
}

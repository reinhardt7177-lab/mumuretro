import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Only unreachable scenery and decorative rails. Door colours, navigation,
// actor collision and puzzle state continue to be owned by the original room.
export async function installStrataSurround(room, url='assets/models/adventure/strata-surround-v01.json') {
  if(room.spec.id!=='strata'||!room.dungeon.surroundings)return false;
  const state=room.strataSurround={loaded:false,roots:[],metrics:null};
  try {
    const response=await fetch(url);
    if(!response.ok)throw Error('Surround manifest unavailable');
    const spec=await response.json(),source=(await new GLTFLoader().loadAsync(spec.model)).scene;
    const materials=new Set(),geometry=new Set();let meshes=0,triangles=0;
    // Validate and prepare everything before suppressing the fallback scene.
    for(const p of spec.placements){
      const part=source.getObjectByName(p.part);
      if(!part)throw Error('Missing cliff '+p.part);
      const root=part.clone(true);root.position.fromArray(p.position);root.scale.setScalar(p.scale);root.rotation.y=p.yaw;
      root.name='Distant '+p.part;root.updateMatrixWorld(true);
      const bounds=new T.Box3().setFromObject(root,true);
      const keepOut=Math.max(...room.dungeon.rects.map(r=>r.x1))+spec.minimumPlayableGap;
      if(bounds.min.x<keepOut&&bounds.max.x>-keepOut)throw Error('Cliff crosses playable axis');
      root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material.userData.outlineParameters={visible:false};o.material.envMapIntensity=.35;materials.add(o.material);geometry.add(o.geometry);meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
      state.roots.push(root);
    }
    const original=room.dungeon.surroundings;
    const rail=new T.MeshStandardMaterial({name:'Weathered bronze handrail',color:spec.railColor,roughness:.78,metalness:.25,envMapIntensity:.45});
    rail.userData.outlineParameters={visible:false};
    // Do not change shared glow materials: doors use them for solved feedback.
    for(const mesh of original.rails)mesh.material=rail;
    for(const mesh of [...original.rocks,...original.clouds])mesh.visible=false;
    for(const root of state.roots)room.scene.add(root);
    state.metrics={roots:state.roots.length,meshes,materials:materials.size,geometries:geometry.size,triangles,oldRocks:original.rocks.length,oldCloudGroups:original.clouds.length,rails:original.rails.length};
    state.loaded=true;return true;
  }catch(error){state.reason=error.message;console.warn('[strata-surround] original scenery retained',error);return false;}
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const models=new Map(),geometryCache=new Map();
export const worldArtSpec={version:1,loaded:false};
export async function loadWorldArt(){
  const loader=new GLTFLoader();
  const config=fetch('assets/models/adventure/world-art-v01.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(s=>{
    if(s.version!==1||s.temples?.length!==6||![s.gate?.levelRadius,s.gate?.blendRadius,s.relief?.maximumHeightDelta,s.routes?.nodeSpacingMetres].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid world art contract');
    Object.assign(worldArtSpec,s,{loaded:true});
  }).catch(e=>console.warn('[world-art] Default scenery:',e.message));
  await Promise.all([config,...['balance','shadow','sift','water','fire','strata','boulders'].map(async id=>{
    const file=id==='boulders'?'field-boulders-v04.glb':`portal-${id}-v01.glb`;
    try{const source=(await loader.loadAsync('assets/models/adventure/'+file)).scene;source.updateMatrixWorld(true);source.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.outlineParameters={visible:false};}});models.set(id,source);}
    catch(e){console.warn('[world-art] '+id+': '+e.message);}
  })]);
}
export function portalPart(id){const found=models.get(id);if(!found)return null;const clone=found.clone(true);clone.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});clone.name='science-portal-'+id;clone.userData.worldArt='portal-'+id+'-v01';return clone;}
export function fieldBoulderPart(variant){
  const key='field_rock_'+variant,source=models.get('boulders')?.getObjectByName(key);if(!source?.isMesh)return null;
  if(!geometryCache.has(key)){const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometryCache.set(key,{geometry,material:source.material});}
  return geometryCache.get(key);
}

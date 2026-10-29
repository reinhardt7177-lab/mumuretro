import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ScreenSizeLOD } from '../render/ScreenSizeLOD.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/water-deity-lod-v01.json').then(async response=>{
  if(!response.ok)throw Error('detail metadata unavailable');
  const spec=await response.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};
}).catch(error=>{pending=null;console.warn('[water-deity] full original retained',error);return null;});}

// Only rendering changes. The original body, halo, interaction and circular
// obstacle remain authored in the same frame; no save or puzzle state is added.
export function addWaterDeityDetail(original){
  const record={loaded:false,lod:null,original,ready:null};
  record.ready=assets().then(asset=>{
    if(!asset)return false;
    const {spec,source}=asset,originalMeshes=[];original.traverse(o=>{if(o.isMesh)originalMeshes.push(o);});
    if(originalMeshes.length!==1||spec.variants?.length!==2||spec.sourceHeight!==3.3||!spec.reuseOriginalPbrMaterial)throw Error('detail source contract');
    const reference=original.children[0],high=originalMeshes[0],levels=[{object:original,maxPixels:Infinity}],parent=original.parent;
    if(!parent||!reference)throw Error('missing original frame');
    for(const variant of spec.variants){
      const part=source.getObjectByName(variant.name);if(!part)throw Error('missing '+variant.name);
      const root=new T.Group();root.name=variant.name;root.position.copy(original.position);root.quaternion.copy(original.quaternion);root.scale.copy(original.scale);
      const normalization=reference.clone(false);root.add(normalization);normalization.add(part.clone(true));
      let triangles=0;root.traverse(o=>{if(!o.isMesh)return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
        if(!o.geometry.attributes.normal||!o.geometry.attributes.uv)throw Error('missing surface attributes');
        o.geometry.deleteAttribute('tangent');o.material=high.material;o.castShadow=high.castShadow;o.receiveShadow=high.receiveShadow;
      });
      if(triangles!==variant.triangles||!(variant.maxPixels>0))throw Error('detail geometry contract');
      levels.push({object:root,maxPixels:variant.maxPixels,hysteresis:variant.hysteresis});
    }
    parent.updateWorldMatrix(true,true);
    const bounds=new T.Box3().setFromObject(original,true).applyMatrix4(new T.Matrix4().copy(parent.matrixWorld).invert());
    const lod=new ScreenSizeLOD(levels,bounds,()=>{const canvas=document.getElementById('c');return canvas&&{width:canvas.width,height:canvas.height};});
    // The new parent is identity. Existing callers keep the original pointer and
    // its unchanged local position, including subsequent halo/drop placement.
    parent.add(lod);record.loaded=true;record.lod=lod;record.spec=spec;return true;
  }).catch(error=>{record.reason=error.message;console.warn('[water-deity] full original retained',error);return false;});
  return record;
}

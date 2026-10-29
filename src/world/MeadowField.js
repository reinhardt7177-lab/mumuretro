import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MEADOW,PATH,GROUND} from '../data/lighting.js';
import {terrainColor} from '../sphere/Planet.js';
import {MEADOW_LAYERS,plantPatchAt,fieldCoverAt} from './MeadowLayers.js';

export const meadowAssets={clusters:[],texture:null,metadata:null,modelLoaded:false,surfaceLoaded:false};
let loading;
export function prepareMeadowUV(geometry){
  const p=geometry.attributes.position,index=geometry.index,count=index?.count||p?.count;
  if(!p||!Number.isInteger(count)||count%3)return false;
  const existing=geometry.getAttribute('meadowUV');
  if(index&&(!existing||existing.itemSize!==3||existing.count!==p.count))return false;
  const values=index?null:new Float32Array(p.count*3);
  const u=new Float64Array(3),v=new Float64Array(3),poles=new Uint8Array(3);
  for(let i=0;i<count;i+=3){
    let minimum=Infinity,maximum=-Infinity;
    for(let k=0;k<3;k++){const vertex=index?index.getX(i+k):i+k,x=p.getX(vertex),y=p.getY(vertex),z=p.getZ(vertex),length=Math.hypot(x,y,z),latitude=Math.max(-1,Math.min(1,y/length));u[k]=Math.atan2(z,x)/(Math.PI*2)+.5;v[k]=Math.asin(latitude)/Math.PI+.5;poles[k]=Math.abs(latitude)>1-1e-10?1:0;if(!poles[k]){minimum=Math.min(minimum,u[k]);maximum=Math.max(maximum,u[k]);}}
    if(maximum-minimum>.5)for(let k=0;k<3;k++)if(u[k]<.5)u[k]+=1;
    for(let k=0;k<3;k++)if(poles[k]){let sum=0,n=0;for(let j=0;j<3;j++)if(!poles[j]){sum+=u[j];n++;}if(!n)return false;u[k]=sum/n;}
    const polar=Math.max(...u)-Math.min(...u)>.5?1:0;
    for(let k=0;k<3;k++){
      if(index){const vertex=index.getX(i+k);if(existing.getX(vertex)!==Math.fround(u[k])||existing.getY(vertex)!==Math.fround(v[k])||existing.getZ(vertex)!==polar)return false;}
      else{values[(i+k)*3]=u[k];values[(i+k)*3+1]=v[k];values[(i+k)*3+2]=polar;}
    }
  }
  // Indexed finalization already preserves every triangle's exact UV corner.
  // A re-call validates it; unsupported indexed inputs fail without mutation.
  if(!index)geometry.setAttribute('meadowUV',new THREE.BufferAttribute(values,3));return true;
}
export function surfaceSignature(planet,first,world){
  const round=x=>Math.round(x*1e6),coords=d=>d.toArray().map(round),heightSamples=[];
  for(let i=0;i<64;i++){const y=1-2*(i+.5)/64,angle=i*2.399963229728653,dir=new THREE.Vector3(Math.sqrt(1-y*y)*Math.cos(angle),y,Math.sqrt(1-y*y)*Math.sin(angle));heightSamples.push(round(planet.heightAt(dir)));}
  const data={plantLayers:MEADOW_LAYERS,plantPatchSource:plantPatchAt.toString(),fieldCoverSource:fieldCoverAt.toString(),terrainContract:planet.terraces?.contract||null,terraceColourSource:planet.terraces?.colorAt.toString().replace(/\r\n/g,'\n')||null,arrivalSupport:planet.arrivalSupport?{height:planet.arrivalSupport.height,inner:planet.arrivalSupport.inner,outer:planet.arrivalSupport.outer}:null,levelSites:planet.levelSites.map(s=>({id:s.id,dir:coords(s.dir),height:round(s.height),inner:s.inner,outer:s.outer})),radius:planet.R,first:first.samples.map(coords),routes:world.routes.map(r=>({id:r.id,dirs:r.dirs.map(coords)})),heightSamples,colourSource:(terrainColor.toString()+'\n'+planet.colorAt.toString()).replace(/\r\n/g,'\n'),palette:{meadow:MEADOW,soil:PATH.soil,ground:GROUND}};
  const text=JSON.stringify(data);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return(hash>>>0).toString(16);
}
export function loadMeadowFieldAssets(){
  return loading??=(async()=>{
    try{
      const response=await fetch('assets/models/adventure/arrival-groundcover-v02.json');if(!response.ok)throw Error('HTTP '+response.status);const meta=await response.json();
      if(meta.version!==1||meta.variants?.length!==4||meta.surface?.width!==1024||meta.surface?.height!==512||typeof meta.routeSignature!=='string')throw Error('Invalid meadow contract');meadowAssets.metadata=meta;
      await Promise.allSettled([
        new GLTFLoader().loadAsync('assets/models/adventure/arrival-groundcover-v02.glb').then(gltf=>{
          gltf.scene.updateMatrixWorld(true);const clusters=[];for(let i=0;i<4;i++){
            const mesh=gltf.scene.getObjectByName('MeadowTuft_'+i);if(!mesh?.isMesh||!mesh.geometry.attributes.uv)throw Error('Missing authored tuft '+i);
            const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),origin=new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);geometry.translate(-origin.x,-origin.y,-origin.z);geometry.computeBoundingBox();geometry.computeBoundingSphere();
            const box=geometry.boundingBox,count=(geometry.index?.count||geometry.attributes.position.count)/3;
            if(Math.abs(box.min.y)>1e-5||Math.abs(box.max.y-meta.variants[i].height)>1e-5||(count!==meta.variants[i].triangles||count>110))throw Error('Tuft dimensions do not match contract');
            const uv=geometry.attributes.uv,positions=geometry.attributes.position,weights=new Float32Array(uv.count);let roots=0,rootV=0;for(let j=0;j<uv.count;j++)if(Math.abs(positions.getY(j))<1e-6){roots++;rootV+=uv.getY(j);}const flipped=roots>0&&rootV/roots>.5;
            const accents=new Float32Array(uv.count);for(let j=0;j<weights.length;j++){weights[j]=THREE.MathUtils.clamp(flipped?1-uv.getY(j):uv.getY(j),0,1);accents[j]=uv.getX(j)>1.5?1:0;}geometry.setAttribute('bendWeight',new THREE.BufferAttribute(weights,1));geometry.setAttribute('plantAccent',new THREE.BufferAttribute(accents,1));geometry.userData.nativeHeight=meta.variants[i].height;clusters.push(geometry);
          }
          meadowAssets.clusters=clusters;meadowAssets.modelLoaded=true;
        }).catch(error=>console.warn('[meadow] Legacy leaves retained:',error.message)),
        new THREE.TextureLoader().loadAsync('assets/models/adventure/arrival-coherent-field-v02.png').then(texture=>{
          if(texture.image.width!==meta.surface.width||texture.image.height!==meta.surface.height)throw Error('Meadow field dimensions differ');
          texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.anisotropy=4;
          meadowAssets.texture=texture;meadowAssets.surfaceLoaded=true;
        }).catch(error=>console.warn('[meadow] Vertex surface retained:',error.message))
      ]);
    }catch(error){console.warn('[meadow] Previous meadow retained:',error.message);}
    return meadowAssets;
  })();
}
export function applyMeadowField(meshes,planet,first,world){
  const signature=world?surfaceSignature(planet,first,world):null,matched=signature===meadowAssets.metadata?.routeSignature,record={loaded:!!meadowAssets.texture&&matched,signature,expected:meadowAssets.metadata?.routeSignature,materials:0};
  if(!record.loaded)return record;
  if(meshes.some(mesh=>!prepareMeadowUV(mesh.geometry))){record.loaded=false;record.reason='unsupported terrain UV topology';return record;}
  for(const[index,mesh]of meshes.entries()){
    const material=mesh.material,previous=material.onBeforeCompile;
    material.onBeforeCompile=shader=>{
      previous?.(shader);shader.uniforms.uMeadowField={value:meadowAssets.texture};
      const rockDeclaration=shader.vertexShader.includes('attribute float aExposedRock;')?'':'attribute float aExposedRock;';
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+rockDeclaration+'\nattribute vec3 meadowUV; varying vec3 vMeadowUV; varying vec3 vMeadowPosition; varying float vMeadowRock;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMeadowUV=meadowUV;vMeadowPosition=position;vMeadowRock=aExposedRock;');
      // The ground stays rigid; wind belongs to the actual authored leaves.
      shader.vertexShader=shader.vertexShader.replace('float gw = aGrass;','float gw = 0.0;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vMeadowUV; varying vec3 vMeadowPosition; varying float vMeadowRock; uniform sampler2D uMeadowField;').replace('#include <color_fragment>',`#include <color_fragment>
        vec2 fieldUV=vMeadowUV.xy;
        if(vMeadowUV.z>.5){vec3 d=normalize(vMeadowPosition);fieldUV=vec2(atan(d.z,d.x)*.15915494309189535+.5,asin(clamp(d.y,-1.,1.))*.3183098861837907+.5);}
        vec3 mumuFieldColour=texture2D(uMeadowField,fieldUV).rgb;
        // The image's finite-difference slope cannot represent narrow rock walls.
        // Retain the actual triangle-slope limestone colour on those faces.
        #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
          diffuseColor.rgb=mix(mumuFieldColour,vColor.rgb,step(.5,vMeadowRock));
        #else
          diffuseColor.rgb=mumuFieldColour;
        #endif`);
    };
    material.customProgramCacheKey=()=> 'mumu-meadow-field-v02-triangle-rock-'+index;material.needsUpdate=true;material.userData.meadowField=signature;record.materials++;
  }
  return record;
}

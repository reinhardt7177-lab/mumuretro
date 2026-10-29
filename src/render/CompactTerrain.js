import * as THREE from 'three';

// Finalization only: authored terrain + colour + per-triangle seam UVs must
// already exist. Exact bytes (including CPU repaint colours) form each key.
export function compactExactTerrain(source,sidecars={}){
  if(source.index||Object.keys(source.morphAttributes).length)throw Error('Expected finalized non-indexed static terrain');
  const count=source.attributes.position?.count;if(!Number.isInteger(count)||count%3)throw Error('Expected static triangle corner list');
  const fields=[];
  for(const[gpu,entries]of[[true,Object.entries(source.attributes)],[false,Object.entries(sidecars)]])for(const[name,attribute]of entries){
    if(attribute.count!==count||attribute.isInterleavedBufferAttribute||attribute.isInstancedBufferAttribute)throw Error('Unsupported terrain field: '+name);
    const array=attribute.array,stride=attribute.itemSize*array.BYTES_PER_ELEMENT;
    fields.push({name,gpu,attribute,array,stride,bytes:new Uint8Array(array.buffer,array.byteOffset,array.byteLength)});
  }
  const same=(a,b)=>fields.every(f=>{const x=a*f.stride,y=b*f.stride;for(let j=0;j<f.stride;j++)if(f.bytes[x+j]!==f.bytes[y+j])return false;return true;});
  const bins=new Map(),representatives=[],indices=new Uint32Array(count),started=performance.now();let collisions=0;
  for(let i=0;i<count;i++){
    let hash=2166136261;for(const f of fields)for(let j=0,offset=i*f.stride;j<f.stride;j++)hash=Math.imul(hash^f.bytes[offset+j],16777619);
    hash>>>=0;let bin=bins.get(hash),found=-1;
    if(bin)for(const candidate of bin){if(same(i,representatives[candidate])){found=candidate;break;}collisions++;}
    if(found<0){found=representatives.length;representatives.push(i);if(bin)bin.push(found);else bins.set(hash,[found]);}indices[i]=found;
  }
  const geometry=new THREE.BufferGeometry(),packedSidecars={};let sourceGpuBytes=0,sourceSidecarBytes=0,packedGpuBytes=0,packedSidecarBytes=0;
  for(const f of fields){
    const array=new f.array.constructor(representatives.length*f.attribute.itemSize),bytes=new Uint8Array(array.buffer);
    for(let j=0;j<representatives.length;j++){const offset=representatives[j]*f.stride;bytes.set(f.bytes.subarray(offset,offset+f.stride),j*f.stride);}
    const attribute=new THREE.BufferAttribute(array,f.attribute.itemSize,f.attribute.normalized);attribute.name=f.attribute.name;attribute.usage=f.attribute.usage;attribute.gpuType=f.attribute.gpuType;
    if(f.gpu){geometry.setAttribute(f.name,attribute);sourceGpuBytes+=f.array.byteLength;packedGpuBytes+=array.byteLength;}
    else{packedSidecars[f.name]=attribute;sourceSidecarBytes+=f.array.byteLength;packedSidecarBytes+=array.byteLength;}
  }
  geometry.setIndex(new THREE.BufferAttribute(representatives.length<=65536?new Uint16Array(indices):indices,1));packedGpuBytes+=geometry.index.array.byteLength;
  for(const g of source.groups)geometry.addGroup(g.start,g.count,g.materialIndex);geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
  geometry.name=source.name;geometry.boundingBox=source.boundingBox?.clone()||null;geometry.boundingSphere=source.boundingSphere?.clone()||null;
  const stats={schema:'mumu.exact-terrain-index.v1',sourceCorners:count,uniqueVertices:representatives.length,triangles:count/3,sourceGpuBytes,packedGpuBytes,sourceSidecarBytes,packedSidecarBytes,hashCollisionsResolved:collisions,buildMs:performance.now()-started};
  geometry.userData={...source.userData,exactTerrainIndex:stats};return{geometry,sidecars:packedSidecars,stats};
}

export function compactPlanetTerrain(planet,carpet,supportsUint32=true){
  // WebGL1 without OES_element_index_uint retains the original triangle lists.
  if(!supportsUint32)return{schema:'mumu.exact-terrain-finalization.v1',skipped:true,reason:'uint32-indices-unsupported'};
  const sourceSoil=planet.mesh.geometry,sourceCarpet=carpet.mesh.geometry;
  if(sourceSoil.userData.exactTerrainIndex&&sourceCarpet.userData.exactTerrainIndex)return{alreadyFinalized:true,soil:sourceSoil.userData.exactTerrainIndex,carpet:sourceCarpet.userData.exactTerrainIndex};
  const sidecars={};if(planet._unpaintedColors){
    if(planet._unpaintedColors.length!==sourceSoil.attributes.position.count*3)throw Error('Terrain repaint cache is stale before finalization');
    sidecars.unpaintedColors=new THREE.BufferAttribute(planet._unpaintedColors,3);
  }
  // Complete both candidates before changing any live references. Repaint cache
  // is included in equality, even when painted GPU colours happen to coincide.
  const soil=compactExactTerrain(sourceSoil,sidecars);let grass;
  try{grass=compactExactTerrain(sourceCarpet);}catch(error){soil.geometry.dispose();throw error;}
  planet._groundIndex?.dispose();planet._groundIndex=null;
  planet.mesh.geometry=soil.geometry;carpet.mesh.geometry=grass.geometry;
  if(sidecars.unpaintedColors)planet._unpaintedColors=soil.sidecars.unpaintedColors.array;
  // Keep tris/coveredPct as their original triangle-corner based statistics.
  sourceSoil.dispose();sourceCarpet.dispose();
  const ground=planet.meshGroundActive?planet.meshGroundIndex().stats:null;
  return{schema:'mumu.exact-terrain-finalization.v1',soil:soil.stats,carpet:grass.stats,ground};
}

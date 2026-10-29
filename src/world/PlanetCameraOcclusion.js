import * as THREE from 'three';

// Broad phase stores actual model bounds. Selected instance proxies share the
// real geometry and world matrix; they are never added to the rendered scene.
export function buildPlanetCameraOcclusion(roots){
  const entries=[],sources=[],seen=new Set(),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
  const solid=m=>m?.isMesh&&m.userData.cameraOccluder!==false&&(Array.isArray(m.material)?m.material:[m.material]).some(a=>!a.transparent&&a.depthWrite!==false);
  for(const root of roots.filter(Boolean)){
    root.updateWorldMatrix(true,true);root.traverse(source=>{
      if(!solid(source)||seen.has(source))return;seen.add(source);
      source.geometry.computeBoundingSphere();const bounds=source.geometry.boundingSphere;
      // Source entries are contiguous in the original query order. Group them
      // so hidden batches and shared ancestry are checked once per query.
      const sourceEntries=[];
      if(source.isInstancedMesh){
        for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);world.multiplyMatrices(source.matrixWorld,matrix);const sphere=bounds.clone().applyMatrix4(world);if(sphere.radius<.25)continue;
          const proxy=new THREE.Mesh(source.geometry,source.material);proxy.matrixAutoUpdate=false;proxy.matrix.copy(world);proxy.matrixWorld.copy(world);proxy.userData.partitionedSolid=true;
          const entry={source,index:i,proxy,sphere};entries.push(entry);sourceEntries.push(entry);
        }
      }else{const sphere=bounds.clone().applyMatrix4(source.matrixWorld);if(sphere.radius>=.25){const entry={source,sphere};entries.push(entry);sourceEntries.push(entry);}}
      if(sourceEntries.length)sources.push({source,entries:sourceEntries});
    });
  }
  const near=[];
  function query(position,distance){
    near.length=0;
    for(const batch of sources){let visible=true;for(let o=batch.source;o;o=o.parent)if(!o.visible){visible=false;break;}
      if(!visible)continue;
      for(const e of batch.entries){
      if(e.index>=e.source.count)continue;
      if(!e.proxy){e.source.updateWorldMatrix(true,false);e.sphere.copy(e.source.geometry.boundingSphere).applyMatrix4(e.source.matrixWorld);}
      if(e.sphere.center.distanceToSquared(position)>Math.pow(distance+e.sphere.radius+2,2))continue;
      if(e.proxy){e.proxy.geometry=e.source.geometry;e.proxy.material=e.source.material;near.push(e.proxy);}else near.push(e.source);
      }
    }
    return near;
  }
  return{query,entries,get count(){return entries.length;}};
}

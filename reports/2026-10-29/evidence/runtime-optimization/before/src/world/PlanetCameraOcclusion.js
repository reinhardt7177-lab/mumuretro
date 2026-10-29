import * as THREE from 'three';

// Broad phase stores actual model bounds. Selected instance proxies share the
// real geometry and world matrix; they are never added to the rendered scene.
export function buildPlanetCameraOcclusion(roots){
  const entries=[],seen=new Set(),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
  const solid=m=>m?.isMesh&&m.userData.cameraOccluder!==false&&(Array.isArray(m.material)?m.material:[m.material]).some(a=>!a.transparent&&a.depthWrite!==false);
  for(const root of roots.filter(Boolean)){
    root.updateWorldMatrix(true,true);root.traverse(source=>{
      if(!solid(source)||seen.has(source))return;seen.add(source);
      source.geometry.computeBoundingSphere();const bounds=source.geometry.boundingSphere;
      if(source.isInstancedMesh){
        for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);world.multiplyMatrices(source.matrixWorld,matrix);const sphere=bounds.clone().applyMatrix4(world);if(sphere.radius<.25)continue;
          const proxy=new THREE.Mesh(source.geometry,source.material);proxy.matrixAutoUpdate=false;proxy.matrix.copy(world);proxy.matrixWorld.copy(world);proxy.userData.partitionedSolid=true;
          entries.push({source,index:i,proxy,sphere});
        }
      }else{const sphere=bounds.clone().applyMatrix4(source.matrixWorld);if(sphere.radius>=.25)entries.push({source,sphere});}
    });
  }
  const near=[];
  function query(position,distance){
    near.length=0;
    for(const e of entries){let visible=true;for(let o=e.source;o;o=o.parent)if(!o.visible){visible=false;break;}
      if(!visible||e.index>=e.source.count)continue;
      if(!e.proxy){e.source.updateWorldMatrix(true,false);e.sphere.copy(e.source.geometry.boundingSphere).applyMatrix4(e.source.matrixWorld);}
      if(e.sphere.center.distanceToSquared(position)>Math.pow(distance+e.sphere.radius+2,2))continue;
      if(e.proxy){e.proxy.geometry=e.source.geometry;e.proxy.material=e.source.material;near.push(e.proxy);}else near.push(e.source);
    }
    return near;
  }
  return{query,entries,get count(){return entries.length;}};
}

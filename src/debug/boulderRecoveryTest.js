import * as THREE from 'three';

// Local saved-position fixtures, independent of the live player's transform.
// Raycasts use the rendered shared GLB geometry, not a collision bounding circle.
export function boulderRecoveryTest({planet,scatter}){
  if(!scatter?.boulders?.rockA)return{pass:true,available:false,reason:'legacy rock geometry'};
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster(),directions=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new THREE.Vector3(x,y,z).normalize());
  const results=[];
  function inside(point,proxy){ray.far=20;ray.set(point,new THREE.Vector3(.742,.317,.590).transformDirection(proxy.matrixWorld));const distances=[];for(const h of ray.intersectObject(proxy,false))if(!distances.some(d=>Math.abs(d-h.distance)<1e-5))distances.push(h.distance);return distances.length%2===1;}
  try{
    for(const c of scatter.colliders){
      if(c.kind!=='rock'||c.height<.90||planet.slopeDegAt(c.dir)>12)continue;
      const part=scatter.boulders[c.geometryKind],proxy=new THREE.Mesh(part.geometry,material);proxy.matrixAutoUpdate=false;proxy.matrix.copy(c.matrix);proxy.updateMatrixWorld(true);
      const foot=planet.surfaceAt(c.dir),up=foot.clone().normalize(),centre=foot.clone().addScaledVector(up,.32);
      if(!inside(centre,proxy))continue;
      const before=foot.clone();scatter.resolve(foot,.32);let penetrations=0,insideAfter=false;
      for(const height of[.32,.82,1.25]){const p=foot.clone().addScaledVector(foot.clone().normalize(),height);insideAfter||=inside(p,proxy);for(const dir of directions){ray.far=.305;ray.set(p,dir);if(ray.intersectObject(proxy,false).length)penetrations++;}}
      results.push({initiallyInside:true,moved:foot.distanceTo(before),insideAfter,penetrations});
      if(results.length===3)break;
    }
  }finally{material.dispose();}
  return{available:true,fixtures:results.length,pass:results.length===3&&results.every(r=>r.moved>.25&&!r.insideAfter&&r.penetrations===0),results};
}

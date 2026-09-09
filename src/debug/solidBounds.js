import * as THREE from 'three';

// 반복 배치 메시도 실제 조각마다 검사한다. 한 묶음의 큰 상자는 조각 사이 허공까지 막힌 것으로 오인한다.
export function solidBounds(scene, ignoredRoot = null) {
  const out = [], local = new THREE.Matrix4(), world = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.sky || o.userData.cameraNonSolid) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (materials.every(m => m.transparent || m.visible === false)) return;
    for (let p = o; p; p = p.parent) if (!p.visible || p === ignoredRoot) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    // Blender에서 재질별로 합친 메시의 조각 사이 빈 공간을 고체로 보지 않는다.
    if (o.userData.partitionedSolid) {
      if (!o.geometry.userData.solidParts) {
        const a=o.geometry.attributes.position, idx=o.geometry.index;
        const parent=Array.from({length:a.count},(_,i)=>i);
        const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
        const join=(i,j)=>{parent[find(i)]=find(j);};
        // glTF의 평면 법선/UV 경계는 같은 꼭짓점을 복제한다. 면별로 나누면
        // 상자 안을 빈 공간으로 오판하므로 위치가 같은 꼭짓점도 먼저 연결한다.
        const positions=new Map();
        for(let i=0;i<a.count;i++){
          const key=[a.getX(i),a.getY(i),a.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
          if(positions.has(key))join(i,positions.get(key));else positions.set(key,i);
        }
        const count=idx?.count??a.count;
        for(let i=0;i<count;i+=3){const u=idx?idx.getX(i):i;join(u,idx?idx.getX(i+1):i+1);join(u,idx?idx.getX(i+2):i+2);}
        const parts=new Map(),v=new THREE.Vector3();
        for(let i=0;i<a.count;i++){const root=find(i);if(!parts.has(root))parts.set(root,new THREE.Box3());parts.get(root).expandByPoint(v.fromBufferAttribute(a,i));}
        o.geometry.userData.solidParts=[...parts.values()];
      }
      for(const box of o.geometry.userData.solidParts)out.push({box:box.clone().applyMatrix4(o.matrixWorld),o});
      return;
    }
    const count = o.isInstancedMesh ? o.count : 1;
    for (let i = 0; i < count; i++) {
      if (o.isInstancedMesh) { o.getMatrixAt(i, local); world.multiplyMatrices(o.matrixWorld, local); }
      else world.copy(o.matrixWorld);
      out.push({ box: o.geometry.boundingBox.clone().applyMatrix4(world), o });
    }
  });
  return out;
}

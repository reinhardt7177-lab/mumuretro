import * as THREE from 'three';

// Short, authored landmarks use their actual triangles, including open rings.
// A three-sphere body capsule moves on the existing planet terrain. Only
// tangential penetration is resolved; the prop does not become a second floor.
export function buildMeshGroundCollider(planet,root,{recoverInterior=false}={}){
  root.updateWorldMatrix(true,true);
  const meshes=[];root.traverse(m=>{if(m.isMesh&&m.geometry&&m.visible){m.geometry.computeBoundingBox();meshes.push(m);}});
  const inverse=new THREE.Matrix4(),local=new THREE.Vector3(),up=new THREE.Vector3(),closest=new THREE.Vector3(),delta=new THREE.Vector3(),worldDelta=new THREE.Vector3(),triangle=new THREE.Triangle();
  const bounds=new THREE.Box3().setFromObject(root),centre=bounds.getCenter(new THREE.Vector3()),broadRadius=bounds.getSize(new THREE.Vector3()).length()*.5+2;
  const api={enabled:true};let totalHits=0;
  const insideRay=new THREE.Ray(),rayDirection=new THREE.Vector3(.742,.317,.590).normalize(),intersection=new THREE.Vector3(),nearest=new THREE.Vector3();
  function resolve(position,radius=.32,footHeight=0){
    if(!api.enabled||position.distanceToSquared(centre)>broadRadius*broadRadius)return 0;
    let hits=0;
    for(let pass=0;pass<2;pass++)for(const mesh of meshes){
      let visible=true;for(let m=mesh;m;m=m.parent)if(!m.visible){visible=false;break;}if(!visible)continue;
      mesh.updateWorldMatrix(true,false);inverse.copy(mesh.matrixWorld).invert();
      const g=mesh.geometry,p=g.attributes.position,index=g.index,count=index?index.count:p.count,scale=mesh.matrixWorld.getMaxScaleOnAxis(),r=radius/scale;
      for(const height of[radius,.82,1.25]){
        up.copy(position).normalize();local.copy(position).addScaledVector(up,footHeight+height).applyMatrix4(inverse);
        if(g.boundingBox.distanceToPoint(local)>r)continue;
        let nearestDistance=Infinity;const crossing=[];
        if(recoverInterior){
          insideRay.set(local,rayDirection);
          for(let i=0;i<count;i+=3){triangle.a.fromBufferAttribute(p,index?index.getX(i):i);triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1);triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2);if(insideRay.intersectTriangle(triangle.a,triangle.b,triangle.c,false,intersection)){const distance=intersection.distanceTo(insideRay.origin);if(!crossing.some(d=>Math.abs(d-distance)<1e-5))crossing.push(distance);}}
        }
        // Decide inside/outside before any pushes: an inside sphere must move
        // toward the surface, while an outside sphere must move away from it.
        // A fully contained sphere otherwise never touches a triangle at all.
        if(recoverInterior&&crossing.length%2===1){
          for(let i=0;i<count;i+=3){triangle.a.fromBufferAttribute(p,index?index.getX(i):i);triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1);triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2);triangle.closestPointToPoint(local,closest);delta.subVectors(closest,local);const distance=delta.length();if(distance<1e-7||distance>=nearestDistance)continue;worldDelta.copy(delta).transformDirection(mesh.matrixWorld);if(Math.abs(worldDelta.dot(up))>.85)continue;nearest.copy(closest);nearestDistance=distance;}
          if(Number.isFinite(nearestDistance)){worldDelta.subVectors(nearest,local).transformDirection(mesh.matrixWorld);worldDelta.addScaledVector(up,-worldDelta.dot(up)).normalize().multiplyScalar(nearestDistance*scale+radius+.002);position.add(worldDelta);planet.projectToSurface(position);hits++;}
          continue;
        }
        for(let i=0;i<count;i+=3){triangle.a.fromBufferAttribute(p,index?index.getX(i):i);triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1);triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
          triangle.closestPointToPoint(local,closest);delta.subVectors(local,closest);const distance=delta.length();if(!Number.isFinite(distance)||distance>=r||distance<1e-7)continue;
          delta.divideScalar(distance);worldDelta.copy(delta).transformDirection(mesh.matrixWorld);
          const vertical=worldDelta.dot(up);if(Math.abs(vertical)>.85)continue;
          worldDelta.addScaledVector(up,-vertical).normalize().multiplyScalar((r-distance)*scale+.0005);
          position.add(worldDelta);planet.projectToSurface(position);hits++;
          local.copy(position).addScaledVector(up,footHeight+height).applyMatrix4(inverse);
        }
      }
    }
    totalHits+=hits;return hits;
  }
  return{resolve,collision:api,meshes,get totalHits(){return totalHits;}};
}

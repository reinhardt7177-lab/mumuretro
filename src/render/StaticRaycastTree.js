import * as T from 'three';

// A local triangle BVH for static authored meshes. It changes search order,
// never geometry, collision silhouettes, material sides or near/far limits.
const cache=new WeakMap();
const installed=new WeakMap();
export function staticRaycastBounds(mesh){
  const record=installed.get(mesh);
  return record&&record.all===mesh.raycast&&record.any===mesh.raycastAny?treeFor(mesh.geometry).root.box:null;
}
const booleanHits=[];
// Visibility needs one valid hit, not sorted distances/UVs from every object.
// Unregistered meshes retain their normal Three.js raycast implementation.
export function hasRayHit(raycaster,meshes){
  if(meshes.rayQuery)return meshes.rayQuery.any(raycaster);
  for(const mesh of meshes){
    if(!raycaster.layers.test(mesh.layers))continue;
    if(mesh.raycastAny){if(mesh.raycastAny(raycaster))return true;}
    else{booleanHits.length=0;mesh.raycast(raycaster,booleanHits);if(booleanHits.length)return true;}
  }
  return false;
}
function treeFor(geometry){
  const p=geometry.attributes.position,index=geometry.index,old=cache.get(geometry);
  const positionArray=p.array||p.data?.array,indexArray=index?.array;
  if(old&&old.p===p&&old.index===index&&old.positionArray===positionArray&&old.indexArray===indexArray&&old.positionCount===p.count&&old.indexCount===index?.count&&old.positionVersion===p.version&&old.indexVersion===index?.version)return old;
  const count=Math.floor((index?index.count:p.count)/3),ids=new Uint32Array(count),centres=new Float32Array(count*3),bounds=new Float32Array(count*6);
  const vertex=new T.Vector3(),box=new T.Box3();
  for(let i=0;i<count;i++){
    ids[i]=i;box.makeEmpty();for(let k=0;k<3;k++){vertex.fromBufferAttribute(p,index?index.getX(i*3+k):i*3+k);box.expandByPoint(vertex);}
    bounds.set([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z],i*6);box.getCenter(vertex);centres.set(vertex.toArray(),i*3);
  }
  let nodes=0;
  function build(from,to){
    const b=new T.Box3(),c=new T.Box3();b.makeEmpty();c.makeEmpty();
    for(let k=from;k<to;k++){const i=ids[k];vertex.fromArray(bounds,i*6);b.expandByPoint(vertex);vertex.fromArray(bounds,i*6+3);b.expandByPoint(vertex);vertex.fromArray(centres,i*3);c.expandByPoint(vertex);}
    const node={box:b,from,to};nodes++;if(to-from<=12)return node;
    const size=c.getSize(vertex),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2;if(size.getComponent(axis)<1e-8)return node;
    ids.subarray(from,to).sort((a,b)=>centres[a*3+axis]-centres[b*3+axis]);const middle=(from+to)>>1;node.left=build(from,middle);node.right=build(middle,to);return node;
  }
  const tree={root:build(0,count),ids,p,index,triangles:count,nodes,positionArray,indexArray,positionCount:p.count,indexCount:index?.count,positionVersion:p.version,indexVersion:index?.version};cache.set(geometry,tree);return tree;
}

export function installStaticRaycastTree(mesh){
  if(!mesh.geometry?.attributes.position||Array.isArray(mesh.material))return false;
  const original=mesh.raycast,instance=new T.Matrix4(),localRay=new T.Ray(),transforms=[];
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),worldHit=new T.Vector3(),boxHit=new T.Vector3(),bary=new T.Vector3();
  const uvA=new T.Vector2(),uvB=new T.Vector2(),uvC=new T.Vector2(),stack=[],rawHits=[];
  const stats=mesh.userData.staticRaycastTree={triangles:treeFor(mesh.geometry).triangles,nodes:treeFor(mesh.geometry).nodes,queries:0,triangleTests:0,rawQueries:0,anyQueries:0,anyTriangleTests:0,matrixBuilds:0};
  function query(raycaster,intersections,firstOnly=false){
    if(this.userData.disableRaycastTree){stats.rawQueries++;if(!firstOnly)return original.call(this,raycaster,intersections);original.call(this,raycaster,intersections);return intersections.length>0;}
    if(firstOnly)stats.anyQueries++;
    stats.queries++;const tree=treeFor(this.geometry),count=this.isInstancedMesh?this.count:1,material=this.material,near=raycaster.near,far=raycaster.far;
    const start=this.geometry.drawRange.start,end=start+this.geometry.drawRange.count,uv=this.geometry.attributes.uv;
    for(let id=0;id<count;id++){
      if(this.isInstancedMesh)this.getMatrixAt(id,instance);
      const transform=transforms[id]??={valid:false,parent:new T.Matrix4(),instance:new T.Matrix4(),world:new T.Matrix4(),inverse:new T.Matrix4()},world=transform.world,inverse=transform.inverse;
      // Compare actual matrix elements, including edits without a GPU update flag.
      // No time/position tolerance: any changed transform rebuilds immediately.
      if(!transform.valid||!transform.parent.equals(this.matrixWorld)||(this.isInstancedMesh&&!transform.instance.equals(instance))){
        transform.parent.copy(this.matrixWorld);transform.instance.copy(instance);
        if(this.isInstancedMesh)world.multiplyMatrices(this.matrixWorld,instance);else world.copy(this.matrixWorld);
        inverse.copy(world).invert();transform.valid=true;stats.matrixBuilds++;
      }
      localRay.copy(raycaster.ray).applyMatrix4(inverse);stack.length=0;stack.push(tree.root);
      while(stack.length){const node=stack.pop();if(!localRay.intersectBox(node.box,boxHit))continue;
        // An origin inside a node may hit triangles before the box exit.
        if(!node.box.containsPoint(localRay.origin)&&boxHit.applyMatrix4(world).distanceToSquared(raycaster.ray.origin)>far*far)continue;
        if(node.left){stack.push(node.left,node.right);continue;}
        for(let k=node.from;k<node.to;k++){
          const triangle=tree.ids[k],offset=triangle*3;if(offset<start||offset+2>=end)continue;
          const ai=tree.index?tree.index.getX(offset):offset,bi=tree.index?tree.index.getX(offset+1):offset+1,ci=tree.index?tree.index.getX(offset+2):offset+2;
          a.fromBufferAttribute(tree.p,ai);b.fromBufferAttribute(tree.p,bi);c.fromBufferAttribute(tree.p,ci);stats.triangleTests++;
          if(firstOnly)stats.anyTriangleTests++;
          const found=material.side===T.BackSide?localRay.intersectTriangle(c,b,a,true,hit):localRay.intersectTriangle(a,b,c,material.side!==T.DoubleSide,hit);if(!found)continue;
          worldHit.copy(hit).applyMatrix4(world);const distance=worldHit.distanceTo(raycaster.ray.origin);if(distance<near||distance>far)continue;
          if(firstOnly)return true;
          const result={distance,point:worldHit.clone(),object:this,faceIndex:triangle,face:{a:ai,b:bi,c:ci,normal:T.Triangle.getNormal(a,b,c,new T.Vector3()),materialIndex:0}};
          if(this.isInstancedMesh)result.instanceId=id;
          if(uv){T.Triangle.getBarycoord(hit,a,b,c,bary);uvA.fromBufferAttribute(uv,ai);uvB.fromBufferAttribute(uv,bi);uvC.fromBufferAttribute(uv,ci);result.uv=uvA.multiplyScalar(bary.x).addScaledVector(uvB,bary.y).addScaledVector(uvC,bary.z).clone();}
          intersections.push(result);
        }
      }
    }
    return false;
  }
  mesh.raycast=function(raycaster,intersections){return query.call(this,raycaster,intersections);};
  mesh.raycastAny=function(raycaster){rawHits.length=0;return query.call(this,raycaster,rawHits,true);};installed.set(mesh,{all:mesh.raycast,any:mesh.raycastAny});return true;
}

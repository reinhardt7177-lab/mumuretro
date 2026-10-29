import * as T from 'three';
import { staticRaycastBounds } from './StaticRaycastTree.js';
import { RayBoxRange } from './RayBoxRange.js';

const PAD=1e-6;
const finiteBox=b=>!b.isEmpty()&&[...b.min.toArray(),...b.max.toArray()].every(Number.isFinite);

// A conservative world-space broad phase for one camera update. It never
// replaces the actual mesh/triangle query that decides visibility or distance.
export class SceneRayQuery {
  constructor(){
    this.entries=[];this.root=null;this.fallback=[];this.geometryBounds=new WeakMap();this.frame=0;this.epoch=0;
    this.stack=[];this.candidates=[];this.hits=[];this.point=new T.Vector3();this.matrix=new T.Matrix4();this.instance=new T.Matrix4();
    this.boxRange=new RayBoxRange();
    this.stats={frames:0,rebuilds:0,refits:0,worldBoxes:0,queries:0,nodeTests:0,meshTests:0,leaves:0,fallback:0,closestQueries:0};
  }
  update(meshes){
    const stats=this.stats;stats.frames++;this.frame++;let topology=meshes.length!==this.entries.length||meshes.some((m,i)=>this.entries[i]?.mesh!==m),changed=false;
    if(topology)this.entries=meshes.map((mesh,order)=>({mesh,order,leaves:[],kind:null,localBox:new T.Box3(),sphere:new T.Sphere(),seen:0}));
    this.fallback=[];
    for(const e of this.entries){
      const mesh=e.mesh,g=mesh.geometry,p=g?.attributes.position,tree=staticRaycastBounds(mesh);
      const standard=mesh.isInstancedMesh?mesh.raycast===T.InstancedMesh.prototype.raycast:mesh.raycast===T.Mesh.prototype.raycast;
      const supported=mesh.isMesh&&!mesh.isSkinnedMesh&&!g?.morphAttributes?.position?.length&&p&&!p.isGLBufferAttribute&&(tree||standard&&!mesh.raycastAny&&mesh.getVertexPosition===T.Mesh.prototype.getVertexPosition);
      let kind='fallback',box=null,sphere=null;
      if(supported){
        if(tree){kind='box';box=tree;}
        else if(p.count<=1024){
          let local=this.geometryBounds.get(g);if(!local){local={frame:-1,box:new T.Box3()};this.geometryBounds.set(g,local);}
          // Small raw meshes are cheap to inspect once per camera update and
          // remain correct even when CPU vertices were edited without a flag.
          if(local.frame!==this.frame){local.box.setFromBufferAttribute(p);local.frame=this.frame;}kind='box';box=local.box;
        }else{
          // A raw Mesh raycast already requires this local sphere. Its world
          // AABB is conservative, including when vertices change without flags.
          if(g.boundingSphere===null)g.computeBoundingSphere();sphere=g.boundingSphere;
          if(sphere&&Number.isFinite(sphere.radius)&&sphere.radius>=0&&sphere.center.toArray().every(Number.isFinite))kind='sphere';
        }
        if(kind==='box'&&!finiteBox(box))kind='fallback';
      }
      const count=mesh.isInstancedMesh?mesh.count:1;
      if(!Number.isInteger(count)||count<0||mesh.isInstancedMesh&&count>mesh.instanceMatrix.count)kind='fallback';
      if(kind==='fallback'){
        if(e.kind!=='fallback'||e.leaves.length)topology=true;e.kind=kind;e.leaves=[];this.fallback.push(e);continue;
      }
      const localChanged=e.kind!==kind||(kind==='box'?!e.localBox.equals(box):!e.sphere.equals(sphere));
      if(e.kind!==kind||e.leaves.length!==count){topology=true;e.leaves=Array.from({length:count},()=>({entry:e,box:new T.Box3(),parent:new T.Matrix4(),instance:new T.Matrix4(),valid:false}));}
      e.kind=kind;if(kind==='box')e.localBox.copy(box);else e.sphere.copy(sphere);
      for(let i=0;i<count;i++){
        const leaf=e.leaves[i];if(mesh.isInstancedMesh)mesh.getMatrixAt(i,this.instance);
        if(!leaf.valid||localChanged||!leaf.parent.equals(mesh.matrixWorld)||(mesh.isInstancedMesh&&!leaf.instance.equals(this.instance))){
          leaf.parent.copy(mesh.matrixWorld);leaf.instance.copy(this.instance);
          if(mesh.isInstancedMesh)this.matrix.multiplyMatrices(mesh.matrixWorld,this.instance);else this.matrix.copy(mesh.matrixWorld);
          if(kind==='box')leaf.box.copy(e.localBox).applyMatrix4(this.matrix);else e.sphere.clone().applyMatrix4(this.matrix).getBoundingBox(leaf.box);
          leaf.box.expandByScalar(PAD);leaf.valid=true;changed=true;stats.worldBoxes++;
        }
      }
    }
    if(topology){const leaves=this.entries.flatMap(e=>e.leaves);stats.leaves=leaves.length;this.root=this.build(leaves);stats.rebuilds++;}
    else if(changed&&this.root){this.refit(this.root);stats.refits++;}
    stats.fallback=this.fallback.length;return this;
  }
  build(leaves){
    if(!leaves.length)return null;const box=new T.Box3();for(const leaf of leaves)box.union(leaf.box);
    if(leaves.length<=4)return{box,leaves};const size=box.getSize(new T.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
    leaves.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const middle=leaves.length>>1;
    return{box,left:this.build(leaves.slice(0,middle)),right:this.build(leaves.slice(middle))};
  }
  refit(node){node.box.makeEmpty();if(node.leaves)for(const leaf of node.leaves)node.box.union(leaf.box);else{this.refit(node.left);this.refit(node.right);node.box.union(node.left.box).union(node.right.box);}}
  intersects(raycaster,box){
    this.stats.nodeTests++;
    if(this.boxRange.valid)return this.boxRange.intersects(box);
    if(!raycaster.ray.intersectBox(box,this.point))return false;
    return box.containsPoint(raycaster.ray.origin)||this.point.distanceToSquared(raycaster.ray.origin)<=raycaster.far*raycaster.far;
  }
  testAny(raycaster,e){
    const mesh=e.mesh;if(!raycaster.layers.test(mesh.layers))return false;this.stats.meshTests++;
    let hit;
    if(mesh.raycastAny)hit=mesh.raycastAny(raycaster);
    else{this.hits.length=0;mesh.raycast(raycaster,this.hits);hit=this.hits.length>0;}
    // A custom query may edit the shared caster even on a miss. Refresh for
    // subsequent candidates, while preparing once rather than at every node.
    if(!hit)this.boxRange.set(raycaster.ray,raycaster.far);
    return hit;
  }
  any(raycaster){
    this.boxRange.set(raycaster.ray,raycaster.far);
    this.stats.queries++;const stamp=++this.epoch;for(const e of this.fallback){e.seen=stamp;if(this.testAny(raycaster,e))return true;}
    const stack=this.stack;stack.length=0;if(this.root)stack.push(this.root);
    while(stack.length){const node=stack.pop();if(!this.intersects(raycaster,node.box))continue;if(!node.leaves){stack.push(node.left,node.right);continue;}
      for(const leaf of node.leaves){const e=leaf.entry;if(e.seen===stamp||!this.intersects(raycaster,leaf.box))continue;e.seen=stamp;if(this.testAny(raycaster,e))return true;}}
    return false;
  }
  all(raycaster,target=[]){
    this.boxRange.set(raycaster.ray,raycaster.far);
    this.stats.queries++;const stamp=++this.epoch,candidates=this.candidates,stack=this.stack;candidates.length=0;stack.length=0;
    for(const e of this.fallback){e.seen=stamp;candidates.push(e);}if(this.root)stack.push(this.root);
    while(stack.length){const node=stack.pop();if(!this.intersects(raycaster,node.box))continue;if(!node.leaves){stack.push(node.left,node.right);continue;}
      for(const leaf of node.leaves){const e=leaf.entry;if(e.seen===stamp||!this.intersects(raycaster,leaf.box))continue;e.seen=stamp;candidates.push(e);}}
    // Preserve original object order before the stable distance sort, including
    // duplicates and equal-distance faces. Each instance group is queried once.
    candidates.sort((a,b)=>a.order-b.order);for(const e of candidates)if(raycaster.layers.test(e.mesh.layers)){this.stats.meshTests++;e.mesh.raycast(raycaster,target);}
    target.sort((a,b)=>a.distance-b.distance);return target;
  }
  closest(raycaster){
    this.stats.closestQueries++;this.boxRange.set(raycaster.ray,raycaster.far);
    // Custom/deformed queries may have side effects or unconventional results.
    // Preserve their existing complete query and stable ordering verbatim.
    if(this.fallback.length||!this.boxRange.valid)return this.all(raycaster)[0];
    this.stats.queries++;const stamp=++this.epoch,stack=this.stack;stack.length=0;if(this.root)stack.push(this.root);
    let nearest,nearestOrder=Infinity;
    while(stack.length){
      const node=stack.pop();if(!this.intersects(raycaster,node.box))continue;
      if(!node.leaves){stack.push(node.left,node.right);continue;}
      for(const leaf of node.leaves){
        const e=leaf.entry;if(e.seen===stamp||!this.intersects(raycaster,leaf.box))continue;e.seen=stamp;
        if(!raycaster.layers.test(e.mesh.layers))continue;
        this.stats.meshTests++;this.hits.length=0;e.mesh.raycast(raycaster,this.hits);
        // This retains the original full-query winner, including equal-distance
        // object order and the mesh's own first equal-distance triangle.
        for(const hit of this.hits)if(!nearest||hit.distance<nearest.distance||hit.distance===nearest.distance&&e.order<nearestOrder){
          nearest=hit;nearestOrder=e.order;this.boxRange.set(raycaster.ray,Math.min(raycaster.far,hit.distance));
        }
      }
    }
    return nearest;
  }
}

import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

let pending;
const meshes=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
function assets(){return pending??=fetch('assets/models/adventure/chronicle-court-v01.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(error=>{console.warn('[chronicle-court] original hall retained',error);return null;});}

// The memory court surrounds the existing guardian. Marks, offering order,
// live rings, awakening and version-one progress remain the original device.
export function registerChronicleCourt(room){
  if(room.spec.id!=='strata')return room;
  const record=room.chronicleCourt={loaded:false,models:[],colliders:[],cameraMeshes:[],ready:null,floorInlays:[]};
  const resume=room.resume.bind(room);room.resume=a=>{const result=resume(a);record.actor=a;record.reconcileActor?.();return result;};
  record.ready=Promise.all([assets(),room.ready,room.final.heritagePromise]).then(([asset])=>{
    if(!asset){record.reason='optional asset unavailable';return false;}
    const{spec,source}=asset,parts={};source.updateMatrixWorld(true);
    for(const name of ['MemoryArcade','MemoryFloor','OfferingPedestal']){parts[name]=source.getObjectByName(name);if(!parts[name]){record.reason='missing part '+name;return false;}}
    const seg=room.shrineSeg,f=room.final,contract=spec.contract,b=new T.Box3().setFromObject(parts.MemoryFloor,true),altarBox=new T.Box3().setFromObject(parts.OfferingPedestal,true);
    let oldFloor;const oldDecor=[];room.scene.traverse(o=>{if(o.userData.openFieldFloor==='shrine')oldFloor=o;if(o.userData.openFieldSanctum==='shrine'||o.userData.openFieldFloorMark==='shrine')oldDecor.push(o);});
    const bases=f.altars.map(a=>f.group.children.find(o=>o.isMesh&&o.geometry.type==='CylinderGeometry'&&Math.abs(o.geometry.parameters.height-1.2)<1e-6&&Math.abs(o.position.x-a.x)<1e-6&&Math.abs(o.position.z-a.z)<1e-6));
    if(!oldFloor||bases.some(o=>!o)||!contract||['x0','x1','z0','z1'].some(k=>contract.seg[k]!==seg[k])||Math.abs(contract.gz-f.gz)>.001||Math.abs(b.min.y+.2)>.001||Math.abs(b.max.y-.002)>.001||Math.abs(altarBox.min.y)>.001||Math.abs(altarBox.max.y-1.2)>.001||!spec.parts.MemoryArcade.solids?.length){record.reason='floor,altar or spatial contract';return false;}
    const floorY=oldFloor.position.y;
    record.oldFloor=oldFloor;record.oldBases=bases;record.oldDecor=oldDecor;record.spec=spec;
    record.retainLegacy=()=>{[...bases,...oldDecor].forEach(o=>o.visible=false);oldFloor.position.y=floorY-.12;record.floorInlays.forEach(m=>m.geometry.setDrawRange(0,0));};
    function add(name,x,z){const root=parts[name].clone(true);root.name='Memory court '+name;root.position.set(x,0,z);room.scene.add(root);record.models.push(root);for(const m of meshes(root)){m.material=m.material.clone();m.material.envMapIntensity=.7;m.material.userData.outlineParameters={visible:false};m.receiveShadow=true;m.castShadow=name!=='MemoryFloor'&&!/brass/.test(m.material.name);if(name!=='MemoryFloor'){m.updateWorldMatrix(true,false);installStaticRaycastTree(m);record.cameraMeshes.push(m);}}return root;}
    record.arcade=add('MemoryArcade',0,f.gz);record.floor=add('MemoryFloor',0,(seg.z0+seg.z1)/2);record.altars=f.altars.map(a=>({altar:a,root:add('OfferingPedestal',a.x,a.z)}));
    // Remove the decorative circles/radial lines; retain the authored stone
    // floor, gameplay altar signals and optional golden navigation particles.
    record.floorInlays=meshes(record.floor).filter(m=>/brass/.test(m.material.name));
    record.floorInlays.forEach(m=>{m.geometry=m.geometry.clone();m.geometry.setDrawRange(0,0);});
    for(const v of spec.parts.MemoryArcade.solids){const[x,y,z]=v.position,[w,h,d]=v.size;record.colliders.push({shape:'box',x,z:z+f.gz,x0:x-w/2,x1:x+w/2,z0:z+f.gz-d/2,z1:z+f.gz+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:-Math.sign(x),chronicleCourt:true});}
    for(const a of f.altars)record.colliders.push({x:a.x,z:a.z,r:spec.parts.OfferingPedestal.radius+.28,minY:0,maxY:1.2,escapeX:0,escapeZ:1,chronicleCourt:true});
    room.obstacles.push(...record.colliders);
    const rects=room.dungeon.rects,oldMeshes=new Set([...bases,...oldDecor].flatMap(meshes));rects.cameraOccluders=(rects.cameraOccluders||[]).filter(m=>!oldMeshes.has(m));rects.cameraOccluders.push(...record.cameraMeshes);
    const floorAt=rects.floorAt?.bind(rects);rects.floorAt=(x,z,y=0)=>{let h=floorAt?.(x,z,y)??0;for(const a of f.altars)if(y+.26>=1.2&&Math.hypot(x-a.x,z-a.z)<=.94)h=Math.max(h,1.2);return h;};
    const sync=f.syncArt;f.syncArt=()=>{sync?.();record.retainLegacy();};
    record.reconcileActor=()=>{const a=record.actor;if(a?.rects!==rects)return;const before=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(before)>1e-6){a.syncMesh();a._camPlaced=false;record.safeShift=a.position.distanceTo(before);}};
    record.retainLegacy();record.loaded=true;record.reconcileActor();return true;
  }).catch(error=>{record.reason=error.message;console.warn('[chronicle-court] original hall retained',error);return false;});
  room.ready=Promise.all([room.ready,record.ready]);return room;
}

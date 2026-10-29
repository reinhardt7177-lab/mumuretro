import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

// Our passage dimensions/timing, not measured Nintendo constants. The physical
// mechanism also works with the legacy stone slabs if the optional GLB fails.
const MOTION={travel:3.45,duration:1.35,clearance:2.70,height:4.96,halfWidth:4.4,halfDepth:.34,pulleyY:8.30,anchorY:4.70,weightBase:6.30,weightHeight:1.35,cableX:4.28,frontZ:.30,backZ:-.50};
let pending;
function assets(){return pending??=fetch('assets/models/adventure/chronicle-portal-v01.json').then(async r=>{if(!r.ok)throw Error('Portal manifest unavailable');const spec=await r.json();return{spec,source:(await new GLTFLoader().loadAsync(spec.model)).scene};}).catch(e=>{console.warn('[strata-portal] legacy lifting wall retained',e);return null;});}
const near=(a,b)=>Math.abs(a-b)<1e-5;

export function registerStrataPortal(room){
  if(room.spec.id!=='strata')return room;
  const entry=room.gates[0],g=entry.gate,d=room.dungeon.doors.r1,rects=room.dungeon.rects,z=g.seg.z0+.5;
  const bands=g.slots.map(s=>g.group.children.find(o=>o.isMesh&&o.geometry.type==='BoxGeometry'&&near(o.geometry.parameters.height,1.12)&&near(o.position.y,s.y)&&near(o.position.z,z)));
  const holes=g.slots.map(s=>g.group.children.find(o=>o.isMesh&&o.geometry.type==='TorusGeometry'&&near(o.position.y,s.y)&&near(o.position.z,z+.22)));
  const links=g.group.children.filter(o=>o.isMesh&&o.geometry.type==='BoxGeometry'&&near(o.geometry.parameters.width,.07)&&near(o.geometry.parameters.depth,.07));
  if(bands.some(o=>!o)||holes.some(o=>!o)||links.length!==4)throw Error('Strata portal legacy contract changed');
  const r=room.strataPortal={loaded:false,progress:0,lift:0,requested:false,models:[],cameraMeshes:[],colliders:[],bands,holes,links,config:{...MOTION},restoring:false,ready:null};
  const collider=r.dynamic={shape:'box',x0:-4.4,x1:4.4,z0:z-.34,z1:z+.34,minY:0,maxY:5,padding:.28,escapeZ:1,strataPortal:true};
  room.obstacles.push(collider);
  // Fill the old 39cm floating gap even in the no-download fallback.
  const sill=new T.Mesh(new T.BoxGeometry(8.8,.39,.3),bands[0].material);sill.position.set(0,.195,z);sill.castShadow=true;sill.receiveShadow=true;room.scene.add(sill);r.fallbackSill=sill;
  const legacyMeshes=[...bands,...holes,sill];(rects.cameraOccluders??=[]).push(...legacyMeshes);
  const previousCeiling=rects.ceilingAt?.bind(rects);
  rects.ceilingAt=(x,pz,y=0)=>{let h=previousCeiling?.(x,pz,y)??Infinity;if(x>=collider.x0-.25&&x<=collider.x1+.25&&pz>=collider.z0-.25&&pz<=collider.z1+.25&&y<collider.maxY)h=Math.min(h,collider.minY);return h;};
  const complete=()=>!!(g.solved||entry.solved||room.legacyCompleted);
  r.applyPose=()=>{
    const m=r.config,e=r.progress*r.progress*(3-2*r.progress);r.lift=e*m.travel;
    collider.minY=r.lift;collider.maxY=r.lift+5;
    for(let i=0;i<4;i++){
      const slot=g.slots[i];bands[i].position.y=slot.y+r.lift;holes[i].position.y=slot.y+r.lift;
      // The original unlit neon rings flatten the carved fossils. Keep the
      // correct/wrong/empty feedback, but use the authored brass palette.
      if(r.loaded)slot.holeMat.color.set(slot.got?(slot.got.level===slot.level?0xb59966:0xe0736b):0x806b91);
    }
    sill.position.y=.195+r.lift;
    for(const f of g.fossils)if(f.slot)f.mesh.position.set(f.slot.x,f.slot.y+r.lift,f.slot.z-.2);
    for(const line of links)line.geometry.setDrawRange(0,r.requested?0:Infinity);
    if(r.wall)r.wall.position.y=r.lift;
    for(const root of r.weights||[])root.position.y=m.weightBase-r.lift;
    for(let i=0;i<(r.cables?.length||0);i++){const root=r.cables[i],base=i<2?m.anchorY+r.lift:m.weightBase+m.weightHeight-r.lift;root.position.y=base;root.scale.y=m.pulleyY-base;}
    // Opened is the semantic success signal. Traversability waits only until
    // the visible slab has cleared the player's full jump envelope.
    d.rect.open=!!d.opened&&r.lift>=m.clearance-1e-6;
    r.wall?.updateWorldMatrix(true,true);for(const root of r.weights||[])root.updateWorldMatrix(true,true);for(const root of r.cables||[])root.updateWorldMatrix(true,true);
  };
  r.reconcileActor=()=>{const a=r.actor;if(!a||a.rects!==rects)return;const before=a.position.clone();a._pushOut(a.position);if(a.position.distanceTo(before)>1e-6){a.syncMesh();a._camPlaced=false;r.safeShift=a.position.distanceTo(before);}};
  r.snap=()=>{r.requested=complete()||!!d.opened;r.progress=r.requested?1:0;r.applyPose();r.reconcileActor();};
  const open=room.dungeon.openDoor.bind(room.dungeon);room.dungeon.openDoor=id=>{const changed=open(id);if(id==='r1'){r.requested=true;if(r.restoring)r.progress=1;r.applyPose();}return changed;};
  const reset=room.dungeon.resetDoors.bind(room.dungeon);room.dungeon.resetDoors=()=>{const result=reset();r.requested=false;r.progress=0;r.applyPose();r.reconcileActor();return result;};
  const advance=room.updateArchitecture?.bind(room);room.updateArchitecture=(dt,actor)=>{advance?.(dt,actor);r.actor=actor;r.requested=r.requested||complete();if(r.requested)r.progress=Math.min(1,r.progress+Math.max(0,dt)/r.config.duration);r.applyPose();};
  for(const name of ['importState','restart','finishLegacy']){
    const previous=room[name]?.bind(room);if(!previous)continue;
    room[name]=(...args)=>{r.restoring=true;let result;try{result=previous(...args);}finally{r.restoring=false;}if(name!=='importState'||result)r.snap();return result;};
  }
  const resume=room.resume.bind(room);room.resume=a=>{r.actor=a;const result=resume(a);r.snap();return result;};
  r.applyPose();

  r.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    if(!asset){r.reason='optional portal asset unavailable';return false;}
    const{source,spec}=asset,parts={};source.updateMatrixWorld(true);
    for(const name of ['PortalFrame','LayerWall','CounterWeight','HoistCable']){const part=source.getObjectByName(name);if(!part)throw Error('Missing '+name);parts[name]=part;if(Math.abs(new T.Box3().setFromObject(part,true).min.y)>.001)throw Error('Unseated '+name);}
    for(const key of Object.keys(MOTION))if(!near(spec.motion[key],MOTION[key]))throw Error('Portal motion contract '+key);
    const wallBox=new T.Box3().setFromObject(parts.LayerWall,true);if(Math.abs(wallBox.max.y-4.96)>.001||Math.abs(wallBox.max.x-4.4)>.001||wallBox.max.z>.34)throw Error('Wall size contract');
    if(!spec.parts.PortalFrame.solids?.length)throw Error('Missing frame solids');
    r.spec=spec;
    function add(name,x,y,pz){const root=parts[name].clone(true);root.name='Strata portal '+name;root.position.set(x,y,pz);root.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.envMapIntensity=.7;o.material.userData.outlineParameters={visible:false};o.castShadow=name!=='HoistCable';o.receiveShadow=true;if(name!=='HoistCable'){installStaticRaycastTree(o);r.cameraMeshes.push(o);}});room.scene.add(root);r.models.push(root);return root;}
    r.frame=add('PortalFrame',0,0,z);r.wall=add('LayerWall',0,r.lift,z);
    r.weights=[-1,1].map(side=>add('CounterWeight',side*MOTION.cableX,MOTION.weightBase-r.lift,z+MOTION.backZ));
    r.cables=[-1,1].map(side=>add('HoistCable',side*MOTION.cableX,0,z+MOTION.frontZ)).concat([-1,1].map(side=>add('HoistCable',side*MOTION.cableX,0,z+MOTION.backZ)));
    for(const s of spec.parts.PortalFrame.solids){const[x,y,pz]=s.position,[w,h,depth]=s.size;r.colliders.push({shape:'box',x0:x-w/2,x1:x+w/2,z0:z+pz-depth/2,z1:z+pz+depth/2,minY:y-h/2,maxY:y+h/2,padding:.28,strataPortalFrame:true});}
    // Remove the preceding short art frame and its exact registered surfaces;
    // mutate the body's shared array rather than leaving the active actor stale.
    const evidence=room.evidenceArt,oldCamera=new Set();
    if(evidence?.loaded){
      evidence.wall.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.geometry.setDrawRange(0,0);oldCamera.add(o);}});
      const oldSolids=new Set(evidence.colliders.filter(c=>c.z0<z+1&&c.z1>z-1));evidence.colliders=evidence.colliders.filter(c=>!oldSolids.has(c));
      room.obstacles.splice(0,room.obstacles.length,...room.obstacles.filter(c=>!oldSolids.has(c)));
      evidence.cameraMeshes=evidence.cameraMeshes.filter(o=>!oldCamera.has(o));
    }
    for(const o of room.scene.children)if(o.userData.doorFrame==='r1'){o.geometry.setDrawRange(0,0);oldCamera.add(o);}
    // The stone slab is the visible barrier from both sides. Keep the old
    // door node for saves, but remove its obsolete purple surface permanently.
    d.mesh.geometry=d.mesh.geometry.clone();d.mesh.geometry.setDrawRange(0,0);
    for(const o of [...bands,sill])o.geometry.setDrawRange(0,0);
    rects.cameraOccluders=(rects.cameraOccluders||[]).filter(o=>!oldCamera.has(o));rects.cameraOccluders.push(...r.cameraMeshes);
    room.obstacles.push(...r.colliders);
    const floor=rects.floorAt?.bind(rects);rects.floorAt=(x,pz,y=0)=>{let h=floor?.(x,pz,y)??0;for(const s of r.colliders)if(x>=s.x0&&x<=s.x1&&pz>=s.z0&&pz<=s.z1&&y+.26>=s.maxY)h=Math.max(h,s.maxY);return h;};
    r.loaded=true;r.applyPose();r.reconcileActor();return true;
  }).catch(e=>{r.reason=e.message;console.warn('[strata-portal] retained lifting fallback',e);return false;});
  room.ready=Promise.all([room.ready,r.ready]);return room;
}

import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installStaticRaycastTree } from '../render/StaticRaycastTree.js';

let pending;
function assets(){return pending??=fetch('assets/models/adventure/panel-workshop-v01.json').then(async r=>{if(!r.ok)return null;const spec=await r.json(),gltf=await new GLTFLoader().loadAsync(spec.model);return{spec,source:gltf.scene};}).catch(e=>{console.warn('[panel-workshop] basic workshop retained',e);return null;});}
const meshes=root=>{const result=[];root.traverse(m=>{if(m.isMesh)result.push(m);});return result;};
export function registerPanelWorkshop(room){
  if(room.spec.id!=='shadow')return room;
  const g=room.gates[2].gate,api=g.theatre,rects=room.dungeon.rects,cz=(g.seg.z0+g.seg.z1)/2;
  const root=new T.Group();root.name='가림판 관찰 작업장';api.group.add(root);
  const rail=new T.Group(),cart=new T.Group(),arm=new T.Group(),draw=new T.Group(),bar=new T.Group();root.add(rail);api.carriage.add(cart,arm,draw,bar);
  const railZ=(g.lampZ+g.wallZ)/2-.12;rail.position.set(g.objX,0,railZ);cart.position.z=-.12;
  const material=new T.MeshStandardMaterial({color:0x4f5856,roughness:.75}),metal=new T.MeshStandardMaterial({color:0xb28c48,metalness:.5,roughness:.45}),fallback=[];
  function box(parent,size,pos,mat=material){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.fromArray(pos);parent.add(m);fallback.push(m);return m;}
  for(const side of[-1,1])box(rail,[.055,.055,9.1],[side*.32,.0275,0],metal);
  box(cart,[.9,.18,.69],[0,.35,0]);box(cart,[.09,.06,.06],[0,.47,.09],metal);
  for(const x of[-.32,.32])for(const z of[-.22,.22]){const m=new T.Mesh(new T.CylinderGeometry(.14,.14,.105,24),metal);m.rotation.z=Math.PI/2;m.position.set(x,.195,z);cart.add(m);fallback.push(m);}
  box(arm,[1,.06,.06],[.5,0,0],metal);box(draw,[1,.06,.06],[.5,0,0],metal);box(bar,[.38,.06,.07],[0,0,0]);box(bar,[.06,.14,.06],[0,-.07,0],metal);
  const hidden=[...api.baseParts,...api.controlParts,...api.artSlots.signals];hidden.forEach(m=>m.visible=false);
  const record=room.panelWorkshop={loaded:false,root,rail,cart,arm,draw,bar,fallback,models:[],cameraMeshes:[],colliders:[],revision:0,controlX:1.35,controlZ:.2,actor:null};api.workshop=record;
  function register(root){for(const m of meshes(root)){m.castShadow=m.receiveShadow=false;m.material.userData.outlineParameters={visible:false};m.updateWorldMatrix(true,false);installStaticRaycastTree(m);record.cameraMeshes.push(m);if(!rects.cameraOccluders.includes(m))rects.cameraOccluders.push(m);if(!api.cameraOccluders.includes(m))api.cameraOccluders.push(m);}}
  function exclude(parts){const old=new Set(parts);rects.cameraOccluders=rects.cameraOccluders.filter(m=>!old.has(m));api.cameraOccluders.splice(0,api.cameraOccluders.length,...api.cameraOccluders.filter(m=>!old.has(m)));record.cameraMeshes=record.cameraMeshes.filter(m=>!old.has(m));}
  exclude(hidden);[rail,cart,arm,draw,bar].forEach(register);
  function body(){const o={shape:'box',padding:.28,escapeZ:1,panelWorkshop:true,minY:.6,x0:0,x1:0,z0:0,z1:0};Object.defineProperty(o,'maxY',{enumerable:true,get:()=>api.mode==='twin'&&!g.held ? .79 : 0});record.colliders.push(o);room.obstacles.push(o);api.obstacles.push(o);return o;}
  const armBody=body(),drawBody=body(),barBody=body();
  function sync(actor){
    if(actor)record.actor=actor;
    if(g.held&&record.actor&&Math.abs(record.actor.position.z-g.objZ-g.dragOffset)<.1&&Math.abs(record.actor.position.x-g.objX-1.35)<g.REACH){record.controlX=record.actor.position.x-g.objX;const side=g.dragOffset<0?-1:1;record.controlZ=record.actor.position.z-g.objZ-side*.365;}
    const x=record.controlX,z=record.controlZ;
    arm.position.set(0,.64,-.05);arm.rotation.y=x<0?Math.PI:0;arm.scale.x=Math.max(.001,Math.abs(x));
    draw.position.set(x,.64,-.05);draw.rotation.y=z>=-.05?-Math.PI/2:Math.PI/2;draw.scale.x=Math.max(.001,Math.abs(z+.05));bar.position.set(x,.75,z);
    armBody.x0=g.objX+Math.min(0,x);armBody.x1=g.objX+Math.max(0,x);armBody.z0=g.objZ-.08;armBody.z1=g.objZ-.02;
    drawBody.x0=g.objX+x-.03;drawBody.x1=g.objX+x+.03;drawBody.z0=g.objZ+Math.min(-.05,z)-.03;drawBody.z1=g.objZ+Math.max(-.05,z)+.03;
    barBody.x0=g.objX+x-.203;barBody.x1=g.objX+x+.203;barBody.z0=g.objZ+z-.04;barBody.z1=g.objZ+z+.04;
    for(const b of[armBody,drawBody,barBody]){b.x=(b.x0+b.x1)/2;b.z=(b.z0+b.z1)/2;b.r=Math.hypot(b.x1-b.x0,b.z1-b.z0)/2+.28;}
  }
  record.sync=sync;
  record.handlePoint=()=>api.carriage.localToWorld(new T.Vector3(record.controlX,0,record.controlZ));
  record.contact=actor=>{sync(actor);if(!g.held||g.solved||!actor.grounded||Math.abs(actor.position.z-g.objZ-g.dragOffset)>=.1||Math.abs(actor.position.x-g.objX-1.35)>=g.REACH)return null;const side=g.dragOffset<0?-1:1,facingZ=-side,targets={};for(const[name,sign]of[['Left',1],['Right',-1]])targets[name]=api.carriage.localToWorld(new T.Vector3(record.controlX+sign*facingZ*.12,.75,record.controlZ+side*.035));return{targets,facing:new T.Vector3(0,0,facingZ),modern:api.mode==='twin',limits:{z0:g.wallZ+1.2+g.dragOffset,z1:g.lampZ-1.2+g.dragOffset}};};
  api.grabNear=pos=>g._near(pos)&&Math.hypot(pos.x-(g.objX+record.controlX),pos.z-(g.objZ+record.controlZ))<.85;
  const resize=api.resize.bind(api),update=api.update.bind(api);api.resize=(...args)=>{const result=resize(...args);sync();return result;};api.update=actor=>{const result=update(actor);sync(actor);return result;};sync();
  for(const[side,board]of[[-1,room.panelBoards.goal],[1,room.panelBoards.hint]]){board.usePlaque();board.group.position.set(side*5.5,0,cz+56/15);board.group.rotation.y=-side*.48;register(board.group);const bounds=new T.Box3().setFromObject(board.group,true),o={shape:'box',x0:bounds.min.x,x1:bounds.max.x,z0:bounds.min.z,z1:bounds.max.z,minY:0,maxY:bounds.max.y,padding:.28,panelPlaque:true,escapeX:-side};o.x=(o.x0+o.x1)/2;o.z=(o.z0+o.z1)/2;o.r=Math.hypot(o.x1-o.x0,o.z1-o.z0)/2+.28;room.obstacles.push(o);record.colliders.push(o);}
  record.ready=Promise.all([assets(),room.ready]).then(([asset])=>{
    const previousBase=room.shadowArt.models.filter(m=>m.userData.shadowArt==='PanelBase');previousBase.forEach(m=>m.visible=false);exclude(previousBase.flatMap(meshes));record.previousBase=previousBase;
    if(!asset)return false;const{spec,source}=asset;if(spec.parts.some(n=>!source.getObjectByName(n)))return false;
    for(const[name,parent]of[['RailBed',rail],['PanelCarriage',cart],['Drawbar',arm],['Drawbar',draw],['PushBar',bar]]){const part=source.getObjectByName(name).clone(true);parent.add(part);record.models.push(part);register(part);}
    for(const board of[room.panelBoards.goal,room.panelBoards.hint]){board.shell.forEach(m=>m.visible=false);exclude(board.shell);const part=source.getObjectByName('ObservationPlaque').clone(true);board.group.add(part);record.models.push(part);register(part);}
    fallback.forEach(m=>m.visible=false);exclude(fallback);record.loaded=true;record.spec=spec;record.revision++;sync();return true;
  });room.ready=Promise.all([room.ready,record.ready]);return room;
}
